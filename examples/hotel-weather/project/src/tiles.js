/**
 * Every object on the page, and the one function that turns a tile into a finished vSpec.
 *
 * A tile names its source:
 *   gov    a native object on the semantic layer; `question` is the stored business question it
 *          shows, and its title on screen
 *   duck   the same native object types on the DuckDB engine (duck-engine.js); `blend` marks the
 *          ones that need the governed rows copied into the browser
 * and its tab: `dash` (Weather & demand) or `plan` (Wet-night offer).
 *
 * `prepare` (definition → compile → operations) runs in the app before mounting and in the
 * offline compile check (tools/compile-adapter.mjs), so a refused operation is caught there first.
 */
import { createDefaultVSpec } from '@astrato-io/visualizations';
import { compileVisualizationDefinition } from '@astrato-io/visualizations/definitions';
import { applyOperations } from '@astrato-io/visualizations/operations';

/**
 * One colour, one meaning. Source colours mark where a figure comes from (governed blue, API amber,
 * blended purple). Dry and wet are weather states, so they get their own pair (stone grey and rain
 * teal) and never reuse a source colour. Green and red appear only on good/bad change.
 */
export const C = {
  ink: '#1B2A3A', muted: '#5C6B7A', line: '#E1E6EC',
  gov: '#2F6FED', duck: '#C77A00', mix: '#6B4FD8',
  good: '#1E8E5A', bad: '#C7362F', neutral: '#5C6B7A',
  dry: '#9A8F80', wet: '#0E8C9A',
};
const FONT = 'Roboto, Arial, sans-serif';
const L3M_ONLY = { operator: 'and', filters: [{ fieldKey: '[Calendar].[Rolling Bucket]', operator: 'inList', values: ['L3M'] }] };
const WHATIF_Q = "What would a wet-night offer add to this autumn's room revenue?";

/** The what-if levers: measure parameters declared by the layer's wet-night offer measures. */
export const PARAMS = {
  wet_share: { label: 'Share of nights that are wet', min: 0, max: 0.6, step: 0.01, fallback: 0.2 },
  occ_uplift_pts: { label: 'Occupancy uplift on wet nights', min: 0, max: 15, step: 0.5, fallback: 6 },
  rate_discount_pct: { label: 'Rate discount on wet nights', min: 0, max: 30, step: 1, fallback: 5 },
};

