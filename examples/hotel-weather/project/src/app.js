/**
 * Hotel demand × weather: three sources on one page and one Astrato selection.
 *
 *   Governed  native Astrato objects on the semantic layer; each shows a stored business question.
 *   API       DuckDB-WASM holds the Open-Meteo weather archive for the same cities, in the browser.
 *   Blended   one governed query (a stored question) is copied into DuckDB and joined to the weather.
 *
 * The reader is a hotel revenue manager deciding whether a wet-night offer is worth running.
 *   Weather & demand  how full the hotels were, how wet it was, and whether rain moved demand
 *   Wet-night offer   a governed what-if (layer parameters: baseline against scenario), and the one
 *                     recorded action: flag a city-week for the offer, approved by a general manager
 *   Queries           every statement both engines ran
 *
 * The DuckDB objects are the same native Astrato object types, mounted by a second visualization
 * runtime whose engine answers from DuckDB (duck-engine.js) but whose selection service is the
 * app's real one. Governed objects read that service through a scope that hides the browser-only
 * weather keys (selection-scope.js). A click on any chart, the City filter or a table row is one
 * selection that every object follows.
 *
 * Right-click any card for its SQL: DuckDB statements as they ran, governed statements as the
 * engine compiles their stored question (governed-sql.js), plus the selections it adds.
 */
import { createAstratoApp } from '@astrato-io/app-runtime';
import { createVisualizationRuntime, registry } from '@astrato-io/visualizations';
import { createVisualizationAvailableFields } from '@astrato-io/visualizations/definitions';
import { applyRuntimeOperations } from '@astrato-io/visualizations/operations';
import { appState } from './app-state.js';
import { throttleQueries } from './throttle.js';
import { createFieldIndex } from './fields.js';
import { startWeather, loadDemand, query as duckQuery } from './duck.js';
import * as duck from './duck-engine.js';
import { API_URL, CITIES } from './weather-source.js';
import { EXTRACT_QUESTION } from './questions.js';
import { GOVERNED_SQL } from './governed-sql.js';
import { TILES, FILTERS, PARAMS, C, resolver, prepare, widthOps, paramOps, lyColumnOps } from './tiles.js';
import { buildWorkbook } from './export.js';
import { governedSelections, withoutEmpty, hasEmpty } from './selection-scope.js';
import { createOfferStore, ROLES, upcomingWeeks } from './offers.js';

const GROUP = 'main';
const PLAN = 'plan'; // the offer tab's governed objects: mirrored from GROUP only while the tab is shown
const $ = (id) => document.getElementById(id);
const esc = (t) => String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const num = (v, d = 0) => (v == null || Number.isNaN(v) ? '–' : Number(v).toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: d }));
const signed = (v, d = 1, unit = '') => (v == null ? '–' : `${v > 0 ? '+' : v < 0 ? '−' : ''}${num(Math.abs(v), d)}${unit}`);
const usd = (v) => (v == null ? '–' : `${v < 0 ? '−' : ''}$${num(Math.abs(v), 0)}`);
const nameOf = (key) => /\.\[([^\]]+)\]$/.exec(key ?? '')?.[1] ?? key;
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
const TAG = { gov: ['gov', 'Governed'], duck: ['duck', 'API'], mix: ['mix', 'Blended'] };
const kindOf = (tile) => (tile.src === 'gov' ? 'gov' : tile.blend ? 'mix' : 'duck');

/* ---------------------------------------------------------------- page shell */

const KPI_CARDS = [['k-occ', 's-occ'], ['k-rev', 's-rev'], ['k-temp', 's-temp'], ['k-wet', 's-wet'], ['k-gap', 's-gap']];
const BLEND_SOURCE = 'governed rows (a stored question) joined to the weather';
// [id, note, colour key (HTML, written here, not from data)]: two-series charts carry their key in
// the card instead of a chart legend, which pages with arrows on a narrow card.
const CHARTS = [
  ['g-city', 'Aug–Oct 2026 · click a city to filter everything'],
  ['g-occ', 'Aug–Oct 2026 · drag along the date axis to pick nights'],
  ['g-table', 'Aug–Oct 2026 against Aug–Oct 2025 · click a row to filter'],
  ['d-temp', 'Open-Meteo archive · read-only: pick nights on the occupancy chart', '<i class="sw duck"></i>daily high <i class="sw ink"></i>7-night average'],
  ['d-rain', `Dry: under 1 mm · wet: 5 mm+ · ${BLEND_SOURCE} · click a city`, '<i class="sw dry"></i>dry nights <i class="sw wet"></i>wet nights'],
  ['d-band', `Nightly occupancy by that day's high · ${BLEND_SOURCE} · click a band`],
];
const tileOf = (id) => TILES.find((t) => t.id === id);
const titleOf = (t) => t.question ?? t.title;
const tagHtml = (tile) => { const [cls, text] = TAG[kindOf(tile)]; return `<span class="tag ${cls}">${text}</span>`; };
const leverHtml = (name) => { const p = PARAMS[name]; return `
  <label class="lever"><span class="lname">${esc(p.label)}</span>
    <input type="range" id="lv-${name}" min="${p.min}" max="${p.max}" step="${p.step}" value="${p.fallback}">
    <output id="lo-${name}"></output></label>`; };

