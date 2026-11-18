/**
 * Larkspur Music Royalty Close & Exception Review — for Finance Controllers and Royalty Operations.
 * Answers: which statements need attention before close? who owns each exception? what evidence supports sign-off?
 *
 * CLEARLY LABELLED DEMO DATA: ROYALTY_* mirrors source.royalty_engine_statement_view and
 * royalty_engine_statementamount_view (joined on StatementId; grain validated: one row per StatementId × Amount Type),
 * plus Suspense, Calc Errors and Income Statement detail. Workflow writes go to the dedicated demo writeback tables
 * ROYALTY_CLOSE_CASES + ROYALTY_CLOSE_EVENTS through app.writeback, mirroring the layer's Data Actions (role + branch guards).
 * Royalty amounts and reconciliation flags are read-only source fields: nothing here writes to them.
 */
import { createAstratoApp } from '@astrato-io/app-runtime';
import { createVisualizationRuntime, registry } from '@astrato-io/visualizations';
import { createVisualizationAvailableFields } from '@astrato-io/visualizations/definitions';
import { throttleQueries, clearQueryCache, queryLog } from './throttle.js';
import { buildTiles, buildTile, compileTiles, KPIS } from './dashboard.js';
import { questionOf, C } from './catalogue.js';
import { QUESTIONS, bqTileOf } from './questions.js';
import { createFieldIndex } from './fields.js';
import { themeVSpec, applyEach } from './theme.js';
import { workbookBlob } from './xlsx.js';
import { el, esc, num } from './util.js';
import { startTranslation, languageSelect, t as tt } from './i18n.js';
import { appState } from './app-state.js';

let LAYER = null; // the app's semantic layer, from the runtime (app.dataBinding.semanticLayerId)
const DEMO_DATE = '2026-11-11';
const ST = 'Statements', CC = 'Close Cases', CV = 'Close Case History', BR = 'Branches';
const PAGES = [
  ['sum', 'Summary', 'The close at a glance for a phone: current run R-2026-10 against the prior run, what needs you, and where the exposure is. Use the header to filter by branch, run or currency.',
    [], ['s-k-exc', 's-k-unrec', 's-k-exp', 's-k-sus'],
    [['x:mine', 'full', 'Needs you'], ['s-top', 'full'], ['s-br', 'full']]],
  ['ov', 'Close overview', 'Which statements need attention before close? Current processing run R-2026-10 (October 2026) against the prior run. Amounts are local currency in the queue and USD equivalent in KPIs; the source reconciliation flag is shown as delivered by Royalty Engine 1.0.',
    ['ctl-g-ov-branches-branch', 'ctl-g-ov-statements-processing-run', 'ctl-g-ov-statements-currency', 'ctl-g-ov-statements-exception-category', 'ctl-g-ov-statements-reconciliation-status'], ['k-exc', 'k-unrec', 'k-exp', 'k-sus', 'k-ce', 'k-wo'],
    [['o-queue', 'full tall'], ['x:pivot', 'full', 'Exception pivot · current run · totals per branch only (USD equivalent)'], ['o-branch', 'full'], ['o-trend', 'wide'], ['o-ce', 'third'], ['o-cat', 'half'], ['o-sus', 'half']]],
  ['st', 'Statement investigation', 'Statement amounts, source reconciliation status and supporting detail for one StatementId. Open or assign a case, choose the exception type, set a due date, add notes and evidence references, and submit it for controller review.',
    ['ctl-g-st-branches-branch', 'ctl-g-st-statements-processing-run', 'ctl-g-st-statements-currency', 'ctl-g-st-statements-statement-id'], [],
    [['x:facts', 'full', 'Statement (source, read-only)'], ['x:case', 'full', 'Exception case'], ['s-amts', 'half'], ['s-inc', 'half'], ['s-susd', 'half short'], ['s-ced', 'half short'], ['s-hist', 'full short']]],
  ['cr', 'Controller review', 'Who owns each exception, and what evidence supports sign-off? Approve the disposition, return it for more work, or approve a carry-forward with a required rationale. Approved carry-forwards stay in outstanding source exposure until the source is corrected.',
    ['ctl-g-cr-branches-branch', 'ctl-g-cr-statements-processing-run', 'ctl-g-cr-statements-currency', 'ctl-g-cr-close-cases-status', 'ctl-g-cr-close-cases-owner'], ['k-rev', 'k-app', 'k-cf'],
    [['x:review', 'full', 'Review queue · submitted cases'], ['c-cases', 'full tall'], ['c-cf', 'half'], ['c-status', 'half'], ['c-audit', 'full']]],
  ['sim', 'Close simulator', 'What-if: will the run close on time? Baseline is the governed current-run position; move the levers to project the residual unreconciled statements and exposure at the close deadline. Assumptions are illustrative.', [], [], [['x:sim', 'full', 'Close readiness what-if']]],
  ['bq', 'Business questions', 'Stored business questions in the Larkspur Music semantic layer, each run as a native Astrato table.', ['ctl-g-bq-branches-branch', 'ctl-g-bq-statements-processing-run', 'ctl-g-bq-statements-currency'], [], [['x:bq', 'full', 'Business questions']]],
];
const GROUPS = ['g-ov', 'g-st', 'g-cr', 'g-bq'];
const PAGE_GROUP = { sum: 'g-ov', ov: 'g-ov', st: 'g-st', cr: 'g-cr', sim: 'g-ov', bq: 'g-bq' };
const SOURCES = [['Royalty Engine 1.0', 'statement + statementamount views'], ['Royalty Engine detail', 'Suspense, Calc Errors, Income Statement'], ['Larkspur Data workflow (demo target)', 'ROYALTY_CLOSE_CASES / _EVENTS']];
const EXC_TYPES = ['Unreconciled statement', 'Suspense', 'Calculation error', 'Write-off', 'Other'];
const DISPOSITIONS = ['Corrected in next processing run', 'Manual adjustment posted', 'Suspense released after match', 'Write-off approved', 'Timing difference – no action', 'Carry forward to next run'];
const LOCAL_KEY = 'royalty-close-local-v1', ROLE_KEY = 'royalty-close-role-v1';
const fmtAmt = (v, ccy) => `${ccy ?? ''} ${Number.isFinite(num(v)) ? num(v).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '–'}`.trim();
const usd = (v) => `$${Math.round(num(v) || 0).toLocaleString('en-US')}`;
const iso = () => new Date().toISOString().replace(/\.\d+Z$/, 'Z');
const day = (v) => { if (v == null || v === '') return ''; const d = new Date(typeof v === 'number' || /^\d+$/.test(String(v)) ? Number(v) : v); return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10); };
const stamp = (v) => { if (v == null || v === '') return ''; const d = new Date(typeof v === 'number' || /^\d+$/.test(String(v)) ? Number(v) : v); return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 16).replace('T', ' '); };
const blank = (v) => (v == null || v === 'null' ? '' : String(v));
const F = (name, valueType = 'string') => ({ name, valueType });
const pillOf = (s) => { const c = /Approved$/.test(s) ? 'green' : /Carry/.test(s) ? 'amber' : /Submitted/.test(s) ? 'navy' : /Returned/.test(s) ? 'red' : 'plum'; return `<span class="pill ${c}">${esc(s)}</span>`; };

