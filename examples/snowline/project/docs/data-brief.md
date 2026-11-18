# Data brief — Ski Resort Operations (layer 00000000-0000-0000-0000-000000000000)

## Subject
Ten fictional Alpine ski resorts, week by week across two seasons: snow, weather, crowding, prices
and precomputed guest-suitability scores. `SKI_SOURCES` states every value is **synthetic**.

## Scale and state
Published revision 8 (= draft). 5 views, 2 joins, 14 dimensions, 43 measures, 28 stored questions.
Validation 0 errors; source-schema drift 0 (checked rev 3; no view changed since).

## Grain and time
| View | One row is | Date field | Min | Max | Latest complete period | Prior year? |
| --- | --- | --- | --- | --- | --- | --- |
| Resort Weeks (SKI_RESORT_WEEKS) | one resort in one season week (360) | via Season Weeks.Week Start | 2 Dec 2024 | 30 Mar 2026 | season 2025/26 (complete, ended 5 Apr 2026) | yes: 2024/25 |
| Season Weeks (SKI_WEEKS) | one calendar week of a season (36: 18 × 2) | Week Start | 2024-12-02 | 2026-03-30 | — | — |
| Resorts (SKI_RESORTS) | one resort (10) | — | | | | |
| Score Weights, Data Sources | reference (5, 6 rows), not joined | | | | | |

Seasons: 2024/25 starts Mon 2 Dec 2024, last week 31 Mar 2025; 2025/26 starts Mon 1 Dec 2025, last
week 30 Mar 2026. Each has 18 weeks. There is no data after March 2026 and none for 2026/27.

## Joins
Resort Weeks → Resorts (Resort ID) and Resort Weeks → Season Weeks (Week ID), both many-to-one,
360/360 rows matched, join quality "good". One fact, so every filter reaches every figure.

## Metrics (verified over MCP, published rev 6)
| Name | Value | Notes |
| --- | --- | --- |
| Snowfall This / Last Season | 8,818 cm / 8,450 cm | filtered on Season; +4.4% (Snowfall Change vs Last Season 0.04355) |
| Crowd Index This / Last Season | 60.4 / 60.4 (+0.03) | average 0-100 index; the only demand signal, used as the visits proxy |
| Base Depth This Season | 165 cm (+5.9 cm) | snapshot per week, averaged |
| Trip Cost This Season | €2,391 (0.0%) | prices identical in both seasons |
| Quiet Powder Weeks This Season | 24 (+2 vs 22) | regular weeks, ≥40 cm fresh snow, Crowd Index < 55; down is good |
| Overall Week Score This Season | 64.4 (+0.64) | 0.35 snow + 0.25 value + 0.15 quiet + 0.10 family + 0.15 expert |
| Holiday Crowd Uplift | +27.9 points | holiday weeks ~85 vs regular ~57 |
| Total Snowfall (all) | 17,268 cm | = 8,818 + 8,450 ✓ |

## Dimensions (profiled)
| Name | Cardinality | Values / notes |
| --- | --- | --- |
| Resort | 10 | longest "Pinecrest Dolomiti" (18 chars) |
| Country | 5 | France, Switzerland, Austria, Italy, Germany |
| Gateway Airport | 9 | Geneva serves two resorts |
| Season | 2 | 2024/25, 2025/26 |
| Season Stage (mapping) | 4 | 1 Early season, 2 Peak winter, 3 Mid winter, 4 Spring |
| Season Week | 18 | 1-18 |
| Week Type (mapping) | 2 | Holiday week (weeks 4 and 9), Regular week |
| Snowfall Band (mapping) | 4 | 0-19, 20-39, 40-59, 60+ cm |
| Crowd Level (mapping) | 4 | 1 Quiet (<55), 2 Steady, 3 Busy, 4 Packed (80+) |

## Findings that shape the app
- Snow up 4.4% but crowds flat: snowfall did not convert into demand season-on-season.
- Crowds follow holidays (+28 points) far more than snow. Within regular weeks they do rise with
  snow: 50 at 0-19 cm → 62 at 60+ cm.
- Spring has the deepest base (190 cm) and the thinnest crowds (55.9); peak winter is the reverse.
- Quiet powder weeks concentrate in Italy (Valle Stella 10, Monte Brina 8 over both seasons) and
  are zero at the two big French resorts.

## Reconciliation pairs
| Headline | Must equal | Observed |
| --- | --- | --- |
| Quiet Powder Weeks This Season (24) | Σ by resort in "How did each resort's season compare" | 24 ✓ |
| Suggested Budget (€250,000 default) | Σ by resort | €250,000 ✓ |
| Total Snowfall all (17,268) | This + Last Season | 8,818 + 8,450 ✓ |

## Gaps
- **No visits, no revenue, no marketing spend.** Crowd Index stands in for visits; the budget
  split is a governed what-if rule, not a spend history.
- No 2026/27 data: "next season" is planned from the two seasons we have.
- Data ends 30 Mar 2026; today is 18 Nov 2026. Nothing here is live.

## Caveats
- The "This / Last Season" measures name the seasons (Season = 2025/26 / 2024/25). A Season Axis
  with period-comparison measures was built first, but (a) with `periodEnd: latest` it dropped the
  31 Mar 2025 week from last season (8,183 cm instead of 8,450) and (b) the engine refuses any
  period-comparison measure when a query filters a Season Weeks field (stage, week type): error
  013401. Roll the season names forward when 2026/27 data lands. The axis is kept, unused.
- Holiday Crowd Uplift measures are empty, not negative, when no holiday weeks are in view.
- Trip prices do not change between seasons, so price can't explain demand.
