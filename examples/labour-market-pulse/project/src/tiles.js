/**
 * Catalogue tile → visualization definition → compiled vSpec → operations, before mounting.
 *
 * The same `prepare` runs in the app and in the offline compile check
 * (tools/compile-adapter.mjs), so an operation the installed library refuses is caught there first.
 * Static filters and every presentation setting are applied here, in one batch, before
 * runtime.createInstance (README: "Finishing A Chart Before Mounting").
 */
import { createDefaultVSpec } from '@astrato-io/visualizations';
import { compileVisualizationDefinition } from '@astrato-io/visualizations/definitions';
import { applyOperations } from '@astrato-io/visualizations/operations';
import { C } from './catalogue.js';

export const LATEST = { field: 'Period Status', op: 'equals', value: 'Latest' };
const FONT = 'Inter, "Segoe UI", system-ui, sans-serif';

/** The same group in the setStaticFilterGroup operation shape (values: { value }, one value per filter). */
export const opGroup = (group) => ({ operator: 'and', filters: (group?.filters ?? []).map((f) => (f.operator === 'inList'
  ? { operator: 'or', filters: f.values.map((v) => ({ fieldKey: f.fieldKey, operator: 'equals', values: { value: v } })) }
  : { fieldKey: f.fieldKey, operator: f.operator, values: { value: f.value } })) });

/** Static filter group for a tile: its own filters, plus Latest while no time is selected. */
export const staticGroup = (tile, fields, { latest }) => {
  const list = [...(tile.filters ?? []), ...(tile.latest && latest ? [LATEST] : [])]
    .filter((f, i, all) => all.findIndex((g) => g.field === f.field && g.op === f.op) === i);
  if (!list.length) return null;
  const filters = list.map((f) => {
    const fieldKey = fields.selectionKey(f.field);
    if (!fieldKey) throw new Error(`filter field "${f.field}" is not in this semantic layer`);
    if (f.op === 'equals') return { fieldKey, operator: 'inList', values: [String(f.value)] };
    if (f.op === 'contains') return { fieldKey, operator: 'contains', value: String(f.value) };
    if (f.op === 'greaterThanOrEqual') return { fieldKey, operator: 'greaterThanOrEqualTo', value: String(f.value) };
    throw new Error(`unsupported filter operator ${f.op}`);
  });
  return { operator: 'and', filters };
};

const measureField = (fields, name) => {
  const f = fields.measure(name);
  if (!f) throw new Error(`measure "${name}" is not in this semantic layer`);
  return f;
};
const dimField = (fields, name) => {
  const f = fields.dimension(name);
  if (!f) throw new Error(`dimension "${name}" is not in this semantic layer`);
  return f;
};
const isDate = (fields, name) => name === 'Period';
const dimEntry = (fields, d) => ({
  ref: d.ref, fieldKey: dimField(fields, d.d).fieldKey,
  ...(isDate(fields, d.d) ? { temporalGrouping: { dateLevel: 'month', mode: 'level' } } : {}),
});

