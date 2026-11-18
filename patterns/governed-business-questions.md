# Governed business questions

Every chart, KPI and table is a stored business question in the semantic layer; the app only adds presentation.

## When

Always. A question in the layer is reusable, can be tested with `astrato_semantic_layer_execute_question`, shows up for Nash and other tools, and keeps every number in the app reconciled with every other surface.

## How

1. Declare each tile once in a catalogue module: question name, stored dimensions, measures, filters, order, advanced calculations (growth, diff, running total).
2. A tools script commits each tile as a stored question, with the tile's question as its name, and publishes the layer.
3. Native charts take a definition, and `runQuestion` (app-runtime 0.8+) runs only in a published App or the Builder preview, not under `astrato dev`, so the same script **syncs** them back into the app as a generated module (`app/questions.js`). The tile then adds only type, colours and display names.
4. Show the question on the card: it is the chart's title.

## Keeping the app and the layer in step without a script

The examples' sync scripts need a personal access token in the shell. An agent that has the MCP
tools but no token can do the same by hand, in this order, so the question is typed once:

1. Author the questions in the layer (`astrato_semantic_layer_commit_authoring_batch`, one commit).
2. Publish, then run each with `astrato_semantic_layer_execute_question`.
3. Read each back with `astrato_semantic_layer_get_question` and write the app's question module
   **from that response**, never from memory of what you sent.

What a stored question cannot hold stays in the tile and is not a breach of the rule: a KPI
card's sparkline (make it its own object with its own question), a table's mini-chart column
(an extra measure on the tile), and presentation. Short figures no native object can show as
text (a headline sentence, the sign that colours a delta, a period label) may come from an
app-side query of **stored measures**; never from arithmetic on raw columns.

## Carrying a question's calculation into the tile

A chart cannot be bound to a stored question by id: each tile re-expresses its question as a
definition plus operations. Dimensions, measures, filters and order carry over directly. Advanced
calculations do not always: some are accepted by the chart and silently not sent. After building
a tile with one, compare a value with `astrato_semantic_layer_execute_question`; where the chart
cannot express it, move the calculation into a stored **measure** and chart that. The known
mappings are in [knowledge](../knowledge/visualizations.md#a-stored-questions-advanced-calculation-does-not-survive-into-the-chart).
For "difference from the set average", a stored measure that subtracts the average over the whole
result (measure option `scope: total`) from the row value does work in charts on 0.9.

## Gotchas

- Use stored dimensions, not raw columns. Add a governed dimension before charting a new column.
- A question combining a running total and a top N fails (engine 13700); split it.
- Publishing one measure can change the result type of others; re-run the sync after every publish.

## Examples

- lending-affordability — tile = question + presentation: [dashboard.js:75](../examples/lending-affordability/project/src/dashboard.js#L75); question sync: [questions.mjs:111](../examples/lending-affordability/project/tools/questions.mjs#L111)
- portfolio-os — 24 questions in [app/questions.js](../examples/portfolio-os/project/src/questions.js), routed to by the Nash tab
