/**
 * Metrics and the Astrato objects: the drill-down bar, the trend, the KPI mini charts and the
 * order-lines table.
 *
 * Grain (read from the layer's descriptions and checked with a query):
 * one row is an order line — 12,420 lines across 5,009 orders.
 *  - Sales, Profit     SUM over lines: additive at any level.
 *  - Orders            COUNT DISTINCT Order ID: never sum it across groups.
 *  - Profit ratio      SUM(Profit) / SUM(Sales): recomputed per group, never averaged.
 * Every chart and query uses the layer's governed calculations for these.
 *
 * Dimensions are the raw view columns, because a chart click selects on the
 * raw column and the app's own queries filter on it.
 *
 * Every object is built the same way, by `prepareChart(spec, availableFields)`: compile the
 * definition, then apply its operations one at a time, resolving each operation's target from
 * the compiled definition. tools/compile-adapter.mjs runs this exact function offline.
 */
import { createDefaultVSpec } from '@astrato-io/visualizations';
import { compileVisualizationDefinition } from '@astrato-io/visualizations/definitions';
import { applyOperations } from '@astrato-io/visualizations/operations';
import { getVisualizationMetadata } from '@astrato-io/visualizations/metadata';

export const GROUP = 'superstore';
export const V = (name) => `[Orders].[${name}]`;
export const DATE = V('Order Date');

const money = (v) => {
  const a = Math.abs(v);
  const s = a >= 1e6 ? `${(a / 1e6).toFixed(2)}M` : a >= 1e4 ? `${(a / 1e3).toFixed(1)}K` : Math.round(a).toLocaleString('en-US');
  return `${v < 0 ? '−' : ''}$${s}`;
};

export const METRICS = [
  { id: 'sales', label: 'Sales', itemKey: '[calculation].[Sales]', fmt: money, full: (v) => `$${Math.round(v).toLocaleString('en-US')}`, format: { formatType: 'abbreviationAuto' } },
  { id: 'profit', label: 'Profit', itemKey: '[calculation].[Profit]', fmt: money, full: (v) => `$${Math.round(v).toLocaleString('en-US')}`, format: { formatType: 'abbreviationAuto' } },
  { id: 'orders', label: 'Orders', itemKey: '[calculation].[Orders]', fmt: (v) => Math.round(v).toLocaleString('en-US'), full: (v) => Math.round(v).toLocaleString('en-US'), format: { formatType: 'numberNoDecimal' } },
  { id: 'ratio', label: 'Profit ratio', itemKey: '[calculation].[Profit Ratio]', fmt: (v) => `${v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(1)}%`, full: (v) => `${(v * 100).toFixed(2)}%`, format: { formatType: 'percentage1Decimal' }, ratio: true },
];
export const metricById = (id) => METRICS.find((m) => m.id === id);

/** Drill levels, top down. The layer's own hierarchy is Category › Sub-Category › Product. */
export const LEVELS = [
  { field: V('Category'), label: 'Category' },
  { field: V('Sub-Category'), label: 'Sub-Category' },
  { field: V('Product Name'), label: 'Product' },
];

/** The two list kinds; the order-lines table shows the other one as a column. */
export const ITEM = {
  customers: { key: V('Customer Name'), noun: 'customer', plural: 'customers', label: 'Customer' },
  products: { key: V('Product Name'), noun: 'product', plural: 'products', label: 'Product' },
};

/** Storytelling with data: one accent, greys for everything else. Mirrors styles.css. */
export const INK = { page: '#ffffff', ink: '#262626', muted: '#666666', line: '#d4d4d4', baseline: '#8f8f8f', accent: '#1f5fb8', alert: '#c2410c', context: '#9a9a9a' };
const FONT = 'Source Sans 3';

const compile = async (type, definition, availableFields) => {
  const result = await compileVisualizationDefinition({ definition, availableFields, baseVSpec: createDefaultVSpec(type) });
  if (!result.success) throw new Error(result.issues.map((i) => `${i.code} @${(i.path ?? []).join('.')}: ${i.message}`).join('; '));
  return result;
};

