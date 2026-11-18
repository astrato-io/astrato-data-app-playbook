# Velmora · Pipeline War Room

A standalone, hand-built Astrato App over the "Four Businesses (demo)" semantic
layer. Data: Snowflake `ASTRATO_GALLERY.MOCK_DATA.NB_*`.

Pages (one screen each, a Salesforce-style light design):

- **Command** — Q4 gap meter (won · commit · best case · pipeline against target), the four
  forecast categories with week-over-week change and snapshot sparklines, the four regions as
  clickable cards, the forecast bridge, the weekly trajectory with mean ± σ lines.
- **Deals** — the gap closer (highest recovery score first, until the gap is covered), the
  recovery list with activity sparklines, and a deal drawer: facts, activity timeline, actions.
- **Coaching** — pick a rep: five rep-vs-team-average cards, forecast vs quota for every rep,
  activity mix, pipeline by stage, daily activity, deals in flight.
- **Forecast call** — each rep's commit and best case, typed in by managers, rolled up against
  the system forecast and the target; submitted to the decision log.
- **Trends** — win rate and deal size, bookings by quarter (mean ± σ), competitors, products.

Files: `src/app.js` (pages, governed queries, writeback), `src/objects.js` (the objects and their
path from definition to mounted vSpec), `src/charts.js` (chart definitions), `src/styles.css`,
`src/lib/*` (field lookup, theme operations), `tools/compile-adapter.mjs` (offline compile check).

```sh
npm install
npm run compile-check
npm run build && npx astrato validate .
```
