# Kit

Tools an app adopts as they are. Unlike the examples, which you read and adapt, these files are
meant to be copied unchanged. Each was verified on the versions noted in its header.

## verify/ — prove the app works before anyone sees it

| File | What it is |
| --- | --- |
| [verify/app-state.js](verify/app-state.js) | The contract: a 60-line module your app imports to report its tabs, objects, queries, timings and its own checks on `window.__appState` |
| [verify/compile-check.mjs](verify/compile-check.mjs) | The offline check: compiles every tile and applies its operations against the installed library, with no session or browser |
| [verify/ops.mjs](verify/ops.mjs) | Operation lookup: lists every operation for a chart type, or prints the ones you name |
| [verify/smoke.mjs](verify/smoke.mjs) | The smoke test: opens the app in Chrome and fails on anything a viewer would see |
| [verify/xlsx-diff.mjs](verify/xlsx-diff.mjs) | Compares two Excel exports sheet by sheet: which sheets did not change under a filter |
| [verify/release.mjs](verify/release.mjs) | The release gate: build → smoke locally → publish → smoke the live copy |
| [verify/fixture/](verify/fixture/index.html) | A stand-in page for trying the smoke test; `?fail=1` breaks it in every way the test checks |

These implement [playbook step 5](../playbook/5-verify.md) and [step 6](../playbook/6-release.md).
They need Node 24.18 or later (the same as the Astrato CLI) and Chrome. Only the compile check
needs a package (`jsdom`).

### 0. Compile check, before any browser

```sh
npm install --save-dev jsdom
node kit/verify/compile-check.mjs tools/compile-adapter.mjs        # every tile
node kit/verify/compile-check.mjs tools/compile-adapter.mjs all    # and print the settings that took effect
```

The adapter is a small module of yours exporting a field catalogue (best: the real one, saved by
the smoke test as `available-fields.json`; otherwise a stand-in, where dimension and calculation
entries must not carry `dataType`), your tile declarations, and the same `prepare` function the app uses before mounting; the file's header
shows the shapes. Make `prepare` run the app's real path, including whatever resolves an
operation's target from the compiled definition: an adapter that skips that step reports
operations as accepted when they were never applied. Verified on visualizations 0.8.0, where a 26-tile app compiled in seconds.

A `WARN` line marks a static filter (definition `filterGroup`/`filters`, or `setStaticFilterGroup`)
on a field whose catalogue type is not a string: a field's `dataType`, or a dimension's
`item.dimension.resultType`. Warnings do not change the exit code. With `equals`, `doesNotEqual`,
`inList` or `excludedFromList` it reads "0.9 renders this object as an error": seen in a test run
on 0.9.0 (2026-11), where `inList` on an `int` field compiled and `handle.ready` then resolved to a
bare `{ status: 'error' }`. `isBetween` on a number field gets no warning: on an `int` Year it
rendered on 0.9.0 (2026-11-18), so a range is the way to filter an integer. Other range operators
and date or time fields get a softer warning, as they were not confirmed either way on 0.9 (a
date static filter was silently dropped on 0.4–0.5): check that object in the browser. Fix: filter
a string field (`Fiscal Year = FY2026`, not `Year = 2026`), or use a range on the integer. A stand-in entry with no type is not checked.

#### A compile adapter for a template app

CLI 0.2.0's dashboard template writes each chart's `definition={(field) => …}` and
`operations={(item) => […]}` inline in TSX, which Node cannot import. Move them into one plain
module that both the components and the adapter import. A run on the template already kept its
stored questions in a plain `src/catalogue.js` that the TSX imported; put the chart definitions
and operations there too, keyed by object id:

```js
// src/tiles.js — plain JS (tsconfig "allowJs": true), no React, no DOM reads at import
export const TILES = {
  'pulse-drivers': {
    view: 'Sales',
    definition: (field) => ({ version: 1, type: 'bar',
      data: { dimensions: [{ ref: 'line', fieldKey: field('Product Line') }],
              measures: [{ ref: 'change', fieldKey: field('Sales Change vs PM') }] } }),
    operations: (item) => [{ name: 'setBarChartLayout', payload: 'groups' }, ...barLook([item('change')])],
  },
};
// In the TSX: <Chart astrato={astrato} id="pulse-drivers" group={group} {...TILES['pulse-drivers']} />
```

