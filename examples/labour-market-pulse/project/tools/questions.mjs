/**
 * Builds the layer batch for the app: the measures the catalogue needs beyond tools/layer-measures.mjs,
 * and one stored business question per tile (named with the card's question).
 *
 *   node tools/questions.mjs > tools/questions-batch.json
 *
 * The batch is committed over MCP (astrato_semantic_layer_commit_authoring_batch); afterwards each
 * question is read back with astrato_semantic_layer_get_question and src/questions.js is written
 * from those responses (tools/sync-questions.mjs).
 */
import { TILES } from '../src/catalogue.js';

const V = 'Labour Market';
const f = (field) => ({ view: V, field });
const prevSet = { id: 'p', field: f('Value Prev Year'), operator: 'is_set' };
const guarded = (name, conditions, pattern, description, cat) => ({
  entity: 'measure', name, definition: {
    description, categories: [cat], expression: 'cur - prev', format: { mode: 'custom', pattern },
    inputs: [
      { id: 'cur', kind: 'aggregate', aggregation: 'AVG', field: f('Value'), filter: { conditions: [...conditions, prevSet] } },
      { id: 'prev', kind: 'aggregate', aggregation: 'AVG', field: f('Value Prev Year'), filter: { conditions: [...conditions, prevSet] } },
    ],
  },
});
const ind = (value) => ({ id: 'i', field: f('Indicator'), operator: 'equals', value });

export const MEASURES = [
  { entity: 'measure', name: 'Unemployed per Vacancy Pre-Pandemic', definition: {
    description: 'Unemployed people per vacancy (JPC5) in Dec-Feb 2020, before the pandemic. A reference level for the trend.', categories: ['Vacancies'],
    inputs: [{ id: 'v', kind: 'aggregate', aggregation: 'AVG', field: f('Value Pre Pandemic'), filter: { conditions: [{ id: 'c', field: f('Cdid'), operator: 'equals', value: 'JPC5' }] } }],
    format: { mode: 'custom', pattern: '0.0' } } },
  { entity: 'measure', name: 'Redundancies (000s)', definition: {
    description: 'UK redundancies in the three months to the period, thousands (indicator "Redundancies").', categories: ['Unemployment'],
    inputs: [{ id: 'v', kind: 'aggregate', aggregation: 'AVG', field: f('Value'), filter: { conditions: [ind('Redundancies')] } }],
    format: { mode: 'custom', pattern: '#,##0"k"' } } },
  guarded('Redundancies Change on Year (000s)', [ind('Redundancies')], '+#,##0"k";-#,##0"k";0"k"', 'UK redundancies (000s) minus the value 12 months earlier. Empty where there is no prior year.', 'Unemployment'),
  guarded('Sector Vacancy Change on Year (000s)', [{ id: 's', field: f('Indicator'), operator: 'like', value: 'Vacancies: *' }], '+#,##0"k";-#,##0"k";0"k"', 'Change in a sector\'s vacancies on a year earlier, thousands. Use with Indicator. Empty where there is no prior year.', 'Vacancies'),
  guarded('Regional Employment Change on a Year Earlier', [{ id: 't', field: f('Theme'), operator: 'equals', value: 'Regional' }, ind('Employment rate (16-64)')], '+0.0" pp";-0.0" pp";0.0" pp"', 'Change in a region\'s 16-64 employment rate on a year earlier, percentage points, counting only rows with a reading a year earlier.', 'Regional'),
];

const OP = { equals: 'equals', contains: 'contains', greaterThanOrEqual: 'greaterThanOrEqual' };
const LATEST = { field: 'Period Status', op: 'equals', value: 'Latest' };
const CHART = { number: 'kpi', line: 'line', bar: 'bar', table: 'table', heatMap: 'heatmap' };

export const questionOf = (tile) => {
  const filters = [...(tile.filters ?? []), ...(tile.latest && !(tile.filters ?? []).some((x) => x.field === 'Period Status') ? [LATEST] : [])];
  const def = {
    question: tile.q,
    description: tile.description ?? tile.label ?? tile.q,
    categories: ['Labour Market Pulse', tile.tab],
    dimensions: (tile.dims ?? []).map((d) => ({ key: d.ref, reference: { dimension: d.d } })),
    measures: tile.measures.map((m) => ({
      key: m.ref, reference: { measure: m.m },
      ...(m.moving ? { advancedCalculation: { movingCalculation: { aggregate: m.moving.aggregate, windowBegin: m.moving.windowBegin, windowEnd: m.moving.windowEnd } } } : {}),
      ...(m.rank ? { advancedCalculation: { rank: { direction: m.rank } } } : {}),
    })),
    preferredCharts: [{ type: CHART[tile.type] ?? 'table' }],
  };
  if (filters.length) {
    const names = filters.map((_, i) => `f${i + 1}`);
    def.filters = { expression: names.map((n) => `{${n}}`).join(' AND ') };
    filters.forEach((x, i) => { def.filters[names[i]] = { operator: OP[x.op], arguments: [{ reference: { dimension: x.field } }, { value: x.value }] }; });
  }
  if (tile.sort) def.orderBy = tile.sort.map((s) => ({ reference: (tile.dims ?? []).some((d) => d.ref === s.by) ? { dimension: s.by } : { measure: s.by }, direction: s.direction === 'desc' ? 'descending' : 'ascending' }));
  return def;
};

const seen = new Set();
const questions = [];
for (const tile of TILES) {
  if (tile.existing || seen.has(tile.q)) continue;
  seen.add(tile.q);
  questions.push({ entity: 'businessQuestion', name: tile.q, definition: questionOf(tile) });
}

if (process.argv[1]?.endsWith('questions.mjs')) {
  const items = [...MEASURES, ...questions].map((x, i) => ({ id: `i${i}`, entity: x.entity, preparedTarget: null, change: { operation: 'create', name: x.name, definition: x.definition, ...(x.entity === 'businessQuestion' ? { ifExists: 'skip' } : {}) } }));
  console.log(JSON.stringify(items));
  console.error(`${MEASURES.length} measures, ${questions.length} questions`);
}
