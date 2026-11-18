/**
 * A report, from state to a mountable native object.
 *
 *   report state ──reportSpec()──▶ spec ──prepareReport()──▶ { vSpec, refs, failed }
 *
 * Both steps are pure (no session, no requests): tools/compile-adapter.mjs runs them offline over
 * every view type. Lifted from the people-intelligence builder's `reportSpec`, with the generated
 * field tables replaced by the run-time catalogue (catalogue.js).
 *
 * State: { name, view: 'table'|'bar'|'line', rows: [{ key, grain? }], figures: [key],
 *          compare: 'none'|'previous'|'lastYear', sort: { by, dir } | null, top, period, filters }
 */
import { createDefaultVSpec } from '@astrato-io/visualizations';
import { compileVisualizationDefinition } from '@astrato-io/visualizations/definitions';
import { applyOperations } from '@astrato-io/visualizations/operations';
import { getVisualizationMetadata } from '@astrato-io/visualizations/metadata';
import { isRatio } from './catalogue.js';

export const VIEWS = [['table', 'Table'], ['bar', 'Bar'], ['line', 'Line']];
export const GRAINS = { year: ['Year', 'yyyy', 1], quarter: ['Quarter', 'yyyyq', 4], month: ['Month', 'mmmyyyy', 12], day: ['Day', 'ddmmmyyyy', 0] };
export const COMPARES = { none: 'No comparison', previous: 'Previous period', lastYear: 'Same period last year' };
const INK = { ink: '#1f2937', muted: '#6b7280', line: '#e5e7eb', head: '#f8fafc', accent: '#2563eb' };
export const SERIES = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#06b6d4', '#64748b', '#ec4899'];

/** What a view needs, or the sentence that says what is missing. */
export const needs = (st) => {
  const r = st.rows.length, f = st.figures.length;
  if (st.view === 'table') return r + f > 0 || 'Pick rows and figures from the panel on the left.';
  return (r >= 1 && f >= 1) || `A ${st.view} chart needs at least one row and one figure.`;
};

/**
 * Can this report compare periods? The layer holds no period-comparison measures, so the change is
 * the table's own inter-record calculation along a date row: it needs a date row at year, quarter
 * or month grain, and only the table shows it. Returns { ok, offset, reason }.
 */
export const comparison = (st, cat) => {
  if (st.compare === 'none') return { ok: false };
  if (!cat.rows.some((r) => r.date)) return { ok: false, reason: 'This layer has no date field, so there is no period to compare.' };
  const date = st.rows.find((r) => cat.get(r.key)?.date);
  if (!date) return { ok: false, reason: 'Comparing periods needs a date in the rows: add one, at month, quarter or year.' };
  const perYear = GRAINS[date.grain ?? 'month'][2];
  if (!perYear) return { ok: false, reason: 'Pick month, quarter or year for the date row: days have no fixed period to compare.' };
  if (st.view !== 'table') return { ok: false, reason: 'The comparison shows in the table view.' };
  // The window follows the row order: dates ascending, a negative offset reaches back.
  return { ok: true, date, offset: st.compare === 'lastYear' ? -perYear : -1 };
};

/** The report state → a spec: ordered columns with refs, labels and formats. Pure. */
export const reportSpec = (st, cat) => {
  const cmp = comparison(st, cat);
  // The table's window runs along its first dimension, so a compared date row goes first.
  const rows = cmp.ok ? [cmp.date, ...st.rows.filter((r) => r !== cmp.date)] : st.rows;
  const dims = rows.map((r, i) => ({ ref: `d${i}`, key: r.key, label: cat.get(r.key)?.name ?? r.key, grain: cat.get(r.key)?.date ? (r.grain ?? 'month') : null }));
  const figs = st.figures.map((key, i) => ({ ref: `m${i}`, key, label: cat.get(key)?.name ?? key, pattern: cat.get(key)?.pattern }));
  const changes = cmp.ok ? figs.map((m, i) => ({ ...m, ref: `c${i}`, of: m.ref, label: `${m.label} ${st.compare === 'lastYear' ? 'vs LY' : 'vs prev.'}${isRatio(cat.get(m.key)) ? ' (pts)' : ' %'}`, calc: isRatio(cat.get(m.key)) ? 'diff' : 'growth', pattern: '+0.0%;-0.0%', offset: cmp.offset })) : [];
  const chartDims = st.view === 'table' ? dims : dims.slice(0, 2);
  const chartFigs = st.view === 'table' || chartDims.length < 2 ? figs : figs.slice(0, 1);
  const known = new Set([...chartDims, ...chartFigs].map((x) => x.ref));
  const firstDate = chartDims[0]?.grain;
  const sort = cmp.ok ? [{ by: 'd0', direction: 'asc' }]
    : st.sort && known.has(st.sort.by) ? [{ by: st.sort.by, direction: st.sort.dir }]
    : firstDate || !chartFigs.length ? [{ by: 'd0', direction: 'asc' }] : [{ by: 'm0', direction: 'desc' }];
  return { title: st.name, view: st.view, dims: chartDims, figs: chartFigs, changes: st.view === 'table' ? changes : [], sort, top: st.top ?? 100 };
};

