/** Native Astrato objects of Private Markets Portfolio OS, declared once (pure data). */
export const C = { navy: '#14283A', ink: '#1B2433', blue: '#4F7CAC', teal: '#4E9A8E', sky: '#8FB3D9', sand: '#C8B88A', grey: '#7A8494', red: '#B5473A', green: '#2E7D5B', gold: '#B8892E', plum: '#5B4B8A', mist: '#EEF0F3' };
export const SERIES = [C.navy, C.teal, C.blue, C.sand, C.plum, C.grey, C.sky, C.gold];
export const PLAIN = { formatType: 'none' };
const NUM = { formatType: 'numberNoDecimal' };
const USD = '$#,##0.0"m"', USD0 = '$#,##0"m"', PCT = '0.0%', SPCT = '+0.0%;-0.0%;0.0%', MULT = '0.0"x"', SMULT = '+0.0"x";-0.0"x";0.0"x"', INT = '#,##0', MOIC = '0.00"x"';
export const FMT = { USD, USD0, PCT, SPCT, MULT, SMULT, INT, MOIC };

const colFormat = (ref, formatString) => [{ name: 'setColumnFormatType', ref, payload: { formatType: 'custom' } }, { name: 'setColumnFormatString', ref, payload: { formatString } }];
const measFormat = (ref, formatString) => [{ name: 'setMeasureFormatType', ref, payload: { formatType: 'custom' } }, { name: 'setMeasureFormatString', ref, payload: { formatString } }];
const right = (...refs) => refs.map((ref) => ({ name: 'setColumnHorizontalAlign', ref, payload: { horizontalAlign: 'right' } }));
const rowHeight = (h) => [{ name: 'setTableFixedRowHeightEnabled', payload: true }, { name: 'setTableFixedRowHeightValue', payload: h }];
const bold = (ref, color) => ({ name: 'setColumnFontStyle', ref, payload: { fontStyle: { weight: 700, ...(color ? { color } : {}) } } });
const bands = (ref, cuts, colors) => [
  { name: 'setColumnRepresentation', ref, payload: { representation: 'indicator' } },
  ...cuts.flatMap((_, segmentIndex) => [
    { name: 'addColumnIndicatorSegment', ref, payload: {} },
    { name: 'setColumnIndicatorSegmentValue', ref, payload: { segmentIndex, value: cuts[segmentIndex + 1] ?? 1e15 } },
    { name: 'setColumnIndicatorSegmentColor', ref, payload: { segmentIndex, color: colors[segmentIndex] } },
  ]),
  { name: 'setColumnIndicatorColorText', ref, payload: { colorText: true } },
];
const perMeasure = (map) => [{ name: 'setColoringType', payload: 'perEachMeasure' }, ...Object.entries(map).map(([ref, graphColor]) => ({ name: 'setMeasureGraphColor', ref, payload: { graphColor } }))];
const secondary = (ref) => ({ name: 'changeMeasureAxis', ref, payload: { secondaryAxis: true } });

const CO = 'Companies', FI = 'Financials', VA = 'Valuations', IN = 'Initiatives', IQ = 'Initiative Quarters', DB = 'Debt Facilities', KP = 'Operating KPIs', WR = 'Workflow Records', WE = 'Audit Events';
const dims = (...cols) => cols.map(([name, ref, view]) => ({ view, name, ref }));
const meas = (...list) => list.map((m, i) => (typeof m === 'string' ? { name: m, ref: `m${i}`, format: NUM } : { name: m[0], ref: m[1] ?? `m${i}`, format: NUM, ...(m[2] ? { view: m[2], aggregation: m[3] } : {}) }));

