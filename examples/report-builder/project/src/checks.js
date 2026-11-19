/**
 * Checks the smoke test runs (kit/verify/smoke.mjs). Each drives the builder through its real
 * controls and reads the rows the native object received. None of them writes anything: the save
 * check removes the report it saved.
 */
import { appState } from './app-state.js';
import { STARTERS, fromStarter } from './report.js';

export const registerChecks = ({ builder, cat, answers, live, q }) => {
  const E = builder.elements;
  const settle = async () => {
    await new Promise((r) => setTimeout(r, 600)); // the builder re-renders 300 ms after a change
    const start = performance.now();
    while (performance.now() - start < 30000) {
      const id = builder.tileId;
      if (id && window.__appState.objects[id]?.status !== 'pending') break;
      await new Promise((r) => setTimeout(r, 150));
    }
    await appState.quiet({ quietMs: 700, paintMs: 600 });
  };
  const status = () => window.__appState.objects[builder.tileId]?.status ?? 'none';
  const typeNow = () => live.get(builder.tileId)?.spec.view;
  /** The latest rows an object received for a query reading all of `keys`. */
  const latest = (keys) => {
    let best = null;
    for (const [shape, a] of answers) if (keys.every((k) => shape.includes(k)) && (!best || a.at > best.at)) best = a;
    return best;
  };
  const panel = (name, kind) => E.panelBody.querySelector(`.rb-item[data-key="${CSS.escape((kind === 'row' ? cat.row(name) : cat.figure(name)).key)}"]`);
  const region = cat.row('Region')?.key, category = cat.row('Category')?.key, sales = cat.figure('Sales')?.key;
  const keys = [region, category, sales];
  const waitFor = async (test, ms = 15000) => { const t = performance.now(); while (!test() && performance.now() - t < ms) await new Promise((r) => setTimeout(r, 100)); return test(); };

  // The export probe: a Region = West filter through the same path as the filter picker's Apply.
  // It narrows the Report sheet's figures; Definitions holds no data and rightly does not change.
  appState.exportProbe({
    build: async () => (await builder.buildWorkbook())?.blob,
    select: async () => {
      const key = region ?? cat.rows.find((r) => !r.date)?.key;
      const value = region ? 'West' : (await q({ dimensions: [{ fieldKey: key, name: 'v' }], orders: [{ columnIdx: 0, direction: 'asc' }], limit: 1 }))[0]?.[0];
      builder.setSelection(key, [String(value)]);
    },
    clear: () => builder.clearFilters(),
    exempt: ['Definitions'],
  });

  appState.check('Build: New, then Region and Category as rows and Sales as a figure from the panel; the native table renders their rows', async () => {
    E.newBtn.click();
    await settle();
    panel('Region', 'row').click();
    panel('Category', 'row').click();
    panel('Sales', 'fig').click();
    await settle();
    const a = latest(keys);
    const rows = a ? JSON.parse(a.rows) : [];
    return { pass: status() === 'rendered' && typeNow() === 'table' && rows.length >= 4 && rows[0].length === 3, detail: `${typeNow()} ${status()}, ${rows.length} rows, first ${JSON.stringify(rows[0])}` };
  });

  appState.check('Filter: + Add filter, tick Region = West, Apply; the table rows change; Clear all restores them', async () => {
    const before = latest(keys)?.rows;
    E.addFilterBtn.click();
    const box = await waitFor(() => E.pop.querySelector('input[type=checkbox][value="West"]'));
    if (!box) return { pass: false, detail: 'no West value in the filter picker' };
    box.click();
    E.pop.querySelector('[data-apply]').click();
    await settle();
    const during = latest(keys);
    const chip = document.querySelector('.fchip')?.textContent ?? '';
    E.clearAllBtn.click();
    await settle();
    const after = latest(keys)?.rows;
    const westSent = JSON.stringify(during?.filters ?? []).includes('West');
    return { pass: westSent && during.rows !== before && after === before && chip.includes('West'), detail: `chip "${chip}"; filter sent ${westSent}; rows moved ${during?.rows !== before}; restored ${after === before}` };
  });

  appState.check('Period: Year to date sends a date range to the table and changes its rows; All time restores them', async () => {
    const before = latest(keys)?.rows;
    const sel = document.querySelector('select[aria-label="Period"]');
    sel.value = 'ytd';
    sel.dispatchEvent(new Event('change'));
    await settle();
    const during = latest(keys);
    sel.value = 'all';
    sel.dispatchEvent(new Event('change'));
    await settle();
    const range = JSON.stringify(during?.filters ?? []).match(/\d{4}-\d{2}-\d{2}/g) ?? [];
    return { pass: range.length === 2 && during.rows !== before && latest(keys)?.rows === before, detail: `range ${range.join(' – ')}; rows moved ${during?.rows !== before}; restored ${latest(keys)?.rows === before}` };
  });

  appState.check('Chart: the Bar and Line buttons remount the report as native charts that render; Table switches back', async () => {
    const seen = [];
    for (const v of ['bar', 'line', 'table']) {
      E.viewSeg.querySelector(`[data-view="${v}"]`).click();
      await settle();
      seen.push(`${typeNow()}:${status()}`);
    }
    return { pass: seen.join() === 'bar:rendered,line:rendered,table:rendered', detail: seen.join(', ') };
  });

  appState.check('Save and reopen: Save as "Check report", remove Sales, reopen it from Saved reports; rows, figures and table come back; the share link decodes to the same report', async () => {
    const name = 'Check report';
    E.nameIn.value = name;
    E.nameIn.dispatchEvent(new Event('input'));
    E.saveBtn.click();
    const savedOk = builder.saved().some((r) => r.name === name);
    const want = JSON.stringify({ rows: builder.st.rows, figures: builder.st.figures });
    const rowsBefore = latest(keys)?.rows;
    panel('Sales', 'fig').click();
    await settle();
    const gone = builder.st.figures.length === 0;
    E.savedBtn.click();
    const open = await waitFor(() => E.pop.querySelector(`.rb-open[data-name="${name}"]`));
    open?.click();
    await settle();
    const back = JSON.stringify({ rows: builder.st.rows, figures: builder.st.figures });
    const shared = builder.decode(location.hash.slice(3));
    builder.store(builder.saved().filter((r) => r.name !== name));
    return { pass: savedOk && gone && back === want && status() === 'rendered' && latest(keys)?.rows === rowsBefore && shared.name === name && shared.figures.length === 1, detail: `saved ${savedOk}; removed ${gone}; reopened ${back === want} (${back}); table ${status()}, rows equal ${latest(keys)?.rows === rowsBefore}; link → "${shared.name}"` };
  });

  appState.check('Export: Export .xlsx downloads a workbook with the table\'s own rows and every column', async () => {
    E.exportBtn.click();
    const done = await waitFor(() => builder.lastExport, 20000);
    const e = builder.lastExport;
    return { pass: !!done && e.rows > 0 && e.width === e.cols && e.size > 2000, detail: e ? `${e.rows} rows × ${e.cols} columns (data ${e.width} wide), ${e.size} bytes, first ${JSON.stringify(e.first)}` : 'no export' };
  });

  appState.check('Comparison: the "Monthly sales against last year" starter shows a Sales vs LY column that matches the months it compares, blank for the first year, and exports it', async () => {
    const t = fromStarter(STARTERS[1], cat);
    if (!t) return { pass: true, detail: 'starter not on this layer' };
    E.savedBtn.click();
    const open = await waitFor(() => E.pop.querySelector(`.rb-open[data-name="${t.name}"]`));
    open.click();
    await settle();
    const a = latest([cat.row('Order Date').key, sales]);
    const rows = a ? JSON.parse(a.rows) : [];
    // Columns: month, Sales, Orders, Profit Ratio, then the three changes. Oldest month first.
    const [m0, s0, , , g0] = rows.at(-1) ?? [];
    const m12 = rows.find((r) => new Date(r[0]).getUTCFullYear() === new Date(m0).getUTCFullYear() - 1 && new Date(r[0]).getUTCMonth() === new Date(m0).getUTCMonth());
    const expected = m12 ? (s0 - m12[1]) / m12[1] : null;
    const firstYearBlank = rows.slice(0, 12).every((r) => r[4] === null);
    const ok = firstYearBlank && typeof g0 === 'number' && expected !== null && Math.abs(g0 - expected) < 1e-6;
    // Its export carries the change columns too, from the table's own rows.
    const before = builder.lastExport;
    E.exportBtn.click();
    await waitFor(() => builder.lastExport !== before, 20000);
    const x = builder.lastExport;
    const exported = x !== before && x.cols === 7 && x.width === 7;
    return { pass: status() === 'rendered' && ok && exported, detail: `export ${x?.rows}×${x?.width}; ` + `${rows.length} rows, first-year changes ${JSON.stringify(rows.slice(0, 12).map((r) => r[4]).filter((v) => v !== null).length)} non-null; ${new Date(m0).toISOString().slice(0, 7)} sales ${s0} vs ${m12?.[1]}: table ${g0}, expected ${expected}` };
  });
};
