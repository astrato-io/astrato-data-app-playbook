/**
 * Every native object of "Trading Desk", declared once as data.
 *
 * Each tile names the stored business question it stands for (`q`): tools/questions.mjs turns
 * these declarations into the layer's stored questions, and tiles.js turns them into visualization
 * definitions. Names are semantic-layer item names, never field keys.
 *
 * Copied technique (not structure): the tile-as-data catalogue of the ed-wait-watch example.
 */
export const C = {
  ink: '#1B2430', green: '#2F5D50', greenSoft: '#A9C7BC', copper: '#C7853F', copperSoft: '#E8C9A3',
  good: '#1E7B4F', bad: '#B3261E', grey: '#6B7280', line: '#E2DED4', page: '#F5F3EE', slate: '#55657A',
};
export const SERIES = [C.green, C.copper, C.slate, C.greenSoft];

export const TABS = [
  { key: 'overview', label: 'Overview', question: 'Is sales growth holding up?' },
  { key: 'customers', label: 'Customers', question: 'Where are sales concentrated, and who slowed?' },
  { key: 'delivery', label: 'Delivery', question: 'Are orders shipping on time?' },
];

/**
 * KPI: a number on the stored "This Month" measure with the stored YoY measure as its comparison,
 * and a month-by-month mini line of the base measure. `up` is 'good', 'bad' or 'neutral'.
 */
const kpi = (id, tab, label, unit, q, short, base, up, sparkQ, extra = {}) => [
  { id, tab, kind: 'kpi', type: 'number', label, unit, q, up,
    measures: [{ m: `${short} This Month`, ref: 'v' }, { m: extra.cmp ?? `${short} YoY %`, ref: 'd', role: 'comparison' }],
    prior: `${short} Same Month Last Year`, pts: Boolean(extra.pts),
    description: `${label} in the latest month with orders (the Review Month axis, read as of the latest order date), with its change on the same month a year earlier.`, ...extra },
  { id: `${id}-sp`, tab, kind: 'spark', type: 'line', q: sparkQ,
    dims: [{ d: 'Order Month', ref: 'p' }], measures: [{ m: base, ref: 'v' }],
    sort: [{ by: 'p', direction: 'asc' }], color: extra.sparkColor ?? C.green, description: `${label} by order month, every month on record.` },
];
const KPI = {
  sales: ['Gross sales', 'USD', 'How much did we sell in the latest month, against the same month last year?', 'Gross Sales', 'Gross Sales', 'good', 'How have gross sales moved month by month?', { hero: true }],
  orders: ['Orders', '', 'How many orders did we take in the latest month, against the same month last year?', 'Orders', 'Order Count', 'good', 'How many orders did we take each month?', { sparkColor: C.slate }],
  cust: ['Active customers', '', 'How many customers ordered in the latest month, against the same month last year?', 'Active Customers', 'Active Customers', 'good', 'How many customers ordered each month?', { sparkColor: C.slate }],
  spo: ['Sales per order', 'USD', 'How much was an average order worth in the latest month, against the same month last year?', 'Sales per Order', 'Sales per Order', 'good', 'How has the value of an average order moved month by month?', { sparkColor: C.copper }],
  otd: ['Shipped on time', '% of orders', 'What share of the latest month\'s orders shipped on time, against the same month last year?', 'On-Time %', 'On-Time Delivery %', 'good', 'What share of orders shipped on time each month?', { cmp: 'On-Time pts Change YoY', pts: true, sparkColor: C.copper }],
};
const kpiOf = (id, tab, key, extra = {}) => { const [label, unit, q, short, base, up, sparkQ, x] = KPI[key]; return kpi(id, tab, label, unit, q, short, base, up, sparkQ, { ...x, ...extra }); };

