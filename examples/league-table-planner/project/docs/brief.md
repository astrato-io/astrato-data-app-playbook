# Brief — League Table Climb Planner

Semantic layer: `00000000-0000-0000-0000-000000000000`        Archetype: **planner**
Persona: Director of Strategy at a mid-ranked UK university; annual league-table review, desktop
1440 wide, then forwards a focus plan to the Vice-Chancellor.
Decision: **Which measures and which rival universities do we focus on next year to climb the table?**
Hero number: **our rank, the places moved since 2026 and 2025, and the points of total score that
separate us from the top 50** (verified over MCP; the figures are not reproduced in this repo).
Story path: where do we stand (hero) → which measures cost us places against our rivals → what
would it take to climb (what-if) → the focus plan (decision + approval).

Assumption (nobody to sign off): the university is not named, so the app opens on Kent and lets the
reader switch "our university"; rivals default to the universities within 10 places of us.

## Tabs
| Tab | Question it answers | Key cards | Selection group |
| --- | --- | --- | --- |
| Where we stand | Where do we stand, and who is around us? | our rank KPI; rivals' avg rank; climbers; fallers; who moved most; league table ±10 | `t-stand` (+ `us` for our KPI) |
| What costs us places | Which measures cost us places against our rivals? | rank on each measure; gap to rivals' average on research, entry, prospects, experience | `t-measures` |
| What it takes | What would a higher total score buy us? | gain slider; projected rank; points separating each rival; who we would overtake; rivals' average rank trend | `t-climb` (+ `overtake`) |
| Focus plan | What do we commit to, and has it been approved? | focus form; maker–checker; audit trail; focus comparison table | `focus` |

Every tab group mirrors `main` (the rival set) only while the tab is visible.

## Analytical depth
| Kind | Where | In the layer |
| --- | --- | --- |
| Period comparison | rank 2027 vs 2026; rivals' avg rank vs 2026; climbers/fallers vs last year | exists |
| Window | rivals' average rank with a two-edition moving average | added question |
| Rank / top N | rank of each rival on each measure within the set | exists |
| Drivers | gap to rivals' average per component; points separating each rival from us | exists + added |

## Levers (what-if)
| Lever | Range | Moves | How |
| --- | --- | --- | --- |
| Total-score gain | 0–120 points | projected rank; universities overtaken | parameter on `Universities Scoring Above`; range selection on `Total Score (2027)` |

## Workflows
| Record | States | Roles | Audit | Storage |
| --- | --- | --- | --- | --- |
| Focus plan (≤3 measures, ≤6 rivals, rationale) | Draft → Proposed → Approved / Returned | Director of Strategy proposes; Vice-Chancellor approves; proposer cannot approve | who, role, action, before → after, note, when | **browser-only simulation** (no writeback table may be created), labelled |

## Excel report
Header button. Sheets: Summary, one per tab (rows of each object's own governed query, following the
filters), Focus plan, Definitions.

## Look
Light; deep navy header band, teal accent for "us", red/green only for falls/climbs.

## Out of scope
Component weights (not in the data); subject tables (top-10 only).

## References
| Example | Why | Techniques | Not copying |
| --- | --- | --- | --- |
| lending-affordability | planner-like levers, 0.8 wiring | bootstrap, mount with ready timeout, theme ops, `applyEach`, pending → main | page skeleton, rail/tabs layout |
| portfolio-os | workbench, Excel, scheduler | xlsx writer, scheduler lanes/cache/429 | modules, theme |
| revenue-war-room | command-centre KPIs | KPI card shape | layout |
