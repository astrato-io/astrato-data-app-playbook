/**
 * Exports — formatted Excel workbooks and printable (PDF) documents built from the governed rows in M
 * and the workflow store, narrowed to the filters on screen when the export runs (exportScope).
 * Every amount is USD m, whatever the CCY selector shows.
 */
import { el, esc, pct, mult, N, me, records, record, openDrawer, audit, toast } from './core.js';
import { M, co, finAt, ltm, currentVal, valAt, returnsOf, scenarioBase, planOf, planDrivers, activePlan, QUARTERS, LATEST } from './data.js';
import { projectScenario, xirr } from './engine.js';
import { workbookBlob } from './xlsx.js';
import { btn } from './ui.js';

// Views whose Company / Fund column names the same company or fund as the Companies view.
const COMPANY_VIEWS = ['Companies', 'Financials', 'Valuations', 'Cash Flows', 'Plans', 'Debt Facilities', 'Investment Thesis', 'Initiatives', 'Initiative Quarters', 'Next Period', 'Operating KPIs'];
const FUND_VIEWS = ['Companies', 'Funds', 'Fund Returns', 'Cash Flows'];

/**
 * The filters on screen: the current page's applied selections. The top-bar Fund selector writes
 * into every page group except the Company workspace's (whose own selection is the open company),
 * so on that page the Fund comes from the selector. Every document here is a list of companies, so
 * a selection narrows it when it is on a company attribute (a Companies column, or Company / Fund
 * in any view). Any other selection is named in the banner as not applied.
 */
export const exportScope = (ctx) => {
  const keyOf = (name, view) => ctx.fields.raw(name, view)?.fieldKey;
  const attrs = Object.keys(M.companies[0] ?? {}).filter((k) => !/Date$/.test(k));
  const attrOf = (fk) => (fk == null ? null : attrs.find((k) => keyOf(k, 'Companies') === fk) ?? (COMPANY_VIEWS.some((v) => keyOf('Company', v) === fk) ? 'Company' : FUND_VIEWS.some((v) => keyOf('Fund', v) === fk) ? 'Fund' : null));
  const sels = ctx.page === 'company'
    ? (ctx.fund ? [{ attr: 'Fund', values: [ctx.fund] }] : [])
    : ctx.applied(`g-${ctx.page}`).map((x) => ({ attr: attrOf(x.field?.fieldKey), label: ctx.labelOf(x.field?.fieldKey), values: x.values.map(String) }));
  const used = sels.filter((s) => s.attr);
  const companies = new Set(M.companies.filter((c) => used.every((s) => s.values.includes(String(c[s.attr])))).map((c) => c.Company));
  return { all: !used.length, companies, text: used.length ? used.map((s) => `${s.attr}: ${s.values.join(', ')}`).join(' · ') : 'all funds, all investments', ignored: sels.filter((s) => !s.attr).map((s) => s.label) };
};
const scopeLine = (S) => `Scope: ${S.text}${S.ignored.length ? ` (page selections on ${S.ignored.join(', ')} not applied)` : ''}`;

const when = () => new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const banner = (title, cols, sub) => [[{ v: 'Northstar', s: 'brand' }, { v: title, s: 'title' }, ...Array(Math.max(0, cols - 2)).fill({ v: '', s: 'title' })], [null, { v: `Private Markets Portfolio OS · ${sub} · USD m · generated ${when()} by ${me().name} · Northstar (illustrative portfolio) · mock data`, s: 'subtitle' }], []];
const head = (labels) => labels.map((v, i) => ({ v, s: i ? 'head' : 'headl' }));
// A missing value, or a ratio over a zero denominator, is written blank: never as 0 or Infinity.
const num = (v) => { const n = N(v); return Number.isFinite(n) ? n : null; };
const T = (v) => ({ v, s: 'text' }), B = (v) => ({ v, s: 'bold' }), U = (v) => ({ v: num(v), s: 'usd' }), P = (v) => ({ v: num(v), s: 'pct' }), SP = (v) => ({ v: num(v), s: 'spct' }), X = (v) => ({ v: num(v), s: 'dec' });
const usd = (v) => (num(v) == null ? '–' : `$${num(v).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}m`);