/** source, id, tab, type, question/title, data, presentation hints. `up`: is a rise good, bad or neither. */
export const TILES = [
  // ── Weather & demand: KPI cards (a number with its comparison, and a mini chart under it)
  { src: 'gov', tab: 'dash', id: 'k-occ', type: 'number', question: 'What was occupancy this autumn against last?', measure: 'Occupancy L3M', comparison: 'Occupancy L3M vs LY', up: 'good' },
  { src: 'gov', tab: 'dash', id: 's-occ', type: 'line', spark: true, question: 'How full were the hotels night by night this autumn?', dims: ['Stay Date'], measures: ['Occupancy L3M'], filterGroup: L3M_ONLY, color: C.gov },
  { src: 'gov', tab: 'dash', id: 'k-rev', type: 'number', question: 'What did rooms earn this autumn against last?', measure: 'Room Revenue L3M', comparison: 'Room Revenue L3M YoY', up: 'good' },
  { src: 'gov', tab: 'dash', id: 's-rev', type: 'line', spark: true, question: 'How much did rooms earn night by night this autumn?', dims: ['Stay Date'], measures: ['Room Revenue L3M'], filterGroup: L3M_ONLY, color: C.gov },
  { src: 'duck', tab: 'dash', id: 'k-temp', type: 'number', title: 'How hot were the days?', measure: 'Average high', comparison: 'Average high vs last autumn', up: 'neutral' },
  { src: 'duck', tab: 'dash', id: 's-temp', type: 'line', spark: true, title: 'Daily high', dims: ['Stay Date'], measures: ['Average high'], color: C.duck },
  { src: 'duck', tab: 'dash', id: 'k-wet', type: 'number', title: 'How many city-days were wet?', measure: 'Wet city-days', comparison: 'Wet city-days vs last autumn', up: 'bad' },
  { src: 'duck', tab: 'dash', id: 's-wet', type: 'bar', spark: true, title: 'Wet city-days by city', dims: ['City'], measures: ['Wet city-days'], color: C.wet },
  { src: 'duck', tab: 'dash', blend: true, id: 'k-gap', type: 'number', title: 'Were wet nights emptier than dry ones?', measure: 'Wet vs dry nights', comparison: 'Wet vs dry nights vs last autumn', up: 'good' },
  { src: 'duck', tab: 'dash', blend: true, id: 's-gap', type: 'bar', spark: true, title: 'Wet vs dry by city', dims: ['City'], measures: ['Wet vs dry nights'], color: C.mix },
  // ── Weather & demand: governed charts
  { src: 'gov', tab: 'dash', id: 'g-city', type: 'bar', question: 'Which cities earn the most room revenue this autumn?', dims: ['City'], measures: ['Room Revenue L3M'], sort: 'm0', color: C.gov },
  { src: 'gov', tab: 'dash', id: 'g-occ', type: 'line', question: 'How full were the hotels night by night this autumn?', dims: ['Stay Date'], measures: ['Occupancy L3M'], filterGroup: L3M_ONLY, color: C.gov },
  {
    src: 'gov', tab: 'dash', id: 'g-table', type: 'table', question: 'How does each city compare with last autumn, and what share of revenue does it carry?',
    dims: ['City'], measures: ['Occupancy L3M', 'Occupancy L3M vs LY', 'Room Revenue L3M', 'Room Revenue L3M YoY', 'Room Revenue Share L3M'],
    labels: ['City', 'Occ.', 'vs LY', 'Revenue', 'vs LY', 'Share'],
    widths: { d0: 76, m0: 58, m1: 82, m2: 84, m3: 72, m4: 54, trend: 60 },
    // Change columns carry a coloured indicator: green up, red down, grey flat. Stops are in the
    // measure's own unit (points for occupancy, a ratio for revenue growth).
    indicators: { m1: 0.05, m3: 0.0005 },
    lyRefs: ['m1', 'm3'],
    trend: { measure: 'Occupancy', by: 'Month', label: 'By month' },
  },
  // ── Weather & demand: API and blended charts
  { src: 'duck', tab: 'dash', id: 'd-temp', type: 'line', title: 'How hot was each day, and what was the 7-night trend?', dims: ['Stay Date'], measures: ['Average high', '7-night average'], colors: [C.duck, C.ink] },
  { src: 'duck', tab: 'dash', blend: true, id: 'd-rain', type: 'bar', title: 'Are hotels emptier on wet nights?', dims: ['City'], measures: ['Dry nights', 'Wet nights'], colors: [C.dry, C.wet], grouped: true },
  { src: 'duck', tab: 'dash', blend: true, id: 'd-band', type: 'bar', title: 'Does occupancy follow the temperature?', dims: ['Temperature band'], measures: ['Occupancy'], color: C.mix, labels: true },
  // ── Wet-night offer: governed baseline against governed scenario (layer parameters)
  { src: 'gov', tab: 'plan', id: 'p-base', type: 'number', question: WHATIF_Q, label: 'Room revenue, as booked', measure: 'Room Revenue L3M' },
  { src: 'gov', tab: 'plan', id: 'p-rev', type: 'number', question: WHATIF_Q, label: 'Room revenue, with the offer', measure: 'Room Revenue L3M Wet-Night Offer', comparison: 'Wet-Night Offer Revenue Change L3M', up: 'good', params: true },
  { src: 'gov', tab: 'plan', id: 'p-occb', type: 'number', question: WHATIF_Q, label: 'Occupancy, as booked', measure: 'Occupancy L3M' },
  { src: 'gov', tab: 'plan', id: 'p-occ', type: 'number', question: WHATIF_Q, label: 'Occupancy, with the offer', measure: 'Occupancy L3M Wet-Night Offer', params: true },
  // A bridge from nothing to the offer's net change: what the extra nights earn, less what the discount costs.
  { src: 'gov', tab: 'plan', id: 'p-bridge', type: 'waterfall', question: "What would the wet-night offer's extra nights earn, and what would its discount cost?", measures: ['Wet-Night Offer Extra Nights Revenue L3M', 'Wet-Night Offer Discount Cost L3M'], params: true, total: 'Net change' },
  { src: 'gov', tab: 'plan', id: 'p-city', type: 'bar', question: 'Which cities would gain most from a wet-night offer?', dims: ['City'], measures: ['Wet-Night Offer Revenue Change L3M'], sort: 'm0', color: C.gov, params: true, labels: true },
];

