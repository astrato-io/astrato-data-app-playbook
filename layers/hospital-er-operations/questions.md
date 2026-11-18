# Business questions — Hospital ER Operations

37 stored questions. Full definitions are under `businessQuestions` in [layer.json](layer.json).
Build every chart from one of these (or add one) rather than composing ad-hoc queries in the app.

## Are patients seen within 30 minutes more satisfied?

Average satisfaction score of visits seen within 30 minutes against those that waited longer.

- **Measures:** Avg Satisfaction
- **By:** Wait Target

## At which hours of arrival do most patients wait over 30 minutes?

Visits that waited longer than 30 minutes, by hour of arrival (0-23).

- **Measures:** Patients Over Target
- **By:** Hour of Day

## Do satisfaction and the 30-minute target move together month by month?

Average satisfaction (left axis) and share seen within 30 minutes (right axis) by arrival month.

- **Measures:** Avg Satisfaction, Seen Within Target %
- **By:** Arrival Month

## Do some age groups wait longer than others?

Share of visits seen within 30 minutes by ten-year age band.

- **Measures:** Seen Within Target %
- **By:** Age Band

## Do some patient groups by race wait longer than others?

Share of visits seen within 30 minutes by self-reported race, worst first.

- **Measures:** Seen Within Target %
- **By:** Race Group

## Do women, men and non-conforming patients wait alike?

Share of visits seen within 30 minutes by gender. Non-Conforming covers only 24 visits.

- **Measures:** Seen Within Target %
- **By:** Gender

## How do the waiting-time flags split by status?

Flags raised by duty managers, by status (Open, In progress, Resolved, Closed): the mini bar beside the flag counts.

- **Measures:** Flags Raised
- **By:** Flag Status

## How does each department perform against the 30-minute target?

Each referral department: visits, visits over 30 minutes and their share of all over-target visits, share seen within 30 minutes and its rank (1 = worst), average wait and satisfaction, with the monthly trend of the share seen within 30 minutes.

- **Measures:** Seen Within 30 per 100 Visits, Patients, Patients Over Target, Share of Over-Target Patients, Seen Within Target %, Avg Wait Time, Avg Satisfaction, Seen Within Target %
- **By:** Department Referral

## How does each time band perform against the 30-minute target?

Each three-hour arrival band: visits, visits over 30 minutes and their share of all over-target visits, share seen within 30 minutes and its rank (1 = worst), average wait, with the monthly trend of the share seen within 30 minutes.

- **Measures:** Seen Within 30 per 100 Visits, Patients, Patients Over Target, Share of Over-Target Patients, Seen Within Target %, Avg Wait Time, Seen Within Target %
- **By:** Time Band

## How does satisfaction change with the time a patient waited?

Average satisfaction score (1-10) by minutes waited, in 10-minute bands. Only visits with a recorded score (about 27%) count.

- **Measures:** Avg Satisfaction
- **By:** Wait Band

## How has patient satisfaction moved month by month?

Satisfaction by arrival month, every month on record.

- **Measures:** Avg Satisfaction
- **By:** Arrival Month

## How has the average wait moved month by month?

Average wait by arrival month, every month on record.

- **Measures:** Avg Wait Time
- **By:** Arrival Month

## How has the share of patients seen within 30 minutes moved month by month?

Seen within 30 min by arrival month, every month on record.

- **Measures:** Seen Within Target %
- **By:** Arrival Month

## How long did patients wait on average this month?

Average wait: the latest month to date (the Review Month axis, read as of the latest day in the data), with its change on the same days of the month before.

- **Measures:** Avg Wait Time This Month, Avg Wait Time Change vs Last Month

## How many open flags are past their due date?

Open or in-progress flags whose due date is before today.

- **Measures:** Overdue Flags

## How many patients came to the ED each month?

Visits by arrival month, every month on record.

- **Measures:** Patients
- **By:** Arrival Month

## How many patients came to the ED this month?

Visits: the latest month to date (the Review Month axis, read as of the latest day in the data), with its change on the same days of the month before.

- **Measures:** Patients This Month, Patients Change vs Last Month

## How many patients would wait longer than a different waiting-time target?

Patients Over Target with its Target Minutes parameter set by the app (default 30).

- **Measures:** Patients Over Target

## How many resolved flags await the lead's sign-off?

Flags the owner marked Resolved that the ED operations lead has not yet closed.

- **Measures:** Flags Awaiting Sign-off

## How many waiting-time flags are still open?

Flags with status Open or In progress.

- **Measures:** Open Flags

## How satisfied were patients this month?

Satisfaction: the latest month to date (the Review Month axis, read as of the latest day in the data), with its change on the same days of the month before.