Operation helpers the tiles call (`chartLook`-style builders) move to a plain module too, or
their operations go unchecked; a helper that reads a CSS token gets nothing under jsdom, so give
it a fallback value. Move the template's field lookup (`fieldKeyByName` in `kit.tsx`) there as
well, so app and adapter resolve names the same way. The adapter is then short:

```js
// tools/compile-adapter.mjs
import { readFileSync } from 'node:fs';
import { createDefaultVSpec } from '@astrato-io/visualizations';
import { compileVisualizationDefinition } from '@astrato-io/visualizations/definitions';
import { applyOperations } from '@astrato-io/visualizations/operations';
import { TILES, fieldKeyByName } from '../src/tiles.js';

export const fields = JSON.parse(readFileSync('shots/smoke/available-fields.json', 'utf8'));
export const tiles = Object.entries(TILES).map(([id, t]) => ({ id, ...t }));
const keys = (x) => ({ dataItemInternalKey: x.dataItemInternalKey, dataItemUniqueSignature: x.dataItemUniqueSignature });

export async function prepare(tile, fields) {
  const definition = tile.definition(fieldKeyByName(fields, tile.view));
  const c = await compileVisualizationDefinition({ definition, availableFields: fields, baseVSpec: createDefaultVSpec(definition.type) });
  if (!c.success) throw new Error(`definition refused: ${JSON.stringify(c.issues)}`);
  let vSpec = c.vSpec;
  const refusals = [];
  for (const [i, op] of (tile.operations?.((ref) => keys(c.resolvedRefs[ref])) ?? []).entries()) {
    try {   // one at a time, as the template's finish() applies them
      const step = await applyOperations({ availableFields: fields, instance: { id: tile.id, type: definition.type, vSpec }, operationRequests: [{ id: `op-${i}`, ...op }] });
      vSpec = step.vSpec;
      refusals.push(...Object.values(step.results).filter((r) => !r.success).map((r) => ({ op: op.name, ...r })));
    } catch (e) { refusals.push({ op: op.name, error: String(e) }); }
  }
  return { vSpec, refusals };
}
```

