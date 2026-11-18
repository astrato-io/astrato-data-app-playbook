# Business questions — UK University Rankings 2027

40 stored questions. Full definitions are under `businessQuestions` in [layer.json](layer.json).
Build every chart from one of these (or add one) rather than composing ad-hoc queries in the app.

## Biggest climbers

Top 10 universities by places gained vs 2026.

- **Measures:** Rank Change (value), Rank (value)
- **By:** University (Short)

## Biggest fallers

Top 10 universities by places lost vs 2026.

- **Measures:** Rank Change (value), Rank (value)
- **By:** University (Short)

## Does each university's research quality track its total score?

One point per university: Research Quality % against 2027 total score.

- **Measures:** Avg Research, Avg Total Score
- **By:** University (Short)

## Does research quality track the total score?

- **Measures:** Avg Research, Avg Total Score
- **By:** University (Short), Rank Band

## How did our rivals move this year?

Universities in the selection by movement since 2026.

- **Measures:** Universities
- **By:** Movement

## How do university groups compare?

Average quality metrics by university group.

- **Measures:** Universities, Avg Total Score, Avg Teaching, Avg Experience, Avg Research, Avg Entry Points, Avg Graduate Prospects, Avg Firsts, Avg Continuation
- **By:** University Group

## How far is each rank band behind the band above?

Band average minus the average of the band above it, per measure (inter-record diff). Negative = behind.

- **Measures:** Avg Research, Avg Entry Points, Avg Graduate Prospects, Avg Firsts, Avg Teaching, Avg Experience
- **By:** Rank Band

## How far is each rival from the rivals' average on entry standards?

- **Measures:** Avg Entry Points
- **By:** University (Short)

## How far is each rival from the rivals' average on graduate prospects?

Graduate Prospects % minus the average of the universities in the selection (points), from the stored measure Prospects vs Set Average. Positive = ahead.

- **Measures:** Prospects vs Set Average
- **By:** University (Short)

## How far is each rival from the rivals' average on research quality?

- **Measures:** Avg Research
- **By:** University (Short)

## How far is each rival from the rivals' average on student experience?

Student Experience % minus the average of the universities in the selection (points), from the stored measure Experience vs Set Average. Positive = ahead.

- **Measures:** Experience vs Set Average
- **By:** University (Short)

## How has each university's rank moved by edition?

Overall rank per edition (sparkline source).

- **Measures:** Historic Rank
- **By:** History University (Short), Edition

## How has our rank moved by edition?

Overall rank in each edition (2025-2027). The app narrows it to the chosen university. Lower is better.

- **Measures:** Historic Rank
- **By:** Edition

## How has the rival set's average rank moved by edition?

Average overall rank of the universities in the selection in each edition, with a two-edition moving average. Lower is better.

- **Measures:** Avg Historic Rank, Avg Historic Rank
- **By:** Edition

## How have our rivals' ranks moved since 2025?

- **Measures:** Rank in 2025 Edition, Rank in 2027 Edition, Places Gained Since 2025
- **By:** History University (Short)

## How many points of total score separate each rival from us?

Each university's 2027 Total Score minus ours (benchmark parameter, set by the app to the chosen university's score). Positive = scores above us.

- **Measures:** Score Gap to Benchmark
- **By:** University (Short)

## How many universities climbed, vs last year?

Universities that rose 2026 to 2027, against those that rose 2025 to 2026.

- **Measures:** Climbers, Climbers 2026, Climbers Change

## How many universities fell, vs last year?

Universities that fell 2026 to 2027, against those that fell 2025 to 2026.

- **Measures:** Fallers, Fallers 2026, Fallers Change

## How many universities sit in each rank band?

- **Measures:** Universities
- **By:** Rank Band

## How many universities would still score above us after the gain?

Universities whose 2027 Total Score is above our score plus the what-if gain (parameter score). Our projected rank is this plus one.

- **Measures:** Universities Scoring Above

## How many universities would still score above us?

Universities in the selection; the what-if narrows it to totals above our score plus the gain.

- **Measures:** Universities

## How many universities would we overtake?

Universities in the selection. The app narrows it to Total Score above ours and at most ours plus the gain.

- **Measures:** Universities

## Subject titles by university

Top 10 universities by number of subject tables topped (2027).

- **Measures:** Subject Titles, Top-10 Places
- **By:** Subject University (Short)

## Teaching vs research by university

Teaching quality against research quality for every university.

- **Measures:** Avg Teaching, Avg Research
- **By:** University (Short), University Group

## Top 10 rank history

Overall rank by edition for universities while in the top 10 (Historic Rank <= 10).

- **Measures:** Historic Rank
- **By:** Edition, History University (Short)

## Top 10 universities 2027

Overall top 10 of the 2027 table by rank, with total score.

- **Measures:** Rank (value), Avg Total Score
- **By:** University (Short)

## Universities by nation

Count of ranked universities per UK nation.

- **Measures:** Universities
- **By:** Nation

## What is the average rank in view, 2027 vs 2026?

Average overall rank of the universities in the current selection this year and last; places gained is positive when the group climbed.

- **Measures:** Avg Rank 2027, Avg Rank 2026, Avg Places Gained

## What rank would a higher total score buy us?

Projected overall rank at our 2027 Total Score plus the what-if gain (parameter score), against every university in the 2027 table.

- **Measures:** Projected Rank at Score

## Where did this year's climbers sit?

- **Measures:** Climbers
- **By:** Rank Band

## Where did this year's fallers sit?

- **Measures:** Fallers
- **By:** Rank Band

## Where do we rank this year, and how far have we moved?

2027 overall rank, places moved since 2026 (positive = climbed) and the 2026 rank. The app narrows it to the chosen university.

- **Measures:** Rank (value), Rank Change (value), Rank 2026 (value)

## Where does each rival rank on each measure?

Rank of each university within the selection on each component (1 = best).

- **Measures:** Rank (value), Avg Research, Avg Entry Points, Avg Graduate Prospects, Avg Firsts, Avg Continuation, Avg Experience, Avg Teaching
- **By:** University (Short)

## Which rivals have the highest entry standards?

- **Measures:** Avg Entry Points
- **By:** University (Short)

## Which rivals score highest on research quality?

- **Measures:** Avg Research
- **By:** University (Short)

## Which universities would we overtake?

League rows with rank, total score and the points they sit above us. The app narrows it to Total Score between our score and our score plus the gain.

- **Measures:** Avg Total Score, Score Gap to Benchmark, Rank Change (value)
- **By:** Rank 2027, University (Short)

## Who is ahead of the rival set on entry standards, and by how much?

Entry Standards (UCAS points) minus the average of the universities in the selection, from the stored measure Entry vs Set Average. Positive = ahead.

- **Measures:** Entry vs Set Average
- **By:** University (Short)

## Who is ahead of the rival set on research quality, and by how much?

Research Quality % minus the average of the universities in the selection (points), from the stored measure Research vs Set Average. Positive = ahead.

- **Measures:** Research vs Set Average
- **By:** University (Short)

## Who moved most among our rivals?

- **Measures:** Rank Change (value)
- **By:** University (Short)

## Who sits within 10 places of us, and how do they score?

League table rows; the app narrows it to the ranks around the chosen university.

- **Measures:** Rank 2026 (value), Rank Change (value), Avg Total Score, Avg Research, Avg Entry Points, Avg Graduate Prospects, Avg Experience, Avg Teaching
- **By:** Rank 2027, University
