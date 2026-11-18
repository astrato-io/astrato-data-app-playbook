-- Tables behind the "Hospital ER Operations" semantic layer.
-- Generated from layer.json. Column types are the layer's logical types mapped to Snowflake;
-- the real warehouse may use narrower types. Point the layer at your own database and schema.

-- Layer view(s): ER Visits
CREATE TABLE IF NOT EXISTS "HOSPITAL_ER_V" (
  "ER_DAY" DATE,
  "ER_DATE" TIMESTAMP_NTZ,
  "ER_HOUR" NUMBER(38,0),
  "ER_WEEK" DATE,
  "ER_YEAR" NUMBER(38,0),
  "AGE_BAND" VARCHAR,
  "ER_MONTH" DATE,
  "ER_QUARTER" DATE,
  "PATIENT_ID" VARCHAR,
  "ADMIN_LABEL" VARCHAR,
  "PATIENT_AGE" NUMBER(38,0),
  "WEEKDAY_NUM" NUMBER(38,0),
  "GENDER_LABEL" VARCHAR,
  "HAS_REFERRAL" NUMBER(38,0),
  "PATIENT_RACE" VARCHAR,
  "WEEKDAY_NAME" VARCHAR,
  "ADMIN_FLAG_NUM" NUMBER(38,0),
  "PATIENT_GENDER" VARCHAR,
  "PATIENT_WAITTIME" NUMBER(38,0),
  "PATIENT_LAST_NAME" VARCHAR,
  "PATIENT_SAT_SCORE" NUMBER(38,0),
  "PATIENT_ADMIN_FLAG" BOOLEAN,
  "DEPARTMENT_REFERRAL" VARCHAR,
  "PATIENT_FIRST_INITIAL" VARCHAR
);

-- Layer view(s): Er Wait Flag Events
CREATE TABLE IF NOT EXISTS "ER_WAIT_FLAG_EVENTS" (
  "note" VARCHAR,
  "actor" VARCHAR,
  "action" VARCHAR,
  "flag_id" VARCHAR,
  "event_at" TIMESTAMP_NTZ,
  "event_id" VARCHAR,
  "to_status" VARCHAR,
  "actor_role" VARCHAR,
  "from_status" VARCHAR
);

-- Layer view(s): Er Wait Flags
CREATE TABLE IF NOT EXISTS "ER_WAIT_FLAGS" (
  "note" VARCHAR,
  "issue" VARCHAR,
  "owner" VARCHAR,
  "scope" VARCHAR,
  "status" VARCHAR,
  "flag_id" VARCHAR,
  "weekday" VARCHAR,
  "due_date" DATE,
  "time_band" VARCHAR,
  "created_at" TIMESTAMP_NTZ,
  "created_by" VARCHAR,
  "department" VARCHAR,
  "updated_at" TIMESTAMP_NTZ,
  "updated_by" VARCHAR
);
