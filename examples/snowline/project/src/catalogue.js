/**
 * Every native object in Snowline, declared once as data.
 *
 * A tile = one stored business question (questions.js) + presentation. Nothing here computes a
 * figure: values, changes, ranks, shares, moving averages and the budget split all come from
 * layer measures and the questions' advanced calculations.
 *
 * Selection groups:
 *   main      the filters, the selection bar and chart clicks live here
 *   review / best / snow / market / plan   one per tab, mirrored from main only while the tab shows
 */
import { createDefaultVSpec } from '@astrato-io/visualizations';
import { compileVisualizationDefinition } from '@astrato-io/visualizations/definitions';
import { QUESTIONS } from './questions.js';
import { PALETTE as P } from './theme.js';

export const GROUPS = { main: 'main', review: 'review', best: 'best', snow: 'snow', market: 'market', plan: 'plan' };
export const TAB_GROUPS = { review: GROUPS.review, best: GROUPS.best, snow: GROUPS.snow, market: GROUPS.market, plan: GROUPS.plan };

/** Reader-facing names for governed items (legends, headers, chips, Excel). */
export const DISPLAY = {
  Resort: 'Resort', 'Season Week': 'Week of season', Week: 'Week of', 'Season Stage': 'Stage', 'Week Type': 'Week type', 'Snowfall Band': 'Fresh snow',
  'Crowd Level': 'Crowd level', 'Gateway Airport': 'Airport',
  'Total Snowfall': 'Fresh snow', 'Avg Weekly Snowfall': 'Snow per week', 'Avg Crowd Index': 'Crowd index', 'Avg Base Depth': 'Base depth',
  'Overall Week Score': 'Week score', 'Quiet Powder Weeks': 'Quiet powder weeks', 'Resort Weeks': 'Resort-weeks',
  'Overall Week Score This Season': 'Week score', 'Crowd Index This Season': 'Crowd', 'Crowd Index Change vs Last Season': 'Crowd vs LS',
  'Snowfall Change vs Last Season': 'Snow vs LS', 'Quiet Powder Weeks This Season': 'Quiet powder', 'Demand Headroom This Season': 'Headroom',
  'Demand Headroom': 'Headroom', 'Share of Quiet Powder Weeks': 'Share', 'Avg Trip Cost': 'Trip cost',
  'Avg Snow Score': 'Snow', 'Avg Value Score': 'Value', 'Avg Quiet Score': 'Quiet', 'Avg Family Score': 'Family', 'Avg Expert Score': 'Expert',
  'Suggested Budget': 'Suggested budget', 'Target Weeks': 'Target weeks', 'Suggested Budget at Default Rule': 'Default plan',
  'Target Weeks This Season': 'Target weeks', 'Target Weeks Change vs Last Season': 'Target weeks vs LS',
};

