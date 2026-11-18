/**
 * Explanations that follow the reader's selection, and the structured retention investigation.
 *
 * Both compose governed queries only: the segment against its comparison population, trend, drivers
 * (presented as associations, never as proven causes), exposure and interventions.
 */
import { popLabel } from './home.js';

const N = (v) => Number(v ?? 0);
const keyParts = (fk) => { const m = String(fk).match(/^\[(.+)\]\.\[(.+)\]$/); return m ? [m[2], m[1]] : null; };
const popFilters = (p) => [
  ...(p.country ? [['Country', 'Countries', [].concat(p.country)]] : []),
  ...(p.bu ? [['Business Unit', 'Business Units', [].concat(p.bu)]] : []),
  ...(p.dept ? [['Department', 'Departments', [].concat(p.dept)]] : []),
  ...(p.seniority?.length ? [['Seniority', 'Seniority', p.seniority]] : []),
];
export { popFilters };
const pts = (v) => `${N(v) >= 0 ? '+' : '−'}${Math.abs(N(v)).toFixed(1)} pts`;
const sgn = (v, f) => `${N(v) >= 0 ? '+' : '−'}${f(Math.abs(N(v)))}`;

// ------------------------------------------------------------------ Workforce Explorer: AI explanation panel
export const mountExplain = (ctx, host) => {
  const { el, esc, icon, pct, int, gbp } = ctx;
  let run = 0;
  const render = async () => {
    const my = ++run;
    const applied = ctx.appliedOf('g-wx');
    const filters = applied.map((x) => { const kp = keyParts(x.field?.fieldKey ?? x.fieldKey); return kp ? [kp[0], kp[1], x.values.map(String)] : null; }).filter(Boolean);
    const label = applied.length ? applied.map((x) => x.values.slice(0, 2).join(' / ')).join(' · ') : ctx.persona.scope.length ? ctx.persona.scopeLabel : 'Your whole workforce';
    host.replaceChildren(el('div', { class: 'head' }, [icon('auto_awesome'), el('span', { text: 'AI explanation · governed' })]), el('h4', { text: label }), el('div', { class: 'pi-skel' }), el('div', { class: 'pi-skel' }), el('div', { class: 'pi-skel', style: 'width:60%' }));
    host.classList.add('pi-explain');
    const M = ['Headcount', 'Headcount YoY', 'Voluntary Attrition', 'Voluntary Attrition vs PY', 'Voluntary Attrition vs P2Q', 'Hiring Rate', 'Internal Mobility Rate', 'Absence Rate YTD', 'Engagement Index CQ', 'Compa Ratio', 'Pay Fairness CQ', 'Career Growth CQ', 'Replacement Cost Exposure', 'Regretted Attrition'];
    try {
      const [[s] = [{}], [g] = [{}], reasons] = await Promise.all([
        ctx.q({ measures: M, filters, limit: 1 }),
        ctx.q({ measures: M, limit: 1 }),
        ctx.q({ dims: [['Exit Reason', 'Exits']], measures: ['Voluntary Exits'], filters: [...filters, ['Exit Type', 'Exits', ['Voluntary']], ['Ltm Bucket', 'Exits', ['LTM']]], limit: 20 }),
      ]);
      if (my !== run) return;
      const tot = reasons.reduce((a, r) => a + N(r['Voluntary Exits']), 0) || 1;
      const top = [...reasons].sort((a, b) => N(b['Voluntary Exits']) - N(a['Voluntary Exits'])).slice(0, 3);
      const isAll = !filters.length;
      const vaUp = N(s['Voluntary Attrition vs P2Q']) > 0.5;
      const cmp = isAll ? [] : [
        ['Compa-ratio', N(s['Compa Ratio']).toFixed(2), N(g['Compa Ratio']).toFixed(2), N(s['Compa Ratio']) < N(g['Compa Ratio']) - 0.02],
        ['Pay fairness Q3', pct(s['Pay Fairness CQ'], 0), pct(g['Pay Fairness CQ'], 0), N(s['Pay Fairness CQ']) < N(g['Pay Fairness CQ']) - 0.03],
        ['Career growth Q3', pct(s['Career Growth CQ'], 0), pct(g['Career Growth CQ'], 0), N(s['Career Growth CQ']) < N(g['Career Growth CQ']) - 0.03],
        ['Internal mobility', pct(s['Internal Mobility Rate']), pct(g['Internal Mobility Rate']), N(s['Internal Mobility Rate']) < N(g['Internal Mobility Rate']) - 0.01],
        ['Regretted attrition', pct(s['Regretted Attrition']), pct(g['Regretted Attrition']), N(s['Regretted Attrition']) > N(g['Regretted Attrition']) + 0.01],
      ];
      const tile = (l, v, sub, cls) => el('div', {}, [el('span', { text: l }), el('b', { text: v }), el('i', { class: cls ?? '', text: sub })]);
      host.replaceChildren(
        el('div', { class: 'head' }, [icon('auto_awesome'), el('span', { text: 'AI explanation · governed' })]),
        el('h4', { text: label }),
        el('div', { class: 'stats' }, [
          tile('Headcount', int(s.Headcount), `${sgn(s['Headcount YoY'], (v) => pct(v))} YoY`, N(s['Headcount YoY']) >= 0 ? 'up-good' : 'down-bad'),
          tile('Vol. attrition', pct(s['Voluntary Attrition']), `${pts(s['Voluntary Attrition vs PY'])} vs LY`, N(s['Voluntary Attrition vs PY']) > 0 ? 'up-bad' : 'down-good'),
          tile('vs March', pts(s['Voluntary Attrition vs P2Q']), isAll ? 'rolling 12m' : `group ${pts(g['Voluntary Attrition vs P2Q'])}`, vaUp ? 'up-bad' : 'down-good'),
          tile('Hiring rate', pct(s['Hiring Rate']), isAll ? 'LTM' : `group ${pct(g['Hiring Rate'])}`),
          tile('Engagement Q3', N(s['Engagement Index CQ']).toFixed(1), isAll ? 'index 0–100' : `group ${N(g['Engagement Index CQ']).toFixed(1)}`),
          tile('Exposure', gbp(s['Replacement Cost Exposure']), 'replacement 12m'),
        ]),
        top.length ? el('div', { class: 'pi-bars' }, [el('h6', { text: 'Exit reasons · LTM' }), ...top.map((r) => { const sh = N(r['Voluntary Exits']) / tot; return el('div', { class: 'row' }, [el('span', { text: r['Exit Reason'] }), el('i', {}, el('em', { style: `width:${Math.round(sh * 100)}%` })), el('b', { text: pct(sh, 0) })]); })]) : null,
        cmp.length ? el('table', { class: 'pi-t', style: 'margin:4px 0 8px' }, [el('tr', {}, ['Signal', 'Here', 'Group', ''].map((h, i) => el('th', { class: i && i < 3 ? 'r' : '', text: h }))), ...cmp.map(([n, a, b, flag]) => el('tr', {}, [el('td', { text: n }), el('td', { class: 'r', html: `<b>${a}</b>` }), el('td', { class: 'r', text: b }), el('td', { html: flag ? '<span class="assoc strong">watch</span>' : '' })]))]) : null,
        el('div', { class: 'pi-actions-row' }, [
          !isAll ? el('button', { class: 'pi-btn sm primary', onclick: () => {
            const v = (f) => filters.find(([n]) => n === f)?.[2]?.[0];
            ctx.openInvestigation({ country: v('Country'), bu: v('Business Unit'), dept: v('Department') });
          } }, [icon('biotech'), el('span', { text: 'Investigate' })]) : null,
          el('button', { class: 'pi-btn sm', onclick: () => ctx.assistant.ask(isAll ? 'What should I focus on today?' : `Why is attrition ${vaUp ? 'increasing' : 'changing'} in ${label}?`) }, [icon('auto_awesome'), el('span', { text: 'Ask a follow-up' })]),
        ]),
        el('p', { class: 'pi-note', style: 'margin-top:8px', html: '<span class="mi">verified</span> Workforce (SuccessFactors), Engagement (Qualtrics) and Exits measures from the published semantic layer.' }),
      );
    } catch (e) { host.replaceChildren(el('p', { class: 'pi-note', text: `Explanation unavailable: ${e?.message ?? e}` })); }
  };
  let t;
  ctx.onSelection((g) => { if (g === 'g-wx') { clearTimeout(t); t = setTimeout(render, 300); } });
  ctx.onPersona(render);
  ctx.onPageMount('wx', render);
};

