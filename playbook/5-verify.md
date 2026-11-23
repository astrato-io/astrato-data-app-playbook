# 5. Verify

Nothing is shown until it has been proven. "Every object rendered" says nothing about whether
the numbers are right, the clicks filter, or the axes read as dates. Run every check below, on
every tab, and keep the evidence in a verification record next to the app.

The [kit](../kit/README.md) has a smoke test and release gate that implement this step. They
apply to apps started from CLI 0.2.0's dashboard template too, which has no checks of its own:
wire `app-state.js` into its `useChart` ([getting started](0-getting-started.md#with-the-template)).
`astrato snapshot` (1440 and 390 screenshots, a render report) is a quick look after a
change, not this step: it has no 1280 or 1024 widths, selection or export checks, or query counts.

## 0. Before the browser: compile check

`node kit/verify/compile-check.mjs <adapter>` compiles every tile and applies its operations
against the installed library, with no session. Run it first and after any library upgrade. It
proves definitions and operations are accepted; it proves nothing about rendering, queries or
figures, so it never replaces the checks below.

## Ground rules

- Use a browser that **paints**: a visible window, or the kit's smoke test, whose headless Chrome
  renders charts. A hidden or background window (including a hidden editor or agent browser pane)
  mounts and queries charts but never paints them, and any code waiting for "ready" waits forever.
  If a check shows mounted-but-blank objects, confirm `document.hidden` is false or switch to the kit.
- Wait for the whole page to settle (every object ready, no queries in flight) before judging.
- If the console reports rate limiting, stop and wait; do not reload in a loop.

## 1. Figures

- **Independent agreement.** For each reconciliation pair in the data brief, run an independent
  query over MCP (`astrato_data_execute_query` or `astrato_semantic_layer_execute_question`) and
  compare with the value on screen. A KPI that disagrees with its own breakdown fails, however
  good it looks.
- Each KPI matches its profiled value, allowing for formatting. `null`, `NaN`, `—` where a value
  should be, or 13-digit numbers are failures.
- Period comparisons end at the latest complete period, with the sign the right way round.
- Repeat two reconciliations with a selection applied.

## 2. Selections

For each tab, for at least one filter and one chart click:

1. Select a value. The chip appears in the selection bar.
2. A **KPI**, a **chart** and a **table** on the tab all change.
3. Switch tab: the selection holds and the other tab's objects follow it.
4. Remove the chip (×), then "Clear all": every value returns to its unfiltered figure.

Click-test every chart type on the page, including tables, heat maps and Sankeys. A chart that
deliberately ignores a filter says so in its subtitle.

## 3. Queries per click

With the scheduler's `window.__qlog` (or `window.__appState.queries`), note its length, make
one selection, wait for quiet and count the engine queries sent since: not cached ones, not
prefetches, and not the check's own reads (`handle.getData()` runs a query, so count before it).
Count the budget the same way every time:

- **Objects:** each mounted object on the active tab: KPI number, its mini chart, chart, table.
- **Sparkline columns:** each table mini-chart column counts as one more object (it queries on its own).
- **Controls and app queries, listed separately:** each filter control (dropdown, filter bar) and
  each query the app sends for its own text (a headline through `runQuestion` or `engine.getData`).

Budget = 1.2 × (objects + sparkline columns), rounded up, + controls + app queries. Report all
four numbers with the count, for example "12 queries for 4 objects + 1 sparkline column + 5
controls/app queries, budget 11". Many more than the budget means hidden tabs are in the same group;
see [preload tabs](../patterns/preload-tabs.md). Record the count and the time to settle.

**When the warehouse is the bottleneck.** If step 1 found that single queries take several
seconds (the layer's own measures included), a selection cannot settle in 3 s whatever the app
does. Run the smoke test with longer limits (`--landing-ms 60000`, `--check-ms 240000`), list
those flags in the verification record, score E2 on the settle time you measured, and name the
fix for the data owner: a materialised table at the grain the app reads
([knowledge](../knowledge/performance.md#every-query-takes-several-seconds-the-layers-own-measures-included)).

## 4. Console and network

- No console errors and no failed requests (status ≥ 400) after load, after a tab switch, and
  after a selection. Note any benign known first-load message explicitly rather than ignoring
  errors in general; see [knowledge/hosting.md](../knowledge/hosting.md).
- Every object reports rendered; no "could not be rendered", no stuck "Loading…".
- No refused theming operations left unexplained.

## 5. Screenshots of every tab

At **1440×860** in a visible window, screenshot every tab and every toggled variant. Look at
each one, not just its existence:

- date axes read as dates (`Jan 2026`), never epoch numbers;
- KPI values and titles on one line; no scrollbar inside any card;
- no ellipses or clipped text in titles, chips, axis labels, legends or table headers;
- legends show every series, without pagination arrows;
- labels readable on their background, inside and outside bars;
- colours that carry meaning are the right ones, also with a selection applied;
- one screen per tab where the archetype requires it: no vertical page scroll for a
  command-centre, monitor or planner. Workbenches, stories and reports may scroll: run the
  smoke test with `--scroll-ok --full-page`, since an 860 px capture never shows what sits
  below the fold.

## 6. Narrower widths

Use the kit's smoke test (`--widths 1440,1280,1024`) rather than resizing an agent's browser
window: attached windows often keep their own size whatever a resize call says.

Repeat at 1280 and 1024 wide, and check the phone width if the brief names mobile readers. No
horizontal page scroll, controls do not overlap, charts resize **without remounting** (watch
for a flash), and table columns refit.

## 7. Empty and edge states

- Select a combination with no data: every object shows a clear empty state, not an error, and
  KPIs show a dash or zero as the data says.
- The latest period with partial data, and the earliest period with no prior period.
- A long label value (the longest name in the dimension profile).

## 8. Deliverables

- **Excel report:** click the button with a selection applied. The file lands on disk, opens,
  and its figures match the screen for that selection **on every sheet**, not only the sheet for
  the tab you are on: sheets for hidden tabs are where filters get lost. Register
  `appState.exportProbe` so the smoke test proves this on every run
  ([pattern](../patterns/xlsx-export.md#sync-every-group-before-reading)).
- **What-if:** move each input; the dependent numbers change and return on reset.
- **Workflow:** run one item through every state as each role; the audit trail records each
  step; the maker cannot approve their own item; reset restores the seed. After a write, the
  screen shows the new state (the cache was cleared).

## The verification record

```markdown
| Check | Tab | Result | Evidence |
| Reconcile: KPI total = Σ by region | Overview | 4,812 = 4,812 ✓ | query + screenshot |
| Select region → KPI, chart, table change; clear restores | Overview | ✓ | screenshots |
| Queries per click | Overview | 14 for 10 objects + 1 sparkline column + 2 controls, budget 16 ✓ | __qlog |
```

Report what is **not** done or not matched, with what was tried. "Mostly works" is not a result.
