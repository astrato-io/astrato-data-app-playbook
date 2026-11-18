/**
 * The objects of the lending affordability app and the selection groups they live in.
 *
 * Every figure, chart, table and filter inside a panel is an Astrato visualization
 * instance declared against the "Lending Affordability & Decisions" semantic layer.
 *
 * Groups:
 *  - `main`     — the portfolio view, narrowed by the Product / Region / Channel filters.
 *  - `policy`   — the same filters mirrored, plus range selections written by the
 *                 threshold sliders (DTI, disposable income, credit score, stress test):
 *                 every object in it shows only applications that pass the policy in view.
 *  - `workflow` — the decision pipeline objects.
 */
import { createDefaultVSpec } from '@astrato-io/visualizations';
import { compileVisualizationDefinition } from '@astrato-io/visualizations/definitions';
import { measureRef } from './fields.js';
import { PALETTE as NW } from './theme.js';
import { QUESTIONS } from './questions.js';

export const PV = 'Applications';
export const COL = { product: 'Product', region: 'Region', channel: 'Channel', month: 'Application Month Label', one: 'App Count' };

export const MAIN = 'main';
export const POLICY = 'policy';
export const FLOW = 'workflow';
/**
 * One selection group per affordability rule: each holds only that rule's breach range,
 * so an Applications KPI in it counts the applications breaching that rule (governed count).
 */
export const RULES = [
  { key: 'dti', group: 'rule-dti', label: 'Debt-to-income above the maximum' },
  { key: 'disp', group: 'rule-disp', label: 'Disposable income below the minimum' },
  { key: 'score', group: 'rule-score', label: 'Credit score below the minimum' },
  { key: 'exp', group: 'rule-exp', label: 'Expenses above the maximum share of income' },
];
export const ALL_GROUPS = [MAIN, POLICY, FLOW, ...RULES.map((r) => r.group)];

export const FIELD_LABELS = { Product: 'Product', Region: 'Region', Channel: 'Channel', 'Income Band': 'Income band', 'Credit Band': 'Credit band', 'Application Month Label': 'Month', 'Debt To Income': 'DTI', 'Disposable After Loan': 'Disposable', 'Credit Score': 'Credit score', 'Stressed Disposable': 'Stressed disposable', Underwriter: 'Underwriter', Stage: 'Stage', Proposal: 'Proposal' };

const PLAIN = { formatType: 'none' };
const NUM = { formatType: 'numberNoDecimal' };

const colFormat = (ref, formatString) => [
  { name: 'setColumnFormatType', ref, payload: { formatType: 'custom' } },
  { name: 'setColumnFormatString', ref, payload: { formatString } },
];
const right = (...refs) => refs.map((ref) => ({ name: 'setColumnHorizontalAlign', ref, payload: { horizontalAlign: 'right' } }));
const progress = (ref, color) => [
  { name: 'setColumnRepresentation', ref, payload: { representation: 'progress' } },
  { name: 'setColumnMiniChartProgressBarColor', ref, payload: { progressBarColor: color } },
  { name: 'setColumnMiniChartProgressBackgroundColor', ref, payload: { backgroundColor: '#EEE8F3' } },
  { name: 'setColumnMiniChartProgressShowCurrentValue', ref, payload: { showCurrentValue: true } },
  { name: 'setColumnMiniChartProgressValuePlacement', ref, payload: { valuePlacement: 'inside' } },
  { name: 'setColumnProgressDynamicScaleEnabled', ref, payload: { dynamicScaleEnabled: true } },
];

/** Reader-facing names for governed measures and dimensions: legends, tooltips, table headers. */
export const DISPLAY = {
  Applications: 'Applications', 'Avg Monthly Income': 'Income', 'Avg Total Expenses': 'Total expenses', 'Avg Essential Expenses': 'Essential expenses',
  'Avg Housing Cost': 'Housing', 'Avg Groceries': 'Groceries', 'Avg Utilities': 'Utilities & council tax', 'Avg Transport': 'Transport', 'Avg Childcare': 'Childcare',
  'Avg Discretionary Spend': 'Discretionary', 'Avg Existing Debt': 'Existing credit', 'Avg Proposed Repayment': 'New repayment', 'Avg Disposable After Loan': 'Disposable after loan',
  'Debt to Income': 'Debt-to-income', 'Approval Rate': 'Approval rate', 'Open Applications': 'Open', 'Proposal Upheld Rate': 'Proposal upheld', 'Avg Days to Decision': 'Days to decision',
  'Requested Lending': 'Lending requested', 'Application Month': 'Month', 'Application Quarter': 'Quarter', 'Income Band': 'Income band', 'Credit Band': 'Credit band',
};
export const FORMATS = {
  Applications: '#,##0', 'Open Applications': '#,##0', 'Debt to Income': '0.0%', 'Approval Rate': '0.0%', 'Proposal Upheld Rate': '0.0%', 'Avg Days to Decision': '0.0', 'Requested Lending': '£#,##0',
};
const formatOf = (measure) => FORMATS[measure] ?? '£#,##0';

