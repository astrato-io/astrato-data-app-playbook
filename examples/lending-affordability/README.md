# Affordability & lending decisions — Keystone Home Finance

A fictional UK lender's retail credit-risk team asks: *if we tighten or loosen our affordability
policy, who still passes, which rule rejects them, and how does that compare with the decisions we
actually made?* The app answers on 2,400 deterministic mock applications (Oct 2025 – Sep 2026):
income against expenses by month, region and income band; four threshold sliders that re-query
every Thresholds object; and a maker–checker queue where underwriters propose and approvers decide.
The hero finding in the seeded data: under the default policy only 1,200 of 2,400 applications pass
all four checks, *stressed* disposable income below £300 is the rule most often breached (882,
ahead of expenses share 620 and DTI 579), and the passers had a 90.5% historic approval rate against
62.1% overall. It is a hand-written Astrato App on Vite and the public `@astrato-io` packages (0.8).
This repository has no screenshots of it and none of its data: bring your own tables shaped like
the layer's [schema/ddl.sql](../../layers/keystone-lending/schema/ddl.sql).

## Tabs

- **Overview** — six headline cards (value, MoM/QoQ change, 12-month sparkline), income vs expenses by month (line) and by region (grouped bar, click to filter), expense mix by income band (stacked bar), approval rate by credit band, product table with a progress-bar column.
- **Thresholds** — sliders for max DTI, min disposable, min credit score, max expenses ÷ income and a +3% stress toggle; passer KPIs, lending requested and historic approval rate of passers, breach count per rule, passers by product and income band.
- **Decisions** — "Acting as" switcher, applicant search, three-lane board (Affordability check → Awaiting approval → Decided), modal applicant file with budget, live checks and audit trail; pipeline-by-stage bar and underwriter scorecard table.

## Worth copying