const indicator = (ref, [below, above]) => [
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
/** A 0-100 score coloured by band: under 50 red, 50-75 plain, over 75 green. */
const scoreBands = (ref) => [
  { name: 'setColumnRepresentation', ref, payload: { representation: 'indicator' } },
  ...[0, 1, 2].map(() => ({ name: 'addColumnIndicatorSegment', ref, payload: {} })),
  { name: 'setColumnIndicatorSegmentValue', ref, payload: { segmentIndex: 0, value: 50 } },
  { name: 'setColumnIndicatorSegmentValue', ref, payload: { segmentIndex: 1, value: 75 } },
  { name: 'setColumnIndicatorSegmentValue', ref, payload: { segmentIndex: 2, value: 1e9 } },
  { name: 'setColumnIndicatorSegmentColor', ref, payload: { segmentIndex: 0, color: P.red } },
  { name: 'setColumnIndicatorSegmentColor', ref, payload: { segmentIndex: 1, color: '#14212B' } },
  { name: 'setColumnIndicatorSegmentColor', ref, payload: { segmentIndex: 2, color: P.green } },
  { name: 'setColumnIndicatorShowText', ref, payload: { showText: true } },
  { name: 'setColumnIndicatorColorText', ref, payload: { colorText: true } },
];
/** A Crowd Index coloured by how busy: under 55 (quiet) green, 55-70 plain, over 70 amber. */
const crowdBands = (ref) => [
  { name: 'setColumnRepresentation', ref, payload: { representation: 'indicator' } },
  ...[0, 1, 2].map(() => ({ name: 'addColumnIndicatorSegment', ref, payload: {} })),
  { name: 'setColumnIndicatorSegmentValue', ref, payload: { segmentIndex: 0, value: 55 } },
  { name: 'setColumnIndicatorSegmentValue', ref, payload: { segmentIndex: 1, value: 70 } },
  { name: 'setColumnIndicatorSegmentValue', ref, payload: { segmentIndex: 2, value: 1e9 } },
  { name: 'setColumnIndicatorSegmentColor', ref, payload: { segmentIndex: 0, color: P.green } },
  { name: 'setColumnIndicatorSegmentColor', ref, payload: { segmentIndex: 1, color: '#14212B' } },
  { name: 'setColumnIndicatorSegmentColor', ref, payload: { segmentIndex: 2, color: P.crowd } },
  { name: 'setColumnIndicatorShowText', ref, payload: { showText: true } },
  { name: 'setColumnIndicatorColorText', ref, payload: { colorText: true } },
];
const bold = (ref) => ({ name: 'setColumnFontStyle', ref, payload: { fontStyle: { weight: 700 } } });
const UP_GOOD = [P.red, P.green];
const DOWN_GOOD = [P.green, P.red];

/** One stored question as tile fields. `keep` picks and orders measure keys. */
const fromQuestion = (key, keep) => {
  const q = QUESTIONS[key];
  if (!q) throw new Error(`no stored question "${key}"`);
  const ms = keep ? keep.map((k) => q.m.find(([mk]) => mk === k)).filter(Boolean) : q.m;
  const refs = new Set([...q.d.map(([k]) => k), ...ms.map(([k]) => k)]);
  return {
    question: q.title,
    qKey: key,
    dimensions: q.d.map(([ref, name]) => ({ ref, name })),
    measures: ms.map(([ref, name, calc]) => ({ ref, name, calc })),
    sort: q.o.filter(([k]) => refs.has(k)).map(([by, direction]) => ({ by, direction })),
    season: q.season,
    topN: q.topN,
  };
};

/** Operations that carry a question's advanced calculation onto a table/chart measure. */
export const calcOps = (measures) => measures.filter((m) => m.calc).flatMap((m) => {
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

const labelsOf = (f, extra = {}) => ({ ...Object.fromEntries([...f.dimensions, ...f.measures].map((x) => [x.ref, DISPLAY[x.name] ?? x.name])), ...extra });

// ------------------------------------------------------------------ tile builders
const number = (id, tab, group, qKey, ref, extra = {}) => ({ id, tab, group, type: 'number', ...fromQuestion(qKey, [ref]), ...extra });

/** A one-row table showing a signed change in the layer's own format, coloured by whether the move is good. */
/** A signed change: red / grey / green with a neutral band of ±flat (what the format rounds to zero). */
const signed = (ref, [below, above], flat) => [
  { name: 'setColumnRepresentation', ref, payload: { representation: 'indicator' } },
  ...[0, 1, 2].map(() => ({ name: 'addColumnIndicatorSegment', ref, payload: {} })),
  { name: 'setColumnIndicatorSegmentValue', ref, payload: { segmentIndex: 0, value: -flat } },
  { name: 'setColumnIndicatorSegmentValue', ref, payload: { segmentIndex: 1, value: flat } },
  { name: 'setColumnIndicatorSegmentValue', ref, payload: { segmentIndex: 2, value: 1e9 } },
  { name: 'setColumnIndicatorSegmentColor', ref, payload: { segmentIndex: 0, color: below } },
  { name: 'setColumnIndicatorSegmentColor', ref, payload: { segmentIndex: 1, color: P.grey } },
  { name: 'setColumnIndicatorSegmentColor', ref, payload: { segmentIndex: 2, color: above } },
  { name: 'setColumnIndicatorShowText', ref, payload: { showText: true } },
  { name: 'setColumnIndicatorColorText', ref, payload: { colorText: true } },
];

/** A one-row table showing a signed change in the layer's own format, coloured by whether the move is good. */
const change = (id, tab, group, qKey, ref, colours, flat = 0.05) => ({
  id, tab, group, type: 'table', ...fromQuestion(qKey, [ref]), headerHidden: true, background: '#00000000', fontSize: 13, limit: 1,
  ops: [{ name: 'setTableFixedRowHeightEnabled', payload: true }, { name: 'setTableFixedRowHeightValue', payload: 26 }, ...signed(ref, colours, flat), bold(ref)],
});

const spark = (id, tab, group, qKey, ref, { kind = 'line', color = P.snow, coloring, axis = false } = {}) => {
  const f = fromQuestion(qKey, [ref]);
  return { id, tab, group, type: kind, orientation: 'vertical', ...f, labels: labelsOf(f), limit: 40, colors: [color], legend: false, lineCurve: 'straight', sparkline: kind === 'line', hideMeasureAxis: true, hideDimensionAxis: kind !== 'line' && !axis, barPadding: 18, minis: true, ...(coloring ? { coloring } : {}) };
};

const bar = (id, tab, group, qKey, { colors = [P.snow], keep, limit = 40, legend = false, grouped = false, format, labelsMinWidth, orientation = 'horizontal', hideMeasureAxis = true, rules, labels = {}, valueLabels = true, params = false } = {}) => {
  const f = fromQuestion(qKey, keep);
  return {
    id, tab, group, type: 'bar', orientation, ...f, labels: labelsOf(f, labels), limit, params, colors, legend, legendPosition: 'top', grouped, hideMeasureAxis, labelsMinWidth,
    ...(rules ? { coloring: { overwrites: [], rules } } : {}),
    dataLabels: valueLabels ? { size: 11, format, backdrop: '#FFFFFF' } : null,
  };
};

/** A combo: `series` maps each measure ref to [seriesType, colour, secondaryAxis?]. */
const combo = (id, tab, group, qKey, series, extra = {}) => {
  const f = fromQuestion(qKey);
  return { id, tab, group, type: 'combo', ...f, labels: labelsOf(f), limit: 40, series, legend: true, legendPosition: 'top', ...extra };
};

const heat = (id, tab, group, qKey, { order, gradient = ['#F2F7FB', P.snow], limit = 400 } = {}) => {
  const f = fromQuestion(qKey);
  const dimensions = order ? order.map((r) => f.dimensions.find((d) => d.ref === r)) : f.dimensions;
  return { id, tab, group, type: 'heatMap', ...f, dimensions, labels: labelsOf(f), limit, gradient, legend: false, dataLabels: { size: 10 } };
};

const table = (id, tab, group, qKey, { ops = [], fit, rowHeight = 30, fontSize = 13, limit = 60, keep, miniChart, longest = 18, columnFormats, flex = 'resort', headers = {}, minChars = {} } = {}) => {
  const f = fromQuestion(qKey, keep);
  return {
    id, tab, group, type: 'table', ...f, limit, fontSize, flex,
    columnLabels: { ...Object.fromEntries([...f.dimensions, ...f.measures].map((x) => [x.ref, DISPLAY[x.name] ?? x.name])), ...(miniChart ? { [miniChart.ref]: miniChart.label } : {}), ...headers },
    fitColumns: fit, miniChart, rowHeight, longest, columnFormats, minChars,
    ops: [{ name: 'setTableFixedRowHeightEnabled', payload: true }, { name: 'setTableFixedRowHeightValue', payload: rowHeight }, ...calcOps(f.measures), ...ops],
  };
};

const filter = (id, dimension, label) => ({ id, tab: null, group: GROUPS.main, type: 'filter', title: label, field: dimension, presentation: { mode: 'dropdown', quickSelect: false, responsive: false, searchable: true, showProgressBar: false } });

const CROWD_SPARK = { ref: 'spark', name: 'Avg Crowd Index', label: 'Crowd by week', field: 'Season Week', view: 'Season Weeks', color: P.crowd };

/** The whole catalogue. */
export const tileCatalogue = () => [
  // controls (main group, on every tab)
  filter('ctl-resort', 'Resort', 'Resort'),
  filter('ctl-country', 'Country', 'Country'),
  filter('ctl-stage', 'Season Stage', 'Stage'),
  filter('ctl-type', 'Week Type', 'Week type'),

  // ---- Season review
  number('kpi-snow', 'review', GROUPS.review, 'snowKpi', 'now'),
  change('chg-snow', 'review', GROUPS.review, 'snowKpi', 'chg', UP_GOOD, 0.0005),
  spark('spark-snow', 'review', GROUPS.review, 'snowWeeks', 'snow', { kind: 'bar', color: P.snow }),
  number('kpi-crowd', 'review', GROUPS.review, 'crowdKpi', 'now'),
  change('chg-crowd', 'review', GROUPS.review, 'crowdKpi', 'chg', UP_GOOD),
  spark('spark-crowd', 'review', GROUPS.review, 'crowdWeeks', 'crowd', { color: P.crowd }),
  number('kpi-base', 'review', GROUPS.review, 'baseKpi', 'now'),
  change('chg-base', 'review', GROUPS.review, 'baseKpi', 'chg', UP_GOOD),
  spark('spark-base', 'review', GROUPS.review, 'baseWeeks', 'base', { color: P.snow }),
  number('kpi-qpw', 'review', GROUPS.review, 'qpwKpi', 'now'),
  change('chg-qpw', 'review', GROUPS.review, 'qpwKpi', 'chg', DOWN_GOOD, 0.5),
  spark('spark-qpw', 'review', GROUPS.review, 'qpwStage', 'qpw', { kind: 'bar', color: P.crowd }),
  number('kpi-score', 'review', GROUPS.review, 'scoreKpi', 'now'),
  change('chg-score', 'review', GROUPS.review, 'scoreKpi', 'chg', UP_GOOD),
  spark('spark-score', 'review', GROUPS.review, 'scoreWeeks', 'score', { color: P.slate }),
  combo('combo-hero', 'review', GROUPS.review, 'hero', { snow: ['bar', P.snowLight, false], crowd: ['line', P.crowd, true] }, { limit: 20 }),
  table('tbl-resorts', 'review', GROUPS.review, 'resorts', {
    rowHeight: 30, miniChart: { ...CROWD_SPARK, label: 'By week' },
    headers: { score: 'Score', crowd: 'Crowd', crowdChg: '± crowd', snowChg: '± snow', qpw: 'Quiet pw', head: 'Gap' },
    minChars: { head: 4 },
    fit: { resort: 0.17, score: 0.09, crowd: 0.1, crowdChg: 0.11, snowChg: 0.11, qpw: 0.1, head: 0.11, spark: 0.13 },
    ops: [bold('resort'), ...signed('crowdChg', UP_GOOD, 0.05), ...signed('snowChg', UP_GOOD, 0.0005)],
  }),

  // ---- Best resorts & weeks
  table('tbl-best', 'best', GROUPS.best, 'bestResorts', {
    rowHeight: 31, keep: ['rank', 'score'], miniChart: { ...CROWD_SPARK, name: 'Overall Week Score', label: 'Score by week', color: P.snow },
    headers: { rank: 'Rank' },
    fit: { resort: 0.36, rank: 0.12, score: 0.2, spark: 0.3 },
    ops: [bold('resort'), { name: 'setColumnFormatType', ref: 'rank', payload: { formatType: 'custom' } }, { name: 'setColumnFormatString', ref: 'rank', payload: { formatString: '0' } }, ...scoreBands('score')],
  }),
  heat('heat-weeks', 'best', GROUPS.best, 'bestWeeks', { order: ['wk', 'resort'], limit: 200 }),
  // Each row is one resort-week, so a per-row trend would be a single dot: the week's score and
  // crowd carry indicator bands instead (rubric C4: change/indicator columns where no trend exists).
  table('tbl-top10', 'best', GROUPS.best, 'topTen', {
    rowHeight: 27, limit: 10, // the question's top 10: tables take no topN in 0.9, so sort by score and limit to 10
    headers: { week: 'Week of', score: 'Score', snow: 'Snow', crowd: 'Crowd', cost: 'Cost' },
    minChars: { week: 11, snow: 7, cost: 6 }, longest: 14,
    fit: { resort: 0.2, week: 0.22, score: 0.17, snow: 0.14, crowd: 0.13, cost: 0.12 },
    ops: [bold('resort'), ...scoreBands('score'), ...crowdBands('crowd')],
  }),
  table('tbl-profile', 'best', GROUPS.best, 'profile', {
    rowHeight: 27, miniChart: { ...CROWD_SPARK, name: 'Overall Week Score', label: 'By week', color: P.snow },
    headers: { snow: 'Snow', value: 'Value', quiet: 'Quiet', family: 'Family', expert: 'Expert', cost: 'Trip cost' },
    fit: { resort: 0.2, snow: 0.09, value: 0.09, quiet: 0.09, family: 0.09, expert: 0.09, cost: 0.12, spark: 0.2 },
    ops: [bold('resort'), ...['snow', 'value', 'quiet', 'family', 'expert'].flatMap(scoreBands)],
  }),

  // ---- Snow & crowds
  bar('bar-bands', 'snow', GROUPS.snow, 'bands', { colors: [P.crowd, P.snow], legend: true, grouped: true, orientation: 'vertical', format: '0' }),
  number('kpi-uplift', 'snow', GROUPS.snow, 'uplift', 'now'),
  change('chg-uplift', 'snow', GROUPS.snow, 'uplift', 'chg', DOWN_GOOD),
  spark('spark-types', 'snow', GROUPS.snow, 'weekTypes', 'crowd', { kind: 'bar', color: P.crowd, axis: true }),
  combo('combo-stages', 'snow', GROUPS.snow, 'stages', { base: ['bar', P.snowLight, false], crowd: ['line', P.crowd, true] }),
  combo('combo-smoothed', 'snow', GROUPS.snow, 'smoothed', { snow: ['line', P.snow, false], crowd: ['line', P.crowd, true] }, { limit: 20 }),
  heat('heat-levels', 'snow', GROUPS.snow, 'levels', { order: ['band', 'level'], gradient: ['#FBF3EA', P.crowd], limit: 40 }),

  // ---- Where to market
  bar('bar-headroom', 'market', GROUPS.market, 'headroom', { colors: [P.snow], format: '0.0' }),
  table('tbl-qpw', 'market', GROUPS.market, 'qpwResorts', {
    rowHeight: 30, miniChart: CROWD_SPARK,
    headers: { qpw: 'Quiet powder wks', head: 'Headroom' },
    minChars: { airport: 9 },
    fit: { resort: 0.2, airport: 0.13, qpw: 0.16, share: 0.1, head: 0.11, cost: 0.11, spark: 0.16 },
    ops: [bold('resort')],
  }),
  bar('bar-airports', 'market', GROUPS.market, 'airports', { colors: [P.crowd], format: '0' }),

  // ---- Plan next season (what-if + plan)
  // Target weeks: this season under the levers' rule, its change vs 2024/25 under the same rule,
  // and where in the season the rule finds them (all follow the levers through measure parameters).
  number('kpi-targets', 'plan', GROUPS.plan, 'targetsKpi', 'now', { params: true }),
  { ...change('chg-targets', 'plan', GROUPS.plan, 'targetsKpi', 'chg', DOWN_GOOD, 0.5), params: true },
  { ...spark('spark-targets', 'plan', GROUPS.plan, 'targetsStage', 'n', { kind: 'bar', color: P.snow }), params: true },
  // Scenario (the levers) beside the baseline (the default plan, a fixed governed measure).
  bar('bar-split', 'plan', GROUPS.plan, 'splitBase', { colors: [P.grey, P.snow], grouped: true, legend: true, format: '€#,##0', params: true, valueLabels: false, hideMeasureAxis: false, labels: { base: 'Default plan', budget: 'Scenario' } }),
  bar('bar-split-stage', 'plan', GROUPS.plan, 'splitStageBase', { colors: [P.grey, P.crowd], grouped: true, legend: true, format: '€#,##0', orientation: 'vertical', params: true, labels: { base: 'Default plan', budget: 'Scenario' } }),
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
  let season;
  if (tile.season) {
    season = fields.raw('Season', 'Season Weeks');
    if (!season) return { error: 'the Season field is not in this semantic layer' };
  }
  return { dimensions, measures, mini, season };
};

const sortAndLimit = (tile) => ({
  ...(tile.sort?.length ? { sorting: tile.sort } : {}),
  ...(tile.limit ? { limiting: { ...(tile.limit ? { queryLimit: tile.limit } : {}),  } } : {}),
});
/** The question's static filter (Season = 2025/26), on the raw string field. */
const filterGroupOf = (tile, r) => (r.season ? { filterGroup: { filters: [{ fieldKey: r.season.fieldKey, operator: 'inList', values: [tile.season] }], operator: 'and' } } : {});

export const definitionOf = (tile, r) => {
  if (tile.type === 'filter') return { version: 1, type: 'filter', data: { field: { fieldKey: r.field.fieldKey, ref: 'field' } }, presentation: tile.presentation };
  const dims = r.dimensions.map((d) => ({ fieldKey: d.field.fieldKey, ref: d.ref }));
  const meas = r.measures.map((m) => ({ fieldKey: m.field.fieldKey, ref: m.ref }));
  if (tile.type === 'number') return { version: 1, type: 'number', data: { measure: meas[0] }, ...filterGroupOf(tile, r) };
  if (tile.type === 'table') {
    const columns = [...dims.map((c) => ({ ...c, role: 'dimension' })), ...meas.map((c) => ({ ...c, role: 'measure' }))];
    if (r.mini) columns.push({ fieldKey: r.mini.measure.fieldKey, ref: tile.miniChart.ref, role: 'measure' });
    return { version: 1, type: 'table', data: { columns }, ...sortAndLimit(tile), ...filterGroupOf(tile, r) };
  }
  if (tile.type === 'heatMap') {
    return { version: 1, type: 'heatMap', data: { dimensions: dims, measures: meas }, ...sortAndLimit(tile), ...filterGroupOf(tile, r), presentation: { legend: { visible: false } } };
  }
  const presentation = {
    axes: {
      dimension: { labelsVisible: true, titleVisible: false },
      primaryMeasure: { labelsVisible: !tile.hideMeasureAxis, titleVisible: tile.type === 'combo', ...(tile.type === 'combo' ? { title: tile.labels?.[tile.measures.find((m) => !tile.series?.[m.ref]?.[2])?.ref] } : {}) },
      ...(tile.type === 'combo' ? { secondaryMeasure: { labelsVisible: true, titleVisible: true, title: tile.labels?.[tile.measures.find((m) => tile.series?.[m.ref]?.[2])?.ref] } } : {}),
    },
    legend: { visible: Boolean(tile.legend), ...(tile.legend && tile.legendPosition ? { position: tile.legendPosition } : {}) },
    ...(tile.type === 'bar' ? { orientation: tile.orientation ?? 'vertical' } : {}),
    ...(tile.coloring && (tile.coloring.overwrites?.length || tile.coloring.rules?.length) ? { coloring: Object.fromEntries(Object.entries(tile.coloring).filter(([, v]) => v.length)) } : {}),
  };
  let measures = meas;
  if (tile.type === 'line') measures = meas.map((m) => ({ ...m, dataPointShape: 'circle' }));
  if (tile.type === 'combo') measures = meas.map((m) => {
    const [seriesType, , secondary] = tile.series?.[m.ref] ?? ['line'];
    return { ...m, seriesType, axis: secondary ? 'secondary' : 'primary' };
  });
  return { version: 1, type: tile.type, data: { dimensions: dims, measures }, ...sortAndLimit(tile), ...filterGroupOf(tile, r), presentation };
};

export const buildTiles = async (fields) => {
  const results = await Promise.all(tileCatalogue().map(async (tile) => {
    const r = resolve(tile, fields);
    if (r.error) return { failure: { id: tile.id, title: tile.title, reason: r.error } };
    const definition = definitionOf(tile, r);
    try {
      const out = await compileVisualizationDefinition({ definition, availableFields: fields.available, baseVSpec: createDefaultVSpec(tile.type) });
      if (!out.success) throw new Error(out.issues.map((i) => `${i.code} @${(i.path ?? []).join('.')}: ${i.message}`).join('; '));
      const miniOps = r.mini ? [
        { name: 'setColumnRepresentation', ref: tile.miniChart.ref, payload: { representation: 'line-chart' } },
        { name: 'setColumnMiniChartDimension', ref: tile.miniChart.ref, payload: { key: r.mini.dim.fieldKey } },
        { name: 'setColumnMiniChartLineColor', ref: tile.miniChart.ref, payload: { lineColor: tile.miniChart.color } },
        { name: 'setColumnMiniChartLineStrokeWidth', ref: tile.miniChart.ref, payload: { strokeWidth: 2 } },
        { name: 'setColumnMiniChartShowDataPoints', ref: tile.miniChart.ref, payload: { showDataPoints: false } },
      ] : [];
      const seriesOps = tile.type === 'combo' ? Object.entries(tile.series ?? {}).map(([ref, [, color]]) => ({ name: 'setMeasureGraphColor', ref, payload: { graphColor: color } })) : [];
      return { tile: { ...tile, definition, vSpec: out.vSpec, resolvedRefs: out.resolvedRefs ?? {}, warnings: out.warnings ?? [], ops: [...(tile.ops ?? []), ...(tile.type === 'table' ? [] : calcOps(tile.measures ?? [])), ...miniOps, ...seriesOps] } };
    } catch (error) {
      return { failure: { id: tile.id, title: tile.title, reason: String(error?.message ?? error) } };
    }
  }));
  return { tiles: results.filter((r) => r.tile).map((r) => r.tile), failures: results.filter((r) => r.failure).map((r) => r.failure) };
};
