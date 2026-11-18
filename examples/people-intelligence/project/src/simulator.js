/**
 * Workforce Simulator — "What if you could see the impact before making the decision?"
 *
 * A twelve-month projection for one population, from a governed baseline (published semantic layer)
 * and explicit, illustrative elasticities that are all listed on screen. Every output is a formula of
 * the levers and the baseline; nothing is fitted or hidden.
 */
import { popLabel } from './home.js';
import { popFilters } from './explain.js';

const N = (v) => Number(v ?? 0);
const KEY = 'people-scenarios-v1';
export const ZERO = { r: 0, c: 0, ld: 0, m: 0, f: 0 };
export const LEVERS = [
  ['r', 'Retention improvement target', 'Stay conversations, manager actions and retention awards for at-risk critical talent', 0, 30, 1, '%'],
  ['c', 'Compensation adjustment', 'Market adjustment for critical and senior roles', 0, 15, 0.5, '%'],
  ['ld', 'Learning & development investment', 'Certifications and academies (cloud, data, AI)', 0, 5, 0.25, '£m'],
  ['m', 'Internal mobility allocation', 'Share of vacancies filled internally first', 0, 30, 1, '%'],
  ['f', 'Hiring freeze duration', 'Months with external hiring paused', 0, 12, 1, ' mo'],
];
export const PRESETS = {
  'Balanced retention': { r: 15, c: 6, ld: 1.5, m: 15, f: 0 },
  'Pay-led': { r: 5, c: 10, ld: 0.5, m: 5, f: 0 },
  'Grow from within': { r: 10, c: 2, ld: 3, m: 30, f: 0 },
  'Cost containment': { r: 0, c: 0, ld: 0.5, m: 20, f: 6 },
};
export const ASSUMPTIONS = {
  pay: 'Each 1% pay adjustment reduces attrition in targeted roles by 2.5% (relative), capped at 35%; targeted roles = critical-role share × 1.6 of leavers',
  ld: 'Each £2,000 of L&D per employee reduces attrition by 10% (relative), capped at 20%; £25k builds one strategic-skill FTE (70% success)',
  mob: 'Internal-first filling reduces career-driven exits: 50% of the allocation × 30% career share, capped at 15%',
  ret: 'The retention target is a direct relative reduction delivered by a programme costing £8,000 per retained employee + £150k fixed',
  freeze: 'Each month of freeze avoids 1/12 of external hires (less internal fills), saves cost per hire + half a year of vacancy payroll pro rata, and lifts attrition 0.4% (relative) per month through workload',
  trend: 'Current trajectory: the last six months’ change in rolling attrition persists for the next twelve (capped at +50%)',
};

/** The projection. b = governed baseline; L = levers. */
export const project = (b, L) => {
  const HC = N(b.Headcount), VA = N(b['Voluntary Attrition']), d = VA - N(b['Voluntary Attrition P2Q']);
  const traj = Math.max(0, Math.min(VA * 1.5, VA + Math.max(0, d)));
  const L0 = HC * traj;
  const cpl = N(b['Replacement Cost Exposure']) / Math.max(1, N(b['Voluntary Leavers LTM']));
  const payroll = N(b['Payroll Cost LTM']);
  const tShare = Math.min(1, N(b['Critical Role Headcount']) / Math.max(1, HC));
  const w = Math.min(1, tShare * 1.6);
  const eC = Math.min(0.35, 0.025 * L.c) * w;
  const eL = Math.min(0.2, ((L.ld * 1e6) / Math.max(1, HC)) / 2000 * 0.1);
  const eM = Math.min(0.15, 0.5 * (L.m / 100) * 0.3);
  const eR = L.r / 100;
  const uF = 0.004 * L.f;
  const E = 1 - (1 - eC) * (1 - eL) * (1 - eM) * (1 - eR);
  const rate = traj * (1 - E) * (1 + uF);
  const L1 = HC * rate;
  const retained = L0 - L1;
  const hires = N(b['External Hires LTM']);
  const cph = N(b['Average Cost per Hire']);
  const pay1 = payroll / Math.max(1, HC);
  const hiresAvoided = hires * (L.f / 12) * (1 - L.m / 100);
  const freezeSaving = hiresAvoided * (cph + pay1 * (L.f / 2) / 12);
  const moves = hires * (1 - L.f / 12) * (L.m / 100);
  const mobilitySaving = moves * Math.max(0, cph - 1500);
  const replacementAvoided = retained * cpl;
  const invPay = payroll * tShare * (L.c / 100);
  const invLd = L.ld * 1e6;
  const invRet = L.r > 0 ? HC * traj * eR * 8000 + 150000 : 0;
  const invMob = L.m > 0 ? 120000 + moves * 1500 : 0;
  const investment = invPay + invLd + invRet + invMob;
  const net = replacementAvoided + freezeSaving + mobilitySaving - investment;
  const req = Math.max(1, N(b['Required FTE']));
  const cov0 = N(b['Critical Skills Coverage']);
  const covGain = (retained * w * 0.5 + (invLd / 25000) * 0.7 - hiresAvoided * 0.25) / req;
  const cov1 = Math.max(0, Math.min(1.2, cov0 + covGain));
  const costImpact = invPay + invLd + invRet + invMob - freezeSaving;
  return { HC, VA, traj, rate, L0, L1, retained, cpl, replacement0: L0 * cpl, replacement1: L1 * cpl, replacementAvoided, freezeSaving, mobilitySaving, invPay, invLd, invRet, invMob, investment, net, cov0, cov1, costImpact, hiresAvoided, moves, E, tShare, payroll };
};

