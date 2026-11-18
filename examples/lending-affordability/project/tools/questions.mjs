/**
 * The stored business questions behind every object of the app.
 *
 * Each object in app/dashboard.js names one of these: the question owns the governed dimensions,
 * measures, order and period comparisons; the object adds presentation only (chart type, colours,
 * display names). Several objects share one question: the headline cards, the policy KPIs and the
 * rule counts all use "headline".
 *
 *   node tools/questions.mjs questions [layerId]   # create or replace every question, validate, publish
 *   node tools/questions.mjs sync [layerId]        # write the stored questions into src/questions.js
 *
 * An Astrato App cannot read business questions at runtime, so `sync` copies them into the app as
 * data. Re-run it whenever a question changes in the layer. Uses tools/mcp.mjs (ASTRATO_MCP_URL,
 * ASTRATO_PAT).
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { call, layerId, publish as publishLayer } from './layer.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const LAYER = layerId(process.argv[3]);

const HEADLINES = [
  ['apps', 'Applications', 'growth'],
  ['inc', 'Avg Monthly Income', 'growth'],
  ['exp', 'Avg Total Expenses', 'growth'],
  ['disp', 'Avg Disposable After Loan', 'growth'],
  ['dti', 'Debt to Income', 'diff'],
  ['appr', 'Approval Rate', 'diff'],
];
const EXPENSES = [['housing', 'Avg Housing Cost'], ['groceries', 'Avg Groceries'], ['utilities', 'Avg Utilities'], ['transport', 'Avg Transport'], ['childcare', 'Avg Childcare'], ['discretionary', 'Avg Discretionary Spend'], ['debt', 'Avg Existing Debt']];

const d = (key, dimension) => ({ key, reference: { dimension } });
const m = (key, measure, extra = {}) => ({ key, reference: { measure }, ...extra });
const by = (key, direction = 'descending') => ({ reference: { [key.startsWith('d_') ? 'dimension' : 'measure']: key }, direction });

/** [app key, title, description, dimensions, measures, orderBy, preferred chart] */
const Q = (key, name, description, dimensions, measures, orderBy, chart) => ({
  key, name, definition: { question: name, description, categories: ['Lending affordability app'], dimensions, measures, ...(orderBy ? { orderBy } : {}), preferredCharts: [{ type: chart }] },
});

const periodQ = (key, name, unit, dimension) => Q(key, name,
  `Each headline measure for every application ${unit}, with its change against the previous ${unit}: % growth for counts and £ averages, percentage-point difference for Debt to Income and Approval Rate. The first row is the latest ${unit}.`,
  [d('d_period', dimension)],
  HEADLINES.flatMap(([k, measure, comparison]) => [m(k, measure), m(`${k}_chg`, measure, { advancedCalculation: { interRecord: { comparison, offset: 1 } } })]),
  [by('d_period')], 'table');

export const QUESTIONS = [
  Q('headline', 'What are the headline affordability metrics?',
    'Portfolio headline figures over the applications in view: volume, average income, expenses and disposable income, debt-to-income, approval rate and lending requested.',
    [d('d_all', 'All Applications')],
    [...HEADLINES.map(([k, measure]) => m(k, measure)), m('lend', 'Requested Lending')], null, 'kpi'),
  Q('monthly', 'How do income and expenses trend by month?',
    'The headline measures and average essential expenses for every application month, oldest first.',
    [d('d_month', 'Application Month')],
    [...HEADLINES.map(([k, measure]) => m(k, measure)), m('ess', 'Avg Essential Expenses')], [by('d_month', 'ascending')], 'line'),
  Q('region', 'How do income and expenses compare by region?',
    'Average monthly net income and total expenses per applicant, by UK region, highest income first.',
    [d('d_region', 'Region')], [m('inc', 'Avg Monthly Income'), m('exp', 'Avg Total Expenses')], [by('inc')], 'bar'),
  Q('mix', 'Where does the money go, by income band?',
    'Average monthly outgoings per applicant by category, for each net income band.',
    [d('d_band', 'Income Band')], EXPENSES.map(([k, measure]) => m(k, measure)), [by('d_band', 'ascending')], 'bar'),
  Q('credit', 'How does approval rate vary by credit band?',
    'Approved ÷ decided applications for each credit score band, highest first.',
    [d('d_credit', 'Credit Band')], [m('appr', 'Approval Rate')], [by('appr')], 'bar'),
  Q('products', 'How affordable is each product?',
    'Volume, income, expenses, new repayment, disposable income, debt-to-income and approval rate by product, largest first.',
    [d('d_product', 'Product')],
    [m('apps', 'Applications'), m('inc', 'Avg Monthly Income'), m('exp', 'Avg Total Expenses'), m('rep', 'Avg Proposed Repayment'), m('disp', 'Avg Disposable After Loan'), m('dti', 'Debt to Income'), m('appr', 'Approval Rate')],
    [by('apps')], 'table'),
  Q('byProduct', 'How many applications are there by product?', 'Applications by product, largest first.',
    [d('d_product', 'Product')], [m('apps', 'Applications')], [by('apps')], 'bar'),
  Q('byIncome', 'How many applications are there by income band?', 'Applications by net income band, lowest band first.',
    [d('d_band', 'Income Band')], [m('apps', 'Applications')], [by('d_band', 'ascending')], 'bar'),
  Q('stage', 'Where are applications in the workflow?', 'Applications by workflow stage, in stage order.',
    [d('d_stage', 'Stage')], [m('apps', 'Applications')], [by('d_stage', 'ascending')], 'bar'),
  Q('underwriters', 'How are underwriters performing?',
    'Cases, open cases, approval rate, proposals upheld by the approver and days to decision, by underwriter.',
    [d('d_uw', 'Underwriter')],
    [m('apps', 'Applications'), m('open', 'Open Applications'), m('appr', 'Approval Rate'), m('upheld', 'Proposal Upheld Rate'), m('days', 'Avg Days to Decision')],
    [by('apps')], 'table'),
  periodQ('month', 'How did the headline metrics change month on month?', 'month', 'Application Month'),
  periodQ('quarter', 'How did the headline metrics change quarter on quarter?', 'quarter', 'Application Quarter'),
];

