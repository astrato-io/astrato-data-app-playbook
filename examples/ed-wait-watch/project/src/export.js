/**
 * The Excel morning report: Summary, When, Who, Satisfaction, Flags, Data, Definitions.
 * Every figure comes from the same stored measures as the screen, with the on-screen selections
 * (each sheet takes the selections its tab takes). Writer: src/xlsx.js, copied from the
 * labour-market-pulse example.
 */
import { workbookBlob } from './xlsx.js';
import { DAY, plainDay } from './catalogue.js';

const NOTES = {
  'Seen Within Target %': 'Visits seen within 30 minutes of arrival divided by all visits (ratio of counts).',
  'Patients Over Target': 'Visits that waited longer than 30 minutes.',
  'Share of Over-Target Patients': 'A row\'s share of all over-30-minute visits in the selection.',
  'Avg Wait Time': 'Average minutes waited before being seen.',
  'Avg Satisfaction': 'Average satisfaction score 1-10, visits with a score only (about 27% of visits).',
  'Patients': 'ER visits, one row per visit.',
  '… This Month / Last Month / Change vs Last Month': 'On the Review Month axis: the latest month to its latest day in the data, against the same days of the month before.',
  'Open Flags / Overdue Flags / Flags Awaiting Sign-off': 'From the Er Wait Flags writeback view: Open or In progress; past due; Resolved but not closed.',
};

