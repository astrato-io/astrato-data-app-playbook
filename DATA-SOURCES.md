# Data sources

**This repository contains no data.** It holds semantic layers, the apps built on them and the
playbook, not the rows those apps ran on. There are no tables, extracts, CSV or JSON row files,
dimension profiles, data generators, seed or reset scripts here.

What each layer does ship is its model: `layer.json` and `layer.ossie.yaml` (views, fields,
joins, dimensions, measures, stored business questions), `questions.md`, and `schema/ddl.sql`,
the empty tables it expects. Some examples also have screenshots, and some READMEs quote a few
figures from the data the example was built on, to explain its story.

To run an example, load your own tables shaped like its layer's `schema/ddl.sql` into your
warehouse, point a copy of the layer at them, then profile that copy over MCP
([playbook step 1](playbook/1-read-the-layer.md)). For the public datasets below, the original
sources are listed if you want to rebuild them yourself, on their owners' terms.

The [MIT licence](LICENSE) covers this repository's code and documentation. It does not cover any
third-party dataset, name or logo referred to here.

## Public datasets

These examples were built on public data. Rebuilding them is up to you and subject to each
source's terms.

| Example | Layer | Tables it expects | Original source | Licence or terms |
| --- | --- | --- | --- | --- |
| [labour-market-pulse](examples/labour-market-pulse/) | [uk-labour-market](layers/uk-labour-market/) | `LMS_FACT` (one row per series per month) | Office for National Statistics, [UK Labour Market Statistics](https://www.ons.gov.uk/employmentandlabourmarket/peopleinwork/employmentandemployeetypes/bulletins/uklabourmarket/previousReleases) (the example used the release of 15 Sep 2026) | [Open Government Licence v3.0](https://www.nationalarchives.gov.uk/doc/open-government-licence/version/3/). Attribution: *Contains public sector information licensed under the Open Government Licence v3.0.* |
| [hotel-weather](examples/hotel-weather/) (weather half) | none: read at run time | none | [Open-Meteo historical weather API](https://open-meteo.com/en/docs/historical-weather-api), queried in the browser by the app | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/); the app and README show the attribution. Nothing is stored. |
| [thessaloniki-on-the-move](examples/thessaloniki-on-the-move/) | [thessaloniki-transit](layers/thessaloniki-transit/) | `TH_SERVICE`, `TH_LINES`, `TH_STOPS`, `TH_LINE_STOPS`, `TH_FLEET_MINUTE`; optionally a one-day trips extract at `project/public/sim-day.json` for the animated day (shape documented in `project/src/sim.js`) | The public GTFS timetable feed of the Thessaloniki transport authority, [OSETH](https://oseth.com.gr/) (the example used 14 Jul – 3 Aug 2026) | **Not confirmed.** Check the feed's terms before rebuilding or redistributing anything derived from it. |
| [ed-wait-watch](examples/ed-wait-watch/) | [hospital-er-operations](layers/hospital-er-operations/) | `HOSPITAL_ER_V` (one row per emergency-department visit), plus the empty workflow tables `ER_WAIT_FLAGS` and `ER_WAIT_FLAG_EVENTS` | A public hospital emergency-room visit-log sample, distributed with a BI vendor's tutorials | **Not stated** by its publisher. |
| [superstore-explorer](examples/superstore-explorer/), [report-builder](examples/report-builder/) | [superstore-sample](layers/superstore-sample/) | `orders` (one row per order line) | The "Sample - Superstore" demonstration dataset published with a BI vendor's product (fictional orders and customers) | **Not stated** by its publisher; widely redistributed for demonstration. |
| [league-table-planner](examples/league-table-planner/) | [uk-university-rankings](layers/uk-university-rankings/) | `UNI_FACT`, `UNI_HISTORY_FACT`, `UNI_SUBJECT_FACT` | A commercially published UK university league table (copyrighted editorial content, not open data) | **Not cleared for redistribution.** Use a table you are licensed to use, or an openly licensed source such as [HESA open data](https://www.hesa.ac.uk/data-and-analysis) mapped to these tables. |

## Synthetic data

These examples were built on synthetic data. Companies, people and figures in it are fictional;
any resemblance to a real organisation is unintended. Neither the data nor the scripts that
generated it are included: load your own data of the same shape.

| Example | Layer | Tables it expects |
| --- | --- | --- |
| [lending-affordability](examples/lending-affordability/) | [keystone-lending](layers/keystone-lending/) | `LENDING_AFFORDABILITY`, `LENDING_WORKFLOW_EVENTS` |
| [portfolio-os](examples/portfolio-os/) | [northstar-portfolio](layers/northstar-portfolio/) | `NSC_COMPANIES`, `NSC_FUNDS`, `NSC_FINANCIALS`, `NSC_STATEMENT_LINES`, `NSC_KPIS_MONTHLY`, `NSC_VALUATIONS`, `NSC_CASHFLOWS`, `NSC_FUND_RETURNS`, `NSC_FX_RATES`, `NSC_DEBT_FACILITIES`, `NSC_THESIS`, `NSC_PLANS`, `NSC_INITIATIVES`, `NSC_INITIATIVE_QUARTERS`, `NSC_NEXT_PERIOD`, the workflow tables `NSC_WF_RECORDS` and `NSC_WF_EVENTS`, and the reset copies `NSC_VALUATIONS_SEED` and `NSC_PLANS_SEED` |
| [snowline](examples/snowline/) | [ski-resort-operations](layers/ski-resort-operations/) | `SKI_RESORTS`, `SKI_WEEKS`, `SKI_RESORT_WEEKS`, `SKI_ASSUMPTIONS`, `SKI_SOURCES` |
| [hotel-weather](examples/hotel-weather/) (hotel half) | [harbourline-hotels](layers/harbourline-hotels/) | `HLH_HOTELS`, `HLH_HOTEL_DAYS`, `HLH_STAYS`, `HLH_CALENDAR`, `HLH_CHANNELS`, `HLH_SEGMENTS`, `HLH_OPPORTUNITIES`, `HLH_SCENARIOS`, `HLH_ACTION_EVENTS` (city names must match the app's weather city list) |
| [agency-client-reporting](examples/agency-client-reporting/) | [agency-performance](layers/agency-performance/) | `AGENCY_ADS`, `AGENCY_GA4`, `AGENCY_SEO`, `AGENCY_CLIENTS`, `AGENCY_CHANNELS`, `AGENCY_MONTHS` (real ad and analytics platforms appear only as source-system names) |
| [royalty-close](examples/royalty-close/) | [royalty-engine](layers/royalty-engine/) | `ROYALTY_BRANCHES`, `ROYALTY_SONGS`, `ROYALTY_STATEMENTS`, `ROYALTY_STATEMENT_AMOUNTS`, `ROYALTY_INCOME_DETAIL`, `ROYALTY_SUSPENSE_DETAIL`, `ROYALTY_CALC_ERRORS`, `ROYALTY_PVC_LINES`, `ROYALTY_RECEIPTS`, `ROYALTY_SONG_BRANCH_COLLECTABLE`, `ROYALTY_USERS`, and the writeback tables `ROYALTY_CLOSE_CASES`, `ROYALTY_CLOSE_EVENTS`, `ROYALTY_CLAIMS`, `ROYALTY_CLAIM_EVENTS`, `ROYALTY_RECOVERIES` (real music services and societies appear only as payer names) |
| [stock-rotation](examples/stock-rotation/) | [inventory-rotation](layers/inventory-rotation/) | `CORVO_INV_PRODUCTS`, `CORVO_INV_WAREHOUSES`, `CORVO_INV_SUPPLIERS`, `CORVO_INV_BATCHES`, `CORVO_INV_MOVEMENTS`, `CORVO_INV_PURCHASE_ORDERS`, `CORVO_INV_SALES_ORDERS` |
| [people-intelligence](examples/people-intelligence/) | [people-intelligence](layers/people-intelligence/) | the 20 `PEOPLE_*` tables in its `schema/ddl.sql` (real HR software appears only as source-system names) |
| [revenue-war-room](examples/revenue-war-room/) | [live-gallery](layers/live-gallery/) ("Four Businesses (demo)") | the tables in its `schema/ddl.sql`: `NB_*` (the SaaS business), plus `KR_*`, `HB_*` and `F1_*` for the layer's other fictional businesses (see its README) |

Every `schema/ddl.sql` is generated from the layer's logical types; your warehouse may use
narrower types. Database and schema names in the layers are placeholders.

## Map tiles, fonts and logos

- **Basemaps.** [thessaloniki-on-the-move](examples/thessaloniki-on-the-move/) and
  [people-intelligence](examples/people-intelligence/) fetch Esri ArcGIS Online tiles with no key
  (`src/basemap.js`), with a MapTiler option whose key is left empty. Attribution is shown, but
  Esri's and MapTiler's terms generally require an account for use in an application. Use a
  licensed tile provider in production.
- **Fonts** come from Google Fonts or `@fontsource` packages, under the SIL Open Font Licence or
  Apache 2.0.
- **Logos.** The Astrato logos belong to Astrato. Third-party product names appear only as text,
  to name a data source.