const main = async () => {
  const status = (s) => { const n = document.getElementById('splash-status'); if (n) n.textContent = s; };
  const app = await createAstratoApp();
  LAYER = app.dataBinding.semanticLayerId;
  throttleQueries(app.client.hostServices);
  const { engine, selections } = app.client.hostServices;
  for (const g of GROUPS) {
    let timer;
    selections.onActiveSelectionChange(g).subscribe((next) => { clearTimeout(timer); if (next.pending.length > 0) timer = setTimeout(() => selections.applyPendingSelections(g), 250); });
  }
  status('Reading the governed semantic layer…');
  const dataBinding = { ...app.dataBinding };
  const metadata = await engine.fields.getFieldMetadata(dataBinding);
  const runtime = createVisualizationRuntime({ client: app.client, registry });
  const availableFields = createVisualizationAvailableFields(metadata).filter((f) => f?.resultType !== 'unhandled');
  appState.fields(availableFields);
  const fields = createFieldIndex(availableFields);
  window.__fields = fields;
  const built = buildTiles(fields);
  const compiled = await compileTiles(built.tiles, availableFields);
  const failures = [...built.failures, ...compiled.failures];
  if (failures.length) console.warn('[tiles]', JSON.stringify(failures));
  const tiles = new Map();
  await Promise.all(compiled.compiled.map(async (t) => { const th = await themeVSpec({ id: t.id, type: t.type, vSpec: t.vSpec, dataBinding }, availableFields, t); tiles.set(t.id, { ...t, vSpec: th.vSpec }); }));
  window.__astrato = { tiles: [...tiles.keys()], failures, mounted: {} };

  const q = async ({ dims = [], measures = [], limit = 500, filters = [] }) => {
    const dimensions = dims.map(([name, view]) => { const f = fields.raw(name, view); if (!f) throw new Error(`no field ${view}.${name}`); return { fieldKey: f.fieldKey, name }; });
    const calculations = measures.map((name) => { const f = fields.measure(name); if (!f) throw new Error(`no measure ${name}`); return { calculation: '{m1}', itemKey: f.fieldKey, label: name }; });
    const query = { dimensions, calculations, orders: [], limit, offset: 0, filters: filters.map((x) => (Array.isArray(x) ? { field: { fieldKey: fields.raw(x[0], x[1]).fieldKey }, operator: 'inList', values: x[2].map(String) } : { field: { fieldKey: x.fieldKey }, operator: 'inList', values: x.values.map(String) })), totals: false, showRecordsCount: false, outerViews: [], associativeListFilter: null };
    const { response } = await engine.getData({ ...dataBinding, query });
    const names = [...dimensions.map((d) => d.name), ...measures];
    return Object.values(response?.data ?? {}).map((row) => Object.fromEntries(names.map((n, i) => [n, row[i]])));
  };
  window.__q = q;
  // ------------------------------------------------------------------ copy a table to the clipboard (tab-separated, every row)
  // A native table only renders the rows on screen, so the copy re-runs the table's own governed query: same columns,
  // its static filters and the group's applied selections. Pastes straight into Excel or Google Sheets.
  const cellOf = (v) => { if (v == null) return ''; if (typeof v === 'number') return String(Math.round(v * 1e6) / 1e6); const x = String(v); return /^\d{12,13}$/.test(x) ? new Date(Number(x)).toISOString().slice(0, 10) : x.replace(/[\t\r\n]+/g, ' '); };
  const writeClipboard = async (text) => {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back below */ }
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    ta.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.append(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { /* */ }
    ta.remove();
    return ok;
  };
  const copyTable = async (tile, button) => {
    const label = button.textContent;
    button.disabled = true; button.textContent = tt('Copying…');
    try {
      const dimsT = (tile.dimensions ?? []).filter((d) => fields.raw(d.name, d.view));
      const seen = new Set();
      const measT = (tile.measures ?? []).filter((m) => m.ref !== tile.miniChart?.ref && !seen.has(m.name) && seen.add(m.name));
      const sel = (selections.getSelection(tile.group)?.applied ?? []).filter((x) => x.values?.length && x.field?.fieldKey).map((x) => ({ fieldKey: x.field.fieldKey, values: x.values }));
      const rows = await q({ dims: dimsT.map((d) => [d.name, d.view]), measures: measT.map((m) => m.name), filters: [...(tile.filters ?? []).map((f) => [f.field, f.view, f.values]), ...sel], limit: 10000 });
      const sorts = [].concat(tile.sort ?? []).map((o) => ({ key: [...dimsT, ...measT].find((x) => x.ref === o.by)?.name, dir: o.direction === 'asc' ? 1 : -1 })).filter((o) => o.key);
      if (sorts.length) rows.sort((a, b) => { for (const { key, dir } of sorts) { const x = a[key], y = b[key]; if (x === y) continue; if (x == null) return 1; if (y == null) return -1; return (typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))) * dir; } return 0; });
      const head = [...dimsT, ...measT].map((c) => tt(tile.columnLabels?.[c.ref] ?? c.name));
      const text = [head, ...rows.map((r) => [...dimsT.map((d) => cellOf(r[d.name])), ...measT.map((m) => cellOf(r[m.name]))])].map((r) => r.join('\t')).join('\n');
      const ok = await writeClipboard(text);
      toast(ok ? `${tt('Copied')} ${rows.length.toLocaleString()} ${tt('rows to the clipboard')} · ${esc(tt(tile.title.split(' · ')[0]))}` : tt('The browser blocked clipboard access.'));
    } catch (e) { console.warn('[copy]', e); toast(`${tt('Copy failed')}: ${esc(e?.message ?? e)}`); }
    finally { button.disabled = false; button.textContent = label; }
  };
  const copyButton = (tile) => el('button', { class: 'ls-copy', type: 'button', title: 'Copy this table to the clipboard (all rows, tab-separated)', text: '⧉ Copy', onclick: (e) => copyTable(tile, e.currentTarget) });


  // ------------------------------------------------------------------ shell (black top nav, green active pill)
  const root = document.getElementById('root');
  const tabs = el('nav', { class: 'ls-nav' });
  const body = el('div', { class: 'ls-body' });
  const selBar = el('div', { class: 'sb-selbar' });
  const toasts = el('div', { class: 'sb-toasts' });
  const toast = (msg) => { const t = el('div', { class: 'sb-toast', html: msg }); toasts.append(t); setTimeout(() => t.remove(), 5000); };
  const roleSel = el('select', { title: 'Acting as (role + branch access are enforced on every write)' });
  const exportBtn = el('button', { class: 'ls-btn', text: '⬇ Excel close pack' });
  const resetBtn = el('button', { class: 'ls-btn', text: 'Reset demo', title: 'Clears this browser’s fallback copy and reloads (warehouse reset: see the README)' });
  const hBranch = el('select'), hRun = el('select'), hCcy = el('select');
  const banner = el('div', { class: 'ls-banner', html: 'Loading the close position…' });
  root.replaceChildren(
    tabs,
    el('div', { class: 'ls-tools' }, [el('span', { class: 'src', html: SOURCES.map(([n, d]) => `<b>${esc(n)}</b> · ${esc(d)}`).join(' &nbsp;|&nbsp; ') }), el('span', { class: 'sp' }), resetBtn, exportBtn]),
    el('div', { class: 'ls-band' }, [
      el('div', { class: 'ls-logo', html: '<b>larkspur<i>data</i></b><span>Royalty Close &amp; Exception Review</span>' }),
      el('div', { class: 'ls-hsel' }, [el('label', {}, [el('small', { text: 'Branch' }), hBranch]), el('label', {}, [el('small', { text: 'Processing run' }), hRun]), el('label', {}, [el('small', { text: 'Currency' }), hCcy]), el('label', { class: 'ls-actas' }, [el('small', { text: 'Acting as (role + branch access)' }), roleSel]), el('label', { class: 'ls-lang' }, [el('small', { text: 'Language' }), languageSelect(el)])]),
      el('button', { class: 'ls-hclear', text: 'Clear', onclick: () => { hBranch.value = hRun.value = hCcy.value = ''; applyHeader(); } }),
    ]),
    banner, selBar, body,
    el('footer', { class: 'ls-foot', html: 'DEMO DATA, clearly labelled: generated to mirror Royalty Engine 1.0 views until the live overview and writeback connection are validated. Writes go to the dedicated demo writeback tables ROYALTY_CLOSE_CASES / ROYALTY_CLOSE_EVENTS. Built in <b>Astrato</b>.' }),
    toasts,
  );
  tabs.append(el('span', { class: 'sp' }), el('span', { class: 'demo', text: 'DEMO DATA' }));
  startTranslation();
  {
    // On phones the header dropdowns sit behind one button that names what is selected; desktop shows them as before.
    const band = root.querySelector('.ls-band');
    const hsel = band.querySelector('.ls-hsel');
    const toggle = el('button', { class: 'ls-hsel-toggle', type: 'button', 'aria-expanded': 'false' });
    const label = () => {
      const pick = (sel) => sel.selectedOptions[0]?.textContent ?? '';
      const parts = [hBranch.value || 'All branches', hRun.value || '', hCcy.value || ''].filter(Boolean);
      toggle.replaceChildren(el('span', { text: 'Filters & role' }), el('b', { text: `${parts.join(' · ')} · ${String(pick(roleSel)).split(' · ')[0]}` }), el('i', { text: band.classList.contains('open') ? '▴' : '▾' }));
    };
    toggle.onclick = () => { band.classList.toggle('open'); toggle.setAttribute('aria-expanded', String(band.classList.contains('open'))); label(); };
    band.insertBefore(toggle, hsel);
    for (const sel of [hBranch, hRun, hCcy, roleSel]) sel.addEventListener('change', label);
    window.__hselLabel = label;
    setTimeout(label, 0);
  }

  const mountQueue = [];
  const slotFor = (id) => { const s = el('div', { class: 'ob-viz', 'data-slot': id }); mountQueue.push([id, s]); return s; };
  const card = (id, cls) => { const t = tiles.get(id); return el('figure', { class: `ls-card ${cls}`, 'data-tile': id }, [el('figcaption', { class: 'ls-cap' }, [el('span', { text: t?.title ?? id }), t?.type === 'table' && (t.dimensions ?? []).length ? copyButton(t) : null]), t && t.type !== 'filter' ? el('p', { class: 'ax-bq', title: 'Stored business question in the semantic layer', text: `BQ · ${questionOf(t)}` }) : null, t ? slotFor(id) : el('p', { class: 'ls-empty', text: 'Not available in this layer' })]); };
  const kpi = (id) => el('figure', { class: 'ls-card kx-kpi' }, [
    el('figcaption', { text: KPIS[id]?.label ?? id, title: KPIS[id]?.note ?? '' }),
    el('div', { class: 'kx-kpi-row' }, [el('div', { class: 'kx-kpi-num' }, tiles.has(id) ? slotFor(id) : null), el('div', { class: 'kx-kpi-spark' }, tiles.has(`${id}-sp`) ? slotFor(`${id}-sp`) : null)]),
    el('div', { class: 'kx-kpi-delta' }, tiles.has(`${id}-d`) ? slotFor(`${id}-d`) : null),
  ]);
  const panes = {}, hosts = {};
  const tabBtns = [];
  for (const [key, label, intro, controls, kpis, charts] of PAGES) {
    const pane = el('section', { class: 'ls-pane', 'data-page': key });
    const grid = el('div', { class: 'ls-grid' }, charts.map(([c, cls, title]) => {
      if (!c.startsWith('x:')) return card(c, cls);
      const h = el('div', { class: 'ls-custom', html: '<p class="ls-empty">Loading governed data…</p>' });
      hosts[c.slice(2)] = h;
      return el('figure', { class: `ls-card ${cls}` }, [el('figcaption', { text: title }), h]);
    }));
    hosts[`top-${key}`] = el('div');
    pane.append(el('h2', { text: label }), el('p', { class: 'ls-intro', text: intro }), hosts[`top-${key}`], ...(controls.length ? [el('div', { class: 'ls-filters' }, controls.map((c) => card(c, 'ob-filter')))] : []), ...(kpis.length ? [el('div', { class: `ls-kpis ${kpis.length === 3 ? 'k3' : ''}` }, kpis.map(kpi))] : []), ...(key === 'st' ? [el('div', { class: 'ls-kpis k5' }, ['s-gross', 's-diff', 's-sus', 's-ce', 's-exp'].map((id) => el('figure', { class: 'ls-card ls-kpi-plain' }, [el('figcaption', { text: tiles.get(id)?.title ?? id }), tiles.has(id) ? slotFor(id) : null])))] : []), grid);
    panes[key] = pane;
    body.append(pane);
    const b = el('button', { 'data-page': key, text: label, title: intro, onclick: () => show(key) });
    tabBtns.push(b);
    tabs.insertBefore(b, tabs.querySelector('.sp'));
  }

  // ------------------------------------------------------------------ selection bar + tabs (inactive panes off-screen, never display:none)
  let current = 'ov';
  const labelOf = (fk) => String(fk).match(/\[([^\]]+)\]$/)?.[1] ?? fk;
  const renderSelBar = () => {
    const g = PAGE_GROUP[current];
    const { applied = [], pending = [] } = selections.getSelection(g) ?? {};
    const list = [...applied, ...pending].filter((x) => x.values?.length);
    selBar.replaceChildren(el('b', { text: 'Selections' }),
      ...(list.length ? list.map((x) => el('span', { class: 'sb-chip' }, [el('i', { text: labelOf(x.field?.fieldKey ?? x.fieldKey) }), document.createTextNode(x.values.slice(0, 4).join(', ') + (x.values.length > 4 ? ` +${x.values.length - 4}` : '')), el('button', { text: '×', title: 'Remove', onclick: () => selections.removeSelection(g, x) })]))
        : [el('span', { class: 'sb-none', text: 'None. Use the header dropdowns, the filters, or click a row or bar.' })]),
      ...(list.length ? [el('button', { class: 'sb-clear', text: 'Clear all', onclick: () => selections.clearAllSelections(g) })] : []));
  };
  for (const g of GROUPS) selections.onActiveSelectionChange(g).subscribe(() => { if (PAGE_GROUP[current] === g) renderSelBar(); });
  const show = (key) => {
    for (const [k, p] of Object.entries(panes)) p.classList.toggle('off', k !== key);
    for (const b of tabBtns) b.classList.toggle('on', b.dataset.page === key);
    current = key; renderSelBar(); window.scrollTo({ top: 0 });
  };
  window.__show = show;
  for (const [key] of PAGES) appState.tab(key, () => show(key));
  const slotWidth = new Map(mountQueue.map(([id, s]) => [id, s.clientWidth]));
  show(window.matchMedia('(max-width: 760px)').matches ? 'sum' : 'ov');
  document.getElementById('splash')?.remove();

  const fit = async (t, width) => {
    if (!t.fitColumns || width < 40) return t.vSpec;
    const requests = [{ name: 'setTableAllColumnsResponsiveWidth', payload: false }];
    for (const [ref, share] of Object.entries(t.fitColumns)) { const item = t.resolvedRefs?.[ref]; if (item) requests.push({ name: 'setColumnWidth', payload: { dataItemInternalKey: item.dataItemInternalKey, dataItemUniqueSignature: item.dataItemUniqueSignature, width: `${Math.floor((width - 4) * share)}px` } }); }
    return (await applyEach({ id: t.id, type: t.type, vSpec: t.vSpec, dataBinding }, availableFields, t.type, requests)).vSpec;
  };
  const mountOne = (id, slot) => {
    const t = tiles.get(id);
    if (!t) return;
    appState.declare(id, slot.closest('[data-page]')?.dataset.page ?? null);
    runtime.createInstance({ id, type: t.type, groupId: t.group, vSpec: t.vSpec, dataBinding });
    runtime.mount(slot, id).then((h) => h.ready).then((r) => { window.__astrato.mounted[id] = r?.status; appState.settle(id, r?.status, r); if (r?.status !== 'rendered') window.__astrato.errors = { ...window.__astrato.errors, [id]: r }; }).catch((e) => { window.__astrato.mounted[id] = String(e); appState.settle(id, 'error', e); });
  };
  for (const [id, slot] of mountQueue) {
    const t = tiles.get(id);
    if (!t) continue;
    mountOne(id, slot);
    if (t.fitColumns) fit(t, slotWidth.get(id) || 1200).then((vSpec) => { t.vSpec = vSpec; runtime.updateInstance(id, { vSpec }); }).catch((e) => console.warn('[fit]', id, e));
  }
  // Pixel column widths are fitted to the slot at load; when the window narrows, push new widths into the
  // mounted table (no remount) so it never runs past its card. Charts resize themselves.
  {
    const fitted = new Map(mountQueue.map(([id]) => [id, slotWidth.get(id) || 1200]));
    const timers = new Map();
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const id = entry.target.dataset.slot;
        const t = tiles.get(id);
        const width = Math.round(entry.contentRect.width);
        if (!t?.fitColumns || width < 40 || Math.abs(width - (fitted.get(id) ?? 0)) < 8) continue;
        clearTimeout(timers.get(id));
        timers.set(id, setTimeout(() => {
          fitted.set(id, width);
          fit(t, width).then((vSpec) => { t.vSpec = vSpec; if (runtime.listInstances().some((i) => i.id === id)) runtime.updateInstance(id, { vSpec }); }).catch((e) => console.warn('[fit]', id, e));
        }, 250));
      }
    });
    for (const [id, slot] of mountQueue) if (tiles.get(id)?.fitColumns) ro.observe(slot);
  }
  const remount = (ids) => { for (const id of ids) { const slot = mountQueue.find(([i]) => i === id)?.[1]; if (!slot || !tiles.has(id)) continue; try { runtime.removeInstance?.(id); } catch { /* */ } slot.replaceChildren(); mountOne(id, slot); } };
  const CASE_TILES = ['o-branch', 's-hist', 'c-cases', 'c-cf', 'c-status', 'c-audit', 'k-rev', 'k-rev-d', 'k-app', 'k-app-d', 'k-cf', 'k-cf-d'];

  // visualizations 0.9: number KPIs and one-row comparison tables follow the group's selections on their own,
  // so the static-filter mirror that pushed selections into them was removed (smoke checks: KPI and comparison move and restore).
  const select = (g, field, view, values) => {
    const f = fields.raw(field, view);
    if (!f) return;
    const cur = (selections.getSelection(g)?.applied ?? []).find((x) => x.field?.fieldKey === f.fieldKey);
    if (cur) selections.removeSelection(g, cur);
    if (values.length) selections.selectValues(g, { field: { fieldKey: f.fieldKey }, kind: 'VALUE', operator: 'inList', values }, { state: 'applied' });
  };
  const selectedValues = (g, field, view) => { const f = fields.raw(field, view); return (selections.getSelection(g)?.applied ?? []).find((x) => x.field?.fieldKey === f?.fieldKey)?.values ?? []; };

  // ------------------------------------------------------------------ reference data: users, header dropdowns
  const [users, branches, runsList] = await Promise.all([
    q({ dims: [['User Name', 'App Users'], ['Role', 'App Users'], ['Branch Scope', 'App Users'], ['Can Write', 'App Users'], ['App', 'App Users']], limit: 100 }),
    q({ dims: [['Branch', BR], ['Branch Name', BR], ['Currency', BR], ['Branch Controller', BR]], limit: 50 }),
    q({ dims: [['Processing Run', ST]], limit: 50 }),
  ]);
  const closeUsers = users.filter((u) => u.App !== 'Recovery');
  const userOf = (name) => closeUsers.find((u) => u['User Name'] === name);
  const scopeOk = (u, branch) => u && (u['Branch Scope'] === 'ALL' || String(u['Branch Scope']).split(',').includes(branch));
  for (const u of closeUsers) roleSel.append(el('option', { value: u['User Name'], text: `${u['User Name']} · ${u.Role}${u['Branch Scope'] === 'ALL' ? ' · all branches' : ` · ${u['Branch Scope']}`}` }));
  try { roleSel.value = localStorage.getItem(ROLE_KEY) || 'Priya Shah'; } catch { roleSel.value = 'Priya Shah'; }
  if (!roleSel.value) roleSel.value = 'Priya Shah';
  const me = () => userOf(roleSel.value);
  hBranch.append(el('option', { value: '', text: 'All branches' }), ...branches.sort((a, b) => String(a.Branch).localeCompare(b.Branch)).map((b) => el('option', { value: b.Branch, text: `${b.Branch} · ${b['Branch Name']}` })));
  hRun.append(el('option', { value: '', text: 'All runs' }), ...runsList.map((r) => r['Processing Run']).sort().reverse().map((r) => el('option', { value: r, text: r === 'R-2026-10' ? `${r} (current)` : r })));
  hCcy.append(el('option', { value: '', text: 'All currencies' }), ...[...new Set(branches.map((b) => b.Currency))].sort().map((c) => el('option', { value: c, text: c })));
  const applyHeader = () => {
    for (const g of GROUPS) { select(g, 'Branch', BR, hBranch.value ? [hBranch.value] : []); select(g, 'Processing Run', ST, hRun.value ? [hRun.value] : []); select(g, 'Currency', ST, hCcy.value ? [hCcy.value] : []); }
    renderBanner();
  };
  hBranch.onchange = hRun.onchange = hCcy.onchange = applyHeader;
  window.__hselLabel?.();

  // ------------------------------------------------------------------ banner sentence (governed numbers)
  const renderBanner = async () => {
    const f = [];
    if (hBranch.value) f.push(['Branch', BR, [hBranch.value]]);
    if (hCcy.value) f.push(['Currency', ST, [hCcy.value]]);
    const run = hRun.value || 'R-2026-10';
    try {
      const [[r] = {}] = [await q({ measures: ['Statements', 'Exception Statements', 'Unreconciled Statements', 'Source Exposure USD', 'Suspense Items', 'Calc Errors'], filters: [...f, ['Processing Run', ST, [run]]], limit: 1 })];
      const [[c] = {}] = [await q({ measures: ['Open Cases', 'Overdue Cases', 'Cases Awaiting Review', 'Approved Carry-forwards'], filters: f.filter(([n]) => n === 'Branch'), limit: 1 })];
      banner.innerHTML = `My close: <b>${num(r.Statements).toLocaleString()}</b> statements in <b>${esc(run)}</b>${hBranch.value ? ` for <b>${esc(hBranch.value)}</b>` : ' across <b>8</b> branches'} · <b>${num(r['Exception Statements'])}</b> need attention (<b>${num(r['Unreconciled Statements'])}</b> unreconciled, <b>${num(r['Suspense Items'])}</b> suspense items, <b>${num(r['Calc Errors'])}</b> calc errors) · <b>${usd(r['Source Exposure USD'])}</b> source exposure<br>` +
        `<b>${num(c['Open Cases'])}</b> open cases · <b>${num(c['Overdue Cases'])}</b> overdue · <b>${num(c['Cases Awaiting Review'])}</b> awaiting controller review · <b>${num(c['Approved Carry-forwards'])}</b> approved carry-forwards still exposed`;
    } catch (e) { console.warn('[banner]', e); }
  };

  // ------------------------------------------------------------------ workflow state (governed read; app.writeback writes)
  const state = { cases: [], live: false, statement: null, facts: null, reviewSel: null };
  const readCases = async () => {
    try {
      const rows = await q({ dims: ['Case Id', 'Statement Id', 'Exception Type', 'Status', 'Owner', 'Due Date', 'Observed Amount', 'Observed Currency', 'Observed Recon Flag', 'Notes', 'Evidence Refs', 'Disposition', 'Controller', 'Controller Rationale', 'Carry Forward', 'Is Overdue', 'Is Open', 'Created By', 'Updated By', 'Updated At'].map((n) => [n, CC]), limit: 2000 });
      const br = await q({ dims: [['Case Id', CC], ['Branch', ST]], measures: ['Cases'], limit: 2000 });
      const brOf = Object.fromEntries(br.map((r) => [r['Case Id'], r.Branch]));
      state.cases = rows.map((r) => ({ ...r, Branch: brOf[r['Case Id']], 'Due Date': day(r['Due Date']), Notes: blank(r.Notes), 'Evidence Refs': blank(r['Evidence Refs']), Disposition: blank(r.Disposition), Controller: blank(r.Controller), 'Controller Rationale': blank(r['Controller Rationale']) }));
      state.live = true;
      const local = readLocal();
      if (local?.cases?.length) for (const lc of local.cases) if (!state.cases.some((c) => c['Case Id'] === lc['Case Id'])) state.cases.push(lc);
    } catch (e) { console.warn('[cases]', e); const local = readLocal(); state.cases = local?.cases ?? []; }
  };
  const readLocal = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY)); } catch { return null; } };
  const saveLocal = (c) => { try { const l = readLocal() ?? { cases: [] }; l.cases = [...l.cases.filter((x) => x['Case Id'] !== c['Case Id']), c]; localStorage.setItem(LOCAL_KEY, JSON.stringify(l)); } catch { /* */ } };
  const write = async (req) => {
    if (typeof app.writeback !== 'function') throw new Error('writeback unavailable');
    const r = await app.writeback({ dataviewID: LAYER, ...req });
    clearQueryCache();
    if (!r?.response?.rowsAffected) throw new Error('no rows changed');
    return r;
  };
  const caseRow = (id) => state.cases.find((c) => c['Case Id'] === id);
  const openCaseFor = (sid) => state.cases.find((c) => c['Statement Id'] === sid && Number(c['Is Open']) === 1) ?? [...state.cases].reverse().find((c) => c['Statement Id'] === sid);
  const event = (c, action, from, to, note) => ({ view: CV, operation: 'insert', fields: [F('Event Id'), F('Case Id'), F('Statement Id'), F('Action'), F('From Status'), F('To Status'), F('Actor'), F('Actor Role'), F('Observed Amount', 'number'), F('Observed Currency'), F('Note'), F('Event At', 'date'), F('Event Date', 'date'), F('Event Count', 'number')],
    values: [[`EV-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`, c['Case Id'], c['Statement Id'], action, from, to, me()['User Name'], me().Role, num(c['Observed Amount']) || 0, c['Observed Currency'], String(note ?? '').slice(0, 1900), iso(), `${iso().slice(0, 10)}T00:00:00Z`, 1]] });
  const update = (c, cols) => ({ view: CC, operation: 'update', fields: cols.map(([n, , t]) => F(n, t)), values: [cols.map(([, v]) => v)], keys: { fields: [F('Case Id')], values: [[c['Case Id']]] } });
  /** Guard (same rule as the layer's Data Actions): role + branch access + write permission. */
  const allowed = (roles, branch) => { const u = me(); if (!u) return 'Pick who you are acting as.'; if (u['Can Write'] !== 'Y') return `${u['User Name']} has read-only access.`; if (!roles.includes(u.Role)) return `Needs the ${roles.join(' or ')} role (you are ${u.Role}).`; if (!scopeOk(u, branch)) return `${u['User Name']} has no write access to branch ${branch} (scope: ${u['Branch Scope']}).`; return ''; };
  const run = async (label, c, writes, local) => {
    local();
    try {
      for (const w of writes) await write(w);
      toast(`✓ ${esc(label)} · saved to ROYALTY_CLOSE_CASES + ROYALTY_CLOSE_EVENTS (demo writeback target)`);
      loadPivot();
  await readCases();
    } catch (err) {
      console.warn('[wf] write failed', err);
      saveLocal(c);
      toast(`${esc(label)} · writeback unavailable here: kept in this browser (labelled demo fallback)`);
    }
    remount(CASE_TILES);
    renderCase(); renderReview(); renderBanner(); renderMine();
  };

  // ------------------------------------------------------------------ statement investigation
  const loadStatement = async (sid) => {
    state.statement = sid;
    if (!sid) { state.facts = null; renderFacts(); renderCase(); return; }
    const [r] = await q({ dims: ['Statement Id', 'Branch', 'Branch Name', 'Payee Name', 'Payee Type', 'Currency', 'Processing Run', 'Accounting Period', 'Reconciliation Status', 'Is Reconciled', 'Exception Category', 'Close Due Date', 'Source System'].map((n) => [n, ST]), measures: ['Gross Earnings', 'Reconciliation Difference', 'Suspense Amount', 'Calc Error Impact', 'Write-offs', 'Closing Balance', 'Source Exposure', 'Statement Amount Rows'], filters: [['Statement Id', ST, [sid]]], limit: 1 });
    state.facts = r ?? null;
    renderFacts(); renderCase();
  };
  const investigate = (sid) => { select('g-st', 'Statement Id', ST, [sid]); show('st'); loadStatement(sid); };
  window.__investigate = investigate;
  selections.onActiveSelectionChange('g-st').subscribe(() => { const v = selectedValues('g-st', 'Statement Id', ST); if (v.length === 1 && v[0] !== state.statement) loadStatement(v[0]); });
  // queue clicks on the overview → callout with "Investigate"
  selections.onActiveSelectionChange('g-ov').subscribe(() => {
    const v = selectedValues('g-ov', 'Statement Id', ST);
    hosts['top-sum'].replaceChildren(...(v.length === 1 ? [el('div', { class: 'ls-callout' }, [el('span', { html: `Selected <b>${esc(v[0])}</b>` }), el('button', { class: 'ls-btn primary', text: 'Investigate statement →', onclick: () => investigate(v[0]) })])] : []));
    hosts['top-ov'].replaceChildren(...(v.length === 1 ? [el('div', { class: 'ls-callout' }, [el('span', { html: `Selected statement <b>${esc(v[0])}</b> from the exception queue.` }), el('button', { class: 'ls-btn primary', text: 'Investigate statement →', onclick: () => investigate(v[0]) })])] : []));
  });
  const renderFacts = () => {
    const f = state.facts;
    if (!f) { hosts.facts.innerHTML = '<p class="ls-empty">Pick a statement: click a row in the Close overview exception queue, or use the Statement filter above.</p>'; return; }
    const rec = f['Is Reconciled'] === 'Y';
    hosts.facts.innerHTML = `<div class="ls-facts">
      <div><span>StatementId (verified key)</span><b>${esc(f['Statement Id'])}</b></div><div><span>Branch</span><b>${esc(f['Branch Name'])}</b></div><div><span>Payee</span><b>${esc(f['Payee Name'])} · ${esc(f['Payee Type'])}</b></div><div><span>Run · period</span><b>${esc(f['Processing Run'])} · ${esc(f['Accounting Period'])}</b></div>
      <div><span>Source reconciliation flag</span><b>${rec ? '<span class="pill green">Reconciled (Y)</span>' : '<span class="pill red">Unreconciled (N)</span>'}</b></div><div><span>Exception</span><b>${esc(f['Exception Category'])}</b></div><div><span>Currency</span><b>${esc(f.Currency)}</b></div><div><span>Close due</span><b>${day(f['Close Due Date'])}</b></div>
      <div><span>Gross earnings</span><b>${fmtAmt(f['Gross Earnings'], f.Currency)}</b></div><div><span>Reconciliation difference</span><b>${fmtAmt(f['Reconciliation Difference'], f.Currency)}</b></div><div><span>Suspense · calc impact</span><b>${fmtAmt(f['Suspense Amount'], '')} · ${fmtAmt(f['Calc Error Impact'], '')}</b></div><div><span>Outstanding source exposure</span><b>${fmtAmt(f['Source Exposure'], f.Currency)}</b></div></div>
      <p class="ls-ro">Read-only source fields from ${esc(f['Source System'])} (royalty_engine_statement_view ⋈ statementamount_view on StatementId; ${num(f['Statement Amount Rows'])} amount rows = one per amount type). This app never writes royalty amounts or reconciliation flags.</p>`;
  };
  const STEPS = ['Assigned', 'Submitted for review', 'Approved / Carry-forward'];
  const renderCase = () => {
    const f = state.facts;
    if (!f) { hosts.case.innerHTML = '<p class="ls-empty">No statement selected.</p>'; return; }
    const c = openCaseFor(f['Statement Id']);
    const st = c?.Status;
    const stepIdx = !c ? -1 : st === 'Submitted for review' ? 1 : /Approved/.test(st) ? 2 : 0;
    const steps = `<div class="ls-step">${['Open', ...STEPS].map((s, i) => `<span class="${i - 1 < stepIdx ? 'done' : i - 1 === stepIdx ? 'on' : ''}">${i + 1}. ${esc(s)}</span>`).join('')}</div>`;
    const guardOpen = allowed(['Royalty Analyst'], f.Branch);
    const analysts = closeUsers.filter((u) => u.Role === 'Royalty Analyst' && scopeOk(u, f.Branch));
    if (!c || (!Number(c['Is Open']) && false)) {
      const defType = /Calc/.test(f['Exception Category']) ? 'Calculation error' : /Unrec/.test(f['Exception Category']) ? 'Unreconciled statement' : /Suspense/.test(f['Exception Category']) ? 'Suspense' : /Write/.test(f['Exception Category']) ? 'Write-off' : 'Other';
      hosts.case.innerHTML = `${steps}<form class="ls-form" data-f="open">
        <label>Exception type<select name="exc">${EXC_TYPES.map((t) => `<option ${t === defType ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label>Owner<select name="owner">${analysts.map((u) => `<option ${u['User Name'] === me()?.['User Name'] ? 'selected' : ''}>${esc(u['User Name'])}</option>`).join('') || '<option>Priya Shah</option>'}</select></label>
        <label>Due date<input type="date" name="due" value="2026-11-14" required></label>
        <label>Observed amount (snapshot)<input readonly value="${esc(fmtAmt(f['Source Exposure'], f.Currency))}"></label>
        <label class="w4">Notes<textarea name="notes" placeholder="What did you see?"></textarea></label>
        <div class="ls-actions w4"><button class="ls-btn primary" ${guardOpen ? 'disabled' : ''}>Open &amp; assign case</button><span class="${guardOpen ? 'ls-why' : 'ls-ok'}">${guardOpen ? esc(guardOpen) : `Writes ROYALTY_CLOSE_CASES keyed on StatementId ${esc(f['Statement Id'])} + an action-history row. Role: Royalty Analyst with ${esc(f.Branch)} access.`}</span></div></form>`;
      hosts.case.querySelector('form').addEventListener('submit', (ev) => {
        ev.preventDefault(); if (guardOpen) return;
        const d = new FormData(ev.target);
        const n = Math.max(2000, ...state.cases.map((x) => Number(String(x['Case Id']).slice(5)) || 0)) + 1;
        const nc = { 'Case Id': `CASE-${n}`, 'Statement Id': f['Statement Id'], 'Exception Type': d.get('exc'), Status: 'Assigned', Owner: d.get('owner'), 'Due Date': d.get('due'), 'Observed Amount': num(f['Source Exposure']), 'Observed Currency': f.Currency, 'Observed Recon Flag': f['Is Reconciled'], Notes: d.get('notes') || '', 'Evidence Refs': '', Disposition: '', Controller: '', 'Controller Rationale': '', 'Carry Forward': 'N', 'Is Overdue': d.get('due') < DEMO_DATE ? 1 : 0, 'Is Open': 1, 'Created By': me()['User Name'], 'Updated By': me()['User Name'], Branch: f.Branch };
        run(`Opened ${nc['Case Id']} on ${f['Statement Id']} → ${nc.Owner}`, nc, [
          { view: CC, operation: 'insert', fields: [F('Case Id'), F('Statement Id'), F('Exception Type'), F('Status'), F('Owner'), F('Due Date', 'date'), F('Observed Amount', 'number'), F('Observed Currency'), F('Observed Recon Flag'), F('Notes'), F('Evidence Refs'), F('Disposition'), F('Controller'), F('Controller Rationale'), F('Carry Forward'), F('Is Overdue', 'number'), F('Is Open', 'number'), F('Created By'), F('Created At', 'date'), F('Updated By'), F('Updated At', 'date'), F('Case Count', 'number')],
            values: [[nc['Case Id'], nc['Statement Id'], nc['Exception Type'], 'Assigned', nc.Owner, `${nc['Due Date']}T00:00:00Z`, nc['Observed Amount'], nc['Observed Currency'], nc['Observed Recon Flag'], nc.Notes, '', '', '', '', 'N', nc['Is Overdue'], 1, nc['Created By'], iso(), nc['Updated By'], iso(), 1]] },
          event(nc, 'Case opened & assigned', '', 'Assigned', `Owner ${nc.Owner}, due ${nc['Due Date']}. ${nc.Notes}`)],
        () => { state.cases.push(nc); });
      });
      return;
    }
    const facts = `<p>${pillOf(st)} <b>${esc(c['Case Id'])}</b> · ${esc(c['Exception Type'])} · owner <b>${esc(c.Owner)}</b> · due <b>${esc(c['Due Date'])}</b>${Number(c['Is Overdue']) ? ' <span class="pill red">Overdue</span>' : ''} · observed <b>${fmtAmt(c['Observed Amount'], c['Observed Currency'])}</b> (recon flag ${esc(c['Observed Recon Flag'])} at opening)</p>`;
    if (st === 'Assigned' || st === 'Returned' || st === 'Open') {
      const guard = allowed(['Royalty Analyst'], f.Branch);
      hosts.case.innerHTML = `${steps}${facts}${st === 'Returned' ? `<p class="ls-why">Returned by ${esc(c.Controller)}: ${esc(c['Controller Rationale'])}</p>` : ''}<form class="ls-form" data-f="submit">
        <label class="w2">Proposed disposition<select name="disp">${DISPOSITIONS.map((t) => `<option ${t === c.Disposition ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        <label class="w2">Evidence references (required)<input name="evidence" value="${esc(c['Evidence Refs'])}" placeholder="e.g. RE-recon-${esc(f['Statement Id'])}.xlsx; JIRA ROY-1182" required></label>
        <label class="w4">Notes<textarea name="notes2">${esc(c.Notes)}</textarea></label>
        <div class="ls-actions w4"><button class="ls-btn primary" ${guard ? 'disabled' : ''}>Submit for controller review</button><span class="${guard ? 'ls-why' : 'ls-ok'}">${guard ? esc(guard) : 'Saves notes, evidence and disposition; status → Submitted for review.'}</span></div></form>`;
      hosts.case.querySelector('form').addEventListener('submit', (ev) => {
        ev.preventDefault(); if (guard) return;
        const d = new FormData(ev.target);
        const ev2 = String(d.get('evidence') || '').trim();
        if (!ev2) { toast('Evidence references are required before submitting.'); return; }
        const next = { Notes: String(d.get('notes2') || ''), 'Evidence Refs': ev2, Disposition: String(d.get('disp')) };
        const cols = [['Status', 'Submitted for review'], ...Object.entries(next).filter(([k, v]) => v !== c[k]), ['Updated By', me()['User Name']], ['Updated At', iso(), 'date']];
        run(`Submitted ${c['Case Id']} for review`, { ...c, ...next, Status: 'Submitted for review' }, [update(c, cols), event(c, 'Submitted for review', st, 'Submitted for review', `${next.Disposition} · evidence: ${ev2}`)],
          () => { Object.assign(c, next, { Status: 'Submitted for review', 'Updated By': me()['User Name'] }); });
      });
      return;
    }
    hosts.case.innerHTML = `${steps}${facts}<p><b>Disposition:</b> ${esc(c.Disposition)} · <b>Evidence:</b> ${esc(c['Evidence Refs'])}</p>${c.Controller ? `<p><b>Controller:</b> ${esc(c.Controller)}${c['Controller Rationale'] ? ` · “${esc(c['Controller Rationale'])}”` : ''}</p>` : ''}${st === 'Carry-forward approved' ? '<p class="ls-why">Carry-forward approved: the source exposure is still outstanding and remains in the overview totals until the next run corrects it.</p>' : ''}
      <div class="ls-actions">${st === 'Submitted for review' ? '<button class="ls-btn primary" data-go="cr">Go to controller review →</button>' : ''}</div>`;
    hosts.case.querySelector('[data-go]')?.addEventListener('click', () => { state.reviewSel = c['Case Id']; renderReview(); show('cr'); });
  };

  // ------------------------------------------------------------------ controller review
  const renderReview = () => {
    const subs = state.cases.filter((c) => c.Status === 'Submitted for review').sort((a, b) => String(a['Due Date']).localeCompare(b['Due Date']));
    if (!subs.length) { hosts.review.innerHTML = '<p class="ls-empty">Nothing is waiting for review.</p>'; return; }
    hosts.review.innerHTML = `<div class="ls-review">${subs.map((c) => {
      const guard = allowed(['Finance Controller'], c.Branch) || (c['Updated By'] === me()?.['User Name'] ? 'Maker–checker: you submitted this case.' : '');
      return `<article class="${state.reviewSel === c['Case Id'] ? 'sel' : ''}" data-id="${esc(c['Case Id'])}"><h4>${esc(c['Case Id'])} · ${esc(c['Statement Id'])} · ${esc(c.Branch ?? '')} ${pillOf(c.Status)} ${Number(c['Is Overdue']) ? '<span class="pill red">Overdue</span>' : ''}</h4>
        <p>${esc(c['Exception Type'])} · owner <b>${esc(c.Owner)}</b> · due ${esc(c['Due Date'])} · observed <b>${fmtAmt(c['Observed Amount'], c['Observed Currency'])}</b> · source recon flag at opening: ${esc(c['Observed Recon Flag'])}</p>
        <p><b>Proposed:</b> ${esc(c.Disposition)} · <b>Evidence:</b> ${esc(c['Evidence Refs'])}</p><p><b>Notes:</b> ${esc(c.Notes)}</p>
        <form class="ls-form"><label class="w4">Controller rationale (required to return or carry forward)<textarea name="why"></textarea></label>
        <div class="ls-actions w4"><button class="ls-btn primary" value="Approved" ${guard ? 'disabled' : ''}>Approve disposition</button><button class="ls-btn danger" value="Returned" ${guard ? 'disabled' : ''}>Return for more work</button><button class="ls-btn warn" value="Carry-forward approved" ${guard ? 'disabled' : ''}>Approve carry-forward</button>
        <button class="ls-btn" type="button" data-inv="${esc(c['Statement Id'])}">Open statement</button><span class="${guard ? 'ls-why' : 'ls-ok'}">${guard ? esc(guard) : `Finance Controller with ${esc(c.Branch)} access.`}</span></div></form></article>`;
    }).join('')}</div>`;
    hosts.review.querySelectorAll('[data-inv]').forEach((b) => { b.onclick = () => investigate(b.dataset.inv); });
    hosts.review.querySelectorAll('form').forEach((form) => form.addEventListener('submit', (ev) => {
      ev.preventDefault();
      const decision = ev.submitter?.value;
      const c = caseRow(form.closest('article').dataset.id);
      if (!decision || !c) return;
      const guard = allowed(['Finance Controller'], c.Branch) || (c['Updated By'] === me()?.['User Name'] ? 'maker–checker' : '');
      if (guard) return;
      const why = String(new FormData(form).get('why') || '').trim();
      if (decision !== 'Approved' && !why) { toast('A rationale is required to return a case or approve a carry-forward.'); return; }
      const isOpen = decision === 'Returned' ? 1 : 0;
      const cols = [['Status', decision], ['Controller', me()['User Name']], ...(why ? [['Controller Rationale', why]] : []), ...(decision === 'Carry-forward approved' ? [['Carry Forward', 'Y']] : []), ...(isOpen !== Number(c['Is Open']) ? [['Is Open', isOpen, 'number']] : []), ...(isOpen === 0 && Number(c['Is Overdue']) ? [['Is Overdue', 0, 'number']] : []), ['Updated By', me()['User Name']], ['Updated At', iso(), 'date']];
      run(`${decision}: ${c['Case Id']}`, { ...c, Status: decision }, [update(c, cols), event(c, `Controller: ${decision}`, c.Status, decision, why || 'Disposition approved')],
        () => { Object.assign(c, { Status: decision, Controller: me()['User Name'], 'Controller Rationale': why, 'Carry Forward': decision === 'Carry-forward approved' ? 'Y' : c['Carry Forward'], 'Is Open': isOpen, 'Updated By': me()['User Name'] }); });
    }));
  };
  roleSel.onchange = () => { try { localStorage.setItem(ROLE_KEY, roleSel.value); } catch { /* */ } renderCase(); renderReview(); renderMine(); toast(`Acting as ${esc(roleSel.value)} · ${esc(me()?.Role)}`); };
  resetBtn.onclick = () => { try { localStorage.removeItem(LOCAL_KEY); } catch { /* */ } location.reload(); };

  // ------------------------------------------------------------------ demo strip (one branch, one currency, two statements)
  const demo = el('div', { class: 'ls-demo', html: `<b>Demo script · UK · GBP</b><ol><li>Priya Shah opens <a href="#" data-s="ST-UK-2610-0007">ST-UK-2610-0007</a> (calc error E204), assigns it and submits evidence</li><li>Hannah Reeve approves the disposition</li><li><a href="#" data-s="ST-UK-2610-0012">ST-UK-2610-0012</a> (suspense) → approved carry-forward; exposure stays outstanding</li></ol><button class="ls-btn" data-uk>Set header to UK · GBP · R-2026-10</button>` });
  demo.querySelectorAll('[data-s]').forEach((a) => { a.onclick = (e) => { e.preventDefault(); investigate(a.dataset.s); }; });
  demo.querySelector('[data-uk]').onclick = () => { hBranch.value = 'UK'; hRun.value = 'R-2026-10'; hCcy.value = 'GBP'; applyHeader(); };
  hosts['top-st'].append(demo);

  // ------------------------------------------------------------------ close simulator (what-if)
  const base = await q({ dims: [['Branch', BR], ['Currency', BR]], measures: ['Statements Current Run', 'Unreconciled Statements Current Run', 'Exception Statements Current Run', 'Source Exposure USD Current Run', 'Suspense USD Current Run', 'Calc Error Impact USD Current Run', 'Open Cases', 'Overdue Cases'], limit: 50 });
  const L = { analysts: 6, perDay: 3, days: 3, suspense: 40, rerun: 60, cf: 20 };
  const LEVERS = [['analysts', 'Analysts on close', 1, 15, 1, ''], ['perDay', 'Cases cleared per analyst per day', 1, 8, 1, ''], ['days', 'Working days to close deadline (14 Nov)', 1, 8, 1, ' d'], ['suspense', 'Suspense released after matching', 0, 100, 5, '%'], ['rerun', 'Calc errors fixed by a re-run', 0, 100, 5, '%'], ['cf', 'Residual approved as carry-forward', 0, 60, 5, '%']];
  const simHost = el('div'), outHost = el('div', { class: 'ls-out' }), barsHost = el('div');
  hosts.sim.replaceChildren(el('div', { class: 'ls-sim' }, LEVERS.map(([k, label, min, max, step, unit]) => {
    const out = el('b', { text: `${L[k]}${unit}` });
    const input = el('input', { type: 'range', min, max, step, value: L[k], name: `lv-${k}` });
    input.addEventListener('input', () => { L[k] = Number(input.value); out.textContent = `${L[k]}${unit}`; recalc(); });
    return el('label', {}, [el('span', { text: label }), out, input]);
  })), el('hr', { style: 'border:0;border-top:1px solid #E1E5E9;margin:14px 0' }), outHost, barsHost, simHost);
  let lastSim = null;
  const recalc = () => {
    const capacity = L.analysts * L.perDay * L.days;
    const tot = base.reduce((a, r) => ({ exc: a.exc + num(r['Exception Statements Current Run']), unrec: a.unrec + num(r['Unreconciled Statements Current Run']), exp: a.exp + num(r['Source Exposure USD Current Run']), sus: a.sus + num(r['Suspense USD Current Run']), ce: a.ce + num(r['Calc Error Impact USD Current Run']) }), { exc: 0, unrec: 0, exp: 0, sus: 0, ce: 0 });
    const cleared = Math.min(tot.exc, capacity);
    const share = tot.exc ? cleared / tot.exc : 0;
    const expRelief = tot.sus * L.suspense / 100 + tot.ce * L.rerun / 100;
    const resid = Math.max(0, tot.exp - expRelief) * (1 - share * 0.6);
    const cfExp = resid * L.cf / 100;
    const residStmts = Math.max(0, tot.exc - cleared);
    const ready = tot.exc ? (tot.exc - residStmts) / tot.exc : 1;
    lastSim = { capacity, cleared, residStmts, resid, cfExp, ready, tot };
    outHost.innerHTML = [['Exception statements today', tot.exc.toLocaleString(), `${tot.unrec} unreconciled`], ['Cleared by deadline', Math.round(cleared).toLocaleString(), `capacity ${capacity}`], ['Residual at close', Math.round(residStmts).toLocaleString(), residStmts ? '<span class="up">will miss close</span>' : '<span class="down">on track</span>'], ['Residual source exposure', usd(resid), `<span class="down">−${usd(tot.exp - resid)} vs today</span>`], ['Close readiness', `${Math.round(ready * 100)}%`, `${usd(cfExp)} carried forward (still exposed)`]].map(([a, b, c]) => `<div><span>${a}</span><b>${b}</b><i>${c}</i></div>`).join('');
    const rows = base.map((r) => ({ b: r.Branch, e: num(r['Exception Statements Current Run']), x: num(r['Source Exposure USD Current Run']) })).sort((a, b) => b.x - a.x);
    const max = Math.max(...rows.map((r) => r.x), 1);
    barsHost.innerHTML = `<svg class="ls-bars" viewBox="0 0 900 ${rows.length * 30 + 30}" role="img" aria-label="Exposure today vs projected by branch">${rows.map((r, i) => { const w = (r.x / max) * 600, w2 = w * (resid / Math.max(tot.exp, 1)); return `<text x="0" y="${i * 30 + 22}" font-size="13" fill="#1F2A33">${esc(r.b)}</text><rect x="60" y="${i * 30 + 8}" width="${w}" height="18" fill="#D5DEE5" rx="3"/><rect x="60" y="${i * 30 + 8}" width="${w2}" height="18" fill="#13706F" rx="3"/><text x="${70 + w}" y="${i * 30 + 22}" font-size="12" fill="#6B7A88">${usd(r.x)} → ${usd(r.x * resid / Math.max(tot.exp, 1))} · ${r.e} exceptions</text>`; }).join('')}<text x="60" y="${rows.length * 30 + 24}" font-size="11" fill="#6B7A88">Grey: source exposure today (governed, USD equivalent) · Teal: projected at the close deadline</text></svg>`;
  };
  recalc();

  // ------------------------------------------------------------------ business questions → native tables
  const bqList = QUESTIONS.filter((x) => !/Paid vs|Recovery/.test(x.cat));
  const bqSlot = el('div', { class: 'ob-viz', style: 'height:520px' });
  let bqCopyTile = null;
  const bqHead = el('div');
  let bqActive = null;
  // The stored-question table refits its column widths when the slot width changes (no remount).
  let bqCurrent = null, bqTimer;
  new ResizeObserver(([entry]) => {
    const width = Math.round(entry.contentRect.width);
    if (!bqCurrent || width < 40 || Math.abs(width - bqCurrent.width) < 8) return;
    clearTimeout(bqTimer);
    bqTimer = setTimeout(() => {
      const t = bqCurrent; t.width = width;
      fit(t, width).then((vSpec) => { if (bqCurrent !== t) return; t.vSpec = vSpec; if (runtime.listInstances().some((x) => x.id === 'bq-run')) runtime.updateInstance('bq-run', { vSpec }); }).catch((e) => console.warn('[fit]', 'bq-run', e));
    }, 250);
  }).observe(bqSlot);
  const runBq = async (i) => {
    const bq = bqList[i];
    bqActive = i;
    hosts.bq.querySelectorAll('li button').forEach((b) => b.classList.toggle('on', Number(b.dataset.i) === i));
    bqHead.innerHTML = `<p><b>${esc(bq.name)}</b><br><span class="ls-ok">${esc(bq.description)} · category ${esc(bq.cat)}</span></p>`;
    bqCopyTile = null;
    const tile = bqTileOf(bq);
    bqCopyTile = { ...tile, measures: tile.measures.filter((m) => m.ref !== 'sp') };
    bqHead.querySelector('p').append(' ', copyButton(bqCopyTile));
    try {
      const b = buildTile(tile, fields);
      if (b.failure) throw new Error(b.failure.reason);
      const { compiled, failures: f2 } = await compileTiles([b.tile], availableFields);
      if (!compiled.length) throw new Error(f2[0]?.reason);
      const th = await themeVSpec({ id: 'bq-run', type: 'table', vSpec: compiled[0].vSpec, dataBinding }, availableFields, { ...b.tile, ...compiled[0] });
      const bqWidth = bqSlot.clientWidth || 1000;
      const bqVSpec = await fit({ ...b.tile, ...compiled[0], vSpec: th.vSpec }, bqWidth);
      bqCurrent = { ...b.tile, ...compiled[0], vSpec: bqVSpec, width: bqWidth };
      if (bqActive !== i) return;
      try { runtime.removeInstance?.('bq-run'); } catch { /* */ }
      bqSlot.replaceChildren();
      appState.declare('bq-run', 'bq');
      runtime.createInstance({ id: 'bq-run', type: 'table', groupId: 'g-bq', vSpec: bqVSpec, dataBinding });
      runtime.mount(bqSlot, 'bq-run').then((h) => h.ready).then((r) => { window.__astrato.mounted['bq-run'] = r?.status; appState.settle('bq-run', r?.status, r); }).catch((e) => appState.settle('bq-run', 'error', e));
    } catch (e) { appState.settle('bq-run', 'error', e); bqSlot.innerHTML = `<p class="ls-why">Could not run: ${esc(e?.message ?? e)}</p>`; }
  };
  let lastCat = '';
  hosts.bq.replaceChildren(el('div', { class: 'ls-bq' }, [el('ul', {}, bqList.flatMap((bq, i) => { const out = []; if (bq.cat !== lastCat) { lastCat = bq.cat; out.push(el('li', {}, el('small', { text: bq.cat }))); } out.push(el('li', {}, el('button', { 'data-i': i, text: bq.name, onclick: () => runBq(i) }))); return out; })), el('div', {}, [bqHead, bqSlot])]));
  runBq(0);

  // ------------------------------------------------------------------ custom pivot: Branch (level 1, with totals) › Exception category › Payee type (no totals)
  // The native table in this viz version has a grand total only, so this pivot is drawn here from governed queries.
  // Leaf rows, branch totals and the grand total are three separate queries, so totals stay right for any measure,
  // additive or not; they follow the overview's applied selections.
  const PV_DIMS = [['Branch', BR, 'Branch'], ['Exception Category', ST, 'Exception category'], ['Payee Type', ST, 'Payee type']];
  const PV_MEAS = [['Exception Statements', 'Statements', 'int'], ['Unreconciled Statements', 'Unreconciled', 'int'], ['Source Exposure USD', 'Source exposure', 'usd'], ['Suspense USD', 'Suspense', 'usd'], ['Calc Error Impact USD', 'Calc impact', 'usd'], ['Write-offs USD', 'Write-offs', 'usd'], ['Exposure Rate', 'Exposure ÷ earnings', 'pct']];
  const pvFmt = (v, f) => (v == null || v === '' || !Number.isFinite(num(v)) ? '–' : f === 'usd' ? usd(v) : f === 'pct' ? `${(num(v) * 100).toFixed(1)}%` : Math.round(num(v)).toLocaleString('en-US'));
  const pvCollapsed = new Set();
  let pvRun = 0, pvData = null;
  const pvTile = { title: 'Exception pivot', group: 'g-ov', dimensions: PV_DIMS.map(([name, view], i) => ({ name, view, ref: `d${i}` })), measures: PV_MEAS.map(([name], i) => ({ name, ref: `m${i}` })), filters: [{ view: ST, field: 'Run Flag', values: ['Current'] }, { view: ST, field: 'Exception Flag', values: [1] }], columnLabels: Object.fromEntries([...PV_DIMS.map(([, , l], i) => [`d${i}`, l]), ...PV_MEAS.map(([, l], i) => [`m${i}`, l])]), sort: [{ by: 'd0', direction: 'asc' }, { by: 'd1', direction: 'asc' }, { by: 'd2', direction: 'asc' }] };
  const loadPivot = async () => {
    const run = ++pvRun;
    const sel = (selections.getSelection('g-ov')?.applied ?? []).filter((x) => x.values?.length && x.field?.fieldKey).map((x) => ({ fieldKey: x.field.fieldKey, values: x.values }));
    const filters = [['Run Flag', ST, ['Current']], ['Exception Flag', ST, ['1']], ...sel];
    const meas = PV_MEAS.map(([m]) => m);
    try {
      const [leaf, l1, [grand = {}]] = await Promise.all([
        q({ dims: PV_DIMS.map(([n, v]) => [n, v]), measures: meas, filters, limit: 5000 }),
        q({ dims: [[PV_DIMS[0][0], PV_DIMS[0][1]]], measures: meas, filters, limit: 500 }),
        q({ measures: meas, filters, limit: 1 }),
      ]);
      if (run !== pvRun) return;
      pvData = { leaf, l1, grand };
      renderPivot();
    } catch (e) { console.warn('[pivot]', e); hosts.pivot.innerHTML = `<p class="ls-why">${esc(e?.message ?? e)}</p>`; }
  };
  const renderPivot = () => {
    if (!pvData) return;
    const { leaf, l1, grand } = pvData;
    const cells = (r, cls = '') => PV_MEAS.map(([m, , f]) => `<td class="n ${cls}">${pvFmt(r[m], f)}</td>`).join('');
    const branches = l1.map((r) => r.Branch).sort();
    const body = branches.map((b) => {
      const tot = l1.find((r) => r.Branch === b) ?? {};
      const kids = leaf.filter((r) => r.Branch === b).sort((x, y) => String(x['Exception Category']).localeCompare(y['Exception Category']) || String(x['Payee Type']).localeCompare(y['Payee Type']));
      const open = !pvCollapsed.has(b);
      let lastCat = null;
      const rows = open ? kids.map((r) => { const showCat = r['Exception Category'] !== lastCat; lastCat = r['Exception Category']; return `<tr class="pv-leaf"><td></td><td>${showCat ? esc(r['Exception Category']) : ''}</td><td>${esc(r['Payee Type'])}</td>${cells(r)}</tr>`; }).join('') : '';
      return `<tr class="pv-l1" data-b="${esc(b)}"><td colspan="3"><button class="pv-tg" aria-expanded="${open}">${open ? '▾' : '▸'}</button> <b>${esc(b)}</b> <span class="pv-sub">${esc(('Total'))} · ${kids.length} ${esc(('rows'))}</span></td>${cells(tot, 'b')}</tr>${rows}`;
    }).join('');
    hosts.pivot.innerHTML = `<div class="pv-bar"><button class="ls-copy" data-pv="all">${esc(('Expand all'))}</button><button class="ls-copy" data-pv="none">${esc(('Collapse all'))}</button><span class="sp"></span></div>
      <div class="pv-wrap"><table class="pv"><thead><tr>${PV_DIMS.map(([, , l]) => `<th>${esc((l))}</th>`).join('')}${PV_MEAS.map(([, l]) => `<th class="n">${esc((l))}</th>`).join('')}</tr></thead>
      <tbody>${body || `<tr><td colspan="${PV_DIMS.length + PV_MEAS.length}" class="ls-empty">${esc(('No exceptions for the current selection.'))}</td></tr>`}</tbody>
      <tfoot><tr class="pv-grand"><td colspan="3"><b>${esc(('Grand total'))}</b></td>${cells(grand, 'b')}</tr></tfoot></table></div>`;
    hosts.pivot.querySelector('.sp').replaceWith(copyButton({ ...pvTile, filters: pvTile.filters }));
    hosts.pivot.querySelectorAll('.pv-l1').forEach((tr) => { tr.querySelector('.pv-tg').onclick = () => { const b = tr.dataset.b; pvCollapsed.has(b) ? pvCollapsed.delete(b) : pvCollapsed.add(b); renderPivot(); }; });
    hosts.pivot.querySelector('[data-pv=all]').onclick = () => { pvCollapsed.clear(); renderPivot(); };
    hosts.pivot.querySelector('[data-pv=none]').onclick = () => { for (const r of pvData.l1) pvCollapsed.add(r.Branch); renderPivot(); };
  };
  { let sig = ''; selections.onActiveSelectionChange('g-ov').subscribe((next) => { const s = JSON.stringify((next.applied ?? []).map((x) => [x.field?.fieldKey, x.values])); if (s !== sig) { sig = s; loadPivot(); } }); }
  window.__pivot = () => pvData;

  // ------------------------------------------------------------------ Summary: "Needs you" for the acting user
  const renderMine = () => {
    const u = me();
    if (!u || !hosts.mine) return;
    const name = u['User Name'];
    const inScope = (c) => scopeOk(u, c.Branch);
    const open = state.cases.filter((c) => Number(c['Is Open']) === 1);
    let items, lead;
    if (u.Role === 'Royalty Analyst') {
      items = open.filter((c) => c.Owner === name && /Assigned|Returned|Open/.test(c.Status));
      lead = 'Your open cases, earliest due first';
    } else if (u.Role === 'Finance Controller') {
      items = state.cases.filter((c) => c.Status === 'Submitted for review' && inScope(c) && c['Updated By'] !== name);
      lead = 'Waiting for your review';
    } else {
      items = open.filter((c) => Number(c['Is Overdue']) === 1);
      lead = 'Overdue cases';
    }
    items = items.sort((a, b) => String(a['Due Date']).localeCompare(b['Due Date'])).slice(0, 6);
    const overdue = items.filter((c) => Number(c['Is Overdue']) === 1).length;
    hosts.mine.innerHTML = `<p class="ls-ok">${esc(lead)} · <b>${esc(name)}</b> (${esc(u.Role)})${overdue ? ` · <span class="pill red">${overdue} overdue</span>` : ''}</p>` +
      (items.length ? `<ul class="ls-mine">${items.map((c) => `<li><button data-s="${esc(c['Statement Id'])}" data-review="${c.Status === 'Submitted for review' ? 1 : 0}"><span><b>${esc(c['Statement Id'])}</b> ${pillOf(c.Status)}</span><span>${esc(c['Exception Type'])} · ${esc(c.Owner)} · due ${esc(c['Due Date'])}</span><span class="amt">${fmtAmt(c['Observed Amount'], c['Observed Currency'])}</span></button></li>`).join('')}</ul>`
        : '<p class="ls-empty">Nothing waiting for you.</p>');
    hosts.mine.querySelectorAll('[data-s]').forEach((b) => { b.onclick = () => (b.dataset.review === '1' ? (state.reviewSel = state.cases.find((c) => c['Statement Id'] === b.dataset.s)?.['Case Id'], renderReview(), show('cr')) : investigate(b.dataset.s)); });
  };

  // ------------------------------------------------------------------ initial loads
  await readCases();
  renderBanner(); renderFacts(); renderCase(); renderReview(); renderMine();

  // ------------------------------------------------------------------ Excel close pack
  exportBtn.addEventListener('click', async () => {
    exportBtn.disabled = true; exportBtn.textContent = 'Building…';
    try {
      const when = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
      const bannerRows = (title, cols) => [[{ v: 'larkspur', s: 'brand' }, { v: title, s: 'title' }, ...Array(Math.max(0, cols - 2)).fill({ v: '', s: 'title' })], [null, { v: `Royalty Close & Exception Review · generated ${when} · DEMO DATA`, s: 'subtitle' }], []];
      const head = (labels) => labels.map((v, i) => ({ v, s: i ? 'head' : 'headl' }));
      const [[k]] = [await q({ measures: ['Statements Current Run', 'Statements Prior Run', 'Exception Statements Current Run', 'Exception Statements Prior Run', 'Unreconciled Statements Current Run', 'Unreconciled Statements Prior Run', 'Source Exposure USD Current Run', 'Source Exposure USD Prior Run', 'Suspense USD Current Run', 'Suspense USD Prior Run', 'Calc Error Impact USD Current Run', 'Calc Error Impact USD Prior Run', 'Write-offs USD Current Run', 'Write-offs USD Prior Run'], limit: 1 })];
      const kr = [['Statements', 'Statements', 'int'], ['Exception statements', 'Exception Statements', 'int'], ['Unreconciled statements', 'Unreconciled Statements', 'int'], ['Source exposure (USD)', 'Source Exposure USD', 'usd0'], ['Suspense (USD)', 'Suspense USD', 'usd0'], ['Calc error impact (USD)', 'Calc Error Impact USD', 'usd0'], ['Write-offs (USD)', 'Write-offs USD', 'usd0']];
      const summary = { name: 'Summary', cols: [4, 34, 18, 18, 14], freeze: { row: 4, col: 0 }, merges: [], rows: [...bannerRows('Close summary · current vs prior run', 5), head(['', 'Measure', 'R-2026-10 (current)', 'R-2026-09 (prior)', 'Change']),
        ...kr.map(([l, m, f]) => [null, { v: l, s: 'bold' }, { v: num(k[`${m} Current Run`]), s: f }, { v: num(k[`${m} Prior Run`]), s: f }, { v: num(k[`${m} Current Run`]) / num(k[`${m} Prior Run`]) - 1, s: 'spct' }])] };
      const sc = { name: 'Branches', cols: [8, 8, 12, 12, 14, 16, 12, 12], freeze: { row: 4, col: 1 }, merges: [], rows: [...bannerRows('Branch scorecard · current run', 8), head(['Branch', 'Ccy', 'Statements', 'Exceptions', 'Unreconciled', 'Exposure USD', 'Open cases', 'Overdue']),
        ...base.sort((a, b) => num(b['Source Exposure USD Current Run']) - num(a['Source Exposure USD Current Run'])).map((r) => [{ v: r.Branch, s: 'bold' }, { v: r.Currency, s: 'text' }, { v: num(r['Statements Current Run']), s: 'int' }, { v: num(r['Exception Statements Current Run']), s: 'int' }, { v: num(r['Unreconciled Statements Current Run']), s: 'int' }, { v: num(r['Source Exposure USD Current Run']), s: 'usd0' }, { v: num(r['Open Cases']), s: 'int' }, { v: num(r['Overdue Cases']), s: 'int' }])] };
      const queue = await q({ dims: ['Statement Id', 'Branch', 'Payee Name', 'Currency', 'Exception Category', 'Reconciliation Status'].map((n) => [n, ST]), measures: ['Source Exposure', 'Reconciliation Difference', 'Suspense Amount', 'Calc Error Impact', 'Write-offs'], filters: [['Run Flag', ST, ['Current']], ['Exception Flag', ST, ['1']]], limit: 1000 });
      const qs = { name: 'Exception queue', cols: [18, 7, 26, 7, 22, 16, 14, 14, 14, 14, 14], freeze: { row: 4, col: 1 }, merges: [], rows: [...bannerRows('Exception queue · current run (local currency, source flag read-only)', 11), head(['Statement', 'Br.', 'Payee', 'Ccy', 'Exception', 'Source recon flag', 'Exposure', 'Recon diff', 'Suspense', 'Calc impact', 'Write-offs']),
        ...queue.sort((a, b) => num(b['Source Exposure']) - num(a['Source Exposure'])).map((r) => [{ v: r['Statement Id'], s: 'bold' }, { v: r.Branch, s: 'text' }, { v: r['Payee Name'], s: 'text' }, { v: r.Currency, s: 'text' }, { v: r['Exception Category'], s: 'text' }, { v: r['Reconciliation Status'], s: 'text' }, ...['Source Exposure', 'Reconciliation Difference', 'Suspense Amount', 'Calc Error Impact', 'Write-offs'].map((m) => ({ v: num(r[m]), s: 'amt' }))])] };
      const cases = { name: 'Cases', cols: [12, 18, 6, 22, 16, 24, 12, 14, 6, 40, 40, 36, 18, 40], freeze: { row: 4, col: 1 }, merges: [], rows: [...bannerRows('Close cases & dispositions', 14), head(['Case', 'Statement', 'Br.', 'Exception', 'Owner', 'Status', 'Due', 'Observed', 'Ccy', 'Disposition', 'Evidence', 'Notes', 'Controller', 'Rationale']),
        ...state.cases.map((c) => [{ v: c['Case Id'], s: 'bold' }, { v: c['Statement Id'], s: 'text' }, { v: c.Branch ?? '', s: 'text' }, { v: c['Exception Type'], s: 'text' }, { v: c.Owner, s: 'text' }, { v: c.Status, s: 'text' }, { v: c['Due Date'], s: 'text' }, { v: num(c['Observed Amount']), s: 'amt' }, { v: c['Observed Currency'], s: 'text' }, { v: c.Disposition, s: 'text' }, { v: c['Evidence Refs'], s: 'text' }, { v: c.Notes, s: 'text' }, { v: c.Controller, s: 'text' }, { v: c['Controller Rationale'], s: 'text' }])] };
      const hist = await q({ dims: ['Event At', 'Case Id', 'Statement Id', 'Action', 'Actor', 'Actor Role', 'Observed Amount', 'Observed Currency', 'Note'].map((n) => [n, CV]), limit: 3000 });
      const audit = { name: 'Action history', cols: [20, 12, 18, 30, 18, 20, 14, 6, 50], freeze: { row: 4, col: 0 }, merges: [], rows: [...bannerRows('Action history (audit trail)', 9), head(['When', 'Case', 'Statement', 'Action', 'Actor', 'Role', 'Observed', 'Ccy', 'Note']),
        ...hist.map((h) => ({ ...h, at: stamp(h['Event At']) })).sort((a, b) => String(b.at).localeCompare(a.at)).map((h) => [{ v: h.at, s: 'text' }, { v: h['Case Id'], s: 'bold' }, { v: h['Statement Id'], s: 'text' }, { v: h.Action, s: 'text' }, { v: h.Actor, s: 'text' }, { v: h['Actor Role'], s: 'text' }, { v: num(h['Observed Amount']), s: 'amt' }, { v: h['Observed Currency'], s: 'text' }, { v: blank(h.Note), s: 'text' }])] };
      const s = lastSim;
      const sim = { name: 'What-if', cols: [44, 18], merges: [], rows: [...bannerRows('Close readiness what-if', 2), head(['Lever', 'Setting']), ...LEVERS.map(([kk, label, , , , unit]) => [{ v: label, s: 'text' }, { v: `${L[kk]}${unit}`, s: 'text' }]), [], head(['Result', 'Value']),
        [{ v: 'Exception statements today', s: 'bold' }, { v: s.tot.exc, s: 'int' }], [{ v: 'Cleared by deadline', s: 'bold' }, { v: Math.round(s.cleared), s: 'int' }], [{ v: 'Residual at close', s: 'bold' }, { v: Math.round(s.residStmts), s: 'int' }], [{ v: 'Source exposure today (USD)', s: 'bold' }, { v: s.tot.exp, s: 'usd0' }], [{ v: 'Residual exposure at close (USD)', s: 'bold' }, { v: s.resid, s: 'usd0' }], [{ v: 'Carried forward, still exposed (USD)', s: 'bold' }, { v: s.cfExp, s: 'usd0' }], [{ v: 'Close readiness', s: 'bold' }, { v: s.ready, s: 'pct' }]] };
      const blob = workbookBlob({ sheets: [summary, sc, qs, cases, audit, sim], title: 'Larkspur Music – Royalty Close pack (demo data)', author: 'Astrato' });
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: `Larkspur Music_Royalty_Close_${new Date().toISOString().slice(0, 10)}.xlsx` });
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000);
      window.__lastExportBytes = blob.size;
    } catch (e) { console.error(e); toast(`Export failed: ${esc(e?.message ?? e)}`); }
    finally { exportBtn.disabled = false; exportBtn.textContent = '⬇ Excel close pack'; }
  });

  // ------------------------------------------------------------------ smoke-test checks (read-only: selections, navigation, export; never a write)
  const textOf = (id) => (document.querySelector(`[data-slot="${id}"]`)?.innerText ?? '').replace(/\s+/g, ' ').trim();
  const sentWith = (q0, fieldKey, value) => queryLog().slice(q0).filter((e) => !e.prefetch && e.key.includes(JSON.stringify(fieldKey).slice(1, -1)) && e.key.includes(JSON.stringify(String(value)))).length;
  const setHeader = (b = '', r = '', c = '') => { hBranch.value = b; hRun.value = r; hCcy.value = c; applyHeader(); };
  const selectionCheck = (tab, { kpi, table, chart, pick, label }) => async () => {
    show(tab);
    await appState.quiet({ quietMs: 2500 });
    const read = () => ({ kpi: textOf(kpi), cmp: textOf(`${kpi}-d`), table: textOf(table) });
    const before = read();
    const q0 = queryLog().length;
    pick();
    await appState.quiet({ quietMs: 2500 });
    const during = read();
    const chartKey = chart ? tiles.get(chart)?.fieldKeys?.[0] : null;
    const chartRequeried = chart ? queryLog().slice(q0).some((e) => !e.prefetch && e.key.includes(JSON.stringify(chartKey).slice(1, -1)) && /UK|GBP/.test(e.key)) : true;
    setHeader();
    selections.clearAllSelections(PAGE_GROUP[tab]);
    await appState.quiet({ quietMs: 2500 });
    const after = read();
    const cmpMoved = !before.cmp || (during.cmp !== before.cmp && after.cmp === before.cmp);
    const pass = Boolean(before.kpi) && during.kpi !== before.kpi && during.table !== before.table && chartRequeried && cmpMoved && after.kpi === before.kpi && after.table === before.table;
    return { pass, detail: `${label}: KPI "${before.kpi.slice(0, 60)}" → "${during.kpi.slice(0, 60)}" → "${after.kpi.slice(0, 60)}"; comparison "${before.cmp}" → "${during.cmp}" (${cmpMoved ? 'moved and restored' : 'DID NOT MOVE/RESTORE'}); table ${during.table !== before.table ? 'changed' : 'UNCHANGED'} and ${after.table === before.table ? 'restored' : 'NOT restored'}; ${chart ? `chart ${chart} re-queried with the selection: ${chartRequeried}` : 'no chart on this tab'}` };
  };
  appState.check('Close overview: header Branch = UK moves a KPI, the exception chart and the scorecard; clearing restores them',
    selectionCheck('ov', { kpi: 'k-exc', table: 'o-branch', chart: 'o-cat', pick: () => setHeader('UK'), label: 'Branch UK' }));
  appState.check('Summary: header Currency = GBP moves a KPI, the branch chart and the top-5 table; clearing restores them',
    selectionCheck('sum', { kpi: 's-k-exp', table: 's-top', chart: 's-br', pick: () => setHeader('', '', 'GBP'), label: 'Currency GBP' }));
  appState.check('Controller review: header Branch = UK moves a KPI, the status chart and the case register; clearing restores them',
    selectionCheck('cr', { kpi: 'k-rev', table: 'c-cases', chart: 'c-status', pick: () => setHeader('UK'), label: 'Branch UK' }));
  appState.check('Statement investigation: investigating ST-UK-2610-0007 moves the statement KPIs and amount table; Clear all restores them',
    selectionCheck('st', { kpi: 's-gross', table: 's-amts', chart: null, pick: () => investigate('ST-UK-2610-0007'), label: 'Statement ST-UK-2610-0007' }));
  appState.check('Business questions: header Branch = UK narrows the stored-question table; clearing restores it', async () => {
    show('bq');
    await appState.quiet({ quietMs: 2500 });
    const read = () => (bqSlot.innerText ?? '').replace(/\s+/g, ' ').trim();
    const b0 = read();
    const q0 = queryLog().length;
    setHeader('UK');
    await appState.quiet({ quietMs: 2500 });
    const during = read();
    const sent = sentWith(q0, fields.raw('Branch', BR)?.fieldKey ?? '', 'UK');
    setHeader();
    await appState.quiet({ quietMs: 2500 });
    const after = read();
    return { pass: Boolean(b0) && during !== b0 && after === b0, detail: `table ${during !== b0 ? 'changed' : 'UNCHANGED'} → ${after === b0 ? 'restored' : 'NOT restored'}; ${sent} queries carried Branch UK` };
  });
  appState.check('Excel close pack downloads (read-only queries)', async () => {
    show('ov');
    const bytes0 = window.__lastExportBytes;
    exportBtn.click();
    for (let i = 0; i < 120 && (exportBtn.disabled || window.__lastExportBytes === bytes0); i++) await new Promise((r) => setTimeout(r, 250));
    return { pass: Boolean(window.__lastExportBytes) && window.__lastExportBytes !== bytes0, detail: `${window.__lastExportBytes ?? 0} bytes` };
  });
  appState.mark('landing-ready');
  window.__state = state;
  window.__ready = true;
};

main().catch((error) => { console.error(error); appState.bootFailed(error); document.getElementById('splash')?.remove(); document.getElementById('root').textContent = `Could not start: ${error?.message ?? error}`; });