- **Measures:** Avg Satisfaction This Month, Avg Satisfaction Change vs Last Month

## Is the share of patients seen within 30 minutes improving?

Share of ER visits seen within 30 minutes, by arrival month, with its 3-month moving average.

- **Measures:** Seen Within Target %, Seen Within Target %
- **By:** Arrival Month

## On which weekdays are the fewest patients seen within 30 minutes?

Share of visits seen within 30 minutes by weekday of arrival.

- **Measures:** Seen Within Target %
- **By:** Arrival Day

## What has happened to each waiting-time flag, and who did it?

The audit trail: every change to a flag, who made it, in which role, the status before and after, and the note given.

- **Measures:** Flag Events
- **By:** Event Time, Event Flag ID, Event Action, Event Actor, Event Role, Event From Status, Event To Status, Event Note

## What share of patients are seen within 30 minutes?

Share of visits seen within the 30-minute target, the governed baseline for the target what-if.

- **Measures:** Seen Within Target %

## What share of patients were seen within 30 minutes this month, and how many points did it move?

Seen within 30 min: the latest month to date (the Review Month axis, read as of the latest day in the data), with its change in percentage points on the same days of the month before.

- **Measures:** Seen Within Target % This Month, Seen Within Target pts Change vs Last Month

## What share of patients were seen within 30 minutes this month?

Seen within 30 min: the latest month to date (the Review Month axis, read as of the latest day in the data), with its change on the same days of the month before.

- **Measures:** Seen Within Target % This Month, Seen Within Target % Change vs Last Month

## What share of patients would be seen within a different waiting-time target?

Seen Within Target % with its Target Minutes parameter set by the app (default 30).

- **Measures:** Seen Within Target %

## Which departments drove the change in visits waiting over 30 minutes since the month before?

A bridge of the month-on-month change: for each referral department, visits that waited over 30 minutes in the latest month to date and on the same days of the month before, and the change (the department changes add up to the total change), with the change in the share seen within 30 minutes in points and the monthly trend of over-30 visits.

- **Measures:** Patients Over Target Change vs Last Month, Patients Over Target This Month, Patients Over Target Last Month, Seen Within Target pts Change vs Last Month, Patients Over Target
- **By:** Department Referral

## Which departments drove this month's change in patients waiting over 30 minutes?

Drivers of the month-on-month change: for each referral department, visits that waited over 30 minutes in the latest month to date and on the same days of the month before, the change (the parts add up to the total change), the share seen within 30 minutes and its change in points, with the monthly trend of over-30 visits.

- **Measures:** Patients Over Target Change vs Last Month, Patients Over Target This Month, Patients Over Target Last Month, Seen Within Target % This Month, Seen Within Target pts Change vs Last Month, Patients Over Target
- **By:** Department Referral

## Which departments see the fewest patients within 30 minutes?

Share of visits seen within 30 minutes by the department the patient was referred on to ("None" = not referred), worst first.

- **Measures:** Seen Within Target %
- **By:** Department Referral

## Which departments' patients are least satisfied, and how long did they wait?

Each referral department: average satisfaction and its rank (1 = least satisfied), scores recorded, average wait and share seen within 30 minutes, with the monthly satisfaction trend.

- **Measures:** Satisfaction Rank Basis, Avg Satisfaction, CSAT Responses, Avg Wait Time, Seen Within Target %, Avg Satisfaction
- **By:** Department Referral

## Which waiting-time flags have been raised, who owns them and when are they due?

Every flag a duty manager raised: what it covers, the named owner, the due date and its status. Overdue = 1 when an open flag is past its due date.

- **Measures:** Overdue Flags
- **By:** Flag ID, Flag Status, Flag Department, Flag Weekday, Flag Time Band, Flag Issue, Flag Owner, Flag Due Date, Flag Raised By

## Which weekday and arrival slots miss the 30-minute target most?

Share of visits seen within 30 minutes for each weekday and three-hour arrival band. Darker is worse.

- **Measures:** Seen Within Target %
- **By:** Time Band, Arrival Day

## Which weekday and time slots miss the 30-minute target most?

Share of visits seen within 30 minutes for each weekday and three-hour arrival band. Darker is worse.

- **Measures:** Seen Within Target %
- **By:** Time Band, Weekday Short

## Which weekdays see the fewest patients within 30 minutes?

Share of visits seen within 30 minutes by weekday of arrival.

- **Measures:** Seen Within Target %
- **By:** Weekday Short

## Who owns the open waiting-time flags?

Open and in-progress flags by named owner.

- **Measures:** Open Flags
- **By:** Flag Owner
