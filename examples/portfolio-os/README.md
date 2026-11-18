# Private Markets Portfolio OS — Northstar Capital Partners

A hand-written Astrato App on Vite and the public `@astrato-io` packages (0.8) for a fictional private-equity firm with 36 portfolio companies across four funds. Users monitor, value, model and decide in it, and it writes those decisions back. Every module serves one question the synthetic data it was built on told: **should the Investment Committee accept a ~$180m cut to the value of Northstar's stake in Meridian Cloud Systems?** In that data Meridian deteriorates from 2025 (falling gross margin, rising churn and DSO, two revolver-funded draws) and is marked High risk and "Review required", and its Downside Case sits about $180m below the base case. Neither the data nor its generator is in this repository. In the app, Meridian is the default company on Companies, Valuations, Scenario Lab, Investment Committee and exports. The gap appears in the Scenario Lab "Downside vs base" waterfall ([scenario.js:86](project/src/pages/scenario.js#L86)), in Nash's company explanation ([nash.js:106](project/src/pages/nash.js#L106)) and in the IC package's alternative scenarios ([ic.js:44](project/src/pages/ic.js#L44)). The figure is computed live from the governed Plans rows, not stored.

This repository has no screenshots of it and none of its data.

## Modules

One file per page in `project/src/pages/`. All ten panes mount at start-up.

- [portfolio.js](project/src/pages/portfolio.js): command centre. Review flags computed from governed financials, a returns strip (pooled XIRR), six KPI cards, the investment register, contributors, concentration and risk scatter, saved views, and a compare drawer for two or more selected companies.
- [company.js](project/src/pages/company.js): one investment across six inner tabs (overview, statements with line drill-down and lineage, thesis tracker, valuation, capital structure, operating KPIs). The page drives selection group `g-company`.
- [monitoring.js](project/src/pages/monitoring.js): quarterly cycle. Request checklist, pasted-statement ingestion with regex label mapping and human review, nine deterministic validation rules, and a Draft → Locked approval flow.
- [analysis.js](project/src/pages/analysis.js): price/volume/mix/cost EBITDA bridge across six comparison windows, an investigation drawer, and native growth, leverage, liquidity and forecast-accuracy objects.
- [valuations.js](project/src/pages/valuations.js): valuation workbench. Six methods on the same inputs (EV/EBITDA, EV/Revenue, DCF, transaction calibration, entry multiple, scenario-weighted), evidence, a bridge, then propose → challenge → approve → publish.
- [scenario.js](project/src/pages/scenario.js): 14 driver sliders over a five-year model, a four-case comparison, two sensitivity grids and propagation to fund and portfolio. Save, submit and approve; an approved scenario becomes the operating plan.
- [value.js](project/src/pages/value.js): value-creation initiatives sized from LTM financials, a six-state workflow, planned vs realised EBITDA, and native KPIs and register.
- [ic.js](project/src/pages/ic.js): decision packages (six types). Approving one writes its effects: adopts a plan, approves a valuation, moves a company to exit preparation, and creates actions from conditions.
- [workflows.js](project/src/pages/workflows.js): my queue, all workflow records, a role × permission matrix, workflow rules, and a searchable audit history.
- [nash.js](project/src/pages/nash.js): routes a typed question by keyword overlap to one of 24 business questions, runs it with `engine.getData`, renders a native table and writes the narrative from the returned rows. It can draft actions, which a human confirms.

## Worth copying

**Workflow store on governed views, with an honest fallback.** [core.js:176](project/src/core.js#L176) `saveRecord` inserts or updates a row in the `Workflow Records` view and appends an `Audit Events` row (actor, role, previous and new value, reason, approval ref) through `app.writeback` ([app.js:78](project/src/app.js#L77)). If writeback is missing or fails, [core.js:161](project/src/core.js#L161) keeps the change in `localStorage`, and the toast says "simulated persistence". `writeTable` ([core.js:205](project/src/core.js#L205)) applies the same pairing to analytical tables (Valuations, Plans, Initiatives, Companies). Permissions are a plain map ([core.js:55](project/src/core.js#L55)) checked before every write. Maker–checker checks block self-approval, for example [scenario.js:124](project/src/pages/scenario.js#L124).

**KPI card with a sparkline and a prior-period comparison, all native.** [catalogue.js:63](project/src/catalogue.js#L63) builds three objects per KPI:
- a `number`;
- a line or bar sparkline over `Quarter`;
- a header-less one-row `table` holding the prior value and the delta.

The delta column uses indicator segments ([catalogue.js:14](project/src/catalogue.js#L14)) to turn red or green depending on which direction counts as good. [app.js:154](project/src/app.js#L153) lays out the three.

**Selections reach measure-only objects.** Numbers and one-row tables have no dimension to receive a selection. [app.js:219](project/src/app.js#L218) subscribes to each page's group and rebuilds those objects' vSpecs with `setStaticFilterGroup`. It only uses selections on views the KPI can join (`Companies`, `Funds` or the KPI's own view) and drops stale runs. Pending selections are auto-applied after 250 ms ([app.js:57](project/src/app.js#L56)).

**One deterministic engine for the data and the app.** [engine.js:70](project/src/engine.js#L70) `projectScenario` (with XIRR, multiple valuation and DCF in the same file) produced the stored plans and valuations, and the app imports the same code for Scenario Lab, Valuations and IC, so stored figures such as the $180m downside reproduce exactly in the UI. Validation rules live in the same file ([engine.js:119](project/src/engine.js#L119)).

**Query lanes around `engine.getData`.** [throttle.js:110](project/src/throttle.js#L110) wraps the host's query services:
- at most four queries in flight;
- HTTP 429 retried with exponential backoff, and hung requests timed out after 45 s and retried;
- answers cached for the session, keyed by the exact request;
- a guard against tables that re-query in a loop.

`clearQueryCache` runs after every write ([app.js:81](project/src/app.js#L80)).

**Styled Excel without a library.** [xlsx.js:207](project/src/xlsx.js#L207) writes OOXML with fills, fonts, borders, custom number formats, merges and frozen panes, zipped uncompressed. The six reports in [export.js:15](project/src/export.js#L15) reuse the governed rows and the engine. Each export is audited, and a print-to-PDF variant shares the same sheets.

Also useful:
- hidden panes laid out off-screen at the active pane's width, so preloaded charts keep their size ([styles.css:59](project/src/styles.css#L59), [app.js:246](project/src/app.js#L245));
- table column widths fitted with a ResizeObserver ([app.js:353](project/src/app.js#L352)).

## Semantic layer

`layers/northstar-portfolio/layer.json` (Semantic Layer V2) has 19 views, 14 joins (most many-to-one to `Companies` on `Company`), 40 dimensions, 137 measures and 24 business questions ([questions.md](../../layers/northstar-portfolio/questions.md)). Ratios are recomputed from summed parts, and snapshot balances are filtered to one quarter.

- **Views the app reads:** `Companies`, `Funds`, `Financials`, `Valuations`, `Cash Flows`, `Plans`, `Debt Facilities`, `Investment Thesis`, `Initiatives`, `Initiative Quarters`, `Operating KPIs`, `Next Period`, `Fund Returns`, `FX Rates` ([data.js:13](project/src/data.js#L13)). `Valuation Seed` is read for reset.
- **Views the app writes:** `Workflow Records` and `Audit Events`, plus `Valuations`, `Plans`, `Initiatives` and `Companies`.
- **Key measures:**
  - Valuation: `Fair Value` (current approved mark, `Is Current = 1`), `Prior Fair Value`, `Valuation Movement`/`%`, the eight `Bridge *` measures, `Fair Value at Quarter`, `Proposed Fair Value Q3`, `Q3 Valuation Movement`.
  - Returns: `Gross MOIC`, `Gross IRR`.
  - Operating: `Revenue LTM`/`PLTM`, `Revenue Growth`, `EBITDA LTM`/`PLTM`, `EBITDA Margin LTM`/`Change`, `EBITDA vs Underwriting`, `Budget Variance Latest Quarter`.
  - Debt and cash: `Net Leverage` (+`PY`, `Change`), `Interest Coverage` (+`+100bp`), `Cash Conversion`.
  - Value creation: `Realised`/`Planned`/`Estimated EBITDA Impact`, `Benefit Realisation`.
  - Workflow: `Workflow Records`, `Audit Events`.
- **Business questions:** the same 24 as [src/questions.js](project/src/questions.js) (e.g. "Which portfolio companies require investment review?", "What are the principal drivers of valuation movement this quarter?", "Which companies are most sensitive to a 100-basis-point increase in financing costs?"). Only Nash uses them.

## Rebuild from nothing

1. **Data.** This repository ships no data and no data generator. Load your own portfolio data into `NSC_*` tables shaped like [schema/ddl.sql](../../layers/northstar-portfolio/schema/ddl.sql), including `NSC_STATEMENT_LINES` and the `*_SEED` copies (valuations, plans, workflow records, workflow events, initiatives) that Reset demo restores from. The tools hard-code `ASTRATO_GALLERY.MOCK_DATA` ([layer.mjs:29](project/tools/layer.mjs#L29)).
2. Restoring the seeds in the warehouse is, per table, `DELETE FROM NSC_<T>; INSERT INTO NSC_<T> SELECT * FROM NSC_<T>_SEED;` for valuations, plans, workflow records, workflow events and initiatives.
3. `node tools/types.mjs` derives column types into `tools/types.txt` from CSV exports of those tables placed in `project/load/` (keep that folder out of git).
4. Build the layer through the Astrato MCP server. [layer.mjs](project/tools/layer.mjs) calls the bundled MCP client `tools/mcp.mjs`; set `ASTRATO_MCP_URL` and `ASTRATO_PAT` first.
   - `node tools/layer.mjs create`, after setting `datasourceId` ([layer.mjs:25](project/tools/layer.mjs#L25)). Put the new id in `astrato.json`.
   - Then run `views`, then `model` (measures), then `DIMS=1 node tools/layer.mjs model` (dimensions), then `schema`, then `validate`, then `publish <layerId> <revision>`.
5. `node tools/questions.mjs` commits the 24 business questions from `src/questions.js`.

Instead of steps 3–5, you can recreate the layer from `layers/northstar-portfolio/layer.json`.

## Run it

```sh
cd project
npm install                 # public npm: @astrato-io/app-runtime, @astrato-io/visualizations, vite
# set semanticLayerId in astrato.json to your copy of layers/northstar-portfolio (it ships as all zeros)
npm run compile-check       # every tile compiles against the installed library, no session needed
astrato dev .               # open the sign-in URL it prints
node ../../../kit/verify/smoke.mjs "<that sign-in URL>"
astrato build .
```

Needs Node 24.18 or later.

Point `astrato.json` → `semanticLayerId` at your copy of the layer; `app.writeback` writes to the same layer (`app.dataBinding.semanticLayerId`). Writes need a runtime and layer that accept writeback. Otherwise every workflow change stays in the browser and is labelled as such.

## Caveats

- Native objects query layer measures directly. Stored business questions are used only by Nash, from the app's own copy. Nash is keyword routing plus deterministic narrative, with no language model.
- Dates are fixed: Q3 2026, `TODAY = 2026-11-09` ([core.js:42](project/src/core.js#L42)), and 12 quarters ([data.js:65](project/src/data.js#L65)). The "Q4 2026" period is simulated.
- The CCY selector converts HTML figures only. Native objects stay in USD.
- **Reset demo** deletes every non-seed workflow record for all users. The authoritative reset is in the warehouse: copy each `*_SEED` table back over its live table (see Rebuild from nothing).
- `prefetchSelections` ([throttle.js:68](project/src/throttle.js#L68)) is never called.
- The waterfalls (valuation, EBITDA, scenario) and small sparks in HTML sheets are hand-drawn SVG ([ui.js:32](project/src/ui.js#L32)), not native objects.
- Ported from visualizations 0.5 to 0.8 (2026-11) and checked in headless Chrome with the kit smoke test: 71 objects across ten modules rendered with no errors. Changes for 0.8: the table column-format operations, table width refits through `applyRuntimeOperations` instead of `updateInstance`, and the cross-filter wrapper removed. The entry file is now `src/app.js`; `src/main.js` is the Vite entry.
- The static-filter mirror for KPI objects ([app.js:219](project/src/app.js#L218)) is no longer needed for `number` objects: with it switched off, the Revenue KPI still followed a fund selection. It is kept because the one-row delta tables were not tested without it.
- Some KPI comparison labels are cut off (`PY $17…`), and the table sparkline column shows dots rather than lines, probably because the table is filtered to one quarter ([why](../../knowledge/tables.md#a-sparkline-column-draws-a-single-dot)).
- One selection re-queries objects on every tab (about 140 queries).
