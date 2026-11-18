/** Every native Astrato object of "Larkspur Music Royalty Close & Exception Review", declared once (pure data). Demo data. */
export const C = { navy: '#1B3A5C', teal: '#13706F', green: '#1DB584', mint: '#8FD3C1', amber: '#E0A100', coral: '#D9534F', slate: '#6B7A88', mist: '#D5DEE5', ink: '#1F2A33', plum: '#6C5B9B' };
export const PLAIN = { formatType: 'none' };
const NUM = { formatType: 'numberNoDecimal' };
export const PAGE_NAMES = { ov: 'Close overview', st: 'Statement investigation', cr: 'Controller review', sim: 'Close simulator', bq: 'Business questions' };

const colFormat = (ref, formatString) => [{ name: 'setColumnFormatType', ref, payload: { formatType: 'custom' } }, { name: 'setColumnFormatString', ref, payload: { formatString } }];
const measFormat = (ref, formatString) => [{ name: 'setMeasureFormatType', ref, payload: { formatType: 'custom' } }, { name: 'setMeasureFormatString', ref, payload: { formatString } }];
const right = (...refs) => refs.map((ref) => ({ name: 'setColumnHorizontalAlign', ref, payload: { horizontalAlign: 'right' } }));
const bold = (ref, color) => ({ name: 'setColumnFontStyle', ref, payload: { fontStyle: { weight: 700, ...(color ? { color } : {}) } } });
const rowHeight = (h) => [{ name: 'setTableFixedRowHeightEnabled', payload: true }, { name: 'setTableFixedRowHeightValue', payload: h }];
const bands = (ref, cuts, colors) => [
  { name: 'setColumnRepresentation', ref, payload: { representation: 'indicator' } },
  ...cuts.flatMap((_, i) => [{ name: 'addColumnIndicatorSegment', ref, payload: {} }, { name: 'setColumnIndicatorSegmentValue', ref, payload: { segmentIndex: i, value: cuts[i + 1] ?? 1e15 } }, { name: 'setColumnIndicatorSegmentColor', ref, payload: { segmentIndex: i, color: colors[i] } }]),
  { name: 'setColumnIndicatorColorText', ref, payload: { colorText: true } },
];
const perMeasure = (map) => [{ name: 'setColoringType', payload: 'perEachMeasure' }, ...Object.entries(map).map(([ref, graphColor]) => ({ name: 'setMeasureGraphColor', ref, payload: { graphColor } }))];
const dims = (...cols) => cols.map(([name, ref, view]) => ({ view, name, ref }));
const meas = (...list) => list.map((m, i) => (typeof m === 'string' ? { name: m, ref: `m${i}`, format: NUM } : { name: m[0], ref: m[1] ?? `m${i}`, format: NUM }));