export const mountSimulator = (ctx, grid) => {
  const { el, esc, icon, gbp, pct, int } = ctx;
  const st = { pop: { country: 'United Kingdom', bu: 'Technology' }, L: { ...PRESETS['Balanced retention'] }, preset: 'Balanced retention', base: null };
  const scenarios = () => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } };
  const saveScenarios = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* private */ } };

  const popSel = (k, opts, label) => {
    const s = el('select', { class: 'pi-select', 'aria-label': label }, [el('option', { value: '', text: `All ${label.toLowerCase()}` }), ...opts.map((o) => el('option', { value: o, text: o }))]);
    s.value = k === 'seniority' ? (st.pop.seniority?.length ? 'Senior & lead' : '') : st.pop[k] ?? '';
    s.onchange = () => { if (k === 'seniority') st.pop.seniority = s.value ? ['Senior', 'Lead & Executive'] : undefined; else st.pop[k] = s.value || undefined; loadBase(); };
    return s;
  };
  const hero = el('div', { class: 'pi-simhero span-12' });
  const levers = el('figure', { class: 'pi-card span-4' });
  const results = el('figure', { class: 'pi-card span-8' });
  const waterfall = el('figure', { class: 'pi-card span-6' });
  const forecast = el('figure', { class: 'pi-card span-6' });
  const history = el('figure', { class: 'pi-card span-6' });
  const compare = el('figure', { class: 'pi-card span-6' });
  const assumptions = el('figure', { class: 'pi-card span-12' });
  grid.prepend(hero, levers, results, waterfall, forecast, history, compare, assumptions);
  let histId = null;

  const renderHero = () => {
    hero.replaceChildren(
      el('div', { style: 'flex:1;min-width:280px' }, [el('h2', { text: 'What if you could see the impact before making the decision?' }), el('p', { text: `Scenario: Reduce ${popLabel(st.pop)} attrition · 12-month horizon from 30 Sep 2026 · governed baseline, illustrative elasticities` })]),
      el('div', { class: 'pi-pop' }, [icon('groups'), el('b', { text: 'Population' }),
        popSel('country', ['United Kingdom', 'Germany', 'Italy', 'Spain', 'India', 'Morocco', 'Kenya', 'United Arab Emirates', 'Netherlands', 'Ireland', 'Hungary', 'Malta', 'Cyprus', 'Poland', 'Croatia'], 'Countries'),
        popSel('bu', ['Technology', 'Networks', 'Enterprise Business', 'Consumer', 'Customer Operations', 'Retail & Stores', 'Shared Services (GBS)', 'Group Functions'], 'Business units'),
        popSel('seniority', ['Senior & lead'], 'Levels')]),
    );
  };
  const fmtLever = (k, v) => (k === 'ld' ? `£${Number(v).toFixed(2)}m` : k === 'f' ? `${v} mo` : `${v}%`);
  const renderLevers = () => {
    levers.replaceChildren(
      el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: 'Interventions' }), el('div', { class: 'tools' }, el('button', { class: 'pi-btn sm ghost', onclick: () => { st.L = { ...ZERO }; st.preset = 'Current trajectory'; renderLevers(); renderResults(); } }, [icon('restart_alt'), el('span', { text: 'Reset' })]))]),
      el('div', { class: 'pi-presets' }, Object.keys(PRESETS).map((k) => el('button', { class: st.preset === k ? 'on' : '', text: k, onclick: () => { st.L = { ...PRESETS[k] }; st.preset = k; renderLevers(); renderResults(); } }))),
      el('div', { class: 'pi-levers' }, LEVERS.map(([k, label, hint, min, max, step]) => {
        const out = el('output', { text: fmtLever(k, st.L[k]) });
        const input = el('input', { type: 'range', min, max, step, value: st.L[k], 'aria-label': label });
        input.addEventListener('input', () => { st.L[k] = Number(input.value); st.preset = 'Custom'; out.textContent = fmtLever(k, input.value); levers.querySelectorAll('.pi-presets button').forEach((b) => b.classList.remove('on')); renderResults(); });
        return el('div', { class: 'pi-lever' }, [el('div', { class: 'l', html: `${esc(label)}<small>${esc(hint)}</small>` }), out, input]);
      })),
    );
  };

  const svgWaterfall = (p) => {
    const steps = [['Replacement cost avoided', p.replacementAvoided], ['Hiring freeze savings', p.freezeSaving], ['Mobility savings', p.mobilitySaving], ['Pay adjustment', -p.invPay], ['L&D', -p.invLd], ['Retention programme', -p.invRet], ['Mobility programme', -p.invMob]].filter(([, v]) => Math.abs(v) > 1);
    const W = 640, H = 260, pad = 30, bw = (W - pad * 2) / (steps.length + 1) * 0.62, gap = (W - pad * 2) / (steps.length + 1);
    let run = 0; const pts = [];
    for (const [l, v] of steps) { pts.push({ l, from: run, to: run + v, v }); run += v; }
    const lo = Math.min(0, ...pts.map((x) => Math.min(x.from, x.to)), run), hi = Math.max(1, ...pts.map((x) => Math.max(x.from, x.to)), run);
    const y = (v) => pad + (H - pad * 2 - 26) * (1 - (v - lo) / (hi - lo || 1));
    const bars = pts.map((x, i) => { const x0 = pad + i * gap + (gap - bw) / 2; return `<rect x="${x0}" y="${Math.min(y(x.from), y(x.to))}" width="${bw}" height="${Math.max(1.5, Math.abs(y(x.from) - y(x.to)))}" rx="3" fill="${x.v >= 0 ? '#2E8540' : '#D92D20'}" opacity="${x.v >= 0 ? .85 : .8}"><title>${esc(x.l)}: ${gbp(x.v)}</title></rect><text x="${x0 + bw / 2}" y="${Math.min(y(x.from), y(x.to)) - 4}" text-anchor="middle" class="lbl">${x.v >= 0 ? '+' : '−'}${gbp(Math.abs(x.v)).replace('£', '£')}</text><text x="${x0 + bw / 2}" y="${H - 18}" text-anchor="middle"><tspan x="${x0 + bw / 2}">${esc(x.l.split(' ')[0])}</tspan><tspan x="${x0 + bw / 2}" dy="12">${esc(x.l.split(' ').slice(1).join(' '))}</tspan></text>${i < pts.length - 1 ? `<line x1="${x0 + bw}" x2="${x0 + gap}" y1="${y(x.to)}" y2="${y(x.to)}" stroke="#BEBEBE" stroke-dasharray="3 3"/>` : ''}`; }).join('');
    const xn = pad + pts.length * gap + (gap - bw) / 2;
    const net = `<rect x="${xn}" y="${Math.min(y(0), y(run))}" width="${bw}" height="${Math.max(1.5, Math.abs(y(0) - y(run)))}" rx="3" fill="${run >= 0 ? '#25282B' : '#D92D20'}"><title>Net: ${gbp(run)}</title></rect><text x="${xn + bw / 2}" y="${Math.min(y(0), y(run)) - 4}" text-anchor="middle" class="lbl">${gbp(run)}</text><text x="${xn + bw / 2}" y="${H - 6}" text-anchor="middle" class="lbl">Net benefit</text>`;
    return `<svg class="pi-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Financial impact waterfall"><line x1="${pad}" x2="${W - pad}" y1="${y(0)}" y2="${y(0)}" stroke="#E6E6E6"/>${bars}${net}</svg>`;
  };
  const svgForecast = (p) => {
    const W = 640, H = 260, pad = 34; const months = 12;
    const cum = (L) => Array.from({ length: months + 1 }, (_, i) => (L * i) / months);
    const a = cum(p.L0), b = cum(p.L1);
    const max = Math.max(1, p.L0) * 1.08;
    const x = (i) => pad + ((W - pad * 2) * i) / months, y = (v) => H - pad - ((H - pad * 2) * v) / max;
    const path = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join('');
    const area = `${path(a)}L${x(months)},${y(b[months])}${b.map((v, i) => `L${x(months - i)},${y(b[months - i])}`).join('')}Z`;
    const labels = ['Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep'];
    return `<svg class="pi-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Cumulative leavers forecast">
      ${[0, 0.25, 0.5, 0.75, 1].map((t) => `<line x1="${pad}" x2="${W - pad}" y1="${y(max * t)}" y2="${y(max * t)}" stroke="#F0F0F0"/><text x="${pad - 6}" y="${y(max * t) + 4}" text-anchor="end">${Math.round(max * t)}</text>`).join('')}
      <path d="${area}" fill="#2E8540" opacity=".12"/>
      <path d="${path(a)}" fill="none" stroke="#7E7E7E" stroke-width="2.5" stroke-dasharray="6 4"/>
      <path d="${path(b)}" fill="none" stroke="#2B5CE6" stroke-width="3"/>
      ${labels.map((l, i) => `<text x="${x(i + 1)}" y="${H - 12}" text-anchor="middle">${l}</text>`).join('')}
      <text x="${x(months) - 4}" y="${y(a[months]) - 8}" text-anchor="end" class="lbl">Current trajectory · ${Math.round(p.L0)}</text>
      <text x="${x(months) - 4}" y="${y(b[months]) + 16}" text-anchor="end" class="lbl" style="fill:#2B5CE6">Proposed · ${Math.round(p.L1)}</text>
      <text x="${x(6)}" y="${(y(a[6]) + y(b[6])) / 2 + 4}" text-anchor="middle" class="lbl" style="fill:#2E8540">${Math.round(p.retained)} retained</text>
    </svg>`;
  };

  const renderResults = () => {
    if (!st.base) { results.replaceChildren(el('p', { class: 'pi-note', text: 'Loading the governed baseline…' })); return; }
    const p = project(st.base, st.L), z = project(st.base, ZERO);
    const label = popLabel(st.pop);
    const row = (name, cur, prop, delta, good) => [el('div', { text: name, style: 'font-weight:600' }), el('div', { class: 'v', text: cur }), el('div', { class: 'v prop', text: prop }), el('div', { class: `d ${good ? 'up-good' : 'up-bad'}`, text: delta })];
    const sign = (v, f) => `${v >= 0 ? '+' : '−'}${f(Math.abs(v))}`;
    results.replaceChildren(
      el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: `Current trajectory vs proposed scenario · ${label}` }), el('div', { class: 'tools' }, el('span', { class: 'pill approved', text: st.preset }))]),
      el('div', { class: 'pi-big' }, [
        el('div', { class: 'hl' }, [el('span', { text: 'Employees retained' }), el('b', { text: int(p.retained) }), el('i', { text: 'over 12 months' })]),
        el('div', {}, [el('span', { text: 'Projected attrition' }), el('b', { text: pct(p.rate) }), el('i', { text: `vs ${pct(p.traj)} trajectory` })]),
        el('div', {}, [el('span', { text: 'Net financial benefit' }), el('b', { text: gbp(p.net), style: `color:${p.net >= 0 ? '#2E8540' : '#D92D20'}` }), el('i', { text: p.investment ? `${(p.net / p.investment + 1).toFixed(1)}× return on ${gbp(p.investment)}` : 'no investment' })]),
        el('div', {}, [el('span', { text: 'Critical skills coverage' }), el('b', { text: pct(p.cov1, 0) }), el('i', { text: `${sign((p.cov1 - p.cov0) * 100, (v) => v.toFixed(1))} pts` })]),
      ]),
      el('div', { class: 'pi-vs' }, [
        el('div', { class: 'h', text: 'Outcome (12 months)' }), el('div', { class: 'h v', text: 'Current trajectory' }), el('div', { class: 'h v prop', text: 'Proposed' }), el('div', { class: 'h d', text: 'Change' }),
        ...row('Voluntary attrition', pct(z.rate), pct(p.rate), sign((p.rate - z.rate) * 100, (v) => `${v.toFixed(1)} pts`), p.rate <= z.rate),
        ...row('Leavers', int(z.L1), int(p.L1), sign(p.L1 - z.L1, int), p.L1 <= z.L1),
        ...row('Replacement cost exposure', gbp(z.replacement1), gbp(p.replacement1), sign(p.replacement1 - z.replacement1, gbp), p.replacement1 <= z.replacement1),
        ...row('Intervention investment', gbp(0), gbp(p.investment), sign(p.investment, gbp), p.investment <= 0),
        ...row('Net financial benefit', gbp(0), gbp(p.net), sign(p.net, gbp), p.net >= 0),
        ...row('Critical skills coverage', pct(z.cov1, 0), pct(p.cov1, 0), sign((p.cov1 - z.cov1) * 100, (v) => `${v.toFixed(1)} pts`), p.cov1 >= z.cov1),
        ...row('Workforce cost impact', gbp(0), gbp(p.costImpact), sign(p.costImpact, gbp), p.costImpact <= 0),
      ]),
      el('p', { class: 'pi-narr', style: 'margin-top:12px', html: `<span class="mi">auto_awesome</span> Under this scenario, the Group could retain an estimated <b>${int(p.retained)} additional employees</b> in ${esc(label)} over 12 months, ${p.replacementAvoided > 0 ? `reduce replacement cost exposure by <b>${gbp(p.replacementAvoided)}</b>` : 'hold replacement exposure flat'}${p.cov1 > p.cov0 + 0.001 ? ` and improve critical skills coverage by <b>${((p.cov1 - p.cov0) * 100).toFixed(1)} pts</b>` : p.cov1 < p.cov0 - 0.001 ? `, but critical skills coverage would fall ${((p.cov0 - p.cov1) * 100).toFixed(1)} pts` : ''}. Net of a <b>${gbp(p.investment)}</b> investment, the 12-month financial effect is <b>${gbp(p.net)}</b>${p.net < 0 ? ' — the case rests on capability and risk, not cost' : ''}.` }),
      el('div', { class: 'pi-actions-row', style: 'margin-top:12px' }, [
        el('button', { class: 'pi-btn primary', onclick: () => save() }, [icon('bookmark_add'), el('span', { text: 'Save scenario' })]),
        el('button', { class: 'pi-btn', onclick: () => compare.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, [icon('compare_arrows'), el('span', { text: 'Compare scenarios' })]),
        el('button', { class: 'pi-btn', onclick: () => share(p) }, [icon('ios_share'), el('span', { text: 'Share with leadership' })]),
        el('button', { class: 'pi-btn', onclick: () => submit(p, 'Submitted') }, [icon('send'), el('span', { text: 'Submit for approval' })]),
        el('button', { class: 'pi-btn dark', onclick: () => submit(p, 'Draft') }, [icon('checklist'), el('span', { text: 'Create action plan' })]),
      ]),
    );
    waterfall.replaceChildren(el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: 'Financial impact · 12 months' })]), el('div', { html: svgWaterfall(p) }), el('p', { class: 'pi-note', text: 'Green = benefit, red = investment. Projection (not governed data): derived from the governed baseline with the assumptions below.' }));
    forecast.replaceChildren(el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: 'Workforce outcome · cumulative leavers, Oct 2026 – Sep 2027' })]), el('div', { html: svgForecast(p) }), el('p', { class: 'pi-note', text: `Dashed = current trajectory (${pct(p.traj)} a year); red = proposed (${pct(p.rate)}). Shaded = employees retained.` }));
    renderAssumptions(p);
  };
  const renderAssumptions = (p) => {
    const b = st.base;
    assumptions.replaceChildren(el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: 'Explicit assumptions & governed baseline' })]),
      el('div', { class: 'pi-grid' }, [
        el('div', { class: 'span-6 pi-assump' }, el('table', {}, [
          ['Population', `${popLabel(st.pop)}${st.pop.seniority?.length ? ' · senior & lead' : ''}`], ['Headcount (Sep 2026)', int(b.Headcount)], ['Voluntary attrition (LTM)', `${pct(b['Voluntary Attrition'])} · Mar 2026 ${pct(b['Voluntary Attrition P2Q'])}`],
          ['Voluntary leavers (LTM)', int(b['Voluntary Leavers LTM'])], ['Replacement cost per leaver', gbp(p.cpl)], ['Payroll cost (LTM)', gbp(b['Payroll Cost LTM'])], ['Critical-role share', pct(p.tShare, 0)],
          ['External hires (LTM) · cost per hire', `${int(b['External Hires LTM'])} · ${gbp(b['Average Cost per Hire'])}`], ['Critical skills coverage · required FTE', `${pct(b['Critical Skills Coverage'], 0)} · ${int(b['Required FTE'])}`],
        ].map(([k, v]) => el('tr', {}, [el('td', { text: k }), el('td', { html: `<b>${esc(v)}</b>` })])))),
        el('div', { class: 'span-6 pi-assump' }, el('table', {}, Object.entries({ 'Current trajectory': ASSUMPTIONS.trend, Compensation: ASSUMPTIONS.pay, 'L&D': ASSUMPTIONS.ld, 'Internal mobility': ASSUMPTIONS.mob, 'Retention target': ASSUMPTIONS.ret, 'Hiring freeze': ASSUMPTIONS.freeze, 'Combination': 'Effects combine multiplicatively: rate = trajectory × Π(1 − effectᵢ) × (1 + freeze uplift)' }).map(([k, v]) => el('tr', {}, [el('td', { text: k }), el('td', { text: v })])))),
      ]),
      el('p', { class: 'pi-note', style: 'margin-top:8px', html: '<span class="mi">verified</span> Baseline: Workforce, Requisitions and Skill Inventory measures from the published semantic layer, scoped to the population and your persona. Elasticities are illustrative and editable with HR Analytics.' }));
  };

  const save = (status = 'Saved') => {
    const p = project(st.base, st.L);
    const list = scenarios();
    const x = { id: `SC-${Date.now().toString(36).slice(-5).toUpperCase()}`, name: `${popLabel(st.pop)} · ${st.preset}`, pop: st.pop, L: { ...st.L }, at: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }), by: ctx.persona.name, status, retained: p.retained, rate: p.rate, net: p.net, investment: p.investment, cov: p.cov1 };
    list.unshift(x); saveScenarios(list.slice(0, 20)); renderCompare();
    // Writeback: the scenario becomes a governed row in ASTRATO_GALLERY.MOCK_DATA.PEOPLE_SCENARIOS.
    const F = [['Scenario Id', 'string'], ['Scenario Name', 'string'], ['Population', 'string'], ['Business Unit', 'string'], ['Preset', 'string'], ['Saved At', 'string'], ['Saved By', 'string'], ['Status', 'string'], ['Retention Target Pct', 'number'], ['Comp Adjustment Pct', 'number'], ['Ld Investment Gbp M', 'number'], ['Mobility Allocation Pct', 'number'], ['Hiring Freeze Months', 'number'], ['Baseline Headcount', 'number'], ['Trajectory Attrition', 'number'], ['Projected Attrition', 'number'], ['Employees Retained', 'number'], ['Replacement Avoided Gbp', 'number'], ['Investment Gbp', 'number'], ['Net Benefit Gbp', 'number'], ['Critical Coverage After', 'number'], ['Record Source', 'string'], ['Scenario Count', 'number']];
    const row = [x.id, x.name, popLabel(st.pop), st.pop.bu ?? '', st.preset, new Date().toISOString().slice(0, 16).replace('T', ' '), ctx.persona.name, status, st.L.r, st.L.c, st.L.ld, st.L.m, st.L.f, Math.round(p.HC), Number(p.traj.toFixed(4)), Number(p.rate.toFixed(4)), Math.round(p.retained), Math.round(p.replacementAvoided), Math.round(p.investment), Math.round(p.net), Number(p.cov1.toFixed(4)), 'People Intelligence app · writeback', 1];
    ctx.writeback('Saved Scenarios', F, [row]).then((res) => {
      ctx.toast(res.written ? `Scenario <b>${esc(x.id)}</b> written to Snowflake (PEOPLE_SCENARIOS)` : `Saved scenario <b>${esc(x.name)}</b> in this browser (writeback unavailable here)`, res.written ? 'cloud_done' : 'bookmark_added');
      if (res.written) ctx.requery('s-saved');
    });
    return x;
  };
  const share = (p) => {
    const text = `People Intelligence — scenario: Reduce ${popLabel(st.pop)} attrition (${st.preset})\nRetain ~${int(p.retained)} employees over 12 months; attrition ${pct(p.traj)} → ${pct(p.rate)}.\nInvestment ${gbp(p.investment)}; replacement cost avoided ${gbp(p.replacementAvoided)}; net ${gbp(p.net)}.\nCritical skills coverage ${pct(p.cov0, 0)} → ${pct(p.cov1, 0)}.\nLevers: ${LEVERS.map(([k, l]) => `${l} ${fmtLever(k, st.L[k])}`).join('; ')}.\n(Illustrative data; governed baseline from the Astrato semantic layer.)`;
    navigator.clipboard?.writeText(text).then(() => ctx.toast('Leadership summary copied to the clipboard', 'content_copy'), () => ctx.toast('Summary ready to share', 'ios_share'));
  };
  const submit = (p, status) => {
    const x = save(status === 'Submitted' ? 'Submitted' : 'Saved');
    const label = popLabel(st.pop);
    const a = ctx.actions.create({
      name: `${label} Retention Programme (${st.preset})`, bu: st.pop.bu ?? 'Group Functions', country: st.pop.country ?? 'Group', type: st.L.f > 0 && st.L.r === 0 ? 'Cost' : 'Retention',
      owner: 'Hannah Clarke (HRBP, UK Technology)', metric: `Voluntary attrition (LTM) in ${label}`, baseline: p.traj, target: p.rate, investment: Math.round(p.investment), benefit: Math.round(p.replacementAvoided + p.freezeSaving + p.mobilitySaving),
      insight: `Critical | ${label} retention risk`, evidence: { page: 'tr', pop: st.pop },
      scenario: { Scenario: x.id, ...Object.fromEntries(LEVERS.map(([k, l]) => [l, fmtLever(k, st.L[k])])), 'Employees retained (12m)': int(p.retained), 'Net benefit (12m)': gbp(p.net) },
    });
    if (status === 'Submitted') { ctx.actions.submit(a.id); ctx.toast(`Created <b>${esc(a.id)}</b> and submitted for approval`, 'send'); } else ctx.toast(`Action plan <b>${esc(a.id)}</b> created as a draft`, 'checklist');
    ctx.actions.open(a.id);
  };
  const renderCompare = () => {
    const list = scenarios();
    compare.replaceChildren(el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: 'Compare saved scenarios' }), el('div', { class: 'tools' }, list.length ? el('button', { class: 'pi-btn sm ghost', onclick: () => { saveScenarios([]); renderCompare(); } }, [icon('delete_sweep'), el('span', { text: 'Clear' })]) : null)]),
      list.length ? el('div', { style: 'overflow-x:auto' }, el('table', { class: 'pi-t' }, [el('tr', {}, ['Scenario', 'Retained', 'Attrition', 'Investment', 'Net', 'Coverage', ''].map((h, i) => el('th', { class: i && i < 6 ? 'r' : '', text: h }))),
        ...list.map((x) => el('tr', {}, [el('td', { html: `<b>${esc(x.name)}</b><div class="pi-note">${esc(x.id)} · ${esc(x.at)} · ${esc(x.by)}${x.status !== 'Saved' ? ` · ${esc(x.status)}` : ''}</div>` }), el('td', { class: 'r', text: int(x.retained) }), el('td', { class: 'r', text: pct(x.rate) }), el('td', { class: 'r', text: gbp(x.investment) }), el('td', { class: 'r', html: `<b style="color:${x.net >= 0 ? '#2E8540' : '#D92D20'}">${gbp(x.net)}</b>` }), el('td', { class: 'r', text: pct(x.cov, 0) }),
          el('td', { class: 'r' }, el('button', { class: 'pi-btn sm', onclick: () => { st.pop = { ...x.pop }; st.L = { ...x.L }; st.preset = 'Loaded'; renderHero(); renderLevers(); loadBase(); } }, el('span', { text: 'Load' })))]))])) : el('p', { class: 'pi-note', text: 'Save scenarios to compare them side by side. Saved scenarios persist for this demo session in your browser.' }));
  };

  let baseRun = 0;
  const loadBase = async () => {
    const my = ++baseRun;
    st.base = null; renderHero(); renderResults();
    const F = popFilters(st.pop);
    const FB = F.filter(([f]) => f !== 'Seniority');
    try {
      const [[w] = {}, [k] = {}, [r] = {}] = await Promise.all([
        ctx.q({ measures: ['Headcount', 'Voluntary Attrition', 'Voluntary Attrition P2Q', 'Voluntary Leavers LTM', 'Replacement Cost Exposure', 'Payroll Cost LTM', 'Critical Role Headcount', 'External Hires LTM'], filters: F, limit: 1 }),
        ctx.q({ measures: ['Critical Skills Coverage', 'Required FTE'], filters: [...FB, ['Skill Tier', 'Skills', ['Strategic']]], limit: 1 }),
        ctx.q({ measures: ['Average Cost per Hire'], filters: F, limit: 1 }),
      ]);
      if (my !== baseRun) return;
      st.base = { ...Object.fromEntries(Object.entries({ ...w, ...k, ...r }).map(([a, v]) => [a, Number(v ?? 0)])) };
      if (!st.base['Critical Skills Coverage']) st.base['Critical Skills Coverage'] = 0.7;
      window.__sim = st;
      renderResults();
    } catch (e) { results.replaceChildren(el('p', { class: 'pi-note', text: `Baseline query failed: ${e?.message ?? e}` })); }
    if (histId) ctx.dropTile(histId);
    const slot = el('div', { class: 'viz' });
    history.replaceChildren(el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: `Governed history · rolling attrition, ${popLabel(st.pop)}` })]), el('div', { class: 'pi-bq' }, [icon('verified'), el('span', { text: 'How has voluntary attrition trended for this population?' })]), slot);
    histId = await ctx.renderTile({ title: 'Rolling attrition', type: 'combo', dims: [['Month', 'Months']], measures: ['Monthly Headcount', 'Rolling Voluntary Attrition'], filters: F, sort: [{ by: 'd0', direction: 'asc' }], graphTypes: { m0: 'bar', m1: 'line' }, secondary: 'm1', measureColors: { m0: '#D5D5D5', m1: '#2B5CE6' }, legend: true }, slot, { group: 'g-sim' });
  };

  const open = (pop, preset) => {
    st.pop = { ...(pop ?? {}) };
    if (ctx.persona.key === 'hrbp') { st.pop.country = 'United Kingdom'; st.pop.bu = 'Technology'; }
    const k = preset === 'cost' ? 'Cost containment' : 'Balanced retention';
    st.L = { ...PRESETS[k] }; st.preset = k;
    renderLevers(); loadBase(); renderCompare();
  };
  renderLevers(); renderCompare(); ctx.onPageMount('sim', () => { if (!st.base) loadBase(); });
  ctx.onPersona(() => loadBase());
  return { open, state: st, project };
};
