/**
 * An Astrato engine that answers from DuckDB, on Astrato's own selection state.
 *
 * This is the whole trick of the blend. Native Astrato charts ask for data through
 * `engine.getData({ query: { dimensions, calculations, limit } })`. Give a second runtime this
 * engine instead of Astrato's, and the same native charts draw DuckDB results:
 *
 *   1. FIELD_METADATA is a small field catalogue in the shape Astrato's own catalogue has, so a
 *      chart definition compiles against it exactly as it does against the semantic layer.
 *   2. City and Stay Date use the governed layer's own field keys ([Hotels].[City],
 *      [Calendar].[Stay Date]). A click on any chart, governed or not, writes ONE selection.
 *   3. getData reads the group's applied selections from Astrato's selection service and turns
 *      them into the WHERE clause. Keys this engine does not know are ignored, just as governed
 *      charts ignore the weather bands, which exist only here.
 *
 * Every statement is reported through `onSql`, for the Queries tab and the right-click SQL.
 */

/** fieldKey → [column, data type]. The first two are the governed layer's own keys. */
export const DIMENSIONS = {
  '[Hotels].[City]': ['city', 'string'],
  '[Calendar].[Stay Date]': ['date', 'date'],
  '[Weather].[Rain band]': ['rain_band', 'string'],
  '[Weather].[Temperature band]': ['temp_band', 'string'],
};

const L3M = "period = 'L3M'";
const LY = "period = 'L3M LY'";
const DRY = 'precip < 1';
const WET = 'precip >= 5';
const occ = (where) => `AVG(occupancy) FILTER (WHERE ${where})`;

/**
 * Measure name → [SQL, table, format pattern]. Charts show this autumn (L3M); the "vs last
 * autumn" measures compare with the same three months of 2025, as the layer's L3M LY measures do.
 * `blend` measures need the governed demand rows; `weather` ones need only the API.
 */
export const MEASURES = {
  'Average high': [`AVG(tmax) FILTER (WHERE ${L3M})`, 'weather', '0.0" °C"'],
  'Average high vs last autumn': [`AVG(tmax) FILTER (WHERE ${L3M}) - AVG(tmax) FILTER (WHERE ${LY})`, 'weather', '+0.0" °C";-0.0" °C";0.0" °C"'],
  // A window over the grouped rows: the 7-night moving average along the date axis.
  '7-night average': [`AVG(AVG(tmax) FILTER (WHERE ${L3M})) OVER (ORDER BY date ROWS BETWEEN 6 PRECEDING AND CURRENT ROW)`, 'weather', '0.0" °C"'],
  'Wet city-days': [`COUNT(*) FILTER (WHERE ${L3M} AND ${WET})`, 'weather', '#,##0'],
  'Wet city-days vs last autumn': [`COUNT(*) FILTER (WHERE ${L3M} AND ${WET}) - COUNT(*) FILTER (WHERE ${LY} AND ${WET})`, 'weather', '+#,##0;-#,##0;0'],
  Occupancy: [occ(L3M), 'blend', '0.0%'],
  'Dry nights': [occ(`${L3M} AND ${DRY}`), 'blend', '0.0%'],
  'Wet nights': [occ(`${L3M} AND ${WET}`), 'blend', '0.0%'],
  'Wet vs dry nights': [`100 * (${occ(`${L3M} AND ${WET}`)} - ${occ(`${L3M} AND ${DRY}`)})`, 'blend', '+0.0" pts";-0.0" pts";0.0" pts"'],
  'Wet vs dry nights last autumn': [`100 * (${occ(`${LY} AND ${WET}`)} - ${occ(`${LY} AND ${DRY}`)})`, 'blend', '+0.0" pts";-0.0" pts";0.0" pts"'],
  // Share of this autumn's city-days that were wet: the what-if's default for the layer's wet_share.
  'Wet share': [`COUNT(*) FILTER (WHERE ${L3M} AND ${WET}) * 1.0 / NULLIF(COUNT(*) FILTER (WHERE ${L3M}), 0)`, 'weather', '0.0%'],
  'Wet vs dry nights vs last autumn': [`100 * ((${occ(`${L3M} AND ${WET}`)} - ${occ(`${L3M} AND ${DRY}`)}) - (${occ(`${LY} AND ${WET}`)} - ${occ(`${LY} AND ${DRY}`)}))`, 'blend', '+0.0" pts";-0.0" pts";0.0" pts"'],
};
const BLEND_ONLY_COLUMNS = new Set(['occupancy']);
const ORDERED = new Set(['date', 'rain_band', 'temp_band']);

