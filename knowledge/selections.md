# Selections and cross-filtering

How selection groups, filter objects and chart clicks really behave. The patterns
[selection-bar](../patterns/selection-bar.md)
and [preload-tabs](../patterns/preload-tabs.md) hold the working code.

---

## A filter or chart click does nothing

- **Symptom:** picking a value in a filter or clicking a bar highlights it, but no chart re-queries.
- **Cause:** a chart click (and, in some builds, a filter dropdown) writes a **pending** selection;
  nothing filters until `applyPendingSelections(group)` runs. Filter objects and `selectValues`
  in the default mode write straight to applied. A `sankey` click writes straight to applied.
- **Fix:** subscribe to `selections.onActiveSelectionChange(group)` for every group and call
  `selections.applyPendingSelections(group)` with a ~250 ms debounce (each apply re-queries the
  group). Code that routes clicks must also diff the group's applied list against what the app
  wrote itself, so sankey clicks are seen; guard the app's own writes with a flag.
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/10.
- **See also:** [../patterns/selection-bar.md](../patterns/selection-bar.md).

## Charts on governed dimensions or measures do not cross-filter

- **Symptom:** a click on one chart does not narrow the others; requests still return 200; the
  console may show an uncaught *"could not find fieldKey"*.
- **Cause:** chart clicks write the raw column key (`[View].[Field]`). Before applying a group
  selection each chart calls `engine.areFieldsConnected(selected, dataItemField)`, whose index holds
  view columns only. A `[dimension].[X]` or `[calculation].[Y]` key throws, the filter pass aborts,
  and the chart re-queries **without** the selection.
- **Fix:** wrap `hostServices.engine.areFieldsConnected` so it resolves an item key to its columns
  (`engine.databaseInfo.items`: `item.dimension.fieldKey`, or
  `item.calculation.measures[].fieldKeys`) and then calls the original. Install it before mounting.
  Do not resolve through a calculation's own filter columns.
- **Verified on:** visualizations 0.4.0–0.6, sdk 0.4.0, 2026-09/11. Check whether newer versions
  still need it.
