/**
 * Private Markets Portfolio OS — Northstar (fictional; mock data).
 * Investment intelligence. Valuations. Decisions. Execution.
 *
 * Governed Astrato App on the "Northstar – Private Markets Portfolio OS" semantic layer
 * (ASTRATO_GALLERY.MOCK_DATA.NSC_*). Analytics are native Astrato objects; workbench, scenario
 * and workflow screens compute on governed rows (engine.getData) with the deterministic engine
 * in engine.js, and write decisions back through Astrato writeback with a full audit trail.
 */
import { createAstratoApp } from '@astrato-io/app-runtime';
import { createVisualizationRuntime, registry } from '@astrato-io/visualizations';
import { createVisualizationAvailableFields } from '@astrato-io/visualizations/definitions';
import { applyRuntimeOperations } from '@astrato-io/visualizations/operations';
import { appState } from './app-state.js';
import { throttleQueries, clearQueryCache, queryLog } from './throttle.js';
import { buildTiles, buildTile, compileTiles, compileDefinition, KPIS } from './dashboard.js';
import { createFieldIndex } from './fields.js';
import { themeVSpec, applyEach, fitRequests } from './theme.js';
import { el, esc, icon, toast, mountToasts, mountDrawer, closeDrawer, openDrawer, USERS, me, setMe, ccy, setCcy, FXR, store, connectStore, loadStore, onStore, records, can, TODAY, resetLocal, localTableWrites } from './core.js';
import { M, loadModel } from './data.js';
import { QUESTIONS } from './questions.js';
import { mountPortfolio } from './pages/portfolio.js';
import { mountCompany } from './pages/company.js';
import { mountAnalysis } from './pages/analysis.js';
import { mountMonitoring } from './pages/monitoring.js';
import { mountValuations } from './pages/valuations.js';
import { mountScenario } from './pages/scenario.js';
import { mountValue } from './pages/value.js';
import { mountIC } from './pages/ic.js';
import { mountWorkflows } from './pages/workflows.js';
import { mountNash } from './pages/nash.js';
import { exportMenu, buildWorkbook, PORTFOLIO } from './export.js';

const PAGES = [
  ['portfolio', 'Portfolio', 'space_dashboard', 'Investment command centre'],
  ['company', 'Companies', 'apartment', 'Company workspace'],
  ['monitoring', 'Quarterly Monitoring', 'fact_check', 'Collect · validate · approve'],
  ['analysis', 'Financial Analysis', 'query_stats', 'Drivers and variances'],
  ['valuations', 'Valuations', 'balance', 'Valuation workbench'],
  ['scenario', 'Scenario Lab', 'science', 'Model and compare cases'],
  ['value', 'Value Creation', 'trending_up', 'Initiatives to outcomes'],
  ['ic', 'Investment Committee', 'gavel', 'Decision packages'],
  ['workflows', 'Workflows & Approvals', 'approval', 'Queues and audit'],
  ['nash', 'Nash AI', 'auto_awesome', 'Governed intelligence'],
];
const GROUPS = PAGES.map(([k]) => `g-${k}`);
const SHARED = new Set(['Companies', 'Funds']);
const viewOfKey = (k) => /^\[([^\]]+)\]/.exec(String(k))?.[1];

