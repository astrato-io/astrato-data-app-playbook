# Business questions — Northstar – Private Markets Portfolio OS

24 stored questions. Full definitions are under `businessQuestions` in [layer.json](layer.json).
Build every chart from one of these (or add one) rather than composing ad-hoc queries in the app.

## How accurate have rolling forecasts been?

Revenue and EBITDA vs the rolling forecast made a quarter earlier (12 quarters).

- **Measures:** Forecast Accuracy, EBITDA Forecast Accuracy, Revenue, Forecast Revenue
- **By:** Company

## How does revenue growth compare with EBITDA growth by sector?

LTM growth and margin by sector.

- **Measures:** Revenue Growth, EBITDA Growth, EBITDA Margin LTM
- **By:** Sector

## How has EBITDA margin moved quarter by quarter for each company?

Quarterly EBITDA margin by company (12 quarters) — used to test consecutive declines.

- **Measures:** EBITDA Margin, Revenue, EBITDA
- **By:** Company, Quarter

## How have portfolio revenue and EBITDA trended against budget?

Quarterly revenue, budget and EBITDA margin (12 quarters).

- **Measures:** Revenue, Budget Revenue, EBITDA, EBITDA Margin
- **By:** Quarter

## How is each fund performing?

Commitments, invested, realised, fair value, gross MOIC, DPI and pooled gross IRR by fund.

- **Measures:** Fund Commitments, Invested Capital, Realised Proceeds, Fair Value, Gross MOIC, Gross DPI, Fund Gross IRR
- **By:** Fund

## How is the Northstar portfolio performing?

Approved fair value, invested capital, realised proceeds, gross MOIC and operating momentum at Q3 2026.

- **Measures:** Fair Value, Invested Capital, Realised Proceeds, Gross MOIC, Revenue Growth, EBITDA Growth, Net Leverage, Valuations Pending

## What are the principal drivers of valuation movement this quarter?

Q3 2026 valuation bridge across the portfolio: operating performance, multiples, net debt, FX, capital flows and ownership.

- **Measures:** Bridge Operating Performance, Bridge Multiple, Bridge Net Debt, Bridge FX, Bridge Contributions, Bridge Distributions, Bridge Ownership, Bridge Other
- **By:** Valuation Quarter

## What would happen to portfolio fair value if exit multiples contracted by 1.0x?

Fair value impact of a 1.0x multiple contraction (LTM EBITDA × ownership) by fund.

- **Measures:** Fair Value, Fair Value Impact of -1.0x
- **By:** Fund

## Where is portfolio value concentrated by geography?

Fair value by region and country.

- **Measures:** Fair Value, Invested Capital, Gross MOIC
- **By:** Region, Country

## Where is portfolio value concentrated by sector?

Fair value, invested capital and MOIC by sector.

- **Measures:** Fair Value, Invested Capital, Gross MOIC
- **By:** Sector

## Where is the value-creation pipeline by status?

Initiatives, run-rate EBITDA impact and cost by workflow status.

- **Measures:** Initiatives, Estimated EBITDA Impact, Implementation Cost
- **By:** Initiative Status

## Which companies are missing their quarterly budget?

Q3 2026 revenue and EBITDA against board-approved budget.

- **Measures:** Budget Variance Latest Quarter, EBITDA vs Budget Latest Quarter
- **By:** Company

## Which companies are most sensitive to a 100-basis-point increase in financing costs?

Interest cover today and after +100 bp on floating-rate drawn debt.

- **Measures:** Interest Coverage, Interest Coverage +100bp, Floating Rate Debt, Net Leverage
- **By:** Company

## Which companies have overdue monitoring submissions?

Q3 2026 monitoring packs not yet approved, with deadline and owner (overdue = deadline before today).

- **Measures:** Workflow Records
- **By:** Company, Workflow Status, Workflow Records.Due Date, Workflow Records.Owner

## Which investment thesis components are off track?

Thesis tracker status by component across the portfolio.

- **Measures:** Thesis On Track, Thesis Off Track, Thesis Score
- **By:** Thesis Component

## Which investments are approaching exit?

Investment stage, entry year and returns.

- **Measures:** Gross MOIC, Gross IRR, Fair Value
- **By:** Company, Investment Stage, Entry Year

## Which investments contributed most to portfolio value this quarter?

Approved valuation movement by investment (net of capital flows).

- **Measures:** Valuation Movement, Valuation Movement %, Fair Value
- **By:** Company

## Which investments have declining free cash flow conversion despite revenue growth?

Cash conversion now vs a year ago alongside revenue growth.

- **Measures:** Revenue Growth, Cash Conversion, Cash Conversion PY, Cash Conversion Change
- **By:** Company

## Which investments have the highest leverage relative to internally defined risk thresholds?

Net leverage against the covenant maximum, with liquidity.

- **Measures:** Net Leverage, Covenant Max Leverage, Net Leverage Change, Liquidity
- **By:** Company

## Which investments have the largest negative variance against original underwriting?

LTM revenue and EBITDA against the original investment case.

- **Measures:** EBITDA Gap to Underwriting, EBITDA vs Underwriting, Revenue vs Underwriting
- **By:** Company

## Which portfolio companies have experienced EBITDA margin deterioration?

LTM EBITDA margin against the prior twelve months, worst first.

- **Measures:** EBITDA Margin Change, EBITDA Margin LTM, EBITDA Margin PLTM
- **By:** Company

## Which portfolio companies require investment review?

High and elevated-risk investments with leverage, coverage, underwriting and budget variance.

- **Measures:** EBITDA vs Underwriting, Budget Variance Latest Quarter, EBITDA Margin Change, Net Leverage, Interest Coverage
- **By:** Company, Risk Class

## Which valuation approvals are outstanding?

Q3 2026 valuations proposed, under review or challenged.

- **Measures:** Proposed Fair Value Q3, Q3 Valuation Movement
- **By:** Company, Valuation Status

## Which value-creation initiatives have generated the largest realised EBITDA improvement?

Realised vs planned EBITDA impact by initiative.

- **Measures:** Realised EBITDA Impact, Planned EBITDA Impact, Benefit Realisation, Implementation Cost
- **By:** Initiative, Company
