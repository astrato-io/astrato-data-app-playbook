# Business questions — Four Businesses (demo)

29 stored questions. Full definitions are under `businessQuestions` in [layer.json](layer.json).
Build every chart from one of these (or add one) rather than composing ad-hoc queries in the app.

## Customer 360 account dossier

One row per active account with every governed customer KPI. Select an account (e.g. Meridian Logistics) to drive the Customer 360 header.

- **Measures:** Current ARR, ARR Growth YoY, Health Score, Account Gross Margin %, Effective Discount %
- **By:** Accounts.Account Name, Accounts.Segment, Accounts.Industry, Accounts.Country, Accounts.Csm, Accounts.Renewal Date, Accounts.Health Band, Accounts.Risk Driver

## How did the race unfold lap by lap?

Simulated race data (fictional teams): per race, driver and lap, the position, gap to leader, lap time, tyre compound age and degradation, pit laps, track status and weather. Drives the race trace and the pit-strategy what-if. Filter to a race (Italian Grand Prix: light rain laps 31-37).

- **Measures:** Race Position, Gap to Leader, Lap Time, Tyre Age, Tyre Degradation, Pit Stops
- **By:** Races.Race Name, Drivers.Code, Drivers.Team, Drivers.Team Colour, Race Laps.Lap, Race Laps.Compound, Race Laps.Track Status, Race Laps.Weather

## How do win rate and deal size trend by quarter?

Closed won bookings, win rate and average deal size for every closed quarter 2024-Q1 to 2026-Q3, with bookings growth against the same quarter a year earlier (row comparison, offset 4 quarters).

- **Measures:** Closed Won Bookings, Win Rate, Average Deal Size, Closed Won Bookings
- **By:** Opportunities.Close Quarter

## How does this customer's payment behaviour compare with normal?

Daily payment count, value, alerts, value to new beneficiaries and to high-risk jurisdictions, 7 Jul - 5 Oct 2026, with a 7-day moving average of payment count as the behavioural baseline. Filter to the customer under review.

- **Measures:** Payments, Payments, Payment Value, Alerts, New Beneficiary Value, High-Risk Country Value
- **By:** Payments.Txn Date

## How fast does each tyre compound degrade?

Degradation rate (seconds lost per lap of tyre age), average and best lap time, laps run and pit stops per race and compound - the governed inputs the pit-stop what-if uses to re-time a strategy (e.g. pit lap 19 instead of 22).

- **Measures:** Degradation Rate, Lap Time, Best Lap, Laps Completed, Pit Stops
- **By:** Races.Race Name, Race Laps.Compound

## How has the Q4 forecast moved week by week?

Q4 2026 weighted forecast per Monday snapshot (6 Jul - 5 Oct 2026) with the week-over-week change (row comparison) and a 4-week moving average.

- **Measures:** Snapshot Forecast, Snapshot Forecast, Snapshot Forecast
- **By:** Forecast Snapshots.Snapshot Date

## How is customer engagement trending?

Monthly active users, seat utilisation and AI Analyst questions, Oct 2025 - Sep 2026, with month-over-month user change and a 3-month moving average. Filter to an account for its usage line.

- **Measures:** Monthly Active Users, Monthly Active Users, Monthly Active Users, Seat Utilisation, AI Questions Asked
- **By:** Account Usage.Month

## Is channel efficiency improving or deteriorating?

Monthly spend, pipeline ROI and new ARR per $ by channel, Jan 2025 - Sep 2026, with year-over-year change in ARR per $ (row comparison along months, partitioned by channel) and a 3-month moving average of spend.

- **Measures:** Marketing Spend, Marketing Spend, Pipeline ROI, ARR per $ Spend, ARR per $ Spend
- **By:** Marketing Funnel.Month, Marketing Funnel.Channel

## Management P&L YTD vs budget and last year

Explorable financial statement: every line L1 > L2 > L3 with Actual, Budget, variance and the same months last year, Jan-Sep 2026. Revenue positive, costs negative; EBITDA is the sum of all lines.

- **Measures:** BQ actual, BQ budget, ?, BQ lastYear, BQ yoy
- **By:** P&L Lines.L1, P&L Lines.L2, P&L Lines.L3, BQ ytd

## Q4 forecast by region, team and rep

Q4 2026 weighted forecast, closed won, open pipeline and win rate per region > team > rep, with each rep's forecast rank inside their region.

