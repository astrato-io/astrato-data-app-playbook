/**
 * Tile builders and compilation shared by every app. An app declares its objects with these
 * builders (see app.def.js); the engine resolves them against the live field catalogue.
 */
import { createDefaultVSpec } from '@astrato-io/visualizations';
import { compileVisualizationDefinition } from '@astrato-io/visualizations/definitions';
import { measureRef } from './lib/fields.js';
import { INK } from './lib/theme.js';

export const C = {
  navy: '#14213D', blue: '#3A6FF7', teal: '#12A4A0', red: '#E0475B', amber: '#F2A23A', green: '#2E9E6B', grey: '#A3ADBD', violet: '#7B61FF', sky: '#5BA4CF', pink: '#D9568E',
};
export const PALETTE = [C.blue, C.teal, C.amber, C.violet, C.red, C.green, C.sky, C.pink, C.navy, C.grey];

export const FMT = { usd: '$#,##0', usdk: '$#,##0,"k"', usdm: '$#,##0.00,,"m"', gbp: '£#,##0', gbpk: '£#,##0,"k"', gbpm: '£#,##0.0,,"m"', pct: '0.0%', pct0: '0%', spct: '+0.0%;-0.0%;0.0%', int: '#,##0', sint: '+#,##0;-#,##0;0', susdk: '+$#,##0,"k";-$#,##0,"k";$0', dec1: '#,##0.0', dec2: '0.00', sec: '0.000', x: '0.00"x"', score: '0' };

const PLAIN = { formatType: 'none' };
const NUM = { formatType: 'numberNoDecimal' };

export const colFormat = (ref, formatString) => [
  { name: 'setColumnFormatType', ref, payload: { formatType: 'custom' } },
  { name: 'setColumnFormatString', ref, payload: { formatString } },
];
export const measFormat = (ref, formatString) => [
  { name: 'setMeasureFormatType', ref, payload: { formatType: 'custom' } },
  { name: 'setMeasureFormatString', ref, payload: { formatString } },
];
export const right = (...refs) => refs.map((ref) => ({ name: 'setColumnHorizontalAlign', ref, payload: { horizontalAlign: 'right' } }));
export const bold = (ref, color) => ({ name: 'setColumnFontStyle', ref, payload: { fontStyle: { weight: 700, ...(color ? { color } : {}) } } });
export const hide = (ref) => ({ name: 'setColumnHidden', ref, payload: { hidden: true } });
export const rowHeight = (h) => [{ name: 'setTableFixedRowHeightEnabled', payload: true }, { name: 'setTableFixedRowHeightValue', payload: h }];
export const progress = (ref, color, bg = '#E9EEF6') => [
  { name: 'setColumnRepresentation', ref, payload: { representation: 'progress' } },
  { name: 'setColumnMiniChartProgressBarColor', ref, payload: { progressBarColor: color } },
  { name: 'setColumnMiniChartProgressBackgroundColor', ref, payload: { backgroundColor: bg } },
  { name: 'setColumnMiniChartProgressShowCurrentValue', ref, payload: { showCurrentValue: true } },
  { name: 'setColumnMiniChartProgressValuePlacement', ref, payload: { valuePlacement: 'inside' } },
  { name: 'setColumnProgressDynamicScaleEnabled', ref, payload: { dynamicScaleEnabled: true } },
];
/** Text coloured by thresholds: segments are [upTo, colour] in ascending order. */
export const bands = (ref, segments) => [
  { name: 'setColumnRepresentation', ref, payload: { representation: 'indicator' } },
  ...segments.flatMap(() => [{ name: 'addColumnIndicatorSegment', ref, payload: {} }]),
  ...segments.flatMap(([value, color], segmentIndex) => [
    { name: 'setColumnIndicatorSegmentValue', ref, payload: { segmentIndex, value } },
    { name: 'setColumnIndicatorSegmentColor', ref, payload: { segmentIndex, color } },
  ]),
  { name: 'setColumnIndicatorColorText', ref, payload: { colorText: true } },
];
export const signColour = (ref, below = INK.bad, above = INK.good) => bands(ref, [[0, below], [1e15, above]]);
export const perMeasure = (map) => [
  { name: 'setColoringType', payload: 'perEachMeasure' },
  ...Object.entries(map).map(([ref, graphColor]) => ({ name: 'setMeasureGraphColor', ref, payload: { graphColor } })),
];
export const MONTH = (ref = 'd0') => ({ ref, level: 'month', formatType: 'mmmyyyy' });
export const DAY = (ref = 'd0') => ({ ref, level: 'day', formatType: 'ddmmmyy' });

