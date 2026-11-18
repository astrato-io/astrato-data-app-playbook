# Waterfall from an offset bar

A native waterfall (forecast bridge, EBITDA bridge, valuation bridge) built from a bar chart in offset layout.

## When

Any bridge from one total to another through signed movements.

## How

Use a bar chart with `setBarChartLayout: 'offset'`. Order the steps with a hidden supporting measure (`addSupportingMeasure`, `toggleSortingItem`, `changeSortOrderAndDirection`), so the categories keep their bridge order whatever their values.

## Examples

- revenue-war-room — the Q4 forecast bridge: [objects.js:39](../examples/revenue-war-room/project/src/objects.js#L39), sort helper at [objects.js:81](../examples/revenue-war-room/project/src/objects.js#L81)
