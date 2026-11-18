/**
 * Theming for Astrato objects.
 *
 * Charts have no host-theme input; they always render with the built-in light
 * palette. The supported way to restyle them is appearance operations, which
 * write styling into the object's own vSpec. Every operation here is applied to
 * the compiled vSpec *before* the object mounts, where an operation is pure
 * computation; after mount each would cost an engine round trip.
 *
 * Payload shapes are taken from each operation's published `payloadSchema`
 * (they are not consistent across operations), and each request is filtered
 * against the type's supported-operation list before it is sent. A rejected
 * operation is reported, never thrown.
 */
import { applyOperations } from '@astrato-io/visualizations/operations';
import { getVisualizationMetadata } from '@astrato-io/visualizations/metadata';

/*
 * Light identity: navy on white panels; teal marks our university; green climbs, red falls.
 */
export const PALETTE = {
  blue: '#1F4E79', dark: '#0B2545', bright: '#2E6FA8', light: '#A9C1D9',
  grey: '#8A94A3', red: '#C0392B', red2: '#C0392B', orange: '#D98323', green: '#1E8449', yellow: '#E1B12C',
  us: '#0E9F9A',
};
export const INK = {
  card: '#FFFFFF',
  cardAlt: '#F4F7F8',
  line: '#D8DDE0',
  text: '#212B32',
  muted: '#4C6272',
  dim: '#768692',
  teal: PALETTE.blue,
  violet: PALETTE.dark,
  mist: '#E8F1F8',
};

export const GROUP_COLORS = [PALETTE.blue, PALETTE.dark, PALETTE.light, PALETTE.green, PALETTE.orange, PALETTE.grey];
export const MOVE_COLORS = { up: '#5FD39A', down: '#F07D8C' };
export const REGION_COLORS = GROUP_COLORS;

export const SERIES = { cost: INK.teal, value: INK.violet };

const AXES = ['dimension', 'primaryMeasure', 'secondaryMeasure'];

const axisColourOps = () =>
  AXES.flatMap((axisName) => [
    { name: 'setAxisLabelColor', payload: { axisName, labelColor: INK.muted } },
    { name: 'setAxisTitleColor', payload: { axisName, titleColor: INK.muted } },
    { name: 'setAxisLineColor', payload: { axisName, lineColor: INK.line } },
    { name: 'setAxisTickColor', payload: { axisName, tickColor: INK.line } },
  ]);

/** Hide one axis's labels, line and ticks — used by the KPI sparklines. */
const hideAxisOps = (axisName) => [
  { name: 'setShowAxisLabels', payload: { axisName, showLabels: false } },
  { name: 'setShowAxisLine', payload: { axisName, showAxisLine: false } },
  { name: 'setShowAxisTicks', payload: { axisName, showAxisTicks: false } },
  { name: 'setShowAxisTitle', payload: { axisName, showAxisName: false } },
];

/** `presentation.legend.visible: false` does not hide a legend; this does. */
const legendOps = (legend) => [
  { name: 'setLegendEnabled', payload: Boolean(legend) },
  { name: 'setLegendItemLabelFill', payload: INK.muted },
  { name: 'setLegendItemLabelFontSize', payload: 12 },
];

/** Resolve a definition ref to the data item the compiler created for it. */
const dataItem = (spec, ref) => {
  const resolved = spec.resolvedRefs?.[ref];
  if (!resolved?.dataItemInternalKey || !resolved.dataItemUniqueSignature) return undefined;
  return {
    dataItemInternalKey: resolved.dataItemInternalKey,
    dataItemUniqueSignature: resolved.dataItemUniqueSignature,
  };
};

const BY_COLUMN_NAME = new Set(['setColumnFormatType', 'setColumnFormatString']);
/** The exact column name a definition ref compiled to. */
const columnName = (spec, ref) => {
  const key = spec.resolvedRefs?.[ref]?.dataItemInternalKey;
  const items = [...(spec.vSpec?.measures ?? []), ...(spec.vSpec?.dimensions ?? []), ...(spec.vSpec?.columns ?? [])];
  const hit = items.find((item) => item.dataItem?.internalKey === key);
  return hit?.dataItem?.name ?? hit?.name ?? (spec.measures ?? []).find((measure) => measure.ref === ref)?.name;
};

/** Every measure ref the tile declared. */
const measureRefs = (spec) => (spec.measures ?? []).map((measure) => measure.ref);