// ------------------------------------------------------------------ compile and finish
const dimEntry = (d) => ({ fieldKey: d.key, ref: d.ref, ...(d.grain ? { temporalGrouping: { mode: 'level', dateLevel: d.grain }, format: { formatType: GRAINS[d.grain][1] } } : {}) });
const figEntry = (m) => ({ fieldKey: m.key, ref: m.ref, ...(m.pattern ? { format: { formatType: 'custom', formatString: m.pattern } } : {}) });

const definitionOf = (spec) => {
  const base = { version: 1, type: spec.view, sorting: spec.sort, limiting: { queryLimit: spec.top } };
  if (spec.view === 'table') {
    return {
      ...base,
      data: { columns: [...spec.dims.map((d) => ({ ...dimEntry(d), role: 'dimension' })), ...spec.figs.map((m) => ({ ...figEntry(m), role: 'measure' })), ...spec.changes.map((c) => ({ fieldKey: c.key, ref: c.ref, role: 'measure' }))] },
      presentation: {
        body: { fontColor: INK.ink, fontFamily: 'Roboto', fontSize: 13, verticalAlign: 'middle' },
        header: { backgroundColor: INK.head, borderColor: INK.line, fontColor: INK.muted, fontFamily: 'Roboto', fontSize: 12 },
        borders: { color: INK.line, dividerColor: INK.line, dividers: 'horizontal', enabled: true, lineStyle: 'line', radius: 0, strokeWidth: 1 },
        highlight: { backgroundColor: '#eff6ff', mode: 'row' },
        layout: { rowHeight: 34 },
      },
    };
  }
  const horizontal = spec.view === 'bar' && !spec.dims[0]?.grain;
  return {
    ...base,
    data: { dimensions: spec.dims.map(dimEntry), measures: spec.figs.map(figEntry) },
    presentation: {
      axes: { dimension: { titleVisible: false }, primaryMeasure: { titleVisible: false, ...(spec.view === 'bar' ? { range: { startsAtZero: true } } : {}) } },
      legend: { visible: spec.dims.length > 1 || spec.figs.length > 1, position: 'top' },
      ...(spec.view === 'bar' ? { orientation: horizontal ? 'horizontal' : 'vertical' } : {}),
    },
  };
};

const itemOf = (refs, ref) => ({ dataItemInternalKey: refs[ref].dataItemInternalKey, dataItemUniqueSignature: refs[ref].dataItemUniqueSignature });

