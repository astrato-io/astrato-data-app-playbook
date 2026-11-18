# Business questions — Keystone Affordability & Decisions

12 stored questions. Full definitions are under `businessQuestions` in [layer.json](layer.json).
Build every chart from one of these (or add one) rather than composing ad-hoc queries in the app.

## How affordable is each product?

Volume, income, expenses, new repayment, disposable income, debt-to-income and approval rate by product, largest first.

- **Measures:** Applications, Avg Monthly Income, Avg Total Expenses, Avg Proposed Repayment, Avg Disposable After Loan, Debt to Income, Approval Rate
- **By:** Product

## How are underwriters performing?

Cases, open cases, approval rate, proposals upheld by the approver and days to decision, by underwriter.

- **Measures:** Applications, Open Applications, Approval Rate, Proposal Upheld Rate, Avg Days to Decision
- **By:** Underwriter

## How did the headline metrics change month on month?

Each headline measure for every application month, with its change against the previous month: % growth for counts and £ averages, percentage-point difference for Debt to Income and Approval Rate. The first row is the latest month.

- **Measures:** Applications, Applications, Avg Monthly Income, Avg Monthly Income, Avg Total Expenses, Avg Total Expenses, Avg Disposable After Loan, Avg Disposable After Loan, Debt to Income, Debt to Income, Approval Rate, Approval Rate
- **By:** Application Month

## How did the headline metrics change quarter on quarter?

Each headline measure for every application quarter, with its change against the previous quarter: % growth for counts and £ averages, percentage-point difference for Debt to Income and Approval Rate. The first row is the latest quarter.

- **Measures:** Applications, Applications, Avg Monthly Income, Avg Monthly Income, Avg Total Expenses, Avg Total Expenses, Avg Disposable After Loan, Avg Disposable After Loan, Debt to Income, Debt to Income, Approval Rate, Approval Rate
- **By:** Application Quarter

## How do income and expenses compare by region?

Average monthly net income and total expenses per applicant, by UK region, highest income first.

- **Measures:** Avg Monthly Income, Avg Total Expenses
- **By:** Region

## How do income and expenses trend by month?

The headline measures and average essential expenses for every application month, oldest first.

- **Measures:** Applications, Avg Monthly Income, Avg Total Expenses, Avg Disposable After Loan, Debt to Income, Approval Rate, Avg Essential Expenses
- **By:** Application Month

## How does approval rate vary by credit band?

Approved ÷ decided applications for each credit score band, highest first.

- **Measures:** Approval Rate
- **By:** Credit Band

## How many applications are there by income band?

Applications by net income band, lowest band first.

- **Measures:** Applications
- **By:** Income Band

## How many applications are there by product?

Applications by product, largest first.

- **Measures:** Applications
- **By:** Product

## What are the headline affordability metrics?

Portfolio headline figures over the applications in view: volume, average income, expenses and disposable income, debt-to-income, approval rate and lending requested.

- **Measures:** Applications, Avg Monthly Income, Avg Total Expenses, Avg Disposable After Loan, Debt to Income, Approval Rate, Requested Lending
- **By:** All Applications

## Where are applications in the workflow?

Applications by workflow stage, in stage order.

- **Measures:** Applications
- **By:** Stage

## Where does the money go, by income band?

Average monthly outgoings per applicant by category, for each net income band.

- **Measures:** Avg Housing Cost, Avg Groceries, Avg Utilities, Avg Transport, Avg Childcare, Avg Discretionary Spend, Avg Existing Debt
- **By:** Income Band
