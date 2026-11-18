/**
 * Excel report: a formatted multi-sheet workbook built from each mounted object's own governed
 * query (handle.getData), so every sheet follows the filters on screen. Sheets: Summary, one per
 * tab, Plan audit trail, Definitions. (Adapted from the league-table-planner example.)
 */
import { workbookBlob } from './xlsx.js';

const rowsOf = (result) => {
  const body = result?.data?.response ?? result?.data ?? result;
  const data = body?.data ?? body?.rows;
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') return Object.keys(data).sort((a, b) => a - b).map((k) => data[k]);
  return [];
};
const num = (v) => (typeof v === 'string' && /^-?\d+(\.\d+)?(e-?\d+)?$/i.test(v) ? Number(v) : v);
const T = (v) => ({ v: v == null ? '' : String(v), s: 'text' });
const B = (v) => ({ v: String(v ?? ''), s: 'bold' });
const N = (v) => (typeof v === 'number' ? { v, s: Number.isInteger(v) ? 'int' : 'dec' } : T(v));
const head = (labels) => labels.map((v, i) => ({ v, s: i ? 'head' : 'headl' }));
const banner = (title, sub, cols) => [[{ v: title, s: 'title' }, ...Array(Math.max(0, cols - 1)).fill({ v: '', s: 'title' })], [{ v: sub, s: 'subtitle' }], []];

export const exportWorkbook = async ({ tabs, tiles, mounted, plan, display, selectionText, headline, levers }) => {
  const when = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const sub = `Filters: ${selectionText} · generated ${when} · semantic layer "Ski Resort Operations" · data is synthetic`;
  const sheets = [];

  sheets.push({ name: 'Summary', cols: [34, 90], merges: [], rows: [
    ...banner('Snowline — Monday resort review', sub, 2),
    head(['Item', 'Value']),
    [B('Headline'), T(headline)],
    [B('Seasons compared'), T('2025/26 against 2024/25 (Dec–Mar, 18 weeks each)')],
    [B('Filters'), T(selectionText)],
    [B('What-if levers'), T(levers)],
    [B('Marketing plan status'), T(plan.status)],
    [B('Plan: resorts'), T(plan.resorts.join(', ') || '—')],
    [B('Plan: stage'), T(plan.stage || '—')],
  ] });

  for (const [tabId, label] of tabs) {
    const rows = [...banner(label, sub, 8)];
    for (const tile of tiles.filter((t) => t.tab === tabId && t.type !== 'filter')) {
      const rec = mounted.get(tile.id);
      if (!rec?.handle) continue;
      let result;
      try { result = await rec.handle.getData({ limit: 500 }); } catch { result = null; }
      const cols = [...(tile.dimensions ?? []), ...(tile.measures ?? [])].map((x) => display[x.name] ?? x.name);
      if (tile.miniChart) cols.push(tile.miniChart.label);
      rows.push([{ v: tile.title, s: 'section' }]);
      rows.push(head(cols));
      const data = rowsOf(result);
      for (const r of data) rows.push(r.slice(0, cols.length).map((v) => N(num(v))));
      if (!data.length) rows.push([T('No rows for the current filters.')]);
      rows.push([]);
    }
    sheets.push({ name: label.slice(0, 31), cols: [34, 16, 14, 14, 14, 14, 14, 14, 14, 14], merges: [], rows });
  }

  sheets.push({ name: 'Plan audit trail', cols: [22, 12, 30, 12, 12, 70], merges: [], rows: [
    ...banner('Marketing plan 2026/27', `Status: ${plan.status}. Simulated workflow, stored in the browser only.`, 6),
    head(['When', 'Action', 'By', 'Before', 'After', 'Note']),
    ...plan.events.map((e) => [T(new Date(e.at).toLocaleString('en-GB')), T(e.action), T(`${e.by} (${e.role})`), T(e.before), T(e.after), T(e.note)]),
  ] });

  sheets.push({ name: 'Definitions', cols: [34, 100], merges: [], rows: [
    ...banner('Definitions', 'Every figure is a stored measure of the "Ski Resort Operations" semantic layer', 2),
    head(['Term', 'Meaning']),
    ...[
      ['This season / last season', '2025/26 (1 Dec 2025 – 5 Apr 2026) against 2024/25; the measures filter Season explicitly.'],
      ['Crowd Index', '0–100 index of how busy a resort was in a week. The data holds no visitor counts, so this is the demand (visits) signal. Up is good for the operator.'],
      ['Quiet powder week', 'A regular (non-holiday) resort-week with at least 40 cm of fresh snow and a Crowd Index under 55: good conditions that went unsold. Fewer is better.'],
      ['Week score', 'Overall Week Score: 35% snow, 25% value, 15% quiet, 15% expert terrain, 10% family, from the Score Weights table.'],
      ['Demand headroom', 'Avg Snow Score minus Avg Crowd Index, in index points: how much better the snow is than the demand it draws.'],
      ['Holiday uplift', 'Avg Crowd Index in holiday weeks minus regular weeks.'],
      ['Suggested budget', 'What-if: the budget split in proportion to each row\'s share of target weeks (the campaign rule set by the levers). A planning rule, not a forecast.'],
      ['Data', 'All resort and week values are synthetic (SKI_SOURCES).'],
    ].map(([k, v]) => [B(k), T(v)]),
  ] });

  const blob = workbookBlob({ sheets, title: 'Snowline resort review', author: 'Snowline' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `Snowline_review_${new Date().toISOString().slice(0, 10)}.xlsx` });
  document.body.append(a); a.click(); a.remove();
  window.__lastExport = { bytes: blob.size, sheets: sheets.map((s) => s.name) };
  return window.__lastExport;
};
