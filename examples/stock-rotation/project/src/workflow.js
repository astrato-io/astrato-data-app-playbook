/**
 * The operational screens of Corvo Stock Rotation. Each step mirrors one Data Action registered on
 * the semantic layer (same tables, same guards) and writes through app.writeback, because the App
 * runtime cannot call a named Data Action yet. Write-offs and purchase orders need a second person.
 */
const KEY = 'corvo-ops-v1';
export const USERS = ['Planner', 'Operations Manager', 'Quality Lead', 'Warehouse Operator'];
const APPROVER = { 'Raise Purchase Order': 'Operations Manager', 'Write Off Batch': 'Quality Lead', 'Post Stock Count': 'Operations Manager' };
const seed = () => ({ user: USERS[0], requests: [], audit: [] });
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? seed(); } catch { return seed(); } };
let S = load();
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private window */ } };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const gbp = (n) => `£${Math.round(Number(n) || 0).toLocaleString('en-GB')}`;
const num = (n) => Math.round(Number(n) || 0).toLocaleString('en-GB');
const now = () => new Date().toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
const day = (ms) => (ms ? new Date(Number(ms)).toISOString().slice(0, 10) : '–');
const pill = (s) => `<span class="wf-pill wf-${String(s).toLowerCase().replace(/[^a-z]+/g, '-')}">${esc(s)}</span>`;
const id8 = () => Math.random().toString(16).slice(2, 10).toUpperCase();
const today = () => `${new Date().toISOString().slice(0, 10)}T00:00:00Z`;

export const workflowState = () => S;

