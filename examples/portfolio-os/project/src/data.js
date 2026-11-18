/**
 * The governed model the workbench, Scenario Lab, validation engine and exports compute on.
 * Every row is read from the published semantic layer (engine.getData) — no hard-coded figures.
 */
import { N } from './core.js';

export const M = { companies: [], fin: [], vals: [], cfs: [], plans: [], debt: [], thesis: [], inits: [], iq: [], next: [], funds: [], fundRet: [], fx: [], kpi: new Map(), loaded: false };
const NUMERIC = (k) => !/^(Company|Company Id|Quarter|Q End|Period Flag|Ltm Bucket|Py Quarter Flag|Ccy|Source System|Method|Status|Prepared By|Approved By|Valuation Date|Cf Date|Cf Type|Fund|Facility.*|Base Rate|Maturity|Lender|Component.*|Underwriting|Current Value|Metric|Assessed.*|Plan.*|Note|Initiative.*|Objective|Thesis.*|Owner|Sponsor|Start Date|Target Date|Rag|Short Code|Sector|Subsector|Region|Country|Reporting Ccy|Deal.*|Operating Partner|Entry Date|Entry Quarter|Stage|Risk Class|Requires Review|Description|Strategy|Fund .*|Rate Date|Source|Month|Month Flag|Cumulative Flag|Approved At)$/.test(k);
const DATE = /(Date|Maturity|Approved At|Assessed At)$/;
const toDay = (v) => { if (v == null || v === '') return v; const s = String(v); if (/^\d+$/.test(s)) { const n = Number(s); return new Date(n < 1e11 ? n * 1000 : n).toISOString().slice(0, 10); } return s.slice(0, 10); };
const typed = (rows) => rows.map((r) => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, DATE.test(k) ? toDay(v) : NUMERIC(k) ? N(v) : v])));

const FIELDS = {
  companies: ['Companies', 'Company Id Company Short Code Sector Subsector Region Country Reporting Ccy Fund Deal Lead Deal Team Operating Partner Entry Date Entry Year Entry Quarter Entry Revenue Entry Ebitda Entry Ev Entry Multiple Entry Net Leverage Initial Ownership Current Ownership Equity Cheque Uw Revenue Cagr Uw Ebitda Margin Target Uw Exit Multiple Uw Target Moic Uw Target Irr Planned Exit Year Stage Risk Class Requires Review Description Thesis'],
  fin: ['Financials', 'Company Quarter Period Flag Ccy Fx Rate To Usd Source System Revenue Cogs Gross Profit Personnel Costs Other Opex Ebitda Nonrecurring Items Depreciation Amortisation Ebit Interest Expense Tax Net Income Capex Change In Nwc Operating Cash Flow Free Cash Flow Financing Cash Flow Opening Cash Cash Gross Debt Net Debt Receivables Inventory Ppe Goodwill Other Assets Total Assets Payables Other Liabilities Total Liabilities Equity Ltm Revenue Ltm Ebitda Budget Revenue Budget Ebitda Forecast Revenue Forecast Ebitda Uw Revenue Uw Ebitda Py Revenue Py Ebitda Price Effect Volume Effect Mix Effect Interest Rate'],
  vals: ['Valuations', 'Company Quarter Method Metric Ltm Multiple Entry Multiple Enterprise Value Net Debt Other Claims Nonoperating Assets Equity Value Ownership Fair Value Prior Fair Value Bridge Operating Bridge Multiple Bridge Debt Bridge Fx Bridge Contributions Bridge Distributions Bridge Ownership Bridge Other Valuation Movement Invested To Date Realised To Date Gross Moic Gross Irr Fx Rate To Usd Dcf Ev Status Is Current Prepared By Approved By Version Fv Per Turn'],
  cfs: ['Cash Flows', 'Cashflow Id Company Fund Cf Date Quarter Cf Type Amount Contribution Distribution Ownership After'],
  plans: ['Plans', 'Company Plan Id Plan Status Note Growth Price Retention Gm Personnel Opex Capex Nwc Rate Repay Acq Exit Year Exit Multiple Multiple Shift Base Revenue Base Ebitda Base Debt Base Cash Base Other Claims Base Nonop Ntm Multiple Version Approved By Approved At'],
  debt: ['Debt Facilities', 'Company Facility Id Facility Base Rate Margin Bps All In Rate Commitment Drawn Undrawn Maturity Lender Covenant Max Leverage Ccy Floating Drawn'],
  thesis: ['Investment Thesis', 'Company Component Id Component Underwriting Current Value Status Metric Status Score Assessed By Assessed At'],
  inits: ['Initiatives', 'Initiative Id Company Initiative Initiative Type Objective Thesis Link Owner Sponsor Start Date Target Date Est Ebitda Impact Implementation Cost Approved Budget Status Realised Ebitda Impact Rag Progress'],
  iq: ['Initiative Quarters', 'Initiative Id Company Quarter Planned Ebitda Impact Realised Ebitda Impact'],
  next: ['Next Period', 'Company Quarter Revenue Ebitda Budget Revenue Budget Ebitda Net Debt Free Cash Flow Status'],
  funds: ['Funds', 'Fund Fund Name Vintage Commitment Strategy Fund Ccy Fund Status'],
  fundRet: ['Fund Returns', 'Fund Quarter Invested Realised Nav Gross Moic Gross Irr Dpi Gross Period Flag'],
  fx: ['FX Rates', 'Quarter Rate Date Ccy Rate To Usd Source'],
};
// Field names are multi-word: split the list above on known names.
const KNOWN = new Map();
const splitNames = (view, list, fieldsIndex) => {
  const words = list.split(' ');
  const out = [];
  for (let i = 0; i < words.length;) {
    let hit = null;
    for (let j = Math.min(words.length, i + 5); j > i; j--) { const cand = words.slice(i, j).join(' '); if (fieldsIndex.raw(cand, view)) { hit = cand; i = j; break; } }
    if (!hit) { console.warn('[data] unknown field', view, words[i]); i++; } else out.push(hit);
  }
  return out;
};