- **Current status:** not needed on 0.8. All three examples were run on 0.8.0 without the wrapper and cross-filtered correctly; see [status on 0.8](README.md#status-on-08). This entry explains code you may meet in older apps.

## A KPI `number` (or measure-only object) ignores selections

- **Symptom:** charts narrow, KPI numbers do not.
- **Cause:** measure-only objects take a path that returns false without a `view` on the
  selection, and throws `Cannot destructure property 'view' of 'undefined'` with one.
- **Fix:** any of: (1) mirror the group's applied selections into the object as static filters
  (`setStaticFilterGroup` on its base vSpec, then `updateInstance`; restore the base when empty;
  limit to fields the object's views can join); (2) a one-row table over a hidden constant or
  period dimension; (3) define the number over the raw column + aggregation the calculation is made
  of (not possible for a ratio). Test by selecting one value and checking a KPI, a chart and a
  table all change, then clearing.
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/10.
- **See also:** [../patterns/selection-bar.md](../patterns/selection-bar.md), [tables.md](tables.md#a-table-with-only-measures-never-follows-selections).

## Every chart in a group returns HTTP 400 after a selection set in code

- **Symptom:** after `selectValues`, every object re-queries, gets 400 ("Astrato rejected the
  runtime request"), and **keeps showing its old numbers** with no visible error. On 0.9 the
  charts may filter correctly while every `handle.getData()` / `runtime.getData(id)` export query
  (smoke checks, Excel reports) 400s, and a table can stay blank until reload.
- **Cause:** the runtime forwards selections to the engine verbatim as filters; without
  `operator` the filter is invalid. Selecting on a `[dimension].[X]` key in code is also rejected.
  `{ field, values }` without an operator, the shape the SDK typings suggest, is not enough.
- **Fix:** use the full click shape on the raw column:
  ```js
  selections.selectValues(group, { fieldKey, field: { fieldKey }, kind: 'VALUE', operator: 'inList', values });
  ```
  A filter object shows a code-made selection as selected only when the shape matches its own
  (top-level `fieldKey` included). Log failed queries yourself; objects do not show them.
- **Verified on:** visualizations 0.4.0, 2026-09; the export-query 400 on visualizations 0.9.0
  with the dashboard template, 2026-11-18 (a test run).

## A month dropdown breaks every object on the page

- **Symptom:** after picking a month in a month-grouped filter, every object in the group 400s.
- **Cause:** a filter with temporal grouping writes a selection with `dateLevel: 'month'` on a
  `date` column, which the engine rejects. (An earlier note on the same version recorded
  `dateLevel` as required for the dropdown to show the selection; the engine rejection is the
  later, verified finding.)
- **Fix:** build the date dropdown without temporal grouping (day-level format such as `ddmmmyy`)
  and select with `{ field: { fieldKey }, fieldKey, kind: 'VALUE', operator: 'inList', values }`.
  For month choices, use a month label column. After any selection-shape change, check the
  group's chart queries, not only the control.
- **Verified on:** visualizations 0.4.0, 2026-09.

## A filter object never draws: "Cannot destructure property 'view' of undefined"

- **Symptom:** a `filter` stays `pending`/`timeout`, logs that error, sends no query; or draws but
  logs one uncaught error per selection change.
- **Cause (0.4.0):** a filter could not mount while its group held **any** selection, even its own
  after a reload. **Fixed by 0.5.2:** filters mount into a group that already holds selections.
  Separately, in an Astrato App passing `dataBinding.fieldMetadata` makes charts parse field keys
  in an unexpected format and throw the same error. Some table export queries also log it on
  every selection; filtering still works.
- **Fix:** on 0.4.0, mount controls first, apply default selections only after the filter renders,
  never remount controls. On 0.5.2+, apply defaults before mounting anything. In an App, do not
  pass `dataBinding.fieldMetadata`. Treat the error alone as harmless if filtering works.
- **Verified on:** 0.4.0 (2026-09) and 0.5.2 (2026-10).

## A date window or numeric range as a selection

- **Symptom:** a static date filter is dropped (see [visualizations.md](visualizations.md#a-static-filter-on-a-date-or-timestamp-field-is-silently-dropped)).
- **Fix:** a range selection reaches charts:
  `{ field: { fieldKey }, fieldKey, operator: 'between', values: ['2019-01-01', '2019-12-31'] }`;
  numeric ranges work the same (`values: [lo, hi]`), which drives slider "what-if" thresholds. Two
  `between` selections on start and end dates give "active on date D". Express strict inequalities
  with epsilon bounds.
- **Verified on:** visualizations 0.4.0, 2026-09/10.
- **See also:** [../patterns/what-if-parameters.md](../patterns/what-if-parameters.md).

## One click re-queries every chart, including hidden tabs

- **Symptom:** a click fires dozens of queries and the screen settles seconds later.
- **Cause:** every object in a group re-queries on **any** change to that group, hidden or not, and
  even when the changed field is not connected to it. `selectValues` per field re-queries per field.
- **Fix:** one group per tab (and per toggled variant), mirrored from `main` only while visible and
  on show; seed every group at startup; write clicks back to `main`. Replace a group's state in one
  emission with `selections.setNewSelectionState(group, { applied, pending })`. Skip a mirror whose
  selections already match. Count queries per click: it should roughly equal the visible objects.
- **Verified on:** visualizations 0.5.2, 2026-10 (56 → 25 queries per click on one app).
- **See also:** [../patterns/preload-tabs.md](../patterns/preload-tabs.md), [performance.md](performance.md#one-click-fires-dozens-of-queries).

## The Excel export ignores the filters on hidden tabs

- **Symptom:** the sheet for the tab on screen follows the filter; the sheets for the other tabs
  show unfiltered figures, under a banner that names the filter.
- **Cause:** the fix above. Hidden tabs' groups are mirrored from `main` only while shown, and
  `handle.getData()` runs an object's query with its own group's selections.
- **Fix:** before reading, copy `main` into every tab group and wait for the queries to go quiet;
  or build the export with `engine.getData` and the `main` selections. Register
  `appState.exportProbe` so the smoke test fails any sheet that does not move under a filter.
- **Verified on:** visualizations 0.9.0, 2026-11 (two clean test runs; four of five tab sheets wrong).
- **See also:** [../patterns/xlsx-export.md](../patterns/xlsx-export.md#sync-every-group-before-reading).

## A discarded pending selection keeps coming back

- **Symptom:** filters never apply and clicks toggle themselves off every ~250 ms.
- **Cause:** `removeSelection` leaves a pending selection pending, so the auto-apply loop sees it
  again.
- **Fix:** discard a handled pending selection with `selections.clearPendingSelections(group)`.
- **Verified on:** visualizations 0.5.2, 2026-10.

## A chart should ignore one filter ("this chart ignores the month")

- **Fix:** mirror groups. Keep `main` for the reader's filters; give each exception its own group;
  on every `main` change copy its selections into each mirror minus the ignored fields (renamed when
  the mirror is on another view); hand any click inside a mirror back to `main`. Say so in the
  chart's subtitle: a chart that ignores the clicked field shows no response, and users read that
  as "cannot select". Programmatic writes to `main` may bypass your own subscription guard: run the
  same follow-up (chips, mirrors) after them.
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/10.

## Click and brush behaviour on native charts

- A click or a range replaces that field's values; there is no ctrl/shift additive click.
  `setSelectionMode` is only manual/auto apply.
- A range brush starts on the **axis**, not the plot, and emits a growing pending list on every
  mouse move: do not run toggle logic per step.
- The chart you click narrows to its own selection.
- A `line` emits no click selection on 0.9.0: see
  [visualizations.md](visualizations.md#a-line-chart-does-not-select-on-click).
- A month-of-year click selects every date in that month across years; a combo click on a month
  writes every day as epoch ms. Summarise these as months for display, and give month-of-year
  charts their own date field so exact-date selections stay distinguishable.
- `selections.setFieldLocked({ fieldKey }, true, group)` locks a field (for a fixed scope).
- Astrato's selection-summary objects render blank outside a Workbook; show selections in your own
  UI.
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/11.

## A click on a chart over a Custom SQL view highlights but never selects

- **Symptom:** the bar highlights; no selection, no error. Table views work.
- **Cause:** the runtime resolves the clicked item in a field list filtered to fields with a
  `schema`; Custom SQL view fields have none, so the brush handler returns silently.
- **Fix:** wrap `engine.fields.getFields`, `getValidFields`, `getViewsFields` and
  `getFieldMetadata` to add the datasource schema to such fields, cached per request so object
  identities stay stable.
- **Verified on:** version not recorded, 2026-11.
- **See also:** [semantic-layer.md](semantic-layer.md#custom-sql-view-fields-disappear-or-misbehave).

## A filter-bar chip shows a generated name such as `Group_Name`

- **Symptom:** after a dimension is turned into a mapping dimension (to label blanks or group
  values), its chip in the library filter bar (`astrato-app-filter-bar`) reads the generated
  field name with underscores (`Customer_Region`) instead of the dimension's name.
- **Cause:** a mapping dimension exposes a generated column key (`[View].[Group_Name]`, spaces
  replaced by `_`), and selections made on it carry that key; the filter bar labels the chip from
  it ([semantic-layer.md](semantic-layer.md#mapping-dimensions-sort-alphabetically-and-expose-a-phantom-key)).
- **Fix:** the 0.9.0 filter bar has no operation for chip labels (none of its eight operations
  touches them). Keep plain (non-mapping) dimensions for the fields
  people filter by when the bar's labels matter, or draw your own selection chips
  ([selection bar](../patterns/selection-bar.md)) and name them yourself. Record it as a known
  defect if you keep the mapping.
- **Verified on:** visualizations 0.9.0, 2026-11-18 (a test run; the operation list from the 0.9.0
  operations reference).

## Sharing one selection across Astrato and non-Astrato data

- **Fix:** give the other source's charts the app's real `hostServices.selections` and the same
  governed field keys (`[View].[Field]`); they read `getSelection(group).applied` to build their own
  WHERE. The SDK accepts keys that are not in the layer; governed charts skip them once the
  connectivity patch answers false for unknown keys.
- **Verified on:** visualizations 0.5.2, 2026-11.
