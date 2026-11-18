/**
 * League Table Climb Planner — an Astrato App for a university's Director of Strategy.
 *
 * Decision: which measures and which rival universities do we focus on to climb the table?
 * Every figure inside a card is a native Astrato object on a stored business question of the
 * "UK University Rankings 2027" semantic layer (catalogue.js / questions.js). The header
 * sentence reads stored measures through one governed query.
 */
import { createAstratoApp } from '@astrato-io/app-runtime';
import { createDefaultVSpec, createVisualizationRuntime, registry } from '@astrato-io/visualizations';
import { createVisualizationAvailableFields } from '@astrato-io/visualizations/definitions';
import { applyRuntimeOperations } from '@astrato-io/visualizations/operations';
import { appState } from './app-state.js';
import { buildTiles, DISPLAY, GROUPS, TAB_GROUPS } from './catalogue.js';
import { createFieldIndex } from './fields.js';
import { fitOps, fitTile, fits, GAIN_DEFAULT, prepareTile, scoreParamOp } from './prepare.js';
import { clearQueryCache, queryLog, throttleQueries } from './throttle.js';
import { createWorkflow, MEASURES } from './workflow.js';
import { buildWorkbook as buildSheets, downloadWorkbook } from './export.js';

const root = document.getElementById('app');
const DEFAULT_US = 'Kent';
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
  ['stand', 'Where we stand', 'Where do we stand, and who is around us?'],
  ['measures', 'What costs us places', 'Which measures cost us places against our rivals?'],
  ['climb', 'What it takes', 'What would a higher total score buy us?'],
  ['focus', 'Focus plan', 'What do we commit to, and has it been approved?'],
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

/** One governed query of stored measures, rows as objects keyed by label. */
const governed = (ctx) => async ({ dims = [], measures = [], filters = [], limit = 500 }) => {
  const f = ctx.fields;
  const dimensions = dims.map((name) => { const d = f.dimension(name); if (!d) throw new Error(`no dimension ${name}`); return { fieldKey: d.rawKey ?? d.fieldKey, label: name }; });
  const calculations = measures.map((name) => { const m = f.measure(name); if (!m) throw new Error(`no measure ${name}`); return { calculation: '{m1}', itemKey: m.fieldKey, label: name }; });
  const query = { dimensions, calculations, orders: [], limit, offset: 0, filters, totals: false, showRecordsCount: false, outerViews: [], associativeListFilter: null };
  const { response } = await ctx.hostServices.engine.getData({ ...ctx.dataBinding, query });
  const data = response?.data ?? {};
  const labels = [...dims, ...measures];
  return Object.keys(data).sort((a, b) => a - b).map((k) => Object.fromEntries(labels.map((l, i) => [l, typeof data[k][i] === 'string' && /^-?\d+(\.\d+)?$/.test(data[k][i]) ? Number(data[k][i]) : data[k][i]])));
};

