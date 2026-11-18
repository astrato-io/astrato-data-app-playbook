# ED Wait Watch

The ED operations lead's and duty managers' morning board for the 30-minute waiting-time target,
on the Astrato semantic layer **Hospital ER Operations** (`00000000-0000-0000-0000-000000000000`).
A hand-written Astrato App (Vite, vanilla JS, `@astrato-io/visualizations` 0.9.0,
`@astrato-io/app-runtime` 0.9.0, CLI 0.2.0 from public npm). Local build only: **not published**.

## What it answers

| Tab | Question | What is on it |
| --- | --- | --- |
| Morning board | Are we seeing patients within 30 minutes? | A headline built from stored measures ("44% of the 471 patients who arrived in 1–30 Oct 2020 were seen within 30 minutes, up 4.0 pts on 1–30 Sep 2020 — 56% still waited longer. Worst slot on record: Wed 06-09h"); down the left, four KPI cards (seen within 30 min with its change in **points**, average wait, satisfaction, visits), each with its change on the same days of the month before, coloured by whether the move is good, and a monthly mini line, then the flag counts; in the middle the weekday × arrival-band heat map (click a slot, hand it to an owner); on the right the monthly trend (bars, with a 3-month moving-average line; click a bar to select that month) and a **drivers bridge**: which departments drove the change in visits waiting over 30 minutes (now, before, change; the department changes add up to the total) |
| When | When do patients wait longer than 30 minutes? | Over-target visits by hour; share seen in time by weekday; an arrival-band table with rank, share of all over-target visits and a monthly trend column; a **what-if** on the target itself (15–45 min) through the layer's `Target Minutes` parameter, against a governed 30-minute baseline |
| Who | Which departments and patient groups wait longest? | Two KPI cards (seen within 30 min, average wait) for the selection; departments worst first; a department table with rank, share of over-target visits, wait, satisfaction and trend; age band, race and gender |
| Satisfaction | Does satisfaction fall as waits grow? | Two KPI cards (satisfaction, seen within 30 min) for the selection; satisfaction by 10-minute wait band; within vs over target; satisfaction (bars, click to select a month) and the target (line) month by month; a department table ranked by satisfaction with trend |
| Flags | What has been flagged, who owns it, what is overdue? | Raise a flag (a weekday / arrival-band slot or a department, what was seen, a named owner, a due date); act on a selected flag (start, resolve, reassign, sign off, reopen); owners of open flags; the flag list and the audit trail as native tables over the writeback views. **Practice mode** (the default, labelled "nothing saved") runs the same rules on flags kept in the browser tab, with its own audit trail, so the workflow can be tried without writing |

Every tab: a sticky selection bar (chips, ×, Clear all, hint), four dropdown filters (month,
department, arrival band, day; status and owner on Flags), an **Excel report** button (7 sheets:
Summary, When, Who, Satisfaction, Flags, Data, Definitions), all following the selections.

## How it is built

- **Every object is a native Astrato object on a stored business question** named as the card's
  question (37 questions, category "ED Wait Watch"). `src/catalogue.js` declares each tile once;
  `tools/questions.mjs` turns tiles into questions; `src/tiles.js` turns them into definitions.
  Text figures (headline, KPI captions, Excel) read stored measures directly.
- **Layer additions** (new items only; nothing existing was changed): `Seen Within Target %`
  (with a `Target Minutes` parameter), `Patients Over Target`, `Share of Over-Target Patients`,
  a `Review Month` time axis (latest month to date, read as of the latest day in the data) with
  This Month / Last Month / Change measures for within %, wait, satisfaction and visits, a
  `Wait Band` and a `Race Group` (short labels) dimension, two rank-basis measures, and the flag
  views, dimensions and measures. Revisions 27–32, all published; revision 33 added `Waited Over Target % This Month`, `Patients Change vs Last Month Guarded` (empty when the month before has no visits) and the flag-status question.
- **Flags** are written in Live mode by governed writeback (`app.writeback`) to two new tables in the
  layer's connection, a records table and an audit-events table (views "Er Wait Flags",
  "Er Wait Flag Events"), created with the user's approval. Rules (one function, `decide` in
  `src/workflow.js`, used by both modes): anyone raises; open flags are started, resolved or reassigned;
  only an ED operations lead signs off or reopens; **four eyes: nobody signs off a flag they raised or
  resolved** (the resolver is read from the audit trail); a note is required to resolve, reassign or
  reopen; every change is an audit event (who, role, action, before, after, note, when). Every action
  button is always shown and a refused one says why. "Acting as" switches between four demo personas
  (two duty managers, two leads); in production the role would come from the signed-in user's group.
