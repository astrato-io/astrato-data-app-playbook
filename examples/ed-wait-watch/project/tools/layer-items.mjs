// Generates the batch of new layer items (measures + dimensions) committed over MCP.
// Nothing here changes an existing item: every entry is a create.
const V = 'ER Visits', F = 'Er Wait Flags', E = 'Er Wait Flag Events';
const f = (view, field) => ({ view, field });
const wait = f(V, 'Patient Waittime');
const count = (id, filter) => ({ id, kind: 'aggregate', aggregation: 'COUNT', field: f(V, 'Patient ID'), ...(filter ? { filter } : {}) });
const within = (param) => ({ conditions: [{ id: 'w', field: wait, operator: 'less_than_or_equal', value: param ? { kind: 'parameter', name: 'Target Minutes', default: 30 } : 30 }] });
const over = (param) => ({ conditions: [{ id: 'o', field: wait, operator: 'greater_than', value: param ? { kind: 'parameter', name: 'Target Minutes', default: 30 } : 30 }] });
const avg = (id, field) => ({ id, kind: 'aggregate', aggregation: 'AVG', field: f(V, field) });
const fmt = (pattern) => ({ mode: 'custom', pattern });
const items = [];
const measure = (name, definition) => items.push({ id: `m${items.length}`, entity: 'measure', preparedTarget: null, change: { operation: 'create', name, definition } });
const dimension = (name, definition) => items.push({ id: `d${items.length}`, entity: 'dimension', preparedTarget: null, change: { operation: 'create', name, definition } });

// ---- time axis: the latest month in the data, to date (data ends 30 Oct 2020)
dimension('Review Month', { kind: 'periodAxis', field: f(V, 'Er Day'), level: 'month', period: 'monthToDate', periodEnd: 'latest',
  description: 'Time axis for the morning review: the latest month in the data to its latest day (1-30 Oct 2020 in this extract), compared with the same days of the month before.' });
dimension('Wait Band', { kind: 'mapping', resultType: 'string', field: wait, description: 'Minutes waited before being seen, in 10-minute bands (waits run from 10 to 60 minutes). Labels sort in order.',
  groups: [[10, 19], [20, 29], [30, 39], [40, 49], [50, 60]].map(([a, b]) => ({ value: `${a}-${b === 60 ? 60 : b} min`, filter: { conditions: [{ id: 'b', field: wait, operator: 'between', value: [a, b] }] } })) });

// ---- base measures
measure('Seen Within Target %', { description: 'Share of ER visits seen within the waiting-time target (30 minutes unless the Target Minutes parameter is set): visits waiting no longer than the target divided by all visits. Ratio of counts, so it re-weights correctly under any selection.',
  inputs: [count('a', within(true)), count('b')], expression: '{a}/{b}', format: fmt('0.0%') });
measure('Patients Over Target', { description: 'Number of ER visits that waited longer than the target (30 minutes unless the Target Minutes parameter is set).', inputs: [count('a', over(true))], format: fmt('#,##0') });
measure('Share of Over-Target Patients', { description: 'This row\'s share of all visits that waited longer than 30 minutes in the current selection: over-target visits in the row divided by over-target visits across the whole result.',
  inputs: [count('a', over(false)), { ...count('b', over(false)), options: { scope: 'total' } }], expression: '{a}/{b}', format: fmt('0.0%') });

// ---- period-comparison families on Review Month
const family = (base, inputs, expression, valueFmt, changeFmt, what) => {
  const def = (type, pattern, label) => ({ description: `${what} ${label}, on the Review Month axis (latest month to date compared with the same days of the month before).`, inputs, ...(expression ? { expression } : {}), format: fmt(pattern), periodComparison: { type, timeAxis: 'Review Month' } });
  measure(`${base} This Month`, def('current', valueFmt, 'for the latest month to date'));
  measure(`${base} Last Month`, def('value', valueFmt, 'for the same days of the month before'));
  measure(`${base} Change vs Last Month`, def('diff', changeFmt, 'change: latest month to date minus the same days of the month before'));
};
family('Seen Within Target %', [count('a', within(false)), count('b')], '{a}/{b}', '0.0%', '+0.0%;-0.0%;0.0%', 'Share of visits seen within 30 minutes,');
family('Avg Wait Time', [avg('a', 'Patient Waittime')], null, '#,##0.0', '+0.0;-0.0;0.0', 'Average minutes waited before being seen,');
family('Avg Satisfaction', [avg('a', 'Patient Sat Score')], null, '#,##0.0', '+0.0;-0.0;0.0', 'Average satisfaction score (1-10, visits with a score),');
family('Patients', [count('a')], null, '#,##0', '+#,##0;-#,##0;0', 'ER visits,');

