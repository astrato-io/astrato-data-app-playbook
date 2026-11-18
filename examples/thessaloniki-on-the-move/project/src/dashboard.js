/**
 * Every Astrato object of "Thessaloniki on the Move", chapter by chapter.
 *
 * Each tile is a visualization instance declared against the "Thessaloniki on the Move" semantic
 * layer (OSETH GTFS, 14 Jul – 3 Aug 2026): dimensions are view columns, measures are the layer's
 * governed measures.
 *
 * Selection groups:
 *  - `main`   the filter bar (line category, day type, time band, distance band, sector) and chart clicks.
 *  - `route`  the route explorer: one line, chosen in its own dropdown or by clicking a line anywhere.
 */
import { createDefaultVSpec } from '@astrato-io/visualizations';
import { compileVisualizationDefinition } from '@astrato-io/visualizations/definitions';
import { measureRef } from './fields.js';
import { INK, themeVSpec } from './theme.js';

export const SV = 'Service';
export const LV = 'Lines';
export const ST = 'Stops';
export const LS = 'Line Stops';
export const FL = 'Fleet';

export const MAIN = 'main';
export const ROUTE = 'route';
export const LIVE = 'live';
export const ALL_GROUPS = [MAIN, ROUTE, LIVE];
export const chapterGroup = (page) => `ch-${page}`;

/** Aegean palette: deep sea, harbour blue, aqua, sand, terracotta roofs, late-sun gold. */
export const C = {
  navy: '#10263F', sea: '#1F6F9F', aqua: '#2BB3C0', sand: '#E9DFCC', terra: '#E0583A', gold: '#F2B33D', green: '#2F9B6E', grey: '#A59D8E', ink: '#1B2533', plum: '#6C4A7E',
};
export const CATEGORY_COLORS = [C.navy, C.sea, C.aqua, C.gold, C.terra];
/** Frequency as heat: rare buses are cool blue, frequent buses are hot red (both stop maps). */
export const SERVICE_GRADIENT = [C.sea, C.aqua, C.gold, C.terra, '#B3261E'];
export const LEVEL_COLORS = [C.navy, C.sea, C.aqua, C.gold, C.terra];

/** The filter bar, in order: [view, column, label]. */
export const CONTROLS = [
  [LV, 'Category', 'Line category'], [SV, 'Day Type', 'Day type'], [SV, 'Time Band', 'Time of day'], [ST, 'Dist Band', 'Distance from centre'], [ST, 'Sector', 'Sector'],
];
/** The one-value column each view carries, so a one-row table can hide it and show a KPI. */
const ONE = { [SV]: [LV, 'City'], [LV]: [LV, 'City'], [ST]: [ST, 'City'] };

/** Whole region and city-centre extents for the stop maps (lon/lat). */
export const EXTENT = {
  region: { lon: [22.53, 23.27], lat: [40.34, 40.995] },
  city: { lon: [22.875, 23.035], lat: [40.565, 40.68] },
  /** Fitted to the selected lines at run time. */
  route: { lon: [22.875, 23.035], lat: [40.565, 40.68] },
};

const PLAIN = { formatType: 'none' };
const NUM = { formatType: 'numberNoDecimal' };
export const FMT = { pct: '0.0%', pct0: '0%', int: '#,##0', dec1: '#,##0.0', min: '0" min"', kmh: '0.0" km/h"', km: '#,##0" km"' };

const colFormat = (ref, formatString) => [
  { name: 'setColumnFormatType', ref, payload: { formatType: 'custom' } },
  { name: 'setColumnFormatString', ref, payload: { formatString } },
];
const measFormat = (ref, formatString) => [
  { name: 'setMeasureFormatType', ref, payload: { formatType: 'custom' } },
  { name: 'setMeasureFormatString', ref, payload: { formatString } },
];
const right = (...refs) => refs.map((ref) => ({ name: 'setColumnHorizontalAlign', ref, payload: { horizontalAlign: 'right' } }));
const bold = (ref, color) => ({ name: 'setColumnFontStyle', ref, payload: { fontStyle: { weight: 700, ...(color ? { color } : {}) } } });
const rowHeight = (h) => [{ name: 'setTableFixedRowHeightEnabled', payload: true }, { name: 'setTableFixedRowHeightValue', payload: h }];
const progress = (ref, color, bg = '#F1EADC') => [
  { name: 'setColumnRepresentation', ref, payload: { representation: 'progress' } },
  { name: 'setColumnMiniChartProgressBarColor', ref, payload: { progressBarColor: color } },
  { name: 'setColumnMiniChartProgressBackgroundColor', ref, payload: { backgroundColor: bg } },
  { name: 'setColumnMiniChartProgressShowCurrentValue', ref, payload: { showCurrentValue: true } },
  { name: 'setColumnMiniChartProgressValuePlacement', ref, payload: { valuePlacement: 'inside' } },
  { name: 'setColumnProgressDynamicScaleEnabled', ref, payload: { dynamicScaleEnabled: true } },
  // White, bold value text on the bar for contrast.
  { name: 'setColumnFontStyle', ref, payload: { fontStyle: { color: '#FFFFFF', weight: 700 } } },
];
/** Traffic-light text: below the first cut terracotta, then gold, then deep sea. */
const bands = (ref, cuts, colors) => [
  { name: 'setColumnRepresentation', ref, payload: { representation: 'indicator' } },
  ...cuts.flatMap((value, segmentIndex) => [
    { name: 'addColumnIndicatorSegment', ref, payload: {} },
    { name: 'setColumnIndicatorSegmentValue', ref, payload: { segmentIndex, value } },
    { name: 'setColumnIndicatorSegmentColor', ref, payload: { segmentIndex, color: colors[segmentIndex] } },
  ]),
  { name: 'setColumnIndicatorColorText', ref, payload: { colorText: true } },
];
const perMeasure = (map) => [
  { name: 'setColoringType', payload: 'perEachMeasure' },
  ...Object.entries(map).map(([ref, graphColor]) => ({ name: 'setMeasureGraphColor', ref, payload: { graphColor } })),
];

