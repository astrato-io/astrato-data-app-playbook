# Build the layer (only when there is none yet)

Usually a semantic layer already exists over the data, and you start at
[step 1](1-read-the-layer.md). This page is for the other case: the data is in Snowflake, reachable
through an Astrato connection, and nobody has modelled it yet. Build the layer through the Astrato
MCP server, then go on to step 1, which profiles what you built.

**Do not create or change data.** The warehouse is the user's: no new tables, no inserted rows,
no mock data, no "presentation" columns. If the data cannot support part of the brief, that is a
finding to report, not a gap to fill with invented rows. Everything this step adds lives in the
semantic layer.

The [layers/](../layers/) folder holds complete layers (views, joins, dimensions, measures,
stored questions) to look at for modelling choices: how a fact joins to its dimensions, how
measure families and time axes are named, what descriptions say.

## 1. Find the data

- `astrato_data_list_connections`: the connections you can use, and their warehouse. When several
  point at the same database, prefer one you can browse and that other layers over that data
  already use. A 403 ("the connection is not accessible to this user") means pick another, not
  retry. Note which one you chose and why.
- `astrato_semantic_layer_search_source_catalog` searches by name but needs a `semanticLayerId`;
  `astrato_data_browse_connection_catalog` needs none but pages alphabetically with no name
  filter. On a large schema, create the layer first (step 2.1, empty) so search works, rather
  than paging the catalog. Run `astrato_semantic_layer_refresh_source_catalog` if tables you
  expect are missing.
- If the warehouse already has **Snowflake semantic views**, list them
  (`astrato_semantic_layer_list_snowflake_views`) and consider importing one
  (`preview_snowflake_view_import`, then `import_snowflake_view`): someone has already modelled it.

Before modelling, query a few rows and counts of each candidate table, and write down for each:
what one row is (the **grain**), its keys, its date columns and their range, and which tables it
can join to on which keys. A table you cannot describe in one sentence is not ready to model.

If a table is a **pre-joined warehouse view** (a fact with dimension attributes and derived
columns such as verdicts, labels or sort orders already flattened in), model its base tables as a
star instead and rebuild the derived columns as layer fields, so their logic is governed and
visible in the layer.

If the brief asks for a figure the tables do not hold (a count of visits where there is only an
index, a spend nobody recorded), say so in the data brief. Use the nearest signal under its own
name ("Crowd Index", not "Visits"), and never invent the missing figure in the layer or the app.

## 2. Create the layer and its views

1. `astrato_semantic_layer_create` on the connection, named for the subject, not the app.
2. One **view per table** (or per Custom SQL view when a table needs reshaping), through
   `astrato_semantic_layer_prepare_view_change` / `apply_view_change`. Name views for what a row
   is ("Orders", "Order Lines", "Customers"), not after the table.
3. **Never declare a field's data type.** Let the layer read it from the warehouse, then run
   `astrato_semantic_layer_check_source_schema` until drift is 0
   ([why](../knowledge/semantic-layer.md#field-types-drift-from-the-warehouse)).
4. Give fields business names and a description each. A column only some rows fill gets a
   description that says so.

Never repoint an existing view at another table: it deletes the view's fields
([knowledge](../knowledge/semantic-layer.md#repointing-a-view-deleted-all-its-fields)).

## 3. Joins

- `astrato_semantic_layer_suggest_joins` for candidates, then keep only joins you can state: "each
  order line belongs to one order". Facts join **many-to-one** to the tables that describe them,
  so one filter reaches every fact.
- `astrato_semantic_layer_check_join_quality` on each: unmatched keys and fan-out show here,
  before they show as wrong totals.
- On a shared layer where you may only add, a new many-to-one join is an addition: it changes no
  existing item. Run the existing stored questions after adding it to prove they still return the
  same figures, and say so in the data brief.
- Two facts at different grains (orders and daily stock) join through shared dimension views,
  never directly. See [knowledge](../knowledge/semantic-layer.md#joins-range-joins-fan-out-and-multiple-facts).

## 4. Dimensions, measures, time

- `astrato_semantic_layer_suggest_dimensions` is a starting list, not a result. Keep the
  dimensions the brief needs; add **bands and labels as layer fields**, not warehouse columns.
  Mapping dimensions sort alphabetically, so number their values in the order they should show
  ("1 Early season", "2 Peak") when you create them.
- Measures for every headline, in families: the value, its comparison with the previous period,
  its target where one exists. Ratios are ratios of sums. **Decide the comparison route by where
  the date sits.** If the facts and the date are in one view (the common case), stored
  period-comparison measures fail under any filter on that view (engine 013401), so build
  explicitly filtered measures (this period, previous period, change). Use a **time axis** read
  as of the latest date in the data only when the axis date sits in a separate view readers do
  not filter ([knowledge](../knowledge/semantic-layer.md#this-quarter-is-empty-because-the-data-ends-in-the-past)).
  On weekly data `periodEnd: latest` can also drop the previous period's last week
  ([knowledge](../knowledge/semantic-layer.md#a-season-comparison-drops-the-last-week-of-the-previous-season)):
  there too, filter explicitly.
- Cross-check one comparison measure against the base measure summed by the period dimension
  (year, season) before any comparison becomes a headline.
- Every date dimension gets an explicit date level, and you run it once to check its grain.
- Author everything in **one commit** (`astrato_semantic_layer_commit_authoring_batch`), then
  `astrato_semantic_layer_validate` to 0 errors. Read each error's details before concluding
  your change failed ([knowledge](../knowledge/semantic-layer.md#validate-reports-an-error-your-change-did-not-cause)).
  A derived measure may reference only aggregate measures
  ([knowledge](../knowledge/semantic-layer.md#a-derived-measure-is-refused-or-mixes-aggregates-and-measures)).

## 5. Stored questions, then publish

- Stored questions for the decisions the app supports come in [step 4](4-build.md); if the layer
  will be used without an app, add a few now (`astrato_semantic_layer_suggest_questions` proposes
  some; keep the ones that answer a real question).
- `astrato_semantic_layer_preview_publish` before **every** `astrato_semantic_layer_publish`, not
  only the first. MCP queries and apps read only the published layer.

## Done when

- every view's grain, keys and date range are written down;
- every join has been quality-checked and a cross-fact query returns sensible totals;
- source-schema drift is 0 and validation shows 0 errors;
- the layer is published.

Then [read it](1-read-the-layer.md) as if someone else had built it: the profiling there catches
what modelling missed.
