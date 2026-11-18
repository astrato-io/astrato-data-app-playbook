/** Every governed Astrato object of Corvo Stock Rotation: dimensions are view columns, measures are governed. One selection group per page. */
import { createDefaultVSpec } from '@astrato-io/visualizations';
import { compileVisualizationDefinition } from '@astrato-io/visualizations/definitions';
import { measureRef } from './fields.js';

/** Corvo palette: ink, slate, sage, yellow; red and green only as status. */
export const C = { navy: '#2D3246', ink: '#2D3246', violet: '#2D3246', teal: '#2D3246', coral: '#D9473A', amber: '#E0A800', sky: '#4B4F60', lilac: '#DBE4E2', grey: '#9AA0B4', green: '#1F9D6B', red: '#D9473A', plum: '#4B4F60' };

const PLAIN = { formatType: 'none' };
const NUM = { formatType: 'numberNoDecimal' };
export const FMT = { pct: '0.0%', pct0: '0%', int: '#,##0', dec1: '#,##0.0', gbp: '£#,##0', gbpk: '£#,##0,"k"', gbpm: '£#,##0.0,,"m"', days: '0" days"' };

const colFormat = (ref, formatString) => [
  { name: 'setColumnFormatType', ref, payload: { formatType: 'custom' } },
  { name: 'setColumnFormatString', ref, payload: { formatString } },
];
const measFormat = (ref, formatString) => [
  { name: 'setMeasureFormatType', ref, payload: { formatType: 'custom' } },
  { name: 'setMeasureFormatString', ref, payload: { formatString } },
];
const right = (...refs) => refs.map((ref) => ({ name: 'setColumnHorizontalAlign', ref, payload: { horizontalAlign: 'right' } }));
const bold = (ref, color) => ({ name: 'setColumnFontStyle', ref, payload: { fontStyle: { weight: 700, ...(color ? { color } : {}) } } });
const rowHeight = (h) => [{ name: 'setTableFixedRowHeightEnabled', payload: true }, { name: 'setTableFixedRowHeightValue', payload: h }];
/** Traffic-light text: each cut is the segment's upper bound. */
const bands = (ref, cuts, colors) => [
  { name: 'setColumnRepresentation', ref, payload: { representation: 'indicator' } },
  ...cuts.flatMap((value, segmentIndex) => [
    { name: 'addColumnIndicatorSegment', ref, payload: {} },
    { name: 'setColumnIndicatorSegmentValue', ref, payload: { segmentIndex, value } },
    { name: 'setColumnIndicatorSegmentColor', ref, payload: { segmentIndex, color: colors[segmentIndex] } },
  ]),
  { name: 'setColumnIndicatorColorText', ref, payload: { colorText: true } },
];
const perMeasure = (map) => [
  { name: 'setColoringType', payload: 'perEachMeasure' },
  ...Object.entries(map).map(([ref, graphColor]) => ({ name: 'setMeasureGraphColor', ref, payload: { graphColor } })),
];

/** Dimensions are view columns: `[name, ref, view]`. */
const dims = (...cols) => cols.map(([name, ref, view]) => ({ view, name, ref }));
/** Measures: a governed measure by name (optionally `[name, ref]`). */
const meas = (...list) => list.map((m, i) => (typeof m === 'string' ? { name: m, ref: `m${i}`, format: NUM } : { name: m[0], ref: m[1] ?? `m${i}`, format: NUM }));

const bar = (id, title, [dimName, view], measures, { group, page, sort = { by: 'm0', direction: 'desc' }, limit = 20, colors, gradient, measureColors, format = FMT.int, orientation = 'horizontal', legend = false, stacked = false, grouped = false, labels = true, barPadding = 25, hideMeasureAxis, coloring, extraOps = [] } = {}) => ({
  id, slot: id, page, title, type: 'bar', group, orientation,
  dimensions: dims([dimName, 'd0', view]),
  measures: meas(...[].concat(measures)),
  sort, limit, gradient, coloring, colors: gradient ? undefined : colors ?? (measureColors ? undefined : [C.violet]), legend, legendPosition: legend ? 'top' : undefined, stacked, grouped, barPadding,
  hideMeasureAxis: hideMeasureAxis ?? (labels && !stacked),
  ...(labels ? { dataLabels: { size: 11, format, backdrop: '#FFFFFF' } } : {}),
  ops: [...(measureColors ? perMeasure(measureColors) : []), ...[].concat(measures).map((_, i) => measFormat(`m${i}`, format)).flat(), ...extraOps],
});

