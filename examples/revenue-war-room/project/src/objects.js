/**
 * The app's objects: identity colours, the tile declarations and the one path every tile takes
 * from compiled definition to the vSpec that is mounted (theme, axis range, column widths,
 * supporting-measure sort, governed reference lines). app.js runs this path before runtime.mount;
 * tools/compile-adapter.mjs runs the same functions offline.
 */
import { INK, applyEach, themeVSpec } from './lib/theme.js';
import { C, F, FMT, PALETTE, bands, bar, bold, combo, dims, line, progress, running, spark, table, DAY } from './charts.js';

// ------------------------------------------------------------------ identity
Object.assign(C, { navy: '#181818', blue: '#0176D3', teal: '#2E844A', amber: '#DD7A01', red: '#BA0517', green: '#2E844A', grey: '#C9C9C9', violet: '#9050E9', sky: '#1B96FF', pink: '#C23934' });
PALETTE.splice(0, PALETTE.length, '#0176D3', '#2E844A', '#DD7A01', '#9050E9', '#BA0517', '#1B96FF');
Object.assign(INK, { card: '#FFFFFF', cardAlt: '#FAFAF9', line: '#DDDBDA', text: '#181818', muted: '#5C5C5C', dim: '#939393', mist: '#EEF4FF', good: '#2E844A', bad: '#BA0517' });

export const APP = 'rcc';
export const ALL = 'rcc-all';
export const REP = 'rcc-rep'; // the coaching rep focus: its own group, so switching tabs never changes the main selection state
export const OPP = 'Opportunities';
export const REGIONS = [['NA', 'North America'], ['EMEA', 'Europe, Middle East & Africa'], ['APAC', 'Asia Pacific'], ['LATAM', 'Latin America']];
export const CATS = [['Closed Won', 'Won', '#2E844A'], ['Commit', 'Commit', '#0176D3'], ['Best Case', 'Best case', '#9050E9'], ['Pipeline', 'Pipeline', '#C9C9C9']];
export const Q4 = [F(OPP, 'Close Quarter', '2026-Q4')];
export const CLOSER_N = 15;
export const Q4_OPEN = [...Q4, F(OPP, 'Forecast Category', 'Best Case', 'Pipeline')];
export const CLOSED_QS = [F(OPP, 'Close Quarter', '2024-Q1', '2024-Q2', '2024-Q3', '2024-Q4', '2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3')];

