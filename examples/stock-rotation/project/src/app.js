/**
 * Corvo – Stock Rotation (illustrative synthetic data).
 *
 * An inventory options app, not an inventory management system: what came in, what went out, what
 * expires, what is on order, and the options for keeping rotation in place. The five stock
 * workflows are Data Actions on the semantic layer; the Workflows tab puts approvals around them.
 */
import { createAstratoApp } from '@astrato-io/app-runtime';
import { createVisualizationRuntime, registry } from '@astrato-io/visualizations';
import { createVisualizationAvailableFields } from '@astrato-io/visualizations/definitions';
import { throttleQueries, clearQueryCache, inflight } from './throttle.js';
import { buildTiles, compileTiles, ctlId, KPIS, PV, WV, SUV, BR, SP, POV } from './dashboard.js';
import { createFieldIndex } from './fields.js';
import { mountOps, workflowState, USERS } from './workflow.js';
import { themeVSpec, applyEach } from './theme.js';
import { workbookBlob } from './xlsx.js';
import { appState } from './app-state.js';

const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v; else if (k === 'text') node.textContent = v; else if (k === 'html') node.innerHTML = v; else if (k.startsWith('on')) node.addEventListener(k.slice(2), v); else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c != null) node.append(c);
  return node;
};
const gbp = (n) => (n == null || Number.isNaN(n) ? '–' : `${n < 0 ? '-' : ''}£${Math.abs(Math.round(n)).toLocaleString('en-GB')}`);
const num = (n) => Math.round(Number(n) || 0).toLocaleString('en-GB');
const N = (v) => Number(v) || 0;

