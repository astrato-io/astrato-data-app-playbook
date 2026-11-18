# What-if controls

Sliders and inputs that change the numbers through the semantic layer: layer parameters re-priced in the engine, or range selections on stored per-row values.

## When

Planners, policy tuning, scenario analysis: whenever the user asks "what if".

## How

- **Range selections:** a slider writes a `between` selection on a stored ratio into a policy group. Governed counts then show what passes. One group per rule, each holding only that rule's breach range, gives breaches per rule with no maths in the app.
- **Layer parameters:** measures with parameters, set per object through view-state parameters.
- **In-app scenarios:** when the maths is a model rather than an aggregate (DCF, projections), run a deterministic engine over governed inputs (see in-app-calc-engine).

## Gotchas

- References to parameterised measures from derived measures stick at the defaults; inline the formula.
- Express strict inequalities as `between` with epsilon bounds.

## Examples

- lending-affordability — sliders as range selections: [app.js:208](../examples/lending-affordability/project/src/app.js#L208), rule groups at [app.js:227](../examples/lending-affordability/project/src/app.js#L227)
- portfolio-os — scenario sliders: [scenario.js:56](../examples/portfolio-os/project/src/pages/scenario.js#L56)
