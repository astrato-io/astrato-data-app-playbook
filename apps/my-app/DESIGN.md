# Trading Desk: design

**Form:** a monthly briefing checked for the same handful of numbers every month: a headline
and a row of KPI cards above a grid of charts, then two tabs that answer the next questions
(who, and is it the service). Chosen because the reader comes once a month to the sales review
and needs the same five figures plus "where did it move". Archetype: command-centre, one screen
per tab at 1440×860.

## Who reads it

The commercial director of the trading company, at the monthly sales review with the account
managers. The decision: **which accounts and categories to chase, and whether shipping is
costing sales**, now that year-on-year growth has stalled.

## The finding it leads with (verified 2026-11-24 over MCP)

- June 2023 gross sales **$37,637**, **−1.7%** on June 2022 ($38,298), after January–April 2023
  ran **+100% to +190%** year on year (March $123,473 vs $42,586).
- Orders fell to **39** (76 in March); sales per order **$965**, −21.9% on June 2022.
- Shipping got worse at the same time: **56.4%** of June orders shipped early or on time,
  against **83.9%** in June 2022 (17 of 39 late).
- Next step in the headline: review the customers with the largest fall on the same month last
  year (drivers table) and United Package's late shipments.

Every figure on screen is a live query, so the headline follows the selections.

## Look (five lines)

- Light, warm paper page (`--page #F5F3EE`), white cards, bottle-green header band and accent
  (`--accent #2F5D50`), copper second series (`--series-2 #C7853F`).
- Ink `#1B2430`, muted `#6B7280`, hairlines `#E2DED4`; 10px radius, a soft shadow.
- Good news `#1E7B4F`, bad news `#B3261E`; every KPI decides whether a rise is good.
- IBM Plex Sans for text, Roboto for chart text (what the charts draw in).
- Numbers short: $38k on axes, $37,637 in cards; dates as Jun 2023.

## Layout in words

**Overview: "Is sales growth holding up?"** Headline sentence with the next step. KPI row:
Gross sales, Orders, Active customers, Sales per order, On-time delivery, each "This Month" with
its stored YoY comparison and a native mini line by Order Month. Below: "Gross sales by month
against the same month a year earlier" (Trailing 12 Months; lines), "Year-on-year growth by
month" (bars of Gross Sales YoY % (12m)), and "Which customers moved sales on the same month
last year?" (drivers table: change, now, a year earlier, sparkline).

**Customers: "Where are sales concentrated, and who slowed?"** Category bar (Gross Sales,
share in the label), top-10 countries, customers table with rank, share, orders and a monthly
sparkline, and category YoY growth in the Review Month.

**Delivery: "Are orders shipping on time?"** On-time KPI card, on-time rate by shipper, delivery
status by month (stacked bars of Order Count), and a shipper table (orders, on-time %, average
days to ship, late or unshipped orders, average freight).

Filters on every tab: Category, Country, Shipper, Salesperson. Sticky selection bar with chips
and Clear all. Excel report in the header.

## What the design avoids

- No margin analysis: COGs is a flat 30% of sales in this data, so margin never moves.
- No "Revenue" (the stored measure subtracts a flat 30% and discounts; it is gross profit, misnamed).
- No month selection: Order Month is on the Orders view that holds the time axis, and a
  selection there breaks every period comparison. Month bars and lines select nothing, and say so.
- No stock panel: the Reorder view is not joined, so it would ignore every filter.
- No dark mode, no default chart colours, no HTML tables or hand-drawn charts.
