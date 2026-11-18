/**
 * The focus plan: the decision this app exists for, with a maker–checker approval.
 *
 * Record: one plan for the chosen university — up to 3 focus measures, up to 6 rival
 * universities to benchmark against, and a rationale.
 * States: Draft → Proposed → Approved | Returned (→ Draft again).
 * Roles: Director of Strategy and Deputy Director may propose; the Vice-Chancellor approves
 * or returns. Nobody can approve a plan they proposed (four-eyes).
 *
 * Storage: BROWSER-ONLY SIMULATION in localStorage. The brief allows no new warehouse table
 * (writeback), so the plan and its audit trail live in this browser and say so on screen.
 */
export const MEASURES = [
  ['research', 'Research quality'], ['entry', 'Entry standards'], ['prospects', 'Graduate prospects'], ['experience', 'Student experience'],
  ['teaching', 'Teaching quality'], ['firsts', 'Firsts / 2:1s'], ['continuation', 'Continuation'],
];
export const PEOPLE = [
  { id: 'dos', name: 'Director of Strategy', role: 'proposer' },
  { id: 'dd', name: 'Deputy Director, Planning', role: 'proposer' },
  { id: 'vc', name: 'Vice-Chancellor', role: 'approver' },
];
const KEY = 'climb-planner-plan-v1';
const blank = (uni) => ({ uni, status: 'Draft', measures: [], rivals: [], rationale: '', proposer: null, events: [] });

const load = (uni) => {
  try { const all = JSON.parse(localStorage.getItem(KEY) ?? '{}'); return all[uni] ?? blank(uni); } catch { return blank(uni); }
};
const save = (plan) => {
  try { const all = JSON.parse(localStorage.getItem(KEY) ?? '{}'); all[plan.uni] = plan; localStorage.setItem(KEY, JSON.stringify(all)); } catch { /* per-viewer only */ }
};

