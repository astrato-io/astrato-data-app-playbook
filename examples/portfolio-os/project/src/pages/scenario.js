/** Scenario Lab — company scenarios with live recalculation, side-by-side comparison, waterfalls, sensitivities and portfolio propagation. */
import { el, esc, icon, money, smoney, pct, spct, pts, mult, smult, tone, N, me, can, denied, saveRecord, records, record, onStore, openDrawer, ask, pill, eventsFor, toast, writeTable, iso, audit } from '../core.js';
import { M, co, currentVal, returnsOf, scenarioBase, planOf, planDrivers, activePlan, fundFV } from '../data.js';
import { projectScenario, DRIVERS } from '../engine.js';
import { sheet, btn, section, waterfall, kv, spark } from '../ui.js';

const F = (name, valueType = 'string') => ({ name, valueType });
const SOURCES = ['Approved Forecast', 'Original Investment Case', 'Latest Budget', 'Downside Case', 'Value Creation Case'];

/** Replace the official operating plan with approved drivers (governed writeback on Plans + audit). */
export const adoptPlan = async (ctx, name, drivers, { scenarioId, ref, reason }) => {
  const prev = activePlan(name);
  const c = co(name);
  const version = Math.max(...M.plans.filter((p) => p.Company === name).map((p) => p.Version || 1)) + 1;
  const planId = `${c['Company Id']}-AOP${version}`;
  const row = { ...prev, 'Plan Id': planId, Plan: `Approved Operating Plan v${version}`, Status: 'Active', Note: `Adopted from ${scenarioId}${ref ? ` · ${ref}` : ''}`, Growth: drivers.growth, Price: drivers.price, Retention: drivers.retention, Gm: drivers.gm, Personnel: drivers.personnel, Opex: drivers.opex, Capex: drivers.capex, Nwc: drivers.nwc, Rate: drivers.rate, Repay: drivers.repay, Acq: drivers.acq, 'Exit Year': drivers.exitYear, 'Exit Multiple': drivers.exitMultiple, 'Multiple Shift': 0, Version: version, 'Approved By': me().name, 'Approved At': new Date().toISOString().slice(0, 10) };
  await writeTable({ view: 'Plans', operation: 'update', fields: [F('Status')], values: [['Superseded']], keys: { fields: [F('Plan Id')], values: [[prev['Plan Id']]] } }, ['Plan', prev['Plan Id'], 'Operating plan superseded', { prev: 'Active', next: 'Superseded', reason, ref }]);
  const cols = ['Company Id', 'Company', 'Plan Id', 'Plan', 'Status', 'Note', 'Growth', 'Price', 'Retention', 'Gm', 'Personnel', 'Opex', 'Capex', 'Nwc', 'Rate', 'Repay', 'Acq', 'Exit Year', 'Exit Multiple', 'Multiple Shift', 'Base Revenue', 'Base Ebitda', 'Base Debt', 'Base Cash', 'Base Other Claims', 'Base Nonop', 'Ntm Multiple', 'Version', 'Approved By', 'Approved At'];
  const num = new Set(['Growth', 'Price', 'Retention', 'Gm', 'Personnel', 'Opex', 'Capex', 'Nwc', 'Rate', 'Repay', 'Acq', 'Exit Year', 'Exit Multiple', 'Multiple Shift', 'Base Revenue', 'Base Ebitda', 'Base Debt', 'Base Cash', 'Base Other Claims', 'Base Nonop', 'Ntm Multiple', 'Version']);
  row['Company Id'] = c['Company Id'];
  await writeTable({ view: 'Plans', operation: 'insert', fields: cols.map((k) => F(k, num.has(k) ? 'number' : k === 'Approved At' ? 'date' : 'string')), values: [cols.map((k) => (k === 'Approved At' ? `${row[k]}T00:00:00Z` : row[k]))] }, ['Plan', planId, 'Approved operating plan adopted', { prev: prev.Plan, next: row.Plan, reason, ref }]);
  prev.Status = 'Superseded';
  M.plans.push(row);
  window.dispatchEvent(new Event('nsos-model'));
  return row;
};

