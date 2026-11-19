/**
 * People Intelligence — an AI-native HR intelligence and decision platform, built as an Astrato App
 * on one governed semantic layer ("People Intelligence", ASTRATO_GALLERY.MOCK_DATA.PEOPLE_*).
 *
 * Illustrative synthetic data for a fictional telecom group: mocked SAP SuccessFactors (Employee Central,
 * Recruiting, Talent Intelligence Hub, Opportunity Marketplace), SAP S/4HANA cost centres, Qualtrics
 * EmployeeXM, a regional cloud HRIS and a local HRIS, curated as a cloud data lake would be.
 *
 * Every KPI, chart and table is a native Astrato object or a governed engine query; the assistant answers
 * by running stored business questions. Persona scope is applied as a static filter to every object
 * (row-level access is enforced in the semantic layer in production).
 */
import { createAstratoApp } from '@astrato-io/app-runtime';
import { createVisualizationRuntime, registry } from '@astrato-io/visualizations';
import { createVisualizationAvailableFields } from '@astrato-io/visualizations/definitions';
import { throttleQueries, toSource } from './throttle.js';
import { buildTiles, buildTile, compileDefinition, staticFilter } from './dashboard.js';
import { KPIS, ctlId, GROUPS, TREND_GROUPS, questionOf, C, SERIES, measFormat, secondary, perMeasure, tileCatalogue } from './catalogue.js';
import { mountSkillsPanels } from './skills.js';
import { createFieldIndex } from './fields.js';
import { themeVSpec, applyEach } from './theme.js';
import { attachBasemap, plotRect } from './basemap.js';
import { FORMAT, VIEWS_OF } from './formats.js';
import { mountHome } from './home.js';
import { mountExplain, mountInvestigation } from './explain.js';
import { mountSimulator } from './simulator.js';
import { mountActions, actionStore } from './actions.js';
import { mountAssistant } from './assistant.js';
import { mountGovernance, mountLibrary } from './govern.js';
import { mountPlan } from './plan.js';
import { mountBuilder } from './builder.js';
import { mountDataOps } from './dataops.js';
import { mountPrivacy, mountAccess, mountCoverage } from './access.js';
import { exportWorkbook } from './export.js';
import { appState } from './app-state.js';
import { registerChecks } from './checks.js';
import { adhocTile, fitColumnOps } from './adhoc.js';

// Optional children (`cond ? node : null`) are skipped rather than rendered as the text "null".
const nativeReplace = Element.prototype.replaceChildren;
Element.prototype.replaceChildren = function replaceChildren(...kids) { return nativeReplace.apply(this, kids.filter((k) => k != null && k !== false)); };

export const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v; else if (k === 'text') node.textContent = v; else if (k === 'html') node.innerHTML = v; else if (k.startsWith('on')) node.addEventListener(k.slice(2), v); else node.setAttribute(k, v === true ? '' : v);
  }
  for (const c of [].concat(children)) if (c != null && c !== false) node.append(c);
  return node;
};
export const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
export const icon = (name) => el('span', { class: 'mi', text: name, 'aria-hidden': 'true' });

