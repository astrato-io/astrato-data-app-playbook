// Adapter for kit/verify/compile-check.mjs: the real field catalogue (saved by the smoke test as
// tools/available-fields.json, saved by the smoke test) and the app's own path from tile to vSpec: build → compile → theme →
// column widths, with every operation's ref resolved through the compiled definition.
import { existsSync, readFileSync } from 'node:fs';
import { buildTiles, compileDefinition } from '../src/dashboard.js';
import { createFieldIndex } from '../src/fields.js';
import { themeVSpec, applyEach } from '../src/theme.js';

const saved = new URL('./available-fields.json', import.meta.url);
if (!existsSync(saved)) throw new Error('tools/available-fields.json is missing: run the smoke test, then copy its available-fields.json here');
export const fields = JSON.parse(readFileSync(saved, 'utf8'));

const built = buildTiles(createFieldIndex(fields));
if (built.failures.length) throw new Error(`tiles that do not resolve: ${JSON.stringify(built.failures)}`);
export const tiles = built.tiles;

export async function prepare(tile, availableFields) {
  const compiled = await compileDefinition(tile.type, tile.definition, availableFields);
  const t = { ...tile, ...compiled };
  const themed = await themeVSpec({ id: t.id, type: t.type, vSpec: t.vSpec, dataBinding: {} }, availableFields, t);
  const refusals = [...themed.failed];
  // theme.js drops an operation whose ref did not compile to a data item; report it here instead.
  for (const op of [...(t.ops ?? [])]) if (op.ref && !t.resolvedRefs?.[op.ref]) refusals.push({ name: op.name, reason: `ref ${op.ref} did not resolve` });
  // The column widths the app applies once it knows the slot's width (app.js `fit`), at 1200px.
  if (t.fitColumns) {
    const requests = [{ name: 'setTableAllColumnsResponsiveWidth', payload: false }];
    for (const [ref, share] of Object.entries(t.fitColumns)) {
      const item = t.resolvedRefs?.[ref];
      if (!item) { refusals.push({ name: 'setColumnWidth', reason: `ref ${ref} did not resolve` }); continue; }
      requests.push({ name: 'setColumnWidth', payload: { dataItemInternalKey: item.dataItemInternalKey, dataItemUniqueSignature: item.dataItemUniqueSignature, width: `${Math.floor(1196 * share)}px` } });
    }
    const fit = await applyEach({ id: t.id, type: t.type, vSpec: themed.vSpec, dataBinding: {} }, availableFields, t.type, requests);
    refusals.push(...fit.failed.map((f) => ({ ...f, on: 'fit' })));
    return { vSpec: fit.vSpec, refusals };
  }
  return { vSpec: themed.vSpec, refusals };
}
