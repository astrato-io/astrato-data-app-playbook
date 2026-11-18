/** Views, dimensions and measures of the "Thessaloniki on the Move" layer (OSETH GTFS in ASTRATO_GALLERY.MOCK_DATA.TH_*). */
export const SV = 'Service';
export const LV = 'Lines';
export const ST = 'Stops';
export const LS = 'Line Stops';
export const FL = 'Fleet';

const OVR = {
  ROUTE_KM: 'Route Km', AVG_SPEED_KMH: 'Avg Speed Kmh', AM_PEAK_HEADWAY_MIN: 'AM Peak Headway Min', BUSES_ON_ROAD_8AM: 'Buses On Road 8am',
  AM_PEAK_BUSES_PER_HOUR: 'AM Peak Buses Per Hour', DIST_CENTRE_KM: 'Dist Centre Km', LINE_NAME_EN: 'Line Name En', STOP_NAME_EN: 'Stop Name En',
  STOP_LAT: 'Stop Lat', STOP_LON: 'Stop Lon', DOW_NUM: 'Dow Num',
};
export const title = (c) => OVR[c] ?? c.split('_').map((w) => w[0] + w.slice(1).toLowerCase()).join(' ');

export const VIEWS = {
  [SV]: ['TH_SERVICE', 'SERVICE_DATE DAY_OF_WEEK DOW_NUM DAY_LABEL DATE_LABEL DAY_TYPE SERVICE_WEEK LINE HOUR HOUR_LABEL TIME_BAND IS_PEAK TRIPS VEHICLE_KM VEHICLE_HOURS STOP_CALLS'],
  [LV]: ['TH_LINES', 'LINE LINE_NAME LINE_NAME_EN LINE_LABEL CATEGORY LINE_COLOR ROUTE_KM STOPS_SERVED WEEKDAY_TRIPS TRIP_MINUTES AVG_SPEED_KMH FIRST_DEPARTURE LAST_DEPARTURE SPAN_HOURS AM_PEAK_HEADWAY_MIN MIDDAY_HEADWAY_MIN BUSES_ON_ROAD_8AM FREQUENCY_TIER SPEED_BAND CITY'],
  [ST]: ['TH_STOPS', 'STOP_ID STOP_CODE STOP_NAME STOP_NAME_EN STOP_LABEL LAT LON DIST_CENTRE_KM DIST_BAND SECTOR LINES_SERVING CONNECTIVITY WEEKDAY_DEPARTURES SATURDAY_DEPARTURES SUNDAY_DEPARTURES AM_PEAK_BUSES_PER_HOUR LONGEST_DAYTIME_GAP_MIN SERVICE_LEVEL IS_FREQUENT IS_UNDERSERVED NO_SUNDAY_SERVICE CITY'],
  [FL]: ['TH_FLEET_MINUTE', 'MINUTE_OF_DAY CLOCK_TIME TEN_MIN_SLOT CLOCK_HOUR TWO_MIN_SLOT FIVE_MIN_SLOT FIFTEEN_MIN_SLOT CATEGORY BUSES_ACTIVE TRIPS_DEPARTING SIM_DAY'],
  [LS]: ['TH_LINE_STOPS', 'LINE_STOP_ID LINE STOP_ID STOP_SEQUENCE WEEKDAY_CALLS STOP_LAT STOP_LON STOP_LABEL'],
};
/** Service and Line Stops join many-to-one to Lines on Line. Stops stands alone (its own grain). */
export const JOINS = [
  { from: SV, to: LV, field: 'Line' },
  { from: LS, to: LV, field: 'Line' },
];

