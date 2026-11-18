import { C } from './catalogue.js';

/** Stored business questions of the Larkspur Music layer (shared by tools/layer.mjs and the app's Business questions tab). Demo data. */
const Q = (cat, name, chart, dims, measures, description, extra = {}) => ({ cat, name, chart, dims, measures, description, ...extra });
export const QUESTIONS = [
  Q('Close overview', 'Which statements need attention before close?', 'table', ['Statement', 'Branch', 'Payee', 'Statement Currency', 'Exception Category', 'Reconciliation Status'], ['Source Exposure', 'Reconciliation Difference', 'Suspense Amount', 'Calc Error Impact', 'Write-offs'], 'Current-run exception queue in local currency with the source reconciliation flag.', { filters: [['Run Flag', 'equals', ['Current']]], order: [['Source Exposure', 'desc']] }),
  Q('Close overview', 'How many statements are unreconciled by branch this run?', 'bar', ['Branch'], ['Unreconciled Statements Current Run', 'Unreconciled Statements Prior Run', 'Unreconciled Rate Current Run'], 'Unreconciled statements by branch, current vs prior run.'),
  Q('Close overview', 'Where is the source exposure by branch and currency?', 'table', ['Branch', 'Statement Currency'], ['Source Exposure', 'Source Exposure USD', 'Suspense Amount', 'Calc Error Impact', 'Write-offs'], 'Outstanding source exposure in local currency and USD equivalent.', { filters: [['Run Flag', 'equals', ['Current']]] }),
  Q('Close overview', 'How has exception volume trended across processing runs?', 'line', ['Processing Run'], ['Exception Statements', 'Unreconciled Statements', 'Statements with Suspense', 'Statements with Calc Errors'], 'Exceptions per monthly processing run.'),
  Q('Close overview', 'What is held in suspense and why?', 'bar', ['Suspense Reason'], ['Suspense Detail Amount', 'Suspense Items', 'Average Suspense Age'], 'Suspense detail by reason (local currency; filter one currency).'),
  Q('Close overview', 'Which calculation errors are blocking close?', 'table', ['Calc Error Code', 'Calc Error Type', 'Branch'], ['Calc Errors', 'Calc Error Detail Impact'], 'Calculation errors by code and branch.'),
  Q('Statement investigation', 'Does the statement-amount grain hold (one row per statement and amount type)?', 'table', ['Branch'], ['Statements', 'Statement Amount Rows', 'Amount Rows per Statement'], 'Grain validation before aggregating statement amounts: expect 7.00.'),
  Q('Statement investigation', 'What are the statement amounts by type?', 'table', ['Amount Order', 'Amount Type', 'Statement Currency'], ['Statement Amount'], 'Statement amount waterfall lines in local currency.'),
  Q('Statement investigation', 'Which income sources make up the statement?', 'table', ['Income Source', 'Income Type', 'Income Song'], ['Income Amount', 'Income Lines'], 'Income statement detail for drill-down.'),
  Q('Controller review', 'Who owns each exception and what is overdue?', 'table', ['Case', 'Statement', 'Exception Type', 'Case Owner', 'Case Status', 'Case Due Date'], ['Observed Case Amount', 'Overdue Cases'], 'Case ownership, due dates and overdue flag.'),
  Q('Controller review', 'What is waiting for controller review?', 'bar', ['Branch', 'Case Status'], ['Cases'], 'Cases by branch and status.'),
  Q('Controller review', 'Which carry-forwards are approved but still exposed at source?', 'table', ['Case', 'Statement', 'Branch', 'Statement Currency', 'Disposition'], ['Carry-forward Exposure', 'Source Exposure'], 'Approved carry-forwards with the outstanding source exposure.', { filters: [['Case Status', 'equals', ['Carry-forward approved']]] }),
  Q('Controller review', 'Who did what on the close cases?', 'table', ['Case Event Date', 'Case', 'Case Action', 'Case Actor'], ['Case Actions'], 'Case action history (audit trail).', { order: [['Case Event Date', 'desc']] }),
  Q('Paid vs collectable', 'Which songs look underpaid, ranked by estimated gap within currency?', 'table', ['PvC Currency', 'Source Line', 'Song', 'Branch', 'Payer', 'PvC Period'], ['Estimated Gap', 'Adjusted Local Net Income', 'Expected Collectable Income'], 'Opportunity queue: apparent underpayments ranked within currency.', { order: [['Estimated Gap', 'desc']] }),
  Q('Paid vs collectable', 'Which payers underpay most?', 'bar', ['Payer'], ['Estimated Gap USD', 'Underpaid Lines'], 'Apparent underpayment by payer (USD equivalent).'),
  Q('Paid vs collectable', 'How is apparent underpayment trending by quarter?', 'line', ['PvC Period'], ['Estimated Gap USD', 'Underpaid Lines', 'Data Quality Lines'], 'Quarterly trend of apparent underpayment.'),
  Q('Paid vs collectable', 'Which lines are missing a received or collectable percentage?', 'table', ['Source Line', 'Song', 'Branch', 'Payer', 'Data Quality Status'], ['Adjusted Local Net Income'], 'Data-quality queue: do not estimate a gap until fixed.', { filters: [['Data Quality Status', 'inList', ['Missing collectable %', 'Missing received %']]] }),
  Q('Recovery tracking', 'What is the estimated gap vs confirmed claim vs verified recovery?', 'table', ['Claim', 'Claim Payer', 'Claim Currency', 'Claim Status'], ['Estimate at Discovery', 'Confirmed Claim Amount', 'Verified Recovery', 'Outstanding Confirmed Balance'], 'Three distinct measures per claim, plus the outstanding balance.'),
  Q('Recovery tracking', 'How many claims are at each stage?', 'bar', ['Claim Status'], ['Claims'], 'Claim pipeline by status.'),
  Q('Recovery tracking', 'Who did what on the recovery claims?', 'table', ['Claim Event Date', 'Claim', 'Claim Action', 'Claim Actor'], ['Claim Actions'], 'Claim audit history.', { order: [['Claim Event Date', 'desc']] }),
  Q('Cross-source', 'Which branches carry both close exposure and recovery opportunity?', 'table', ['Branch', 'Branch Currency'], ['Source Exposure USD Current Run', 'Estimated Gap USD', 'Unreconciled Statements Current Run', 'Underpaid Lines'], 'Close exposure (Royalty Engine statements) next to paid-vs-collectable gap (income summary) by branch.'),
];


