# Hotel demand × weather: independent score (judge 2)

Evidence (screenshots, smoke output and the Excel file) is not shipped; paths below that point into it are for the record only.

Date: 2026-11-18. Rubric: `playbook/rubric.md`, F4 out of scope (max 52, bar 44).
Layer `00000000-0000-0000-0000-000000000000`, published rev 16, read over the Astrato MCP server.
App run with `npx @astrato-io/cli@0.2.0 --host https://<your-astrato-host> dev . --no-open` (one server, stopped
at the end). Kit smoke: `judge2/smoke/` (profile in the session temp dir). Real mouse input: my own
headless Chrome over CDP (`Input.dispatchMouseEvent`), screenshots in `judge2/*.png`. Nothing written
to the warehouse; the offer workflow buttons (localStorage writes) were not clicked by me.
Earlier judge output, `shots/SCORE.md` and `docs/verification.md` were not read.

## Evidence summary

- **Smoke (1440/1280/1024):** 23 objects rendered, landing 3.1 s, 0 console errors, 0 failed requests,
  no horizontal or vertical page scroll on any tab at any width. **FAIL** on 1 of 12 app checks:
  check 7 ("repeat answered from the caches"): repeat sent 1 governed query.
- **MCP, unfiltered:** Occupancy L3M 0.808797 (80.9%), vs LY +1.7056 pts, Room Revenue L3M $49,941,763
  ($49.94m), YoY +5.24%. Screen: 80.9%, +1.7 pts, $49.94m, +5.2%. ✓
- **MCP, City = Boston:** 85.8%, +2.254 pts, $5,481,755, +7.56%. Screen after a real dropdown pick:
  85.8%, +2.3 pts, $5.48m, +7.6%; table row and Excel (Austin: 6,446,475.55 = MCP) agree. ✓
- **Queries per selection (Boston, dropdown):** 10 governed sent for 7 governed objects + 1 sparkline
  column + 1 filter + 1 app text query → budget ⌈1.2×8⌉+2 = 12 ✓. Also 11 DuckDB statements (local, no
  engine cost); all-object budget ⌈1.2×17⌉+1+3 = 25, total 21 ✓. Offer-tab objects sent nothing.
- **Settle time (real clicks, first time):** Boston dropdown 3.6 s, Nashville bar 5.6 s, Denver row 3.8 s.
  Repeat Nashville: 0 sent, 0.86 s.

## Scores

