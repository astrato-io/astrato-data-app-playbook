/**
 * The monthly market call: Draft → Submitted → Approved / Returned, with maker–checker and an
 * audit trail.
 *
 * SIMULATED: records live in this browser's localStorage, not in the warehouse. The layer is kept
 * additive-only and the tenant has no writeback table for calls; the screen says so. The evidence
 * attached to a call (the headline figures) is read from stored measures at the moment of the action.
 */
const KEY = 'labour-market-pulse-calls-v1';
const USERS = [
  { name: 'Chief Economist', role: 'Economist', can: ['draft', 'submit'] },
  { name: 'Head of Research', role: 'Approver', can: ['approve', 'return'] },
];
const RELEASE = 'Sep 2026 release (data to Jul 2026)';
const seed = () => ({
  calls: [{ id: 'C-2026-08', release: 'Aug 2026 release (data to Jun 2026)', call: 'Loosening', hiring: 'Expect larger shortlists in hospitality and retail; keep time-to-hire targets.', pay: 'Budget 3–3.5% for most roles; above-market only for scarce skills.', rationale: 'U/V up on the year; vacancies down; pay growth slowing.', state: 'Approved', maker: 'Chief Economist' }],
  audit: [
    { at: '2026-08-13T09:12:00Z', who: 'Chief Economist', role: 'Economist', id: 'C-2026-08', action: 'submit', from: 'Draft', to: 'Submitted', reason: 'Monthly call' },
    { at: '2026-08-13T15:40:00Z', who: 'Head of Research', role: 'Approver', id: 'C-2026-08', action: 'approve', from: 'Submitted', to: 'Approved', reason: 'Consistent with the release' },
  ],
});
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? seed(); } catch { return seed(); } };
const save = (s) => localStorage.setItem(KEY, JSON.stringify(s));
let state = load();
let me = USERS[0];
export const calls = () => state;

const el = (tag, attrs = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (v == null || v === false) continue; if (k === 'text') n.textContent = v; else if (k.startsWith('on')) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v === true ? '' : v); }
  for (const kid of [].concat(kids)) if (kid != null) n.append(kid);
  return n;
};

