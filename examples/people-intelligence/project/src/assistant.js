/**
 * Ask People Intelligence — the persistent assistant.
 *
 * It answers only from stored business questions in the governed semantic layer: a question is matched
 * to the closest stored question (with countries, business units, seniority and skills it mentions
 * applied as filters), the question is run through the engine, and the answer is composed from the rows
 * that came back — narrative, a native chart, contributing factors, source and metric context,
 * follow-ups and next actions. If nothing matches well enough it says so and offers the closest questions.
 */
import { QUESTIONS } from './questions.js';
import { DIM_FIELD } from './model.js';
import { FORMAT, VIEWS_OF, DESC } from './formats.js';
import { briefingFacts, popLabel } from './home.js';

const N = (v) => Number(v ?? 0);
const STOP = new Set('a an the of in on for to is are was were be by and or with what which who how why where when do does did we our us my me i it its this that these those there their have has show tell give about across over last can could should would will vs versus between from at as most more than per each'.split(' '));
const SYN = { turnover: 'attrition', leaving: 'attrition', leave: 'attrition', resignations: 'attrition', quit: 'attrition', churn: 'attrition', staff: 'headcount', employees: 'headcount', people: 'headcount', fte: 'headcount', spend: 'cost', costs: 'cost', budget: 'budget', salaries: 'cost', pay: 'pay', compensation: 'pay', engineers: 'technology', tech: 'technology', it: 'technology', shortages: 'shortage', gaps: 'gap', skills: 'skill', reskilling: 'reskill', upskill: 'reskill', hiring: 'hiring', hires: 'hiring', recruit: 'hiring', recruitment: 'hiring', engagement: 'engaged', enps: 'engaged', mood: 'engaged', vacancies: 'roles', positions: 'roles', openings: 'roles', quarters: 'quarter', trend: 'trend', trending: 'trend', trended: 'trend' };
const tok = (s) => String(s).toLowerCase().replace(/[^a-z0-9%&]+/g, ' ').split(' ').filter((w) => w && !STOP.has(w)).map((w) => SYN[w] ?? w.replace(/s$/, ''));

const COUNTRIES = { 'united kingdom': 'United Kingdom', uk: 'United Kingdom', britain: 'United Kingdom', england: 'United Kingdom', germany: 'Germany', german: 'Germany', italy: 'Italy', spain: 'Spain', malta: 'Malta', cyprus: 'Cyprus', croatia: 'Croatia', netherlands: 'Netherlands', dutch: 'Netherlands', ireland: 'Ireland', 'poland': 'Poland', hungary: 'Hungary', 'united arab emirates': 'United Arab Emirates', uae: 'United Arab Emirates', emirates: 'United Arab Emirates', morocco: 'Morocco', 'kenya': 'Kenya', india: 'India' };
const BUS = { technology: 'Technology', tech: 'Technology', engineering: 'Technology', networks: 'Networks', network: 'Networks', 'enterprise business': 'Enterprise Business', consumer: 'Consumer', 'customer operations': 'Customer Operations', 'contact centre': 'Customer Operations', 'customer ops': 'Customer Operations', retail: 'Retail & Stores', stores: 'Retail & Stores', 'shared services': 'Shared Services (GBS)', gbs: 'Shared Services (GBS)', 'group functions': 'Group Functions' };
const SKILLS = { 'ai': 'AI & Machine Learning', 'machine learning': 'AI & Machine Learning', cloud: 'Cloud Engineering', cyber: 'Cybersecurity', security: 'Cybersecurity', 'data engineering': 'Data Engineering', 'network automation': 'Network Automation', 'product management': 'Digital Product Management' };
const find = (text, dict) => { const t = ` ${text.toLowerCase().replace(/[^a-z& ]+/g, ' ')} `; return [...new Set(Object.entries(dict).filter(([k]) => t.includes(` ${k} `)).map(([, v]) => v))]; };

