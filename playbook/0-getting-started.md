# 0. Getting started

From nothing to an agent that can read your semantic layer and run an app. Do this once per
machine; then the loop starts at [step 1](1-read-the-layer.md).

Commands and package names change. The Astrato docs are the source of truth:
[getting started](https://docs.astrato.io/getting-started/), [CLI](https://docs.astrato.io/cli/),
[Data App quickstart](https://docs.astrato.io/astrato-apps/), [MCP client setup](https://docs.astrato.io/mcp-client-setup/),
[skills](https://docs.astrato.io/skills/). What follows was checked against them in 2026-11.

## What you need

- An Astrato tenant, with MCP and Data App publishing enabled for it.
- A **published** semantic layer over your data in Snowflake (or another supported warehouse).
  A draft exposes nothing to query. If the data has no layer yet, [build one](build-the-layer.md)
  first through Astrato.
- Nothing in this playbook asks you to create data. Build on what is in the warehouse.
- Node.js 24.18 or later, below 25.
- A coding agent that supports skills and MCP (Claude Code, Codex).
- Chrome, for the [verification kit](../kit/README.md).

## 1. Install the skills

Download the folders in `skills/` from [astrato-io/astrato-skills](https://github.com/astrato-io/astrato-skills)
and copy each complete folder into your project: `.claude/skills/` for Claude Code,
`.agents/skills/` for Codex. Restart the agent.

## 2. Connect the agent to the Astrato MCP server

The server is `https://<your-host>/mcp`, where `<your-host>` is the origin you sign in to
Astrato at. With a personal access token in the `ASTRATO_PAT` environment variable, for Claude Code:

```sh
claude mcp add --transport http --scope user astrato https://<your-host>/mcp --header 'Authorization: Bearer ${ASTRATO_PAT}'
```

The token needs at least `sl:read` and `data:query` to read and profile a layer; add `sl:write`
and `sl:version` to change and publish one, and `publication:read publication:write` to manage
published apps. Then ask the agent to call `astrato_get_context` and check `auth.scopes`:
a connection that can read metadata but not query data will stall step 1.

## 3. Install the CLI and sign in

Install it into the project you create in step 4, as a dev dependency. From that project:

```sh
npm install --save-dev @astrato-io/cli@latest
npx astrato --version
npx astrato login      # run this yourself; it opens a browser approval
npx astrato status
```

Sign in yourself. An agent should never run the login, handle its code or ask for a token.

Run the CLI as `npx astrato …` from the project, or `node <project>/node_modules/@astrato-io/cli/dist/bin.js …`.
Node itself must be on the PATH of the shell your agent uses; check with `node --version` before
anything else.

**The MCP server's instructions say `npm install -g @astrato-io/cli@latest`.** Both get the same
CLI. This playbook installs it per project so each app records the CLI it was built with
(0.2.0 or later for `snapshot`); a global install that is already up to date also works. Pick
one and use it for every command.

## 4. Create the project

The CLI configures an existing front-end project; it does not scaffold one. Check what yours
offers with `npx astrato --version` and `npx astrato init --help`. This page was checked on
**CLI 0.2.0** (2026-11-18), which added `init --template dashboard` and `astrato snapshot`.

### Recommended: the examples' layout

```sh
npm create vite@latest my-app -- --template vanilla
cd my-app
npm install
npm install @astrato-io/app-runtime @astrato-io/visualizations
npm install --save-dev @astrato-io/cli@latest
npx astrato --host <your-origin> init . --semantic-layer-id <your-layer-id>
npx astrato --host <your-origin> validate .
npx astrato --host <your-origin> dev . --no-open
```

This installs the current packages (visualizations and app-runtime 0.9 as of 2026-11). All 15
examples are plain JS modules on Vite, so their techniques (selection groups per tab, KPI change
rows, workflows, Excel packs, what-if, report builder) copy across without translation, and the
examples judged against the rubric were built this way.

**How this relates to the MCP server's instructions.** They say to start "in a Vite vanilla-ts
project, not a React one" and to add `--template dashboard` when `astrato init --help` lists it.
That template writes a React + TypeScript page frame (about 3,400 lines). The playbook's route
differs in two ways, on purpose:

- **Vite's `vanilla` template, not `vanilla-ts`.** The same Vite starter, in JS, because the
  examples are JS. If you prefer TypeScript, use `vanilla-ts`, delete its starter files
  (`src/main.ts`, `src/counter.ts`, `src/style.css`) and port what you copy to TS. Do not mix
  the two.
- **No `--template dashboard`.** In one test run (CLI 0.2.0, 2026-11-18) porting the examples'
  techniques into the template's React components took about the time the template saved, the
  app scored no higher, and the template needed two bug fixes first. The MCP server's
  `designBrief` names the template's helpers (`Masthead`, `KpiCard`, `useFigures`, `chartLook`):
  without the template they do not exist, so build the same page hierarchy from native objects
  ([KPI cards](4-build.md#3-kpi-cards), [layout](4-build.md#6-layout-and-look)).

What the MCP server's instructions require still holds: a Vite project that is not a React
starter, the CLI's `init` and `dev`, and every chart drawn with `@astrato-io/visualizations`
(never SVG, canvas or CSS). Use the
template only when the user asks for it; then follow the next section.

- **`semantic-layers list` and `semantic-layers describe <id>`** are in CLI 0.2.0 (0.1.3 had
  only `visibility`): `describe` prints the stored measures and dimensions with their
  descriptions. It does not profile data, so [step 1](1-read-the-layer.md) still reads and
  queries the layer over MCP.

### With the template

Only when the user asks for CLI 0.2.0's `--template dashboard`. The standard is the same: the [playbook](README.md), the [rubric](rubric.md) and the
[kit](../kit/README.md), which the template does not include.

```sh
npm create vite@latest my-app -- --template vanilla-ts
cd my-app
npm install
npm install --save-dev @astrato-io/cli@latest
npx astrato --host <your-origin> init . --semantic-layer-id <your-layer-id> --template dashboard
```

`init` writes `src/main.tsx`, `App.tsx`, `astrato.ts`, `kit.tsx`, `kit.css`, `styles.css`,
`look.tsx`, `look.css`, `figures.ts`, `index.html` and `tsconfig.json`, then prints what to do
next. Do all of it, and then:

1. **Remove the vanilla-ts leftovers** it does not touch: `src/main.ts`, `src/counter.ts`,
   `src/style.css` (and the starter's `src/assets/` if nothing uses it). The build script is
   `tsc && vite build`, so every stale `.ts` file is type-checked on each build.
2. **Install what `init` prints**: `npm install @astrato-io/app-runtime@^0.9.0
   @astrato-io/visualizations react react-dom` and `npm install -D @types/react @types/react-dom`.
3. **Replace every `TODO`** in `src/App.tsx`: the constants take the layer's stored names (a
   measure, its stored comparison, a date dimension, a category dimension), taken from
   [step 1](1-read-the-layer.md); the masthead, KPI, panel and source text take this app's copy,
   and the filter row gets one filter per dimension people slice by.
4. **Design the look for the brief.** Keep the token names in `src/styles.css` (`--page`,
   `--accent`, `--series-1`, …: the components read them), but replace the grey placeholder
   values with this app's palette, type and frame. Do not reuse the template's page frame
   unchanged for every app: page structure follows the app's story (rubric
   [D1](rubric.md), bespoke structure).
5. **Fix two template bugs before the first mount** (CLI 0.2.0): `item(ref)` in `kit.tsx` hands
   operations a compiled ref whose extra keys strict payloads refuse
   ([fix](../knowledge/cli-and-publishing.md#template-operations-are-refused-with-invalid-payload)),
   and `figures.ts` sends integer selections as `number`, which blanks every KPI after a click
   on an integer field ([fix](../knowledge/cli-and-publishing.md#template-kpis-go-blank-after-a-click-on-an-integer-field)).
6. **Wire in the playbook kit.** Copy `kit/verify/app-state.js` into `src/` and call
   `appState.declare(id, tab)` where `useChart` (and `QuestionChart`) start a mount, and
   `appState.settle(id, status, r)` where they read `handle.ready` (or from their state
   callbacks); log queries with `appState.query` in the `engine.getData` wrapper `astrato.ts`
   already installs. Move the chart definitions and operations out of the TSX into a plain
   module and write a [compile adapter](../kit/README.md#a-compile-adapter-for-a-template-app)
   over it, register the selection check, and run the [smoke test](../kit/README.md#2-run-the-smoke-test).
7. Add the `vite.config` below, then `npx astrato --host <your-origin> validate .` and
   `npx astrato --host <your-origin> dev . --no-open`.

What the template does not give you, and the rubric still asks for:

- **Native KPI values.** `KpiCard` renders the value and the change as HTML text, which does
  not meet rubric [A2](rubric.md). Put a native `number` with a comparison measure in the card
  ([KPI pattern](../patterns/kpi-sparkline-comparison.md#in-a-template-app)).
- **One selection group per tab.** The template passes one `group` to the whole page; mirror
  per tab ([preload tabs](../patterns/preload-tabs.md#per-tab-groups-in-a-template-app)).
- **An Excel pack and a query scheduler**: see [build](4-build.md#5-tabs-groups-and-mount-order)
  and [deliverables](4-build.md#7-deliverables-that-make-it-a-product).

### Either way

- **`--host` on every command** unless your tenant is on `app.astrato.io`, the default.
  `astrato.json` does not record the host, so a command without it silently talks to the default
  and looks like "not signed in".
- **`--no-open`** stops `dev` opening a browser by itself, which is what an agent wants. Run it in
  the background; its output is buffered, so wait for the sign-in line rather than reading at once.
- **Pre-bundle the Astrato packages** so Vite does not re-optimise mid-session. When it does, the
  dev proxy serves 502 for the old chunk URLs and charts fail with *"Failed to fetch dynamically
  imported module"*. In `vite.config.js`:

  ```js
  export default { optimizeDeps: { include: ['@astrato-io/app-runtime', '@astrato-io/visualizations',
    '@astrato-io/visualizations/operations', '@astrato-io/visualizations/definitions',
    '@astrato-io/visualizations/metadata'] },
    // The smoke test writes shots/ inside the project: watching it would reload the page mid-run.
    server: { watch: { ignored: ['**/shots/**'] } } };
  ```

- **`astrato snapshot` for a quick look** (CLI 0.2.0): `npx astrato --host <your-origin>
  snapshot . --out shots/quick` runs the app headless at 1440×900 and 390×844, saves
  `desktop.png` and `phone.png` and reports each `data-object-id` element's state, failed
  requests, console and page errors, and sideways scroll (`--timeout <s>` per screen size,
  default 30; `--browser <path>` for another Chrome, Chromium or Edge). Use it after every change. It does **not** replace the kit's
  [smoke test](../kit/README.md#2-run-the-smoke-test): no 1280 or 1024 widths, no selection or
  export checks, no query counts, no app checks.

Open the sign-in URL that `astrato dev` prints, not the raw dev-server URL. Take the layer id
from the MCP server (`astrato_semantic_layer_list`); never invent one.

## 5. Point the agent at this playbook

The repository is public: cloning or downloading it needs no access request or token.
Clone it beside your project (or into a subfolder of it, such as `_ref/`, when the
agent must stay inside one folder; keep it out of the build). On Windows a full clone into a
deep folder can fail with *"'$GIT_DIR' too big"*: clone shallow into a short path
(`git clone --depth 1 -c core.longpaths=true https://github.com/astrato-io/astrato-data-app-playbook C:\src\playbook`),
or download the repository's tarball. Or give the agent the URL. Then say:

> Build an Astrato App on semantic layer `<id>` for `<who>` to `<decide what>`. Follow
> https://github.com/astrato-io/astrato-data-app-playbook and verify it with its kit. Tell me what isn't done yet.

Naming the person and the decision matters: it is the first thing [step 2](2-brief.md) needs.

## Versions: read this before copying from an example

The examples in this repo run on the public `@astrato-io/…` packages and pin the visualizations
version they were tested on: 12 pin `^0.9.0`, three (lending-affordability, portfolio-os,
revenue-war-room) still pin `^0.8.0`. They were first built on older versions, and npm now
serves 0.9. So:

- **Build a new app on the current packages** (0.9 in 2026-11), and say which version in your app. An example's
  `package.json` is a record of what it was tested on, not a recommendation.
- **Treat workarounds as dated.** Every [knowledge](../knowledge/README.md) entry and every
  example caveat names the version it was verified on. Before copying a workaround, check
  whether your version still has the problem.
- Each example's `npm run compile-check` is a quick way to see whether its tiles still compile on
  a newer version: change the version, install, and run it.
