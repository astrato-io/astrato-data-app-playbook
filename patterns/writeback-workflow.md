# Writeback workflow

Workflow state (proposals, approvals, decisions) and its audit trail are written to governed views through `app.writeback`, then read back like any other data.

## When

Any app where people *do* something: approve, propose, flag, adopt a plan. It is what separates an operational app from a dashboard.

When one person acts and another must see it, the state must be shared: create the two tables (empty, in the layer's connection) and add them as new views. That is an addition, not a change, and not mock data, so decide it in the brief rather than stopping to ask. Use browser storage alone only when warehouse changes are ruled out, and say on screen that it is not shared.

## How

1. Model two views in the layer: **records** (one row per workflow item, with state) and **audit events** (actor, role, previous and new value, reason, timestamp).
2. Every action is a writeback of the record plus an audit insert. Enforce maker–checker in the app: the author cannot approve their own item; mandates decide who may approve.
3. Keep a labelled fallback to browser storage: hosted and public viewers cannot write.
4. Ship a reset: seed copies of the tables and a "Reset demo" that restores them.

## Gotchas

- "Astrato rejected the runtime request" usually means a CTAS-built `VARCHAR(n)` column too narrow for the value; widen every text column of a writeback table.
- Write dates as ISO strings with a trailing `Z`. Every field name must exist in the published view.
- Clear the query cache after a write, or the app shows the old state.

## Examples

- portfolio-os — records + audit events with fallback: [core.js:176](../examples/portfolio-os/project/src/core.js#L176)
- lending-affordability — the same maker–checker rules, kept in the browser only: [workflow.js:175](../examples/lending-affordability/project/src/workflow.js#L175)