/** Dimensions: `[view, column, ref]`. */
export const dims = (...cols) => cols.map(([view, name, ref]) => ({ view, name, ref }));
/** Measures: a governed measure name, or `[name, ref]`, or `{ name, view, aggregation, ref }` for a raw column. */
export const meas = (...list) => list.map((m, i) => (typeof m === 'string' ? { name: m, ref: `m${i}`, format: NUM } : Array.isArray(m) ? (typeof m[0] === "object" ? { ...m[0], ref: m[1] ?? `m${i}`, format: NUM } : { name: m[0], ref: m[1] ?? `m${i}`, format: NUM }) : { ref: `m${i}`, format: NUM, ...m }));
export const F = (view, field, ...values) => ({ view, field, values });

// ---------------------------------------------------------------- tile builders
export const num = (app, id, measure, format, { color = C.navy, filters } = {}) => ({
  id: `${app}-${id}`, slot: `${app}-${id}`, app, title: measure, type: 'number', group: app, filters,
  measures: meas([measure, 'v']), numberColor: color, numberFormat: format,
  ops: measFormat('v', format),
});
export const bar = (app, id, title, [view, dim], measures, o = {}) => {
  const { sort = { by: 'm0', direction: 'desc' }, limit = 20, colors, measureColors, format = FMT.int, orientation = 'horizontal', legend = false, stacked = false, grouped = false, labels = true, filters, barPadding = 25, dimensionFormat, extraOps = [] } = o;
  const list = [].concat(measures);
  return {
    id: `${app}-${id}`, slot: `${app}-${id}`, app, title, type: 'bar', group: app, orientation, filters,
    dimensions: dims([view, dim, 'd0']), measures: meas(...list),
    sort, limit, colors: colors ?? (measureColors ? undefined : [C.blue]), legend, legendPosition: legend ? 'top' : undefined, stacked, grouped, barPadding, dimensionFormat,
    hideMeasureAxis: labels && !stacked && !grouped,
    ...(labels ? { dataLabels: { size: 11, format, backdrop: '#FFFFFF' } } : {}),
    ops: [...(measureColors ? perMeasure(measureColors) : []), ...list.flatMap((_, i) => measFormat(`m${i}`, format)), ...extraOps],
  };
};
const ADV = { collectionKey: 'measures', advancedOperationKey: 'advancedCalculation' };
/** A running (cumulative) total of a measure along the sort order. */
export const running = (ref) => [{ name: 'setMeasureAdvancedCalculationType', ref, payload: { ...ADV, advancedCalculationType: 'runningTotal' } }];
/** A reference series: the measure's mean (sd 0) or mean ± sd·σ, computed natively by the engine. */
export const controlLine = (ref, sd) => [
  { name: 'setMeasureAdvancedCalculationType', ref, payload: { ...ADV, advancedCalculationType: 'total' } },
  { name: 'setMeasureAdvancedAggregation', ref, payload: { ...ADV, aggregation: 'CONTROL_VALUE' } },
  { name: 'setMeasureAdvancedStandardDeviations', ref, payload: { ...ADV, standardDeviations: sd } },
];
/**
 * Line chart. `o.ref`: 'mean' adds an average reference line, 'band' adds mean and ±1σ lines,
 * both on the first measure. `o.target` adds a second governed measure as a target line.
 */
