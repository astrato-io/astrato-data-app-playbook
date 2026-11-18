/** Value Creation — initiative workflow, impact modelling, actual vs expected value and the link back to thesis and valuation. */
import { el, esc, icon, money, smoney, pct, spct, mult, tone, N, me, can, denied, saveRecord, records, record, onStore, openDrawer, ask, pill, eventsFor, toast, writeTable } from '../core.js';
import { M, co, ltm, currentVal, returnsOf, finAt, activePlan, planOf, planDrivers, scenarioBase } from '../data.js';
import { initiativeImpact, projectScenario, xirr } from '../engine.js';
import { sheet, btn, section, kv, stepper } from '../ui.js';

export const IFLOW = ['Proposed', 'Under Review', 'Approved', 'In Progress', 'Completed', 'Benefits Verified'];
const TYPES = ['Pricing optimisation', 'Sales productivity', 'Customer retention', 'Procurement savings', 'Working capital optimisation', 'Operating cost reduction', 'Geographic expansion', 'Product expansion', 'Acquisition integration', 'Capital structure optimisation'];
const LINK = { 'Pricing optimisation': 'Revenue growth', 'Sales productivity': 'Revenue growth', 'Customer retention': 'Revenue growth', 'Geographic expansion': 'Revenue growth', 'Product expansion': 'Revenue growth', 'Procurement savings': 'EBITDA margin', 'Operating cost reduction': 'EBITDA margin', 'Acquisition integration': 'Acquisition strategy', 'Working capital optimisation': 'Target returns', 'Capital structure optimisation': 'Target returns' };
const F = (name, valueType = 'string') => ({ name, valueType });

/** The three-initiative programme for an underperforming company, sized from its governed LTM financials. */
export const programmeFor = (name) => {
  const rev = ltm(name, 'Revenue'), cogs = ltm(name, 'Cogs'), pers = ltm(name, 'Personnel Costs');
  const c = co(name);
  return [
    { type: 'Pricing optimisation', title: `Pricing improvement programme — ${c['Short Code']}`, objective: 'Value-based packaging, list-price realignment and discount governance on renewals', est: rev * 0.02, revenueUplift: rev * 0.02, cost: rev * 0.004, capex: 0, owner: `Chief Revenue Officer, ${c['Short Code']}`, milestones: ['Price-elasticity study (Dec 2026)', 'New packaging live for new logos (Feb 2027)', 'Renewal uplift cohort 1 (Apr 2027)'], basis: `2.0% price realisation on LTM revenue ${money(rev, 0)}, 100% flow-through` },
    { type: 'Procurement savings', title: `Procurement optimisation — ${c['Short Code']}`, objective: 'Hosting contract renegotiation, vendor consolidation and spend controls', est: cogs * 0.06, revenueUplift: 0, cost: cogs * 0.012, capex: 0, owner: `Chief Financial Officer, ${c['Short Code']}`, milestones: ['Spend cube and vendor map (Dec 2026)', 'Cloud hosting RFP awarded (Mar 2027)', 'Run-rate savings verified (Jun 2027)'], basis: `6% of LTM cost of goods sold ${money(cogs, 0)}` },
    { type: 'Sales productivity', title: `Sales productivity — ${c['Short Code']}`, objective: 'Territory redesign, quota capacity rebalancing and pipeline hygiene', est: pers * 0.035, revenueUplift: rev * 0.015, cost: pers * 0.01, capex: 0, owner: `Chief Revenue Officer, ${c['Short Code']}`, milestones: ['Territory model approved (Jan 2027)', 'Sales capacity plan live (Mar 2027)', 'Win-rate and ramp KPIs on target (Jun 2027)'], basis: `3.5% of LTM personnel costs ${money(pers, 0)} through capacity rebalancing; +1.5% revenue` },
  ];
};