/**
 * The governed selections of one stored business question (questions.js), as tile fields.
 * Refs are the question's own selection keys; the sort is the question's orderBy over the
 * selections the tile keeps; a period comparison is carried as the measure's calculation.
 */
const fromQuestion = (key, keep) => {
  const q = QUESTIONS[key];
  if (!q) throw new Error(`no stored question "${key}"`);
  const picked = keep ? q.measures.filter((m) => keep.includes(m.key)) : q.measures;
  const ordered = keep ? keep.map((k) => picked.find((m) => m.key === k)).filter(Boolean) : picked;
  const refs = new Set([...q.dimensions.map((d) => d.key), ...ordered.map((m) => m.key)]);
  return {
    question: q.id,
    dimensions: q.dimensions.map((d) => ({ name: d.dimension, ref: d.key, governed: true })),
    measures: ordered.map((m) => ({ name: m.measure, ref: m.key, format: NUM, ...(m.comparison ? { calc: { type: m.comparison, offset: m.offset } } : {}) })),
    sort: q.orderBy.filter((o) => refs.has(o.key)).map((o) => ({ by: o.key, direction: o.direction === 'ascending' ? 'asc' : 'desc' })),
  };
};
/** The calculation operations a question's period comparison needs on a table column. */
const calcOps = (measures) => measures.filter((m) => m.calc).flatMap((m) => [
  { name: 'setMeasureAdvancedCalculationType', ref: m.ref, payload: { advancedCalculationType: m.calc.type } },
  { name: 'setMeasureAdvancedOffset', ref: m.ref, payload: { offset: m.calc.offset } },
]);
const labelsOf = (fields) => Object.fromEntries([...fields.dimensions, ...fields.measures].map((f) => [f.ref, DISPLAY[f.name] ?? f.name]));

/** A one-row table showing one measure large (headline question, its one-value dimension hidden). */
const kpi = (id, key, group = MAIN) => {
  const f = fromQuestion('headline', [key]);
  return {
    id: `kpi-${id}`, slot: `kpi-${id}`, title: DISPLAY[f.measures[0].name], type: 'table', group, ...f,
    fitColumns: { [key]: 1 }, headerHidden: true, background: '#00000000', fontSize: 26,
    ops: [
      { name: 'setColumnHidden', ref: 'd_all', payload: { hidden: true } },
      { name: 'setTableFixedRowHeightEnabled', payload: true },
      { name: 'setTableFixedRowHeightValue', payload: 50 },
      ...colFormat(key, formatOf(f.measures[0].name)),
      { name: 'setColumnHorizontalAlign', ref: key, payload: { horizontalAlign: 'left' } },
      { name: 'setColumnFontStyle', ref: key, payload: { fontStyle: { weight: 700 } } },
    ],
  };
};

const bar = (id, title, key, keep, { group = MAIN, colors = [NW.blue], orientation = 'horizontal', legend = false, grouped = false, stacked = false, labels = true, format } = {}) => {
  const f = fromQuestion(key, keep);
  return {
    id, slot: id, title, type: 'bar', group, orientation, ...f, labels: labelsOf(f),
    limit: 30, colors, hideMeasureAxis: labels, legend, legendPosition: legend ? 'top' : undefined, grouped, stacked,
    ...(labels ? { dataLabels: { size: 12, format: format ?? formatOf(f.measures[0].name), backdrop: '#FFFFFF' } } : {}),
  };
};