`keys(…)` is the same two-key reduction the template's `kit.tsx` needs
([why](../knowledge/cli-and-publishing.md#template-operations-are-refused-with-invalid-payload)).
Call `appState.fields(availableFields)` once in `astrato.ts` so the smoke test saves the real
catalogue the adapter reads. Run it from the app folder. Shape checked against the template's
`kit.tsx` (CLI 0.2.0, 2026-11-18); not yet run end to end on a template app.

### 1. Wire the contract into your app

Copy `app-state.js` into the app and call it in four places:

```js
import { appState } from './app-state.js';

appState.tab('overview', () => showTab('overview'));       // each tab, in order
appState.declare('kpi-revenue', 'overview');                // each object, before mounting
appState.declare('filter-region', null);                    // null = on every tab (filters, bars)
runtime.mount(slot, id).then((h) => h.ready)
  .then((r) => appState.settle('kpi-revenue', r?.status, r))
  .catch((e) => appState.settle('kpi-revenue', 'error', e));
appState.query(request, ms, fromCache);                     // in your engine.getData wrapper
appState.mark('landing-ready');                             // when the first tab is usable
```

**On CLI 0.2.0's dashboard template** (React + TS) the same calls go into its `kit.tsx`:
`declare` where `useChart` and `QuestionChart` start a mount, `settle` where they read
`handle.ready` (or in their state callbacks), and `query` inside the `engine.getData` wrapper
`astrato.ts` installs. The template has no app checks, compile adapter or query log of its own.
`astrato snapshot` is a quick look, not a substitute for the smoke test below.

Then register the checks only your app can make. The selection test from the playbook is the
one every app should have. Read each object the way it is drawn: numbers and tables are HTML, so
their `innerText` changes; bars, lines, combos and heat maps are canvas, whose `innerText` never
changes, so compare the rows the mounted handle's `getData()` returns instead. Compare rows
only: each export also carries a fresh `queryID` and the SQL it ran, so comparing the whole
result reports "not restored" every time:

```js
const handles = new Map();                        // id -> the handle runtime.mount resolved to
const rows = (r) => r?.data?.response?.data ?? r?.data?.data ?? null;   // rows only: no queryID, statement, metadata
const read = async (id) => ['number', 'table'].includes(typeOf(id))   // typeOf: your tile list
  ? document.querySelector(`[data-slot="${id}"]`).innerText
  : JSON.stringify(rows(await handles.get(id).getData({ limit: 200 })));
const snap = (ids) => Promise.all(ids.map(read));

appState.check('Selecting a region changes a KPI, a chart and a table; clearing restores them', async () => {
  const ids = ['kpi-revenue', 'bar-region', 'tbl-orders'];
  const before = await snap(ids);
  const q0 = window.__appState.queries.length;
  await selectValue('Region', 'West');            // through the app's real selection path (below)
  await appState.quiet();                         // queries done, tables repainted
  const sent = window.__appState.queries.length - q0;   // count before reading: getData runs a query
  const during = await snap(ids);
  await clearSelections();
  await appState.quiet();
  const after = await snap(ids);
  const pass = ids.every((id, i) => during[i] !== before[i] && after[i] === before[i]);
  return { pass, detail: `${ids.map((id, i) => `${id}: ${during[i] !== before[i]}`).join(' ')}; ${sent} queries` };
});
```

`getData()` runs the chart's own export query (visualizations 0.9.0), so take any query count
before calling it, or leave those calls out of your query log, or the check counts its own reads.

If the check writes the selection itself, write it as a chart click does: operator `inList` and a
top-level `fieldKey` on the raw column. With `{ field, values }` alone the charts still filter, but
every `getData()` export query (and an Excel report built from them) sends a filter with no
operator and gets HTTP 400, and a table can stay blank until reload
([knowledge](../knowledge/selections.md#every-chart-in-a-group-returns-http-400-after-a-selection-set-in-code)):

```js
const selectValue = (name, value, group = 'g-overview') => {   // the visible tab's group
  const fieldKey = availableFields.find((f) => f.kind === 'field' && f.name === name).fieldKey;
  selections.selectValues(group, { fieldKey, field: { fieldKey }, kind: 'VALUE', operator: 'inList', values: [value] }, { state: 'applied' });
};
```

A check that drives a React control (the template's forms, a workflow's inputs) must set the value
through the element's native setter and fire `input` and `change`: assigning `el.value` alone is
overwritten by React on the next render and never reaches its `onChange`:

```js
const setField = (el, value) => {
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
};
```

### 2. Run the smoke test

```sh
node kit/verify/smoke.mjs "<the sign-in URL printed by astrato dev>" --widths 1440,1280,1024
```

It fails on: a boot error or sign-in redirect; any object that does not settle as `rendered`
(objects declared after landing, such as tabs that preload or mount on first visit, are checked
when the sweep first shows their tab: `objects` in the report is the landing count, `objectsAll`
every object checked);
an app check that does not finish within `--check-ms` (default 60 s, so one stuck check cannot
hang the run); a page that stops answering, or reloads under the test (a dev-server reload);
a run longer than `--deadline-ms` (default 40 min);
error text on the page; any request with status ≥ 400; any console error; a slow landing; page
scroll (horizontal always, vertical unless `--scroll-ok`); broken images; and any failed app
check. Before measuring page scroll at each width it waits for the layout to settle (two animation
frames, `appState.quiet`, two more frames) and re-measures a horizontal overflow once after 1.5 s,
so a chart canvas still at the previous width is not reported as scroll; an overflow that persists
fails. It writes one screenshot per tab per width and a `report.json`. Files the app downloads during
its checks (an Excel report, say) land in `downloads/` and are listed in the report; a download
that starts but does not complete fails the run. To test that the Excel export follows the
filters, register `appState.exportProbe({ build, select, clear, exempt })` (see
[app-state.js](verify/app-state.js)). The smoke test then builds the workbook without and with
your filter, from the landing tab so the other tabs are hidden, and fails every sheet whose figures
did not change. That catches hidden tabs exporting unfiltered rows
([pattern](../patterns/xlsx-export.md#sync-every-group-before-reading)). Both workbooks are saved as
`downloads/probe-*.xlsx`; `node kit/verify/xlsx-diff.mjs a.xlsx b.xlsx` runs the same comparison by hand. If the app calls `appState.fields(availableFields)`, the
real field catalogue is saved as `available-fields.json` for the compile check. **Look at the
screenshots**: the test cannot read a canvas, so clipped labels, epoch-number date axes and
lost number formats (a percentage showing as `0` or `1`) are yours to catch. Screenshots stop at
the viewport height (`--height`, 860 px), so on a page that scrolls pass `--full-page` as well: it
also saves `<tab>-<width>-full.png`, the whole page height, so tables and heat maps below the fold
get looked at. It captures the page's own scroll only; a panel that scrolls inside the page shows
just its visible part. Refused theming
operations are usually logged as warnings, which the test does not fail on: surface them through
`appState.settle` or an `appState.check` if you want them caught.

Known benign console messages go in a file passed with `--allow`, one exact substring per line.
Allow by exact text, never by category.

Hosted apps need a session: run once with `--login`, sign in, close the window. The profile is
kept in `<out>/.chrome-profile`, one per output folder, so several apps can be tested at once;
pass `--profile <dir>` to share one (for example, to reuse a hosted sign-in across apps). Gitignore it.

### Running it

- A run at three widths with app checks can take over ten minutes: run it in the background.
- Space repeated runs. Each run sends every query again (one app sent over a hundred per run), and
  several runs within a quarter of an hour were answered with HTTP 429, followed by a visualization
  error, while a run after a pause was clean. Pause between runs, test one width while iterating,
  or cap the app's queries in flight ([query scheduler](../patterns/query-scheduler.md), with 429 backoff).
- Run `astrato validate .` on its own and read its output before starting `astrato dev`: chained
  in front of `dev` in one background command, its output was lost and it appeared to print nothing.
- Do not edit source files during a run: the dev server reloads the page under the test.
- If `--out` is inside the project, tell Vite not to watch it, or every screenshot and profile
  write can reload the page mid-run: `server: { watch: { ignored: ['**/shots/**'] } }` in
  `vite.config.js`.
- Each check has `--check-ms` (60 s by default) to finish. If the page's main thread is stuck,
  the check's own timer cannot fire, so the test gives up on any call into the page after 60 s
  (a check after `--check-ms` + 15 s) and stops with "the page stopped responding". A reload of
  the page stops the run with "the page reloaded during …". `--deadline-ms` bounds the whole
  run; raise it for many tabs at many widths. Every stop is a FAIL with a partial `report.json`,
  never a hang.

### 3. Release through the gate

```sh
node kit/verify/release.mjs --local "<local sign-in URL>" --publication <id> --live <live URL>
```

It stops at the first failure. A failure before publish leaves the live app untouched; a
failure after it tells you the new version is live and broken. Keep the publication id and
live URL in a gitignored `publication.local.json`, never in a public repository.

### Try it without an app

```sh
npx serve kit/verify            # or any static server
node kit/verify/smoke.mjs http://localhost:3000/fixture/index.html          # PASS
node kit/verify/smoke.mjs "http://localhost:3000/fixture/index.html?fail=1" # FAIL, seven reasons (incl. a sheet that ignores the filter)
```

## What is not in the kit

Page code. Helpers that vary by app (the query scheduler, the selection bar, the Excel writer,
the connectivity wrapper) are shown in [patterns/](../patterns/) with links to the examples
that implement them: copy those from an example and adapt them.
