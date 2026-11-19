# Hotel demand × weather

An Astrato App that puts governed hotel demand next to real weather from a public API, joins the two
in the browser, and lets a revenue manager decide whether a **wet-night offer** is worth running.

- **Semantic layer:** Harbourline Hotels, `00000000-0000-0000-0000-000000000000`
  (published revision 16). The hotels and their demand are fictional (synthetic); the weather is real.
- **Weather:** the [Open-Meteo historical archive](https://open-meteo.com/), read by DuckDB-WASM in the
  page. It has no key and answers with CORS `*`.

## Who it is for and what they decide

The reader is a **hotel revenue manager** for twelve city hotels. The question is whether rain moves
demand enough to justify a discounted **wet-night offer**, and if so in which cities.

1. **Weather & demand.** The headline states the finding: how full the hotels were against last autumn,
   and how wet nights compared with dry ones. KPI cards, governed charts, the weather and the blend
   all follow one selection.
2. **Wet-night offer.** A governed what-if: the layer computes the scenario, the reader sets its three
   parameters, and baseline and scenario sit side by side, with a bridge and the gain by city. Then
   the one recorded action: flag a city-week for the offer, for a general manager to approve.
3. **Queries.** Every statement both engines ran. Right-click any card for the SQL behind it.

## Three sources, one selection

| Tag | Where it runs | Objects |
| --- | --- | --- |
| Governed | Astrato engine on the warehouse | Occupancy and revenue KPIs and mini charts, revenue by city, nightly occupancy, the city table, and every object on the offer tab |
| API | DuckDB-WASM in the page, on the Open-Meteo archive | Average high and wet city-days KPIs, the temperature line |
| Blended | DuckDB-WASM: governed rows joined to the weather | Wet-vs-dry KPI and mini chart, occupancy on dry and wet nights, occupancy by temperature band |

All objects are native Astrato objects. The API and blended ones run on a second visualization
runtime whose engine answers from DuckDB (`src/duck-engine.js`) but whose selection service is the
app's own. Governed objects read the same service through a scope that hides the browser-only weather
keys (`src/selection-scope.js`), so a temperature-band click never reaches them.

Selections come from the City filter, a click on a bar or a table row, a drag along the occupancy
chart's date axis, or a click on a weather band. Every chip has its own ×, and **Clear all** empties
the bar. **Read-only by design:** the KPI mini charts and the API temperature line take no clicks or
drags (a drag on the API date axis selected every night); this is said in the header and on the card.

## Stored questions behind the objects

| Object | Stored question (layer) |
| --- | --- |
| Occupancy KPI | What was occupancy this autumn against last? |
| Revenue KPI | What did rooms earn this autumn against last? |
| Occupancy mini chart, nightly occupancy chart | How full were the hotels night by night this autumn? |
| Revenue mini chart | How much did rooms earn night by night this autumn? |
| Revenue by city | Which cities earn the most room revenue this autumn? |
| City table (with share of revenue) | How does each city compare with last autumn, and what share of revenue does it carry? |
| Baseline and scenario numbers | What would a wet-night offer add to this autumn's room revenue? |
| Bridge (waterfall) | What would the wet-night offer's extra nights earn, and what would its discount cost? |
| Gain by city | Which cities would gain most from a wet-night offer? |
| The blend's governed rows | How full was each city night by night, this autumn and last? |

`Where does each city rank on this autumn's room revenue?` (rank and share) is also stored for MCP
and workbook use. The API objects have no stored question: their data never reaches the warehouse.
The blended objects are built on the governed rows of the stored question above, which the
right-click SQL shows.

## The what-if: governed, through layer parameters

Four measures added to the layer carry three parameters:

| Parameter | Lever | Default |
| --- | --- | --- |
| `wet_share` | Share of nights that are wet | What the weather shows for the selection (API), editable |
| `occ_uplift_pts` | Occupancy uplift on wet nights | 6 pts |
| `rate_discount_pct` | Rate discount on wet nights | 5% |

- `Wet-Night Offer Revenue Change L3M` = wet_share × (1 − discount) × rooms available × uplift × ADR
  − wet_share × room revenue × discount. The first term is `Wet-Night Offer Extra Nights Revenue L3M`,
  the second `Wet-Night Offer Discount Cost L3M` (the bridge).
- `Room Revenue L3M Wet-Night Offer` and `Occupancy L3M Wet-Night Offer` are the scenario values.
- The baseline (`Room Revenue L3M`, `Occupancy L3M`) is the governed figure as booked. At zero uplift
  and zero discount the scenario equals the baseline, and the app checks that.

The sliders set the parameters on the native objects (`setMeasureDefinedParameter`), so every
scenario number is a governed query. The verdict line reads the governed figures from those objects;
its percentage (change ÷ baseline) is the one ratio the app writes itself, because the layer has no
single measure for it at that grain.

## The action: flag a city-week (labelled fallback)

A revenue manager (Alex Reed) flags a city-week for the offer at the levers on screen, with the
governed estimate for that city. A general manager (Sam Ortiz) approves or rejects it.
**Maker–checker:** the proposer can never decide their own flag; the attempt is refused and recorded.
Every action, refused ones included, goes to the audit trail; **Reset demo** clears both.

**This is a browser-only demo workflow.** Flags and the trail are kept in this browser
(`localStorage`); viewers of this example cannot write to the warehouse, and nothing is sent to Astrato or
Snowflake. The card says so. In production the same records would be writeback rows in governed
views (the layer already has `Action Events` and `Scenarios` writeback views for that).

## Time and comparisons

- This autumn is Aug–Oct 2026 and last autumn Aug–Oct 2025 (the layer's `L3M` and `L3M LY`), both
  complete. Occupancy is a ratio, never summed.
- A date selection has no like-for-like nights last autumn, so **every** comparison comes off: the
  KPI cards, the headline and the table's two change columns (hidden), and the Excel report.

## What stays in the browser, and why

The weather is public API data that never reaches the warehouse, so its rain and temperature bands,
the wet/dry flags, the 7-night moving average and the weather comparisons are DuckDB SQL in
`src/duck-engine.js` and `src/duck.js`. Moving them into the layer would mean loading the weather
into the warehouse, which this example app does not do. Every figure about demand, and every what-if
figure, comes from the layer.

## Excel report

Eight formatted sheets: Summary, Cities, Weather, Blend, Nights, What-if (baseline against scenario
at the current levers, and the gain by city), Offers (flags and audit trail) and Notes. The export
reads the applied selections once and queries every sheet under them, whichever tab is on screen:
the offer tab's group is synced from the main group and its levers applied before its objects are
read. City and Stay Date filter every sheet but Offers (the browser-only flag store) and Notes.
Weather-band selections filter the Weather, Blend and Nights sheets and the API and blended Summary
rows only; the governed sheets ignore them, and the Summary and What-if banners say so.
`buildReport()` in `src/app.js` returns the workbook and the button downloads it; it is registered
with `appState.exportProbe` (City = Boston, Offers and Notes exempt) so the kit smoke test checks
that every other sheet changes under a filter.

## Run it

```sh
npm install
npx --yes @astrato-io/cli@0.2.0 --host https://<your-astrato-host> dev . --no-open
```

The CLI prints a sign-in URL for the local app. Checks:

```sh
npm run compile-check
node ../../../kit/verify/smoke.mjs "<sign-in URL>" --out shots --widths 1440,1280,1024 --profile <a folder OUTSIDE this app>
```

Keep the smoke test's Chrome profile outside this folder. Vite watches the app folder and ignores only
`shots/`, `judge/`, `tools/`, logs and Markdown; a profile written anywhere else here reloads the page.

### The app's own checks (run by the smoke test, never writing anything)

Selections are made the way a reader makes them: a click on a table row, a chip or a button, a tab, a
slider moved with input events. A selection that only a canvas chart can make (a band, a date range)
is written as that chart writes it, as a pending selection, and the app's own auto-apply applies it.

1. A Boston row click moves governed, API and blended objects; Clear all restores them.
2. A temperature band moves the API and blended objects and leaves the governed ones untouched.
3. Two chips, then the band chip clicked away: every object stays rendered, the table keeps Boston.
4. A date range and the first night: no comparison with last autumn anywhere.
5. An empty date list (a drag that ends off the data) is dropped and never sent.
6. The blended KPI equals an independent JavaScript join.
7. A Napa row click: queries within budget, settled under 3 s, a repeat answered from the caches.
8. An empty combination empties the weather objects and says so.
9. What-if: sliders move the governed scenario; no uplift and no discount give the baseline.
10. Workflow, in a sandbox (nothing kept): flag, refused self-approval, approval, trail, reset.
11. No refused query and no object failing after landing.
12. Excel with Boston selected: the workbook has the eight sheets and Boston's governed figures.
