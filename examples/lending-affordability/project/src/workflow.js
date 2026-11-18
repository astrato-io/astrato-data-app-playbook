/**
 * Decision workflow: applicant board, applicant file, proposal → approval.
 *
 * The seeded state (stage, proposal, underwriter, audit trail) comes from the
 * semantic layer. Actions taken on this page are a maker–checker workflow kept in
 * the browser (localStorage), layered over the seeded state: an underwriter drafts
 * a proposal, a credit approver with a large enough mandate approves, rejects or
 * returns it, and nobody may approve a proposal they drafted.
 */

const STORE = 'lending-affordability-workflow-v1';
const load = () => {
  try { return JSON.parse(localStorage.getItem(STORE) ?? '{}'); } catch { return {}; }
};
const save = (state) => {
  try { localStorage.setItem(STORE, JSON.stringify(state)); } catch { /* private window: session only */ }
};

export const PEOPLE = [
  { name: 'Priya Shah', role: 'Underwriter', mandate: 0 },
  { name: 'Tom Mackenzie', role: 'Underwriter', mandate: 0 },
  { name: 'Fiona Grant', role: 'Credit approver', mandate: 350000 },
  { name: 'David Chen', role: 'Credit approver', mandate: 350000 },
  { name: 'Sarah Whitfield', role: 'Senior credit approver', mandate: 2000000 },
];