export const FILTERS = [{ id: 'f-city', type: 'filter', src: 'gov', field: 'City', label: 'City' }];

/** How a name resolves to a field key, per source. fields: the governed field index; duck: duck-engine exports. */
export const resolver = (src, fields, duck) => (src === 'gov'
  ? {
    dim: (n) => fields.dimension(n)?.fieldKey ?? (() => { throw new Error(`dimension "${n}" is not in the semantic layer`); })(),
    measure: (n) => fields.measure(n)?.fieldKey ?? (() => { throw new Error(`measure "${n}" is not in the semantic layer`); })(),
    selectionKey: (n) => fields.selectionKey(n),
  }
  : {
    dim: (n) => Object.keys(duck.DIMENSIONS).find((k) => k.endsWith(`.[${n}]`)) ?? (() => { throw new Error(`no DuckDB field "${n}"`); })(),
    measure: (n) => (duck.MEASURES[n] ? duck.measureKey(n) : (() => { throw new Error(`no DuckDB measure "${n}"`); })()),
    selectionKey: (n) => Object.keys(duck.DIMENSIONS).find((k) => k.endsWith(`.[${n}]`)),
  });

const isDate = (name) => name === 'Stay Date';

export const definitionOf = (tile, r) => {
  const base = { version: 1, type: tile.type };
  if (tile.type === 'filter') {
    return { ...base, data: { field: { fieldKey: r.dim(tile.field), ref: 'field' } }, presentation: { mode: 'dropdown', quickSelect: false, searchable: true, showProgressBar: false } };
  }
  if (tile.type === 'number') return { ...base, data: { measure: { ref: 'v', fieldKey: r.measure(tile.measure) } } };
  if (tile.type === 'waterfall') return { ...base, data: { measures: tile.measures.map((m, i) => ({ ref: `m${i}`, fieldKey: r.measure(m) })) } };
  const dims = (tile.dims ?? []).map((d, i) => ({ ref: `d${i}`, fieldKey: r.dim(d), ...(isDate(d) ? { temporalGrouping: { dateLevel: 'day', mode: 'level' } } : {}) }));
  const measures = tile.measures.map((m, i) => ({ ref: `m${i}`, fieldKey: r.measure(m) }));
  const filters = tile.filterGroup ? { filterGroup: tile.filterGroup } : {};
  const sorting = { sorting: [tile.sort ? { by: tile.sort, direction: 'desc' } : { by: 'd0', direction: 'asc' }] };
  if (tile.type === 'table') {
    const columns = [...dims.map((d) => ({ ...d, role: 'dimension' })), ...measures.map((m) => ({ ...m, role: 'measure' }))];
    if (tile.trend) columns.push({ ref: 'trend', fieldKey: r.measure(tile.trend.measure), role: 'measure' });
    return {
      ...base, data: { structure: 'normal', columns }, sorting: [{ by: 'm2', direction: 'desc' }], limiting: { queryLimit: 50 },
      presentation: {
        body: { fontFamily: FONT, fontSize: 12, fontColor: C.ink, verticalAlign: 'middle' },
        header: { fontFamily: FONT, fontSize: 11, fontColor: C.muted, backgroundColor: '#FFFFFF', borderColor: C.line },
        borders: { enabled: true, color: C.line, dividerColor: '#EEF1F5', dividers: 'horizontal', radius: 0, strokeWidth: 1, lineStyle: 'line' },
        highlight: { mode: 'row', backgroundColor: '#EEF3FD' },
        layout: { columnWidthBehavior: 'responsive', rowHeight: 26 },
      },
    };
  }
  const presentation = {
    axes: { dimension: { labelsVisible: !tile.spark, titleVisible: false }, primaryMeasure: { labelsVisible: !tile.spark, titleVisible: false, ...(tile.type === 'bar' ? { range: { startsAtZero: true } } : {}) } },
    legend: { visible: Boolean(tile.legend), ...(tile.legend ? { position: 'top' } : {}) },
    ...(tile.type === 'bar' ? { orientation: tile.orientation ?? 'vertical' } : {}),
    ...(tile.type === 'line' ? { dataLabels: { visible: false } } : {}),
  };
  return { ...base, data: { dimensions: dims, measures }, ...filters, ...sorting, limiting: { queryLimit: 400 }, presentation };
};

