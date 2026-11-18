/**
 * Offline compile check: prove every chart definition and operation payload is accepted by the
 * INSTALLED @astrato-io/visualizations, with no Astrato session, no browser and no data.
 *
 *   npm install --save-dev jsdom
 *   node compile-check.mjs <your-adapter.mjs> [tileId | all]
 *
 * Run it before the first browser session and after every library upgrade. It catches renamed
 * or removed operations, rejected payloads and definitions that no longer compile. It does NOT
 * prove rendering, queries, selections or figures: those need the smoke test. It also prints a
 * WARN line, without failing, for a static filter on a field the catalogue types as not a string.
 *
 * The adapter is a small module of yours that exports:
 *
 *   export const fields;                 // a stand-in field catalogue (see below)
 *   export const tiles;                  // [{ id, type, ... }] your tile declarations
 *   export async function prepare(tile, fields)   // your own "definition -> compile -> operations"
 *                                        // returning { vSpec, refusals: [...] }
 *
 * `prepare` should be the same function the app uses before runtime.mount, so this check
 * exercises real code. Return every refused or failed operation in `refusals`: applyOperations
 * reports results keyed by request id, so read each one, never assume success.
 *
 * A stand-in catalogue only needs the shapes your definitions reference:
 *
 *   { kind: 'field', fieldKey: '[Orders].[Region]', name: 'Region', view: 'Orders', dataType: 'string',
 *     aggregations: [{ name: 'SUM' }, { name: 'COUNT', distinct: true }] }
 *   { kind: 'dimension', fieldKey: '[dimension].[Order Month]', name: 'Order Month',
 *     item: { key: '[dimension].[Order Month]', name: 'Order Month', type: 'dimension',
 *             dimension: { view: 'Orders', name: 'Order Date', dateLevel: 'month' } } }
 *   { kind: 'calculation', fieldKey: '[calculation].[Revenue]', name: 'Revenue',
 *     item: { key: '[calculation].[Revenue]', name: 'Revenue', type: 'calculation', calculation: { calculation: '{m1}' } } }
 *
 * Verified on @astrato-io/visualizations 0.8.0 with jsdom, 2026-11.
 */
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [adapterPath, only] = process.argv.slice(2);
if (!adapterPath) { console.error('usage: node compile-check.mjs <adapter.mjs> [tileId | all]'); process.exit(2); }

// The visualizations package needs browser globals at import time; jsdom supplies enough of them.
let JSDOM;
// Resolve jsdom from the project this is run in, not from where this file lives.
try { ({ JSDOM } = await import(pathToFileURL(createRequire(resolve('package.json')).resolve('jsdom')).href)); } catch { console.error('jsdom is not installed: npm install --save-dev jsdom'); process.exit(2); }
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', { pretendToBeVisual: true, url: 'http://localhost/' });
const w = dom.window;
w.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
class Observer { observe() {} unobserve() {} disconnect() {} }
w.ResizeObserver ??= Observer;
w.IntersectionObserver ??= Observer;
for (const key of Object.getOwnPropertyNames(w)) {
  if (key in globalThis) continue;
  try {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      get: () => w[key],
      set: (value) => { Object.defineProperty(globalThis, key, { value, writable: true, configurable: true }); },
    });
  } catch { /* a non-configurable global: leave Node's own */ }
}
globalThis.window = w; globalThis.self = w; globalThis.document = w.document;
try { Object.defineProperty(globalThis, 'navigator', { value: w.navigator, configurable: true }); } catch { /* Node's navigator stays */ }

const { fields, tiles, prepare } = await import(pathToFileURL(resolve(adapterPath)).href);
if (!Array.isArray(tiles) || typeof prepare !== 'function') { console.error('the adapter must export `fields`, `tiles` (array) and `prepare` (function)'); process.exit(2); }