/** Apply operations one at a time before mount (no requests); a rejected one is reported, never thrown. */
const applyAll = async (instance, availableFields, requests) => {
  const supported = new Set(getVisualizationMetadata(instance.type).operations.names);
  let vSpec = instance.vSpec;
  const failed = [];
  for (const request of requests) {
    if (!supported.has(request.name)) {
      failed.push({ name: request.name, reason: 'unsupported' });
      continue;
    }
    const outcome = await applyOperations({ instance: { ...instance, vSpec }, availableFields, operationRequests: [request] });
    const result = Object.values(outcome.results ?? {})[0];
    if (result && result.success === false) failed.push({ name: request.name, reason: result.error ?? result.message ?? JSON.stringify(result) });
    else vSpec = outcome.vSpec;
  }
  return { vSpec, failed };
};

const itemOf = (refs, ref) => ({ dataItemInternalKey: refs[ref].dataItemInternalKey, dataItemUniqueSignature: refs[ref].dataItemUniqueSignature });

const declutter = () => [
  { name: 'setShowAxisTicks', payload: { axisName: 'dimension', showAxisTicks: false } },
  { name: 'setShowAxisTicks', payload: { axisName: 'primaryMeasure', showAxisTicks: false } },
  { name: 'setShowAxisLine', payload: { axisName: 'primaryMeasure', showAxisLine: false } },
  { name: 'setAxisLineColor', payload: { axisName: 'dimension', lineColor: INK.line } },
  ...['dimension', 'primaryMeasure'].flatMap((axisName) => [
    { name: 'setAxisLabelColor', payload: { axisName, labelColor: INK.muted } },
    { name: 'setShowAxisTitle', payload: { axisName, showAxisName: false } },
  ]),
  { name: 'setLegendEnabled', payload: false },
];

/** No axes at all: the KPI mini charts are the shape only. */
const noAxes = () => ['dimension', 'primaryMeasure'].flatMap((axisName) => [
  { name: 'setShowAxisLabels', payload: { axisName, showLabels: false } },
  { name: 'setShowAxisLine', payload: { axisName, showAxisLine: false } },
  { name: 'setShowAxisTicks', payload: { axisName, showAxisTicks: false } },
  { name: 'setShowAxisTitle', payload: { axisName, showAxisName: false } },
]);

/** Month grouping on the date axis, so labels read as months rather than epoch numbers. */
const monthly = (dim) => [
  { name: 'setDimensionTemporalGrouping', payload: { ...dim, mode: 'level', dateLevel: 'month' } },
  { name: 'setDimensionFormatType', payload: { ...dim, formatType: 'mmmyyyy' } },
];

/** The drill bar: one level of the product hierarchy, ranked by the metric. */
const buildDrillBar = async ({ id, level, metric }, availableFields) => {
  const definition = {
    version: 1,
    type: 'bar',
    data: {
      dimensions: [{ fieldKey: LEVELS[level].field, format: { formatType: 'none' }, ref: 'dim' }],
      measures: [{ fieldKey: metric.itemKey, ref: 'm', format: metric.format }],
    },
    sorting: [{ by: 'm', direction: 'desc' }],
    limiting: { queryLimit: level === 2 ? 12 : 20 },
    presentation: { axes: { dimension: { titleVisible: false }, primaryMeasure: { titleVisible: false } }, legend: { visible: false }, orientation: 'horizontal' },
  };
  const { vSpec } = await compile('bar', definition, availableFields);
  return applyAll({ id, type: 'bar', vSpec }, availableFields, [
    { name: 'setColoringType', payload: 'single' },
    { name: 'setColoringColor', payload: INK.accent },
    { name: 'setBarChartBarRadius', payload: 0 },
    // A bar axis fitted to the data misstates every bar: start it at zero.
    { name: 'setAxisStartsAtZero', payload: { axisName: 'primaryMeasure', startsAtZero: true } },
    ...declutter(),
  ]);
};

/**
 * The trend: the metric by month over the chosen period, as a line or as bars. The line carries
 * a dashed 3-month moving average beside the month values (the first months average what there
 * is, so a customer with three orders still draws a line), as context: the layer holds no
 * period-comparison measure, and the date selection that sets the period also bounds the chart.
 */
