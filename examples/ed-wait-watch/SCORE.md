# ED Wait Watch — independent score (judge 2)

Evidence (screenshots, smoke output and logs) is not shipped; paths below that point into it are for the record only.

Judged 2026-11-18 against `playbook/rubric.md`. F4 (publishing) is **out of scope** (local build only), so the
total is out of **52**; the bar is 44 with no gate at 0. I did not read the build notes or
`docs/verification.md`.

**How it was tested**

- The layer over the Astrato MCP server: revision 36, published, 37 stored questions in category
  "ED Wait Watch", `lastCheck: null`.
- One dev server: `npx @astrato-io/cli@0.2.0 --host https://<your-astrato-host> dev . --no-open`. It is now stopped.
- Kit smoke at 1440, 1280 and 1024, with a profile in the temp directory. Result: **PASS**, 63 objects rendered,
  landing-ready 3.5 s, all settled 10.5 s, all 15 app checks pass, no console errors, no failed requests, no
  page overflow. Evidence is in `judge2/smoke/`.
- My own headless Chrome over CDP at 1440×860. I used real `Input.dispatchMouseEvent` clicks on charts, table
  rows, tabs, chips and Clear all, and real dropdown picks (Dept → Orthopedics, Month → 2019-04, Month search →
  2020-10). Screenshots are `judge2/ui-*.png`. I did not write to the warehouse and did not use Live mode.

## Scores

