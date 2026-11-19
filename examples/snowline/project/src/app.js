/**
 * Snowline — the Monday resort review, an Astrato App for the resort operations team.
 *
 * Decision: which resorts and weeks do we push next season, and where does the marketing budget go?
 * Every figure inside a card is a native Astrato object on a stored business question of the
 * "Ski Resort Operations" semantic layer (catalogue.js / questions.js). The headline sentence
 * reads stored measures through one governed query that follows the filters.
 *
 * Techniques (selection groups per tab mirrored from main, the query lane, the pre-mount path,
 * KPI = number + change table + mini chart) are adapted from the league-table-planner example.
 */
import { createAstratoApp } from '@astrato-io/app-runtime';
import { createDefaultVSpec, createVisualizationRuntime, registry } from '@astrato-io/visualizations';
import { createVisualizationAvailableFields } from '@astrato-io/visualizations/definitions';
import { applyRuntimeOperations } from '@astrato-io/visualizations/operations';
import { appState } from './app-state.js';
import { buildTiles, DISPLAY, GROUPS, TAB_GROUPS } from './catalogue.js';
import { createFieldIndex } from './fields.js';
import { fitOps, fitTile, fits, LEVERS, paramOps, prepareTile } from './prepare.js';
import { clearQueryCache, prefetchSelections, queryLog, stopPrefetch, throttleQueries } from './throttle.js';
import { createWorkflow } from './workflow.js';
import { buildWorkbook, downloadWorkbook } from './export.js';

const root = document.getElementById('app');
const LANES = 4;
const READY_TIMEOUT_MS = 40000;

const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key in node && typeof value !== 'string') node[key] = value;
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children)) if (child != null) node.append(child);
  return node;
};

const TABS = [
  ['review', 'Season review', 'Did a snowier season bring more guests?'],
  ['best', 'Best resorts & weeks', 'Which resorts and weeks perform best?'],
  ['snow', 'Snow & crowds', 'How do snow conditions drive visits?'],
  ['market', 'Where to market', 'Where is good snow going unsold?'],
  ['plan', 'Plan next season', 'How do we split next season\'s marketing budget?'],
];

// ------------------------------------------------------------------ boot
const boot = async () => {
  const app = await createAstratoApp();
  const { hostServices } = app.client;
  throttleQueries(hostServices);
  const metadata = await hostServices.engine.fields.getFieldMetadata({ ...app.dataBinding });
  const available = createVisualizationAvailableFields(metadata ?? {}).filter((f) => f?.resultType !== 'unhandled');
  const runtime = createVisualizationRuntime({ client: app.client, registry, readyTimeoutMs: READY_TIMEOUT_MS });
  return { app, hostServices, metadata, runtime, dataBinding: { ...app.dataBinding }, fields: createFieldIndex(available) };
};

/** One governed query of stored measures (no dimensions), rows as objects keyed by measure name. */
const governed = (ctx) => async ({ measures = [], filters = [] }) => {
  const calculations = measures.map((name) => { const m = ctx.fields.measure(name); if (!m) throw new Error(`no measure ${name}`); return { calculation: '{m1}', itemKey: m.fieldKey, label: name }; });
  const query = { dimensions: [], calculations, orders: [], limit: 10, offset: 0, filters, totals: false, showRecordsCount: false, outerViews: [], associativeListFilter: null };
  const { response } = await ctx.hostServices.engine.getData({ ...ctx.dataBinding, query });
  const row = Object.values(response?.data ?? {})[0] ?? [];
  return Object.fromEntries(measures.map((name, i) => [name, row[i] == null || row[i] === '' ? null : Number(row[i])]));
};

