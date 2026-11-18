// Adapter for the playbook kit's compile-check.mjs (`npm run compile-check`).
// Field catalogue: the real one the smoke test saved (copied to tools/available-fields.json) when present,
// otherwise a stand-in written from the published layer (rev 16) as read over MCP.
// prepare() is the app's own path: compile (buildTiles) → theme → governed parameters → table widths.
import { existsSync, readFileSync } from 'node:fs';
import { buildTiles } from '../src/catalogue.js';
import { createFieldIndex } from '../src/fields.js';
import { fitTile, prepareTile } from '../src/prepare.js';

const AGGS = [{ name: 'SUM' }, { name: 'COUNT', distinct: true }, { name: 'AVG' }, { name: 'MIN' }, { name: 'MAX' }];
const RAW = {
  UNI_FACT: { 'University (Short)': 'string', University: 'string', Nation: 'string', 'University Group': 'string', 'Rank Band': 'string', Movement: 'string', 'Rank 2027': 'int', 'Total Score': 'float', 'University ID': 'int' },
  UNI_HISTORY_FACT: { Edition: 'int', 'Edition Date': 'date', 'Historic Rank': 'int', 'History University (Short)': 'string' },
};
const DIMS = {
  'University (Short)': ['UNI_FACT', 'University (Short)'], University: ['UNI_FACT', 'University'], Nation: ['UNI_FACT', 'Nation'], 'University Group': ['UNI_FACT', 'University Group'],
  'Rank Band': ['UNI_FACT', 'Rank Band'], Movement: ['UNI_FACT', 'Movement'], 'Rank 2027': ['UNI_FACT', 'Rank 2027'], 'Total Score (2027)': ['UNI_FACT', 'Total Score'], Edition: ['UNI_HISTORY_FACT', 'Edition'],
};
const CALCS = ['Rank (value)', 'Rank Change (value)', 'Rank 2026 (value)', 'Historic Rank', 'Avg Rank 2027', 'Avg Rank 2026', 'Avg Places Gained', 'Avg Historic Rank', 'Climbers', 'Climbers 2026', 'Climbers Change',
  'Fallers', 'Fallers 2026', 'Fallers Change', 'Universities', 'Avg Total Score', 'Avg Research', 'Avg Entry Points', 'Avg Graduate Prospects', 'Avg Experience', 'Avg Teaching', 'Avg Firsts', 'Avg Continuation',
  'Research vs Set Average', 'Entry vs Set Average', 'Prospects vs Set Average', 'Experience vs Set Average', 'Projected Rank at Score', 'Score Gap to Benchmark'];
// The two parameterised measures, as the layer declares them.
const PARAMS = { 'Projected Rank at Score': 'score', 'Score Gap to Benchmark': 'benchmark' };
const key = (v, f) => `[${v}].[${f}]`;
const standIn = [
  ...Object.entries(RAW).flatMap(([view, fs]) => Object.entries(fs).map(([name, dataType]) => ({ kind: 'field', fieldKey: key(view, name), name, view, dataType, aggregations: AGGS }))),
  ...Object.entries(DIMS).map(([name, [view, field]]) => ({ kind: 'dimension', fieldKey: `[dimension].[${name}]`, name, item: { key: `[dimension].[${name}]`, name, type: 'dimension', dimension: { view, name: field, fieldKey: key(view, field), resultType: RAW[view][field] } } })),
  ...CALCS.map((name) => ({ kind: 'calculation', fieldKey: `[calculation].[${name}]`, name, item: { key: `[calculation].[${name}]`, name, type: 'calculation', calculation: { calculation: '{m1}', resultType: 'float', measures: [{ fieldKeys: ['[UNI_FACT].[Total Score]'], aggregation: 'AVG', resultType: 'float' }], ...(PARAMS[name] ? { params: [{ name: PARAMS[name], dataType: 'float', value: '0' }] } : {}) } } })),
];

const saved = new URL('./available-fields.json', import.meta.url);
export const fields = existsSync(saved) ? JSON.parse(readFileSync(saved, 'utf8')) : standIn;
const OUR_SCORE = 572; // the default university's 2027 total score, as the app reads it at boot

const built = await buildTiles(createFieldIndex(fields), 'Kent');
if (built.failures.length) console.log('BUILD FAILURES', JSON.stringify(built.failures, null, 1));
export const tiles = built.tiles;

export async function prepare(tile, availableFields) {
  const { vSpec, failed } = await prepareTile(tile, availableFields, { ourScore: OUR_SCORE });
  // Both width regimes: wide, and narrow (font drop, hidden columns, labels dropped).
  const wide = await fitTile(tile, vSpec, availableFields, 800);
  const narrow = await fitTile(tile, vSpec, availableFields, 240);
  const fitted = { vSpec: wide.vSpec, failed: [...wide.failed, ...narrow.failed] };
  return { vSpec: fitted.vSpec, refusals: [...failed, ...fitted.failed] };
}