const table = (id, title, key, { group = MAIN, fit, progressOn, rowHeight = 36, fontSize = 14 } = {}) => {
  const f = fromQuestion(key);
  const [dim] = f.dimensions;
  return {
    id, slot: id, title, type: 'table', group, ...f, limit: 50, fontSize, fitColumns: fit, columnLabels: labelsOf(f),
    ops: [
      { name: 'setTableFixedRowHeightEnabled', payload: true },
      { name: 'setTableFixedRowHeightValue', payload: rowHeight },
      ...f.measures.flatMap((m) => colFormat(m.ref, formatOf(m.name))),
      { name: 'setColumnFontStyle', ref: dim.ref, payload: { fontStyle: { weight: 700 } } },
      ...(progressOn ? progress(progressOn, NW.blue) : []),
      ...right(...f.measures.filter((m) => m.ref !== progressOn).map((m) => m.ref)),
    ],
  };
};

export const EXPENSE_KEYS = ['housing', 'groceries', 'utilities', 'transport', 'childcare', 'discretionary', 'debt'];
export const EXPENSE_COLORS = ['#2E1A47', '#6B3FA0', '#7B3FA8', '#A98BC4', '#D3C4E4', '#E07E3C', '#C8102E'];
export const INC_EXP_COLORS = ['#1D7B53', '#6B3FA0'];

/** Headline cards: [id (= question key), spark type]. Ratios change in points, the rest in %. */
export const HEADLINES = [['apps', 'bar'], ['inc', 'line'], ['exp', 'line'], ['disp', 'line'], ['dti', 'line'], ['appr', 'line']];
export const RATIO_KEYS = ['dti', 'appr'];
export const PERIODS = { mom: { question: 'month', label: 'MoM', unit: 'month' }, qoq: { question: 'quarter', label: 'QoQ', unit: 'quarter' } };

/** A 12-month shape under each headline value (monthly question): no axes, no labels. */
const spark = ([id, kind]) => {
  const f = fromQuestion('monthly', [id]);
  return {
    id: `spark-${id}`, slot: `spark-${id}`, title: `${DISPLAY[f.measures[0].name]} by month`, type: kind === 'bar' ? 'bar' : 'line', group: MAIN, orientation: 'vertical', ...f, labels: labelsOf(f),
    limit: 24, colors: [kind === 'bar' ? '#B9A1D4' : NW.blue], legend: false, lineCurve: 'straight',
    sparkline: true, hideMeasureAxis: true, hideDimensionAxis: true,
    ops: kind === 'bar' ? [] : [{ name: 'setMeasureDataLabelsShow', ref: id, payload: { show: false } }],
  };
};

/** Latest period vs the one before (period question's `<id>_chg`); LIMIT 1 keeps the first row — the window runs before the limit. */
const change = ([id], period) => {
  const f = fromQuestion(PERIODS[period].question, [`${id}_chg`]);
  const chg = `${id}_chg`;
  const good = ['exp', 'dti'].includes(id) ? ['#1D7B53', '#C8102E'] : ['#C8102E', '#1D7B53'];
  return {
    id: `chg-${period}-${id}`, slot: `chg-${period}-${id}`, title: `${DISPLAY[f.measures[0].name]} ${PERIODS[period].label} change`, type: 'table', group: MAIN,
    page: period === 'mom' ? 'main' : 'deferred', ...f,
    fitColumns: { d_period: 0.5, [chg]: 0.5 }, limit: 1, headerHidden: true, background: '#00000000', fontSize: 13,
    ops: [
      { name: 'setTableFixedRowHeightEnabled', payload: true },
      { name: 'setTableFixedRowHeightValue', payload: 24 },
      ...calcOps(f.measures),
      ...colFormat(chg, '+0.0%;-0.0%;0.0%'),
      { name: 'setColumnRepresentation', ref: chg, payload: { representation: 'indicator' } },
      { name: 'addColumnIndicatorSegment', ref: chg, payload: {} },
      { name: 'addColumnIndicatorSegment', ref: chg, payload: {} },
      { name: 'setColumnIndicatorSegmentValue', ref: chg, payload: { segmentIndex: 0, value: 0 } },
      { name: 'setColumnIndicatorSegmentValue', ref: chg, payload: { segmentIndex: 1, value: 1e12 } },
      // Expenses and DTI going up is bad news; everything else going up is good.
      { name: 'setColumnIndicatorSegmentColor', ref: chg, payload: { segmentIndex: 0, color: good[0] } },
      { name: 'setColumnIndicatorSegmentColor', ref: chg, payload: { segmentIndex: 1, color: good[1] } },
      { name: 'setColumnIndicatorShowText', ref: chg, payload: { showText: true } },
      { name: 'setColumnIndicatorColorText', ref: chg, payload: { colorText: true } },
      { name: 'setColumnFontStyle', ref: chg, payload: { fontStyle: { weight: 700 } } },
      { name: 'setColumnFontStyle', ref: 'd_period', payload: { fontStyle: { weight: 400 } } },
    ],
  };
};