export const line = (app, id, title, dimensions, measures, o = {}) => {
  const list = [].concat(measures);
  const base = typeof list[0] === 'string' ? list[0] : list[0][0];
  const refs = o.ref === 'band' ? [['avg', 0], ['hi', 1], ['lo', -1]] : o.ref === 'mean' ? [['avg', 0]] : [];
  const extra = [...refs.map(([r]) => [base, r]), ...(o.target ? [[o.target, 'tgt']] : [])];
  const fmt = o.format ?? FMT.int;
  return {
    id: `${app}-${id}`, slot: `${app}-${id}`, app, title, type: 'line', group: app, filters: o.filters,
    dimensions: dims(...dimensions), measures: [...meas(...list), ...extra.map(([name, ref]) => ({ name, ref, format: NUM }))],
    sort: o.sort ?? dimensions.map((_, i) => ({ by: `d${i}`, direction: 'asc' })), limit: o.limit ?? 500,
    colors: o.colors ?? PALETTE, legend: o.legend ?? (dimensions.length > 1 || extra.length > 0), legendPosition: 'top', dimensionFormat: o.dimensionFormat,
    ops: [
      ...list.flatMap((_, i) => measFormat(`m${i}`, fmt)),
      ...extra.flatMap(([, ref]) => measFormat(ref, fmt)),
      ...refs.flatMap(([ref, sd]) => controlLine(ref, sd)),
      ...(extra.length && dimensions.length === 1 ? perMeasure({ m0: o.colors?.[0] ?? PALETTE[0], ...Object.fromEntries(refs.map(([r]) => [r, r === 'avg' ? INK.muted : INK.dim])), ...(o.target ? { tgt: C.red } : {}) }) : []),
      ...(o.extraOps ?? []),
    ],
  };
};
/** A KPI sparkline: the measure over a date column, shape only. */
export const spark = (app, id, measure, [view, dim], filters, color) => ({
  id: `${app}-${id}`, slot: `${app}-${id}`, app, title: `${measure} trend`, type: 'line', group: app, filters, sparkline: true,
  dimensions: dims([view, dim, 'd0']), measures: meas(measure), sort: { by: 'd0', direction: 'asc' }, limit: 400,
  colors: [color ?? C.blue], legend: false, noData: true,
});
/** A table column drawn as an in-cell sparkline of its measure over a date column. */
export const sparkCol = (ref, view, field, color) => [
  { name: 'setColumnRepresentation', ref, payload: { representation: 'line-chart' } },
  { name: 'setColumnMiniChartDimension', ref, payload: { key: { $field: [view, field] } } },
  ...(color ? [{ name: 'setColumnMiniChartLineColor', ref, payload: { lineColor: color } }] : []),
];
export const combo = (app, id, title, [view, dim], measures, graphTypes, o = {}) => ({
  id: `${app}-${id}`, slot: `${app}-${id}`, app, title, type: 'combo', group: app, filters: o.filters,
  dimensions: dims([view, dim, 'd0']), measures: meas(...measures),
  sort: o.sort ?? { by: 'd0', direction: 'asc' }, limit: o.limit ?? 200, legend: o.legend ?? true, legendPosition: 'top',
  colors: o.colors ?? PALETTE, graphTypes, dimensionFormat: o.dimensionFormat,
  ops: [
    ...(o.secondary ? [{ name: 'changeMeasureAxis', ref: o.secondary, payload: { secondaryAxis: true } }] : []),
    ...(o.measureColors ? perMeasure(o.measureColors) : []),
    ...measures.flatMap((_, i) => measFormat(`m${i}`, o.formats?.[i] ?? FMT.int)),
    ...(o.extraOps ?? []),
  ],
});
export const heat = (app, id, title, x, y, measure, o = {}) => ({
  id: `${app}-${id}`, slot: `${app}-${id}`, app, title, type: 'heatMap', group: app, filters: o.filters,
  dimensions: dims([...x, 'd0'], [...y, 'd1']), measures: meas(measure),
  sort: [{ by: 'd0', direction: 'asc' }, { by: 'd1', direction: 'asc' }], limit: o.limit ?? 600,
  gradient: o.gradient ?? ['#F4F6FB', '#C9D7FB', C.blue, C.navy], dataLabels: { size: 10, format: o.format ?? FMT.int }, dimensionFormat: o.dimensionFormat,
  ops: measFormat('m0', o.format ?? FMT.int),
});
export const scatter = (app, id, title, [view, dim], [mx, my], [tx, ty], o = {}) => ({
  id: `${app}-${id}`, slot: `${app}-${id}`, app, title, type: 'scatter', group: app, filters: o.filters,
  dimensions: dims([view, dim, 'd0']), measures: meas(mx, my), limit: o.limit ?? 800, colors: o.colors ?? [C.blue],
  axisTitles: { primaryMeasure: tx, secondaryMeasure: ty },
  ops: [...measFormat('m0', o.formats?.[0] ?? FMT.int), ...measFormat('m1', o.formats?.[1] ?? FMT.int)],
});
/** A table: `columns` = dims [view, name, ref, label]; `values` = [measure, ref, label, format]. */
export const table = (app, id, title, columns, values, o = {}) => ({
  id: `${app}-${id}`, slot: `${app}-${id}`, app, title, type: 'table', group: app, filters: o.filters,
  dimensions: columns.map(([view, name, ref]) => ({ view, name, ref })),
  measures: values.map(([name, ref]) => (typeof name === 'object' ? { ...name, ref, format: NUM } : { name, ref, format: NUM })),
  sort: o.sort, limit: o.limit ?? 300, fontSize: o.fontSize ?? 12.5,
  columnLabels: Object.fromEntries([...columns.map(([, , ref, label]) => [ref, label]), ...values.map(([, ref, label]) => [ref, label])]),
  fitColumns: o.fit,
  ops: [
    ...rowHeight(o.rowHeight ?? 30),
    ...values.flatMap(([, ref, , format]) => colFormat(ref, format ?? FMT.int)),
    ...right(...values.map(([, ref]) => ref)),
    ...(o.ops ?? []),
  ],
});


