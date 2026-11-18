/**
 * The contract between an Astrato App and the smoke test (smoke.mjs).
 *
 * Copy this file into your app, import it once, and call the three functions where your app
 * declares tabs, mounts objects and sends queries. The smoke test reads `window.__appState`;
 * nothing here talks to Astrato, so it is safe in production builds.
 *
 *   import { appState } from './app-state.js';
 *
 *   appState.tab('overview', () => showTab('overview'));       // once per tab, in order
 *   appState.declare('kpi-revenue', 'overview');                // once per object, before mounting
 *   runtime.mount(slot, id)
 *     .then((handle) => handle.ready)
 *     .then((r) => appState.settle('kpi-revenue', r?.status, r))   // 'rendered' | anything else
 *     .catch((e) => appState.settle('kpi-revenue', 'error', e));
 *   appState.query(request, ms, fromCache);                     // from your engine.getData wrapper
 *   appState.mark('landing-ready');                             // named timings, ms since load
 *   appState.check('Region selection moves the KPI', async () => { ...; return { pass, detail }; });
 */
const state = (window.__appState ??= {
  version: 1,
  startedAt: performance.now(),
  tabs: [],          // [{ id, show }]
  objects: {},       // id -> { id, tab, status: 'pending' | 'rendered' | <other>, error }
  queries: [],       // [{ at, ms, cached, key }]
  timings: {},       // name -> ms since load
  checks: [],        // [{ name, run }] app-specific assertions the smoke test runs last
  bootError: null,
});

const settledAll = () => Object.values(state.objects).every((o) => o.status !== 'pending');

export const appState = {
  /** Register a tab and the function that brings it on screen (may return a promise). */
  tab(id, show) { state.tabs.push({ id, show }); },

  /** Announce an object before it mounts, so a mount that never happens is caught. Pass `null` as the tab for objects on every tab. */
  declare(id, tab) { state.objects[id] = { id, tab, status: 'pending', error: null }; },

  /** Record how a mount ended. Anything but 'rendered' fails the smoke test. */
  settle(id, status, detail) {
    const o = (state.objects[id] ??= { id, tab: null });
    o.status = status ?? 'unknown';
    o.error = status === 'rendered' ? null : String(detail?.message ?? detail?.error ?? JSON.stringify(detail ?? '')).slice(0, 300);
    if (settledAll() && !state.timings['all-settled']) appState.mark('all-settled');
  },

  /** Log one engine request. `key` should identify the query shape, never carry data. */
  query(request, ms, cached = false) {
    state.queries.push({ at: Math.round(performance.now() - state.startedAt), ms: Math.round(ms), cached, key: typeof request === 'string' ? request : JSON.stringify(request).length });
  },

  mark(name) { state.timings[name] = Math.round(performance.now() - state.startedAt); },

  /** An assertion only this app can make (a selection moves a KPI, an export downloads). */
  check(name, run) { state.checks.push({ name, run }); },

  /** Call from your boot catch block so a failed start is reported, not timed out. */
  bootFailed(error) { state.bootError = String(error?.message ?? error).slice(0, 300); },

  /** Wait until no query has been logged for quietMs, then give the page paintMs to repaint
   *  (tables repaint after the data arrives). Use it inside checks before reading figures.
   *  Needs appState.query to be called from your engine wrapper. */
  async quiet({ quietMs = 800, paintMs = 1500, timeoutMs = 20000 } = {}) {
    const start = performance.now();
    let seen = state.queries.length;
    let since = performance.now();
    while (performance.now() - start < timeoutMs) {
      await new Promise((r) => setTimeout(r, 100));
      if (state.queries.length !== seen) { seen = state.queries.length; since = performance.now(); }
      else if (performance.now() - since >= quietMs) break;
    }
    await new Promise((r) => setTimeout(r, paintMs));
  },

  /** Hand over the real field catalogue (the list you pass to compileVisualizationDefinition).
   *  The smoke test saves it as available-fields.json, so the offline compile check can use the
   *  real thing instead of a hand-made stand-in. */
  fields(availableFields) {
    try { state.fields = JSON.parse(JSON.stringify(availableFields)); } catch { state.fields = null; }
  },
};
