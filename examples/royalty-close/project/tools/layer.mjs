/**
 * "Larkspur Music – Royalty Engine (demo)" semantic layer over ASTRATO_GALLERY.MOCK_DATA.ROYALTY_* (clearly labelled demo data).
 * Shared by larkspur-close/ (Royalty Close & Exception Review) and larkspur-recovery/ (Paid vs Collectable Recovery).
 *
 *   node tools/layer.mjs create
 *   node tools/layer.mjs views | model | questions | actions | validate | publish <rev>
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const CLIENT = fileURLToPath(new URL('./mcp.mjs', import.meta.url));
export const call = (tool, args) => {
  const file = join(tmpdir(), `royalty-${process.pid}-${tool}.json`);
  writeFileSync(file, JSON.stringify(args));
  const out = execFileSync(process.execPath, [CLIENT, tool, `@${file}`], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const parsed = JSON.parse(out);
  if (!parsed.ok) throw new Error(`${tool}: ${out.slice(0, 3000)}`);
  return parsed.data;
};
export const title = (c) => c.split('_').map((w) => w[0] + w.slice(1).toLowerCase()).join(' ');
const TYPES = Object.fromEntries(readFileSync(new URL('./types.txt', import.meta.url), 'utf8').trim().split(/\s+/).map((p) => p.split('=')));
const CFG = new URL('../astrato.json', import.meta.url);
const LAYER = existsSync(CFG) ? JSON.parse(readFileSync(CFG, 'utf8')).semanticLayerId : null;
const T = 'ASTRATO_GALLERY.MOCK_DATA.';

// ------------------------------------------------------------------ views and joins (a tree: no cycles)
export const BR = 'Branches', ST = 'Statements', SA = 'Statement Amounts', SU = 'Suspense Detail', CE = 'Calc Errors Detail', ID = 'Income Statement Detail',
  CC = 'Close Cases', CV = 'Close Case History', US = 'App Users', SO = 'Songs', PV = 'Paid vs Collectable Lines', SC = 'Song Branch Collectable',
  CL = 'Recovery Claims', RC = 'Recoveries', CH = 'Claim History', RE = 'Receipts';
const VIEWS = {
  [BR]: ['ROYALTY_BRANCHES', []], [ST]: ['ROYALTY_STATEMENTS', [[BR, 'Branch']]],
  [SA]: ['ROYALTY_STATEMENT_AMOUNTS', [[ST, 'Statement Id']]], [SU]: ['ROYALTY_SUSPENSE_DETAIL', [[ST, 'Statement Id']]],
  [CE]: ['ROYALTY_CALC_ERRORS', [[ST, 'Statement Id']]], [ID]: ['ROYALTY_INCOME_DETAIL', [[ST, 'Statement Id']]],
  [CC]: ['ROYALTY_CLOSE_CASES', [[ST, 'Statement Id']]], [CV]: ['ROYALTY_CLOSE_EVENTS', [[CC, 'Case Id']]],
  [US]: ['ROYALTY_USERS', []], [SO]: ['ROYALTY_SONGS', []],
  [PV]: ['ROYALTY_PVC_LINES', [[BR, 'Branch'], [SO, 'Song Id']]], [SC]: ['ROYALTY_SONG_BRANCH_COLLECTABLE', [[SO, 'Song Id']]],
  [CL]: ['ROYALTY_CLAIMS', [[BR, 'Branch']]], [RC]: ['ROYALTY_RECOVERIES', [[CL, 'Claim Id']]], [CH]: ['ROYALTY_CLAIM_EVENTS', [[CL, 'Claim Id']]],
  [RE]: ['ROYALTY_RECEIPTS', [[BR, 'Branch']]],
};

const agg = (id, view, field, aggregation, conds) => ({ id, kind: 'aggregate', field: { view, field }, aggregation, ...(conds ? { filter: { conditions: conds.map(([f, op, v], i) => ({ id: `c${i}`, field: { view, field: f }, operator: op, value: v })) } } : {}) });
const ms = (name, description, inputs, pattern, expression) => ({ entity: 'measure', name, definition: { description: `${description} Demo data.`, inputs, ...(expression ? { expression } : {}), format: { mode: 'custom', pattern } } });
const fd = (name, view, field, description) => ({ entity: 'dimension', name, definition: { kind: 'field', field: { view, field }, description } });
const sum = (id, v, f, c) => agg(id, v, f, 'SUM', c);
const INT = '#,##0', AMT = '#,##0.00', AMT0 = '#,##0', USD = '$#,##0', USDK = '$#,##0.0,"k"', PCT = '0.0%', SPCT = '+0.0%;-0.0%;0.0%', SNUM = '+#,##0;-#,##0;0', PTS = '+0.0" pts";-0.0" pts";0.0" pts"';
const CUR = [['Run Flag', 'equals', 'Current']], PRI = [['Run Flag', 'equals', 'Prior']];
const LAT = [['Period Flag', 'equals', 'Latest']], PRV = [['Period Flag', 'equals', 'Prior']];
const st = (id, f, c) => sum(id, ST, f, c);
const fam = (name, desc, field, fmt, cfmt = SPCT) => [
  ms(name, desc, [st('x', field)], fmt),
  ms(`${name} Current Run`, `${desc} Current processing run (R-2026-10).`, [st('x', field, CUR)], fmt),
  ms(`${name} Prior Run`, `${desc} Prior processing run (R-2026-09).`, [st('x', field, PRI)], fmt),
  cfmt === SPCT ? ms(`${name} vs Prior Run`, `${name}: current run vs prior run.`, [st('a', field, CUR), st('b', field, PRI)], SPCT, 'a / b - 1')
    : ms(`${name} Change vs Prior Run`, `${name}: current run minus prior run.`, [st('a', field, CUR), st('b', field, PRI)], cfmt, 'a - b'),
];
const OPEN = [['Is Open', 'equals', 1]];
const cs = (id, f, c) => sum(id, CC, f, c);
const cl = (id, f, c) => sum(id, CL, f, c);
const pv = (id, f, c) => sum(id, PV, f, c);

export const ENTITIES = [
  // ---- dimensions
  fd('Branch', BR, 'Branch', 'Larkspur Music branch code (US, UK, DE, ES, BR, AR, MX, JP); every fact joins here.'),
  fd('Branch Name', BR, 'Branch Name', 'Branch legal / office name.'), fd('Region', BR, 'Region', 'North America, Europe, Latin America, Asia Pacific.'),
  fd('Branch Currency', BR, 'Currency', 'Branch local currency.'), fd('Branch Controller', BR, 'Branch Controller', 'Finance controller who signs off the branch close.'),
  fd('Statement', ST, 'Statement Id', 'Royalty Engine StatementId (verified source key; joins statement amounts and detail).'),
  fd('Processing Run', ST, 'Processing Run', 'Royalty Engine processing run (monthly, R-2026-05 … R-2026-10).'),
  fd('Accounting Period', ST, 'Accounting Period', 'Statement accounting period (YYYY-MM).'),
  fd('Run Flag', ST, 'Run Flag', 'Current (R-2026-10), Prior (R-2026-09) or Earlier.'),
  fd('Statement Currency', ST, 'Currency', 'Currency the statement is issued in (local).'),
  fd('Payee', ST, 'Payee Name', 'Writer, publisher or administrator receiving the statement.'), fd('Payee Type', ST, 'Payee Type', 'Writer, Publisher, Co-publisher, Administrator.'),
  fd('Reconciliation Status', ST, 'Reconciliation Status', 'Source reconciliation flag from Royalty Engine (read-only): Reconciled / Unreconciled.'),
  fd('Source Reconciled Flag', ST, 'Is Reconciled', 'Raw Y/N source reconciliation flag (read-only).'),
  fd('Exception Category', ST, 'Exception Category', 'Calc error, Unreconciled, Unreconciled + suspense, Suspense, Write-off, Clean.'),
  fd('Close Due Date', ST, 'Close Due Date', 'Date the run must be closed.'),
  fd('Amount Type', SA, 'Amount Type', 'Statement amount line: opening, gross earnings, recoupment, withholding, write-off, payment, closing.'),
  fd('Amount Order', SA, 'Amount Order', 'Order of the statement amount line (1–7).'),
  fd('Suspense Reason', SU, 'Suspense Reason', 'Why income is held in suspense.'), fd('Suspense Song', SU, 'Song', 'Song held in suspense.'), fd('Suspense Income Source', SU, 'Income Source', 'Society / DSP the suspense income came from.'),
  fd('Calc Error Code', CE, 'Error Code', 'Royalty Engine calculation error code.'), fd('Calc Error Type', CE, 'Error Type', 'Calculation error description.'),
  fd('Income Source', ID, 'Income Source', 'Society or DSP on the income statement line.'), fd('Income Type', ID, 'Income Type', 'Performance, Mechanical, Digital, Sync.'), fd('Income Song', ID, 'Song', 'Song on the income line.'),
  fd('Case', CC, 'Case Id', 'Close exception case.'), fd('Case Status', CC, 'Status', 'Open, Assigned, Submitted for review, Returned, Approved, Carry-forward approved.'),
  fd('Exception Type', CC, 'Exception Type', 'Unreconciled statement, Suspense, Calculation error, Write-off, Other.'), fd('Case Owner', CC, 'Owner', 'Analyst who owns the case.'),
  fd('Case Due Date', CC, 'Due Date', 'Case due date.'), fd('Disposition', CC, 'Disposition', 'Agreed disposition.'), fd('Carry Forward', CC, 'Carry Forward', 'Y when a controller approved carrying the exposure into the next run.'),
  fd('Case Action', CV, 'Action', 'Action recorded in the case history.'), fd('Case Actor', CV, 'Actor', 'Who acted.'), fd('Case Event Date', CV, 'Event Date', 'Date of the action.'),
  fd('User', US, 'User Name', 'App user.'), fd('User Role', US, 'Role', 'Royalty Analyst, Finance Controller, Income Tracking Analyst, Claims Owner, Finance (Recovery), Viewer.'),
  fd('Song', SO, 'Song', 'Song title.'), fd('Writer', SO, 'Writer', 'Lead writer.'), fd('Genre', SO, 'Genre', 'Genre.'),
  fd('PvC Period', PV, 'Accounting Period', 'Income accounting quarter (2025-Q4 … 2026-Q3).'), fd('PvC Period Flag', PV, 'Period Flag', 'Latest (2026-Q3), Prior (2026-Q2), Earlier.'),
  fd('Payer', PV, 'Payer', 'Society, agency or DSP that paid the income.'), fd('PvC Income Source', PV, 'Income Source', 'Society, Mechanical agency, DSP / licensee.'), fd('PvC Income Type', PV, 'Income Type', 'Performance, Mechanical, Digital, Sync.'),
  fd('PvC Currency', PV, 'Currency', 'Local currency of the income line.'), fd('Source Line', PV, 'Source Line Id', 'Income summary source line key (claims reference it).'),
  fd('Data Quality Status', PV, 'Dq Status', 'OK, Missing collectable %, Missing received %.'), fd('Normalization Rule', PV, 'Normalization Rule', 'How the received % was normalised to 0–1.'),
  fd('Claim', CL, 'Claim Id', 'Recovery claim.'), fd('Claim Status', CL, 'Status', 'Open, Confirmed, Submitted, Partially recovered, Closed, Dismissed.'), fd('Claim Owner', CL, 'Owner', 'Claims owner.'),
  fd('Claim Payer', CL, 'Payer', 'Payer the claim is raised against.'), fd('Claim Currency', CL, 'Currency', 'Claim currency.'),
  fd('Recovery', RC, 'Recovery Id', 'Recovery record.'), fd('Recovery Reference Type', RC, 'Ref Type', 'Receipt or Adjustment.'), fd('Supporting Reference', RC, 'Supporting Ref', 'Receipt / adjustment reference (unique allocation).'), fd('Recovery Verified', RC, 'Verified', 'Y when Finance verified the evidence.'),
  fd('Claim Action', CH, 'Action', 'Claim history action.'), fd('Claim Actor', CH, 'Actor', 'Who acted.'), fd('Claim Event Date', CH, 'Event Date', 'Date of the claim action.'),
  fd('Receipt', RE, 'Receipt Ref', 'Cash receipt or adjustment reference (Cash management system).'),

  // ---- close: statements (source, read-only)
  ...fam('Statements', 'Royalty statements produced by Royalty Engine.', 'Statement Count', INT, SNUM),
  ...fam('Unreconciled Statements', 'Statements whose source reconciliation flag is N.', 'Unreconciled Flag', INT, SNUM),
  ...fam('Exception Statements', 'Statements needing attention (unreconciled, suspense, calc error or write-off).', 'Exception Flag', INT, SNUM),
  ...fam('Statements with Suspense', 'Statements with income held in suspense.', 'Suspense Flag', INT, SNUM),
  ...fam('Statements with Calc Errors', 'Statements with a Royalty Engine calculation error.', 'Calc Error Flag', INT, SNUM),
  ...fam('Gross Earnings USD', 'Gross statement earnings in USD equivalent (branch FX).', 'Gross Earnings Usd', USD),
  ...fam('Source Exposure USD', 'Outstanding source exposure in USD equivalent: max(reconciliation difference, suspense + calc impact). Not reduced by case status — carry-forwards stay exposed.', 'Source Exposure Usd', USD),
  ...fam('Suspense USD', 'Suspense amount (USD equivalent).', 'Suspense Amount Usd', USD),
  ...fam('Calc Error Impact USD', 'Calculation error impact (USD equivalent).', 'Calc Error Impact Usd', USD),
  ...fam('Write-offs USD', 'Statement write-offs (USD equivalent).', 'Write Off Amount Usd', USD),
  ms('Unreconciled Rate', 'Unreconciled ÷ all statements.', [st('a', 'Unreconciled Flag'), st('b', 'Statement Count')], PCT, 'a / b'),
  ms('Unreconciled Rate Current Run', 'Unreconciled rate, current run.', [st('a', 'Unreconciled Flag', CUR), st('b', 'Statement Count', CUR)], PCT, 'a / b'),
  ms('Unreconciled Rate vs Prior Run', 'Unreconciled rate change vs prior run (points).', [st('a', 'Unreconciled Flag', CUR), st('b', 'Statement Count', CUR), st('c', 'Unreconciled Flag', PRI), st('d', 'Statement Count', PRI)], PTS, '(a / b - c / d) * 100'),
  ms('Exposure Rate', 'Source exposure ÷ gross earnings (USD).', [st('a', 'Source Exposure Usd'), st('b', 'Gross Earnings Usd')], PCT, 'a / b'),
  ms('Source Exposure', 'Outstanding source exposure in local currency (only meaningful within one currency).', [st('x', 'Source Exposure')], AMT),
  ms('Reconciliation Difference', 'Source reconciliation difference, local currency (read-only).', [st('x', 'Recon Diff')], AMT),
  ms('Suspense Amount', 'Suspense in local currency.', [st('x', 'Suspense Amount')], AMT),
  ms('Calc Error Impact', 'Calculation error impact, local currency.', [st('x', 'Calc Error Impact')], AMT),
  ms('Write-offs', 'Write-offs, local currency.', [st('x', 'Write Off Amount')], AMT),
  ms('Gross Earnings', 'Gross earnings, local currency.', [st('x', 'Gross Earnings')], AMT),
  ms('Closing Balance', 'Closing balance carried on the statement, local currency.', [st('x', 'Closing Balance')], AMT),
  ms('Statement Amount', 'Statement amount lines (validated grain: one row per StatementId × Amount Type), local currency.', [sum('x', SA, 'Amount')], AMT),
  ms('Statement Amount USD', 'Statement amount lines in USD equivalent.', [sum('x', SA, 'Amount Usd')], USD),
  ms('Statement Amount Rows', 'Rows in the statement-amount view (7 per statement when the grain holds).', [sum('x', SA, 'Amount Row Count')], INT),
  ms('Amount Rows per Statement', 'Grain check: amount rows ÷ statements (expected 7.0).', [sum('a', SA, 'Amount Row Count'), st('b', 'Statement Count')], '0.00', 'a / b'),
  ms('Suspense Items', 'Suspense detail rows.', [sum('x', SU, 'Suspense Count')], INT),
  ms('Suspense Detail Amount', 'Suspense detail amount, local currency.', [sum('x', SU, 'Amount')], AMT),
  ms('Average Suspense Age', 'Average age of suspense items (days).', [sum('a', SU, 'Age Days'), sum('b', SU, 'Suspense Count')], '0" d"', 'a / b'),
  ms('Calc Errors', 'Calculation error rows.', [sum('x', CE, 'Error Count')], INT),
  ms('Calc Error Detail Impact', 'Calculation error impact from the detail, local currency.', [sum('x', CE, 'Amount Impact')], AMT),
  ms('Income Amount', 'Income statement detail amount, local currency.', [sum('x', ID, 'Amount')], AMT),
  ms('Income Amount USD', 'Income statement detail amount, USD equivalent.', [sum('x', ID, 'Amount Usd')], USD),
  ms('Income Lines', 'Income statement detail lines.', [sum('x', ID, 'Line Count')], INT),
  // ---- close: cases (workflow)
  ms('Cases', 'Close exception cases.', [cs('x', 'Case Count')], INT),
  ms('Open Cases', 'Cases not yet approved.', [cs('x', 'Case Count', OPEN)], INT),
  ms('Overdue Cases', 'Open cases past their due date (demo clock 11 Nov 2026).', [cs('x', 'Is Overdue')], INT),
  ms('Cases Awaiting Review', 'Cases submitted for controller review.', [cs('x', 'Case Count', [['Status', 'equals', 'Submitted for review']])], INT),
  ms('Cases Returned', 'Cases returned for more work.', [cs('x', 'Case Count', [['Status', 'equals', 'Returned']])], INT),
  ms('Approved Dispositions', 'Cases approved by a controller.', [cs('x', 'Case Count', [['Status', 'equals', 'Approved']])], INT),
  ms('Approved Carry-forwards', 'Cases approved to carry forward (exposure still outstanding).', [cs('x', 'Case Count', [['Status', 'equals', 'Carry-forward approved']])], INT),
  ms('Observed Case Amount', 'Amount observed by the analyst when the case was opened, local currency.', [cs('x', 'Observed Amount')], AMT),
  ms('Carry-forward Exposure', 'Observed amount on approved carry-forwards, local currency — still outstanding at source.', [cs('x', 'Observed Amount', [['Status', 'equals', 'Carry-forward approved']])], AMT),
  ms('Open Case Amount', 'Observed amount on open cases, local currency.', [cs('x', 'Observed Amount', OPEN)], AMT),
  ms('Case Approval Rate', 'Approved + carry-forward ÷ all cases.', [cs('a', 'Case Count', [['Is Open', 'equals', 0]]), cs('b', 'Case Count')], PCT, 'a / b'),
  ms('Case Actions', 'Actions in the case history.', [sum('x', CV, 'Event Count')], INT),
  // ---- recovery: paid vs collectable (source)
  ms('Income Lines Reviewed', 'Income summary lines compared (adjustments MV).', [pv('x', 'Line Count')], INT),
  ms('Adjusted Local Net Income', 'Adjusted local net income received, local currency.', [pv('x', 'Adj Local Net Income')], AMT),
  ms('Expected Collectable Income', 'Income ÷ received % × collectable %, local currency.', [pv('x', 'Expected Local')], AMT),
  ms('Signed Gap', 'Signed local-currency difference (collectable − received), all lines with both percentages.', [pv('x', 'Estimated Gap Local')], AMT),
  ms('Estimated Gap', 'Apparent underpayment: positive gap on lines ≥ 2 pts under collectable, local currency.', [pv('x', 'Candidate Gap Local')], AMT),
  ms('Estimated Gap USD', 'Apparent underpayment in USD equivalent.', [pv('x', 'Candidate Gap Usd')], USD),
  ms('Estimated Gap USD Latest Quarter', 'Apparent underpayment, 2026-Q3, USD.', [pv('x', 'Candidate Gap Usd', LAT)], USD),
  ms('Estimated Gap USD Prior Quarter', 'Apparent underpayment, 2026-Q2, USD.', [pv('x', 'Candidate Gap Usd', PRV)], USD),
  ms('Estimated Gap USD vs Prior Quarter', 'Apparent underpayment, latest vs prior quarter.', [pv('a', 'Candidate Gap Usd', LAT), pv('b', 'Candidate Gap Usd', PRV)], SPCT, 'a / b - 1'),
  ms('Underpaid Lines', 'Lines flagged as apparent underpayments.', [pv('x', 'Underpaid Flag')], INT),
  ms('Underpaid Lines Latest Quarter', 'Underpaid lines, 2026-Q3.', [pv('x', 'Underpaid Flag', LAT)], INT),
  ms('Underpaid Lines Prior Quarter', 'Underpaid lines, 2026-Q2.', [pv('x', 'Underpaid Flag', PRV)], INT),
  ms('Underpaid Lines vs Prior Quarter', 'Underpaid lines, latest minus prior quarter.', [pv('a', 'Underpaid Flag', LAT), pv('b', 'Underpaid Flag', PRV)], SNUM, 'a - b'),
  ms('Data Quality Lines', 'Lines missing the received or collectable percentage (investigate, do not estimate).', [pv('x', 'Dq Issue Flag')], INT),
  ms('Data Quality Lines Latest Quarter', 'Data-quality lines, 2026-Q3.', [pv('x', 'Dq Issue Flag', LAT)], INT),
  ms('Data Quality Lines Prior Quarter', 'Data-quality lines, 2026-Q2.', [pv('x', 'Dq Issue Flag', PRV)], INT),
  ms('Data Quality Income', 'Income on lines with missing percentages, local currency.', [pv('x', 'Adj Local Net Income', [['Dq Issue Flag', 'equals', 1]])], AMT),
  ms('Received Percentage', 'Received % as normalised to 0–1 (valid at source-line grain only).', [pv('x', 'Received Pct')], PCT),
  ms('Collectable Percentage', 'Collectable % from song_branch_collectable (valid at source-line grain only).', [pv('x', 'Collectable Pct')], PCT),
  ms('Underpayment Rate', 'Underpaid lines ÷ lines reviewed.', [pv('a', 'Underpaid Flag'), pv('b', 'Line Count')], PCT, 'a / b'),
  ms('Collection Efficiency', 'Received income ÷ expected collectable income.', [pv('a', 'Adj Local Net Income', [['Dq Issue Flag', 'equals', 0]]), pv('b', 'Expected Local')], PCT, 'a / b'),
  // ---- recovery: claims / recoveries (workflow)
  ms('Claims', 'Recovery claims.', [cl('x', 'Claim Count')], INT),
  ms('Open Claims', 'Claims not closed or dismissed.', [cl('x', 'Claim Count', OPEN)], INT),
  ms('DQ Investigations', 'Lines routed to data-quality investigation (missing percentage).', [cl('x', 'Claim Count', [['Status', 'equals', 'DQ investigation']])], INT),
  ms('Dismissed Candidates', 'Candidates dismissed with a reason.', [cl('x', 'Claim Count', [['Status', 'equals', 'Dismissed']])], INT),
  ms('Estimate at Discovery', 'Estimated gap when the claim was opened, local currency.', [cl('x', 'Estimate At Discovery')], AMT),
  ms('Confirmed Claim Amount', 'Confirmed claim amount, local currency (distinct from estimate and recovery).', [cl('x', 'Confirmed Amount')], AMT),
  ms('Waived Amount', 'Remainder waived or otherwise resolved at closure, local currency.', [cl('x', 'Waived Amount')], AMT),
  ms('Verified Recovery', 'Recoveries with evidence verified by Finance — the only recoveries that count in Finance totals, local currency.', [sum('x', RC, 'Verified Amount')], AMT),
  ms('Unverified Recovery', 'Recoveries recorded but not yet verified (excluded from Finance totals), local currency.', [sum('a', RC, 'Recovery Amount'), sum('b', RC, 'Verified Amount')], AMT, 'a - b'),
  ms('Recoveries Recorded', 'Recovery records.', [sum('x', RC, 'Recovery Count')], INT),
  ms('Outstanding Confirmed Balance', 'Confirmed claim − verified recovery − waived, local currency.', [cl('a', 'Confirmed Amount'), sum('b', RC, 'Verified Amount'), cl('c', 'Waived Amount')], AMT, 'a - b - c'),
  ms('Recovery Rate', 'Verified recovery ÷ confirmed claim.', [sum('a', RC, 'Verified Amount'), cl('b', 'Confirmed Amount')], PCT, 'a / b'),
  ms('Claim Actions', 'Actions in the claim history.', [sum('x', CH, 'Event Count')], INT),
  ms('Receipts Available', 'Cash receipts and adjustments, local currency.', [sum('x', RE, 'Receipt Amount')], AMT),
];
// fix: weighted received % needs an expression

import { QUESTIONS } from '../src/questions.js';
export { QUESTIONS };

// ------------------------------------------------------------------ Data Actions (virtualProcedure) with role + branch guards and an audit insert
const NOW = 'CONVERT_TIMEZONE(\'Europe/London\', CURRENT_TIMESTAMP())::TIMESTAMP_NTZ';
const A = '{acting_as:string}';
const roleOk = (roles, branchExpr) => `EXISTS (SELECT 1 FROM ${T}ROYALTY_USERS u WHERE u."USER_NAME" = ${A} AND u."CAN_WRITE" = 'Y' AND u."ROLE" IN (${roles.map((r) => `'${r}'`).join(', ')})${branchExpr ? ` AND (u."BRANCH_SCOPE" = 'ALL' OR CONTAINS(u."BRANCH_SCOPE", ${branchExpr}))` : ''})`;
const BR_OF = `(SELECT "BRANCH" FROM ${T}ROYALTY_STATEMENTS WHERE "STATEMENT_ID" = {statement_id:string})`;
const BR_CASE = `(SELECT s."BRANCH" FROM ${T}ROYALTY_CLOSE_CASES c JOIN ${T}ROYALTY_STATEMENTS s USING ("STATEMENT_ID") WHERE c."CASE_ID" = {case_id:string})`;
const P = (name, dataType, description, def) => ({ name, dataType, description, ...(def !== undefined ? { default: def } : {}) });
const pActor = P('acting_as', 'string', 'Person acting (must exist in ROYALTY_USERS with the right role and branch).');
const def = (description, parameters, statements, last) => ({ kind: 'virtualProcedure', description: `${description} Demo writeback target.`, parameters, returns: { fields: { rows_affected: { dataType: 'int' } } }, implementation: { transaction: true, dialects: { snowflake: { statements, result: { mode: 'affectedRows', field: 'rows_affected', statement: last } } } } });
const caseEvent = (action, to, note, guard) => ({ name: 'audit', sql: `INSERT INTO ${T}ROYALTY_CLOSE_EVENTS SELECT 'EV-' || UUID_STRING(), c."CASE_ID", c."STATEMENT_ID", ${action}, '', ${to}, ${A}, (SELECT MAX("ROLE") FROM ${T}ROYALTY_USERS WHERE "USER_NAME" = ${A}), c."OBSERVED_AMOUNT", c."OBSERVED_CURRENCY", LEFT(${note}, 1900), ${NOW}, CURRENT_DATE(), 1 FROM ${T}ROYALTY_CLOSE_CASES c WHERE c."CASE_ID" = {case_id:string} AND ${guard}` });
const claimEvent = (action, ref, note, guard, amount = 'COALESCE(c."CONFIRMED_AMOUNT", c."ESTIMATE_AT_DISCOVERY")') => ({ name: 'audit', sql: `INSERT INTO ${T}ROYALTY_CLAIM_EVENTS SELECT 'CEV-' || UUID_STRING(), c."CLAIM_ID", '', ${action}, '', c."STATUS", ${A}, (SELECT MAX("ROLE") FROM ${T}ROYALTY_USERS WHERE "USER_NAME" = ${A}), ${amount}, c."CURRENCY", ${ref}, LEFT(${note}, 1900), ${NOW}, CURRENT_DATE(), 1 FROM ${T}ROYALTY_CLAIMS c WHERE c."CLAIM_ID" = {claim_id:string} AND ${guard}` });
const ANALYST = ['Royalty Analyst'], CTRL = ['Finance Controller'], ITA = ['Income Tracking Analyst', 'Claims Owner'], OWNER = ['Claims Owner'], FIN = ['Finance (Recovery)'];
const ACTIONS = {
  'Open Close Case': def('Opens (and assigns) a close exception case on a verified StatementId, snapshotting the observed source amount, currency and reconciliation flag. Royalty Analyst with branch access only.',
    [P('case_id', 'string', 'New case ID, e.g. CASE-2001.'), P('statement_id', 'string', 'Royalty Engine StatementId (must exist).'), P('exception_type', 'string', 'Unreconciled statement, Suspense, Calculation error, Write-off, Other.'), P('owner', 'string', 'Case owner.'), P('due_date', 'string', 'YYYY-MM-DD.'), P('notes', 'string', 'Notes.', ''), pActor],
    [{ name: 'open', sql: `INSERT INTO ${T}ROYALTY_CLOSE_CASES SELECT {case_id:string}, s."STATEMENT_ID", {exception_type:string}, 'Assigned', {owner:string}, TO_DATE({due_date:string}), s."SOURCE_EXPOSURE", s."CURRENCY", s."IS_RECONCILED", NULLIF({notes:string}, ''), '', '', '', '', 'N', IFF(TO_DATE({due_date:string}) < '2026-11-11', 1, 0), 1, ${A}, ${NOW}, ${A}, ${NOW}, 1 FROM ${T}ROYALTY_STATEMENTS s WHERE s."STATEMENT_ID" = {statement_id:string} AND NOT EXISTS (SELECT 1 FROM ${T}ROYALTY_CLOSE_CASES x WHERE x."STATEMENT_ID" = s."STATEMENT_ID" AND x."IS_OPEN" = 1) AND ${roleOk(ANALYST, BR_OF)}` },
      caseEvent("'Case opened & assigned'", "'Assigned'", `'Owner ' || {owner:string} || ', due ' || {due_date:string}`, roleOk(ANALYST, BR_OF))], 'open'),
  'Submit Case for Review': def('Analyst records notes and evidence references and submits the case for controller review (Assigned/Returned → Submitted for review).',
    [P('case_id', 'string', 'Case ID.'), P('notes', 'string', 'Investigation notes.'), P('evidence_refs', 'string', 'Evidence references (required).'), P('disposition', 'string', 'Proposed disposition.'), pActor],
    [{ name: 'submit', sql: `UPDATE ${T}ROYALTY_CLOSE_CASES SET "STATUS" = 'Submitted for review', "NOTES" = {notes:string}, "EVIDENCE_REFS" = {evidence_refs:string}, "DISPOSITION" = {disposition:string}, "UPDATED_BY" = ${A}, "UPDATED_AT" = ${NOW} WHERE "CASE_ID" = {case_id:string} AND "STATUS" IN ('Assigned', 'Returned', 'Open') AND LENGTH(TRIM({evidence_refs:string})) > 0 AND ${roleOk(ANALYST, BR_CASE)}` },
      caseEvent("'Submitted for review'", "'Submitted for review'", "{disposition:string} || ' · evidence: ' || {evidence_refs:string}", roleOk(ANALYST, BR_CASE))], 'submit'),
  'Controller Decide Case': def('Finance Controller approves the disposition, returns it for more work, or approves a carry-forward (rationale required). Maker–checker: never on a case they submitted. Carry-forwards remain in outstanding source exposure.',
    [P('case_id', 'string', 'Case ID.'), P('decision', 'string', 'Approved, Returned or Carry-forward approved.'), P('rationale', 'string', 'Required for Returned and Carry-forward approved.', ''), pActor],
    [{ name: 'decide', sql: `UPDATE ${T}ROYALTY_CLOSE_CASES SET "STATUS" = {decision:string}, "CONTROLLER" = ${A}, "CONTROLLER_RATIONALE" = NULLIF({rationale:string}, ''), "CARRY_FORWARD" = IFF({decision:string} = 'Carry-forward approved', 'Y', 'N'), "IS_OPEN" = IFF({decision:string} = 'Returned', 1, 0), "IS_OVERDUE" = IFF({decision:string} = 'Returned', "IS_OVERDUE", 0), "UPDATED_BY" = ${A}, "UPDATED_AT" = ${NOW} WHERE "CASE_ID" = {case_id:string} AND "STATUS" = 'Submitted for review' AND {decision:string} IN ('Approved', 'Returned', 'Carry-forward approved') AND ({decision:string} = 'Approved' OR LENGTH(TRIM({rationale:string})) > 0) AND "UPDATED_BY" <> ${A} AND ${roleOk(CTRL, BR_CASE)}` },
      caseEvent("'Controller: ' || {decision:string}", '{decision:string}', "COALESCE(NULLIF({rationale:string}, ''), 'Disposition approved')", roleOk(CTRL, BR_CASE))], 'decide'),
  'Open Recovery Claim': def('Turns an apparent underpayment into a claim: captures source-line references, estimate at discovery, owner, due date and evidence.',
    [P('claim_id', 'string', 'New claim ID, e.g. CLM-0301.'), P('source_line_id', 'string', 'Primary PvC source line (must exist, no other open claim).'), P('source_line_refs', 'string', 'All source-line references.'), P('owner', 'string', 'Claims owner.'), P('due_date', 'string', 'YYYY-MM-DD.'), P('evidence', 'string', 'Evidence reference.'), pActor],
    [{ name: 'open', sql: `INSERT INTO ${T}ROYALTY_CLAIMS SELECT {claim_id:string}, {source_line_refs:string}, l."SOURCE_LINE_ID", l."SONG", l."BRANCH", l."ACCOUNTING_PERIOD", l."PAYER", l."INCOME_TYPE", l."CURRENCY", 'Open', l."ESTIMATED_GAP_LOCAL", NULL, NULL, '', NULL, {owner:string}, TO_DATE({due_date:string}), {evidence:string}, '', '', 0, ${A}, ${NOW}, ${A}, ${NOW}, 1, 1 FROM ${T}ROYALTY_PVC_LINES l WHERE l."SOURCE_LINE_ID" = {source_line_id:string} AND l."UNDERPAID_FLAG" = 1 AND NOT EXISTS (SELECT 1 FROM ${T}ROYALTY_CLAIMS c WHERE c."PRIMARY_SOURCE_LINE_ID" = l."SOURCE_LINE_ID" AND c."STATUS" <> 'Dismissed') AND ${roleOk(ITA)}` },
      claimEvent("'Claim opened'", '{source_line_id:string}', "'Estimate at discovery; evidence ' || {evidence:string}", roleOk(ITA), 'c."ESTIMATE_AT_DISCOVERY"')], 'open'),
  'Confirm Recovery Claim': def('Claims owner records the confirmed claim amount, submission date, payer reference and next follow-up.',
    [P('claim_id', 'string', 'Claim ID.'), P('confirmed_amount', 'float', 'Confirmed claim amount (local currency).'), P('submission_date', 'string', 'YYYY-MM-DD.'), P('payer_ref', 'string', 'Payer claim reference.'), P('next_follow_up', 'string', 'YYYY-MM-DD.'), pActor],
    [{ name: 'confirm', sql: `UPDATE ${T}ROYALTY_CLAIMS SET "STATUS" = 'Submitted', "CONFIRMED_AMOUNT" = {confirmed_amount:float}, "SUBMISSION_DATE" = TO_DATE({submission_date:string}), "PAYER_REF" = {payer_ref:string}, "NEXT_FOLLOW_UP" = TO_DATE({next_follow_up:string}), "UPDATED_BY" = ${A}, "UPDATED_AT" = ${NOW} WHERE "CLAIM_ID" = {claim_id:string} AND "STATUS" IN ('Open', 'Confirmed') AND {confirmed_amount:float} > 0 AND ${roleOk(OWNER)}` },
      claimEvent("'Claim confirmed & submitted'", '{payer_ref:string}', "'Follow up ' || {next_follow_up:string}", roleOk(OWNER))], 'confirm'),
  'Record Recovery': def('Finance records a partial or full recovery against a receipt or adjustment. Evidence is required for it to count; a reference can be allocated only once.',
    [P('recovery_id', 'string', 'New recovery ID.'), P('claim_id', 'string', 'Claim ID.'), P('amount', 'float', 'Recovered amount (claim currency).'), P('supporting_ref', 'string', 'Receipt / adjustment reference (must exist, unallocated).'), P('evidence', 'string', 'Evidence (required to count).'), pActor],
    [{ name: 'record', sql: `INSERT INTO ${T}ROYALTY_RECOVERIES SELECT {recovery_id:string}, c."CLAIM_ID", {amount:float}, c."CURRENCY", r."REF_TYPE", r."RECEIPT_REF", {evidence:string}, IFF(LENGTH(TRIM({evidence:string})) > 0, 'Y', 'N'), IFF(LENGTH(TRIM({evidence:string})) > 0, ${A}, ''), ${NOW}, ${A}, ${NOW}, IFF(LENGTH(TRIM({evidence:string})) > 0, 1, 0), IFF(LENGTH(TRIM({evidence:string})) > 0, {amount:float}, 0), 1 FROM ${T}ROYALTY_CLAIMS c JOIN ${T}ROYALTY_RECEIPTS r ON r."RECEIPT_REF" = {supporting_ref:string} AND r."CURRENCY" = c."CURRENCY" WHERE c."CLAIM_ID" = {claim_id:string} AND c."STATUS" IN ('Submitted', 'Partially recovered') AND NOT EXISTS (SELECT 1 FROM ${T}ROYALTY_RECOVERIES x WHERE x."SUPPORTING_REF" = {supporting_ref:string}) AND ${roleOk(FIN)}` },
      { name: 'status', sql: `UPDATE ${T}ROYALTY_CLAIMS c SET "STATUS" = IFF((SELECT SUM("VERIFIED_AMOUNT") FROM ${T}ROYALTY_RECOVERIES WHERE "CLAIM_ID" = c."CLAIM_ID") >= c."CONFIRMED_AMOUNT", 'Recovered', 'Partially recovered'), "UPDATED_BY" = ${A}, "UPDATED_AT" = ${NOW} WHERE c."CLAIM_ID" = {claim_id:string} AND ${roleOk(FIN)}` },
      claimEvent("'Recovery recorded'", '{supporting_ref:string}', "'Evidence: ' || {evidence:string}", roleOk(FIN), '{amount:float}')], 'record'),
  'Close Recovery Claim': def('Closes a claim; the unrecovered remainder is waived or otherwise resolved with a closure reason.',
    [P('claim_id', 'string', 'Claim ID.'), P('closure_reason', 'string', 'Required.'), pActor],
    [{ name: 'close', sql: `UPDATE ${T}ROYALTY_CLAIMS c SET "STATUS" = 'Closed', "CLOSURE_REASON" = {closure_reason:string}, "WAIVED_AMOUNT" = GREATEST(0, c."CONFIRMED_AMOUNT" - COALESCE((SELECT SUM("VERIFIED_AMOUNT") FROM ${T}ROYALTY_RECOVERIES WHERE "CLAIM_ID" = c."CLAIM_ID"), 0)), "IS_OPEN" = 0, "UPDATED_BY" = ${A}, "UPDATED_AT" = ${NOW} WHERE c."CLAIM_ID" = {claim_id:string} AND LENGTH(TRIM({closure_reason:string})) > 0 AND ${roleOk(FIN.concat(OWNER))}` },
      claimEvent("'Claim closed'", "''", '{closure_reason:string}', roleOk(FIN.concat(OWNER)))], 'close'),
  'Dismiss Candidate': def('Dismisses an apparent underpayment with a reason (recorded as a dismissed claim so it leaves the queue with an audit trail).',
    [P('claim_id', 'string', 'New claim ID.'), P('source_line_id', 'string', 'PvC source line.'), P('reason', 'string', 'Dismissal reason (required).'), pActor],
    [{ name: 'dismiss', sql: `INSERT INTO ${T}ROYALTY_CLAIMS SELECT {claim_id:string}, l."SOURCE_LINE_ID", l."SOURCE_LINE_ID", l."SONG", l."BRANCH", l."ACCOUNTING_PERIOD", l."PAYER", l."INCOME_TYPE", l."CURRENCY", 'Dismissed', l."ESTIMATED_GAP_LOCAL", NULL, NULL, '', NULL, ${A}, NULL, '', {reason:string}, '', 0, ${A}, ${NOW}, ${A}, ${NOW}, 0, 1 FROM ${T}ROYALTY_PVC_LINES l WHERE l."SOURCE_LINE_ID" = {source_line_id:string} AND LENGTH(TRIM({reason:string})) > 0 AND ${roleOk(ITA)}` },
      claimEvent("'Candidate dismissed'", '{source_line_id:string}', '{reason:string}', roleOk(ITA), 'c."ESTIMATE_AT_DISCOVERY"')], 'dismiss'),
};

const batch = (items, size = 40) => {
  for (let at = 0; at < items.length; at += size) {
    const chunk = items.slice(at, at + size);
    const plan = call('astrato_semantic_layer_plan_authoring_batch', { semanticLayerId: LAYER, items: chunk.map((e, i) => ({ id: `e${i}`, entity: e.entity, operation: e.operation, targetName: e.name, request: e.name })) });
    if (!plan.readyToCommit) throw new Error(`plan not ready: ${JSON.stringify(plan.ambiguities ?? plan).slice(0, 3000)}`);
    const r = call('astrato_semantic_layer_commit_authoring_batch', { semanticLayerId: LAYER, planId: plan.planId, expectedRevision: plan.revision,
      items: chunk.map((e, i) => ({ id: `e${i}`, entity: e.entity, preparedTarget: plan.items[i].preparedTarget ?? null, change: { operation: e.operation, name: e.name, definition: e.definition } })) });
    if (!r.committed && !r.noChange) { const { receipts, ...rest } = r; console.log(JSON.stringify(rest).slice(0, 4000)); process.exit(1); }
    console.log(`committed ${chunk.length} at revision ${r.committedRevision}`);
  }
};

const cmd = process.argv[1]?.endsWith('layer.mjs') ? process.argv[2] : null;
if (cmd === 'create') console.log(JSON.stringify(call('astrato_semantic_layer_create', { name: 'Larkspur Music – Royalty Engine (demo)', datasourceId: '00000000-0000-0000-0000-000000000000' })).slice(0, 800));
if (cmd === 'views') {
  const SID = call('astrato_semantic_layer_begin_edit_session', { semanticLayerId: LAYER, label: 'Larkspur Music views' }).sessionId;
  for (const [name, [table]] of Object.entries(VIEWS)) {
    if (process.env.ONLY && !process.env.ONLY.split('|').includes(name)) continue;
    call('astrato_semantic_layer_apply_edit', { sessionId: SID, operation: 'upsert_view', payload: { name, source: { type: 'table', database: 'ASTRATO_GALLERY', schema: 'MOCK_DATA', table } } });
    const cols = Object.keys(TYPES).filter((k) => k.startsWith(`${table}.`)).map((k) => k.split('.')[1]);
    for (const col of cols) call('astrato_semantic_layer_apply_edit', { sessionId: SID, operation: 'upsert_field', viewName: name, payload: { name: title(col), source: col, dataType: TYPES[`${table}.${col}`] } });
    console.log('view', name, cols.length);
  }
  for (const [name, [, joins]] of Object.entries(VIEWS).filter(([n]) => !process.env.ONLY || process.env.ONLY.split('|').includes(n))) for (const [to, field] of joins) call('astrato_semantic_layer_apply_edit', { sessionId: SID, operation: 'upsert_join', payload: { views: [name, to], cardinality: 'many-to-one', conditions: [{ operator: 'equals', arguments: [{ reference: { view: name, field } }, { reference: { view: to, field } }] }] } });
  console.log('commit', JSON.stringify(call('astrato_semantic_layer_commit_edit_session', { sessionId: SID })).slice(0, 600));
}
if (cmd === 'model') {
  const only = process.argv[3] ? new Set(process.argv[3].split('|')) : null;
  batch(ENTITIES.filter((e) => !only || only.has(e.name)).map((e) => ({ ...e, operation: process.env.REPLACE ? 'replace' : 'create' })));
}
if (cmd === 'questions') {
  const existing = new Set(call('astrato_semantic_layer_list_questions', { semanticLayerId: LAYER }).items.map((item) => item.title ?? item.id));
  const cond = ([dimension, operator, values]) => ({ operator, arguments: [{ reference: { dimension } }, ...values.map((v) => ({ value: v }))] });
  batch(QUESTIONS.map((q) => ({ entity: 'businessQuestion', operation: existing.has(q.name) ? 'replace' : 'create', name: q.name, definition: {
    description: `${q.description} Demo data.`, question: q.name, categories: ['Larkspur Music', q.cat],
    dimensions: q.dims.map((dimension) => ({ reference: { dimension } })), measures: q.measures.map((measure) => ({ reference: { measure } })),
    ...(q.filters ? { filters: { expression: q.filters.map((_, i) => `{f${i}}`).join(' AND '), ...Object.fromEntries(q.filters.map((f, i) => [`f${i}`, cond(f)])) } } : {}),
    ...(q.order ? { orderBy: q.order.map(([k, d]) => ({ reference: q.dims.includes(k) ? { dimension: k } : { measure: k }, direction: d === 'asc' ? 'ascending' : 'descending' })) } : {}),
    preferredCharts: [{ type: q.chart }] } })), 12);
}
if (cmd === 'actions') {
  const existing = new Set((call('astrato_semantic_layer_list_data_actions', { semanticLayerId: LAYER }).items ?? []).map((a) => a.name));
  for (const [name, definition] of Object.entries(ACTIONS)) {
    const prep = call('astrato_semantic_layer_prepare_data_action_change', { semanticLayerId: LAYER, request: name, kind: 'virtualProcedure', includeProcedureCatalog: false, ...(existing.has(name) ? { targetDataAction: name } : {}) });
    const r = call('astrato_semantic_layer_apply_data_action_change', { semanticLayerId: LAYER, expectedRevision: prep.revision, preparedTarget: prep.preparedTarget ?? null, change: { operation: existing.has(name) ? 'replace' : 'create', name, definition } });
    console.log(name, '→ revision', r.committedRevision ?? r.revision, r.committed === false ? JSON.stringify(r).slice(0, 600) : '');
  }
}
if (cmd === 'schema') console.log(JSON.stringify(call('astrato_semantic_layer_check_source_schema', { semanticLayerId: LAYER })).slice(0, 3000));
if (cmd === 'validate') console.log(JSON.stringify(call('astrato_semantic_layer_validate', { semanticLayerId: LAYER })).slice(0, 3000));
if (cmd === 'publish') {
  console.log(JSON.stringify(call('astrato_semantic_layer_validate', { semanticLayerId: LAYER })).slice(0, 1500));
  console.log(JSON.stringify(call('astrato_semantic_layer_publish', { semanticLayerId: LAYER, expectedRevision: Number(process.argv[3]) })).slice(0, 1500));
}
