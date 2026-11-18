/**
 * Every native object in the Climb Planner, declared once as data.
 *
 * A tile = one stored business question (questions.js) + presentation. Nothing here
 * computes a figure: values, gaps, ranks and the what-if all come from layer measures.
 *
 * Selection groups:
 *   main      the rival set: the filters, the selection bar and chart clicks live here
 *   stand / measures / climb   one per tab, mirrored from main only while the tab is visible
 *   us        our university only (pinned; ignores the rival filters, and says so)
 *   whatif    no selections: whole league (projected rank)
 *   overtake  Total Score (2027) between our score and our score + the gain
 *   focus     the universities named in the focus plan, plus us
 */
import { createDefaultVSpec } from '@astrato-io/visualizations';
import { compileVisualizationDefinition } from '@astrato-io/visualizations/definitions';
import { QUESTIONS } from './questions.js';
import { PALETTE as P } from './theme.js';

export const GROUPS = { main: 'main', stand: 'stand', measures: 'measures', climb: 'climb', us: 'us', whatif: 'whatif', overtake: 'overtake', focus: 'focus' };
export const TAB_GROUPS = { stand: GROUPS.stand, measures: GROUPS.measures, climb: GROUPS.climb };

/** Reader-facing names for governed items (legends, headers, chips, Excel). */
export const DISPLAY = {
  'Rank 2027': 'Rank', University: 'University', 'University (Short)': 'University', 'Rank 2026 (value)': '2026', 'Rank Change (value)': 'Moved',
  'Avg Total Score': 'Total', 'Avg Research': 'Research', 'Avg Entry Points': 'Entry (UCAS)', 'Avg Graduate Prospects': 'Prospects', 'Avg Experience': 'Experience',
  'Avg Teaching': 'Teaching', 'Avg Firsts': 'Firsts/2:1', 'Avg Continuation': 'Continuation', 'Rank (value)': 'Overall', 'Historic Rank': 'Rank', 'Avg Historic Rank': 'Average rank',
  'Score Gap to Benchmark': 'Points vs us', Edition: 'Edition', Movement: 'Movement', Universities: 'Universities',
};

const colFormat = (ref, formatString) => [
  { name: 'setColumnFormatType', ref, payload: { formatType: 'custom' } },
  { name: 'setColumnFormatString', ref, payload: { formatString } },
];
const indicator = (ref, [below, above], fmt) => [
  ...(fmt ? colFormat(ref, fmt) : []),
  { name: 'setColumnRepresentation', ref, payload: { representation: 'indicator' } },
  { name: 'addColumnIndicatorSegment', ref, payload: {} },
  { name: 'addColumnIndicatorSegment', ref, payload: {} },
  { name: 'setColumnIndicatorSegmentValue', ref, payload: { segmentIndex: 0, value: 0 } },
  { name: 'setColumnIndicatorSegmentValue', ref, payload: { segmentIndex: 1, value: 1e9 } },
  { name: 'setColumnIndicatorSegmentColor', ref, payload: { segmentIndex: 0, color: below } },
  { name: 'setColumnIndicatorSegmentColor', ref, payload: { segmentIndex: 1, color: above } },
  { name: 'setColumnIndicatorShowText', ref, payload: { showText: true } },
  { name: 'setColumnIndicatorColorText', ref, payload: { colorText: true } },
];
const bold = (ref) => ({ name: 'setColumnFontStyle', ref, payload: { fontStyle: { weight: 700 } } });
const UP_GOOD = [P.red, P.green];
const RANK_COLS = ['research', 'entry', 'prospects', 'firsts', 'continuation', 'experience', 'teaching'];
/** A within-set rank coloured by position: 1–5 green, 6–15 plain, 16+ red (lower is better). */
const rankBands = (ref) => [
  ...colFormat(ref, '0'),
  { name: 'setColumnRepresentation', ref, payload: { representation: 'indicator' } },
  ...[0, 1, 2].map(() => ({ name: 'addColumnIndicatorSegment', ref, payload: {} })),
  { name: 'setColumnIndicatorSegmentValue', ref, payload: { segmentIndex: 0, value: 5.5 } },
  { name: 'setColumnIndicatorSegmentValue', ref, payload: { segmentIndex: 1, value: 15.5 } },
  { name: 'setColumnIndicatorSegmentValue', ref, payload: { segmentIndex: 2, value: 1e9 } },
  { name: 'setColumnIndicatorSegmentColor', ref, payload: { segmentIndex: 0, color: P.green } },
  { name: 'setColumnIndicatorSegmentColor', ref, payload: { segmentIndex: 1, color: '#1B2733' } },
  { name: 'setColumnIndicatorSegmentColor', ref, payload: { segmentIndex: 2, color: P.red } },
  { name: 'setColumnIndicatorShowText', ref, payload: { showText: true } },
  { name: 'setColumnIndicatorColorText', ref, payload: { colorText: true } },
];
const DOWN_GOOD = [P.green, P.red];
const PLACES = '+0" places";-0" places";"no change"';

