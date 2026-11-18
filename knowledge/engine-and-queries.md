# Engine and queries

Direct queries through `hostServices.engine.getData` (and `data.query`), the request and response
shapes, parameters, and window calculations. Speed and rate limits are in
[performance.md](performance.md).

---

## `engine.getData` returns 400 "Astrato rejected the runtime request"

- **Symptom:** a direct query 400s with that message.
- **Cause:** a filter in the wrong slot or without an operator. Accepted:
  ```js
  { itemKey: '[dimension].[Weekday]', operator: 'inList', values: ['Mon'] }          // governed dimension
  { field: { fieldKey: '[Visits].[Weekday Name]' }, operator: 'inList', values: ['Mon'] } // raw column (0.4; flat on 0.9, below)
  { field: { fieldKey }, operator: 'between', values: [from, to] }                   // range (0.4)
  ```
  Rejected: an item key in the raw slot (`field: { fieldKey: '[dimension].[X]' }`), `{ fieldKey,
  values }` with no operator, `field: { itemKey }`, `field` as a string, operators `in`, `equals`
  and `isBetween`. Numbers pass as numbers. Date bounds can be strings or
  `{ dataType: 'date', valueDate }`.
- **Fix:** decide the slot by looking the key up in the field catalogue (`kind !== 'field'` →
  `itemKey`), never by parsing the bracket string. A drill-through dimension cannot be a query
  dimension: use its `dimension.group.fieldKeys`. A mapping dimension in a raw query needs its
  generated column key (`[View].[Field_Name]`, spaces → `_`).
- **Also rejected (0.9, 2026-11):**
  - A query **dimension** sent as `{ fieldKey: '[dimension].[X]' }`. Send governed dimensions as
    `{ itemKey, label }`, the shape the charts send (`examples/labour-market-pulse/project/src/app.js`).
  - A governed **calculation** sent with `calculation: '{m1}'` when the measure's formula is
    anything else (`'{m1} / {m2}'`, `'{m1} - {m2}'`). Send the measure's own formula,
    `availableField.item.calculation.calculation`, as the charts do; `'{m1}'` only fits measures
    defined as exactly that. Several examples' helpers still send `'{m1}'` and query only such
    measures; copy labour-market-pulse's.
  - A `contains` filter. Group by a stored dimension instead.
  - Any selection written with no operator, which reaches the engine as such a filter. Wrap the
    engine so it adds `inList` (`examples/superstore-explorer/project/src/app.js`, `withOperators`).
  - Integer fields filtered with string values: keep `2022`, not `'2022'`.
