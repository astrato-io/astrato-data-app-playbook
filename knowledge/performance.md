# Performance and rate limits

Where load time and click latency go in an Astrato App, and what moved them. The working code is
in [../patterns/query-scheduler.md](../patterns/query-scheduler.md) and
[../patterns/preload-tabs.md](../patterns/preload-tabs.md).

---

## Each query takes about a second, however small the data

- **Symptom:** a warehouse query of ~60–80 ms takes 0.5–1.5 s end to end; BigQuery about 1.3 s.
- **Cause:** a fixed engine and gateway floor per query; tenant load adds noise. The server ran about
  3 queries at once for one app.
- **Fix:** fewer and cached queries matter more than SQL tuning: a session cache keyed by
  `JSON.stringify(request)`, de-duplicated in-flight requests, and idle prefetch of the visible
  charts × each filter value (first clicks went from 1.4–2.8 s to 0–15 ms). A merged query costs
  more than its parts and is not served from the server's cache.
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/11.

## 429 "Astrato is rate limiting requests"

- **Symptom:** 429s on query bursts, or on `/_astrato/v1/bootstrap` so the app will not start;
  charts mount and never paint; ~12% of 25 instances failed silently even at a 3 s stagger.
- **Cause:** bursts of queries and reloads: 32 instances on one page reliably tripped the limiter
  (0.4.0); two app instances in one tab (device-preview iframes); a 0-row table re-querying every
  second; reloading more than once every few minutes.
- **Fix:** route every `getData`/`data.query` through a scheduler: at most ~4 in flight, visible
  objects first, retry 429s with backoff. Keep visible object counts modest, batch edits into one
  reload, and wait about a minute after a 429 storm.
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/10.

## A burst of HTTP 400 "Astrato rejected the runtime request" that succeeds on retry

- **Symptom:** after a selection, most of a burst of queries (4 of 5 KPI figure queries) return
  HTTP 400 "Astrato rejected the runtime request" with `retryable: false`; the same request sent
  again succeeds.
- **Cause:** not root-caused. Seen under concurrent load; in the same run some 400s had a real
  cause (a selection set in code without `operator`, see
  [selections.md](selections.md#every-chart-in-a-group-returns-http-400-after-a-selection-set-in-code),
  and integer selections sent as `number`, see
  [cli-and-publishing.md](cli-and-publishing.md#template-kpis-go-blank-after-a-click-on-an-integer-field)),
  so rule out a malformed request first: a request that fails the same way every time is not this.
- **Fix:** in the scheduler, retry that message up to twice despite `retryable: false`, and
  reduce lanes (3 in flight cleared it). A scheduler that retries only 429 does not cover it.
- **Verified on:** app-runtime / visualizations 0.9, 2026-11-18 (a test run; not root-caused).
- **See also:** [../patterns/query-scheduler.md](../patterns/query-scheduler.md).

## One click fires dozens of queries

- **Cause:** a selection re-queries every mounted object in its group, hidden tabs included.
- **Fix:** a selection group per tab, mirrored from `main` only while visible; count queries per
  click (it should match the visible objects).
- **Verified on:** visualizations 0.5.2, 2026-10.
- **See also:** [selections.md](selections.md#one-click-re-queries-every-chart-including-hidden-tabs).

## Page load is slow before any data arrives

- **Cause:** the app's own work, measured on a 20-object page: styling one operation at a time
  before mount (~24 s of a 25 s wait); compiling tiles serially; mounting before default
  selections (every object queried twice, 62 → 28 queries); building rarely opened "view data"
  tables up front; a long stagger (metadata loads once per page, so 150 ms is enough; older advice
  of 4 s is obsolete).
- **Fix:** batch operations per object before mount; `Promise.all` compiles; apply default
  selections before mounting; build secondary tables on first open. Result: first chart 25 s →
  2–3 s, last query 56 s → 7 s.
- **Verified on:** visualizations 0.4.0, sdk 0.4.0, 2026-09.

## The page freezes on a layer with thousands of fields

- **Symptom:** on a 7,000-field layer `compileVisualizationDefinition` took 22.5 s per tile and
  froze the main thread.
- **Fix:** pass each definition only the fields it names plus what those reference (closed
  transitively): 0.46 s per tile. Then cache compiled, themed vSpecs (next entry). On another,
  smaller layer pruning saved only 30% and changed output, so measure before adopting it.
- **Verified on:** visualizations 0.5.2, 2026-10/11.

## The hosted app sits on the splash screen

- **Fix:** prebuild themed vSpecs offline or from a dev session into a JSON cache keyed by a hash of
  each tile definition, the theme code and the layer's fields; skip compile and theme on a hit. One
  app: shell 22.9 s → 3.3 s, landing 28.8 s → 8.7 s; another: in-browser compile 8.8 s → 0.5 s.
  Regenerate after any tile, theme or layer change (a stale entry only costs speed). A per-device
  `localStorage` copy of prepared vSpecs and query results (keyed on a layer fingerprint) makes
  repeat visits near instant.
- **Verified on:** visualizations 0.5.2, 2026-11.
- **See also:** [hosting.md](hosting.md#the-hosted-app-is-much-slower-than-local).

## Selection effects lag several seconds

- **Cause:** engine queries queue behind long export or narrative queries.
- **Fix:** run exports and narratives after visible objects settle, in their own lane, and cancel
  them on the next change. Run text queries only for the visible tab.
- **Verified on:** 2026-11.

## Slow Custom SQL views

- **Fix:** materialise heavy views in the warehouse (tables or dynamic tables refreshed on a lag):
  one view went from 6–14 s to 0.3 s per query.
- **Verified on:** 2026-11.

## MCP calls fill the agent's context

- **Symptom:** a one-row profiling query returns about 25 KB; `astrato_get_context` about 58–60 KB,
  which can overflow the agent's tool output (save it to a file and parse out `auth.scopes` and
  the `designBrief` with a script);
  `get_summary` with `includeDetails` on a 358-measure layer about 60 KB, over the agent's
  tool-output limit; every `commit_authoring_batch` about 60 KB.
- **Cause:** `astrato_data_execute_query` returns the executed SQL (`statement`), `sourceContext`
  and `queryAnalysis` with the rows, up to a default budget of 49,152 bytes. Commit responses
  carry `entityHashes` for every entity in the layer, with no parameter to turn them off
  (`get_summary` has them opt-in, `includeEntityHashes`).
- **Fix:** pass `responseBudgetBytes: 4096`, the minimum, on profiling queries. Rows are never
  cut; `omittedMetadata` names what was left out, and a page the budget cuts short has
  `pageLimitedBy: "responseBudget"` and a `nextOffset` to continue from. Leave the budget off for
  a query whose SQL you need. Above about 100 measures, read the layer with `get_summary`
  `includeSnapshot: true` saved to a file, not `includeDetails`. Put all layer changes in one
  commit.
- **Verified on:** the parameter, its limits and `omittedMetadata` from the tool schema, 2026-11.
  That 4096 drops `statement`, `sourceContext` and `queryAnalysis` and keeps the rows was observed
  in a test run on visualizations 0.9.0 (2026-11); larger budgets (6–12 KB on contract 10.38)
  kept `queryAnalysis`. On contract 10.39 a 4096 budget did not drop the metadata for queries
  with a local bucket dimension or with measures only (about 6 KB came back).
- **See also:** [semantic-layer.md](semantic-layer.md#mcp-responses-fill-the-context).
