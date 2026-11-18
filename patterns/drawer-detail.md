# Record drawer

Clicking a record (a deal, an applicant, a company) opens a drawer or dialog with its facts, timeline and actions, instead of filtering the page.

## When

Whenever the user's next question is about one record rather than a slice.

## How

A chart click arrives as a pending selection. Remove or decline it, and open the drawer for the clicked value instead. Fill the drawer from governed queries filtered to that record, and put the workflow actions (approve, escalate, add note) in it.

## Examples

- revenue-war-room — click hand-off to the deal drawer: [app.js:523](../examples/revenue-war-room/project/src/app.js#L523)
- portfolio-os — the shared drawer: [core.js:94](../examples/portfolio-os/project/src/core.js#L94)
- lending-affordability — the applicant file as a modal dialog