const tileCatalogue = () => [
  ...HEADLINES.map(spark),
  ...HEADLINES.flatMap((h) => [change(h, 'mom'), change(h, 'qoq')]),
  ...HEADLINES.map(([id]) => kpi(id, id)),
  {
    id: 'trend', slot: 'trend', title: 'Average income vs expenses', type: 'line', group: MAIN,
    ...(() => { const f = fromQuestion('monthly', ['inc', 'exp', 'ess']); return { ...f, labels: labelsOf(f) }; })(),
    limit: 60, colors: [...INC_EXP_COLORS, '#A98BC4'], legend: true, legendPosition: 'top', lineCurve: 'straight', startsAtZero: true,
    ops: ['inc', 'exp', 'ess'].flatMap((ref) => [
      { name: 'setMeasureDataLabelsShow', ref, payload: { show: false } },
      { name: 'setMeasureFormatType', ref, payload: { formatType: 'custom' } },
      { name: 'setMeasureFormatString', ref, payload: { formatString: '£#,##0' } },
    ]).concat([{ name: 'setMeasureLineStyle', ref: 'ess', payload: { lineStyle: 'dashed' } }]),
  },
  bar('region', 'Average income vs expenses by region', 'region', null, { colors: INC_EXP_COLORS, legend: true, grouped: true }),
  bar('mix', 'Where the money goes, by income band', 'mix', null, { colors: EXPENSE_COLORS, stacked: true, orientation: 'vertical', labels: false }),
  bar('credit', 'Approval rate by credit band', 'credit', null, { orientation: 'vertical', format: '0%' }),
  table('products', 'Affordability by product', 'products', { fit: { d_product: 0.16, apps: 0.12, inc: 0.13, exp: 0.13, rep: 0.13, disp: 0.11, dti: 0.11, appr: 0.11 }, progressOn: 'apps' }),

  // ---- policy group: only applications passing the slider thresholds
  kpi('p-apps', 'apps', POLICY),
  kpi('p-inc', 'inc', POLICY),
  kpi('p-disp', 'disp', POLICY),
  kpi('p-dti', 'dti', POLICY),
  kpi('p-lend', 'lend', POLICY),
  kpi('p-appr', 'appr', POLICY),
  ...RULES.map((r) => kpi(`r-${r.key}`, 'apps', r.group)),
  bar('p-product', 'Applications passing, by product', 'byProduct', null, { group: POLICY, colors: [NW.green] }),
  bar('p-income', 'Applications passing, by income band', 'byIncome', null, { group: POLICY, orientation: 'vertical' }),

  // ---- workflow group
  bar('f-stage', 'Pipeline by stage', 'stage', null, { group: FLOW }),
  table('f-uw', 'Underwriter scorecard', 'underwriters', { group: FLOW, fit: { d_uw: 0.24, apps: 0.13, open: 0.12, appr: 0.15, upheld: 0.17, days: 0.15 }, rowHeight: 34 }),
];

const dropdown = { mode: 'dropdown', quickSelect: false, responsive: false, searchable: false, showProgressBar: false };

const controlCatalogue = () => [
  { id: 'ctl-product', title: 'Product', slot: 'ctl-product', type: 'filter', group: MAIN, field: { view: PV, name: COL.product }, presentation: dropdown },
  { id: 'ctl-region', title: 'Region', slot: 'ctl-region', type: 'filter', group: MAIN, field: { view: PV, name: COL.region }, presentation: dropdown },
  { id: 'ctl-channel', title: 'Channel', slot: 'ctl-channel', type: 'filter', group: MAIN, field: { view: PV, name: COL.channel }, presentation: dropdown },
];

const lookupDimension = (entry, fields) => (entry.governed ? fields.dimension(entry.name) : fields.raw(entry.name, entry.view));
const lookupMeasure = (entry, fields) => (entry.aggregation ? fields.raw(entry.name, entry.view) : fields.measure(entry.name));

const resolve = (tile, fields) => {
  const dimensions = (tile.dimensions ?? []).map((entry) => ({ ...entry, field: lookupDimension(entry, fields) }));
  const measures = (tile.measures ?? []).map((entry) => ({ ...entry, field: lookupMeasure(entry, fields) }));
  const missing = [...dimensions, ...measures].find((entry) => !entry.field);
  if (missing) return { error: `"${missing.name}" is not in this semantic layer` };
  return { dimensions, measures };
};

