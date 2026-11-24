// Layer additions for the Trading Company sales-review app (playbook step 4.1).
// Prints the commit_authoring_batch items as JSON: node tools/layer-items.mjs > tools/layer-items.json
const OU = 'Orders Updated', OD = 'Orderdetails', ST = 'Shipping Time';
const agg = (id, aggregation, view, field, extra = {}) => ({ id, kind: 'aggregate', aggregation, field: { view, field }, ...extra });
const ONTIME = { conditions: [{ id: 'c1', field: { view: ST, field: 'DeliveryStatus' }, operator: 'in', value: ['Early', 'On Time'] }] };
const LATE = { conditions: [{ id: 'c1', field: { view: ST, field: 'DeliveryStatus' }, operator: 'in', value: ['Late', 'Not Shipped'] }] };
const fmt = (pattern) => ({ mode: 'custom', pattern });

// Base calculations (inputs, expression, format, description, unit word for the families)
const BASE = {
  'Gross Sales': { inputs: [agg('s', 'SUM', OD, 'Sales')], format: '$#,##0', description: 'Unit price × quantity on every order line, before discounts. USD.' },
  'Order Count': { inputs: [agg('o', 'COUNT', OU, 'Orderid', { distinct: true })], format: '#,##0', description: 'Distinct orders placed.' },
  'Active Customers': { inputs: [agg('c', 'COUNT', OU, 'Customerid', { distinct: true })], format: '#,##0', description: 'Distinct customers who placed at least one order.' },
  'Sales per Order': { inputs: [agg('s', 'SUM', OD, 'Sales'), agg('o', 'COUNT', OU, 'Orderid', { distinct: true })], expression: 's / o', format: '$#,##0', description: 'Gross sales divided by distinct orders. USD.' },
  'On-Time Delivery %': { inputs: [agg('ok', 'COUNT', ST, 'ORDERID', { filter: ONTIME }), agg('all', 'COUNT', ST, 'ORDERID')], expression: 'ok / all', format: '0.0%', description: 'Share of orders shipped early or on time (Shipping Time delivery status Early or On Time). Unshipped orders count as not on time.' },
};
const items = [];
let n = 0;
const measure = (name, def) => items.push({ id: `m${++n}`, entity: 'measure', preparedTarget: null, change: { operation: 'create', name, definition: def } });
const dimension = (name, def) => items.push({ id: `d${++n}`, entity: 'dimension', preparedTarget: null, change: { operation: 'create', name, definition: def } });

for (const [name, b] of Object.entries(BASE)) {
  measure(name, { inputs: b.inputs, ...(b.expression ? { expression: b.expression } : {}), format: fmt(b.format), description: b.description, categories: ['Sales review app'] });
}
measure('Share of Gross Sales', { inputs: [agg('s', 'SUM', OD, 'Sales'), agg('t', 'SUM', OD, 'Sales', { options: { scope: 'total' } })], expression: 's / t', format: fmt('0.0%'), description: 'Gross sales of the row as a share of gross sales across every row of the answer.', categories: ['Sales review app'] });
measure('Avg Days to Ship', { inputs: [agg('d', 'AVG', ST, 'OrderToShipmentDays')], format: fmt('0.0'), description: 'Average days from order date to shipped date, shipped orders only.', categories: ['Sales review app'] });
measure('Late or Unshipped Orders', { inputs: [agg('l', 'COUNT', ST, 'ORDERID', { filter: LATE })], format: fmt('#,##0'), description: 'Orders with delivery status Late or Not Shipped.', categories: ['Sales review app'] });

// Time axes
dimension('Review Month', { kind: 'periodAxis', field: { view: OU, field: 'Orderdate' }, period: 'currentMonth', level: 'month', periodEnd: 'latest', description: 'The latest month with orders in the data (the data ends 2023-06-30), for KPI cards. Compare with the same month a year earlier through a -12 month offset.' });
dimension('Trailing 12 Months', { kind: 'periodAxis', field: { view: OU, field: 'Orderdate' }, period: 'last12Months', level: 'month', periodEnd: 'latest', description: 'The 12 months to the latest order date, one row per month.' });