const portfolioRows = (S) => M.companies.filter((c) => S.companies.has(c.Company)).map((c) => { const n = c.Company, cv = currentVal(n), r = returnsOf(n), f = finAt(n, LATEST) ?? {}; return { c, n, cv, r, f, rev: ltm(n, 'Revenue'), rg: ltm(n, 'Revenue') / ltm(n, 'Revenue', '2025-Q3') - 1, e: ltm(n, 'Ebitda'), eg: ltm(n, 'Ebitda') / ltm(n, 'Ebitda', '2025-Q3') - 1, lev: f['Net Debt'] / ltm(n, 'Ebitda'), bv: f.Revenue / f['Budget Revenue'] - 1 }; });
const q3Marks = (S) => M.vals.filter((v) => v.Quarter === LATEST && S.companies.has(v.Company));

const REPORTS = {
  review: { title: 'Quarterly portfolio review', build: (S) => {
    const rows = portfolioRows(S), sub = `Q3 2026 · current fair values · ${scopeLine(S)}`;
    const inv = rows.reduce((s, x) => s + x.r.invested, 0), real = rows.reduce((s, x) => s + x.r.realised, 0), fv = rows.reduce((s, x) => s + x.r.fv, 0);
    const irr = xirr([...rows.flatMap((x) => x.r.flows), { date: '2026-09-30', amount: fv }].sort((a, b) => a.date.localeCompare(b.date)));
    const funds = S.all ? M.funds : M.funds.filter((f) => rows.some((x) => x.c.Fund === f.Fund));
    return [
      { name: 'Summary', cols: [4, 36, 18, 18], merges: [], rows: [...banner('Quarterly portfolio review · Q3 2026', 4, sub), head(['', 'Measure', 'Value', '']), [null, B('Invested capital'), U(inv)], [null, B('Realised proceeds'), U(real)], [null, B('Approved fair value'), U(fv)], [null, B('Gross MOIC'), X((real + fv) / inv)], [null, B('Gross IRR (pooled XIRR)'), P(irr)], [null, B('Investments'), { v: rows.length, s: 'int' }]] },
      { name: 'Funds', cols: [12, 34, 16, 14, 14, 14, 10], freeze: { row: 4, col: 1 }, merges: [], rows: [...banner('Fund performance (invested, realised, fair value: investments in scope)', 7, sub), head(['Fund', 'Name', 'Commitment (fund)', 'Invested', 'Realised', 'Fair value', 'MOIC']), ...funds.map((f) => { const rs = rows.filter((x) => x.c.Fund === f.Fund); const i = rs.reduce((s, x) => s + x.r.invested, 0), r = rs.reduce((s, x) => s + x.r.realised, 0), v = rs.reduce((s, x) => s + x.r.fv, 0); return [B(f.Fund), T(f['Fund Name']), U(f.Commitment), U(i), U(r), U(v), X((r + v) / i)]; })] },
      { name: 'Investments', cols: [30, 18, 9, 13, 13, 13, 9, 9, 12, 9, 9, 9, 11, 12], freeze: { row: 4, col: 1 }, merges: [], rows: [...banner('Investment register', 14, sub), head(['Company', 'Sector', 'Fund', 'Invested', 'Fair value', 'Realised', 'MOIC', 'IRR', 'Revenue LTM', 'Growth', 'EBITDA gr.', 'Net lev.', 'vs budget Q3', 'Q3 valuation']), ...rows.sort((a, b) => b.r.fv - a.r.fv).map((x) => [B(x.n), T(x.c.Sector), T(x.c.Fund), U(x.r.invested), U(x.r.fv), U(x.r.realised), X(x.r.moic), P(x.cv?.['Gross Irr']), U(x.rev), SP(x.rg), SP(x.eg), X(x.lev), SP(x.bv), T(valAt(x.n, LATEST)?.Status)])] },
    ];
  } },
  company: { title: 'Portfolio company investment summary', needsCompany: true, build: (S, n) => {
    const c = co(n), cv = currentVal(n), r = returnsOf(n), sub = `Company: ${n}`;
    return [
      { name: 'Summary', cols: [34, 60], merges: [], rows: [...banner(`${n} · investment summary`, 2, sub), head(['Item', 'Value']), ...[['Fund', c.Fund], ['Sector', `${c.Sector} · ${c.Subsector}`], ['Description', c.Description], ['Thesis', c.Thesis], ['Deal team', c['Deal Team']], ['Entry', `${String(c['Entry Date']).slice(0, 10)} · EV ${usd(c['Entry Ev'])} at ${mult(c['Entry Multiple'])}`], ['Ownership', pct(c['Current Ownership'], 1)], ['Approved fair value', `${usd(cv?.['Fair Value'])} (${cv?.Quarter ?? '–'})`], ['Invested / realised', `${usd(r.invested)} / ${usd(r.realised)}`], ['Gross MOIC / IRR', `${mult(r.moic, 2)} / ${pct(cv?.['Gross Irr'])}`], ['Risk class', c['Risk Class']], ['Operating plan', activePlan(n)?.Plan]].map(([k, v]) => [B(k), T(v)])] },
      statementSheet(n, sub),
      { name: 'Thesis', cols: [26, 26, 30, 12], merges: [], rows: [...banner('Investment thesis tracker', 4, sub), head(['Component', 'Underwritten', 'Current', 'Status']), ...M.thesis.filter((t) => t.Company === n).map((t) => [B(t.Component), T(t.Underwriting), T(t['Current Value']), T(t.Status)])] },
    ];
  } },
  statements: { title: 'Financial statement export', needsCompany: true, build: (S, n) => [statementSheet(n, `Company: ${n}`)] },
  valuation: { title: 'Valuation committee package', build: (S) => { const marks = q3Marks(S), sub = `Q3 2026 marks, every status (see Status) · ${scopeLine(S)}`; return [
    { name: 'Q3 2026 marks', cols: [30, 12, 12, 12, 10, 14, 14, 14, 14, 9, 13], freeze: { row: 4, col: 1 }, merges: [], rows: [...banner('Valuation committee package · Q3 2026', 11, sub), head(['Company', 'Status', 'Method', 'LTM metric', 'Multiple', 'EV', 'Net debt', 'Equity', 'Fair value', 'Own.', 'Movement']), ...[...marks].sort((a, b) => a['Valuation Movement'] - b['Valuation Movement']).map((v) => [B(v.Company), T(v.Status), T(v.Method), U(v['Metric Ltm']), X(v.Multiple), U(v['Enterprise Value']), U(v['Net Debt']), U(v['Equity Value']), U(v['Fair Value']), P(v.Ownership), { v: num(v['Valuation Movement']), s: 'susd' }])] },
    { name: 'Bridge', cols: [34, 16], merges: [], rows: [...banner('Portfolio valuation bridge', 2, sub), head(['Component', 'USD m']), ...[['Prior fair value', 'Prior Fair Value'], ['Operating performance', 'Bridge Operating'], ['Multiple changes', 'Bridge Multiple'], ['Debt changes', 'Bridge Debt'], ['FX', 'Bridge Fx'], ['Contributions', 'Bridge Contributions'], ['Distributions', 'Bridge Distributions'], ['Ownership', 'Bridge Ownership'], ['Other', 'Bridge Other'], ['Q3 2026 fair value (every status)', 'Fair Value']].map(([k, f]) => [B(k), U(marks.reduce((s, v) => s + (N(v[f]) || 0), 0))])] },
  ]; } },
  ic: { title: 'Investment committee decision package', build: (S) => [{ name: 'IC packages', cols: [14, 30, 26, 14, 50, 30, 50], merges: [], rows: [...banner('Investment committee decisions', 7, `IC packages in the workflow store · ${scopeLine(S)}`), head(['ID', 'Company', 'Type', 'Status', 'Proposal', 'Decision maker', 'Rationale / conditions']), ...records('IC Package', (r) => S.companies.has(r.company)).map((r) => [B(r.id), T(r.company), T(r.payload?.type), T(r.status), T(r.payload?.proposal), T(r.payload?.decisionMaker ?? ''), T(`${r.payload?.rationale ?? ''}${r.payload?.conditions ? ` · ${r.payload.conditions}` : ''}`)])] }] },
  vcp: { title: 'Value-creation initiative plan', build: (S) => [{ name: 'Initiatives', cols: [44, 28, 24, 14, 14, 14, 14, 10], freeze: { row: 4, col: 1 }, merges: [], rows: [...banner('Value-creation plan', 8, scopeLine(S)), head(['Initiative', 'Company', 'Type', 'Status', 'Run-rate EBITDA', 'Realised', 'Cost', 'RAG']), ...M.inits.filter((i) => S.companies.has(i.Company)).map((i) => [B(i.Initiative), T(i.Company), T(i['Initiative Type']), T(record(`INIT-${i['Initiative Id']}`)?.status ?? i.Status), U(i['Est Ebitda Impact']), U(i['Realised Ebitda Impact']), U(i['Implementation Cost']), T(i.Rag)]), ...records('Initiative', (r) => !r.id.startsWith('INIT-') && S.companies.has(r.company)).map((r) => [B(r.title), T(r.company), T(r.payload.type), T(r.status), U(r.payload.est), U(r.payload.realised ?? 0), U(r.payload.cost), T('—')])] }] },
  scenarios: { title: 'Scenario comparison', needsCompany: true, build: (S, n) => { const base = scenarioBase(n); const cases = ['Approved Forecast', 'Downside Case', 'Value Creation Case', 'Original Investment Case'].map((p) => [p, projectScenario(base, planDrivers(planOf(n, p)))]); const saved = records('Scenario', (r) => r.company === n); return [{ name: 'Scenarios', cols: [34, ...cases.map(() => 18), ...saved.map(() => 18)], merges: [], rows: [...banner(`${n} · scenario comparison`, 2 + cases.length + saved.length, `Company: ${n}`), head(['Output', ...cases.map(([k]) => k), ...saved.map((s) => `${s.title} (${s.status})`)]), ...[['Revenue FY+1', (x) => x.years[0].revenue, (s) => s.payload.results.years[0].revenue], ['EBITDA FY+1', (x) => x.years[0].ebitda, (s) => s.payload.results.years[0].ebitda], ['Fair value today', (x) => x.today.fairValue, (s) => s.payload.results.fairValue], ['Exit proceeds', (x) => x.exit.proceeds, (s) => s.payload.results.exitProceeds]].map(([k, f, g]) => [B(k), ...cases.map(([, x]) => U(f(x))), ...saved.map((s) => U(g(s)))]), [B('Gross MOIC'), ...cases.map(([, x]) => X(x.moic)), ...saved.map((s) => X(s.payload.results.moic))], [B('Gross IRR'), ...cases.map(([, x]) => P(x.irr)), ...saved.map((s) => P(s.payload.results.irr))]] }]; } },
};
function statementSheet(n, sub) {
  const L = [['Revenue', 'Revenue'], ['Gross profit', 'Gross Profit'], ['Personnel costs', 'Personnel Costs'], ['Other operating expenses', 'Other Opex'], ['EBITDA', 'Ebitda'], ['Net income', 'Net Income'], ['Free cash flow', 'Free Cash Flow'], ['Cash', 'Cash'], ['Gross debt', 'Gross Debt'], ['Net debt', 'Net Debt'], ['Total assets', 'Total Assets'], ['Total liabilities', 'Total Liabilities'], ['Equity', 'Equity'], ['Budget revenue', 'Budget Revenue'], ['Budget EBITDA', 'Budget Ebitda']];
  return { name: 'Financials', cols: [28, ...QUARTERS.map(() => 11)], freeze: { row: 4, col: 1 }, merges: [], rows: [...banner(`${n} · financial statements (USD m)`, 13, sub), head(['Line', ...QUARTERS]), ...L.map(([k, f]) => [B(k), ...QUARTERS.map((q) => U(finAt(n, q)?.[f]))])] };
}