/** The tile's visualization definition (data, sorting, presentation). Static filters are applied by `prepare`. */
export const definitionOf = (tile, fields, { latest = true } = {}) => {
  const group = staticGroup(tile, fields, { latest });
  const base = { version: 1, type: tile.type, ...(group ? { filterGroup: group } : {}) };
  if (tile.type === 'filter') {
    const fieldKey = fields.dimension(tile.field)?.fieldKey ?? fields.selectionKey(tile.field);
    return { version: 1, type: 'filter', data: { field: { fieldKey, ref: 'field' } }, presentation: { mode: 'dropdown', quickSelect: false, searchable: true, showProgressBar: false } };
  }
  if (tile.type === 'number') return { ...base, data: { measure: { ref: 'v', fieldKey: measureField(fields, tile.measures[0].m).fieldKey } } };
  const measures = tile.measures.map((m) => ({ ref: m.ref, fieldKey: measureField(fields, m.m).fieldKey, ...(m.axis ? { axis: m.axis } : {}), ...(m.format ? { format: { formatType: 'numberNoDecimal' } } : {}) }));
  const dims = (tile.dims ?? []).map((d) => dimEntry(fields, d));
  const sorting = tile.sort ? { sorting: tile.sort } : {};
  if (tile.type === 'table') {
    const columns = [...dims.map((d) => ({ ...d, role: 'dimension' })), ...measures.map((m) => ({ ...m, role: 'measure' }))];
    if (tile.spark) columns.push({ ref: tile.spark.ref, fieldKey: measureField(fields, tile.spark.m).fieldKey, role: 'measure' });
    return {
      ...base, data: { structure: 'normal', columns }, ...sorting, limiting: { queryLimit: 200 },
      presentation: {
        body: { fontFamily: FONT, fontSize: 12, fontColor: C.navy, verticalAlign: 'middle' },
        header: { fontFamily: FONT, fontSize: 11, fontColor: C.grey, backgroundColor: '#FFFFFF', borderColor: C.line },
        borders: { enabled: true, color: C.line, dividerColor: '#EEF0F3', dividers: 'horizontal', radius: 0, strokeWidth: 1, lineStyle: 'line' },
        highlight: { mode: 'row', backgroundColor: '#F4F7F6' },
        layout: { columnWidthBehavior: tile.widths ? 'static' : 'responsive', rowHeight: tile.rowHeight ?? 28 },
      },
    };
  }
  const axes = {
    dimension: { labelsVisible: tile.kind !== 'spark', titleVisible: false },
    primaryMeasure: { labelsVisible: tile.kind !== 'spark', titleVisible: false, ...(tile.bandValue != null ? { bands: [{ start: 0, end: tile.bandValue, color: '#E8F1EF', label: 'Tighter than Feb 2020' }] } : {}) },
    ...(measures.some((m) => m.axis === 'secondary') ? { secondaryMeasure: { labelsVisible: true, titleVisible: false } } : {}),
  };
  const presentation = { axes, legend: { visible: Boolean(tile.legend), ...(tile.legend ? { position: tile.legend === 'right' ? 'right' : 'top' } : {}) }, ...(tile.type === 'line' ? { dataLabels: { visible: false } } : {}) };
  if (tile.type === 'bar') presentation.orientation = tile.orientation ?? 'vertical';
  if (tile.type === 'bar' && tile.signed) {
    // Colour carries meaning: a fall in vacancies, or a rise in unemployment, is red.
    const bad = tile.id === 'c-reg-chg' ? 'greater' : 'less';
    const good = bad === 'greater' ? 'less' : 'greater';
    presentation.coloring = { rules: [{ measure: tile.measures[0].ref, operator: bad, value: 0, color: C.red }, { measure: tile.measures[0].ref, operator: good, value: 0, color: C.green }] };
  }
  return { ...base, data: { dimensions: dims, measures }, ...sorting, limiting: { queryLimit: 2000 }, presentation };
};

const target = (resolvedRefs, ref) => {
  const r = resolvedRefs?.[ref];
  if (!r) throw new Error(`no resolved ref "${ref}"`);
  return { dataItemInternalKey: r.dataItemInternalKey, dataItemUniqueSignature: r.dataItemUniqueSignature };
};

/** Operations outside the definition schema, per tile type. */
/**
 * Column widths for a table with `widths` (fixed px) and `flex` (minimum px): the flexing columns
 * get their minimum, then split what is left evenly. `total` is the slot's inner width.
 */
export const columnWidths = (tile, total) => {
  const out = { ...tile.widths };
  const flex = Object.entries(tile.flex ?? {});
  const fixed = Object.values(tile.widths ?? {}).reduce((a, b) => a + b, 0);
  const spare = Math.max(0, total - fixed - flex.reduce((a, [, min]) => a + min, 0));
  for (const [ref, min] of flex) out[ref] = Math.floor(min + spare / flex.length);
  return out;
};