export const mountWorkflow = (host, { q, keyOf }) => {
  const record = (id, action, from, to, reason) => state.audit.push({ at: new Date().toISOString(), who: me.name, role: me.role, id, action, from, to, reason });
  const evidence = async () => {
    const [r] = await q({ measures: ['Unemployed per Vacancy', 'Unemployed per Vacancy Change on Year', 'Vacancies Change on Year (000s)', 'Regular Pay Growth'], filters: [{ field: { fieldKey: keyOf('Period Status') }, operator: 'inList', values: ['Latest'] }] });
    return `U/V ${r['Unemployed per Vacancy']?.toFixed(1)} (${r['Unemployed per Vacancy Change on Year'] >= 0 ? '+' : ''}${r['Unemployed per Vacancy Change on Year']?.toFixed(1)} y/y); vacancies ${r['Vacancies Change on Year (000s)']}k y/y; pay growth ${r['Regular Pay Growth']}%`;
  };
  const render = () => {
    const current = state.calls.find((c) => c.release === RELEASE);
    const actingAs = el('select', { 'aria-label': 'Acting as', onchange: (e) => { me = USERS[Number(e.target.value)]; render(); } }, USERS.map((u, i) => el('option', { value: String(i), text: `${u.name} · ${u.role}`, selected: u === me })));
    const form = el('form', { class: 'call-form', onsubmit: async (e) => {
      e.preventDefault();
      const f = new FormData(e.target);
      const before = current?.state ?? 'None';
      const ev = await evidence().catch(() => 'evidence unavailable');
      const next = { id: 'C-2026-09', release: RELEASE, call: f.get('call'), hiring: f.get('hiring'), pay: f.get('pay'), rationale: `${f.get('rationale')} [${ev}]`, state: 'Submitted', maker: me.name };
      state.calls = [next, ...state.calls.filter((c) => c.release !== RELEASE)];
      record(next.id, 'submit', before, 'Submitted', 'Submitted for approval');
      save(state); render();
    } }, [
      el('label', {}, [el('span', { text: 'Our call' }), el('select', { name: 'call', required: true }, ['Loosening', 'Stable', 'Tightening'].map((v) => el('option', { value: v, text: v, selected: (current?.call ?? 'Loosening') === v })))]),
      el('label', {}, [el('span', { text: 'Hiring advice to clients' }), el('textarea', { name: 'hiring', rows: '2', required: true, text: current?.hiring ?? 'Candidate supply is improving: widen shortlists, hold time-to-hire, re-open paused roles selectively.' })]),
      el('label', {}, [el('span', { text: 'Pay advice to clients' }), el('textarea', { name: 'pay', rows: '2', required: true, text: current?.pay ?? 'Private-sector pay growth is 2.9% and slowing: 3–3.5% awards keep pace with the market and stay ahead of inflation.' })]),
      el('label', {}, [el('span', { text: 'Rationale' }), el('textarea', { name: 'rationale', rows: '2', required: true, text: 'Unemployed per vacancy at 2.5 (+0.2 on the year) with vacancies down 36k; regular pay growth down 1.3 pp.' })]),
      el('button', { class: 'btn primary', type: 'submit', disabled: !me.can.includes('submit') || current?.state === 'Approved', text: current?.state === 'Submitted' ? 'Resubmit' : 'Submit for approval' }),
    ]);
    const decide = (action) => {
      if (!current) return;
      if (current.maker === me.name) { alert('Four-eyes rule: the economist who submitted the call cannot approve or return it.'); return; }
      const reason = host.querySelector('[name="reason"]').value.trim();
      if (action === 'return' && !reason) { alert('Give a reason for returning the call.'); return; }
      const before = current.state;
      current.state = action === 'approve' ? 'Approved' : 'Returned';
      record(current.id, action, before, current.state, reason || 'Approved');
      save(state); render();
    };
    host.replaceChildren(
      el('div', { class: 'wf-head' }, [
        el('p', { class: 'sim', text: 'Simulated workflow: calls and the audit trail are kept in this browser only (no warehouse writeback). Evidence is read from the governed layer when a call is submitted.' }),
        el('label', { class: 'acting' }, [el('span', { text: 'Acting as' }), actingAs]),
        el('button', { class: 'btn', text: 'Reset demo', onclick: () => { state = seed(); save(state); render(); } }),
      ]),
      el('div', { class: 'wf-grid' }, [
        el('section', { class: 'card wf' }, [el('h2', { text: `This month: ${RELEASE}` }), el('p', { class: 'state', text: `Status: ${current?.state ?? 'Not drafted'}` }), form]),
        el('section', { class: 'card wf' }, [
          el('h2', { text: 'Approval' }),
          current ? el('div', { class: 'proposal' }, [el('p', {}, [el('b', { text: current.call }), document.createTextNode(` — ${current.rationale}`)]), el('p', { text: `Hiring: ${current.hiring}` }), el('p', { text: `Pay: ${current.pay}` }), el('p', { class: 'muted', text: `Submitted by ${current.maker}` })]) : el('p', { class: 'muted', text: 'Nothing submitted yet.' }),
          el('input', { name: 'reason', placeholder: 'Reason (required to return)', 'aria-label': 'Reason' }),
          el('div', { class: 'actions' }, [
            el('button', { class: 'btn primary', disabled: !(me.can.includes('approve') && current?.state === 'Submitted'), text: 'Approve', onclick: () => decide('approve') }),
            el('button', { class: 'btn', disabled: !(me.can.includes('return') && current?.state === 'Submitted'), text: 'Return', onclick: () => decide('return') }),
          ]),
          el('h2', { text: 'Previous calls' }),
          el('ul', { class: 'history' }, state.calls.filter((c) => c.release !== RELEASE).map((c) => el('li', { text: `${c.release}: ${c.call} (${c.state})` }))),
        ]),
        el('section', { class: 'card wf audit' }, [el('h2', { text: 'Audit trail' }), el('ol', { class: 'audit-list' }, [...state.audit].reverse().map((a) => el('li', {}, [el('b', { text: `${a.who} (${a.role})` }), document.createTextNode(` ${a.action} ${a.id}: ${a.from} → ${a.to}. ${a.reason}`), el('time', { text: new Date(a.at).toLocaleString('en-GB') })])))]),
      ]),
    );
  };
  render();
};
