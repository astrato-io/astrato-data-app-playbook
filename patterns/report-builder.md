# Self-service report builder

A flexible custom report: the user picks rows, figures, filters and a period, compares with the previous period or the same period last year, sees one native table or chart, and saves, shares and exports it.

## When

Whenever someone asks for "a flexible custom report", "self-service reporting" or "let users build their own report", or lists picking rows, figures, filters, a period, a comparison, a chart, saving and export. Start from report-builder; it runs on any layer.

## How

1. **Read the fields at run time, governed items only.** Build the catalogue from `createVisualizationAvailableFields(getFieldMetadata())`: rows are the stored dimensions, figures are the governed measures with their format pattern and description. The example also lists ungoverned text, date and boolean columns; hide them, or the composed report is no longer governed (see A3 in the [rubric](../playbook/rubric.md)). Keep a row's key the raw column key its dimension points at, because chart clicks and selections select on the column. Starters and saved reports name fields; drop any the layer lacks.
2. **Grey out rows that cannot split the figures.** A row on a view the figure's fact does not reach through many-to-one joins returns the same total on every row. Work out reachability from the layer's joins, grey such rows (and figures) out in the panel with the reason, and refuse the combination with a sentence rather than render repeated totals.
3. **One plain state object, pure functions to a vSpec.** State (view, ordered rows with a date grain, ordered figures, compare, sort, limit, period, filters) → a spec of ordered columns with refs, labels and formats → a compiled definition, with each finishing operation applied alone so a refused one is reported. Being pure, the offline compile check runs the same code.
4. **Filters and the period as applied selections in one group.** Filters are `inList`, the period a `between` on the chosen date field, counting back from the last date in the data. The object follows the group; auto-apply pending selections so a chart click becomes a filter chip; drop clicks on dates, which would replace the period. Chips and Clear all as in selection-bar.
5. **Comparison as a native window calculation** when the layer has no comparison measures: a date row at month, quarter or year moved to the first column, sorted ascending, `growth` (or `diff` for ratios) at offset −1 for the previous period, or −12 / −4 / −1 for the same month, quarter or year last year. Say on screen when it cannot apply (no date row, day grain, a chart).
6. **Remount on change, refit on resize.** Debounce edits, drop the object, mount the new one. Give table columns pixel widths from headers and format patterns, and refit them in place on resize with runtime operations, never a remount.
7. **Save, share, export.** Save named reports to `app.states` (`@astrato-io/app-runtime` 0.8: named, owned by the user who creates them, each write guarded by an etag and an idempotency key) when it answers, else to `localStorage` keyed by layer, and say on screen which store is in use. Feature-detect with `await app.states.getLimits()` in a try/catch and offer saving there only when `allowCreate` is true: states work only in an authenticated-audience publication with state support enabled and creation allowed in its **States** tab; local and preview runtimes reject them, so that path cannot be tested before publishing. The address carries the state as `#r=<base64url JSON>`, so reload, bookmark and share all reopen it; Excel from `runtime.getData(tileId)`, so the workbook holds the object's own rows, computed columns included, plus a Definitions sheet (see xlsx-export).

## Gotchas

- Many-row change tables on 0.9: a descending date sort with a positive offset returned nulls on every row; ascending with a negative offset works. Check one value by hand. See [Window calculations](../knowledge/engine-and-queries.md#window-calculations-diff-growth-running-total-give-the-wrong-rows).
- A change column is a second copy of its figure, and format operations match columns by label: rename the copy with `setColumnLabel`, then format it by that name.
- The window counts rows, not calendar periods: a missing month shifts the offset, and the first period has nothing to compare with.
- A ratio's change is in points; label it so, since the `%` format does not say it.
- The composed report is ad hoc: no stored question sits behind it. Save its starters as stored questions and build it from governed items only, so it does not count against A3.
- Charts take at most two rows, and with two only the first figure. Say so under the controls.
- Several figures on one row stack into one bar on 0.9 unless you send `setBarChartLayout: 'groups'`; send `stacked` only for two rows. `groups` is refused with a single figure, so send it only with two or more.
- A Line view emits no selection on click (observed on visualizations 0.9.0, 2026-11). Say under the controls that a line does not filter, and point at the table or bar.
- Saves in `localStorage` stay in one browser; use `app.states` once published, or write them back to the warehouse if they must travel.
- A persona or row scope applied in the app (people-intelligence) is a static filter, not security.

## Examples

- report-builder — the catalogue: [catalogue.js:12](../examples/report-builder/project/src/catalogue.js#L12); state → spec: [report.js:50](../examples/report-builder/project/src/report.js#L50); comparison: [report.js:37](../examples/report-builder/project/src/report.js#L37); filters and period as selections: [builder.js:60](../examples/report-builder/project/src/builder.js#L60), [builder.js:65](../examples/report-builder/project/src/builder.js#L65); save and share: [builder.js:252](../examples/report-builder/project/src/builder.js#L252), [builder.js:268](../examples/report-builder/project/src/builder.js#L268); Excel of the object's rows: [builder.js:281](../examples/report-builder/project/src/builder.js#L281)
- people-intelligence — the larger tab it was cut from (table, bar, scatter, heat map, pivot; persona scope): [builder.js:80](../examples/people-intelligence/project/src/builder.js#L80); state → spec: [builder.js:59](../examples/people-intelligence/project/src/builder.js#L59); bookmarks: [builder.js:222](../examples/people-intelligence/project/src/builder.js#L222); share link: [builder.js:267](../examples/people-intelligence/project/src/builder.js#L267)