const buildTrend = async ({ id, type, metric }, availableFields) => {
  const average = type === 'line';
  const definition = {
    version: 1,
    type,
    data: {
      dimensions: [{ fieldKey: DATE, format: { formatType: 'none' }, ref: 'dim' }],
      measures: [{ fieldKey: metric.itemKey, ref: 'm', format: metric.format }, ...(average ? [{ fieldKey: metric.itemKey, ref: 'avg', format: metric.format }] : [])],
    },
    sorting: [{ by: 'dim', direction: 'asc' }],
    limiting: { queryLimit: 60 },
    presentation: { axes: { dimension: { titleVisible: false }, primaryMeasure: { titleVisible: false } }, legend: { visible: false } },
  };
  const { vSpec, resolvedRefs } = await compile(type, definition, availableFields);
  const dim = itemOf(resolvedRefs, 'dim');
  const m = itemOf(resolvedRefs, 'm');
  const ops = [
    ...monthly(dim),
    { name: 'setMeasureDataLabelsShow', payload: { ...m, show: false } },
    ...declutter(),
  ];
  if (average) {
    const avg = itemOf(resolvedRefs, 'avg');
    const adv = { ...avg, collectionKey: 'measures', advancedOperationKey: 'advancedCalculation' };
    ops.push(
      { name: 'setColoringType', payload: 'perEachMeasure' },
      { name: 'setMeasureGraphColor', payload: { ...m, graphColor: INK.accent } },
      { name: 'setMeasureGraphColor', payload: { ...avg, graphColor: INK.context } },
      { name: 'setLineType', payload: 'straight' },
      { name: 'setMeasureLineSize', payload: { ...m, strokeWidth: 2.5 } },
      { name: 'updateMeasure', payload: { ...avg, changes: { customLabel: { enabled: true, value: `${metric.label}, 3-month average` } } } },
      { name: 'setMeasureAdvancedCalculationType', payload: { ...adv, advancedCalculationType: 'movingCalculation' } },
      { name: 'setMeasureAdvancedAggregation', payload: { ...adv, aggregation: 'AVG' } },
      { name: 'setMeasureAdvancedWindowBegin', payload: { ...adv, windowBegin: -2 } },
      { name: 'setMeasureAdvancedWindowEnd', payload: { ...adv, windowEnd: 0 } },
      { name: 'setMeasureAdvancedNullIfNotEnoughValues', payload: { ...adv, nullIfNotEnoughValues: false } },
      { name: 'setMeasureLineStyle', payload: { ...avg, lineStyle: 'dashed', strokeWidth: 1.5 } },
      { name: 'setMeasureDataLabelsShow', payload: { ...avg, show: false } },
    );
  } else {
    ops.push(
      { name: 'setColoringType', payload: 'single' },
      { name: 'setColoringColor', payload: INK.accent },
      { name: 'setBarChartBarRadius', payload: 0 },
      { name: 'setAxisStartsAtZero', payload: { axisName: 'primaryMeasure', startsAtZero: true } },
    );
  }
  return applyAll({ id, type, vSpec }, availableFields, ops);
};

/** A KPI mini chart: the metric by month over the period, the shape only. */
const buildSpark = async ({ id, metric, color = INK.accent }, availableFields) => {
  const definition = {
    version: 1,
    type: 'line',
    data: {
      dimensions: [{ fieldKey: DATE, format: { formatType: 'none' }, ref: 'dim' }],
      measures: [{ fieldKey: metric.itemKey, ref: 'm', format: metric.format }],
    },
    sorting: [{ by: 'dim', direction: 'asc' }],
    limiting: { queryLimit: 60 },
    presentation: { axes: { dimension: { titleVisible: false }, primaryMeasure: { titleVisible: false } }, legend: { visible: false } },
  };
  const { vSpec, resolvedRefs } = await compile('line', definition, availableFields);
  const dim = itemOf(resolvedRefs, 'dim');
  const m = itemOf(resolvedRefs, 'm');
  return applyAll({ id, type: 'line', vSpec }, availableFields, [
    ...monthly(dim),
    { name: 'setColoringType', payload: 'single' },
    { name: 'setColoringColor', payload: color },
    { name: 'setLineType', payload: 'straight' },
    { name: 'setMeasureLineSize', payload: { ...m, strokeWidth: 1.5 } },
    { name: 'setMeasureDataLabelsShow', payload: { ...m, show: false } },
    ...noAxes(),
    { name: 'setLegendEnabled', payload: false },
    { name: 'setAnimationEnabled', payload: { enabled: false } },
  ]);
};

/**
 * The order lines: newest first, the other list's item as a column, Sales and Profit. Every
 * column but the item gets the pixel width its widest value needs; the item takes the rest of
 * the slot (`width`, the slot's clientWidth). A narrow slot leaves out Ship mode (it is a filter
 * button above), then Order ID (the export keeps both), so the item keeps at least 200px.
 * The app re-applies this on resize.
 */
