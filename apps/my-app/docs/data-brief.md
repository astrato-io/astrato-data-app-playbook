# Data brief: Trading Company (1)

Layer id `0d660155-d8fe-46ac-bb33-483b4e18a021`, Snowflake "Demodata source", schema `NORTHWIND`.
Profiled over MCP on 2026-11-24, published revision 0 (publicationSource engine, draft = published).

## Subject

A food and drink wholesaler (Northwind-style): orders by customers in 21 countries, order lines
for 77 products in 8 categories from suppliers, shipped by 3 shippers, sold by 9 employees in
4 sales regions.

## Scale and state

15 views, 102 fields, 11 joins, 2 dimensions, 24 measures, **0 stored business questions**,
0 set filters. Draft and published both at revision 0. Layer created by another account in the
tenant. No `lastCheck`.

## Grain and time

| View | One row is | Date field | Min | Max | Latest complete period | Prior year? |
| --- | --- | --- | --- | --- | --- | --- |
| Orderdetails | an order line (order × product) | via Orders Updated | | | | |
| Orders Updated | an order (830) | Orderdate | 2021-10-01 | 2023-06-30 | June 2023 (ends on the 30th) | Yes from Oct 2022; Jul–Sep 2022 have none |
| Shipping Time | an order (Custom SQL) | | | | | |
| Repeat Customers | a customer (Custom SQL) | | | | | |
| Reorder, Unit Bins | a product (Custom SQL) | | | | | |
| Region and Territory | an employee (Custom SQL, one territory each via MAX) | | | | | |

`Year` and `Month` on Orders Updated are calculated from Orderdate (`year()`, `month()`), floats.
Date grain available: day. 21 months of history.

## Joins

Star around Orderdetails → Orders Updated (many-to-one) → Customers, Shippers, Region and
Territory, Shipping Time; Orderdetails → Products → Categories, Suppliers; Orderdetails → Unit
Bins; Discount Price → Orderdetails. Category, country, shipper and employee filters all reach
Orderdetails sales. Cross-fact query (sales and orders by year/month) returned clean totals.

- `Reorder`, `Employees`, `Employeeterritories` are **not joined** to anything: reorder status
  cannot be filtered by category or sales.
- `Repeat Customers → Orders Updated` is declared many-to-one but the view is one row per
  customer (unverified fan-out risk; not used by the app).
- Avg Freight Price cannot be broken down by Shipping Time's DeliveryStatus (compiler refusal).

## Metrics (verified)

| Name | Reference | Value (all time) | Tier | Notes |
| --- | --- | --- | --- | --- |
| Gross sales | SUM(Orderdetails.Sales) | $1,354,458 | raw | Unit price × quantity before discount. Up is good. No stored measure: **gap** |
| Revenue (stored) | Sales − 0.3 × Sales − discount | $859,455 | stored | Really gross profit after a flat 30% cost and discounts; misnamed. Not used as "revenue" |
| Profile Margin (stored) | (Sales − COGs) / Sales | 70.0% for every category | stored | COGs is exactly 30% of Sales in the data: **no variation, not charted** |
| Orders | COUNT DISTINCT Orders Updated.Orderid | 830 | raw | **gap** |
| Customers | COUNT DISTINCT Orders Updated.Customerid | 89 of 89 | raw | **gap** |
| Average Sales per Order (stored) | Sales / distinct orders | $1,632 | stored | |
| On-Time Delivery Rate (stored) | (Early + On Time) / orders | 83.5% | stored | Status rule: shipped ≥ 8 days before required = early/on time. Up is good |
| Market Share (stored) | Sales / total Sales | share of total | stored | Usable as share of total in a breakdown |
| Avg Freight Price (stored) | SUM(Freight) / orders | $65–$87 by shipper | stored | Down is good |
| YoY Sales and other "YoY …" (stored) | hard-coded 2023 vs Jan–Jun 2022 | | stored | Hard-coded years; replaced by time-axis comparisons |

## Dimensions (profiled)

