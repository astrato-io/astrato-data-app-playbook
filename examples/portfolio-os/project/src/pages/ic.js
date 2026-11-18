/** Investment Committee — decision packages, committee workflow and decisions that change state across the system. */
import { el, esc, icon, money, smoney, pct, spct, pts, mult, tone, me, can, denied, saveRecord, records, record, onStore, openDrawer, ask, pill, eventsFor, toast, writeTable } from '../core.js';
import { M, co, ltm, finAt, currentVal, returnsOf, scenarioBase, planOf, planDrivers, activePlan, valAt, LATEST } from '../data.js';
import { projectScenario } from '../engine.js';
import { adoptPlan } from './scenario.js';
import { sheet, btn, section, kv, stepper } from '../ui.js';

const TYPES = ['Quarterly valuation approval', 'Material forecast revision', 'Follow-on investment', 'Capital structure change', 'Exit recommendation', 'Value-creation plan approval'];
const FLOW = ['Draft', 'Submitted', 'Under Review', 'Approved'];
const APPROVALS = { 'Quarterly valuation approval': ['Valuation Committee', 'Investment Director'], 'Material forecast revision': ['Investment Director (IC chair)'], 'Follow-on investment': ['Investment Committee (quorum 3)', 'Investment Director'], 'Capital structure change': ['Investment Director', 'Fund CFO'], 'Exit recommendation': ['Investment Committee (quorum 3)'], 'Value-creation plan approval': ['Investment Director (IC chair)', 'Operating Partner'] };
const F = (name, valueType = 'string') => ({ name, valueType });

