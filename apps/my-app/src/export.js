/**
 * The Excel sales-review pack: Summary, Monthly, Customers, Categories, Delivery, Definitions.
 * Every figure comes from the same stored measures as the screen, through engine.getData with the
 * filters passed explicitly: rebuilt from the app-wide selections (mainSel) at the click, never read
 * from a tab's group. Each banner names the selections its rows follow.
 * buildWorkbook() returns the Blob (the smoke test's export probe calls it); downloadWorkbook() saves it.
 * Writer: src/xlsx.js, copied from the ed-wait-watch example. Structure adapted from its export.js.
 */
import { workbookBlob } from './xlsx.js';

const NOTES = {
  'Gross Sales': 'Unit price × quantity on every order line, before discounts. USD.',
  'Order Count': 'Distinct orders placed.',
  'Active Customers': 'Distinct customers who placed at least one order.',
  'Sales per Order': 'Gross sales divided by distinct orders.',
  'On-Time Delivery %': 'Orders shipped early or on time (at least 8 days before the required date) over all orders; unshipped orders count as not on time.',
  'Share of Gross Sales': 'A row\'s gross sales over gross sales across every row of the answer.',
  '… This Month / Same Month Last Year / YoY %': 'On the Review Month axis: the latest month with orders (June 2023 in this data), against the same calendar month a year earlier.',
  '… (12m)': 'On the Trailing 12 Months axis: each of the 12 months to the latest order date, against the same month a year earlier.',
  'Gross Sales Change YoY': 'Review Month gross sales minus the same month a year earlier; a missing side counts as 0, so the rows add up to the total change.',
};
let lastInfo = null;
const asDate = (v) => new Date(typeof v === 'number' ? v : Date.parse(v));
const ym = (v) => { const d = asDate(v); return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 7); };

