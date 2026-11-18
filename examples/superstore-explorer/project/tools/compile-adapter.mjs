// Adapter for kit/verify/compile-check.mjs: every object the app can mount, compiled and themed by
// the app's own prepareChart (compile → operations resolved from the compiled refs).
//
// Field catalogue: the real one the smoke test saved (copied to tools/available-fields.json) when it exists,
// otherwise a stand-in built from the layer document in this repo.
import { existsSync, readFileSync } from 'node:fs';
import { LEVELS, METRICS, prepareChart, typeOf } from '../src/charts.js';

const saved = new URL('./available-fields.json', import.meta.url);
const layerFile = new URL('../../../../layers/superstore-sample/layer.json', import.meta.url);

const standIn = () => {
  const layer = JSON.parse(readFileSync(layerFile, 'utf8'));
  const TYPE = { number: 'float', float: 'float', int: 'int', string: 'string', date: 'date', datetime: 'datetime', boolean: 'boolean' };
  const AGGS = [{ name: 'SUM' }, { name: 'COUNT', distinct: true }, { name: 'COUNT' }, { name: 'AVG' }, { name: 'MIN' }, { name: 'MAX' }];
  const key = (view, field) => `[${view}].[${field}]`;
  const agg = (m) => ({ fieldKeys: (m.arguments ?? []).map((a) => key(a.reference.view, a.reference.field)), aggregation: m.aggregate, ...(m.distinct ? { distinct: true } : {}) });
  return [
    ...Object.entries(layer.views).flatMap(([view, v]) => Object.entries(v.fields).map(([name, f]) => ({
      kind: 'field', fieldKey: key(view, name), name, view, dataType: TYPE[f.dataType] ?? 'string', aggregations: AGGS,
    }))),
    ...Object.entries(layer.measures).map(([name, m]) => ({
      kind: 'calculation', fieldKey: `[calculation].[${name}]`, name,
      item: { key: `[calculation].[${name}]`, name, type: 'calculation', calculation: { calculation: m.expression, measures: Object.keys(m).filter((k) => /^m\d+$/.test(k)).map((k) => agg(m[k])) } },
    })),
  ];
};

export const fields = existsSync(saved) ? JSON.parse(readFileSync(saved, 'utf8')) : standIn();

// Every object the app mounts: drill at each level and metric, the trend as line and bars per
// metric, one mini chart per metric, and the order-lines table for each list kind, wide and narrow.
const specs = [
  ...LEVELS.flatMap((_, level) => METRICS.map((metric) => ({ id: `drill-${level}-${metric.id}`, kind: 'drill', level, metric }))),
  ...['line', 'bar'].flatMap((type) => METRICS.map((metric) => ({ id: `trend-${type}-${metric.id}`, kind: 'trend', type, metric }))),
  ...METRICS.map((metric) => ({ id: `spark-${metric.id}`, kind: 'spark', metric })),
  ...['customers', 'products'].flatMap((listTab) => [1000, 600, 480].map((width) => ({ id: `records-${listTab}-${width}`, kind: 'records', listTab, width }))),
];
export const tiles = specs.map((spec) => ({ ...spec, type: typeOf(spec) }));

export async function prepare(tile, availableFields) {
  const { vSpec, failed } = await prepareChart(tile, availableFields);
  return { vSpec, refusals: failed };
}
