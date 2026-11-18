/** Portfolio — investment command centre: flags, returns, KPI cards, the investment register, concentration and attribution. */
import { el, esc, icon, money, smoney, pct, spct, pts, mult, smult, tone, N, me, can, denied, saveRecord, records, record, onStore, openDrawer, toast, ask, store } from '../core.js';
import { M, co, finAt, ltm, currentVal, returnsOf, valAt, LATEST } from '../data.js';
import { xirr } from '../engine.js';
import { sheet, spark, btn, section } from '../ui.js';

const reasonsFor = (name) => {
  const c = co(name), f = finAt(name, LATEST);
  const rg = ltm(name, 'Revenue') / ltm(name, 'Revenue', '2025-Q3') - 1;
  const m = ltm(name, 'Ebitda') / ltm(name, 'Revenue'), mp = ltm(name, 'Ebitda', '2025-Q3') / ltm(name, 'Revenue', '2025-Q3');
  const lev = f['Net Debt'] / ltm(name, 'Ebitda'), levPy = finAt(name, '2025-Q3')['Net Debt'] / ltm(name, 'Ebitda', '2025-Q3');
  const uw = ltm(name, 'Ebitda') / ltm(name, 'Uw Ebitda') - 1;
  const conv = ltm(name, 'Free Cash Flow') / ltm(name, 'Ebitda'), convPy = ltm(name, 'Free Cash Flow', '2025-Q3') / ltm(name, 'Ebitda', '2025-Q3');
  const out = [];
  if (rg < c['Uw Revenue Cagr'] - 0.03) out.push(`Revenue growth ${spct(rg)} vs ${pct(c['Uw Revenue Cagr'], 0)} underwritten`);
  if (m - mp < -0.015) out.push(`EBITDA margin ${pct(m)} (${pts(m - mp)} YoY)`);
  if (lev - levPy > 0.2 || lev > 5.5) out.push(`Net leverage ${mult(lev)} (${smult(lev - levPy)} YoY)`);
  if (conv - convPy < -0.1) out.push(`FCF conversion ${pct(conv, 0)} (${pts(conv - convPy, 0)})`);
  if (uw < -0.1) out.push(`LTM EBITDA ${spct(uw)} vs investment case`);
  const cov = ltm(name, 'Ebitda') / ltm(name, 'Interest Expense');
  if (cov < 2) out.push(`Interest cover ${mult(cov)}`);
  return { out, score: out.length + (c['Requires Review'] === 'Review required' ? 2 : 0) + Math.max(0, -uw) * 5, uw };
};