/** A dropdown filter on one view column, in the app's own selection group. */
export const control = (app, [view, column, label]) => ({
  id: `${app}-ctl-${column.replace(/\W+/g, '-').toLowerCase()}`, app, control: true, title: label, type: 'filter', group: app,
  field: { view, name: column }, presentation: { mode: 'dropdown', quickSelect: false, responsive: false, searchable: true, showProgressBar: false },
});

// ===========================================================================
// Resolution and compilation (as in the other no-build apps in this repo)

const lookupDimension = (entry, fields) => (entry.view === 'dimension' ? fields.dimension(entry.name) : fields.raw(entry.name, entry.view));
const lookupMeasure = (entry, fields) => (entry.aggregation ? fields.raw(entry.name, entry.view) : fields.measure(entry.name));

const resolve = (tile, fields) => {
  const dimensions = (tile.dimensions ?? []).map((entry) => ({ ...entry, field: lookupDimension(entry, fields) }));
  const measures = (tile.measures ?? []).map((entry) => ({ ...entry, field: lookupMeasure(entry, fields) }));
  const missing = [...dimensions, ...measures].find((entry) => !entry.field);
  if (missing) return { error: `"${missing.view ? `${missing.view}.` : ''}${missing.name}" is not in this semantic layer` };
  const filters = [];
  for (const f of tile.filters ?? []) {
    const field = fields.raw(f.field, f.view);
    if (!field) return { error: `filter "${f.view}.${f.field}" is not in this semantic layer` };
    filters.push({ fieldKey: field.fieldKey, values: f.values });
  }
  return { dimensions, measures, filters };
};

const staticFilter = ({ fieldKey, values }) => ({ operator: 'or', filters: values.map((v) => ({ fieldKey, operator: 'equals', values: { value: String(v) } })) });
const filterOps = (filters) => (filters.length === 0 ? [] : [{ name: 'setStaticFilterGroup', payload: { operator: 'and', filters: filters.map(staticFilter) } }]);

const dimensionEntries = (dimensions) => dimensions.map((entry) => ({ fieldKey: entry.field.fieldKey, format: PLAIN, ref: entry.ref }));
const measureEntries = (measures) => measures.map(({ field, ref, format, aggregation }) => ({ ...measureRef(field, ref, aggregation), format }));
const withSortAndLimit = (tile) => ({
  ...(tile.sort ? { sorting: [].concat(tile.sort).map(({ by, direction }) => ({ by, direction })) } : {}),
  ...(tile.limit ? { limiting: { queryLimit: tile.limit } } : {}),
});

const tableDefinitionOf = (tile, resolved) => ({
  version: 1, type: 'table',
  data: { columns: [...dimensionEntries(resolved.dimensions).map((c) => ({ ...c, role: 'dimension' })), ...measureEntries(resolved.measures).map((c) => ({ ...c, role: 'measure' }))] },
  ...withSortAndLimit(tile),
});

