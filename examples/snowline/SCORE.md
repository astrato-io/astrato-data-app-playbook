# Snowline: independent judge score

Judge run 2026-11-18. Layer `00000000-0000-0000-0000-000000000000` ("Ski Resort Operations"), published rev 10. It has 32 stored questions, one fact (Resort Weeks) and two many-to-one joins (Resorts, Season Weeks).

Evidence (screenshots, smoke output and logs) is not shipped; paths below that point into it are for the record only.

I ran the app with `astrato dev` (CLI 0.2.0, because the app does not pin a CLI) and did not change any app file.
Evidence:
- `judge/smoke/` holds the kit smoke at 1440, 1280 and 1024. It ran without `--scroll-ok`, because the brief names the archetype "planner".
- `judge/ui/` holds my own runs. They use real CDP mouse input, read the query log and take screenshots.
- I ran every MCP query myself with `astrato_data_execute_query`.
- Publishing is out of scope, so F4 is excluded and the maximum is 52.

| # | Score | Evidence |
| --- | --- | --- |
| A1 ★ | 2 | **Unfiltered, the layer and the screen agree.** Snow 8,818 cm, +4.4% (0.04355). Crowd 60.4, +0.03 (shown as ±0.0). Quiet powder weeks 24, +2.<br>**With Country = Italy (my MCP query), they agree again.** MCP: 2,550 cm, +4.6%, crowd 58.3 (+0.09), 12 quiet powder weeks. The headline after Apply read "+4.6% … 58.3, +0.1 … 12", and the snow KPI moved 8,818 → 2,550.<br>**Each KPI agrees with its breakdown.** The resort table's Quiet pw column sums to 24. The market table sums to 46, which is 24 this season plus 22 last season, and its shares match (10/46 = 21.7%). The resort table's figures match an MCP query by resort (Silbergrat 67.2 / 59.9 / 4). |
| A2 ★ | 2 | Every chart, KPI and table is a runtime-mounted native object. The only app SVG is the brand mark. The headline, the levers and the plan form are HTML text and controls, not data visuals. |
| A3 | 2 | The app has 36 data objects. Every card or KPI maps to one of the 32 stored questions by its exact name; KPI cards carry the question in their tooltip, with a short label on screen. I found 0 objects without a stored question. Caveat: tiles re-express each question's definition rather than run it by id, because runQuestion is unavailable in local dev; I spot-checked that the definitions match (best resorts rank, top 10). |
| A4 | 2 | Bands, levels, week type, every this/last/change measure, headroom, uplift and the budget split are all layer items. The app does no arithmetic on aggregates; the headline only formats governed values. The layer's last stored check is "Healthy", 0 errors and 0 warnings, but it is marked not current for rev 10. I did not re-run it, because the check can create a draft. |
| A5 | 2 | One fact table with two dimension tables. In the smoke, Country = Italy or Austria changed every tab, and in my run a resort click carried through to the market tab. |
| A6 | 2 | Both seasons hold 180 resort-weeks (MCP). The comparison is 2025/26 against 2024/25, both full seasons. Base depth is averaged, not summed. |
| B1 ★ | 1 | **Charts and tables:** a click applies at once and filters every tab, and Clear all restores everything (smoke checks and my real clicks).<br>**The four filter dropdowns:** picking Italy with a real mouse only creates a *pending* chip with Cancel/Apply. KPIs and charts stay unchanged until the reader clicks Apply; after 3 s they still showed 8,818 cm and 60.4 (`judge/ui/market-italy.png`). After Apply, everything updates correctly.<br>The app's own selection checks call `selectValues(..., {state:'applied'})` directly, so they never meet this extra step. |
| B2 | 2 | Sticky bar with chips, an × per chip (removing the Country chip restored the KPIs), Clear all, and the "No active filters" hint. The four filter controls appear on every tab. Chip labels show raw field names; that is counted under D3. |
| B3 | 2 | I clicked with real mouse input, as a reader would. 11 of 12 objects cross-filter: 4 tables, the stage combo, both heat maps, the week-type bars, the airport bars, both split charts and the KPI sparkline bars. The smoke covered 5 more chart types. The only exception is the moving-average line chart, and its card says so. |
| B4 | 2 | All tabs are mounted in the background with Loading… overlays. Screenshots taken 150 ms after each tab switch show complete content (`judge/ui/tab-instant-*.png`). |
| C1 | 2 | All 7 KPI cards (5 on Season review, Holiday uplift, Target weeks) have a change against 2024/25 and a native mini chart. Colour follows direction: Quiet powder +2 and uplift +0.2 are red (fewer is better), Snow +4.4% is green, and Crowd ±0.0 is grey. |
| C2 | 2 | Four kinds: period comparison (this/last/change measures); a window (3-week moving average); rank and share (rank column, Share of Quiet Powder Weeks, top 10); drivers (demand headroom, holiday uplift, snow band × week type). |
| C3 | 2 | The hero sentence ("Snow +4.4% … crowds flat 60.4 ±0.0 … 24 powder weeks went quiet") is verified against MCP and follows the filters. The tabs follow its path: where, why, where to market, plan. |
| C4 | 2 | Resort, rank, profile and quiet-powder tables each have a native by-week sparkline column. Top 10 has no time axis per row, so it carries score and crowd indicator bands instead. Change columns use signed indicators. |
| D1 | 1 | The landing tab has the same skeleton as `league-table-planner` (its landing tab, as judged at the time): navy masthead with an Excel button, dropdowns plus a filter bar, tabs, a headline sentence, a KPI row, then a chart on the left and a table on the right. The README admits it copied the techniques. Bespoke parts: alpine palette, serif hero, the Snow & crowds grid and the plan tab. |
| D2 | 2 | At 1440×860, no tab scrolls (smoke: overflowY 0 on all 5). |
| D3 | 1 | No epoch axes; week dates read as dates. Defects found:<br>(a) The plan resort-split chart labels only every other resort (5 of 10) at 1440 and 1280.<br>(b) At 1440, all three Best-tab tables cut a partial row, and the reader must scroll inside them to see 10 rows.<br>(c) Header ellipses at 1280: "By we…" and "Headroo…".<br>(d) Filter controls truncate their values when a selection is held ("Res… Lac des Ne…"), and chips use raw field names ("Season_Stage", "Resort Name", "Snowfall_Band").<br>That is more than two defects but none of the 0-level kind, so this is a generous 1. |
| D4 | 1 | Light theme. Snow is blue and crowds amber almost everywhere, and card titles are questions. Exception: the plan's "Scenario" series is blue in the resort split and amber (the crowd colour) in the stage split. |
| E1 | 2 | Season review, one selection: 24 new answers against a budget of 28 (17 visible objects + 1 sparkline column + 5 controls/headline). Snow tab: 7 and 13. Best: 12 of 14. Market: 4 of 11. My real-input runs sent 24, 18 and 18 queries per selection on the review tab. |
| E2 | 2 | Query lanes, 429/5xx retry, session cache and idle prefetch. A selection settles in 0.3–2.0 s by the app's log; my runs took 1.6–3.5 s, which includes about 1 s of my own settle wait. Repeating the first selection sent 0 queries. **Not counted here:** the first, cold load took 59 s to landing-ready, and the kit smoke failed its 15 s landing budget. Warm loads took 6.4–7.2 s. |
| F1 ★ | 2 | 0 console errors or warnings and 0 failed requests, through the full smoke (17 checks, all tabs, three widths) and both of my runs. All 40 objects rendered. |
| F2 | 2 | No horizontal page scroll at 1280 or 1024. At 1024 the layout stacks and scrolls vertically, as the README says (the smoke flags this because it ran without `--scroll-ok`). Resize applies width operations without remounting (ResizeObserver, `src/app.js`), confirmed in code but not watched for flashes. The 1280 ellipses are counted under D3. |
| F3 | 2 | I selected Lac des Neiges × 1 Early season × Holiday week. The headline read "No resort-weeks match these filters", objects showed "There is no data to display", and there were no errors. Spring with no holidays empties the uplift KPI cleanly. The resort table showed an empty grid with no message. Only two full seasons exist, so there is no fake comparison. |
| F4 ★ | out of scope | Local build only, as the brief asks. |
| G1 | 2 | 8-sheet workbook: Summary, one sheet per tab, the audit trail and definitions. It is formatted (title fonts) and followed the Austria filter (headline "+4.8% … 6 powder weeks"; Season review 1,648 cm). Nits:<br>- Change values are raw decimals (0.048346).<br>- The definitions sheet says the comparison uses the "Season Axis" and a date range of "1 Dec 2025 – 5 Apr 2026". The measures actually filter Season explicitly, and the badge says the data ends 30 Mar 2026. |
| G2 | 2 | Three levers (budget, powder threshold, quiet threshold) set measure parameters. Target weeks moved 24 → 3 → 24 and the split doubled at €500k (smoke). The scenario sits beside a governed baseline, the "Suggested Budget at Default Rule" measure. |
| G3 | 1 | Maker–checker is enforced (self-approval refused), with roles, an audit trail and a reset, and the screen says it is browser-only. It is not stored in governed views via writeback: the brief forbade creating tables, which is not the rubric's "viewers cannot write" condition. |

