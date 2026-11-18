/**
 * The Excel report: one workbook that follows the selections on screen.
 *
 * Every sheet is built from a fresh query, not from the screen: governed sheets from the
 * semantic layer, weather and blended sheets from DuckDB with the same WHERE the charts use.
 *   Summary   the finding, the five KPIs and the selections it was taken under
 *   Cities    governed: occupancy and revenue by city against last autumn
 *   Weather   API: average high, rainfall and wet days by city, both autumns
 *   Blend     blended: occupancy on dry and wet nights by city
 *   Nights    blended rows, one per city per night this autumn (the data behind the charts)
 *   What-if   governed baseline against the governed scenario at the levers on screen, by city
 *   Offers    the flagged city-weeks and their audit trail (browser-only demo workflow)
 *   Notes     where each figure comes from
 */
import { workbookBlob } from './xlsx.js';
import { API_URL } from './weather-source.js';
import { EXTRACT_QUESTION } from './questions.js';

const H = (labels) => labels.map((v) => ({ v, s: 'head' }));

/** gov(q), duck(sql), figures, selectionText: supplied by app.js. Returns { blob, filename, sheets }. */
export const buildWorkbook = async ({ gov, duckRun, where, figures, finding, comparing = true, selectionText, plan, offers }) => {
  const f = figures;
  // Under a date selection there are no like-for-like nights last autumn: no comparison is written.
  const cmp = (v) => (comparing ? v : null);
  const w = where();
  const and = (cond) => (w ? `${w} AND ${cond}` : `WHERE ${cond}`);
  const [cities, weather, blend, nights] = await Promise.all([
    gov({ dims: ['City'], measures: ['Occupancy L3M', 'Occupancy L3M vs LY', 'Room Revenue L3M', 'Room Revenue L3M YoY', 'Room Revenue Share L3M'], limit: 100 }),
    duckRun(`SELECT city, AVG(tmax) FILTER (WHERE period = 'L3M') AS hi, AVG(tmax) FILTER (WHERE period = 'L3M LY') AS hi_ly,
      SUM(precip) FILTER (WHERE period = 'L3M') AS rain, COUNT(*) FILTER (WHERE period = 'L3M' AND precip >= 5) AS wet,
      COUNT(*) FILTER (WHERE period = 'L3M LY' AND precip >= 5) AS wet_ly FROM weather ${w} GROUP BY city ORDER BY city`, 'Excel · weather by city'),
    duckRun(`SELECT city, AVG(occupancy) FILTER (WHERE period = 'L3M' AND precip < 1) AS dry, AVG(occupancy) FILTER (WHERE period = 'L3M' AND precip >= 5) AS wet,
      COUNT(*) FILTER (WHERE period = 'L3M' AND precip < 1) AS n_dry, COUNT(*) FILTER (WHERE period = 'L3M' AND precip >= 5) AS n_wet
      FROM blend ${w} GROUP BY city ORDER BY city`, 'Excel · blend by city'),
    duckRun(`SELECT city, strftime(date, '%Y-%m-%d') AS day, tmax, precip, rain_band, temp_band, occupancy, room_nights FROM blend ${and("period = 'L3M'")} ORDER BY city, date`, 'Excel · nights'),
  ]);

  const summary = {
    name: 'Summary', cols: [34, 18, 22, 60],
    rows: [
      [{ v: 'Hotel demand × weather, Aug–Oct 2026', s: 'title' }, { v: '', s: 'title' }, { v: '', s: 'title' }, { v: '', s: 'title' }],
      [{ v: `Selections: ${selectionText}. Generated ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC. Fictional hotels; real weather.`, s: 'subtitle' }],
      [],
      [{ v: finding, s: 'note' }],
      [],
      H(['Figure', 'Aug–Oct 2026', 'vs Aug–Oct 2025', 'Source']),
      ['Occupancy', { v: f.occ, s: 'pct' }, { v: cmp(f.occVsLy), s: 'pp' }, 'Governed: semantic layer (Occupancy L3M, Occupancy L3M vs LY)'],
      ['Room revenue', { v: f.rev, s: 'usdint' }, { v: cmp(f.revYoY), s: 'spct' }, 'Governed: semantic layer (Room Revenue L3M, Room Revenue L3M YoY)'],
      ['Average daily high (°C)', { v: f.hi, s: 'num1' }, { v: cmp(f.hiVsLy), s: 'sdec' }, 'API: Open-Meteo archive, in the browser'],
      ['Wet city-days (5 mm+)', { v: f.wet, s: 'int' }, { v: cmp(f.wetVsLy), s: 'sdec' }, 'API: Open-Meteo archive, in the browser'],
      ['Occupancy, wet nights vs dry (pts)', { v: f.gap, s: 'sdec' }, { v: cmp(f.gapVsLy), s: 'sdec' }, 'Blended: governed rows joined to the weather in the browser'],
    ],
    merges: ['A1:D1', 'A2:D2', 'A4:D4'], freeze: { row: 1 },
  };
  summary.rows[3] = { height: 34, cells: summary.rows[3] };

  const citySheet = {
    name: 'Cities', cols: [18, 14, 14, 16, 14, 14], freeze: { row: 1 },
    rows: [H(['City', 'Occupancy', 'vs LY (pts)', 'Room revenue', 'vs LY', 'Share of revenue']),
      ...cities.map((r) => [r.City, { v: r['Occupancy L3M'], s: 'pct' }, { v: cmp(r['Occupancy L3M vs LY']), s: 'pp' }, { v: r['Room Revenue L3M'], s: 'usdint' }, { v: cmp(r['Room Revenue L3M YoY']), s: 'spct' }, { v: r['Room Revenue Share L3M'], s: 'pct' }])],
  };
  const weatherSheet = {
    name: 'Weather', cols: [18, 14, 14, 14, 12, 12], freeze: { row: 1 },
    rows: [H(['City', 'Avg high °C', 'Avg high LY', 'Rain mm', 'Wet days', 'Wet days LY']),
      ...weather.map((r) => [r.city, { v: r.hi, s: 'num1' }, { v: r.hi_ly, s: 'num1' }, { v: r.rain, s: 'int' }, { v: r.wet, s: 'int' }, { v: r.wet_ly, s: 'int' }])],
  };
  const blendSheet = {
    name: 'Blend', cols: [18, 16, 16, 16, 12, 12], freeze: { row: 1 },
    rows: [H(['City', 'Occupancy, dry', 'Occupancy, wet', 'Wet vs dry (pts)', 'Dry nights', 'Wet nights']),
      ...blend.map((r) => [r.city, { v: r.dry, s: 'pct' }, { v: r.wet, s: 'pct' }, { v: r.dry == null || r.wet == null ? null : 100 * (r.wet - r.dry), s: 'sdec' }, { v: r.n_dry, s: 'int' }, { v: r.n_wet, s: 'int' }])],
  };
  const nightSheet = {
    name: 'Nights', cols: [16, 12, 10, 10, 16, 18, 12, 12], freeze: { row: 1 },
    rows: [H(['City', 'Night', 'High °C', 'Rain mm', 'Rain band', 'Temperature band', 'Occupancy', 'Room nights']),
      ...nights.map((r) => [r.city, r.day, { v: r.tmax, s: 'num1' }, { v: r.precip, s: 'num1' }, r.rain_band, r.temp_band, { v: r.occupancy, s: 'pct' }, { v: r.room_nights, s: 'int' }])],
  };
  const p = plan ?? {};
  const lv = p.levers ?? {};
  const whatIf = {
    name: 'What-if', cols: [34, 18, 18, 18, 50], freeze: { row: 6 },
    rows: [
      [{ v: 'Wet-night offer: governed baseline against governed scenario', s: 'title' }, { v: '', s: 'title' }, { v: '', s: 'title' }, { v: '', s: 'title' }, { v: '', s: 'title' }],
      [{ v: `Selections: ${selectionText}. Layer parameters: wet_share = ${lv.wet_share}, occ_uplift_pts = ${lv.occ_uplift_pts}, rate_discount_pct = ${lv.rate_discount_pct}.${p.planCurrent === false ? ' Open the Wet-night offer tab before exporting to refresh these figures.' : ''}`, s: 'subtitle' }],
      [],
      H(['Figure', 'As booked', 'With the offer', 'Change', 'Source']),
      ['Room revenue, Aug–Oct 2026', { v: p.base, s: 'usdint' }, { v: p.scenario, s: 'usdint' }, { v: p.change, s: 'usdint' }, 'Governed: Room Revenue L3M; Room Revenue L3M Wet-Night Offer; Wet-Night Offer Revenue Change L3M'],
      ['Occupancy, Aug–Oct 2026', { v: p.occ, s: 'pct' }, { v: p.occScenario, s: 'pct' }, { v: p.occ == null || p.occScenario == null ? null : 100 * (p.occScenario - p.occ), s: 'sdec' }, 'Governed: Occupancy L3M; Occupancy L3M Wet-Night Offer (change in pts)'],
      [],
      H(['City', 'Revenue the offer adds', '', '', 'Source']),
      ...(p.cities ?? []).map((c) => [c.city, { v: c.gain, s: 'usdint' }, '', '', 'Governed: Wet-Night Offer Revenue Change L3M by City']),
    ],
    merges: ['A1:E1', 'A2:E2'],
  };
  const o = offers ?? { items: [], audit: [] };
  const offerSheet = {
    name: 'Offers', cols: [8, 16, 14, 12, 12, 12, 16, 14, 30], freeze: { row: 3 },
    rows: [
      [{ v: 'Offer flags (browser-only demo workflow: kept in this browser, never written to the warehouse)', s: 'subtitle' }],
      [],
      H(['Flag', 'City', 'Week of', 'Uplift (pts)', 'Discount %', 'Wet share', 'Governed estimate', 'Status', 'Raised / decided by']),
      ...o.items.map((x) => [x.id, x.city, x.week, { v: x.levers.occ_uplift_pts, s: 'num1' }, { v: x.levers.rate_discount_pct, s: 'int' }, { v: x.levers.wet_share, s: 'pct' }, { v: x.estGain, s: 'usdint' }, x.status, `${x.proposedBy}${x.decidedBy ? ` / ${x.decidedBy}` : ''}`]),
      [],
      H(['When (UTC)', 'Who', 'Role', 'Action', 'Flag', 'Outcome', 'Detail', '', '']),
      ...o.audit.map((a) => [a.at.slice(0, 16).replace('T', ' '), a.person, a.role, a.action, a.flag, a.outcome, a.detail, '', '']),
    ],
    merges: ['A1:I1'],
  };
  const notes = {
    name: 'Notes', cols: [26, 100],
    rows: [H(['Item', 'Definition']),
      ['Governed figures', 'Stored business questions and measures of the semantic layer, run by the Astrato engine.'],
      ['Blended rows', `The stored question "${EXTRACT_QUESTION}", copied once into the browser and joined to the weather on city and date.`],
      ['Weather', `Open-Meteo historical archive: ${API_URL}`],
      ['Dry / wet night', 'Dry: under 1 mm of rain that day. Wet: 5 mm or more. Showers (1–5 mm) count in neither.'],
      ['Wet vs dry (pts)', 'Average nightly occupancy on wet nights minus dry nights, in percentage points; a simple average of city-nights.'],
      ['Periods', 'This autumn: 1 Aug–31 Oct 2026. Last autumn: 1 Aug–31 Oct 2025 (the layer\'s L3M and L3M LY).'],
      ['Share of revenue', 'Room Revenue Share L3M: a city\'s room revenue over the total of the cities in the answer (governed).'],
      ['Wet-night offer', 'Layer measures with three parameters: wet_share (share of nights that are wet, from the weather API), occ_uplift_pts and rate_discount_pct. Change = wet_share × (1 − discount) × rooms available × uplift × ADR − wet_share × room revenue × discount.'],
      ['Offer flags', 'A demo workflow kept in this browser (labelled fallback): a revenue manager raises a flag, a general manager approves or rejects it; the proposer cannot decide their own flag.'],
      ['Data', 'The hotels and their demand are fictional (synthetic). The weather is real.'],
    ].map((r, i) => (i ? r.map((v) => ({ v, s: 'note' })) : r)),
  };
  const sheets = [summary, citySheet, weatherSheet, blendSheet, nightSheet, whatIf, offerSheet, notes];
  return { blob: workbookBlob({ sheets, title: 'Hotel demand × weather' }), filename: 'hotel-demand-weather.xlsx', sheets };
};