const bar = (id, page, title, [dimName, view], measures, { sort = { by: 'm0', direction: 'desc' }, limit = 40, colors, format = USD, formats, orientation = 'horizontal', legend = false, labels = true, filters, measureColors, stacked = false, grouped = false, extraOps = [] } = {}) => ({
  id, slot: id, page, title, type: 'bar', group: `g-${page}`, orientation, filters,
  dimensions: dims([dimName, 'd0', view]), measures: meas(...[].concat(measures)),
  sort, limit, colors: measureColors ? undefined : colors ?? [C.navy], legend, legendPosition: legend ? 'top' : undefined, stacked, grouped, barPadding: 30,
  hideMeasureAxis: labels && [].concat(measures).length === 1,
  ...(labels && [].concat(measures).length === 1 ? { dataLabels: { size: 10, format, backdrop: '#FFFFFF' } } : {}),
  ops: [...(measureColors ? perMeasure(measureColors) : []), ...[].concat(measures).flatMap((_, i) => measFormat(`m${i}`, formats?.[i] ?? format)), ...extraOps],
});
const chart = (id, page, title, type, dimList, measList, { sort, limit = 200, formats = [], filters, extraOps = [], ...rest } = {}) => ({
  id, slot: id, page, title, type, group: `g-${page}`, filters,
  dimensions: dims(...dimList.map(([n, v], i) => [n, `d${i}`, v])), measures: meas(...measList),
  ...(sort ? { sort } : {}), limit, ...rest,
  ops: [...formats.flatMap((f, i) => (f ? measFormat(`m${i}`, f) : [])), ...extraOps],
});
const donut = (id, page, title, [dimName, view], measure) => ({ id, slot: id, page, title, type: 'pie', group: `g-${page}`, donut: true, legend: true, sliceLabels: 'percentage', coloring: 'categorical', dimensions: dims([dimName, 'd0', view]), measures: meas(measure), sort: { by: 'm0', direction: 'desc' }, limit: 12, colors: SERIES });
/** A native table; cols = [[measure, format, label?]]; spark = { measure, view, field } → line mini-chart column. */
const table = (id, page, title, dimList, cols, { sort, limit = 200, filters, spark, fit, labels = {}, extraOps = [] } = {}) => {
  const ms = cols.map(([m, , , view, aggregation], i) => ({ name: m, ref: `m${i}`, format: NUM, ...(view ? { view, aggregation } : {}) }));
  if (spark) ms.push({ name: spark.measure, ref: 'sp', format: NUM });
  return {
    id, slot: id, page, title, type: 'table', group: `g-${page}`, filters, fontSize: 12,
    dimensions: dimList.map(([n, v, ref], i) => ({ name: n, view: v, ref: ref ?? `d${i}` })), measures: ms,
    ...(sort ? { sort } : {}), limit,
    columnLabels: { ...Object.fromEntries(dimList.map(([n, , ref, label], i) => [ref ?? `d${i}`, label ?? n])), ...Object.fromEntries(cols.map(([m, , label], i) => [`m${i}`, label ?? m])), ...(spark ? { sp: spark.label ?? `${spark.measure} trend` } : {}), ...labels },
    ...(spark ? { miniChart: { ref: 'sp', view: spark.view, field: spark.field, color: C.teal } } : {}),
    fitColumns: fit,
    ops: [...rowHeight(30), ...cols.flatMap(([, f], i) => [...colFormat(`m${i}`, f), ...right(`m${i}`)]), ...(spark ? colFormat('sp', cols[0]?.[1] ?? USD) : []), ...extraOps],
  };
};
const ctl = (page, view, name, label = name) => ({ id: `ctl-${page}-${name}`.toLowerCase().replace(/[^a-z0-9-]+/g, '-'), page, title: label, type: 'filter', group: `g-${page}`, field: { view, name }, presentation: { mode: 'dropdown', quickSelect: false, responsive: false, searchable: true, showProgressBar: false } });

