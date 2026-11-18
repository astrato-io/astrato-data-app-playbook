# Data brief — UK Labour Market (ONS LMS)

Layer `00000000-0000-0000-0000-000000000000`, read 2026-11-17 over MCP (contract 10.38.0). All
values below were executed over MCP against the published revision; the SQL the engine ran was
read back for each.

## Subject

ONS Labour Market Statistics, release of 15 Sep 2026: one row per ONS series (CDID) per month,
Jan 2015 → Jun/Jul 2026, with the series' value 3 and 12 months earlier and in Feb 2020 carried
on the same row.

## Scale and state

- Revision 9, published revision 9, `publicationState: published`. No unpublished drafts.
- 1 view (`Labour Market` → `MOCK_DATA.LMS_FACT`, Snowflake), 17 fields, **0 joins**, 10
  dimensions, 22 measures, 13 stored questions, 0 set filters, 0 data actions.
- No junk names. Every item has a description. The published layer is in `layers/uk-labour-market/`.

## Grain and time

| View | One row is | Date field | Min | Max | Latest complete period | Prior year? |
| --- | --- | --- | --- | --- | --- | --- |
| Labour Market | one series (CDID) × one month | Period Date (first day of the period's final month) | 2015-01-01 | 2026-07-01 | **per series**: LFS series Apr–Jun 2026 (Period 2026-06-01); pay and vacancies Jul 2026 / May–Jul 2026 (2026-07-01) | Yes, 11+ years; `Value Prev Year` carried on each row |

- 138 monthly rows per LFS series (Jan 2015–Jun 2026), 139 for pay and vacancy series.
- The latest period differs by series. A single "latest month" for the whole view (Jul 2026) is
  empty for every LFS series. The layer handles this with `Period Status = Latest` (per series)
  and `Months Before Latest`. **Every "latest" figure in the app must use Period Status, never
  the view's max date.**
- LFS series are rolling 3-month averages labelled by their final month; pay growth is a 3-month
  average on a year. Nothing here is a partial period: each row is a complete published reading.
- `Period` (date) needs no date level: it is already one row per month (138 rows for MGSX).
- `Period Label` is a string ("Apr-Jun 2026") and sorts alphabetically: never use it as an axis.

## Joins

None, and none needed: a single fact view. Every filter on a view field reaches every object.
But the **meaning** of Geography differs: headline measures are filtered to UK series by CDID
inside the measure, so a Geography = "London" selection makes every UK headline measure empty.
Regional figures exist only as two indicators (unemployment rate, employment rate 16–64) under
`Theme = Regional`. Sex = Male/Female exists only for the UK employment and unemployment rates.

## Metrics (verified)

Latest release, UK, from stored question *Where does the UK labour market stand in the latest
release?* (tier 1). All headline measures are `AVG(Value)` filtered to one CDID: correct for one
period, an **average of monthly readings** when several months are in context (not a sum).

| Name | Reference | Aggregation | Latest value | Δ quarter | Δ year | Δ vs Feb 2020 | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Unemployment rate | `Unemployment Rate` (MGSX) | AVG | 4.9% (Apr–Jun 2026) | 0.0 | **+0.2 pp** | +0.8 pp | down is good |
| Youth unemployment rate | `Youth Unemployment Rate` (MGWY) | AVG | 16.4% | +0.2 | **+2.1 pp** | +4.0 pp | down is good |
| Employment rate 16–64 | `Employment Rate` (LF24) | AVG | 75.1% | 0.0 | −0.1 pp | −0.8 pp | up is good |
| Inactivity rate 16–64 | `Inactivity Rate` (LF2S) | AVG | 20.9% | −0.1 | −0.1 pp | +0.2 pp | down is good |
| Vacancies (000s) | `Vacancies (000s)` (AP2Y) | AVG | 702 (May–Jul 2026) | −8 | **−36** | −86 | up = tighter |
| Unemployed per vacancy | `Unemployed per Vacancy` (JPC5) | AVG | **2.5** (Apr–Jun 2026) | 0.0 | **+0.2** | **+0.7** | up = looser |
| Regular pay growth | `Regular Pay Growth` (KAI9) | AVG | 3.5% (Jul 2026) | +0.1 | **−1.3 pp** | +0.6 pp | wage pressure |
| Real regular pay growth | `Real Regular Pay Growth` (A2FA) | AVG | 0.6% | +0.5 | −0.1 pp | −0.7 pp | CPIH-deflated |
| Private sector pay growth | `Private Sector Pay Growth` (KAJ4) | AVG | 2.9% | −0.1 | −1.7 pp | 0.0 | |
| Public sector pay growth | `Public Sector Pay Growth` (KAJ7) | AVG | 6.3% | +1.2 | +0.7 pp | +3.1 pp | |
| Long-term sick (000s) | `Long-term Sick (000s)` (LF69) | AVG | 2,780 | +8 | −12 | +551 | |
| Employment level (000s) | `Employment Level (000s)` (MGRZ) | AVG | 34,478 | +67 | +243 | +1,497 | |
| Change on Quarter / Year / vs Pre-Pandemic | generic `{m1}-{m2}` | AVG − AVG | — | | | | **see caveat 1** |

Annual averages (tier 2, `Year` × stored measures) — the cycle:

| Year | Unemployed per vacancy | Vacancies (000s) | Unemployment % | Pay growth % | Real pay % |
| --- | --- | --- | --- | --- | --- |
| 2019 | 1.61 | 824 | 3.85 | 3.54 | 1.71 |
| 2020 | 3.01 | 554 | 4.60 | 2.02 | 0.99 |
| 2022 | **1.06** (tightest) | 1,231 | 3.78 | 5.27 | −2.08 |
| 2023 | 1.42 | 1,006 | 4.08 | **7.20** | −0.05 |
| 2024 | 1.76 | 853 | 4.29 | 5.64 | 2.23 |
| 2025 | 2.34 | 743 | 4.85 | 4.98 | 1.08 |
| 2026 (Jan–Jul) | **2.50** | 712 | 4.92 | 3.51 | 0.33 |

## Dimensions (profiled)

| Name | Reference | Cardinality | Values | Null % | Suits |
| --- | --- | --- | --- | --- | --- |
| Theme | `Theme` | 6 | Employment, Unemployment, Inactivity, Pay, Vacancies, Regional | 0 | filter, series |
| Geography | `Geography` | 13 | United Kingdom + 12 regions/nations (East Midlands, East of England, London, North East, North West, Northern Ireland, Scotland, South East, South West, Wales, West Midlands, Yorkshire & Humber) | 0 | bar axis, filter (Regional only) |
| Indicator | `Indicator` | ~60 | e.g. "Unemployment rate", "Vacancies: Construction" (7 sectors), "Inactive: long-term sick" (6 reasons) | 0 | table, filtered bars |
| Series ID | `Series ID` | ~60 CDIDs | MGSX, AP2Y, JPC5, KAI9, A2FA… | 0 | filter |
| Sex | `Sex` | 3 | All, Male, Female (Male/Female only for UK employment & unemployment rates) | 0 | not app-wide |
| Unit | `Unit` | 7 | %, 000s, millions, £, per 1,000, ratio | 0 | label only |
| Period | `Period` | 139 months | 2015-01-01 → 2026-07-01 | 0 | time axis |
| Year | `Year` | 12 | 2015–2026 (2026 partial: Jan–Jun/Jul) | 0 | filter, bar axis |
| Period Status | `Period Status` | 2 | Latest, History | 0 | "latest release" filter |
| Period Label | `Period Label` | 139+ | "Apr-Jun 2026" | 0 | label only (sorts alphabetically) |

Sectors with vacancy series (latest May–Jul 2026, 000s, Δ year): Health & social work 121 (−9),
Wholesale & retail 91 (−3), Hospitality 70 (−8), Manufacturing 48 (−2), Information & comms 36
(0), Public admin & defence 31 (+2), Construction 29 (−2). These 7 sum to 426 of 702: **not the
full industry breakdown**.

Regions, latest Apr–Jun 2026 (unemployment %, Δ year pp): London 6.8 (+0.7), West Midlands 5.6
(−0.4), Yorkshire & Humber 5.2 (+0.2), North East 5.1 (0.0), Scotland 5.1 (**+1.8**), North West
5.0, East Midlands 4.9, Wales 4.3, South East 4.2 (+0.4), South West 3.9 (+0.5), East of England
3.8 (−1.0), Northern Ireland 2.4.

## Stored questions

| Name | What it answers | Runs? | Candidate use |
| --- | --- | --- | --- |
| Where does the UK labour market stand in the latest release? | 37 UK indicators, latest, Δq/Δy/Δ pre-pandemic | ✓ 37 rows | Briefing table / Excel |
| Is the jobs market loosening? | vacancies + U/V by Period | ✓ | hero trend |
| How has unemployment moved since 2015? | unemployment + youth by Period | ✓ | trend |
| Are real wages still growing? | nominal vs real pay by Period | ✓ | pay tab |
| Is public sector pay outpacing the private sector? | KAJ7 vs KAJ4 by Period | ✓ | pay tab |
| Which sectors are cutting vacancies? | 7 sectors, latest, Δ year | ✓ | demand tab |
| How is each region's labour market doing? | 12 regions, latest, Δ | ✓ 12 rows | regional table |
| Which regions have the highest unemployment? / employment rate? / seen unemployment rise most since the pandemic? | regional bars | ✓ | regional tab |
| How has unemployment changed in each region over time? | region × year | ✓ | heat map |
| Is long-term sickness still rising? / Why are people economically inactive? | inactivity | ✓ | supply side |

The existing questions are the owner's spec and are close to this persona. They lack: KPI
questions, windows (moving average), rank/share, and a tightness gauge.

## Reconciliation pairs

| Headline | Must equal | Observed |
| --- | --- | --- |
| KPI Unemployment rate (latest) | row "Unemployment rate" in the latest-release question | 4.9 = 4.9 |
| KPI Unemployed per vacancy (latest) | latest row of *Is the jobs market loosening?* | 2.5 |
| KPI Vacancies (latest) and its Δ year | latest-release row "Vacancies" | 702, −36 |
| Annual 2022 U/V | AVG of the 12 monthly values | 1.058 |
| Regional table, London | *Which regions have the highest unemployment?* London row | 6.8, +0.7 |

## Gaps (layer work for step 4)

1. **A null-safe year-on-year change.** The engine compiles `{m1} - {m2}` as
   `COALESCE(m1,0) - COALESCE(m2,0)`: in 2015, where `Value Prev Year` is null, *Change on Year*
   returns the value itself (MGSX Dec–Feb 2015: value 5.5, "change" +5.5). Every KPI change on
   history needs a guarded measure.
2. Change measures per headline (Δ year for unemployment rate, U/V, vacancies, pay growth) so a
   KPI comparison is one stored measure with a signed format.
3. A labour-market **tightness** measure set: vacancies per 100 unemployed is just the inverse of
   JPC5; keep JPC5 (ONS's own series) as the hero.
4. **Windows**: a 12-month moving average of U/V on a stored question (advanced calculation).
5. **Share / rank**: each sector's share of the 7-sector vacancy total, rank of regions.
6. **Implied inflation** (nominal minus real pay growth) as a layer measure, for the pay-award
   what-if baseline.
7. A stored question behind every card (KPIs, sparklines excepted).

## Caveats

1. Generic change measures COALESCE nulls to 0 (gap 1). The *Latest* figures are unaffected
   (all have a prior year).
2. Headline measures are AVG over the months in context: with a Year selected they read as the
   year's average, not the year's last reading. Label it so.
3. Sector vacancies cover 7 of ~18 SIC sections (426k of 702k).
4. Regional rates are unweighted when averaged across several regions.
5. Geography and Sex only have meaning for a subset of series; they are not app-wide filters.
6. Data is a fixed release (15 Sep 2026), not live.