/** The portfolio-level reports: the ones a filter narrows (the company-level ones follow the company picked). */
export const PORTFOLIO = Object.keys(REPORTS).filter((k) => !REPORTS[k].needsCompany);
const buildSheets = (ctx, keys, company) => {
  const S = exportScope(ctx);
  const R = REPORTS[keys[0]];
  return { S, sheets: keys.flatMap((k) => REPORTS[k].build(S, company)), title: keys.length > 1 ? 'Portfolio document set' : `${R.title}${R.needsCompany ? ` — ${company}` : ''}` };
};
/** The workbook the Excel button downloads, read under the filters on screen now. No download, no audit.
 *  Several keys give one combined workbook (the smoke test's export probe builds PORTFOLIO). */
export const buildWorkbook = (ctx, keys, company) => {
  const out = buildSheets(ctx, keys, company);
  return { ...out, blob: workbookBlob({ sheets: out.sheets, title: `Northstar – ${out.title}`, author: me().name }) };
};

const printDoc = (title, sheets) => {
  const w = window.open('', '_blank');
  if (!w) { toast('Allow pop-ups to print / save as PDF', 'block', 'warn'); return; }
  const cell = (c) => (c == null ? '' : typeof c.v === 'number' ? (['pct', 'spct'].includes(c.s) ? `${(c.v * 100).toFixed(1)}%` : c.s === 'dec' ? c.v.toFixed(2) : c.s === 'int' ? c.v.toLocaleString() : c.v.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })) : esc(c.v ?? ''));
  // Sheets whose rows start with an empty spacer column drop it from the header and every row alike.
  const table = (s) => { const body = s.rows.slice(3), lead = body.length > 1 && body[1]?.[0] == null; return `<table>${body.map((r, i) => `<tr>${(r ?? []).filter((c, k) => !(lead && k === 0)).map((c) => (i === 0 ? `<th>${esc(c?.v ?? '')}</th>` : `<td>${cell(c)}</td>`)).join('')}</tr>`).join('')}</table>`; };
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:12px Inter,Arial,sans-serif;color:#1B2433;margin:28px}h1{font-size:20px;color:#14283A;margin:0 0 2px}h2{font-size:14px;color:#14283A;border-bottom:2px solid #4E9A8E;padding-bottom:3px;margin-top:22px}p{color:#5b6576;margin:0 0 10px}table{border-collapse:collapse;width:100%;margin-bottom:10px}th{background:#14283A;color:#fff;text-align:left;padding:4px 6px;font-size:10.5px}td{border-bottom:1px solid #e3e6ea;padding:3px 6px;font-variant-numeric:tabular-nums}td:not(:first-child){text-align:right}@media print{button{display:none}}</style></head><body><h1>${esc(title)}</h1><p>${esc(sheets[0]?.rows[1]?.[1]?.v ?? '')}</p><button onclick="print()">Print / save as PDF</button>${sheets.map((s) => `<h2>${esc(s.name)}</h2>${table(s)}`).join('')}</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
};

