/** Build the Northstar Portfolio OS layer. Run: node tools/layer.mjs <create|views|model|schema|validate|publish> [layerId] [rev] */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { VIEWS, ENTITIES as MEASURES, DIMS, JOINS, title } from './entities.mjs';

const ENTITIES = process.env.DIMS ? DIMS : MEASURES;
const CLIENT = fileURLToPath(new URL('./mcp.mjs', import.meta.url));
export const call = (tool, args) => {
  const file = join(tmpdir(), `mcr-${process.pid}-${tool}.json`);
  writeFileSync(file, JSON.stringify(args));
  const out = execFileSync(process.execPath, [CLIENT, tool, `@${file}`], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const parsed = JSON.parse(out);
  if (!parsed.ok) throw new Error(`${tool}: ${out.slice(0, 3000)}`);
  return parsed.data;
};
// Types read from Snowflake INFORMATION_SCHEMA (tools/types.txt), never hand-declared.
const TYPES = Object.fromEntries(readFileSync(new URL('./types.txt', import.meta.url), 'utf8').trim().split(/\s+/).map((p) => p.split('=')));

const [cmd, layerArg, rev] = process.argv[1]?.endsWith("layer.mjs") ? process.argv.slice(2) : [];
const LAYER = layerArg && layerArg.length > 20 ? layerArg : (() => { try { return JSON.parse(readFileSync(new URL('../astrato.json', import.meta.url), 'utf8')).semanticLayerId; } catch { return null; } })();

if (cmd === 'create') console.log(JSON.stringify(call('astrato_semantic_layer_create', { name: 'Northstar – Private Markets Portfolio OS', datasourceId: '00000000-0000-0000-0000-000000000000' })));
if (cmd === 'views') {
  const SID = call('astrato_semantic_layer_begin_edit_session', { semanticLayerId: LAYER, label: 'views' }).sessionId;
  for (const [name, [table, cols]] of Object.entries(VIEWS)) {
    call('astrato_semantic_layer_apply_edit', { sessionId: SID, operation: 'upsert_view', payload: { name, source: { type: 'table', database: 'ASTRATO_GALLERY', schema: 'MOCK_DATA', table } } });
    for (const col of cols.split(' ')) {
      const dataType = TYPES[`${table}.${col}`];
      if (!dataType) throw new Error(`no type for ${table}.${col}`);
      call('astrato_semantic_layer_apply_edit', { sessionId: SID, operation: 'upsert_field', viewName: name, payload: { name: title(col), source: col, dataType } });
    }
    console.log('view', name, cols.split(' ').length, 'fields');
  }
  for (const j of JOINS) console.log('join', j.from, '->', j.to, JSON.stringify(call('astrato_semantic_layer_apply_edit', { sessionId: SID, operation: 'upsert_join', payload: { views: [j.from, j.to], cardinality: 'many-to-one', conditions: [{ operator: 'equals', arguments: [{ reference: { view: j.from, field: j.field } }, { reference: { view: j.to, field: j.field } }] }] } })).slice(0, 160));
  console.log('commit', JSON.stringify(call('astrato_semantic_layer_commit_edit_session', { sessionId: SID })).slice(0, 800));
}
if (cmd === 'model') {
  const only = process.argv[4] ? new Set(process.argv[4].split('|')) : null;
  const list = ENTITIES.filter((e) => !only || only.has(e.name)).slice(Number(process.env.SKIP ?? 0));
  for (let at = 0; at < list.length; at += 45) {
    const chunk = list.slice(at, at + 45);
    const plan = call('astrato_semantic_layer_plan_authoring_batch', { semanticLayerId: LAYER, items: chunk.map((e, i) => ({ id: `e${i}`, entity: e.entity, operation: 'create', targetName: e.name, request: e.name })) });
    if (!plan.readyToCommit) throw new Error(`plan not ready: ${JSON.stringify(plan.ambiguities ?? plan).slice(0, 3000)}`);
    const items = chunk.map((e, i) => ({ id: `e${i}`, entity: e.entity, preparedTarget: plan.items[i].preparedTarget ?? null, change: { operation: 'create', name: e.name, definition: e.definition } }));
    const r = call('astrato_semantic_layer_commit_authoring_batch', { semanticLayerId: LAYER, planId: plan.planId, expectedRevision: plan.revision, items });
    if (!r.committed) { console.log(JSON.stringify({ issues: r.issues, v: r.validation, b: r.blockingIssues, d: r.diagnostics, e: r.errors, keys: Object.keys(r) }).slice(0, 2500)); for (const i of r.blockingIssues ?? []) console.log(`${i.entityKey} :: ${i.code} :: ${i.message}`); process.exit(1); }
    console.log('committed', chunk.length, 'at revision', r.committedRevision);
  }
}
if (cmd === 'schema') console.log(JSON.stringify(call('astrato_semantic_layer_check_source_schema', { semanticLayerId: LAYER })).slice(0, 4000));
if (cmd === 'validate') console.log(JSON.stringify(call('astrato_semantic_layer_validate', { semanticLayerId: LAYER })).slice(0, 3000));
if (cmd === 'publish') {
  console.log(JSON.stringify(call('astrato_semantic_layer_validate', { semanticLayerId: LAYER })).slice(0, 1500));
  console.log(JSON.stringify(call('astrato_semantic_layer_publish', { semanticLayerId: LAYER, expectedRevision: Number(rev) })).slice(0, 1500));
}
