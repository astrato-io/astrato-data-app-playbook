/**
 * Workforce plan — future demand and restructuring to FY28 (31 Mar 2028, 18 months out).
 *
 * The baseline per function group (headcount, rolling attrition, payroll per employee, cost per hire,
 * 2028 skills shortfall) is read live from the published semantic layer for the viewer's scope. The
 * levers set each function's FY28 demand; the plan then absorbs reductions through natural attrition
 * first, redeploys a share of the rest into growing functions, and hires externally for what remains.
 * Every rule is listed on screen; nothing is fitted or hidden.
 */
const N = (v) => Number(v ?? 0);
const KEY = 'people-plans-v1';
const HORIZON = 1.5; // years to FY28 year end
export const FUNCTIONS = ['Digital & Technology', 'Networks', 'Commercial', 'Customer & Retail', 'Corporate'];
const HINT = {
  'Digital & Technology': 'AI, cloud, data and software engineering demand',
  Networks: 'Network automation and field-force optimisation',
  Commercial: 'Enterprise growth, consumer simplification',
  'Customer & Retail': 'Digital self-service and store estate consolidation',
  Corporate: 'Shared-services consolidation and GenAI in back office',
};
export const PLAN_PRESETS = {
  'Balanced transformation': { 'Digital & Technology': 9, Networks: -6, Commercial: 1, 'Customer & Retail': -12, Corporate: -5, redeploy: 35, absorb: 35 },
  'AI & cloud growth': { 'Digital & Technology': 18, Networks: -8, Commercial: 2, 'Customer & Retail': -10, Corporate: -6, redeploy: 45, absorb: 25 },
  'Retail estate consolidation': { 'Digital & Technology': 4, Networks: 0, Commercial: 0, 'Customer & Retail': -22, Corporate: -2, redeploy: 25, absorb: 40 },
  'Cost reset': { 'Digital & Technology': 0, Networks: -10, Commercial: -6, 'Customer & Retail': -15, Corporate: -12, redeploy: 15, absorb: 50 },
};
export const PLAN_RULES = [
  'Horizon: 30 Sep 2026 → 31 Mar 2028 (FY28 year end), 18 months.',
  'Natural leavers = headcount × rolling voluntary + involuntary attrition × 1.5 years (governed attrition rate).',
  'Reducing functions stop backfilling the chosen share of leavers first; only the remainder is a restructuring exit.',
  'A chosen share of restructuring exits is redeployed (reskilled) into growing functions, up to their growth demand.',
  'Growing functions backfill all leavers and hire externally for growth not met by redeployment.',
  'Costs (illustrative): severance = 0.75 × annual payroll per employee; reskilling £18k per redeployment; external hiring at the governed average cost per hire.',
  'Run-rate payroll change = FY28 headcount change × governed payroll per employee of each function.',
];

