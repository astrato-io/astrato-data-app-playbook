# Data brief — UK University Rankings 2027

Layer `00000000-0000-0000-0000-000000000000`, profiled over MCP on 2026-11-17 (published rev 10 at
start; rev 13 after the additions below).

## Subject
A UK university league table: 130 UK universities, 2027 edition, with component
scores, the two prior overall ranks, a rank history view and subject top-10 tables.

## Scale and state
Start: rev 10 = published rev 10. 3 views, 54 fields, **0 joins**, 20 dimensions, 35 measures,
27 stored questions (17 in category "Climb planner", added recently by someone else — treated as
existing and not changed). Validation 0/0.

## Grain and time
| View | One row is | Date field | Min | Max | Latest complete period | Prior year? |
| --- | --- | --- | --- | --- | --- | --- |
| UNI_FACT | a university, 2027 edition (130 rows) | none (ranks 2025/2026/2027 as columns) | — | — | 2027 edition | yes, as columns |
| UNI_HISTORY_FACT | a university × edition (390 rows) | Edition Date (1 Jan) | 2025-01-01 | 2027-01-01 | 2027 edition | yes |
| UNI_SUBJECT_FACT | a top-10 place in a subject table (686 rows, 68 subjects, 80 universities) | none | — | — | 2027 | no |

Editions are annual; 2027-01-01 is after today (2026-11-17), so any relative-period axis would need
`periodEnd: latest`. Comparisons in the app are edition-on-edition (2027 vs 2026), never partial.

## Joins
None at start: a filter on UNI_FACT did not reach history or subjects. **Added** (rev 11) two
many-to-one joins on University ID (history → fact, subject → fact). Join quality: good/good.
Cross-fact check: the universities within 10 places of ours in 2027, with their average historic
rank per edition, reconciled. No fan-out (history grain leads). Figures from the source data are not
reproduced in this repo.

## Metrics (verified)
| Name | Aggregation | Value | Tier | Notes |
| --- | --- | --- | --- | --- |
| Universities | COUNT DISTINCT id | verified | stored | |
| Avg Total Score | AVG | verified | stored | 0–1000 scale, higher better |
| Rank (value) / Rank 2026 (value) | MIN | verified | stored | per university only; never sum |
| Rank Change (value) | | verified | stored | positive = climbed |
| Historic Rank | MIN | verified | stored | |
| Avg Research / Entry / Prospects / Experience / Teaching / Firsts / Continuation | AVG | verified | stored | one university has no research score |
| Climbers / Fallers (+ 2026, Change) | COUNT | verified | stored | |
| **Avg Historic Rank** (new) | AVG | verified on the rivals' range | added | |
| **Score Gap to Benchmark** (new) | AVG − param | verified against the rank-50 score | added | parameter `benchmark` |
| **Universities Scoring Above** (new) | COUNT DISTINCT, filtered | verified at the rank-50 score | added | parameter `score` |

## Dimensions (profiled)
| Name | Cardinality | Values | Suits |
| --- | --- | --- | --- |
| Nation | 4 | England, Scotland, Wales, Northern Ireland | filter, colour |
| University Group | 3 | Russell Group, Established (pre-1992), Modern (post-1992) | filter, colour |
| Rank Band | 5 | 1. Top 10, 2. 11–25, 3. 26–50, 4. 51–100, 5. 101+ | filter, axis |
| Movement | 5 | Big climber (+10 or more), Climbed, No change, Slipped, Big faller (−10 or more) | mini bar |
| University (Short) | one per university | short names | table, filter |
| Rank 2027 | 1–N (ties) | | range filter |
| Edition | 3 | 2025, 2026, 2027 | axis |
| **Total Score (2027)** (new) | continuous | | range selection |

## Stored questions
17 "Climb planner" questions already fit this persona (league table around us, rank on each measure,
gap to rivals' average, climbers/fallers vs last year). Reused as they are. Nine added (see brief).

## Reconciliation pairs
| Headline | Must equal | Observed |
| --- | --- | --- |
| Our rank 2027 and 2026 | Rank Change | difference ✓ |
| Rivals within 10 places | Σ Movement bar | to check on screen |
| Points to top 50 | rank-50 score − our score | ✓ |
| Score + that gap → rank 50 | ties with rank 50, not overtaken | ✓ |

## Gaps (fixed in step 4)
Joins (added); a rank-by-edition average (added); a score gap to our university (added, parameter);
a what-if count (added, parameter); a score dimension for range selections (added).
**Not supported:** component weights of the Total Score are not in the data, so the app cannot say
how many points a +1 in prospects is worth; it shows gaps per component, not a modelled bridge.

## Caveats
- Subject tables hold only top-10 places: a mid-table university rarely appears; not used.
- "Our university" is not named in the request. Default: **Kent**, a mid-ranked university.
  Switchable in the app header.
- One university has no research score.
