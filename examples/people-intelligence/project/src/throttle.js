/**
 * Query lane with rate-limit recovery, a session cache and a query log.
 *
 * - Lanes: a page load or a selection fires many queries at once and Astrato answers bursts with
 *   HTTP 429; charts never retry, so every query waits for one of a few lanes and a 429 is
 *   retried with backoff instead of being handed to the chart.
 * - Cache: the timetable is static, so an answer is kept for the session, keyed by the exact
 *   request. A repeated selection (or one prefetched, see prefetch.js) is answered at once.
 *   A table that gets zero rows re-asks the same query straight away, forever; a repeat of the
 *   same request within LOOP_MS is delayed so that loop cannot spin.
 * - Log: window.__qlog records every request (cache hit or not, and how long it took).
 */
import { appState } from './app-state.js';

const LANES = 6;
const RETRIES = 6;
const LOOP_MS = 2000;
const LOOP_REPEATS = 3;

/*
 * Member-name hook: when stored member names should not be shown as they are, list
 * [stored, shown] pairs; every answer is renamed on the way out and every request (filters,
 * selections) on the way in, so the app only ever shows and sends the shown names.
 */
const RENAMES = []; // [warehouse spelling, display name] pairs, for a dataset whose member names should not be shown as stored
const rename = (pairs) => {
  const text = (s) => { let out = s; for (const [a, b] of pairs) if (out.includes(a)) out = out.split(a).join(b); return out; };
  const walk = (v) => {
    if (typeof v === 'string') return text(v);
    if (Array.isArray(v)) { let changed = false; const next = v.map((x) => { const y = walk(x); if (y !== x) changed = true; return y; }); return changed ? next : v; }
    if (v && typeof v === 'object' && (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null)) {
      let next = null;
      for (const k of Object.keys(v)) { const y = walk(v[k]); if (y !== v[k]) (next ??= { ...v })[k] = y; }
      return next ?? v;
    }
    return v;
  };
  return walk;
};
export const toNeutral = rename(RENAMES);
export const toSource = rename(RENAMES.map(([a, b]) => [b, a]));

let active = 0;
const waiting = [];
const acquire = () => new Promise((resolve) => {
  if (active < LANES) { active += 1; resolve(); } else waiting.push(resolve);
});
const release = () => {
  const next = waiting.shift();
  if (next) next(); else active -= 1;
};
const isRateLimited = (error) => error?.status === 429 || error?.response?.status === 429 || /rate limit/i.test(String(error?.message ?? ''));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const queryLog = () => (window.__qlog ??= []);

/** Every wrapped service shares one cache, so prefetch.js can warm it. */
const cache = new Map();
export const cacheHas = (request) => { try { return cache.has(JSON.stringify(request)); } catch { return false; } };

/** The most recent real (non-prefetch) requests: what the screen is showing now. */
/** The latest real request per query shape (its dimension list): one per chart on screen. */
export const debugShapes = () => [...latestByShape.values()].map((r) => r.sig);
export const dimsSignature = (request) => (request?.query?.dimensions ?? []).map((d) => d.fieldKey ?? d.key ?? '').join('|');
const latestByShape = new Map();
const remember = (method, request) => {
  if (!request?.query) return;
  // One entry per chart query: dimensions + measures + order, ignoring the filters (the state).
  const { filters, ...shape } = request.query;
  void filters;
  const id = JSON.stringify(shape);
  latestByShape.delete(id);
  latestByShape.set(id, { method, request, at: Date.now(), sig: dimsSignature(request) });
  if (latestByShape.size > 200) latestByShape.delete(latestByShape.keys().next().value);
};
let lastReal = 0;

/** The latest answer per query shape (dimension signature), as a short hash: lets a check see a chart's data change. */
const answers = new Map();
const hashOf = (value) => { let str; try { str = JSON.stringify(value?.response?.data ?? value); } catch { return '?'; } let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return `${(h >>> 0).toString(36)}:${str.length}`; };
export const answerFor = (signature) => answers.get(signature) ?? null;
const keep = (request, value) => { answers.set(dimsSignature(request), hashOf(value)); return value; };
const services = {};

/**
 * Prefetch: when nothing real is in flight, re-run the screen's recent queries with one more
 * filter value added, for each value a filter control or chart click could pick, so the click is
 * answered from the cache. Two at a time, and it yields as soon as a real query starts.
 *   candidates: [{ fieldKey, values }]
 */
