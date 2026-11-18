# League Table Climb Planner — UK university rankings, 2027 edition

The Director of Strategy at a mid-ranked UK university asks: *which component measures and which
rival universities do we focus on next year to climb the league table?* The app opens on Kent and
switches university with `?uni=` or the header picker. It walks from where we stand, to which
measures cost us places against the universities around us, to what a higher total score would buy,
to a focus plan the Vice-Chancellor approves. The hero sentence states the university's rank and
its change on the last edition, the points that separate it from the top 50, how the rivals within
ten places moved, and which universities a given score gain would overtake, all from the league
table you load.

**This app was built by an agent from this repo, in a clean environment, as a test run**, then
brought up to standard. It shows what the [playbook](../../playbook/README.md) produces from a
semantic layer and a one-line decision, caveats included. A hand-written Astrato App on Vite and the
public `@astrato-io` packages (visualizations 0.9, app-runtime 0.8).

This repository has no screenshots of it and none of its data. The league table it ran on is a commercially
published one, so no scores or ranks from it are reproduced here.

## Tabs

Above every tab: the our-university picker and **Excel report** in the masthead; a sticky selection
bar with Nation, University group and Rank band dropdowns, the library filter bar (chips, ×, Clear
all) and **Rivals: ±10 places**, which resets the rival set to the universities within 10 places
of us. That rival set is the default selection (Rank 2027 within ten places of the chosen university).

