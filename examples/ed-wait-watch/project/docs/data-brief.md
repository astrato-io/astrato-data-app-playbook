# Data brief — Hospital ER Operations (00000000-0000-0000-0000-000000000000)

## Subject
One row per emergency-department visit at one hospital, Apr 2019 – Oct 2020: arrival time, wait before being seen, referral department, patient group and (for some visits) a satisfaction score.

## Scale and state (as read, 2026-11-18)
Revision 26 = published revision 26 when read. 1 view (`ER Visits`, 24 fields), 0 joins, 16 dimensions, 10 measures, **0 stored questions**. No junk names. Every item has a description.

## Grain and time
| View | One row is | Date field | Min | Max | Latest complete period | Prior year? |
| --- | --- | --- | --- | --- | --- | --- |
| ER Visits | one ED visit (Patient ID) | Er Day (date) / Er Month | 2019-04-01 | 2020-10-30 | Sep 2020 is the last full month; Oct 2020 holds 1–30 Oct (31 Oct missing) | Only Apr–Oct 2020 have a prior-year month; YoY not used |

Decision: KPI comparisons use a stored time axis **Review Month** (`monthToDate`, `periodEnd: latest`): **1–30 Oct 2020 vs 1–30 Sep 2020**, equal-length windows. `Arrival Month` returns 19 rows (verified: month grain).

## Joins
None. One fact view. The two flag views added in step 4 (`Er Wait Flags`, `Er Wait Flag Events`) are not joinable to visits (no shared key); flag filters and visit filters are kept apart.

## Metrics (verified over MCP, all visits, no selection)
| Name | Reference | Aggregation | Value | Tier | Notes |
| --- | --- | --- | --- | --- | --- |
| Patients | measure | COUNT(Patient ID) | 9,216 | stored | volume |
| Avg Wait Time | measure | AVG(Patient Waittime) | 35.3 min | stored | down is good; waits run 10–60 min |
| Avg Satisfaction | measure | AVG(Patient Sat Score) | 5.0 | stored | **only 2,517 visits (27%) have a score** |
| CSAT Responses | measure | COUNT(Sat Score) | 2,517 | stored | |
| Seen within 30 min | local → added as `Seen Within Target %` | COUNT(wait ≤ 30)/COUNT | 40.7% | raw → layer | up is good; ratio of counts |
| Over target | `Wait Target` = Exceeded | | 5,467 (59.3%) | stored dim | |
| Admission Rate | measure | AVG(0/1) | ~50% | stored | not used |

## Dimensions (profiled)
| Name | Cardinality | Values / range | Suits |
| --- | --- | --- | --- |
| Department Referral | 8 | None 5,400; General Practice 1,840; Orthopedics 995; Physiotherapy 276; Cardiology 248; Neurology 193; Gastroenterology 178; Renal 86 | bar, filter |
| Time Band | 8 | 00-03h … 21-24h, ~1,130–1,184 each | heat map axis, filter |
| Weekday Short | 7 | 1 Mon … 7 Sun, 1,260–1,377 | heat map axis |
| Hour of Day | 24 | 0–23 | bar |
| Age Band | 8 | 0-9 … 70-79, ~1,056–1,200 | bar |
| Race | 7 | longest label "Native American/Alaska Native" (29 chars) | horizontal bar |
| Gender | 3 | Female, Male, Non-Conforming (24 visits) | bar |
| Period | 19 | 2019-04 … 2020-10 | month filter |
| Wait Target | 2 | Exceeded Target / Within Target | |

## Profile findings
- Within 30 min by time band: 37.6% (03-06h, 21-24h) to 42.8% (18-21h). By weekday 39.0%–42.2%. By department 35.2% (Neurology) to 43.2% (Orthopedics). By age 39.3%–42.4%. Differences are small: no group meets even half.
- Weekday × time band (56 cells, ~165 visits each): worst Wed 06-09h 32.7%, Mon 21-24h 33.0%, Thu 09-12h 33.5%; best Thu 06-09h 47.7%.
- Monthly: 34.3% (Feb 2020) to 45.2% (Sep 2019); Oct 2020 44.4%, the best since Sep 2019.
- Satisfaction by wait band: 5.26 (10-19 min), 4.91, 4.80, 5.04, 4.98, 4.55 (60 min). Within target 5.04 vs over 4.96: a weak relationship.

## Stored questions
None existed. 31 created in step 4 (one per object).

## Reconciliation pairs
| Headline | Must equal | Observed |
| --- | --- | --- |
| Patients (9,216) | Σ Patients by Department | 5,400+1,840+995+276+248+193+178+86 = 9,216 ✓ |
| Patients Over Target (5,467) | Σ by Time Band of Patients − Within | to check in app |
| Seen Within Target % This Month (44.4%) | Seen Within Target % for Period = 2020-10 | 44.4% (monthly trend row) ✓ |

## Gaps (closed in step 4)
Within-target measure; over-target count and share; time axis and this/last/change families for within %, wait, satisfaction, visits; wait band; flag storage and measures. No target % for "share seen within 30 min" exists in the data, so none is drawn.

## Caveats
Satisfaction covers 27% of visits. 31 Oct 2020 is missing. Department "None" = not referred on (58% of visits). The dataset is a demo extract (2019–2020).
