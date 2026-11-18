// Adapter for kit/verify/compile-check.mjs: every tile, governed and DuckDB, through the app's own prepare().
//
// Governed catalogue: the real one the smoke test saved (tools/available-fields.json) when it exists,
// otherwise a stand-in for the items the tiles name. DuckDB catalogue: the app's own (duck-engine.js).
import { existsSync, readFileSync } from 'node:fs';
import { createVisualizationAvailableFields } from '@astrato-io/visualizations/definitions';
import { createFieldIndex } from '../src/fields.js';
import * as duck from '../src/duck-engine.js';
import { TILES, FILTERS, PARAMS, resolver, prepare as prepareTile } from '../src/tiles.js';

const saved = new URL('./available-fields.json', import.meta.url);
const standIn = () => {
  const AGGS = [{ name: 'SUM' }, { name: 'COUNT' }, { name: 'AVG' }, { name: 'MIN' }, { name: 'MAX' }];
  const raw = [['Hotels', 'City', 'string'], ['Calendar', 'Stay Date', 'date'], ['Calendar', 'Rolling Bucket', 'string']]
    .map(([view, name, dataType]) => ({ kind: 'field', fieldKey: `[${view}].[${name}]`, name, view, dataType, aggregations: AGGS }));
  const dims = [['City', 'Hotels'], ['Stay Date', 'Calendar']].map(([name, view]) => ({
    kind: 'dimension', fieldKey: `[dimension].[${name}]`, name,
    item: { key: `[dimension].[${name}]`, name, type: 'dimension', dimension: { view, name, fieldKey: `[${view}].[${name}]` } },
  }));
  const measures = ['Occupancy L3M', 'Occupancy L3M vs LY', 'Room Revenue L3M', 'Room Revenue L3M YoY'].map((name) => ({
    kind: 'calculation', fieldKey: `[calculation].[${name}]`, name,
    item: { key: `[calculation].[${name}]`, name, type: 'calculation', calculation: { calculation: '{m1}' } },
  }));
  return [...raw, ...dims, ...measures];
};

export const fields = existsSync(saved) ? JSON.parse(readFileSync(saved, 'utf8')) : standIn();
const duckFields = createVisualizationAvailableFields(duck.FIELD_METADATA).filter((f) => f?.resultType !== 'unhandled');
const govResolver = resolver('gov', createFieldIndex(fields), duck);
const duckResolver = resolver('duck', null, duck);

export const tiles = [...TILES, ...FILTERS];

// The app's path: pick the source's catalogue and resolver, then compile → operations.
export async function prepare(tile, govFields) {
  const gov = tile.src === 'gov';
  const params = Object.fromEntries(Object.entries(PARAMS).map(([k, p]) => [k, p.fallback]));
  return prepareTile(tile, gov ? govResolver : duckResolver, gov ? govFields : duckFields, { params });
}
