# Formatted Excel report

An "Excel report" button that writes a formatted, multi-tab management report from the same governed queries as the screen, following the filters on screen on **every** sheet.

## When

Every demo-grade app. It turns the app into something a manager can forward.

## How

1. A dependency-free styled `.xlsx` writer (fills, number formats, column widths, frozen panes, header and footer).
2. Tabs: a summary with KPIs and generated bullets; one tab per page, with in-cell bars standing in for charts; raw data; definitions.
3. Build each sheet from governed queries with the selections on screen, not from what the DOM shows. Two ways:
   - **A mounted object's own data** (`handle.getData()` / `runtime.getData(id)`, visualizations 0.9): the sheet mirrors the chart exactly. It runs the object's query **with its own selection group**. If tabs have their own groups (see [preload-tabs](preload-tabs.md)), first copy `main` into every tab group and wait for the queries to go quiet, then read. See *Sync every group before reading* below.
   - **`engine.getData` with the filters passed explicitly**: build the request from the `main` group's applied selections, not from a tab group.
4. Split it in two: `buildWorkbook()` returns the Blob, and the button downloads it. The smoke test then calls `buildWorkbook()` directly (step 6).
5. Reuse the sheets for a print-ready PDF window.
6. Register the probe so the kit proves step 3 on every run:

   ```js
   appState.exportProbe({
     build: () => buildWorkbook(),
     select: () => setOne(GROUPS.main, regionKey, sel(regionKey, 'inList', ['West'])), // narrows every tab
     clear: () => selections.clearSelections(GROUPS.main),
     exempt: ['Definitions', 'Plan audit trail'],
   });
   ```

   The smoke test builds the workbook without and with the filter, from the landing tab so the other tabs are hidden, and fails every sheet whose figures did not change. To check by hand: `node kit/verify/xlsx-diff.mjs unfiltered.xlsx filtered.xlsx`.

## Sync every group before reading

```js
export async function buildWorkbook() {
  for (const g of Object.values(TAB_GROUPS)) mirror(g);   // the same mirror the tab switch uses
  await appState.quiet({ paintMs: 0 });                    // hidden objects re-query; wait for them
  // ...now handle.getData() on every tab returns rows under the current filters
}
```

The groups stay in sync afterwards. That is harmless: the tab switch compares signatures before it mirrors, so showing a tab later sends no extra query.

## Gotchas

- **Hidden tabs export unfiltered rows.** With per-tab groups mirrored only while a tab is visible, `handle.getData()` on a hidden tab returns the figures from before the filter, under a banner that names the filter. Two clean test runs shipped this, and both judges caught it (G1 = 1). Sync first, as above, and register `appState.exportProbe`.
- A banner that names the filters is a promise: every sheet below it must follow them.
- Put the fictional brand in headers and footers from one constant; never hard-code a client name.

## Examples

- portfolio-os — the writer: [xlsx.js:207](../examples/portfolio-os/project/src/xlsx.js#L207); the document set in [export.js](../examples/portfolio-os/project/src/export.js)
- snowline — sheets from `handle.getData()` after syncing every tab group: [export.js](../examples/snowline/project/src/export.js)
