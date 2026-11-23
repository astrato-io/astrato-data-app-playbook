# Native tables

The `table` object: definitions, widths, KPI tables, sparkline columns, indicators, totals and
expandable (hierarchical) tables. General definition and operation rules are in
[visualizations.md](visualizations.md). Sparkline columns are not part of the definition: they
are built with operations after compile ([how](#a-sparkline-mini-chart-column-in-a-table)).

---

## A `table` definition is rejected

- **Symptom:** `invalid_structure` on a table that copies another type's `dimensions`/`measures`.
- **Cause:** a flat table takes `data.columns`, each entry with `role: 'dimension' | 'measure'`.
  Findings on `structure` disagree on 0.4: one 0.4.0 build accepted `structure: 'normal'`, a later
  one rejected it as an unrecognised key at `[]`. On 0.9 the schema makes it optional on a flat
  table (`structure` may only be `'normal'` there, and the definition reference's example sets it):
  a flat table compiles with it and without it.
- **Fix:** on 0.9 either form works; on 0.4, omit `structure` on a flat table. A hierarchical table
  is `data: { structure: 'expandable', dimensions: [...], measures: [...] }` (required there, as
  `'pivot'` is on a pivot). Column headers have no definition-side label:
  `setColumnCustomLabelEnabled` then `setColumnCustomLabelValue`.
- **Verified on:** visualizations 0.4.0, 2026-09; expandable 0.4.x, 2026-11; both flat forms
  compile on 0.9.0, 2026-11-18 (offline compile, not rendered).

## A top-N table is refused at compile time

- **Symptom:** a table definition with `limiting: { topN: … }`, copied from a bar, fails the
  compile check.
- **Cause:** a table's `limiting` is strict and takes `queryLimit` only.
- **Fix:** sort by the measure descending and set `limiting: { queryLimit: 10 }`.
- **Verified on:** visualizations 0.9.0, 2026-11.

## A table with only measures never follows selections

- **Symptom:** a one-row KPI table or totals table ignores filters and chart clicks.
- **Cause:** measure-only objects take the measure path, which drops group selections.
- **Fix:** give it a hidden dimension: a constant column (`Scope = 'All'`) added to every fact, or
  the period dimension sorted descending with `queryLimit: 1`. Otherwise mirror the group's
  selections in as static filters.
- **Verified on:** visualizations 0.4.0, 2026-09/10.
- **See also:** [selections.md](selections.md#a-kpi-number-or-measure-only-object-ignores-selections), [../patterns/kpi-sparkline-comparison.md](../patterns/kpi-sparkline-comparison.md).

## Column widths shrink, spread evenly, leave a gap or scroll

- **Symptom:** explicit widths shrink (150px → 90px); responsive mode ignores fixed widths; a
  fully responsive table leaves a gap on the right; extra columns scroll out of a small slot.
- **Cause:** columns default to ~90px. Tables scale explicit widths down unless
  `setTableAllColumnsResponsiveWidth false`; `setTableColumnWidthBehavior 'responsive'` splits
  evenly; the table pads about 50px horizontally.
- **Fix:** keep exact widths: compute each `setColumnWidth 'NNpx'` as a share of
  `slot.clientWidth` before compile, with shares summing to about 0.85, and push new widths on
  resize with `runtime.updateInstance(id, { vSpec })` (never remount). Clip the panel
  (`overflow: hidden`) so a table never paints into its neighbour. Where columns bunch at the left
  and exact widths do not matter, `setTableAllColumnsResponsiveWidth true` instead.
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/11.
- **See also:** [../patterns/table-sparklines.md](../patterns/table-sparklines.md).

## Cell text is clipped, or a one-row KPI table scrolls

- **Symptom:** half glyphs in short rows; scrollbars in both directions on a KPI table; a KPI
  table's row height is 0.
- **Cause:** cells pad 8px top and bottom and no operation changes it; a hidden header still
  reserves 42px; a table fitted while its container had 0 width keeps tiny columns.
- **Fix:** row height ≥ font size + 16 (`setTableFixedRowHeightEnabled` +
  `setTableFixedRowHeightValue`), or tighten padding with CSS scoped to the surface
  (`[data-slot="x"] .cell { padding-top: 1px !important; padding-bottom: 1px !important; }`). Give a
  one-row KPI table about 68px with the parent clipping it, and clip scrollbars:
  ```css
  .kpi-value, .kpi-value .viz-surface, .kpi-value .viz-surface * { overflow: hidden !important; scrollbar-width: none !important; }
  .kpi-value .viz-surface ::-webkit-scrollbar { display: none !important; }
  ```
  Wait until the slot is laid out (non-zero width, or a minimum width) before fitting columns.
  Word wrap: `setTableWordWrap true` + `setTableMaxLines`; headers: `setTableWordWrapHeader` +
  `setTableHeaderResponsiveHeight`; `setTableAllColumnsVerticalAlign 'middle'`.
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/11.

## A sparkline (mini-chart) column in a table

- **Symptom:** the definition has no place for a sparkline, so the column seems unreachable;
  `setColumnRepresentation 'chart'` or `'miniChart'` is rejected ("Invalid input"); or the
  sparkline is a single point.
- **Cause:** mini charts are **not in the definition contract** (0.9's definition reference does
  not mention them): declare the column as an ordinary measure column, then turn it into a
  sparkline with operations after compile. The representation enum is `text | image | indicator | bar-chart | line-chart | progress`. The
  mini-chart query inherits the table's selections and filters, and does not receive view
  parameters (`filterParameters`).
- **Fix:** four operations on the measure column: `setColumnRepresentation { representation:
  'line-chart' }` + `setColumnMiniChartDimension { key: <raw date field key> }` +
  `setColumnMiniChartLineColor { lineColor }` (or `BarColor { barColor }`) +
  `setColumnMiniChartShowDataPoints { showDataPoints: false }` (optionally
  `setColumnMiniChartLineStrokeWidth`). Put trend sparklines in a table whose selection group
  ignores the time field; give selected-period columns a measure filter on a raw measure instead.
- **Verified on:** visualizations 0.4.0, 2026-09 (an earlier note on the same version wrongly
  concluded mini charts were impossible); 0.5.2, 2026-11; the same operations on 0.9.0,
  2026-11-18 (a test run).
- **See also:** [../patterns/table-sparklines.md](../patterns/table-sparklines.md).

## A progress column blanks the table or draws pills

- **Symptom:** the whole table goes blank; or a data-bar column is refused with *"Invalid
  payload"*.
- **Cause:** a `progress` column blanks the table until it is configured. On 0.9 the
  representation is named `progress` (`setColumnRepresentation`'s values: `text`, `html`,
  `markdown`, `image`, `url`, `legacy-button`, `indicator`, `bar-chart`, `line-chart`,
  `progress`); there is no `data-bar`. The progress operations take the column's data-item keys
  plus one named value, not a bare value.
- **Fix:** read each `setColumnProgress*` / `setColumnMiniChartProgress*` `payloadSchema` first
  (`node kit/verify/ops.mjs table Progress`): `{ progressBarColor }`, `{ backgroundColor }`, and
  `setColumnProgressDynamicScaleEnabled` with `{ dataItemInternalKey, dataItemUniqueSignature,
  dynamicScaleEnabled: true }` (not `enabled`). Value placement `'right'` draws pills; `'inside'`
  works.
- **Verified on:** visualizations 0.4.0, 2026-09; the representation name and the
  `dynamicScaleEnabled` key from the 0.9.0 operations reference and a test run's compile check,
  2026-11-18.

## Indicator (traffic-light) colours are inverted

- **Cause:** `addColumnIndicatorSegment` boundaries are **upper** bounds of each segment.
- **Fix:** two segments with stops 0 and 1e12 colour by sign; convert lower-bound cuts to upper
  bounds; `setColumnIndicatorColorText true` colours the text; decide per measure whether up is
  good. Icons are Material Icons glyphs (see [theming.md](theming.md#table-icons-render-as-boxes-or-blanks));
  in narrow tables they crowd the value.
- **Verified on:** version not recorded, 2026-10.

## The native total row is wrong or clips the last row

- **Symptom:** a total that double counts on a many-to-many join path (161,900 shown vs 67,550
  correct); with `setTableTotalsPosition 'bottom'` the last row is clipped.
- **Cause:** the total row adds the displayed rows rather than re-aggregating; a bottom total
  keeps a blank row at the top.
- **Fix:** take the total from a no-dimension query where the join path fans out; leave the totals
  position at its default (or `top`, with `setTableTotalsEnabled`). `fanout: 'reduceToRelation'`
  is not a fix (SELECT DISTINCT over amounts collapses equal values).
- **Verified on:** visualizations 0.5.2, 2026-11.

## An expandable table ignores sort, hide and width operations

- **Symptom:** `setColumnHidden`, `setTableSortByMeasure`,
  `setTableHierarchicalMeasureSortItemByName`, `setTableHeaderAsChip: false`, per-column widths are
  accepted and do nothing; each level sorts A→Z; the header always shows dimension chips.
- **Fix:** order lines with an invisible prefix: two zero-width characters (U+200B U+200C U+200D
  U+2060 U+2061 U+2062 U+2063 U+2064 used as base-8 digits of the rank). The warehouse sorts by
  code point, so lines come out in reporting order. Selections must then use the prefixed value.
  Widen the hierarchy column with `setTableStickyColumnResponsiveWidth false` +
  `setTableStickyColumnMinWidth 300`. Precompute subtotal lines in the data so every line drills.
- **Verified on:** visualizations 0.4.x, 2026-11.

## A two-dimension table hides its second column

- **Symptom:** a frozen first-column overlay ignores fitted widths and covers column 2.
- **Fix:** none found; give the first column its natural width or merge the two dimensions into
  one label.
- **Verified on:** version not recorded, 2026-09.

## Table colours, fonts and nulls

- Colours must be 6- or 8-digit hex: `rgba(...)` and `transparent` are rejected; use `#00000000`.
- `setTableBodyFontSize` is table-wide; there is no per-column size. The default font may be a
  serif: set `setTableHeaderFontFamily` / `setTableBodyFontFamily`.
- `setCustomNullValue` affects CSV export only, not the rendered table.
- Theming through a `presentation` block cost about 1 s per operation in the browser; grafting the
  colours onto `vSpec.tableSettings` took 64 ms (unsupported).
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/11.

## A table loads two result sets, or re-queries forever

- **Symptom:** a table mounted during a selection change shows doubled or stale rows; a table with
  0 rows re-queries about once a second until the gateway answers 429.
- **Fix:** call `updateInstance` after selections settle and never refit a table before its first
  render; put every query through a cache that answers identical requests (see
  [../patterns/query-scheduler.md](../patterns/query-scheduler.md)).
- **Verified on:** visualizations 0.4.0, 2026-09.

## A value column shows 0 beside its rank

- **Symptom:** a table with a rank column next to the value it ranks shows the value as "0" on
  every row.
- **Cause:** column formats address a column by name, so a rank and a value on the same measure
  share one format (a `format` in the definition on both leaves both with the last), and the
  rank's whole-number format wins.
- **Fix:** rank a separately named measure: add a copy of the measure to the layer under its own
  name (for example "… Rank Basis") and use it only for the rank column. Renaming the copy with
  `setColumnLabel` and formatting it by that name also separates two columns
  ([engine-and-queries.md](engine-and-queries.md#window-calculations-diff-growth-running-total-give-the-wrong-rows)),
  but that was verified on a change column, not a rank.
- **Verified on:** the separate measure, visualizations 0.9.0, 2026-11.
- **See also:** [visualizations.md](visualizations.md#more-operation-payloads-that-are-not-what-they-look-like).

## A sparkline column draws a single dot

- **Symptom:** the table's mini-chart column shows one point per row instead of a line.
- **Cause:** the mini chart obeys the table's filters. A table filtered to the latest period
  (a static filter such as `Period Status = Latest`) leaves the mini chart one period to draw.
- **Fix:** take the filter out of the table and put it inside the measures the table shows: a
  family of "Latest …" measures whose own filter picks the latest period. The table then needs
  no static filter, and the sparkline sees the whole history.
- **Verified on:** visualizations 0.9.0, 2026-11.
- **See also:** [../patterns/table-sparklines.md](../patterns/table-sparklines.md).

## `Cannot read properties of undefined (reading 'reduce')` from one table

- **Symptom:** the console logs that error (from the table's pivot code) and *"visualization
  reported an error"*, yet the table reports `rendered` and draws correctly. Other tables built by
  the same code do not.
- **Cause:** unknown. Removing the second dimension, filters, measures, merged cells and multi-sort
  did not stop it.
- **Fix:** none found. If the table renders correctly, allow-list the exact message for the smoke
  test (`--allow`) and record it as a caveat.
- **Verified on:** visualizations 0.9.0, 2026-11.

## Clickable dimension cells sit half a row low

- **Symptom:** the click-to-filter dimension columns of every table show only the top of their
  letters, clipped by the next row, with or without a fixed row height.
- **Cause:** clickable cells are wrapped in a zero-height static element inside a row that
  centres its items, so the absolutely positioned cell starts at half the row height. No
  operation moves it: `setTableAllColumnsVerticalAlign`, `setColumnVerticalAlign`, word wrap and
  turning off fixed row height all leave it in place.
- **Fix:** host CSS scoped to the chart surface, pinning the cell to the top of its row:
  ```css
  .viz-surface .row > div:not(.cell) > .cell { top: 0; }
  ```
  An earlier note aimed at the wrapper instead (`.row > div:not(.cell) { align-self:
  flex-start; }`). Check the class names against your version's DOM.
- **Verified on:** the `top: 0` rule on every table of one app, visualizations 0.9.0, 2026-11.