export const mountScenario = (ctx, pane) => {
  const { go } = ctx;
  let name = M.companies.find((c) => c.Company.startsWith('Meridian'))?.Company;
  let source = 'Approved Forecast';
  let D = null, S = null; // working drivers, source drivers
  let loadedId = null;
  const picker = el('select', { 'aria-label': 'Company' }, [...M.companies].sort((a, b) => a.Company.localeCompare(b.Company)).map((c) => el('option', { value: c.Company, text: c.Company })));
  const srcSel = el('select', { 'aria-label': 'Create from' });
  const levers = el('div', { class: 'levers' }), out = el('div', { class: 'scn-out' }), compare = el('div'), propagate = el('div'), sens = el('div'), saved = el('div');
  const header = el('div', { class: 'scn-head' });

  const fillSources = () => {
    const mine = records('Scenario', (r) => r.company === name);
    srcSel.replaceChildren(...[activePlan(name)?.Plan, ...SOURCES].filter((x, i, a) => x && a.indexOf(x) === i).map((s) => el('option', { value: `plan:${s}`, text: s === activePlan(name)?.Plan ? `${s} (official operating plan)` : s })), ...mine.map((r) => el('option', { value: `rec:${r.id}`, text: `Saved: ${r.title} · ${r.status}` })));
    srcSel.value = `plan:${source}`;
  };
  const planBy = (label) => M.plans.filter((p) => p.Company === name && p.Plan === label).sort((a, b) => b.Version - a.Version)[0];
  const load = (val) => {
    if (val.startsWith('plan:')) { source = val.slice(5); S = planDrivers(planBy(source)); D = { ...S }; loadedId = null; }
    else { const r = record(val.slice(4)); S = planDrivers(planBy(r.payload.from) ?? activePlan(name)); D = { ...S, ...r.payload.drivers }; source = r.payload.from; loadedId = r.id; }
    renderLevers(); recalc();
  };
  srcSel.onchange = () => load(srcSel.value);
  picker.onchange = () => { name = picker.value; source = 'Approved Forecast'; fillSources(); load('plan:Approved Forecast'); };

  const renderLevers = () => {
    levers.replaceChildren(...DRIVERS.map(([k, label, unit, min, max, step]) => {
      const o = el('b'), dlt = el('small');
      const input = el('input', { type: 'range', min, max, step, value: D[k], 'aria-label': label });
      const show = () => { o.textContent = `${unit === '$m' ? '$' : ''}${Number(D[k]).toFixed(step < 1 ? (step < 0.25 ? 3 : 2) : 0)}${unit === '$m' ? 'm' : unit === 'yr' ? '' : unit === 'x' ? 'x' : unit === 'pts' ? ' pts' : '%'}`; const d = D[k] - S[k]; dlt.textContent = Math.abs(d) < 1e-9 ? '' : `${d > 0 ? '+' : ''}${d.toFixed(step < 1 ? 2 : 0)}`; dlt.className = Math.abs(d) < 1e-9 ? '' : 'chg'; };
      input.oninput = () => { D[k] = Number(input.value); show(); recalc(); };
      show();
      return el('label', { class: 'lever' }, [el('span', { text: label }), input, o, dlt]);
    }));
  };
  const runOf = (drivers) => projectScenario(scenarioBase(name), drivers);
  let last = null;
  const recalc = () => {
    const base = scenarioBase(name);
    const r = runOf(D), b = runOf(planDrivers(planBy('Approved Forecast')));
    last = { r, b };
    const fvToday = r.today.fairValue, fvBase = base.approvedFV;
    header.replaceChildren(
      el('div', {}, [el('h3', { text: `${name} · ${loadedId ? record(loadedId)?.title : `working scenario from ${source}`}` }), el('p', { class: 'muted', text: `Base year: LTM to Q3 2026 — revenue ${money(base.revenue, 0)}, EBITDA ${money(base.ebitda, 0)}, net debt ${money(base.debt - base.cash, 0)}, ${pct(base.ownership, 0)} ownership. Approved fair value ${money(fvBase)} (${base.approvedQuarter}) implies ${mult(base.ntmMultiple, 2)} NTM EBITDA.` })]),
      el('div', { class: 'scn-kpis' }, [['Fair value today', money(fvToday), smoney(fvToday - fvBase), tone(fvToday - fvBase)], ['Equity value (100%)', money(r.today.equity, 0), `${mult(r.todayMultiple, 2)} NTM`, ''], [`Exit ${r.exit.year} proceeds`, money(r.exit.proceeds, 0), `EV ${money(r.exit.ev, 0)}`, ''], ['Gross MOIC', `${r.moic.toFixed(2)}x`, `${smult(r.moic - b.moic, 2)} vs base`, tone(r.moic - b.moic)], ['Gross IRR', pct(r.irr), pts(r.irr - b.irr), tone(r.irr - b.irr)], [`Net leverage ${r.years[0].year}`, mult(r.years[0].leverage), `cover ${mult(r.years[0].coverage)}`, r.years[0].leverage > 6 ? 'neg' : '']].map(([k, v, s, t]) => el('div', {}, [el('small', { text: k }), el('b', { text: v }), el('span', { class: t, text: s })]))),
    );
    // projections
    out.replaceChildren(sheet([{ key: 'k', label: 'Forecast ($m)' }, ...r.years.map((y) => ({ key: String(y.year), label: `FY${y.year}` }))], [
      ['Revenue', 'revenue', (v) => money(v, 0)], ['EBITDA', 'ebitda', (v) => money(v, 0)], ['EBITDA margin', 'margin', (v) => pct(v)], ['Free cash flow', 'fcf', (v) => money(v, 0)], ['Cash conversion', 'conversion', (v) => pct(v, 0)], ['Debt balance', 'debt', (v) => money(v, 0)], ['Net leverage', 'leverage', mult], ['Interest cover', 'coverage', mult],
    ].map(([k, f, fm]) => ({ k, ...Object.fromEntries(r.years.map((y) => [String(y.year), fm(y[f])])) }))));
    // compare
    const cases = [['Base Case', planDrivers(planBy('Approved Forecast'))], ['Downside Case', planDrivers(planBy('Downside Case'))], ['Value Creation Case', planDrivers(planBy('Value Creation Case'))], ['Working scenario', D]].map(([n, d]) => [n, runOf(d), d]);
    compare.replaceChildren(
      sheet([{ key: 'k', label: 'Output' }, ...cases.map(([n]) => ({ key: n, label: n }))], [
        ['Revenue FY+1', (x) => money(x.years[0].revenue, 0)], ['EBITDA FY+1', (x) => money(x.years[0].ebitda, 0)], ['EBITDA margin FY+1', (x) => pct(x.years[0].margin)], ['FCF FY+1', (x) => money(x.years[0].fcf, 0)], ['Net leverage FY+1', (x) => mult(x.years[0].leverage)], ['Enterprise value today', (x) => money(x.today.ev, 0)], ['Equity value today', (x) => money(x.today.equity, 0)], ['Northstar fair value today', (x) => money(x.today.fairValue)], ['Δ vs approved fair value', (x) => smoney(x.today.fairValue - scenarioBase(name).approvedFV)], ['Exit proceeds', (x) => money(x.exit.proceeds, 0)], ['Gross MOIC', (x) => `${x.moic.toFixed(2)}x`], ['Gross IRR', (x) => pct(x.irr)],
      ].map(([k, f]) => ({ k, ...Object.fromEntries(cases.map(([n, x]) => [n, f(x)])), __cls: k.startsWith('Δ') ? 'b' : '' }))),
      el('div', { class: 'cols2' }, [
        section('Valuation waterfall · approved → working scenario', waterfall([{ label: 'Approved fair value', value: scenarioBase(name).approvedFV, kind: 'total' }, { label: 'NTM EBITDA (operating drivers)', value: (r.years[0].ebitda - b.years[0].ebitda) * scenarioBase(name).ntmMultiple * scenarioBase(name).ownership, kind: 'delta' }, { label: 'Base plan vs approved', value: b.today.fairValue - scenarioBase(name).approvedFV, kind: 'delta' }, { label: 'Multiple change', value: (r.todayMultiple - b.todayMultiple) * r.years[0].ebitda * scenarioBase(name).ownership, kind: 'delta' }, { label: 'Scenario fair value', value: r.today.fairValue, kind: 'total' }], { height: 230 })),
        section('Downside vs base: where the value goes', waterfall((() => { const dn = cases[1][1], bs = cases[0][1], own = scenarioBase(name).ownership; return [{ label: 'Base fair value', value: bs.today.fairValue, kind: 'total' }, { label: 'Lower NTM EBITDA', value: (dn.years[0].ebitda - bs.years[0].ebitda) * bs.todayMultiple * own, kind: 'delta' }, { label: 'Multiple contraction', value: (dn.todayMultiple - bs.todayMultiple) * dn.years[0].ebitda * own, kind: 'delta' }, { label: 'Downside fair value', value: dn.today.fairValue, kind: 'total' }]; })(), { height: 230 })),
      ]),
    );
    // sensitivities (exit multiple × growth → MOIC; multiple shift × margin → fair value today)
    const mults = [-2, -1, 0, 1, 2].map((d) => D.exitMultiple + d), grows = [-4, -2, 0, 2, 4].map((d) => D.growth + d);
    const shifts = [-2, -1, 0, 1], margins = [-3, -1.5, 0, 1.5, 3];
    sens.replaceChildren(el('div', { class: 'cols2' }, [
      section('Gross MOIC · exit multiple × revenue growth', sheet([{ key: 'm', label: 'Exit multiple ↓ / growth →' }, ...grows.map((g) => ({ key: String(g), label: `${g.toFixed(1)}%` }))], mults.map((m) => ({ m: `${m.toFixed(2)}x`, ...Object.fromEntries(grows.map((g) => { const x = runOf({ ...D, exitMultiple: m, growth: g }).moic; return [String(g), `${x.toFixed(2)}x`]; })), __cls: Math.abs(m - D.exitMultiple) < 1e-9 ? 'b' : '' })))),
      section('Fair value today · multiple change × EBITDA margin (opex)', sheet([{ key: 's', label: 'Multiple Δ ↓ / margin →' }, ...margins.map((m) => ({ key: String(m), label: pts(m / 100) }))], shifts.map((s) => ({ s: smult(D.multipleShift + s), ...Object.fromEntries(margins.map((m) => [String(m), money(runOf({ ...D, multipleShift: D.multipleShift + s, opex: D.opex - m }).today.fairValue, 0)])) })))),
    ]));
    // portfolio propagation
    const fv0 = fundFV(), fv1 = fundFV({ [name]: r.today.fairValue });
    const fund = co(name).Fund;
    const inFund = M.companies.filter((c) => c.Fund === fund);
    const inv = (f) => M.companies.filter((c) => c.Fund === f).reduce((s, c) => s + returnsOf(c.Company).invested, 0);
    const real = (f) => M.companies.filter((c) => c.Fund === f).reduce((s, c) => s + returnsOf(c.Company).realised, 0);
    const tot0 = Object.values(fv0).reduce((s, v) => s + v, 0), tot1 = Object.values(fv1).reduce((s, v) => s + v, 0);
    propagate.replaceChildren(sheet([{ key: 'f', label: 'Fund' }, { key: 'a', label: 'Approved fair value', fmt: (v) => money(v, 0) }, { key: 'b', label: 'With scenario', fmt: (v) => money(v, 0) }, { key: 'd', label: 'Δ', fmt: (v) => smoney(v), tone: (v) => tone(v) }, { key: 'm0', label: 'Gross MOIC', fmt: (v) => `${v.toFixed(2)}x` }, { key: 'm1', label: 'MOIC with scenario', fmt: (v) => `${v.toFixed(2)}x` }, { key: 'conc', label: `${name.split(' ')[0]} share of fund`, fmt: (v) => (v == null ? '—' : pct(v)) }],
      [...M.funds.map((f) => ({ f: f.Fund, a: fv0[f.Fund], b: fv1[f.Fund], d: fv1[f.Fund] - fv0[f.Fund], m0: (real(f.Fund) + fv0[f.Fund]) / inv(f.Fund), m1: (real(f.Fund) + fv1[f.Fund]) / inv(f.Fund), conc: f.Fund === fund ? r.today.fairValue / fv1[f.Fund] : null, __cls: f.Fund === fund ? 'b' : '' })), { f: 'Portfolio', a: tot0, b: tot1, d: tot1 - tot0, m0: (M.funds.reduce((s, f) => s + real(f.Fund), 0) + tot0) / M.funds.reduce((s, f) => s + inv(f.Fund), 0), m1: (M.funds.reduce((s, f) => s + real(f.Fund), 0) + tot1) / M.funds.reduce((s, f) => s + inv(f.Fund), 0), conc: r.today.fairValue / tot1, __cls: 'tot' }]),
      el('p', { class: 'note', text: `Attribution follows ${name}'s ${pct(co(name)['Current Ownership'], 0)} economic ownership held by ${fund}. Expected exit proceeds ${money(r.exit.proceeds, 0)} in ${r.exit.year} (${inFund.length} investments in ${fund}).` }));
  };

  // ---------------------------------------------------------------- save / submit / approve
  const save = async (status = 'Saved') => {
    if (!can('scenario.save')) return denied('scenario.save');
    const existing = loadedId ? record(loadedId) : null;
    const nm = existing ? existing.title : await ask({ title: 'Save scenario', text: `${esc(name)} · from ${esc(source)}`, label: 'Scenario name', confirmLabel: 'Next', value: `${name.split(' ')[0]} ${source === 'Downside Case' ? 'downside' : 'revised plan'} ${new Date().toISOString().slice(0, 10)}` });
    if (!nm) return;
    const desc = existing ? existing.payload.description : await ask({ title: `Describe "${esc(nm)}"`, label: 'Description (what changed and why)', confirmLabel: 'Save scenario' });
    if (!desc) return;
    const r = last.r;
    const changes = Object.fromEntries(DRIVERS.map(([k]) => [k, D[k]]).filter(([k]) => Math.abs(D[k] - S[k]) > 1e-9));
    const rec = await saveRecord({ id: loadedId ?? undefined, prefix: 'SCN', type: 'Scenario', company: name, fund: co(name).Fund, period: '2026-Q3', title: nm, status, owner: me().name, payload: { description: desc, from: source, drivers: { ...D }, changes, results: { fairValue: r.today.fairValue, equity: r.today.equity, ev: r.today.ev, moic: r.moic, irr: r.irr, exitProceeds: r.exit.proceeds, years: r.years.map((y) => ({ year: y.year, revenue: y.revenue, ebitda: y.ebitda, fcf: y.fcf, debt: y.debt })) }, approvedFV: scenarioBase(name).approvedFV, lineage: 'engine.projectScenario v1 on governed LTM base (Plans view) + approved valuation' } }, { action: status === 'Submitted' ? 'Scenario submitted for approval' : 'Scenario saved', next: status, reason: `${desc} · FV ${money(r.today.fairValue)} (${smoney(r.today.fairValue - scenarioBase(name).approvedFV)})` });
    loadedId = rec.id; fillSources(); srcSel.value = `rec:${rec.id}`; renderSaved();
  };
  const decide = async (id, decision) => {
    if (!can('ic.decide')) return denied('ic.decide');
    const r = record(id);
    if (r.createdBy === me().name) { toast('Maker–checker: the scenario author cannot approve their own scenario', 'gpp_bad', 'warn'); return; }
    const reason = await ask({ title: `${decision} scenario "${esc(r.title)}"`, text: decision === 'Approved' ? `Approving replaces the official operating plan for <b>${esc(r.company)}</b> with this scenario's drivers.` : 'The author will be notified.', label: 'Decision rationale', confirmLabel: decision, danger: decision !== 'Approved' });
    if (!reason) return;
    await saveRecord({ ...r, status: decision }, { action: `Scenario ${decision.toLowerCase()}`, prev: r.status, next: decision, reason, ref: id });
    if (decision === 'Approved') { const p = await adoptPlan(ctx, r.company, r.payload.drivers, { scenarioId: id, reason }); toast(`<b>${esc(p.Plan)}</b> is now the official operating plan for ${esc(r.company)}`, 'verified'); fillSources(); }
    renderSaved();
  };
  const renderSaved = () => {
    const list = records('Scenario').sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
    saved.replaceChildren(sheet([{ key: 'title', label: 'Scenario', fmt: (v, r) => el('button', { class: 'linkish', text: v, onclick: () => { name = r.company; picker.value = name; fillSources(); load(`rec:${r.id}`); } }) }, { key: 'company', label: 'Company', cls: '' }, { key: 'from', label: 'From', cls: '', value: (r) => r.payload?.from }, { key: 'createdBy', label: 'Creator', cls: '' }, { key: 'updatedAt', label: 'Updated', cls: '' }, { key: 'fv', label: 'Fair value', value: (r) => r.payload?.results?.fairValue, fmt: (v) => (v ? money(v) : '—') }, { key: 'd', label: 'vs approved', value: (r) => (r.payload?.results ? r.payload.results.fairValue - r.payload.approvedFV : null), fmt: (v) => (v == null ? '—' : smoney(v)), tone: (v) => tone(v) }, { key: 'moic', label: 'MOIC', value: (r) => r.payload?.results?.moic, fmt: (v) => (v ? `${v.toFixed(2)}x` : '—') }, { key: 'status', label: 'Review status', cls: '', fmt: (v) => pill(v) },
      { key: 'act', label: '', cls: '', value: () => '', fmt: (v, r) => (r.status === 'Submitted' ? el('span', { class: 'row-end' }, [el('button', { class: 'linkish', text: 'Approve', onclick: () => decide(r.id, 'Approved') }), el('button', { class: 'linkish', text: 'Reject', onclick: () => decide(r.id, 'Rejected') })]) : r.status === 'Saved' ? el('button', { class: 'linkish', text: 'Submit', onclick: async () => { if (!can('scenario.submit')) return denied('scenario.submit'); await saveRecord({ ...r, status: 'Submitted' }, { action: 'Scenario submitted for approval', prev: 'Saved', next: 'Submitted', reason: r.payload?.description }); renderSaved(); } }) : el('span')) }], list));
  };

  pane.append(
    el('div', { class: 'page-head' }, [el('div', {}, [el('h2', { text: 'Scenario Lab' }), el('p', { text: 'Create a scenario from the approved forecast, the original investment case, the latest budget or a saved scenario; move any driver and every dependent measure, valuation, return and fund exposure recalculates instantly. Only approved scenarios can replace the official operating plan.' })]),
      el('div', { class: 'row-end' }, [el('label', { class: 'inline' }, [el('span', { text: 'Company' }), picker]), el('label', { class: 'inline' }, [el('span', { text: 'Create from' }), srcSel])])]),
    el('figure', { class: 'card full scn' }, [header, el('div', { class: 'scn-body' }, [el('div', { class: 'scn-left' }, [el('h4', { text: 'Drivers' }), levers, el('div', { class: 'row-end' }, [btn('Reset to source', () => load(`plan:${source}`), { kind: 'ghost sm', ic: 'restart_alt' }), btn('Save scenario', () => save('Saved'), { kind: 'sm', ic: 'save' }), btn('Save & submit for approval', () => save('Submitted'), { kind: 'sm', ic: 'send' }), btn('Build IC package', () => go('ic', { company: name, scenarioId: loadedId }), { kind: 'ghost sm', ic: 'gavel' })])]), el('div', { class: 'scn-right' }, [out])])]),
    el('figure', { class: 'card full' }, [el('figcaption', { text: 'Scenario comparison · Base, Downside, Value Creation and the working scenario' }), compare]),
    el('figure', { class: 'card full' }, [el('figcaption', { text: 'Sensitivities' }), sens]),
    el('figure', { class: 'card full' }, [el('figcaption', { text: 'Portfolio propagation · investment → fund → portfolio' }), propagate]),
    el('figure', { class: 'card full' }, [el('figcaption', { text: 'Saved scenarios and approvals' }), saved]),
  );
  onStore(() => { if (!pane.hidden) renderSaved(); });
  window.addEventListener('nsos-ccy', recalc);
  ctx.applyScenario = (company, drivers) => { name = company; picker.value = company; fillSources(); load('plan:Approved Forecast'); Object.assign(D, drivers); renderLevers(); recalc(); };
  ctx.onShow('scenario', (arg) => { if (typeof arg === 'string' && arg !== name) { name = arg; picker.value = arg; fillSources(); load('plan:Approved Forecast'); } else if (arg?.company) { ctx.applyScenario(arg.company, arg.drivers ?? {}); } renderSaved(); });
  picker.value = name; fillSources(); load('plan:Approved Forecast'); renderSaved();
};