// ------------------------------------------------------------------ the objects
export const rk = (code) => REGIONS.find(([c]) => c === code)[1];
export const FC4 = F(OPP, 'Forecast Category', 'Closed Won', 'Commit', 'Best Case', 'Pipeline');
export const YR26 = [F(OPP, 'Close Quarter', '2026-Q1', '2026-Q2', '2026-Q3', '2026-Q4')];
export const MONTHLY = { ref: 'd0', level: 'month', formatType: 'mmmyyyy' };
export const objects = () => [
  // command · forecast categories (value + trend). Won is cumulative monthly bookings this year.
  ...CATS.map(([cat, , color], i) => (cat === 'Closed Won'
    ? { ...spark(APP, `cats-${i}`, 'Closed Won Bookings', [OPP, 'Close Date'], YR26, color), dimensionFormat: MONTHLY, ops: running('m0') }
    : spark(APP, `cats-${i}`, 'Snapshot Forecast', ['Forecast Snapshots', 'Snapshot Date'], [F('Forecast Snapshots', 'Forecast Category', cat), F('Forecast Snapshots', 'Close Quarter', '2026-Q4')], color))),
  // command · regions
  ...REGIONS.map(([code, name]) => spark(APP, `regs-${code}`, 'Snapshot Forecast', ['Forecast Snapshots', 'Snapshot Date'], [F('Sales Regions', 'Region Name', name), F('Forecast Snapshots', 'Close Quarter', '2026-Q4')], '#1B96FF')),
  // command hero · the gap bridge: won → commit → best case → pipeline, a total bar, the target as a governed reference line
  { ...bar(APP, 'fc-cat', 'Q4 forecast bridge', [OPP, 'Forecast Category'], 'Q4 Forecast', { filters: [...Q4, FC4], format: FMT.usdm, colors: ['#0176D3'], limit: 6, barPadding: 30, orientation: 'vertical', extraOps: [{ name: 'setBarChartLayout', payload: 'offset' }] }),
    supportSort: { view: OPP, name: 'Probability', aggregation: 'AVG', direction: 'desc' }, refKey: 'target', refAxis: 'y', refRange: true, zero: true },
  // command · region × category stacked
  { ...bar(APP, 'cat-region', 'Q4 forecast by region and category', ['Sales Regions', 'Region Name'], 'Q4 Forecast', { filters: [...Q4, FC4], format: FMT.usdm, stacked: true, labels: false, legend: true, colors: ['#9050E9', '#2E844A', '#0176D3', '#C9C9C9'], barPadding: 30, limit: 40 }),
    dimensions: dims(['Sales Regions', 'Region Name', 'd0'], [OPP, 'Forecast Category', 'd1']), sort: [{ by: 'd0', direction: 'asc' }, { by: 'd1', direction: 'asc' }], coloring: 'categorical' },
  { ...line(APP, 'trajectory', 'Weekly Q4 forecast', [['Forecast Snapshots', 'Snapshot Date', 'd0']], 'Snapshot Forecast', { format: FMT.usdm, dimensionFormat: DAY(), filters: [F('Forecast Snapshots', 'Close Quarter', '2026-Q4')], colors: ['#0176D3'], legend: false, extraOps: [{ name: 'setMeasureDataLabelsShow', ref: 'm0', payload: { show: false } }, { name: 'setMeasureDataLabelsShow', ref: 'avg', payload: { show: false } }] }), refKey: 'target', refAxis: 'y', refRange: true },

  // deals · gap closer: amount per deal (bars) and the running total (line) against the gap
  { ...bar(APP, 'top-deals', 'Deals that close the gap', [OPP, 'Opp Name'], 'Opportunity Amount', { filters: Q4_OPEN, format: FMT.usdk, colors: ['#0176D3'], limit: CLOSER_N, orientation: 'horizontal', barPadding: 20, extraOps: [{ name: 'setBarChartLayout', payload: 'offset' }] }),
    supportSort: { view: OPP, name: 'Recovery Score', aggregation: 'MAX', direction: 'desc' }, refKey: 'gap', refAxis: 'x' },
  table(APP, 'recovery', 'Recovery list', [[OPP, 'Opp Name', 'opp', 'Opportunity'], ['Reps', 'Rep Name', 'rep', 'Rep']],
    [[{ name: 'Recovery Score', view: OPP, aggregation: 'MAX' }, 'score', 'Score', FMT.score], ['Opportunity Amount', 'amt', 'Amount', FMT.usdk], ['Win Probability', 'prob', 'Win %', FMT.pct0]],
    { filters: Q4_OPEN, sort: [{ by: 'score', direction: 'desc' }, { by: 'amt', direction: 'desc' }], limit: 80, rowHeight: 28, fit: { opp: 0.44, rep: 0.18, score: 0.14, amt: 0.12, prob: 0.1 },
      ops: [...progress('score', '#0176D3', '#EEF4FF'), bold('opp', '#181818'), bold('amt'), ...bands('prob', [[0.3, '#BA0517'], [0.6, '#DD7A01'], [1.01, '#2E844A']])] }),

  // coaching hero · every rep's forecast (bars) against quota (markers); its own group so the rep focus does not narrow it
  { ...combo(APP, 'rep-fq', 'Q4 forecast vs quota', ['Reps', 'Rep Name'], ['Q4 Forecast', { name: 'Q4 Quota', view: 'Reps', aggregation: 'SUM' }], { m0: 'bar', m1: 'line' },
    { limit: 40, measureColors: { m0: '#0176D3', m1: '#BA0517' }, formats: [FMT.usdk, FMT.usdk], sort: { by: 'm0', direction: 'desc' } }), group: ALL },
  { ...bar(APP, 'act-type', 'Activity mix', ['Activities', 'Activity Type'], 'Sales Activities', { colors: ['#2E844A'], limit: 10 }), group: REP },
  { ...bar(APP, 'rep-stage', 'Open pipeline by stage', [OPP, 'Stage'], 'Open Pipeline', { format: FMT.usdk, sort: { by: 'd0', direction: 'asc' }, filters: [F(OPP, 'Forecast Category', 'Commit', 'Best Case', 'Pipeline')], colors: ['#9050E9'], limit: 10 }), group: REP },

  // call
  bar(APP, 'bridge', 'What moved since Monday', ['Forecast Bridge', 'Change Type'], 'Forecast Movement', { format: FMT.susdk, sort: { by: 'm0', direction: 'asc' }, colors: ['#DD7A01'], limit: 10, orientation: 'vertical', barPadding: 30, extraOps: [{ name: 'setBarChartLayout', payload: 'offset' }] }),

  // trends
  combo(APP, 'winrate', 'Win rate and deal size', [OPP, 'Close Quarter'], ['Average Deal Size', 'Win Rate'], { m0: 'bar', m1: 'line' }, { secondary: 'm1', measureColors: { m0: '#C9C9C9', m1: '#2E844A' }, formats: [FMT.usdk, FMT.pct0], filters: CLOSED_QS }),
  { ...line(APP, 'won-q', 'Bookings by quarter', [[OPP, 'Close Quarter', 'd0']], 'Closed Won Bookings', { ref: 'mean', format: FMT.usdm, filters: CLOSED_QS, colors: ['#0176D3'], legend: false, extraOps: [{ name: 'setMeasureDataLabelsShow', ref: 'm0', payload: { show: false } }, { name: 'setMeasureDataLabelsShow', ref: 'avg', payload: { show: false } }] }), refKey: 'quarters', refAxis: 'y', refRange: true },
  bar(APP, 'size-band', 'Win rate by deal size band', ['dimension', 'Deal Size Band'], 'Win Rate', { filters: CLOSED_QS, format: FMT.pct0, colors: ['#DD7A01'], sort: { by: 'd0', direction: 'asc' }, limit: 10 }),
  bar(APP, 'product', 'Q4 forecast by product', [OPP, 'Product'], 'Q4 Forecast', { format: FMT.usdm, colors: ['#9050E9'] }),
];
// ------------------------------------------------------------------ definition → mounted vSpec
/**
 * `ctx`: { availableFields, fields (the field index), dataBinding, widthOf(tile) → the slot's pixel width }.
 * Every step returns the operations it could not apply in `refusals`, so nothing is refused silently.
 */