document.getElementById('root').innerHTML = `
<div class="page">
  <header class="top">
    <div class="titles">
      <h1>Hotel demand × weather · Aug–Oct 2026</h1>
      <p class="sub">Twelve fictional hotels (synthetic demand) next to real weather from the <a href="${esc(API_URL)}" target="_blank" rel="noopener">Open-Meteo archive</a>, joined in your browser. Right-click a card for its SQL.</p>
    </div>
    <div class="legend"><span class="tag gov">Governed</span> semantic layer <span class="tag duck">API</span> weather, in the browser <span class="tag mix">Blended</span> both, joined in the browser<span class="ro">KPI mini charts and the temperature line are read-only</span></div>
  </header>
  <div class="hero" id="hero">Reading demand and weather…</div>
  <div class="bar">
    <nav class="tabs" role="tablist">
      <button role="tab" class="tab" data-tab="dash" aria-selected="true">Weather &amp; demand</button>
      <button role="tab" class="tab" data-tab="plan" aria-selected="false">Wet-night offer</button>
      <button role="tab" class="tab" data-tab="queries" aria-selected="false">Queries <span id="sqlcount">0</span></button>
    </nav>
    <div class="filter-slot" id="f-city"></div>
    <div id="chips"><span class="none">Loading…</span></div>
    <button class="btn" id="clear" disabled>Clear all</button>
    <button class="btn primary" id="export" disabled title="Download the report as Excel, following the current selections">Excel report</button>
  </div>
  <div class="content">
    <section class="pane dash" id="pane-dash">
      <section class="kpis">${KPI_CARDS.map(([id, spark]) => { const t = tileOf(id); return `
        <div class="kpi ${kindOf(t)}" data-sql="${id}"><div class="head"><span title="${esc(titleOf(t))}">${esc(titleOf(t))}</span>${tagHtml(t)}</div>
          <div class="value" id="${id}"></div><div class="cmp" data-cmp="${id}">&nbsp;</div><div class="spark" id="${spark}" title="Mini chart: read-only"></div></div>`; }).join('')}
      </section>
      <section class="grid">${CHARTS.map(([id, note, key]) => { const t = tileOf(id); return `
        <div class="card" data-sql="${id}"><h2><span class="q">${esc(titleOf(t))}</span>${tagHtml(t)}</h2><p${t.blend ? ` title="${esc(`Stored question: ${EXTRACT_QUESTION}`)}"` : ''}>${esc(note)}</p>${key ? `<p class="key">${key}</p>` : ''}<div class="viz" id="${id}"></div></div>`; }).join('')}
      </section>
    </section>
    <section class="pane plan off" id="pane-plan" aria-hidden="true">
      <div class="plan-col">
        <div class="card levers" data-sql="p-rev">
          <h2><span class="q">${esc(titleOf(tileOf('p-rev')))}</span><span class="tag gov">Governed</span></h2>
          <p>The layer computes the scenario from its own measures; you set the offer's three parameters. The wet-night share starts at what the weather shows for this selection.</p>
          ${Object.keys(PARAMS).map(leverHtml).join('')}
          <div class="leverfoot"><span id="wet-src" class="tag duck">API</span><span id="wet-note">observed share</span><button class="btn small" id="wet-reset" disabled>Use observed</button></div>
        </div>
        <div class="card bvs">
          <div class="bvs-grid">
            <span></span><b>As booked</b><b>With the offer</b>
            <span class="rowl">Room revenue</span><div class="num" data-sql="p-base"><div class="viz" id="p-base"></div></div><div class="num" data-sql="p-rev"><div class="viz" id="p-rev"></div></div>
            <span class="rowl">Occupancy</span><div class="num" data-sql="p-occb"><div class="viz" id="p-occb"></div></div><div class="num" data-sql="p-occ"><div class="viz" id="p-occ"></div></div>
          </div>
          <p class="verdict" id="verdict">&nbsp;</p>
          <h3 class="sub3" data-sql="p-bridge">${esc(titleOf(tileOf('p-bridge')))}</h3>
          <p class="key"><i class="sw good"></i>extra wet-night rooms <i class="sw bad"></i>discount to guests already booked <i class="sw gov"></i>net change</p>
          <div class="viz bridge" id="p-bridge" data-sql="p-bridge"></div>
        </div>
      </div>
      <div class="card" data-sql="p-city"><h2><span class="q">${esc(titleOf(tileOf('p-city')))}</span><span class="tag gov">Governed</span></h2>
        <p>Room revenue the offer adds per city at the levers on the left (extra wet-night rooms at the discounted rate, less the discount to guests already booked) · click a city</p><div class="viz" id="p-city"></div></div>
      <div class="card offers">
        <h2><span class="q">Which city-weeks should get the offer?</span><span class="tag demo">Demo workflow</span></h2>
        <p class="fallback"><b>Labelled fallback:</b> flags and their audit trail are kept in this browser only. Viewers of this example cannot write to the warehouse; in production they are writeback rows in governed views.</p>
        <div class="who"><label>Acting as <select id="role">${Object.values(ROLES).map((x) => `<option value="${x.id}">${esc(x.person)} · ${esc(x.title)}</option>`).join('')}</select></label></div>
        <div class="flagform"><select id="flag-city" aria-label="City">${CITIES.map(([c]) => `<option>${esc(c)}</option>`).join('')}</select><select id="flag-week" aria-label="Week commencing">${upcomingWeeks().map((w) => `<option value="${w}">w/c ${new Date(`${w}T00:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })}</option>`).join('')}</select><button class="btn primary" id="flag-btn">Flag for offer</button></div>
        <div id="flag-msg" class="msg" role="status">&nbsp;</div>
        <ol id="flags" class="flags"></ol>
        <div class="audithead"><b>Audit trail</b><button class="btn small" id="reset">Reset demo</button></div>
        <ol id="audit" class="audit"></ol>
      </div>
    </section>
    <section class="log" id="queries" hidden>
      <p class="lognote">Every query the page has run, newest first. <b>Astrato</b> queries run in the governed engine on the warehouse; <b>Browser</b> queries run on the weather and the governed extract inside this page.</p>
      <ol id="sqllog"></ol>
    </section>
  </div>
</div>
<div id="sqlpop" class="pop" hidden role="dialog" aria-modal="true" aria-labelledby="poptitle">
  <div class="popbox"><div class="pophead"><b id="poptitle"></b><span id="popsrc" class="tag"></span><button id="popcopy">Copy</button><button id="popclose" aria-label="Close">×</button></div><div class="popbody" id="popbody"></div></div>
