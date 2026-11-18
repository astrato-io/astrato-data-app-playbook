# example.yaml

One file per example, at `examples/<slug>/example.yaml`. `tools/catalog.mjs` validates every
field and builds `catalog.json` from them. Keep values short and literal: agents match on them.

```yaml
slug: revenue-war-room                 # folder name
title: Pipeline War Room               # what the app is called on screen
company: Velmora (fictional SaaS)    # the brand the app is dressed in; always fictional (or "None (…)" for a public dataset)
layer: live-gallery                    # folder under layers/
summary: >-                            # 1–2 sentences: who uses it, for what decision
  A CRO's Q4 forecast room ...
industry: saas                         # see vocabulary
function: sales                        # see vocabulary
persona: CRO
archetype: command-centre              # see vocabulary
look: light, Salesforce-like cards, blue accent   # free text: theme, density, typography, references
tabs:                                  # one line each: tab name — what it answers
  - Command — is Q4 going to land, and where is the gap?
patterns: [kpi-sparkline-comparison, selection-bar]   # slugs from patterns/ (add a pattern file for a new slug)
charts: [bar, line, combo, table-sparklines]          # native object types used (see vocabulary)
interactions: [click-to-filter, drawer]               # see vocabulary
workflows: [forecast-submission]       # mocked business workflows, or [] if none
writeback: true                        # does it write to the warehouse through app.writeback?
exports: [xlsx]                        # [] | xlsx | csv | pdf | png
objects: 41                            # native Astrato objects mounted across all tabs (approx.)
start_here:                            # 1–4 files, most important first, with why
  - project/app/app.js — pages, governed queries, writeback
capabilities:                          # what a user can DO in the app, each with where it is built
  - narrative-headline — project/src/app.js:197
stealable:                             # the 3–6 techniques worth copying, each with file:line
  - Gap meter built from four stacked governed measures — project/app/app.js:120
caveats:                               # known limits, version quirks, things NOT to copy
  - Visualizations 0.5.2: number objects ignore selections, so KPIs are text from governed queries
```

## Vocabulary

Use these values where they fit; add a new one only when nothing fits, and say so in the PR.

- **industry:** saas, retail, banking, lending, insurance, asset-management, private-markets,
  healthcare, public-sector, manufacturing, energy, media, sport, transport, telecom, hr, education
- **function:** sales, finance, risk, operations, marketing, hr, customer-success, strategy,
  compliance, supply-chain, executive
- **archetype:**
  - `command-centre` — one screen per tab, KPI-led, for a leader running a number
  - `workbench` — many modules, records, actions and approvals; people do work in it
  - `explorer` — filters, drill and detail over one dataset; analysts browse
  - `story` — scrolling narrative with chapters and annotated charts
  - `report` — paginated or printable pack (board, monthly, regulatory)
  - `planner` — what-if parameters and scenarios drive the numbers
  - `monitor` — operational status, thresholds, alerts, SPC
- **charts:** bar, stacked-bar, line, area, combo, waterfall, scatter, pie, funnel, heatmap,
  table, table-sparklines, pivot, expandable-table, kpi, gauge, map, sankey, sparkline
- **interactions:** click-to-filter, selection-bar, drill-down, drawer, tabs, role-switcher,
  sliders, search, compare, deep-link, chat

- **capabilities** (what a user can do; one entry per capability, `<name> — <file>:<line>`):
  report-builder, assistant, writeback-workflow, simulated-workflow, what-if, excel-export, pdf-export, data-blending, story-mode, drill-down, narrative-headline, record-drawer, saved-views, role-switcher, alerting, map

`patterns` must each match a file `patterns/<slug>.md`. `tools/catalog.mjs --check` fails otherwise.
