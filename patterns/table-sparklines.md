# Table sparklines

Native tables with a mini-chart column (trend per row), so a ranked list also shows each row's direction.

## When

Ranked lists of companies, accounts, products or sites where the trend matters as much as the current value.

## How

Declare the table with a `miniChart` column: the measure, plus the view and time field it trends over. Keep the table native (never an HTML `<table>`), and size columns as shares of the container, refitted with a ResizeObserver through `updateInstance`.

## When the table is filtered to one period

The mini chart obeys the table's filters, so a table filtered to the latest period draws one dot
per row. Put the "latest" filter inside the measures instead, and keep the table unfiltered
([knowledge](../knowledge/tables.md#a-sparkline-column-draws-a-single-dot)).

## When the data has no time axis

A sparkline needs a time field on the table's view. A snapshot table that stores earlier periods
as columns (rank this year, rank last year) has none, so it cannot carry a sparkline. Then:
show the change as an indicator column (signed, coloured by direction), and if the brief needs the
trend, add a second table on a view that has one row per period, or ask the layer owner for that
view. Do not fake a trend from the columns in the app.

## Gotchas

- A rank column beside the value it ranks gives the value the rank's format, so it shows "0": rank a separately named measure ([knowledge](../knowledge/tables.md#a-value-column-shows-0-beside-its-rank)).
- Tables with pixel column widths are the only objects that need work on resize; never remount anything else on resize.

## Examples

- portfolio-os — the table helper with a sparkline column: [catalogue.js:45](../examples/portfolio-os/project/src/catalogue.js#L45)