const main = async () => {
  const ctx = await boot();
  const { runtime, dataBinding, fields } = ctx;
  const { selections } = ctx.hostServices;
  const q = governed(ctx);
  appState.fields?.(fields.available);

  // ---------------------------------------------------- the league, once
  appState.mark('booted');
  // The league and our rank history in parallel: the history asks for the asked-for university
  // (URL, then this browser's last choice) and is asked again only if that name is not in the league.
  let wanted = new URLSearchParams(location.search).get('uni');
  try { wanted ??= localStorage.getItem('climb-planner-us'); } catch { /* ignore */ }
  wanted ??= DEFAULT_US;
  const historyOf = (name) => q({ dims: ['Edition'], measures: ['Historic Rank'], filters: [{ fieldKey: fields.dimension('University (Short)').rawKey, operator: 'inList', values: [name] }] }); // flat, the shape selections send; 0.9 has 400'd `{ field: { fieldKey } }`
  const [league, firstHist] = await Promise.all([
    q({ dims: ['University (Short)'], measures: ['Rank (value)', 'Rank 2026 (value)', 'Avg Total Score'], limit: 200 }),
    historyOf(wanted),
  ]);
  const universities = league.map((r) => r['University (Short)']).sort((a, b) => a.localeCompare(b));
  const us = universities.includes(wanted) ? wanted : DEFAULT_US;
  const ours = league.find((r) => r['University (Short)'] === us);
  const ourScore = ours['Avg Total Score'];
  const ourRank = ours['Rank (value)'];
  const hist = us === wanted ? firstHist : await historyOf(us);
  const rank2025 = hist.find((r) => r.Edition === 2025)?.['Historic Rank'];
  const fiftieth = league.filter((r) => r['Rank (value)'] <= 50).sort((a, b) => b['Rank (value)'] - a['Rank (value)'])[0];
  const lo = Math.max(1, ourRank - 10);
  const hi = ourRank + 10;

  // ---------------------------------------------------- compile + theme
  appState.mark('league-read');
  const built = await buildTiles(fields, us);
  const tiles = [];
  appState.mark('compiled');
  for (const tile of await Promise.all(built.tiles.map(async (tile) => {
    const { vSpec, failed } = await prepareTile(tile, fields.available, { dataBinding, ourScore });
    if (failed.length) console.warn(`[prepare] ${tile.id}`, JSON.stringify(failed));
    return { ...tile, vSpec };
  }))) tiles.push(tile);
  appState.mark('themed');
  const failures = built.failures;
  const byId = new Map(tiles.map((t) => [t.id, t]));

  // ---------------------------------------------------- shell
  const surface = (id) => el('div', { class: 'viz-surface is-loading', 'data-slot': id }, el('span', { class: 'loading', text: 'Loading…' }));
  const card = (id, cls = '', aside = null, sub = null) => {
    const t = byId.get(id);
    return el('figure', { class: `card ${cls}`.trim(), 'data-object': id }, [
      el('figcaption', { class: 'card__head' }, [el('div', {}, [el('h3', { class: 'card__title', text: t?.title ?? id }), sub ? el('p', { class: 'card__sub', text: sub }) : null]), aside]),
      surface(id),
    ]);
  };
  const kpi = (valueId, changeId, sparkId, note, extraClass = '') => el('article', { class: `kpi ${extraClass}`.trim(), 'data-object': valueId }, [
    el('h3', { class: 'kpi__title', text: byId.get(valueId)?.title }),
    el('div', { class: 'kpi__row' }, [el('div', { class: 'kpi__value' }, surface(valueId)), el('div', { class: 'kpi__spark' }, surface(sparkId))]),
    el('div', { class: 'kpi__chg' }, surface(changeId)),
    el('p', { class: 'kpi__note', text: note }),
  ]);

  const uniSelect = el('select', { class: 'us-select', 'aria-label': 'Our university', onchange: (e) => { try { localStorage.setItem('climb-planner-us', e.target.value); } catch { /* */ } const u = new URL(location.href); u.searchParams.set('uni', e.target.value); location.href = u.toString(); } },
    universities.map((u) => el('option', { value: u, text: u, selected: u === us })));
  const exportBtn = el('button', { type: 'button', class: 'btn btn--light', text: 'Excel report', title: 'Download a formatted workbook of every card, following the current filters' });
  const filterBarHost = el('div', { class: 'app-filters' });
  const tabNav = el('nav', { class: 'tabs', role: 'tablist' }, TABS.map(([id, label], i) => el('button', { type: 'button', role: 'tab', class: i === 0 ? 'tab is-active' : 'tab', 'data-tab': id, text: label, onclick: () => showTab(id) })));

  const gainOut = el('output', { class: 'slider__value', text: `+${GAIN_DEFAULT} points` });
  const gainInput = el('input', { type: 'range', min: '0', max: '120', step: '1', value: String(GAIN_DEFAULT), 'aria-label': 'Total score gain' });
  const gainNote = el('p', { class: 'slider__note' });
  const renderGainNote = (g) => { gainNote.textContent = `${us} today: ${Math.round(ourScore)} points, ${ordinal(ourRank)}. With +${g}: ${Math.round(ourScore + g)} points.`; };

  const hero = el('p', { class: 'hero' });
  const ordinal = (n) => `${n}${['th', 'st', 'nd', 'rd'][(n % 100 - 20) % 10] || ['th', 'st', 'nd', 'rd'][n % 100] || 'th'}`;
  const moved = ours['Rank 2026 (value)'] - ourRank;
  const since = rank2025 != null ? rank2025 - ourRank : null;
  hero.append(
    el('b', { text: `${us} is ${ordinal(ourRank)}` }),
    ` — ${moved < 0 ? `down ${-moved}` : moved > 0 ? `up ${moved}` : 'level'} on 2026${since != null ? ` and ${since < 0 ? `down ${-since}` : `up ${since}`} since 2025 (${ordinal(rank2025)})` : ''}. `,
    fiftieth && ourRank > 50 ? el('b', { text: `${Math.round(fiftieth['Avg Total Score'] - ourScore)} points of total score` }) : '',
    fiftieth && ourRank > 50 ? ` separate us from the top 50 (${fiftieth['University (Short)']}, ${Math.round(fiftieth['Avg Total Score'])}).` : '',
  );

  const workflow = createWorkflow({ el, us, universities, onRivals: (rivals) => setFocus(rivals) });

  const panes = {
    stand: el('section', { class: 'pane is-active', 'data-pane': 'stand' }, [
      hero,
      el('div', { class: 'kpis' }, [
        kpi('kpi-us', 'chg-us', 'spark-us', `Pinned to ${us}; ignores the rival filters. Line: rank 2025–27 (top = better).`, 'kpi--us'),
        kpi('kpi-set', 'chg-set', 'spark-set', 'Rivals in view. Line: their average rank by edition.'),
        kpi('kpi-climb', 'chg-climb', 'spark-climb', 'Rivals in view that rose since 2026; change vs the 2025→26 count. Bars: movement mix, green = rose.'),
        kpi('kpi-fall', 'chg-fall', 'spark-fall', 'Rivals in view that fell since 2026; change vs the 2025→26 count (fewer is better). Bars: movement mix, red = fell.'),
      ]),
      el('div', { class: 'grid grid--stand' }, [
        card('bar-moved', 'card--tall', null, `Places moved since 2026; ${us} in teal. Click a bar to filter.`),
        card('tbl-around', 'card--tall', null, `The rivals in view (default: ranks ${lo}–${hi}), with each one's rank across the three editions.`),
      ]),
    ]),
    measures: el('section', { class: 'pane', 'data-pane': 'measures' }, [
      el('div', { class: 'grid grid--measures' }, [
        card('tbl-rankmeasure', 'card--tall', null, 'Rank within the rivals in view on each component (1 = best). Overall = 2027 league rank.'),
        el('div', { class: 'grid grid--quad' }, [
          card('bar-gap-prospects', 'card--quad', null, "Points above (green) or below (red) the rivals' average"),
          card('bar-gap-experience', 'card--quad', null, "Points above (green) or below (red) the rivals' average"),
          card('bar-gap-research', 'card--quad', null, "Points above (green) or below (red) the rivals' average"),
          card('bar-gap-entry', 'card--quad', null, "UCAS points above (green) or below (red) the rivals' average"),
        ]),
      ]),
    ]),
    climb: el('section', { class: 'pane', 'data-pane': 'climb' }, [
      el('div', { class: 'grid grid--climb' }, [
        el('div', { class: 'stack' }, [
          el('div', { class: 'card lever' }, [
            el('h3', { class: 'card__title', text: 'If our total score rose by…' }),
            el('label', { class: 'slider' }, [gainInput, gainOut]),
            gainNote,
            el('button', { type: 'button', class: 'link', text: `Reset to +${GAIN_DEFAULT}`, onclick: () => { gainInput.value = String(GAIN_DEFAULT); gainInput.dispatchEvent(new Event('input')); } }),
          ]),
          el('article', { class: 'kpi kpi--solo', 'data-object': 'kpi-proj' }, [el('h3', { class: 'kpi__title', text: byId.get('kpi-proj')?.title }), el('div', { class: 'kpi__value' }, surface('kpi-proj')), el('p', { class: 'kpi__note', text: `Whole league. Today: ${ordinal(ourRank)}. Ties are not broken.` })]),
          el('article', { class: 'kpi kpi--solo', 'data-object': 'kpi-overtake' }, [el('h3', { class: 'kpi__title', text: byId.get('kpi-overtake')?.title }), el('div', { class: 'kpi__value' }, surface('kpi-overtake')), el('p', { class: 'kpi__note', text: 'Whole league: universities scoring above us today and no more than us plus the gain.' })]),
        ]),
        card('bar-points', 'card--tall', null, `2027 total score minus ${us}'s (${Math.round(ourScore)}); rivals in view. Red = ahead of us.`),
        el('div', { class: 'stack' }, [
          card('tbl-overtake', 'card--half', null, 'Whole league, between our score and our score plus the gain'),
          card('line-set', 'card--half', null, 'Rivals in view; lower is better (axis inverted)'),
        ]),
      ]),
    ]),
    focus: el('section', { class: 'pane', 'data-pane': 'focus' }, [
      el('div', { class: 'grid grid--focus' }, [
        el('div', { class: 'card card--tall card--plan' }, [el('h3', { class: 'card__title', text: `Focus plan for ${us}, 2028 edition` }), workflow.host]),
        el('div', { class: 'stack' }, [
          card('tbl-focus', 'card--half', null, `${us} and the rivals named in the plan; ranks within that set`),
          card('bar-focus-points', 'card--half', null, `Total score minus ${us}'s, for the rivals in the plan`),
        ]),
      ]),
    ]),
  };

  root.replaceChildren(el('div', { class: 'app' }, [
    el('header', { class: 'masthead' }, [
      el('div', { class: 'brand' }, [el('span', { class: 'brand__mark', 'aria-hidden': 'true', html: '<svg viewBox="0 0 32 32" width="26" height="26"><path d="M4 26h6V16H4zm9 0h6V9h-6zm9 0h6V4h-6z" fill="currentColor"/></svg>' }), el('div', {}, [el('b', { text: 'League Table Climb Planner' }), el('span', { text: 'UK university rankings, 2027 edition · semantic layer "UK University Rankings 2027"' })])]),
      el('div', { class: 'masthead__end' }, [el('label', { class: 'us' }, [el('span', { text: 'Our university' }), uniSelect]), exportBtn]),
    ]),
    el('div', { class: 'selbar' }, [
      el('div', { class: 'selbar__filters' }, [
        el('div', { class: 'control', title: 'Nation' }, surface('ctl-nation')),
        el('div', { class: 'control', title: 'University group' }, surface('ctl-group')),
        el('div', { class: 'control', title: 'Rank band' }, surface('ctl-band')),
      ]),
      el('div', { class: 'selbar__chips' }, [filterBarHost, el('button', { type: 'button', class: 'link', text: `Rivals: ±10 places`, title: `Reset the rival set to ranks ${lo}–${hi}`, onclick: () => seedMain() })]),
    ]),
    tabNav,
    el('main', { class: 'panes' }, Object.values(panes)),
    failures.length ? el('section', { class: 'failures' }, [el('h2', { text: `${failures.length} object(s) not shown` }), el('ul', {}, failures.map((f) => el('li', { text: `${f.title ?? f.id}: ${f.reason}` })))]) : null,
    el('datalist', { id: 'uni-list' }, universities.map((u) => el('option', { value: u }))),
  ]));
  renderGainNote(GAIN_DEFAULT);
  // Hidden panes keep the active pane's width so their charts are sized right when shown.
  const syncPaneWidth = () => document.documentElement.style.setProperty('--pane-w', `${document.documentElement.clientWidth}px`);
  syncPaneWidth();
  addEventListener('resize', syncPaneWidth);

  // ---------------------------------------------------- selections
  const rawOf = (dimName) => fields.dimension(dimName)?.rawKey ?? fields.dimension(dimName)?.fieldKey;
  const sel = (fieldKey, operator, values) => ({ field: { fieldKey }, fieldKey, kind: 'VALUE', operator, values });
  const setOne = (group, fieldKey, selection) => {
    const { applied, pending } = selections.getSelection(group);
    for (const s of [...applied, ...pending]) if (s.field?.fieldKey === fieldKey) selections.removeSelection(group, s);
    if (selection) selections.selectValues(group, selection, { state: 'applied' });
  };
  const seedMain = () => {
    selections.clearAllSelections(GROUPS.main);
    setOne(GROUPS.main, rawOf('Rank 2027'), sel(rawOf('Rank 2027'), 'between', [lo, hi]));
  };
  const setOvertake = (gain) => setOne(GROUPS.overtake, rawOf('Total Score (2027)'), sel(rawOf('Total Score (2027)'), 'between', [ourScore + 0.0001, ourScore + gain]));
  const setFocus = (rivals) => setOne(GROUPS.focus, rawOf('University (Short)'), sel(rawOf('University (Short)'), 'inList', [us, ...rivals]));

  let activeTab = 'stand';
  // Mirror main into a tab group by difference, so one click costs one re-query per object.
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
  // Seed every group before any object mounts.
  setOne(GROUPS.us, rawOf('University (Short)'), sel(rawOf('University (Short)'), 'inList', [us]));
  seedMain();
  for (const g of Object.values(TAB_GROUPS)) mirror(g);
  setOvertake(GAIN_DEFAULT);
  setFocus(workflow.plan().rivals);

  selections.onActiveSelectionChange(GROUPS.main).subscribe(() => {
    const g = TAB_GROUPS[activeTab];
    if (g) mirror(g);
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
  for (const g of [GROUPS.us, GROUPS.whatif, GROUPS.overtake, GROUPS.focus]) {
    selections.onActiveSelectionChange(g).subscribe((next) => { if (next.pending.length) selections.clearPendingSelections(g); });
  }

  const showTab = (id) => {
    activeTab = id;
    for (const b of tabNav.children) b.classList.toggle('is-active', b.dataset.tab === id);
    for (const [k, p] of Object.entries(panes)) p.classList.toggle('is-active', k === id);
    const g = TAB_GROUPS[id];
    if (g) mirror(g);
    try { localStorage.setItem('climb-planner-tab', id); } catch { /* */ }
  };
  for (const [id] of TABS) appState.tab(id, () => showTab(id));

  // ---------------------------------------------------- what-if
  let gainTimer = null;
  let gain = GAIN_DEFAULT;
  const applyGain = async () => {
    gainTimer = null;
    setOvertake(gain);
    const t = byId.get('kpi-proj');
    const item = t.resolvedRefs.proj;
    await applyRuntimeOperations({ runtime, instanceId: 'kpi-proj', operationRequests: [{ id: 'p', ...scoreParamOp(item, ourScore + gain) }] });
  };
  gainInput.addEventListener('input', () => {
    gain = Number(gainInput.value);
    gainOut.textContent = `+${gain} points`;
    renderGainNote(gain);
    clearTimeout(gainTimer);
    gainTimer = setTimeout(applyGain, 300);
  });

  // ---------------------------------------------------- mounting
  const mounted = new Map();
  // Room for the table's border and its vertical scrollbar.
  const fitWidth = (slot) => Math.max(200, slot.clientWidth - 30);
  const sizeWatch = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const rec = mounted.get(entry.target.dataset.slot);
      if (!rec || !fits(rec.tile) || !rec.handle) continue;
      const w = fitWidth(entry.target);
      if (Math.abs(w - (rec.fitAt ?? 0)) < 4) continue;
      clearTimeout(rec.fitTimer);
      rec.fitTimer = setTimeout(() => {
        rec.fitAt = w;
        applyRuntimeOperations({ runtime, instanceId: rec.tile.id, operationRequests: fitOps(rec.tile, w).map((r, i) => ({ id: `w${i}`, ...r })) }).catch((e) => console.warn('[fit]', e));
      }, 250);
    }
  });
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

  // The library filter bar shows the main group's chips with × and Clear all.
  runtime.createInstance({ id: 'app-filters', type: 'astrato-app-filter-bar', groupId: GROUPS.main, vSpec: createDefaultVSpec('astrato-app-filter-bar'), dataBinding: { ...dataBinding, fieldMetadata: ctx.metadata } });
  await applyRuntimeOperations({ runtime, instanceId: 'app-filters', operationRequests: [
    { id: 'mode', name: 'setAppFilterBarSelectionMode', payload: 'auto' },
    { id: 'assoc', name: 'setAppFilterBarAssociativeFilterEnabled', payload: false },
    { id: 'ovf', name: 'setAppFilterBarOverflow', payload: 'collapse' },
  ] }).catch((e) => console.warn('[filters] op', e));
  runtime.mount(filterBarHost, 'app-filters').catch((e) => console.error('[filters]', e));

  // Mount order: controls, then the visible tab (values first, minis last), then the rest.
  const order = (t) => (t.type === 'filter' ? 0 : t.tab === activeTab ? (t.minis ? 2 : 1) : (t.minis ? 4 : 3));
  // landing-ready: the first tab a reader sees (and the filter controls) have all answered.
  let landed = false;
  try { const saved = localStorage.getItem('climb-planner-tab'); if (saved && panes[saved]) showTab(saved); } catch { /* */ }
  const landingWait = new Set(tiles.filter((t) => t.type === 'filter' || t.tab === activeTab).map((t) => t.id));
  const queue = [...tiles].sort((a, b) => order(a) - order(b));
  let next = 0;
  const lane = async () => { while (next < queue.length) await mountTile(queue[next++]); };
  const mountedAll = Promise.all(Array.from({ length: LANES }, lane));

  // ---------------------------------------------------- export
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const describeMain = () => selections.getSelection(GROUPS.main).applied.map((s) => `${fields.nameOf(s.field.fieldKey)}: ${s.operator === 'between' ? `${s.values[0]}–${s.values[1]}` : s.values.join(', ')}`).join('; ') || 'none (all 130 universities)';
  /** The workbook Blob under the filters on screen, every tab included. Hidden tabs' groups are
   *  mirrored only while shown, so copy main into every tab group first and wait for the
   *  re-queries; a slider move still inside its debounce is applied first, too. */
  const buildWorkbook = async () => {
    await mountedAll;
    if (gainTimer) { clearTimeout(gainTimer); await applyGain(); }
    for (const g of Object.values(TAB_GROUPS)) mirror(g);
    await sleep(300);
    for (let i = 0; i < 120 && queryLog().some((e) => e.ms == null); i++) await sleep(250);
    await appState.quiet({ paintMs: 0 });
    return buildSheets({
      us, ourRank, ourScore, gain, tabs: TABS, tiles, mounted, plan: workflow.plan(), measures: MEASURES, display: DISPLAY,
      rivalGroups: [GROUPS.main, ...Object.values(TAB_GROUPS)], selectionText: describeMain(),
    });
  };
  let exporting = false;
  exportBtn.addEventListener('click', async () => {
    if (exporting) return;
    exporting = true; exportBtn.disabled = true; exportBtn.textContent = 'Preparing…';
    try { downloadWorkbook(await buildWorkbook()); exportBtn.textContent = 'Excel report'; } catch (e) {
      console.error('[export]', e); exportBtn.textContent = 'Export failed';
      setTimeout(() => { exportBtn.textContent = 'Excel report'; }, 4000);
    } finally { exporting = false; exportBtn.disabled = false; }
  });
  // The smoke test builds the workbook without and with Nation = Scotland on the rival set, from
  // the landing tab, and fails any sheet whose figures do not move. Summary (our university and
  // the what-if), Focus plan (the plan rivals), the audit trail and Definitions rightly stay put.
  appState.exportProbe({
    build: async () => (await buildWorkbook()).blob,
    select: () => { seedMain(); setOne(GROUPS.main, rawOf('Nation'), sel(rawOf('Nation'), 'inList', ['Scotland'])); },
    clear: () => seedMain(),
    exempt: ['Summary', 'Focus plan (tab)', 'Plan audit trail', 'Definitions'],
  });

  await mountedAll;
  appState.mark('mounted-all');

  // ---------------------------------------------------- self-checks (run by the smoke test)
  // Each tab's check selects through the app's real path (a value in the main group, as the
  // filter controls and the selection bar write it; a pending click in the tab's group; the
  // plan's rival list), waits for the queries to finish, reads a KPI and a table or chart,
  // restores the default rival set, and reads them again. None of them writes anywhere.
  const textOf = (id) => (root.querySelector(`[data-slot="${id}"]`)?.innerText ?? '').replace(/\s+/g, ' ').trim();
  /** Queries finished (none open in the scheduler), then the kit's quiet + repaint wait. */
  const settle = async () => {
    await sleep(300);
    for (let i = 0; i < 120 && queryLog().some((e) => e.ms == null); i++) await sleep(250);
    await appState.quiet();
  };
  const visibleObjects = () => document.querySelectorAll('.pane.is-active [data-slot]').length;
  /** Engine queries (not cache hits, not prefetch) sent since `from`. */
  const sentSince = (from) => queryLog().slice(from).filter((e) => !e.cached && !e.prefetch).length;
  /** Instances in a group re-query on its change; only the visible tab's group may move. */
  const selectOnTab = async (tab, dim, values) => {
    showTab(tab); seedMain(); await settle();
    const q0 = queryLog().length; const t0 = performance.now();
    setOne(GROUPS.main, rawOf(dim), sel(rawOf(dim), 'inList', values));
    await settle();
    return { sent: sentSince(q0), ms: Math.round(performance.now() - t0), visible: visibleObjects() };
  };
  const FILTER_CONTROLS = 3; // the three filter controls in the selection bar share the main group
  const budget = (n) => n + FILTER_CONTROLS;

  appState.check('Where we stand: Nation = Scotland changes a KPI, the chart and the table; the default rival set restores them; only this tab re-queries', async () => {
    showTab('stand'); seedMain(); await settle();
    const snap = () => ({ k: textOf('kpi-set'), c: textOf('chg-climb'), t: textOf('tbl-around') });
    const before = snap();
    const q = await selectOnTab('stand', 'Nation', ['Scotland']);
    const during = snap();
    seedMain(); await settle();
    const after = snap();
    const pass = before.k !== '' && during.k !== before.k && during.t !== before.t && after.k === before.k && after.t === before.t && q.sent <= budget(q.visible);
    return { pass, detail: `avg rank "${before.k}" → "${during.k}" → "${after.k}"; table changed ${during.t !== before.t}, restored ${after.t === before.t}; ${q.sent} engine queries for ${q.visible} visible objects + ${FILTER_CONTROLS} filters, ${q.ms} ms` };
  });

  appState.check('Where we stand: clicking a university in "Who moved most" filters the KPIs and the table, and the next tab follows', async () => {
    showTab('stand'); seedMain(); await settle();
    const before = { k: textOf('kpi-set'), t: textOf('tbl-around') };
    // The real click path: a pending selection in the tab group, applied to main by the app.
    selections.selectValues(GROUPS.stand, sel(rawOf('University (Short)'), 'inList', ['Lincoln']), { state: 'pending' });
    await sleep(400); await settle();
    const during = { k: textOf('kpi-set'), t: textOf('tbl-around') };
    const inMain = selections.getSelection(GROUPS.main).applied.some((x) => x.values?.includes('Lincoln'));
    showTab('measures'); await settle();
    const other = textOf('tbl-rankmeasure');
    const followed = other.includes('Lincoln') && !other.includes('Portsmouth');
    showTab('stand'); seedMain(); await settle();
    const after = { k: textOf('kpi-set'), t: textOf('tbl-around') };
    const pass = inMain && during.k !== before.k && during.t !== before.t && followed && after.k === before.k && after.t === before.t;
    return { pass, detail: `"${before.k}" → "${during.k}" (in main: ${inMain}); measures tab follows: ${followed}; restored "${after.k}"` };
  });

  appState.check('What costs us places: Nation = Scotland changes the rank-on-measure table; restoring brings it back; only this tab re-queries', async () => {
    showTab('measures'); seedMain(); await settle();
    const before = textOf('tbl-rankmeasure');
    const q = await selectOnTab('measures', 'Nation', ['Scotland']);
    const during = textOf('tbl-rankmeasure');
    seedMain(); await settle();
    const after = textOf('tbl-rankmeasure');
    const pass = before !== '' && during !== before && /Robert Gordon|Abertay|Queen Margaret/.test(during) && after === before && q.sent <= budget(q.visible);
    return { pass, detail: `table changed ${during !== before} (shows the Scottish rivals in ranks 54–74: ${/Robert Gordon|Abertay|Queen Margaret/.test(during)}), restored ${after === before}; ${q.sent} engine queries for ${q.visible} visible objects + ${FILTER_CONTROLS} filters, ${q.ms} ms` };
  });

  appState.check('What it takes: a rival filter re-queries the points-gap chart and the average-rank line only; the whole-league KPIs and overtake table stay', async () => {
    showTab('climb'); seedMain(); await settle();
    const before = { p: textOf('kpi-proj'), o: textOf('kpi-overtake'), t: textOf('tbl-overtake') };
    const q = await selectOnTab('climb', 'Nation', ['Wales']);
    const during = { p: textOf('kpi-proj'), o: textOf('kpi-overtake'), t: textOf('tbl-overtake') };
    seedMain(); await settle();
    // The two chart objects in the tab's group are the ones that must re-query (2), within budget.
    const pass = q.sent >= 2 && q.sent <= budget(q.visible) && during.p === before.p && during.o === before.o && during.t === before.t;
    return { pass, detail: `${q.sent} engine queries for ${q.visible} visible objects + ${FILTER_CONTROLS} filters; projected "${before.p}" unchanged ${during.p === before.p}, overtake table unchanged ${during.t === before.t}` };
  });

  appState.check('What it takes: +52 points projects rank 50 and lists more universities overtaken; back to +25 restores', async () => {
    showTab('climb'); await settle();
    const before = { p: textOf('kpi-proj'), o: textOf('kpi-overtake'), t: textOf('tbl-overtake') };
    window.__climb.setGain(52); await sleep(600); await settle();
    const during = { p: textOf('kpi-proj'), o: textOf('kpi-overtake'), t: textOf('tbl-overtake') };
    window.__climb.setGain(GAIN_DEFAULT); await sleep(600); await settle();
    const after = { p: textOf('kpi-proj'), o: textOf('kpi-overtake'), t: textOf('tbl-overtake') };
    const pass = during.p.includes('50') && during.o !== before.o && during.t !== before.t && after.p === before.p && after.o === before.o;
    return { pass, detail: `projected "${before.p}" → "${during.p}" → "${after.p}"; overtaken "${before.o}" → "${during.o}"; table changed ${during.t !== before.t}` };
  });

  appState.check('Focus plan: naming rivals in the plan changes the focus table; removing them restores it (browser-only plan, saved plan put back)', async () => {
    showTab('focus'); await settle();
    const saved = workflow.plan();
    const keep = { measures: [...(saved.measures ?? [])], rivals: [...(saved.rivals ?? [])], rationale: saved.rationale ?? '' };
    workflow.setPlan({ rivals: [] }); await settle();
    const before = textOf('tbl-focus');
    workflow.setPlan({ rivals: ['Portsmouth', 'Lincoln', 'Aberystwyth'] }); await settle();
    const during = textOf('tbl-focus');
    workflow.setPlan({ rivals: [] }); await settle();
    const after = textOf('tbl-focus');
    workflow.setPlan(keep); await settle();
    const pass = during !== before && during.includes('Lincoln') && after === before;
    return { pass, detail: `rows before "${before.slice(0, 40)}…"; with three rivals shows Lincoln ${during.includes('Lincoln')}; restored ${after === before}` };
  });

  appState.check('Focus plan workflow: propose as Director, self-approval refused, Vice-Chancellor approves, two audit events (browser-only)', async () => {
    showTab('focus');
    const wf = window.__climb.workflow;
    const saved = JSON.parse(JSON.stringify(wf.plan()));
    wf.setPlan({ measures: ['prospects', 'experience'], rivals: ['Portsmouth', 'Lincoln', 'Aberystwyth'], rationale: 'Prospects and experience are where we trail the rivals around us most.', status: 'Draft', events: [] });
    wf.setActor('dos'); wf.propose();
    const s1 = wf.plan().status;
    wf.setActor('vc'); const p = wf.plan(); p.proposer = 'vc'; wf.decide('Approved'); const blocked = wf.plan().status === 'Proposed';
    p.proposer = 'dos'; wf.decide('Approved');
    const s2 = wf.plan().status; const n = wf.plan().events.length;
    wf.setActor('dos'); wf.setPlan(saved); await settle();
    return { pass: s1 === 'Proposed' && blocked && s2 === 'Approved' && n === 2, detail: `proposed=${s1}, self-approval blocked=${blocked}, then ${s2}; ${n} audit events; saved plan restored` };
  });

  appState.check('Empty selection: Nation = Wales with rank band 1–10 shows no rows and no errors; restoring brings the rivals back', async () => {
    showTab('stand'); seedMain(); await settle();
    const before = textOf('tbl-around');
    selections.clearAllSelections(GROUPS.main);
    setOne(GROUPS.main, rawOf('Nation'), sel(rawOf('Nation'), 'inList', ['Wales']));
    setOne(GROUPS.main, rawOf('Rank 2027'), sel(rawOf('Rank 2027'), 'between', [1, 10]));
    await settle();
    const during = { t: textOf('tbl-around'), k: textOf('kpi-set'), err: root.querySelectorAll('.pane.is-active .viz-error').length };
    seedMain(); await settle();
    const after = textOf('tbl-around');
    const pass = during.err === 0 && !/Bangor|Cardiff|Swansea|Aberystwyth/.test(during.t) && after === before;
    return { pass, detail: `table "${during.t.slice(0, 60)}", KPI "${during.k}", errors ${during.err}; restored ${after === before}` };
  });

  appState.check('Excel report downloads with a selection applied', async () => {
    showTab('stand'); seedMain(); await settle();
    setOne(GROUPS.main, rawOf('Nation'), sel(rawOf('Nation'), 'inList', ['England'])); await settle();
    window.__lastExport = null;
    exportBtn.click();
    for (let i = 0; i < 60 && !window.__lastExport; i++) await sleep(500);
    const out = window.__lastExport;
    seedMain(); await settle();
    return { pass: Boolean(out && out.bytes > 5000 && out.sheets.length >= 6), detail: out ? `${out.bytes} bytes, sheets: ${out.sheets.join(', ')}` : 'no export' };
  });

  appState.check('Layout: nothing overflows the viewport width', async () => {
    const W = document.documentElement.clientWidth;
    const wide = [...document.querySelectorAll('.app *')].filter((n) => !n.closest('.pane:not(.is-active)') && n.getBoundingClientRect().right > W + 1)
      .slice(0, 5).map((n) => `${n.tagName.toLowerCase()}.${String(n.className).split(' ')[0]} ${Math.round(n.getBoundingClientRect().right)}`);
    return { pass: wide.length === 0, detail: `viewport ${W}px; overflowing: ${wide.join(', ') || 'none'}` };
  });

  window.__climb = { ctx, tiles, failures, mounted, selections, showTab, seedMain, setOne, sel, rawOf, workflow, setGain: (g) => { gainInput.value = String(g); gainInput.dispatchEvent(new Event('input')); }, clearQueryCache, us, ourScore, ourRank };
};

main().catch((error) => {
  console.error(error);
  appState.bootFailed(error);
  root.replaceChildren(el('main', { class: 'boot-error' }, [el('h2', { text: 'Could not start the Climb Planner' }), el('p', { text: String(error?.message ?? error) }), el('p', { html: 'Open this page at the sign-in URL printed by <code>astrato dev</code>, or from Astrato hosting.' })]));
});