export const operationsOf = (tile, fields, resolvedRefs, options = {}) => {
  const { param } = options;
  const ops = [];
  const on = (ref, name, payload) => ops.push({ name, payload: { ...target(resolvedRefs, ref), ...payload } });
  if (tile.type === 'number') {
    ops.push({ name: 'setNumberFontSize', payload: tile.kind === 'whatif' ? 26 : 30 });
    ops.push({ name: 'setNumberFontColor', payload: C.navy });
    ops.push({ name: 'setHorizontalAlign', payload: 'left' });
    const cmp = tile.measures.find((m) => m.role === 'comparison');
    if (cmp) {
      ops.push({ name: 'addMeasure', payload: { sourceKind: 'calculation', key: measureField(fields, cmp.m).fieldKey, role: 'number-comparison' } });
      ops.push({ name: 'setComparisonPosition', payload: 'right' });
      ops.push({ name: 'setComparisonRelativeFontSizePercentage', payload: 48 });
      ops.push({ name: 'setComparisonFontColor', payload: C.grey });
    }
    if (tile.param) on('v', 'setMeasureDefinedParameter', { parameterName: tile.param, value: { type: 'static', value: param ?? 4 } });
  }
  if (tile.type === 'line' || tile.type === 'bar') {
    if (tile.colors && tile.measures.length > 1) {
      ops.push({ name: 'setColoringType', payload: 'perEachMeasure' });
      for (const [ref, graphColor] of Object.entries(tile.colors)) on(ref, 'setMeasureGraphColor', { graphColor });
    } else if (tile.palette) {
      ops.push({ name: 'setColoringType', payload: 'categorical' }, { name: 'setCustomPaletteColors', payload: { colors: tile.palette } });
    } else if (tile.kind === 'spark' || (!tile.signed && tile.type === 'bar')) {
      on(tile.measures[0].ref, 'setMeasureGraphColor', { graphColor: tile.color ?? Object.values(tile.colors ?? {})[0] ?? C.navy });
    }
    for (const m of tile.measures) {
      if (m.moving) {
        on(m.ref, 'setMeasureAdvancedCalculationType', { advancedCalculationType: 'movingCalculation' });
        on(m.ref, 'setMeasureAdvancedAggregation', { aggregation: m.moving.aggregate });
        on(m.ref, 'setMeasureAdvancedWindowBegin', { windowBegin: m.moving.windowBegin });
        on(m.ref, 'setMeasureAdvancedWindowEnd', { windowEnd: m.moving.windowEnd });
      }
    }
    if (tile.type === 'line') for (const m of tile.measures) on(m.ref, 'setMeasureLineSize', { strokeWidth: tile.kind === 'spark' ? 2 : m.moving ? 3 : 2 });
    if (tile.kind === 'spark') {
      ops.push({ name: 'setShowAxisLabels', payload: { axisName: 'dimension', showLabels: false } }, { name: 'setShowAxisLabels', payload: { axisName: 'primaryMeasure', showLabels: false } });
    }
    if (tile.type === 'bar') on(tile.measures[0].ref, 'setMeasureDataLabelsShow', { show: true });
    for (const m of tile.measures) if (m.label) on(m.ref, 'updateMeasure', { changes: { customLabel: { enabled: true, value: m.label } } });
  }
  if (tile.type === 'heatMap') {
    ops.push({ name: 'setColoringType', payload: 'gradient' });
    ops.push({ name: 'setCustomGradientColors', payload: { colors: ['#E8F1EF', '#F6C99A', '#B42318'] } });
    on(tile.measures[0].ref, 'setMeasureDataLabelsShow', { show: true });
  }
  if (tile.type === 'table') {
    if (tile.merge === false) ops.push({ name: 'setTableMergedCells', payload: false });
    const all = [...(tile.dims ?? []).map((d) => d.ref), ...tile.measures.map((m) => m.ref), ...(tile.spark ? [tile.spark.ref] : [])];
    const labels = Object.fromEntries([...(tile.dims ?? []).map((d) => [d.ref, d.label ?? d.d]), ...tile.measures.map((m) => [m.ref, m.label ?? m.m]), ...(tile.spark ? [[tile.spark.ref, tile.spark.label]] : [])]);
    for (const ref of all) {
      on(ref, 'setColumnCustomLabelEnabled', { enabled: true });
      on(ref, 'setColumnCustomLabelValue', { value: labels[ref] });
    }
    for (const m of tile.measures) {
      on(m.ref, 'setColumnHorizontalAlign', { horizontalAlign: 'right' });
      if (m.rank) {
        on(m.ref, 'setMeasureAdvancedCalculationType', { advancedCalculationType: 'rank' });
        on(m.ref, 'setMeasureAdvancedRankSortDirection', { rankSortDirection: m.rank === 'descending' ? 'desc' : 'asc' });
      }
    }
    // Fixed widths for narrow columns, so the responsive ones (names, values) get the room they need.
    // Static widths: narrow columns fixed, the rest share what is left (app.js refits on resize).
    if (tile.widths) for (const [ref, px] of Object.entries(columnWidths(tile, options.tableWidth ?? 640))) {
      on(ref, 'setColumnResponsiveWidth', { responsiveWidth: false });
      on(ref, 'setColumnWidth', { width: `${px}px` });
    }
    if (tile.spark) {
      const sp = tile.spark.ref;
      on(sp, 'setColumnRepresentation', { representation: 'line-chart' });
      on(sp, 'setColumnMiniChartDimension', { key: fields.selectionKey('Period') });
      on(sp, 'setColumnMiniChartLineColor', { lineColor: C.teal });
      on(sp, 'setColumnMiniChartLineStrokeWidth', { strokeWidth: 1.5 });
      on(sp, 'setColumnMiniChartShowDataPoints', { showDataPoints: false });
    }
  }
  return ops;
};

