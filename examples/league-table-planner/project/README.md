# League Table Climb Planner

An Astrato App for the Director of Strategy of a mid-ranked UK university. It answers one decision:
**which measures and which rival universities do we focus on next year to climb the league table?**

Built on semantic layer `00000000-0000-0000-0000-000000000000` ("UK University Rankings 2027"),
Vite and the public packages: `@astrato-io/visualizations` 0.9.0, `@astrato-io/app-runtime` 0.8.0,
`@fontsource/roboto`; verified with the playbook kit (compile check and smoke test).

## Run it

```sh
npm install
astrato --host <your Astrato origin> dev . --no-open          # open the sign-in URL it prints
npm run build                                                 # validated static build in dist/
npm run compile-check                                         # offline: every tile compiles (kit)
node <playbook>/kit/verify/smoke.mjs "<sign-in URL>" --widths 1440,1280,1024 --out shots
```

The app is **not published** (by request). Opening `?uni=<University (Short)>` or the header picker
switches "our university"; the default is Kent.

## Tabs

| Tab | Question | Objects |
| --- | --- | --- |
| Where we stand | Where do we stand, and who is around us? | headline sentence; 4 KPI cards (value, change vs 2026 coloured by direction, native mini chart); places moved by rival (us in teal); league table ±10 places with a rank-history sparkline column |
| What costs us places | Which measures cost us places against our rivals? | rank of each rival on each component; four "points above/below the rivals' average" bars (prospects, experience, research, entry) |
| What it takes | What would a higher total score buy us? | total-score gain slider → projected rank (governed parameter) and universities overtaken (governed range selection); points separating each rival from us; who we would overtake; rivals' average rank with a 2-edition moving average |
| Focus plan | What do we commit to, and has it been approved? | up to 3 measures + 6 rivals + rationale; Director proposes, Vice-Chancellor approves/returns, four-eyes enforced, audit trail, reset (browser-only, labelled); comparison table and points chart for the planned rivals |

Header: our-university picker and an **Excel report** (Summary, one sheet per tab from each object's
own governed query following the filters, Focus plan, Definitions). A sticky selection bar carries
Nation / Group / Rank band filters, the library filter bar (chips, ×, Clear all) and a reset to
"rivals ±10 places".

## How it is put together

| File | Role |
| --- | --- |
| `src/questions.js` | the app's copy of every stored business question it draws (names = card titles) |
| `src/catalogue.js` | every native object as data: question + presentation; selection groups |
| `src/app.js` | boot, governed headline query, shell, selection groups and mirroring, what-if, mounting, self-checks |
| `src/theme.js`, `src/fields.js` | copied from the lending-affordability example (operations-based theming, field index) |
| `src/throttle.js`, `src/xlsx.js` | copied from portfolio-os (query lanes/429 retry/cache/`__qlog`; styled xlsx writer) |
| `src/app-state.js` | the playbook kit's smoke-test contract (tabs, objects, queries, checks, landing-ready) |
| `src/prepare.js` | the one path every tile takes before mount (theme, governed parameters, labels) and its width-dependent operations (table column widths, wrapping, narrow-screen columns and labels), shared with `tools/compile-adapter.mjs` |
| `src/workflow.js`, `src/export.js` | focus-plan workflow; Excel report |
| `docs/` | data brief and brief |

Selection groups: `main` (rival set, filters and chips) mirrored into one group per tab only while it
is visible; `us` (pinned to our university); `whatif`, `overtake` (what-if); `focus` (plan rivals).
