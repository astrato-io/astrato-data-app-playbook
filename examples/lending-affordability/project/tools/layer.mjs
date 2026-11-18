/**
 * Build the "Lending Affordability & Decisions" semantic layer through the Astrato MCP server
 * (tools/mcp.mjs; set ASTRATO_MCP_URL and ASTRATO_PAT).
 *
 *   node tools/layer.mjs create <datasourceId>     # new layer on your warehouse connection; prints its id
 *   node tools/layer.mjs views [layerId]           # the two views over your tables (schema/ddl.sql), all fields, the join
 *   node tools/layer.mjs model [layerId]           # dimensions and measures
 *   node tools/layer.mjs publish [layerId]         # validate and publish the current revision
 *
 * layerId defaults to astrato.json's semanticLayerId. `views` reads SAMPLE_DATABASE and SAMPLE_SCHEMA:
 * where your LENDING_* tables are. Then run tools/questions.mjs for the business questions.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLIENT = fileURLToPath(new URL('./mcp.mjs', import.meta.url));
export const call = (tool, args) => {
  const file = join(tmpdir(), `lending-${process.pid}-${tool}.json`);
  writeFileSync(file, JSON.stringify(args));
  const out = execFileSync(process.execPath, [CLIENT, tool, `@${file}`], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const parsed = JSON.parse(out);
  if (!parsed.ok) throw new Error(`${tool}: ${out.slice(0, 3000)}`);
  return parsed.data;
};
export const layerId = (arg) => arg ?? JSON.parse(readFileSync(new URL('../astrato.json', import.meta.url), 'utf8')).semanticLayerId;

const A = 'Applications';
const E = 'Workflow Events';
const OVR = { APR: 'APR', UTILITIES_COUNCIL_TAX: 'Utilities & Council Tax' };
const title = (c) => OVR[c] ?? c.split('_').map((w) => w[0] + w.slice(1).toLowerCase()).join(' ');
const VIEWS = {
  [A]: ['LENDING_AFFORDABILITY', 'APPLICANT_ID:s APPLICATION_DATE:d APPLICATION_MONTH:d REGION:s PRODUCT:s EMPLOYMENT_TYPE:s CHANNEL:s AGE:n AGE_BAND:s HOUSEHOLD_SIZE:n CREDIT_SCORE:n CREDIT_BAND:s REQUESTED_AMOUNT:n TERM_MONTHS:n APR:n MONTHLY_NET_INCOME:n HOUSING_COST:n GROCERIES:n UTILITIES_COUNCIL_TAX:n TRANSPORT:n CHILDCARE:n ESSENTIAL_EXPENSES:n DISCRETIONARY_SPEND:n TOTAL_EXPENSES:n EXISTING_DEBT_PAYMENTS:n PROPOSED_REPAYMENT:n STRESSED_REPAYMENT:n DISPOSABLE_AFTER_LOAN:n STRESSED_DISPOSABLE:n DEBT_TO_INCOME:n EXPENSE_TO_INCOME:n LOAN_TO_INCOME:n AFFORDABILITY_RESULT:s POLICY_BREACHES:n STAGE:s STAGE_ORDER:n UNDERWRITER:s PROPOSAL:s PROPOSAL_DATE:d APPROVER:s FINAL_DECISION:s OUTCOME:s DECISION_DATE:d DAYS_TO_DECISION:n PROPOSAL_UPHELD:n APPROVED_AMOUNT:n DAYS_OPEN:n APPLICATION_MONTH_LABEL:s APPLICATION_QUARTER:s INCOME_BAND:s IS_APPROVED:n IS_DECIDED:n IS_OPEN:n IS_PASS:n APP_COUNT:n'],
  [E]: ['LENDING_WORKFLOW_EVENTS', 'APPLICANT_ID:s STEP_NO:n STEP:s ACTOR:s ROLE:s ACTION:s EVENT_DATE:d'],
};

const fd = (name, field, description, view = A) => ({ entity: 'dimension', name, definition: { kind: 'field', field: { view, field }, description } });
const agg = (id, field, aggregation, extra = {}) => ({ id, kind: 'aggregate', field: { view: A, field }, aggregation, ...extra });
const ms = (name, description, inputs, pattern, expression) => ({ entity: 'measure', name, definition: { description, inputs, ...(expression ? { expression } : {}), format: { mode: 'custom', pattern } } });
const GBP = '£#,##0';
const avg = (name, field, description, pattern = GBP) => ms(name, description, [agg('x', field, 'AVG')], pattern);

export const ENTITIES = [
  fd('Applicant', 'Applicant Id', 'Application reference (AP-xxxxxx).'),
  fd('Product', 'Product', 'Credit product applied for.'),
  fd('Region', 'Region', 'UK region of the applicant.'),
  fd('Employment Type', 'Employment Type', 'Employment status declared on the application.'),
  fd('Channel', 'Channel', 'Where the application was made.'),
  fd('Age Band', 'Age Band', 'Applicant age band.'),
  fd('Credit Band', 'Credit Band', 'Credit score band (0–999 scale).'),
  fd('Income Band', 'Income Band', 'Monthly net income band; labels sort in band order.'),
  fd('Application Month', 'Application Month Label', 'Month the application was submitted (yyyy-mm).'),
  fd('Application Quarter', 'Application Quarter', 'Calendar quarter the application was submitted (yyyy-Qn).'),
  fd('All Applications', 'App Count', 'A single value (1) shared by every application: the grain of portfolio-level headline figures.'),
  fd('Affordability Result', 'Affordability Result', 'Default-policy affordability outcome: Pass (0 breaches), Marginal (1), Fail (2+).'),
  fd('Stage', 'Stage', 'Workflow stage: Affordability Check → Awaiting Approval → Decided.'),
  fd('Outcome', 'Outcome', 'Approved, Declined, Pending approval or In assessment.'),
  fd('Proposal', 'Proposal', "Underwriter's proposal: Approve, Counter-offer, Refer or Decline."),
  fd('Underwriter', 'Underwriter', 'Underwriter who drafted the proposal.'),
  fd('Approver', 'Approver', 'Credit approver who signs off the decision.'),
  fd('Workflow Step', 'Step', 'Audit-trail step.', E),
  ms('Applications', 'Number of applications.', [agg('x', 'Applicant Id', 'COUNT', { distinct: true })], '#,##0'),
  avg('Avg Monthly Income', 'Monthly Net Income', 'Average monthly net (take-home) income.'),
  avg('Avg Total Expenses', 'Total Expenses', 'Average monthly outgoings: essential plus discretionary.'),
  avg('Avg Essential Expenses', 'Essential Expenses', 'Average essential outgoings: housing, groceries, utilities & council tax, transport, childcare.'),
  avg('Avg Discretionary Spend', 'Discretionary Spend', 'Average monthly discretionary spend.'),
  avg('Avg Housing Cost', 'Housing Cost', 'Average rent or housing cost.'),
  avg('Avg Groceries', 'Groceries', 'Average monthly groceries.'),
  avg('Avg Utilities', 'Utilities & Council Tax', 'Average utilities and council tax.'),
  avg('Avg Transport', 'Transport', 'Average monthly transport.'),
  avg('Avg Childcare', 'Childcare', 'Average monthly childcare.'),
  avg('Avg Existing Debt', 'Existing Debt Payments', 'Average existing monthly credit commitments.'),
  avg('Avg Proposed Repayment', 'Proposed Repayment', 'Average monthly repayment on the new credit.'),
  avg('Avg Disposable After Loan', 'Disposable After Loan', 'Income minus essentials, existing debt and the new repayment.'),
  avg('Avg Requested Amount', 'Requested Amount', 'Average amount requested.'),
  avg('Avg Credit Score', 'Credit Score', 'Average credit score.', '#,##0'),
  ms('Debt to Income', 'Existing plus new repayments ÷ net income (portfolio-weighted).', [agg('a', 'Existing Debt Payments', 'SUM'), agg('b', 'Proposed Repayment', 'SUM'), agg('c', 'Monthly Net Income', 'SUM')], '0.0%', '(a + b) / c'),
  ms('Expense Ratio', 'Total expenses ÷ net income (portfolio-weighted).', [agg('a', 'Total Expenses', 'SUM'), agg('c', 'Monthly Net Income', 'SUM')], '0.0%', 'a / c'),
  ms('Pass Rate', 'Share of applications passing the default affordability policy.', [agg('a', 'Is Pass', 'SUM'), agg('b', 'App Count', 'SUM')], '0.0%', 'a / b'),
  ms('Approval Rate', 'Approved ÷ decided applications.', [agg('a', 'Is Approved', 'SUM'), agg('b', 'Is Decided', 'SUM')], '0.0%', 'a / b'),
  ms('Approved', 'Approved applications.', [agg('x', 'Is Approved', 'SUM')], '#,##0'),
  ms('Open Applications', 'Applications still in the workflow.', [agg('x', 'Is Open', 'SUM')], '#,##0'),
  ms('Avg Days to Decision', 'Average days from application to final decision.', [agg('x', 'Days To Decision', 'AVG')], '0.0'),
  ms('Proposal Upheld Rate', 'Decided applications where the approver confirmed the underwriter proposal.', [agg('a', 'Proposal Upheld', 'SUM'), agg('b', 'Is Decided', 'SUM')], '0.0%', 'a / b'),
  ms('Approved Lending', 'Total amount approved.', [agg('x', 'Approved Amount', 'SUM')], GBP),
  ms('Requested Lending', 'Total amount requested.', [agg('x', 'Requested Amount', 'SUM')], GBP),
];

export const publish = (layer, revision) => {
  const v = call('astrato_semantic_layer_validate', { semanticLayerId: layer });
  const errors = (v.issues ?? []).filter((issue) => issue.severity === 'error');
  if (errors.length) throw new Error(`validation errors: ${JSON.stringify(errors).slice(0, 1500)}`);
  const r = call('astrato_semantic_layer_publish', { semanticLayerId: layer, expectedRevision: revision ?? call('astrato_semantic_layer_get_summary', { semanticLayerId: layer }).revision });
  console.log('published revision', r.publishedRevision);
};

const [cmd, arg] = process.argv.slice(2);
if (process.argv[1]?.endsWith('layer.mjs')) {
  if (cmd === 'create') {
    if (!arg) throw new Error('usage: node tools/layer.mjs create <datasourceId>');
    const r = call('astrato_semantic_layer_create', { name: 'Lending Affordability & Decisions', datasourceId: arg });
    console.log(`created ${r.semanticLayerId}; put it in astrato.json (astrato init . --semantic-layer-id ${r.semanticLayerId})`);
  } else if (cmd === 'views') {
    const database = process.env.SAMPLE_DATABASE;
    const schema = process.env.SAMPLE_SCHEMA;
    if (!database || !schema) throw new Error('Set SAMPLE_DATABASE and SAMPLE_SCHEMA to where your LENDING_* tables are.');
    const SID = call('astrato_semantic_layer_begin_edit_session', { semanticLayerId: layerId(arg), label: 'Views over the lending sample data' }).sessionId;
    for (const [name, [table, cols]] of Object.entries(VIEWS)) {
      call('astrato_semantic_layer_apply_edit', { sessionId: SID, operation: 'upsert_view', payload: { name, source: { type: 'table', database, schema, table } } });
      for (const c of cols.split(' ')) {
        const [col, t] = c.split(':');
        call('astrato_semantic_layer_apply_edit', { sessionId: SID, operation: 'upsert_field', viewName: name, payload: { name: title(col), source: col, dataType: { s: 'string', n: 'number', d: 'date' }[t] } });
      }
    }
    call('astrato_semantic_layer_apply_edit', {
      sessionId: SID, operation: 'upsert_join',
      payload: { views: [E, A], cardinality: 'many-to-one', conditions: [{ operator: 'equals', arguments: [{ reference: { view: E, field: 'Applicant Id' } }, { reference: { view: A, field: 'Applicant Id' } }] }] },
    });
    console.log('committed revision', call('astrato_semantic_layer_commit_edit_session', { sessionId: SID }).revision);
  } else if (cmd === 'model') {
    const layer = layerId(arg);
    const plan = call('astrato_semantic_layer_plan_authoring_batch', { semanticLayerId: layer, items: ENTITIES.map((e, i) => ({ id: `e${i}`, entity: e.entity, operation: 'create', targetName: e.name, request: e.name })) });
    if (!plan.readyToCommit) throw new Error(`plan not ready: ${JSON.stringify(plan.ambiguities ?? plan).slice(0, 3000)}`);
    const items = ENTITIES.map((e, i) => ({ id: `e${i}`, entity: e.entity, preparedTarget: plan.items[i].preparedTarget ?? null, change: { operation: 'create', name: e.name, definition: e.definition } }));
    const r = call('astrato_semantic_layer_commit_authoring_batch', { semanticLayerId: layer, planId: plan.planId, expectedRevision: plan.revision, items });
    if (!r.committed) throw new Error((r.blockingIssues ?? []).map((i) => `${i.entityKey} :: ${i.code} :: ${i.message}`).join('\n'));
    console.log('committed revision', r.committedRevision);
  } else if (cmd === 'publish') {
    publish(layerId(arg));
  } else {
    console.log('usage: node tools/layer.mjs create <datasourceId> | views [layerId] | model [layerId] | publish [layerId]');
  }
}
