/**
 * Northstar deterministic calculation engine — pure functions shared by the app (Scenario Lab,
 * valuation workbench, validation engine). The same code generated the stored plans and
 * valuations of the synthetic portfolio (that generator is not in this repository). No language-model arithmetic: every figure here is reproducible.
 */

/** XIRR over dated cash flows [{date: 'YYYY-MM-DD' | Date, amount}] (negative = investment). */
export const xirr = (flows) => {
  const cf = flows.filter((f) => Math.abs(f.amount) > 1e-9).map((f) => ({ t: (new Date(f.date) - new Date(flows[0].date)) / (365.25 * 864e5), a: f.amount }));
  if (!cf.some((f) => f.a > 0) || !cf.some((f) => f.a < 0)) return null;
  const npv = (r) => cf.reduce((s, f) => s + f.a / (1 + r) ** f.t, 0);
  let lo = -0.95, hi = 5;
  if (npv(lo) * npv(hi) > 0) return null;
  for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (npv(lo) * npv(mid) <= 0) hi = mid; else lo = mid; }
  return (lo + hi) / 2;
};

/** Multiple-based valuation (spec §8): EV = metric × multiple; equity = EV − net debt − senior claims + non-operating assets; FV = equity × ownership. */
export const multipleValuation = ({ metric, multiple, netDebt, otherClaims = 0, nonOperating = 0, ownership }) => {
  const ev = metric * multiple;
  const equity = ev - netDebt - otherClaims + nonOperating;
  return { ev, equity, fairValue: Math.max(0, equity) * ownership };
};

/** Simple unlevered DCF: projections [{ebitda, da, capex, dNwc}], wacc, terminal growth or multiple. */
export const dcf = ({ years, wacc, terminalGrowth, terminalMultiple, taxRate = 0.25, netDebt, otherClaims = 0, ownership }) => {
  let pv = 0;
  const rows = years.map((y, i) => {
    const ebit = y.ebitda - y.da;
    const tax = Math.max(0, ebit) * taxRate;
    const ufcf = y.ebitda - tax - y.capex - y.dNwc;
    const df = 1 / (1 + wacc) ** (i + 0.5);
    pv += ufcf * df;
    return { ...y, tax, ufcf, df, pv: ufcf * df };
  });
  const last = rows[rows.length - 1];
  const tvGrowth = (last.ufcf * (1 + terminalGrowth)) / (wacc - terminalGrowth);
  const tvMultiple = terminalMultiple ? last.ebitda * terminalMultiple : tvGrowth;
  const tv = terminalMultiple ? (tvGrowth + tvMultiple) / 2 : tvGrowth;
  const pvTv = tv / (1 + wacc) ** years.length;
  const ev = pv + pvTv;
  const equity = ev - netDebt - otherClaims;
  return { rows, pvExplicit: pv, tv, pvTv, ev, equity, fairValue: Math.max(0, equity) * ownership };
};

export const DRIVERS = [
  // key, label, unit, min, max, step
  ['growth', 'Revenue growth (volume)', '%', -10, 35, 0.5],
  ['price', 'Pricing', '%', -3, 8, 0.25],
  ['retention', 'Customer retention (Δ vs base)', 'pts', -8, 8, 0.5],
  ['gm', 'Gross margin', '%', 20, 90, 0.5],
  ['personnel', 'Personnel costs (% revenue)', '%', 5, 60, 0.5],
  ['opex', 'Other operating expenses (% revenue)', '%', 2, 45, 0.5],
  ['capex', 'Capital expenditure (% revenue)', '%', 0, 15, 0.25],
  ['nwc', 'Working capital (% of Δ revenue)', '%', -10, 40, 1],
  ['rate', 'Interest rate (all-in)', '%', 2, 14, 0.125],
  ['repay', 'Debt repayment (% p.a.)', '%', 0, 20, 0.5],
  ['acq', 'Acquisition spending ($m p.a.)', '$m', 0, 400, 5],
  ['exitYear', 'Exit timing', 'yr', 2027, 2031, 1],
  ['exitMultiple', 'Exit EV/EBITDA multiple', 'x', 5, 30, 0.25],
  ['multipleShift', 'Valuation multiple change today', 'x', -6, 4, 0.25],
];

