# Stock Rotation — Corvo

A fictional retailer of vitamins, home diagnostics and snacks holds short-dated stock in two
fulfilment hubs (UK and US) and asks: *what do we hold, what will expire unsold, and what are the
options for keeping stock rotating?* The app is an inventory options workbench, not an inventory
management system. The Stock tab shows the position from governed measures. Eight working tabs put
the day's stock steps (book in, ship oldest-expiry-first, transfer, count, trace and recall, reorder,
quarantine and write off) in front of four roles, and write each one back to the warehouse
through `app.writeback`. Write-offs, purchase orders and large count variances need a second person.
A Plan tab tests a promotion, a discount, a transfer, a demand change and a supplier slip against
doing nothing. The data is illustrative: 9 products in 3 categories from 5 suppliers, with
movements from 2025-11 to 2026-11. The at-risk figures are computed against today's date, so
they move as the data ages. It is a hand-written Astrato App on Vite and the public `@astrato-io`
packages (visualizations 0.9, app-runtime 0.8).

No screenshots are shipped yet.

## Tabs

- **Stock** — three filters (category, warehouse, product), four KPI cards (units on hand vs 30 days ago, value at risk vs stock value and its share, received and shipped in the last 30 days vs the prior 30), stock by product and warehouse with a shipped-trend mini-chart and days of cover coloured red/amber/green, and live batches soonest expiry first with units and value at risk.
- **Goods in** — open and delayed purchase orders by due date; the Warehouse Operator enters the counted quantity and expiry and books it in (new batch, receipt movement, PO closed).
- **Goods out** — the pick list with a scan box; each batch shows why it is blocked (quarantine, below the product's minimum shelf life, or "Pick … first") or "pick first"; the Warehouse Operator dispatches against an order reference.
- **Transfers** — available batches, most at risk first; the Operations Manager moves units to the other hub as a child batch that keeps its expiry.
- **Stock count** — count by batch with a scan box; variances up to 5% post straight away, larger ones become a request for the Operations Manager.
- **Trace & recall** — pick a batch to see its supplier, units received and shipped, shipment references and stock still held, with every movement; the Quality Lead can quarantine all remaining stock of the batch and its transfers.
- **Reorder** — products whose suggested order quantity is above zero, with stock status and cover; the Planner proposes a purchase order for the Operations Manager to approve.
- **Expiry** — batches expiring within 30 days, at risk or in quarantine; the Planner requests a write-off (Quality Lead approves), the Quality Lead quarantines or releases.
- **Ledger** — three filters and every movement, newest first.
- **Approvals** — pending requests with approve/reject for the named approver role, and the audit trail of everything done in this browser.
- **Plan** — six sliders (promotion lift, length and discount, share of at-risk stock transferred, demand change, supplier lead-time slip); write-off avoided, revenue recovered, value still at risk, lines under 7 days' cover and units to reorder, against doing nothing.

"Acting as" (Planner, Operations Manager, Quality Lead, Warehouse Operator) and "⬇ Excel report" sit
in the header.

## Worth copying

**Stock steps written back as plain table writes.** Each workflow step is a short sequence of
`app.writeback` inserts and updates on the `Corvo Inv Batches`, `Corvo Inv Movements` and
`Corvo Inv Purchase Orders` views ([workflow.js:48](project/src/workflow.js#L48)): a dispatch
inserts a `Customer Shipment` movement and lowers the batch quantity; a transfer inserts a child
batch, a `Transfer Out` and a `Transfer In` movement, and lowers the source batch; booking in creates
the batch, logs the `Receipt` and closes the PO. After a write the query cache is cleared
([app.js:234](project/src/app.js#L236)), the queues are re-read, and every mounted object is
re-queried by pushing its own vSpec back ([app.js:252](project/src/app.js#L254)). The layer also
carries the same steps as nine Data Actions; the app writes directly because, as its header says,
the App runtime cannot call a named Data Action ([workflow.js:1](project/src/workflow.js#L1)).

**First-expired-first-out at the pick list.** `blockOf` ([workflow.js:35](project/src/workflow.js#L35))
refuses a batch that is not Available, holds less shelf life than the product's minimum, or is not
the oldest eligible batch for that product and warehouse, and the dispatch step re-checks it before
writing.

**Two-person rules.** `APPROVER` maps each guarded step to the role that may approve it
([workflow.js:8](project/src/workflow.js#L8)). Write-offs, purchase orders and count variances over
5% become requests ([workflow.js:96](project/src/workflow.js#L96), [workflow.js:142](project/src/workflow.js#L142));
approving one runs the step ([workflow.js:151](project/src/workflow.js#L151)).

**Value at risk lives in the layer.** The `Batch Rotation` SQL view projects, per live batch, the
units that will expire unsold: the 28-day shipment run rate × days to expiry, minus the stock
ahead of it in expiry order ([layer.json:134](../../layers/inventory-rotation/layer.json#L134)).
`Stock Position` derives cover, stock status and a suggested order quantity the same way. The app
only reads measures.

**Batch trace from governed movements.** `traceOf` ([app.js:255](project/src/app.js#L257)) queries
every movement for a batch and its transfer children, then sums receipts, shipments and distinct
shipment references, and shows where stock is still held.

Also useful:
- KPI card = `number` + monthly bar or line mini-chart + header-less one-row prior-period table with red/green bands ([dashboard.js:64](project/src/dashboard.js#L64));
- table column widths as pixel shares of the slot, refitted on resize without a remount ([app.js:151](project/src/app.js#L151));
- query lanes with 429 backoff and a session cache around `engine.getData` ([throttle.js:110](project/src/throttle.js#L110));
- a five-sheet styled Excel report (summary vs prior 30 days, products, expiry, the Plan scenario, requests and audit) from governed queries ([app.js:272](project/src/app.js#L274)), written by a dependency-free OOXML writer ([xlsx.js:204](project/src/xlsx.js#L204));
- six smoke checks the app registers itself: warehouse and category selections move the KPIs and tables and restore, the ledger narrows, the queues load (read only), a Plan lever moves the outcome, and the Excel report downloads ([app.js:314](project/src/app.js#L316)).

## Semantic layer

[`layers/inventory-rotation`](../../layers/inventory-rotation/) ("Corvo – Inventory Rotation
(illustrative synthetic data)") has 9 views, 14 joins, 17 dimensions, 37 measures, 10 business
questions and 9 Data Actions.

- **Views:** seven tables (`Corvo Inv Products`, `Warehouses`, `Suppliers`, `Batches`, `Movements`, `Purchase Orders`, `Sales Orders`) and two custom SQL views, `Batch Rotation` (one row per live batch) and `Stock Position` (one row per SKU and warehouse). Every join is many-to-one: the facts and both SQL views to `Products` on SKU, to `Warehouses` on warehouse id and, where they carry one, to `Suppliers`; `Movements` to `Batches` on `Batch ID`.
- **Views the app writes:** `Corvo Inv Batches`, `Corvo Inv Movements`, `Corvo Inv Purchase Orders`.
- **Measures used:** `Units On Hand`, `Units On Hand 30d Ago`, `Units On Hand Change`, `Value At Risk`, `Stock Value`, `Value At Risk Share`, `Units At Risk`, `Units Expired`, `Received 30d`/`Prior 30d`/`Change`, `Shipped 30d`/`Prior 30d`/`Change`, `Units In`, `Units Shipped`, `Net Movement`, `Units Available`, `Units Quarantined`, `Daily Run Rate`, `Days Of Cover`, `Units Inbound`, `Suggested Order Units`, `Revenue 30d`; the Excel report adds `Delayed PO Units`, `Written Off 30d`/`Prior 30d`, `Revenue Prior 30d`.
- **Raw fields:** the queues read `Batch Rotation` and `Stock Position` columns (batch, SKU, product, warehouse, status, expiry, days to expiry, stock status, days of cover, supplier), open and delayed purchase orders, product unit cost and minimum shelf days, and supplier lead times ([app.js:238](project/src/app.js#L240)).
- **Business questions:** 10, e.g. "What stock is at risk of expiring unsold?", "Which products need reordering now?", "What purchase orders are late?". The app uses none of them. Full list in [questions.md](../../layers/inventory-rotation/questions.md).
- **Data Actions:** Receive Purchase Order, Record Dispatch, Transfer Stock, Post Stock Count, Recall Batch, Set Batch Status, Write Off Batch, Raise Purchase Order, Cancel Purchase Order. The app calls none of them; Cancel Purchase Order has no screen.

## Rebuild from nothing

1. **Data.** No generator is shipped: the layer's tables were loaded from CSV files that are not in the repo. [schema/ddl.sql](../../layers/inventory-rotation/schema/ddl.sql) gives every table's shape (drop the `Month` and `Period` expression columns it lists for Movements and Sales Orders: they are custom fields in the layer, not columns). No data is shipped: once loaded, profile the layer over MCP ([playbook step 1](../../playbook/1-read-the-layer.md)). Load rows whose dates sit around today, because the SQL views measure expiry and run rate against `CURRENT_DATE`.
2. **Layer.** Recreate it from `layers/inventory-rotation/layer.json`, replacing `ASTRATO_GALLERY.ASTRATO` in the two SQL views and the Data Action SQL with your database and schema. No authoring script is shipped.
3. **App.** See Run it. The layer must be published before the app can see it.
4. There is no reset script; keep a copy of the batch, movement and purchase-order tables to restore after a demo.

## Run it

```sh
cd project
npm install                # public npm: @astrato-io/app-runtime, @astrato-io/visualizations, vite
# set semanticLayerId in astrato.json to your copy of the layer (it ships as a zero placeholder)
astrato login
npm run compile-check      # every tile compiles against the installed library, no session needed
astrato dev .              # open the sign-in URL it prints
node ../../../kit/verify/smoke.mjs "<that sign-in URL>"
astrato build .
```

Needs Node 24.18 or later. Writes need a runtime and layer that accept writeback.

## Caveats

- **Guards run in the browser.** Roles, FEFO and minimum shelf life are checked only by the app; the layer's Data Actions are not called. Roles come from the picker, so one person can request and approve by switching role.
- **No transactions, no fallback.** A step is several separate writes (a transfer is four), so a failure part-way leaves partial state; a failed write is logged as FAILED in the audit trail, with no browser-storage fallback.
- **Approvals are browser-only.** Requests and the audit trail live in `localStorage` (`corvo-ops-v1`); "Clear" on the audit trail clears only this browser. An approval is marked Approved before its write runs and stays Approved if the write fails ([workflow.js:151](project/src/workflow.js#L151)).
- Inactive tabs are hidden with `display: none` ([app.js:134](project/src/app.js#L134)); the ledger table mounts hidden and refits when first shown. Use off-screen panes instead ([preload tabs](../../patterns/preload-tabs.md)).
- None of the layer's stored business questions is used; native objects query measures directly.
- Transfers assume exactly two warehouses, WH-UK and WH-US. The Plan tab is browser arithmetic over a governed baseline ([app.js:187](project/src/app.js#L187)). The Value at risk card's mini-chart plots units expired by month.
- `styles.css`, `objects.css` and `ops.css` carry rules for screens this app does not have.
- Verified with `npm run compile-check` (21/21) and `vite build`. The app registers six smoke checks, but no smoke-test run is recorded for this export.
- No screenshots are shipped yet.