const apply = async (ctx, tile, vSpec, requests, refusals) => {
  const out = await applyEach({ id: tile.id, type: tile.type, vSpec, dataBinding: ctx.dataBinding }, ctx.availableFields, tile.type, requests);
  refusals.push(...out.failed);
  return out;
};
const AXIS = 'primaryMeasure';
// A bar sorted by a hidden supporting measure (forecast categories by probability, deals by recovery score).
const sortBySupport = async (ctx, tile, vSpec, refusals) => {
  const column = ctx.fields.raw(tile.supportSort.name, tile.supportSort.view);
  if (!column) { refusals.push({ name: 'addSupportingMeasure', reason: `${tile.supportSort.view}.${tile.supportSort.name} missing` }); return vSpec; }
  const added = await apply(ctx, tile, vSpec, [{ name: 'addSupportingMeasure', payload: { sourceKind: 'field', key: column.fieldKey, aggregation: tile.supportSort.aggregation } }], refusals);
  const support = added.vSpec.supportingMeasures?.at(-1)?.dataItem;
  if (!support) { console.warn('[sort]', tile.id, added.failed); if (!added.failed.length) refusals.push({ name: 'addSupportingMeasure', reason: 'no supporting measure was added' }); return vSpec; }
  const item = { dataItemInternalKey: support.internalKey, dataItemUniqueSignature: support.uniqueSignature };
  const toggled = await apply(ctx, tile, added.vSpec, [{ name: 'toggleSortingItem', payload: { ...item, enabled: true } }], refusals);
  const others = (toggled.vSpec.querySettings?.sortingOrder ?? []).filter((e) => e.dataItem?.internalKey !== support.internalKey);
  const sorted = await apply(ctx, tile, toggled.vSpec, [{ name: 'changeSortOrderAndDirection', payload: { changeRequests: [
    { ...item, sortDirection: tile.supportSort.direction, newIndex: 0 },
    ...others.map((e, i) => ({ dataItemInternalKey: e.dataItem.internalKey, dataItemUniqueSignature: e.dataItem.uniqueSignature, sortDirection: e.sortDirection ?? 'asc', newIndex: i + 1 })),
  ] } }], refusals);
  if (sorted.failed.length) console.warn('[sort]', tile.id, sorted.failed);
  return sorted.vSpec;
};
/** A compiled tile → `{ tile: { ...tile, vSpec }, refusals }`: the vSpec that is mounted (before reference lines). */
export const prepareTile = async (ctx, tile) => {
  const refusals = [];
  const themed = await themeVSpec({ id: tile.id, type: tile.type, vSpec: tile.vSpec, dataBinding: ctx.dataBinding }, ctx.availableFields, { ...tile, numberFontSize: tile.type === 'number' ? (tile.id.includes('reg-') ? 22 : 26) : undefined });
  refusals.push(...themed.failed);
  let vSpec = themed.vSpec;
  // visualizations 0.8: the axis range is set with operations, not written into the vSpec
  if (tile.type === 'bar' && vSpec.axes?.primaryMeasure) vSpec = (await apply(ctx, tile, vSpec, [{ name: 'setAxisRangeOption', payload: { axisName: AXIS, axisRangeOption: 'auto' } }, { name: 'setAxisStartsAtZero', payload: { axisName: AXIS, startsAtZero: true } }], refusals)).vSpec;
  if (tile.fitColumns) {
    const w = Math.max(200, (ctx.widthOf(tile) || 800) - 16);
    const reqs = [{ name: 'setTableAllColumnsResponsiveWidth', payload: false }, ...Object.entries(tile.fitColumns).flatMap(([ref, share]) => { const it = tile.resolvedRefs?.[ref]; return it ? [{ name: 'setColumnWidth', payload: { dataItemInternalKey: it.dataItemInternalKey, dataItemUniqueSignature: it.dataItemUniqueSignature, width: `${Math.floor(w * share)}px` } }] : []; })];
    vSpec = (await apply(ctx, tile, vSpec, reqs, refusals)).vSpec;
  }
  if (tile.supportSort) vSpec = await sortBySupport(ctx, tile, vSpec, refusals);
  return { tile: { ...tile, vSpec }, refusals };
};
/**
 * Governed reference lines. Values come from governed queries (`refs`: key → lines); the line itself
 * is drawn by the chart from `vSpec.refLines`. No reference-line operation exists in visualizations
 * 0.8, so that one property is still written directly; the axis range that keeps the line on the
 * plot is set with operations.
 */
export const withRefs = async (ctx, tile, vSpec, refs, refusals = []) => {
  if (!tile.refKey || !refs[tile.refKey]) return vSpec;
  let out = { ...vSpec, refLines: { [tile.refAxis]: refs[tile.refKey] } };
  // keep the line on the plot: the measure axis tops out just above the highest reference value
  if (tile.refRange && out.axes?.primaryMeasure) {
    const top = Math.max(...refs[tile.refKey].map((r) => r.value)) * 1.06;
    out = (await apply(ctx, tile, out, [{ name: 'setAxisRangeOption', payload: { axisName: AXIS, axisRangeOption: 'max' } }, { name: 'setAxisRangeMax', payload: { axisName: AXIS, maxValue: top } }, ...(tile.zero ? [{ name: 'setAxisStartsAtZero', payload: { axisName: AXIS, startsAtZero: true } }] : [])], refusals)).vSpec;
  }
  return out;
};
