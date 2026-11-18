/** Companies — the investment workspace: overview, spreadsheet statements with drill-down, thesis tracker, valuation, capital structure, KPIs. */
import { el, esc, icon, money, smoney, pct, spct, pts, mult, smult, int, tone, N, me, can, denied, saveRecord, records, onStore, openDrawer, ask, pill, eventsFor, toast, ccy } from '../core.js';
import { M, co, finOf, finAt, valsOf, currentVal, returnsOf, ltm, QUARTERS, LATEST, loadKpis, activePlan } from '../data.js';
import { sheet, spark, btn, section, kv, tabs, stepper } from '../ui.js';

const LINES = {
  is: [['Revenue', 'Revenue', 't'], ['Cost of goods sold', 'Cogs', '', -1], ['Gross profit', 'Gross Profit', 's'], ['Gross margin', (r) => r['Gross Profit'] / r.Revenue, 'm'], ['Personnel costs', 'Personnel Costs', '', -1], ['Other operating expenses', 'Other Opex', '', -1], ['EBITDA', 'Ebitda', 't'], ['EBITDA margin', (r) => r.Ebitda / r.Revenue, 'm'], ['Non-recurring items (add-back)', 'Nonrecurring Items', 'memo'], ['Adjusted EBITDA', (r) => r.Ebitda + r['Nonrecurring Items'], 's'], ['Depreciation & amortisation', 'Depreciation Amortisation', '', -1], ['EBIT', 'Ebit', 's'], ['Interest expense', 'Interest Expense', '', -1], ['Tax', 'Tax', '', -1], ['Net income', 'Net Income', 't']],
  bs: [['Cash', 'Cash'], ['Receivables', 'Receivables'], ['Inventory', 'Inventory'], ['Property, plant & equipment', 'Ppe'], ['Goodwill & intangibles', 'Goodwill'], ['Other assets', 'Other Assets'], ['Total assets', 'Total Assets', 't'], ['Gross debt', 'Gross Debt'], ['Payables', 'Payables'], ['Other liabilities', 'Other Liabilities'], ['Total liabilities', 'Total Liabilities', 's'], ["Shareholders' equity", 'Equity'], ['Total liabilities & equity', (r) => r['Total Liabilities'] + r.Equity, 't'], ['Check: assets − (liabilities + equity)', (r) => r['Total Assets'] - r['Total Liabilities'] - r.Equity, 'chk'], ['Net debt', 'Net Debt', 'memo'], ['Net leverage (LTM)', (r) => r['Net Debt'] / r['Ltm Ebitda'], 'x']],
  cf: [['EBITDA', 'Ebitda'], ['Interest paid', 'Interest Expense', '', -1], ['Tax paid', 'Tax', '', -1], ['Change in working capital', 'Change In Nwc', '', -1], ['Operating cash flow', 'Operating Cash Flow', 's'], ['Capital expenditure', 'Capex', '', -1], ['Free cash flow', 'Free Cash Flow', 't'], ['Cash conversion (FCF ÷ EBITDA)', (r) => r['Free Cash Flow'] / r.Ebitda, 'm'], ['Financing cash flow', 'Financing Cash Flow'], ['Opening cash', 'Opening Cash', 'memo'], ['Closing cash', 'Cash', 't'], ['Check: opening + FCF + financing − closing', (r) => r['Opening Cash'] + r['Free Cash Flow'] + r['Financing Cash Flow'] - r.Cash, 'chk']],
};
const FLOW = new Set(['is', 'cf']);
const valueOf = (line, r) => (typeof line[1] === 'function' ? line[1](r) : r[line[1]] * (line[3] ?? 1));
const isRatio = (line) => ['m', 'x'].includes(line[2]);
const fmtLine = (line, v) => (line[2] === 'm' ? pct(v) : line[2] === 'x' ? mult(v) : line[2] === 'chk' ? (Math.abs(v) < 0.01 ? '✓ 0.0' : money(v, 2)) : money(v));