/** Dimensions are view columns: `[name, ref, view]`. */
const dims = (...cols) => cols.map(([name, ref, view]) => ({ view, name, ref }));
/** Measures: a governed measure by name (optionally `[name, ref]`). */
const meas = (...list) => list.map((m, i) => (typeof m === 'string' ? { name: m, ref: `m${i}`, format: NUM } : { name: m[0], ref: m[1] ?? `m${i}`, format: NUM }));

/** A one-row table that shows one measure large: the KPI that narrows with selections. */
const kpi = (id, measure, format, { group = MAIN, view = SV, filters, size = 40, color = C.navy, page } = {}) => ({
  id, slot: id, page, title: measure, type: 'table', group, filters,
  fitColumns: { v: 1 },
  dimensions: dims([ONE[view][1], 'k', ONE[view][0]]),
  measures: [{ name: measure, ref: 'v', format: NUM }],
  headerHidden: true, background: '#00000000', fontSize: size,
  ops: [
    { name: 'setColumnHidden', ref: 'k', payload: { hidden: true } },
    ...rowHeight(Math.round(size * 1.35)),
    ...colFormat('v', format),
    { name: 'setColumnHorizontalAlign', ref: 'v', payload: { horizontalAlign: 'left' } },
    { name: 'setColumnFontStyle', ref: 'v', payload: { fontStyle: { weight: 700, color } } },
  ],
});

const bar = (id, title, [dimName, view], measures, { group = MAIN, page, sort = { by: 'm0', direction: 'desc' }, limit = 20, colors, gradient, measureColors, format = FMT.int, orientation = 'horizontal', legend = false, stacked = false, grouped = false, labels = true, filters, barPadding = 25, hideMeasureAxis, coloring, extraOps = [] } = {}) => ({
  id, slot: id, page, title, type: 'bar', group, orientation, filters,
  dimensions: dims([dimName, 'd0', view]),
  measures: meas(...[].concat(measures)),
  sort, limit, gradient, coloring, colors: gradient ? undefined : colors ?? (measureColors ? undefined : [C.navy]), legend, legendPosition: legend ? 'top' : undefined, stacked, grouped, barPadding,
  hideMeasureAxis: hideMeasureAxis ?? (labels && !stacked),
  ...(labels ? { dataLabels: { size: 11, format, backdrop: '#FFFDF8' } } : {}),
  ops: [...(measureColors ? perMeasure(measureColors) : []), ...[].concat(measures).map((_, i) => measFormat(`m${i}`, format)).flat(), ...extraOps],
});

const donut = (id, title, [dimName, view], measure, { group = MAIN, page, colors, sort = { by: 'd0', direction: 'asc' }, filters } = {}) => ({
  id, slot: id, page, title, type: 'pie', group, filters, donut: true, legend: true, sliceLabels: 'percentage', coloring: 'categorical',
  dimensions: dims([dimName, 'd0', view]), measures: meas(measure), sort, limit: 12, colors,
});

/** A stop map: one point per stop at its coordinates, coloured by peak buses an hour. */
const stopMap = (id, title, { page, group = MAIN, extent = 'region', filters } = {}) => ({
  id, slot: id, page, title, type: 'scatter', group, filters,
  dimensions: dims(['Stop Label', 'd0', ST]),
  measures: [{ name: 'Stop Lon', ref: 'm0', format: PLAIN }, { name: 'Stop Lat', ref: 'm1', format: PLAIN }],
  limit: 4000, extent,
  gradient: SERVICE_GRADIENT, gradientField: `[${ST}].[AM Peak Buses Per Hour]`, gradientRange: [0, 18],
  legend: true, legendTitle: 'Buses an hour, weekday 07–10', noLabels: true, map: true, pointSize: 1,
  axisTitles: { primaryMeasure: 'Longitude', secondaryMeasure: 'Latitude' },
});

