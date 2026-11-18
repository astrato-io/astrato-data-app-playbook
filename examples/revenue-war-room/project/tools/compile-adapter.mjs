// Stand-in catalogue for kit/verify/compile-check.mjs, built from the published layer document.
import { readFileSync } from 'node:fs';
import { buildTiles, compileDefinition } from '../src/charts.js';
import { createFieldIndex } from '../src/lib/fields.js';
import { themeVSpec } from '../src/lib/theme.js';
import { objects, prepareTile, withRefs } from '../src/objects.js';

const layer = JSON.parse(readFileSync(new URL('../../../../layers/live-gallery/layer.json', import.meta.url), 'utf8'));
const TYPE = { number: 'float', string: 'string', date: 'date', datetime: 'datetime', boolean: 'boolean', int: 'int', float: 'float' };
const AGGS = [{ name: 'SUM' }, { name: 'COUNT', distinct: true }, { name: 'COUNT' }, { name: 'AVG' }, { name: 'MIN' }, { name: 'MAX' }];
const key = (view, field) => `[${view}].[${field}]`;
const agg = (m) => ({ fieldKeys: (m.arguments ?? []).flatMap((a) => (a.reference ? [key(a.reference.view, a.reference.field)] : [])), aggregation: m.aggregate, ...(m.distinct ? { distinct: true } : {}) });

export const fields = [
  ...Object.entries(layer.views).flatMap(([view, v]) => Object.entries(v.fields).map(([name, f]) => ({
    kind: 'field', fieldKey: key(view, name), name, view, dataType: TYPE[f.dataType] ?? 'string', aggregations: AGGS,
  }))),
  ...Object.entries(layer.dimensions).map(([name, d]) => ({
    kind: 'dimension', fieldKey: `[dimension].[${name}]`, name,
    item: { key: `[dimension].[${name}]`, name, type: 'dimension', dimension: { ...(d.reference ? { view: d.reference.view, name: d.reference.field, fieldKey: key(d.reference.view, d.reference.field) } : {}), ...(d.dateLevel ? { dateLevel: d.dateLevel } : {}) } }, // period-axis dimensions have no single column
  })),
  ...Object.entries(layer.measures).map(([name, m]) => ({
    kind: 'calculation', fieldKey: `[calculation].[${name}]`, name,
    item: { key: `[calculation].[${name}]`, name, type: 'calculation', calculation: { calculation: m.expression, measures: Object.keys(m).filter((k) => /^m\d+$/.test(k)).map((k) => agg(m[k])) } },
  })),
];

const index = createFieldIndex(fields);
const built = buildTiles(index, objects());
for (const f of built.failures) console.log('UNRESOLVED', f.id, f.reason);
// A tile whose fields did not resolve must fail the check, not vanish from it.
export const tiles = [...built.tiles, ...built.failures.map((f) => ({ id: f.id, type: 'unresolved', unresolved: f.reason }))];

// Stand-in reference values: in the app these come from governed queries (loadRefs in app.js).
const line = (value, text) => ({ value, stroke: '#BA0517', strokeWidth: 2, showOob: true, label: { text, showValue: false, fontSize: 11, fill: '#BA0517', align: 'right', vAlign: 'bottom', padding: 4 } });
const REFS = { target: [line(48e6, 'Target')], gap: [line(3e6, 'Gap')], quarters: [line(48e6, 'Q4 target'), line(41e6, 'Q3 target')] };

// The same steps the app runs before runtime.mount: compile, theme and tile operations, axis range,
// column widths, supporting-measure sort, reference lines (prepareTile and withRefs in src/objects.js).
export async function prepare(tile, availableFields) {
  if (tile.unresolved) throw new Error(tile.unresolved);
  const ctx = { availableFields, fields: index, dataBinding: {}, widthOf: () => 800 };
  const compiled = { ...tile, ...(await compileDefinition(tile.type, tile.definition, availableFields)) };
  const { tile: prepared, refusals } = await prepareTile(ctx, compiled);
  const vSpec = await withRefs(ctx, prepared, prepared.vSpec, REFS, refusals);
  if (tile.refKey && !vSpec.refLines?.[tile.refAxis]?.length) refusals.push({ name: 'refLines', reason: 'the reference lines did not survive the axis-range operations' });
  if (tile.supportSort && vSpec.querySettings?.sortingOrder?.[0]?.dataItem?.internalKey !== vSpec.supportingMeasures?.at(-1)?.dataItem?.internalKey) refusals.push({ name: 'supportSort', reason: 'the supporting measure is not first in the sort order' });
  // The underlying-data table each chart declares (dataTable) is compiled and themed too.
  if (tile.dataTable) {
    const table = await compileDefinition('table', tile.dataTable.definition, availableFields);
    const t = await themeVSpec({ id: tile.dataTable.id, type: 'table', vSpec: table.vSpec, dataBinding: {} }, availableFields, { ...tile.dataTable, ...table, type: 'table' });
    refusals.push(...t.failed.map((f) => ({ ...f, on: 'dataTable' })));
  }
  return { vSpec, refusals };
}
