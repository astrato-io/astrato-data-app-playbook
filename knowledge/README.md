# Knowledge base: building Astrato Apps

Hard-won findings about `@astrato/visualizations`, `@astrato/sdk`, `@astrato/app-runtime`, the
Astrato query engine, selections, the semantic layer and its MCP tools, writeback, the Astrato CLI
and publishing, hosted apps, and theming. Each one cost real debugging time on a real app and is
written so that the next person finds it by its symptom.

**Agents:** grep this folder for the error text or the behaviour you see before diagnosing, and
for the feature name before using it (`grep -ri "number.*selection" knowledge/`). Techniques with
working code live in [../patterns/](../patterns/); this folder says *why* they are needed and what
else breaks.

## How entries are written

Every entry is an H2 headed by the symptom or the question, then:

- **Symptom** what you see, with error text verbatim where known.
- **Cause** what is really happening.
- **Fix** operation names, option names, payload shapes; a snippet when it helps.
- **Verified on** library or runtime versions and the month (e.g. `visualizations 0.5.2,
  2026-10`). "Version not recorded" means the source did not say.
- **See also** links to patterns and other entries.

Short reference entries ("Product gaps to design around", "Other MCP authoring facts") collect
one-line facts under the same heading style. Where a later version changed a behaviour, the entry
keeps both findings with their versions and says which is current. Everything here was observed,
not inferred from docs; re-check an entry on a newer version before relying on its workaround.

## Versions