export const loadModel = async (q, fields) => {
  const entries = Object.entries(FIELDS);
  const results = await Promise.all(entries.map(([key, [view, list]]) => {
    const names = KNOWN.get(key) ?? splitNames(view, list, fields);
    KNOWN.set(key, names);
    return q({ dims: names.map((n) => [n, view]), limit: 5000 }).then(typed).catch((e) => { console.warn('[data]', key, e); return []; });
  }));
  entries.forEach(([key], i) => { M[key] = results[i]; });
  const rb = (s) => s; // the stored fund and system names are shown as they are
  for (const f of M.funds) f['Fund Name'] = rb(f['Fund Name']);
  for (const r of M.fin) r['Source System'] = rb(r['Source System']);
  M.fin.sort((a, b) => a.Quarter.localeCompare(b.Quarter));
  M.vals.sort((a, b) => a.Quarter.localeCompare(b.Quarter));
  M.loaded = true;
  return M;
};
export const loadKpis = async (q, company) => {
  if (M.kpi.has(company)) return M.kpi.get(company);
  const rows = typed(await q({ dims: ['Month', 'Monthly Revenue', 'Customers', 'Net Revenue Retention', 'Gross Churn', 'Headcount', 'Sales Pipeline', 'Dso Days'].map((n) => [n, 'Operating KPIs']), filters: [['Company', 'Operating KPIs', [company]]], limit: 100 }));
  rows.sort((a, b) => a.Month.localeCompare(b.Month));
  M.kpi.set(company, rows);
  return rows;
};

export const QUARTERS = ['2023-Q4', '2024-Q1', '2024-Q2', '2024-Q3', '2024-Q4', '2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3'];
export const LATEST = '2026-Q3';
export const co = (name) => M.companies.find((c) => c.Company === name);
export const finOf = (name) => M.fin.filter((r) => r.Company === name);
export const finAt = (name, q) => M.fin.find((r) => r.Company === name && r.Quarter === q);
export const valsOf = (name) => M.vals.filter((r) => r.Company === name);
export const valAt = (name, q) => M.vals.find((r) => r.Company === name && r.Quarter === q);
export const currentVal = (name) => M.vals.find((r) => r.Company === name && r['Is Current'] === 1) ?? [...valsOf(name)].reverse().find((v) => v.Status === 'Approved');
export const cfsOf = (name) => M.cfs.filter((r) => r.Company === name).sort((a, b) => String(a['Cf Date']).localeCompare(String(b['Cf Date'])));
export const planOf = (name, plan) => M.plans.filter((r) => r.Company === name && r.Plan === plan).sort((a, b) => b.Version - a.Version)[0];
export const activePlan = (name) => M.plans.filter((r) => r.Company === name && r.Status === 'Active').sort((a, b) => b.Version - a.Version)[0] ?? planOf(name, 'Approved Forecast');
export const ltm = (name, key, endQ = LATEST) => { const i = QUARTERS.indexOf(endQ); return QUARTERS.slice(Math.max(0, i - 3), i + 1).reduce((s, q) => s + (finAt(name, q)?.[key] ?? 0), 0); };
const dateOf = (v) => (typeof v === 'number' ? new Date(v).toISOString().slice(0, 10) : String(v).slice(0, 10));

/** Per-investment returns from the governed cash flows and approved fair value. */
export const returnsOf = (name, fvOverride) => {
  const flows = cfsOf(name).map((f) => ({ date: dateOf(f['Cf Date']), amount: f.Amount }));
  const invested = cfsOf(name).reduce((s, f) => s + (f.Contribution || 0), 0);
  const realised = cfsOf(name).reduce((s, f) => s + (f.Distribution || 0), 0);
  const fv = fvOverride ?? currentVal(name)?.['Fair Value'] ?? 0;
  return { flows, invested, realised, fv, moic: (realised + fv) / invested };
};

/** Scenario base for the forward model (USD $m), from the governed plan + approved valuation. */
export const scenarioBase = (name) => {
  const p = activePlan(name);
  const r = returnsOf(name);
  const c = co(name);
  const cv = currentVal(name);
  return { revenue: p['Base Revenue'], ebitda: p['Base Ebitda'], debt: p['Base Debt'], cash: p['Base Cash'], ownership: c['Current Ownership'], invested: r.invested, realised: r.realised, flows: r.flows, valuationDate: '2026-09-30', otherClaims: p['Base Other Claims'], ntmMultiple: p['Ntm Multiple'], acqMultiple: 1.5, approvedFV: cv?.['Fair Value'] ?? 0, approvedQuarter: cv?.Quarter };
};
export const planDrivers = (p) => ({ growth: p.Growth, price: p.Price, retention: p.Retention, gm: p.Gm, personnel: p.Personnel, opex: p.Opex, capex: p.Capex, nwc: p.Nwc, rate: p.Rate, repay: p.Repay, acq: p.Acq, exitYear: p['Exit Year'], exitMultiple: p['Exit Multiple'], multipleShift: p['Multiple Shift'] });
export const fundOfCompany = (name) => co(name)?.Fund;
/** Portfolio approved fair value by fund, optionally replacing one company's fair value. */
export const fundFV = (override = {}) => {
  const out = {};
  for (const c of M.companies) { const fv = override[c.Company] ?? currentVal(c.Company)?.['Fair Value'] ?? 0; out[c.Fund] = (out[c.Fund] ?? 0) + fv; }
  return out;
};
