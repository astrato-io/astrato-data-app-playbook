/**
 * Nash AI — governed investment intelligence. Questions are routed to stored Business Questions on the
 * semantic layer, executed through the Astrato engine, rendered as native objects, and explained with
 * deterministic calculations on the returned rows (no language-model arithmetic). Nash can prepare draft
 * scenarios and actions; anything material needs explicit human confirmation.
 */
import { el, esc, icon, money, smoney, pct, spct, pts, mult, N, me, can, denied, saveRecord, ask, toast, TODAY } from '../core.js';
import { M, co, ltm, finAt, QUARTERS, scenarioBase, planOf, planDrivers } from '../data.js';
import { ebitdaBridge } from './analysis.js';
import { projectScenario } from '../engine.js';
import { btn, section, sheet } from '../ui.js';

const DIM = { Company: ['Company', 'Companies'], Sector: ['Sector', 'Companies'], Region: ['Region', 'Companies'], Country: ['Country', 'Companies'], Fund: ['Fund', 'Companies'], 'Risk Class': ['Risk Class', 'Companies'], 'Investment Stage': ['Stage', 'Companies'], 'Entry Year': ['Entry Year', 'Companies'], Quarter: ['Quarter', 'Financials'], 'Valuation Quarter': ['Quarter', 'Valuations'], 'Valuation Status': ['Status', 'Valuations'], Initiative: ['Initiative', 'Initiatives'], 'Initiative Status': ['Status', 'Initiatives'], 'Thesis Component': ['Component', 'Investment Thesis'], 'Workflow Status': ['Status', 'Workflow Records'] };
const FMT = (m) => (/(Growth|Variance|vs |Accuracy|Change|Movement %|Realisation)/.test(m) && !/Gap|Movement$/.test(m) ? '+0.0%;-0.0%;0.0%' : /(Margin|Conversion|IRR|Retention|Churn)/.test(m) ? '0.0%' : /(Leverage|Coverage|Multiple|EV \/)/.test(m) ? '0.0"x"' : /MOIC|DPI/.test(m) ? '0.00"x"' : /(Records|Investments|Initiatives|Pending|On Track|Off Track|Submissions|Components)/.test(m) ? '#,##0' : /Score/.test(m) ? '0.00' : '$#,##0.0"m"');
const EXTRA_FILTERS = { overdue: [['Record Type', 'Workflow Records', ['Monitoring']], ['Period', 'Workflow Records', ['2026-Q3']], ['Status', 'Workflow Records', ['Draft', 'Submitted', 'Validation', 'Analyst Review', 'Investment Team Review']]], pendingval: [['Quarter', 'Valuations', ['2026-Q3']], ['Status', 'Valuations', ['Proposed', 'Under Review', 'Challenged']]], bridge: [['Quarter', 'Valuations', ['2026-Q3']]], review: [['Risk Class', 'Companies', ['High', 'Elevated']]] };

const tokens = (s) => String(s).toLowerCase().replace(/[^a-z0-9. ]+/g, ' ').split(/\s+/).filter((w) => w.length > 2 && !['the', 'and', 'which', 'what', 'have', 'has', 'are', 'for', 'with', 'this', 'that', 'does', 'how', 'our', 'most', 'largest', 'by'].includes(w));
const route = (text, questions) => {
  const t = new Set(tokens(text));
  let best = null;
  for (const qq of questions) {
    const words = new Set([...tokens(qq.name), ...tokens(qq.keywords)]);
    let score = 0; for (const w of t) if (words.has(w)) score += 1; else if ([...words].some((x) => x.startsWith(w.slice(0, 5)))) score += 0.5;
    score /= Math.max(3, t.size) ** 0.5;
    if (text.trim().toLowerCase() === qq.name.toLowerCase()) score += 10;
    if (!best || score > best.score) best = { q: qq, score };
  }
  return best;
};