export const MV = 'Corvo Inv Movements', SV = 'Corvo Inv Sales Orders', POV = 'Corvo Inv Purchase Orders', PV = 'Corvo Inv Products', WV = 'Corvo Inv Warehouses', SUV = 'Corvo Inv Suppliers', BR = 'Batch Rotation', SP = 'Stock Position';
const PCT = FMT.pct, SPCT = '+0.0%;-0.0%;0.0%', GBP = FMT.gbp, INT = FMT.int;
export const ctlId = (group, view, name) => `ctl-${group}-${view}-${name}`.toLowerCase().replace(/ /g, '-');
const ctl = (group, view, name, title) => ({ id: ctlId(group, view, name), page: 'controls', title: title ?? name, type: 'filter', group, field: { view, name }, presentation: { mode: 'dropdown', quickSelect: false, responsive: false, searchable: true, showProgressBar: false } });

/**
 * A KPI card is three native objects: the number, a mini-chart of its monthly trend and a
 * one-row table with the prior period and the change (green when it moved the right way).
 */
export const KPIS = {};
const kpiCard = (id, page, group, label, { value, fmt, py, delta, deltaFmt = SPCT, deltaLabel = 'vs prior', pyLabel = 'Prior', spark, sparkView, sparkType = 'bar', good = 'up', color = C.violet, source }) => {
  KPIS[id] = { label, source };
  const [lo, hi] = good === 'up' ? [C.red, C.green] : [C.green, C.red];
  return [
    { id, slot: id, page, title: label, type: 'number', group, measures: meas(value), ops: measFormat('m0', fmt) },
    sparkType === 'line'
      ? { id: `${id}-sp`, slot: `${id}-sp`, page, title: `${label} trend`, type: 'line', group, sparkline: true, dimensions: dims(['Month', 'd0', sparkView]), measures: meas(spark), sort: [{ by: 'd0', direction: 'asc' }], limit: 40, legend: false, colors: [color], lineCurve: 'curve' }
      : { id: `${id}-sp`, slot: `${id}-sp`, page, title: `${label} trend`, type: 'bar', group, orientation: 'vertical', dimensions: dims(['Month', 'd0', sparkView]), measures: meas(spark), sort: { by: 'd0', direction: 'asc' }, limit: 40, colors: [color], barPadding: 20, hideMeasureAxis: true, hideDimensionAxis: true, legend: false },
    {
      id: `${id}-d`, slot: `${id}-d`, page, title: `${label} vs prior`, type: 'table', group, fontSize: 12, headerHidden: true, fitColumns: { p: 0.46, c: 0.54 },
      dimensions: [], measures: meas([py, 'p'], [delta, 'c']),
      columnLabels: { p: 'Prior', c: deltaLabel },
      ops: [...rowHeight(24), ...colFormat('p', `"${pyLabel} "${fmt}`), ...colFormat('c', deltaFmt.split(';').map((f) => `"${deltaLabel} "${f}`).join(';')), ...right('c'), ...bands('c', [0, 1e12], [lo, hi])],
    },
  ];
};
const sparkCol = (ref, view, color = C.violet) => ({ ref, view, field: 'Month', color });
const tileCatalogue = () => [
  ...['g-stock', 'g-led'].flatMap((g) => [ctl(g, PV, 'Category'), ctl(g, WV, 'Warehouse Name', 'Warehouse'), ctl(g, PV, 'Product Name', 'Product')]),
  ...kpiCard('s-oh', 'stock', 'g-stock', 'Units on hand', { value: 'Units On Hand', fmt: INT, py: 'Units On Hand 30d Ago', pyLabel: '30d ago', delta: 'Units On Hand Change', spark: 'Net Movement', sparkView: MV, good: 'down', color: C.ink, source: 'Batches' }),
  ...kpiCard('s-var', 'stock', 'g-stock', 'Value at risk', { value: 'Value At Risk', fmt: GBP, py: 'Stock Value', pyLabel: 'Stock', delta: 'Value At Risk Share', deltaFmt: PCT, deltaLabel: 'of stock', spark: 'Units Expired', sparkView: MV, good: 'down', color: C.red, source: 'First-expired-first-out' }),
  ...kpiCard('s-in', 'stock', 'g-stock', 'Received, last 30d', { value: 'Received 30d', fmt: INT, py: 'Received Prior 30d', delta: 'Received Change', spark: 'Units In', sparkView: MV, color: C.ink, source: 'Movements' }),
  ...kpiCard('s-out', 'stock', 'g-stock', 'Shipped, last 30d', { value: 'Shipped 30d', fmt: INT, py: 'Shipped Prior 30d', delta: 'Shipped Change', spark: 'Units Shipped', sparkView: SV, color: C.ink, source: 'Sales orders' }),
  {
    id: 's-pos', slot: 's-pos', page: 'stock', title: 'Stock by product and warehouse', type: 'table', group: 'g-stock', fitColumns: { p: 0.23, w: 0.15, sp: 0.13, a: 0.08, q: 0.08, r: 0.07, d: 0.10, i: 0.08, o: 0.08 },
    dimensions: dims(['Product Name', 'p', PV], ['Warehouse Name', 'w', WV]),
    measures: meas(['Units Shipped', 'sp'], ['Units Available', 'a'], ['Units Quarantined', 'q'], ['Daily Run Rate', 'r'], ['Days Of Cover', 'd'], ['Units Inbound', 'i'], ['Suggested Order Units', 'o']),
    miniChart: sparkCol('sp', SV, C.ink), sort: [{ by: 'o', direction: 'desc' }], limit: 60, fontSize: 13,
    columnLabels: { p: 'Product', w: 'Warehouse', sp: 'Shipped · trend', a: 'Available', q: 'Quarantine', r: 'Units / day', d: 'Days of cover', i: 'Inbound', o: 'To order' },
    ops: [...rowHeight(34), bold('p', C.navy), ...colFormat('a', INT), ...colFormat('q', INT), ...colFormat('r', FMT.dec1), ...colFormat('d', '0'), ...colFormat('i', INT), ...colFormat('o', INT), ...right('a', 'q', 'r', 'd', 'i', 'o'), ...bands('d', [14, 30, 120, 1e9], [C.red, C.amber, C.green, C.plum])],
  },
  {
    id: 's-batch', slot: 's-batch', page: 'stock', title: 'Live batches, soonest expiry first', type: 'table', group: 'g-stock', fitColumns: { b: 0.11, p: 0.28, w: 0.08, s: 0.09, e: 0.1, x: 0.1, h: 0.08, u: 0.08, v: 0.08 },
    dimensions: dims(['BATCH_ID', 'b', BR], ['PRODUCT_NAME', 'p', BR], ['WAREHOUSE_ID', 'w', BR], ['STATUS', 's', BR], ['EXPIRY_DATE', 'e', BR], ['EXPIRY_BAND', 'x', BR]),
    measures: meas(['Units On Hand', 'h'], ['Units At Risk', 'u'], ['Value At Risk', 'v']),
    sort: [{ by: 'e', direction: 'asc' }], limit: 200, fontSize: 13,
    columnLabels: { b: 'Batch', p: 'Product', w: 'Warehouse', s: 'Status', e: 'Expiry', x: 'Band', h: 'On hand', u: 'At risk', v: 'Value at risk' },
    ops: [...rowHeight(32), bold('b', C.navy), ...colFormat('e', 'yyyy-mm-dd'), ...colFormat('h', INT), ...colFormat('u', INT), ...colFormat('v', GBP), ...right('h', 'u', 'v'), ...bands('u', [0.5, 1e9], [C.grey, C.red])],
  },
  {
    id: 'l-led', slot: 'l-led', page: 'ledger', title: 'Every movement, newest first', type: 'table', group: 'g-led', fitColumns: { d: 0.1, t: 0.16, b: 0.12, s: 0.13, w: 0.09, r: 0.15, c: 0.16, q: 0.09 },
    dimensions: dims(['Movement Date', 'd', MV], ['Movement Type', 't', MV], ['Batch ID', 'b', MV], ['Sku', 's', MV], ['Warehouse ID', 'w', MV], ['Reference', 'r', MV], ['Created By', 'c', MV]),
    measures: meas(['Net Movement', 'q']), sort: [{ by: 'd', direction: 'desc' }], limit: 500, fontSize: 13,
    columnLabels: { d: 'Date', t: 'Type', b: 'Batch', s: 'SKU', w: 'Warehouse', r: 'Reference', c: 'By', q: 'Units' },
    ops: [...rowHeight(30), ...colFormat('d', 'yyyy-mm-dd'), ...colFormat('q', '+#,##0;-#,##0;0'), ...right('q')],
  },
];