- **Measures:** Q4 Forecast, Closed Won Bookings, Open Pipeline, Q4 Forecast
- **By:** Reps.Region, Reps.Team, Reps.Rep Name

## What changed in the Q4 forecast since last Monday?

Forecast bridge from the 28 Sep to the 5 Oct 2026 snapshot: slipped deals, stage regressions, losses, amount cuts, new pipeline and wins. Feeds the waterfall.

- **Measures:** Forecast Movement, Opportunity Count
- **By:** Forecast Bridge.Change Sort, Forecast Bridge.Change Type

## What changed in the business this month?

Executive pulse: monthly revenue, gross margin %, EBITDA, EBITDA margin and payroll, Jan 2025 - Sep 2026, with month-over-month change for each (row comparisons). The briefing ranks the largest moves and links each to its app (forecast, P&L, customers, workforce, fraud).

- **Measures:** Revenue, Revenue, Revenue, Gross Margin %, Gross Margin %, EBITDA, EBITDA Margin %, EBITDA Margin %, Payroll Cost
- **By:** P&L.Month

## What happened in the customer's journey?

Chronological customer journey events with category, impact and ARR effect. Filter to an account (e.g. Meridian Logistics) for its timeline.

- **Measures:** Event ARR Impact
- **By:** Account Events.Event Date, Account Events.Event Category, Account Events.Event Type, Account Events.Title, Account Events.Impact

## Where are we going to have a staffing problem?

Demand vs capacity utilisation and capacity gap (hours) per month, department and region, Jan 2025 actuals through the Mar 2027 forecast, with a 3-month moving average of utilisation. Customer Support EMEA crosses 120% in Q1 2027.

- **Measures:** Utilisation, Utilisation, Capacity Gap Hours, Overtime Hours
- **By:** Workforce.Month, Workforce.Department, Workforce.Region, Workforce.Data Type

## Where is stock sitting in the wrong store?

Stock on hand, 4-week weekly velocity and days of cover per store (with map coordinates) and product, plus the recommended transfers in and out. Select a product (e.g. Stride Velocity 4) to see London at ~11 days of cover and Manchester at 37+.

- **Measures:** Stock on Hand, Weekly Velocity (4w), Days of Cover, Stock on Order
- **By:** Retail Stores.Store Name, Retail Stores.Region, Retail Stores.Lat, Retail Stores.Lon, Retail Stores.Format

## Which acquisition channels and cohorts have the best unit economics?

Per acquisition channel and cohort year: customers acquired, current ARR, ARR growth, acquisition cost, CAC payback (months), account gross margin and health, with each channel's share of current ARR.

- **Measures:** Active Customers, Current ARR, ARR Growth YoY, Customer Acquisition Cost, CAC Payback Months, Account Gross Margin %, Health Score, Current ARR
- **By:** Accounts.Acquisition Channel, Accounts.Cohort Year

## Which customer cohorts compound and which decay?

Cohort curves: ARR of each signing-year cohort by months since first contract, with the cohort's own starting ARR (series first value) alongside so net dollar retention = ARR / starting ARR.

- **Measures:** Ending ARR, Ending ARR
- **By:** Accounts.Cohort Year, ARR Monthly.Months Since Start

## Which customers are over-discounted against their peers?

Active customers with ARR, effective discount, gross margin and churn risk, the segment median discount (percentile) and each account's gap to it, plus the ARR and gross profit a Price Uplift % parameter would add. Feeds the discount x margin scatter.

- **Measures:** Current ARR, Effective Discount %, Effective Discount %, ?, Account Gross Margin %, Health Score, ARR after Uplift, Gross Profit Uplift
- **By:** Accounts.Segment, Accounts.Account Name, Accounts.Health Band

## Which deals can close the Q4 gap?

Open Q4 2026 Best Case and Pipeline opportunities ranked by recovery score. The app accumulates amounts down the list to show where recoverable pipeline passes the $1.29m gap.

- **Measures:** Recovery Score, Opportunity Amount, Win Probability, Avg Engagement Score, Avg Days in Stage
- **By:** Opportunities.Opp Name, Opportunities.Opp ID, Reps.Rep Name, Opportunities.Stage, Opportunities.Next Step

## Which entities are ahead or behind budget?

Revenue, constant-currency revenue, gross margin % and EBITDA per entity against budget, Jan-Sep 2026, with FX impact and each entity's share of total revenue.

