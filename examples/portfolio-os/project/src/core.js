/**
 * Core services of Private Markets Portfolio OS: DOM helpers, number formats (with an explicit
 * FX table), roles and permissions, the governed workflow store (Workflow Records + Audit Events
 * views, written through Astrato writeback) and the slide-out panel / dialog primitives.
 *
 * Persistence: every workflow change is written to Snowflake (MOCK_DATA.NSC_WF_RECORDS /
 * NSC_WF_EVENTS) through app.writeback. If the runtime cannot write (e.g. a read-only
 * publication) the change is kept in a clearly labelled simulated store in this browser.
 */
export const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v; else if (k === 'text') node.textContent = v; else if (k === 'html') node.innerHTML = v; else if (k.startsWith('on')) node.addEventListener(k.slice(2), v); else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) if (c != null && c !== false) node.append(c);
  return node;
};
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const icon = (name) => el('span', { class: 'mi', text: name, 'aria-hidden': 'true' });
export const N = (v) => (v == null || v === '' ? NaN : Number(v));

// ------------------------------------------------------------------ currency (explicit Northstar Treasury quarter-end rates)
export const FXR = { USD: 1, EUR: 1.16, GBP: 1.34, date: '2026-09-30' };
let CCY = (() => { try { return localStorage.getItem('nsos-ccy') || 'USD'; } catch { return 'USD'; } })();
export const ccy = () => CCY;
export const setCcy = (c) => { CCY = c; try { localStorage.setItem('nsos-ccy', c); } catch { /* */ } window.dispatchEvent(new Event('nsos-ccy')); };
const SYM = { USD: '$', EUR: '€', GBP: '£' };
const conv = (usd) => usd / FXR[CCY];
export const money = (usdM, d0 = 1) => { const d = typeof d0 === "number" ? d0 : 1; const v = N(usdM); if (!Number.isFinite(v)) return '–'; const x = conv(v); const a = Math.abs(x); const s = a >= 1000 ? `${SYM[CCY]}${(a / 1000).toFixed(2)}bn` : `${SYM[CCY]}${a.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d })}m`; return x < 0 ? `(${s})` : s; };
export const smoney = (usdM, d0 = 1) => { const d = typeof d0 === "number" ? d0 : 1; const v = N(usdM); if (!Number.isFinite(v)) return '–'; return `${v >= 0 ? '+' : '−'}${money(Math.abs(v), d)}`; };
export const pct = (v, d0 = 1, d = typeof d0 === "number" ? d0 : 1) => (Number.isFinite(N(v)) ? `${(N(v) * 100).toFixed(d)}%` : '–');
export const spct = (v, d0 = 1, d = typeof d0 === "number" ? d0 : 1) => (Number.isFinite(N(v)) ? `${N(v) >= 0 ? '+' : '−'}${Math.abs(N(v) * 100).toFixed(d)}%` : '–');
export const pts = (v, d0 = 1, d = typeof d0 === "number" ? d0 : 1) => (Number.isFinite(N(v)) ? `${N(v) >= 0 ? '+' : '−'}${Math.abs(N(v) * 100).toFixed(d)} pts` : '–');
export const mult = (v, d0 = 1, d = typeof d0 === "number" ? d0 : 1) => (Number.isFinite(N(v)) ? `${N(v).toFixed(d)}x` : '–');
export const smult = (v, d0 = 1, d = typeof d0 === "number" ? d0 : 1) => (Number.isFinite(N(v)) ? `${N(v) >= 0 ? '+' : '−'}${Math.abs(N(v)).toFixed(d)}x` : '–');
export const int = (v) => (Number.isFinite(N(v)) ? Math.round(N(v)).toLocaleString('en-US') : '–');
export const tone = (v, goodUp = true) => (!Number.isFinite(N(v)) || Math.abs(N(v)) < 1e-9 ? '' : (N(v) > 0) === goodUp ? 'pos' : 'neg');
export const iso = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
export const stamp = (v) => { if (v == null || v === '') return ''; const d = new Date(typeof v === 'number' || /^\d+$/.test(String(v)) ? Number(v) : String(v).replace(' ', 'T') + (String(v).length === 19 ? 'Z' : '')); return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 16).replace('T', ' '); };
export const day = (v) => stamp(v).slice(0, 10);
export const TODAY = '2026-11-09';
export const pill = (s) => el('span', { class: `pill p-${String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-')}`, text: s });

