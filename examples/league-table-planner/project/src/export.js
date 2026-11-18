/**
 * Excel report: a formatted multi-sheet workbook built from each mounted object's own governed
 * query (handle.getData), so every sheet follows the filters on screen. Sheets: Summary, one per
 * tab, Focus plan, Definitions.
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

export const exportWorkbook = async ({ us, ourRank, ourScore, gain, tabs, tiles, mounted, plan, measures, display, selectionText }) => {
  const when = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const sub = `${us} · rival filter: ${selectionText} · generated ${when} · governed semantic layer "UK University Rankings 2027"`;
  const sheets = [];

  sheets.push({ name: 'Summary', cols: [34, 60], merges: [], rows: [
    ...banner('League Table Climb Planner', sub, 2),
    head(['Item', 'Value']),
    [B('Our university'), T(us)], [B('2027 rank'), N(ourRank)], [B('2027 total score'), N(Math.round(ourScore))],
    [B('What-if gain (points)'), N(gain)], [B('Rival filter'), T(selectionText)],
    [B('Focus plan status'), T(plan.status)], [B('Focus measures'), T(plan.measures.map((k) => measures.find(([m]) => m === k)?.[1]).join(', ') || '—')],
    [B('Rivals in plan'), T(plan.rivals.join(', ') || '—')],
  ] });

  for (const [tabId, label] of tabs) {
    const rows = [...banner(label, sub, 8)];
    for (const tile of tiles.filter((t) => t.tab === tabId && t.type !== 'filter' && !t.minis)) {
      const rec = mounted.get(tile.id);
      if (!rec?.handle) continue;
      let result;
      try { result = await rec.handle.getData({ limit: 500 }); } catch (e) { result = null; }
      const cols = [...(tile.dimensions ?? []), ...(tile.measures ?? [])].map((x) => display[x.name] ?? x.name);
      if (tile.miniChart) cols.push(tile.miniChart.label);
      rows.push([{ v: tile.title, s: 'section' }]);
      rows.push(head(cols));
      const data = rowsOf(result);
      for (const r of data) rows.push(r.slice(0, cols.length).map((v) => N(num(v))));
      if (!data.length) rows.push([T('No rows for the current filters.')]);
      rows.push([]);
    }
    sheets.push({ name: `${label} (tab)`.slice(0, 31), cols: [30, 16, 14, 14, 14, 14, 14, 14, 14, 14, 14], merges: [], rows });
  }

  sheets.push({ name: 'Plan audit trail', cols: [22, 14, 30, 14, 14, 50], merges: [], rows: [
    ...banner(`Focus plan · ${us}`, `Status: ${plan.status}. Browser-only simulated workflow.`, 6),
    head(['When', 'Action', 'By', 'Before', 'After', 'Note']),
    ...plan.events.map((e) => [T(new Date(e.at).toLocaleString('en-GB')), T(e.action), T(`${e.by} (${e.role})`), T(e.before), T(e.after), T(e.note)]),
  ] });

  sheets.push({ name: 'Definitions', cols: [44, 90], merges: [], rows: [
    ...banner('Definitions', 'Every figure is a stored measure of the semantic layer', 2),
    head(['Term', 'Meaning']),
    ...[
      ['Rank', 'Overall league position, 2027 edition (1 = best). Ranks are never summed.'],
      ['Moved', 'Places moved since the 2026 edition; positive = climbed.'],
      ['Total score', 'The 2027 overall score (0–1000) the ranking is ordered by.'],
      ['Points vs us', `A university's total score minus ${us}'s.`],
      ['vs set average', "A component score minus the average of the universities in the current selection (the rivals in view)."],
      ['Projected rank', 'Universities scoring strictly above our score plus the gain, plus one. Ties are not broken.'],
      ['Rival set', 'By default the universities within 10 places of us in 2027; change it with the filters.'],
    ].map(([k, v]) => [B(k), T(v)]),
  ] });

  const blob = workbookBlob({ sheets, title: `Climb Planner – ${us}`, author: 'League Table Climb Planner' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `Climb_Planner_${us.replace(/[^A-Za-z0-9]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx` });
  document.body.append(a); a.click(); a.remove();
  window.__lastExport = { bytes: blob.size, sheets: sheets.map((s) => s.name) };
  return window.__lastExport;
};
