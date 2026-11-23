/**
 * Thessaloniki on the Move — how the city's buses connect people, places and daily life.
 *
 * A scrolling data story over the OSETH bus timetable (GTFS feed for 14 Jul – 3 Aug 2026),
 * loaded into Snowflake and modelled in the "Thessaloniki on the Move" semantic layer.
 * A Vite project on the public @astrato-io packages. Every number, chart, map and table is an Astrato
 * visualization instance or a governed engine query; the narratives are composed from those
 * queries and follow the filter bar.
 *
 *  0 The network  1 Scale  2 Geography  3 Access  4 Rhythm  5 Where people board  6 Operations
 *  7 Route explorer  8 Opportunities (with a what-if)
 */
import { createAstratoApp } from '@astrato-io/app-runtime';
import { createVisualizationRuntime, registry } from '@astrato-io/visualizations';
import { createVisualizationAvailableFields } from '@astrato-io/visualizations/definitions';
import { appState } from './app-state.js';
import { debugShapes, prefetchSelections, throttleQueries } from './throttle.js';
import { C, CONTROLS, EXTENT, FL, LS, LV, chapterGroup, MAIN, ROUTE, ST, SV, buildTiles, compileTiles, fitColumnRequests, prepareTile, withExtent } from './dashboard.js';
import { createFieldIndex } from './fields.js';
import { applyEach } from './theme.js';
import { buildReport, downloadReport } from './report.js';
import { drawCard, linkedInComposer } from './share.js';
import { attachBasemap, plotRect } from './basemap.js';
import { CAT_COLORS, ROUTE_COLORS, busesAt, createBusLayer, createRouteLayer, linePaths, loadDay } from './sim.js';

const root = document.getElementById('root');
const MOUNT_CONCURRENCY = 4;
const READY_TIMEOUT_MS = 45000;
const PERIOD = '14 Jul – 3 Aug 2026';
const DEFAULT_LINE = '03K';

const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'value') node.value = value;
    else if (key === 'style') for (const [p, v] of Object.entries(value)) node.style.setProperty(p, v);
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children)) if (child != null && child !== false) node.append(child);
  return node;
};

// ---------------------------------------------------------------------------
// Formatting

