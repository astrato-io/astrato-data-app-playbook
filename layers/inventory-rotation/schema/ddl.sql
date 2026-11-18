-- Tables behind the "Corvo – Inventory Rotation (illustrative synthetic data)" semantic layer.
-- Generated from layer.json. Column types are the layer's logical types mapped to Snowflake;
-- the real warehouse may use narrower types. Point the layer at your own database and schema.

-- View "Batch Rotation" is a custom SQL view over the tables below:
--   {"type":"sql","statement":"WITH d AS (SELECT \"sku\", \"warehouse_id\", SUM(\"qty_shipped\")/28.0 AS daily FROM ASTRATO_GALLERY.ASTRATO.CORVO_INV_SALES_ORDERS WHERE \"order_date\" >= DATEADD(day,-28,CURRENT_DATE) GROUP BY 1,2), b AS (SELECT x.*, DATEDIFF(day,CURRENT_DATE,x.\"expiry_date\") AS dte, COALESCE(d.daily,0) AS daily, COALESCE(SUM(x.\"qty_on_hand\") OVER (PARTITION BY x.\"sku\",x.\"warehouse_id\" ORDER BY x.\"expiry_date\",x.\"batch_id\" ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0) AS ahead FROM ASTRATO_GALLERY.ASTRATO.CORVO_INV_BATCHES x LEFT JOIN d ON d.\"sku\"=x.\"sku\" AND d.\"warehouse_id\"=x.\"warehouse_id\" WHERE x.\"qty_on_hand\">0) SELECT b.\"batch_id\" AS batch_id, b.\"sku\" AS sku, p.\"product_name\" AS product_name, p.\"category\" AS category, b.\"warehouse_id\" AS warehouse_id, b.\"status\" AS status, b.\"received_date\" AS received_date, b.\"expiry_date\" AS expiry_date, b.dte AS days_to_expiry, CASE WHEN b.dte<=30 THEN '0-30 days' WHEN b.dte<=60 THEN '31-60 days' WHEN b.dte<=90 THEN '61-90 days' WHEN b.dte<=180 THEN '91-180 days' ELSE '180+ days' END AS expiry_band, b.\"qty_on_hand\" AS qty_on_hand, b.\"qty_on_hand\"*b.\"unit_cost_gbp\" AS stock_value_gbp, ROUND(b.daily,1) AS daily_run_rate, ROUND(b.\"qty_on_hand\"-GREATEST(0,LEAST(b.\"qty_on_hand\",b.daily*b.dte-b.ahead))) AS qty_at_risk, ROUND((b.\"qty_on_hand\"-GREATEST(0,LEAST(b.\"qty_on_hand\",b.daily*b.dte-b.ahead)))*b.\"unit_cost_gbp\",2) AS value_at_risk_gbp FROM b JOIN ASTRATO_GALLERY.ASTRATO.CORVO_INV_PRODUCTS p ON p.\"sku\"=b.\"sku\""}

-- View "Stock Position" is a custom SQL view over the tables below:
--   {"type":"sql","statement":"WITH k AS (SELECT p.\"sku\", p.\"product_name\", p.\"category\", p.\"supplier_id\", p.\"reorder_cover_days\", w.\"warehouse_id\" FROM ASTRATO_GALLERY.ASTRATO.CORVO_INV_PRODUCTS p CROSS JOIN ASTRATO_GALLERY.ASTRATO.CORVO_INV_WAREHOUSES w), s AS (SELECT \"sku\",\"warehouse_id\",SUM(IFF(\"status\"='Available',\"qty_on_hand\",0)) AS avail, SUM(IFF(\"status\"='Quarantine',\"qty_on_hand\",0)) AS quar FROM ASTRATO_GALLERY.ASTRATO.CORVO_INV_BATCHES GROUP BY 1,2), d AS (SELECT \"sku\",\"warehouse_id\",SUM(\"qty_shipped\")/28.0 AS daily FROM ASTRATO_GALLERY.ASTRATO.CORVO_INV_SALES_ORDERS WHERE \"order_date\">=DATEADD(day,-28,CURRENT_DATE) GROUP BY 1,2), o AS (SELECT \"sku\",\"warehouse_id\",SUM(\"qty_ordered\") AS inbound, MIN(\"expected_date\") AS next_due FROM ASTRATO_GALLERY.ASTRATO.CORVO_INV_PURCHASE_ORDERS WHERE \"status\" IN ('Open','Delayed') GROUP BY 1,2), c AS (SELECT k.*, COALESCE(s.avail,0) avail, COALESCE(s.quar,0) quar, COALESCE(d.daily,0) daily, COALESCE(o.inbound,0) inbound, o.next_due FROM k LEFT JOIN s ON s.\"sku\"=k.\"sku\" AND s.\"warehouse_id\"=k.\"warehouse_id\" LEFT JOIN d ON d.\"sku\"=k.\"sku\" AND d.\"warehouse_id\"=k.\"warehouse_id\" LEFT JOIN o ON o.\"sku\"=k.\"sku\" AND o.\"warehouse_id\"=k.\"warehouse_id\") SELECT \"sku\" AS sku, \"product_name\" AS product_name, \"category\" AS category, \"supplier_id\" AS supplier_id, \"warehouse_id\" AS warehouse_id, avail AS qty_available, quar AS qty_quarantine, ROUND(daily,1) AS daily_run_rate, ROUND(avail/NULLIF(daily,0),1) AS days_of_cover, \"reorder_cover_days\" AS reorder_cover_days, inbound AS qty_inbound, next_due AS next_po_due, CASE WHEN avail<daily*7 THEN 'Stockout risk' WHEN avail+inbound<daily*\"reorder_cover_days\" THEN 'Reorder now' WHEN avail>daily*120 THEN 'Overstocked' ELSE 'Healthy' END AS stock_status, GREATEST(0,CEIL(daily*(\"reorder_cover_days\"+30)-avail-inbound)) AS suggested_order_qty FROM c"}

