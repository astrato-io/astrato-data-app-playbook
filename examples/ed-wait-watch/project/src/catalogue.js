/**
 * Every native object of "ED Wait Watch", declared once as data.
 *
 * Each tile names the stored business question it stands for (`q`): tools/questions.mjs turns
 * these declarations into the layer's stored questions, and tiles.js turns them into visualization
 * definitions. Names are semantic-layer item names, never field keys.
 *
 * Copied technique (not structure): the tile-as-data catalogue of the
 * labour-market-pulse example (src/catalogue.js there).
 */
export const C = {
  ink: '#0E2A33', teal: '#0B6E79', tealSoft: '#7FB7BE', sky: '#B9DCE0', coral: '#C2410C', amber: '#B45309',
  green: '#15803D', red: '#B42318', grey: '#5B6B73', line: '#D6DEE1', page: '#F4F7F7', plum: '#6D4C7D', sand: '#B08D57',
};
export const SERIES = [C.teal, C.coral, C.plum, C.sand, C.tealSoft, C.amber, C.grey, C.ink];

export const TABS = [
  { key: 'board', label: 'Morning board', question: 'Are we seeing patients within 30 minutes?' },
  { key: 'when', label: 'When', question: 'When do patients wait longer than 30 minutes?' },
  { key: 'who', label: 'Who', question: 'Which departments and patient groups wait longest?' },
  { key: 'sat', label: 'Satisfaction', question: 'Does satisfaction fall as waits grow?' },
  { key: 'flags', label: 'Flags', question: 'What has been flagged, who owns it, and what is overdue?' },
];

/**
 * KPI: a number on the stored "This Month" measure with the stored "Change vs Last Month" measure as
 * its comparison, and a month-by-month mini line of the base measure. `up` is 'good', 'bad' or
 * 'neutral' (whether a rise is good news).
 */
const kpi = (id, label, unit, q, base, up, sparkQ, extra = {}) => [
  { id, tab: extra.tab ?? 'board', kind: 'kpi', type: 'number', label, unit, q, up,
    measures: [{ m: `${base} This Month`, ref: 'v' }, { m: extra.cmp ?? `${base} Change vs Last Month`, ref: 'd', role: 'comparison' }],
    prior: `${base} Last Month`, description: `${label}: the latest month to date (the Review Month axis, read as of the latest day in the data), with its change on the same days of the month before.`, ...extra },
  { id: `${id}-sp`, tab: extra.tab ?? 'board', kind: 'spark', type: 'line', q: sparkQ,
    dims: [{ d: 'Arrival Month', ref: 'p' }], measures: [{ m: extra.sparkMeasure ?? base, ref: 'v' }],
    sort: [{ by: 'p', direction: 'asc' }], color: extra.sparkColor ?? C.teal, description: `${label} by arrival month, every month on record.` },
];

const WITHIN = 'Seen Within Target %';
/** Weekday names (Mon ... Sun) that sort Monday first: the layer's "Arrival Day" puts invisible zero-width spaces in front. */
export const DAY = 'Arrival Day';
export const plainDay = (v) => String(v ?? '').replace(/[\u200B]/g, '').replace(/^\d /, '');
// The same four KPI cards appear on the board, and two of them on Who and Satisfaction (one stored question each).
const KPI_Q = {
  within: ['Seen within 30 min', '%', 'What share of patients were seen within 30 minutes this month, and how many points did it move?', WITHIN, 'good', 'How has the share of patients seen within 30 minutes moved month by month?', { cmp: 'Seen Within Target pts Change vs Last Month' }],
  wait: ['Average wait', 'min', 'How long did patients wait on average this month?', 'Avg Wait Time', 'bad', 'How has the average wait moved month by month?', { sparkColor: C.coral }],
  sat: ['Satisfaction', 'of 10', 'How satisfied were patients this month?', 'Avg Satisfaction', 'good', 'How has patient satisfaction moved month by month?', { sparkColor: C.plum }],
  pat: ['Visits', '', 'How many patients came to the ED this month?', 'Patients', 'neutral', 'How many patients came to the ED each month?', { sparkColor: C.grey, cmp: 'Patients Change vs Last Month Guarded' }],
};
const kpiOf = (id, key, extra = {}) => { const [label, unit, q, base, up, sparkQ, x] = KPI_Q[key]; return kpi(id, label, unit, q, base, up, sparkQ, { ...x, ...extra }); };