export const exportWorkbook = async ({ q, keyOf, mainSel, chipLabel, selFilters, period }) => {
  const selText = [...mainSel].map(([k, v]) => chipLabel(k, v).join(': ')).join('; ') || 'None';
  const kSel = selFilters('g-board-n');
  const vSel = selFilters('g-board');
  const fSel = selFilters('g-flags');
  const kpiDefs = [
    ['Seen within 30 min', 'Seen Within Target %', 'pct', 'spct'],
    ['Average wait (min)', 'Avg Wait Time', 'num1', 'sdec'],
    ['Satisfaction (1-10)', 'Avg Satisfaction', 'num1', 'sdec'],
    ['Visits', 'Patients', 'int', 'sdec'],
  ];
  const [k] = await q({ measures: kpiDefs.flatMap(([, b]) => [`${b} This Month`, `${b} Last Month`, `${b} Change vs Last Month`]), filters: kSel });
  const kpis = kpiDefs.map(([label, b, f, df]) => [{ v: label, s: 'bold' }, { v: k?.[`${b} This Month`] ?? null, s: f }, { v: k?.[`${b} Last Month`] ?? null, s: f }, { v: k?.[`${b} Change vs Last Month`] ?? null, s: df === 'spct' ? 'spct' : 'sdec' }]);
  const [flags] = await q({ measures: ['Open Flags', 'Overdue Flags', 'Flags Awaiting Sign-off', 'Flags Raised'], filters: fSel });
  const M = ['Patients', 'Patients Over Target', 'Seen Within Target %', 'Avg Wait Time', 'Avg Satisfaction'];
  const row = (r, dim) => [r[dim], { v: r.Patients, s: 'int' }, { v: r['Patients Over Target'], s: 'int' }, { v: r['Seen Within Target %'], s: 'pct' }, { v: r['Avg Wait Time'], s: 'num1' }, { v: r['Avg Satisfaction'], s: 'num1' }];
  const head = (cols) => cols.map((v) => ({ v, s: 'head' }));
  const title = (text) => [{ v: text, s: 'title' }];
  const band = await q({ dims: ['Time Band'], measures: M, filters: vSel });
  const day = await q({ dims: [DAY], measures: M, filters: vSel });
  const slots = await q({ dims: [DAY, 'Time Band'], measures: ['Seen Within Target %', 'Patients'], filters: vSel });
  const dept = await q({ dims: ['Department Referral'], measures: [...M, 'Share of Over-Target Patients'], filters: vSel });
  const age = await q({ dims: ['Age Band'], measures: M, filters: vSel });
  const waitBand = await q({ dims: ['Wait Band'], measures: ['Patients', 'CSAT Responses', 'Avg Satisfaction'], filters: vSel });
  const months = await q({ dims: ['Period'], measures: M, filters: vSel });
  const flagRows = await q({ dims: ['Flag ID', 'Flag Status', 'Flag Department', 'Flag Weekday', 'Flag Time Band', 'Flag Issue', 'Flag Owner', 'Flag Due Date', 'Flag Raised By'], measures: ['Overdue Flags'], filters: fSel });
  const by = (key) => (a, b) => String(a[key]).localeCompare(String(b[key]));
  const worst = [...slots].filter((r) => Number(r.Patients) >= 30).sort((a, b) => a['Seen Within Target %'] - b['Seen Within Target %']).slice(0, 10);
  const dayIso = (v) => { const d = new Date(typeof v === 'number' ? v : Date.parse(v)); return Number.isNaN(d.getTime()) ? v : d.toISOString().slice(0, 10); };
  const COLS6 = ['Visits', 'Over 30 min', 'Seen within 30', 'Avg wait (min)', 'Satisfaction'];

  const sheets = [
    { name: 'Summary', cols: [30, 16, 16, 16], rows: [
      title('ED Wait Watch — morning report'),
      [{ v: `Cards: ${period.now} against ${period.before}. Selections: ${selText}. Exported ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC.`, s: 'subtitle' }],
      [],
      head(['Headline', period.now, period.before, 'Change']),
      ...kpis,
      [],
      [{ v: 'Flags', s: 'section' }],
      [{ v: 'Open', s: 'label' }, { v: flags?.['Open Flags'] ?? 0, s: 'int' }],
      [{ v: 'Overdue', s: 'label' }, { v: flags?.['Overdue Flags'] ?? 0, s: 'int' }],
      [{ v: 'Awaiting sign-off', s: 'label' }, { v: flags?.['Flags Awaiting Sign-off'] ?? 0, s: 'int' }],
      [],
      [{ v: 'Worst weekday and arrival-band slots (all months in the selection)', s: 'section' }],
      head(['Slot', 'Seen within 30', 'Visits']),
      ...worst.map((r) => [`${plainDay(r[DAY])} ${r['Time Band']}`, { v: r['Seen Within Target %'], s: 'pct' }, { v: r.Patients, s: 'int' }]),
    ], merges: ['A1:D1', 'A2:D2'] },
    { name: 'When', cols: [14, 12, 12, 14, 14, 14], freeze: { row: 3 }, rows: [
      title('When do patients wait longer than 30 minutes?'), [{ v: `Selections: ${selText}`, s: 'subtitle' }],
      head(['Arrival band', ...COLS6]), ...band.sort(by('Time Band')).map((r) => row(r, 'Time Band')),
      [], head(['Weekday', ...COLS6]), ...day.sort((a, b) => (String(a[DAY]) < String(b[DAY]) ? -1 : 1)).map((r) => row({ ...r, [DAY]: plainDay(r[DAY]) }, DAY)),
    ], merges: ['A1:F1'] },
    { name: 'Who', cols: [22, 12, 12, 14, 14, 14, 16], freeze: { row: 3 }, rows: [
      title('Which departments and patient groups wait longest?'), [{ v: `Selections: ${selText}`, s: 'subtitle' }],
      head(['Department', ...COLS6, 'Share of over 30']), ...dept.sort((a, b) => a['Seen Within Target %'] - b['Seen Within Target %']).map((r) => [...row(r, 'Department Referral'), { v: r['Share of Over-Target Patients'], s: 'pct' }]),
      [], head(['Age band', ...COLS6]), ...age.sort(by('Age Band')).map((r) => row(r, 'Age Band')),
    ], merges: ['A1:G1'] },
    { name: 'Satisfaction', cols: [16, 12, 16, 14], freeze: { row: 3 }, rows: [
      title('Does satisfaction fall as waits grow?'), [{ v: `Only visits with a recorded score. Selections: ${selText}`, s: 'subtitle' }],
      head(['Minutes waited', 'Visits', 'Scores recorded', 'Satisfaction']),
      ...waitBand.sort(by('Wait Band')).map((r) => [r['Wait Band'], { v: r.Patients, s: 'int' }, { v: r['CSAT Responses'], s: 'int' }, { v: r['Avg Satisfaction'], s: 'num1' }]),
    ], merges: ['A1:D1'] },
    { name: 'Flags', cols: [20, 12, 18, 8, 10, 48, 20, 12, 22, 9], freeze: { row: 3 }, rows: [
      title('What has been flagged, who owns it, what is overdue?'), [{ v: `Governed writeback view Er Wait Flags. Selections: ${selText}`, s: 'subtitle' }],
      head(['Flag', 'Status', 'Department', 'Day', 'Slot', 'Issue', 'Owner', 'Due', 'Raised by', 'Overdue']),
      ...flagRows.sort(by('Flag ID')).reverse().map((r) => [r['Flag ID'], r['Flag Status'], r['Flag Department'], r['Flag Weekday'], r['Flag Time Band'], r['Flag Issue'], r['Flag Owner'], dayIso(r['Flag Due Date']), r['Flag Raised By'], { v: r['Overdue Flags'] ?? 0, s: 'int' }]),
    ], merges: ['A1:J1'] },
    { name: 'Data', cols: [10, 12, 12, 14, 14, 14], freeze: { row: 3 }, rows: [
      title('Every month on record'), [{ v: `Selections: ${selText}`, s: 'subtitle' }],
      head(['Month', ...COLS6]), ...months.sort(by('Period')).map((r) => row(r, 'Period')),
    ], merges: ['A1:F1'] },
    { name: 'Definitions', cols: [44, 90], rows: [
      title('Definitions (semantic layer Hospital ER Operations)'), [],
      head(['Measure', 'Definition']),
      ...Object.entries(NOTES).map(([a, b]) => [{ v: a, s: 'bold' }, { v: b, s: 'text' }]),
    ], merges: ['A1:B1'] },
  ];
  const blob = workbookBlob({ sheets, title: 'ED Wait Watch', author: 'ED Wait Watch' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ed-wait-watch-${new Date().toISOString().slice(0, 10)}.xlsx`;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  window.__lastExport = { at: Date.now(), selections: selText, sheets: sheets.map((s) => s.name), kpis: kpis.map((r) => [r[0].v, r[1].v, r[2].v, r[3].v]) };
};
