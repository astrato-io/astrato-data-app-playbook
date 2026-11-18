# Business questions — Larkspur Music – Royalty Engine (demo)

21 stored questions. Full definitions are under `businessQuestions` in [layer.json](layer.json).
Build every chart from one of these (or add one) rather than composing ad-hoc queries in the app.

## Does the statement-amount grain hold (one row per statement and amount type)?

Grain validation before aggregating statement amounts: expect 7.00. Demo data.

- **Measures:** Statements, Statement Amount Rows, Amount Rows per Statement
- **By:** Branch

## How has exception volume trended across processing runs?

Exceptions per monthly processing run. Demo data.

- **Measures:** Exception Statements, Unreconciled Statements, Statements with Suspense, Statements with Calc Errors
- **By:** Processing Run

## How is apparent underpayment trending by quarter?

Quarterly trend of apparent underpayment. Demo data.

- **Measures:** Estimated Gap USD, Underpaid Lines, Data Quality Lines
- **By:** PvC Period

## How many claims are at each stage?

Claim pipeline by status. Demo data.

- **Measures:** Claims
- **By:** Claim Status

## How many statements are unreconciled by branch this run?

Unreconciled statements by branch, current vs prior run. Demo data.

- **Measures:** Unreconciled Statements Current Run, Unreconciled Statements Prior Run, Unreconciled Rate Current Run
- **By:** Branch

## What are the statement amounts by type?

Statement amount waterfall lines in local currency. Demo data.

- **Measures:** Statement Amount
- **By:** Amount Order, Amount Type, Statement Currency

## What is held in suspense and why?

Suspense detail by reason (local currency; filter one currency). Demo data.

- **Measures:** Suspense Detail Amount, Suspense Items, Average Suspense Age
- **By:** Suspense Reason

## What is the estimated gap vs confirmed claim vs verified recovery?

Three distinct measures per claim, plus the outstanding balance. Demo data.

- **Measures:** Estimate at Discovery, Confirmed Claim Amount, Verified Recovery, Outstanding Confirmed Balance
- **By:** Claim, Claim Payer, Claim Currency, Claim Status

## What is waiting for controller review?

Cases by branch and status. Demo data.

- **Measures:** Cases
- **By:** Branch, Case Status

## Where is the source exposure by branch and currency?

Outstanding source exposure in local currency and USD equivalent. Demo data.

- **Measures:** Source Exposure, Source Exposure USD, Suspense Amount, Calc Error Impact, Write-offs
- **By:** Branch, Statement Currency

## Which branches carry both close exposure and recovery opportunity?

Close exposure (Royalty Engine statements) next to paid-vs-collectable gap (income summary) by branch. Demo data.

- **Measures:** Source Exposure USD Current Run, Estimated Gap USD, Unreconciled Statements Current Run, Underpaid Lines
- **By:** Branch, Branch Currency

## Which calculation errors are blocking close?

Calculation errors by code and branch. Demo data.

- **Measures:** Calc Errors, Calc Error Detail Impact
- **By:** Calc Error Code, Calc Error Type, Branch

## Which carry-forwards are approved but still exposed at source?

Approved carry-forwards with the outstanding source exposure. Demo data.

- **Measures:** Carry-forward Exposure, Source Exposure
- **By:** Case, Statement, Branch, Statement Currency, Disposition

## Which income sources make up the statement?

Income statement detail for drill-down. Demo data.

- **Measures:** Income Amount, Income Lines
- **By:** Income Source, Income Type, Income Song

## Which lines are missing a received or collectable percentage?

Data-quality queue: do not estimate a gap until fixed. Demo data.

- **Measures:** Adjusted Local Net Income
- **By:** Source Line, Song, Branch, Payer, Data Quality Status

## Which payers underpay most?

Apparent underpayment by payer (USD equivalent). Demo data.

- **Measures:** Estimated Gap USD, Underpaid Lines
- **By:** Payer

## Which songs look underpaid, ranked by estimated gap within currency?

Opportunity queue: apparent underpayments ranked within currency. Demo data.

- **Measures:** Estimated Gap, Adjusted Local Net Income, Expected Collectable Income
- **By:** PvC Currency, Source Line, Song, Branch, Payer, PvC Period

## Which statements need attention before close?

Current-run exception queue in local currency with the source reconciliation flag. Demo data.

- **Measures:** Source Exposure, Reconciliation Difference, Suspense Amount, Calc Error Impact, Write-offs
- **By:** Statement, Branch, Payee, Statement Currency, Exception Category, Reconciliation Status

## Who did what on the close cases?

Case action history (audit trail). Demo data.

- **Measures:** Case Actions
- **By:** Case Event Date, Case, Case Action, Case Actor

## Who did what on the recovery claims?

Claim audit history. Demo data.

- **Measures:** Claim Actions
- **By:** Claim Event Date, Claim, Claim Action, Claim Actor

## Who owns each exception and what is overdue?

Case ownership, due dates and overdue flag. Demo data.

- **Measures:** Observed Case Amount, Overdue Cases
- **By:** Case, Statement, Exception Type, Case Owner, Case Status, Case Due Date
