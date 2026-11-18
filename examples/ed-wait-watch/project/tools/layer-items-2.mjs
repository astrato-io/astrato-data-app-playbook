// Second batch of NEW layer items (rev 34+): every entry is a create; nothing existing changes.
//   node tools/layer-items-2.mjs > tools/layer-items-2.json
const V = 'ER Visits';
const f = (view, field) => ({ view, field });
const wait = f(V, 'Patient Waittime');
const count = (id, filter) => ({ id, kind: 'aggregate', aggregation: 'COUNT', field: f(V, 'Patient ID'), ...(filter ? { filter } : {}) });
const within = { conditions: [{ id: 'w', field: wait, operator: 'less_than_or_equal', value: 30 }] };
const over = { conditions: [{ id: 'o', field: wait, operator: 'greater_than', value: 30 }] };
const fmt = (pattern) => ({ mode: 'custom', pattern });
const items = [];
const measure = (name, definition) => items.push({ id: `m${items.length}`, entity: 'measure', preparedTarget: null, change: { operation: 'create', name, definition } });
const dimension = (name, definition) => items.push({ id: `d${items.length}`, entity: 'dimension', preparedTarget: null, change: { operation: 'create', name, definition } });

// Weekday names that sort Monday first without a visible number: each later day carries one more
// zero-width space (U+200B) in front, which sorts after every letter and does not print.
const DAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [0, 'Sun']];
dimension('Arrival Day', { kind: 'mapping', resultType: 'string', field: f(V, 'Weekday Num'),
  description: 'Weekday of the arrival as a short name (Mon ... Sun). Sorts Monday first: each later day carries invisible zero-width spaces in front of its name.',
  groups: DAYS.map(([n, name], i) => ({ value: `${'\u200B'.repeat(i)}${name}`, filter: { conditions: [{ id: 'd', field: f(V, 'Weekday Num'), operator: 'equals', value: n }] } })) });

const review = (type) => ({ type, timeAxis: 'Review Month' });
measure('Seen Within Target pts Change vs Last Month', { description: 'Change in the share of visits seen within 30 minutes, in percentage points: latest month to date minus the same days of the month before (Review Month axis).',
  inputs: [count('a', within), count('b')], expression: '{a}/{b}*100', format: fmt('+0.0" pts";-0.0" pts";0.0" pts"'), periodComparison: review('diff') });
const overFamily = [['Patients Over Target This Month', 'current', '#,##0', 'for the latest month to date'], ['Patients Over Target Last Month', 'value', '#,##0', 'for the same days of the month before'], ['Patients Over Target Change vs Last Month', 'diff', '+#,##0;-#,##0;0', 'change: latest month to date minus the same days of the month before']];
for (const [name, type, pattern, label] of overFamily) measure(name, { description: `Visits that waited longer than 30 minutes ${label}, on the Review Month axis.`, inputs: [count('a', over)], format: fmt(pattern), periodComparison: review(type) });
process.stdout.write(JSON.stringify(items));
