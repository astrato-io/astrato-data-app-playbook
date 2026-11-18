/**
 * Velmora · Pipeline War Room.
 *
 * One screen per page, light command-room design:
 *  Command   — will we hit Q4? the gap meter, the forecast categories, the four regions,
 *              what moved since Monday and the weekly trajectory.
 *  Deals     — the gap closer: the highest-scoring open deals stacked until they cover the
 *              gap; the recovery list; a deal drawer with its activity and actions.
 *  Coaching  — one rep against their team: forecast vs quota, win rate, deal size, activity.
 *  Call      — the Monday forecast call: every manager's commit and best case against the
 *              system forecast and target, written back with an audit trail.
 *  Trends    — win rate, deal size, bookings by quarter, competitors.
 *
 * Charts, tables and KPI values are Astrato objects over the governed "Four Businesses (demo)"
 * layer; every other number on the page comes from a governed query of the same layer.
 */
import { createAstratoApp } from '@astrato-io/app-runtime';
import { createVisualizationRuntime, registry } from '@astrato-io/visualizations';
import { createVisualizationAvailableFields } from '@astrato-io/visualizations/definitions';
import { appState } from './app-state.js';
import { createFieldIndex } from './lib/fields.js';
import { buildTiles, compileTiles } from './charts.js';
import { ALL, APP, CATS, CLOSED_QS, CLOSER_N, OPP, REGIONS, REP, objects, prepareTile, withRefs } from './objects.js';

// fonts-ready: canvas axis labels only use fonts that have finished loading
await Promise.race([Promise.all(["12px Roboto", `12px ${getComputedStyle(document.documentElement).getPropertyValue("--font-family").trim() || "sans-serif"}`, "16px \"Material Icons\""].map((f) => document.fonts.load(f))).catch(() => {}), new Promise((r) => setTimeout(r, 3000))]);

const AS_OF = 'Mon 5 Oct 2026';
const USERS = ['Alex Morgan · CRO', 'Priya Nair · VP Sales EMEA', 'Dan Okafor · VP Sales NA', 'Mei Lin · RVP APAC'];

