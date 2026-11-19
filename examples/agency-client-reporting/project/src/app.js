/**
 * Tidewater Media – Client Reporting (mock data). Monthly reporting for a digital-marketing agency's
 * clients from four mocked source systems — Google Ads, Meta Ads Manager, GA4 and Google Search
 * Console — joined through shared Clients, Channels and Months tables in one Astrato semantic layer.
 * The difference from a connector dashboard: every change is explained. Driver bridges in the layer
 * split each month-on-month change into reach, click-through and conversion-rate effects that add up
 * exactly, and the app turns them into plain English. Tabs: Agency portfolio, Client performance,
 * Why it changed, Paid media, SEO & web, Ask Nash (mock-up), Budget planner, Client reports
 * (workflow + email). Excel export in the header.
 */
import { createAstratoApp } from '@astrato-io/app-runtime';
import { createVisualizationRuntime, registry } from '@astrato-io/visualizations';
import { createVisualizationAvailableFields } from '@astrato-io/visualizations/definitions';
import { throttleQueries } from './throttle.js';
import { appState } from './app-state.js';
import { buildTiles, buildTile, compileTiles, compileDefinition, KPIS, ctlId, nashTile } from './dashboard.js';
import { createFieldIndex } from './fields.js';
import { mountWorkflows, workflowState } from './workflow.js';
import { themeVSpec } from './theme.js';
import { workbookBlob } from './xlsx.js';
import { mountSheetView } from './sheetview.js';
import { loadFacts, explain, commentaryOf, anomaliesOf } from './explain.js';

const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v; else if (k === 'text') node.textContent = v; else if (k === 'html') node.innerHTML = v; else if (k.startsWith('on')) node.addEventListener(k.slice(2), v); else node.setAttribute(k, v);
  }
  for (const c of [].concat(children)) if (c != null) node.append(c);
  return node;
};
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const AD = 'Ads', WV = 'Web', SV = 'SEO', CL = 'Clients', CH = 'Channels', MV = 'Months';
const FOCUS = 'Glow & Co Skincare';
const PAGES = [
  ['pf', 'Agency portfolio', 'September 2026 across all eight clients, against August. Spend and conversions from Google Ads and Meta Ads Manager, sessions from GA4, rankings from Search Console — joined through shared Clients, Channels and Months tables in one governed Astrato semantic layer. Click a client anywhere to filter the page.',
    [ctlId('g-pf', CL, 'Account Manager'), ctlId('g-pf', CL, 'Sector'), ctlId('g-pf', CL, 'Business Model'), ctlId('g-pf', CH, 'Platform')], ['pf-spend', 'pf-val', 'pf-roas', 'pf-cpa', 'pf-conv', 'pf-sess', 'pf-org', 'pf-pos'],
    [['pf-score', 'full'], ['pf-move', 'half'], ['pf-mix', 'half'], ['pf-trend', 'half'], ['pf-roasln', 'half']]],
  ['cl', 'Client performance', 'One client, every source. This is the page the client sees — pick a client in the filter bar.',
    [ctlId('g-cl', CL, 'Client'), ctlId('g-cl', CH, 'Channel Group'), ctlId('g-cl', CH, 'Platform'), ctlId('g-cl', CH, 'Channel')], ['cl-spend', 'cl-val', 'cl-roas', 'cl-cpa', 'cl-conv', 'cl-rev', 'cl-org', 'cl-eng'],
    [['cl-trend', 'half'], ['cl-chan', 'half'], ['cl-web', 'half'], ['cl-orgln', 'half'], ['cl-camp', 'full']]],
  ['dr', 'Why it changed', 'Every change, explained. Conversions = impressions × click-through rate × conversion rate, so the month-on-month change splits exactly into a reach effect, a CTR effect and a conversion-rate effect — per channel, per campaign, per keyword group. The bars add up to the change; the narrative reads them for you.',
    [ctlId('g-dr', CL, 'Client'), ctlId('g-dr', CH, 'Channel Group'), ctlId('g-dr', CH, 'Channel')], ['dr-conv', 'dr-val', 'dr-spend', 'dr-org'],
    [['dr-cb', 'half'], ['dr-vb', 'half'], ['dr-sb', 'half'], ['dr-ob', 'half'], ['dr-camp', 'full'], ['dr-kb', 'half'], ['dr-seo', 'half'], ['dr-yoy', 'full']]],
  ['pm', 'Paid media', 'Google Ads and Meta Ads Manager side by side: the full funnel from impressions to ROAS, by channel, campaign type and campaign.',
    [ctlId('g-pm', CL, 'Client'), ctlId('g-pm', CH, 'Platform'), ctlId('g-pm', AD, 'Campaign Type'), ctlId('g-pm', CH, 'Channel')], ['ls-imp', 'ls-ctr', 'ls-cpc', 'ls-cpm', 'ls-cvr', 'ls-roas'],
    [['ls-cpcln', 'half'], ['ls-ctrln', 'half'], ['ls-type', 'half'], ['ls-cpa', 'half'], ['ls-table', 'full tall']]],
  ['seo', 'SEO & web', 'Organic visibility from Search Console and rank tracking, and what visitors do on site from GA4.',
    [ctlId('g-seo', CL, 'Client'), ctlId('g-seo', SV, 'Keyword Group'), ctlId('g-seo', WV, 'Device'), ctlId('g-seo', CH, 'Channel Group')], ['s-clk', 's-imp', 's-ctr', 's-pos', 's-top', 's-sess', 's-eng', 's-scr'],
    [['s-posln', 'half'], ['s-dev', 'half'], ['s-table', 'full'], ['s-chan', 'half'], ['s-scrc', 'half']]],
  ['nash', 'Ask Nash', 'Mock-up of Nash, Astrato’s AI agent, answering account managers in plain English. Every number in an answer comes from a governed query on the same semantic layer; every chart is a native Astrato object.', [], [], []],
  ['wi', 'Budget planner', 'Plan Q4 for one client: move budget between channels and test efficiency assumptions. September actuals come from the governed layer; Oct–Dec are projected at the September run-rate with diminishing returns on extra spend.', [], [], []],
  ['ig', 'Infographic', '', [], [], []],
  ['xl', 'Report (Excel view)', 'The client report exactly as the Excel pack lays it out — sheets, gridlines, number formats — rendered live from the governed layer. Pick a client, flick between sheets, download the real .xlsx.', [], [], []],
  ['wf', 'Client reports', 'The monthly reporting run: check the data, explain anomalies, edit the Nash-drafted commentary, get sign-off and send the client their report with the Excel pack. Maker–checker with a full audit trail (mock).', [], [], []],
];
const SOURCES = [['Google Ads', 'Search · PMax'], ['Meta Ads', 'Prospecting · Retargeting'], ['GA4', 'Sessions · key events'], ['Search Console', 'Clicks · rankings']];
const GROUPS = ['g-pf', 'g-cl', 'g-dr', 'g-pm', 'g-seo', 'g-ig'];

