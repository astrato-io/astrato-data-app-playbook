# Astrato Data App Playbook

Build an Astrato Data App on your own governed data with a coding agent (Claude Code, Codex,
Cursor). This repo gives the agent the standard (a [playbook](playbook/README.md) and a scoring
[rubric](playbook/rubric.md)), a [verification kit](kit/README.md), version-tagged
[knowledge](knowledge/README.md), and 15 finished reference examples with their semantic layers
to copy techniques from.

## What you need

- An Astrato account with MCP and Data App publishing enabled
- A **published** semantic layer over your own data (no layer yet? the agent can
  [build one](playbook/build-the-layer.md) from your warehouse tables)
- The Astrato CLI (`@astrato-io/cli` 0.2.0 or later, installed in your app project), Node 24.18+ and Chrome
- Your agent connected to the Astrato MCP server, with the
  [Astrato skills](https://github.com/astrato-io/astrato-skills) installed

Setup, step by step: [playbook/0-getting-started.md](playbook/0-getting-started.md).

## The prompt

> Build an Astrato App on semantic layer `<id>` for `<who>` to `<decide what>`. Follow
> https://github.com/astrato-io/astrato-data-app-playbook and verify it with its kit. Tell me what isn't done yet.

Naming the person and the decision matters: it is the first thing the agent's brief needs.

## Where next

Agents: [AGENTS.md](AGENTS.md). People: [playbook](playbook/README.md), [rubric](playbook/rubric.md),
[examples](#examples), [knowledge](knowledge/README.md), [data sources](DATA-SOURCES.md).

## Examples

| Example | Archetype | Industry · function | What it shows |
| --- | --- | --- | --- |
| [revenue-war-room](examples/revenue-war-room/) | command-centre | SaaS · sales | A CRO's Q4 forecast room over a 31-view layer |
| [lending-affordability](examples/lending-affordability/) | workbench | Lending · risk | Affordability policy sliders and a maker–checker approval queue. Runs on the public 0.8 packages |
| [portfolio-os](examples/portfolio-os/) | workbench | Private markets · finance | A ten-module PE portfolio OS: valuations, scenarios, IC approvals, writeback, Excel packs |
| [royalty-close](examples/royalty-close/) | workbench | Music publishing · finance | Month-end royalty close: exception cases written back with maker–checker, a close simulator, EN/ES, a six-sheet Excel pack |
| [people-intelligence](examples/people-intelligence/) | workbench | Telecom · HR | The largest example: a Group CHRO and three role-scoped personas on one link, 13 tabs, a custom report builder, an assistant over stored questions, two simulators, approvals written back as events |
| [stock-rotation](examples/stock-rotation/) | workbench | Retail · operations | Stock rotation with writeback: transfers, reorders and approvals against governed stock |
| [agency-client-reporting](examples/agency-client-reporting/) | report | Marketing services · client services | Monthly client reports over four joined ad and web sources, month-on-month changes split into drivers and explained in words, a budget what-if |
| [labour-market-pulse](examples/labour-market-pulse/) | report | HR · strategy | A recruitment firm's chief economist makes the monthly call on the public ONS labour market release: tightening or loosening, demand by sector, pay with a governed pay-award what-if, regions, a maker–checker call. Built by an agent from this repo in a clean test run |
| [thessaloniki-on-the-move](examples/thessaloniki-on-the-move/) | story | Transport · planning | A scrolling data story on a public bus timetable: stop map, an animated day of trips, a bus-priority what-if |
| [league-table-planner](examples/league-table-planner/) | planner | Education · strategy | A university's league-table climb plan on published third-party rankings data (licence unconfirmed): rivals within 10 places, gaps per measure, a governed score what-if, a maker–checker focus plan. Built by an agent from this repo in a clean test run |
| [snowline](examples/snowline/) | planner | Leisure · operations | A resort operations head's Monday review on synthetic ski-resort data: best resorts and weeks, snow against crowds, where good snow went unsold, budget levers on governed parameters beside a default plan, a maker–checker marketing plan. The reference for a layer built from raw tables: a test agent built the layer, then the app; judged 47/52 |
| [ed-wait-watch](examples/ed-wait-watch/) | monitor | Healthcare · operations | An emergency department's morning board for the 30-minute waiting-time target on the public hospital ER sample: a slot heat map, a departments drivers bridge, a target what-if, flags handed to owners and signed off maker–checker, written back in Live mode or tried in a Practice mode that writes nothing. The first monitor; judged 45/52 |
| [hotel-weather](examples/hotel-weather/) | planner | Leisure · sales | The first data blend: governed hotel demand, real weather read from the public Open-Meteo archive by DuckDB-WASM in the browser, and the two joined, all as native charts on one Astrato selection; then a governed wet-night offer what-if and a maker–checker flag. Judged 46/52 |
| [superstore-explorer](examples/superstore-explorer/) | explorer | Retail · sales | The plain explorer to start from: period picker with comparison, drill-down, drill-through, export from every object |
| [report-builder](examples/report-builder/) | explorer | Retail · sales | The flexible custom report to start from, on any layer: pick rows, figures, filters and a period, compare with last period or last year, table or chart, save, share as a link, export to Excel |

`catalog.json` lists each example's capabilities (writeback, what-if, Excel export, assistant…) with the file and line that builds it.

Each example ships:

- **the app**: the complete source of a hand-written Astrato Data App;
- **a card** (`example.yaml`): domain, persona, archetype, patterns, chart types, interactions,
  workflows, and the exact `file:line` of the techniques worth copying;
- **screenshots**, for most examples;
- **its semantic layer**: Astrato V2 JSON and Apache Ossie YAML, stored business questions and
  the DDL of the tables it expects.

**This repository contains semantic layers, not data.** No rows, extracts, data generators or
seed scripts are included: to run an example, load your own tables shaped like its layer's
`schema/ddl.sql`, or rebuild a public source yourself. Companies and people in the examples are
fictional unless the example's README names a public dataset; [DATA-SOURCES.md](DATA-SOURCES.md)
lists which tables each layer expects and where the public sources live.

## Layout

```
AGENTS.md            how an agent should use this repo
DATA-SOURCES.md      no data here: the tables each layer expects, and where public sources live
playbook/            the build loop, the 10 non-negotiables and the scoring rubric
knowledge/           symptom-first, version-tagged findings about the libraries, engine and hosting
kit/                 the smoke test and release gate, ready to copy into an app
catalog.json         generated index of examples, patterns and layers
patterns/            cross-cutting techniques, each linked to the examples that implement them
layers/<layer>/      semantic layer, questions and table DDL
examples/<slug>/     example.yaml, README.md, screenshots/ (most), project/ (the app)
schema/              the example.yaml contract and vocabulary
tools/               catalog and leak-scan scripts (run by CI)
```

## Terms used in the examples

- **Checked in staging**: verified with the kit's smoke test in the maintainers' copy before the
  example was added here.
- **Judge**: an independent agent that scored the app against [playbook/rubric.md](playbook/rubric.md)
  without seeing its build notes. *Admitted* means it met the bar (44/52, with F4, publishing, out
  of scope). Evidence (screenshots, smoke output) is not included in this repo.
- **Test run**: an app built by an agent from this repo alone, starting from the one-line prompt.

## For maintainers

Examples are added from a private working copy by Astrato maintainers. `npm run check` validates
the cards, checks that `catalog.json` is current (`npm run catalog` regenerates it) and runs a
leak scan (`tools/scan.mjs`). In CI the scan runs generic rules only; a gitignored
`denylist.local.txt` adds private terms on a maintainer's machine.

## Licence

The code and documentation in this repository are licensed under the [MIT licence](LICENSE),
Copyright (c) 2026 Astrato. No data is included. Third-party names, logos and public datasets
referred to here keep their owners' terms; see [DATA-SOURCES.md](DATA-SOURCES.md).
