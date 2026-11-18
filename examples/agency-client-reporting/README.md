# Client Reporting, explained — Tidewater Media

A fictional digital-marketing agency's account managers and directors ask, every month: *which
of our clients need attention, why did their numbers move, where should next month's budget go,
and is each client's report ready to sign off and send?* The app answers on mock data that mimics
four source systems: Google Ads and Meta for paid media, GA4 for the website and Search Console
for organic search. The four are joined through shared Clients, Channels and Months tables in one
semantic layer: 8 clients in 8 sectors (e-commerce and lead generation, 4 account managers), 8
channels across Google Ads, Meta Ads, SEO and the website, 8 campaigns of 5 types, 5 keyword
groups and 3 devices, monthly from January 2025 to September 2026. September 2026 is "this month".

What sets it apart from a connector dashboard is that every change is explained. Driver bridges
stored in the layer split each month-on-month change exactly into a reach, click-through and
conversion-rate effect, and the app reads them out as plain English with next steps. It is a
hand-written Astrato App on Vite and the public `@astrato-io` packages (visualizations 0.9,
app-runtime 0.8).

No screenshots are shipped yet.

## Tabs

- **Agency portfolio** — four filters (account manager, sector, business model, platform); eight KPI cards for September against August (media spend, conversion value, ROAS, cost per conversion, conversions, website sessions, organic clicks, average Google position), each with a 21-month mini chart and a vs-last-month row; a client scorecard with a conversion-value sparkline column; conversion value change by client; GA4 revenue by channel group (donut); media spend and ROAS by platform over 21 months.
- **Client performance** — one client, every source. Eight KPI cards, spend and conversion value by month, conversion value by channel (September beside August), GA4 sessions by channel group, organic clicks by keyword group, and a campaign table with a 21-month sparkline column.
- **Why it changed** — a dark panel with the headline, "What drove it" and "Recommended next steps", with buttons to use it as report commentary or ask Nash a follow-up; four change KPIs; five driver bridges (conversions by channel = reach + click-through + conversion rate; value = volume + value per conversion; spend = clicks + cost per click; organic clicks by keyword group = demand + click-through; GA4 key events by device = traffic + on-site conversion); campaign movers with each effect; rankings by keyword group; the same conversion bridge year on year.
- **Paid media** — six KPI cards (impressions, CTR, CPC, CPM, conversion rate, ROAS), CPC and CTR by channel over time, ROAS by campaign type, cost per conversion by client, and every campaign's funnel with a ROAS sparkline column.
- **SEO & web** — eight KPI cards (organic clicks, impressions, CTR, average position, keywords in the top 3, GA4 sessions, engagement rate, site conversion rate), position by keyword group, engagement rate by device, a keyword-group table, sessions by channel and site conversion rate by client.
- **Ask Nash** — a mock-up chat. Four suggested questions (why a client's conversions dropped, which clients need attention, draft a client summary, where an extra £5k should go) or free text; each answer shows the tool steps, the answer computed from governed rows, and a native chart under it.
- **Budget planner** — six sliders (Google Search, Performance Max and Meta budgets, CPC inflation, conversion-rate uplift, organic growth) over one client's governed September baseline; Q4 conversion value, spend and paid ROAS against the run-rate, and a channel table.
- **Infographic** — a one-page client report: about the account, four KPI cards, Jan–Sep conversion value 2026 against 2025 by platform, revenue by channel and by source, insights from the driver bridges, and four growth strategies for October. A client picker switches it.
- **Report (Excel view)** — the Excel pack drawn as a spreadsheet (ribbon, formula bar, lettered columns, frozen rows, sheet tabs), live from the layer, per client or for the portfolio, with a download.
- **Client reports** — the monthly run: every client's report status and anomaly count; for the open client, source checks, the anomalies to explain or escalate, the Nash-drafted commentary to edit, sign-off, and delivery by email with the Excel pack; an audit trail. "Acting as" switches between account managers (makers) and an account director or head of client services (checkers).

The header carries "⬇ Excel pack" (the portfolio pack) and "✉ Client reports".

## Worth copying

**Driver bridges in the layer.** For each product metric the layer stores a change measure and
effects that add up to it exactly, by sequential substitution, month on month and year on year
([entities.mjs:52](project/tools/entities.mjs#L52)). Conversions = impressions × CTR × CVR, so the
reach effect is (impressions now − before) × conversions before ÷ impressions before, the CTR
effect holds impressions at today's level and moves CTR, and the conversion-rate effect is what
is left at today's clicks ([entities.mjs:58](project/tools/entities.mjs#L58)). The same pattern
splits conversion value (volume, value per conversion), spend (clicks, CPC), organic clicks
(impressions, CTR) and GA4 key events (sessions, on-site rate). Because the effects are measures,
they work at any grain: by channel, campaign, keyword group, device or client, and under any
filter. Each bridge chart is a stacked horizontal bar of the effect measures
([dashboard.js:69](project/src/dashboard.js#L69)) whose legend shows "Reach (impressions)" and
"Click-through rate" through `updateMeasure` with a `customLabel`
([theme.js:166](project/src/theme.js#L166)).

**Plain English from the bridges.** `loadFacts` runs four governed queries, every client at once
(by channel, keyword group, device and client) ([explain.js:9](project/src/explain.js#L9)).
`explain` sorts every channel-and-effect pair in the direction of the change, turns the two biggest
into bullets with their share of the change and the rate that moved, adds CPC pressure, the main
offsetting effect, the keyword group whose rankings slipped and a device whose on-site conversion
fell, and maps each to a next step ([explain.js:37](project/src/explain.js#L37)). The same facts
flag the anomalies a reviewer must explain before sign-off
([explain.js:91](project/src/explain.js#L91)), draft the report commentary, fill the infographic's
insights and answer Nash. Only the wording lives in the app.

**KPI card = number + sparkline + vs-last-month row.** `kpiCard` builds three native objects: a
`number`, a line or bar sparkline by month, and a header-less one-row `table` with last month and
the change, whose indicator bands colour the change by whether that direction is good
([dashboard.js:89](project/src/dashboard.js#L89)). On visualizations 0.9 all three follow the tab's
selections with no static-filter mirror; the smoke checks select a value on each tab and check
that the KPIs move and restore. Three 0.9 details: sparklines lose their point markers with `setMeasureShape` and
`shape: null` ([theme.js:159](project/src/theme.js#L159)); the one-row table splits a fixed 232 px
between its two columns so "Aug £…" is not cut to an ellipsis ([theme.js:239](project/src/theme.js#L239));
and the last-month column keeps the measure's unsigned format while the change is signed
([dashboard.js:102](project/src/dashboard.js#L102)).

**Native tables with sparkline columns and bands.** The scorecard, campaign, keyword and funnel
tables carry a 21-month sparkline column over `Month` ([dashboard.js:380](project/src/dashboard.js#L380))
and colour their change columns with two- or three-band indicator text
([dashboard.js:29](project/src/dashboard.js#L29)). Column formats address the column by its exact
name, as visualizations 0.8 and later require ([theme.js:211](project/src/theme.js#L211)).

**Ask Nash, with native charts.** A keyword router picks one of four answer types and a client
([app.js:278](project/src/app.js#L278)); the answer shows the MCP tool steps, is computed from the
governed facts, and ends with a native chart: an ad-hoc tile built, compiled, themed and mounted at
run time in its own `g-nash` group, pinned to the client by a static filter
([app.js:249](project/src/app.js#L249), [dashboard.js:442](project/src/dashboard.js#L442)). A summary
answer can be inserted straight into that client's report.

**Report sign-off, then send.** An account manager must explain or escalate every flagged anomaly
before submitting ([workflow.js:80](project/src/workflow.js#L80)); only a director or head of client
services can approve, return or send ([workflow.js:10](project/src/workflow.js#L10)). Send builds that
client's pack, downloads it and opens a `mailto:` addressed to the client contact with the approved
commentary as the body ([app.js:496](project/src/app.js#L496)). State and the audit trail are kept
in `localStorage` ([workflow.js:8](project/src/workflow.js#L8)).

Also useful:
- a governed query helper over `engine.getData` that returns named rows, used by the narratives, Nash, the planner, the workflow and the Excel pack ([app.js:101](project/src/app.js#L101));
- the budget planner's projection: extra paid budget converts with an elasticity of 0.75, CPC inflation buys fewer clicks, conversion-rate uplift lifts every channel, September × 3 for the quarter ([app.js:344](project/src/app.js#L344));
- a seven-sheet portfolio pack (summary with Sep / Aug / Sep 2025, MoM and YoY; client scorecard; conversion bridge; monthly trend; campaigns; SEO; sign-off and audit trail), or seven sheets per client (no scorecard; the bridge carries the explanation; plus that client's budget plan with the levers as set on the Budget planner tab) ([app.js:390](project/src/app.js#L390)). Every query carries the export's filters, read when you export: the header pack follows the filter bar of the tab on screen (Agency portfolio's on tabs without one) and every subtitle names those filters; a client pack (Excel view, Send) is scoped to that client alone and says so, and its sign-off sheet lists only that client's status and audit entries. Rate changes are in percentage points, a change against a zero month is left blank, and a query that fills its 2,000-row limit is flagged in the sheet. Written by a dependency-free OOXML writer ([xlsx.js:210](project/src/xlsx.js#L210)) and drawn on screen from the same sheet objects ([sheetview.js:18](project/src/sheetview.js#L18));
- one selection group per tab, each with its own filter dropdowns, and pending selections applied after 250 ms ([app.js:69](project/src/app.js#L69));
- every tab mounted at load, the opening tab's 33 objects first ([app.js:237](project/src/app.js#L237)); inactive panes stay laid out off-screen with `visibility: hidden` ([tidewater.css:122](project/src/tidewater.css#L122));
- query lanes with 429 backoff and a session cache around `engine.getData` ([throttle.js:105](project/src/throttle.js#L105));
- nine smoke checks the app registers: on five tabs a selection moves a KPI, its vs-last-month row and a table and clearing restores them; the infographic's client switch moves its KPIs; a Nash answer mounts its chart; a planner lever moves the projection; the Excel pack downloads ([app.js:515](project/src/app.js#L515)), and an export probe: a Sector selection on Agency portfolio must change every sheet of the pack except Sign-off ([app.js:592](project/src/app.js#L592)).

## Semantic layer

[`layers/agency-performance`](../../layers/agency-performance/) ("Tidewater Media – Client
Performance") has 6 views, 9 joins, 16 dimensions, 208 measures and no stored business questions.

- **Views:** three facts, `Ads` (`AGENCY_ADS`: impressions, clicks, spend, conversions and conversion value by month, client, channel and campaign), `Web` (`AGENCY_GA4`: sessions, engaged sessions, key events and revenue by month, client, channel and device) and `SEO` (`AGENCY_SEO`: clicks, impressions, impression-weighted position, tracked and top-3 keywords by month, client, channel and keyword group); and three shared tables, `Clients` (`AGENCY_CLIENTS`), `Channels` (`AGENCY_CHANNELS`) and `Months` (`AGENCY_MONTHS`, with `Month Bucket` and `Ytd Bucket`).
- **Joins:** each fact many-to-one to `Clients` on `Client`, `Channels` on `Channel` and `Months` on `Month`, so one client, channel or month filter reaches all three sources.
- **Measure families:** ten sums (Spend, Impressions, Clicks, Conversions, Conversion Value, Sessions, Key Events, Web Revenue, Organic Clicks, Organic Impressions), each with This Month, Last Month, Same Month LY, YTD, PY YTD, MoM, YoY and YTD Growth; ten ratios (CTR, CPC, CPM, CVR, CPA, ROAS, Engagement Rate, Site Conversion Rate, Organic CTR, Average Position), each with the same periods and a MoM and YoY change (a ratio change, or a points or position difference); Top 3 Keywords; and 32 driver-bridge measures (`… Change`, `… Effect` MoM and YoY). The periods are filtered aggregates on the bucket columns, so "this month" is whatever the data marks as this month.
- **Measures used:** 123 of the 208: the base, This Month, Last Month and MoM members of the families on screen, Same Month LY for the Excel summary, the MoM bridges, and the YoY conversion bridge, `Spend CPC Effect YoY`, `Conversions YoY` and `Organic Clicks YoY`.
- **Raw fields:** every dimension is a raw view column (`Client`, `Account Manager`, `Sector`, `Business Model`, `Channel`, `Channel Group`, `Platform`, `Campaign`, `Campaign Type`, `Keyword Group`, `Device`, `Month`, `Year`); the infographic's growth chart filters on `Ytd Bucket`.
- Defined but unused by the app: the 16 governed dimensions, every YTD, PY YTD and YTD Growth measure, most YoY measures and bridges, `Top 3 Share This Month`, and `Package`, `Paid Organic` and `Month Label`.

## Rebuild from nothing

1. **Data.** Create the six `AGENCY_*` tables from [`schema/ddl.sql`](../../layers/agency-performance/schema/ddl.sql) and load your own data, with `MONTH_BUCKET` marking the reporting month (`This month`, `Last month`, `Same month LY`) and `YTD_BUCKET` the year-to-date windows (`CY YTD`, `PY YTD`). The script that generated the mock data is **not included in this repo**; No data is shipped either: once your tables are loaded, profile the layer over MCP ([playbook step 1](../../playbook/1-read-the-layer.md)) to see each dimension's values.
2. **Layer.** Recreate it from [`layers/agency-performance/layer.json`](../../layers/agency-performance/layer.json), replacing `ASTRATO_GALLERY.MOCK_DATA` in the six views with your database and schema. [`tools/layer.mjs`](project/tools/layer.mjs) and [`tools/entities.mjs`](project/tools/entities.mjs) show how it was authored, but `layer.mjs` is reference only: it needs a `tools/mcp.mjs` MCP client and a `tools/types.txt` column-type list, neither included in this repo, and it creates the layer with a zero datasource id.
3. **App.** See Run it. The layer must be published before the app can see it.

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

If your layer lives on a different Astrato host than the CLI's default, pass `--host <your Astrato URL>` to `astrato dev`; otherwise the runtime answers "Resource not found" and the app shows "Astrato rejected the runtime request". The CLI also passes its own `--port`, so the dev server may not use the port in `vite.config`.

`project/src/app-state.js` is a copy of the kit's `kit/verify/app-state.js`. Keep it in step with the kit: `app.js` calls `appState.exportProbe(...)`, and an older copy without that method stops the app at boot.

Needs Node 24.18 or later. Web fonts load from a public font CDN at run time.

## Caveats

- **Mock data.** The four source systems are mimicked, not connected; the workflow's "synced 06:00 today" source checks are fixed strings ([workflow.js:21](project/src/workflow.js#L21)).
- **No writeback.** Report status, explained anomalies, commentary edits and the audit trail live in `localStorage` (`tidewater-reports-v1`) over a seeded state; Reset demo clears it. Send downloads the Excel pack and opens a `mailto:`, so the pack is not attached; the monthly auto-send checkbox only records the choice.
- **No stored business questions.** Every object queries layer measures over raw view columns; the 16 governed dimensions go unused. The playbook asks for stored questions.
- Narratives, Nash answers, anomaly flags and the planner are browser arithmetic over governed rows. Nash routes by keywords to four canned answer types and hard-codes "208 governed measures"; its budget answer always splits £3,000 / £2,000 with a fixed 0.8 marginal-ROAS factor ([app.js:321](project/src/app.js#L321)). The planner takes September × 3 for Q4 with a fixed elasticity of 0.75 ([app.js:337](project/src/app.js#L337)).
- Dates are fixed: the data's `Month Bucket` makes September 2026 "this month", and the app hard-codes "September 2026", "Sep" and "Aug" in titles, sheet names and the KPI delta formats ([dashboard.js:102](project/src/dashboard.js#L102)).
- **No selection bar.** Each tab has its own filters and group and pending selections are applied, but there are no chips or Clear all. The client tabs open on one fixed client ([app.js:115](project/src/app.js#L115)).
- **Landing.** All 165 objects are compiled and themed before anything mounts ([app.js:85](project/src/app.js#L85)), so landing-ready (about 13 s in staging) sits near the 15 s budget; all objects settle in about 32 s, with 884 queries.
- Layout: donut slice labels are clipped on the infographic, and the header source chips stack at 1024 wide.
- Inert leftovers: an `--accent` variable block in [objects.css](project/src/objects.css), LinkedIn button and story-chapter styles in [styles.css](project/src/styles.css), a stale [throttle.js](project/src/throttle.js) header (timetable, `prefetch.js`) and an unused `prefetchSelections`, comments in `fields.js` and `dashboard.js` from other apps, and [sheetview.js](project/src/sheetview.js) says `buildSheets` is in `main.js`.
- `tools/layer.mjs` needs `tools/mcp.mjs` and `tools/types.txt`, which are not included in this repo (it reads `types.txt` on load, so no command runs), and hard-codes `ASTRATO_GALLERY.MOCK_DATA` ([layer.mjs:29](project/tools/layer.mjs#L29)).
- Checked in staging with the kit smoke test at 1440, 1280 and 1024 (165 objects rendered, 9 app checks), `npm run compile-check` (165/165) and `vite build`.
- No screenshots are shipped yet.
- `astrato.json` carries a zero placeholder `semanticLayerId`; `layer.json`'s datasource is a placeholder too.
