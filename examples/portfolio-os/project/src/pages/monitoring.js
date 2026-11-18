/** Quarterly Monitoring — cycle start, submission queue, ingestion with human mapping review, deterministic validation, review and approval workflow. */
import { el, esc, icon, money, pct, spct, N, me, can, denied, saveRecord, records, record, onStore, openDrawer, closeDrawer, ask, pill, eventsFor, toast, TODAY, stamp } from '../core.js';
import { M, co, finAt, ltm, QUARTERS, LATEST } from '../data.js';
import { validate, VALIDATION_RULES } from '../engine.js';
import { sheet, btn, section, stepper, kv } from '../ui.js';

export const FLOW = ['Draft', 'Submitted', 'Validation', 'Analyst Review', 'Investment Team Review', 'Approved', 'Locked'];
export const REQUESTS = ['Income statement', 'Balance sheet', 'Cash flow statement', 'Operating KPIs', 'Updated budget', 'Rolling forecast', 'Debt schedule', 'Liquidity', 'Management commentary', 'Value-creation updates'];
// Company chart-of-accounts labels → model fields (ingestion mapping). Unknown labels are never guessed.
const MAP = [
  [/^(net )?(sales|revenue|turnover)$/i, 'revenue', 'Revenue'], [/^(cogs|cost of (goods )?sales|cost of revenue)$/i, 'cogs', 'Cogs'], [/^gross (profit|margin)$/i, 'grossProfit', 'Gross Profit'],
  [/^(staff|personnel|employee) (costs|expenses)$/i, 'personnel', 'Personnel Costs'], [/^(sg&a|other (operating )?(costs|expenses|opex))$/i, 'otherOpex', 'Other Opex'], [/^(reported )?ebitda( \(reported\))?$/i, 'ebitda', 'Ebitda'],
  [/^(d&a|depreciation (and|&) amortisation)$/i, 'da', 'Depreciation Amortisation'], [/^interest (paid|expense)$/i, 'interest', 'Interest Expense'], [/^(tax|tax paid|income tax)$/i, 'tax', 'Tax'],
  [/^(change in )?(net )?working capital( movement)?$/i, 'dNwc', 'Change In Nwc'], [/^capex|capital expenditure$/i, 'capex', 'Capex'], [/^free cash flow$/i, 'fcf', 'Free Cash Flow'], [/^financing cash flow$/i, 'financing', 'Financing Cash Flow'],
  [/^(cash( and (cash )?equivalents)?)$/i, 'cash', 'Cash'], [/^(total|gross) debt|borrowings$/i, 'grossDebt', 'Gross Debt'], [/^total assets$/i, 'totalAssets', 'Total Assets'], [/^total liabilities$/i, 'totalLiabilities', 'Total Liabilities'], [/^(total )?(shareholders'? )?equity$/i, 'equity', 'Equity'],
];
const COMPANY_LABELS = { revenue: 'Net sales', cogs: 'Cost of sales', grossProfit: 'Gross profit', personnel: 'Staff costs', otherOpex: 'SG&A', ebitda: 'EBITDA (reported)', da: 'D&A', interest: 'Interest paid', tax: 'Tax paid', dNwc: 'Working capital movement', capex: 'Capital expenditure', fcf: 'Free cash flow', financing: 'Financing cash flow', cash: 'Cash and cash equivalents', grossDebt: 'Total debt', totalAssets: 'Total assets', totalLiabilities: 'Total liabilities', equity: "Shareholders' equity" };

/** The values a company's pack contains for a quarter (local currency, m) — from the governed source rows. */
const packOf = (name, q, rec) => {
  const r = finAt(name, q);
  if (!r) return null;
  const fx = r['Fx Rate To Usd'];
  const v = (k) => r[k] / fx;
  const pack = { revenue: v('Revenue'), cogs: v('Cogs'), grossProfit: v('Gross Profit'), personnel: v('Personnel Costs'), otherOpex: v('Other Opex'), ebitda: v('Ebitda'), da: v('Depreciation Amortisation'), interest: v('Interest Expense'), tax: v('Tax'), dNwc: v('Change In Nwc'), capex: v('Capex'), fcf: v('Free Cash Flow'), financing: v('Financing Cash Flow'), cash: v('Cash'), grossDebt: v('Gross Debt'), totalAssets: v('Total Assets'), totalLiabilities: v('Total Liabilities'), equity: v('Equity') };
  if (rec?.payload?.submitted?.totalAssetsAdj) pack.totalAssets += rec.payload.submitted.totalAssetsAdj; // as submitted by the company
  return pack;
};
const ctxOf = (name, q, sub) => {
  const r = finAt(name, q), fx = r?.['Fx Rate To Usd'] ?? 1;
  const ltmE = (ltm(name, 'Ebitda', q) - (r?.Ebitda ?? 0)) / fx + sub.ebitda;
  return { ...sub, period: q, ccy: co(name)['Reporting Ccy'], budgetRevenue: r ? r['Budget Revenue'] / fx : null, ltmEbitda: ltmE };
};

export const mountMonitoring = (ctx, pane) => {
  const { go } = ctx;
  let period = '2026-Q3', statusFilter = '', fundFilter = '';
  const queue = el('div');
  const summary = el('div', { class: 'strip' });
  const periodSel = el('select', {}, ['2026-Q3', '2026-Q4', '2026-Q2', '2026-Q1', '2025-Q4'].map((p) => el('option', { value: p, text: p.replace('-', ' ') })));
  const statusSel = el('select', {}, [el('option', { value: '', text: 'All statuses' }), el('option', { value: 'open', text: 'Open (not approved)' }), el('option', { value: 'overdue', text: 'Overdue' }), ...FLOW.map((s) => el('option', { value: s, text: s }))]);
  const fundSel = el('select', {}, [el('option', { value: '', text: 'All funds' }), ...M.funds.map((f) => el('option', { value: f.Fund, text: f.Fund }))]);
  periodSel.onchange = () => { period = periodSel.value; render(); };
  statusSel.onchange = () => { statusFilter = statusSel.value; render(); };
  fundSel.onchange = () => { fundFilter = fundSel.value; render(); };

  const findingsOf = (rec) => {
    const sub = rec.payload?.mapped ?? (FLOW.indexOf(rec.status) >= 1 ? packOf(rec.company, rec.period, rec) : null);
    if (!sub) return [];
    const i = QUARTERS.indexOf(rec.period);
    const prev = i > 0 ? packOf(rec.company, QUARTERS[i - 1]) : null;
    return validate(ctxOf(rec.company, rec.period, sub), prev, ctxOf(rec.company, rec.period, sub)).map((f, k) => ({ ...f, id: `${f.rule}-${k}`, decision: rec.payload?.decisions?.[`${f.rule}-${k}`] }));
  };
  const completion = (rec) => { const items = rec.payload?.items ?? {}; return REQUESTS.filter((r) => ['Received', 'Accepted'].includes(items[r])).length / REQUESTS.length; };

  const render = () => {
    const recs = records('Monitoring', (r) => r.period === period && (!fundFilter || r.fund === fundFilter));
    const rows = recs.map((r) => {
      const f = FLOW.indexOf(r.status) >= 1 ? findingsOf(r) : [];
      const open = f.filter((x) => !x.decision).length;
      return { r, name: r.company, fund: r.fund, owner: r.owner, due: r.due, comp: completion(r), missing: REQUESTS.filter((q) => !['Received', 'Accepted'].includes(r.payload?.items?.[q])).length, val: FLOW.indexOf(r.status) < 2 ? 'Not run' : open ? `${open} open finding${open > 1 ? 's' : ''}` : f.length ? `${f.length} resolved` : 'Passed', review: FLOW.indexOf(r.status) >= 5 ? 'Complete' : FLOW.indexOf(r.status) >= 3 ? r.status.replace(' Review', '') : '—', status: r.status, overdue: r.due && r.due < TODAY && FLOW.indexOf(r.status) < 5 };
    }).filter((x) => !statusFilter || (statusFilter === 'open' ? FLOW.indexOf(x.status) < 5 : statusFilter === 'overdue' ? x.overdue : x.status === statusFilter)).sort((a, b) => (b.overdue - a.overdue) || FLOW.indexOf(a.status) - FLOW.indexOf(b.status) || String(a.due).localeCompare(String(b.due)));
    const all = records('Monitoring', (r) => r.period === period);
    summary.replaceChildren(...[['Packs requested', all.length], ['Received in full', all.filter((r) => completion(r) === 1).length], ['Overdue', all.filter((r) => r.due && r.due < TODAY && FLOW.indexOf(r.status) < 5).length], ['In validation / review', all.filter((r) => [2, 3, 4].includes(FLOW.indexOf(r.status))).length], ['Approved', all.filter((r) => r.status === 'Approved').length], ['Locked', all.filter((r) => r.status === 'Locked').length]].map(([k, v]) => el('div', {}, [el('small', { text: k }), el('b', { text: String(v) })])));
    queue.replaceChildren(rows.length ? sheet([
      { key: 'name', label: 'Company', fmt: (v) => el('b', { text: v }) }, { key: 'fund', label: 'Fund', cls: '' }, { key: 'owner', label: 'Assigned owner', cls: '' },
      { key: 'due', label: 'Deadline', cls: '', fmt: (v, x) => el('span', {}, [el('span', { text: v || '—' }), x.overdue ? el('span', { class: 'pill p-overdue', text: 'Overdue' }) : null]) },
      { key: 'comp', label: 'Complete', fmt: (v) => el('span', { class: 'meter-txt' }, [el('span', { class: 'meter' }, el('i', { style: `width:${(v * 100).toFixed(0)}%` })), el('span', { text: pct(v, 0) })]) },
      { key: 'missing', label: 'Missing docs', tone: (v) => (v ? 'neg' : '') }, { key: 'val', label: 'Validation', cls: '' }, { key: 'review', label: 'Review', cls: '' }, { key: 'status', label: 'Approval status', cls: '', fmt: (v) => pill(v) },
    ], rows.map((x) => ({ ...x, __click: () => openSubmission(x.r.id) }))) : el('div', { class: 'empty' }, [el('p', { text: `No ${period} monitoring cycle has been started for this selection.` }), btn('Start monitoring cycle', startCycle, { ic: 'play_arrow' })]));
  };

  // ---------------------------------------------------------------- start a cycle
  const startCycle = async () => {
    if (!can('monitoring.start')) return denied('monitoring.start');
    const back = el('div', { class: 'modal-back' });
    const pSel = el('select', {}, ['2026-Q4', '2027-Q1'].map((p) => el('option', { value: p, text: p })));
    const fSel = el('select', {}, [el('option', { value: '', text: 'All funds' }), ...M.funds.map((f) => el('option', { value: f.Fund, text: f['Fund Name'] }))]);
    const cSel = el('select', {}, [el('option', { value: '', text: 'Every company in scope' }), ...M.companies.map((c) => el('option', { value: c.Company, text: c.Company }))]);
    const due = el('input', { type: 'date', value: '2027-02-14' });
    back.append(el('div', { class: 'modal' }, [el('h3', { text: 'Start quarterly monitoring cycle' }), el('p', { text: `Creates a monitoring pack per company with ${REQUESTS.length} requests: ${REQUESTS.join(', ')}.` }),
      el('label', {}, [el('span', { text: 'Reporting period' }), pSel]), el('label', {}, [el('span', { text: 'Fund' }), fSel]), el('label', {}, [el('span', { text: 'Company' }), cSel]), el('label', {}, [el('span', { text: 'Submission deadline' }), due]),
      el('div', { class: 'row-end' }, [el('button', { class: 'btn ghost', text: 'Cancel', onclick: () => back.remove() }), el('button', { class: 'btn', text: 'Start cycle', onclick: async () => {
        back.remove();
        const list = M.companies.filter((c) => (!fSel.value || c.Fund === fSel.value) && (!cSel.value || c.Company === cSel.value) && !records('Monitoring', (r) => r.company === c.Company && r.period === pSel.value).length);
        for (const c of list) await saveRecord({ id: `MON-${pSel.value.replace('-', '')}-${c['Company Id'].slice(3)}`, type: 'Monitoring', company: c.Company, fund: c.Fund, period: pSel.value, title: `${pSel.value} monitoring pack`, status: 'Draft', owner: `${me().name} (Portfolio Operations)`, due: due.value, payload: { items: Object.fromEntries(REQUESTS.map((r) => [r, 'Requested'])) } }, { action: 'Monitoring cycle started', next: 'Draft', reason: `${REQUESTS.length} requests issued, deadline ${due.value}` });
        period = pSel.value; periodSel.value = period; render();
        toast(`Started ${pSel.value} cycle for ${list.length} companies`, 'play_arrow');
      } })])]));
    document.body.append(back);
  };

  // ---------------------------------------------------------------- submission panel
  const openSubmission = (id) => {
    const rec = record(id);
    if (!rec) return;
    const locked = ['Approved', 'Locked'].includes(rec.status);
    const idx = FLOW.indexOf(rec.status);
    const findings = findingsOf(rec);
    const openCritical = findings.filter((f) => !f.decision && ['Critical', 'High'].includes(f.severity));
    const set = async (status, action, reason, extra = {}) => { await saveRecord({ ...rec, status, payload: { ...rec.payload, ...extra } }, { action, prev: rec.status, next: status, reason }); openSubmission(id); render(); };
    const items = rec.payload?.items ?? {};
    const checklist = el('ul', { class: 'checklist' }, REQUESTS.map((r) => el('li', { class: ['Received', 'Accepted'].includes(items[r]) ? 'ok' : '' }, [icon(['Received', 'Accepted'].includes(items[r]) ? 'check_circle' : 'radio_button_unchecked'), el('span', { text: r }), el('small', { text: items[r] ?? 'Requested' }),
      !locked && !['Received', 'Accepted'].includes(items[r]) ? el('button', { class: 'linkish', text: 'Mark received', onclick: () => { if (!can('monitoring.edit')) return denied('monitoring.edit'); set(rec.status, 'Document received', r, { items: { ...items, [r]: 'Received' } }); } }) : null])));
    // transitions
    const T = [];
    const go2 = (label, to, perm, guard, kind = '') => T.push(btn(label, async () => { if (!can(perm)) return denied(perm); if (guard && !(await guard())) return; const reason = await ask({ title: `${label} · ${rec.company}`, text: `${esc(rec.status)} → <b>${esc(to)}</b>`, label: 'Comment', required: false, confirmLabel: label }); if (reason === null) return; set(to, label, reason); }, { kind }));
    if (rec.status === 'Draft') go2('Submit pack', 'Submitted', 'monitoring.edit', async () => { if (completion(rec) < 1) { toast(`${REQUESTS.length - Math.round(completion(rec) * REQUESTS.length)} requested documents are still missing`, 'warning', 'warn'); return false; } return true; });
    if (rec.status === 'Submitted') go2('Run validation', 'Validation', 'monitoring.review');
    if (rec.status === 'Validation') go2('Send to analyst review', 'Analyst Review', 'monitoring.review', async () => { if (openCritical.length) { toast(`${openCritical.length} critical/high findings must be resolved first`, 'rule', 'warn'); return false; } return true; });
    if (rec.status === 'Analyst Review') go2('Send to investment team', 'Investment Team Review', 'monitoring.review');
    if (rec.status === 'Investment Team Review') go2('Approve pack', 'Approved', 'monitoring.approve');
    if (rec.status === 'Approved') go2('Lock period', 'Locked', 'monitoring.approve');
    if ([1, 2, 3, 4].includes(idx)) T.push(btn('Reject with comments', async () => { const p = idx >= 4 ? 'monitoring.approve' : 'monitoring.review'; if (!can(p)) return denied(p); const reason = await ask({ title: `Reject ${rec.company} pack`, text: 'Returns the pack to Draft for the company to correct.', label: 'Comments to the company', danger: true, confirmLabel: 'Reject' }); if (reason) set('Draft', 'Rejected', reason, { comments: [...(rec.payload.comments ?? []), { at: stamp(Date.now()), who: me().name, text: `Rejected: ${reason}` }] }); }, { kind: 'danger ghost' }));
    if (locked) T.push(btn('Reopen period', async () => { if (!can('monitoring.reopen')) return denied('monitoring.reopen'); const reason = await ask({ title: `Reopen ${rec.period} for ${rec.company}`, text: 'Approved periods are read-only. Reopening is audited and requires a reason.', label: 'Reason', danger: true, confirmLabel: 'Reopen' }); if (reason) set('Analyst Review', 'Period reopened', reason); }, { kind: 'ghost', ic: 'lock_open' }));

    // ingestion
    const ingestHost = el('div');
    const showMapping = (lines, sourceName) => {
      const prevQ = QUARTERS[QUARTERS.indexOf(rec.period) - 1];
      const prev = prevQ ? packOf(rec.company, prevQ) : null;
      const mapped = {}, rows = [];
      for (const [label, raw] of lines) {
        const hit = MAP.find(([re]) => re.test(label.trim()));
        const v = N(String(raw).replace(/[,$€£\s]/g, '').replace(/^\((.*)\)$/, '-$1'));
        if (hit && Number.isFinite(v)) mapped[hit[1]] = v;
        rows.push({ label, field: hit ? `Financials.${hit[2]}` : '—', key: hit?.[1], v: Number.isFinite(v) ? v : null, prev: hit && prev ? prev[hit[1]] : null, ok: !!hit && Number.isFinite(v) });
      }
      const required = ['revenue', 'ebitda', 'cash', 'grossDebt', 'totalAssets', 'totalLiabilities', 'equity'];
      const missing = required.filter((k) => mapped[k] == null);
      ingestHost.replaceChildren(section(`Extracted values for review · ${sourceName}`, [
        sheet([{ key: 'label', label: 'Source line' }, { key: 'field', label: 'Mapped field', cls: '' }, { key: 'v', label: `Proposed (${co(rec.company)['Reporting Ccy']} m)`, fmt: (v) => (v == null ? 'unreadable' : v.toFixed(2)) }, { key: 'prev', label: prevQ ? `${prevQ}` : 'Prior', fmt: (v) => (v == null ? '—' : v.toFixed(2)) }, { key: 'd', label: 'Δ vs prior', value: (r) => (r.prev ? r.v / r.prev - 1 : null), fmt: (v) => (v == null ? '—' : spct(v)), tone: (v) => (v != null && Math.abs(v) > 0.15 ? 'neg' : '') }, { key: 'ok', label: 'Status', cls: '', fmt: (v) => pill(v ? 'Mapped' : 'Needs mapping') }], rows),
        missing.length ? el('p', { class: 'warnline', html: `<b>Not found in the submission:</b> ${missing.map((k) => esc(COMPANY_LABELS[k])).join(', ')}. Missing values are left empty — they are never inferred.` }) : null,
        el('div', { class: 'row-end' }, [btn('Discard', () => ingestHost.replaceChildren(), { kind: 'ghost' }), btn('Commit mapped values to the pack', async () => {
          if (!can('monitoring.edit')) return denied('monitoring.edit');
          const ok = await ask({ title: 'Commit extracted values?', text: `${Object.keys(mapped).length} values will be stored on the ${esc(rec.period)} pack for ${esc(rec.company)} and validated. Source financial tables are not changed until the pack is approved.`, label: '', confirmLabel: 'Commit' });
          if (!ok) return;
          await set(rec.status === 'Draft' ? 'Submitted' : rec.status, 'Submission ingested', `${sourceName}: ${Object.keys(mapped).length} mapped, ${rows.filter((r) => !r.ok).length} unmapped`, { mapped, source: sourceName, items: { ...items, 'Income statement': 'Received', 'Balance sheet': 'Received', 'Cash flow statement': 'Received' } });
        }, { ic: 'task_alt' })]),
      ]));
    };
    const file = el('input', { type: 'file', accept: '.csv,text/csv', hidden: true });
    file.addEventListener('change', async () => {
      const f = file.files?.[0]; if (!f) return;
      if (!/\.csv$/i.test(f.name)) { toast('Spreadsheet ingestion here reads CSV (File → Save as → CSV). Excel workbooks are not parsed in this environment.', 'info', 'warn'); return; }
      const text = await f.text();
      const lines = text.split(/\r?\n/).map((l) => l.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map((x) => x.replace(/^"|"$/g, '').trim())).filter((l) => l[0] && l[1] != null && !/^line/i.test(l[0]));
      showMapping(lines.map((l) => [l[0], l[1]]), f.name);
    });
    const template = () => {
      const pack = packOf(rec.company, rec.period) ? null : null;
      const rows = ['line_item,value', ...Object.values(COMPANY_LABELS).map((l) => `${l},`)];
      const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' })), download: `Northstar_monitoring_template_${rec.company.replace(/\W+/g, '_')}_${rec.period}.csv` });
      a.click();
    };
    const demoPack = () => {
      const pack = packOf(rec.company, rec.period, rec) ?? packOf(rec.company, LATEST, rec);
      const lines = Object.entries(COMPANY_LABELS).filter(([k]) => k !== 'grossProfit').map(([k, l]) => [l, pack[k].toFixed(2)]);
      lines.push(['Customer count', String(1000 + rec.company.length * 37)]); // a KPI line the mapping does not recognise
      showMapping(lines, `${rec.company} management pack (${rec.period}).csv`);
    };

    const fTable = findings.length ? sheet([{ key: 'rule', label: 'Rule' }, { key: 'name', label: 'Check', cls: '' }, { key: 'severity', label: 'Severity', cls: '', fmt: (v) => pill(v) }, { key: 'detail', label: 'Finding', cls: '' }, { key: 'decision', label: 'Decision', cls: '', fmt: (v, f) => v ? el('span', {}, [pill(v.action), el('small', { text: ` ${v.who}: ${v.note}` })]) : el('span', { class: 'row-end' }, ['Accept', 'Correct', 'Reject', 'Escalate'].map((a) => el('button', { class: 'linkish', text: a, onclick: async () => {
      if (!can('finding.resolve')) return denied('finding.resolve');
      const note = await ask({ title: `${a} finding ${f.rule} · ${rec.company}`, text: esc(f.detail), label: a === 'Correct' ? 'Correction made (value and source)' : 'Rationale', confirmLabel: a });
      if (!note) return;
      await set(rec.status, ({ Accept: 'Finding accepted', Correct: 'Finding corrected', Reject: 'Finding rejected', Escalate: 'Finding escalated' })[a], `${f.rule}: ${note}`, { decisions: { ...(rec.payload.decisions ?? {}), [f.id]: { action: a, who: me().name, note } } });
      if (a === 'Escalate') await saveRecord({ type: 'Action', prefix: 'ACT', company: rec.company, fund: rec.fund, period: rec.period, title: `Escalated validation finding ${f.rule}: ${f.name}`, status: 'Open', owner: co(rec.company)['Deal Lead'], due: '2026-11-21', payload: { finding: f } }, { action: 'Escalated finding', next: 'Open', reason: note });
    } }))) }], findings) : el('p', { class: 'note', text: idx < 1 ? 'Validation runs when the pack is submitted.' : 'All deterministic validation rules passed.' });

    openDrawer({ title: `${rec.company} · ${rec.period} monitoring pack`, kicker: `${rec.fund} · owner ${rec.owner} · deadline ${rec.due || '—'}${rec.due && rec.due < TODAY && idx < 5 ? ' · OVERDUE' : ''}`, wide: true, body: [
      stepper(FLOW, rec.status),
      locked ? el('p', { class: 'lockline', html: `${icon('lock').outerHTML} This period is <b>${esc(rec.status.toLowerCase())}</b> and read-only. An Investment Director or Administrator can reopen it with a reason.` }) : null,
      el('div', { class: 'cols2' }, [section('Requests', checklist, { sub: `${pct(completion(rec), 0)} complete` }), section('Submission', [
        kv([['Source', rec.payload?.source ?? (idx >= 1 ? 'Northstar Portfolio Monitoring Portal (Excel upload)' : '—')], ['Mapped values', rec.payload?.mapped ? `${Object.keys(rec.payload.mapped).length} lines` : idx >= 1 ? 'Committed to the monitoring dataset' : '—'], ['Reporting currency', co(rec.company)['Reporting Ccy']]]),
        !locked ? el('div', { class: 'row-end' }, [btn('Download template', template, { kind: 'ghost sm', ic: 'download' }), btn('Upload CSV', () => file.click(), { kind: 'ghost sm', ic: 'upload_file' }), btn('Load company pack', demoPack, { kind: 'sm', ic: 'description' }), file]) : null,
      ])]),
      ingestHost,
      section('Validation findings', fTable, { sub: `Deterministic rules: ${VALIDATION_RULES.map((r) => r[0]).join(' · ')}` }),
      section('Comments', el('div', {}, [el('ul', { class: 'comments' }, (rec.payload?.comments ?? []).map((c) => el('li', {}, [el('b', { text: c.who }), el('small', { text: c.at }), el('p', { text: c.text })]))), btn('Add comment', async () => { const t = await ask({ title: 'Comment', label: 'Comment', confirmLabel: 'Post' }); if (t) set(rec.status, 'Comment added', t, { comments: [...(rec.payload.comments ?? []), { at: stamp(Date.now()), who: me().name, text: t }] }); }, { kind: 'ghost sm', ic: 'chat' })])),
      section('Audit history', sheet([{ key: 'at', label: 'When' }, { key: 'actor', label: 'Who', cls: '' }, { key: 'role', label: 'Role', cls: '' }, { key: 'action', label: 'Action', cls: '' }, { key: 'prev', label: 'From', cls: '' }, { key: 'next', label: 'To', cls: '' }, { key: 'reason', label: 'Reason', cls: '' }], eventsFor(rec.id))),
    ], actions: [btn('Company workspace', () => go('company', rec.company), { kind: 'ghost', ic: 'apartment' }), ...T] });
  };

  pane.append(
    el('div', { class: 'page-head' }, [el('div', {}, [el('h2', { text: 'Quarterly Monitoring' }), el('p', { text: 'Collect, map, validate and approve portfolio company reporting. Draft → Submitted → Validation → Analyst Review → Investment Team Review → Approved → Locked. Every transition is audited; approved periods are read-only.' })]),
      el('div', { class: 'row-end' }, [btn('Start monitoring cycle', startCycle, { ic: 'play_arrow' })])]),
    summary,
    el('div', { class: 'toolbar' }, [el('label', { class: 'inline' }, [el('span', { text: 'Period' }), periodSel]), el('label', { class: 'inline' }, [el('span', { text: 'Fund' }), fundSel]), el('label', { class: 'inline' }, [el('span', { text: 'Status' }), statusSel])]),
    el('figure', { class: 'card full' }, [el('figcaption', { text: 'Monitoring queue' }), queue]),
  );
  onStore(() => { if (!pane.hidden) render(); });
  ctx.onShow('monitoring', (arg) => { render(); if (typeof arg === 'string') { const r = records('Monitoring', (x) => x.company === arg && x.period === period)[0]; if (r) openSubmission(r.id); } });
  render();
};
