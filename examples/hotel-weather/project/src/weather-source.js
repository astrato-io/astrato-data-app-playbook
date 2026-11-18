/**
 * The public API side of the blend: where the weather comes from.
 *
 * Open-Meteo's historical archive is free, needs no key and answers with CORS `*`, so the browser
 * can call it directly. One request returns daily maximum temperature and rainfall for every city
 * in the governed layer, for this autumn and last (the two windows the layer's L3M measures use).
 * The city list must match the values of the layer's City dimension exactly: those strings are the
 * join key and the shared selection value.
 */
export const CITIES = [
  ['Asheville', 35.60, -82.55], ['Atlanta', 33.75, -84.39], ['Austin', 30.27, -97.74], ['Baltimore', 39.29, -76.61],
  ['Boston', 42.36, -71.06], ['Charleston', 32.78, -79.93], ['Denver', 39.74, -104.99], ['Minneapolis', 44.98, -93.27],
  ['Napa', 38.30, -122.29], ['Nashville', 36.16, -86.78], ['Phoenix', 33.45, -112.07], ['San Diego', 32.72, -117.16],
];

/** The layer's windows: L3M = Aug–Oct 2026, L3M LY = Aug–Oct 2025 (the Calendar view's Rolling Bucket). */
export const WINDOWS = { L3M: ['2026-08-01', '2026-10-31'], 'L3M LY': ['2025-08-01', '2025-10-31'] };
export const inWindow = (day) => Object.entries(WINDOWS).find(([, [from, to]]) => day >= from && day <= to)?.[0] ?? null;

export const API_URL = 'https://archive-api.open-meteo.com/v1/archive?'
  + `latitude=${CITIES.map((c) => c[1]).join(',')}&longitude=${CITIES.map((c) => c[2]).join(',')}`
  + `&start_date=${WINDOWS['L3M LY'][0]}&end_date=${WINDOWS.L3M[1]}&daily=temperature_2m_max,precipitation_sum&timezone=auto`;
