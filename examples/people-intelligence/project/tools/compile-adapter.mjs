// Adapter for kit/verify/compile-check.mjs: compiles every catalogue tile, and every starter report of
// the custom report builder, through the app's own code path, offline.
//
// Field catalogue: the real one, saved by the smoke test (`appState.fields`) as
// shots/available-fields.json and copied to tools/available-fields.json.
import { readFileSync } from 'node:fs';
import { buildTiles, buildTile, compileDefinition } from '../src/dashboard.js';
import { createFieldIndex } from '../src/fields.js';
import { themeVSpec, applyEach } from '../src/theme.js';
import { adhocTile, fitColumnOps } from '../src/adhoc.js';
import { TEMPLATES, reportSpec } from '../src/builder.js';
import { DIM_FIELD } from '../src/model.js';
import { staticFilter } from '../src/dashboard.js';

export const fields = JSON.parse(readFileSync(new URL('./available-fields.json', import.meta.url), 'utf8'));
const index = createFieldIndex(fields);

// The custom report's starter reports, as the builder turns them into native objects (adhoc tiles).
const reports = TEMPLATES.map((t, i) => {
  const spec = reportSpec({ name: t.name, viz: t.viz, fields: t.fields.map(([kind, name]) => ({ kind, name, on: true })), sort: t.sort ?? null, filters: {}, top: 100 }, DIM_FIELD);
  const out = buildTile(adhocTile(`report-${i}`, spec, { group: 'g-rb', scope: [] }), index);
  return out.failure ? { id: `report-${i}`, type: spec.type, failure: out.failure } : { ...out.tile, report: t.name };
});

export const tiles = [...buildTiles(index).tiles, ...reports];

// A persona scope (HR business partner: United Kingdom · Technology), merged with each tile's own
// static filters exactly as app.js `refilter` does, so the scope path is exercised too.
const raw = (name, view) => index.raw(name, view)?.fieldKey;
const SCOPE = [['Country', 'Countries', ['United Kingdom']], ['Business Unit', 'Business Units', ['Technology']]];

export async function prepare(tile, availableFields) {
  if (tile.failure) return { vSpec: null, refusals: [{ name: 'build', reason: tile.failure.reason }] };
  const instance = (vSpec) => ({ id: tile.id, type: tile.type, vSpec, dataBinding: {} });
  const compiled = await compileDefinition(tile.type, tile.definition, availableFields);
  const themed = await themeVSpec(instance(compiled.vSpec), availableFields, { ...tile, ...compiled });
  // `skipped` is not a refusal: the theme asks every type for the same operations.
  const refusals = [...themed.failed];
  let vSpec = themed.vSpec;
  if (tile.fitColumns || (tile.page === 'adhoc' && tile.type === 'table' && !tile.pivotCols)) {
    const shares = tile.fitColumns ?? Object.fromEntries([...(tile.dimensions ?? []), ...(tile.measures ?? [])].map((x, _, all) => [x.ref, 0.98 / all.length]));
    const fit = await applyEach(instance(vSpec), availableFields, tile.type, fitColumnOps(compiled.resolvedRefs, shares, 900));
    refusals.push(...fit.failed.map((f) => ({ ...f, on: 'fitColumns' })));
    vSpec = fit.vSpec;
  }
  if (tile.type !== 'filter') {
    const scope = SCOPE.map(([f, v, values]) => staticFilter({ fieldKey: raw(f, v), values }));
    const scoped = await applyEach(instance(vSpec), availableFields, tile.type, [{ name: 'setStaticFilterGroup', payload: { operator: 'and', filters: [...(tile.ownFilters ?? []), ...scope] } }]);
    refusals.push(...scoped.failed.map((f) => ({ ...f, on: 'persona scope' })));
    vSpec = scoped.vSpec;
  }
  return { vSpec, refusals };
}