-- Layer view(s): Corvo Inv Batches
CREATE TABLE IF NOT EXISTS "CORVO_INV_BATCHES" (
  "sku" VARCHAR,
  "status" VARCHAR,
  "batch_id" VARCHAR,
  "expiry_date" DATE,
  "qty_on_hand" NUMBER(38,0),
  "supplier_id" VARCHAR,
  "qty_received" NUMBER(38,0),
  "warehouse_id" VARCHAR,
  "received_date" DATE,
  "unit_cost_gbp" FLOAT
);

-- Layer view(s): Corvo Inv Movements
CREATE TABLE IF NOT EXISTS "CORVO_INV_MOVEMENTS" (
  "qty" NUMBER(38,0),
  "sku" VARCHAR,
  "TO_CHAR(""movement_date"",'YYYY-MM')" VARCHAR,
  "CASE WHEN ""movement_date"" > DATEADD(day,-30,CURRENT_DATE) THEN 'Last 30d' WHEN ""movement_date"" > DATEADD(day,-60,CURRENT_DATE) THEN 'Prior 30d' ELSE 'Older' END" VARCHAR,
  "batch_id" VARCHAR,
  "reference" VARCHAR,
  "created_by" VARCHAR,
  "movement_id" VARCHAR,
  "warehouse_id" VARCHAR,
  "movement_date" DATE,
  "movement_type" VARCHAR
);

-- Layer view(s): Corvo Inv Products
CREATE TABLE IF NOT EXISTS "CORVO_INV_PRODUCTS" (
  "sku" VARCHAR,
  "storage" VARCHAR,
  "category" VARCHAR,
  "supplier_id" VARCHAR,
  "product_name" VARCHAR,
  "unit_cost_gbp" FLOAT,
  "unit_price_gbp" NUMBER(38,0),
  "shelf_life_days" NUMBER(38,0),
  "reorder_cover_days" NUMBER(38,0),
  "min_remaining_shelf_days" NUMBER(38,0)
);

-- Layer view(s): Corvo Inv Purchase Orders
CREATE TABLE IF NOT EXISTS "CORVO_INV_PURCHASE_ORDERS" (
  "sku" VARCHAR,
  "TO_CHAR(""order_date"",'YYYY-MM')" VARCHAR,
  "po_id" VARCHAR,
  "CASE WHEN ""order_date"" > DATEADD(day,-30,CURRENT_DATE) THEN 'Last 30d' WHEN ""order_date"" > DATEADD(day,-60,CURRENT_DATE) THEN 'Prior 30d' ELSE 'Older' END" VARCHAR,
  "status" VARCHAR,
  "order_date" DATE,
  "qty_ordered" NUMBER(38,0),
  "supplier_id" VARCHAR,
  "qty_received" NUMBER(38,0),
  "warehouse_id" VARCHAR,
  "expected_date" DATE,
  "received_date" DATE
);

-- Layer view(s): Corvo Inv Sales Orders
CREATE TABLE IF NOT EXISTS "CORVO_INV_SALES_ORDERS" (
  "sku" VARCHAR,
  "TO_CHAR(""order_date"",'YYYY-MM')" VARCHAR,
  "CASE WHEN ""order_date"" > DATEADD(day,-30,CURRENT_DATE) THEN 'Last 30d' WHEN ""order_date"" > DATEADD(day,-60,CURRENT_DATE) THEN 'Prior 30d' ELSE 'Older' END" VARCHAR,
  "status" VARCHAR,
  "channel" VARCHAR,
  "order_id" VARCHAR,
  "order_date" DATE,
  "qty_ordered" NUMBER(38,0),
  "qty_shipped" NUMBER(38,0),
  "revenue_gbp" NUMBER(38,0),
  "warehouse_id" VARCHAR
);

-- Layer view(s): Corvo Inv Suppliers
CREATE TABLE IF NOT EXISTS "CORVO_INV_SUPPLIERS" (
  "country" VARCHAR,
  "supplier_id" VARCHAR,
  "on_time_rate" FLOAT,
  "supplier_name" VARCHAR,
  "lead_time_days" NUMBER(38,0)
);

-- Layer view(s): Corvo Inv Warehouses
CREATE TABLE IF NOT EXISTS "CORVO_INV_WAREHOUSES" (
  "country" VARCHAR,
  "warehouse_id" VARCHAR,
  "warehouse_name" VARCHAR,
  "pick_cutoff_hour" NUMBER(38,0)
);