const fd = (name, view, field, description) => ({ entity: 'dimension', name, definition: { kind: 'field', field: { view, field }, description } });
const agg = (view, id, field, aggregation, extra = {}) => ({ id, kind: 'aggregate', field: { view, field }, aggregation, ...extra });
const where = (view, pairs) => ({ filter: { conditions: pairs.map(([field, value], i) => ({ id: `c${i}`, field: { view, field }, operator: 'equals', value })) } });
const ms = (name, description, inputs, pattern, expression) => ({ entity: 'measure', name, definition: { description, inputs, ...(expression ? { expression } : {}), format: { mode: 'custom', pattern } } });
const sum = (name, view, field, description, pattern = '#,##0') => ms(name, description, [agg(view, 'x', field, 'SUM')], pattern);
const avg = (name, view, field, description, pattern = '0.0') => ms(name, description, [agg(view, 'x', field, 'AVG')], pattern);
const INT = '#,##0';
const PCT = '0.0%';

export const ENTITIES = [
  // ---- dimensions: service
  fd('Service Date', SV, 'Service Date', 'Calendar date of scheduled service, 14 Jul – 3 Aug 2026.'),
  fd('Day of Week', SV, 'Day Of Week', 'Mon … Sun (sort by Day Order).'),
  fd('Weekday', SV, 'Day Label', '1 Mon … 7 Sun, sorts in week order.'),
  fd('Service Day', SV, 'Date Label', 'MM-DD and weekday, sorts in date order.'),
  fd('Day Type', SV, 'Day Type', 'Weekday, Saturday or Sunday.'),
  fd('Service Week', SV, 'Service Week', 'Week 1–3 of the timetable period, Tuesday to Monday.'),
  fd('Hour', SV, 'Hour Label', 'Hour of day the trip departs its first stop (00:00 … 23:00).'),
  fd('Time Band', SV, 'Time Band', 'Night 0–6, AM peak 6–10, Midday 10–14, PM peak 14–18, Evening 18–21, Late 21–24.'),
  // ---- dimensions: lines
  fd('Line', LV, 'Line', 'OSETH line number (route_short_name), e.g. 01X, 31, 52.'),
  fd('Line Label', LV, 'Line Label', 'Line number and English route name.'),
  fd('Line Name', LV, 'Line Name', 'Route name in Greek as published by OSETH.'),
  fd('Line Category', LV, 'Category', 'Urban core (<50), Suburban (50–79), Regional (80+), Night (…N), Airport (01X/01N). Approximate grouping from the line number.'),
  fd('Frequency Tier', LV, 'Frequency Tier', 'Weekday 07–10 headway in the main direction: ≤10, 11–20, 21–40, >40 min, or no AM service.'),
  fd('Speed Band', LV, 'Speed Band', 'Scheduled commercial speed of a typical weekday trip.'),
  fd('Line City', LV, 'City', 'Constant: Thessaloniki. Anchors network totals.'),
  // ---- dimensions: stops
  fd('Stop', ST, 'Stop Label', 'Stop name (English transliteration) · stop code.'),
  fd('Stop Name (Greek)', ST, 'Stop Name', 'Stop name in Greek.'),
  fd('Distance Band', ST, 'Dist Band', 'Straight-line distance from Aristotelous Square.'),
  fd('Sector', ST, 'Sector', 'Compass sector from Aristotelous Square; Centre within 2 km.'),
  fd('Service Level', ST, 'Service Level', 'Weekday 07–10 departures per hour at the stop, all lines.'),
  fd('Connectivity', ST, 'Connectivity', 'Number of lines calling at the stop.'),
  fd('Stop City', ST, 'City', 'Constant: Thessaloniki. Anchors stop totals.'),
  // ---- dimensions: line stops
  fd('Route Stop', LS, 'Stop Label', 'A stop on the selected line.'),

  // ---- measures: service (scheduled timetable, all dates in scope)
  sum('Trips', SV, 'Trips', 'Scheduled bus trips (departures from the first stop).'),
  sum('Vehicle Km', SV, 'Vehicle Km', 'Scheduled in-service bus kilometres (shape length × trips).'),
  sum('Vehicle Hours', SV, 'Vehicle Hours', 'Scheduled in-service bus hours (first to last stop).'),
  sum('Stop Calls', SV, 'Stop Calls', 'Scheduled bus calls at stops: the network’s boarding opportunities.'),
  ms('Service Days', 'Distinct service dates in scope.', [agg(SV, 'x', 'Service Date', 'COUNT', { distinct: true })], INT),
  ms('Trips per Day', 'Average scheduled trips per service day (ratio of aggregates).', [agg(SV, 'a', 'Trips', 'SUM'), agg(SV, 'b', 'Service Date', 'COUNT', { distinct: true })], INT, 'a / b'),
  ms('Vehicle Km per Day', 'Average scheduled vehicle-km per service day.', [agg(SV, 'a', 'Vehicle Km', 'SUM'), agg(SV, 'b', 'Service Date', 'COUNT', { distinct: true })], INT, 'a / b'),
  ms('Stop Calls per Day', 'Average scheduled stop calls per service day.', [agg(SV, 'a', 'Stop Calls', 'SUM'), agg(SV, 'b', 'Service Date', 'COUNT', { distinct: true })], INT, 'a / b'),
  ms('Vehicle Hours per Day', 'Average scheduled vehicle-hours per service day.', [agg(SV, 'a', 'Vehicle Hours', 'SUM'), agg(SV, 'b', 'Service Date', 'COUNT', { distinct: true })], INT, 'a / b'),
  ms('Commercial Speed', 'Scheduled vehicle-km ÷ vehicle-hours (km/h).', [agg(SV, 'a', 'Vehicle Km', 'SUM'), agg(SV, 'b', 'Vehicle Hours', 'SUM')], '0.0', 'a / b'),
  ms('Peak Trips', 'Trips departing 07–10 or 14–17.', [agg(SV, 'x', 'Trips', 'SUM', where(SV, [['Is Peak', 1]]))], INT),
  ms('Peak Share', 'Peak trips ÷ all trips.', [agg(SV, 'a', 'Trips', 'SUM', where(SV, [['Is Peak', 1]])), agg(SV, 'b', 'Trips', 'SUM')], PCT, 'a / b'),
  ms('Weekday Trips per Day', 'Average trips per weekday.', [agg(SV, 'a', 'Trips', 'SUM', where(SV, [['Day Type', 'Weekday']])), agg(SV, 'b', 'Service Date', 'COUNT', { distinct: true, ...where(SV, [['Day Type', 'Weekday']]) })], INT, 'a / b'),
  ms('Saturday Trips per Day', 'Average trips per Saturday.', [agg(SV, 'a', 'Trips', 'SUM', where(SV, [['Day Type', 'Saturday']])), agg(SV, 'b', 'Service Date', 'COUNT', { distinct: true, ...where(SV, [['Day Type', 'Saturday']]) })], INT, 'a / b'),
  ms('Sunday Trips per Day', 'Average trips per Sunday.', [agg(SV, 'a', 'Trips', 'SUM', where(SV, [['Day Type', 'Sunday']])), agg(SV, 'b', 'Service Date', 'COUNT', { distinct: true, ...where(SV, [['Day Type', 'Sunday']]) })], INT, 'a / b'),
  ms('Sunday Retention', 'Sunday trips per day ÷ weekday trips per day: how much of the weekday network survives on Sunday.', [
    agg(SV, 'a', 'Trips', 'SUM', where(SV, [['Day Type', 'Sunday']])), agg(SV, 'b', 'Service Date', 'COUNT', { distinct: true, ...where(SV, [['Day Type', 'Sunday']]) }),
    agg(SV, 'c', 'Trips', 'SUM', where(SV, [['Day Type', 'Weekday']])), agg(SV, 'd', 'Service Date', 'COUNT', { distinct: true, ...where(SV, [['Day Type', 'Weekday']]) }),
  ], PCT, '(a / b) / (c / d)'),
  ms('Share of Trips', 'Trips ÷ trips of the whole answer (share of total).', [agg(SV, 'a', 'Trips', 'SUM'), agg(SV, 'b', 'Trips', 'SUM', { options: { scope: 'total' } })], PCT, 'a / b'),
  ms('Share of Vehicle Km', 'Vehicle-km ÷ vehicle-km of the whole answer.', [agg(SV, 'a', 'Vehicle Km', 'SUM'), agg(SV, 'b', 'Vehicle Km', 'SUM', { options: { scope: 'total' } })], PCT, 'a / b'),
  ms('Active Lines', 'Lines with at least one scheduled trip in scope.', [agg(SV, 'x', 'Line', 'COUNT', { distinct: true })], INT),
  ms('Day Order', 'Monday = 1 … Sunday = 7, for sorting.', [agg(SV, 'x', 'Dow Num', 'MIN')], '0'),
  ms('Avg Trip Km', 'Vehicle-km ÷ trips.', [agg(SV, 'a', 'Vehicle Km', 'SUM'), agg(SV, 'b', 'Trips', 'SUM')], '0.0', 'a / b'),
  ms('Avg Trip Minutes', 'Vehicle-hours × 60 ÷ trips.', [agg(SV, 'a', 'Vehicle Hours', 'SUM'), agg(SV, 'b', 'Trips', 'SUM')], '0', 'a * 60 / b'),

  // ---- measures: lines (reference weekday Tue 21 Jul 2026)
  ms('Lines', 'Distinct lines.', [agg(LV, 'x', 'Line', 'COUNT', { distinct: true })], INT),
  sum('Network Route Km', LV, 'Route Km', 'Sum of typical route lengths (one direction).', INT),
  avg('Avg Route Km', LV, 'Route Km', 'Mean typical route length, km.'),
  avg('Line Speed', LV, 'Avg Speed Kmh', 'Mean scheduled speed of a typical weekday trip, km/h.'),
  avg('AM Headway', LV, 'AM Peak Headway Min', 'Mean weekday 07–10 headway, minutes (main direction).', '0'),
  avg('Midday Headway', LV, 'Midday Headway Min', 'Mean weekday 10–14 headway, minutes (main direction).', '0'),
  sum('Buses at 8am', LV, 'Buses On Road 8am', 'Buses in service at 08:00 on the reference weekday.'),
  sum('Line Weekday Trips', LV, 'Weekday Trips', 'Trips on the reference weekday (Tue 21 Jul 2026).'),
  avg('Service Span', LV, 'Span Hours', 'Hours from first to last departure, weekday.'),
  avg('Trip Minutes', LV, 'Trip Minutes', 'Typical end-to-end trip, minutes.', '0'),
  sum('Line Stops Served', LV, 'Stops Served', 'Stops served by the line (both directions).'),
  ms('Line Color', 'OSETH route colour.', [agg(LV, 'x', 'Line Color', 'MAX')], '@'),
  ms('First Bus', 'Earliest weekday departure.', [agg(LV, 'x', 'First Departure', 'MIN')], '@'),
  ms('Last Bus', 'Latest weekday departure.', [agg(LV, 'x', 'Last Departure', 'MAX')], '@'),

  // ---- measures: stops (reference weekday Tue 21 Jul, Sat 25 Jul, Sun 26 Jul 2026)
  ms('Stops', 'Distinct bus stops.', [agg(ST, 'x', 'Stop Id', 'COUNT', { distinct: true })], INT),
  sum('Weekday Departures', ST, 'Weekday Departures', 'Bus departures from the stop on the reference weekday, all lines.'),
  sum('Saturday Departures', ST, 'Saturday Departures', 'Departures on the reference Saturday.'),
  sum('Sunday Departures', ST, 'Sunday Departures', 'Departures on the reference Sunday.'),
  ms('Departures per Stop', 'Weekday departures ÷ stops.', [agg(ST, 'a', 'Weekday Departures', 'SUM'), agg(ST, 'b', 'Stop Id', 'COUNT', { distinct: true })], INT, 'a / b'),
  avg('Lines per Stop', ST, 'Lines Serving', 'Mean number of lines calling at a stop.', '0.0'),
  avg('AM Buses per Hour', ST, 'AM Peak Buses Per Hour', 'Mean weekday 07–10 buses per hour at a stop.', '0.0'),
  ms('Peak Buses per Hour', 'Stop weekday 07–10 buses per hour (max across rows).', [agg(ST, 'x', 'AM Peak Buses Per Hour', 'MAX')], '0.0'),
  ms('Longest Gap', 'Longest weekday 07–20 wait between buses at the stop, minutes.', [agg(ST, 'x', 'Longest Daytime Gap Min', 'MAX')], '0'),
  avg('Avg Longest Gap', ST, 'Longest Daytime Gap Min', 'Mean longest daytime gap across stops, minutes.', '0'),
  sum('Frequent Stops', ST, 'Is Frequent', 'Stops with ≥6 buses an hour in the weekday AM peak.'),
  ms('Frequent Stop Share', 'Frequent stops ÷ stops.', [agg(ST, 'a', 'Is Frequent', 'SUM'), agg(ST, 'b', 'Stop Id', 'COUNT', { distinct: true })], PCT, 'a / b'),
  sum('Underserved Stops', ST, 'Is Underserved', 'Served stops with fewer than 3 buses an hour in the weekday AM peak.'),
  ms('Underserved Share', 'Underserved stops ÷ stops.', [agg(ST, 'a', 'Is Underserved', 'SUM'), agg(ST, 'b', 'Stop Id', 'COUNT', { distinct: true })], PCT, 'a / b'),
  sum('Stops Without Sunday Bus', ST, 'No Sunday Service', 'Stops with weekday service but no bus on the reference Sunday.'),
  ms('Stop Sunday Retention', 'Sunday departures ÷ weekday departures at stops.', [agg(ST, 'a', 'Sunday Departures', 'SUM'), agg(ST, 'b', 'Weekday Departures', 'SUM')], PCT, 'a / b'),
  ms('Share of Departures', 'Weekday departures ÷ departures of the whole answer.', [agg(ST, 'a', 'Weekday Departures', 'SUM'), agg(ST, 'b', 'Weekday Departures', 'SUM', { options: { scope: 'total' } })], PCT, 'a / b'),
  avg('Stop Lat', ST, 'Lat', 'Stop latitude.', '0.00000'),
  avg('Stop Lon', ST, 'Lon', 'Stop longitude.', '0.00000'),
  avg('Distance from Centre', ST, 'Dist Centre Km', 'Mean straight-line km from Aristotelous Square.', '0.0'),

  // ---- fleet by minute (reference weekday Tue 21 Jul 2026)
  fd('Ten-Minute Slot', FL, 'Ten Min Slot', 'Clock time rounded down to 10 minutes, reference weekday.'),
  fd('Clock Hour', FL, 'Clock Hour', 'Hour of the day, reference weekday.'),
  fd('Fleet Category', FL, 'Category', 'Line category of the buses in service.'),
  ms('Buses in Service', 'Average buses on the road per minute in scope: SUM(buses active) ÷ COUNT DISTINCT(minute). Additive across categories.', [agg(FL, 'a', 'Buses Active', 'SUM'), agg(FL, 'b', 'Minute Of Day', 'COUNT', { distinct: true })], '#,##0', 'a / b'),
  sum('Trips Departing', FL, 'Trips Departing', 'Trips leaving their first stop, reference weekday.'),
  ms('Peak Minute Buses', 'Largest per-row buses active (per minute and category).', [agg(FL, 'x', 'Buses Active', 'MAX')], '#,##0'),

  // ---- measures: line stops
  avg('Route Stop Lat', LS, 'Stop Lat', 'Latitude of a stop on the line.', '0.00000'),
  avg('Route Stop Lon', LS, 'Stop Lon', 'Longitude of a stop on the line.', '0.00000'),
  sum('Route Stop Calls', LS, 'Weekday Calls', 'Weekday calls of the line at the stop.'),
  ms('Route Stops', 'Distinct stops on the line(s).', [agg(LS, 'x', 'Stop Id', 'COUNT', { distinct: true })], INT),
];
