// Stand-in catalogue for kit/verify/compile-check.mjs, built from the published layer document.
import { readFileSync } from 'node:fs';
import { buildTiles, buildTile, compileDefinition } from '../src/dashboard.js';
import { createFieldIndex } from '../src/fields.js';
import { themeVSpec, applyEach, fitRequests } from '../src/theme.js';

const layer = JSON.parse(readFileSync(new URL('../../../../layers/northstar-portfolio/layer.json', import.meta.url), 'utf8'));
const TYPE = { number: 'float', string: 'string', date: 'date', datetime: 'timestamp', timestamp: 'timestamp', boolean: 'boolean', int: 'int', float: 'float' };
const AGGS = [{ name: 'SUM' }, { name: 'COUNT', distinct: true }, { name: 'COUNT' }, { name: 'AVG' }, { name: 'MIN' }, { name: 'MAX' }];
const key = (view, field) => `[${view}].[${field}]`;
const agg = (m) => ({ fieldKeys: (m.arguments ?? []).flatMap((a) => (a.reference ? [key(a.reference.view, a.reference.field)] : [])), aggregation: m.aggregate, ...(m.distinct ? { distinct: true } : {}) });

export const fields = [
  ...Object.entries(layer.views).flatMap(([view, v]) => Object.entries(v.fields).map(([name, f]) => ({
    kind: 'field', fieldKey: key(view, name), name, view, dataType: TYPE[f.dataType] ?? 'string', aggregations: AGGS,
  }))),
  ...Object.entries(layer.dimensions ?? {}).filter(([, d]) => d.reference).map(([name, d]) => ({
    kind: 'dimension', fieldKey: `[dimension].[${name}]`, name,
    item: { key: `[dimension].[${name}]`, name, type: 'dimension', dimension: { view: d.reference.view, name: d.reference.field, fieldKey: key(d.reference.view, d.reference.field), ...(d.dateLevel ? { dateLevel: d.dateLevel } : {}) } },
  })),
  ...Object.entries(layer.measures).map(([name, m]) => ({
    kind: 'calculation', fieldKey: `[calculation].[${name}]`, name,
    item: { key: `[calculation].[${name}]`, name, type: 'calculation', calculation: { calculation: m.expression, measures: Object.keys(m).filter((k) => /^m\d+$/.test(k)).map((k) => agg(m[k])) } },
  })),
];

const index = createFieldIndex(fields);
const built = buildTiles(index);
if (built.failures.length) throw new Error(`tiles not in the layer: ${JSON.stringify(built.failures)}`);

// One ad-hoc object of each kind the Nash page builds at run time. This repeats the tile shape
// of `renderTile` in src/app.js (it is declared inside the app's boot function); keep them alike.
const adhoc = (id, type, spec) => {
  const tile = {
    id, slot: id, page: 'nash', title: id, type, group: 'g-nash', fontSize: type === 'table' ? 12 : undefined,
    dimensions: spec.dims.map(([name, view], i) => ({ name, view, ref: `d${i}` })), measures: spec.measures.map((m, i) => ({ name: m, ref: `m${i}`, format: { formatType: 'numberNoDecimal' } })),
    filters: (spec.filters ?? []).map(([field, view, values]) => ({ view, field, values })), sort: spec.sort, limit: 200,
    legend: spec.measures.length > 1, legendPosition: 'top', orientation: 'horizontal', colors: ['#14283A', '#4E9A8E'],
    ops: type === 'table'
      ? [{ name: 'setTableFixedRowHeightEnabled', payload: true }, { name: 'setTableFixedRowHeightValue', payload: 28 }, ...spec.measures.flatMap((m, i) => [{ name: 'setColumnFormatType', ref: `m${i}`, payload: { formatType: 'custom' } }, { name: 'setColumnFormatString', ref: `m${i}`, payload: { formatString: '#,##0.0' } }, { name: 'setColumnHorizontalAlign', ref: `m${i}`, payload: { horizontalAlign: 'right' } }])]
      : spec.measures.flatMap((m, i) => [{ name: 'setMeasureFormatType', ref: `m${i}`, payload: { formatType: 'custom' } }, { name: 'setMeasureFormatString', ref: `m${i}`, payload: { formatString: '#,##0.0' } }]),
  };
  const out = buildTile(tile, index);
  if (out.failure) throw new Error(out.failure.reason);
  return { ...out.tile, fitColumns: type === 'table' ? Object.fromEntries([...tile.dimensions, ...tile.measures].map((x) => [x.ref, 0.98 / (tile.dimensions.length + tile.measures.length)])) : undefined };
};

export const tiles = [
  ...built.tiles,
  adhoc('adhoc-table', 'table', { dims: [['Company', 'Companies'], ['Fund', 'Companies']], measures: ['Fair Value', 'Revenue LTM'], filters: [['Fund', 'Companies', ['NSC IV']]], sort: { by: 'm0', direction: 'desc' } }),
];

// The same steps the app runs before and after runtime.mount: compile, theme (each operation's
// ref resolved through resolvedRefs), then column widths for tables that fit their slot, then the
// selection mirror on measure-only objects.
export async function prepare(tile, availableFields) {
  const compiled = await compileDefinition(tile.type, tile.definition, availableFields);
  tile = { ...tile, ...compiled };
  const instance = (vSpec) => ({ id: tile.id, type: tile.type, vSpec, dataBinding: {} });
  const themed = await themeVSpec(instance(compiled.vSpec), availableFields, tile);
  // `skipped` is not a refusal: the shared theme asks every chart type for the same operations and
  // leaves out the ones a type does not have.
  const refusals = [...themed.failed];
  let vSpec = themed.vSpec;
  if (tile.fitColumns) {
    const requests = fitRequests({ ...tile, vSpec }, 900);
    const wanted = Object.keys(tile.fitColumns).length + 1;
    if (requests.length !== wanted) refusals.push({ name: 'setColumnWidth', on: 'fit', reason: `${wanted - requests.length} column refs did not resolve` });
    const fitted = await applyEach(instance(vSpec), availableFields, tile.type, requests);
    refusals.push(...fitted.failed.map((f) => ({ ...f, on: 'fit' })), ...fitted.skipped.map((name) => ({ name, on: 'fit', reason: 'not an operation of this type' })));
    vSpec = fitted.vSpec;
  }
  if (tile.type === 'number' || (tile.type === 'table' && !(tile.fieldKeys ?? []).length)) {
    const payload = { operator: 'and', filters: [{ operator: 'or', filters: [{ fieldKey: '[Companies].[Fund]', operator: 'equals', values: { value: 'NSC IV' } }] }] };
    const mirrored = await applyEach(instance(vSpec), availableFields, tile.type, [{ name: 'setStaticFilterGroup', payload }]);
    refusals.push(...mirrored.failed.map((f) => ({ ...f, on: 'mirror' })), ...mirrored.skipped.map((name) => ({ name, on: 'mirror', reason: 'not an operation of this type' })));
  }
  return { vSpec, refusals };
}
