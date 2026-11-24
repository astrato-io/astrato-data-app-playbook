/**
 * One stored business question per tile, named with the card's question.
 *   node tools/questions.mjs > tools/questions-batch.json
 * Committed over MCP (astrato_semantic_layer_commit_authoring_batch), then run with
 * astrato_semantic_layer_execute_question to check them.
 * Adapted from the ed-wait-watch example tools/questions.mjs.
 */
import { TILES } from '../src/catalogue.js';

const CHART = { number: 'kpi', line: 'line', bar: 'bar', table: 'table' };
export const questionOf = (tile) => {
  const def = {
    question: tile.q,
    description: tile.description ?? `${tile.label ?? tile.q}.`,
    categories: ['Trading Desk', tile.tab],
    dimensions: (tile.dims ?? []).map((d) => ({ key: d.ref, reference: { dimension: d.d } })),
    measures: [...tile.measures, ...(tile.spark ? [tile.spark] : [])].map((m) => ({
      key: m.ref, reference: { measure: m.m },
      ...(m.rank ? { advancedCalculation: { rank: { direction: m.rank } } } : {}),
      ...(m.rank ? { format: { pattern: '0' } } : {}),
    })),
    preferredCharts: [{ type: tile.stacked ? 'stacked_bar' : (CHART[tile.type] ?? 'table') }],
  };
  if (tile.topN) def.defaults = { topN: tile.topN, ranking: { reference: { measure: tile.measures[0].ref }, direction: 'descending' } };
  if (tile.sort) def.orderBy = tile.sort.map((s) => ({ reference: (tile.dims ?? []).some((d) => d.ref === s.by) ? { dimension: s.by } : { measure: s.by }, direction: s.direction === 'desc' ? 'descending' : 'ascending' }));
  return def;
};

const seen = new Set();
const items = [];
for (const tile of TILES) {
  if (seen.has(tile.q)) continue;
  seen.add(tile.q);
  items.push({ id: `q${items.length}`, entity: 'businessQuestion', preparedTarget: null, change: { operation: 'create', name: tile.q, definition: questionOf(tile), ifExists: 'skip' } });
}
process.stdout.write(JSON.stringify(items));
process.stderr.write(`${items.length} questions\n`);
