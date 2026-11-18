/**
 * Next season's marketing plan: the decision this app exists for, with a maker–checker approval.
 * (Skeleton adapted from the league-table-planner example focus plan.)
 *
 * Record: one plan for season 2026/27 — up to 3 focus resorts, a focus stage of the season, the
 * budget and campaign rule from the what-if levers, and a rationale.
 * States: Draft → Proposed → Approved | Returned (→ edited and proposed again).
 * Roles: Head of Resort Operations and the Marketing Lead may propose; the Commercial Director
 * approves or returns. Nobody can decide on a plan they proposed (four-eyes).
 *
 * Storage: BROWSER-ONLY SIMULATION in localStorage. Creating tables in Snowflake was out of scope
 * (no writeback table exists), so the plan and its audit trail live in this browser and say so.
 */
export const STAGES = ['1 Early season', '2 Peak winter', '3 Mid winter', '4 Spring'];
export const PEOPLE = [
  { id: 'ops', name: 'Head of Resort Operations', role: 'proposer' },
  { id: 'mkt', name: 'Marketing Lead', role: 'proposer' },
  { id: 'cd', name: 'Commercial Director', role: 'approver' },
];
const KEY = 'snowline-plan-2026-27-v1';
const blank = () => ({ season: '2026/27', status: 'Draft', resorts: [], stage: '', levers: null, rationale: '', proposer: null, events: [] });
const load = () => { try { return JSON.parse(localStorage.getItem(KEY) ?? 'null') ?? blank(); } catch { return blank(); } };
const save = (plan) => { try { localStorage.setItem(KEY, JSON.stringify(plan)); } catch { /* per-viewer only */ } };

export const createWorkflow = ({ el, resorts, levers, describeLevers }) => {
  let plan = load();
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
    const resortBoxes = el('fieldset', { class: 'plan__resorts', disabled }, [
      el('legend', { text: 'Focus resorts (up to 3)' }),
      ...resorts.map((r) => el('label', { class: 'check' }, [
        el('input', { type: 'checkbox', value: r, checked: plan.resorts.includes(r), onchange: (e) => {
          const on = e.target.checked;
          if (on && plan.resorts.length >= 3) { e.target.checked = false; msg.textContent = 'Pick at most three resorts: a plan that pushes everything pushes nothing.'; return; }
          plan.resorts = on ? [...plan.resorts, r] : plan.resorts.filter((x) => x !== r); save(plan); render();
        } }), r,
      ])),
    ]);
    const stage = el('select', { disabled, 'aria-label': 'Focus stage', onchange: (e) => { plan.stage = e.target.value; save(plan); } },
      [el('option', { value: '', text: 'Choose a stage…' }), ...STAGES.map((s) => el('option', { value: s, text: s, selected: plan.stage === s }))]);
    const rationale = el('textarea', { rows: 3, disabled, placeholder: 'Why these resorts and this part of the season?', 'aria-label': 'Rationale' });
    rationale.value = plan.rationale;
    rationale.addEventListener('input', () => { plan.rationale = rationale.value; save(plan); });

    const actions = [];
    if (who().role === 'proposer' && ['Draft', 'Returned'].includes(plan.status)) actions.push(el('button', { type: 'submit', class: 'btn', text: 'Propose to the Commercial Director' }));
    if (who().role === 'approver' && plan.status === 'Proposed') {
      actions.push(el('button', { type: 'button', class: 'btn', text: 'Approve plan', onclick: () => decide('Approved') }));
      actions.push(el('button', { type: 'button', class: 'btn btn--ghost', text: 'Return for changes', onclick: () => decide('Returned') }));
    }
    if (who().role === 'proposer' && plan.status === 'Proposed') actions.push(el('span', { class: 'muted', text: 'Awaiting the Commercial Director. Switch "Acting as" to decide.' }));

    const form = el('form', { class: 'plan__form', onsubmit: (e) => { e.preventDefault(); propose(); } }, [
      resortBoxes,
      el('label', { class: 'plan__row' }, [el('span', { class: 'plan__label', text: 'Focus stage' }), stage]),
      el('p', { class: 'plan__levers', text: `Budget and rule: ${plan.levers && plan.status !== 'Draft' ? plan.levers : describeLevers()}` }),
      el('label', { class: 'plan__label', text: 'Rationale' }), rationale,
      el('div', { class: 'row' }, actions),
    ]);
    host.replaceChildren(
      el('div', { class: 'plan__head' }, [
        el('span', { class: `status status--${plan.status.toLowerCase()}`, text: plan.status }),
        el('label', { class: 'acting' }, ['Acting as ', el('select', { onchange: (e) => { actor = e.target.value; msg.textContent = ''; render(); } }, PEOPLE.map((p) => el('option', { value: p.id, text: p.name, selected: p.id === actor })))]),
        el('button', { type: 'button', class: 'link', text: 'Reset plan', onclick: () => { plan = blank(); save(plan); msg.textContent = 'Plan reset to an empty draft.'; render(); } }),
      ]),
      form, msg,
      el('h4', { class: 'plan__sub', text: 'Audit trail' }), audit,
      el('p', { class: 'fine', text: 'Simulated workflow, stored in this browser only: no writeback table exists in Snowflake and none was created. Other viewers do not see this plan.' }),
    );
    audit.replaceChildren(...(plan.events.length ? [...plan.events].reverse().map((e) => el('li', {}, [
      el('b', { text: `${e.before} → ${e.after}` }), ` · ${e.action} by ${e.by} · ${new Date(e.at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}`, e.note ? el('div', { class: 'muted', text: `“${e.note}”` }) : null,
    ])) : [el('li', { class: 'muted', text: 'No actions yet.' })]));
  };

  const propose = () => {
    if (plan.resorts.length === 0 || !plan.stage || plan.rationale.trim().length < 10) { msg.textContent = 'A proposal needs at least one resort, a stage and a rationale of a sentence or more.'; return; }
    const before = plan.status;
    plan.status = 'Proposed'; plan.proposer = actor; plan.levers = describeLevers();
    log('Proposed', before, `${plan.resorts.join(', ')} · ${plan.stage} · ${plan.levers}. ${plan.rationale.trim()}`);
    msg.textContent = 'Proposed. The Commercial Director can now approve or return it.';
    render();
  };
  const decide = (outcome) => {
    if (plan.proposer === actor) { msg.textContent = 'Four-eyes rule: you cannot decide on a plan you proposed.'; return; }
    if (who().role !== 'approver') { msg.textContent = 'Only the Commercial Director can approve or return a plan.'; return; }
    const before = plan.status;
    plan.status = outcome;
    log(outcome, before, outcome === 'Approved' ? 'Approved for the 2026/27 marketing plan.' : 'Returned: revisit the resorts or the stage.');
    msg.textContent = outcome === 'Approved' ? 'Approved. Reset to start a new plan.' : 'Returned to the proposer for changes.';
    render();
  };

  render();
  return {
    host, render,
    plan: () => plan,
    setActor: (id) => { actor = id; render(); },
    propose, decide,
    setPlan: (p) => { plan = { ...plan, ...p }; save(plan); render(); },
    reset: () => { plan = blank(); save(plan); render(); },
  };
};
