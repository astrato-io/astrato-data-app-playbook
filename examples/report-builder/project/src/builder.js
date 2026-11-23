/**
 * The report builder UI, lifted from the people-intelligence custom report and cut to the core:
 * a field panel (rows and figures from the run-time catalogue), a chip bar to order them, view,
 * period, comparison, sort and row-limit controls, a filter bar, and the native object. Reports
 * save to localStorage, share as a link (#r=…), and export to a formatted .xlsx.
 *
 * Filters and the period are applied selections in one group, so the native object follows them
 * by itself and a chart click becomes a filter chip. app.js supplies ctx:
 *   { el, cat, q, toast, renderTile(spec, slot) → id, dropTile(id), getData(id), selections, group, layerKey }
 */
import { COMPARES, GRAINS, STARTERS, VIEWS, comparison, fromStarter, needs, reportSpec } from './report.js';
import { excelFormat } from './catalogue.js';
import { workbookBlob } from './xlsx.js';

const DAY = 86_400_000;
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const utc = (y, m, d) => Date.UTC(y, m, d);
const PERIODS = {
  all: ['All time', () => null],
  l12m: ['Last 12 months', ([y, m]) => utc(y, m - 11, 1)],
  ytd: ['Year to date', ([y]) => utc(y, 0, 1)],
  ly: ['Last full year', ([y]) => [utc(y - 1, 0, 1), utc(y, 0, 0)]],
  l3m: ['Last 3 months', ([y, m]) => utc(y, m - 2, 1)],
};
const dateLabel = (t, grain) => {
  const d = new Date(t);
  if (grain === 'year') return String(d.getUTCFullYear());
  if (grain === 'quarter') return `${d.getUTCFullYear()} Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
  if (grain === 'month') return `${'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  return iso(t);
};

export const mountBuilder = async (ctx, root) => {
  const { el, cat, selections, group } = ctx;
  const STORE = `report-builder.v1:${ctx.layerKey}`;
  const keyOf = (s) => s?.field?.fieldKey ?? s?.fieldKey;
  const dates = cat.rows.filter((r) => r.date);
  const st = { name: 'Untitled report', view: 'table', rows: [], figures: [], compare: 'none', sort: null, top: 100, period: { field: dates[0]?.key, preset: 'all' } };
  const sharedHash = location.hash; // read before anything rewrites the address

  // The period counts back from the last date in the data, not from today.
  const ranges = new Map();
  const rangeOf = async (key) => {
    if (!ranges.has(key)) {
      const [[max, min]] = await ctx.q({ calculations: ['MAX', 'MIN'].map((aggregation) => ({ calculation: '{m1}', measures: [{ aggregation, fieldKeys: [key], filters: [] }], label: aggregation })), limit: 1 });
      ranges.set(key, { max, min });
    }
    return ranges.get(key);
  };
  const periodRange = async () => {
    if (!st.period.field || st.period.preset === 'all') return null;
    const { max } = await rangeOf(st.period.field);
    const d = new Date(max);
    const start = PERIODS[st.period.preset][1]([d.getUTCFullYear(), d.getUTCMonth()]);
    return Array.isArray(start) ? start : [start, max];
  };

  // ------------------------------------------------------------------ selections (filters + period)
  const setSelection = (key, values, operator = 'inList') => {
    const { applied: a, pending } = selections.getSelection(group);
    for (const s of [...a, ...pending]) if (keyOf(s) === key) selections.removeSelection(group, s);
    if (values?.length) selections.selectValues(group, { field: { fieldKey: key }, fieldKey: key, kind: 'VALUE', operator, values }, { state: 'applied' });
  };
  // Chained, so the export can wait for the period on screen to be the one applied.
  let periodDone = Promise.resolve();
  const applyPeriod = () => (periodDone = periodDone.then(async () => {
    for (const d of dates) if (d.key !== st.period.field) setSelection(d.key, null);
    const r = await periodRange();
    setSelection(st.period.field, r ? [iso(r[0]), iso(r[1])] : null, 'between');
    periodNote.textContent = r ? `${iso(r[0])} – ${iso(r[1])}` : '';
  }).catch((e) => console.error('[period]', e)));
  const filters = () => Object.fromEntries(selections.getSelection(group).applied.filter((s) => s.operator !== 'between').map((s) => [keyOf(s), s.values]));
  const clearFilters = () => { for (const [key] of Object.entries(filters())) setSelection(key, null); };

  // ------------------------------------------------------------------ shell
  const nameIn = el('input', { class: 'rb-name', 'aria-label': 'Report name', oninput: () => { st.name = nameIn.value; remember(); } });
  const savedBtn = el('button', { class: 'btn', 'data-pop': '1', text: 'Saved reports ▾', onclick: (e) => openSaved(e.currentTarget) });
  const saveBtn = el('button', { class: 'btn', text: 'Save', onclick: () => save() });
  const shareBtn = el('button', { class: 'btn', text: 'Share link', onclick: () => share() });
  const exportBtn = el('button', { class: 'btn btn--primary', text: 'Export .xlsx', onclick: () => exportXlsx() });
  const newBtn = el('button', { class: 'btn btn--ghost', text: 'New', onclick: () => load({ name: 'Untitled report', view: 'table', rows: [], figures: [], compare: 'none', sort: null, top: 100, period: { preset: 'all' }, filters: {} }) });
  const search = el('input', { class: 'rb-search', type: 'search', placeholder: 'Search fields', 'aria-label': 'Search fields', oninput: () => renderPanel() });
  const panelBody = el('div', { class: 'rb-panel-body' });
  const chipBar = el('div', { class: 'rb-chips', 'aria-label': 'Rows and figures in the report' });
  const viewSeg = el('div', { class: 'seg', role: 'group', 'aria-label': 'View' });
  const periodField = el('select', { 'aria-label': 'Period date field', onchange: () => { st.period.field = periodField.value; applyPeriod(); } }, dates.map((d) => el('option', { value: d.key, text: d.name })));
  const periodSel = el('select', { 'aria-label': 'Period', onchange: () => { st.period.preset = periodSel.value; applyPeriod(); remember(); } }, Object.entries(PERIODS).map(([k, [l]]) => el('option', { value: k, text: l })));
  const periodNote = el('span', { class: 'muted' });
  const compareSel = el('select', { 'aria-label': 'Compare with', onchange: () => { st.compare = compareSel.value; changed(); } }, Object.entries(COMPARES).map(([k, l]) => el('option', { value: k, text: l })));
  const sortSel = el('select', { 'aria-label': 'Sort by', onchange: () => { const [by, dir] = sortSel.value.split(':'); st.sort = by ? { by, dir } : null; changed(); } });
  const topSel = el('select', { 'aria-label': 'Row limit', onchange: () => { st.top = Number(topSel.value); changed(); } }, [25, 100, 500, 1000].map((n) => el('option', { value: n, text: `${n} rows` })));
  const filterChips = el('ul', { class: 'rb-filter-chips' });
  const addFilterBtn = el('button', { class: 'btn btn--ghost', 'data-pop': '1', text: '+ Add filter', onclick: (e) => openFilter(e.currentTarget) });
  const clearAllBtn = el('button', { class: 'link', text: 'Clear all', onclick: clearFilters });
  const note = el('p', { class: 'rb-note', role: 'status' });
  const view = el('div', { class: 'rb-view' });
  const pop = el('div', { class: 'rb-pop', hidden: true });

  root.replaceChildren(el('div', { class: 'rb' }, [
    el('header', { class: 'rb-top' }, [el('h1', { text: 'Report builder' }), nameIn, el('span', { class: 'sp' }), newBtn, savedBtn, saveBtn, shareBtn, exportBtn]),
    el('div', { class: 'rb-body' }, [
      el('aside', { class: 'rb-panel', 'aria-label': 'Fields' }, [search, panelBody]),
      el('main', { class: 'rb-work' }, [
        chipBar,
        el('div', { class: 'rb-controls' }, [viewSeg, el('label', {}, ['Period ', ...(dates.length > 1 ? [periodField] : []), periodSel]), periodNote, el('label', {}, ['Compare ', compareSel]), el('label', {}, ['Sort ', sortSel]), topSel]),
        el('div', { class: 'rb-filters', 'aria-label': 'Filters' }, [el('span', { class: 'rb-label', text: 'Filters' }), filterChips, addFilterBtn, clearAllBtn]),
        note,
        view,
      ]),
    ]),
    pop,
  ]));
  if (!dates.length) periodSel.disabled = true;

  const closePop = () => { pop.hidden = true; pop.replaceChildren(); };
  document.addEventListener('mousedown', (e) => { if (!pop.hidden && !pop.contains(e.target) && !e.target.closest('[data-pop]')) closePop(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePop(); });
  const openPop = (anchor, children) => {
    pop.replaceChildren(...children);
    const a = anchor.getBoundingClientRect();
    pop.style.left = `${Math.max(8, Math.min(a.left, innerWidth - 336))}px`;
    pop.style.top = `${a.bottom + 6}px`;
    pop.hidden = false;
  };

  // ------------------------------------------------------------------ field panel
  const has = (kind, key) => (kind === 'row' ? st.rows.some((r) => r.key === key) : st.figures.includes(key));
  const toggle = (kind, key) => {
    if (kind === 'row') st.rows = has('row', key) ? st.rows.filter((r) => r.key !== key) : [...st.rows, { key, ...(cat.get(key).date ? { grain: 'month' } : {}) }];
    else st.figures = has('fig', key) ? st.figures.filter((k) => k !== key) : [...st.figures, key];
    changed();
  };
  const item = (kind, f) => el('button', { class: `rb-item ${has(kind, f.key) ? 'on' : ''}`, 'data-key': f.key, title: f.desc || f.name, 'aria-pressed': String(has(kind, f.key)), onclick: () => toggle(kind, f.key) }, [
    el('i', { class: `t t--${kind}`, text: kind === 'row' ? (f.date ? 'date' : 'abc') : '123' }), el('span', { text: f.name })]);
  const renderPanel = () => {
    const s = search.value.trim().toLowerCase();
    const match = (f) => !s || f.name.toLowerCase().includes(s);
    panelBody.replaceChildren(
      el('h2', { text: `Rows (${st.rows.length})` }), ...cat.rows.filter(match).map((f) => item('row', f)),
      el('h2', { text: `Figures (${st.figures.length})` }), ...cat.figures.filter(match).map((f) => item('fig', f)));
  };

  // ------------------------------------------------------------------ chip bar + controls
  const move = (list, i, by) => { const j = i + by; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; changed(); };
  const chip = (kind, label, i, list, extra) => el('span', { class: `chip chip--${kind}` }, [
    el('button', { class: 'chip-mv', 'aria-label': `Move ${label} left`, text: '‹', disabled: i === 0, onclick: () => move(list, i, -1) }),
    el('span', { class: 'chip-n', text: label }), extra ?? '',
    el('button', { class: 'chip-mv', 'aria-label': `Move ${label} right`, text: '›', disabled: i === list.length - 1, onclick: () => move(list, i, 1) }),
    el('button', { class: 'chip-x', 'aria-label': `Remove ${label}`, text: '×', onclick: () => toggle(kind === 'row' ? 'row' : 'fig', kind === 'row' ? list[i].key : list[i]) })]);
  const renderBar = () => {
    const grainSel = (r) => {
      const s = el('select', { 'aria-label': `${cat.get(r.key).name} grain`, onchange: () => { r.grain = s.value; changed(); } }, Object.entries(GRAINS).map(([k, [l]]) => el('option', { value: k, text: l })));
      s.value = r.grain ?? 'month';
      return s;
    };
    chipBar.replaceChildren(...[
      el('span', { class: 'rb-label', text: 'Rows' }), ...st.rows.map((r, i) => chip('row', cat.get(r.key).name, i, st.rows, cat.get(r.key).date ? grainSel(r) : null)),
      st.rows.length ? null : el('span', { class: 'muted', text: 'none' }),
      el('span', { class: 'rb-label', text: 'Figures' }), ...st.figures.map((k, i) => chip('fig', cat.get(k).name, i, st.figures)),
      st.figures.length ? null : el('span', { class: 'muted', text: 'none' })].filter(Boolean));
    viewSeg.replaceChildren(...VIEWS.map(([k, l]) => el('button', { 'data-view': k, 'aria-pressed': String(st.view === k), text: l, onclick: () => { st.view = k; changed(); } })));
    nameIn.value = st.name;
    periodSel.value = st.period.preset;
    if (st.period.field) periodField.value = st.period.field;
    compareSel.value = st.compare;
    topSel.value = String(st.top);
    const spec = reportSpec(st, cat);
    const cols = [...spec.dims, ...spec.figs].map((c) => [c.ref, c.label]);
    sortSel.replaceChildren(el('option', { value: '', text: 'Automatic' }), ...cols.flatMap(([ref, l]) => [el('option', { value: `${ref}:desc`, text: `${l} ↓` }), el('option', { value: `${ref}:asc`, text: `${l} ↑` })]));
    sortSel.value = st.sort ? `${st.sort.by}:${st.sort.dir}` : '';
    sortSel.disabled = comparison(st, cat).ok;
  };

  // ------------------------------------------------------------------ filter bar + value picker
  const renderFilters = () => {
    const f = Object.entries(filters());
    filterChips.replaceChildren(...(f.length ? f.map(([key, values]) => el('li', { class: 'fchip', title: `${cat.get(key)?.name}: ${values.join(', ')}` }, [
      el('b', { text: cat.get(key)?.name ?? key }), el('span', { text: values.length > 2 ? `${values.slice(0, 2).join(', ')} +${values.length - 2}` : values.join(', ') }),
      el('button', { 'aria-label': `Remove the ${cat.get(key)?.name} filter`, text: '×', onclick: () => setSelection(key, null) })]))
      : [el('li', { class: 'muted', text: 'None. Add one, or click a bar or a cell.' })]));
    clearAllBtn.hidden = !f.length;
  };
  const valuesOf = async (key) => (await ctx.q({ dimensions: [{ fieldKey: key, name: 'v' }], orders: [{ columnIdx: 0, direction: 'asc' }], limit: 500 })).map((r) => r[0]).filter((v) => v != null && v !== '').map(String);
  const openFilter = async (anchor, key = st.rows.find((r) => !cat.get(r.key).date)?.key ?? cat.rows.find((r) => !r.date)?.key) => {
    const fieldSel = el('select', { 'aria-label': 'Filter field', onchange: () => openFilter(anchor, fieldSel.value) }, cat.rows.filter((r) => !r.date).map((r) => el('option', { value: r.key, text: r.name })));
    fieldSel.value = key;
    openPop(anchor, [fieldSel, el('p', { class: 'muted', text: 'Loading values…' })]);
    const all = await valuesOf(key);
    const sel = new Set(filters()[key] ?? []);
    const find = el('input', { type: 'search', placeholder: 'Search values', 'aria-label': 'Search values' });
    const list = el('div', { class: 'rb-vals' });
    const draw = () => list.replaceChildren(...all.filter((v) => v.toLowerCase().includes(find.value.toLowerCase())).slice(0, 300).map((v) => {
      const c = el('input', { type: 'checkbox', value: v });
      c.checked = sel.has(v);
      c.onchange = () => (c.checked ? sel.add(v) : sel.delete(v));
      return el('label', {}, [c, el('span', { text: v })]);
    }));
    find.oninput = draw;
    draw();
    openPop(anchor, [fieldSel, find, list, el('div', { class: 'rb-pop-foot' }, [
      el('button', { class: 'btn btn--ghost', text: 'Cancel', onclick: closePop }),
      el('button', { class: 'btn btn--primary', text: 'Apply', 'data-apply': '1', onclick: () => { setSelection(key, [...sel]); closePop(); } })])]);
  };

  // ------------------------------------------------------------------ the native object
  let tileId = null, run = 0, timer = null, lastSpec = null, rendering = Promise.resolve();
  const hint = (text) => view.replaceChildren(el('div', { class: 'rb-hint', text }));
  const render = () => (rendering = draw());
  const draw = async () => {
    timer = null;
    const me = ++run;
    if (tileId) { ctx.dropTile(tileId); tileId = null; }
    const ok = needs(st);
    if (ok !== true) { lastSpec = null; hint(ok); return; }
    const spec = reportSpec(st, cat);
    lastSpec = spec;
    const slot = el('div', { class: 'viz' });
    view.replaceChildren(slot);
    const id = await ctx.renderTile(spec, slot).catch((e) => { console.error('[report]', e); return null; });
    if (me !== run) { if (id) ctx.dropTile(id); return; }
    tileId = id;
    if (!id) hint('These fields could not be combined in one object. Remove the last one you added.');
  };
  const explain = () => {
    const c = comparison(st, cat);
    const bits = [];
    const g = c.ok ? GRAINS[c.date.grain ?? 'month'][0].toLowerCase() : '';
    if (st.compare !== 'none') bits.push(c.ok ? `Each ${g} is compared with ${st.compare === 'lastYear' ? `the same ${g} a year earlier` : `the ${g} before it`}${st.rows.length > 1 ? ', within each row group' : ''}. The first ${st.compare === 'lastYear' ? 'year' : g} of the period has nothing to compare with.` : `No comparison: ${c.reason}`);
    if (st.view !== 'table' && st.rows.length > 2) bits.push('Charts show the first two rows.');
    if (st.view !== 'table' && st.rows.length > 1 && st.figures.length > 1) bits.push('With two rows, charts show the first figure.');
    note.textContent = bits.join(' ');
  };
  /** Redraw the controls, then re-render the object: debounced while editing, at once on load. */
  const changed = (now = false) => {
    renderBar(); renderPanel(); explain(); remember();
    clearTimeout(timer);
    if (now) return render();
    timer = setTimeout(render, 300);
    return null;
  };

  // ------------------------------------------------------------------ save, open, share
  const snapshot = () => ({ name: st.name, view: st.view, rows: st.rows.map((r) => ({ ...r })), figures: [...st.figures], compare: st.compare, sort: st.sort, top: st.top, period: { ...st.period }, filters: filters() });
  const saved = () => { try { return JSON.parse(localStorage.getItem(STORE) ?? '[]'); } catch { return []; } };
  const store = (list) => { try { localStorage.setItem(STORE, JSON.stringify(list)); return true; } catch { return false; } };
  const valid = (s) => ({ ...s, rows: (s.rows ?? []).filter((r) => cat.get(r.key)), figures: (s.figures ?? []).filter((k) => cat.get(k)) });
  const load = async (s) => {
    Object.assign(st, valid(s), { period: { field: cat.get(s.period?.field)?.date ? s.period.field : dates[0]?.key, preset: s.period?.preset ?? 'all' } });
    const want = Object.fromEntries(Object.entries(s.filters ?? {}).filter(([k]) => cat.get(k)));
    for (const [key] of Object.entries(filters())) if (!want[key]) setSelection(key, null);
    for (const [key, values] of Object.entries(want)) setSelection(key, values);
    await applyPeriod();
    await changed(true);
  };
  const save = () => {
    const name = st.name.trim() || `Report ${saved().length + 1}`;
    st.name = name;
    const ok = store([{ ...snapshot(), name, at: new Date().toISOString().slice(0, 16).replace('T', ' ') }, ...saved().filter((r) => r.name !== name)].slice(0, 30));
    ctx.toast(ok ? `Saved “${name}” in this browser.` : 'This browser blocks storage; use Share link instead.');
    renderBar();
  };
  const openSaved = (anchor) => {
    const list = saved();
    const starters = STARTERS.map((t) => fromStarter(t, cat)).filter(Boolean);
    const row = (r, del) => el('div', { class: 'rb-saved' }, [
      el('button', { class: 'rb-open', 'data-name': r.name, onclick: () => { closePop(); load(r); } }, [el('span', { text: r.name }), el('small', { text: `${r.view}${r.at ? ` · ${r.at}` : ''}` })]),
      del ? el('button', { class: 'chip-x', 'aria-label': `Delete ${r.name}`, text: '×', onclick: () => { store(saved().filter((x) => x.name !== r.name)); openSaved(anchor); } }) : '']);
    openPop(anchor, [el('h3', { text: `Saved in this browser (${list.length})` }), ...(list.length ? list.map((r) => row(r, true)) : [el('p', { class: 'muted', text: 'Nothing saved yet. Save keeps a report in this browser; Share link carries it anywhere.' })]),
      el('h3', { text: 'Starter reports' }), ...starters.map((r) => row(r, false))]);
  };
  const encode = (s) => btoa(unescape(encodeURIComponent(JSON.stringify(s)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const decode = (t) => JSON.parse(decodeURIComponent(escape(atob(t.replace(/-/g, '+').replace(/_/g, '/')))));
  const link = () => `${location.origin}${location.pathname}${location.search}#r=${encode(snapshot())}`;
  // The address always carries the current report, so reloading or bookmarking keeps it.
  const remember = () => { try { history.replaceState(null, '', `#r=${encode(snapshot())}`); } catch { /* sandboxed frame */ } };
  const share = async () => {
    const url = link();
    try { await navigator.clipboard.writeText(url); ctx.toast('Link copied. It opens this report with its filters and period.'); } catch { ctx.toast('Copy was blocked: the link is in the address bar.'); }
    return url;
  };

  // ------------------------------------------------------------------ export: the object's own rows
  // buildWorkbook returns the Blob (the smoke test's export probe calls it); exportXlsx downloads it.
  // There is one selection group and one live object, so the rows follow every filter on screen;
  // first settle what the screen promises: a chart click still pending, a period still being
  // resolved, a re-render still in its 300 ms debounce.
  const buildWorkbook = async () => {
    if (selections.getSelection(group).pending.some((s) => !cat.get(keyOf(s))?.date)) selections.applyPendingSelections(group);
    if (timer) { clearTimeout(timer); render(); }
    await periodDone;
    await rendering;
    if (!tileId || !lastSpec) return null;
    const result = await ctx.getData(tileId);
    const raw = result?.data?.response?.data ?? result?.data?.data ?? result?.data ?? {};
    const rows = Array.isArray(raw) ? raw : Object.keys(raw).sort((a, b) => a - b).map((k) => raw[k]);
    const spec = lastSpec;
    const cols = [...spec.dims.map((d) => ({ ...d, kind: 'd' })), ...spec.figs.map((m) => ({ ...m, kind: 'm', fmt: excelFormat(m.pattern) })), ...spec.changes.map((c) => ({ ...c, kind: 'm', fmt: '+0.0%;-0.0%;0.0%' }))];
    const range = await periodRange();
    const filterText = Object.entries(filters()).map(([k, v]) => `${cat.get(k)?.name}: ${v.join(', ')}`).join(' · ') || 'none';
    const sortCol = spec.sort?.[0] && cols.find((c) => c.ref === spec.sort[0].by);
    const meta = [
      `Period: ${PERIODS[st.period.preset][0]}${range ? ` on ${cat.get(st.period.field)?.name ?? 'date'} (${iso(range[0])} – ${iso(range[1])})` : ''}`,
      `Filters: ${filterText}`,
      `Comparison: ${spec.changes.length ? COMPARES[st.compare] : 'none'}`,
      `Rows: ${rows.length.toLocaleString('en-US')}${rows.length >= spec.top ? ` (the row limit; more rows may exist${sortCol ? `, cut by ${sortCol.label} ${spec.sort[0].direction === 'asc' ? 'ascending' : 'descending'}` : ''}. Raise the row limit for more)` : ''}`,
      `Exported ${new Date().toISOString().slice(0, 16).replace('T', ' ')} from the governed semantic layer`];
    const report = {
      name: 'Report', freeze: meta.length + 3,
      cols: cols.map((c) => (c.kind === 'd' ? (c.grain ? 12 : 28) : Math.max(14, c.label.length + 4))),
      rows: [[{ v: st.name, s: 'title' }], ...meta.map((m) => [{ v: m, s: 'note' }]), [],
        cols.map((c) => ({ v: c.label, s: c.kind === 'd' ? 'head' : 'headr' })),
        ...rows.map((r) => cols.map((c, i) => (c.kind === 'd' ? { v: c.grain && typeof r[i] === 'number' ? dateLabel(r[i], c.grain) : (r[i] ?? ''), s: 'text' } : { v: typeof r[i] === 'number' ? r[i] : null, s: { fmt: c.fmt } })))],
    };
    const about = {
      name: 'Definitions', cols: [26, 70, 18],
      rows: [[{ v: 'Definitions', s: 'title' }], [], ['Field', 'Meaning', 'Format'].map((v) => ({ v, s: 'head' })),
        ...cols.map((c) => [{ v: c.label, s: 'label' }, { v: c.of ? `Change against the ${st.compare === 'lastYear' ? 'same period last year' : 'previous period'}, along the date rows` : cat.get(c.key)?.desc || (c.kind === 'd' ? `Row${c.grain ? ` by ${c.grain}` : ''}` : ''), s: 'text' }, { v: c.kind === 'm' ? c.fmt : c.grain ?? '', s: 'text' }])],
    };
    const blob = workbookBlob({ sheets: [report, about], title: st.name });
    return { blob, rows, cols };
  };
  let lastExport = null;
  const exportXlsx = async () => {
    try {
      const built = await buildWorkbook();
      if (!built) { ctx.toast('Build a report first.'); return null; }
      const { blob, rows, cols } = built;
      const a = el('a', { href: URL.createObjectURL(blob), download: `${st.name.replace(/[^\p{L}\p{N}]+/gu, '_') || 'report'}.xlsx` });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      ctx.toast(`Exported ${rows.length.toLocaleString('en-US')} rows.`);
      lastExport = { rows: rows.length, cols: cols.length, width: rows[0]?.length ?? 0, size: blob.size, first: rows[0] };
      return lastExport;
    } catch (e) {
      console.error('[export]', e);
      ctx.toast('The export failed.');
      return null;
    }
  };

  selections.onActiveSelectionChange(group).subscribe(({ pending }) => {
    // A click on a date in a chart would replace the period; drop it. Other clicks apply at once.
    for (const s of pending) if (cat.get(keyOf(s))?.date && s.operator !== 'between') setTimeout(() => selections.removeSelection(group, s), 0);
    if (pending.some((s) => !cat.get(keyOf(s))?.date)) setTimeout(() => selections.applyPendingSelections(group), 250);
    renderFilters();
    remember();
  });

  // ------------------------------------------------------------------ start: a shared link, or the first starter
  let start = null;
  try { const m = sharedHash.match(/^#r=(.+)$/); if (m) start = decode(m[1]); } catch { start = null; }
  start ??= STARTERS.map((t) => fromStarter(t, cat)).find(Boolean) ?? { ...st, rows: cat.rows.slice(0, 1).map((r) => ({ key: r.key })), figures: cat.figures.slice(0, 1).map((f) => f.key), name: 'First report', period: { preset: 'all' } };
  renderFilters();
  await load(start);
  return { st, elements: { panelBody, viewSeg, addFilterBtn, clearAllBtn, saveBtn, savedBtn, shareBtn, exportBtn, newBtn, nameIn, compareSel, pop, view, note }, load, snapshot, decode, exportXlsx, buildWorkbook, setSelection, clearFilters, share, saved, store, get tileId() { return tileId; }, get lastExport() { return lastExport; }, filters };
};
