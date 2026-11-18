# Keystone Affordability & Decisions layer

The model behind [lending-affordability](../../examples/lending-affordability/): about 2,400
fictional loan applications at Keystone Home Finance, and the workflow events on them.

| View | Table | Grain |
| --- | --- | --- |
| Applications | `LENDING_AFFORDABILITY` | one row per application: applicant, income and expense lines, proposal, affordability result, stage and outcome, with 0/1 flag columns (`IS_OPEN`, `IS_PASS`, `IS_APPROVED`, …) |
| Workflow Events | `LENDING_WORKFLOW_EVENTS` | one row per workflow event, many-to-one to Applications on Applicant Id |

18 dimensions, 25 measures and 12 stored business questions. See [questions.md](questions.md).

## Modelling choices

- **Flags as numbers.** Rates are `SUM(flag) / SUM(flag)` (approval rate = approved ÷ decided).
  That makes them additive across any breakdown and easy to filter.
- **Bands are columns** (age, income, credit band) so they sort and filter cleanly.
- **Governed period changes.** Two questions return month-on-month and quarter-on-quarter
  changes of the headline metrics: growth for counts and £ values, difference for ratios, offset 1.
  The app's KPI deltas come from these questions, not from browser arithmetic.
- **Workflow state in the warehouse.** Stage, approver and outcome are columns, so the approval
  queue is a governed query. Decisions taken in the app are kept in the browser (see the
  example's caveats), not written back to these tables.

## Recreate it

No data ships with it. Load your own tables shaped like [schema/ddl.sql](schema/ddl.sql), then
the example project rebuilds the model: `project/tools/layer.mjs` (views, dimensions, measures)
and `project/tools/questions.mjs` (the business questions). See the example README for the order.
Profile your copy over MCP ([playbook step 1](../../playbook/1-read-the-layer.md)) before building on it.