/** Format a value with an Excel-style pattern from the layer (`£#,##0.0,,"m"`, `+0.0" pts"`, `0.0%` …). */
export const formatWith = (pattern, value) => {
  const n = Number(value);
  if (value == null || value === '' || Number.isNaN(n)) return '–';
  const sections = String(pattern ?? '#,##0').split(';');
  let sec = sections[0];
  if (n < 0 && sections[1]) sec = sections[1];
  else if (n === 0 && sections[2]) sec = sections[2];
  const lits = [];
  let s = sec.replace(/"([^"]*)"/g, (_, t) => { lits.push(t); return `\u0000${lits.length - 1}\u0000`; });
  const pct = s.includes('%');
  const core = s.match(/[#0,.]+/)?.[0] ?? '0';
  const scale = (core.match(/,+$/)?.[0].length ?? 0);
  const dec = (core.split('.')[1] ?? '').replace(/,/g, '').length;
  const group = core.replace(/,+$/, '').includes(',');
  let v = Math.abs(n) * (pct ? 100 : 1) / 1000 ** scale;
  if (sections.length === 1 && n < 0) v = v; // sign added below
  const txt = v.toLocaleString('en-GB', { minimumFractionDigits: dec, maximumFractionDigits: dec, useGrouping: group });
  let out = s.replace(core, txt).replace(/\u0000(\d+)\u0000/g, (_, i) => lits[i]);
  if (n < 0 && !sections[1]) out = `−${out.replace(/^\+/, '')}`;
  if (n < 0 && sections[1]) out = out.replace(/^-/, '−');
  return out;
};
export const fmtM = (name, v) => formatWith(FORMAT[name] ?? '#,##0.##', v);
export const gbp = (v) => { const n = Number(v); const a = Math.abs(n); const s = n < 0 ? '−' : ''; return a >= 1e9 ? `${s}£${(a / 1e9).toFixed(2)}bn` : a >= 1e6 ? `${s}£${(a / 1e6).toFixed(1)}m` : a >= 1e3 ? `${s}£${Math.round(a / 1e3).toLocaleString('en-GB')}k` : `${s}£${Math.round(a)}`; };
export const pct = (v, d = 1) => `${(Number(v) * 100).toFixed(d)}%`;
export const int = (v) => Math.round(Number(v)).toLocaleString('en-GB');

/** The four personas. Scope narrows every object and every query (business-unit-only for unit-level views). */
export const PERSONAS = {
  chro: { key: 'chro', name: 'Sarah Mitchell', first: 'Sarah', initials: 'SM', role: 'Group CHRO', scopeLabel: 'Group · 15 countries · 8 business units', scope: [] },
  rhrd: { key: 'rhrd', name: 'James Whitfield', first: 'James', initials: 'JW', role: 'Regional HR Director · UK & Ireland', scopeLabel: 'UK & Ireland only', scope: [['Region', 'Countries', ['UK & Ireland']]] },
  hrbp: { key: 'hrbp', name: 'Hannah Clarke', first: 'Hannah', initials: 'HC', role: 'HR Business Partner · UK Technology', scopeLabel: 'United Kingdom · Technology', scope: [['Country', 'Countries', ['United Kingdom']], ['Business Unit', 'Business Units', ['Technology']]] },
  bul: { key: 'bul', name: 'Priya Nair', first: 'Priya', initials: 'PN', role: 'Business Unit Leader · Technology', scopeLabel: 'Technology · all countries', scope: [['Business Unit', 'Business Units', ['Technology']]] },
};

const PAGES = [
  { key: 'home', label: 'My People Home', icon: 'home', title: 'My People Home', sub: 'Personalised intelligence, priorities and decisions', group: 'g-home',
    controls: [['g-home', 'Countries', 'Region'], ['g-home', 'Business Units', 'Business Unit']], kpis: [], charts: [['h-scorecard', 'span-12'], ['h-hot', 'span-12 tall'], ['h-attr', 'span-12'], ['h-bu', 'span-6 short'], ['h-cost', 'span-6 short']] },
  { key: 'wx', label: 'Workforce Explorer', icon: 'travel_explore', title: 'Workforce Explorer', sub: 'Headcount, movement, cost, absence and engagement — click any chart to investigate a segment', group: 'g-wx',
    controls: [['g-wx', 'Countries', 'Region'], ['g-wx', 'Countries', 'Country'], ['g-wx', 'Business Units', 'Business Unit'], ['g-wx', 'Departments', 'Department'], ['g-wx', 'Departments', 'Job Family'], ['g-wx', 'Seniority', 'Seniority'], ['g-wx', 'Workforce', 'Employment Type']],
    kpis: ['w-hc', 'w-hire', 'w-va', 'w-mob', 'w-abs', 'w-cost', 'w-eng', 'w-ten'],
    charts: [['x:explain', 'span-4'], ['x-dist', 'span-8 tall'], ['x-trend', 'span-6'], ['x-map', 'span-6'], ['x-move', 'span-6'], ['x-attr', 'span-6'], ['x-cost', 'span-6'], ['x-health', 'span-6'], ['x-org', 'span-7 tall'], ['x-heat', 'span-5 tall'], ['x-table', 'span-12 tall'], ['x-monthly', 'span-12 tall']] },
  { key: 'tr', label: 'Talent & Retention', icon: 'security', title: 'Talent & Retention', sub: 'Flight risk, critical talent and the drivers behind attrition', group: 'g-tr',
    controls: [['g-tr', 'Countries', 'Region'], ['g-tr', 'Countries', 'Country'], ['g-tr', 'Business Units', 'Business Unit'], ['g-tr', 'Departments', 'Department'], ['g-tr', 'Seniority', 'Seniority']],
    kpis: ['t-va', 't-ra', 't-hp', 't-cr', 't-rx', 't-its'],
    charts: [['x:inv', 'span-12'], ['t-seg', 'span-7 tall'], ['t-seg2', 'span-5 tall'], ['t-matrix', 'span-6 tall'], ['t-heat', 'span-6 tall'], ['t-trend', 'span-8'], ['t-crit', 'span-4'], ['t-pay', 'span-6'], ['t-hp-bu', 'span-6'], ['t-eng', 'span-6'], ['t-reason', 'span-6'], ['t-exits', 'span-7'], ['t-dest', 'span-5'], ['t-table', 'span-12 tall'], ['t-matrix2', 'span-12']] },
  { key: 'suc', label: 'Talent & Succession Risk', icon: 'workspace_premium', title: 'Talent & Succession Risk', sub: 'Critical roles, ready-now cover and key-person risk · SuccessFactors Succession & Development', group: 'g-suc',
    controls: [['g-suc', 'Countries', 'Region'], ['g-suc', 'Countries', 'Country'], ['g-suc', 'Business Units', 'Business Unit'], ['g-suc', 'Seniority', 'Seniority'], ['g-suc', 'Succession', 'Key Person Risk']],
    kpis: ['c-roles', 'c-rn', 'c-unc', 'c-ns', 'c-hfr', 'c-bench'],
    charts: [['c-matrix', 'span-5 tall'], ['c-status', 'span-3 tall'], ['c-bu', 'span-4 tall'], ['c-pipe', 'span-6'], ['c-heat', 'span-6'], ['c-table', 'span-8 tall'], ['c-wom', 'span-4 tall']] },
  { key: 'dei', label: 'Diversity & Inclusion', icon: 'diversity_3', title: 'Diversity, Equity & Inclusion', sub: 'Representation, pay and progression · aggregated, privacy-thresholded (n ≥ 10), role-restricted', group: 'g-dei',
    controls: [['g-dei', 'Countries', 'Region'], ['g-dei', 'Countries', 'Country'], ['g-dei', 'Business Units', 'Business Unit'], ['g-dei', 'Seniority', 'Seniority'], ['g-dei', 'Diversity', 'Gender']],
    kpis: ['d-w', 'd-wl', 'd-gap', 'd-hire', 'd-att', 'd-dis'],
    charts: [['x:privacy', 'span-12'], ['d-pipe', 'span-6'], ['d-heat', 'span-6'], ['d-attg', 'span-6'], ['d-prom', 'span-6'], ['d-pay', 'span-6'], ['d-eth', 'span-6'], ['d-cells', 'span-8 tall'], ['d-age', 'span-4 tall']] },
  { key: 'sk', label: 'Skills & Future Workforce', icon: 'psychology', title: 'Skills & Future Workforce', sub: 'Skills inventory, 2028 capability gaps, adjacency and build · buy · borrow', group: 'g-sk',
    controls: [['g-sk', 'Skills', 'Skill Tier'], ['g-sk', 'Skills', 'Skill Cluster'], ['g-sk', 'Skills', 'Skill'], ['g-sk', 'Business Units', 'Business Unit'], ['g-sk', 'Countries', 'Country']],
    kpis: ['s-cs', 's-ai', 's-cl', 's-gap', 's-adj', 's-ifr'],
    charts: [['s-heat', 'span-7 tall'], ['x:adjx', 'span-5'], ['s-gap28', 'span-6'], ['s-cov', 'span-6'], ['s-sankey', 'span-7 tall'], ['x:bbb', 'span-5'], ['s-country', 'span-6'], ['s-req', 'span-6'], ['s-table', 'span-12 tall'], ['s-reqtbl', 'span-12']] },
  { key: 'sim', label: 'Workforce Simulator', icon: 'tune', title: 'Workforce Simulator', sub: 'Retention interventions and FY28 demand & restructuring plans · see the impact before deciding', group: null, controls: [], kpis: [], charts: [['s-saved', 'span-12']] },
  { key: 'act', label: 'People Actions', icon: 'task_alt', title: 'People Actions', sub: 'Decisions, approvals and interventions — from insight to measurable outcome', group: 'g-act',
    controls: [], kpis: [], charts: [['x:actions', 'span-12'], ['a-log', 'span-12 tall'], ['a-ben', 'span-7 tall'], ['a-type', 'span-5 tall']] },
  { key: 'rb', label: 'Custom report', icon: 'dashboard_customize', title: 'Custom report', sub: 'Pick governed dimensions and measures · drag to reorder · bookmark and share · scoped to your access', group: null, controls: [], kpis: [], charts: [] },
  { sec: 'Knowledge & trust' },
  { key: 'bq', label: 'Question library', icon: 'quiz', title: 'Business question library', sub: 'Stored, governed questions the assistant answers from', group: null, controls: [], kpis: [], charts: [] },
  { key: 'ops', label: 'Data operations', icon: 'monitor_heart', title: 'Data operations', sub: 'Integration monitoring, data refresh status and error management · source to semantic layer', group: 'g-ops',
    controls: [['g-ops', 'Pipeline Runs', 'Stage'], ['g-ops', 'Pipeline Runs', 'Source System'], ['g-ops', 'Pipeline Runs', 'Status']],
    kpis: ['o-sr', 'o-fail', 'o-sla', 'o-rows', 'o-open', 'o-high'],
    charts: [['x:fresh', 'span-12'], ['o-pipes', 'span-12 tall'], ['x:triage', 'span-7'], ['o-daily', 'span-5 tall'], ['o-cat', 'span-6'], ['o-mttr', 'span-6'], ['o-err', 'span-12'], ['o-issues', 'span-12']] },
  { key: 'gov', label: 'Data & governance', icon: 'account_tree', title: 'Data & governance', sub: 'Role-based access · SAP · cloud data lake · Astrato governed semantic layer', group: null, controls: [], kpis: [], charts: [] },
  { key: 'req', label: 'Capability tour', icon: 'checklist', title: 'Capability tour', sub: 'Ten capabilities and where each is shown', group: null, controls: [], kpis: [], charts: [] },
];
export const PAGE_GROUP = Object.fromEntries(PAGES.filter((p) => p.key).map((p) => [p.key, p.group]));

const status = (t) => { (window.__boot ??= []).push([t, Math.round(performance.now())]); const s = document.getElementById('splash-status'); if (s) s.textContent = t; };

const main = async () => {
  status('Signing in to Astrato…');
  const app = await createAstratoApp();
  throttleQueries(app.client.hostServices);
  const { engine, selections } = app.client.hostServices;
  window.__sel = selections;
  const ALL_GROUPS = [...GROUPS, ...TREND_GROUPS, 'g-ask', 'g-inv', 'g-bq', 'g-sim', 'g-rb', 'g-plan'];
  // Filter objects and chart clicks write *pending* selections; apply them at once (no Apply button).
  for (const g of ALL_GROUPS) {
    let timer;
    selections.onActiveSelectionChange(g).subscribe((next) => {
      clearTimeout(timer);
      if (next.pending.length > 0) timer = setTimeout(() => selections.applyPendingSelections(g), 250);
    });
  }
  status('Reading the governed semantic layer…');
  const metadata = await engine.fields.getFieldMetadata({ ...app.dataBinding });
  const runtime = createVisualizationRuntime({ client: app.client, registry });
  const availableFields = createVisualizationAvailableFields(metadata).filter((f) => f?.resultType !== 'unhandled');
  appState.fields(availableFields);
  const dataBinding = { ...app.dataBinding };
  const fields = createFieldIndex(availableFields);
  window.__fields = fields;
  status('Resolving governed objects…');
  const built = buildTiles(fields);
  const failures = [...built.failures];
  if (failures.length) console.warn('[tiles]', JSON.stringify(failures));
  // Objects are compiled and themed lazily, page by page, each against only the fields it references
  // (an ~830-field layer makes whole-catalogue compilation take seconds).
  const tiles = new Map(built.tiles.map((t) => [t.id, { ...t }]));
  const byKey = new Map(availableFields.map((f) => [f.fieldKey, f]));
  const KEY_RE = /\[[^[\]]+\]\.\[[^[\]]+\]/g;
  const pruneFor = (obj) => {
    const keys = new Set(JSON.stringify(obj).match(KEY_RE) ?? []);
    for (const k of [...keys]) {
      const f = byKey.get(k);
      for (const m of f?.item?.calculation?.measures ?? []) for (const fk of m.fieldKeys ?? []) keys.add(fk);
      if (f?.item?.dimension?.fieldKey) keys.add(f.item.dimension.fieldKey);
      if (f?.rawKey) keys.add(f.rawKey);
    }
    return availableFields.filter((f) => keys.has(f.fieldKey));
  };
  const prepared = new Map();
  const CACHE_PREFIX = 'people-vspec-v2:';
  const hashOf = (str) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
  // Drop cache entries from older definitions so the device cache never grows without bound.
  try { const keep = new Set(); for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (k?.startsWith('people-vspec-') && !k.startsWith(CACHE_PREFIX)) localStorage.removeItem(k); } } catch { /* storage unavailable */ }
  const prepare = (t) => {
    if (prepared.has(t.id)) return prepared.get(t.id);
    const job = (async () => {
      const t0 = performance.now();
      // A prepared (compiled + themed) vSpec is cached per device, keyed by a hash of the object's
      // definition and operations, so repeat visits skip the costly compile/theme step entirely.
      const key = `${CACHE_PREFIX}${t.id}:${hashOf(JSON.stringify({ d: t.definition, o: t.ops }))}`;
      try {
        const hit = JSON.parse(localStorage.getItem(key) ?? 'null');
        if (hit?.v) {
          Object.assign(t, { vSpec: hit.v, baseVSpec: hit.v, resolvedRefs: hit.r ?? {} });
          (window.__prep ??= {})[t.id] = [Math.round(t0), 'cache', Math.round(performance.now() - t0)];
          return t;
        }
      } catch { /* storage unavailable */ }
      const af = pruneFor({ d: t.definition, o: t.ops, k: t.fieldKeys });
      let c;
      try { c = await compileDefinition(t.type, t.definition, af); } catch { c = await compileDefinition(t.type, t.definition, availableFields); }
      const t1 = performance.now();
      let themed;
      try { themed = await themeVSpec({ id: t.id, type: t.type, vSpec: c.vSpec, dataBinding }, af, { ...t, ...c }); } catch { themed = await themeVSpec({ id: t.id, type: t.type, vSpec: c.vSpec, dataBinding }, availableFields, { ...t, ...c }); }
      if (themed.failed?.length) (window.__themeFail ??= {})[t.id] = themed.failed;
      Object.assign(t, c, { vSpec: themed.vSpec, baseVSpec: themed.vSpec });
      if (!themed.failed?.length) { try { localStorage.setItem(key, JSON.stringify({ v: themed.vSpec, r: c.resolvedRefs })); } catch { /* quota: skip */ } }
      (window.__prep ??= {})[t.id] = [Math.round(t0), Math.round(t1 - t0), Math.round(performance.now() - t1), af.length];
      return t;
    })();
    prepared.set(t.id, job);
    return job;
  };
  window.__astrato = { tiles: [...tiles.keys()], failures, mounted: {}, errors: {} };
  status('Ready');

  // ------------------------------------------------------------------ persona + governed queries
  let persona = PERSONAS[(() => { try { return localStorage.getItem('people-persona'); } catch { return null; } })()] ?? PERSONAS.chro;
  const personaListeners = [];
  const personaNow = []; // cheap, immediate reactions (greeting, labels) before any re-query
  const scopeOf = (scopeKind = 'all') => (scopeKind === 'none' ? [] : persona.scope.filter(([f]) => scopeKind !== 'bu' || f === 'Business Unit'));
  const rawKey = (name, view) => fields.raw(name, view)?.fieldKey;

  /** A governed engine query. filters: [[field, view, values]]; persona scope added unless scope === 'none'.
   *  selections: applied selections of a group (as appliedOf returns them), passed to the engine as they are:
   *  a governed item's key as itemKey, a view column's key as field.fieldKey. */
  const q = async ({ dims = [], measures = [], limit = 500, filters = [], selections: sels = [], scope = 'all' }) => {
    const dimensions = dims.map(([name, view]) => ({ fieldKey: rawKey(name, view), name }));
    const missingD = dimensions.find((d) => !d.fieldKey);
    if (missingD) throw new Error(`dimension ${missingD.name} not in layer`);
    const calculations = measures.map((name) => { const f = fields.measure(name); if (!f) throw new Error(`measure "${name}" not in layer`); return { calculation: '{m1}', itemKey: f.fieldKey, label: name }; });
    const all = [...scopeOf(scope), ...filters];
    const selFilter = (x) => {
      const fk = x.field?.fieldKey ?? x.fieldKey;
      const kind = fields.all.find((f) => f.fieldKey === fk)?.kind;
      return { ...(kind && kind !== 'field' ? { itemKey: fk } : { field: { fieldKey: fk } }), operator: x.operator ?? 'inList', values: x.values };
    };
    const query = { dimensions, calculations, orders: [], limit, offset: 0, filters: [...all.map(([f, v, values]) => ({ field: { fieldKey: rawKey(f, v) }, operator: 'inList', values: values.map(String) })), ...sels.map(selFilter)], totals: false, showRecordsCount: false, outerViews: [], associativeListFilter: null };
    const { response } = await engine.getData({ ...dataBinding, query });
    const names = [...dimensions.map((d) => d.name), ...measures];
    return Object.values(response?.data ?? {}).map((row) => Object.fromEntries(names.map((n, i) => [n, row[i]])));
  };
  window.__q = q;

  // ------------------------------------------------------------------ shell
  const root = document.getElementById('root');
  const navList = el('div', { class: 'pi-navlist' });
  const personaSel = el('select', { 'aria-label': 'Switch persona' }, Object.values(PERSONAS).map((p) => el('option', { value: p.key, text: `${p.role.split(' · ')[0]} — ${p.name}` })));
  personaSel.value = persona.key;
  const personaWho = el('div', { class: 'who' });
  const personaScope = el('div', { class: 'scope' });
  const nav = el('aside', { class: 'pi-nav' }, [
    el('div', { class: 'pi-brand' }, [el('img', { src: './mark.svg', alt: '' }), el('div', {}, [el('b', { text: 'People Intelligence' }), el('span', { text: 'Group HR' })])]),
    navList,
    el('div', { class: 'pi-persona' }, [el('label', { text: 'Viewing as' }), personaWho, personaSel, personaScope]),
    el('div', { class: 'pi-made' }, [el('div', { text: 'MADE WITH' }), el('div', { class: 'row' }, [el('b', { text: 'Google BigQuery', style: 'font-size:11px;color:#4B5563' }), el('span', { class: 'plus', text: '+' }), el('img', { src: './astrato-logo.svg', alt: 'Astrato', style: 'height:15px' })])]),
  ]);
  const title = el('h1');
  const sub = el('div', { class: 'sub' });
  const exportBtn = el('button', { class: 'pi-btn hide-sm', title: 'Export the executive summary and scorecards to a formatted Excel workbook' }, [icon('download'), el('span', { text: 'Export' })]);
  const askBtn = el('button', { class: 'pi-ask-btn' }, [icon('auto_awesome'), el('span', { text: 'Ask People Intelligence' })]);
  const burger = el('button', { class: 'pi-btn ghost pi-burger', onclick: () => nav.classList.toggle('open') }, [icon('menu')]);
  const top = el('header', { class: 'pi-top' }, [burger, el('div', { style: 'min-width:0' }, [title, sub]), el('div', { class: 'sp' }),
    el('span', { class: 'pi-badge demo', title: 'Synthetic demonstration dataset. Not figures of any real company.' }, [el('i'), el('span', { text: 'Illustrative data · as of 30 Sep 2026' })]),
    el('span', { class: 'pi-badge hide-sm', title: 'Every number comes from the published, governed Astrato semantic layer' }, [el('i'), el('span', { text: 'Governed · live query' })]), exportBtn, askBtn]);
  const selBar = el('div', { class: 'pi-selbar' });
  const body = el('div', { class: 'pi-body' });
  const toasts = el('div', { class: 'pi-toasts' });
  const SHORT = { home: 'Home', wx: 'Explore', tr: 'Retention', sk: 'Skills', sim: 'Simulate', act: 'Actions' };
  const tabbar = el('nav', { class: 'pi-tabbar', 'aria-label': 'Sections' }, Object.entries(SHORT).map(([k, l]) => el('button', { 'data-page': k, onclick: () => go(k) }, [icon(PAGES.find((p) => p.key === k).icon), el('span', { text: l })])));
  const fab = el('button', { class: 'pi-fab', 'aria-label': 'Ask People Intelligence', onclick: () => ctx.assistant.open() }, icon('auto_awesome'));
  root.replaceChildren(el('div', { class: 'pi-app' }, [nav, el('main', { class: 'pi-main' }, [top, selBar, body])]), tabbar, fab, toasts);

  const toast = (msg, ic = 'check_circle') => { const t = el('div', { class: 'pi-toast' }, [icon(ic), el('span', { html: msg })]); toasts.append(t); setTimeout(() => t.remove(), 3800); };

  // ------------------------------------------------------------------ cards and slots
  const mountQueue = [];
  const slotFor = (id) => { const s = el('div', { class: 'viz loading', 'data-slot': id }); mountQueue.push([id, s]); return s; };
  const kpiCard = (id, cls = '') => {
    const k = KPIS[id] ?? {};
    const bench = el('div', { class: 'bench', 'data-bench': id, text: k.note ?? '' });
    const card = el('figure', { class: `pi-kpi ${k.drill ? 'drill' : ''} ${cls}`, title: [id, `${id}-sp`, `${id}-d`].filter((x) => tiles.has(x)).map((x) => `BQ · ${questionOf(tiles.get(x))}`).join('\n') }, [
      el('div', { class: 'lbl' }, [el('span', { text: k.label ?? id }), k.drill ? icon('arrow_forward') : null]),
      el('div', { class: 'row' }, [el('div', { class: 'num' }, tiles.has(id) ? slotFor(id) : null), el('div', { class: 'spark' }, tiles.has(`${id}-sp`) ? slotFor(`${id}-sp`) : null)]),
      tiles.has(`${id}-d`) ? el('div', { class: 'delta' }, slotFor(`${id}-d`)) : null,
      bench,
    ]);
    if (k.drill) card.addEventListener('click', () => go(k.drill));
    return card;
  };
  const switchers = new Map();
  const restricted = new Map(); // tile id → card; tiles a persona is not cleared for are never mounted, so never queried
  const allowedFor = (t, p = persona) => !t.restrict || t.restrict.includes(p.key);
  const chartCard = (id, cls) => {
    const t = tiles.get(id);
    if (!t) return el('figure', { class: `pi-card ${cls}` }, [el('figcaption', { text: id }), el('p', { class: 'pi-note', text: 'Not available in this layer.' })]);
    const tools = el('div', { class: 'tools' });
    const crumbs = t.drill ? el('div', { class: 'pi-crumbs' }) : null;
    const cap = el('figcaption', { class: 'pi-cap' }, [el('span', { class: 't', text: t.title }), tools]);
    const lock = t.restrict ? el('div', { class: 'pi-lock' }, [icon('lock'), el('b', { text: 'Restricted for your role' }), el('p', { text: t.restrictWhy ?? 'Not available for this role.' })]) : null;
    const card = el('figure', { class: `pi-card ${cls}` }, [cap, el('div', { class: 'pi-bq', title: 'Stored business question in the governed semantic layer' }, [icon('verified'), el('span', { text: questionOf(t) })]), crumbs, slotFor(id), lock]);
    if (lock) restricted.set(id, card);
    if (t.switch) switchers.set(id, { tools, crumbs, cap });
    return card;
  };

  const panes = {}; const customHosts = {};
  for (const p of PAGES) {
    if (p.sec) { navList.append(el('div', { class: 'sec', text: p.sec })); continue; }
    const pane = el('section', { class: 'pi-pane', 'data-page': p.key });
    const head = el('div', { class: 'pi-head' });
    const filters = p.controls.length ? el('div', { class: 'pi-filters' }, p.controls.map(([g, v, n]) => {
      const id = ctlId(g, v, n);
      return tiles.has(id) ? el('figure', { class: 'pi-filter' }, [el('figcaption', { text: tiles.get(id).title }), slotFor(id)]) : null;
    })) : null;
    const kpis = p.kpis.length ? el('div', { class: 'pi-kpis' }, p.kpis.map((k) => kpiCard(k))) : null;
    const grid = el('div', { class: 'pi-grid' }, p.charts.map(([id, cls]) => {
      if (id.startsWith('x:')) { const host = el('figure', { class: `pi-card ${cls}` }); customHosts[id.slice(2)] = host; return host; }
      return chartCard(id, cls);
    }));
    pane.append(head, ...(filters ? [filters] : []), ...(kpis ? [kpis] : []), grid);
    panes[p.key] = { pane, head, grid, page: p };
    body.append(pane);
    navList.append(el('button', { 'data-page': p.key, onclick: () => { go(p.key); nav.classList.remove('open'); } }, [icon(p.icon), el('span', { text: p.label }), p.key === 'act' ? el('span', { class: 'num', 'data-count': 'act', text: '' }) : null]));
  }
  // Home: hero, KPI cards and briefing go above the chart grid.
  const homeKpis = el('div', { class: 'pi-kpis hero' }, ['h-hc', 'h-va', 'h-cs', 'h-cb'].map((k) => kpiCard(k)));
  panes.home.head.append(homeKpis);
  // Smoke-test contract: every object this persona may see, on the page that holds it.
  for (const [id, s] of mountQueue) if (tiles.has(id) && allowedFor(tiles.get(id))) appState.declare(id, s.closest('section[data-page]')?.dataset.page ?? null);

  // ------------------------------------------------------------------ navigation + selection bar
  let current = 'home';
  let mountPage = null; // assigned once mounting is set up; navigation then pulls a page forward
  const labelOf = (fk) => fields.nameOf?.(fk)?.replace(/^.*\]\.\[|\]$/g, '') ?? String(fk).match(/\[([^\]]+)\]$/)?.[1] ?? fk;
  const selListeners = [];
  const renderSelBar = () => {
    const g = PAGE_GROUP[current];
    const scopeChip = el('span', { class: 'scope', title: 'Persona access scope — applied to every object and query on every page' }, [icon('lock'), el('span', { text: persona.scopeLabel })]);
    if (!g) { selBar.replaceChildren(el('b', { text: 'Scope' }), scopeChip); return; }
    const { applied = [], pending = [] } = selections.getSelection(g) ?? {};
    const list = [...applied, ...pending].filter((x) => x.values?.length);
    selBar.replaceChildren(el('b', { text: 'Scope' }), scopeChip, el('b', { text: 'Selections', style: 'margin-left:8px' }),
      ...(list.length ? list.map((x) => el('span', { class: 'pi-chip' }, [el('i', { text: labelOf(x.field?.fieldKey ?? x.fieldKey) }), document.createTextNode(x.values.slice(0, 4).join(', ') + (x.values.length > 4 ? ` +${x.values.length - 4}` : '')),
        el('button', { text: '×', title: 'Remove this selection', onclick: () => selections.removeSelection(g, x) })]))
        : [el('span', { class: 'none', text: 'None — click any bar, cell, point or row, or use the filters.' })]),
      ...(list.length ? [el('button', { class: 'clear', text: 'Clear all', onclick: () => selections.clearAllSelections(g) })] : []),
      ...(current === 'tr' && list.length ? [el('button', { class: 'pi-btn sm inv', onclick: () => investigateFromSelection() }, [icon('biotech'), el('span', { text: 'Investigate this segment' })])] : []));
  };
  for (const g of GROUPS) selections.onActiveSelectionChange(g).subscribe((s) => { if (PAGE_GROUP[current] === g) renderSelBar(); for (const f of selListeners) f(g, s); });
  const navListeners = [];
  const go = (key, opts = {}) => {
    if (!panes[key]) return;
    for (const [k, p] of Object.entries(panes)) p.pane.hidden = k !== key;
    for (const b of [...navList.querySelectorAll('button[data-page]'), ...tabbar.querySelectorAll('button')]) b.classList.toggle('on', b.dataset.page === key);
    const p = panes[key].page;
    title.textContent = p.title; sub.textContent = p.sub;
    current = key; renderSelBar(); document.body.dataset.view = key;
    window.scrollTo({ top: 0, behavior: opts.smooth === false ? 'auto' : 'smooth' });
    mountPage?.(key);
    for (const f of navListeners) f(key, opts);
    try { if (!(key === 'rb' && location.hash.startsWith('#rb='))) history.replaceState(null, '', `#${key}`); } catch { /* sandboxed */ }
  };
  window.__go = go;

  /** Narrow a page: set its group's applied selection on one view column (replacing that column's selection). */
  const select = (g, name, view, values) => {
    const fk = rawKey(name, view);
    if (!fk) return;
    const { applied = [] } = selections.getSelection(g) ?? {};
    const keep = applied.filter((x) => (x.field?.fieldKey ?? x.fieldKey) !== fk);
    selections.setNewSelectionState(g, { applied: [...keep, ...(values?.length ? [{ field: { fieldKey: fk }, fieldKey: fk, kind: 'VALUE', operator: 'inList', values }] : [])], pending: [] });
  };
  const appliedOf = (g) => (selections.getSelection(g)?.applied ?? []).filter((x) => x.values?.length);
  const valuesOf = (g, name, view) => { const fk = rawKey(name, view); return appliedOf(g).find((x) => (x.field?.fieldKey ?? x.fieldKey) === fk)?.values ?? []; };

  // ------------------------------------------------------------------ static filters: persona scope + selection mirror
  const isMeasureOnly = (t) => t.type === 'number' || (t.type === 'table' && !(t.fieldKeys ?? []).length);
  const scopeFilters = (t) => scopeOf(t.scope ?? 'all').map(([f, v, values]) => staticFilter({ fieldKey: rawKey(f, v), values }));
  // KPI static-filter mirror. Off: on visualizations 0.9 selections reach measure-only objects
  // without it (tested by the selection checks in checks.js). Kept switchable for older runtimes.
  const MIRROR_SELECTIONS = false;
  const selFilters = (t) => (MIRROR_SELECTIONS && isMeasureOnly(t) ? appliedOf(t.group).map((x) => staticFilter({ fieldKey: x.field?.fieldKey ?? x.fieldKey, values: x.values })) : []);
  const runs = new Map();
  const isMounted = (id) => runtime.listInstances().some((i) => i.id === id);
  /** Recompute one object's static filter group from its own filters, the persona scope and (measure-only objects) its page selections. */
  const refilter = async (t, { update = true } = {}) => {
    if (t.type === 'filter' || !t.baseVSpec) return t.vSpec;
    const run = (runs.get(t.id) ?? 0) + 1; runs.set(t.id, run);
    const extra = [...scopeFilters(t), ...selFilters(t)];
    const vSpec = extra.length
      ? (await applyEach({ id: t.id, type: t.type, vSpec: t.baseVSpec, dataBinding }, availableFields, t.type, [{ name: 'setStaticFilterGroup', payload: { operator: 'and', filters: [...(t.ownFilters ?? []), ...extra] } }])).vSpec
      : t.baseVSpec;
    if (runs.get(t.id) !== run) return t.vSpec;
    t.vSpec = t.map ? withExtent(vSpec, t.ext ?? EXTENT.world) : vSpec;
    if (update && isMounted(t.id)) runtime.updateInstance(t.id, { vSpec: t.vSpec });
    return t.vSpec;
  };
  // Measure-only objects follow their page selections; trend twins mirror the page group.
  for (const g of GROUPS) {
    let sig = '[]';
    selections.onActiveSelectionChange(g).subscribe((next) => {
      const applied = next.applied.filter((x) => x.values?.length);
      const nextSig = JSON.stringify(applied.map((x) => [x.field?.fieldKey ?? x.fieldKey, x.values]));
      if (nextSig === sig) return;
      sig = nextSig;
      selections.setNewSelectionState(`${g}-t`, { applied: next.applied, pending: [] });
      for (const t of tiles.values()) if (t.group === g && isMeasureOnly(t)) refilter(t);
    });
  }

  // ------------------------------------------------------------------ the workforce map
  const EXTENT = { world: { lon: [-14, 82], lat: [-36, 62] } };
  const basemaps = new Map();
  const withExtent = (vSpec, ext) => {
    const axes = vSpec.axes ?? {};
    const range = (r) => ({ axisRangeOption: 'minmax', minValue: r[0], maxValue: r[1] });
    return { ...vSpec, axes: { ...axes, primaryMeasure: { ...axes.primaryMeasure, axisRange: range(ext.lon) }, secondaryMeasure: { ...axes.secondaryMeasure, axisRange: range(ext.lat) } } };
  };
  const trueScale = (slot, ext) => {
    const r = slot && plotRect(slot, slot.parentElement);
    if (!r) return ext;
    const [w, e] = ext.lon, [s0, n] = ext.lat;
    const k = Math.cos((((s0 + n) / 2) * Math.PI) / 180);
    const want = r.width / r.height;
    if (((e - w) * k) / (n - s0) < want) { const half = (want * (n - s0)) / k / 2, c = (w + e) / 2; return { lon: [c - half, c + half], lat: [s0, n] }; }
    const half = ((e - w) * k) / want / 2, c = (s0 + n) / 2;
    return { lon: [w, e], lat: [c - half, c + half] };
  };
  const fitMap = (id) => {
    const t = tiles.get(id), slot = body.querySelector(`[data-slot="${id}"]`);
    if (!t || !slot) return;
    t.ext = trueScale(slot, EXTENT.world);
    t.vSpec = withExtent(t.vSpec, t.ext);
    runtime.updateInstance(id, { vSpec: t.vSpec });
    basemaps.get(id)?.setExtent(t.ext);
  };

  // ------------------------------------------------------------------ switchers + drill-down
  const rebuild = async (t, { dims: newDims, measures, formats, extra = {} }) => {
    const def = { ...t.def };
    if (newDims) def.dimensions = newDims.map(([name, view], i) => ({ name, view, ref: def.dimensions[i]?.ref ?? `d${i}` }));
    if (measures) {
      def.measures = measures.map((name, i) => ({ name, ref: `m${i}`, format: { formatType: 'numberNoDecimal' } }));
      const keepOps = (t.def.ops ?? []).filter((o) => !/^setMeasureFormat|changeMeasureAxis|setMeasureGraphColor|setColoringType/.test(o.name));
      def.ops = [...keepOps, ...measures.flatMap((_, i) => measFormat(`m${i}`, formats?.[i] ?? '#,##0')), ...(extra.secondary ? [secondary(extra.secondary)] : t.type === 'combo' && measures.length === 2 && formats?.[0] !== formats?.[1] ? [secondary('m1')] : []),
        ...(t.type === 'combo' ? perMeasure(Object.fromEntries(measures.map((_, i) => [`m${i}`, [t.id === 'x-trend' || t.id === 'x-cost' ? '#D5D5D5' : C.ink, C.red, C.aqua, C.mid][i] ?? SERIES[i]]))) : [])];
      if (def.dataLabels) def.dataLabels = { ...def.dataLabels, format: formats?.[0] ?? def.dataLabels.format };
      if (extra.graphTypes) def.graphTypes = extra.graphTypes;
      if (extra.gradient) def.gradient = extra.gradient;
    }
    const out = buildTile(def, fields);
    if (out.failure) { toast(`Cannot switch: ${esc(out.failure.reason)}`, 'error'); return; }
    const c = await compileDefinition(def.type, out.tile.definition, availableFields);
    const themed = await themeVSpec({ id: t.id, type: def.type, vSpec: c.vSpec, dataBinding }, availableFields, { ...out.tile, ...c });
    Object.assign(t, { def, baseVSpec: themed.vSpec, ownFilters: out.tile.ownFilters, fieldKeys: out.tile.fieldKeys, resolvedRefs: c.resolvedRefs });
    await refilter(t);
  };
  const CATALOGUE = new Map(tileCatalogue().map((t) => [t.id, t]));
  for (const t of tiles.values()) t.def = CATALOGUE.get(t.id);

  const drillState = new Map();
  for (const [id, { tools, crumbs }] of switchers) {
    const t = tiles.get(id);
    const sw = t.switch;
    t.dimIdx = sw.dimIndex ?? 0;
    if (sw.measures) {
      const s = el('select', { class: 'pi-select', 'aria-label': 'Measure' }, sw.measures.map(([label], i) => el('option', { value: i, text: label })));
      s.addEventListener('change', () => { const [label, ms, f, extra = {}] = sw.measures[s.value]; t.measIdx = Number(s.value); updateTitle(t); rebuild(t, { measures: ms, formats: f, extra }); });
      tools.append(s);
    }
    if (sw.dims) {
      const s = el('select', { class: 'pi-select', 'aria-label': 'Dimension' }, sw.dims.map(([label], i) => el('option', { value: i, text: label })));
      s.value = t.dimIdx;
      s.addEventListener('change', () => { t.dimIdx = Number(s.value); const [, name, view] = sw.dims[t.dimIdx]; const d = [...t.def.dimensions.map((x) => [x.name, x.view])]; d[sw.dimIndex ?? 0] = [name, view]; drillState.set(id, null); renderCrumbs(t); rebuild(t, { dims: d }); });
      tools.append(s);
      t.dimSelect = s;
    }
    if (t.drill) renderCrumbs(t);
  }
  function updateTitle(t) { /* captions carry the business question; the selects show the variant */ }
  function renderCrumbs(t) {
    const host = switchers.get(t.id)?.crumbs;
    if (!host) return;
    const cur = t.def.dimensions[0];
    const path = drillState.get(t.id) ?? [];
    host.replaceChildren(icon('account_tree'),
      ...path.flatMap((step, i) => [el('button', { text: `${step.name}: ${step.value}`, title: 'Step back up to this level', onclick: () => drillUp(t, i) }), el('span', { text: '›' })]),
      el('span', { class: 'cur', text: cur.name }),
      el('span', { class: 'hint', text: t.drill.findIndex(([n]) => n === cur.name) < t.drill.length - 1 ? ' · click a bar to drill down' : ' · lowest level' }));
  }
  const drillUp = (t, i) => {
    const path = drillState.get(t.id) ?? [];
    const g = t.group;
    for (const step of path.slice(i)) select(g, step.name, step.view, []);
    drillState.set(t.id, path.slice(0, i));
    const target = path[i];
    rebuild(t, { dims: [[target.name, target.view]] }).then(() => renderCrumbs(t));
  };
  // A single value selected on a drill tile's current level → step the tile down one level.
  selListeners.push((g) => {
    for (const t of tiles.values()) {
      if (!t.drill || t.group !== g) continue;
      const cur = t.def.dimensions[0];
      const vals = valuesOf(g, cur.name, cur.view);
      const at = t.drill.findIndex(([n]) => n === cur.name);
      if (vals.length !== 1 || at < 0 || at >= t.drill.length - 1) continue;
      const [nn, nv] = t.drill[at + 1];
      drillState.set(t.id, [...(drillState.get(t.id) ?? []), { name: cur.name, view: cur.view, value: vals[0] }]);
      if (t.dimSelect) { const idx = t.switch.dims.findIndex(([, n]) => n === nn); if (idx >= 0) t.dimSelect.value = idx; }
      rebuild(t, { dims: [[nn, nv]] }).then(() => renderCrumbs(t));
    }
  });

  // ------------------------------------------------------------------ mounting (current page first, then every page in the background)
  const fitTable = async (t, width) => {
    if (!t.fitColumns || width < 40) return t.baseVSpec;
    const requests = fitColumnOps(t.resolvedRefs, t.fitColumns, width);
    return (await applyEach({ id: t.id, type: t.type, vSpec: t.baseVSpec, dataBinding }, availableFields, t.type, requests)).vSpec;
  };
  const mark = (id, st, slot) => { appState.settle(id, st, st); window.__astrato.mounted[id] = st; if (st !== 'rendered') window.__astrato.errors[id] = st; slot?.classList.remove('loading'); };
  go(location.hash.startsWith('#rb=') ? 'rb' : location.hash.slice(1) in panes ? location.hash.slice(1) : 'home', { smooth: false });
  // Measure every slot while all panes are laid out (hidden panes keep their width).
  const slotWidth = new Map(mountQueue.map(([id, s]) => [id, s.clientWidth]));
  // Tables size their columns to the card: refit (in place, no remount) when the card's width changes.
  const fittedAt = new Map();
  const refit = new ResizeObserver((entries) => {
    for (const e of entries) {
      const id = e.target.dataset.slot, t = tiles.get(id), w = Math.round(e.contentRect.width);
      if (!t?.fitColumns || w < 40 || Math.abs(w - (fittedAt.get(id) ?? 0)) <= 24) continue;
      clearTimeout(e.target.fitTimer);
      e.target.fitTimer = setTimeout(async () => {
        if (!t.unfitVSpec) return;
        fittedAt.set(id, w);
        t.baseVSpec = await fitTable({ ...t, baseVSpec: t.unfitVSpec }, w);
        await refilter(t);
      }, 250);
    }
  });
  const mountOne = async (id, slot) => {
    const t = tiles.get(id);
    if (!t) return;
    if (restricted.has(id)) restricted.get(id).classList.toggle('locked', !allowedFor(t));
    if (!allowedFor(t)) { slot.classList.remove('loading'); window.__astrato.mounted[id] = 'restricted'; return; }
    try { await prepare(t); } catch (e) { mark(id, `compile: ${e?.message ?? e}`, slot); return; }
    if (t.fitColumns) { t.unfitVSpec = t.baseVSpec; const w = slot.clientWidth || slotWidth.get(id); fittedAt.set(id, w); t.baseVSpec = await fitTable(t, w); refit.observe(slot); }
    await refilter(t, { update: false });
    if (t.map) { const b = attachBasemap(slot); b.setExtent(EXTENT.world); basemaps.set(id, b); t.vSpec = withExtent(t.vSpec, EXTENT.world); }
    runtime.createInstance({ id, type: t.type, groupId: t.group, vSpec: t.vSpec, dataBinding });
    (window.__mt ??= {})[id] = Math.round(performance.now());
    return runtime.mount(slot, id).then((h) => h.ready).then((r) => { window.__mt[id] = [window.__mt[id], Math.round(performance.now())]; mark(id, r?.status, slot); if (t.map) setTimeout(() => fitMap(id), 500); }).catch((e) => mark(id, String(e), slot));
  };
  const pageOfSlot = (slot) => slot.closest('[data-page]')?.dataset.page;
  // Fast boot: only the opening page is compiled, themed, queried and mounted first. Once it has
  // rendered (and the browser is idle) the other pages load one at a time in the background; a page
  // the reader opens before then jumps the queue. Feature modules defer their own queries the same way.
  const pageMounts = new Map();
  const pageHooks = {};
  mountPage = (key) => {
    if (pageMounts.has(key)) return pageMounts.get(key);
    const job = Promise.allSettled(mountQueue.filter(([, s]) => pageOfSlot(s) === key).map(([id, s]) => mountOne(id, s)));
    pageMounts.set(key, job);
    for (const f of pageHooks[key] ?? []) f();
    delete pageHooks[key];
    return job;
  };
  const onPageMount = (key, f) => { if (pageMounts.has(key)) f(); else (pageHooks[key] ??= []).push(f); };
  const firstPage = current;
  const first = mountPage(firstPage);
  document.getElementById('splash')?.classList.add('gone');
  setTimeout(() => document.getElementById('splash')?.remove(), 600);
  const idle = () => new Promise((r) => (window.requestIdleCallback ? requestIdleCallback(() => r(), { timeout: 1500 }) : setTimeout(r, 400)));
  first.then(async () => {
    status('First page ready');
    appState.mark('landing-ready');
    await idle();
    for (const p of PAGES.filter((x) => x.key && x.key !== firstPage)) { await mountPage(p.key); await idle(); }
    status('All pages ready');
  });

  // ------------------------------------------------------------------ ad-hoc native objects (assistant, investigation, simulator, library)
  let adhoc = 0;
  /**
   * spec: { title, type, dims: [[name, view]], measures: [name], formats?, filters?: [[field, view, values]], sort?, limit?, colors?, graphTypes?, secondary?, legend?, stacked?, orientation?, miniChart?, columnLabels?, scope? }
   * Builds, compiles and themes a native governed object exactly like the catalogue does.
   */
  const renderTile = async (spec, slot, { group = 'g-ask' } = {}) => {
    const id = `adhoc-${++adhoc}`;
    slot.dataset.slot = id; slot.classList.add('viz', 'loading');
    const type = spec.type;
    const tile = adhocTile(id, spec, { group, scope: scopeOf(spec.scope ?? 'all') });
    const out = buildTile(tile, fields);
    if (out.failure) { slot.classList.remove('loading'); slot.textContent = out.failure.reason; return null; }
    const c = await compileDefinition(type, out.tile.definition, availableFields);
    let vSpec = (await themeVSpec({ id, type, vSpec: c.vSpec, dataBinding }, availableFields, { ...out.tile, ...c })).vSpec;
    if (type === 'table' && !spec.pivotCols) {
      const refs = [...tile.dimensions, ...tile.measures].map((x) => x.ref);
      vSpec = await fitTable({ ...out.tile, ...c, baseVSpec: vSpec, fitColumns: Object.fromEntries(refs.map((r) => [r, 0.98 / refs.length])) }, slot.clientWidth || 440);
    }
    runtime.createInstance({ id, type, groupId: group, vSpec, dataBinding });
    const h = await runtime.mount(slot, id);
    const r = await h?.ready;
    mark(id, r?.status, slot);
    return id;
  };
  const dropTile = (id) => { try { runtime.removeInstance?.(id); } catch { /* already gone */ } };

  // ------------------------------------------------------------------ writeback (Astrato App → semantic layer → Snowflake)
  const canWrite = () => typeof app.writeback === 'function' && (app.context?.capabilities ?? []).includes('data:writeback');
  /** Insert rows into a layer view's table. fields: [[fieldName, 'string'|'number']]; rows: arrays in field order. */
  const writeback = async (view, fieldList, rows) => {
    if (!canWrite()) return { written: false, error: 'writeback is not available in this runtime' };
    try {
      await app.writeback({ view, operation: 'insert', fields: fieldList.map(([name, valueType]) => ({ name, valueType })), values: toSource(rows) });
      return { written: true };
    } catch (e) { console.warn('[writeback]', e); return { written: false, error: e?.message ?? String(e) }; }
  };
  /** Rows changed under a mounted object: nudge its query limit so it asks the warehouse again. */
  const requery = (id) => {
    const t = tiles.get(id);
    if (!t?.vSpec || !isMounted(id)) return;
    const qs = t.vSpec.querySettings ?? {};
    const lim = qs.limitQuery ?? 100;
    t.vSpec = { ...t.vSpec, querySettings: { ...qs, limitQuery: lim % 2 ? lim + 1 : lim - 1 } };
    runtime.updateInstance(id, { vSpec: t.vSpec });
  };

  // ------------------------------------------------------------------ shared context for the feature modules
  const ctx = {
    writeback, canWrite, requery,
    app, q, fields, tiles, runtime, selections, renderTile, dropTile, go, select, valuesOf, appliedOf, toast, el, esc, icon, fmtM, gbp, pct, int, formatWith,
    get persona() { return persona; }, personas: PERSONAS, scopeOf, panes, customHosts, VIEWS_OF,
    onPersona: (f) => personaListeners.push(f), onPersonaNow: (f) => personaNow.push(f), onNav: (f) => navListeners.push(f), onSelection: (f) => selListeners.push(f),
    get current() { return current; },
    onPageMount,
  };
  window.__ctx = ctx;
  ctx.actions = actionStore(ctx);
  ctx.assistant = mountAssistant(ctx);
  askBtn.addEventListener('click', () => ctx.assistant.open());
  const investigation = mountInvestigation(ctx, customHosts.inv);
  ctx.openInvestigation = (pop) => { go('tr'); investigation.open(pop); };
  const investigateFromSelection = () => {
    const pop = { country: valuesOf('g-tr', 'Country', 'Countries')[0], bu: valuesOf('g-tr', 'Business Unit', 'Business Units')[0], dept: valuesOf('g-tr', 'Department', 'Departments')[0] };
    if (!pop.country && !pop.bu && !pop.dept) { toast('Select a business unit, country or department first.', 'info'); return; }
    investigation.open(pop);
  };
  // Clicking a business unit on the risk matrix, a heatmap cell or a scorecard row opens the investigation.
  let lastInv = '';
  selListeners.push((g) => {
    if (g !== 'g-tr') return;
    const pop = { country: valuesOf('g-tr', 'Country', 'Countries'), bu: valuesOf('g-tr', 'Business Unit', 'Business Units') };
    const sig = JSON.stringify(pop);
    if (sig === lastInv) return;
    lastInv = sig;
    if (pop.bu.length === 1 && pop.country.length <= 1) investigation.open({ bu: pop.bu[0], country: pop.country[0] });
  });
  ctx.simulator = mountSimulator(ctx, panes.sim.grid);
  ctx.openSimulator = (pop, preset) => { go('sim'); ctx.simMode?.('ret'); ctx.simulator.open(pop, preset); };
  mountActions(ctx, customHosts.actions);
  mountExplain(ctx, customHosts.explain);
  mountHome(ctx, { pane: panes.home, kpis: homeKpis });
  mountLibrary(ctx, panes.bq.grid);
  mountGovernance(ctx, panes.gov.grid);
  mountAccess(ctx, panes.gov.grid);
  mountPrivacy(ctx, customHosts.privacy);
  // Workforce Simulator: the retention intervention and the FY28 demand & restructuring plan, one at a time.
  for (const c of panes.sim.grid.children) c.dataset.mode ??= 'ret';
  ctx.plan = mountPlan(ctx, panes.sim.grid);
  const simTabs = el('div', { class: 'pi-modes', role: 'tablist' });
  const simMode = (m) => {
    for (const c of panes.sim.grid.children) c.hidden = (c.dataset.mode ?? 'ret') !== m;
    for (const b of simTabs.children) b.classList.toggle('on', b.dataset.m === m);
  };
  simTabs.append(...[['ret', 'Retention intervention', 'healing'], ['plan', 'Demand & restructuring plan', 'account_tree']].map(([m, l, ic]) => el('button', { 'data-m': m, onclick: () => simMode(m) }, [icon(ic), el('span', { text: l })])));
  panes.sim.head.append(simTabs);
  simMode('ret');
  ctx.simMode = simMode;
  ctx.customReport = mountBuilder(ctx, panes.rb.grid);
  const dataStatus = el('div', { class: 'pi-datastatus-host' });
  panes.home.head.append(dataStatus);
  ctx.dataops = mountDataOps(ctx, { fresh: customHosts.fresh, triage: customHosts.triage, homeHost: dataStatus });
  mountCoverage(ctx, panes.req.grid);
  mountSkillsPanels(ctx, { adjx: customHosts.adjx, bbb: customHosts.bbb });
  exportBtn.addEventListener('click', () => exportWorkbook(ctx, exportBtn));

  // ------------------------------------------------------------------ persona switching
  const renderPersona = () => {
    personaWho.replaceChildren(el('div', { class: 'pi-avatar', text: persona.initials }), el('div', {}, [el('b', { text: persona.name }), el('span', { text: persona.role })]));
    personaScope.replaceChildren(icon('lock'), el('span', { text: `Access: ${persona.scopeLabel}. Aggregated analytics only — no individual risk scores.` }));
  };
  renderPersona();
  personaSel.addEventListener('change', async () => {
    persona = PERSONAS[personaSel.value];
    try { localStorage.setItem('people-persona', persona.key); } catch { /* private window */ }
    renderPersona(); renderSelBar();
    toast(`Now viewing as <b>${esc(persona.name)}</b> · ${esc(persona.scopeLabel)}`, 'switch_account');
    // The page on screen re-scopes first; the greeting, briefing and every other page follow.
    const all = [...tiles.values()].filter((t) => t.type !== 'filter');
    const onScreen = all.filter((t) => t.page === current);
    for (const f of personaNow) f(persona);
    // Tiles a persona is not cleared for are unmounted and locked; newly cleared ones mount.
    for (const [id, card] of restricted) {
      const t = tiles.get(id), ok = allowedFor(t), slot = card.querySelector(`[data-slot="${id}"]`);
      card.classList.toggle('locked', !ok);
      if (!ok && isMounted(id)) { try { runtime.removeInstance?.(id); } catch { /* gone */ } slot?.replaceChildren(); window.__astrato.mounted[id] = 'restricted'; }
      if (ok && !isMounted(id) && pageMounts.has(t.page) && slot) mountOne(id, slot);
    }
    await Promise.all(onScreen.filter((t) => allowedFor(t)).map((t) => refilter(t)));
    for (const f of personaListeners) f(persona);
    for (const t of all.filter((x) => x.page !== current && allowedFor(x))) await refilter(t);
  });
  const counts = () => { const n = ctx.actions.pendingFor(persona); const b = navList.querySelector('[data-count=act]'); if (b) { b.textContent = n || ''; b.hidden = !n; } };
  ctx.actions.onChange(counts); ctx.onPersona(counts); counts();
  ctx.setPersona = (key) => { if (!PERSONAS[key] || key === persona.key) return; personaSel.value = key; personaSel.dispatchEvent(new Event('change')); };

  // ------------------------------------------------------------------ smoke-test tabs and checks
  for (const p of PAGES.filter((x) => x.key)) appState.tab(p.key, async () => { go(p.key, { smooth: false }); await mountPage(p.key); });
  registerChecks(ctx, { exportBtn, mountPage });
};

main().catch((e) => {
  appState.bootFailed(e);
  console.error(e);
  const s = document.getElementById('splash-status');
  if (s) s.textContent = `Could not start: ${e?.message ?? e}`;
});