/** One stored question as tile fields. `keep` picks and orders measure keys. */
const fromQuestion = (key, keep) => {
  const q = QUESTIONS[key];
  if (!q) throw new Error(`no stored question "${key}"`);
  const ms = keep ? keep.map((k) => q.m.find(([mk]) => mk === k)).filter(Boolean) : q.m;
  const refs = new Set([...q.d.map(([k]) => k), ...ms.map(([k]) => k)]);
  return {
    question: q.title,
    dimensions: q.d.map(([ref, name]) => ({ ref, name })),
    measures: ms.map(([ref, name, calc]) => ({ ref, name, calc })),
    sort: q.o.filter(([k]) => refs.has(k)).map(([by, direction]) => ({ by, direction })),
  };
};

/** Operations that carry a question's advanced calculation onto a table/chart measure. */
const calcOps = (measures) => measures.filter((m) => m.calc).flatMap((m) => {
  if (m.calc.rank) return [
    { name: 'setMeasureAdvancedCalculationType', ref: m.ref, payload: { advancedCalculationType: 'rank' } },
    { name: 'setMeasureAdvancedRankSortDirection', ref: m.ref, payload: { rankSortDirection: m.calc.rank } },
  ];
  if (m.calc.moving) return [
    { name: 'setMeasureAdvancedCalculationType', ref: m.ref, payload: { advancedCalculationType: 'movingCalculation' } },
    { name: 'setMeasureAdvancedAggregation', ref: m.ref, payload: { aggregation: m.calc.moving.aggregate } },
    { name: 'setMeasureAdvancedWindowBegin', ref: m.ref, payload: { windowBegin: m.calc.moving.begin } },
    { name: 'setMeasureAdvancedWindowEnd', ref: m.ref, payload: { windowEnd: m.calc.moving.end } },
  ];
  return [];
});

/** Short table headers, so narrow numeric columns never ellipsise. */
export const SHORT = { 'Rank 2027': '#', University: 'University', 'University (Short)': 'University', 'Rank 2026 (value)': '2026', 'Rank Change (value)': 'Moved', 'Avg Total Score': 'Total',
  'Avg Research': 'Res.', 'Avg Entry Points': 'Entry', 'Avg Graduate Prospects': 'Prosp.', 'Avg Experience': 'Exp.', 'Avg Teaching': 'Teach.', 'Avg Firsts': '1st/2:1', 'Avg Continuation': 'Cont.',
  'Rank (value)': 'Overall', 'Score Gap to Benchmark': 'vs us' };
const labelsOf = (f, extra = {}) => ({ ...Object.fromEntries([...f.dimensions, ...f.measures].map((x) => [x.ref, DISPLAY[x.name] ?? x.name])), ...extra });

