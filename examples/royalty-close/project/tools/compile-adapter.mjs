// Adapter for kit/verify/compile-check.mjs: the real field catalogue (saved by the smoke test as
// tools/available-fields.json, saved by the smoke test), every tile the app mounts (the catalogue plus one table per stored
// question on the Business questions tab) and the same path the app runs before runtime.mount:
// compile, theme (refs resolved through resolvedRefs), then the column-width fit for tables.
import { readFileSync } from 'node:fs';
import { buildTile, buildTiles, compileDefinition } from '../src/dashboard.js';
import { createFieldIndex } from '../src/fields.js';
import { QUESTIONS, bqTileOf } from '../src/questions.js';
import { applyEach, themeVSpec } from '../src/theme.js';

export const fields = JSON.parse(readFileSync(new URL('./available-fields.json', import.meta.url), 'utf8'));
const index = createFieldIndex(fields);

const built = buildTiles(index);
if (built.failures.length) console.warn('[tiles]', JSON.stringify(built.failures));
const bqTiles = QUESTIONS.filter((x) => !/Paid vs|Recovery/.test(x.cat)).map((bq, i) => {
  const b = buildTile(bqTileOf(bq), index);
  if (b.failure) throw new Error(`bq ${i}: ${b.failure.reason}`);
  return { ...b.tile, id: `bq-${i}` };
});
export const tiles = [...built.tiles, ...bqTiles];

/** The app's fit(): table widths as shares of the slot, applied after the theme. */
const fitRequests = (tile, width = 1200) => {
  if (!tile.fitColumns) return [];
  const requests = [{ name: 'setTableAllColumnsResponsiveWidth', payload: false }];
  for (const [ref, share] of Object.entries(tile.fitColumns)) {
    const item = tile.resolvedRefs?.[ref];
    if (item) requests.push({ name: 'setColumnWidth', payload: { dataItemInternalKey: item.dataItemInternalKey, dataItemUniqueSignature: item.dataItemUniqueSignature, width: `${Math.floor((width - 4) * share)}px` } });
  }
  return requests;
};

export async function prepare(tile, availableFields) {
  const compiled = await compileDefinition(tile.type, tile.definition, availableFields);
  const t = { ...tile, ...compiled };
  const instance = { id: t.id, type: t.type, vSpec: t.vSpec, dataBinding: {} };
  const themed = await themeVSpec(instance, availableFields, t);
  const refusals = [...themed.failed];
  const fit = fitRequests(t);
  if (fit.length) {
    const fitted = await applyEach({ ...instance, vSpec: themed.vSpec }, availableFields, t.type, fit);
    refusals.push(...fitted.failed.map((f) => ({ ...f, on: 'fit' })), ...fitted.skipped.map((name) => ({ name, reason: 'not supported by this type', on: 'fit' })));
    return { vSpec: fitted.vSpec, refusals };
  }
  return { vSpec: themed.vSpec, refusals };
}
