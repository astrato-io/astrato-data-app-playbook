/**
 * Independent check of the blended figures, outside the browser and outside DuckDB.
 *
 * Reads the stored question "How full was each city night by night, this autumn and last?" over
 * MCP (the same governed rows the app copies into DuckDB), fetches the same Open-Meteo archive
 * request, joins them in plain JavaScript and prints the dry-vs-wet occupancy gap for both autumns.
 *
 *   node tools/verify-blend.mjs            (needs the Astrato MCP fallback client: see README)
 */
import { execFileSync } from 'node:child_process';
import { CITIES, API_URL, inWindow } from '../src/weather-source.js';

const MCP = process.env.ASTRATO_MCP_CLIENT;
const LAYER = JSON.parse((await import('node:fs')).readFileSync(new URL('../astrato.json', import.meta.url), 'utf8')).semanticLayerId;
if (!MCP) { console.error('set ASTRATO_MCP_CLIENT to the path of an MCP command-line client'); process.exit(2); }

const demand = [];
for (let offset = 0; ; offset += 1000) {
  const raw = execFileSync(process.execPath, [MCP, 'astrato_semantic_layer_execute_question', JSON.stringify({ semanticLayerId: LAYER, id: 'How full was each city night by night, this autumn and last?', limit: 1000, offset, responseBudgetBytes: 262144 })], { encoding: 'utf8', maxBuffer: 64e6 });
  const rows = JSON.parse(raw).data?.data?.rows ?? JSON.parse(raw).structuredContent?.data?.data?.rows ?? [];
  demand.push(...rows);
  if (rows.length < 1000) break;
}
const weather = await (await fetch(API_URL)).json();
const byKey = new Map();
weather.forEach((loc, i) => loc.daily.time.forEach((day, j) => {
  byKey.set(`${CITIES[i][0]}|${day}`, { tmax: loc.daily.temperature_2m_max[j], precip: loc.daily.precipitation_sum[j] });
}));
const out = {};
for (const [city, ms, occ] of demand) {
  const day = new Date(ms).toISOString().slice(0, 10);
  const w = byKey.get(`${city}|${day}`);
  const period = inWindow(day);
  if (!w || w.tmax == null || !period) continue;
  const o = (out[period] ??= { dry: [], wet: [], n: 0 });
  o.n += 1;
  if (w.precip < 1) o.dry.push(occ); else if (w.precip >= 5) o.wet.push(occ);
}
const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
console.log(`governed rows: ${demand.length}`);
for (const [p, o] of Object.entries(out)) console.log(`${p}: joined ${o.n} city-nights, dry ${o.dry.length} avg ${(avg(o.dry) * 100).toFixed(2)}%, wet ${o.wet.length} avg ${(avg(o.wet) * 100).toFixed(2)}%, gap ${((avg(o.dry) - avg(o.wet)) * 100).toFixed(2)} pts`);