| # | Score | Evidence |
| --- | --- | --- |
| A1 ★ | 2 | 3 KPIs (occupancy, occ. vs LY, room revenue + YoY) = MCP unfiltered and with City = Boston; table and Excel agree. |
| A2 ★ | 2 | Every chart, KPI, sparkline and the table are native Astrato objects (governed runtime or DuckDB-engine runtime); HTML carries only text, chips, levers and the demo workflow list. |
| A3 | 1 | All 15 governed objects map to stored questions with identical card titles (verified in `list_questions`). The 9 API/blended objects (temp, wet-days, wet-vs-dry KPIs + minis, temperature line, wet/dry bars, band chart) have no stored question; blended ones only sit on the extract question's rows. Justified on screen (tags) and in README, but by the rubric's count "most do". |
| A4 | 1 | Layer carries comparisons, share, and the parameterised what-if measures. Exceptions: blended "Occupancy" is `AVG(occupancy)` over city-nights (unweighted ratio average) under the governed name, though the extract could carry Rooms Available/Room Nights to weight it (caveated only in the Excel Notes sheet); verdict % is app arithmetic (documented). Last source-schema check 2026-11-02 "Healthy" but `current:false` (stale vs rev 16); not re-run (it can create a draft). |
| A5 | 2 | City (filter, bar, row, blended bar) moved governed KPIs, charts, table, API and blended objects and the offer tab. The weather bands do not reach governed facts, by design and documented. |
| A6 | 2 | L3M = Aug–Oct 2026 (complete, today 18 Nov) vs Aug–Oct 2025; occupancy is a ratio, never summed; any date selection removes every comparison (KPIs, headline, table columns), seen live. |
| B1 ★ | 2 | Weather & demand: dropdown pick and bar/row clicks change KPIs, charts and table; Clear all restored exact values. Wet-night offer: a bar click (Austin) moved baseline/scenario numbers, bridge and gain chart (tab has no table). |
| B2 | 2 | Two fields (City + Temperature band) → two chips with ×; removing the band chip kept Denver; Clear all emptied; empty hint present; the one bar (with the City filter) serves both tabs. Page never scrolls, so stickiness is moot. |
| B3 | 1 | Clicks work on city bars, table rows, blended wet/dry bars, band bars, offer gain bars. Defects: a real drag along the occupancy chart's date axis (Aug 1 → ~Sep 6) selected **9 scattered nights** (Aug 4, 11, 14 … Sep 1: the tick labels), not the range (`b3-occ-axis-drag.png`); a drag in the plot area or a point click selects nothing. The waterfall ignores clicks without a label. KPI minis and temperature line are labelled read-only. |
| B4 | 2 | Offer tab preloaded off-screen; screenshot 0.3 s after the tab click shows every object (`b4-plan-immediate.png`), though scenario figures first show stale lever values for about a second. |
| C1 | 2 | Five KPI cards, each with a vs-Aug–Oct-2025 comparison and a native mini chart; colour follows direction (wet city-days up = red "worse", down = green "better"); temperature neutral. |
| C2 | 2 | Period comparison (L3M vs LY), share (Room Revenue Share), bridge (wet-night offer waterfall), window (7-night moving average, DuckDB, browser-side), plus a stored rank question not shown. Four kinds on screen. |
| C3 | 2 | Landing headline: "80.9% full (+1.7 pts on last autumn). Rain barely moved demand: wet nights ran 1.3 pts above dry nights", readable in seconds; the offer tab follows it. Caveat: per-selection headlines make claims from tiny samples (Denver: "Rain helped demand here: wet nights ran 12.4 pts above dry" on **1** wet city-day). |
| C4 | 2 | The one table has a "By month" sparkline column and indicator arrows on both change columns. |
| D1 | 2 | Three-source (Governed/API/Blended) structure, tags and blend story are specific to this app. |
| D2 | 2 | scrollHeight = innerHeight = 860 on every tab at 1440, 1280, 1024 (smoke and my session). |
| D3 | 1 | Dates read as dates (ISO, rotated). Defects: the city table shows 5 of 12 rows and scrolls inside its card; the waterfall legend wraps so the blue swatch sits on one line and "net change" on the next; at 1024 the city bar axis drops every other name. |
| D4 | 2 | Light; source colours consistent (blue/amber/purple), dry/wet own pair, green/red only on change; card titles are questions. |
| E1 | 2 | 10 governed queries for budget 12 (21 incl. DuckDB, budget 25); hidden-tab objects silent. |
| E2 | 1 | Scheduler with 6 lanes, 429 retry and session cache; repeats near instant (0 sent, 0.86 s). First selections settled in 3.6–5.6 s with real input (> 3 s); smoke check 7 failed on its own repeat-cache claim. |
| F1 ★ | 2 | 0 console errors/warnings, 0 failed requests, 0 refused queries, 0 late errors, every object rendered through load, tab switches and ~15 selections (smoke + my session). |
| F2 | 2 | No horizontal scroll at 1280/1100/1024; resizing 1440→1024→1280→1100 kept all 110 chart DOM nodes connected (no remount). |
| F3 | 1 | Empty combination (Phoenix + under 15 °C) shows "There is no data to display" in API/blended objects, but: the KPI cards read "No comparison: no rows last autumn" (the reason is no rows at all) with blank values, and the headline still reports "For this selection, the hotels were 72.6% full" while the selection matches zero nights (governed objects ignore the band). First-period comparison correctly removed. No small-sample guard on wet/dry claims. |
| F4 ★ | out of scope | Local build only. |
| G1 | 2 | With City = Austin, the button builds 8 formatted sheets (Summary, Cities, Weather, Blend, Nights, What-if, Offers, Notes); % and $ formats, header fill, frozen panes; Austin revenue 6,446,475.55 = screen = MCP (`judge2/export-austin.xlsx`). |
| G2 | 2 | Real slider drags set layer parameters (`setMeasureDefinedParameter`); uplift 0 + discount 0 → scenario = governed baseline ($6.45m, +$0); baseline is a governed query. |
| G3 | 2 | Labelled browser-only fallback (card says so); maker–checker in `offers.js` (proposer refused, roles enforced), audit trail incl. refusals, Reset; smoke check 10 passed in a sandbox. Not clicked by me (writes localStorage). |

**Total: 46/52.** Gates (A1, A2, B1, F1): all 2; F4 out of scope. **Admit: yes** (≥ 44, no gate at 0).

## Top 3 fixes

1. **B3: date-axis drag.** A drag along the occupancy chart's axis picks only the labelled tick nights
   (9 nights for a 5-week drag). Select the contiguous range (or label the chart as tick-select only),
   and make a drag in the plot area work as the card promises.
2. **A4/F3: blended honesty.** Weight blended occupancy by rooms available (carry Rooms Available and
   Room Nights in the extract), add a minimum wet/dry sample before the headline claims "Rain helped/cost
   demand", fix the empty-state wording ("no nights match", not "no rows last autumn"), and say in the
   headline when the weather selection does not filter governed figures.
3. **E2: first-selection latency.** First real selections settle in 3.6–5.6 s; the first governed query
   starts 0.6–1.7 s after the click. Cut the auto-apply/debounce gap and prefetch likely City values.
   Also D3: give the city table room for all 12 rows or a visible cue that it scrolls.

## Where the app's own checks overclaim

- Checks 2, 4 and 5 write band/date selections programmatically "as the chart writes it" (pending →
  auto-apply). A real mouse drag on the date axis selects scattered tick nights, which no check sees.
- Check 7 claims repeats are answered from the caches; in the smoke run it **failed** (1 governed sent),
  and its 1,069 ms settle figure is far below the 3.6–5.6 s measured with real input.
- Check 8 says the empty combination "says so in the headline"; the headline says only "Too few wet or
  dry nights" and still reports 72.6% occupancy "for this selection" that matches no nights, and the KPIs
  blame "no rows last autumn".
- Check 6 proves DuckDB = a JavaScript re-join of the same rows; it does not show the blended
  "Occupancy" matches the governed (weighted) definition, which it does not.
