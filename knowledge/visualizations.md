# Visualizations: definitions, operations and chart types

`@astrato/visualizations` behaviour that the docs do not state. Tables have their own file
([tables.md](tables.md)); colours and fonts are in [theming.md](theming.md); mounting, sizing and
hidden-tab behaviour are in [rendering.md](rendering.md).

Before guessing, read the schema from the page (pure local calls, no engine requests):

```js
getVisualizationDefinitionDescriptor('bar').jsonSchema            // definition keys
getVisualizationMetadata('bar').operations.names                   // every operation, print all
getVisualizationMetadata('bar').operations.items.find(o => o.name === 'setInvertAxis').payloadSchema
```

`/definitions` and `/metadata` need browser globals at import time, so they cannot be read from
Node. Expose them on `window` in dev.

---

## A definition fails with `invalid_structure: Invalid input` and names no field

- **Symptom:** `compileVisualizationDefinition` rejects with `invalid_structure` (`zodCode:
  unrecognized_keys` or `invalid_union`), often at path `[]`.
- **Cause:** one of: a `formatType` outside the closed enum (there is no `money`, `percent`,
  `number` or `date`); a top-level key the type does not support (`scatter` and `combo` take no
  `limiting`/`sorting`; `sankey` takes `data` only); a value of the wrong shape.
- **Fix:** print `issue.path` from the result, the only clue. Check the type's top-level keys in
  `jsonSchema.properties` before adding `limiting`, `sorting` or `presentation`. Valid numeric
  formats: `none`, `custom`, `inherit`, `defaultNumber`, `defaultMoney`,
  `number{No,1,2}Decimal`, `abbreviation{Auto,No,1,2}Decimal`, `percentage{No,1,2}Decimal`,
  `money{0,2}Decimal` (+ `currency`, `currencyIsPrefix: true`), `duration{Days,Hours,Minutes,Seconds}`.
  Bisect a failing definition by setting dimension formats to `none` first.
