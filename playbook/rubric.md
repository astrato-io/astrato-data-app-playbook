# Rubric

Score a finished app against the playbook's standard. Each criterion scores **0** (missing or
broken), **1** (present but partial) or **2** (meets the standard), and each says how to test it
so two evaluators reach the same score. A criterion that could not be tested is recorded as
**not tested**, counts 0 towards the total, and is listed separately from criteria that were
tested and failed; an app with an untested gate criterion is not ready to show. One exception:
when the brief puts publishing **out of scope** (a local build only), score F4 as *out of scope*,
leave it out of both the total and the maximum, and report the result out of 52. Test the running app at 1440×860 in a browser that paints (a visible window, or the kit's headless smoke test),
with the semantic layer open over MCP.

**Total:** 27 criteria, 54 points. **Standard met:** at least 45, and no 0 on a gate criterion
(marked ★). With F4 out of scope: at least 44 of 52 (45 × 52 / 54 = 43.3, so 43 falls short), and
no 0 on the remaining gates. A ★ at 0 means the app is not ready to show, whatever the total.

## A. Data and governance

| # | Criterion | 2 | 1 | 0 | How to test |
| --- | --- | --- | --- | --- | --- |
| A1 ★ | Figures are right | Every reconciliation pair agrees with an independent MCP query, unfiltered and with a selection | Agree unfiltered only, or one pair off by formatting | Any KPI disagrees with its own breakdown or the layer | Pick 3 KPIs; compare with `astrato_data_execute_query`; repeat with one selection |
| A2 ★ | Native objects only | Every data visual and table is a native Astrato object | One HTML visual, justified on screen or in the README | HTML tables or hand-drawn charts carry data | Inspect the DOM of each card: data must sit in an Astrato object, not `<table>`/`<svg>` built by the app |
| A3 | A stored question behind every object | Every chart, KPI and table maps to a stored question named as the card's question (a sparkline is its own object; a table's mini-chart column and short text figures from stored measures do not count against this) | Most do; some use ad-hoc queries | Few or none | `astrato_semantic_layer_list_questions`; match names to card titles; count unmatched objects |
| A4 | Modelling lives in the layer | Bands, flags, labels and comparison measures are layer items; no presentation columns added to the warehouse; source-schema drift 0 | Minor exceptions | Calculations in the app that the layer could do, or type drift | Read the app's query code for arithmetic on aggregates; check source-schema drift (`astrato_semantic_layer_check_source_schema` can create a draft revision when it finds drift: on a layer you may not change, read its last stored result, or ask the owner to run it) |
| A5 | Joined model | One shared filter reaches every fact the app shows | Reaches most facts | Facts are islands | Select a shared-dimension value; every fact-based object changes |
| A6 | Time handled honestly | Comparisons end at the latest complete period; snapshot measures not summed across periods | One lapse | Partial period compared with a full one | Compare the KPI period with the data's max date; check one snapshot KPI against a single-period query |

**A3 with a report builder.** A report the user composes is ad hoc by design. Score A3 on the
fixed objects around it (overview, KPIs, starter reports), which must each be a stored question.
The composed report does not count against A3 when it offers only governed measures and stored
dimensions (no raw columns) and its starters are stored questions; if it offers raw columns, count
it as an unmatched object.