export const mountOps = (hosts, { write, loadQueues, onWritten, onUser, traceOf }) => {
  let Q = { batches: [], reorder: [], pos: [] };
  const B = 'Corvo Inv Batches', M = 'Corvo Inv Movements', P = 'Corvo Inv Purchase Orders';
  const F = (n, t = 'string') => ({ name: n, valueType: t });
  const update = (view, key, id, cols) => write({ view, operation: 'update', fields: cols.map(([n, , t]) => F(n, t)), values: [cols.map(([, v]) => v)], keys: { fields: [F(key)], values: [[id]] } });
  const movement = (b, type, qty, reference) => write({ view: M, operation: 'insert',
    fields: [F('Movement ID'), F('Movement Date', 'date'), F('Batch ID'), F('Sku'), F('Warehouse ID'), F('Movement Type'), F('Qty', 'number'), F('Reference'), F('Created By')],
    values: [[`MV-${id8()}`, today(), b.id, b.sku, b.wh, type, qty, reference, S.user]] });
  const batchOf = (id) => { const x = Q.batches.find((y) => y.BATCH_ID === id); return { id, sku: x.SKU, wh: x.WAREHOUSE_ID, on: Number(x['Units On Hand']), status: x.STATUS, name: x.PRODUCT_NAME, expiry: x.EXPIRY_DATE, received: x.received, supplier: x.supplier, cost: x.cost, days: Number(x.DAYS_TO_EXPIRY), min: Number(x.minShelf) || 0 }; };
  const iso = (ms) => `${new Date(Number(ms)).toISOString().slice(0, 10)}T00:00:00Z`;
  /** Why a batch may not ship: quarantine, too short-dated for the product's minimum, or an older eligible batch exists. */
  const blockOf = (x) => {
    if (x.STATUS !== 'Available') return `${x.STATUS}`;
    if (Number(x.DAYS_TO_EXPIRY) < Number(x.minShelf || 0)) return `Below ${x.minShelf}-day minimum shelf life`;
    const first = Q.batches.filter((y) => y.SKU === x.SKU && y.WAREHOUSE_ID === x.WAREHOUSE_ID && y.STATUS === 'Available' && Number(y.DAYS_TO_EXPIRY) >= Number(y.minShelf || 0)).sort((a, c) => a.EXPIRY_DATE - c.EXPIRY_DATE)[0];
    return first && first.BATCH_ID !== x.BATCH_ID ? `Pick ${first.BATCH_ID} first` : null;
  };
  const rootOf = (id) => id.split('-T')[0];
  const scan = { out: '', count: '' };
  const hit = (b, s) => !s || `${b.BATCH_ID} ${b.SKU} ${b.PRODUCT_NAME}`.toLowerCase().includes(s.toLowerCase());
  const scanBox = (k) => `<label class="sr-scan">Scan or type a batch, SKU or product <input data-scan="${k}" value="${esc(scan[k])}" placeholder="Scan barcode…"></label>`;
  let traced = null;

  /** The five workflows. Guards match the Data Action SQL; a failed step leaves the screen unchanged and reports it. */
  const ACTIONS = {
    'Set Batch Status': async ({ batch_id, new_status }) => update(B, 'Batch ID', batch_id, [['Status', new_status]]),
    'Record Dispatch': async ({ batch_id, qty, reference }) => {
      const b = batchOf(batch_id);
      const blocked = blockOf(Q.batches.find((y) => y.BATCH_ID === batch_id));
      if (blocked) throw new Error(blocked);
      if (qty < 1 || qty > b.on) throw new Error(`${b.on} on hand`);
      await movement(b, 'Customer Shipment', -qty, reference);
      await update(B, 'Batch ID', batch_id, [['Qty On Hand', b.on - qty, 'number']]);
    },
    'Transfer Stock': async ({ batch_id, qty }) => {
      const b = batchOf(batch_id);
      if (b.status !== 'Available' || qty < 1 || qty > b.on) throw new Error(`${batch_id} is ${b.status} with ${b.on} on hand`);
      const to = b.wh === 'WH-UK' ? 'WH-US' : 'WH-UK', id = `${rootOf(batch_id)}-T${id8().slice(0, 4)}`;
      await write({ view: B, operation: 'insert', fields: [F('Batch ID'), F('Sku'), F('Warehouse ID'), F('Supplier ID'), F('Received Date', 'date'), F('Expiry Date', 'date'), F('Qty Received', 'number'), F('Qty On Hand', 'number'), F('Unit Cost Gbp', 'number'), F('Status')],
        values: [[id, b.sku, to, b.supplier, iso(b.received), iso(b.expiry), qty, qty, Number(b.cost), 'Available']] });
      await movement(b, 'Transfer Out', -qty, id);
      await movement({ id, sku: b.sku, wh: to }, 'Transfer In', qty, batch_id);
      await update(B, 'Batch ID', batch_id, [['Qty On Hand', b.on - qty, 'number']]);
    },
    'Post Stock Count': async ({ batch_id, counted }) => {
      const b = batchOf(batch_id);
      await movement(b, 'Count Adjustment', counted - b.on, 'Stock count');
      await update(B, 'Batch ID', batch_id, [['Qty On Hand', counted, 'number']]);
    },
    'Recall Batch': async ({ batch_id }) => {
      for (const x of Q.batches.filter((y) => rootOf(y.BATCH_ID) === rootOf(batch_id) && y.STATUS === 'Available')) await update(B, 'Batch ID', x.BATCH_ID, [['Status', 'Quarantine']]);
    },
    'Write Off Batch': async ({ batch_id, reason }) => {
      const b = batchOf(batch_id);
      await movement(b, 'Manual Write-off', -b.on, reason);
      await update(B, 'Batch ID', batch_id, [['Qty On Hand', 0, 'number'], ['Status', 'Written Off']]);
    },
    'Raise Purchase Order': async ({ sku, supplier, warehouse_id, qty, lead }) => write({ view: P, operation: 'insert',
      fields: [F('Po ID'), F('Sku'), F('Supplier ID'), F('Warehouse ID'), F('Order Date', 'date'), F('Expected Date', 'date'), F('Qty Ordered', 'number'), F('Qty Received', 'number'), F('Status')],
      values: [[`PO-${id8()}`, sku, supplier, warehouse_id, today(), `${new Date(Date.now() + lead * 864e5).toISOString().slice(0, 10)}T00:00:00Z`, qty, 0, 'Open']] }),
    'Receive Purchase Order': async ({ po, qty, expiry }) => {
      const id = `B-${po['Po ID']}`, b = { id, sku: po.Sku, wh: po['Warehouse ID'] };
      await write({ view: B, operation: 'insert', fields: [F('Batch ID'), F('Sku'), F('Warehouse ID'), F('Supplier ID'), F('Received Date', 'date'), F('Expiry Date', 'date'), F('Qty Received', 'number'), F('Qty On Hand', 'number'), F('Unit Cost Gbp', 'number'), F('Status')],
        values: [[id, po.Sku, po['Warehouse ID'], po['Supplier ID'], today(), `${expiry}T00:00:00Z`, qty, qty, Number(po['Unit Cost Gbp']), 'Available']] });
      await movement(b, 'Receipt', qty, po['Po ID']);
      await update(P, 'Po ID', po['Po ID'], [['Status', 'Received'], ['Received Date', today(), 'date'], ['Qty Received', qty, 'number']]);
    },
  };
  const audit = (what, how) => { S.audit.unshift({ at: now(), who: S.user, what, how }); save(); };
  const exec = async (action, args, what) => {
    try { await ACTIONS[action](args); audit(what, 'written'); await refresh(); onWritten(); } catch (e) { audit(`FAILED ${what}: ${e?.message ?? e}`, 'failed'); await refresh(); }
  };
  const request = (kind, action, args, label, value) => {
    S.requests.unshift({ id: `RQ-${1001 + S.requests.length}`, kind, action, args, label, value, status: 'Pending approval', by: S.user });
    audit(`requested ${kind}: ${label}`, 'queued'); render();
  };
  const table = (head, rows, empty) => (rows.length ? `<table class="wf-t"><tr>${head.map((h) => `<th${h[0] === '>' ? ' class="r"' : ''}>${h.replace('>', '')}</th>`).join('')}</tr>${rows.join('')}</table>` : `<p class="wf-note">${empty}</p>`);
  const need = (who) => `<span class="wf-note">${who}</span>`;
  const render = () => {
    const u = S.user;
    const ordered = [...Q.batches].sort((a, c) => a.EXPIRY_DATE - c.EXPIRY_DATE);
    const fefo = new Map();
    for (const b of ordered) { const k = `${b.SKU}|${b.WAREHOUSE_ID}`; if (b.STATUS === 'Available' && !fefo.has(k)) fefo.set(k, b.BATCH_ID); }

    hosts.in.innerHTML = `<figure class="ob-card full"><figcaption>Purchase orders due in</figcaption>${table(['PO', 'Product', 'Warehouse', 'Status', 'Due', '>Ordered', '>Counted', 'Expiry on batch', ''],
      [...Q.pos].sort((a, c) => a['Expected Date'] - c['Expected Date']).map((p, i) => `<tr><td><b>${esc(p['Po ID'])}</b></td><td>${esc(p.Sku)}</td><td>${esc(p['Warehouse ID'])}</td><td>${pill(p.Status)}</td><td>${day(p['Expected Date'])}</td><td class="r">${num(p['Qty Ordered'])}</td><td class="r"><input class="sr-n" type="number" min="1" value="${Number(p['Qty Ordered'])}" data-c="${i}"></td><td><input type="date" value="${new Date(Date.now() + 365 * 864e5).toISOString().slice(0, 10)}" data-e="${i}"></td><td>${u === 'Warehouse Operator' ? `<button class="wf-btn" data-rc="${i}">Book in</button>` : need('Warehouse Operator')}</td></tr>`), 'Nothing due in.')}</figure>`;

    hosts.out.innerHTML = `<figure class="ob-card full"><figcaption>Pick list · oldest eligible expiry first, enforced</figcaption>${scanBox('out')}${table(['Batch', 'Product', 'Warehouse', 'Expiry', '>On hand', '>Units', 'Order ref', ''],
      ordered.filter((b) => b.STATUS === 'Available' && hit(b, scan.out)).map((b) => `<tr><td><b>${esc(b.BATCH_ID)}</b>${blockOf(b) ? '' : ' <span class="sr-fefo">pick first</span>'}</td><td>${esc(b.PRODUCT_NAME)}</td><td>${esc(b.WAREHOUSE_ID)}</td><td>${day(b.EXPIRY_DATE)}</td><td class="r">${num(b['Units On Hand'])}</td><td class="r"><input class="sr-n" type="number" min="1" max="${Number(b['Units On Hand'])}" value="1" data-qty="${esc(b.BATCH_ID)}"></td><td><input class="sr-ref" placeholder="ORDER-" data-ref="${esc(b.BATCH_ID)}"></td><td>${blockOf(b) ? `<span class="sr-block">${esc(blockOf(b))}</span>` : u === 'Warehouse Operator' ? `<button class="wf-btn" data-ds="${esc(b.BATCH_ID)}">Dispatch</button>` : need('Warehouse Operator')}</td></tr>`), 'No matching stock.')}</figure>`;

    hosts.transfer.innerHTML = `<figure class="ob-card full"><figcaption>Move stock to the other warehouse · batch and expiry travel with it</figcaption>${table(['Batch', 'Product', 'From', 'To', 'Expiry', '>At risk', '>On hand', '>Units', ''],
      ordered.filter((b) => b.STATUS === 'Available').sort((a, c) => c['Units At Risk'] - a['Units At Risk']).map((b) => `<tr><td><b>${esc(b.BATCH_ID)}</b></td><td>${esc(b.PRODUCT_NAME)}</td><td>${esc(b.WAREHOUSE_ID)}</td><td>${b.WAREHOUSE_ID === 'WH-UK' ? 'WH-US' : 'WH-UK'}</td><td>${day(b.EXPIRY_DATE)}</td><td class="r">${num(b['Units At Risk'])}</td><td class="r">${num(b['Units On Hand'])}</td><td class="r"><input class="sr-n" type="number" min="1" max="${Number(b['Units On Hand'])}" value="${Math.max(1, Math.min(Number(b['Units On Hand']), Number(b['Units At Risk'])))}" data-tq="${esc(b.BATCH_ID)}"></td><td>${u === 'Operations Manager' ? `<button class="wf-btn" data-tf="${esc(b.BATCH_ID)}">Transfer</button>` : need('Operations Manager')}</td></tr>`), 'No stock to move.')}</figure>`;

    hosts.count.innerHTML = `<figure class="ob-card full"><figcaption>Count by batch · variances over 5% go to the Operations Manager</figcaption>${scanBox('count')}${table(['Batch', 'Product', 'Warehouse', '>System', '>Counted', ''],
      ordered.filter((b) => hit(b, scan.count)).map((b) => `<tr><td><b>${esc(b.BATCH_ID)}</b></td><td>${esc(b.PRODUCT_NAME)}</td><td>${esc(b.WAREHOUSE_ID)}</td><td class="r">${num(b['Units On Hand'])}</td><td class="r"><input class="sr-n" type="number" min="0" value="${Number(b['Units On Hand'])}" data-cq="${esc(b.BATCH_ID)}"></td><td>${u === 'Warehouse Operator' ? `<button class="wf-btn ghost" data-ct="${esc(b.BATCH_ID)}">Post count</button>` : need('Warehouse Operator')}</td></tr>`), 'No matching batches.')}</figure>`;

    const roots = [...new Set(ordered.map((b) => rootOf(b.BATCH_ID)))];
    hosts.trace.innerHTML = `<figure class="ob-card full"><figcaption>Trace a batch back to its supplier and forward to its shipments</figcaption><label class="sr-scan">Batch <select data-tr><option value="">Choose a batch…</option>${roots.map((r) => `<option ${traced?.id === r ? 'selected' : ''}>${esc(r)}</option>`).join('')}</select></label>${traced ? `
      <div class="kx-wi-kpis"><div><span>Supplier</span><b>${esc(traced.supplier)}</b><i>${esc(traced.product)}</i></div><div><span>Received</span><b>${num(traced.in)}</b><i>units in</i></div><div><span>Shipped</span><b>${num(traced.out)}</b><i>${traced.refs} references</i></div><div><span>Still held</span><b>${num(traced.held)}</b><i>${traced.sites}</i></div></div>
      <p>${u === 'Quality Lead' ? `<button class="wf-btn" data-rec="${esc(traced.id)}">Recall: quarantine all remaining stock</button>` : need('Recall needs a Quality Lead')}</p>
      ${table(['Date', 'Movement', 'Batch', 'Warehouse', 'Reference', '>Units'], traced.rows.map((r) => `<tr><td>${day(r['Movement Date'])}</td><td>${esc(r['Movement Type'])}</td><td>${esc(r['Batch ID'])}</td><td>${esc(r['Warehouse ID'])}</td><td>${esc(r.Reference)}</td><td class="r">${num(r['Net Movement'])}</td></tr>`), 'No movements.')}` : ''}</figure>`;

    hosts.reorder.innerHTML = `<figure class="ob-card full"><figcaption>Reorder queue · suggested from run rate, cover and inbound</figcaption>${table(['Product', 'Warehouse', 'Status', '>Cover', '>Order units', ''],
      Q.reorder.filter((r) => Number(r['Suggested Order Units']) > 0).sort((a, c) => c['Suggested Order Units'] - a['Suggested Order Units']).map((r, i) => `<tr><td><b>${esc(r.PRODUCT_NAME)}</b></td><td>${esc(r.WAREHOUSE_ID)}</td><td>${pill(r.STOCK_STATUS)}</td><td class="r">${r.DAYS_OF_COVER == null ? '–' : `${Math.round(r.DAYS_OF_COVER)}d`}</td><td class="r"><input class="sr-n" type="number" min="1" value="${Number(r['Suggested Order Units'])}" data-oq="${esc(r.SKU)}${esc(r.WAREHOUSE_ID)}"></td><td>${u === 'Planner' ? `<button class="wf-btn" data-po="${esc(r.SKU)}|${esc(r.WAREHOUSE_ID)}">Propose PO</button>` : need('Planner')}</td></tr>`), 'Nothing to reorder.')}</figure>`;

    hosts.expiry.innerHTML = `<figure class="ob-card full"><figcaption>Batches to act on · expiring within 30 days, at risk, or in quarantine</figcaption>${table(['Batch', 'Product', 'Warehouse', 'Status', 'Expiry', '>On hand', '>At risk', '>Value', ''],
      ordered.filter((b) => Number(b['Units At Risk']) > 0 || Number(b.DAYS_TO_EXPIRY) <= 30 || b.STATUS === 'Quarantine').map((b) => `<tr><td><b>${esc(b.BATCH_ID)}</b></td><td>${esc(b.PRODUCT_NAME)}</td><td>${esc(b.WAREHOUSE_ID)}</td><td>${pill(b.STATUS)}</td><td>${day(b.EXPIRY_DATE)} <small>${num(b.DAYS_TO_EXPIRY)}d</small></td><td class="r">${num(b['Units On Hand'])}</td><td class="r">${num(b['Units At Risk'])}</td><td class="r">${gbp(b['Value At Risk'])}</td><td class="sr-acts">${u === 'Planner' ? `<button class="wf-btn ghost" data-wo="${esc(b.BATCH_ID)}">Request write-off</button>` : ''}${u === 'Quality Lead' ? `<button class="wf-btn ghost" data-q="${esc(b.BATCH_ID)}" data-to="${b.STATUS === 'Quarantine' ? 'Available' : 'Quarantine'}">${b.STATUS === 'Quarantine' ? 'Release' : 'Quarantine'}</button>` : ''}${['Planner', 'Quality Lead'].includes(u) ? '' : need('Planner or Quality Lead')}</td></tr>`), 'Nothing needs action.')}</figure>`;

    hosts.approvals.innerHTML = `<figure class="ob-card full"><figcaption>Requests</figcaption>${table(['Request', 'What', 'Workflow', '>Value', 'Raised by', 'Status', ''],
      S.requests.slice(0, 30).map((r, i) => `<tr><td><b>${r.id}</b></td><td>${esc(r.label)}</td><td>${esc(r.action)}</td><td class="r">${esc(r.value)}</td><td>${esc(r.by)}</td><td>${pill(r.status)}</td><td>${r.status !== 'Pending approval' ? '' : APPROVER[r.action] === u ? `<button class="wf-btn" data-ok="${i}">Approve</button> <button class="wf-btn ghost" data-no="${i}">Reject</button>` : need(`needs ${APPROVER[r.action]}`)}</td></tr>`), 'No requests yet.')}</figure>
      <figure class="ob-card full"><figcaption>Audit trail <button class="wf-btn ghost" data-reset>Clear</button></figcaption>${table(['When', 'Who', 'What', 'Result'], S.audit.slice(0, 50).map((a) => `<tr><td class="wf-sub">${esc(a.at)}</td><td>${esc(a.who)}</td><td>${esc(a.what)}</td><td>${esc(a.how)}</td></tr>`), 'Nothing recorded yet.')}</figure>`;

    const on = (sel, fn) => Object.values(hosts).forEach((h) => h.querySelectorAll(sel).forEach((b) => (b.onclick = () => { b.disabled = true; fn(b); })));
    const pos = [...Q.pos].sort((a, c) => a['Expected Date'] - c['Expected Date']);
    on('[data-rc]', (b) => { const p = pos[b.dataset.rc]; const qty = Number(hosts.in.querySelector(`[data-c="${b.dataset.rc}"]`).value), expiry = hosts.in.querySelector(`[data-e="${b.dataset.rc}"]`).value; exec('Receive Purchase Order', { po: p, qty, expiry }, `booked in ${num(qty)} units on ${p['Po ID']}, expiry ${expiry}`); });
    on('[data-ds]', (b) => { const id = b.dataset.ds, qty = Number(hosts.out.querySelector(`[data-qty="${id}"]`).value), reference = hosts.out.querySelector(`[data-ref="${id}"]`).value || `ORDER-${id8()}`; exec('Record Dispatch', { batch_id: id, qty, reference }, `dispatched ${num(qty)} units from ${id} on ${reference}`); });
    on('[data-tf]', (b) => { const id = b.dataset.tf, qty = Number(hosts.transfer.querySelector(`[data-tq="${id}"]`).value); exec('Transfer Stock', { batch_id: id, qty }, `transferred ${num(qty)} units of ${id}`); });
    on('[data-ct]', (b) => { const id = b.dataset.ct, counted = Number(hosts.count.querySelector(`[data-cq="${id}"]`).value), x = batchOf(id), gap = counted - x.on;
      if (!gap) { audit(`counted ${id}: no variance`, 'none'); render(); } else if (Math.abs(gap) / Math.max(1, x.on) > 0.05) request('count variance', 'Post Stock Count', { batch_id: id, counted }, `${id} · system ${num(x.on)}, counted ${num(counted)}`, `${gap > 0 ? '+' : ''}${num(gap)} units`);
      else exec('Post Stock Count', { batch_id: id, counted }, `posted count on ${id}: ${gap > 0 ? '+' : ''}${num(gap)} units`); });
    on('[data-rec]', (b) => exec('Recall Batch', { batch_id: b.dataset.rec }, `recalled ${b.dataset.rec}: remaining stock quarantined`));
    Object.values(hosts).forEach((h) => h.querySelectorAll('[data-scan]').forEach((i) => (i.onchange = () => { scan[i.dataset.scan] = i.value.trim(); render(); })));
    const trSel = hosts.trace.querySelector('[data-tr]');
    trSel.onchange = async () => { traced = trSel.value ? await traceOf(trSel.value, Q) : null; render(); };
    on('[data-q]', (b) => exec('Set Batch Status', { batch_id: b.dataset.q, new_status: b.dataset.to }, `set ${b.dataset.q} to ${b.dataset.to}`));
    on('[data-wo]', (b) => { const x = batchOf(b.dataset.wo); request('write-off', 'Write Off Batch', { batch_id: x.id, reason: 'Short-dated' }, `${x.id} · ${x.name} · ${num(x.on)} units`, gbp(Q.batches.find((y) => y.BATCH_ID === x.id)['Value At Risk'])); });
    on('[data-po]', (b) => { const [sku, wh] = b.dataset.po.split('|'); const r = Q.reorder.find((x) => x.SKU === sku && x.WAREHOUSE_ID === wh); const qty = Number(hosts.reorder.querySelector(`[data-oq="${sku}${wh}"]`).value); request('reorder', 'Raise Purchase Order', { sku, supplier: r.SUPPLIER_ID, warehouse_id: wh, qty, lead: Number(r.lead) || 14 }, `${r.PRODUCT_NAME} → ${wh}`, `${num(qty)} units`); });
    on('[data-ok]', (b) => { const r = S.requests[b.dataset.ok]; r.status = 'Approved'; exec(r.action, r.args, `approved ${r.id}: ${r.label}`); });
    on('[data-no]', (b) => { const r = S.requests[b.dataset.no]; r.status = 'Rejected'; audit(`rejected ${r.id}: ${r.label}`, 'none'); render(); });
    on('[data-reset]', () => { const user = S.user; S = { ...seed(), user }; save(); render(); });
    onUser(S.requests.filter((r) => r.status === 'Pending approval').length);
  };
  const refresh = async () => { Q = await loadQueues(); render(); };
  render();
  refresh().catch((e) => { hosts.in.textContent = `Queues failed to load: ${e?.message ?? e}`; });
  return { refresh, queues: () => Q, user: () => S.user, setUser: (u) => { S.user = u; save(); render(); } };
};