- **Verified on:** visualizations 0.4.0, 2026-09.
- **See also:** [Dimension formats](#formatter-type-number-is-not-allowed-for-this-data-item).

## `applyOperations` reports success but nothing changed

- **Symptom:** an operation "applied", the chart looks the same; or every operation looks applied.
- **Cause:** `results` is an **object keyed by request id**, not an array, so `results[0]` is
  `undefined` and rejections look like success. Payloads are also not validated at apply time:
  `setBarChartLayout: 'stacked100'` succeeds and does nothing. A malformed payload returns
  `success: false` in the result rather than throwing.
- **Fix:** read `Object.values(outcome.results)` and check `.success`/`.error` on each. Check
  every payload against `operations.items[].payloadSchema`; shapes are not consistent across
  operations (`setInvertAxis` takes `{ invertAxis: true }`, `setColoringPersistentColors` takes a
  bare boolean, `setCustomPaletteColors` takes `{ colors: [...] }`). Record refused operations
  per object (for example on `window.__opFailures`) so they are visible.
- **Verified on:** visualizations 0.4.0, 2026-09; still true on 0.5.2.

## An operation is skipped or throws after a package upgrade

- **Symptom:** after 0.4 → 0.5, filtered charts query unfiltered data (KPI tables show two rows),
  or `Unsupported operation for bar: setMeasureDataLabelTextColor`.
- **Cause:** 0.5 removed `addStaticFilter` (replaced by `setStaticFilterGroup`, which is not a
  rename) and removed `setMeasureDataLabelTextColor`/`setMeasureDataLabelIsColored` on `bar` and
  `heatMap`, and `setMeasureDataLabelShowBackdrop` on `heatMap`. Code that filters requests
  against `operations.names` drops the old names silently.
- **Fix:** after any bump, log the *skipped* operations per tile, not only the failed ones.
  Static filters from 0.5:
  ```js
  { name: 'setStaticFilterGroup', payload: { operator: 'and', filters: [
      { fieldKey, operator: 'isBetween', values: { valueFrom: '7', valueTo: '18' } } ] } }
  ```
  One call replaces every static filter; values are strings; groups can nest.
- **Verified on:** upgrade 0.4.0 → 0.5.2, 2026-09.
- **See also:** [Static filter on a timestamp is dropped](#a-static-filter-on-a-date-or-timestamp-field-is-silently-dropped).

## Should operations be applied one at a time or batched?

- **Symptom:** theming a page takes tens of seconds; or one bad operation abandons the rest.
- **Cause:** older guidance (0.4.0, early 2026-09) said batches are not transactional and a throw
  mid-batch abandons the rest, so apply one per call. Later measurement on the same version: a
  batch keeps going past a *rejected* request and reports each in `results`; one at a time costs
  ~25 ms per op, batched ~5–7 ms per op.
- **Fix (current):** batch all operations per object in one call; fall back to one-by-one only if
  the call throws. Apply them to the compiled vSpec **before mount**
  (`applyOperations({ instance: { id, type, vSpec, dataBinding }, availableFields, operationRequests })`):
  that costs zero engine requests. The same operations after mount cost one engine request each
  (a line chart took ~22). Compile and theme tiles with `Promise.all`, not serially.
- **Verified on:** visualizations 0.4.0, 2026-09.
- **See also:** [performance.md](performance.md#page-load-is-slow-before-any-data-arrives).

## Operations need data-item keys and fail with "Invalid payload"

- **Symptom:** a column, measure or dimension operation fails `Invalid payload`.
- **Cause:** operations that target one item need its keys (`dataItemInternalKey` +
  `dataItemUniqueSignature`), which only exist in `compileVisualizationDefinition(...).resolvedRefs`
  and change on every compile. Some column operations nest them differently (`dataItem.internalKey`
  / `dataItem.uniqueSignature`); read the op's `payloadSchema`.
- **Fix:** keep the compile result with the tile and pass `{ ...tile, ...compileResult }` to the
  theming step in the same run. Never persist the keys.
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/10.

## `Formatter type number is not allowed for this data item`

- **Symptom:** an operation fails with that message, though the definition passed validation.
- **Cause:** dimensions (and `role: 'dimension'` table columns) accept only `none` or a date format.
- **Fix:** put numeric formats on measures only. For a numeric category (a year), use a text
  column or a date dimension.
- **Verified on:** visualizations 0.4.0, 2026-09.

## A date axis shows 13-digit numbers (epoch milliseconds)

- **Symptom:** axis labels or table cells read `1730419200000`. Text checks pass because canvas
  labels are not DOM.
- **Cause:** a `date`/`timestamp` dimension compiled with `formatType: 'none'`; the renderer falls
  back to epoch ms. A helper that indexes catalogue fields and drops `dataType` hides which
  dimensions are dates. The definition schema refuses date formats on some items, and month/quarter
  formats are refused (`Format type mmmyyyy is not allowed for this data item`) on a date item
  that has no temporal grouping.
- **Fix:** keep `dataType` when indexing fields. For date dimensions emit
  `temporalGrouping: { mode: 'level', dateLevel: 'month' }` plus `format: { formatType: 'mmmyyyy' }`.
  As operations: `setDimensionTemporalGrouping { mode: 'level', dateLevel }` **then**
  `setDimensionFormatType`. Table columns over date items accept day-level formats only
  (`ddmmmyy`, `ddmmyyyy`, `defaultDate`) via `setColumnFormatType`. Without grouping, on a
  `timestamp_tz` dimension `yyyymm`, `yyyymmdd`, `ddmmmyyyy`, `month`, `month2`, `quarter`,
  `defaultDate` work while `mmmyyyy`, `yyyyq`, `yyyy`, `mmyyyy` fail. Screenshot one date axis
  before calling an app done.
- **Verified on:** visualizations 0.4.0, 2026-09; 0.4.x/0.5.2 apps, 2026-11.
- **See also:** [tables.md](tables.md), [rendering.md](rendering.md#canvas-text-passes-every-text-check).

## Weekday or month names in calendar order

- **Symptom:** Mon–Sun or Jan–Dec come out alphabetically.
- **Cause:** a `part` format only labels, it does not group; mapping dimensions sort alphabetically.
- **Fix:** date dimension + `setDimensionTemporalGrouping { mode: 'part', datePart: 'dayofweekiso' }`
  + `setDimensionFormatType 'dayOfWeek'` ("Monday"…). For Jan–Dec across years use
  `datePart: 'month'` + `month2`. `level` truncates (years stay apart); `part` extracts. Short
  weekday names are not available (custom format refused on a date part); use a sortable label
  column ("1 Mon") instead. Tables have no temporal grouping.
- **Verified on:** visualizations 0.4.0, 2026-09.
- **See also:** [Ordering categories](#categories-sort-alphabetically-and-the-order-matters).

## A custom format string renders the wrong text

- **Symptom:** `"vs LY "+0.0%` renders as "s LY …"; `CHF #,##0` ignores the prefix; a `number`
  shows a signed format wrongly; a rate cannot show as points.
- **Cause:** letters in a format string are parsed as tokens; `number` ignores multi-section
  signed formats (`+£…;-£…`); format strings cannot scale by 100.
- **Fix:** quote literal text: `"CHF "#,##0.0,,"m"`, `0.0" mins"`, `"("#,##0")"`. Avoid letters
  that are tokens even inside labels if they misrender (use `Δ LY`). Compile with
  `format: { formatType: 'custom' }`, then `setMeasureFormatString` (charts, `number`) or
  `setColumnFormatType custom` + `setColumnFormatString` (tables; `setMeasureFormatString` is
  unsupported there). For "+3.7 pts" add a measure that multiplies the rate by 100.
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/10.

## The legend will not hide, or hiding it fails validation

- **Symptom:** `presentation.legend.visible: false` has no effect, or `pie`/`line` fail final vSpec
  validation; a line with `legend: false` plus a legend position fails.
- **Fix:** compile with the legend visible, then `setLegendEnabled: false`. Omit
  `legendPosition` when the legend is off. A bottom legend paginates with arrows below about
  330px of width; shorten series labels or put it on the right.
- **Verified on:** visualizations 0.4.0, 2026-09.

## A definition `filters` entry on a number or date field is rejected

- **Symptom:** `invalid_structure` / `invalid_union` at `["filters",0]`; or a filter on an integer
  field compiles (as a string) and then `handle.ready` resolves to a bare `{ status: 'error' }`.
  On 0.9 only the second happens: `filterGroup: { operator: 'and', filters: [{ fieldKey,
  operator: 'inList', values: ['2026'] }] }` on an `int` Year passes the compile check, then
  `handle.ready` is `{ status: 'error' }` with no message, no console error and no failed request.
- **Cause:** in 0.4.0 the definition's `filters` accepted string fields only, for every operator.
  On 0.9 the definition key is `filterGroup` and a non-string field is no longer refused at
  compile time; it fails at render instead (observed in a test run on 0.9.0, 2026-11). The
  examples' `filterGroup` filters are all on string fields, so copying them does not show this.
  Every filter value is a string, and the shapes are strict (`additionalProperties: false`):
  ```
  { fieldKey, operator, value }               equals | doesNotEqual | greaterThan | lessThan |
                                              greaterThanOrEqualTo | lessThanOrEqualTo | contains |
                                              excludes | like | notLike | startsWith | endsWith
  { fieldKey, operator, valueFrom, valueTo }  isBetween | isNotBetween
  { fieldKey, operator, values: [...] }       inList | excludedFromList
  { fieldKey, operator }                      isNull | notNull
  ```
- **Fix:** filter on a text column: a string twin of the number or date (`Fiscal Year = FY2026`
  rather than `Year = 2026`; add one in the layer if it is missing). When a tile mounts with a
  bare error, remove its static filters one at a time to find the non-string one. Or apply a
  static filter as an operation (`addStaticFilter` in 0.4, `setStaticFilterGroup` from 0.5) with
  string values: `isBetween` on an integer column worked in 0.4.0; `inList` on an integer column
  broke rendering in 0.4.0, as it does in a 0.9.0 definition. On 0.9.0 an `isBetween` static filter
  on an `int` Year rendered correctly in a heat map, so on an integer field prefer a range to an
  exact `inList` (a one-value range, from = to, is untested). `filters:
  undefined` also fails: spread optional filters conditionally, and return no definition at all
  when a filter that makes the tile correct cannot resolve. `like` uses `*` as the wildcard, not `%`.
  Static filter values can bind a runtime variable: `{ type: 'variable', variableName }`.
- **Verified on:** visualizations 0.4.0, 2026-09; silent render error on 0.9.0, 2026-11; `isBetween`
  on an `int` field rendering on 0.9.0, 2026-11-18 (a test run).
- **See also:** [engine-and-queries.md](engine-and-queries.md#which-operator-names-does-each-surface-accept).

## A static filter on a date or timestamp field is silently dropped

- **Symptom:** the chart shows every period; the captured request has no filter.
- **Cause:** static and measure filters on a timestamp field are dropped before the query is sent,
  in every value format; filters on a raw date column via a mapping dimension behave the same.
- **Fix:** filter on an integer date key (`yyyymmdd`) with `isBetween`, or express the window as a
  `between` **selection** in a group, which does reach the engine.
- **Verified on:** visualizations 0.4.0 and 0.5.x, 2026-09/10.
- **See also:** [selections.md](selections.md#a-date-window-or-numeric-range-as-a-selection).

## A static filter on a Custom SQL view column breaks the object

- **Symptom:** a chart or table over a Custom SQL view errors within ~300 ms and sends no query
  once a static filter is added.
- **Fix:** create a governed dimension over the column and filter on its key
  (`[dimension].[Name]`), preferably a string flag rather than a 0/1 integer.
- **Verified on:** version not recorded, 2026-11.
- **See also:** [semantic-layer.md](semantic-layer.md#custom-sql-view-fields-disappear-or-misbehave).

## `addMeasureFilter` is accepted but nothing is filtered, or the wrong measure is

- **Symptom:** a per-measure filter has no effect, or filters a different series.
- **Cause:** it is sent only for raw-field measures; on a `calculation` (governed measure) it
  succeeds and is never sent. It targets a measure by its visible name, so a raw field that shares
  a governed measure's name gets filtered instead.
- **Fix:** use raw-field measures for measure filters, label each measure first
  (`updateMeasure { changes: { customLabel } }`), and give raw fields names distinct from
  governed measures. For governed comparisons use a period dimension as the series.
- **Verified on:** visualizations 0.4.0, 2026-09.

## A `number` object cannot compare with the previous period

- **Symptom:** the comparison equals the value (or 0); range comparisons do nothing.
- **Cause:** advanced `diff`/`growth` on `number` sends `interRecord` with no dimension;
  `setMeasureAdvancedRangesComparison*` is stored but never sent;
  `addMeasureAdvancedDimensionDataField` succeeds and changes nothing.
- **Fix:** a one-row `table` over a period dimension sorted descending, measure with
  `setMeasureAdvancedCalculationType diff|growth` and `setMeasureAdvancedOffset 1`, `queryLimit: 1`,
  period column hidden. `number` does have a comparison slot (`setComparison*`, icon) for a
  second measure; it lacks a trend slot. Its definition takes `data: { measure }` (singular) and
  no title; it centres text (`setHorizontalAlign: 'left'`).
- **Verified on:** visualizations 0.4.0, 2026-09.
- **See also:** [../patterns/kpi-sparkline-comparison.md](../patterns/kpi-sparkline-comparison.md), [Window calculations](engine-and-queries.md#window-calculations-diff-growth-running-total-give-the-wrong-rows).

## Bars do not start at zero, or the smallest bar has no length

- **Symptom:** 112k/110k/101k render as long, long and a stub; a combo's bars start at 50,000.
- **Cause:** the auto measure axis does not include zero, and compile drops `startsAtZero`.
- **Fix:** after compile, write
  `vSpec.axes.primaryMeasure.axisRange = { axisRangeOption: 'auto', startsAtZero: true }`
  (unsupported, the renderer reads it). `axisRangeOption` takes `auto | minmax | max | min`;
  `'manual'` is silently ignored. `{ axisRangeOption: 'minmax', minValue: 0, maxValue: N }` shares
  a scale across small multiples (0.5.2). On 0.4.0, with no range option known, two invisible
  constant measures (`{ kind: 'value' }` inputs) coloured like the background forced one scale.
- **Verified on:** visualizations 0.4.0 and 0.5.2, 2026-09/11.

## Value labels on bars or heat-map cells do not draw

- **Symptom:** `dataLabels.show: true` in the vSpec, no numbers on the marks.
- **Cause:** labels are dropped silently when the text does not fit the mark. On one 0.4.0
  infographic bar labels never drew at any placement.
- **Fix:** size marks for the label (container width ÷ categories), place labels inside
  (`setMeasureDataLabelBarPlacements` inside, justify 1) or outside then inside, and leave the
  value axis visible as a fallback. Line charts, by contrast, compile with some point labels on:
  send `setMeasureDataLabelsShow false` on sparklines.
- **Bar label colour (0.9):** `bar` has no data-label text-colour operation (only `line` and
  `scatter` list `setMeasureDataLabelTextColor`; [removed from bar in
  0.5](#an-operation-is-skipped-or-throws-after-a-package-upgrade)), so dark labels inside a dark bar are hard to
  read, and labels placed `outside` drop the longest bar's value. Keep labels inside and give them
  a light backdrop: `setMeasureDataLabelShowBackdrop { showBackdrop: true }` +
  `setMeasureDataLabelBackdropColor { backdropColor: '#FFFFFF' }`.
- **Verified on:** visualizations 0.4.0, 2026-09; bar label colour on 0.9.0, 2026-11-18 (a test
  run; operation lists read from the package).
- **See also:** [Dark labels](theming.md#chart-labels-are-unreadable-on-a-dark-background).

## Line charts draw steps, or reject `linear`

- **Symptom:** monthly data draws as a staircase; `setLineType 'linear'` is rejected.
- **Fix:** `setLineType` takes `curve | straight | square`; compiled lines default to `square`.
  Send `straight` on every line. `setLineChartType` takes `line | area | stacked`; area fills are
  a neutral grey whatever the series colour, and palette alpha is ignored for fills.
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/10.

## A line chart does not select on click

- **Symptom:** clicking a line's points, the line or its axis labels leaves the selection group
  empty; a `bar` on the same date field writes a pending selection.
- **Cause:** on 0.9.0 the line renderer turns axis brushing off (`disable.brushingAxis: true`), and
  no `line` operation enables selection. Clicks on points emitted nothing on a string or a date
  axis (observed in a test run on 0.9.0, 2026-11).
- **Fix:** where a trend must filter the page on click, draw it as a `combo` with the monthly
  measure as bars and the running total or trend as a line (clickable through its bars), or as a
  `bar`. Combos of bars and a line over a month: `x-trend` in
  [people-intelligence](../examples/people-intelligence/project/src/catalogue.js) and `c-kpi` in
  [portfolio-os](../examples/portfolio-os/project/src/catalogue.js). Where a line stays a line,
  say on the page that it does not filter on click.
- **Verified on:** visualizations 0.9.0, 2026-11.
- **See also:** [selections.md](selections.md#click-and-brush-behaviour-on-native-charts).

## Layout enums and the missing 100% stack

- **Fix:** `setBarChartLayout`: `stacked | groups | offset | pyramid | bars`. Two dimensions
  default to `stacked`, and on 0.9 so do several measures on one dimension (Revenue + Budget +
  Last year drew as one stacked bar in a test run on 0.9.0, 2026-11): send `groups` for clustered
  whenever there is more than one measure or dimension. Which layouts a bar accepts depends on its
  enabled dimensions and measures, and others are refused with `Layout "…" is not available for
  N dimension(s) and M measure(s)`: 1 dimension and 1 measure → `bars | offset`; 1 dimension and
  2+ measures, or 2 dimensions and 1 measure → `stacked | groups | pyramid`; any other mix with
  more than one of either → `stacked | groups`. So never send `stacked` or `groups` to a
  one-measure, one-dimension bar. There is no 100% layout: build a share measure
  (input option `scope: 'total'`) over a one-value dimension and stack it.
  `setBarChartOrientation`: `vertical | horizontal`. `setPieChartType`: `pie | donut`.
  `setInvertAxis` reverses the **dimension** axis (time runs newest first), not the measure axis;
  no operation flips a measure axis, so a rank "1 at top" cannot be drawn.
  A `bar` needs at least one dimension; for a single bar use a one-value dimension.
- **Verified on:** visualizations 0.4.0, 2026-09; layout rules read from the 0.9.0 source, 2026-11.

## A waterfall: `waterfall` is measures-only

- **Symptom:** the `waterfall` type will not take a dimension; there are no colour or total
  operations.
- **Fix:** for a bridge across categories use `bar` + `setBarChartLayout 'offset'`. A measures-only
  `waterfall` definition is `{ version, type, data: { measures } }` and accepts
  `setOrientation 'horizontal'`; set `colors: { positive, negative, subTotal }`, `total: { enabled,
  label, showDataLabel, color }` on the vSpec after compile (unsupported). A measures-only object
  needs the static-filter mirror to follow selections.
- **Verified on:** visualizations 0.4.0, 2026-09; vSpec patch 2026-11.
- **See also:** [../patterns/offset-bar-waterfall.md](../patterns/offset-bar-waterfall.md).

## Sorting by a hidden measure fails with "length mismatch"

- **Fix:** `addSupportingMeasure` (e.g. MIN of a weekday number), `toggleSortingItem`, then
  `changeSortOrderAndDirection` listing **every** entry of `vSpec.querySettings.sortingOrder`,
  disabled ones included. `heatMap` has no supporting measure. `combo` rejects
  `sorting`/`limiting` in the definition and silently ignores them as tile options: apply
  `changeSortOrderAndDirection` + `toggleSortingItem` + `setQueryLimit` as operations.
- **Verified on:** visualizations 0.4.0 (2026-09), combo 2026-11.

## Categories sort alphabetically and the order matters

- **Cause:** mapping-dimension values sort alphabetically, never in group order; expandable tables
  sort each level A→Z regardless of sort operations.
- **Fix:** prefix labels (`1 Mon`, `00-03h`, `01.Sales`) or sort by a supporting measure. Where a
  prefix must be invisible, prefix with zero-width characters that sort by code point (see
  [tables.md](tables.md#an-expandable-table-ignores-sort-hide-and-width-operations)); selections
  then need the prefixed value.
- **Verified on:** visualizations 0.4.x, 2026-09/11.

## Scatter: no limit, no bubble size, huge points, no gridlines

- **Symptom:** `limiting` rejected; a third measure compiles but every bubble has the same radius;
  `setPointSize 5` draws blobs; no gridline or quadrant operations.
- **Cause:** `scatter` has no size role or size operations; `setPointSize n` is stored as n/10;
  a second dimension colours and labels by that dimension.
- **Fix:** proportional symbols are not possible; use `setPointSize 1` for thousands of points.
  Gridlines: draw thin `referenceAreas` on the vSpec (`{ id, xMin, xMax, yMin, yMax, fillColor,
  border: { enabled: false } }`, all four bounds required). Quadrants: overlay HTML using the
  axis bounds. `presentation.axes` takes only `primaryMeasure`/`secondaryMeasure`.
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/11.

## Reference lines, targets and markers

- **Symptom:** no reference-line operation; no reference lines on scatter; no date-range markers.
- **Fix:** write `vSpec.refLines = { y: [{ value, stroke, strokeWidth, label }], x: [{ value:
  <category label>, stroke, label: { text, vAlign, align, fontSize, fill } }] }` before mount or
  via `runtime.updateInstance(id, { vSpec })` (works on line charts; values are fixed, so query the
  governed value and push it). Lines with reference lines need `legend: false`. Alternatively draw
  a line from a measure `{agg}*0 + {param}` on the same view.
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/10.
- **See also:** [../patterns/reference-lines.md](../patterns/reference-lines.md).

## Combo chart limitations

- `setComboMeasureGraphType { graphType }` takes `line | bar | point` only (no area; an area hero
  is `line` + `setLineChartType 'area'`). `point` did not draw in one build.
- A combo ignores gradient colouring (draws black bars) and `setMeasureLineStyle` (no dashes:
  use `line`). Secondary axis: `changeMeasureAxis { secondaryAxis: true }`.
- A chart takes at most 10 measures; measures toggled off with `enabled: false` must come last,
  or every later series' colour shifts.
- A combo measure in a definition refuses `dataPointShape`; only `line` measures take it (a line
  needs it on every measure for visible data labels). Copying a line's measures into a combo
  fails the compile check.
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/11; `dataPointShape` on 0.9.0, 2026-11.

## Changing a filter or parameter on a mounted chart

- **Fix:** rebuild the vSpec, re-apply only the changed operation to the stored themed vSpec, and
  call `runtime.updateInstance(id, { vSpec })`: it re-queries in place, keeps colours and needs no
  remount. Re-theming every tile on a period switch took 31 s; re-applying one parameter op took
  0.6 s. Make refreshes latest-wins per object (a sequence number), or a slower older recompile
  overwrites a newer one.
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/10.

## Product gaps to design around

- No native map object (checked through 0.6.3); draw a scatter of lon/lat over a tile layer.
- `gauge` is a radial progress ring: no bands, thresholds or needle.
- `heatMap` draws circles; square cells only via `vSpec.heatMapSettings.shape: 'square'` with
  `minSize`/`maxSize` as fractions 0–1 of the cell (unsupported).
- No annotation layer; no operation for axis font size, label tilt (`labelOverlap` takes only
  `auto | show-last`), category label wrapping, or moving horizontal-bar labels. Horizontal bars
  clip long labels: prefer vertical bars or HTML labels.
- Pie labels truncate when the ring fills the plate and have no position op; put the figure in an
  HTML overlay at the centre of a donut.
- Index (rebase to 100) chart settings are not in any published package as of 0.6.4 (2026-11);
  rebase in the layer instead.
- `atomic-input` compiles but cannot be mounted.
- **Verified on:** visualizations 0.4.0–0.6.4, 2026-09/11.

## `filter` objects: label, size and preset filters

- The dropdown label is `vSpec.dimensions[0].label` (set it to "All" or a reader-facing name).
  The filter operations have no label operation; this direct vSpec write is still true on 0.9.0
  (2026-11).
- A filter definition rejects `filterGroup` ("Unrecognized key"); apply
  `setStaticFilterGroup` as an operation to restrict its values.
- `presentation.mode` must be `dropdown` or `listbox`. In a short slot set
  `presentation.responsive: false` and an explicit size via `setFilterFontStyle`, or the open list
  inherits tiny type.
- For mount order and selection-shape problems see [selections.md](selections.md#a-filter-object-never-draws-cannot-destructure-property-view-of-undefined).
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/11.

## `Unknown visualization instance` / every chart mounts twice

- **Cause:** React StrictMode double-invokes effects; operations that land after the first
  teardown fail.
- **Fix:** do not wrap the app in StrictMode.
- **Verified on:** visualizations 0.4.0, 2026-09.

## Compile fails for every tile because of one field, or "Invalid available field"

- **Symptom:** every definition fails validation; or `createVisualizationAvailableFields` throws
  "Invalid available field".
- **Cause:** one catalogue entry with `resultType: "unhandled"`, or scratch/odd fields in the
  layer, poison the whole list. In hand-built metadata, numeric fields must have `dataType`
  `float`, `int` or `decimal`; `'number'` is invalid.
- **Fix:** filter such entries out of `availableFields` field by field before compiling.
- **Verified on:** visualizations 0.4.0 and 0.5.2, 2026-09/10.

## A stored question's advanced calculation does not survive into the chart

- **Symptom:** the stored question returns the right figures over MCP, but the chart built to show
  it draws something else, and nothing reports an error. Seen with a "difference from the group
  average" question: every bar showed the average itself.
- **Cause:** a chart cannot be bound to a stored question. The tile re-expresses the question as a
  definition plus advanced-calculation operations, and not every question calculation has a working
  chart equivalent. The operations can be accepted and stored in the vSpec while the query the
  chart sends ignores them.
- **Fix:** after building any tile with an advanced calculation, compare one or two of its values
  with `astrato_semantic_layer_execute_question` on the question it stands for. The compile check
  cannot catch this. What is known:

  | Question calculation | Chart operations | Status |
  | --- | --- | --- |
  | Period change (`interRecord`, diff or growth, offset 1) | `setMeasureAdvancedCalculationType` diff/growth + `setMeasureAdvancedOffset 1` on a period sorted descending | Works (0.4–0.8) |
  | Rank | rank calculation + `setMeasureAdvancedRankSortDirection` with payload `rankSortDirection: 'asc' \| 'desc'` | Works (0.9.0) |
  | Difference from the group total or average (`interGroup` / "compare to total") | `advancedCalculationType: 'total'` + `setMeasureAdvancedGroupType 'diff'` + `setMeasureAdvancedComparisonType 'absolute'` | **Broken on 0.9.0**: accepted, but the query sends `interGroup: { type: "value" }` and every bar is the plain average |

  Where a calculation does not carry over, store the result as a **measure** in the layer instead
  (a period-comparison measure, or a measure that subtracts the average), and chart that.
- **Verified on:** visualizations 0.9.0, MCP contract 10.38, 2026-11.
- **See also:** [../patterns/governed-business-questions.md](../patterns/governed-business-questions.md).

## A scatter with two dimensions loads every value of the second as an image

- **Symptom:** the scatter never finishes loading; the network shows a request per value of the
  second dimension (`GET /4.%2051–100` and so on) and the page reports broken images. A readiness
  wait times out.
- **Cause:** with two dimensions, the second is treated as a point image source.
- **Fix:** give a scatter one dimension (the point) and colour it with a measure or a coloring
  rule, not a second dimension. If you need groups, use a stored question with one dimension per
  point.
- **Verified on:** visualizations 0.9.0, 2026-11.

## Operation payloads that are objects, not bare values

- `setAnimationEnabled` takes `{ enabled: false }`, not `false`.
- `setMeasureAdvancedRankSortDirection` takes `{ …dataItem, rankSortDirection: 'asc' | 'desc' }`.
- `setColumnFormatType` / `setColumnFormatString` take `{ name: <exact column name>, … }` (0.8 and 0.9).
  With a custom header label set, the measure's own name was accepted as `name` (0.9.0,
  2026-11-18, a test run); the label was not tried.
- When in doubt, `node kit/verify/ops.mjs <type> <word>` prints the payload schema, and the compile
  check reports a wrong payload as "Invalid payload" in seconds.
- **Verified on:** visualizations 0.9.0, 2026-11.

## A definition's filter and the static-filter operation take different shapes

- **Symptom:** toggling a static filter at runtime is refused with `filters.0: Invalid input`,
  though the same filter works in the definition.
- **Cause:** the two take different shapes:
  - in a definition, `filterGroup` filters are `{ fieldKey, operator: 'inList', values: [ … ] }`;
  - the `setStaticFilterGroup` operation takes `{ fieldKey, operator: 'equals', values: { value } }`,
    one value as an object.
- **Fix:** build the operation payload separately, and test the toggle in the browser: the
  compile check only applies what runs before mounting.
- **Verified on:** visualizations 0.9.0, 2026-11.

## More operation payloads that are not what they look like

- `setMeasureLineSize` takes `{ …dataItem, strokeWidth }`.
- `setShowAxisLabels` takes `{ axisName, showLabels }`.
- `setAxisLabelColor` takes `{ axisName, labelColor }`, not `color`.
- `setCustomPaletteColors` takes `{ colors: [ … ] }`.
- `setColoringType: 'perEachMeasure'` is refused on a bar with one measure (use `single`,
  `categorical` or `gradient`).
- Column formats address a column **by name**, so two columns on the same measure (a rank and a
  value) share one format unless the copy is renamed with `setColumnLabel` first: the rank's
  whole-number format turns a percentage into "0". Rank a separately named measure
  ([tables.md](tables.md#a-value-column-shows-0-beside-its-rank)).
- A measure plotted twice (raw and moving average) shows its name twice in the legend: rename
  one with `updateMeasure { changes: { customLabel } }`. On 0.9 `customLabel` is an object,
  `{ enabled: true, value: 'Short name' }`, on `bar` and `line` alike; this is the only legend
  rename (there is no legend-item label operation). A build that missed it hid the legend
  (`setLegendEnabled false`) and named the series in the subtitle, which also works.
- `setMeasureLineStyle` takes `line`, `dashed` or `dotted`; `solid` is refused (use `line`).
- `setColoringOverwrites` on a chart that matches a value colour against every dimension of a
  mark refuses a `dimension` in the payload: leave it out. It needs at least two enabled
  dimensions; with one it accepts only an empty list (see
  [series colours](#series-colours-collide-because-they-follow-palette-position)).
- **Verified on:** visualizations 0.9.0, 2026-11 (the last two on 2026-11-18, a test run).

## `runtime.getInstance(id)` throws for an unknown id

- **Symptom:** boot fails with *"Unknown visualization instance"*.
- **Cause:** `getInstance` throws when the id does not exist; it does not return `undefined`.
- **Fix:** check `runtime.listInstances().some((i) => i.id === id)` first.
- **Verified on:** visualizations 0.9.0, 2026-11.

## A multi-series line silently stops part-way along the axis

- **Symptom:** the x axis ends early (for example at Dec 2024 when the data runs to 2026); no
  warning anywhere.
- **Cause:** the query limit counts rows, and a line with several series has series × periods
  rows. Seven series over 139 months is 973 rows; a limit of 200 or 500 cuts it off.
- **Fix:** set the limit to at least series × periods for multi-series charts, and check the last
  axis label against the data's latest date in the screenshot.
- **Verified on:** visualizations 0.9.0, 2026-11.

## A `number` definition fails, then a misleading runtime error

- **Symptom:** mounting throws *"Astrato SDK visualization engine requires fieldKey/key field
  identifiers. Legacy { view, name } field identifiers are not supported."*
- **Cause:** the definition did not compile, and the unchecked result (an empty default vSpec) was
  mounted. For `number`, the definition takes `data.measure` (one object), not `data.measures`.
- **Fix:** always check `compileVisualizationDefinition`'s `success` and issues before mounting;
  the offline compile check reports this in seconds.
- **Verified on:** visualizations 0.9.0, 2026-11.

## Colour rules in a definition are wiped by the theme

- **Symptom:** bar colour overwrites or rules set in the definition (`coloring`) disappear, or the
  bars fall back to the default palette.
- **Cause:** a theme step that sets `setColoringType: single` replaces definition-level colouring.
- **Fix:** skip the colouring step for tiles that carry their own rules, and add a rule for the
  base colour (for example `greater-equals 0`) alongside the exceptions.
- **Verified on:** visualizations 0.9.0, 2026-11.

## A stored dimension's column has no `fieldKey` in the field catalogue

- **Symptom:** code that finds the column behind a stored dimension through
  `field.item.dimension.fieldKey` gets `undefined`.
- **Cause:** on 0.9 the catalogue describes that column as `{ view, name }`.
- **Fix:** accept both: `item.dimension.fieldKey ?? \`[${item.dimension.view}].[${item.dimension.name}]\``.
  The field-lookup helpers in the examples (`fields.js`) read only `fieldKey`; add the fallback
  when you copy them.
- **Verified on:** visualizations 0.9.0, 2026-11.

## A line without point markers: `dataPointShape: 'none'` is refused

- **Symptom:** a moving-average or trend line should draw as a plain line, but the definition
  refuses `dataPointShape: 'none'` ("Unsupported value"), and leaving the key out compiles every
  point as a circle.
- **Cause:** the shape is an enum of shapes (`circle`, `square`, `diamond`, …) **or `null`**;
  there is no `'none'` string.
- **Fix:** set `dataPointShape: null` on that measure in the definition, or after compile send
  `setMeasureShape { …dataItem, shape: null }`. Both compile with the shape stored as `null`.
  A line shows data labels only where its measure has a shape
  ([combo limitations](#combo-chart-limitations)), so expect none on a `null` measure.
- **Verified on:** visualizations 0.9.0, 2026-11-18 (offline compile and the package's operation
  schema; not yet seen rendering).

## A heat map draws every cell in one flat colour

- **Fix:** a heat map compiles with single colouring. Send `setColoringType 'gradient'`, then
  `setCustomGradientColors { colors: ['#…', '#…'] }` (two or more 6- or 8-digit hex colours, low
  to high).
- **Verified on:** visualizations 0.9.0, 2026-11-18 (a test run).

## Series colours collide because they follow palette position

- **Symptom:** a multi-series line (scenarios, plans) gives two series near-identical colours, or
  a series changes colour when another drops out of the data.
- **Cause:** categorical colours are dealt by position in the palette, not by value.
- **Fix:** bind each value to its colour with `setColoringOverwrites { overwrites: [{ value:
  'Baseline', color: '#…' }, …] }` (no `dimension` key outside a sankey). It needs at least two
  enabled dimensions; on a one-dimension chart (a mini bar) it accepts only an empty list, so
  order the palette (`setCustomPaletteColors`) to match the sorted values instead.
- **Verified on:** visualizations 0.9.0, 2026-11-18 (a test run; the two-dimension rule read from
  the operation's schema).
