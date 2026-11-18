/**
 * Every native object of Labour Market Pulse, declared once as data.
 *
 * Each tile names the stored business question it stands for (`q`); tools/questions.mjs turns
 * these declarations into the layer's stored questions, and the app turns them into
 * visualization definitions. Names below are semantic-layer item names, never field keys.
 *
 * `latest: true` marks a snapshot card: it reads `Period Status = Latest` while no Year or
 * Period is selected, and the average of the selected readings otherwise (see app.js).
 */
export const C = {
  navy: '#1F2A44', teal: '#0F766E', sky: '#7CA7C9', sand: '#C4A574', plum: '#6B5B95', grey: '#667085',
  red: '#B42318', green: '#067647', amber: '#B54708', mist: '#F2F1EE', line: '#D0D5DD',
};
export const SERIES = [C.navy, C.teal, C.sand, C.plum, C.sky, C.amber, C.grey];

export const TABS = [
  { key: 'market', label: 'Market', question: 'Is the UK labour market tightening or loosening?' },
  { key: 'demand', label: 'Demand', question: 'Where is hiring demand falling?' },
  { key: 'pay', label: 'Pay', question: 'What does a looser market mean for pay?' },
  { key: 'regions', label: 'Regions', question: 'Which regions are loosening fastest?' },
  { key: 'call', label: 'Our call', question: 'What is our market call this month?' },
];

const LATEST = { field: 'Period Status', op: 'equals', value: 'Latest' };
const SECTORS = { field: 'Indicator', op: 'contains', value: 'Vacancies:' };
const UK = { note: 'UK series' };

/**
 * KPI: a number on a stored measure with a stored change measure as its comparison, and a
 * month-by-month mini line. `up` says whether a rise is good ('good') or bad ('bad').
 */
const kpi = (id, tab, label, q, measure, change, up, sparkQ, extra = {}) => [
  { id, tab, kind: 'kpi', type: 'number', label, q, measures: [{ m: measure, ref: 'v' }, { m: change, ref: 'd', role: 'comparison' }], latest: true, up, ...extra },
  { id: `${id}-sp`, tab, kind: 'spark', type: 'line', q: sparkQ, dims: [{ d: 'Period', ref: 'p' }], measures: [{ m: measure, ref: 'v' }], sort: [{ by: 'p', direction: 'asc' }], color: C.teal, ...(extra.sparkFilters ? { filters: extra.sparkFilters } : {}) },
];

