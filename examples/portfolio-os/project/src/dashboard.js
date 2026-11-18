/**
 * Resolution and compilation of the tile catalogue (catalogue.js) against the live
 * "Northstar – Private Markets Portfolio OS" semantic layer: dimensions are view columns, measures are the
 * layer's governed measures. Built tiles keep their own static filters (`ownFilters`) so persona
 * scope and selection mirrors are merged with them instead of replacing them.
 */
import { createDefaultVSpec } from '@astrato-io/visualizations';
import { compileVisualizationDefinition } from '@astrato-io/visualizations/definitions';
import { measureRef } from './fields.js';
import { tileCatalogue, PLAIN } from './catalogue.js';
export { KPIS, C } from './catalogue.js';

// ===========================================================================
// Resolution and compilation

const lookupDimension = (entry, fields) => fields.raw(entry.name, entry.view);
const lookupMeasure = (entry, fields) => (entry.aggregation ? fields.raw(entry.name, entry.view) : fields.measure(entry.name));

const resolve = (tile, fields) => {
  const dimensions = (tile.dimensions ?? []).map((entry) => ({ ...entry, field: lookupDimension(entry, fields) }));
  const measures = (tile.measures ?? []).map((entry) => ({ ...entry, field: lookupMeasure(entry, fields) }));
  const missing = [...dimensions, ...measures].find((entry) => !entry.field);
  if (missing) return { error: `"${missing.name}" is not in this semantic layer` };
  const filters = [];
  for (const f of tile.filters ?? []) {
    const field = f.fieldKey ? { fieldKey: f.fieldKey } : fields.raw(f.field, f.view);
    if (!field) return { error: `filter "${f.view}.${f.field}" is not in this semantic layer` };
    filters.push({ fieldKey: field.fieldKey, values: f.values });
  }
  return { dimensions, measures, filters };
};

/** Static filters: one `setStaticFilterGroup` call replaces them all; values are strings. */
export const staticFilter = ({ fieldKey, values }) => ({ operator: 'or', filters: values.map((v) => ({ fieldKey, operator: 'equals', values: { value: String(v) } })) });
const filterOps = (filters) => (filters.length === 0 ? [] : [{ name: 'setStaticFilterGroup', payload: { operator: 'and', filters: filters.map(staticFilter) } }]);

const dimensionEntries = (dimensions) => dimensions.map((entry) => ({ fieldKey: entry.field.fieldKey, format: PLAIN, ref: entry.ref }));
const measureEntries = (measures) => measures.map(({ field, ref, format, aggregation }) => ({ ...measureRef(field, ref, aggregation), format }));
const withSortAndLimit = (tile) => ({
  ...(tile.sort ? { sorting: [].concat(tile.sort).map(({ by, direction }) => ({ by, direction })) } : {}),
  ...(tile.limit ? { limiting: { queryLimit: tile.limit } } : {}),
});

/** A table, or a pivot when `tile.pivotCols` > 0: the last `pivotCols` dimensions run across the columns. */
const tableDefinitionOf = (tile, resolved) => {
  const dims = dimensionEntries(resolved.dimensions);
  const across = tile.pivotCols > 0 && dims.length > tile.pivotCols ? tile.pivotCols : 0;
  return {
    version: 1,
    type: 'table',
    data: across
      ? { structure: 'pivot', rowDimensions: dims.slice(0, -across), columnDimensions: dims.slice(-across), measures: measureEntries(resolved.measures) }
      : {
          columns: [
            ...dims.map((column) => ({ ...column, role: 'dimension' })),
            ...measureEntries(resolved.measures).map((column) => ({ ...column, role: 'measure' })),
          ],
        },
    ...withSortAndLimit(tile),
  };
};

const definitionOf = (tile, resolved) => {
  if (tile.type === 'table') return tableDefinitionOf(tile, resolved);
  const data = { measures: measureEntries(resolved.measures), ...(resolved.dimensions.length ? { dimensions: dimensionEntries(resolved.dimensions) } : {}) };
  if (tile.type === 'number') return { version: 1, type: 'number', data: { measure: data.measures[0] } };
  if (tile.type === 'sankey') return { version: 1, type: 'sankey', data };
  if (tile.type === 'pie') return { version: 1, type: 'pie', data, ...withSortAndLimit(tile), presentation: { legend: { visible: true } } };
  return {
    version: 1,
    type: tile.type,
    data,
    ...withSortAndLimit(tile),
    presentation: {
      axes: { dimension: { labelsVisible: true, titleVisible: false }, primaryMeasure: { labelsVisible: !tile.hideMeasureAxis, titleVisible: false } },
      legend: { visible: tile.type === 'line' ? true : Boolean(tile.legend), ...(tile.legend && tile.legendPosition ? { position: tile.legendPosition } : {}) },
      ...(tile.type === 'bar' ? { orientation: tile.orientation ?? 'vertical' } : {}),
    },
  };
};

