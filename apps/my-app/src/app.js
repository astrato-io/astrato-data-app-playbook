/**
 * Trading Desk — the commercial director's monthly sales review on the "Trading Company (1)"
 * semantic layer: is growth holding, who moved it, and is shipping costing sales.
 *
 * Native Astrato objects only; every object stands for a stored business question
 * (src/catalogue.js → tools/questions.mjs). The app adds layout, selection plumbing, the headline
 * and KPI captions (live queries on stored measures, no arithmetic), and an Excel pack.
 *
 * Selections: one app-wide state (`mainSel`) mirrored into the visible tab's groups only. Each tab
 * has `g-<tab>` (charts, tables, filters), `g-<tab>-n` (KPI numbers, written by the app) and
 * `g-<tab>-k` (KPI mini lines). Only the dimensions in SEL are kept: a click on a month (Order
 * Month, Trailing 12 Months) is dropped, because a selection on the view that holds the time axis
 * breaks every period comparison (knowledge/semantic-layer.md, "This quarter is empty…").
 * Techniques copied from the ed-wait-watch example (selection mirror, lanes, KPI colouring,
 * "Updating…" text figures, table refit, app checks); structure is this app's own.
 */
import { createAstratoApp } from '@astrato-io/app-runtime';
import { createVisualizationRuntime, registry } from '@astrato-io/visualizations';
import { createVisualizationAvailableFields } from '@astrato-io/visualizations/definitions';
import { applyRuntimeOperations } from '@astrato-io/visualizations/operations';
import { appState } from './app-state.js';
import { throttleQueries, queryLog } from './throttle.js';
import { createFieldIndex } from './fields.js';
import { TABS, TILES, FILTERS, C } from './catalogue.js';
import { prepare, columnWidths } from './tiles.js';
import { buildWorkbook, downloadWorkbook } from './export.js';

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
const LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const asDate = (v) => new Date(typeof v === 'number' ? v : Date.parse(v));
const monthLabel = (v, long = false) => { const d = asDate(v); return Number.isNaN(d.getTime()) ? String(v) : `${(long ? LONG : MONTHS)[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const usd = (v) => (v == null ? '–' : `$${Math.round(Number(v)).toLocaleString('en-US')}`);
const usdShort = (v) => { if (v == null) return '–'; const a = Math.abs(v); return `${v < 0 ? '−' : ''}$${a >= 1e6 ? `${(a / 1e6).toFixed(1)}M` : a >= 1e3 ? `${(a / 1e3).toFixed(1)}k` : Math.round(a)}`; };
const int = (v) => (v == null ? '–' : Math.round(Number(v)).toLocaleString('en-US'));
const pct = (v, dp = 1) => (v == null ? '–' : `${(v * 100).toFixed(dp)}%`);
const signedPct = (v, dp = 1) => (v == null ? '–' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v * 100).toFixed(dp)}%`);
const signedPts = (v) => (v == null ? '–' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(1)} pts`);

/** Fields a reader may select; anything else a click carries (months) is dropped. */
const SEL = ['Category', 'Country', 'Customer', 'Shipper', 'Salesperson', 'Delivery Status'];
const GROUPS_OF = Object.fromEntries(TABS.map(({ key }) => [key, [`g-${key}`, `g-${key}-n`, `g-${key}-k`]]));
const groupOf = (tile) => (tile.type === 'filter' ? `g-${tile.tab}` : tile.kind === 'kpi' ? `g-${tile.tab}-n` : tile.kind === 'spark' ? `g-${tile.tab}-k` : `g-${tile.tab}`);
/** Groups whose objects never select (numbers): their state is written by the app, never read back. */
const WRITE_ONLY = new Set(TABS.map(({ key }) => `g-${key}-n`));

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
  const NAME_BY_KEY = Object.fromEntries(SEL.map((n) => [keyOf(n), n]));
  const SEL_KEYS = new Set(SEL.map(keyOf).filter(Boolean));

  // ---------------------------------------------------------------- governed query helper (text figures, Excel)
  // Each governed measure is sent with its own formula string, as the native objects send it.
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
  const scoped = () => [...mainSel].map(([k, v]) => asSelection(k, v));
  const selFilters = () => scoped().map(({ fieldKey, values }) => ({ fieldKey, operator: 'inList', values }));
  const readGroup = (g) => {
    const { applied = [] } = selections.getSelection(g) ?? {};
    return new Map(applied.filter((x) => x.values?.length).map((x) => [norm(x.field?.fieldKey ?? x.fieldKey), x.values]));
  };
  let current = 'overview';
  let mirroring = false;
  const sig = (m) => JSON.stringify([...m].sort(([a], [b]) => a.localeCompare(b)));
  const mirrorInto = (tab) => {
    mirroring = true;
    const want = scoped();
    const wantSig = sig(new Map(want.map((x) => [x.fieldKey, x.values])));
    // Only groups whose state differs: re-setting the group a click came from makes its objects query twice.
    for (const g of GROUPS_OF[tab] ?? []) if (sig(readGroup(g)) !== wantSig) selections.setNewSelectionState(g, { applied: want, pending: [] });
    mirroring = false;
  };

  // ---------------------------------------------------------------- shell
  const root = document.getElementById('root');
  const tabsNav = el('nav', { class: 'tabs', role: 'tablist' });
  const selBar = el('div', { class: 'selbar', 'aria-live': 'polite' });
  const body = el('main', { class: 'content' });
  const exportBtn = el('button', { class: 'btn', title: 'Download the sales-review pack as Excel, following the current selections' }, [el('span', { text: 'Excel report' })]);
  const asOf = el('small', { class: 'asof', text: 'Reading the latest month in the data…' });
  root.replaceChildren(
    el('header', { class: 'top' }, [
      el('div', { class: 'brand' }, [el('span', { class: 'mark', 'aria-hidden': 'true', text: 'TD' }), el('div', {}, [el('b', { text: 'Trading Desk' }), asOf])]),
      tabsNav,
      el('div', { class: 'tools' }, [exportBtn]),
    ]),
    selBar, body,
    el('footer', { class: 'source', text: 'Source: Trading Company (1) semantic layer (Astrato), Snowflake demo data, orders 1 Oct 2021 – 30 Jun 2023. Gross sales = unit price × quantity before discounts, USD. On time = shipped at least 8 days before the required date.' }),
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
  const card = (id, cls = '') => {
    const t = tileOf(id);
    return el('figure', { class: `card ${cls}`, 'data-card': id }, [
      el('figcaption', {}, [el('span', { class: 'q', text: t.q, title: t.description ?? t.q }), el('small', { class: 'sub', text: t.sub ?? '' })]),
      slot(id),
    ]);
  };
  const kpiCard = (id) => {
    const t = tileOf(id);
    return el('figure', { class: `card kpi${t.hero ? ' hero' : ''}`, 'data-card': id }, [
      el('figcaption', {}, [el('span', { class: 'q', text: t.label, title: t.q }), el('small', { class: 'unit', 'data-unit': id, text: t.unit })]),
      el('div', { class: 'kpi-row' }, [slot(id, 'kpi-num'), slot(`${id}-sp`, 'kpi-spark')]),
      el('small', { class: 'kpi-cmp', 'data-cmp': id, text: 'Comparing with the same month last year…' }),
    ]);
  };
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
        if (r?.status !== 'rendered') console.error('[object]', id, r?.status, r);
        if (t.kind === 'kpi') scheduleBoard();
        if (t.widths) fitTable(id);
      });
    } catch (error) {
      appState.settle(id, 'error', error);
      console.error('[mount]', id, error);
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

  /** Visible tab first (main objects, then mini charts), then the rest; four lanes. */
  const runQueue = async () => {
    const rank = (id) => (tiles.get(id)?.tab === current ? 0 : 2) + (id.endsWith('-sp') ? 1 : 0);
    const order = [...queue].sort(([a], [b]) => rank(a) - rank(b));
    queue.length = 0;
    const lanes = Array.from({ length: 4 }, async () => { while (order.length) { const [id, s] = order.shift(); await mountOne(id, s); } });
    await Promise.all(lanes);
  };

  // ---------------------------------------------------------------- the review month, read from the data
  // The Review Month axis reads "latest" as the last order date in the whole data, whatever the filters.
  const period = { now: 'the latest month', before: 'the same month last year', nowLong: 'the latest month' };
  const readPeriod = async () => {
    try {
      const rows = await q({ dims: ['Trailing 12 Months'], measures: ['Gross Sales by Month (12m)'] });
      const last = rows.map((r) => asDate(r['Trailing 12 Months'])).filter((d) => !Number.isNaN(d.getTime())).sort((a, b) => a - b).pop();
      if (!last) throw new Error('no months');
      const prior = new Date(Date.UTC(last.getUTCFullYear() - 1, last.getUTCMonth(), 1));
      Object.assign(period, { now: monthLabel(last), before: monthLabel(prior), nowLong: monthLabel(last, true), beforeLong: monthLabel(prior, true) });
      asOf.textContent = `Orders to ${period.nowLong} · cards compare ${period.now} with ${period.before}`;
      document.querySelectorAll('[data-period-now]').forEach((n) => { n.textContent = period.now; });
    } catch (error) { console.warn('[period]', error?.message); asOf.textContent = 'Cards compare the latest month with the same month a year earlier'; }
  };

  // ---------------------------------------------------------------- KPI captions, colours and the headline: one read per selection
  const KPI_TILES = TILES.filter((x) => x.kind === 'kpi');
  const KPI_MEASURES = [...new Set(KPI_TILES.flatMap((t) => [t.measures[0].m, t.measures.find((m) => m.role === 'comparison').m, t.prior]))];
  const hero = el('div', { class: 'headline', 'data-hero': '' }, el('span', { text: 'Reading the latest month…' }));
  const shownColour = new Map();
  /** Text figures must never show one selection's words beside another's numbers. */
  const markUpdating = () => {
    hero.dataset.state = 'updating';
    hero.replaceChildren(el('span', { class: 'verdict none', text: 'Updating' }), el('p', { text: 'Reading the figures for the new selection…' }));
    for (const t of KPI_TILES) { const l = document.querySelector(`[data-cmp="${t.id}"]`); if (l) { l.textContent = 'Updating…'; l.style.color = C.grey; l.dataset.state = 'updating'; } }
  };
  let boardTimer; let boardRun = 0;
  let boardPromise = Promise.resolve();
  const boardIdle = async () => { let p; do { p = boardPromise; await p; } while (p !== boardPromise); };
  window.__boardIdle = boardIdle;
  const runBoard = () => { boardPromise = readBoard().catch((error) => console.error('[board]', error?.message)); return boardPromise; };
  const scheduleBoard = () => { clearTimeout(boardTimer); boardTimer = setTimeout(runBoard, 80); };
  const readBoard = async () => {
    const run = ++boardRun;
    let k; let months; let movers; let ship;
    try {
      const f = selFilters();
      [[k], months, movers, ship] = await Promise.all([
        q({ measures: KPI_MEASURES, filters: f, priority: true }),
        q({ dims: ['Trailing 12 Months'], measures: ['Gross Sales by Month (12m)', 'Gross Sales YoY % (12m)'], filters: f, priority: true }),
        q({ dims: ['Customer'], measures: ['Gross Sales Change YoY'], filters: f, priority: true }),
        q({ dims: ['Shipper'], measures: ['On-Time % This Month', 'Orders This Month'], filters: f, priority: true }),
      ]);
    } catch (error) { if (run === boardRun) { hero.textContent = 'The headline could not be read.'; console.error('[board]', error?.message); } return; }
    if (run !== boardRun) return;
    for (const t of KPI_TILES) {
      const cmp = t.measures.find((m) => m.role === 'comparison');
      const d = k?.[cmp.m]; const before = k?.[t.prior]; const now = k?.[t.measures[0].m];
      const flat = d == null || Math.abs(d) < 1e-9;
      const good = flat || t.up === 'neutral' ? null : (d > 0) === (t.up === 'good');
      const colour = good == null ? C.grey : good ? C.good : C.bad;
      const shown = t.pts ? pct(before) : t.unit === 'USD' ? usd(before) : int(before);
      const change = t.pts ? signedPts(d) : signedPct(d);
      const arrow = flat ? '■' : d > 0 ? '▲' : '▼';
      const label = document.querySelector(`[data-cmp="${t.id}"]`);
      if (label) {
        label.textContent = now == null ? `No orders in ${period.now} for this selection` : d == null ? `No comparison: no orders in ${period.before}` : `${arrow} ${change} on ${period.before} (${shown})`;
        label.style.color = colour; label.dataset.value = String(d ?? ''); label.dataset.v = String(now ?? ''); label.dataset.state = 'settled';
      }
      if (handles.has(t.id) && shownColour.get(t.id) !== colour) {
        shownColour.set(t.id, colour);
        applyRuntimeOperations({ runtime, instanceId: t.id, availableFields, operationRequests: [{ id: 'c', name: 'setComparisonFontColor', payload: colour }] })
          .catch((error) => console.warn('[kpi colour]', t.id, error?.message));
      }
    }
    // Headline: every figure is a stored measure; the app only picks rows (the peak month, the biggest fall).
    const sales = k?.['Gross Sales This Month']; const g = k?.['Gross Sales YoY %'];
    const ot = k?.['On-Time % This Month']; const otBefore = k?.['On-Time % Same Month Last Year'];
    const peak = months.filter((r) => r['Gross Sales YoY % (12m)'] != null).sort((a, b) => b['Gross Sales YoY % (12m)'] - a['Gross Sales YoY % (12m)'])[0];
    const fall = movers.filter((r) => Number(r['Gross Sales Change YoY']) < 0).sort((a, b) => a['Gross Sales Change YoY'] - b['Gross Sales Change YoY'])[0];
    const worstShip = ship.filter((r) => Number(r['Orders This Month']) >= 5 && r['On-Time % This Month'] != null).sort((a, b) => a['On-Time % This Month'] - b['On-Time % This Month'])[0];
    hero.dataset.state = 'settled'; hero.dataset.sales = String(sales ?? ''); hero.dataset.growth = String(g ?? '');
    if (sales == null) {
      hero.replaceChildren(el('span', { class: 'verdict none', text: 'No orders' }), el('p', { text: `No orders in ${period.nowLong} for this selection. Is sales growth holding up? Clear a selection to widen it.` }));
      return;
    }
    const stalled = g != null && peak && g < peak['Gross Sales YoY % (12m)'] / 2;
    const verdict = g == null ? ['none', 'No comparison'] : g < 0 ? ['miss', 'Below last year'] : stalled ? ['warn', 'Growth stalling'] : ['ok', 'Growing'];
    const parts = [
      `Gross sales of <b>${usd(sales)}</b> in ${period.nowLong}`,
      g == null ? ` (no orders in ${period.beforeLong} to compare with)` : `, <b class="${g < 0 ? 'down' : 'up'}">${signedPct(g)}</b> on ${period.beforeLong}`,
      peak && g != null && peak['Gross Sales YoY % (12m)'] > g ? `, after <b>${signedPct(peak['Gross Sales YoY % (12m)'], 0)}</b> in ${monthLabel(peak['Trailing 12 Months'])}.` : '.',
      ot != null ? ` <b>${pct(ot, 0)}</b> of ${period.now} orders shipped on time${otBefore != null ? ` (${pct(otBefore, 0)} a year earlier)` : ''}.` : '',
    ];
    const next = [
      fall ? `review <b>${esc(fall.Customer)}</b> (${usdShort(fall['Gross Sales Change YoY'])} on ${period.before}) and the other customers in the table below` : '',
      worstShip && ot != null && otBefore != null && ot < otBefore ? `check <b>${esc(worstShip.Shipper)}</b>'s ${period.now} shipments (${pct(worstShip['On-Time % This Month'], 0)} on time) on the Delivery tab` : '',
    ].filter(Boolean);
    hero.replaceChildren(
      el('span', { class: `verdict ${verdict[0]}`, text: verdict[1] }),
      el('p', { html: `${parts.join('')}${next.length ? ` <span class="next">Next: ${next.join('; ')}.</span>` : ''}` }),
    );
  };

  // ---------------------------------------------------------------- selection bar
  const chipLabel = (key, values, all = false) => {
    const name = NAME_BY_KEY[key] ?? fields.nameOf(key);
    const shown = values.map(String);
    return [name, all ? shown.join(', ') : shown.slice(0, 3).join(', ') + (shown.length > 3 ? ` +${shown.length - 3}` : '')];
  };
  const selText = () => [...mainSel].map(([k, v]) => chipLabel(k, v, true).join(': ')).join('; ') || 'None';
  const renderSelBar = () => {
    const chips = [...mainSel].map(([key, values]) => {
      const [name, text] = chipLabel(key, values);
      return el('span', { class: 'chip' }, [
        el('i', { text: name }), document.createTextNode(text),
        el('button', { text: '×', 'aria-label': `Remove ${name}`, onclick: () => { mainSel.delete(key); afterMainChange(); } }),
      ]);
    });
    selBar.replaceChildren(...[
      el('b', { text: 'Selections' }),
      ...(chips.length ? chips : [el('span', { class: 'none', text: 'None. Pick a category, country, shipper or salesperson above, or click a bar or a row.' })]),
      chips.length ? el('button', { class: 'clear', text: 'Clear all', onclick: () => { mainSel.clear(); afterMainChange(); } }) : null,
    ].filter(Boolean));
  };
  const afterMainChange = () => { mirrorInto(current); renderSelBar(); clearTimeout(boardTimer); markUpdating(); runBoard(); };

  // Every group: auto-apply pending selections; the visible tab's applied changes become the app's state.
  for (const [tab, groups] of Object.entries(GROUPS_OF)) for (const g of groups) {
    let timer;
    selections.onActiveSelectionChange(g).subscribe((next) => {
      clearTimeout(timer);
      if (next.pending?.length) { timer = setTimeout(() => selections.applyPendingSelections(g), 200); return; }
      if (mirroring || tab !== current || WRITE_ONLY.has(g)) return;
      const fromGroup = readGroup(g);
      let changed = false;
      for (const k of SEL_KEYS) {
        const a = JSON.stringify(mainSel.get(k) ?? null); const b = JSON.stringify(fromGroup.get(k) ?? null);
        if (a !== b) { changed = true; if (fromGroup.has(k)) mainSel.set(k, fromGroup.get(k)); else mainSel.delete(k); }
      }
      const stray = [...fromGroup.keys()].some((k) => !SEL_KEYS.has(k)); // a month click: put the group back
      if (changed) afterMainChange();
      else if (stray) mirrorInto(current);
    });
  }

  // ---------------------------------------------------------------- panes
  const panes = {};
  const pane = (tab, kids) => {
    const t = TABS.find((x) => x.key === tab);
    panes[tab] = el('section', { class: `pane pane-${tab}`, 'data-pane': tab }, [
      el('div', { class: 'pane-head' }, [el('h1', { text: t.question }), filterStrip(tab)]),
      el('div', { class: 'pane-body' }, kids),
    ]);
    return panes[tab];
  };
  body.append(
    pane('overview', [
      hero,
      el('div', { class: 'kpis' }, ['k-sales', 'k-orders', 'k-cust', 'k-spo', 'k-otd'].map(kpiCard)),
      el('div', { class: 'row grow' }, [
        el('div', { class: 'col w58' }, [card('c-trend', 'h50'), card('c-growth', 'h50')]),
        card('t-drivers', 'w42'),
      ]),
    ]),
    pane('customers', [
      el('div', { class: 'row grow' }, [
        el('div', { class: 'col w40' }, [card('c-cat', 'h50'), card('c-catyoy', 'h50')]),
        el('div', { class: 'col w60' }, [card('c-country', 'h38'), card('t-cust', 'h62')]),
      ]),
    ]),
    pane('delivery', [
      el('div', { class: 'row grow' }, [
        el('div', { class: 'col kpi-col' }, ['kd-otd', 'kd-orders'].map(kpiCard)),
        el('div', { class: 'col w64' }, [card('c-status', 'h55'), card('t-shipper', 'h45')]),
        el('div', { class: 'col w36' }, [card('c-shipper', 'h40'), card('c-rep', 'h60')]),
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
  };
  window.__go = go;
  for (const t of TABS) {
    tabsNav.append(el('button', { role: 'tab', 'data-tab': t.key, text: t.label, onclick: () => go(t.key) }));
    appState.tab(t.key, () => go(t.key));
  }
  go(new URLSearchParams(location.search).get('tab') ?? 'overview');

  await readPeriod();
  runBoard();
  await runQueue();
  appState.mark('landing-ready');

  // ---------------------------------------------------------------- Excel
  const exportCtx = async () => {
    const waiting = (GROUPS_OF[current] ?? []).filter((g) => !WRITE_ONLY.has(g) && selections.getSelection(g)?.pending?.length);
    for (const g of waiting) selections.applyPendingSelections(g);
    if (waiting.length) await new Promise((r) => setTimeout(r, 300));
    return { q, selFilters, selText, period };
  };
  exportBtn.addEventListener('click', async () => {
    exportBtn.disabled = true;
    window.__lastExportError = null;
    try { await downloadWorkbook(await exportCtx()); }
    catch (error) { window.__lastExportError = String(error?.message ?? error); exportBtn.title = `Export failed: ${window.__lastExportError}`; console.error('[export]', error); }
    finally { exportBtn.disabled = false; }
  });

  // ---------------------------------------------------------------- app checks for the smoke test
  // Selections go in the way a reader's click or dropdown puts them: PENDING in the object's group.
  const settle = (ms) => new Promise((r) => setTimeout(r, ms));
  const quiet = () => appState.quiet({ quietMs: 2500, paintMs: 1500, timeoutMs: 30000 });
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
  selectionCheck('overview', 'Category = Beverages', ['k-sales', 'k-otd', 'c-trend', 'c-growth', 't-drivers'], () => pick('g-overview', 'Category', ['Beverages']));
  selectionCheck('customers', 'click Country = Germany', ['c-cat', 'c-catyoy', 't-cust'], () => pick('g-customers', 'Country', ['Germany']));
  selectionCheck('delivery', 'click Shipper = United Package', ['kd-otd', 'c-status', 'c-rep', 't-shipper'], () => pick('g-delivery', 'Shipper', ['United Package']));
  appState.check('Selections hold across tabs: Country on Customers reaches the Overview KPI', async () => {
    go('overview'); await settled();
    const base = await digest('k-sales');
    go('customers'); await settled();
    await pick('g-customers', 'Country', ['USA']);
    go('overview'); await settled();
    const chip = selBar.textContent.includes('USA');
    const d = await digest('k-sales');
    await clearAll();
    const after = await digest('k-sales');
    return { pass: chip && d !== base && after === base, detail: `chip ${chip}; KPI ${base} -> ${d} -> ${after}` };
  });
  appState.check('A month click is dropped (it would break the period comparisons) and the KPIs keep their figures', async () => {
    go('overview'); await settled();
    const base = await digest('k-sales');
    selections.selectValues('g-overview', asSelection(keyOf('Order Month'), [Date.UTC(2023, 2, 1)]), { state: 'pending' });
    await settled();
    const d = await digest('k-sales');
    return { pass: mainSel.size === 0 && d === base, detail: `mainSel ${mainSel.size}; KPI ${base} -> ${d}` };
  });
  const cap = (id) => document.querySelector(`[data-cmp="${id}"]`)?.textContent ?? '';
  appState.check('text figures never show the previous selection: from the click until they settle, the headline and KPI captions read "Updating" or the new figures', async () => {
    go('overview'); await settled();
    const k0 = cap('k-sales'); const h0 = hero.textContent;
    const seen = [];
    const watch = new MutationObserver(() => seen.push([hero.textContent, cap('k-sales')]));
    watch.observe(hero, { childList: true, subtree: true, characterData: true });
    watch.observe(document.querySelector('[data-cmp="k-sales"]'), { childList: true, subtree: true, characterData: true });
    selections.selectValues('g-overview', asSelection(keyOf('Category'), ['Seafood']), { state: 'pending' });
    await settled();
    watch.disconnect();
    const endHead = hero.textContent; const endCap = cap('k-sales');
    await clearAll();
    const stale = seen.filter(([h, c]) => h === h0 || c === k0);
    const pass = seen.length > 0 && stale.length === 0 && endHead !== h0 && endCap !== k0 && hero.dataset.state === 'settled';
    return { pass, detail: `${seen.length} states after the click, ${stale.length} stale; end caption "${endCap}" (was "${k0}")` };
  });
  appState.check('edge: a customer with no orders in the review month shows "No orders", not another month\'s numbers', async () => {
    go('overview'); await settled();
    await pick('g-overview', 'Customer', ['Mère Paillarde']);
    const head = hero.textContent; const c = cap('k-sales');
    await clearAll();
    const back = cap('k-sales');
    const pass = /No orders/.test(head) && /No orders/.test(c) && !/No orders/.test(back);
    return { pass, detail: `headline "${head.slice(0, 100)}"; caption "${c}"; after clear "${back}"` };
  });
  appState.check('Excel report: with Category = Beverages it downloads a 6-sheet workbook naming the selection', async () => {
    go('overview'); await settled();
    await pick('g-overview', 'Category', ['Beverages']);
    window.__lastExport = null;
    exportBtn.click();
    for (let i = 0; i < 90 && !window.__lastExport && !window.__lastExportError; i++) await settle(500);
    const info = window.__lastExport;
    await clearAll();
    return { pass: info?.sheets?.length === 6 && /Beverages/.test(info.selections), detail: JSON.stringify({ error: window.__lastExportError, sheets: info?.sheets, selections: info?.selections, kpis: info?.kpis }) };
  });
  const toLanding = async () => { if (current !== 'overview') { go('overview'); await settled(); } };
  appState.exportProbe({
    build: async () => buildWorkbook(await exportCtx()),
    select: async () => { await toLanding(); await pick('g-overview', 'Category', ['Beverages']); },
    clear: async () => { await toLanding(); await clearAll(); },
    exempt: ['Definitions'],
  });
  window.__appInfo = { tiles: tiles.size, failures, queries: () => queryLog().length };
};

main().catch((error) => {
  console.error('[boot]', error);
  appState.bootFailed(error);
  document.getElementById('root').replaceChildren(el('div', { class: 'boot error', text: `Could not start: ${error?.message ?? error}` }));
});