let prefetchRun = 0;
export const prefetchSelections = async (candidates, { maxQueries = 400, shapes = null } = {}) => {
  const run = ++prefetchRun;
  await sleep(500);
  // Only the queries of the charts on screen (by dimension signature), most recent request each.
  const base = [...latestByShape.values()].filter((r) => !shapes || shapes.has(r.sig));
  const jobs = [];
  const seen = new Set();
  for (const { fieldKey, values } of candidates) {
    for (const value of values) {
      for (const { method, request } of base) {
        const filters = request.query.filters ?? [];
        if (filters.some((f) => f.fieldKey === fieldKey)) continue;
        // Two property orders: a filter control querying its own field writes fieldKey first.
        const own = (request.query.dimensions ?? []).some((d) => d.fieldKey === fieldKey);
        const variants = own
          ? [{ fieldKey, operator: 'inList', values: [value] }, { operator: 'inList', values: [value], fieldKey }]
          : [{ operator: 'inList', values: [value], fieldKey }];
        for (const f of variants) {
          const next = { ...request, query: { ...request.query, filters: [...filters, f] } };
          const key = JSON.stringify(next);
          if (seen.has(key) || cache.has(key)) continue;
          seen.add(key);
          jobs.push({ method, next });
        }
      }
    }
  }
  let done = 0;
  const lane = async () => {
    while (jobs.length && done < maxQueries && run === prefetchRun) {
      // Yield to real work: wait until no real query is queued or running.
      while ((waiting.length || active >= 2 || Date.now() - lastReal < 800) && run === prefetchRun) await sleep(200);
      const job = jobs.shift();
      if (!job) break;
      done += 1;
      await services[job.method]?.(job.next, { prefetch: true }).catch(() => null);
    }
  };
  await Promise.all([lane(), lane()]);
  return done;
};

export const throttleQueries = (hostServices) => {
  const wrap = (service, method) => {
    const original = service[method].bind(service);
    const send = async (request) => {
      for (let attempt = 0; ; attempt += 1) {
        await acquire();
        try {
          return toNeutral(await original(toSource(request)));
        } catch (error) {
          if (!isRateLimited(error) || attempt >= RETRIES) throw error;
        } finally {
          release();
        }
        await sleep(Math.min(8000, 500 * 2 ** attempt) + Math.random() * 300);
      }
    };
    service[method] = (request, options = {}) => {
      if (!options.prefetch) lastReal = Date.now();
      let key;
      try { key = JSON.stringify(request); } catch { return send(request); }
      const t0 = performance.now();
      const entry = { at: Math.round(t0), method, key, cached: false, prefetch: Boolean(options.prefetch), ms: null };
      queryLog().push(entry);
      // Saved scenarios change through writeback: never serve them from the cache.
      const live = /\[Action Events\]|\[Saved Scenarios\]|Workflow Events|Scenario /.test(key);
      const hit = live ? null : cache.get(key);
      if (hit) {
        entry.cached = true;
        // Only a request served several times within LOOP_MS is a loop; a chart asking twice is not.
        hit.recent = (hit.recent ?? []).filter((t) => Date.now() - t < LOOP_MS);
        if (!options.prefetch) hit.recent.push(Date.now());
        const loop = hit.recent.length > LOOP_REPEATS;
        return hit.promise.then(async (value) => {
          if (!options.prefetch) keep(request, value);
          if (loop && !options.prefetch) await sleep(1000);
          entry.ms = Math.round(performance.now() - t0);
          if (!options.prefetch) appState.query(dimsSignature(request) || method, entry.ms, true);
          return value;
        }, (error) => { entry.ms = Math.round(performance.now() - t0); entry.failed = true; throw error; }); // a failure closes the entry too
      }
      const promise = send(request);
      if (!live) cache.set(key, { recent: options.prefetch ? [] : [Date.now()], promise });
      if (!options.prefetch) remember(method, request);
      promise.then((value) => { if (!options.prefetch) keep(request, value); entry.ms = Math.round(performance.now() - t0); if (!options.prefetch) appState.query(dimsSignature(request) || method, entry.ms, false); }, () => { entry.ms = Math.round(performance.now() - t0); entry.failed = true; cache.delete(key); }); // closed on failure, or settle loops wait out their timeout
      if (cache.size > 3000) cache.delete(cache.keys().next().value);
      return promise;
    };
  };
  // Whichever query entry points this runtime version exposes.
  if (typeof hostServices.data?.query === 'function') { wrap(hostServices.data, 'query'); services.query = hostServices.data.query; }
  if (typeof hostServices.engine?.getData === 'function') { wrap(hostServices.engine, 'getData'); services.getData = hostServices.engine.getData; }
};
