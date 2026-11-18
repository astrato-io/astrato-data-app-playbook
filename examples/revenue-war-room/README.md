# Pipeline War Room — Velmora (fictional SaaS)

A CRO's Q4 command room on one screen per tab. The business question is **"will we hit Q4,
and if not, what closes the gap?"** The hero answer sits in the Command headline: the weighted
Q4 forecast is $22.71m against a $24.00m target, **$1.29m short, and EMEA drives the miss**
(−$565k since Monday). The Deals tab then stacks the open best-case and pipeline deals by
recovery score until they cross that gap (the top 10 of 15 do), and the Forecast call tab lets
managers commit per rep and submit the call to a decision log. Hand-written Astrato App on Vite
and the public `@astrato-io` packages (0.8).

This repository has no screenshots of it and none of its data.

## Tabs

- **Command** — gap bridge (won → commit → best case → pipeline → total) with a governed target line, four category KPIs with week-over-week change and sparklines, region × category stacked bar, weekly forecast trajectory, four clickable region cards.
- **Deals** — "Deals that close the gap" (top 15 by recovery score, offset bars, a gap line), the recovery list table, and a deal drawer with facts, recent activity and four actions.
- **Coaching** — rep picker, five rep-vs-team-average cards, Q4 forecast (bars) vs quota (markers) for every rep, activity mix and open pipeline by stage for the selected rep.
- **Forecast call** — per-rep commit and best case typed in $k, roll-up against system forecast and target, "Submit call to CRO", and "What moved since Monday" bridge.
- **Trends** — bookings by quarter with mean line and Q3/Q4 target lines, win rate and deal size combo, win rate by deal size band, Q4 forecast by product.

Header: tab nav (also in `#hash`), All/NA/EMEA/APAC/LATAM region pills, an acting-user dropdown that stamps the audit trail, and a Decisions log drawer.

## Worth copying