// ------------------------------------------------------------------ roles and permissions (enforced on reads that matter and on every write)
export const USERS = [
  { name: 'Liam Patel', role: 'Investment Analyst' },
  { name: 'Hannah Brooks', role: 'Investment Associate' },
  { name: 'Catherine Ward', role: 'Investment Director' },
  { name: 'Robert Hale', role: 'Investment Director', note: 'IC chair' },
  { name: 'Ana Ruiz', role: 'Portfolio Operations' },
  { name: 'Sarah Lindgren', role: 'Valuation Committee' },
  { name: 'Platform Admin', role: 'Administrator' },
];
export const PERMS = {
  'monitoring.start': ['Portfolio Operations', 'Administrator'],
  'monitoring.edit': ['Portfolio Operations', 'Investment Analyst', 'Investment Associate'],
  'monitoring.review': ['Investment Analyst', 'Investment Associate'],
  'monitoring.approve': ['Investment Director'],
  'monitoring.reopen': ['Investment Director', 'Administrator'],
  'finding.resolve': ['Investment Analyst', 'Investment Associate', 'Portfolio Operations'],
  'valuation.draft': ['Investment Analyst', 'Investment Associate'],
  'valuation.challenge': ['Valuation Committee', 'Investment Director'],
  'valuation.approve': ['Valuation Committee'],
  'valuation.publish': ['Valuation Committee', 'Administrator'],
  'scenario.save': ['Investment Analyst', 'Investment Associate', 'Investment Director'],
  'scenario.submit': ['Investment Analyst', 'Investment Associate', 'Investment Director'],
  'initiative.propose': ['Investment Analyst', 'Investment Associate', 'Investment Director', 'Portfolio Operations'],
  'initiative.approve': ['Investment Director'],
  'initiative.progress': ['Portfolio Operations', 'Investment Associate'],
  'initiative.verify': ['Portfolio Operations'],
  'ic.create': ['Investment Analyst', 'Investment Associate', 'Investment Director'],
  'ic.decide': ['Investment Director'],
  'action.create': USERS.map((u) => u.role),
  'view.save': USERS.map((u) => u.role),
  'admin.rules': ['Administrator'],
};
let ME = (() => { try { return JSON.parse(localStorage.getItem('nsos-user')) || USERS[0]; } catch { return USERS[0]; } })();
export const me = () => ME;
export const setMe = (u) => { ME = u; try { localStorage.setItem('nsos-user', JSON.stringify(u)); } catch { /* */ } window.dispatchEvent(new Event('nsos-user')); };
export const can = (perm) => (PERMS[perm] ?? []).includes(ME.role);
export const roleList = (perm) => (PERMS[perm] ?? []).join(' or ');

// ------------------------------------------------------------------ toasts, notifications
let toastHost;
export const mountToasts = (host) => { toastHost = host; };
export const toast = (msg, ic = 'check_circle', kind = '') => { if (!toastHost) return; const t = el('div', { class: `toast ${kind}` }, [icon(ic), el('span', { html: msg })]); toastHost.append(t); setTimeout(() => t.remove(), 4200); };
export const denied = (perm) => toast(`<b>${esc(ME.role)}</b> cannot do this. Requires ${esc(roleList(perm))}.`, 'lock', 'warn');

// ------------------------------------------------------------------ slide-out panel and dialogs
let drawerEl;
export const mountDrawer = (host) => { drawerEl = host; };
export const closeDrawer = () => { drawerEl?.classList.remove('open'); };
export const openDrawer = ({ title, kicker, body, actions = [], wide = false }) => {
  drawerEl.className = `drawer open${wide ? ' wide' : ''}`;
  drawerEl.replaceChildren(
    el('header', {}, [el('div', {}, [kicker ? el('small', { text: kicker }) : null, el('h2', { text: title })]), el('button', { class: 'icon-btn', title: 'Close', onclick: closeDrawer }, icon('close'))]),
    el('div', { class: 'drawer-body' }, body),
    actions.length ? el('footer', {}, actions) : null,
  );
  drawerEl.scrollTop = 0;
  return drawerEl;
};
/** Ask for a reason (and optionally confirm a material change). Resolves the text or null. */
export const ask = ({ title, text, label = 'Reason', required = true, confirmLabel = 'Confirm', danger = false, value = '' }) => new Promise((resolve) => {
  const input = el('textarea', { rows: 3, placeholder: label });
  input.value = value;
  const back = el('div', { class: 'modal-back' });
  const close = (v) => { back.remove(); resolve(v); };
  back.append(el('div', { class: 'modal', role: 'dialog', 'aria-modal': 'true' }, [
    el('h3', { text: title }), text ? el('p', { html: text }) : null, label ? input : null,
    el('div', { class: 'row-end' }, [el('button', { class: 'btn ghost', text: 'Cancel', onclick: () => close(null) }),
      el('button', { class: `btn ${danger ? 'danger' : ''}`, text: confirmLabel, onclick: () => { if (label && required && !input.value.trim()) { input.classList.add('err'); input.focus(); return; } close(label ? input.value.trim() || '—' : 'ok'); } })]),
  ]));
  document.body.append(back);
  setTimeout(() => (label ? input : back.querySelector('.btn:last-child'))?.focus(), 30);
});