const target = (resolvedRefs, ref) => {
  const t = resolvedRefs?.[ref];
  if (!t) throw new Error(`no resolved ref "${ref}"`);
  return { dataItemInternalKey: t.dataItemInternalKey, dataItemUniqueSignature: t.dataItemUniqueSignature };
};

/**
 * The layer parameters a vSpec's measures declare, set to `values`. Read from the compiled vSpec,
 * so a number's comparison measure (added by an operation) is covered too.
 */
export const paramOps = (vSpec, values) => {
  const ops = [];
  for (const [collectionKey, list] of [['measures', vSpec?.measures], ['supportingMeasures', vSpec?.supportingMeasures]]) {
    for (const m of list ?? []) {
      const item = m?.dataItem;
      const declared = item?.calculation?.params ?? [];
      for (const p of declared) {
        if (values?.[p.name] == null) continue;
        ops.push({
          name: 'setMeasureDefinedParameter',
          payload: { dataItemInternalKey: item.internalKey, dataItemUniqueSignature: item.uniqueSignature, ...(collectionKey === 'measures' ? {} : { collectionKey }), parameterName: p.name, value: { type: 'static', value: Number(values[p.name]) } },
        });
      }
    }
  }
  return ops.map((op, i) => ({ id: `param-${i}`, ...op }));
};

/** Show or hide a table's comparison-with-last-autumn columns (off under a date selection). */
export const lyColumnOps = (tile, resolvedRefs, hidden) => (tile.lyRefs ?? [])
  .map((ref, i) => ({ id: `ly-${i}`, name: 'setColumnHidden', payload: { ...target(resolvedRefs, ref), hidden } }));

