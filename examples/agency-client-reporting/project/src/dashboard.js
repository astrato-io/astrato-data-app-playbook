/**
 * Every Astrato object of the Tidewater Media client-reporting app (mock data): KPI cards, charts, driver
 * bridges and tables, declared against the "Tidewater Media – Client Performance" semantic layer.
 * Dimensions are view columns; measures are the layer's governed measures.
 */
import { createDefaultVSpec } from '@astrato-io/visualizations';
import { compileVisualizationDefinition } from '@astrato-io/visualizations/definitions';
import { measureRef } from './fields.js';

const PV = 'Ads';
export const MAIN = 'g-pf';
/** Tidewater palette: aubergine ink, coral, teal, sun, violet, sky. */
export const C = { navy: '#1E1B3A', coral: '#FF5A5F', teal: '#12B3A8', sun: '#FFB020', violet: '#7C6CF2', sky: '#3D8BFD', green: '#1FA971', red: '#E5484D', grey: '#A0A3B1', mist: '#E9E7F5', pink: '#F7A8C4' };
const PLAIN = { formatType: 'none' };
const NUM = { formatType: 'numberNoDecimal' };

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
/** Traffic-light text by thresholds. */
const bands = (ref, lower, colors, cuts = [...lower.slice(1), 1e12]) => [
  { name: 'setColumnRepresentation', ref, payload: { representation: 'indicator' } },
  ...cuts.flatMap((value, segmentIndex) => [
    { name: 'addColumnIndicatorSegment', ref, payload: {} },
    { name: 'setColumnIndicatorSegmentValue', ref, payload: { segmentIndex, value } },
    { name: 'setColumnIndicatorSegmentColor', ref, payload: { segmentIndex, color: colors[segmentIndex] } },
  ]),
  { name: 'setColumnIndicatorColorText', ref, payload: { colorText: true } },
];
const upGood = (ref) => bands(ref, [-1e12, 0], [C.red, C.green]);
const downGood = (ref) => bands(ref, [-1e12, 0], [C.green, C.red]);
const perMeasure = (map) => [
  { name: 'setColoringType', payload: 'perEachMeasure' },
  ...Object.entries(map).map(([ref, graphColor]) => ({ name: 'setMeasureGraphColor', ref, payload: { graphColor } })),
];

const dims = (...cols) => cols.map(([name, ref, view = PV]) => ({ view, name, ref }));
const meas = (...list) => list.map((m, i) => (typeof m === 'string' ? { name: m, ref: `m${i}`, format: NUM } : { name: m[0], ref: m[1] ?? `m${i}`, format: NUM }));

const bar = (id, title, [dimName, view = PV], measures, { group = MAIN, page, sort = { by: 'm0', direction: 'desc' }, limit = 20, colors, gradient, measureColors, format = GBP, orientation = 'horizontal', legend = false, stacked = false, grouped = false, labels = true, filters, barPadding = 25, hideMeasureAxis, coloring, columnLabels, extraOps = [] } = {}) => ({
  id, slot: id, page, title, type: 'bar', group, orientation, filters, columnLabels,
  dimensions: dims([dimName, 'd0', view]),
  measures: meas(...[].concat(measures)),
  sort, limit, gradient, coloring, colors: gradient ? undefined : colors ?? (measureColors ? undefined : [C.navy]), legend, legendPosition: legend ? 'top' : undefined, stacked, grouped, barPadding,
  hideMeasureAxis: hideMeasureAxis ?? (labels && !stacked),
  ...(labels ? { dataLabels: { size: 11, format, backdrop: '#FFFFFF' } } : {}),
  ops: [...(measureColors ? perMeasure(measureColors) : []), ...[].concat(measures).map((_, i) => measFormat(`m${i}`, format)).flat(), ...extraOps],
});
/** A by-month series split by a second dimension. */
const series = (id, page, group, title, type, measure, [d1, v1], format, colors, { stacked = true } = {}) => ({
  id, slot: id, page, title, type, group, orientation: 'vertical',
  dimensions: dims(['Month', 'd0', MV], [d1, 'd1', v1]), measures: meas(measure),
  sort: [{ by: 'd0', direction: 'asc' }, { by: 'd1', direction: 'asc' }], limit: 400, stacked: type === 'bar' && stacked, legend: true, legendPosition: 'top', barPadding: 30,
  colors, coloring: 'categorical', hideMeasureAxis: false, ...(type === 'line' ? { lineCurve: 'curve' } : {}), ops: measFormat('m0', format),
});
const donut = (id, title, [dimName, view = PV], measure, { group = MAIN, page, colors, sort = { by: 'm0', direction: 'desc' }, limit = 12 } = {}) => ({
  id, slot: id, page, title, type: 'pie', group, donut: true, legend: true, sliceLabels: 'percentage', coloring: 'categorical',
  dimensions: dims([dimName, 'd0', view]), measures: meas(measure), sort, limit, colors,
});
/** Driver bridge: the change by a dimension, stacked into effects that add up exactly to it. */
const bridge = (id, page, group, title, [dimName, view], effects, format) => ({
  id, slot: id, page, title, type: 'bar', group, orientation: 'horizontal',
  dimensions: dims([dimName, 'd0', view]), measures: meas(...effects.map(([m]) => m)),
  sort: { by: 'd0', direction: 'asc' }, limit: 30, stacked: true, legend: true, legendPosition: 'top', barPadding: 30, hideMeasureAxis: false,
  columnLabels: Object.fromEntries(effects.map(([, label], i) => [`m${i}`, label])),
  ops: [...perMeasure(Object.fromEntries(effects.map(([, , color], i) => [`m${i}`, color]))), ...effects.flatMap((_, i) => measFormat(`m${i}`, format))],
});