// ------------------------------------------------------------------ tile builders
const number = (id, tab, group, qKey, ref, extra = {}) => ({ id, tab, group, type: 'number', ...fromQuestion(qKey, [ref]), ...extra });

/** A one-row table showing a signed change, coloured by whether the move is good. */
const change = (id, tab, group, qKey, ref, colours, fmt, suffixRef) => {
  const f = fromQuestion(qKey, [ref]);
  return {
    id, tab, group, type: 'table', ...f, headerHidden: true, background: '#00000000', fontSize: 13, limit: 1,
    ops: [{ name: 'setTableFixedRowHeightEnabled', payload: true }, { name: 'setTableFixedRowHeightValue', payload: 28 }, ...indicator(ref, colours, fmt), bold(ref)],
    suffix: suffixRef,
  };
};

const spark = (id, tab, group, qKey, ref, { kind = 'line', color = P.blue, inverted = false, coloring } = {}) => {
  const f = fromQuestion(qKey, [ref]);
  return { id, tab, group, type: kind, orientation: 'vertical', ...f, labels: labelsOf(f), limit: 20, colors: [color], legend: false, lineCurve: 'straight', sparkline: kind === 'line', hideMeasureAxis: true, hideDimensionAxis: kind !== 'line', inverted, barPadding: 15, minis: true, ...(coloring ? { coloring } : {}) };
};
const CLIMB_VALUES = ['Big climber (+10 or more)', 'Climbed'];
const FALL_VALUES = ['Big faller (−10 or more)', 'Slipped'];
const emphasis = (values, color) => ({ overwrites: [{ color, operator: 'inList', values }, { color: '#CBD3DC', operator: 'notInList', values }], rules: [] });

const bar = (id, tab, group, qKey, { us, colors = [P.blue], negative = P.red, format, limit = 40, labelsMinWidth } = {}) => {
  const f = fromQuestion(qKey);
  return {
    id, tab, group, type: 'bar', orientation: 'horizontal', ...f, labels: labelsOf(f), limit, colors, legend: false, hideMeasureAxis: true, labelsMinWidth,
    coloring: { overwrites: us ? [{ color: P.us, value: us }] : [], rules: negative ? [{ color: negative, measure: f.measures[0].ref, operator: 'less', value: 0 }, { color: colors[0], measure: f.measures[0].ref, operator: 'greater-equals', value: 0 }] : [] },
    dataLabels: { size: 11, format, backdrop: false },
  };
};

const table = (id, tab, group, qKey, { ops = [], fit, rowHeight = 30, fontSize = 13, limit = 60, keep, miniChart, longest, minWidths, narrowHide } = {}) => {
  const f = fromQuestion(qKey, keep);
  return {
    id, tab, group, type: 'table', ...f, limit, fontSize, columnLabels: { ...Object.fromEntries([...f.dimensions, ...f.measures].map((x) => [x.ref, SHORT[x.name] ?? DISPLAY[x.name] ?? x.name])), ...(miniChart ? { [miniChart.ref]: miniChart.label } : {}) }, fitColumns: fit, miniChart, rowHeight, longest, minWidths, narrowHide,
    ops: [{ name: 'setTableFixedRowHeightEnabled', payload: true }, { name: 'setTableFixedRowHeightValue', payload: rowHeight }, ...calcOps(f.measures), ...ops],
  };
};

const filter = (id, dimension, label) => ({ id, tab: null, group: GROUPS.main, type: 'filter', title: label, field: dimension, presentation: { mode: 'dropdown', quickSelect: false, responsive: false, searchable: true, showProgressBar: false } });