/** Operations the definition schema has no place for. `withComparison: false` leaves the number's comparison off. */
export const operationsOf = (tile, r, resolvedRefs, { withComparison = true, tableWidth = 440 } = {}) => {
  const ops = [];
  const on = (ref, name, payload) => ops.push({ name, payload: { ...target(resolvedRefs, ref), ...payload } });
  if (tile.type === 'number') {
    ops.push({ name: 'setNumberFontSize', payload: 26 }, { name: 'setNumberFontColor', payload: C.ink }, { name: 'setHorizontalAlign', payload: 'left' });
    if (withComparison && tile.comparison) {
      ops.push({ name: 'addMeasure', payload: { sourceKind: 'calculation', key: r.measure(tile.comparison), role: 'number-comparison' } });
      ops.push({ name: 'setComparisonPosition', payload: 'right' }, { name: 'setComparisonRelativeFontSizePercentage', payload: 52 }, { name: 'setComparisonFontColor', payload: C.neutral });
    }
  }
  if (tile.type === 'line' || tile.type === 'bar') {
    if (tile.colors) {
      ops.push({ name: 'setColoringType', payload: 'perEachMeasure' });
      tile.colors.forEach((graphColor, i) => on(`m${i}`, 'setMeasureGraphColor', { graphColor }));
    } else on('m0', 'setMeasureGraphColor', { graphColor: tile.color });
    if (tile.type === 'line') tile.measures.forEach((_, i) => on(`m${i}`, 'setMeasureLineSize', { strokeWidth: tile.spark ? 2 : i === 1 ? 3 : 1.5 }));
    if (tile.grouped) ops.push({ name: 'setBarChartLayout', payload: 'groups' });
    if (tile.labels) on('m0', 'setMeasureDataLabelsShow', { show: true });
    if (tile.legend) ops.push({ name: 'setLegendItemLabelFontSize', payload: 11 });
    if (!tile.spark) for (const axisName of ['dimension', 'primaryMeasure']) ops.push({ name: 'setAxisLabelColor', payload: { axisName, labelColor: C.muted } });
    // Occupancy and temperature live far from zero: let a line's axis fit the data.
    if (tile.type === 'line') ops.push({ name: 'setAxisStartsAtZero', payload: { axisName: 'primaryMeasure', startsAtZero: false } });
    if (tile.spark) for (const axisName of ['dimension', 'primaryMeasure']) ops.push({ name: 'setShowAxisLine', payload: { axisName, showAxisLine: false } }, { name: 'setShowAxisTicks', payload: { axisName, showAxisTicks: false } });
  }
  if (tile.type === 'waterfall') {
    tile.measures.forEach((_, i) => on(`m${i}`, 'setMeasureDataLabelsShow', { show: true }));
    ops.push({ name: 'setWaterfallTotalDataLabelShow', payload: true }, { name: 'setAnimationEnabled', payload: { enabled: false } });
    for (const axisName of ['dimension', 'primaryMeasure']) ops.push({ name: 'setAxisLabelColor', payload: { axisName, labelColor: C.muted } });
  }
  if (tile.type === 'table') {
    const refs = [...tile.dims.map((_, i) => `d${i}`), ...tile.measures.map((_, i) => `m${i}`), ...(tile.trend ? ['trend'] : [])];
    const labels = [...tile.labels, ...(tile.trend ? [tile.trend.label] : [])];
    refs.forEach((ref, i) => { on(ref, 'setColumnCustomLabelEnabled', { enabled: true }); on(ref, 'setColumnCustomLabelValue', { value: labels[i] }); });
    tile.measures.forEach((_, i) => on(`m${i}`, 'setColumnHorizontalAlign', { horizontalAlign: 'right' }));
    ops.push({ name: 'setTableWordWrapHeader', payload: true });
    ops.push(...widthOps(tile, resolvedRefs, tableWidth));
    for (const [ref, stop] of Object.entries(tile.indicators ?? {})) {
      on(ref, 'setColumnRepresentation', { representation: 'indicator' });
      // Three segments, sorted by stop: at or below −stop is worse, up to +stop is flat, above is better.
      [[-stop, C.bad, 'arrow_downward'], [stop, C.neutral, 'remove'], [1e12, C.good, 'arrow_upward']].forEach(([value, color, icon], segmentIndex) => {
        on(ref, 'addColumnIndicatorSegment', {});
        on(ref, 'setColumnIndicatorSegmentValue', { segmentIndex, value });
        on(ref, 'setColumnIndicatorSegmentColor', { segmentIndex, color });
        on(ref, 'setColumnIndicatorSegmentIcon', { segmentIndex, icon });
      });
      on(ref, 'setColumnIndicatorColorText', { colorText: true });
      on(ref, 'setColumnIndicatorPosition', { position: 'left' });
    }
    if (tile.trend) {
      on('trend', 'setColumnRepresentation', { representation: 'line-chart' });
      on('trend', 'setColumnMiniChartDimension', { key: r.selectionKey(tile.trend.by) });
      on('trend', 'setColumnMiniChartLineColor', { lineColor: C.gov });
      on('trend', 'setColumnMiniChartLineStrokeWidth', { strokeWidth: 1.5 });
      on('trend', 'setColumnMiniChartShowDataPoints', { showDataPoints: false });
    }
  }
  return ops;
};

