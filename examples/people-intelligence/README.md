# People Intelligence — Northwind Telecom

A fictional telecom group's HR leadership asks: *where do attrition, workforce cost and skills risk
sit, and which interventions should we fund and approve?* The Group CHRO sees the whole group;
three other roles, a regional HR director, an HR business partner and a business-unit leader, open
the same link and see only their slice. Thirteen tabs run on one governed semantic layer of 20
joined HR views over mock data (monthly to 30 September 2026): workforce, movement and cost,
retention with a structured investigation, succession risk, diversity with privacy thresholds,
skills to 2028, a retention simulator and an FY28 restructuring planner, an approvals register
written back as events, data operations, an assistant that answers only from stored business
questions, and a self-service custom report builder.

It is the largest example (213 native objects) and the one to open for **role-scoped data**
and for **the custom report builder**. A hand-written Astrato App on Vite and the public
`@astrato-io` packages (visualizations 0.9, app-runtime 0.8).

No screenshots are shipped yet.

## Tabs

- **My People Home** — a greeting and suggested questions for the assistant; four hero KPI cards (total workforce, voluntary attrition, critical skills coverage, cost vs budget) with governed benchmarks; "Your People Intelligence Briefing", prioritised insights written from governed queries for the viewer's scope; a business-unit scorecard joining every source; attrition hotspots ranked by replacement exposure; rolling attrition by business unit; attrition change and cost vs budget by business unit; a data-status banner.
- **Workforce Explorer** — seven filters and eight KPI cards; a "what changed" panel that follows the selection; workforce distribution with switchable dimension and drill-down; headcount and attrition trend; a map of where people are; hiring, departures and net movement; voluntary vs involuntary attrition; cost vs budget; absence and engagement; an organisation sankey; a country × business-unit heatmap; a segment scorecard and a monthly people report.
- **Talent & Retention** — six KPI cards; a structured investigation (trend, comparison, drivers shown as associations, exposure, interventions) that opens when a business unit is clicked on the risk matrix, a heatmap cell or a scorecard row; attrition by region, function, level and segment (switchable and drillable); a privacy-safe age × gender segment chart; the retention risk matrix; where attrition is accelerating; compensation vs attrition; high-performer retention; engagement drivers; reasons and destinations of leavers; a retention scorecard.
- **Talent & Succession Risk** — six KPI cards; a key-person risk × impact-of-loss matrix; succession status; ready-now coverage by business unit now vs a year ago; the successor pipeline; coverage by country × business unit; a critical-role register (roles, never names); critical roles with a woman successor.
- **Diversity & Inclusion** — a privacy panel stating the rules; six KPI cards; the leaky pipeline; women's representation heatmap (blank where fewer than 10); attrition and promotion equity; gender pay gap and UK ethnic-minority representation, both locked for roles not cleared for special-category data; a privacy-thresholded country × department × gender table; age profile.
- **Skills & Future Workforce** — six KPI cards; a skills × business-unit heatmap; a skills adjacency explorer; demand vs supply to 2028; coverage now vs a year ago; a skills adjacency sankey; build · buy · borrow options for a target skill; shortfall by country; open critical roles vs internal matches; a skills inventory and a recruiting report.
- **Workforce Simulator** — two modes. *Retention intervention*: five levers (retention target, pay adjustment, L&D, internal mobility, hiring freeze) and four presets over one population's governed baseline; 12-month outcome against the current trajectory, a financial waterfall, cumulative leavers, every assumption listed; save, compare, copy a leadership summary, submit for approval or turn into an action plan. *Demand & restructuring plan*: FY28 demand per function group, absorption by attrition and redeployment levers, a headcount bridge and the governed baseline table.
- **People Actions** — the intervention register from insight to outcome: create, edit, submit and approve (maker–checker), milestones, an audit trail; investment vs expected and realised benefit; the portfolio by type; the writeback log of every workflow step.
- **Custom report** — see Worth copying.
- **Question library** — the 61 questions the assistant answers from, in 15 categories; click one to run it as a native table (with a sparkline column where it has a monthly twin), or ask it with a narrative.
- **Data operations** — six KPI cards; a freshness board per source feed; an integration status board; an issue triage queue (acknowledge, assign, resolve, escalate); runs per day by outcome; issues by category; time to resolve; the error log and the issue register.
- **Data & governance** — the architecture from source systems through the semantic layer to the app, and a role-based access matrix with a "view as" button per persona.
- **Capability tour** — ten capabilities, each with where it is shown and a "Show me" button that switches to that tab and persona.