export const BR = 'Branches', ST = 'Statements', SA = 'Statement Amounts', SU = 'Suspense Detail', CE = 'Calc Errors Detail', ID = 'Income Statement Detail', CC = 'Close Cases', CV = 'Close Case History';
const INT = '#,##0', AMT = '#,##0.00', USD = '$#,##0', USDK = '$#,##0.0,"k"', PCT = '0.0%', SPCT = '+0.0%;-0.0%;0.0%', SNUM = '+#,##0;-#,##0;0', PTS = '+0.0" pts";-0.0" pts";0.0" pts"';
const CUR = [{ view: ST, field: 'Run Flag', values: ['Current'] }];
const ctl = (group, view, name, label = name) => ({ id: `ctl-${group}-${view}-${name}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'), page: 'controls', title: label, type: 'filter', group, field: { view, name }, presentation: { mode: 'dropdown', quickSelect: false, responsive: false, searchable: true, showProgressBar: false } });

/** KPI card = number + mini-chart by processing run + one-row comparison table coloured by whether it moved the right way. */
export const KPIS = {};
const kpiCard = (id, page, group, label, { value, fmt, p, pLabel = 'Prior', pFmt = fmt, c, cLabel = 'vs prior', cFmt = SPCT, spark, sparkType = 'line', good = 'down', color = C.teal, note }) => {
  KPIS[id] = { label, note };
  const [lo, hi] = good === 'up' ? [C.coral, C.green] : [C.green, C.coral];
  const sp = { id: `${id}-sp`, slot: `${id}-sp`, page, title: `${label} by run`, group, dimensions: dims(['Processing Run', 'd0', ST]), measures: meas(spark), limit: 12, legend: false, colors: [color] };
  return [
    { id, slot: id, page, title: label, type: 'number', group, measures: meas(value), ops: measFormat('m0', fmt) },
    sparkType === 'line' ? { ...sp, type: 'line', sparkline: true, sort: [{ by: 'd0', direction: 'asc' }], lineCurve: 'curve' }
      : { ...sp, type: 'bar', orientation: 'vertical', sort: { by: 'd0', direction: 'asc' }, barPadding: 20, hideMeasureAxis: true, hideDimensionAxis: true },
    {
      id: `${id}-d`, slot: `${id}-d`, page, title: `${label} vs prior run`, type: 'table', group, fontSize: 11, headerHidden: true, fitColumns: { p: 0.5, c: 0.5 },
      dimensions: [], measures: meas([p, 'p'], [c, 'c']), columnLabels: { p: pLabel, c: cLabel },
      ops: [...rowHeight(24), ...colFormat('p', `"${pLabel} "${pFmt}`), ...colFormat('c', cFmt.split(';').map((f) => (f.endsWith('"') ? `${f.slice(0, -1)} ${cLabel}"` : `${f}" ${cLabel}"`)).join(';')), ...right('c'), ...(good === 'none' ? [] : bands('c', [-1e12, 0], [lo, hi]))],
    },
  ];
};
const spark = (ref, color = C.teal) => ({ ref, view: ST, field: 'Processing Run', color });

