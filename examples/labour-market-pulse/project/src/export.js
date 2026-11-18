/**
 * The Excel briefing pack: Summary, one sheet per tab, the latest-release data and definitions.
 * Every figure comes from the same stored measures as the screen, with the on-screen selections:
 * the app-wide selections that apply to each tab, and "latest release" unless a time is selected.
 */
import { workbookBlob } from './xlsx.js';
import { calls } from './workflow.js';

const MEASURE_NOTES = {
  'Unemployed per Vacancy': 'Unemployed people per job vacancy, ONS JPC5.',
  'Unemployed per Vacancy Change on Year': 'JPC5 minus its value 12 months earlier; empty with no prior year.',
  'Unemployment Rate': 'ILO unemployment rate 16+, %, rolling 3 months, ONS MGSX.',
  'Unemployment Rate Change on Year': 'MGSX minus its value 12 months earlier, pp.',
  'Vacancies (000s)': 'UK vacancies, thousands, rolling 3 months, ONS AP2Y.',
  'Vacancies Change on Year (000s)': 'AP2Y minus its value 12 months earlier, thousands.',
  'Regular Pay Growth': 'Nominal regular pay growth, 3-month average on a year, %, ONS KAI9.',
  'Real Regular Pay Growth': 'CPIH-deflated regular pay growth, %, ONS A2FA.',
  'Private Sector Pay Growth': 'Private sector regular pay growth, %, ONS KAJ4.',
  'Implied CPIH Inflation': 'KAI9 minus A2FA: the inflation rate pay is deflated by.',
  'Sector Vacancies (000s)': 'Vacancies in one of seven industry sectors, thousands.',
  'Sector Vacancy Change on Year (000s)': 'Change in a sector\'s vacancies on a year earlier, thousands.',
  'Share of Sector Vacancies': 'A sector\'s share of the seven sectors\' vacancies.',
  'Regional Unemployment Rate': 'ILO unemployment rate of a region or nation, %.',
  'Regional Unemployment Change on a Year Earlier': 'Change on a year earlier, pp.',
  'Regional Employment Rate': '16-64 employment rate of a region or nation, %.',
};

const SCOPES = { market: ['Period Year', 'Period'], demand: ['Period Year', 'Period', 'Sector'], pay: ['Period Year', 'Period'], regions: ['Period Year', 'Period', 'Geography'] };

