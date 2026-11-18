// Adapter for kit/verify/compile-check.mjs: report specs built and finished by the app's own
// reportSpec → prepareReport path, over every view type, every starter report, a comparison by
// previous period and by last year, and a narrow table. Field catalogue: the real one the smoke
// test saved (shots/available-fields.json, copied to tools/), never a stand-in.
import { readFileSync } from 'node:fs';
import { buildCatalogue } from '../src/catalogue.js';
import { STARTERS, VIEWS, fromStarter, prepareReport, reportSpec } from '../src/report.js';

export const fields = JSON.parse(readFileSync(new URL('./available-fields.json', import.meta.url), 'utf8'));
const cat = buildCatalogue(fields);
const row = (name, grain) => ({ key: cat.row(name).key, ...(grain ? { grain } : {}) });
const fig = (name) => cat.figure(name).key;
const base = { name: 'check', top: 100, sort: null, compare: 'none', period: { preset: 'all' }, filters: {} };

const states = [
  ...STARTERS.map((t, i) => ({ id: `starter-${i}`, st: fromStarter(t, cat) })),
  ...VIEWS.flatMap(([view]) => [
    { id: `${view}-one`, st: { ...base, view, rows: [row('Region')], figures: [fig('Sales')] } },
    { id: `${view}-two-rows`, st: { ...base, view, rows: [row('Category'), row('Segment')], figures: [fig('Sales'), fig('Profit Ratio')] } },
    { id: `${view}-date`, st: { ...base, view, rows: [row('Order Date', 'quarter')], figures: [fig('Sales'), fig('Orders')] } },
  ]),
  { id: 'table-previous', st: { ...base, view: 'table', rows: [row('Category'), row('Order Date', 'month')], figures: [fig('Sales'), fig('Profit Ratio')], compare: 'previous' } },
  { id: 'table-last-year', st: { ...base, view: 'table', rows: [row('Order Date', 'year')], figures: [fig('Profit'), fig('Returns')], compare: 'lastYear' } },
  { id: 'table-all-figures', st: { ...base, view: 'table', rows: [row('Customer Name')], figures: cat.figures.map((f) => f.key), sort: { by: 'm1', dir: 'asc' } } },
];

export const tiles = states.flatMap(({ id, st }) => [1100, 560].map((width) => ({ id: `${id}-${width}`, type: st.view, st, width })));

export async function prepare(tile, availableFields) {
  const { vSpec, failed } = await prepareReport(reportSpec(tile.st, buildCatalogue(availableFields)), availableFields, { id: tile.id, width: tile.width });
  return { vSpec, refusals: failed };
}
