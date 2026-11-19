# Royalty Close & Exception Review — Larkspur Music

A fictional music publisher's finance controllers and royalty operations ask: *which statements in
this month's processing run need attention before close, who owns each exception, and what evidence
supports sign-off?* The app answers on clearly labelled demo data: 1,920 royalty statements across 8
branches and 6 monthly processing runs (R-2026-05 to R-2026-10), each with seven amount lines plus
suspense, calculation-error and income detail, and 34 seeded close cases. Analysts open a case on a
statement, attach evidence and submit it; a Finance Controller with access to that branch approves the
disposition, returns it, or approves a carry-forward. Every step is written back to the warehouse with
an audit row. The story in the synthetic data it was built on (not shipped here): Brazil is the worst
branch in the current run, and two UK statements carry the demo script, ST-UK-2610-0007 (calculation
error E204, GBP 2,416.80) and ST-UK-2610-0012 (suspense, GBP 1,840.25). It is a hand-written Astrato
App on Vite and the public `@astrato-io` packages (visualizations 0.9, app-runtime 0.8), with an
English/Spanish switch and a phone-first Summary tab.

No screenshots are shipped yet.

## Tabs

- **Summary** — the landing tab below 760px. "Needs you" for the acting user (an analyst's open cases, a controller's review queue, overdue cases for others), four KPI cards, the top five exposures (tap to investigate), and exposure by branch.
- **Close overview** — five filters, six KPI cards (statements needing attention, unreconciled, outstanding source exposure, suspense, calculation errors, write-offs; each with a by-run sparkline and a vs-prior-run row), the current-run exception queue (click a statement, then "Investigate statement"), an expandable exception pivot (branch › category › payee type), a branch scorecard with an unreconciled-by-run mini-chart column, exceptions by run vs exposure (combo), calculation errors by type (donut), exceptions by branch and category, suspense by reason.
- **Statement investigation** — a demo script strip, the statement's read-only source facts, the case form (open and assign, then submit with a disposition and required evidence references), five amount KPIs, and tables for statement amounts, income lines, suspense detail, calculation errors and this statement's case history.
- **Controller review** — three KPI cards, the review queue (approve, return, or approve a carry-forward; a rationale is required to return or carry forward), the case register, approved carry-forwards still exposed at source, cases by branch and status, and the full action history.
- **Close simulator** — six sliders (analysts, cases cleared per analyst per day, working days to the 14 Nov deadline, suspense released, calculation errors fixed by a re-run, residual carried forward) over the governed current-run baseline; five results and exposure today vs projected by branch.
- **Business questions** — the layer's 14 close questions listed by category; picking one runs it as a native table with a copy button.

