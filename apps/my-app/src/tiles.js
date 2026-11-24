/**
 * Catalogue tile → visualization definition → compiled vSpec → operations, before mounting.
 *
 * The same `prepare` runs in the app and in the offline compile check (tools/compile-adapter.mjs),
 * so an operation the installed library refuses is caught there first. Copied from the
 * ed-wait-watch example (src/tiles.js) and adapted for this app on visualizations 0.11.
 */
import { createDefaultVSpec } from '@astrato-io/visualizations';
import { compileVisualizationDefinition } from '@astrato-io/visualizations/definitions';
import { applyOperations } from '@astrato-io/visualizations/operations';
import { C } from './catalogue.js';

const FONT = '"IBM Plex Sans", Roboto, "Segoe UI", system-ui, sans-serif';
const DATE_DIMS = new Set(['Order Month', 'Trailing 12 Months']);
/** Measure display formats on charts: the layer's own pattern would print $40,000 on an axis. */
const chartFormat = (tile) => (tile.pct ? { format: { formatType: 'percentage1Decimal' } } : tile.compact ? { format: { formatType: 'abbreviation1Decimal' } } : {});

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
const dimEntry = (fields, d) => ({
  ref: d.ref, fieldKey: dimField(fields, d.d).fieldKey,
  ...(DATE_DIMS.has(d.d) ? { temporalGrouping: { dateLevel: 'month', mode: 'level' }, format: { formatType: 'mmmyyyy' } } : {}),
});

/** The tile's visualization definition (data, sorting, presentation). */
export const definitionOf = (tile, fields) => {
  if (tile.type === 'filter') {
    const fieldKey = fields.dimension(tile.field)?.fieldKey ?? fields.selectionKey(tile.field);
    if (!fieldKey) throw new Error(`filter field "${tile.field}" is not in this semantic layer`);
    return { version: 1, type: 'filter', data: { field: { fieldKey, ref: 'field' } }, presentation: { mode: 'dropdown', quickSelect: false, searchable: true, showProgressBar: false } };
  }
  const base = { version: 1, type: tile.type };
  if (tile.type === 'number') return { ...base, data: { measure: { ref: 'v', fieldKey: measureField(fields, tile.measures[0].m).fieldKey } } };
  // A rank column is a whole number, not the measure's own format (a rank of 6 would print as 600.0%).
  const measures = tile.measures.map((m) => ({ ref: m.ref, fieldKey: measureField(fields, m.m).fieldKey, ...(m.axis ? { axis: m.axis } : {}), ...(m.series ? { seriesType: m.series } : {}),
    ...(tile.type === 'line' ? { dataPointShape: 'circle' } : {}),
    ...(m.rank ? { format: { formatType: 'numberNoDecimal' } } : tile.type === 'table' ? {} : chartFormat(tile)) }));
  const dims = (tile.dims ?? []).map((d) => dimEntry(fields, d));
  const sorting = tile.sort ? { sorting: tile.sort } : {};
  if (tile.type === 'table') {
    const columns = [...dims.map((d) => ({ ...d, role: 'dimension' })), ...measures.map((m) => ({ ...m, role: 'measure' }))];
    if (tile.spark) columns.push({ ref: tile.spark.ref, fieldKey: measureField(fields, tile.spark.m).fieldKey, role: 'measure' });
    return {
      ...base, data: { structure: 'normal', columns }, ...sorting, limiting: { queryLimit: 500 },
      presentation: {
        body: { fontFamily: FONT, fontSize: tile.fontSize ?? 12, fontColor: C.ink, verticalAlign: 'middle' },
        header: { fontFamily: FONT, fontSize: 11, fontColor: C.grey, backgroundColor: '#FFFFFF', borderColor: C.line },
        borders: { enabled: true, color: C.line, dividerColor: '#EFECE4', dividers: 'horizontal', radius: 0, strokeWidth: 1, lineStyle: 'line' },
        highlight: { mode: 'row', backgroundColor: '#EEF4F1' },
        layout: { columnWidthBehavior: tile.widths ? 'static' : 'responsive', rowHeight: tile.rowHeight ?? 28 },
      },
    };
  }
  const spark = tile.kind === 'spark' || tile.kind === 'flagbar';
  const axes = {
    dimension: { labelsVisible: !spark, titleVisible: false },
    primaryMeasure: { labelsVisible: !spark, titleVisible: false },
    ...(measures.some((m) => m.axis === 'secondary') ? { secondaryMeasure: { labelsVisible: true, titleVisible: false } } : {}),
  };
  const presentation = { axes, legend: { visible: Boolean(tile.legend), ...(tile.legend ? { position: 'top' } : {}) }, ...(tile.type === 'line' || tile.type === 'combo' ? { dataLabels: { visible: false } } : {}) };
  if (tile.type === 'bar' || tile.type === 'combo') presentation.orientation = tile.orientation ?? 'vertical';
  if (tile.topN) return { ...base, data: { dimensions: dims, measures }, ...sorting, limiting: { queryLimit: tile.topN }, presentation };
  if (tile.type === 'heatMap') return { ...base, data: { dimensions: dims, measures }, ...sorting, limiting: { queryLimit: 500 }, presentation: { legend: { visible: false } } };
  return { ...base, data: { dimensions: dims, measures }, ...sorting, limiting: { queryLimit: 2000 }, presentation };
};