export const TILES = [
  // ------------------------------------------------------------------ Morning board
  ...kpiOf('k-within', 'within', { hero: true }),
  ...kpiOf('k-wait', 'wait'),
  ...kpiOf('k-sat', 'sat'),
  ...kpiOf('k-pat', 'pat'),
  {
    id: 'c-trend', sub: "Bars: share seen within 30 minutes each month; line: 3-month average. Click a bar to select that month everywhere else", tab: 'board', kind: 'chart', type: 'combo', group: 't', q: 'Is the share of patients seen within 30 minutes improving?',
    description: 'Share of ER visits seen within 30 minutes, by arrival month, with its 3-month moving average.',
    dims: [{ d: 'Arrival Month', ref: 'p' }],
    measures: [{ m: WITHIN, ref: 'v', label: 'Monthly', series: 'bar' }, { m: WITHIN, ref: 'ma', label: '3-month average', series: 'line', moving: { aggregate: 'AVG', windowBegin: -2, windowEnd: 0 } }],
    sort: [{ by: 'p', direction: 'asc' }], colors: { v: C.sky, ma: C.teal }, legend: true, clickField: 'Arrival Month',
  },
  {
    id: 'c-slots', sub: "Share seen within 30 minutes; dark coral = fewest seen in time, pale = most. Click a cell to select the slot", tab: 'board', kind: 'chart', type: 'heatMap', q: 'Which weekday and arrival slots miss the 30-minute target most?',
    description: 'Share of visits seen within 30 minutes for each weekday and three-hour arrival band. Darker is worse.',
    dims: [{ d: 'Time Band', ref: 't' }, { d: DAY, ref: 'w' }], measures: [{ m: WITHIN, ref: 'v' }],
    sort: [{ by: 't', direction: 'asc' }, { by: 'w', direction: 'asc' }], clickField: 'Time Band',
  },
  { id: 'n-open', tab: 'board', kind: 'flagnum', type: 'number', label: 'Open', q: 'How many waiting-time flags are still open?', description: 'Flags with status Open or In progress.', measures: [{ m: 'Open Flags', ref: 'v' }] },
  { id: 'n-overdue', tab: 'board', kind: 'flagnum', type: 'number', label: 'Overdue', q: 'How many open flags are past their due date?', description: 'Open or in-progress flags whose due date is before today.', measures: [{ m: 'Overdue Flags', ref: 'v' }] },
  { id: 'm-flags', tab: 'board', kind: 'flagbar', type: 'bar', q: 'How do the waiting-time flags split by status?', description: 'Flags raised, by status: the mini chart beside the flag counts.',
    dims: [{ d: 'Flag Status', ref: 's' }], measures: [{ m: 'Flags Raised', ref: 'v' }], sort: [{ by: 's', direction: 'asc' }], color: C.coral, clickField: 'Flag Status' },
  { id: 'n-signoff', tab: 'board', kind: 'flagnum', type: 'number', label: 'Sign-off', q: 'How many resolved flags await the lead\'s sign-off?', description: 'Flags the owner marked Resolved that the ED operations lead has not yet closed.', measures: [{ m: 'Flags Awaiting Sign-off', ref: 'v' }] },

  {
    id: 't-drivers', tab: 'board', kind: 'table', type: 'table', group: 'd', q: 'Which departments drove the change in visits waiting over 30 minutes since the month before?',
    sub: 'Visits waiting over 30 min, latest month to date against the same days before. The Change column adds up to the total change (a bridge)',
    description: 'A bridge of the month-on-month change: for each referral department, visits that waited over 30 minutes in the latest month to date and on the same days of the month before, and the change (the department changes add up to the total change), with the change in the share seen within 30 minutes in points and the monthly trend of over-30 visits.',
    dims: [{ d: 'Department Referral', ref: 'd', label: 'Department' }],
    measures: [{ m: 'Patients Over Target Change vs Last Month', ref: 'od', label: 'Change' }, { m: 'Patients Over Target This Month', ref: 'o1', label: 'Now' }, { m: 'Patients Over Target Last Month', ref: 'o0', label: 'Before' },
      { m: 'Seen Within Target pts Change vs Last Month', ref: 'wd', label: 'Seen in time, Δ' }],
    sort: [{ by: 'od', direction: 'desc' }], spark: { m: 'Patients Over Target', ref: 'sp', label: 'Over 30, by month', color: C.coral }, clickField: 'Department Referral',
    widths: { od: 92, o1: 56, o0: 60, wd: 86 }, rowHeight: 21, flex: { d: 110, sp: 76 }, fontSize: 11.5,
  },

  // ------------------------------------------------------------------ When
  {
    id: 'c-hour', tab: 'when', kind: 'chart', type: 'bar', q: 'At which hours of arrival do most patients wait over 30 minutes?',
    description: 'Visits that waited longer than 30 minutes, by hour of arrival (0-23).',
    dims: [{ d: 'Hour of Day', ref: 'h' }], measures: [{ m: 'Patients Over Target', ref: 'v' }],
    sort: [{ by: 'h', direction: 'asc' }], color: C.coral, clickField: 'Hour of Day', labels: false,
  },
  {
    id: 'c-weekday', tab: 'when', kind: 'chart', type: 'bar', q: 'On which weekdays are the fewest patients seen within 30 minutes?',
    description: 'Share of visits seen within 30 minutes by weekday of arrival.',
    dims: [{ d: DAY, ref: 'w' }], measures: [{ m: WITHIN, ref: 'v' }],
    sort: [{ by: 'w', direction: 'asc' }], color: C.teal, clickField: DAY,
  },
  {
    id: 't-slots', sub: "Rank 1 = fewest seen in time; share of over = share of all over-30 visits", tab: 'when', kind: 'table', type: 'table', q: 'How does each time band perform against the 30-minute target?',
    description: 'Each three-hour arrival band: visits, visits over 30 minutes and their share of all over-target visits, share seen within 30 minutes and its rank (1 = worst), average wait, with the monthly trend of the share seen within 30 minutes.',
    dims: [{ d: 'Time Band', ref: 't', label: 'Arrival' }],
    measures: [{ m: 'Seen Within 30 per 100 Visits', ref: 'rk', label: 'Rank', rank: 'ascending' }, { m: 'Patients', ref: 'n', label: 'Visits' }, { m: 'Patients Over Target', ref: 'o', label: 'Over 30 min' },
      { m: 'Share of Over-Target Patients', ref: 'sh', label: 'Share of over' }, { m: WITHIN, ref: 'w', label: 'Within 30' }, { m: 'Avg Wait Time', ref: 'a', label: 'Avg min' }],
    sort: [{ by: 't', direction: 'asc' }], spark: { m: WITHIN, ref: 'sp', label: 'Within 30, by month' }, clickField: 'Time Band',
    widths: { rk: 60, n: 70, o: 80, sh: 84, w: 76, a: 66 }, flex: { t: 80, sp: 110 },
  },
  { id: 'w-base', tab: 'when', kind: 'whatif', type: 'number', label: 'At 30 minutes (governed baseline)', q: 'What share of patients are seen within 30 minutes?', description: 'Share of visits seen within the 30-minute target, the governed baseline for the target what-if.', measures: [{ m: WITHIN, ref: 'v' }] },
  { id: 'w-within', tab: 'when', kind: 'whatif', type: 'number', label: 'Seen within the scenario target', q: 'What share of patients would be seen within a different waiting-time target?', description: 'Seen Within Target % with its Target Minutes parameter set by the app (default 30).', measures: [{ m: WITHIN, ref: 'v' }], param: 'Target Minutes' },
  { id: 'w-over', tab: 'when', kind: 'whatif', type: 'number', label: 'Patients over the scenario target', q: 'How many patients would wait longer than a different waiting-time target?', description: 'Patients Over Target with its Target Minutes parameter set by the app (default 30).', measures: [{ m: 'Patients Over Target', ref: 'v' }], param: 'Target Minutes' },

  // ------------------------------------------------------------------ Who
  ...kpiOf('kw-within', 'within', { tab: 'who' }),
  ...kpiOf('kw-wait', 'wait', { tab: 'who' }),
  {
    id: 'c-dept', sub: "Referral department (None = not referred), worst first", tab: 'who', kind: 'chart', type: 'bar', q: 'Which departments see the fewest patients within 30 minutes?',
    description: 'Share of visits seen within 30 minutes by the department the patient was referred on to ("None" = not referred), worst first.',
    dims: [{ d: 'Department Referral', ref: 'd' }], measures: [{ m: WITHIN, ref: 'v' }],
    sort: [{ by: 'v', direction: 'asc' }], color: C.teal, orientation: 'horizontal', clickField: 'Department Referral',
  },
  {
    id: 't-dept', sub: "Rank 1 = fewest seen in time; share of over = share of all over-30 visits", tab: 'who', kind: 'table', type: 'table', q: 'How does each department perform against the 30-minute target?',
    description: 'Each referral department: visits, visits over 30 minutes and their share of all over-target visits, share seen within 30 minutes and its rank (1 = worst), average wait and satisfaction, with the monthly trend of the share seen within 30 minutes.',
    dims: [{ d: 'Department Referral', ref: 'd', label: 'Department' }],
    measures: [{ m: 'Seen Within 30 per 100 Visits', ref: 'rk', label: 'Rank', rank: 'ascending' }, { m: 'Patients', ref: 'n', label: 'Visits' }, { m: 'Patients Over Target', ref: 'o', label: 'Over 30' },
      { m: 'Share of Over-Target Patients', ref: 'sh', label: 'Share of over' }, { m: WITHIN, ref: 'w', label: 'Within 30' }, { m: 'Avg Wait Time', ref: 'a', label: 'Avg min' }, { m: 'Avg Satisfaction', ref: 's', label: 'Satisf.' }],
    sort: [{ by: 'n', direction: 'desc' }], spark: { m: WITHIN, ref: 'sp', label: 'Within 30, by month' }, clickField: 'Department Referral',
    widths: { rk: 56, n: 74, o: 64, sh: 70, w: 72, a: 58, s: 58 }, rowHeight: 24, flex: { d: 118, sp: 92 }, fontSize: 11.5,
  },
  {
    id: 'c-age', tab: 'who', kind: 'chart', type: 'bar', q: 'Do some age groups wait longer than others?',
    description: 'Share of visits seen within 30 minutes by ten-year age band.',
    dims: [{ d: 'Age Band', ref: 'a' }], measures: [{ m: WITHIN, ref: 'v' }],
    sort: [{ by: 'a', direction: 'asc' }], color: C.teal, clickField: 'Age Band',
  },
  {
    id: 'c-race', tab: 'who', kind: 'chart', type: 'bar', q: 'Do some patient groups by race wait longer than others?',
    description: 'Share of visits seen within 30 minutes by self-reported race, worst first.',
    dims: [{ d: 'Race Group', ref: 'r' }], measures: [{ m: WITHIN, ref: 'v' }],
    sort: [{ by: 'v', direction: 'asc' }], color: C.teal, orientation: 'horizontal', clickField: 'Race Group',
  },
  {
    id: 'c-gender', tab: 'who', kind: 'chart', type: 'bar', q: 'Do women, men and non-conforming patients wait alike?', sub: 'Share seen within 30 minutes; Non-Conforming is only 24 visits',
    description: 'Share of visits seen within 30 minutes by gender. Non-Conforming covers only 24 visits.',
    dims: [{ d: 'Gender', ref: 'g' }], measures: [{ m: WITHIN, ref: 'v' }],
    sort: [{ by: 'v', direction: 'asc' }], color: C.teal, orientation: 'horizontal', clickField: 'Gender',
  },

  // ------------------------------------------------------------------ Satisfaction
  ...kpiOf('ks-sat', 'sat', { tab: 'sat' }),
  ...kpiOf('ks-within', 'within', { tab: 'sat' }),
  {
    id: 'c-satband', sub: "Average score 1-10; only visits with a score (about 27%)", tab: 'sat', kind: 'chart', type: 'bar', q: 'How does satisfaction change with the time a patient waited?',
    description: 'Average satisfaction score (1-10) by minutes waited, in 10-minute bands. Only visits with a recorded score (about 27%) count.',
    dims: [{ d: 'Wait Band', ref: 'b' }], measures: [{ m: 'Avg Satisfaction', ref: 'v' }],
    sort: [{ by: 'b', direction: 'asc' }], color: C.plum, clickField: 'Wait Band',
  },
  {
    id: 'c-sattarget', tab: 'sat', kind: 'chart', type: 'bar', q: 'Are patients seen within 30 minutes more satisfied?', sub: 'Average score 1-10, within 30 minutes against longer waits',
    description: 'Average satisfaction score of visits seen within 30 minutes against those that waited longer.',
    dims: [{ d: 'Wait Target', ref: 't' }], measures: [{ m: 'Avg Satisfaction', ref: 'v' }],
    sort: [{ by: 't', direction: 'desc' }], color: C.plum, orientation: 'horizontal', clickField: 'Wait Target',
  },
  {
    id: 'c-sattrend', sub: "Bars: satisfaction (left axis); line: share seen within 30 minutes (right). Click a bar to pick the month", tab: 'sat', kind: 'chart', type: 'combo', group: 't', q: 'Do satisfaction and the 30-minute target move together month by month?',
    description: 'Average satisfaction (left axis) and share seen within 30 minutes (right axis) by arrival month.',
    dims: [{ d: 'Arrival Month', ref: 'p' }],
    measures: [{ m: 'Avg Satisfaction', ref: 's', label: 'Satisfaction', series: 'bar' }, { m: WITHIN, ref: 'w', label: 'Seen within 30', axis: 'secondary', series: 'line' }],
    sort: [{ by: 'p', direction: 'asc' }], colors: { s: '#C9B6D3', w: C.teal }, legend: true, clickField: 'Arrival Month',
  },
  {
    id: 't-satdept', sub: "Rank 1 = least satisfied; satisfaction 1-10 where recorded", tab: 'sat', kind: 'table', type: 'table', q: 'Which departments\' patients are least satisfied, and how long did they wait?',
    description: 'Each referral department: average satisfaction and its rank (1 = least satisfied), scores recorded, average wait and share seen within 30 minutes, with the monthly satisfaction trend.',
    dims: [{ d: 'Department Referral', ref: 'd', label: 'Department' }],
    measures: [{ m: 'Satisfaction Rank Basis', ref: 'rk', label: 'Rank', rank: 'ascending' }, { m: 'Avg Satisfaction', ref: 's', label: 'Satisf.' }, { m: 'CSAT Responses', ref: 'r', label: 'Scores' }, { m: 'Avg Wait Time', ref: 'a', label: 'Avg min' }, { m: WITHIN, ref: 'w', label: 'Within 30' }],
    sort: [{ by: 's', direction: 'asc' }], spark: { m: 'Avg Satisfaction', ref: 'sp', label: 'Satisfaction, by month' }, clickField: 'Department Referral',
    widths: { rk: 56, s: 74, r: 64, a: 62, w: 70 }, rowHeight: 25, flex: { d: 118, sp: 96 }, fontSize: 11.5,
  },

  // ------------------------------------------------------------------ Flags
  { id: 'n-open2', tab: 'flags', kind: 'flagnum', type: 'number', label: 'Open flags', q: 'How many waiting-time flags are still open?', measures: [{ m: 'Open Flags', ref: 'v' }] },
  { id: 'n-overdue2', tab: 'flags', kind: 'flagnum', type: 'number', label: 'Overdue', q: 'How many open flags are past their due date?', measures: [{ m: 'Overdue Flags', ref: 'v' }] },
  { id: 'n-signoff2', tab: 'flags', kind: 'flagnum', type: 'number', label: 'To sign off', q: 'How many resolved flags await the lead\'s sign-off?', description: 'Flags the owner marked Resolved that the ED operations lead has not yet closed.', measures: [{ m: 'Flags Awaiting Sign-off', ref: 'v' }] },
  { id: 'm-flags2', tab: 'flags', kind: 'flagbar', type: 'bar', q: 'How do the waiting-time flags split by status?', description: 'Flags raised, by status: the mini chart beside the flag counts.',
    dims: [{ d: 'Flag Status', ref: 's' }], measures: [{ m: 'Flags Raised', ref: 'v' }], sort: [{ by: 's', direction: 'asc' }], color: C.coral, clickField: 'Flag Status' },
  {
    id: 'c-owner', tab: 'flags', kind: 'chart', type: 'bar', q: 'Who owns the open waiting-time flags?',
    description: 'Open and in-progress flags by named owner.',
    dims: [{ d: 'Flag Owner', ref: 'o' }], measures: [{ m: 'Open Flags', ref: 'v' }],
    sort: [{ by: 'v', direction: 'desc' }], color: C.coral, orientation: 'horizontal', clickField: 'Flag Owner', hideZero: true,
  },
  {
    id: 't-flags', sub: "Overdue = 1 when an open flag is past its due date. Click a row to act on it.", tab: 'flags', kind: 'table', type: 'table', q: 'Which waiting-time flags have been raised, who owns them and when are they due?', flagTable: true,
    description: 'Every flag a duty manager raised: what it covers, the named owner, the due date and its status. Overdue = 1 when an open flag is past its due date.',
    dims: [{ d: 'Flag ID', ref: 'id', label: 'Flag' }, { d: 'Flag Status', ref: 'st', label: 'Status' }, { d: 'Flag Department', ref: 'dp', label: 'Department' }, { d: 'Flag Weekday', ref: 'wd', label: 'Day' },
      { d: 'Flag Time Band', ref: 'tb', label: 'Slot' }, { d: 'Flag Issue', ref: 'is', label: 'Issue' }, { d: 'Flag Owner', ref: 'ow', label: 'Owner' }, { d: 'Flag Due Date', ref: 'du', label: 'Due' }, { d: 'Flag Raised By', ref: 'by', label: 'Raised by' }],
    measures: [{ m: 'Overdue Flags', ref: 'od', label: 'Overdue' }],
    sort: [{ by: 'id', direction: 'desc' }], clickField: 'Flag ID',
    widths: { id: 134, st: 86, dp: 96, wd: 58, tb: 72, du: 96, by: 128, od: 80 }, flex: { is: 160, ow: 126 },
  },
  {
    id: 't-events', sub: "Every change to a flag: who, in which role, before and after, and why", tab: 'flags', kind: 'table', type: 'table', q: 'What has happened to each waiting-time flag, and who did it?', flagTable: true,
    description: 'The audit trail: every change to a flag, who made it, in which role, the status before and after, and the note given.',
    dims: [{ d: 'Event Time', ref: 'at', label: 'When (UTC)' }, { d: 'Event Flag ID', ref: 'id', label: 'Flag' }, { d: 'Event Action', ref: 'ac', label: 'Action' }, { d: 'Event Actor', ref: 'who', label: 'Who' },
      { d: 'Event Role', ref: 'ro', label: 'Role' }, { d: 'Event From Status', ref: 'fr', label: 'From' }, { d: 'Event To Status', ref: 'to', label: 'To' }, { d: 'Event Note', ref: 'nt', label: 'Note' }],
    measures: [{ m: 'Flag Events', ref: 'n', label: '#' }],
    sort: [{ by: 'at', direction: 'desc' }], clickField: 'Event Flag ID',
    widths: { at: 140, id: 134, ac: 84, who: 150, ro: 132, fr: 92, to: 92, n: 36 }, flex: { nt: 150 },
  },
];

/** Filter controls, one set per data tab (each tab has its own selection group). */
const FILTER_FIELDS = [['Month', 'Period'], ['Dept', 'Department Referral'], ['Arrival', 'Time Band'], ['Day', DAY]];
export const FILTERS = [
  ...['board', 'when', 'who', 'sat'].flatMap((tab) => FILTER_FIELDS.map(([label, field]) => ({ id: `f-${tab}-${field.replace(/\W+/g, '').toLowerCase()}`, tab, type: 'filter', label, field }))),
  { id: 'f-flags-status', tab: 'flags', type: 'filter', label: 'Status', field: 'Flag Status' },
  { id: 'f-flags-owner', tab: 'flags', type: 'filter', label: 'Owner', field: 'Flag Owner' },
];
