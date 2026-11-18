// Adapter for the playbook kit's compile-check.mjs (`npm run compile-check`).
// Field catalogue: the real one the smoke test saved (tools/available-fields.json) when present,
// otherwise a stand-in written from the published layer (rev 10) as read over MCP.
// prepare() is the app's own path: compile (buildTiles) → theme → parameters → table widths.
import { existsSync, readFileSync } from 'node:fs';
import { buildTiles } from '../src/catalogue.js';
import { createFieldIndex } from '../src/fields.js';
import { fitTile, prepareTile } from '../src/prepare.js';

const AGGS = [{ name: 'SUM' }, { name: 'COUNT', distinct: true }, { name: 'AVG' }, { name: 'MIN' }, { name: 'MAX' }];
const RAW = {
  'Resort Weeks': { 'Week ID': 'string', 'Resort ID': 'string', 'Snowfall 7D Cm': 'int', 'Crowd Index': 'int', 'Base Depth Cm': 'int' },
  Resorts: { 'Resort Name': 'string', Country: 'string', 'Gateway Airport': 'string' },
  'Season Weeks': { Season: 'string', 'Season Week': 'int', 'Week Start': 'date', 'Holiday Week': 'int' },
};
const DIMS = {
  Resort: ['Resorts', 'Resort Name', 'string'], Country: ['Resorts', 'Country', 'string'], 'Gateway Airport': ['Resorts', 'Gateway Airport', 'string'],
  'Season Week': ['Season Weeks', 'Season Week', 'int'], Week: ['Season Weeks', 'Week Start', 'date'], 'Season Stage': ['Season Weeks', 'Season_Stage', 'string'],
  'Week Type': ['Season Weeks', 'Week_Type', 'string'], 'Snowfall Band': ['Resort Weeks', 'Snowfall_Band', 'string'], 'Crowd Level': ['Resort Weeks', 'Crowd_Level', 'string'],
};
const CALCS = ['Snowfall This Season', 'Snowfall Last Season', 'Snowfall Change vs Last Season', 'Total Snowfall', 'Crowd Index This Season', 'Crowd Index Last Season', 'Crowd Index Change vs Last Season',
  'Avg Crowd Index', 'Base Depth This Season', 'Base Depth Change vs Last Season', 'Avg Base Depth', 'Quiet Powder Weeks This Season', 'Quiet Powder Weeks Change vs Last Season', 'Quiet Powder Weeks',
  'Overall Week Score This Season', 'Overall Week Score Change vs Last Season', 'Overall Week Score', 'Avg Weekly Snowfall', 'Demand Headroom This Season', 'Demand Headroom', 'Avg Trip Cost',
  'Avg Snow Score', 'Avg Value Score', 'Avg Quiet Score', 'Avg Family Score', 'Avg Expert Score', 'Holiday Crowd Uplift This Season', 'Holiday Crowd Uplift Change vs Last Season', 'Resort Weeks',
  'Share of Quiet Powder Weeks', 'Target Weeks', 'Suggested Budget',
  // layer revision 10
  'Target Weeks This Season', 'Target Weeks Last Season', 'Target Weeks Change vs Last Season', 'Suggested Budget at Default Rule'];
const RULE = ['minSnow', 'maxCrowd'];
const PARAMS = { 'Suggested Budget': ['budget', ...RULE], 'Target Weeks': RULE, 'Target Weeks This Season': RULE, 'Target Weeks Last Season': RULE, 'Target Weeks Change vs Last Season': RULE };
const key = (v, f) => `[${v}].[${f}]`;
const standIn = [
  ...Object.entries(RAW).flatMap(([view, fs]) => Object.entries(fs).map(([name, dataType]) => ({ kind: 'field', fieldKey: key(view, name), name, view, dataType, aggregations: AGGS }))),
  ...Object.entries(DIMS).map(([name, [view, field, resultType]]) => ({ kind: 'dimension', fieldKey: `[dimension].[${name}]`, name, item: { key: `[dimension].[${name}]`, name, type: 'dimension', dimension: { view, name: field, fieldKey: key(view, field), resultType } } })),
  ...CALCS.map((name) => ({ kind: 'calculation', fieldKey: `[calculation].[${name}]`, name, item: { key: `[calculation].[${name}]`, name, type: 'calculation', calculation: { calculation: '{m1}', resultType: 'float', measures: [{ fieldKeys: ['[Resort Weeks].[Crowd Index]'], aggregation: 'AVG', resultType: 'float' }], ...(PARAMS[name] ? { params: PARAMS[name].map((p) => ({ name: p, dataType: 'float', value: '0' })) } : {}) } } })),
];

const saved = new URL('./available-fields.json', import.meta.url);
export const fields = existsSync(saved) ? JSON.parse(readFileSync(saved, 'utf8')) : standIn;

const built = await buildTiles(createFieldIndex(fields));
if (built.failures.length) console.log('BUILD FAILURES', JSON.stringify(built.failures, null, 1));
export const tiles = built.tiles;

export async function prepare(tile, availableFields) {
  const { vSpec, failed } = await prepareTile(tile, availableFields, {});
  const wide = await fitTile(tile, vSpec, availableFields, 800);
  const narrow = await fitTile(tile, vSpec, availableFields, 300);
  return { vSpec: wide.vSpec, refusals: [...failed, ...wide.failed, ...narrow.failed] };
}
