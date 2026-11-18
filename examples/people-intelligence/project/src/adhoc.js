/**
 * Ad-hoc native objects: the tile spec the assistant, investigation, simulator, question library and
 * the custom report builder turn into a native Astrato object at run time. Extracted from app.js
 * `renderTile` so the offline compile check (tools/compile-adapter.mjs) exercises the same code.
 *
 * spec: { title, type, dims: [[name, view]], measures: [name], formats?, filters?: [[field, view, values]],
 *         sort?, limit?, colors?, graphTypes?, secondary?, legend?, stacked?, orientation?, miniChart?,
 *         columnLabels?, pivotCols?, gradient?, pointSize?, measureColors? }
 * scope: the persona's row scope, [[field, view, values]], added to the spec's own filters.
 */
import { C, SERIES, measFormat, secondary, perMeasure } from './catalogue.js';
import { FORMAT } from './formats.js';

export const adhocTile = (id, spec, { group = 'g-ask', scope = [] } = {}) => {
  const formats = spec.formats ?? spec.measures.map((m) => FORMAT[m] ?? '#,##0');
  const measures = spec.measures.map((m, i) => ({ name: m, ref: `m${i}`, format: { formatType: 'numberNoDecimal' } }));
  const filt = [...(spec.filters ?? []), ...scope].map(([field, view, values]) => ({ view, field, values }));
  const type = spec.type;
  return {
    id, slot: id, page: 'adhoc', title: spec.title, type, group,
    dimensions: spec.dims.map(([name, view], i) => ({ name, view, ref: `d${i}` })), measures, filters: filt,
    sort: spec.sort, limit: spec.limit ?? 200, legend: spec.legend ?? (type !== 'bar' || spec.measures.length > 1 || spec.dims.length > 1), legendPosition: 'top',
    orientation: spec.orientation ?? 'horizontal', graphTypes: spec.graphTypes, stacked: spec.stacked, grouped: spec.grouped,
    donut: type === 'pie', sliceLabels: type === 'pie' ? 'percentage' : undefined, coloring: type === 'pie' || (type === 'bar' && spec.dims.length > 1) ? 'categorical' : undefined,
    colors: spec.colors ?? (type === 'pie' || spec.dims.length > 1 || spec.measures.length > 1 ? SERIES : [C.red]), gradient: spec.gradient, lineCurve: 'curve', pointSize: spec.pointSize,
    fontSize: type === 'table' ? 12 : undefined, columnLabels: spec.columnLabels, miniChart: spec.miniChart, pivotCols: spec.pivotCols,
    ...(type === 'bar' && spec.measures.length === 1 && spec.dims.length === 1 ? { dataLabels: { size: 11, format: formats[0], backdrop: '#FFFFFF' }, hideMeasureAxis: true, barPadding: 25 } : {}),
    ops: [
      ...(type === 'table'
        ? [{ name: 'setTableFixedRowHeightEnabled', payload: true }, { name: 'setTableFixedRowHeightValue', payload: 30 }, ...measures.flatMap((m, i) => [{ name: 'setColumnFormatType', ref: m.ref, payload: { formatType: 'custom' } }, { name: 'setColumnFormatString', ref: m.ref, payload: { formatString: formats[i] } }, { name: 'setColumnHorizontalAlign', ref: m.ref, payload: { horizontalAlign: 'right' } }])]
        : measures.flatMap((m, i) => measFormat(m.ref, formats[i]))),
      ...(spec.secondary ? [secondary(spec.secondary)] : []),
      ...(spec.measureColors ? perMeasure(spec.measureColors) : []),
    ],
  };
};

/** Fixed column widths that share a table's width: shares = { ref: fraction }. */
export const fitColumnOps = (resolvedRefs, shares, width) => {
  const requests = [{ name: 'setTableAllColumnsResponsiveWidth', payload: false }];
  for (const [ref, share] of Object.entries(shares)) {
    const item = resolvedRefs?.[ref];
    if (item) requests.push({ name: 'setColumnWidth', payload: { dataItemInternalKey: item.dataItemInternalKey, dataItemUniqueSignature: item.dataItemUniqueSignature, width: `${Math.floor((width - 6) * share)}px` } });
  }
  return requests;
};