- **Waterfall from an offset bar, sorted by a hidden measure** — [objects.js:39](project/src/objects.js#L39).
  The forecast bridge is an ordinary bar with `setBarChartLayout: 'offset'`, so the engine draws
  cumulative steps and a Total bar. Categories are ordered by an average of `Probability` that is
  added as a supporting measure and made the first sort key in `sortBySupport`
  ([objects.js:81](project/src/objects.js#L81)); the same trick orders the gap-closer deals by
  `Recovery Score` ([objects.js:47](project/src/objects.js#L47)).
- **Governed reference lines** — [objects.js:119](project/src/objects.js#L119). Target, gap, quarter
  targets and win rate are fetched with governed queries (`loadRefs`, [app.js:470](project/src/app.js#L470)),
  written into `vSpec.refLines`, and the measure axis max is lifted 6% above the line so it stays
  on the plot. On selection change only tiles whose reference value changed get
  `runtime.updateInstance` ([app.js:490](project/src/app.js#L490)).
- **Query gate and memo** — [app.js:102](project/src/app.js#L102). `engine.getData` is wrapped
  so at most four queries run at once (charts and headline queries share the queue), and
  identical request bodies share one promise. The comment notes a row click otherwise re-asked
  ~160 identical queries. Only safe because the data is static per session.
- **Chart click as an action, not a filter** — [app.js:523](project/src/app.js#L523). The main
  group's `onActiveSelectionChange` looks for a pending selection on `Opp Name`; it removes it and
  opens the deal drawer. A pending `Rep Name` on Coaching picks the rep; all other pending
  selections auto-apply after 250 ms.
- **Isolated selection groups** — [app.js:531](project/src/app.js#L531). The all-reps hero lives
  in group `rcc-all` and the rep-focused charts in `rcc-rep`, so a rep pick never narrows the
  hero; the region selection is mirrored into both groups. The selection bar shows the rep chip
  only on Coaching ([app.js:255](project/src/app.js#L255)).
- **Selection check** — [app.js:540](project/src/app.js#L540): picks a region through the same path as the region pills, checks the Q4 forecast figure moves, clears, and checks it returns. The kit smoke test runs it.
  Replaces `engine.areFieldsConnected` so governed `[dimension]`/`[calculation]` keys resolve to
  the view columns they are built on before the SDK's own check; without it charts on governed
  items do not cross-filter.
- **Visible-first preload** — [app.js:561](project/src/app.js#L561). Every tab's objects mount at
  start, the visible tab first, three at a time; inactive pages are `visibility: hidden`, not
  `display: none` ([styles.css:45](project/src/styles.css#L45)).

## Semantic layer

Uses `layers/live-gallery` (views over `NB_*` tables in `schema/ddl.sql`).

- **Views:** Opportunities, Forecast Snapshots, Sales Regions, Reps, Activities, Forecast Bridge, Bookings Targets.
- **Measures:** Q4 Forecast, Q4 Bookings Target, Prior Week Q4 Forecast, Closed Won Bookings, Opportunity Amount, Snapshot Forecast, Open Pipeline, Win Rate, Win Probability, Average Deal Size, Recovery Score, Sales Activities, Avg Days in Stage, Avg Engagement Score, Forecast Movement.
- **Raw aggregations:** SUM of Reps.Q4 Quota, MAX of Opportunities.Recovery Score, SUM of Bookings Targets.Bookings Target, AVG of Opportunities.Probability (sort only).
- **Dimension:** Deal Size Band.
- **Matching stored questions** in [questions.md](../../layers/live-gallery/questions.md) — "Will we hit Q4? Forecast vs target by region", "Which deals can close the Q4 gap?", "What changed in the Q4 forecast since last Monday?", "How has the Q4 forecast moved week by week?", "Q4 forecast by region, team and rep", "How do win rate and deal size trend by quarter?". The app does not load them; it rebuilds the same queries by measure name.

## Run it

```sh
cd project
npm install                 # public npm: @astrato-io/app-runtime, @astrato-io/visualizations, vite
# set semanticLayerId in astrato.json to your copy of layers/live-gallery (it ships as all zeros)
npm run compile-check       # every tile compiles against the installed library, no session needed
astrato dev .               # open the sign-in URL it prints
node ../../../kit/verify/smoke.mjs "<that sign-in URL>"
astrato build .
```

Needs Node 24.18 or later.

## Caveats

- Writeback is mocked: deal actions, forecast-call values and the decision log live in `localStorage` (`nb-war-room-v1`, [app.js:53](project/src/app.js#L53)). There is no `app.writeback` call.
- KPI values, region figures and coaching cards are HTML text from `engine.getData`; only the sparklines are native objects. The forecast-call grid and deal drawer are plain HTML.
- Charts are not built from stored business questions (see Semantic layer).
- Dates are hard-coded: as-of Mon 5 Oct 2026, `Close Quarter = 2026-Q4`, closed quarters 2024-Q1 to 2026-Q3 ([app.js:28](project/src/app.js#L28)).
- Below 1100 px wide (or 680 px tall) inactive pages use `display: none` ([styles.css:165](project/src/styles.css#L165)), which defeats the background preload.
- `project/README.md` mentions activity sparklines in the recovery list and mean ± σ on the trajectory; the code has neither. Comments in `app.js` and `styles.css` still call the design "dark", and `lib/theme.js` carries a comment from another app.
- `lib/menu.js` is not imported.
- Ported from visualizations 0.5 to 0.8 (2026-11) and checked in headless Chrome with the kit smoke test: 21 objects rendered, one screen per tab, no errors. Changes for 0.8: the table column-format operations ([theme.js:74](project/src/lib/theme.js#L74)), axis ranges through operations instead of vSpec writes, and the cross-filter wrapper and the two vendor patch scripts removed. The tile list and the compile-and-theme path moved from `app.js` to [objects.js](project/src/objects.js) so the offline compile check can import them.
- Reference lines still write `vSpec.refLines` and replace the vSpec with `updateInstance` ([objects.js:119](project/src/objects.js#L119)): 0.8 has no reference-line operation. They render on 0.8.
- One selection re-queries objects on every tab: all tabs share one selection group.