export const exportMenu = (ctx) => {
  const S = exportScope(ctx);
  // Company-level documents: the companies in scope, starting from the one open in the Company workspace.
  const inScope = M.companies.filter((c) => S.companies.has(c.Company));
  const list = [...(inScope.length ? inScope : M.companies)].sort((a, b) => a.Company.localeCompare(b.Company));
  const onScreen = ctx.selectedValues('g-company', 'Company', 'Companies')[0];
  const pick = (list.find((c) => c.Company === onScreen) ?? list[0])?.Company;
  const coSel = el('select', {}, list.map((c) => el('option', { value: c.Company, text: c.Company, selected: c.Company === pick })));
  const run = async (key, kind) => {
    const { sheets, title, S: now, blob } = kind === 'xlsx' ? buildWorkbook(ctx, [key], coSel.value) : buildSheets(ctx, [key], coSel.value);
    if (kind === 'xlsx') {
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `Northstar_${title.replace(/[^A-Za-z0-9]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx` });
      document.body.append(a); a.click(); a.remove();
      window.__lastExportBytes = blob.size;
      toast(`${esc(title)} · Excel · ${Math.round(blob.size / 1024)} KB · ${sheets.length} sheet${sheets.length > 1 ? 's' : ''}`, 'download_done');
    } else printDoc(title, sheets);
    await audit('Export', key, `Exported ${title} (${kind === 'xlsx' ? 'Excel' : 'PDF'})`, { reason: REPORTS[key].needsCompany ? `Company: ${coSel.value}` : scopeLine(now) });
  };
  openDrawer({ title: 'Export and distribution', kicker: `Governed rows · ${scopeLine(S)}`, body: [
    el('label', { class: 'field' }, [el('span', { text: 'Company (for company-level documents)' }), coSel]),
    el('ul', { class: 'exports' }, Object.entries(REPORTS).map(([k, R]) => el('li', {}, [el('b', { text: R.title }), el('small', { text: R.needsCompany ? 'company-level' : 'portfolio' }), el('span', { class: 'row-end' }, [btn('Excel', () => run(k, 'xlsx'), { kind: 'sm', ic: 'table_view' }), btn('PDF', () => run(k, 'pdf'), { kind: 'ghost sm', ic: 'picture_as_pdf' })])]))),
    el('p', { class: 'note', text: 'Portfolio documents list only the investments in the scope above; company-level documents cover the company picked here. Amounts are USD m. Excel: formatted multi-sheet workbooks with number formats, header fills and frozen panes. PDF: a print-ready document (use “Save as PDF”). Each export is recorded in the audit history.' }),
  ] });
};