/**
 * Series colour. One colour is a flat colour, not a one-entry palette (which
 * the categorical palette would not honour). For a palette, the coloring type
 * comes first because it decides what the palette is dealt across. The custom
 * colour operations switch the chart onto the custom palette themselves;
 * `setChartPalette('custom-palette')` is rejected for these types.
 */
const colourOps = (spec) => {
  // Value overwrites and measure rules from the definition carry the meaning; keep them.
  if (spec.coloring && (spec.coloring.overwrites?.length || spec.coloring.rules?.length)) return [];
  if (spec.gradient) {
    return [
      { name: 'setColoringType', payload: 'gradient' },
      { name: 'setCustomGradientColors', payload: { colors: [...spec.gradient] } },
    ];
  }
  const colors = spec.colors ?? [SERIES.cost, SERIES.value];
  if (colors.length === 1) {
    return [
      { name: 'setColoringType', payload: 'single' },
      { name: 'setColoringColor', payload: colors[0] },
    ];
  }
  return [
    ...(spec.coloring ? [{ name: 'setColoringType', payload: spec.coloring }] : []),
    // Persistent colours hash each value onto the palette (two eras landed on one
    // colour); off, the palette is dealt in sort order, which the app controls.
    { name: 'setColoringPersistentColors', payload: false },
    { name: 'setCustomPaletteColors', payload: { colors: [...colors] } },
  ];
};

/**
 * A date dimension compiles with `formatType: 'none'` (the definition schema
 * refuses a date format there), which leaves raw epoch milliseconds on the
 * axis. The date format is applied here instead, where date names are accepted.
 */
const dimensionFormatOps = (spec) => {
  if (!spec.dimensionFormat) return [];
  const target = dataItem(spec, spec.dimensionFormat.ref);
  if (!target) return [];
  const { formatType, level, part } = spec.dimensionFormat;
  // A `date` item refuses month and quarter formats until it has a date level;
  // a date part (such as the ISO weekday) groups every date into that part.
  return [
    ...(level ? [{ name: 'setDimensionTemporalGrouping', payload: { ...target, mode: 'level', dateLevel: level } }] : []),
    ...(part ? [{ name: 'setDimensionTemporalGrouping', payload: { ...target, mode: 'part', datePart: part } }] : []),
    { name: 'setDimensionFormatType', payload: { ...target, formatType } },
  ];
};

/** Value labels on marks, for the types that draw them. */
const dataLabelOps = (spec) => {
  if (!spec.dataLabels) return [];
  return measureRefs(spec).flatMap((ref) => {
    const target = dataItem(spec, ref);
    if (!target) return [];
    return [
      { name: 'setMeasureDataLabelsShow', payload: { ...target, show: true } },
      { name: 'setMeasureDataLabelFontSize', payload: { ...target, fontSize: spec.dataLabels.size ?? 11 } },
      // Labels outside a bar default to a dark ink that vanishes on the HUD.
      { name: 'setMeasureDataLabelIsColored', payload: { ...target, isColored: false } },
      { name: 'setMeasureDataLabelShowBackdrop', payload: { ...target, showBackdrop: Boolean(spec.dataLabels.backdrop) } },
      ...(spec.dataLabels.backdrop ? [{ name: 'setMeasureDataLabelBackdropColor', payload: { ...target, backdropColor: spec.dataLabels.backdrop } }] : []),
      { name: 'setMeasureDataLabelTextColor', payload: { ...target, textColor: INK.text } },
      // A label that has no room past the end of its bar goes inside it rather than ellipsising.
      ...(spec.type === 'bar' ? [{ name: 'setMeasureDataLabelBarPlacements', payload: { ...target, placements: [{ position: 'outside' }, { position: 'inside' }] } }] : []),
      ...(spec.dataLabels.parts ? [{ name: 'setMeasureDataLabelDisplayParts', payload: { ...target, displayParts: spec.dataLabels.parts } }] : []),
      ...(spec.dataLabels.format
        ? [
            { name: 'setMeasureFormatType', payload: { ...target, formatType: 'custom' } },
            { name: 'setMeasureFormatString', payload: { ...target, formatString: spec.dataLabels.format } },
          ]
        : []),
    ];
  });
};

/** A line draws some point values by default; a sparkline is the shape only. */
const hideDataLabelOps = (spec) =>
  measureRefs(spec).flatMap((ref) => {
    const target = dataItem(spec, ref);
    return target ? [{ name: 'setMeasureDataLabelsShow', payload: { ...target, show: false } }] : [];
  });