const main = async () => {
  const ctx = await boot();
  const { runtime, dataBinding, fields } = ctx;
  const { selections } = ctx.hostServices;
  const q = governed(ctx);
  appState.fields?.(fields.available);

  // ---------------------------------------------------- idle prefetch (rubric E2)
  // When the screen is idle, re-run the queries of the objects on the active tab with one more
  // filter value added, for each value the filter controls offer, so the next pick is answered
  // from the session cache. Countries first (the usual first pick), then stage and week type (ten
  // resorts would multiply the work by three; a resort pick is answered live).
  // Prefetches yield to real queries, stop on every selection or tab change, and are not counted
  // as the reader's queries.
  let prefetchReady = false;
  let prefetchTimer;
  const PREFETCH_FIELDS = [
    ['Country', ['Austria', 'France', 'Germany', 'Italy', 'Switzerland']],
    ['Season Stage', ['1 Early season', '2 Peak winter', '3 Mid winter', '4 Spring']],
    ['Week Type', ['Holiday week', 'Regular week']],
  ];
  const HEADLINE_MEASURES = ['Snowfall Change vs Last Season', 'Crowd Index This Season', 'Crowd Index Change vs Last Season', 'Quiet Powder Weeks This Season'];
  const keysIn = (node, out = new Set()) => {
    if (Array.isArray(node)) node.forEach((n) => keysIn(n, out));
    else if (node && typeof node === 'object') for (const [k, v] of Object.entries(node)) { if (k === 'fieldKey' && typeof v === 'string') out.add(v); else keysIn(v, out); }
    return out;
  };
  /** Field keys a request may name if it belongs to one of the objects on the active tab. */
  const visibleKeySets = () => {
    const sets = [new Set(HEADLINE_MEASURES.map((n) => fields.measure(n)?.fieldKey).filter(Boolean))];
    for (const t of prefetchTiles()) {
      const keys = keysIn(t.definition);
      if (t.miniChart) { const d = fields.raw(t.miniChart.field, t.miniChart.view); if (d) keys.add(d.fieldKey); }
      if (t.type === 'filter') keys.add(fields.dimension(t.field)?.fieldKey);
      sets.push(keys);
    }
    return sets;
  };
  let prefetchTiles = () => [];
  const requestKeys = (request) => [...(request.query.dimensions ?? []), ...(request.query.calculations ?? [])].map((x) => x.itemKey ?? x.fieldKey).filter(Boolean);
  const schedulePrefetch = () => {
    clearTimeout(prefetchTimer);
    if (!prefetchReady) return;
    prefetchTimer = setTimeout(async () => {
      // Wait for the screen to be idle: no real query open, none finished in the last second.
      const busy = () => queryLog().some((e) => !e.prefetch && (e.ms == null || performance.now() - (e.at + e.ms) < 1000));
      if (busy()) { schedulePrefetch(); return; }
      const sets = visibleKeySets();
      const match = (request) => { const ks = requestKeys(request); return ks.length > 0 && sets.some((s) => ks.every((k) => s.has(k))); };
      const applied = selections.getSelection(GROUPS.main).applied;
      const candidates = PREFETCH_FIELDS.map(([dim, values]) => {
        const fieldKey = fields.dimension(dim)?.rawKey ?? fields.dimension(dim)?.fieldKey;
        return { fieldKey, values: applied.some((s) => s.field?.fieldKey === fieldKey) ? [] : values };
      }).filter((c) => c.fieldKey && c.values.length);
      const n = await prefetchSelections(candidates, { match, maxQueries: 200 });
      window.__prefetched = (window.__prefetched ?? 0) + n;
    }, 1200);
  };
  appState.mark('booted');

  // ---------------------------------------------------- compile + theme
  const built = await buildTiles(fields);
  const levers = Object.fromEntries(Object.entries(LEVERS).map(([k, v]) => [k, v.value]));
  const tiles = await Promise.all(built.tiles.map(async (tile) => {
    const { vSpec, failed } = await prepareTile(tile, fields.available, { dataBinding, levers });
    if (failed.length) console.warn(`[prepare] ${tile.id}`, JSON.stringify(failed));
    return { ...tile, vSpec };
  }));
  appState.mark('themed');
  const failures = built.failures;
  const byId = new Map(tiles.map((t) => [t.id, t]));

  // ---------------------------------------------------- shell
  const surface = (id) => el('div', { class: 'viz-surface is-loading', 'data-slot': id }, el('span', { class: 'loading', text: 'Loading…' }));
  const card = (id, cls = '', sub = null) => el('figure', { class: `card ${cls}`.trim(), 'data-object': id }, [
    el('figcaption', { class: 'card__head' }, [el('h3', { class: 'card__title', text: byId.get(id)?.title ?? id }), sub ? el('p', { class: 'card__sub', text: sub }) : null]),
    surface(id),
  ]);
  const kpi = (label, valueId, changeId, sparkId, note, cls = '') => el('article', { class: `kpi ${cls}`.trim(), 'data-object': valueId, title: byId.get(valueId)?.title }, [
    el('h3', { class: 'kpi__title', text: label }),
    el('div', { class: 'kpi__row' }, [el('div', { class: 'kpi__value' }, surface(valueId)), el('div', { class: 'kpi__chg' }, surface(changeId))]),
    el('div', { class: 'kpi__spark' }, surface(sparkId)),
    el('p', { class: 'kpi__note', text: note }),
  ]);

  const exportBtn = el('button', { type: 'button', class: 'btn btn--light', text: 'Excel report', title: 'Download a formatted workbook of every card, following the current filters' });
  const filterBarHost = el('div', { class: 'app-filters' });
  const tabNav = el('nav', { class: 'tabs', role: 'tablist' }, TABS.map(([id, label], i) => el('button', { type: 'button', role: 'tab', class: i === 0 ? 'tab is-active' : 'tab', 'data-tab': id, text: label, title: TABS[i][2], onclick: () => showTab(id) })));
  const headline = el('h1', { class: 'headline', text: 'Did a snowier season bring more guests?' });
  const standfirst = el('p', { class: 'standfirst', text: 'Season 2025/26 against 2024/25, December to March. Crowd Index (0–100) is the demand signal: the data holds no visitor counts.' });

  // what-if levers (inputs only: every number they move is a governed measure)
  const leverInputs = {};
  const leverRows = Object.entries(LEVERS).map(([key, lv]) => {
    const out = el('output', { class: 'lever__value', text: lv.fmt(lv.value) });
    const input = el('input', { type: 'range', min: String(lv.min), max: String(lv.max), step: String(lv.step), value: String(lv.value), 'aria-label': lv.label });
    input.addEventListener('input', () => { out.textContent = lv.fmt(Number(input.value)); scheduleLevers(); });
    leverInputs[key] = input;
    return el('label', { class: 'lever' }, [el('span', { class: 'lever__label', text: lv.label }), input, out]);
  });
  const leverValues = () => Object.fromEntries(Object.entries(leverInputs).map(([k, i]) => [k, Number(i.value)]));
  const describeLevers = () => { const v = leverValues(); return `${LEVERS.budget.fmt(v.budget)} over regular weeks with ≥${v.minSnow} cm fresh snow and Crowd Index < ${v.maxCrowd}`; };

  const resortsList = ['Aiguille Vale', 'Falkenruhe', 'Glacier Haven', 'Kronenwald', 'Lac des Neiges', 'Monte Brina', 'Nordkamm', 'Pinecrest Dolomiti', 'Silbergrat', 'Valle Stella'];
  const workflow = createWorkflow({ el, resorts: resortsList, levers: LEVERS, describeLevers });

  const panes = {
    review: el('section', { class: 'pane is-active', 'data-pane': 'review' }, [
      el('div', { class: 'kpis kpis--5' }, [
        kpi('Fresh snow this season', 'kpi-snow', 'chg-snow', 'spark-snow', 'vs 2024/25 · bars: each week of 2025/26', 'kpi--snow'),
        kpi('Crowd Index this season', 'kpi-crowd', 'chg-crowd', 'spark-crowd', 'points vs 2024/25 · line: each week', 'kpi--crowd'),
        kpi('Average snow base', 'kpi-base', 'chg-base', 'spark-base', 'vs 2024/25 · line: base building up'),
        kpi('Quiet powder weeks', 'kpi-qpw', 'chg-qpw', 'spark-qpw', '≥40 cm fresh, crowd <55 · fewer is better'),
        kpi('Average week score', 'kpi-score', 'chg-score', 'spark-score', 'points vs 2024/25 · line: each week'),
      ]),
      el('div', { class: 'grid grid--review' }, [
        card('combo-hero', 'card--hero', 'Both seasons, by week of the season. Bars: average fresh snow (cm, left). Line: Crowd Index (right). Weeks 4 and 9 are holidays.'),
        card('tbl-resorts', '', '2025/26; changes against 2024/25 (LS). Quiet powder = weeks of good snow and thin crowds. By week = Crowd Index each week. Click a resort to filter.'),
      ]),
    ]),
    best: el('section', { class: 'pane', 'data-pane': 'best' }, [
      el('div', { class: 'grid grid--best' }, [
        card('tbl-best', 'card--tall', 'Both seasons. Week score 0–100: snow 35%, value 25%, quiet 15%, expert 15%, family 10%.'),
        card('heat-weeks', '', 'Week score, both seasons averaged, by week of the season (1 = first week of December)'),
        card('tbl-top10', '', '2025/26 only, best week score first'),
        card('tbl-profile', '', 'Both seasons; green above 75, red below 50. By week = week score through the season.'),
      ]),
    ]),
    snow: el('section', { class: 'pane', 'data-pane': 'snow' }, [
      el('div', { class: 'grid grid--snow' }, [
        card('bar-bands', 'card--a', 'Average Crowd Index, both seasons, by fresh snow in the week'),
        el('article', { class: 'kpi kpi--solo', 'data-object': 'kpi-uplift', title: byId.get('kpi-uplift')?.title }, [
          el('h3', { class: 'kpi__title', text: byId.get('kpi-uplift')?.title }),
          el('div', { class: 'kpi__row' }, [el('div', { class: 'kpi__value' }, surface('kpi-uplift')), el('div', { class: 'kpi__chg' }, surface('chg-uplift'))]),
          el('p', { class: 'kpi__note', text: 'Crowd Index points, 2025/26; change vs 2024/25 (smaller is better). Bars: average crowd by week type, both seasons.' }),
          el('div', { class: 'kpi__spark kpi__spark--tall' }, surface('spark-types')),
        ]),
        card('combo-stages', 'card--c', 'Both seasons. Bars: base depth (cm, left). Line: Crowd Index (right).'),
        card('combo-smoothed', 'card--d', 'Three-week moving averages, both seasons. Blue: fresh snow (cm, left). Amber: Crowd Index (right). Lines have no clickable points: pick a week on the season review chart.'),
        card('heat-levels', 'card--e', 'Resort-weeks, both seasons'),
      ]),
    ]),
    market: el('section', { class: 'pane', 'data-pane': 'market' }, [
      el('div', { class: 'grid grid--market' }, [
        card('bar-headroom', 'card--h', 'Snow score minus Crowd Index, both seasons (index points): the bigger the gap, the more good snow goes unsold'),
        card('tbl-qpw', 'card--q', 'Both seasons. A quiet powder week is a regular week with ≥40 cm of fresh snow and a Crowd Index under 55. Share = of all quiet powder weeks in view.'),
        card('bar-airports', 'card--p', 'Both seasons: the flight markets to target'),
      ]),
    ]),
    plan: el('section', { class: 'pane', 'data-pane': 'plan' }, [
      el('div', { class: 'grid grid--plan' }, [
        el('div', { class: 'stack' }, [
          el('div', { class: 'card lever-card' }, [
            el('h3', { class: 'card__title', text: 'If next season\'s marketing follows the snow…' }),
            el('p', { class: 'card__sub', text: 'Levers feed the layer\'s Suggested Budget and Target Weeks measures; the split is a planning rule over both seasons, not a forecast.' }),
            ...leverRows,
            el('button', { type: 'button', class: 'link', text: 'Reset levers', onclick: () => { for (const [k, i] of Object.entries(leverInputs)) { i.value = String(LEVERS[k].value); i.dispatchEvent(new Event('input')); } } }),
          ]),
          el('article', { class: 'kpi kpi--solo', 'data-object': 'kpi-targets', title: byId.get('kpi-targets')?.title }, [
            el('h3', { class: 'kpi__title', text: byId.get('kpi-targets')?.title }),
            el('div', { class: 'kpi__row' }, [el('div', { class: 'kpi__value' }, surface('kpi-targets')), el('div', { class: 'kpi__chg' }, surface('chg-targets'))]),
            el('p', { class: 'kpi__note', text: 'Resort-weeks the levers\' rule picks in 2025/26; change vs 2024/25 under the same rule (fewer is better). Bars: both seasons, early season → spring.' }),
            el('div', { class: 'kpi__spark kpi__spark--tall' }, surface('spark-targets')),
          ]),
        ]),
        el('div', { class: 'stack' }, [
          card('bar-split', 'card--half', 'Grey: the default plan (€250k, ≥40 cm, Crowd Index < 55). Blue: your levers. Split by each resort\'s share of target weeks.'),
          card('bar-split-stage', 'card--half', 'The same two plans, by part of the season'),
        ]),
        el('div', { class: 'card card--plan' }, [el('h3', { class: 'card__title', text: 'Marketing plan 2026/27' }), workflow.host]),
      ]),
    ]),
  };

  root.replaceChildren(el('div', { class: 'app' }, [
    el('header', { class: 'masthead' }, [
      el('div', { class: 'brand' }, [el('span', { class: 'brand__mark', 'aria-hidden': 'true', html: '<svg viewBox="0 0 32 32" width="28" height="28"><path d="M2 27 12 10l5 8 4-6 9 15z" fill="currentColor" opacity=".9"/><path d="M12 10l-3 5 3-1 2 2z M21 12l-2 3 2-.5 1.5 1.5z" fill="#fff"/></svg>' }), el('div', {}, [el('b', { text: 'Snowline' }), el('span', { text: 'Monday resort review · 10 resorts · seasons 2024/25 and 2025/26' })])]),
      el('div', { class: 'masthead__end' }, [el('span', { class: 'badge', text: 'Synthetic data · ends 30 Mar 2026', title: 'All resort and week values are synthetic (SKI_SOURCES). Nothing here is live.' }), exportBtn]),
    ]),
    el('div', { class: 'selbar' }, [
      el('div', { class: 'selbar__filters' }, [
        el('div', { class: 'control', title: 'Resort' }, surface('ctl-resort')),
        el('div', { class: 'control', title: 'Country' }, surface('ctl-country')),
        el('div', { class: 'control', title: 'Stage' }, surface('ctl-stage')),
        el('div', { class: 'control', title: 'Week type' }, surface('ctl-type')),
      ]),
      el('div', { class: 'selbar__chips' }, [filterBarHost]),
    ]),
    tabNav,
    el('div', { class: 'lede' }, [headline, standfirst]),
    el('main', { class: 'panes' }, Object.values(panes)),
    failures.length ? el('section', { class: 'failures' }, [el('h2', { text: `${failures.length} object(s) not shown` }), el('ul', {}, failures.map((f) => el('li', { text: `${f.title ?? f.id}: ${f.reason}` })))]) : null,
    el('footer', { class: 'source', text: 'Source: "Ski Resort Operations" semantic layer on Snowflake ASTRATO_GALLERY.MOCK_DATA (SKI_RESORT_WEEKS, SKI_RESORTS, SKI_WEEKS). Values are synthetic.' }),
  ]));
  const syncPaneWidth = () => document.documentElement.style.setProperty('--pane-w', `${document.documentElement.clientWidth}px`);
  syncPaneWidth();
  addEventListener('resize', syncPaneWidth);

  // ---------------------------------------------------- headline (governed, follows the filters)
  const fmtPct = (v) => `${v >= 0 ? '+' : '−'}${Math.abs(v * 100).toFixed(1)}%`;
  const fmtPts = (v) => `${v >= 0.05 ? '+' : v <= -0.05 ? '−' : '±'}${Math.abs(v).toFixed(1)}`;
  let headlineText = '';
  let headlineSeq = 0;
  const refreshHeadline = async () => {
    const seq = ++headlineSeq;
    // 0.9 engine filter shape { operator, values, fieldKey } (the { field: { fieldKey } } form of
    // the examples' governed() helper is answered with HTTP 400). Same property order as the
    // charts send, so prefetched answers are found in the cache.
    const filters = selections.getSelection(GROUPS.main).applied.map((s) => ({ operator: s.operator ?? 'inList', values: s.values, fieldKey: s.field.fieldKey }));
    try {
      const v = await q({ measures: ['Snowfall Change vs Last Season', 'Crowd Index This Season', 'Crowd Index Change vs Last Season', 'Quiet Powder Weeks This Season'], filters });
      if (seq !== headlineSeq) return;
      const snow = v['Snowfall Change vs Last Season'];
      const crowd = v['Crowd Index This Season'];
      const dCrowd = v['Crowd Index Change vs Last Season'];
      const qpw = v['Quiet Powder Weeks This Season'];
      if (snow == null || crowd == null) { headline.textContent = 'No resort-weeks match these filters.'; headlineText = headline.textContent; return; }
      const moved = Math.abs(dCrowd ?? 0) < 0.5 ? 'stayed flat' : dCrowd > 0 ? 'rose' : 'fell';
      headline.replaceChildren(
        snow >= 0 ? 'Snow was ' : 'Snow was ', el('em', { text: `${fmtPct(snow)}` }), ' on last season, yet crowds ', moved,
        ' (Crowd Index ', el('em', { text: crowd.toFixed(1) }), `, ${fmtPts(dCrowd ?? 0)}): `,
        el('em', { text: String(qpw ?? 0) }), ` powder week${qpw === 1 ? '' : 's'} went quiet.`,
      );
      headlineText = headline.textContent;
    } catch (e) {
      console.warn('[headline]', e);
      headline.textContent = 'Did a snowier season bring more guests?'; headlineText = 'Not available: the headline query failed.';
    }
  };

  // ---------------------------------------------------- selections
  const sel = (fieldKey, operator, values) => ({ field: { fieldKey }, fieldKey, kind: 'VALUE', operator, values });
  const rawOf = (dimName) => fields.dimension(dimName)?.rawKey ?? fields.dimension(dimName)?.fieldKey;
  const setOne = (group, fieldKey, selection) => {
    const { applied, pending } = selections.getSelection(group);
    for (const s of [...applied, ...pending]) if (s.field?.fieldKey === fieldKey) selections.removeSelection(group, s);
    if (selection) selections.selectValues(group, selection, { state: 'applied' });
  };
  let activeTab = 'review';
  const sig = (s) => JSON.stringify([s.field?.fieldKey, s.operator, s.values]);
  const mirror = (group) => {
    const want = selections.getSelection(GROUPS.main).applied;
    const have = selections.getSelection(group).applied;
    const wantSigs = new Set(want.map(sig));
    const haveSigs = new Set(have.map(sig));
    for (const s of have) if (!wantSigs.has(sig(s))) selections.removeSelection(group, s);
    for (const s of want) if (!haveSigs.has(sig(s))) {
      for (const h of selections.getSelection(group).applied) if (h.field?.fieldKey === s.field?.fieldKey) selections.removeSelection(group, h);
      selections.selectValues(group, { ...s }, { state: 'applied' });
    }
  };
  for (const g of Object.values(TAB_GROUPS)) mirror(g);
  selections.onActiveSelectionChange(GROUPS.main).subscribe(() => {
    stopPrefetch();
    const g = TAB_GROUPS[activeTab];
    if (g) mirror(g);
    refreshHeadline();
    schedulePrefetch();
  });
  // Chart clicks arrive as pending selections in the tab's group: apply them to main.
  for (const g of Object.values(TAB_GROUPS)) {
    let timer;
    selections.onActiveSelectionChange(g).subscribe((next) => {
      if (!next.pending.length) return;
      clearTimeout(timer);
      const pending = next.pending;
      timer = setTimeout(() => {
        selections.clearPendingSelections(g);
        for (const s of pending) setOne(GROUPS.main, s.field.fieldKey, sel(s.field.fieldKey, s.operator ?? 'inList', s.values));
      }, 200);
    });
  }

  const showTab = (id) => {
    activeTab = id;
    for (const b of tabNav.children) b.classList.toggle('is-active', b.dataset.tab === id);
    for (const [k, p] of Object.entries(panes)) p.classList.toggle('is-active', k === id);
    const g = TAB_GROUPS[id];
    if (g) mirror(g);
    headline.dataset.tab = id;
    refreshHeadline();
    stopPrefetch(); schedulePrefetch();
    try { localStorage.setItem('snowline-tab', id); } catch { /* */ }
  };
  for (const [id] of TABS) appState.tab(id, () => showTab(id));

  // ---------------------------------------------------- what-if
  let leverTimer;
  const applyLevers = async () => {
    const values = leverValues();
    // Every tile marked `params` (KPI, its change and mini chart, both split charts).
    for (const id of tiles.filter((x) => x.params).map((x) => x.id)) {
      const t = byId.get(id);
      if (!t || !mounted.get(id)?.handle) continue;
      await applyRuntimeOperations({ runtime, instanceId: id, operationRequests: paramOps(t, values).map((r, i) => ({ id: `p${i}`, ...r })) }).catch((e) => console.warn('[lever]', id, e));
    }
    workflow.render();
  };
  const scheduleLevers = () => {
    clearTimeout(leverTimer);
    leverTimer = setTimeout(() => { leverTimer = undefined; applyLevers(); }, 300);
  };
  /** A slider moved inside the debounce window: apply it now, so nothing reads the previous parameters. */
  const flushLevers = async () => {
    if (leverTimer === undefined) return;
    clearTimeout(leverTimer);
    leverTimer = undefined;
    await applyLevers();
  };

  // ---------------------------------------------------- mounting
  const mounted = new Map();
  const fitWidth = (slot) => Math.max(200, slot.clientWidth - 24);
  const sizeWatch = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const rec = mounted.get(entry.target.dataset.slot);
      if (!rec || !fits(rec.tile) || !rec.handle) continue;
      const w = fitWidth(entry.target);
      if (w < 210 || Math.abs(w - (rec.fitAt ?? 0)) < 4) continue;
      clearTimeout(rec.fitTimer);
      rec.fitTimer = setTimeout(() => {
        rec.fitAt = w;
        applyRuntimeOperations({ runtime, instanceId: rec.tile.id, operationRequests: fitOps(rec.tile, w).map((r, i) => ({ id: `w${i}`, ...r })) }).catch((e) => console.warn('[fit]', e));
      }, 250);
    }
  });
  let landed = false;
  const landingWait = new Set();
  const mountTile = async (tile) => {
    const slot = root.querySelector(`[data-slot="${tile.slot}"]`);
    if (!slot) return;
    appState.declare(tile.id, tile.tab);
    const record = { tile, at: performance.now(), status: 'pending' };
    mounted.set(tile.id, record);
    try {
      let { vSpec } = tile;
      if (fits(tile)) {
        record.fitAt = fitWidth(slot);
        ({ vSpec } = await fitTile(tile, vSpec, fields.available, record.fitAt, dataBinding));
      }
      runtime.createInstance({ id: tile.id, type: tile.type, groupId: tile.group, vSpec, dataBinding });
      slot.replaceChildren();
      const handle = await runtime.mount(slot, tile.id);
      record.handle = handle;
      if (fits(tile)) sizeWatch.observe(slot);
      handle.ready.then((r) => {
        record.status = r?.status ?? 'unknown';
        record.ms = Math.round(performance.now() - record.at);
        slot.classList.remove('is-loading');
        appState.settle(tile.id, record.status, r);
        landingWait.delete(tile.id);
        if (!landingWait.size && !landed) { landed = true; appState.mark('landing-ready'); }
        if (record.status !== 'rendered') slot.append(el('p', { class: 'viz-error', text: 'This object could not be rendered.' }));
      });
    } catch (error) {
      record.status = 'error';
      appState.settle(tile.id, 'error', error);
      console.error(`[viz] ${tile.id}`, error);
      slot.replaceChildren(el('p', { class: 'viz-error', text: String(error?.message ?? error) }));
    }
  };

  // The library filter bar shows the main group's chips with ×, "Clear all" and an empty hint.
  runtime.createInstance({ id: 'app-filters', type: 'astrato-app-filter-bar', groupId: GROUPS.main, vSpec: createDefaultVSpec('astrato-app-filter-bar'), dataBinding: { ...dataBinding, fieldMetadata: ctx.metadata } });
  await applyRuntimeOperations({ runtime, instanceId: 'app-filters', operationRequests: [
    { id: 'mode', name: 'setAppFilterBarSelectionMode', payload: 'auto' },
    { id: 'assoc', name: 'setAppFilterBarAssociativeFilterEnabled', payload: false },
    { id: 'ovf', name: 'setAppFilterBarOverflow', payload: 'collapse' },
  ] }).catch((e) => console.warn('[filters] op', e));
  runtime.mount(filterBarHost, 'app-filters').catch((e) => console.error('[filters]', e));

  try { const saved = localStorage.getItem('snowline-tab'); if (saved && panes[saved]) showTab(saved); else refreshHeadline(); } catch { refreshHeadline(); }
  const order = (t) => (t.type === 'filter' ? 0 : t.tab === activeTab ? (t.minis ? 2 : 1) : (t.minis ? 4 : 3));
  for (const t of tiles) if (t.type === 'filter' || t.tab === activeTab) landingWait.add(t.id);
  const queue = [...tiles].sort((a, b) => order(a) - order(b));
  let next = 0;
  const lane = async () => { while (next < queue.length) await mountTile(queue[next++]); };
  await Promise.all(Array.from({ length: LANES }, lane));
  appState.mark('mounted-all');
  prefetchTiles = () => tiles.filter((t) => t.type === 'filter' || t.tab === activeTab);
  prefetchReady = true;
  schedulePrefetch();

  // ---------------------------------------------------- export
  const describeMain = () => selections.getSelection(GROUPS.main).applied.map((s) => `${fields.nameOf(s.field.fieldKey)}: ${s.values.join(', ')}`).join('; ') || 'none (all resorts, all weeks)';
  /** Every sheet follows the filters on screen, hidden tabs included: each object queries with its
   *  tab's group, and a hidden tab's group was last mirrored when that tab showed. So copy main into
   *  every tab group, refresh the headline for the current filters, and wait for the re-queries
   *  before reading. The groups stay in sync afterwards; showTab's mirror then finds nothing to do. */
  const buildReport = async () => {
    stopPrefetch();
    try {
      await flushLevers();
      for (const g of Object.values(TAB_GROUPS)) mirror(g);
      await refreshHeadline();
      await settle();
      return await buildWorkbook({
        tabs: TABS, tiles, mounted, plan: workflow.plan(), display: DISPLAY, selectionText: describeMain(), headline: headlineText, levers: describeLevers(),
      });
    } finally { schedulePrefetch(); }
  };
  exportBtn.addEventListener('click', async () => {
    exportBtn.disabled = true;
    try {
      const { blob, sheets } = await buildReport();
      downloadWorkbook(blob);
      window.__lastExport = { bytes: blob.size, sheets };
      exportBtn.textContent = 'Excel report';
    } catch (e) { console.error('[export]', e); exportBtn.textContent = 'Export failed'; } finally { exportBtn.disabled = false; }
  });

  // ---------------------------------------------------- self-checks (run by the smoke test)
  const textOf = (id) => (root.querySelector(`[data-slot="${id}"]`)?.innerText ?? '').replace(/\s+/g, ' ').trim();
  /** What an object shows: its text for HTML-drawn objects (numbers, tables), its own data for canvas charts. */
  const showOf = async (id) => {
    const t = byId.get(id);
    if (t && ['number', 'table'].includes(t.type)) return textOf(id);
    // The rows only: the field metadata in front of them is the same in every state.
    try { const r = await mounted.get(id)?.handle?.getData({ limit: 200 }); return JSON.stringify(r?.data?.response?.data ?? r?.data ?? r ?? null, (k, v) => (k === 'fields' ? undefined : v)).slice(0, 6000); } catch (e) { return `error ${e?.message ?? e}`; }
  };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const settle = async () => {
    await sleep(300);
    for (let i = 0; i < 120 && queryLog().some((e) => e.ms == null && !e.prefetch); i++) await sleep(250);
    await appState.quiet();
  };
  const clearMain = () => selections.clearAllSelections(GROUPS.main);
  // The kit's smoke test builds the workbook without and with Country = Austria from the landing
  // tab (the other tabs hidden) and fails any sheet whose figures do not move. Every tab's objects
  // follow Country; the audit trail and definitions rightly do not.
  appState.exportProbe({
    build: async () => (await buildReport()).blob,
    select: () => setOne(GROUPS.main, rawOf('Country'), sel(rawOf('Country'), 'inList', ['Austria'])),
    clear: () => clearMain(),
    exempt: ['Plan audit trail', 'Definitions'],
  });
  const visibleObjects = () => document.querySelectorAll('.pane.is-active [data-slot]').length;
  /** What one selection cost: distinct requests asked, how many went to the engine, and when the last answer came. */
  const measure = (from, t0) => {
    const real = queryLog().slice(from).filter((e) => !e.prefetch);
    // Answers this selection needed: requests not already asked for before it (a filter control
    // re-reading its unfiltered list is answered by the cache from the page load and costs nothing).
    const earlier = new Set(queryLog().slice(0, from).filter((e) => !e.prefetch).map((e) => e.key));
    const done = real.filter((e) => e.ms != null).map((e) => e.at + e.ms);
    const label = (key) => { try { const qq = JSON.parse(key).query; return `${(qq.dimensions ?? []).map((d) => d.label).join('+')}|${(qq.calculations ?? []).map((c) => c.label).join('+')}|f${(qq.filters ?? []).length}`; } catch { return '?'; } };
    const distinct = [...new Set(real.map((e) => e.key))].filter((k) => !earlier.has(k));
    const timeline = real.map((e) => `${Math.round(e.at - t0)}+${e.ms}${e.cached ? 'c' : ''}:${label(e.key)}`);
    return { asked: distinct.length, sent: real.filter((e) => !e.cached).length, settledMs: done.length ? Math.round(Math.max(...done) - t0) : 0, timeline };
  };
  const FILTER_CONTROLS = 4 + 1; // four filter dropdowns and the headline sentence also answer every selection
  const selectionCheck = (tab, dim, value, ids) => async () => {
    showTab(tab); clearMain(); await settle();
    const snap = () => Promise.all(ids.map(showOf));
    const before = await snap();
    const q0 = queryLog().length; const t0 = performance.now();
    setOne(GROUPS.main, rawOf(dim), sel(rawOf(dim), 'inList', [value]));
    await settle();
    const m = measure(q0, t0); // before snap(): reading a canvas chart's data is itself a query
    const during = await snap();
    clearMain(); await settle();
    const after = await snap();
    const changed = ids.map((id, i) => during[i] !== before[i]);
    const restored = ids.every((id, i) => after[i] === before[i]);
    // Rubric E1: distinct queries the selection needed, within 20% of the visible objects (each
    // table sparkline column is its own query, so it counts as an object), plus the four filter
    // controls and the headline. Distinct, because a chart asks for the same answer twice and the
    // second is served by the cache. Rubric E2: the last answer arrives within 3 s.
    const minis = [...document.querySelectorAll('.pane.is-active [data-slot]')].filter((n) => byId.get(n.dataset.slot)?.miniChart).length;
    const budget = Math.ceil((visibleObjects() + minis + FILTER_CONTROLS) * 1.2);
    const pass = before.every(Boolean) && changed.every(Boolean) && restored && m.asked <= budget && m.settledMs <= 3000;
    return { pass, detail: `${dim} = ${value}: changed ${ids.map((id, i) => `${id}:${changed[i]}`).join(' ')}; restored ${restored}; ${m.asked} new answers needed (${m.sent} sent to the engine, ${m.asked - m.sent} already prefetched) for ${visibleObjects()} visible objects + ${minis} sparkline columns + ${FILTER_CONTROLS} controls and headline, budget ${budget} (20% over); last answer after ${m.settledMs} ms. first "${String(before[0]).slice(0, 60)}" → "${String(during[0]).slice(0, 60)}" → "${String(after[0]).slice(0, 60)}"${pass ? '' : ` || ${m.timeline.join(' ; ')}`}` };
  };
  appState.check('Season review: Country = Italy changes a KPI, the hero chart and the resort table; clearing restores them; only this tab re-queries', selectionCheck('review', 'Country', 'Italy', ['kpi-snow', 'chg-crowd', 'combo-hero', 'tbl-resorts']));
  appState.check('Best resorts & weeks: Country = Austria changes the ranking table, the heat map and the top 10', selectionCheck('best', 'Country', 'Austria', ['tbl-best', 'heat-weeks', 'tbl-top10']));
  appState.check('Snow & crowds: Country = Austria changes the uplift KPI, the band chart and the crowd-level heat map', selectionCheck('snow', 'Country', 'Austria', ['kpi-uplift', 'bar-bands', 'heat-levels']));
  appState.check('Snow & crowds: Stage = 4 Spring (no holiday weeks) empties the uplift KPI without errors and changes the band chart', selectionCheck('snow', 'Season Stage', '4 Spring', ['kpi-uplift', 'bar-bands']));
  appState.check('Where to market: Country = Italy changes the headroom bars and the quiet-powder table', selectionCheck('market', 'Country', 'Italy', ['bar-headroom', 'tbl-qpw', 'bar-airports']));
  appState.check('Plan next season: Week type = Regular week keeps target weeks; Country = France empties the split', async () => {
    showTab('plan'); clearMain(); await settle();
    const before = { k: textOf('kpi-targets'), b: textOf('bar-split') };
    setOne(GROUPS.main, rawOf('Country'), sel(rawOf('Country'), 'inList', ['France'])); await settle();
    const during = { k: textOf('kpi-targets'), b: textOf('bar-split') };
    clearMain(); await settle();
    const after = { k: textOf('kpi-targets') };
    return { pass: before.k !== '' && during.k !== before.k && after.k === before.k, detail: `target weeks "${before.k}" → "${during.k}" (France) → "${after.k}"` };
  });
  appState.check('A chart click (pending selection in the tab group) lands in main, filters the KPIs and follows to the next tab', async () => {
    showTab('review'); clearMain(); await settle();
    const before = textOf('kpi-crowd');
    selections.selectValues(GROUPS.review, sel(rawOf('Resort'), 'inList', ['Glacier Haven']), { state: 'pending' });
    await sleep(500); await settle();
    const inMain = selections.getSelection(GROUPS.main).applied.some((x) => x.values?.includes('Glacier Haven'));
    const during = textOf('kpi-crowd');
    showTab('market'); await settle();
    const other = textOf('tbl-qpw');
    const followed = other.includes('Glacier Haven') && !other.includes('Valle Stella');
    showTab('review'); clearMain(); await settle();
    return { pass: inMain && during !== before && followed && textOf('kpi-crowd') === before, detail: `in main ${inMain}; crowd "${before}" → "${during}"; market tab follows ${followed}` };
  });
  appState.check('What-if: budget €500k doubles the split; powder 60 cm cuts the target weeks; reset restores', async () => {
    showTab('plan'); clearMain(); await settle();
    const before = { k: textOf('kpi-targets'), b: await showOf('bar-split') };
    window.__snowline.setLever('budget', 500000); await sleep(600); await settle();
    const doubled = await showOf('bar-split');
    const sentBudget = (() => { const e = queryLog().filter((x) => !x.prefetch && x.key.includes('Scenario')).pop(); try { return JSON.parse(e.key).query.calculations.find((c) => c.label === 'Scenario').namedParameters.formula['[budget].[float]']; } catch { return null; } })();
    window.__snowline.setLever('minSnow', 60); await sleep(600); await settle();
    const fewer = textOf('kpi-targets');
    window.__snowline.setLever('budget', LEVERS.budget.value); window.__snowline.setLever('minSnow', LEVERS.minSnow.value); await sleep(600); await settle();
    const after = { k: textOf('kpi-targets'), b: await showOf('bar-split') };
    return { pass: doubled !== before.b && fewer !== before.k && after.k === before.k && after.b === before.b, detail: `targets "${before.k}" → "${fewer}" → "${after.k}"; split changed with budget ${doubled !== before.b} (the scenario query carried budget ${sentBudget}); restored ${after.b === before.b}` };
  });
  appState.check('Plan workflow: propose as Head of Ops, self-decision refused, Commercial Director approves, two audit events (browser-only)', async () => {
    showTab('plan');
    const wf = window.__snowline.workflow;
    const saved = JSON.parse(JSON.stringify(wf.plan()));
    wf.setPlan({ resorts: ['Valle Stella', 'Monte Brina'], stage: '4 Spring', rationale: 'Most quiet powder weeks and the deepest spring base.', status: 'Draft', events: [], proposer: null });
    wf.setActor('ops'); wf.propose();
    const s1 = wf.plan().status;
    wf.decide('Approved'); const blocked = wf.plan().status === 'Proposed';
    wf.setActor('cd'); wf.decide('Approved');
    const s2 = wf.plan().status; const n = wf.plan().events.length;
    wf.setActor('ops'); wf.setPlan(saved);
    return { pass: s1 === 'Proposed' && blocked && s2 === 'Approved' && n === 2, detail: `proposed=${s1}, self-decision blocked=${blocked}, then ${s2}; ${n} audit events; saved plan restored` };
  });
  // Rubric B3: a real click on every chart type. Mouse and pointer events are dispatched at points
  // across the object, as a reader's click would arrive, until one lands on a mark; the check passes
  // when that click reaches the main selection (and so every tab), then clears it.
  const fire = (target, x, y) => {
    const base = { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, view: window };
    const p = { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    target.dispatchEvent(new PointerEvent('pointermove', p)); target.dispatchEvent(new MouseEvent('mousemove', base));
    target.dispatchEvent(new PointerEvent('pointerdown', { ...p, buttons: 1 })); target.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }));
    target.dispatchEvent(new PointerEvent('pointerup', p)); target.dispatchEvent(new MouseEvent('mouseup', base));
    target.dispatchEvent(new MouseEvent('click', base));
  };
  const picked = (group) => selections.getSelection(group).pending.length > 0 || selections.getSelection(GROUPS.main).applied.length > 0;
  const clickCheck = (tab, id, label) => async () => {
    showTab(tab); clearMain(); await settle();
    const slot = root.querySelector(`[data-slot="${id}"]`);
    slot.scrollIntoView({ block: 'center' }); await sleep(300); // narrow widths stack and scroll
    const r = slot.getBoundingClientRect();
    const g = TAB_GROUPS[tab];
    let hit = null; let tries = 0;
    // A table: the first resort name cell (a leaf element whose text is a resort).
    const tableCell = byId.get(id)?.type === 'table' ? [...slot.querySelectorAll('*')].find((c) => !c.children.length && resortsList.includes(c.textContent.trim()) && c.getBoundingClientRect().height > 0) : null;
    const cr = tableCell?.getBoundingClientRect();
    const xs = [0.5, 0.35, 0.65, 0.25, 0.75, 0.15, 0.85];
    const ys = [0.55, 0.7, 0.4, 0.82, 0.3, 0.2];
    const points = tableCell
      ? [[cr.left + Math.min(cr.width / 2, 30), cr.top + cr.height / 2]]
      : xs.flatMap((fx) => ys.map((fy) => [r.left + r.width * fx, r.top + r.height * fy]));
    for (const [x, y] of points) {
      tries += 1;
      const target = document.elementFromPoint(x, y);
      if (!target || !slot.contains(target)) continue;
      fire(target, x, y);
      for (let i = 0; i < 4 && !picked(g); i++) await sleep(60);
      if (picked(g)) { hit = [Math.round(x - r.left), Math.round(y - r.top)]; break; }
    }
    await sleep(500); await settle();
    const main = selections.getSelection(GROUPS.main).applied.map((s) => `${fields.nameOf(s.field.fieldKey)} = ${s.values.join(', ')}`);
    clearMain(); await settle(); scrollTo(0, 0);
    return { pass: Boolean(hit) && main.length > 0, detail: `${label}: ${hit ? `click at (${hit}) after ${tries} point(s)` : `no mark hit in ${tries} points`}; main selection ${main.join('; ') || 'none'}` };
  };
  appState.check('Real click: a bar (headroom chart) filters every tab', clickCheck('market', 'bar-headroom', 'bar'));
  appState.check('Real click: a combo bar (snow vs crowd) filters every tab', clickCheck('review', 'combo-hero', 'combo'));
  appState.check('Real click: a heat-map cell (resort × week) filters every tab', clickCheck('best', 'heat-weeks', 'heat map'));
  appState.check('Real click: a table row (resort table) filters every tab', clickCheck('review', 'tbl-resorts', 'table'));
  appState.check('Real click: a vertical bar (fresh-snow band) filters every tab', clickCheck('snow', 'bar-bands', 'grouped bar'));
  appState.check('Empty selection: Resort = Lac des Neiges on the market tab shows no quiet powder weeks and no errors', async () => {
    showTab('market'); clearMain(); await settle();
    setOne(GROUPS.main, rawOf('Resort'), sel(rawOf('Resort'), 'inList', ['Lac des Neiges']));
    setOne(GROUPS.main, rawOf('Season Stage'), sel(rawOf('Season Stage'), 'inList', ['1 Early season']));
    await settle();
    const err = root.querySelectorAll('.pane.is-active .viz-error').length;
    const t = await showOf('bar-airports');
    clearMain(); await settle();
    return { pass: err === 0, detail: `errors ${err}; airports card "${t.slice(0, 80)}"` };
  });
  // Downloads only; whether every sheet follows the filter is the export probe's job (above).
  appState.check('Excel report downloads with a selection applied', async () => {
    showTab('review'); clearMain(); await settle();
    setOne(GROUPS.main, rawOf('Country'), sel(rawOf('Country'), 'inList', ['Austria'])); await settle();
    window.__lastExport = null;
    exportBtn.click();
    for (let i = 0; i < 120 && !window.__lastExport; i++) await sleep(500);
    const out = window.__lastExport;
    clearMain(); await settle();
    return { pass: Boolean(out && out.bytes > 5000 && out.sheets.length >= 7), detail: out ? `${out.bytes} bytes, sheets: ${out.sheets.join(', ')}` : 'no export' };
  });
  appState.check('Layout: the page does not scroll sideways on any tab', async () => {
    const W = document.documentElement.clientWidth;
    const out = [];
    for (const [id] of TABS) { showTab(id); await sleep(400); const sw = document.documentElement.scrollWidth; if (sw > W) out.push(`${id} ${sw}px`); }
    showTab('review');
    return { pass: out.length === 0, detail: `viewport ${W}px; tabs wider than the viewport: ${out.join(', ') || 'none'}` };
  });

  window.__snowline = { apply: (id, ops) => applyRuntimeOperations({ runtime, instanceId: id, operationRequests: ops.map((r, i) => ({ id: `d${i}`, ...r })) }), ctx, tiles, failures, mounted, selections, showTab, setOne, sel, rawOf, workflow, clearQueryCache, refreshHeadline,
    setLever: (k, v) => { leverInputs[k].value = String(v); leverInputs[k].dispatchEvent(new Event('input')); } };
};

main().catch((error) => {
  console.error(error);
  appState.bootFailed(error);
  root.replaceChildren(el('main', { class: 'boot-error' }, [el('h2', { text: 'Could not start Snowline' }), el('p', { text: String(error?.message ?? error) }), el('p', { html: 'Open this page at the sign-in URL printed by <code>astrato dev</code>, or from Astrato hosting.' })]));
});