const AD = 'Ads', WV = 'Web', SV = 'SEO', CL = 'Clients', CH = 'Channels', MV = 'Months';
const GBP = '£#,##0', GBP2 = '£#,##0.00', INT = '#,##0', PCT = '0.00%', PCT1 = '0.0%', X = '0.00"x"', POS = '0.0';
const SPCT = '+0.0%;-0.0%;0.0%', PTS = '+0.00%;-0.00%;0.00%', SPOS = '+0.0;-0.0;0.0', SINT = '+#,##0;-#,##0;0', SGBP = '+£#,##0;-£#,##0;£0', SX = '+0.0%;-0.0%;0.0%';
export const FMT = { GBP, GBP2, INT, PCT, PCT1, X, POS, SPCT, PTS, SPOS, SINT, SGBP };
const ctl = (group, view, name) => ({ id: `ctl-${group}-${view}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'), page: 'controls', title: name, type: 'filter', group, field: { view, name }, presentation: { mode: 'dropdown', quickSelect: false, responsive: false, searchable: true, showProgressBar: false } });
export const ctlId = (group, view, name) => ctl(group, view, name).id;

/**
 * A KPI card is three native objects: the number, a mini-chart of its monthly trend and a one-row
 * table with last month and the change (green when it moved the right way).
 */
export const KPIS = {};
const kpiCard = (id, page, group, label, { value, fmt, pyFmt = fmt, py, delta, deltaFmt = SPCT, spark, sparkType = 'line', good = 'up', color = C.navy, src }) => {
  KPIS[id] = { label, src };
  const [lo, hi] = good === 'up' ? [C.red, C.green] : good === 'down' ? [C.green, C.red] : [C.navy, C.navy]; // 'flat': neither direction is good
  const sd = dims(['Month', 'd0', MV]);
  return [
    { id, slot: id, page, title: label, type: 'number', group, measures: meas(value), ops: measFormat('m0', fmt) },
    sparkType === 'line'
      ? { id: `${id}-sp`, slot: `${id}-sp`, page, title: `${label} trend`, type: 'line', group, sparkline: true, dimensions: sd, measures: meas(spark), sort: [{ by: 'd0', direction: 'asc' }], limit: 40, legend: false, colors: [color], lineCurve: 'curve' }
      : { id: `${id}-sp`, slot: `${id}-sp`, page, title: `${label} trend`, type: 'bar', group, orientation: 'vertical', dimensions: sd, measures: meas(spark), sort: { by: 'd0', direction: 'asc' }, limit: 40, colors: [color], barPadding: 20, hideMeasureAxis: true, hideDimensionAxis: true, legend: false },
    {
      id: `${id}-d`, slot: `${id}-d`, page, title: `${label} vs last month`, type: 'table', group, fontSize: 12, headerHidden: true, fitColumns: { p: 0.54, c: 0.46 }, fitWidth: 232,
      dimensions: [], measures: meas([py, 'p'], [delta, 'c']),
      columnLabels: { p: 'Last month', c: 'vs LM' },
      ops: [...rowHeight(24), ...colFormat('p', `"Aug "${pyFmt}`), ...colFormat('c', deltaFmt.split(';').map((f) => `"MoM "${f}`).join(';')), ...right('c'), ...bands('c', [-1e12, 0], [lo, hi])],
    },
  ];
};
const sparkCol = (ref, color = C.coral) => ({ ref, view: MV, field: 'Month', color });

/** The standard KPI families (This Month / Last Month / MoM) as a card. */
const fam = (id, page, group, label, name, fmt, opts = {}) => kpiCard(id, page, group, label, {
  value: `${name} This Month`, fmt, py: `${name} Last Month`, delta: `${name} MoM`, spark: name, ...opts,
});

const tileCatalogue = () => [
  // Filter bars: Client, Channel and Month are shared tables, so one control filters every source system.
  ctl('g-pf', CL, 'Account Manager'), ctl('g-pf', CL, 'Sector'), ctl('g-pf', CL, 'Business Model'), ctl('g-pf', CH, 'Platform'),
  ctl('g-cl', CL, 'Client'), ctl('g-cl', CH, 'Channel Group'), ctl('g-cl', CH, 'Platform'), ctl('g-cl', CH, 'Channel'),
  ctl('g-dr', CL, 'Client'), ctl('g-dr', CH, 'Channel Group'), ctl('g-dr', CH, 'Channel'),
  ctl('g-pm', CL, 'Client'), ctl('g-pm', CH, 'Platform'), ctl('g-pm', AD, 'Campaign Type'), ctl('g-pm', CH, 'Channel'),
  ctl('g-seo', CL, 'Client'), ctl('g-seo', SV, 'Keyword Group'), ctl('g-seo', WV, 'Device'), ctl('g-seo', CH, 'Channel Group'),

  // ---- Agency portfolio: September 2026 against August
  ...fam('pf-spend', 'pf', 'g-pf', 'Media spend · Sep', 'Spend', GBP, { sparkType: 'bar', color: C.navy, src: 'Google Ads + Meta' }),
  ...fam('pf-val', 'pf', 'g-pf', 'Conversion value · Sep', 'Conversion Value', GBP, { sparkType: 'bar', color: C.teal, src: 'Google Ads + Meta' }),
  ...fam('pf-roas', 'pf', 'g-pf', 'ROAS · Sep', 'ROAS', X, { color: C.coral, src: 'Google Ads + Meta' }),
  ...fam('pf-cpa', 'pf', 'g-pf', 'Cost per conversion', 'CPA', GBP2, { good: 'down', color: C.violet, src: 'Google Ads + Meta' }),
  ...fam('pf-conv', 'pf', 'g-pf', 'Conversions · Sep', 'Conversions', INT, { sparkType: 'bar', color: C.sky, src: 'Google Ads + Meta' }),
  ...fam('pf-sess', 'pf', 'g-pf', 'Website sessions', 'Sessions', INT, { sparkType: 'bar', color: C.sun, src: 'GA4' }),
  ...fam('pf-org', 'pf', 'g-pf', 'Organic clicks', 'Organic Clicks', INT, { color: C.green, src: 'Search Console' }),
  ...fam('pf-pos', 'pf', 'g-pf', 'Avg Google position', 'Average Position', POS, { deltaFmt: SPOS, good: 'down', color: C.pink, src: 'Search Console' }),
  series('pf-trend', 'pf', 'g-pf', 'Media spend by platform · 21 months', 'bar', 'Spend', ['Platform', CH], GBP, [C.sky, C.violet]),
  series('pf-roasln', 'pf', 'g-pf', 'ROAS by platform · Google Ads vs Meta', 'line', 'ROAS', ['Platform', CH], X, [C.sky, C.violet]),
  {
    id: 'pf-score', slot: 'pf-score', page: 'pf', title: 'Client scorecard · Google Ads, Meta, GA4 and Search Console joined through Clients', type: 'table', group: 'g-pf',
    dimensions: dims(['Client', 'c', CL], ['Account Manager', 'am', CL], ['Business Model', 'bm', CL]),
    measures: meas(['Spend This Month', 's'], ['Conversion Value This Month', 'v'], ['Conversion Value MoM', 'vm'], ['Conversion Value', 'sp'], ['ROAS This Month', 'r'], ['ROAS MoM', 'rm'], ['CPA This Month', 'cpa'], ['Key Events MoM', 'ke'], ['Organic Clicks MoM', 'o'], ['Average Position MoM', 'p']),
    miniChart: sparkCol('sp', C.coral),
    sort: [{ by: 's', direction: 'desc' }], limit: 20, fontSize: 13,
    columnLabels: { c: 'Client', am: 'Account manager', bm: 'Model', s: 'Spend', v: 'Conv. value', vm: 'MoM', sp: 'Conv. value · 21 months', r: 'ROAS', rm: 'MoM', cpa: 'CPA', ke: 'GA4 key events MoM', o: 'Organic clicks MoM', p: 'Position MoM' },
    ops: [...rowHeight(36), bold('c', C.navy), ...colFormat('s', GBP), ...colFormat('v', GBP), ...colFormat('vm', SPCT), ...colFormat('r', X), ...colFormat('rm', SPCT), ...colFormat('cpa', GBP2), ...colFormat('ke', SPCT), ...colFormat('o', SPCT), ...colFormat('p', SPOS),
      ...right('s', 'v', 'vm', 'r', 'rm', 'cpa', 'ke', 'o', 'p'), ...bands('vm', [-1e9, -0.1, 0], [C.red, C.sun, C.green]), ...upGood('rm'), ...upGood('ke'), ...upGood('o'), ...downGood('p')],
  },
  bar('pf-move', 'Conversion value change vs August · by client', ['Client', CL], 'Conversion Value Change MoM', { page: 'pf', group: 'g-pf', format: SGBP, gradient: [C.red, C.grey, C.green], sort: { by: 'm0', direction: 'asc' } }),
  donut('pf-mix', 'GA4 revenue by channel group · Sep', ['Channel Group', CH], 'Web Revenue This Month', { page: 'pf', group: 'g-pf', colors: [C.sky, C.violet, C.green, C.sun] }),

  // ---- Client performance (one client at a time)
  ...fam('cl-spend', 'cl', 'g-cl', 'Media spend', 'Spend', GBP, { sparkType: 'bar', color: C.navy }),
  ...fam('cl-val', 'cl', 'g-cl', 'Conversion value', 'Conversion Value', GBP, { sparkType: 'bar', color: C.teal }),
  ...fam('cl-roas', 'cl', 'g-cl', 'ROAS', 'ROAS', X, { color: C.coral }),
  ...fam('cl-cpa', 'cl', 'g-cl', 'Cost per conversion', 'CPA', GBP2, { good: 'down', color: C.violet }),
  ...fam('cl-conv', 'cl', 'g-cl', 'Conversions', 'Conversions', INT, { sparkType: 'bar', color: C.sky }),
  ...fam('cl-rev', 'cl', 'g-cl', 'GA4 revenue', 'Web Revenue', GBP, { sparkType: 'bar', color: C.sun }),
  ...fam('cl-org', 'cl', 'g-cl', 'Organic clicks', 'Organic Clicks', INT, { color: C.green }),
  ...fam('cl-eng', 'cl', 'g-cl', 'Engagement rate', 'Engagement Rate', PCT1, { deltaFmt: PTS, color: C.pink }),
  {
    id: 'cl-trend', slot: 'cl-trend', page: 'cl', title: 'Spend and conversion value by month', type: 'line', group: 'g-cl',
    dimensions: dims(['Month', 'd0', MV]), measures: meas('Conversion Value', 'Spend'), sort: [{ by: 'd0', direction: 'asc' }], limit: 40, legend: true, lineCurve: 'curve',
    colors: [C.teal, C.navy], ops: [...measFormat('m0', GBP), ...measFormat('m1', GBP)],
  },
  bar('cl-chan', 'Conversion value by channel · Sep vs Aug', ['Channel', CH], ['Conversion Value This Month', 'Conversion Value Last Month'], { page: 'cl', group: 'g-cl', grouped: true, legend: true, labels: false, hideMeasureAxis: false, measureColors: { m0: C.coral, m1: C.mist }, columnLabels: { m0: 'September', m1: 'August' }, sort: { by: 'm0', direction: 'desc' } }),
  series('cl-web', 'cl', 'g-cl', 'GA4 sessions by channel group', 'bar', 'Sessions', ['Channel Group', CH], INT, [C.sky, C.violet, C.green, C.sun]),
  series('cl-orgln', 'cl', 'g-cl', 'Organic clicks by keyword group', 'line', 'Organic Clicks', ['Keyword Group', SV], INT, [C.navy, C.coral, C.teal, C.sun, C.violet]),
  {
    id: 'cl-camp', slot: 'cl-camp', page: 'cl', title: 'Campaigns · Google Ads and Meta Ads Manager', type: 'table', group: 'g-cl',
    dimensions: dims(['Campaign', 'cp', AD], ['Channel', 'ch', CH]),
    measures: meas(['Spend This Month', 's'], ['Conversions This Month', 'c'], ['Conversions MoM', 'cm'], ['Conversions', 'sp'], ['CPA This Month', 'cpa'], ['CPA MoM', 'cpm'], ['ROAS This Month', 'r'], ['ROAS MoM', 'rm']),
    miniChart: sparkCol('sp', C.teal),
    sort: [{ by: 's', direction: 'desc' }], limit: 60, fontSize: 13,
    columnLabels: { cp: 'Campaign', ch: 'Channel', s: 'Spend', c: 'Conversions', cm: 'MoM', sp: 'Conversions · 21 months', cpa: 'CPA', cpm: 'MoM', r: 'ROAS', rm: 'MoM' },
    ops: [...rowHeight(34), bold('cp', C.navy), ...colFormat('s', GBP), ...colFormat('c', INT), ...colFormat('cm', SPCT), ...colFormat('cpa', GBP2), ...colFormat('cpm', SPCT), ...colFormat('r', X), ...colFormat('rm', SPCT), ...right('s', 'c', 'cm', 'cpa', 'cpm', 'r', 'rm'), ...upGood('cm'), ...downGood('cpm'), ...upGood('rm')],
  },

  // ---- Why it changed: additive driver bridges (sequential substitution, add up exactly)
  ...kpiCard('dr-conv', 'dr', 'g-dr', 'Conversions change', { value: 'Conversions Change MoM', fmt: SINT, pyFmt: INT, py: 'Conversions Last Month', delta: 'Conversions MoM', spark: 'Conversions', sparkType: 'bar', color: C.sky }),
  ...kpiCard('dr-val', 'dr', 'g-dr', 'Conversion value change', { value: 'Conversion Value Change MoM', fmt: SGBP, pyFmt: GBP, py: 'Conversion Value Last Month', delta: 'Conversion Value MoM', spark: 'Conversion Value', sparkType: 'bar', color: C.teal }),
  ...kpiCard('dr-spend', 'dr', 'g-dr', 'Spend change', { value: 'Spend Change MoM', fmt: SGBP, pyFmt: GBP, py: 'Spend Last Month', delta: 'Spend MoM', spark: 'Spend', sparkType: 'bar', color: C.navy, good: 'flat' }),
  ...kpiCard('dr-org', 'dr', 'g-dr', 'Organic clicks change', { value: 'Organic Clicks Change MoM', fmt: SINT, pyFmt: INT, py: 'Organic Clicks Last Month', delta: 'Organic Clicks MoM', spark: 'Organic Clicks', color: C.green }),
  bridge('dr-cb', 'dr', 'g-dr', 'Conversions change by channel = reach + click-through + conversion rate', ['Channel', CH], [['Conversions Impressions Effect MoM', 'Reach (impressions)', C.sky], ['Conversions CTR Effect MoM', 'Click-through rate', C.coral], ['Conversions CVR Effect MoM', 'Conversion rate', C.violet]], SINT),
  bridge('dr-vb', 'dr', 'g-dr', 'Conversion value change by channel = volume + value per conversion', ['Channel', CH], [['Conversion Value Volume Effect MoM', 'Conversion volume', C.teal], ['Conversion Value AOV Effect MoM', 'Value per conversion', C.sun]], SGBP),
  bridge('dr-sb', 'dr', 'g-dr', 'Spend change by channel = clicks + cost per click', ['Channel', CH], [['Spend Clicks Effect MoM', 'Click volume', C.navy], ['Spend CPC Effect MoM', 'Cost per click', C.coral]], SGBP),
  bridge('dr-ob', 'dr', 'g-dr', 'Organic clicks change by keyword group = demand + click-through (rankings)', ['Keyword Group', SV], [['Organic Clicks Impressions Effect MoM', 'Search demand', C.green], ['Organic Clicks CTR Effect MoM', 'CTR / rankings', C.coral]], SINT),
  bridge('dr-kb', 'dr', 'g-dr', 'GA4 key events change by device = traffic + on-site conversion', ['Device', WV], [['Key Events Sessions Effect MoM', 'Traffic', C.sky], ['Key Events Rate Effect MoM', 'On-site conversion rate', C.violet]], SINT),
  {
    id: 'dr-camp', slot: 'dr-camp', page: 'dr', title: 'Campaign movers · biggest conversion changes first, with the driver that moved', type: 'table', group: 'g-dr',
    dimensions: dims(['Client', 'cl', CL], ['Campaign', 'cp', AD], ['Channel', 'ch', CH]),
    measures: meas(['Conversions Last Month', 'l'], ['Conversions This Month', 't'], ['Conversions Change MoM', 'd'], ['Conversions Impressions Effect MoM', 'ie'], ['Conversions CTR Effect MoM', 'ce'], ['Conversions CVR Effect MoM', 've'], ['CTR MoM', 'ctr'], ['CPC MoM', 'cpc'], ['CVR MoM', 'cvr'], ['Conversions', 'sp']),
    miniChart: sparkCol('sp', C.coral),
    sort: [{ by: 'd', direction: 'asc' }], limit: 80, fontSize: 12,
    columnLabels: { cl: 'Client', cp: 'Campaign', ch: 'Channel', l: 'Aug', t: 'Sep', d: 'Change', ie: 'Reach effect', ce: 'CTR effect', ve: 'CVR effect', ctr: 'CTR MoM', cpc: 'CPC MoM', cvr: 'CVR MoM', sp: 'Conversions · 21 months' },
    ops: [...rowHeight(32), bold('cp', C.navy), ...colFormat('l', INT), ...colFormat('t', INT), ...['d', 'ie', 'ce', 've'].flatMap((r) => colFormat(r, SINT)), ...colFormat('ctr', PTS), ...colFormat('cpc', SPCT), ...colFormat('cvr', PTS),
      ...right('l', 't', 'd', 'ie', 'ce', 've', 'ctr', 'cpc', 'cvr'), ...upGood('d'), ...upGood('ie'), ...upGood('ce'), ...upGood('ve'), ...upGood('ctr'), ...downGood('cpc'), ...upGood('cvr')],
  },
  {
    id: 'dr-seo', slot: 'dr-seo', page: 'dr', title: 'Rankings · Search Console by keyword group', type: 'table', group: 'g-dr',
    dimensions: dims(['Client', 'cl', CL], ['Keyword Group', 'k', SV]),
    measures: meas(['Average Position Last Month', 'pl'], ['Average Position This Month', 'pt'], ['Average Position MoM', 'pm'], ['Organic CTR MoM', 'ctr'], ['Organic Clicks Change MoM', 'oc'], ['Average Position', 'sp']),
    miniChart: sparkCol('sp', C.violet),
    sort: [{ by: 'oc', direction: 'asc' }], limit: 60, fontSize: 12,
    columnLabels: { cl: 'Client', k: 'Keyword group', pl: 'Pos. Aug', pt: 'Pos. Sep', pm: 'Change', ctr: 'CTR MoM', oc: 'Clicks change', sp: 'Position · 21 months' },
    ops: [...rowHeight(32), bold('k', C.navy), ...colFormat('pl', POS), ...colFormat('pt', POS), ...colFormat('pm', SPOS), ...colFormat('ctr', PTS), ...colFormat('oc', SINT), ...right('pl', 'pt', 'pm', 'ctr', 'oc'), ...downGood('pm'), ...upGood('ctr'), ...upGood('oc')],
  },
  {
    id: 'dr-yoy', slot: 'dr-yoy', page: 'dr', title: 'Same lens, year on year · Sep 2026 vs Sep 2025 by channel', type: 'table', group: 'g-dr',
    dimensions: dims(['Channel', 'ch', CH]),
    measures: meas(['Conversions Same Month LY', 'l'], ['Conversions This Month', 't'], ['Conversions Change YoY', 'd'], ['Conversions Impressions Effect YoY', 'ie'], ['Conversions CTR Effect YoY', 'ce'], ['Conversions CVR Effect YoY', 've'], ['Spend CPC Effect YoY', 'cpc'], ['Conversions', 'sp']),
    miniChart: sparkCol('sp', C.sky),
    sort: [{ by: 'd', direction: 'asc' }], limit: 20, fontSize: 13,
    columnLabels: { ch: 'Channel', l: 'Sep 2025', t: 'Sep 2026', d: 'Change', ie: 'Reach effect', ce: 'CTR effect', ve: 'CVR effect', cpc: 'Spend from CPC', sp: 'Conversions · 21 months' },
    ops: [...rowHeight(34), bold('ch', C.navy), ...colFormat('l', INT), ...colFormat('t', INT), ...['d', 'ie', 'ce', 've'].flatMap((r) => colFormat(r, SINT)), ...colFormat('cpc', SGBP), ...right('l', 't', 'd', 'ie', 'ce', 've', 'cpc'), ...upGood('d'), ...upGood('ie'), ...upGood('ce'), ...upGood('ve'), ...downGood('cpc')],
  },

  // ---- Infographic one-pager (one client, group g-ig)
  ...fam('ig-val', 'ig', 'g-ig', 'Conversion value', 'Conversion Value', GBP, { sparkType: 'bar', color: C.coral }),
  ...fam('ig-roas', 'ig', 'g-ig', 'Return on ad spend', 'ROAS', X, { color: C.violet }),
  ...fam('ig-conv', 'ig', 'g-ig', 'Conversions', 'Conversions', INT, { sparkType: 'bar', color: C.navy }),
  ...fam('ig-org', 'ig', 'g-ig', 'Organic clicks', 'Organic Clicks', INT, { color: C.teal }),
  {
    id: 'ig-growth', slot: 'ig-growth', page: 'ig', title: 'Client growth · conversion value Jan–Sep, by platform', type: 'bar', group: 'g-ig', orientation: 'horizontal',
    dimensions: dims(['Year', 'd0', MV], ['Platform', 'd1', CH]), measures: meas('Conversion Value'),
    filters: [{ field: 'Ytd Bucket', view: MV, values: ['CY YTD', 'PY YTD'] }],
    sort: [{ by: 'd0', direction: 'desc' }, { by: 'd1', direction: 'asc' }], limit: 40, stacked: true, legend: true, legendPosition: 'bottom', barPadding: 35,
    colors: [C.coral, C.violet], coloring: 'categorical', hideMeasureAxis: false, dataLabels: { size: 12, format: '£#,##0,"k"', backdrop: '#00000000' }, ops: measFormat('m0', '£#,##0,"k"'),
  },
  {
    id: 'ig-rev', slot: 'ig-rev', page: 'ig', title: 'Revenue by channel', type: 'table', group: 'g-ig', fitColumns: { ch: 0.36, t: 0.24, l: 0.22, m: 0.18 },
    dimensions: dims(['Channel', 'ch', CH]),
    measures: meas(['Web Revenue This Month', 't'], ['Web Revenue Last Month', 'l'], ['Web Revenue MoM', 'm']),
    sort: [{ by: 't', direction: 'desc' }], limit: 10, fontSize: 14,
    columnLabels: { ch: 'Channel', t: 'Sep £', l: 'Aug £', m: 'MoM' },
    ops: [...rowHeight(34), bold('ch', C.navy), bold('t', C.navy), ...colFormat('t', GBP), ...colFormat('l', GBP), ...colFormat('m', SPCT), ...right('t', 'l', 'm'), ...upGood('m')],
  },
  donut('ig-mix', 'Revenue by source', ['Channel Group', CH], 'Web Revenue This Month', { page: 'ig', group: 'g-ig', colors: [C.navy, C.coral, C.violet, C.teal] }),
  {
    id: 'ig-social', slot: 'ig-social', page: 'ig', title: 'Paid media growth', type: 'table', group: 'g-ig', fitColumns: { ch: 0.3, i: 0.18, c: 0.14, y: 0.16, sp: 0.22 },
    dimensions: dims(['Channel', 'ch', CH]),
    measures: meas(['Impressions This Month', 'i'], ['Clicks This Month', 'c'], ['Conversions YoY', 'y'], ['Conversions', 'sp']),
    miniChart: sparkCol('sp', C.violet),
    sort: [{ by: 'i', direction: 'desc' }], limit: 10, fontSize: 13,
    columnLabels: { ch: 'Channel', i: 'Impressions', c: 'Clicks', y: 'Conv. vs Sep 25', sp: 'Conversions · 21 months' },
    ops: [...rowHeight(34), bold('ch', C.navy), ...colFormat('i', INT), ...colFormat('c', INT), ...colFormat('y', SPCT), ...right('i', 'c', 'y'), ...upGood('y')],
  },

  // ---- Paid media
  ...fam('ls-imp', 'pm', 'g-pm', 'Impressions', 'Impressions', INT, { sparkType: 'bar', color: C.sky }),
  ...fam('ls-ctr', 'pm', 'g-pm', 'Click-through rate', 'CTR', PCT, { deltaFmt: PTS, color: C.coral }),
  ...fam('ls-cpc', 'pm', 'g-pm', 'Cost per click', 'CPC', GBP2, { good: 'down', color: C.violet }),
  ...fam('ls-cpm', 'pm', 'g-pm', 'Cost per 1,000 impressions', 'CPM', GBP2, { good: 'down', color: C.navy }),
  ...fam('ls-cvr', 'pm', 'g-pm', 'Conversion rate', 'CVR', PCT, { deltaFmt: PTS, color: C.teal }),
  ...fam('ls-roas', 'pm', 'g-pm', 'ROAS', 'ROAS', X, { color: C.sun }),
  series('ls-cpcln', 'pm', 'g-pm', 'Cost per click by channel', 'line', 'CPC', ['Channel', CH], GBP2, [C.sky, C.navy, C.violet, C.pink]),
  series('ls-ctrln', 'pm', 'g-pm', 'Click-through rate by channel', 'line', 'CTR', ['Channel', CH], '0.0%', [C.sky, C.navy, C.violet, C.pink]),
  bar('ls-type', 'ROAS by campaign type · Sep', ['Campaign Type', AD], 'ROAS This Month', { page: 'pm', group: 'g-pm', format: X, gradient: [C.mist, C.coral] }),
  bar('ls-cpa', 'Cost per conversion by client · Sep', ['Client', CL], 'CPA This Month', { page: 'pm', group: 'g-pm', format: GBP2, gradient: [C.teal, C.sun, C.red] }),
  {
    id: 'ls-table', slot: 'ls-table', page: 'pm', title: 'Every campaign · funnel this month', type: 'table', group: 'g-pm',
    dimensions: dims(['Client', 'cl', CL], ['Campaign', 'cp', AD], ['Platform', 'pl', CH], ['Campaign Type', 'ty', AD]),
    measures: meas(['Spend This Month', 's'], ['Impressions This Month', 'i'], ['CTR This Month', 'ctr'], ['CPC This Month', 'cpc'], ['CVR This Month', 'cvr'], ['Conversions This Month', 'c'], ['ROAS This Month', 'r'], ['ROAS MoM', 'rm'], ['ROAS', 'sp']),
    miniChart: sparkCol('sp', C.coral),
    sort: [{ by: 's', direction: 'desc' }], limit: 120, fontSize: 12,
    columnLabels: { cl: 'Client', cp: 'Campaign', pl: 'Platform', ty: 'Type', s: 'Spend', i: 'Impr.', ctr: 'CTR', cpc: 'CPC', cvr: 'CVR', c: 'Conv.', r: 'ROAS', rm: 'MoM', sp: 'ROAS · 21 months' },
    ops: [...rowHeight(30), bold('cp', C.navy), ...colFormat('s', GBP), ...colFormat('i', INT), ...colFormat('ctr', PCT), ...colFormat('cpc', GBP2), ...colFormat('cvr', PCT), ...colFormat('c', INT), ...colFormat('r', X), ...colFormat('rm', SPCT), ...right('s', 'i', 'ctr', 'cpc', 'cvr', 'c', 'r', 'rm'), ...upGood('rm'), ...bands('r', [0, 1, 3], [C.red, C.sun, C.green])],
  },

  // ---- SEO & web
  ...fam('s-clk', 'seo', 'g-seo', 'Organic clicks', 'Organic Clicks', INT, { sparkType: 'bar', color: C.green }),
  ...fam('s-imp', 'seo', 'g-seo', 'Organic impressions', 'Organic Impressions', INT, { color: C.sky }),
  ...fam('s-ctr', 'seo', 'g-seo', 'Organic CTR', 'Organic CTR', PCT, { deltaFmt: PTS, color: C.coral }),
  ...fam('s-pos', 'seo', 'g-seo', 'Average position', 'Average Position', POS, { deltaFmt: SPOS, good: 'down', color: C.violet }),
  ...kpiCard('s-top', 'seo', 'g-seo', 'Keywords in top 3', { value: 'Top 3 Keywords This Month', fmt: INT, py: 'Top 3 Keywords Last Month', delta: 'Top 3 Keywords Change MoM', deltaFmt: SINT, spark: 'Top 3 Keywords', color: C.sun }),
  ...fam('s-sess', 'seo', 'g-seo', 'GA4 sessions', 'Sessions', INT, { sparkType: 'bar', color: C.navy }),
  ...fam('s-eng', 'seo', 'g-seo', 'Engagement rate', 'Engagement Rate', PCT1, { deltaFmt: PTS, color: C.teal }),
  ...fam('s-scr', 'seo', 'g-seo', 'Site conversion rate', 'Site Conversion Rate', PCT, { deltaFmt: PTS, color: C.pink }),
  series('s-posln', 'seo', 'g-seo', 'Average Google position by keyword group (lower is better)', 'line', 'Average Position', ['Keyword Group', SV], POS, [C.navy, C.coral, C.teal, C.sun, C.violet]),
  series('s-dev', 'seo', 'g-seo', 'GA4 engagement rate by device', 'line', 'Engagement Rate', ['Device', WV], '0%', [C.navy, C.coral, C.teal]),
  {
    id: 's-table', slot: 's-table', page: 'seo', title: 'Keyword groups · Search Console + rank tracking', type: 'table', group: 'g-seo',
    dimensions: dims(['Client', 'cl', CL], ['Keyword Group', 'k', SV]),
    measures: meas(['Organic Clicks This Month', 'c'], ['Organic Clicks MoM', 'cm'], ['Organic Clicks YoY', 'cy'], ['Organic Clicks', 'sp'], ['Organic CTR This Month', 'ctr'], ['Average Position This Month', 'p'], ['Average Position MoM', 'pm'], ['Top 3 Keywords This Month', 't']),
    miniChart: sparkCol('sp', C.green),
    sort: [{ by: 'c', direction: 'desc' }], limit: 60, fontSize: 12,
    columnLabels: { cl: 'Client', k: 'Keyword group', c: 'Clicks', cm: 'MoM', cy: 'YoY', sp: 'Clicks · 21 months', ctr: 'CTR', p: 'Position', pm: 'MoM', t: 'Top-3 kw' },
    ops: [...rowHeight(32), bold('k', C.navy), ...colFormat('c', INT), ...colFormat('cm', SPCT), ...colFormat('cy', SPCT), ...colFormat('ctr', PCT), ...colFormat('p', POS), ...colFormat('pm', SPOS), ...colFormat('t', INT), ...right('c', 'cm', 'cy', 'ctr', 'p', 'pm', 't'), ...upGood('cm'), ...upGood('cy'), ...downGood('pm')],
  },
  bar('s-chan', 'GA4 sessions by channel · Sep', ['Channel', CH], 'Sessions This Month', { page: 'seo', group: 'g-seo', format: INT, gradient: [C.mist, C.navy] }),
  bar('s-scrc', 'Site conversion rate by client · Sep', ['Client', CL], 'Site Conversion Rate This Month', { page: 'seo', group: 'g-seo', format: PCT, gradient: [C.mist, C.teal] }),
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

const tableDefinitionOf = (tile, resolved) => ({
  version: 1,
  type: 'table',
  data: {
    columns: [
      ...dimensionEntries(resolved.dimensions).map((column) => ({ ...column, role: 'dimension' })),
      ...measureEntries(resolved.measures).map((column) => ({ ...column, role: 'measure' })),
    ],
  },
  ...withSortAndLimit(tile),
});

const definitionOf = (tile, resolved) => {
  if (tile.type === 'table') return tableDefinitionOf(tile, resolved);
  const data = { measures: measureEntries(resolved.measures), ...(resolved.dimensions.length ? { dimensions: dimensionEntries(resolved.dimensions) } : {}) };
  if (tile.type === 'number') return { version: 1, type: 'number', data: { measure: data.measures[0] } };
  if (tile.type === 'scatter') {
    return {
      version: 1, type: 'scatter', data,
      ...(tile.limit ? { limiting: { queryLimit: tile.limit } } : {}),
      presentation: {
        axes: {
          primaryMeasure: { labelsVisible: false, title: tile.axisTitles.primaryMeasure, titleVisible: false },
          secondaryMeasure: { labelsVisible: false, title: tile.axisTitles.secondaryMeasure, titleVisible: false },
        },
        legend: { visible: Boolean(tile.legend) },
      },
    };
  }
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

/** Ad-hoc native objects for the Nash mock-up answers, pinned to one client by a static filter. */
export const nashTile = (kind, id, client) => {
  const f = client ? [{ field: 'Client', view: CL, values: [client] }] : undefined;
  const t = {
    why: () => bridge(id, 'nash', 'g-nash', 'Conversions change by channel, split into drivers', ['Channel', CH], [['Conversions Impressions Effect MoM', 'Reach (impressions)', C.sky], ['Conversions CTR Effect MoM', 'Click-through rate', C.coral], ['Conversions CVR Effect MoM', 'Conversion rate', C.violet]], SINT),
    attention: () => bar(id, 'Conversion value change vs August · by client', ['Client', CL], 'Conversion Value Change MoM', { page: 'nash', group: 'g-nash', format: SGBP, gradient: [C.red, C.grey, C.green], sort: { by: 'm0', direction: 'asc' } }),
    summary: () => bridge(id, 'nash', 'g-nash', 'GA4 key events change by device', ['Device', WV], [['Key Events Sessions Effect MoM', 'Traffic', C.sky], ['Key Events Rate Effect MoM', 'On-site conversion rate', C.violet]], SINT),
    budget: () => bar(id, 'ROAS by channel · September', ['Channel', CH], 'ROAS This Month', { page: 'nash', group: 'g-nash', format: X, gradient: [C.mist, C.teal] }),
  }[kind]();
  return { ...t, filters: f };
};
