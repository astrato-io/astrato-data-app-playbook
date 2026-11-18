# Business questions — Ski Resort Operations

32 stored questions. Full definitions are under `businessQuestions` in [layer.json](layer.json).
Build every chart from one of these (or add one) rather than composing ad-hoc queries in the app.

## Did the crowds grow with the snow?

Average Crowd Index (the only demand signal in the data) in 2025/26 against 2024/25.

- **Measures:** Crowd Index This Season, Crowd Index Last Season, Crowd Index Change vs Last Season

## Did the snowiest weeks draw the biggest crowds?

Average fresh snow and average Crowd Index by week of the season, both seasons. The crowd peaks sit on the holiday weeks (4 and 9), not on the snow peaks.

- **Measures:** Avg Weekly Snowfall, Avg Crowd Index
- **By:** Season Week

## Do crowds follow the snow once the weekly noise is smoothed out?

Three-week moving averages of fresh snow and Crowd Index by week of the season, both seasons.

- **Measures:** Avg Weekly Snowfall, Avg Crowd Index
- **By:** Season Week

## How busy are holiday and regular weeks?

- **Measures:** Avg Crowd Index
- **By:** Week Type

## How busy are the slopes at each level of fresh snow, in holiday and regular weeks?

- **Measures:** Avg Crowd Index
- **By:** Snowfall Band, Week Type

## How busy was each week of this season?

- **Measures:** Avg Crowd Index
- **By:** Season Week

## How deep was the snow base this season?

- **Measures:** Base Depth This Season, Base Depth Change vs Last Season

## How did each resort's season compare with last season?

- **Measures:** Overall Week Score This Season, Crowd Index This Season, Crowd Index Change vs Last Season, Snowfall Change vs Last Season, Quiet Powder Weeks This Season, Demand Headroom This Season
- **By:** Resort

## How did the snow base build through this season?

- **Measures:** Avg Base Depth
- **By:** Season Week

## How did week quality move through this season?

- **Measures:** Overall Week Score
- **By:** Season Week

## How does each resort score on snow, value, quiet, family and expert terrain?

- **Measures:** Avg Snow Score, Avg Value Score, Avg Quiet Score, Avg Family Score, Avg Expert Score, Avg Trip Cost
- **By:** Resort

## How many powder weeks went quiet this season?

Quiet Powder Weeks: regular resort-weeks with 40 cm+ fresh snow and a Crowd Index under 55. Fewer is better.

- **Measures:** Quiet Powder Weeks This Season, Quiet Powder Weeks Change vs Last Season

## How many resort-weeks reach each crowd level at each snowfall band?

- **Measures:** Resort Weeks
- **By:** Snowfall Band, Crowd Level

## How many target weeks does the campaign rule find this season, against last season?

What-if KPI: resort-weeks the campaign rule picks in 2025/26, against 2024/25 under the same rule.

- **Measures:** Target Weeks This Season, Target Weeks Last Season, Target Weeks Change vs Last Season

## How many target weeks does the campaign rule find?

- **Measures:** Target Weeks

## How much busier are holiday weeks than regular weeks?

- **Measures:** Holiday Crowd Uplift This Season, Holiday Crowd Uplift Change vs Last Season

## How much fresh snow fell each week of this season?

- **Measures:** Total Snowfall
- **By:** Season Week

## How much snow fell this season, against last season?

Total fresh snow in 2025/26 against 2024/25, on the Season Axis.

- **Measures:** Snowfall This Season, Snowfall Last Season, Snowfall Change vs Last Season

## How would next season's marketing budget split across resorts, against the default plan?

Scenario (Suggested Budget at the lever values) beside the baseline (the default plan: EUR 250k, 40 cm, Crowd Index 55).

- **Measures:** Suggested Budget at Default Rule, Suggested Budget
- **By:** Resort

## How would next season's marketing budget split across resorts?

- **Measures:** Suggested Budget, Target Weeks
- **By:** Resort

## In which part of the season did powder weeks go quiet?

- **Measures:** Quiet Powder Weeks
- **By:** Season Stage

## In which part of the season does the campaign rule find its target weeks?

- **Measures:** Target Weeks
- **By:** Season Stage

## In which part of the season should the budget land, against the default plan?

- **Measures:** Suggested Budget at Default Rule, Suggested Budget
- **By:** Season Stage

## In which part of the season should the budget land?

- **Measures:** Suggested Budget
- **By:** Season Stage

## Was the average week better for guests this season?

- **Measures:** Overall Week Score This Season, Overall Week Score Change vs Last Season

## Where is the snow better than the crowds it draws?

Demand Headroom (Avg Snow Score minus Avg Crowd Index) by resort. The biggest gaps have the most room for marketing.

- **Measures:** Demand Headroom
- **By:** Resort

## Which gateway airports serve the most quiet powder weeks?

- **Measures:** Quiet Powder Weeks
- **By:** Gateway Airport

## Which part of the season has the deepest base but the thinnest crowds?

- **Measures:** Avg Base Depth, Avg Crowd Index
- **By:** Season Stage

## Which resorts give guests the best weeks?

Overall Week Score by resort, both seasons, with its rank.

- **Measures:** Overall Week Score, Overall Week Score
- **By:** Resort

## Which resorts hold most of the quiet powder weeks?

- **Measures:** Quiet Powder Weeks, Share of Quiet Powder Weeks, Demand Headroom, Avg Trip Cost
- **By:** Resort, Gateway Airport

## Which weeks of the season are best at each resort?

- **Measures:** Overall Week Score
- **By:** Resort, Season Week

## Which were the ten best resort-weeks of this season?

- **Measures:** Overall Week Score, Avg Weekly Snowfall, Avg Crowd Index, Avg Trip Cost
- **By:** Resort, Week
