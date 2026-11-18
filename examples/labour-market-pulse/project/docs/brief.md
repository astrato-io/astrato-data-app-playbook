# Brief — Labour Market Pulse

Semantic layer:  `00000000-0000-0000-0000-000000000000` (UK Labour Market, ONS LMS)   Archetype: **story** (a monthly briefing read top to bottom, one screen per chapter)
Persona:         Chief economist of a UK recruitment firm. Once a month, the day after the ONS
                 labour market release, prepares the "market call" that account directors take
                 to clients; laptop at 1440 wide, sometimes 1280. Analyst altitude: wants the
                 headline, then the evidence, then the cuts (pay, sectors, regions).
Decision:        **Is the UK labour market tightening or loosening this month, and what do we
                 tell clients to do about hiring plans and pay awards?** (Their words, from the
                 request.) The call is recorded as Tightening / Stable / Loosening with advice.
Hero number:     **2.5 unemployed people per vacancy** (Apr–Jun 2026), **+0.2 on a year**, up from
                 1.06 in 2022 and 1.6 before the pandemic: the loosest market since 2015 outside
                 the 2020 lockdowns. Verified in step 1.
Story path:      Hero (looser: 2.5 per vacancy) → *Where is demand falling?* (vacancies −36k on
                 the year; health & social work −9k, hospitality −8k) → *What does it do to pay?*
                 (regular pay growth 3.5%, −1.3 pp; private sector 2.9%, real pay only +0.6%) →
                 *Which regions?* (Scotland +1.8 pp, London 6.8%) → *Our call* (record and approve).

## Tabs

| Tab | Question it answers | Key cards (each a question) | Selection group |
| --- | --- | --- | --- |
| Market | Is the UK labour market tightening or loosening? | 4 KPIs: unemployed per vacancy, unemployment rate, vacancies, regular pay growth (each Δ year + monthly mini line). *How far has the market loosened since the 2022 peak?* (U/V, 12-month moving average, pre-pandemic reference). *Are vacancies falling as unemployment rises?* *Where does the UK labour market stand in the latest release?* (37-indicator table, sparkline column) | `g-market` |
| Demand | Where is hiring demand falling? | KPIs: vacancies, redundancies. *Which sectors cut vacancies most over the year?* (signed bars = drivers of the −36k). *What share of sector vacancies does each sector hold?* *How have sector vacancies moved since 2019?* *How are vacancies changing in each sector?* (table + sparkline) | `g-demand` |
| Pay | What does a looser market mean for pay? | KPIs: regular pay growth, real pay growth, private sector pay growth. *Are real wages still growing?* *Is public sector pay outpacing the private sector?* Pay-award what-if. *Which pay measures are moving most?* (table + sparkline) | `g-pay` |
| Regions | Which regions are loosening fastest? | KPIs: unemployment rate and employment rate across the selected regions. *Which regions have seen unemployment rise most over the year?* (ranked). *How has unemployment changed in each region over time?* (heat map). *How is each region's labour market doing?* (table + sparkline) | `g-regions` |
| Our call | What is our market call this month? | Draft → submit → approve/return workflow with audit trail. No data objects. | — |

Filters on every data tab: **Year**. Chart clicks select **Period** (month), **Indicator** (sector)
or **Geography** (region). The Regions tab adds a **Geography** filter.

**How "latest" works with selections.** Every snapshot card (KPIs, latest-release tables, sector
and regional bars) reads the latest release (`Period Status = Latest`) while no Year or Period is
selected. Selecting a Year or a month switches them to *the average of the readings in the
selection* and the card subtitle says so. This is how a KPI follows a selection without showing
an empty "latest" intersected with 2022.

**What Geography does.** UK headline series exist only for the United Kingdom; regional figures
exist only for two indicators. A Geography selection therefore applies to the Regions tab only,
and the other tabs say "UK series: region selections apply on Regions".

## Analytical depth

| Kind | Where in the app | Needs in the layer |
| --- | --- | --- |
| Period comparison | Every KPI: change on a year earlier (null-safe); vs pre-pandemic in the latest-release table | Added: 6 guarded "… Change on Year" measures, `Change on a Year Earlier`, `Regional Unemployment Change on a Year Earlier`, `Regional Employment Change on a Year Earlier` |
| Window | 12-month moving average of U/V on the hero chart | Advanced calculation on the stored question |
| Rank / share / top N | Rank of regions by unemployment rise; sector share of vacancies | Added `Share of Sector Vacancies` (scope total); rank on the question |
| Drivers | Sector contributions to the change in vacancies (signed, sorted) | `Change on a Year Earlier` by Indicator |
| Reference | Pre-pandemic level (Feb 2020) on the hero trend | Existing `Change vs Pre-Pandemic` / `Value Pre Pandemic` |
| Parameters | Pay-award what-if | Added `Real Value of Pay Award`, `Pay Award vs Private Sector Pay Growth` (parameter `Pay Award %`), baseline `Implied CPIH Inflation` |

Not supported by the data: a full industry breakdown of vacancies (7 of ~18 sectors), regional
pay or vacancies, forecasts, and any target (the firm sets none in the layer).

## Levers (what-if)

| Lever | Range | What it moves | How |
| --- | --- | --- | --- |
| Pay award a client is considering (%) | 0–8%, step 0.25 | Real value of the award (vs implied CPIH inflation) and its gap to private-sector pay growth | Layer parameter `Pay Award %` set per object with `setMeasureDefinedParameter`; baseline numbers are governed measures |

## Workflows

| Record | States | Roles | Audit fields | Storage |
| --- | --- | --- | --- | --- |
| Monthly market call (release month, call, hiring advice, pay advice, rationale) | Draft → Submitted → Approved / Returned | Economist (maker: drafts, submits), Head of Research (checker: approves or returns; cannot approve own) | who, role, action, before → after, reason, timestamp | **Simulated in the browser** (localStorage), labelled on screen: the layer must stay additive-only and the test tenant has no writeback table for this. Reset restores the seed. |

## Excel report

Header button. Sheets: Summary (hero, KPIs, the current call), Market, Demand, Pay, Regions
(each from the same stored measures with the on-screen selections), Data (latest-release table),
Definitions (every measure used, with its description from the layer).

## Look

Light. White cards on a warm-grey page; navy header band (`#1F2A44`) with a teal accent
(`#0F766E`). Inter/system sans. Red `#B42318` = worse for the market call, green `#067647` =
better, amber for "looser". Card title = the question. One screen per tab at 1440×860.
Direction of "good": unemployment, U/V and redundancies **down** is good; vacancies, employment
and real pay **up** is good; nominal pay growth up is shown as good for workers.

## References

| Example | Why | Techniques to copy | Not copying |
| --- | --- | --- | --- |
| portfolio-os | Runs on 0.8 public packages; KPI cards with sparkline; xlsx writer; query scheduler; selection bar; per-page groups | `src/fields.js` (field index), `src/dashboard.js` (definition → compile), `src/throttle.js` (scheduler), `src/xlsx.js` (writer), `src/app.js:194-240` (selection bar and static-filter mirror) | Sidebar shell, page set, theme, workbench pages |
| revenue-war-room | Command-centre with one story and reference lines | reference-line approach (`src/app.js`) | War-room layout, HTML KPI text |
| lending-affordability | Maker–checker with acting-as switcher | `src/workflow.js` four-eyes rule shape | Decision board UI, localStorage keys |

## Out of scope / not supported by the data

Live data (this is the 15 Sep 2026 release); regional pay; vacancies for all sectors; a
forecast of the next release.