export const mountNash = (ctx, pane) => {
  const { q, renderTile, dropTile, go, questions } = ctx;
  const thread = el('div', { class: 'nash-thread' });
  const input = el('textarea', { rows: 2, placeholder: 'Ask about the portfolio, a fund or a company… e.g. "Which companies are most sensitive to a 100-basis-point increase in financing costs?"' });
  const coSel = el('select', { 'aria-label': 'Company context' }, [el('option', { value: '', text: 'Portfolio context' }), ...[...M.companies].sort((a, b) => a.Company.localeCompare(b.Company)).map((c) => el('option', { value: c.Company, text: c.Company }))]);
  const tiles = [];
  const say = (who, body) => { const m = el('div', { class: `msg ${who}` }, [el('div', { class: 'who' }, who === 'user' ? [icon('person'), el('span', { text: me().name })] : [icon('auto_awesome'), el('span', { text: 'Nash' })]), el('div', { class: 'body' }, body)]); thread.append(m); m.scrollIntoView({ behavior: 'smooth', block: 'end' }); return m; };

  const companyIn = (text) => M.companies.find((c) => text.toLowerCase().includes(c.Company.toLowerCase()) || text.toLowerCase().includes(c.Company.split(' ')[0].toLowerCase() + ' ')) ?? (coSel.value ? co(coSel.value) : null);
  const fundScope = () => ctx.selectedValues('g-portfolio', 'Fund', 'Companies');

  const runBQ = async (bq, { company } = {}) => {
    const dims = bq.dimensions.map((d) => (d.view ? [d.field, d.view] : DIM[d.name])).filter(Boolean);
    const filters = [...(EXTRA_FILTERS[bq.id] ?? []), ...(company && dims.some(([f, v]) => f === 'Company') ? [['Company', 'Companies', [company]]] : []), ...(fundScope().length ? [['Fund', 'Companies', fundScope()]] : [])];
    const measures = bq.measures.map((m) => m.name);
    const rows = await q({ dims, measures, filters, limit: 500 });
    return { dims, measures, filters, rows };
  };
  const nativeAnswer = (bq, res) => {
    const slot = el('div', { class: 'viz nash-viz' });
    const sortKey = bq.orderBy?.[0];
    const mi = sortKey ? bq.measures.findIndex((m) => m.key === sortKey[0]) : -1;
    setTimeout(() => renderTile({ type: 'table', title: bq.name, dims: res.dims, measures: res.measures, filters: res.filters, formats: res.measures.map(FMT), sort: mi >= 0 ? { by: `m${mi}`, direction: sortKey[1] === 'asc' ? 'asc' : 'desc' } : undefined, limit: 200 }, slot).then((id) => id && tiles.push(id)), 30);
    return slot;
  };
  const narrate = (bq, res) => {
    const rows = res.rows, m0 = res.measures[0], dimName = res.dims[0]?.[0];
    if (!rows.length) return el('p', { text: 'The governed query returned no rows for this context.' });
    const fmt = (m, v) => { const f = FMT(m); return f.includes('%') ? (f.startsWith('+') ? spct(v) : pct(v)) : f.includes('"x"') ? `${N(v).toFixed(f.includes('0.00') ? 2 : 1)}x` : f.includes('$') ? money(v) : N(v).toLocaleString(); };
    if (!dimName) return el('ul', {}, res.measures.map((m) => el('li', { html: `<b>${esc(m)}</b>: ${esc(fmt(m, rows[0][m]))}` })));
    const dir = bq.orderBy?.[0]?.[1] === 'asc' ? 1 : -1;
    const key = bq.orderBy ? bq.measures.find((x) => x.key === bq.orderBy[0][0])?.name ?? m0 : m0;
    const sorted = [...rows].filter((r) => Number.isFinite(N(r[key]))).sort((a, b) => (dir === 1 ? N(a[key]) - N(b[key]) : N(b[key]) - N(a[key])));
    const top = sorted.slice(0, 3);
    const label = (r) => res.dims.map(([d]) => r[d]).filter((x) => x != null && x !== '').join(' · ');
    return el('div', {}, [el('p', { html: `<b>${esc(sorted.length)} rows.</b> Ranked by ${esc(key)}: ${top.map((r) => `<b>${esc(label(r))}</b> ${esc(fmt(key, r[key]))}`).join('; ')}.` }),
      res.measures.length > 1 ? el('p', { class: 'muted', html: top[0] ? `For ${esc(label(top[0]))}: ${res.measures.filter((m) => m !== key).map((m) => `${esc(m)} ${esc(fmt(m, top[0][m]))}`).join(' · ')}.` : '' }) : null]);
  };
  const related = (bq) => questions.filter((x) => x.cat === bq.cat && x.id !== bq.id).slice(0, 3);
  const definition = (bq, res) => el('details', { class: 'defn' }, [el('summary', { text: `Governed business question: “${bq.name}”` }), el('p', { html: `Category ${esc(bq.cat)} · dimensions ${res.dims.map(([f, v]) => `${esc(v)}.${esc(f)}`).join(', ') || '—'} · measures ${res.measures.map(esc).join(', ')} · filters ${res.filters.map(([f, v, vals]) => `${esc(v)}.${esc(f)} ∈ {${vals.map(esc).join(', ')}}`).join('; ') || 'none'}. Executed on the published semantic layer through the Astrato engine; measures use the layer's aggregation rules (ratios recomputed from summed components).` })]);

  // ---------------------------------------------------------------- special analyses (deterministic, on governed rows)
  const consecutiveMargin = async (bq) => {
    const res = await runBQ(bq);
    const by = new Map();
    for (const r of res.rows) { const a = by.get(r.Company) ?? []; a.push(r); by.set(r.Company, a); }
    const out = [...by].map(([c, rs]) => { rs.sort((a, b) => String(a.Quarter).localeCompare(String(b.Quarter))); let run = 0; for (let i = rs.length - 1; i > 0; i--) { if (N(rs[i]['EBITDA Margin']) < N(rs[i - 1]['EBITDA Margin'])) run++; else break; } return { c, run, from: N(rs[rs.length - 1 - run]?.['EBITDA Margin']), to: N(rs.at(-1)['EBITDA Margin']) }; }).filter((x) => x.run >= 3).sort((a, b) => b.run - a.run || (a.to - a.from) - (b.to - b.from));
    return [el('p', { html: `<b>${out.length} companies</b> have reported lower EBITDA margin in each of at least the last three quarters (Q3 2026 back): ${out.map((x) => `<b>${esc(x.c)}</b> ${x.run} quarters, ${pct(x.from)} → ${pct(x.to)} (${pts(x.to - x.from)})`).join('; ')}.` }), sheet([{ key: 'c', label: 'Company', fmt: (v) => el('button', { class: 'linkish', text: v, onclick: () => go('company', v) }) }, { key: 'run', label: 'Consecutive declines' }, { key: 'from', label: 'Margin before', fmt: pct }, { key: 'to', label: 'Q3 2026 margin', fmt: pct }, { key: 'd', label: 'Change', value: (r) => r.to - r.from, fmt: pts }], out), definition(bq, res), el('p', { class: 'muted', text: 'Consecutive declines counted on the governed quarterly EBITDA Margin measure (Σ EBITDA ÷ Σ revenue per company and quarter).' })];
  };
  const exitShock = async (bq, text) => {
    const x = Number((/(\d+(\.\d+)?)\s*x/i.exec(text) ?? [])[1] ?? 1);
    const res = await runBQ(bq);
    const tot = res.rows.reduce((s, r) => s + N(r['Fair Value']), 0), imp = res.rows.reduce((s, r) => s + N(r['Fair Value Impact of -1.0x']), 0) * x;
    return [el('p', { html: `A <b>${x.toFixed(1)}x contraction</b> in valuation multiples would reduce approved portfolio fair value by <b>${money(-imp)}</b> (${spct(imp / tot)}), from ${money(tot)} to ${money(tot + imp)}. By fund: ${res.rows.map((r) => `${esc(r.Fund)} ${smoney(N(r['Fair Value Impact of -1.0x']) * x)}`).join(' · ')}.` }), nativeAnswer(bq, res), definition(bq, res), el('p', { class: 'muted', text: 'Impact per turn = LTM EBITDA × economic ownership for EV/EBITDA marks (EV/Revenue marks excluded), scaled by the contraction. Exit proceeds move by the same multiple effect at the exit-year EBITDA; model a company in Scenario Lab for the full path.' })];
  };
  const overdue = async (bq) => {
    const res = await runBQ(bq);
    const day = (v) => { const s = String(v ?? ''); return /^\d+$/.test(s) ? new Date(Number(s) < 1e11 ? Number(s) * 1000 : Number(s)).toISOString().slice(0, 10) : s.slice(0, 10); };
    const rows = res.rows.map((r) => ({ ...r, due: day(r['Due Date']) })).filter((r) => r.due && r.due < TODAY).sort((a, b) => a.due.localeCompare(b.due));
    const names = [...new Set(rows.map((r) => r.Company))];
    const slot = el('div', { class: 'viz nash-viz' });
    if (names.length) setTimeout(() => renderTile({ type: 'table', title: bq.name, dims: res.dims, measures: res.measures, filters: [...res.filters, ['Company', 'Companies', names]], formats: ['#,##0'], limit: 200 }, slot), 30);
    return [el('p', { html: `<b>${rows.length} Q3 2026 monitoring packs are overdue</b> (deadline before ${TODAY}, not yet approved): ${rows.map((r) => `<b>${esc(r.Company)}</b> — ${esc(r.Status)}, due ${r.due}, owner ${esc(r.Owner)}`).join('; ')}.` }), names.length ? slot : null, definition(bq, res), el('p', { class: 'muted', text: `Overdue is evaluated against today's date (${TODAY}) on the governed Due Date of each open pack; ${res.rows.length} Q3 packs are open in total.` }), el('div', { class: 'row-end' }, [btn('Open monitoring queue', () => go('monitoring'), { kind: 'ghost sm', ic: 'fact_check' })])];
  };
  const whyCompany = async (c) => {
    const n = c.Company;
    const b = ebitdaBridge([n], ['2025-Q4', '2026-Q1', '2026-Q2', '2026-Q3'], ['2024-Q4', '2025-Q1', '2025-Q2', '2025-Q3']);
    const comps = [...b.comps].sort((a, z) => a.value - z.value);
    const rg = ltm(n, 'Revenue') / ltm(n, 'Revenue', '2025-Q3') - 1, uw = ltm(n, 'Ebitda') / ltm(n, 'Uw Ebitda') - 1;
    const lev = finAt(n, '2026-Q3')['Net Debt'] / ltm(n, 'Ebitda'), levPy = finAt(n, '2025-Q3')['Net Debt'] / ltm(n, 'Ebitda', '2025-Q3');
    const conv = ltm(n, 'Free Cash Flow') / ltm(n, 'Ebitda'), convPy = ltm(n, 'Free Cash Flow', '2025-Q3') / ltm(n, 'Ebitda', '2025-Q3');
    const base = scenarioBase(n), dn = projectScenario(base, planDrivers(planOf(n, 'Downside Case'))), bs = projectScenario(base, planDrivers(planOf(n, 'Approved Forecast')));
    return [
      el('p', { html: `<b>${esc(n)}</b> LTM EBITDA is <b>${money(b.E1)}</b> versus ${money(b.E0)} a year ago (${smoney(b.E1 - b.E0)}) and <b>${spct(uw)}</b> against the original investment case. Revenue grew ${spct(rg)} against a ${pct(c['Uw Revenue Cagr'], 0)} underwriting assumption; margin moved ${pts(b.E1 / b.R1 - b.E0 / b.R0)} to ${pct(b.E1 / b.R1)}.` }),
      el('p', { html: `<b>Principal drivers</b> (EBITDA bridge, LTM vs prior LTM): ${comps.slice(0, 3).map((x) => `${esc(x.label)} ${smoney(x.value)}`).join(', ')}; offset by ${comps.filter((x) => x.value > 0).slice(-2).map((x) => `${esc(x.label)} ${smoney(x.value)}`).join(' and ') || '—'}.` }),
      el('p', { html: `<b>Balance sheet</b>: net leverage ${mult(lev)} (${lev - levPy >= 0 ? '+' : '−'}${Math.abs(lev - levPy).toFixed(1)}x vs ${mult(levPy)} a year ago), FCF conversion ${pct(conv, 0)} (${pct(convPy, 0)} a year ago). <b>Valuation sensitivity</b>: the deal team's downside case values Northstar's stake at ${money(dn.today.fairValue)}, <b>${smoney(dn.today.fairValue - bs.today.fairValue)}</b> versus the base case.` }),
      sheet([{ key: 'label', label: 'Bridge component' }, { key: 'value', label: 'Δ EBITDA', fmt: (v) => smoney(v) }, { key: 'how', label: 'Calculation', cls: 'wrap' }], b.comps),
      el('p', { class: 'muted', text: 'Every figure above is computed from governed Financials rows (Revenue, EBITDA, Net Debt, Free Cash Flow, Price/Volume/Mix effects) and the Plans view; the bridge reconciles exactly to the change in EBITDA.' }),
      el('div', { class: 'row-end' }, [btn('Open Scenario Lab with the downside', () => go('scenario', { company: n, drivers: planDrivers(planOf(n, 'Downside Case')) }), { kind: 'ghost sm', ic: 'science' }), btn('Draft value-creation programme', () => { go('value'); ctx.proposeProgramme?.(n); }, { kind: 'sm', ic: 'auto_fix_high' })]),
    ];
  };

  const ask2 = async (text) => {
    if (!text.trim()) return;
    say('user', el('p', { text }));
    const wait = say('nash', el('p', { class: 'muted', text: 'Identifying the governed business question…' }));
    try {
      const c = companyIn(text);
      let body;
      if (c && /(why|underperform|explain|driver|what happened|deteriorat)/i.test(text) && !/which|portfolio/i.test(text)) body = await whyCompany(c);
      else if (/rate|basis.?point|financing cost/i.test(text) && c && /draft|prepare|scenario/i.test(text)) {
        const bump = Number((/(\d+)\s*(bp|basis)/i.exec(text) ?? [])[1] ?? 100) / 100;
        const d = { ...planDrivers(planOf(c.Company, 'Approved Forecast')) }; d.rate += bump;
        const r0 = projectScenario(scenarioBase(c.Company), planDrivers(planOf(c.Company, 'Approved Forecast'))), r1 = projectScenario(scenarioBase(c.Company), d);
        body = [el('p', { html: `Draft scenario prepared for <b>${esc(c.Company)}</b>: all-in rate +${bump.toFixed(2)} pts → FY+1 interest cover ${mult(r0.years[0].coverage)} → <b>${mult(r1.years[0].coverage)}</b>, FCF ${money(r0.years[0].fcf)} → ${money(r1.years[0].fcf)}, IRR ${pct(r0.irr)} → ${pct(r1.irr)}.` }), btn('Review draft in Scenario Lab (not saved)', () => go('scenario', { company: c.Company, drivers: d }), { ic: 'science' })];
      } else {
        const best = route(text, questions);
        if (!best || best.score < 0.5) { body = [el('p', { text: 'I could not match that to a governed business question. Try one of these:' }), el('div', { class: 'chips' }, questions.slice(0, 8).map((x) => el('button', { class: 'chip-btn', text: x.name, onclick: () => ask2(x.name) })))]; }
        else {
          const bq = best.q;
          if (bq.id === 'marginq' || (bq.id === 'margin' && /consecutive|three|3/i.test(text))) body = await consecutiveMargin(questions.find((x) => x.id === 'marginq'));
          else if (bq.id === 'exitmult') body = await exitShock(bq, text);
          else if (bq.id === 'overdue') body = await overdue(bq);
          else {
            const res = await runBQ(bq, { company: c?.Company });
            body = [el('p', { class: 'muted', html: `Routed to <b>${esc(bq.name)}</b>${c ? ` · context ${esc(c.Company)}` : ''}${fundScope().length ? ` · ${esc(fundScope().join(', '))}` : ''}` }), narrate(bq, res), nativeAnswer(bq, res), definition(bq, res)];
          }
          body.push(el('div', { class: 'chips' }, [el('small', { text: 'Related investigations:' }), ...related(bq).map((x) => el('button', { class: 'chip-btn', text: x.name, onclick: () => ask2(x.name) }))]));
        }
      }
      body.push(el('div', { class: 'row-end' }, [btn('Create action from this answer', async () => {
        if (!can('action.create')) return denied('action.create');
        const target = c?.Company ?? M.companies[0].Company;
        const t = await ask({ title: 'Nash drafted an action — confirm before it is created', text: `Question: ${esc(text)}`, label: 'Action', value: `Follow up: ${text}`.slice(0, 180), confirmLabel: 'Create action' });
        if (!t) return;
        await saveRecord({ type: 'Action', prefix: 'ACT', company: target, fund: co(target).Fund, period: '2026-Q3', title: t, status: 'Open', owner: co(target)['Deal Lead'], due: '2026-11-30', payload: { source: 'Nash', question: text } }, { action: 'Action created from Nash (human-confirmed)', next: 'Open', reason: text });
      }, { kind: 'ghost sm', ic: 'add_task' })]));
      wait.querySelector('.body').replaceChildren(...body.filter(Boolean));
    } catch (e) { console.error(e); wait.querySelector('.body').replaceChildren(el('p', { class: 'neg', text: `The governed query failed: ${e?.message ?? e}` })); }
  };
  const send = () => { const t = input.value; input.value = ''; ask2(t); };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } });
  const EXAMPLES = ['Which portfolio companies have experienced EBITDA margin deterioration for three consecutive quarters?', 'Which investments have the largest negative variance against original underwriting?', 'What are the principal drivers of valuation movement this quarter?', 'Which investments have declining free cash flow conversion despite revenue growth?', 'Which companies are most sensitive to a 100-basis-point increase in financing costs?', 'Which value-creation initiatives have generated the largest realised EBITDA improvement?', 'Which investments have the highest leverage relative to internally defined risk thresholds?', 'Which companies have overdue monitoring submissions?', 'Which valuation approvals are outstanding?', 'What would happen to portfolio fair value if exit multiples contracted by 1.0x?', 'Why is Meridian Cloud Systems underperforming its investment case?'];
  pane.append(
    el('div', { class: 'page-head' }, [el('div', {}, [el('h2', { text: 'Nash AI' }), el('p', { text: `Governed investment intelligence: Nash routes each question to one of ${questions.length} verified Business Questions on the semantic layer, executes it through the Astrato engine and explains the answer with deterministic calculations. It prepares drafts; you confirm material changes.` })]), el('div', { class: 'row-end' }, [el('label', { class: 'inline' }, [el('span', { text: 'Context' }), coSel])])]),
    el('div', { class: 'nash' }, [el('div', { class: 'nash-main' }, [thread, el('div', { class: 'nash-input' }, [input, btn('Ask', send, { ic: 'send' })])]), el('aside', { class: 'nash-side' }, [el('h4', { text: 'Try asking' }), ...EXAMPLES.map((x) => el('button', { class: 'chip-btn block', text: x, onclick: () => ask2(x) })), el('h4', { text: 'Governed business questions' }), ...[...new Set(questions.map((x) => x.cat))].map((cat) => el('details', {}, [el('summary', { text: cat }), ...questions.filter((x) => x.cat === cat).map((x) => el('button', { class: 'linkish block', text: x.name, onclick: () => ask2(x.name) }))]))])]),
  );
  say('nash', el('p', { html: `Good ${new Date().getHours() < 12 ? 'morning' : 'afternoon'}, ${esc(me().name.split(' ')[0])}. I answer from Northstar's governed semantic layer (Q3 2026 monitoring, approved valuations, plans and workflows). Pick a question on the right or ask your own.` }));
  ctx.onShow('nash', (arg) => { if (typeof arg === 'string') ask2(arg); });
};