export const target = (resolvedRefs, ref) => {
  const r = resolvedRefs?.[ref];
  if (!r) throw new Error(`no resolved ref "${ref}"`);
  return { dataItemInternalKey: r.dataItemInternalKey, dataItemUniqueSignature: r.dataItemUniqueSignature };
};

/** Fixed widths for narrow columns; the flexing ones split what is left of the slot. */
export const columnWidths = (tile, total) => {
  const flex = Object.entries(tile.flex ?? {});
  const need = Object.values(tile.widths ?? {}).reduce((a, b) => a + b, 0) + flex.reduce((a, [, min]) => a + min, 0);
  // Narrow slot (1024 px): shrink every column by the same factor (never below 72%) so none is pushed out of view.
  const k = need > total ? Math.max(0.72, total / need) : 1;
  const out = Object.fromEntries(Object.entries(tile.widths ?? {}).map(([r, px]) => [r, Math.floor(px * k)]));
  if (k < 1) { for (const [ref, min] of flex) out[ref] = Math.floor(min * k); return out; }
  const fixed = Object.values(out).reduce((a, b) => a + b, 0);
  const spare = Math.max(0, total - fixed - flex.reduce((a, [, min]) => a + min, 0));
  for (const [ref, min] of flex) out[ref] = Math.floor(min + spare / flex.length);
  return out;
};

