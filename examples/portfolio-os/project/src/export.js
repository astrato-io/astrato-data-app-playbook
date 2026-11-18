/** Exports — formatted Excel workbooks and printable (PDF) documents built from the same governed rows and approved valuations. */
import { el, esc, money, smoney, pct, spct, mult, me, records, record, openDrawer, audit, toast, store } from './core.js';
import { M, co, finAt, finOf, ltm, currentVal, valAt, valsOf, returnsOf, scenarioBase, planOf, planDrivers, activePlan, QUARTERS, LATEST } from './data.js';
import { projectScenario, xirr } from './engine.js';
import { workbookBlob } from './xlsx.js';
import { btn } from './ui.js';

const when = () => new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
const banner = (title, cols) => [[{ v: 'Northstar', s: 'brand' }, { v: title, s: 'title' }, ...Array(Math.max(0, cols - 2)).fill({ v: '', s: 'title' })], [null, { v: `Private Markets Portfolio OS · Q3 2026 · approved valuations · generated ${when()} by ${me().name} · Northstar (illustrative portfolio) · mock data`, s: 'subtitle' }], []];
const head = (labels) => labels.map((v, i) => ({ v, s: i ? 'head' : 'headl' }));
const T = (v) => ({ v, s: 'text' }), B = (v) => ({ v, s: 'bold' }), U = (v) => ({ v: Number(v) || 0, s: 'usd' }), P = (v) => ({ v: Number(v) || 0, s: 'pct' }), SP = (v) => ({ v: Number(v) || 0, s: 'spct' }), X = (v) => ({ v: Number(v) || 0, s: 'dec' });

const portfolioRows = () => M.companies.map((c) => { const n = c.Company, cv = currentVal(n), r = returnsOf(n), f = finAt(n, LATEST); return { c, n, cv, r, f, rev: ltm(n, 'Revenue'), rg: ltm(n, 'Revenue') / ltm(n, 'Revenue', '2025-Q3') - 1, e: ltm(n, 'Ebitda'), eg: ltm(n, 'Ebitda') / ltm(n, 'Ebitda', '2025-Q3') - 1, lev: f['Net Debt'] / ltm(n, 'Ebitda'), bv: f.Revenue / f['Budget Revenue'] - 1 }; });

