# Role switcher

An "Acting as" picker that changes who the user is in the demo: permissions, default views and who signs the audit trail.

## When

Workflow apps with maker–checker rules: the demo has to show the same item from the proposer's and the approver's seat.

## How

Define demo users with roles and mandates in one module, derive permissions per action from roles, and stamp the acting user on every write and audit event.

## Examples

- portfolio-os — users and permissions: [core.js:46](../examples/portfolio-os/project/src/core.js#L46)
- lending-affordability — underwriter and approvers with mandates: [workflow.js:175](../examples/lending-affordability/project/src/workflow.js#L175)
