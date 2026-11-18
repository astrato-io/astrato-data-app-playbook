# Governed reference lines

Trend charts carry reference lines (mean, mean ± σ, target) whose values come from governed queries, so they move with the selection.

## When

Any trend where "is this normal?" matters: bookings by quarter, utilisation, weekly volumes.

## How

1. Query the reference values (mean, standard deviation, target) through the engine with the same filters as the chart.
2. Inject them into the chart's `vSpec.refLines` and push the new spec with `runtime.updateInstance(id, { vSpec })`. Never remount.
3. Re-run on every selection change of the chart's group.

## Gotchas

- Line charts with reference lines need `legend: false` and no data labels on the reference series.
- Visualizations 0.4/0.5 have no reference lines on scatter and no date-range markers.

## On visualizations 0.8

The current docs say not to call `runtime.updateInstance` or write vSpec properties directly, and to change mounted objects with `applyRuntimeOperations`. Look for a reference-line operation first (`node kit/verify/ops.mjs line ref`); fall back to the vSpec route below only if none exists. Untested here on 0.8.

## Examples

- revenue-war-room — governed refLines re-pushed on selection: [objects.js:119](../examples/revenue-war-room/project/src/objects.js#L119)
