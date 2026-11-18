// Builds the additive measure batch for the layer. Run: node tools/layer-measures.mjs > tools/measures-batch.json
const V = 'Labour Market';
const f = (field) => ({ view: V, field });
const cdid = (id, v) => ({ id, field: f('Cdid'), operator: 'equals', value: v });
const prevSet = { id: 'p', field: f('Value Prev Year'), operator: 'is_set' };
const PP = '+0.0" pp";-0.0" pp";0.0" pp"';
const guarded = (name, code, pattern, description, cat) => ({
  name, definition: {
    description, categories: [cat],
    inputs: [
      { id: 'cur', kind: 'aggregate', aggregation: 'AVG', field: f('Value'), filter: { conditions: [cdid('c', code), prevSet] } },
      { id: 'prev', kind: 'aggregate', aggregation: 'AVG', field: f('Value Prev Year'), filter: { conditions: [cdid('c', code), prevSet] } },
    ],
    expression: 'cur - prev', format: { mode: 'custom', pattern },
  },
});
const avg = (id, code) => ({ id, kind: 'aggregate', aggregation: 'AVG', field: f('Value'), filter: { conditions: [cdid('c', code)] } });
const sectors = { conditions: [{ id: 's', field: f('Indicator'), operator: 'like', value: 'Vacancies: *' }] };
const regional = [{ id: 't', field: f('Theme'), operator: 'equals', value: 'Regional' }, { id: 'i', field: f('Indicator'), operator: 'equals', value: 'Unemployment rate' }, prevSet];
const measures = [
  guarded('Unemployment Rate Change on Year', 'MGSX', PP, 'UK unemployment rate (MGSX) minus its value 12 months earlier, percentage points. Empty where there is no reading a year earlier (never the value itself).', 'Unemployment'),
  guarded('Unemployed per Vacancy Change on Year', 'JPC5', '+0.00;-0.00;0.00', 'Unemployed people per vacancy (JPC5) minus its value 12 months earlier. Up means a looser market. Empty where there is no prior year.', 'Vacancies'),
  guarded('Vacancies Change on Year (000s)', 'AP2Y', '+#,##0"k";-#,##0"k";0"k"', 'UK vacancies (AP2Y, 000s) minus the value 12 months earlier. Empty where there is no prior year.', 'Vacancies'),
  guarded('Regular Pay Growth Change on Year', 'KAI9', PP, 'Nominal regular pay growth (KAI9) minus its value 12 months earlier, percentage points. Empty where there is no prior year.', 'Pay'),
  guarded('Real Pay Growth Change on Year', 'A2FA', PP, 'Real regular pay growth (A2FA) minus its value 12 months earlier, percentage points. Empty where there is no prior year.', 'Pay'),
  guarded('Private Sector Pay Growth Change on Year', 'KAJ4', PP, 'Private sector regular pay growth (KAJ4) minus its value 12 months earlier, percentage points. Empty where there is no prior year.', 'Pay'),
  { name: 'Implied CPIH Inflation', definition: {
    description: 'Nominal regular pay growth (KAI9) minus real regular pay growth (A2FA), %: the CPIH inflation rate ONS used to deflate pay, to rounding.', categories: ['Pay'],
    inputs: [avg('nom', 'KAI9'), avg('real', 'A2FA')], expression: 'nom - real', format: { mode: 'custom', pattern: '0.0"%"' } } },
  { name: 'Real Value of Pay Award', definition: {
    description: 'What-if: a pay award of "Pay Award %" minus implied CPIH inflation (KAI9 - A2FA), percentage points. Positive means the award beats inflation.', categories: ['Pay', 'What-if'],
    inputs: [{ id: 'award', kind: 'parameter', name: 'Pay Award %', default: 4 }, avg('nom', 'KAI9'), avg('real', 'A2FA')],
    expression: 'award - (nom - real)', format: { mode: 'custom', pattern: PP } } },
  { name: 'Pay Award vs Private Sector Pay Growth', definition: {
    description: 'What-if: a pay award of "Pay Award %" minus private sector regular pay growth (KAJ4), percentage points. Positive means the award beats the going rate.', categories: ['Pay', 'What-if'],
    inputs: [{ id: 'award', kind: 'parameter', name: 'Pay Award %', default: 4 }, avg('mkt', 'KAJ4')],
    expression: 'award - mkt', format: { mode: 'custom', pattern: PP } } },
  { name: 'Change on a Year Earlier', definition: {
    description: "Value minus the value 12 months earlier in the series' own unit, counting only rows that have a reading a year earlier (unlike Change on Year, which returns the value itself when there is none).", categories: ['Generic'],
    inputs: [
      { id: 'cur', kind: 'aggregate', aggregation: 'AVG', field: f('Value'), filter: { conditions: [prevSet] } },
      { id: 'prev', kind: 'aggregate', aggregation: 'AVG', field: f('Value Prev Year'), filter: { conditions: [prevSet] } },
    ], expression: 'cur - prev', format: { mode: 'custom', pattern: '+#,##0.0;-#,##0.0;0.0' } } },
  { name: 'Sector Vacancies (000s)', definition: {
    description: 'Vacancies in one industry sector, thousands (indicators "Vacancies: ..."). Use with Indicator; 7 sectors only, not the full SIC breakdown.', categories: ['Vacancies'],
    inputs: [{ id: 'v', kind: 'aggregate', aggregation: 'AVG', field: f('Value'), filter: sectors }], format: { mode: 'custom', pattern: '#,##0"k"' } } },
  { name: 'Share of Sector Vacancies', definition: {
    description: "A sector's vacancies as a share of the 7 sectors shown (not of all UK vacancies). Use with Indicator and one period.", categories: ['Vacancies'],
    inputs: [
      { id: 'part', kind: 'aggregate', aggregation: 'SUM', field: f('Value'), filter: sectors },
      { id: 'whole', kind: 'aggregate', aggregation: 'SUM', field: f('Value'), filter: sectors, options: { scope: 'total' } },
    ], expression: 'part / whole', format: { mode: 'custom', pattern: '0.0%' } } },
  { name: 'Regional Unemployment Change on a Year Earlier', definition: {
    description: "Change in a region's unemployment rate on a year earlier, percentage points, counting only rows with a reading a year earlier.", categories: ['Regional'],
    inputs: [
      { id: 'cur', kind: 'aggregate', aggregation: 'AVG', field: f('Value'), filter: { conditions: regional } },
      { id: 'prev', kind: 'aggregate', aggregation: 'AVG', field: f('Value Prev Year'), filter: { conditions: regional } },
    ], expression: 'cur - prev', format: { mode: 'custom', pattern: PP } } },
];
console.log(JSON.stringify(measures.map((m, i) => ({ id: `m${i}`, entity: 'measure', preparedTarget: null, change: { operation: 'create', name: m.name, definition: m.definition } }))));
