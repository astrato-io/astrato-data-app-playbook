/**
 * Management report: a multi-tab, styled .xlsx built from governed queries of the
 * "Thessaloniki on the Move" semantic layer, scoped to the filters on screen.
 * In-cell bars (█) stand in for charts so every tab reads as a quick visual summary.
 *
 * Every query takes the filter bar's applied selections explicitly (filtersFor reads the main
 * group at call time), never a chapter's own group, so chapters that are off screen, whose groups
 * catch up only when scrolled to, export under the same filters as the one on screen.
 */
import { workbookBlob } from './xlsx.js';

const bar = (share, width = 30) => '█'.repeat(Math.max(0, Math.round(Math.min(1, share || 0) * width)));
const banner = (title, sub, width) => [
  { height: 34, cells: [{ v: 'ΘΕΣ/ΝΙΚΗ', s: 'brand' }, { v: title, s: 'title' }, ...Array(Math.max(0, width - 2)).fill({ v: '', s: 'band' })] },
  [null, { v: sub, s: 'subtitle' }],
  [],
];
const head = (labels) => labels.map((v) => ({ v, s: 'headl' }));
const SOURCE = 'Source: OSETH GTFS timetable (data.gov.gr, feed 14 Jul – 3 Aug 2026) → Snowflake ASTRATO_GALLERY.MOCK_DATA.TH_* → Astrato semantic layer “Thessaloniki on the Move”. Scheduled service, not ridership.';
const LIMITS = { lines: 1000, stops: 10000 };
/** A note row when a query came back at its row limit, so a cut list never passes as complete. */
const capNote = (rows, limit, what) => (rows.length >= limit ? [[], [{ v: `Only the first ${limit.toLocaleString('en-GB')} ${what} are listed: the query hit its row limit.`, s: 'note' }]] : []);
const num = (v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));
const strip = (s) => String(s ?? '').replace(/^\d\.\s*/, '');

/**
 * @param q          governed query helper: q({ dims: [[column, view]], measures, filters }) → row objects
 * @param filtersFor view → the on-screen filters that view can honour
 * @param scope      every applied filter in full (each sheet's subtitle names it)
 * @returns the workbook as a Blob; downloadReport saves it
 */