| Component | Versions the entries were verified on | Notes |
| --- | --- | --- |
| `@astrato-io/visualizations` (formerly `@astrato/…`) | 0.4.0 (2026-09), 0.5.2 (2026-09 → 11), 0.6.x, **0.8.0** (the examples, 2026-11), **0.9.0** (fresh-agent builds, 2026-11) | 0.5 removed `addStaticFilter` and the bar/heat-map label colour ops; 0.5.2 turned animations on and fixed filter mounting into a non-empty group |
| `@astrato-io/sdk` (formerly `@astrato/sdk`) | 0.4.0, 0.7.0 | the governed-key connectivity gap was seen with every visualizations version above |
| `@astrato-io/app-runtime` | pre-v2 builds (0.0.x), 0.2.0 (hosted runtime v2, 2026-10), 0.8.0, **0.9.0** (writeback, 2026-11; what CLI 0.2.0's template installs) | builds older than 2026-10-30 reject the newer bootstrap capabilities |
| Astrato CLI (`@astrato-io/cli`) | pre-0.1 builds (2026-09), 0.1.1 (2026-10 → 11, first with `publish`), 0.1.3, **0.2.0** (2026-11-18: `init --template dashboard`, `snapshot`, `semantic-layers list`/`describe`) | see [the dashboard template](cli-and-publishing.md#the-dashboard-template) |
| MCP tool contract | 10.x, 10.33.0 → 10.38.0 (2026-11) | authoring shapes (stored questions, batches) |
| Warehouses | Snowflake (most findings), BigQuery, ClickHouse | warehouse-specific findings say so |

The examples in this repo pin their own versions in `examples/<slug>/project/package.json`.

## Status on 0.8

The public packages are now `@astrato-io/*`. The three examples were ported to and tested on
visualizations 0.8.0, sdk 0.7.0, app-runtime 0.8.0 and CLI 0.1.3, with MCP contract 10.37 (CLI
0.2.0 and app-runtime 0.9.0 followed on 2026-11-18; the examples have not been re-run on them). Since
then npm has started serving **visualizations 0.9.0**. The examples pin `^0.8.0`; one fresh-agent
build ran on 0.9.0 (2026-11) and found the two 0.9 rows below. The 0.9.0 package's own changelog stops
at 0.6.2, so there is no list of changes from 0.7 to 0.9: test what you rely on. Most entries here were verified on 0.4–0.6 and have **not**
been re-run. A first build on 0.8 (2026-11) gave the evidence below. "Compiles" means the
definition and operations were accepted offline by `kit/verify/compile-check.mjs`; nothing in
this table was seen rendering in a browser.

| Entry or pattern | On 0.8 | Evidence |
| --- | --- | --- |
| Period comparison through an inter-record calculation in each question | **Superseded** by a stored time axis and period-comparison measures where the date sits in its own view; on a one-view layer use explicitly filtered measures ([why](semantic-layer.md#this-quarter-is-empty-because-the-data-ends-in-the-past)); the old route still works | Values verified over MCP |
| A `number` object cannot compare with the previous period | **Changed**: `addMeasure` with `role: 'number-comparison'` works and renders ("2.5 +0.20") | Run in a browser on 0.9.0 |
| Charts on governed items need the connectivity wrapper to cross-filter | **Not needed**: removed from all three examples; on one, a selection gave the same queries with and without it | Run in a browser on three apps |
| A `number` on governed measures ignores selections; mirror static filters | **Not needed for `number`** (0.8 and 0.9): with the mirror switched off, a `number` KPI followed a fund selection ($18,296m → $4,592m → back). One-row measure-only tables were not tested without it | Run in a browser |
| Push changes with `runtime.updateInstance(id, { vSpec })` | **Still works, now discouraged**: it exists on 0.8 and the docs reserve it for a deliberate full replacement. Use `applyRuntimeOperations` where an operation exists (table widths moved over and work); keep `updateInstance` where none does (reference lines: no operation on 0.8, and `vSpec.refLines` + `updateInstance` renders) | Run in a browser |
| Date axes print epoch numbers without a grouping and format operation | **Probably changed**: a stored dimension with `dateLevel: month` compiles with the level set and no format operation | Compiles; labels not seen |
| `engine.getData` filter shape `{ field: { fieldKey }, operator, values }` | **Use the flat shape** `{ fieldKey, operator, values }` on 0.9: the runtime passes filters through untouched, selections and the question API send flat keys, and one 0.9 build's 400s on the nested shape cleared with it (not isolated). See [engine-and-queries.md](engine-and-queries.md#enginegetdata-returns-400-astrato-rejected-the-runtime-request) | Typings and one build on 0.9.0 |
| Setting `format: { formatType: 'none' }` on governed measures | **Avoid**: the docs say to leave `format` off so the layer's format and currency apply | Docs only |
| Table sparkline column, indicator bands, `setBarChartLayout`, `setMeasureGraphColor`, `setMeasureDefinedParameter` | **Unchanged** | Compiles |
| `plan_authoring_batch` before `commit_authoring_batch` | **Optional** for creates; a patch needs `preparedTarget` set to the item's name | Run on MCP 10.37 |
| A stored question's advanced calculation carried into a chart | **Broken for "difference from group total/average"** on 0.9.0: accepted, not sent; period change and rank work | Run in a browser |
| Scatter with two dimensions | **Broken on 0.9.0**: the second dimension is fetched as images | Run in a browser |
| `setLineType` with `'linear'` | **Changed**: the values are now `curve`, `straight`, `square`; `'linear'` is refused with *"Invalid payload for setLineType"* | Run in a browser |
| `setColumnFormatType` / `setColumnFormatString` addressed by data-item keys | **Changed**: both now take `{ name: <exact column name>, … }` and refuse the data-item keys that other column operations still take. A refused format is silent on screen: percentages show as `0` and `1`, and currency symbols vanish | Run in a browser |
| Apps cannot run stored questions or named Data Actions (app-runtime) | **Changed**: 0.8 and 0.9 type `runQuestion(name, options?)`, `nextQuestions(of)` (published App or Builder preview, `question:run`) and `runDataAction({ name, arguments? })` (`procedure:execute` under `astrato dev`); 0.9 adds `filters`/`parameters` to `runQuestion` and `pinboards()`/`pin()` | Typings and bundle; not run |
| `app.writeback` needs `dataviewID: layerId` | **Not needed** on app-runtime 0.8/0.9: the request type has none and the runtime adds the layer id | Insert, update, delete run under `astrato dev` on 0.9.0 |
| Omit `structure` on a flat table | **Either works** on 0.9.0: `structure: 'normal'` is optional on a flat table ([entry](tables.md#a-table-definition-is-rejected)) | Compiles |
| A static filter on an integer field | **Range works, exact match does not** on 0.9.0: `isBetween` on an `int` Year rendered in a heat map; `inList` fails silently ([entry](visualizations.md#a-definition-filters-entry-on-a-number-or-date-field-is-rejected)) | Run in a browser |

**All three examples are ported.** Each was moved from 0.5–0.6 to a Vite project on the public
packages and run in headless Chrome with the kit's smoke test, which also ran each app's own
selection check:

| Example | Objects | Smoke test | Selection check |
| --- | --- | --- | --- |
| lending-affordability | 46 (40 at load) | pass | Applications 2,400 → 482 → 2,400 |
| revenue-war-room | 21 | pass, one screen per tab | Q4 forecast $22.71m → $10.51m → $22.71m |
| portfolio-os | 71 | pass | Revenue (LTM) $18,296m → $4,592m → $18,296m |

The code changes were the two operation changes above, axis ranges and table widths moved onto
operations, and the cross-filter wrapper and vendor patch scripts removed. The mechanical steps:
replace `@astrato/` with `@astrato-io/` in imports; drop the import map, the vendored packages
and the vendor script; add an entry module that imports the library stylesheet, the fonts and the
app; run the compile check, then the smoke test, then **look at the screenshots**: the lost
formats above passed every automated check and were only visible in the picture.

Still unverified on 0.8: the `getData` filter shape (on 0.9, send the flat one), date axes without a format operation, and a
`number` object with a comparison measure. On 0.9 only what the rows above name has been seen.

**What to do with an "Unknown" row:** build it the way the current docs describe, without the
workaround, and test that one behaviour first (select a value; does the KPI move?). Add the
workaround only if the test fails, and record which version you saw it on.

## Files

| File | Covers |
| --- | --- |
| [visualizations.md](visualizations.md) | definitions, operations, formats, chart types and their gaps |
| [tables.md](tables.md) | native tables: widths, KPI tables, sparkline columns, indicators, totals, expandable tables |
| [selections.md](selections.md) | pending vs applied, governed-key cross-filtering, KPIs that ignore selections, groups |
| [engine-and-queries.md](engine-and-queries.md) | direct `getData`, filter shapes, operator names per surface, parameters, window calcs |
| [performance.md](performance.md) | query floor, rate limits, load time, large layers, vSpec caches |
| [rendering.md](rendering.md) | blank or frozen charts, hidden tabs, sizing, resize, animation, debugging |
| [theming.md](theming.md) | fonts, icons, colours and palettes, dark-theme labels, RTL, translation |
| [semantic-layer.md](semantic-layer.md) | measures, fields, joins, time axes, stored business questions, MCP authoring |
| [writeback.md](writeback.md) | `app.writeback` errors, Data Actions, hosted writes |
| [cli-and-publishing.md](cli-and-publishing.md) | `astrato dev`, the dashboard template, `snapshot`, build, runtime bootstrap, `publish` |
| [hosting.md](hosting.md) | access grants, public links, layer revisions, firewall, sessions, hosted speed |

## Index

### [visualizations.md](visualizations.md) (44)

- [A definition fails with `invalid_structure: Invalid input` and names no field](visualizations.md#a-definition-fails-with-invalid_structure-invalid-input-and-names-no-field)
- [`applyOperations` reports success but nothing changed](visualizations.md#applyoperations-reports-success-but-nothing-changed)
- [An operation is skipped or throws after a package upgrade](visualizations.md#an-operation-is-skipped-or-throws-after-a-package-upgrade)
- [Should operations be applied one at a time or batched?](visualizations.md#should-operations-be-applied-one-at-a-time-or-batched)
- [Operations need data-item keys and fail with "Invalid payload"](visualizations.md#operations-need-data-item-keys-and-fail-with-invalid-payload)
- [`Formatter type number is not allowed for this data item`](visualizations.md#formatter-type-number-is-not-allowed-for-this-data-item)
- [A date axis shows 13-digit numbers (epoch milliseconds)](visualizations.md#a-date-axis-shows-13-digit-numbers-epoch-milliseconds)
- [Weekday or month names in calendar order](visualizations.md#weekday-or-month-names-in-calendar-order)
- [A custom format string renders the wrong text](visualizations.md#a-custom-format-string-renders-the-wrong-text)
- [The legend will not hide, or hiding it fails validation](visualizations.md#the-legend-will-not-hide-or-hiding-it-fails-validation)
- [A definition `filters` entry on a number or date field is rejected](visualizations.md#a-definition-filters-entry-on-a-number-or-date-field-is-rejected)
- [A static filter on a date or timestamp field is silently dropped](visualizations.md#a-static-filter-on-a-date-or-timestamp-field-is-silently-dropped)
- [A static filter on a Custom SQL view column breaks the object](visualizations.md#a-static-filter-on-a-custom-sql-view-column-breaks-the-object)
- [`addMeasureFilter` is accepted but nothing is filtered, or the wrong measure is](visualizations.md#addmeasurefilter-is-accepted-but-nothing-is-filtered-or-the-wrong-measure-is)
- [A `number` object cannot compare with the previous period](visualizations.md#a-number-object-cannot-compare-with-the-previous-period)
- [Bars do not start at zero, or the smallest bar has no length](visualizations.md#bars-do-not-start-at-zero-or-the-smallest-bar-has-no-length)
- [Value labels on bars or heat-map cells do not draw](visualizations.md#value-labels-on-bars-or-heat-map-cells-do-not-draw)
- [Line charts draw steps, or reject `linear`](visualizations.md#line-charts-draw-steps-or-reject-linear)
- [A line chart does not select on click](visualizations.md#a-line-chart-does-not-select-on-click)
- [Layout enums and the missing 100% stack](visualizations.md#layout-enums-and-the-missing-100-stack)
- [A waterfall: `waterfall` is measures-only](visualizations.md#a-waterfall-waterfall-is-measures-only)
- [Sorting by a hidden measure fails with "length mismatch"](visualizations.md#sorting-by-a-hidden-measure-fails-with-length-mismatch)
- [Categories sort alphabetically and the order matters](visualizations.md#categories-sort-alphabetically-and-the-order-matters)
- [Scatter: no limit, no bubble size, huge points, no gridlines](visualizations.md#scatter-no-limit-no-bubble-size-huge-points-no-gridlines)
- [Reference lines, targets and markers](visualizations.md#reference-lines-targets-and-markers)
- [Combo chart limitations](visualizations.md#combo-chart-limitations)
- [Changing a filter or parameter on a mounted chart](visualizations.md#changing-a-filter-or-parameter-on-a-mounted-chart)
- [Product gaps to design around](visualizations.md#product-gaps-to-design-around)
- [`filter` objects: label, size and preset filters](visualizations.md#filter-objects-label-size-and-preset-filters)
- [`Unknown visualization instance` / every chart mounts twice](visualizations.md#unknown-visualization-instance--every-chart-mounts-twice)
- [Compile fails for every tile because of one field, or "Invalid available field"](visualizations.md#compile-fails-for-every-tile-because-of-one-field-or-invalid-available-field)
- [A stored question's advanced calculation does not survive into the chart](visualizations.md#a-stored-questions-advanced-calculation-does-not-survive-into-the-chart)
- [A scatter with two dimensions loads every value of the second as an image](visualizations.md#a-scatter-with-two-dimensions-loads-every-value-of-the-second-as-an-image)
- [Operation payloads that are objects, not bare values](visualizations.md#operation-payloads-that-are-objects-not-bare-values)
- [A definition's filter and the static-filter operation take different shapes](visualizations.md#a-definitions-filter-and-the-static-filter-operation-take-different-shapes)
- [More operation payloads that are not what they look like](visualizations.md#more-operation-payloads-that-are-not-what-they-look-like)
- [`runtime.getInstance(id)` throws for an unknown id](visualizations.md#runtimegetinstanceid-throws-for-an-unknown-id)
- [A multi-series line silently stops part-way along the axis](visualizations.md#a-multi-series-line-silently-stops-part-way-along-the-axis)
- [A `number` definition fails, then a misleading runtime error](visualizations.md#a-number-definition-fails-then-a-misleading-runtime-error)
- [Colour rules in a definition are wiped by the theme](visualizations.md#colour-rules-in-a-definition-are-wiped-by-the-theme)
- [A stored dimension's column has no `fieldKey` in the field catalogue](visualizations.md#a-stored-dimensions-column-has-no-fieldkey-in-the-field-catalogue)
- [A line without point markers: `dataPointShape: 'none'` is refused](visualizations.md#a-line-without-point-markers-datapointshape-none-is-refused)
- [A heat map draws every cell in one flat colour](visualizations.md#a-heat-map-draws-every-cell-in-one-flat-colour)
- [Series colours collide because they follow palette position](visualizations.md#series-colours-collide-because-they-follow-palette-position)

### [tables.md](tables.md) (17)

- [A `table` definition is rejected](tables.md#a-table-definition-is-rejected)
- [A top-N table is refused at compile time](tables.md#a-top-n-table-is-refused-at-compile-time)
- [A table with only measures never follows selections](tables.md#a-table-with-only-measures-never-follows-selections)
- [Column widths shrink, spread evenly, leave a gap or scroll](tables.md#column-widths-shrink-spread-evenly-leave-a-gap-or-scroll)
- [Cell text is clipped, or a one-row KPI table scrolls](tables.md#cell-text-is-clipped-or-a-one-row-kpi-table-scrolls)
- [A sparkline (mini-chart) column in a table](tables.md#a-sparkline-mini-chart-column-in-a-table)
- [A progress column blanks the table or draws pills](tables.md#a-progress-column-blanks-the-table-or-draws-pills)
- [Indicator (traffic-light) colours are inverted](tables.md#indicator-traffic-light-colours-are-inverted)
- [The native total row is wrong or clips the last row](tables.md#the-native-total-row-is-wrong-or-clips-the-last-row)
- [An expandable table ignores sort, hide and width operations](tables.md#an-expandable-table-ignores-sort-hide-and-width-operations)
- [A two-dimension table hides its second column](tables.md#a-two-dimension-table-hides-its-second-column)
- [Table colours, fonts and nulls](tables.md#table-colours-fonts-and-nulls)
- [A table loads two result sets, or re-queries forever](tables.md#a-table-loads-two-result-sets-or-re-queries-forever)
- [A value column shows 0 beside its rank](tables.md#a-value-column-shows-0-beside-its-rank)
- [A sparkline column draws a single dot](tables.md#a-sparkline-column-draws-a-single-dot)
- [`Cannot read properties of undefined (reading 'reduce')` from one table](tables.md#cannot-read-properties-of-undefined-reading-reduce-from-one-table)
- [Clickable dimension cells sit half a row low](tables.md#clickable-dimension-cells-sit-half-a-row-low)

### [selections.md](selections.md) (13)

- [A filter or chart click does nothing](selections.md#a-filter-or-chart-click-does-nothing)
- [Charts on governed dimensions or measures do not cross-filter](selections.md#charts-on-governed-dimensions-or-measures-do-not-cross-filter)
- [A KPI `number` (or measure-only object) ignores selections](selections.md#a-kpi-number-or-measure-only-object-ignores-selections)
- [Every chart in a group returns HTTP 400 after a selection set in code](selections.md#every-chart-in-a-group-returns-http-400-after-a-selection-set-in-code)
- [A month dropdown breaks every object on the page](selections.md#a-month-dropdown-breaks-every-object-on-the-page)
- [A filter object never draws: "Cannot destructure property 'view' of undefined"](selections.md#a-filter-object-never-draws-cannot-destructure-property-view-of-undefined)
- [A date window or numeric range as a selection](selections.md#a-date-window-or-numeric-range-as-a-selection)
- [One click re-queries every chart, including hidden tabs](selections.md#one-click-re-queries-every-chart-including-hidden-tabs)
- [A discarded pending selection keeps coming back](selections.md#a-discarded-pending-selection-keeps-coming-back)
- [A chart should ignore one filter ("this chart ignores the month")](selections.md#a-chart-should-ignore-one-filter-this-chart-ignores-the-month)
- [Click and brush behaviour on native charts](selections.md#click-and-brush-behaviour-on-native-charts)
- [A click on a chart over a Custom SQL view highlights but never selects](selections.md#a-click-on-a-chart-over-a-custom-sql-view-highlights-but-never-selects)
- [Sharing one selection across Astrato and non-Astrato data](selections.md#sharing-one-selection-across-astrato-and-non-astrato-data)

### [engine-and-queries.md](engine-and-queries.md) (16)

- [`engine.getData` returns 400 "Astrato rejected the runtime request"](engine-and-queries.md#enginegetdata-returns-400-astrato-rejected-the-runtime-request)
- [`getData` refuses: "must target the configured semantic layer"](engine-and-queries.md#getdata-refuses-must-target-the-configured-semantic-layer)
- [How to ask for governed measures, ad-hoc measures and month grouping](engine-and-queries.md#how-to-ask-for-governed-measures-ad-hoc-measures-and-month-grouping)
- [The response is not an array, and dates are numbers](engine-and-queries.md#the-response-is-not-an-array-and-dates-are-numbers)
- [Which chart sent this query?](engine-and-queries.md#which-chart-sent-this-query)
- [Which operator names does each surface accept?](engine-and-queries.md#which-operator-names-does-each-surface-accept)
- [Every tile shows "no data to display" with HTTP 400 or 403](engine-and-queries.md#every-tile-shows-no-data-to-display-with-http-400-or-403)
- [Concurrent queries randomly fail on some warehouses](engine-and-queries.md#concurrent-queries-randomly-fail-on-some-warehouses)
- [Date filters fail in the warehouse](engine-and-queries.md#date-filters-fail-in-the-warehouse)
- [Nested static filter groups disappear](engine-and-queries.md#nested-static-filter-groups-disappear)
- [A relative-period measure returns null in a direct query](engine-and-queries.md#a-relative-period-measure-returns-null-in-a-direct-query)
- [Passing parameters to native objects and direct queries](engine-and-queries.md#passing-parameters-to-native-objects-and-direct-queries)
- [Window calculations (diff, growth, running total) give the wrong rows](engine-and-queries.md#window-calculations-diff-growth-running-total-give-the-wrong-rows)
- [A chart without an Astrato session (fake engine)](engine-and-queries.md#a-chart-without-an-astrato-session-fake-engine)
- [An ad-hoc measure over MCP is refused](engine-and-queries.md#an-ad-hoc-measure-over-mcp-is-refused)
- [`getData` with a stored dimension's key: "Astrato rejected the runtime request"](engine-and-queries.md#getdata-with-a-stored-dimensions-key-astrato-rejected-the-runtime-request)

### [performance.md](performance.md) (9)

- [Each query takes about a second, however small the data](performance.md#each-query-takes-about-a-second-however-small-the-data)
- [429 "Astrato is rate limiting requests"](performance.md#429-astrato-is-rate-limiting-requests)
- [One click fires dozens of queries](performance.md#one-click-fires-dozens-of-queries)
- [Page load is slow before any data arrives](performance.md#page-load-is-slow-before-any-data-arrives)
- [The page freezes on a layer with thousands of fields](performance.md#the-page-freezes-on-a-layer-with-thousands-of-fields)
- [The hosted app sits on the splash screen](performance.md#the-hosted-app-sits-on-the-splash-screen)
- [Selection effects lag several seconds](performance.md#selection-effects-lag-several-seconds)
- [Slow Custom SQL views](performance.md#slow-custom-sql-views)
- [MCP calls fill the agent's context](performance.md#mcp-calls-fill-the-agents-context)

### [rendering.md](rendering.md) (10)

- [Charts are `mounted` but blank, or boot hangs with no error](rendering.md#charts-are-mounted-but-blank-or-boot-hangs-with-no-error)
- [`handle.ready` never settles](rendering.md#handleready-never-settles)
- [`rendered` does not mean the numbers are there](rendering.md#rendered-does-not-mean-the-numbers-are-there)
- [Canvas text passes every text check](rendering.md#canvas-text-passes-every-text-check)
- [The page freezes after a while, and charts return magnified](rendering.md#the-page-freezes-after-a-while-and-charts-return-magnified)
- [Charts vanish and reappear on resize](rendering.md#charts-vanish-and-reappear-on-resize)
- [A chart has zero height, or grows without limit](rendering.md#a-chart-has-zero-height-or-grows-without-limit)
- [Animations never play](rendering.md#animations-never-play)
- [Mounting during a selection change shows stale or doubled results](rendering.md#mounting-during-a-selection-change-shows-stale-or-doubled-results)
- [Debugging tools that work](rendering.md#debugging-tools-that-work)

### [theming.md](theming.md) (10)

- [Chart text renders in a serif font](theming.md#chart-text-renders-in-a-serif-font)
- [Table icons render as boxes or blanks](theming.md#table-icons-render-as-boxes-or-blanks)
- [Categorical colours collide, shift or ignore the palette](theming.md#categorical-colours-collide-shift-or-ignore-the-palette)
- [A palette or colour operation is rejected](theming.md#a-palette-or-colour-operation-is-rejected)
- [Highlight one category](theming.md#highlight-one-category)
- [Chart labels are unreadable on a dark background](theming.md#chart-labels-are-unreadable-on-a-dark-background)
- [Theming operations by type (quick reference)](theming.md#theming-operations-by-type-quick-reference)
- [Checking colours that are painted on a canvas](theming.md#checking-colours-that-are-painted-on-a-canvas)
- [Right-to-left (Hebrew, Arabic) layouts](theming.md#right-to-left-hebrew-arabic-layouts)
- [Translating an app, including data values](theming.md#translating-an-app-including-data-values)

### [semantic-layer.md](semantic-layer.md) (33)

- [The app does not see a measure I just added](semantic-layer.md#the-app-does-not-see-a-measure-i-just-added)
- [Publishing one measure changed another measure's result type](semantic-layer.md#publishing-one-measure-changed-another-measures-result-type)
- [A measure expression is refused](semantic-layer.md#a-measure-expression-is-refused)
- [A ratio shows −100% or 0](semantic-layer.md#a-ratio-shows-100-or-0)
- [A measure prints raw numbers although it has a custom format](semantic-layer.md#a-measure-prints-raw-numbers-although-it-has-a-custom-format)
- [A derived measure is refused, or mixes aggregates and measures](semantic-layer.md#a-derived-measure-is-refused-or-mixes-aggregates-and-measures)
- [A derived measure is stuck at parameter defaults](semantic-layer.md#a-derived-measure-is-stuck-at-parameter-defaults)
- [Every MCP query fails with "semantic layer hash mismatch"](semantic-layer.md#every-mcp-query-fails-with-semantic-layer-hash-mismatch)
- [`commit_authoring_batch` commits nothing, or commits when it should not](semantic-layer.md#commit_authoring_batch-commits-nothing-or-commits-when-it-should-not)
- [Field types drift from the warehouse](semantic-layer.md#field-types-drift-from-the-warehouse)
- [A calculated field is read as a column name ("invalid identifier")](semantic-layer.md#a-calculated-field-is-read-as-a-column-name-invalid-identifier)
- [Repointing a view deleted all its fields](semantic-layer.md#repointing-a-view-deleted-all-its-fields)
- [Custom SQL view fields disappear or misbehave](semantic-layer.md#custom-sql-view-fields-disappear-or-misbehave)
- [Joins: range joins, fan-out and multiple facts](semantic-layer.md#joins-range-joins-fan-out-and-multiple-facts)
- [Time axes and relative periods compare the wrong period](semantic-layer.md#time-axes-and-relative-periods-compare-the-wrong-period)
- [A season comparison drops the last week of the previous season](semantic-layer.md#a-season-comparison-drops-the-last-week-of-the-previous-season)
- [Share of total, 100% stacks and indexes](semantic-layer.md#share-of-total-100-stacks-and-indexes)
- [Mapping dimensions sort alphabetically and expose a phantom key](semantic-layer.md#mapping-dimensions-sort-alphabetically-and-expose-a-phantom-key)
- [Stored business questions: authoring shapes that work](semantic-layer.md#stored-business-questions-authoring-shapes-that-work)
- [A rank in a stored question shows as currency](semantic-layer.md#a-rank-in-a-stored-question-shows-as-currency)
- [`validate` reports an error your change did not cause](semantic-layer.md#validate-reports-an-error-your-change-did-not-cause)
- [MCP data tools refuse: "This connector requires additional permissions."](semantic-layer.md#mcp-data-tools-refuse-this-connector-requires-additional-permissions)
- [Other MCP authoring facts](semantic-layer.md#other-mcp-authoring-facts)

- ["This quarter" is empty because the data ends in the past](semantic-layer.md#this-quarter-is-empty-because-the-data-ends-in-the-past)
- [A date dimension returns one row per day, whatever its name says](semantic-layer.md#a-date-dimension-returns-one-row-per-day-whatever-its-name-says)
- [Authoring calls on MCP contract 10.37](semantic-layer.md#authoring-calls-on-mcp-contract-1037)
- [MCP responses fill the context](semantic-layer.md#mcp-responses-fill-the-context)
- [The MCP connection drops in the middle of a session](semantic-layer.md#the-mcp-connection-drops-in-the-middle-of-a-session)
- [A measure filter that compares two fields](semantic-layer.md#a-measure-filter-that-compares-two-fields)
- [Each series ends on a different date](semantic-layer.md#each-series-ends-on-a-different-date)
- [A difference measure invents a change where there is no earlier period](semantic-layer.md#a-difference-measure-invents-a-change-where-there-is-no-earlier-period)
- [Where to read a measure's formula](semantic-layer.md#where-to-read-a-measures-formula)
- [A long-format layer: one row per series per period](semantic-layer.md#a-long-format-layer-one-row-per-series-per-period)

### [writeback.md](writeback.md) (9)

- [How do I create a writeback table?](writeback.md#how-do-i-create-a-writeback-table)
- [`app.writeback` fails: 400 `invalid_request` "Astrato rejected the runtime request."](writeback.md#appwriteback-fails-400-invalid_request-astrato-rejected-the-runtime-request)
- [Other reasons a write is rejected](writeback.md#other-reasons-a-write-is-rejected)
- [An update throws "no rows changed" and the audit insert never happens](writeback.md#an-update-throws-no-rows-changed-and-the-audit-insert-never-happens)
- [The app shows the old value after a successful write](writeback.md#the-app-shows-the-old-value-after-a-successful-write)
- [Writes work locally but not on the hosted app](writeback.md#writes-work-locally-but-not-on-the-hosted-app)
- [The app cannot call a Data Action](writeback.md#the-app-cannot-call-a-data-action)
- [`AstratoAppRuntimeError: Astrato returned an invalid Astrato App bootstrap.`](writeback.md#astratoappruntimeerror-astrato-returned-an-invalid-astrato-app-bootstrap)
- [Forms that drive writes do not submit in a background tab](writeback.md#forms-that-drive-writes-do-not-submit-in-a-background-tab)

### [cli-and-publishing.md](cli-and-publishing.md) (16)

- [The dashboard template](cli-and-publishing.md#the-dashboard-template)
- [Template operations are refused with "Invalid payload"](cli-and-publishing.md#template-operations-are-refused-with-invalid-payload)
- [Template KPIs go blank after a click on an integer field](cli-and-publishing.md#template-kpis-go-blank-after-a-click-on-an-integer-field)
- [Template KPIs ignore a stored question's filters](cli-and-publishing.md#template-kpis-ignore-a-stored-questions-filters)
- [Template KPI cards print a points change as a percentage](cli-and-publishing.md#template-kpi-cards-print-a-points-change-as-a-percentage)
- [A second browser gets "The local Astrato browser session is missing."](cli-and-publishing.md#a-second-browser-gets-the-local-astrato-browser-session-is-missing)
- ["Unable to reach the Astrato App runtime" mid-session](cli-and-publishing.md#unable-to-reach-the-astrato-app-runtime-mid-session)
- [What does the CLI need from an app with no bundler?](cli-and-publishing.md#what-does-the-cli-need-from-an-app-with-no-bundler)
- [`AstratoAppRuntimeError: Astrato returned an invalid Astrato App bootstrap.`](cli-and-publishing.md#astratoappruntimeerror-astrato-returned-an-invalid-astrato-app-bootstrap)
- [Hosted app: "Runtime route not found. Rebuild older publications for runtime v2"](cli-and-publishing.md#hosted-app-runtime-route-not-found-rebuild-older-publications-for-runtime-v2)
- [Publish commands and their required flags](cli-and-publishing.md#publish-commands-and-their-required-flags)
- [Publish fails: "requires an enabled, available non-legacy exit node … enable Exit node"](cli-and-publishing.md#publish-fails-requires-an-enabled-available-non-legacy-exit-node--enable-exit-node)
- [`--image` fails with 403, or the cover is ignored](cli-and-publishing.md#--image-fails-with-403-or-the-cover-is-ignored)
- [The publish succeeded but the live app is broken](cli-and-publishing.md#the-publish-succeeded-but-the-live-app-is-broken)
- [`astrato build` / `astrato dev` fail on Windows: `Cannot find module …\node_modules\npm\bin\npm-prefix.js`](cli-and-publishing.md#astrato-build--astrato-dev-fail-on-windows-cannot-find-module-node_modulesnpmbinnpm-prefixjs)
- [Starting many dev servers at once fails](cli-and-publishing.md#starting-many-dev-servers-at-once-fails)

### [hosting.md](hosting.md) (8)

- [Signed-in users get `not_found`: "The publication or its data is no longer available."](hosting.md#signed-in-users-get-not_found-the-publication-or-its-data-is-no-longer-available)
- [A public link says "You do not have access to this publication or its data"](hosting.md#a-public-link-says-you-do-not-have-access-to-this-publication-or-its-data)
- [The hosted app stops loading data after a layer publish](hosting.md#the-hosted-app-stops-loading-data-after-a-layer-publish)
- [Hosted queries fail with a CORS error or 403](hosting.md#hosted-queries-fail-with-a-cors-error-or-403)
- [Every new object fails about 8 minutes after load](hosting.md#every-new-object-fails-about-8-minutes-after-load)
- [A 404 on `/data/semantic-layers/…` on first load](hosting.md#a-404-on-datasemantic-layers-on-first-load)
- [The hosted app is much slower than local](hosting.md#the-hosted-app-is-much-slower-than-local)
- [Map tiles, favicons and other static gotchas](hosting.md#map-tiles-favicons-and-other-static-gotchas)

