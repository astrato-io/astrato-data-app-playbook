/**
 * Keystone Home Finance (fictional) — lending affordability and credit decisions. Astrato App entry.
 *
 * Plain browser modules, no bundler. Every number, chart, table and filter inside
 * a panel is an Astrato visualization instance over the "Lending Affordability &
 * Decisions" semantic layer. The threshold sliders write range selections into the
 * `policy` group; the decision board and applicant file are chrome over one
 * governed query of the application rows (workflow.js).
 */
import { createAstratoApp } from '@astrato-io/app-runtime';
import { createDefaultVSpec, createVisualizationRuntime, registry } from '@astrato-io/visualizations';
import { createVisualizationAvailableFields } from '@astrato-io/visualizations/definitions';
import { ALL_GROUPS, buildTiles, COL, compileTiles, DISPLAY, EXPENSE_COLORS, EXPENSE_KEYS, FIELD_LABELS, FLOW, PERIODS, RATIO_KEYS, RULES, INC_EXP_COLORS, MAIN, POLICY, PV } from './dashboard.js';
import { createFieldIndex } from './fields.js';
import { QUESTIONS } from './questions.js';
import { createContextMenu, showObjectDialog } from './menu.js';
import { createProbe, keySetOf, queries, recordQueries } from './probe.js';
import { appState } from './app-state.js';
import { applyRuntimeOperations } from '@astrato-io/visualizations/operations';
import { applyEach, themeVSpec } from './theme.js';
import { assess, createWorkflow } from './workflow.js';

const root = document.getElementById('root');
const MOUNT_CONCURRENCY = 4;
const READY_TIMEOUT_MS = 30000;

const el = (tag, attrs = {}, children = []) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key === 'html') node.innerHTML = value;
    else if (key === 'style') {
      for (const [prop, v] of Object.entries(value)) {
        if (prop.startsWith('--')) node.style.setProperty(prop, v);
        else node.style[prop] = v;
      }
    } else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children)) if (child != null) node.append(child);
  return node;
};

const DEFINITIONS = [
  ['Net income', 'Monthly take-home pay after tax and NI, verified from bank statements (open banking).'],
  ['Essential expenses', 'Housing, groceries, utilities & council tax, transport and childcare.'],
  ['Disposable after loan', 'Net income − essential expenses − existing credit − the new monthly repayment.'],
  ['Debt-to-income (DTI)', '(Existing credit + new repayment) ÷ net income.'],
  ['Stress test', 'Repayment recalculated at the product rate + 3 percentage points, per FCA MCOB 11.6 practice.'],
  ['Affordability result', 'Pass = every check met; Marginal = one check failed; Fail = two or more.'],
  ['Four-eyes rule', 'A proposal must be approved by a different person with a big enough lending mandate.'],
];

const gbp = (v) => (v == null ? 'n/a' : `£${Math.round(v).toLocaleString('en-GB')}`);
const pct = (v) => (v == null ? 'n/a' : `${(v * 100).toFixed(1)}%`);

/** Default credit policy; the sliders move it. */
const DEFAULT_POLICY = { dti: 0.4, disp: 300, score: 600, exp: 0.8, stress: true };

// ---------------------------------------------------------------------------
// Astrato bootstrap and mounting

const loadChartFonts = async () => {
  try {
    await Promise.all(['400', '500', '700'].map((weight) => document.fonts.load(`${weight} 12px Roboto`)));
  } catch {
    // A missing face must not block the page.
  }
};

const bootstrapAstrato = async () => {
  const app = await createAstratoApp();
  const engine = app.client.hostServices.engine;
  const metadata = await engine.fields.getFieldMetadata({ ...app.dataBinding });
  recordQueries(app.client.hostServices);
  const runtime = createVisualizationRuntime({ client: app.client, registry });
  const availableFields = createVisualizationAvailableFields(metadata ?? {}).filter((field) => field?.resultType !== 'unhandled');
  // `metadata` is for the filter bar only: passing it to the charts makes them parse bracket keys and throw.
  return { app, runtime, metadata, dataBinding: { ...app.dataBinding }, availableFields, fields: createFieldIndex(availableFields) };
};

const mounted = new Map();