const SOURCE = { Workforce: 'SAP SuccessFactors Employee Central (+ regional and local HRIS)', Costs: 'SAP S/4HANA cost centres', Engagement: 'Qualtrics EmployeeXM pulse', Exits: 'SuccessFactors terminations + Qualtrics exit survey', Requisitions: 'SuccessFactors Recruiting', 'Skill Inventory': 'SuccessFactors Talent Intelligence Hub', 'Reskilling Pool': 'SuccessFactors Opportunity Marketplace', Initiatives: 'People Actions register', Skills: 'Skills taxonomy', 'Business Units': 'Organisation model', Countries: 'Organisation model', Diversity: 'SuccessFactors EC personal information (aggregated, n ≥ 10)', Succession: 'SuccessFactors Succession & Development', 'Pipeline Runs': 'cloud data lake orchestration log', 'Data Issues': 'Data issue register' };
/** Data-operations views are not persona-scoped (they describe feeds, not people). */
const UNSCOPED = /Pipeline Runs|Data Issues/;
const PAGE_OF = { 'Executive briefing': 'home', Workforce: 'wx', Movement: 'wx', 'Time intelligence': 'wx', Retention: 'tr', Engagement: 'tr', 'Workforce cost': 'wx', Skills: 'sk', 'Mobility & recruiting': 'sk', 'People actions': 'act', 'Cross-source': 'tr', 'Diversity & inclusion': 'dei', Succession: 'suc', 'Data operations': 'ops', 'Workforce planning': 'sim' };
const GROUP_OF = { home: 'g-home', wx: 'g-wx', tr: 'g-tr', sk: 'g-sk', act: 'g-act', dei: 'g-dei', suc: 'g-suc', ops: 'g-ops' };
const CHART = { bar: 'bar', line: 'line', combo: 'combo', stacked_bar: 'bar', pie: 'pie', heatmap: 'heatMap', scatter: 'scatter', table: 'table', kpi: 'table' };

export const matchQuestion = (text) => {
  const t = tok(text);
  const set = new Set(t);
  const lower = text.toLowerCase().trim().replace(/[?.!]+$/, '');
  const scored = QUESTIONS.map((q) => {
    if (q.name.toLowerCase().replace(/[?.!]+$/, '') === lower) return { q, s: 100 };
    const nt = tok(q.name), kt = tok(q.kw ?? ''), dt = tok(q.description);
    let s = 0;
    for (const w of set) { if (nt.includes(w)) s += 2.2; if (kt.includes(w)) s += 1.4; if (dt.includes(w)) s += 0.4; }
    s /= Math.sqrt(Math.max(3, nt.length));
    return { q, s };
  }).sort((a, b) => b.s - a.s);
  return scored;
};