- **Measures:** Revenue, Revenue Budget, ?, Revenue Constant Currency, ?, Gross Margin %, EBITDA, EBITDA Budget, ?, Revenue
- **By:** P&L.Entity

## Which features is the customer adopting or abandoning?

Feature adoption (users / licensed seats) per feature and month, Oct 2025 - Sep 2026, with the change against three months earlier. Filter to one account for the adoption heatmap.

- **Measures:** Feature Adoption %, Feature Adoption %
- **By:** Feature Adoption.Feature Sort, Feature Adoption.Feature, Feature Adoption.Month

## Which fraud cases need review first?

Open Harbourline Bank cases (awaiting review, in review, escalated) with customer, score, priority, primary reason, velocity change, new beneficiaries, largest payment, amount at risk and SLA due date, highest score first. Meridian Trading Ltd (score 87, £312k at risk) tops the queue.

- **Measures:** Case Score, Amount at Risk, Velocity Change, New Beneficiaries, Largest Payment
- **By:** Fraud Cases.Case ID, Bank Customers.Customer Name, Bank Customers.Sector, Fraud Cases.Priority, Fraud Cases.Status, Fraud Cases.Primary Reason, Fraud Cases.Assigned Analyst, Fraud Cases.Sla Due Date

## Which marketing channels convert spend into ARR?

2026 YTD spend, leads, MQLs, SQLs, opportunities, pipeline, wins and new ARR per channel, with CAC, pipeline ROI, MQL-to-SQL and opportunity win rates and each channel's share of spend.

- **Measures:** Marketing Spend, Marketing Spend, Leads, MQLs, SQLs, Marketing Opportunities, Pipeline Created, Marketing Deals Won, Marketing New ARR, Blended CAC, Pipeline ROI, ARR per $ Spend, MQL to SQL Rate, Opportunity Win Rate
- **By:** Marketing Funnel.Channel

## Which products are selling, earning and running out?

Kestrel Running catalogue by product: net sales, units, gross margin %, markdown rate, average selling price, 4-week weekly velocity, stock on hand and days of cover, with each product's rank by net sales within its category. Drives the product-card grid.

- **Measures:** Net Sales, Units Sold, Retail Gross Margin %, Markdown Rate, Average Selling Price, Net Sales
- **By:** Retail Products.Category, Retail Products.Product Name, Retail Products.Brand, Retail Products.Lifecycle, Retail Products.Image Key

## Which teams are under-hired, over-worked or losing people?

Jan-Sep 2026 actuals per department and location: headcount vs budget (Sep), open reqs, annualised attrition, overtime, contractor spend and payroll vs budget, ranked by attrition within department.

- **Measures:** Annualised Attrition, Annualised Attrition, Leavers, Hires, Overtime Hours, Contractor Spend, Payroll vs Budget, Utilisation
- **By:** Workforce.Department, Workforce.Location

## Why are we ahead of EBITDA budget despite missing revenue?

Budget EBITDA to actual EBITDA, Jan-Sep 2026, decomposed into subscription volume, subscription price, usage & services, FX, payroll, cloud, services delivery, marketing and other opex.

- **Measures:** Bridge Amount
- **By:** EBITDA Bridge.Driver Sort, EBITDA Bridge.Driver

## Why did German gross margin deteriorate despite revenue growth?

Velmora GmbH monthly revenue, gross margin % and services subcontractor cost, Jan 2025 - Sep 2026, with gross margin change against the same month last year (row comparison, offset 12).

- **Measures:** Revenue, Gross Margin %, Gross Margin %, Subcontractor Cost
- **By:** P&L.Month

## Why was this case flagged?

Explainable score breakdown per case: velocity, new beneficiaries, large transaction, peer-cohort deviation, country risk and KYC profile, with the points each contributes and its share of the case total. Filter to one case.

- **Measures:** Score Points, Score Points
- **By:** Case Reasons.Case ID, Case Reasons.Reason Sort, Case Reasons.Reason, Case Reasons.Detail

## Will we hit Q4? Forecast vs target by region

Weighted Q4 2026 forecast at the latest Monday snapshot against each region's bookings target, with the gap and attainment. Hero KPI strip of the Revenue Command Center.

- **Measures:** Q4 Forecast, Q4 Bookings Target, ?, ?
- **By:** Sales Regions.Region Name