| Name | Reference | Cardinality | Top values | Suits |
| --- | --- | --- | --- | --- |
| Category | Categories.Categoryname | 8 | Beverages $287k, Dairy $251k, Meat/Poultry $178k | bar, filter, series |
| Country | Customers.Country | 21 | USA $264k, Germany $245k, Austria $139k | bar, filter |
| Customer | Customers.Companyname | 89 | QUICK-Stop $117k, Save-a-lot $116k, Ernst Handel $113k | top-N bar, table |
| Shipper | Shippers.Companyname | 3 | United Package 326 orders, Federal 255, Speedy 249 | filter, bar |
| Salesperson | Region and Territory.FULLNAME | 9 | Margaret Peacock $250k | bar, filter |
| Sales region | Region and Territory.REGIONDESCRIPTION | 4 | Eastern, Southern, Western, Northern | filter |
| Delivery status | Shipping Time.DeliveryStatus | 4 | Early 679, Late 116, Not Shipped 21, On Time 14 | stacked bar |
| Reorder status | Reorder.STATUS | 3 | null 54, Reorder 18, Reorder Soon 5 | not joined |

Longest labels: customer names ("Hungry Owl All-Night Grocers", 27 chars).

## Monthly sales (gross)

| Month | Sales | Same month a year earlier | YoY |
| --- | --- | --- | --- |
| 2022-10 | 56,381 | 41,968 | +34.3% |
| 2022-12 | 70,741 | 59,487 | +18.9% |
| 2023-01 | 115,775 | 55,578 | +108.3% |
| 2023-03 | 123,473 | 42,586 | +189.9% |
| 2023-04 | 119,463 | 59,692 | +100.1% |
| 2023-05 | 62,887 | 55,737 | +12.8% |
| 2023-06 | 37,637 | 38,298 | −1.7% |

Orders per month: 76 in March 2023, 39 in June 2023. Sales per order: about $1,625 in March,
$965 in June.

## Findings (verified)

1. **Growth stalled.** June 2023 sales of $37.6k are 1.7% below June 2022, after Jan–Apr 2023
   ran +100% to +190% year on year. June is a complete month (orders to the 30th).
2. **Both orders and order size fell.** 76 orders in March vs 39 in June; sales per order
   $1,625 vs $965.
3. **Every category slowed.** Jan–Apr 2023 vs May–Jun 2023: Beverages $117k → $18k (57 → 28
   customers buying), Dairy $81k → $18k.
4. **Concentration.** The top 3 customers (QUICK-Stop, Save-a-lot Markets, Ernst Handel) hold
   25.6% of all sales; USA and Germany 37.5%.
5. **Shipper gap.** United Package carries the most orders (326) but has the lowest on-time rate
   (79.8% vs 86.3% Federal, 85.5% Speedy) and the longest order-to-ship time (10.1 days vs 7.7).

## Reconciliation pairs

| Headline | Must equal | Observed |
| --- | --- | --- |
| Gross sales, all time | sum of the 8 categories | 1,354,458.6 = 1,354,458.6 |
| Gross sales, all time | sum of the 21 months | 1,354,458.6 |
| Orders | sum of delivery statuses | 830 = 679 + 116 + 21 + 14 |

## Gaps (layer work in step 4)

- No time axis: add **Order Month** (period axis on Orders Updated.Orderdate, last 12 months,
  month level, period end latest).
- No plain measures for gross sales, net sales, orders, customers: add them, with
  same-month-last-year value and growth on Order Month.
- No stored business questions: add one per object.
- Measures have no descriptions or formats (except three percentage patterns).

## Caveats

- The data is a demo dataset (`isDemo` datasource). It ends on 2023-06-30; "latest" is June 2023,
  not today.
- COGs is a flat 30% of sales, so margin is constant: no margin analysis.
- "Revenue" is misnamed (it is sales less a 30% cost and discounts). The app avoids it.
- Several stored measures carry unexplained constants (`/ 2.8`, `/ 10`), and a "Copy of" and a
  misspelt dimension name ("Days diffence ", trailing space) are junk names.
- Reorder status is not joined, so a stock panel would ignore every filter: left out.
- Query speed: about 1–2 s per query over MCP.