const N = (v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));
const n0 = (v) => (N(v) == null ? '—' : Math.round(N(v)).toLocaleString('en-GB'));
const n1 = (v) => (N(v) == null ? '—' : N(v).toLocaleString('en-GB', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
const pct = (v, d = 0) => (N(v) == null ? '—' : `${(N(v) * 100).toFixed(d)}%`);
const big = (v) => (N(v) == null ? '—' : N(v) >= 1e6 ? `${(N(v) / 1e6).toFixed(1)}m` : N(v) >= 1e4 ? `${Math.round(N(v) / 1e3)}k` : n0(v));
const byTrips = (a, b) => N(b['Trips per Day']) - N(a['Trips per Day']);
const strip = (s) => String(s ?? '').replace(/^\d\.\s*/, '');

// ---------------------------------------------------------------------------
// Astrato bootstrap and mounting

const sanitizeMetadata = (metadata) => {
  const accepts = (field) => {
    try {
      createVisualizationAvailableFields({ ...metadata, fields: [field], validFields: [field], viewsFields: [field], dimensions: [], measures: [] });
      return true;
    } catch {
      return false;
    }
  };
  const bad = new Set((metadata.fields ?? []).filter((field) => !accepts(field)).map((field) => field.key));
  const keep = (l) => (Array.isArray(l) ? l.filter((field) => !bad.has(field.key)) : l);
  return { metadata: { ...metadata, fields: keep(metadata.fields), validFields: keep(metadata.validFields), viewsFields: keep(metadata.viewsFields) }, dropped: [...bad] };
};

const bootstrapAstrato = async () => {
  const app = await createAstratoApp();
  // Every query (charts, narratives, report) shares a few lanes and retries Astrato's 429s.
  throttleQueries(app.client.hostServices);
  const engine = app.client.hostServices.engine;
  const raw = await engine.fields.getFieldMetadata({ ...app.dataBinding });
  const { metadata, dropped } = sanitizeMetadata(raw ?? {});
  const runtime = createVisualizationRuntime({ client: app.client, registry });
  const availableFields = createVisualizationAvailableFields(metadata).filter((field) => field?.resultType !== 'unhandled');
  appState.fields(availableFields);
  return { app, runtime, dataBinding: { ...app.dataBinding }, availableFields, fields: createFieldIndex(availableFields), dropped };
};

const mounted = new Map();
const mountVisualization = (runtime, instance, container, onDone) => {
  const record = { id: instance.id, type: instance.type, mount: 'pending', render: 'pending', at: Date.now() };
  mounted.set(instance.id, record);
  let released = false;
  let handle;
  const release = () => {
    if (released) return;
    released = true;
    handle?.unmount();
    if (runtime.listInstances().some(({ id }) => id === instance.id)) runtime.removeInstance(instance.id);
    if (mounted.get(instance.id) === record) mounted.delete(instance.id);
  };
  (async () => {
    try {
      runtime.createInstance(instance);
      handle = await runtime.mount(container, instance.id);
      record.mount = handle.status;
      const rendered = await Promise.race([handle.ready, new Promise((resolve) => setTimeout(() => resolve({ status: 'timeout' }), READY_TIMEOUT_MS))]);
      record.render = rendered?.status ?? 'unknown';
      record.readyMs = Date.now() - record.at;
      appState.settle(instance.id, record.render, rendered);
      if (record.render === 'error' && !released) container.parentElement?.append(el('p', { class: 'viz-error', text: 'This object could not be rendered.' }));
    } catch (error) {
      record.mount = 'failed';
      record.error = String(error);
      appState.settle(instance.id, 'error', error);
      console.error(`[viz] ${instance.id}`, error);
      container.parentElement?.append(el('p', { class: 'viz-error', text: String(error) }));
    }
    onDone?.(record.render);
  })();
  return release;
};

// ---------------------------------------------------------------------------
// Story chrome

const splash = {
  set(text, share) {
    const status = document.getElementById('splash-status');
    if (status && text) status.textContent = text;
    if (share == null) return;
    document.getElementById('splash-bus')?.style.setProperty('--p', String(Math.max(0.04, Math.min(1, share))));
  },
  done() { document.getElementById('splash')?.classList.add('is-done'); },
};
const SPLASH_MAX_MS = 60000;

/** The White Tower, the waterfront and three bus lines — drawn, not photographed. */
const SKYLINE = `<svg viewBox="0 0 640 260" aria-hidden="true" class="skyline">
  <defs><linearGradient id="sea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#1F6F9F" stop-opacity=".55"/><stop offset="1" stop-color="#10263F" stop-opacity=".9"/></linearGradient></defs>
  <path d="M0 196 C120 186 220 200 320 192 S520 182 640 190 L640 260 L0 260Z" fill="url(#sea)"/>
  <path d="M0 214 C140 206 260 220 400 210 S560 204 640 210" stroke="#FFFDF8" stroke-opacity=".35" stroke-width="2" fill="none"/>
  <path d="M0 232 C160 224 300 238 440 228 S580 222 640 228" stroke="#FFFDF8" stroke-opacity=".2" stroke-width="2" fill="none"/>
  <g fill="#FFFDF8" opacity=".95">
    <rect x="402" y="74" width="62" height="120" rx="3"/>
    <rect x="396" y="64" width="74" height="14" rx="2"/>
    <rect x="398" y="54" width="8" height="12"/><rect x="414" y="54" width="8" height="12"/><rect x="430" y="54" width="8" height="12"/><rect x="446" y="54" width="8" height="12"/><rect x="460" y="54" width="8" height="12"/>
    <rect x="418" y="30" width="30" height="26" rx="2"/>
    <rect x="420" y="22" width="6" height="9"/><rect x="430" y="22" width="6" height="9"/><rect x="440" y="22" width="6" height="9"/>
  </g>
  <g fill="#10263F" opacity=".55"><rect x="429" y="100" width="8" height="14" rx="4"/><rect x="429" y="134" width="8" height="14" rx="4"/><rect x="420" y="168" width="26" height="26" rx="13"/></g>
  <g fill="#E9DFCC" opacity=".9"><path d="M40 196 L40 150 L70 132 L100 150 L100 196Z"/><path d="M110 196 L110 120 L150 104 L190 120 L190 196Z"/><path d="M200 196 L200 160 L232 146 L264 160 L264 196Z"/><path d="M520 196 L520 140 L556 126 L592 140 L592 196Z"/></g>
  <path class="route route--a" d="M20 120 C120 60 230 140 330 90 S520 40 630 96" />
  <path class="route route--b" d="M10 160 C140 120 250 170 360 130 S540 110 630 140" />
  <path class="route route--c" d="M60 40 C160 90 260 30 360 60 S520 110 610 50" />
  <circle class="bus bus--a" r="6"/><circle class="bus bus--b" r="6"/><circle class="bus bus--c" r="6"/>
</svg>`;

/** Each advanced card names the Astrato feature it leans on. */
const BADGE = {
  ratio: ['Ratio of aggregates', 'Trips per day = SUM(trips) ÷ COUNT DISTINCT(service date), recomputed at every grain and under every filter — never an average of daily averages.'],
  share: ['Share of total', 'A measure input with scope “total”: each row is divided by the total of the whole answer, so shares re-base when you filter.'],
  filtered: ['Filtered measures', 'Weekday, Saturday and Sunday trips per day are filtered inputs of one governed measure, so Sunday retention is a ratio of two ratios computed in one query.'],
  join: ['Multi-grain join', 'Line attributes (reference weekday) and the 21-day service fact sit at different grains; the layer joins them many-to-one so neither double-counts.'],
  distinct: ['Distinct counts', 'Stops, lines and service days are COUNT DISTINCT, correct under any combination of filters.'],
  whatif: ['What-if on governed numbers', 'Inputs are your assumptions; every baseline comes from a governed query that follows the filter bar.'],
  geo: ['Coordinates as measures', 'Longitude and latitude are layer measures: a scatter becomes a map with no basemap service, and selections still flow.'],
};
const badge = (key) => el('span', { class: 'badge', title: BADGE[key][1], tabindex: '0' }, [el('i', { text: '◆' }), BADGE[key][0]]);

const card = (slot, label, { cls = '', note, badgeKey, extra } = {}) => el('figure', { class: `card ${cls}`, 'data-object': slot }, [
  el('figcaption', {}, [el('span', { class: 'card__label', text: label }), badgeKey ? badge(badgeKey) : null, extra ?? null]),
  el('div', { class: 'viz-surface is-loading', 'data-slot': slot }),
  note ? el('p', { class: 'card__note', html: note }) : null,
]);
const stat = (slot, label, caption, spark) => el('div', { class: `stat${spark ? ' stat--spark' : ''}`, 'data-object': slot }, [
  el('div', { class: 'stat__label', text: label }),
  el('div', { class: 'viz-surface stat__value is-loading', 'data-slot': slot }),
  spark ? el('div', { class: 'viz-surface stat__spark is-loading', 'data-slot': spark }) : null,
  el('div', { class: 'stat__caption', text: caption }),
]);

const CHAPTERS = [
  { id: 'hero', label: 'The network' },
  { id: 'scale', num: '01', label: 'Scale', kicker: 'Network scale', title: 'A city stitched together by nearly 8,000 bus trips a day' },
  { id: 'geo', num: '02', label: 'Geography', kicker: 'Geography', title: 'From the waterfront to the mountain villages' },
  { id: 'access', num: '03', label: 'Access', kicker: 'Accessibility', title: 'Is there a frequent bus near you?' },
  { id: 'rhythm', num: '04', label: 'Rhythm', kicker: 'Frequency & time', title: 'When the city moves' },
  { id: 'live', num: '05', label: 'Live day', kicker: 'A day on the buses', title: 'Watch 8,015 trips cross the city, minute by minute' },
  { id: 'demand', num: '06', label: 'Boarding', kicker: 'Demand proxy', title: 'Where the city changes buses' },
  { id: 'ops', num: '07', label: 'Operations', kicker: 'Operational intensity', title: 'How hard the fleet works — and where it crawls' },
  { id: 'route', num: '08', label: 'Routes', kicker: 'Route explorer', title: 'Pick a line, see its whole day' },
  { id: 'opps', num: '09', label: 'Opportunities', kicker: 'Opportunities', title: 'Where improvement pays back fastest' },
];

// ---------------------------------------------------------------------------

const T0 = performance.now();
const timings = {};
const mark = (k) => { timings[k] = Math.round(performance.now() - T0); appState.mark(k); };
const main = async () => {
  splash.set('Connecting to Astrato…', 0.08);
  // Canvas labels use only loaded fonts, and table indicators are Material Icons ligatures.
  await Promise.all(['400 12px Roboto', '700 12px Roboto', '24px "Material Icons"'].map((f) => document.fonts.load(f).catch(() => null)));
  const context = await bootstrapAstrato();
  mark('bootstrap');
  splash.set('Reading the timetable model…', 0.16);
  const { runtime, dataBinding, availableFields, fields } = context;
  const { selections, engine } = context.app.client.hostServices;

  // ----------------------------------------------------------------- governed queries
  const col = (name, view) => {
    const field = fields.raw(name, view);
    if (!field) throw new Error(`"${view}.${name}" is not in this semantic layer`);
    return field.fieldKey;
  };
  const mkey = (name) => {
    const field = fields.measure(name);
    if (!field) throw new Error(`measure "${name}" is not in this semantic layer`);
    return field.fieldKey;
  };
  const inList = (fieldKey, values) => ({ field: { fieldKey }, operator: 'inList', values });
  /** Rows of a governed query as objects keyed by the names given. */
  const q = async ({ dims = [], measures = [], filters = [], limit = 500 }) => {
    const dimensions = dims.map(([name, view]) => ({ fieldKey: col(name, view), name }));
    const calculations = measures.map((name) => ({ calculation: '{m1}', itemKey: mkey(name), label: name }));
    const query = { dimensions, calculations, orders: [], limit, offset: 0, filters, totals: false, showRecordsCount: false, outerViews: [], associativeListFilter: null };
    const { response } = await engine.getData({ ...dataBinding, query });
    const names = [...dimensions.map((d) => d.name), ...measures];
    return Object.values(response?.data ?? {}).map((row) => Object.fromEntries(names.map((name, i) => [name, row[i]])));
  };

  // ----------------------------------------------------------------- selections
  const KEY = { line: col('Line', LV), label: col('Line Label', LV), cat: col('Category', LV) };
  const LABEL_OF = Object.fromEntries(CONTROLS.map(([view, column, label]) => [col(column, view), label]));
  const viewOf = (fieldKey) => /^\[([^\]]+)\]/.exec(fieldKey)?.[1];
  /** Which views a filter on a given view can reach through the layer's joins. */
  // Every view is joined in the layer (rev 10: Stops via Line Stops, Fleet/Service via the conformed
  // Categories and Hours views), so every filter reaches every query; the engine resolves the path.
  const REACH = new Proxy({}, { get: () => ({ includes: () => true }) });
  const selectionOf = (fieldKey, values) => ({ field: { fieldKey }, fieldKey, kind: 'VALUE', operator: 'inList', values });
  let mirroring = false;
  const setGroup = (group, desired) => {
    mirroring = true;
    try {
      const { applied, pending } = selections.getSelection(group);
      for (const s of [...applied, ...pending]) if (!desired.has(s.field.fieldKey)) selections.removeSelection(group, s);
      for (const [fieldKey, values] of desired) {
        const cur = selections.getSelection(group).applied.find((s) => s.field.fieldKey === fieldKey);
        if (cur && cur.values.length === values.length && cur.values.every((v, i) => String(v) === String(values[i]))) continue;
        if (cur) selections.removeSelection(group, cur);
        if (values.length) selections.selectValues(group, selectionOf(fieldKey, values), { state: 'applied' });
      }
    } finally {
      mirroring = false;
    }
  };
  // Reset is the reader's own change, not a mirror: removing each selection outside setGroup lets
  // the main-group listener re-render the chips, re-sync the chapters and refresh the narratives
  // (through setGroup, the mirroring flag made it skip all three and nothing cleared).
  const resetMain = () => {
    const { applied, pending } = selections.getSelection(MAIN);
    for (const s of [...applied, ...pending]) selections.removeSelection(MAIN, s);
  };
  const mainApplied = () => selections.getSelection(MAIN).applied;
  /** MAIN filters a query on `view` can honour. */
  const filtersFor = (view) => mainApplied().filter((s) => REACH[viewOf(s.field.fieldKey)]?.includes(view)).map((s) => inList(s.field.fieldKey, s.values));
  const scopeLabel = () => {
    const sel = mainApplied();
    if (!sel.length) return 'the whole network';
    return sel.map((s) => `${LABEL_OF[s.field.fieldKey] ?? fields.nameOf(s.field.fieldKey)}: ${s.values.map(strip).slice(0, 2).join(' + ')}${s.values.length > 2 ? ` +${s.values.length - 2}` : ''}`).join(' · ');
  };
  /** Every applied filter with every value, for the report, where a "+3" would hide what the rows follow. */
  const scopeFull = () => {
    const sel = mainApplied();
    if (!sel.length) return 'none (the whole network)';
    return sel.map((s) => `${LABEL_OF[s.field.fieldKey] ?? fields.nameOf(s.field.fieldKey)}: ${s.values.map(strip).join(', ')}`).join(' · ');
  };

  // ------------------------------------------------------------------ shell
  const chipsHost = el('div', { class: 'chips', 'aria-live': 'polite' });
  const toastHost = el('div', { class: 'toast', hidden: true, role: 'status' });
  let toastTimer;
  const toast = (text) => { toastHost.textContent = text; toastHost.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { toastHost.hidden = true; }, 3600); };
  const reportBtn = el('button', { type: 'button', class: 'btn btn--primary', onclick: () => exportReport() }, [el('span', { 'aria-hidden': 'true', text: '⬇' }), ' Excel report']);
  const shareBtn = el('button', { type: 'button', class: 'btn btn--linkedin', onclick: () => openShare() }, [el('span', { class: 'li', 'aria-hidden': 'true', text: 'in' }), ' Share on LinkedIn']);
  const rail = el('nav', { class: 'rail', 'aria-label': 'Chapters' }, CHAPTERS.map((c) => el('a', { href: `#${c.id}`, 'data-chapter': c.id, title: c.label }, [el('i'), el('span', { text: c.label })])));
  const filterbar = el('div', { class: 'filterbar' }, [
    el('span', { class: 'filterbar__title', text: 'Explore' }),
    ...CONTROLS.map(([, column, label]) => {
      const id = `ctl-${column.replace(/\W+/g, '-').toLowerCase()}`;
      return el('label', { class: 'control', 'data-object': id }, [el('span', { class: 'control-label', text: label }), el('span', { class: 'control-slot' }, el('div', { class: 'viz-surface is-loading', 'data-slot': id }))]);
    }),
    chipsHost,
    el('button', { type: 'button', class: 'btn btn--ghost btn--sm filterbar__reset', text: 'Reset', onclick: () => resetMain() }),
  ]);
  const narr = {};
  const narrative = (id) => (narr[id] = el('p', { class: 'chapter__story skeleton', text: 'Reading the timetable…' }));
  const head = (c) => el('header', { class: 'chapter__head' }, [
    el('div', { class: 'chapter__num', text: c.num }),
    el('div', {}, [el('div', { class: 'chapter__kicker', text: c.kicker }), el('h2', { class: 'chapter__title', text: c.title }), narrative(c.id)]),
  ]);

  // Map extent switch (whole region / city centre) for the geography map.
  const extentSwitch = (slot, initial) => {
    const wrap = el('div', { class: 'seg', role: 'group', 'aria-label': 'Map extent' });
    const set = (which) => {
      wrap.querySelectorAll('button').forEach((b) => b.classList.toggle('is-on', b.dataset.v === which));
      setExtent(slot, which);
    };
    for (const [v, label] of [['region', 'Whole region'], ['city', 'City centre']]) wrap.append(el('button', { type: 'button', 'data-v': v, class: v === initial ? 'is-on' : '', text: label, onclick: () => set(v) }));
    return wrap;
  };

  // What-if simulator controls.
  const sim = { speed: 15, share: 60 };
  const simOut = el('div', { class: 'sim__out' });
  const slider = (key, label, min, max, step, unit) => {
    const out = el('output', { text: `${sim[key]}${unit}` });
    return el('label', { class: 'sim__row' }, [
      el('span', { class: 'sim__label' }, [label, out]),
      el('input', { type: 'range', min, max, step, value: sim[key], oninput: (e) => { sim[key] = Number(e.target.value); out.textContent = `${sim[key]}${unit}`; renderSim(); } }),
    ]);
  };

  // A day on the buses: clock, playback and live counters.
  const live = { t: 6 * 3600, playing: false, speed: 5, day: null, seen: false };
  const clockTime = el('div', { class: 'clock__time', text: '06:00' });
  const clockIcon = el('div', { class: 'clock__icon', text: '☀' });
  const playBtn = el('button', { type: 'button', class: 'btn btn--primary live__play', text: '▶ Play the day', onclick: () => setPlaying(!live.playing) });
  const speedSeg = el('div', { class: 'seg', role: 'group', 'aria-label': 'Speed' }, [[2, '2 min/s'], [5, '5 min/s'], [15, '15 min/s']].map(([v, label]) => el('button', { type: 'button', 'data-v': v, class: v === live.speed ? 'is-on' : '', text: label, onclick: (e) => { live.speed = v; showGrain(v); speedSeg.querySelectorAll('button').forEach((b) => b.classList.toggle('is-on', b === e.currentTarget)); } })));
  const scrub = el('input', { type: 'range', class: 'live__scrub', min: 4 * 3600, max: 25.5 * 3600, step: 60, value: live.t, 'aria-label': 'Time of day', oninput: (e) => { live.t = Number(e.target.value); renderLive(false); } });
  const liveOnRoad = el('div', { class: 'live__stat', id: 'live-onroad' });
  const liveDeparted = el('div', { class: 'live__stat' });
  const liveCats = [];
  const liveTop = el('ol', { class: 'live__toplist' });
  const fleetLabel = el('span', { class: 'card__label', text: `Buses in service, ${live.speed}-minute bars — the red line follows the clock` });
  const showGrain = (g) => {
    fleetLabel.textContent = `Buses in service, ${g}-minute bars — the red line follows the clock`;
    root.querySelectorAll('.fleet__stack > .viz-surface').forEach((n) => n.classList.toggle('is-on', n.dataset.slot === `lv-fleet-${g}`));
    live.slot = null;
  };

  const findingsHost = el('div', { class: 'hero__findlist' }, [1, 2, 3].map(() => el('div', { class: 'finding skeleton', text: 'Reading the timetable…' })));

  const sections = {
    hero: () => el('section', { class: 'chapter hero', id: 'hero' }, [
      el('div', { class: 'hero__text' }, [
        el('div', { class: 'hero__eyebrow', text: 'Θεσσαλονίκη · Urban Transport Data of the Regional Unit of Thessaloniki' }),
        el('h1', { class: 'hero__title', html: 'Thessaloniki<br><em>on the Move</em>' }),
        el('p', { class: 'hero__sub', text: 'How the city’s buses connect people, places, and daily life.' }),
        el('p', { class: 'hero__question', html: '<b>One question:</b> how well does the bus network serve the city — and where are the strongest opportunities to improve it?' }),
        narrative('hero'),
        el('div', { class: 'hero__ctas' }, [
          el('a', { class: 'hero__cta', href: '#scale', text: 'Start the story ↓' }),
          el('a', { class: 'hero__cta hero__cta--live', href: '#live', text: '▶ Watch a day on the buses' }),
        ]),
      ]),
      el('div', { class: 'hero__side' }, [
        el('div', { class: 'hero__art', html: SKYLINE }),
        el('div', { class: 'hero__findings' }, [el('div', { class: 'hero__findh', text: 'Three things to know' }), findingsHost]),
        el('figure', { class: 'card hero__pulse', 'data-object': 'k-pulse' }, [
          el('figcaption', {}, [el('span', { class: 'card__label', text: 'The city’s pulse — trips leaving each hour, average day' })]),
          el('div', { class: 'viz-surface is-loading', 'data-slot': 'k-pulse' }),
        ]),
      ]),
      el('div', { class: 'hero__stats' }, [
        stat('k-lines', 'Bus lines', 'each service day, 14 Jul – 3 Aug', 'ks-lines'),
        stat('k-stops', 'Bus stops', 'by distance from the centre', 'ks-stops'),
        stat('k-trips', 'Trips a day', 'each service day — weekends dip', 'ks-trips'),
        stat('k-vkm', 'Bus-km a day', 'each service day', 'ks-vkm'),
        stat('k-calls', 'Stop calls a day', 'chances to board, each day', 'ks-calls'),
        stat('k-buses', 'Buses at 08:00', 'in service through the day', 'ks-buses'),
      ]),
      el('p', { class: 'hero__source', html: `Source: OSETH GTFS timetable, ${PERIOD} (data.gov.gr) → Snowflake <code>ASTRATO_GALLERY.MOCK_DATA.TH_*</code> → Astrato semantic layer “Thessaloniki on the Move”. Scheduled service, not ridership.` }),
    ]),
    scale: (c) => el('section', { class: 'chapter', id: c.id }, [head(c), el('div', { class: 'grid grid--scale' }, [
      card('sc-cat', 'Trips a day by line category', { cls: 'a', badgeKey: 'ratio' }),
      card('sc-share', 'Share of bus-kilometres', { cls: 'b', badgeKey: 'share' }),
      card('sc-table', 'What each part of the network does', { cls: 'c', badgeKey: 'filtered', note: 'Categories follow the OSETH line numbering: 1–49 urban core, 50–79 suburban, 80+ regional, N night, 01X/01N airport.' }),
    ])]),
    geo: (c) => el('section', { class: 'chapter', id: c.id }, [head(c), el('div', { class: 'grid grid--geo' }, [
      card('geo-map', 'Every stop, coloured by how often a bus comes', { cls: 'a map', badgeKey: 'geo', extra: extentSwitch('geo-map', 'region'), note: 'Each dot is a stop. Red = a bus every few minutes in the weekday morning peak; blue = rarely.' }),
      card('geo-sector', 'Departures per stop, by sector', { cls: 'b', badgeKey: 'ratio' }),
      card('geo-dist', 'Stops by distance from Aristotelous Square', { cls: 'c', badgeKey: 'distinct' }),
    ])]),
    access: (c) => el('section', { class: 'chapter', id: c.id }, [head(c), el('div', { class: 'grid grid--access' }, [
      el('div', { class: 'kpis a' }, [
        stat('ac-freq', 'Frequent stops', '6+ buses an hour, AM peak'),
        stat('ac-under', 'Underserved stops', 'fewer than 3 an hour'),
        stat('ac-gap', 'Longest wait', 'average worst gap, 07–20'),
        stat('ac-sun', 'No Sunday bus', 'stops served only on weekdays/Sat'),
      ]),
      card('ac-band', 'Frequent vs underserved, by distance from the centre', { cls: 'b', badgeKey: 'ratio' }),
      card('ac-level', 'Stops by peak service level', { cls: 'c', badgeKey: 'distinct' }),
      card('ac-wait', 'Longest daytime wait at a typical stop', { cls: 'd' }),
    ])]),
    rhythm: (c) => el('section', { class: 'chapter', id: c.id }, [head(c), el('div', { class: 'grid grid--rhythm' }, [
      card('rh-hour', 'Buses leaving the terminus each hour', { cls: 'a', badgeKey: 'filtered' }),
      card('rh-heat', 'Every service day, every hour', { cls: 'b', note: 'Three weeks of timetable, 14 Jul – 3 Aug 2026. Weekends show as the paler rows.' }),
      card('rh-dow', 'Average trips by day of week', { cls: 'c', badgeKey: 'ratio' }),
      card('rh-band', 'Share of the day’s trips, by time band', { cls: 'd', badgeKey: 'share' }),
    ])]),
    live: (c) => el('section', { class: 'chapter', id: c.id }, [head(c), el('div', { class: 'grid grid--live' }, [
      card('lv-map', 'Every bus on the road, Tuesday 21 July 2026', { cls: 'a map livemap', badgeKey: 'geo', extra: extentSwitch('lv-map', 'city'), note: 'Each moving dot is a scheduled trip, placed between its stops by the timetable. Faint dots are the 3,673 stops.' }),
      el('div', { class: 'livepanel b' }, [
        el('div', { class: 'clock' }, [clockIcon, clockTime, el('div', { class: 'clock__day', text: 'Tuesday 21 July 2026 · timetable' })]),
        el('div', { class: 'live__controls' }, [playBtn, speedSeg]),
        scrub,
        el('div', { class: 'live__stats' }, [liveOnRoad, liveDeparted]),
        el('div', { class: 'live__cats' }, liveCats),
        el('div', { class: 'live__top' }, [el('div', { class: 'live__toph', text: 'Busiest lines right now' }), liveTop]),
      ]),
      el('figure', { class: 'card c fleet' }, [
        el('figcaption', {}, [fleetLabel, badge('ratio')]),
        el('div', { class: 'fleet__stack' }, [2, 5, 15].map((g) => el('div', { class: `viz-surface is-loading${g === live.speed ? ' is-on' : ''}`, 'data-slot': `lv-fleet-${g}` }))),
      ]),
    ])]),
    demand: (c) => el('section', { class: 'chapter', id: c.id }, [head(c), el('div', { class: 'grid grid--demand' }, [
      card('dm-hubs', 'The 25 busiest stops', { cls: 'a', badgeKey: 'share', note: 'No ridership is published, so scheduled departures stand in for demand: where buses stop most is where the city is built to board.' }),
      card('dm-conn', 'Stops by number of lines calling', { cls: 'b', badgeKey: 'distinct' }),
      card('dm-sector', 'Share of all weekday departures, by sector', { cls: 'c', badgeKey: 'share' }),
    ])]),
    ops: (c) => el('section', { class: 'chapter', id: c.id }, [head(c), el('div', { class: 'grid grid--ops' }, [
      card('op-speed', 'Scheduled speed by line category', { cls: 'a', badgeKey: 'ratio' }),
      card('op-scatter', 'Every line: frequency against speed', { cls: 'b', badgeKey: 'join', note: 'Dots are coloured by frequency: blue = few trips, red = many. Terracotta lines = average, blue = median, on both axes (lines in scope). Bottom-right is the problem corner: lines that run all day yet crawl. Click a dot to open it in the route explorer.' }),
      card('op-fleet', 'Buses on the road at 08:00, top 15 lines', { cls: 'c' }),
      card('op-vh', 'Bus-hours a day, by time band', { cls: 'd', badgeKey: 'ratio' }),
    ])]),
    route: (c) => el('section', { class: 'chapter', id: c.id }, [head(c), el('div', { class: 'grid grid--route' }, [
      el('div', { class: 'routepick a', 'data-object': 'ctl-line' }, [el('span', { class: 'control-label', text: 'Choose a line' }), el('div', { class: 'viz-surface is-loading', 'data-slot': 'ctl-line' }), el('p', { class: 'routepick__hint', text: 'Or click any line in the comparison table below.' })]),
      card('rt-profile', 'Line profile, reference weekday (Tue 21 Jul)', { cls: 'b', badgeKey: 'join', note: 'Gaps are minutes between buses in the main direction, 07–10 and 10–14. Trip = typical end-to-end minutes.' }),
      card('rt-map', 'Its stops on the map', { cls: 'c map' }),
      card('rt-hour', 'Trips each hour — weekday, Saturday, Sunday', { cls: 'd', badgeKey: 'filtered' }),
      card('rt-compare', 'Compare every line', { cls: 'e', badgeKey: 'share' }),
    ])]),
    opps: (c) => el('section', { class: 'chapter', id: c.id }, [head(c), el('div', { class: 'grid grid--opps' }, [
      card('op-gaps', 'Close to the centre, yet a bus less than every 20 minutes', { cls: 'a' }),
      card('op-map', 'Underserved stops (blue) against the frequent network (red)', { cls: 'b map', badgeKey: 'geo', extra: extentSwitch('op-map', 'city') }),
      card('op-slow', 'Busy and slow: where bus priority pays back fastest', { cls: 'c', badgeKey: 'join' }),
      el('figure', { class: 'card sim d' }, [
        el('figcaption', {}, [el('span', { class: 'card__label', text: 'What if the slow lines got bus priority?' }), badge('whatif')]),
        el('div', { class: 'sim__body' }, [
          el('div', { class: 'sim__inputs' }, [
            slider('speed', 'Speed gain on lines under 18 km/h', 0, 40, 1, '%'),
            slider('share', 'Share of freed bus-hours reinvested', 0, 100, 5, '%'),
            el('p', { class: 'sim__note', text: 'Bus lanes and signal priority raise scheduled speed; the same timetable then needs fewer bus-hours. Reinvested, those hours become extra trips.' }),
          ]),
          simOut,
        ]),
      ]),
    ])]),
  };

  const page = el('main', { class: 'story' }, CHAPTERS.map((c) => sections[c.id](c)));
  const failuresHost = el('section', { class: 'failures', hidden: true });
  root.replaceChildren(el('div', { class: 'app' }, [
    el('header', { class: 'topbar' }, [
      el('a', { class: 'brand', href: '#hero' }, [el('span', { class: 'brand__mark', html: '<svg viewBox="0 0 32 32" aria-hidden="true"><rect x="5" y="7" width="22" height="16" rx="4" fill="#10263F"/><rect x="8" y="10" width="16" height="6" rx="1.5" fill="#FFFDF8"/><circle cx="11" cy="24" r="2.6" fill="#E0583A"/><circle cx="21" cy="24" r="2.6" fill="#E0583A"/></svg>' }), el('span', { class: 'brand__name', html: 'Thessaloniki <em>on the Move</em>' })]),
      el('a', { class: 'madeby', href: 'https://astrato.io', target: '_blank', rel: 'noopener', title: 'Made by Astrato' }, [el('span', { text: 'made by' }), el('img', { src: 'astrato-logo.svg', alt: 'Astrato' })]),
      el('div', { class: 'topbar__meta', text: `OSETH timetable · ${PERIOD}` }),
      shareBtn,
      reportBtn,
    ]),
    filterbar, rail, page, failuresHost, toastHost,
  ]));

  // ----------------------------------------------------------- tiles: build + compile + theme
  splash.set('Compiling governed objects…', 0.24);
  const built = buildTiles(fields);
  const compiled = await compileTiles(built.tiles, availableFields);
  const allFailures = [...built.failures, ...compiled.failures];
  const prepare = async (tile) => {
    const { tile: out, failed } = await prepareTile(tile, availableFields, dataBinding);
    if (failed.length > 0) console.warn(`[theme] ${tile.id}`, JSON.stringify(failed));
    return out;
  };
  mark('compile');
  // Theming is pure computation per tile: run it for all tiles at once.
  const tiles = await Promise.all(compiled.compiled.map(prepare));
  mark('theme');
  const tileById = new Map(tiles.map((t) => [t.id, t]));
  // The smoke test's contract: every object is announced before it mounts, on its chapter
  // (filter-bar controls sit on every chapter); objects that failed to build or compile settle
  // as errors at once.
  for (const t of tiles) appState.declare(t.id, t.page === 'controls' ? null : t.page);
  for (const f of allFailures) { appState.declare(f.id, null); appState.settle(f.id, 'error', { message: f.reason }); }
  failuresHost.hidden = allFailures.length === 0;
  failuresHost.replaceChildren(el('h2', { text: `${allFailures.length} object(s) not shown` }), el('ul', {}, allFailures.map((f) => el('li', {}, [el('strong', { text: f.title ?? f.id }), ` — ${f.reason}`]))));

  /** Widen a lon/lat window so it has the plot's own shape: 1 km across = 1 km down (no skew). */
  const appliedExtent = {};
  const trueScale = (slot, ext) => {
    const surface = root.querySelector(`[data-slot="${slot}"]`);
    const r = surface && plotRect(surface, surface.parentElement);
    if (!r || !ext) return ext;
    const [w, e] = ext.lon;
    const [s0, n] = ext.lat;
    const k = Math.cos((((s0 + n) / 2) * Math.PI) / 180);
    const want = r.width / r.height;
    const lonSpan = e - w;
    const latSpan = n - s0;
    if ((lonSpan * k) / latSpan < want) {
      const half = (want * latSpan) / k / 2;
      const c = (w + e) / 2;
      return { lon: [c - half, c + half], lat: [s0, n] };
    }
    const half = (lonSpan * k) / want / 2;
    const c = (s0 + n) / 2;
    return { lon: [w, e], lat: [c - half, c + half] };
  };
  const setExtent = (slot, which) => {
    const tile = tileById.get(slot);
    if (!tile) return;
    tile.currentExtent = which;
    const ext = trueScale(slot, EXTENT[which]);
    appliedExtent[slot] = ext;
    tile.vSpec = withExtent(tile, ext);
    if (runtime.listInstances().some(({ id }) => id === slot)) runtime.updateInstance(slot, { vSpec: tile.vSpec });
    basemaps.get(slot)?.setExtent(ext);
    if (slot === 'lv-map') { busLayer?.clear(); setTimeout(() => { busLayer?.fit(); renderLive(false); }, 400); }
    if (slot === 'rt-map') setTimeout(() => drawRoutes(), 400);
  };
  let aspectTimer;
  window.addEventListener('resize', () => { clearTimeout(aspectTimer); aspectTimer = setTimeout(() => { for (const [slot] of basemaps) setExtent(slot, tileById.get(slot)?.currentExtent ?? 'region'); }, 400); });


  const fitColumns = async (tile, target) => {
    if (!tile.fitColumns) return tile;
    const width = Math.max(40, target.clientWidth - 4);
    const requests = fitColumnRequests(tile, width);
    const { vSpec } = await applyEach({ id: tile.id, type: tile.type, vSpec: tile.vSpec, dataBinding }, availableFields, tile.type, requests);
    return { ...tile, vSpec };
  };
  const releases = new Map();
  const basemaps = new Map();
  const instanceOf = (tile) => ({ id: tile.id, type: tile.type, groupId: tile.group ?? MAIN, vSpec: tile.vSpec, dataBinding });
  // Tables carry pixel column widths: re-fit in place when a cell really changes width. Charts resize themselves.
  const sizeWatch = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const tile = tileById.get(entry.target.dataset.slot);
      if (!tile?.fitColumns || !releases.has(tile.id)) continue;
      const width = Math.round(entry.contentRect.width);
      if (!tile.fittedWidth || Math.abs(width - tile.fittedWidth) <= 2) continue;
      clearTimeout(entry.target.fitTimer);
      entry.target.fitTimer = setTimeout(async () => {
        const fitted = await fitColumns(tile, entry.target);
        tile.fittedWidth = width;
        if (runtime.listInstances().some(({ id }) => id === tile.id)) runtime.updateInstance(tile.id, { vSpec: fitted.vSpec });
      }, 300);
    }
  });
  const mountTile = (tile) => new Promise((resolve) => {
    const target = root.querySelector(`[data-slot="${tile.slot}"]`);
    if (!target || releases.has(tile.id)) return resolve('skipped');
    fitColumns(tile, target).then((fitted) => {
      tile.fittedWidth = Math.round(target.clientWidth);
      if (tile.map && EXTENT[tile.extent]) basemaps.set(tile.id, attachBasemap(target));
      releases.set(tile.id, mountVisualization(runtime, instanceOf(fitted), target, (status) => {
        target.classList.remove('is-loading');
        basemaps.get(tile.id)?.setExtent(EXTENT[tile.extent]);
        tile.currentExtent = tile.extent;
        if (tile.map && EXTENT[tile.extent]) setTimeout(() => setExtent(tile.id, tile.extent), 500);
        if (tile.id === 'lv-map') { busLayer = createBusLayer(target.parentElement, target, () => { if (!live.playing) renderLive(false); }); setTimeout(() => { busLayer.fit(); renderLive(false); }, 300); }
        if (tile.id.startsWith('lv-fleet')) setTimeout(() => { live.slot = null; renderLive(false); }, 300);
        if (tile.id === 'rt-map') { routeLayer = createRouteLayer(target.parentElement, target); target.parentElement.append(routeLegend); fitRoute(); }
        resolve(status);
      }));
      if (tile.fitColumns) sizeWatch.observe(target);
    });
  });

  // ---------------------------------------------------------------- facts (narratives)
  const facts = { ready: false };
  let factsRun = 0;
  const loadFacts = async () => {
    const run = ++factsRun;
    const fs = filtersFor(SV);
    const fst = filtersFor(ST);
    const [[t = {}], cats, [s = {}], bands, hours, hubs, lines, dows, sectors, points, fleet] = await Promise.all([
      q({ measures: ['Active Lines', 'Trips per Day', 'Weekday Trips per Day', 'Saturday Trips per Day', 'Sunday Trips per Day', 'Sunday Retention', 'Vehicle Km per Day', 'Vehicle Hours per Day', 'Commercial Speed', 'Stop Calls per Day', 'Peak Share', 'Avg Trip Minutes'], filters: fs, limit: 1 }),
      q({ dims: [['Category', LV]], measures: ['Trips per Day', 'Commercial Speed', 'Share of Trips', 'Active Lines', 'Share of Vehicle Km', 'Sunday Retention'], filters: fs, limit: 10 }),
      q({ measures: ['Stops', 'Frequent Stops', 'Frequent Stop Share', 'Underserved Stops', 'Underserved Share', 'Stops Without Sunday Bus', 'Avg Longest Gap', 'Departures per Stop', 'Weekday Departures'], filters: fst, limit: 1 }),
      q({ dims: [['Dist Band', ST]], measures: ['Stops', 'Frequent Stop Share', 'Underserved Share', 'Avg Longest Gap', 'Departures per Stop'], filters: fst, limit: 10 }),
      q({ dims: [['Hour Label', SV]], measures: ['Trips per Day'], filters: fs, limit: 30 }),
      q({ dims: [['Stop Label', ST], ['Sector', ST]], measures: ['Weekday Departures', 'Lines per Stop', 'Peak Buses per Hour'], filters: fst, limit: 4000 }),
      q({ dims: [['Line Label', LV], ['Line', LV], ['Category', LV]], measures: ['Trips per Day', 'Commercial Speed', 'Vehicle Hours per Day', 'Buses at 8am', 'Avg Trip Minutes', 'Sunday Retention'], filters: fs, limit: 400 }),
      q({ dims: [['Day Label', SV]], measures: ['Trips per Day'], filters: fs, limit: 10 }),
      q({ dims: [['Sector', ST]], measures: ['Stops', 'Share of Departures', 'Departures per Stop', 'Underserved Share'], filters: fst, limit: 12 }),
      q({ dims: [['Line', LV]], measures: ['Line Weekday Trips', 'Line Speed'], filters: filtersFor(LV), limit: 400 }),
      q({ dims: [['Clock Time', FL]], measures: ['Buses in Service'], limit: 1500 }),
    ]);
    if (run !== factsRun) return;
    Object.assign(facts, {
      ready: true, t, s,
      fleetPeak: fleet.reduce((best, r) => (N(r['Buses in Service']) > N(best?.['Buses in Service'] ?? -1) ? r : best), null),
      cats: cats.sort(byTrips),
      bands: bands.sort((a, b) => String(a['Dist Band']).localeCompare(String(b['Dist Band']))),
      hours: hours.sort((a, b) => String(a['Hour Label']).localeCompare(String(b['Hour Label']))),
      hubs: hubs.sort((a, b) => N(b['Weekday Departures']) - N(a['Weekday Departures'])),
      lines: lines.sort(byTrips),
      dows: dows.sort((a, b) => String(a['Day Label']).localeCompare(String(b['Day Label']))),
      sectors: sectors.filter((r) => r.Sector !== 'Centre' && N(r.Stops) >= 100).sort((a, b) => N(b['Underserved Share']) - N(a['Underserved Share'])),
    });
    renderNarratives();
    renderSim();
    renderRefLines(points);
  };
  let factsTimer;
  const refreshFacts = (delay = 250) => { clearTimeout(factsTimer); factsTimer = setTimeout(() => loadFacts().catch((e) => console.error('[facts]', e)), delay); };

  const say = (id, html) => { if (narr[id]) { narr[id].innerHTML = html; narr[id].classList.remove('skeleton'); } };
  const renderNarratives = () => {
    const { t, s, cats, bands, hours, hubs, lines, dows, sectors, fleetPeak } = facts;
    const scope = scopeLabel();
    const core = cats.find((r) => r.Category === 'Urban core');
    const regional = cats.find((r) => r.Category === 'Regional');
    {
      const near = bands[0];
      const farB = bands.at(-1);
      const slowVH0 = lines.filter((r) => N(r['Commercial Speed']) < 18).reduce((x, r) => x + N(r['Vehicle Hours per Day']), 0);
      const items = [
        core && regional ? [`${n1(core['Commercial Speed'])} <small>vs</small> ${n1(regional['Commercial Speed'])}`, 'km/h: urban-core buses move at under half the speed of regional ones.', '#ops'] : null,
        near && farB ? [`${pct(near['Frequent Stop Share'])} <small>vs</small> ${pct(farB['Frequent Stop Share'])}`, 'of stops get a bus every 10 minutes — in the centre, against beyond 20 km.', '#access'] : null,
        [pct(slowVH0 / (N(t['Vehicle Hours per Day']) || 1)), 'of all bus-hours are spent on lines slower than 18 km/h.', '#opps'],
      ].filter(Boolean);
      findingsHost.replaceChildren(...items.map(([num, text, href]) => el('a', { class: 'finding', href }, [el('b', { html: num }), el('span', { text }), el('i', { text: '→' })])));
    }
    say('hero', `Across ${scope === 'the whole network' ? scope : `your selection (${scope})`}, the timetable schedules <b>${n0(t['Trips per Day'])} bus trips</b> and <b>${big(t['Stop Calls per Day'])} stop calls</b> on an average day — about <b>${big(t['Vehicle Km per Day'])} km</b> of driving, or ${n1(N(t['Vehicle Km per Day']) / 40075)} trips round the Earth, every day.`);
    const top = cats[0];
    say('scale', top ? `${strip(top.Category)} lines carry <b>${pct(top['Share of Trips'])}</b> of all trips. ${core && regional ? `Yet a regional bus covers ground more than twice as fast — <b>${n1(regional['Commercial Speed'])} km/h</b> against <b>${n1(core['Commercial Speed'])} km/h</b> in the urban core — because city streets, not distance, set the pace.` : ''} On a Sunday the network keeps <b>${pct(t['Sunday Retention'])}</b> of its weekday service.` : 'No service in this selection.');
    const centre = bands[0];
    const far = bands.at(-1);
    say('geo', centre && far ? `${n0(s.Stops)} stops spread from the waterfront to villages more than 20 km away. A stop in the centre sees <b>${n0(centre['Departures per Stop'])} departures</b> a weekday; one more than 20 km out sees <b>${n0(far['Departures per Stop'])}</b>.` : '');
    say('access', centre && far ? `<b>${pct(s['Frequent Stop Share'])}</b> of stops have a bus at least every 10 minutes in the morning peak, but <b>${n0(s['Underserved Stops'])}</b> (${pct(s['Underserved Share'])}) see fewer than three an hour. Near the centre ${pct(centre['Frequent Stop Share'])} of stops are frequent; beyond 20 km almost none are, and the worst daytime wait averages <b>${n0(far['Avg Longest Gap'])} minutes</b>.` : '');
    const peak = [...hours].sort(byTrips)[0];
    const sat = N(t['Saturday Trips per Day']);
    const wk = N(t['Weekday Trips per Day']);
    say('rhythm', peak ? `Service ramps up from 05:00 and peaks at <b>${peak['Hour Label']}</b>, when ${n0(peak['Trips per Day'])} trips leave their first stop. ${sat && wk ? `Saturday runs at ${pct(sat / wk)} of a weekday, Sunday at ${pct(t['Sunday Retention'])}.` : ''} ${pct(t['Peak Share'])} of all trips fall in the two peaks (07–10, 14–17).` : '');
    const h = hubs[0];
    const top25 = hubs.slice(0, 25).reduce((a, r) => a + N(r['Weekday Departures']), 0);
    say('demand', h ? `<b>${h['Stop Label'].split(' · ')[0]}</b> is the busiest stop: <b>${n0(h['Weekday Departures'])}</b> departures on a weekday from ${n0(h['Lines per Stop'])} lines. The 25 busiest stops — under 1% of all stops — handle <b>${pct(top25 / (N(s['Weekday Departures']) || 1))}</b> of departures.` : '');
    const busySlow = lines.filter((r) => N(r['Commercial Speed']) < 14 && N(r['Trips per Day']) >= 60);
    const slowestBusy = [...busySlow].sort((a, b) => N(a['Commercial Speed']) - N(b['Commercial Speed']))[0];
    say('ops', `The fleet runs <b>${n0(t['Vehicle Hours per Day'])} bus-hours</b> a day at an average scheduled speed of <b>${n1(t['Commercial Speed'])} km/h</b>. ${busySlow.length} busy lines (60+ trips a day) are scheduled below 14 km/h${slowestBusy ? `; the slowest, <b>${slowestBusy.Line}</b>, averages ${n1(slowestBusy['Commercial Speed'])} km/h` : ''}.`);
    say('live', `Press play: every scheduled trip of Tuesday 21 July moves stop to stop over the city. The fleet climbs from a handful of night buses to <b>${n0(fleetPeak?.['Buses in Service'])} buses</b> on the road at the busiest minute (${fleetPeak?.['Clock Time'] ?? '—'}), holds that level until the evening, and thins out after 21:00. The chart below is the same day from the governed layer, averaged per ten minutes.`);
    const busiest = lines[0];
    say('route', busiest ? `${n0(t['Active Lines'])} lines, compared side by side. The busiest is <b>${busiest['Line Label']}</b> with ${n0(busiest['Trips per Day'])} trips a day. Choose any line to see its stops, its timetable through the day and how its weekend compares.` : '');
    const sec = sectors[0];
    const slowVH = lines.filter((r) => N(r['Commercial Speed']) < 18).reduce((a, r) => a + N(r['Vehicle Hours per Day']), 0);
    say('opps', `Two levers stand out. <b>Frequency at the edge:</b> ${n0(s['Underserved Stops'])} stops wait more than 20 minutes for a bus${sec ? `, most of all in the <b>${sec.Sector.toLowerCase()}</b> (${pct(sec['Underserved Share'])} of its stops)` : ''}. <b>Speed in the core:</b> lines slower than 18 km/h burn <b>${n0(slowVH)} bus-hours</b> a day — ${pct(slowVH / (N(t['Vehicle Hours per Day']) || 1))} of the fleet’s time.`);
    void dows;
  };

  /** Average and median of both axes on the line scatter, recomputed for the lines in scope. */
  const renderRefLines = (points) => {
    const tile = tileById.get('op-scatter');
    if (!tile || !points.length) return;
    const stats = (key) => {
      const v = points.map((r) => N(r[key])).filter((x) => x != null).sort((a, b) => a - b);
      const mid = v.length >> 1;
      return { avg: v.reduce((a, b) => a + b, 0) / v.length, med: v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2 };
    };
    const x = stats('Line Weekday Trips');
    const y = stats('Line Speed');
    const line = (value, stroke, text, axis, alt) => ({
      value, stroke, strokeWidth: 1.5, showOob: false,
      label: { text, showValue: true, fontSize: 11, fill: stroke, padding: 4, vAlign: alt ? 'bottom' : 'top', align: axis === 'x' ? 'left' : alt ? 'left' : 'right' },
    });
    tile.vSpec = { ...tile.vSpec, refLines: {
      x: [line(x.avg, C.terra, 'Avg', 'x'), line(x.med, C.sea, 'Median', 'x', true)],
      y: [line(y.avg, C.terra, 'Avg', 'y'), line(y.med, C.sea, 'Median', 'y', true)],
    } };
    if (runtime.listInstances().some(({ id }) => id === tile.id)) runtime.updateInstance(tile.id, { vSpec: tile.vSpec });
  };

  const renderSim = () => {
    if (!facts.ready) return;
    const slow = facts.lines.filter((r) => N(r['Commercial Speed']) < 18);
    const vh = slow.reduce((a, r) => a + N(r['Vehicle Hours per Day']), 0);
    const buses = slow.reduce((a, r) => a + N(r['Buses at 8am']), 0);
    const g = sim.speed / 100;
    const saved = vh * (g / (1 + g));
    const freed = buses * (g / (1 + g));
    const tripH = (N(facts.t['Avg Trip Minutes']) || 45) / 60;
    const extra = (saved * sim.share / 100) / tripH;
    const growth = extra / (N(facts.t['Trips per Day']) || 1);
    simOut.replaceChildren(
      el('div', { class: 'sim__big' }, [el('b', { text: n0(saved) }), el('span', { text: 'bus-hours saved a day' })]),
      el('div', { class: 'sim__big' }, [el('b', { text: n0(freed) }), el('span', { text: 'buses freed at 08:00' })]),
      el('div', { class: 'sim__big sim__big--hot' }, [el('b', { text: `+${n0(extra)}` }), el('span', { text: `extra trips a day (+${pct(growth, 1)})` })]),
      el('p', { class: 'sim__foot', text: `Baseline: ${slow.length} lines under 18 km/h, ${n0(vh)} bus-hours/day, ${n0(buses)} buses at 08:00; average trip ${n0(tripH * 60)} min. Scope: ${scopeLabel()}.` }),
    );
  };

  const renderChips = () => {
    chipsHost.replaceChildren(...mainApplied().map((s) => el('span', { class: 'chip' }, [
      el('b', { text: `${LABEL_OF[s.field.fieldKey] ?? fields.nameOf(s.field.fieldKey)}:` }), ` ${s.values.map(strip).slice(0, 2).join(', ')}${s.values.length > 2 ? ` +${s.values.length - 2}` : ''}`,
      el('button', { type: 'button', 'aria-label': 'Remove', text: '×', onclick: () => selections.removeSelection(MAIN, s) }),
    ])));
  };

  // ------------------------------------------------------------- selection wiring
  // Line number → label, so every route selection sits on the dropdown's own field (a selection on
  // the line number would grey out every other label in the dropdown).
  let labelOf = null;
  const labels = q({ dims: [['Line', LV], ['Line Label', LV]], limit: 400 }).then((rows) => { labelOf = new Map(rows.map((r) => [r.Line, r['Line Label']])); return labelOf; });
  const openLine = async (values, announce) => {
    const map = labelOf ?? (await labels);
    const vals = values.key === KEY.label ? values.values : values.values.map((v) => map.get(v) ?? v);
    setGroup(ROUTE, new Map([[KEY.line, []], [KEY.label, vals]]));
    if (announce) toast(`Line ${values.values[0]} opened in the route explorer ↓`);
  };
  let applyTimer;
  selections.onActiveSelectionChange(MAIN).subscribe((next) => {
    if (mirroring) return;
    // A click on a line (anywhere in the story) opens it in the route explorer instead of filtering.
    const lineClick = [...next.pending, ...next.applied].find((s) => s.field.fieldKey === KEY.line || s.field.fieldKey === KEY.label);
    if (lineClick) {
      setTimeout(() => {
        selections.removeSelection(MAIN, lineClick);
        openLine({ key: lineClick.field.fieldKey, values: [lineClick.values[0]] }, true);
      }, 0);
      return;
    }
    clearTimeout(applyTimer);
    if (next.pending.length > 0) applyTimer = setTimeout(() => selections.applyPendingSelections(MAIN), 300);
    renderChips();
    setTimeout(() => onMainChanged(), 0);
    // Narratives after the visible chapter's charts have had the query lanes.
    refreshFacts(1500);
    setTimeout(() => schedulePrefetch(4000), 0);
  });

  // ---- prefetch: when idle, pre-run what the screen shows under each filter value, so a click is
  // answered from the session cache. Values come once from the layer.
  let candidates = null;
  const loadCandidates = async () => {
    if (candidates) return candidates;
    const lists = await Promise.all(CONTROLS.map(([view, column]) => q({ dims: [[column, view]], limit: 50 }).then((rows) => ({ fieldKey: col(column, view), values: rows.map((r) => r[column]).filter((v) => v != null) })).catch(() => null)));
    candidates = lists.filter(Boolean);
    return candidates;
  };
  let prefetchTimer;
  // Idle means every object has mounted: prefetch holds two of the four query lanes, and started
  // during boot (the selection listener fires on subscribe) it slowed the last mounts to ~5 s each.
  let mountedAll = false;
  const schedulePrefetch = (delay = 2500) => {
    if (!mountedAll) return;
    clearTimeout(prefetchTimer);
    prefetchTimer = setTimeout(async () => {
      const c = await loadCandidates();
      const chapter = visibleChapter;
      // Shapes of the visible chapter's charts: the dimension list each one queries.
      const shapes = new Set(tiles.filter((t) => t.page === chapter || t.type === 'filter').map((t) => (t.definition?.data?.field ? [t.definition.data.field] : t.definition?.data?.dimensions ?? t.definition?.data?.columns?.filter((c) => c.role === 'dimension') ?? []).map((d) => d.fieldKey).join('|')));
      const n = await prefetchSelections(c, { maxQueries: 300, shapes });
      (window.__prefetch ??= []).push({ at: Math.round(performance.now()), n, chapter, shapes: [...shapes], known: debugShapes().length, matched: [...shapes].filter((x) => debugShapes().includes(x)).length });
    }, delay);
  };

  // ---- per-chapter groups: the chapter on screen follows the filter bar at once, the others when
  // they come into view. A chart click inside a chapter is forwarded to the filter bar.
  const chapterGroups = [...new Set(tiles.map((t) => t.group).filter((g) => String(g).startsWith('ch-')))];
  const dirty = new Set();
  let visibleChapter = 'hero';
  const mainMap = () => new Map(mainApplied().map((x) => [x.field.fieldKey, x.values]));
  const syncChapter = (id) => {
    const g = chapterGroup(id);
    if (!chapterGroups.includes(g) || !dirty.has(g)) return;
    dirty.delete(g);
    setGroup(g, mainMap());
  };
  const chapterOrder = CHAPTERS.map((c) => c.id);
  let neighbourTimer;
  const onMainChanged = () => {
    // The simulated day follows the line-category filter; redraw it now, not only while it plays.
    if (live.day && !live.playing) renderLive(false);
    for (const g of chapterGroups) dirty.add(g);
    syncChapter(visibleChapter);
    // The chapters either side follow shortly after, so the next step is usually ready.
    clearTimeout(neighbourTimer);
    neighbourTimer = setTimeout(() => {
      const i = chapterOrder.indexOf(visibleChapter);
      for (const id of [chapterOrder[i + 1], chapterOrder[i - 1]]) if (id) syncChapter(id);
    }, 1800);
  };
  for (const g of chapterGroups) {
    selections.onActiveSelectionChange(g).subscribe((next) => {
      if (mirroring || next.pending.length === 0) return;
      const picked = next.pending.map((x) => ({ key: x.field.fieldKey, values: x.values }));
      setTimeout(() => {
        selections.clearPendingSelections(g);
        for (const { key, values } of picked) selections.selectValues(MAIN, selectionOf(key, values), { state: 'pending' });
      }, 0);
    });
  }
  selections.onActiveSelectionChange(ROUTE).subscribe((next) => {
    if (mirroring) return;
    // Several lines may be compared at once; each gets its own colour on the route map.
    const pick = next.pending.some((s) => s.field.fieldKey === KEY.label || s.field.fieldKey === KEY.line);
    if (pick) setTimeout(() => selections.applyPendingSelections(ROUTE), 0);
    else if (next.pending.length > 0) setTimeout(() => selections.clearPendingSelections(ROUTE), 0);
    setTimeout(() => fitRoute(), 0);
  });

  // ------------------------------------------------------------- route paths, one colour per line
  let routeLayer = null;
  const routeLegend = el('div', { class: 'route__legend' });
  const selectedLines = () => {
    const sel = selections.getSelection(ROUTE).applied;
    const byLabel = sel.find((x) => x.field.fieldKey === KEY.label)?.values ?? [];
    const byLine = sel.find((x) => x.field.fieldKey === KEY.line)?.values ?? [];
    return [...byLine.map(String), ...byLabel.map((l) => String(l).split(' · ')[0])];
  };
  const drawRoutes = () => {
    if (!live.day || !routeLayer) return;
    const names = selectedLines();
    const paths = names.map((name, i) => ({ name, color: ROUTE_COLORS[i % ROUTE_COLORS.length], coords: linePaths(live.day, name) }));
    routeLayer.draw(paths, appliedExtent['rt-map'] ?? EXTENT.route);
    routeLegend.replaceChildren(...paths.map((p) => el('span', { class: 'route__chip' }, [el('i', { style: { background: p.color } }), p.name])));
  };

  // ------------------------------------------------------------- route map extent
  // Fit the route map (and its basemap) to the stops of the selected lines, with a margin.
  let fitTimer;
  const fitRoute = () => {
    clearTimeout(fitTimer);
    fitTimer = setTimeout(async () => {
      const sel = selections.getSelection(ROUTE).applied.map((x) => inList(x.field.fieldKey, x.values));
      if (!sel.length) return;
      const pts = await q({ dims: [['Stop Lon', LS], ['Stop Lat', LS]], filters: sel, limit: 3000 }).catch(() => []);
      const lons = pts.map((r) => N(r['Stop Lon'])).filter((v) => v != null);
      const lats = pts.map((r) => N(r['Stop Lat'])).filter((v) => v != null);
      if (!lons.length) return;
      let [w, e, s2, n] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
      const pw = Math.max(0.006, (e - w) * 0.12);
      const ph = Math.max(0.005, (n - s2) * 0.12);
      EXTENT.route = { lon: [w - pw, e + pw], lat: [s2 - ph, n + ph] };
      setExtent('rt-map', 'route');
      drawRoutes();
    }, 250);
  };

  // ------------------------------------------------------------- one chapter per step
  // The wheel and arrow/page keys jump whole chapters; a table under the pointer that can still
  // scroll in that direction keeps the wheel.
  const chapters = [...page.querySelectorAll('.chapter')];
  let stepping = false;
  const currentIndex = () => {
    const mid = window.innerHeight * 0.4;
    let best = 0;
    chapters.forEach((c, i) => { if (c.getBoundingClientRect().top <= mid) best = i; });
    return best;
  };
  // Scroll to exactly the chapter's top (below the sticky bars), with our own easing, and ignore
  // further wheel input until it lands: one gesture, one chapter, no overshoot or correction.
  const barsHeight = () => document.querySelector('.topbar').offsetHeight + (desktop() ? document.querySelector('.filterbar').offsetHeight : 0);
  let target = 0;
  let lastWheel = 0;
  const step = (dir) => {
    const next = Math.max(0, Math.min(chapters.length - 1, currentIndex() + dir));
    const to = Math.round(chapters[next].getBoundingClientRect().top + window.scrollY - barsHeight());
    if (Math.abs(to - window.scrollY) < 2) return;
    stepping = true;
    target = to;
    const from = window.scrollY;
    const t0 = performance.now();
    const dur = 520;
    const ease = (x) => 1 - (1 - x) ** 3;
    const tick = (now) => {
      const k = Math.min(1, (now - t0) / dur);
      window.scrollTo(0, from + (target - from) * ease(k));
      if (k < 1) requestAnimationFrame(tick);
      else setTimeout(() => { stepping = false; }, 180);
    };
    requestAnimationFrame(tick);
  };
  const scrollsInside = (target, dy) => {
    for (let n = target; n && n !== page; n = n.parentElement) {
      if (n.scrollHeight > n.clientHeight + 2 && /(auto|scroll)/.test(getComputedStyle(n).overflowY)) {
        if (dy > 0 ? n.scrollTop + n.clientHeight < n.scrollHeight - 1 : n.scrollTop > 0) return true;
      }
    }
    return false;
  };
  const desktop = () => window.matchMedia('(min-width: 901px)').matches;
  window.addEventListener('wheel', (e) => {
    if (!desktop() || e.ctrlKey || Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;
    if (scrollsInside(e.target, e.deltaY)) return;
    e.preventDefault();
    // One chapter per gesture: inertia keeps firing wheel events, so a new step needs 220 ms of quiet.
    const now = performance.now();
    const fresh = now - lastWheel > 220;
    lastWheel = now;
    if (stepping || !fresh || Math.abs(e.deltaY) < 2) return;
    step(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });
  window.addEventListener('keydown', (e) => {
    if (!desktop() || /input|select|textarea/i.test(e.target.tagName)) return;
    const dir = { PageDown: 1, ArrowDown: 1, ' ': 1, PageUp: -1, ArrowUp: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    if (!stepping) step(dir);
  });

  // ------------------------------------------------------------- chapter rail
  const spy = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      rail.querySelectorAll('a').forEach((a) => a.classList.toggle('is-on', a.dataset.chapter === entry.target.id));
      visibleChapter = entry.target.id;
      syncChapter(visibleChapter);
      schedulePrefetch(2500);
    }
  }, { rootMargin: '-45% 0px -50% 0px' });
  page.querySelectorAll('.chapter').forEach((s) => spy.observe(s));
  const reveal = new IntersectionObserver((entries) => {
    for (const entry of entries) if (entry.isIntersecting) entry.target.classList.add('is-in');
  }, { threshold: 0.08 });
  page.querySelectorAll('.chapter').forEach((s) => reveal.observe(s));

  // ------------------------------------------------------------- A day on the buses
  let busLayer = null;
  const hhmm = (t) => { const m = Math.floor(t / 60) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  const lineCounts = (buses) => { const c = new Map(); for (const b of buses) c.set(b.line, (c.get(b.line) ?? 0) + 1); return [...c].sort((a, b) => b[1] - a[1]); };
  const renderLive = (trail = true) => {
    const day = live.day;
    if (!day) return;
    // The simulation follows the line-category filter, like the governed fleet chart under it.
    const catSel = mainApplied().find((x) => x.field.fieldKey === KEY.cat)?.values;
    const allowed = catSel?.length ? new Set(catSel.map((c) => day.categories.indexOf(String(c)))) : null;
    const buses = busesAt(day, live.t).filter((b) => !allowed || allowed.has(b.cat));
    const extent = appliedExtent['lv-map'] ?? EXTENT[tileById.get('lv-map')?.currentExtent ?? 'city'];
    busLayer?.draw(buses, extent, { trail });
    const m = Math.floor(live.t / 60) % 1440;
    clockTime.textContent = hhmm(live.t);
    clockIcon.textContent = m >= 6 * 60 + 20 && m < 20 * 60 + 40 ? '☀' : '☾';
    clockIcon.classList.toggle('is-night', clockIcon.textContent === '☾');
    scrub.value = String(live.t);
    let lo = 0; let hi = day.starts.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (day.starts[mid] <= live.t) lo = mid + 1; else hi = mid; }
    const departed = lo;
    liveOnRoad.innerHTML = `<b>${n0(buses.length)}</b><span>buses on the road</span>`;
    liveDeparted.innerHTML = `<b>${n0(departed)}</b><span>of ${n0(day.trips.length)} trips started</span>`;
    const byCat = day.categories.map((_, i) => buses.filter((b) => b.cat === i).length);
    const peak = 260;
    liveCats.forEach((row, i) => { row.querySelector('i').style.width = `${Math.min(100, (byCat[i] / peak) * 100)}%`; row.querySelector('b').textContent = n0(byCat[i]); });
    liveTop.replaceChildren(...lineCounts(buses).slice(0, 5).map(([line, n]) => el('li', {}, [el('b', { text: day.lines[line][0] }), el('span', { text: `${n} bus${n === 1 ? '' : 'es'}` })])));
    // Playhead: a native Astrato reference line on the fleet chart's time axis, moved when the
    // clock enters a new minute (at most four moves a second).
    const g = live.speed;
    const slot = `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(Math.floor((m % 60) / g) * g).padStart(2, '0')}`;
    const fleetId = `lv-fleet-${g}`;
    const fleetTile = tileById.get(fleetId);
    const now = performance.now();
    if (fleetTile && slot !== live.slot && now - (live.slotAt ?? 0) > 250 && runtime.listInstances().some(({ id }) => id === fleetId)) {
      live.slot = slot;
      live.slotAt = now;
      fleetTile.vSpec = { ...fleetTile.vSpec, refLines: { x: [{ value: slot, stroke: C.terra, strokeWidth: 2, showOob: false, label: { text: `Now ${slot}`, showValue: false, fontSize: 11, fill: C.terra, vAlign: 'top', align: 'right', padding: 4 } }] } };
      runtime.updateInstance(fleetId, { vSpec: fleetTile.vSpec });
    }
  };
  let last = 0;
  const frame = (now) => {
    if (!live.playing) return;
    if (document.hidden) { requestAnimationFrame(frame); last = 0; return; }
    const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
    last = now;
    live.t += dt * live.speed * 60;
    if (live.t > 25.5 * 3600) live.t = 4 * 3600;
    renderLive(true);
    requestAnimationFrame(frame);
  };
  const setPlaying = (on) => {
    live.playing = on && Boolean(live.day);
    playBtn.textContent = live.playing ? '❚❚ Pause' : '▶ Play the day';
    last = 0;
    if (live.playing) requestAnimationFrame(frame);
  };
  live.day = null;
  loadDay().then((day) => {
    live.day = day;
    liveCats.push(...day.categories.map((name, i) => el('div', { class: 'live__cat' }, [el('span', { text: name }), el('em', {}, el('i', { style: { background: CAT_COLORS[i] } })), el('b', { text: '0' })])));
    root.querySelector('.live__cats')?.replaceChildren(...liveCats);
    drawRoutes();
    renderLive(false);
  }).catch((e) => {
    // No trips extract shipped (public/sim-day.json): keep the governed fleet chart and the stop
    // map, and say what the animation needs instead of showing a dead play button.
    console.warn('[sim]', e.message);
    live.missing = true;
    playBtn.disabled = true;
    playBtn.textContent = 'Needs a trips extract';
    scrub.disabled = true;
    liveOnRoad.innerHTML = '<b>—</b><span>needs a trips extract</span>';
    liveDeparted.replaceChildren(el('span', { class: 'live__missing', text: 'The animated day reads public/sim-day.json, a compacted day of trips from the GTFS feed. It is not shipped with this example; see the README to build one. The fleet chart below is governed and works without it.' }));
  });
  // Start playing the first time the chapter scrolls into view.
  new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting && !live.seen && live.day) { live.seen = true; setPlaying(true); }
      if (!e.isIntersecting && live.playing) setPlaying(false);
    }
  }, { threshold: 0.35 }).observe(document.getElementById('live'));

  // ------------------------------------------------------------- Share on LinkedIn
  const shareDialog = el('dialog', { class: 'share' });
  document.body.append(shareDialog);
  const postText = () => {
    const { t, s, cats, bands, lines } = facts;
    const core = cats.find((r) => r.Category === 'Urban core');
    const regional = cats.find((r) => r.Category === 'Regional');
    const near = bands[0];
    const far = bands.at(-1);
    const slowVH = lines.filter((r) => N(r['Commercial Speed']) < 18).reduce((x, r) => x + N(r['Vehicle Hours per Day']), 0);
    const scope = scopeLabel();
    return [
      `🚌 Thessaloniki on the Move: what 3 weeks of the city’s bus timetable say${scope === 'the whole network' ? '' : ` (${scope})`}.`,
      '',
      `• ${n0(t['Trips per Day'])} bus trips and ${big(t['Stop Calls per Day'])} stop calls on an average day, across ${n0(t['Active Lines'])} lines and ${n0(s.Stops)} stops.`,
      core && regional ? `• Urban-core buses are scheduled at ${n1(core['Commercial Speed'])} km/h, against ${n1(regional['Commercial Speed'])} km/h on regional lines: city streets, not distance, set the pace.` : null,
      near && far ? `• ${pct(near['Frequent Stop Share'])} of stops in the centre get a bus every 10 minutes at peak; beyond 20 km it is ${pct(far['Frequent Stop Share'])}.` : null,
      `• Lines slower than 18 km/h use ${pct(slowVH / (N(t['Vehicle Hours per Day']) || 1))} of all bus-hours: the clearest case for bus priority.`,
      '',
      'Built as an Astrato App on a governed semantic layer over open OSETH GTFS data (data.gov.gr), loaded into Snowflake.',
      '',
      '#Thessaloniki #PublicTransport #OpenData #DataViz #Astrato #Snowflake',
    ].filter((x) => x !== null).join('\n');
  };
  const cardData = () => {
    const { t, s, cats, bands, lines, hours } = facts;
    const core = cats.find((r) => r.Category === 'Urban core');
    const regional = cats.find((r) => r.Category === 'Regional');
    const near = bands[0];
    const far = bands.at(-1);
    const slowVH = lines.filter((r) => N(r['Commercial Speed']) < 18).reduce((x, r) => x + N(r['Vehicle Hours per Day']), 0);
    return {
      scope: scopeLabel() === 'the whole network' ? 'Whole network' : scopeLabel().slice(0, 40),
      findings: [
        core && regional ? { big: `${n1(core['Commercial Speed'])} vs ${n1(regional['Commercial Speed'])}`, text: 'km/h: urban-core buses move at under half the speed of regional ones.' } : null,
        near && far ? { big: `${pct(near['Frequent Stop Share'])} vs ${pct(far['Frequent Stop Share'])}`, text: 'of stops get a bus every 10 minutes: centre against beyond 20 km.' } : null,
        { big: pct(slowVH / (N(t['Vehicle Hours per Day']) || 1)), text: 'of all bus-hours are spent on lines slower than 18 km/h.' },
      ].filter(Boolean),
      kpis: [
        { label: 'Trips a day', value: n0(t['Trips per Day']) },
        { label: 'Bus lines', value: n0(t['Active Lines']) },
        { label: 'Bus stops', value: n0(s.Stops) },
        { label: 'Bus-km a day', value: big(t['Vehicle Km per Day']) },
        { label: 'Stop calls a day', value: big(t['Stop Calls per Day']) },
      ],
      hours: hours.map((h) => ({ label: h['Hour Label'], value: N(h['Trips per Day']) ?? 0 })),
    };
  };
  const openShare = async () => {
    if (!facts.ready) { toast('Still reading the timetable — try again in a moment.'); return; }
    const canvas = await drawCard(cardData());
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/png'));
    const url = URL.createObjectURL(blob);
    const text = el('textarea', { class: 'share__text', rows: 10, value: postText() });
    const status = el('p', { class: 'share__status', text: '' });
    // LinkedIn's web composer will not take a pasted image: it only accepts "Add media" or a drop.
    // So: download the image, open the composer with the text, and say how to attach it.
    const fileName = `thessaloniki-on-the-move-${new Date().toISOString().slice(0, 10)}.png`;
    const openLinkedIn = () => {
      downloadImage();
      const win = window.open(linkedInComposer(text.value), '_blank', 'noopener');
      status.innerHTML = `Image downloaded as <b>${fileName}</b>. In LinkedIn, click the <b>🖼 Add media</b> icon under the post and choose it (or drag the file into the post), then post.${win ? '' : ' Allow pop-ups to open LinkedIn automatically.'}`;
    };
    const file = new File([blob], fileName, { type: 'image/png' });
    const canShareFile = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
    const shareSheet = async () => {
      try {
        await navigator.share({ files: [file], text: text.value, title: 'Thessaloniki on the Move' });
        status.textContent = 'Shared through your system share sheet.';
      } catch (error) {
        if (error?.name !== 'AbortError') status.textContent = `The share sheet is not available here (${error?.message ?? error}). Use “Open LinkedIn” instead.`;
      }
    };
    const downloadImage = () => {
      const a = el('a', { href: url, download: fileName });
      document.body.append(a);
      a.click();
      a.remove();
    };
    shareDialog.replaceChildren(
      el('div', { class: 'share__head' }, [el('h3', { text: 'Share on LinkedIn' }), el('button', { type: 'button', class: 'share__x', 'aria-label': 'Close', text: '×', onclick: () => shareDialog.close() })]),
      el('img', { class: 'share__img', src: url, alt: 'Share image: Thessaloniki on the Move' }),
      el('label', { class: 'share__label', text: 'Your post (edit before sharing)' }),
      text,
      el('div', { class: 'share__actions' }, [
        el('button', { type: 'button', class: 'btn btn--linkedin', onclick: openLinkedIn }, [el('span', { class: 'li', 'aria-hidden': 'true', text: 'in' }), ' Download image & open LinkedIn']),
        canShareFile ? el('button', { type: 'button', class: 'btn', onclick: shareSheet, text: '↗ Share with image…' }) : null,
        el('button', { type: 'button', class: 'btn', onclick: downloadImage, text: '⬇ Download image only' }),
      ]),
      status,
      el('p', { class: 'share__note', text: 'The image and text use the governed numbers for the filters on screen. LinkedIn accepts images only through its Add media button, so the image is downloaded for you to attach. “Share with image…” uses your system share sheet where the browser supports it.' }),
    );
    shareDialog.showModal();
  };

  // ------------------------------------------------------------- Excel report
  // The workbook as a Blob. Every query passes the filter bar's applied selections explicitly
  // (filtersFor), so every sheet follows them whichever chapter is on screen. A pick still pending
  // in its 300 ms debounce is applied first, so the report never leaves out the filter just chosen.
  const buildWorkbook = async () => {
    if (selections.getSelection(MAIN).pending.length) {
      clearTimeout(applyTimer);
      selections.applyPendingSelections(MAIN);
      // Let the main listener run (a line click there is moved to the route explorer, not kept).
      await new Promise((r) => setTimeout(r, 0));
    }
    return buildReport({ q, filtersFor, views: { SV, LV, ST }, scope: scopeFull(), period: PERIOD });
  };
  const exportReport = async () => {
    reportBtn.disabled = true;
    reportBtn.lastChild.textContent = ' Building report…';
    try {
      const blob = await buildWorkbook();
      downloadReport(blob);
      toast('Management report downloaded: 7 tabs, scoped to the filters on screen.');
    } catch (error) {
      console.error('[report]', error);
      toast(`Report failed: ${error.message ?? error}`);
    } finally {
      reportBtn.disabled = false;
      reportBtn.lastChild.textContent = ' Excel report';
    }
  };

  // ------------------------------------------------------------- mount: hero first, then the rest
  // The landing objects start at once; filters follow in the same lanes; the route line is chosen
  // once its dropdown has mounted (a selection made before the filter exists is lost).
  splash.set('Counting buses…', 0.36);
  refreshFacts();
  const order = ['hero', 'controls', ...CHAPTERS.map((c) => c.id).filter((id) => id !== 'hero')];
  const rank = (t) => (t.id === 'ctl-line' ? 1.5 : /^k-(lines|stops|trips|vkm|calls|buses)$/.test(t.id) ? -1 : order.indexOf(t.page));
  const queue = [...tiles].sort((a, b) => rank(a) - rank(b));
  let next = 0;
  const lane = async () => {
    while (next < queue.length) {
      const tile = queue[next++];
      await mountTile(tile);
      if (tile.id === 'ctl-line') openLine({ key: KEY.line, values: [DEFAULT_LINE] }, false);
    }
  };
  const allMounted = Promise.all(Array.from({ length: MOUNT_CONCURRENCY }, lane)).then(() => { mark('all-mounted'); mountedAll = true; schedulePrefetch(1000); });
  // ------------------------------------------------------------- smoke-test contract
  // Each chapter is a "tab" for the smoke test: it scrolls there and screenshots it.
  const showChapter = async (id) => {
    const node = document.getElementById(id);
    if (!node) return;
    window.scrollTo(0, Math.round(node.getBoundingClientRect().top + window.scrollY - barsHeight()));
    await new Promise((r) => setTimeout(r, 1200));
  };
  for (const c of CHAPTERS) appState.tab(c.id, () => showChapter(c.id));

  const hash = (str) => { let h = 0; for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0; return h.toString(36); };
  /** What an object shows: its text, and its canvas and SVG drawing, as one short fingerprint. */
  const look = (slot) => {
    const node = root.querySelector(`[data-slot="${slot}"]`);
    if (!node) return 'missing';
    const canvases = [...node.querySelectorAll('canvas')].map((c) => { try { return c.toDataURL(); } catch { return ''; } }).join('');
    const svg = [...node.querySelectorAll('svg')].map((x) => x.outerHTML).join('');
    return hash(`${node.innerText}|${canvases}|${svg}`);
  };
  /** A figure as text: an object's text, or a chapter's governed narrative (`narr:<chapter>`). */
  const figure = (ref) => (ref.startsWith('narr:') ? narr[ref.slice(5)]?.textContent ?? '' : ref.startsWith('#') ? root.querySelector(ref)?.innerText ?? '' : root.querySelector(`[data-slot="${ref}"]`)?.innerText ?? '').replace(/\s+/g, ' ').trim();
  const short = (text) => (text.length > 60 ? `${text.slice(0, 57)}…` : text);
  const settleQuiet = () => appState.quiet({ quietMs: 2000, paintMs: 1500, timeoutMs: 25000 });
  const pickCategory = async () => {
    const values = (await q({ dims: [['Category', LV]], limit: 20 })).map((r) => r.Category).filter(Boolean);
    return values.includes('Regional') ? 'Regional' : values[1] ?? values[0];
  };
  // Per chapter: a figure that must move (a KPI or the chapter's governed narrative) and a chart or table.
  const CHECKS = [
    ['hero', 'k-trips', 'k-pulse'], ['scale', 'narr:scale', 'sc-table'], ['geo', 'narr:geo', 'geo-sector'],
    ['access', 'ac-under', 'ac-band'], ['rhythm', 'narr:rhythm', 'rh-hour'], ['live', '#live-onroad', 'lv-fleet-5'],
    ['demand', 'narr:demand', 'dm-hubs'], ['ops', 'narr:ops', 'op-speed'], ['route', 'narr:route', 'rt-compare'],
    ['opps', 'narr:opps', 'op-slow'],
  ];
  for (const [chapter, kpi, object] of CHECKS) {
    appState.check(`${chapter}: a line-category filter moves ${kpi} and ${object}; Reset restores them`, async () => {
      await showChapter(chapter);
      // The day on the buses is paused at 08:00, so only the filter can move its counters.
      if (chapter === 'live') { setPlaying(false); live.t = 8 * 3600; renderLive(false); }
      await settleQuiet();
      const value = await pickCategory();
      const before = { kpi: figure(kpi), obj: look(object) };
      // The filter bar's own path: a pending selection in the main group, applied by the app.
      selections.selectValues(MAIN, selectionOf(KEY.cat, [value]), { state: 'pending' });
      await settleQuiet();
      const during = { kpi: figure(kpi), obj: look(object), chips: chipsHost.innerText.replace(/\s+/g, ' ').trim() };
      filterbar.querySelector('.filterbar__reset').click();
      await settleQuiet();
      const after = { kpi: figure(kpi), obj: look(object), chips: chipsHost.innerText.trim() };
      // Without the trips extract (not shipped) the live counter has nothing to filter: check only
      // the governed fleet chart there, and say so.
      const noExtract = chapter === 'live' && live.missing;
      const kpiOk = noExtract || (before.kpi !== '' && during.kpi !== before.kpi && after.kpi === before.kpi);
      const pass = kpiOk && during.obj !== before.obj && after.chips === '';
      return { pass, detail: `${noExtract ? '(no trips extract: counter not checked) ' : ''}Category=${value}: "${short(before.kpi)}" -> "${short(during.kpi)}" -> "${short(after.kpi)}"; ${object} ${before.obj} -> ${during.obj} -> ${after.obj}; chips "${during.chips}" -> "${after.chips}"` };
    });
  }
  appState.check('route: choosing another line changes the line profile and hourly chart; going back restores them', async () => {
    await showChapter('route');
    await settleQuiet();
    const map = labelOf ?? (await labels);
    const other = [...map.keys()].find((line) => line !== DEFAULT_LINE);
    const before = { profile: figure('rt-profile'), hour: look('rt-hour') };
    await openLine({ key: KEY.line, values: [other] }, false);
    await settleQuiet();
    const during = { profile: figure('rt-profile'), hour: look('rt-hour') };
    await openLine({ key: KEY.line, values: [DEFAULT_LINE] }, false);
    await settleQuiet();
    const after = { profile: figure('rt-profile'), hour: look('rt-hour') };
    const pass = before.profile !== '' && during.profile !== before.profile && during.hour !== before.hour && after.profile === before.profile;
    return { pass, detail: `${DEFAULT_LINE} -> ${other} -> ${DEFAULT_LINE}: "${short(before.profile)}" -> "${short(during.profile)}" -> "${short(after.profile)}"` };
  });
  appState.check('opps: the bus-priority what-if responds to its speed slider', async () => {
    await showChapter('opps');
    const input = root.querySelector('.sim input[type="range"]');
    const before = simOut.innerText;
    input.value = '30';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const during = simOut.innerText;
    input.value = String(15);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const after = simOut.innerText;
    return { pass: before !== '' && during !== before && after === before, detail: `${short(before.replace(/\s+/g, ' '))} -> ${short(during.replace(/\s+/g, ' '))}` };
  });
  appState.check('Excel report: the button builds and downloads the 7-tab workbook', async () => {
    reportBtn.click();
    for (let i = 0; i < 100 && (reportBtn.disabled || toastHost.hidden); i++) await new Promise((r) => setTimeout(r, 300));
    const said = toastHost.textContent;
    return { pass: said.startsWith('Management report downloaded'), detail: said };
  });

  // The kit builds the workbook with no filter and with one line category, from the landing
  // chapter, and fails any sheet whose figures did not move. The category goes in through the
  // filter bar's own path, as in the checks above: a pending selection in the main group.
  appState.exportProbe({
    build: () => buildWorkbook(),
    select: async () => selections.selectValues(MAIN, selectionOf(KEY.cat, [await pickCategory()]), { state: 'pending' }),
    clear: () => resetMain(),
    exempt: ['Definitions'],
  });

  window.__astrato = { timings, live, renderLive, setPlaying, context, facts, mounted, selections, tiles, failures: allFailures, q, col, KEY, setGroup, openLine, sim, renderSim, allMounted };

  // The splash closes when the six landing numbers are in; everything else shows "Loading…" in place.
  const opened = performance.now();
  const watch = setInterval(() => {
    const kpis = [...document.querySelectorAll('#hero .stat__value')];
    const left = kpis.filter((n) => n.classList.contains('is-loading')).length;
    splash.set(left ? `Counting buses… ${kpis.length - left} of ${kpis.length}` : 'Ready', 0.36 + ((kpis.length - left) / (kpis.length || 1)) * 0.64);
    if ((kpis.length && !left) || performance.now() - opened > SPLASH_MAX_MS) {
      clearInterval(watch);
      mark('hero-ready'); mark('landing-ready'); // the kit times the landing budget from this mark
      setTimeout(splash.done, 200);
    }
  }, 150);
};

main().catch((error) => {
  console.error(error);
  appState.bootFailed(error);
  splash.done();
  root.replaceChildren(el('main', { class: 'boot-error' }, [
    el('h2', { text: 'Could not start the Astrato App' }),
    el('p', { class: 'error', text: String(error) }),
    el('p', { class: 'hint', html: 'Open this page at the origin printed by <code>astrato dev</code>, or from Astrato hosting.' }),
  ]));
});