| # | Score | Evidence |
| --- | --- | --- |
| A1 ★ | 1 | **Unfiltered**, all 4 KPIs match MCP: Oct 1–30 is 44.4% / 34.1 min / 5.3 / 471 visits, against Sep 40.3% / 35.1 / 4.9 / 466 (MCP: .4437 / 34.05 / 5.31 / 471 and .4034 / 35.06 / 4.91 / 466). **Dept = Orthopedics** (dropdown) also matches: 44.4% (−19.4 pts from 63.8%), 33.0 vs 31.3, 5.4 vs 3.9, 54 vs 47. Month = Jun 2020 matches too (38.8%, 485). **Dept = Renal disagrees** (also with Month = 2020-10): the cards say "fewer than 2 (1–30 Sep)", "better than 40.0 (1–30 Sep)", "better than 0.0%". MCP gives 6 Renal visits in 1–30 Sep. The Review Month axis ends at MAX(ER_DAY) *of the filtered rows* (Renal's last Oct visit is 9 Oct), so the app really compares 1–9 Oct with 1–9 Sep while every label says 1–30. Day = Wed + 06-09h has the same problem: the label says 1–30 Sep, the app computes 1–28 Sep and shows 3 visits / 33.3%; MCP for 1–30 Sep gives 4 / 25.0%. |
| A2 ★ | 2 | Every chart, KPI and table is a native object (slots hold Astrato instances; no app `<table>` or `<svg>`). The headline sentence is text built from stored measures. The practice-mode flag list and audit trail are HTML lists, but they belong to the labelled "nothing saved" fallback; the governed flag tables are native. |
| A3 | 2 | Every tile's `q` matches one of the 37 stored questions by name (KPIs, sparks, heat map, trend, bridge, 4 tables, what-if numbers, flag objects). No unmatched objects. |
| A4 | 1 | Bands, labels, the Review Month family, the points change and the over-target share are layer items. Two exceptions: the headline's "worst slot" is chosen in the app (sort plus a ≥30-visit threshold over a query), which the layer could do as a stored top-N with a result filter; and weekday ordering relies on zero-width-space prefixes in `Arrival Day` labels (a layer hack). Source-schema drift was **not tested**: no stored check result, and I did not run the check because it can create a draft revision. |
| A5 | 1 | Every visit filter reaches every visit object on all four visit tabs. The flag facts are islands: 0 joins, the README says visit filters do not narrow flags, and the Flags tab has only its own Status/Owner filters. |
| A6 | 1 | The default comparison is honest: 1–30 Oct against 1–30 Sep, with the missing 31 Oct stated, and Jun is compared with 1–30 May. The lapse: under a selection whose last visit falls before the 30th (Renal, a weekday), the comparison window silently shrinks (1–9, 1–28) while the captions, headline and "as of" line still say 1–30. |
| B1 ★ | 2 | Real clicks. **Board**: heat-map cell Wed 06-09h, trend bar Jun 2020, bridge row Neurology and Dept dropdown each moved the KPIs, heat map, trend and bridge; Clear all restored the exact landing figures. **When**: hour bar 23, weekday bar Wed and band row 03-06h; the what-if baseline, charts and table follow. **Who**: dept bar, dept table row, age, race and gender each moved both KPIs and the charts and table. **Sat**: wait band, trend bar, within/over bar and table row each moved both KPIs. **Flags**: the tables are empty, so nothing visible can move; the smoke shows that Status = Open reaches 16 flag queries. |
| B2 | 2 | Sticky (`position: sticky; top: 0`) bar with chips, × per chip, Clear all and an empty-state hint; filter strip on every tab. Two chips (Dept Neurology + Month Jun 2020); removing the first chip with × left Month only and the figures returned to the Jun-only values; Clear all emptied it. Chips persist across tabs. Chips that do not apply on the current tab are greyed with a reason. |
| B3 | 2 | 15 charts and tables clicked; all cross-filter. The combo lines say "click the bar" (a labelled exception). The flag chart and tables are empty and could not be clicked. Observation, not scored: in a 1440×760 viewport, one click on the Wed 06-09h cell near the Wed/Thu edge selected **Day = Wed, Thu**. At 860 high, the centre click selected Wed only. |
| B4 | 2 | After all-settled, clicking each tab and screenshotting 250 ms later shows When, Who, Sat and Flags fully drawn (`ui-30…33`). Every pane is preloaded off-screen. |
| C1 | 2 | All 4 board KPI cards and the Who/Sat cards have the stored change, colour by direction and a native mini line. Average wait falling is shown green; Visits is neutral grey. The flag counts are snapshots (no comparison, stated). Copy nits: "■ unchanged than 50.0%", and "+0.0 ▼ worse" / "−0.0 ▼ worse" from rounding. |
| C2 | 2 | Period comparison (Review Month This/Last/Change), a 3-month moving average on the trend, rank and share-of-over columns, and a department drivers bridge whose changes add to the total. |
| C3 | 2 | The landing headline reads cold in one sentence with its comparison: 44% seen in time, up 4.0 pts on Sep, 56% waited longer, worst slot Wed 06-09h. The tabs follow board → when → who → satisfaction → flags. |
| C4 | 2 | Every time-able table (bridge, bands, departments, satisfaction by department) has a native trend column, plus rank, share and Δ indicator columns. The flag tables have no time axis. |
| D1 | 2 | The board is bespoke: hero line, KPI column with flag counts, a centred heat map, then trend plus bridge. It is not a reskin of an example's skeleton. Who and Sat share a KPI-column grid, which suits them. |
| D2 | 2 | At 1440×860 the smoke shows `overflowY: 0` on all 5 tabs. The Flags left panel scrolls inside its card (acceptable). |
| D3 | 1 | At 1440, dates read as dates and legends are complete. Defects: "+100.0 pts" clips under the mini line (Renal); the Flags "Acting as" select overflows its card edge and its label wraps to "Acting / as"; the empty "By status" mini chart shows tiny grey library text; the Mar caption lacks a year ("No comparison for 1–30 Mar"). |
| D4 | 2 | Light. Teal = within target, coral = over target and the heat map's bad end, plum = satisfaction, used the same way on every tab. Green/red only on the comparison state. Card titles are questions. |
| E1 | 2 | Uncached queries per real selection: Board 17–23 against a budget of about 28 (16 objects incl. 1 sparkline column × 1.2 + 4 filters + 5 app-text reads). When 16–17 against about 17. Who 15–20 against about 21. Sat 11–18 against about 20. Flag objects and mini lines with excluded fields do not re-query. A repeated selection used 0 uncached queries. |
| E2 | 1 | 4 lanes, 429/5xx retry and a session cache are present. The last query landed 1.9–4.8 s after a click: **Board 3.8–4.8 s**, the other tabs 1.9–4.1 s. A repeat selection was answered in about 0.5 s. That is over 3 s on the landing tab. |
| F1 ★ | 2 | Smoke: 0 console errors, 0 failed requests, 63 objects rendered, through load, every tab at 3 widths and 15 selection checks. My CDP session showed no unrendered objects after about 40 selections. |
| F2 | 1 | No horizontal scroll at 1280 or 1024, and a live resize from 1440 to 1024 showed no Loading overlays or remount. Minor overlap and clipping at 1024: table cells end in ellipses ("General Pra…", "Gastroenter…"), headers wrap mid-word ("Visi ts", "Satis f.", "Departme nt"), the flag-mini text is cut, the Flags table drops its Overdue column, and the Acting-as select overflows. |
| F3 | 2 | Empty selection (smoke: Renal + 2020-10 + Wed) shows "No visits" in the headline and captions. Earliest month 2019-04 (real dropdown pick) shows "No comparison for 1–30 Mar" on every card and "no month before" in the headline. The window-label problem is scored under A1 and A6. |
| G1 | 2 | 7 sheets (Summary, When, Who, Satisfaction, Flags, Data, Definitions), formatted (bold, fills, number formats) and following the selection. With Dept = Neurology the Summary shows 26.7% / 38.0 / 5.0 / 15, the same as the screen after my real click on the Neurology row. |
| G2 | 2 | The Target Minutes slider (15–45) sets the layer parameter on two native numbers against a governed 30-minute baseline, following the selections. The smoke shows 45 min → 70.2% and 2,750 over, with the baseline unchanged and Reset restoring it. |
| G3 | 2 | Maker–checker rules (four eyes, lead-only sign-off, note required) and a full audit trail. The default practice mode is labelled "nothing saved" and has a Reset. Live writeback exists to two governed views. I did not exercise Live mode (no writes). The smoke drove practice mode through button `.click()`, not a real mouse. |

**Total: 45 / 52.** Gates: A1 = 1, A2 = 2, B1 = 2, F1 = 2; none at 0. **Admit: yes** (bar 44).
Not tested: the source-schema drift part of A4, and Live writeback in G3.

## Top 3 fixes

1. **Name the real comparison window, or pin it.** The Review Month axis ends at the latest day *in the
   filtered rows*, but `readPeriod()` writes "1–30 Oct / 1–30 Sep" from the unfiltered last day. Either read
   the max Arrival Date for the current selection and label the cards from it, or anchor the axis end to the
   data's global latest day so a selection cannot shorten it. This fixes A1 and A6: Renal shows "fewer than 2
   (1–30 Sep)" when Sep had 6, and Wed 06-09h shows 3 visits / 33.3% when it had 4 / 25.0%.
2. **Legibility at 1440 and 1024.** Widen or abbreviate table columns so nothing ends in an ellipsis and no
   header wraps mid-word. Keep the Acting-as select inside its card. Stop "+100.0 pts" clipping. Replace the
   library's empty text in the flag mini chart with a short empty state. Fix "unchanged than" and the
   "±0.0 ▼ worse" rounding.
3. **Selection latency on the board (3.8–4.8 s).** The five app-text reads run on every selection on every tab.
   Defer them when the board is hidden and fold the worst-slot read into a stored top-N question, which also
   clears A4. Then run a source-schema check and record its result.

## Where the app's own checks overclaim

- The selection checks are named as clicks ("heat-map click", "click a department", "from the Month dropdown"),
  but they inject `selections.selectValues(..., {state:'pending'})` from code; no pointer event is involved.
  Real clicks do work at 1440×860. One real click near a row edge selected two days, which a programmatic
  pick can never show.
- No check covers a selection whose latest visit is before the 30th. The check "text figures follow the
  numbers" passes while the captions state the wrong window for Renal or any weekday. The Renal edge check
  only asserts "No visits" for Renal + Oct + **Wed**. Renal + Oct alone shows a 1–9 Oct against 1–9 Sep
  comparison labelled 1–30.
- The ms figures in check details (6.7–9.2 s) include about 4.35 s of quiet/paint padding, so they say little
  about real settle time (my measure: 1.9–4.8 s).
- The flags check passes with "changed none": the flag tables are empty, so flag interactivity is asserted
  only as "filter reached the queries".
- The Excel check asserts only the sheet count and the selection text, not figures. I compared the figures
  myself and they match.
- The workflow check runs in practice mode through DOM `.click()`. Live writeback, the README's main workflow
  claim, is never exercised by any check.
