/**
 * Labour Market Pulse — the chief economist's monthly read of the ONS labour market release.
 *
 * Native Astrato objects on the "UK Labour Market (ONS LMS)" semantic layer; every object stands
 * for a stored business question (src/catalogue.js → tools/questions.mjs). The app adds layout,
 * selection plumbing, a pay-award what-if (a layer parameter), an Excel pack and the monthly
 * market-call workflow (simulated in the browser; see workflow.js).
 *
 * Selections: one app-wide state (`main`) mirrored into each tab's groups only while that tab is
 * on screen. Each tab has two groups: `g-<tab>` for charts, tables and filters, and `g-<tab>-k`
 * for KPI cards, which take only the fields their series can answer (time, and region on Regions).
 */
import { createAstratoApp } from '@astrato-io/app-runtime';
import { createVisualizationRuntime, registry } from '@astrato-io/visualizations';
import { createVisualizationAvailableFields } from '@astrato-io/visualizations/definitions';
import { applyRuntimeOperations } from '@astrato-io/visualizations/operations';
import { appState } from './app-state.js';
import { throttleQueries, queryLog } from './throttle.js';
import { createFieldIndex } from './fields.js';
import { TABS, TILES, FILTERS, C } from './catalogue.js';
import { prepare, staticGroup, opGroup, columnWidths } from './tiles.js';
import { mountWorkflow } from './workflow.js';
import { exportWorkbook } from './export.js';