const nameOf = (key) => /\.\[([^\]]+)\]$/.exec(key ?? '')?.[1] ?? key;
const viewOf = (key) => /^\[([^\]]+)\]/.exec(key ?? '')?.[1];
const lit = (v) => `'${String(v).replaceAll("'", "''")}'`;
/** Dates travel as epoch ms, the way Astrato returns and selects them; DuckDB stores DATE. */
export const isoOf = (v) => (typeof v === 'number' ? new Date(v).toISOString().slice(0, 10) : String(v).slice(0, 10));

/* ---------- the field catalogue the DuckDB charts compile against ---------- */

const aggregators = ['ANY_VALUE', 'COUNT', 'MAX', 'MIN', 'SUM', 'AVG'].map((name) => ({
  name, paramType: 'expression', dataType: 'anytype', resultType: name === 'COUNT' ? 'int' : 'incoming', delimiter: false,
  paramCountMin: 1, paramCountMax: 1, asterisk: false, distinct: false, rtd: true, groupBy: true, withinGroup: false,
  partitionBy: true, orderBy: true, cumulative: true, ignoreNulls: false, rankRelated: false,
}));
const field = (key, dataType) => ({ key, name: nameOf(key), source: nameOf(key).toUpperCase(), sourceType: 'column', dataType, aggregators, schema: 'API', view: viewOf(key) });
const VALUE_KEY = '[Weather].[Value]';
const FIELDS = [...Object.entries(DIMENSIONS).map(([k, [, t]]) => field(k, t)), field(VALUE_KEY, 'float')];
const MEASURE_ITEMS = Object.entries(MEASURES).map(([name, [, , pattern]], i) => ({
  type: 'calculation', id: `dm${i}`, name, description: name,
  calculation: { resultType: 'float', calculation: '{m1}', measures: [{ fieldKeys: [VALUE_KEY], aggregation: 'AVG', resultType: 'float', distinct: false }], format: { pattern } },
  key: `[calculation].[${name}]`, views: ['Weather'],
}));
export const FIELD_METADATA = { dimensions: [], fields: FIELDS, validFields: FIELDS, viewsFields: FIELDS, measures: MEASURE_ITEMS, groupedDimensions: {} };
export const measureKey = (name) => `[calculation].[${name}]`;

/* ---------- the engine ---------- */

/**
 * query:  run SQL in DuckDB (duck.js)
 * selections, group: Astrato's selection service and the group every chart on the page shares
 * onSql({ sql, label, key, ms, rows }): called after each statement
 * keyOf(selection): the field key a selection stands for (a governed dimension key → its view column)
 */