// ===========================================================================
const tileCatalogue = () => [
  // ------------------------------------------------ filter bar
  ...CONTROLS.map(([view, column, label]) => ({
    id: `ctl-${column.replace(/\W+/g, '-').toLowerCase()}`, page: 'controls', title: label, type: 'filter', group: MAIN,
    field: { view, name: column }, presentation: { mode: 'dropdown', quickSelect: false, responsive: false, searchable: true, showProgressBar: false },
  })),
  {
    id: 'ctl-line', page: 'route', title: 'Line', type: 'filter', group: ROUTE,
    field: { view: LV, name: 'Line Label' }, presentation: { mode: 'dropdown', quickSelect: false, responsive: false, searchable: true, showProgressBar: false },
  },

  // ------------------------------------------------ 0. Hero: the network in six numbers
  kpi('k-lines', 'Active Lines', FMT.int, { page: 'hero', size: 30 }),
  kpi('k-stops', 'Stops', FMT.int, { page: 'hero', view: ST, size: 30 }),
  kpi('k-trips', 'Trips per Day', FMT.int, { page: 'hero', size: 30, color: C.terra }),
  kpi('k-vkm', 'Vehicle Km per Day', '#,##0,"k"', { page: 'hero', size: 30 }),
  kpi('k-calls', 'Stop Calls per Day', '#,##0,"k"', { page: 'hero', size: 30 }),
  kpi('k-buses', 'Buses at 8am', FMT.int, { page: 'hero', view: LV, size: 30, color: C.sea }),

  // Sparklines under the landing KPIs: the 21 service days (weekend dips), stops by distance band,
  // and the fleet through the day.
  ...[['ks-lines', 'Active Lines', C.navy], ['ks-trips', 'Trips', C.terra], ['ks-vkm', 'Vehicle Km', C.navy], ['ks-calls', 'Stop Calls', C.navy]].map(([id, measure, color]) => ({
    id, slot: id, page: 'hero', title: `${measure} by service day`, type: 'line', group: MAIN, sparkline: true,
    dimensions: dims(['Date Label', 'd0', SV]), measures: meas(measure), sort: [{ by: 'd0', direction: 'asc' }], limit: 40,
    legend: false, colors: [color], lineCurve: 'curve',
  })),
  {
    id: 'ks-stops', slot: 'ks-stops', page: 'hero', title: 'Stops by distance band', type: 'bar', group: MAIN, orientation: 'vertical',
    dimensions: dims(['Dist Band', 'd0', ST]), measures: meas('Stops'), sort: { by: 'd0', direction: 'asc' }, limit: 6,
    colors: [C.sea], barPadding: 20, hideMeasureAxis: true, hideDimensionAxis: true, legend: false,
  },
  {
    id: 'ks-buses', slot: 'ks-buses', page: 'hero', title: 'Buses in service through the day', type: 'line', group: MAIN, sparkline: true,
    dimensions: dims(['Clock Hour', 'd0', FL]), measures: meas('Buses in Service'), sort: [{ by: 'd0', direction: 'asc' }], limit: 30,
    legend: false, colors: [C.sea], lineCurve: 'curve',
  },
  {
    id: 'k-pulse', slot: 'k-pulse', page: 'hero', title: 'The city’s pulse', type: 'line', group: MAIN,
    dimensions: dims(['Hour Label', 'd0', SV]), measures: meas('Trips per Day'),
    sort: [{ by: 'd0', direction: 'asc' }], limit: 30, legend: false, colors: [C.terra], lineCurve: 'curve', lineType: 'area',
    ops: measFormat('m0', FMT.int),
  },

  // ------------------------------------------------ 1. Scale
  bar('sc-cat', 'Trips a day by line category', ['Category', LV], 'Trips per Day', { page: 'scale', colors: [C.navy], limit: 6 }),
  donut('sc-share', 'Share of bus-kilometres', ['Category', LV], 'Vehicle Km', { page: 'scale', colors: CATEGORY_COLORS }),
  {
    id: 'sc-table', slot: 'sc-table', page: 'scale', title: 'What each part of the network does', type: 'table', group: MAIN,
    dimensions: dims(['Category', 'cat', LV]),
    measures: meas(['Active Lines', 'lines'], ['Trips per Day', 'trips'], ['Share of Trips', 'share'], ['Vehicle Km per Day', 'vkm'], ['Commercial Speed', 'speed'], ['Avg Trip Km', 'km'], ['Sunday Retention', 'sun']),
    sort: [{ by: 'trips', direction: 'desc' }], limit: 10, fontSize: 13,
    columnLabels: { cat: 'Category', lines: 'Lines', trips: 'Trips / day', share: 'Share of trips', vkm: 'Bus-km / day', speed: 'Speed', km: 'Trip length', sun: 'Sunday vs weekday' },
    fitColumns: { cat: 0.16, lines: 0.08, trips: 0.11, share: 0.17, vkm: 0.12, speed: 0.11, km: 0.11, sun: 0.14 },
    ops: [...rowHeight(34), ...colFormat('lines', FMT.int), ...colFormat('trips', FMT.int), ...colFormat('share', FMT.pct), ...colFormat('vkm', FMT.int), ...colFormat('speed', FMT.kmh), ...colFormat('km', '0.0" km"'), ...colFormat('sun', FMT.pct0),
      ...progress('share', C.sea), ...bands('speed', [16, 22, 999], [C.terra, C.gold, C.sea]), ...right('lines', 'trips', 'vkm', 'km', 'sun'), bold('cat', C.navy), bold('trips')],
  },

  // ------------------------------------------------ 2. Geography
  stopMap('geo-map', 'Every stop in the network, coloured by how often a bus comes', { page: 'geo' }),
  bar('geo-sector', 'Departures per stop, by sector', ['Sector', ST], 'Departures per Stop', { page: 'geo', gradient: [C.gold, C.aqua, C.navy], limit: 9 }),
  bar('geo-dist', 'Stops by distance from Aristotelous Square', ['Dist Band', ST], 'Stops', { page: 'geo', colors: [C.sea], sort: { by: 'd0', direction: 'asc' }, limit: 6 }),

  // ------------------------------------------------ 3. Access: is a frequent bus near you?
  kpi('ac-freq', 'Frequent Stop Share', FMT.pct, { page: 'access', view: ST, size: 30, color: C.sea }),
  kpi('ac-under', 'Underserved Stops', FMT.int, { page: 'access', view: ST, size: 30, color: C.terra }),
  kpi('ac-gap', 'Avg Longest Gap', FMT.min, { page: 'access', view: ST, size: 30, color: C.navy }),
  kpi('ac-sun', 'Stops Without Sunday Bus', FMT.int, { page: 'access', view: ST, size: 30, color: C.plum }),
  bar('ac-band', 'Frequent vs underserved stops, by distance from the centre', ['Dist Band', ST], [['Frequent Stop Share', 'm0'], ['Underserved Share', 'm1']],
    { page: 'access', orientation: 'vertical', grouped: true, legend: true, measureColors: { m0: C.sea, m1: C.terra }, sort: { by: 'd0', direction: 'asc' }, limit: 6, format: FMT.pct0, barPadding: 30 }),
  donut('ac-level', 'Stops by peak service level', ['Service Level', ST], 'Stops', { page: 'access', colors: LEVEL_COLORS }),
  bar('ac-wait', 'Longest daytime wait at a typical stop, minutes', ['Dist Band', ST], 'Avg Longest Gap', { page: 'access', gradient: [C.aqua, C.gold, C.terra], sort: { by: 'd0', direction: 'asc' }, limit: 6, format: FMT.min }),

  // ------------------------------------------------ 4. Rhythm: when the city moves
  {
    id: 'rh-hour', slot: 'rh-hour', page: 'rhythm', title: 'Buses leaving the terminus each hour', type: 'line', group: MAIN,
    dimensions: dims(['Hour Label', 'd0', SV], ['Day Type', 'd1', SV]), measures: meas('Trips per Day'),
    sort: [{ by: 'd0', direction: 'asc' }], limit: 200, legend: true, legendPosition: 'top', colors: [C.navy, C.gold, C.terra], coloring: 'categorical', lineCurve: 'curve',
    ops: measFormat('m0', FMT.int),
  },
  {
    id: 'rh-heat', slot: 'rh-heat', page: 'rhythm', title: 'Trips by service day and hour — three weeks of timetable', type: 'heatMap', group: MAIN,
    dimensions: dims(['Hour Label', 'd0', SV], ['Date Label', 'd1', SV]), measures: meas('Trips'),
    sort: [{ by: 'd0', direction: 'asc' }, { by: 'd1', direction: 'asc' }], limit: 600,
    gradient: ['#FBF7EF', C.sand, C.aqua, C.sea, C.navy],
  },
  bar('rh-dow', 'Average trips by day of week', ['Day Label', SV], 'Trips per Day', { page: 'rhythm', orientation: 'vertical', colors: [C.sea], sort: { by: 'd0', direction: 'asc' }, limit: 7, barPadding: 30 }),
  bar('rh-band', 'Share of the day’s trips, by time band', ['Time Band', SV], 'Share of Trips', { page: 'rhythm', colors: [C.gold], sort: { by: 'd0', direction: 'asc' }, limit: 6, format: FMT.pct }),

  // ------------------------------------------------ Live: a day on the buses (group live, its own world)
  {
    id: 'lv-map', slot: 'lv-map', page: 'live', title: 'Every stop, under the moving buses', type: 'scatter', group: MAIN,
    dimensions: dims(['Stop Label', 'd0', ST]),
    measures: [{ name: 'Stop Lon', ref: 'm0', format: PLAIN }, { name: 'Stop Lat', ref: 'm1', format: PLAIN }],
    limit: 4000, colors: ['#CDC3B1'], noLabels: true, map: true, extent: 'city', pointSize: 1, legend: false,
    axisTitles: { primaryMeasure: 'Longitude', secondaryMeasure: 'Latitude' },
  },
  // One chart per playback speed: 2-, 5- and 15-minute bars. All three mount up front; the speed
  // buttons show one.
  ...[['2', 'Two Min Slot'], ['5', 'Five Min Slot'], ['15', 'Fifteen Min Slot']].map(([grain, field]) => ({
    id: `lv-fleet-${grain}`, slot: `lv-fleet-${grain}`, page: 'live', title: `Buses in service, ${grain}-minute bars`, type: 'bar', group: MAIN, orientation: 'vertical',
    dimensions: dims([field, 'd0', FL], ['Category', 'd1', FL]), measures: meas('Buses in Service'),
    sort: [{ by: 'd0', direction: 'asc' }], limit: 8000, stacked: true, legend: true, legendPosition: 'top', barPadding: grain === '15' ? 8 : grain === '5' ? 2 : 0,
    colors: [C.gold, C.plum, C.aqua, C.sea, C.navy], coloring: 'categorical', hideMeasureAxis: false, grain: Number(grain),
    ops: measFormat('m0', FMT.int),
  })),

  // ------------------------------------------------ 5. Where people can board: the demand proxy
  {
    id: 'dm-hubs', slot: 'dm-hubs', page: 'demand', title: 'The 25 busiest stops — where the city changes buses', type: 'table', group: MAIN,
    dimensions: dims(['Stop Label', 'stop', ST], ['Sector', 'sector', ST]),
    measures: meas(['Weekday Departures', 'dep'], ['Lines per Stop', 'lines'], ['Peak Buses per Hour', 'bph'], ['Share of Departures', 'share'], ['Distance from Centre', 'dist']),
    sort: [{ by: 'dep', direction: 'desc' }], limit: 25, fontSize: 12.5,
    columnLabels: { stop: 'Stop', sector: 'Sector', dep: 'Departures', lines: 'Lines', bph: 'Bus/h AM', share: 'Share', dist: 'km out' },
    fitColumns: { stop: 0.3, sector: 0.11, dep: 0.16, lines: 0.08, bph: 0.12, share: 0.12, dist: 0.1 },
    ops: [...rowHeight(28), ...colFormat('dep', FMT.int), ...colFormat('lines', FMT.int), ...colFormat('bph', FMT.dec1), ...colFormat('share', '0.00%'), ...colFormat('dist', FMT.dec1),
      ...progress('dep', C.navy), ...right('lines', 'bph', 'share', 'dist'), bold('stop', C.navy)],
  },
  bar('dm-conn', 'Stops by number of lines calling', ['Connectivity', ST], 'Stops', { page: 'demand', colors: [C.aqua], sort: { by: 'd0', direction: 'asc' }, limit: 5 }),
  bar('dm-sector', 'Share of all weekday departures, by sector', ['Sector', ST], 'Share of Departures', { page: 'demand', colors: [C.navy], limit: 9, format: FMT.pct }),

  // ------------------------------------------------ 6. Operations: how hard the fleet works
  bar('op-speed', 'Scheduled speed by line category, km/h', ['Category', LV], 'Commercial Speed', { page: 'ops', gradient: [C.terra, C.gold, C.sea], limit: 6, format: '0.0' }),
  {
    id: 'op-scatter', slot: 'op-scatter', page: 'ops', title: 'Every line: how often it runs against how fast it moves', type: 'scatter', group: MAIN,
    dimensions: dims(['Line', 'd0', LV]), measures: meas('Line Weekday Trips', 'Line Speed'), limit: 300,
    gradient: [C.sea, C.aqua, C.gold, C.terra], gradientField: `[${LV}].[Weekday Trips]`, gradientRange: [0, 200], pointSize: 3, legend: true, legendTitle: 'Weekday trips (low → high)',
    axisTitles: { primaryMeasure: 'Weekday trips', secondaryMeasure: 'Scheduled speed, km/h' },
    ops: [...measFormat('m0', FMT.int), ...measFormat('m1', '0')],
  },
  bar('op-fleet', 'Buses on the road at 08:00, top 15 lines', ['Line Label', LV], 'Buses at 8am', { page: 'ops', colors: [C.sea], limit: 15, barPadding: 18 }),
  bar('op-vh', 'Bus-hours a day, by time band', ['Time Band', SV], 'Vehicle Hours per Day', { page: 'ops', orientation: 'vertical', colors: [C.navy], sort: { by: 'd0', direction: 'asc' }, limit: 6, barPadding: 30 }),

  // ------------------------------------------------ 7. Route explorer (group route) + comparison (group main)
  {
    id: 'rt-map', slot: 'rt-map', page: 'route', title: 'The selected line, stop by stop', type: 'scatter', group: ROUTE,
    dimensions: dims(['Stop Label', 'd0', LS]),
    measures: [{ name: 'Route Stop Lon', ref: 'm0', format: PLAIN }, { name: 'Route Stop Lat', ref: 'm1', format: PLAIN }],
    limit: 4000, colors: [C.navy], legend: false,
    noLabels: true, map: true, extent: 'route', pointSize: 2,
    axisTitles: { primaryMeasure: 'Longitude', secondaryMeasure: 'Latitude' },
  },
  {
    id: 'rt-profile', slot: 'rt-profile', page: 'route', title: 'Line profile, weekday', type: 'table', group: ROUTE,
    dimensions: dims(['Line', 'line', LV]),
    measures: meas(['Line Weekday Trips', 'trips'], ['First Bus', 'first'], ['Last Bus', 'last'], ['AM Headway', 'am'], ['Midday Headway', 'mid'], ['Trip Minutes', 'mins'], ['Avg Route Km', 'km'], ['Line Speed', 'speed'], ['Buses at 8am', 'buses'], ['Line Stops Served', 'stops']),
    limit: 5, fontSize: 13,
    columnLabels: { line: 'Line', trips: 'Trips', first: 'First', last: 'Last', am: 'AM gap', mid: 'Midday gap', mins: 'Trip', km: 'Length', speed: 'Speed', buses: 'Buses', stops: 'Stops' },
    // One row, nothing to sort: no sort icons and a 12px header, so no header is cut to an ellipsis.
    fitColumns: { line: 0.07, trips: 0.07, first: 0.08, last: 0.08, am: 0.09, mid: 0.12, mins: 0.09, km: 0.1, speed: 0.12, buses: 0.08, stops: 0.08 },
    ops: [{ name: 'setTableAllColumnsSortIconBehavior', payload: 'hide' }, { name: 'setTableHeaderFontSize', payload: 12 }, ...rowHeight(34), ...colFormat('trips', FMT.int), ...colFormat('am', FMT.min), ...colFormat('mid', FMT.min), ...colFormat('mins', FMT.min), ...colFormat('km', '0.0" km"'), ...colFormat('speed', FMT.kmh), ...colFormat('buses', FMT.int), ...colFormat('stops', FMT.int),
      ...bands('speed', [16, 22, 999], [C.terra, C.gold, C.sea]), bold('line', C.terra)],
  },
  {
    id: 'rt-hour', slot: 'rt-hour', page: 'route', title: 'Trips each hour on the selected line', type: 'bar', group: ROUTE, orientation: 'vertical',
    dimensions: dims(['Hour Label', 'd0', SV], ['Day Type', 'd1', SV]), measures: meas('Trips per Day'),
    sort: [{ by: 'd0', direction: 'asc' }, { by: 'd1', direction: 'asc' }], limit: 100, colors: [C.gold, C.terra, C.navy], coloring: 'categorical', grouped: true, legend: true, legendPosition: 'top', barPadding: 15,
    ops: measFormat('m0', '0.0'),
  },
  {
    id: 'rt-compare', slot: 'rt-compare', page: 'route', title: 'Compare every line — click one to explore it', type: 'table', group: MAIN,
    dimensions: dims(['Line Label', 'line', LV], ['Category', 'cat', LV]),
    measures: meas(['Trips per Day', 'trips'], ['Share of Trips', 'share'], ['Commercial Speed', 'speed'], ['Avg Trip Minutes', 'mins'], ['Peak Share', 'peak'], ['Sunday Retention', 'sun'], ['Vehicle Km per Day', 'vkm']),
    sort: [{ by: 'trips', direction: 'desc' }], limit: 300, fontSize: 12.5,
    columnLabels: { line: 'Line', cat: 'Category', trips: 'Trips/day', share: 'Share of network', speed: 'Speed', mins: 'Trip time', peak: 'In peaks', sun: 'Sun vs wkday', vkm: 'Bus-km/day' },
    fitColumns: { line: 0.28, cat: 0.09, trips: 0.08, share: 0.12, speed: 0.09, mins: 0.08, peak: 0.07, sun: 0.09, vkm: 0.08 },
    ops: [...rowHeight(28), ...colFormat('trips', FMT.int), ...colFormat('share', '0.00%'), ...colFormat('speed', FMT.kmh), ...colFormat('mins', FMT.min), ...colFormat('peak', FMT.pct0), ...colFormat('sun', FMT.pct0), ...colFormat('vkm', FMT.int),
      ...progress('share', C.sea), ...bands('speed', [16, 22, 999], [C.terra, C.gold, C.sea]), ...bands('sun', [0.5, 0.8, 99], [C.terra, C.gold, C.sea]), ...right('trips', 'mins', 'peak', 'vkm'), bold('line', C.navy)],
  },

  // ------------------------------------------------ 8. Opportunities
  {
    id: 'op-gaps', slot: 'op-gaps', page: 'opps', title: 'Within 10 km of the centre, yet a bus less than every 20 minutes', type: 'table', group: MAIN,
    filters: [{ view: ST, field: 'Service Level', values: ['4. Low (<3/h)'] }, { view: ST, field: 'Dist Band', values: ['1. Centre (<2 km)', '2. Inner city (2–5 km)', '3. Outer city (5–10 km)'] }],
    dimensions: dims(['Stop Label', 'stop', ST], ['Sector', 'sector', ST]),
    measures: meas(['Longest Gap', 'gap'], ['Peak Buses per Hour', 'bph'], ['Weekday Departures', 'dep'], ['Lines per Stop', 'lines'], ['Distance from Centre', 'dist']),
    sort: [{ by: 'gap', direction: 'desc' }], limit: 200, fontSize: 12.5,
    columnLabels: { stop: 'Stop', sector: 'Sector', gap: 'Worst wait', bph: 'Bus/h', dep: 'Deps', lines: 'Lines', dist: 'km' },
    fitColumns: { stop: 0.3, sector: 0.15, gap: 0.17, bph: 0.09, dep: 0.09, lines: 0.08, dist: 0.08 },
    ops: [{ name: 'setTableHeaderFontSize', payload: 12 }, ...rowHeight(28), ...colFormat('gap', FMT.min), ...colFormat('bph', FMT.dec1), ...colFormat('dep', FMT.int), ...colFormat('lines', FMT.int), ...colFormat('dist', FMT.dec1),
      ...bands('gap', [30, 60, 9999], [C.sea, C.gold, C.terra]), ...right('bph', 'dep', 'lines', 'dist'), bold('stop', C.navy)],
  },
  {
    id: 'op-slow', slot: 'op-slow', page: 'opps', title: 'Busy and slow: where bus priority would pay back fastest', type: 'table', group: MAIN,
    filters: [{ view: LV, field: 'Speed Band', values: ['1. Crawling (<14 km/h)', '2. Slow (14–18 km/h)'] }],
    dimensions: dims(['Line Label', 'line', LV]),
    measures: meas(['Trips per Day', 'trips'], ['Commercial Speed', 'speed'], ['Vehicle Hours per Day', 'vh'], ['Avg Trip Minutes', 'mins']),
    sort: [{ by: 'vh', direction: 'desc' }], limit: 60, fontSize: 12.5,
    columnLabels: { line: 'Line', trips: 'Trips/day', speed: 'Speed', vh: 'Bus-h/day', mins: 'Trip' },
    fitColumns: { line: 0.42, trips: 0.13, speed: 0.14, vh: 0.19, mins: 0.1 },
    ops: [...rowHeight(28), ...colFormat('trips', FMT.int), ...colFormat('speed', FMT.kmh), ...colFormat('vh', FMT.int), ...colFormat('mins', FMT.min),
      ...progress('vh', C.terra), ...bands('speed', [14, 18, 999], [C.terra, C.gold, C.sea]), ...right('trips', 'mins'), bold('line', C.navy)],
  },
  stopMap('op-map', 'Underserved stops (blue) against the frequent network (red)', { page: 'opps', extent: 'city' }),
];

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