export const buildReport = async ({ q, filtersFor, views: { SV, LV, ST }, scope, period }) => {
  const fs = filtersFor(SV);
  const fst = filtersFor(ST);
  const fl = filtersFor(LV); // queries grouped by Lines columns ask for Lines' filters, as app.js does
  const [[t = {}], [s = {}], cats, lines, hours, dows, stops, bands] = await Promise.all([
    q({ measures: ['Active Lines', 'Trips per Day', 'Weekday Trips per Day', 'Sunday Retention', 'Vehicle Km per Day', 'Vehicle Hours per Day', 'Commercial Speed', 'Stop Calls per Day', 'Peak Share'], filters: fs, limit: 1 }),
    q({ measures: ['Stops', 'Frequent Stop Share', 'Underserved Stops', 'Underserved Share', 'Stops Without Sunday Bus', 'Avg Longest Gap'], filters: fst, limit: 1 }),
    q({ dims: [['Category', LV]], measures: ['Active Lines', 'Trips per Day', 'Share of Trips', 'Vehicle Km per Day', 'Commercial Speed', 'Sunday Retention'], filters: fl, limit: 10 }),
    q({ dims: [['Line', LV], ['Line Label', LV], ['Category', LV]], measures: ['Trips per Day', 'Weekday Trips per Day', 'Sunday Retention', 'Commercial Speed', 'Avg Trip Minutes', 'Vehicle Km per Day', 'Vehicle Hours per Day', 'Buses at 8am', 'AM Headway', 'First Bus', 'Last Bus'], filters: fl, limit: LIMITS.lines }),
    q({ dims: [['Hour Label', SV]], measures: ['Trips per Day', 'Vehicle Hours per Day'], filters: fs, limit: 30 }),
    q({ dims: [['Day Label', SV]], measures: ['Trips per Day'], filters: fs, limit: 10 }),
    q({ dims: [['Stop Label', ST], ['Stop Name', ST], ['Sector', ST], ['Dist Band', ST], ['Service Level', ST]], measures: ['Weekday Departures', 'Saturday Departures', 'Sunday Departures', 'Lines per Stop', 'Peak Buses per Hour', 'Longest Gap', 'Distance from Centre'], filters: fst, limit: LIMITS.stops }),
    q({ dims: [['Dist Band', ST]], measures: ['Stops', 'Frequent Stop Share', 'Underserved Share', 'Avg Longest Gap', 'Departures per Stop'], filters: fst, limit: 10 }),
  ]);
  const when = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const sub = `Timetable ${period} · filters: ${scope} · generated ${when}`;
  lines.sort((a, b) => num(b['Trips per Day']) - num(a['Trips per Day']));
  stops.sort((a, b) => num(b['Weekday Departures']) - num(a['Weekday Departures']));
  cats.sort((a, b) => num(b['Trips per Day']) - num(a['Trips per Day']));
  hours.sort((a, b) => String(a['Hour Label']).localeCompare(String(b['Hour Label'])));
  dows.sort((a, b) => String(a['Day Label']).localeCompare(String(b['Day Label'])));
  bands.sort((a, b) => String(a['Dist Band']).localeCompare(String(b['Dist Band'])));

  // ---- 1. Summary
  const kpis = [
    ['TRIPS A DAY', t['Trips per Day'], 'intK', 'Average service day'],
    ['BUS-KM A DAY', t['Vehicle Km per Day'], 'intK', 'Scheduled, in service'],
    ['ACTIVE LINES', t['Active Lines'], 'intK', 'With at least one trip'],
    ['STOPS', s.Stops, 'intK', `${Math.round(num(s['Frequent Stop Share']) * 100)}% frequent at AM peak`],
    ['AVG SPEED', t['Commercial Speed'], 'decK', 'km/h, bus-km ÷ bus-hours'],
    ['SUNDAY VS WEEKDAY', t['Sunday Retention'], 'pctK', 'Trips per Sunday ÷ per weekday'],
  ];
  const kpiRow = (pick) => [null, ...kpis.flatMap((k) => [pick(k), { v: '', s: pick(k).s }])];
  const slow = lines.filter((r) => num(r['Commercial Speed']) < 18);
  const slowVH = slow.reduce((a, r) => a + num(r['Vehicle Hours per Day']), 0);
  const peak = [...hours].sort((a, b) => num(b['Trips per Day']) - num(a['Trips per Day']))[0];
  const hub = stops[0];
  const bullets = [
    `The timetable schedules ${Math.round(num(t['Trips per Day'])).toLocaleString('en-GB')} trips and ${Math.round(num(t['Stop Calls per Day'])).toLocaleString('en-GB')} stop calls on an average day, ${Math.round(num(t['Vehicle Km per Day'])).toLocaleString('en-GB')} bus-km.`,
    cats[0] ? `${strip(cats[0].Category)} lines carry ${(num(cats[0]['Share of Trips']) * 100).toFixed(0)}% of trips at ${num(cats[0]['Commercial Speed']).toFixed(1)} km/h.` : null,
    peak ? `The busiest hour is ${peak['Hour Label']} with ${Math.round(num(peak['Trips per Day']))} trips leaving their first stop; ${(num(t['Peak Share']) * 100).toFixed(0)}% of trips run in the two peaks.` : null,
    `${(num(s['Frequent Stop Share']) * 100).toFixed(0)}% of stops see a bus at least every 10 minutes in the AM peak; ${Math.round(num(s['Underserved Stops'])).toLocaleString('en-GB')} (${(num(s['Underserved Share']) * 100).toFixed(0)}%) see fewer than 3 an hour.`,
    hub ? `Busiest stop: ${hub['Stop Label']} with ${Math.round(num(hub['Weekday Departures']))} weekday departures.` : null,
    `Lines slower than 18 km/h use ${Math.round(slowVH).toLocaleString('en-GB')} bus-hours a day (${((slowVH / (num(t['Vehicle Hours per Day']) || 1)) * 100).toFixed(0)}% of the fleet’s time): the case for bus priority.`,
  ].filter(Boolean);
  const maxCat = Math.max(...cats.map((r) => num(r['Trips per Day'])), 1);
  const kpiRows = [
    kpiRow(([l]) => ({ v: l, s: 'kpiLabel' })),
    { height: 30, cells: kpiRow(([, v, st]) => ({ v: num(v), s: st })) },
    kpiRow(([, , , n]) => ({ v: n, s: 'kpiNote' })),
  ];
  const bulletRows = bullets.map((x) => ({ height: 28, cells: [null, { v: `•  ${x}`, s: 'note' }] }));
  const catRows = cats.map((r) => [null, { v: strip(r.Category), s: 'text' }, { v: num(r['Trips per Day']), s: 'int' }, { v: num(r['Share of Trips']), s: 'pct' }, { v: num(r['Commercial Speed']), s: 'dec' }, { v: bar(num(r['Trips per Day']) / maxCat, 40), s: 'bar' }]);
  const summary = [
    ...banner('Thessaloniki on the Move · management report', sub, 13),
    [null, { v: 'Headline', s: 'section' }],
    [],
    ...kpiRows,
    [],
    [null, { v: 'What the timetable says', s: 'section' }],
    ...bulletRows,
    [],
    [null, { v: 'Trips a day by line category', s: 'section' }],
    [null, ...head(['Category', 'Trips/day', 'Share', 'Speed km/h', '']), ...Array(8).fill(null)],
    ...catRows,
    [],
    [null, { v: SOURCE, s: 'note' }],
  ];
  // Merge ranges from the rows' own positions (1-based), so they move with the layout.
  const at = (row) => summary.indexOf(row) + 1;
  const summarySheet = {
    name: 'Summary', tab: 'FF10263F', cols: [3, 14, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13, 13],
    rows: summary,
    merges: [
      ...kpis.flatMap((_, i) => { const c1 = String.fromCharCode(66 + i * 2); const c2 = String.fromCharCode(67 + i * 2); return kpiRows.map((row) => `${c1}${at(row)}:${c2}${at(row)}`); }),
      ...bulletRows.map((row) => `B${at(row)}:M${at(row)}`),
      ...catRows.map((row) => `F${at(row)}:M${at(row)}`),
      `B${summary.length}:M${summary.length}`,
    ],
    freeze: { row: 4, col: 0 },
  };

  // ---- 2. Lines
  const maxTrips = Math.max(...lines.map((r) => num(r['Trips per Day'])), 1);
  const linesSheet = {
    name: 'Lines', tab: 'FF1F6F9F', cols: [8, 46, 12, 11, 11, 11, 10, 10, 11, 11, 10, 9, 9, 9, 24],
    rows: [
      ...banner('Every line, ranked by trips a day', sub, 15),
      head(['Line', 'Route', 'Category', 'Trips/day', 'Weekday', 'Sun vs wkday', 'Speed', 'Trip min', 'Bus-km/day', 'Bus-h/day', 'Buses 08:00', 'AM every', 'First', 'Last', 'Trips']),
      ...lines.map((r) => [
        { v: r.Line, s: 'bold' }, { v: String(r['Line Label']).split(' · ').slice(1).join(' · '), s: 'text' }, { v: strip(r.Category), s: 'text' },
        { v: num(r['Trips per Day']), s: 'int' }, { v: num(r['Weekday Trips per Day']), s: 'int' }, { v: num(r['Sunday Retention']), s: 'pct' },
        { v: num(r['Commercial Speed']), s: 'dec' }, { v: num(r['Avg Trip Minutes']), s: 'int' }, { v: num(r['Vehicle Km per Day']), s: 'int' }, { v: num(r['Vehicle Hours per Day']), s: 'dec' },
        { v: num(r['Buses at 8am']), s: 'int' }, { v: num(r['AM Headway']), s: 'int' }, { v: r['First Bus'] ?? '', s: 'text' }, { v: r['Last Bus'] ?? '', s: 'text' },
        { v: bar(num(r['Trips per Day']) / maxTrips, 24), s: 'bar' },
      ]),
      ...capNote(lines, LIMITS.lines, 'lines'),
    ],
    merges: [], freeze: { row: 4, col: 2 },
  };

  // ---- 3. Daily rhythm
  const maxHour = Math.max(...hours.map((r) => num(r['Trips per Day'])), 1);
  const maxDow = Math.max(...dows.map((r) => num(r['Trips per Day'])), 1);
  const rhythmSheet = {
    name: 'Daily rhythm', tab: 'FFF2B33D', cols: [10, 12, 12, 40, 4, 10, 12, 40],
    rows: [
      ...banner('When the city moves', sub, 8),
      [...head(['Hour', 'Trips/day', 'Bus-h/day', '']), null, ...head(['Day', 'Trips/day', ''])],
      ...Array.from({ length: Math.max(hours.length, dows.length) }, (_, i) => {
        const h = hours[i];
        const d = dows[i];
        return [
          ...(h ? [{ v: h['Hour Label'], s: 'text' }, { v: num(h['Trips per Day']), s: 'int' }, { v: num(h['Vehicle Hours per Day']), s: 'dec' }, { v: bar(num(h['Trips per Day']) / maxHour, 36), s: 'bar' }] : [null, null, null, null]),
          null,
          ...(d ? [{ v: String(d['Day Label']).slice(2), s: 'text' }, { v: num(d['Trips per Day']), s: 'int' }, { v: bar(num(d['Trips per Day']) / maxDow, 36), s: 'barv' }] : []),
        ];
      }),
    ],
    merges: [], freeze: { row: 4, col: 0 },
  };

  // ---- 4. Access by distance
  const accessSheet = {
    name: 'Access', tab: 'FF2BB3C0', cols: [26, 10, 13, 13, 13, 14, 36],
    rows: [
      ...banner('Is there a frequent bus near you? — by distance from Aristotelous Square', sub, 7),
      head(['Distance band', 'Stops', 'Frequent', 'Underserved', 'Longest wait', 'Departures/stop', 'Frequent share']),
      ...bands.map((r) => [{ v: strip(r['Dist Band']), s: 'bold' }, { v: num(r.Stops), s: 'int' }, { v: num(r['Frequent Stop Share']), s: 'pct' }, { v: num(r['Underserved Share']), s: 'pct' }, { v: num(r['Avg Longest Gap']), s: 'int' }, { v: num(r['Departures per Stop']), s: 'int' }, { v: bar(num(r['Frequent Stop Share']), 30), s: 'bar' }]),
      [],
      [{ v: 'Frequent = 6+ buses an hour at the stop, weekday 07–10, all lines. Underserved = served, but fewer than 3 an hour. Longest wait = worst gap between departures 07–20 on the reference weekday (Tue 21 Jul 2026).', s: 'note' }],
    ],
    merges: ['A' + (bands.length + 6) + ':G' + (bands.length + 6)], freeze: { row: 4, col: 0 },
  };

  // ---- 5. Opportunities
  const gaps = stops.filter((r) => /Low/.test(r['Service Level']) && /^[123]\./.test(r['Dist Band'])).sort((a, b) => num(b['Longest Gap']) - num(a['Longest Gap'])).slice(0, 60);
  const slowRanked = [...slow].sort((a, b) => num(b['Vehicle Hours per Day']) - num(a['Vehicle Hours per Day'])).slice(0, 30);
  const oppSheet = {
    name: 'Opportunities', tab: 'FFE0583A', cols: [46, 16, 12, 12, 12, 4, 46, 12, 12, 12],
    rows: [
      ...banner('Where improvement pays back fastest', sub, 10),
      [{ v: 'Underserved stops within 10 km of the centre', s: 'section' }, null, null, null, null, null, { v: 'Busy, slow lines (under 18 km/h)', s: 'section' }],
      [...head(['Stop', 'Sector', 'Longest wait', 'Buses/h AM', 'Departures']), null, ...head(['Line', 'Speed', 'Bus-h/day', 'Trips/day'])],
      ...Array.from({ length: Math.max(gaps.length, slowRanked.length) }, (_, i) => {
        const g = gaps[i];
        const l = slowRanked[i];
        return [
          ...(g ? [{ v: g['Stop Label'], s: 'text' }, { v: g.Sector, s: 'text' }, { v: num(g['Longest Gap']), s: 'int' }, { v: num(g['Peak Buses per Hour']), s: 'dec' }, { v: num(g['Weekday Departures']), s: 'int' }] : [null, null, null, null, null]),
          null,
          ...(l ? [{ v: l['Line Label'], s: 'text' }, { v: num(l['Commercial Speed']), s: 'dec' }, { v: num(l['Vehicle Hours per Day']), s: 'int' }, { v: num(l['Trips per Day']), s: 'int' }] : []),
        ];
      }),
      ...capNote(stops, LIMITS.stops, 'stops (underserved stops are picked from them)'),
      ...capNote(lines, LIMITS.lines, 'lines (slow lines are picked from them)'),
    ],
    merges: [], freeze: { row: 5, col: 0 },
  };

  // ---- 6. Stops (raw)
  const stopsSheet = {
    name: 'Stops', tab: 'FF6C4A7E', cols: [40, 34, 12, 22, 20, 11, 11, 11, 8, 11, 11, 10],
    rows: [
      ...banner('Every stop, reference days Tue 21 / Sat 25 / Sun 26 Jul 2026', sub, 12),
      head(['Stop', 'Greek name', 'Sector', 'Distance band', 'Service level', 'Weekday', 'Saturday', 'Sunday', 'Lines', 'Buses/h AM', 'Longest wait', 'km out']),
      ...stops.map((r) => [
        { v: r['Stop Label'], s: 'text' }, { v: r['Stop Name'], s: 'text' }, { v: r.Sector, s: 'text' }, { v: strip(r['Dist Band']), s: 'text' }, { v: strip(r['Service Level']), s: 'text' },
        { v: num(r['Weekday Departures']), s: 'int' }, { v: num(r['Saturday Departures']), s: 'int' }, { v: num(r['Sunday Departures']), s: 'int' }, { v: num(r['Lines per Stop']), s: 'int' },
        { v: num(r['Peak Buses per Hour']), s: 'dec' }, { v: num(r['Longest Gap']), s: 'int' }, { v: num(r['Distance from Centre']), s: 'dec' },
      ]),
      ...capNote(stops, LIMITS.stops, 'stops'),
    ],
    merges: [], freeze: { row: 4, col: 1 },
  };

  // ---- 7. Definitions
  const defs = {
    name: 'Definitions', tab: 'FF767676', cols: [30, 110],
    rows: [
      ...banner('Definitions', 'Every number in this report is a governed measure of the “Thessaloniki on the Move” semantic layer.', 2),
      head(['Measure', 'Definition']),
      ...[
        ['Trips per day', 'SUM(trips) ÷ COUNT DISTINCT(service date) — a ratio of aggregates over the days in scope.'],
        ['Bus-km / bus-hours', 'Shape length of each trip, and first-to-last-stop time, summed over scheduled trips.'],
        ['Speed (commercial)', 'Bus-km ÷ bus-hours, scheduled; includes dwell time at stops.'],
        ['Sunday vs weekday', 'Trips per Sunday ÷ trips per weekday (filtered inputs of one measure).'],
        ['Share of trips', 'Trips of the row ÷ trips of the whole answer (scope: total).'],
        ['Frequent / underserved stop', 'Buses per hour at the stop, weekday 07–10, all lines: ≥ 6 frequent; < 3 underserved.'],
        ['Longest wait', 'Largest gap between consecutive departures at the stop, 07–20 on the reference weekday.'],
        ['Line category', 'From the line number: 1–49 urban core, 50–79 suburban, 80+ regional, …N night, 01X/01N airport. Approximate.'],
        ['Sector / distance band', 'Compass sector and straight-line distance from Aristotelous Square (40.6325 N, 22.9410 E).'],
      ].map(([a, b]) => [{ v: a, s: 'bold' }, { v: b, s: 'text' }]),
      [],
      [{ v: SOURCE, s: 'note' }],
    ],
    merges: [], freeze: { row: 4, col: 0 },
  };

  return workbookBlob({ sheets: [summarySheet, linesSheet, rhythmSheet, accessSheet, oppSheet, stopsSheet, defs], title: 'Thessaloniki on the Move — management report', author: 'Astrato', footer: 'Thessaloniki on the Move · OSETH GTFS timetable, scheduled service' });
};

export const downloadReport = (blob) => {
  const url = URL.createObjectURL(blob);
  const a = Object.assign(document.createElement('a'), { href: url, download: `Thessaloniki_on_the_Move_${new Date().toISOString().slice(0, 10)}.xlsx` });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
};
