# Business questions — Corvo – Inventory Rotation (illustrative synthetic data)

10 stored questions. Full definitions are under `businessQuestions` in [layer.json](layer.json).
Build every chart from one of these (or add one) rather than composing ad-hoc queries in the app.

## How do stock, demand and supply line up by category?

Cross-source: batches, sales orders, purchase orders and movements joined through Products.

- **Measures:** Stock Value, Value At Risk, Shipped 30d, Received 30d, Units Inbound
- **By:** Category

## How do the warehouses compare?

Stock, risk, cover and flow by warehouse.

- **Measures:** Stock Value, Value At Risk, Units Available, Days Of Cover, Shipped 30d
- **By:** Warehouse

## How does stock flow in and out each month?

Receipts, shipments and write-offs by month.

- **Measures:** Units In, Units Out, Units Expired, Net Movement
- **By:** Movement Month

## How is demand moving by channel?

Units shipped and revenue by sales channel, last 30 days against the prior 30.

- **Measures:** Shipped 30d, Shipped Change, Revenue 30d, Revenue Change
- **By:** Channel

## How much stock sits in each expiry band?

Units, stock value and value at risk by days-to-expiry band.

- **Measures:** Units On Hand, Stock Value, Value At Risk
- **By:** Expiry Band

## What purchase orders are late?

Delayed PO units by supplier against all inbound units.

- **Measures:** Delayed PO Units, Units Inbound, Delayed Share
- **By:** Supplier

## What stock is at risk of expiring unsold?

Live batches ranked by value projected to expire unsold (FEFO at the 28-day run rate).

- **Measures:** Value At Risk, Units At Risk, Units On Hand
- **By:** Batch, Product, Warehouse, Expiry Date

## Where are we overstocked or short?

Available and inbound units by stock status and warehouse.

- **Measures:** Units Available, Units Inbound, Suggested Order Units
- **By:** Stock Status, Warehouse

## Which categories lose the most to write-offs?

Units written off by category, last 30 days against the prior 30.

- **Measures:** Units Expired, Written Off 30d, Written Off Prior 30d
- **By:** Category

## Which products need reordering now?

Suggested order quantity by product and warehouse, with cover and inbound.

- **Measures:** Suggested Order Units, Units Available, Units Inbound, Days Of Cover
- **By:** Product, Warehouse, Stock Status