const three = (g) => [ctlId(g, PV, 'Category'), ctlId(g, WV, 'Warehouse Name'), ctlId(g, PV, 'Product Name')];
const PAGES = [
  ['stock', 'Stock', 'What we hold, where, and when it expires.', three('g-stock'), ['s-oh', 's-var', 's-in', 's-out'], [['s-pos', 'full tall'], ['s-batch', 'full tall']]],
  ['in', 'Goods in', 'Count a delivery and book it in: this creates the batch, logs the receipt and closes the purchase order.', [], [], []],
  ['out', 'Goods out', 'Only the oldest eligible batch can ship. Stock under its product minimum shelf life is blocked.', [], [], []],
  ['transfer', 'Transfers', 'Rebalance stock between warehouses, most at-risk first.', [], [], []],
  ['count', 'Stock count', 'Count by batch. Small variances post straight away; large ones need approval.', [], [], []],
  ['trace', 'Trace & recall', 'Find where a batch came from, where it went, and stop what is left.', [], [], []],
  ['reorder', 'Reorder', 'Propose purchase orders. An Operations Manager approves them before they are raised.', [], [], []],
  ['expiry', 'Expiry', 'Quarantine, release or request a write-off. A Quality Lead approves write-offs.', [], [], []],
  ['ledger', 'Ledger', 'The movement record behind every stock figure.', three('g-led'), [], [['l-led', 'full tall']]],
  ['approvals', 'Approvals', 'Requests waiting for a second person, and everything that was done.', [], [], []],
  ['whatif', 'Plan', 'Test options for short-dated stock before acting on them.', [], [], []],
];
const GROUPS = ['g-stock', 'g-led'];
const PAGE_GROUP = { stock: 'g-stock', ledger: 'g-led' };
const main = async () => {
  window.__boot = 'start';
  const status = (t) => { const s = document.getElementById('splash-status'); if (s) s.textContent = t; };
  const app = await createAstratoApp();
  throttleQueries(app.client.hostServices);
  const { engine, selections } = app.client.hostServices;
  window.__sel = selections;
  for (const g of GROUPS) {
    let timer;
    selections.onActiveSelectionChange(g).subscribe((next) => { clearTimeout(timer); if (next.pending.length > 0) timer = setTimeout(() => selections.applyPendingSelections(g), 250); });
  }
  status('Reading the governed semantic layer…');
  const client = app.client;
  const metadata = await engine.fields.getFieldMetadata({ ...app.dataBinding });
  const runtime = createVisualizationRuntime({ client, registry });
  const availableFields = createVisualizationAvailableFields(metadata).filter((f) => f?.resultType !== 'unhandled');
  appState.fields(availableFields);
  const dataBinding = { ...app.dataBinding };
  const fields = createFieldIndex(availableFields);
  const built = buildTiles(fields);
  const compiled = await compileTiles(built.tiles, availableFields);
  const failures = [...built.failures, ...compiled.failures];
  if (failures.length) console.warn('[tiles]', JSON.stringify(failures));
  status('Styling governed objects…');
  const tiles = new Map();
  await Promise.all(compiled.compiled.map(async (t) => { const themed = await themeVSpec({ id: t.id, type: t.type, vSpec: t.vSpec, dataBinding }, availableFields, t); tiles.set(t.id, { ...t, vSpec: themed.vSpec }); }));
  window.__astrato = { tiles: [...tiles.keys()], failures, mounted: {} };

  /** Governed query. dims: [[field, view]]; filters: [[field, view, values]]. */
  const q = async ({ dims = [], measures = [], filters = [], limit = 500 }) => {
    const dimensions = dims.map(([name, view]) => ({ fieldKey: fields.raw(name, view).fieldKey, name }));
    const calculations = measures.map((name) => ({ calculation: '{m1}', itemKey: fields.measure(name).fieldKey, label: name }));
    const query = { dimensions, calculations, orders: [], limit, offset: 0, filters: filters.map(([f, v, values]) => ({ field: { fieldKey: fields.raw(f, v).fieldKey }, operator: 'inList', values: values.map(String) })), totals: false, showRecordsCount: false, outerViews: [], associativeListFilter: null };
    const { response } = await engine.getData({ ...dataBinding, query });
    const names = [...dimensions.map((d) => d.name), ...measures];
    return Object.values(response?.data ?? {}).map((row) => Object.fromEntries(names.map((n, i) => [n, row[i]])));
  };
  window.__q = q;

  // ------------------------------------------------------------------ shell
  const root = document.getElementById('root');
  const tabs = el('nav', { class: 'ob-tabs' });
  const body = el('div', { class: 'ob-body' });
  const exportBtn = el('button', { class: 'kx-export', text: '⬇ Excel report', title: 'Export the formatted stock rotation report to Excel' });
  const selBar = el('div', { class: 'sb-selbar' });
  const roleSel = el('select', { 'aria-label': 'Acting as' }, USERS.map((u) => el('option', { value: u, text: u })));
  root.replaceChildren(el('header', { class: 'ob-head sr-head' }, [
    el('div', { class: 'sr-mark' }, [el('img', { src: './corvo-logo.svg', alt: 'CORVO' })]),
    el('div', { class: 'wf-titles' }, [el('h1', { text: 'Stock Rotation' }), el('p', { text: 'Illustrative synthetic data' })]),
    el('label', { class: 'sr-role' }, [el('span', { text: 'Acting as' }), roleSel]),
    exportBtn,
  ]), tabs, selBar, body);

  const mountQueue = [];
  let building = null; // the pane being built, for appState.declare
  const slotFor = (id) => { const s = el('div', { class: 'ob-viz', 'data-slot': id }); mountQueue.push([id, s, building]); return s; };
  const card = (id, cls) => { const t = tiles.get(id); return el('figure', { class: `ob-card ${cls}` }, [el('figcaption', { text: t?.title ?? id }), t ? slotFor(id) : el('p', { class: 'wf-note', text: `Not available: ${failures.find((f) => f.id === id)?.reason ?? id}` })]); };
  const kpi = (id) => el('figure', { class: 'ob-card ob-kpi kx-kpi' }, [
    el('figcaption', {}, [document.createTextNode(KPIS[id]?.label ?? id), el('small', { text: KPIS[id]?.source ?? '' })]),
    el('div', { class: 'kx-kpi-row' }, [el('div', { class: 'kx-kpi-num' }, tiles.has(id) ? slotFor(id) : null), el('div', { class: 'kx-kpi-spark' }, tiles.has(`${id}-sp`) ? slotFor(`${id}-sp`) : null)]),
    el('div', { class: 'kx-kpi-delta' }, tiles.has(`${id}-d`) ? slotFor(`${id}-d`) : null),
  ]);
  const panes = {};
  for (const [key, label, intro, controls, kpis, charts] of PAGES) {
    building = key;
    const pane = el('section', { class: 'ob-pane', 'data-page': key });
    const grid = el('div', { class: 'ob-grid' }, charts.map(([c, cls]) => card(c, cls)));
    pane.append(el('p', { class: 'ob-intro', text: intro }), ...(controls.length ? [el('div', { class: 'ob-filters' }, controls.map((c) => card(c, 'ob-filter')))] : []), ...(kpis.length ? [el('div', { class: 'ob-kpis kx-kpis' }, kpis.map(kpi))] : []), grid);
    panes[key] = { pane, grid };
    body.append(pane);
    tabs.append(el('button', { 'data-page': key, text: label, title: intro, onclick: () => show(key) }));
  }

  // ---- selection bar
  let current = 'stock';
  const labelOf = (fk) => String(fk).match(/\[([^\]]+)\]$/)?.[1] ?? fk;
  const renderSelBar = () => {
    const g = PAGE_GROUP[current];
    if (!g) { selBar.replaceChildren(el('b', { text: 'Selections' }), el('span', { class: 'sb-none', text: 'This screen works on individual records.' })); return; }
    const { applied = [], pending = [] } = selections.getSelection(g) ?? {};
    const list = [...applied, ...pending].filter((x) => x.values?.length);
    selBar.replaceChildren(el('b', { text: 'Selections' }),
      ...(list.length ? list.map((x) => el('span', { class: 'sb-chip' }, [el('i', { text: labelOf(x.field?.fieldKey ?? x.fieldKey) }), document.createTextNode(x.values.map((v) => (v && typeof v === 'object' ? v.value ?? v.text : v)).slice(0, 4).join(', ')), el('button', { text: '×', title: 'Remove this selection', onclick: () => selections.removeSelection(g, x) })])) : [el('span', { class: 'sb-none', text: 'None. Click any bar or row, or use the filters.' })]),
      ...(list.length ? [el('button', { class: 'sb-clear', text: 'Clear all', onclick: () => selections.clearAllSelections(g) })] : []));
  };
  for (const g of GROUPS) selections.onActiveSelectionChange(g).subscribe(() => { if (PAGE_GROUP[current] === g) renderSelBar(); });
  const show = (key) => {
    for (const [k, p] of Object.entries(panes)) p.pane.hidden = k !== key;
    for (const b of tabs.children) b.classList.toggle('on', b.dataset.page === key);
    current = key; renderSelBar();
  };
  const slotWidth = new Map(mountQueue.map(([id, s]) => [id, s.clientWidth]));
  show('stock');
  document.getElementById('splash')?.remove();

  const fit = async (t, width) => {
    if (!t.fitColumns || !width || width < 40) return t.vSpec;
    const requests = [{ name: 'setTableAllColumnsResponsiveWidth', payload: false }];
    for (const [ref, share] of Object.entries(t.fitColumns)) { const item = t.resolvedRefs?.[ref]; if (item) requests.push({ name: 'setColumnWidth', payload: { dataItemInternalKey: item.dataItemInternalKey, dataItemUniqueSignature: item.dataItemUniqueSignature, width: `${Math.floor((width - 4) * share)}px` } }); }
    return (await applyEach({ id: t.id, type: t.type, vSpec: t.vSpec, dataBinding }, availableFields, t.type, requests)).vSpec;
  };
  // Column widths are pixels, so a table refits when its slot changes width (window resize, or a pane
  // first shown): the same instance gets the new widths, it is never remounted.
  const fittedAt = new Map(mountQueue.map(([id, s]) => [id, slotWidth.get(id) || 220]));
  const sizeWatch = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const id = entry.target.dataset.slot, t = tiles.get(id), width = Math.round(entry.contentRect.width);
      if (!t?.fitColumns || width < 40 || Math.abs(width - (fittedAt.get(id) ?? 0)) <= 2) continue;
      clearTimeout(entry.target.refit);
      entry.target.refit = setTimeout(() => {
        fittedAt.set(id, width);
        fit({ ...t, vSpec: t.baseVSpec ?? t.vSpec }, width).then((vSpec) => { t.vSpec = vSpec; runtime.updateInstance(id, { vSpec }); }).catch((e) => console.warn('[fit]', id, e));
      }, 400);
    }
  });
  for (const [id, slot, page] of mountQueue) {
    const t = tiles.get(id);
    if (!t) continue;
    appState.declare(id, page);
    runtime.createInstance({ id, type: t.type, groupId: t.group, vSpec: t.vSpec, dataBinding });
    t.baseVSpec = t.vSpec;
    if (t.fitColumns) fit(t, slotWidth.get(id) || 220).then((vSpec) => { t.vSpec = vSpec; runtime.updateInstance(id, { vSpec }); }).catch((e) => console.warn('[fit]', id, e));
    if (t.fitColumns) sizeWatch.observe(slot);
    runtime.mount(slot, id).then((h) => h.ready)
      .then((r) => { window.__astrato.mounted[id] = r?.status; appState.settle(id, r?.status, r); })
      .catch((e) => { window.__astrato.mounted[id] = String(e); appState.settle(id, 'error', e); });
  }

  // KPI numbers and one-row comparison tables follow group selections on visualizations 0.9 (tested:
  // a Warehouse selection moved every KPI and comparison row), so the static-filter mirror is gone.

  // ------------------------------------------------------------------ options (what-if)
  let base = null;
  const baseReady = Promise.all([
    q({ dims: [['Category', PV]], measures: ['Units At Risk', 'Value At Risk', 'Shipped 30d', 'Revenue 30d', 'Daily Run Rate'] }),
    q({ dims: [['PRODUCT_NAME', SP], ['WAREHOUSE_ID', SP], ['REORDER_COVER_DAYS', SP]], measures: ['Units Available', 'Units Inbound', 'Daily Run Rate'] }),
  ]).then(([cats, lines]) => { base = { cats, lines }; window.__base = base; });
  const S = { promoLift: 40, promoDays: 21, discount: 25, transfer: 20, demand: 0, slip: 0 };
  const LEVERS = [['promoLift', 'Promotion lift on short-dated stock', 0, 150, 5, '%'], ['promoDays', 'Promotion length', 0, 30, 1, ' days'], ['discount', 'Promotion discount', 0, 60, 5, '%'], ['transfer', 'At-risk stock transferred to the other warehouse', 0, 60, 5, '%'], ['demand', 'Demand change, next 30 days', -30, 50, 5, '%'], ['slip', 'Supplier lead time slip', 0, 30, 1, ' days']];
  /** Short-dated Snacks carries all the risk; lines test cover under the demand and supplier levers. */
  const evaluate = (s) => {
    if (!base) return null;
    const risk = base.cats.filter((c) => N(c['Units At Risk']) > 0);
    const units = risk.reduce((a, c) => a + N(c['Units At Risk']), 0), value = risk.reduce((a, c) => a + N(c['Value At Risk']), 0);
    const rate = risk.reduce((a, c) => a + N(c['Daily Run Rate']), 0), shipped = risk.reduce((a, c) => a + N(c['Shipped 30d']), 0), rev = risk.reduce((a, c) => a + N(c['Revenue 30d']), 0);
    const cost = units ? value / units : 0, price = shipped ? rev / shipped : 0;
    const transferred = Math.min(units, units * s.transfer / 100);
    const promoted = Math.min(units - transferred, rate * (s.promoLift / 100) * s.promoDays);
    const saved = transferred + promoted, left = units - saved;
    const recovered = promoted * price * (1 - s.discount / 100) + transferred * price;
    const stockouts = base.lines.filter((l) => { const r = N(l['Daily Run Rate']) * (1 + s.demand / 100); return r > 0 && N(l['Units Available']) / r < 7 + s.slip; });
    const reorder = base.lines.reduce((a, l) => { const r = N(l['Daily Run Rate']) * (1 + s.demand / 100); return a + Math.max(0, Math.ceil(r * (N(l.REORDER_COVER_DAYS) + 30 + s.slip) - N(l['Units Available']) - N(l['Units Inbound']))); }, 0);
    return { units, value, cost, price, transferred, promoted, saved, left, avoided: saved * cost, remaining: left * cost, recovered, discountCost: promoted * price * s.discount / 100, stockouts, reorder };
  };
  const wiHost = panes.whatif.grid;
  const out = el('div', { class: 'sk-wi-out' });
  const leverEls = LEVERS.map(([k, label, min, max, step, unit]) => {
    const o = el('b');
    const input = el('input', { type: 'range', min, max, step, value: S[k], 'data-k': k });
    const sh = () => { o.textContent = `${S[k]}${unit}`; };
    input.addEventListener('input', () => { S[k] = Number(input.value); sh(); renderWI(); });
    sh();
    return el('label', {}, [el('span', { text: label }), input, o]);
  });
  wiHost.append(el('figure', { class: 'ob-card half' }, [el('figcaption', { text: 'Levers' }), el('div', { class: 'kx-wi-levers' }, leverEls)]), el('figure', { class: 'ob-card half' }, [el('figcaption', { text: 'Outcome against doing nothing' }), out]));
  const renderWI = () => {
    const r = evaluate(S);
    if (!r) { out.innerHTML = '<p class="wf-note">Loading the governed baseline…</p>'; return; }
    const b = evaluate({ ...S, promoLift: 0, transfer: 0, demand: 0, slip: 0 });
    out.innerHTML = `<div class="kx-wi-kpis">
        <div><span>Write-off avoided</span><b>${gbp(r.avoided)}</b><i>${num(r.saved)} of ${num(r.units)} units saved</i></div>
        <div><span>Revenue recovered</span><b>${gbp(r.recovered)}</b><i>after ${gbp(r.discountCost)} of discount</i></div>
        <div><span>Still at risk</span><b>${gbp(r.remaining)}</b><i>${num(r.left)} units</i></div></div>
      <table class="wf-t"><tr><th></th><th class="r">Do nothing</th><th class="r">Scenario</th></tr>
        <tr><td>Value expiring unsold</td><td class="r">${gbp(b.value)}</td><td class="r">${gbp(r.remaining)}</td></tr>
        <tr><td>Units promoted</td><td class="r">0</td><td class="r">${num(r.promoted)}</td></tr>
        <tr><td>Units transferred</td><td class="r">0</td><td class="r">${num(r.transferred)}</td></tr>
        <tr><td>Lines under 7 days' cover (plus slip)</td><td class="r">${b.stockouts.length}</td><td class="r">${r.stockouts.length}</td></tr>
        <tr><td>Units to order to restore cover</td><td class="r">${num(b.reorder)}</td><td class="r">${num(r.reorder)}</td></tr></table>
      <p class="wf-note">Baseline from governed measures: units and value at risk, 28-day run rate, and 30-day revenue per unit shipped (${gbp(r.price)}). Transfers assume the other warehouse can sell the stock before it expires, with no freight cost. Promotion sales are run rate × lift × days.</p>`;
  };
  renderWI();
  baseReady.then(renderWI).catch((e) => { out.textContent = `Baseline query failed: ${e?.message ?? e}`; });

  // ------------------------------------------------------------------ operations
  const write = async (req) => {
    if (typeof app.writeback !== 'function') throw new Error('writeback is not available in this runtime');
    // The layer this app is bound to (astrato.json); writes go to its views.
    const r = await app.writeback({ dataviewID: app.dataBinding.semanticLayerId, ...req });
    clearQueryCache();
    if (!r?.response?.rowsAffected) throw new Error('no rows changed');
    return r;
  };
  const loadQueues = async () => {
    const [rawBatches, reorder, pos, cost, sup, detail] = await Promise.all([
      q({ dims: [['BATCH_ID', BR], ['SKU', BR], ['PRODUCT_NAME', BR], ['WAREHOUSE_ID', BR], ['STATUS', BR], ['EXPIRY_DATE', BR], ['DAYS_TO_EXPIRY', BR]], measures: ['Units On Hand', 'Units At Risk', 'Value At Risk'] }),
      q({ dims: [['SKU', SP], ['PRODUCT_NAME', SP], ['WAREHOUSE_ID', SP], ['STOCK_STATUS', SP], ['DAYS_OF_COVER', SP], ['SUPPLIER_ID', SP]], measures: ['Suggested Order Units'] }),
      q({ dims: [['Po ID', POV], ['Sku', POV], ['Supplier ID', POV], ['Warehouse ID', POV], ['Status', POV], ['Expected Date', POV], ['Qty Ordered', POV]], filters: [['Status', POV, ['Open', 'Delayed']]] }),
      q({ dims: [['Sku', PV], ['Unit Cost Gbp', PV], ['Min Remaining Shelf Days', PV]] }),
      q({ dims: [['Supplier ID', SUV], ['Lead Time Days', SUV]] }),
      q({ dims: [['Batch ID', 'Corvo Inv Batches'], ['Supplier ID', 'Corvo Inv Batches'], ['Received Date', 'Corvo Inv Batches'], ['Unit Cost Gbp', 'Corvo Inv Batches']], limit: 1000 }),
    ]);
    const minShelf = new Map(cost.map((c) => [c.Sku, c['Min Remaining Shelf Days']])), bd = new Map(detail.map((d) => [d['Batch ID'], d]));
    const batches = rawBatches.map((b) => ({ ...b, minShelf: minShelf.get(b.SKU), supplier: bd.get(b.BATCH_ID)?.['Supplier ID'], received: bd.get(b.BATCH_ID)?.['Received Date'], cost: bd.get(b.BATCH_ID)?.['Unit Cost Gbp'] }));
    const unit = new Map(cost.map((c) => [c.Sku, c['Unit Cost Gbp']])), lead = new Map(sup.map((s) => [s['Supplier ID'], s['Lead Time Days']]));
    return { batches, reorder: reorder.map((r) => ({ ...r, lead: lead.get(r.SUPPLIER_ID) })), pos: pos.map((p) => ({ ...p, 'Unit Cost Gbp': unit.get(p.Sku) })) };
  };
  const reQuery = () => { for (const i of runtime.listInstances()) runtime.updateInstance(i.id, { vSpec: { ...i.vSpec } }); };
  const approvalsTab = [...tabs.children].find((b) => b.dataset.page === 'approvals');
  const MVW = 'Corvo Inv Movements';
  const traceOf = async (root, Q) => {
    const ids = [...new Set([root, ...Q.batches.map((b) => b.BATCH_ID).filter((id) => id.startsWith(`${root}-T`))])];
    const [rows, names] = await Promise.all([
      q({ dims: [['Movement Date', MVW], ['Movement Type', MVW], ['Batch ID', MVW], ['Warehouse ID', MVW], ['Reference', MVW]], measures: ['Net Movement'], filters: [['Batch ID', MVW, ids]], limit: 1000 }),
      q({ dims: [['Batch ID', 'Corvo Inv Batches'], ['Supplier Name', SUV], ['Product Name', PV]], filters: [['Batch ID', 'Corvo Inv Batches', [root]]] }),
    ]);
    rows.sort((a, c) => c['Movement Date'] - a['Movement Date']);
    const sum = (t) => rows.filter((r) => t.test(r['Movement Type'])).reduce((a, r) => a + N(r['Net Movement']), 0);
    const live = Q.batches.filter((b) => ids.includes(b.BATCH_ID));
    return { id: root, rows, supplier: names[0]?.['Supplier Name'] ?? '–', product: names[0]?.['Product Name'] ?? '', in: sum(/Receipt/), out: -sum(/Shipment/), refs: new Set(rows.filter((r) => /Shipment/.test(r['Movement Type'])).map((r) => r.Reference)).size, held: live.reduce((a, b) => a + N(b['Units On Hand']), 0), sites: [...new Set(live.map((b) => b.WAREHOUSE_ID))].join(', ') || 'none' };
  };
  const ops = mountOps({ transfer: panes.transfer.grid, count: panes.count.grid, trace: panes.trace.grid, in: panes.in.grid, out: panes.out.grid, reorder: panes.reorder.grid, expiry: panes.expiry.grid, approvals: panes.approvals.grid }, { write, loadQueues, traceOf, onWritten: reQuery, onUser: (n) => { approvalsTab.textContent = n ? `Approvals (${n})` : 'Approvals'; } });
  window.__wf = ops;
  roleSel.value = ops.user();
  roleSel.onchange = () => ops.setUser(roleSel.value);

  // ------------------------------------------------------------------ Excel export
  exportBtn.addEventListener('click', async () => {
    exportBtn.disabled = true; exportBtn.textContent = 'Building report…';
    try {
      const K = ['Units On Hand', 'Stock Value', 'Value At Risk', 'Units Inbound', 'Delayed PO Units', 'Suggested Order Units', 'Received 30d', 'Received Prior 30d', 'Shipped 30d', 'Shipped Prior 30d', 'Written Off 30d', 'Written Off Prior 30d', 'Revenue 30d', 'Revenue Prior 30d'];
      const [[t], prods] = await Promise.all([q({ measures: K, limit: 1 }), q({ dims: [['Category', PV], ['Product Name', PV]], measures: ['Stock Value', 'Value At Risk', 'Units Available', 'Days Of Cover', 'Shipped 30d', 'Received 30d', 'Units Inbound', 'Suggested Order Units'] })]);
      const Q = ops.queues();
      const when = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
      const banner = (title, cols) => [[{ v: 'CORVO', s: 'brand' }, { v: title, s: 'title' }, ...Array(cols - 2).fill({ v: '', s: 'title' })], [null, { v: `Stock Rotation · generated ${when} · illustrative synthetic data`, s: 'subtitle' }], []];
      const head = (labels) => labels.map((v, i) => ({ v, s: i ? 'head' : 'headl' }));
      const flow = (l, a, b, f) => [null, { v: l, s: 'bold' }, { v: N(t[a]), s: f }, { v: N(t[b]), s: f }, { v: N(t[b]) ? N(t[a]) / N(t[b]) - 1 : 0, s: 'spct' }];
      const snap = (l, a, f) => [null, { v: l, s: 'bold' }, { v: N(t[a]), s: f }];
      const summary = { name: 'Summary', cols: [4, 32, 16, 16, 14], freeze: { row: 4, col: 0 }, merges: [], rows: [...banner('Rotation summary', 5), head(['', 'Measure', 'Last 30 days', 'Prior 30 days', 'Change']), flow('Units received', 'Received 30d', 'Received Prior 30d', 'int'), flow('Units shipped', 'Shipped 30d', 'Shipped Prior 30d', 'int'), flow('Units written off', 'Written Off 30d', 'Written Off Prior 30d', 'int'), flow('Revenue', 'Revenue 30d', 'Revenue Prior 30d', 'gbp'), [], head(['', 'Position today', 'Value', '', '']), snap('Units on hand', 'Units On Hand', 'int'), snap('Stock value', 'Stock Value', 'gbp'), snap('Value at risk', 'Value At Risk', 'gbp'), snap('Inbound units', 'Units Inbound', 'int'), snap('Delayed PO units', 'Delayed PO Units', 'int'), snap('Suggested order units', 'Suggested Order Units', 'int')] };
      const prodSheet = { name: 'Products', cols: [14, 30, 12, 12, 12, 10, 12, 12, 10, 12], freeze: { row: 4, col: 2 }, merges: [], rows: [...banner('Rotation by product', 10), head(['Category', 'Product', 'Stock value', 'At risk', 'Available', 'Cover', 'Shipped 30d', 'Received 30d', 'Inbound', 'To order']), ...prods.sort((a, b) => N(b['Value At Risk']) - N(a['Value At Risk'])).map((r) => [{ v: r.Category, s: 'text' }, { v: r['Product Name'], s: 'bold' }, { v: N(r['Stock Value']), s: 'gbp' }, { v: N(r['Value At Risk']), s: 'gbp' }, { v: N(r['Units Available']), s: 'int' }, { v: N(r['Days Of Cover']), s: 'dec' }, { v: N(r['Shipped 30d']), s: 'int' }, { v: N(r['Received 30d']), s: 'int' }, { v: N(r['Units Inbound']), s: 'int' }, { v: N(r['Suggested Order Units']), s: 'int' }])] };
      const batchSheet = { name: 'Expiry', cols: [18, 30, 10, 12, 12, 10, 10, 12], freeze: { row: 4, col: 1 }, merges: [], rows: [...banner('Batches by expiry', 8), head(['Batch', 'Product', 'WH', 'Status', 'Expiry', 'On hand', 'At risk', 'Value at risk']), ...[...Q.batches].sort((a, b) => a.EXPIRY_DATE - b.EXPIRY_DATE).map((b) => [{ v: b.BATCH_ID, s: 'bold' }, { v: b.PRODUCT_NAME, s: 'text' }, { v: b.WAREHOUSE_ID, s: 'text' }, { v: b.STATUS, s: 'text' }, { v: new Date(Number(b.EXPIRY_DATE)).toISOString().slice(0, 10), s: 'text' }, { v: N(b['Units On Hand']), s: 'int' }, { v: N(b['Units At Risk']), s: 'int' }, { v: N(b['Value At Risk']), s: 'gbp' }])] };
      const r = evaluate(S);
      const wiSheet = { name: 'Options', cols: [46, 16], merges: [], rows: [...banner('Options scenario', 2), head(['Lever', 'Setting']), ...LEVERS.map(([k, label, , , , unit]) => [{ v: label, s: 'bold' }, { v: `${S[k]}${unit}`, s: 'text' }]), [], head(['Outcome', 'Value']), ...(r ? [['Write-off avoided', r.avoided, 'gbp'], ['Revenue recovered', r.recovered, 'gbp'], ['Still at risk', r.remaining, 'gbp'], ['Units to order', r.reorder, 'int']].map(([a, v, f]) => [{ v: a, s: 'bold' }, { v, s: f }]) : [])] };
      const W = workflowState();
      const wfSheet = { name: 'Workflows', cols: [18, 22, 60, 12], merges: [], rows: [...banner('Requests and audit trail', 4), head(['Request', 'Workflow', 'What', 'Status']), ...W.requests.map((x) => [{ v: x.id, s: 'bold' }, { v: x.action, s: 'text' }, { v: x.label, s: 'text' }, { v: x.status, s: 'text' }]), [], head(['When', 'Who', 'What', 'Run']), ...W.audit.map((a) => [{ v: a.at, s: 'text' }, { v: a.who, s: 'text' }, { v: a.what, s: 'text' }, { v: a.how, s: 'text' }])] };
      const blob = workbookBlob({ sheets: [summary, prodSheet, batchSheet, wiSheet, wfSheet], title: 'Corvo – Stock Rotation', author: 'Astrato' });
      window.__lastExport = blob.size;
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `Corvo_Stock_Rotation_${new Date().toISOString().slice(0, 10)}.xlsx` });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (e) { console.error(e); alert(`Export failed: ${e?.message ?? e}`); } finally { exportBtn.disabled = false; exportBtn.textContent = '⬇ Excel report'; }
  });
  window.__show = show;

  // ------------------------------------------------------------------ smoke-test contract
  for (const [key] of PAGES) appState.tab(key, () => show(key));
  appState.mark('landing-ready');
  /** Queries answered and tables repainted: nothing in flight, then the kit's quiet period. */
  const settled = async () => {
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 200 && inflight() > 0; j++) await new Promise((r) => setTimeout(r, 100));
      await appState.quiet({ quietMs: 1200, paintMs: 1500 });
      if (inflight() === 0) return;
    }
  };
  const textOf = (id) => (document.querySelector(`[data-slot="${id}"]`)?.innerText ?? '').replace(/\s+/g, ' ').trim();
  const firstValue = async (name, view) => (await q({ dims: [[name, view]], measures: ['Units On Hand'] })).map((r) => r[name]).filter((v) => v != null).sort()[0];
  /** Select through the app's real path: a pending selection in the tab's group, which the app applies. */
  const pick = (group, name, view, value) => selections.selectValues(group, { field: { fieldKey: fields.raw(name, view).fieldKey }, operator: 'inList', values: [value] }, { state: 'pending' });
  const selectionCheck = (page, group, name, view, kpiIds, tableIds) => async () => {
    show(page);
    await settled();
    const value = await firstValue(name, view);
    const read = () => Object.fromEntries([...kpiIds, ...tableIds].map((id) => [id, textOf(id)]));
    const before = read();
    pick(group, name, view, value);
    await settled();
    const during = read();
    selections.clearAllSelections(group);
    await settled();
    const after = read();
    const moved = (id) => during[id] !== before[id];
    const back = (id) => after[id] === before[id];
    const kpiOk = kpiIds.length === 0 || kpiIds.some((id) => moved(id) && back(id));
    const tableOk = tableIds.some((id) => moved(id) && back(id));
    const detail = [...kpiIds, ...tableIds].map((id) => `${id}: ${moved(id) ? 'moved' : 'same'}${back(id) ? '/restored' : '/NOT restored'}`).join('; ');
    return { pass: Boolean(value) && kpiOk && tableOk && [...kpiIds, ...tableIds].every((id) => before[id] !== ''), detail: `${name} = ${value} → ${detail}` };
  };
  appState.check('Stock: a Warehouse selection moves the KPIs and both tables; clearing restores them',
    selectionCheck('stock', 'g-stock', 'Warehouse Name', WV, ['s-oh', 's-oh-d', 's-in', 's-out'], ['s-pos', 's-batch']));
  appState.check('Stock: a Category selection moves the KPIs and tables; clearing restores them',
    selectionCheck('stock', 'g-stock', 'Category', PV, ['s-oh', 's-var'], ['s-pos', 's-batch']));
  appState.check('Ledger: a Warehouse selection narrows the movement ledger; clearing restores it',
    selectionCheck('ledger', 'g-led', 'Warehouse Name', WV, [], ['l-led']));
  // Workflow screens are read here only: no button is clicked, so nothing is written.
  appState.check('Workflow queues load on Goods in, Goods out, Reorder and Expiry (read only)', async () => {
    for (let i = 0; i < 60 && !ops.queues().batches.length; i++) await new Promise((r) => setTimeout(r, 500));
    const rows = Object.fromEntries(['in', 'out', 'reorder', 'expiry'].map((k) => [k, panes[k].grid.querySelectorAll('table.wf-t tr').length - 1]));
    show('out');
    return { pass: Object.values(rows).every((n) => n > 0), detail: JSON.stringify(rows) };
  });
  appState.check('Plan: moving the promotion lift lever changes the outcome against doing nothing', async () => {
    show('whatif');
    await baseReady;
    const input = wiHost.querySelector('input[data-k="promoLift"]');
    const before = out.innerText;
    const was = input.value;
    input.value = String(Math.min(150, Number(was) + 40)); input.dispatchEvent(new Event('input'));
    const during = out.innerText;
    input.value = was; input.dispatchEvent(new Event('input'));
    const after = out.innerText;
    return { pass: during !== before && after === before, detail: `lift ${was}% → ${input.max === '150' ? Number(was) + 40 : '?'}% → ${was}%` };
  });
  appState.check('Excel report downloads', async () => {
    window.__lastExport = 0;
    exportBtn.click();
    for (let i = 0; i < 60 && !window.__lastExport; i++) await new Promise((r) => setTimeout(r, 500));
    show('stock');
    return { pass: window.__lastExport > 0, detail: `${window.__lastExport} bytes` };
  });
};

main().catch((error) => { console.error(error); appState.bootFailed(error); document.getElementById('root').textContent = `Could not start: ${error?.message ?? error}`; });