export const exportWorkbook = async ({ q, keyOf, mainSel, timeSelected, chipLabel }) => {
  const latest = timeSelected ? [] : [{ field: { fieldKey: keyOf('Period Status') }, operator: 'inList', values: ['Latest'] }];
  const sel = (tab, { kpi = false } = {}) => [...mainSel]
    .filter(([k]) => (kpi ? ['Period Year', 'Period', ...(tab === 'regions' ? ['Geography'] : [])] : SCOPES[tab]).map(keyOf).includes(k))
    .map(([fieldKey, values]) => ({ field: { fieldKey }, operator: 'inList', values }));
  const basis = timeSelected ? 'Average of the selected months' : 'Latest release';
  const selText = [...mainSel].map(([k, v]) => chipLabel(k, v).join(': ')).join('; ') || 'None';

  const kpiDefs = [
    ['Unemployed per vacancy', 'Unemployed per Vacancy', 'Unemployed per Vacancy Change on Year', 'market', 'dec'],
    ['Unemployment rate (%)', 'Unemployment Rate', 'Unemployment Rate Change on Year', 'market', 'num1'],
    ['Vacancies (000s)', 'Vacancies (000s)', 'Vacancies Change on Year (000s)', 'market', 'int'],
    ['Regular pay growth (%)', 'Regular Pay Growth', 'Regular Pay Growth Change on Year', 'pay', 'num1'],
    ['Real pay growth (%)', 'Real Regular Pay Growth', 'Real Pay Growth Change on Year', 'pay', 'num1'],
    ['Private sector pay growth (%)', 'Private Sector Pay Growth', 'Private Sector Pay Growth Change on Year', 'pay', 'num1'],
    ['Redundancies (000s)', 'Redundancies (000s)', 'Redundancies Change on Year (000s)', 'demand', 'int'],
  ];
  const kpis = await Promise.all(kpiDefs.map(async ([label, m, d, tab, f]) => {
    const [r] = await q({ measures: [m, d], filters: [...sel(tab, { kpi: true }), ...latest] });
    return [{ v: label, s: 'bold' }, { v: r?.[m] ?? null, s: f }, { v: r?.[d] ?? null, s: 'sdec' }];
  }));
  const call = calls().calls[0];
  const head = (cols) => cols.map((v) => ({ v, s: 'head' }));
  const title = (text) => [{ v: text, s: 'title' }];

  // The seven sectors: the Sector dimension is empty for every other indicator, and the sector
  // measures carry their own "Vacancies: *" filter.
  const diag = [];
  const SECTOR_M = ['Sector Vacancies (000s)', 'Sector Vacancy Change on Year (000s)', 'Share of Sector Vacancies'];
  const sector = (await q({ dims: ['Sector'], measures: SECTOR_M, filters: [...sel('demand'), ...latest] }))
    .filter((r) => r.Sector != null && r.Sector !== '' && r['Sector Vacancies (000s)'] != null);
  const regions = await q({ dims: ['Geography'], measures: ['Regional Unemployment Rate', 'Regional Unemployment Change on a Year Earlier', 'Regional Employment Rate'], filters: [...sel('regions'), ...latest, { field: { fieldKey: keyOf('Theme') }, operator: 'inList', values: ['Regional'] }] });
  const trend = await q({ dims: ['Year'], measures: ['Unemployed per Vacancy', 'Vacancies (000s)', 'Unemployment Rate', 'Regular Pay Growth', 'Real Regular Pay Growth', 'Implied CPIH Inflation'], filters: sel('market') });
  const latestTable = await q({ dims: ['Theme', 'Indicator', 'Period Label'], measures: ['Value', 'Change on Quarter', 'Change on a Year Earlier', 'Change vs Pre-Pandemic'], filters: [...sel('market'), ...latest, { field: { fieldKey: keyOf('Geography') }, operator: 'inList', values: ['United Kingdom'] }, { field: { fieldKey: keyOf('Sex') }, operator: 'inList', values: ['All'] }] });

  const sheets = [
    { name: 'Summary', cols: [38, 16, 16], rows: [
      title('Labour Market Pulse — monthly briefing pack'),
      [{ v: `ONS Labour Market Statistics, release of 15 Sep 2026 (contains public sector information licensed under the Open Government Licence v3.0). Basis: ${basis}. Selections: ${selText}.`, s: 'subtitle' }],
      [],
      head(['Headline', 'Value', 'Change on a year']),
      ...kpis,
      [],
      [{ v: 'Market call', s: 'section' }],
      [{ v: 'Release', s: 'label' }, call?.release ?? ''],
      [{ v: 'Call', s: 'label' }, `${call?.call ?? ''} (${call?.state ?? ''})`],
      [{ v: 'Hiring advice', s: 'label' }, call?.hiring ?? ''],
      [{ v: 'Pay advice', s: 'label' }, call?.pay ?? ''],
      [{ v: 'Workflow records are simulated in the browser.', s: 'note' }],
    ], merges: ['A1:C1', 'A2:C2'] },
    { name: 'Market', cols: [10, 14, 14, 14, 14, 14, 14], freeze: { row: 3 }, rows: [
      title('Is the UK labour market tightening or loosening? Annual averages'), [{ v: `Selections: ${selText}`, s: 'subtitle' }],
      head(['Year', 'Unemployed per vacancy', 'Vacancies (000s)', 'Unemployment %', 'Pay growth %', 'Real pay %', 'Implied CPIH %']),
      ...trend.map((r) => [r.Year, { v: r['Unemployed per Vacancy'], s: 'dec' }, { v: r['Vacancies (000s)'], s: 'int' }, { v: r['Unemployment Rate'], s: 'num1' }, { v: r['Regular Pay Growth'], s: 'num1' }, { v: r['Real Regular Pay Growth'], s: 'num1' }, { v: r['Implied CPIH Inflation'], s: 'num1' }]),
    ], merges: ['A1:G1'] },
    { name: 'Demand', cols: [36, 14, 14, 12], freeze: { row: 3 }, rows: [
      title('Where is hiring demand falling?'), [{ v: `${basis}. Seven sectors only. Selections: ${selText}`, s: 'subtitle' }],
      head(['Sector', 'Vacancies (000s)', 'Δ year (000s)', 'Share']),
      ...sector.sort((a, b) => b['Sector Vacancies (000s)'] - a['Sector Vacancies (000s)']).map((r) => [r.Sector, { v: r['Sector Vacancies (000s)'], s: 'int' }, { v: r['Sector Vacancy Change on Year (000s)'], s: 'sdec' }, { v: r['Share of Sector Vacancies'], s: 'pct' }]),
    ], merges: ['A1:D1'] },
    { name: 'Pay', cols: [36, 14, 16], rows: [
      title('What does a looser market mean for pay?'), [{ v: basis, s: 'subtitle' }],
      head(['Measure', 'Value', 'Change on a year']),
      ...kpis.slice(3, 6),
    ], merges: ['A1:C1'] },
    { name: 'Regions', cols: [24, 16, 16, 16], freeze: { row: 3 }, rows: [
      title('Which regions are loosening fastest?'), [{ v: `${basis}. Selections: ${selText}`, s: 'subtitle' }],
      head(['Region', 'Unemployment %', 'Δ year (pp)', 'Employment %']),
      ...regions.sort((a, b) => b['Regional Unemployment Change on a Year Earlier'] - a['Regional Unemployment Change on a Year Earlier']).map((r) => [r.Geography, { v: r['Regional Unemployment Rate'], s: 'num1' }, { v: r['Regional Unemployment Change on a Year Earlier'], s: 'pp' }, { v: r['Regional Employment Rate'], s: 'num1' }]),
    ], merges: ['A1:D1'] },
    { name: 'Data', cols: [14, 36, 16, 12, 12, 12, 14], freeze: { row: 3 }, rows: [
      title('Every UK headline indicator'), [{ v: basis, s: 'subtitle' }],
      head(['Theme', 'Indicator', 'Period', 'Value', 'Δ quarter', 'Δ year', 'Δ vs Feb 2020']),
      ...latestTable.sort((a, b) => `${a.Theme}${a.Indicator}`.localeCompare(`${b.Theme}${b.Indicator}`)).map((r) => [r.Theme, r.Indicator, r['Period Label'], { v: r.Value, s: 'num1' }, { v: r['Change on Quarter'], s: 'sdec' }, { v: r['Change on a Year Earlier'], s: 'sdec' }, { v: r['Change vs Pre-Pandemic'], s: 'sdec' }]),
    ], merges: ['A1:G1'] },
    { name: 'Definitions', cols: [40, 90], rows: [
      title('Definitions (semantic layer UK Labour Market (ONS LMS))'), [],
      head(['Measure', 'Definition']),
      ...Object.entries(MEASURE_NOTES).map(([k, v]) => [{ v: k, s: 'bold' }, { v, s: 'text' }]),
    ], merges: ['A1:B1'] },
  ];
  const blob = workbookBlob({ sheets, title: 'Labour Market Pulse', author: 'Labour Market Pulse' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `labour-market-pulse-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  window.__lastExport = { at: Date.now(), basis, diag, sheets: sheets.map((s) => s.name), kpis: kpis.map((r) => [r[0].v, r[1].v, r[2].v]) };
};