**Total: 47 / 52** (F4 out of scope).
**Gates:** A1 2, A2 2, B1 1, F1 2. No gate is at 0.
**Admit: yes.**

## Top 3 fixes

1. **B1: filter dropdowns should apply at once.** Auto-apply pending selections on the `main` group (the code already does this for the tab groups), or drop Cancel/Apply. Then make the selection checks pick a value through the dropdown, not the API.
2. **D3/D4: legibility and colour.**
   - Show all 10 resort labels on the plan split chart.
   - Fit 10 rows in the three Best-tab tables, or drop row height.
   - Widen "By week" and "Headroom" at 1280.
   - Give the filter-bar chips display names.
   - Colour Scenario the same in both split charts.
3. **Performance and story bugs.**
   - Cold first load took 59 s against a 15 s landing budget; prioritise the landing tab's queries, or warm the warehouse.
   - Correct the Excel definitions sheet (comparison method and date range).
   - Format change values as percentages in the export.

## Where the app's own checks claim more than I could confirm

- **Selection checks bypass the filter controls.** They set applied selections through the API, but a reader's dropdown pick stays pending until Apply.
- **Run instructions.** The README runs 1024 with `--scroll-ok`, but the brief names a planner archetype. Without that flag the kit smoke fails at 1024 on vertical scroll, and it also fails the landing budget on a cold start.
- **"Real click" checks** fire synthetic DOM events. My CDP mouse input confirmed they work.
- **"Every … object on one of the layer's 32 stored business questions"**:
  - Objects re-express the stored definitions rather than run them.
  - Three stored questions are unused.
  - Six questions carry no category.
