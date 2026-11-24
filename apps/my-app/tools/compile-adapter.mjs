/**
 * Adapter for kit/verify/compile-check.mjs: every tile through the app's own path, offline:
 * definition → compile → operations (refs resolved from the compiled definition).
 * Field catalogue: tools/available-fields.json — the real one once the smoke test has saved it,
 * a stand-in from tools/stand-in-fields.mjs until then.   npm run compile-check
 */
import { readFileSync } from 'node:fs';
import { TILES, FILTERS } from '../src/catalogue.js';
import { createFieldIndex } from '../src/fields.js';
import { prepare as appPrepare } from '../src/tiles.js';

export const fields = JSON.parse(readFileSync(new URL('./available-fields.json', import.meta.url), 'utf8'));
const index = createFieldIndex(fields);
export const tiles = [...TILES, ...FILTERS];

export async function prepare(tile, available) {
  const out = await appPrepare(tile, index, available);
  return { vSpec: out.vSpec, refusals: [...out.refusals] };
}
