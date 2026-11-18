/**
 * My People Home: greeting, the conversational entry point, four executive KPI cards (native objects) with
 * governed benchmarks, and "Your People Intelligence Briefing" — prioritised insights composed from
 * governed queries for the current persona's scope. Every number in the text comes from the layer.
 */
export const SUGGESTIONS = [
  ['bolt', 'What should I focus on today?'],
  ['person_off', 'Where are we at risk of losing critical talent?'],
  ['help', 'Why is attrition increasing in Technology?'],
  ['savings', 'How can we reduce workforce costs without losing critical skills?'],
];
const short = (c) => ({ 'United Kingdom': 'UK', 'Poland': 'Czech' })[c] ?? c;
export const popLabel = (p) => [p.country && short(p.country), p.bu, p.dept].filter(Boolean).join(' ') || 'Group';

/** The briefing facts, shared with the assistant ("What should I focus on today?"). */
export const briefingFacts = async (ctx) => {
  const { q } = ctx;
  const [segs, [mob] = [{}], bus, skills] = await Promise.all([
    q({ dims: [['Country', 'Countries'], ['Business Unit', 'Business Units']], measures: ['Voluntary Attrition', 'Voluntary Attrition vs P2Q', 'Voluntary Attrition P2Q', 'Voluntary Attrition PY', 'Headcount', 'Replacement Cost Exposure', 'Voluntary Leavers LTM'], limit: 200 }),
    Promise.all([q({ measures: ['Open Critical Roles', 'Critical Roles with Internal Match', 'Average Cost per Hire', 'Internal Fill Rate YTD', 'Internal Fill Rate YTD vs PY', 'Average Time to Fill YTD'], limit: 1 }), q({ measures: ['Adjacent Internal Candidates'], filters: [['Critical Role', 'Requisitions', ['1']]], limit: 1 })]).then(([[a] = [{}], [b] = [{}]]) => [{ ...a, ...b }]),
    q({ dims: [['Business Unit', 'Business Units']], measures: ['Cost vs Budget FYTD', 'Cost vs Budget % FYTD', 'Contractor Cost FYTD YoY', 'Workforce Cost FYTD', 'Critical Skills Coverage'], limit: 20 }),
    q({ dims: [['Skill', 'Skills']], measures: ['Skills Coverage', 'Skills Coverage vs PY', 'Capability Gap 2028', 'Adjacent Employees'], filters: [['Skill Tier', 'Skills', ['Strategic']]], limit: 20 }),
  ]);
  const N = (v) => Number(v ?? 0);
  const hot = segs.filter((s) => N(s.Headcount) >= 250).sort((a, b) => N(b['Voluntary Attrition vs P2Q']) - N(a['Voluntary Attrition vs P2Q']))[0];
  let retention = null;
  if (hot) {
    const F = [['Country', 'Countries', [hot.Country]], ['Business Unit', 'Business Units', [hot['Business Unit']]]];
    const [sen, dep] = await Promise.all([
      q({ dims: [['Seniority', 'Seniority']], measures: ['Voluntary Attrition', 'Voluntary Attrition vs P2Q', 'Headcount'], filters: F, limit: 10 }),
      q({ dims: [['Department', 'Departments']], measures: ['Voluntary Attrition vs P2Q', 'Headcount'], filters: F, limit: 20 }),
    ]);
    const costPerLeaver = N(hot['Replacement Cost Exposure']) / Math.max(1, N(hot['Voluntary Leavers LTM']));
    const excessLeavers = Math.max(0, (N(hot['Voluntary Attrition']) - N(hot['Voluntary Attrition PY'])) * N(hot.Headcount));
    const senTop = [...sen].sort((a, b) => N(b['Voluntary Attrition vs P2Q']) - N(a['Voluntary Attrition vs P2Q']));
    retention = { ...hot, pop: { country: hot.Country, bu: hot['Business Unit'] }, sen: senTop, dep: [...dep].sort((a, b) => N(b['Voluntary Attrition vs P2Q']) - N(a['Voluntary Attrition vs P2Q'])), costPerLeaver, excessLeavers, exposure: excessLeavers * costPerLeaver };
  }
  const over = bus.filter((b) => N(b['Cost vs Budget % FYTD']) > 0.01).sort((a, b) => N(b['Cost vs Budget % FYTD']) - N(a['Cost vs Budget % FYTD']));
  const weakSkill = skills.filter((s) => s['Skills Coverage'] != null).sort((a, b) => N(a['Skills Coverage']) - N(b['Skills Coverage']))[0];
  return { retention, mob, over, bus, skills, weakSkill };
};