const batch = (entries) => {
  const plan = call('astrato_semantic_layer_plan_authoring_batch', {
    semanticLayerId: LAYER,
    items: entries.map((e, i) => ({ id: `i${i}`, entity: e.entity, operation: e.operation, targetName: e.name, request: e.name })),
  });
  if (!plan.readyToCommit) throw new Error(`plan not ready: ${JSON.stringify(plan.ambiguities ?? plan).slice(0, 3000)}`);
  const items = entries.map((e, i) => ({ id: `i${i}`, entity: e.entity, preparedTarget: plan.items[i].preparedTarget ?? null, change: { operation: e.operation, name: e.name, definition: e.definition } }));
  const r = call('astrato_semantic_layer_commit_authoring_batch', { semanticLayerId: LAYER, planId: plan.planId, expectedRevision: plan.revision, items });
  if (!r.committed) {
    for (const i of r.blockingIssues ?? []) console.log(`${i.entityKey} :: ${i.code} :: ${i.message}`);
    process.exit(1);
  }
  console.log('committed at', r.committedRevision);
  return r.committedRevision;
};

const publish = (revision) => publishLayer(LAYER, revision);


const cmd = process.argv[2];
if (cmd === 'questions') {
  const existing = new Set(call('astrato_semantic_layer_list_questions', { semanticLayerId: LAYER }).items.map((item) => item.title ?? item.id));
  publish(batch(QUESTIONS.map((q) => ({ entity: 'businessQuestion', operation: existing.has(q.name) ? 'replace' : 'create', name: q.name, definition: q.definition }))));
}
if (cmd === 'sync') {
  const listed = call('astrato_semantic_layer_list_questions', { semanticLayerId: LAYER }).items;
  const out = {};
  let revision;
  for (const q of QUESTIONS) {
    const item = listed.find((entry) => (entry.title ?? entry.id) === q.name);
    if (!item) throw new Error(`question not in layer: ${q.name}`);
    const stored = call('astrato_semantic_layer_get_question', { semanticLayerId: LAYER, id: item.id });
    revision = stored.revision;
    const def = stored.definition;
    out[q.key] = {
      id: item.id,
      title: q.name,
      dimensions: def.dimensions.map((x) => ({ key: x.key, dimension: x.reference.dimension })),
      measures: def.measures.map((x) => ({ key: x.key, measure: x.reference.measure, ...(x.advancedCalculation?.interRecord ? { comparison: x.advancedCalculation.interRecord.comparison, offset: x.advancedCalculation.interRecord.offset } : {}) })),
      orderBy: (def.orderBy ?? []).map((o) => ({ key: o.reference.dimension ?? o.reference.measure, direction: o.direction })),
    };
  }
  const banner = `/**\n * Stored business questions, layer revision ${revision}. Every object in the app is built from one\n * of these. Generated by tools/questions.mjs sync; do not edit by hand.\n */\n`;
  writeFileSync(join(here, '..', 'src', 'questions.js'), `${banner}export const QUESTIONS = ${JSON.stringify(out, null, 2)};\n`);
  console.log('wrote src/questions.js at revision', revision);
}