/** Governed dimension → [view, field], so a question can be rendered as a native table. */
export const DIM_FIELDS = {
  'Branch': ['Branches', 'Branch'],
  'Branch Name': ['Branches', 'Branch Name'],
  'Region': ['Branches', 'Region'],
  'Branch Currency': ['Branches', 'Currency'],
  'Branch Controller': ['Branches', 'Branch Controller'],
  'Statement': ['Statements', 'Statement Id'],
  'Processing Run': ['Statements', 'Processing Run'],
  'Accounting Period': ['Statements', 'Accounting Period'],
  'Run Flag': ['Statements', 'Run Flag'],
  'Statement Currency': ['Statements', 'Currency'],
  'Payee': ['Statements', 'Payee Name'],
  'Payee Type': ['Statements', 'Payee Type'],
  'Reconciliation Status': ['Statements', 'Reconciliation Status'],
  'Source Reconciled Flag': ['Statements', 'Is Reconciled'],
  'Exception Category': ['Statements', 'Exception Category'],
  'Close Due Date': ['Statements', 'Close Due Date'],
  'Amount Type': ['Statement Amounts', 'Amount Type'],
  'Amount Order': ['Statement Amounts', 'Amount Order'],
  'Suspense Reason': ['Suspense Detail', 'Suspense Reason'],
  'Suspense Song': ['Suspense Detail', 'Song'],
  'Suspense Income Source': ['Suspense Detail', 'Income Source'],
  'Calc Error Code': ['Calc Errors Detail', 'Error Code'],
  'Calc Error Type': ['Calc Errors Detail', 'Error Type'],
  'Income Source': ['Income Statement Detail', 'Income Source'],
  'Income Type': ['Income Statement Detail', 'Income Type'],
  'Income Song': ['Income Statement Detail', 'Song'],
  'Case': ['Close Cases', 'Case Id'],
  'Case Status': ['Close Cases', 'Status'],
  'Exception Type': ['Close Cases', 'Exception Type'],
  'Case Owner': ['Close Cases', 'Owner'],
  'Case Due Date': ['Close Cases', 'Due Date'],
  'Disposition': ['Close Cases', 'Disposition'],
  'Carry Forward': ['Close Cases', 'Carry Forward'],
  'Case Action': ['Close Case History', 'Action'],
  'Case Actor': ['Close Case History', 'Actor'],
  'Case Event Date': ['Close Case History', 'Event Date'],
  'User': ['App Users', 'User Name'],
  'User Role': ['App Users', 'Role'],
  'Song': ['Songs', 'Song'],
  'Writer': ['Songs', 'Writer'],
  'Genre': ['Songs', 'Genre'],
  'PvC Period': ['Paid vs Collectable Lines', 'Accounting Period'],
  'PvC Period Flag': ['Paid vs Collectable Lines', 'Period Flag'],
  'Payer': ['Paid vs Collectable Lines', 'Payer'],
  'PvC Income Source': ['Paid vs Collectable Lines', 'Income Source'],
  'PvC Income Type': ['Paid vs Collectable Lines', 'Income Type'],
  'PvC Currency': ['Paid vs Collectable Lines', 'Currency'],
  'Source Line': ['Paid vs Collectable Lines', 'Source Line Id'],
  'Data Quality Status': ['Paid vs Collectable Lines', 'Dq Status'],
  'Normalization Rule': ['Paid vs Collectable Lines', 'Normalization Rule'],
  'Claim': ['Recovery Claims', 'Claim Id'],
  'Claim Status': ['Recovery Claims', 'Status'],
  'Claim Owner': ['Recovery Claims', 'Owner'],
  'Claim Payer': ['Recovery Claims', 'Payer'],
  'Claim Currency': ['Recovery Claims', 'Currency'],
  'Recovery': ['Recoveries', 'Recovery Id'],
  'Recovery Reference Type': ['Recoveries', 'Ref Type'],
  'Supporting Reference': ['Recoveries', 'Supporting Ref'],
  'Recovery Verified': ['Recoveries', 'Verified'],
  'Claim Action': ['Claim History', 'Action'],
  'Claim Actor': ['Claim History', 'Actor'],
  'Claim Event Date': ['Claim History', 'Event Date'],
  'Receipt': ['Receipts', 'Receipt Ref'],
};

