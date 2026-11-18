-- Tables behind the "UK Labour Market (ONS LMS)" semantic layer.
-- Generated from layer.json. Column types are the layer's logical types mapped to Snowflake;
-- the real warehouse may use narrower types. Point the layer at your own database and schema.

-- Layer view(s): Labour Market
CREATE TABLE IF NOT EXISTS "LMS_FACT" (
  "SEX" VARCHAR,
  "CDID" VARCHAR,
  "UNIT" VARCHAR,
  "THEME" VARCHAR,
  "VALUE" FLOAT,
  "METHOD" VARCHAR,
  "GEOGRAPHY" VARCHAR,
  "INDICATOR" VARCHAR,
  "ONS_TITLE" VARCHAR,
  "PERIOD_DATE" DATE,
  "PERIOD_YEAR" NUMBER(38,0),
  "PERIOD_LABEL" VARCHAR,
  "PERIOD_STATUS" VARCHAR,
  "VALUE_PREV_YEAR" FLOAT,
  "VALUE_PRE_PANDEMIC" FLOAT,
  "VALUE_PREV_QUARTER" FLOAT,
  "MONTHS_BEFORE_LATEST" NUMBER(38,0)
);
