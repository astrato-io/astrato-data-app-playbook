# In-app calculation engine

Pure, deterministic functions for maths the semantic layer cannot express (XIRR, DCF, scenario projections, validation rules), run over governed inputs.

## When

Only when the calculation is a model rather than an aggregate. Everything that is an aggregate belongs in the layer.

## How

Keep the engine in one module of pure functions with no DOM or network. Feed it rows from governed queries, and test it against figures the layer can also compute, so the two never disagree. (In portfolio-os the same module also built the example's fictional data; that part is only for reproducing the example.)

## Examples

- portfolio-os — XIRR, valuation, DCF and scenarios: [engine.js:70](../examples/portfolio-os/project/src/engine.js#L70)