/** Operations outside the definition schema, per tile type. */
export const operationsOf = (tile, fields, resolvedRefs, options = {}) => {
  const ops = [];
  const on = (ref, name, payload) => ops.push({ name, payload: { ...target(resolvedRefs, ref), ...payload } });
  if (tile.type === 'number') {
    const size = tile.kind === 'kpi' ? (tile.hero ? 30 : 27) : tile.kind === 'whatif' ? 26 : 22;
    ops.push({ name: 'setNumberFontSize', payload: size });
    ops.push({ name: 'setNumberFontColor', payload: tile.alarm ? C.bad : C.ink });
    ops.push({ name: 'setHorizontalAlign', payload: 'left' });
    const cmp = tile.measures.find((m) => m.role === 'comparison');
    if (cmp) {
      ops.push({ name: 'addMeasure', payload: { sourceKind: 'calculation', key: measureField(fields, cmp.m).fieldKey, role: 'number-comparison' } });
      ops.push({ name: 'setComparisonPosition', payload: 'right' });
      ops.push({ name: 'setComparisonRelativeFontSizePercentage', payload: 46 });
      ops.push({ name: 'setComparisonFontColor', payload: C.grey });
    }
    if (tile.param) on('v', 'setMeasureDefinedParameter', { parameterName: tile.param, value: { type: 'static', value: options.param ?? 30 } });
  }
  if (tile.type === 'line' || tile.type === 'bar' || tile.type === 'combo') {
    if (tile.stacked) {
      ops.push({ name: 'setBarChartLayout', payload: 'stacked' });
      ops.push({ name: 'setColoringOverwrites', payload: { overwrites: Object.entries(tile.statusColors).map(([value, color]) => ({ value, color })) } });
    } else if (tile.colors && tile.measures.length > 1) {
      ops.push({ name: 'setColoringType', payload: 'perEachMeasure' });
      for (const [ref, graphColor] of Object.entries(tile.colors)) on(ref, 'setMeasureGraphColor', { graphColor });
    } else {
      on(tile.measures[0].ref, 'setMeasureGraphColor', { graphColor: tile.color ?? Object.values(tile.colors ?? {})[0] ?? C.green });
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
    if (tile.kind === 'spark' || tile.kind === 'flagbar') {
      ops.push({ name: 'setShowAxisLabels', payload: { axisName: 'dimension', showLabels: false } }, { name: 'setShowAxisLabels', payload: { axisName: 'primaryMeasure', showLabels: false } });
    } else {
      for (const axisName of ['dimension', 'primaryMeasure']) ops.push({ name: 'setAxisLabelColor', payload: { axisName, labelColor: C.grey } }, { name: 'setAxisLineColor', payload: { axisName, lineColor: C.line } });
    }
    if (tile.hideZero) ops.push({ name: 'setHideZeroValues', payload: true });
    if (tile.type === 'bar' && tile.labels !== false && !tile.stacked) on(tile.measures[0].ref, 'setMeasureDataLabelsShow', { show: true });
    for (const m of tile.measures) if (m.label) on(m.ref, 'updateMeasure', { changes: { customLabel: { enabled: true, value: m.label } } });
  }
  if (tile.type === 'heatMap') {
    ops.push({ name: 'setColoringType', payload: 'gradient' });
    // Low share seen within 30 minutes is bad: dark coral; high is pale teal.
    ops.push({ name: 'setCustomGradientColors', payload: { colors: ['#9F2D12', '#F2B48C', '#E3F1F1'] } });
    on(tile.measures[0].ref, 'setMeasureDataLabelsShow', { show: true });
  }
  if (tile.type === 'table') {
    const all = [...(tile.dims ?? []).map((d) => d.ref), ...tile.measures.map((m) => m.ref), ...(tile.spark ? [tile.spark.ref] : [])];
    const labels = Object.fromEntries([...(tile.dims ?? []).map((d) => [d.ref, d.label ?? d.d]), ...tile.measures.map((m) => [m.ref, m.label ?? m.m]), ...(tile.spark ? [[tile.spark.ref, tile.spark.label]] : [])]);
    for (const ref of all) {
      on(ref, 'setColumnCustomLabelEnabled', { enabled: true });
      on(ref, 'setColumnCustomLabelValue', { value: labels[ref] });
    }
    ops.push({ name: 'setTableAllColumnsSortIconBehavior', payload: 'active' }, { name: 'setTableWordWrapHeader', payload: true });
    for (const m of tile.measures) {
      on(m.ref, 'setColumnHorizontalAlign', { horizontalAlign: 'right' });
      if (m.rank) {
        on(m.ref, 'setMeasureAdvancedCalculationType', { advancedCalculationType: 'rank' });
        on(m.ref, 'setMeasureAdvancedRankSortDirection', { rankSortDirection: m.rank === 'descending' ? 'desc' : 'asc' });
      }
    }
    if (tile.widths) for (const [ref, px] of Object.entries(columnWidths(tile, options.tableWidth ?? 640))) {
      on(ref, 'setColumnResponsiveWidth', { responsiveWidth: false });
      on(ref, 'setColumnWidth', { width: `${px}px` });
    }
    if (tile.spark) {
      const sp = tile.spark.ref;
      on(sp, 'setColumnRepresentation', { representation: 'line-chart' });
      on(sp, 'setColumnMiniChartDimension', { key: fields.selectionKey('Order Month') });
      on(sp, 'setColumnMiniChartLineColor', { lineColor: tile.spark.color ?? C.green });
      on(sp, 'setColumnMiniChartLineStrokeWidth', { strokeWidth: 1.5 });
      on(sp, 'setColumnMiniChartShowDataPoints', { showDataPoints: false });
    }
  }
  return ops;
};

/** definition → compile → operations. Returns the finished vSpec and every refused operation. */
export const prepare = async (tile, fields, availableFields, options = {}) => {
  let definition = definitionOf(tile, fields);
  let compiled = await compileVisualizationDefinition({ definition, availableFields, baseVSpec: createDefaultVSpec(tile.type) });
  // A date dimension that already returns one row per month may refuse a month grouping; keep it as it is.
  if (!compiled.success && compiled.issues.some((i) => /temporalGrouping/.test((i.path ?? []).join('.')))) {
    definition = { ...definition, data: { ...definition.data, dimensions: definition.data.dimensions.map(({ temporalGrouping, ...d }) => d) } };
    compiled = await compileVisualizationDefinition({ definition, availableFields, baseVSpec: createDefaultVSpec(tile.type) });
  }
  if (!compiled.success) throw new Error(compiled.issues.map((i) => `${i.code} @${(i.path ?? []).join('.')}: ${i.message}`).join('; '));
  // A filter's dropdown shows its dimension's label; there is no operation for it on 0.9 (knowledge/visualizations.md).
  if (tile.type === 'filter' && compiled.vSpec?.dimensions?.[0]) compiled.vSpec.dimensions[0].label = tile.label;
  const operationRequests = operationsOf(tile, fields, compiled.resolvedRefs, options).map((op, i) => ({ id: `${op.name}-${i}`, ...op }));
  if (!operationRequests.length) return { vSpec: compiled.vSpec, refusals: [], warnings: compiled.warnings ?? [], resolvedRefs: compiled.resolvedRefs };
  const done = await applyOperations({ instance: { id: tile.id, type: tile.type, vSpec: compiled.vSpec }, availableFields, operationRequests });
  const refusals = Object.entries(done.results ?? {}).filter(([, r]) => !r?.success).map(([id, r]) => `${id}: ${JSON.stringify(r?.error ?? r).slice(0, 240)}`);
  return { vSpec: done.vSpec, refusals, warnings: compiled.warnings ?? [], resolvedRefs: compiled.resolvedRefs };
};
