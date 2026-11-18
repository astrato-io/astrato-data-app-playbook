/** Financial Analysis — governed analytics plus the interactive EBITDA bridge and investigation panel. */
import { el, esc, icon, money, smoney, pct, spct, pts, mult, tone, N, openDrawer, can, denied, saveRecord, ask, me } from '../core.js';
import { M, co, finAt, QUARTERS, loadKpis } from '../data.js';
import { sheet, spark, btn, section, waterfall } from '../ui.js';

const sumQ = (names, qs, k) => names.reduce((s, n) => s + qs.reduce((t, q) => t + (finAt(n, q)?.[k] ?? 0), 0), 0);
const COMPARE = [
  ['ltm', 'LTM Q3 2026 vs LTM Q3 2025', ['2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3'], ['2024-Q4', '2025-Q1', '2025-Q2', '2025-Q3']],
  ['q3', 'Q3 2026 vs Q3 2025', ['2026-Q3'], ['2025-Q3']],
  ['q2', 'Q2 2026 vs Q2 2025', ['2026-Q2'], ['2025-Q2']],
  ['q1', 'Q1 2026 vs Q1 2025', ['2026-Q1'], ['2025-Q1']],
  ['fy', 'FY2025 vs FY2024', ['2025-Q1', '2025-Q2', '2025-Q3', '2025-Q4'], ['2024-Q1', '2024-Q2', '2024-Q3', '2024-Q4']],
];
/**
 * EBITDA bridge with explicit source assumptions:
 *   volume and mix drop through at the prior-period gross margin; pricing drops through in full;
 *   gross margin = Δ gross profit − the three revenue effects; personnel, recurring opex and
 *   non-recurring items are their own cost changes. Components sum exactly to Δ EBITDA.
 */
export const ebitdaBridge = (names, cur, prev) => {
  const s = (k, qs) => sumQ(names, qs, k);
  const R0 = s('Revenue', prev), R1 = s('Revenue', cur), GP0 = s('Gross Profit', prev), GP1 = s('Gross Profit', cur);
  const GM0 = GP0 / R0;
  const P = s('Price Effect', cur), V = s('Volume Effect', cur), X = s('Mix Effect', cur);
  const E0 = s('Ebitda', prev), E1 = s('Ebitda', cur);
  const NR0 = s('Nonrecurring Items', prev), NR1 = s('Nonrecurring Items', cur);
  const comps = [
    { key: 'volume', label: 'Revenue volume', value: V * GM0, how: `Volume effect ${money(V)} × prior gross margin ${pct(GM0)}`, fields: ['Volume Effect', 'Gross Profit', 'Revenue'] },
    { key: 'price', label: 'Pricing', value: P, how: `Price effect ${money(P)} drops through to gross profit in full`, fields: ['Price Effect'] },
    { key: 'mix', label: 'Product / customer mix', value: X * GM0, how: `Mix effect ${money(X)} × prior gross margin ${pct(GM0)}`, fields: ['Mix Effect'] },
    { key: 'gm', label: 'Gross margin', value: GP1 - GP0 - (V + X) * GM0 - P, how: `Δ gross profit ${smoney(GP1 - GP0)} less the three revenue effects; gross margin ${pct(GM0)} → ${pct(GP1 / R1)}`, fields: ['Gross Profit', 'Cogs'] },
    { key: 'personnel', label: 'Personnel costs', value: -(s('Personnel Costs', cur) - s('Personnel Costs', prev)), how: `${money(s('Personnel Costs', prev))} → ${money(s('Personnel Costs', cur))} (${pct(s('Personnel Costs', prev) / R0)} → ${pct(s('Personnel Costs', cur) / R1)} of revenue)`, fields: ['Personnel Costs'] },
    { key: 'opex', label: 'Other operating expenses', value: -((s('Other Opex', cur) - NR1) - (s('Other Opex', prev) - NR0)), how: `Recurring other opex ${money(s('Other Opex', prev) - NR0)} → ${money(s('Other Opex', cur) - NR1)}`, fields: ['Other Opex'] },
    { key: 'nonrec', label: 'Non-recurring items', value: -(NR1 - NR0), how: `Non-recurring costs ${money(NR0)} → ${money(NR1)} (added back in Adjusted EBITDA)`, fields: ['Nonrecurring Items'] },
  ];
  const check = E0 + comps.reduce((t, c) => t + c.value, 0) - E1;
  return { E0, E1, R0, R1, comps, check };
};