const columnLabelsOf = (tile, resolved) =>
  Object.fromEntries([...resolved.dimensions, ...resolved.measures].map((entry) => [entry.ref, tile.columnLabels?.[entry.ref] ?? entry.field.name]));

const buildControl = (control, fields) => {
  const field = fields.raw(control.field.name, control.field.view);
  if (!field) return { failure: { id: control.id, title: control.title, reason: `"${control.field.view}.${control.field.name}" is not in this semantic layer` } };
  const definition = { version: 1, type: 'filter', data: { field: { fieldKey: field.fieldKey, ref: 'field' } }, presentation: control.presentation };
  return { tile: { ...control, slot: control.id, definition, fieldKeys: [field.fieldKey] } };
};

const build = (tile, fields) => {
  if (tile.type === 'filter') return buildControl(tile, fields);
  const resolved = resolve(tile, fields);
  if (resolved.error) return { failure: { id: tile.id, title: tile.title, reason: resolved.error } };
  const mini = tile.miniChart ? fields.raw(tile.miniChart.field, tile.miniChart.view) : undefined;
  if (tile.miniChart && !mini) return { failure: { id: tile.id, title: tile.title, reason: `mini-chart field "${tile.miniChart.view}.${tile.miniChart.field}" is not in this semantic layer` } };
  const miniOps = mini ? [
    { name: 'setColumnRepresentation', ref: tile.miniChart.ref, payload: { representation: 'line-chart' } },
    { name: 'setColumnMiniChartDimension', ref: tile.miniChart.ref, payload: { key: mini.fieldKey } },
    { name: 'setColumnMiniChartLineColor', ref: tile.miniChart.ref, payload: { lineColor: tile.miniChart.color } },
    { name: 'setColumnMiniChartLineStrokeWidth', ref: tile.miniChart.ref, payload: { strokeWidth: 2 } },
    { name: 'setColumnMiniChartShowDataPoints', ref: tile.miniChart.ref, payload: { showDataPoints: false } },
  ] : [];
  const ops = [...filterOps(resolved.filters), ...(tile.ops ?? []), ...miniOps];
  return {
    tile: {
      ...tile,
      ops,
      ownFilters: resolved.filters.map(staticFilter),
      columnLabels: tile.type === 'table' ? columnLabelsOf(tile, resolved) : tile.columnLabels,
      definition: definitionOf(tile, resolved),
      fieldKeys: resolved.dimensions.map((entry) => entry.field.fieldKey),
      dataTable: tile.type === 'table' || tile.type === 'filter'
        ? undefined
        : {
            id: `${tile.id}-data`, title: tile.title, type: 'table', ops: filterOps(resolved.filters),
            definition: { ...tableDefinitionOf(tile, resolved), limiting: { queryLimit: 500 } },
            columnLabels: Object.fromEntries([...resolved.dimensions, ...resolved.measures].map((entry) => [entry.ref, entry.field.name])),
          },
    },
  };
};

export const buildTiles = (fields) => {
  const tiles = [];
  const failures = [];
  for (const tile of tileCatalogue()) {
    const out = build(tile, fields);
    if (out.failure) failures.push(out.failure);
    else tiles.push(out.tile);
  }
  // Each chapter listens to its own selection group, mirrored from the filter bar (MAIN) by the
  // app: a click re-queries the chapter on screen now and the others when they are scrolled to.
    return { tiles, failures };
};
export const buildTile = (tile, fields) => build(tile, fields);

export const compileDefinition = async (type, definition, availableFields) => {
  const result = await compileVisualizationDefinition({ definition, availableFields, baseVSpec: createDefaultVSpec(type) });
  if (!result.success) throw new Error(result.issues.map((issue) => `${issue.code} @${(issue.path ?? []).join('.')}: ${issue.message}`).join('; '));
  return { vSpec: result.vSpec, resolvedRefs: result.resolvedRefs ?? {} };
};

export const compileTiles = async (tiles, availableFields) => {
  const compiled = [];
  const failures = [];
  await Promise.all(tiles.map(async (tile) => {
    try {
      compiled.push({ ...tile, ...(await compileDefinition(tile.type, tile.definition, availableFields)) });
    } catch (error) {
      failures.push({ id: tile.id, title: tile.title, reason: String(error?.message ?? error) });
    }
  }));
  const order = new Map(tiles.map((t, i) => [t.id, i]));
  compiled.sort((a, b) => order.get(a.id) - order.get(b.id));
  return { compiled, failures };
};