const dimensionEntries = (dimensions) => dimensions.map((entry) => ({ fieldKey: entry.field.fieldKey, format: PLAIN, ref: entry.ref }));
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
  const data = { dimensions: dimensionEntries(resolved.dimensions), measures: measureEntries(resolved.measures) };
  if (tile.type === 'sankey') return { version: 1, type: 'sankey', data };
  // A scatter takes no sorting or limit; its axes are the two measures.
  if (tile.type === 'scatter') {
    return {
      version: 1,
      type: 'scatter',
      data,
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
  return {
    version: 1,
    type: tile.type,
    data,
    ...withSortAndLimit(tile),
    presentation: {
      ...(tile.type === 'pie'
        ? {}
        : {
            axes: {
              dimension: { labelsVisible: true, titleVisible: false },
              primaryMeasure: { labelsVisible: !tile.hideMeasureAxis, titleVisible: false },
            },
          }),
      // A pie compiles only with a visible legend; theme.js hides it after.
      legend: { visible: tile.type === 'pie' || tile.type === 'line' ? true : Boolean(tile.legend), ...(tile.legend && tile.legendPosition ? { position: tile.legendPosition } : {}) },
      ...(tile.type === 'bar' ? { orientation: tile.orientation ?? 'vertical' } : {}),
    },
  };
};

const columnLabelsOf = (tile, resolved) =>
  Object.fromEntries([...resolved.dimensions, ...resolved.measures].map((entry) => [entry.ref, tile.columnLabels?.[entry.ref] ?? tile.labels?.[entry.ref] ?? entry.field.name]));

const buildControl = (control, fields) => {
  const field = fields.raw(control.field.name, control.field.view);
  if (!field) return { error: `"${control.field.view}.${control.field.name}" is not in this semantic layer` };
  const definition = { version: 1, type: 'filter', data: { field: { fieldKey: field.fieldKey, ref: 'field' } }, presentation: control.presentation };
  return { ...control, page: 'controls', definition, fieldKeys: [field.fieldKey] };
};

export const buildTiles = (fields) => {
  const tiles = [];
  const failures = [];
  for (const tile of tileCatalogue()) {
    const resolved = resolve(tile, fields);
    if (resolved.error) {
      failures.push({ id: tile.id, title: tile.title, reason: resolved.error });
      continue;
    }
    const table = tile.type === 'table';
    tiles.push({
      ...tile,
      page: tile.page ?? 'main',
      definition: definitionOf(tile, resolved),
      dataTable: table
        ? undefined
        : {
            id: `${tile.id}-data`,
            title: tile.title,
            type: 'table',
            definition: { ...tableDefinitionOf({ ...tile, sort: tile.type === 'scatter' ? { by: 'm1', direction: 'desc' } : tile.sort }, resolved), limiting: { queryLimit: 500 } },
            ops: [],
            columnLabels: columnLabelsOf(tile, resolved),
          },
      fieldKeys: resolved.dimensions.flatMap((entry) => fields.keysOf(entry.field)),
    });
  }
  for (const control of controlCatalogue()) {
    const built = buildControl(control, fields);
    if (built.error) failures.push({ id: control.id, title: control.title, reason: built.error });
    else tiles.push(built);
  }
  return { tiles, failures };
};

export const compileDefinition = async (type, definition, availableFields) => {
  const result = await compileVisualizationDefinition({ definition, availableFields, baseVSpec: createDefaultVSpec(type) });
  if (!result.success) {
    throw new Error(result.issues.map((issue) => `${issue.code} @${(issue.path ?? []).join('.')}: ${issue.message}`).join('; '));
  }
  return { vSpec: result.vSpec, resolvedRefs: result.resolvedRefs ?? {} };
};

export const compileTiles = async (tiles, availableFields) => {
  const compiled = [];
  const failures = [];
  for (const tile of tiles) {
    try {
      const entry = { ...tile, ...(await compileDefinition(tile.type, tile.definition, availableFields)) };
      if (tile.dataTable) entry.dataTable = { ...tile.dataTable, ...(await compileDefinition('table', tile.dataTable.definition, availableFields)) };
      compiled.push(entry);
    } catch (error) {
      failures.push({ id: tile.id, title: tile.title, reason: String(error?.message ?? error) });
    }
  }
  return { compiled, failures };
};
