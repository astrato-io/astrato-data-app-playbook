/**
 * DuckDB-WASM in the browser: the half of the app that is not governed.
 *
 * Three tables, all inside this page:
 *   weather  one row per city per day: daily high and rainfall from the Open-Meteo archive
 *   demand   one row per city per night: occupancy and room nights, copied from ONE governed
 *            query (the stored question "How full was each city night by night, this autumn
 *            and last?"). Whatever that query returned is all this side ever sees.
 *   blend    weather joined to demand on city and date
 * Both weather and blend carry a rain band and a temperature band, worked out from each day.
 *
 * DuckDB and its worker are bundled by Vite from the npm package (no CDN). Only the "eh" build
 * (WebAssembly exceptions, every current browser) is shipped, to keep the app ~34 MB lighter.
 * Rows go in as CSV, which DuckDB reads with no extension to download.
 */
import { AsyncDuckDB, ConsoleLogger, LogLevel } from '@duckdb/duckdb-wasm';
import wasmUrl from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import workerUrl from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';
import { API_URL, CITIES, inWindow } from './weather-source.js';

let conn = null;
let db = null;

const plain = (table) => table.toArray().map((row) => {
  const o = row.toJSON();
  for (const k in o) if (typeof o[k] === 'bigint') o[k] = Number(o[k]);
  return o;
});
export const query = async (sql) => plain(await conn.query(sql));

const csv = (rows, cols) => [cols.join(','), ...rows.map((r) => cols.map((c) => (r[c] == null ? '' : typeof r[c] === 'string' ? `"${r[c].replaceAll('"', '""')}"` : r[c])).join(','))].join('\n');
const loadCsv = async (table, rows, cols, types) => {
  await db.registerFileText(`${table}.csv`, csv(rows, cols));
  await conn.query(`CREATE OR REPLACE TABLE ${table} AS SELECT * FROM read_csv('${table}.csv', header = true, columns = {${cols.map((c) => `'${c}': '${types[c]}'`).join(', ')}})`);
};

/** Start DuckDB and load the weather for every city, both autumns. Returns the row count. */
export const startWeather = async () => {
  db = new AsyncDuckDB(new ConsoleLogger(LogLevel.WARNING), new Worker(workerUrl));
  await db.instantiate(wasmUrl);
  conn = await db.connect();

  const response = await fetch(API_URL);
  if (!response.ok) throw new Error(`Weather API answered ${response.status}`);
  const locations = await response.json();
  const rows = [];
  // The API answers one object per coordinate, in the order they were asked for.
  [].concat(locations).forEach((loc, i) => loc.daily.time.forEach((date, j) => {
    const period = inWindow(date);
    const tmax = loc.daily.temperature_2m_max[j];
    if (period && tmax != null) rows.push({ city: CITIES[i][0], date, period, tmax, precip: loc.daily.precipitation_sum[j] ?? 0 });
  }));
  await loadCsv('weather_raw', rows, ['city', 'date', 'period', 'tmax', 'precip'], { city: 'VARCHAR', date: 'DATE', period: 'VARCHAR', tmax: 'DOUBLE', precip: 'DOUBLE' });
  // The bands live on the weather rows, so a band selection narrows weather and blended charts alike.
  await conn.query(`
    CREATE OR REPLACE TABLE weather AS
    SELECT *,
           CASE WHEN precip >= 5 THEN 'Wet (5 mm+)' WHEN precip < 1 THEN 'Dry (under 1 mm)' ELSE 'Showers' END AS rain_band,
           CASE WHEN tmax < 15 THEN '1 · under 15 °C' WHEN tmax < 22 THEN '2 · 15–22 °C' WHEN tmax < 29 THEN '3 · 22–29 °C' ELSE '4 · 29 °C+' END AS temp_band
    FROM weather_raw`);
  return rows.length;
};

/**
 * Store the governed demand rows ({ city, date: 'YYYY-MM-DD', occupancy, roomNights }) and build
 * the blended table. Returns the number of city-nights that matched a weather row.
 */
export const loadDemand = async (rows) => {
  await loadCsv('demand', rows, ['city', 'date', 'occupancy', 'roomNights'], { city: 'VARCHAR', date: 'DATE', occupancy: 'DOUBLE', roomNights: 'DOUBLE' });
  await conn.query(`
    CREATE OR REPLACE TABLE blend AS
    SELECT w.*, d.occupancy, d.roomNights AS room_nights
    FROM weather w JOIN demand d USING (city, date)`);
  const [{ n }] = await query('SELECT count(*) AS n FROM blend');
  return n;
};
