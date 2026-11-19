# Snowline — the Monday resort review

An Astrato App for the resort operations team: which resorts and weeks perform best, how snow
conditions drive visits, and where next season's marketing should go. Hand-written vanilla JS on
Vite with the public `@astrato-io/app-runtime` 0.9.0 and `@astrato-io/visualizations` 0.9.0, verified
with the playbook kit (compile check + smoke test, the independent judge's [SCORE.md](../SCORE.md)).

- Semantic layer: **Ski Resort Operations** `00000000-0000-0000-0000-000000000000`, published rev 10
  (built for this app over `ASTRATO_GALLERY.MOCK_DATA.SKI_*`; see `docs/data-brief.md`).
- Brief and assumptions: `docs/brief.md`. Not published (local build only, as asked).
- **All data is synthetic** (the `SKI_SOURCES` table says so) and ends 30 Mar 2026.

## The story

> Snow was **+4.4%** on last season, yet crowds stayed flat (Crowd Index **60.4**, ±0.0):
> **24** powder weeks went quiet.

Crowds follow the holidays (+28 index points), not the snow; spring has the deepest base and the
thinnest crowds; the unsold powder sits mostly at the Italian resorts. So the plan tab puts next
season's budget where good snow went unsold.

| Tab | Question |
| --- | --- |
| Season review | Did a snowier season bring more guests? 5 KPIs (value, change vs 2024/25 coloured by direction, native mini chart), snow vs crowd by week, resort table with a crowd sparkline column |
| Best resorts & weeks | Which resorts and weeks perform best? ranked table, resort × week heat map, top 10 resort-weeks, score profile |
| Snow & crowds | How do snow conditions drive visits? crowd by snowfall band × holiday/regular, holiday uplift KPI, base vs crowd by stage, 3-week moving averages, band × crowd-level heat map |
| Where to market | Where is good snow going unsold? demand headroom, quiet powder weeks by resort with share, gateway airports |
| Plan next season | Budget what-if (budget, powder threshold, quiet threshold → governed measure parameters): target-weeks KPI with change vs 2024/25 and mini chart; scenario beside the governed default plan by resort and by stage; maker–checker marketing plan with audit trail (browser-only, labelled) |

Every chart, KPI and table is a native Astrato object on one of the layer's 32 stored business
questions (`src/questions.js`), titled with the question. The headline sentence reads four stored
measures through one governed query and follows the filters. Excel report: header button, 8 sheets;
before reading, it copies the filters into every tab's selection group and waits for the
re-queries, so hidden tabs' sheets follow the filters too (registered as `appState.exportProbe`).

## Run it

```sh
npm install
npx astrato login --host https://<your-astrato-host>     # once, yourself
npm run compile-check                                # 40 objects, offline (playbook kit)
npx astrato --host https://<your-astrato-host> dev . --no-open
# open the sign-in URL it prints, then (the playbook kit's smoke test):
node <playbook>/kit/verify/smoke.mjs "<sign-in URL>" --widths 1440,1280 --out shots/final
node <playbook>/kit/verify/smoke.mjs "<sign-in URL>" --widths 1024 --scroll-ok --out shots/final-1024   # 1024 stacks and scrolls
npm run build                                        # dist/
```

## What is not here

- Visits, revenue and marketing spend: the tables have none. Crowd Index stands in for visits.
- Writeback: no warehouse table may be created, so the plan workflow is a labelled browser-only
  simulation.
- Lines in combo charts (the moving-average chart) have no clickable points on 0.9; the card says so.

## Techniques copied (from the league-table-planner example)

`fields.js`, `theme.js` (apply-each), `throttle.js` (lanes raised to 8; failures now close),
`app-state.js`, `xlsx.js`, the per-tab selection groups mirrored from `main`, KPI = number +
one-row change table + mini chart, the export and workflow skeletons. Page structure is our own.