/** The whole catalogue for one chosen university. */
export const tileCatalogue = (us) => [
  // controls (main group, on every tab)
  filter('ctl-nation', 'Nation', 'Nation'),
  filter('ctl-group', 'University Group', 'Group'),
  filter('ctl-band', 'Rank Band', 'Rank band'),

  // ---- Where we stand
  number('kpi-us', 'stand', GROUPS.us, 'usRank', 'rank'),
  change('chg-us', 'stand', GROUPS.us, 'usRank', 'chg', UP_GOOD, PLACES),
  { ...spark('spark-us', 'stand', GROUPS.us, 'usHistory', 'rank', { color: P.us, inverted: true }), ops: [{ name: 'setAxisStartsAtZero', payload: { axisName: 'primaryMeasure', startsAtZero: false } }] },
  number('kpi-set', 'stand', GROUPS.stand, 'setRank', 'r27'),
  change('chg-set', 'stand', GROUPS.stand, 'setRank', 'gain', UP_GOOD, '+0.0" places";-0.0" places";"no change"'),
  { ...spark('spark-set', 'stand', GROUPS.stand, 'setHistory', 'avg', { inverted: true }), ops: [{ name: 'setAxisStartsAtZero', payload: { axisName: 'primaryMeasure', startsAtZero: false } }] },
  number('kpi-climb', 'stand', GROUPS.stand, 'climbers', 'now'),
  change('chg-climb', 'stand', GROUPS.stand, 'climbers', 'chg', UP_GOOD, '+0;-0;0'),
  spark('spark-climb', 'stand', GROUPS.stand, 'movement', 'n', { kind: 'bar', coloring: emphasis(CLIMB_VALUES, P.green) }),
  number('kpi-fall', 'stand', GROUPS.stand, 'fallers', 'now'),
  change('chg-fall', 'stand', GROUPS.stand, 'fallers', 'chg', DOWN_GOOD, '+0;-0;0'),
  spark('spark-fall', 'stand', GROUPS.stand, 'movement', 'n', { kind: 'bar', coloring: emphasis(FALL_VALUES, P.red) }),
  bar('bar-moved', 'stand', GROUPS.stand, 'moved', { us, colors: [P.green], format: '+0;-0;0' }),
  table('tbl-around', 'stand', GROUPS.stand, 'around', {
    rowHeight: 28, longest: 42, // "University of the West of England, Bristol"
    minWidths: { r26: 60 }, // digits are wider than the header estimate allows
    narrowHide: ['experience', 'teaching'], // on 'What costs us places' in full
    miniChart: { ref: 'spark', name: 'Historic Rank', label: '2025–27', field: 'Edition Date', view: 'UNI_HISTORY_FACT', color: P.blue },
    fit: { rank: 0.05, uni: 0.25, r26: 0.065, chg: 0.085, total: 0.07, research: 0.07, entry: 0.07, prospects: 0.07, experience: 0.07, teaching: 0.07, spark: 0.11 },
    ops: [bold('uni'), ...indicator('chg', UP_GOOD, '+0;-0;0')],
  }),

  // ---- What costs us places
  table('tbl-rankmeasure', 'measures', GROUPS.measures, 'rankOnMeasure', {
    rowHeight: 28, longest: 30, // "Norwich University of the Arts"
    fit: { uni: 0.22, rank: 0.1, research: 0.095, entry: 0.095, prospects: 0.095, firsts: 0.095, continuation: 0.11, experience: 0.1, teaching: 0.09 },
    ops: [bold('uni'), ...colFormat('rank', '0'), ...RANK_COLS.flatMap((r) => rankBands(r))],
  }),
  bar('bar-gap-prospects', 'measures', GROUPS.measures, 'gapProspects', { us, colors: [P.green], format: '+0.0;-0.0;0', labelsMinWidth: 220 }),
  bar('bar-gap-experience', 'measures', GROUPS.measures, 'gapExperience', { us, colors: [P.green], format: '+0.0;-0.0;0', labelsMinWidth: 220 }),
  bar('bar-gap-research', 'measures', GROUPS.measures, 'gapResearch', { us, colors: [P.green], format: '+0.0;-0.0;0', labelsMinWidth: 220 }),
  bar('bar-gap-entry', 'measures', GROUPS.measures, 'gapEntry', { us, colors: [P.green], format: '+0;-0;0', labelsMinWidth: 220 }),

  // ---- What it takes
  number('kpi-proj', 'climb', GROUPS.whatif, 'projected', 'proj', { param: { ref: 'proj', name: 'score', from: 'target' } }),
  number('kpi-overtake', 'climb', GROUPS.overtake, 'overtakeCount', 'n'),
  bar('bar-points', 'climb', GROUPS.climb, 'pointsGap', { us, colors: [P.red], negative: P.green, format: '+0;-0;0', param: true }),
  table('tbl-overtake', 'climb', GROUPS.overtake, 'overtake', {
    rowHeight: 27, longest: 30, fit: { rank: 0.1, uni: 0.42, total: 0.14, gap: 0.16, chg: 0.18 },
    ops: [bold('uni'), ...colFormat('total', '0'), ...indicator('chg', UP_GOOD, '+0;-0;0')],
  }),
  { ...(() => { const f = fromQuestion('setHistory'); return { ...f, labels: { ...labelsOf(f), avg: 'Average rank', ma: '2-edition avg' } }; })(),
    id: 'line-set', tab: 'climb', group: GROUPS.climb, type: 'line', limit: 10, colors: [P.blue, P.orange], legend: true, legendPosition: 'top', lineCurve: 'straight', inverted: true,
    ops: [{ name: 'setAxisStartsAtZero', payload: { axisName: 'primaryMeasure', startsAtZero: false } }] },

  // ---- Focus plan
  table('tbl-focus', 'focus', GROUPS.focus, 'rankOnMeasure', {
    rowHeight: 28, longest: 30, // "Norwich University of the Arts"
    fit: { uni: 0.22, rank: 0.1, research: 0.095, entry: 0.095, prospects: 0.095, firsts: 0.095, continuation: 0.11, experience: 0.1, teaching: 0.09 },
    ops: [bold('uni'), ...colFormat('rank', '0'), ...RANK_COLS.flatMap((r) => rankBands(r))],
  }),
  bar('bar-focus-points', 'focus', GROUPS.focus, 'pointsGap', { us, colors: [P.red], negative: P.green, format: '+0;-0;0', param: true }),
].map((tile) => ({ slot: tile.id, title: tile.question ?? tile.title, ...tile }));