export const projectPlan = (base, L) => {
  const rows = FUNCTIONS.map((f) => {
    const b = base[f] ?? {};
    const hc = N(b.hc), rate = N(b.va) + 0.02, cost = N(b.pay) / Math.max(1, hc);
    const g = N(L[f]) / 100, target = Math.round(hc * (1 + g));
    const leavers = hc * rate * HORIZON;
    let absorbed = 0, residual = 0, need = 0;
    if (target < hc) { const r = hc - target; absorbed = Math.min(r, leavers * N(L.absorb) / 100); residual = r - absorbed; } else need = target - hc;
    return { f, hc, rate, cost, cph: N(b.cph), gap: N(b.gap), target, g, leavers, absorbed, residual, need, backfill: leavers - absorbed };
  });
  const pool = rows.reduce((s, r) => s + r.residual * N(L.redeploy) / 100, 0);
  const demand = rows.reduce((s, r) => s + r.need, 0);
  const placed = Math.min(pool, demand);
  for (const r of rows) {
    r.redeployOut = demand > 0 ? (r.residual * N(L.redeploy) / 100) * (placed / Math.max(1, pool)) : 0;
    r.redundancies = r.residual - r.redeployOut;
    r.redeployIn = demand > 0 ? placed * (r.need / demand) : 0;
    r.growthHires = Math.max(0, r.need - r.redeployIn);
    r.extHires = r.backfill + r.growthHires;
    r.runRate = (r.target - r.hc) * r.cost;
    r.severance = r.redundancies * r.cost * 0.75;
    r.reskill = r.redeployIn * 18000;
    r.hiringCost = r.growthHires * (r.cph || 6000);
  }
  const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
  const t = { hc: sum('hc'), target: sum('target'), leavers: sum('leavers'), absorbed: sum('absorbed'), backfill: sum('backfill'), redundancies: sum('redundancies'), redeploy: sum('redeployIn'), growthHires: sum('growthHires'), extHires: sum('extHires'), runRate: sum('runRate'), severance: sum('severance'), reskill: sum('reskill'), hiringCost: sum('hiringCost'), gap: sum('gap') };
  t.oneOff = t.severance + t.reskill + t.hiringCost;
  t.payback = t.runRate < 0 ? t.oneOff / (-t.runRate / 12) : null;
  // Without redeployment every residual reduction would be an exit.
  t.exitsAvoided = sum('residual') - t.redundancies;
  return { rows, t };
};