export const mountHome = (ctx, { pane, kpis }) => {
  const { el, esc, icon, gbp, pct, int } = ctx;
  const hello = el('h2');
  const date = el('div', { class: 'date' });
  const input = el('input', { type: 'text', placeholder: 'Ask anything about your workforce, or what needs your attention today...', 'aria-label': 'Ask People Intelligence' });
  const send = () => { const v = input.value.trim(); if (!v) return; ctx.assistant.ask(v); input.value = ''; };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(); });
  const hero = el('section', { class: 'pi-hero' }, [
    date, hello,
    el('p', { class: 'lead', text: 'Your people intelligence, priorities and decisions — all in one place.' }),
    el('div', { class: 'pi-askbox' }, [el('span', { class: 'mi spark', text: 'auto_awesome' }), input, el('button', { title: 'Ask', onclick: send }, icon('arrow_upward'))]),
    el('div', { class: 'pi-suggest' }, SUGGESTIONS.map(([ic, s]) => el('button', { onclick: () => ctx.assistant.ask(s) }, [icon(ic), el('span', { text: s })]))),
  ]);
  const insights = el('div', { class: 'pi-insights' });
  const meta = el('span', { class: 'meta' });
  const brief = el('section', { class: 'pi-brief' }, [
    el('header', {}, [el('h3', { text: 'Your People Intelligence Briefing' }), el('span', { class: 'ai' }, [icon('auto_awesome'), el('span', { text: 'Generated from governed data' })]), meta]),
    insights,
  ]);
  const exploreHead = el('h3', { text: 'Explore the trends', style: 'font-size:15px;margin:22px 0 10px;letter-spacing:-.01em' });
  pane.head.prepend(hero);
  kpis.after(brief);
  pane.pane.querySelector('.pi-filters')?.before(exploreHead);

  const greet = () => {
    hello.innerHTML = `Good morning, ${esc(ctx.persona.first)}. Here’s what matters across <em>your workforce</em>.`;
    date.replaceChildren(icon('calendar_today'), el('span', { text: `${new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${ctx.persona.role} · data as of 30 Sep 2026 (illustrative)` }));
  };

  /** Insight card: headline, three stat tiles (the insight at a glance), one short line, evidence and actions. */
  const card = (cls, tag, headline, stats, line, evidence, acts) => el('article', { class: `pi-insight ${cls}` }, [
    el('div', { class: 'tag' }, [el('b', { text: tag }), el('span', { text: `| ${headline}` })]),
    el('div', { class: 'pi-istats' }, stats.map(([l, v, sub, tone]) => el('div', { class: tone ?? '' }, [el('span', { text: l }), el('b', { text: v }), sub ? el('i', { text: sub }) : null]))),
    line ? el('p', { html: line }) : null,
    el('div', { class: 'evidence' }, [icon('verified'), el('span', { text: evidence })]),
    el('div', { class: 'acts' }, acts.map(([label, ic, fn, primary]) => el('button', { class: `pi-btn sm ${primary ? 'primary' : ''}`, onclick: fn }, [icon(ic), el('span', { text: label })]))),
  ]);
  const sg = (v, d = 1, u = ' pts') => `${Number(v) >= 0 ? '+' : '−'}${Math.abs(Number(v)).toFixed(d)}${u}`;

  let run = 0;
  const renderBriefing = async () => {
    const my = ++run;
    insights.replaceChildren(...[0, 1, 2].map(() => el('article', { class: 'pi-insight' }, [el('div', { class: 'pi-skel', style: 'width:40%' }), el('div', { class: 'pi-skel' }), el('div', { class: 'pi-skel' }), el('div', { class: 'pi-skel', style: 'width:70%' })])));
    meta.textContent = 'Analysing governed data…';
    let f;
    try { f = await briefingFacts(ctx); } catch (e) { insights.replaceChildren(el('p', { class: 'pi-note', text: `Briefing unavailable: ${e?.message ?? e}` })); return; }
    if (my !== run) return;
    const out = [];
    const r = f.retention;
    if (r) {
      const label = popLabel(r.pop);
      const d = Number(r['Voluntary Attrition vs P2Q']);
      const crit = d > 1.5;
      out.push(card(crit ? 'crit' : 'att', crit ? 'Critical' : 'Attention', `${label} retention risk`,
        [['Vol. attrition', pct(r['Voluntary Attrition']), `${sg(d)} in 2 qtrs`, d > 0 ? 'bad' : 'good'], ['Hottest level', (r.sen[0]?.Seniority ?? '').replace(' & Executive', ''), r.sen[0] ? sg(r.sen[0]['Voluntary Attrition vs P2Q']) : '', 'bad'], ['Exposure vs LY', gbp(r.exposure), `${Math.round(r.excessLeavers)} extra leavers`, 'bad']],
        r.dep[0] ? `Concentrated in <b>${esc(r.dep[0].Department)}</b> · ${int(r.Headcount)} employees` : '',
        'Rolling 12m, Sep 26 vs Mar 26 · SuccessFactors EC',
        [['Investigate', 'biotech', () => ctx.openInvestigation(r.pop), true], ['Simulate', 'tune', () => ctx.openSimulator(r.pop)], ['Assign to HRBP', 'person_add', () => {
          const a = ctx.actions.create({ name: `${label} retention review`, bu: r.pop.bu, country: r.pop.country, type: 'Retention', owner: 'Hannah Clarke (HRBP, UK Technology)', metric: `Voluntary attrition (LTM) in ${label}`, baseline: Number(r['Voluntary Attrition']), target: Number(r['Voluntary Attrition PY']), insight: `Critical | ${label} retention risk`, evidence: { page: 'tr', pop: r.pop } });
          ctx.toast(`Assigned <b>${esc(a.id)}</b> to Hannah Clarke · <a href="#act" style="color:#fff">open</a>`, 'assignment_ind');
        }]]));
    }
    const m = f.mob;
    if (Number(m['Open Critical Roles']) > 0) {
      out.push(card('opp', 'Opportunity', 'Internal mobility',
        [['Internal candidates', int(m['Adjacent Internal Candidates']), 'adjacent skills', 'good'], ['Roles matched', `${int(m['Critical Roles with Internal Match'])} / ${int(m['Open Critical Roles'])}`, 'open critical roles'], ['Spend avoidable', gbp(Number(m['Critical Roles with Internal Match']) * Number(m['Average Cost per Hire'])), 'recruitment', 'good']],
        `Internal fill rate <b>${pct(m['Internal Fill Rate YTD'])}</b> (${sg(m['Internal Fill Rate YTD vs PY'])} vs LY)`,
        'Open requisitions at 30 Sep 26 · Recruiting + Opportunity Marketplace',
        [['Explore matches', 'join_inner', () => { ctx.go('sk'); setTimeout(() => document.querySelector('[data-slot="s-reqtbl"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }, true], ['Create campaign', 'campaign', () => ctx.actions.openCreate({ name: 'Internal Mobility Acceleration — critical roles', type: 'Mobility', bu: 'Group Functions', country: 'Group', owner: 'Sarah Mitchell (Group CHRO)', metric: 'Critical roles filled internally', baseline: Number(m['Internal Fill Rate YTD']), target: 0.4, benefit: Math.round(Number(m['Critical Roles with Internal Match']) * Number(m['Average Cost per Hire'])), investment: 250000, insight: 'Opportunity | Internal mobility', evidence: { page: 'sk' } })]]));
    }
    if (f.over.length) {
      const top2 = f.over.slice(0, 2);
      const total = f.over.reduce((s, b) => s + Number(b['Cost vs Budget FYTD']), 0);
      out.push(card('att', 'Attention', 'Workforce cost',
        [...top2.map((b) => [b['Business Unit'], sg(Number(b['Cost vs Budget % FYTD']) * 100, 1, '%'), `${gbp(b['Cost vs Budget FYTD'])} over`, 'bad']), ['Contractors', sg(Number(top2[0]['Contractor Cost FYTD YoY']) * 100, 0, '%'), `${top2[0]['Business Unit']} YoY`, 'bad']].slice(0, 3),
        `<b>${gbp(total)}</b> over plan FY27 to date in ${f.over.length} unit${f.over.length > 1 ? 's' : ''}`,
        'FY27 to date vs budget · S/4HANA cost centres',
        [['Cost drivers', 'query_stats', () => { ctx.go('wx'); ctx.select('g-wx', 'Business Unit', 'Business Units', [top2[0]['Business Unit']]); }, true], ['Model scenarios', 'tune', () => ctx.openSimulator({ bu: top2[0]['Business Unit'], country: ctx.persona.key === 'hrbp' || ctx.persona.key === 'rhrd' ? 'United Kingdom' : undefined }, 'cost')]]));
    }
    const w = f.weakSkill;
    if (w) {
      out.push(card('watch', 'Watch', `${w.Skill}`,
        [['Coverage', pct(w['Skills Coverage'], 0), `${sg(w['Skills Coverage vs PY'])} vs LY`, Number(w['Skills Coverage vs PY']) < 0 ? 'bad' : 'good'], ['Gap 2028', `${int(w['Capability Gap 2028'])}`, 'FTE', 'bad'], ['Adjacent', int(w['Adjacent Employees']), 'reskillable', 'good']],
        '', 'Talent Intelligence Hub · Sep 26 vs 2028 plan',
        [['Skills gap', 'psychology', () => { ctx.go('sk'); ctx.select('g-sk', 'Skill', 'Skills', [w.Skill]); }, true], ['Who could we reskill?', 'auto_awesome', () => ctx.assistant.ask('Who could we reskill into future-critical roles?')]]));
    }
    insights.replaceChildren(...out);
    meta.textContent = `${out.length} prioritised insights · ${ctx.persona.scopeLabel}`;
  };

  // Benchmarks under the KPI cards (governed, persona-aware)
  const benches = async () => {
    const set = (id, html) => { const b = document.querySelector(`[data-bench="${id}"]`); if (b) b.innerHTML = html; };
    try {
      const [[t] = [{}], [g] = [{}], bu, sk] = await Promise.all([
        ctx.q({ measures: ['FTE', 'Critical Role Share', 'Workforce Budget FYTD', 'Cost vs Budget FYTD', 'Headcount PY'], limit: 1 }),
        ctx.q({ measures: ['Voluntary Attrition'], limit: 1, scope: 'none' }),
        ctx.q({ dims: [['Business Unit', 'Business Units']], measures: ['Voluntary Attrition'], limit: 20 }),
        ctx.q({ dims: [['Skill', 'Skills']], measures: ['Skills Coverage'], filters: [['Skill', 'Skills', ['AI & Machine Learning', 'Cloud Engineering']]], limit: 5 }),
      ]);
      const s = [...bu].sort((a, b) => a['Voluntary Attrition'] - b['Voluntary Attrition']);
      set('h-hc', `<b>${int(t.FTE)}</b> FTE · <b>${pct(t['Critical Role Share'], 0)}</b> in critical roles`);
      set('h-va', ctx.persona.scope.length ? `Group benchmark <b>${pct(g['Voluntary Attrition'])}</b>` : `Range <b>${pct(s[0]?.['Voluntary Attrition'])}</b> (${s[0]?.['Business Unit']}) – <b>${pct(s.at(-1)?.['Voluntary Attrition'])}</b> (${s.at(-1)?.['Business Unit']})`);
      set('h-cs', sk.map((r) => `${r.Skill.replace(' & Machine Learning', ' & ML').replace(' Engineering', '')} <b>${pct(r['Skills Coverage'], 0)}</b>`).join(' · '));
      set('h-cb', `<b>${Number(t['Cost vs Budget FYTD']) >= 0 ? '+' : ''}${gbp(t['Cost vs Budget FYTD'])}</b> vs ${gbp(t['Workforce Budget FYTD'])} plan`);
    } catch (e) { console.warn('[bench]', e); }
  };
  greet(); ctx.onPageMount('home', () => { renderBriefing(); benches(); });
  ctx.onPersonaNow(greet);
  ctx.onPersona(() => { renderBriefing(); benches(); });
};
