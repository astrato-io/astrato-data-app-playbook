# Astrato CLI and publishing

`astrato init` and its dashboard template, `astrato dev`, `astrato snapshot`, `astrato build`,
`astrato publish` and the vendored `@astrato/app runtime`. What happens after an app is live is in [hosting.md](hosting.md).

 --

## The dashboard template

- **Question:** what does `astrato init . --semantic-layer-id <id> --template dashboard` write,
  and what does it leave behind?
- **What it writes:** into a Vite `vanilla-ts` project, `src/main.tsx`, `App.tsx`, `astrato.ts`,
  `kit.tsx`, `kit.css`, `styles.css`, `look.tsx`, `look.css`, `figures.ts`, plus `index.html`
  (now loading `/src/main.tsx` into `#root`) and `tsconfig.json` (`jsx: react-jsx`). About 3,400
  lines of React + TypeScript: `kit.tsx` (`useChart`, `Chart`, `SelectionBar`,
  `FilterRow`/`FilterHost`, `ObjectMenu` with CSV, Excel, image, SQL and pin, `QuestionChart`,
  `useNextQuestions`), `look.tsx` (`Masthead`, `KpiRow`, `KpiCard`, `Board`, `Panel`,
  `chartLook`, `filterLook`, `describeChange`, `formatNumber`), `figures.ts` (`useFigures`,
  `cellNumber`). These are the helpers the MCP server's `designBrief` names.
- **What it prints:** `npm install @astrato-io/app-runtime@^0.9.0 @astrato-io/visualizations
  react react-dom`, `npm install -D @types/react @types/react-dom`, read
  https://docs.astrato.io/build-a-data-app-with-an-agent/, replace every `TODO` in
  `src/App.tsx`, and replace the `:root` tokens in `src/styles.css` with a look.
- **Leftovers:** it does not delete the `vanilla-ts` starter (`src/main.ts`, `src/counter.ts`,
  `src/style.css`), and `package.json` keeps `"build": "tsc && vite build"`, so the stale files
  are type-checked on every build. Delete them. No `vite.config` is written.
