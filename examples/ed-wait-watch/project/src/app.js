/**
 * ED Wait Watch — the ED operations lead's and duty managers' morning read of the 30-minute
 * waiting-time target, with a flag-and-hand-off workflow.
 *
 * Native Astrato objects on the "Hospital ER Operations" semantic layer; every object stands for
 * a stored business question (src/catalogue.js → tools/questions.mjs). The app adds layout,
 * selection plumbing, a waiting-target what-if (a layer parameter), an Excel report and the flag
 * workflow (governed writeback, see workflow.js).
 *
 * Selections: one app-wide state (`mainSel`) mirrored into the visible tab's groups only. Each data
 * tab has `g-<tab>` for charts, tables and filters; the board also has `g-board-n` for the KPI
 * numbers, `g-board-k` for their mini lines and `g-board-f` for the flag counts. KPI numbers take
 * every visit field; a month selection reaches them as that month plus the month before (the
 * Review Month axis reads "this month" as the latest month in the filtered rows, so the pair gives
 * the selected month against the one before). Mini lines take every visit field except the month,
 * so they keep the whole history. Flag counts take no visit field (flags do not join to visits).
 * Techniques copied from the labour-market-pulse example (selection mirror, lanes,
 * KPI colouring, table refit, app checks).
 */
import { createAstratoApp } from '@astrato-io/app-runtime';
import { createVisualizationRuntime, registry } from '@astrato-io/visualizations';
import { createVisualizationAvailableFields } from '@astrato-io/visualizations/definitions';
import { applyRuntimeOperations } from '@astrato-io/visualizations/operations';
import { appState } from './app-state.js';
import { throttleQueries, queryLog, clearQueryCache } from './throttle.js';
import { createFieldIndex } from './fields.js';
import { TABS, TILES, FILTERS, C, DAY, plainDay } from './catalogue.js';
import { prepare, columnWidths } from './tiles.js';
import { mountWorkflow } from './workflow.js';
import { exportWorkbook } from './export.js';

