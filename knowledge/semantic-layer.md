# Semantic layer and its MCP tools

Authoring measures, dimensions, views, joins and stored business questions through the Astrato
MCP server, and how layer revisions reach apps. Tool contract versions are noted where known.

---

## The app does not see a measure I just added

- **Symptom:** a tile compiles out as "a field this tile needs is not in this semantic layer";
  MCP queries do not see the new item either.
- **Cause:** once a layer has a published revision, apps and MCP data queries read **that**
  revision, not the draft. (A layer that has never been published is queryable as a draft through
  `astrato dev`.)
- **Fix:** validate and publish, then reload field metadata. Check what the app really has:
  `availableFields.filter(f => f.kind !== 'field').map(f => `${f.kind}:${f.name}`)`.
- **Verified on:** 2026-09.
- **See also:** [hosting.md](hosting.md#the-hosted-app-stops-loading-data-after-a-layer-publish).

## Publishing one measure changed another measure's result type

- **Fix:** after every publish, re-run whatever syncs layer metadata or stored questions into the
  app, and re-check tiles that use neighbouring measures.
- **Verified on:** 2026-10.
- **See also:** [../patterns/governed-business-questions.md](../patterns/governed-business-questions.md).

## A measure expression is refused

- **Symptom:** "Unsupported identifier", or the commit silently drops the measure.
- **Refused in stored measure expressions:** `CASE`, `ABS`, `GREATEST`, `NULLIF` (the engine adds
  its own), unary minus (write `0 - x`), and `COUNT_DISTINCT` as an aggregation on some
  deployments (use `COUNT` with `distinct: true`). `MAX` was refused in one filtered-flag measure.
- **Fix:** move row-level logic into an expression field and aggregate that (window functions work
  there, even with view parameters); for |x| use an aggregate input with `options.absolute`; for
  constant measures use a `{ kind: 'value' }` input.
- **Verified on:** MCP tool contract 10.x, 2026-09/11.

## A ratio shows −100% or 0

- **Cause:** `a / b` with a NULL or zero divisor returns 0, so `a / b - 1` shows −100%;
  `1 / (expr)` can truncate to 0 at the warehouse's division scale.
- **Fix:** guard in a row-level expression field, or write `(a) * 1 / (b) - 1`. Hide % changes for
  items with no prior value.
- **Verified on:** 2026-10/11.

## A measure prints raw numbers although it has a custom format

- **Symptom:** every chart and table using the measure shows unformatted values (`-3524874.41`);
  `commit_authoring_batch` and `validate` reported 0 errors.
- **Cause:** an unquoted unit letter in any section of the format, e.g. the `m` in
  `+£#,##0.0,,"m";-£#,##0.0,,"m";£0.0m`. Unquoted `m` is a month code, and the whole format is
  dropped. The validator does not check format strings.
- **Fix:** quote every unit in every section: `+£#,##0.0,,"m";-£#,##0.0,,"m";£0.0"m"`. Unquoted
  `k` worked in the same run; quote it anyway. Check one rendered tile after publishing a format.
- **Verified on:** observed in a test run on visualizations 0.9.0, 2026-11.
- **See also:** [visualizations.md](visualizations.md#a-custom-format-string-renders-the-wrong-text).

## A derived measure is refused, or mixes aggregates and measures

- **Symptom:** a whole `commit_authoring_batch` fails atomically with *"Derived measure … may
  reference only aggregate measures; X is derived"* (or "derived-measure-composition").
- **Cause:** a derived measure may not mix field aggregates with measure references, nor reference
  another derived measure. Enforcement is uneven: in one run a measure mixing a parameter or
  constant with derived measures was refused, while `IF(p IS NULL …, (c - p) / p)` over two
  derived measures was accepted. Do not rely on the exception.
- **Fix:** write each derived measure from base aggregate measures (or field aggregates) only:
  inline the formula of any derived measure it would reference. For what-if measures, repeat the
  base aggregates with the parameter rather than referencing a derived "baseline" measure.
  Parenthesise only composite sub-formulas, and avoid `) / (` (see
  [hosting.md](hosting.md#hosted-queries-fail-with-a-cors-error-or-403)).
- **Verified on:** 2026-10/11; the message and the uneven case on MCP, 2026-11-18 (a test run).

## A derived measure is stuck at parameter defaults

- **Symptom:** KPIs do not follow a window, comparison or as-of parameter, while their component
  measures do.
- **Cause:** a measure that references a parameterised measure declares no `filterParams`/`params`
  in its field metadata, so apps cannot pass `namedParameters` or `setMeasureDefinedParameter`.
- **Fix:** inline every parameterised reference down to aggregates before saving.
- **Verified on:** 2026-10.

## Every MCP query fails with "semantic layer hash mismatch"

- **Cause:** a period measure with its own measure-level `window` override (`weekToDate`,
  `periodEnd: fixed`).
- **Fix:** delete or rewrite those measures without the override.
- **Verified on:** 2026-10.

## `commit_authoring_batch` commits nothing, or commits when it should not

- `committed: false, noChange: true` means the definition was already identical: treat as success.
- A measure whose inputs are not all used in its expression is refused silently, with no
  `blockingIssues`. So was `COUNT_DISTINCT` on one deployment. Print the whole result.
- The `dryRun` flag was ignored once: the probe committed for real.
- A batch takes at most 50 items; chunk it, and retry 429s.
- Dimensions reject `categories` in a batch; measures accept it.
- A `replace` still needs `name`; a create needs `preparedTarget: null`.
- A `replace` on a measure is not a full replace: a stored `periodComparison` survives a new
  definition that omits it (a non-aggregate base is then refused: "Period-comparison measure …
  must use an aggregate base expression"). Clear it explicitly: `periodComparison: { mode:
  "clear" }` alongside the new `calculation`.
- On a large production layer the commit echoes every entity hash (15–70k characters): batch big,
  commit rarely.
- **Verified on:** MCP tool contract 10.x, 2026-09/11.

## Field types drift from the warehouse

- **Symptom:** the editor shows type errors and drift warnings; stored questions are flagged as
  unable to run.
- **Cause:** hand-declared `dataType` (a year as string, every numeric as generic `number`).
- **Fix:** take types from the source: read them from `INFORMATION_SCHEMA` (some deployments
  require `dataType` on `upsert_field`) or run the source-schema check/fix after adding views, and
  confirm 0 drift before authoring measures. Cast in the warehouse when a column needs another type.
  View field `dataType` is `timestamp`, never `datetime`.
- **Verified on:** 2026-10/11.

## A calculated field is read as a column name ("invalid identifier")

- **Fix:** `upsert_field { name, source: 'SPEND / NULLIF(CONVERSIONS, 0)', sourceType: 'expression',
  dataType: 'float' }`. Without `sourceType: 'expression'` the SQL is treated as a column. Prefer
  layer expression fields for bands, labels, flags and sort keys over new warehouse columns.
- **Verified on:** 2026-10.

## Repointing a view deleted all its fields

- **Cause:** replacing an existing view's source with `upsert_view` drops every field.
- **Fix:** re-add the fields in the same edit session, or swap the warehouse object names instead.
- **Verified on:** 2026-10/11.

## Custom SQL view fields disappear or misbehave

- **Symptoms:** apps that drop schema-less fields lose them; static filters on them break objects;
  chart clicks on them never select.
- **Cause:** Custom SQL view columns come back from `getFieldMetadata` with no `schema`.
- **Fix:** add a schema string to such fields in a metadata wrapper; filter through governed
  dimensions over them; see [selections.md](selections.md#a-click-on-a-chart-over-a-custom-sql-view-highlights-but-never-selects).
  For slow SQL views, materialise them in the warehouse (dynamic tables took one view from 6–14 s
  to 0.3 s per query).
- **Verified on:** 2026-11.

## Joins: range joins, fan-out and multiple facts

- **Range join:** conditions like `[Calendar.Date >= Placements.Start, Calendar.Date <
  Placements.End]` work. The first argument of each condition must come from the first view in
  `views` ("unknown field" otherwise). `many-to-many` gave "ambiguous column name"; `one-to-many`
  worked.
- **Fan-out:** a measure in a query with a fanning measure returns 0 unless its aggregate input
  has `options: { fanout: 'allow' }`. `reduceToRelation` compiles to SELECT DISTINCT over amounts.
- **Several facts on shared dimensions** are fan-out safe: the engine emits one UNION ALL per grain.
- **Join quality** fails on publish when fact keys fall outside the dimension table (new months);
  drop or extend the join.
- **Verified on:** 2026-09/10.

## Time axes and relative periods compare the wrong period

- One source per time axis; a multi-source axis breaks hidden comparisons.
- Baseline grain `year` on a month window compares the whole prior year: use a month offset of −12.
- Weekday alignment is refused with `periodEnd: latest`.
- `latest` is mid-month: the last full month is period `previousMonth`; a week axis needs a week
  period, not `last12Months`.
- **Verified on:** 2026-10/11.

## A season comparison drops the last week of the previous season

- **Symptom:** "last season" is short by one period and the growth headline is inflated (one run:
  +7.8% where summing by season gave +4.4%). Validation and query notices say nothing.
- **Cause:** comparison windows are **day-aligned**, and on weekly data `periodEnd: latest` is the
  *start* date of the last week. When that week started on a later calendar date last year (final
  week starting Mon 30 Mar this year, Mon 31 Mar last year), the window shifted back a year ends a
  day before last season's final week and loses all of it.
- **Fix:** set `periodEnd: fixed` on the axis dimension at the last day of the season's final week
  (the Sunday it ends), or use measures filtered explicitly to each season. Set it on the axis,
  not as a measure-level override, which breaks every MCP query
  ([hash mismatch](#every-mcp-query-fails-with-semantic-layer-hash-mismatch)). Cross-check one
  comparison measure against the base measure summed by the period dimension (season, year)
  before using it as a headline.
- **Verified on:** 2026-11, over MCP (figures reconciled by season).

## Share of total, 100% stacks and indexes

- Share of total: measure `COUNT(x) / COUNT(x)` with input option `scope: 'total'`; it follows
  selections.
- 100% stacked bar: a one-value mapping dimension + the share measure + `stacked` layout.
- Share within a split in a stored question:
  `advancedCalculation: { compareToTotal: { comparison: 'ratio', aggregate, partitionBy: [key] } }`
  (`compareToTotal` needs `aggregate`).
- Index (rebase to 100): refused on tool contract 10.33.0 (`index`/`indexEnabled` unrecognised);
  the server announces `compareToTotal.index` from contract 10.36. Check your contract
  (`astrato_get_context`) before rebasing in the layer by hand (a table of every period against
  every base period, base period chosen by filter). Not yet tried in a chart.
- **Verified on:** 2026-09/11.

## Mapping dimensions sort alphabetically and expose a phantom key

- Mapping values sort alphabetically, never in group order; prefix labels to order them.
- They expose a column key (`[View].[Group_Name]`, spaces → `_`) that filters and selections
  accept and raw `getData` needs. Plain measures accept that key as a filter; the dimension's
  item key (`[dimension].[Group Name]`) is not accepted in its place.
- **Verified on:** visualizations 0.4.0, 2026-09; the key behaviour unchanged on 0.9.0, 2026-11.

## Stored business questions: authoring shapes that work

- Definition: `dimensions: [{ key, reference: { dimension } }]`, `measures: [{ key, reference:
  { measure }, advancedCalculation }]`; raw `{ view, field }` dimension references are accepted.
- Filters: `{ expression: '{a} AND {b}', a: { operator, arguments: [{ reference }, { value }] } }`;
  conditions top-level, `parameters` only for real parameters. Filters can reference dimensions
  only. Integer fields need number values, not strings.
- `orderBy` / `partitionBy` name a selection by its **key** (`d0`, `m0`); with keys set, a
  name-based orderBy fails `missing-sort-target`.
- `preferredCharts` takes objects (`{ type: 'line' }`) from: line, bar, stacked_bar, area, pie,
  donut, scatter, table, heatmap, funnel, kpi, combo, waterfall.
- At most 20 selections. Names must be unique.
- `defaults.topN` ranks by measure, not by `orderBy`: do not use it for "latest period".
- A running total plus top N in one question fails (engine 13700). A running total needs
  `{ aggregate, partitionBy: [], orderBy: [{ reference: { dimension } }] }`.
- `execute_question` takes `id`, not `questionId`.
- Running a stored question from the app depends on the runtime. Builds before app-runtime 0.8
  have no call for it: sync the questions into the app as a generated module. 0.8 and 0.9 type
  `runQuestion(name, options?): Promise<AstratoAppQuestionChart>` (rows in `result.columns` /
  `result.rows`) and `nextQuestions(of, { signal }?): Promise<{ name, question, categories }[]>`,
  by the question's published name. 0.8's options are `{ signal }`; 0.9 adds `filters` (SDK
  selection entries, `selections.getSelection(group).applied` as is; associative ones refused)
  and `parameters` (`{ all, measures, filters, resultFilters }`). Both need the `question:run`
  capability and run only in a published App or the App Builder preview: under `astrato dev`
  they throw `unsupported_environment` "Questions run in a published App and the App Builder
  preview." Native charts still take the question's definition, as above. 0.9 also adds
  `pinboards()` and `pin({ question, pinboardId, display? }): Promise<{ slug, board }>` (the
  `pinboard:pin` capability; a published App with a signed-in viewer only).
- **Verified on:** MCP tool contract 10.x, 2026-09/11; the runtime calls read from the
  app-runtime 0.8.0 and 0.9.0 typings and bundle (2026-11), not run.
- **See also:** [../patterns/governed-business-questions.md](../patterns/governed-business-questions.md).

## A rank in a stored question shows as currency

- **Symptom:** a rank selection on a currency measure (rank of Total Sales) comes back formatted
  `$#,##0`, so rank 5 reads "$5". Validation does not flag it.
- **Cause:** the rank inherits the format of the measure it ranks.
- **Fix:** set a format override on the rank selection (`0`, or `#,##0`). Execute the question
  once after writing it and read the formats it returns.
- **Verified on:** MCP, 2026-11-18 (a test run).

## `validate` reports an error your change did not cause

- **Symptom:** `astrato_semantic_layer_validate` returns "Validation failed: 1 error" with 0 model
  issues after a clean commit.
- **Cause:** the result includes the layer's last stored source-check result, which can be old
  and unrelated (a "No source tables could be found" from weeks earlier).
- **Fix:** read the error details and their date before concluding your change failed. Re-running
  the source check can create a draft revision; on a layer you share, leave it unless you own it.
- **Verified on:** MCP, 2026-11-18 (a test run).

## MCP data tools refuse: "This connector requires additional permissions."

- **Cause:** the connector holds only semantic-layer scopes (`sl:read sl:write sl:version`), not
  `data:query`. The CLI and the MCP connector hold separate grants: an app can still query.
- **Fix:** connect with a credential that has `data:query`, or profile through the app's engine.
  Check scopes with `astrato_get_context` (`auth.scopes`). Some deployments' connectors also lack
  management scopes (access grants) or `resources/read`.
- **Verified on:** 2026-09/11.

## Other MCP authoring facts

- `publish` needs `expectedRevision`; call `preview_publish` first, every time.
- An ad-hoc query (`prepare_query` / `execute_query`) that selects a raw field orders only by
  selection **key**: "A raw field selection … can be ordered only by key".
- `CORR` appears among a datasource's aggregate functions but is refused in a measure
  ("Aggregation CORR requires arguments the measure editor does not support"). Compare bands
  instead.
- No MCP tool renames a layer; rename it in the editor.
- Freeform-dashboard tools create the shell and edit names only; there is no tool to author tiles.
- Long arguments can hit argv length limits or mangle non-ASCII characters on Windows: pass JSON
  from a file.
- `commit_authoring_batch` over MCP takes its items inline; there is no file argument. Generate
  the batch with a script from the same module the app reads its names from (a stored-question
  catalogue), and paste that output unchanged, so the layer and the app cannot drift.
- Responses may be SSE with `: keepalive` lines before the JSON.
- A revision value is stale after any concurrent edit: re-read and prepare again.
- `astrato_data_import_csv` with `semanticLayerId` also edits the layer's settings
  (`engineProperties/csvSourcedTables`), which `preview_publish` lists as a change. See
  [writeback.md](writeback.md#how-do-i-create-a-writeback-table).
- **Verified on:** 2026-09/11.

## "This quarter" is empty because the data ends in the past

- **Symptom:** relative periods (this month, quarter to date) return nothing, or a KPI compares a
  period with no data; or every question carries its own hard-coded period filter.
- **Cause:** relative periods default to today. Data that stops earlier has no "this quarter".
- **First, where is the date?** If the facts and the axis date are in **one view** (common: a
  single sales view), stored period-comparison measures break under *any* filter on that view
  (engine 013401, see the limit below), so every KPI fails as soon as a reader filters. Use
  explicitly filtered measures there (`Sales` filtered to this period, to the previous one, and
  their difference). Use the time axis only when the axis date sits in a view readers do not
  filter, such as a separate date or calendar dimension view.
- **Fix (date in its own view):** a stored **time axis** dimension read as of the latest date in
  the data, and **period-comparison measures** on it. The dimension:
  ```json
  { "kind": "periodAxis",
    "periodAxis": { "level": "quarter", "period": "quarterToDate", "periodEnd": "latest",
                    "sources": [{ "reference": { "view": "Sales Pipeline", "field": "Close Date" } }] } }
  ```
  Then one family of measures per headline, each the base measure plus a `periodComparison`:
  ```json
  "Revenue This Quarter":           { "…": "…", "periodComparison": { "type": "current", "reference": { "dimension": "Review Quarter" } } }
  "Revenue Last Quarter":           { "…": "…", "periodComparison": { "type": "value",   "reference": { "dimension": "Review Quarter" } } }
  "Revenue Change vs Last Quarter": { "…": "…", "periodComparison": { "type": "diff",    "reference": { "dimension": "Review Quarter" } } }
  "Revenue Growth vs Last Quarter": { "…": "…", "periodComparison": { "type": "growth",  "reference": { "dimension": "Review Quarter" } } }
  ```
  Give change measures a signed format (`+$#,##0;-$#,##0`, `+0.0%;-0.0%`). A chart of "change by
  team" is then one dimension and one stored measure, with no inter-record calculation, and the
  team changes sum to the total change. Queries that use these measures without selecting the axis
  return notices saying the whole window is compared with its shifted window per row: that is the
  intended result, not a warning to fix.
- **Limit: filters on the axis's own view break them.** A filter or selection on *any* field of
  the view that holds the axis date (season stage, week type) makes every `periodComparison`
  measure fail with HTTP 400; MCP shows *"[13301] Error 013401: period-comparison calendar
  selection has no unambiguous time axis"*. Filters on a joined dimension view (country) work.
  If readers filter on that view, use explicitly filtered measures instead (`Season = 2025/26`
  vs `2024/25`): same figures, but the period values must be moved on when a new period arrives.
  Weekly data has a further trap: see
  [the previous season's last week](#a-season-comparison-drops-the-last-week-of-the-previous-season).
- **Verified on:** MCP contract 10.37.0, 2026-11, over MCP (figures reconciled); the filter
  failure seen in rendered KPIs on visualizations 0.9.0, 2026-11.
- **See also:** [../patterns/kpi-sparkline-comparison.md](../patterns/kpi-sparkline-comparison.md).

## A date dimension returns one row per day, whatever its name says

- **Symptom:** a "monthly" chart or question returns hundreds of rows; a 3-month moving average is
  a 3-day one.
- **Cause:** a stored dimension over a date field has no date level unless one was set. Its name
  and description ("Close Month … group by month in charts") do not change what it returns.
- **Fix:** execute every date dimension once when profiling and count the rows. Where the grain is
  wrong, add a dimension with the level set (`"dateLevel": "month"` on the same field) and use that;
  do not rely on each chart to regroup.
- **Verified on:** MCP contract 10.37.0, 2026-11.

## Authoring calls on MCP contract 10.37

- `astrato_semantic_layer_commit_authoring_batch` accepts **creates** of dimensions, measures and
  questions with `preparedTarget: null` and no prior `plan_authoring_batch` call.
- A **patch** needs `preparedTarget` set to the item's exact name. With `null` it fails:
  *"Change target must exactly match preparedTarget: null"*. This holds for stored questions
  too: patch one with `preparedTarget: '<its name>'`; create one with `null`.
- Put everything in **one commit**. Each commit response carries about 12 KB of entity hashes for
  the whole layer.
- **Verified on:** MCP contract 10.37.0, 2026-11; the question patch 2026-11-18 (a test run).

## MCP responses fill the context

- **Symptom:** a few layer calls use hundreds of kilobytes of context.
- **Fix:** on a small layer (under about 100 measures), one `astrato_semantic_layer_get_summary` with
  `includeDetails: true` returns every view, field and item; above that (358 measures came to
  about 60 KB) use `includeSnapshot: true` or page `get_details`. For queries, budget the work rather than the response: profile with few, small queries
  and keep row limits low.
- **`responseBudgetBytes` does less than it sounds.** On 10.37 it seemed to trim analysis metadata;
  on 10.38 the full `queryAnalysis` (5–15 KB) still came back at budgets of 6–12 KB, and only the
  executed SQL was dropped (`omittedMetadata.statement`). A budget smaller than the first row with
  its column metadata fails outright (*"The complete first row cannot fit"*). At the minimum,
  4096, `queryAnalysis` and `sourceContext` were dropped too: see
  [performance.md](performance.md#mcp-calls-fill-the-agents-context).
- **Commits echo the whole layer.** Every `commit_authoring_batch` response carries the full
  `entityHashes` map (about 60 KB on a 600-entity layer) and has no opt-out, unlike
  `get_summary`'s `includeEntityHashes`. Batch everything into as few commits as possible.
- **Verified on:** MCP contract 10.37.0 and 10.38.0, 2026-11.

## The MCP connection drops in the middle of a session

- **Symptom:** calls that worked a minute ago fail with *"Error POSTing to endpoint"*, then *"The
  operation timed out"*.
- **Cause:** the client's connection to the MCP server dropped. Some clients do not reconnect
  within the same session.
- **Fix:** carry on with work that does not need the server (app code, offline compile check),
  then retry. If it stays down, restart the agent session: a fresh session reconnects. Keep the
  layer work in one commit so a drop never leaves it half done.
- **Verified on:** MCP contract 10.38.0, 2026-11.

## A measure filter that compares two fields

- **Fix:** the filter argument takes another field as its value:
  `{ "operator": "lessThan", "arguments": [{ "reference": { "view": "V", "field": "Rank 2026" } }, { "value": { "kind": "field", "field": { "view": "V", "field": "Rank 2025" } } }] }`
  ("climbed" = this year's rank below last year's). The shape is in the authoring tool's schema.
- **Verified on:** MCP contract 10.38.0, 2026-11.

## Each series ends on a different date

- **Symptom:** a time axis read "as of the latest date" leaves some KPIs empty: one survey's
  figures end in June, another's in July, and "latest" is July for the whole view.
- **Cause:** `periodEnd: latest` is one date for the whole view.
- **Fix:** where series end at different dates, mark the latest row **per series** (a flag such as
  `Period Status = Latest`) and filter on that, or give each series family its own measures.
  Profile MIN and MAX date per series in step 1.
- **Verified on:** MCP contract 10.38.0, 2026-11.

## A difference measure invents a change where there is no earlier period

- **Symptom:** "change on year" equals the value itself in the first year of the data.
- **Cause:** the engine compiles `{m1} - {m2}` as `COALESCE(m1, 0) - COALESCE(m2, 0)`, so a missing
  prior value counts as 0.
- **Fix:** guard the measure so it returns nothing when either side is missing:
  `IF({h} IS NULL OR {r} IS NULL, NULL, {h} - {r})` (accepted by the authoring schema), or a
  filter limiting it to periods that have a predecessor. The same applies to a difference of two
  filtered averages where one filter matches no rows. Check it on the earliest period: the
  rubric's F3 asks for exactly this.
- **Verified on:** MCP contract 10.38.0, 2026-11 (SQL read back from `astrato_data_execute_query`);
  the `IF` guard 2026-11.

## Where to read a measure's formula

- `astrato_semantic_layer_get_details` with `section: items` returns names and descriptions, not
  formulas. To see what a measure computes (its filter, its aggregation), read the snapshot:
  `astrato_semantic_layer_get_summary` with `includeSnapshot: true`, then read the resource it links.
- **Read the formula, not the description.** An existing measure's description can promise a
  filter its formula lacks: on an economic forecasts layer, an "average growth" measure described
  like GDP growth had no indicator filter and averaged every indicator. Check each existing
  measure you reuse; where it is wrong and you may not change it, add a correctly filtered one.
- Existing stored questions pinned to one member (one city, one year) are **shape examples**:
  copy their structure, not their filters.
- **Verified on:** MCP contract 10.38.0, 2026-11; the misleading description 2026-11-18 (a test
  run).

## A long-format layer: one row per series per period

- **Shape:** a single fact view where each row is one indicator for one period (and perhaps one
  region or group), and each headline measure filters to one indicator. Common for statistics
  and survey data.
- **What changes:**
  - never add across indicators: every measure pins its series;
  - a selection on the indicator, region or group field empties every measure pinned to another
    one. Split each tab into groups (charts, KPIs) and mirror only the fields that make sense to
    each: time to everything, region only to regional views;
  - a KPI that reads "the latest release" must drop that filter while a time is selected, or the
    latest row intersected with the selected year is empty.
- **Verified on:** visualizations 0.9.0, MCP contract 10.38.0, 2026-11.