/** Friendly table headers, keyed by the compiler's ref → data-item mapping. */
const columnLabelOps = (spec) => {
  if (!spec.columnLabels || !spec.resolvedRefs) return [];
  return Object.entries(spec.columnLabels).flatMap(([ref, label]) => {
    const target = dataItem(spec, ref);
    if (!target) return [];
    return [
      { name: 'setColumnCustomLabelEnabled', payload: { ...target, enabled: true } },
      { name: 'setColumnCustomLabelValue', payload: { ...target, value: label } },
    ];
  });
};

/** Date formats on table columns, applied after compile for the same reason as axes. */
const columnFormatOps = (spec) =>
  Object.entries(spec.columnFormats ?? {}).flatMap(([ref, formatType]) => {
    const target = dataItem(spec, ref);
    return target ? [{ name: 'setColumnFormatType', payload: { ...target, formatType } }] : [];
  });

/**
 * A tile's own operations, beyond the theme: `{ name, ref?, payload }`. A
 * `ref` is resolved to the compiler's data item and merged into the payload,
 * so a tile can address a column or measure by its definition ref.
 */
const tileOps = (spec) =>
  (spec.ops ?? []).flatMap(({ name, ref, payload }) => {
    if (!ref) return [{ name, payload }];
    // visualizations 0.8: the column format operations address a column by its exact name,
    // and reject the data-item keys every other column operation still takes.
    if (BY_COLUMN_NAME.has(name)) {
      const column = columnName(spec, ref);
      return column ? [{ name, payload: { name: column, ...(payload ?? {}) } }] : [];
    }
    const target = dataItem(spec, ref);
    return target ? [{ name, payload: { ...target, ...(payload ?? {}) } }] : [];
  });

const tableOps = (spec) => [
  { name: 'setTableBackgroundColor', payload: spec.background ?? INK.card },
  { name: 'setTableOddBackgroundColor', payload: spec.background ?? INK.card },
  { name: 'setTableEvenBackgroundColor', payload: spec.background ?? INK.cardAlt },
  { name: 'setTableHeaderBackgroundColor', payload: INK.card },
  { name: 'setTableHeaderFontColor', payload: INK.muted },
  { name: 'setTableAllColumnsFontColor', payload: INK.text },
  { name: 'setTableBorderColor', payload: spec.background ?? INK.line },
  { name: 'setTableColumnBorderColor', payload: spec.background ?? INK.line },
  { name: 'setTableHeaderBorderColor', payload: INK.line },
  { name: 'setTableHighlightBackgroundColor', payload: INK.mist },
  { name: 'setTableHighlightTextColor', payload: INK.text },
  // Header icons reserve width in every header cell; keep only the active sort arrow.
  { name: 'setTableAllColumnsFilterIconBehavior', payload: 'hide' },
  { name: 'setTableAllColumnsFreezeIconBehavior', payload: 'hide' },
  { name: 'setTableAllColumnsSortIconBehavior', payload: 'active' },
  ...(spec.headerHidden ? [{ name: 'setTableHeaderHidden', payload: true }] : []),
  ...(spec.fontSize ? [{ name: 'setTableBodyFontSize', payload: spec.fontSize }] : []),
  // Responsive widths scale every column down (150px drew as 90px), so a table
  // that sets its own column widths turns them off to get exactly those widths.
  ...((spec.ops ?? []).some((op) => op.name === 'setColumnWidth') ? [{ name: 'setTableAllColumnsResponsiveWidth', payload: false }] : []),
  ...columnLabelOps(spec),
  ...columnFormatOps(spec),
  ...tileOps(spec),
];