const main = async () => {
  window.__boot = 'start';
  const app = await createAstratoApp();
  throttleQueries(app.client.hostServices);
  const { engine, selections } = app.client.hostServices;
  window.__sel = selections; window.__engine = engine;
  const appliedIn = {}; // group -> its applied selections, which the Excel pack passes to its queries
  for (const g of [...GROUPS, 'g-nash']) {
    let timer;
    selections.onActiveSelectionChange(g).subscribe((next) => {
      appliedIn[g] = next.applied ?? [];
      clearTimeout(timer);
      if (next.pending.length > 0) timer = setTimeout(() => selections.applyPendingSelections(g), 250);
    });
  }
  const metadata = await engine.fields.getFieldMetadata({ ...app.dataBinding });
  const runtime = createVisualizationRuntime({ client: app.client, registry });
  const availableFields = createVisualizationAvailableFields(metadata).filter((f) => f?.resultType !== 'unhandled');
  appState.fields(availableFields);
  const dataBinding = { ...app.dataBinding };
  const fields = createFieldIndex(availableFields);
  window.__af = availableFields; window.__fields = fields;
  const built = buildTiles(fields);
  const compiled = await compileTiles(built.tiles, availableFields);
  const failures = [...built.failures, ...compiled.failures];
  if (failures.length) console.warn('[tiles]', JSON.stringify(failures));
  const tiles = new Map();
  await Promise.all(compiled.compiled.map(async (t) => {
    const themed = await themeVSpec({ id: t.id, type: t.type, vSpec: t.vSpec, dataBinding }, availableFields, t);
    tiles.set(t.id, { ...t, vSpec: themed.vSpec });
  }));
  window.__boot = 'themed';
  const T0 = performance.now();
  window.__astrato = { tiles: [...tiles.values()].map((t) => ({ id: t.id })), failures, mounted: new Map(), timings: {} };
  const mark = (id, render, error) => window.__astrato.mounted.set(id, { id, render, ...(error ? { error } : {}) });

  // Governed queries for the narratives, Nash, the planner, the workflow and the Excel pack.
  // `filters` are engine filters (see filtersOf below); without them a query covers every client.
  const LIMIT = 2000;
  const q = async ({ dims = [], measures = [], limit = LIMIT, filters = [] }) => {
    const dimensions = dims.map(([name, view]) => ({ fieldKey: fields.raw(name, view).fieldKey, name }));
    const calculations = measures.map((name) => ({ calculation: '{m1}', itemKey: fields.measure(name).fieldKey, label: name }));
    const query = { dimensions, calculations, orders: [], limit, offset: 0, filters, totals: false, showRecordsCount: false, outerViews: [], associativeListFilter: null };
    const { response } = await engine.getData({ ...dataBinding, query });
    const names = [...dimensions.map((d) => d.name), ...measures];
    return Object.values(response?.data ?? {}).map((row) => Object.fromEntries(names.map((n, i) => [n, row[i]])));
  };
  let factsP = null;
  const facts = () => (factsP ??= loadFacts(q));

  // The client pages open on the client with a story to tell.
  const clientKey = fields.raw('Client', CL).fieldKey;
  const selectionOf = (fieldKey, values) => ({ field: { fieldKey }, fieldKey, kind: 'VALUE', operator: 'inList', values });
  for (const g of ['g-cl', 'g-dr', 'g-ig']) selections.selectValues(g, selectionOf(clientKey, [FOCUS]), { state: 'applied' });

  const root = document.getElementById('root');
  const tabs = el('nav', { class: 'ob-tabs' });
  const body = el('div', { class: 'ob-body' });
  const exportBtn = el('button', { class: 'kx-export', text: '⬇ Excel pack' });
  const mailBtn = el('button', { class: 'kx-export ag-mail', text: '✉ Client reports', onclick: () => show('wf') });
  root.replaceChildren(el('header', { class: 'ob-head' }, [
    el('div', { class: 'wf-mark', html: 'tidewater<i></i><small>media</small>' }),
    el('div', { class: 'wf-titles' }, [el('h1', { text: 'Client Reporting' }), el('p', { text: '8 clients · September 2026 · Google, Meta, GA4 & SEO in one governed layer · mock data' })]),
    el('div', { class: 'kx-src' }, SOURCES.map(([n, d]) => el('span', {}, [el('b', { text: n }), el('i', { text: d })]))),
    exportBtn, mailBtn,
  ]), tabs, body);

  const mountQueue = [];
  const slotFor = (id) => { const s = el('div', { class: 'ob-viz', 'data-slot': id }); mountQueue.push([id, s]); return s; };
  const card = (id, cls) => {
    const t = tiles.get(id);
    return el('figure', { class: `ob-card ${cls}` }, [el('figcaption', {}, [el('span', { text: t?.title ?? id })]), t ? slotFor(id) : el('p', { text: 'Not available' })]);
  };
  const kpi = (id) => el('figure', { class: 'ob-card ob-kpi kx-kpi' }, [
    el('figcaption', {}, [el('span', { text: KPIS[id]?.label ?? id }), KPIS[id]?.src ? el('em', { text: KPIS[id].src }) : null]),
    el('div', { class: 'kx-kpi-row' }, [el('div', { class: 'kx-kpi-num' }, tiles.has(id) ? slotFor(id) : null), el('div', { class: 'kx-kpi-spark' }, tiles.has(`${id}-sp`) ? slotFor(`${id}-sp`) : null)]),
    el('div', { class: 'kx-kpi-delta' }, tiles.has(`${id}-d`) ? slotFor(`${id}-d`) : null),
  ]);

  const panes = {};
  for (const [key, label, intro, controls, kpis, charts] of PAGES) {
    const pane = el('section', { class: 'ob-pane', 'data-page': key });
    const bar = el('div', { class: 'ob-filters' }, controls.map((c) => card(c, 'ob-filter')));
    const krow = el('div', { class: 'ob-kpis kx-kpis' }, kpis.map(kpi));
    const grid = el('div', { class: 'ob-grid' }, charts.map(([c, cls]) => card(c, cls)));
    pane.append(el('p', { class: 'ob-intro', text: intro }), ...(controls.length ? [bar] : []), ...(kpis.length ? [krow] : []), grid);
    panes[key] = { pane, grid, krow };
    body.append(pane);
    tabs.append(el('button', { 'data-page': key, text: label, onclick: () => show(key) }));
  }
  let current = null;
  const show = (key) => {
    current = key;
    for (const [k, p] of Object.entries(panes)) p.pane.hidden = k !== key;
    for (const b of tabs.children) b.classList.toggle('on', b.dataset.page === key);
  };
  show(new URLSearchParams(location.search).get('tab') ?? 'pf');
  document.getElementById('splash')?.remove();

  // ------------------------------------------------------------------ infographic one-pager
  const ig = panes.ig.grid;
  ig.className = 'ig-wrap';
  panes.ig.pane.querySelector('.ob-intro')?.remove();
  const igSlot = (id) => (tiles.has(id) ? slotFor(id) : el('p', { text: 'Not available' }));
  const igPick = el('select', { class: 'ig-pick' });
  const ICONS = ['🔍', '📣', '📈', '🛒'];
  ig.append(el('article', { class: 'ig-page' }, [
    el('header', { class: 'ig-hero' }, [
      el('div', { class: 'ig-blurb', html: '<p>This one-pager summarises September for the client: how the business grew across Google, Meta and organic search, where revenue came from, what moved and why, and the plan for next month.</p>' }),
      el('div', { class: 'ig-band' }, [el('small', { text: 'TIDEWATER MEDIA · CLIENT REPORT · SEPTEMBER 2026' }), el('h2', { class: 'ig-name', text: FOCUS }), el('label', { class: 'ig-switch' }, ['Client ', igPick])]),
    ]),
    el('section', { class: 'ig-about' }, [el('h3', { text: 'About the account' }), el('p', { class: 'ig-about-t', text: '…' })]),
    el('section', { class: 'ig-kpis' }, ['ig-val', 'ig-roas', 'ig-conv', 'ig-org'].map(kpi)),
    el('section', { class: 'ig-block' }, [el('h3', { text: 'Client growth · Jan–Sep conversion value, 2026 vs 2025' }), el('div', { class: 'ig-viz ig-growth' }, igSlot('ig-growth'))]),
    el('div', { class: 'ig-two' }, [
      el('section', { class: 'ig-block' }, [el('h3', { class: 'ig-bar', text: 'Revenue by channel' }), el('div', { class: 'ig-viz ig-tab' }, igSlot('ig-rev'))]),
      el('section', { class: 'ig-block' }, [el('h3', { class: 'ig-bar', text: 'Revenue by source' }), el('div', { class: 'ig-viz' }, igSlot('ig-mix'))]),
    ]),
    el('div', { class: 'ig-two' }, [
      el('section', { class: 'ig-block' }, [el('h3', { class: 'ig-bar', text: 'Insights' }), el('ul', { class: 'ig-ins' }, el('li', { text: 'Reading the driver bridges…' }))]),
      el('section', { class: 'ig-block' }, [el('h3', { class: 'ig-bar', text: 'Paid media growth' }), el('div', { class: 'ig-viz ig-tab' }, igSlot('ig-social'))]),
    ]),
    el('section', { class: 'ig-strat' }, [el('h3', { text: 'Growth strategies for October' }), el('div', { class: 'ig-cols' })]),
    el('footer', { class: 'ig-foot', text: 'Google Ads · Meta Ads · GA4 · Search Console · one governed Astrato semantic layer · mock data' }),
  ]));
  const renderIg = async (client) => {
    const F = await facts();
    if (!igPick.options.length) igPick.replaceChildren(...F.clients.map((n) => el('option', { text: n, ...(n === client ? { selected: '' } : {}) })));
    const e = explain(F, client), c = e.client ?? {};
    ig.querySelector('.ig-name').textContent = client;
    ig.querySelector('.ig-about-t').textContent = `${client} is a ${c.Sector} ${c['Business Model'] === 'Lead gen' ? 'lead-generation' : 'e-commerce'} client, managed by ${c['Account Manager']}. Tidewater runs paid search (Google Search and Performance Max), paid social (Meta prospecting and retargeting) and SEO. In September £${Math.round(Number(c['Spend This Month'])).toLocaleString('en-GB')} of media spend returned £${Math.round(Number(c['Conversion Value This Month'])).toLocaleString('en-GB')} in conversion value (${Number(c['ROAS This Month']).toFixed(2)}x ROAS).`;
    ig.querySelector('.ig-ins').replaceChildren(...[e.headline, ...e.bullets].slice(0, 5).map((b) => el('li', { text: b })));
    const heads = ['Paid search', 'Paid social', 'SEO & content', 'Website & CRO'];
    const RX = [/Google|Performance/, /Meta/, /SEO|rank/, /mobile|landing|checkout|on-site/i];
    const fallback = ['Hold Google Search and PMax targets and test fresh ad copy.', 'Keep two new creative concepts live each fortnight.', 'Publish two new comparison pages and refresh internal links.', 'A/B test the hero offer and shorten forms on mobile.'];
    ig.querySelector('.ig-cols').replaceChildren(...heads.map((h, i) => el('div', { class: 'ig-col' }, [el('h4', { text: h }), el('p', { text: e.actions.find((a) => RX[i].test(a)) ?? fallback[i] }), el('div', { class: 'ig-dot' }, [el('b', { text: `0${i + 1}` }), el('span', { text: ICONS[i] })])])));
  };
  igPick.onchange = () => selections.selectValues('g-ig', selectionOf(clientKey, [igPick.value]), { state: 'applied' });
  selections.onActiveSelectionChange('g-ig').subscribe((next) => {
    const s = next.applied.find((x) => x.field?.fieldKey === clientKey || x.fieldKey === clientKey);
    if (s?.values?.length === 1) renderIg(String(s.values[0])).catch((err) => console.warn('[ig]', err));
  });

  // ------------------------------------------------------------------ "what changed and why" narrative
  const story = el('figure', { class: 'ob-card full mx-story' }, [el('figcaption', { text: 'What changed and why · read from the driver bridges below' }), el('div', { class: 'mx-story-body', text: 'Reading the driver bridges…' })]);
  panes.dr.grid.prepend(story);
  const renderStory = async (client) => {
    const F = await facts();
    const out = story.querySelector('.mx-story-body');
    if (!client) { out.innerHTML = '<p class="wf-note">Pick one client in the filter bar to read the explanation.</p>'; return; }
    const e = explain(F, client);
    out.innerHTML = `<p class="mx-head">${esc(e.headline)}</p><div class="mx-cols"><div><h4>What drove it</h4><ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul></div><div><h4>Recommended next steps</h4><ol>${e.actions.map((a) => `<li>${esc(a)}</li>`).join('')}</ol></div></div>
      <div class="wf-wfbar" style="margin:10px 0 0"><button class="wf-btn" data-use>Use as report commentary</button><button class="wf-btn ghost" data-ask>Ask Nash a follow-up</button><span class="wf-note">Numbers: governed measures “Conversions … Effect MoM”, “Average Position …”, “Key Events Rate Effect MoM”.</span></div>`;
    out.querySelector('[data-use]').onclick = () => { wf.useCommentary(client, commentaryOf(F, client)); show('wf'); };
    out.querySelector('[data-ask]').onclick = () => { show('nash'); askNash(`Why did ${client}’s conversions change in September?`); };
  };
  selections.onActiveSelectionChange('g-dr').subscribe((next) => {
    const s = next.applied.find((x) => x.field?.fieldKey === clientKey || x.fieldKey === clientKey);
    renderStory(s?.values?.length === 1 ? String(s.values[0]) : null).catch((err) => console.warn('[story]', err));
  });

  // ------------------------------------------------------------------ mount native objects
  const mountOne = (id, slot) => {
    const t = tiles.get(id);
    if (!t) return null;
    runtime.createInstance({ id, type: t.type, groupId: t.group, vSpec: t.vSpec, dataBinding });
    return runtime.mount(slot, id).then((h) => h.ready)
      .then((r) => { mark(id, r?.status); appState.settle(id, r?.status, r); })
      .catch((e) => { mark(id, 'error', String(e)); appState.settle(id, 'error', e); });
  };
  // Every object is announced before it mounts, on the tab that shows it (null = no tab: none here).
  const pageOf = (slot) => slot.closest('.ob-pane')?.dataset.page ?? null;
  for (const [id, slot] of mountQueue) if (tiles.has(id)) appState.declare(id, pageOf(slot));
  const first = new URLSearchParams(location.search).get('tab') ?? 'pf';
  const isHero = ([id]) => tiles.get(id)?.group === `g-${first}`;
  Promise.all(mountQueue.filter(isHero).map(([id, slot]) => mountOne(id, slot))).then(async () => {
    window.__astrato.timings['hero-ready'] = Math.round(performance.now() - T0);
    appState.mark('landing-ready');
    await Promise.all(mountQueue.filter((e) => !isHero(e)).map(([id, slot]) => mountOne(id, slot)));
    window.__astrato.timings['all-mounted'] = Math.round(performance.now() - T0);
  });

  // KPI numbers and their one-row vs-last-month tables follow selections on their own on 0.9
  // (checked by the selection checks below), so the old static-filter mirror is gone.

  /** Mount an ad-hoc native object (Nash answers). */
  let adhoc = 0;
  const mountAdhoc = async (raw, slot) => {
    const id = `${raw.id}-${++adhoc}`;
    const out = buildTile({ ...raw, id, slot: id }, fields);
    if (out.failure) { slot.textContent = out.failure.reason; return; }
    const c = await compileDefinition(out.tile.type, out.tile.definition, availableFields);
    const themed = await themeVSpec({ id, type: out.tile.type, vSpec: c.vSpec, dataBinding }, availableFields, { ...out.tile, ...c });
    runtime.createInstance({ id, type: out.tile.type, groupId: 'g-nash', vSpec: themed.vSpec, dataBinding });
    appState.declare(id, 'nash');
    return runtime.mount(slot, id).then((h) => h.ready)
      .then((r) => { mark(id, r?.status); appState.settle(id, r?.status, r); return r?.status; })
      .catch((e) => { mark(id, 'error', String(e)); appState.settle(id, 'error', e); return 'error'; });
  };

  // ------------------------------------------------------------------ Ask Nash (mock-up)
  const chat = el('div', { class: 'mx-chat' });
  const input = el('input', { class: 'mx-ask', placeholder: 'Ask about any client, channel or month…' });
  const PROMPTS = [
    ['why', `Why did ${FOCUS}’s conversions drop in September?`],
    ['attention', 'Which clients need attention this month?'],
    ['summary', 'Draft the September summary for Harbour Dental Group'],
    ['budget', 'Where should Peak Outdoor Gear put an extra £5k next month?'],
  ];
  const chips = el('div', { class: 'mx-chips' }, PROMPTS.map(([, p]) => el('button', { text: p, onclick: () => askNash(p) })));
  panes.nash.grid.append(el('figure', { class: 'ob-card full mx-nash' }, [
    el('figcaption', {}, [el('span', { html: '<b class="mx-nash-badge">✦ Nash</b> Ask the agency’s data' }), el('em', { text: 'Mock-up · answers computed live from the governed layer' })]),
    chat, chips,
    el('form', { class: 'mx-form', onsubmit: (e) => { e.preventDefault(); if (input.value.trim()) { askNash(input.value.trim()); input.value = ''; } } }, [input, el('button', { class: 'wf-btn', text: 'Ask' })]),
  ]));
  const bubble = (who, html) => { const b = el('div', { class: `mx-msg ${who}`, html }); chat.append(b); chat.scrollTop = chat.scrollHeight; return b; };
  const route = (text) => {
    const t = text.toLowerCase();
    const client = (factsCache?.clients ?? []).find((c) => t.includes(c.toLowerCase().split(' ')[0].replace('&', '').trim()) || t.includes(c.toLowerCase()));
    if (/budget|£|spend more|extra|invest|allocate/.test(t)) return ['budget', client ?? 'Peak Outdoor Gear'];
    if (/summary|draft|write|commentary|report/.test(t)) return ['summary', client ?? 'Harbour Dental Group'];
    if (/attention|worst|risk|which clients|who needs|flag/.test(t)) return ['attention', null];
    if (/why|drop|fell|change|decline|down|up/.test(t) || client) return ['why', client ?? FOCUS];
    return ['unknown', null];
  };
  let factsCache = null;
  const askNash = async (text) => {
    bubble('user', esc(text));
    const F = (factsCache = await facts());
    const [kind, client] = route(text);
    const think = bubble('nash thinking', '<div class="mx-steps"></div>');
    const steps = think.querySelector('.mx-steps');
    const step = async (label, detail) => { steps.append(el('div', { html: `<b>◆ ${esc(label)}</b> <span>${esc(detail)}</span>` })); chat.scrollTop = chat.scrollHeight; await sleep(450); };
    if (kind === 'unknown') {
      await step('astrato_semantic_layer_search', '“Tidewater Media – Client Performance”');
      think.classList.remove('thinking');
      think.innerHTML = `<p>In the live product I’d answer this from the semantic layer (208 governed measures across Google Ads, Meta, GA4 and Search Console). In this mock-up, try one of the suggested questions — or ask “why” about any client.</p>`;
      return;
    }
    await step('astrato_semantic_layer_search', kind === 'budget' ? 'ROAS, CPA, Conversions, Spend by Channel' : kind === 'attention' ? 'Conversion Value MoM, ROAS MoM, anomalies by Client' : 'Conversions … Effect MoM (reach / CTR / CVR), Average Position, Key Events Rate Effect');
    await step('astrato_data_prepare_query', `scope: semantic · ${client ? `Client = ${client}` : 'all clients'} · Month Bucket = This month vs Last month`);
    await step('astrato_data_execute_query', `${F.byChan.length + F.byKw.length + F.byDev.length} governed rows · SQL compiled by the Astrato engine`);
    think.classList.remove('thinking');
    const chartSlot = el('div', { class: 'ob-viz mx-chart' });
    let html = '';
    if (kind === 'why' || kind === 'summary') {
      const e = explain(F, client);
      html = kind === 'why'
        ? `<p><b>${esc(e.headline)}</b></p><ul>${e.bullets.map((b) => `<li>${esc(b)}</li>`).join('')}</ul><p><b>What I’d do:</b></p><ol>${e.actions.map((a) => `<li>${esc(a)}</li>`).join('')}</ol>`
        : `<p>Here’s a draft for <b>${esc(client)}</b> — written from the driver bridges, ready for the account manager to edit:</p><pre class="mx-draft">${esc(commentaryOf(F, client))}</pre><button class="wf-btn" data-use>Insert into ${esc(client)} report</button>`;
    } else if (kind === 'attention') {
      const rows = F.byClient.map((r) => ({ c: r.Client, am: r['Account Manager'], v: Number(r['Conversion Value MoM']), r0: Number(r['ROAS Last Month']), r1: Number(r['ROAS This Month']), a: anomaliesOf(F, r.Client) }))
        .sort((x, y) => x.v - y.v);
      const bad = rows.filter((r) => r.v < -0.05 || r.a.some((a) => a.sev === 'High'));
      html = `<p><b>${bad.length} clients need attention this month</b>, worst first:</p><ol>${bad.map((r) => `<li><b>${esc(r.c)}</b> (${esc(r.am)}) — conversion value ${(r.v * 100).toFixed(1)}% MoM, ROAS ${r.r0.toFixed(2)}x → ${r.r1.toFixed(2)}x${r.a.length ? `; flagged: ${r.a.map((a) => esc(a.what)).join('; ')}` : ''}.</li>`).join('')}</ol><p>Best performer: <b>${esc(rows[rows.length - 1].c)}</b> (${(rows[rows.length - 1].v * 100).toFixed(1)}% MoM).</p>`;
    } else if (kind === 'budget') {
      const ch = F.byChan.filter((r) => r.Client === client).map((r) => ({ ch: r.Channel, roas: Number(r['ROAS This Month']), spend: Number(r['Spend This Month']) })).sort((a, b) => b.roas - a.roas);
      // Marginal ROAS ≈ 0.8 × average ROAS (diminishing returns on extra spend).
      const best = ch[0], second = ch[1];
      const split = [[best, 3000], [second, 2000]];
      const extra = split.reduce((s, [c, gbp]) => s + gbp * c.roas * 0.8, 0);
      html = `<p>For <b>${esc(client)}</b>, September ROAS by channel: ${ch.map((c) => `${esc(c.ch)} <b>${c.roas.toFixed(2)}x</b>`).join(' · ')}.</p><p>I’d put <b>£3,000 into ${esc(best.ch)}</b> and <b>£2,000 into ${esc(second.ch)}</b>. Allowing for diminishing returns (marginal ROAS ≈ 80% of average), that’s roughly <b>£${Math.round(extra).toLocaleString('en-GB')}</b> of extra conversion value (${(extra / 5000).toFixed(2)}x on the £5k).</p><p class="wf-note">Try it yourself in the Budget planner tab.</p>`;
    }
    think.innerHTML = html;
    think.append(chartSlot);
    const use = think.querySelector('[data-use]');
    if (use) use.onclick = () => { wf.useCommentary(client, commentaryOf(F, client)); show('wf'); };
    chat.scrollTop = chat.scrollHeight;
    return mountAdhoc(nashTile(kind, `nash-${kind}`, kind === 'attention' ? null : client), chartSlot);
  };
  window.__askNash = askNash;
  bubble('nash', `<p>Hi — I’m <b>Nash</b>. I can see every client’s Google Ads, Meta, GA4 and Search Console data through Tidewater’s governed semantic layer. Ask me why something changed, who needs attention, or to draft a client summary.</p>`);

  // ------------------------------------------------------------------ Budget planner (what-if)
  const wiHost = panes.wi.grid;
  const ZERO = { gs: 0, pmax: 0, meta: 0, cpc: 0, cvr: 0, seo: 0 };
  const plan = { client: FOCUS, levers: { ...ZERO }, base: null };
  const LEVERS = [
    ['gs', 'Google Search budget', -50, 100, 5, '%'], ['pmax', 'Performance Max budget', -50, 100, 5, '%'], ['meta', 'Meta budget (both)', -50, 100, 5, '%'],
    ['cpc', 'CPC inflation', -10, 30, 1, '%'], ['cvr', 'Conversion-rate uplift (CRO)', -20, 40, 1, '%'], ['seo', 'Organic clicks growth', -30, 50, 5, '%'],
  ];
  const ELASTIC = 0.75;
  const project = (rows, L) => rows.map((r) => {
    const paid = r.ch !== 'Organic Search';
    const b = 1 + (r.ch === 'Google Search' ? L.gs : r.ch === 'Performance Max' ? L.pmax : r.ch.startsWith('Meta') ? L.meta : 0) / 100;
    const vol = paid ? Math.pow(b, ELASTIC) / (1 + L.cpc / 100) : 1 + L.seo / 100;
    const conv = r.conv * vol * (1 + L.cvr / 100) * 3;
    const value = conv * (r.conv ? r.value / r.conv : 0);
    return { ch: r.ch, spend: paid ? r.spend * b * 3 : 0, conv, value };
  });
  const tot = (p) => p.reduce((s, r) => ({ spend: s.spend + r.spend, conv: s.conv + r.conv, value: s.value + r.value }), { spend: 0, conv: 0, value: 0 });
  const gbp = (v) => `£${Math.round(v).toLocaleString('en-GB')}`;
  const renderPlan = () => {
    const out = wiHost.querySelector('.kx-wi-out');
    const rows = plan.base?.filter((r) => r.client === plan.client);
    if (!rows) { out.innerHTML = '<p>Loading September actuals from the governed layer…</p>'; return; }
    const b = project(rows, ZERO), s = project(rows, plan.levers), B = tot(b), Sx = tot(s);
    const roas = (t) => (t.spend ? t.value / t.spend : 0);
    out.innerHTML = `
      <div class="kx-wi-kpis">${[['Q4 conversion value', gbp(Sx.value), Sx.value / B.value - 1], ['Q4 media spend', gbp(Sx.spend), Sx.spend / B.spend - 1, true], ['Paid ROAS', `${roas(Sx).toFixed(2)}x`, roas(Sx) / roas(B) - 1]]
        .map(([l, v, d, neutral]) => `<div><span>${l}</span><b>${v}</b><i class="${neutral ? '' : d >= 0 ? 'up' : 'down'}">${d >= 0 ? '+' : ''}${(d * 100).toFixed(1)}% vs run-rate</i></div>`).join('')}</div>
      <table class="wf-t"><tr><th>Channel (Oct–Dec)</th><th class="r">Spend</th><th class="r">Conversions</th><th class="r">Conv. value</th><th class="r">Change in value</th></tr>
      ${s.map((r, i) => { const d = r.value - b[i].value; return `<tr><td><b>${esc(r.ch)}</b></td><td class="r">${r.spend ? gbp(r.spend) : '—'}</td><td class="r">${Math.round(r.conv).toLocaleString('en-GB')}</td><td class="r">${gbp(r.value)}</td><td class="r ${Math.abs(d) < 1 ? '' : d > 0 ? 'wf-green' : 'wf-red'}">${d >= 0 ? '+' : '−'}${gbp(Math.abs(d))}</td></tr>`; }).join('')}
      <tr class="mx-tot"><td><b>Total</b></td><td class="r">${gbp(Sx.spend)}</td><td class="r">${Math.round(Sx.conv).toLocaleString('en-GB')}</td><td class="r">${gbp(Sx.value)}</td><td class="r">${Sx.value - B.value >= 0 ? '+' : '−'}${gbp(Math.abs(Sx.value - B.value))}</td></tr></table>
      <p class="wf-note">Baseline: ${esc(plan.client)} September actuals per channel (governed measures Spend / Conversions / Conversion Value This Month; organic from GA4 Key Events and Web Revenue), × 3 for the quarter. Extra paid budget converts with elasticity ${ELASTIC} (diminishing returns); CPC inflation buys fewer clicks; CRO lifts every channel.</p>`;
  };
  const clientSel = el('select', { class: 'mx-sel-client', onchange: (e) => { plan.client = e.target.value; renderPlan(); } });
  wiHost.append(el('figure', { class: 'ob-card half' }, [el('figcaption', { text: 'Levers' }), el('label', { class: 'mx-pick' }, ['Client ', clientSel]), el('div', { class: 'kx-wi-levers' }, LEVERS.map(([k, label, min, max, step, unit]) => {
    const out = el('b', { text: `0${unit}` });
    const inp = el('input', { type: 'range', min, max, step, value: 0, 'data-lever': k });
    inp.addEventListener('input', () => { plan.levers[k] = Number(inp.value); out.textContent = `${inp.value > 0 ? '+' : ''}${inp.value}${unit}`; renderPlan(); });
    return el('label', {}, [el('span', { text: label }), inp, out]);
  })), el('button', { class: 'wf-btn ghost', text: 'Reset levers', onclick: () => { wiHost.querySelectorAll('input[type=range]').forEach((i) => { i.value = 0; i.dispatchEvent(new Event('input')); }); } })]),
  el('figure', { class: 'ob-card half' }, [el('figcaption', { text: 'Q4 2026 projection · run-rate vs scenario' }), el('div', { class: 'kx-wi-out' })]));
  renderPlan();
  Promise.all([
    q({ dims: [['Client', CL], ['Channel', CH]], measures: ['Spend This Month', 'Conversions This Month', 'Conversion Value This Month'] }),
    q({ dims: [['Client', CL], ['Channel', CH]], measures: ['Key Events This Month', 'Web Revenue This Month'] }),
  ]).then(([paid, web]) => {
    plan.base = [
      ...paid.map((r) => ({ client: r.Client, ch: r.Channel, spend: Number(r['Spend This Month']), conv: Number(r['Conversions This Month']), value: Number(r['Conversion Value This Month']) })),
      ...web.filter((r) => r.Channel === 'Organic Search').map((r) => ({ client: r.Client, ch: 'Organic Search', spend: 0, conv: Number(r['Key Events This Month']), value: Number(r['Web Revenue This Month']) })),
    ].sort((a, b) => a.ch.localeCompare(b.ch));
    const names = [...new Set(plan.base.map((r) => r.client))].sort();
    clientSel.replaceChildren(...names.map((n) => el('option', { text: n, ...(n === plan.client ? { selected: '' } : {}) })));
    renderPlan();
  }).catch((e) => { wiHost.querySelector('.kx-wi-out').textContent = `Baseline query failed: ${e?.message ?? e}`; });

  // ------------------------------------------------------------------ Excel pack
  // Every sheet's rows come from engine queries that carry the scope's filters, read at export time.
  // The tabs keep independent selection groups by design (nothing mirrors one into another), so the
  // portfolio pack follows the filter bar of the tab on screen, or Agency portfolio's when the tab on
  // screen has none. A client pack (Excel view, Client reports) is that client's report: its scope
  // is the client alone, and the banner says so.
  const fieldName = (key) => fields.all.find((f) => f.fieldKey === key || f.rawKey === key)?.name ?? key;
  // Engine filter shape: a governed item goes by itemKey, a raw view column by field.fieldKey.
  const engineFilter = (key, operator, values) => (fields.all.find((f) => f.fieldKey === key)?.kind ?? 'field') === 'field'
    ? { field: { fieldKey: key }, operator, values } : { itemKey: key, operator, values };
  const filtersOf = (group) => (appliedIn[group] ?? []).filter((x) => x.values?.length).map((x) => {
    const key = x.field?.fieldKey ?? x.fieldKey;
    return { filter: engineFilter(key, x.operator ?? 'inList', x.values), label: `${fieldName(key)} = ${x.values.join(', ')}` };
  });
  // A tab has a filter bar when its page lists filter controls; the Infographic's client picker is not one.
  const hasFilterBar = (tab) => (PAGES.find(([k]) => k === tab)?.[3].length ?? 0) > 0;
  const exportTab = () => (hasFilterBar(current) ? current : 'pf');
  const scopeOf = (client, tab = exportTab()) => {
    if (client) return { filters: [engineFilter(clientKey, 'inList', [client])], text: `Client = ${client} (client report; dashboard filters do not apply)` };
    const fs = filtersOf(`g-${tab}`), label = PAGES.find(([k]) => k === tab)[1];
    const fell = current && tab !== current && !hasFilterBar(current) ? ` (${PAGES.find(([k]) => k === current)?.[1] ?? current} has no filter bar)` : '';
    return { filters: fs.map((f) => f.filter), text: (fs.length ? `Filters from ${label}: ${fs.map((f) => f.label).join('; ')}` : `No filters on ${label}`) + fell };
  };
  const buildSheets = async (client, commentary, tab) => {
    const scope = scopeOf(client, tab);
    const fq = (args) => q({ ...args, filters: scope.filters });
    const pick = (rows) => (client ? rows.filter((r) => r.Client === client) : rows);
    const KM = ['Spend', 'Impressions', 'Clicks', 'Conversions', 'Conversion Value', 'CTR', 'CPC', 'CVR', 'CPA', 'ROAS', 'Sessions', 'Key Events', 'Web Revenue', 'Engagement Rate', 'Organic Clicks', 'Organic Impressions', 'Average Position'];
    const kmeas = KM.flatMap((m) => [`${m} This Month`, `${m} Last Month`, `${m} Same Month LY`]);
    // Facts are loaded fresh under the scope, not from the session's unfiltered facts().
    const [kpiRows, months, camps, kws, F] = await Promise.all([
      client ? fq({ dims: [['Client', CL]], measures: kmeas }) : fq({ measures: kmeas, limit: 1 }),
      fq({ dims: [['Client', CL], ['Month', MV]], measures: ['Spend', 'Conversions', 'Conversion Value', 'Sessions', 'Key Events', 'Organic Clicks'] }),
      fq({ dims: [['Client', CL], ['Campaign', AD], ['Channel', CH]], measures: ['Spend This Month', 'Impressions This Month', 'Clicks This Month', 'CTR This Month', 'CPC This Month', 'Conversions This Month', 'CVR This Month', 'CPA This Month', 'Conversion Value This Month', 'ROAS This Month', 'ROAS MoM'] }),
      fq({ dims: [['Client', CL], ['Keyword Group', SV]], measures: ['Organic Clicks This Month', 'Organic Clicks MoM', 'Organic Impressions This Month', 'Organic CTR This Month', 'Average Position This Month', 'Average Position MoM', 'Top 3 Keywords This Month'] }),
      loadFacts(fq),
    ]);
    const t = client ? kpiRows.find((r) => r.Client === client) : kpiRows[0];
    const N = (r, k) => Number(r?.[k] ?? 0);
    const when = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    const who = client ?? (scope.filters.length ? 'Portfolio' : 'All clients');
    const banner = (title, cols, scopeText = scope.text) => [[{ v: 'tidewater', s: 'brand' }, { v: title, s: 'title' }, ...Array(Math.max(0, cols - 2)).fill({ v: '', s: 'title' })], [null, { v: `${who} · September 2026 · ${scopeText} · generated ${when} · mock data`, s: 'subtitle' }], []];
    // A query that fills its limit may have dropped rows: say so in the sheet instead of cutting silently.
    const cut = (rows) => (rows.length >= LIMIT ? [[], [{ v: `Only the first ${LIMIT.toLocaleString('en-GB')} rows were returned: this sheet is incomplete.`, s: 'bold' }]] : []);
    const head = (labels) => labels.map((v, i) => ({ v, s: i ? 'head' : 'headl' }));
    const FMTK = { Spend: 'gbp', 'Conversion Value': 'gbp', 'Web Revenue': 'gbp', CPC: 'psf', CPA: 'psf', ROAS: 'x', CTR: 'pct2', CVR: 'pct2', 'Engagement Rate': 'pct', 'Average Position': 'dec' };
    const SRC = { Sessions: 'GA4', 'Key Events': 'GA4', 'Web Revenue': 'GA4', 'Engagement Rate': 'GA4', 'Organic Clicks': 'Search Console', 'Organic Impressions': 'Search Console', 'Average Position': 'Search Console' };
    const rate = (m) => ['CTR', 'CVR', 'Engagement Rate'].includes(m);
    // Position: change in places. Rates: change in percentage points (×100 for the "pp" format).
    // Everything else: relative change, blank when the comparison month is zero.
    const chg = (m, a, b) => (m === 'Average Position' ? a - b : rate(m) ? (a - b) * 100 : b ? a / b - 1 : null);
    const chgCell = (m, a, b, s) => { const v = chg(m, a, b); return v == null ? { v: '—', s: 'text' } : { v, s }; };
    const e = client ? explain(F, client) : null;
    const summary = { name: 'Summary', cols: [4, 30, 16, 16, 16, 12, 12, 22], freeze: { row: 4, col: 0 }, merges: [],
      rows: [...banner('Monthly performance summary', 8), head(['', 'Measure', 'Sep 2026', 'Aug 2026', 'Sep 2025', 'MoM', 'YoY', 'Source']),
        ...KM.map((m) => { const f = FMTK[m] ?? 'int'; const a = N(t, `${m} This Month`), b = N(t, `${m} Last Month`), c = N(t, `${m} Same Month LY`); const cf = m === 'Average Position' ? 'spos' : rate(m) ? 'spts' : 'spct';
          return [null, { v: m, s: 'bold' }, { v: a, s: f }, { v: b, s: f }, { v: c, s: f }, chgCell(m, a, b, cf), chgCell(m, a, c, cf), { v: SRC[m] ?? 'Google Ads + Meta', s: 'text' }]; }),
        [], [null, { v: client ? 'Commentary' : 'Note', s: 'bold' }], [null, { v: commentary ?? (client ? commentaryOf(F, client) : `Portfolio view · ${scope.text}. Per-client packs are produced from the Client reports tab.`), s: 'text' }]] };
    const clientsSheet = { name: 'Clients', cols: [26, 18, 14, 14, 10, 14, 10, 10, 12, 14, 10], freeze: { row: 4, col: 1 }, merges: [],
      rows: [...banner('Client scorecard', 11), head(['Client', 'Account manager', 'Spend', 'Conv. value', 'MoM', 'Conversions', 'ROAS', 'ROAS LM', 'CPA', 'Organic clicks', 'MoM']),
        ...pick(F.byClient).sort((a, b) => N(b, 'Spend This Month') - N(a, 'Spend This Month')).map((r) => [{ v: r.Client, s: 'bold' }, { v: r['Account Manager'], s: 'text' }, { v: N(r, 'Spend This Month'), s: 'gbp' }, { v: N(r, 'Conversion Value This Month'), s: 'gbp' }, { v: N(r, 'Conversion Value MoM'), s: 'spct' }, { v: N(r, 'Conversions This Month'), s: 'int' }, { v: N(r, 'ROAS This Month'), s: 'x' }, { v: N(r, 'ROAS Last Month'), s: 'x' }, { v: N(r, 'CPA This Month'), s: 'psf' }, { v: N(r, 'Organic Clicks This Month'), s: 'int' }, { v: N(r, 'Organic Clicks MoM'), s: 'spct' }]), ...cut(F.byClient)] };
    const byMonth = new Map();
    for (const r of pick(months)) { const m = byMonth.get(r.Month) ?? { Month: r.Month, s: 0, c: 0, v: 0, se: 0, k: 0, o: 0 }; m.s += N(r, 'Spend'); m.c += N(r, 'Conversions'); m.v += N(r, 'Conversion Value'); m.se += N(r, 'Sessions'); m.k += N(r, 'Key Events'); m.o += N(r, 'Organic Clicks'); byMonth.set(r.Month, m); }
    const trend = { name: 'Monthly trend', cols: [12, 14, 12, 14, 10, 12, 12, 14], freeze: { row: 4, col: 1 }, merges: [],
      rows: [...banner('Monthly series', 8), head(['Month', 'Spend', 'Conversions', 'Conv. value', 'ROAS', 'Sessions', 'Key events', 'Organic clicks']),
        ...[...byMonth.values()].sort((a, b) => a.Month.localeCompare(b.Month)).map((m) => [{ v: m.Month, s: 'bold' }, { v: m.s, s: 'gbp' }, { v: m.c, s: 'int' }, { v: m.v, s: 'gbp' }, { v: m.s ? m.v / m.s : 0, s: 'x' }, { v: m.se, s: 'int' }, { v: m.k, s: 'int' }, { v: m.o, s: 'int' }]), ...cut(months)] };
    const campSheet = { name: 'Campaigns', cols: [24, 26, 18, 12, 14, 12, 9, 9, 10, 9, 10, 14, 9, 9], freeze: { row: 4, col: 2 }, merges: [],
      rows: [...banner('Campaigns · September', 14), head(['Client', 'Campaign', 'Channel', 'Spend', 'Impressions', 'Clicks', 'CTR', 'CPC', 'Conv.', 'CVR', 'CPA', 'Conv. value', 'ROAS', 'MoM']),
        ...pick(camps).sort((a, b) => N(b, 'Spend This Month') - N(a, 'Spend This Month')).map((r) => [{ v: r.Client, s: 'text' }, { v: r.Campaign, s: 'bold' }, { v: r.Channel, s: 'text' }, { v: N(r, 'Spend This Month'), s: 'gbp' }, { v: N(r, 'Impressions This Month'), s: 'int' }, { v: N(r, 'Clicks This Month'), s: 'int' }, { v: N(r, 'CTR This Month'), s: 'pct2' }, { v: N(r, 'CPC This Month'), s: 'psf' }, { v: N(r, 'Conversions This Month'), s: 'int' }, { v: N(r, 'CVR This Month'), s: 'pct2' }, { v: N(r, 'CPA This Month'), s: 'psf' }, { v: N(r, 'Conversion Value This Month'), s: 'gbp' }, { v: N(r, 'ROAS This Month'), s: 'x' }, { v: N(r, 'ROAS MoM'), s: 'spct' }]), ...cut(camps)] };
    const seoSheet = { name: 'SEO', cols: [24, 18, 12, 10, 14, 10, 10, 10, 10], freeze: { row: 4, col: 2 }, merges: [],
      rows: [...banner('Search Console · keyword groups', 9), head(['Client', 'Keyword group', 'Clicks', 'MoM', 'Impressions', 'CTR', 'Position', 'Change', 'Top-3 kw']),
        ...pick(kws).map((r) => [{ v: r.Client, s: 'text' }, { v: r['Keyword Group'], s: 'bold' }, { v: N(r, 'Organic Clicks This Month'), s: 'int' }, { v: N(r, 'Organic Clicks MoM'), s: 'spct' }, { v: N(r, 'Organic Impressions This Month'), s: 'int' }, { v: N(r, 'Organic CTR This Month'), s: 'pct2' }, { v: N(r, 'Average Position This Month'), s: 'dec' }, { v: N(r, 'Average Position MoM'), s: 'spos' }, { v: N(r, 'Top 3 Keywords This Month'), s: 'int' }]), ...cut(kws)] };
    const drv = { name: 'Why it changed', cols: [24, 20, 10, 10, 12, 14, 12, 14, 10, 10], freeze: { row: 4, col: 2 }, merges: [],
      rows: [...banner('Conversion bridge · Aug → Sep (adds up exactly)', 10), head(['Client', 'Channel', 'Aug', 'Sep', 'Change', 'Reach effect', 'CTR effect', 'CVR effect', 'CTR Aug', 'CTR Sep']),
        ...pick(F.byChan).map((r) => [{ v: r.Client, s: 'text' }, { v: r.Channel, s: 'bold' }, { v: N(r, 'Conversions Last Month'), s: 'int' }, { v: N(r, 'Conversions This Month'), s: 'int' }, { v: N(r, 'Conversions Change MoM'), s: 'sint' }, { v: N(r, 'Conversions Impressions Effect MoM'), s: 'sint' }, { v: N(r, 'Conversions CTR Effect MoM'), s: 'sint' }, { v: N(r, 'Conversions CVR Effect MoM'), s: 'sint' }, { v: N(r, 'CTR Last Month'), s: 'pct2' }, { v: N(r, 'CTR This Month'), s: 'pct2' }]), ...cut(F.byChan),
        ...(e ? [[], [{ v: 'Explanation', s: 'bold' }], [{ v: e.headline, s: 'text' }], ...e.bullets.map((b) => [{ v: `• ${b}`, s: 'text' }]), [], [{ v: 'Next steps', s: 'bold' }], ...e.actions.map((a) => [{ v: `• ${a}`, s: 'text' }])] : [])] };
    // The Budget planner plans one client, so only a client pack carries it: that client's September
    // actuals with the levers as set on the Budget planner tab.
    const pr = client ? plan.base?.filter((r) => r.client === client) : null;
    const ps = pr ? project(pr, plan.levers) : [], pb = pr ? project(pr, ZERO) : [];
    const wiSheet = { name: 'Budget plan', cols: [30, 16, 16, 16, 16], merges: [],
      rows: [...banner(`Q4 budget scenario · ${client}`, 5, `${scope.text} · levers as set on the Budget planner tab`), head(['Lever', 'Setting', '', '', '']), ...LEVERS.map(([k, label, , , , unit]) => [{ v: label, s: 'bold' }, { v: `${plan.levers[k] > 0 ? '+' : ''}${plan.levers[k]}${unit}`, s: 'text' }]), [],
        head(['Channel', 'Spend', 'Conversions', 'Conv. value', 'vs run-rate']), ...ps.map((r, i) => [{ v: r.ch, s: 'bold' }, { v: r.spend, s: 'gbp' }, { v: r.conv, s: 'int' }, { v: r.value, s: 'gbp' }, { v: r.value - pb[i].value, s: 'sgbp' }])] };
    // Status and audit entries for the clients in scope only, so a client pack carries no other client's trail.
    const W = workflowState();
    const inScope = new Set(pick(F.byClient).map((r) => r.Client));
    const named = (what) => !scope.filters.length || [...inScope].some((c) => what.includes(c));
    const wfSheet = { name: 'Sign-off', cols: [20, 40, 60], merges: [],
      rows: [...banner('Report status & audit trail', 3), head(['Client', 'Status', 'Approved by']),
        ...Object.entries(W.reports).filter(([c]) => !scope.filters.length || inScope.has(c)).map(([c, r]) => [{ v: c, s: 'bold' }, { v: r.status, s: 'text' }, { v: r.approvedBy ?? '—', s: 'text' }]), [],
        head(['When', 'Who', 'What']), ...W.audit.filter((a) => named(a.what)).map((a) => [{ v: a.at, s: 'text' }, { v: a.who, s: 'text' }, { v: a.what, s: 'text' }])] };
    return { sheets: [summary, ...(client ? [] : [clientsSheet]), drv, trend, campSheet, seoSheet, ...(client ? [wiSheet] : []), wfSheet], title: `Tidewater Media – ${who} – September 2026` };
  };
  /** The pack as a Blob; the buttons below download it, and the smoke test's export probe reads it. */
  const buildWorkbook = async (client, commentary, tab) => workbookBlob({ ...(await buildSheets(client, commentary, tab)), author: 'Tidewater Media (Astrato)' });
  mountSheetView(panes.xl.grid, { clients: () => facts().then((F) => F.clients), build: buildSheets, download: async (c) => download(await buildWorkbook(c), c) });
  const download = (blob, name) => {
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `Tidewater_${(name ?? 'Portfolio').replace(/[^A-Za-z0-9]+/g, '_')}_Sep_2026.xlsx` });
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
    window.__lastExport = blob.size;
  };
  exportBtn.addEventListener('click', async () => {
    exportBtn.disabled = true; exportBtn.textContent = 'Building pack…';
    try { download(await buildWorkbook(null), 'Portfolio'); } catch (e) { console.error(e); alert(`Export failed: ${e?.message ?? e}`); }
    finally { exportBtn.disabled = false; exportBtn.textContent = '⬇ Excel pack'; }
  });

  // ------------------------------------------------------------------ client report workflow + email
  const send = async (client, [contact, email], commentary) => {
    download(await buildWorkbook(client, commentary), client);
    const subject = `${client} – September 2026 performance report (Tidewater Media)`;
    const bodyText = [`Hi ${contact.split(',')[0].split(' ')[0]},`, '', 'Please find attached your September performance report.', '', commentary, '', 'Your interactive dashboard is always live in your Tidewater client portal.', '', 'Best,', 'Tidewater Media', '', '(Demo – mock data)'].join('\n');
    window.__lastMail = { to: email, subject, body: bodyText };
    const a = Object.assign(document.createElement('a'), { href: `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}` });
    document.body.append(a); a.click(); a.remove();
  };
  const wf = mountWorkflows(panes.wf.grid, { facts, explain, commentaryOf, anomaliesOf, send });

  // ------------------------------------------------------------------ smoke-test contract (kit/verify)
  for (const [key] of PAGES) appState.tab(key, () => show(key));
  const textOf = (id) => (document.querySelector(`[data-slot="${id}"]`)?.innerText ?? '').replace(/\s+/g, ' ').trim();
  const valuesOf = async (name, view) => (await q({ dims: [[name, view]], measures: ['Spend'] })).map((r) => r[name]).filter((v) => v != null).map(String).sort();
  /**
   * Select through the app's real path (a pending selection in the tab's group, which the app
   * applies after 250 ms, as the filter bar does), then remove only that field so a tab that opens
   * on one client keeps it. Checks only read the screen: nothing is approved, sent or written.
   */
  const selectionCheck = (page, group, name, view, pickValue, kpiIds, tableIds) => async () => {
    show(page);
    await appState.quiet({ quietMs: 1200 });
    const value = pickValue(await valuesOf(name, view));
    const selection = selectionOf(fields.raw(name, view).fieldKey, [value]);
    const ids = [...kpiIds, ...tableIds];
    const read = () => Object.fromEntries(ids.map((id) => [id, textOf(id)]));
    const before = read();
    selections.selectValues(group, selection, { state: 'pending' });
    await appState.quiet({ quietMs: 1200 });
    const during = read();
    selections.removeSelection(group, selection);
    await appState.quiet({ quietMs: 1200 });
    const after = read();
    const moved = (id) => during[id] !== before[id];
    const back = (id) => after[id] === before[id];
    const ok = (list) => list.some((id) => moved(id) && back(id));
    const detail = ids.map((id) => `${id}: ${before[id].slice(0, 24)} → ${during[id].slice(0, 24)}${back(id) ? ' (restored)' : ' (NOT restored)'}`).join('; ');
    return { pass: Boolean(value) && ok(kpiIds) && ok(tableIds) && ids.every((id) => before[id] !== ''), detail: `${name} = ${value} → ${detail}` };
  };
  const firstOf = (vs) => vs[0];
  appState.check('Agency portfolio: a Sector selection moves the KPIs and the scorecard; clearing restores them',
    selectionCheck('pf', 'g-pf', 'Sector', CL, firstOf, ['pf-spend', 'pf-spend-d', 'pf-val'], ['pf-score']));
  appState.check('Client performance: a Channel Group selection moves the KPIs and the campaign table; clearing restores them',
    selectionCheck('cl', 'g-cl', 'Channel Group', CH, (vs) => vs.find((v) => /search/i.test(v)) ?? vs[0], ['cl-spend', 'cl-spend-d', 'cl-conv'], ['cl-camp']));
  appState.check('Why it changed: a Channel selection moves the change KPIs and the campaign movers; clearing restores them',
    selectionCheck('dr', 'g-dr', 'Channel', CH, (vs) => vs.find((v) => /google search/i.test(v)) ?? vs[0], ['dr-conv', 'dr-conv-d', 'dr-spend'], ['dr-camp']));
  appState.check('Paid media: a Platform selection moves the KPIs and the campaign table; clearing restores them',
    selectionCheck('pm', 'g-pm', 'Platform', CH, (vs) => vs.find((v) => /meta/i.test(v)) ?? vs[0], ['ls-imp', 'ls-imp-d', 'ls-cpc'], ['ls-table']));
  appState.check('SEO & web: a Client selection moves the KPIs and the keyword table; clearing restores them',
    selectionCheck('seo', 'g-seo', 'Client', CL, firstOf, ['s-clk', 's-clk-d', 's-sess'], ['s-table']));
  appState.check('Infographic: switching client moves the KPIs and the revenue table; switching back restores them', async () => {
    show('ig');
    await appState.quiet({ quietMs: 1200 });
    for (let i = 0; i < 40 && igPick.options.length < 2; i++) await sleep(250);
    const ids = ['ig-val', 'ig-val-d', 'ig-rev'];
    const read = () => ids.map(textOf).join(' | ');
    const was = igPick.value;
    const other = [...igPick.options].map((o) => o.value).find((v) => v !== was);
    const before = read();
    igPick.value = other; igPick.dispatchEvent(new Event('change'));
    await appState.quiet({ quietMs: 1200 });
    const during = read();
    igPick.value = was; igPick.dispatchEvent(new Event('change'));
    await appState.quiet({ quietMs: 1200 });
    const after = read();
    return { pass: Boolean(other) && during !== before && after === before, detail: `${was} → ${other} → ${was}: ${before.slice(0, 60)} → ${during.slice(0, 60)}` };
  });
  appState.check('Ask Nash: a suggested question answers with a native Astrato chart', async () => {
    show('nash');
    const status = await askNash(PROMPTS[0][1]);
    await appState.quiet();
    return { pass: status === 'rendered', detail: `chart ${status}` };
  });
  appState.check('Budget planner: moving a lever changes the Q4 projection; resetting restores it', async () => {
    show('wi');
    for (let i = 0; i < 60 && !plan.base; i++) await sleep(500);
    const out = wiHost.querySelector('.kx-wi-out');
    const input = wiHost.querySelector('input[data-lever="gs"]');
    const before = out.innerText;
    input.value = '40'; input.dispatchEvent(new Event('input'));
    const during = out.innerText;
    input.value = '0'; input.dispatchEvent(new Event('input'));
    const after = out.innerText;
    return { pass: Boolean(plan.base) && during !== before && after === before, detail: 'Google Search budget 0% → +40% → 0%' };
  });
  appState.check('Excel pack downloads', async () => {
    window.__lastExport = 0;
    exportBtn.click();
    for (let i = 0; i < 120 && !window.__lastExport; i++) await sleep(500);
    show('pf');
    return { pass: window.__lastExport > 0, detail: `${window.__lastExport} bytes` };
  });
  // Export probe: a Sector selection made in Agency portfolio's group, the way the filter bar and the
  // checks above make it, must narrow every sheet of the pack built from that tab (Sign-off is a
  // status list and may not change).
  let probeSel = null;
  appState.exportProbe({
    build: () => buildWorkbook(null, undefined, 'pf'),
    select: async () => {
      probeSel = selectionOf(fields.raw('Sector', CL).fieldKey, [firstOf(await valuesOf('Sector', CL))]);
      selections.selectValues('g-pf', probeSel, { state: 'pending' });
      await appState.quiet({ quietMs: 1200 });
    },
    clear: () => { if (probeSel) selections.removeSelection('g-pf', probeSel); probeSel = null; },
    exempt: ['Sign-off'],
  });
};

main().catch((error) => {
  console.error(error);
  appState.bootFailed(error);
  document.getElementById('root').textContent = `Could not start: ${error?.message ?? error}`;
});