// ------------------------------------------------------------------ compile
const resolve = (tile, fields) => {
  if (tile.type === 'filter') {
    const field = fields.dimension(tile.field);
    return field ? { field } : { error: `dimension "${tile.field}" is not in this semantic layer` };
  }
  const dimensions = tile.dimensions.map((d) => ({ ...d, field: fields.dimension(d.name) }));
  const measures = tile.measures.map((m) => ({ ...m, field: fields.measure(m.name) }));
  const missing = [...dimensions, ...measures].find((x) => !x.field);
  if (missing) return { error: `"${missing.name}" is not in this semantic layer` };
  let mini;
  if (tile.miniChart) {
    mini = { measure: fields.measure(tile.miniChart.name), dim: fields.raw(tile.miniChart.field, tile.miniChart.view) };
    if (!mini.measure || !mini.dim) return { error: `mini chart "${tile.miniChart.name}" by "${tile.miniChart.field}" is not in this semantic layer` };
  }
  return { dimensions, measures, mini };
};

const sortAndLimit = (tile) => ({
  ...(tile.sort?.length ? { sorting: tile.sort } : {}),
  ...(tile.limit ? { limiting: { queryLimit: tile.limit } } : {}),
});

export const definitionOf = (tile, r) => {
  if (tile.type === 'filter') return { version: 1, type: 'filter', data: { field: { fieldKey: r.field.fieldKey, ref: 'field' } }, presentation: tile.presentation };
  const dims = r.dimensions.map((d) => ({ fieldKey: d.field.fieldKey, ref: d.ref }));
  const meas = r.measures.map((m) => ({ fieldKey: m.field.fieldKey, ref: m.ref }));
  if (tile.type === 'number') return { version: 1, type: 'number', data: { measure: meas[0] } };
  if (tile.type === 'table') {
    const columns = [...dims.map((c) => ({ ...c, role: 'dimension' })), ...meas.map((c) => ({ ...c, role: 'measure' }))];
    if (r.mini) columns.push({ fieldKey: r.mini.measure.fieldKey, ref: tile.miniChart.ref, role: 'measure' });
    return { version: 1, type: 'table', data: { columns }, ...sortAndLimit(tile) };
  }
  const presentation = {
    axes: {
      dimension: { labelsVisible: true, titleVisible: false },
      primaryMeasure: { labelsVisible: !tile.hideMeasureAxis, titleVisible: false, ...(tile.inverted ? { inverted: true } : {}) },
    },
    legend: { visible: Boolean(tile.legend), ...(tile.legend && tile.legendPosition ? { position: tile.legendPosition } : {}) },
    ...(tile.type === 'bar' ? { orientation: tile.orientation ?? 'vertical' } : {}),
    ...(tile.coloring && (tile.coloring.overwrites.length || tile.coloring.rules.length) ? { coloring: Object.fromEntries(Object.entries(tile.coloring).filter(([, v]) => v.length)) } : {}),
  };
  const measures = tile.type === 'line' ? meas.map((m) => ({ ...m, dataPointShape: 'circle' })) : meas;
  return { version: 1, type: tile.type, data: { dimensions: dims, measures }, ...sortAndLimit(tile), presentation };
};