// Settings worth eyeballing in a compiled vSpec: they are where a silently ignored option shows.
const SHOW = ['advancedCalculation', 'representation', 'miniChart', 'indicator', 'role', 'staticFilters', 'filterGroup', 'definedParameters', 'temporalGrouping', 'dateLevel', 'format'];
const walk = (node, path, visit) => {
  if (!node || typeof node !== 'object') return;
  visit(node, path);
  for (const [key, value] of Object.entries(node)) walk(value, `${path}.${key}`, visit);
};

// A static filter on a field that is not a string compiles, then the object can fail at render.
// Types come from the catalogue: a field's `dataType`, a dimension's `item.dimension.resultType`.
// Stand-in entries without a type are skipped. Warnings never change the exit code.
const typeOf = new Map((Array.isArray(fields) ? fields : []).map((f) => [f.fieldKey, f.dataType ?? f.item?.dimension?.resultType]));
const EXACT = new Set(['equals', 'doesNotEqual', 'inList', 'excludedFromList']);
const staticFilterWarnings = (vSpec) => {
  const out = new Set();
  const visit = (filter, refs) => {
    if (!filter || typeof filter !== 'object') return;
    if (Array.isArray(filter.filters)) for (const f of filter.filters) visit(f, refs);
    const key = filter.fieldKey ?? refs?.[filter.dataFieldId];
    const type = key && typeOf.get(key);
    if (!type || /^(string|text)$/i.test(type)) return;
    // isBetween on an integer field rendered on 0.9.0 (2026-11-18): no warning.
    if (filter.operator === 'isBetween' && !/date|time/i.test(type)) return;
    // Only an exact-match filter on a number was seen to fail at render; dates were silently dropped on 0.4–0.5.
    out.add(EXACT.has(filter.operator) && !/date|time/i.test(type)
      ? `static filter on ${key} (${type}) — 0.9 renders this object as an error; filter a string field instead`
      : `static filter on ${key} (${type}, ${filter.operator}) — not confirmed on 0.9; check this object renders, or filter a string field instead`);
  };
  walk(vSpec, '', (node) => {
    const sf = node.staticFilters;
    if (!sf || typeof sf !== 'object') return;
    const refs = node.referencedData ?? vSpec?.referencedData;
    visit({ filters: sf.filters }, refs);
    visit(sf.filterGroup, refs);
  });
  return [...out];
};

let problems = 0;
let warnings = 0;
const realError = console.error;
for (const tile of tiles) {
  const noise = [];
  console.error = (...args) => noise.push(args.map(String).join(' ').slice(0, 400));
  try {
    const { vSpec, refusals = [] } = await prepare(tile, fields);
    if (refusals.length) problems++;
    console.log(refusals.length ? 'PART' : 'OK  ', tile.id, tile.type ?? '', refusals.length ? JSON.stringify(refusals).slice(0, 900) : '');
    for (const line of staticFilterWarnings(vSpec)) { warnings++; console.log('WARN', tile.id, line); }
    if (only === tile.id || only === 'all') {
      walk(vSpec, '', (node, path) => {
        for (const key of SHOW) {
          const value = node[key];
          if (value == null || (key === 'advancedCalculation' && value.type === 'none') || (key === 'representation' && value === 'text')) continue;
          console.log('    ', path.slice(-48), key, '=', JSON.stringify(value).slice(0, 220));
        }
      });
    }
  } catch (error) {
    problems++;
    console.log('FAIL', tile.id, tile.type ?? '', String(error?.message ?? error).slice(0, 1200));
  }
  if (noise.length && (only === tile.id || only === 'all')) for (const line of noise.slice(0, 5)) console.log('     console.error:', line);
}
console.error = realError;
console.log(`${tiles.length - problems} of ${tiles.length} tiles compile cleanly`);
if (warnings) console.log(`${warnings} warning${warnings === 1 ? '' : 's'}: read each WARN line (warnings do not fail the run)`);
process.exit(problems ? 1 : 0);
