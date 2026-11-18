/**
 * Role-based access, privacy controls and the capability tour.
 *
 *  - CAPABILITIES: what each persona may see and do (row scope, sensitive attributes, approvals).
 *  - mountPrivacy: the DEI page's privacy-and-sensitive-data panel, with the live suppression rule.
 *  - mountAccess: the role-based access matrix on Data & governance, with a "view as" switch.
 *  - mountCoverage: ten capabilities this app demonstrates, each with a "Show me" that opens the place
 *    (and the persona) that demonstrates it.
 */
export const CLEARED = ['chro', 'rhrd'];
export const CAPABILITIES = [
  ['Row-level data scope', { chro: 'Group · all 15 countries', rhrd: 'UK & Ireland', hrbp: 'UK · Technology', bul: 'Technology · all countries' }],
  ['Workforce, retention, skills, succession analytics', { chro: true, rhrd: true, hrbp: true, bul: true }],
  ['DEI by gender and age (aggregated, n ≥ 10)', { chro: true, rhrd: true, hrbp: true, bul: true }],
  ['Pay by gender', { chro: true, rhrd: true, hrbp: false, bul: false }],
  ['Ethnicity · special-category data (UK only, lawful basis)', { chro: true, rhrd: true, hrbp: false, bul: false }],
  ['Named individuals or person-level risk scores', { chro: false, rhrd: false, hrbp: false, bul: false }],
  ['Self-service report builder, save and share', { chro: true, rhrd: true, hrbp: true, bul: true }],
  ['Excel export (scoped to own access)', { chro: true, rhrd: true, hrbp: true, bul: true }],
  ['Approve people actions', { chro: 'All · ≥ £1m', rhrd: 'Submit only', hrbp: 'Submit only', bul: 'Technology < £1m' }],
  ['Triage data issues', { chro: true, rhrd: true, hrbp: 'View only', bul: 'View only' }],
];

export const mountPrivacy = (ctx, host) => {
  const { el, esc, icon } = ctx;
  const render = () => {
    const cleared = CLEARED.includes(ctx.persona.key);
    host.replaceChildren(
      el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: 'Privacy thresholds and sensitive-data controls · enforced in the semantic layer, not the screen' })]),
      el('div', { class: 'pi-ctrls' }, [
        el('div', {}, [icon('shield'), el('b', { text: 'Minimum group size 10' }), el('small', { html: 'Every DEI measure has a privacy-safe twin: <code>IF([DEI Headcount] &gt;= 10, [measure], NULL)</code>. Any cell, under any filter or drill, with fewer than 10 people comes back blank from the engine, whatever the client.' })]),
        el('div', {}, [icon('lock_person'), el('b', { text: 'Special-category data by role' }), el('small', { text: 'Ethnicity and pay by gender are visible to the Group CHRO and regional HR directors only. HR business partners and business leaders see a locked tile, and the report builder does not offer those measures.' })]),
        el('div', {}, [icon('gavel'), el('b', { text: 'Collected only where lawful' }), el('small', { text: 'Ethnicity is self-declared in the UK only; disability in the UK, Ireland and the Netherlands. Elsewhere the value is "Not collected", never inferred.' })]),
        el('div', {}, [icon('group_off'), el('b', { text: 'No individuals' }), el('small', { text: 'The DEI dataset holds aggregates by country × department × level × gender × age band. No names, IDs or person-level records leave SuccessFactors.' })]),
      ]),
      el('div', { class: `pi-youraccess ${cleared ? 'ok' : 'ltd'}` }, [icon(cleared ? 'verified_user' : 'visibility_off'), el('span', { html: `<b>Viewing as ${esc(ctx.persona.name)}</b> · ${esc(ctx.persona.scopeLabel)} · ${cleared ? 'cleared for special-category DEI data (aggregated, thresholded)' : 'gender and age only. Pay by gender and ethnicity are restricted for this role'}.` }),
        el('button', { class: 'pi-btn sm', onclick: () => ctx.setPersona(cleared ? 'hrbp' : 'chro') }, [icon('switch_account'), el('span', { text: cleared ? 'Try as an HR business partner' : 'Switch to the Group CHRO' })])]),
    );
  };
  render();
  ctx.onPersonaNow(render);
};