// ===========================================================================
// Resolution and compilation

const lookupDimension = (entry, fields) => fields.raw(entry.name, entry.view);
const lookupMeasure = (entry, fields) => (entry.aggregation ? fields.raw(entry.name, entry.view) : fields.measure(entry.name));

const resolve = (tile, fields) => {
  const dimensions = (tile.dimensions ?? []).map((entry) => ({ ...entry, field: lookupDimension(entry, fields) }));
  const measures = (tile.measures ?? []).map((entry) => ({ ...entry, field: lookupMeasure(entry, fields) }));
  const missing = [...dimensions, ...measures].find((entry) => !entry.field);
  if (missing) return { error: `"${missing.name}" is not in this semantic layer` };
  const filters = [];
  for (const f of tile.filters ?? []) {
    const field = f.fieldKey ? { fieldKey: f.fieldKey } : fields.raw(f.field, f.view);
    if (!field) return { error: `filter "${f.view}.${f.field}" is not in this semantic layer` };
    filters.push({ fieldKey: field.fieldKey, values: f.values });
  }
  return { dimensions, measures, filters };
};

/** Static filters: one `setStaticFilterGroup` call replaces them all; values are strings. */
const staticFilter = ({ fieldKey, values }) => ({ operator: 'or', filters: values.map((v) => ({ fieldKey, operator: 'equals', values: { value: String(v) } })) });
const filterOps = (filters) => (filters.length === 0 ? [] : [{ name: 'setStaticFilterGroup', payload: { operator: 'and', filters: filters.map(staticFilter) } }]);