// ---- flags (writeback views)
const fc = (id, filter) => ({ id, kind: 'aggregate', aggregation: 'COUNT', field: f(F, 'Flag ID'), ...(filter ? { filter } : {}) });
const live = { id: 's', field: f(F, 'Status'), operator: 'in', value: ['Open', 'In progress'] };
measure('Flags Raised', { description: 'Number of waiting-time flags raised by duty managers.', inputs: [fc('a')], format: fmt('#,##0') });
measure('Open Flags', { description: 'Flags not yet resolved: status Open or In progress.', inputs: [fc('a', { conditions: [live] })], format: fmt('#,##0') });
measure('Overdue Flags', { description: 'Open or in-progress flags whose due date is before today.', inputs: [fc('a', { conditions: [live, { id: 'd', field: f(F, 'Due Date'), operator: 'less_than', value: { kind: 'predefined_date', date: 'today' } }] })], format: fmt('#,##0') });
measure('Flags Awaiting Sign-off', { description: 'Flags the owner has marked Resolved and the ED operations lead has not yet closed.', inputs: [fc('a', { conditions: [{ id: 's', field: f(F, 'Status'), operator: 'equals', value: 'Resolved' }] })], format: fmt('#,##0') });
measure('Flag Events', { description: 'Number of audit events recorded against flags.', inputs: [{ id: 'a', kind: 'aggregate', aggregation: 'COUNT', field: f(E, 'Event ID') }], format: fmt('#,##0') });

const fd = (name, view, field, description) => dimension(name, { kind: 'field', field: f(view, field), description });
fd('Flag ID', F, 'Flag ID', 'Identifier of a waiting-time flag.');
fd('Flag Raised At', F, 'Created At', 'When the flag was raised (UTC).');
fd('Flag Raised By', F, 'Created By', 'Who raised the flag.');
fd('Flag Scope', F, 'Scope', 'What the flag is about: a time slot or a department.');
fd('Flag Department', F, 'Department', 'Department the flag concerns, or "Any".');
fd('Flag Weekday', F, 'Weekday', 'Weekday of the flagged time slot, or "Any".');
fd('Flag Time Band', F, 'Time Band', 'Three-hour arrival band of the flagged time slot, or "Any".');
fd('Flag Issue', F, 'Issue', 'What the duty manager saw.');
fd('Flag Owner', F, 'Owner', 'The named person who owns the follow-up.');
fd('Flag Due Date', F, 'Due Date', 'Date the owner is due to report back.');
fd('Flag Status', F, 'Status', 'Open, In progress, Resolved (owner done, awaiting sign-off) or Closed (signed off by the ED operations lead).');
fd('Flag Updated At', F, 'Updated At', 'When the flag last changed (UTC).');
fd('Event Flag ID', E, 'Flag ID', 'The flag an audit event belongs to.');
fd('Event Time', E, 'Event At', 'When the audit event happened (UTC).');
fd('Event Actor', E, 'Actor', 'Who made the change.');
fd('Event Role', E, 'Actor Role', 'The role they acted in.');
fd('Event Action', E, 'Action', 'What they did: raised, started, resolved, closed, reopened, reassigned.');
fd('Event From Status', E, 'From Status', 'Flag status before the event.');
fd('Event To Status', E, 'To Status', 'Flag status after the event.');
fd('Event Note', E, 'Note', 'The reason or note given with the change.');

process.stdout.write(JSON.stringify(items));