export const TILES = [
  // ------------------------------------------------------------------ Market
  ...kpi('k-uv', 'market', 'Unemployed per vacancy', 'How many unemployed people are there per vacancy in the latest release?', 'Unemployed per Vacancy', 'Unemployed per Vacancy Change on Year', 'bad', 'How has the number of unemployed per vacancy moved month by month?', { hero: true }),
  ...kpi('k-ur', 'market', 'Unemployment rate', 'What is the UK unemployment rate in the latest release?', 'Unemployment Rate', 'Unemployment Rate Change on Year', 'bad', 'How has the UK unemployment rate moved month by month?'),
  ...kpi('k-vac', 'market', 'Vacancies', 'How many job vacancies are there in the latest release?', 'Vacancies (000s)', 'Vacancies Change on Year (000s)', 'good', 'How have UK job vacancies moved month by month?'),
  ...kpi('k-pay', 'market', 'Regular pay growth', 'How fast is regular pay growing in the latest release?', 'Regular Pay Growth', 'Regular Pay Growth Change on Year', 'good', 'How has regular pay growth moved month by month?'),
  {
    id: 'c-uv', tab: 'market', kind: 'chart', type: 'line', q: 'How far has the labour market loosened since the 2022 peak?',
    description: 'Unemployed people per vacancy each month with its 12-month moving average. The shaded band runs up to the pre-pandemic level (Dec-Feb 2020): below it the market is tighter than before the pandemic.',
    dims: [{ d: 'Period', ref: 'p' }],
    measures: [{ m: 'Unemployed per Vacancy', ref: 'uv', label: 'Monthly' }, { m: 'Unemployed per Vacancy', ref: 'ma', label: '12-month average', moving: { aggregate: 'AVG', windowBegin: -11, windowEnd: 0 } }],
    sort: [{ by: 'p', direction: 'asc' }], colors: { uv: C.sky, ma: C.navy }, legend: true, band: "Unemployed per Vacancy Pre-Pandemic", clickField: 'Period',
  },
  {
    id: 'c-vu', tab: 'market', kind: 'chart', type: 'line', q: 'Are vacancies falling as unemployment rises?',
    description: 'UK vacancies (000s, left axis) and the unemployment rate (%, right axis) by month.',
    dims: [{ d: 'Period', ref: 'p' }],
    measures: [{ m: 'Vacancies (000s)', ref: 'vac', label: 'Vacancies k' }, { m: 'Unemployment Rate', ref: 'ur', label: 'Unemployed %', axis: 'secondary' }],
    sort: [{ by: 'p', direction: 'asc' }], colors: { vac: C.teal, ur: C.red }, legend: true, clickField: 'Period',
  },
  {
    id: 't-latest', tab: 'market', kind: 'table', type: 'table', q: 'Where does the UK labour market stand in the latest release?', existing: true,
    dims: [{ d: 'Theme', ref: 'th' }, { d: 'Indicator', ref: 'ind' }],
    measures: [{ m: 'Latest Value', ref: 'v', label: 'Latest' }, { m: 'Latest Change on Quarter', ref: 'dq', label: 'Δ quarter' }, { m: 'Latest Change on a Year Earlier', ref: 'dy', label: 'Δ year' }, { m: 'Latest Change vs Pre-Pandemic', ref: 'dp', label: 'Δ vs Feb 2020' }],
    alt: { measures: [{ m: 'Value', ref: 'v', label: 'Average' }, { m: 'Change on Quarter', ref: 'dq', label: 'Δ quarter' }, { m: 'Change on a Year Earlier', ref: 'dy', label: 'Δ year' }, { m: 'Change vs Pre-Pandemic', ref: 'dp', label: 'Δ vs Feb 2020' }] },
    filters: [{ field: 'Geography', op: 'equals', value: 'United Kingdom' }, { field: 'Sex', op: 'equals', value: 'All' }],
    sort: [{ by: 'th', direction: 'asc' }], spark: { m: 'Value', ref: 'sp', label: 'Trend' }, swap: true, clickField: 'Indicator', ...UK,
    widths: { th: 96, v: 84, dq: 76, dy: 72, dp: 96 }, flex: { ind: 190, sp: 80 },
  },


  // ------------------------------------------------------------------ Demand
  ...kpi('k-vac2', 'demand', 'Vacancies', 'How many job vacancies are there in the latest release?', 'Vacancies (000s)', 'Vacancies Change on Year (000s)', 'good', 'How have UK job vacancies moved month by month?'),
  ...kpi('k-red', 'demand', 'Redundancies', 'How many redundancies were there in the latest release?', 'Redundancies (000s)', 'Redundancies Change on Year (000s)', 'bad', 'How have redundancies moved month by month?'),
  {
    id: 'c-sec-chg', tab: 'demand', kind: 'chart', type: 'bar', q: 'Which sectors cut vacancies most over the year?',
    description: 'Change in vacancies on a year earlier by industry sector (000s), latest rolling quarter. Seven sectors only; together they hold 426k of the 702k UK vacancies.',
    filters: [SECTORS], dims: [{ d: 'Sector', ref: 'ind' }], measures: [{ m: 'Sector Vacancy Change on Year (000s)', ref: 'chg' }],
    sort: [{ by: 'chg', direction: 'asc' }], latest: true, signed: true, orientation: 'horizontal', clickField: 'Sector',
  },
  {
    id: 'c-sec-share', tab: 'demand', kind: 'chart', type: 'bar', q: 'What share of sector vacancies does each sector hold?',
    description: "Each sector's share of the vacancies in the seven sectors shown, latest rolling quarter, ranked.",
    filters: [SECTORS], dims: [{ d: 'Sector', ref: 'ind' }], measures: [{ m: 'Share of Sector Vacancies', ref: 'sh' }],
    sort: [{ by: 'sh', direction: 'desc' }], latest: true, orientation: 'horizontal', colors: { sh: C.navy }, clickField: 'Sector',
  },
  {
    id: 'c-sec-trend', tab: 'demand', kind: 'chart', type: 'line', q: 'How have sector vacancies moved since 2019?',
    description: 'Vacancies by industry sector (000s), rolling quarters, January 2019 onward.',
    dims: [{ d: 'Period', ref: 'p' }, { d: 'Sector', ref: 'ind' }], measures: [{ m: 'Sector Vacancies (000s)', ref: 'v' }],
    filters: [SECTORS, { field: 'Year', op: 'greaterThanOrEqual', value: 2019 }],
    sort: [{ by: 'p', direction: 'asc' }], legend: 'right', palette: SERIES, clickField: 'Period',
  },
  {
    id: 't-sec', tab: 'demand', kind: 'table', type: 'table', q: 'How are vacancies changing in each sector?', filters: [SECTORS],
    dims: [{ d: 'Sector', ref: 'ind' }],
    measures: [{ m: 'Latest Value', ref: 'rk', label: 'Rank', rank: 'descending', format: '0' }, { m: 'Latest Value', ref: 'v', label: 'Vac. k' }, { m: 'Latest Change on a Year Earlier', ref: 'chg', label: 'Δ year' }, { m: 'Latest Share of Sector Vacancies', ref: 'sh', label: 'Share' }],
    alt: { measures: [{ m: 'Sector Vacancies (000s)', ref: 'rk', label: 'Rank', rank: 'descending', format: '0' }, { m: 'Sector Vacancies (000s)', ref: 'v', label: 'Vac. k' }, { m: 'Sector Vacancy Change on Year (000s)', ref: 'chg', label: 'Δ year' }, { m: 'Share of Sector Vacancies', ref: 'sh', label: 'Share' }] },
    sort: [{ by: 'v', direction: 'desc' }], spark: { m: 'Sector Vacancies (000s)', ref: 'sp', label: 'Trend' }, swap: true, clickField: 'Sector',
    widths: { rk: 58, v: 88, chg: 64, sh: 62 }, flex: { ind: 162, sp: 70 },
  },


  // ------------------------------------------------------------------ Pay
  ...kpi('k-pay2', 'pay', 'Regular pay growth', 'How fast is regular pay growing in the latest release?', 'Regular Pay Growth', 'Regular Pay Growth Change on Year', 'good', 'How has regular pay growth moved month by month?'),
  ...kpi('k-real', 'pay', 'Real pay growth', 'How fast are real wages growing in the latest release?', 'Real Regular Pay Growth', 'Real Pay Growth Change on Year', 'good', 'How has real pay growth moved month by month?'),
  ...kpi('k-priv', 'pay', 'Private sector pay growth', 'How fast is private sector pay growing in the latest release?', 'Private Sector Pay Growth', 'Private Sector Pay Growth Change on Year', 'good', 'How has private sector pay growth moved month by month?'),
  {
    id: 'c-real', tab: 'pay', kind: 'chart', type: 'line', q: 'Are real wages still growing?', existing: true,
    dims: [{ d: 'Period', ref: 'p' }], measures: [{ m: 'Regular Pay Growth', ref: 'nom', label: 'Nominal' }, { m: 'Real Regular Pay Growth', ref: 'real', label: 'Real (CPIH)' }],
    sort: [{ by: 'p', direction: 'asc' }], colors: { nom: C.navy, real: C.teal }, legend: true, clickField: 'Period',
  },
  {
    id: 'c-sector-pay', tab: 'pay', kind: 'chart', type: 'line', q: 'Is public sector pay outpacing the private sector?', existing: true,
    dims: [{ d: 'Period', ref: 'p' }], measures: [{ m: 'Public Sector Pay Growth', ref: 'pub', label: 'Public' }, { m: 'Private Sector Pay Growth', ref: 'priv', label: 'Private' }],
    sort: [{ by: 'p', direction: 'asc' }], colors: { pub: C.plum, priv: C.sand }, legend: true, clickField: 'Period',
  },
  { id: 'w-cpih', tab: 'pay', kind: 'whatif', type: 'number', label: 'Inflation pay is deflated by', q: 'What inflation rate is pay being deflated by in the latest release?', measures: [{ m: 'Implied CPIH Inflation', ref: 'v' }], latest: true },
  { id: 'w-real', tab: 'pay', kind: 'whatif', type: 'number', label: 'Award after inflation', q: 'What is a pay award worth after inflation?', measures: [{ m: 'Real Value of Pay Award', ref: 'v' }], latest: true, param: 'Pay Award %' },
  { id: 'w-mkt', tab: 'pay', kind: 'whatif', type: 'number', label: 'Award vs private-sector pay', q: 'How does a pay award compare with private sector pay growth?', measures: [{ m: 'Pay Award vs Private Sector Pay Growth', ref: 'v' }], latest: true, param: 'Pay Award %' },
  {
    id: 't-pay', tab: 'pay', kind: 'table', type: 'table', q: 'Which pay measures are moving most?',
    dims: [{ d: 'Indicator', ref: 'ind' }, { d: 'Unit', ref: 'u' }],
    measures: [{ m: 'Latest Value', ref: 'v', label: 'Latest' }, { m: 'Latest Change on a Year Earlier', ref: 'chg', label: 'Δ year' }],
    alt: { measures: [{ m: 'Value', ref: 'v', label: 'Average' }, { m: 'Change on a Year Earlier', ref: 'chg', label: 'Δ year' }] },
    filters: [{ field: 'Theme', op: 'equals', value: 'Pay' }],
    sort: [{ by: 'ind', direction: 'asc' }], spark: { m: 'Value', ref: 'sp', label: 'Trend' }, swap: true, clickField: 'Indicator', ...UK,
  },


  // ------------------------------------------------------------------ Regions
  ...kpi('k-rur', 'regions', 'Unemployment rate, selected regions', 'What is the unemployment rate across the selected regions in the latest release?', 'Regional Unemployment Rate', 'Regional Unemployment Change on a Year Earlier', 'bad', 'How has regional unemployment moved month by month?'),
  ...kpi('k-rer', 'regions', 'Employment rate, selected regions', 'What is the employment rate across the selected regions in the latest release?', 'Regional Employment Rate', 'Regional Employment Change on a Year Earlier', 'good', 'How has the regional employment rate moved month by month?'),
  {
    id: 'c-reg-chg', tab: 'regions', kind: 'chart', type: 'bar', q: 'Which regions have seen unemployment rise most over the year?',
    description: 'Change in each region\'s unemployment rate on a year earlier (percentage points), latest rolling quarter, ranked.',
    dims: [{ d: 'Geography', ref: 'g' }], measures: [{ m: 'Regional Unemployment Change on a Year Earlier', ref: 'chg' }],
    filters: [{ field: 'Theme', op: 'equals', value: 'Regional' }],
    sort: [{ by: 'chg', direction: 'desc' }], latest: true, signed: true, orientation: 'horizontal', clickField: 'Geography',
  },
  {
    id: 'c-reg-heat', tab: 'regions', kind: 'chart', type: 'heatMap', q: 'How has unemployment changed in each region over time?', existing: true,
    dims: [{ d: 'Geography', ref: 'g' }, { d: 'Year', ref: 'y' }], measures: [{ m: 'Regional Unemployment Rate', ref: 'ur' }],
    filters: [{ field: 'Theme', op: 'equals', value: 'Regional' }],
    sort: [{ by: 'g', direction: 'asc' }, { by: 'y', direction: 'asc' }], heat: true, clickField: 'Geography',
  },
  {
    id: 't-reg', tab: 'regions', kind: 'table', type: 'table', q: "How is each region's labour market doing?", existing: true,
    dims: [{ d: 'Geography', ref: 'g', label: 'Region' }],
    measures: [{ m: 'Latest Regional Unemployment Rate', ref: 'ur', label: 'Unemp. %' }, { m: 'Latest Regional Unemployment Change on a Year Earlier', ref: 'urc', label: 'Δ year' }, { m: 'Latest Regional Unemployment Change vs Pre-Pandemic', ref: 'urp', label: 'Δ vs 2020' }, { m: 'Latest Regional Employment Rate', ref: 'er', label: 'Emp. %' }, { m: 'Latest Regional Employment Change on a Year Earlier', ref: 'erc', label: 'Δ year' }],
    alt: { measures: [{ m: 'Regional Unemployment Rate', ref: 'ur', label: 'Unemp. %' }, { m: 'Regional Unemployment Change on a Year Earlier', ref: 'urc', label: 'Δ year' }, { m: 'Regional Unemployment Change vs Pre-Pandemic', ref: 'urp', label: 'Δ vs 2020' }, { m: 'Regional Employment Rate', ref: 'er', label: 'Emp. %' }, { m: 'Regional Employment Change on a Year Earlier', ref: 'erc', label: 'Δ year' }] },
    filters: [{ field: 'Theme', op: 'equals', value: 'Regional' }],
    sort: [{ by: 'ur', direction: 'desc' }], spark: { m: 'Regional Unemployment Rate', ref: 'sp', label: 'Unemployment trend' }, swap: true, clickField: 'Geography',
  },

];

/** Filter controls: one per tab per field (each tab has its own selection group). */
export const FILTERS = [
  ...['market', 'demand', 'pay', 'regions'].map((tab) => ({ id: `f-year-${tab}`, tab, type: 'filter', label: 'Year', field: 'Year' })),
  { id: 'f-geo-regions', tab: 'regions', type: 'filter', label: 'Region', field: 'Geography' },
];

/** Layer measures this catalogue adds beyond the first measure batch (see tools/questions.mjs). */
