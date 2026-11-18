/**
 * The tile catalogue of People Intelligence: every native Astrato object, declared once against
 * the governed semantic layer. Pure data, no Astrato imports, so tools/chart-questions.mjs can read it in Node.
 *
 * Tiles may carry:
 *  - `switch`: alternative measure sets / dimensions the reader can flip between in place (no remount);
 *  - `drill`: a dimension hierarchy — clicking a bar narrows the page and steps one level down;
 *  - `scope`: which persona scope filters apply ('all' default; 'bu' only business unit; 'none').
 */
export const WF = 'Workforce';

/** Palette: accent blue, dark red, charcoal, greys, and the secondary accents used sparingly. */
export const C = { red: '#2B5CE6', dark: '#1B3FA8', ink: '#25282B', grey: '#4B5563', mid: '#7E7E7E', light: '#BEBEBE', mist: '#F2F2F2', aqua: '#1C9AAE', teal: '#13707F', yellow: '#E8B923', green: '#8FA31E', plum: '#7A4FB0', aub: '#5A3A6E', good: '#2E8540', bad: '#D92D20', amber: '#D9822B' };
export const SERIES = [C.red, C.ink, C.aqua, C.mid, C.teal, C.yellow, C.plum, C.green, C.light, C.aub];

export const PLAIN = { formatType: 'none' };
const NUM = { formatType: 'numberNoDecimal' };

export const colFormat = (ref, formatString) => [
  { name: 'setColumnFormatType', ref, payload: { formatType: 'custom' } },
  { name: 'setColumnFormatString', ref, payload: { formatString } },
];
export const measFormat = (ref, formatString) => [
  { name: 'setMeasureFormatType', ref, payload: { formatType: 'custom' } },
  { name: 'setMeasureFormatString', ref, payload: { formatString } },
];
const right = (...refs) => refs.map((ref) => ({ name: 'setColumnHorizontalAlign', ref, payload: { horizontalAlign: 'right' } }));
const bold = (ref, color) => ({ name: 'setColumnFontStyle', ref, payload: { fontStyle: { weight: 700, ...(color ? { color } : {}) } } });
const rowHeight = (h) => [{ name: 'setTableFixedRowHeightEnabled', payload: true }, { name: 'setTableFixedRowHeightValue', payload: h }];
/** Traffic-light text by thresholds (cuts are lower bounds; converted to the upper bounds segments take). */
const bands = (ref, cuts, colors) => [
  { name: 'setColumnRepresentation', ref, payload: { representation: 'indicator' } },
  ...cuts.flatMap((_, segmentIndex) => [
    { name: 'addColumnIndicatorSegment', ref, payload: {} },
    { name: 'setColumnIndicatorSegmentValue', ref, payload: { segmentIndex, value: cuts[segmentIndex + 1] ?? 1e15 } },
    { name: 'setColumnIndicatorSegmentColor', ref, payload: { segmentIndex, color: colors[segmentIndex] } },
  ]),
  { name: 'setColumnIndicatorColorText', ref, payload: { colorText: true } },
];
const progress = (ref, color, bg = '#F2F2F2') => [
  { name: 'setColumnRepresentation', ref, payload: { representation: 'progress' } },
  { name: 'setColumnMiniChartProgressBarColor', ref, payload: { progressBarColor: color } },
  { name: 'setColumnMiniChartProgressBackgroundColor', ref, payload: { backgroundColor: bg } },
  { name: 'setColumnMiniChartProgressShowCurrentValue', ref, payload: { showCurrentValue: true } },
  { name: 'setColumnMiniChartProgressValuePlacement', ref, payload: { valuePlacement: 'inside' } },
  { name: 'setColumnProgressDynamicScaleEnabled', ref, payload: { dynamicScaleEnabled: true } },
  { name: 'setColumnFontStyle', ref, payload: { fontStyle: { color: '#FFFFFF', weight: 700 } } },
];
export const perMeasure = (map) => [
  { name: 'setColoringType', payload: 'perEachMeasure' },
  ...Object.entries(map).map(([ref, graphColor]) => ({ name: 'setMeasureGraphColor', ref, payload: { graphColor } })),
];
export const secondary = (ref) => ({ name: 'changeMeasureAxis', ref, payload: { secondaryAxis: true } });

/** Dimensions are view columns: `[name, ref, view]`. */
export const dims = (...cols) => cols.map(([name, ref, view = WF]) => ({ view, name, ref }));
/** Measures: a governed measure by name (optionally `[name, ref]`). */
export const meas = (...list) => list.map((m, i) => (typeof m === 'string' ? { name: m, ref: `m${i}`, format: NUM } : { name: m[0], ref: m[1] ?? `m${i}`, format: NUM }));

export const CV = 'Countries', BV = 'Business Units', DV = 'Departments', MV = 'Months', SV = 'Seniority', SKV = 'Skills', CO = 'Costs', EN = 'Engagement', EX = 'Exits', RQ = 'Requisitions', SI = 'Skill Inventory', RP = 'Reskilling Pool', IN = 'Initiatives';
export const DEI = 'Diversity', SUC = 'Succession', PRN = 'Pipeline Runs', DQI = 'Data Issues';
export const GBPM = '£#,##0.0,,"m"', GBPK = '£#,##0,"k"', GBP = '£#,##0', INT = '#,##0', PCT = '0.0%', PCT0 = '0%', SPCT = '+0.0%;-0.0%;0.0%', SPTS = '+0.0" pts";-0.0" pts";0.0" pts"', SINT = '+#,##0;-#,##0;0', SGBPM = '+£#,##0.0,,"m";-£#,##0.0,,"m";£0.0"m"', IDX = '0.0', SIDX = '+0.0;-0.0;0.0', RATIO = '0.00', YRS = '0.0" yrs"', ABS = '0.00%';

const bar = (id, title, [dimName, view = WF], measures, { group, page, sort = { by: 'm0', direction: 'desc' }, limit = 40, colors, gradient, measureColors, format = INT, orientation = 'horizontal', legend = false, stacked = false, grouped = false, labels = true, filters, barPadding = 25, hideMeasureAxis, coloring, extraOps = [], dims2, dims2View, ...rest } = {}) => ({
  id, slot: id, page, title, type: 'bar', group, orientation, filters,
  dimensions: dims([dimName, 'd0', view], ...(dims2 ? [[dims2, 'd1', dims2View ?? view]] : [])),
  measures: meas(...[].concat(measures)),
  sort, limit, gradient, coloring, colors: gradient ? undefined : colors ?? (measureColors ? undefined : [C.red]), legend, legendPosition: legend ? 'top' : undefined, stacked, grouped, barPadding,
  hideMeasureAxis: hideMeasureAxis ?? (labels && !stacked),
  ...(labels ? { dataLabels: { size: 11, format: [].concat(format)[0], backdrop: '#FFFFFF' } } : {}),
  ops: [...(measureColors ? perMeasure(measureColors) : []), ...[].concat(measures).flatMap((_, i) => measFormat(`m${i}`, [].concat(format)[i] ?? [].concat(format)[0])), ...extraOps],
  ...rest,
});

const donut = (id, title, [dimName, view = WF], measure, { group, page, colors = SERIES, sort = { by: 'm0', direction: 'desc' }, filters, limit = 12, ...rest } = {}) => ({
  id, slot: id, page, title, type: 'pie', group, filters, donut: true, legend: true, sliceLabels: 'percentage', coloring: 'categorical',
  dimensions: dims([dimName, 'd0', view]), measures: meas(measure), sort, limit, colors, ...rest,
});

/** Any native chart type (combo, heatMap, scatter, sankey, line…) from the same dims/measures shape. */
const chart = (id, title, type, dimList, measList, { group, page, sort, limit = 400, format, extraOps = [], ...rest } = {}) => ({
  id, slot: id, page, title, type, group,
  dimensions: dims(...dimList.map(([n, v], i) => [n, `d${i}`, v])),
  measures: meas(...measList),
  ...(sort ? { sort } : {}), limit, ...rest,
  ops: [...(format ? [].concat(format).flatMap((f, i) => measFormat(`m${i}`, f)) : []), ...extraOps],
});