/** A figure column fits its header and its widest value in the layer's format ('$#,###.00' → '$0,000,000.00'). */
const figureWidth = (m) => {
  const sample = /%/.test(m.pattern ?? '') ? '-100.0%' : (m.pattern ?? '#,##0').replace(/[#0,]*[#0]/, '-0,000,000').replace(/;.*/, '');
  return Math.round(Math.min(220, Math.max(88, m.label.length * 6.8 + 40, sample.length * 7 + 24)));
};

/** Fixed pixel widths that share the slot: dates and figures fixed, text rows share the rest. */
export const widthOps = (spec, refs, width) => {
  const cols = [...spec.dims.map((d) => ({ ref: d.ref, px: d.grain ? Math.max(104, d.label.length * 7.5 + 40) : null })), ...[...spec.figs, ...spec.changes].map((m) => ({ ref: m.ref, px: figureWidth(m) }))];
  const fixed = cols.reduce((s, c) => s + (c.px ?? 0), 0);
  const flex = cols.filter((c) => !c.px).length;
  // Text rows share what is left, never below 120px: a report too wide for its slot scrolls
  // sideways inside the table rather than clipping a header or a figure.
  const each = flex ? Math.max(120, Math.min(360, Math.floor((width - 24 - fixed) / flex))) : 0;
  return [
    { name: 'setTableAllColumnsResponsiveWidth', payload: false },
    ...cols.filter((c) => refs[c.ref]).map((c) => ({ name: 'setColumnWidth', payload: { ...itemOf(refs, c.ref), width: `${Math.floor(c.px ?? each)}px` } })),
  ];
};

const finishOps = (spec, refs, width) => {
  if (spec.view === 'table') {
    const adv = (ref) => ({ ...itemOf(refs, ref), collectionKey: 'measures', advancedOperationKey: 'advancedCalculation' });
    return [
      ...[...spec.dims, ...spec.figs, ...spec.changes].flatMap((c) => [
        { name: 'setColumnCustomLabelEnabled', payload: { ...itemOf(refs, c.ref), enabled: true } },
        { name: 'setColumnCustomLabelValue', payload: { ...itemOf(refs, c.ref), value: c.label } },
      ]),
      ...[...spec.figs, ...spec.changes].map((m) => ({ name: 'setColumnHorizontalAlign', payload: { ...itemOf(refs, m.ref), horizontalAlign: 'right' } })),
      ...spec.changes.flatMap((c) => [
        { name: 'setMeasureAdvancedCalculationType', payload: { ...adv(c.ref), advancedCalculationType: c.calc } },
        { name: 'setMeasureAdvancedOffset', payload: { ...adv(c.ref), offset: c.offset } },
        // Format operations find columns by `label`, which a change column shares with its figure
        // until it is renamed; the definition cannot format it either (same field, one formatter).
        { name: 'setColumnLabel', payload: { ...itemOf(refs, c.ref), label: c.label } },
        { name: 'setColumnFormatType', payload: { name: c.label, formatType: 'custom' } },
        { name: 'setColumnFormatString', payload: { name: c.label, formatString: c.pattern } },
      ]),
      ...widthOps(spec, refs, width),
    ];
  }
  const ops = [
    { name: 'setColoringType', payload: spec.dims.length > 1 ? 'categorical' : spec.figs.length > 1 ? 'perEachMeasure' : 'single' },
    // Persistent colours hash values onto the palette and collide; deal the palette in order instead.
    ...(spec.dims.length > 1 ? [{ name: 'setColoringPersistentColors', payload: false }, { name: 'setCustomPaletteColors', payload: { colors: SERIES } }]
      : spec.figs.length > 1 ? spec.figs.map((m, i) => ({ name: 'setMeasureGraphColor', payload: { ...itemOf(refs, m.ref), graphColor: SERIES[i % SERIES.length] } }))
      : [{ name: 'setColoringColor', payload: INK.accent }]),
    { name: 'setAxisLabelColor', payload: { axisName: 'dimension', labelColor: INK.muted } },
    { name: 'setAxisLabelColor', payload: { axisName: 'primaryMeasure', labelColor: INK.muted } },
  ];
  if (spec.view === 'bar') ops.push({ name: 'setBarChartBarRadius', payload: 2 }, ...(spec.dims.length > 1 ? [{ name: 'setBarChartLayout', payload: 'stacked' }] : spec.figs.length > 1 ? [{ name: 'setBarChartLayout', payload: 'groups' }] : [])); // several figures stack by default on 0.9
  if (spec.view === 'line') ops.push({ name: 'setLineType', payload: 'straight' }, ...spec.figs.map((m) => ({ name: 'setMeasureDataLabelsShow', payload: { ...itemOf(refs, m.ref), show: false } })));
  return ops;
};

/** Compile, then apply each operation alone so a refused one is reported and never hides the rest. */
export const prepareReport = async (spec, availableFields, { id = 'report', width = 900 } = {}) => {
  const definition = definitionOf(spec);
  const compiled = await compileVisualizationDefinition({ definition, availableFields, baseVSpec: createDefaultVSpec(spec.view) });
  if (!compiled.success) throw new Error(compiled.issues.map((i) => `${i.code} @${(i.path ?? []).join('.')}: ${i.message}`).join('; '));
  const refs = compiled.resolvedRefs ?? {};
  const supported = new Set(getVisualizationMetadata(spec.view).operations.names);
  let vSpec = compiled.vSpec;
  const failed = [];
  for (const request of finishOps(spec, refs, width)) {
    if (!supported.has(request.name)) { failed.push({ name: request.name, reason: 'unsupported' }); continue; }
    const out = await applyOperations({ instance: { id, type: spec.view, vSpec }, availableFields, operationRequests: [request] });
    const result = Object.values(out.results ?? {})[0];
    if (result && result.success === false) failed.push({ name: request.name, reason: result.error ?? result.message ?? JSON.stringify(result) });
    else vSpec = out.vSpec;
  }
  return { vSpec, refs, failed };
};

// ------------------------------------------------------------------ starter reports
/** Starters name fields; any that the bound layer lacks is dropped (catalogue.js resolves names). */
export const STARTERS = [
  { name: 'Sales and margin by region and category', view: 'table', rows: [['Region'], ['Category']], figures: ['Sales', 'Profit', 'Profit Ratio'], period: 'l12m', sort: { by: 'm0', dir: 'desc' } },
  { name: 'Monthly sales against last year', view: 'table', rows: [['Order Date', 'month']], figures: ['Sales', 'Orders', 'Profit Ratio'], period: 'all', compare: 'lastYear' },
  { name: 'Profit by sub-category', view: 'bar', rows: [['Sub-Category']], figures: ['Profit'], period: 'ytd' },
  { name: 'Quarterly sales by segment', view: 'line', rows: [['Order Date', 'quarter'], ['Segment']], figures: ['Sales'], period: 'all' },
];

/** A starter as report state on this layer, or null when none of its fields exist here. */
export const fromStarter = (t, cat) => {
  const rows = t.rows.map(([name, grain]) => cat.row(name) && { key: cat.row(name).key, ...(grain ? { grain } : {}) }).filter(Boolean);
  const figures = t.figures.map((n) => cat.figure(n)?.key).filter(Boolean);
  if (!rows.length || !figures.length) return null;
  return { name: t.name, view: t.view, rows, figures, compare: t.compare ?? 'none', sort: t.sort ?? null, top: 100, period: { preset: t.period ?? 'all' }, filters: {} };
};
