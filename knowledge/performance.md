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

- **Symptom:** every object over one view is slow, or times out, while objects over plain tables
  are fast.
- **Cause:** a Custom SQL view is not stored. The engine wraps its SQL into every query, so each
  object, each selection and each export pays the view's full scan again. A dense grid view
  (customer × week since the start of the data) took 51 s per query, and every object on it timed
  out (a test run, 2026-11-18).
- **Fix:** materialise heavy views in the warehouse (tables or dynamic tables refreshed on a lag):
  one view went from 6–14 s to 0.3 s per query. That is the data owner's change; when you may not
  make it, keep the view's scan small (limit it to the window the app shows and aggregate early:
  the same grid cut to 30 weeks went from 51 s to 5 s per query), and say in the brief that a
  materialised table would make the app fast.
- **Verified on:** 2026-11; the per-query re-run and the 51 s → 5 s rewrite on Snowflake,
  2026-11-18 (a test run).

## Every query takes several seconds, the layer's own measures included

- **Symptom:** over MCP, before any app exists, a single measure takes 3–10 s; the app's landing
  takes longer than the kit's 15 s budget, and a selection settles in 10–30 s however few objects
  are visible. Caching makes repeats fast; first clicks stay slow.
- **Cause:** the warehouse, not the app: a slow connection, a large table scanned on every query,
  or a Custom SQL view re-run per object ([above](#slow-custom-sql-views)). The app's scheduler,
  cache and visible-only queries cannot go below the time of one query.
- **Fix:**
  - **Measure early.** Time a headline measure and a stored question over MCP in
    [step 1](../playbook/1-read-the-layer.md#5-profile), and note it in the data brief's caveats.
    If the layer's existing measures are slow too, no app on this layer meets rubric E2's 3 s.
  - **Do what the app can:** visible-only queries, a scheduler with a session cache and idle
    prefetch ([query scheduler](../patterns/query-scheduler.md)), fewer objects on the landing tab,
    and small, early-aggregating SQL views.
  - **Recommend the real fix to the data owner:** a materialised (pre-aggregated) table at the
    grain the app reads, refreshed on a schedule. Do not create it yourself unless the brief
    allows warehouse changes.
  - **Run the smoke test with longer limits and say so:** `--landing-ms 60000` (default 15000) and
    `--check-ms 240000` (default 60000) for checks that select, wait and export; give the app's
    own waits inside checks the same headroom. Record the flags you used next to the score.
  - **Score E2 honestly**: time three selections as the rubric says and report the settle time
    you measured, with the per-query time as the reason. Do not hide it behind the cache.
- **Verified on:** Snowflake, app-runtime and visualizations 0.9.0, 2026-11-18 (a test run:
  existing measures took 3.3 s and 10.4 s over MCP; selections settled in 11–33 s).
- **See also:** [Each query takes about a second](#each-query-takes-about-a-second-however-small-the-data),
  [../kit/README.md](../kit/README.md#2-run-the-smoke-test).

## MCP calls fill the agent's context

- **Symptom:** a one-row profiling query returns about 25 KB; `astrato_get_context` about 58–60 KB,
  which can overflow the agent's tool output (an agent cannot save an MCP result to a file: call
  it with `detail: "identity"`, about 1 KB, for `auth.scopes`, and once in full for the
  `designBrief`, taking notes as you read);
  `get_summary` with `includeDetails` on a 358-measure layer about 60 KB, over the agent's
  tool-output limit; every `commit_authoring_batch` about 60 KB.
- **Cause:** `astrato_data_execute_query` returns the executed SQL (`statement`), `sourceContext`
  and `queryAnalysis` with the rows, up to a default budget of 49,152 bytes. Commit responses
  carry `entityHashes` for every entity in the layer, with no parameter to turn them off
  (`get_summary` has them opt-in, `includeEntityHashes`).
- **Fix:** pass `responseBudgetBytes: 4096`, the minimum, on profiling queries. Rows are never
  cut; `omittedMetadata` names what was left out, and a page the budget cuts short has
  `pageLimitedBy: "responseBudget"` and a `nextOffset` to continue from. Leave the budget off for
  a query whose SQL you need. Above about 100 measures, read the layer in pages (`get_details` one section at
  a time, or the catalogue through `astrato_data_prepare_query` page by page) and write what you
  need into the data brief as you go, not `includeDetails`. The snapshot that
  `includeSnapshot: true` links is a resource read into context, not a file. Put all layer changes in one
  commit.
- **Verified on:** the parameter, its limits and `omittedMetadata` from the tool schema, 2026-11.
  That 4096 drops `statement`, `sourceContext` and `queryAnalysis` and keeps the rows was observed
  in a test run on visualizations 0.9.0 (2026-11); larger budgets (6–12 KB on contract 10.38)
  kept `queryAnalysis`. On contract 10.39 a 4096 budget did not drop the metadata for queries
  with a local bucket dimension or with measures only (about 6 KB came back).
- **See also:** [semantic-layer.md](semantic-layer.md#mcp-responses-fill-the-context).
