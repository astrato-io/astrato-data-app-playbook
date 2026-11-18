/**
 * Custom Report — a replica of Astrato's Custom Report object for self-service reporting.
 *
 * Layout and behaviour follow the Astrato product: a chip bar across the top (visual-type chip with its
 * menu, then one chip per selected field, draggable to reorder, click to enable/disable, × to remove,
 * Clear), an icon rail, a collapsible field panel (Groups, Dimensions (k/N), Measures (k/N), click to
 * tick), per-field sort and filter popovers (search, n/N, Sort, Clear, Deselect all, Select all,
 * Invert, Apply), live re-query on every change, and bookmarks to save and share a report.
 *
 * Every field is a governed dimension or measure from the semantic layer; the persona's row scope
 * applies to every query, and sensitive measures (pay by gender, ethnicity, disability) are only
 * offered to roles cleared for them.
 */
import { FORMAT, DESC } from './formats.js';
import { DIM_FIELD } from './model.js';
import { workbookBlob } from './xlsx.js';

const KEY = 'people-reports-v1';
/** Measure display pattern → xlsx.js number style. */
const xs = (f = '') => (/pts/.test(f) ? 'dec' : /%/.test(f) ? (f.startsWith('+') ? 'spct' : 'pct') : /,,"m"/.test(f) ? 'gbpm' : /,"k"/.test(f) ? 'gbpk' : /£/.test(f) ? 'gbp' : /0\.0/.test(f) ? 'dec' : 'int');
export const SENSITIVE = /Pay Gap|Base Pay|Ethnic|Ethnicity|Disability/;