/**
 * Five-year forward model from the latest twelve-month base (all $m). Assumptions are annual.
 * base: { revenue, ebitda, debt, cash, ownership, invested, realised, flows:[{date,amount}],
 *         valuationDate, ntmMultiple (implied by the approved fair value), otherClaims, acqMultiple }
 * a: driver values keyed as DRIVERS (percent values are percents).
 */
export const projectScenario = (base, a) => {
  const pct = (v) => v / 100;
  const startYear = Number(String(base.valuationDate).slice(0, 4)) + 1; // FY after the valuation date
  const years = [];
  let rev = base.revenue, debt = base.debt, cash = base.cash, prevRev = base.revenue;
  for (let i = 0; i < 5; i++) {
    const acqRev = a.acq > 0 ? a.acq / (base.acqMultiple ?? 1.5) : 0; // acquired revenue at an EV/revenue of ~1.5x
    const g = pct(a.growth) + pct(a.price) + pct(a.retention) * 0.6;
    rev = rev * (1 + g) + acqRev;
    const gp = rev * pct(a.gm);
    const personnel = rev * pct(a.personnel);
    const opex = rev * pct(a.opex);
    const ebitda = gp - personnel - opex;
    const da = rev * 0.03;
    const interest = ((debt + Math.max(0, debt - debt * pct(a.repay))) / 2) * pct(a.rate);
    const tax = Math.max(0, ebitda - da - interest) * 0.25;
    const capex = rev * pct(a.capex);
    const dNwc = (rev - prevRev) * pct(a.nwc);
    const fcf = ebitda - interest - tax - capex - dNwc;
    const repayment = debt * pct(a.repay);
    debt = debt - repayment + a.acq * 0.6; // acquisitions 60% debt-funded
    cash = cash + fcf - repayment - a.acq * 0.4;
    if (cash < 0) { debt += -cash; cash = 0; } // revolver draw
    years.push({ year: startYear + i, revenue: rev, grossProfit: gp, personnel, opex, ebitda, margin: ebitda / rev, da, interest, tax, capex, dNwc, fcf, conversion: ebitda ? fcf / ebitda : 0, debt, cash, netDebt: debt - cash, leverage: ebitda > 0 ? (debt - cash) / ebitda : null, coverage: interest > 0 ? ebitda / interest : null });
    prevRev = rev;
  }
  const y1 = years[0];
  // Valuation today: NTM EBITDA × (approved implied NTM multiple + shift); equity at today's net debt.
  const todayMultiple = base.ntmMultiple + (a.multipleShift ?? 0);
  const today = multipleValuation({ metric: y1.ebitda, multiple: todayMultiple, netDebt: base.debt - base.cash, otherClaims: base.otherClaims ?? 0, ownership: base.ownership });
  const exit = years.find((y) => y.year === a.exitYear) ?? years[years.length - 1];
  const exitEv = exit.ebitda * a.exitMultiple;
  const exitEquity = Math.max(0, exitEv - exit.netDebt - (base.otherClaims ?? 0));
  const proceeds = exitEquity * base.ownership;
  const exitDate = `${exit.year}-12-31`;
  const moic = (base.realised + proceeds) / base.invested;
  const irr = xirr([...base.flows, { date: exitDate, amount: proceeds }]);
  return { years, todayMultiple, today, exit: { ...exit, ev: exitEv, equity: exitEquity, proceeds, date: exitDate }, moic, irr };
};

/** Value-creation initiative → run-rate EBITDA, cash and value impact (net of implementation cost). */
export const initiativeImpact = ({ revenueUplift = 0, ebitdaUplift, oneOffCost, capex = 0, multiple, ownership, years = 3 }) => {
  const netEbitda3y = ebitdaUplift * years - oneOffCost;
  const ev = ebitdaUplift * multiple;
  const equity = ev - oneOffCost - capex;
  return { revenueUplift, ebitdaUplift, netEbitda3y, ev, equity, fairValue: equity * ownership, payback: ebitdaUplift > 0 ? (oneOffCost + capex) / ebitdaUplift : null };
};