export const mountIC = (ctx, pane) => {
  const { go } = ctx;
  const list = el('div');
  const context = (name) => {
    const c = co(name), f = finAt(name, LATEST), cv = currentVal(name), r = returnsOf(name);
    const th = M.thesis.filter((t) => t.Company === name);
    return { invest: `${c.Fund} · entry ${String(c['Entry Date']).slice(0, 7)} at ${mult(c['Entry Multiple'])} · ${pct(c['Current Ownership'], 0)} ownership · invested ${money(r.invested, 0)}, realised ${money(r.realised, 0)}, fair value ${money(cv?.['Fair Value'] ?? 0, 0)} (${r.moic.toFixed(2)}x)`, perf: `LTM revenue ${money(ltm(name, 'Revenue'), 0)} (${spct(ltm(name, 'Revenue') / ltm(name, 'Revenue', '2025-Q3') - 1)}), EBITDA ${money(ltm(name, 'Ebitda'), 0)} at ${pct(ltm(name, 'Ebitda') / ltm(name, 'Revenue'))} (${pts(ltm(name, 'Ebitda') / ltm(name, 'Revenue') - ltm(name, 'Ebitda', '2025-Q3') / ltm(name, 'Revenue', '2025-Q3'))}), net leverage ${mult(f['Net Debt'] / ltm(name, 'Ebitda'))}, FCF conversion ${pct(ltm(name, 'Free Cash Flow') / ltm(name, 'Ebitda'), 0)}`, thesis: `${th.filter((t) => t.Status === 'On track').length} on track · ${th.filter((t) => t.Status === 'At risk').length} at risk · ${th.filter((t) => t.Status === 'Off track').length} off track (${th.filter((t) => t.Status !== 'On track').map((t) => t.Component).join(', ')})` };
  };

  // ---------------------------------------------------------------- create package
  const create = async (prefill = {}) => {
    if (!can('ic.create')) return denied('ic.create');
    const coSel = el('select', {}, M.companies.map((c) => el('option', { value: c.Company, text: c.Company, selected: c.Company === (prefill.company ?? 'Meridian Cloud Systems') })));
    const tSel = el('select', {}, TYPES.map((t) => el('option', { value: t, text: t, selected: t === (prefill.type ?? 'Material forecast revision') })));
    const proposal = el('textarea', { rows: 3 });
    const scnSel = el('select');
    const initBox = el('div', { class: 'checks' });
    const preview = el('div');
    const fill = () => {
      const n = coSel.value;
      const scns = records('Scenario', (r) => r.company === n);
      scnSel.replaceChildren(el('option', { value: '', text: 'No related scenario' }), ...scns.map((s) => el('option', { value: s.id, text: `${s.title} · ${s.status} · FV ${money(s.payload?.results?.fairValue ?? 0)}`, selected: s.id === prefill.scenarioId })));
      if (!scnSel.value && scns.length) scnSel.value = scns.at(-1).id;
      const inits = records('Initiative', (r) => r.company === n && ['Proposed', 'Under Review'].includes(r.status));
      initBox.replaceChildren(...(inits.length ? inits.map((i) => el('label', {}, [el('input', { type: 'checkbox', value: i.id, checked: true }), el('span', { text: `${i.title} · ${money(i.payload.est)} run-rate, cost ${money(i.payload.cost)}` })])) : [el('small', { class: 'muted', text: 'No proposed initiatives for this company.' })]));
      if (!proposal.value || proposal.dataset.auto) { const s = record(scnSel.value); proposal.value = tSel.value === 'Material forecast revision' || tSel.value === 'Value-creation plan approval' ? `Adopt "${s?.title ?? 'revised plan'}" as the operating plan for ${n}${inits.length ? ` with a ${inits.length}-initiative value-creation programme (${money(inits.reduce((t, i) => t + i.payload.est, 0))} run-rate EBITDA)` : ''}, and recognise the valuation scenario in the Q3 2026 review.` : `${tSel.value} for ${n}.`; proposal.dataset.auto = '1'; }
      renderPreview();
    };
    const renderPreview = () => {
      const n = coSel.value, cx = context(n), s = record(scnSel.value);
      const base = scenarioBase(n);
      const alt = ['Approved Forecast', 'Downside Case', 'Value Creation Case'].map((p) => [p, projectScenario(base, planDrivers(planOf(n, p)))]);
      preview.replaceChildren(
        section('Investment context', el('p', { text: cx.invest })), section('Current financial performance', el('p', { text: cx.perf })), section('Investment thesis status', el('p', { text: cx.thesis })),
        section('Alternative scenarios', sheet([{ key: 'k', label: 'Case' }, { key: 'fv', label: 'Fair value today', fmt: (v) => money(v) }, { key: 'd', label: 'vs approved', fmt: (v) => smoney(v), tone: (v) => tone(v) }, { key: 'moic', label: 'MOIC', fmt: (v) => `${v.toFixed(2)}x` }, { key: 'irr', label: 'IRR', fmt: pct }], [...alt.map(([k, x]) => ({ k, fv: x.today.fairValue, d: x.today.fairValue - base.approvedFV, moic: x.moic, irr: x.irr })), ...(s ? [{ k: `Proposed: ${s.title}`, fv: s.payload.results.fairValue, d: s.payload.results.fairValue - base.approvedFV, moic: s.payload.results.moic, irr: s.payload.results.irr, __cls: 'b' }] : [])])),
        section('Required approvals', el('p', { text: APPROVALS[tSel.value].join(' · ') })),
      );
    };
    coSel.onchange = () => { proposal.dataset.auto = '1'; fill(); }; tSel.onchange = () => { proposal.dataset.auto = '1'; fill(); }; scnSel.onchange = () => { proposal.dataset.auto = '1'; fill(); };
    proposal.oninput = () => { delete proposal.dataset.auto; };
    fill();
    openDrawer({ title: 'New investment committee package', kicker: 'Draft → Submitted → Under Review → Approved / Rejected / Returned', wide: true, body: [
      el('div', { class: 'fields' }, [el('label', { class: 'field' }, [el('span', { text: 'Company' }), coSel]), el('label', { class: 'field' }, [el('span', { text: 'Decision type' }), tSel]), el('label', { class: 'field wide' }, [el('span', { text: 'Related scenario' }), scnSel])]),
      el('label', { class: 'field wide' }, [el('span', { text: 'Proposed decision' }), proposal]), section('Value-creation initiatives in scope', initBox), preview,
    ], actions: [btn('Save draft', () => submit('Draft'), { kind: 'ghost' }), btn('Submit to committee', () => submit('Submitted'), { ic: 'send' })] });
    const submit = async (status) => {
      const n = coSel.value, s = record(scnSel.value), cx = context(n);
      const inits = [...initBox.querySelectorAll('input:checked')].map((i) => i.value);
      const base = scenarioBase(n);
      const rec = await saveRecord({ type: 'IC Package', prefix: 'IC', company: n, fund: co(n).Fund, period: '2026-Q3', title: `${tSel.value}: ${n}`, status, owner: me().name, payload: { type: tSel.value, proposal: proposal.value, context: cx, scenarioId: s?.id ?? null, initiatives: inits, impact: s ? { fairValue: s.payload.results.fairValue, delta: s.payload.results.fairValue - base.approvedFV, moic: s.payload.results.moic, irr: s.payload.results.irr } : null, risks: riskList(n), approvals: APPROVALS[tSel.value], evidence: [s ? `Scenario ${s.id}` : null, ...inits.map((i) => `Initiative ${i}`), `Valuation VAL-${co(n)['Company Id']}-${LATEST}`].filter(Boolean), submittedBy: me().name } }, { action: status === 'Submitted' ? 'Package submitted to committee' : 'Package drafted', next: status, reason: proposal.value });
      if (s && status === 'Submitted' && s.status === 'Saved') await saveRecord({ ...s, status: 'Submitted' }, { action: 'Scenario submitted with IC package', prev: 'Saved', next: 'Submitted', ref: rec.id });
      for (const id of inits) { const i = record(id); if (i && i.status === 'Proposed' && status === 'Submitted') await saveRecord({ ...i, status: 'Under Review' }, { action: 'Initiative under IC review', prev: 'Proposed', next: 'Under Review', ref: rec.id }); }
      openPackage(rec.id); render();
    };
  };
  const riskList = (n) => { const f = finAt(n, LATEST), lev = f['Net Debt'] / ltm(n, 'Ebitda'), cov = ltm(n, 'Ebitda') / ltm(n, 'Interest Expense'); return [`Net leverage ${mult(lev)} vs covenant ${mult(Math.max(...M.debt.filter((d) => d.Company === n).map((d) => d['Covenant Max Leverage'])))}`, `Interest cover ${mult(cov)}`, `EBITDA ${spct(ltm(n, 'Ebitda') / ltm(n, 'Uw Ebitda') - 1)} vs investment case`, 'Execution risk on value-creation programme']; };

  // ---------------------------------------------------------------- decide (effects across the system)
  const decide = async (rec, decision) => {
    if (!can('ic.decide')) return denied('ic.decide');
    if (rec.payload.submittedBy === me().name || rec.createdBy === me().name) { toast('Maker–checker: the author of a package cannot decide it. Switch to another Investment Director (e.g. Robert Hale, IC chair).', 'gpp_bad', 'warn'); return; }
    const rationale = await ask({ title: `${decision} · ${rec.title}`, text: decision === 'Approved' ? 'Approval takes effect immediately: plans, initiatives, valuations and actions are updated and audited.' : '', label: 'Decision rationale', confirmLabel: decision, danger: decision !== 'Approved' });
    if (!rationale) return;
    const conditions = decision === 'Approved' ? await ask({ title: 'Conditions and follow-up actions', text: 'One per line. Each becomes a tracked action.', label: 'Conditions', required: false, value: rec.type === 'Material forecast revision' || rec.payload.type === 'Material forecast revision' ? 'Monthly KPI reporting to the deal team until margin recovers\nRe-test covenant headroom at Q4 2026' : '', confirmLabel: 'Record decision' }) : '';
    if (conditions === null) return;
    const effects = [];
    const n = rec.company, p = rec.payload;
    if (decision === 'Approved') {
      const s = p.scenarioId ? record(p.scenarioId) : null;
      if (s && ['Material forecast revision', 'Value-creation plan approval'].includes(p.type)) {
        await saveRecord({ ...s, status: 'Approved' }, { action: 'Scenario approved by IC', prev: s.status, next: 'Approved', reason: rationale, ref: rec.id });
        const plan = await adoptPlan(ctx, n, s.payload.drivers, { scenarioId: s.id, ref: rec.id, reason: rationale });
        effects.push(`${plan.Plan} adopted as the official operating plan`);
      }
      for (const id of p.initiatives ?? []) { const i = record(id); if (i) { await saveRecord({ ...i, status: 'Approved' }, { action: 'Initiative approved by IC', prev: i.status, next: 'Approved', reason: rationale, ref: rec.id }); effects.push(`Initiative approved: ${i.title}`); } }
      if (p.type === 'Quarterly valuation approval') { const v = valAt(n, LATEST); await writeTable({ view: 'Valuations', operation: 'update', fields: [F('Status'), F('Approved By')], values: [['Approved', 'Investment Committee']], keys: { fields: [F('Company'), F('Quarter')], values: [[n, LATEST]] } }, ['Valuation', `VAL-${co(n)['Company Id']}-${LATEST}`, 'Valuation approved by IC', { prev: v.Status, next: 'Approved', reason: rationale, ref: rec.id }]); v.Status = 'Approved'; effects.push('Q3 2026 valuation approved (publish in the workbench to make it authoritative)'); }
      if (p.type === 'Exit recommendation') { await writeTable({ view: 'Companies', operation: 'update', fields: [F('Stage')], values: [['Exit preparation']], keys: { fields: [F('Company')], values: [[n]] } }, ['Company', co(n)['Company Id'], 'Stage changed by IC', { prev: co(n).Stage, next: 'Exit preparation', reason: rationale, ref: rec.id }]); co(n).Stage = 'Exit preparation'; effects.push('Investment stage set to Exit preparation'); }
      for (const line of String(conditions || '').split('\n').map((x) => x.trim()).filter(Boolean)) { await saveRecord({ type: 'Action', prefix: 'ACT', company: n, fund: co(n).Fund, period: '2026-Q3', title: line, status: 'Open', owner: co(n)['Deal Lead'], due: '2026-12-31', payload: { source: rec.id, condition: true } }, { action: 'IC condition → action', next: 'Open', reason: line, ref: rec.id }); effects.push(`Action: ${line}`); }
    }
    if (['Rejected', 'Returned'].includes(decision)) for (const id of p.initiatives ?? []) { const i = record(id); if (i && i.status === 'Under Review') await saveRecord({ ...i, status: decision === 'Rejected' ? 'Rejected' : 'Proposed' }, { action: `Initiative ${decision.toLowerCase()} with IC package`, prev: 'Under Review', next: decision === 'Rejected' ? 'Rejected' : 'Proposed', reason: rationale, ref: rec.id }); }
    await saveRecord({ ...rec, status: decision, payload: { ...p, decisionMaker: `${me().name} (${me().role})`, decisionDate: new Date().toISOString().slice(0, 10), rationale, conditions, effects } }, { action: `IC decision: ${decision}`, prev: rec.status, next: decision, reason: rationale, ref: rec.id });
    window.dispatchEvent(new Event('nsos-model'));
    ctx.refreshNative?.();
    openPackage(rec.id); render();
  };

  const openPackage = (id) => {
    const rec = record(id); if (!rec) return;
    const p = rec.payload ?? {};
    const s = p.scenarioId ? record(p.scenarioId) : null;
    const T = [];
    if (rec.status === 'Draft') T.push(btn('Submit to committee', async () => { await saveRecord({ ...rec, status: 'Submitted' }, { action: 'Package submitted', prev: 'Draft', next: 'Submitted' }); openPackage(id); render(); }, { ic: 'send' }));
    if (rec.status === 'Submitted') T.push(btn('Start review', async () => { if (!can('ic.decide')) return denied('ic.decide'); await saveRecord({ ...rec, status: 'Under Review' }, { action: 'Committee review started', prev: 'Submitted', next: 'Under Review' }); openPackage(id); render(); }, { kind: 'ghost' }));
    if (['Submitted', 'Under Review'].includes(rec.status)) T.push(btn('Approve', () => decide(rec, 'Approved'), { ic: 'verified' }), btn('Return', () => decide(rec, 'Returned'), { kind: 'ghost' }), btn('Reject', () => decide(rec, 'Rejected'), { kind: 'danger ghost' }));
    openDrawer({ title: rec.title, kicker: `${rec.id} · ${rec.company} · prepared by ${rec.createdBy ?? rec.owner}`, wide: true, body: [
      stepper(FLOW, ['Approved', 'Rejected', 'Returned'].includes(rec.status) ? 'Approved' : rec.status, { rejected: ['Rejected', 'Returned'].includes(rec.status) }),
      ['Approved', 'Rejected', 'Returned'].includes(rec.status) ? section(`Decision: ${rec.status}`, kv([['Decision maker', p.decisionMaker ?? '—'], ['Decision date', p.decisionDate ?? '—'], ['Rationale', p.rationale ?? '—'], ['Conditions', p.conditions || '—'], ['Resulting changes', el('ul', {}, (p.effects ?? []).map((e) => el('li', { text: e })))]])) : null,
      section('Proposed decision', el('p', { class: 'lead', text: p.proposal ?? '' })),
      p.context ? el('div', { class: 'cols3' }, [section('Investment context', el('p', { text: p.context.invest })), section('Current performance', el('p', { text: p.context.perf })), section('Thesis status', el('p', { text: p.context.thesis }))]) : null,
      s ? section(`Related scenario · ${s.title} (${s.status})`, [kv([['Description', s.payload.description], ['Created from', s.payload.from], ['Driver changes', Object.entries(s.payload.changes ?? {}).map(([k, v]) => `${k} ${Number(v).toFixed(2)}`).join(' · ') || '—'], ['Fair value today', `${money(s.payload.results.fairValue)} (${smoney(s.payload.results.fairValue - s.payload.approvedFV)} vs approved)`], ['Returns', `${s.payload.results.moic.toFixed(2)}x · ${pct(s.payload.results.irr)}`]]), btn('Open in Scenario Lab', () => go('scenario', { company: s.company, drivers: s.payload.drivers }), { kind: 'ghost sm', ic: 'science' })]) : null,
      p.impact ? section('Expected financial impact', el('p', { text: `Fair value ${money(p.impact.fairValue)} (${smoney(p.impact.delta)} vs approved) · MOIC ${p.impact.moic.toFixed(2)}x · IRR ${pct(p.impact.irr)}` })) : null,
      (p.initiatives ?? []).length ? section('Value-creation initiatives', sheet([{ key: 'title', label: 'Initiative' }, { key: 'status', label: 'Status', cls: '', fmt: (v) => pill(v) }, { key: 'est', label: 'Run-rate EBITDA', value: (r) => r.payload.est, fmt: (v) => money(v) }, { key: 'cost', label: 'Cost', value: (r) => r.payload.cost, fmt: (v) => money(v) }, { key: 'owner', label: 'Owner', cls: '' }], p.initiatives.map(record).filter(Boolean))) : null,
      section('Principal risks', el('ul', {}, (p.risks ?? []).map((r) => el('li', { text: r })))),
      el('div', { class: 'cols2' }, [section('Supporting evidence', el('ul', {}, (p.evidence ?? []).map((e) => el('li', { text: e })))), section('Required approvals', el('ul', {}, (p.approvals ?? APPROVALS[p.type] ?? []).map((a) => el('li', { text: a }))))]),
      section('Audit history', sheet([{ key: 'at', label: 'When' }, { key: 'actor', label: 'Who', cls: '' }, { key: 'role', label: 'Role', cls: '' }, { key: 'action', label: 'Action', cls: '' }, { key: 'next', label: 'Status', cls: '' }, { key: 'reason', label: 'Reason', cls: '' }], eventsFor(id))),
    ], actions: [...T, btn('Company', () => go('company', rec.company), { kind: 'ghost', ic: 'apartment' })] });
  };

  const render = () => {
    const recs = records('IC Package').sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    list.replaceChildren(el('div', { class: 'ic-lanes' }, [['Awaiting decision', (r) => ['Submitted', 'Under Review'].includes(r.status)], ['Drafts', (r) => r.status === 'Draft'], ['Decided', (r) => ['Approved', 'Rejected', 'Returned'].includes(r.status)]].map(([t, f]) => el('div', { class: 'lane' }, [el('header', {}, [el('b', { text: t }), el('span', { text: String(recs.filter(f).length) })]), ...recs.filter(f).map((r) => el('button', { class: 'tile', onclick: () => openPackage(r.id) }, [el('b', { text: r.title }), el('small', { text: `${r.id} · ${r.payload?.decisionMaker ?? r.owner} · ${r.updatedAt}` }), pill(r.status)]))]))));
  };

  pane.append(
    el('div', { class: 'page-head' }, [el('div', {}, [el('h2', { text: 'Investment Committee' }), el('p', { text: 'Decision packages assembled from governed data: context, performance, thesis, the proposed decision, alternative scenarios, impact, risks, evidence and required approvals. Decisions take effect across plans, initiatives, valuations and actions.' })]), el('div', { class: 'row-end' }, [btn('New package', () => create(), { ic: 'add' })])]),
    el('figure', { class: 'card full' }, [el('figcaption', { text: 'Committee workflow' }), list]),
  );
  onStore(() => { if (!pane.hidden) render(); });
  ctx.onShow('ic', (arg) => { render(); if (arg?.company) create({ company: arg.company, scenarioId: arg.scenarioId }); else if (typeof arg === 'string') { const r = records('IC Package', (x) => x.company === arg)[0]; if (r) openPackage(r.id); } });
  render();
};
