/** Commit src/questions.js to the semantic layer as stored business questions (create or replace). node tools/questions.mjs [i,j] */
import { readFileSync } from 'node:fs';
import { call } from './layer.mjs';
import { QUESTIONS } from '../src/questions.js';

const LAYER = JSON.parse(readFileSync(new URL('../astrato.json', import.meta.url), 'utf8')).semanticLayerId;
const dref = (x) => (x.view ? { view: x.view, field: x.field } : { dimension: x.name });
const cond = ({ dimension, operator, values }) => ({ operator, arguments: [{ reference: { dimension } }, ...values.map((v) => ({ value: v }))] });
const filtersOf = (list) => { const named = Object.fromEntries(list.map((c, i) => [`f${i + 1}`, cond(c)])); return { expression: Object.keys(named).map((k) => `{${k}}`).join(' AND '), ...named }; };
const orderOf = ([key, direction, kind]) => ({ reference: kind === 'dim' ? { dimension: key } : { measure: key }, direction: direction === 'asc' ? 'ascending' : 'descending' });
const definitionOf = (q) => ({
  description: q.description, question: q.name, categories: ['Northstar Portfolio OS', q.cat],
  dimensions: q.dimensions.map((x) => ({ key: x.key, reference: dref(x) })),
  measures: q.measures.map(({ name, key }) => ({ key, reference: { measure: name } })),
  ...(q.filters?.length ? { filters: filtersOf(q.filters) } : {}),
  ...(q.orderBy ? { orderBy: q.orderBy.map(orderOf) } : {}),
  preferredCharts: [{ type: q.chart }],
});
const only = process.argv[2] ? new Set(process.argv[2].split(',').map(Number)) : null;
const list = QUESTIONS.filter((_, i) => !only || only.has(i));
const existing = new Set((call('astrato_semantic_layer_list_questions', { semanticLayerId: LAYER }).items ?? []).map((item) => item.title ?? item.name ?? item.id));
const op = (q) => (existing.has(q.name) ? 'replace' : 'create');
const plan = call('astrato_semantic_layer_plan_authoring_batch', { semanticLayerId: LAYER, items: list.map((q, i) => ({ id: `bq${i}`, entity: 'businessQuestion', operation: op(q), targetName: q.name, request: q.name })) });
if (!plan.readyToCommit) throw new Error(`plan not ready: ${JSON.stringify(plan.ambiguities ?? plan).slice(0, 3000)}`);
const items = list.map((q, i) => ({ id: `bq${i}`, entity: 'businessQuestion', preparedTarget: plan.items[i].preparedTarget ?? null, change: { operation: op(q), name: q.name, definition: definitionOf(q) } }));
const result = call('astrato_semantic_layer_commit_authoring_batch', { semanticLayerId: LAYER, planId: plan.planId, expectedRevision: plan.revision, items });
if (!result.committed) { console.log(JSON.stringify(result).slice(0, 3000)); process.exit(1); }
console.log(`committed ${items.length} questions at revision ${result.committedRevision}`);