const el = (tag, attrs = {}, kids = []) => {
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
const fmt = (v, d = 1) => (v == null || Number.isNaN(v) ? '—' : Number(v).toFixed(d));
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const monthLabel = (v) => { const d = new Date(typeof v === 'number' ? v : Date.parse(v)); return Number.isNaN(d.getTime()) ? String(v) : `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

/** Which selection fields each tab's groups take. */
const SCOPE = {
  market: { charts: ['Period Year', 'Period'], kpis: ['Period Year', 'Period'] },
  demand: { charts: ['Period Year', 'Period', 'Sector'], kpis: ['Period Year', 'Period'] },
  pay: { charts: ['Period Year', 'Period'], kpis: ['Period Year', 'Period'] },
  regions: { charts: ['Period Year', 'Period', 'Geography'], kpis: ['Period Year', 'Period', 'Geography'] },
};
const DATA_TABS = Object.keys(SCOPE);
const groupOf = (tile) => (tile.kind === 'kpi' || tile.kind === 'spark' || tile.kind === 'whatif' ? `g-${tile.tab}-k` : `g-${tile.tab}`);

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
  window.__fields = fields; window.__sel = selections; window.__runtime = runtime;
  const keyOf = (name) => fields.selectionKey(name) ?? fields.dimension(name)?.fieldKey;
  window.__keys = () => Object.fromEntries(['Period Year', 'Period', 'Sector', 'Geography', 'Year', 'Indicator'].map((n) => [n, keyOf(n)]));
  const NAME_BY_KEY = Object.fromEntries(['Period Year', 'Period', 'Sector', 'Geography'].map((n) => [keyOf(n), n]));
  const TIME_KEYS = new Set([keyOf('Period Year'), keyOf('Period')]);

  // ---------------------------------------------------------------- governed query helper (text figures, colours, Excel)
  // Each governed measure carries its own formula, as the charts send it: '{m1}' for a ratio such as '{m1} / {m2}' is refused (HTTP 400).
  const FORMULA = new Map(availableFields.map((f) => [f.fieldKey, f.item?.calculation?.calculation]));
  const q = async ({ measures, dims = [], filters = [], limit = 500 }) => {
    const dimensions = dims.map((d) => { const f = fields.dimension(d); if (!f) throw new Error(`no dimension ${d}`); return { itemKey: f.fieldKey, label: d }; }); // the shape charts send; `{ fieldKey: '[dimension]…' }` is refused (HTTP 400)
    const calculations = measures.map((m) => { const f = fields.measure(m); if (!f) throw new Error(`no measure ${m}`); return { calculation: FORMULA.get(f.fieldKey) || '{m1}', itemKey: f.fieldKey, label: m }; });
    const query = { dimensions, calculations, orders: [], limit, offset: 0, filters, totals: false, showRecordsCount: false, outerViews: [], associativeListFilter: null };
    let response;
    try { ({ response } = await engine.getData({ ...app.dataBinding, query })); }
    catch (error) { throw new Error(`${error?.message ?? error} (query: ${[...dims, ...measures].join(', ')})`); }
    const names = [...dims, ...measures];
    return Object.values(response?.data ?? {}).map((row) => Object.fromEntries(names.map((n, i) => [n, row[i]])));
  };
  window.__q = q;

  // ---------------------------------------------------------------- selection state
  /** App-wide selections: fieldKey -> values. */
  const mainSel = new Map();
  const timeSelected = () => [...mainSel.keys()].some((k) => TIME_KEYS.has(k));
  /** A selection made through a governed dimension is stored under its view column. */
  const norm = (k) => fields.all.find((f) => f.fieldKey === k && f.kind === 'dimension')?.rawKey ?? k;
  const asSelection = (fieldKey, values) => ({ field: { fieldKey }, fieldKey, kind: 'VALUE', operator: 'inList', values });
  const scopedFor = (group) => {
    const tab = group.replace(/^g-/, '').replace(/-k$/, '');
    const allowed = new Set((group.endsWith('-k') ? SCOPE[tab].kpis : SCOPE[tab].charts).map(keyOf));
    return [...mainSel].filter(([k]) => allowed.has(k)).map(([k, v]) => asSelection(k, v));
  };
  let current = 'market';
  let mirroring = false;
  const mirrorInto = (tab) => {
    if (!SCOPE[tab]) return;
    mirroring = true;
    // Only groups whose state differs: re-setting the group a click came from makes its objects query twice.
    const sig = (m) => JSON.stringify([...m].sort(([a], [b]) => a.localeCompare(b)));
    for (const g of [`g-${tab}`, `g-${tab}-k`]) {
      const want = scopedFor(g);
      if (sig(readGroup(g)) === sig(new Map(want.map((x) => [x.fieldKey, x.values])))) continue;
      selections.setNewSelectionState(g, { applied: want, pending: [] });
    }
    mirroring = false;
  };
  const readGroup = (g) => {
    const { applied = [] } = selections.getSelection(g) ?? {};
    return new Map(applied.filter((x) => x.values?.length).map((x) => [norm(x.field?.fieldKey ?? x.fieldKey), x.values]));
  };

  // ---------------------------------------------------------------- shell
  const root = document.getElementById('root');
  const tabsNav = el('nav', { class: 'tabs', role: 'tablist' });
  const selBar = el('div', { class: 'selbar' });
  const body = el('main', { class: 'content' });
  const exportBtn = el('button', { class: 'btn', title: 'Download the briefing pack as Excel, following the current selections' }, [el('span', { text: '⤓ Excel pack' })]);
  root.replaceChildren(
    el('header', { class: 'top' }, [
      el('div', { class: 'brand' }, [el('b', { text: 'Labour Market Pulse' }), el('small', { text: 'ONS Labour Market Statistics · release of 15 Sep 2026 · Open Government Licence v3.0', title: 'Contains public sector information licensed under the Open Government Licence v3.0.' })]),
      tabsNav,
      el('div', { class: 'tools' }, [exportBtn]),
    ]),
    selBar, body,
  );

  // ---------------------------------------------------------------- tiles
  const tiles = new Map();
  const failures = [];
  const latestState = new Map();
  const resolved = new Map();
  const ALTS = TILES.filter((t) => t.alt).map((t) => ({ ...t, id: `${t.id}-p`, measures: t.alt.measures, alt: undefined, isAlt: true }));
  await Promise.all([...TILES, ...FILTERS, ...ALTS].map(async (tile) => {
    try {
      const out = await prepare(tile, fields, availableFields, { latest: true });
      if (out.refusals.length) console.warn('[ops refused]', tile.id, out.refusals);
      tiles.set(tile.id, { ...tile, vSpec: out.vSpec });
      resolved.set(tile.id, out.resolvedRefs);
      latestState.set(tile.id, true);
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
  const showing = new Map();
  const slot = (id, cls = '') => {
    const s = el('div', { class: `viz ${cls}`, 'data-slot': id }, el('div', { class: 'loading', text: 'Loading…' }));
    if (tiles.has(id)) { queue.push([id, s]); slots.set(id, s); showing.set(id, id); }
    else s.replaceChildren(el('p', { class: 'note', text: `Not available: ${failures.find((f) => f.id === id)?.reason ?? id}` }));
    return s;
  };
  const sub = (tile) => el('small', { class: 'sub', 'data-sub': tile.id, text: tile.latest ? 'Latest release' : tile.swap ? 'Latest release · trend since 2015' : (tile.note ?? '') });
  const card = (id, cls = '') => {
    const t = TILES.find((x) => x.id === id);
    return el('figure', { class: `card ${cls}`, 'data-card': id }, [
      el('figcaption', {}, [el('span', { class: 'q', text: t.q, title: t.description ?? t.q }), sub(t)]),
      slot(id),
      t.clickField === 'Indicator' && (t.id === 't-latest' || t.id === 't-pay') ? el('small', { class: 'foot', text: 'Rows are separate series: select a year or click a month on a chart to move them.' }) : null,
    ]);
  };
  const kpiCard = (id) => {
    const t = TILES.find((x) => x.id === id);
    return el('figure', { class: `card kpi${t.hero ? ' hero' : ''}`, 'data-card': id }, [
      el('figcaption', {}, [el('span', { class: 'q', text: t.label, title: t.q }), sub(t)]),
      el('div', { class: 'kpi-row' }, [slot(id, 'kpi-num'), slot(`${id}-sp`, 'kpi-spark')]),
      el('small', { class: 'kpi-cmp', 'data-cmp': id, text: 'vs a year earlier' }),
    ]);
  };
  const filterStrip = (tab) => el('div', { class: 'filters' }, FILTERS.filter((f) => f.tab === tab).map((f) => el('label', { class: 'filter' }, [el('span', { text: f.label }), slot(f.id, 'filter-slot')])));

  const mountOne = async (id, s) => {
    const t = tiles.get(id);
    appState.declare(id, t.tab ?? null);
    if (!runtime.listInstances().some((i) => i.id === id)) runtime.createInstance({ id, type: t.type, groupId: t.type === 'filter' ? `g-${t.tab}` : groupOf(t), vSpec: t.vSpec, dataBinding: { ...dataBinding, queryContext: { objectId: id } } });
    try {
      const h = await runtime.mount(s, id);
      handles.set(id, h);
      h.ready.then((r) => {
        s.querySelector(':scope > .loading')?.remove();
        appState.settle(id, r?.status, r);
        if (r?.status !== 'rendered') console.error('[object]', id, r?.status);
        if (t.kind === 'kpi') colourKpi(id);
        if (t.widths) fitTable(id);
      });
    } catch (error) {
      appState.settle(id, 'error', error);
      console.error('[mount]', id, error);
    }
  };
  /** Tables with static column widths: refit the flexing columns to the slot (operations, never a remount). */
  const fitted = new Map();
  const fitTable = async (id) => {
    const t = tiles.get(id); const s = slots.get(t?.isAlt ? id.replace(/-p$/, '') : id); const refs = resolved.get(id);
    if (!t?.widths || !s || !refs || !handles.has(id)) return;
    const w = Math.round(s.clientWidth) - 28; // the table's own padding and scrollbar
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

  /** Visible tab first, then the rest a few at a time; a lane is released once mount() returns. */
  const runQueue = async () => {
    const order = [...queue].sort(([a], [b]) => {
      const ta = tiles.get(a)?.tab === current ? 0 : 1; const tb = tiles.get(b)?.tab === current ? 0 : 1;
      const sa = a.endsWith('-sp') ? 1 : 0; const sb = b.endsWith('-sp') ? 1 : 0;
      return ta - tb || sa - sb;
    });
    queue.length = 0;
    const only = new URLSearchParams(location.search).get('only');
    if (only) order.splice(0, order.length, ...order.filter(([id]) => only.split(',').includes(id)));
    const lanes = Array.from({ length: 4 }, async () => { while (order.length) { const [id, s] = order.shift(); await mountOne(id, s); } });
    await Promise.all(lanes);
  };

  // ---------------------------------------------------------------- KPI comparison colour (sign of the stored change measure)
  const colourKpi = async (id) => {
    const t = TILES.find((x) => x.id === id);
    const cmp = t.measures.find((m) => m.role === 'comparison');
    const g = groupOf(t);
    const sel = [...readGroup(g)].map(([fieldKey, values]) => ({ field: { fieldKey }, operator: 'inList', values }));
    const latest = latestState.get(id) ? [{ field: { fieldKey: keyOf('Period Status') }, operator: 'inList', values: ['Latest'] }] : [];
    try {
      const [row] = await q({ measures: [t.measures[0].m, cmp.m], filters: [...sel, ...latest] });
      const d = row?.[cmp.m];
      const good = d == null || Math.abs(d) < 1e-9 ? null : (d > 0) === (t.up === 'good');
      const colour = good == null ? C.grey : good ? C.green : C.red;
      const label = document.querySelector(`[data-cmp="${id}"]`);
      if (label) { label.textContent = d == null ? 'No reading a year earlier' : `${good ? '▲ better' : good === false ? '▼ worse' : '■ unchanged'} than a year earlier`; label.style.color = colour; label.dataset.value = String(d ?? ''); label.dataset.v = String(row?.[t.measures[0].m] ?? ''); }
      await applyRuntimeOperations({ runtime, instanceId: id, availableFields, operationRequests: [{ id: 'c', name: 'setComparisonFontColor', payload: colour }] });
    } catch (error) { console.warn('[kpi colour]', id, error?.message); }
  };

  // ---------------------------------------------------------------- "latest" ↔ "selected period" switch
  /** Tables show latest-release measures beside a full-history trend; with a time selected they swap to the selected-period variant. */
  const swapTables = async (tab, latest) => {
    for (const t of TILES.filter((x) => x.tab === tab && x.swap && tiles.has(x.id))) {
      const want = latest ? t.id : `${t.id}-p`;
      const s = slots.get(t.id);
      if (!s || showing.get(t.id) === want || !tiles.has(want)) continue;
      const was = showing.get(t.id);
      showing.set(t.id, want);
      try { handles.get(was)?.unmount(); } catch { /* already gone */ }
      handles.delete(was);
      delete window.__appState.objects[was];
      s.replaceChildren(el('div', { class: 'loading', text: 'Loading…' }));
      await mountOne(want, s);
    }
  };
  const refreshLatest = async (tab) => {
    const latest = !timeSelected();
    if (!location.search.includes('noswap')) swapTables(tab, latest);
    for (const t of TILES.filter((x) => x.tab === tab && x.swap)) document.querySelector(`[data-sub="${t.id}"]`)?.replaceChildren(latest ? 'Latest release · trend since 2015' : 'Average of the selected months');
    for (const t of TILES.filter((x) => x.tab === tab && x.latest && tiles.has(x.id))) {
      document.querySelector(`[data-sub="${t.id}"]`)?.replaceChildren(latest ? 'Latest release' : 'Average of the selected months');
      if (latestState.get(t.id) === latest) continue;
      latestState.set(t.id, latest);
      const group = opGroup(staticGroup(t, fields, { latest }));
      try {
        const r = await applyRuntimeOperations({ runtime, instanceId: t.id, availableFields, operationRequests: [{ id: 'sf', name: 'setStaticFilterGroup', payload: group }] });
        if (!r.results?.sf?.success) console.error('[static filter refused]', t.id, JSON.stringify(r.results?.sf));
      } catch (error) { console.error('[static filter]', t.id, error?.message); }
    }
    for (const t of TILES.filter((x) => x.tab === tab && x.kind === 'kpi')) colourKpi(t.id);
  };

  // ---------------------------------------------------------------- selection bar
  const chipLabel = (key, values) => {
    const name = NAME_BY_KEY[key] ?? fields.nameOf(key);
    const shown = key === keyOf('Period') ? values.map(monthLabel) : values.map(String);
    return [name === 'Period Year' ? 'Year' : name === 'Period' ? 'Month' : name === 'Sector' ? 'Sector' : name === 'Geography' ? 'Region' : name, shown.slice(0, 3).join(', ') + (shown.length > 3 ? ` +${shown.length - 3}` : '')];
  };
  const renderSelBar = () => {
    const scope = SCOPE[current];
    const chips = [...mainSel].map(([key, values]) => {
      const [name, text] = chipLabel(key, values);
      const applies = scope ? scope.charts.map(keyOf).includes(key) : false;
      return el('span', { class: `chip${applies ? '' : ' off'}`, title: applies ? '' : `Applies on ${key === keyOf('Geography') ? 'Regions' : 'Demand'} only` }, [
        el('i', { text: name }), document.createTextNode(text),
        el('button', { text: '×', 'aria-label': `Remove ${name}`, onclick: () => { mainSel.delete(key); afterMainChange(); } }),
      ]);
    });
    selBar.replaceChildren(...[
      el('b', { text: 'Selections' }),
      ...(chips.length ? chips : [el('span', { class: 'none', text: 'None: every card shows the latest release. Pick a year, or click a month, sector or region on any chart.' })]),
      chips.length ? el('button', { class: 'clear', text: 'Clear all', onclick: () => { mainSel.clear(); afterMainChange(); } }) : null,
      el('span', { class: 'mode', text: timeSelected() ? 'Snapshot cards: average of the selected months' : 'Snapshot cards: latest release' }),
    ].filter(Boolean));
  };
  const afterMainChange = () => { mirrorInto(current); renderSelBar(); refreshLatest(current); };

  // Every group: auto-apply pending selections; the visible tab's applied changes become the app's state.
  for (const tab of DATA_TABS) for (const g of [`g-${tab}`, `g-${tab}-k`]) {
    let timer;
    selections.onActiveSelectionChange(g).subscribe((next) => {
      clearTimeout(timer);
      if (next.pending?.length) { timer = setTimeout(() => selections.applyPendingSelections(g), 200); return; }
      if (mirroring || tab !== current) return;
      const fromGroup = readGroup(g);
      const allowed = new Set((g.endsWith('-k') ? SCOPE[tab].kpis : SCOPE[tab].charts).map(keyOf));
      let changed = false;
      for (const k of allowed) {
        const a = JSON.stringify(mainSel.get(k) ?? null); const b = JSON.stringify(fromGroup.get(k) ?? null);
        if (a !== b) { changed = true; if (fromGroup.has(k)) mainSel.set(k, fromGroup.get(k)); else mainSel.delete(k); }
      }
      if (changed) afterMainChange();
    });
  }

  // ---------------------------------------------------------------- panes
  const panes = {};
  const hooks = {};
  const pane = (tab, kids) => {
    const t = TABS.find((x) => x.key === tab);
    panes[tab] = el('section', { class: `pane pane-${tab}`, 'data-pane': tab }, [
      el('div', { class: 'pane-head' }, [el('h1', { text: t.question }), SCOPE[tab] ? filterStrip(tab) : null]),
      el('div', { class: 'pane-body' }, kids),
    ]);
    return panes[tab];
  };

  const hero = el('div', { class: 'hero-line', 'data-hero': '' }, el('span', { text: 'Reading the latest release…' }));
  body.append(
    pane('market', [
      hero,
      el('div', { class: 'row kpis' }, ['k-uv', 'k-ur', 'k-vac', 'k-pay'].map(kpiCard)),
      el('div', { class: 'row charts' }, [card('c-uv', 'w60'), card('c-vu', 'w40')]),
      el('div', { class: 'row table' }, [card('t-latest', 'w100')]),
    ]),
    pane('demand', [
      el('div', { class: 'row upper' }, [
        el('div', { class: 'col kpi-col' }, [kpiCard('k-vac2'), kpiCard('k-red')]),
        card('c-sec-chg', 'w35'), card('c-sec-share', 'w35'),
      ]),
      el('div', { class: 'row lower' }, [card('c-sec-trend', 'w50'), card('t-sec', 'w50')]),
    ]),
    pane('pay', [
      el('div', { class: 'row kpis' }, [kpiCard('k-pay2'), kpiCard('k-real'), kpiCard('k-priv'), whatIfCard()]),
      el('div', { class: 'row charts' }, [card('c-real', 'w50'), card('c-sector-pay', 'w50')]),
      el('div', { class: 'row table' }, [card('t-pay', 'w100')]),
    ]),
    pane('regions', [
      el('div', { class: 'row upper' }, [
        el('div', { class: 'col kpi-col' }, [kpiCard('k-rur'), kpiCard('k-rer')]),
        card('c-reg-chg', 'w35'), card('c-reg-heat', 'w35'),
      ]),
      el('div', { class: 'row lower' }, [card('t-reg', 'w100')]),
    ]),
    pane('call', [el('div', { class: 'workflow-host', 'data-workflow': '' })]),
  );

  function whatIfCard() {
    const input = el('input', { type: 'range', min: '0', max: '8', step: '0.25', value: '4', 'aria-label': 'Pay award %' });
    const out = el('b', { class: 'award', text: '4.00%' });
    const reset = el('button', { class: 'link', text: 'Reset', onclick: () => { input.value = '4'; input.dispatchEvent(new Event('change')); } });
    let timer;
    const apply = async () => {
      out.textContent = `${Number(input.value).toFixed(2)}%`;
      for (const id of ['w-real', 'w-mkt']) {
        const refs = resolved.get(id)?.v;
        if (!refs) continue;
        try {
          const r = await applyRuntimeOperations({ runtime, instanceId: id, availableFields, operationRequests: [{ id: 'p', name: 'setMeasureDefinedParameter', payload: { dataItemInternalKey: refs.dataItemInternalKey, dataItemUniqueSignature: refs.dataItemUniqueSignature, parameterName: 'Pay Award %', value: { type: 'static', value: Number(input.value) } } }] });
          if (!r.results?.p?.success) console.error('[what-if refused]', id, JSON.stringify(r.results?.p));
        } catch (error) { console.error('[what-if]', id, error?.message); }
      }
    };
    input.addEventListener('input', () => { out.textContent = `${Number(input.value).toFixed(2)}%`; clearTimeout(timer); timer = setTimeout(apply, 350); });
    input.addEventListener('change', () => { clearTimeout(timer); apply(); });
    window.__setAward = (v) => { input.value = String(v); input.dispatchEvent(new Event('change')); };
    return el('figure', { class: 'card whatif', 'data-card': 'whatif' }, [
      el('figcaption', {}, [el('span', { class: 'q', text: 'Pay-award check' }), el('small', { class: 'sub', text: 'What-if on governed measures' })]),
      el('div', { class: 'award-row' }, [el('label', {}, [el('span', { text: 'Pay award' }), input]), out, reset]),
      el('div', { class: 'whatif-nums' }, [
        el('div', {}, [el('small', { text: 'After inflation' }), slot('w-real', 'w-num')]),
        el('div', {}, [el('small', { text: 'vs private-sector pay' }), slot('w-mkt', 'w-num')]),
        el('div', {}, [el('small', { text: 'Inflation (baseline)' }), slot('w-cpih', 'w-num')]),
      ]),
    ]);
  }

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
    if (SCOPE[key]) refreshLatest(key);
    for (const fn of hooks[key] ?? []) fn();
  };
  for (const t of TABS) {
    tabsNav.append(el('button', { role: 'tab', 'data-tab': t.key, text: t.label, onclick: () => go(t.key) }));
    appState.tab(t.key, () => go(t.key));
  }
  go(new URLSearchParams(location.search).get('tab') ?? 'market');

  // ---------------------------------------------------------------- hero line (text figures from stored measures)
  q({ measures: ['Unemployed per Vacancy', 'Unemployed per Vacancy Change on Year', 'Unemployed per Vacancy Pre-Pandemic', 'Vacancies Change on Year (000s)', 'Regular Pay Growth Change on Year'], filters: [{ field: { fieldKey: keyOf('Period Status') }, operator: 'inList', values: ['Latest'] }] })
    .then(([r]) => {
      const uv = r['Unemployed per Vacancy']; const d = r['Unemployed per Vacancy Change on Year']; const pre = r['Unemployed per Vacancy Pre-Pandemic'];
      const call = d > 0.05 ? 'loosening' : d < -0.05 ? 'tightening' : 'broadly stable';
      hero.dataset.call = call;
      hero.replaceChildren(
        el('span', { class: `call call-${call.split(' ').pop()}`, text: `Market ${call}` }),
        el('span', { html: `<b>${fmt(uv)}</b> unemployed people per vacancy, <b>${d >= 0 ? '+' : ''}${fmt(d)}</b> on a year and <b>${fmt(uv - pre)}</b> above the pre-pandemic ${fmt(pre)}. Vacancies <b>${fmt(r['Vacancies Change on Year (000s)'], 0)}k</b> on the year; regular pay growth <b>${fmt(r['Regular Pay Growth Change on Year'])} pp</b>.` }),
      );
    })
    .catch((e) => { hero.textContent = 'The headline could not be read.'; console.error('[hero]', e?.message); });

  // Bands: the pre-pandemic reference on the hero trend comes from the stored measure, before mounting.
  try {
    const [r] = await q({ measures: ['Unemployed per Vacancy Pre-Pandemic'] });
    const t = TILES.find((x) => x.id === 'c-uv');
    const out = await prepare({ ...t, bandValue: r['Unemployed per Vacancy Pre-Pandemic'] }, fields, availableFields, { latest: true });
    tiles.set('c-uv', { ...tiles.get('c-uv'), vSpec: out.vSpec });
  } catch (error) { console.warn('[band]', error?.message); }

  mountWorkflow(document.querySelector('[data-workflow]'), { q, keyOf });
  await runQueue();
  appState.mark('landing-ready');

  // ---------------------------------------------------------------- Excel
  exportBtn.addEventListener('click', async () => {
    exportBtn.disabled = true;
    exportBtn.title = 'Building the Excel pack…';
    window.__lastExportError = null;
    // No alert(): a modal dialog blocks the page (and any headless check) until someone dismisses it.
    try { await exportWorkbook({ q, keyOf, mainSel, timeSelected: timeSelected(), chipLabel }); exportBtn.title = 'Download the briefing pack as Excel, following the current selections'; }
    catch (error) { window.__lastExportError = String(error?.message ?? error); exportBtn.title = `Export failed: ${window.__lastExportError}`; console.error('[export]', error); }
    finally { exportBtn.disabled = false; }
  });

  // ---------------------------------------------------------------- app checks for the smoke test
  const settle = (ms) => new Promise((r) => setTimeout(r, ms));
  /** Queries finished and tables repainted. A query is logged when it answers, so wait long enough for the first to come back. */
  const quiet = () => appState.quiet({ quietMs: 2500, paintMs: 1500, timeoutMs: 30000 });
  window.__select = async (name, values) => { mainSel.set(keyOf(name), values); afterMainChange(); await quiet(); };
  /** Clear all, through the selection bar's own button. */
  const clearAll = async () => { const b = selBar.querySelector('button.clear'); if (b) b.click(); else { mainSel.clear(); afterMainChange(); } await quiet(); };
  window.__clear = clearAll;
  /** What an object is showing, read from its own export query (same filters and selections as the object). */
  const digest = async (id) => {
    const h = handles.get(showing.get(id) ?? id);
    const r = await h?.getData?.({ limit: 2000 }).catch((e) => ({ error: e?.message }));
    const rows = Object.values(r?.data?.response?.data ?? r?.data?.data ?? r?.data ?? {});
    const flat = JSON.stringify(rows);
    let sum = 0; for (const v of flat.match(/-?\d+(\.\d+)?/g) ?? []) sum += Number(v);
    return `${rows.length}r:${sum.toFixed(2)}`;
  };
  window.__digest = digest;
  const snap = async (ids) => Object.fromEntries(await Promise.all(ids.map(async (id) => [id, await digest(id)])));
  /** Select through a tab's own group, the path a chart click or filter takes, then let it apply. */
  const groupSelect = async (tab, name, values) => {
    selections.selectValues(`g-${tab}`, asSelection(keyOf(name), values), { state: 'applied' });
    await quiet();
  };
  const selectionCheck = (tab, label, ids, act) => appState.check(`${tab}: ${label} changes ${ids.join(", ")}; Clear all restores them`, async () => {
    go(tab); await quiet();
    const before = await snap(ids);
    const q0 = queryLog().length;
    const t0 = performance.now();
    await act();
    const during = await snap(ids);
    const log = queryLog().slice(q0).filter((e) => !e.prefetch);
    const queries = log.filter((e) => !e.cached).length;
    const byObject = {}; for (const e of log) { const id = /"objectId":"([^"]+)"/.exec(e.key)?.[1] ?? 'app'; byObject[id] = (byObject[id] ?? 0) + (e.cached ? 0 : 1); }
    const ms = Math.round(performance.now() - t0);
    await clearAll();
    const after = await snap(ids);
    const changed = ids.filter((id) => during[id] !== before[id]);
    const restored = ids.filter((id) => after[id] === before[id]);
    (window.__verify ??= []).push({ tab, label, before, during, after, queries, cached: log.length - queries, byObject, ms });
    return { pass: changed.length === ids.length && restored.length === ids.length, detail: `changed ${changed.join(',') || 'none'}; restored ${restored.join(',') || 'none'}; ${queries} engine queries (+${log.length - queries} cached) in ${ms} ms; ${JSON.stringify(byObject)}` };
  });
  selectionCheck('market', 'Year filter = 2022', ['k-uv', 'c-uv', 't-latest'], () => groupSelect('market', 'Year', [2022]));
  selectionCheck('demand', 'click a sector (Hospitality)', ['c-sec-share', 'c-sec-trend', 't-sec'], () => groupSelect('demand', 'Sector', ['Hospitality']));
  selectionCheck('demand', 'Year filter = 2023', ['k-vac2', 'c-sec-chg', 't-sec'], () => groupSelect('demand', 'Year', [2023]));
  selectionCheck('pay', 'Year filter = 2023', ['k-pay2', 'c-real', 't-pay'], () => groupSelect('pay', 'Year', [2023]));
  selectionCheck('regions', 'click a region (Scotland)', ['k-rur', 'c-reg-heat', 't-reg'], () => groupSelect('regions', 'Geography', ['Scotland']));
  appState.check('Selections hold across tabs: Year on Market reaches Pay', async () => {
    go('pay'); await quiet();
    const base = await digest('k-pay2');
    go('market'); await quiet();
    await groupSelect('market', 'Year', [2022]);
    go('pay'); await quiet();
    const chip = selBar.textContent.includes('2022');
    const d = await digest('k-pay2');
    await clearAll();
    const after = await digest('k-pay2');
    return { pass: chip && d !== base && after === base, detail: `chip ${chip}; pay KPI ${base} -> ${d} -> ${after}` };
  });
  appState.check('Excel pack: clicking the button with Year = 2022 applied downloads a 7-sheet workbook of the selected figures', async () => {
    go('market'); await quiet();
    await groupSelect('market', 'Year', [2022]);
    window.__lastExport = null;
    exportBtn.click();
    for (let i = 0; i < 90 && !window.__lastExport && !window.__lastExportError; i++) await settle(500);
    const info = window.__lastExport;
    await clearAll();
    return { pass: info?.sheets?.length === 7 && info.basis === 'Average of the selected months' && !info.diag?.length, detail: JSON.stringify({ error: window.__lastExportError, diag: info?.diag, sheets: info?.sheets, basis: info?.basis, kpis: info?.kpis }) };
  });
  appState.check('What-if: moving the pay award from 4% to 6% changes both scenario numbers; Reset restores them', async () => {
    go('pay'); await quiet();
    const before = await snap(['w-real', 'w-mkt', 'w-cpih']);
    window.__setAward(6); await settle(500); await quiet();
    const during = await snap(['w-real', 'w-mkt', 'w-cpih']);
    window.__setAward(4); await settle(500); await quiet();
    const after = await snap(['w-real', 'w-mkt', 'w-cpih']);
    return { pass: during['w-real'] !== before['w-real'] && during['w-mkt'] !== before['w-mkt'] && during['w-cpih'] === before['w-cpih'] && after['w-real'] === before['w-real'], detail: JSON.stringify({ before, during, after }) };
  });
  // Read-only: a check never submits, approves or resets (the demo state is the viewer's own).
  appState.check('Workflow: the call is labelled simulated, the four-eyes rule holds and the audit trail is shown', async () => {
    go('call'); await settle(500);
    const host = document.querySelector('[data-workflow]');
    const simulated = /Simulated workflow/.test(host.querySelector('.sim')?.textContent ?? '');
    const audit = host.querySelectorAll('.audit-list li').length;
    const actions = [...host.querySelectorAll('.actions .btn')];
    const makerCannotDecide = actions.length === 2 && actions.every((b) => b.disabled);
    const roles = [...host.querySelectorAll('.acting option')].map((o) => o.textContent);
    return { pass: simulated && audit >= 2 && makerCannotDecide && roles.length === 2, detail: JSON.stringify({ simulated, audit, makerCannotDecide, roles }) };
  });
  window.__appInfo = { tiles: tiles.size, failures, queries: () => queryLog().length };
};

main().catch((error) => {
  console.error('[boot]', error);
  appState.bootFailed(error);
  document.getElementById('root').replaceChildren(el('div', { class: 'boot error', text: `Could not start: ${error?.message ?? error}` }));
});
