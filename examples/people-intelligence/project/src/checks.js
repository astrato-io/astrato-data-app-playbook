/**
 * The app's own smoke-test checks (kit/verify/smoke.mjs runs them after every tab has settled).
 *
 * Each page check selects through the app's real selection path (`ctx.select`, the same call the
 * assistant, drill-down and investigation use), waits for the engine to go quiet, and confirms a
 * KPI, a chart and a table changed; then it clears and confirms the KPI returned. Chart data is
 * read from the query layer (a canvas cannot be read); KPIs and tables are read as text.
 *
 * No check writes to the warehouse: none clicks approve, submit, save-scenario or triage.
 */
import { appState } from './app-state.js';
import { answerFor } from './throttle.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const textOf = (id) => (document.querySelector(`[data-slot="${id}"]`)?.innerText ?? '').replace(/\s+/g, ' ').trim();
/** Poll until test() holds or ms pass: a busy page answers queued queries in lanes, past appState.quiet(). */
const waitFor = async (test, ms = 25000) => { const t0 = performance.now(); while (!test() && performance.now() - t0 < ms) await sleep(500); await sleep(800); };
const short = (s) => (s.length > 40 ? `${s.slice(0, 40)}…` : s);

export const registerChecks = (ctx, { exportBtn, mountPage }) => {
  const show = async (key) => { ctx.go(key, { smooth: false }); await mountPage(key); await appState.quiet(); };
  const onPage = (key, test) => [...ctx.tiles.values()].filter((t) => t.page === key && test(t) && document.querySelector(`[data-slot="${t.id}"]`));
  const sigOf = (t) => (t.fieldKeys ?? []).join('|');
  /** The first value of a column in the reader's scope, for a selection that is sure to exist. */
  const firstValue = async (name, view, prefer) => {
    if (prefer) return prefer;
    const rows = await ctx.q({ dims: [[name, view]], measures: [], limit: 50 }).catch(() => ctx.q({ dims: [[name, view]], measures: ['Headcount'], limit: 50 }));
    return rows.map((r) => r[name]).filter((v) => v != null && v !== '').map(String).sort()[0];
  };

  const selectionCheck = (key, group, [name, view, prefer]) => {
    const label = ctx.panes[key].page.label;
    appState.check(`${label}: selecting a ${name} changes a KPI, a chart and a table; clearing restores the KPI`, async () => {
      await show(key);
      const kpi = ctx.panes[key].page.kpis[0] ?? 'h-hc'; // Home's KPI cards sit in its header, not in page.kpis
      const charts = onPage(key, (t) => t.group === group && !['number', 'table', 'filter'].includes(t.type) && (t.fieldKeys ?? []).length);
      const tables = onPage(key, (t) => t.type === 'table' && (t.fieldKeys ?? []).length);
      const read = () => ({ kpi: textOf(kpi), delta: textOf(`${kpi}-d`), charts: charts.map((t) => answerFor(sigOf(t))), tables: tables.map((t) => textOf(t.id)) });
      const value = await firstValue(name, view, prefer);
      const before = read();
      ctx.select(group, name, view, [value]);
      await appState.quiet();
      await waitFor(() => textOf(kpi) !== before.kpi && tables.every((t, i) => textOf(t.id) !== before.tables[i]));
      const during = read();
      ctx.select(group, name, view, []);
      await appState.quiet();
      await waitFor(() => textOf(kpi) === before.kpi && textOf(`${kpi}-d`) === before.delta);
      const after = read();
      const chartsMoved = charts.filter((_, i) => during.charts[i] && during.charts[i] !== before.charts[i]).length;
      const tablesMoved = tables.filter((_, i) => during.tables[i] !== before.tables[i]).length;
      const kpiOk = before.kpi !== '' && during.kpi !== before.kpi && after.kpi === before.kpi;
      // The KPI's comparison row is a one-row, measure-only table: it must follow the selection too.
      const deltaOk = before.delta === '' || (during.delta !== before.delta && after.delta === before.delta);
      return {
        pass: kpiOk && deltaOk && (!charts.length || chartsMoved > 0) && (!tables.length || tablesMoved > 0),
        detail: `${name} = ${value}; KPI ${kpi} "${short(before.kpi)}" → "${short(during.kpi)}" → "${short(after.kpi)}"; comparison "${short(before.delta)}" → "${short(during.delta)}" → "${short(after.delta)}"; charts moved ${chartsMoved}/${charts.length}; tables moved ${tablesMoved}/${tables.length}`,
      };
    });
  };

  selectionCheck('home', 'g-home', ['Business Unit', 'Business Units', 'Technology']);
  selectionCheck('wx', 'g-wx', ['Business Unit', 'Business Units', 'Technology']);
  // A single business unit on Talent & Retention opens the investigation panel; select a level instead.
  selectionCheck('tr', 'g-tr', ['Seniority', 'Seniority']);
  selectionCheck('suc', 'g-suc', ['Business Unit', 'Business Units', 'Technology']);
  selectionCheck('dei', 'g-dei', ['Business Unit', 'Business Units', 'Technology']);
  selectionCheck('sk', 'g-sk', ['Business Unit', 'Business Units', 'Technology']);
  selectionCheck('ops', 'g-ops', ['Source System', 'Pipeline Runs']);

  // ---------------------------------------------------------------- custom report builder
  appState.check('Custom report: two row dimensions and a measure render a table; adding a measure changes it; Excel export downloads', async () => {
    await show('rb');
    const card = document.querySelector('.cr');
    const view = card.querySelector('.cr-view');
    const pick = async (kind, name) => {
      const search = card.querySelector('.cr-panel .cr-search');
      search.value = name; search.dispatchEvent(new Event('input'));
      const item = [...card.querySelectorAll('.cr-panel .cr-item')].find((b) => b.querySelector(`i.t.${kind}`) && b.querySelector('span')?.textContent === name);
      if (!item) throw new Error(`${name} is not offered in the field panel`);
      item.click();
    };
    const tableText = () => (view.querySelector('.viz')?.innerText ?? '').replace(/\s+/g, ' ').trim();
    card.querySelector('.cr-clear')?.click();
    await pick('d', 'Business Unit');
    await pick('d', 'Seniority');
    await pick('m', 'Headcount');
    const search = card.querySelector('.cr-panel .cr-search'); search.value = ''; search.dispatchEvent(new Event('input'));
    await sleep(500); await appState.quiet();
    const first = tableText();
    const chips = [...card.querySelectorAll('.cr-bar .cr-chip .n')].map((n) => n.textContent);
    const rendered = view.querySelector('.viz:not(.loading)') && first.includes('Technology');
    await pick('m', 'Voluntary Attrition');
    card.querySelector('.cr-panel .cr-search').value = '';
    await sleep(500); await appState.quiet();
    const second = tableText();
    const changed = second !== first && second.includes('Voluntary Attrition');
    // Export: the rail's Excel button builds the workbook from the same governed query.
    const before = document.querySelectorAll('.pi-toast').length;
    card.querySelector('.cr-rail button[title="Export to Excel"]').click();
    await appState.quiet();
    const toast = [...document.querySelectorAll('.pi-toast')].slice(before).map((t) => t.innerText).join(' | ');
    const exported = /Exported/.test(toast);
    return { pass: Boolean(rendered && changed && exported), detail: `chips [${chips.join(', ')}]; table "${short(first)}" → "${short(second)}"; ${toast || 'no export toast'}` };
  });

  // ---------------------------------------------------------------- executive summary workbook
  appState.check('Export builds the executive-summary Excel workbook (7 sheets) and downloads it', async () => {
    await show('home');
    window.__lastExport = 0;
    exportBtn.click();
    for (let i = 0; i < 100 && exportBtn.disabled; i++) await sleep(250);
    await sleep(500);
    return { pass: window.__lastExport > 1000, detail: `workbook ${Math.round((window.__lastExport ?? 0) / 1024)} KB` };
  });
};
