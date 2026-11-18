# Preloaded tabs

Mount every tab up front: the visible tab first, then the others in the background, so switching tabs is instant.

## When

Any multi-tab app. At about a second per query, a tab that starts querying on click sits empty.

## How

1. One pane per tab, kept mounted. Switching only changes which pane is visible.
2. Load the visible tab first, then the rest a few objects at a time; every slot shows "Loading…" until its object reports ready.
3. Hide inactive panes **off-screen**, not with `display:none`: `position: fixed; left: -40000px; width: var(--pane-w); visibility: hidden`, with `--pane-w` taken from the active pane.
4. Give each tab its own selection group, mirrored from `main` only while visible, so a click re-queries only what is on screen.

## Gotchas

- Charts mounted at 0×0 (`display:none`) freeze the page and come back magnified.
- Charts never paint while the document is hidden (background tab, a hidden browser pane). Check rendering in a visible window, or with the kit's smoke test, whose headless Chrome does paint.
- A mount queue that waits for each object's `ready` before the next starves in exactly that case; see [query scheduler](query-scheduler.md).

## Per-tab groups in a template app

CLI 0.2.0's dashboard template hands one `group` to the whole page. Give each tab pane its own
group (`main-<tab>`) and keep the selection bar and filters on `main`. Mirror both ways, only for
the visible tab, and compare a sorted signature first so a mirror does not echo back as a change:

```js
const sig = (applied = []) => JSON.stringify(applied.map((s) => [s.fieldKey ?? s.field?.fieldKey, [...(s.values ?? [])].sort()]).sort());
const copy = (from, to) => {
  const { applied = [] } = selections.getSelection(from) ?? {};
  if (sig(applied) !== sig(selections.getSelection(to)?.applied)) selections.setNewSelectionState(to, { applied, pending: [] });
};
selections.onActiveSelectionChange('main').subscribe(() => copy('main', `main-${visibleTab}`));
for (const tab of TABS) selections.onActiveSelectionChange(`main-${tab}`).subscribe(() => { if (tab === visibleTab) copy(`main-${tab}`, 'main'); });
// On a tab switch: copy('main', `main-${visibleTab}`) before showing the pane.
```

Seed each tab's group from `main` before its pane preloads. Hidden tabs then cost nothing on a
click and catch up once, when shown.

## Examples

- revenue-war-room — visible first, then three lanes: [app.js:561](../examples/revenue-war-room/project/src/app.js#L561)
- lending-affordability, portfolio-os — every tab mounted at start