export const mountPortfolio = (ctx, pane) => {
  const { card, kpi, filters, select, selectedValues, go } = ctx;
  const fundFilter = () => ctx.selectedValues('g-portfolio', 'Fund', 'Companies');
  const inScope = (c) => { const f = fundFilter(); return !f.length || f.includes(c.Fund); };

  // ---- head
  const viewsSel = el('select', { 'aria-label': 'Saved views' });
  const renderViews = () => viewsSel.replaceChildren(el('option', { value: '', text: 'Saved views…' }), ...records('Saved View').map((v) => el('option', { value: v.id, text: `${v.title} · ${v.createdBy}` })));
  onStore(renderViews); renderViews();
  viewsSel.addEventListener('change', () => { const v = record(viewsSel.value); if (!v) return; applyView(v); viewsSel.value = ''; });
  const applyView = (v) => {
    window.__sel.clearAllSelections('g-portfolio');
    for (const s of v.payload.selections ?? []) window.__sel.selectValues('g-portfolio', { field: { fieldKey: s.fieldKey }, kind: 'VALUE', operator: 'inList', values: s.values }, { state: 'applied' });
    toast(`Applied saved view <b>${esc(v.title)}</b>`, 'bookmark');
  };
  const saveView = async () => {
    if (!can('view.save')) return denied('view.save');
    const name = await ask({ title: 'Save this investigation as a named view', text: 'Saves the selections currently applied on the Portfolio page (fund, sector, risk class, companies…). Saved views are shared with the investment team.', label: 'View name', confirmLabel: 'Save view' });
    if (!name) return;
    const applied = (window.__sel.getSelection('g-portfolio')?.applied ?? []).filter((x) => x.values?.length).map((x) => ({ fieldKey: x.field.fieldKey, values: x.values }));
    await saveRecord({ type: 'Saved View', prefix: 'VIEW', title: name, status: 'Saved', owner: me().name, period: '2026-Q3', payload: { selections: applied } }, { action: 'Saved analytical view', next: `${applied.length} selections`, reason: name });
  };
  const selActions = el('div', { class: 'selactions', hidden: true });
  pane.append(el('div', { class: 'page-head' }, [
    el('div', {}, [el('h2', { text: 'Portfolio' }), el('p', { text: 'Every investment on approved valuations and the latest monitoring pack (Q3 2026). Click a row or bar to select companies; open a workspace or compare. Fund, sector, geography and risk filters apply across the page.' })]),
    el('div', { class: 'row-end' }, [viewsSel, btn('Save view', saveView, { ic: 'bookmark_add', kind: 'ghost' })]),
  ]));

  // ---- Detect: investments flagged for review (computed from governed financials)
  const flags = el('div', { class: 'flags' });
  const renderFlags = () => {
    const list = M.companies.filter(inScope).map((c) => ({ c, ...reasonsFor(c.Company) })).filter((x) => x.out.length >= 2 || x.c['Requires Review'] === 'Review required').sort((a, b) => b.score - a.score).slice(0, 5);
    flags.replaceChildren(el('header', {}, [icon('flag'), el('b', { text: 'Requires investment review' }), el('small', { text: 'Rules: growth vs underwriting, margin trend, leverage, cash conversion, interest cover — computed from the Q3 2026 monitoring data' })]),
      el('div', { class: 'flag-row' }, list.map(({ c, out }) => el('button', { class: `flag ${c['Risk Class'] === 'High' ? 'hi' : ''}`, onclick: () => go('company', c.Company) }, [
        el('div', { class: 'flag-top' }, [el('b', { text: c.Company }), el('span', { class: `pill p-${c['Risk Class'].toLowerCase()}`, text: c['Risk Class'] })]),
        el('small', { text: `${c.Fund} · ${c.Subsector} · FV ${money(currentVal(c.Company)?.['Fair Value'] ?? 0, 0)}` }),
        el('ul', {}, out.slice(0, 4).map((t) => el('li', { text: t }))),
        el('span', { class: 'go', html: 'Open workspace →' }),
      ]))));
  };

  // ---- returns strip (dated cash flows; pooled gross IRR via XIRR)
  const strip = el('div', { class: 'strip' });
  const renderStrip = () => {
    const cos = M.companies.filter(inScope).map((c) => c.Company);
    const all = cos.map((n) => returnsOf(n));
    const inv = all.reduce((s, r) => s + r.invested, 0), real = all.reduce((s, r) => s + r.realised, 0), fv = all.reduce((s, r) => s + r.fv, 0);
    const flows = all.flatMap((r) => r.flows).sort((a, b) => a.date.localeCompare(b.date));
    const irr = xirr([...flows, { date: '2026-09-30', amount: fv }]);
    const commit = M.funds.filter((f) => !fundFilter().length || fundFilter().includes(f.Fund)).reduce((s, f) => s + f.Commitment, 0);
    const items = [['Commitments', money(commit, 0)], ['Invested capital', money(inv, 0)], ['Realised proceeds', money(real, 0)], ['Approved fair value', money(fv, 0)], ['Total value', money(real + fv, 0)], ['Gross MOIC', `${((real + fv) / inv).toFixed(2)}x`], ['Gross DPI', `${(real / inv).toFixed(2)}x`], ['Gross IRR (pooled)', pct(irr)], ['Investments', String(cos.length)]];
    strip.replaceChildren(...items.map(([k, v]) => el('div', {}, [el('small', { text: k }), el('b', { text: v })])), el('p', { class: 'strip-note', text: 'Returns from dated investment cash flows and the latest approved valuation of each investment; IRR is XIRR on pooled flows with fair value as terminal value at 30 Sep 2026.' }));
  };
  window.addEventListener('nsos-fund', () => { renderStrip(); renderFlags(); });
  window.addEventListener('nsos-ccy', () => { renderStrip(); renderFlags(); });
  window.addEventListener('nsos-model', () => { renderStrip(); renderFlags(); });

  // ---- outstanding tasks per company
  const tasks = el('div', { class: 'tasklist' });
  const renderTasks = () => {
    const rows = M.companies.filter(inScope).map((c) => {
      const mon = records('Monitoring', (r) => r.company === c.Company && r.period === '2026-Q3')[0];
      const val = valAt(c.Company, '2026-Q3');
      const acts = records('Action', (r) => r.company === c.Company && ['Open', 'In Progress'].includes(r.status)).length;
      return { name: c.Company, mon: mon?.status ?? '–', due: mon?.due, val: val?.Status ?? '–', acts, open: (mon && !['Approved', 'Locked'].includes(mon.status) ? 1 : 0) + (val && val.Status !== 'Approved' ? 1 : 0) + acts };
    }).filter((r) => r.open).sort((a, b) => b.open - a.open);
    tasks.replaceChildren(sheet([
      { key: 'name', label: 'Company', fmt: (v) => el('button', { class: 'linkish', text: v, onclick: () => go('company', v) }) },
      { key: 'mon', label: 'Q3 monitoring', cls: '', fmt: (v, r) => el('span', {}, [el('span', { class: `pill p-${String(v).toLowerCase().replace(/[^a-z]+/g, '-')}`, text: v }), r.due && r.due < '2026-11-09' && !['Approved', 'Locked'].includes(v) ? el('span', { class: 'pill p-overdue', text: 'Overdue' }) : null]) },
      { key: 'val', label: 'Q3 valuation', cls: '', fmt: (v) => el('span', { class: `pill p-${String(v).toLowerCase().replace(/[^a-z]+/g, '-')}`, text: v }) },
      { key: 'acts', label: 'Open actions' },
    ], rows, { onRow: (r) => go('company', r.name) }));
  };
  onStore(renderTasks);
  window.addEventListener('nsos-fund', renderTasks);
  window.addEventListener('nsos-model', renderTasks);

  // ---- selection actions: open workspace / compare
  const renderSel = () => {
    const sel = selectedValues('g-portfolio', 'Company', 'Companies');
    selActions.hidden = !sel.length;
    selActions.replaceChildren(el('span', { html: `<b>${sel.length}</b> ${sel.length === 1 ? 'company' : 'companies'} selected` }),
      sel.length === 1 ? btn(`Open ${sel[0]} workspace`, () => go('company', sel[0]), { ic: 'open_in_new' }) : null,
      sel.length >= 2 ? btn(`Compare ${sel.length} investments`, () => compare(sel), { ic: 'compare_arrows' }) : null,
      btn('Clear', () => select('g-portfolio', 'Company', 'Companies', []), { kind: 'ghost' }));
  };
  window.__sel.onActiveSelectionChange('g-portfolio').subscribe(renderSel);
  const compare = (names) => {
    const rows = names.map((n) => { const r = returnsOf(n); const f = finAt(n, LATEST); const c = co(n); return { n, fund: c.Fund, rev: ltm(n, 'Revenue'), rg: ltm(n, 'Revenue') / ltm(n, 'Revenue', '2025-Q3') - 1, e: ltm(n, 'Ebitda'), m: ltm(n, 'Ebitda') / ltm(n, 'Revenue'), mc: ltm(n, 'Ebitda') / ltm(n, 'Revenue') - ltm(n, 'Ebitda', '2025-Q3') / ltm(n, 'Revenue', '2025-Q3'), lev: f['Net Debt'] / ltm(n, 'Ebitda'), cov: ltm(n, 'Ebitda') / ltm(n, 'Interest Expense'), conv: ltm(n, 'Free Cash Flow') / ltm(n, 'Ebitda'), uw: ltm(n, 'Ebitda') / ltm(n, 'Uw Ebitda') - 1, inv: r.invested, fv: r.fv, moic: r.moic, irr: currentVal(n)?.['Gross Irr'], mult: currentVal(n)?.Multiple, trend: M.fin.filter((x) => x.Company === n).map((x) => x.Ebitda) }; });
    openDrawer({ title: `Portfolio comparison · ${names.length} investments`, kicker: 'Governed LTM to Q3 2026 · approved valuations', wide: true, body: [
      sheet([{ key: 'n', label: 'Investment', fmt: (v) => el('button', { class: 'linkish', text: v, onclick: () => go('company', v) }) }, { key: 'fund', label: 'Fund', cls: '' }, { key: 'rev', label: 'Revenue LTM', fmt: (v) => money(v) }, { key: 'rg', label: 'Growth', fmt: spct, tone: (v) => (v < 0.05 ? 'neg' : '') }, { key: 'e', label: 'EBITDA LTM', fmt: (v) => money(v) }, { key: 'm', label: 'Margin', fmt: pct }, { key: 'mc', label: 'Δ margin', fmt: pts, tone: (v) => tone(v) }, { key: 'conv', label: 'FCF conv.', fmt: (v) => pct(v, 0) }, { key: 'lev', label: 'Net lev.', fmt: mult, tone: (v) => (v > 5.5 ? 'neg' : '') }, { key: 'cov', label: 'Cover', fmt: mult, tone: (v) => (v < 2 ? 'neg' : '') }, { key: 'uw', label: 'vs UW', fmt: spct, tone: (v) => tone(v) }, { key: 'mult', label: 'Multiple', fmt: mult }, { key: 'fv', label: 'Fair value', fmt: (v) => money(v) }, { key: 'moic', label: 'MOIC', fmt: (v) => `${v.toFixed(2)}x` }, { key: 'irr', label: 'IRR', fmt: pct }, { key: 'trend', label: 'EBITDA 12Q', fmt: (v) => spark(v) }], rows),
      el('p', { class: 'note', text: 'Ratios are recomputed per investment from summed LTM components; MOIC uses realised proceeds plus approved fair value over invested capital.' }),
    ] });
  };

  pane.append(flags, strip, filters('portfolio'), el('div', { class: 'kpis' }, ['k-fv', 'k-rev', 'k-ebitda', 'k-margin', 'k-lev', 'k-conv'].map(kpi)), selActions,
    el('div', { class: 'grid' }, [
      card('p-table', 'full'),
      card('p-contrib', 'half'), card('p-uw', 'half'),
      card('p-fund', 'third'), card('p-sector', 'third'), card('p-geo', 'third'),
      card('p-risk', 'half'), el('figure', { class: 'card half' }, [el('figcaption', { text: 'Outstanding monitoring, valuation and action tasks' }), tasks]),
    ]));
  ctx.onShow('portfolio', (arg) => { if (arg?.view) applyView(record(arg.view)); renderFlags(); renderStrip(); renderTasks(); });
  renderFlags(); renderStrip(); renderTasks();
};