/** KPI card = number + mini-chart of its quarterly trend + one-row prior-period comparison (green when it moved the right way). */
export const KPIS = {};
const kpiCard = (id, page, label, { value, fmt, py, delta, deltaFmt = SPCT, deltaLabel = 'vs PY', pyLabel = 'PY ', spark, sparkView = FI, sparkField = 'Quarter', sparkType = 'line', good = 'up', color = C.navy, view = FI }) => {
  KPIS[id] = { label, view, page };
  const [lo, hi] = good === 'up' ? [C.red, C.green] : [C.green, C.red];
  return [
    { id, slot: id, page, title: label, type: 'number', group: `g-${page}`, measures: meas(value), ops: measFormat('m0', fmt) },
    sparkType === 'line'
      ? { id: `${id}-sp`, slot: `${id}-sp`, page, title: `${label} trend`, type: 'line', group: `g-${page}`, sparkline: true, dimensions: dims([sparkField, 'd0', sparkView]), measures: meas(spark), sort: [{ by: 'd0', direction: 'asc' }], limit: 40, legend: false, colors: [color], lineCurve: 'curve' }
      : { id: `${id}-sp`, slot: `${id}-sp`, page, title: `${label} trend`, type: 'bar', group: `g-${page}`, orientation: 'vertical', dimensions: dims([sparkField, 'd0', sparkView]), measures: meas(spark), sort: { by: 'd0', direction: 'asc' }, limit: 40, colors: [color], barPadding: 20, hideMeasureAxis: true, hideDimensionAxis: true, legend: false },
    {
      id: `${id}-d`, slot: `${id}-d`, page, title: `${label} vs prior period`, type: 'table', group: `g-${page}`, fontSize: 11, headerHidden: true, fitColumns: { p: 0.5, c: 0.5 },
      dimensions: [], measures: meas([py, 'p'], [delta, 'c']), columnLabels: { p: 'Prior', c: deltaLabel },
      ops: [...rowHeight(22), ...colFormat('p', `"${pyLabel}"${fmt}`), ...colFormat('c', deltaFmt.split(';').map((f) => `${f}" ${deltaLabel}"`).join(';')), ...right('c'), ...bands('c', [-1e12, 0], [lo, hi])],
    },
  ];
};

