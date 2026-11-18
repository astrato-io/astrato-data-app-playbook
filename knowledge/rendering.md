# Rendering, sizing and verification

Why a mounted object shows nothing, freezes the page or comes back magnified, and how to verify
an app when the browser is hidden or headless.

---

## Charts are `mounted` but blank, or boot hangs with no error

- **Symptom:** `mount=mounted`, the data request returned 200, `handle.ready` never resolves, the
  surface holds only an empty wrapper; tables blank too. Or the app never gets past compiling.
- **Cause:** the document is hidden (background tab, minimised window, hidden embedded browser
  pane). A hidden document gets no rendering opportunities, so `requestAnimationFrame`,
  `ResizeObserver`, `IntersectionObserver` and `requestIdleCallback` callbacks never arrive.
  Charts measure their container through them, and compilation waits on idle callbacks for some
  fields. Browsers also clamp timers in hidden tabs (a staggered mount ran at about one tile per
  minute; later about 90 s per query).
- **Fix:** check `document.hidden` before debugging anything. Verify in a visible window. As a
  console-only diagnostic, shim those four APIs with `setTimeout` and re-import the entry module;
  never ship the shim, and reload afterwards (left in, it suppressed animation and resizing). A
  test tab with `innerWidth 0` stalls the same way: open a fresh one.
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/11.
- **See also:** [../patterns/preload-tabs.md](../patterns/preload-tabs.md).

## `handle.ready` never settles

- **Cause:** besides a hidden document, throttled metadata preloads (`failed to preload field
  metadata`, `Astrato is rate limiting requests`): the chart mounts and never paints.
- **Fix:** always `Promise.race` `handle.ready` with a timeout (~8 s); never put theming behind an
  un-raced await; check the console for rate limiting before touching the definition.
- **Verified on:** visualizations 0.4.0, 2026-09.

## `rendered` does not mean the numbers are there

- **Symptom:** a screenshot right after `rendered` shows empty or zero values; KPI numbers read `0`
  or `0.0%`.
- **Cause:** values arrive after the render event; `number` objects count up on animation frames,
  so they read 0 while the document is hidden.
- **Fix:** wait for the stagger window plus a margin; assert on engine responses or the vSpec, not
  on early screenshots.
- **Verified on:** visualizations 0.4.0, 2026-09.

## Canvas text passes every text check

- **Cause:** `bar`, `line`, `gauge` and `table` paint labels, marks and legends to a canvas; an axis
  full of epoch numbers passed every DOM probe.
- **Fix:** assert on the vSpec after theming (dimension `formatter.format.formatType`, axis
  `showLabels`, `dataLabels.show`) and screenshot one chart of each kind before calling it done.
- **Verified on:** visualizations 0.4.0, 2026-09.

## The page freezes after a while, and charts return magnified

- **Symptom:** "super slow after a while"; long animation frames of tens of seconds; charts in
  other tabs reappear enlarged after the browser tab was inactive.
- **Cause:** charts mounted at 0×0 inside `display: none` panes make the render loop spin.
- **Fix:** hide inactive panes off-screen instead:
  `position: fixed; left: -40000px; width: var(--pane-w); visibility: hidden`, with `--pane-w`
  taken from the active pane and updated on resize and `visibilitychange`. Diagnose with
  `performance.getEntriesByType('long-animation-frame')`. A `visibility: visible` child escapes a
  hidden pane.
- **Verified on:** visualizations 0.5.2, 2026-11.
- **See also:** [../patterns/preload-tabs.md](../patterns/preload-tabs.md).

## Charts vanish and reappear on resize

- **Cause:** the app remounts objects when their container resizes. Charts follow their container
  by themselves (every canvas shrank with its box, no new query).
- **Fix:** give each container a definite size and never remount on resize. Only a table whose
  column widths you set in pixels needs work: push new widths with
  `runtime.updateInstance(id, { vSpec })`.
- **Verified on:** visualizations 0.4.0, 2026-09.

## A chart has zero height, or grows without limit

- **Symptom:** nothing paints and only a container-size warning appears; or a slot grows to
  thousands of pixels.
- **Cause:** a surface inside a non-stretched grid/flex item, or one with only `min-height`, is
  0 px tall; `flex: 1; height: auto` feeds back through the chart's 100% height.
- **Fix:** give the chart element a fixed height (or `flex: 1 0 auto` inside a sized column).
  `.card .viz-surface { flex: 1 }` ignored `height`.
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/11.

## Animations never play

- **Cause:** the standalone host in 0.4.0 hard-codes the capability `animable: false`, which
  disables animations; 0.4.0 animated lines only.
- **Fix:** upgrade: 0.5.2 sets `animable: true` and adds bar, label and heat-map presets, on by
  default with no operation. On 0.4.0 the flag can be patched in the vendored entry (fail loudly if
  the line changes). Keep selection syncs as in-place diffs so presets are not interrupted.
- **Verified on:** visualizations 0.4.0 and 0.5.2, 2026-09.

## Mounting during a selection change shows stale or doubled results

- **Fix:** let selections settle, then `updateInstance`; never refit a table before its first
  render. Apply default selections before objects mount.
- **Verified on:** visualizations 0.4.0, 2026-09.

## Debugging tools that work

- Schemas and operations: `getVisualizationMetadata` / `getVisualizationDefinitionDescriptor`
  exposed on `window` in dev (local, no requests).
- Runtime logs: `localStorage.dev_tools_enabled = 'true'` (can stall the tab; turn it off after).
- What a chart really holds: walk the React fiber for `memoizedProps.fields`.
- Query log: wrap `engine.getData` and record requests, filters and row counts per click.
- Expose mounted instances, failures and timings on `window` (e.g. `window.__astrato`) so smoke
  tests and consoles can read them.
- Rapid reloads trip the tenant rate limiter for minutes: batch edits into one reload.
- **Verified on:** visualizations 0.4.0–0.5.2, 2026-09/11.
