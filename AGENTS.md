# Using the Astrato Data App Playbook as an agent

This repo is reference material for building Astrato Data Apps: hand-written apps over a governed
semantic layer. Nothing here is a template to fork wholesale. Use the 15 reference examples to see
what a finished app looks like in a domain close to yours, then copy specific techniques.

The user's prompt usually looks like this:

> Build an Astrato App on semantic layer `<id>` for `<who>` to `<decide what>`. Follow
> https://github.com/astrato-io/astrato-data-app-playbook and verify it with its kit. Tell me what isn't done yet.

When you finish, report what is not done: the [rubric](playbook/rubric.md) criteria the app does
not yet meet, and anything you could not verify.

## Start here

| You are… | Read |
| --- | --- |
| starting from nothing | [playbook/0-getting-started.md](playbook/0-getting-started.md): skills, MCP, CLI, project |
| building an app on your own semantic layer | [playbook/](playbook/README.md): the build loop and its 10 non-negotiables, step by step |
| checking whether an app is good enough | [playbook/rubric.md](playbook/rubric.md): 27 observable criteria, scored 0/1/2 |
| looking for an example or a technique | the rest of this file, [catalog.json](catalog.json) and [patterns/](patterns/) |
| proving an app works | [kit/](kit/README.md): the smoke test and release gate, ready to copy |
| stuck on something that should work | [knowledge/](knowledge/README.md): symptom-first entries, each tagged with the versions it was verified on. Grep it before debugging |

Two starts are valid, one stack per app: CLI 0.2.0's `astrato init --template dashboard` (React + TS
page frame, selection bar, filters, object menu) with the examples' techniques ported into it, or
the examples' vanilla JS layout. Either way, wire in the [kit](kit/README.md) and run its smoke
test; `astrato snapshot` is only a quick look. See [getting started](playbook/0-getting-started.md#choose-one-start-the-template-or-the-examples-vanilla-layout).

The usual order: playbook step 1 (read the layer) → step 2 (brief) → step 3 sends you to the
catalog below → build with the patterns open → verify and score with the rubric.

## Which source to trust for what

Several sources overlap. Read them for different things, and do not read all of each.

| Source | Trust it for | Do not use it for |
| --- | --- | --- |
| The Astrato docs (`docs.astrato.io`) and the references shipped inside the installed packages | **Current API truth**: signatures, payload shapes, operation names, CLI commands, for the version you installed | The standard an app should meet |
| The Astrato skills | Routing: when to use which tool, and security rules. They send you to the docs | Content; they hold little |
| [playbook/](playbook/README.md) | **The standard and the order of work** | API shapes |
| [patterns/](patterns/) | The shape of a technique and where an example does it | Exact code for your version: the examples run on older packages |
| [knowledge/](knowledge/README.md) | Symptoms and their causes, each dated by version; start with its [status on 0.8](knowledge/README.md#status-on-08) | Anything where the docs for your version say otherwise: test, then believe the test |

When the playbook and the docs disagree about **what to build** (how many stored questions,
preloading tabs), follow the playbook. When anything here and the docs disagree about **how an
API behaves**, the docs describe your version and this repo may describe an older one: build
it the docs' way, test that one behaviour, and keep the result.

Docs pages worth reading in full, by step: *Period axes and comparisons* (steps 1 and 4);
*Mounting objects*, *Filters and selections*, *KPI card* and *Query performance* (step 4).
For operations, do not read the references end to end: `node kit/verify/ops.mjs <type>` lists
every operation for a chart type and prints the ones you name.

## Find the right examples (read 1 file, not 100)

1. Read [`catalog.json`](catalog.json). Its `capabilities` index answers "which example has a report
   builder / an assistant / real writeback?" directly, with the file and line. Each example lists `industry`, `function`, `persona`,
   `archetype`, `patterns`, `charts`, `interactions`, `workflows`, `writeback` and `exports`.
2. Pick **2–3** examples. Rank by archetype first (what kind of app is being asked for?), then
   by the patterns and interactions the request needs, then by industry. An example from
   another industry with the right archetype beats a same-industry example of the wrong shape.
3. For each pick, read `examples/<slug>/README.md`, then the files in `start_here`. Each
   `stealable` entry points at the exact `file:line` of a technique.
4. For cross-cutting techniques, read `patterns/<slug>.md`: what the technique is, when to use
   it, the gotchas, and which examples implement it.

## Understand the data model

Each example names its `layer`. `layers/<layer>/` has:

| File | Use it for |
| --- | --- |
| `README.md` | the grain of each view, joins, modelling choices, gotchas |
| `layer.json` | the complete Astrato Semantic Layer V2 document: views, fields, joins, dimensions, measures (with formulas and formats) and stored business questions |
| `layer.ossie.yaml` | the same model as Apache Ossie YAML, for non-Astrato tooling |
| `questions.md` | a readable index of the stored business questions |
| `schema/ddl.sql` | the tables the layer reads, to recreate empty tables |

**This repo contains semantic layers, not data**: no rows, extracts, dimension profiles, data
generators or seed scripts. To learn a layer's values, profile the user's own published layer over
MCP ([step 1](playbook/1-read-the-layer.md)); never look for, or create, a shipped profile.
Database and schema names are placeholders, and `astrato.json` in each project points at
`00000000-0000-0000-0000-000000000000`. Most examples were built on synthetic data and a few on
public datasets; [DATA-SOURCES.md](DATA-SOURCES.md) lists the tables each layer expects and where
the public sources live.

**Your app is built on the user's own data**, usually through a semantic layer that already
exists over it: [read that layer](playbook/1-read-the-layer.md). If there is none, [build one](playbook/build-the-layer.md)
from their warehouse tables through Astrato. Never create mock or presentation data in the
warehouse: no generated rows, no presentation columns. The one addition an app may make is
empty workflow (writeback) tables, added as new views, when the brief needs
state that one person writes and another reads; see
[writeback workflow](patterns/writeback-workflow.md) and [knowledge/writeback.md](knowledge/writeback.md).
Use the layers here as modelling references, not as something to recreate.

## The standard, and where the examples fall short of it

The standard is the [playbook](playbook/README.md) and its [rubric](playbook/rubric.md). In short:
every chart is a native Astrato object on a stored business question; selections reach every
object, KPIs included; every KPI carries a comparison and a mini chart; each app is bespoke
around one story; light mode by default.

**The examples predate parts of that standard.** Each was built to demonstrate certain
techniques, and none scores full marks on the rubric: one queries measures directly instead of
stored questions, one draws its bridges as SVG, two keep workflow state in the browser. Each
example's `caveats` say where it falls short. Copy a technique from the example that does it
well (its `stealable` list), and take the standard from the playbook, not from any one example.

**If the Astrato skills or docs say something different** from the playbook (for example how
many business questions to store, whether to preload tabs, or a dark default theme), follow the
playbook when building to the playbook's standard. The reasoning is given in each playbook step.

## Running an example

Every example runs on the public `@astrato-io/*` packages (visualizations 0.8 or 0.9; see each
`project/package.json`): `npm install` in
its `project/`, then follow its README. To run your own app, follow
[getting started](playbook/0-getting-started.md).

## Versions

Each example pins the visualizations version it was tested on in `project/package.json`: 12 pin
`^0.9.0` and 3 still pin `^0.8.0`. See [status on 0.8](knowledge/README.md#status-on-08) for what has and has
not been re-checked before copying a workaround.
