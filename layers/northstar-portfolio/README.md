# Northstar – Private Markets Portfolio OS layer

The model behind [portfolio-os](../../examples/portfolio-os/): Northstar Capital Partners, a
fictional private-equity firm. It holds 36 portfolio companies across its funds, simulated
quarter by quarter from entry, with about $12bn invested. Balance sheets balance, cash
reconciles and bridges sum exactly.

19 views, 14 joins, 40 dimensions, 137 measures and 24 stored business questions. See
[questions.md](questions.md).

## Shape

A star around **Companies**, which joins many-to-one to **Funds**:

- **Company facts** (each many-to-one to Companies): Financials (quarterly P&L, balance sheet and
  cash flow), Statement Lines, Operating KPIs (monthly), Valuations, Plans, Debt Facilities,
  Cash Flows, Initiatives and Initiative Quarters, Investment Thesis, Next Period, Workflow Records.
- **Fund Returns** joins to Funds.
- **Stand-alone views:** FX Rates (quarter-end rates for presentation currency), Audit Events,
  and the **Valuation Seed** and **Plan Seed** copies. The app's "Reset demo" restores
  Valuations and Plans from the seeds after a demo has written to them.

## Modelling choices

- **LTM and prior-LTM measure families** (Revenue LTM, EBITDA LTM, margin LTM and their PLTM
  twins) let growth and margin change be governed rather than computed in the app.
- **Ratios are recomputed from their parts** (net leverage = net debt ÷ EBITDA LTM), never
  averaged.
- **Cross-view stress measures** (interest cover at +100bp, liquidity, impact of −1.0x on the
  multiple) are layer measures, so every page and export agrees.
- **Workflow tables are writeback targets.** Workflow Records and Audit Events are written by the
  app through `app.writeback`, then read back like any other view.

## Recreate it

No data or data generator ships with it. Load your own tables shaped like
[schema/ddl.sql](schema/ddl.sql) into your warehouse, and build the model with `project/tools/layer.mjs`, `gen-model.mjs` and
`questions.mjs`; the example README gives the order. [schema/ddl.sql](schema/ddl.sql) lists the
tables; `NSC_STATEMENT_LINES` and the `*_SEED` tables are derived in the warehouse.