export const mountValue = (ctx, pane) => {
  const { card, kpi, filters, go } = ctx;
  const board = el('div', { class: 'board' }), outcome = el('div'), modelHost = el('div');
  const companyOf = () => ctx.selectedValues('g-value', 'Company', 'Companies')[0];

  /** Governed initiatives merged with workflow overlays and newly proposed ones. */
  const all = () => {
    const base = M.inits.map((i) => { const ov = record(`INIT-${i['Initiative Id']}`); return { id: i['Initiative Id'], recId: ov?.id, company: i.Company, title: i.Initiative, type: i['Initiative Type'], status: ov?.status ?? i.Status, est: i['Est Ebitda Impact'], cost: i['Implementation Cost'], realised: i['Realised Ebitda Impact'], owner: i.Owner, sponsor: i.Sponsor, start: String(i['Start Date']).slice(0, 10), target: String(i['Target Date']).slice(0, 10), link: i['Thesis Link'], rag: i.Rag, governed: true, payload: ov?.payload ?? {} }; });
    const added = records('Initiative').filter((r) => !r.id.startsWith('INIT-')).map((r) => ({ id: r.id, recId: r.id, company: r.company, title: r.title, type: r.payload.type, status: r.status, est: r.payload.est, cost: r.payload.cost, realised: r.payload.realised ?? 0, owner: r.payload.owner, sponsor: r.payload.sponsor, start: r.payload.start, target: r.payload.target, link: LINK[r.payload.type], rag: r.status === 'Proposed' ? 'Grey' : 'Green', governed: false, payload: r.payload }));
    return [...added, ...base];
  };
  const fund = () => ctx.selectedValues('g-value', 'Fund', 'Companies');

  const move = async (it, to, perm, label) => {
    if (!can(perm)) return denied(perm);
    if (to === 'Approved' && it.payload?.proposedBy === me().name) { toast('Maker–checker: the proposer cannot approve their own initiative', 'gpp_bad', 'warn'); return; }
    const reason = await ask({ title: `${label} · ${it.title}`, text: `${esc(it.status)} → <b>${esc(to)}</b>`, label: ['Rejected', 'Cancelled'].includes(to) ? 'Reason (required)' : 'Comment', required: ['Rejected', 'Cancelled'].includes(to), confirmLabel: label, danger: ['Rejected', 'Cancelled'].includes(to) });
    if (reason === null) return;
    await saveRecord({ id: it.recId ?? `INIT-${it.id}`, type: 'Initiative', company: it.company, fund: co(it.company).Fund, period: '2026-Q3', title: it.title, status: to, owner: it.owner, payload: { ...(it.payload ?? {}), type: it.type, est: it.est, cost: it.cost, owner: it.owner, sponsor: it.sponsor, start: it.start, target: it.target } }, { action: `Initiative ${label.toLowerCase()}`, prev: it.status, next: to, reason });
    if (it.governed) await writeTable({ view: 'Initiatives', operation: 'update', fields: [F('Status')], values: [[to]], keys: { fields: [F('Initiative Id')], values: [[it.id]] } }, ['Initiative', it.id, 'Initiative status written back', { prev: it.status, next: to, reason }]);
    render();
  };
  const NEXT = { Proposed: [['Under Review', 'initiative.propose', 'Send to review']], 'Under Review': [['Approved', 'initiative.approve', 'Approve'], ['Rejected', 'initiative.approve', 'Reject']], Approved: [['In Progress', 'initiative.progress', 'Start']], 'In Progress': [['Completed', 'initiative.progress', 'Complete']], Completed: [['Benefits Verified', 'initiative.verify', 'Verify benefits']] };

  const openInit = (it) => {
    const c = co(it.company), cv = currentVal(it.company);
    const m = cv?.Method === 'EV/Revenue' ? cv['Enterprise Value'] / ltm(it.company, 'Ebitda') : cv?.Multiple;
    const imp = initiativeImpact({ revenueUplift: it.payload?.revenueUplift ?? 0, ebitdaUplift: it.est, oneOffCost: it.cost, capex: it.payload?.capex ?? 0, multiple: m, ownership: c['Current Ownership'] });
    const iq = M.iq.filter((q) => q['Initiative Id'] === it.id);
    openDrawer({ title: it.title, kicker: `${it.company} · ${it.type} · thesis link: ${it.link}`, wide: true, body: [
      stepper(IFLOW, IFLOW.includes(it.status) ? it.status : 'Proposed', { rejected: ['Rejected', 'Cancelled'].includes(it.status) }),
      ['Rejected', 'Cancelled'].includes(it.status) ? el('p', { class: 'warnline', text: `${it.status}: ${eventsFor(it.recId ?? '').find((e) => e.next === it.status)?.reason ?? ''}` }) : null,
      el('div', { class: 'cols2' }, [
        section('Initiative', kv([['Strategic objective', it.payload?.objective ?? it.title], ['Owner', it.owner], ['Sponsor', it.sponsor], ['Start → target', `${it.start} → ${it.target}`], ['Approved budget', money(it.cost)], ['Milestones', (it.payload?.milestones ?? ['Plan approved', 'Implementation', 'Run-rate achieved']).join(' · ')], ['Dependencies', it.payload?.dependencies ?? '—'], ['Sizing basis', it.payload?.basis ?? 'Business case (portfolio operations)']])),
        section('Financial impact (net of implementation cost)', kv([['Revenue uplift (run-rate)', money(imp.revenueUplift)], ['EBITDA uplift (run-rate)', money(imp.ebitdaUplift)], ['3-year EBITDA net of cost', money(imp.netEbitda3y)], ['Enterprise value at current multiple', `${money(imp.ev)} (${mult(m)})`], ['Equity value', money(imp.equity)], ['Northstar fair value impact', money(imp.fairValue)], ['Payback', imp.payback ? `${imp.payback.toFixed(1)} years` : '—'], ['Realised to date', money(it.realised)]])),
      ]),
      iq.length ? section('Projected vs realised by quarter', sheet([{ key: 'Quarter', label: 'Quarter' }, { key: 'Planned Ebitda Impact', label: 'Planned', fmt: (v) => money(v, 2) }, { key: 'Realised Ebitda Impact', label: 'Realised', fmt: (v) => money(v, 2) }, { key: 'r', label: 'Realisation', value: (r) => r['Realised Ebitda Impact'] / r['Planned Ebitda Impact'], fmt: (v) => pct(v, 0), tone: (v) => (v < 0.8 ? 'neg' : 'pos') }], iq)) : null,
      section('Evidence and comments', el('div', {}, [el('ul', { class: 'comments' }, (it.payload?.comments ?? []).map((cm) => el('li', {}, [el('b', { text: cm.who }), el('small', { text: cm.at }), el('p', { text: cm.text })]))), btn('Add progress update', async () => { if (!can('initiative.progress') && !can('initiative.propose')) return denied('initiative.progress'); const t = await ask({ title: 'Progress update', label: 'Update / evidence', confirmLabel: 'Post' }); if (!t) return; await saveRecord({ id: it.recId ?? `INIT-${it.id}`, type: 'Initiative', company: it.company, fund: c.Fund, period: '2026-Q3', title: it.title, status: it.status, owner: it.owner, payload: { ...(it.payload ?? {}), type: it.type, est: it.est, cost: it.cost, owner: it.owner, sponsor: it.sponsor, comments: [...(it.payload?.comments ?? []), { who: me().name, at: new Date().toISOString().slice(0, 16).replace('T', ' '), text: t }] } }, { action: 'Progress update', reason: t }); openInit({ ...it, payload: record(it.recId ?? `INIT-${it.id}`).payload, recId: it.recId ?? `INIT-${it.id}` }); }, { kind: 'ghost sm', ic: 'chat' })])),
      section('Audit history', sheet([{ key: 'at', label: 'When' }, { key: 'actor', label: 'Who', cls: '' }, { key: 'action', label: 'Action', cls: '' }, { key: 'prev', label: 'From', cls: '' }, { key: 'next', label: 'To', cls: '' }, { key: 'reason', label: 'Reason', cls: '' }], [...eventsFor(it.recId ?? ''), ...eventsFor(it.id)])),
    ], actions: [...(NEXT[it.status] ?? []).map(([to, perm, label]) => btn(label, () => move(it, to, perm, label), { kind: to === 'Rejected' ? 'danger ghost' : '' })), !['Completed', 'Benefits Verified', 'Rejected', 'Cancelled'].includes(it.status) ? btn('Cancel', () => move(it, 'Cancelled', 'initiative.approve', 'Cancel'), { kind: 'ghost' }) : null, btn('Company', () => go('company', it.company), { kind: 'ghost', ic: 'apartment' })] });
  };

  const render = () => {
    const f = fund(), sel = companyOf();
    const items = all().filter((i) => (!f.length || f.includes(co(i.company)?.Fund)) && (!sel || i.company === sel));
    board.replaceChildren(...[...IFLOW, 'Rejected / Cancelled'].map((col) => {
      const list = items.filter((i) => (col === 'Rejected / Cancelled' ? ['Rejected', 'Cancelled'].includes(i.status) : i.status === col));
      return el('div', { class: 'lane' }, [el('header', {}, [el('b', { text: col }), el('span', { text: `${list.length} · ${money(list.reduce((s, i) => s + (i.est || 0), 0), 0)}` })]), ...list.slice(0, 40).map((i) => el('button', { class: `tile rag-${String(i.rag).toLowerCase()}`, onclick: () => openInit(i) }, [el('b', { text: i.title }), el('small', { text: `${i.company} · ${i.type}` }), el('span', { text: `Run-rate ${money(i.est)} · realised ${money(i.realised)}` })]))]);
    }));
    renderOutcome();
  };

  // ---------------------------------------------------------------- propose (single or the programme)
  const propose = async (prefill) => {
    if (!can('initiative.propose')) return denied('initiative.propose');
    const name = prefill?.company ?? companyOf() ?? M.companies.find((c) => c.Company.startsWith('Meridian')).Company;
    const items = prefill?.items ?? [{ type: TYPES[0], title: '', objective: '', est: ltm(name, 'Ebitda') * 0.03, revenueUplift: 0, cost: ltm(name, 'Ebitda') * 0.01, capex: 0, owner: '', milestones: [] }];
    const coSel = el('select', {}, M.companies.map((c) => el('option', { value: c.Company, text: c.Company, selected: c.Company === name })));
    const rows = items.map((it) => {
      const f = Object.fromEntries(['title', 'objective', 'owner', 'est', 'revenueUplift', 'cost', 'capex'].map((k) => [k, el('input', { type: ['est', 'revenueUplift', 'cost', 'capex'].includes(k) ? 'number' : 'text', step: 0.1, value: typeof it[k] === 'number' ? it[k].toFixed(1) : it[k] ?? '' })]));
      const t = el('select', {}, TYPES.map((x) => el('option', { value: x, text: x, selected: x === it.type })));
      const ms = el('input', { type: 'text', value: (it.milestones ?? []).join('; ') });
      const prev = el('small', { class: 'muted' });
      const upd = () => { const cv = currentVal(coSel.value); const m = cv?.Method === 'EV/Revenue' ? cv['Enterprise Value'] / ltm(coSel.value, 'Ebitda') : cv?.Multiple; const imp = initiativeImpact({ revenueUplift: N(f.revenueUplift.value), ebitdaUplift: N(f.est.value), oneOffCost: N(f.cost.value), capex: N(f.capex.value), multiple: m, ownership: co(coSel.value)['Current Ownership'] }); prev.textContent = `EV ${money(imp.ev, 0)} at ${mult(m)} · Northstar FV ${money(imp.fairValue)} · payback ${imp.payback?.toFixed(1) ?? '—'} yrs · 3-yr net EBITDA ${money(imp.netEbitda3y)}`; };
      for (const x of [f.est, f.revenueUplift, f.cost, f.capex]) x.oninput = upd;
      coSel.addEventListener('change', upd); upd();
      return { it, f, t, ms, node: el('div', { class: 'init-form' }, [el('label', { class: 'field wide' }, [el('span', { text: 'Initiative' }), f.title]), el('label', { class: 'field' }, [el('span', { text: 'Type' }), t]), el('label', { class: 'field wide' }, [el('span', { text: 'Strategic objective' }), f.objective]), el('label', { class: 'field' }, [el('span', { text: 'Owner' }), f.owner]), el('label', { class: 'field' }, [el('span', { text: 'EBITDA uplift ($m run-rate)' }), f.est]), el('label', { class: 'field' }, [el('span', { text: 'Revenue uplift ($m)' }), f.revenueUplift]), el('label', { class: 'field' }, [el('span', { text: 'Implementation cost ($m)' }), f.cost]), el('label', { class: 'field' }, [el('span', { text: 'Capex ($m)' }), f.capex]), el('label', { class: 'field wide' }, [el('span', { text: 'Milestones (;)' }), ms]), it.basis ? el('p', { class: 'note', text: `Sizing basis (governed LTM): ${it.basis}` }) : null, prev]) };
    });
    openDrawer({ title: prefill ? `Value-creation programme · ${name}` : 'Propose value-creation initiative', kicker: 'Proposed → Under Review → Approved → In Progress → Completed → Benefits Verified', wide: true, body: [el('label', { class: 'field' }, [el('span', { text: 'Portfolio company' }), coSel]), ...rows.map((r) => r.node)], actions: [btn(rows.length > 1 ? `Propose ${rows.length} initiatives` : 'Propose initiative', async () => {
      const ids = [];
      for (const r of rows) {
        const comp = coSel.value;
        const rec = await saveRecord({ type: 'Initiative', prefix: 'VCI', company: comp, fund: co(comp).Fund, period: '2026-Q3', title: r.f.title.value || `${r.t.value} — ${co(comp)['Short Code']}`, status: 'Proposed', owner: r.f.owner.value, payload: { type: r.t.value, objective: r.f.objective.value, est: N(r.f.est.value), revenueUplift: N(r.f.revenueUplift.value), cost: N(r.f.cost.value), capex: N(r.f.capex.value), owner: r.f.owner.value, sponsor: co(comp)['Operating Partner'], start: '2026-12-01', target: '2027-09-30', milestones: r.ms.value.split(';').map((x) => x.trim()).filter(Boolean), basis: r.it.basis, proposedBy: me().name, realised: 0, programme: prefill ? `${co(comp)['Short Code']} value-creation plan` : undefined } }, { action: 'Initiative proposed', next: 'Proposed', reason: `${r.t.value}: ${money(N(r.f.est.value))} run-rate EBITDA, cost ${money(N(r.f.cost.value))}` });
        ids.push(rec.id);
      }
      ctx.lastProgramme = { company: coSel.value, ids };
      render();
    }, { ic: 'send' })] });
  };
  ctx.proposeProgramme = (name) => propose({ company: name, items: programmeFor(name) });

  // ---------------------------------------------------------------- actual vs expected (incl. the simulated next period)
  const renderOutcome = () => {
    const progs = records('Initiative', (r) => r.payload?.programme && ['Approved', 'In Progress', 'Completed', 'Benefits Verified'].includes(r.status));
    const byCo = [...new Set(progs.map((r) => r.company))];
    const q4 = ctx.period === '2026-Q4';
    outcome.replaceChildren(...(byCo.length ? byCo.map((n) => {
      const its = progs.filter((r) => r.company === n);
      const target = its.reduce((s, r) => s + r.payload.est, 0);
      const np = M.next.find((x) => x.Company === n);
      const plan = planOf(n, 'Approved Forecast');
      const fy1 = projectScenario(scenarioBase(n), planDrivers(plan)).years[0].ebitda;
      const q3 = finAt(n, '2026-Q3').Ebitda;
      const baseline = q3 * (fy1 / ltm(n, 'Ebitda')) ** 0.25; // Q3 2026 actual stepped one quarter along the pre-programme forecast path
      const actual = np?.Ebitda;
      const uplift = actual - baseline;
      const qTarget = target / 4 * 0.5; // ramp: 50% of run-rate in the first quarter after approval
      return section(`${n} · approved programme (${its.length} initiatives, ${money(target)} run-rate)`, q4 && np ? [
        el('div', { class: 'metric-tiles four' }, [['Q4 2026 EBITDA (simulated actual)', money(actual), `budget ${money(np['Budget Ebitda'])}`], ['Baseline expected (pre-programme)', money(baseline), `Q3 ${money(q3)} × pre-programme forecast growth`], ['Realised uplift', smoney(uplift), `${pct(uplift / qTarget, 0)} of Q4 target`], ['Q4 target (50% ramp)', money(qTarget), 'run-rate ÷ 4 × 50%']].map(([k, v, s]) => el('div', {}, [el('small', { text: k }), el('b', { text: v }), el('span', { text: s })]))),
        sheet([{ key: 'title', label: 'Initiative' }, { key: 'status', label: 'Status', cls: '', fmt: (v) => pill(v) }, { key: 'tgt', label: 'Q4 target', fmt: (v) => money(v, 2) }, { key: 'real', label: 'Attributed realised', fmt: (v) => money(v, 2) }, { key: 'r', label: 'vs target', fmt: (v) => pct(v, 0), tone: (v) => (v < 0.8 ? 'neg' : 'pos') }], its.map((r) => { const tgt = r.payload.est / 4 * 0.5; const real = uplift * (r.payload.est / target); return { title: r.title, status: r.status, tgt, real, r: real / tgt }; })),
        el('p', { class: 'note', text: 'Realised uplift = simulated Q4 2026 EBITDA − baseline from the pre-programme approved forecast; attributed to initiatives pro rata to approved run-rate impact.' }),
      ] : el('p', { class: 'muted', text: 'Switch the reporting period to Q4 2026 (simulated) to measure realised improvement against these approved targets.' }));
    }) : [el('p', { class: 'muted', text: 'No approved value-creation programme yet. Propose one from a company (e.g. Meridian Cloud Systems) and take it through the Investment Committee.' })]));
  };
  window.addEventListener('nsos-period', renderOutcome);

  pane.append(
    el('div', { class: 'page-head' }, [el('div', {}, [el('h2', { text: 'Value Creation' }), el('p', { text: 'Turn analysis into execution: initiatives tied to the thesis, sized from governed financials, approved maker–checker, tracked from projected to realised value.' })]), el('div', { class: 'row-end' }, [btn('Propose initiative', () => propose(), { ic: 'add' }), btn('Build Meridian programme', () => ctx.proposeProgramme(M.companies.find((c) => c.Company.startsWith('Meridian')).Company), { ic: 'auto_fix_high', kind: 'ghost' })])]),
    filters('value'),
    el('div', { class: 'kpis' }, [kpi('k-vc-real'), kpi('k-vc-est'), kpi('k-vc-n'), kpi('k-vc-cost')]),
    el('figure', { class: 'card full' }, [el('figcaption', { text: 'Initiative workflow board (click to open)' }), board]),
    el('figure', { class: 'card full' }, [el('figcaption', { text: 'Measured outcomes of approved programmes' }), outcome]),
    el('div', { class: 'grid' }, [card('vc-q', 'half'), card('vc-type', 'half'), card('vc-table', 'full')]),
  );
  onStore(() => { if (!pane.hidden) render(); });
  window.__sel.onActiveSelectionChange('g-value').subscribe(() => render());
  window.addEventListener('nsos-ccy', render);
  ctx.onShow('value', (arg) => { if (typeof arg === 'string') ctx.select('g-value', 'Company', 'Companies', [arg]); render(); });
  render();
};
