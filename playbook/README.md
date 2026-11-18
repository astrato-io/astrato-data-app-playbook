# Playbook: build an Astrato Data App to the standard

The examples in this repo show what a finished app looks like. This playbook is how to get there
with **your own** semantic layer and data. It is a loop, not a checklist: read, decide, build,
prove, release, then score the result against the [rubric](rubric.md) and go round again on
whatever scored below 2.

## The loop

| Step | Do | Produces |
| --- | --- | --- |
| [0. Getting started](0-getting-started.md) | Once per machine: skills, MCP connection, CLI, project | An agent that can query your layer and a project that runs |
| [Build the layer](build-the-layer.md) | Only when no layer exists over the data yet: views, joins, dimensions, measures and a time axis through the Astrato MCP server. No data is created | A **published semantic layer** over the user's own data |
| [1. Read the layer](1-read-the-layer.md) | Discover the semantic layer through the Astrato MCP server and query it | A **data brief**: grain, time, joins, verified metrics and dimensions, stored questions, gaps, reconciliation pairs |
| [2. Brief](2-brief.md) | Decide who the app is for, the decision it supports and the story in the data | A **brief**: persona, decision, hero number, tabs as questions, advanced analytics, workflows and actions |
| [3. Choose references](3-choose-references.md) | Pick 2–3 examples by archetype; inventory any reference design | A **reference list** of techniques to copy, and a **property inventory** if you were given a design |
| [4. Build](4-build.md) | Extend the layer, then the app: native objects on stored questions, selections, KPIs, tabs, exports, workflows | The **app** and the **layer changes** it needs, published |
| [5. Verify](5-verify.md) | Prove figures, selections, query counts, rendering and layout in a real, visible browser | A **verification record**: reconciliations, selection tests, query counts, screenshots of every tab |
| [6. Release](6-release.md) | Build, smoke locally, publish, smoke the live copy, then grant access deliberately | A **live app** that works for its audience, not only for you |
| [Rubric](rubric.md) | Score the finished app, 0/1/2 per criterion | A score and the list of what to fix next |

Do not skip ahead. A tile chosen before step 1 is a guess; an app shown before step 5 is a
hope. When a request says "quick", cut the number of tabs, not the steps or the
non-negotiables.

## The 10 non-negotiables

Every app, every time, in the first pass. None of them is added "when asked".

1. **Read before you design.** No chart, tab or layout is named until a data brief with verified
   values exists. → [step 1](1-read-the-layer.md)
2. **Every figure comes from the semantic layer.** Every chart, KPI and table is a native Astrato
   object backed by a stored business question; no HTML tables, no hand-drawn charts, no maths in
   the browser that the layer could do. Short text figures no object can show (a headline
   sentence, a period label) may query stored measures; a user-composed report and a share
   written in a sentence follow the A3 and A4 notes in the [rubric](rubric.md). → [governed questions](../patterns/governed-business-questions.md), [step 4](4-build.md#2-native-objects-on-stored-questions)
3. **Model in the layer, not around it.** Missing dimensions, bands, flags and measures are added
   to the layer before charting; types come from the warehouse. → [step 4](4-build.md#1-layer-first)
4. **Selections work everywhere.** A sticky selection bar with chips and "Clear all", filters on
   every page, and every filter or click changes KPIs, charts and tables alike.
   → [selection bar](../patterns/selection-bar.md), [step 5](5-verify.md#2-selections)
5. **No bare KPI.** Every KPI card has a period comparison coloured by whether the move is good,
   and a native mini chart. → [KPI pattern](../patterns/kpi-sparkline-comparison.md)
6. **Analytically rich, not vanilla.** Beyond trend and breakdown: period comparisons, moving
   windows, rank, share of total, top N, drivers. → [step 2](2-brief.md#4-make-it-analytically-rich)
7. **Bespoke around one story.** One persona, one decision, one hero number; page structure built
   for it. Copy techniques from the examples, never page skeletons. → [step 3](3-choose-references.md#2-copy-techniques-never-skeletons)
8. **Fast because it only queries what is on screen.** Every tab preloaded; one selection group
   per tab, mirrored only while visible; queries per click ≈ visible objects.
   → [preload tabs](../patterns/preload-tabs.md), [step 5](5-verify.md#3-queries-per-click)
9. **A product, not a dashboard.** A formatted Excel report always; a what-if on the real levers
   and a workflow with an audit trail wherever the brief has a lever or an action.
   → [step 4](4-build.md#7-deliverables-that-make-it-a-product)
10. **Proven before it is shown, and again after it ships.** Figures reconciled, every selection
    tested, every tab screenshotted in a visible window; then build → local smoke → publish →
    live smoke. → [step 5](5-verify.md), [step 6](6-release.md)

## Defaults (change only when the brief says so)

- Light mode: light page, white cards, dark text, brand colour in the header band. If a brief asks
  for dark, confirm it is deliberate.
- One screen per tab at 1440×860 with no vertical scroll, for command-centre, monitor and planner
  archetypes. Workbenches, stories and reports may scroll, in reading order.
- Minimal text. The question is the card title; the numbers carry the story.
- Honest wording. Never call data "live", "real-time" or "total" unless it is. Simulated
  workflow persistence is labelled as such.

## Related

- [AGENTS.md](../AGENTS.md) — how to find and read the examples.
- [patterns/](../patterns/) — the techniques the build step links to.
- [knowledge/](../knowledge/) — version-specific behaviour of the visualizations library, the
  engine, selections, writeback, the CLI and hosting.