// ------------------------------------------------------------------ governed workflow store
const LOCAL = 'nsos-local-v1';
const EVT = 'nsos-store';
const V = { rec: 'Workflow Records', ev: 'Audit Events' };
let backend = null; // { q, write }
export const store = { records: [], events: [], live: false, loaded: false, simulated: [] };
export const onStore = (fn) => window.addEventListener(EVT, fn);
const emit = () => window.dispatchEvent(new Event(EVT));
const readLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL)) ?? { records: [], events: [] }; } catch { return { records: [], events: [] }; } };
const saveLocal = (x) => { try { localStorage.setItem(LOCAL, JSON.stringify(x)); } catch { /* */ } };
const parse = (p) => { try { return JSON.parse(p || '{}'); } catch { return {}; } };
const F = (name, valueType = 'string') => ({ name, valueType });
const REC_FIELDS = [['Record Id'], ['Record Type'], ['Company'], ['Fund'], ['Period'], ['Title'], ['Status'], ['Owner'], ['Due Date', 'date'], ['Payload'], ['Version', 'number'], ['Created By'], ['Created At', 'date'], ['Updated By'], ['Updated At', 'date'], ['Record Count', 'number']];
const recRow = (r) => [r.id, r.type, r.company ?? '', r.fund ?? '', r.period ?? '', r.title ?? '', r.status, r.owner ?? '', r.due ? `${r.due}T00:00:00Z` : null, JSON.stringify(r.payload ?? {}).slice(0, 15000), r.version ?? 1, r.createdBy, r.createdAt, r.updatedBy, r.updatedAt, 1];

export const connectStore = (b) => { backend = b; };
export const loadStore = async () => {
  const local = readLocal();
  try {
    const [recs, evs] = await Promise.all([
      backend.q({ dims: REC_FIELDS.map(([n]) => [n, V.rec]).filter(([n]) => n !== 'Record Count'), limit: 3000 }),
      backend.q({ dims: ['Event Id', 'Event At', 'Actor', 'Role', 'Record Type', 'Record Id', 'Action', 'Previous Value', 'New Value', 'Reason', 'Approval Ref'].map((n) => [n, V.ev]), limit: 5000 }),
    ]);
    store.records = recs.map((r) => ({ id: r['Record Id'], type: r['Record Type'], company: r.Company, fund: r.Fund, period: r.Period, title: r.Title, status: r.Status, owner: r.Owner, due: day(r['Due Date']), payload: parse(r.Payload), version: N(r.Version), createdBy: r['Created By'], createdAt: stamp(r['Created At']), updatedBy: r['Updated By'], updatedAt: stamp(r['Updated At']) }));
    store.events = evs.map((e) => ({ id: e['Event Id'], at: stamp(e['Event At']), actor: e.Actor, role: e.Role, type: e['Record Type'], rid: e['Record Id'], action: e.Action, prev: e['Previous Value'], next: e['New Value'], reason: e.Reason, ref: e['Approval Ref'] }));
    store.live = true;
  } catch (err) {
    console.warn('[store] read failed', err);
    store.live = false;
  }
  // overlay changes that could only be kept in this browser
  for (const r of local.records) { const i = store.records.findIndex((x) => x.id === r.id); if (i >= 0) store.records[i] = r; else store.records.push(r); }
  store.events = [...local.events.filter((e) => !store.events.some((x) => x.id === e.id)), ...store.events];
  store.simulated = local.records.map((r) => r.id);
  store.events.sort((a, b) => String(b.at).localeCompare(String(a.at)));
  store.loaded = true;
  emit();
};
export const records = (type, filter = () => true) => store.records.filter((r) => r.type === type && filter(r));
export const record = (id) => store.records.find((r) => r.id === id);
export const eventsFor = (rid) => store.events.filter((e) => e.rid === rid);