const DATE_FORMATS = { date: { formatType: 'mmmyyyy' }, timestamp: { formatType: 'mmmyyyy' }, datetime: { formatType: 'mmmyyyy' } };
const isDate = (entry) => !!DATE_FORMATS[String(entry.field.dataType ?? '').toLowerCase()];
const dimensionFormat = (entry) => entry.format ?? (isDate(entry) ? DATE_FORMATS.date : PLAIN);
const dimensionEntries = (dimensions) => dimensions.map((entry) => ({ fieldKey: entry.field.fieldKey, format: dimensionFormat(entry), ref: entry.ref, ...(isDate(entry) && !entry.format ? { temporalGrouping: { mode: 'level', dateLevel: 'month' } } : {}) }));
const measureEntries = (measures) => measures.map(({ field, ref, format, aggregation }) => ({ ...measureRef(field, ref, aggregation), format }));
const withSortAndLimit = (tile) => ({
  ...(tile.sort ? { sorting: [].concat(tile.sort).map(({ by, direction }) => ({ by, direction })) } : {}),
  ...(tile.limit ? { limiting: { queryLimit: tile.limit } } : {}),
});

/** A table, or a native pivot when `tile.pivotCols` > 0: the last `pivotCols` dimensions run across the columns. */
const tableDefinitionOf = (tile, resolved) => {
  const dims = dimensionEntries(resolved.dimensions);
  const across = tile.pivotCols > 0 && dims.length > tile.pivotCols ? tile.pivotCols : 0;
  return {
    version: 1,
    type: 'table',
    data: across
      ? { structure: 'pivot', rowDimensions: dims.slice(0, -across), columnDimensions: dims.slice(-across), measures: measureEntries(resolved.measures) }
      : {
          columns: [
            ...dims.map((column) => ({ ...column, role: 'dimension' })),
            ...measureEntries(resolved.measures).map((column) => ({ ...column, role: 'measure' })),
          ],
        },
    ...withSortAndLimit(tile),
  };
};