export const buildTiles = async (fields, us) => {
  const tiles = [];
  const failures = [];
  // Compile every tile at once (order kept): compiling one after another dominated boot.
  const results = await Promise.all(tileCatalogue(us).map(async (tile) => {
    const tiles = []; const failures = [];
    const r = resolve(tile, fields);
    if (r.error) { failures.push({ id: tile.id, title: tile.title, reason: r.error }); return { tiles, failures }; }
    const definition = definitionOf(tile, r);
    try {
      const out = await compileVisualizationDefinition({ definition, availableFields: fields.available, baseVSpec: createDefaultVSpec(tile.type) });
      if (!out.success) throw new Error(out.issues.map((i) => `${i.code} @${(i.path ?? []).join('.')}: ${i.message}`).join('; '));
      const miniOps = r.mini ? [
        { name: 'setColumnRepresentation', ref: tile.miniChart.ref, payload: { representation: 'line-chart' } },
        { name: 'setColumnMiniChartDimension', ref: tile.miniChart.ref, payload: { key: r.mini.dim.fieldKey } },
        { name: 'setColumnMiniChartLineColor', ref: tile.miniChart.ref, payload: { lineColor: tile.miniChart.color } },
        { name: 'setColumnMiniChartLineStrokeWidth', ref: tile.miniChart.ref, payload: { strokeWidth: 2 } },
        { name: 'setColumnMiniChartShowDataPoints', ref: tile.miniChart.ref, payload: { showDataPoints: true } },
      ] : [];
      tiles.push({ ...tile, definition, vSpec: out.vSpec, resolvedRefs: out.resolvedRefs ?? {}, warnings: out.warnings ?? [], ops: [...(tile.ops ?? []), ...(tile.type === 'table' ? [] : calcOps(tile.measures ?? [])), ...miniOps], fieldKeys: (r.dimensions ?? []).map((d) => d.field.fieldKey) });
    } catch (error) {
      failures.push({ id: tile.id, title: tile.title, reason: String(error?.message ?? error) });
    }
    return { tiles, failures };
  }));
  for (const r of results) { tiles.push(...r.tiles); failures.push(...r.failures); }
  return { tiles, failures };
};