</div>`;

// Read-only objects: the KPI mini charts and the temperature line take no clicks or drags (a drag
// on the API date axis selected every night), so pointer presses never reach them; hover still works.
for (const el of document.querySelectorAll('.spark, #d-temp')) {
  for (const type of ['pointerdown', 'mousedown', 'click', 'touchstart']) el.addEventListener(type, (e) => { e.stopPropagation(); e.preventDefault(); }, true);
}

/* ---------------------------------------------------------------- query log (both engines) */

let logged = 0;
const lastSql = new Map(); // the last browser statement per asker
const log = ({ source, label, sql, ms, rows, cached }) => {
  logged += 1;
  $('sqlcount').textContent = String(logged);
  const li = document.createElement('li');
  li.className = source;
  li.innerHTML = '<div class="meta"><span class="src"></span><b></b><span></span></div><pre></pre>';
  li.querySelector('.src').textContent = source === 'duck' ? 'Browser' : 'Astrato';
  li.querySelector('b').textContent = label;
  li.querySelector('.meta span:last-child').textContent = `${rows} row${rows === 1 ? '' : 's'} · ${Math.round(ms)} ms${cached ? ' · from the session cache' : ''}`;
  li.querySelector('pre').textContent = sql;
  $('sqllog').prepend(li);
  while ($('sqllog').children.length > 60) $('sqllog').lastChild.remove();
};

/* ---------------------------------------------------------------- errors after landing */

// The smoke test reads appState; an object that breaks after it rendered (a later selection, a
// resize) must show up there too, not only in the console.
const late = (window.__appState.lateErrors ??= []);
const consoleError = console.error.bind(console);
console.error = (...args) => {
  const text = args.map((a) => (a instanceof Error ? a.message : typeof a === 'string' ? a : '')).join(' ');
  if (/visualization reported an error|Cannot read properties|Astrato SDK request failed/i.test(text)) late.push({ at: Math.round(performance.now() - window.__appState.startedAt), text: text.slice(0, 300) });
  consoleError(...args);
};
window.addEventListener('unhandledrejection', (e) => late.push({ at: Math.round(performance.now() - window.__appState.startedAt), text: `unhandled: ${String(e.reason?.message ?? e.reason).slice(0, 300)}` }));

/* ---------------------------------------------------------------- boot */

const main = async () => {
  for (const t of [...TILES, ...FILTERS]) appState.declare(t.id, t.type === 'filter' ? null : t.tab);
  appState.tab('dash', () => showTab('dash'));
  appState.tab('plan', () => showTab('plan'));
  appState.tab('queries', () => showTab('queries'));

  const app = await createAstratoApp();
  const { engine, selections } = app.client.hostServices;
  throttleQueries(engine, ({ request, response, ms, cached }) => {
    const q = request?.query ?? {};
    const names = [...(q.dimensions ?? []), ...(q.calculations ?? [])].map((d) => nameOf(d.itemKey ?? d.fieldKey));
    const filters = (q.filters ?? []).map((f) => `${f.fieldKey ?? f.field?.fieldKey} in (${(f.values ?? []).slice(0, 6).join(', ')}${(f.values ?? []).length > 6 ? ', …' : ''})`);
    log({ source: 'gov', label: names.slice(0, 4).join(' × '), ms, cached, rows: Object.keys(response?.response?.data ?? {}).length,
      sql: `Governed query on the semantic layer\n  asks for: ${names.join(', ') || '–'}${filters.length ? `\n  filters:  ${filters.join('; ')}` : ''}` });
  });

  // The weather bands exist only in DuckDB. A governed chart asks the engine whether a selected
  // field is connected to its own; for a key the layer does not have the SDK throws instead of
  // answering. Answer "not connected". (The scope below already hides those keys; this is a backstop.)
  const connected = engine.areFieldsConnected.bind(engine);
  engine.areFieldsConnected = (a, b) => { try { return connected(a, b); } catch { return false; } };

  const metadata = await engine.fields.getFieldMetadata({ ...app.dataBinding });
  const govFields = createVisualizationAvailableFields(metadata).filter((f) => f?.resultType !== 'unhandled');
  appState.fields(govFields);
  const fields = createFieldIndex(govFields);

  /** A selection on a governed dimension key is stored under its view column; read it as that. */
  const keyOf = (x) => { const k = x.field?.fieldKey ?? x.fieldKey; return fields.all.find((f) => f.fieldKey === k && f.kind === 'dimension')?.rawKey ?? k; };
  const CITY = fields.selectionKey('City');
  const DATE = fields.selectionKey('Stay Date');
  const GOVERNED_KEYS = new Set([CITY, DATE]);
  // Governed objects see the one selection group through a scope that hides the browser-only
  // weather keys (selection-scope.js): a band click never reaches them, so it cannot blank them.
  const isGoverned = (k) => GOVERNED_KEYS.has(fields.all.find((f) => f.fieldKey === k && f.kind === 'dimension')?.rawKey ?? k);
  const govClient = { ...app.client, hostServices: { ...app.client.hostServices, selections: governedSelections(selections, isGoverned) } };
  const govRuntime = createVisualizationRuntime({ client: govClient, registry, readyTimeoutMs: 60_000 });
  const govBinding = { ...app.dataBinding, fieldMetadata: metadata };
  const r = { gov: resolver('gov', fields, duck), duck: resolver('duck', null, duck) };
  const applied = (group = GROUP) => (selections.getSelection(group)?.applied ?? []).filter((x) => (x.values ?? []).length);
  const dateSelected = () => applied().some((x) => keyOf(x) === DATE);
  const govFilters = () => applied().filter((x) => GOVERNED_KEYS.has(keyOf(x))).map((x) => ({ fieldKey: keyOf(x), operator: 'inList', values: x.values }));
  const sig = (list) => JSON.stringify(list.map((x) => [keyOf(x), x.values]).sort());

  /** A governed query by item names (text figures, the extract, Excel). */
  const gov = async ({ dims = [], measures, filters = govFilters(), limit = 500 }) => {
    const dimensions = dims.map((d) => ({ itemKey: r.gov.dim(d), label: d }));
    const calculations = measures.map((m) => ({ calculation: '{m1}', itemKey: r.gov.measure(m), label: m }));
    const query = { dimensions, calculations, orders: [], limit, offset: 0, filters, totals: false, showRecordsCount: false, outerViews: [], associativeListFilter: null };
    const { response } = await engine.getData({ ...app.dataBinding, query });
    const names = [...dims, ...measures];
    return Object.values(response?.data ?? {}).map((row) => Object.fromEntries(names.map((n, i) => [n, row[i]])));
  };

  // Charts write clicks and range drags as pending selections. There is no Apply button, so a
  // pending selection is applied once the chart has been quiet for a moment (a drag updates it on
  // every move). An entry with no values (a drag that ended off the data) selects nothing: it is
  // dropped, so it never reaches the engine (an empty IN list is refused) or lingers in the bar.
  for (const group of [GROUP, PLAN]) {
    let applyTimer;
    selections.onActiveSelectionChange(group).subscribe((next) => {
      clearTimeout(applyTimer);
      if (!(next?.pending ?? []).length) return;
      applyTimer = setTimeout(() => {
        const now = selections.getSelection(group);
        if (hasEmpty(now)) selections.setNewSelectionState(group, withoutEmpty(now));
        if ((selections.getSelection(group)?.pending ?? []).length) selections.applyPendingSelections(group);
      }, 250);
    });
    selections.onActiveSelectionChangeApplied(group).subscribe((now) => {
      if (hasEmpty(now)) selections.setNewSelectionState(group, withoutEmpty(selections.getSelection(group)));
    });
  }

  /* ---------- levers (the what-if's layer parameters) */
  const levers = Object.fromEntries(Object.entries(PARAMS).map(([k, p]) => [k, p.fallback]));
  let wetObserved = null;
  let wetFollows = true;

  /* ---------- mounting: one function for both runtimes */
  const handles = new Map();
  const vSpecs = new Map(); // KPI id → { with, without } comparison
  const refsOf = new Map(); // tile id → the compiled definition's resolved refs (operation targets)
  const duckState = { runtime: null, fields: null, binding: null, engine: null };
  const rtOf = (tile) => (tile.src === 'gov' ? { runtime: govRuntime, avail: govFields, binding: govBinding, res: r.gov } : { runtime: duckState.runtime, avail: duckState.fields, binding: duckState.binding, res: r.duck });
  const mount = async (tile) => {
    try {
      const { runtime, avail, binding, res } = rtOf(tile);
      const { vSpec, refusals, resolvedRefs } = await prepare(tile, res, avail, { ...(tile.type === 'table' ? { tableWidth: $(tile.id).clientWidth } : {}), params: levers });
      refsOf.set(tile.id, resolvedRefs);
      if (refusals.length) console.warn('[operations refused]', refusals);
      if (tile.type === 'number' && tile.comparison && tile.tab === 'dash') vSpecs.set(tile.id, { with: vSpec, without: (await prepare(tile, res, avail, { withComparison: false })).vSpec });
      runtime.createInstance({ id: tile.id, type: tile.type, groupId: tile.tab === 'plan' ? PLAN : GROUP, vSpec, dataBinding: binding });
      const handle = await runtime.mount($(tile.id), tile.id);
      handles.set(tile.id, handle);
      const ready = await handle.ready;
      appState.settle(tile.id, ready?.status === 'rendered' && refusals.length ? 'refused-operations' : ready?.status, refusals.length ? refusals.join('; ') : ready);
    } catch (error) {
      console.error('[mount]', tile.id, error);
      appState.settle(tile.id, 'error', error);
    }
  };

  // Governed objects first: they need nothing from the browser side. The offer tab is preloaded
  // off-screen (never display:none) so it shows at once.
  const govTiles = [...FILTERS, ...TILES.filter((t) => t.src === 'gov')];
  const govMounted = Promise.all(govTiles.map(mount));

  // The browser side: weather from the API, then one governed query copied in and joined.
  const t0 = performance.now();
  const [weatherRows, extract] = await Promise.all([
    startWeather(),
    gov({ dims: ['City', 'Stay Date'], measures: ['Occupancy', 'Room Nights'], filters: [{ fieldKey: '[Calendar].[Rolling Bucket]', operator: 'inList', values: ['L3M', 'L3M LY'] }], limit: 5000 }),
  ]);
  const demandRows = extract.map((x) => ({ city: x.City, date: duck.isoOf(x['Stay Date']), occupancy: x.Occupancy, roomNights: x['Room Nights'] }));
  const joined = await loadDemand(demandRows);
  console.info(`[blend] ${demandRows.length} governed rows · ${weatherRows} weather rows · ${joined} joined · ${((performance.now() - t0) / 1000).toFixed(1)} s`);

  const engineDuck = duck.createDuckEngine({ query: duckQuery, selections, group: GROUP, keyOf, onSql: ({ sql, label, key, ms, rows, cached }) => {
    lastSql.set(key, sql);
    appState.query(`duck ${key}`, ms, cached);
    log({ source: 'duck', label, sql, ms, rows, cached });
  } });
  duckState.engine = engineDuck;
  duckState.fields = createVisualizationAvailableFields(duck.FIELD_METADATA).filter((f) => f?.resultType !== 'unhandled');
  duckState.binding = { datasourceType: 'snowflake', fieldMetadata: duck.FIELD_METADATA };
  duckState.runtime = createVisualizationRuntime({ client: { hostServices: { engine: engineDuck.engine, selections, variables: { getVariables: async () => [] } } }, registry, readyTimeoutMs: 60_000 });
  await Promise.all([govMounted, ...TILES.filter((t) => t.src === 'duck').map(mount)]);
  appState.mark('landing-ready');

  // Table columns have fixed widths sized to the card: when the card changes width, resize the
  // columns with an operation (never a remount).
  for (const t of TILES.filter((x) => x.type === 'table')) {
    let timer; let last = $(t.id).clientWidth;
    new ResizeObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const w = $(t.id).clientWidth;
        if (Math.abs(w - last) < 4) return;
        last = w;
        applyRuntimeOperations({ runtime: govRuntime, instanceId: t.id, availableFields: govFields, operationRequests: widthOps(t, refsOf.get(t.id), w) })
          .catch((e) => console.warn('[table widths]', e?.message));
      }, 200);
    }).observe($(t.id));
  }

  /* ---------- figures for the headline, KPI colours, levers, checks and Excel */
  const duckFigures = async () => {
    const w = engineDuck.where();
    const m = duck.MEASURES;
    const [[a] = [], [b] = []] = await Promise.all([
      engineDuck.run(`SELECT ${m['Average high'][0]} AS hi, ${m['Average high vs last autumn'][0]} AS hi_vs, ${m['Wet city-days'][0]} AS wet, ${m['Wet city-days vs last autumn'][0]} AS wet_vs, ${m['Wet share'][0]} AS wet_share FROM weather ${w}`, 'Figures · weather'),
      engineDuck.run(`SELECT ${m['Wet vs dry nights'][0]} AS gap, ${m['Wet vs dry nights vs last autumn'][0]} AS gap_vs, ${m['Wet vs dry nights last autumn'][0]} AS gap_ly FROM blend ${w}`, 'Figures · blend'),
    ]);
    return { hi: a?.hi, hiVsLy: a?.hi_vs, wet: a?.wet, wetVsLy: a?.wet_vs, wetShare: a?.wet_share, gap: b?.gap, gapVsLy: b?.gap_vs, gapLy: b?.gap_ly };
  };
  const readFigures = async () => {
    const [[g = {}], d] = await Promise.all([gov({ measures: ['Occupancy L3M', 'Occupancy L3M vs LY', 'Room Revenue L3M', 'Room Revenue L3M YoY'], limit: 1 }), duckFigures()]);
    return { occ: g['Occupancy L3M'], occVsLy: g['Occupancy L3M vs LY'], rev: g['Room Revenue L3M'], revYoY: g['Room Revenue L3M YoY'], ...d };
  };

  const COMPARE = { // figure key of the change, its unit, and whether a rise is good
    'k-occ': ['occVsLy', ' pts', 'good', 1], 'k-rev': ['revYoY', '%', 'good', 1], 'k-temp': ['hiVsLy', ' °C', 'neutral', 1],
    'k-wet': ['wetVsLy', '', 'bad', 0], 'k-gap': ['gapVsLy', ' pts', 'good', 1],
  };
  let comparing = true;
  let figures = {};
  let finding = '';
  const setTableLy = async (hidden) => {
    const t = tileOf('g-table');
    await applyRuntimeOperations({ runtime: govRuntime, instanceId: t.id, availableFields: govFields, operationRequests: lyColumnOps(t, refsOf.get(t.id), hidden) })
      .catch((e) => console.warn('[table ly]', e?.message));
  };
  const rainSentence = (f) => {
    if (f.gap == null) return 'Too few wet or dry nights here to compare.';
    const side = (v) => `${num(Math.abs(v), 1)} pts ${v >= 0 ? 'above' : 'below'}`;
    const ly = comparing && f.gapLy != null ? ` (last autumn ${side(f.gapLy)})` : '';
    if (Math.abs(f.gap) < 2) return `Rain barely moved demand: wet nights ran ${side(f.gap)} dry nights${ly}.`;
    return f.gap < 0
      ? `Rain cost demand here: wet nights ran ${side(f.gap)} dry nights${ly}, the case for a wet-night offer.`
      : `Rain helped demand here: wet nights ran ${side(f.gap)} dry nights${ly}.`;
  };
  const refresh = async () => {
    // A date selection has no like-for-like nights last autumn: take the comparison off every KPI,
    // the headline and the table's change columns.
    const want = !dateSelected();
    if (want !== comparing) {
      comparing = want;
      for (const [id, v] of vSpecs) rtOf(tileOf(id)).runtime.updateInstance(id, { vSpec: want ? v.with : v.without });
      await setTableLy(!want);
    }
    figures = await readFigures();
    for (const [id, [key, , up]] of Object.entries(COMPARE)) {
      const change = figures[key] == null ? null : key === 'revYoY' ? figures[key] * 100 : figures[key];
      const flat = change == null || Math.abs(change) < 0.05;
      const good = up === 'neutral' || flat ? null : (change > 0) === (up === 'good');
      const colour = !comparing || good == null ? C.neutral : good ? C.good : C.bad;
      const label = document.querySelector(`[data-cmp="${id}"]`);
      label.textContent = !comparing ? 'No comparison for a date selection' : change == null ? 'No comparison: no rows last autumn' : `vs Aug–Oct 2025${up === 'neutral' ? '' : good == null ? ' · flat' : good ? ' · better' : ' · worse'}`;
      label.style.color = colour;
      label.dataset.value = String(change ?? '');
      if (comparing) {
        const { runtime, avail } = rtOf(tileOf(id));
        await applyRuntimeOperations({ runtime, instanceId: id, availableFields: avail, operationRequests: [{ id: 'c', name: 'setComparisonFontColor', payload: colour }] }).catch((e) => console.warn('[kpi colour]', id, e?.message));
      }
    }
    const f = figures;
    const scope = applied().length ? 'For this selection, the' : 'This autumn the';
    finding = f.occ == null ? 'No hotel nights match this selection.'
      : `${scope} hotels were ${num(f.occ * 100, 1)}% full${comparing ? ` (${signed(f.occVsLy, 1, ' pts')} on last autumn)` : ''}. ${rainSentence(f)}${comparing ? '' : ' Comparisons with last autumn are off for a date selection.'}`;
    $('hero').innerHTML = esc(finding).replace(/(\d[\d.,]*%|\d[\d.,]* pts)/g, '<b>$1</b>');
    $('hero').dataset.gap = String(f.gap ?? '');
    // The wet-night share the what-if starts from: what the weather shows for this selection.
    wetObserved = f.wetShare ?? null;
    if (wetFollows && wetObserved != null) setLever('wet_share', Math.round(wetObserved * 100) / 100, { follow: true });
    renderLeverNotes();
  };

  /* ---------- the offer tab: levers → layer parameters, visible-only */
  let planVisible = false;
  let planDirty = false; // levers or selection changed while the tab was off screen
  const PLAN_TILES = TILES.filter((t) => t.tab === 'plan');
  const renderLeverNotes = () => {
    for (const [k, p] of Object.entries(PARAMS)) {
      const v = levers[k];
      $(`lo-${k}`).textContent = k === 'wet_share' ? `${Math.round(v * 100)}%` : k === 'occ_uplift_pts' ? `+${num(v, 1)} pts` : `${num(v, 0)}% off`;
      $(`lv-${k}`).value = String(v);
      void p;
    }
    $('wet-note').textContent = wetObserved == null ? 'no weather rows for this selection' : wetFollows ? `observed for this selection (${Math.round(wetObserved * 100)}% of city-nights had 5 mm+)` : `you set it; the weather shows ${Math.round(wetObserved * 100)}%`;
    $('wet-reset').disabled = wetFollows;
  };
  let paramTimer;
  const applyParams = async () => {
    if (!planVisible) { planDirty = true; return; }
    planDirty = false;
    await Promise.all(PLAN_TILES.filter((t) => t.params).map((t) => {
      const vSpec = govRuntime.getInstance(t.id)?.vSpec;
      return applyRuntimeOperations({ runtime: govRuntime, instanceId: t.id, availableFields: govFields, operationRequests: paramOps(vSpec, levers) })
        .catch((e) => console.warn('[levers]', t.id, e?.message));
    }));
    scheduleVerdict();
  };
  const setLever = (k, v, { follow = false } = {}) => {
    if (levers[k] === v) return;
    levers[k] = v;
    if (k === 'wet_share' && !follow) wetFollows = false;
    renderLeverNotes();
    clearTimeout(paramTimer);
    paramTimer = setTimeout(applyParams, 250);
  };
  for (const k of Object.keys(PARAMS)) $(`lv-${k}`).addEventListener('input', (e) => setLever(k, Number(e.target.value)));
  $('wet-reset').addEventListener('click', () => { wetFollows = true; if (wetObserved != null) setLever('wet_share', Math.round(wetObserved * 100) / 100, { follow: true }); renderLeverNotes(); });

  // The governed figures behind the verdict line and an offer flag: what the native objects show.
  const planRows = async (id) => {
    const res = await handles.get(id)?.getData({ limit: 100 }).catch(() => null);
    return Object.values(res?.data?.response?.data ?? res?.data?.data ?? {});
  };
  const planFigures = async () => {
    const [[base] = [], [rev] = [], [occb] = [], [occ] = [], cities] = await Promise.all(['p-base', 'p-rev', 'p-occb', 'p-occ', 'p-city'].map(planRows));
    return { base: base?.[0], scenario: rev?.[0], change: rev?.[1], occ: occb?.[0], occScenario: occ?.[0], cities: cities.map((x) => ({ city: x[0], gain: x[1] })) };
  };
  let verdictTimer;
  const scheduleVerdict = () => { clearTimeout(verdictTimer); verdictTimer = setTimeout(renderVerdict, 1200); };
  const renderVerdict = async () => {
    const p = await planFigures();
    if (p.change == null) { $('verdict').textContent = 'No governed rows for this selection.'; return; }
    const best = [...p.cities].sort((a, b) => (b.gain ?? -Infinity) - (a.gain ?? -Infinity))[0];
    $('verdict').innerHTML = `At these levers the offer ${p.change >= 0 ? 'adds' : 'loses'} <b>${esc(usd(Math.abs(p.change)))}</b> of room revenue (${esc(signed(p.change / p.base * 100, 1, '%'))})${best && p.change >= 0 ? `; it pays most in <b>${esc(best.city)}</b>` : best ? `; it costs least in <b>${esc(best.city)}</b>` : ''}.`;
    $('verdict').dataset.change = String(p.change);
    const colour = p.change > 0 ? C.good : p.change < 0 ? C.bad : C.neutral;
    await applyRuntimeOperations({ runtime: govRuntime, instanceId: 'p-rev', availableFields: govFields, operationRequests: [{ id: 'c', name: 'setComparisonFontColor', payload: colour }] }).catch(() => {});
  };

  // Visible-only queries: the offer tab's objects live in their own group, which mirrors the main
  // group's governed selections only while the tab is on screen (and writes its own clicks back).
  const syncPlanFromMain = () => {
    const want = applied().filter((x) => GOVERNED_KEYS.has(keyOf(x)));
    if (sig(want) !== sig(applied(PLAN))) selections.setNewSelectionState(PLAN, { applied: want, pending: [] });
  };
  selections.onActiveSelectionChangeApplied(PLAN).subscribe(() => {
    if (!planVisible) return;
    const planSel = applied(PLAN).filter((x) => GOVERNED_KEYS.has(keyOf(x)));
    const mainGov = applied().filter((x) => GOVERNED_KEYS.has(keyOf(x)));
    if (sig(planSel) === sig(mainGov)) return;
    const others = applied().filter((x) => !GOVERNED_KEYS.has(keyOf(x)));
    selections.setNewSelectionState(GROUP, { applied: [...others, ...planSel], pending: [] });
  });
  const showPlan = (on) => {
    planVisible = on;
    $('pane-plan').classList.toggle('off', !on);
    $('pane-plan').setAttribute('aria-hidden', String(!on));
    if (on) { syncPlanFromMain(); if (planDirty) applyParams(); else scheduleVerdict(); }
  };

  /** The offer figures for an export: brought up to date first when the tab is off screen. */
  const freshPlan = async () => {
    if (!planVisible) {
      syncPlanFromMain();
      planVisible = true;
      try { await applyParams(); } finally { planVisible = false; }
      await appState.quiet({ quietMs: 600, paintMs: 400 });
    }
    return planFigures();
  };

  /* ---------- selection bar: a view of Astrato's selection state */
  const CHIP_NAME = { [CITY]: 'City', [DATE]: 'Stay Date', '[Weather].[Rain band]': 'Rain band', '[Weather].[Temperature band]': 'Temperature band' };
  const dateLabel = (values) => {
    const days = [...new Set(values.map(Number))].sort((a, b) => a - b);
    const d = (ms) => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
    const runs = [];
    for (const ms of days) { const prev = runs.at(-1); if (prev && ms - prev.to === 86400000) prev.to = ms; else runs.push({ from: ms, to: ms }); }
    return `${runs.slice(0, 2).map((x) => (x.from === x.to ? d(x.from) : `${d(x.from)} – ${d(x.to)}`)).join(', ')}${runs.length > 2 ? ` +${runs.length - 2}` : ''} (${days.length} night${days.length === 1 ? '' : 's'})`;
  };
  const renderChips = () => {
    const chips = applied().map((x) => {
      const key = keyOf(x);
      const text = key === DATE ? dateLabel(x.values) : x.values.slice(0, 3).join(', ') + (x.values.length > 3 ? ` +${x.values.length - 3}` : '');
      return `<button class="chip ${GOVERNED_KEYS.has(key) ? 'gov' : 'duck'}" data-key="${esc(x.field?.fieldKey ?? x.fieldKey)}" title="Remove this selection"><b>${esc(CHIP_NAME[key] ?? nameOf(key))}</b> ${esc(text)} ×</button>`;
    });
    $('chips').innerHTML = chips.length ? chips.join('') : '<span class="none"><span class="long">No selections. Pick a city, or click or drag on a chart: all three sources follow.</span><span class="short">No selections: pick a city or click a chart.</span></span>';
    $('clear').disabled = !chips.length && !(selections.getSelection(GROUP)?.applied ?? []).length;
  };
  $('chips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (b) selections.setNewSelectionState(GROUP, { applied: applied().filter((x) => (x.field?.fieldKey ?? x.fieldKey) !== b.dataset.key), pending: [] });
  });
  $('clear').addEventListener('click', () => selections.setNewSelectionState(GROUP, { applied: [], pending: [] }));
  let refreshing = null;
  const onApplied = () => {
    renderChips();
    refreshing = refresh().catch((e) => console.error('[refresh]', e));
    if (planVisible) syncPlanFromMain(); else planDirty = true;
    const city = applied().find((x) => keyOf(x) === CITY)?.values?.[0];
    if (city) $('flag-city').value = city;
  };
  selections.onActiveSelectionChangeApplied(GROUP).subscribe(onApplied);
  if (!refreshing) onApplied(); // the stream may not replay the current state on subscribe
  await refreshing;

  /* ---------- the one recorded action: flag a city-week for the offer (maker–checker) */
  const offers = createOfferStore();
  const actor = () => ROLES[$('role').value];
  const renderOffers = () => {
    const s = offers.state;
    $('flags').innerHTML = s.items.length ? s.items.map((x) => `
      <li class="flag ${x.status}" data-id="${x.id}"><div class="fl1"><b>${esc(x.id)}</b> ${esc(x.city)} · w/c ${esc(x.week)}<span class="pill ${x.status}">${esc(x.status)}</span></div>
        <div class="fl2">+${esc(num(x.levers.occ_uplift_pts, 1))} pts at ${esc(num(x.levers.rate_discount_pct, 0))}% off · wet ${Math.round(x.levers.wet_share * 100)}% · governed estimate ${esc(x.estGain == null ? 'n/a' : usd(x.estGain))} · by ${esc(ROLES[x.proposedBy].person)}${x.decidedBy ? `, ${esc(x.status)} by ${esc(ROLES[x.decidedBy].person)}` : ''}</div>
        ${x.status === 'proposed' ? `<div class="fl3"><button class="btn small" data-act="approved">Approve</button><button class="btn small" data-act="rejected">Reject</button></div>` : ''}</li>`).join('')
      : '<li class="empty">No flags yet. As the revenue manager, pick a city and a week and flag it at the levers above.</li>';
    $('audit').innerHTML = s.audit.length ? s.audit.slice(0, 40).map((a) => `<li class="${a.outcome}"><span class="t">${esc(a.at.slice(5, 16).replace('T', ' '))}</span> <b>${esc(a.person)}</b> (${esc(a.role)}) ${esc(a.action)} ${esc(a.flag)}${a.outcome === 'refused' ? ' · <em>refused</em>' : ''}${a.detail ? ` · ${esc(a.detail)}` : ''}</li>`).join('') : '<li class="empty">Nothing recorded yet.</li>';
  };
  const say = (res) => { $('flag-msg').textContent = res.message; $('flag-msg').className = `msg ${res.ok ? 'ok' : 'no'}`; };
  offers.subscribe(renderOffers);
  renderOffers();
  $('flag-btn').addEventListener('click', async () => {
    const city = $('flag-city').value;
    const p = await planFigures();
    const estGain = p.cities.find((x) => x.city === city)?.gain ?? null;
    say(offers.propose(actor(), { city, week: $('flag-week').value, levers: { ...levers }, estGain }));
  });
  $('flags').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (b) say(offers.decide(actor(), b.closest('li').dataset.id, b.dataset.act));
  });
  $('reset').addEventListener('click', () => { offers.reset(actor()); say({ ok: true, message: 'Demo flags and trail cleared.' }); });

  /* ---------- Excel */
  const selectionText = () => (applied().length ? applied().map((x) => `${CHIP_NAME[keyOf(x)] ?? nameOf(keyOf(x))} = ${keyOf(x) === DATE ? dateLabel(x.values) : x.values.join(', ')}`).join('; ') : 'none (all cities, all nights)');
  $('export').disabled = false;
  $('export').addEventListener('click', async () => {
    $('export').disabled = true;
    try {
      await refreshing;
      const plan = await freshPlan();
      const { blob, filename } = await buildWorkbook({ gov, duckRun: (sql, label) => engineDuck.run(sql, label), where: engineDuck.where, figures, finding, comparing, selectionText: selectionText(), plan: { ...plan, levers: { ...levers }, wetObserved, planCurrent: true }, offers: offers.state });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    } catch (error) { console.error('[export]', error); } finally { $('export').disabled = false; }
  });

  /* ---------- right-click: the SQL behind a card */
  const sqlLit = (key, v) => (key === DATE ? `'${new Date(Number(v)).toISOString().slice(0, 10)}'` : `'${String(v).replaceAll("'", "''")}'`);
  const selectionLines = () => {
    const lines = applied().filter((x) => GOVERNED_KEYS.has(keyOf(x))).map((x) => `--   ${keyOf(x)} IN (${x.values.slice(0, 12).map((v) => sqlLit(keyOf(x), v)).join(', ')}${x.values.length > 12 ? `, … ${x.values.length - 12} more` : ''})`);
    return lines.length ? `\n-- Current selections, added by the engine as filters:\n${lines.join('\n')}` : '\n-- No selections: the engine adds no further filters.';
  };
  const paramLines = (t) => (t.params ? `\n-- Layer parameters set by the levers: ${Object.entries(levers).map(([k, v]) => `${k} = ${v}`).join(', ')}` : '');
  const duckKey = (t) => [...(t.dims ?? []), ...(t.measures ?? [t.measure]), ...(t.type === 'number' && comparing ? [t.comparison] : [])].join('|');
  const showSql = (id) => {
    const t = tileOf(id);
    if (!t) return;
    const sections = t.src === 'gov'
      ? [['Astrato engine → warehouse', `The stored question "${t.question}", compiled by Astrato. Only the aggregated result reaches the browser.`, (GOVERNED_SQL[t.question] ?? '-- not generated: run tools/governed-sql.mjs') + selectionLines() + paramLines(t)]]
      : [t.blend ? ['1 · Governed extract: Astrato engine → warehouse', `Run once on load: the stored question "${EXTRACT_QUESTION}" is copied into the page.`, GOVERNED_SQL[EXTRACT_QUESTION] ?? ''] : ['1 · Weather API request, from the browser', null, API_URL],
        ['2 · In the browser', 'The statement this card last ran, with the current selections.', lastSql.get(duckKey(t)) ?? '-- Not run yet.']];
    const [cls, text] = TAG[kindOf(t)];
    $('poptitle').textContent = titleOf(t);
    $('popsrc').textContent = text;
    $('popsrc').className = `tag ${cls}`;
    $('popbody').innerHTML = sections.map(([h, note, sql]) => `<h3>${esc(h)}</h3>${note ? `<p>${esc(note)}</p>` : ''}<pre>${esc(sql)}</pre>`).join('');
    $('sqlpop').hidden = false;
  };
  document.addEventListener('contextmenu', (e) => {
    const card = e.target.closest('[data-sql]');
    if (!card) return;
    e.preventDefault(); e.stopPropagation();
    showSql(card.dataset.sql);
  }, true);
  $('popclose').addEventListener('click', () => { $('sqlpop').hidden = true; });
  $('sqlpop').addEventListener('click', (e) => { if (e.target === $('sqlpop')) $('sqlpop').hidden = true; });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') $('sqlpop').hidden = true; });
  $('popcopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText([...$('popbody').querySelectorAll('pre')].map((p) => p.textContent).join('\n\n')); $('popcopy').textContent = 'Copied'; } catch { $('popcopy').textContent = 'Copy failed'; }
    setTimeout(() => { $('popcopy').textContent = 'Copy'; }, 1500);
  });

  /* ---------- tabs */
  showTab = (tab) => {
    document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === tab)));
    $('queries').hidden = tab !== 'queries';
    showPlan(tab === 'plan');
  };

  /* ---------- checks the smoke test runs: through the reader's own controls, and never writing */
  //
  // Selections are made the way a reader makes them: a DOM click on a table row or a chip, a click
  // on a tab or a button, a slider moved with input events. Where a selection can only come from a
  // canvas chart (a band bar, a date range), the check writes it as that chart writes it, as a
  // PENDING selection, and lets the app's own auto-apply turn it into an applied one.
  const snapshot = async (ids) => Object.fromEntries(await Promise.all(ids.map(async (id) => {
    const res = await handles.get(id)?.getData({ limit: 2000 }).catch((e) => ({ error: e?.message }));
    return [id, JSON.stringify(res?.data?.response?.data ?? res?.data?.data ?? res?.data ?? res ?? null)];
  })));
  const settle = async () => { await appState.quiet(); await refreshing; };
  const press = (el) => {
    const r0 = el.getBoundingClientRect();
    const at = { bubbles: true, cancelable: true, composed: true, clientX: r0.x + r0.width / 2, clientY: r0.y + r0.height / 2, button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse', isPrimary: true };
    el.dispatchEvent(new PointerEvent('pointerdown', at)); el.dispatchEvent(new MouseEvent('mousedown', at));
    el.dispatchEvent(new PointerEvent('pointerup', { ...at, buttons: 0 })); el.dispatchEvent(new MouseEvent('mouseup', { ...at, buttons: 0 })); el.dispatchEvent(new MouseEvent('click', { ...at, buttons: 0 }));
  };
  /** Click a city's row in the governed table, as a reader does. */
  const clickRow = async (city) => {
    const walker = document.createTreeWalker($('g-table'), NodeFilter.SHOW_TEXT);
    let n; let el = null;
    while ((n = walker.nextNode())) if (n.textContent.trim() === city) { el = n.parentElement; break; }
    if (!el) throw new Error(`no table row for ${city}`);
    press(el);
    await sleep(400);
  };
  /** Write a selection as a canvas chart does: pending, then the app's auto-apply applies it. */
  const chartPick = async (fieldKey, values) => {
    selections.setNewSelectionState(GROUP, { applied: selections.getSelection(GROUP)?.applied ?? [], pending: [{ field: { fieldKey }, fieldKey, kind: 'VALUE', operator: 'inList', values }] });
    for (let i = 0; i < 40 && (selections.getSelection(GROUP)?.pending ?? []).length; i++) await sleep(100);
  };
  const clickTab = (tab) => document.querySelector(`.tab[data-tab="${tab}"]`).click();
  const clearAll = () => $('clear').click();
  const objectsOk = () => Object.values(window.__appState.objects).every((o) => o.status === 'rendered') && !late.length;
  const tableText = () => ($('g-table').innerText || '').replace(/\s+/g, ' ');

  appState.check('Clicking Boston’s row in the governed table moves governed, API and blended KPIs, charts and the table; the Clear all button restores them', async () => {
    const ids = ['k-occ', 'k-rev', 'k-temp', 'k-wet', 'k-gap', 'g-occ', 'g-table', 'd-temp', 'd-rain', 'd-band', 's-occ', 's-temp'];
    const before = await snapshot(ids); const heroBefore = $('hero').textContent;
    await clickRow('Boston'); await settle();
    const during = await snapshot(ids); const city = applied().find((x) => keyOf(x) === CITY)?.values?.join(',');
    clearAll(); await settle();
    const after = await snapshot(ids);
    const moved = ids.filter((id) => during[id] !== before[id]); const restored = ids.filter((id) => after[id] === before[id]);
    return { pass: city === 'Boston' && moved.length === ids.length && restored.length === ids.length && $('hero').textContent === heroBefore, detail: `row click selected City = ${city}; moved ${moved.length}/${ids.length} (${ids.filter((i) => !moved.includes(i)).join(', ') || 'all'}), restored ${restored.length}/${ids.length}` };
  });
  appState.check('A Temperature band picked as the band chart writes it (pending → auto-applied) moves the API and blended objects and leaves governed ones as they were', async () => {
    const moving = ['k-temp', 'k-wet', 'k-gap', 'd-temp', 'd-rain', 's-temp']; const fixed = ['k-occ', 'g-city', 'g-table'];
    const before = await snapshot([...moving, ...fixed]);
    await chartPick('[Weather].[Temperature band]', ['3 · 22–29 °C']); await settle();
    const during = await snapshot([...moving, ...fixed]); const chip = $('chips').textContent;
    clearAll(); await settle();
    const moved = moving.filter((id) => during[id] !== before[id]); const kept = fixed.filter((id) => during[id] === before[id]);
    return { pass: moved.length === moving.length && kept.length === fixed.length && /Temperature band/.test(chip), detail: `moved ${moved.length}/${moving.length}, governed unchanged ${kept.length}/${fixed.length}; chip "${chip.trim().slice(0, 60)}"` };
  });
  appState.check('Two selections on two fields (Boston row click + a band), then the band chip clicked away: every object stays rendered and the table still shows Boston; Clear all empties the bar', async () => {
    const lateBefore = late.length;
    await clickRow('Boston'); await settle();
    await chartPick('[Weather].[Temperature band]', ['3 · 22–29 °C']); await settle();
    const two = document.querySelectorAll('#chips .chip').length;
    const bandChip = [...document.querySelectorAll('#chips .chip')].find((c) => /Temperature band/.test(c.textContent));
    bandChip?.click(); await settle();
    const one = document.querySelectorAll('#chips .chip').length; const table = tableText();
    clearAll(); await settle();
    const zero = document.querySelectorAll('#chips .chip').length;
    const pass = two === 2 && one === 1 && zero === 0 && /Boston/.test(table) && !/Austin/.test(table) && late.length === lateBefore && objectsOk();
    return { pass, detail: `chips 2→${one}→${zero} (from ${two}); table after chip removal "${table.slice(0, 80)}"; errors after landing: ${late.length - lateBefore}` };
  });
  appState.check('A date selection (as the occupancy chart writes it) takes every comparison with last autumn off: KPI cards, the headline and the table’s change columns; the first night shows no fake comparison either', async () => {
    const res = [];
    for (const days of [Array.from({ length: 14 }, (_, i) => Date.UTC(2026, 8, 1 + i)), [Date.UTC(2026, 7, 1)]]) {
      await chartPick(DATE, days); await settle(); await sleep(800);
      res.push({ cmp: document.querySelector('[data-cmp="k-occ"]').textContent, hero: $('hero').textContent, table: tableText() });
      clearAll(); await settle();
    }
    const on = document.querySelector('[data-cmp="k-occ"]').textContent; const tableBack = tableText();
    const fake = (x) => /last autumn \(/.test(x.hero) || /on last autumn/.test(x.hero) || /-100\.0%|−100\.0%/.test(x.table) || /vs LY/.test(x.table);
    const pass = res.every((x) => /No comparison/.test(x.cmp) && !fake(x)) && !/No comparison/.test(on) && /vs LY/.test(tableBack);
    return { pass, detail: res.map((x, i) => `${i ? 'first night' : '14 nights'}: "${x.cmp}", headline "${x.hero.slice(0, 70)}…", table "${x.table.slice(0, 60)}"`).join(' | ') + ` | cleared: "${on}"` };
  });
  appState.check('A range that ends off the data (an empty Stay Date list, as a drag can write) is dropped: nothing is sent to the engine and no chip is left', async () => {
    const refusedBefore = (window.__refused ?? []).length;
    selections.setNewSelectionState(GROUP, { applied: selections.getSelection(GROUP)?.applied ?? [], pending: [{ field: { fieldKey: DATE }, fieldKey: DATE, kind: 'VALUE', operator: 'inList', values: [] }] });
    await sleep(800); await settle();
    const raw = selections.getSelection(GROUP) ?? {};
    const left = [...(raw.applied ?? []), ...(raw.pending ?? [])].length;
    return { pass: left === 0 && (window.__refused ?? []).length === refusedBefore && !document.querySelectorAll('#chips .chip').length, detail: `entries left ${left}; refused queries ${(window.__refused ?? []).length - refusedBefore}` };
  });
  appState.check('The blended KPI equals an independent join of the same rows in plain JavaScript (no DuckDB)', async () => {
    const weather = await (await fetch(API_URL)).json();
    const wx = new Map();
    [].concat(weather).forEach((loc, i) => loc.daily.time.forEach((day, j) => wx.set(`${CITIES[i][0]}|${day}`, loc.daily.precipitation_sum[j])));
    const dry = []; const wet = [];
    for (const d of demandRows) {
      if (d.date < '2026-08-01' || d.date > '2026-10-31') continue;
      const p = wx.get(`${d.city}|${d.date}`);
      if (p == null) continue;
      if (p < 1) dry.push(d.occupancy); else if (p >= 5) wet.push(d.occupancy);
    }
    const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
    const js = 100 * (avg(wet) - avg(dry));
    return { pass: Math.abs(js - figures.gap) < 0.01, detail: `DuckDB ${figures.gap?.toFixed(3)} pts, JavaScript ${js.toFixed(3)} pts (${wet.length} wet, ${dry.length} dry city-nights)` };
  });
  appState.check('One fresh City selection (a Napa row click) sends at most one query per object on screen and settles within 3 s; repeating it is answered from the caches', async () => {
    const q = window.__appState.queries;
    const run = async () => {
      const start = q.length; const t0 = performance.now();
      await clickRow('Napa');
      await appState.quiet({ quietMs: 600, paintMs: 0 });
      const sent = q.slice(start);
      const settleMs = Math.max(0, ...sent.map((x) => x.at)) - (t0 - window.__appState.startedAt);
      clearAll(); await appState.quiet({ quietMs: 600, paintMs: 0 }); await refreshing;
      const govQ = sent.filter((x) => !String(x.key).startsWith('duck '));
      const duckQ = sent.filter((x) => String(x.key).startsWith('duck '));
      return { govFresh: govQ.filter((x) => !x.cached).length, duckFresh: duckQ.filter((x) => !x.cached).length, total: sent.length, settle: Math.round(settleMs) };
    };
    const first = await run(); const again = await run();
    const visible = TILES.filter((t) => t.tab === 'dash').length + FILTERS.length;
    const budget = Math.ceil(1.2 * (visible + 1)) + 2; // + the table's sparkline column, + the headline's figures
    const pass = first.govFresh + first.duckFresh <= budget && first.settle <= 3000 && again.govFresh === 0 && again.duckFresh === 0;
    return { pass, detail: `${visible} objects on this tab; first click: ${first.govFresh} governed + ${first.duckFresh} DuckDB statements sent (budget ${budget}; ${first.total} asks in all), last answer after ${first.settle} ms; repeat: ${again.govFresh} governed + ${again.duckFresh} DuckDB sent; offer-tab objects sent nothing (not on screen)` };
  });
  appState.check('An empty combination (Phoenix row click + under 15 °C) empties the weather objects without errors and says so in the headline', async () => {
    await clickRow('Phoenix'); await settle();
    await chartPick('[Weather].[Temperature band]', ['1 · under 15 °C']); await settle();
    const rows = await handles.get('d-temp').getData({ limit: 10 }).catch((e) => ({ error: e?.message }));
    const n = Object.keys(rows?.data?.response?.data ?? {}).length;
    const hero = $('hero').textContent;
    clearAll(); await settle();
    return { pass: n === 0 && !rows?.error && /Too few/.test(hero) && objectsOk(), detail: `d-temp rows ${n}; headline "${hero}"` };
  });
  appState.check('What-if: on the Wet-night offer tab, moving the sliders changes the governed scenario through the layer’s parameters; at no uplift and no discount the scenario equals the governed baseline', async () => {
    clickTab('plan'); await settle(); await sleep(1500);
    const slide = async (k, v) => { const el = $(`lv-${k}`); el.value = String(v); el.dispatchEvent(new Event('input', { bubbles: true })); };
    const keep = { ...levers };
    await slide('occ_uplift_pts', 0); await slide('rate_discount_pct', 0); await sleep(400); await settle(); await sleep(1500);
    const zero = await planFigures();
    await slide('occ_uplift_pts', 8); await slide('rate_discount_pct', 5); await sleep(400); await settle(); await sleep(1500);
    const up = await planFigures();
    await slide('occ_uplift_pts', keep.occ_uplift_pts); await slide('rate_discount_pct', keep.rate_discount_pct); await sleep(400); await settle();
    clickTab('dash'); await settle();
    const eq = (a, b) => a != null && b != null && Math.abs(a - b) < 0.5;
    const pass = eq(zero.scenario, zero.base) && Math.abs(zero.change ?? 1) < 0.5 && up.scenario > up.base && up.occScenario > up.occ && eq(up.base, zero.base) && up.cities.length > 0;
    return { pass, detail: `no offer: baseline ${usd(zero.base)}, scenario ${usd(zero.scenario)}, change ${usd(zero.change)}; +8 pts at 5% off: scenario ${usd(up.scenario)} (${usd(up.change)}), occupancy ${num(up.occ * 100, 1)}% → ${num(up.occScenario * 100, 1)}%, ${up.cities.length} cities` };
  });
  appState.check('Workflow (sandboxed, nothing kept): the revenue manager flags Boston through the form; approving it as the same person is refused (maker–checker); the general manager approves; the trail records all three; Reset empties it', async () => {
    clickTab('plan'); await settle();
    const roleTo = (id) => { $('role').value = id; $('role').dispatchEvent(new Event('change', { bubbles: true })); };
    const result = await offers.sandbox(async () => {
      roleTo('rm'); $('flag-city').value = 'Boston'; $('flag-week').selectedIndex = 0;
      $('flag-btn').click(); await sleep(1500);
      const flagged = offers.state.items[0];
      const firstStatus = flagged?.status;
      const btn = (act) => $('flags').querySelector(`li[data-id="${flagged?.id}"] button[data-act="${act}"]`);
      btn('approved')?.click(); await sleep(200);
      const afterSelf = offers.state.items[0]?.status; const selfMsg = $('flag-msg').textContent;
      roleTo('gm'); btn('approved')?.click(); await sleep(200);
      const afterGm = offers.state.items[0]?.status;
      const trail = offers.state.audit.map((a) => `${a.action}:${a.outcome}`);
      $('reset').click(); await sleep(100);
      const afterReset = offers.state.items.length;
      roleTo('rm');
      return { flagged: firstStatus, city: flagged?.city, afterSelf, selfMsg, afterGm, trail, afterReset };
    });
    clickTab('dash'); await settle();
    const pass = result.flagged === 'proposed' && result.city === 'Boston' && result.afterSelf === 'proposed' && /Maker–checker/.test(result.selfMsg) && result.afterGm === 'approved'
      && result.trail.includes('Approve:refused') && result.trail.includes('Approve:done') && result.trail.includes('Propose:done') && result.afterReset === 0;
    return { pass, detail: `flag ${result.flagged} (${result.city}); self-approval → ${result.afterSelf} ("${result.selfMsg}"); manager → ${result.afterGm}; trail ${result.trail.join(', ')}; after reset ${result.afterReset} flags; real store untouched (${offers.state.items.length} flags)` };
  });
  appState.check('No governed query was refused and no object failed after landing', async () => ({ pass: !(window.__refused ?? []).length && !late.length && objectsOk(), detail: [(window.__refused ?? []).join(' || ').slice(0, 1500), late.map((x) => x.text).join(' || ').slice(0, 1500)].filter(Boolean).join(' / ') || 'none' }));
  appState.check('Excel report with City = Boston (row click): the button builds a workbook whose Summary, Cities and What-if sheets carry Boston’s governed figures, and it downloads', async () => {
    await clickRow('Boston'); await settle();
    let captured = null;
    const create = URL.createObjectURL;
    URL.createObjectURL = (blob) => { captured = blob; return create.call(URL, blob); };
    try { $('export').click(); for (let i = 0; i < 80 && !captured; i++) await sleep(100); } finally { URL.createObjectURL = create; }
    const text = captured ? new TextDecoder().decode(await captured.arrayBuffer()) : '';
    const sheets = [...text.matchAll(/<sheet name="([^"]+)"/g)].map((m) => m[1]);
    const rev = figures.rev;
    clearAll(); await settle();
    const pass = sheets.length >= 8 && sheets.includes('What-if') && sheets.includes('Offers') && /City = Boston/.test(text) && rev != null && text.includes(String(Math.round(rev * 100) / 100).slice(0, 7));
    return { pass, detail: `${(captured?.size ?? 0).toLocaleString('en-US')} bytes; sheets ${sheets.join(', ')}; Boston revenue ${rev} found in the workbook: ${rev != null && text.includes(String(Math.round(rev * 100) / 100).slice(0, 7))}` };
  });

  window.__hw = { app, selections, figures: () => figures, handles, duckQuery, levers, offers };
};

/* ---------------------------------------------------------------- tabs */
let showTab = (tab) => {
  document.querySelectorAll('.tab').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === tab)));
  $('queries').hidden = tab !== 'queries';
};
document.querySelectorAll('.tab').forEach((t) => t.addEventListener('click', () => showTab(t.dataset.tab)));

main().catch((error) => {
  console.error('[hotel-weather]', error);
  appState.bootFailed(error);
  $('hero').textContent = `Could not start: ${error?.message ?? error}`;
});