const gbp = (v) => (v == null || Number.isNaN(v) ? '–' : `£${Math.round(v).toLocaleString('en-GB')}`);
const pct = (v) => (v == null || Number.isNaN(v) ? '–' : `${(v * 100).toFixed(1)}%`);
const day = (ms) => (ms ? new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/**
 * Affordability checks of one applicant against the thresholds in view. The ratios and the
 * disposable income are the stored per-application columns (computed in Snowflake, read through
 * the layer); the app only compares them with the slider values. Nothing is recalculated here.
 */
export const assess = (a, policy) => {
  const disposable = policy.stress ? a.stressedDisposable : a.disposable;
  const checks = [
    { key: 'dti', label: 'Debt-to-income', value: pct(a.dti), limit: `≤ ${pct(policy.dti)}`, ok: a.dti <= policy.dti },
    { key: 'disp', label: policy.stress ? 'Disposable after stressed repayment' : 'Disposable after repayment', value: gbp(disposable), limit: `≥ ${gbp(policy.disp)}`, ok: disposable >= policy.disp },
    { key: 'score', label: 'Credit score', value: String(a.score), limit: `≥ ${policy.score}`, ok: a.score >= policy.score },
    { key: 'exp', label: 'Expenses ÷ income', value: pct(a.expRatio), limit: `≤ ${pct(policy.exp)}`, ok: a.expRatio <= policy.exp },
  ];
  const fails = checks.filter((c) => !c.ok).length;
  return { checks, fails, disposable, result: fails === 0 ? 'Pass' : fails === 1 ? 'Marginal' : 'Fail', recommend: fails === 0 ? 'Approve' : fails === 1 ? 'Counter-offer' : 'Decline' };
};

export const createWorkflow = ({ el, rows, policy, loadEvents, onChange }) => {
  let state = load();
  const byId = new Map(rows.map((r) => [r.id, r]));
  let actor = PEOPLE[0];

  const current = (a) => {
    const s = state[a.id];
    return {
      stage: s?.stage ?? a.stage,
      proposal: s?.proposal ?? a.proposal,
      proposer: s?.proposer ?? a.underwriter,
      note: s?.note,
      counterAmount: s?.counterAmount,
      decision: s?.decision,
      events: s?.events ?? [],
    };
  };
  const record = (id, patch, event) => {
    const prev = state[id] ?? { events: [] };
    state = { ...state, [id]: { ...prev, ...patch, events: [...(prev.events ?? []), { ...event, at: Date.now(), actor: actor.name, role: actor.role }] } };
    save(state);
    render();
    onChange?.();
  };

  // ------------------------------------------------------------------ board
  const COLUMNS = [
    ['Affordability Check', 'Affordability check', 'Underwriter drafts a proposal'],
    ['Awaiting Approval', 'Awaiting approval', 'Credit approver signs off'],
    ['Decided', 'Decided on this page', 'Approved, declined or returned'],
  ];
  const actorSelect = el('select', { class: 'actor', 'aria-label': 'Acting as', onchange: (e) => { actor = PEOPLE[Number(e.target.value)]; render(); } },
    PEOPLE.map((p, i) => el('option', { value: String(i), text: `${p.name} · ${p.role}` })));
  const search = el('input', { type: 'search', class: 'wf-search', placeholder: 'Find applicant (AP-…)', oninput: () => render() });
  const onlyMine = el('input', { type: 'checkbox', onchange: () => render() });
  const resetBtn = el('button', { type: 'button', class: 'link', text: 'Reset demo actions', onclick: () => { state = {}; save(state); render(); onChange?.(); } });
  const board = el('div', { class: 'board' });
  const summary = el('p', { class: 'wf-summary' });

  const card = (a) => {
    const c = current(a);
    const live = assess(a, policy());
    return el('button', { type: 'button', class: `card card--${live.result.toLowerCase()}`, onclick: () => openFile(a.id) }, [
      el('span', { class: 'card__top' }, [el('b', { text: a.id }), el('span', { class: `badge badge--${live.result.toLowerCase()}`, text: live.result })]),
      el('span', { class: 'card__line', text: `${a.product} · ${gbp(a.amount)}` }),
      el('span', { class: 'card__meta', text: `${a.region} · income ${gbp(a.income)}/m · ${a.daysOpen ?? 0}d open` }),
      c.proposal ? el('span', { class: 'card__prop', text: `${c.proposal}${c.decision ? ` → ${c.decision}` : ''} · ${c.proposer}` }) : el('span', { class: 'card__prop card__prop--none', text: `Suggested: ${live.recommend}` }),
    ]);
  };

  const render = () => {
    const needle = search.value.trim().toUpperCase();
    const open = rows.filter((a) => a.stage !== 'Decided' || state[a.id]);
    const cols = Object.fromEntries(COLUMNS.map(([k]) => [k, []]));
    for (const a of open) {
      if (needle && !a.id.includes(needle)) continue;
      const c = current(a);
      if (onlyMine.checked && !(actor.role === 'Underwriter' ? c.stage === 'Affordability Check' : c.stage === 'Awaiting Approval' && c.proposer !== actor.name)) continue;
      cols[c.stage]?.push(a);
    }
    for (const list of Object.values(cols)) list.sort((x, y) => (y.daysOpen ?? 0) - (x.daysOpen ?? 0));
    board.replaceChildren(...COLUMNS.map(([k, label, sub]) => el('section', { class: 'lane' }, [
      el('header', { class: 'lane__head' }, [el('h3', { text: label }), el('span', { class: 'lane__count', text: String(cols[k].length) }), el('p', { text: sub })]),
      el('div', { class: 'lane__cards' }, cols[k].length ? cols[k].slice(0, 60).map(card) : [el('p', { class: 'lane__empty', text: 'Nothing here.' })]),
    ])));
    const acted = Object.values(state).filter((s) => s.events?.length).length;
    summary.textContent = `${cols['Affordability Check'].length} awaiting a proposal · ${cols['Awaiting Approval'].length} awaiting approval · ${acted} applications actioned on this page (kept in this browser).`;
  };

  // ------------------------------------------------------------------ applicant file
  const openFile = async (id) => {
    const a = byId.get(id);
    const c = current(a);
    const live = assess(a, policy());
    const outgoings = [['Housing', a.housing], ['Groceries', a.groceries], ['Utilities & council tax', a.utilities], ['Transport', a.transport], ['Childcare', a.childcare], ['Discretionary', a.discretionary], ['Existing credit', a.debt], [policy().stress ? 'New repayment (stressed +3%)' : 'New repayment', policy().stress ? a.stressed : a.repayment]];
    const max = a.income;
    const trail = el('ol', { class: 'trail' }, [el('li', { class: 'trail__loading', text: 'Loading audit trail…' })]);
    const actions = el('div', { class: 'actions' });
    const dialog = el('dialog', { class: 'file' }, [
      el('header', { class: 'file__head' }, [
        el('div', {}, [el('h3', { text: `${a.id} · ${a.product}` }), el('p', { text: `${a.region} · ${a.employment} · age ${a.age} · household ${a.household} · ${a.channel} · applied ${day(a.date)}` })]),
        el('button', { type: 'button', class: 'file__close', 'aria-label': 'Close', text: '×', onclick: () => dialog.close() }),
      ]),
      el('div', { class: 'file__grid' }, [
        el('section', {}, [
          el('h4', { text: 'Request' }),
          el('dl', { class: 'facts' }, [
            ['Amount', gbp(a.amount)], ['Term', `${a.term} months`], ['APR', `${a.apr.toFixed(2)}%`], ['Monthly repayment', gbp(a.repayment)], ['Stressed (+3%)', gbp(a.stressed)], ['Credit score', `${a.score} (${a.creditBand})`],
          ].flatMap(([k, v]) => [el('dt', { text: k }), el('dd', { text: v })])),
          el('h4', { text: `Monthly budget · net income ${gbp(a.income)}` }),
          el('ul', { class: 'budget' }, outgoings.map(([k, v]) => el('li', {}, [el('span', { text: k }), el('i', { style: { '--w': `${Math.min(100, (v / max) * 100)}%` } }), el('b', { text: gbp(v) })]))),
          el('p', { class: `leftover ${live.disposable < 0 ? 'neg' : ''}`, text: `Left over each month: ${gbp(live.disposable)}` }),
        ]),
        el('section', {}, [
          el('h4', { text: 'Affordability against the thresholds in view' }),
          el('table', { class: 'checks' }, [
            el('tr', {}, ['Check', 'Applicant', 'Policy', ''].map((t) => el('th', { text: t }))),
            ...live.checks.map((k) => el('tr', { class: k.ok ? 'ok' : 'bad' }, [el('td', { text: k.label }), el('td', { text: k.value }), el('td', { text: k.limit }), el('td', { text: k.ok ? '✓' : '✗' })])),
          ]),
          el('p', { class: 'reco' }, [el('span', { class: `badge badge--${live.result.toLowerCase()}`, text: live.result }), ` Decision engine suggests `, el('b', { text: live.recommend }), '.']),
          el('h4', { text: 'Workflow' }),
          el('p', { class: 'stage', text: `Stage: ${c.stage}${c.proposal ? ` · proposal ${c.proposal} by ${c.proposer}` : ''}${c.note ? ` — “${c.note}”` : ''}${c.decision ? ` · decision ${c.decision}` : ''}` }),
          actions,
          el('h4', { text: 'Audit trail' }),
          trail,
        ]),
      ]),
    ]);
    dialog.addEventListener('close', () => dialog.remove());
    document.body.append(dialog);
    dialog.showModal();

    // actions for the current actor
    const note = el('textarea', { rows: 2, placeholder: 'Rationale (required)' });
    const done = (patch, event) => { if (!note.value.trim()) { note.focus(); note.classList.add('need'); return; } record(a.id, { ...patch, note: note.value.trim() }, { ...event, note: note.value.trim() }); dialog.close(); };
    if (c.stage === 'Affordability Check') {
      if (actor.role !== 'Underwriter') actions.append(el('p', { class: 'hint', text: `Waiting for an underwriter's proposal. Switch “Acting as” to an underwriter to draft one.` }));
      else {
        const counter = el('input', { type: 'number', step: '500', value: String(Math.round(a.amount * 0.75 / 500) * 500), class: 'counter' });
        actions.append(note, el('div', { class: 'btns' }, [
          ...['Approve', 'Decline', 'Refer'].map((p) => el('button', { type: 'button', class: `btn btn--${p.toLowerCase()}${p === live.recommend ? ' btn--reco' : ''}`, text: `Propose ${p.toLowerCase()}`, onclick: () => done({ stage: 'Awaiting Approval', proposal: p, proposer: actor.name }, { step: 'Proposal', action: `Proposed: ${p}` }) })),
          el('span', { class: 'counter-wrap' }, [
            el('button', { type: 'button', class: `btn btn--counter${live.recommend === 'Counter-offer' ? ' btn--reco' : ''}`, text: 'Propose counter-offer £', onclick: () => done({ stage: 'Awaiting Approval', proposal: 'Counter-offer', proposer: actor.name, counterAmount: Number(counter.value) }, { step: 'Proposal', action: `Proposed: Counter-offer ${gbp(Number(counter.value))}` }) }),
            counter,
          ]),
        ]));
      }
    } else if (c.stage === 'Awaiting Approval') {
      const amount = c.proposal === 'Counter-offer' ? (c.counterAmount ?? a.amount * 0.75) : a.amount;
      if (actor.role === 'Underwriter') actions.append(el('p', { class: 'hint', text: 'Awaiting a credit approver. Switch “Acting as” to an approver.' }));
      else if (actor.name === c.proposer) actions.append(el('p', { class: 'hint warn', text: 'Four-eyes rule: you drafted this proposal, so another approver must sign it off.' }));
      else if (amount > actor.mandate && c.proposal !== 'Decline') actions.append(el('p', { class: 'hint warn', text: `${gbp(amount)} exceeds your ${gbp(actor.mandate)} mandate — escalate to a senior credit approver.` }), el('div', { class: 'btns' }, [el('button', { type: 'button', class: 'btn', text: 'Escalate', onclick: () => record(a.id, {}, { step: 'Escalation', action: `Escalated: over ${gbp(actor.mandate)} mandate` }) })]));
      else {
        const outcome = c.proposal === 'Decline' ? 'Declined' : c.proposal === 'Counter-offer' ? `Approved (reduced to ${gbp(amount)})` : c.proposal === 'Refer' ? 'Referred to committee' : 'Approved';
        actions.append(note, el('div', { class: 'btns' }, [
          el('button', { type: 'button', class: 'btn btn--approve btn--reco', text: `Approve proposal (${c.proposal})`, onclick: () => done({ stage: 'Decided', decision: outcome }, { step: 'Decision', action: outcome }) }),
          el('button', { type: 'button', class: 'btn btn--decline', text: 'Reject proposal', onclick: () => done({ stage: 'Decided', decision: c.proposal === 'Decline' ? 'Approved (override)' : 'Declined (override)' }, { step: 'Decision', action: 'Proposal rejected' }) }),
          el('button', { type: 'button', class: 'btn', text: 'Return to underwriter', onclick: () => done({ stage: 'Affordability Check', proposal: null, proposer: null }, { step: 'Returned', action: 'Returned for more information' }) }),
        ]));
      }
    } else actions.append(el('p', { class: 'hint', text: `Decided: ${c.decision ?? 'see audit trail'}.` }));

    const seeded = await loadEvents(a.id).catch(() => []);
    trail.replaceChildren(
      ...seeded.map((e) => el('li', {}, [el('b', { text: e.step }), ` ${e.action}`, el('span', { text: ` · ${e.actor} (${e.role}) · ${day(e.date)}` })])),
      ...c.events.map((e) => el('li', { class: 'trail__new' }, [el('b', { text: e.step }), ` ${e.action}`, e.note ? ` — “${e.note}”` : '', el('span', { text: ` · ${e.actor} (${e.role}) · ${new Date(e.at).toLocaleString('en-GB')}` })])),
    );
  };

  render();
  return {
    toolbar: el('div', { class: 'wf-bar' }, [el('label', { class: 'wf-actor' }, [el('span', { text: 'Acting as' }), actorSelect]), search, el('label', { class: 'wf-mine' }, [onlyMine, ' My queue only']), resetBtn]),
    summary, board, render, openFile, state: () => state,
  };
};
