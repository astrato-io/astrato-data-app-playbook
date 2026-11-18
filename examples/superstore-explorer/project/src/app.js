/**
 * Superstore explorer — Astrato App entry.
 *
 * Plain browser modules, no framework, bundled by Vite. The hosting boundary
 * supplies tenant, semantic layer and datasource context through
 * `/_astrato/v1/bootstrap`; nothing is configured here.
 *
 * Page brief
 *   Question:   Who and what drives sales and profit in the chosen period, and how does one
 *               customer or product compare with its last period?
 *   Layout:     master–detail, summary band variant; drill-through detail page; side rail
 *   Style:      storytelling with data (one accent, greys elsewhere)
 *   Expert:     Few (one screen per page, sign and arrow on every change)
 *   Components: header, period picker (presets + comparison), filter bar + drawer, quick filters
 *               (Ship Mode), metric switcher, KPI cards with sparkline and change, narrative,
 *               master list with Customers | Products tabs and search, drill-down bar with
 *               breadcrumbs, trend with line ⇄ bars, record table, item header (previous, next,
 *               back), object menu, toasts, loaders, object and page states
 *
 * Everything shares one selection group. The period, the filters, the quick filters, the drill
 * path and the picked item are all applied selections in it; the Astrato objects follow them
 * by themselves and the app's own queries turn them into filters. The overview's KPI mini charts
 * describe all items, so they sit in a mirror group that copies every selection but the pick.
 */
import { createAstratoApp } from '@astrato-io/app-runtime';
import { createVisualizationRuntime, registry } from '@astrato-io/visualizations';
import { createVisualizationAvailableFields } from '@astrato-io/visualizations/definitions';
import { appState } from './app-state.js';
import { DATE, GROUP, INK, ITEM, LEVELS, METRICS, metricById, prepareChart, typeOf, V } from './charts.js';
import { downloadXlsx, exportCsv, toXlsx } from './exports.js';

const root = document.getElementById('root');
const READY_TIMEOUT_MS = 30000;
/** The overview KPI mini charts' group: every selection of GROUP except the picked item. */
const ALL_ITEMS = `${GROUP}-all-items`;
const DAY = 86_400_000;

const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children)) if (child != null) node.append(child);
  return node;
};
const svgIcon = (d) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 24 24');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = d;
  return s;
};