The header (Branch, Processing run, Currency, Acting as, Language) sits above every tab; on a phone it
folds behind one "Filters & role" button ([app.js:158](project/src/app.js#L158)). "⬇ Excel close pack"
and "Reset demo" sit in the tool row.

## Worth copying

**Case workflow written back, guarded, with an honest fallback.** Cases live in the `Close Cases`
view and every action appends a `Close Case History` row (actor, role, from and to status, observed
amount, note). `run` ([app.js:344](project/src/app.js#L344)) applies the change locally, sends each
write through `app.writeback` with the app's own layer id ([app.js:332](project/src/app.js#L332)),
clears the query cache, re-reads the cases and remounts the 12 case objects. Before any write,
`allowed` ([app.js:343](project/src/app.js#L343)) checks the acting user's role, write permission and
branch scope from the governed `App Users` view, and the review queue refuses a controller who last
updated the case (maker–checker, [app.js:449](project/src/app.js#L449)). If writeback is missing or
fails, the case is kept in `localStorage` and the toast says it is a labelled demo fallback; on load,
local cases are merged under the governed ones ([app.js:325](project/src/app.js#L325)). The layer's
Data Actions repeat the same guards in SQL ([layer.mjs:193](project/tools/layer.mjs#L193),
[layer.mjs:202](project/tools/layer.mjs#L202)), for callers that can run them.

**Copy a native table, all rows.** A native table renders only the rows on screen, so the copy
button re-runs the table's own query through `engine.getData`: the same columns, its static filters
and the group's applied selections, sorted like the table, as tab-separated text that pastes into a
spreadsheet ([app.js:110](project/src/app.js#L110)). The same button serves the exception pivot and
the stored-question table.

**Banner sentence from governed measures.** Two queries of stored measures (statements, exception
statements, unreconciled, suspense items, calc errors, exposure; open, overdue, awaiting review and
carry-forward cases) fill one sentence that follows the header filters ([app.js:302](project/src/app.js#L302)).

**KPI card = number + sparkline + comparison row.** [catalogue.js:28](project/src/catalogue.js#L28)
builds three objects per KPI: a `number`, a bar or line sparkline by processing run, and a
header-less one-row `table` holding the prior value and the change, whose indicator bands colour the
change by whether that direction is good. On visualizations 0.9 these follow the group's selections
with no static-filter mirror; the smoke checks confirm the KPI and its comparison move and restore.

**Pivot with right subtotals.** The exception pivot is three governed queries (leaf rows, one row per
branch, one grand-total row), so subtotals stay correct for non-additive measures such as exposure
÷ earnings; branches expand and collapse and the pivot reloads when the overview selection changes
([app.js:574](project/src/app.js#L574)).

**Two languages without touching the objects.** English is the source language. A MutationObserver
translates text nodes and title/placeholder/aria-label attributes as they appear, including the
labels native objects render, while selections and writes keep the English values the warehouse
holds ([i18n.js:302](project/src/i18n.js#L302)).

Also useful:
- inactive panes are moved off-screen, not hidden, so every tab is mounted at load and keeps its size ([studio.css:42](project/src/studio.css#L42));
- table column widths are pixel shares of the slot, refitted on resize without a remount ([app.js:244](project/src/app.js#L244));
- query lanes with 429 backoff and a session cache around `engine.getData` ([throttle.js:107](project/src/throttle.js#L107));
- a six-sheet styled close pack (summary vs prior run, branch scorecard, exception queue, cases, action history, what-if), every sheet queried at export time with its tab group's applied selections passed explicitly: Summary, Branches, Exception queue and What-if follow the overview group, Cases and Action history the Controller review group, and each banner lists the filters its rows follow ([app.js:655](project/src/app.js#L655)). `buildWorkbook()` returns the Blob and the button downloads it; it is written by a dependency-free OOXML writer ([xlsx.js:206](project/src/xlsx.js#L206));
- six smoke checks the app registers itself: header selections move a KPI, its comparison, a chart and a table on four tabs and restore on clear, and the Excel pack downloads ([app.js:715](project/src/app.js#L715)); plus `appState.exportProbe`, which builds the pack without and with header Branch = UK so the smoke test fails any sheet that does not narrow.

## Semantic layer

[`layers/royalty-engine`](../../layers/royalty-engine/) ("Larkspur Music – Royalty Engine (demo)")
has 16 views, 14 joins, 63 dimensions, 110 measures, 21 business questions and 8 Data Actions. It is
shared with a recovery app that is not in this repo.

- **Views the app reads:** `Statements` (`ROYALTY_STATEMENTS`), joined many-to-one to `Branches` on `Branch`; `Statement Amounts`, `Suspense Detail`, `Calc Errors Detail` and `Income Statement Detail`, each joined to `Statements` on `Statement Id`; `Close Cases` (to `Statements` on `Statement Id`) and `Close Case History` (to `Close Cases` on `Case Id`); `App Users` for roles and branch scope.
- **Views the app writes:** `Close Cases` (`ROYALTY_CLOSE_CASES`) and `Close Case History` (`ROYALTY_CLOSE_EVENTS`).
- **Measures used:**
  - Run comparison: `Exception Statements`, `Unreconciled Statements`, `Statements with Calc Errors`, `Source Exposure USD`, `Suspense USD`, `Write-offs USD`, `Statements`, each with `… Current Run` / `… Prior Run` and a `Change vs Prior Run` or `vs Prior Run` measure; `Unreconciled Rate Current Run`, `Unreconciled Rate vs Prior Run`.
  - Statement amounts: `Gross Earnings`, `Reconciliation Difference`, `Suspense Amount`, `Calc Error Impact`, `Source Exposure`, `Closing Balance`, `Write-offs`, `Statement Amount`, `Statement Amount USD`, `Statement Amount Rows`, `Income Amount`, `Income Amount USD`, `Exposure Rate`.
  - Detail: `Suspense Items`, `Suspense Detail Amount`, `Average Suspense Age`, `Calc Errors`, `Calc Error Detail Impact`.
  - Workflow: `Cases`, `Open Cases`, `Overdue Cases`, `Cases Awaiting Review`, `Approved Dispositions`, `Case Approval Rate`, `Cases Returned`, `Approved Carry-forwards`, `Carry-forward Exposure`, `Observed Case Amount`, `Case Actions`.
- **Business questions:** 14 on the Business questions tab, e.g. "Which statements need attention before close?", "Which calculation errors are blocking close?", "Does the statement-amount grain hold (one row per statement and amount type)?", "Which carry-forwards are approved but still exposed at source?". Native tiles on the other tabs query measures directly. Full list in [questions.md](../../layers/royalty-engine/questions.md).
- **Data Actions for the close:** Open Close Case, Submit Case for Review, Controller Decide Case. The app does not call them.
- Unused here: the `Paid vs Collectable Lines`, `Song Branch Collectable`, `Songs`, `Recovery Claims`, `Recoveries`, `Claim History` and `Receipts` views, their measures, 7 questions and 5 Data Actions.

## Rebuild from nothing

1. **Data.** This repository ships no data and no data generator. Load your own royalty data into the `ROYALTY_*` source tables (branches, songs, statements, statement amounts, income, suspense, calculation errors, users and the recovery tables) shaped like [`schema/ddl.sql`](../../layers/royalty-engine/schema/ddl.sql), create the empty writeback tables `ROYALTY_CLOSE_CASES` and `ROYALTY_CLOSE_EVENTS`, and keep `*_SEED` clones of the tables the app writes to if you want a warehouse reset.
2. **Layer.** [`tools/layer.mjs`](project/tools/layer.mjs) authors the layer through the Astrato MCP server: `create`, then `views`, `model`, `questions`, `actions`, `validate`, `publish <revision>`. It needs a `tools/mcp.mjs` MCP client and a `tools/types.txt` column-type list, which are **not included in this repo**; set the datasource id in `create` and replace the hard-coded `ASTRATO_GALLERY.MOCK_DATA` with your database and schema (also in the Data Action SQL). Alternatively recreate the layer from `layers/royalty-engine/layer.json`.
3. **App.** See Run it. The layer must be published before the app can see it.
4. **Reset.** In the warehouse, per table the app writes to (cases, events, claims, claim events, recoveries): `DELETE FROM <T>; INSERT INTO <T> SELECT * FROM <T>_SEED;`. It resets every user.

## Run it

```sh
cd project
npm install                # public npm: @astrato-io/app-runtime, @astrato-io/visualizations, vite
# set semanticLayerId in astrato.json to your copy of the layer (it ships as a zero placeholder)
astrato login
npm run compile-check      # every tile compiles against the installed library, no session needed
astrato dev .              # open the sign-in URL it prints
node ../../../kit/verify/smoke.mjs "<that sign-in URL>"
astrato build .
```

Needs Node 24.18 or later. Writes use the layer id the runtime reports, so no second id needs
setting; they need a runtime and layer that accept writeback, otherwise every change stays in the
browser and is labelled as such.

## Caveats

- **Guards run in the browser.** The app writes the case tables with `app.writeback` inserts and updates and does not call the layer's Data Actions, so the role, branch and maker–checker rules are enforced only by [app.js:343](project/src/app.js#L343). The smoke checks are read-only: no write was exercised by the smoke test.
- **Reset demo** clears only this browser's fallback copy (`royalty-close-local-v1`); the warehouse reset (Rebuild from nothing, step 4) resets it for everyone.
- On visualizations 0.9 the Unreconciled statements comparison row shows "-13.1 pts" with a decimal pts format, while the measure is +13.125 through MCP.
- At 1440 wide with six KPI cards per row the calc-error comparison is truncated ("impact $33,…"). "Acting as" is clipped at 1280, the header stacks below 1100px, and Summary stays a narrow column even at 1440.
- The exception pivot is an HTML table, not a native object. The simulator's bars are hand-drawn SVG and its projection is browser arithmetic, including a fixed 0.6 factor on residual exposure ([app.js:501](project/src/app.js#L501)). Its baseline follows the overview group (header and overview filters).
- Card captions "BQ · …" are generated from the tile title ([catalogue.js:172](project/src/catalogue.js#L172)); those tiles are not stored questions. Only the Business questions tab runs stored questions.
- One header change writes the same selection into all four groups ([app.js:295](project/src/app.js#L295)), so it re-queries about 150 objects across every tab. Mirror into the visible tab's group only ([preload tabs](../../patterns/preload-tabs.md)).
- No analyst in `ROYALTY_USERS` covers DE, ES or JP, so nobody can open or submit a case there, and the seeded cases on those branches belong to an analyst scoped to US.
- Dates are fixed: demo date 2026-11-11, current run R-2026-10, deadline 14 Nov. The banner hard-codes "across 8 branches" ([app.js:310](project/src/app.js#L310)). The Excel summary's columns are the fixed current-run and prior-run measures: under a header Processing run they show what the KPIs show for that filter, and the banner names it. The pack holds the warehouse copy of the cases; changes kept only in this browser by the writeback fallback are left out, with a note.
- The Controller review KPI sparklines plot statements by run, not a case measure.
- Some comments and dictionary strings still name the original source tables, and the header comment in [dashboard.js](project/src/dashboard.js) describes another app's selection groups.
- Checked with the kit smoke test at 1440, 1280 and 1024 (79 objects, 6 checks including the Excel download), `npm run compile-check` (92/92) and `vite build`.
- No screenshots are shipped yet.
