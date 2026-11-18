# 1. Read the layer

No layer yet? [Build it](build-the-layer.md) from the warehouse tables first, then come back here.

A dashboard designed from a glance at a field list is a guess. Before naming a single chart,
read the semantic layer through the Astrato MCP server **and query it**. The output of this
step is a written data brief; it contains no design decisions.

## Before you start

- Call `astrato_get_context` and read `auth.scopes`. Its result is about 60 KB: save it to a
  file and parse what you need ([knowledge](../knowledge/performance.md#mcp-calls-fill-the-agents-context)). Reading metadata needs `sl:read`; profiling
  needs `data:query`. If the connection cannot query, say so and get it fixed, or profile from
  the app's own development session. Never write an unprofiled metric into the brief as verified.
- Name the semantic layer by id on every call. Names collide; ids do not.
- MCP queries read the **published** layer. Draft changes are invisible to them.

## The sequence

Stop at each step only long enough to write down what it told you.

### 1. Scale and state

`astrato_semantic_layer_get_summary`, then `astrato_semantic_layer_get_details`.

Record: counts of views, fields, joins, dimensions, measures and stored questions; the draft
revision and the published revision. A draft ahead of the published revision means someone has
unpublished work; note it and do not publish over it blindly later.

Scan the name index for junk: `Copy of …`, placeholders, trailing spaces, near-duplicates.

### 2. Inventory

On a small layer (under about 100 measures), one `astrato_semantic_layer_get_summary` with
`includeDetails: true` returns every view, field and item. Above that it outgrows an agent's
tool-output limit (358 measures came to about 60 KB): call `get_summary` with
`includeSnapshot: true`, save the snapshot it links to a file and parse it with a script, or page
through `astrato_semantic_layer_get_details` one section at a time. Use
`astrato_semantic_layer_search` / `astrato_semantic_layer_search_fields` for concepts. See
[keeping MCP responses small](../knowledge/performance.md#mcp-calls-fill-the-agents-context).

Read paginated results to the end. Record every measure and dimension with its type and
description, and which views hold dates, keys and status-like fields. A missing description is
a finding: two similar names can return very different numbers.

### 3. Joins

`astrato_semantic_layer_check_join_quality`. Record each join's direction and cardinality, and
which views a shared dimension (region, product, office, date) actually filters. One filter must
reach every fact the app shows; if a fact is not joined to the shared dimensions, that is a gap.

Run one cross-fact query (a shared dimension plus a measure from each fact). If it returns no
rows or duplicated totals, the model needs fixing before the app.

A **long-format** layer (one row per series per period, each measure pinned to one series) has
no star to check: record which fields select series and which slice them, and read
[how it changes the app](../knowledge/semantic-layer.md#a-long-format-layer-one-row-per-series-per-period).

A layer with **no joins** between its facts is common in snapshot and benchmark data. Record it
as a gap: the fix is a join in the layer (step 4). Adding a join counts as an addition, even
on a layer where you may not change existing items; check the existing questions still run. If you may not add joins, the app has to mirror
a selection from one view onto another by value (the same university, product or region name in
both), and the data brief should list which filters will and will not reach each view.

### 4. Stored questions

`astrato_semantic_layer_list_questions`, then `astrato_semantic_layer_get_question` and
`astrato_semantic_layer_execute_question` for the ones near the decision. Stored questions are
the owner's spec. When the layer has none, the owner's request is the spec: plan one stored
question per object in the brief and create them as additions in [step 4](4-build.md#1-layer-first).
`astrato_semantic_layer_suggest_questions` gives proposals to start from:
treat them as proposals, read any rejections and their reasons, and check they relate to the
decision at all. Measures' formulas are only in the snapshot
([where](../knowledge/semantic-layer.md#where-to-read-a-measures-formula)). Existing questions written for another persona (filtered to one team, one
period) are examples of shape, not your spec: record them as such and plan your own.

### 5. Profile

Profile the user's own published layer, over MCP, every time. This repository ships no data and no
dimension profiles: the example layers under `layers/` show how a model is built, not what the
user's values are, so never copy a value, a range or a label from them into the brief.

Resolve each query in tiers and note which tier answered: a stored question; then stored
dimensions and measures; then raw view fields. Use `astrato_data_prepare_query` with
`scope: "semantic"` to get canonical references, then `astrato_data_execute_query`. Every
execution reports the SQL the engine ran; quote it rather than writing SQL yourself. Keep row
limits low and pass `responseBudgetBytes: 4096` while profiling
([how](../knowledge/performance.md#mcp-calls-fill-the-agents-context)); leave it off for the
query whose SQL you will quote. Ten to twenty small queries is normal.

Profile:

- **Grain.** What one row of each fact is (an order, an order line, a daily snapshot). Each
  "Total X" is counted at its own grain, never as the view's row count.
- **Time.** Min and max of every date field. **The latest complete period**: if the current month
  or week is partial, every "this month vs last month" figure must end at the last complete one,
  or the app opens on a fake collapse. Record the grain available (day, week, month) and whether
  history covers a prior year (needed for YoY and YTD vs PYTD).
- **Snapshot measures** (headcount, balances, inventory, open pipeline): confirm they are filtered
  to one period. Summed across months they are wrong.
- **Each candidate dimension.** Cardinality and top values with counts. ≤ 8 values suits series
  colour; ≤ 30 a bar axis; ≤ 200 a filter or table column; more, table only. List **every** value
  of status-like fields; filters depend on the exact strings. Note the **longest label**: names
  over about 25 characters get cut off on axes and in tables, and a shorter label dimension in
  the layer fixes that once for every chart.
- **Each candidate measure.** One value with no dimensions; sanity-check it against the subject.
  Run unclear calculations once by the main dimension to see what they compute.
- **Whether a comparison can tell members apart.** Run each scenario or period comparison by the
  main dimension. A uniform shift (every member moves by the same amount) or one growth rate for
  every member means rankings never change and a "change" ranks by size; a base period with a
  one-off rebound colours every "vs prior period" figure. Record these as caveats and say them
  on the cards they shape.
- **Each series' own date range**, if the layer holds several series in one view: they often end
  on different dates ([knowledge](../knowledge/semantic-layer.md#each-series-ends-on-a-different-date)).
- **Every date dimension, executed.** Count the rows it returns. A dimension named "… Month" over
  a date field returns one row per day unless a date level was set on it; its description proves
  nothing. See [knowledge](../knowledge/semantic-layer.md#a-date-dimension-returns-one-row-per-day-whatever-its-name-says).
- **Null share** of anything you will chart.

### 6. Reconciliation pairs

Choose the pairs the app will visibly assert and record both sides now: a KPI and the sum of its
breakdown, a rate and its weighted parts, a year's total and the sum of its months. These are
the checks in [step 5](5-verify.md#1-figures).

## The data brief

Write it to a file next to the app (for example `docs/data-brief.md`). The next steps read it,
not the layer.

```markdown
# Data brief — <layer name>

## Subject
One sentence: what the layer is about.

## Scale and state
Revision / published revision; views, fields, joins, dimensions, measures, questions.

## Grain and time
| View | One row is | Date field | Min | Max | Latest complete period | Prior year? |

## Joins
Which shared dimensions filter which facts; the cross-fact query result; any fan-out.

## Metrics (verified)
| Name | Reference | Aggregation | Value | Tier | Notes (unit, snapshot?, up is good?) |

## Dimensions (profiled)
| Name | Reference | Cardinality | Top values | Null % | Suits |

## Stored questions
| Name | What it answers | Runs? | Candidate use |

## Reconciliation pairs
| Headline | Must equal | Observed |

## Gaps
What the decision will need that the layer lacks: dimensions, bands, period-comparison measures,
ratios, joins, questions. These become layer work in step 4.

## Caveats
Junk names, missing descriptions, partial coverage (a measure recorded for only part of the
rows), unpublished drafts, anything unverified.
```

## Rules

- Only what ran goes in the metric and dimension tables. Anything you could not profile is a
  caveat marked *unverified*.
- Never substitute an unrelated field because its name is close.
- A partially populated measure carries its caveat everywhere it appears in the app.
- This step is read-only. Gaps are listed here and fixed in [step 4](4-build.md#1-layer-first).

For engine and query behaviour, see [knowledge/engine-and-queries.md](../knowledge/engine-and-queries.md)
and [knowledge/semantic-layer.md](../knowledge/semantic-layer.md).
