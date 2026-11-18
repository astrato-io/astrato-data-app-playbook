/**
 * Query scheduler for the governed engine: lanes, rate-limit retry and a session cache.
 *
 * - Lanes: a page load or a selection fires many queries at once and Astrato answers bursts with
 *   HTTP 429; charts never retry, so every query waits for one of a few lanes and a 429 is
 *   retried with backoff instead of being handed to the chart.
 * - Cache: the data is a fixed history, so an answer is kept for the session, keyed by the exact
 *   request. Selecting a city you selected before is answered at once.
 * - Log: every request is reported to the smoke-test contract (appState.query) and to `onQuery`,
 *   which feeds the app's Queries tab.
 */
import { appState } from './app-state.js';

const LANES = 6;
const RETRIES = 6;

let active = 0;
const waiting = [];
const acquire = () => new Promise((resolve) => {
  if (active < LANES) { active += 1; resolve(); } else waiting.push(resolve);
});
const release = () => {
  const next = waiting.shift();
  if (next) next(); else active -= 1;
};
const isRateLimited = (error) => error?.status === 429 || error?.response?.status === 429 || /rate limit|429/i.test(String(error?.message ?? ''));
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const shape = (request) => [...(request?.query?.dimensions ?? []), ...(request?.query?.calculations ?? [])]
  .map((d) => d.itemKey ?? d.fieldKey ?? '').join('|');

/** Wraps engine.getData in place. onQuery({ request, response, ms, cached }) is called after each answer. */
export const throttleQueries = (engine, onQuery = () => {}) => {
  const cache = new Map();
  const original = engine.getData.bind(engine);
  const send = async (request) => {
    for (let attempt = 0; ; attempt += 1) {
      await acquire();
      try {
        return await original(request);
      } catch (error) {
        if (!isRateLimited(error) || attempt >= RETRIES) throw error;
      } finally {
        release();
      }
      await sleep(Math.min(8000, 500 * 2 ** attempt) + Math.random() * 300);
    }
  };
  engine.getData = (request) => {
    const key = JSON.stringify(request);
    const t0 = performance.now();
    const cached = cache.has(key);
    if (!cached) {
      const promise = send(request);
      cache.set(key, promise);
      promise.catch((error) => { cache.delete(key); (window.__refused ??= []).push(`${error?.message} · ${shape(request)} · ${JSON.stringify(request?.query ?? {}).slice(0, 1500)}`); });
    }
    // Every asker gets its own copy of a cached answer, so no object can change what another reads.
    return cache.get(key).then((shared) => {
      const response = structuredClone(shared);
      const ms = performance.now() - t0;
      appState.query(shape(request), ms, cached);
      onQuery({ request, response: shared, ms, cached });
      return response;
    });
  };
};
