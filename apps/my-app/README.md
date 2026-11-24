# Trading Desk

The commercial director's monthly sales review on the **Trading Company (1)** semantic layer
(`0d660155-d8fe-46ac-bb33-483b4e18a021`). Plain JS on Vite, `@astrato-io/app-runtime` 0.10,
`@astrato-io/visualizations` 0.11, CLI 0.4.1. Design: [DESIGN.md](DESIGN.md). Data brief:
[docs/data-brief.md](docs/data-brief.md).

```sh
npm install
npx astrato login            # you approve the device in your browser
npx astrato dev . --no-open  # open the sign-in URL it prints
npm run compile-check        # offline: every tile compiles against the installed library
```

In a cloud container, run the CLI with `NODE_USE_ENV_PROXY=1` so Node's fetch uses the proxy.

## Layer work (published as revision 3)

- 2 time axes (`Review Month`: latest month, as of the last order date; `Trailing 12 Months`),
  9 field dimensions, 27 measures (base measures and their this-month / same-month-last-year / YoY
  families, compared at a −12-month offset), 21 stored business questions, one per object.
  Generators: `tools/layer-items.mjs`, `tools/questions.mjs`.
- No existing item was changed.

## Status (2026-11-24)

| Check | Result |
| --- | --- |
| Layer validate | 0 errors, 0 warnings (rev 2), published rev 3 |
| Stored questions | All 21 present; 5 executed over MCP with the expected figures |
| Reconciliation | Gross sales by category sum = total (1,354,458.59); 830 orders = sum of delivery statuses; drivers' changes sum to −$660.88 = $37,637 − $38,298 |
| Compile check | 37 of 37 tiles, against a **stand-in** field catalogue |
| `vite build` | Passes |
| Live run, screenshots, smoke test, selection checks, query counts | **Not run**: the CLI device login was never confirmed (see below) |

The app registers 7 checks of its own for the smoke test (selections on every tab, the move across tabs, the dropped month
click, no stale text, the empty state, the Excel pack) and an export probe; none has run yet.
