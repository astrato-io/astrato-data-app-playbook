/**
 * A stand-in field catalogue for the offline compile check, until the smoke test saves the real
 * one (shots/<run>/available-fields.json → tools/available-fields.json). Shapes from the header of
 * kit/verify/compile-check.mjs. node tools/stand-in-fields.mjs > tools/available-fields.json
 */
import { TILES, FILTERS } from '../src/catalogue.js';

const DIMS = {
  'Order Month': ['Orders Updated', 'Orderdate', 'month'], 'Trailing 12 Months': ['Orders Updated', 'Orderdate', 'month'],
  Category: ['Categories', 'Categoryname'], Country: ['Customers', 'Country'], Customer: ['Customers', 'Companyname'],
  Shipper: ['Shippers', 'Companyname'], Salesperson: ['Region and Territory', 'FULLNAME'], 'Delivery Status': ['Shipping Time', 'DeliveryStatus'],
};
const measures = new Set(TILES.flatMap((t) => [...t.measures.map((m) => m.m), ...(t.spark ? [t.spark.m] : [])]));
const out = []; const seen = new Set();
for (const [name, [view, field, dateLevel]] of Object.entries(DIMS)) {
  if (!seen.has(`${view}.${field}`) && seen.add(`${view}.${field}`)) out.push({ kind: 'field', fieldKey: `[${view}].[${field}]`, name: field, view, dataType: dateLevel ? 'date' : 'string', aggregations: [{ name: 'COUNT', distinct: true }] });
  out.push({ kind: 'dimension', fieldKey: `[dimension].[${name}]`, name, item: { key: `[dimension].[${name}]`, name, type: 'dimension', dimension: { view, name: field, resultType: dateLevel ? 'date' : 'string', ...(dateLevel ? { dateLevel } : {}) }, resultType: dateLevel ? 'date' : 'string' } });
}
for (const name of measures) out.push({ kind: 'calculation', fieldKey: `[calculation].[${name}]`, name, item: { key: `[calculation].[${name}]`, name, type: 'calculation', calculation: { calculation: '{m1}' } } });
void FILTERS;
process.stdout.write(JSON.stringify(out, null, 1));