export const el = (tag, attrs = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'text') n.textContent = v;
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of [].concat(kids)) if (kid != null) n.append(kid);
  return n;
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const asDate = (v) => new Date(typeof v === 'number' ? v : Date.parse(v));
const monthLabel = (v) => { const d = asDate(v); return Number.isNaN(d.getTime()) ? String(v) : `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
export const pct = (v, dp = 1) => (v == null ? '–' : `${(v * 100).toFixed(dp)}%`);
const num = (v, dp = 0) => (v == null ? '–' : Number(v).toLocaleString('en-GB', { minimumFractionDigits: dp, maximumFractionDigits: dp }));

/** Visit fields every data tab takes; the board's KPI cards take all but the month. */
const VISIT = ['Period', 'Arrival Month', 'Department Referral', 'Time Band', DAY, 'Hour of Day', 'Age Band', 'Race', 'Race Group', 'Gender', 'Wait Band', 'Wait Target'];
const TIME = ['Period', 'Arrival Month'];
const NOTIME = VISIT.filter((f) => !TIME.includes(f));
const FLAG = ['Flag Status', 'Flag Owner', 'Flag ID', 'Event Flag ID'];
/**
 * Groups on the Review Month axis (KPI numbers, the drivers table): a month selection reaches them as that month plus
 * the month before, so the axis reads "this month" as the selected month. Their mini lines (-k) keep every month.
 */
const KPI_SCOPED = new Set(['g-board-n', 'g-board-d', 'g-who-n', 'g-sat-n']);
/**
 * Month-by-month charts (-t): they always show every month (no month filter reaches them), but a click on a month's
 * bar is read back as the reader's month selection, which then reaches every other object.
 */
const TREND = new Set(['g-board-t', 'g-sat-t']);
const SCOPE = {
  'g-board': VISIT, 'g-board-n': VISIT, 'g-board-d': VISIT, 'g-board-k': NOTIME, 'g-board-t': NOTIME, 'g-board-f': [], 'g-sat-t': NOTIME,
  'g-when': VISIT, 'g-who': VISIT, 'g-who-n': VISIT, 'g-who-k': NOTIME, 'g-sat': VISIT, 'g-sat-n': VISIT, 'g-sat-k': NOTIME, 'g-flags': FLAG,
};
const GROUPS_OF = { board: ['g-board', 'g-board-n', 'g-board-d', 'g-board-k', 'g-board-t', 'g-board-f'], when: ['g-when'], who: ['g-who', 'g-who-n', 'g-who-k'], sat: ['g-sat', 'g-sat-n', 'g-sat-k', 'g-sat-t'], flags: ['g-flags'] };
const groupOf = (tile) => (tile.type === 'filter' ? `g-${tile.tab}` : tile.kind === 'kpi' ? `g-${tile.tab}-n` : tile.kind === 'spark' ? `g-${tile.tab}-k`
  : tile.group ? `g-${tile.tab}-${tile.group}`
  : (tile.kind === 'flagnum' || tile.kind === 'flagbar') && tile.tab === 'board' ? 'g-board-f' : `g-${tile.tab}`);
/** Groups whose objects never select (numbers): their state is written by the app, never read back. */
const WRITE_ONLY = new Set(['g-board-n', 'g-who-n', 'g-sat-n', 'g-board-f']);
const LABEL = { 'Period': 'Month', 'Arrival Month': 'Month', 'Department Referral': 'Department', [DAY]: 'Day', 'Hour of Day': 'Hour', 'Time Band': 'Arrival', 'Flag Status': 'Flag status', 'Flag Owner': 'Owner', 'Flag ID': 'Flag', 'Event Flag ID': 'Flag' };

const main = async () => {
  window.__boot = 'start';
  const app = await createAstratoApp();
  throttleQueries(app.client.hostServices);
  const { engine, selections } = app.client.hostServices;
  const metadata = await engine.fields.getFieldMetadata({ ...app.dataBinding });
  const runtime = createVisualizationRuntime({ client: app.client, registry, readyTimeoutMs: 60_000 });
  const availableFields = createVisualizationAvailableFields(metadata).filter((f) => f?.resultType !== 'unhandled');
  appState.fields(availableFields);
  const fields = createFieldIndex(availableFields);
  const dataBinding = { ...app.dataBinding, fieldMetadata: metadata };
  window.__fields = fields; window.__sel = selections; window.__runtime = runtime; window.__app = app;
  const keyOf = (name) => fields.selectionKey(name) ?? fields.dimension(name)?.fieldKey;
  const NAME_BY_KEY = Object.fromEntries([...VISIT, ...FLAG].map((n) => [keyOf(n), n]));
  window.__keys = () => NAME_BY_KEY;

  // ---------------------------------------------------------------- governed query helper (text figures, colours, Excel, workflow)
  // Each governed measure is sent with its own formula string, as the native objects send it: '{m1}' for a ratio
  // such as '{m1} / {m2}' is rejected with HTTP 400 ("Astrato rejected the runtime request").
  const CALC = new Map(availableFields.map((f) => [f.fieldKey, f.item?.calculation?.calculation]));
  const q = async ({ measures = [], dims = [], filters = [], limit = 1000, priority = false }) => {
    const dimensions = dims.map((d) => { const f = fields.dimension(d); if (!f) throw new Error(`no dimension ${d}`); return { itemKey: f.fieldKey, label: d }; });
    const calculations = measures.map((m) => { const f = fields.measure(m); if (!f) throw new Error(`no measure ${m}`); return { calculation: CALC.get(f.fieldKey) || '{m1}', itemKey: f.fieldKey, label: m }; });
    const query = { dimensions, calculations, orders: [], limit, offset: 0, filters, totals: false, showRecordsCount: false, outerViews: [], associativeListFilter: null };
    let response;
    try { ({ response } = await engine.getData({ ...app.dataBinding, ...(priority ? { queryContext: { objectId: 'app-text' } } : {}), query })); }
    catch (error) { throw new Error(`${error?.message ?? error} (query: ${[...dims, ...measures].join(', ')})`); }
    const names = [...dims, ...measures];
    return Object.values(response?.data ?? {}).map((row) => Object.fromEntries(names.map((n, i) => [n, row[i]])));
  };
  window.__q = q;

  // ---------------------------------------------------------------- selection state
  /** App-wide selections: view-column key -> values. */
  const mainSel = new Map();
  const norm = (k) => fields.all.find((f) => f.fieldKey === k && f.kind === 'dimension')?.rawKey ?? k;
  const asSelection = (fieldKey, values) => ({ field: { fieldKey }, fieldKey, kind: 'VALUE', operator: 'inList', values });
  const allowedIn = (group) => new Set((SCOPE[group] ?? []).map(keyOf).filter(Boolean));
  // ---- months: a month picked on the Period filter or clicked on an Arrival Month axis, as 'YYYY-MM'
  const ym = (d) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
  const prevMonth = (p) => { const [y, m] = p.split('-').map(Number); return m === 1 ? `${y - 1}-12` : `${y}-${String(m - 1).padStart(2, '0')}`; };
  const monthsSelected = () => {
    const out = new Set((mainSel.get(keyOf('Period')) ?? []).map(String));
    for (const v of mainSel.get(keyOf('Arrival Month')) ?? []) { const d = asDate(v); if (!Number.isNaN(d.getTime())) out.add(ym(d)); }
    return [...out].sort();
  };
  /** The KPI numbers' months: the selected months plus the month before the latest one. */
  // When the selected month holds no visits for the rest of the selection, the axis would read "this month"
  // as the month before (the latest rows left): readBoard then drops the month before, so the cards go empty.
  let monthEmpty = false;
  const kpiMonths = () => { const ms = monthsSelected(); return ms.length ? (monthEmpty ? ms : [...new Set([...ms, prevMonth(ms.at(-1))])]) : null; };
  const TIME_KEYS = () => new Set(TIME.map(keyOf));
  const scopedFor = (group) => {
    if (KPI_SCOPED.has(group)) {
      const base = [...mainSel].filter(([k]) => allowedIn(group).has(k) && !TIME_KEYS().has(k)).map(([k, v]) => asSelection(k, v));
      const ms = kpiMonths();
      return ms ? [...base, asSelection(keyOf('Period'), ms)] : base;
    }
    return [...mainSel].filter(([k]) => allowedIn(group).has(k)).map(([k, v]) => asSelection(k, v));
  };
  const selFilters = (group) => scopedFor(group).map(({ fieldKey, values }) => ({ fieldKey, operator: 'inList', values }));
  const readGroup = (g) => {
    const { applied = [] } = selections.getSelection(g) ?? {};
    return new Map(applied.filter((x) => x.values?.length).map((x) => [norm(x.field?.fieldKey ?? x.fieldKey), x.values]));
  };
  let current = 'board';
  let mirroring = false;
  const sig = (m) => JSON.stringify([...m].sort(([a], [b]) => a.localeCompare(b)));
  const mirrorInto = (tab) => {
    mirroring = true;
    // Only groups whose state differs: re-setting the group a click came from makes its objects query twice.
    for (const g of GROUPS_OF[tab] ?? []) {
      const want = scopedFor(g);
      if (sig(readGroup(g)) === sig(new Map(want.map((x) => [x.fieldKey, x.values])))) continue;
      selections.setNewSelectionState(g, { applied: want, pending: [] });
    }
    mirroring = false;
  };

  // ---------------------------------------------------------------- shell
  const root = document.getElementById('root');
  const tabsNav = el('nav', { class: 'tabs', role: 'tablist' });
  const selBar = el('div', { class: 'selbar', 'aria-live': 'polite' });
  const body = el('main', { class: 'content' });
  const exportBtn = el('button', { class: 'btn', title: 'Download the morning report as Excel, following the current selections' }, [el('span', { text: '⤓ Excel report' })]);
  const asOf = el('small', { class: 'asof', text: 'Reading the latest day in the data…' });
  root.replaceChildren(
    el('header', { class: 'top' }, [
      el('div', { class: 'brand' }, [el('span', { class: 'mark', 'aria-hidden': 'true', text: '30' }), el('div', {}, [el('b', { text: 'ED Wait Watch' }), asOf])]),
      tabsNav,
      el('div', { class: 'tools' }, [exportBtn]),
    ]),
    selBar, body,
    el('footer', { class: 'source', text: 'Source: Hospital ER Operations semantic layer (Astrato). Target: seen within 30 minutes of arrival. Satisfaction is recorded for about 27% of visits.' }),
  );

  // ---------------------------------------------------------------- tiles
  const tiles = new Map();
  const failures = [];
  const resolved = new Map();
  await Promise.all([...TILES, ...FILTERS].map(async (tile) => {
    try {
      const out = await prepare(tile, fields, availableFields);
      if (out.refusals.length) console.warn('[ops refused]', tile.id, out.refusals);
      tiles.set(tile.id, { ...tile, vSpec: out.vSpec });
      resolved.set(tile.id, out.resolvedRefs);
    } catch (error) {
      failures.push({ id: tile.id, reason: String(error?.message ?? error) });
      console.error('[tile]', tile.id, String(error?.message ?? error));
    }
  }));
  window.__astrato = { failures, tiles: [...tiles.keys()] };

  // ---------------------------------------------------------------- slots and mounting
  const queue = [];
  const handles = new Map();
  const slots = new Map();
  const slot = (id, cls = '') => {
    const s = el('div', { class: `viz ${cls}`, 'data-slot': id }, el('div', { class: 'loading', text: 'Loading…' }));
    if (tiles.has(id)) { queue.push([id, s]); slots.set(id, s); }
    else s.replaceChildren(el('p', { class: 'note', text: `Not available: ${failures.find((f) => f.id === id)?.reason ?? id}` }));
    return s;
  };
  const tileOf = (id) => TILES.find((x) => x.id === id);
  const card = (id, cls = '', extra = null) => {
    const t = tileOf(id);
    return el('figure', { class: `card ${cls}`, 'data-card': id }, [
      el('figcaption', {}, [el('span', { class: 'q', text: t.q, title: t.description ?? t.q }), el('small', { class: 'sub', text: t.sub ?? t.description ?? '' })]),
      slot(id), extra,
    ]);
  };
  const kpiCard = (id) => {
    const t = tileOf(id);
    return el('figure', { class: `card kpi${t.hero ? ' hero' : ''}`, 'data-card': id }, [
      el('figcaption', {}, [el('span', { class: 'q', text: t.label, title: t.q }), el('small', { class: 'unit', text: t.unit })]),
      el('div', { class: 'kpi-row' }, [slot(id, 'kpi-num'), slot(`${id}-sp`, 'kpi-spark')]),
      el('small', { class: 'kpi-cmp', 'data-cmp': id, text: 'Comparing with the month before…' }),
    ]);
  };
  const flagNum = (id) => {
    const t = tileOf(id);
    return el('div', { class: `flagnum${t.alarm ? ' alarm' : ''}`, 'data-card': id, title: t.q }, [el('small', { text: t.label }), slot(id, 'fn')]);
  };
  /** The flag counts' mini chart: flags by status, a native bar (the counts are snapshots, so no period comparison). */
  const flagBar = (id) => el('div', { class: 'flagnum flagbar', 'data-card': id, title: tileOf(id).q }, [el('small', { text: 'By status' }), slot(id, 'fn')]);
  const filterStrip = (tab) => el('div', { class: 'filters' }, FILTERS.filter((f) => f.tab === tab).map((f) => el('label', { class: 'filter', title: `Filter by ${f.label.toLowerCase()}` }, [slot(f.id, 'filter-slot')])));

  const mountOne = async (id, s) => {
    const t = tiles.get(id);
    appState.declare(id, t.tab ?? null);
    if (!runtime.listInstances().some((i) => i.id === id)) runtime.createInstance({ id, type: t.type, groupId: groupOf(t), vSpec: t.vSpec, dataBinding: { ...dataBinding, queryContext: { objectId: id } } });
    try {
      const h = await runtime.mount(s, id);
      handles.set(id, h);
      h.ready.then((r) => {
        s.querySelector(':scope > .loading')?.remove();
        appState.settle(id, r?.status, r);
        if (r?.status !== 'rendered') console.error('[object]', id, r?.status);
        if (t.kind === 'kpi') scheduleBoard();
        if (t.widths) fitTable(id);
      });
    } catch (error) {
      appState.settle(id, 'error', error);
      console.error('[mount]', id, error);
    }
  };
  /** Re-query objects after a write: unmount and mount again into the same slot. */
  const remount = async (ids) => {
    for (const id of ids) {
      const s = slots.get(id);
      if (!s || !handles.has(id)) continue;
      try { handles.get(id).unmount(); } catch { /* gone */ }
      handles.delete(id);
      try { runtime.destroyInstance?.(id); } catch { /* older runtime */ }
      s.replaceChildren(el('div', { class: 'loading', text: 'Loading…' }));
      await mountOne(id, s);
    }
  };
  const fitted = new Map();
  const fitTable = async (id) => {
    const t = tiles.get(id); const s = slots.get(id); const refs = resolved.get(id);
    if (!t?.widths || !s || !refs || !handles.has(id)) return;
    const w = Math.round(s.clientWidth) - 28;
    if (w < 200 || fitted.get(id) === w) return;
    fitted.set(id, w);
    const operationRequests = Object.entries(columnWidths(t, w)).filter(([ref]) => refs[ref])
      .map(([ref, px]) => ({ id: `w-${ref}`, name: 'setColumnWidth', payload: { dataItemInternalKey: refs[ref].dataItemInternalKey, dataItemUniqueSignature: refs[ref].dataItemUniqueSignature, width: `${px}px` } }));
    try {
      const r = await applyRuntimeOperations({ runtime, instanceId: id, availableFields, operationRequests });
      const bad = Object.entries(r.results ?? {}).filter(([, x]) => !x?.success);
      if (bad.length) console.warn('[fit refused]', id, JSON.stringify(bad).slice(0, 300));
    } catch (error) { console.warn('[fit]', id, error?.message); }
  };
  const fitAll = () => { for (const id of handles.keys()) if (tiles.get(id)?.widths) fitTable(id); };
  let fitTimer;
  window.addEventListener('resize', () => { clearTimeout(fitTimer); fitTimer = setTimeout(fitAll, 250); });

  /** Visible tab first (main objects, then mini charts), then the rest; four lanes, each released once mount() returns. */
  const runQueue = async () => {
    const rank = (id) => (tiles.get(id)?.tab === current ? 0 : 2) + (id.endsWith('-sp') ? 1 : 0);
    const order = [...queue].sort(([a], [b]) => rank(a) - rank(b));
    queue.length = 0;
    const lanes = Array.from({ length: 4 }, async () => { while (order.length) { const [id, s] = order.shift(); await mountOne(id, s); } });
    await Promise.all(lanes);
  };

  // ---------------------------------------------------------------- period label (from the data, not hard-coded)
  const period = { now: 'this month', before: 'the month before' };
  const readPeriod = async () => {
    try {
      const months = await q({ dims: ['Period'], measures: ['Patients This Month', 'Patients Last Month'] });
      const cur = months.filter((r) => Number(r['Patients This Month']) > 0).map((r) => r.Period).sort().pop();
      const prev = months.filter((r) => Number(r['Patients Last Month']) > 0).map((r) => r.Period).sort().pop();
      const days = await q({ dims: ['Arrival Date'], measures: ['Patients'], filters: [{ fieldKey: keyOf('Period'), operator: 'inList', values: [cur] }] });
      const last = days.map((r) => asDate(r['Arrival Date'])).filter((d) => !Number.isNaN(d.getTime())).sort((a, b) => a - b).pop();
      const [y, m] = cur.split('-').map(Number); const [py, pm] = prev.split('-').map(Number);
      const dd = last ? last.getUTCDate() : '?';
      period.now = `1–${dd} ${MONTHS[m - 1]} ${y}`;
      period.before = `1–${dd} ${MONTHS[pm - 1]} ${py}`;
      period.beforeShort = `1–${dd} ${MONTHS[pm - 1]}`;
      period.lastDay = last;
      period.latestMonth = cur;
      period.dataTo = `Data to ${dd} ${MONTHS[m - 1]} ${y}`;
      asOf.textContent = `${period.dataTo} · cards compare ${period.now} with ${period.before}`;
    } catch (error) { console.warn('[period]', error?.message); asOf.textContent = 'Cards compare the latest month to date with the same days of the month before'; }
  };

  // ---------------------------------------------------------------- the KPI cards' window, as words
  // No month selected: the latest month to date against the same days of the month before (readPeriod).
  // A month selected: that month (to its last day in the data) against the same days of the month before.
  const daysIn = (p) => { const [y, m] = p.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); };
  const monthName = (p) => { const [y, m] = p.split('-').map(Number); return [MONTHS[m - 1], y]; };
  const periodNow = () => {
    const ms = monthsSelected();
    if (!ms.length) return period;
    const cur = ms.at(-1); const prev = prevMonth(cur);
    const dd = cur === period.latestMonth && period.lastDay ? period.lastDay.getUTCDate() : daysIn(cur);
    const [cm, cy] = monthName(cur); const [pm, py] = monthName(prev);
    const pd = Math.min(dd, daysIn(prev));
    return { now: `1–${dd} ${cm} ${cy}`, before: `1–${pd} ${pm} ${py}`, beforeShort: `1–${pd} ${pm}`, selected: true };
  };

  // ---------------------------------------------------------------- KPI colours, captions and the headline: one read per selection
  // One query carries every KPI's this-month, last-month and change measures plus the stored over-target
  // share for the sentence; a second finds the worst slot. Before, each card and the headline asked
  // separately (six queries per selection).
  const KPI_TILES = TILES.filter((x) => x.kind === 'kpi');
  // One small query per KPI family, run side by side: a single query carrying all fifteen period measures took ~5 s.
  const familyOf = (t) => t.prior;
  const BOARD_SETS = [...new Map(KPI_TILES.map((t) => [familyOf(t), [t.measures[0].m, t.measures.find((m) => m.role === 'comparison').m, t.prior]])).values()]
    .map((ms, i) => (i === 0 ? [...ms, 'Waited Over Target % This Month'] : ms));
  const hero = el('div', { class: 'headline', 'data-hero': '' }, el('span', { text: 'Reading the latest month…' }));
  const shownColour = new Map();
  /**
   * Text figures (headline, KPI captions) must never show one selection's words beside another's numbers: on every
   * selection change they switch to "Updating…" at once, and only the read for the current selection may fill them.
   */
  const markUpdating = () => {
    hero.classList.add('updating'); hero.dataset.state = 'updating';
    hero.replaceChildren(el('span', { class: 'verdict none', text: 'Updating' }), el('p', { text: 'Reading the figures for the new selection…' }));
    for (const t of KPI_TILES) { const l = document.querySelector(`[data-cmp="${t.id}"]`); if (l) { l.textContent = 'Updating…'; l.style.color = C.grey; l.dataset.state = 'updating'; } }
  };
  let boardTimer; let boardRun = 0;
  let boardPromise = Promise.resolve();
  /** Resolves once the text figures show the current selection (checks wait on it; so could a reader's screenshot). */
  const boardIdle = async () => { let p; do { p = boardPromise; await p; } while (p !== boardPromise); };
  window.__boardIdle = boardIdle;
  const runBoard = () => { boardPromise = readBoard().catch((error) => console.error('[board]', error?.message)); return boardPromise; };
  const scheduleBoard = () => { clearTimeout(boardTimer); boardTimer = setTimeout(runBoard, 80); };
  const readBoard = async () => {
    const run = ++boardRun;
    const per = periodNow();
    asOf.textContent = `${period.dataTo ?? ''}${period.dataTo ? ' · ' : ''}cards compare ${per.now} with ${per.before}`;
    let row; let slotRows;
    try {
      const kf = selFilters('g-board-n');
      const [sets, slots] = await Promise.all([
        Promise.all(BOARD_SETS.map((measures) => q({ measures, filters: kf, priority: true }))),
        q({ dims: ['Time Band', DAY], measures: ['Seen Within Target %', 'Patients'], filters: selFilters('g-board'), priority: true }),
      ]);
      row = Object.assign({}, ...sets.map(([r]) => r ?? {}));
      slotRows = slots;
    } catch (error) { if (run === boardRun) { hero.textContent = 'The headline could not be read.'; console.error('[board]', error?.message); } return; }
    if (run !== boardRun) return;
    const empty = Boolean(per.selected) && !slotRows.some((x) => Number(x.Patients) > 0);
    if (empty !== monthEmpty) { monthEmpty = empty; mirrorInto(current); return readBoard(); }
    // KPI comparison captions and colours (the sign of the stored change measure, read against whether a rise is good)
    for (const t of KPI_TILES) {
      const cmp = t.measures.find((m) => m.role === 'comparison');
      const d = row?.[cmp.m]; const before = row?.[t.prior];
      const flat = d == null || Math.abs(d) < 1e-9;
      const good = flat || t.up === 'neutral' ? null : (d > 0) === (t.up === 'good');
      const colour = good == null ? C.grey : good ? C.green : C.red;
      const shown = t.unit === '%' ? pct(before) : num(before, t.unit === '' ? 0 : 1);
      const word = d == null ? 'No comparison' : flat ? '■ unchanged' : t.up === 'neutral' ? (d > 0 ? '▲ more' : '▼ fewer') : good ? '▲ better' : '▼ worse';
      const label = document.querySelector(`[data-cmp="${t.id}"]`);
      if (label) {
        label.textContent = monthEmpty ? `No visits in ${per.now}` : d == null ? `No comparison for ${per.beforeShort ?? per.before}` : `${word} than ${shown} (${per.beforeShort ?? per.before})`;
        label.style.color = colour; label.dataset.value = String(d ?? ''); label.dataset.v = String(row?.[t.measures[0].m] ?? ''); label.dataset.state = 'settled';
      }
      if (handles.has(t.id) && shownColour.get(t.id) !== colour) {
        shownColour.set(t.id, colour);
        applyRuntimeOperations({ runtime, instanceId: t.id, availableFields, operationRequests: [{ id: 'c', name: 'setComparisonFontColor', payload: colour }] })
          .catch((error) => console.warn('[kpi colour]', t.id, error?.message));
      }
    }
    // Headline: every figure is a stored measure; the over-target share is its own measure, not 1 − x in the app.
    // The worst slot is the lowest stored share among slots with at least 30 visits (a small slot swings too much to name).
    const w = row?.['Seen Within Target % This Month']; const dPts = row?.['Seen Within Target pts Change vs Last Month'];
    const over = row?.['Waited Over Target % This Month']; const n = row?.['Patients This Month'];
    const worst = slotRows.filter((x) => Number(x.Patients) >= 30 && x['Seen Within Target %'] != null).sort((a, b) => a['Seen Within Target %'] - b['Seen Within Target %'])[0];
    hero.dataset.within = String(w ?? '');
    hero.classList.remove('updating'); hero.dataset.state = 'settled';
    if (w == null || !Number(n)) { hero.replaceChildren(el('span', { class: 'verdict none', text: 'No visits' }), el('p', { text: `No visits in ${per.now} for this selection. Clear a selection to widen it.` })); return; }
    const dir = dPts == null ? '' : dPts >= 0 ? `up <em>${dPts.toFixed(1)} pts</em>` : `down <em class="down">${Math.abs(dPts).toFixed(1)} pts</em>`;
    const day = worst ? plainDay(worst[DAY]) : '';
    hero.replaceChildren(
      el('span', { class: `verdict ${w >= 0.5 ? 'ok' : 'miss'}`, text: w >= 0.5 ? 'Most seen in time' : 'Target missed' }),
      el('p', { html: `<b>${pct(w, 0)}</b> of the ${num(n)} patient${Number(n) === 1 ? '' : 's'} who arrived in ${per.now} were seen within 30 minutes${dir ? `, ${dir} on ${per.before}` : ' (no month before to compare with)'} — <b>${pct(over, 0)}</b> waited longer.${worst ? ` Worst slot${per.selected ? ' in this selection' : ' on record'}: <b>${day} ${worst['Time Band']}</b> (${pct(worst['Seen Within Target %'], 0)} seen in time).` : ''}` }),
    );
  };

  // ---------------------------------------------------------------- selection bar
  const chipLabel = (key, values) => {
    const name = NAME_BY_KEY[key] ?? fields.nameOf(key);
    const shown = name === 'Arrival Month' ? values.map(monthLabel) : values.map((v) => (typeof v === 'string' ? plainDay(v) : String(v)));
    return [LABEL[name] ?? name, shown.slice(0, 3).join(', ') + (shown.length > 3 ? ` +${shown.length - 3}` : '')];
  };
  const appliesHere = (key) => (GROUPS_OF[current] ?? []).some((g) => allowedIn(g).has(key));
  const renderSelBar = () => {
    const chips = [...mainSel].map(([key, values]) => {
      const [name, text] = chipLabel(key, values);
      const here = appliesHere(key);
      const time = TIME.map(keyOf).includes(key);
      const note = !here ? 'Does not apply on this tab' : current === 'board' && time ? 'KPI cards show the latest selected month against the month before; their mini lines keep every month' : '';
      return el('span', { class: `chip${here ? '' : ' off'}`, title: note }, [
        el('i', { text: name }), document.createTextNode(text),
        el('button', { text: '×', 'aria-label': `Remove ${name}`, onclick: () => { mainSel.delete(key); afterMainChange(); } }),
      ]);
    });
    selBar.replaceChildren(...[
      el('b', { text: 'Selections' }),
      ...(chips.length ? chips : [el('span', { class: 'none', text: 'None. Pick a month, department, arrival band or day above, or click any bar, cell or row.' })]),
      chips.length ? el('button', { class: 'clear', text: 'Clear all', onclick: () => { mainSel.clear(); afterMainChange(); } }) : null,
    ].filter(Boolean));
  };
  const afterMainChange = () => {
    mirrorInto(current); renderSelBar();
    clearTimeout(boardTimer); markUpdating(); runBoard();
    for (const fn of hooks.selection ?? []) fn(mainSel);
  };

  // Every group: auto-apply pending selections; the visible tab's applied changes become the app's state.
  for (const [tab, groups] of Object.entries(GROUPS_OF)) for (const g of groups) {
    let timer;
    selections.onActiveSelectionChange(g).subscribe((next) => {
      clearTimeout(timer);
      if (next.pending?.length) { timer = setTimeout(() => selections.applyPendingSelections(g), 200); return; }
      if (mirroring || tab !== current || WRITE_ONLY.has(g)) return;
      const fromGroup = readGroup(g);
      let changed = false;
      const readable = TREND.has(g) ? new Set([...allowedIn(g), ...TIME_KEYS()]) : allowedIn(g);
      for (const k of readable) {
        if (KPI_SCOPED.has(g) && TIME_KEYS().has(k)) continue; // the month pair is the app's own scoping, not a reader's pick
        const a = JSON.stringify(mainSel.get(k) ?? null); const b = JSON.stringify(fromGroup.get(k) ?? null);
        if (a !== b) { changed = true; if (fromGroup.has(k)) mainSel.set(k, fromGroup.get(k)); else mainSel.delete(k); }
      }
      if (changed) afterMainChange();
      else if (TREND.has(g)) mirrorInto(current); // put the trend back to every month
    });
  }

  // ---------------------------------------------------------------- what-if: the waiting-time target (layer parameter)
  const whatIfCard = () => {
    const input = el('input', { type: 'range', min: '15', max: '45', step: '5', value: '30', 'aria-label': 'Waiting-time target in minutes' });
    const out = el('b', { class: 'target-out', text: '30 min' });
    const reset = el('button', { class: 'link', text: 'Reset to 30', onclick: () => { input.value = '30'; input.dispatchEvent(new Event('change')); } });
    let timer;
    const apply = async () => {
      const v = Number(input.value);
      out.textContent = `${v} min`;
      document.querySelectorAll('[data-wi-target]').forEach((n) => { n.textContent = `${v} min`; });
      for (const id of ['w-within', 'w-over']) {
        const refs = resolved.get(id)?.v;
        if (!refs) continue;
        try {
          const r = await applyRuntimeOperations({ runtime, instanceId: id, availableFields, operationRequests: [{ id: 'p', name: 'setMeasureDefinedParameter', payload: { dataItemInternalKey: refs.dataItemInternalKey, dataItemUniqueSignature: refs.dataItemUniqueSignature, parameterName: 'Target Minutes', value: { type: 'static', value: v } } }] });
          if (!r.results?.p?.success) console.error('[what-if refused]', id, JSON.stringify(r.results?.p));
        } catch (error) { console.error('[what-if]', id, error?.message); }
      }
    };
    input.addEventListener('input', () => { out.textContent = `${input.value} min`; clearTimeout(timer); timer = setTimeout(apply, 350); });
    input.addEventListener('change', () => { clearTimeout(timer); apply(); });
    window.__setTarget = (v) => { input.value = String(v); input.dispatchEvent(new Event('change')); };
    return el('figure', { class: 'card whatif', 'data-card': 'whatif' }, [
      el('figcaption', {}, [el('span', { class: 'q', text: 'What if the waiting-time target were different?' }), el('small', { class: 'sub', text: 'Governed measures with the layer\'s Target Minutes parameter, following the selections.' })]),
      el('div', { class: 'wi-row' }, [el('label', {}, [el('span', { text: 'Target' }), input]), out, reset]),
      el('div', { class: 'wi-nums' }, [
        el('div', {}, [el('small', { text: 'Seen within 30 min (baseline)' }), slot('w-base', 'w-num')]),
        el('div', {}, [el('small', {}, ['Seen within ', el('span', { 'data-wi-target': '', text: '30 min' })]), slot('w-within', 'w-num')]),
        el('div', {}, [el('small', {}, ['Waited over ', el('span', { 'data-wi-target': '', text: '30 min' })]), slot('w-over', 'w-num')]),
      ]),
    ]);
  };

  // ---------------------------------------------------------------- panes
  const panes = {};
  const hooks = {};
  const pane = (tab, kids) => {
    const t = TABS.find((x) => x.key === tab);
    panes[tab] = el('section', { class: `pane pane-${tab}`, 'data-pane': tab }, [
      el('div', { class: 'pane-head' }, [el('h1', { text: t.question }), filterStrip(tab)]),
      el('div', { class: 'pane-body' }, kids),
    ]);
    return panes[tab];
  };
  const flagSlotBtn = el('button', { class: 'btn ghost small', text: 'Flag the selected slot →', title: 'Open the flag form with the selected weekday, arrival band and department filled in' });

  body.append(
    pane('board', [
      hero,
      // The board reads left to right: where we stand (cards), where it hurts (slot map), how it moved and who moved it.
      el('div', { class: 'board-grid' }, [
        el('div', { class: 'board-kpis' }, [
          ...['k-within', 'k-wait', 'k-sat', 'k-pat'].map(kpiCard),
          el('figure', { class: 'card flags-mini', 'data-card': 'flags-mini' }, [
            el('figcaption', {}, [el('span', { class: 'q', text: 'Flags handed to owners' }), el('button', { class: 'link', text: 'Open →', onclick: () => go('flags') })]),
            el('div', { class: 'flagnums' }, [...['n-open', 'n-overdue', 'n-signoff'].map(flagNum), flagBar('m-flags')]),
          ]),
        ]),
        card('c-slots', 'slots', el('div', { class: 'card-foot' }, [el('small', { text: 'Click a cell to select that slot, then hand it to an owner.' }), flagSlotBtn])),
        el('div', { class: 'board-right' }, [card('c-trend', 'trend'), card('t-drivers', 'drivers')]),
      ]),
    ]),
    pane('when', [
      el('div', { class: 'row upper' }, [card('c-hour', 'w60'), card('c-weekday', 'w40')]),
      el('div', { class: 'row lower' }, [card('t-slots', 'w62'), whatIfCard()]),
    ]),
    pane('who', [
      el('div', { class: 'side-grid' }, [
        el('div', { class: 'kpi-col' }, ['kw-within', 'kw-wait'].map(kpiCard)),
        el('div', { class: 'side-main' }, [
          el('div', { class: 'row upper' }, [card('c-dept', 'w36'), card('t-dept', 'w64')]),
          el('div', { class: 'row lower' }, [card('c-age', 'w34'), card('c-race', 'w38'), card('c-gender', 'w28')]),
        ]),
      ]),
    ]),
    pane('sat', [
      el('div', { class: 'side-grid' }, [
        el('div', { class: 'kpi-col' }, ['ks-sat', 'ks-within'].map(kpiCard)),
        el('div', { class: 'side-main' }, [
          el('div', { class: 'row upper' }, [card('c-satband', 'w40'), card('c-sattrend', 'w60')]),
          el('div', { class: 'row lower' }, [card('c-sattarget', 'w30'), card('t-satdept', 'w70')]),
        ]),
      ]),
    ]),
    pane('flags', [
      el('div', { class: 'flags-layout' }, [
        el('div', { class: 'wf-host', 'data-workflow': '' }),
        el('div', { class: 'flags-right' }, [
          el('div', { class: 'row flagcounts' }, [
            el('figure', { class: 'card flags-mini wide' }, [el('figcaption', {}, [el('span', { class: 'q', text: 'Where do the flags stand?' })]), el('div', { class: 'flagnums' }, [...['n-open2', 'n-overdue2', 'n-signoff2'].map(flagNum), flagBar('m-flags2')])]),
            card('c-owner', 'w50'),
          ]),
          card('t-flags', 'tall'),
          card('t-events', 'mid'),
        ]),
      ]),
    ]),
  );

  // ---------------------------------------------------------------- tabs
  const syncPaneWidth = () => { const w = panes[current]?.getBoundingClientRect().width; if (w > 100) document.documentElement.style.setProperty('--pane-w', `${Math.round(w)}px`); };
  window.addEventListener('resize', () => requestAnimationFrame(syncPaneWidth));
  const go = (key) => {
    current = key;
    for (const [k, p] of Object.entries(panes)) p.classList.toggle('on', k === key);
    for (const b of tabsNav.querySelectorAll('button')) b.setAttribute('aria-selected', String(b.dataset.tab === key));
    syncPaneWidth();
    requestAnimationFrame(fitAll);
    mirrorInto(key);
    renderSelBar();
    for (const fn of hooks[key] ?? []) fn();
  };
  window.__go = go;
  for (const t of TABS) {
    tabsNav.append(el('button', { role: 'tab', 'data-tab': t.key, text: t.label, onclick: () => go(t.key) }));
    appState.tab(t.key, () => go(t.key));
  }
  go(new URLSearchParams(location.search).get('tab') ?? 'board');

  // ---------------------------------------------------------------- workflow
  const FLAG_OBJECTS = ['n-open', 'n-overdue', 'n-signoff', 'n-open2', 'n-overdue2', 'n-signoff2', 'c-owner', 't-flags', 't-events'];
  // Count every governed write attempt, so a check can prove it wrote nothing.
  let writebackCalls = 0;
  if (typeof app.writeback === 'function') {
    const wb = app.writeback.bind(app);
    try { app.writeback = (...a) => { writebackCalls += 1; return wb(...a); }; } catch { /* a frozen app object: the panel's own counter still holds */ }
  }
  const workflow = mountWorkflow(document.querySelector('[data-workflow]'), {
    app, q, keyOf, mainSel, selections, period, plainDay,
    onWritten: async () => { clearQueryCache(); await remount(FLAG_OBJECTS); },
    hooks,
  });
  flagSlotBtn.addEventListener('click', () => { workflow.prefillFromSelection(); go('flags'); });

  await readPeriod();
  runBoard();
  await runQueue();
  appState.mark('landing-ready');
  workflow.ready();

  // ---------------------------------------------------------------- Excel
  exportBtn.addEventListener('click', async () => {
    exportBtn.disabled = true;
    window.__lastExportError = null;
    try { await exportWorkbook({ q, keyOf, mainSel, chipLabel, selFilters, period: periodNow() }); }
    catch (error) { window.__lastExportError = String(error?.message ?? error); exportBtn.title = `Export failed: ${window.__lastExportError}`; console.error('[export]', error); }
    finally { exportBtn.disabled = false; }
  });

  // ---------------------------------------------------------------- app checks for the smoke test
  // Selections go in the way a reader's click or dropdown puts them: as a PENDING selection in the object's group,
  // which the app's own subscription applies (the same path a chart click takes). No check writes to the warehouse.
  const settle = (ms) => new Promise((r) => setTimeout(r, ms));
  const quiet = () => appState.quiet({ quietMs: 2500, paintMs: 1500, timeoutMs: 30000 });
  /** Native objects quiet AND the text figures (headline, KPI captions) read for the current selection. */
  const settled = async () => { await settle(350); await quiet(); await boardIdle(); };
  const clearAll = async () => { const b = selBar.querySelector('button.clear'); if (b) b.click(); else { mainSel.clear(); afterMainChange(); } await settled(); };
  window.__clear = clearAll;
  const digest = async (id) => {
    const h = handles.get(id);
    const r = await h?.getData?.({ limit: 2000 }).catch((e) => ({ error: e?.message }));
    const rows = Object.values(r?.data?.response?.data ?? r?.data?.data ?? r?.data ?? {});
    const flat = JSON.stringify(rows);
    let sum = 0; for (const v of flat.match(/-?\d+(\.\d+)?/g) ?? []) sum += Number(v);
    return `${rows.length}r:${sum.toFixed(3)}`;
  };
  window.__digest = digest;
  const snap = async (ids) => Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await digest(id)])));
  /** A click or a dropdown pick: pending in the object's group; the app applies it and spreads it to the other groups. */
  const pick = async (group, name, values) => {
    const pending = new Promise((resolve) => { const sub = selections.onActiveSelectionChange(group).subscribe((x) => { if (x.pending?.length) { resolve(true); setTimeout(() => sub.unsubscribe?.(), 0); } }); setTimeout(() => resolve(false), 3000); });
    selections.selectValues(group, asSelection(keyOf(name), values), { state: 'pending' });
    const sawPending = await pending;
    await settled();
    const applied = JSON.stringify(mainSel.get(keyOf(name)) ?? null) === JSON.stringify(values);
    if (!sawPending || !applied) throw new Error(`${name} = ${values.join(',')} in ${group}: pending seen ${sawPending}, applied ${applied}`);
  };
  const selectionCheck = (tab, label, ids, act) => appState.check(`${tab}: ${label} (pending → applied) changes ${ids.join(', ')}; Clear all restores them`, async () => {
    go(tab); await settled();
    const before = await snap(ids);
    const q0 = queryLog().length; const t0 = performance.now();
    await act();
    const during = await snap(ids);
    const log = queryLog().slice(q0).filter((e) => !e.prefetch);
    const queries = log.filter((e) => !e.cached).length;
    const ms = Math.round(performance.now() - t0);
    await clearAll();
    const after = await snap(ids);
    const changed = ids.filter((id) => during[id] !== before[id]);
    const restored = ids.filter((id) => after[id] === before[id]);
    (window.__verify ??= []).push({ tab, label, before, during, after, queries, cached: log.length - queries, ms });
    return { pass: changed.length === ids.length && restored.length === ids.length, detail: `changed ${changed.join(',') || 'none'}; restored ${restored.join(',') || 'none'}; ${queries} engine queries (+${log.length - queries} cached) in ${ms} ms` };
  });
  // Each tab: a KPI, a chart and a table change.
  selectionCheck('board', 'heat-map click on a slot (Wed)', ['k-within', 'c-trend', 't-drivers'], () => pick('g-board', DAY, ['\u200B\u200BWed']));
  selectionCheck('when', 'click a time band (21-24h)', ['w-base', 'c-hour', 'c-weekday', 't-slots'], () => pick('g-when', 'Time Band', ['21-24h']));
  selectionCheck('who', 'click a department (Orthopedics)', ['kw-within', 'c-age', 'c-race', 't-dept'], () => pick('g-who', 'Department Referral', ['Orthopedics']));
  selectionCheck('sat', 'click a wait band (40-49 min)', ['ks-within', 'c-sattarget', 't-satdept'], () => pick('g-sat', 'Wait Band', ['40-49 min']));
  selectionCheck('sat', 'Month = 2020-06 from the Month dropdown', ['ks-sat', 'c-satband', 't-satdept'], () => pick('g-sat', 'Period', ['2020-06']));
  appState.check('Selections hold across tabs: Department on When reaches the board KPI', async () => {
    go('board'); await settled();
    const base = await digest('k-within');
    go('when'); await settled();
    await pick('g-when', 'Department Referral', ['Cardiology']);
    go('board'); await settled();
    const chip = selBar.textContent.includes('Cardiology');
    const d = await digest('k-within');
    await clearAll();
    const after = await digest('k-within');
    return { pass: chip && d !== base && after === base, detail: `chip ${chip}; KPI ${base} -> ${d} -> ${after}` };
  });
  appState.check('What-if: a 45-minute target changes both scenario numbers but not the baseline; Reset restores them', async () => {
    go('when'); await settled();
    const before = await snap(['w-base', 'w-within', 'w-over']);
    window.__setTarget(45); await settle(500); await quiet();
    const during = await snap(['w-base', 'w-within', 'w-over']);
    window.__setTarget(30); await settle(500); await quiet();
    const after = await snap(['w-base', 'w-within', 'w-over']);
    return { pass: during['w-within'] !== before['w-within'] && during['w-over'] !== before['w-over'] && during['w-base'] === before['w-base'] && after['w-within'] === before['w-within'], detail: JSON.stringify({ before, during, after }) };
  });
  appState.check('Excel report: with Department = Neurology it downloads a 7-sheet workbook', async () => {
    go('board'); await settled();
    await pick('g-board', 'Department Referral', ['Neurology']);
    window.__lastExport = null;
    exportBtn.click();
    for (let i = 0; i < 90 && !window.__lastExport && !window.__lastExportError; i++) await settle(500);
    const info = window.__lastExport;
    await clearAll();
    return { pass: info?.sheets?.length === 7 && /Neurology/.test(info.selections), detail: JSON.stringify({ error: window.__lastExportError, sheets: info?.sheets, selections: info?.selections, kpis: info?.kpis }) };
  });
  // ---------------------------------------------------------------- text figures follow the numbers (F3)
  const cap = (id) => document.querySelector(`[data-cmp="${id}"]`)?.textContent ?? '';
  appState.check('board: Month = 2020-06 reaches the KPI cards (Jun against May), the drivers table and the heat map (the trend keeps every month); Clear all restores', async () => {
    go('board'); await settled();
    const ids = ['k-within', 'k-wait', 'k-pat', 'c-slots', 't-drivers'];
    const before = await snap(ids); const c0 = cap('k-within');
    const q0 = queryLog().length;
    await pick('g-board', 'Period', ['2020-06']);
    const log = queryLog().slice(q0).filter((e) => !e.prefetch);
    const during = await snap(ids); const c1 = cap('k-within'); const head = hero.textContent;
    await clearAll();
    const after = await snap(ids); const c2 = cap('k-within');
    const changed = ids.filter((id) => during[id] !== before[id]); const restored = ids.filter((id) => after[id] === before[id]);
    const pass = changed.length === ids.length && restored.length === ids.length && /Jun 2020/.test(head) && /May/.test(c1) && c2 === c0;
    return { pass, detail: `changed ${changed.join(',')}; restored ${restored.join(',')}; caption "${c0}" -> "${c1}" -> "${c2}"; ${log.filter((e) => !e.cached).length} engine queries (+${log.filter((e) => e.cached).length} cached)` };
  });
  appState.check('text figures never show the previous selection: from the click until they settle, the headline and KPI captions read either "Updating" or the new figures', async () => {
    go('board'); await settled();
    const k0 = cap('k-within'); const h0 = hero.textContent;
    const seen = [];
    const watch = new MutationObserver(() => seen.push([hero.textContent, cap('k-within')]));
    watch.observe(hero, { childList: true, subtree: true, characterData: true });
    watch.observe(document.querySelector('[data-cmp="k-within"]'), { childList: true, subtree: true, characterData: true });
    selections.selectValues('g-board', asSelection(keyOf('Department Referral'), ['Gastroenterology']), { state: 'pending' });
    await settled();
    watch.disconnect();
    const endHead = hero.textContent; const endCap = cap('k-within');
    await clearAll();
    // Every state the reader could have seen after the click: never the old sentence or the old caption.
    const stale = seen.filter(([h, c]) => h === h0 || c === k0);
    const sawUpdating = seen.some(([h, c]) => /Updating|Reading the figures/.test(h) && /Updating/.test(c));
    const pass = seen.length > 0 && stale.length === 0 && sawUpdating && endHead !== h0 && endCap !== k0 && hero.dataset.state === 'settled';
    return { pass, detail: `${seen.length} states after the click, ${stale.length} stale; "Updating" shown ${sawUpdating}; end caption "${endCap}" (was "${k0}")` };
  });
  appState.check('edge: a selection with no visits (Renal, 2020-10, Wed) shows empty states, not numbers from another month', async () => {
    go('board'); await settled();
    await pick('g-board', 'Department Referral', ['Renal']);
    await pick('g-board', 'Period', ['2020-10']);
    await pick('g-board', DAY, ['\u200B\u200BWed']);
    const head = hero.textContent; const c = cap('k-within'); const k = await digest('k-within'); const slotsD = await digest('c-slots');
    await clearAll();
    const back = cap('k-within');
    const pass = /No visits/.test(head) && /No visits/.test(c) && slotsD.startsWith('0r') && !/No visits/.test(back);
    return { pass, detail: `headline "${head.slice(0, 90)}"; caption "${c}"; k-within ${k}; c-slots ${slotsD}; after clear "${back}"` };
  });
  appState.check('edge: the earliest month (2019-04) has no month before, so no card invents a change', async () => {
    go('board'); await settled();
    await pick('g-board', 'Period', ['2019-04']);
    const caps = KPI_TILES.filter((t) => t.tab === 'board').map((t) => cap(t.id)); const head = hero.textContent;
    await clearAll();
    const pass = caps.every((x) => /No comparison/.test(x)) && /no month before/.test(head);
    return { pass, detail: `${caps.join(' | ')} || ${head.slice(0, 120)}` };
  });
  appState.check('flags: Status = Open reaches every flag object\'s query (the shared flag tables may be empty), the chip shows it, Clear all removes it', async () => {
    go('flags'); await settled();
    const ids = ['n-open2', 'n-overdue2', 'n-signoff2', 'm-flags2', 'c-owner', 't-flags'];
    const before = await snap(ids);
    const statusKey = keyOf('Flag Status');
    const q0 = queryLog().length;
    await pick('g-flags', 'Flag Status', ['Open']);
    const filtered = queryLog().slice(q0).filter((e) => !e.prefetch && e.key?.includes(statusKey) && e.key?.includes('"Open"'));
    const chip = selBar.textContent.includes('Open');
    const during = await snap(ids);
    await clearAll();
    const after = await snap(ids);
    const chipGone = !selBar.textContent.includes('Open');
    const rows = Number((before['t-flags'] ?? '0r').split('r')[0]);
    const changed = ids.filter((id) => during[id] !== before[id]);
    const restored = ids.filter((id) => after[id] === before[id]);
    // With no flags stored (checks never write), "changed" cannot be shown: the check then proves the filter reached the queries.
    const reached = rows === 0 ? filtered.length >= 3 : changed.length >= 3;
    return { pass: chip && chipGone && reached && restored.length === ids.length, detail: `${rows} flag rows; ${filtered.length} queries carried Status = Open; changed ${changed.join(',') || 'none'}; restored ${restored.join(',')}` };
  });
  // ---------------------------------------------------------------- the workflow, exercised in practice mode (writes nothing)
  appState.check('workflow (practice, no writes): raise → start → resolve; the lead who raised and resolved it is refused sign-off (four eyes); a duty manager is refused; another lead signs off; the audit trail lists every step; reset clears it', async () => {
    go('flags'); await settle(400);
    const wf = window.__wf; const host = document.querySelector('[data-workflow]');
    const startMode = wf.mode; const w0 = wf.writes; const wb0 = writebackCalls;
    const $ = (sel) => host.querySelector(sel);
    const click = async (sel) => { const b = $(sel); if (!b) throw new Error(`no ${sel}`); b.click(); await settle(120); };
    const setVal = (sel, v) => { const n = $(sel); n.value = v; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); };
    const statusOf = () => $('[data-selected-flag] [data-status]')?.dataset.status;
    const msg = () => $('.wf-status')?.textContent ?? '';
    $('input[name="wf-mode"][value="practice"]').click(); await settle(100);
    $('[data-practice-reset]')?.click(); await settle(100);
    wf.setActing('lead');
    setVal('[data-raise] select[name="day"]', 'Wed'); setVal('[data-raise] select[name="band"]', '06-09h');
    setVal('[data-raise] textarea[name="issue"]', 'Check: one in three seen in time on Wednesday mornings');
    setVal('[data-raise] input[name="owner"]', 'Tom Reid');
    $('[data-raise]').requestSubmit(); await settle(200);
    const steps = [`raised: ${statusOf()}`];
    await click('[data-action="start"]'); steps.push(`started: ${statusOf()}`);
    await click('[data-action="resolve"]'); const noNote = msg(); steps.push(`resolve without note: ${statusOf()}`);
    setVal('[data-selected-flag] input[name="note"]', 'Extra triage nurse 06-10h'); await click('[data-action="resolve"]'); steps.push(`resolved: ${statusOf()}`);
    await click('[data-action="signoff"]'); const selfRefusal = msg(); const afterSelf = statusOf();
    wf.setActing('dm-day'); await click('[data-action="signoff"]'); const dmRefusal = msg();
    wf.setActing('lead2'); await click('[data-action="signoff"]'); const closed = statusOf();
    const trail = [...host.querySelectorAll('[data-practice-trail] li')].map((li) => li.textContent);
    $('[data-practice-reset]').click(); await settle(100);
    const cleared = !host.querySelector('[data-practice-trail]') && !host.querySelector('[data-practice-flag]');
    if (startMode === 'live') wf.setMode('live');
    const noWrites = wf.writes === w0 && writebackCalls === wb0;
    const pass = /note is required/.test(noNote) && /four eyes/.test(selfRefusal) && afterSelf === 'Resolved' && /only the ED operations lead/.test(dmRefusal)
      && closed === 'Closed' && trail.length >= 7 && trail.filter((t) => /Refused/.test(t)).length >= 3 && cleared && noWrites;
    return { pass, detail: `${steps.join('; ')}; self sign-off: "${selfRefusal}"; duty manager: "${dmRefusal}"; other lead: ${closed}; ${trail.length} audit events (${trail.filter((t) => /Refused/.test(t)).length} refused); reset ${cleared}; writeback calls ${writebackCalls - wb0}` };
  });
  appState.check('workflow: the live demo reset offers only flags raised in this session (none raised by checks)', async () => {
    go('flags'); await settle(300);
    const ids = window.__wf.sessionFlags();
    const btn = document.querySelector('[data-workflow] [data-reset]');
    return { pass: ids.length === 0 ? !btn : true, detail: `session flags ${ids.length}; reset control ${btn ? 'shown' : 'hidden'}` };
  });
  window.__appInfo = { tiles: tiles.size, failures, queries: () => queryLog().length };
};

main().catch((error) => {
  console.error('[boot]', error);
  appState.bootFailed(error);
  document.getElementById('root').replaceChildren(el('div', { class: 'boot error', text: `Could not start: ${error?.message ?? error}` }));
});