const mountVisualization = (runtime, instance, container, onRendered) => {
  const record = { id: instance.id, type: instance.type, container, mount: 'pending', render: 'pending', at: Date.now() };
  mounted.set(instance.id, record);
  appState.declare(instance.id, null);
  let released = false;
  let handle;
  const release = () => {
    if (released) return;
    released = true;
    handle?.unmount();
    if (runtime.listInstances().some(({ id }) => id === instance.id)) runtime.removeInstance(instance.id);
    if (mounted.get(instance.id) === record) mounted.delete(instance.id);
  };
  (async () => {
    try {
      const { width, height } = container.getBoundingClientRect();
      record.sizeAtMount = { width: Math.round(width), height: Math.round(height) };
      runtime.createInstance(instance);
      handle = await runtime.mount(container, instance.id);
      record.mount = handle.status;
      const rendered = await Promise.race([handle.ready, new Promise((resolve) => setTimeout(() => resolve({ status: 'timeout' }), READY_TIMEOUT_MS))]);
      record.render = rendered?.status ?? 'unknown';
      appState.settle(instance.id, record.render, rendered);
      record.readyMs = Date.now() - record.at;
      console.log(`[viz] ${instance.id} mount=${handle.status} render=${record.render}`);
      onRendered?.(record.render);
      if (record.render === 'error' && !released) container.parentElement?.append(el('p', { class: 'viz-error', text: 'This object could not be rendered.' }));
    } catch (error) {
      record.mount = 'failed';
      record.error = String(error);
      appState.settle(instance.id, 'error', error);
      console.error(`[viz] ${instance.id}`, error);
      release();
      onRendered?.('failed');
      container.parentElement?.append(el('p', { class: 'viz-error', text: String(error) }));
    }
  })();
  return release;
};


// ---------------------------------------------------------------------------

const ROW_COLS = [
  ['id', 'Applicant Id'], ['date', 'Application Date'], ['region', 'Region'], ['product', 'Product'], ['employment', 'Employment Type'], ['channel', 'Channel'],
  ['age', 'Age'], ['household', 'Household Size'], ['score', 'Credit Score'], ['creditBand', 'Credit Band'], ['amount', 'Requested Amount'], ['term', 'Term Months'], ['apr', 'APR'],
  ['income', 'Monthly Net Income'], ['housing', 'Housing Cost'], ['groceries', 'Groceries'], ['utilities', 'Utilities & Council Tax'], ['transport', 'Transport'], ['childcare', 'Childcare'],
  ['essential', 'Essential Expenses'], ['discretionary', 'Discretionary Spend'], ['debt', 'Existing Debt Payments'], ['repayment', 'Proposed Repayment'], ['stressed', 'Stressed Repayment'],
  ['dti', 'Debt To Income'], ['disposable', 'Disposable After Loan'], ['stressedDisposable', 'Stressed Disposable'], ['expRatio', 'Expense To Income'], ['result', 'Affordability Result'],
  ['stage', 'Stage'], ['proposal', 'Proposal'], ['underwriter', 'Underwriter'], ['outcome', 'Outcome'], ['daysOpen', 'Days Open'],
];

