// Stand-in catalogue for kit/verify/compile-check.mjs, built from the published layer document.
import { readFileSync } from 'node:fs';
import { buildTiles, compileDefinition } from '../src/dashboard.js';
import { createFieldIndex } from '../src/fields.js';
import { themeVSpec } from '../src/theme.js';

const layer = JSON.parse(readFileSync(new URL('../../../../layers/keystone-lending/layer.json', import.meta.url), 'utf8'));
const TYPE = { number: 'float', string: 'string', date: 'date', datetime: 'datetime', boolean: 'boolean', int: 'int', float: 'float' };
const AGGS = [{ name: 'SUM' }, { name: 'COUNT', distinct: true }, { name: 'COUNT' }, { name: 'AVG' }, { name: 'MIN' }, { name: 'MAX' }];
const key = (view, field) => `[${view}].[${field}]`;
const agg = (m) => ({ fieldKeys: (m.arguments ?? []).map((a) => key(a.reference.view, a.reference.field)), aggregation: m.aggregate, ...(m.distinct ? { distinct: true } : {}) });

export const fields = [
  ...Object.entries(layer.views).flatMap(([view, v]) => Object.entries(v.fields).map(([name, f]) => ({
    kind: 'field', fieldKey: key(view, name), name, view, dataType: TYPE[f.dataType] ?? 'string', aggregations: AGGS,
  }))),
  ...Object.entries(layer.dimensions).map(([name, d]) => ({
    kind: 'dimension', fieldKey: `[dimension].[${name}]`, name,
    item: { key: `[dimension].[${name}]`, name, type: 'dimension', dimension: { view: d.reference.view, name: d.reference.field, fieldKey: key(d.reference.view, d.reference.field), ...(d.dateLevel ? { dateLevel: d.dateLevel } : {}) } },
  })),
  ...Object.entries(layer.measures).map(([name, m]) => ({
    kind: 'calculation', fieldKey: `[calculation].[${name}]`, name,
    item: { key: `[calculation].[${name}]`, name, type: 'calculation', calculation: { calculation: m.expression, measures: Object.keys(m).filter((k) => /^m\d+$/.test(k)).map((k) => agg(m[k])) } },
  })),
];

const built = buildTiles(createFieldIndex(fields));
export const tiles = built.tiles;

// The same two steps the app runs before runtime.mount: compile, then theme.
export async function prepare(tile, availableFields) {
  const compiled = await compileDefinition(tile.type, tile.definition, availableFields);
  const { vSpec } = compiled;
  tile = { ...tile, ...compiled }; // themeVSpec resolves each op's ref through resolvedRefs
  const themed = await themeVSpec({ id: tile.id, type: tile.type, vSpec, dataBinding: {} }, availableFields, tile);
  // `skipped` is not a refusal: the shared theme asks every chart type for the same operations and
  // leaves out the ones a type does not have (bar charts have no label-colour operations).
  const refusals = [...themed.failed];
  if (tile.dataTable) {
    const table = await compileDefinition('table', tile.dataTable.definition, availableFields);
    const t = await themeVSpec({ id: tile.dataTable.id, type: 'table', vSpec: table.vSpec, dataBinding: {} }, availableFields, { ...tile, type: 'table' });
    refusals.push(...t.failed.map((f) => ({ ...f, on: 'dataTable' })));
  }
  return { vSpec: themed.vSpec, refusals };
}