/** 0.5.x static filters: one `setStaticFilterGroup` call replaces them all; values are strings. */
const staticFilter = ({ fieldKey, values }) => ({ operator: 'or', filters: values.map((v) => ({ fieldKey, operator: 'equals', values: { value: String(v) } })) });
const filterOps = (filters) => (filters.length === 0 ? [] : [{ name: 'setStaticFilterGroup', payload: { operator: 'and', filters: filters.map(staticFilter) } }]);

const DATE_FORMATS = { date: { formatType: 'mmmyyyy' }, timestamp: { formatType: 'mmmyyyy' }, datetime: { formatType: 'mmmyyyy' } };
const isDate = (entry) => !!DATE_FORMATS[String(entry.field.dataType ?? '').toLowerCase()];
const dimensionFormat = (entry) => entry.format ?? (isDate(entry) ? DATE_FORMATS.date : PLAIN);
const dimensionEntries = (dimensions) => dimensions.map((entry) => ({ fieldKey: entry.field.fieldKey, format: dimensionFormat(entry), ref: entry.ref, ...(isDate(entry) && !entry.format ? { temporalGrouping: { mode: 'level', dateLevel: 'month' } } : {}) }));
const measureEntries = (measures) => measures.map(({ field, ref, format, aggregation }) => ({ ...measureRef(field, ref, aggregation), format }));
const withSortAndLimit = (tile) => ({
  ...(tile.sort ? { sorting: [].concat(tile.sort).map(({ by, direction }) => ({ by, direction })) } : {}),
  ...(tile.limit ? { limiting: { queryLimit: tile.limit } } : {}),
});

