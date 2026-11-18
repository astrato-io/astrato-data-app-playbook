/**
 * Adapter for kit/verify/compile-check.mjs: every tile through the app's own path, offline:
 * definition → compile → operations (refs resolved from the compiled definition), plus the
 * runtime operation the app applies later (the what-if's Target Minutes parameter).
 * Field catalogue: the real one, saved by the smoke test as shots/<run>/available-fields.json and
 * copied to tools/available-fields.json.   npm run compile-check
 */
import { readFileSync } from 'node:fs';
import { applyOperations } from '@astrato-io/visualizations/operations';
import { TILES, FILTERS } from '../src/catalogue.js';
import { createFieldIndex } from '../src/fields.js';
import { prepare as appPrepare } from '../src/tiles.js';

export const fields = JSON.parse(readFileSync(new URL('./available-fields.json', import.meta.url), 'utf8'));
const index = createFieldIndex(fields);
export const tiles = [...TILES, ...FILTERS];

export async function prepare(tile, available) {
  const out = await appPrepare(tile, index, available);
  const refusals = [...out.refusals];
  let vSpec = out.vSpec;
  if (tile.param) {
    const r = out.resolvedRefs?.v;
    const done = await applyOperations({ instance: { id: tile.id, type: tile.type, vSpec }, availableFields: available, operationRequests: [{ id: 'param', name: 'setMeasureDefinedParameter', payload: { dataItemInternalKey: r?.dataItemInternalKey, dataItemUniqueSignature: r?.dataItemUniqueSignature, parameterName: tile.param, value: { type: 'static', value: 45 } } }] });
    for (const [id, x] of Object.entries(done.results ?? {})) if (!x?.success) refusals.push(`${id}: ${JSON.stringify(x?.error ?? x).slice(0, 240)}`);
    vSpec = done.vSpec;
  }
  return { vSpec, refusals };
}