export const createDuckEngine = ({ query, selections, group, onSql = () => {}, keyOf = (x) => x.field?.fieldKey ?? x.fieldKey }) => {
  /** The group's applied selections as a WHERE clause, for the keys this engine knows. */
  const where = () => {
    const parts = [];
    for (const item of selections.getSelection(group)?.applied ?? []) {
      const [col, type] = DIMENSIONS[keyOf(item)] ?? [];
      const values = (item.values ?? []).map((v) => (v && typeof v === 'object' ? v.value ?? v.text : v)).filter((v) => v != null);
      if (!col || !values.length) continue;
      parts.push(`${col} IN (${values.map((v) => lit(type === 'date' ? isoOf(v) : v)).join(', ')})`);
    }
    return parts.length ? `WHERE ${parts.join(' AND ')}` : '';
  };

  /**
   * key identifies the asker (a chart's dimension and measure names, or a label). The weather and
   * the extract are fixed once loaded, so a statement that already ran is answered from memory:
   * a chart that asks twice for one selection (pending, then applied) costs one DuckDB query.
   */
  const memo = new Map();
  const run = async (sql, label, key = label) => {
    const t0 = performance.now();
    const cached = memo.has(sql);
    if (!cached) memo.set(sql, query(sql).catch((e) => { memo.delete(sql); throw e; }));
    const rows = (await memo.get(sql)).map((r) => ({ ...r }));
    onSql({ sql, label, key, ms: performance.now() - t0, rows: rows.length, cached });
    return rows;
  };

  const meta = (name, dataType) => ({
    name, hasNullable: true, hasLength: dataType === 'string', hasPrecisionScale: dataType === 'float', nullable: true,
    length: dataType === 'string' ? 40 : 0, databaseType: { string: 'TEXT', date: 'DATE', float: 'FIXED' }[dataType],
    precision: dataType === 'float' ? 13 : 0, scale: 1, dataType, isDimension: dataType !== 'float', isTopDimension: false, isMeasure: dataType === 'float',
  });

  const getData = async (request) => {
    const q = request.query ?? {};
    const dims = (q.dimensions ?? []).map((d) => {
      const [col, type] = DIMENSIONS[d.fieldKey ?? d.itemKey] ?? ['NULL', 'string'];
      return { label: d.label ?? nameOf(d.fieldKey), col, type };
    });
    const calcs = (q.calculations ?? []).map((c) => {
      const m = MEASURES[nameOf(c.itemKey)];
      return { label: c.label ?? nameOf(c.itemKey), sql: m?.[0] ?? 'NULL', table: m?.[1] ?? 'weather' };
    });
    const table = calcs.some((c) => c.table === 'blend') || dims.some((d) => BLEND_ONLY_COLUMNS.has(d.col)) ? 'blend' : 'weather';
    const select = dims.map((d, i) => (d.type === 'date' ? `epoch_ms(${d.col}::TIMESTAMP) AS d${i}` : `${d.col} AS d${i}`));
    // A date axis shows this autumn only; LY rows still feed the "vs last autumn" measures.
    const filters = [where(), dims.some((d) => d.type === 'date') ? `${where() ? 'AND' : 'WHERE'} ${L3M}` : ''].filter(Boolean).join(' ');
    const order = dims.length && ORDERED.has(dims[0].col) ? 'd0' : calcs.length ? 'm0 DESC NULLS LAST' : '1';
    const sql = [
      `SELECT ${[...select, ...calcs.map((c, i) => `${c.sql} AS m${i}`)].join(', ')}`,
      `FROM ${table}`, filters,
      dims.length ? `GROUP BY ${dims.map((d) => d.col).join(', ')}` : '',
      `ORDER BY ${order}`, q.limit ? `LIMIT ${q.limit}` : '',
    ].filter(Boolean).join('\n');
    const key = [...(q.dimensions ?? []).map((d) => nameOf(d.fieldKey)), ...(q.calculations ?? []).map((c) => nameOf(c.itemKey))].join('|');
    const rows = await run(sql, dims.map((d) => d.label).join(' × ') || calcs.map((c) => c.label).join(', '), key);
    const keys = [...dims.map((_, i) => `d${i}`), ...calcs.map((_, i) => `m${i}`)];
    return {
      response: {
        fields: [...dims.map((d) => meta(d.label, d.type)), ...calcs.map((c) => meta(c.label, 'float'))],
        data: Object.fromEntries(rows.map((r, i) => [String(i), keys.map((k) => r[k])])),
        meta: { rows: rows.length, cols: keys.length }, timezone: 'UTC',
      },
    };
  };

  return { engine: { localeSettings: {}, getData, areFieldsConnected: () => true, areViewsConnected: () => true }, where, run };
};