const REPORTS = {
  review: { title: 'Quarterly portfolio review', build: () => {
    const rows = portfolioRows();
    const inv = rows.reduce((s, x) => s + x.r.invested, 0), real = rows.reduce((s, x) => s + x.r.realised, 0), fv = rows.reduce((s, x) => s + x.r.fv, 0);
    const irr = xirr([...rows.flatMap((x) => x.r.flows), { date: '2026-09-30', amount: fv }].sort((a, b) => a.date.localeCompare(b.date)));
    return [
      { name: 'Summary', cols: [4, 36, 18, 18], merges: [], rows: [...banner('Quarterly portfolio review · Q3 2026', 4), head(['', 'Measure', 'Value', '']), [null, B('Invested capital'), U(inv)], [null, B('Realised proceeds'), U(real)], [null, B('Approved fair value'), U(fv)], [null, B('Gross MOIC'), X((real + fv) / inv)], [null, B('Gross IRR (pooled XIRR)'), P(irr)], [null, B('Investments'), { v: rows.length, s: 'int' }]] },
      { name: 'Funds', cols: [12, 34, 14, 14, 14, 14, 10], freeze: { row: 4, col: 1 }, merges: [], rows: [...banner('Fund performance', 7), head(['Fund', 'Name', 'Commitment', 'Invested', 'Realised', 'Fair value', 'MOIC']), ...M.funds.map((f) => { const rs = rows.filter((x) => x.c.Fund === f.Fund); const i = rs.reduce((s, x) => s + x.r.invested, 0), r = rs.reduce((s, x) => s + x.r.realised, 0), v = rs.reduce((s, x) => s + x.r.fv, 0); return [B(f.Fund), T(f['Fund Name']), U(f.Commitment), U(i), U(r), U(v), X((r + v) / i)]; })] },
      { name: 'Investments', cols: [30, 18, 9, 13, 13, 13, 9, 9, 12, 9, 9, 9, 11, 12], freeze: { row: 4, col: 1 }, merges: [], rows: [...banner('Investment register', 14), head(['Company', 'Sector', 'Fund', 'Invested', 'Fair value', 'Realised', 'MOIC', 'IRR', 'Revenue LTM', 'Growth', 'EBITDA gr.', 'Net lev.', 'vs budget Q3', 'Q3 valuation']), ...rows.sort((a, b) => b.r.fv - a.r.fv).map((x) => [B(x.n), T(x.c.Sector), T(x.c.Fund), U(x.r.invested), U(x.r.fv), U(x.r.realised), X(x.r.moic), P(x.cv?.['Gross Irr']), U(x.rev), SP(x.rg), SP(x.eg), X(x.lev), SP(x.bv), T(valAt(x.n, LATEST)?.Status)])] },
    ];
  } },
  company: { title: 'Portfolio company investment summary', needsCompany: true, build: (n) => {
    const c = co(n), cv = currentVal(n), r = returnsOf(n);
    return [
      { name: 'Summary', cols: [34, 60], merges: [], rows: [...banner(`${n} · investment summary`, 2), head(['Item', 'Value']), ...[['Fund', c.Fund], ['Sector', `${c.Sector} · ${c.Subsector}`], ['Description', c.Description], ['Thesis', c.Thesis], ['Deal team', c['Deal Team']], ['Entry', `${String(c['Entry Date']).slice(0, 10)} · EV ${money(c['Entry Ev'])} at ${mult(c['Entry Multiple'])}`], ['Ownership', pct(c['Current Ownership'], 1)], ['Approved fair value', `${money(cv?.['Fair Value'])} (${cv?.Quarter})`], ['Invested / realised', `${money(r.invested)} / ${money(r.realised)}`], ['Gross MOIC / IRR', `${r.moic.toFixed(2)}x / ${pct(cv?.['Gross Irr'])}`], ['Risk class', c['Risk Class']], ['Operating plan', activePlan(n)?.Plan]].map(([k, v]) => [B(k), T(v)])] },
      statementSheet(n),
      { name: 'Thesis', cols: [26, 26, 30, 12], merges: [], rows: [...banner('Investment thesis tracker', 4), head(['Component', 'Underwritten', 'Current', 'Status']), ...M.thesis.filter((t) => t.Company === n).map((t) => [B(t.Component), T(t.Underwriting), T(t['Current Value']), T(t.Status)])] },
    ];
  } },
  statements: { title: 'Financial statement export', needsCompany: true, build: (n) => [statementSheet(n)] },
  valuation: { title: 'Valuation committee package', build: () => [
    { name: 'Q3 2026 marks', cols: [30, 12, 12, 12, 10, 14, 14, 14, 14, 9, 13], freeze: { row: 4, col: 1 }, merges: [], rows: [...banner('Valuation committee package · Q3 2026', 11), head(['Company', 'Status', 'Method', 'LTM metric', 'Multiple', 'EV', 'Net debt', 'Equity', 'Fair value', 'Own.', 'Movement']), ...M.vals.filter((v) => v.Quarter === LATEST).sort((a, b) => a['Valuation Movement'] - b['Valuation Movement']).map((v) => [B(v.Company), T(v.Status), T(v.Method), U(v['Metric Ltm']), X(v.Multiple), U(v['Enterprise Value']), U(v['Net Debt']), U(v['Equity Value']), U(v['Fair Value']), P(v.Ownership), { v: v['Valuation Movement'], s: 'susd' }])] },
    { name: 'Bridge', cols: [34, 16], merges: [], rows: [...banner('Portfolio valuation bridge', 2), head(['Component', 'USD m']), ...[['Prior fair value', 'Prior Fair Value'], ['Operating performance', 'Bridge Operating'], ['Multiple changes', 'Bridge Multiple'], ['Debt changes', 'Bridge Debt'], ['FX', 'Bridge Fx'], ['Contributions', 'Bridge Contributions'], ['Distributions', 'Bridge Distributions'], ['Ownership', 'Bridge Ownership'], ['Other', 'Bridge Other'], ['Q3 2026 fair value', 'Fair Value']].map(([k, f]) => [B(k), U(M.vals.filter((v) => v.Quarter === LATEST).reduce((s, v) => s + v[f], 0))])] },
  ] },
  ic: { title: 'Investment committee decision package', build: () => [{ name: 'IC packages', cols: [14, 30, 26, 14, 50, 30, 50], merges: [], rows: [...banner('Investment committee decisions', 7), head(['ID', 'Company', 'Type', 'Status', 'Proposal', 'Decision maker', 'Rationale / conditions']), ...records('IC Package').map((r) => [B(r.id), T(r.company), T(r.payload?.type), T(r.status), T(r.payload?.proposal), T(r.payload?.decisionMaker ?? ''), T(`${r.payload?.rationale ?? ''}${r.payload?.conditions ? ` · ${r.payload.conditions}` : ''}`)])] }] },
  vcp: { title: 'Value-creation initiative plan', build: () => [{ name: 'Initiatives', cols: [44, 28, 24, 14, 14, 14, 14, 10], freeze: { row: 4, col: 1 }, merges: [], rows: [...banner('Value-creation plan', 8), head(['Initiative', 'Company', 'Type', 'Status', 'Run-rate EBITDA', 'Realised', 'Cost', 'RAG']), ...M.inits.map((i) => [B(i.Initiative), T(i.Company), T(i['Initiative Type']), T(record(`INIT-${i['Initiative Id']}`)?.status ?? i.Status), U(i['Est Ebitda Impact']), U(i['Realised Ebitda Impact']), U(i['Implementation Cost']), T(i.Rag)]), ...records('Initiative').filter((r) => !r.id.startsWith('INIT-')).map((r) => [B(r.title), T(r.company), T(r.payload.type), T(r.status), U(r.payload.est), U(r.payload.realised ?? 0), U(r.payload.cost), T('—')])] }] },
  scenarios: { title: 'Scenario comparison', needsCompany: true, build: (n) => { const base = scenarioBase(n); const cases = ['Approved Forecast', 'Downside Case', 'Value Creation Case', 'Original Investment Case'].map((p) => [p, projectScenario(base, planDrivers(planOf(n, p)))]); const saved = records('Scenario', (r) => r.company === n); return [{ name: 'Scenarios', cols: [34, ...cases.map(() => 18), ...saved.map(() => 18)], merges: [], rows: [...banner(`${n} · scenario comparison`, 2 + cases.length + saved.length), head(['Output', ...cases.map(([k]) => k), ...saved.map((s) => `${s.title} (${s.status})`)]), ...[['Revenue FY+1', (x) => x.years[0].revenue, (s) => s.payload.results.years[0].revenue], ['EBITDA FY+1', (x) => x.years[0].ebitda, (s) => s.payload.results.years[0].ebitda], ['Fair value today', (x) => x.today.fairValue, (s) => s.payload.results.fairValue], ['Exit proceeds', (x) => x.exit.proceeds, (s) => s.payload.results.exitProceeds]].map(([k, f, g]) => [B(k), ...cases.map(([, x]) => U(f(x))), ...saved.map((s) => U(g(s)))]), [B('Gross MOIC'), ...cases.map(([, x]) => X(x.moic)), ...saved.map((s) => X(s.payload.results.moic))], [B('Gross IRR'), ...cases.map(([, x]) => P(x.irr)), ...saved.map((s) => P(s.payload.results.irr))]] }]; } },
};
function statementSheet(n) {
  const L = [['Revenue', 'Revenue'], ['Gross profit', 'Gross Profit'], ['Personnel costs', 'Personnel Costs'], ['Other operating expenses', 'Other Opex'], ['EBITDA', 'Ebitda'], ['Net income', 'Net Income'], ['Free cash flow', 'Free Cash Flow'], ['Cash', 'Cash'], ['Gross debt', 'Gross Debt'], ['Net debt', 'Net Debt'], ['Total assets', 'Total Assets'], ['Total liabilities', 'Total Liabilities'], ['Equity', 'Equity'], ['Budget revenue', 'Budget Revenue'], ['Budget EBITDA', 'Budget Ebitda']];
  return { name: 'Financials', cols: [28, ...QUARTERS.map(() => 11)], freeze: { row: 4, col: 1 }, merges: [], rows: [...banner(`${n} · financial statements (USD m)`, 13), head(['Line', ...QUARTERS]), ...L.map(([k, f]) => [B(k), ...QUARTERS.map((q) => U(finAt(n, q)?.[f]))])] };
}