/** The appearance operations for one tile. */
const baseOperations = (spec) => {
  switch (spec.type) {
    case 'line':
      return [
        // 0.5.2 and later animate lines; a compiled line has no curve, so set one (never stepped).
        { name: 'setLineType', payload: spec.lineCurve ?? 'curve' },
        ...(spec.lineType ? [{ name: 'setLineChartType', payload: spec.lineType }] : []),
        ...dimensionFormatOps(spec),
        ...colourOps(spec),
        ...axisColourOps(),
        // A sparkline is the shape only: no axes at all.
        ...(spec.sparkline ? [...hideAxisOps('primaryMeasure'), ...hideAxisOps('dimension'), ...hideDataLabelOps(spec)] : []),
        ...legendOps(spec.legend),
        ...dataLabelOps(spec),
      ];
    case 'bar':
      // Bar labels have no text-colour op and draw dark ink outside the bar;
      // a light backdrop chip keeps them legible on the dark panels.
      spec = spec.dataLabels && spec.dataLabels.backdrop === undefined ? { ...spec, dataLabels: { ...spec.dataLabels, backdrop: '#DDE6EF' } } : spec;
      return [
        ...dimensionFormatOps(spec),
        ...colourOps(spec),
        { name: 'setBarChartBarRadius', payload: 2 },
        ...(spec.stacked ? [{ name: 'setBarChartLayout', payload: 'stacked' }] : []),
        ...(spec.grouped ? [{ name: 'setBarChartLayout', payload: 'groups' }] : []),
        ...(spec.barPadding !== undefined ? [{ name: 'setBarChartBarPadding', payload: spec.barPadding }] : []),
        ...axisColourOps(),
        ...(spec.hideMeasureAxis ? hideAxisOps('primaryMeasure') : []),
        ...(spec.hideDimensionAxis ? hideAxisOps('dimension') : []),
        ...legendOps(spec.legend),
        ...dataLabelOps(spec),
      ];
    case 'combo':
      return [
        ...dimensionFormatOps(spec),
        ...colourOps(spec),
        ...Object.entries(spec.graphTypes ?? {}).flatMap(([ref, graphType]) => {
          const target = dataItem(spec, ref);
          return target ? [{ name: 'setComboMeasureGraphType', payload: { ...target, graphType } }] : [];
        }),
        ...Object.entries(spec.graphTypes ?? {}).flatMap(([ref]) => {
          const target = dataItem(spec, ref);
          return target && spec.measureAxisFormat
            ? [
                { name: 'setMeasureFormatType', payload: { ...target, formatType: 'custom' } },
                { name: 'setMeasureFormatString', payload: { ...target, formatString: spec.measureAxisFormat } },
              ]
            : [];
        }),
        ...axisColourOps(),
        ...legendOps(spec.legend),
      ];
    case 'sankey':
      return [
        ...colourOps(spec),
        ...legendOps(false),
        { name: 'setSankeyNodeLabelsShow', payload: true },
        { name: 'setSankeyNodeLabelFontSize', payload: 12 },
        // Labels paint in dark ink; a paper backdrop keeps them legible on the stage.
        { name: 'setSankeyNodeLabelShowBackdrop', payload: true },
        { name: 'setSankeyNodeLabelBackdropColor', payload: INK.text },
        { name: 'setSankeyColumnHeaderLabelsShow', payload: true },
      ];
    case 'scatter':
      return [
        ...colourOps(spec),
        // A third variable on the marks: colour follows a raw field (speed).
        ...(spec.gradientField ? [
          { name: 'setColoringGradientField', payload: { key: spec.gradientField, sourceKind: 'field', aggregation: 'MAX' } },
          ...(spec.gradientRange ? [{ name: 'setColoringGradientMin', payload: spec.gradientRange[0] }, { name: 'setColoringGradientMax', payload: spec.gradientRange[1] }] : []),
        ] : []),
        ...axisColourOps(),
        { name: 'setLegendEnabled', payload: Boolean(spec.legend) },
        ...(spec.legend ? [
          { name: 'setLegendPosition', payload: 'top' },
          ...(spec.legendTitle ? [{ name: 'setLegendTitle', payload: spec.legendTitle }] : []),
          { name: 'setLegendItemLabelFill', payload: INK.muted },
          { name: 'setLegendItemLabelFontSize', payload: 12 },
        ] : []),
        { name: 'setShowDataLabels', payload: true },
        { name: 'setDataLabelFontSize', payload: 12 },
        { name: 'setDataLabelDensity', payload: { density: 'high' } },
        // Text mode with coloured labels is the combination that draws light text on
        // this dark panel; backdrop mode drew nothing and plain text drew dark ink.
        { name: 'setDataLabelTextOrBackdrop', payload: 'text' },
        { name: 'setDataLabelIsColored', payload: true },
        { name: 'setLabelOverlap', payload: { labelOverlap: 'auto' } },
        ...(spec.noLabels ? [{ name: 'setShowDataLabels', payload: false }] : []),
      ];
    case 'heatMap':
      return [...dimensionFormatOps(spec), ...colourOps(spec), ...axisColourOps(), ...legendOps(spec.legend), ...dataLabelOps(spec)];
    case 'pie': {
      const target = dataItem(spec, measureRefs(spec)[0]);
      return [
        ...(spec.donut ? [{ name: 'setPieChartType', payload: 'donut' }] : []),
        ...(spec.coloring ? [{ name: 'setColoringType', payload: spec.coloring }] : []),
        ...colourOps(spec),
        ...legendOps(spec.legend),
        ...(target && spec.sliceLabels
          ? [
              { name: 'setPieLabelsShow', payload: { ...target, show: true } },
              { name: 'setPieLabelFormat', payload: { ...target, labelFormat: 'dimensionAndMeasure' } },
              { name: 'setPieMeasureLabelFormat', payload: { ...target, measureLabelFormat: 'valueAndPercentage' } },
              { name: 'setPieLabelColor', payload: { ...target, textColor: INK.text } },
              { name: 'setPieLabelFontSize', payload: { ...target, fontSize: 12 } },
            ]
          : []),
      ];
    }
    case 'distribution-gauge':
      return [
        { name: 'setGaugeBarMode', payload: true },
        ...colourOps(spec),
        ...legendOps(spec.legend),
      ];
    case 'number':
      return [
        { name: 'setNumberFontColor', payload: INK.text },
        { name: 'setNumberFontSize', payload: spec.numberFontSize ?? 30 },
        { name: 'setNumberFontWeight', payload: 500 },
        { name: 'setHorizontalAlign', payload: spec.align ?? 'left' },
      ];
    case 'table':
      return tableOps(spec);
    case 'filter':
      // Background and text colour together: a background alone can leave the
      // control's default dark text unreadable on it.
      return [
        ...dimensionFormatOps(spec),
        { name: 'setFilterBackgroundColor', payload: INK.card },
        { name: 'setFilterBorderColor', payload: INK.line },
        { name: 'setFilterFontStyle', payload: { fontColor: INK.text, fontSize: 12 } },
      ];
    default:
      return [];
  }
};