export const tileCatalogue = () => [
  // ---------------------------------------------------------------- filters (branch, run, currency on every page)
  ctl('g-ov', BR, 'Branch'), ctl('g-ov', ST, 'Processing Run', 'Processing run'), ctl('g-ov', ST, 'Currency', 'Currency'), ctl('g-ov', ST, 'Exception Category', 'Exception category'), ctl('g-ov', ST, 'Reconciliation Status', 'Source reconciliation'),
  ctl('g-st', BR, 'Branch'), ctl('g-st', ST, 'Processing Run', 'Processing run'), ctl('g-st', ST, 'Currency', 'Currency'), ctl('g-st', ST, 'Statement Id', 'Statement'),
  ctl('g-cr', BR, 'Branch'), ctl('g-cr', ST, 'Processing Run', 'Processing run'), ctl('g-cr', ST, 'Currency', 'Currency'), ctl('g-cr', CC, 'Status', 'Case status'), ctl('g-cr', CC, 'Owner', 'Owner'),
  ctl('g-bq', BR, 'Branch'), ctl('g-bq', ST, 'Processing Run', 'Processing run'), ctl('g-bq', ST, 'Currency', 'Currency'),

  // ---------------------------------------------------------------- 00 Summary (mobile-first; shares the overview's selection group so the header filters apply)
  ...kpiCard('s-k-exc', 'sum', 'g-ov', 'Need attention', { pLabel: 'Prior', cLabel: 'vs prior', value: 'Exception Statements Current Run', fmt: INT, p: 'Exception Statements Prior Run', c: 'Exception Statements Change vs Prior Run', cFmt: SNUM, spark: 'Exception Statements', sparkType: 'bar', color: C.navy }),
  ...kpiCard('s-k-unrec', 'sum', 'g-ov', 'Unreconciled', { pLabel: 'Prior', cLabel: 'vs prior', value: 'Unreconciled Statements Current Run', fmt: INT, p: 'Unreconciled Statements Prior Run', c: 'Unreconciled Statements Change vs Prior Run', cFmt: SNUM, spark: 'Unreconciled Statements', color: C.coral }),
  ...kpiCard('s-k-exp', 'sum', 'g-ov', 'Source exposure', { pLabel: 'Prior', cLabel: 'vs prior', value: 'Source Exposure USD Current Run', fmt: USDK, p: 'Source Exposure USD Prior Run', pFmt: USDK, c: 'Source Exposure USD vs Prior Run', cFmt: '+0%;-0%;0%', spark: 'Source Exposure USD', color: C.teal }),
  ...kpiCard('s-k-sus', 'sum', 'g-ov', 'Suspense', { pLabel: 'Prior', cLabel: 'vs prior', value: 'Suspense USD Current Run', fmt: USDK, p: 'Suspense USD Prior Run', pFmt: USDK, c: 'Suspense USD vs Prior Run', cFmt: '+0%;-0%;0%', spark: 'Suspense USD', color: C.amber }),
  {
    id: 's-top', slot: 's-top', page: 'sum', group: 'g-ov', type: 'table', title: 'Top 5 exposures · current run · tap to investigate', fontSize: 13,
    fitColumns: { s: .42, b: .14, x: .44 },
    dimensions: dims(['Statement Id', 's', ST], ['Branch', 'b', ST]), measures: meas(['Source Exposure USD', 'x']),
    filters: [...CUR, { view: ST, field: 'Exception Flag', values: [1] }], sort: [{ by: 'x', direction: 'desc' }], limit: 5,
    columnLabels: { s: 'Statement', b: 'Br.', x: 'Exposure (USD)' },
    ops: [...rowHeight(40), bold('s', C.navy), ...colFormat('x', USD), ...right('x')],
  },
  { id: 's-br', slot: 's-br', page: 'sum', group: 'g-ov', type: 'bar', orientation: 'horizontal', title: 'Source exposure by branch (USD equiv.)', dimensions: dims(['Branch', 'd0', BR]), measures: meas('Source Exposure USD Current Run'), sort: { by: 'm0', direction: 'desc' }, limit: 8, colors: [C.teal], hideMeasureAxis: true, barPadding: 25, dataLabels: { size: 12, format: USDK, backdrop: '#FFFFFF' }, ops: measFormat('m0', USDK) },

  // ---------------------------------------------------------------- 01 Close overview (current run R-2026-10 vs prior run R-2026-09)
  ...kpiCard('k-exc', 'ov', 'g-ov', 'Statements needing attention', { value: 'Exception Statements Current Run', fmt: INT, p: 'Exception Statements Prior Run', c: 'Exception Statements Change vs Prior Run', cFmt: SNUM, spark: 'Exception Statements', sparkType: 'bar', color: C.navy, note: 'Unreconciled, suspense, calc error or write-off' }),
  ...kpiCard('k-unrec', 'ov', 'g-ov', 'Unreconciled statements', { value: 'Unreconciled Statements Current Run', fmt: INT, p: 'Unreconciled Rate Current Run', pLabel: 'rate', pFmt: PCT, c: 'Unreconciled Rate vs Prior Run', cFmt: PTS, spark: 'Unreconciled Statements', color: C.coral, note: 'Source reconciliation flag = N (read-only)' }),
  ...kpiCard('k-exp', 'ov', 'g-ov', 'Outstanding source exposure', { value: 'Source Exposure USD Current Run', fmt: USD, p: 'Source Exposure USD Prior Run', c: 'Source Exposure USD vs Prior Run', spark: 'Source Exposure USD', color: C.teal, note: 'USD equivalent; carry-forwards stay in exposure' }),
  ...kpiCard('k-sus', 'ov', 'g-ov', 'Suspense', { value: 'Suspense USD Current Run', fmt: USD, p: 'Suspense USD Prior Run', c: 'Suspense USD vs Prior Run', spark: 'Suspense USD', color: C.amber, note: 'USD equivalent' }),
  ...kpiCard('k-ce', 'ov', 'g-ov', 'Calculation errors', { value: 'Statements with Calc Errors Current Run', fmt: INT, p: 'Calc Error Impact USD Current Run', pLabel: 'impact', pFmt: USD, c: 'Statements with Calc Errors Change vs Prior Run', cFmt: SNUM, spark: 'Statements with Calc Errors', sparkType: 'bar', color: C.plum }),
  ...kpiCard('k-wo', 'ov', 'g-ov', 'Write-offs', { value: 'Write-offs USD Current Run', fmt: USD, p: 'Write-offs USD Prior Run', c: 'Write-offs USD vs Prior Run', spark: 'Write-offs USD', color: C.slate }),
  {
    id: 'o-queue', slot: 'o-queue', page: 'ov', group: 'g-ov', type: 'table', title: 'Exception queue · current run · click a statement to investigate (local currency)', fontSize: 12,
    fitColumns: { s: .14, b: .05, p: .17, cu: .05, e: .13, r: .09, x: .1, d: .09, su: .09, ce: .09 },
    dimensions: dims(['Statement Id', 's', ST], ['Branch', 'b', ST], ['Payee Name', 'p', ST], ['Currency', 'cu', ST], ['Exception Category', 'e', ST], ['Reconciliation Status', 'r', ST]),
    measures: meas(['Source Exposure', 'x'], ['Reconciliation Difference', 'd'], ['Suspense Amount', 'su'], ['Calc Error Impact', 'ce']),
    filters: [...CUR, { view: ST, field: 'Exception Flag', values: [1] }], sort: [{ by: 'x', direction: 'desc' }], limit: 400,
    columnLabels: { s: 'Statement', b: 'Br.', p: 'Payee', cu: 'Ccy', e: 'Exception', r: 'Source recon flag', x: 'Exposure', d: 'Recon diff', su: 'Suspense', ce: 'Calc impact' },
    ops: [...rowHeight(32), bold('s', C.navy), ...['x', 'd', 'su', 'ce'].flatMap((r) => colFormat(r, AMT)), ...right('x', 'd', 'su', 'ce')],
  },
  {
    id: 'o-branch', slot: 'o-branch', page: 'ov', group: 'g-ov', type: 'table', title: 'Branch close scorecard · current run with trend across runs', fontSize: 12,
    fitColumns: { b: .08, c: .06, n: .09, u: .09, ur: .09, sp: .17, x: .13, e: .12, oc: .08, od: .09 },
    dimensions: dims(['Branch', 'b', BR], ['Currency', 'c', BR]),
    measures: meas(['Statements Current Run', 'n'], ['Unreconciled Statements Current Run', 'u'], ['Unreconciled Rate Current Run', 'ur'], ['Unreconciled Statements', 'sp'], ['Source Exposure USD Current Run', 'x'], ['Exposure Rate', 'e'], ['Open Cases', 'oc'], ['Overdue Cases', 'od']),
    miniChart: spark('sp', C.coral), sort: [{ by: 'x', direction: 'desc' }], limit: 20,
    columnLabels: { b: 'Branch', c: 'Ccy', n: 'Statements', u: 'Unreconciled', ur: 'Unrec. rate', sp: 'Unreconciled · by run', x: 'Exposure (USD)', e: 'Exposure ÷ earnings', oc: 'Open cases', od: 'Overdue' },
    ops: [...rowHeight(32), bold('b', C.navy), ...colFormat('n', INT), ...colFormat('u', INT), ...colFormat('ur', PCT), ...colFormat('x', USD), ...colFormat('e', PCT), ...colFormat('oc', INT), ...colFormat('od', INT), ...right('n', 'u', 'ur', 'x', 'e', 'oc', 'od'),
      ...bands('ur', [-1, 0.1, 0.2], [C.green, C.amber, C.coral]), ...bands('od', [-1, 1], [C.green, C.coral])],
  },
  { id: 'o-trend', slot: 'o-trend', page: 'ov', group: 'g-ov', type: 'combo', title: 'Exceptions by processing run (bars) vs source exposure USD (line)', dimensions: dims(['Processing Run', 'd0', ST]), measures: meas('Unreconciled Statements', 'Statements with Suspense', 'Statements with Calc Errors', 'Source Exposure USD'), sort: [{ by: 'd0', direction: 'asc' }], limit: 12, graphTypes: { m0: 'bar', m1: 'bar', m2: 'bar', m3: 'line' }, legend: true, legendPosition: 'top', ops: [{ name: 'changeMeasureAxis', ref: 'm3', payload: { secondaryAxis: true } }, ...measFormat('m3', USDK), ...perMeasure({ m0: C.coral, m1: C.amber, m2: C.plum, m3: C.navy })] },
  { id: 'o-cat', slot: 'o-cat', page: 'ov', group: 'g-ov', type: 'bar', orientation: 'horizontal', title: 'Exception statements by branch and category · current run', dimensions: dims(['Branch', 'd0', BR], ['Exception Category', 'd1', ST]), measures: meas('Exception Statements'), filters: [...CUR, { view: ST, field: 'Exception Flag', values: [1] }], sort: { by: 'm0', direction: 'desc' }, limit: 80, stacked: true, legend: true, legendPosition: 'top', colors: [C.plum, C.coral, C.amber, '#F2C14E', C.slate], barPadding: 25, ops: measFormat('m0', INT) },
  { id: 'o-sus', slot: 'o-sus', page: 'ov', group: 'g-ov', type: 'bar', orientation: 'horizontal', title: 'Suspense items by reason · current run', dimensions: dims(['Suspense Reason', 'd0', SU]), measures: meas('Suspense Items'), filters: CUR, sort: { by: 'm0', direction: 'desc' }, limit: 10, colors: [C.amber], hideMeasureAxis: true, barPadding: 25, dataLabels: { size: 11, format: INT, backdrop: '#FFFFFF' }, ops: measFormat('m0', INT) },
  { id: 'o-ce', slot: 'o-ce', page: 'ov', group: 'g-ov', type: 'pie', donut: true, legend: true, sliceLabels: 'value', coloring: 'categorical', title: 'Calculation errors by type · current run', dimensions: dims(['Error Type', 'd0', CE]), measures: meas('Calc Errors'), filters: CUR, sort: { by: 'm0', direction: 'desc' }, limit: 10, colors: [C.plum, C.coral, C.amber, C.teal, C.slate] },

  // ---------------------------------------------------------------- 02 Statement investigation (one statement selected in g-st)
  { id: 's-gross', slot: 's-gross', page: 'st', group: 'g-st', type: 'number', title: 'Gross earnings', measures: meas('Gross Earnings'), ops: measFormat('m0', AMT) },
  { id: 's-diff', slot: 's-diff', page: 'st', group: 'g-st', type: 'number', title: 'Reconciliation difference', measures: meas('Reconciliation Difference'), ops: measFormat('m0', AMT) },
  { id: 's-sus', slot: 's-sus', page: 'st', group: 'g-st', type: 'number', title: 'Suspense', measures: meas('Suspense Amount'), ops: measFormat('m0', AMT) },
  { id: 's-ce', slot: 's-ce', page: 'st', group: 'g-st', type: 'number', title: 'Calc error impact', measures: meas('Calc Error Impact'), ops: measFormat('m0', AMT) },
  { id: 's-exp', slot: 's-exp', page: 'st', group: 'g-st', type: 'number', title: 'Source exposure', measures: meas('Source Exposure'), ops: measFormat('m0', AMT) },
  {
    id: 's-amts', slot: 's-amts', page: 'st', group: 'g-st', type: 'table', title: 'Statement amounts · royalty_engine_statementamount_view (grain: StatementId × Amount Type, read-only)', fontSize: 12,
    fitColumns: { o: .07, t: .43, c: .1, a: .22, u: .18 },
    dimensions: dims(['Amount Order', 'o', SA], ['Amount Type', 't', SA], ['Currency', 'c', SA]), measures: meas(['Statement Amount', 'a'], ['Statement Amount USD', 'u']),
    sort: [{ by: 'o', direction: 'asc' }], limit: 20,
    columnLabels: { o: '#', t: 'Amount type', c: 'Ccy', a: 'Amount (local)', u: 'USD equiv.' },
    ops: [...rowHeight(30), bold('t', C.navy), ...colFormat('a', AMT), ...colFormat('u', USD), ...right('a', 'u')],
  },
  {
    id: 's-susd', slot: 's-susd', page: 'st', group: 'g-st', type: 'table', title: 'Suspense detail (joined on StatementId)', fontSize: 12,
    fitColumns: { r: .26, s: .24, i: .16, c: .08, a: .14, g: .12 },
    dimensions: dims(['Suspense Reason', 'r', SU], ['Song', 's', SU], ['Income Source', 'i', SU], ['Currency', 'c', SU]), measures: meas(['Suspense Detail Amount', 'a'], ['Average Suspense Age', 'g']),
    sort: [{ by: 'a', direction: 'desc' }], limit: 50, columnLabels: { r: 'Reason', s: 'Song', i: 'Source', c: 'Ccy', a: 'Amount', g: 'Age' },
    ops: [...rowHeight(30), ...colFormat('a', AMT), ...colFormat('g', '0" d"'), ...right('a', 'g')],
  },
  {
    id: 's-ced', slot: 's-ced', page: 'st', group: 'g-st', type: 'table', title: 'Calculation errors detail (joined on StatementId)', fontSize: 12,
    fitColumns: { k: .1, t: .4, s: .26, a: .24 },
    dimensions: dims(['Error Code', 'k', CE], ['Error Type', 't', CE], ['Song', 's', CE]), measures: meas(['Calc Error Detail Impact', 'a']),
    sort: [{ by: 'a', direction: 'desc' }], limit: 50, columnLabels: { k: 'Code', t: 'Error', s: 'Song', a: 'Impact' },
    ops: [...rowHeight(30), bold('k', C.plum), ...colFormat('a', AMT), ...right('a')],
  },
  {
    id: 's-inc', slot: 's-inc', page: 'st', group: 'g-st', type: 'table', title: 'Income statement detail (joined on StatementId)', fontSize: 12,
    fitColumns: { i: .2, t: .16, s: .28, a: .18, n: .18 },
    dimensions: dims(['Income Source', 'i', ID], ['Income Type', 't', ID], ['Song', 's', ID]), measures: meas(['Income Amount', 'a'], ['Income Amount USD', 'n']),
    sort: [{ by: 'a', direction: 'desc' }], limit: 50, columnLabels: { i: 'Income source', t: 'Type', s: 'Song', a: 'Amount (local)', n: 'USD equiv.' },
    ops: [...rowHeight(30), ...colFormat('a', AMT), ...colFormat('n', USD), ...right('a', 'n')],
  },
  {
    id: 's-hist', slot: 's-hist', page: 'st', group: 'g-st', type: 'table', title: 'Case history for this statement (ROYALTY_CLOSE_EVENTS)', fontSize: 12,
    fitColumns: { d: .14, c: .14, a: .32, w: .2, n: .2 },
    dimensions: dims(['Event Date', 'd', CV], ['Case Id', 'c', CV], ['Action', 'a', CV], ['Actor', 'w', CV]), measures: meas(['Case Actions', 'n']),
    sort: [{ by: 'd', direction: 'desc' }], limit: 50, columnLabels: { d: 'Date', c: 'Case', a: 'Action', w: 'Actor', n: 'Actions' },
    ops: [...rowHeight(28), ...colFormat('n', INT), ...right('n')],
  },

  // ---------------------------------------------------------------- 03 Controller review
  ...kpiCard('k-rev', 'cr', 'g-cr', 'Awaiting controller review', { value: 'Cases Awaiting Review', fmt: INT, p: 'Open Cases', pLabel: 'open', pFmt: INT, c: 'Overdue Cases', cLabel: 'overdue', cFmt: INT, spark: 'Exception Statements', sparkType: 'bar', good: 'none', color: C.navy }),
  ...kpiCard('k-app', 'cr', 'g-cr', 'Approved dispositions', { value: 'Approved Dispositions', fmt: INT, p: 'Case Approval Rate', pLabel: 'closed', pFmt: PCT, c: 'Cases Returned', cLabel: 'returned', cFmt: INT, spark: 'Statements', sparkType: 'bar', good: 'none', color: C.green }),
  ...kpiCard('k-cf', 'cr', 'g-cr', 'Approved carry-forwards', { value: 'Approved Carry-forwards', fmt: INT, p: 'Source Exposure USD Current Run', pLabel: 'run exposure', pFmt: USD, c: 'Source Exposure USD vs Prior Run', spark: 'Source Exposure USD', color: C.amber, note: 'Still counted in outstanding source exposure' }),
  {
    id: 'c-cases', slot: 'c-cases', page: 'cr', group: 'g-cr', type: 'table', title: 'Case register · who owns each exception (observed amount vs live source exposure, local currency)', fontSize: 12,
    fitColumns: { i: .09, s: .13, b: .05, t: .13, o: .1, st: .13, du: .09, cu: .05, a: .09, x: .09, od: .05 },
    dimensions: dims(['Case Id', 'i', CC], ['Statement Id', 's', CC], ['Branch', 'b', ST], ['Exception Type', 't', CC], ['Owner', 'o', CC], ['Status', 'st', CC], ['Due Date', 'du', CC], ['Currency', 'cu', ST]),
    measures: meas(['Observed Case Amount', 'a'], ['Source Exposure', 'x'], ['Overdue Cases', 'od']), sort: [{ by: 'du', direction: 'asc' }], limit: 300,
    columnLabels: { i: 'Case', s: 'Statement', b: 'Br.', t: 'Exception', o: 'Owner', st: 'Status', du: 'Due', cu: 'Ccy', a: 'Observed', x: 'Source exposure', od: 'Overdue' },
    ops: [...rowHeight(30), bold('i', C.navy), ...colFormat('a', AMT), ...colFormat('x', AMT), ...colFormat('od', INT), ...right('a', 'x', 'od'), ...bands('od', [-1, 1], [C.green, C.coral])],
  },
  {
    id: 'c-cf', slot: 'c-cf', page: 'cr', group: 'g-cr', type: 'table', title: 'Approved carry-forwards · exposure still outstanding at source', fontSize: 12,
    fitColumns: { i: .14, s: .2, b: .08, cu: .08, a: .25, x: .25 },
    dimensions: dims(['Case Id', 'i', CC], ['Statement Id', 's', CC], ['Branch', 'b', ST], ['Currency', 'cu', ST]), measures: meas(['Carry-forward Exposure', 'a'], ['Source Exposure', 'x']),
    filters: [{ view: CC, field: 'Status', values: ['Carry-forward approved'] }], sort: [{ by: 'x', direction: 'desc' }], limit: 100,
    columnLabels: { i: 'Case', s: 'Statement', b: 'Br.', cu: 'Ccy', a: 'Carried forward', x: 'Outstanding source exposure' },
    ops: [...rowHeight(30), bold('i', C.amber), ...colFormat('a', AMT), ...colFormat('x', AMT), ...right('a', 'x')],
  },
  { id: 'c-status', slot: 'c-status', page: 'cr', group: 'g-cr', type: 'bar', orientation: 'horizontal', title: 'Cases by branch and status', dimensions: dims(['Branch', 'd0', ST], ['Status', 'd1', CC]), measures: meas('Cases'), sort: { by: 'm0', direction: 'desc' }, limit: 80, stacked: true, legend: true, legendPosition: 'top', colors: [C.green, C.slate, C.amber, C.navy, C.coral, C.teal], barPadding: 25, ops: measFormat('m0', INT) },
  {
    id: 'c-audit', slot: 'c-audit', page: 'cr', group: 'g-cr', type: 'table', title: 'Action history · every case action (actor, timestamp, observed amount)', fontSize: 12,
    fitColumns: { d: .12, c: .11, s: .15, a: .3, w: .16, n: .16 },
    dimensions: dims(['Event Date', 'd', CV], ['Case Id', 'c', CV], ['Statement Id', 's', CV], ['Action', 'a', CV], ['Actor', 'w', CV]), measures: meas(['Case Actions', 'n']),
    sort: [{ by: 'd', direction: 'desc' }], limit: 300, columnLabels: { d: 'Date', c: 'Case', s: 'Statement', a: 'Action', w: 'Actor', n: 'Actions' },
    ops: [...rowHeight(28), ...colFormat('n', INT), ...right('n')],
  },
];

const lowerFirst = (s) => s.charAt(0).toLowerCase() + s.slice(1);
export const questionOf = (tile) => {
  const base = tile.id.replace(/-(sp|d)$/, '');
  const label = KPIS[base]?.label;
  if (label && tile.id.endsWith('-sp')) return `Larkspur Music close: how has ${lowerFirst(label)} trended by processing run?`;
  if (label && tile.id.endsWith('-d')) return `Larkspur Music close: how does ${lowerFirst(label)} compare with the prior run?`;
  if (label) return `Larkspur Music close: what is ${lowerFirst(label)}?`;
  return `Larkspur Music close: ${lowerFirst(tile.title.split(' · ')[0])}?`;
};