const printDoc = (title, sheets) => {
  const w = window.open('', '_blank');
  if (!w) { toast('Allow pop-ups to print / save as PDF', 'block', 'warn'); return; }
  const cell = (c) => (c == null ? '' : typeof c.v === 'number' ? (['pct', 'spct'].includes(c.s) ? `${(c.v * 100).toFixed(1)}%` : c.s === 'dec' ? c.v.toFixed(2) : c.s === 'int' ? c.v.toLocaleString() : c.v.toLocaleString('en-US', { maximumFractionDigits: 1, minimumFractionDigits: 1 })) : esc(c.v ?? ''));
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${esc(title)}</title><style>body{font:12px Inter,Arial,sans-serif;color:#1B2433;margin:28px}h1{font-size:20px;color:#14283A;margin:0 0 2px}h2{font-size:14px;color:#14283A;border-bottom:2px solid #4E9A8E;padding-bottom:3px;margin-top:22px}p{color:#5b6576;margin:0 0 10px}table{border-collapse:collapse;width:100%;margin-bottom:10px}th{background:#14283A;color:#fff;text-align:left;padding:4px 6px;font-size:10.5px}td{border-bottom:1px solid #e3e6ea;padding:3px 6px;font-variant-numeric:tabular-nums}td:not(:first-child){text-align:right}@media print{button{display:none}}</style></head><body><h1>${esc(title)}</h1><p>Northstar (illustrative portfolio) · Q3 2026 · approved valuations · generated ${esc(when())} by ${esc(me().name)} · governed semantic layer · mock data</p><button onclick="print()">Print / save as PDF</button>${sheets.map((s) => `<h2>${esc(s.name)}</h2><table>${s.rows.slice(3).map((r, i) => `<tr>${(r ?? []).filter((c, k) => !(k === 0 && c == null && i)).map((c) => (i === 0 ? `<th>${esc(c?.v ?? '')}</th>` : `<td>${cell(c)}</td>`)).join('')}</tr>`).join('')}</table>`).join('')}</body></html>`);
  w.document.close();
  setTimeout(() => w.print(), 400);
};

export const exportMenu = (ctx) => {
  const coSel = el('select', {}, [...M.companies].sort((a, b) => a.Company.localeCompare(b.Company)).map((c) => el('option', { value: c.Company, text: c.Company, selected: c.Company.startsWith('Meridian') })));
  const run = async (key, kind) => {
    const R = REPORTS[key];
    const sheets = R.build(coSel.value);
    const title = `${R.title}${R.needsCompany ? ` — ${coSel.value}` : ''}`;
    if (kind === 'xlsx') {
      const blob = workbookBlob({ sheets, title: `Northstar – ${title}`, author: me().name });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `Northstar_${title.replace(/[^A-Za-z0-9]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx` });
      document.body.append(a); a.click(); a.remove();
      window.__lastExportBytes = blob.size;
      toast(`${esc(title)} · Excel · ${Math.round(blob.size / 1024)} KB · ${sheets.length} sheet${sheets.length > 1 ? 's' : ''}`, 'download_done');
    } else printDoc(title, sheets);
    await audit('Export', key, `Exported ${title} (${kind === 'xlsx' ? 'Excel' : 'PDF'})`, { reason: 'Governed calculations, approved valuations' });
  };
  openDrawer({ title: 'Export and distribution', kicker: 'Same governed calculations and approved data as the application', body: [
    el('label', { class: 'field' }, [el('span', { text: 'Company (for company-level documents)' }), coSel]),
    el('ul', { class: 'exports' }, Object.entries(REPORTS).map(([k, R]) => el('li', {}, [el('b', { text: R.title }), el('small', { text: R.needsCompany ? 'company-level' : 'portfolio' }), el('span', { class: 'row-end' }, [btn('Excel', () => run(k, 'xlsx'), { kind: 'sm', ic: 'table_view' }), btn('PDF', () => run(k, 'pdf'), { kind: 'ghost sm', ic: 'picture_as_pdf' })])]))),
    el('p', { class: 'note', text: 'Excel: formatted multi-sheet workbooks with number formats, header fills and frozen panes. PDF: a print-ready document (use “Save as PDF”). Each export is recorded in the audit history.' }),
  ] });
};