const buildRecords = async ({ id, listTab, width = 900 }, availableFields) => {
  const other = listTab === 'customers' ? ITEM.products : ITEM.customers;
  const columns = [
    { fieldKey: DATE, ref: 'date', label: 'Order date', px: 116 },
    { fieldKey: V('Order ID'), ref: 'order', label: 'Order ID', px: 124 },
    { fieldKey: other.key, ref: 'other', label: other.label },
    { fieldKey: V('Ship Mode'), ref: 'ship', label: 'Ship mode', px: 112 },
  ];
  const measures = [
    { fieldKey: METRICS[0].itemKey, ref: 'sales', label: 'Sales', px: 96 },
    { fieldKey: METRICS[1].itemKey, ref: 'profit', label: 'Profit', px: 92 },
  ];
  const available = width - 48;
  const fixedOf = (list) => list.reduce((sum, c) => sum + (c.px ?? 0), 0);
  let shown = [...columns, ...measures];
  const hidden = [];
  for (const drop of ['ship', 'order']) {
    if (available - fixedOf(shown) >= 200) break;
    hidden.push(drop);
    shown = shown.filter((c) => c.ref !== drop);
  }
  const fixed = fixedOf(shown);
  const rest = Math.max(120, available - fixed);
  const scale = Math.min(1, available / (fixed + rest));
  const px = (c) => Math.floor((c.px ?? rest) * scale);
  const definition = {
    version: 1,
    type: 'table',
    data: {
      columns: [
        ...columns.map(({ fieldKey, ref }) => ({ fieldKey, ref, role: 'dimension', format: { formatType: 'none' } })),
        ...measures.map(({ fieldKey, ref }) => ({ fieldKey, ref, role: 'measure' })),
      ],
    },
    sorting: [{ by: 'date', direction: 'desc' }, { by: 'order', direction: 'asc' }],
    limiting: { queryLimit: 200 },
  };
  const { vSpec, resolvedRefs } = await compile('table', definition, availableFields);
  const label = ({ ref, label: value }) => {
    const item = itemOf(resolvedRefs, ref);
    return [
      { name: 'setColumnCustomLabelEnabled', payload: { ...item, enabled: true } },
      { name: 'setColumnCustomLabelValue', payload: { ...item, value } },
    ];
  };
  return applyAll({ id, type: 'table', vSpec }, availableFields, [
    ...[...columns, ...measures].flatMap(label),
    ...measures.map(({ ref }) => ({ name: 'setColumnHorizontalAlign', payload: { ...itemOf(resolvedRefs, ref), horizontalAlign: 'right' } })),
    // The engine returns dates as epoch milliseconds; the column must say how to print them.
    { name: 'setColumnFormatType', payload: { name: 'Order Date', formatType: 'yyyymmdd' } },
    { name: 'setTableAllColumnsResponsiveWidth', payload: false },
    ...shown.map((c) => ({ name: 'setColumnWidth', payload: { ...itemOf(resolvedRefs, c.ref), width: `${px(c)}px` } })),
    ...hidden.map((ref) => ({ name: 'setColumnHidden', payload: { ...itemOf(resolvedRefs, ref), hidden: true } })),
    { name: 'setTableBodyFontFamily', payload: FONT },
    { name: 'setTableHeaderFontFamily', payload: FONT },
    { name: 'setTableBodyFontSize', payload: 13 },
    { name: 'setTableHeaderFontColor', payload: INK.muted },
    { name: 'setTableAllColumnsFontColor', payload: INK.ink },
    { name: 'setTableBackgroundColor', payload: INK.page },
    { name: 'setTableOddBackgroundColor', payload: INK.page },
    { name: 'setTableEvenBackgroundColor', payload: INK.page },
    { name: 'setTableHeaderBackgroundColor', payload: INK.page },
    { name: 'setTableBorderColor', payload: INK.line },
    { name: 'setTableColumnBorderColor', payload: '#00000000' },
    { name: 'setTableHeaderBorderColor', payload: INK.line },
  ]);
};

const BUILDERS = { drill: buildDrillBar, trend: buildTrend, spark: buildSpark, records: buildRecords };

/** The one path from a spec to a mountable vSpec: `{ vSpec, failed }`. */
export const prepareChart = (spec, availableFields) => BUILDERS[spec.kind](spec, availableFields);

/** The object type a spec mounts as. */
export const typeOf = (spec) => (spec.kind === 'drill' ? 'bar' : spec.kind === 'trend' ? spec.type : spec.kind === 'spark' ? 'line' : 'table');