export const mountAccess = (ctx, grid) => {
  const { el, esc, icon } = ctx;
  const card = el('figure', { class: 'pi-card span-12' });
  grid.prepend(card);
  const cell = (v) => (v === true ? el('td', { class: 'c ok' }, icon('check_circle')) : v === false ? el('td', { class: 'c no' }, icon('block')) : el('td', { class: 'c', text: v }));
  const render = () => {
    const ps = Object.values(ctx.personas);
    card.replaceChildren(
      el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: 'Role-based access control · one app and one link, four different views of the data' }), el('div', { class: 'tools' }, el('span', { class: 'pi-note', text: 'Click a persona to view the app as them' }))]),
      el('div', { style: 'overflow-x:auto' }, el('table', { class: 'pi-t pi-rbac' }, [
        el('tr', {}, [el('th', { text: 'Capability' }), ...ps.map((p) => el('th', { class: p.key === ctx.persona.key ? 'sel' : '' }, el('button', { class: 'pi-rbac-p', onclick: () => ctx.setPersona(p.key) }, [el('span', { class: 'pi-avatar', text: p.initials }), el('span', { html: `<b>${esc(p.name)}</b><small>${esc(p.role)}</small>` })])))]),
        ...CAPABILITIES.map(([label, v]) => el('tr', {}, [el('td', { html: `<b>${esc(label)}</b>` }), ...ps.map((p) => { const c = cell(v[p.key]); if (p.key === ctx.persona.key) c.classList.add('sel'); return c; })])),
      ])),
      el('p', { class: 'pi-note', style: 'margin:10px 0 0', html: 'How it is enforced: the persona’s row scope is a static filter on every native object and every governed query (the same link shows Sarah 84,936 employees and Hannah 2,363). Sensitive tiles are not mounted for roles without clearance, so their data is never queried. In production the identity comes from corporate SSO (Entra ID / SAML) mapped to Astrato groups, and row access policies are inherited from the warehouse.' }),
    );
  };
  render();
  ctx.onPersonaNow(render);
};