const writeOrKeep = async (writes, keep) => {
  try {
    if (!backend?.write) throw new Error('writeback unavailable');
    for (const w of writes) await backend.write(w);
    return true;
  } catch (err) {
    console.warn('[store] write failed, simulated persistence', err);
    keep();
    return false;
  }
};
const nextId = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase().slice(-6)}${Math.random().toString(36).slice(2, 4).toUpperCase()}`;
const auditRow = (e) => ({ view: V.ev, operation: 'insert', fields: [F('Event Id'), F('Event At', 'date'), F('Actor'), F('Role'), F('Record Type'), F('Record Id'), F('Action'), F('Previous Value'), F('New Value'), F('Reason'), F('Approval Ref'), F('Event Count', 'number')], values: [[e.id, e.atIso, e.actor, e.role, e.type, e.rid, e.action, String(e.prev ?? '').slice(0, 1000), String(e.next ?? '').slice(0, 1000), String(e.reason ?? '').slice(0, 1900), e.ref ?? '', 1]] });

/** Create or update a workflow record and append the audit event, through governed writeback. */
export const saveRecord = async (rec, { action, prev = '', next = '', reason = '', ref = '' } = {}) => {
  const now = iso();
  const existing = record(rec.id);
  const r = { ...(existing ?? {}), ...rec, id: rec.id ?? nextId(rec.prefix ?? rec.type.slice(0, 3).toUpperCase()), version: (existing?.version ?? 0) + 1, updatedBy: ME.name, updatedAt: stamp(now) };
  delete r.prefix;
  if (!existing) { r.createdBy = ME.name; r.createdAt = stamp(now); }
  const ev = { id: nextId('EV'), at: stamp(now), atIso: now, actor: ME.name, role: ME.role, type: r.type, rid: r.id, action, prev, next: next || r.status, reason, ref };
  const rowFor = { ...r, createdAt: existing ? null : now, updatedAt: now };
  const writes = existing
    ? [{ view: V.rec, operation: 'update', fields: [F('Title'), F('Status'), F('Owner'), F('Payload'), F('Version', 'number'), F('Updated By'), F('Updated At', 'date')], values: [[r.title ?? '', r.status, r.owner ?? '', JSON.stringify(r.payload ?? {}).slice(0, 15000), r.version, ME.name, now]], keys: { fields: [F('Record Id')], values: [[r.id]] } }, auditRow(ev)]
    : [{ view: V.rec, operation: 'insert', fields: REC_FIELDS.map(([n, t]) => F(n, t)), values: [recRow({ ...rowFor, createdAt: now })] }, auditRow(ev)];
  // optimistic local state
  if (existing) Object.assign(existing, r); else store.records.push(r);
  store.events.unshift(ev);
  const ok = await writeOrKeep(writes, () => { const l = readLocal(); l.records = [...l.records.filter((x) => x.id !== r.id), r]; l.events = [ev, ...l.events]; saveLocal(l); store.simulated = l.records.map((x) => x.id); });
  emit();
  toast(`${esc(action)} · <b>${esc(r.title ?? r.id)}</b>${ok ? ' · written to Snowflake (governed writeback)' : ' · <i>simulated persistence (this browser)</i>'}`, ok ? 'cloud_done' : 'cloud_off');
  return r;
};
/** Audit-only event (e.g. a view saved, an export, a writeback on a source table). */
export const audit = async (type, rid, action, { prev = '', next = '', reason = '', ref = '' } = {}) => {
  const now = iso();
  const ev = { id: nextId('EV'), at: stamp(now), atIso: now, actor: ME.name, role: ME.role, type, rid, action, prev, next, reason, ref };
  store.events.unshift(ev);
  await writeOrKeep([auditRow(ev)], () => { const l = readLocal(); l.events = [ev, ...l.events]; saveLocal(l); });
  emit();
  return ev;
};
/** Direct governed writeback on an analytical table (Valuations, Plans) — always paired with an audit event. */
export const writeTable = async (req, auditArgs) => {
  const ok = await writeOrKeep([req], () => { const l = readLocal(); (l.tables ??= []).push(req); saveLocal(l); });
  await audit(...auditArgs);
  return ok;
};
export const localTableWrites = () => readLocal().tables ?? [];
export const resetLocal = () => { try { localStorage.removeItem(LOCAL); } catch { /* */ } };