export const tileCatalogue = () => [
  // ------------------------------------------------ Portfolio command centre (g-portfolio)
  ctl('portfolio', CO, 'Fund'), ctl('portfolio', CO, 'Sector'), ctl('portfolio', CO, 'Region'), ctl('portfolio', CO, 'Risk Class', 'Risk class'), ctl('portfolio', CO, 'Stage', 'Investment stage'), ctl('portfolio', CO, 'Company'),
  ...kpiCard('k-fv', 'portfolio', 'Approved fair value', { value: 'Fair Value', fmt: USD0, py: 'Prior Fair Value', delta: 'Valuation Movement %', deltaLabel: 'QoQ', pyLabel: 'Prior ', spark: 'Fair Value at Quarter', sparkView: VA, view: VA }),
  ...kpiCard('k-rev', 'portfolio', 'Revenue (LTM)', { value: 'Revenue LTM', fmt: USD0, py: 'Revenue PLTM', delta: 'Revenue Growth', spark: 'Revenue', color: C.blue }),
  ...kpiCard('k-ebitda', 'portfolio', 'EBITDA (LTM)', { value: 'EBITDA LTM', fmt: USD0, py: 'EBITDA PLTM', delta: 'EBITDA Growth', spark: 'EBITDA', color: C.teal }),
  ...kpiCard('k-margin', 'portfolio', 'EBITDA margin (LTM)', { value: 'EBITDA Margin LTM', fmt: PCT, py: 'EBITDA Margin PLTM', delta: 'EBITDA Margin Change', deltaFmt: SPCT, deltaLabel: 'pts', spark: 'EBITDA Margin', color: C.teal }),
  ...kpiCard('k-lev', 'portfolio', 'Net leverage', { value: 'Net Leverage', fmt: MULT, py: 'Net Leverage PY', delta: 'Net Leverage Change', deltaFmt: SMULT, deltaLabel: 'YoY', good: 'down', spark: 'Free Cash Flow', sparkType: 'bar', color: C.grey }),
  ...kpiCard('k-conv', 'portfolio', 'Cash conversion (LTM)', { value: 'Cash Conversion', fmt: PCT, py: 'Cash Conversion PY', delta: 'Cash Conversion Change', deltaLabel: 'pts', spark: 'Free Cash Flow', sparkType: 'bar', color: C.blue }),
  table('p-table', 'portfolio', 'Investment register · approved valuations, Q3 2026', [['Company', CO], ['Fund', CO, 'fd'], ['Risk Class', CO, 'rk', 'Risk']],
    [['Invested Capital', USD0, 'Invested'], ['Fair Value', USD0, 'Fair value'], ['Gross MOIC', MOIC, 'MOIC'], ['Gross IRR', PCT, 'IRR'], ['Revenue Growth', SPCT, 'Rev. growth'], ['EBITDA Margin LTM', PCT, 'Margin'], ['Net Leverage', MULT, 'Net lev.'], ['Budget Variance Latest Quarter', SPCT, 'vs budget'], ['Valuation Movement', '+$#,##0.0"m";-$#,##0.0"m";–', 'Val. move']],
    { sort: { by: 'm1', direction: 'desc' }, spark: { measure: 'Revenue', view: FI, field: 'Quarter', label: 'Revenue, 12Q' },
      fit: { d0: 0.18, fd: 0.055, rk: 0.065, m0: 0.07, m1: 0.08, m2: 0.06, m3: 0.06, m4: 0.075, m5: 0.065, m6: 0.065, m7: 0.075, m8: 0.08, sp: 0.085 },
      extraOps: [bold('d0', C.navy), ...bands('m7', [-1e12, -0.02, 0.02], [C.red, C.ink, C.green]), ...bands('m8', [-1e12, 0], [C.red, C.green]), ...bands('m6', [-1e12, 5.0, 6.0], [C.ink, C.gold, C.red]), ...bands('m4', [-1e12, 0], [C.red, C.ink])] }),
  bar('p-fund', 'portfolio', 'Invested capital vs fair value by fund', ['Fund', CO], ['Invested Capital', 'Fair Value', 'Realised Proceeds'], { orientation: 'vertical', legend: true, labels: false, measureColors: { m0: C.sky, m1: C.navy, m2: C.teal }, sort: { by: 'd0', direction: 'asc' }, grouped: true }),
  bar('p-contrib', 'portfolio', 'Contributors and detractors · approved valuation movement', ['Company', CO], 'Valuation Movement', { colors: [C.teal], limit: 36, format: '+$#,##0"m";-$#,##0"m"' }),
  donut('p-sector', 'portfolio', 'Concentration by sector (fair value)', ['Sector', CO], 'Fair Value'),
  donut('p-geo', 'portfolio', 'Concentration by country (fair value)', ['Country', CO], 'Fair Value'),
  bar('p-uw', 'portfolio', 'LTM EBITDA vs original underwriting', ['Company', CO], 'EBITDA vs Underwriting', { sort: { by: 'm0', direction: 'asc' }, limit: 36, format: SPCT, colors: [C.blue] }),
  chart('p-risk', 'portfolio', 'Leverage vs interest cover', 'scatter', [['Company', CO]], ['Net Leverage', 'Interest Coverage'], { formats: [MULT, MULT], colors: [C.navy], pointSize: 9 }),

  // ------------------------------------------------ Company workspace (g-company: one Company selected programmatically)
  chart('c-rev', 'company', 'Revenue vs budget and underwriting (quarterly)', 'line', [['Quarter', FI]], ['Revenue', 'Budget Revenue', 'Underwriting Revenue'], { sort: [{ by: 'd0', direction: 'asc' }], formats: [USD, USD, USD], legend: true, legendPosition: 'top', colors: [C.navy, C.sand, C.teal] }),
  chart('c-ebitda', 'company', 'EBITDA vs budget and underwriting', 'line', [['Quarter', FI]], ['EBITDA', 'Budget EBITDA', 'Underwriting EBITDA'], { sort: [{ by: 'd0', direction: 'asc' }], formats: [USD, USD, USD], legend: true, legendPosition: 'top', colors: [C.navy, C.sand, C.teal] }),
  chart('c-margin', 'company', 'Gross and EBITDA margin', 'line', [['Quarter', FI]], ['EBITDA Margin', 'Gross Margin'], { sort: [{ by: 'd0', direction: 'asc' }], formats: [PCT, PCT], legend: true, legendPosition: 'top', colors: [C.teal, C.sky], extraOps: [secondary('m1')] }),
  chart('c-kpi', 'company', 'Monthly revenue and headcount (operating KPIs)', 'combo', [['Month', KP]], ['Monthly Revenue', 'Monthly Headcount'], { sort: [{ by: 'd0', direction: 'asc' }], formats: [USD, INT], legend: true, legendPosition: 'top', colors: [C.navy, C.sand], graphTypes: { m0: 'bar', m1: 'line' }, extraOps: [secondary('m1')] }),
  chart('c-val', 'company', 'Fair value by valuation quarter', 'bar', [['Quarter', VA]], ['Fair Value at Quarter'], { sort: { by: 'd0', direction: 'asc' }, formats: [USD], colors: [C.navy], orientation: 'vertical', dataLabels: { size: 10, format: USD, backdrop: '#FFFFFF' }, hideMeasureAxis: true }),
  table('c-debt', 'company', 'Capital structure · debt facilities', [['Facility', DB], ['Base Rate', DB, 'br', 'Base'], ['Lender', DB, 'ln'], ['Maturity', DB, 'mt']], [['Facility Commitments', USD, 'Commitment'], ['Drawn Debt', USD, 'Drawn'], ['Undrawn Facilities', USD, 'Undrawn'], ['Covenant Max Leverage', MULT, 'Covenant']], { fit: { d0: 0.2, br: 0.08, ln: 0.25, mt: 0.11, m0: 0.09, m1: 0.09, m2: 0.09, m3: 0.08 } }),

  // ------------------------------------------------ Financial analysis (g-analysis)
  ctl('analysis', CO, 'Fund'), ctl('analysis', CO, 'Sector'), ctl('analysis', CO, 'Company'), ctl('analysis', FI, 'Quarter'),
  bar('f-growth', 'analysis', 'Revenue vs EBITDA growth (LTM)', ['Company', CO], ['Revenue Growth', 'EBITDA Growth'], { labels: false, legend: true, format: SPCT, measureColors: { m0: C.sky, m1: C.navy }, sort: { by: 'm1', direction: 'asc' }, grouped: true }),
  bar('f-margin', 'analysis', 'EBITDA margin change, LTM vs prior LTM', ['Company', CO], 'EBITDA Margin Change', { sort: { by: 'm0', direction: 'asc' }, format: SPCT, colors: [C.teal] }),
  chart('f-lev', 'analysis', 'Net leverage vs interest cover (Q3 2026)', 'scatter', [['Company', CO]], ['Net Leverage', 'Interest Coverage'], { formats: [MULT, MULT], colors: [C.navy], pointSize: 9 }),
  chart('f-conv', 'analysis', 'Revenue growth vs change in cash conversion', 'scatter', [['Company', CO]], ['Revenue Growth', 'Cash Conversion Change'], { formats: [SPCT, SPCT], colors: [C.teal], pointSize: 9 }),
  bar('f-budget', 'analysis', 'Q3 2026 revenue vs budget', ['Company', CO], 'Budget Variance Latest Quarter', { sort: { by: 'm0', direction: 'asc' }, format: SPCT, colors: [C.sand] }),
  chart('f-trend', 'analysis', 'Portfolio revenue, budget and underwriting (quarterly)', 'line', [['Quarter', FI]], ['Revenue', 'Budget Revenue', 'Underwriting Revenue'], { sort: [{ by: 'd0', direction: 'asc' }], formats: [USD0, USD0, USD0], legend: true, legendPosition: 'top', colors: [C.navy, C.sand, C.teal] }),
  table('f-liq', 'analysis', 'Leverage, coverage and liquidity runway', [['Company', CO]], [['Net Leverage', MULT, 'Net lev.'], ['Net Leverage Change', SMULT, 'YoY'], ['Interest Coverage', MULT, 'Cover'], ['Interest Coverage +100bp', MULT, 'Cover +100bp'], ['Cash', USD, 'Cash'], ['Undrawn Facilities', USD, 'Undrawn'], ['Liquidity', USD, 'Liquidity'], ['Free Cash Flow LTM', USD, 'FCF LTM']],
    { sort: { by: 'm0', direction: 'desc' }, spark: { measure: 'Free Cash Flow', view: FI, field: 'Quarter', label: 'FCF, 12Q' }, fit: { d0: 0.2, m0: 0.08, m1: 0.08, m2: 0.08, m3: 0.09, m4: 0.08, m5: 0.08, m6: 0.09, m7: 0.09, sp: 0.12 },
      extraOps: [bold('d0', C.navy), ...bands('m3', [-1e12, 1.5, 2.0], [C.red, C.gold, C.ink]), ...bands('m1', [-1e12, 0], [C.green, C.red])] }),
  table('f-fcst', 'analysis', 'Forecast accuracy · actual vs rolling forecast (12 quarters)', [['Company', CO]], [['Revenue', USD, 'Revenue'], ['Forecast Revenue', USD, 'Forecast'], ['Forecast Accuracy', SPCT, 'Rev. vs fcst'], ['EBITDA Forecast Accuracy', SPCT, 'EBITDA vs fcst'], ['Budget Variance', SPCT, 'Rev. vs budget']],
    { sort: { by: 'm3', direction: 'asc' }, spark: { measure: 'EBITDA', view: FI, field: 'Quarter', label: 'EBITDA, 12Q' }, fit: { d0: 0.24, m0: 0.12, m1: 0.12, m2: 0.11, m3: 0.11, m4: 0.12, sp: 0.16 }, extraOps: [bold('d0', C.navy), ...bands('m3', [-1e12, -0.03, 0.03], [C.red, C.ink, C.green])] }),

  // ------------------------------------------------ Valuations (g-valuations)
  ctl('valuations', CO, 'Fund'), ctl('valuations', VA, 'Status', 'Valuation status'), ctl('valuations', VA, 'Method', 'Method'),
  table('v-register', 'valuations', 'Q3 2026 valuation register', [['Company', CO], ['Status', VA, 'st', 'Status'], ['Method', VA, 'mt']], [['Proposed Fair Value Q3', USD, 'Q3 fair value'], ['Q3 Valuation Movement', '+$#,##0.0"m";-$#,##0.0"m";–', 'Movement'], ['Valuation Multiple', '0.0"x"', 'Multiple'], ['Entry Multiple', MULT, 'Entry'], ['DCF Enterprise Value', USD0, 'DCF EV (x-check)']],
    { filters: [{ view: VA, field: 'Quarter', values: ['2026-Q3'] }], sort: { by: 'm1', direction: 'asc' }, spark: { measure: 'Fair Value at Quarter', view: VA, field: 'Quarter', label: 'FV, 4Q' }, fit: { d0: 0.22, st: 0.1, mt: 0.09, m0: 0.1, m1: 0.1, m2: 0.07, m3: 0.07, m4: 0.11, sp: 0.12 }, extraOps: [bold('d0', C.navy), ...bands('m1', [-1e12, 0], [C.red, C.green])] }),
  chart('v-hist', 'valuations', 'Portfolio fair value by review quarter', 'bar', [['Quarter', VA]], ['Fair Value at Quarter'], { sort: { by: 'd0', direction: 'asc' }, formats: [USD0], colors: [C.navy], orientation: 'vertical', dataLabels: { size: 10, format: USD0, backdrop: '#FFFFFF' }, hideMeasureAxis: true }),
  bar('v-move', 'valuations', 'Q3 2026 proposed movement by investment', ['Company', CO], 'Q3 Valuation Movement', { sort: { by: 'm0', direction: 'asc' }, limit: 36, format: '+$#,##0"m";-$#,##0"m"', colors: [C.blue] }),

  // ------------------------------------------------ Value creation (g-value)
  ctl('value', CO, 'Fund'), ctl('value', CO, 'Company'), ctl('value', IN, 'Initiative Type', 'Initiative type'), ctl('value', IN, 'Status', 'Status'), ctl('value', IN, 'Rag', 'RAG'),
  ...kpiCard('k-vc-real', 'value', 'Realised EBITDA impact', { value: 'Realised EBITDA Impact', fmt: USD, py: 'Planned EBITDA Impact', delta: 'Benefit Realisation', deltaFmt: '0%', deltaLabel: 'of plan', pyLabel: 'Plan ', spark: 'Realised EBITDA Impact', sparkView: IQ, sparkType: 'bar', color: C.teal, view: IQ }),
  { id: 'k-vc-est', slot: 'k-vc-est', page: 'value', title: 'Run-rate EBITDA in business cases', type: 'number', group: 'g-value', measures: meas('Estimated EBITDA Impact'), ops: measFormat('m0', USD) },
  { id: 'k-vc-n', slot: 'k-vc-n', page: 'value', title: 'Initiatives', type: 'number', group: 'g-value', measures: meas('Initiatives'), ops: measFormat('m0', INT) },
  { id: 'k-vc-cost', slot: 'k-vc-cost', page: 'value', title: 'Implementation cost', type: 'number', group: 'g-value', measures: meas('Implementation Cost'), ops: measFormat('m0', USD) },
  chart('vc-q', 'value', 'Planned vs realised EBITDA impact by quarter', 'line', [['Quarter', IQ]], ['Planned EBITDA Impact', 'Realised EBITDA Impact'], { sort: [{ by: 'd0', direction: 'asc' }], formats: [USD, USD], legend: true, legendPosition: 'top', colors: [C.sand, C.teal] }),
  bar('vc-type', 'value', 'Run-rate vs realised by initiative type', ['Initiative Type', IN], ['Estimated EBITDA Impact', 'Realised EBITDA Impact'], { labels: false, legend: true, measureColors: { m0: C.sky, m1: C.teal }, grouped: true }),
  table('vc-table', 'value', 'Initiative register · actual vs expected value', [['Initiative', IN], ['Company', CO, 'co'], ['Status', IN, 'st'], ['Rag', IN, 'rg', 'RAG'], ['Thesis Link', IN, 'tl', 'Thesis link']], [['Estimated EBITDA Impact', USD, 'Run-rate'], ['Planned EBITDA Impact', USD, 'Planned to date'], ['Realised EBITDA Impact', USD, 'Realised'], ['Benefit Realisation', '0%', 'Realisation'], ['Implementation Cost', USD, 'Cost']],
    { sort: { by: 'm2', direction: 'desc' }, spark: { measure: 'Realised EBITDA Impact', view: IQ, field: 'Quarter', label: 'Realised by quarter' }, fit: { d0: 0.2, co: 0.13, st: 0.08, rg: 0.05, tl: 0.09, m0: 0.07, m1: 0.08, m2: 0.07, m3: 0.07, m4: 0.06, sp: 0.09 }, extraOps: [bold('d0', C.navy), ...bands('m3', [-1e12, 0.6, 0.9], [C.red, C.gold, C.green])] }),

  // ------------------------------------------------ Workflows & approvals (g-workflows)
  bar('w-events', 'workflows', 'Audited events by record type', ['Record Type', WE], 'Audit Events', { format: INT, colors: [C.navy] }),
  table('w-status', 'workflows', 'Workflow records by type and status', [['Record Type', WR, 'd0', 'Type'], ['Status', WR, 'd1', 'Status']], [['Workflow Records', INT, 'Records']], { sort: { by: 'd0', direction: 'asc' }, fit: { d0: 0.4, d1: 0.35, m0: 0.23 } }),
];