// ---------------------------------------------------------------- dates
// All dates are UTC calendar days; the engine returns them as epoch ms at midnight UTC.
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const utc = (y, m, d) => Date.UTC(y, m, d);
const parts = (t) => {
  const d = new Date(t);
  return [d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()];
};
const addMonths = (t, n) => {
  const [y, m, d] = parts(t);
  const last = new Date(utc(y, m + n + 1, 0)).getUTCDate();
  return utc(y, m + n, Math.min(d, last));
};
const shortDate = (t) => new Date(t).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });
const monthLabel = (t) => new Date(t).toLocaleDateString('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });

const PRESETS = {
  mtd: { label: 'Month to date', months: 1, start: ([y, m]) => utc(y, m, 1) },
  qtd: { label: 'Quarter to date', months: 3, start: ([y, m]) => utc(y, m - (m % 3), 1) },
  ytd: { label: 'Year to date', months: 12, start: ([y]) => utc(y, 0, 1) },
  l12m: { label: 'Last 12 months', months: 12, start: ([y, m]) => utc(y, m - 11, 1) },
  all: { label: 'All time', start: null },
};
const COMPARES = { previous: 'previous period', lastYear: 'same period last year', none: 'no comparison' };

// ----------------------------------------------------------- formatting
const pct = (v, dp = 1) => `${(v * 100).toFixed(dp)}%`;
const changeOf = (metric, cur, prev) => {
  if (typeof cur !== 'number' || typeof prev !== 'number') return null;
  if (metric.ratio) return { value: cur - prev, text: `${Math.abs((cur - prev) * 100).toFixed(1)} pts` };
  if (prev === 0) return null;
  const g = (cur - prev) / Math.abs(prev);
  return { value: g, text: pct(Math.abs(g)) };
};

// ------------------------------------------------------------------ boot
const bootstrap = async () => {
  const app = await createAstratoApp();
  const metadata = await app.client.hostServices.engine.fields.getFieldMetadata({ ...app.dataBinding });
  const runtime = createVisualizationRuntime({ client: app.client, registry });
  const availableFields = createVisualizationAvailableFields(metadata ?? {}).filter((f) => f?.resultType !== 'unhandled');
  appState.fields(availableFields);
  // Resolve every field the page needs up front, by key, from the live catalogue.
  const known = new Set(availableFields.map((f) => f.fieldKey));
  const needed = [DATE, ...LEVELS.map((l) => l.field), V('Customer Name'), V('Ship Mode'), V('Region'), V('Segment'), V('Order ID'), ...METRICS.map((m) => m.itemKey)];
  const missing = needed.filter((k) => !known.has(k));
  if (missing.length) throw new Error(`The semantic layer is missing ${missing.join(', ')}`);
  return { app, runtime, availableFields, dataBinding: { ...app.dataBinding } };
};

const main = async () => {
  // The font and the bootstrap are independent; wait for both at once.
  const [, ctx] = await Promise.all([document.fonts.load('400 12px Roboto').catch(() => {}), bootstrap()]);
  const { runtime, availableFields, dataBinding } = ctx;
  const engine = ctx.app.client.hostServices.engine;
  const selections = ctx.app.client.hostServices.selections;

  /*
   * Every query — the charts' and the app's — goes through here: at most LANES at a time, one
   * retry, and identical requests answered from a cache (the data is a static extract), so
   * clearing a selection or switching back to a page costs no round trip. A selection written
   * without an operator reaches the engine as a filter without one, which it refuses (HTTP 400,
   * "Astrato rejected the runtime request"); such a filter is sent as inList.
   * Every request is reported to appState; the objects' answers are also kept by shape
   * (`objectAnswers`) so the app's checks can tell that a chart's rows changed.
   */
  const rawGetData = engine.getData.bind(engine);
  const appRequests = new WeakSet();
  const cache = new Map();
  const objectAnswers = new Map();
  const shapeOf = (query) => [...(query?.dimensions ?? []).map((d) => d.fieldKey ?? d.itemKey ?? d.field?.fieldKey), '|', ...(query?.calculations ?? []).map((c) => c.itemKey ?? c.label)].join(',');
  const rowsOf = (response) => {
    const data = response?.response?.data ?? {};
    return Object.keys(data).sort((a, b) => a - b).map((k) => data[k]);
  };
  const LANES = 4; // 8 concurrent requests were tested without a refusal; 4 is gentler on the source
  let running = 0;
  const waiting = [];
  const slot = () => (running < LANES ? (running++, Promise.resolve()) : new Promise((r) => waiting.push(r)));
  const release = () => {
    const next = waiting.shift();
    if (next) next();
    else running--;
  };
  const withOperators = (request) => {
    const filters = request?.query?.filters;
    if (!Array.isArray(filters) || filters.every((f) => f.operator)) return request;
    return { ...request, query: { ...request.query, filters: filters.map((f) => (f.operator ? f : { ...f, operator: 'inList' })) } };
  };
  engine.getData = (original, ...rest) => {
    const request = withOperators(original);
    const key = JSON.stringify(request);
    const own = appRequests.has(original);
    const note = (response) => {
      // Rows compared as a set: rows that tie on the sort may come back in any order.
      if (!own) objectAnswers.set(shapeOf(request?.query), { filters: request?.query?.filters ?? [], rows: JSON.stringify(rowsOf(response).map((r) => JSON.stringify(r)).sort()) });
      return response;
    };
    if (cache.has(key)) {
      appState.query(shapeOf(request?.query), 0, true);
      return Promise.resolve(note(structuredClone(cache.get(key))));
    }
    const attempt = () => rawGetData(request, ...rest);
    const started = performance.now();
    return slot()
      .then(() => attempt().catch(() => new Promise((r) => setTimeout(r, 400)).then(attempt)))
      .finally(release)
      .then((response) => {
        appState.query(shapeOf(request?.query), performance.now() - started, false);
        cache.set(key, structuredClone(response));
        return note(response);
      });
  };
  const q = async (query) => {
    const full = { dimensions: [], calculations: [], orders: [], limit: 100, offset: 0, filters: [], totals: false, showRecordsCount: false, outerViews: [], associativeListFilter: null, ...query };
    try {
      const request = { ...dataBinding, query: full };
      appRequests.add(request);
      const { response } = await engine.getData(request);
      const data = response?.data ?? {};
      return Object.keys(data).sort((a, b) => a - b).map((k) => data[k]);
    } catch (error) {
      throw new Error(`${error?.message ?? error} — query ${JSON.stringify(full)}`);
    }
  };
  const calc = (m) => ({ calculation: '{m1}', itemKey: m.itemKey, label: m.id });
  const dim = (fieldKey, name, extra = {}) => ({ fieldKey, name, ...extra });

  // Anchor: the data stops on 2019-12-30, so every period counts back from the last order date.
  const [[maxDate, minDate]] = await q({
    calculations: ['MAX', 'MIN'].map((aggregation) => ({ calculation: '{m1}', measures: [{ aggregation, fieldKeys: [DATE], filters: [] }], label: aggregation })),
    limit: 1,
  });
  const distinct = async (key) => (await q({ dimensions: [dim(key, 'v')], orders: [{ columnIdx: 0, direction: 'asc' }], limit: 50 })).map((r) => r[0]);
  const FILTER_FIELDS = [
    { key: V('Region'), label: 'Region' },
    { key: V('Segment'), label: 'Segment' },
    { key: V('Category'), label: 'Category' },
  ];
  for (const f of FILTER_FIELDS) f.values = await distinct(f.key);
  const shipModes = await distinct(V('Ship Mode'));

  const ITEM_KEYS = [ITEM.customers.key, ITEM.products.key];
  const NAMES = { [DATE]: 'Order date', [V('Ship Mode')]: 'Ship mode', [V('Sub-Category')]: 'Sub-Category', [V('Customer Name')]: 'Customer', [V('Product Name')]: 'Product', [V('Order ID')]: 'Order ID', ...Object.fromEntries(FILTER_FIELDS.map((f) => [f.key, f.label])) };

  const state = {
    page: 'overview',
    metric: 'sales',
    listTab: 'customers',
    search: '',
    trendType: 'line',
    period: { preset: 'l12m', compare: 'previous', from: null, to: null },
    applied: [],
    list: [],
    level: -1,
  };

  // ------------------------------------------------------------ periods
  const currentRange = () => {
    const p = state.period;
    if (p.preset === 'custom') return { from: p.from, to: p.to };
    const preset = PRESETS[p.preset];
    return { from: preset.start ? preset.start(parts(maxDate)) : minDate, to: maxDate, months: preset.months };
  };
  const compareRange = () => {
    const cur = currentRange();
    const c = state.period.compare;
    if (c === 'none') return null;
    if (c === 'lastYear') return { from: addMonths(cur.from, -12), to: addMonths(cur.to, -12) };
    if (cur.months) return { from: addMonths(cur.from, -cur.months), to: addMonths(cur.to, -cur.months) };
    const days = Math.round((cur.to - cur.from) / DAY) + 1;
    return { from: cur.from - days * DAY, to: cur.from - DAY };
  };
  const periodName = () => (state.period.preset === 'custom' ? 'Custom range' : PRESETS[state.period.preset].label);
  const rangeText = (r) => `${shortDate(r.from)} – ${shortDate(r.to)}`;

  // --------------------------------------------------------- selections
  const keyOfSel = (s) => s?.field?.fieldKey ?? s?.fieldKey;
  const setSelection = (fieldKey, values, operator = 'inList') => {
    const { applied, pending } = selections.getSelection(GROUP);
    for (const s of [...applied, ...pending]) if (keyOfSel(s) === fieldKey) selections.removeSelection(GROUP, s);
    if (values && values.length) selections.selectValues(GROUP, { field: { fieldKey }, fieldKey, kind: 'VALUE', operator, values }, { state: 'applied' });
  };
  const applyPeriod = () => {
    const r = currentRange();
    setSelection(DATE, [iso(r.from), iso(r.to)], 'between');
  };
  const appliedOn = (key) => state.applied.find((s) => keyOfSel(s) === key);

  /** Applied selections as query filters. `range` replaces the period; `exclude` drops fields. */
  const filtersFor = ({ exclude = [], range } = {}) => {
    const out = [];
    for (const s of state.applied) {
      const key = keyOfSel(s);
      if (exclude.includes(key) || key === DATE) continue;
      out.push({ field: { fieldKey: key }, operator: 'inList', values: s.values });
    }
    const r = range ?? currentRange();
    out.push({ field: { fieldKey: DATE }, operator: 'between', values: [{ dataType: 'date', valueDate: iso(r.from) }, { dataType: 'date', valueDate: iso(r.to) }] });
    return out;
  };
  /** The same filters as filtersFor, in words, for the line under an export's title. */
  const scopeFor = ({ exclude = [] } = {}) => {
    const out = [`${periodName()} (${rangeText(currentRange())})`];
    for (const s of state.applied) {
      const key = keyOfSel(s);
      if (exclude.includes(key) || key === DATE) continue;
      out.push(`${NAMES[key] ?? key}: ${s.values.join(', ')}`);
    }
    if (ITEM_KEYS.every((k) => exclude.includes(k))) out.push('all customers and products');
    return out.join(' · ');
  };

  // -------------------------------------------------------------- objects
  /*
   * Every object registers how to produce its data as a table, for the object
   * menu's Show as table / CSV / Excel. All of them are queries the app runs
   * itself — the two charts included, by re-running their shape here.
   */
  const objects = new Map();
  const register = (id, spec) => objects.set(id, spec);

  // ------------------------------------------------------------------ toasts
  const toasts = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
  const toast = (text, kind = 'ok') => {
    const t = el('div', { class: `toast toast--${kind}`, text });
    toasts.append(t);
    setTimeout(() => t.remove(), 3500);
  };

  // -------------------------------------------------------------- mounting
  const mounted = new Map();
  /** Mount one Astrato object; resolves once it has rendered, failed or been released. */
  const mount = (id, type, vSpec, container, { group = GROUP, tab = state.page } = {}) => {
    mounted.get(id)?.release();
    container.replaceChildren();
    const record = { id, render: 'pending' };
    let handle;
    let released = false;
    appState.declare(id, tab);
    record.release = () => {
      if (released) return;
      released = true;
      handle?.unmount();
      if (runtime.listInstances().some((i) => i.id === id)) runtime.removeInstance(id);
      if (mounted.get(id) === record) mounted.delete(id);
      // Released before it rendered (a page switch or a remount): it is no longer expected to.
      if (record.render === 'pending' && window.__appState?.objects?.[id]?.status === 'pending') delete window.__appState.objects[id];
    };
    mounted.set(id, record);
    const busy = container.closest('.card, .kpi');
    busy?.classList.add('is-loading');
    record.done = (async () => {
      try {
        runtime.createInstance({ id, type, groupId: group, vSpec, dataBinding });
        handle = await runtime.mount(container, id);
        if (released) return handle.unmount();
        const ready = await Promise.race([handle.ready, new Promise((r) => setTimeout(() => r({ status: 'timeout' }), READY_TIMEOUT_MS))]);
        record.render = ready?.status ?? 'unknown';
        if (!released) appState.settle(id, record.render, ready);
        if (record.render === 'error') showObjectState(container, 'failed', () => mount(id, type, vSpec, container, { group, tab }));
      } catch (error) {
        record.render = 'failed';
        console.error(`[viz] ${id}`, error);
        if (!released) appState.settle(id, 'error', error);
        showObjectState(container, 'failed', () => mount(id, type, vSpec, container, { group, tab }));
      } finally {
        if (!released || mounted.get(id) === undefined) busy?.classList.remove('is-loading');
      }
    })();
    return record.done;
  };
  /** Build a spec through the shared compile path, then mount it. */
  const mountSpec = async (spec, host, options) => {
    const built = await prepareChart(spec, availableFields);
    if (built.failed.length) console.warn(`[build] ${spec.id}`, built.failed);
    return mount(spec.id, typeOf(spec), built.vSpec, host, options);
  };

  /** Object states inside a card body: empty or failed, with a way out. */
  const showObjectState = (host, kind, retry, text) => {
    const msg =
      kind === 'empty'
        ? el('div', { class: 'state state--empty' }, [el('p', { class: 'state-title', text: text ?? 'Nothing in this selection' }), el('p', { text: 'Widen the period or clear a filter.' }), el('button', { type: 'button', class: 'btn', text: 'Clear filters', onclick: clearFilters })])
        : el('div', { class: 'state state--failed', role: 'alert' }, [el('p', { class: 'state-title', text: text ?? 'This data could not be loaded' }), el('p', { text: 'The query failed. Try again; if it keeps failing, the data source may be unavailable.' }), retry ? el('button', { type: 'button', class: 'btn', text: 'Retry', onclick: retry }) : null]);
    host.replaceChildren(msg);
  };

  // ================================================================ shell
  const I = {
    overview: '<path d="M4 4h7v7H4zM13 4h7v4h-7zM13 10h7v10h-7zM4 13h7v7H4z" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    detail: '<circle cx="12" cy="8" r="3.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 20c1-4 4-6 7-6s6 2 7 6" fill="none" stroke="currentColor" stroke-width="1.6"/>',
    calendar: '<rect x="4" y="5" width="16" height="15" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M4 10h16M9 3v4M15 3v4" stroke="currentColor" stroke-width="1.6"/>',
    filter: '<path d="M4 6h16M7 12h10M10 18h4" stroke="currentColor" stroke-width="1.8"/>',
    dots: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  };

  const railBtns = ['overview', 'detail'].map((p) =>
    el('button', { type: 'button', class: 'rail-btn', 'data-page': p, 'aria-label': p === 'overview' ? 'Overview' : 'Detail', title: p === 'overview' ? 'Overview' : 'Detail', onclick: () => showPage(p) }, [svgIcon(I[p]), el('span', { text: p === 'overview' ? 'Overview' : 'Detail' })]),
  );
  const rail = el('nav', { class: 'rail', 'aria-label': 'Pages' }, [el('div', { class: 'rail-mark', text: 'S' }), ...railBtns]);

  // ---- period picker
  const periodLabel = el('span', { class: 'period-label' });
  const periodSub = el('span', { class: 'period-sub' });
  const periodTrigger = el('button', { type: 'button', class: 'period-trigger', popovertarget: 'period-menu' }, [svgIcon(I.calendar), el('span', { class: 'period-text' }, [periodLabel, periodSub])]);
  const radio = (name, value, label, checked) => el('label', {}, [el('input', { type: 'radio', name, value, checked }), label]);
  const fromIn = el('input', { type: 'date', name: 'from', min: iso(minDate), max: iso(maxDate) });
  const toIn = el('input', { type: 'date', name: 'to', min: iso(minDate), max: iso(maxDate) });
  const customSet = el('fieldset', { class: 'period-menu__custom', disabled: true }, [el('legend', { text: 'Custom range' }), el('label', {}, ['From ', fromIn]), el('label', {}, ['To ', toIn])]);
  const periodMenu = el('div', { class: 'period-menu', id: 'period-menu', popover: 'auto', 'aria-label': 'Period' }, [
    el('fieldset', {}, [el('legend', { text: 'Period' }), ...Object.entries(PRESETS).map(([k, p]) => radio('period', k, p.label, k === state.period.preset)), radio('period', 'custom', 'Custom range', false)]),
    customSet,
    el('fieldset', {}, [el('legend', { text: 'Compare with' }), ...Object.entries(COMPARES).map(([k, t]) => radio('compare', k, t[0].toUpperCase() + t.slice(1), k === state.period.compare))]),
    el('p', { class: 'period-note', text: `Periods end on the last order date, ${shortDate(maxDate)}.` }),
  ]);
  periodMenu.addEventListener('change', (e) => {
    const t = e.target;
    if (t.name === 'period') {
      customSet.disabled = t.value !== 'custom';
      if (t.value === 'custom') {
        const r = currentRange();
        fromIn.value = iso(r.from);
        toIn.value = iso(r.to);
      }
      state.period.preset = t.value;
    }
    if (t.name === 'compare') state.period.compare = t.value;
    if (state.period.preset === 'custom') {
      if (!fromIn.value || !toIn.value || fromIn.value > toIn.value) return;
      state.period.from = Date.parse(`${fromIn.value}T00:00:00Z`);
      state.period.to = Date.parse(`${toIn.value}T00:00:00Z`);
    }
    applyPeriod();
    // A comparison change alone does not change a selection; refresh by hand.
    if (t.name === 'compare') refreshAll();
  });

  const header = el('header', { class: 'masthead' }, [el('h1', { text: 'Superstore explorer' }), el('div', { class: 'masthead-tools' }, [periodTrigger, periodMenu])]);

  // ---- filter bar
  const filterCount = el('span', { class: 'badge', hidden: true });
  const filtersBtn = el('button', { type: 'button', class: 'btn btn--filters', 'aria-expanded': 'false', 'aria-controls': 'drawer', onclick: () => toggleDrawer() }, [svgIcon(I.filter), 'Filters', filterCount]);
  const quick = el('div', { class: 'quick', role: 'group', 'aria-label': 'Ship mode' }, [
    el('span', { class: 'quick-label', text: 'Ship mode' }),
    ...shipModes.map((v) => el('button', { type: 'button', class: 'quick-btn', 'data-value': v, 'aria-pressed': 'false', text: v, onclick: () => toggleValue(V('Ship Mode'), v) })),
  ]);
  const chips = el('ul', { class: 'chips' });
  const clearAllBtn = el('button', { type: 'button', class: 'link-btn', text: 'Clear all', onclick: () => clearFilters() });
  const appliedBox = el('div', { class: 'applied', hidden: true, 'aria-label': 'Applied filters' }, [chips, clearAllBtn]);
  const filterBar = el('div', { class: 'filterbar' }, [filtersBtn, quick, appliedBox]);

  const toggleValue = (key, value) => {
    const cur = appliedOn(key)?.values ?? [];
    setSelection(key, cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value]);
  };
  /** Clears every filter, quick filter and drill step; keeps the period and the picked item. */
  const clearFilters = () => {
    const keep = [DATE, ITEM[state.listTab].key];
    const { applied, pending } = selections.getSelection(GROUP);
    for (const s of [...applied, ...pending]) if (!keep.includes(keyOfSel(s))) selections.removeSelection(GROUP, s);
  };

  // ---- drawer
  const drawerBody = el('div', { class: 'drawer-body' });
  const drawer = el('aside', { class: 'drawer', id: 'drawer', hidden: true, 'aria-label': 'Filters' }, [
    el('div', { class: 'drawer-head' }, [el('h2', { text: 'Filters' }), el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close filters', text: '×', onclick: () => toggleDrawer(false) })]),
    drawerBody,
    el('div', { class: 'drawer-foot' }, [el('button', { type: 'button', class: 'link-btn', text: 'Clear all', onclick: () => clearFilters() }), el('button', { type: 'button', class: 'btn btn--primary', text: 'Done', onclick: () => toggleDrawer(false) })]),
  ]);
  drawerBody.append(
    ...FILTER_FIELDS.map((f) =>
      el('fieldset', { class: 'drawer-group' }, [
        el('legend', { text: f.label }),
        ...f.values.map((v) => el('label', {}, [el('input', { type: 'checkbox', 'data-key': f.key, value: v, onchange: () => toggleValue(f.key, v) }), v])),
      ]),
    ),
  );
  const toggleDrawer = (open = drawer.hidden) => {
    drawer.hidden = !open;
    filtersBtn.setAttribute('aria-expanded', String(open));
    if (open) drawer.querySelector('input')?.focus();
  };
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !drawer.hidden) toggleDrawer(false);
  });

  // ============================================================ overview
  const card = (id, title, sub, body, { tools, cls = '' } = {}) => {
    const t = el('h2', { class: 'card-title', text: title });
    const s = el('p', { class: 'card-sub', text: sub });
    const menuBtn = el('button', { type: 'button', class: 'menu-btn', 'aria-label': `Options for ${title}`, 'aria-haspopup': 'menu', onclick: (e) => openMenu(e, id) }, svgIcon(I.dots));
    const node = el('section', { class: `card ${cls}`, 'data-object-id': id }, [el('div', { class: 'card-head' }, [el('div', { class: 'card-titles' }, [t, s]), el('div', { class: 'card-tools' }, [tools, menuBtn])]), el('div', { class: 'card-body' }, body)]);
    return { node, title: t, sub: s };
  };

  // ---- KPI cards
  const makeKpis = (prefix) =>
    METRICS.map((m) => {
      const value = el('span', { class: 'kpi-value', text: '–' });
      const change = el('span', { class: 'kpi-change' });
      const spark = el('div', { class: 'spark' });
      const node = el('section', { class: 'kpi', 'data-object-id': `${prefix}-${m.id}`, 'data-metric': m.id }, [
        el('div', { class: 'kpi-head' }, [el('h3', { class: 'kpi-label', text: m.label }), el('button', { type: 'button', class: 'menu-btn', 'aria-label': `Options for ${m.label}`, onclick: (e) => openMenu(e, `${prefix}-${m.id}`) }, svgIcon(I.dots))]),
        value,
        change,
        spark,
      ]);
      return { m, node, value, change, spark };
    });
  const kpis = makeKpis('kpi');
  const narrative = el('p', { class: 'narrative', 'data-object-id': 'narrative', 'aria-live': 'polite', text: 'Reading the period…' });

  // ---- master list
  const listTabs = Object.entries(ITEM).map(([k, it]) => el('button', { type: 'button', role: 'tab', class: 'tab', 'data-tab': k, 'aria-selected': String(k === state.listTab), text: it.label + 's', onclick: () => setListTab(k) }));
  const searchIn = el('input', { type: 'search', class: 'search', placeholder: 'Search customers', 'aria-label': 'Search the list', oninput: (e) => { state.search = e.target.value; renderList(); } });
  const listCount = el('p', { class: 'list-count' });
  const listUl = el('ul', { class: 'md-items' });
  const listBox = el('div', { class: 'md-scroll' }, listUl);
  const listSection = el('section', { class: 'md-list card', 'data-object-id': 'list', 'aria-label': 'Customers and products' }, [
    el('div', { class: 'md-list-head' }, [el('div', { class: 'tabs', role: 'tablist' }, listTabs), el('button', { type: 'button', class: 'menu-btn', 'aria-label': 'Options for the list', onclick: (e) => openMenu(e, 'list') }, svgIcon(I.dots))]),
    searchIn,
    listCount,
    listBox,
  ]);

  // ---- detail pane
  const detailName = el('h2', { class: 'detail-name', id: 'detail-title' });
  const openDetailBtn = el('button', { type: 'button', class: 'btn', text: 'Open detail ›', onclick: () => showPage('detail') });
  const metricSwitch = el('div', { class: 'seg', role: 'group', 'aria-label': 'Metric' }, METRICS.map((m) => el('button', { type: 'button', 'data-metric': m.id, 'aria-pressed': String(m.id === state.metric), text: m.label, onclick: () => setMetric(m.id) })));

  const crumbs = el('nav', { class: 'crumbs', 'aria-label': 'Drill path' });
  const drillHost = el('div', { class: 'viz' });
  const drillCard = card('drill', 'Sales by category', '', [crumbs, drillHost], { cls: 'card--drill' });

  const trendSwitch = (onPick) => el('div', { class: 'seg seg--small', role: 'group', 'aria-label': 'Show trend as' }, [['line', 'Line'], ['bar', 'Bars']].map(([v, t]) => el('button', { type: 'button', 'data-view': v, 'aria-pressed': String(v === state.trendType), text: t, onclick: () => onPick(v) })));
  const trendHost = el('div', { class: 'viz' });
  const trendCard = card('trend', 'Sales by month', '', trendHost, { tools: trendSwitch((v) => setTrendType(v)), cls: 'card--trend' });

  const recordsHost = el('div', { class: 'records' });
  const recordsCard = card('records', 'Order lines', '', recordsHost, { cls: 'card--records' });

  const detailPane = el('section', { class: 'md-detail', 'aria-labelledby': 'detail-title' }, [
    el('div', { class: 'detail-head' }, [detailName, openDetailBtn, el('span', { class: 'spacer' }), el('span', { class: 'seg-label', text: 'Metric' }), metricSwitch]),
    el('div', { class: 'detail-grid' }, [drillCard.node, trendCard.node]),
    recordsCard.node,
  ]);

  const overview = el('section', { class: 'page page--overview', 'data-page': 'overview' }, [
    el('div', { class: 'band band--kpis', 'data-group': 'KPI cards' }, kpis.map((k) => k.node)),
    narrative,
    el('div', { class: 'md' }, [listSection, detailPane]),
  ]);

  // ============================================================== detail
  const itemPos = el('span', { class: 'item-pos' });
  const itemKind = el('p', { class: 'item-kind' });
  const itemName = el('h2', { class: 'item-name' });
  const prevBtn = el('button', { type: 'button', class: 'btn', text: '‹ Previous', onclick: () => stepItem(-1) });
  const nextBtn = el('button', { type: 'button', class: 'btn', text: 'Next ›', onclick: () => stepItem(1) });
  const itemHeader = el('div', { class: 'item-header' }, [
    el('button', { type: 'button', class: 'btn', text: '← Back to overview', onclick: () => showPage('overview') }),
    el('div', { class: 'item-title' }, [itemKind, itemName]),
    el('div', { class: 'item-nav' }, [prevBtn, itemPos, nextBtn]),
  ]);
  const dkpis = makeKpis('dkpi');
  const dTrendHost = el('div', { class: 'viz' });
  const dTrendCard = card('dtrend', 'Sales by month', '', dTrendHost, { tools: trendSwitch((v) => setTrendType(v)) });
  const dLinesHost = el('div', { class: 'records' });
  const dLinesCard = card('dlines', 'Order lines', '', dLinesHost);
  const detailPage = el('section', { class: 'page page--detail', 'data-page': 'detail', hidden: true }, [
    itemHeader,
    el('div', { class: 'band band--kpis', 'data-group': 'Item KPI cards' }, dkpis.map((k) => k.node)),
    el('div', { class: 'detail-body' }, [dTrendCard.node, dLinesCard.node]),
  ]);

  // ---- object menu and data dialog
  const menu = el('div', { class: 'menu', role: 'menu', hidden: true });
  const dialogTable = el('div', { class: 'dialog-table' });
  const dialogTitle = el('h2');
  let dialogData = null;
  const dialog = el('dialog', { class: 'dialog', 'aria-labelledby': 'dlg-title' }, [
    el('div', { class: 'dialog-head' }, [Object.assign(dialogTitle, { id: 'dlg-title' }), el('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Close', text: '×', onclick: () => dialog.close() })]),
    dialogTable,
    el('div', { class: 'dialog-foot' }, [
      el('button', { type: 'button', class: 'btn', text: 'Export CSV', onclick: () => doExport('csv', dialogData) }),
      el('button', { type: 'button', class: 'btn', text: 'Export Excel', onclick: () => doExport('xlsx', dialogData) }),
    ]),
  ]);

  root.replaceChildren(el('div', { class: 'shell' }, [rail, el('div', { class: 'main' }, [header, filterBar, el('main', { class: 'pages' }, [overview, detailPage])]), drawer, menu, dialog, toasts]));

  // ============================================================ behaviour
  const metric = () => metricById(state.metric);
  const itemField = () => ITEM[state.listTab].key;
  const picked = () => appliedOn(itemField())?.values?.[0] ?? null;

  const drillLevel = () => (appliedOn(V('Sub-Category')) ? 2 : appliedOn(V('Category')) ? 1 : 0);

  const renderCrumbs = () => {
    const cat = appliedOn(V('Category'));
    const sub = appliedOn(V('Sub-Category'));
    const steps = [{ label: 'All categories', clear: [V('Category'), V('Sub-Category')] }];
    if (cat) steps.push({ label: cat.values.join(', '), clear: [V('Sub-Category')] });
    if (sub) steps.push({ label: sub.values.join(', '), clear: [] });
    crumbs.replaceChildren(
      ...steps.flatMap((s, i) => {
        const last = i === steps.length - 1;
        const node = last ? el('span', { class: 'crumb crumb--current', 'aria-current': 'location', text: s.label }) : el('button', { type: 'button', class: 'crumb', text: s.label, onclick: () => s.clear.forEach((k) => setSelection(k, null)) });
        return i ? [el('span', { class: 'crumb-sep', 'aria-hidden': 'true', text: '›' }), node] : [node];
      }),
      el('span', { class: 'crumb-hint', text: drillLevel() < 2 ? `Click a bar to open its ${LEVELS[drillLevel() + 1].label.toLowerCase()}` : 'Click a bar to filter by product' }),
    );
  };

  const renderDrill = async () => {
    const level = drillLevel();
    state.level = level;
    const m = metric();
    drillCard.title.textContent = `${m.label} by ${LEVELS[level].label.toLowerCase()}`;
    renderCrumbs();
    try {
      await mountSpec({ id: 'drill', kind: 'drill', level, metric: m }, drillHost);
    } catch (error) {
      console.error('[build] drill', error);
      showObjectState(drillHost, 'failed', renderDrill);
    }
  };

  const renderTrend = async (id = 'trend', host = trendHost, c = trendCard) => {
    const m = metric();
    c.title.textContent = `${m.label} by month`;
    document.querySelectorAll('[aria-label="Show trend as"] button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.trendType)));
    try {
      await mountSpec({ id, kind: 'trend', type: state.trendType, metric: m }, host);
    } catch (error) {
      console.error(`[build] ${id}`, error);
      showObjectState(host, 'failed', () => renderTrend(id, host, c));
    }
  };

  // ---- KPIs
  /**
   * The mini chart under each KPI is a native line of the metric by month. The overview's cards
   * describe all items, so their charts read the ALL_ITEMS mirror group; the detail page's cards
   * describe the picked item and read the main group.
   */
  const mountSparks = (cards, prefix) =>
    Promise.all(cards.map(({ m, spark }) => mountSpec({ id: `${prefix}-spark-${m.id}`, kind: 'spark', metric: m, color: m.id === 'sales' ? INK.accent : INK.baseline }, spark, { group: prefix === 'kpi' ? ALL_ITEMS : GROUP })));
  const syncMirror = () => {
    const { applied } = selections.getSelection(ALL_ITEMS);
    const want = state.applied.filter((s) => !ITEM_KEYS.includes(keyOfSel(s)));
    const sig = (list) => JSON.stringify(list.map((s) => [keyOfSel(s), s.operator ?? 'inList', s.values]).sort());
    if (sig(applied) === sig(want)) return;
    for (const s of selections.getSelection(ALL_ITEMS).applied) selections.removeSelection(ALL_ITEMS, s);
    for (const s of want) selections.selectValues(ALL_ITEMS, { field: { fieldKey: keyOfSel(s) }, fieldKey: keyOfSel(s), kind: 'VALUE', operator: s.operator ?? 'inList', values: s.values }, { state: 'applied' });
  };
  /** The KPI cards' answers: the period, the comparison period and the period by month. */
  const kpiFigures = async (exclude) => {
    const cmp = compareRange();
    const calcs = METRICS.map(calc);
    const [cur] = await q({ calculations: calcs, filters: filtersFor({ exclude }), limit: 1 });
    const [prev] = cmp ? await q({ calculations: calcs, filters: filtersFor({ exclude, range: cmp }), limit: 1 }) : [null];
    const months = await q({ dimensions: [dim(DATE, 'Month', { dateLevel: 'month' })], calculations: calcs, filters: filtersFor({ exclude }), orders: [{ columnIdx: 0, direction: 'asc' }], limit: 60 });
    return { cur, prev, months, cmp };
  };
  /** The overview's cards leave the pick out; the detail page's cards follow it. */
  const KPI_EXCLUDE = { kpi: ITEM_KEYS, dkpi: [] };
  const kpiData = {};
  const refreshKpis = async (cards, key, exclude) => {
    cards.forEach((k) => k.node.classList.add('is-loading'));
    try {
      const { cur, prev, cmp } = (kpiData[key] = await kpiFigures(exclude));
      cards.forEach(({ m, node, value, change, spark }, i) => {
        const v = cur?.[i];
        value.textContent = typeof v === 'number' ? m.fmt(v) : '–';
        const ch = prev ? changeOf(m, v, prev[i]) : null;
        const cmpText = cmp ? `vs ${COMPARES[state.period.compare]}` : 'no comparison';
        change.className = `kpi-change ${ch ? (ch.value >= 0 ? 'is-up' : 'is-down') : ''}`;
        change.textContent = ch ? `${ch.value >= 0 ? '▲' : '▼'} ${ch.text} ${cmpText}` : cmp ? `– ${cmpText} (no data)` : cmpText;
        node.classList.toggle('is-empty', typeof v !== 'number');
      });
    } catch (error) {
      console.error('[kpi]', error);
      delete kpiData[key]; // never let the narrative read the previous selection's figures
      cards.forEach(({ value, change }) => {
        value.textContent = '–';
        change.textContent = 'Could not load';
      });
      toast('Headline figures could not be loaded.', 'error');
    } finally {
      cards.forEach((k) => k.node.classList.remove('is-loading'));
    }
  };

  // ---- master list
  let listRun = 0;
  const listRows = async () => (await q({ dimensions: [dim(itemField(), ITEM[state.listTab].label)], calculations: [calc(metric())], filters: filtersFor({ exclude: ITEM_KEYS }), orders: [{ columnIdx: 1, direction: 'desc' }], limit: 2500 })).filter((r) => r[0] !== null && r[0] !== '');
  const refreshList = async () => {
    const my = ++listRun;
    listSection.classList.add('is-loading');
    try {
      // The list leaves its own field out of its filters, or a pick would filter it to one item.
      const rows = await listRows();
      if (my !== listRun) return;
      state.list = rows;
      state.listError = null;
      renderList();
      // Select a default item on load and whenever the pick falls out of the list.
      if (state.list.length && !state.list.some((r) => r[0] === picked())) pick(state.list[0][0]);
    } catch (error) {
      console.error('[list]', error);
      state.listError = error;
      showObjectState(listUl, 'failed', refreshList, 'The list could not be loaded');
    } finally {
      if (my === listRun) listSection.classList.remove('is-loading');
    }
  };
  const visibleList = (list = state.list) => {
    const s = state.search.trim().toLowerCase();
    return s ? list.filter((r) => String(r[0]).toLowerCase().includes(s)) : list;
  };
  const renderList = () => {
    const rows = visibleList();
    const m = metric();
    const top = Math.max(...state.list.map((r) => Math.abs(r[1] ?? 0)), 1);
    const cur = picked();
    listCount.textContent = `${rows.length.toLocaleString('en-US')} ${ITEM[state.listTab].plural}${state.search ? ` matching “${state.search}”` : ''} · by ${m.label.toLowerCase()}`;
    if (!rows.length) {
      showObjectState(listUl, 'empty', null, state.search ? `No ${ITEM[state.listTab].plural} match “${state.search}”` : `No ${ITEM[state.listTab].plural} in this selection`);
      return;
    }
    // Render the first 300; the search reaches the rest.
    listUl.replaceChildren(
      ...rows.slice(0, 300).map(([name, v]) =>
        el('li', {}, el('button', { type: 'button', class: 'md-item', 'aria-current': String(name === cur), 'data-name': name, onclick: () => pick(name) }, [
          el('span', { class: 'md-item-name', text: name, title: name }),
          el('span', { class: 'md-item-value', text: typeof v === 'number' ? m.fmt(v) : '–' }),
          el('span', { class: `md-item-bar ${v < 0 ? 'is-neg' : ''}`, style: `width:${m.ratio ? Math.min(100, Math.abs(v) * 100 / 0.5) : (Math.abs(v ?? 0) / top) * 100}%` }),
        ])),
      ),
    );
  };
  const pick = (name) => setSelection(itemField(), [name]);
  const setListTab = (tab) => {
    if (tab === state.listTab) return;
    const old = itemField();
    state.listTab = tab;
    listTabs.forEach((t) => t.setAttribute('aria-selected', String(t.dataset.tab === tab)));
    searchIn.placeholder = `Search ${ITEM[tab].plural}`;
    searchIn.value = state.search = '';
    listUl.replaceChildren();
    setSelection(old, null);
    refreshing = refreshList();
    // The order lines show the other list's item as a column.
    renderRecords('records', recordsHost);
  };
  const stepItem = (dir) => {
    const rows = visibleList();
    const i = rows.findIndex((r) => r[0] === picked());
    const next = rows[i + dir];
    if (next) pick(next[0]);
  };

  // ---- records (order lines)
  const recordsQuery = (limit) => {
    const other = state.listTab === 'customers' ? ITEM.products : ITEM.customers;
    return {
      columns: ['Order date', 'Order ID', other.label, 'Ship mode', 'Sales', 'Profit'],
      query: { dimensions: [dim(DATE, 'Order date'), dim(V('Order ID'), 'Order ID'), dim(other.key, other.label), dim(V('Ship Mode'), 'Ship mode')], calculations: [calc(METRICS[0]), calc(METRICS[1])], filters: filtersFor(), orders: [{ columnIdx: 0, direction: 'desc' }, { columnIdx: 1, direction: 'asc' }], limit },
    };
  };
  /**
   * The order lines are a native table in the main group: it follows the period, the filters and
   * the pick by itself, so it is mounted once per page or list kind, never re-run by the app.
   */
  const recordsSpec = (id, host) => ({ id, kind: 'records', listTab: state.listTab, width: host.clientWidth });
  const renderRecords = async (id, host) => {
    host.fittedWidth = host.clientWidth;
    try {
      await mountSpec(recordsSpec(id, host), host);
    } catch (error) {
      console.error('[records]', error);
      showObjectState(host, 'failed', () => renderRecords(id, host));
    }
  };
  // Column widths are pixels: when a table's slot changes width, refit them in place (no remount).
  const refitTable = async (target) => {
    const id = target === recordsHost ? 'records' : 'dlines';
    if (!target.clientWidth || Math.abs(target.clientWidth - (target.fittedWidth ?? 0)) <= 2) return;
    if (mounted.get(id)?.render !== 'rendered') return;
    target.fittedWidth = target.clientWidth;
    const { vSpec } = await prepareChart(recordsSpec(id, target), availableFields);
    runtime.updateInstance(id, { vSpec });
  };
  const refit = new ResizeObserver((entries) => {
    for (const { target } of entries) {
      clearTimeout(target.refitTimer);
      target.refitTimer = setTimeout(() => refitTable(target), 250);
    }
  });
  const recordsSub = () => `Latest 200 order lines · ${periodName().toLowerCase()} · newest first`;

  // ---- narrative, computed from the answers
  const refreshNarrative = async () => {
    const d = kpiData.kpi;
    if (!d?.cur) return;
    const [sales, profit, orders, ratio] = d.cur;
    const cmp = d.prev;
    const growth = cmp && cmp[0] ? (sales - cmp[0]) / cmp[0] : null;
    const bits = [];
    bits.push(`${periodName()} (${rangeText(currentRange())}): <b class="accent">${METRICS[0].fmt(sales ?? 0)}</b> in sales from ${METRICS[2].fmt(orders ?? 0)} orders`);
    if (growth !== null) bits[0] += `, ${growth >= 0 ? 'up' : 'down'} ${pct(Math.abs(growth))} on the ${COMPARES[state.period.compare]}`;
    bits[0] += `, keeping ${pct(ratio ?? 0)} as profit (${METRICS[1].fmt(profit ?? 0)}).`;
    try {
      const [worst] = await q({ dimensions: [dim(V('Sub-Category'), 'Sub-Category')], calculations: [calc(METRICS[1])], filters: filtersFor({ exclude: ITEM_KEYS }), orders: [{ columnIdx: 1, direction: 'asc' }], limit: 1 });
      if (worst && worst[1] < 0) bits.push(`<b class="alert">${worst[0]}</b> lost ${METRICS[1].fmt(-worst[1])} in profit.`);
    } catch (error) {
      console.warn('[narrative]', error);
    }
    const top = state.list[0];
    if (top && sales && state.metric === 'sales') bits.push(`The top ${ITEM[state.listTab].noun}, ${top[0]}, brought ${pct(top[1] / sales)} of sales.`);
    narrative.innerHTML = bits.join(' ');
  };

  // ---- detail page
  const renderDetailPage = () => {
    const name = picked();
    const rows = visibleList();
    const i = rows.findIndex((r) => r[0] === name);
    itemKind.textContent = `${ITEM[state.listTab].label} · ${periodName()} · ${rangeText(currentRange())}`;
    itemName.textContent = name ?? `No ${ITEM[state.listTab].noun} selected`;
    itemPos.textContent = i >= 0 ? `${i + 1} of ${rows.length.toLocaleString('en-US')}` : '';
    prevBtn.disabled = i <= 0;
    nextBtn.disabled = i < 0 || i >= rows.length - 1;
    dLinesCard.sub.textContent = recordsSub();
    return refreshKpis(dkpis, 'dkpi', []);
  };

  // ---- chips
  const renderChips = () => {
    const shown = state.applied.filter((s) => ![DATE, itemField()].includes(keyOfSel(s)));
    appliedBox.hidden = shown.length === 0;
    filterCount.hidden = shown.length === 0;
    filterCount.textContent = String(shown.length);
    chips.replaceChildren(
      ...shown.map((s) => {
        const name = NAMES[keyOfSel(s)] ?? keyOfSel(s);
        const vals = s.values.length > 2 ? `${s.values.slice(0, 2).join(', ')} +${s.values.length - 2}` : s.values.join(', ');
        return el('li', { class: 'chip', title: `${name}: ${s.values.join(', ')}` }, [el('span', { class: 'chip-field', text: name }), el('span', { class: 'chip-values', text: vals }), el('button', { type: 'button', class: 'chip-x', 'aria-label': `Remove the ${name} filter`, text: '×', onclick: () => setSelection(keyOfSel(s), null) })]);
      }),
    );
    quick.querySelectorAll('.quick-btn').forEach((b) => b.setAttribute('aria-pressed', String(!!appliedOn(V('Ship Mode'))?.values.includes(b.dataset.value))));
    drawer.querySelectorAll('input[type=checkbox]').forEach((c) => (c.checked = !!appliedOn(c.dataset.key)?.values.includes(c.value)));
    const cmp = compareRange();
    periodLabel.textContent = periodName();
    periodSub.textContent = `${rangeText(currentRange())}${cmp ? ` · vs ${COMPARES[state.period.compare]}` : ''}`;
  };

  // ---- refresh orchestration
  let lastSig = '';
  const refreshAll = async () => {
    renderChips();
    const name = picked();
    detailName.textContent = name ?? `Pick a ${ITEM[state.listTab].noun}`;
    openDetailBtn.disabled = !name;
    railBtns[1].disabled = !name;
    trendCard.sub.textContent = `${name ?? 'All'} · ${periodName().toLowerCase()}${state.trendType === 'line' ? ' · dashed: 3-month average' : ''}`;
    drillCard.sub.textContent = `${name ?? 'All'} · ${periodName().toLowerCase()}`;
    dTrendCard.sub.textContent = trendCard.sub.textContent;
    if (drillLevel() !== state.level && state.page === 'overview') renderDrill();
    else renderCrumbs();
    recordsCard.sub.textContent = recordsSub();
    if (state.page === 'overview') {
      await refreshList();
      await refreshKpis(kpis, 'kpi', ITEM_KEYS);
      if (!window.__appState.timings['landing-ready']) appState.mark('landing-ready');
      await refreshNarrative();
    } else {
      await refreshList();
      await renderDetailPage();
    }
    if (!window.__appState.timings['landing-ready']) appState.mark('landing-ready');
  };
  /** Run refreshAll, remembering it so `idle()` can wait for it. */
  let refreshing = Promise.resolve();
  const refresh = () => (refreshing = refreshAll().catch((error) => console.error('[refresh]', error)));
  /** Wait until the page is settled: refresh done, every object mounted, queries quiet, no loaders. */
  const idle = async (timeoutMs = 45000) => {
    const start = performance.now();
    await new Promise((r) => setTimeout(r, 300)); // let a just-written selection reach the subscription
    while (performance.now() - start < timeoutMs) {
      await Promise.all([recordsHost, dLinesHost].map(refitTable));
      await refreshing;
      await Promise.all([...mounted.values()].map((r) => r.done));
      await appState.quiet({ quietMs: 600, paintMs: 300 });
      if (!document.querySelector('.is-loading') && !pendingRefresh) break;
    }
    await new Promise((r) => setTimeout(r, 900)); // repaint
  };

  let timer;
  let pendingRefresh = false;
  selections.onActiveSelectionChange(GROUP).subscribe(({ applied, pending }) => {
    // A click on the trend selects a date and would replace the period; drop it.
    for (const s of pending) if (keyOfSel(s) === DATE && s.operator !== 'between') setTimeout(() => selections.removeSelection(GROUP, s), 0);
    if (pending.some((s) => keyOfSel(s) !== DATE)) setTimeout(() => selections.applyPendingSelections(GROUP), 250);
    state.applied = applied;
    const sig = JSON.stringify(applied.map((s) => [keyOfSel(s), s.values]));
    if (sig === lastSig) return;
    lastSig = sig;
    syncMirror();
    clearTimeout(timer);
    pendingRefresh = true;
    timer = setTimeout(() => {
      pendingRefresh = false;
      refresh();
    }, 120);
  });

  const setMetric = (id) => {
    state.metric = id;
    metricSwitch.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.metric === id)));
    if (state.page === 'overview') {
      state.level = -1;
      renderDrill();
      renderTrend();
      refreshing = refreshList().then(refreshNarrative);
    } else renderTrend('dtrend', dTrendHost, dTrendCard);
  };
  const setTrendType = (type) => {
    state.trendType = type;
    if (state.page === 'overview') {
      renderTrend();
      refresh();
    }
    else renderTrend('dtrend', dTrendHost, dTrendCard);
  };
  const releaseAll = () => [...mounted.values()].forEach((r) => r.release());
  const showPage = (page) => {
    if (page === 'detail' && !picked()) return;
    state.page = page;
    railBtns.forEach((b) => b.setAttribute('aria-current', String(b.dataset.page === page)));
    overview.hidden = page !== 'overview';
    detailPage.hidden = page !== 'detail';
    releaseAll();
    state.level = -1;
    if (page === 'overview') {
      renderDrill();
      renderTrend();
      renderRecords('records', recordsHost);
      mountSparks(kpis, 'kpi');
    } else {
      renderTrend('dtrend', dTrendHost, dTrendCard);
      renderRecords('dlines', dLinesHost);
      mountSparks(dkpis, 'dkpi');
    }
    refresh();
  };

  // ---- object registry: every object can show and export its data
  // Every table() re-runs its object's query with the selections applied now (the session cache
  // answers it when the figures are already on screen), so an export never carries cached rows
  // from an earlier selection. `scope` names the period and the filters those rows follow.
  const kpiTable = async (key, label) => {
    const exclude = KPI_EXCLUDE[key];
    const d = await kpiFigures(exclude);
    return {
      title: `${label} — headline figures`,
      scope: scopeFor({ exclude }),
      columns: ['Measure', `${periodName()} (${rangeText(currentRange())})`, d.cmp ? `Comparison (${rangeText(d.cmp)})` : 'Comparison'],
      rows: METRICS.map((m, i) => [m.label, d.cur?.[i] ?? null, d.prev?.[i] ?? null]),
    };
  };
  const monthsTable = async (key, title) => {
    const exclude = KPI_EXCLUDE[key];
    const { months } = await kpiFigures(exclude);
    return { title, scope: scopeFor({ exclude }), columns: ['Month', ...METRICS.map((m) => m.label)], rows: months.map((r) => [monthLabel(r[0]), ...r.slice(1)]) };
  };
  for (const [prefix, label] of [['kpi', 'All items'], ['dkpi', 'Selected item']]) {
    for (const [i, m] of METRICS.entries()) {
      register(`${prefix}-${m.id}`, { title: `${m.label} (${label})`, table: () => monthsTable(prefix, `${m.label} by month (${label})`), copy: () => (prefix === 'kpi' ? kpis : dkpis)[i].value.textContent });
    }
  }
  register('narrative', { title: 'Narrative', copy: () => narrative.textContent, table: () => kpiTable('kpi', 'All items') });
  register('list', {
    title: 'List',
    table: async () => ({
      title: `${ITEM[state.listTab].label}s by ${metric().label.toLowerCase()}`,
      scope: `${scopeFor({ exclude: ITEM_KEYS })}${state.search ? ` · search: “${state.search}”` : ''}`,
      columns: [ITEM[state.listTab].label, metric().label],
      rows: visibleList(await listRows()),
    }),
  });
  register('drill', {
    title: 'Drill-down',
    table: async () => {
      const lv = LEVELS[drillLevel()];
      const rows = await q({ dimensions: [dim(lv.field, lv.label)], calculations: [calc(metric())], filters: filtersFor(), orders: [{ columnIdx: 1, direction: 'desc' }], limit: 500 });
      return { title: `${metric().label} by ${lv.label.toLowerCase()}`, scope: scopeFor(), columns: [lv.label, metric().label], rows };
    },
  });
  const trendTable = async () => {
    const rows = await q({ dimensions: [dim(DATE, 'Month', { dateLevel: 'month' })], calculations: [calc(metric())], filters: filtersFor(), orders: [{ columnIdx: 0, direction: 'asc' }], limit: 60 });
    return { title: `${metric().label} by month — ${picked() ?? 'all'}`, scope: scopeFor(), columns: ['Month', metric().label], rows: rows.map((r) => [monthLabel(r[0]), r[1]]) };
  };
  register('trend', { title: 'Trend', table: trendTable });
  register('dtrend', { title: 'Trend', table: trendTable });
  const LINES_MAX = 5000;
  const linesTable = async () => {
    // Ask for one row more than the cap, so a cut is reported instead of passing silently.
    const { columns, query } = recordsQuery(LINES_MAX + 1);
    const rows = await q(query);
    const truncated = rows.length > LINES_MAX;
    const note = truncated ? ` · first ${LINES_MAX.toLocaleString('en-US')} rows only, newest first; narrow the period or filters for the rest` : '';
    return { title: `Order lines — ${picked() ?? 'all'}`, scope: `${scopeFor()} · one row per order, ${columns[2].toLowerCase()} and ship mode${note}`, columns, rows: rows.slice(0, LINES_MAX).map((r) => [iso(r[0]), ...r.slice(1)]), truncated };
  };
  register('records', { title: 'Order lines', table: linesTable });
  register('dlines', { title: 'Order lines', table: linesTable });

  /** Wait for a selection change still on its way (the 120 ms debounce, then the refresh it runs). */
  const settled = async () => {
    for (let i = 0; i < 50; i++) {
      while (pendingRefresh) await new Promise((r) => setTimeout(r, 50));
      const run = refreshing;
      await run;
      if (!pendingRefresh && run === refreshing) return;
    }
  };
  /** One object's table under the selections applied now. */
  const tableOf = async (id) => {
    await settled();
    return objects.get(id).table();
  };
  /** The Excel workbook of one or more objects as a Blob: one sheet each, named after the object
   *  (a single object's sheet is "Data", as its menu's download writes it). */
  const buildWorkbook = async (ids) => {
    const tables = [];
    for (const id of ids) tables.push(await tableOf(id)); // in turn, so repeated queries hit the session cache
    return toXlsx(tables.map((t, i) => ({ ...t, sheet: ids.length === 1 ? 'Data' : ids[i] })));
  };

  const doExport = async (kind, data) => {
    try {
      const size = kind === 'csv' ? exportCsv(data) : downloadXlsx(toXlsx({ ...data, sheet: 'Data' }), data.title);
      state.lastExport = { kind, title: data.title, rows: data.rows.length, size };
      toast(`Exported ${data.rows.length.toLocaleString('en-US')} rows as ${kind === 'csv' ? 'CSV' : 'Excel'}${data.truncated ? ` (the first ${data.rows.length.toLocaleString('en-US')} only)` : ''}.`);
    } catch (error) {
      console.error('[export]', error);
      toast('The export failed.', 'error');
    }
  };
  const withTable = async (id, fn) => {
    try {
      const data = await tableOf(id);
      await fn(data);
    } catch (error) {
      console.error('[menu]', error);
      toast('The data could not be loaded.', 'error');
    }
  };
  const showTable = (data) => {
    dialogData = data;
    dialogTitle.textContent = data.title;
    dialogTable.replaceChildren(...[
      data.scope ? el('p', { class: 'card-sub', text: data.scope }) : null,
      el('table', { class: 'grid' }, [
        el('thead', {}, el('tr', {}, data.columns.map((h) => el('th', { scope: 'col', text: h })))),
        el('tbody', {}, data.rows.slice(0, 500).map((r) => el('tr', {}, r.map((v) => el('td', { role: 'gridcell', class: typeof v === 'number' ? 'num' : '', text: typeof v === 'number' ? v.toLocaleString('en-US', { maximumFractionDigits: 2 }) : (v ?? '') }))))),
      ]),
      data.rows.length > 500 ? el('p', { class: 'card-sub', text: `First 500 of ${data.rows.length} rows; the exports carry all of them.` }) : null,
    ].filter(Boolean));
    dialog.showModal();
  };
  const copyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      state.lastCopy = text;
      toast(`Copied “${text.length > 40 ? `${text.slice(0, 40)}…` : text}”.`);
    } catch {
      toast('Copy was blocked by the browser.', 'error');
    }
  };

  const openMenu = (event, id, cellText) => {
    event.preventDefault();
    event.stopPropagation();
    const spec = objects.get(id);
    if (!spec) return;
    const copyValue = cellText ?? spec.copy?.();
    const items = [
      copyValue ? { label: cellText ? 'Copy cell value' : 'Copy value', run: () => copyText(copyValue) } : null,
      { label: 'Show as table', run: () => withTable(id, showTable) },
      { label: 'Export data as CSV', run: () => withTable(id, (d) => doExport('csv', d)) },
      { label: 'Export data as Excel', run: () => withTable(id, (d) => doExport('xlsx', d)) },
    ].filter(Boolean);
    menu.replaceChildren(...items.map((it) => el('button', { type: 'button', role: 'menuitem', text: it.label, onclick: () => { closeMenu(); it.run(); } })));
    menu.hidden = false;
    const r = menu.getBoundingClientRect();
    menu.style.left = `${Math.min(event.clientX || event.target.getBoundingClientRect().left, innerWidth - r.width - 8)}px`;
    menu.style.top = `${Math.min(event.clientY || event.target.getBoundingClientRect().bottom, innerHeight - r.height - 8)}px`;
    menu.querySelector('button')?.focus();
  };
  const closeMenu = () => (menu.hidden = true);
  document.addEventListener('click', (e) => { if (!menu.contains(e.target)) closeMenu(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMenu(); });
  document.addEventListener('contextmenu', (event) => {
    if (!(event.target instanceof Element)) return;
    const host = event.target.closest('[data-object-id]');
    if (!host) return;
    const cell = event.target.closest('[role="gridcell"]');
    const item = event.target.closest('.md-item');
    openMenu(event, host.dataset.objectId, cell?.textContent || item?.dataset.name || undefined);
  });

  window.__astrato = { ctx, objectAnswers, mounted, state, selections, group: GROUP, objects, setMetric, setTrendType, showPage, setListTab, pick, stepItem, doExport, openMenu, kpiData };

  // ---- checks the smoke test runs (kit/verify/smoke.mjs); none of them writes anything
  /** The latest rows an Astrato object received whose query reads all of `keys`, and how many measures. */
  const answer = (keys, calcs, exact = true) => {
    let found = null;
    for (const [shape, a] of objectAnswers) {
      const [dims, measures] = shape.split('|').map((part) => part.split(',').filter(Boolean));
      const dimsMatch = exact ? dims.length === keys.length && keys.every((k) => dims.includes(k)) : keys.every((k) => dims.includes(k));
      if (dimsMatch && (calcs === undefined || measures.length === calcs)) found = a;
    }
    return found;
  };
  const figures = () => {
    const overviewPage = state.page === 'overview';
    return {
      kpi: (overviewPage ? kpis : dkpis)[0].value.textContent,
      chart: overviewPage ? answer([LEVELS[drillLevel()].field])?.rows : answer([DATE], state.trendType === 'line' ? 2 : 1)?.rows,
      trend: answer([DATE], state.trendType === 'line' ? 2 : 1),
      table: answer([V('Order ID')], undefined, false)?.rows,
    };
  };
  const moved = (a, b) => a.kpi !== b.kpi && a.chart !== b.chart && a.table !== b.table;
  const same = (a, b) => a.kpi === b.kpi && a.chart === b.chart && a.table === b.table;
  const registerChecks = () => {
    appState.check('Overview: Region = West from the filter drawer changes the Sales KPI, the drill bar and the order lines; Clear all restores them', async () => {
      if (state.page !== 'overview') showPage('overview');
      await idle();
      const before = figures();
      const was = picked();
      drawer.querySelector(`input[data-key="${V('Region')}"][value="West"]`).click();
      await idle();
      const during = figures();
      clearAllBtn.click();
      await idle();
      // West may drop the picked customer from the list, which picks the new top one; pick back.
      if (picked() !== was) {
        pick(was);
        await idle();
      }
      const after = figures();
      return { pass: moved(before, during) && same(before, after), detail: `Sales ${before.kpi} → ${during.kpi} → ${after.kpi}; drill ${before.chart !== during.chart ? 'moved' : 'did not move'}, restored ${before.chart === after.chart}; order lines ${before.table !== during.table ? 'moved' : 'did not move'}, restored ${before.table === after.table}` };
    });
    appState.check('Overview: a drill-bar click (a pending Category selection, as the chart writes it) drills to sub-categories and moves the KPI, the trend and the order lines; the breadcrumb restores them', async () => {
      if (state.page !== 'overview') showPage('overview');
      await idle();
      const before = { ...figures(), trend: figures().trend?.rows };
      const key = V('Category');
      selections.selectValues(GROUP, { field: { fieldKey: key }, fieldKey: key, kind: 'VALUE', operator: 'inList', values: ['Technology'] }, { state: 'pending' });
      await idle();
      const during = { ...figures(), trend: figures().trend?.rows };
      const level = drillLevel();
      crumbs.querySelector('button.crumb')?.click();
      await idle();
      const after = { ...figures(), trend: figures().trend?.rows };
      const pass = level === 1 && before.kpi !== during.kpi && before.trend !== during.trend && before.table !== during.table && before.kpi === after.kpi && before.trend === after.trend && before.table === after.table;
      return { pass, detail: `level 0 → ${level} → ${drillLevel()}; Sales ${before.kpi} → ${during.kpi} → ${after.kpi}; trend moved ${before.trend !== during.trend}; order lines moved ${before.table !== during.table}` };
    });
    appState.check('Overview: choosing Quarter to date sends the new date range to the trend chart and the order lines and moves the KPI; Last 12 months restores them', async () => {
      if (state.page !== 'overview') showPage('overview');
      await idle();
      const before = figures();
      const was = picked();
      const ytdStart = iso(PRESETS.qtd.start(parts(maxDate)));
      periodMenu.querySelector('input[name="period"][value="qtd"]').click();
      await idle();
      const during = figures();
      const reached = JSON.stringify(during.trend?.filters ?? []).includes(ytdStart);
      periodMenu.querySelector('input[name="period"][value="l12m"]').click();
      await idle();
      // A customer with no orders this quarter drops out of the list, which picks the new top one; pick back.
      if (picked() !== was) {
        pick(was);
        await idle();
      }
      const after = figures();
      return { pass: reached && before.kpi !== during.kpi && before.table !== during.table && same(before, after), detail: `trend query carries ${ytdStart}: ${reached}; Sales ${before.kpi} → ${during.kpi} → ${after.kpi}; order lines moved ${before.table !== during.table}; restored: drill ${before.chart === after.chart}, order lines ${before.table === after.table}` };
    });
    appState.check('Detail: Next › picks the next customer and moves the item KPIs, its trend and its order lines; ‹ Previous restores them', async () => {
      if (state.page !== 'detail') showPage('detail');
      await idle();
      const before = figures();
      const first = picked();
      nextBtn.click();
      await idle();
      const during = figures();
      const second = picked();
      prevBtn.click();
      await idle();
      const after = figures();
      showPage('overview');
      await idle();
      return { pass: first !== second && moved(before, during) && same(before, after), detail: `${first} → ${second} → ${picked()}; Sales ${before.kpi} → ${during.kpi} → ${after.kpi}; trend moved ${before.chart !== during.chart}; order lines moved ${before.table !== during.table}` };
    });
    appState.check('Order lines: the object menu exports the lines as an Excel workbook', async () => {
      if (state.page !== 'overview') showPage('overview');
      await idle();
      state.lastExport = null;
      recordsCard.node.querySelector('.menu-btn').click();
      [...menu.querySelectorAll('button')].find((b) => b.textContent === 'Export data as Excel').click();
      const start = performance.now();
      while (!state.lastExport && performance.now() - start < 30000) await new Promise((r) => setTimeout(r, 200));
      const e = state.lastExport;
      return { pass: e?.kind === 'xlsx' && e.rows > 0 && e.size > 0, detail: e ? `${e.title}: ${e.rows} rows, ${e.size} bytes` : 'no export' };
    });
    // Every object's Excel export, one sheet per object (detail page's included, though that page
    // is hidden), without and with Region = West from the drawer: every sheet must move.
    let probePick = null;
    appState.exportProbe({
      build: () => buildWorkbook([...objects.keys()]),
      select: async () => {
        if (state.page !== 'overview') showPage('overview');
        await idle();
        probePick = picked();
        drawer.querySelector(`input[data-key="${V('Region')}"][value="West"]`).click();
        await idle();
      },
      clear: async () => {
        clearAllBtn.click();
        await idle();
        // West may drop the picked customer, which picks the new top one; pick back.
        if (probePick && picked() !== probePick) {
          pick(probePick);
          await idle();
        }
      },
      exempt: [],
    });
  };

  // ---- start: controls first, then the default period, then the objects
  railBtns[0].setAttribute('aria-current', 'true');
  appState.tab('overview', async () => {
    if (state.page !== 'overview') showPage('overview');
    await idle();
  });
  appState.tab('detail', async () => {
    if (state.page !== 'detail') showPage('detail');
    await idle();
  });
  registerChecks();
  refit.observe(recordsHost);
  refit.observe(dLinesHost);
  applyPeriod();
  renderTrend();
  renderRecords('records', recordsHost);
  mountSparks(kpis, 'kpi');
};

main().catch((error) => {
  console.error(error);
  appState.bootFailed(error);
  root.replaceChildren(
    el('main', { class: 'page-state', role: 'alert' }, [
      el('h2', { text: 'Superstore explorer could not start' }),
      el('p', { text: String(error?.message ?? error) }),
      el('p', { text: 'Open this page at the origin printed by astrato dev, or from Astrato hosting. If it persists, the data source may be unavailable.' }),
      el('button', { type: 'button', class: 'btn', text: 'Try again', onclick: () => location.reload() }),
    ]),
  );
});