// ------------------------------------------------------------------ helpers
const el = (tag, attrs = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') n.className = v; else if (k === 'text') n.textContent = v; else if (k === 'html') n.innerHTML = v;
    else if (k === 'style') for (const [p, x] of Object.entries(v)) n.style.setProperty(p, x);
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(kids)) if (c != null && c !== false) n.append(c);
  return n;
};
const put = (n, ...kids) => n.replaceChildren(...kids.filter((k) => k != null && k !== false));
const usd = (v, d = 2) => (v == null || Number.isNaN(+v) ? '—' : `${v < 0 ? '−' : ''}$${Math.abs(v) >= 1e6 ? `${(Math.abs(v) / 1e6).toFixed(d)}m` : Math.abs(v) >= 1e3 ? `${Math.round(Math.abs(v) / 1e3)}k` : Math.round(Math.abs(v))}`);
const sUsd = (v) => (v == null ? '—' : `${v >= 0 ? '+' : '−'}${usd(Math.abs(v)).replace('−', '')}`);
const pct = (v, d = 0) => (v == null ? '—' : `${(v * 100).toFixed(d)}%`);
const n0 = (v) => (v == null ? '—' : Math.round(v).toLocaleString('en-US'));
const day = (ms) => (ms == null ? '—' : new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
const when = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const splash = (t) => { const s = document.getElementById('splash-status'); if (s) s.textContent = t; };

// ------------------------------------------------------------------ writeback
const WB = 'nb-war-room-v1';
const store = (() => {
  let s; try { s = { deals: {}, calls: {}, log: [], ...JSON.parse(localStorage.getItem(WB) ?? '{}') }; } catch { s = { deals: {}, calls: {}, log: [] }; }
  let user = USERS[0];
  const fns = new Set();
  const save = () => { try { localStorage.setItem(WB, JSON.stringify(s)); } catch { /* private */ } fns.forEach((f) => f()); };
  return {
    get s() { return s; }, get user() { return user; }, setUser(u) { user = u; }, on(f) { fns.add(f); },
    deal(id, status, detail) { const at = new Date().toISOString(); s.deals[id] = { status, by: user, at }; s.log.unshift({ what: `${id} · ${status}`, detail, by: user, at }); save(); },
    call(rep, v) { s.calls[rep] = { ...(s.calls[rep] ?? {}), ...v, by: user, at: new Date().toISOString() }; save(); },
    submit(detail) { s.log.unshift({ what: 'Forecast call submitted', detail, by: user, at: new Date().toISOString() }); save(); },
    reset() { s = { deals: {}, calls: {}, log: [] }; save(); },
  };
})();

// ------------------------------------------------------------------ Astrato
const sanitize = (m) => {
  const ok = (f) => { try { createVisualizationAvailableFields({ ...m, fields: [f], validFields: [f], viewsFields: [f], dimensions: [], measures: [] }); return true; } catch { return false; } };
  const bad = new Set((m.fields ?? []).filter((f) => !ok(f)).map((f) => f.key));
  const keep = (l) => (Array.isArray(l) ? l.filter((f) => !bad.has(f.key)) : l);
  return { ...m, fields: keep(m.fields), validFields: keep(m.validFields), viewsFields: keep(m.viewsFields) };
};
const mounted = new Map();
const mountViz = (runtime, instance, box, done) => {
  const rec = { id: instance.id, render: 'pending' };
  mounted.set(instance.id, rec);
  appState.declare(instance.id, null);
  (async () => {
    try {
      runtime.createInstance(instance);
      const h = await runtime.mount(box, instance.id);
      const r = await Promise.race([h.ready, new Promise((ok) => setTimeout(() => ok({ status: 'timeout' }), 40000))]);
      rec.render = r?.status ?? 'unknown';
      appState.settle(instance.id, rec.render, r);
    } catch (e) { rec.render = 'failed'; rec.error = String(e); appState.settle(instance.id, 'error', e); box.parentElement?.append(el('p', { class: 'viz-error', text: String(e) })); }
    box.classList.remove('is-loading');
    done?.();
  })();
};


// ------------------------------------------------------------------ main
const main = async () => {
  // diagnostics: main-thread long tasks (> 50 ms) are kept in window.__longTasks for the perf loop
  try { window.__longTasks = []; new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__longTasks.push({ at: Math.round(e.startTime), ms: Math.round(e.duration) }); }).observe({ type: 'longtask', buffered: true }); } catch { /* unsupported */ }
  splash('Connecting to Astrato…');
  const app = await createAstratoApp();
  const engine = app.client.hostServices.engine;
  // concurrency gate: at most 4 engine queries in flight (charts and headline queries share it); identical headline queries share one result
  { const raw = engine.getData.bind(engine); let live = 0; const wait = [];
    const next = () => { if (live >= 4 || !wait.length) return; live++; const [args, ok, ko] = wait.shift(); raw(...args).then(ok, ko).finally(() => { live--; next(); }); };
    const gated = (args) => new Promise((ok, ko) => { wait.push([args, ok, ko]); next(); });
    // identical bodies share one result: a row click flips pending/applied state several times and the chart runtime
    // re-asks every object for exactly the query it already has (160 repeats per click). The data is static per session.
    const memo = new Map(); const copy = (r) => { try { return structuredClone(r); } catch { return r; } };
    engine.getData = (...args) => {
      let k; try { k = JSON.stringify(args); } catch { return gated(args); }
      if (!memo.has(k)) { if (memo.size > 600) memo.delete(memo.keys().next().value); memo.set(k, gated(args).catch((e) => { memo.delete(k); throw e; })); }
      return memo.get(k).then(copy);
    }; }
  const qCache = new Map();
  const selections = app.client.hostServices.selections;
  const dataBinding = { ...app.dataBinding };
  const metadata = sanitize((await engine.fields.getFieldMetadata({ ...dataBinding })) ?? {});
  const runtime = createVisualizationRuntime({ client: app.client, registry });
  const availableFields = createVisualizationAvailableFields(metadata).filter((f) => f?.resultType !== 'unhandled');
  const fields = createFieldIndex(availableFields);

  const col = (name, view) => { const f = fields.raw(name, view); if (!f) throw new Error(`${view}.${name} missing`); return f.fieldKey; };
  const mk = (name) => { const f = fields.measure(name); if (!f) throw new Error(`measure ${name} missing`); return f.fieldKey; };
  const inList = (fieldKey, values) => ({ field: { fieldKey }, operator: 'inList', values });
  const where = (view, name, ...values) => inList(col(name, view), values);
  const q = async ({ dims = [], measures = [], filters = [], limit = 1000 }) => {
    const dimensions = dims.map(([name, view]) => ({ fieldKey: col(name, view), name }));
    // a governed measure by name, or { view, name, aggregation } for an aggregation of a raw column
    const calculations = measures.map((m) => (typeof m === 'string' ? { calculation: '{m1}', itemKey: mk(m), label: m }
      : { calculation: '{m1}', measures: [{ fieldKeys: [col(m.name, m.view)], aggregation: m.aggregation, distinct: false }], label: m.label ?? m.name }));
    const body = { ...dataBinding, query: { dimensions, calculations, orders: [], limit, offset: 0, filters, totals: false, showRecordsCount: false, outerViews: [], associativeListFilter: null } };
    const key = JSON.stringify(body.query);
    if (!qCache.has(key)) qCache.set(key, engine.getData(body).catch((e) => { qCache.delete(key); throw e; }));
    const { response } = await qCache.get(key);
    const names = [...dimensions.map((d) => d.name), ...measures.map((m) => (typeof m === 'string' ? m : m.label ?? m.name))];
    return Object.values(response?.data ?? {}).map((row) => Object.fromEntries(names.map((n, i) => [n, row[i]])));
  };
  const one = async (measures, filters = []) => (await q({ measures, filters, limit: 1 }))[0] ?? {};
  const Q4F = () => [where(OPP, 'Close Quarter', '2026-Q4')];
  const K = { region: col('Region Name', 'Sales Regions'), opp: col('Opp Name', OPP), rep: col('Rep Name', 'Reps') };
  const applied = () => selections.getSelection(APP).applied;
  const sel = () => applied().map((s) => inList(s.field.fieldKey, s.values));
  const setSel = (fieldKey, values, group = APP) => {
    const { applied: a, pending } = selections.getSelection(group);
    for (const s of [...a, ...pending]) if (s.field.fieldKey === fieldKey) selections.removeSelection(group, s);
    if (values.length) selections.selectValues(group, { field: { fieldKey }, fieldKey, kind: 'VALUE', operator: 'inList', values }, { state: 'applied' });
  };
  const state = { page: 'command', region: null, deal: null, rep: null };

  // ---------------------------------------------------------------- shell
  const root = document.getElementById('root');
  const surface = (id, cls = '') => el('div', { class: `viz-surface is-loading ${cls}`.trim(), 'data-slot': `${APP}-${id}` });
  const panel = (title, kids, cls = '', note) => el('section', { class: `panel ${cls}`.trim() }, [el('h3', {}, [title, note ? el('small', { text: note }) : null]), el('div', { class: 'body' }, kids)]);
  const toastBox = el('div', { class: 'toast', hidden: true });
  const toast = (t) => { toastBox.textContent = t; toastBox.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => { toastBox.hidden = true; }, 2600); };
  const logCount = el('b', { text: String(store.s.log.length) });
  store.on(() => { logCount.textContent = String(store.s.log.length); });
  const PAGES = [['command', 'Command'], ['deals', 'Deals'], ['coach', 'Coaching'], ['call', 'Forecast call'], ['trends', 'Trends']];
  const nav = el('nav', { class: 'nav' });
  const regionPills = el('div', { class: 'regions' });
  const logDrawer = el('aside', { class: 'drawer-log', hidden: true });
  const stage = el('main', { class: 'stage' });
  const selBar = el('div', { class: 'selbar' });
  put(root, el('div', { class: 'app' }, [
    el('header', { class: 'top' }, [
      el('div', { class: 'brand', html: '<svg viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#0176D3"/><path d="M7 22l6-9 5 6 7-11" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg><div><b>Velmora</b><span>Revenue Command Center</span></div>' }),
      nav, regionPills,
      el('div', { class: 'clock', html: `<b>Q4 FY26 · W2</b>as of ${AS_OF}` }),
      el('select', { class: 'who', onchange: (e) => store.setUser(e.target.value) }, USERS.map((u) => el('option', { text: u }))),
      el('button', { class: 'log-btn', onclick: () => openLog() }, ['Decisions ', logCount]),
    ]),
    selBar, stage, logDrawer, toastBox,
  ]));

  // ---------------------------------------------------------------- pages
  const gapCard = el('section', { class: 'panel gap' }, el('div', { class: 'gap__chart' }, surface('fc-cat')));
  const catKpis = el('div', { class: 'cat' }, CATS.map(([cat, label, color], i) => el('div', { class: 'kpi' }, [
    el('div', { class: 'kpi__label' }, [label, el('span', { class: 'kpi__d', 'data-cat': cat })]),
    el('div', { class: 'kpi__v', 'data-cat-val': cat, style: { color } }),
    el('div', { class: 'kpi__sub', 'data-cat-sub': cat }),
    el('div', { class: 'kpi__spark' }, surface(`cats-${i}`)),
  ])));
  const regionCards = REGIONS.map(([code, name]) => el('section', { class: 'panel region', 'data-region': name, onclick: () => pickRegion(state.region === name ? null : name) }, [
    el('h3', {}, [name, el('small', { 'data-reg-target': name })]),
    el('div', { class: 'region__num', 'data-reg-val': name }),
    el('div', { class: 'region__gap', 'data-reg-gap': name }),
    el('div', { class: 'region__spark' }, surface(`regs-${code}`)),
  ]));
  const closer = el('section', { class: 'panel closer' });
  const closerChart = surface('top-deals');
  const drawer = el('section', { class: 'panel drawer' });
  const repPick = el('select', { onchange: (e) => pickRep(e.target.value) });
  const coachVs = el('div', { style: { display: 'contents' } });
  const callBox = el('section', { class: 'panel call' });
  const rollBox = el('div', { class: 'rollup' });

  const head = {};
  const headline = (id) => (head[id] = el('div', { class: 'headline', text: ' ' }));
  const badge = (t) => el('span', { class: 'tag tag--gov', text: t });
  const panelB = (title, kids, cls, note, tags = []) => { const p = panel(title, kids, cls, note); p.querySelector('h3').append(...tags); return p; };
  const pages = {
    command: el('div', { class: 'page page--command' }, [
      headline('command'), catKpis, gapCard,
      el('div', { class: 'cmd-side' }, [
        panelB('Where the pipeline sits', surface('cat-region'), '', 'Q4 · region × forecast category'),
        panelB('Forecast trajectory', surface('trajectory'), '', 'Weekly Q4 snapshots', [badge('GOVERNED REFERENCE LINE')]),
      ]),
      ...regionCards,
    ]),
    deals: el('div', { class: 'page page--deals' }, [
      headline('deals'), closer,
      panel('Recovery list', surface('recovery'), 'recov', 'Open Q4 best case + pipeline · one row per opportunity · max recovery score, same order as the chart'),
      drawer,
    ]),
    coach: el('div', { class: 'page page--coach' }, [
      headline('coach'),
      el('div', { class: 'coach-head' }, [el('div', { class: 'rep-pick' }, [el('small', { text: 'COACHING · REP' }), repPick, el('small', { 'data-rep-team': '' })]), coachVs]),
      panelB('Q4 forecast vs quota · every rep', surface('rep-fq'), 'hero', 'Bars = forecast · red markers = quota · click a rep', [badge('GOVERNED QUOTA MARKERS')]),
      panel('Activity mix', surface('act-type'), '', 'selected rep'),
      panel('Open pipeline by stage', surface('rep-stage'), '', 'selected rep'),
    ]),
    call: el('div', { class: 'page page--call' }, [
      headline('call'),
      callBox,
      panel('Roll-up', [rollBox], '', 'Manager call vs system vs target'),
      panelB('What moved since Monday', surface('bridge'), '', 'Forecast bridge · Total = net change', [badge('GOVERNED PERIOD COMPARISON')]),
    ]),
    trends: el('div', { class: 'page page--trends' }, [
      headline('trends'),
      panelB('Bookings by quarter', surface('won-q'), 'hero', 'Closed quarters · mean line', [badge('GOVERNED REFERENCE LINE')]),
      panel('Win rate and deal size', surface('winrate'), '', 'Closed quarters'),
      panel('Win rate by deal size', surface('size-band'), '', 'Closed quarters · governed Deal Size Band'),
      panel('Q4 forecast by product', surface('product')),
    ]),
  };
  put(stage, ...Object.values(pages));
  const go = (id) => {
    state.page = id;
    for (const [k, p] of Object.entries(pages)) p.classList.toggle('on', k === id);
    put(nav, ...PAGES.map(([pid, label]) => el('button', { class: pid === id ? 'on' : '', text: label, onclick: () => go(pid) })));
    history.replaceState(null, '', `#${id}`);
    setTimeout(() => { try { drawSelBar(); } catch { /* selection bar not built yet */ } }, 0);
    // The rep focus applies on the coaching page only.
  };
  go(PAGES.some(([p]) => `#${p}` === location.hash) ? location.hash.slice(1) : 'command');
  for (const [id] of PAGES) appState.tab(id, () => go(id));
  const pickRegion = (name) => {
    state.region = name;
    setSel(K.region, name ? [name] : []);
  };
  const drawPills = () => put(regionPills, el('button', { class: state.region ? '' : 'on', text: 'All', onclick: () => pickRegion(null) }), ...REGIONS.map(([code, name]) => el('button', { class: state.region === name ? 'on' : '', text: code, onclick: () => pickRegion(name) })));
  drawPills();

  // the selection panel: every applied and pending selection, removable, plus Clear all
  const summary = (v) => (v.length <= 2 ? v.join(', ') : `${v.slice(0, 2).join(', ')} +${v.length - 2}`);
  function drawSelBar(cur = selections.getSelection(APP)) {
    const pend = new Set(cur.pending.map((x) => x.field.fieldKey));
    const items = [...cur.applied.filter((x) => !pend.has(x.field.fieldKey)).map((x) => [x, false]), ...cur.pending.map((x) => [x, true])];
    // the coaching rep focus lives in its own group (rcc-rep); show it as a chip on Coaching so the active scope stays visible
    const repSel = state.page === 'coach' ? selections.getSelection(REP).applied.filter((x) => x.field.fieldKey === K.rep) : [];
    const chips = [...items.map(([x, p]) => [x, p, APP]), ...repSel.map((x) => [x, false, REP])];
    put(selBar,
      el('span', { class: 'selbar__label', text: 'Selections' }),
      ...(chips.length ? chips.map(([x, p, g]) => el('span', { class: p ? 'chip chip--pending' : 'chip', title: x.values.join(', ') }, [
        el('b', { text: fields.nameOf(x.field.fieldKey) }), el('span', { text: summary(x.values.map(String)) }),
        el('button', { type: 'button', 'aria-label': 'Remove', text: '×', onclick: () => (g === REP ? clearRep() : p ? selections.declineSelection(APP, x) : selections.removeSelection(APP, x)) }),
      ])) : [el('span', { class: 'selbar__hint', text: 'Click any bar, point or row to filter' })]),
      el('button', { type: 'button', class: 'selbar__clear', text: 'Clear all', disabled: !chips.length, onclick: () => { selections.clearAllSelections(APP); if (repSel.length) clearRep(); } }),
    );
  }
  // × on the rep chip clears the rep focus: the coaching charts widen to every rep
  function clearRep() { setSel(K.rep, [], REP); setTimeout(() => drawSelBar(), 0); }
  drawSelBar();

  // ---------------------------------------------------------------- command: gap meter, categories, regions
  const drawCommand = async () => {
    const f = sel();
    const [t, wonQ4, cats, snaps, regs] = await Promise.all([
      one(['Q4 Forecast', 'Q4 Bookings Target', 'Prior Week Q4 Forecast'], f),
      one(['Closed Won Bookings'], [...f, ...Q4F()]),
      q({ dims: [['Forecast Category', OPP]], measures: ['Opportunity Amount', 'Q4 Forecast'], filters: [...f, ...Q4F()] }),
      q({ dims: [['Snapshot Date', 'Forecast Snapshots'], ['Forecast Category', 'Forecast Snapshots']], measures: ['Snapshot Forecast'], filters: f }),
      q({ dims: [['Region Name', 'Sales Regions']], measures: ['Q4 Forecast', 'Q4 Bookings Target', 'Prior Week Q4 Forecast'], filters: f.filter((x) => x.field.fieldKey !== K.region) }),
    ]);
    const target = t['Q4 Bookings Target']; const fc = t['Q4 Forecast']; const gap = target - fc; const moved = fc - t['Prior Week Q4 Forecast'];
    const byCat = Object.fromEntries(cats.map((r) => [r['Forecast Category'], r]));
    const won = wonQ4['Closed Won Bookings'] ?? 0;
    const seg = CATS.map(([cat, label, color]) => [label, color, cat === 'Closed Won' ? won : byCat[cat]?.['Q4 Forecast'] ?? 0]);
    const scale = Math.max(target, seg.reduce((s, x) => s + x[2], 0)) * 1.04;
    const chart = gapCard.querySelector('.gap__chart');
    put(gapCard,
      el('h3', {}, ['Will we hit Q4?', badge('GOVERNED REFERENCE LINE'), el('small', { text: `${state.region ?? 'All regions'} · won → commit → best case → pipeline → forecast` })]),
      el('div', { class: 'gap__nums' }, [
        el('div', { class: 'gap__num' }, [el('small', { text: 'Forecast' }), el('b', { text: usd(fc) })]),
        el('div', { class: 'gap__num' }, [el('small', { text: 'Target' }), el('b', { text: usd(target) })]),
        el('div', { class: `gap__num ${gap > 0 ? 'gap__num--gap' : 'gap__num--ok'}` }, [el('small', { text: gap > 0 ? 'Gap' : 'Ahead' }), el('b', { text: usd(Math.abs(gap)) })]),
        el('div', { class: 'gap__move' }, [badge('PERIOD COMPARISON'), ' since last Monday', el('b', { text: sUsd(moved) })]),
      ]),
      chart,
    );
    const worst = [...regs].sort((a, b) => (a['Q4 Forecast'] - a['Prior Week Q4 Forecast']) - (b['Q4 Forecast'] - b['Prior Week Q4 Forecast']))[0];
    const short = REGIONS.find(([, n]) => n === worst?.['Region Name'])?.[0] ?? worst?.['Region Name'];
    head.command.textContent = gap > 0
      ? `Q4 forecast ${usd(fc)}: ${usd(gap)} short of the ${usd(target)} target${worst && !state.region ? `; ${short} drives it, ${sUsd(worst['Q4 Forecast'] - worst['Prior Week Q4 Forecast'])} since Monday` : `, ${sUsd(moved)} since Monday`}.`
      : `Q4 forecast ${usd(fc)} is ${usd(-gap)} ahead of the ${usd(target)} target${state.region ? ` in ${state.region}` : ''}.`;
    // category deltas: weighted forecast at the latest snapshot vs the one before
    const dates = [...new Set(snaps.map((r) => r['Snapshot Date']))].sort((a, b) => a - b);
    const [prev, last] = dates.slice(-2);
    for (const [cat] of CATS) {
      const a = snaps.find((r) => r['Snapshot Date'] === last && r['Forecast Category'] === cat)?.['Snapshot Forecast'];
      const b = snaps.find((r) => r['Snapshot Date'] === prev && r['Forecast Category'] === cat)?.['Snapshot Forecast'];
      const d = stage.querySelector(`[data-cat="${cat}"]`);
      const sub = stage.querySelector(`[data-cat-sub="${cat}"]`);
      if (a != null && b != null) { d.className = `kpi__d ${a >= b ? 'up' : 'down'}`; d.textContent = `${a >= b ? '▲' : '▼'} ${usd(Math.abs(a - b))}`; }
      sub.textContent = cat === 'Closed Won' ? 'booked in Q4 · trend: 2026 cumulative' : `${usd(byCat[cat]?.['Opportunity Amount'] ?? 0)} unweighted · Δ vs last Mon`;
    }
    for (const [cat] of CATS) { const v = cat === 'Closed Won' ? won : byCat[cat]?.['Opportunity Amount']; const n = stage.querySelector(`[data-cat-val="${cat}"]`); if (n) n.textContent = usd(v ?? 0); }
    for (const r of regs) {
      const rv = stage.querySelector(`[data-reg-val="${r['Region Name']}"]`); if (rv) rv.textContent = usd(r['Q4 Forecast']);
      const name = r['Region Name']; const g = r['Q4 Bookings Target'] - r['Q4 Forecast'];
      stage.querySelector(`[data-reg-target="${name}"]`).textContent = `target ${usd(r['Q4 Bookings Target'])}`;
      const gl = stage.querySelector(`[data-reg-gap="${name}"]`);
      gl.textContent = `${g > 0 ? `${usd(g)} short` : `${usd(-g)} ahead`} · ${pct(r['Q4 Forecast'] / r['Q4 Bookings Target'])} · ${sUsd(r['Q4 Forecast'] - r['Prior Week Q4 Forecast'])} wk`;
      gl.style.color = g > 0 ? '#BA0517' : '#2E844A';
    }
    for (const card of regionCards) card.classList.toggle('on', card.dataset.region === state.region);
    for (const card of regionCards) card.classList.toggle('off', Boolean(state.region) && card.dataset.region !== state.region);
    return { gap, fc, target };
  };

  // ---------------------------------------------------------------- deals: gap closer + drawer
  const drawCloser = async (gap) => {
    // one row per opportunity name (names repeat across open opps): MAX score, summed amount — the grain of the chart and the recovery list
    const rows = await q({ dims: [['Opp Name', OPP]], measures: [{ name: 'Recovery Score', view: OPP, aggregation: 'MAX' }, 'Opportunity Amount', 'Win Probability'], filters: [...sel(), ...Q4F(), where(OPP, 'Forecast Category', 'Best Case', 'Pipeline')], limit: 500 });
    rows.sort((a, b) => b['Recovery Score'] - a['Recovery Score'] || b['Opportunity Amount'] - a['Opportunity Amount']);
    let acc = 0; const pick = [];
    for (const r of rows.slice(0, CLOSER_N)) { pick.push(r); acc += r['Opportunity Amount']; }
    let run = 0; let need = 0;
    for (const r of pick) { if (run < gap) need += 1; run += r['Opportunity Amount']; }
    const committed = pick.filter((r) => store.s.deals[r['Opp Name']]?.status === 'Committed to Q4');
    put(closer,
      el('h3', {}, ['Deals that close the gap', badge('GOVERNED REFERENCE LINE'), el('small', { text: `Top ${pick.length} by recovery score (same order as the recovery list), stacked until they cross the gap · first ${need} close it · click a bar to open the deal` })]),
      el('div', { class: 'body' }, closerChart),
    );
    const tail = committed.length ? `; ${committed.length} already committed` : '';
    head.deals.textContent = gap <= 0 ? 'Forecast is at or above target in this scope; the list shows upside.'
      : run >= gap ? `The top ${need} of the ${pick.length} deals shown, by recovery score, close the ${usd(gap)} gap if they land${tail}.`
      : `All ${pick.length} deals shown reach ${usd(run)} of the ${usd(gap)} gap${tail}.`;
    if (!state.deal && pick[0]) openDeal(pick[0]['Opp Name'], false);
  };
  const openDeal = async (name, jump = true) => {
    state.deal = name;
    if (jump && state.page !== 'deals') go('deals');
    put(drawer, el('h3', { text: 'Deal' }), el('p', { class: 'drawer__meta', text: 'Loading…' }));
    const [[d], acts] = await Promise.all([
      q({ dims: [['Opp Name', OPP], ['Stage', OPP], ['Forecast Category', OPP], ['Next Step', OPP], ['Competitor', OPP], ['Close Date', OPP], ['Rep Name', 'Reps'], ['Team', 'Reps']], measures: ['Opportunity Amount', 'Win Probability', 'Recovery Score', 'Avg Days in Stage', 'Avg Engagement Score'], filters: [where(OPP, 'Opp Name', name), ...Q4F()], limit: 1 }),
      q({ dims: [['Activity Date', 'Activities'], ['Activity Type', 'Activities']], measures: ['Sales Activities'], filters: [where(OPP, 'Opp Name', name), ...Q4F()], limit: 60 }),
    ]);
    if (!d) { put(drawer, el('p', { text: `${name} not found` })); return; }
    acts.sort((a, b) => b['Activity Date'] - a['Activity Date']);
    const done = store.s.deals[name];
    const act = (label, status, primary) => el('button', { class: `btn ${primary ? 'btn--go' : ''}`, text: label, onclick: () => { store.deal(name, status, `${usd(d['Opportunity Amount'])} · ${d['Rep Name']}`); toast(`${status}`); openDeal(name, false); refresh(); } });
    put(drawer,
      el('h3', {}, ['Deal', el('small', { text: `${d['Rep Name']} · ${d.Team}` })]),
      el('p', { class: 'drawer__name', text: name }),
      el('p', { class: 'drawer__meta', text: `${d.Stage} · ${d['Forecast Category']} · closes ${day(d['Close Date'])}${d.Competitor && d.Competitor !== 'None' ? ` · vs ${d.Competitor}` : ''}` }),
      el('dl', { class: 'facts' }, [['Amount', usd(d['Opportunity Amount'])], ['Recovery', n0(d['Recovery Score'])], ['Days in stage', n0(d['Avg Days in Stage'])], ['Win probability', pct(d['Win Probability'])], ['Engagement', n0(d['Avg Engagement Score'])], ['Activities', n0(acts.reduce((s, a) => s + a['Sales Activities'], 0))]].map(([k, v]) => el('div', {}, [el('dt', { text: k }), el('dd', { text: v })]))),
      el('div', { class: 'sub', text: `Next step · ${d['Next Step'] ?? '—'}` }),
      el('div', { class: 'sub', text: 'Recent activity' }),
      el('ul', { class: 'timeline' }, acts.slice(0, 12).map((a) => el('li', {}, [el('time', { text: day(a['Activity Date']) }), el('span', { text: a['Activity Type'] }), el('b', { text: n0(a['Sales Activities']) })]))),
      done ? el('div', { class: 'done', text: `${done.status} · ${done.by}, ${when(done.at)}` }) : null,
      el('div', { class: 'acts' }, [act('Commit to Q4', 'Committed to Q4', true), act('Request exec sponsor', 'Exec sponsor requested'), act('Add to Monday call', 'On Monday call'), act('Push to Q1', 'Pushed to Q1')]),
    );
  };

  // ---------------------------------------------------------------- coaching
  const reps = await q({ dims: [['Rep Name', 'Reps'], ['Team', 'Reps']], measures: ['Q4 Forecast'], limit: 200 });
  reps.sort((a, b) => b['Q4 Forecast'] - a['Q4 Forecast']);
  put(repPick, ...reps.map((r) => el('option', { value: r['Rep Name'], text: r['Rep Name'] })));
  const pickRep = async (rep) => {
    state.rep = rep; repPick.value = rep;
    setSel(K.rep, [rep], REP); // first: the two rep charts query in parallel with the KPI cards below, not after them
    setTimeout(() => drawSelBar(), 0);
    const team = reps.find((r) => r['Rep Name'] === rep)?.Team;
    stage.querySelector('[data-rep-team]').textContent = team ?? '';
    const M = ['Q4 Forecast', 'Win Rate', 'Average Deal Size', 'Sales Activities', 'Avg Days in Stage', 'Open Pipeline'];
    const QUOTA = { view: 'Reps', name: 'Q4 Quota', aggregation: 'SUM' };
    // the rep's measures and quota share one query (same filter)
    const [me, peers] = await Promise.all([
      one([...M, QUOTA], [where('Reps', 'Rep Name', rep)]),
      q({ dims: [['Rep Name', 'Reps']], measures: M, filters: [where('Reps', 'Team', team)], limit: 50 }),
    ]);
    const quota = me;
    const qv = quota['Q4 Quota'];
    const avgOf = (k) => peers.reduce((x, r) => x + (r[k] ?? 0), 0) / Math.max(1, peers.length);
    head.coach.textContent = qv ? `${rep} forecasts ${usd(me['Q4 Forecast'])}, ${pct(me['Q4 Forecast'] / qv)} of a ${usd(qv)} quota; win rate ${pct(me['Win Rate'])} vs ${pct(avgOf('Win Rate'))} for ${team}.` : `${rep}: ${usd(me['Q4 Forecast'])} Q4 forecast.`;
    const avg = (k) => peers.reduce((s, r) => s + (r[k] ?? 0), 0) / Math.max(1, peers.length);
    const card = (label, v, a, fmt, lowerBetter) => {
      const ratio = a ? v / a : 1; const good = lowerBetter ? ratio <= 1 : ratio >= 1;
      return el('div', { class: 'vs' }, [el('small', { text: label }), el('b', { text: fmt(v), style: { color: good ? '#2E844A' : '#BA0517' } }),
        el('span', { text: `team avg ${fmt(a)} · ${ratio >= 1 ? '+' : ''}${((ratio - 1) * 100).toFixed(0)}%` })]);
    };
    await new Promise((ok) => requestAnimationFrame(() => ok()));
    put(coachVs,
      card('Q4 forecast', me['Q4 Forecast'], avg('Q4 Forecast'), (v) => usd(v)),
      card('Win rate', me['Win Rate'], avg('Win Rate'), (v) => pct(v)),
      card('Avg deal size', me['Average Deal Size'], avg('Average Deal Size'), (v) => usd(v)),
      card('Activities', me['Sales Activities'], avg('Sales Activities'), n0),
      card('Days in stage', me['Avg Days in Stage'], avg('Avg Days in Stage'), n0, true),
    );
  };

  // ---------------------------------------------------------------- forecast call (writeback)
  const drawCall = async () => {
    const rows = await q({ dims: [['Team', 'Reps'], ['Rep Name', 'Reps']], measures: ['Q4 Forecast', 'Closed Won Bookings', 'Open Pipeline'], filters: [...sel().filter((x) => x.field.fieldKey !== K.rep), ...Q4F()], limit: 200 });
    const target = (await one(['Q4 Bookings Target'], sel().filter((x) => x.field.fieldKey !== K.rep)))['Q4 Bookings Target'];
    const moves = await q({ dims: [['Change Type', 'Forecast Bridge']], measures: ['Forecast Movement'], filters: sel().filter((x) => x.field.fieldKey !== K.rep) }).catch(() => []);
    const slip = moves.find((r) => /slip/i.test(String(r['Change Type'])));
    const teams = [...new Set(rows.map((r) => r.Team))].sort();
    const callOf = (r) => store.s.calls[r['Rep Name']]?.commit ?? Math.round((r['Q4 Forecast'] * 0.97) / 1000) * 1000;
    const bestOf = (r) => store.s.calls[r['Rep Name']]?.best ?? Math.round((r['Q4 Forecast'] * 1.08) / 1000) * 1000;
    const input = (r, key, v) => el('input', { value: Math.round(v / 1000), title: 'Thousands of dollars', onchange: (e) => { store.call(r['Rep Name'], { [key]: Number(e.target.value) * 1000 }); drawRoll(); } });
    put(callBox, el('h3', {}, ['Monday forecast call', el('small', { text: 'Manager commit and best case per rep, in $k · saved as you type' }), el('span', { class: 'tag', text: 'WRITEBACK' })]),
      el('div', { class: 'body' }, el('table', {}, [
        el('thead', {}, el('tr', {}, ['Rep', 'Won', 'System', 'Commit $k', 'Best $k'].map((h) => el('th', { text: h })))),
        el('tbody', {}, teams.flatMap((team) => {
          const tr = rows.filter((r) => r.Team === team).sort((a, b) => b['Q4 Forecast'] - a['Q4 Forecast']);
          return [el('tr', { class: 'team' }, [el('td', { text: team }), el('td', { text: usd(tr.reduce((s, r) => s + (r['Closed Won Bookings'] ?? 0), 0)) }), el('td', { text: usd(tr.reduce((s, r) => s + r['Q4 Forecast'], 0)) }), el('td'), el('td')]),
            ...tr.map((r) => el('tr', {}, [el('td', {}, [r['Rep Name'], store.s.calls[r['Rep Name']] ? el('small', { text: `called by ${store.s.calls[r['Rep Name']].by.split(' · ')[0]}` }) : null]), el('td', { text: usd(r['Closed Won Bookings'] ?? 0) }), el('td', { text: usd(r['Q4 Forecast']) }), el('td', {}, input(r, 'commit', callOf(r))), el('td', {}, input(r, 'best', bestOf(r)))]))];
        })),
      ])));
    const drawRoll = () => {
      const sys = rows.reduce((s, r) => s + r['Q4 Forecast'], 0);
      const commit = rows.reduce((s, r) => s + callOf(r), 0);
      const best = rows.reduce((s, r) => s + bestOf(r), 0);
      const max = Math.max(sys, commit, best, target) * 1.08;
      const roll = (label, v) => el('div', { class: 'roll' }, [el('span', { text: label }), el('b', { text: usd(v) }), el('em', { text: `${v >= target ? '+' : '−'}${usd(Math.abs(v - target))} vs ${usd(target)} target`, style: { color: v >= target ? '#2E844A' : '#BA0517' } })]);
      head.call.textContent = `Field commit ${usd(commit)} is ${commit >= target ? `${usd(commit - target)} above` : `${usd(target - commit)} below`} the ${usd(target)} target${slip ? `; ${usd(Math.abs(slip['Forecast Movement']))} slipped to Q1 since Monday` : ''}.`;
      put(rollBox, roll('Field commit', commit), roll('System forecast', sys), roll('Field best case', best), 
        el('button', { class: 'btn btn--go', text: 'Submit call to CRO', onclick: () => { store.submit(`Commit ${usd(commit)} · best ${usd(best)} · system ${usd(sys)}`); toast('Forecast call submitted'); } }));
    };
    drawRoll();
  };

  // ---------------------------------------------------------------- trends headline
  const drawTrends = async () => {
    const f = sel().filter((x) => x.field.fieldKey !== K.rep);
    const [qs, t] = await Promise.all([
      q({ dims: [['Close Quarter', OPP]], measures: ['Closed Won Bookings'], filters: [...f, inList(col('Close Quarter', OPP), CLOSED_QS[0].values)] }),
      one(['Q4 Forecast', 'Q4 Bookings Target', 'Closed Won Bookings'], [...f, ...Q4F()]),
    ]);
    qs.sort((a, b) => String(a['Close Quarter']).localeCompare(String(b['Close Quarter'])));
    const best = [...qs].sort((a, b) => b['Closed Won Bookings'] - a['Closed Won Bookings'])[0];
    const last = qs.at(-1);
    const need = t['Q4 Forecast'] / Math.max(1, last?.['Closed Won Bookings'] ?? 1) - 1;
    head.trends.textContent = `${best?.['Close Quarter'] === last?.['Close Quarter'] ? `${last?.['Close Quarter']} was a record ${usd(last?.['Closed Won Bookings'])}` : `Best quarter ${best?.['Close Quarter']} ${usd(best?.['Closed Won Bookings'])}`}; the ${usd(t['Q4 Bookings Target'])} Q4 target needs ${pct(t['Q4 Bookings Target'] / Math.max(1, last?.['Closed Won Bookings'] ?? 1) - 1)} more than Q3, and the forecast stands at ${need >= 0 ? '+' : ''}${pct(need)}.`;
  };

  const openLog = () => {
    logDrawer.hidden = !logDrawer.hidden;
    put(logDrawer, el('h2', {}, ['Decision log', el('button', { class: 'log-btn', text: 'Close', onclick: () => { logDrawer.hidden = true; } })]),
      el('p', { class: 'kpi__sub', text: 'Writeback demo: stored in this browser; in production a governed table the layer reads back.' }),
      el('ul', {}, store.s.log.slice(0, 100).map((l) => el('li', {}, [el('b', { text: l.what }), ` — ${l.detail ?? ''} · ${l.by}, ${when(l.at)}`]))),
      el('button', { class: 'btn', text: 'Reset demo data', onclick: () => { store.reset(); openLog(); } }));
  };

  // ---------------------------------------------------------------- governed reference lines
  // Values come from governed queries; the line itself is drawn by the chart (vSpec.refLines).
  const refs = {};
  const refLine = (value, text, color = '#BA0517') => ({ value, stroke: color, strokeWidth: 2, showOob: true, label: { text, showValue: false, fontSize: 11, fill: color, align: 'right', vAlign: 'bottom', padding: 4 } });
  const loadRefs = async () => {
    const f = sel().filter((x) => x.field.fieldKey !== K.rep);
    const [t, wr, qt] = await Promise.all([
      one(['Q4 Forecast', 'Q4 Bookings Target'], f),
      one(['Win Rate'], [...f, inList(col('Close Quarter', OPP), CLOSED_QS[0].values)]),
      q({ dims: [['Quarter', 'Bookings Targets']], measures: [{ view: 'Bookings Targets', name: 'Bookings Target', aggregation: 'SUM' }], limit: 40 }).catch(() => []),
    ]);
    const target = t['Q4 Bookings Target']; const gap = target - t['Q4 Forecast'];
    const q3 = qt.find((r) => String(r.Quarter).includes('2026') && /Q3/.test(String(r.Quarter)))?.['Bookings Target'];
    const next = {
      target: [refLine(target, `Target ${usd(target)}`)],
      gap: gap > 0 ? [{ ...refLine(gap, `Gap ${usd(gap)}`), label: { text: `Gap ${usd(gap)}`, showValue: false, fontSize: 11, fill: '#BA0517', align: 'left', vAlign: 'top', padding: 4 } }] : [],
      quarters: [refLine(target, `Q4 target ${usd(target)}`), ...(q3 && !state.region ? [refLine(q3, `Q3 target ${usd(q3)}`, '#DD7A01')] : [])],
      winrate: [{ ...refLine(wr['Win Rate'], `All ${pct(wr['Win Rate'])}`, '#181818'), label: { text: '', showValue: false } }],
    };
    const changed = Object.keys(next).filter((k) => JSON.stringify(next[k]) !== JSON.stringify(refs[k]));
    Object.assign(refs, next);
    return changed;
  };
  await loadRefs().catch((e) => console.warn('[refs]', e));
  const updateRefs = async () => {
    const changed = await loadRefs();
    for (const t of tiles) {
      if (!t.refKey || !changed.includes(t.refKey) || mounted.get(t.id)?.render == null) continue;
      t.vSpec = await withRefs(ctx, t, t.vSpec, refs);
      // refLines has no operation in visualizations 0.8: this is an intentional complete vSpec replacement
      try { runtime.updateInstance(t.id, { vSpec: t.vSpec }); } catch (e) { console.warn('[refs]', t.id, e); }
    }
  };

  // ---------------------------------------------------------------- objects
  splash('Building governed objects…');
  const built = buildTiles(fields, objects());
  const compiled = await compileTiles(built.tiles, availableFields);
  for (const f of [...built.failures, ...compiled.failures]) console.warn('[object]', f.id, f.reason);
  // definition → themed vSpec: the same path tools/compile-adapter.mjs checks offline (objects.js)
  const ctx = { availableFields, fields, dataBinding, widthOf: (tile) => root.querySelector(`[data-slot="${tile.slot}"]`)?.clientWidth };
  const prepare = async (tile) => {
    const out = await prepareTile(ctx, tile);
    if (out.refusals.length) console.warn('[object]', tile.id, out.refusals);
    return out.tile;
  };
  const tiles = await Promise.all(compiled.compiled.map(prepare));
  for (const t of tiles) t.vSpec = await withRefs(ctx, t, t.vSpec, refs);

  function refresh() { clearTimeout(refresh.t); refresh.t = setTimeout(async () => { const c = await drawCommand().catch((e) => console.error(e)); drawCloser(c?.gap ?? 0).catch(console.error); drawCall().catch(console.error); drawTrends().catch(console.error); updateRefs().catch(console.error); }, 200); }
  // selections: region pills, deal clicks open the drawer, rep clicks pick the rep
  let timer; let mirrored = null; let lastKey = JSON.stringify(applied().map((s) => [s.field.fieldKey, s.values]));
  // the all-reps hero lives in its own group: a click there picks the rep; region mirrors in from the main group
  selections.onActiveSelectionChange(ALL).subscribe((next) => {
    const hit = next.pending.find((s) => s.field.fieldKey === K.rep);
    if (hit) setTimeout(() => { selections.declineSelection(ALL, hit); pickRep(String(hit.values[0])); }, 0);
  });
  selections.onActiveSelectionChange(APP).subscribe((next) => {
    const dealHit = next.pending.find((s) => s.field.fieldKey === K.opp);
    if (dealHit) { setTimeout(() => { selections.removeSelection(APP, dealHit); openDeal(String(dealHit.values[0])); }, 0); return; }
    const repHit = next.pending.find((s) => s.field.fieldKey === K.rep);
    if (repHit && state.page === 'coach') { setTimeout(() => pickRep(String(repHit.values[0])), 0); }
    clearTimeout(timer);
    if (next.pending.length) timer = setTimeout(() => selections.applyPendingSelections(APP), 250);
    const reg = next.applied.find((s) => s.field.fieldKey === K.region)?.values?.[0] ?? null;
    if (reg !== state.region || mirrored !== reg) { mirrored = reg; setTimeout(() => { setSel(K.region, reg ? [reg] : [], ALL); setSel(K.region, reg ? [reg] : [], REP); }, 0); }
    state.region = reg;
    drawPills();
    drawSelBar(next);
    // one applied-state change = one headline round; pending clicks and deal/rep hand-offs do not re-query
    const key = JSON.stringify(next.applied.map((s) => [s.field.fieldKey, s.values]));
    if (key !== lastKey) { lastKey = key; refresh(); }
  });

  // smoke check: a region selection through the app's own path (pills → selection service) must move the
  // governed Forecast figure on the Command page, and clearing must bring it back. Nothing is written back.
  const forecastText = () => (gapCard.querySelector('.gap__num b')?.textContent ?? '').trim();
  const until = async (ok, ms = 30000) => { for (const t0 = performance.now(); performance.now() - t0 < ms;) { if (ok()) return true; await new Promise((r) => setTimeout(r, 250)); } return false; };
  appState.check('Selecting Region = North America changes the Q4 Forecast figure; clearing restores it', async () => {
    go('command');
    pickRegion(null);
    await until(() => forecastText() !== '');
    await new Promise((r) => setTimeout(r, 1500)); // let a headline round already under way finish
    const before = forecastText();
    pickRegion(REGIONS[0][1]);
    await until(() => forecastText() !== before && state.region === REGIONS[0][1]);
    const during = forecastText();
    const carried = applied().some((s) => s.field.fieldKey === K.region && s.values.includes(REGIONS[0][1]));
    pickRegion(null);
    await until(() => forecastText() === before && state.region === null);
    const after = forecastText();
    return { pass: before !== '' && during !== before && carried && after === before && applied().length === 0, detail: `"${before}" -> "${during}" -> "${after}"; region selection applied: ${carried}` };
  });

  // mount: the visible page first, then the rest, three at a time
  const order = [...tiles].sort((a, b) => Number(!pages[state.page].contains(root.querySelector(`[data-slot="${a.slot}"]`))) - Number(!pages[state.page].contains(root.querySelector(`[data-slot="${b.slot}"]`))));
  let i = 0;
  const lane = async () => { while (i < order.length) { const t = order[i++]; const box = root.querySelector(`[data-slot="${t.slot}"]`); if (!box) continue; await new Promise((ok) => mountViz(runtime, { id: t.id, type: t.type, groupId: t.group ?? APP, vSpec: t.vSpec, dataBinding }, box, ok)); } };
  refresh();
  pickRep(reps[0]?.['Rep Name']);
  setTimeout(() => document.getElementById('splash')?.classList.add('is-done'), 1200);
  window.__astrato = { fields, availableFields, tiles, mounted, q, state, store, go, openDeal, pickRep, failures: [...built.failures, ...compiled.failures] };
  await Promise.all([lane(), lane(), lane()]);
};

main().catch((e) => {
  console.error(e);
  appState.bootFailed(e);
  document.getElementById('splash')?.classList.add('is-done');
  document.getElementById('root').replaceChildren(el('pre', { style: { padding: '24px', color: '#BA0517' }, text: `Could not start: ${e}` }));
});
