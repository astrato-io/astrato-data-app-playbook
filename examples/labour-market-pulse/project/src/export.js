/**
 * The Excel briefing pack: Summary, one sheet per tab, the headline data and definitions.
 * Every figure comes from the same stored measures as the screen, through direct governed queries
 * (`q`) that carry the app-wide selections explicitly, so hidden tabs follow them too: each sheet
 * takes the selections its tab takes on screen (`scope`, the app's SCOPE), and "latest release"
 * unless a time is selected. Each sheet's banner names exactly the selections its rows follow,
 * and any it does not.
 *
 * buildWorkbook() returns the Blob; downloadWorkbook() is what the header button calls.
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

/** Row cap for the month-level Data sheet; a full result is noted in the sheet, never cut silently. */
const DATA_LIMIT = 10000;

/** Build the workbook. Returns { blob, info }; `info` is what the smoke check reads. */
const buildPack = async ({ q, keyOf, mainSel, timeSelected, chipLabel, scope }) => {
  const latest = timeSelected ? [] : [{ field: { fieldKey: keyOf('Period Status') }, operator: 'inList', values: ['Latest'] }];
  const fieldsFor = (tab, kpi) => new Set((kpi ? scope[tab].kpis : scope[tab].charts).map(keyOf));
  const sel = (tab, { kpi = false } = {}) => [...mainSel]
    .filter(([k]) => fieldsFor(tab, kpi).has(k))
    .map(([fieldKey, values]) => ({ field: { fieldKey }, operator: 'inList', values }));
  const basis = timeSelected ? 'Average of the selected months' : 'Latest release';
  /** The banner of a sheet: the selections its rows follow, and those they ignore. */
  const selText = (tab, { kpi = false } = {}) => {
    const allowed = fieldsFor(tab, kpi);
    const label = ([k, v]) => chipLabel(k, v).join(': ');
    const applied = [...mainSel].filter(([k]) => allowed.has(k)).map(label);
    const ignored = [...mainSel].filter(([k]) => !allowed.has(k)).map(label);
    return `Selections applied: ${applied.join('; ') || 'none'}.${ignored.length ? ` Not applied to this sheet: ${ignored.join('; ')}.` : ''}`;
  };

  const kpiDefs = [
    ['Unemployed per vacancy', 'Unemployed per Vacancy', 'Unemployed per Vacancy Change on Year', 'market', 'dec'],
    ['Unemployment rate (%)', 'Unemployment Rate', 'Unemployment Rate Change on Year', 'market', 'num1'],
    ['Vacancies (000s)', 'Vacancies (000s)', 'Vacancies Change on Year (000s)', 'market', 'int'],
    ['Regular pay growth (%)', 'Regular Pay Growth', 'Regular Pay Growth Change on Year', 'pay', 'num1'],
    ['Real pay growth (%)', 'Real Regular Pay Growth', 'Real Pay Growth Change on Year', 'pay', 'num1'],
    ['Private sector pay growth (%)', 'Private Sector Pay Growth', 'Private Sector Pay Growth Change on Year', 'pay', 'num1'],
    ['Redundancies (000s)', 'Redundancies (000s)', 'Redundancies Change on Year (000s)', 'demand', 'int'],
  ];
  // Every headline KPI takes the same fields (time only), so the Summary has one banner.
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
  // With no time selected this is each indicator's latest month; with one, every selected month.
  const latestTable = await q({ dims: ['Theme', 'Indicator', 'Period Label'], measures: ['Value', 'Change on Quarter', 'Change on a Year Earlier', 'Change vs Pre-Pandemic'], limit: DATA_LIMIT, filters: [...sel('market'), ...latest, { field: { fieldKey: keyOf('Geography') }, operator: 'inList', values: ['United Kingdom'] }, { field: { fieldKey: keyOf('Sex') }, operator: 'inList', values: ['All'] }] });
  const dataBasis = timeSelected ? 'One row per indicator and selected month' : 'Latest release';
  const dataCut = latestTable.length >= DATA_LIMIT ? ` Only the first ${DATA_LIMIT} rows are included; select fewer months for the full list.` : '';

  const sheets = [
    { name: 'Summary', cols: [38, 16, 16], rows: [
      title('Labour Market Pulse — monthly briefing pack'),
      [{ v: `ONS Labour Market Statistics, release of 15 Sep 2026 (contains public sector information licensed under the Open Government Licence v3.0). Basis: ${basis}. Headline figures are UK-wide. ${selText('market', { kpi: true })}`, s: 'subtitle' }],
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
      title('Is the UK labour market tightening or loosening? Annual averages'), [{ v: selText('market'), s: 'subtitle' }],
      head(['Year', 'Unemployed per vacancy', 'Vacancies (000s)', 'Unemployment %', 'Pay growth %', 'Real pay %', 'Implied CPIH %']),
      ...trend.map((r) => [r.Year, { v: r['Unemployed per Vacancy'], s: 'dec' }, { v: r['Vacancies (000s)'], s: 'int' }, { v: r['Unemployment Rate'], s: 'num1' }, { v: r['Regular Pay Growth'], s: 'num1' }, { v: r['Real Regular Pay Growth'], s: 'num1' }, { v: r['Implied CPIH Inflation'], s: 'num1' }]),
    ], merges: ['A1:G1'] },
    { name: 'Demand', cols: [36, 14, 14, 12], freeze: { row: 3 }, rows: [
      title('Where is hiring demand falling?'), [{ v: `${basis}. Seven sectors only. ${selText('demand')}`, s: 'subtitle' }],
      head(['Sector', 'Vacancies (000s)', 'Δ year (000s)', 'Share']),
      ...sector.sort((a, b) => b['Sector Vacancies (000s)'] - a['Sector Vacancies (000s)']).map((r) => [r.Sector, { v: r['Sector Vacancies (000s)'], s: 'int' }, { v: r['Sector Vacancy Change on Year (000s)'], s: 'sdec' }, { v: r['Share of Sector Vacancies'], s: 'pct' }]),
    ], merges: ['A1:D1'] },
    { name: 'Pay', cols: [36, 14, 16], rows: [
      title('What does a looser market mean for pay?'), [{ v: `${basis}. UK-wide. ${selText('pay', { kpi: true })}`, s: 'subtitle' }],
      head(['Measure', 'Value', 'Change on a year']),
      ...kpis.slice(3, 6),
    ], merges: ['A1:C1'] },
    { name: 'Regions', cols: [24, 16, 16, 16], freeze: { row: 3 }, rows: [
      title('Which regions are loosening fastest?'), [{ v: `${basis}. ${selText('regions')}`, s: 'subtitle' }],
      head(['Region', 'Unemployment %', 'Δ year (pp)', 'Employment %']),
      ...regions.sort((a, b) => b['Regional Unemployment Change on a Year Earlier'] - a['Regional Unemployment Change on a Year Earlier']).map((r) => [r.Geography, { v: r['Regional Unemployment Rate'], s: 'num1' }, { v: r['Regional Unemployment Change on a Year Earlier'], s: 'pp' }, { v: r['Regional Employment Rate'], s: 'num1' }]),
    ], merges: ['A1:D1'] },
    { name: 'Data', cols: [14, 36, 16, 12, 12, 12, 14], freeze: { row: 3 }, rows: [
      title('Every UK headline indicator'), [{ v: `${dataBasis}. UK-wide. ${selText('market')}${dataCut}`, s: 'subtitle' }],
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
  const info = { at: Date.now(), basis, diag, sheets: sheets.map((s) => s.name), dataRows: latestTable.length, kpis: kpis.map((r) => [r[0].v, r[1].v, r[2].v]) };
  return { blob, info };
};

/** The workbook as a Blob, under the selections in `ctx` (what the smoke test's export probe builds). */
export const buildWorkbook = async (ctx) => (await buildPack(ctx)).blob;

/** Build the workbook and download it (the header button). */
export const downloadWorkbook = async (ctx) => {
  const { blob, info } = await buildPack(ctx);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `labour-market-pulse-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  window.__lastExport = info;
};
