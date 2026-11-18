/**
 * Excel report: a formatted multi-sheet workbook built from each mounted object's own governed
 * query (handle.getData). Sheets: Summary, one per tab, Plan audit trail, Definitions.
 *
 * Each object answers with its own selection group, so the caller (buildWorkbook in app.js) first
 * copies `main` into every tab group, hidden tabs included, and waits for the re-queries. Objects
 * on fixed groups (us, whatif, overtake, focus) ignore the rival filter by design; their sections
 * say which rows they follow, and the Focus plan sheet's banner names the plan rivals instead.
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

/** What each fixed group's rows follow, written under the section title. */
const scopeNote = (group, { us, ourScore, gain, plan }) => ({
  us: `Pinned to ${us}; ignores the rival filter.`,
  whatif: `Whole league at ${us}'s score plus ${gain} points; ignores the rival filter.`,
  overtake: `Whole league, total score above ${Math.round(ourScore)} and up to ${Math.round(ourScore + gain)} (+${gain}); ignores the rival filter.`,
  focus: `${us} and the plan rivals (${plan.rivals.join(', ') || 'none named'}); ignores the rival filter.`,
}[group] ?? null);

/** Cell for one value; a non-scalar (a mini-chart series) becomes its points joined as text. */
const cell = (v) => (Array.isArray(v) ? T(v.filter((x) => x == null || typeof x !== 'object').join(', ')) : v && typeof v === 'object' ? T('') : N(num(v)));

const GET_LIMIT = 500;

/** The workbook as { blob, filename, sheets }; downloadWorkbook saves it. */
export const buildWorkbook = async ({ us, ourRank, ourScore, gain, tabs, tiles, mounted, plan, measures, display, rivalGroups, selectionText }) => {
  const when = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
  const source = `generated ${when} · governed semantic layer "UK University Rankings 2027"`;
  const sub = `${us} · rival filter: ${selectionText} · ${source}`;
  const sheets = [];

  sheets.push({ name: 'Summary', cols: [34, 60], merges: [], rows: [
    ...banner('League Table Climb Planner', `${us} · ${source}`, 2),
    head(['Item', 'Value']),
    [B('Our university'), T(us)], [B('2027 rank'), N(ourRank)], [B('2027 total score'), N(Math.round(ourScore))],
    [B('What-if gain (points)'), N(gain)], [B('Rival filter (tab sheets)'), T(selectionText)],
    [B('Focus plan status'), T(plan.status)], [B('Focus measures'), T(plan.measures.map((k) => measures.find(([m]) => m === k)?.[1]).join(', ') || '—')],
    [B('Rivals in plan'), T(plan.rivals.join(', ') || '—')],
  ] });

  for (const [tabId, label] of tabs) {
    const tabTiles = tiles.filter((t) => t.tab === tabId && t.type !== 'filter' && !t.minis);
    // A tab with no object on the rival filter (Focus plan) says what it follows instead.
    const onRivals = tabTiles.some((t) => rivalGroups.includes(t.group));
    const tabSub = onRivals ? sub : `${us} · ${scopeNote(tabTiles[0]?.group, { us, ourScore, gain, plan }) ?? ''} · ${source}`;
    const rows = [...banner(label, tabSub, 8)];
    for (const tile of tabTiles) {
      const rec = mounted.get(tile.id);
      const cols = [...(tile.dimensions ?? []), ...(tile.measures ?? [])].map((x) => tile.labels?.[x.ref] ?? display[x.name] ?? x.name);
      if (tile.miniChart) cols.push(tile.miniChart.label);
      rows.push([{ v: tile.title, s: 'section' }]);
      const note = onRivals && !rivalGroups.includes(tile.group) ? scopeNote(tile.group, { us, ourScore, gain, plan }) : null;
      if (note) rows.push([T(note)]);
      if (!rec?.handle) { rows.push([T('Not shown: this object did not mount.')], []); continue; }
      let result; let failed = null;
      try { result = await rec.handle.getData({ limit: GET_LIMIT }); } catch (e) { failed = e; }
      if (failed) { rows.push([T(`Query failed: ${String(failed?.message ?? failed).slice(0, 200)}`)], []); continue; }
      rows.push(head(cols));
      const data = rowsOf(result);
      for (const r of data) rows.push(r.slice(0, cols.length).map(cell));
      if (!data.length) rows.push([T('No rows for the current filters.')]);
      else if (data.length >= GET_LIMIT || (tile.limit > 1 && data.length === tile.limit)) rows.push([T(`First ${data.length} rows; the selection may hold more.`)]);
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
  const filename = `Climb_Planner_${us.replace(/[^A-Za-z0-9]+/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return { blob, filename, sheets: sheets.map((s) => s.name) };
};

/** Save a built workbook; records it for the app's self-check. */
export const downloadWorkbook = ({ blob, filename, sheets }) => {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: filename });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  window.__lastExport = { bytes: blob.size, sheets };
  return window.__lastExport;
};