// ------------------------------------------------------------------ Talent & Retention: structured investigation
export const mountInvestigation = (ctx, host) => {
  const { el, esc, icon, pct, int, gbp } = ctx;
  let tilesOpen = [];
  let current = null;
  const idle = () => {
    host.className = 'pi-card span-12';
    host.replaceChildren(el('div', { class: 'pi-cap' }, [el('span', { class: 't', html: '<span class="mi" style="color:#2B5CE6;vertical-align:-4px">biotech</span> Retention investigation' })]),
      el('p', { class: 'pi-note', text: 'Click a business unit on the risk matrix, a heatmap cell or a scorecard row — or start from a suggestion — to open a structured investigation: trend, comparison, drivers, exposure and interventions.' }),
      el('div', { class: 'pi-actions-row', style: 'margin-top:8px' }, [
        el('button', { class: 'pi-btn sm primary', onclick: () => open({ country: 'United Kingdom', bu: 'Technology' }) }, [icon('play_arrow'), el('span', { text: 'Why is attrition increasing among senior engineers in the UK?' })]),
        el('button', { class: 'pi-btn sm', onclick: () => open({ bu: 'Customer Operations' }) }, [el('span', { text: 'Customer Operations' })]),
        el('button', { class: 'pi-btn sm', onclick: () => open({ country: 'India', bu: 'Shared Services (GBS)' }) }, [el('span', { text: 'India · GBS' })]),
      ]));
  };
  const open = async (pop) => {
    current = pop;
    for (const id of tilesOpen) ctx.dropTile(id);
    tilesOpen = [];
    const label = popLabel(pop);
    const tech = pop.bu === 'Technology';
    const question = tech && pop.country ? `Why is attrition increasing among senior engineers in ${pop.country === 'United Kingdom' ? 'the UK' : pop.country}?` : `What is driving attrition in ${label}?`;
    const F = popFilters(pop);
    host.className = 'pi-inv span-12';
    const steps = el('div', { class: 'steps' });
    host.replaceChildren(el('header', {}, [icon('biotech'), el('div', {}, [el('h3', { text: question }), el('span', { text: `Structured investigation · ${label} · rolling 12 months to Sep 2026 · governed queries only` })]), el('div', { class: 'sp' }),
      el('button', { class: 'pi-btn sm', style: 'background:transparent;color:#fff;border-color:#666', onclick: () => { for (const id of tilesOpen) ctx.dropTile(id); idle(); } }, [icon('close'), el('span', { text: 'Close' })])]), steps);
    host.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const step = (n, title, cls, children) => el('div', { class: `pi-step ${cls}` }, [el('h5', {}, [el('span', { class: 'n', text: String(n) }), el('span', { text: title })]), ...children]);
    const s1t = el('p', { html: '<span class="pi-skel" style="display:block"></span>' }), s1c = el('div', { class: 'viz' });
    const s2t = el('p', { html: '<span class="pi-skel" style="display:block"></span>' }), s2c = el('div', { class: 'viz' });
    const s3 = el('div', {}, el('div', { class: 'pi-skel' })), s4 = el('div', {}, el('div', { class: 'pi-skel' })), s5 = el('div', {}, el('div', { class: 'pi-skel' }));
    steps.append(step(1, 'Trend over the last 12 months', 'span-7', [s1t, s1c]), step(2, 'Comparison against other functions and regions', 'span-5', [s2t, s2c]),
      step(3, 'Drivers supported by the data', 'span-7', [s3]), step(4, 'Estimated financial and operational exposure', 'span-5', [s4]), step(5, 'Recommended interventions', 'span-12', [s5]));

    // 1 · trend (native)
    ctx.renderTile({ title: 'Rolling voluntary attrition by seniority', type: 'line', dims: [['Month', 'Months'], ['Seniority', 'Seniority']], measures: ['Rolling Voluntary Attrition'], filters: F, sort: [{ by: 'd0', direction: 'asc' }], colors: ['#BEBEBE', '#7E7E7E', '#2B5CE6', '#25282B'], limit: 200 }, s1c, { group: 'g-inv' }).then((id) => id && tilesOpen.push(id));
    // 2 · comparison (native)
    const cmpDim = pop.country ? ['Business Unit', 'Business Units'] : ['Country', 'Countries'];
    const cmpF = pop.country ? [['Country', 'Countries', [pop.country]]] : pop.bu ? [['Business Unit', 'Business Units', [pop.bu]]] : [];
    ctx.renderTile({ title: 'Attrition change since March', type: 'bar', dims: [cmpDim], measures: ['Voluntary Attrition vs P2Q'], filters: cmpF, sort: { by: 'm0', direction: 'desc' }, gradient: ['#1C9AAE', '#F2F2F2', '#D92D20'], limit: 20 }, s2c, { group: 'g-inv' }).then((id) => id && tilesOpen.push(id));

    const SM = ['Voluntary Attrition', 'Voluntary Attrition P2Q', 'Voluntary Attrition PY', 'Voluntary Attrition vs P2Q', 'Voluntary Attrition vs PY', 'Headcount', 'Voluntary Leavers LTM', 'Replacement Cost Exposure', 'Replacement Cost Exposure PY', 'Compa Ratio', 'Compa Ratio PY', 'Promotion Rate', 'Promotion Rate PY', 'Learning Hours per Employee YTD', 'Learning Hours per Employee PY YTD', 'Critical Role Headcount', 'High Performer Attrition', 'High Performer Attrition PY'];
    const EM = ['Intent to Stay CQ', 'Intent to Stay CQ LY', 'Pay Fairness CQ', 'Pay Fairness CQ LY', 'Career Growth CQ', 'Career Growth CQ LY', 'Manager Effectiveness CQ', 'Manager Effectiveness CQ LY', 'Workload CQ', 'Workload CQ LY'];
    try {
      const [[s] = [{}], [g] = [{}], [se] = [{}], [ge] = [{}], sen, cmp, reasonsNow, reasonsPrev, destNow, [rq] = [{}], [co] = [{}], [ex] = [{}]] = await Promise.all([
        ctx.q({ measures: SM, filters: F, limit: 1 }), ctx.q({ measures: SM, limit: 1 }),
        ctx.q({ measures: EM, filters: F.filter(([f]) => f !== 'Seniority'), limit: 1 }), ctx.q({ measures: EM, limit: 1 }),
        ctx.q({ dims: [['Seniority', 'Seniority']], measures: ['Voluntary Attrition', 'Voluntary Attrition vs P2Q', 'Compa Ratio', 'Compa Ratio PY', 'Promotion Rate', 'Headcount'], filters: F, limit: 10 }),
        ctx.q({ dims: [cmpDim], measures: ['Voluntary Attrition', 'Voluntary Attrition vs P2Q'], filters: cmpF, limit: 30 }),
        ctx.q({ dims: [['Exit Reason', 'Exits']], measures: ['Voluntary Exits'], filters: [...F, ['Exit Type', 'Exits', ['Voluntary']], ['Ltm Bucket', 'Exits', ['LTM']]], limit: 20 }),
        ctx.q({ dims: [['Exit Reason', 'Exits']], measures: ['Voluntary Exits'], filters: [...F, ['Exit Type', 'Exits', ['Voluntary']], ['Ltm Bucket', 'Exits', ['Prior LTM']]], limit: 20 }),
        ctx.q({ dims: [['Destination', 'Exits']], measures: ['Voluntary Exits'], filters: [...F, ['Exit Type', 'Exits', ['Voluntary']], ['Ltm Bucket', 'Exits', ['LTM']]], limit: 20 }),
        ctx.q({ measures: ['Open Critical Roles', 'Average Days Open'], filters: F, limit: 1 }),
        ctx.q({ measures: ['Contractor Cost FYTD', 'Contractor Cost FYTD YoY'], filters: F.filter(([f]) => f !== 'Seniority'), limit: 1 }),
        ctx.q({ measures: ['Average Days to Backfill'], filters: [...F, ['Ltm Bucket', 'Exits', ['LTM']]], limit: 1 }),
      ]);
      if (current !== pop) return;
      // 1 · narrative
      const senSorted = [...sen].sort((a, b) => N(b['Voluntary Attrition vs P2Q']) - N(a['Voluntary Attrition vs P2Q']));
      const hot = senSorted.filter((x) => N(x['Voluntary Attrition vs P2Q']) > 1).slice(0, 2).map((x) => x.Seniority);
      const chipsOf = (list) => `<div class="pi-istats" style="grid-template-columns:repeat(${list.length},minmax(0,1fr));margin-bottom:6px">${list.map(([l, v, sub, tone]) => `<div class="${tone ?? ''}"><span>${esc(l)}</span><b>${esc(v)}</b><i>${esc(sub ?? '')}</i></div>`).join('')}</div>`;
      s1t.outerHTML = chipsOf([['Now', pct(s['Voluntary Attrition']), 'rolling 12m', 'bad'], ['March', pct(s['Voluntary Attrition P2Q']), pts(s['Voluntary Attrition vs P2Q'])], ['Year ago', pct(s['Voluntary Attrition PY']), pts(s['Voluntary Attrition vs PY'])], ...senSorted.slice(0, 1).map((x) => [x.Seniority.replace(' & Executive', ''), pct(x['Voluntary Attrition']), `${pts(x['Voluntary Attrition vs P2Q'])} vs Mar`, 'bad'])]);
      // 2 · comparison
      const cs = [...cmp].sort((a, b) => N(b['Voluntary Attrition vs P2Q']) - N(a['Voluntary Attrition vs P2Q']));
      const me = cs.findIndex((r) => r[cmpDim[0]] === (pop.country ? pop.bu : pop.country));
      s2t.outerHTML = chipsOf([['Rank', me >= 0 ? `#${me + 1} / ${cs.length}` : '–', 'rise since March', me === 0 ? 'bad' : ''], ['This segment', me >= 0 ? pts(cs[me]['Voluntary Attrition vs P2Q']) : '–', 'vs March', 'bad'], ['Group', pts(g['Voluntary Attrition vs P2Q']), `now ${pct(g['Voluntary Attrition'])}`]]);
      // 3 · drivers
      const share = (rows, re) => { const t = rows.reduce((a, r) => a + N(r['Voluntary Exits']), 0) || 1; return rows.filter((r) => re.test(r['Exit Reason'] ?? r.Destination)).reduce((a, r) => a + N(r['Voluntary Exits']), 0) / t; };
      const payNow = share(reasonsNow, /Pay/), payPrev = share(reasonsPrev, /Pay/), carNow = share(reasonsNow, /Career/), carPrev = share(reasonsPrev, /Career/), bigTech = share(destNow, /Hyperscaler/);
      const seniorRow = sen.filter((x) => /Senior|Lead/.test(x.Seniority));
      const seniorCompa = seniorRow.length ? seniorRow.reduce((a, x) => a + N(x['Compa Ratio']) * N(x.Headcount), 0) / Math.max(1, seniorRow.reduce((a, x) => a + N(x.Headcount), 0)) : N(s['Compa Ratio']);
      const seniorCompaPY = seniorRow.length ? seniorRow.reduce((a, x) => a + N(x['Compa Ratio PY']) * N(x.Headcount), 0) / Math.max(1, seniorRow.reduce((a, x) => a + N(x.Headcount), 0)) : N(s['Compa Ratio PY']);
      const rows = [
        ['Senior & lead compa-ratio', seniorCompa.toFixed(2), N(g['Compa Ratio']).toFixed(2), sgn(seniorCompa - seniorCompaPY, (v) => v.toFixed(2)), Math.abs(seniorCompa - seniorCompaPY) >= 0.04 ? 'strong' : Math.abs(seniorCompa - seniorCompaPY) >= 0.015 ? 'moderate' : 'weak', 'SuccessFactors Compensation'],
        ['Exit reason: pay & benefits', pct(payNow, 0), '—', pts((payNow - payPrev) * 100), payNow - payPrev > 0.08 ? 'strong' : payNow - payPrev > 0.03 ? 'moderate' : 'weak', 'Qualtrics exit survey'],
        ['Exit reason: career progression', pct(carNow, 0), '—', pts((carNow - carPrev) * 100), carNow - carPrev > 0.06 ? 'strong' : carNow - carPrev > 0.02 ? 'moderate' : 'weak', 'Qualtrics exit survey'],
        ['Leavers joining hyperscalers / Big Tech', pct(bigTech, 0), '—', '', bigTech > 0.3 ? 'strong' : bigTech > 0.15 ? 'moderate' : 'weak', 'Qualtrics exit survey'],
        ['Promotion rate (LTM)', pct(s['Promotion Rate']), pct(g['Promotion Rate']), pts((N(s['Promotion Rate']) - N(s['Promotion Rate PY'])) * 100), N(s['Promotion Rate']) - N(s['Promotion Rate PY']) < -0.015 ? 'strong' : N(s['Promotion Rate']) - N(s['Promotion Rate PY']) < -0.005 ? 'moderate' : 'weak', 'SuccessFactors EC'],
        ['Pay fairness (favourable, Q3)', pct(se['Pay Fairness CQ'], 0), pct(ge['Pay Fairness CQ'], 0), pts((N(se['Pay Fairness CQ']) - N(se['Pay Fairness CQ LY'])) * 100), N(se['Pay Fairness CQ']) - N(se['Pay Fairness CQ LY']) < -0.08 ? 'strong' : N(se['Pay Fairness CQ']) - N(se['Pay Fairness CQ LY']) < -0.03 ? 'moderate' : 'weak', 'Qualtrics pulse'],
        ['Career growth (favourable, Q3)', pct(se['Career Growth CQ'], 0), pct(ge['Career Growth CQ'], 0), pts((N(se['Career Growth CQ']) - N(se['Career Growth CQ LY'])) * 100), N(se['Career Growth CQ']) - N(se['Career Growth CQ LY']) < -0.08 ? 'strong' : N(se['Career Growth CQ']) - N(se['Career Growth CQ LY']) < -0.03 ? 'moderate' : 'weak', 'Qualtrics pulse'],
        ['Manager effectiveness (Q3)', pct(se['Manager Effectiveness CQ'], 0), pct(ge['Manager Effectiveness CQ'], 0), pts((N(se['Manager Effectiveness CQ']) - N(se['Manager Effectiveness CQ LY'])) * 100), N(se['Manager Effectiveness CQ']) - N(se['Manager Effectiveness CQ LY']) < -0.06 ? 'moderate' : 'weak', 'Qualtrics pulse'],
        ['Learning hours per employee (YTD)', N(s['Learning Hours per Employee YTD']).toFixed(0), N(g['Learning Hours per Employee YTD']).toFixed(0), sgn(N(s['Learning Hours per Employee YTD']) - N(s['Learning Hours per Employee PY YTD']), (v) => v.toFixed(0)), N(s['Learning Hours per Employee YTD']) < N(s['Learning Hours per Employee PY YTD']) * 0.85 ? 'moderate' : 'weak', 'SuccessFactors Learning'],
      ].sort((a, b) => ({ strong: 0, moderate: 1, weak: 2 })[a[4]] - ({ strong: 0, moderate: 1, weak: 2 })[b[4]]);
      s3.replaceChildren(
        el('div', { style: 'overflow-x:auto' }, el('table', { class: 'pi-t' }, [el('tr', {}, ['Indicator', 'Segment', 'Comparison', 'Change vs LY', 'Association', 'Source'].map((h, i) => el('th', { class: i && i < 4 ? 'r' : '', text: h }))),
          ...rows.map(([n, v, c, d, a, src]) => el('tr', {}, [el('td', { html: `<b>${esc(n)}</b>` }), el('td', { class: 'r', text: v }), el('td', { class: 'r', text: c }), el('td', { class: 'r', text: d }), el('td', { html: `<span class="assoc ${a}">${a}</span>` }), el('td', { class: 'pi-note', text: src })]))])),
        el('div', { class: 'pi-disclaimer' }, [icon('info'), el('span', { text: 'These indicators moved together with attrition in this population. They are statistical associations from governed data, not proven causes — validate with stay interviews and HRBP insight before acting.' })]),
      );
      // 4 · exposure
      const costPerLeaver = N(s['Replacement Cost Exposure']) / Math.max(1, N(s['Voluntary Leavers LTM']));
      const excess = Math.max(0, (N(s['Voluntary Attrition']) - N(s['Voluntary Attrition PY'])) * N(s.Headcount));
      s4.replaceChildren(el('div', { class: 'pi-big', style: 'grid-template-columns:1fr 1fr' }, [
        el('div', { class: 'hl' }, [el('span', { text: 'Annual exposure above LY rate' }), el('b', { text: gbp(excess * costPerLeaver) }), el('i', { text: `${Math.round(excess)} extra leavers × ${gbp(costPerLeaver)}` })]),
        el('div', {}, [el('span', { text: 'Total replacement exposure' }), el('b', { text: gbp(s['Replacement Cost Exposure']) }), el('i', { text: `${int(s['Voluntary Leavers LTM'])} leavers in 12 months` })]),
        el('div', {}, [el('span', { text: 'Open critical roles' }), el('b', { text: int(rq['Open Critical Roles']) }), el('i', { text: `avg ${int(rq['Average Days Open'])} days open` })]),
        el('div', {}, [el('span', { text: 'Backfill time' }), el('b', { text: `${int(ex['Average Days to Backfill'])} days` }), el('i', { text: `contractor spend ${N(co['Contractor Cost FYTD YoY']) >= 0 ? '+' : ''}${pct(co['Contractor Cost FYTD YoY'], 0)} YoY` })]),
      ]), el('p', { class: 'pi-note', text: 'Replacement cost per leaver = recruitment, onboarding and ramp-up productivity loss (governed Replacement Cost measure ÷ voluntary leavers). Exposure above LY = (current rate − rate a year ago) × headcount × cost per leaver.' }));
      // 5 · interventions
      const iv = [];
      if (rows.find((r) => /compa|pay & benefits|Pay fairness/i.test(r[0]) && r[4] !== 'weak')) iv.push(['Targeted market adjustment for senior & lead engineers', `Bring compa-ratio from ${seniorCompa.toFixed(2)} back towards 1.00 for critical roles; model a 4–8% adjustment.`, 'Compensation']);
      if (rows.find((r) => /career|Promotion/i.test(r[0]) && r[4] !== 'weak')) iv.push(['Career pathways and internal-first hiring', 'Publish technical career ladders; ring-fence open critical roles for internal candidates for 3 weeks.', 'Internal mobility']);
      if (bigTech > 0.2) iv.push(['Critical-skills retention awards', `${pct(bigTech, 0)} of leavers join hyperscalers — time-bound awards for cloud, data and AI specialists.`, 'Retention target']);
      iv.push(['Learning & development investment', 'Fund certifications in cloud, data and AI; learning hours fell in this population.', 'L&D']);
      s5.replaceChildren(
        el('div', { class: 'pi-insights' }, iv.map(([t, d, lever]) => el('div', { class: 'pi-insight opp' }, [el('div', { class: 'tag' }, [el('b', { text: lever })]), el('p', { html: `<b>${esc(t)}</b><br>${esc(d)}` })]))),
        el('div', { class: 'pi-actions-row', style: 'margin-top:14px' }, [
          el('button', { class: 'pi-btn primary', onclick: () => ctx.openSimulator({ ...pop, seniority: tech ? ['Senior', 'Lead & Executive'] : pop.seniority }, 'retention') }, [icon('tune'), el('span', { text: 'Model a retention intervention' })]),
          el('button', { class: 'pi-btn', onclick: () => ctx.actions.openCreate({ name: `${label} Retention Programme`, bu: pop.bu ?? 'Group Functions', country: pop.country ?? 'Group', type: 'Retention', metric: `Voluntary attrition (LTM) in ${label}`, baseline: Number(s['Voluntary Attrition']), target: Number(s['Voluntary Attrition PY']), benefit: Math.round(excess * costPerLeaver), insight: `Critical | ${label} retention risk`, evidence: { page: 'tr', pop } }) }, [icon('add_task'), el('span', { text: 'Create action' })]),
          el('button', { class: 'pi-btn ghost', onclick: () => ctx.assistant.ask(`Compare employee turnover in Germany and the UK`) }, [icon('auto_awesome'), el('span', { text: 'Ask a follow-up' })]),
        ]));
    } catch (e) { s3.replaceChildren(el('p', { class: 'pi-note', text: `Investigation query failed: ${e?.message ?? e}` })); console.warn(e); }
  };
  idle();
  ctx.onPersona(() => { if (current) open(current); });
  return { open };
};
