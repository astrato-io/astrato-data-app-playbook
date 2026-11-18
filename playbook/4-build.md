# 4. Build

Build in this order. Each stage depends on the one before, and the early stages are where
mistakes are cheap.

1. **Layer** — add what the brief's gaps need, validate, publish.
2. **Compile check** — run `kit/verify/compile-check.mjs` on your tile declarations as soon as
   they exist: it needs no session and catches rejected operations in seconds.
3. **One tile end to end** — definition → compile → mount → theme → the right number on screen,
   matching the data brief. This flushes out format, theming and session problems in minutes.
4. **Shell** — tabs as panes, selection groups, selection bar, scheduler, loading overlays.
5. **The landing tab**, complete, including KPI cards.
6. **The other tabs**, then mini charts, then the Excel report, what-if and workflows.

Batch edits and reload once; every page load costs several engine requests per object, and
reload loops trip rate limits.

## 1. Layer first

The app is presentation. Modelling belongs in the semantic layer, where it is governed, reused
by every surface and testable over MCP.

- **Add before you chart.** Every dimension a chart or filter uses is a stored dimension; every
  figure is a stored measure. A raw column on an axis is a missing dimension.
- **Derived fields go in the layer, not the warehouse.** Bands, buckets, time slots, labels,
  flags and sort keys are layer custom or calculated fields (or bucket and date-level
  dimensions). The only warehouse addition an app makes is empty writeback tables, added as
  new views when the brief needs shared workflow state
  ([pattern](../patterns/writeback-workflow.md)); never mock rows or presentation columns, which
  hide the layer's job and add reload churn. Heavy pre-aggregation is the data owner's change.
- **Types come from the warehouse.** Never hand-declare a field's data type. Omit it, then run
  `astrato_semantic_layer_check_source_schema` (and `apply_source_schema_fix`) until drift is 0
  before authoring measures. If a column needs another type (a year as a label), cast it in a
  warehouse view.