**Threshold sliders as range selections, one group per rule.** Each slider writes a `between`
selection on a stored per-application column (`Debt To Income`, `Stressed Disposable` or
`Disposable After Loan`, `Credit Score`, `Expense To Income`) into the `policy` group, so every
object in that group shows only passers ([app.js:227](project/src/app.js#L227)). Each rule also has
its own selection group holding only its breach range ([dashboard.js:30](project/src/dashboard.js#L30)),
so a headline `Applications` KPI mounted in that group is a governed breach count. The main filters
are mirrored into all of these groups ([app.js:240](project/src/app.js#L240)); updates are debounced 300 ms.

**Every object from a stored business question.** `fromQuestion` turns one of the 12 questions into
a tile's dimensions, measures, sort and period comparison; the tile adds only type, colours, formats
and display names ([dashboard.js:75](project/src/dashboard.js#L75)). Display names are re-applied after
theming by matching `resolvedRefs` ([app.js:175](project/src/app.js#L175)). Since an Astrato App cannot
read questions at runtime, `questions.mjs sync` copies their stored form into `app/questions.js`
([questions.mjs:111](project/tools/questions.mjs#L111)).

**KPI card = one-row table + change row + sparkline.** The value is a one-row table on the
`headline` question with its `All Applications` dimension hidden ([dashboard.js:96](project/src/dashboard.js#L96)).
The change is a one-row table on the month or quarter question whose `_chg` measure carries an
inter-record `growth`/`diff` calculation at offset 1, limited to the first row, rendered as a
two-segment indicator coloured so that rising expenses and DTI read red ([dashboard.js:158](project/src/dashboard.js#L158)).
QoQ rows mount only on the first QoQ click ([app.js:547](project/src/app.js#L547)).

**Maker–checker without a backend.** The underwriter proposes approve / decline / refer / counter-offer
with a required rationale; an approver must be a different person with a big enough mandate, or
escalates ([workflow.js:175](project/src/workflow.js#L175)). Actions are appended as events over the seeded
state in `localStorage` ([workflow.js:65](project/src/workflow.js#L65)), and the file shows the seeded
audit trail from a filtered `Workflow Events` query ([app.js:160](project/src/app.js#L160)) followed by
this browser's events.

**Selections on 0.8, with no workaround.** Earlier versions needed a wrapper for charts on governed
items to cross-filter. On 0.8 it was removed and nothing changed: the app's own check selects a
region, sees the Applications KPI move, clears, and sees it return ([app.js:573](project/src/app.js#L573));
the smoke test runs it. Chart clicks arrive as pending selections and are
re-applied as main-group filters after 250 ms ([app.js:590](project/src/app.js#L590)).

**All tabs preloaded, four mounts at a time.** Inactive tabs are absolutely positioned and
`visibility: hidden` rather than `display: none`, so charts keep their size ([brand.css:137](project/src/brand.css#L137));
every tile on every tab is mounted at load through four lanes ([app.js:631](project/src/app.js#L631)).
The chips and Clear-all are the library's `astrato-app-filter-bar` ([app.js:516](project/src/app.js#L516)).

## Semantic layer

[`layers/keystone-lending`](../../layers/keystone-lending/) ("Keystone Affordability & Decisions"):
views **Applications** (`LENDING_AFFORDABILITY`) and **Workflow Events** (`LENDING_WORKFLOW_EVENTS`),
joined many-to-one on `Applicant Id`.

- **Dimensions used:** All Applications, Application Month, Application Quarter, Region, Income Band, Credit Band, Product, Stage, Underwriter.
- **Measures used:** Applications, Avg Monthly Income, Avg Total Expenses, Avg Essential Expenses, Avg Housing Cost, Avg Groceries, Avg Utilities, Avg Transport, Avg Childcare, Avg Discretionary Spend, Avg Existing Debt, Avg Proposed Repayment, Avg Disposable After Loan, Debt to Income, Approval Rate, Requested Lending, Open Applications, Proposal Upheld Rate, Avg Days to Decision.
- **Questions (app key → title):** headline → What are the headline affordability metrics?; monthly → How do income and expenses trend by month?; region; mix → Where does the money go, by income band?; credit; products → How affordable is each product?; byProduct; byIncome; stage → Where are applications in the workflow?; underwriters → How are underwriters performing?; month / quarter → How did the headline metrics change month on month / quarter on quarter? Full list in [questions.md](../../layers/keystone-lending/questions.md).
- **Raw fields:** the slider ranges read `Debt To Income`, `Disposable After Loan`, `Stressed Disposable`, `Credit Score`, `Expense To Income`; filters read `Product`, `Region`, `Channel`; the board reads 34 Applications columns ([app.js:129](project/src/app.js#L129)); the audit trail reads `Step No`, `Step`, `Actor`, `Role`, `Action`, `Event Date`.
- Defined but unused by the app: Pass Rate, Expense Ratio, Approved, Approved Lending, Avg Requested Amount, Avg Credit Score, and dimensions such as Affordability Result, Outcome, Approver.

## Rebuild from nothing

1. **Data.** This repository ships no data and no data generator. Load your own applications into tables shaped like [`schema/ddl.sql`](../../layers/keystone-lending/schema/ddl.sql): the fact `LENDING_AFFORDABILITY` (ratios, bands, 0/1 flags, `APP_COUNT`, one row per application) and `LENDING_WORKFLOW_EVENTS` (one row per workflow step). The figures quoted above came from 2,400 synthetic applications.
2. **Layer.** With `ASTRATO_MCP_URL` and `ASTRATO_PAT` set (`tools/mcp.mjs` is the bundled MCP client): `node tools/layer.mjs create <datasourceId>` → `astrato init . --semantic-layer-id <id>` → `SAMPLE_DATABASE=… SAMPLE_SCHEMA=… node tools/layer.mjs views` (where your tables are) (both views, all fields, the join) → `node tools/layer.mjs model` (18 dimensions, 25 measures).
3. **Questions.** `node tools/questions.mjs questions` creates or replaces the 12 questions, validates and publishes; then `node tools/questions.mjs sync` regenerates `app/questions.js`. Re-run `sync` whenever a question changes.
4. **App.** See Run it. The layer must be published before the app can see steps 2–3.

## Run it

```sh
cd project
npm install                # public npm: @astrato-io/app-runtime, @astrato-io/visualizations, vite
# set semanticLayerId in astrato.json to your copy of the layer (it ships as a zero placeholder)
astrato login
npm run compile-check      # every tile compiles against the installed library, no session needed
astrato dev .              # open the sign-in URL it prints
node ../../../kit/verify/smoke.mjs "<that sign-in URL>" --scroll-ok
astrato build .
```

Needs Node 24.18 or later. Right-click any object for "View data…"
(the same governed query as a table), "Reset all filters" or "Reload object".

## Caveats

- **No writeback.** Workflow actions live in `localStorage` only; the seeded stage, proposal and audit trail come from the layer.
- KPIs are one-row `table` objects, not number objects.
- The board, applicant file and Pass/Marginal/Fail badges are chrome over one `getData` of all rows (limit 3000). `assess()` only compares stored ratios with slider values, but it does run in the browser ([workflow.js:36](project/src/workflow.js#L36)).
- Breach ranges use epsilon bounds (`max + 1e-6`, `min - 1`) to express strict inequalities as `between`.
- September 2026 is partly open, so its MoM approval-rate change compares a partial month with a whole one.
- Ported from visualizations 0.6 to 0.8. Three things changed in code: the line-curve value, the two table column-format operations ([theme.js:79](project/src/theme.js#L79)), and the cross-filter wrapper was removed. See [status on 0.8](../../knowledge/README.md#status-on-08).
- One selection re-queries every object on every tab (about 76 queries), because all tabs share one selection group. Give each tab its own group instead ([preload tabs](../../patterns/preload-tabs.md)).
- The overview tab scrolls sideways by 24px at 1440 wide.
