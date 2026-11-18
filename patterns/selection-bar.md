# Selection bar

A sticky strip under the top bar that lists the active selections as removable chips, with "Clear all", plus filters on every page. Every filter, chart click and map click filters every object, KPIs included.

## When

Every app. Never added on request: it is part of the first pass.

## How

1. Subscribe to the page's selection group and render each active selection as a chip (reader-facing field name, values); a chip's × removes that selection; "Clear all" clears the group. Show a hint when empty.
2. Auto-apply pending selections: a filter or chart click leaves a *pending* selection that nothing applies unless you do.
3. Measure-only objects (number tiles, one-row delta tables) ignore group selections; mirror the page's selections into them as static filters, limited to the views they can join.
4. Split groups where a focus pick must not narrow the overview (e.g. an all-reps hero beside a rep focus) and mirror shared filters into each.

## Gotchas

- Test by selecting a value and checking that a KPI, a chart and a table all change, then clearing it.
- With preloaded tabs, give each tab its own group mirrored from `main` only while visible (see preload-tabs), or a click re-queries every hidden chart.

## On visualizations 0.8

The library now ships a mountable filter bar (`astrato-app-filter-bar`) that shows a group's active selections with a clear-all; use it when one selection group serves the page, and your own chips when the app keeps one state across per-tab groups. The static-filter mirror for KPIs (point 3) may no longer be needed: the docs say number objects follow their group. Test before adding it. See the [status table](../knowledge/README.md#status-on-08).

## Examples

- portfolio-os — chips and Clear all: [app.js:203](../examples/portfolio-os/project/src/app.js#L203); static-filter mirror: [app.js:219](../examples/portfolio-os/project/src/app.js#L219)
- lending-affordability — the library filter bar in the main group: [app.js:510](../examples/lending-affordability/project/src/app.js#L510)
- revenue-war-room — isolated groups with the region mirrored in: [app.js:531](../examples/revenue-war-room/project/src/app.js#L531)
