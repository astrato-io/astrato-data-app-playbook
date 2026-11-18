# Brief — Snowline: the Monday resort review

Semantic layer: 00000000-0000-0000-0000-000000000000 (Ski Resort Operations, rev 6)   Archetype: planner
Persona:     Head of Resort Operations, with the marketing lead; every Monday, laptop at 1440 wide.
             (ASSUMPTION: no one named a persona beyond "resort operations team".)
Decision:    Which resorts and weeks do we push next season, and where does the marketing budget go?
Hero number: Snow +4.4% on last season, Crowd Index flat (60.4, +0.0): 24 powder weeks went quiet.
Story path:  snow came but crowds didn't (glance) → which resorts and weeks are best (where) →
             crowds follow holidays, not snow; spring is under-sold (why) → put the budget on
             quiet powder: Italy and spring (what we do).

## Tabs
| Tab | Question | Key cards | Group |
| --- | --- | --- | --- |
| Season review | Did a snowier season bring more guests? | 5 KPIs (snow, crowd, base, quiet powder weeks, week score) each with change + mini chart; hero combo snow vs crowd by season week; resort table with crowd sparkline | review |
| Best resorts & weeks | Which resorts and weeks perform best? | ranked bar; resort × week heat map; top-10 resort-weeks; score-profile table | best |
| Snow & crowds | How do snow conditions drive visits? | crowd by snow band × week type; holiday uplift KPI; base vs crowd by stage; 3-week moving averages; band × crowd-level heat map | snow |
| Next season's marketing | Where should next season's marketing go? | demand headroom bar; quiet-powder table with share; airports bar; budget what-if (3 levers) with split by resort and stage; maker–checker plan | market / whatif |

## Analytical depth
| Kind | Where | Layer |
| --- | --- | --- |
| Period comparison | every KPI, resort table | Season Axis + This/Last/Change measures (exists) |
| Window | "Do crowds follow the snow…" 3-week moving average | question advanced calc (exists) |
| Rank / share | best-resort rank; share of quiet powder weeks | question rank; Share measure scope total (exists) |
| Drivers | holiday uplift; snow band × week type; demand headroom | measures (exist) |

## Levers (what-if)
| Lever | Range | Moves | How |
| --- | --- | --- | --- |
| Budget | €50k-€1m | Suggested Budget | measure parameter `budget` |
| Powder threshold | 20-80 cm | Target Weeks, split | parameter `minSnow` |
| Quiet threshold | 45-70 | Target Weeks, split | parameter `maxCrowd` |

## Workflow
Record: next season's marketing plan (focus resorts, focus stage, budget, rationale).
States Draft → Proposed → Approved | Returned. Head of Resort Ops or Marketing Lead propose; the
Commercial Director approves; nobody approves their own proposal. Audit trail (who, role, before,
after, note, when). Storage: **browser-only simulation** — the brief forbids creating warehouse
tables, so there is no writeback table. Labelled on screen.

## Excel report
Summary, one sheet per tab (from each object's own data, following filters), plan audit trail,
definitions.

## Look (ASSUMPTION — no brand given)
Light. A cold alpine palette: glacier-white page, deep slate ink, a single ice-blue accent for
snow, a warm "lift-pass" amber for crowds/demand so the two quantities never share a colour.
Green/red only for good/bad change. Display face: "Fraunces"-like serif not loaded (no external
fonts offline); use system UI + Roboto for charts.

## Out of scope / not supported by the data
Visits and revenue (no columns), marketing spend history (no table), 2026/27 forecasts.
Publishing the app (user asked for a verified local build only).

## References
| Example | Why | Copy | Not copying |
| --- | --- | --- | --- |
| league-table-planner | planner archetype, same generation, 0.9 | fields.js, theme.js applyEach, prepare widthOps, throttle.js, app-state.js, per-tab selection groups + mirror, KPI = number + change table + mini chart, xlsx writer, workflow skeleton | its page layout, tab set, palette |
| labour-market-pulse | report on 0.9 with parameter what-if | parameter op `setMeasureDefinedParameter` | layout |