export const buildWorkbook = async ({ q, selFilters, selText, period }) => {
  const f = selFilters();
  const sel = selText();
  const head = (cols) => cols.map((v) => ({ v, s: 'head' }));
  const title = (text) => [{ v: text, s: 'title' }];
  const banner = (extra = '') => [{ v: `${extra}Selections: ${sel}. Exported ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.`, s: 'subtitle' }];
  const K = [
    ['Gross sales (USD)', 'Gross Sales', 'usdint', 'spct'],
    ['Orders', 'Orders', 'int', 'spct'],
    ['Active customers', 'Active Customers', 'int', 'spct'],
    ['Sales per order (USD)', 'Sales per Order', 'usdint', 'spct'],
  ];
  const [k] = await q({ measures: K.flatMap(([, b]) => [`${b} This Month`, `${b} Same Month Last Year`, `${b} YoY %`]), filters: f });
  const [ot] = await q({ measures: ['On-Time % This Month', 'On-Time % Same Month Last Year', 'On-Time pts Change YoY'], filters: f });
  const kpis = [
    ...K.map(([label, b, fm]) => [{ v: label, s: 'bold' }, { v: k?.[`${b} This Month`] ?? null, s: fm }, { v: k?.[`${b} Same Month Last Year`] ?? null, s: fm }, { v: k?.[`${b} YoY %`] ?? null, s: 'spct' }]),
    [{ v: 'Shipped on time', s: 'bold' }, { v: ot?.['On-Time % This Month'] ?? null, s: 'pct' }, { v: ot?.['On-Time % Same Month Last Year'] ?? null, s: 'pct' }, { v: ot?.['On-Time pts Change YoY'] ?? null, s: 'pp' }],
  ];
  const months = await q({ dims: ['Trailing 12 Months'], measures: ['Gross Sales by Month (12m)', 'Gross Sales Year Earlier (12m)', 'Gross Sales YoY % (12m)'], filters: f });
  const drivers = await q({ dims: ['Customer'], measures: ['Gross Sales Change YoY', 'Gross Sales This Month', 'Gross Sales Same Month Last Year'], filters: f });
  const cust = await q({ dims: ['Customer', 'Country'], measures: ['Gross Sales', 'Share of Gross Sales', 'Order Count', 'Sales per Order'], filters: f });
  const cats = await q({ dims: ['Category'], measures: ['Gross Sales', 'Share of Gross Sales', 'Gross Sales YoY %'], filters: f });
  const ship = await q({ dims: ['Shipper'], measures: ['Order Count', 'On-Time Delivery %', 'Avg Days to Ship', 'Late or Unshipped Orders', 'Avg Freight Price'], filters: f });
  const moved = drivers.filter((r) => Number(r['Gross Sales Change YoY'])).sort((a, b) => a['Gross Sales Change YoY'] - b['Gross Sales Change YoY']);

  const sheets = [
    { name: 'Summary', cols: [28, 16, 18, 14], rows: [
      title('Trading Desk: monthly sales review'),
      banner(`Cards: ${period.now} against ${period.before}. `),
      [],
      head(['Headline', period.now, period.before, 'Change']),
      ...kpis,
    ], merges: ['A1:D1', 'A2:D2'] },
    { name: 'Monthly', cols: [12, 16, 18, 14], freeze: { row: 3 }, rows: [
      title('Gross sales by month against the same month a year earlier'), banner(),
      head(['Month', 'Gross sales', 'A year earlier', 'YoY']),
      ...[...months].sort((a, b) => asDate(a['Trailing 12 Months']) - asDate(b['Trailing 12 Months'])).map((r) => [ym(r['Trailing 12 Months']), { v: r['Gross Sales by Month (12m)'], s: 'usdint' }, { v: r['Gross Sales Year Earlier (12m)'], s: 'usdint' }, { v: r['Gross Sales YoY % (12m)'], s: 'spct' }]),
    ], merges: ['A1:D1'] },
    { name: 'Customers', cols: [34, 14, 16, 10, 10, 14], freeze: { row: 3 }, rows: [
      title('Customers: who moved sales, and who buys most'), banner(`Movers: ${period.now} against ${period.before}. `),
      head(['Customer', 'Change', 'Now', 'A year earlier']),
      ...moved.map((r) => [r.Customer, { v: r['Gross Sales Change YoY'], s: 'susdint' }, { v: r['Gross Sales This Month'] ?? 0, s: 'usdint' }, { v: r['Gross Sales Same Month Last Year'] ?? 0, s: 'usdint' }]),
      [],
      head(['Customer (every month)', 'Country', 'Gross sales', 'Share', 'Orders', 'Per order']),
      ...[...cust].sort((a, b) => b['Gross Sales'] - a['Gross Sales']).map((r) => [r.Customer, r.Country, { v: r['Gross Sales'], s: 'usdint' }, { v: r['Share of Gross Sales'], s: 'pct' }, { v: r['Order Count'], s: 'int' }, { v: r['Sales per Order'], s: 'usdint' }]),
    ], merges: ['A1:F1', 'A2:F2'] },
    { name: 'Categories', cols: [22, 16, 12, 16], freeze: { row: 3 }, rows: [
      title('Product categories'), banner(),
      head(['Category', 'Gross sales', 'Share', `YoY, ${period.now}`]),
      ...[...cats].sort((a, b) => b['Gross Sales'] - a['Gross Sales']).map((r) => [r.Category, { v: r['Gross Sales'], s: 'usdint' }, { v: r['Share of Gross Sales'], s: 'pct' }, { v: r['Gross Sales YoY %'], s: 'spct' }]),
    ], merges: ['A1:D1'] },
    { name: 'Delivery', cols: [20, 10, 12, 12, 12, 14], freeze: { row: 3 }, rows: [
      title('Shippers: on time, speed and cost'), banner(),
      head(['Shipper', 'Orders', 'On time', 'Days to ship', 'Late', 'Freight / order']),
      ...[...ship].sort((a, b) => a['On-Time Delivery %'] - b['On-Time Delivery %']).map((r) => [r.Shipper, { v: r['Order Count'], s: 'int' }, { v: r['On-Time Delivery %'], s: 'pct' }, { v: r['Avg Days to Ship'], s: 'num1' }, { v: r['Late or Unshipped Orders'], s: 'int' }, { v: r['Avg Freight Price'], s: 'usd2' }]),
    ], merges: ['A1:F1'] },
    { name: 'Definitions', cols: [44, 90], rows: [
      title('Definitions (semantic layer Trading Company (1))'), [],
      head(['Measure', 'Definition']),
      ...Object.entries(NOTES).map(([a, b]) => [{ v: a, s: 'bold' }, { v: b, s: 'text' }]),
    ], merges: ['A1:B1'] },
  ];
  const blob = workbookBlob({ sheets, title: 'Trading Desk', author: 'Trading Desk' });
  lastInfo = { selections: sel, sheets: sheets.map((s) => s.name), kpis: kpis.map((r) => [r[0].v, r[1].v, r[2].v, r[3].v]) };
  return blob;
};

/** The header button: build the workbook, then download it. */
export const downloadWorkbook = async (ctx) => {
  const blob = await buildWorkbook(ctx);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `trading-desk-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  window.__lastExport = { at: Date.now(), ...lastInfo };
};
