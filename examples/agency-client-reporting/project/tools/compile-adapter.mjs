// Adapter for kit/verify/compile-check.mjs: the real field catalogue (saved by the smoke test as
// shots/available-fields.json) and the app's own path from tile to vSpec: build → compile → theme,
// with every operation's ref resolved through the compiled definition (theme.js `tileOps`).
import { existsSync, readFileSync } from 'node:fs';
import { buildTiles, compileDefinition } from '../src/dashboard.js';
import { createFieldIndex } from '../src/fields.js';
import { themeVSpec } from '../src/theme.js';

const saved = new URL('./available-fields.json', import.meta.url);
if (!existsSync(saved)) throw new Error('Run the smoke test once first: it saves shots/available-fields.json');
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
  for (const op of t.ops ?? []) if (op.ref && !t.resolvedRefs?.[op.ref]) refusals.push({ name: op.name, reason: `ref ${op.ref} did not resolve` });
  return { vSpec: themed.vSpec, refusals };
}