const tableDefinitionOf = (tile, resolved) => ({
  version: 1,
  type: 'table',
  data: {
    columns: [
      ...dimensionEntries(resolved.dimensions).map((column) => ({ ...column, role: 'dimension' })),
      ...measureEntries(resolved.measures).map((column) => ({ ...column, role: 'measure' })),
    ],
  },
  ...withSortAndLimit(tile),
});

const definitionOf = (tile, resolved) => {
  if (tile.type === 'table') return tableDefinitionOf(tile, resolved);
  const data = { measures: measureEntries(resolved.measures), ...(resolved.dimensions.length ? { dimensions: dimensionEntries(resolved.dimensions) } : {}) };
  if (tile.type === 'number') return { version: 1, type: 'number', data: { measure: data.measures[0] } };
  if (tile.type === 'scatter') {
    return {
      version: 1, type: 'scatter', data,
      ...(tile.limit ? { limiting: { queryLimit: tile.limit } } : {}),
      presentation: {
        axes: {
          primaryMeasure: { labelsVisible: true, title: tile.axisTitles.primaryMeasure, titleVisible: true },
          secondaryMeasure: { labelsVisible: true, title: tile.axisTitles.secondaryMeasure, titleVisible: true },
        },
        legend: { visible: false },
      },
    };
  }
  if (tile.type === 'pie') return { version: 1, type: 'pie', data, ...withSortAndLimit(tile), presentation: { legend: { visible: true } } };
  return {
    version: 1,
    type: tile.type,
    data,
    ...withSortAndLimit(tile),
    presentation: {
      axes: { dimension: { labelsVisible: true, titleVisible: false }, primaryMeasure: { labelsVisible: !tile.hideMeasureAxis, titleVisible: false } },
      // A line compiles only with a visible legend; theme.js hides it after when asked.
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
  const ops = [...filterOps(resolved.filters), ...(tile.ops ?? [])];
  return {
    tile: {
      ...tile,
      ops,
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
  for (const t of tiles) if (t.group === MAIN && t.page !== 'controls') t.group = chapterGroup(t.page);
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

// ===========================================================================
// The app's path from a compiled tile to the vSpec it mounts: theme, then the app's own vSpec
// settings. Shared with tools/compile-adapter.mjs so the offline check runs this exact code.

/** A map's lon/lat window, written onto both measure axes (`which`: an EXTENT key or { lon, lat }). */
export const withExtent = (tile, which) => {
  const ext = which === 'auto' ? null : typeof which === 'string' ? EXTENT[which] : which;
  const axes = tile.vSpec.axes ?? {};
  const range = (r) => (r ? { axisRangeOption: 'minmax', minValue: r[0], maxValue: r[1] } : { axisRangeOption: 'auto' });
  return { ...tile.vSpec, axes: { ...axes, primaryMeasure: { ...axes.primaryMeasure, axisRange: range(ext?.lon) }, secondaryMeasure: { ...axes.secondaryMeasure, axisRange: range(ext?.lat) } } };
};

/** Theme a compiled tile; returns the tile to mount and the operations that were refused. */
export const prepareTile = async (tile, availableFields, dataBinding = {}) => {
  const themed = await themeVSpec({ id: tile.id, type: tile.type, vSpec: tile.vSpec, dataBinding }, availableFields, tile);
  let vSpec = themed.vSpec;
  if (tile.type === 'bar' && vSpec.axes?.primaryMeasure) vSpec = { ...vSpec, axes: { ...vSpec.axes, primaryMeasure: { ...vSpec.axes.primaryMeasure, axisRange: { axisRangeOption: 'auto', startsAtZero: true } } } };
  const out = { ...tile, vSpec };
  if (tile.map && tile.extent && tile.extent !== 'auto') out.vSpec = withExtent(out, tile.extent);
  return { tile: out, failed: themed.failed };
};

/** Pixel column widths for a table that fills `width`: shares of the width, per definition ref. */
export const fitColumnRequests = (tile, width) => {
  const requests = [{ name: 'setTableAllColumnsResponsiveWidth', payload: false }];
  for (const [ref, share] of Object.entries(tile.fitColumns ?? {})) {
    const item = tile.resolvedRefs?.[ref];
    if (item) requests.push({ name: 'setColumnWidth', payload: { dataItemInternalKey: item.dataItemInternalKey, dataItemUniqueSignature: item.dataItemUniqueSignature, width: `${Math.floor(width * share)}px` } });
  }
  return requests;
};