export const mountCompany = (ctx, pane) => {
  const { card, select, go } = ctx;
  let name = M.companies.find((c) => c.Company.startsWith('Meridian'))?.Company ?? M.companies[0].Company;
  const picker = el('select', { class: 'co-pick', 'aria-label': 'Portfolio company' }, [...M.companies].sort((a, b) => a.Company.localeCompare(b.Company)).map((c) => el('option', { value: c.Company, text: `${c.Company} · ${c.Fund}` })));
  picker.addEventListener('change', () => open(picker.value));
  const head = el('div', { class: 'co-head' });
  const overview = el('div', { class: 'tabpane' });
  const statements = el('div', { class: 'tabpane' });
  const thesis = el('div', { class: 'tabpane' });
  const valuation = el('div', { class: 'tabpane' });
  const capital = el('div', { class: 'tabpane' });
  const kpis = el('div', { class: 'tabpane' });
  const P = { overview, statements, thesis, valuation, capital, kpis };
  const tabBar = tabs([['overview', 'Overview'], ['statements', 'Financial statements'], ['thesis', 'Investment thesis'], ['valuation', 'Valuation'], ['capital', 'Capital structure'], ['kpis', 'Operating KPIs']], (k) => { for (const [kk, p] of Object.entries(P)) p.hidden = kk !== k; });

  // native objects live in fixed containers inside the tab panes
  const nativeOverview = el('div', { class: 'grid' }, [card('c-rev', 'half'), card('c-ebitda', 'half'), card('c-margin', 'half'), card('c-val', 'half')]);
  const nativeCapital = el('div', { class: 'grid' }, [card('c-debt', 'full')]);
  const nativeKpis = el('div', { class: 'grid' }, [card('c-kpi', 'full')]);
  const ovBody = el('div'), stBody = el('div'), thBody = el('div'), vaBody = el('div'), caBody = el('div'), kpBody = el('div');
  overview.append(ovBody, nativeOverview); statements.append(stBody); thesis.append(thBody); valuation.append(vaBody); capital.append(caBody, nativeCapital); kpis.append(nativeKpis, kpBody);
  pane.append(el('div', { class: 'page-head' }, [el('div', {}, [el('h2', { text: 'Company workspace' }), el('p', { text: 'Everything about one investment: performance, statements, thesis, valuation, capital structure and operating KPIs. Every figure links to its governed source records.' })]), el('div', { class: 'row-end' }, [el('label', { class: 'inline' }, [el('span', { text: 'Company' }), picker])])]), head, tabBar, overview, statements, thesis, valuation, capital, kpis);

  const createAction = async (title, context = '') => {
    if (!can('action.create')) return denied('action.create');
    const t = await ask({ title: `Create action · ${name}`, text: context ? esc(context) : 'Assign a follow-up to the deal team.', label: 'What needs to happen', value: title, confirmLabel: 'Create action' });
    if (!t) return;
    await saveRecord({ type: 'Action', prefix: 'ACT', company: name, fund: co(name).Fund, period: '2026-Q3', title: t, status: 'Open', owner: co(name)['Deal Lead'], due: '2026-11-30', payload: { context } }, { action: 'Created action', next: 'Open', reason: context || t });
  };
  ctx.createAction = (company, title, context) => { name = company; return createAction(title, context); };

  // ---------------------------------------------------------------- header + overview
  const renderHead = () => {
    const c = co(name), cv = currentVal(name), r = returnsOf(name), f = finAt(name, LATEST);
    head.replaceChildren(
      el('div', { class: 'co-id' }, [el('div', { class: 'co-logo', text: c['Short Code'] }), el('div', {}, [el('h2', { text: name }), el('p', { text: `${c.Subsector} · ${c.Country} · ${c.Fund} · reports in ${c['Reporting Ccy']}` }), el('p', { class: 'muted', text: c.Description })]),
        el('div', { class: 'co-tags' }, [pill(c['Risk Class']), pill(c.Stage), c['Requires Review'] === 'Review required' ? pill('Investment review') : null])]),
      el('div', { class: 'co-actions' }, [
        btn('Scenario Lab', () => go('scenario', name), { ic: 'science' }), btn('Valuation', () => go('valuations', name), { ic: 'balance', kind: 'ghost' }),
        btn('Value creation', () => go('value', name), { ic: 'trending_up', kind: 'ghost' }), btn('Ask Nash', () => go('nash', `Why is ${name} underperforming its investment case?`), { ic: 'auto_awesome', kind: 'ghost' }),
        btn('Create action', () => createAction(''), { ic: 'add_task', kind: 'ghost' }),
      ]),
    );
    const ltmE = ltm(name, 'Ebitda'), ltmR = ltm(name, 'Revenue'), undrawn = M.debt.filter((d) => d.Company === name).reduce((s, d) => s + d.Undrawn, 0);
    const tiles = [['Enterprise value', money(cv?.['Enterprise Value'], 0), `${mult(cv?.Multiple)} ${cv?.Method === 'EV/Revenue' ? 'LTM revenue' : 'LTM EBITDA'}`], ['Equity value (100%)', money(cv?.['Equity Value'], 0), `net debt ${money(cv?.['Net Debt'], 0)}`], ['Northstar fair value', money(cv?.['Fair Value'], 0), `${pct(cv?.Ownership, 0)} economic ownership · ${cv?.Quarter} approved`], ['Revenue LTM', money(ltmR, 0), `${spct(ltmR / ltm(name, 'Revenue', '2025-Q3') - 1)} YoY`], ['EBITDA LTM', money(ltmE, 0), `${pct(ltmE / ltmR)} margin`], ['Free cash flow LTM', money(ltm(name, 'Free Cash Flow'), 0), `${pct(ltm(name, 'Free Cash Flow') / ltmE, 0)} conversion`], ['Net leverage', mult(f['Net Debt'] / ltmE), `cover ${mult(ltmE / ltm(name, 'Interest Expense'))}`], ['Liquidity', money(f.Cash + undrawn, 0), `cash ${money(f.Cash, 0)} + undrawn ${money(undrawn, 0)}`], ['Gross MOIC', `${r.moic.toFixed(2)}x`, `target ${c['Uw Target Moic']}x`], ['Gross IRR', pct(cv?.['Gross Irr']), `target ${pct(c['Uw Target Irr'], 0)}`]];
    const uwRows = [
      { k: 'Revenue CAGR', uw: pct(c['Uw Revenue Cagr'], 0), act: pct((ltmR / c['Entry Revenue']) ** (1 / ((2026.75 - c['Entry Year'] - 0.3))) - 1), ok: ltmR / ltm(name, 'Uw Revenue') - 1 },
      { k: 'EBITDA (LTM vs case path)', uw: money(ltm(name, 'Uw Ebitda'), 0), act: money(ltmE, 0), ok: ltmE / ltm(name, 'Uw Ebitda') - 1 },
      { k: 'EBITDA margin', uw: pct(c['Uw Ebitda Margin Target']), act: pct(ltmE / ltmR), ok: (ltmE / ltmR) / c['Uw Ebitda Margin Target'] - 1 },
      { k: 'Valuation multiple', uw: mult(c['Uw Exit Multiple']), act: mult(cv?.Multiple), ok: (cv?.Multiple ?? 0) / c['Uw Exit Multiple'] - 1 },
      { k: 'Gross MOIC', uw: `${c['Uw Target Moic']}x`, act: `${r.moic.toFixed(2)}x`, ok: r.moic / c['Uw Target Moic'] - 1 },
    ];
    const inits = M.inits.filter((i) => i.Company === name);
    const newInits = records('Initiative', (x) => x.company === name);
    const acts = records('Action', (x) => x.company === name && ['Open', 'In Progress'].includes(x.status));
    const mon = records('Monitoring', (x) => x.company === name && x.period === '2026-Q3')[0];
    const val = M.vals.find((v) => v.Company === name && v.Quarter === '2026-Q3');
    ovBody.replaceChildren(
      el('div', { class: 'metric-tiles' }, tiles.map(([k, v, s]) => el('div', {}, [el('small', { text: k }), el('b', { text: v }), el('span', { text: s })]))),
      el('div', { class: 'cols3' }, [
        section('Investment', kv([['Thesis', c.Thesis], ['Deal team', c['Deal Team']], ['Operating partner', c['Operating Partner']], ['Entry', `${String(c['Entry Date']).slice(0, 10)} · EV ${money(c['Entry Ev'], 0)} at ${mult(c['Entry Multiple'])}`], ['Ownership', `${pct(c['Initial Ownership'], 0)} at entry → ${pct(c['Current Ownership'], 0)} today`], ['Invested / realised', `${money(r.invested, 0)} / ${money(r.realised, 0)}`], ['Planned exit', String(c['Planned Exit Year'])], ['Operating plan', `${activePlan(name)?.Plan} (v${activePlan(name)?.Version ?? 1})`]])),
        section('Performance vs underwriting', sheet([{ key: 'k', label: 'Component' }, { key: 'uw', label: 'Underwritten' }, { key: 'act', label: 'Actual' }, { key: 'ok', label: 'Variance', fmt: spct, tone: (v) => tone(v) }], uwRows)),
        section('Open actions & reviews', el('ul', { class: 'todo' }, [
          el('li', {}, [icon('fact_check'), el('span', { text: 'Q3 2026 monitoring pack' }), pill(mon?.status ?? '–'), el('button', { class: 'linkish', text: 'Open', onclick: () => go('monitoring', name) })]),
          el('li', {}, [icon('balance'), el('span', { text: 'Q3 2026 valuation' }), pill(val?.Status ?? '–'), el('button', { class: 'linkish', text: 'Open', onclick: () => go('valuations', name) })]),
          ...acts.map((a) => el('li', {}, [icon('task_alt'), el('span', { text: a.title }), pill(a.status)])),
          ...[...inits.filter((i) => !['Completed', 'Benefits Verified'].includes(i.Status)).map((i) => [i.Initiative, i.Status]), ...newInits.map((i) => [i.title, i.status])].map(([t, s]) => el('li', {}, [icon('trending_up'), el('span', { text: t }), pill(s)])),
        ])),
      ]),
      section('Key investment risks', el('div', { class: 'risks' }, risksFor(name).map(([sev, t, d]) => el('div', { class: `risk r-${sev}` }, [el('b', { text: t }), el('span', { text: d })])))),
    );
  };
  const risksFor = (n) => {
    const out = [];
    const lev = finAt(n, LATEST)['Net Debt'] / ltm(n, 'Ebitda'), levPy = finAt(n, '2025-Q3')['Net Debt'] / ltm(n, 'Ebitda', '2025-Q3');
    const cov = ltm(n, 'Ebitda') / ltm(n, 'Interest Expense');
    const cv = M.debt.filter((d) => d.Company === n).reduce((s, d) => Math.max(s, d['Covenant Max Leverage']), 0);
    const m = ltm(n, 'Ebitda') / ltm(n, 'Revenue'), mp = ltm(n, 'Ebitda', '2025-Q3') / ltm(n, 'Revenue', '2025-Q3');
    const quarters = QUARTERS.slice(-5).map((q) => finAt(n, q)).map((r) => r.Ebitda / r.Revenue);
    const consec = quarters.reduce((s, v, i) => (i && v < quarters[i - 1] ? s + 1 : i ? 0 : s), 0);
    if (lev > 5 || lev - levPy > 0.2) out.push(['hi', 'Leverage', `Net leverage ${mult(lev)} (${smult(lev - levPy)} YoY) against a ${mult(cv)} covenant — headroom ${mult(cv - lev)}.`]);
    if (cov < 2.2) out.push(['hi', 'Interest cover', `LTM EBITDA covers interest ${mult(cov)}; floating-rate exposure ${money(M.debt.filter((d) => d.Company === n).reduce((s, d) => s + d['Floating Drawn'], 0), 0)}.`]);
    if (m < mp - 0.01) out.push(['md', 'Margin compression', `EBITDA margin ${pct(m)} vs ${pct(mp)} a year ago${consec >= 3 ? `; down ${consec} consecutive quarters` : ''}.`]);
    const uw = ltm(n, 'Ebitda') / ltm(n, 'Uw Ebitda') - 1;
    if (uw < -0.08) out.push(['md', 'Underwriting gap', `LTM EBITDA ${spct(uw)} versus the original investment case.`]);
    const conv = ltm(n, 'Free Cash Flow') / ltm(n, 'Ebitda');
    if (conv < 0.3) out.push(['md', 'Cash conversion', `FCF conversion ${pct(conv, 0)} of EBITDA (LTM).`]);
    if (!out.length) out.push(['lo', 'No material risks flagged', 'All monitoring rules within tolerance.']);
    return out;
  };

  // ---------------------------------------------------------------- statements (spreadsheet grid, drill-down)
  let stmt = 'is', basis = 'Q', compare = 'none';
  const renderStatements = () => {
    const rows = finOf(name);
    const control = (label, opts, cur, set) => el('div', { class: 'seg' }, [el('small', { text: label }), ...opts.map(([k, t]) => el('button', { class: k === cur ? 'on' : '', text: t, onclick: () => { set(k); renderStatements(); } }))]);
    let cols;
    if (basis === 'Q') cols = QUARTERS.map((qq) => ({ key: qq, label: qq.replace('-', ' '), rows: [finAt(name, qq)] }));
    else cols = [['FY2024', ['2024-Q1', '2024-Q2', '2024-Q3', '2024-Q4']], ['FY2025', ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4']], ['LTM Q3 2025', ['2024-Q4', '2025-Q1', '2025-Q2', '2025-Q3']], ['LTM Q3 2026', ['2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3']]].map(([k, qs]) => ({ key: k, label: k, rows: qs.map((qq) => finAt(name, qq)) }));
    const agg = (line, rs) => {
      if (!FLOW.has(stmt) || line[2] === 'chk' && stmt === 'bs') { const last = rs.at(-1); return valueOf(line, last); }
      if (isRatio(line)) { const sum = (k) => rs.reduce((s, r) => s + r[k], 0); if (line[0].startsWith('Gross margin')) return sum('Gross Profit') / sum('Revenue'); if (line[0].startsWith('EBITDA margin')) return sum('Ebitda') / sum('Revenue'); if (line[0].startsWith('Cash conversion')) return sum('Free Cash Flow') / sum('Ebitda'); }
      if (line[0] === 'Opening cash') return rs[0]['Opening Cash'];
      if (line[0] === 'Closing cash') return rs.at(-1).Cash;
      if (line[2] === 'chk') return rs[0]['Opening Cash'] + rs.reduce((s, r) => s + r['Free Cash Flow'] + r['Financing Cash Flow'], 0) - rs.at(-1).Cash;
      return rs.reduce((s, r) => s + valueOf(line, r), 0);
    };
    const cmpOf = (line, col, i) => {
      if (compare === 'none' || isRatio(line) || line[2] === 'chk') return null;
      const v = agg(line, col.rows);
      if (compare === 'budget' || compare === 'forecast') {
        const key = { Revenue: compare === 'budget' ? 'Budget Revenue' : 'Forecast Revenue', Ebitda: compare === 'budget' ? 'Budget Ebitda' : 'Forecast Ebitda' }[line[1]];
        if (!key) return null;
        const b = col.rows.reduce((s, r) => s + r[key], 0);
        return { v: v / b - 1, label: `${compare} ${money(b)}` };
      }
      if (compare === 'yoy') { const prior = basis === 'Q' ? (i >= 4 ? cols[i - 4] : null) : (i >= 2 ? cols[i - 2] : null); if (!prior) return null; const p = agg(line, prior.rows); return { v: v / p - 1, label: `PY ${money(p)}` }; }
      if (compare === 'qoq' && i > 0) { const p = agg(line, cols[i - 1].rows); return { v: v / p - 1, label: `prior ${money(p)}` }; }
      return null;
    };
    const lines = LINES[stmt];
    const table = el('table', { class: 'sheet fin sticky' }, [
      el('thead', {}, el('tr', {}, [el('th', { text: `${{ is: 'Income statement', bs: 'Balance sheet', cf: 'Cash flow statement' }[stmt]} · ${ccy()} m` }), ...cols.map((c) => el('th', { class: 'r', text: c.label })), basis === 'Q' ? el('th', { class: 'r', text: 'TTM' }) : null, el('th', { class: 'r', text: 'Trend' })])),
      el('tbody', {}, lines.map((line) => el('tr', { class: `ln-${line[2] || 'l'}` }, [
        el('td', { text: line[0] }),
        ...cols.map((c, i) => {
          const v = agg(line, c.rows);
          const cmp = cmpOf(line, c, i);
          return el('td', { class: `r click ${line[2] === 'chk' && Math.abs(v) > 0.01 ? 'neg' : ''}`, title: 'Click for source records and calculation', onclick: () => drill(line, c) }, [el('span', { text: fmtLine(line, v) }), cmp && Number.isFinite(cmp.v) ? el('small', { class: `cmp ${tone(cmp.v, !['Cost of goods sold', 'Personnel costs', 'Other operating expenses'].includes(line[0]))}`, title: cmp.label, text: spct(cmp.v) }) : null]);
        }),
        basis === 'Q' ? el('td', { class: 'r ttm' }, el('span', { text: fmtLine(line, agg(line, cols.slice(-4).flatMap((c) => c.rows))) })) : null,
        el('td', { class: 'r' }, isRatio(line) || line[2] === 'chk' ? null : spark(cols.map((c) => agg(line, c.rows)), { w: 80, h: 18 })),
      ]))),
    ]);
    stBody.replaceChildren(
      el('div', { class: 'toolbar' }, [control('Statement', [['is', 'Income statement'], ['bs', 'Balance sheet'], ['cf', 'Cash flow']], stmt, (k) => { stmt = k; }), control('Periods', [['Q', 'Quarterly'], ['A', 'Annual / LTM']], basis, (k) => { basis = k; }), control('Compare', [['none', 'None'], ['budget', 'vs Budget'], ['forecast', 'vs Forecast'], ['yoy', 'YoY'], ['qoq', 'QoQ']], compare, (k) => { compare = k; })]),
      el('div', { class: 'sheet-wrap' }, table),
      el('p', { class: 'note', text: `Source: monitoring packs (${finAt(name, LATEST)['Source System']}), converted to USD at the Northstar Treasury quarter-end rate (${finAt(name, LATEST).Ccy}); ${ccy() !== 'USD' ? `presented in ${ccy()} at ${ccy()} quarter-end rate. ` : ''}Balance sheets balance and cash flows reconcile to closing cash — the check rows prove it. Variance explanations: click any revenue or EBITDA figure.` }),
    );
  };
  const drill = (line, col) => {
    const rs = col.rows;
    const isRev = line[1] === 'Revenue', isE = line[1] === 'Ebitda';
    openDrawer({ title: `${line[0]} · ${col.label}`, kicker: `${name} · drill-down to source records`, wide: true, body: [
      section('Calculation lineage', el('p', { html: typeof line[1] === 'function' ? `Derived line: <code>${esc(String(line[1]).replace(/^\(r\) => /, '').replace(/r\[?'?([A-Za-z ]+)'?\]?/g, '$1'))}</code> evaluated per record${FLOW.has(stmt) && !isRatio(line) ? ', summed over the period' : ''}.` : `Field <code>Financials.${esc(line[1])}</code> (ASTRATO_GALLERY.MOCK_DATA.NSC_FINANCIALS.${esc(line[1].toUpperCase().replace(/ /g, '_'))})${line[3] === -1 ? ' presented as a deduction' : ''}; ${FLOW.has(stmt) ? 'flows are summed over quarters' : 'balances are taken at period end'}. Governed measure equivalents: ${isRev ? 'Revenue, Revenue LTM, Budget Variance' : isE ? 'EBITDA, EBITDA LTM, EBITDA Margin' : '—'}.` })),
      section('Source records', sheet([{ key: 'Quarter', label: 'Quarter' }, { key: 'Source System', label: 'Source', cls: '' }, { key: 'Ccy', label: 'CCY', cls: '' }, { key: 'Fx Rate To Usd', label: 'FX to USD', fmt: (v) => v.toFixed(4) }, { key: 'v', label: 'USD m', fmt: (v) => money(v, 2) }, { key: 'loc', label: 'Local m', fmt: (v) => v.toFixed(2) }, { key: 'Budget Revenue', label: 'Budget rev.', fmt: (v) => money(v) }, { key: 'Forecast Revenue', label: 'Forecast rev.', fmt: (v) => money(v) }],
        rs.map((r) => ({ ...r, v: valueOf(line, r), loc: valueOf(line, r) / r['Fx Rate To Usd'] })))),
      isRev || isE ? section('Variance explanation (governed drivers)', varianceText(rs, isRev)) : null,
      el('div', { class: 'row-end' }, [btn('Investigate in Financial Analysis', () => go('analysis', { company: name }), { ic: 'query_stats', kind: 'ghost' }), btn('Create action', () => createAction(`Explain ${line[0]} ${col.label}`, `${line[0]} ${col.label}: ${fmtLine(line, rs.reduce((s, r) => s + valueOf(line, r), 0))}`), { ic: 'add_task' })]),
    ] });
  };
  const varianceText = (rs, isRev) => {
    const sum = (k) => rs.reduce((s, r) => s + r[k], 0);
    if (isRev) {
      const py = sum('Py Revenue'), d = sum('Revenue') - py;
      return el('div', {}, [sheet([{ key: 'k', label: 'Driver vs same quarter(s) last year' }, { key: 'v', label: 'USD m', fmt: (v) => smoney(v) }, { key: 's', label: 'Share of change', fmt: (v) => pct(v, 0) }], [['Pricing', 'Price Effect'], ['Volume', 'Volume Effect'], ['Product / customer mix', 'Mix Effect']].map(([k, f]) => ({ k, v: sum(f), s: sum(f) / d })), { foot: { k: 'Total change', v: smoney(d), s: '100%' } }),
        el('p', { class: 'note', text: `Budget variance ${spct(sum('Revenue') / sum('Budget Revenue') - 1)} · forecast variance ${spct(sum('Revenue') / sum('Forecast Revenue') - 1)} · underwriting ${spct(sum('Revenue') / sum('Uw Revenue') - 1)}.` })]);
    }
    const m = sum('Ebitda') / sum('Revenue');
    return el('p', { text: `EBITDA ${money(sum('Ebitda'))} at ${pct(m)} margin: gross margin ${pct(sum('Gross Profit') / sum('Revenue'))}, personnel ${pct(sum('Personnel Costs') / sum('Revenue'))} and other opex ${pct(sum('Other Opex') / sum('Revenue'))} of revenue. Versus budget ${spct(sum('Ebitda') / sum('Budget Ebitda') - 1)}, versus investment case ${spct(sum('Ebitda') / sum('Uw Ebitda') - 1)}.` });
  };

  // ---------------------------------------------------------------- thesis tracker
  const renderThesis = () => {
    const comps = M.thesis.filter((t) => t.Company === name);
    const latest = (cid) => records('Thesis Assessment', (r) => r.payload?.component === cid).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))[0];
    thBody.replaceChildren(
      el('p', { class: 'lead', text: co(name).Thesis }),
      el('div', { class: 'thesis' }, comps.map((t) => {
        const a = latest(t['Component Id']);
        const status = a?.status ?? t.Status;
        return el('div', { class: `th th-${status.toLowerCase().replace(/ /g, '-')}` }, [
          el('header', {}, [el('b', { text: t.Component }), pill(status)]),
          kv([['Underwritten', t.Underwriting], ['Current', t['Current Value']], ['Measure', t.Metric], ['Assessed', `${a ? `${a.updatedBy} · ${a.updatedAt}` : `${t['Assessed By']} · ${String(t['Assessed At']).slice(0, 10)}`}`]]),
          a?.payload?.evidence ? el('p', { class: 'evidence', html: `<b>Evidence:</b> ${esc(a.payload.evidence)}` }) : null,
          el('div', { class: 'row-end' }, [btn('Update assessment', () => assess(t, status), { kind: 'ghost sm', ic: 'edit_note' }), btn('Corrective action', () => createAction(`Corrective action: ${t.Component}`, `${t.Component}: underwritten ${t.Underwriting}, current ${t['Current Value']}`), { kind: 'ghost sm', ic: 'add_task' })]),
        ]);
      })),
    );
  };
  const assess = async (t, status) => {
    if (!['Investment Analyst', 'Investment Associate', 'Investment Director'].includes(me().role)) return denied('scenario.save');
    const back = el('div', { class: 'modal-back' });
    const sel = el('select', {}, ['On track', 'At risk', 'Off track'].map((s) => el('option', { value: s, text: s, selected: s === status })));
    const ev = el('textarea', { rows: 3, placeholder: 'Evidence (source, data point, management commentary)' });
    back.append(el('div', { class: 'modal' }, [el('h3', { text: `${t.Component} · ${name}` }), el('label', {}, [el('span', { text: 'Assessment' }), sel]), ev, el('div', { class: 'row-end' }, [el('button', { class: 'btn ghost', text: 'Cancel', onclick: () => back.remove() }), el('button', { class: 'btn', text: 'Save assessment', onclick: async () => { if (!ev.value.trim()) { ev.classList.add('err'); return; } back.remove(); await saveRecord({ type: 'Thesis Assessment', prefix: 'THA', company: name, fund: co(name).Fund, period: '2026-Q3', title: `${t.Component} — ${name}`, status: sel.value, owner: me().name, payload: { component: t['Component Id'], evidence: ev.value.trim() } }, { action: 'Thesis assessment updated', prev: status, next: sel.value, reason: ev.value.trim() }); renderThesis(); } })])]));
    document.body.append(back);
  };

  // ---------------------------------------------------------------- valuation history, capital structure, KPIs
  const renderValuation = () => {
    const v = valsOf(name);
    vaBody.replaceChildren(sheet([{ key: 'Quarter', label: 'Quarter' }, { key: 'Status', label: 'Status', cls: '', fmt: (x) => pill(x) }, { key: 'Method', label: 'Method', cls: '' }, { key: 'Metric Ltm', label: 'LTM metric', fmt: (x) => money(x) }, { key: 'Multiple', label: 'Multiple', fmt: mult }, { key: 'Enterprise Value', label: 'EV', fmt: (x) => money(x, 0) }, { key: 'Net Debt', label: 'Net debt', fmt: (x) => money(x, 0) }, { key: 'Equity Value', label: 'Equity (100%)', fmt: (x) => money(x, 0) }, { key: 'Ownership', label: 'Own.', fmt: (x) => pct(x, 0) }, { key: 'Fair Value', label: 'Fair value', fmt: (x) => money(x) }, { key: 'Valuation Movement', label: 'Movement', fmt: (x) => smoney(x), tone: (x) => tone(x) }, { key: 'Gross Moic', label: 'MOIC', fmt: (x) => `${x.toFixed(2)}x` }, { key: 'Gross Irr', label: 'IRR', fmt: pct }], v),
      el('div', { class: 'row-end' }, [btn('Open valuation workbench', () => go('valuations', name), { ic: 'balance' })]));
  };
  const renderCapital = () => {
    const d = M.debt.filter((x) => x.Company === name), f = finAt(name, LATEST), e = ltm(name, 'Ebitda');
    const cap = Math.max(...d.map((x) => x['Covenant Max Leverage']));
    caBody.replaceChildren(el('div', { class: 'metric-tiles' }, [['Gross debt', money(f['Gross Debt'], 0)], ['Cash', money(f.Cash, 0)], ['Net debt', money(f['Net Debt'], 0)], ['Net leverage', mult(f['Net Debt'] / e)], ['Covenant max', mult(cap)], ['Headroom (EBITDA)', `${pct(1 - (f['Net Debt'] / cap) / e, 0)}`], ['Interest LTM', money(ltm(name, 'Interest Expense'), 0)], ['All-in rate', pct(f['Interest Rate'], 2)]].map(([k, v]) => el('div', {}, [el('small', { text: k }), el('b', { text: v })]))));
  };
  const renderKpis = async () => {
    kpBody.replaceChildren(el('p', { class: 'note', text: 'Loading monthly operating KPIs…' }));
    const rows = await loadKpis(ctx.q, name).catch(() => []);
    const last = rows.slice(-12);
    kpBody.replaceChildren(section('Operating KPIs · last 12 months (monthly feed; quarterly sums reconcile to reported revenue)', sheet([{ key: 'k', label: 'KPI' }, ...last.map((r) => ({ key: r.Month, label: r.Month.slice(2) })), { key: 't', label: 'Trend' }], [['Revenue ($m)', 'Monthly Revenue', (v) => money(v)], ['Customers', 'Customers', int], ['Net revenue retention', 'Net Revenue Retention', (v) => pct(v)], ['Gross churn', 'Gross Churn', (v) => pct(v)], ['Headcount', 'Headcount', int], ['Pipeline ($m)', 'Sales Pipeline', (v) => money(v, 0)], ['DSO (days)', 'Dso Days', int]].map(([k, f, fm]) => ({ k, ...Object.fromEntries(last.map((r) => [r.Month, fm(r[f])])), t: spark(rows.map((r) => r[f]), { w: 90, h: 18 }) })))));
  };

  const open = (n) => {
    name = n; picker.value = n;
    select('g-company', 'Company', 'Companies', [n]);
    renderHead(); renderStatements(); renderThesis(); renderValuation(); renderCapital(); renderKpis();
  };
  onStore(() => { if (!pane.hidden) { renderHead(); renderThesis(); } });
  window.addEventListener('nsos-ccy', () => { renderHead(); renderStatements(); renderValuation(); renderCapital(); });
  window.addEventListener('nsos-model', () => { renderHead(); renderValuation(); });
  ctx.onShow('company', (arg) => { open(typeof arg === 'string' ? arg : name); if (arg && typeof arg === 'object' && arg.tab) tabBar.set(arg.tab); });
  setTimeout(() => open(name), 0);
};