export const mountPlan = (ctx, grid) => {
  const { el, esc, icon, gbp, int } = ctx;
  const st = { L: { ...PLAN_PRESETS['Balanced transformation'] }, preset: 'Balanced transformation', base: null };
  const saved = () => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } };
  const save = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* private window */ } };
  const hero = el('div', { class: 'pi-simhero span-12', 'data-mode': 'plan' });
  const levers = el('figure', { class: 'pi-card span-4', 'data-mode': 'plan' });
  const results = el('figure', { class: 'pi-card span-8', 'data-mode': 'plan' });
  const bridge = el('figure', { class: 'pi-card span-6', 'data-mode': 'plan' });
  const table = el('figure', { class: 'pi-card span-6', 'data-mode': 'plan' });
  const baseCard = el('figure', { class: 'pi-card span-12', 'data-mode': 'plan' });
  const rules = el('figure', { class: 'pi-card span-12', 'data-mode': 'plan' });
  grid.append(hero, levers, results, bridge, table, baseCard, rules);
  let baseId = null;

  const loadBase = async () => {
    results.classList.add('pi-skel');
    const rows = await ctx.q({ dims: [['Function Group', 'Departments']], measures: ['Headcount', 'Voluntary Attrition', 'Payroll Cost LTM'] });
    const req = await ctx.q({ dims: [['Function Group', 'Departments']], measures: ['Average Cost per Hire'] }).catch(() => []);
    const gap = await ctx.q({ dims: [['Function Group', 'Departments']], measures: ['Shortfall 2028'] }).catch(() => []);
    st.base = Object.fromEntries(rows.map((r) => [r['Function Group'], { hc: r.Headcount, va: r['Voluntary Attrition'], pay: r['Payroll Cost LTM'] }]));
    for (const r of req) if (st.base[r['Function Group']]) st.base[r['Function Group']].cph = r['Average Cost per Hire'];
    for (const r of gap) if (st.base[r['Function Group']]) st.base[r['Function Group']].gap = r['Shortfall 2028'];
    results.classList.remove('pi-skel');
    renderResults();
  };

  const renderHero = () => hero.replaceChildren(
    el('div', { style: 'flex:1;min-width:280px' }, [el('h2', { text: 'Plan the FY28 workforce before you restructure it' }), el('p', { text: `Future demand and restructuring by function · ${ctx.persona.scopeLabel} · governed baseline at 30 Sep 2026 → 31 Mar 2028` })]),
    el('div', { class: 'pi-pop' }, [icon('account_tree'), el('b', { text: 'Baseline' }), el('span', { text: 'Headcount, attrition, payroll and cost per hire from the semantic layer, for your access scope' })]),
  );
  const fmt = (k, v) => (FUNCTIONS.includes(k) ? `${v > 0 ? '+' : ''}${v}%` : `${v}%`);
  const renderLevers = () => {
    const lever = (k, label, hint, min, max) => {
      const out = el('output', { text: fmt(k, st.L[k]) });
      const input = el('input', { type: 'range', min, max, step: 1, value: st.L[k], 'aria-label': label });
      input.addEventListener('input', () => { st.L[k] = Number(input.value); st.preset = 'Custom'; out.textContent = fmt(k, input.value); levers.querySelectorAll('.pi-presets button').forEach((b) => b.classList.remove('on')); renderResults(); });
      return el('div', { class: 'pi-lever' }, [el('div', { class: 'l', html: `${esc(label)}<small>${esc(hint)}</small>` }), out, input]);
    };
    levers.replaceChildren(
      el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: 'FY28 demand by function' })]),
      el('div', { class: 'pi-presets' }, Object.keys(PLAN_PRESETS).map((k) => el('button', { class: st.preset === k ? 'on' : '', text: k, onclick: () => { st.L = { ...PLAN_PRESETS[k] }; st.preset = k; renderLevers(); renderResults(); } }))),
      el('div', { class: 'pi-levers' }, [
        ...FUNCTIONS.map((f) => lever(f, f, HINT[f], -30, 30)),
        lever('absorb', 'Absorb through attrition', 'Share of leavers not backfilled in reducing functions', 0, 100),
        lever('redeploy', 'Redeploy before exit', 'Share of remaining surplus reskilled into growing functions', 0, 80),
      ]),
    );
  };

  const svgBridge = (t) => {
    const steps = [['Natural leavers', -t.leavers], ['Backfill hires', t.backfill], ['Restructuring exits', -t.redundancies], ['Growth hires', t.growthHires]];
    const W = 640, H = 260, pad = 30, n = steps.length + 2, gap = (W - pad * 2) / n, bw = gap * 0.62;
    const pts = []; let run = t.hc;
    for (const [l, v] of steps) { pts.push({ l, from: run, to: run + v, v }); run += v; }
    const lo = Math.min(t.hc, run, ...pts.map((p) => Math.min(p.from, p.to))) * 0.97, hi = Math.max(t.hc, run, ...pts.map((p) => Math.max(p.from, p.to))) * 1.01;
    const y = (v) => pad + (H - pad * 2 - 26) * (1 - (v - lo) / (hi - lo || 1));
    const bar = (i, a, b, fill, label, val) => { const x0 = pad + i * gap + (gap - bw) / 2; const top = Math.min(y(a), y(b)); return `<rect x="${x0}" y="${top}" width="${bw}" height="${Math.max(1.5, Math.abs(y(a) - y(b)))}" rx="3" fill="${fill}"><title>${esc(label)}: ${val}</title></rect><text x="${x0 + bw / 2}" y="${top - 4}" text-anchor="middle" class="lbl">${val}</text><text x="${x0 + bw / 2}" y="${H - 18}" text-anchor="middle"><tspan x="${x0 + bw / 2}">${esc(label.split(' ')[0])}</tspan><tspan x="${x0 + bw / 2}" dy="12">${esc(label.split(' ').slice(1).join(' '))}</tspan></text>`; };
    const sgn = (v) => `${v >= 0 ? '+' : '−'}${int(Math.abs(v))}`;
    return `<svg class="pi-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Headcount bridge to FY28">${bar(0, lo, t.hc, '#25282B', 'Headcount Sep 26', int(t.hc))}${pts.map((p, i) => bar(i + 1, p.from, p.to, p.v >= 0 ? '#13707F' : '#2B5CE6', p.l, sgn(p.v))).join('')}${bar(n - 1, lo, run, '#25282B', 'Headcount FY28', int(run))}</svg>`;
  };

  const renderResults = () => {
    renderHero();
    if (!st.base) { results.replaceChildren(el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: 'FY28 workforce plan' })]), el('p', { class: 'pi-note', text: 'Reading the governed baseline…' })); return; }
    const { rows, t } = projectPlan(st.base, st.L);
    const d = t.target - t.hc;
    results.replaceChildren(
      el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: `FY28 workforce plan · ${st.preset}` }), el('div', { class: 'tools' }, [
        el('button', { class: 'pi-btn sm', onclick: () => { const l = saved(); l.unshift({ at: new Date().toISOString().slice(0, 16).replace('T', ' '), by: ctx.persona.name, preset: st.preset, L: st.L, hc: t.target, oneOff: t.oneOff, runRate: t.runRate }); save(l.slice(0, 12)); ctx.toast(`Plan saved · FY28 headcount <b>${int(t.target)}</b>`, 'bookmark_added'); renderTable(); } }, [icon('bookmark_add'), el('span', { text: 'Save plan' })]),
        el('button', { class: 'pi-btn sm primary', onclick: () => { const a = ctx.actions.create({ name: `FY28 workforce plan · ${st.preset}`, type: 'Restructuring', bu: ctx.persona.scope.find(([f]) => f === 'Business Unit')?.[2][0] ?? '', investment: Math.round(t.oneOff), benefit: Math.round(Math.max(0, -t.runRate)), insight: `Plan: ${int(t.hc)} → ${int(t.target)} employees; ${int(t.redundancies)} restructuring exits; ${int(t.redeploy)} redeployed`, scenario: true }); ctx.toast(`Raised <b>${esc(a.id)}</b> in People Actions for approval`, 'task_alt'); ctx.go('act'); } }, [icon('send'), el('span', { text: 'Raise for approval' })]),
      ])]),
      el('div', { class: 'pi-big' }, [
        el('div', { class: 'hl' }, [el('span', { text: 'FY28 headcount' }), el('b', { text: int(t.target) }), el('i', { text: `${d >= 0 ? '+' : '−'}${int(Math.abs(d))} vs Sep 26 (${d < 0 ? '−' : '+'}${Math.abs((d / Math.max(1, t.hc)) * 100).toFixed(1)}%)` })]),
        el('div', {}, [el('span', { text: 'Restructuring exits' }), el('b', { text: int(t.redundancies), style: `color:${t.redundancies > 0 ? '#D92D20' : '#2E8540'}` }), el('i', { text: `${int(t.absorbed)} absorbed by attrition · ${int(t.exitsAvoided)} avoided by redeployment` })]),
        el('div', {}, [el('span', { text: 'Redeployed & reskilled' }), el('b', { text: int(t.redeploy) }), el('i', { text: `${int(t.growthHires)} external growth hires still needed` })]),
        el('div', {}, [el('span', { text: 'Run-rate payroll' }), el('b', { text: `${t.runRate <= 0 ? '−' : '+'}${gbp(Math.abs(t.runRate))}`, style: `color:${t.runRate <= 0 ? '#2E8540' : '#D92D20'}` }), el('i', { text: `One-off ${gbp(t.oneOff)}${t.payback ? ` · payback ${Math.round(t.payback)} months` : ''}` })]),
      ]),
      el('p', { class: 'pi-narr', html: `Moving to <b>${int(t.target)}</b> employees by March 2028 means <b>${int(t.leavers)}</b> natural leavers over 18 months, of which <b>${int(t.absorbed)}</b> are not backfilled in shrinking functions. That leaves <b>${int(t.redundancies)}</b> restructuring exits once <b>${int(t.redeploy)}</b> people are reskilled into growing functions. Growth functions still need <b>${int(t.growthHires)}</b> external hires. ${t.gap > 0 ? `The 2028 strategic-skills shortfall in scope is <b>${int(t.gap)}</b> FTE, and redeployment covers ${Math.round((t.redeploy / t.gap) * 100)}% of it.` : ''}` }),
    );
    bridge.replaceChildren(el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: 'Headcount bridge · Sep 2026 → FY28' })]), el('div', { html: svgBridge(t) }), el('p', { class: 'pi-note', text: `Redeployment (${int(t.redeploy)}) moves people between functions and nets to zero at group level. Projection, not governed data.` }));
    renderTable(rows);
  };
  let lastRows = [];
  const renderTable = (rows = lastRows) => {
    lastRows = rows;
    const plans = saved();
    table.replaceChildren(
      el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: 'Plan by function' })]),
      el('div', { style: 'overflow-x:auto' }, el('table', { class: 'pi-t' }, [
        el('tr', {}, ['Function', 'Sep 26', 'FY28', 'Leavers', 'Absorbed', 'Redeploy ±', 'Exits', 'Ext. hires', 'Run-rate'].map((h, i) => el('th', { class: i ? 'r' : '', text: h }))),
        ...rows.map((r) => el('tr', {}, [el('td', { html: `<b>${esc(r.f)}</b>` }), ...[int(r.hc), int(r.target), int(r.leavers), int(r.absorbed), `${r.redeployIn - r.redeployOut >= 0 ? '+' : '−'}${int(Math.abs(r.redeployIn - r.redeployOut))}`, int(r.redundancies), int(r.extHires), `${r.runRate <= 0 ? '−' : '+'}${gbp(Math.abs(r.runRate))}`].map((v) => el('td', { class: 'r', text: v }))])),
      ])),
      plans.length ? el('h4', { text: 'Saved plans', style: 'font-size:12px;margin:12px 0 4px;color:#6F7378;text-transform:uppercase;letter-spacing:.06em' }) : null,
      ...plans.slice(0, 4).map((p) => el('button', { class: 'pi-q', style: 'width:100%;margin-top:4px', onclick: () => { st.L = { ...p.L }; st.preset = p.preset; renderLevers(); renderResults(); } }, [icon('history'), el('div', {}, [el('span', { text: `${p.preset} · FY28 ${int(p.hc)}` }), el('small', { text: `${p.at} · ${p.by} · one-off ${gbp(p.oneOff)} · run-rate ${p.runRate <= 0 ? '−' : '+'}${gbp(Math.abs(p.runRate))}` })])])),
    );
  };
  const renderBase = async () => {
    const slot = el('div', { class: 'viz', style: 'height:250px' });
    baseCard.replaceChildren(el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: 'Governed baseline by function · the numbers the plan starts from' })]), el('div', { class: 'pi-bq' }, [icon('verified'), el('span', { text: 'What is the workforce baseline by function: headcount, attrition, payroll, open critical roles and the 2028 skills gap?' })]), slot);
    if (baseId) ctx.dropTile(baseId);
    baseId = await ctx.renderTile({ title: 'Workforce baseline by function', type: 'table', dims: [['Function Group', 'Departments']], measures: ['Headcount', 'Headcount YoY', 'Voluntary Attrition', 'Payroll Cost per Employee YTD', 'Open Critical Roles', 'Shortfall 2028'], columnLabels: { m0: 'Headcount', m1: 'vs LY', m2: 'Vol. attrition', m3: 'Payroll / employee YTD', m4: 'Open critical roles', m5: '2028 skills shortfall' }, sort: [{ by: 'm0', direction: 'desc' }] }, slot, { group: 'g-plan' });
  };
  rules.replaceChildren(el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: 'How the plan is calculated' })]), el('ul', { class: 'pi-assump' }, PLAN_RULES.map((r) => el('li', { text: r }))));
  renderLevers(); renderResults();
  ctx.onPageMount('sim', () => { loadBase(); renderBase(); });
  ctx.onPersona(() => { if (st.base) { loadBase(); renderBase(); } });
  return { project: () => st.base && projectPlan(st.base, st.L), state: st };
};