- **Measures in families.** For each headline: the value, its prior-period and prior-year
  versions, its target or budget, and the variance. Build period versions as stored measures,
  not as a calculation repeated inside each question: explicitly filtered measures when the
  facts and the date share one view (period-comparison measures break under any filter on it),
  period-comparison measures on a stored time axis only when the date sits in its own view
  ([how](../knowledge/semantic-layer.md#this-quarter-is-empty-because-the-data-ends-in-the-past)). Ratios as ratio of
  sums. Snapshot measures filtered to one period.
- **Joins** many-to-one from facts to shared dimensions, so one filter reaches every fact. If
  you cannot add a join, mirror selections between views by a shared value in the app
  (*Filters and selections* in the docs), say on the affected cards which filters they follow, and
  record it as a caveat.
- **Author in as few batches as you can**: `astrato_semantic_layer_commit_authoring_batch` with
  everything you know you need in one commit (more will follow once rendering shows what the
  model lacks); check every result, since some refusals are silent. Plan first
  (`plan_authoring_batch`) when changing existing items; see
  [knowledge](../knowledge/semantic-layer.md#authoring-calls-on-mcp-contract-1037). Then
  `astrato_semantic_layer_validate` to 0 errors. Read each error's details: an old source-check
  result can be reported as a failure your change did not cause
  ([knowledge](../knowledge/semantic-layer.md#validate-reports-an-error-your-change-did-not-cause)).
- **Publish.** The app and MCP read only the published layer, so an unpublished measure blocks
  the work it was made for. Check the published revision against the draft first
  (`astrato_semantic_layer_preview_publish`) so you know what else goes out; stop and ask if the
  draft holds someone else's unexplained changes. Publishing can strand live apps on the old
  revision: see [step 6](6-release.md#2-publishing-the-layer-breaks-live-apps).

Details: [knowledge/semantic-layer.md](../knowledge/semantic-layer.md).

## 2. Native objects on stored questions

Every chart, KPI and table is a native Astrato object, and **every one is backed by its own
stored business question**, named with the question the card answers.
→ [governed business questions](../patterns/governed-business-questions.md)

Why one question per object, not a handful: every number on screen is then reproducible from
the layer, testable with `astrato_semantic_layer_execute_question`, findable by AI agents and
other tools over MCP, and reconciled with every other surface. The app holds only presentation
(type, colours, labels). A chart without a question is a number nobody else can check.

- Declare each tile once in a catalogue module, and write the app's copy of each question from
  what the layer returns: native charts take a definition, and `runQuestion` (app-runtime 0.8+)
  runs only in a published App or the Builder preview, never under `astrato dev`. What may stay
  outside a question (sparklines, mini-chart columns, a headline sentence) is listed in the
  [pattern](../patterns/governed-business-questions.md#keeping-the-app-and-the-layer-in-step-without-a-script).
- Leave `format` off governed measures so the layer's format and currency apply.
- Give every question a unique name; two tables sharing one name collide.
- **Native only.** No HTML `<table>`, no hand-drawn bars, bands or grids. Audit every panel
  before showing the app. Keep HTML only where no native object can do the job, and say so.
- **Every table has a sparkline column** of its key measure by month, plus data bars and
  coloured change indicators where they help. → [table sparklines](../patterns/table-sparklines.md)
- Statements and hierarchies use native pivot or expandable tables, not flat ones.
- **Date axes** need a date-level grouping and a month-year format, or they print epoch numbers;
  check every copied helper. As of visualizations 0.5/0.6, see
  [knowledge/visualizations.md](../knowledge/visualizations.md).
- Set each chart's row limit from its shape: a multi-series line needs series × periods rows,
  and a limit below that silently cuts the axis short
  ([knowledge](../knowledge/visualizations.md#a-multi-series-line-silently-stops-part-way-along-the-axis)).
- Colour that carries meaning is pinned per measure or state; single-series charts use one flat
  colour; semantic colours (good, warning, critical) are for state only.
- Trend charts carry governed reference lines. → [reference lines](../patterns/reference-lines.md)

## 3. KPI cards

Value, period comparison and native mini chart, on every card.
→ [KPI with comparison and mini chart](../patterns/kpi-sparkline-comparison.md)

- Compare the latest complete period with the one before; decide per measure whether up is good
  (costs, churn, ageing: down is good) and colour accordingly.
- Snapshot KPIs with no time axis get a mini bar by a natural breakdown.
- Mount mini charts after the tab's main objects.

## 4. Selections

→ [selection bar](../patterns/selection-bar.md)

- A sticky selection bar on every page, with chips, × per chip, "Clear all" and an empty hint.
  Filters on every page, the executive page included.
- Auto-apply pending selections from filters and chart clicks.
- Mirror selections into measure-only objects (number tiles, one-row tables) as static filters.
- Cross-filtering on governed items needed a connectivity wrapper on visualizations 0.4–0.6; on 0.8 test before adding it.
  See [knowledge/selections.md](../knowledge/selections.md).
- A click whose next question is about one record opens a drawer instead of filtering.
  → [record drawer](../patterns/drawer-detail.md)

## 5. Tabs, groups and mount order

→ [preload tabs](../patterns/preload-tabs.md), [query scheduler](../patterns/query-scheduler.md)

**Preload every tab**, and give **each tab its own selection group**, mirrored from `main` only
while the tab is on screen. At about a second per query, a tab that starts querying on click
sits empty; a single group shared by preloaded tabs makes one click re-query every hidden chart.
Doing both gives instant tab switches and clicks that only cost what is visible.

- Seed every group with the default selections before preloading; write clicks back to `main`.
- Mount order: the visible tab first (KPI values, main charts, tables), then its mini charts,
  then the other tabs a few objects at a time. Every slot shows "Loading…" until ready.
- Hide inactive panes off-screen at the active pane's width, never with `display:none`.
- Never remount on resize. Only tables with pixel column widths need an update on resize.
- Wrap the engine with the scheduler: lanes, 429 retry, a session cache, `window.__qlog`. In a
  template app it belongs in the `engine.getData` wrapper `astrato.ts` already installs (key the
  cache on the request without its `context`). A cached answer sends no query, so the object
  menu's SQL (`getLastQueryMetadata`) then shows that object's earlier query.
- On very large layers, pass each object only the fields it uses and precompile vSpecs. See
  [knowledge/performance.md](../knowledge/performance.md).

## 6. Layout and look

- The archetype decides the layout; the story decides the order. Hero first, top left.
- One screen per tab at 1440×860, no vertical scroll, for command-centre, monitor and planner.
  Workbenches, stories and reports may scroll, in reading order.
- Light mode by default (see [knowledge/theming.md](../knowledge/theming.md)).
- The card title is the question. Minimal other text. Units in titles or formats, not both.
- Rows have fixed heights; charts never size their own row.

## 7. Deliverables that make it a product

- **Excel report**, always: a header button writing a formatted multi-sheet workbook from the
  same governed queries, following the on-screen filters. → [xlsx export](../patterns/xlsx-export.md)
  A template app has only the object menu's per-object Excel, no report workbook: copy an example's `xlsx.js` and change its footer, which says
  "Illustrative data" (wrong on real data). Read the figures with a plain-function twin of the
  template's `useFigures` hook, so the workbook runs the same governed queries as the cards.
- **What-if**, wherever the brief has levers: inputs on the real levers that change numbers
  through the layer. → [what-if](../patterns/what-if-parameters.md)
- **Workflow**, wherever the brief has actions: records and audit events in governed views via
  writeback, maker–checker, an acting-as switcher, and a reset. Clear the query cache after
  every write. Where the audience cannot write, a labelled browser-only fallback.
  → [writeback workflow](../patterns/writeback-workflow.md), [role switcher](../patterns/role-switcher.md),
  [knowledge/writeback.md](../knowledge/writeback.md)
- Models the layer cannot express (IRR, DCF, projections) run in a pure engine over governed
  inputs. → [in-app calc engine](../patterns/in-app-calc-engine.md)
- Forms are real `<dialog><form>` elements handling `submit`, never `prompt()`.

Project setup: [getting started](0-getting-started.md) (Vite and the public packages; the CLI's
dashboard template or the examples' vanilla layout, one stack per app). See also
[knowledge/cli-and-publishing.md](../knowledge/cli-and-publishing.md).
