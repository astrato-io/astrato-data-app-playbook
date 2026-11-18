# Formatted Excel report

An "Excel report" button that writes a formatted, multi-tab management report from the same governed queries as the screen, following the filters on screen.

## When

Every demo-grade app. It turns the app into something a manager can forward.

## How

1. A dependency-free styled `.xlsx` writer (fills, number formats, column widths, frozen panes, header and footer).
2. Tabs: a summary with KPIs and generated bullets; one tab per page, with in-cell bars standing in for charts; raw data; definitions.
3. Build each sheet from `engine.getData` with the current selections, not from what the DOM shows. From visualizations 0.9 a mounted object can also return its own data (`handle.getData()` / `runtime.getData(id)`), so a sheet can mirror a chart exactly (reported by a 0.9 build; check the package README for your version).
4. Reuse the sheets for a print-ready PDF window.

## Gotchas

- Put the fictional brand in headers and footers from one constant; never hard-code a client name.

## Examples

- portfolio-os — the writer: [xlsx.js:207](../examples/portfolio-os/project/src/xlsx.js#L207); the document set in [export.js](../examples/portfolio-os/project/src/export.js)
