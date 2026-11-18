# Query scheduler

A wrapper around `engine.getData` that limits concurrency, retries, and caches, so a page of 40 objects and every click stay fast.

## When

Any app with more than a dozen objects, or any app that will be demoed live.

## How

1. Wrap `hostServices.engine.getData` (and `data.query`): at most 4 requests in flight, visible objects first.
2. Retry 429s and timeouts with backoff.
3. Cache by `JSON.stringify(request)` for the session, and de-duplicate identical in-flight requests.
4. Keep a `window.__qlog` to count queries per click; it should roughly equal the visible objects.

## Gotchas

- The engine floor is about 0.5–1 s per query whatever the data size; caching and fewer queries matter more than SQL tuning.
- Clear the cache after a writeback.
- If you use the kit, call `appState.query(request, ms, fromCache)` from the wrapper as well as
  your own log, or the smoke test reports zero queries. The examples' schedulers log only to
  `window.__qlog`.
- **Do not hold a lane until an object reports ready.** Mount queues that wait for `handle.ready`
  before starting the next object starve when readiness is slow or never comes (a hidden window,
  one stuck chart): only the first few objects are ever created. Release the lane once
  `runtime.mount` has returned, and track readiness separately.

## Examples

- portfolio-os — lanes, backoff and cache: [throttle.js:110](../examples/portfolio-os/project/src/throttle.js#L110)
- revenue-war-room — gate and memo: [app.js:102](../examples/revenue-war-room/project/src/app.js#L102)