const main = async () => {
  const [context] = await Promise.all([bootstrapAstrato(), loadChartFonts()]);
  const { runtime, dataBinding, availableFields, fields } = context;
  const { selections, engine } = context.app.client.hostServices;

  const col = (name, view = PV) => {
    const field = fields.raw(name, view);
    if (!field) throw new Error(`"${view}.${name}" is not in this semantic layer`);
    return field.fieldKey;
  };
  const q = async (query) => {
    const full = { dimensions: [], calculations: [], orders: [], limit: 3000, offset: 0, filters: [], totals: false, showRecordsCount: false, outerViews: [], associativeListFilter: null, ...query };
    const { response } = await engine.getData({ ...dataBinding, query: full });
    const data = response?.data ?? {};
    return Object.keys(data).sort((a, b) => a - b).map((k) => data[k]);
  };

  // One governed query of every application: drives the policy simulator and the decision board.
  const loadRows = async () => {
    const raw = await q({ dimensions: ROW_COLS.map(([, name]) => ({ fieldKey: col(name), name })) });
    return raw.map((r) => Object.fromEntries(ROW_COLS.map(([k], i) => [k, typeof r[i] === 'string' && /^-?\d+(\.\d+)?$/.test(r[i]) && !['id'].includes(k) ? Number(r[i]) : r[i]])));
  };
  const loadEvents = async (id) => {
    const E = 'Workflow Events';
    const cols = ['Step No', 'Step', 'Actor', 'Role', 'Action', 'Event Date'];
    const raw = await q({ dimensions: cols.map((name) => ({ fieldKey: col(name, E), name })), filters: [{ field: { fieldKey: col('Applicant Id', E) }, operator: 'inList', values: [id] }], limit: 20 });
    return raw.map(([n, step, actor, role, action, date]) => ({ n: Number(n), step, actor, role, action, date })).sort((a, b) => a.n - b.n);
  };

  // ------------------------------------------------------ compile + theme
  const built = buildTiles(fields);
  const [{ compiled, failures: compileFailures }, rows] = await Promise.all([compileTiles(built.tiles, availableFields), loadRows()]);
  const tiles = [];
  for (const tile of compiled) {
    const themed = await themeVSpec({ id: tile.id, type: tile.type, vSpec: tile.vSpec, dataBinding }, availableFields, tile);
    if (themed.failed.length > 0) console.warn(`[theme] ${tile.id}`, JSON.stringify(themed.failed));
    let vSpec = themed.vSpec;
    if (tile.labels) {
      const byKey = Object.fromEntries(Object.entries(tile.resolvedRefs ?? {}).map(([ref, item]) => [item.dataItemInternalKey, tile.labels[ref]]));
      const relabel = (items) => items?.map((item) => (byKey[item.dataItem?.internalKey] ? { ...item, label: byKey[item.dataItem.internalKey] } : item));
      vSpec = { ...vSpec, measures: relabel(vSpec.measures), dimensions: relabel(vSpec.dimensions) };
    }
    if ((tile.type === 'bar' || tile.startsAtZero) && vSpec.axes?.primaryMeasure) vSpec = { ...vSpec, axes: { ...vSpec.axes, primaryMeasure: { ...vSpec.axes.primaryMeasure, axisRange: { axisRangeOption: 'auto', startsAtZero: true } } } };
    tiles.push({ ...tile, vSpec });
  }
  const failures = [...built.failures, ...compileFailures];
  const tileById = new Map(tiles.map((tile) => [tile.id, tile]));

  const dataTableOf = async (tile) => {
    if (!tile.dataTable) return undefined;
    if (!tile.dataTable.themed) {
      const table = await themeVSpec({ id: tile.dataTable.id, type: 'table', vSpec: tile.dataTable.vSpec, dataBinding }, availableFields, {
        type: 'table', columnLabels: tile.dataTable.columnLabels, ops: [], resolvedRefs: tile.dataTable.resolvedRefs, fontSize: 13,
      });
      tile.dataTable = { ...tile.dataTable, vSpec: table.vSpec, themed: true };
    }
    return tile.dataTable;
  };

  // ------------------------------------------------------------ selections
  const columnOfKey = (fieldKey) => fields.all.find((field) => field.fieldKey === fieldKey)?.name;
  const labelFor = (fieldKey) => FIELD_LABELS[columnOfKey(fieldKey)] ?? columnOfKey(fieldKey) ?? fieldKey;
  const selectionOf = (fieldKey, values) => ({ field: { fieldKey }, fieldKey, kind: 'VALUE', operator: 'inList', values });
  const setSel = (group, column, values) => {
    const fieldKey = fields.raw(column, PV)?.fieldKey;
    if (!fieldKey) return;
    const { applied, pending } = selections.getSelection(group);
    for (const selection of [...applied, ...pending]) if (selection.field.fieldKey === fieldKey) selections.removeSelection(group, selection);
    if (values.length > 0) selections.selectValues(group, selectionOf(fieldKey, values), { state: 'applied' });
  };
  const setRange = (group, column, lo, hi) => {
    const fieldKey = col(column);
    const { applied } = selections.getSelection(group);
    for (const selection of applied) if (selection.field.fieldKey === fieldKey) selections.removeSelection(group, selection);
    selections.selectValues(group, { field: { fieldKey }, fieldKey, kind: 'VALUE', operator: 'between', values: [lo, hi] }, { state: 'applied' });
  };

  // ------------------------------------------------------------ policy
  let policy = { ...DEFAULT_POLICY };
  const mainFilter = () => {
    const pick = (column) => selections.getSelection(MAIN).applied.find((sel) => columnOfKey(sel.field.fieldKey) === column)?.values;
    return { product: pick(COL.product), region: pick(COL.region), channel: pick(COL.channel) };
  };
  const dropColumn = (group, column) => {
    for (const s of selections.getSelection(group).applied) if (columnOfKey(s.field.fieldKey) === column) selections.removeSelection(group, s);
  };
  const DISP = () => (policy.stress ? 'Stressed Disposable' : 'Disposable After Loan');
  // The policy group holds every pass range; each rule group holds that one rule's breach range.
  // All counts and averages are then governed measures over the selected rows.
  const applyPolicySelections = () => {
    dropColumn(POLICY, policy.stress ? 'Disposable After Loan' : 'Stressed Disposable');
    setRange(POLICY, DISP(), policy.disp, 1e9);
    setRange(POLICY, 'Credit Score', policy.score, 1000);
    setRange(POLICY, 'Expense To Income', 0, policy.exp);
    setRange(POLICY, 'Debt To Income', 0, policy.dti);
    const group = (key) => RULES.find((r) => r.key === key).group;
    setRange(group('dti'), 'Debt To Income', policy.dti + 1e-6, 1e9);
    dropColumn(group('disp'), policy.stress ? 'Disposable After Loan' : 'Stressed Disposable');
    setRange(group('disp'), DISP(), -1e9, policy.disp - 0.01);
    setRange(group('score'), 'Credit Score', 0, policy.score - 1);
    setRange(group('exp'), 'Expense To Income', policy.exp + 1e-6, 1e9);
  };
  const mirrorMain = () => {
    for (const group of [POLICY, ...RULES.map((r) => r.group)])
      for (const column of [COL.product, COL.region, COL.channel]) setSel(group, column, mainFilter()[column.toLowerCase()] ?? []);
  };

  // Policy simulator: every figure is an Astrato object; only the rule wording follows the sliders.
  const ruleText = {
    dti: () => `Debt-to-income above ${pct(policy.dti)}`,
    disp: () => `${policy.stress ? 'Stressed disposable' : 'Disposable'} below ${gbp(policy.disp)}`,
    score: () => `Credit score below ${policy.score}`,
    exp: () => `Expenses above ${pct(policy.exp)} of income`,
  };
  const simOut = el('div', { class: 'sim' });
  const renderSim = () => {
    for (const node of simOut.querySelectorAll('[data-rule]')) node.textContent = ruleText[node.dataset.rule]();
  };

  let policyTimer;
  const onPolicy = () => {
    renderSim();
    workflow?.render();
    clearTimeout(policyTimer);
    policyTimer = setTimeout(applyPolicySelections, 300);
  };
  const slider = (key, label, min, max, step, show) => {
    const out = el('output', { class: 'slider__value', text: show(policy[key]) });
    const input = el('input', { type: 'range', min: String(min), max: String(max), step: String(step), value: String(policy[key]), 'aria-label': label,
      oninput: (e) => { policy[key] = Number(e.target.value); out.textContent = show(policy[key]); onPolicy(); } });
    return el('label', { class: 'slider' }, [el('span', { class: 'slider__label', text: label }), input, out]);
  };
  const stressBox = el('input', { type: 'checkbox', checked: policy.stress, onchange: (e) => { policy.stress = e.target.checked; onPolicy(); } });
  const sliders = el('div', { class: 'sliders' }, [
    slider('dti', 'Max debt-to-income', 0.2, 0.7, 0.01, pct),
    slider('disp', 'Min monthly disposable', 0, 1500, 25, gbp),
    slider('score', 'Min credit score', 400, 900, 10, String),
    slider('exp', 'Max expenses ÷ income', 0.4, 1, 0.01, pct),
    el('label', { class: 'slider slider--check' }, [stressBox, el('span', { text: 'Stress test repayment at +3% rate' })]),
    el('button', { type: 'button', class: 'link', text: 'Reset to policy', onclick: () => {
      policy = { ...DEFAULT_POLICY };
      sliders.querySelectorAll('input[type=range]').forEach((input, i) => { input.value = String(policy[['dti', 'disp', 'score', 'exp'][i]]); input.dispatchEvent(new Event('input')); });
      stressBox.checked = true; onPolicy();
    } }),
  ]);

  // ------------------------------------------------------------------ shell
  const releases = new Map();
  const menu = createContextMenu();
  const surface = (slot) => el('div', { class: 'viz-surface', 'data-slot': slot });
  const control = (id, label) =>
    el('label', { class: 'control object', 'data-object': id }, [el('span', { class: 'control-label', text: label }), el('span', { class: 'control-slot' }, surface(id))]);
  const kpiCard = (id, label, note) =>
    el('article', { class: 'kpi object', 'data-object': `kpi-${id}` }, [
      el('h3', { class: 'kpi__label', text: label }),
      el('div', { class: 'kpi__value' }, surface(`kpi-${id}`)),
      el('p', { class: 'kpi__note', text: note }),
    ]);
  // Headline card: value, latest-period change (MoM and QoQ, one shown at a time), 12-month shape.
  const headline = (id, label, note) =>
    el('article', { class: 'kpi kpi--headline object', 'data-object': `kpi-${id}` }, [
      el('h3', { class: 'kpi__label', text: label }),
      el('div', { class: 'kpi__value' }, surface(`kpi-${id}`)),
      el('div', { class: 'kpi__chg kpi__chg--mom' }, surface(`chg-mom-${id}`)),
      el('div', { class: 'kpi__chg kpi__chg--qoq' }, surface(`chg-qoq-${id}`)),
      el('p', { class: 'kpi__chgnote', 'data-chgnote': id }),
      el('div', { class: 'kpi__spark' }, surface(`spark-${id}`)),
      el('p', { class: 'kpi__note', text: note }),
    ]);
  let period = 'mom';
  const periodToggle = el('div', { class: 'seg', role: 'group', 'aria-label': 'Change period' }, Object.entries(PERIODS).map(([key, { label }]) =>
    el('button', { type: 'button', class: key === period ? 'seg__btn is-active' : 'seg__btn', 'data-period': key, text: label, onclick: () => setPeriod(key) })));
  const legend = (items) => el('ul', { class: 'key' }, items.map(([label, color, dashed]) => el('li', {}, [el('i', { class: dashed ? 'sw sw--dash' : 'sw', style: { '--c': color } }), label])));
  const panel = (id, title, sub, extra = '', aside = null) =>
    el('figure', { class: `panel object ${extra}`.trim(), 'data-object': id }, [
      el('figcaption', { class: 'panel-head' }, [
        el('div', {}, [el('h3', { class: 'panel-title', text: title }), sub ? el('p', { class: 'panel-sub', text: sub }) : null]),
        aside,
      ]),
      surface(id),
    ]);

  const filterBarHost = el('div', { class: 'app-filters', 'aria-label': 'Current filters' });
  const failuresHost = el('section', { class: 'failures', hidden: failures.length === 0 }, [
    el('h2', { text: `${failures.length} object(s) not shown` }),
    el('ul', {}, failures.map((failure) => el('li', {}, [el('strong', { text: failure.title ?? failure.id }), ` — ${failure.reason}`]))),
  ]);

  const simKpi = (id, label, note) => el('div', { class: 'simkpi object', 'data-object': `kpi-${id}` }, [el('span', { class: 'simkpi__label', text: label }), el('div', { class: 'kpi__value' }, surface(`kpi-${id}`)), note ? el('span', { class: 'simkpi__note', text: note }) : null]);
  simOut.append(
    el('div', { class: 'sim__head' }, [
      simKpi('p-lend', 'Lending requested by passing applicants'),
      simKpi('p-appr', 'Historic approval rate of passing applicants', 'Approved ÷ decided'),
    ]),
    el('h4', { class: 'sim__sub', text: 'Applications breaching each rule' }),
    el('div', { class: 'sim__rules' }, RULES.map((r) => el('div', { class: 'simkpi object', 'data-object': `kpi-r-${r.key}` }, [
      el('span', { class: 'simkpi__label', 'data-rule': r.key, text: ruleText[r.key]() }),
      el('div', { class: 'kpi__value' }, surface(`kpi-r-${r.key}`)),
    ]))),
  );
  const workflow = createWorkflow({ el, rows, policy: () => policy, loadEvents, onChange: () => {} });

  root.replaceChildren(
    el('div', { class: 'app' }, [
      el('header', { class: 'masthead' }, [
        el('div', { class: 'masthead__inner' }, [
          el('div', { class: 'brand' }, [
            el('span', { class: 'brand-mark', 'aria-hidden': 'true', html: '<svg viewBox="0 0 32 32" width="30" height="30"><path d="M16 3 2 15h4v13h20V15h4z" fill="#fff"/><circle cx="16" cy="18" r="3" fill="currentColor"/><path d="M14.6 19.5h2.8l.8 5h-4.4z" fill="currentColor"/></svg>' }),
            el('div', { class: 'brand__org' }, [el('b', { text: 'Keystone Home Finance' }), el('span', { text: 'Retail Credit Risk' })]),
          ]),
          el('div', { class: 'masthead__title' }, [
            el('h1', { text: 'Affordability & lending decisions' }),
            el('p', { text: 'Mock lending applications, October 2025 to September 2026 · every figure from the semantic layer' }),
          ]),
        ]),
      ]),

      el('div', { class: 'rail', role: 'group', 'aria-label': 'Filters' }, [
        el('div', { class: 'rail__inner' }, [
          control('ctl-product', 'Product'),
          control('ctl-region', 'Region'),
          control('ctl-channel', 'Channel'),
          el('nav', { class: 'tabs', role: 'tablist' }, [['overview', 'Overview'], ['policy', 'Thresholds'], ['decisions', 'Decisions']].map(([id, label]) => el('button', { type: 'button', role: 'tab', class: id === 'overview' ? 'tabs__btn is-active' : 'tabs__btn', 'data-tab': id, text: label, onclick: () => showTab(id) }))),
          el('div', { class: 'rail__end' }, filterBarHost),
        ]),
      ]),

      el('main', { class: 'content' }, [
        el('section', { class: 'tab is-active', 'data-tab': 'overview', role: 'tabpanel' }, [
        el('div', { class: 'section-head' }, [el('h2', { class: 'section-title', id: 'overview', text: 'Income and expenses' }), el('span', { class: 'section-head__note', text: 'Change: latest period vs the one before' }), periodToggle]),
        el('div', { class: 'kpis kpis--headline period-mom' }, [
          headline('apps', 'Applications', '12 months to Sep 2026'),
          headline('inc', 'Avg monthly income', 'Net, verified'),
          headline('exp', 'Avg monthly expenses', 'Essential + discretionary'),
          headline('disp', 'Avg disposable after loan', 'After new repayment'),
          headline('dti', 'Debt-to-income', 'Existing + new credit'),
          headline('appr', 'Approval rate', 'Of decided applications'),
        ]),
        el('div', { class: 'grid grid--2' }, [
          panel('trend', 'Average income vs expenses, by month of application', 'Monthly net income and outgoings per applicant', 'panel--mid'),
          panel('region', 'Average income vs expenses by region', 'Click a region to filter', 'panel--mid'),
        ]),
        el('div', { class: 'grid grid--2' }, [
          panel('mix', 'Where the money goes, by income band', 'Average monthly outgoings per applicant, monthly net income band', 'panel--mid', legend(EXPENSE_KEYS.map((key, i) => [DISPLAY[QUESTIONS.mix.measures.find((m) => m.key === key).measure], EXPENSE_COLORS[i]]))),
          panel('credit', 'Approval rate by credit band', 'Decided applications', 'panel--mid'),
        ]),
        el('div', { class: 'grid grid--1' }, [panel('products', 'Affordability by product', 'Click a row to filter the page', 'panel--table')]),

        ]),
        el('section', { class: 'tab', 'data-tab': 'policy', role: 'tabpanel' }, [
        el('h2', { class: 'section-title', id: 'policy', text: 'Affordability thresholds' }),
        el('p', { class: 'section-lede', text: 'Set the credit policy. Every object in this section re-queries Astrato with only the applications that pass all four checks; the simulator shows who fails which rule and how the policy compares with the decisions already made.' }),
        el('div', { class: 'policy' }, [
          el('div', { class: 'panel policy__controls' }, [el('h3', { class: 'panel-title', text: 'Credit policy' }), sliders]),
          el('div', { class: 'panel policy__sim' }, [el('h3', { class: 'panel-title', text: 'Policy simulator' }), simOut]),
        ]),
        el('div', { class: 'kpis kpis--4' }, [
          kpiCard('p-apps', 'Applications passing', 'All checks met'),
          kpiCard('p-inc', 'Their avg income', 'Monthly net'),
          kpiCard('p-disp', 'Their avg disposable', 'After the new repayment'),
          kpiCard('p-dti', 'Their debt-to-income', 'Existing + new credit'),
        ]),
        el('div', { class: 'grid grid--2' }, [
          panel('p-product', 'Applications passing, by product', 'Within the thresholds above', 'panel--mid'),
          panel('p-income', 'Applications passing, by income band', 'Within the thresholds above', 'panel--mid'),
        ]),

        ]),
        el('section', { class: 'tab', 'data-tab': 'decisions', role: 'tabpanel' }, [
        el('h2', { class: 'section-title', id: 'decisions', text: 'Decision workflow' }),
        el('p', { class: 'section-lede', text: 'Open applications move from affordability check to an underwriter’s proposal, then to a credit approver. Pick “Acting as”, open an applicant, and propose or decide. Badges re-score live against the thresholds above.' }),
        workflow.toolbar,
        workflow.summary,
        workflow.board,
        el('div', { class: 'grid grid--2' }, [
          panel('f-stage', 'Pipeline by stage', 'All applications, seeded data', 'panel--short'),
          panel('f-uw', 'Underwriter scorecard', 'Proposal upheld = approver confirmed the proposal', 'panel--short'),
        ]),
        ]),
        el('section', { class: 'defs' }, [
          el('h2', { class: 'section-title', text: 'Definitions' }),
          el('dl', {}, DEFINITIONS.flatMap(([term, text]) => [el('dt', { text: term }), el('dd', { text })])),
          el('p', { class: 'fine', text: 'Illustrative mock data for a fictional lender, generated for demonstration and served through an Astrato semantic layer. Not real customer data or lending policy.' }),
        ]),
      ]),
      el('footer', { class: 'footer' }, [el('p', { text: 'Built with Astrato · right-click any chart for “View data”.' })]),
      failuresHost,
    ]),
  );
  renderSim();

  // -------------------------------------------------------------- objects
  const instanceOf = (tile) => ({ id: tile.id, type: tile.type, groupId: tile.group ?? MAIN, vSpec: tile.vSpec, dataBinding });

  const fitColumns = async (tile, target) => {
    if (!tile.fitColumns) return tile;
    const width = Math.max(40, target.clientWidth - 26);
    const requests = [{ name: 'setTableAllColumnsResponsiveWidth', payload: false }];
    for (const [ref, share] of Object.entries(tile.fitColumns)) {
      const item = tile.resolvedRefs?.[ref];
      if (item) requests.push({ name: 'setColumnWidth', payload: { dataItemInternalKey: item.dataItemInternalKey, dataItemUniqueSignature: item.dataItemUniqueSignature, width: `${Math.floor(width * share)}px` } });
    }
    const { vSpec } = await applyEach({ id: tile.id, type: tile.type, vSpec: tile.vSpec, dataBinding }, availableFields, tile.type, requests);
    return { ...tile, vSpec };
  };

  const sizeWatch = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const tile = tiles.find((candidate) => candidate.slot === entry.target.dataset.slot);
      const record = tile && mounted.get(tile.id);
      if (!record?.sizeAtMount || !tile.fitColumns) continue;
      if (Math.abs(entry.contentRect.width - record.sizeAtMount.width) <= 2) continue;
      clearTimeout(entry.target.resizeTimer);
      entry.target.resizeTimer = setTimeout(async () => {
        const fitted = await fitColumns(tile, entry.target);
        runtime.updateInstance(tile.id, { vSpec: fitted.vSpec });
        record.sizeAtMount = { width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) };
      }, 400);
    }
  });

  const mountTile = (tile) =>
    new Promise((resolve) => {
      const target = root.querySelector(`[data-slot="${tile.slot}"]`);
      if (!target || releases.has(tile.id)) return resolve('skipped');
      target.parentElement?.querySelectorAll(':scope > .viz-error').forEach((node) => node.remove());
      fitColumns(tile, target).then((fitted) => {
        releases.set(tile.id, mountVisualization(runtime, instanceOf(fitted), target, resolve));
        sizeWatch.observe(target);
      });
    });
  const unmountTile = (tile) => {
    releases.get(tile.id)?.();
    releases.delete(tile.id);
    root.querySelector(`[data-slot="${tile.slot}"]`)?.replaceChildren();
  };
  const remount = (tile) => {
    unmountTile(tile);
    mountTile(tile);
  };

  const menuItemsFor = (objectId) => {
    const tile = tileById.get(objectId);
    if (!tile) return [];
    const items = [];
    if (tile.dataTable) {
      items.push({
        label: 'View data…',
        run: async () => {
          const dataTable = await dataTableOf(tile);
          showObjectDialog({
            title: tile.title,
            note: 'Affordability & Decisions semantic layer. The same governed query and selections as the chart.',
            mount: (target) => mountVisualization(runtime, { ...instanceOf(dataTable), groupId: tile.group ?? MAIN }, target),
          });
        },
      });
    }
    items.push({ label: 'Reset all filters', run: () => reset() });
    items.push({ label: 'Reload object', run: () => remount(tile) });
    return items;
  };
  root.addEventListener('contextmenu', (event) => {
    const object = event.target.closest('[data-object]');
    if (!object) return;
    event.preventDefault();
    const objectId = object.dataset.object;
    menu.open({ x: event.clientX, y: event.clientY, objectId, title: tileById.get(objectId)?.title ?? objectId, items: menuItemsFor(objectId) });
  });

  // ------------------------------------------------------------ chrome state
  /*
   * The filter chips and Clear all are the library's `astrato-app-filter-bar`, in the MAIN group
   * with the charts' data binding: a chart click shows up as a chip, an edit there filters the
   * charts. It needs `fieldMetadata` (field search, chip labels), which the charts must not get.
   * Auto mode: an edit applies at once; chart clicks are still applied by handlePending below.
   */
  const filterBarId = 'app-filters';
  runtime.createInstance({
    id: filterBarId,
    type: 'astrato-app-filter-bar',
    groupId: MAIN,
    vSpec: createDefaultVSpec('astrato-app-filter-bar'),
    dataBinding: { ...dataBinding, fieldMetadata: context.metadata },
  });
  await applyRuntimeOperations({
    runtime,
    instanceId: filterBarId,
    operationRequests: [
      { id: 'mode', name: 'setAppFilterBarSelectionMode', payload: 'auto' },
      { id: 'associative', name: 'setAppFilterBarAssociativeFilterEnabled', payload: false },
    ],
  });
  // Always on screen, so mounted once and never released.
  runtime.mount(filterBarHost, filterBarId).catch((error) => {
    console.error('[viz] app-filters', error);
    filterBarHost.append(el('p', { class: 'viz-error', text: String(error) }));
  });
  const reset = () => selections.clearAllSelections(MAIN);
  const renderChangeNotes = () => {
    const { unit } = PERIODS[period];
    for (const node of root.querySelectorAll('[data-chgnote]')) {
      const ratio = RATIO_KEYS.includes(node.dataset.chgnote);
      node.textContent = ratio ? `vs previous ${unit} · change in points` : `vs previous ${unit} · % change`;
      node.title = ratio
        ? `Latest ${unit} minus the previous ${unit}, in percentage points (stored question: ${QUESTIONS[PERIODS[period].question].title})`
        : `(Latest ${unit} − previous ${unit}) ÷ previous ${unit} (stored question: ${QUESTIONS[PERIODS[period].question].title})`;
    }
  };
  const setPeriod = (key) => {
    period = key;
    renderChangeNotes();
    root.querySelector('.kpis--headline').className = `kpis kpis--headline period-${key}`;
    for (const button of periodToggle.children) button.classList.toggle('is-active', button.dataset.period === key);
    for (const tile of tiles.filter((t) => t.page === 'deferred' && t.id.startsWith(`chg-${key}-`))) mountTile(tile);
  };
  const showTab = (id) => {
    for (const node of root.querySelectorAll('[data-tab]')) node.classList.toggle('is-active', node.dataset.tab === id);
    try { localStorage.setItem('lending-affordability-tab', id); } catch { /* per-viewer convenience only */ }
    scrollTo(0, 0);
  };

  for (const id of ['overview', 'policy', 'decisions']) appState.tab(id, () => showTab(id));

  // The selection test from the playbook: a filter value must move a KPI, and clearing must restore it.
  const kpiText = () => (mounted.get('kpi-apps')?.container?.innerText ?? '').replace(/\s+/g, ' ').trim();
  const settle = async () => {
    let last = -1;
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const open = queries.filter((q) => q.ms === undefined && !q.error).length;
      if (open === 0 && queries.length === last) return;
      last = queries.length;
    }
  };
  appState.check('Selecting Region = London changes the Applications KPI; clearing restores it', async () => {
    showTab('overview');
    await settle();
    const before = kpiText();
    const q0 = queries.length;
    setSel(MAIN, 'Region', ['London']);
    await settle();
    const during = kpiText();
    const perClick = queries.length - q0;
    const withFilter = queries.slice(q0).filter((q) => JSON.stringify(q.filters ?? '').includes('London')).length;
    reset();
    await settle();
    const after = kpiText();
    return { pass: before !== '' && during !== before && after === before, detail: `"${before}" -> "${during}" -> "${after}"; ${perClick} queries for the selection, ${withFilter} carried the London filter` };
  });

  // Chart clicks arrive as pending selections; apply them as the reader's choice (main group only).
  const handlePending = (group, allowed) => {
    let timer;
    selections.onActiveSelectionChange(group).subscribe((next) => {
      if (group === MAIN) { renderSim(); mirrorMain(); }
      if (next.pending.length === 0) return;
      clearTimeout(timer);
      const pending = next.pending;
      timer = setTimeout(() => {
        selections.clearPendingSelections(group);
        for (const selection of pending) {
          const column = columnOfKey(selection.field.fieldKey);
          if (column && allowed(column)) setSel(MAIN, column, selection.values);
        }
      }, 250);
    });
  };
  handlePending(MAIN, () => true);
  handlePending(POLICY, (column) => [COL.product].includes(column) || column === 'Income Band');
  handlePending(FLOW, () => false);

  window.__astrato = {
    context, tiles, failures, mounted, selections, groups: ALL_GROUPS, queries, rows, workflow, reset, setSel, policy: () => policy,
    probe: createProbe({
      mounted,
      root,
      tileKeys: (id) => {
        const tile = tiles.find((entry) => entry.id === id) ?? tiles.find((entry) => entry.dataTable?.id === id)?.dataTable;
        if (!tile) return undefined;
        const data = tile.definition.data ?? {};
        const measures = data.columns ? data.columns.filter((column) => column.role === 'measure').length : data.measures?.length;
        return { keys: keySetOf(tile.definition), limit: tile.definition.limiting?.queryLimit, measures };
      },
    }),
    remount: (id) => tileById.get(id) && remount(tileById.get(id)),
  };

  renderChangeNotes();
  applyPolicySelections();
  try { const saved = localStorage.getItem('lending-affordability-tab'); if (saved && saved !== 'overview') showTab(saved); } catch { /* ignore */ }
  const controls = tiles.filter((tile) => tile.page === 'controls');
  await Promise.all(controls.map((tile, index) => new Promise((resolve) => setTimeout(() => mountTile(tile).then(resolve), index * 150))));
  const rest = tiles.filter((tile) => tile.page !== 'controls' && tile.page !== 'deferred');
  let next = 0;
  const lane = async () => {
    while (next < rest.length) await mountTile(rest[next++]);
  };
  for (let i = 0; i < MOUNT_CONCURRENCY; i++) lane();
};

main().catch((error) => {
  console.error(error);
  appState.bootFailed(error);
  root.replaceChildren(
    el('main', { class: 'boot-error' }, [
      el('h2', { text: 'Could not start the Astrato App' }),
      el('p', { class: 'error', text: String(error) }),
      el('p', { class: 'hint', html: 'Open this page at the origin printed by <code>astrato dev</code>, or from Astrato hosting.' }),
    ]),
  );
});