export const TILES = [
  // ------------------------------------------------------------------ Overview
  ...kpiOf('k-sales', 'overview', 'sales'),
  ...kpiOf('k-orders', 'overview', 'orders'),
  ...kpiOf('k-cust', 'overview', 'cust'),
  ...kpiOf('k-spo', 'overview', 'spo'),
  ...kpiOf('k-otd', 'overview', 'otd'),
  {
    id: 'c-trend', tab: 'overview', kind: 'chart', type: 'line', q: 'How do monthly gross sales compare with the same month a year earlier?',
    sub: 'USD, the 12 months to the latest order date. Green: this year; copper: a year earlier. Points select nothing',
    description: 'Gross sales for each of the trailing 12 months against the same month a year earlier (Trailing 12 Months axis).',
    dims: [{ d: 'Trailing 12 Months', ref: 'p' }],
    measures: [{ m: 'Gross Sales by Month (12m)', ref: 'v', label: 'This year' }, { m: 'Gross Sales Year Earlier (12m)', ref: 'py', label: 'A year earlier' }],
    sort: [{ by: 'p', direction: 'asc' }], colors: { v: C.green, py: C.copper }, legend: true, compact: true,
  },
  {
    id: 'c-growth', tab: 'overview', kind: 'chart', type: 'bar', q: 'Is year-on-year sales growth slowing?',
    sub: 'Each month against the same month a year earlier. Jul–Sep 2022 have no year-earlier month. Bars select nothing',
    description: 'Gross sales growth on the same month a year earlier, for each of the trailing 12 months.',
    dims: [{ d: 'Trailing 12 Months', ref: 'p' }], measures: [{ m: 'Gross Sales YoY % (12m)', ref: 'v' }],
    sort: [{ by: 'p', direction: 'asc' }], color: C.green, noSelect: true, pct: true,
  },
  {
    id: 't-drivers', tab: 'overview', kind: 'table', type: 'table', q: 'Which customers moved gross sales on the same month a year earlier?',
    sub: 'Latest month against the same month a year earlier, biggest fall first. Changes add up to the total change. Click a row to select the customer',
    description: 'A bridge of the year-on-year change in the Review Month: for each customer, gross sales now, a year earlier and the change (the changes add up to the total), with the monthly trend.',
    dims: [{ d: 'Customer', ref: 'c', label: 'Customer' }],
    measures: [{ m: 'Gross Sales Change YoY', ref: 'd', label: 'Change' }, { m: 'Gross Sales This Month', ref: 'n', label: 'Now' }, { m: 'Gross Sales Same Month Last Year', ref: 'b', label: 'Year earlier' }],
    sort: [{ by: 'd', direction: 'asc' }], spark: { m: 'Gross Sales', ref: 'sp', label: 'By month', color: C.green }, clickField: 'Customer',
    widths: { d: 86, n: 78, b: 92 }, rowHeight: 24, flex: { c: 150, sp: 90 }, fontSize: 12,
  },

  // ------------------------------------------------------------------ Customers
  {
    id: 'c-cat', tab: 'customers', kind: 'chart', type: 'bar', q: 'Which product categories sell most?',
    sub: 'Gross sales, USD, every month on record. Click a bar to select the category',
    description: 'Gross sales by product category, largest first.',
    dims: [{ d: 'Category', ref: 'c' }], measures: [{ m: 'Gross Sales', ref: 'v' }],
    sort: [{ by: 'v', direction: 'desc' }], color: C.green, orientation: 'horizontal', clickField: 'Category', compact: true,
  },
  {
    id: 'c-catyoy', tab: 'customers', kind: 'chart', type: 'bar', q: 'Which categories grew on the same month a year earlier?',
    sub: 'Latest month against the same month a year earlier, worst first',
    description: 'Gross sales growth by category in the Review Month against the same month a year earlier.',
    dims: [{ d: 'Category', ref: 'c' }], measures: [{ m: 'Gross Sales YoY %', ref: 'v' }],
    sort: [{ by: 'v', direction: 'asc' }], color: C.copper, orientation: 'horizontal', clickField: 'Category', pct: true,
  },
  {
    id: 'c-country', tab: 'customers', kind: 'chart', type: 'bar', q: 'Which ten countries buy most?',
    sub: 'Gross sales, USD, every month on record, top 10 of 21. Click a bar to select the country',
    description: 'Gross sales by customer country, the ten largest.',
    dims: [{ d: 'Country', ref: 'c' }], measures: [{ m: 'Gross Sales', ref: 'v' }],
    sort: [{ by: 'v', direction: 'desc' }], topN: 10, color: C.green, clickField: 'Country', compact: true,
  },
  {
    id: 't-cust', tab: 'customers', kind: 'table', type: 'table', q: 'Who are our biggest customers, and how concentrated are sales?',
    sub: 'Every month on record. Rank 1 = largest; share = share of gross sales in the selection. Click a row to select the customer',
    description: 'Each customer: rank by gross sales, gross sales, share of gross sales, orders and sales per order, with the monthly trend.',
    dims: [{ d: 'Customer', ref: 'c', label: 'Customer' }, { d: 'Country', ref: 'k', label: 'Country' }],
    measures: [{ m: 'Gross Sales', ref: 'rk', label: 'Rank', rank: 'descending' }, { m: 'Gross Sales', ref: 'v', label: 'Gross sales' }, { m: 'Share of Gross Sales', ref: 'sh', label: 'Share' }, { m: 'Order Count', ref: 'o', label: 'Orders' }, { m: 'Sales per Order', ref: 'a', label: 'Per order' }],
    sort: [{ by: 'v', direction: 'desc' }], spark: { m: 'Gross Sales', ref: 'sp', label: 'By month', color: C.green }, clickField: 'Customer',
    widths: { rk: 52, v: 92, sh: 62, o: 62, a: 78, k: 86 }, rowHeight: 24, flex: { c: 160, sp: 96 }, fontSize: 12,
  },

  // ------------------------------------------------------------------ Delivery
  ...kpiOf('kd-otd', 'delivery', 'otd'),
  ...kpiOf('kd-orders', 'delivery', 'orders'),
  {
    id: 'c-shipper', tab: 'delivery', kind: 'chart', type: 'bar', q: 'Which shipper ships on time most often?',
    sub: 'Share of orders shipped early or on time, every month on record. Click a bar to select the shipper',
    description: 'On-time delivery rate by shipping company.',
    dims: [{ d: 'Shipper', ref: 's' }], measures: [{ m: 'On-Time Delivery %', ref: 'v' }],
    sort: [{ by: 'v', direction: 'asc' }], color: C.green, orientation: 'horizontal', clickField: 'Shipper', pct: true,
  },
  {
    id: 'c-status', tab: 'delivery', kind: 'chart', type: 'bar', q: 'How have delivery outcomes moved month by month?',
    sub: 'Orders by delivery status and order month. Late = shipped fewer than 8 days before the required date. Click a segment to select the status',
    description: 'Orders by delivery status (Early, On Time, Late, Not Shipped) for every order month.',
    dims: [{ d: 'Order Month', ref: 'p' }, { d: 'Delivery Status', ref: 's' }], measures: [{ m: 'Order Count', ref: 'v' }],
    sort: [{ by: 'p', direction: 'asc' }], stacked: true, legend: true, clickField: 'Delivery Status',
    statusColors: { Early: C.green, 'On Time': C.greenSoft, Late: C.bad, 'Not Shipped': C.grey },
  },
  {
    id: 't-shipper', tab: 'delivery', kind: 'table', type: 'table', q: 'How does each shipper perform on time, speed and cost?',
    sub: 'Every month on record. Days = order date to shipped date. Click a row to select the shipper',
    description: 'Each shipper: orders, on-time delivery rate, average days to ship, late or unshipped orders and average freight per order, with the monthly trend of orders.',
    dims: [{ d: 'Shipper', ref: 's', label: 'Shipper' }],
    measures: [{ m: 'Order Count', ref: 'o', label: 'Orders' }, { m: 'On-Time Delivery %', ref: 'ot', label: 'On time' }, { m: 'Avg Days to Ship', ref: 'd', label: 'Days' }, { m: 'Late or Unshipped Orders', ref: 'l', label: 'Late' }, { m: 'Avg Freight Price', ref: 'f', label: 'Freight', fmt: 'usd' }],
    sort: [{ by: 'ot', direction: 'asc' }], spark: { m: 'Order Count', ref: 'sp', label: 'Orders by month', color: C.slate }, clickField: 'Shipper',
    widths: { o: 66, ot: 72, d: 56, l: 56, f: 70 }, rowHeight: 26, flex: { s: 130, sp: 110 }, fontSize: 12,
  },
  {
    id: 'c-rep', tab: 'delivery', kind: 'chart', type: 'bar', q: 'Whose orders ship late most often?',
    sub: 'Share of each salesperson\'s orders shipped early or on time, every month on record, worst first',
    description: 'On-time delivery rate by the salesperson who took the order.',
    dims: [{ d: 'Salesperson', ref: 'r' }], measures: [{ m: 'On-Time Delivery %', ref: 'v' }],
    sort: [{ by: 'v', direction: 'asc' }], color: C.copper, orientation: 'horizontal', clickField: 'Salesperson', pct: true,
  },
];

/** Filter controls, one set per tab (each tab has its own selection group). */
const FILTER_FIELDS = [['Category', 'Category'], ['Country', 'Country'], ['Shipper', 'Shipper'], ['Salesperson', 'Salesperson']];
export const FILTERS = TABS.flatMap(({ key: tab }) => FILTER_FIELDS.map(([label, field]) => ({ id: `f-${tab}-${field.toLowerCase()}`, tab, type: 'filter', label, field })));