The header carries **Export** (the executive-summary workbook) and **Ask People Intelligence** (the assistant drawer). The sidebar foot holds the persona picker.

## Worth copying

**The custom report builder.** A self-service report on the Custom report tab, modelled on Astrato's
Custom Report object, in two files and a block of CSS. To copy one into your own app, start from
[report-builder](../report-builder/): the same idea, standalone, on any layer. This one adds personas.

- *The state and the spec.* The report is one plain object: name, visual, an ordered list of
  fields (`{ kind: 'd' | 'm', name, on }`), sort, per-dimension value filters and a row limit.
  `reportSpec` turns it into an ad-hoc tile spec and touches nothing else
  ([builder.js:59](project/src/builder.js#L59)): dimensions are resolved through `DIM_FIELD`, filters
  become `[field, view, values]`, the sort becomes a `d`/`m` reference, and each visual takes what it
  can show: a table everything; a pivot, a table with the last dimension across the columns; a heat
  map two dimensions and one measure; a scatter one dimension and up to three measures; a bar up to
  two dimensions (stacked) or four measures, falling back to the first measure's sort when the sorted
  field is not drawn. Each visual's minimum is checked first, with a hint in place of the chart
  ([builder.js:37](project/src/builder.js#L37)). Because it is pure, the compile check runs the seven
  starter reports through it offline ([compile-adapter.mjs:19](project/tools/compile-adapter.mjs#L19)).
- *The ad-hoc object.* `adhocTile` turns the spec into a tile definition with the persona's scope
  added to its filters, table formats from the layer's display patterns, right-aligned measures and
  fixed row heights ([adhoc.js:14](project/src/adhoc.js#L14)); `ctx.renderTile` builds, compiles,
  themes and mounts it in its own `g-rb` selection group ([app.js:581](project/src/app.js#L581));
  tables get pixel column widths from `fitColumnOps` ([adhoc.js:39](project/src/adhoc.js#L39)).
  Every change re-renders after 350 ms; a run counter drops results that arrive after a newer
  change, and the previous object is removed first ([builder.js:246](project/src/builder.js#L246)).
- *The chip bar.* A visual chip with a menu of the five visuals, then one chip per field: click the
  name to disable it (struck through, kept in place), drag to reorder, the filter icon for sort and
  filter, × to remove; a rows picker (25 to 2,000) and Clear ([builder.js:112](project/src/builder.js#L112)).
  Reordering is native HTML drag and drop on the chips, splicing the field list
  ([builder.js:124](project/src/builder.js#L124)).
- *Sort and filter popover.* A measure chip offers sort ascending, descending or clear. A dimension
  chip adds the value list with search, an n/N count, Clear, Deselect all, Select all, Invert and
  Apply ([builder.js:150](project/src/builder.js#L150)). The values come from a governed `ctx.q`
  query of that one column, so they respect the persona's scope, cached per persona and field
  ([builder.js:140](project/src/builder.js#L140)).
- *The field panel.* Search, then Groups (nine topic groups, each mixing the dimensions and measures
  that can be queried together), Dimensions (k/N) and Measures (k/N); click to tick, collapsible to a
  thin tab ([builder.js:194](project/src/builder.js#L194)). Only fields that exist in the layer are
  offered, and pay-by-gender, ethnicity and disability fields only to the cleared roles
  ([builder.js:83](project/src/builder.js#L83)); switching persona drops the fields the new role may
  not see ([builder.js:303](project/src/builder.js#L303)). Tooltips carry each field's description
  from the layer.
- *Bookmarks.* Up to 20 named reports in `localStorage` (`people-reports-v1`), stamped with who and
  when, plus seven starter reports filtered to what the role may see
  ([builder.js:222](project/src/builder.js#L222)).
- *Share link.* The state is base64 JSON in `#rb=` ([builder.js:267](project/src/builder.js#L267));
  the URL is kept up to date while the tab is open, copied to the clipboard by the rail button, and a
  page opened with `#rb=` goes straight to the report ([app.js:516](project/src/app.js#L516)). It
  opens in the recipient's own scope, but see Caveats for the role check it skips.
- *Excel.* The rail's export runs the same dimensions, measures, filters and report selections through `ctx.q` and
  writes one sheet with a title, a scope note, a frozen header and number formats mapped from the
  layer's display patterns, through the app's dependency-free `workbookBlob`
  ([builder.js:272](project/src/builder.js#L272)).
- *CSS.* All of it is the `.cr` and `.cr-*` rules in [pi.css](project/src/pi.css#L566) (lines 566–645),
  including a stacked layout under 900 px.
- *What it needs from the app.* `DIM_FIELD` (governed dimension → view column,
  [model.js:2](project/src/model.js#L2)), `FORMAT` and `DESC` (each measure's display pattern and
  description, generated from the layer, [formats.js](project/src/formats.js)), `workbookBlob`
  ([xlsx.js:210](project/src/xlsx.js#L210)), and from `ctx` in app.js: `q`, `renderTile`,
  `dropTile`, `fields`, `persona`, `current`, `toast`, `el`, `esc`, `icon`, `onPageMount`, `onPersona` and
  `onPersonaNow` ([app.js:623](project/src/app.js#L623)).

**One link, four scopes.** Each persona carries a row scope as `[field, view, values]`
([app.js:84](project/src/app.js#L84)). It is added to every governed query
([app.js:226](project/src/app.js#L226)) and set as a static filter group on every native object
([app.js:381](project/src/app.js#L381)); switching persona re-filters the page on screen first, then
every other page, without remounting ([app.js:687](project/src/app.js#L687)). Objects a role is not
cleared for show a lock and are never mounted, so never queried
([app.js:538](project/src/app.js#L538)). The Data & governance tab shows the matrix of what each role
may do ([access.js:44](project/src/access.js#L44)).

**Privacy-thresholded diversity measures.** Every DEI measure has a privacy-safe twin in the layer,
`IF({DEI Headcount} >= 10, {measure}, NULL)` (eight of them, e.g. `Women Representation
(privacy-safe)`), so any cell under any filter or drill with fewer than 10 people is blank. The
Diversity tab charts only those, and states the rules in a panel ([access.js:24](project/src/access.js#L24)).

**KPI card = three native objects.** A `number`, a line or bar sparkline, and a header-less one-row
table with the comparison value (last year by default) and the change, coloured by whether that direction is good
([catalogue.js:98](project/src/catalogue.js#L98)). The sparkline sits in a `-t` twin of the page's
selection group, which mirrors the page's selections, so a click on a month never narrows the page
([app.js:401](project/src/app.js#L401)).

**The assistant answers from stored questions.** A question is scored against the 61 stored
questions by keyword overlap with synonyms ([assistant.js:32](project/src/assistant.js#L32)); named
countries, business units and skills override the question's filters; the answer is a native object
built from the question ([assistant.js:92](project/src/assistant.js#L92)) and a narrative written only
from the returned rows.

**Writeback as events.** `ctx.writeback` inserts rows through `app.writeback` when the runtime has
the `data:writeback` capability, and otherwise reports that it could not
([app.js:605](project/src/app.js#L605)). Every People Actions step becomes an `Action Events` row
([actions.js:51](project/src/actions.js#L51)), so does every data-issue triage step
([dataops.js:56](project/src/dataops.js#L56)), and a saved scenario becomes a `Saved Scenarios`
row ([simulator.js:206](project/src/simulator.js#L206)). Objects over those views are re-queried by
nudging their query limit ([app.js:613](project/src/app.js#L613)), and the query cache never holds
them ([throttle.js:158](project/src/throttle.js#L158)). Approval is maker–checker: the approver
must differ from the submitter, and £1m or more needs the Group CHRO
([actions.js:70](project/src/actions.js#L70)).

**Two simulators over governed baselines.** The retention projection is one pure function of the
baseline and five levers ([simulator.js:37](project/src/simulator.js#L37)); the FY28 plan absorbs
reductions through attrition first, redeploys a share into growing functions and hires for the rest
([plan.js:37](project/src/plan.js#L37)). Both list every assumption on screen; saved plans are kept
in the browser ([plan.js:139](project/src/plan.js#L139)).

**Fast enough for 213 objects.** Only the opening page is compiled, themed and mounted first, each
object against only the fields it references; the compiled and themed vSpec is cached per device
under a hash of its definition, so a repeat visit skips that step
([app.js:178](project/src/app.js#L178)). The other pages then load one at a time in the background,
and a page the reader opens jumps the queue ([app.js:553](project/src/app.js#L553)). Hidden panes
stay laid out at full width with `visibility: hidden` ([pi.css:102](project/src/pi.css#L102)).
Queries run through lanes with 429 backoff and a session cache ([throttle.js:134](project/src/throttle.js#L134)).

Also useful:
- drill-down: a single value selected on a drillable chart's current level steps it one level down, with breadcrumbs to step back ([app.js:495](project/src/app.js#L495)); a structured investigation of one segment, opened from a click ([explain.js:83](project/src/explain.js#L83));
- in-place switchers that swap a chart's measures or dimension and rebuild its vSpec without remounting ([app.js:434](project/src/app.js#L434));
- a sticky bar with the persona scope, the page's selections as removable chips and Clear all ([app.js:331](project/src/app.js#L331)), with pending selections applied after 250 ms ([app.js:139](project/src/app.js#L139));
- a written briefing composed from governed queries for the viewer's scope ([home.js:16](project/src/home.js#L16));
- a scatter map with a raster basemap laid under its plot area, the axes pinned to a lon/lat extent and refitted to true scale ([basemap.js:37](project/src/basemap.js#L37), [app.js:414](project/src/app.js#L414));
- the executive-summary workbook, seven sheets: five governed queries under the persona scope and the applied selections of the page on screen (pages keep independent selection groups, so the export follows the one being looked at (on Custom report, the report's own `g-rb` group); only an engine rejection of the selections drops them from a sheet, any other query failure fails the export; each sheet's subtitle names the selections it follows), the scenario for the simulator's own population, and the action register in the persona's scope ([export.js:18](project/src/export.js#L18)). `buildWorkbook` returns the Blob, the header button downloads it, and `appState.exportProbe` lets the smoke test prove a Home selection narrows every governed sheet ([checks.js:112](project/src/checks.js#L112));
- nine smoke checks the app registers: on six tabs and Data operations a selection moves a KPI, a chart and a table and clearing restores the KPI; the custom report builds a table, changes when a measure is added and exports; the header export downloads its workbook ([checks.js:21](project/src/checks.js#L21)).

## Semantic layer

[`layers/people-intelligence`](../../layers/people-intelligence/) ("People Intelligence
(illustrative HR data)") has 20 views, 36 joins, 80 dimensions, 635 measures and 229 stored
business questions.

- **Views:** facts `Workforce` (monthly headcount, movement, pay, absence), `Costs`, `Engagement`, `Exits`, `Requisitions`, `Diversity` (aggregates only, by country × department × level × gender × age band), `Succession`, `Skill Inventory`, `Reskilling Pool`, `Initiatives`, `Pipeline Runs` and `Data Issues`; shared tables `Countries`, `Business Units`, `Departments`, `Months`, `Seniority` and `Skills`; and two tables the app writes to, `Action Events` and `Saved Scenarios`. Tables are `PEOPLE_*`.
- **Joins:** the facts many-to-one to `Countries` and `Departments` on Country and Department, to `Months` on Month and to `Seniority` on Seniority where they carry them; `Departments`, `Initiatives`, `Action Events` and `Saved Scenarios` to `Business Units`; `Requisitions`, `Skill Inventory` and `Reskilling Pool` (on To Skill) to `Skills`. `Pipeline Runs` and `Data Issues` stand alone, so the persona scope does not apply to them.
- **Measures:** headline rates and counts with their PM, PQ, PY, MoM, QoQ, YoY and "vs PY" members; rolling-12-month and fiscal-year-to-date windows; cost against budget; engagement drivers; succession coverage; skills coverage and 2028 gaps; pipeline and issue health; and the eight privacy-safe DEI measures. Each carries a display pattern and description, which the app copies into `formats.js`.
- **Questions:** 61 in [`src/questions.js`](project/src/questions.js) are the assistant's and the library's; the other 168 each back one catalogue object and appear as its caption. Full list in [questions.md](../../layers/people-intelligence/questions.md).
- **Raw fields:** the app queries view columns through `DIM_FIELD` for every dimension, the persona scopes read `Region`, `Country` and `Business Unit`, and the writeback inserts name the `Action Events` and `Saved Scenarios` columns.

## Rebuild from nothing

1. **Data.** Create the 20 `PEOPLE_*` tables from [`schema/ddl.sql`](../../layers/people-intelligence/schema/ddl.sql) and load your own HR data. The script that generated the mock data is **not included in this repo**; No data is shipped either: once your tables are loaded, profile the layer over MCP ([playbook step 1](../../playbook/1-read-the-layer.md)) to see each dimension's values. Make the text columns of `PEOPLE_ACTION_EVENTS` and `PEOPLE_SCENARIOS` wide enough for writeback.
2. **Layer.** Recreate it from [`layers/people-intelligence/layer.json`](../../layers/people-intelligence/layer.json), replacing `ASTRATO_GALLERY.MOCK_DATA` in the 20 views with your database and schema, and publish it. The scripts that authored it (`tools/entities.mjs`, `tools/questions.mjs`, `tools/chart-questions.mjs`, cited in source comments) are not included in this repo.
3. **App.** See Run it. `src/model.js`, `src/formats.js` and `src/questions.js` are generated copies of the layer; edit them by hand if you change it.

## Run it

```sh
cd project
npm install                # public npm: @astrato-io/app-runtime, @astrato-io/visualizations, vite
# set semanticLayerId in astrato.json to your copy of the layer (it ships as a zero placeholder)
astrato login
npm run compile-check      # every object and starter report compiles against the installed library, no session needed
astrato dev .              # open the sign-in URL it prints
node ../../../kit/verify/smoke.mjs "<that sign-in URL>" --widths 1440,1280,1024 --settle-ms 180000 --check-ms 120000
astrato build .
```

Needs Node 24.18 or later. Web fonts load from a public font CDN and basemap tiles from a public
tile service at run time. The persona choice is remembered in `localStorage`.

## Caveats

- **Mock data.** The `PEOPLE_*` tables are generated; the source systems on the Data & governance and Data operations tabs are part of the mock architecture. Dates are fixed at 30 September 2026. The app names no company on screen; it is branded "People Intelligence · Group HR".
- **Scope is not security.** The persona scope is a static filter added by the app ([app.js:381](project/src/app.js#L381)), not row-level security; anyone who can open the layer can query outside it. Enforce access in the semantic layer before copying this for real data.
- **Writeback inserts events only.** Action records and data-issue states live in `localStorage` (`people-actions-v2`, `people-issues-v1`) over the governed seed; each step is also inserted into `Action Events`, and saved scenarios into `Saved Scenarios`. Without the writeback capability the app says so and keeps the browser copy. No smoke check exercises writeback ([checks.js:9](project/src/checks.js#L9)).
- The custom report's table splits its width equally between columns ([app.js:592](project/src/app.js#L592)), so long values truncate. Its Excel export asks for at least 2,000 rows whatever the Rows setting (and says so in the sheet when that limit is reached), follows the report's filters and any selection clicked on the report, and writes a pivot as a flat table.
- Currency comparison rows in KPI cards clip to a red "+".
- On visualizations 0.9 a combo's secondary-axis layer does not move when the card narrows; objects are clipped to their card ([pi.css:658](project/src/pi.css#L658)) rather than fixed.
- The simulators' elasticities and costs are illustrative constants, listed on screen ([simulator.js:27](project/src/simulator.js#L27), [plan.js:27](project/src/plan.js#L27)). The assistant matches by keyword overlap, not a language model.
- Catalogue objects are declared against layer measures in [catalogue.js](project/src/catalogue.js); the 168 questions that back them are captions, not their source.
- **Landing.** Landing-ready was 9.4 s in staging; with all 13 tabs preloading, every object settled in about 101 s, hence the longer smoke-test timeouts.
- Inert leftovers: [throttle.js](project/src/throttle.js)'s header describes a timetable and a `prefetch.js`, and its `RENAMES` comment describes renames the empty list does not do (it is a hook for datasets whose member names should not be shown as stored); `prefetchSelections` and `compileTiles` ([dashboard.js](project/src/dashboard.js)) are unused; palette names call the blue accent "red" ([catalogue.js:13](project/src/catalogue.js#L13), `--red` in pi.css).
- Checked in staging with the kit smoke test at 1440, 1280 and 1024 (213 objects rendered across 13 tabs, 9 app checks), `npm run compile-check` (217/217) and `vite build`.
- No screenshots are shipped yet.
- `astrato.json` carries a zero placeholder `semanticLayerId`; `layer.json`'s datasource is a placeholder too.