export const mountAnalysis = (ctx, pane) => {
  const { card, filters, go } = ctx;
  const coSel = el('select', { 'aria-label': 'Bridge scope' }, [el('option', { value: '', text: 'Whole portfolio (in fund filter)' }), ...[...M.companies].sort((a, b) => a.Company.localeCompare(b.Company)).map((c) => el('option', { value: c.Company, text: c.Company }))]);
  const cmpSel = el('select', { 'aria-label': 'Periods' }, COMPARE.map(([k, l]) => el('option', { value: k, text: l })));
  coSel.value = M.companies.find((c) => c.Company.startsWith('Meridian'))?.Company ?? '';
  const bridgeHost = el('div');
  const scope = () => { if (coSel.value) return [coSel.value]; const f = ctx.selectedValues('g-analysis', 'Fund', 'Companies'); return M.companies.filter((c) => !f.length || f.includes(c.Fund)).map((c) => c.Company); };
  const render = () => {
    const [, label, cur, prev] = COMPARE.find((c) => c[0] === cmpSel.value);
    const names = scope();
    const b = ebitdaBridge(names, cur, prev);
    const steps = [{ label: `EBITDA ${label.split(' vs ')[1]}`, value: b.E0, kind: 'total' }, ...b.comps.map((c) => ({ ...c, kind: 'delta' })), { label: `EBITDA ${label.split(' vs ')[0]}`, value: b.E1, kind: 'total' }];
    bridgeHost.replaceChildren(
      el('div', { class: 'bridge-sum' }, [el('div', {}, [el('small', { text: 'EBITDA' }), el('b', { text: `${money(b.E0)} → ${money(b.E1)}` }), el('span', { class: tone(b.E1 - b.E0), text: `${smoney(b.E1 - b.E0)} (${spct(b.E1 / b.E0 - 1)})` })]), el('div', {}, [el('small', { text: 'Revenue' }), el('b', { text: `${money(b.R0)} → ${money(b.R1)}` }), el('span', { class: tone(b.R1 - b.R0), text: spct(b.R1 / b.R0 - 1) })]), el('div', {}, [el('small', { text: 'Margin' }), el('b', { text: `${pct(b.E0 / b.R0)} → ${pct(b.E1 / b.R1)}` }), el('span', { class: tone(b.E1 / b.R1 - b.E0 / b.R0), text: pts(b.E1 / b.R1 - b.E0 / b.R0) })]), el('div', {}, [el('small', { text: 'Reconciliation' }), el('b', { text: Math.abs(b.check) < 0.01 ? 'Components = Δ EBITDA ✓' : `gap ${money(b.check, 2)}` }), el('span', { class: 'muted', text: `${names.length === 1 ? names[0] : `${names.length} investments`}` })])]),
      waterfall(steps, { height: 300, onClick: (s) => { if (s.kind === 'delta') investigate(s, names, cur, prev, label); } }),
      el('p', { class: 'note', text: 'Assumptions: revenue volume and mix drop through at the prior-period gross margin; pricing drops through in full; gross-margin effect is the residual change in gross profit; operating costs are their own changes. Price / volume / mix effects come from the monitoring packs (vs the same quarter last year). Click any bar to investigate.' }),
    );
  };
  const investigate = async (step, names, cur, prev, label) => {
    // contributors across companies for this component
    const per = M.companies.filter((c) => names.includes(c.Company)).map((c) => ({ n: c.Company, v: ebitdaBridge([c.Company], cur, prev).comps.find((x) => x.key === step.key).value })).sort((a, b) => a.v - b.v);
    const hist = QUARTERS.slice(4).map((q) => { const i = QUARTERS.indexOf(q); return { q, v: ebitdaBridge(names, [q], [QUARTERS[i - 4]]).comps.find((x) => x.key === step.key).value }; });
    const one = names.length === 1 ? names[0] : null;
    const kpis = one ? await loadKpis(ctx.q, one).catch(() => []) : [];
    const k0 = kpis.at(-13), k1 = kpis.at(-1);
    const followUps = { volume: ['Which investments have declining free cash flow conversion despite revenue growth?', 'How does revenue growth compare with EBITDA growth by sector?'], price: ['Which companies are missing their quarterly budget?'], mix: ['Which investments have the largest negative variance against original underwriting?'], gm: ['Which portfolio companies have experienced EBITDA margin deterioration?'], personnel: ['Which portfolio companies have experienced EBITDA margin deterioration?', 'How has EBITDA margin moved quarter by quarter for each company?'], opex: ['Which portfolio companies require investment review?'], nonrec: ['How accurate have rolling forecasts been?'] }[step.key] ?? [];
    openDrawer({ title: `${step.label}: ${smoney(step.value)}`, kicker: `EBITDA bridge · ${label} · ${one ?? `${names.length} investments`}`, wide: true, body: [
      section('How it is calculated', el('p', { text: step.how })),
      names.length > 1 ? section('Contributing investments', sheet([{ key: 'n', label: 'Investment', fmt: (v) => el('button', { class: 'linkish', text: v, onclick: () => go('company', v) }) }, { key: 'v', label: 'Contribution', fmt: (v) => smoney(v), tone: (v) => tone(v) }], [...per.slice(0, 6), ...per.slice(-3).reverse()].filter((x, i, a) => a.findIndex((y) => y.n === x.n) === i))) : null,
      section('Historical comparison (each quarter vs same quarter last year)', el('div', {}, [spark(hist.map((h) => h.v), { w: 360, h: 60, color: '#14283A' }), sheet([{ key: 'q', label: 'Quarter' }, { key: 'v', label: step.label, fmt: (v) => smoney(v), tone: (v) => tone(v) }], hist)])),
      one && kpis.length ? section('Relevant operating KPIs (Sep 2026 vs Sep 2025)', sheet([{ key: 'k', label: 'KPI' }, { key: 'a', label: 'Sep 2025' }, { key: 'b', label: 'Sep 2026' }], [['Customers', 'Customers', (v) => Math.round(v).toLocaleString()], ['Net revenue retention', 'Net Revenue Retention', pct], ['Gross churn', 'Gross Churn', pct], ['Headcount', 'Headcount', (v) => Math.round(v).toLocaleString()], ['Pipeline', 'Sales Pipeline', (v) => money(v)], ['DSO (days)', 'Dso Days', (v) => Math.round(v)]].map(([k, f, fm]) => ({ k, a: fm(k0?.[f]), b: fm(k1?.[f]) })))) : null,
      one ? section('Associated investment risks', el('ul', {}, M.thesis.filter((t) => t.Company === one && t.Status !== 'On track').map((t) => el('li', { html: `<b>${esc(t.Component)}</b> — ${esc(t.Status)}: underwritten ${esc(t.Underwriting)}, now ${esc(t['Current Value'])}` })))) : null,
      section('Supporting source records', sheet([{ key: 'Company', label: 'Company' }, { key: 'Quarter', label: 'Quarter' }, ...step.fields.map((f) => ({ key: f, label: f, fmt: (v) => money(v) })), { key: 'Source System', label: 'Source', cls: '' }], M.fin.filter((r) => names.includes(r.Company) && cur.includes(r.Quarter)).slice(0, 12))),
      section('Suggested follow-up questions (governed)', el('div', { class: 'chips' }, followUps.map((qq) => el('button', { class: 'chip-btn', text: qq, onclick: () => go('nash', qq) })))),
      el('div', { class: 'row-end' }, [one ? btn('Model in Scenario Lab', () => go('scenario', one), { ic: 'science', kind: 'ghost' }) : null, btn('Create action from this investigation', async () => {
        if (!can('action.create')) return denied('action.create');
        const target = one ?? per[0]?.n;
        const t = await ask({ title: 'Create action', text: `${esc(step.label)} ${esc(smoney(step.value))} · ${esc(label)}`, label: 'Action', value: `Explain and address ${step.label.toLowerCase()} (${smoney(step.value)}) at ${target}`, confirmLabel: 'Create action' });
        if (!t) return;
        await saveRecord({ type: 'Action', prefix: 'ACT', company: target, fund: co(target).Fund, period: '2026-Q3', title: t, status: 'Open', owner: co(target)['Deal Lead'], due: '2026-11-30', payload: { source: 'EBITDA bridge', component: step.key, value: step.value, compare: label } }, { action: 'Created action from investigation', next: 'Open', reason: step.how });
      }, { ic: 'add_task' })]),
    ] });
  };
  coSel.addEventListener('change', render); cmpSel.addEventListener('change', render);
  window.addEventListener('nsos-ccy', render);
  window.addEventListener('nsos-fund', render);
  pane.append(
    el('div', { class: 'page-head' }, [el('div', {}, [el('h2', { text: 'Financial Analysis' }), el('p', { text: 'Growth, margin decomposition, cash conversion, leverage, coverage, liquidity, budget and forecast accuracy — all from governed measures. Start with the EBITDA bridge and click any driver to investigate.' })])]),
    el('figure', { class: 'card full' }, [el('figcaption', {}, [el('span', { text: 'EBITDA bridge' }), el('div', { class: 'row-end' }, [coSel, cmpSel])]), bridgeHost]),
    filters('analysis'),
    el('div', { class: 'grid' }, [card('f-growth', 'half'), card('f-margin', 'half'), card('f-lev', 'half'), card('f-conv', 'half'), card('f-budget', 'half'), card('f-trend', 'half'), card('f-liq', 'full'), card('f-fcst', 'full')]),
  );
  ctx.onShow('analysis', (arg) => { if (arg?.company) coSel.value = arg.company; render(); });
  render();
};