export const ctlId = (group, view, name) => `ctl-${group}-${view}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
const ctl = (group, view, name, title = name) => ({ id: ctlId(group, view, name), page: 'controls', title, type: 'filter', group, field: { view, name }, presentation: { mode: 'dropdown', quickSelect: false, responsive: false, searchable: true, showProgressBar: false } });

/**
 * A KPI card is three native objects: the number, a mini-chart of its trend and a one-row table with
 * the comparison period and the change (green when it moved the right way). `py` omitted gives
 * number + mini-chart only.
 */
export const KPIS = {};
const kpiCard = (id, page, group, label, { value, fmt, py, delta, deltaFmt = SPCT, deltaLabel = 'vs LY', pyLabel = 'LY', spark, sparkDim = ['Month', MV], sparkType = 'line', good = 'up', color = C.red, filters, note, drill }) => {
  KPIS[id] = { label, value, note, drill, good, fmt };
  const [lo, hi] = good === 'up' ? [C.bad, C.good] : good === 'down' ? [C.good, C.bad] : [C.mid, C.mid];
  const [sd, sv] = sparkDim;
  return [
    { id, slot: id, page, title: label, type: 'number', group, filters, measures: meas(value), ops: measFormat('m0', fmt) },
    sparkType === 'line'
      ? { id: `${id}-sp`, slot: `${id}-sp`, page, title: `${label} trend`, type: 'line', group: `${group}-t`, filters, sparkline: true, dimensions: dims([sd, 'd0', sv]), measures: meas(spark), sort: [{ by: 'd0', direction: 'asc' }], limit: 40, legend: false, colors: [color], lineCurve: 'curve' }
      : { id: `${id}-sp`, slot: `${id}-sp`, page, title: `${label} trend`, type: 'bar', group: `${group}-t`, filters, orientation: 'vertical', dimensions: dims([sd, 'd0', sv]), measures: meas(spark), sort: { by: sd === 'Month' ? 'd0' : 'm0', direction: sd === 'Month' ? 'asc' : 'desc' }, limit: 40, colors: [color], barPadding: 20, hideMeasureAxis: true, hideDimensionAxis: true, legend: false },
    ...(py ? [{
      id: `${id}-d`, slot: `${id}-d`, page, title: `${label} vs comparison`, type: 'table', group, filters, fontSize: 11, headerHidden: true, fitColumns: { p: 0.5, c: 0.5 },
      dimensions: [], measures: meas([py, 'p'], [delta, 'c']),
      columnLabels: { p: pyLabel, c: deltaLabel },
      ops: [...rowHeight(24), ...colFormat('p', `"${pyLabel} "${fmt}`), ...colFormat('c', deltaFmt.split(';').map((f) => `${f}" ${deltaLabel}"`).join(';')), ...right('c'), ...bands('c', [-1e12, 0], [lo, hi])],
    }] : []),
  ];
};
const sparkCol = (ref, color = C.red, view = MV) => ({ ref, view, field: 'Month', color });

/** Selection groups: one per page; `-t` twins hold the time-series objects so a month click never narrows the page. */
export const GROUPS = ['g-home', 'g-wx', 'g-tr', 'g-sk', 'g-act', 'g-dei', 'g-suc', 'g-ops'];
export const TREND_GROUPS = GROUPS.map((g) => `${g}-t`);

// ---- Switch option sets (label, measures, formats, extra)
const DIST_MEASURES = [
  ['Headcount (Sep 26)', ['Headcount'], [INT]], ['Headcount growth YoY', ['Headcount YoY'], [SPCT]], ['FTE (Sep 26)', ['FTE'], [INT]],
  ['Voluntary attrition (LTM)', ['Voluntary Attrition'], [PCT]], ['Voluntary attrition vs LY', ['Voluntary Attrition vs PY'], [SPTS]], ['Regretted attrition (LTM)', ['Regretted Attrition'], [PCT]],
  ['Hiring rate (LTM)', ['Hiring Rate'], [PCT]], ['Internal mobility rate (LTM)', ['Internal Mobility Rate'], [PCT]], ['Promotion rate (LTM)', ['Promotion Rate'], [PCT]],
  ['External hires · LTM', ['External Hires LTM'], [INT]], ['External hires · YTD', ['External Hires YTD'], [INT]], ['External hires · this quarter', ['External Hires CQ'], [INT]],
  ['Absence rate · YTD', ['Absence Rate YTD'], [ABS]], ['Engagement index · this quarter', ['Engagement Index CQ'], [IDX]], ['Intent to stay · this quarter', ['Intent to Stay CQ'], [PCT]],
  ['Payroll cost per employee · YTD', ['Payroll Cost per Employee YTD'], [GBPK]], ['Workforce cost · FYTD', ['Workforce Cost FYTD'], [GBPM]], ['Cost vs budget · FYTD', ['Cost vs Budget % FYTD'], [SPCT]],
  ['Compa-ratio', ['Compa Ratio'], [RATIO]], ['Average tenure', ['Average Tenure'], [YRS]], ['Span of control', ['Span of Control'], ['0.0']], ['Critical-role share', ['Critical Role Share'], [PCT]],
];
const DIST_DIMS = [['Business unit', 'Business Unit', BV], ['Region', 'Region', CV], ['Country', 'Country', CV], ['Department', 'Department', DV], ['Job family', 'Job Family', DV], ['Seniority', 'Seniority', SV], ['Employment type', 'Employment Type', WF]];
/** Drill path: a click on one level narrows the page and the chart steps to the next. */
const ORG_DRILL = [['Region', CV], ['Country', CV], ['Business Unit', BV], ['Department', DV], ['Seniority', SV]];

export const tileCatalogue = () => [
  // ---- Filter bars. Region/Country come from the shared Countries table, Business Unit/Department from the org tables, so one control filters every source system.
  ...['g-home', 'g-wx', 'g-tr'].map((g) => ctl(g, CV, 'Region')),
  ...['g-wx', 'g-tr', 'g-sk'].map((g) => ctl(g, CV, 'Country')),
  ...['g-home', 'g-wx', 'g-tr', 'g-sk'].map((g) => ctl(g, BV, 'Business Unit')),
  ...['g-wx', 'g-tr'].map((g) => ctl(g, DV, 'Department')),
  ctl('g-wx', DV, 'Job Family'), ...['g-wx', 'g-tr'].map((g) => ctl(g, SV, 'Seniority')), ctl('g-wx', WF, 'Employment Type'),
  ctl('g-sk', SKV, 'Skill Tier'), ctl('g-sk', SKV, 'Skill Cluster'), ctl('g-sk', SKV, 'Skill'),

  // ================= My People Home
  ...kpiCard('h-hc', 'home', 'g-home', 'Total workforce', { value: 'Headcount', fmt: INT, py: 'Headcount PY', delta: 'Headcount YoY', spark: 'Monthly Headcount', good: 'flat', note: 'Employees at 30 Sep 2026 · SuccessFactors EC, regional and local HRIS', drill: 'wx' }),
  ...kpiCard('h-va', 'home', 'g-home', 'Voluntary attrition', { value: 'Voluntary Attrition', fmt: PCT, py: 'Voluntary Attrition PY', delta: 'Voluntary Attrition vs PY', deltaFmt: SPTS, spark: 'Rolling Voluntary Attrition', good: 'down', note: 'Rolling 12 months to Sep 2026', drill: 'tr' }),
  ...kpiCard('h-cs', 'home', 'g-home', 'Critical skills coverage', { value: 'Critical Skills Coverage', fmt: PCT, py: 'Critical Skills Coverage PY', delta: 'Critical Skills Coverage vs PY', deltaFmt: SPTS, spark: 'Skills Coverage', sparkDim: ['Skill', SKV], sparkType: 'bar', good: 'up', color: C.ink, note: 'Six strategic skills · Talent Intelligence Hub', drill: 'sk' }),
  ...kpiCard('h-cb', 'home', 'g-home', 'Workforce cost vs budget', { value: 'Cost vs Budget % FYTD', fmt: SPCT, py: 'Cost vs Budget % PY FYTD', delta: 'Cost vs Budget % FYTD vs PY', deltaFmt: SPTS, pyLabel: 'PY', spark: 'Cost vs Budget %', sparkType: 'bar', good: 'down', color: C.grey, note: 'FY27 to date (Apr–Sep) · S/4HANA cost centres', drill: 'wx' }),
  chart('h-attr', 'Voluntary attrition · rolling 12 months by business unit', 'line', [['Month', MV], ['Business Unit', BV]], ['Rolling Voluntary Attrition'], { page: 'home', group: 'g-home-t', sort: [{ by: 'd0', direction: 'asc' }], colors: SERIES, legend: true, legendPosition: 'right', format: [PCT], lineCurve: 'curve' }),
  {
    id: 'h-scorecard', slot: 'h-scorecard', page: 'home', title: 'Business unit scorecard · every source system on one row', type: 'table', group: 'g-home',
    fitColumns: { b: .13, h: .07, y: .06, va: .07, vq: .07, sp: .11, ra: .06, e: .06, cb: .07, cs: .07, oc: .06, rx: .08 },
    dimensions: dims(['Business Unit', 'b', BV]),
    measures: meas(['Headcount', 'h'], ['Headcount YoY', 'y'], ['Voluntary Attrition', 'va'], ['Voluntary Attrition vs P2Q', 'vq'], ['Rolling Voluntary Attrition', 'sp'], ['Regretted Attrition', 'ra'], ['Engagement Index CQ', 'e'], ['Cost vs Budget % FYTD', 'cb'], ['Critical Skills Coverage', 'cs'], ['Open Critical Roles', 'oc'], ['Replacement Cost Exposure', 'rx']),
    miniChart: sparkCol('sp', C.red), sort: [{ by: 'h', direction: 'desc' }], limit: 20, fontSize: 12.5,
    columnLabels: { b: 'Business unit', h: 'Headcount', y: 'vs LY', va: 'Vol. attr.', vq: 'vs Mar', sp: 'Attrition · 24m', ra: 'Regretted', e: 'Engage.', cb: 'Cost vs bud.', cs: 'Crit. skills', oc: 'Open crit.', rx: 'Exposure' },
    ops: [...rowHeight(32), bold('b', C.ink), ...colFormat('h', INT), ...colFormat('y', SPCT), ...colFormat('va', PCT), ...colFormat('vq', SPTS), ...colFormat('ra', PCT), ...colFormat('e', IDX), ...colFormat('cb', SPCT), ...colFormat('cs', PCT0), ...colFormat('oc', INT), ...colFormat('rx', GBPM), ...right('h', 'y', 'va', 'vq', 'ra', 'e', 'cb', 'cs', 'oc', 'rx'),
      ...bands('va', [-1e9, 0.10, 0.14], [C.good, C.amber, C.bad]), ...bands('vq', [-1e9, 0, 1.5], [C.good, C.amber, C.bad]), ...bands('cb', [-1e9, 0, 0.02], [C.good, C.amber, C.bad]), ...bands('cs', [-1e9, 0.6, 0.75], [C.bad, C.amber, C.good]), ...bands('e', [-1e9, 68, 72], [C.bad, C.amber, C.good])],
  },
  {
    id: 'h-hot', slot: 'h-hot', page: 'home', title: 'Hotspots · where rising attrition costs most (replacement exposure vs last year)', type: 'table', group: 'g-home',
    fitColumns: { c: .12, b: .16, h: .08, va: .09, vq: .09, sp: .15, rx: .11, i: .1, cb: .1 },
    dimensions: dims(['Country', 'c', CV], ['Business Unit', 'b', BV]),
    measures: meas(['Headcount', 'h'], ['Voluntary Attrition', 'va'], ['Voluntary Attrition vs P2Q', 'vq'], ['Rolling Voluntary Attrition', 'sp'], ['Replacement Cost Exposure vs PY', 'rx'], ['Intent to Stay CQ', 'i'], ['Cost vs Budget % FYTD', 'cb']),
    miniChart: sparkCol('sp', C.red), sort: [{ by: 'rx', direction: 'desc' }], limit: 12, fontSize: 12.5,
    columnLabels: { c: 'Country', b: 'Business unit', h: 'Headcount', va: 'Vol. attr.', vq: 'vs Mar', sp: 'Attrition · 24m', rx: 'Exposure vs LY', i: 'Intent to stay', cb: 'Cost vs bud.' },
    ops: [...rowHeight(30), bold('c', C.ink), ...colFormat('h', INT), ...colFormat('va', PCT), ...colFormat('vq', SPTS), ...colFormat('rx', SGBPM), ...colFormat('i', PCT0), ...colFormat('cb', SPCT), ...right('h', 'va', 'vq', 'rx', 'i', 'cb'), ...bands('rx', [-1e12, 0, 1e6], [C.good, C.amber, C.bad]),
      ...bands('vq', [-1e9, 0, 1.5], [C.good, C.amber, C.bad]), ...bands('i', [-1e9, 0.6, 0.7], [C.bad, C.amber, C.good]), ...bands('cb', [-1e9, 0, 0.02], [C.good, C.amber, C.bad])],
  },
  bar('h-bu', 'Attrition movement in two quarters · pts change, by business unit', ['Business Unit', BV], 'Voluntary Attrition vs P2Q', { page: 'home', group: 'g-home', format: SPTS, gradient: [C.aqua, '#F2F2F2', C.red], drillTo: 'tr' }),
  bar('h-cost', 'Workforce cost vs budget · FY27 to date, by business unit', ['Business Unit', BV], 'Cost vs Budget % FYTD', { page: 'home', group: 'g-home', format: SPCT, gradient: [C.good, '#F2F2F2', C.bad], drillTo: 'wx' }),

  // ================= Workforce Explorer
  ...kpiCard('w-hc', 'wx', 'g-wx', 'Headcount', { value: 'Headcount', fmt: INT, py: 'Headcount PY', delta: 'Headcount YoY', spark: 'Monthly Headcount', good: 'flat' }),
  ...kpiCard('w-hire', 'wx', 'g-wx', 'External hires · LTM', { value: 'External Hires LTM', fmt: INT, py: 'External Hires Prior LTM', delta: 'External Hires LTM YoY', pyLabel: 'PY', spark: 'External Hires', sparkType: 'bar', good: 'flat', color: C.ink }),
  ...kpiCard('w-va', 'wx', 'g-wx', 'Voluntary attrition · LTM', { value: 'Voluntary Attrition', fmt: PCT, py: 'Voluntary Attrition PY', delta: 'Voluntary Attrition vs PY', deltaFmt: SPTS, spark: 'Rolling Voluntary Attrition', good: 'down' }),
  ...kpiCard('w-mob', 'wx', 'g-wx', 'Internal mobility · LTM', { value: 'Internal Mobility Rate', fmt: PCT, py: 'Internal Mobility Rate PY', delta: 'Internal Mobility Rate vs PY', deltaFmt: SPTS, spark: 'Rolling Internal Mobility Rate', good: 'up', color: C.teal }),
  ...kpiCard('w-abs', 'wx', 'g-wx', 'Absence rate · YTD', { value: 'Absence Rate YTD', fmt: ABS, py: 'Absence Rate PY YTD', delta: 'Absence Rate YTD vs PY', deltaFmt: '+0.00" pts";-0.00" pts";0.00" pts"', spark: 'Absence Rate', good: 'down', color: C.grey }),
  ...kpiCard('w-cost', 'wx', 'g-wx', 'Cost per employee · YTD', { value: 'Payroll Cost per Employee YTD', fmt: GBPK, py: 'Payroll Cost per Employee PY YTD', delta: 'Payroll Cost per Employee YTD vs PY', deltaFmt: '+£#,##0;-£#,##0;£0', spark: 'Payroll Cost per Employee', good: 'down', color: C.grey }),
  ...kpiCard('w-eng', 'wx', 'g-wx', 'Engagement index · Q3', { value: 'Engagement Index CQ', fmt: IDX, py: 'Engagement Index CQ LY', delta: 'Engagement Index vs LY', deltaFmt: SIDX, spark: 'Engagement Index', good: 'up', color: C.aqua }),
  ...kpiCard('w-ten', 'wx', 'g-wx', 'Average tenure', { value: 'Average Tenure', fmt: YRS, py: 'Average Tenure PY', delta: 'Average Tenure vs PY', deltaFmt: '+0.0" yrs";-0.0" yrs";0.0" yrs"', spark: 'Monthly Average Tenure', good: 'flat', color: C.mid }),
  {
    ...chart('x-trend', 'Headcount (bars) and rolling voluntary attrition (line)', 'combo', [['Month', MV]], ['Monthly Headcount', 'Rolling Voluntary Attrition'], { page: 'wx', group: 'g-wx-t', sort: [{ by: 'd0', direction: 'asc' }], graphTypes: { m0: 'bar', m1: 'line' }, legend: true, colors: [C.light, C.red], format: [INT, PCT], extraOps: [secondary('m1'), ...perMeasure({ m0: '#D5D5D5', m1: C.red })] }),
    switch: { measures: [
      ['Headcount + attrition', ['Monthly Headcount', 'Rolling Voluntary Attrition'], [INT, PCT]],
      ['FTE + hiring rate', ['Monthly FTE', 'Rolling Hiring Rate'], [INT, PCT]],
      ['Critical roles + critical attrition', ['Monthly Critical Role Headcount', 'Rolling Critical Role Attrition'], [INT, PCT]],
      ['High performers + HP attrition', ['Monthly High Performer Headcount', 'Rolling High Performer Attrition'], [INT, PCT]],
      ['Payroll cost + cost per employee', ['Payroll Cost', 'Payroll Cost per Employee'], [GBPM, GBPK]],
    ] },
  },
  {
    id: 'x-map', slot: 'x-map', page: 'wx', title: 'Where our people are · bubble = headcount', type: 'scatter', group: 'g-wx',
    dimensions: dims(['Country', 'd0', CV]),
    measures: meas(['Country Longitude', 'm0'], ['Country Latitude', 'm1'], ['Headcount', 'm2']),
    limit: 50, noLabels: true, map: true, extent: 'world', pointSize: 9, legend: false, colors: [C.red],
    ops: [...measFormat('m2', INT)],
  },
  {
    ...bar('x-dist', 'Workforce distribution', ['Business Unit', BV], 'Headcount', { page: 'wx', group: 'g-wx', format: INT, colors: [C.red], limit: 30 }),
    switch: { measures: DIST_MEASURES, dims: DIST_DIMS }, drill: ORG_DRILL,
  },
  {
    ...chart('x-move', 'Hiring, departures and net movement by month', 'combo', [['Month', MV]], ['External Hires', 'Internal Moves', 'Voluntary Leavers', 'Involuntary Leavers', 'Net Movement'], { page: 'wx', group: 'g-wx-t', sort: [{ by: 'd0', direction: 'asc' }], graphTypes: { m0: 'bar', m1: 'bar', m2: 'bar', m3: 'bar', m4: 'line' }, legend: true, format: [INT, INT, INT, INT, SINT], extraOps: [secondary('m4'), ...perMeasure({ m0: C.ink, m1: C.aqua, m2: C.red, m3: '#F29B9B', m4: C.yellow })] }),
  },
  {
    ...chart('x-attr', 'Voluntary vs involuntary attrition · hiring and mobility (rolling 12 months)', 'line', [['Month', MV]], ['Rolling Voluntary Attrition', 'Rolling Involuntary Attrition', 'Rolling Hiring Rate', 'Rolling Internal Mobility Rate'], { page: 'wx', group: 'g-wx-t', sort: [{ by: 'd0', direction: 'asc' }], legend: true, colors: [C.red, C.mid, C.ink, C.aqua], format: [PCT, PCT, PCT, PCT], lineCurve: 'curve' }),
  },
  {
    ...chart('x-cost', 'Workforce cost (bars) vs budget (line) · S/4HANA', 'combo', [['Month', MV]], ['Workforce Cost', 'Workforce Budget'], { page: 'wx', group: 'g-wx-t', sort: [{ by: 'd0', direction: 'asc' }], graphTypes: { m0: 'bar', m1: 'line' }, legend: true, format: [GBPM, GBPM], extraOps: perMeasure({ m0: '#D5D5D5', m1: C.red }) }),
    switch: { measures: [
      ['Cost vs budget', ['Workforce Cost', 'Workforce Budget'], [GBPM, GBPM], { graphTypes: { m0: 'bar', m1: 'line' } }],
      ['Contractors + overtime', ['Contractor Cost', 'Overtime Cost'], [GBPM, GBPM], { graphTypes: { m0: 'bar', m1: 'bar' } }],
      ['Recruitment + learning', ['Recruitment Spend', 'Learning Spend'], [GBPM, GBPM], { graphTypes: { m0: 'bar', m1: 'bar' } }],
      ['Variance to budget %', ['Workforce Cost', 'Cost vs Budget %'], [GBPM, SPCT], { graphTypes: { m0: 'bar', m1: 'line' }, secondary: 'm1' }],
    ] },
  },
  chart('x-health', 'Absence rate (left) and engagement index (right)', 'combo', [['Month', MV]], ['Absence Rate', 'Engagement Index'], { page: 'wx', group: 'g-wx-t', sort: [{ by: 'd0', direction: 'asc' }], graphTypes: { m0: 'line', m1: 'line' }, legend: true, format: [ABS, IDX], extraOps: [secondary('m1'), ...perMeasure({ m0: C.grey, m1: C.aqua })] }),
  chart('x-org', 'Organisational breakdown · business unit → department → seniority (headcount)', 'sankey', [['Business Unit', BV], ['Department', DV], ['Seniority', SV]], ['Headcount'], { page: 'wx', group: 'g-wx', colors: SERIES }),
  {
    ...chart('x-heat', 'Country × business unit heatmap', 'heatMap', [['Country', CV], ['Business Unit', BV]], ['Voluntary Attrition'], { page: 'wx', group: 'g-wx', gradient: ['#FFFFFF', '#B3C6F6', C.red], legend: true, format: PCT }),
    switch: { measures: [
      ['Voluntary attrition (LTM)', ['Voluntary Attrition'], [PCT], { gradient: ['#FFFFFF', '#B3C6F6', C.red] }],
      ['Attrition change vs LY', ['Voluntary Attrition vs PY'], [SPTS], { gradient: [C.aqua, '#FFFFFF', C.red] }],
      ['Headcount growth YoY', ['Headcount YoY'], [SPCT], { gradient: [C.red, '#FFFFFF', C.teal] }],
      ['Absence rate YTD', ['Absence Rate YTD'], [ABS], { gradient: ['#FFFFFF', '#C9C9C9', C.ink] }],
      ['Intent to stay Q3', ['Intent to Stay CQ'], [PCT], { gradient: [C.red, '#FFFFFF', C.teal] }],
      ['Headcount (Sep 26)', ['Headcount'], [INT], { gradient: ['#FFFFFF', '#9FA3A6', C.ink] }],
    ] },
  },
  {
    id: 'x-table', slot: 'x-table', page: 'wx', title: 'Segment scorecard · SuccessFactors, Qualtrics and S/4HANA joined through Countries and Departments', type: 'table', group: 'g-wx',
    fitColumns: { c: .1, b: .11, dp: .13, h: .06, y: .06, sp: .1, va: .07, vd: .07, hr: .06, mr: .06, ab: .06, e: .05, pc: .07 },
    dimensions: dims(['Country', 'c', CV], ['Business Unit', 'b', BV], ['Department', 'dp', DV]),
    measures: meas(['Headcount', 'h'], ['Headcount YoY', 'y'], ['Monthly Headcount', 'sp'], ['Voluntary Attrition', 'va'], ['Voluntary Attrition vs PY', 'vd'], ['Hiring Rate', 'hr'], ['Internal Mobility Rate', 'mr'], ['Absence Rate YTD', 'ab'], ['Engagement Index CQ', 'e'], ['Payroll Cost per Employee YTD', 'pc']),
    miniChart: sparkCol('sp', C.red), sort: [{ by: 'h', direction: 'desc' }], limit: 400, fontSize: 12,
    columnLabels: { c: 'Country', b: 'Business unit', dp: 'Department', h: 'Headcount', y: 'vs LY', sp: 'Headcount · 24m', va: 'Vol. attrition', vd: 'vs LY', hr: 'Hiring', mr: 'Mobility', ab: 'Absence', e: 'Engagement', pc: 'Cost / emp.' },
    ops: [...rowHeight(30), bold('c', C.ink), ...colFormat('h', INT), ...colFormat('y', SPCT), ...colFormat('va', PCT), ...colFormat('vd', SPTS), ...colFormat('hr', PCT), ...colFormat('mr', PCT), ...colFormat('ab', ABS), ...colFormat('e', IDX), ...colFormat('pc', GBPK), ...right('h', 'y', 'va', 'vd', 'hr', 'mr', 'ab', 'e', 'pc'),
      ...bands('vd', [-1e9, 0, 1.5], [C.good, C.amber, C.bad]), ...bands('va', [-1e9, 0.10, 0.14], [C.good, C.amber, C.bad])],
  },

  // ================= Talent & Retention
  ...kpiCard('t-va', 'tr', 'g-tr', 'Voluntary attrition · LTM', { value: 'Voluntary Attrition', fmt: PCT, py: 'Voluntary Attrition P2Q', delta: 'Voluntary Attrition vs P2Q', deltaFmt: SPTS, pyLabel: 'Mar', deltaLabel: 'vs Mar', spark: 'Rolling Voluntary Attrition', good: 'down' }),
  ...kpiCard('t-ra', 'tr', 'g-tr', 'Regretted attrition · LTM', { value: 'Regretted Attrition', fmt: PCT, py: 'Regretted Attrition PY', delta: 'Regretted Attrition vs PY', deltaFmt: SPTS, spark: 'Rolling Regretted Attrition', good: 'down', color: C.dark }),
  ...kpiCard('t-hp', 'tr', 'g-tr', 'High-performer attrition', { value: 'High Performer Attrition', fmt: PCT, py: 'High Performer Attrition PY', delta: 'High Performer Attrition vs PY', deltaFmt: SPTS, spark: 'High Performer Attrition', sparkDim: ['Business Unit', BV], sparkType: 'bar', good: 'down', color: C.plum }),
  ...kpiCard('t-cr', 'tr', 'g-tr', 'Critical-role attrition', { value: 'Critical Role Attrition', fmt: PCT, py: 'Critical Role Attrition PY', delta: 'Critical Role Attrition vs PY', deltaFmt: SPTS, spark: 'Critical Role Attrition', sparkDim: ['Business Unit', BV], sparkType: 'bar', good: 'down', color: C.ink }),
  ...kpiCard('t-rx', 'tr', 'g-tr', 'Replacement cost exposure', { value: 'Replacement Cost Exposure', fmt: GBPM, py: 'Replacement Cost Exposure PY', delta: 'Replacement Cost Exposure vs PY', deltaFmt: SGBPM, spark: 'Rolling Replacement Cost Exposure', good: 'down', color: C.grey }),
  ...kpiCard('t-its', 'tr', 'g-tr', 'Intent to stay · Q3', { value: 'Intent to Stay CQ', fmt: PCT, py: 'Intent to Stay CQ LY', delta: 'Intent to Stay vs LY', deltaFmt: SPTS, spark: 'Intent to Stay', good: 'up', color: C.aqua }),
  {
    ...chart('t-trend', 'Rolling 12-month voluntary attrition', 'line', [['Month', MV], ['Business Unit', BV]], ['Rolling Voluntary Attrition'], { page: 'tr', group: 'g-tr-t', sort: [{ by: 'd0', direction: 'asc' }], colors: SERIES, legend: true, legendPosition: 'right', format: [PCT], lineCurve: 'curve' }),
    switch: {
      measures: [['Voluntary attrition', ['Rolling Voluntary Attrition'], [PCT]], ['Regretted attrition', ['Rolling Regretted Attrition'], [PCT]], ['High-performer attrition', ['Rolling High Performer Attrition'], [PCT]], ['Critical-role attrition', ['Rolling Critical Role Attrition'], [PCT]], ['Promotion rate', ['Rolling Promotion Rate'], [PCT]]],
      dims: [['by business unit', 'Business Unit', BV], ['by region', 'Region', CV], ['by seniority', 'Seniority', SV], ['by job family', 'Job Family', DV]], dimIndex: 1,
    },
  },
  {
    id: 't-matrix', slot: 't-matrix', page: 'tr', title: 'Retention risk matrix · attrition (x) vs business criticality (y), bubble = replacement exposure · click a unit to investigate', type: 'scatter', group: 'g-tr',
    dimensions: dims(['Business Unit', 'd0', BV]), measures: meas(['Voluntary Attrition', 'm0'], ['Business Criticality Score', 'm1'], ['Replacement Cost Exposure', 'm2']),
    limit: 20, colors: [C.red], pointSize: 14, ops: [...measFormat('m0', PCT), ...measFormat('m1', '0.0'), ...measFormat('m2', GBPM)], investigate: true,
  },
  {
    id: 't-matrix2', slot: 't-matrix2', page: 'tr', title: 'Segment risk · attrition change vs Mar (x) vs critical-role share (y), bubble = headcount', type: 'scatter', group: 'g-tr',
    dimensions: dims(['Department', 'd0', DV]), measures: meas(['Voluntary Attrition vs P2Q', 'm0'], ['Critical Role Share', 'm1'], ['Headcount', 'm2']),
    limit: 40, colors: [C.ink], pointSize: 8, ops: [...measFormat('m0', SPTS), ...measFormat('m1', PCT), ...measFormat('m2', INT)],
  },
  chart('t-heat', 'Where attrition is accelerating · change in rolling attrition since March (pts), country × business unit', 'heatMap', [['Country', CV], ['Business Unit', BV]], ['Voluntary Attrition vs P2Q'], { page: 'tr', group: 'g-tr', gradient: [C.aqua, '#FFFFFF', C.red], legend: true, format: SPTS, investigate: true }),
  bar('t-crit', 'Critical-role exposure · critical-role attrition by department', ['Department', DV], 'Critical Role Attrition', { page: 'tr', group: 'g-tr', format: PCT, gradient: ['#B3C6F6', C.red], limit: 14 }),
  bar('t-hp-bu', 'High-performer retention · rolling attrition now vs a year ago', ['Business Unit', BV], ['High Performer Attrition PY', 'High Performer Attrition'], { page: 'tr', group: 'g-tr', format: [PCT, PCT], grouped: true, legend: true, labels: false, hideMeasureAxis: false, measureColors: { m0: C.light, m1: C.plum }, sort: { by: 'm1', direction: 'desc' } }),
  {
    id: 't-pay', slot: 't-pay', page: 'tr', title: 'Compensation vs attrition · compa-ratio (x) vs voluntary attrition (y) by department and seniority', type: 'scatter', group: 'g-tr',
    dimensions: dims(['Department', 'd0', DV]), measures: meas(['Compa Ratio', 'm0'], ['Voluntary Attrition', 'm1'], ['Headcount', 'm2']),
    limit: 60, colors: [C.red], pointSize: 8, ops: [...measFormat('m0', RATIO), ...measFormat('m1', PCT), ...measFormat('m2', INT)],
    switch: { dims: [['by department', 'Department', DV], ['by business unit', 'Business Unit', BV], ['by seniority', 'Seniority', SV], ['by country', 'Country', CV]] },
  },
  {
    ...chart('t-eng', 'Engagement drivers · Qualtrics pulse, share favourable', 'line', [['Month', MV]], ['Intent to Stay', 'Pay Fairness', 'Career Growth', 'Manager Effectiveness'], { page: 'tr', group: 'g-tr-t', sort: [{ by: 'd0', direction: 'asc' }], legend: true, colors: [C.red, C.ink, C.aqua, C.light], format: [PCT, PCT, PCT, PCT], lineCurve: 'curve' }),
  },
  {
    ...bar('t-reason', 'Why people leave · voluntary exits by reason and seniority (LTM)', ['Seniority', SV], 'Voluntary Exits', { page: 'tr', group: 'g-tr', dims2: 'Exit Reason', dims2View: EX, stacked: true, legend: true, labels: false, coloring: 'categorical', colors: SERIES, format: INT, orientation: 'vertical', sort: [{ by: 'd0', direction: 'asc' }], filters: [{ view: EX, field: 'Ltm Bucket', values: ['LTM'] }] }),
  },
  donut('t-dest', 'Where leavers go · destination of voluntary leavers (LTM)', ['Destination', EX], 'Voluntary Exits', { page: 'tr', group: 'g-tr', filters: [{ view: EX, field: 'Ltm Bucket', values: ['LTM'] }, { view: EX, field: 'Exit Type', values: ['Voluntary'] }] }),
  {
    id: 't-table', slot: 't-table', page: 'tr', title: 'Retention scorecard · country × business unit (SuccessFactors, Qualtrics) · click a row to investigate', type: 'table', group: 'g-tr',
    fitColumns: { c: .11, b: .13, va: .07, vq: .07, vy: .07, sp: .12, ra: .07, hp: .07, cr: .06, i: .07, rx: .08 },
    dimensions: dims(['Country', 'c', CV], ['Business Unit', 'b', BV]),
    measures: meas(['Voluntary Attrition', 'va'], ['Voluntary Attrition vs P2Q', 'vq'], ['Voluntary Attrition vs PY', 'vy'], ['Rolling Voluntary Attrition', 'sp'], ['Regretted Attrition', 'ra'], ['High Performer Attrition', 'hp'], ['Compa Ratio', 'cr'], ['Intent to Stay CQ', 'i'], ['Replacement Cost Exposure', 'rx']),
    miniChart: sparkCol('sp', C.red), sort: [{ by: 'vq', direction: 'desc' }], limit: 200, fontSize: 12, investigate: true,
    columnLabels: { c: 'Country', b: 'Business unit', va: 'Vol. attrition', vq: 'vs Mar', vy: 'vs LY', sp: 'Rolling attrition · 24m', ra: 'Regretted', hp: 'High perf.', cr: 'Compa', i: 'Intent to stay', rx: 'Exposure' },
    ops: [...rowHeight(30), bold('c', C.ink), ...colFormat('va', PCT), ...colFormat('vq', SPTS), ...colFormat('vy', SPTS), ...colFormat('ra', PCT), ...colFormat('hp', PCT), ...colFormat('cr', RATIO), ...colFormat('i', PCT), ...colFormat('rx', GBPM), ...right('va', 'vq', 'vy', 'ra', 'hp', 'cr', 'i', 'rx'),
      ...bands('vq', [-1e9, 0, 1.5], [C.good, C.amber, C.bad]), ...bands('cr', [-1e9, 0.95, 1.0], [C.bad, C.amber, C.good]), ...bands('i', [-1e9, 0.6, 0.7], [C.bad, C.amber, C.good])],
  },

  // ================= Skills & Future Workforce
  ...kpiCard('s-cs', 'sk', 'g-sk', 'Critical skills coverage', { value: 'Critical Skills Coverage', fmt: PCT, py: 'Critical Skills Coverage PY', delta: 'Critical Skills Coverage vs PY', deltaFmt: SPTS, spark: 'Skills Coverage', sparkDim: ['Skill', SKV], sparkType: 'bar', good: 'up', color: C.ink }),
  ...kpiCard('s-ai', 'sk', 'g-sk', 'AI & ML coverage', { value: 'Skills Coverage', fmt: PCT, py: 'Skills Coverage PY', delta: 'Skills Coverage vs PY', deltaFmt: SPTS, spark: 'Skills Coverage', sparkDim: ['Region', CV], sparkType: 'bar', good: 'up', filters: [{ view: SKV, field: 'Skill', values: ['AI & Machine Learning'] }] }),
  ...kpiCard('s-cl', 'sk', 'g-sk', 'Cloud engineering coverage', { value: 'Skills Coverage', fmt: PCT, py: 'Skills Coverage PY', delta: 'Skills Coverage vs PY', deltaFmt: SPTS, spark: 'Skills Coverage', sparkDim: ['Region', CV], sparkType: 'bar', good: 'up', color: C.teal, filters: [{ view: SKV, field: 'Skill', values: ['Cloud Engineering'] }] }),
  ...kpiCard('s-gap', 'sk', 'g-sk', 'Capability gap by 2028', { value: 'Capability Gap 2028', fmt: SINT, spark: 'Shortfall 2028', sparkDim: ['Skill', SKV], sparkType: 'bar', good: 'down', color: C.red }),
  ...kpiCard('s-adj', 'sk', 'g-sk', 'Adjacent employees', { value: 'Adjacent Employees', fmt: INT, spark: 'Adjacent Employees', sparkDim: ['Skill', SKV], sparkType: 'bar', color: C.aqua }),
  ...kpiCard('s-ifr', 'sk', 'g-sk', 'Internal fill rate · YTD', { value: 'Internal Fill Rate YTD', fmt: PCT, py: 'Internal Fill Rate PY YTD', delta: 'Internal Fill Rate YTD vs PY', deltaFmt: SPTS, spark: 'Internal Fill Rate', good: 'up', color: C.teal }),
  {
    ...chart('s-heat', 'Skills heatmap · skill × business unit', 'heatMap', [['Skill', SKV], ['Business Unit', BV]], ['Skills Coverage'], { page: 'sk', group: 'g-sk', gradient: [C.bad, '#FFF4D6', C.good], legend: true, format: PCT0 }),
    switch: { measures: [
      ['Coverage today', ['Skills Coverage'], [PCT0], { gradient: [C.bad, '#FFF4D6', C.good] }],
      ['Coverage change vs LY', ['Skills Coverage vs PY'], [SPTS], { gradient: [C.red, '#FFFFFF', C.teal] }],
      ['Projected 2028 coverage', ['Projected Coverage 2028'], [PCT0], { gradient: [C.bad, '#FFF4D6', C.good] }],
      ['Shortfall 2028 (FTE)', ['Shortfall 2028'], [INT], { gradient: ['#FFFFFF', '#B3C6F6', C.red] }],
      ['Adjacent employees', ['Adjacent Employees'], [INT], { gradient: ['#FFFFFF', '#9BDDE8', C.teal] }],
    ] },
  },
  bar('s-gap28', 'Demand vs supply to 2028 · required FTE vs projected supply with no intervention', ['Skill', SKV], ['Required FTE 2028', 'Projected Supply 2028'], { page: 'sk', group: 'g-sk', format: [INT, INT], grouped: true, legend: true, labels: false, hideMeasureAxis: false, measureColors: { m0: C.red, m1: C.light }, sort: { by: 'm0', direction: 'desc' }, limit: 15 }),
  bar('s-cov', 'Coverage now vs a year ago · proficient ÷ required', ['Skill', SKV], ['Skills Coverage PY', 'Skills Coverage'], { page: 'sk', group: 'g-sk', format: [PCT0, PCT0], grouped: true, legend: true, labels: false, hideMeasureAxis: false, measureColors: { m0: C.light, m1: C.ink }, sort: { by: 'm1', direction: 'asc' }, limit: 15 }),
  chart('s-sankey', 'Skills adjacency · from today’s skills to future-critical skills (adjacent employees)', 'sankey', [['From Skill', RP], ['To Skill', RP]], ['Adjacent Employees'], { page: 'sk', group: 'g-sk', colors: SERIES }),
  bar('s-country', 'Strategic-skill shortfall by 2028 · by country', ['Country', CV], 'Shortfall 2028', { page: 'sk', group: 'g-sk', format: INT, gradient: ['#B3C6F6', C.red], filters: [{ view: SI, field: 'Skill Tier', values: ['Strategic'] }] }),
  bar('s-req', 'Open critical roles vs roles with an internal match · SuccessFactors Recruiting', ['Skill', SKV], ['Open Critical Roles', 'Critical Roles with Internal Match'], { page: 'sk', group: 'g-sk', format: [INT, INT], grouped: true, legend: true, labels: false, hideMeasureAxis: false, measureColors: { m0: C.red, m1: C.aqua }, sort: { by: 'm0', direction: 'desc' }, limit: 15 }),
  {
    id: 's-table', slot: 's-table', page: 'sk', title: 'Skills inventory · Talent Intelligence Hub, Opportunity Marketplace and Recruiting joined through Skills', type: 'table', group: 'g-sk',
    fitColumns: { s: .15, t: .07, r: .06, p: .06, c: .07, cd: .06, r8: .07, g8: .07, a: .07, o: .06, sp: .11, b: .06, y: .06 },
    dimensions: dims(['Skill', 's', SKV], ['Skill Tier', 't', SKV]),
    measures: meas(['Required FTE', 'r'], ['Proficient Employees', 'p'], ['Skills Coverage', 'c'], ['Skills Coverage vs PY', 'cd'], ['Required FTE 2028', 'r8'], ['Capability Gap 2028', 'g8'], ['Adjacent Employees', 'a'], ['Open Critical Roles', 'o'], ['Filled Requisitions', 'sp'], ['Build Cost per FTE', 'b'], ['Buy Cost per FTE', 'y']),
    miniChart: sparkCol('sp', C.ink), sort: [{ by: 'g8', direction: 'desc' }], limit: 30, fontSize: 12,
    columnLabels: { s: 'Skill', t: 'Tier', r: 'Required', p: 'Proficient', c: 'Coverage', cd: 'vs LY', r8: 'Need 2028', g8: 'Gap 2028', a: 'Adjacent', o: 'Open crit.', sp: 'Hires with skill · 24m', b: 'Build / FTE', y: 'Buy / FTE' },
    ops: [...rowHeight(30), bold('s', C.ink), ...colFormat('r', INT), ...colFormat('p', INT), ...colFormat('c', PCT0), ...colFormat('cd', SPTS), ...colFormat('r8', INT), ...colFormat('g8', SINT), ...colFormat('a', INT), ...colFormat('o', INT), ...colFormat('b', GBPK), ...colFormat('y', GBPK), ...right('r', 'p', 'c', 'cd', 'r8', 'g8', 'a', 'o', 'b', 'y'),
      ...bands('c', [-1e9, 0.65, 0.85], [C.bad, C.amber, C.good]), ...bands('cd', [-1e9, 0], [C.bad, C.good])],
  },

  // ================= Dense reports
  {
    id: 'x-monthly', slot: 'x-monthly', page: 'wx', title: 'Monthly people report · movements, attrition, absence, engagement and cost', type: 'table', group: 'g-wx-t',
    fitColumns: { mo: .08, h: .08, eh: .07, im: .07, vl: .07, il: .07, nm: .07, va: .09, ab: .07, e: .07, wc: .1, cb: .08, cc: .08 },
    dimensions: dims(['Month', 'mo', MV]),
    measures: meas(['Monthly Headcount', 'h'], ['External Hires', 'eh'], ['Internal Moves', 'im'], ['Voluntary Leavers', 'vl'], ['Involuntary Leavers', 'il'], ['Net Movement', 'nm'], ['Rolling Voluntary Attrition', 'va'], ['Absence Rate', 'ab'], ['Engagement Index', 'e'], ['Workforce Cost', 'wc'], ['Cost vs Budget %', 'cb'], ['Contractor Cost', 'cc']),
    sort: [{ by: 'mo', direction: 'desc' }], limit: 30, fontSize: 12,
    columnLabels: { mo: 'Month', h: 'Headcount', eh: 'Hires', im: 'Moves in', vl: 'Vol. leavers', il: 'Invol.', nm: 'Net', va: 'Vol. attr. (LTM)', ab: 'Absence', e: 'Engage.', wc: 'Workforce cost', cb: 'vs budget', cc: 'Contractors' },
    ops: [...rowHeight(28), bold('mo', C.ink), ...colFormat('h', INT), ...colFormat('eh', INT), ...colFormat('im', INT), ...colFormat('vl', INT), ...colFormat('il', INT), ...colFormat('nm', SINT), ...colFormat('va', PCT), ...colFormat('ab', ABS), ...colFormat('e', IDX), ...colFormat('wc', GBPM), ...colFormat('cb', SPCT), ...colFormat('cc', GBPM), ...right('h', 'eh', 'im', 'vl', 'il', 'nm', 'va', 'ab', 'e', 'wc', 'cb', 'cc'),
      ...bands('nm', [-1e9, 0], [C.bad, C.good]), ...bands('cb', [-1e9, 0, 0.02], [C.good, C.amber, C.bad]), ...progress('va', C.red)],
  },
  {
    id: 't-exits', slot: 't-exits', page: 'tr', title: 'Exit analysis · voluntary leavers by reason (last 12 months)', type: 'table', group: 'g-tr',
    fitColumns: { r: .2, v: .1, sp: .18, s: .1, g: .1, b: .1, d: .1, c: .1 },
    dimensions: dims(['Exit Reason', 'r', EX]), filters: [{ view: EX, field: 'Ltm Bucket', values: ['LTM'] }, { view: EX, field: 'Exit Type', values: ['Voluntary'] }],
    measures: meas(['Voluntary Exits', 'v'], ['Exits', 'sp'], ['Regretted Share', 's'], ['High Performer Exits', 'g'], ['Big Tech Share of Exits', 'b'], ['Average Days to Backfill', 'd'], ['Exit Replacement Cost', 'c']),
    miniChart: sparkCol('sp', C.red), sort: [{ by: 'v', direction: 'desc' }], limit: 20, fontSize: 12,
    columnLabels: { r: 'Exit reason', v: 'Leavers', sp: 'Leavers by month', s: 'Regretted', g: 'High perf.', b: 'To Big Tech', d: 'Backfill', c: 'Replacement' },
    ops: [...rowHeight(30), bold('r', C.ink), ...colFormat('v', INT), ...colFormat('s', PCT0), ...colFormat('g', INT), ...colFormat('b', PCT0), ...colFormat('d', '0" d"'), ...colFormat('c', GBPM), ...right('v', 's', 'g', 'b', 'd', 'c'), ...progress('v', C.red), ...bands('s', [-1e9, 0.35, 0.5], [C.good, C.amber, C.bad])],
  },
  {
    id: 's-reqtbl', slot: 's-reqtbl', page: 'sk', title: 'Recruiting report · open critical roles, internal matches and time to fill by skill', type: 'table', group: 'g-sk',
    fitColumns: { s: .2, o: .09, m: .09, c: .09, d: .09, f: .1, t: .1, sp: .16 },
    dimensions: dims(['Skill', 's', SKV]),
    measures: meas(['Open Critical Roles', 'o'], ['Critical Roles with Internal Match', 'm'], ['Adjacent Internal Candidates', 'c'], ['Average Days Open', 'd'], ['Internal Fill Rate', 'f'], ['Average Time to Fill', 't'], ['Filled Requisitions', 'sp']),
    miniChart: sparkCol('sp', C.teal), sort: [{ by: 'o', direction: 'desc' }], limit: 20, fontSize: 12,
    columnLabels: { s: 'Skill', o: 'Open crit.', m: 'Int. match', c: 'Candidates', d: 'Days open', f: 'Internal fill', t: 'Time to fill', sp: 'Hires · 24m' },
    ops: [...rowHeight(30), bold('s', C.ink), ...colFormat('o', INT), ...colFormat('m', INT), ...colFormat('c', INT), ...colFormat('d', '0'), ...colFormat('f', PCT0), ...colFormat('t', '0" d"'), ...right('o', 'm', 'c', 'd', 'f', 't'), ...progress('o', C.red), ...bands('f', [-1e9, 0.2, 0.3], [C.bad, C.amber, C.good])],
  },

  // ================= Writeback: rows the app inserts into Snowflake through the semantic layer
  {
    id: 'a-log', slot: 'a-log', page: 'act', title: 'Writeback log · ASTRATO_GALLERY.MOCK_DATA.PEOPLE_ACTION_EVENTS (every workflow step, written from this app)', type: 'table', group: 'g-act', scope: 'bu', live: true,
    fitColumns: { at: .1, id: .06, n: .2, et: .08, st: .08, a: .1, r: .1, no: .2, src: .08 },
    dimensions: dims(['Event At', 'at', 'Action Events'], ['Action Id', 'id', 'Action Events'], ['Action Name', 'n', 'Action Events'], ['Event Type', 'et', 'Action Events'], ['Status After', 'st', 'Action Events'], ['Actor', 'a', 'Action Events'], ['Actor Role', 'r', 'Action Events'], ['Note', 'no', 'Action Events'], ['Record Source', 'src', 'Action Events']),
    measures: meas(['Workflow Events', 'w']), sort: [{ by: 'at', direction: 'desc' }], limit: 200, fontSize: 12,
    columnLabels: { at: 'When', id: 'Ref', n: 'Action', et: 'Event', st: 'Status', a: 'By', r: 'Role', no: 'Note', src: 'Written by', w: '#' },
    ops: [...rowHeight(28), bold('n', C.ink), ...colFormat('w', INT)],
  },
  {
    id: 's-saved', slot: 's-saved', page: 'sim', title: 'Saved scenarios · ASTRATO_GALLERY.MOCK_DATA.PEOPLE_SCENARIOS (writeback)', type: 'table', group: 'g-sim', scope: 'bu', live: true,
    fitColumns: { id: .08, n: .22, at: .1, by: .1, st: .08, r: .09, p: .09, i: .1, nb: .12 },
    dimensions: dims(['Scenario Id', 'id', 'Saved Scenarios'], ['Scenario Name', 'n', 'Saved Scenarios'], ['Saved At', 'at', 'Saved Scenarios'], ['Saved By', 'by', 'Saved Scenarios'], ['Status', 'st', 'Saved Scenarios']),
    measures: meas(['Scenario Employees Retained', 'r'], ['Scenario Projected Attrition', 'p'], ['Scenario Investment', 'i'], ['Scenario Net Benefit', 'nb']), sort: [{ by: 'at', direction: 'desc' }], limit: 100, fontSize: 12,
    columnLabels: { id: 'Ref', n: 'Scenario', at: 'Saved', by: 'By', st: 'Status', r: 'Retained', p: 'Attrition', i: 'Investment', nb: 'Net benefit' },
    ops: [...rowHeight(30), bold('n', C.ink), ...colFormat('r', INT), ...colFormat('p', PCT), ...colFormat('i', GBPM), ...colFormat('nb', SGBPM), ...right('r', 'p', 'i', 'nb'), ...bands('nb', [-1e12, 0], [C.bad, C.good])],
  },

  // ================= People Actions (governed register; the app layers workflow state on top)
  bar('a-ben', 'Initiative portfolio · investment vs expected and realised benefit', ['Initiative Name', IN], ['Initiative Investment', 'Expected Benefit', 'Realised Benefit'], { page: 'act', group: 'g-act', format: [GBPM, GBPM, GBPM], grouped: true, legend: true, labels: false, hideMeasureAxis: false, measureColors: { m0: C.light, m1: C.red, m2: C.good }, sort: { by: 'm1', direction: 'desc' }, scope: 'bu' }),
  donut('a-type', 'Portfolio by initiative type · expected benefit', ['Initiative Type', IN], 'Expected Benefit', { page: 'act', group: 'g-act', scope: 'bu' }),

  // ================= Talent & Retention: attrition by every cut the CHRO asks for
  {
    ...bar('t-seg', 'Attrition by region, function, level and segment · rolling 12 months', ['Region', CV], 'Voluntary Attrition', { page: 'tr', group: 'g-tr', format: PCT, gradient: ['#B3C6F6', C.red], limit: 30 }),
    switch: {
      measures: [['Voluntary attrition', ['Voluntary Attrition'], [PCT]], ['Regretted attrition', ['Regretted Attrition'], [PCT]], ['High-performer attrition', ['High Performer Attrition'], [PCT]], ['Critical-role attrition', ['Critical Role Attrition'], [PCT]], ['Change since March (pts)', ['Voluntary Attrition vs P2Q'], [SPTS]], ['Change vs last year (pts)', ['Voluntary Attrition vs PY'], [SPTS]]],
      dims: [['by region', 'Region', CV], ['by country', 'Country', CV], ['by function', 'Function Group', DV], ['by business unit', 'Business Unit', BV], ['by department', 'Department', DV], ['by level', 'Seniority', SV], ['by career track', 'Career Track', SV], ['by employment type', 'Employment Type', WF]],
    },
    drill: ORG_DRILL,
  },
  bar('t-seg2', 'Attrition by employee segment · age band × gender (privacy-safe, n ≥ 10)', ['Age Band', DEI], 'DEI Voluntary Attrition (privacy-safe)', { page: 'tr', group: 'g-tr', dims2: 'Gender', dims2View: DEI, grouped: true, legend: true, labels: false, hideMeasureAxis: false, coloring: 'categorical', colors: [C.ink, C.light, C.red], format: PCT, orientation: 'vertical', sort: [{ by: 'd0', direction: 'asc' }] }),

  // ================= Diversity, equity & inclusion (aggregated; sensitive attributes thresholded in the semantic layer)
  ...['g-dei'].flatMap((g) => [ctl(g, CV, 'Region'), ctl(g, CV, 'Country'), ctl(g, BV, 'Business Unit'), ctl(g, SV, 'Seniority'), ctl(g, DEI, 'Gender')]),
  ...kpiCard('d-w', 'dei', 'g-dei', 'Women in the workforce', { value: 'Women Representation', fmt: PCT, py: 'Women Representation PY', delta: 'Women Representation vs PY', deltaFmt: SPTS, spark: 'Women Representation', sparkDim: ['Seniority', SV], sparkType: 'bar', good: 'up', note: 'Share of employees at 30 Sep 2026 · bars by level' }),
  ...kpiCard('d-wl', 'dei', 'g-dei', 'Women in leadership', { value: 'Women in Leadership', fmt: PCT, py: 'Women in Leadership PY', delta: 'Women in Leadership vs PY', deltaFmt: SPTS, spark: 'Women in Leadership', sparkDim: ['Business Unit', BV], sparkType: 'bar', good: 'up', color: C.plum, note: 'Lead & Executive grades · bars by business unit' }),
  ...kpiCard('d-gap', 'dei', 'g-dei', 'Gender pay gap (mean)', { value: 'Gender Pay Gap', fmt: PCT, py: 'Gender Pay Gap PY', delta: 'Gender Pay Gap vs PY', deltaFmt: SPTS, spark: 'Gender Pay Gap', sparkDim: ['Seniority', SV], sparkType: 'bar', good: 'down', color: C.ink, note: 'Base pay · mostly a level-mix effect (bars by level)' }),
  ...kpiCard('d-hire', 'dei', 'g-dei', 'Women share of hires', { value: 'Women Share of Hires', fmt: PCT, py: 'Women Share of Hires PY', delta: 'Women Share of Hires vs PY', deltaFmt: SPTS, spark: 'Women Share of Hires', sparkDim: ['Business Unit', BV], sparkType: 'bar', good: 'up', color: C.teal, note: 'External hires, last 12 months' }),
  ...kpiCard('d-att', 'dei', 'g-dei', 'Attrition · women', { value: 'Women Attrition', fmt: PCT, py: 'Women Attrition PY', delta: 'Women Attrition vs PY', deltaFmt: SPTS, spark: 'DEI Voluntary Attrition', sparkDim: ['Gender', DEI], sparkType: 'bar', good: 'down', note: 'Rolling 12 months · bars by gender' }),
  ...kpiCard('d-dis', 'dei', 'g-dei', 'Disability declaration', { value: 'Disability Declaration Rate', fmt: PCT, py: 'Disability Declaration Rate PY', delta: 'Disability Declaration Rate vs PY', deltaFmt: SPTS, spark: 'Disability Declaration Rate', sparkDim: ['Seniority', SV], sparkType: 'bar', good: 'up', color: C.aqua, note: 'Collected only in UK, Ireland, Netherlands · bars by level' }),
  bar('d-pipe', 'The leaky pipeline · women’s representation by level, now vs a year ago', ['Seniority', SV], ['Women Representation PY', 'Women Representation'], { page: 'dei', group: 'g-dei', format: [PCT, PCT], grouped: true, legend: true, labels: false, hideMeasureAxis: false, measureColors: { m0: C.light, m1: C.red }, sort: { by: 'm1', direction: 'desc' }, orientation: 'vertical' }),
  chart('d-heat', 'Women’s representation · business unit × level (privacy-safe: blank where n < 10)', 'heatMap', [['Business Unit', BV], ['Seniority', SV]], ['Women Representation (privacy-safe)'], { page: 'dei', group: 'g-dei', gradient: ['#FFFFFF', '#B3C6F6', C.red], legend: true, format: PCT }),
  bar('d-attg', 'Attrition equity · voluntary attrition by level and gender (privacy-safe)', ['Seniority', SV], 'DEI Voluntary Attrition (privacy-safe)', { page: 'dei', group: 'g-dei', dims2: 'Gender', dims2View: DEI, grouped: true, legend: true, labels: false, hideMeasureAxis: false, coloring: 'categorical', colors: [C.ink, C.light, C.red], format: PCT, orientation: 'vertical', sort: [{ by: 'd0', direction: 'asc' }] }),
  bar('d-prom', 'Promotion equity · women’s share of promotions vs share of the workforce', ['Business Unit', BV], ['Women Representation', 'Women Share of Promotions'], { page: 'dei', group: 'g-dei', format: [PCT, PCT], grouped: true, legend: true, labels: false, hideMeasureAxis: false, measureColors: { m0: C.light, m1: C.plum }, sort: { by: 'm0', direction: 'desc' } }),
  { ...bar('d-pay', 'Gender pay gap by business unit · mean base pay (privacy-safe)', ['Business Unit', BV], 'Gender Pay Gap (privacy-safe)', { page: 'dei', group: 'g-dei', format: PCT, gradient: ['#F2F2F2', C.ink] }), restrict: ['chro', 'rhrd'], restrictWhy: 'Pay by gender is restricted to the Group CHRO and regional HR directors.' },
  bar('d-age', 'Age profile · headcount by business unit and age band', ['Business Unit', BV], 'DEI Headcount', { page: 'dei', group: 'g-dei', dims2: 'Age Band', dims2View: DEI, stacked: true, legend: true, labels: false, coloring: 'categorical', colors: [C.aqua, C.teal, C.ink, C.mid], format: INT, sort: [{ by: 'd0', direction: 'asc' }] }),
  { ...bar('d-eth', 'UK ethnic-minority representation by level (special-category data · privacy-safe)', ['Seniority', SV], ['Ethnic Minority Representation (privacy-safe)'], { page: 'dei', group: 'g-dei', format: PCT, colors: [C.teal], sort: { by: 'm0', direction: 'desc' }, orientation: 'vertical' }), restrict: ['chro', 'rhrd'], restrictWhy: 'Ethnicity is special-category data (UK GDPR Art. 9). Only the Group CHRO and the UK & Ireland HR director may view it, aggregated and thresholded.' },
  {
    id: 'd-cells', slot: 'd-cells', page: 'dei', title: 'Privacy-thresholded drill · country × department × gender — the semantic layer blanks any cell with fewer than 10 people', type: 'table', group: 'g-dei',
    fitColumns: { c: .12, dp: .18, g: .16, h: .1, a: .11, p: .11, s: .2 },
    dimensions: dims(['Country', 'c', CV], ['Department', 'dp', DV], ['Gender', 'g', DEI]),
    measures: meas(['Headcount (privacy-safe)', 'h'], ['DEI Voluntary Attrition (privacy-safe)', 'a'], ['DEI Promotion Rate (privacy-safe)', 'p'], ['Below Privacy Threshold', 's']),
    sort: [{ by: 'c', direction: 'asc' }], limit: 400, fontSize: 12,
    columnLabels: { c: 'Country', dp: 'Department', g: 'Gender', h: 'Headcount', a: 'Vol. attrition', p: 'Promotion rate', s: 'Privacy rule' },
    ops: [...rowHeight(28), bold('c', C.ink), ...colFormat('h', INT), ...colFormat('a', PCT), ...colFormat('p', PCT), ...colFormat('s', '"Suppressed · n < 10";"";"Shown · n ≥ 10"'), ...right('h', 'a', 'p'), ...bands('s', [-1e9, 0.5], [C.good, C.bad])],
  },

  // ================= Succession & key-person risk (SuccessFactors Succession & Development)
  ...['g-suc'].flatMap((g) => [ctl(g, CV, 'Region'), ctl(g, CV, 'Country'), ctl(g, BV, 'Business Unit'), ctl(g, SV, 'Seniority'), ctl(g, SUC, 'Key Person Risk')]),
  ...kpiCard('c-roles', 'suc', 'g-suc', 'Critical roles in plan', { value: 'Critical Roles', fmt: INT, spark: 'Critical Roles', sparkDim: ['Business Unit', BV], sparkType: 'bar', color: C.ink, note: 'Senior and leadership roles flagged business-critical' }),
  ...kpiCard('c-rn', 'suc', 'g-suc', 'Ready-now coverage', { value: 'Ready-now Coverage', fmt: PCT, py: 'Ready-now Coverage PY', delta: 'Ready-now Coverage vs PY', deltaFmt: SPTS, spark: 'Ready-now Coverage', sparkDim: ['Business Unit', BV], sparkType: 'bar', good: 'up', color: C.teal, note: 'Critical roles with ≥ 1 ready-now successor' }),
  ...kpiCard('c-unc', 'suc', 'g-suc', 'Uncovered at-risk roles', { value: 'Uncovered At-risk Roles', fmt: INT, spark: 'Uncovered At-risk Roles', sparkDim: ['Business Unit', BV], sparkType: 'bar', color: C.red, note: 'High flight risk or retiring, no ready-now cover' }),
  ...kpiCard('c-ns', 'suc', 'g-suc', 'Roles with no successor', { value: 'Roles without Successor Rate', fmt: PCT, py: 'Roles without Successor Rate PY', delta: 'Roles without Successor Rate vs PY', deltaFmt: SPTS, spark: 'Roles without Successor', sparkDim: ['Business Unit', BV], sparkType: 'bar', good: 'down', note: 'No identified successor at any readiness' }),
  ...kpiCard('c-hfr', 'suc', 'g-suc', 'Incumbents at high flight risk', { value: 'High Flight-risk Incumbents Rate', fmt: PCT, py: 'High Flight-risk Incumbents Rate PY', delta: 'High Flight-risk Incumbents Rate vs PY', deltaFmt: SPTS, spark: 'High Flight-risk Incumbents Rate', sparkDim: ['Business Unit', BV], sparkType: 'bar', good: 'down', color: C.amber, note: 'Aggregated model band, never shown per person' }),
  ...kpiCard('c-bench', 'suc', 'g-suc', 'Bench strength', { value: 'Bench Strength', fmt: '0.00', spark: 'Bench Strength', sparkDim: ['Seniority', SV], sparkType: 'bar', color: C.plum, note: 'Identified successors per critical role' }),
  chart('c-matrix', 'Key-person risk matrix · critical roles by risk × impact of loss · click a cell to filter', 'heatMap', [['Key Person Risk', SUC], ['Impact Of Loss', SUC]], ['Critical Roles'], { page: 'suc', group: 'g-suc', gradient: ['#FFFFFF', '#B3C6F6', C.red], legend: true, format: INT }),
  donut('c-status', 'Succession status of critical roles', ['Succession Status', SUC], 'Critical Roles', { page: 'suc', group: 'g-suc', colors: [C.good, C.amber, C.red, C.light] }),
  bar('c-bu', 'Ready-now succession coverage by business unit · now vs a year ago', ['Business Unit', BV], ['Ready-now Coverage PY', 'Ready-now Coverage'], { page: 'suc', group: 'g-suc', format: [PCT, PCT], grouped: true, legend: true, labels: false, hideMeasureAxis: false, measureColors: { m0: C.light, m1: C.teal }, sort: { by: 'm1', direction: 'asc' } }),
  bar('c-pipe', 'Successor pipeline by business unit · ready now, 1–2 years, 3+ years', ['Business Unit', BV], ['Ready-now Successors', 'Successors Ready in 1–2 Years', 'Successors Ready in 3+ Years'], { page: 'suc', group: 'g-suc', format: [INT, INT, INT], stacked: true, legend: true, labels: false, measureColors: { m0: C.teal, m1: C.aqua, m2: C.light }, sort: { by: 'm0', direction: 'desc' } }),
  chart('c-heat', 'Ready-now coverage · country × business unit', 'heatMap', [['Country', CV], ['Business Unit', BV]], ['Ready-now Coverage'], { page: 'suc', group: 'g-suc', gradient: [C.red, '#FFFFFF', C.teal], legend: true, format: PCT }),
  bar('c-wom', 'Diverse succession · critical roles with a woman successor', ['Business Unit', BV], 'Roles with a Woman Successor', { page: 'suc', group: 'g-suc', format: PCT, colors: [C.plum] }),
  {
    id: 'c-table', slot: 'c-table', page: 'suc', title: 'Critical-role succession register · roles, not people — no incumbent or successor names leave SuccessFactors', type: 'table', group: 'g-suc',
    fitColumns: { id: .07, r: .2, c: .1, dp: .12, f: .08, st: .12, k: .08, n: .07, o: .07, u: .08 },
    dimensions: dims(['Role Id', 'id', SUC], ['Role Title', 'r', SUC], ['Country', 'c', CV], ['Department', 'dp', DV], ['Incumbent Flight Risk', 'f', SUC], ['Succession Status', 'st', SUC], ['Key Person Risk', 'k', SUC]),
    filters: [{ view: SUC, field: 'Snapshot', values: ['Current'] }],
    measures: meas(['Ready-now Successors', 'n'], ['Successors Ready in 1–2 Years', 'o'], ['Uncovered At-risk Roles', 'u']),
    sort: [{ by: 'u', direction: 'desc' }], limit: 500, fontSize: 12,
    columnLabels: { id: 'Role', r: 'Critical role', c: 'Country', dp: 'Department', f: 'Flight risk', st: 'Succession', k: 'Key-person risk', n: 'Ready now', o: '1–2 yrs', u: 'Uncovered' },
    ops: [...rowHeight(28), bold('r', C.ink), ...colFormat('n', INT), ...colFormat('o', INT), ...colFormat('u', '"At risk";"";"—"'), ...right('n', 'o'), ...bands('n', [-1e9, 0.5], [C.bad, C.good]), ...bands('u', [-1e9, 0.5], [C.good, C.bad])],
  },

  // ================= Data operations: integration monitoring, refresh status and error management (not persona-scoped)
  ...[ctl('g-ops', PRN, 'Stage'), ctl('g-ops', PRN, 'Source System'), ctl('g-ops', PRN, 'Status')],
  ...[
    ...kpiCard('o-sr', 'ops', 'g-ops', 'Clean run rate · 7 days', { value: 'Run Success Rate 7d', fmt: PCT, spark: 'Run Success Rate', sparkDim: ['Run Day', PRN], good: 'up', color: C.good, note: 'Runs without errors or warnings · by day' }),
    ...kpiCard('o-fail', 'ops', 'g-ops', 'Failed runs today', { value: 'Failed Runs Today', fmt: INT, spark: 'Failed Runs', sparkDim: ['Run Day', PRN], color: C.red, note: '30 Sep 2026 · failures by day' }),
    ...kpiCard('o-sla', 'ops', 'g-ops', 'Pipeline SLA attainment', { value: 'Pipeline SLA Attainment', fmt: PCT, spark: 'Pipeline SLA Attainment', sparkDim: ['Run Day', PRN], color: C.teal, note: 'Runs finished within SLA · September' }),
    ...kpiCard('o-rows', 'ops', 'g-ops', 'Rows loaded · September', { value: 'Rows Loaded', fmt: '#,##0.0,,"m"', spark: 'Rows Loaded', sparkDim: ['Run Day', PRN], color: C.ink, note: 'Into the cloud data lake / BigQuery' }),
    ...kpiCard('o-open', 'ops', 'g-ops', 'Open data issues', { value: 'Open Data Issues', fmt: INT, spark: 'Open Data Issues', sparkDim: ['Severity', DQI], sparkType: 'bar', color: C.amber, note: 'Open or in progress · bars by severity' }),
    ...kpiCard('o-high', 'ops', 'g-ops', 'Open critical / high issues', { value: 'Open High-severity Issues', fmt: INT, spark: 'Data Issues', sparkDim: ['Category', DQI], sparkType: 'bar', color: C.red, note: 'All issues this month · bars by category' }),
    {
      id: 'o-pipes', slot: 'o-pipes', page: 'ops', title: 'Integration status board · every feed from source to the semantic layer', type: 'table', group: 'g-ops',
      fitColumns: { st: .13, s: .15, p: .17, ft: .07, sr: .08, sla: .08, m: .07, r: .09, rr: .07, sp: .09 },
      dimensions: dims(['Stage', 'st', PRN], ['Source System', 's', PRN], ['Pipeline', 'p', PRN]),
      measures: meas(['Failed Runs Today', 'ft'], ['Run Success Rate 7d', 'sr'], ['Pipeline SLA Attainment', 'sla'], ['Average Run Minutes', 'm'], ['Rows Loaded', 'r'], ['Reject Rate', 'rr'], ['Run Success Rate', 'sp']),
      miniChart: { ref: 'sp', view: PRN, field: 'Run Day', color: C.good }, sort: [{ by: 'ft', direction: 'desc' }], limit: 30, fontSize: 12,
      columnLabels: { st: 'Stage', s: 'Source system', p: 'Pipeline', ft: 'Failed today', sr: 'Clean · 7d', sla: 'SLA', m: 'Avg run', r: 'Rows', rr: 'Rejects', sp: 'Clean runs · 30 days' },
      ops: [...rowHeight(30), bold('p', C.ink), ...colFormat('ft', '0;;"✓"'), ...colFormat('sr', PCT0), ...colFormat('sla', PCT0), ...colFormat('m', '0.0" min"'), ...colFormat('r', '#,##0.0,,"m"'), ...colFormat('rr', '0.00%'), ...right('ft', 'sr', 'sla', 'm', 'r', 'rr'),
        ...bands('ft', [-1e9, 0.5], [C.good, C.bad]), ...bands('sr', [-1e9, 0.8, 0.95], [C.bad, C.amber, C.good]), ...bands('sla', [-1e9, 0.9, 0.98], [C.bad, C.amber, C.good]), ...bands('rr', [-1e9, 0.005, 0.02], [C.good, C.amber, C.bad])],
    },
    bar('o-daily', 'Pipeline runs per day by outcome · September 2026', ['Run Day', PRN], 'Pipeline Runs', { page: 'ops', group: 'g-ops', dims2: 'Status', dims2View: PRN, stacked: true, legend: true, labels: false, coloring: 'categorical', colors: [C.bad, C.good, C.amber], format: INT, orientation: 'vertical', sort: [{ by: 'd0', direction: 'asc' }], limit: 200 }),
    bar('o-cat', 'Data issues by category and status', ['Category', DQI], 'Data Issues', { page: 'ops', group: 'g-ops', dims2: 'Status', dims2View: DQI, stacked: true, legend: true, labels: false, coloring: 'categorical', colors: [C.amber, C.red, C.good], format: INT }),
    bar('o-mttr', 'Mean time to resolve by severity · hours', ['Severity', DQI], 'Average Hours to Resolve', { page: 'ops', group: 'g-ops', format: '0.0" h"', colors: [C.ink] }),
    {
      id: 'o-err', slot: 'o-err', page: 'ops', title: 'Error log · failed and warning runs with the engine’s error detail', type: 'table', group: 'g-ops',
      fitColumns: { t: .11, p: .17, s: .12, c: .1, e: .36, r: .06, rr: .07 },
      dimensions: dims(['Started At', 't', PRN], ['Pipeline', 'p', PRN], ['Status', 's', PRN], ['Error Code', 'c', PRN], ['Error Message', 'e', PRN]),
      filters: [{ view: PRN, field: 'Status', values: ['Failed', 'Succeeded with warnings'] }],
      measures: meas(['Pipeline Retries', 'r'], ['Rows Rejected', 'rr']), sort: [{ by: 't', direction: 'desc' }], limit: 100, fontSize: 12,
      columnLabels: { t: 'Started', p: 'Pipeline', s: 'Outcome', c: 'Code', e: 'Detail', r: 'Retries', rr: 'Rows rejected' },
      ops: [...rowHeight(28), bold('p', C.ink), ...colFormat('r', INT), ...colFormat('rr', INT), ...right('r', 'rr')],
    },
    {
      id: 'o-issues', slot: 'o-issues', page: 'ops', title: 'Data issue register · severity, owner, SLA and impacted KPI', type: 'table', group: 'g-ops',
      fitColumns: { id: .07, o: .1, sv: .07, c: .1, p: .15, k: .14, w: .13, s: .08, ra: .08, a: .06 },
      dimensions: dims(['Issue Id', 'id', DQI], ['Opened At', 'o', DQI], ['Severity', 'sv', DQI], ['Category', 'c', DQI], ['Pipeline', 'p', DQI], ['Impacted Kpi', 'k', DQI], ['Owner', 'w', DQI], ['Status', 's', DQI]),
      measures: meas(['Records Affected', 'ra'], ['Issue Age Hours', 'a']), sort: [{ by: 'o', direction: 'desc' }], limit: 100, fontSize: 12,
      columnLabels: { id: 'Issue', o: 'Opened', sv: 'Severity', c: 'Category', p: 'Pipeline', k: 'Impacted KPI', w: 'Owner', s: 'Status', ra: 'Records', a: 'Age' },
      ops: [...rowHeight(28), bold('id', C.ink), ...colFormat('ra', INT), ...colFormat('a', '#,##0" h"'), ...right('ra', 'a')],
    },
  ].map((t) => ({ ...t, scope: 'none' })),
];

/** Tile id → the stored business question that backs it (tools/chart-questions.mjs commits them). */
const lowerFirst = (s) => s.replace(/ · .*$/, '').replace(/^([A-Z])(?=[a-z ])/, (c) => c.toLowerCase());
const TABLE_QUESTIONS = {
  'x-table': 'How does each country, business unit and department score on headcount, attrition, mobility, absence, engagement and cost?',
  't-table': 'Which country and business unit segments show the fastest-rising attrition?',
  's-table': 'What is the full skills inventory, from coverage today to the 2028 gap and the internal pool?',
  'x-map': 'Where is our workforce located?',
  't-matrix': 'Which business units combine high attrition with high business criticality?',
  't-matrix2': 'Which departments have rising attrition in critical roles?',
  't-pay': 'How does compa-ratio relate to voluntary attrition?',
  'x-org': 'How is the organisation structured from business unit to seniority?',
  's-sankey': 'Which current skills are adjacent to future-critical skills?',
  'h-scorecard': 'How does each business unit score across retention, engagement, cost, skills and hiring?',
  'h-hot': 'Where is rising attrition costing most, by country and business unit?',
  'x-monthly': 'What is the monthly people report: movements, attrition, absence, engagement and cost?',
  't-exits': 'Why did voluntary leavers leave in the last twelve months, and at what cost?',
  's-reqtbl': 'How are open critical roles being filled, by skill?',
  'a-log': 'Which workflow events have been written back from the app?',
  's-saved': 'Which workforce scenarios have been saved, and what do they project?',
  't-seg': 'How does attrition vary by region, function, level and employee segment?',
  't-seg2': 'How does attrition vary by age band and gender?',
  'd-pipe': 'How does women’s representation change from junior to leadership levels?',
  'd-heat': 'Where is women’s representation lowest, by business unit and level?',
  'd-attg': 'Do women and men leave at different rates at each level?',
  'd-prom': 'Do women receive their fair share of promotions?',
  'd-pay': 'What is the gender pay gap by business unit?',
  'd-eth': 'How well are ethnic minorities represented at each level in the UK?',
  'd-age': 'What is the age profile of each business unit?',
  'd-cells': 'Which country, department and gender groups are below the privacy threshold?',
  'c-matrix': 'Where is key-person risk highest relative to the impact of losing the role?',
  'c-heat': 'Where is ready-now succession coverage weakest, by country and business unit?',
  'c-wom': 'How many critical roles have a woman in the succession pipeline?',
  'c-table': 'Which critical roles are at risk and how well are they covered?',
  'o-pipes': 'What is the status of every integration feed?',
  'o-daily': 'How did pipeline runs succeed or fail each day?',
  'o-cat': 'What kinds of data issues are we seeing and how many are resolved?',
  'o-mttr': 'How quickly are data issues resolved, by severity?',
  'o-err': 'Which pipeline runs failed or warned, and why?',
  'o-issues': 'Which data issues are open, who owns them and what do they affect?',
};
export const questionOf = (tile) => {
  if (TABLE_QUESTIONS[tile.id]) return TABLE_QUESTIONS[tile.id];
  const base = tile.id.replace(/-(sp|d)$/, '');
  const label = KPIS[base]?.label;
  if (label && tile.id.endsWith('-sp')) return `How has ${lowerFirst(label)} trended?`.replace(/ · [^?]*\?/, '?');
  if (label && tile.id.endsWith('-d')) return `How does ${lowerFirst(label)} compare with the prior period?`.replace(/ · [^ ]* /, ' ');
  if (label) return `What is the ${lowerFirst(label)}?`;
  return `What is the ${lowerFirst(tile.title)}?`;
};