/** Fixed column widths, scaled down to the card's width so no column is cut off at 1280 or 1024. */
export const widthOps = (tile, resolvedRefs, tableWidth) => {
  const total = Object.values(tile.widths ?? {}).reduce((a, b) => a + b, 0);
  const scale = Math.min(1.25, (tableWidth - 64) / total); // the table pads about 50px (scrollbar and cell padding)
  return Object.entries(tile.widths ?? {}).flatMap(([ref, px]) => [
    { name: 'setColumnResponsiveWidth', payload: { ...target(resolvedRefs, ref), responsiveWidth: false } },
    { name: 'setColumnWidth', payload: { ...target(resolvedRefs, ref), width: `${Math.floor(px * scale)}px` } },
  ]).map((op, i) => ({ id: `w${i}`, ...op }));
};

/** definition → compile → operations (→ layer parameters). Returns the vSpec and every refused operation. */
export const prepare = async (tile, r, availableFields, options = {}) => {
  let definition = definitionOf(tile, r);
  let compiled = await compileVisualizationDefinition({ definition, availableFields, baseVSpec: createDefaultVSpec(tile.type) });
  // A field that is already one row per day may refuse a day grouping; keep it as it is then.
  if (!compiled.success && compiled.issues.some((i) => /temporalGrouping/.test(JSON.stringify(i)))) {
    definition = { ...definition, data: { ...definition.data, dimensions: definition.data.dimensions.map(({ temporalGrouping, ...d }) => d) } };
    compiled = await compileVisualizationDefinition({ definition, availableFields, baseVSpec: createDefaultVSpec(tile.type) });
  }
  if (!compiled.success) throw new Error(`${tile.id}: ${compiled.issues.map((i) => `${i.code} @${(i.path ?? []).join('.')}: ${i.message}`).join('; ')}`);
  if (tile.type === 'filter' && compiled.vSpec?.dimensions?.[0]) compiled.vSpec.dimensions[0].label = tile.label;
  // A waterfall has no colour or total operation: good/bad colours for the steps and a closing
  // total bar are set on the vSpec.
  if (tile.type === 'waterfall') {
    compiled.vSpec.colors = { ...compiled.vSpec.colors, positive: C.good, negative: C.bad, subTotal: C.gov };
    compiled.vSpec.total = { ...compiled.vSpec.total, enabled: true, label: tile.total, showDataLabel: true, color: C.gov };
  }
  const operationRequests = operationsOf(tile, r, compiled.resolvedRefs, options).map((op, i) => ({ id: `${op.name}-${i}`, ...op }));
  let vSpec = compiled.vSpec;
  const refusals = [];
  const run = async (requests) => {
    if (!requests.length) return;
    const done = await applyOperations({ instance: { id: tile.id, type: tile.type, vSpec }, availableFields, operationRequests: requests });
    refusals.push(...Object.entries(done.results ?? {}).filter(([, res]) => !res?.success).map(([id, res]) => `${tile.id} ${id}: ${JSON.stringify(res?.error ?? res).slice(0, 240)}`));
    vSpec = done.vSpec;
  };
  await run(operationRequests);
  if (tile.params && options.params) await run(paramOps(vSpec, options.params));
  return { vSpec, refusals, resolvedRefs: compiled.resolvedRefs };
};