**A2 and the CLI template's KPI cards.** The dashboard template's `KpiCard` writes the value and
change as HTML text, so a template app does not score 2 on A2 until each KPI value is a native
`number` with a comparison measure ([how](../patterns/kpi-sparkline-comparison.md#in-a-template-app)).
A headline sentence from stored measures stays allowed, as in A3.

**A4 and text figures.** A figure inside an object must come from the layer. A share or ratio of
two governed values written in a sentence ("62% of the gap") is acceptable only when the layer
cannot express it at that grain; record it as a caveat in the README or score evidence. Without
the caveat, or when the layer could carry it, it counts as app arithmetic.

## B. Interactivity

| # | Criterion | 2 | 1 | 0 | How to test |
| --- | --- | --- | --- | --- | --- |
| B1 ★ | Selections reach everything | On every tab, a filter and a chart click change a KPI, a chart and a table; clearing restores them | Works on some tabs or misses KPIs | Clicks or filters do nothing | The selection test in [step 5](5-verify.md#2-selections), on each tab |
| B2 | Selection bar | Sticky bar with chips, × per chip, "Clear all", empty hint; filters on every page | Bar present, missing parts or pages | No bar | Select two values on two fields; remove one chip; clear all |
| B3 | Every chart clickable | Every chart type cross-filters, or opens a drawer for record-level clicks; any exception is labelled | One silent exception | Several charts ignore clicks | Click every chart, table, heat map and Sankey once |
| B4 | Tabs are instant | Every tab preloaded with loading overlays; switching shows content at once | Some tabs load on click | Tabs sit empty on first open | Load the app, wait for settle, switch to each tab and screenshot immediately |

## C. Analytical depth

| # | Criterion | 2 | 1 | 0 | How to test |
| --- | --- | --- | --- | --- | --- |
| C1 | Rich KPIs | Every KPI card has a period comparison coloured by good/bad direction and a native mini chart | Some cards bare, or colour ignores direction | Bare numbers | Inspect each KPI card; check a cost-type KPI turns green when it falls |
| C2 | Advanced analytics | At least four kinds: period comparison, window (moving average / rolling / running total), rank or share or top N, drivers or bridge | Two or three kinds | Only trend and breakdown | List the advanced calculations on stored questions and measures |
| C3 | Story and hero number | The first screen states one verified finding with its comparison; later tabs follow its path | A story exists but is buried or unverified | A metric dump | Read the landing tab cold: can you say the finding in one sentence within 10 seconds? |
| C4 | Tables are rich | Every table whose view has a time axis has a trend sparkline column; tables without one show change as indicator columns; bars or indicators where they help | Some tables | Plain number grids | Inspect each table and its view |

## D. Design

| # | Criterion | 2 | 1 | 0 | How to test |
| --- | --- | --- | --- | --- | --- |
| D1 | Bespoke structure | Page structure follows this app's story; not recognisably another example app reskinned | Generic layout with some bespoke parts | An example's skeleton or shared template with new colours | Compare the landing tab with the nearest example's screenshots |
| D2 | One screen per tab | No vertical page scroll at 1440×860 where the archetype requires it (command-centre, monitor, planner; workbenches, stories and reports may scroll, and score 2 when they read in order) | One tab scrolls | Most tabs scroll | Screenshot each tab; check `document.scrollingElement.scrollHeight <= innerHeight` |
| D3 | Legible | No ellipses or clipping; dates read as dates; legends complete; labels readable on their ground | One or two defects | Epoch-number axes, clipped titles, or unreadable labels | Read every screenshot; zoom on axes, legends, table headers and chips |
| D4 | Visual system | Light by default (or a confirmed alternative); colour carries meaning consistently; semantic colours only on state; card titles are questions | Minor inconsistencies | Arbitrary colours or dark without reason | Check one entity's colour across cards; read card titles |

## E. Performance

| # | Criterion | 2 | 1 | 0 | How to test |
| --- | --- | --- | --- | --- | --- |
| E1 | Visible-only queries | Queries per selection within budget: 1.2 × (visible objects + table sparkline columns) + filter controls + app text queries | Up to twice the visible objects | Every object in the app re-queries | Make one selection and count uncached queries, as in [step 5 §3](5-verify.md#3-queries-per-click); state objects, sparkline columns and controls/app queries separately |
| E2 | Responsive under load | Scheduler with lanes, 429 retry and cache; a selection settles in ≤ 3 s; repeated selections are near instant | Settles in ≤ 6 s or no cache | Bursts produce 429 errors or > 6 s | Time three selections, then repeat the first |

## F. Robustness

| # | Criterion | 2 | 1 | 0 | How to test |
| --- | --- | --- | --- | --- | --- |
| F1 ★ | Clean run | No console errors, no failed requests, every object rendered, on every tab | Known benign messages, documented | Errors or unrendered objects | Console and network panel through load, tab switches and one selection |
| F2 | Resize and narrow widths | At 1280 and 1024: no horizontal page scroll, no overlap; charts resize without remounting | Minor overlap | Charts vanish or remount on resize, or the page breaks | Drag the window narrower; watch for flashes; screenshot |
| F3 | Empty and edge states | An empty selection shows clear empty states; the earliest period has no fake comparison | Some objects error | Errors or misleading values | Select a combination with no rows; select the first period |
| F4 ★ | Live copy works for its audience | Released through the gate; the live app passes the smoke as a non-owner; it is pinned to the current layer revision | Live smoke passed as owner only | Not published, or fails live | Open the live link in a fresh profile as a viewer; run the smoke |

## G. Deliverables

| # | Criterion | 2 | 1 | 0 | How to test |
| --- | --- | --- | --- | --- | --- |
| G1 | Excel report | Formatted multi-sheet workbook (summary, one sheet per tab, data, definitions) following on-screen filters | Single sheet or unformatted, or ignores filters | None | Apply a selection on one tab, export, open the file, compare figures on every tab's sheet with the screen (the smoke test's export probe) |
| G2 | What-if | Inputs on the brief's real levers change numbers through the layer, with baseline vs scenario | Inputs exist but change only app-side numbers with no governed baseline | None, though the brief has levers | Move each input; check the baseline is a governed query |
| G3 | Workflow | Records and audit trail in governed views via writeback (or a labelled fallback where viewers cannot write); maker–checker enforced; reset available | Workflow without audit trail or role rules | None, though the brief has actions | Run one item through each state as each role; try self-approval; read the audit trail; reset |

Score G2 and G3 as 2 when the brief documents that the persona has no levers or no actions;
an evaluator should then check that claim is plausible.

## Reporting a score

```markdown
| # | Score | Evidence |
| A1 | 2 | 3 KPIs = MCP, also with Region = West |
...
Total: 46/54. Gates: all ≥ 1. Next: C2 (add a rolling 12-month), D3 (legend paginates on Mix).
```

Fix the lowest-scoring criteria first, then re-run [step 5](5-verify.md) and re-score.
