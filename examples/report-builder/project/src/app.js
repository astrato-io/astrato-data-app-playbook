/**
 * Report builder: an Astrato App over any semantic layer.
 *
 * Boot reads the field catalogue, wraps the engine (operators on selections, a 4-lane queue, a
 * cache, appState logging), and hands the builder a small ctx: a governed query `q`, and
 * `renderTile` / `dropTile` to mount and release the one native object a report shows.
 * The hosting boundary supplies the semantic layer; nothing here names a field.
 */
import { createAstratoApp } from '@astrato-io/app-runtime';
import { createVisualizationRuntime, registry } from '@astrato-io/visualizations';
import { createVisualizationAvailableFields } from '@astrato-io/visualizations/definitions';
import { applyRuntimeOperations } from '@astrato-io/visualizations/operations';
import { appState } from './app-state.js';
import { buildCatalogue } from './catalogue.js';
import { STARTERS, fromStarter, prepareReport, widthOps } from './report.js';
import { mountBuilder } from './builder.js';
import { registerChecks } from './checks.js';

const GROUP = 'report';
const root = document.getElementById('root');

export const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) if (c != null) node.append(c);
  return node;
};

const main = async () => {
  const [, app] = await Promise.all([document.fonts.load('400 13px Roboto').catch(() => {}), createAstratoApp()]);
  const engine = app.client.hostServices.engine;
  const selections = app.client.hostServices.selections;
  const dataBinding = { ...app.dataBinding };
  const metadata = await engine.fields.getFieldMetadata(dataBinding);
  const availableFields = createVisualizationAvailableFields(metadata ?? {}).filter((f) => f?.resultType !== 'unhandled');
  appState.fields(availableFields);
  const cat = buildCatalogue(availableFields);
  if (!cat.rows.length || !cat.figures.length) throw new Error('This semantic layer has no fields to report on.');
  const runtime = createVisualizationRuntime({ client: app.client, registry });

  /*
   * Every query, the object's and the app's, goes through here: at most four at a time, one retry,
   * identical requests answered from a cache. A selection without an operator reaches the engine
   * as a filter it refuses (HTTP 400); such a filter is sent as inList. The object's answers are
   * kept by shape so the checks can tell that its rows changed.
   */
  const raw = engine.getData.bind(engine);
  const cache = new Map();
  const answers = new Map();
  const own = new WeakSet();
  const shapeOf = (q) => [...(q?.dimensions ?? []).map((d) => d.fieldKey ?? d.itemKey ?? d.field?.fieldKey), '|', ...(q?.calculations ?? []).map((c) => c.itemKey ?? c.label)].join(',');
  const withOperators = (r) => {
    const f = r?.query?.filters;
    if (!Array.isArray(f) || f.every((x) => x.operator)) return r;
    return { ...r, query: { ...r.query, filters: f.map((x) => (x.operator ? x : { ...x, operator: 'inList' })) } };
  };
  let running = 0;
  const waiting = [];
  const slot = () => (running < 4 ? (running++, Promise.resolve()) : new Promise((r) => waiting.push(r)));
  const release = () => { const next = waiting.shift(); if (next) next(); else running--; };
  engine.getData = (original, ...rest) => {
    const request = withOperators(original);
    const key = JSON.stringify(request);
    const note = (response) => {
      if (!own.has(original)) {
        const data = response?.response?.data ?? {};
        answers.set(shapeOf(request.query), { at: performance.now(), filters: request.query?.filters ?? [], rows: JSON.stringify(Object.keys(data).sort((a, b) => a - b).map((k) => data[k])) });
      }
      return response;
    };
    if (cache.has(key)) { appState.query(shapeOf(request.query), 0, true); return Promise.resolve(note(structuredClone(cache.get(key)))); }
    const attempt = () => raw(request, ...rest);
    const t0 = performance.now();
    return slot()
      .then(() => attempt().catch(() => new Promise((r) => setTimeout(r, 400)).then(attempt)))
      .finally(release)
      .then((response) => { appState.query(shapeOf(request.query), performance.now() - t0, false); cache.set(key, structuredClone(response)); return note(response); });
  };
  const q = async (query) => {
    const request = { ...dataBinding, query: { dimensions: [], calculations: [], orders: [], limit: 100, offset: 0, filters: [], totals: false, showRecordsCount: false, outerViews: [], associativeListFilter: null, ...query } };
    own.add(request);
    const { response } = await engine.getData(request);
    const data = response?.data ?? {};
    return Object.keys(data).sort((a, b) => a - b).map((k) => data[k]);
  };

  // ------------------------------------------------------------------ the one native object
  let n = 0;
  const live = new Map(); // id -> { handle, slot, spec, refs, observer }
  const renderTile = async (spec, host) => {
    const id = `report-${++n}`;
    appState.declare(id, 'builder');
    const { vSpec, refs, failed } = await prepareReport(spec, availableFields, { id, width: host.clientWidth || 900 });
    if (failed.length) console.warn(`[report] ${id} refused`, failed);
    runtime.createInstance({ id, type: spec.view, groupId: GROUP, vSpec, dataBinding });
    const record = { spec, refs, slot: host, width: host.clientWidth };
    live.set(id, record);
    // Table widths are pixels: refit them in place when the slot changes width (no remount).
    if (spec.view === 'table') {
      record.observer = new ResizeObserver(() => {
        clearTimeout(record.timer);
        record.timer = setTimeout(() => {
          const w = host.clientWidth;
          if (!live.has(id) || !w || Math.abs(w - record.width) < 8) return;
          record.width = w;
          applyRuntimeOperations({ runtime, instanceId: id, availableFields, operationRequests: widthOps(spec, refs, w) }).catch((e) => console.warn('[refit]', e));
        }, 200);
      });
      record.observer.observe(host);
    }
    try {
      record.handle = await runtime.mount(host, id);
      const ready = await record.handle.ready;
      if (live.has(id)) appState.settle(id, ready?.status, ready);
    } catch (e) {
      if (live.has(id)) appState.settle(id, 'error', e);
      throw e;
    }
    return id;
  };
  const dropTile = (id) => {
    const r = live.get(id);
    live.delete(id);
    r?.observer?.disconnect();
    try { r?.handle?.unmount(); } catch { /* already gone */ }
    try { runtime.removeInstance(id); } catch { /* never created */ }
    // Released before it rendered: it is no longer expected to.
    if (window.__appState?.objects?.[id]?.status === 'pending') delete window.__appState.objects[id];
  };

  const toasts = el('div', { class: 'toasts', role: 'status', 'aria-live': 'polite' });
  document.body.append(toasts);
  const toast = (text) => { const t = el('div', { class: 'toast', text }); toasts.append(t); setTimeout(() => t.remove(), 3500); };

  const layerKey = dataBinding.semanticLayerId ?? dataBinding.semanticLayer?.id ?? 'layer';
  const ctx = { el, cat, q, toast, renderTile, dropTile, getData: (id) => runtime.getData(id, { limit: 10000 }), selections, group: GROUP, layerKey };
  const builder = await mountBuilder(ctx, root);
  appState.mark('landing-ready');
  // The smoke test screenshots each "tab": here, the starter reports, one per view.
  STARTERS.forEach((t, i) => { const st = fromStarter(t, cat); if (st) appState.tab(`starter-${i + 1}-${st.view}`, () => builder.load(st)); });
  registerChecks({ builder, cat, answers, shapeOf, live, selections, group: GROUP, q });
  window.__report = { builder, cat, answers, live };
};

main().catch((error) => {
  console.error(error);
  appState.bootFailed(error);
  root.replaceChildren(el('main', { class: 'page-state', role: 'alert' }, [
    el('h2', { text: 'The report builder could not start' }),
    el('p', { text: String(error?.message ?? error) }),
    el('p', { text: 'Open this page at the address printed by astrato dev, or from Astrato hosting.' }),
    el('button', { class: 'btn', text: 'Try again', onclick: () => location.reload() }),
  ]));
});