/** A stored question as the native table the Business questions tab mounts (moved here from app.js so the compile check builds the same tile). */
export const bqTileOf = (bq) => {
  const ST = 'Statements', BR = 'Branches';
  const dimsT = bq.dims.map((d, k) => ({ view: DIM_FIELDS[d][0], name: DIM_FIELDS[d][1], ref: `d${k}` }));
  // A question filtered to one run has a single point per row: no 'by run' sparkline for it.
  const oneRun = (bq.filters ?? []).some(([dn]) => dn === 'Run Flag');
  const hasRun = !oneRun && dimsT.some((d) => d.view === ST || d.view === BR) && !dimsT.some((d) => d.name === 'Processing Run');
  const measT = [...bq.measures.map((m, k) => ({ name: m, ref: `m${k}`, format: { formatType: 'numberNoDecimal' } })), ...(hasRun ? [{ name: bq.measures[0], ref: 'sp', format: { formatType: 'numberNoDecimal' } }] : [])];
  const filt = (bq.filters ?? []).map(([dn, , values]) => ({ view: DIM_FIELDS[dn][0], field: DIM_FIELDS[dn][1], values }));
  return { id: 'bq-run', slot: 'bq-run', page: 'bq', group: 'g-bq', type: 'table', title: bq.name, fontSize: 12, dimensions: dimsT, measures: measT, filters: filt, limit: 300,
    sort: bq.order ? bq.order.map(([k, dir]) => ({ by: bq.dims.includes(k) ? `d${bq.dims.indexOf(k)}` : `m${bq.measures.indexOf(k)}`, direction: dir })) : undefined,
    columnLabels: { ...Object.fromEntries(bq.dims.map((d, k) => [`d${k}`, d])), ...Object.fromEntries(bq.measures.map((m, k) => [`m${k}`, m])), sp: `${bq.measures[0]} · by run` },
    // Column widths as shares of the slot: identifiers get more room than numbers so IDs are not cut off.
    fitColumns: (() => { const w = [...dimsT.map((d) => (/ Id$|Name$/.test(d.name) ? 1.6 : 0.9)), ...measT.map(() => 1)]; const t = w.reduce((a, b) => a + b, 0); return Object.fromEntries([...dimsT, ...measT].map((c, i) => [c.ref, w[i] / t])); })(),
    ...(hasRun ? { miniChart: { ref: 'sp', view: ST, field: 'Processing Run', color: C.teal } } : {}), ops: [{ name: 'setTableFixedRowHeightEnabled', payload: true }, { name: 'setTableFixedRowHeightValue', payload: 30 }] };
};