const definitionOf = (tile, resolved) => {
  if (tile.type === 'table') return tableDefinitionOf(tile, resolved);
  const data = { measures: measureEntries(resolved.measures), ...(resolved.dimensions.length ? { dimensions: dimensionEntries(resolved.dimensions) } : {}) };
  if (tile.type === 'number') return { version: 1, type: 'number', data: { measure: data.measures[0] } };
  if (tile.type === 'pie') return { version: 1, type: 'pie', data, ...withSortAndLimit(tile), presentation: { legend: { visible: true } } };
  return {
    version: 1,
    type: tile.type,
    data,
    ...withSortAndLimit(tile),
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

const build = (tile, fields) => {
  if (tile.type === 'filter') return buildControl(tile, fields);
  const resolved = resolve(tile, fields);
  if (resolved.error) return { failure: { id: tile.id, title: tile.title, reason: resolved.error } };
  const mini = tile.miniChart ? fields.raw(tile.miniChart.field, tile.miniChart.view) : undefined;
  if (tile.miniChart && !mini) return { failure: { id: tile.id, title: tile.title, reason: `mini-chart field "${tile.miniChart.view}.${tile.miniChart.field}" is not in this semantic layer` } };
  const miniOps = mini ? [
    { name: 'setColumnRepresentation', ref: tile.miniChart.ref, payload: { representation: 'line-chart' } },
    { name: 'setColumnMiniChartDimension', ref: tile.miniChart.ref, payload: { key: mini.fieldKey } },
    { name: 'setColumnMiniChartLineColor', ref: tile.miniChart.ref, payload: { lineColor: tile.miniChart.color } },
    { name: 'setColumnMiniChartLineStrokeWidth', ref: tile.miniChart.ref, payload: { strokeWidth: 2 } },
    { name: 'setColumnMiniChartShowDataPoints', ref: tile.miniChart.ref, payload: { showDataPoints: false } },
  ] : [];
  const ops = [...filterOps(resolved.filters), ...(tile.ops ?? []), ...miniOps];
  return {
    tile: {
      ...tile,
      ops,
      columnLabels: tile.type === 'table' ? columnLabelsOf(tile, resolved) : tile.columnLabels,
      definition: definitionOf(tile, resolved),
      fieldKeys: resolved.dimensions.map((entry) => entry.field.fieldKey),
      dataTable: tile.type === 'table' || tile.type === 'filter'
        ? undefined
        : {
            id: `${tile.id}-data`, title: tile.title, type: 'table', ops: filterOps(resolved.filters),
            definition: { ...tableDefinitionOf(tile, resolved), limiting: { queryLimit: 500 } },
            columnLabels: Object.fromEntries([...resolved.dimensions, ...resolved.measures].map((entry) => [entry.ref, entry.field.name])),
          },
    },
  };
};

export const buildTiles = (fields) => {
  const tiles = [];
  const failures = [];
  for (const tile of tileCatalogue()) {
    const out = build(tile, fields);
    if (out.failure) failures.push(out.failure);
    else tiles.push(out.tile);
  }
  // Each chapter listens to its own selection group, mirrored from the filter bar (MAIN) by the
  // app: a click re-queries the chapter on screen now and the others when they are scrolled to.
    return { tiles, failures };
};
export const buildTile = (tile, fields) => build(tile, fields);

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