- **Practice mode** (default): the labelled fallback. The same rules on flags kept in `sessionStorage`,
  a practice audit trail that also lists refused attempts, and "Reset practice". Nothing is written; the
  native flag tables do not change. The app's own workflow check drives it through the UI (raise → start →
  resolve without a note (refused) → resolve → self sign-off (refused, four eyes) → duty manager sign-off
  (refused) → another lead signs off → reset) and asserts that no writeback call was made.
- Selections: one app-wide state mirrored into the visible tab's groups only; KPI cards take every
  visit field except the month (their window is the Review Month axis, and the chip says so).
- Every tab is preloaded; a query lane with 429 back-off and a session cache wraps the engine. The
  headline's and KPI captions' own reads jump the queue, and on every selection change they switch to
  "Updating…" at once, so text never shows one selection's words beside another's numbers.
- **Month charts and clicks**: the board trend and the satisfaction trend are combo charts; clicking a bar
  selects that month for every other object, while the trend itself keeps every month (its group never
  takes the month filter). Lines in those combos are drawn for reading, not clicking: click the bar.
- **Layer additions (revisions 34–36, all published)**: `Arrival Day` (Mon … Sun, sorting Monday first;
  later days carry invisible zero-width spaces in front, so no "1 Mon" prefix shows), `Seen Within Target
  pts Change vs Last Month` (a points change, formatted "+4.0 pts"), the `Patients Over Target This Month /
  Last Month / Change vs Last Month` family for the drivers bridge, and five stored questions for the new
  or changed tiles. Nothing existing was edited.
- Checks registered for the smoke test put selections in the way a reader's click or dropdown does: a
  pending selection in the object's group, which the app applies. None writes to the warehouse.

## Run it

```sh
npm install
npx --yes @astrato-io/cli@0.2.0 --host <your Astrato host> dev . --no-open   # open the sign-in URL it prints
npm run compile-check                                 # 63/63 tiles, no session needed
node <playbook>/kit/verify/smoke.mjs "<sign-in URL>" --widths 1440,1280,1024 --out shots/run --profile <a folder outside this app>
astrato --host <your Astrato host> build .
```

`docs/data-brief.md` and `docs/brief.md` are the data brief and the brief; `docs/verification.md`
is the verification record. Techniques adapted from the labour-market-pulse example
(tile pipeline, field index, query lane, Excel writer, selection mirror) and kit (smoke, compile
check, app-state), credited in each file's header.

## Caveats

- **Data:** a demo extract, Apr 2019 – 30 Oct 2020 (31 Oct missing). Satisfaction is recorded
  for about 27% of visits. Small groups (Neurology, Renal; one slot in one month) swing a lot:
  the headline states how many visits it covers.
- **KPI cards follow a month selection**: the selected month (to its last day in the data) against
  the same days of the month before, by sending the KPI numbers that month plus the one before
  (the Review Month axis reads "this month" as the latest month left by the filters). Their mini
  lines keep every month. With no month selected, a selection whose latest visit falls before the
  latest month is still read as of that visit's month: the caption names the data's latest month.
- **The flags are not joined to visits**: visit filters do not narrow the flag views and vice versa.
- The headline's "56% waited longer" is the stored measure `Waited Over Target % This Month`.
- The flag counts are snapshots of the shared flag tables, so their cards carry a mini bar by status
  but no period comparison.
- Writeback works in local development. Hosted viewers may not be able to write (playbook
  knowledge, 2026-10/11): the panel then says "Browser-only … cannot be saved". Not tested hosted.
- Demo reset: the Flags panel offers to remove only the flags raised in this browser session (and
  their audit events), kept in `sessionStorage`; nobody else's flags are touched. The app's checks
  never write, so the reset was not exercised by them.
- The weekday dimension `Arrival Day` sorts by invisible zero-width spaces before the names; a filter search
  for "Wed" still matches. The Excel sheets strip them.
- The flag tables are shared and start empty; checks never write, so on the Flags tab a selection's effect
  on the flag objects is shown only by the filtered queries until someone raises flags live.
- A table column format applies to every column of the same measure (visualizations 0.9), so the
  rank columns use two separately named measures (`Seen Within 30 per 100 Visits`,
  `Satisfaction Rank Basis`).
