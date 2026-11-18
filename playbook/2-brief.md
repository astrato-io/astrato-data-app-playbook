# 2. Brief

The brief rules tiles in and out. Without it the app becomes a metric dump: every chart
defensible, none of them answering anything. Write it after the data brief, from what the data
can actually support, and keep it to one page.

## 1. Persona and decision

- **Persona:** one named role and how they use the app ("Head of Credit Risk, weekly policy
  review"; "regional ops manager, every morning"). The role sets density and altitude: a leader
  wants six numbers and a gap; an analyst wants cuts and comparisons; an operator wants a queue.
- **Decision:** a question with a verb, not a subject. "A logistics dashboard" is a subject.
  "Which carrier do we chase today, and for which shipments?" is a decision. If the request does
  not say, propose one from the data brief and mark it as a proposal.

## 2. The story and the hero number

Every app is built around one finding the persona must not miss. Find it in the data during
step 1, not in your imagination: the region that drives a miss, the rule that rejects most
applicants, the product whose margin collapsed, the queue that is ageing.

- **Hero number:** one figure that states the finding, with its comparison ("$1.3m short of
  target; one region is 44% of the gap"). It opens the first tab.
- **Path:** each later tab answers the next question the hero raises (where? why? who? what do
  we do?). Check the path with real queries before committing to it.
- If the data holds no interesting finding, say so and build for the decision anyway; never
  imply a finding the data does not show.

## 3. Tabs as questions

Each tab answers one question, written as the question. The tab's cards answer sub-questions,
and each card's title is its question. Three to six tabs is typical; a workbench can have more
modules if each is a real job.

Pick an archetype for the whole app (vocabulary in [schema/example.schema.md](../schema/example.schema.md)):
command-centre, workbench, explorer, story, report, planner, monitor. It decides the layout and
which examples you read in [step 3](3-choose-references.md).

## 4. Make it analytically rich

Plain trend-and-breakdown charts do not show what a governed layer is for. Plan these at brief
time, because each needs a measure, a grain or a dimension that you may have to add to the layer:

| Kind | Examples | Rule |
| --- | --- | --- |
| Period comparison | MoM, QoQ, YoY; YTD vs PYTD; vs budget or target | Compare aligned periods ending at the latest complete one, never a partial period against a full one. Facts and date in one view: explicitly filtered measures, because period-comparison measures break under any filter on that view. Date in its own view: a stored time axis read as of the latest date, with period-comparison measures ([how](../knowledge/semantic-layer.md#this-quarter-is-empty-because-the-data-ends-in-the-past)) |
| Windows | 3-month moving average, rolling 12 months, running total per year, Pareto | Declared as advanced calculations on the question, not computed in the app |
| Rank, share, top N | rank of a region; share of total per period; top 10 + "Others" | Share partitioned per period where the chart is over time. A rank beside its value needs a separately named measure ([why](../knowledge/tables.md#a-value-column-shows-0-beside-its-rank)) |
| Ratios | margin %, conversion, utilisation | Ratio of sums per period, never the average of row ratios |
| Drivers | bridge from last period to this (price / volume / mix, or by contributor); variance by unit | A waterfall needs signed movements that sum; see [offset-bar waterfall](../patterns/offset-bar-waterfall.md) |
| Reference | mean, ±σ, target lines on trends | Values from governed queries; see [reference lines](../patterns/reference-lines.md) |
| Parameters | a measure switcher; what-if inputs that feed measures | See [what-if](../patterns/what-if-parameters.md) |

Aim for at least one of each of the first four kinds that the data supports, and say in the
brief which ones it cannot support and why (no prior year, no target, one period only).

## 5. Workflows and actions

Ask what the persona *does* after reading the app: approve, decline, escalate, assign, adopt a
plan, flag a record, submit a forecast. Each answer is a workflow:

- the record it acts on (an application, a deal, an invoice, an exception);
- the states and who may move it between them (maker–checker: the proposer cannot approve);
- the audit trail (who, role, before, after, reason, when);
- where it is stored: a writeback table in the warehouse modelled as views in the layer, or a
  labelled browser-only simulation when the audience cannot write.

**Decide storage in the brief, without stopping to ask.** When the request says one person acts
and another must *see* it (a manager flags, the lead reviews), the state has to be shared: plan two
new, empty workflow tables (records and audit events) in the layer's own connection, added to the
layer as new views. These are not mock data and change nothing that exists, so the usual "only add
to the layer" permission covers them; say so in the brief. Creating them with
`astrato_data_import_csv` also adds an entry for each new table to the layer's
`csvSourcedTables` setting: that is an addition, not a change to any existing item, so the same
permission covers it. If the brief explicitly forbids any settings change, or the request forbids
warehouse changes, or the connection refuses writes, use the labelled browser fallback and record that the
lead will not see other people's actions. Either way keep the fallback for viewers who cannot
write. → [writeback workflow](../patterns/writeback-workflow.md)

Ask also which **levers** the persona controls (price, thresholds, headcount, volume, rates).
Each lever is a what-if input. And ask what they **forward**: that is the Excel report.

## 6. Template

```markdown
# Brief — <app name>

Semantic layer:  <id>                        Archetype: <command-centre | workbench | …>
Persona:         <role, how often, on what device and width>
Decision:        <the question it must answer, with a verb>
Hero number:     <figure + comparison, verified in step 1>
Story path:      <hero → where → why → what we do>

## Tabs
| Tab | Question it answers | Key cards (each a question) | Selection group |

## Analytical depth
| Kind | Where in the app | Needs in the layer (exists / to add) |

## Levers (what-if)
| Lever | Range | What it moves | How (parameter / range selection / in-app model) |

## Workflows
| Record | States | Roles | Audit fields | Storage (writeback / simulated) |

## Excel report
Sheets: Summary, one per tab, data, definitions. Follows on-screen filters.

## Look
Light by default. Brand colour, typeface, density, reference design if any.

## Out of scope / not supported by the data
<what was asked for but the data cannot answer, and why>
```

Show the brief and the tab list to whoever asked before building; a wrong tab costs a sentence
here and a day later. If nobody is available to sign off, record your assumptions in the brief
and proceed.

Some docs say to ask three things first: which layer, who reads the app, and the look. When
someone is there to answer, ask what the request leaves open, in one message. When the request
names the layer and the persona but not the look, do not stop for it: choose a look, write it
under **Look** marked as an assumption, and proceed.
