# 3. Choose references

The examples exist so that you start from proven techniques rather than from a blank file. It
does not exist so that every app looks like the last one.

## 1. Pick 2–3 examples from catalog.json

Read [catalog.json](../catalog.json) once; do not open every example.

1. **Archetype first.** Filter on the archetype from your brief. An example of the right shape in
   another industry beats a same-industry example of the wrong shape: a command-centre and a
   workbench solve different problems even over the same data.
2. **Then patterns and interactions.** Rank by overlap with what the brief needs: what-if
   sliders, a maker–checker queue, writeback, a drawer, a bridge, an Excel pack.
3. **Then industry and function**, as a tiebreaker for vocabulary and copy.

If no example has your archetype (there are only 15 so far), rank by the patterns and
interactions your brief needs, and design the page structure from the brief alone.

When the request is a flexible, custom or self-service report (the user picks rows, figures,
filters, a period), start from [report-builder](../examples/report-builder/) and the
[report-builder pattern](../patterns/report-builder.md), whatever else the brief needs. Copy its
technique, not its page.

For each pick, read `examples/<slug>/README.md`, then the files in `start_here`. Each
`stealable` entry points at the exact line of a technique. Read `caveats` before copying
anything: a workaround for one library version may be wrong on yours.

The examples run on Vite and the public packages, so their helpers and operation sequences copy
cleanly (the Excel writer, the scheduler, table sparkline and indicator sequences, the app-state
contract, each example's compile adapter). Two things do not: their token-bound tool scripts,
which need a personal access token in the shell, and any tile that sets
`format: { formatType: … }` on a governed measure (leave `format` off so the layer's format applies).
On CLI 0.2.0's dashboard template (React + TypeScript) the same techniques are ported into its
components rather than pasted; see [getting started](0-getting-started.md#choose-one-start-the-template-or-the-examples-vanilla-layout).

Write the result into the brief:

```markdown
## References
| Example | Why | Techniques to copy (file:line) | Not copying |
```

## 2. Copy techniques, never skeletons

**Copy freely:** low-level helpers and techniques. The query
scheduler, the Excel writer, the KPI card construction, the selection-bar logic, the off-screen
pane CSS, the question-sync script, the waterfall sort trick. Copy the code, then adapt it.

**Never copy:** page structure. Not the top bar, KPI strip and chart grid of another app, not
its tab set, not its theme with your colours swapped in, and no shared engine that renders
several apps from one page template. The CLI's dashboard template is a starting frame, not a
finished structure: redesign its page for your story.

Why: a shared skeleton turns every app into the same dashboard in different colours. Apps built
that way were rejected as "all look too similar", even when each one worked. The value of a
bespoke app is that its structure follows its own story: a forecast room is organised around a
gap, a policy workbench around rules and a queue, a portfolio OS around modules and approvals.
Start the page design from your brief's story path, not from a reference's layout.

A check before building: describe your first tab in one sentence without naming another app. If
the sentence could describe an existing example's first tab, redesign it.

## 3. When you are given a design or screenshot

A supplied design is the spec, and the standard is to match it **on the first delivery**. Every
property visible in the reference is a requirement; do not wait to be told about differences.
Replicas that had to be corrected one property at a time (square cells, numbers in cells, a
restricted hour window, hidden axes on sparklines) all had those properties visible in the
original image.

### Inventory every visible property

Go panel by panel and write one row per property. This table is both the build spec and the
acceptance checklist; every row is built or reported as not possible.

| Panel | Property | Reference shows | How it will be built | Verified by |
| --- | --- | --- | --- | --- |
| Usage by hour | mark shape | rounded squares with gaps | heat-map settings | vSpec |
| Usage by hour | data window | 7 AM–6 PM only | static filter on the hour | query rows |
| KPI | comparison | "+5 \| +1.1% vs PM", green | one-row table, offset 1 | query + screenshot |

Check every panel for:

- chart type, **mark shape** and gaps between marks;
- **values printed on marks**, and whether they are counts, percentages or both;
- **which axes show** labels, lines and ticks, and which are hidden entirely;
- axis label format, especially dates;
- **the data window**: a restricted range of hours, dates or categories;
- sort order (weekday order, value descending);
- legend: present or absent, and where;
- comparisons and deltas, and whether up is good or bad for each;
- totals or companion charts that must line up with a neighbour;
- controls: what each filters; range, single pick or toggle;
- typography, colours, card shapes, spacing, density, header and navigation.

A restriction shown in the reference (an hour window, a colour threshold) is a requirement even
when the layer has no item for it. Declare it once as a named constant, say where it came from,
and show it in the card title.

### Before calling something impossible

Look for the capability in this order: the visualization definition schema; the full operation
list for the object type (list every operation name with `node kit/verify/ops.mjs <type>` and scan them all
before searching for a guessed word; the full references run to 200 KB each); the type's settings in a
compiled vSpec; another object type that carries the data shape (a one-row table does period
comparison a number tile cannot). Only then report a gap, with what you tried. See
[knowledge/visualizations.md](../knowledge/visualizations.md) and
[knowledge/theming.md](../knowledge/theming.md).

### Size marks for their container

Compute the space each mark gets before choosing a layout: 24 hours across 400 px is 16 px a
cell. Labels that do not fit are dropped silently. When the arithmetic fails, restrict the
window as the reference does or change the layout.

### Verify against the inventory

Canvas output cannot be read as text. Assert on the themed vSpec (formats, axis visibility,
data labels, palette, legend) and then compare a screenshot to the reference, panel by panel.