/** The appearance operations for one tile, then its own. */
export const themeOperations = (spec) => (spec.type === 'table' ? baseOperations(spec) : [...baseOperations(spec), ...tileOps(spec)]);

/** Operation names this visualization type actually supports. */
const supportedNames = (type) => {
  try {
    return new Set(getVisualizationMetadata(type).operations.names);
  } catch {
    return new Set();
  }
};

/**
 * Apply extra operations (a tile's `ops`, and the theme) to a compiled, not yet
 * mounted instance. Each is applied on its own so one bad payload cannot take
 * the others down; the result says which failed and which the type lacks.
 */
export const applyEach = async (instance, availableFields, type, requests) => {
  const supported = supportedNames(type);
  const skipped = requests.filter((request) => !supported.has(request.name)).map((request) => request.name);
  // One call for the whole list first: per-operation calls cost a round of
  // async work each and dominated boot. Only if something fails do we fall
  // back to one call per operation, to keep the good ones and name the bad.
  const batch = requests.filter((request) => supported.has(request.name)).map((request, index) => ({ id: `op${index}`, ...request }));
  if (batch.length === 0) return { vSpec: instance.vSpec, failed: [], skipped };
  try {
    const outcome = await applyOperations({ instance, availableFields, operationRequests: batch });
    const results = Object.values(outcome.results ?? {});
    if (outcome.vSpec && results.length === batch.length && results.every((result) => result?.success !== false)) {
      return { vSpec: outcome.vSpec, failed: [], skipped };
    }
  } catch {
    // Fall through to one call per operation.
  }
  let vSpec = instance.vSpec;
  const failed = [];
  for (const request of requests) {
    if (!supported.has(request.name)) continue;
    try {
      const outcome = await applyOperations({ instance: { ...instance, vSpec }, availableFields, operationRequests: [request] });
      // `results` is an object keyed by request id, not an array.
      const result = Object.values(outcome.results ?? {})[0];
      if (result && result.success === false) {
        failed.push({ name: request.name, reason: result.error ?? result.message ?? 'rejected' });
        continue;
      }
      vSpec = outcome.vSpec;
    } catch (error) {
      failed.push({ name: request.name, reason: String(error?.message ?? error) });
    }
  }
  return { vSpec, failed, skipped };
};

export const themeVSpec = (instance, availableFields, spec) =>
  applyEach(instance, availableFields, spec.type, themeOperations(spec));