- **Not included:** app checks, a query log for verification, Excel packs, what-if, workflows.
  Wire in the playbook kit (`app-state.js` from `useChart`'s mount and `handle.ready`, a compile
  adapter, the smoke test) and port techniques from the examples into its components; see
  [getting started](../playbook/0-getting-started.md#with-the-template).
- **Also new in 0.2.0:** `astrato snapshot [path] --out <dir> --timeout <s> --browser <path>`
  (headless run at 1440×900 and 390×844, `desktop.png` and `phone.png`, a report of each
  `data-object-id` element's state, failed requests, errors and sideways scroll: a quick look,
  not the smoke test) and `semantic-layers list` / `describe <id>`. `--host` still defaults to
  `https://app.astrato.io`.
- **Known issues to fix after scaffolding:** `item(ref)` hands operations extra keys
  ([below](#template-operations-are-refused-with-invalid-payload)); integer selections sent as
  `number` ([below](#template-kpis-go-blank-after-a-click-on-an-integer-field)); `useFigures`
  cannot carry a stored question's filters, and a governed dimension key in a hand-added filter
  400s while a raw column key in the flat shape works
  ([below](#template-kpis-ignore-a-stored-questions-filters)); `KpiCard` formats a points change
  as `%`, and `formatNumber` prints "2.0 %"
  ([below](#template-kpi-cards-print-a-points-change-as-a-percentage)). Verified on CLI
  0.2.0, 2026-11-18.
- **Verified on:** CLI 0.2.0, 2026-11-18 (scaffolded and read; not built or run).

## Template operations are refused with "Invalid payload"

- **Symptom:** in a dashboard-template app, operations that target one item are refused at mount
  and logged as console errors: `setColoringOverwrites` refuses `kind` inside `dimension`, and
  every `setMeasureDefinedParameter` fails "Invalid payload".
- **Cause:** `useChart` in `kit.tsx` hands `operations` an `item(ref)` that returns
  `compilation.resolvedRefs[ref]` as is. That compiled ref carries more than the two data-item
  keys, and strict payload schemas refuse the extra keys.
- **Fix:** pass only the two keys. Once, in `kit.tsx`:
  `operations?.((ref) => { const r = compilation.resolvedRefs[ref]!; return { dataItemInternalKey: r.dataItemInternalKey, dataItemUniqueSignature: r.dataItemUniqueSignature }; })`,
  or wrap each `item(...)` in such a helper at the call site. A compile adapter must reduce the
  same way ([kit](../kit/README.md#a-compile-adapter-for-a-template-app)).
- **Verified on:** CLI 0.2.0 dashboard template, visualizations 0.9.0, 2026-11-18 (a test run).
- **See also:** [visualizations.md](visualizations.md#operations-need-data-item-keys-and-fail-with-invalid-payload).

## Template KPIs go blank after a click on an integer field

- **Symptom:** a click on a chart over an integer column (an hour, a year number) blanks every
  KPI and headline that `useFigures` draws; their queries return HTTP 400. Charts still filter.
- **Cause:** `selectionFilter` in the template's `figures.ts` turns every numeric selection value
  into `{ dataType: 'number', valueNumber }`. The runtime refuses that for an `int` column.
- **Fix:** in `selectionFilter`, map numbers on an `int` field (the catalogue entry's `dataType`)
  and on a date part to `{ dataType: 'int', valueInt: value }`; keep `number` for decimals. A bare
  value is also accepted. Test it with a click on an integer field, not only a string filter.
- **Verified on:** CLI 0.2.0 dashboard template, app-runtime 0.9, 2026-11-18 (a test run).

## Template KPIs ignore a stored question's filters

- **Symptom:** a KPI card from `useFigures` disagrees with the chart beside it: the stored
  questions filter to a subset (one location type, one segment), the KPI measures do not, and the
  card silently mixes in the rest.
- **Cause:** `useFigures` sends the current selections only; it has no way to carry a stored
  question's filters. Adding one by hand on a governed dimension key (`[dimension].[…]`) is
  refused with HTTP 400.
- **Fix:** add a `where` option to `useFigures` that appends fixed filters to every query, keyed
  by the **raw column** (`[View].[Column]`) in the flat shape `{ fieldKey, operator, values }`
  ([why](engine-and-queries.md#enginegetdata-returns-400-astrato-rejected-the-runtime-request)).
  Or store a measure with the filter inside it.
- **Verified on:** CLI 0.2.0 dashboard template, app-runtime 0.9, 2026-11-18 (a test run).

## Template KPI cards print a points change as a percentage

- **Symptom:** a KPI whose value is a percentage shows its change as "−0.3%" when the change is
  percentage points; every percentage prints with a space before the sign ("2.0 %").
- **Cause:** `KpiCard` in `look.tsx` formats the change with the value's format, and
  `formatNumber` puts a space before `%`.
- **Fix:** give `KpiCard` a separate `changeFormat` (for example "+0.0 ppt") and use it for the
  change; drop the space before `%` in `formatNumber`. Or use a native `number` object with a
  stored comparison measure, which takes that measure's own layer format.
- **Verified on:** CLI 0.2.0 dashboard template, 2026-11-18 (a test run).

## A second browser gets "The local Astrato browser session is missing."

- **Cause:** `astrato dev` opens the browser with a **single-use** session ticket. A consumed
  ticket cannot be reused.
- **Fix:** run `astrato dev --no-open`; it prints a handshake `open.html`. The
  `/_astrato/v1/session?ticket=…` URL inside it establishes the cookie in whichever browser opens
  it. A static file preview of `open.html` will not run its redirect: extract the URL and navigate
  to it directly. A second person needs a second `dev` process (or the same printed sign-in URL
  while the same process runs, depending on CLI version). Never use the raw framework-server URL.
- **Verified on:** CLI pre-0.1, 2026-09.

## "Unable to reach the Astrato App runtime" mid-session

- **Cause:** the dev session expired, or `astrato dev` stopped. A tab left open on a dead dev server
  keeps retrying queries (`ERR_CONNECTION_REFUSED`), which still count against rate limits.
- **Fix:** reload after a long idle; restart `dev` if that fails; close stale tabs.
- **Verified on:** 2026-09/10.

## What does the CLI need from an app with no bundler?

- `astrato.json` names a `dev` and a `build` script. `dev` only spawns `npm run <dev> -- --host
  127.0.0.1 --port N --strictPort` and polls `GET /`; `build` runs the script and validates the
  output folder. Any static server and a copy step work.
- Never author inside the build output: a second build deletes it (the CLI records ownership).
- The output validator rejects `.map` files, any `sourceMappingURL`, bearer-token-shaped strings,
  `package.json`/lockfiles/`.npmrc`, and service-worker registration.
- Exclude `.bak` files and dumps from the build: one app would have shipped 8.7 MB of old library
  code.
- `@astrato/app-runtime`, `@astrato/sdk` and `@astrato/visualizations` import each other plus
  `rxjs` and `zod` by bare name: use an import map, and flatten `rxjs` and `zod` into one browser
  module each.
- **Verified on:** CLI pre-0.1 and 0.1.1, 2026-09/10.
- **Current status:** none of the examples uses this layout any more; they run on Vite and
  the public packages. See [getting started](../playbook/0-getting-started.md).

## `AstratoAppRuntimeError: Astrato returned an invalid Astrato App bootstrap.`

- **Symptom:** apps that worked stop booting under `astrato dev`.
- **Cause:** since about 2026-10-30 the bootstrap returns the capabilities `procedure:execute` and
  `data:writeback` in addition to the original three; older vendored `app-runtime` copies reject
  every capability they do not know.
- **Fix:** vendor a current hosted-v2 `app-runtime` build that knows all five capabilities (and
  imports the SDK under the package name your vendor folder uses). As a stopgap, extend the
  `ASTRATO_APP_CAPABILITIES` list in the vendored file.
- **Verified on:** 2026-10/11.

## Hosted app: "Runtime route not found. Rebuild older publications for runtime v2"

- **Cause:** the app vendors a pre-v2 `@astrato/app-runtime`.
- **Fix:** vendor `@astrato/app-runtime` 0.2.0 or later (hosted runtime v2) with a matching
  `@astrato/sdk` 0.4.0 bundle, and publish with CLI 0.1.1 or later.
- **Verified on:** app-runtime 0.2.0, CLI 0.1.1, 2026-10.

## Publish commands and their required flags

- `astrato login` is device auth.
- `astrato publications create . --name "…" --idempotency-key <key>`: the key is required.
- `astrato publish . --publication-id <id> --expected-version <v> --idempotency-key <key>
  [--image cover.png]`.
- One publish was seen to bump the version by 2; read the current version before the next publish.
- A publication grants only its creator by default: see
  [hosting.md](hosting.md#signed-in-users-get-not_found-the-publication-or-its-data-is-no-longer-available).
- **Verified on:** CLI 0.1.1, 2026-10/11.

## Publish fails: "requires an enabled, available non-legacy exit node … enable Exit node"

- **Cause:** misleading message; there is no "Exit node" setting in the UI.
- **Fix:** open the data connection's **Details** and pick a **Data Region**. Through MCP, the
  connection's exit node can be configured with the apply-connection tool.
- **Verified on:** CLI 0.1.1, 2026-10.

## `--image` fails with 403, or the cover is ignored

- **Symptom:** the CLI hides the body: "OAuth token is not allowed to access this endpoint"
  (code 11400) on the publication image endpoint; on another run the image stayed null.
- **Cause:** the device-login token is not allowed on that endpoint.
- **Fix:** publish with a personal access token in the CLI's environment, or set the cover in the
  UI afterwards.
- **Verified on:** CLI 0.1.1, 2026-10.

## The publish succeeded but the live app is broken

- **Cause:** the CLI's publish verification reports `application` and `dataQueries` as
  `not_checked`; the build is a plain copy, so it publishes a syntax error happily.
- **Fix:** gate the publish: `node --check` every module (chain with `&&`), build, smoke the local
  build, publish, then smoke the live URL in a fresh signed-out (or non-owner) profile. Fail on any
  object not rendered, any request ≥ 400 other than known benign ones, console errors and slow
  landing.
- **Verified on:** CLI 0.1.1, 2026-10/11.
- **See also:** [hosting.md](hosting.md#a-404-on-datasemantic-layers-on-first-load).

## `astrato build` / `astrato dev` fail on Windows: `Cannot find module …\node_modules\npm\bin\npm-prefix.js`

- **Cause:** an early CLI quoted the package-manager executable inside `cmd.exe /c`, so npm's
  `.cmd` shim resolved its own directory to the project.
- **Fix:** fixed in the CLI on 2026-09-15 (the executable is resolved to a full path). Upgrade;
  do not work around it.
- **Verified on:** CLI pre-0.1, 2026-09.

## Starting many dev servers at once fails

- **Symptom:** auth discovery fails when about a dozen `astrato dev` processes start together.
- **Fix:** start them one after another. Stop a dev server by its port, not by a command-line
  pattern (that kills other projects' servers too).
- **Verified on:** 2026-10.