// Families on Review Month: this month, same month last year, YoY
const YOY = { grain: 'month', offset: -12 };
const fam = (base, short, growthFmt, changeType = 'growth', changeName = `${short} YoY %`) => {
  const b = BASE[base];
  const def = (type, extra) => ({ inputs: b.inputs, ...(b.expression ? { expression: b.expression } : {}), categories: ['Sales review app'], periodComparison: { type, timeAxis: 'Review Month', ...(type === 'current' ? {} : { baseline: YOY }) }, ...extra });
  measure(`${short} This Month`, def('current', { format: fmt(b.format), description: `${base} in the latest month with orders (Review Month).` }));
  measure(`${short} Same Month Last Year`, def('value', { format: fmt(b.format), description: `${base} in the same calendar month a year before the Review Month.` }));
  measure(changeName, def(changeType, { format: fmt(growthFmt), description: changeType === 'growth' ? `${base} in the Review Month against the same month a year earlier, as a growth ratio (0.10 = +10%).` : `${base} in the Review Month minus the same month a year earlier, in percentage points.` }));
};
fam('Gross Sales', 'Gross Sales', '+0.0%;-0.0%;0.0%');
fam('Order Count', 'Orders', '+0.0%;-0.0%;0.0%');
fam('Active Customers', 'Active Customers', '+0.0%;-0.0%;0.0%');
fam('Sales per Order', 'Sales per Order', '+0.0%;-0.0%;0.0%');
fam('On-Time Delivery %', 'On-Time %', '+0.0" pts";-0.0" pts";0.0" pts"', 'diff', 'On-Time pts Change YoY');
measure('Gross Sales Change YoY', { inputs: BASE['Gross Sales'].inputs, categories: ['Sales review app'], periodComparison: { type: 'diff', timeAxis: 'Review Month', baseline: YOY }, format: fmt('+$#,##0;-$#,##0;$0'), description: 'Gross sales in the Review Month minus the same month a year earlier. USD. Per member, the changes add up to the total change.' });

// Trailing 12 months, month by month, against the same month a year earlier
const T = (type, extra) => ({ inputs: BASE['Gross Sales'].inputs, categories: ['Sales review app'], periodComparison: { type, timeAxis: 'Trailing 12 Months', ...(type === 'current' ? {} : { baseline: YOY }) }, ...extra });
measure('Gross Sales by Month (12m)', T('current', { format: fmt('$#,##0'), description: 'Gross sales per month over the 12 months to the latest order date.' }));
measure('Gross Sales Year Earlier (12m)', T('value', { format: fmt('$#,##0'), description: 'Gross sales in the same month a year earlier, for each of the trailing 12 months.' }));
measure('Gross Sales YoY % (12m)', T('growth', { format: fmt('+0.0%;-0.0%;0.0%'), description: 'Each trailing month against the same month a year earlier, as a growth ratio. Empty where the year-earlier month has no data (before Oct 2022).' }));

// Plain dimensions
const fd = (name, view, field, description, extra = {}) => dimension(name, { kind: 'field', field: { view, field }, description, ...extra });
fd('Order Month', OU, 'Orderdate', 'Order date grouped by month.', { dateLevel: 'month' });
fd('Category', 'Categories', 'Categoryname', 'Product category (8).');
fd('Country', 'Customers', 'Country', 'Customer country (21).');
fd('Customer', 'Customers', 'Companyname', 'Customer company name (89).');
fd('Shipper', 'Shippers', 'Companyname', 'Shipping company (3).');
fd('Salesperson', 'Region and Territory', 'FULLNAME', 'Employee who took the order (9).');
fd('Sales Region', 'Region and Territory', 'REGIONDESCRIPTION', 'Sales region of the employee who took the order (4).');
fd('Delivery Status', ST, 'DeliveryStatus', 'Early, On Time, Late (shipped fewer than 8 days before the required date) or Not Shipped.');
fd('Product', 'Products', 'Productname', 'Product name (77).');

console.log(JSON.stringify(items));
