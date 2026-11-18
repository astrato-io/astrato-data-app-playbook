# Four Businesses layer (synthetic demo data)

One layer behind eleven demo apps. It models four fictional businesses, all on synthetic data, side by side, with no
joins between them:

| Business | Tables | Views |
| --- | --- | --- |
| **Velmora** (B2B SaaS) | `NB_*` | Accounts, Opportunities, Reps, Sales Regions, Bookings Targets, Forecast Snapshots, Forecast Bridge, Activities, ARR Monthly, Account Usage, Account Events, Feature Adoption, Contacts, Support Tickets, Marketing Funnel, P&L, P&L Lines, EBITDA Bridge, Workforce |
| **Kestrel Running** (retail) | `KR_*` | Retail Products, Retail Stores, Retail Sales, Retail Inventory, Stock Transfers |
| **Harbourline Bank** (financial crime) | `HB_*` | Bank Customers, Fraud Cases, Case Reasons, Payments |
| **Paddock Labs** (F1 strategy) | `F1_*` | Drivers, Races, Race Laps |

31 views, 23 joins (all many-to-one, facts → dimensions), about 150 measures and 29 stored
business questions. See [questions.md](questions.md) and [layer.json](layer.json).

## Grain and joins

- Velmora centres on **Accounts**: usage, events, ARR, contacts, adoption, tickets and
  opportunities all join many-to-one to it. Opportunities join on to **Reps** → **Sales Regions**.
  Activities, forecast snapshots and the forecast bridge hang off Opportunities.
- **P&L** joins to **P&L Lines** (the line hierarchy). P&L and the EBITDA Bridge carry
  `FISCAL_YEAR`; P&L also has `PERIOD` (`'2026 YTD'` etc.), so YTD is a filter, not a calculation.
- Retail sales and inventory join to both products and stores. Days of cover only means
  something per product × store.
- Laps join to drivers and to races.

## Gotchas

- **Regional targets** live on Sales Regions. Group target measures by
  `[Sales Regions].[Region Name]`, not `[Reps].[Region]`, or the whole target lands in a null region.
- **Pricing** tiles must filter `Accounts.Status = 'Active'`. Otherwise prospects show a 100% discount.
- A stored question that combines a **running total and a top N** fails (engine error 13700).
  Split it into two questions.
- Filters have no NOT: use `notEquals`. Date filter values need `dataType: date`.
- Most apps on this layer query raw view fields rather than stored dimensions; profile the raw
  fields you use over MCP, not only the 4 stored dimensions.

## Recreate it

[schema/ddl.sql](schema/ddl.sql) creates the 31 tables. No data is published: generate your own
or point the views at equivalent tables, then recreate the model from `layer.json` with the
Astrato MCP semantic-layer tools.
