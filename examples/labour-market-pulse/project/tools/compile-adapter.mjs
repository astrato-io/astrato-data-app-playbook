/**
 * Adapter for kit/verify/compile-check.mjs: every tile (and each table's "selected period"
 * variant) through the app's own path, offline: definition → compile → operations (refs resolved
 * from the compiled definition) → the runtime operations the app applies later (the latest ↔
 * selected-period static-filter swap, and the pay-award parameter of the what-if).
 *
 * Field catalogue: the real one, saved by the smoke test (`appState.fields`) as
 * shots/available-fields.json and copied to tools/available-fields.json.
 *   npm run compile-check            # or: ... compile-check.mjs tools/compile-adapter.mjs all
 */
import { readFileSync } from 'node:fs';
import { applyOperations } from '@astrato-io/visualizations/operations';
import { TILES, FILTERS } from '../src/catalogue.js';
import { createFieldIndex } from '../src/fields.js';
import { prepare as appPrepare, staticGroup, opGroup } from '../src/tiles.js';

export const fields = JSON.parse(readFileSync(new URL('./available-fields.json', import.meta.url), 'utf8'));
const index = createFieldIndex(fields);

// The same alternates app.js builds: a swap table's selected-period variant.
const ALTS = TILES.filter((t) => t.alt).map((t) => ({ ...t, id: `${t.id}-p`, measures: t.alt.measures, alt: undefined, isAlt: true }));
export const tiles = [...TILES, ...FILTERS, ...ALTS];

export async function prepare(tile, available) {
  const out = await appPrepare(tile, index, available, { latest: true });
  const refusals = [...out.refusals];
  const later = [];
  // app.js refreshLatest: a snapshot card drops "Period Status = Latest" while a time is selected.
  if (tile.latest) later.push({ id: 'sf', name: 'setStaticFilterGroup', payload: opGroup(staticGroup(tile, index, { latest: false })) });
  // app.js whatIfCard: the slider sets the measure's parameter.
  if (tile.param) {
    const r = out.resolvedRefs?.v;
    later.push({ id: 'param', name: 'setMeasureDefinedParameter', payload: { dataItemInternalKey: r?.dataItemInternalKey, dataItemUniqueSignature: r?.dataItemUniqueSignature, parameterName: tile.param, value: { type: 'static', value: 6 } } });
  }
  let vSpec = out.vSpec;
  if (later.length) {
    const done = await applyOperations({ instance: { id: tile.id, type: tile.type, vSpec }, availableFields: available, operationRequests: later });
    for (const [id, r] of Object.entries(done.results ?? {})) if (!r?.success) refusals.push(`${id}: ${JSON.stringify(r?.error ?? r).slice(0, 240)}`);
    vSpec = done.vSpec;
  }
  return { vSpec, refusals };
}
