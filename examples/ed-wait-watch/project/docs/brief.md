# Brief — ED Wait Watch

Semantic layer: 00000000-0000-0000-0000-000000000000 (Hospital ER Operations)    Archetype: **monitor** (with a flag workflow)
Persona: ED operations lead and the duty managers, every morning, desktop 1440 wide.
Decision: *Where and when are we missing the 30-minute target, and what do we hand to whom today?*
Hero number: 1–30 Oct 2020: **44.4%** of patients seen within 30 minutes, **+4.0 pts** on 1–30 Sep and the best month since Sep 2019 — yet 56% still wait longer; the worst slot is Wed 06–09h (32.7%).
Story path: are we meeting it? (board) → when? (when) → who? (who) → does it hurt satisfaction? (satisfaction) → what are we doing about it? (flags)

## Tabs
| Tab | Question | Key cards | Group |
| --- | --- | --- | --- |
| Morning board | Are we seeing patients within 30 minutes? | headline; 4 KPIs (within %, avg wait, satisfaction, visits) with Oct vs Sep and a mini line; monthly trend + 3-month average; weekday × time-band heat map; flag counts | g-board / g-board-k |
| When | When do patients wait longer than 30 minutes? | over-target by hour; within % by weekday; time-band table (rank, share of over-target, sparkline); target what-if | g-when |
| Who | Which departments and patient groups wait longest? | department bar; department table (rank, share, sparkline); age, race, gender | g-who |
| Satisfaction | Does satisfaction fall as waits grow? | satisfaction by wait band; within vs over target; dual-axis monthly trend; department table | g-sat |
| Flags | What has been flagged, who owns it, what is overdue? | flag form; acting-as; open / overdue / sign-off counts; owners; flag table; audit trail | g-flags |

## Analytical depth
| Kind | Where | Layer |
| --- | --- | --- |
| Period comparison | KPI cards: Oct 1–30 vs Sep 1–30 | Review Month axis + This/Last/Change measures (added) |
| Window | Hero trend: 3-month moving average | question advancedCalculation |
| Rank / share | Department and time-band tables: rank (1 = worst), share of over-target visits | rank in question; `Share of Over-Target Patients` (scope total, added) |
| Drivers | Which slots and departments carry the over-target visits (share of over-target) | as above |
| Parameter | Target minutes what-if | `Target Minutes` parameter on `Seen Within Target %` and `Patients Over Target` |
Not supported: a % target for "seen within 30 min" (none in the data), year-on-year (only 7 months have a prior year).

## Levers (what-if)
| Lever | Range | Moves | How |
| --- | --- | --- | --- |
| Waiting-time target (minutes) | 15–45 | share seen within target, patients over target | layer parameter via `setMeasureDefinedParameter`; governed baseline at 30 |

## Workflows
| Record | States | Roles | Audit | Storage |
| --- | --- | --- | --- | --- |
| Wait flag (a time slot or a department) | Open → In progress → Resolved → Closed; Reopen from Resolved/Closed | Duty manager raises, assigns owner + due date, records progress/resolution; ED operations lead signs off (Close) or reopens; nobody signs off a flag they raised | Event row per change: who, role, action, from, to, note, when | Writeback to two workflow tables (records and audit events) (new tables, user-approved); labelled browser-only fallback where the runtime cannot write |

## Excel report
Summary (KPIs + headline), When, Who, Satisfaction, Flags, Data (month × department), Definitions. Follows on-screen selections.

## Look (assumption — no brand given)
Light, clinical but warm: pale blue-grey page, white cards, deep teal ink and accent, coral for "over target", plum for satisfaction. IBM Plex Sans for UI, Roboto in charts. Dense but one screen per tab at 1440×860.

## References
| Example | Why | Copy | Not copying |
| --- | --- | --- | --- |
| labour-market-pulse | newest build on visualizations 0.9; governed KPIs; per-tab groups | tiles.js prepare path, fields.js, throttle.js, xlsx.js, selection mirroring, KPI colouring, setMeasureDefinedParameter what-if | page layout, tabs, theme |
| stock-rotation / portfolio-os | real writeback | `app.writeback` call shape, cache clear after write | HTML tables for workflow lists |

## Out of scope
Publishing (user asked for a local build only). Staff rota / capacity data does not exist in the layer, so no "why" beyond slot, department and patient group.
