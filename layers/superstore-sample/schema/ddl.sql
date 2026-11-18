-- Tables behind the "Superstore Sample" semantic layer.
-- Generated from layer.json. Column types are the layer's logical types mapped to Snowflake;
-- the real warehouse may use narrower types. Point the layer at your own database and schema.

-- Layer view(s): Orders
CREATE TABLE IF NOT EXISTS "orders" (
  "sales" FLOAT,
  "state" VARCHAR,
  "profit" FLOAT,
  "region" VARCHAR,
  "country" VARCHAR,
  "segment" VARCHAR,
  "category" VARCHAR,
  "discount" FLOAT,
  "order_id" VARCHAR,
  "quantity" NUMBER(38,0),
  "returned" VARCHAR,
  "ship_date" DATE,
  "ship_mode" VARCHAR,
  "order_date" DATE,
  "product_name" VARCHAR,
  "sub_category" VARCHAR,
  "customer_name" VARCHAR
);
