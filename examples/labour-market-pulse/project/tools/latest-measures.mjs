/**
 * Third additive batch: "latest release" measures that carry the Period Status filter inside the
 * measure, so a table can show the latest reading beside a sparkline over the whole history.
 * Also replaces two of this app's own questions to use them. Run: node tools/latest-measures.mjs
 */
const V = 'Labour Market';
const f = (field) => ({ view: V, field });
const latest = { id: 'l', field: f('Period Status'), operator: 'equals', value: 'Latest' };
const prevSet = { id: 'p', field: f('Value Prev Year'), operator: 'is_set' };
const regional = (indicator) => [{ id: 't', field: f('Theme'), operator: 'equals', value: 'Regional' }, { id: 'i', field: f('Indicator'), operator: 'equals', value: indicator }];
const sectors = { id: 's', field: f('Indicator'), operator: 'like', value: 'Vacancies: *' };
const PP = '+0.0" pp";-0.0" pp";0.0" pp"';
const avg = (id, field, conditions) => ({ id, kind: 'aggregate', aggregation: 'AVG', field: f(field), filter: { conditions } });
const diff = (name, field, conditions, pattern, description, cat) => ({ name, definition: { description, categories: [cat], expression: 'cur - prev', format: { mode: 'custom', pattern }, inputs: [avg('cur', 'Value', conditions), avg('prev', field, conditions)] } });
const one = (name, conditions, pattern, description, cat) => ({ name, definition: { description, categories: [cat], inputs: [avg('v', 'Value', conditions)], format: { mode: 'custom', pattern } } });

const measures = [
  one('Latest Value', [latest], '#,##0.0', 'The latest published reading of a series (Period Status = Latest), whatever period is selected. Only meaningful with one series in context.', 'Generic'),
  diff('Latest Change on Quarter', 'Value Prev Quarter', [latest], '+#,##0.0;-#,##0.0;0.0', 'Latest reading minus the reading 3 months earlier, in the series\' own unit.', 'Generic'),
  diff('Latest Change on a Year Earlier', 'Value Prev Year', [latest, prevSet], '+#,##0.0;-#,##0.0;0.0', 'Latest reading minus the reading 12 months earlier, in the series\' own unit.', 'Generic'),
  diff('Latest Change vs Pre-Pandemic', 'Value Pre Pandemic', [latest], '+#,##0.0;-#,##0.0;0.0', 'Latest reading minus the Feb 2020 reading (Dec-Feb 2020 for LFS series).', 'Generic'),
  { name: 'Latest Share of Sector Vacancies', definition: { description: "A sector's share of the seven sectors' vacancies in the latest release.", categories: ['Vacancies'], expression: 'part / whole', format: { mode: 'custom', pattern: '0.0%' },
    inputs: [{ id: 'part', kind: 'aggregate', aggregation: 'SUM', field: f('Value'), filter: { conditions: [latest, sectors] } }, { id: 'whole', kind: 'aggregate', aggregation: 'SUM', field: f('Value'), filter: { conditions: [latest, sectors] }, options: { scope: 'total' } }] } },
  one('Latest Regional Unemployment Rate', [latest, ...regional('Unemployment rate')], '#,##0.0', 'Unemployment rate of a region or nation in the latest release, %.', 'Regional'),
  diff('Latest Regional Unemployment Change on a Year Earlier', 'Value Prev Year', [latest, prevSet, ...regional('Unemployment rate')], PP, 'Change in a region\'s unemployment rate on a year earlier, latest release, pp.', 'Regional'),
  diff('Latest Regional Unemployment Change vs Pre-Pandemic', 'Value Pre Pandemic', [latest, ...regional('Unemployment rate')], PP, 'Change in a region\'s unemployment rate since Dec-Feb 2020, latest release, pp.', 'Regional'),
  one('Latest Regional Employment Rate', [latest, ...regional('Employment rate (16-64)')], '#,##0.0', '16-64 employment rate of a region or nation in the latest release, %.', 'Regional'),
  diff('Latest Regional Employment Change on a Year Earlier', 'Value Prev Year', [latest, prevSet, ...regional('Employment rate (16-64)')], PP, 'Change in a region\'s 16-64 employment rate on a year earlier, latest release, pp.', 'Regional'),
];

const q = (name, description, dims, ms, filters, orderBy) => ({ name, definition: {
  question: name, description, categories: ['Labour Market Pulse'],
  dimensions: dims.map(([key, dimension]) => ({ key, reference: { dimension } })),
  measures: ms.map(([key, measure, extra]) => ({ key, reference: { measure }, ...(extra ?? {}) })),
  ...(filters ? { filters } : {}), orderBy, preferredCharts: [{ type: 'table' }],
} });
const questions = [
  q('How are vacancies changing in each sector?', 'Vacancies by industry sector in the latest release: level (000s), rank, change on a year earlier and share of the seven sectors.',
    [['ind', 'Indicator']], [['rk', 'Latest Value', { advancedCalculation: { rank: { direction: 'descending' } } }], ['v', 'Latest Value'], ['chg', 'Latest Change on a Year Earlier'], ['sh', 'Latest Share of Sector Vacancies']],
    { expression: '{f1}', f1: { operator: 'contains', arguments: [{ reference: { dimension: 'Indicator' } }, { value: 'Vacancies:' }] } }, [{ reference: { measure: 'v' }, direction: 'descending' }]),
  q('Which pay measures are moving most?', "Every UK pay series in the latest release with its change on a year earlier, in the series' own unit.",
    [['ind', 'Indicator'], ['u', 'Unit']], [['v', 'Latest Value'], ['chg', 'Latest Change on a Year Earlier']],
    { expression: '{f1}', f1: { operator: 'equals', arguments: [{ reference: { dimension: 'Theme' } }, { value: 'Pay' }] } }, [{ reference: { dimension: 'ind' }, direction: 'ascending' }]),
];

const items = [
  ...measures.map((m, i) => ({ id: `m${i}`, entity: 'measure', preparedTarget: null, change: { operation: 'create', ...m } })),
  ...questions.map((x, i) => ({ id: `q${i}`, entity: 'businessQuestion', preparedTarget: x.name, change: { operation: 'replace', name: x.name, definition: x.definition } })),
];
console.log(JSON.stringify(items));