/** Deterministic validation rules over one submitted quarter (all $m). Returns findings. */
export const VALIDATION_RULES = [
  ['BS-01', 'Balance sheet balances', 'Total assets = total liabilities + equity'],
  ['CF-01', 'Cash flow reconciles', 'Opening cash + free cash flow + financing = closing cash'],
  ['IS-01', 'Revenue / EBITDA consistent', 'Gross profit − personnel − other opex = EBITDA'],
  ['REQ-01', 'Required fields populated', 'Revenue, EBITDA, cash, debt present'],
  ['PER-01', 'Reporting period correct', 'Submission period = requested period'],
  ['CCY-01', 'Currency and units consistent', 'Currency = reporting currency; units = millions'],
  ['MOV-01', 'Unexpected movement', '|QoQ revenue change| ≤ 15%'],
  ['BUD-01', 'Large budget variance', '|Revenue vs budget| ≤ 5%'],
  ['RAT-01', 'Ratio tolerance', 'Net leverage ≤ 6.5x and interest cover ≥ 2.0x'],
];
export const validate = (s, prev, ctx) => {
  const out = [];
  const add = (rule, severity, detail, value, expected) => out.push({ rule, name: VALIDATION_RULES.find((r) => r[0] === rule)[1], severity, detail, value, expected });
  const tl = s.totalLiabilities + s.equity;
  if (Math.abs(s.totalAssets - tl) > 0.05) add('BS-01', 'Critical', `Assets ${s.totalAssets.toFixed(1)} vs liabilities + equity ${tl.toFixed(1)}`, s.totalAssets - tl, 0);
  const closing = (prev?.cash ?? s.cash) + s.fcf + (s.financing ?? 0);
  if (prev && Math.abs(closing - s.cash) > 0.05) add('CF-01', 'Critical', `Implied closing cash ${closing.toFixed(1)} vs reported ${s.cash.toFixed(1)}`, s.cash - closing, 0);
  const ebitda = s.grossProfit - s.personnel - s.otherOpex;
  if (Math.abs(ebitda - s.ebitda) > 0.05) add('IS-01', 'High', `Derived EBITDA ${ebitda.toFixed(1)} vs reported ${s.ebitda.toFixed(1)}`, s.ebitda - ebitda, 0);
  for (const k of ['revenue', 'ebitda', 'cash', 'grossDebt']) if (s[k] == null || Number.isNaN(s[k])) add('REQ-01', 'High', `${k} missing`, null, 'value');
  if (ctx.period && s.period && s.period !== ctx.period) add('PER-01', 'High', `Submitted ${s.period}, requested ${ctx.period}`, s.period, ctx.period);
  if (ctx.ccy && s.ccy && s.ccy !== ctx.ccy) add('CCY-01', 'High', `Submitted in ${s.ccy}, company reports in ${ctx.ccy}`, s.ccy, ctx.ccy);
  if (prev && Math.abs(s.revenue / prev.revenue - 1) > 0.15) add('MOV-01', 'Medium', `Revenue ${((s.revenue / prev.revenue - 1) * 100).toFixed(1)}% QoQ`, s.revenue / prev.revenue - 1, '±15%');
  if (s.budgetRevenue && Math.abs(s.revenue / s.budgetRevenue - 1) > 0.05) add('BUD-01', 'Medium', `Revenue ${((s.revenue / s.budgetRevenue - 1) * 100).toFixed(1)}% vs budget`, s.revenue / s.budgetRevenue - 1, '±5%');
  const lev = s.ltmEbitda > 0 ? (s.grossDebt - s.cash) / s.ltmEbitda : 99;
  const cov = s.interest > 0 ? s.ebitda / s.interest : 99;
  if (lev > 6.5) add('RAT-01', 'Medium', `Net leverage ${lev.toFixed(1)}x above 6.5x tolerance`, lev, 6.5);
  if (cov < 2) add('RAT-01', 'Medium', `Interest cover ${cov.toFixed(1)}x below 2.0x tolerance`, cov, 2);
  return out;
};