/** Groups, as Astrato Custom Report shows them: each combines dimensions and measures on one topic. */
export const GROUPS = [
  ['Organisation & geography', ['Business Unit', 'Department', 'Job Family', 'Function Group', 'BU Leader', 'Business Criticality', 'Region', 'Country', 'Cluster', 'HR Hub', 'HRIS Source'], ['Headcount', 'Headcount YoY', 'Headcount vs PY', 'FTE', 'Critical Role Share', 'Span of Control', 'People Managers']],
  ['Time', ['Month', 'Quarter', 'Fiscal Year'], ['Monthly Headcount', 'External Hires', 'Internal Moves', 'Net Movement', 'Rolling Voluntary Attrition', 'Workforce Cost', 'Workforce Budget', 'Absence Rate', 'Engagement Index']],
  ['People & movement', ['Seniority', 'Grade Band', 'Career Track', 'Employment Type'], ['External Hires LTM', 'External Hires YTD', 'Hiring Rate', 'Internal Mobility Rate', 'Promotion Rate', 'Average Tenure']],
  ['Retention', ['Exit Reason', 'Exit Destination', 'Tenure Band'], ['Voluntary Attrition', 'Voluntary Attrition vs PY', 'Voluntary Attrition vs P2Q', 'Regretted Attrition', 'High Performer Attrition', 'Critical Role Attrition', 'Voluntary Leavers LTM', 'Replacement Cost Exposure']],
  ['Engagement', [], ['Engagement Index CQ', 'Intent to Stay CQ', 'Intent to Stay', 'Manager Effectiveness', 'Career Growth', 'Pay Fairness', 'eNPS CQ', 'Absence Rate YTD']],
  ['Cost', [], ['Workforce Cost FYTD', 'Cost vs Budget % FYTD', 'Cost vs Budget %', 'Payroll Cost per Employee YTD', 'Contractor Cost', 'Contractor Share']],
  ['Skills & hiring', ['Skill', 'Skill Cluster', 'Skill Tier'], ['Critical Skills Coverage', 'Skills Coverage', 'Capability Gap 2028', 'Shortfall 2028', 'Open Critical Roles', 'Critical Roles with Internal Match', 'Average Time to Fill', 'Internal Fill Rate', 'Adjacent Employees']],
  ['Talent & succession', ['Succession Status', 'Key Person Risk', 'Impact of Loss', 'Role Tier'], ['Critical Roles', 'Ready-now Coverage', 'Ready-now Coverage vs PY', 'Uncovered At-risk Roles', 'Roles without Successor', 'Bench Strength', 'High Flight-risk Incumbents Rate', 'Overdue Succession Plans']],
  ['Diversity (privacy-safe)', ['Gender', 'Age Band', 'Ethnicity'], ['Headcount (privacy-safe)', 'Women Representation (privacy-safe)', 'Women in Leadership (privacy-safe)', 'DEI Voluntary Attrition (privacy-safe)', 'DEI Promotion Rate (privacy-safe)', 'Women Representation', 'Women Share of Hires', 'Women Share of Promotions', 'Gender Pay Gap (privacy-safe)', 'Average Base Pay (privacy-safe)', 'Ethnic Minority Representation (privacy-safe)', 'Disability Declaration Rate']],
];
/** Astrato Custom Report's visuals, in its menu order. */
const VIZ = [['table', 'Table', 'table_chart'], ['bar', 'Bar chart', 'bar_chart'], ['scatter', 'Scatter chart', 'scatter_plot'], ['heatMap', 'Heat map chart', 'grid_on'], ['pivot', 'Pivot table', 'pivot_table_chart']];
const NEEDS = {
  bar: (d, m) => (d >= 1 && m >= 1) || 'A bar chart needs at least one dimension and one measure.',
  scatter: (d, m) => (d >= 1 && m >= 2) || 'A scatter chart needs one dimension and two measures (x, y; a third sizes the points).',
  heatMap: (d, m) => (d >= 2 && m >= 1) || 'A heat map needs two dimensions and a measure.',
  pivot: (d, m) => (d >= 2 && m >= 1) || 'A pivot table needs two dimensions (the last runs across the columns) and a measure.',
  table: (d, m) => (d + m >= 1) || 'Pick dimensions and measures from the panel on the left.',
};
/** Starter bookmarks (Astrato saves custom reports as bookmarks). */
export const TEMPLATES = [
  { name: 'Attrition hotspots in my scope', viz: 'table', fields: [['d', 'Department'], ['d', 'Seniority'], ['m', 'Headcount'], ['m', 'Voluntary Attrition'], ['m', 'Voluntary Attrition vs P2Q'], ['m', 'Regretted Attrition'], ['m', 'Replacement Cost Exposure']], sort: ['Voluntary Attrition vs P2Q', 'desc'] },
  { name: 'Attrition by business unit × level', viz: 'pivot', fields: [['d', 'Business Unit'], ['d', 'Seniority'], ['m', 'Voluntary Attrition']] },
  { name: 'Engagement drivers by department', viz: 'table', fields: [['d', 'Department'], ['m', 'Engagement Index CQ'], ['m', 'Intent to Stay CQ'], ['m', 'Manager Effectiveness'], ['m', 'Career Growth'], ['m', 'Pay Fairness']], sort: ['Engagement Index CQ', 'asc'] },
  { name: 'Pay vs attrition by department', viz: 'scatter', fields: [['d', 'Department'], ['m', 'Compa Ratio'], ['m', 'Voluntary Attrition'], ['m', 'Headcount']] },
  { name: 'Succession cover heat map', viz: 'heatMap', fields: [['d', 'Country'], ['d', 'Business Unit'], ['m', 'Ready-now Coverage']] },
  { name: 'Open critical roles by skill', viz: 'bar', fields: [['d', 'Skill'], ['m', 'Open Critical Roles']] },
  { name: 'Gender balance by level (privacy-safe)', viz: 'bar', fields: [['d', 'Seniority'], ['m', 'Women Representation (privacy-safe)']] },
];

/**
 * The report state → an ad-hoc tile spec (see adhoc.js). Pure: the compile check runs it offline.
 * st: { name, viz, fields: [{ kind: 'd'|'m', name, on }], sort: [name, dir] | null, filters: { dim: [values] }, top }
 */
