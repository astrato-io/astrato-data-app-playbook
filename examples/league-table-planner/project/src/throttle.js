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

const LANES = 4;
const RETRIES = 6;
const LOOP_MS = 2000;
const LOOP_REPEATS = 3;
/** A request that has not answered in this time is abandoned so it cannot hold a lane forever (stale session after idle). */
const TIMEOUT_MS = 45000;
const TIMEOUT_RETRIES = 2;
const isTimeout = (error) => error?.code === 'NSOS_TIMEOUT';
const withTimeout = (promise) => new Promise((resolve, reject) => { const t = setTimeout(() => reject(Object.assign(new Error('Query timed out'), { code: 'NSOS_TIMEOUT' })), TIMEOUT_MS); promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); }); });

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
/** Drop cached answers after a write so the next read sees it. */
export const clearQueryCache = () => cache.clear();
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
  // Back from idle: forget answers that are still pending, so the next query is sent afresh.
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') for (const [k, v] of cache) if (v.pending) cache.delete(k); });
  const wrap = (service, method) => {
    const original = service[method].bind(service);
    const send = async (request) => {
      for (let attempt = 0; ; attempt += 1) {
        await acquire();
        try {
          return await withTimeout(original(request));
        } catch (error) {
          if (isTimeout(error)) { if (attempt >= TIMEOUT_RETRIES) throw error; console.warn('[query] timed out, retrying', attempt + 1); continue; }
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
      const hit = cache.get(key);
      if (hit) {
        entry.cached = true;
        // Only a request served several times within LOOP_MS is a loop; a chart asking twice is not.
        hit.recent = (hit.recent ?? []).filter((t) => Date.now() - t < LOOP_MS);
        if (!options.prefetch) hit.recent.push(Date.now());
        const loop = hit.recent.length > LOOP_REPEATS;
        return hit.promise.then(async (value) => {
          if (loop && !options.prefetch) await sleep(1000);
          entry.ms = Math.round(performance.now() - t0);
          appState.query(`${method}:${key.length}`, entry.ms, true);
          return value;
        }, (error) => { entry.ms = Math.round(performance.now() - t0); entry.failed = true; throw error; }); // a failure closes the entry too
      }
      const promise = send(request);
      const slot = { recent: options.prefetch ? [] : [Date.now()], promise, pending: true };
      cache.set(key, slot);
      promise.finally(() => { slot.pending = false; }).catch(() => {});
      if (!options.prefetch) remember(method, request);
      promise.then(() => { entry.ms = Math.round(performance.now() - t0); appState.query(`${method}:${key.length}`, entry.ms, false); }, () => { entry.ms = Math.round(performance.now() - t0); entry.failed = true; cache.delete(key); }); // closed on failure, or settle loops wait out their timeout
      if (cache.size > 3000) cache.delete(cache.keys().next().value);
      return promise;
    };
  };
  // Whichever query entry points this runtime version exposes.
  if (typeof hostServices.data?.query === 'function') { wrap(hostServices.data, 'query'); services.query = hostServices.data.query; }
  if (typeof hostServices.engine?.getData === 'function') { wrap(hostServices.engine, 'getData'); services.getData = hostServices.engine.getData; }
};