export const mountAssistant = (ctx) => {
  const { el, esc, icon, gbp, pct, int } = ctx;
  const log = el('div', { class: 'log' });
  const input = el('input', { type: 'text', placeholder: 'Ask about your workforce…', 'aria-label': 'Ask People Intelligence' });
  const drawer = el('aside', { class: 'pi-ai', 'aria-label': 'Ask People Intelligence' }, [
    el('header', {}, [el('div', { class: 'orb' }, icon('auto_awesome')), el('div', {}, [el('b', { text: 'Ask People Intelligence' }), el('span', { text: 'Answers from governed business questions only' })]), el('div', { class: 'sp' }),
      el('button', { class: 'pi-btn sm ghost', title: 'Close', onclick: () => close() }, icon('close'))]),
    log,
    el('div', { class: 'foot' }, [el('div', { class: 'pi-askbox' }, [input, el('button', { title: 'Ask', onclick: () => submit() }, icon('arrow_upward'))]),
      el('div', { class: 'gov' }, [icon('verified_user'), el('span', { text: 'Runs stored questions in the Astrato semantic layer · respects your persona scope · never invents data' })])]),
  ]);
  document.body.append(drawer);
  const welcome = () => log.replaceChildren(el('div', { class: 'pi-ai-welcome' }, [el('h4', { text: `Hi ${ctx.persona.first}, what would you like to know?` }),
    el('p', { text: `I answer from ${QUESTIONS.length} governed business questions about your workforce — and I can open investigations, apply filters and launch scenarios.` }),
    el('div', { class: 'msg-a', style: 'border:0;padding:0' }, el('div', { class: 'chips' }, ['What should I focus on today?', 'Why has attrition increased in UK Technology?', 'Compare employee turnover in Germany and the UK', 'Which business units have the greatest skills shortages?', 'What happens if we reduce external hiring by 15%?', 'Show me the workforce cost trend for the last eight quarters'].map((s) => el('button', { text: s, onclick: () => ask(s) }))))]));
  welcome();
  const open = () => { drawer.classList.add('open'); setTimeout(() => input.focus(), 250); };
  const close = () => drawer.classList.remove('open');
  const submit = () => { const v = input.value.trim(); if (v) { input.value = ''; ask(v); } };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); if (e.key === 'Escape') close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });

  const answerShell = (q) => {
    log.querySelector('.pi-ai-welcome')?.remove();
    log.append(el('div', { class: 'msg-u', text: q }));
    const a = el('div', { class: 'msg-a' }, el('div', { class: 'thinking' }, [el('i'), el('i'), el('i'), el('span', { text: 'Finding the governed question and running it…' })]));
    log.append(a);
    log.scrollTop = log.scrollHeight;
    return a;
  };
  const section = (title, children) => [el('h6', { text: title }), ...[].concat(children)];
  const chips = (list, act) => el('div', { class: 'chips' }, list.map(([label, fn]) => el('button', { class: act ? 'act' : '', text: label, onclick: fn })));
  const followUps = (bq) => QUESTIONS.filter((x) => x !== bq && x.cat === bq.cat).slice(0, 2).concat(QUESTIONS.filter((x) => x.cat !== bq.cat && x.cat === 'Cross-source').slice(0, 1)).map((x) => [x.name, () => ask(x.name)]);
  const sourcesOf = (measures) => [...new Set(measures.flatMap((m) => VIEWS_OF[m] ?? []).map((v) => SOURCE[v] ?? v))];
  const sourceBox = (bq, measures, extra = '') => el('div', { class: 'src' }, [icon('verified'), el('div', { html: `<b>Source:</b> ${esc(sourcesOf(measures).join(' · '))}.<br><b>Metric:</b> ${esc(DESC[measures[0]] ?? measures[0])}${extra ? `<br>${extra}` : ''}<br><b>Scope:</b> ${esc(ctx.persona.scopeLabel)} · illustrative data as of 30 Sep 2026` })]);

  /** Turn a stored question (+ detected entities) into a runnable spec. */
  const specOf = (bq, ent) => {
    let filters = (bq.filters ?? []).map((f) => [DIM_FIELD[f.dimension][0], DIM_FIELD[f.dimension][1], f.values, f.dimension]);
    const over = (dimName, vals) => { if (!vals.length) return; const [field, view] = DIM_FIELD[dimName]; filters = filters.filter((f) => f[3] !== dimName); filters.push([field, view, vals, dimName]); };
    over('Country', ent.countries); over('Business Unit', ent.bus); if (ent.skills.length && bq.cat === 'Skills') over('Skill', ent.skills);
    const measures = bq.measures.map((m) => m.name);
    const scope = (VIEWS_OF[measures[0]] ?? []).some((v) => UNSCOPED.test(v)) ? 'none' : 'all';
    return { dims: bq.dimensions.map((d) => DIM_FIELD[d.name]), dimNames: bq.dimensions.map((d) => d.name), measures, scope, filters: filters.map(([a, b, c]) => [a, b, c]), filterText: filters.map((f) => `${f[3]} = ${f[2].join(', ')}`) };
  };
  const renderChart = async (bq, spec, slot) => {
    const type = CHART[bq.chart] ?? 'table';
    const isTime = spec.dimNames[0] === 'Month' || spec.dimNames[0] === 'Quarter';
    const measures = type === 'table' ? spec.measures : type === 'combo' ? spec.measures.slice(0, 3) : type === 'scatter' ? spec.measures.slice(0, 3) : type === 'line' ? spec.measures : bq.chart === 'stacked_bar' ? spec.measures : spec.measures.slice(0, type === 'bar' && spec.dims.length === 1 ? 2 : 1);
    const formats = measures.map((m) => FORMAT[m] ?? '#,##0');
    const combo = type === 'combo' ? { graphTypes: Object.fromEntries(measures.map((_, i) => [`m${i}`, i === 0 || (i < measures.length - 1 && formats[i] === formats[0]) ? 'bar' : 'line'])), secondary: formats.at(-1) !== formats[0] ? `m${measures.length - 1}` : undefined } : {};
    const order = bq.orderBy?.[0];
    const sortBy = order ? (bq.dimensions.find((d) => d.key === order[0]) ? 'd' + bq.dimensions.findIndex((d) => d.key === order[0]) : 'm' + Math.max(0, measures.indexOf(bq.measures.find((m) => m.key === order[0])?.name))) : isTime ? 'd0' : 'm0';
    return ctx.renderTile({
      title: bq.name, type, dims: spec.dims, measures, formats, filters: spec.filters, scope: spec.scope,
      sort: [{ by: sortBy, direction: order?.[1] === 'asc' || isTime ? 'asc' : 'desc' }], limit: type === 'table' ? 60 : isTime ? 60 : 25,
      stacked: bq.chart === 'stacked_bar', ...combo,
      ...(type === 'table' && spec.dims.length && !isTime && !spec.dimNames.includes('Initiative') && !['Skill', 'Reskilling Pathway', 'Exit Reason', 'Exit Destination'].includes(spec.dimNames[0]) && VIEWS_OF[measures[0]]?.includes('Workforce') ? {} : {}),
      ...(type === 'bar' && spec.dims.length === 1 && measures.length === 2 ? { grouped: true, legend: true, measureColors: { m0: '#BEBEBE', m1: '#2B5CE6' } } : {}),
    }, slot, { group: 'g-ask' });
  };

  /** Narrative composed from the returned rows only. */
  const narrate = (bq, spec, rows) => {
    const m0 = spec.measures[0], d0 = spec.dimNames[0];
    const f = (m, v) => ctx.fmtM(m, v);
    if (!rows.length) return { text: 'The governed question returned no rows for your scope and filters.', factors: [] };
    if (!spec.dims.length) {
      const r = rows[0];
      return { text: spec.measures.map((m) => `<b>${esc(m)}</b> ${esc(f(m, r[m]))}`).join(' · '), factors: [] };
    }
    const dk = spec.dims[0][0];
    const label = (r) => spec.dims.map(([k]) => r[k]).filter((x) => x != null).join(' · ');
    if (d0 === 'Month' || d0 === 'Quarter') {
      const s = [...rows].sort((a, b) => String(a[dk]).localeCompare(String(b[dk])));
      const first = s[0], last = s.at(-1);
      const peak = [...s].sort((a, b) => N(b[m0]) - N(a[m0]))[0];
      const ch = N(last[m0]) - N(first[m0]);
      const rate = /%|pts/.test(FORMAT[m0] ?? '');
      return { text: `<b>${esc(m0)}</b> moved from ${esc(f(m0, first[m0]))} in ${esc(first[dk])} to <b>${esc(f(m0, last[m0]))}</b> in ${esc(last[dk])} (${ch >= 0 ? '+' : '−'}${rate ? `${Math.abs(ch * 100).toFixed(1)} pts` : esc(f(m0, Math.abs(ch)))}), peaking at ${esc(f(m0, peak[m0]))} in ${esc(peak[dk])}.${spec.measures[1] ? ` ${esc(spec.measures[1])} ended at ${esc(f(spec.measures[1], last[spec.measures[1]]))}.` : ''}`,
        factors: spec.measures.slice(1).map((m) => `${m}: ${f(m, first[m])} → ${f(m, last[m])}`) };
    }
    const order = bq.orderBy?.[0];
    const sortM = order ? bq.measures.find((m) => m.key === order[0])?.name ?? m0 : m0;
    const desc = order?.[1] !== 'asc';
    const s = [...rows].filter((r) => r[sortM] != null).sort((a, b) => (N(b[sortM]) - N(a[sortM])) * (desc ? 1 : -1));
    if (rows.length === 2) {
      const [a, b] = rows;
      return { text: spec.measures.slice(0, 4).map((m) => `<b>${esc(m)}</b>: ${esc(label(a))} ${esc(f(m, a[m]))} vs ${esc(label(b))} ${esc(f(m, b[m]))}`).join('; ') + '.', factors: spec.measures.slice(4).map((m) => `${m}: ${label(a)} ${f(m, a[m])} · ${label(b)} ${f(m, b[m])}`) };
    }
    const top = s[0], bottom = s.at(-1);
    return {
      text: `${desc ? 'Highest' : 'Lowest'} <b>${esc(sortM)}</b>: <b>${esc(label(top))}</b> at ${esc(f(sortM, top[sortM]))}${spec.measures[1] && spec.measures[1] !== sortM ? ` (${esc(spec.measures[1])} ${esc(f(spec.measures[1], top[spec.measures[1]]))})` : ''}. ${desc ? 'Lowest' : 'Highest'}: ${esc(label(bottom))} at ${esc(f(sortM, bottom[sortM]))}. ${rows.length} ${spec.dims.length > 1 ? (rows.length === 1 ? "segment" : "segments") : esc(rows.length === 1 ? d0.toLowerCase() : d0.toLowerCase().replace(/y$/, "ie") + "s")} in scope.`,
      factors: s.slice(0, 3).map((r) => `${label(r)} — ${spec.measures.slice(0, 3).map((m) => `${m} ${f(m, r[m])}`).join(', ')}`),
    };
  };

  const nextActions = (bq, ent) => {
    const page = PAGE_OF[bq.cat] ?? 'wx';
    const g = GROUP_OF[page];
    const acts = [[`Open ${({ home: 'My People Home', wx: 'Workforce Explorer', tr: 'Talent & Retention', sk: 'Skills & Future Workforce', act: 'People Actions' })[page]}${ent.countries.length || ent.bus.length ? ' filtered' : ''}`, () => {
      ctx.go(page); close();
      if (g && ent.countries.length) ctx.select(g, 'Country', 'Countries', ent.countries);
      if (g && ent.bus.length) ctx.select(g, 'Business Unit', 'Business Units', ent.bus);
    }]];
    if (/Retention|Cross-source/.test(bq.cat) && (ent.bus.length || ent.countries.length)) acts.push(['Open investigation', () => { close(); ctx.openInvestigation({ country: ent.countries[0], bu: ent.bus[0] }); }]);
    if (/Retention|Workforce cost|Mobility/.test(bq.cat)) acts.push(['Launch a scenario', () => { close(); ctx.openSimulator({ country: ent.countries[0], bu: ent.bus[0] ?? (ctx.persona.scope.find(([f]) => f === 'Business Unit')?.[2][0]) }, bq.cat === 'Workforce cost' ? 'cost' : 'retention'); }]);
    return acts;
  };

  // ------------------------------------------------------------------ special intents
  const focusToday = async (a, text) => {
    const bq = QUESTIONS.find((x) => x.name === 'What should I focus on today?');
    const f = await briefingFacts(ctx);
    const items = [];
    if (f.retention) items.push(`<b>Retention — ${esc(popLabel(f.retention.pop))}:</b> rolling attrition ${pct(f.retention['Voluntary Attrition'])}, up ${N(f.retention['Voluntary Attrition vs P2Q']).toFixed(1)} pts since March, ≈${gbp(f.retention.exposure)} exposure above last year’s rate.`);
    if (f.over.length) items.push(`<b>Cost — ${esc(f.over.map((b) => b['Business Unit']).slice(0, 2).join(' and '))}:</b> ${f.over.slice(0, 2).map((b) => `${(N(b['Cost vs Budget % FYTD']) * 100).toFixed(1)}% (${gbp(b['Cost vs Budget FYTD'])})`).join(' and ')} over budget FY27 to date, with contractor spend rising.`);
    if (N(f.mob['Open Critical Roles'])) items.push(`<b>Mobility — critical roles:</b> ${int(f.mob['Adjacent Internal Candidates'])} internal candidates with adjacent skills match ${int(f.mob['Critical Roles with Internal Match'])} of ${int(f.mob['Open Critical Roles'])} open critical positions.`);
    if (f.weakSkill && items.length < 3) items.push(`<b>Skills — ${esc(f.weakSkill.Skill)}:</b> coverage ${pct(f.weakSkill['Skills Coverage'], 0)}, gap ${int(f.weakSkill['Capability Gap 2028'])} FTE by 2028.`);
    const slot = el('div', { class: 'viz' });
    a.replaceChildren(el('div', { class: 'bqtag' }, [icon('verified'), el('span', { text: `Stored question · ${bq.name}` })]),
      el('p', { class: 'ans', html: `Three developments matter most in <b>${esc(ctx.persona.scopeLabel)}</b> today:` }), el('ol', { style: 'margin:0 0 6px;padding-left:18px;font-size:13.5px;line-height:1.55' }, items.slice(0, 3).map((h) => el('li', { html: h }))),
      ...section('Supporting evidence · by business unit', slot),
      ...section('Key contributing factors', el('ul', {}, [el('li', { text: 'Attrition is ranked by its rise over two quarters, not its level, so new risks surface early.' }), el('li', { text: 'Cost pressure compares FY27-to-date spend with the approved S/4HANA budget.' }), el('li', { text: 'Mobility matches open critical requisitions to employees with adjacent skills.' })])),
      sourceBox(bq, bq.measures.map((m) => m.name)),
      ...section('Next actions', chips([
        ...(f.retention ? [['Investigate ' + popLabel(f.retention.pop), () => { close(); ctx.openInvestigation(f.retention.pop); }]] : []),
        ['Simulate interventions', () => { close(); ctx.openSimulator(f.retention?.pop); }],
        ['Explore internal matches', () => { close(); ctx.go('sk'); }],
      ], true)),
      ...section('Follow-up questions', chips([['Why has attrition increased in UK Technology?', () => ask('Why has attrition increased in UK Technology?')], ['Where are we at risk of losing critical talent?', () => ask('Where are we at risk of losing critical talent?')], ['Which business units are over workforce budget?', () => ask('Which business units are over workforce budget?')]])));
    renderChart(bq, specOf(bq, { countries: [], bus: [], skills: [] }), slot);
  };
  const whyAttrition = async (a, text, ent) => {
    const pop = { country: ent.countries[0] ?? (/uk|united kingdom|britain/i.test(text) ? 'United Kingdom' : undefined), bu: ent.bus[0] ?? 'Technology' };
    const bq = QUESTIONS.find((x) => x.name === 'Why is attrition increasing in Technology?');
    const F = [...(pop.country ? [['Country', 'Countries', [pop.country]]] : []), ['Business Unit', 'Business Units', [pop.bu]]];
    const [[s] = [{}], sen, reasons, dest, [e] = [{}]] = await Promise.all([
      ctx.q({ measures: ['Voluntary Attrition', 'Voluntary Attrition P2Q', 'Voluntary Attrition PY', 'Voluntary Attrition vs P2Q', 'Compa Ratio', 'Compa Ratio PY', 'Promotion Rate', 'Promotion Rate PY', 'Replacement Cost Exposure', 'Headcount', 'Voluntary Leavers LTM'], filters: F, limit: 1 }),
      ctx.q({ dims: [['Seniority', 'Seniority']], measures: ['Voluntary Attrition', 'Voluntary Attrition vs P2Q'], filters: F, limit: 10 }),
      ctx.q({ dims: [['Exit Reason', 'Exits']], measures: ['Voluntary Exits'], filters: [...F, ['Exit Type', 'Exits', ['Voluntary']], ['Ltm Bucket', 'Exits', ['LTM']]], limit: 20 }),
      ctx.q({ dims: [['Destination', 'Exits']], measures: ['Voluntary Exits'], filters: [...F, ['Exit Type', 'Exits', ['Voluntary']], ['Ltm Bucket', 'Exits', ['LTM']]], limit: 20 }),
      ctx.q({ measures: ['Pay Fairness CQ', 'Pay Fairness CQ LY', 'Career Growth CQ', 'Career Growth CQ LY', 'Intent to Stay CQ', 'Intent to Stay CQ LY'], filters: F, limit: 1 }),
    ]);
    const label = popLabel(pop);
    const tot = (rows) => rows.reduce((x, r) => x + N(r['Voluntary Exits']), 0) || 1;
    const top = [...reasons].sort((x, y) => N(y['Voluntary Exits']) - N(x['Voluntary Exits'])).slice(0, 2);
    const big = dest.filter((r) => /Hyperscaler/.test(r.Destination)).reduce((x, r) => x + N(r['Voluntary Exits']), 0) / tot(dest);
    const ss = [...sen].sort((x, y) => N(y['Voluntary Attrition vs P2Q']) - N(x['Voluntary Attrition vs P2Q']));
    const slot = el('div', { class: 'viz' });
    a.replaceChildren(el('div', { class: 'bqtag' }, [icon('verified'), el('span', { text: `Stored question · ${bq.name}` })]),
      el('p', { class: 'ans', html: `Rolling voluntary attrition in <b>${esc(label)}</b> is <b>${pct(s['Voluntary Attrition'])}</b>, up from ${pct(s['Voluntary Attrition P2Q'])} in March and ${pct(s['Voluntary Attrition PY'])} a year ago. The rise is concentrated in <b>${esc(ss[0]?.Seniority ?? '')}</b> (${pts(ss[0]?.['Voluntary Attrition vs P2Q'])}) and <b>${esc(ss[1]?.Seniority ?? '')}</b> (${pts(ss[1]?.['Voluntary Attrition vs P2Q'])}) levels. The data shows it moving together with falling pay positioning (compa-ratio ${N(s['Compa Ratio']).toFixed(2)} vs ${N(s['Compa Ratio PY']).toFixed(2)} a year ago), fewer promotions (${pct(s['Promotion Rate'])} vs ${pct(s['Promotion Rate PY'])}) and weaker pay-fairness sentiment (${pct(e['Pay Fairness CQ'], 0)} vs ${pct(e['Pay Fairness CQ LY'], 0)}). These are associations, not proven causes.` }),
      slot,
      ...section('Key contributing factors', el('ul', {}, [
        ...top.map((r) => el('li', { text: `Exit reason “${r['Exit Reason']}”: ${pct(N(r['Voluntary Exits']) / tot(reasons), 0)} of voluntary leavers (LTM)` })),
        el('li', { text: `${pct(big, 0)} of leavers joined hyperscalers / Big Tech` }),
        el('li', { text: `Intent to stay ${pct(e['Intent to Stay CQ'], 0)} (LY ${pct(e['Intent to Stay CQ LY'], 0)}); career growth ${pct(e['Career Growth CQ'], 0)} (LY ${pct(e['Career Growth CQ LY'], 0)})` }),
        el('li', { text: `Twelve-month replacement exposure ${gbp(s['Replacement Cost Exposure'])} across ${int(s['Voluntary Leavers LTM'])} leavers` }),
      ])),
      sourceBox(bq, ['Voluntary Attrition', 'Compa Ratio', 'Pay Fairness CQ', 'Voluntary Exits'], '<b>Method:</b> rolling 12-month rates; drivers are indicators that moved with attrition in this population.'),
      ...section('Next actions', chips([['Open the full investigation', () => { close(); ctx.openInvestigation(pop); }], ['Model a retention intervention', () => { close(); ctx.openSimulator({ ...pop, seniority: ['Senior', 'Lead & Executive'] }, 'retention'); }]], true)),
      ...section('Follow-up questions', chips([['Compare employee turnover in Germany and the UK', () => ask('Compare employee turnover in Germany and the UK')], ['Where do our leavers go?', () => ask('Where do our leavers go?')], ['How does pay positioning relate to attrition?', () => ask('How does pay positioning relate to attrition?')]])));
    ctx.renderTile({ title: 'Rolling attrition by seniority', type: 'line', dims: [['Month', 'Months'], ['Seniority', 'Seniority']], measures: ['Rolling Voluntary Attrition'], filters: F, sort: [{ by: 'd0', direction: 'asc' }], colors: ['#BEBEBE', '#7E7E7E', '#2B5CE6', '#25282B'], limit: 200 }, slot, { group: 'g-ask' });
  };
  const pts = (v) => `${N(v) >= 0 ? '+' : '−'}${Math.abs(N(v)).toFixed(1)} pts`;
  const hiringCut = async (a, text, ent) => {
    const p = Number(text.match(/(\d+(?:\.\d+)?)\s*%/)?.[1] ?? 15) / 100;
    const bq = QUESTIONS.find((x) => x.name.startsWith('What happens if we reduce external hiring'));
    const spec = specOf(bq, ent);
    const [[t] = [{}], [crit] = [{}]] = await Promise.all([
      ctx.q({ measures: ['External Hires LTM', 'Average Cost per Hire', 'Payroll Cost per Employee YTD', 'Open Requisitions', 'Internal Fill Rate YTD', 'Voluntary Leavers LTM', 'Headcount'], filters: spec.filters, limit: 1 }),
      ctx.q({ measures: ['Open Critical Roles', 'Critical Roles with Internal Match'], filters: spec.filters, limit: 1 }),
    ]);
    const fewer = N(t['External Hires LTM']) * p;
    const recruit = fewer * N(t['Average Cost per Hire']);
    const payroll = fewer * N(t['Payroll Cost per Employee YTD']) * 0.5;
    const hcEnd = N(t.Headcount) - fewer;
    const slot = el('div', { class: 'viz' });
    a.replaceChildren(el('div', { class: 'bqtag' }, [icon('verified'), el('span', { text: `Stored question · ${bq.name}` })]),
      el('p', { class: 'ans', html: `Cutting external hiring by <b>${Math.round(p * 100)}%</b> means about <b>${int(fewer)} fewer hires</b> over 12 months (from ${int(t['External Hires LTM'])}). That avoids roughly <b>${gbp(recruit)}</b> of recruitment cost and up to <b>${gbp(payroll)}</b> of payroll (assuming roles stay vacant half the year), and headcount would drift towards ${int(hcEnd)} if attrition holds. The risk: ${int(crit['Open Critical Roles'])} critical roles are open and only ${int(crit['Critical Roles with Internal Match'])} have an internal match, so a blanket cut would slow critical fills — protect critical roles and lift the internal fill rate (now ${pct(t['Internal Fill Rate YTD'])}).` }),
      slot,
      ...section('Key contributing factors', el('ul', {}, [el('li', { text: `Average external cost per hire ${gbp(t['Average Cost per Hire'])}` }), el('li', { text: `${int(t['Open Requisitions'])} open requisitions today` }), el('li', { text: `${int(t['Voluntary Leavers LTM'])} voluntary leavers in 12 months need backfilling` })])),
      sourceBox(bq, ['External Hires LTM', 'Average Cost per Hire', 'Open Critical Roles'], `<b>Calculation:</b> fewer hires = LTM hires × ${Math.round(p * 100)}%; recruitment saving = fewer hires × cost per hire; payroll saving = fewer hires × cost per employee × 0.5.`),
      ...section('Next actions', chips([['Model it in the simulator', () => { close(); ctx.simulator.open({ country: ent.countries[0], bu: ent.bus[0] }, 'cost'); ctx.go('sim'); }], ['See open critical roles', () => { close(); ctx.go('sk'); }]], true)),
      ...section('Follow-up questions', chips([['How much of our hiring is filled internally?', () => ask('How much of our hiring is filled internally?')], ['How can we reduce workforce costs without losing critical skills?', () => ask('How can we reduce workforce costs without losing critical skills?')]])));
    renderChart(bq, spec, slot);
  };

  // ------------------------------------------------------------------ the main entry point
  const ask = async (text) => {
    open();
    const a = answerShell(text);
    const ent = { countries: find(text, COUNTRIES), bus: find(text, BUS), skills: find(text, SKILLS) };
    try {
      if (/focus|today|priorit|need(s)? my attention|what matters/i.test(text)) return await focusToday(a, text);
      if (/why\b.*(attrition|turnover|leaving|quit)/i.test(text)) return await whyAttrition(a, text, ent);
      if (/(reduce|cut|lower|freeze).*(external )?hir/i.test(text) && /(what|if|happen|impact)/i.test(text)) return await hiringCut(a, text, ent);
      const ranked = matchQuestion(text);
      const best = ranked[0];
      if (!best || best.s < 1.6) {
        a.replaceChildren(el('p', { class: 'ans', html: 'I couldn’t match that to a governed business question, so I won’t guess. These stored questions are the closest — or browse the <b>Question library</b>.' }),
          chips(ranked.slice(0, 4).map(({ q }) => [q.name, () => ask(q.name)])),
          el('div', { style: 'margin-top:8px' }, chips([['Open the question library', () => { close(); ctx.go('bq'); }]], true)));
        return;
      }
      const bq = best.q;
      const spec = specOf(bq, ent);
      const rows = await ctx.q({ dims: spec.dims, measures: spec.measures, filters: spec.filters, scope: spec.scope, limit: 200 });
      const { text: narrative, factors } = narrate(bq, spec, rows);
      const slot = el('div', { class: 'viz', style: CHART[bq.chart] === 'table' ? 'height:260px' : '' });
      a.replaceChildren(
        el('div', { class: 'bqtag', title: bq.description }, [icon('verified'), el('span', { text: `Stored question · ${bq.name}` })]),
        el('p', { class: 'ans', html: narrative }),
        spec.filterText.length ? el('p', { class: 'pi-note', text: `Filters: ${spec.filterText.join(' · ')}` }) : null,
        slot,
        ...(factors.length ? section('Key contributing factors', el('ul', {}, factors.map((x) => el('li', { text: x })))) : []),
        sourceBox(bq, spec.measures, `<b>Question:</b> ${esc(bq.description)}`),
        ...section('Next actions', chips(nextActions(bq, ent), true)),
        ...section('Follow-up questions', chips(followUps(bq))),
      );
      renderChart(bq, spec, slot);
    } catch (e) {
      console.warn('[assistant]', e);
      a.replaceChildren(el('p', { class: 'ans', text: `The governed query failed (${e?.message ?? e}). Nothing has been inferred.` }));
    } finally { setTimeout(() => { log.scrollTop = log.scrollHeight; }, 50); }
  };
  ctx.onPersona(() => { if (!log.querySelector('.msg-a')) welcome(); });
  return { open, close, ask };
};