export const createWorkflow = ({ el, us, universities, onRivals }) => {
  let plan = load(us);
  let actor = PEOPLE[0].id;
  const who = () => PEOPLE.find((p) => p.id === actor);
  const host = el('div', { class: 'plan' });
  const audit = el('ol', { class: 'audit' });
  const msg = el('p', { class: 'plan__msg', role: 'status' });

  const log = (action, before, note) => {
    plan.events.push({ at: new Date().toISOString(), by: who().name, role: who().role, action, before, after: plan.status, note: note ?? '' });
    save(plan);
  };
  const editable = () => ['Draft', 'Returned'].includes(plan.status) && who().role === 'proposer';

  const render = () => {
    const disabled = !editable();
    const measureBoxes = el('fieldset', { class: 'plan__measures', disabled }, [
      el('legend', { text: 'Focus measures (up to 3)' }),
      ...MEASURES.map(([k, label]) => el('label', { class: 'check' }, [
        el('input', { type: 'checkbox', value: k, checked: plan.measures.includes(k), onchange: (e) => {
          const on = e.target.checked;
          if (on && plan.measures.length >= 3) { e.target.checked = false; msg.textContent = 'Pick at most three measures: a plan that focuses on everything focuses on nothing.'; return; }
          plan.measures = on ? [...plan.measures, k] : plan.measures.filter((x) => x !== k); save(plan); render();
        } }), label,
      ])),
    ]);
    const rivalInput = el('input', { list: 'uni-list', placeholder: 'Add a rival university…', disabled, 'aria-label': 'Add a rival university' });
    const addRival = () => {
      const v = rivalInput.value.trim();
      if (!universities.includes(v) || v === us || plan.rivals.includes(v)) { msg.textContent = v ? `"${v}" is not a university in the 2027 table, or is already listed.` : ''; return; }
      if (plan.rivals.length >= 6) { msg.textContent = 'Benchmark against at most six rivals.'; return; }
      plan.rivals = [...plan.rivals, v]; save(plan); onRivals(plan.rivals); render();
    };
    const rivals = el('div', { class: 'plan__rivals' }, [
      el('span', { class: 'plan__label', text: 'Rivals to benchmark (up to 6)' }),
      el('div', { class: 'chips' }, plan.rivals.length ? plan.rivals.map((r) => el('span', { class: 'chip' }, [r, disabled ? null : el('button', { type: 'button', class: 'chip__x', 'aria-label': `Remove ${r}`, text: '×', onclick: () => { plan.rivals = plan.rivals.filter((x) => x !== r); save(plan); onRivals(plan.rivals); render(); } })])) : [el('span', { class: 'muted', text: 'None yet — add from the list.' })]),
      el('div', { class: 'row' }, [rivalInput, el('button', { type: 'button', class: 'btn btn--ghost', disabled, text: 'Add', onclick: addRival })]),
    ]);
    const rationale = el('textarea', { rows: 3, disabled, placeholder: 'Why these measures and these rivals?', 'aria-label': 'Rationale' });
    rationale.value = plan.rationale;
    rationale.addEventListener('input', () => { plan.rationale = rationale.value; save(plan); });

    const actions = [];
    if (who().role === 'proposer' && ['Draft', 'Returned'].includes(plan.status)) actions.push(el('button', { type: 'submit', class: 'btn', text: 'Propose to the Vice-Chancellor' }));
    if (who().role === 'approver' && plan.status === 'Proposed') {
      actions.push(el('button', { type: 'button', class: 'btn', text: 'Approve plan', onclick: () => decide('Approved') }));
      actions.push(el('button', { type: 'button', class: 'btn btn--ghost', text: 'Return for changes', onclick: () => decide('Returned') }));
    }
    if (who().role === 'proposer' && plan.status === 'Proposed') actions.push(el('span', { class: 'muted', text: 'Awaiting the Vice-Chancellor. Switch "Acting as" to decide.' }));

    const form = el('form', { class: 'plan__form', onsubmit: (e) => { e.preventDefault(); propose(); } }, [measureBoxes, rivals, el('label', { class: 'plan__label', text: 'Rationale' }), rationale, el('div', { class: 'row' }, actions)]);
    host.replaceChildren(
      el('div', { class: 'plan__head' }, [
        el('span', { class: `status status--${plan.status.toLowerCase()}`, text: plan.status }),
        el('label', { class: 'acting' }, ['Acting as ', el('select', { onchange: (e) => { actor = e.target.value; msg.textContent = ''; render(); } }, PEOPLE.map((p) => el('option', { value: p.id, text: p.name, selected: p.id === actor })))]),
        el('button', { type: 'button', class: 'link', text: 'Reset plan', onclick: () => { plan = blank(us); save(plan); onRivals([]); msg.textContent = 'Plan reset to an empty draft.'; render(); } }),
      ]),
      form, msg,
      el('h4', { class: 'plan__sub', text: 'Audit trail' }), audit,
      el('p', { class: 'fine', text: 'Stored in this browser only (simulated workflow): the layer has no writeback table and none may be created. Other viewers do not see this plan.' }),
    );
    audit.replaceChildren(...(plan.events.length ? [...plan.events].reverse().map((e) => el('li', {}, [
      el('b', { text: `${e.before} → ${e.after}` }), ` · ${e.action} by ${e.by} (${e.role}) · ${new Date(e.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`, e.note ? el('div', { class: 'muted', text: `“${e.note}”` }) : null,
    ])) : [el('li', { class: 'muted', text: 'No actions yet.' })]));
  };

  const propose = () => {
    if (plan.measures.length === 0 || plan.rivals.length === 0 || plan.rationale.trim().length < 10) { msg.textContent = 'A proposal needs at least one measure, one rival and a rationale of a sentence or more.'; return; }
    const before = plan.status;
    plan.status = 'Proposed'; plan.proposer = actor;
    log('Proposed', before, plan.rationale.trim());
    msg.textContent = 'Proposed. The Vice-Chancellor can now approve or return it.';
    render();
  };
  const decide = (outcome) => {
    if (plan.proposer === actor) { msg.textContent = 'Four-eyes rule: you cannot decide on a plan you proposed.'; return; }
    const note = outcome === 'Returned' ? (window.__planNote ?? 'Please revisit the rival list.') : 'Approved for the 2028 planning round.';
    const before = plan.status;
    plan.status = outcome;
    log(outcome === 'Approved' ? 'Approved' : 'Returned', before, note);
    msg.textContent = outcome === 'Approved' ? 'Approved. The plan is locked; reset to start next year.' : 'Returned to the proposer for changes.';
    render();
  };

  render();
  return {
    host,
    plan: () => plan,
    setActor: (id) => { actor = id; render(); },
    propose, decide, reset: () => { plan = blank(us); save(plan); onRivals([]); render(); },
    setPlan: (p) => { plan = { ...plan, ...p }; save(plan); onRivals(plan.rivals); render(); },
  };
};