const main = async () => {
  window.__boot = 'start';
  const app = await createAstratoApp();
  throttleQueries(app.client.hostServices);
  const { engine, selections } = app.client.hostServices;
  window.__sel = selections;
  for (const g of GROUPS) {
    let timer;
    selections.onActiveSelectionChange(g).subscribe((next) => { clearTimeout(timer); if (next.pending.length > 0) timer = setTimeout(() => selections.applyPendingSelections(g), 250); });
  }
  const metadata = await engine.fields.getFieldMetadata({ ...app.dataBinding });
  const runtime = createVisualizationRuntime({ client: app.client, registry });
  const availableFields = createVisualizationAvailableFields(metadata).filter((f) => f?.resultType !== 'unhandled');
  const dataBinding = { ...app.dataBinding };
  const fields = createFieldIndex(availableFields);
  window.__fields = fields;

  /** Governed query: dims [[field, view]], measures by name, filters [[field, view, values]]. */
  const q = async ({ dims = [], measures = [], limit = 500, filters = [] }) => {
    const dimensions = dims.map(([name, view]) => { const f = fields.raw(name, view); if (!f) throw new Error(`no field ${view}.${name}`); return { fieldKey: f.fieldKey, name }; });
    const calculations = measures.map((name) => { const f = fields.measure(name); if (!f) throw new Error(`no measure ${name}`); return { calculation: '{m1}', itemKey: f.fieldKey, label: name }; });
    const query = { dimensions, calculations, orders: [], limit, offset: 0, filters: filters.map(([f, v, values]) => ({ field: { fieldKey: fields.raw(f, v).fieldKey }, operator: 'inList', values: values.map(String) })), totals: false, showRecordsCount: false, outerViews: [], associativeListFilter: null };
    const { response } = await engine.getData({ ...dataBinding, query });
    const names = [...dimensions.map((d) => d.name), ...measures];
    return Object.values(response?.data ?? {}).map((row) => Object.fromEntries(names.map((n, i) => [n, row[i]])));
  };
  window.__q = q;
  const write = async (req) => {
    if (typeof app.writeback !== 'function') throw new Error('writeback is not available in this runtime');
    const r = await app.writeback({ dataviewID: app.dataBinding.semanticLayerId, ...req });
    clearQueryCache();
    if (!r?.response?.rowsAffected) throw new Error('no rows changed');
    return r;
  };
  connectStore({ q, write });

  // ------------------------------------------------------------------ tiles
  const built = buildTiles(fields);
  const compiled = await compileTiles(built.tiles, availableFields);
  const failures = [...built.failures, ...compiled.failures];
  if (failures.length) console.warn('[tiles]', JSON.stringify(failures));
  const tiles = new Map();
  await Promise.all(compiled.compiled.map(async (t) => {
    const themed = await themeVSpec({ id: t.id, type: t.type, vSpec: t.vSpec, dataBinding }, availableFields, t);
    tiles.set(t.id, { ...t, vSpec: themed.vSpec });
  }));
  window.__astrato = { tiles: [...tiles.keys()], failures, mounted: {}, errors: {} };
  window.__boot = 'themed';
  const [model] = await Promise.all([loadModel(q, fields), loadStore()]);
  window.__M = model;
  try { const fx = M.fx.filter((r) => r.Quarter === '2026-Q3'); for (const r of fx) FXR[r.Ccy] = r['Rate To Usd']; } catch { /* keep defaults */ }

  // ------------------------------------------------------------------ shell
  const root = document.getElementById('root');
  const nav = el('nav', { class: 'side' });
  const body = el('main', { class: 'content' });
  const selBar = el('div', { class: 'selbar' });
  const toasts = el('div', { class: 'toasts' });
  const drawer = el('aside', { class: 'drawer' });
  mountToasts(toasts); mountDrawer(drawer);
  const banner = el('div', { class: 'period-banner', hidden: true });
  let period = '2026-Q3';

  const searchInput = el('input', { type: 'search', placeholder: 'Search companies, funds, metrics, reviews, actions…', 'aria-label': 'Global search' });
  const searchOut = el('div', { class: 'search-out', hidden: true });
  const bell = el('button', { class: 'icon-btn bell', title: 'Notifications' }, [icon('notifications'), el('b', { class: 'badge', text: '0' })]);
  const userSel = el('select', { class: 'user', 'aria-label': 'Acting as' }, USERS.map((u, i) => el('option', { value: i, text: `${u.name} · ${u.role}` })));
  userSel.value = String(Math.max(0, USERS.findIndex((u) => u.name === me().name)));
  userSel.addEventListener('change', () => { setMe(USERS[Number(userSel.value)]); toast(`Acting as <b>${esc(me().name)}</b> (${esc(me().role)})`, 'badge'); });
  const ccySel = el('select', { 'aria-label': 'Currency', title: `Presentation currency for workbench figures. Rates: Northstar Treasury quarter-end ${FXR.date} (EUR ${FXR.EUR}, GBP ${FXR.GBP} per USD). Native analytics are reported in USD.` }, ['USD', 'EUR', 'GBP'].map((c) => el('option', { value: c, text: c })));
  ccySel.value = ccy();
  ccySel.addEventListener('change', () => setCcy(ccySel.value));
  const periodSel = el('select', { 'aria-label': 'Reporting period' }, [el('option', { value: '2026-Q3', text: 'Q3 2026 · reported' }), el('option', { value: '2026-Q4', text: 'Q4 2026 · next period (simulated)' })]);
  const fundSel = el('select', { 'aria-label': 'Portfolio / fund' }, [el('option', { value: '', text: 'All funds' }), ...M.funds.map((f) => el('option', { value: f.Fund, text: `${f.Fund} · ${f['Fund Name']}` }))]);
  const exportBtn = el('button', { class: 'btn ghost sm' }, [icon('ios_share'), el('span', { text: 'Export' })]);
  const resetBtn = el('button', { class: 'btn ghost sm', title: 'Restore the seeded demo state' }, [icon('restart_alt'), el('span', { text: 'Reset demo' })]);

  root.replaceChildren(
    el('div', { class: 'shell' }, [
      el('aside', { class: 'rail' }, [
        el('div', { class: 'brand' }, [el('div', {}, [el('b', { class: 'wordmark', text: 'Northstar' }), el('small', { text: 'Portfolio OS · Private Equity' })])]),
        nav,
        el('div', { class: 'rail-foot' }, [el('div', { class: 'src' }, [el('i'), el('span', { text: 'Snowflake · governed semantic layer' })]), el('a', { class: 'built', href: 'https://astrato.io', target: '_blank', rel: 'noopener' }, [el('span', { text: 'Built in' }), el('img', { src: '/astrato-logo-white.svg', alt: 'Astrato' })])]),
      ]),
      el('div', { class: 'main' }, [
        el('header', { class: 'top' }, [
          el('div', { class: 'title' }, [el('h1', { text: 'Private Markets Portfolio OS' }), el('p', { text: 'Investment intelligence. Valuations. Decisions. Execution.' })]),
          el('div', { class: 'search' }, [icon('search'), searchInput, searchOut]),
          el('div', { class: 'globals' }, [el('label', {}, [el('span', { text: 'Period' }), periodSel]), el('label', {}, [el('span', { text: 'Fund' }), fundSel]), el('label', {}, [el('span', { text: 'CCY' }), ccySel])]),
          el('div', { class: 'tools' }, [exportBtn, resetBtn, bell, el('label', { class: 'acting' }, [el('span', { text: 'Acting as' }), userSel])]),
        ]),
        banner, selBar, body,
      ]),
    ]), drawer, toasts,
  );

  // ------------------------------------------------------------------ native object slots
  const mountQueue = [];
  const slotFor = (id) => { const s = el('div', { class: 'viz', 'data-slot': id }); mountQueue.push([id, s]); return s; };
  const card = (id, cls = 'half', extra) => {
    const t = tiles.get(id);
    return el('figure', { class: `card ${cls}` }, [el('figcaption', {}, [el('span', { text: t?.title ?? id }), extra ?? null]), t ? slotFor(id) : el('p', { class: 'note', text: `Not available: ${failures.find((f) => f.id === id)?.reason ?? id}` })]);
  };
  const kpi = (id) => el('figure', { class: 'card kpi' }, [
    el('figcaption', { text: KPIS[id]?.label ?? tiles.get(id)?.title ?? id }),
    el('div', { class: 'kpi-row' }, [el('div', { class: 'kpi-num' }, tiles.has(id) ? slotFor(id) : null), tiles.has(`${id}-sp`) ? el('div', { class: 'kpi-spark' }, slotFor(`${id}-sp`)) : null]),
    tiles.has(`${id}-d`) ? el('div', { class: 'kpi-delta' }, slotFor(`${id}-d`)) : null,
  ]);
  const filters = (page) => { const ids = [...tiles.values()].filter((t) => t.type === 'filter' && t.page === page).map((t) => t.id); return ids.length ? el('div', { class: 'filters' }, ids.map((id) => el('div', { class: 'filter' }, [el('small', { text: tiles.get(id).title }), slotFor(id)]))) : null; };

  // ------------------------------------------------------------------ ad-hoc native objects (Nash answers, comparisons)
  let adhoc = 0;
  const renderTile = async (spec, slot, { group = 'g-nash' } = {}) => {
    const id = `adhoc-${++adhoc}`;
    slot.dataset.slot = id;
    const type = spec.type;
    const tile = {
      id, slot: id, page: 'nash', title: spec.title, type, group, fontSize: type === 'table' ? 12 : undefined,
      dimensions: spec.dims.map(([name, view], i) => ({ name, view, ref: `d${i}` })), measures: spec.measures.map((m, i) => ({ name: m, ref: `m${i}`, format: { formatType: 'numberNoDecimal' } })),
      filters: (spec.filters ?? []).map(([field, view, values]) => ({ view, field, values })), sort: spec.sort, limit: spec.limit ?? 200,
      legend: spec.measures.length > 1, legendPosition: 'top', orientation: spec.orientation ?? 'horizontal', colors: spec.colors ?? ['#14283A', '#4E9A8E', '#8FB3D9', '#C8B88A', '#5B4B8A', '#7A8494'], columnLabels: spec.columnLabels,
      ...(spec.miniChart ? { miniChart: spec.miniChart } : {}),
      ops: type === 'table'
        ? [{ name: 'setTableFixedRowHeightEnabled', payload: true }, { name: 'setTableFixedRowHeightValue', payload: 28 }, ...spec.measures.flatMap((m, i) => [{ name: 'setColumnFormatType', ref: `m${i}`, payload: { formatType: 'custom' } }, { name: 'setColumnFormatString', ref: `m${i}`, payload: { formatString: spec.formats?.[i] ?? '#,##0.0' } }, { name: 'setColumnHorizontalAlign', ref: `m${i}`, payload: { horizontalAlign: 'right' } }])]
        : spec.measures.flatMap((m, i) => [{ name: 'setMeasureFormatType', ref: `m${i}`, payload: { formatType: 'custom' } }, { name: 'setMeasureFormatString', ref: `m${i}`, payload: { formatString: spec.formats?.[i] ?? '#,##0.0' } }]),
    };
    const out = buildTile(tile, fields);
    if (out.failure) { slot.textContent = out.failure.reason; return null; }
    const c = await compileDefinition(type, out.tile.definition, availableFields);
    let vSpec = (await themeVSpec({ id, type, vSpec: c.vSpec, dataBinding }, availableFields, { ...out.tile, ...c })).vSpec;
    if (type === 'table') vSpec = await fit({ ...out.tile, ...c, vSpec, fitColumns: Object.fromEntries([...tile.dimensions, ...tile.measures].map((x) => [x.ref, 0.98 / (tile.dimensions.length + tile.measures.length)])) }, slot.clientWidth || 900);
    runtime.createInstance({ id, type, groupId: group, vSpec, dataBinding });
    appState.declare(id, null);
    const h = await runtime.mount(slot, id).catch((e) => { appState.settle(id, 'error', e); throw e; });
    const r = await h?.ready;
    window.__astrato.mounted[id] = r?.status;
    appState.settle(id, r?.status, r);
    return id;
  };
  const dropTile = (id) => { try { runtime.removeInstance?.(id); } catch { /* gone */ } };

  // ------------------------------------------------------------------ selections
  const fieldKeyOf = (name, view) => fields.raw(name, view)?.fieldKey;
  const select = (group, name, view, values) => {
    const fieldKey = fieldKeyOf(name, view);
    const sel = selections.getSelection(group) ?? { applied: [] };
    for (const x of sel.applied ?? []) if (x.field?.fieldKey === fieldKey) selections.removeSelection(group, x);
    if (values?.length) selections.selectValues(group, { field: { fieldKey }, kind: 'VALUE', operator: 'inList', values }, { state: 'applied' });
  };
  const selectedValues = (group, name, view) => { const fk = fieldKeyOf(name, view); return ((selections.getSelection(group) ?? {}).applied ?? []).find((x) => x.field?.fieldKey === fk)?.values ?? []; };
  const labelOf = (fk) => String(fk ?? '').match(/\[([^\]]+)\]$/)?.[1] ?? fk;
  let current = 'portfolio';
  const renderSelBar = () => {
    const g = `g-${current}`;
    const { applied = [], pending = [] } = selections.getSelection(g) ?? {};
    const list = [...applied, ...pending].filter((x) => x.values?.length);
    const fund = fundSel.value;
    selBar.replaceChildren(el('b', { text: 'Selections' }),
      ...(list.length ? list.map((x) => el('span', { class: 'chip' }, [el('i', { text: labelOf(x.field?.fieldKey) }), document.createTextNode(x.values.slice(0, 4).join(', ') + (x.values.length > 4 ? ` +${x.values.length - 4}` : '')),
        el('button', { text: '×', title: 'Remove', onclick: () => { if (labelOf(x.field?.fieldKey) === 'Fund' && fund) { fundSel.value = ''; fundSel.dispatchEvent(new Event('change')); } else selections.removeSelection(g, x); } })]))
        : [el('span', { class: 'none', text: current === 'company' ? 'Company workspace follows the company you open.' : 'None. Click any bar, row or point, or use the filters, to narrow this page.' })]),
      ...(list.length && current !== 'company' ? [el('button', { class: 'clear', text: 'Clear all', onclick: () => { selections.clearAllSelections(g); if (fund) { fundSel.value = ''; applyFund(); } } })] : []));
  };
  for (const g of GROUPS) selections.onActiveSelectionChange(g).subscribe(() => { if (`g-${current}` === g) renderSelBar(); });
  const applyFund = () => { for (const g of GROUPS) if (g !== 'g-company') select(g, 'Fund', 'Companies', fundSel.value ? [fundSel.value] : []); window.dispatchEvent(new Event('nsos-fund')); renderSelBar(); };
  fundSel.addEventListener('change', applyFund);

  // Measure-only objects (KPI numbers, one-row delta tables) mirror group selections as static filters.
  const measureOnly = [...tiles.values()].filter((t) => t.type === 'number' || (t.type === 'table' && !(t.fieldKeys ?? []).length));
  const baseVSpec = new Map(measureOnly.map((t) => [t.id, t.vSpec]));
  const runs = new Map();
  const staticFilterOf = (applied) => ({ operator: 'and', filters: applied.map((x) => ({ operator: 'or', filters: x.values.map((v) => ({ fieldKey: x.field.fieldKey, operator: 'equals', values: { value: String(v) } })) })) });
  for (const g of GROUPS) {
    let sig = '[]';
    selections.onActiveSelectionChange(g).subscribe((next) => {
      const applied = next.applied.filter((x) => x.values?.length);
      const nextSig = JSON.stringify(applied.map((x) => [x.field.fieldKey, x.values]));
      if (nextSig === sig) return;
      sig = nextSig;
      const run = (runs.get(g) ?? 0) + 1;
      runs.set(g, run);
      for (const t of measureOnly.filter((x) => x.group === g)) {
        const own = KPIS[t.id.replace(/-d$/, '')]?.view;
        const usable = applied.filter((x) => { const v = viewOfKey(x.field.fieldKey); return SHARED.has(v) || v === own; });
        const base = baseVSpec.get(t.id);
        (usable.length ? applyEach({ id: t.id, type: t.type, vSpec: base, dataBinding }, availableFields, t.type, [{ name: 'setStaticFilterGroup', payload: staticFilterOf(usable) }]) : Promise.resolve({ vSpec: base }))
          .then(({ vSpec }) => { if (runs.get(g) !== run) return; tiles.get(t.id).vSpec = vSpec; if (runtime.listInstances().some((i) => i.id === t.id)) runtime.updateInstance(t.id, { vSpec }); });
      }
    });
  }

  // ------------------------------------------------------------------ pages
  const panes = {};
  const hooks = {};
  // Hidden panes are laid out off-screen at the active pane's width (styles.css), so charts keep a true size.
  const syncPaneWidth = () => { const w = panes[current]?.getBoundingClientRect().width; if (w > 100) document.documentElement.style.setProperty('--pane-w', `${Math.round(w)}px`); };
  window.addEventListener('resize', () => requestAnimationFrame(syncPaneWidth));
  // Back from an inactive browser tab: re-measure and let every chart re-fit to its real box.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') setTimeout(() => { syncPaneWidth(); window.dispatchEvent(new Event('resize')); }, 50); });
  const go = (key, arg) => {
    if (!panes[key]) return;
    for (const [k, p] of Object.entries(panes)) p.hidden = k !== key;
    for (const b of nav.querySelectorAll('button')) b.classList.toggle('on', b.dataset.page === key);
    current = key;
    syncPaneWidth();
    closeDrawer();
    renderSelBar();
    for (const fn of hooks[key] ?? []) fn(arg);
    document.querySelector('.content')?.scrollTo?.({ top: 0 });
    window.scrollTo({ top: 0 });
    try { history.replaceState(null, '', `#${key}`); } catch { /* */ }
  };
  const onShow = (key, fn) => { (hooks[key] ??= []).push(fn); };
  const ctx = { el, q, M, fields, tiles, card, kpi, filters, renderTile, dropTile, select, selectedValues, go, onShow, get period() { return period; },
    // What the export reads as the filters on screen: the page shown, the top-bar Fund, a group's applied selections.
    get page() { return current; }, get fund() { return fundSel.value; }, applied: (g) => ((selections.getSelection(g) ?? {}).applied ?? []).filter((x) => x.values?.length), labelOf, toast, layerId: app.dataBinding.semanticLayerId, questions: QUESTIONS, refreshStore: loadStore, clearQueryCache };
  window.__ctx = ctx;
  const MOUNT = { portfolio: mountPortfolio, company: mountCompany, monitoring: mountMonitoring, analysis: mountAnalysis, valuations: mountValuations, scenario: mountScenario, value: mountValue, ic: mountIC, workflows: mountWorkflows, nash: mountNash };
  for (const [key, label, ic, sub] of PAGES) {
    const pane = el('section', { class: 'pane', 'data-page': key, hidden: true });
    panes[key] = pane;
    body.append(pane);
    appState.tab(key, () => go(key));
    nav.append(el('button', { 'data-page': key, onclick: () => go(key) }, [icon(ic), el('span', {}, [el('b', { text: label }), el('small', { text: sub })]), el('em', { class: 'count', 'data-count': key })]));
    try { MOUNT[key](ctx, pane); } catch (e) { console.error('[page]', key, e); pane.append(el('p', { class: 'note', text: `This module failed to load: ${e?.message ?? e}` })); }
  }

  // ------------------------------------------------------------------ notifications (persistent: derived from the governed workflow store)
  const notifications = () => {
    const role = me().role;
    const list = [];
    const mon = records('Monitoring', (r) => r.period === '2026-Q3');
    const overdue = mon.filter((r) => r.due && r.due < TODAY && !['Approved', 'Locked'].includes(r.status));
    if (overdue.length) list.push(['error', `${overdue.length} monitoring submissions overdue`, 'monitoring']);
    const toReview = mon.filter((r) => (['Validation', 'Analyst Review'].includes(r.status) && ['Investment Analyst', 'Investment Associate'].includes(role)) || (r.status === 'Investment Team Review' && role === 'Investment Director'));
    if (toReview.length) list.push(['rule', `${toReview.length} monitoring packs awaiting your review`, 'monitoring']);
    const vals = M.vals.filter((v) => v.Quarter === '2026-Q3' && v.Status !== 'Approved');
    if (vals.length) list.push(['balance', `${vals.length} Q3 valuations awaiting approval${role === 'Valuation Committee' ? ' — your decision' : ''}`, 'valuations']);
    const ic = records('IC Package', (r) => ['Submitted', 'Under Review'].includes(r.status));
    if (ic.length) list.push(['gavel', `${ic.length} IC packages awaiting decision${role === 'Investment Director' ? ' — your decision' : ''}`, 'ic']);
    const scn = records('Scenario', (r) => r.status === 'Submitted');
    if (scn.length) list.push(['science', `${scn.length} scenarios submitted for approval`, 'scenario']);
    const init = records('Initiative', (r) => ['Proposed', 'Under Review'].includes(r.status));
    if (init.length) list.push(['trending_up', `${init.length} value-creation initiatives awaiting approval`, 'value']);
    const acts = records('Action', (r) => ['Open', 'In Progress'].includes(r.status));
    if (acts.length) list.push(['task_alt', `${acts.length} open actions`, 'workflows']);
    return list;
  };
  const renderBell = () => {
    const n = notifications();
    bell.querySelector('.badge').textContent = String(n.length);
    bell.querySelector('.badge').hidden = !n.length;
    const counts = { monitoring: records('Monitoring', (r) => r.period === '2026-Q3' && !['Approved', 'Locked'].includes(r.status)).length, valuations: M.vals.filter((v) => v.Quarter === '2026-Q3' && v.Status !== 'Approved').length, ic: records('IC Package', (r) => ['Submitted', 'Under Review'].includes(r.status)).length, workflows: records('Action', (r) => ['Open', 'In Progress'].includes(r.status)).length };
    for (const em of nav.querySelectorAll('[data-count]')) { const c = counts[em.dataset.count]; em.textContent = c ? String(c) : ''; }
  };
  bell.addEventListener('click', () => {
    const n = notifications();
    openDrawer({ title: 'Notifications', kicker: `${me().name} · ${me().role}`, body: [el('ul', { class: 'notif' }, n.length ? n.map(([ic, text, page]) => el('li', {}, [el('button', { class: 'linkish', onclick: () => go(page) }, [icon(ic), el('span', { text })])])) : [el('li', { text: 'Nothing needs your attention.' })]),
      el('p', { class: 'note', text: `Workflow store: ${store.live ? 'governed views in Snowflake (live)' : 'simulated persistence in this browser'}${store.simulated.length ? ` · ${store.simulated.length} records kept locally` : ''}.` })] });
  });
  onStore(renderBell);
  window.addEventListener('nsos-user', renderBell);
  window.addEventListener('nsos-model', renderBell);
  renderBell();

  // ------------------------------------------------------------------ global search
  const metricNames = availableFields.filter((f) => f.kind === 'calculation' || f.kind === 'measure' || String(f.fieldKey).startsWith('[calculation]')).map((f) => f.name).filter(Boolean);
  const runSearch = () => {
    const t = searchInput.value.trim().toLowerCase();
    if (t.length < 2) { searchOut.hidden = true; return; }
    const hits = [];
    for (const c of M.companies) if (`${c.Company} ${c.Sector} ${c.Subsector} ${c.Country}`.toLowerCase().includes(t)) hits.push(['apartment', c.Company, `${c.Fund} · ${c.Subsector}`, () => go('company', c.Company)]);
    for (const f of M.funds) if (`${f.Fund} ${f['Fund Name']}`.toLowerCase().includes(t)) hits.push(['account_balance', f['Fund Name'], `Vintage ${f.Vintage}`, () => { fundSel.value = f.Fund; applyFund(); go('portfolio'); }]);
    for (const m of metricNames) if (m.toLowerCase().includes(t)) hits.push(['functions', m, 'Governed metric → ask Nash', () => go('nash', `What is ${m}?`)]);
    for (const qq of QUESTIONS) if (qq.name.toLowerCase().includes(t) || qq.keywords.includes(t)) hits.push(['quiz', qq.name, `Business question · ${qq.cat}`, () => go('nash', qq.name)]);
    for (const v of M.vals.filter((x) => x.Quarter === '2026-Q3')) if (`${v.Company} valuation review`.toLowerCase().includes(t)) hits.push(['balance', `${v.Company} · Q3 2026 valuation`, v.Status, () => go('valuations', v.Company)]);
    for (const r of store.records.filter((x) => ['Action', 'IC Package', 'Scenario', 'Initiative', 'Saved View'].includes(x.type))) if (`${r.title} ${r.company} ${r.id}`.toLowerCase().includes(t)) hits.push([{ Action: 'task_alt', 'IC Package': 'gavel', Scenario: 'science', Initiative: 'trending_up', 'Saved View': 'bookmark' }[r.type], r.title, `${r.type} · ${r.status}`, () => go({ Action: 'workflows', 'IC Package': 'ic', Scenario: 'scenario', Initiative: 'value', 'Saved View': 'portfolio' }[r.type], r.type === 'Saved View' ? { view: r.id } : r.company)]);
    searchOut.hidden = false;
    searchOut.replaceChildren(...(hits.length ? hits.slice(0, 14).map(([ic, a, b, fn]) => el('button', { onclick: () => { searchOut.hidden = true; searchInput.value = ''; fn(); } }, [icon(ic), el('span', {}, [el('b', { text: a }), el('small', { text: b })])])) : [el('p', { class: 'note', text: 'No matches.' })]));
  };
  searchInput.addEventListener('input', runSearch);
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') { searchOut.hidden = true; searchInput.blur(); } if (e.key === 'Enter') searchOut.querySelector('button')?.click(); });
  document.addEventListener('click', (e) => { if (!e.target.closest('.search')) searchOut.hidden = true; });

  // ------------------------------------------------------------------ reporting period (Q4 2026 = simulated next period for the Monitor step)
  periodSel.addEventListener('change', () => {
    period = periodSel.value;
    banner.hidden = period === '2026-Q3';
    banner.replaceChildren(icon('science'), el('span', { html: '<b>Q4 2026 · simulated next reporting period.</b> Realised results are generated by the same model as the history; use it to compare outcomes against approved plans and initiative targets.' }));
    window.dispatchEvent(new Event('nsos-period'));
    toast(period === '2026-Q4' ? 'Advanced to the next reporting period (Q4 2026, simulated)' : 'Back to the reported period (Q3 2026)', 'event');
  });

  // ------------------------------------------------------------------ export, reset
  exportBtn.addEventListener('click', () => exportMenu(ctx));
  resetBtn.addEventListener('click', async () => {
    if (!can('admin.rules') && !confirm('Reset the demo for everyone? This restores the seeded workflow state.')) return;
    const { resetDemo } = await import('./reset.js');
    await resetDemo(ctx);
    resetLocal();
    location.reload();
  });

  // ------------------------------------------------------------------ mount native objects
  const fit = async (t, width) => {
    if (!t.fitColumns || width < 40) return t.vSpec;
    return (await applyEach({ id: t.id, type: t.type, vSpec: t.vSpec, dataBinding }, availableFields, t.type, fitRequests(t, width))).vSpec;
  };
  /** Column widths on a created instance (mounted or not): operations on the runtime's own vSpec, never a snapshot written back. */
  const fitLive = async (t, width) => {
    const { results } = await applyRuntimeOperations({ runtime, instanceId: t.id, availableFields, operationRequests: fitRequests(t, width).map((request, i) => ({ id: `fit${i}`, ...request })) });
    const refused = Object.values(results ?? {}).filter((result) => result?.success === false);
    if (refused.length) console.warn('[fit]', t.id, JSON.stringify(refused));
  };
  const start = (location.hash || '#portfolio').slice(1);
  go(panes[start] ? start : 'portfolio');
  document.getElementById('splash')?.remove();
  window.__boot = 'shell';
  const fitted = new Map();
  const refit = new ResizeObserver((entries) => {
    for (const e of entries) {
      const id = e.target.dataset.slot, t = tiles.get(id), w = Math.round(e.contentRect.width);
      if (!t?.fitColumns || w < 40 || Math.abs(w - (fitted.get(id) ?? 0)) <= 2) continue;
      clearTimeout(e.target.fitTimer);
      e.target.fitTimer = setTimeout(() => { fitted.set(id, w); fitLive(t, w).catch((err) => console.warn('[fit]', id, err)); }, 300);
    }
  });
  for (const [id, slot] of mountQueue) {
    const t = tiles.get(id);
    if (!t) continue;
    runtime.createInstance({ id, type: t.type, groupId: t.group, vSpec: t.vSpec, dataBinding });
    if (t.fitColumns) { const w = slot.clientWidth; if (w > 40) { fitted.set(id, w); fitLive(t, w).catch((e) => console.warn('[fit]', id, e)).finally(() => refit.observe(slot)); } else refit.observe(slot); }
    appState.declare(id, null);
    runtime.mount(slot, id).then((h) => h.ready).then((r) => { window.__astrato.mounted[id] = r?.status; appState.settle(id, r?.status, r); if (r?.status !== 'rendered') window.__astrato.errors[id] = r; }).catch((e) => { window.__astrato.mounted[id] = String(e); appState.settle(id, 'error', e); });
  }
  /** After governed writeback: drop the query cache and re-mount native objects so they re-query. */
  let refreshTimer;
  ctx.refreshNative = () => {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(async () => {
      clearQueryCache();
      for (const [id, slot] of mountQueue) {
        const t = tiles.get(id);
        if (!t || t.type === 'filter') continue;
        try { runtime.removeInstance?.(id); } catch { /* */ }
        runtime.createInstance({ id, type: t.type, groupId: t.group, vSpec: t.vSpec, dataBinding });
        appState.declare(id, null);
        runtime.mount(slot, id).then((h) => h.ready).then((r) => { window.__astrato.mounted[id] = r?.status; appState.settle(id, r?.status, r); }).catch((e) => { appState.settle(id, 'error', e); });
      }
    }, 600);
  };
  ctx.writeRaw = write;

  // The selection test: the Fund selector (the app's own path: one Fund selection per page group)
  // must move a KPI, and clearing it must bring the figure back. It only selects and clears.
  const kpiText = () => (document.querySelector('[data-slot="k-rev"]')?.innerText ?? '').replace(/\s+/g, ' ').trim();
  const quiet = async () => {
    let last = -1;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const log = queryLog();
      if (log.every((entry) => entry.ms !== null) && log.length === last) return;
      last = log.length;
    }
  };
  appState.check('Selecting one fund changes the Revenue (LTM) KPI; clearing restores it', async () => {
    go('portfolio');
    await quiet();
    const before = kpiText();
    const fund = M.funds[0]?.Fund;
    if (!fund) return { pass: false, detail: 'no funds loaded' };
    const q0 = queryLog().length;
    fundSel.value = fund; applyFund();
    await quiet();
    const during = kpiText();
    const sent = queryLog().slice(q0);
    fundSel.value = ''; applyFund();
    await quiet();
    const after = kpiText();
    return { pass: before !== '' && during !== '' && during !== before && after === before, detail: `"${before}" -> "${during}" -> "${after}"; ${sent.length} queries for the selection, ${sent.filter((entry) => entry.key.includes(JSON.stringify(fund))).length} carried the fund` };
  });
  // The export probe: the smoke test builds the portfolio documents without and with one fund picked
  // in the top-bar Fund selector (the same path as the check above) and fails any sheet that did not
  // narrow. The fund is one that leaves out at least one investment, IC package and initiative.
  const fundOf = (n) => M.companies.find((c) => c.Company === n)?.Fund;
  const probeFund = () => M.funds.map((f) => f.Fund).find((f) => [M.companies.map((c) => c.Company), records('IC Package').map((r) => r.company), M.inits.map((i) => i.Company)].every((names) => names.some((n) => fundOf(n) !== f))) ?? M.funds[0]?.Fund;
  appState.exportProbe({
    build: () => buildWorkbook(ctx, PORTFOLIO).blob,
    select: async () => { fundSel.value = probeFund() ?? ''; applyFund(); },
    clear: async () => { fundSel.value = ''; applyFund(); },
    // An IC sheet with no packages in the store has nothing to narrow.
    get exempt() { return records('IC Package').length ? [] : ['IC packages']; },
  });
  window.__boot = 'ready';
  if (localTableWrites().length) toast(`${localTableWrites().length} analytical changes are held in simulated persistence (this browser)`, 'cloud_off');
};

main().catch((error) => {
  console.error(error);
  appState.bootFailed(error);
  document.getElementById('root').textContent = `Could not start: ${error?.message ?? error}`;
});