export const reportSpec = (st, dimField = DIM_FIELD) => {
  const active = () => st.fields.filter((f) => f.on);
  const ds = active().filter((f) => f.kind === 'd').map((f) => f.name), ms = active().filter((f) => f.kind === 'm').map((f) => f.name);
  const sortRef = (() => {
    if (st.sort) { const i = ds.indexOf(st.sort[0]); if (i >= 0) return [`d${i}`, st.sort[1]]; const j = ms.indexOf(st.sort[0]); if (j >= 0) return [`m${j}`, st.sort[1]]; }
    return ds[0] === 'Month' || ds[0] === 'Quarter' || !ms.length ? ['d0', 'asc'] : ['m0', 'desc'];
  })();
  const base = { title: st.name, dims: ds.map((d) => dimField[d]), filters: Object.entries(st.filters).map(([d, vals]) => [...dimField[d], vals]), limit: st.top, sort: [{ by: sortRef[0], direction: sortRef[1] }] };
  const labels = Object.fromEntries([...ds.map((d, i) => [`d${i}`, d]), ...ms.map((m, i) => [`m${i}`, m])]);
  if (st.viz === 'table') return { ...base, type: 'table', measures: ms, columnLabels: labels };
  if (st.viz === 'pivot') return { ...base, type: 'table', measures: ms, pivotCols: 1, columnLabels: labels, sort: [{ by: 'd0', direction: 'asc' }] };
  if (st.viz === 'heatMap') return { ...base, type: 'heatMap', dims: base.dims.slice(0, 2), measures: ms.slice(0, 1), gradient: ['#FFFFFF', '#B3C6F6', '#2B5CE6'], legend: true, sort: undefined };
  if (st.viz === 'scatter') return { ...base, type: 'scatter', dims: base.dims.slice(0, 1), measures: ms.slice(0, 3), pointSize: 8, colors: ['#2B5CE6'], legend: false, sort: undefined };
  const stacked = ds.length > 1;
  const spec = { ...base, type: 'bar', dims: base.dims.slice(0, 2), measures: stacked ? ms.slice(0, 1) : ms.slice(0, 4), stacked, legend: stacked || ms.length > 1, orientation: 'horizontal' };
  // A bar shows fewer fields than the table: sort on one it keeps.
  const [, kind, n] = /^([dm])(\d+)$/.exec(spec.sort[0].by) ?? [];
  if (Number(n) >= (kind === 'd' ? spec.dims : spec.measures).length) spec.sort = [{ by: 'm0', direction: 'desc' }];
  return spec;
};