const definitionOf = (tile, resolved) => {
  if (tile.type === 'table') return tableDefinitionOf(tile, resolved);
  const data = { measures: measureEntries(resolved.measures), ...(resolved.dimensions.length ? { dimensions: dimensionEntries(resolved.dimensions) } : {}) };
  if (tile.type === 'number') return { version: 1, type: 'number', data: { measure: data.measures[0] } };
  if (tile.type === 'scatter') {
    return {
      version: 1, type: 'scatter', data, ...(tile.limit ? { limiting: { queryLimit: tile.limit } } : {}),
      presentation: { axes: { primaryMeasure: { labelsVisible: true, title: tile.axisTitles.primaryMeasure, titleVisible: true }, secondaryMeasure: { labelsVisible: true, title: tile.axisTitles.secondaryMeasure, titleVisible: true } }, legend: { visible: false } },
    };
  }
  return {
    version: 1, type: tile.type, data, ...withSortAndLimit(tile),
    presentation: {
      axes: { dimension: { labelsVisible: true, titleVisible: false }, primaryMeasure: { labelsVisible: !tile.hideMeasureAxis, titleVisible: false } },
      legend: { visible: tile.type === 'line' ? true : Boolean(tile.legend), ...(tile.legend && tile.legendPosition ? { position: tile.legendPosition } : {}) },
      ...(tile.type === 'bar' ? { orientation: tile.orientation ?? 'vertical' } : {}),
    },
  };
};

const columnLabelsOf = (tile, resolved) =>
  Object.fromEntries([...resolved.dimensions, ...resolved.measures].map((entry) => [entry.ref, tile.columnLabels?.[entry.ref] ?? entry.field.name]));

const buildControl = (control, fields) => {
  const field = fields.raw(control.field.name, control.field.view);
  if (!field) return { failure: { id: control.id, title: control.title, reason: `"${control.field.view}.${control.field.name}" is not in this semantic layer` } };
  const definition = { version: 1, type: 'filter', data: { field: { fieldKey: field.fieldKey, ref: 'field' } }, presentation: control.presentation };
  return { tile: { ...control, slot: control.id, definition, fieldKeys: [field.fieldKey] } };
};

const resolveFieldRefs = (value, fields) => {
  if (Array.isArray(value)) return value.map((v) => resolveFieldRefs(v, fields));
  if (value && typeof value === 'object') {
    if (Array.isArray(value.$field)) return fields.raw(value.$field[1], value.$field[0])?.fieldKey ?? value.$field.join('.');
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolveFieldRefs(v, fields)]));
  }
  return value;
};

const build = (tile, fields) => {
  if (tile.type === 'filter') return buildControl(tile, fields);
  const resolved = resolve(tile, fields);
  if (resolved.error) return { failure: { id: tile.id, title: tile.title, reason: resolved.error } };
  return {
    tile: {
      ...tile,
      ops: [...filterOps(resolved.filters), ...(tile.ops ?? []).map((op) => resolveFieldRefs(op, fields))],
      columnLabels: tile.type === 'table' ? columnLabelsOf(tile, resolved) : tile.columnLabels,
      definition: definitionOf(tile, resolved),
      dataTable: tile.type === 'table' || tile.type === 'number'
        ? undefined
        : {
            id: `${tile.id}-data`, title: tile.title, type: 'table', ops: filterOps(resolved.filters),
            definition: { ...tableDefinitionOf(tile, resolved), limiting: { queryLimit: 1000 } },
            columnLabels: Object.fromEntries([...resolved.dimensions, ...resolved.measures].map((entry) => [entry.ref, entry.field.name])),
          },
    },
  };
};

export const buildTiles = (fields, list) => {
  const tiles = [];
  const failures = [];
  for (const tile of list) {
    const out = build(tile, fields);
    if (out.failure) failures.push(out.failure);
    else tiles.push(out.tile);
  }
  return { tiles, failures };
};

export const compileDefinition = async (type, definition, availableFields) => {
  const result = await compileVisualizationDefinition({ definition, availableFields, baseVSpec: createDefaultVSpec(type) });
  if (!result.success) throw new Error(result.issues.map((issue) => `${issue.code} @${(issue.path ?? []).join('.')}: ${issue.message}`).join('; '));
  return { vSpec: result.vSpec, resolvedRefs: result.resolvedRefs ?? {} };
};

export const compileTiles = async (tiles, availableFields) => {
  const compiled = [];
  const failures = [];
  await Promise.all(tiles.map(async (tile) => {
    try {
      compiled.push({ ...tile, ...(await compileDefinition(tile.type, tile.definition, availableFields)) });
    } catch (error) {
      failures.push({ id: tile.id, title: tile.title, reason: String(error?.message ?? error) });
    }
  }));
  const order = new Map(tiles.map((t, i) => [t.id, i]));
  compiled.sort((a, b) => order.get(a.id) - order.get(b.id));
  return { compiled, failures };
};