/** definition → compile → operations. Returns the finished vSpec and every refused operation. */
export const prepare = async (tile, fields, availableFields, options = {}) => {
  let definition = definitionOf(tile, fields, options);
  let compiled = await compileVisualizationDefinition({ definition, availableFields, baseVSpec: createDefaultVSpec(tile.type) });
  // A date dimension that already returns one row per month may refuse a month grouping; keep it as it is.
  if (!compiled.success && compiled.issues.some((i) => /temporalGrouping/.test((i.path ?? []).join(".")))) {
    definition = { ...definition, data: { ...definition.data, dimensions: definition.data.dimensions.map(({ temporalGrouping, ...d }) => d) } };
    compiled = await compileVisualizationDefinition({ definition, availableFields, baseVSpec: createDefaultVSpec(tile.type) });
  }
  if (!compiled.success) throw new Error(compiled.issues.map((i) => `${i.code} @${(i.path ?? []).join('.')}: ${i.message}`).join('; '));
  const operationRequests = operationsOf(tile, fields, compiled.resolvedRefs, options).map((op, i) => ({ id: `${op.name}-${i}`, ...op }));
  if (!operationRequests.length) return { vSpec: compiled.vSpec, refusals: [], warnings: compiled.warnings ?? [], resolvedRefs: compiled.resolvedRefs };
  const done = await applyOperations({ instance: { id: tile.id, type: tile.type, vSpec: compiled.vSpec }, availableFields, operationRequests });
  const refusals = Object.entries(done.results ?? {}).filter(([, r]) => !r?.success).map(([id, r]) => `${id}: ${JSON.stringify(r?.error ?? r).slice(0, 240)}`);
  return { vSpec: done.vSpec, refusals, warnings: compiled.warnings ?? [], resolvedRefs: compiled.resolvedRefs };
};
