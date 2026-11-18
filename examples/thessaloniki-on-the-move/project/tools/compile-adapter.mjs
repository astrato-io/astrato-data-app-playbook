// Adapter for the playbook kit's offline compile check (kit/verify/compile-check.mjs).
// The field catalogue is the real one the app handed to appState.fields, saved by the smoke
// test as available-fields.json. `prepare` runs the app's own path: compile, theme (resolving
// each operation's ref through the compiled definition), then the table column widths.
import { readFileSync } from 'node:fs';
import { buildTiles, compileDefinition, fitColumnRequests, prepareTile } from '../src/dashboard.js';
import { createFieldIndex } from '../src/fields.js';
import { applyEach } from '../src/theme.js';

export const fields = JSON.parse(readFileSync(new URL('./available-fields.json', import.meta.url), 'utf8'));

const built = buildTiles(createFieldIndex(fields));
if (built.failures.length) throw new Error(`tiles that do not resolve: ${JSON.stringify(built.failures)}`);
export const tiles = built.tiles;

export async function prepare(tile, availableFields) {
  const compiled = { ...tile, ...(await compileDefinition(tile.type, tile.definition, availableFields)) };
  const { tile: out, failed } = await prepareTile(compiled, availableFields);
  const refusals = [...failed];
  // An operation the tile asked for by name that its chart type does not have is a refusal too;
  // the shared theme's own skips (bars have no label-colour operations) are not.
  const skipped = await applyEach({ id: tile.id, type: tile.type, vSpec: out.vSpec, dataBinding: {} }, availableFields, tile.type, tile.ops ?? []);
  refusals.push(...skipped.skipped.map((name) => ({ name, reason: `not an operation of ${tile.type}` })));
  let { vSpec } = out;
  if (tile.fitColumns) {
    const fitted = await applyEach({ id: tile.id, type: tile.type, vSpec, dataBinding: {} }, availableFields, tile.type, fitColumnRequests(out, 1000));
    refusals.push(...fitted.failed.map((f) => ({ ...f, on: 'fitColumns' })), ...fitted.skipped.map((name) => ({ name, reason: 'not an operation', on: 'fitColumns' })));
    vSpec = fitted.vSpec;
  }
  return { vSpec, refusals };
}