- **Where we stand** — a hero sentence; four KPIs (our rank, the rivals' average rank, climbers, fallers), each with its change against 2026 coloured by direction and a native mini chart (a rank line, or the movement mix as bars); places moved by rival with us in teal (click a bar to filter); the rivals in view with 2026 rank, move, total and component scores and a 2025–27 rank sparkline column.
- **What costs us places** — each rival's rank within the set on seven components (1–5 green, 16+ red); four bars of points above or below the rivals' average on graduate prospects, student experience, research and entry standards.
- **What it takes** — a total-score gain slider (0–120, default +25) driving the projected rank and the number and list of universities overtaken across the whole league; points of total score separating each rival from us; the rivals' average rank by edition with a 2-edition moving average (axis inverted).
- **Focus plan** — up to three measures, up to six rivals and a rationale; the Director of Strategy (or Deputy Director) proposes, the Vice-Chancellor approves or returns, nobody decides on their own proposal; an audit trail and reset. Browser-only, and labelled so. Beside it, the rank-on-measure table and points chart for us and the planned rivals.

## Worth copying

**A selection group per tab, mirrored only while visible.** Filters and chips write to `main`;
each of the first three tabs has its own group ([catalogue.js:21](project/src/catalogue.js#L21)),
which copies `main` by difference ([app.js:252](project/src/app.js#L252)) when `main` changes and
that tab is showing ([app.js:270](project/src/app.js#L270)), and again when the tab is opened
([app.js:296](project/src/app.js#L296)). One click costs one query per visible object, and a self-check
holds it to that ([app.js:446](project/src/app.js#L446)). A chart click lands as a pending selection in
the tab's group; the app clears it and applies it to `main` after 200 ms
([app.js:283](project/src/app.js#L283)), so the chips and every other tab follow. Fixed groups sit beside
them: `us` (pinned to our university, [app.js:264](project/src/app.js#L264)), `whatif`, `overtake` and
`focus`.

**What-if through the layer, two ways.** The slider sets the governed `score` parameter of the
stored measure Projected Rank at Score on the mounted KPI with `applyRuntimeOperations`, no remount
([app.js:309](project/src/app.js#L309), the operation at [prepare.js:60](project/src/prepare.js#L60)).
The same slider writes a `between` selection on Total Score (2027), from just above our score to
our score plus the gain, into the `overtake` group ([app.js:246](project/src/app.js#L246)), so the
overtaken count and table are governed rows. Our score is bound before mount as the `benchmark`
parameter of Score Gap to Benchmark, which every points-gap bar reads ([prepare.js:72](project/src/prepare.js#L72)).

**Every object on a stored question.** All 26 charts, tables and KPI parts are tiles over 18 of the
layer's 40 stored questions, copied into [questions.js](project/src/questions.js) with their exact
titles, which are the card titles ([catalogue.js:68](project/src/catalogue.js#L68)). A question's
rank-within-set and moving average travel as advanced-calculation operations
([catalogue.js:84](project/src/catalogue.js#L84), [catalogue.js:88](project/src/catalogue.js#L88)). Only the
hero sentence reads stored measures through one app-side governed query
([app.js:60](project/src/app.js#L60), [app.js:146](project/src/app.js#L146)).

**KPI = number + change row + mini chart.** The value is a native `number`; the change is a
one-row table of the question's change measure with a two-segment indicator coloured by whether
the move is good ([catalogue.js:106](project/src/catalogue.js#L106)); the mini chart is a line of rank
by edition (inverted) or the movement mix as bars with climbers or fallers emphasised
([catalogue.js:115](project/src/catalogue.js#L115), [catalogue.js:121](project/src/catalogue.js#L121)).

**One pre-mount path, shared with the compile check.** `prepareTile` themes the compiled vSpec,
binds governed parameters and relabels measures by position
([prepare.js:63](project/src/prepare.js#L63)); [tools/compile-adapter.mjs](project/tools/compile-adapter.mjs)
imports it, so `npm run compile-check` runs what the browser runs. Every tile compiles and themes
in parallel ([catalogue.js:254](project/src/catalogue.js#L254), [app.js:106](project/src/app.js#L106)),
which took landing from 24 s to 5.8 s.

**Tables and bars that fit their slot.** `widthOps` gives each column at least what its header
needs at the font size, lets the university column take the rest and wrap, and sets the row
height from the lines the longest name then needs ([prepare.js:18](project/src/prepare.js#L18)).
Bars narrower than 220 px drop their data labels instead of ellipsising them
([prepare.js:89](project/src/prepare.js#L89)). `fitOps` picks between the two
([prepare.js:98](project/src/prepare.js#L98)); a ResizeObserver re-applies it with
`applyRuntimeOperations`, without a remount ([app.js:323](project/src/app.js#L323)).

Also useful:
- every tab mounted at load through four lanes, the visible tab first ([app.js:380](project/src/app.js#L380)), inactive panes off-screen rather than `display: none` ([styles.css:47](project/src/styles.css#L47)) at the active width ([app.js:230](project/src/app.js#L230));
- the library filter bar on the `main` group, auto-applying ([app.js:371](project/src/app.js#L371));
- a rank-history sparkline column on the league table, from the joined history view ([catalogue.js:167](project/src/catalogue.js#L167), built at [catalogue.js:263](project/src/catalogue.js#L263));
- a query lane with 429 backoff, timeouts and a session cache keyed by the exact request ([throttle.js:112](project/src/throttle.js#L112));
- the maker–checker plan with "Acting as" and the four-eyes rule ([workflow.js:86](project/src/workflow.js#L86), [workflow.js:107](project/src/workflow.js#L107));
- a seven-sheet Excel report (Summary, one sheet per tab from each object's own `handle.getData`, Plan audit trail, Definitions) ([export.js:40](project/src/export.js#L40), [export.js:70](project/src/export.js#L70)). Before reading, it copies `main` into every tab group, hidden tabs included, and waits for the re-queries ([app.js:396](project/src/app.js#L396)), so every rival-set section follows the filters on screen; sections on the fixed groups (our university, the whole-league what-if and overtake, the plan rivals) say what they follow instead. `appState.exportProbe` lets the smoke test prove it with Nation = Scotland ([app.js:420](project/src/app.js#L420));
- ten self-checks the smoke test runs, each through the app's real selection path ([app.js:456](project/src/app.js#L456)).

## Semantic layer

[`layers/uk-university-rankings`](../../layers/uk-university-rankings/) ("UK University Rankings
2027"): 3 views, 2 joins (history and subjects many-to-one to the university on University ID),
21 dimensions, 43 measures and 40 stored business questions.

- **Views:** `UNI_FACT` (one row per university, 130), `UNI_HISTORY_FACT` (university × edition, 2025–2027), `UNI_SUBJECT_FACT` (subject top-10 places; unused).
- **Dimensions used:** University (Short), University, Rank 2027, Edition, Movement, Nation, University Group, Rank Band, Total Score (2027). Selections go on each dimension's raw column ([app.js:235](project/src/app.js#L235)); the sparkline column trends over the raw `Edition Date` of `UNI_HISTORY_FACT`.
- **Measures used:** Rank (value), Rank 2026 (value), Rank Change (value), Historic Rank, Avg Rank 2027, Avg Rank 2026, Avg Places Gained, Avg Historic Rank, Climbers / Fallers (with 2026 and Change), Universities, Avg Total Score, the seven component averages, Research / Entry / Prospects / Experience vs Set Average, Score Gap to Benchmark (parameter `benchmark`), Projected Rank at Score (parameter `score`).
- **Questions:** 18 of the 40, e.g. *Where do we rank this year, and how far have we moved?*, *Who sits within 10 places of us, and how do they score?*, *Where does each rival rank on each measure?*, *What rank would a higher total score buy us?*, *Which universities would we overtake?* Full list in [questions.md](../../layers/uk-university-rankings/questions.md).
- Defined but unused by the app: the subject view and its measures, Universities Scoring Above, Best Rank, Total Score Max, Places Gained Since 2025, the top-10 measures.

## Rebuild from nothing

1. **Data.** Load a university league table you are licensed to use into tables shaped like [`schema/ddl.sql`](../../layers/uk-university-rankings/schema/ddl.sql). The loading script is **not included in this repo**; No data is shipped: once your table is loaded, profile the layer over MCP ([playbook step 1](../../playbook/1-read-the-layer.md)) to see each dimension's values.
2. **Layer.** Recreate it from [`layer.json`](../../layers/uk-university-rankings/layer.json), pointing the three views at your tables, and publish it. The app needs the joins, both parameterised measures and the questions above.
3. **App.** See Run it.

## Run it

```sh
cd project
npm install                # public npm: @astrato-io/app-runtime, @astrato-io/visualizations, vite
# set semanticLayerId in astrato.json to your copy of the layer (it ships as a zero placeholder)
astrato login
npm run compile-check      # all 29 objects compile against the installed library, no session needed
astrato dev .              # open the sign-in URL it prints
node ../../../kit/verify/smoke.mjs "<that sign-in URL>" --widths 1440,1280,1024
astrato build .
```

Needs Node 24.18 or later. Add `?uni=<University (Short)>` to open on another university.
[docs/brief.md](project/docs/brief.md) and [docs/data-brief.md](project/docs/data-brief.md) are the
agent's own brief and data brief from the build.

## Caveats

- **A test run.** Built by an agent from this repo in a clean environment, then brought up to standard; read it as what the playbook produces.
- **No writeback.** The focus plan, decisions and audit trail live in `localStorage` (`climb-planner-plan-v1`, [workflow.js:22](project/src/workflow.js#L22)), and the screen says so.
- The two what-if KPIs are bare numbers, with no comparison or mini chart ([app.js:189](project/src/app.js#L189), [app.js:190](project/src/app.js#L190)). Projected rank does not break ties.
- The rank-on-measure table has no sparkline column.
- The hero's "N points … to the top 50" is a subtraction in the app of two governed values ([app.js:149](project/src/app.js#L149)), not a stored measure.
- Some bars draw no data label: UEL's +56 on *Who moved most*, and most gap bars on *What costs us places*.
- Indicator columns draw the same small up caret before every value, falls included; only the colour carries direction.
- Wrapped university names make table rows taller at 1280 and 1024.
- Clicks on the KPI mini charts and the moving-average line are untested.
- The total score's component weights are not in the data, so the app shows gaps per component, not how many points a component is worth.
- Changing our university reloads the page ([app.js:131](project/src/app.js#L131)).
- Inert leftovers: two unused questions in `questions.js` (`climbersBand`, `fallersBand`); an unused prefetch helper in `throttle.js`, whose header still mentions a timetable.
- Checked in staging with the kit smoke test at 1440, 1280 and 1024: PASS, 29 objects, landing-ready in 5.8 s, 10/10 app checks (a Nation filter on each of the first three tabs with queries per selection held to the visible objects, a chart click the next tab follows, the what-if at +52, the focus table, the workflow with four-eyes, an empty selection, the Excel report, no overflow); `npm run compile-check` 29/29; build passes. **Not published**, so no live smoke.
- `astrato.json` carries a zero placeholder `semanticLayerId`; `layer.json`'s datasource is a placeholder too.

## Data source and licence

See [DATA-SOURCES.md](../../DATA-SOURCES.md) for where this example's data comes from and on what terms.
