# KPI with comparison and mini chart

A KPI card is never a bare number: it carries a period comparison (vs previous, vs target) and a native mini chart of its trend or mix.

## When

Every KPI strip. A bare number reads as a static report; the trend and the delta show the KPI's shape at a glance.

## How

- **Value:** a native `number` object, or a one-row `table` when the value must follow selections (see gotchas).
- **Comparison:** `number` cannot do period-over-period. Use a one-row `table` over a period dimension sorted descending, with the measure set to `diff` or `growth` at offset 1 and `queryLimit: 1`. The window runs before the limit, so the change survives. Hide the period column and colour the text with a two-segment indicator, where "up" is good or bad per measure.
- **Mini chart:** a native `line` (trend over month or quarter) or a mini `bar` by a natural breakdown for snapshot KPIs; axes, legend and labels hidden. Mount mini charts after the main objects of the tab.

## Gotchas

- In visualizations 0.4–0.5, `number` objects on governed measures ignore selections. Either mirror selections in as static filters (see selection-bar) or compute the value with a governed query.
- Offset is in sort order: on a descending sort, offset 1 is the previous period; -1 gives the wrong sign.
- A `number` whose slot has no definite width draws into a box a few pixels wide and still reports `rendered`, so a smoke test passes it. Size the value slot explicitly: in a flex row, `flex: 0 0 52%; min-width: 0; height: 40px`; as a lone value in the card's flex column, `flex: none; height: 48px`, stretched to the card width. The surface inside fills it (`width: 100%; height: 100%`). Check the slot's width in the browser, not only the status (visualizations 0.9.0).

## On visualizations 0.8

Two things changed; see the [status table](../knowledge/README.md#status-on-08). The comparison no longer has to be an inter-record calculation: a stored time axis with period-comparison measures gives "this period", "last period", change and growth as ordinary measures ([how](../knowledge/semantic-layer.md#this-quarter-is-empty-because-the-data-ends-in-the-past)), but only where the date sits in a view readers do not filter; on a one-view layer they break under any filter, so use explicitly filtered measures. And a `number` object accepts a comparison measure (`addMeasure` with `role: 'number-comparison'`), so the one-row table may no longer be needed. On 0.9.0 the `number` comparison has been seen rendering, and number objects follow selections without a mirror. The comparison colour is static (`setComparisonFontColor`): to colour by direction, read the sign of the stored change measure with a governed query and set the colour per card. The examples below use the older route.

## In a template app

CLI 0.2.0's dashboard template draws `KpiCard`'s value and change as **HTML text** from
`useFigures`. That does not meet rubric [A2](../playbook/rubric.md): keep the card's frame, put a
native `number` in its value slot (sized as in the gotchas). What worked on visualizations 0.9.0:

```js
ops.push({ name: 'addMeasure', payload: { sourceKind: 'calculation', key: comparisonKey, role: 'number-comparison' } });
ops.push({ name: 'setComparisonPosition', payload: 'bottom' }); // default draws it left of the value
```

- The comparison prints in **its measure's own layer format**. A change in percentage points on a
  % value needs its own measure formatted for it (for example "+0.0 ppt"); add one rather than
  changing the format of an existing measure that other surfaces use.
- **A "flat" threshold.** Colour by the sign of the stored change only when it survives the
  displayed rounding; a change that rounds to nothing is neutral. Otherwise −0.11 under a
  `+#,##0` format prints "−0" in red. Give the comparison measure enough decimals too.

## Examples

- portfolio-os — number + sparkline + prior-period table: [catalogue.js:63](../examples/portfolio-os/project/src/catalogue.js#L63)
- lending-affordability — governed MoM/QoQ change row: [dashboard.js:158](../examples/lending-affordability/project/src/dashboard.js#L158)
- revenue-war-room — forecast categories with week-over-week change and snapshot sparklines