- **Filter shape by field kind on 0.9:** `engine.getData` hands `query.filters` to the engine
  untouched (app-runtime 0.8.0 and 0.9.0), so pick the shape yourself:
  | Key | Send | Evidence |
  |---|---|---|
  | Raw view column (`kind: 'field'`, or a dimension's `item.dimension.fieldKey`) | `{ fieldKey, operator, values }` | What chart selections send, and what app-runtime 0.9's question API rewrites every filter to; worked in a 0.9 build |
  | Mapping dimension | its generated column key, same flat shape | Worked in the same build; `[dimension].[X]` as a selection key is not accepted by plain measures |
  | Governed dimension `[dimension].[X]` | its raw column, flat shape | The `itemKey` form above is only verified on 0.4 |
  | Raw column as `{ field: { fieldKey }, … }` | avoid | Still used by several 0.9 examples without error, but a 0.9 build got HTTP 400 for it on raw columns and the flat shape cleared that; not isolated (the same build hit period-comparison 400s) |

  Copy `examples/league-table-planner/project/src/app.js` (`historyOf`).
- **Verified on:** sdk 0.4.0, 2026-09/10; visualizations 0.9.0, 2026-11 (flat shape: app-runtime
  0.9.0, 2026-11).

## `getData` refuses: "must target the configured semantic layer"

- **Fix:** send the same envelope the charts send: `{ ...dataBinding (minus fieldMetadata and
  queryContext), context: queryContext, query }`.
- **Verified on:** version not recorded, 2026-09.

## How to ask for governed measures, ad-hoc measures and month grouping

```js
query: {
  dimensions: [{ fieldKey, label, dateLevel: 'month' }],           // month grouping
  calculations: [
    { calculation: field.item.calculation.calculation, itemKey: field.fieldKey, label: 'Revenue' }, // governed: the measure's own formula
    { calculation: '{m1}', measures: [{ fieldKeys: [col], aggregation: 'MAX', filters: [] }] } // ad hoc
  ],
  limit: 100,
}
```

- Distinct counts: `aggregation: 'COUNT_DISTINCT'` (there is no `distinct` key in visualization
  definitions).
- "Latest month" for defaults: an ad-hoc `MAX` over the month column.
- Direct queries are also a profiling route when your MCP connection lacks `data:query`.
- **Verified on:** sdk 0.4.0, 2026-09.

## The response is not an array, and dates are numbers

- **Symptom:** `rows.map` fails; dates look like `1730419200000` or `"20260930"`.
- **Cause:** the response is `{ fields, data, meta, timezone }` with `data` an **object keyed by
  stringified index** (`{ '0': [...] }`). Dates come back as epoch ms, sometimes as numeric strings.
  There is no `statement` or query id, `getLastQueryMetadata` is empty, and `getQueryInsights`
  answers "route does not exist".
- **Fix:** normalise rows and dates in one helper (`/^\d+$/` → number → date). For a "show SQL"
  panel, capture the SQL from an MCP dry run of the same question offline. One app observed
  `orders` being ignored and a 2,000-row cap: rank client-side and filter to stay under it.
- **Verified on:** sdk 0.4.0, 2026-09/11.

## Which chart sent this query?

- **Cause:** chart requests carry dimensions, measures, filters, orders and limit, but no object
  or group id; a selection just appends `{ operator: 'inList', values, fieldKey }`.
- **Fix:** match queries to objects by field-key set + limit + measure count, or patch the runtime
  to pass an object id. The same fact enables prefetching: latest request per chart shape × each
  filter value, when idle.
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/10.
- **See also:** [../patterns/query-scheduler.md](../patterns/query-scheduler.md).

## Which operator names does each surface accept?

The same idea has different names on different surfaces. Using another surface's name fails, often
with `Invalid input` and no field named.

| Surface | Names that work | Refused |
| --- | --- | --- |
| Definition `filters`, static filters | `equals`, `doesNotEqual`, `inList`, `excludedFromList`, `isBetween`, `isNotBetween`, `greaterThan`, `greaterThanOrEqualTo`, `contains`, `like` (`*` wildcard), `isNull`, `notNull` | `notEquals`, `in` |
| Selections | `inList`, `between` | missing operator |
| `engine.getData` filters | `inList`, `between` | `in`, `equals`, `isBetween` |
| Stored business-question filters | `equals`, `notEquals`, `inList` (one `{ value }` argument per item), `greaterThan`, `greaterThanOrEqual`, `set` | `in` |
| Measure input filters (authoring) | snake_case: `not_equals`, `less_than_or_equal`; `equals`/`in` on a flag column | camelCase `notEquals`, `greaterThanOrEqual` (refused on one deployment) |
| Relative periods (authoring) | snake_case with digits: `last_30_days` | |

- **Verified on:** visualizations 0.4.0–0.5.2 and MCP tool contract 10.x, 2026-09/11.

## Every tile shows "no data to display" with HTTP 400 or 403

- **Symptom:** every `data/execute/query` fails while field metadata loads fine, so the layer looks
  healthy.
- **Cause:** upstream: warehouse credentials, or a connection the user cannot use. A 403 with
  engine code `13301 Forbidden` on every route is access to the connection, not your definitions.
- **Fix:** run one dimension-only query through MCP; the real warehouse error surfaces there in
  full. Do not debug definitions until that query succeeds.
- **Verified on:** 2026-09.

## Concurrent queries randomly fail on some warehouses

- **Symptom:** identical requests sometimes return 400 `invalid_request` and succeed alone.
- **Cause:** seen on a ClickHouse source that rejects concurrent queries.
- **Fix:** put every engine query through a single lane with one retry for that source.
- **Verified on:** 2026-09.

## Date filters fail in the warehouse

- **Symptom:** a filter on a timestamp column errors in Snowflake (cannot parse `YYYY-MM-DD`
  against `timestamp_tz`); a pivot query holding a DATE column 400s on BigQuery.
- **Fix:** filter on an integer date key or a string date label; give date filter values
  `dataType: 'date'`; fall back to a flat table when a pivot holds a date column.
- **Verified on:** 2026-09/10.

## Nested static filter groups disappear

- **Cause:** the runtime drops nested static `filterGroup`s.
- **Fix:** if you need nesting, re-inject the engine-form tree (`{ filters, filterGroups, or }`)
  in a `getData` wrapper.
- **Verified on:** visualizations 0.5.2, 2026-10.

## A relative-period measure returns null in a direct query

- **Symptom:** a dynamic date calculation (last 12 months) returns null on every row in a direct
  `getData` grouped by the raw date.
- **Fix:** query the plain measure by date and bucket client-side, or group by the axis the measure
  was defined on.
- **Verified on:** 2026-10.

## Passing parameters to native objects and direct queries

- **Measure parameters** (a parameter used in a measure's filter): bind per object with
  `setMeasureDefinedParameter { dataItemInternalKey, dataItemUniqueSignature, parameterName, value:
  { type: 'static', value } }` before mount, then `updateInstance` on change. Queries carry
  `namedParameters`.
- **View parameters** (`{param:type}` in a view): set
  `vSpec.querySettings.viewStatesParameters = { user_tz: { value, dataType: 'string' } }` and
  `updateInstance`; the runtime sends `filterParameters: { '[user_tz].[string]': value }`. Each
  object keeps its own value. Direct `getData` takes `query.filterParameters`.
- **Limits:** table mini-charts do not receive view parameters; MCP cannot set them (stored
  questions run at defaults); workbook variables are not reachable from the SDK; some direct
  `getData` paths cannot pass a measure parameter, so query base measures instead. A measure that
  references a parameterised measure hides the parameters (see
  [semantic-layer.md](semantic-layer.md#a-derived-measure-is-stuck-at-parameter-defaults)).
- **Verified on:** visualizations 0.5.2, 2026-10/11.
- **See also:** [../patterns/what-if-parameters.md](../patterns/what-if-parameters.md).

## Window calculations (diff, growth, running total) give the wrong rows

- **Facts:**
  - `setMeasureAdvancedCalculationType` takes `value | diff | ratio | growth | apg | cagr |
    nestedCalculation | nestedRatio | nestedCorrelation` (plus `total`, `shareTotal`, rank and
    running variants), with `setMeasureAdvancedOffset`.
  - Offset is in **sort order**: on a descending period sort, offset 1 is the previous period;
    −1 gives the wrong sign. On ascending monthly rows, YoY is offset −12.
  - In a table the window runs along the **first** dimension, partitioned by the rest. `value` at
    offset 1 is the previous period's value.
  - The window runs **before** LIMIT, so `queryLimit: 1` on a descending period keeps the change.
  - **0.9, many-row tables:** in the report-builder example, a date row sorted descending with
    offset +1 or +12 returned null on every row; sorted **ascending** with offset −1 (previous) or
    −12 (same month last year) worked, partitioned by the other rows when the date is the first
    column. One-row KPI change tables on a descending sort at offset 1 still verify on 0.9
    (royalty-close, agency-client-reporting). For a new many-row comparison, sort ascending, use a
    negative offset, and check one value by hand
    (`examples/report-builder/project/src/report.js`).
  - **Two columns on the same measure** (a figure and its change): format operations match a
    column by its label, not its custom label, so give the copy its own name with `setColumnLabel`
    first, then format it by that name; a `format` in the definition on both columns leaves both
    with the last one.
  - `ratio` + `setMeasureAdvancedCompareMeasure` did not produce a ratio (rendered the raw sum).
  - Rank direction: `setMeasureAdvancedRankSortDirection { rankSortDirection: 'desc' }`.
  - Control limits: `total` with aggregation `CONTROL_VALUE` + `setMeasureAdvancedStandardDeviations`
    (0 = mean, ±k = limits); `shareTotal` with `OUTLIERS` returns the distance beyond ±kσ.
    `interGroup` STDDEV is rejected.
- **Verified on:** visualizations 0.4.0, 2026-09.
- **See also:** [../patterns/kpi-sparkline-comparison.md](../patterns/kpi-sparkline-comparison.md).

## A chart without an Astrato session (fake engine)

- **Use:** offline demos, tests, or charts over another engine (DuckDB-WASM, an API).
- **Shape:** `client = { hostServices: { engine, selections, variables } }`.
  `engine.getData(req)` returns `{ response: { fields, data: { '0': [...] }, meta: { rows, cols },
  timezone } }`. `variables: { getVariables: async () => [] }` is **required**: without it the chart
  silently enters an error state and never queries. Supply
  `instance.dataBinding.fieldMetadata = { fields, validFields, viewsFields, measures, dimensions,
  groupedDimensions }`; numeric `dataType` is `float`/`int`/`decimal`; measures are
  `{ type: 'calculation', key: '[calculation].[X]', calculation: { calculation: '{m1}', measures:
  [{ fieldKeys, aggregation: 'SUM' }] } }`. Refresh by emitting on
  `onActiveSelectionChangeApplied(group)`; throttle refreshes to ~350 ms.
- **Debug:** internal loggers are gated; add a temporary `console.error` at the
  `emitEvent(VISUALIZATION_STATE, { state: ERROR })` sites in the vendored chunks, then revert.
- **Verified on:** visualizations 0.5.2, 2026-09/10.

## An ad-hoc measure over MCP is refused

- **Symptom:** `astrato_data_execute_query` refuses an aggregate written inline as a measure.
- **Fix:** declare it under `query.local.measures` with a `resultType`, then select it by name:
  ```json
  { "local": { "measures": { "n": { "resultType": "number", "expression": "{m1}",
      "m1": { "aggregate": "COUNT", "distinct": true, "arguments": [{ "reference": { "view": "V", "field": "Id" } }] } } } },
    "dimensions": [], "measures": [{ "key": "n", "reference": { "measure": "n" } }] }
  ```
  Raw view fields in a query may be refused when they are not stored items ("not in the published
  revision"); profile through stored dimensions and measures where you can.
- **Verified on:** MCP contract 10.37–10.38, 2026-11.

## `getData` with a stored dimension's key: "Astrato rejected the runtime request"

- **Symptom:** a direct `engine.getData` fails with that 400 as soon as it groups by a stored
  dimension.
- **Cause:** the query's dimension slot wants the view column key, not the stored dimension's
  `[dimension].[…]` key.
- **Fix:** use the column behind it: `item.dimension.fieldKey` from the field catalogue.
- **Verified on:** sdk 0.7.0, visualizations 0.9.0, 2026-11.