export const mountBuilder = (ctx, grid) => {
  const { el, esc, icon, fields } = ctx;
  const cleared = () => ['chro', 'rhrd'].includes(ctx.persona.key);
  const allowed = (kind, name) => cleared() || !(kind === 'm' ? SENSITIVE.test(name) : name === 'Ethnicity');
  const exists = (kind, name) => (kind === 'm' ? !!fields.measure(name) : !!DIM_FIELD[name]);
  const st = { name: 'Untitled report', viz: 'table', fields: [], sort: null, filters: {}, top: 100, panel: true, open: new Set(['Groups']) };
  const isOn = (kind, name) => st.fields.some((f) => f.kind === kind && f.name === name);
  const active = () => st.fields.filter((f) => f.on);
  const bookmarks = () => { try { return JSON.parse(localStorage.getItem(KEY) ?? '[]'); } catch { return []; } };
  const storeBookmarks = (l) => { try { localStorage.setItem(KEY, JSON.stringify(l)); } catch { /* private window */ } };

  // ---------------------------------------------------------------- shell
  const bar = el('div', { class: 'cr-bar' });
  const rail = el('div', { class: 'cr-rail' });
  const panel = el('div', { class: 'cr-panel' });
  const view = el('div', { class: 'cr-view' });
  const pop = el('div', { class: 'cr-pop', hidden: true });
  const card = el('figure', { class: 'pi-card span-12 cr' }, [bar, el('div', { class: 'cr-body' }, [rail, panel, view]), pop]);
  grid.append(card);
  const closePop = () => { pop.hidden = true; pop.replaceChildren(); };
  document.addEventListener('mousedown', (e) => { if (!pop.hidden && !pop.contains(e.target) && !e.target.closest('[data-pop]')) closePop(); });
  const openPop = (anchor, children) => {
    pop.replaceChildren(...children);
    const a = anchor.getBoundingClientRect(), c = card.getBoundingClientRect();
    pop.style.left = `${Math.max(8, Math.min(a.left - c.left, c.width - 300))}px`;
    pop.style.top = `${a.bottom - c.top + 6}px`;
    pop.hidden = false;
  };

  // ---------------------------------------------------------------- chip bar
  const vizOf = () => VIZ.find(([k]) => k === st.viz);
  let dragFrom = null;
  const renderBar = () => {
    const [, vl, vi] = vizOf();
    const vizChip = el('button', { class: 'cr-viz', 'data-pop': '1', title: 'Change visualization', onclick: (e) => openPop(e.currentTarget, [el('div', { class: 'cr-menu' }, VIZ.map(([k, l, ic]) => el('button', { class: k === st.viz ? 'on' : '', onclick: () => { st.viz = k; closePop(); changed(); } }, [icon(ic), el('span', { text: l }), k === st.viz ? icon('check') : null])))]) }, [icon(vi), el('span', { text: vl })]);
    const chips = st.fields.map((f, i) => {
      const filt = f.kind === 'd' && st.filters[f.name]?.length;
      const sorted = st.sort?.[0] === f.name;
      const chip = el('span', { class: `cr-chip ${f.on ? '' : 'off'}`, draggable: 'true', title: `${f.kind === 'd' ? 'Dimension' : 'Measure'} · ${DESC[f.name] ?? f.name}\nClick to ${f.on ? 'disable' : 'enable'} · drag to reorder` }, [
        el('i', { class: `t ${f.kind}`, text: f.kind === 'd' ? 'abc' : '1.2' }),
        el('span', { class: 'n', text: f.name, onclick: () => { f.on = !f.on; changed(); } }),
        el('button', { class: `f ${filt || sorted ? 'is' : ''}`, 'data-pop': '1', title: f.kind === 'd' ? 'Sort and filter' : 'Sort', onclick: (e) => openField(e.currentTarget, f) }, icon(filt ? 'filter_alt' : sorted ? (st.sort[1] === 'asc' ? 'arrow_upward' : 'arrow_downward') : 'filter_list')),
        el('button', { class: 'x', title: 'Remove', onclick: () => remove(f.kind, f.name) }, icon('close')),
      ]);
      chip.addEventListener('dragstart', (e) => { dragFrom = i; e.dataTransfer.effectAllowed = 'move'; chip.classList.add('drag'); });
      chip.addEventListener('dragend', () => chip.classList.remove('drag'));
      chip.addEventListener('dragover', (e) => { e.preventDefault(); chip.classList.add('over'); });
      chip.addEventListener('dragleave', () => chip.classList.remove('over'));
      chip.addEventListener('drop', (e) => { e.preventDefault(); chip.classList.remove('over'); if (dragFrom == null || dragFrom === i) return; const [m] = st.fields.splice(dragFrom, 1); st.fields.splice(i, 0, m); dragFrom = null; changed(); });
      return chip;
    });
    bar.replaceChildren(vizChip, ...chips,
      st.fields.length ? null : el('span', { class: 'cr-empty', text: 'Click dimensions and measures in the panel to add them here' }),
      el('span', { class: 'sp' }),
      (() => { const s = el('select', { class: 'cr-top', 'aria-label': 'Rows' }, [25, 100, 500, 2000].map((n) => el('option', { value: n, text: `${n} rows` }))); s.value = st.top; s.onchange = () => { st.top = Number(s.value); changed(); }; return s; })(),
      el('button', { class: 'cr-clear', text: 'Clear', disabled: !st.fields.length, onclick: () => { st.fields = []; st.filters = {}; st.sort = null; st.name = 'Untitled report'; changed(); } }));
  };

  // ---------------------------------------------------------------- per-field sort + filter popover
  const valueCache = new Map();
  const valuesOf = async (name) => {
    const key = `${ctx.persona.key}|${name}`;
    if (valueCache.has(key)) return valueCache.get(key);
    const [field, view] = DIM_FIELD[name];
    let rows;
    try { rows = await ctx.q({ dims: [[field, view]], measures: [], limit: 2000 }); } catch { rows = await ctx.q({ dims: [[field, view]], measures: ['Headcount'], limit: 2000 }).catch(() => []); }
    const vals = [...new Set(rows.map((r) => r[field]).filter((v) => v != null && v !== ''))].map(String).sort((a, b) => a.localeCompare(b));
    valueCache.set(key, vals);
    return vals;
  };
  const openField = async (anchor, f) => {
    const sortBtns = el('div', { class: 'cr-sorts' }, [['asc', 'arrow_upward', 'Sort ascending'], ['desc', 'arrow_downward', 'Sort descending']].map(([dir, ic, l]) =>
      el('button', { class: st.sort?.[0] === f.name && st.sort[1] === dir ? 'on' : '', onclick: () => { st.sort = [f.name, dir]; closePop(); changed(); } }, [icon(ic), el('span', { text: l })])));
    if (f.kind === 'm') { openPop(anchor, [el('b', { class: 'cr-pop-h', text: f.name }), sortBtns, el('div', { class: 'cr-menu' }, [el('button', { onclick: () => { if (st.sort?.[0] === f.name) st.sort = null; closePop(); changed(); } }, [icon('block'), el('span', { text: 'Clear sort' })])])]); return; }
    openPop(anchor, [el('b', { class: 'cr-pop-h', text: f.name }), el('p', { class: 'pi-note', text: 'Loading values…' })]);
    const all = await valuesOf(f.name);
    let sel = new Set(st.filters[f.name] ?? all);
    let q = '';
    const count = el('span', { class: 'cr-count' });
    const list = el('div', { class: 'cr-vals' });
    const draw = () => {
      count.textContent = `${sel.size}/${all.length}`;
      list.replaceChildren(...all.filter((v) => v.toLowerCase().includes(q)).slice(0, 400).map((v) => el('label', { class: sel.has(v) ? 'on' : '' }, [
        (() => { const c = el('input', { type: 'checkbox' }); c.checked = sel.has(v); c.onchange = () => { if (c.checked) sel.add(v); else sel.delete(v); draw(); }; return c; })(), el('span', { text: v })])));
    };
    const search = el('input', { class: 'cr-search', placeholder: 'Search', 'aria-label': `Search ${f.name}` });
    search.oninput = () => { q = search.value.toLowerCase(); draw(); };
    draw();
    openPop(anchor, [
      el('div', { class: 'cr-pop-top' }, [icon('search'), search, count]),
      el('div', { class: 'cr-pop-cols' }, [list, el('div', { class: 'cr-menu' }, [
        ...sortBtns.children,
        el('button', { onclick: () => { delete st.filters[f.name]; if (st.sort?.[0] === f.name) st.sort = null; closePop(); changed(); } }, [icon('filter_alt_off'), el('span', { text: 'Clear' })]),
        el('button', { onclick: () => { sel = new Set(); draw(); } }, [icon('check_box_outline_blank'), el('span', { text: 'Deselect all' })]),
        el('button', { onclick: () => { sel = new Set(all); draw(); } }, [icon('select_all'), el('span', { text: 'Select all' })]),
        el('button', { onclick: () => { sel = new Set(all.filter((v) => !sel.has(v))); draw(); } }, [icon('flip'), el('span', { text: 'Invert' })]),
      ])]),
      el('div', { class: 'cr-pop-foot' }, [el('button', { class: 'pi-btn sm ghost', text: 'Cancel', onclick: closePop }), el('button', { class: 'pi-btn sm primary', text: 'Apply', onclick: () => { if (sel.size === all.length || !sel.size) delete st.filters[f.name]; else st.filters[f.name] = [...sel]; closePop(); changed(); } })]),
    ]);
    search.focus();
  };

  // ---------------------------------------------------------------- field panel
  const toggle = (kind, name) => { if (isOn(kind, name)) remove(kind, name); else { st.fields.push({ kind, name, on: true }); changed(); } };
  const remove = (kind, name) => { st.fields = st.fields.filter((f) => !(f.kind === kind && f.name === name)); if (kind === 'd') delete st.filters[name]; if (st.sort?.[0] === name) st.sort = null; changed(); };
  let search = '';
  const item = (kind, name) => el('button', { class: `cr-item ${isOn(kind, name) ? 'on' : ''}`, title: DESC[name] ?? name, onclick: () => toggle(kind, name) }, [el('i', { class: `t ${kind}`, text: kind === 'd' ? 'abc' : '1.2' }), el('span', { text: name }), isOn(kind, name) ? icon('check') : null]);
  const section = (key, label, items, nested) => {
    const open = st.open.has(key) || !!search;
    return el('div', { class: `cr-sec ${nested ? 'nested' : ''}` }, [
      el('button', { class: 'cr-sec-h', onclick: () => { if (st.open.has(key)) st.open.delete(key); else st.open.add(key); renderPanel(); } }, [el('span', { html: label }), icon(open ? 'expand_less' : 'expand_more')]),
      open ? el('div', { class: 'cr-sec-b' }, items) : null,
    ]);
  };
  const renderPanel = () => {
    card.classList.toggle('collapsed', !st.panel);
    if (!st.panel) { panel.replaceChildren(el('button', { class: 'cr-tab', title: 'Expand fields', onclick: () => { st.panel = true; renderPanel(); } }, icon('chevron_right'))); return; }
    const match = (n) => !search || n.toLowerCase().includes(search);
    const groups = GROUPS.map(([g, ds, ms]) => [g, ds.filter((d) => exists('d', d) && allowed('d', d) && match(d)), ms.filter((m) => exists('m', m) && allowed('m', m) && match(m))]).filter(([, d, m]) => d.length + m.length);
    const allDims = [...new Set(GROUPS.flatMap(([, d]) => d))].filter((d) => exists('d', d) && allowed('d', d));
    const allMeas = [...new Set(GROUPS.flatMap(([, , m]) => m))].filter((m) => exists('m', m) && allowed('m', m));
    const nOn = (kind) => st.fields.filter((f) => f.kind === kind).length;
    const s = el('input', { class: 'cr-search', placeholder: 'Search dimensions and measures', value: search, 'aria-label': 'Search fields' });
    s.oninput = () => { search = s.value.toLowerCase().trim(); renderPanel(); panel.querySelector('.cr-search')?.focus(); const i = panel.querySelector('.cr-search'); i?.setSelectionRange(i.value.length, i.value.length); };
    panel.replaceChildren(
      el('div', { class: 'cr-panel-top' }, [icon('search'), s, el('button', { class: 'cr-tab in', title: 'Collapse', onclick: () => { st.panel = false; renderPanel(); } }, icon('chevron_left'))]),
      el('div', { class: 'cr-panel-scroll' }, [
        section('Groups', `Groups <small>(${groups.filter(([, d, m]) => [...d.map((x) => ['d', x]), ...m.map((x) => ['m', x])].some(([k, n]) => isOn(k, n))).length}/${groups.length})</small>`,
          groups.map(([g, ds, ms]) => section(`g:${g}`, esc(g), [...ds.map((d) => item('d', d)), ...ms.map((m) => item('m', m))], true))),
        section('Dimensions', `Dimensions <small>(${nOn('d')}/${allDims.length})</small>`, allDims.filter(match).map((d) => item('d', d))),
        section('Measures', `Measures <small>(${nOn('m')}/${allMeas.length})</small>`, allMeas.filter(match).map((m) => item('m', m))),
      ]),
    );
  };

  // ---------------------------------------------------------------- icon rail: fields, bookmarks, share, export
  const renderRail = () => rail.replaceChildren(
    el('button', { class: st.panel ? 'on' : '', title: 'Dimensions and measures', onclick: () => { st.panel = !st.panel; renderPanel(); renderRail(); } }, icon('add_circle_outline')),
    el('button', { 'data-pop': '1', title: 'Bookmarks', onclick: (e) => openBookmarks(e.currentTarget) }, icon('bookmarks')),
    el('button', { title: 'Copy share link', onclick: () => share() }, icon('link')),
    el('button', { title: 'Export to Excel', onclick: () => exportXlsx() }, icon('download')),
  );
  const openBookmarks = (anchor) => {
    const l = bookmarks();
    const name = el('input', { class: 'cr-search', value: st.name === 'Untitled report' ? '' : st.name, placeholder: 'Bookmark name' });
    const load = (b) => { st.name = b.name; st.viz = b.viz; st.fields = b.fields.map(([kind, n, on = true]) => ({ kind, name: n, on })).filter((f) => exists(f.kind, f.name) && allowed(f.kind, f.name)); st.sort = b.sort ?? null; st.filters = b.filters ?? {}; st.top = b.top ?? 100; closePop(); changed(); };
    openPop(anchor, [
      el('b', { class: 'cr-pop-h', text: 'Bookmarks' }),
      el('div', { class: 'cr-pop-top' }, [name, el('button', { class: 'pi-btn sm primary', text: 'Save', onclick: () => {
        const n = name.value.trim() || `Report ${l.length + 1}`;
        st.name = n;
        storeBookmarks([{ name: n, viz: st.viz, fields: st.fields.map((f) => [f.kind, f.name, f.on]), sort: st.sort, filters: st.filters, top: st.top, by: ctx.persona.name, at: new Date().toISOString().slice(0, 16).replace('T', ' ') }, ...l.filter((b) => b.name !== n)].slice(0, 20));
        closePop(); renderBar(); ctx.toast(`Bookmark saved · <b>${esc(n)}</b>`, 'bookmark_added');
      } })]),
      el('h6', { class: 'cr-pop-sub', text: `My bookmarks (${l.length})` }),
      ...(l.length ? l.map((b) => el('div', { class: 'cr-bm' }, [el('button', { class: 'cr-bm-open', onclick: () => load(b) }, [icon(VIZ.find(([k]) => k === b.viz)?.[2] ?? 'table_chart'), el('span', { html: `${esc(b.name)}<small>${esc(b.at)} · ${esc(b.by)}</small>` })]), el('button', { class: 'x', title: 'Delete bookmark', onclick: () => { storeBookmarks(l.filter((x) => x.name !== b.name)); openBookmarks(anchor); } }, icon('close'))]))
        : [el('p', { class: 'pi-note', text: 'None yet. Save the current report as a bookmark to reopen or share it.' })]),
      el('h6', { class: 'cr-pop-sub', text: 'Starter reports' }),
      ...TEMPLATES.filter((t) => t.fields.every(([k, n]) => exists(k, n) && allowed(k, n))).map((t) => el('div', { class: 'cr-bm' }, el('button', { class: 'cr-bm-open', onclick: () => load(t) }, [icon(VIZ.find(([k]) => k === t.viz)?.[2]), el('span', { text: t.name })]))),
    ]);
  };

  // ---------------------------------------------------------------- the native object
  let tileId = null, run = 0, timer = null;
  const specOf = () => reportSpec(st);
  const hint = (text, ic = 'info') => view.replaceChildren(el('div', { class: 'cr-hint' }, [icon(ic), el('span', { text })]));
  const render = async () => {
    const me = ++run;
    const d = active().filter((f) => f.kind === 'd').length, m = active().filter((f) => f.kind === 'm').length;
    const ok = NEEDS[st.viz](d, m);
    if (tileId) { ctx.dropTile(tileId); tileId = null; }
    if (ok !== true) { hint(ok); return; }
    const slot = el('div', { class: 'viz' });
    view.replaceChildren(slot);
    let id = null;
    try { id = await ctx.renderTile(specOf(), slot, { group: 'g-rb' }); } catch (e) { console.warn('[custom report]', e); }
    if (me !== run) { if (id) ctx.dropTile(id); return; }
    tileId = id;
    if (!id) hint('These fields cannot be combined in one query: pick measures from the same topic group as the dimensions.', 'warning');
  };
  const changed = () => {
    renderBar(); renderPanel(); renderRail();
    try { if (ctx.current === 'rb') history.replaceState(null, '', `#rb=${encode()}`); } catch { /* sandboxed */ }
    clearTimeout(timer); timer = setTimeout(render, 350);
  };

  // ---------------------------------------------------------------- export + share
  const encode = () => btoa(unescape(encodeURIComponent(JSON.stringify({ n: st.name, v: st.viz, f: st.fields.map((f) => [f.kind, f.name, f.on ? 1 : 0]), s: st.sort, x: st.filters, k: st.top }))));
  const share = () => {
    const url = `${location.origin}${location.pathname}#rb=${encode()}`;
    navigator.clipboard?.writeText(url).then(() => ctx.toast('Link copied · it opens this report in the recipient’s own access scope', 'link'), () => ctx.toast(esc(url), 'link'));
  };
  const exportXlsx = async () => {
    const s = specOf();
    if (!s.dims.length && !s.measures.length) { ctx.toast('Add fields to export', 'info'); return; }
    try {
      const rows = await ctx.q({ dims: s.dims, measures: s.measures, filters: s.filters, limit: Math.max(st.top, 2000) });
      const ds = active().filter((f) => f.kind === 'd').map((f) => f.name).slice(0, s.dims.length), ms = s.measures;
      const sheet = { name: st.name.slice(0, 28) || 'Report', cols: [...ds.map(() => 24), ...ms.map(() => 18)], freeze: { row: 4 },
        rows: [[{ v: st.name, s: 'title' }], [{ v: `People Intelligence · ${ctx.persona.scopeLabel} · illustrative data as of 30 Sep 2026 · governed semantic layer`, s: 'note' }], [], [...ds, ...ms].map((v) => ({ v, s: 'head' })),
          ...rows.map((r) => [...s.dims.map(([f]) => r[f] ?? ''), ...ms.map((m) => ({ v: Number(r[m] ?? 0), s: xs(FORMAT[m]) }))])] };
      const blob = workbookBlob({ sheets: [sheet], title: st.name, author: ctx.persona.name });
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${st.name.replace(/[^\w]+/g, '_')}.xlsx` });
      document.body.append(a); a.click(); a.remove();
      ctx.toast(`Exported <b>${esc(st.name)}</b> · ${rows.length} rows`, 'download_done');
    } catch (e) { ctx.toast(`Export failed: ${esc(e.message ?? e)}`, 'error'); }
  };

  // ---------------------------------------------------------------- start: a shared link, or a starter report
  const fromHash = () => {
    const mm = location.hash.match(/^#rb=(.+)$/);
    if (!mm) return false;
    try {
      const s = JSON.parse(decodeURIComponent(escape(atob(mm[1]))));
      Object.assign(st, { name: s.n ?? st.name, viz: s.v ?? 'table', fields: (s.f ?? []).map(([kind, name, on]) => ({ kind, name, on: on !== 0 })).filter((f) => exists(f.kind, f.name) && allowed(f.kind, f.name)), sort: s.s ?? null, filters: s.x ?? {}, top: s.k ?? 100 });
      return true;
    } catch { return false; }
  };
  if (!fromHash()) { const t = TEMPLATES[0]; Object.assign(st, { name: t.name, viz: t.viz, fields: t.fields.map(([kind, name]) => ({ kind, name, on: true })), sort: t.sort }); }
  renderBar(); renderPanel(); renderRail();
  hint('Loading…', 'hourglass_empty');
  ctx.onPageMount('rb', () => render());
  ctx.onPersonaNow(() => { st.fields = st.fields.filter((f) => allowed(f.kind, f.name)); valueCache.clear(); renderBar(); renderPanel(); });
  ctx.onPersona(() => { if (ctx.current === 'rb') render(); });
  return { render, state: st };
};