export const CAPABILITY_TOUR = [
  ['An executive home: headcount, movement and the KPIs leadership reads first.', 'My People Home for Sarah Mitchell (Group CHRO): four KPI cards with trend and vs-LY, a business-unit scorecard across every source, hotspots and attrition trends. Workforce Explorer adds hires, leavers and net movement by month, a map, an org drill-down and the monthly people report.', [['home', 'chro', 'My People Home'], ['wx', 'chro', 'Workforce Explorer']]],
  ['Attrition cut by any organisational or employee attribute, with drill-down.', 'Talent & Retention: an attrition chart that switches between region, country, function, business unit, department, level, career track and employment type, and between voluntary, regretted, high-performer and critical-role attrition, with drill-down. Also an age × gender segment view (privacy-safe), a risk matrix, an acceleration heatmap, exit reasons and destinations, and the five-step investigation.', [['tr', 'chro', 'Talent & Retention']]],
  ['Diversity reporting that suppresses small groups and locks sensitive fields by role.', 'Diversity & Inclusion: representation, leadership, pay gap, hiring, attrition and declaration KPIs; the leaky pipeline; attrition and promotion equity. Any cell under 10 people is blanked by the semantic layer (see the drill table). Ethnicity and pay by gender are locked for roles without clearance.', [['dei', 'chro', 'As the Group CHRO'], ['dei', 'hrbp', 'As an HR business partner']]],
  ['A planning scenario: future demand, restructuring and its cost, raised for approval.', 'Workforce Simulator → Demand & restructuring plan: FY28 demand by function, absorption through attrition, redeployment before exit, a headcount bridge, cost, run-rate and payback, then raise the plan for approval. Retention intervention modelling sits alongside it.', [['sim:plan', 'chro', 'Demand & restructuring plan']]],
  ['Skills coverage today, the gap to future-critical skills, and how to close it.', 'Skills & Future Workforce: skills coverage heatmap, 2028 capability gap, coverage vs a year ago, the adjacency explorer (which current skills reskill into future-critical ones), build · buy · borrow economics and the recruiting report.', [['sk', 'chro', 'Skills & Future Workforce']]],
  ['Succession coverage and key-person risk for critical roles.', 'Talent & Succession Risk: critical roles, ready-now coverage vs LY, uncovered at-risk roles, the key-person risk × impact matrix, successor pipeline, coverage by country × unit, diverse succession and a role-level register (roles, never names). Flight-risk cohorts are on Talent & Retention.', [['suc', 'chro', 'Talent & Succession Risk']]],
  ['Self-service reports for a scoped business-partner persona.', 'Custom report (Astrato’s Custom Report experience) as Hannah Clarke (HRBP, UK Technology): click governed dimensions and measures from grouped lists, drag chips to reorder, switch between table, pivot, bar, scatter and heat map, sort and filter each field, then save as a bookmark, share a link that opens in the recipient’s own scope, or export to Excel. Sensitive measures are not offered to her role.', [['rb', 'hrbp', 'Custom report as Hannah']]],
  ['Pipeline health: freshness per feed, failed runs and a triage queue for data issues.', 'Data operations: refresh status per source feed, clean-run rate, failures, SLA and rows loaded; the integration status board; runs by outcome; the error log with engine detail; and a triage queue (acknowledge, reassign, escalate, resolve) with an audit trail written back to the warehouse. My People Home shows a data-status banner.', [['ops', 'chro', 'Data operations']]],
  ['One link, several roles: row scope, locked tiles and approval rights.', 'Four personas on one link: the row scope filters every object and query (84,936 → 2,363 employees), sensitive tiles lock, approval rights differ, and the report builder adapts. The access matrix on Data & governance shows all of it, and you can switch persona from there.', [['gov', 'chro', 'Access matrix'], ['home', 'hrbp', 'Home as Hannah']]],
  ['An assistant that answers only from stored business questions and shows its working.', 'Ask People Intelligence answers only from stored, governed business questions and shows the question, measure definition, sources and scope behind each answer. The home briefing, the “explain” panel, and the five-step investigation cite the governed numbers they use.', [['home', 'chro', 'Open the assistant', 'ask']]],
];

export const mountCoverage = (ctx, grid) => {
  const { el, esc, icon } = ctx;
  const show = ([page, persona, , extra]) => {
    if (persona && persona !== ctx.persona.key) ctx.setPersona(persona);
    const [p, mode] = page.split(':');
    ctx.go(p);
    if (mode) ctx.simMode?.(mode);
    if (extra === 'ask') setTimeout(() => ctx.assistant.ask('What should I focus on today?'), 400);
  };
  grid.append(el('figure', { class: 'pi-card span-12' }, [
    el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: 'Capability tour · where each one is shown' })]),
    el('p', { class: 'pi-note', style: 'margin:0 0 12px', text: 'Each “Show me” opens the page and switches to the persona that demonstrates it. Everything is live on the governed semantic layer, with illustrative data.' }),
    el('div', { class: 'pi-reqs' }, CAPABILITY_TOUR.map(([req, how, links], i) => el('div', { class: 'pi-req' }, [
      el('div', { class: 'n', text: String(i + 1) }),
      el('div', {}, [el('b', { text: req }), el('p', { text: how }), el('div', { class: 'pi-actions-row' }, links.map((l) => el('button', { class: 'pi-btn sm', onclick: () => show(l) }, [icon('play_circle'), el('span', { text: l[2] })])))]),
      el('span', { class: 'ok' }, icon('check_circle')),
    ]))),
  ]));
};
