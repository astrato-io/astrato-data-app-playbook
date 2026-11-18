/** Workflows & Approvals — my queue, all workflow records, role permissions, workflow rules and the searchable audit history. */
import { el, esc, icon, me, can, denied, saveRecord, records, store, onStore, ask, pill, PERMS, USERS, TODAY, toast } from '../core.js';
import { M } from '../data.js';
import { VALIDATION_RULES } from '../engine.js';
import { sheet, btn, section, tabs } from '../ui.js';

export const mountWorkflows = (ctx, pane) => {
  const { card, go } = ctx;
  const queue = el('div'), allRecs = el('div'), auditHost = el('div'), rolesHost = el('div'), rulesHost = el('div');
  const q = el('input', { type: 'search', placeholder: 'Search audit: user, record, action, value, reason, approval ref…' });
  const typeSel = el('select', {}, [el('option', { value: '', text: 'All record types' })]);
  const PAGE = { Monitoring: 'monitoring', Valuation: 'valuations', Scenario: 'scenario', Initiative: 'value', 'IC Package': 'ic', Action: 'workflows', 'Thesis Assessment': 'company', 'Saved View': 'portfolio', Plan: 'scenario', Company: 'company' };

  const myQueue = () => {
    const r = me().role, items = [];
    for (const m of records('Monitoring', (x) => !['Approved', 'Locked'].includes(x.status))) {
      const mine = (r === 'Portfolio Operations' && ['Draft', 'Submitted'].includes(m.status)) || (['Investment Analyst', 'Investment Associate'].includes(r) && ['Validation', 'Analyst Review'].includes(m.status)) || (r === 'Investment Director' && m.status === 'Investment Team Review');
      if (mine) items.push({ type: 'Monitoring', title: `${m.company} · ${m.period} pack`, status: m.status, due: m.due, go: () => go('monitoring', m.company) });
    }
    for (const v of M.vals.filter((x) => x.Quarter === '2026-Q3' && x.Status !== 'Approved')) {
      const mine = (r === 'Valuation Committee' && ['Under Review', 'Challenged'].includes(v.Status)) || (['Investment Analyst', 'Investment Associate'].includes(r) && ['Proposed', 'Challenged'].includes(v.Status));
      if (mine) items.push({ type: 'Valuation', title: `${v.Company} · Q3 2026 valuation`, status: v.Status, due: '2026-11-20', go: () => go('valuations', v.Company) });
    }
    for (const p of records('IC Package', (x) => ['Submitted', 'Under Review'].includes(x.status))) if (r === 'Investment Director') items.push({ type: 'IC Package', title: p.title, status: p.status, due: '—', go: () => go('ic', p.company) });
    for (const s of records('Scenario', (x) => x.status === 'Submitted')) if (r === 'Investment Director') items.push({ type: 'Scenario', title: s.title, status: s.status, due: '—', go: () => go('scenario', s.company) });
    for (const i of records('Initiative', (x) => ['Under Review', 'Approved', 'In Progress', 'Completed'].includes(x.status))) { const mine = (r === 'Investment Director' && i.status === 'Under Review') || (r === 'Portfolio Operations' && ['Approved', 'In Progress', 'Completed'].includes(i.status)); if (mine) items.push({ type: 'Initiative', title: i.title, status: i.status, due: i.payload?.target ?? '—', go: () => go('value', i.company) }); }
    for (const a of records('Action', (x) => ['Open', 'In Progress'].includes(x.status))) items.push({ type: 'Action', title: `${a.title} · ${a.company}`, status: a.status, due: a.due, owner: a.owner, rec: a });
    return items;
  };
  const actionStatus = async (a, to) => {
    if (!can('action.create')) return denied('action.create');
    const reason = await ask({ title: `${to} · ${a.title}`, label: 'Note', required: to === 'Done', confirmLabel: to });
    if (reason === null) return;
    await saveRecord({ ...a, status: to }, { action: `Action ${to.toLowerCase()}`, prev: a.status, next: to, reason });
  };
  const renderQueue = () => {
    const items = myQueue();
    queue.replaceChildren(sheet([{ key: 'type', label: 'Type', cls: '', fmt: (v) => el('span', { class: 'tag', text: v }) }, { key: 'title', label: 'Item', cls: '' }, { key: 'status', label: 'Status', cls: '', fmt: (v) => pill(v) }, { key: 'due', label: 'Due', cls: '', fmt: (v) => el('span', { class: v && v < TODAY ? 'neg' : '', text: v ?? '—' }) }, { key: 'x', label: '', cls: '', value: () => '', fmt: (v, r) => (r.rec ? el('span', { class: 'row-end' }, [r.rec.status === 'Open' ? el('button', { class: 'linkish', text: 'Start', onclick: () => actionStatus(r.rec, 'In Progress') }) : null, el('button', { class: 'linkish', text: 'Done', onclick: () => actionStatus(r.rec, 'Done') })]) : el('button', { class: 'linkish', text: 'Open →', onclick: r.go })) }], items),
      items.length ? null : el('p', { class: 'muted', text: `Nothing waiting for ${me().role}.` }));
  };
  const renderAll = () => {
    const types = [...new Set(store.records.map((r) => r.type))].sort();
    allRecs.replaceChildren(sheet([{ key: 'type', label: 'Type' }, { key: 'n', label: 'Records' }, ...['open', 'done'].map((k) => ({ key: k, label: k === 'open' ? 'Open' : 'Closed' })), { key: 'last', label: 'Last change', cls: '' }], types.map((t) => { const rs = records(t); const closed = rs.filter((r) => ['Approved', 'Locked', 'Done', 'Published', 'Benefits Verified', 'Rejected', 'Returned', 'Cancelled', 'Saved'].includes(r.status)).length; return { type: t, n: rs.length, open: rs.length - closed, done: closed, last: rs.map((r) => r.updatedAt).sort().at(-1) }; })));
  };
  const renderAudit = () => {
    const t = q.value.trim().toLowerCase(), ty = typeSel.value;
    const rows = store.events.filter((e) => (!ty || e.type === ty) && (!t || `${e.actor} ${e.role} ${e.type} ${e.rid} ${e.action} ${e.prev} ${e.next} ${e.reason} ${e.ref}`.toLowerCase().includes(t))).slice(0, 400);
    auditHost.replaceChildren(el('p', { class: 'note', text: `${rows.length} of ${store.events.length} audit events${store.live ? ' · Audit Events view (ASTRATO_GALLERY.MOCK_DATA.NSC_WF_EVENTS)' : ' · simulated persistence'}` }), sheet([{ key: 'at', label: 'Timestamp (UTC)' }, { key: 'actor', label: 'User', cls: '' }, { key: 'role', label: 'Role', cls: '' }, { key: 'type', label: 'Record type', cls: '' }, { key: 'rid', label: 'Record ID', cls: '', fmt: (v, e) => el('button', { class: 'linkish', text: v, onclick: () => { const rec = store.records.find((r) => r.id === v); go(PAGE[e.type] ?? 'workflows', rec?.company); } }) }, { key: 'action', label: 'Action', cls: '' }, { key: 'prev', label: 'Previous value', cls: '' }, { key: 'next', label: 'New value', cls: '' }, { key: 'reason', label: 'Reason', cls: 'wrap' }, { key: 'ref', label: 'Approval ref', cls: '' }], rows));
  };
  q.oninput = renderAudit; typeSel.onchange = renderAudit;
  const renderRoles = () => {
    const roles = [...new Set(USERS.map((u) => u.role))];
    rolesHost.replaceChildren(sheet([{ key: 'p', label: 'Permission' }, ...roles.map((r) => ({ key: r, label: r }))], Object.entries(PERMS).map(([p, rs]) => ({ p, ...Object.fromEntries(roles.map((r) => [r, rs.includes(r) ? '●' : ''])), __cls: '' }))), el('p', { class: 'note', text: 'Enforced on every write in the app (and on reads that expose decisions). Maker–checker: proposers cannot approve their own scenarios, initiatives or IC packages.' }));
  };
  const renderRules = () => {
    const custom = records('Workflow Rule');
    const val = (id, d) => custom.find((r) => r.payload?.rule === id)?.payload?.value ?? d;
    const rules = [['MON-DUE', 'Monitoring submission deadline', 'Quarter end + 45 days (NCP VI: + 30 days)', val('MON-DUE', '45')], ['MOV-01', 'Unexpected movement tolerance', 'QoQ revenue change', val('MOV-01', '15%')], ['BUD-01', 'Budget variance tolerance', 'Revenue vs budget', val('BUD-01', '5%')], ['RAT-01a', 'Net leverage review threshold', 'Net debt ÷ LTM EBITDA', val('RAT-01a', '6.5x')], ['RAT-01b', 'Interest cover review threshold', 'LTM EBITDA ÷ interest', val('RAT-01b', '2.0x')], ['VAL-MC', 'Valuation approval', 'Valuation Committee; maker–checker', val('VAL-MC', 'Required')], ['IC-Q', 'IC decision quorum', 'Investment Director, not the author', val('IC-Q', '1 + chair')]];
    rulesHost.replaceChildren(sheet([{ key: 0, label: 'Rule' }, { key: 1, label: 'Name', cls: '' }, { key: 2, label: 'Definition', cls: '' }, { key: 3, label: 'Setting' }, { key: 'e', label: '', cls: '', value: () => '', fmt: (v, r) => el('button', { class: 'linkish', text: 'Edit', onclick: async () => { if (!can('admin.rules')) return denied('admin.rules'); const nv = await ask({ title: `Change rule ${r[0]}`, text: esc(r[1]), label: 'New setting', value: r[3], confirmLabel: 'Save rule' }); if (!nv) return; await saveRecord({ type: 'Workflow Rule', prefix: 'RULE', title: `${r[0]} ${r[1]}`, status: 'Active', owner: me().name, payload: { rule: r[0], value: nv } }, { action: 'Workflow rule changed', prev: r[3], next: nv, reason: `${r[1]}` }); renderRules(); } }) }], rules), el('p', { class: 'note', text: `Validation engine rules: ${VALIDATION_RULES.map((r) => `${r[0]} ${r[1]}`).join(' · ')}.` }));
  };
  const renderAllViews = () => { const types = [...new Set(store.events.map((e) => e.type))].sort(); const cur = typeSel.value; typeSel.replaceChildren(el('option', { value: '', text: 'All record types' }), ...types.map((t) => el('option', { value: t, text: t }))); typeSel.value = cur; renderQueue(); renderAll(); renderAudit(); renderRoles(); renderRules(); };
  const P = { queue: el('div', {}, [queue]), audit: el('div', {}, [el('div', { class: 'toolbar' }, [q, typeSel, btn('Export audit (CSV)', () => { const rows = store.events.map((e) => [e.at, e.actor, e.role, e.type, e.rid, e.action, e.prev, e.next, e.reason, e.ref].map((x) => `"${String(x ?? '').replace(/"/g, '""')}"`).join(',')); const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([['timestamp,user,role,record_type,record_id,action,previous_value,new_value,reason,approval_ref', ...rows].join('\n')], { type: 'text/csv' })), download: 'Northstar_audit_history.csv' }); a.click(); }, { kind: 'ghost sm', ic: 'download' })]), auditHost]), records: el('div', {}, [allRecs, el('div', { class: 'grid' }, [card('w-events', 'half'), card('w-status', 'half')])]), roles: el('div', {}, [rolesHost]), rules: el('div', {}, [rulesHost]) };
  const bar = tabs([['queue', 'My queue'], ['audit', 'Audit history'], ['records', 'All workflow records'], ['roles', 'Roles & permissions'], ['rules', 'Workflow rules']], (k) => { for (const [kk, p] of Object.entries(P)) p.hidden = kk !== k; });
  pane.append(el('div', { class: 'page-head' }, [el('div', {}, [el('h2', { text: 'Workflows & Approvals' }), el('p', { text: 'Everything waiting on you, every workflow record and a searchable, exportable audit trail of every significant action (user, timestamp, record, action, previous and new value, reason, approval reference).' })])]), bar, ...Object.values(P));
  onStore(() => { if (!pane.hidden) renderAllViews(); });
  window.addEventListener('nsos-user', renderAllViews);
  ctx.onShow('workflows', renderAllViews);
  renderAllViews();
};
