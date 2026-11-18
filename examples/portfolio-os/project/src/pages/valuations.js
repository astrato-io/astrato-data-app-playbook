/** Valuations — institutional valuation workbench: methodologies, assumptions, comparison, evidence, review, approval and publication. */
import { el, esc, icon, money, smoney, pct, spct, mult, smult, tone, N, me, can, denied, saveRecord, record, onStore, openDrawer, ask, pill, eventsFor, toast, writeTable, iso } from '../core.js';
import { M, co, finAt, valsOf, valAt, currentVal, returnsOf, ltm, scenarioBase, planOf, planDrivers, LATEST } from '../data.js';
import { xirr, multipleValuation, dcf, projectScenario } from '../engine.js';
import { sheet, btn, section, stepper, kv, waterfall } from '../ui.js';

const METHODS = ['EV/EBITDA multiple', 'EV/Revenue multiple', 'Discounted cash flow', 'Recent transaction calibration', 'Entry multiple comparison', 'Scenario-weighted'];
const STATES = ['Proposed', 'Under Review', 'Approved', 'Published'];
const F = (name, valueType = 'string') => ({ name, valueType });

export const mountValuations = (ctx, pane) => {
  const { card, filters, go } = ctx;
  let name = M.companies.find((c) => c.Company.startsWith('Meridian'))?.Company;
  const picker = el('select', { 'aria-label': 'Investment' }, [...M.companies].sort((a, b) => a.Company.localeCompare(b.Company)).map((c) => el('option', { value: c.Company, text: `${c.Company} · ${valAt(c.Company, LATEST)?.Status ?? ''}` })));
  picker.onchange = () => { name = picker.value; renderBench(); };
  const bridgeHost = el('div'), bench = el('div');
  const drafts = {};

  // ---------------------------------------------------------------- portfolio valuation bridge (Q3 2026 proposals)
  const renderBridge = () => {
    const f = ctx.selectedValues('g-valuations', 'Fund', 'Companies');
    const rows = M.vals.filter((v) => v.Quarter === LATEST && (!f.length || f.includes(co(v.Company)?.Fund)));
    const s = (k) => rows.reduce((t, r) => t + r[k], 0);
    const steps = [{ label: 'Fair value Q2 2026', value: s('Prior Fair Value'), kind: 'total' }, ...[['Operating performance', 'Bridge Operating'], ['Multiple changes', 'Bridge Multiple'], ['Debt changes', 'Bridge Debt'], ['FX movements', 'Bridge Fx'], ['Capital contributions', 'Bridge Contributions'], ['Distributions', 'Bridge Distributions'], ['Ownership changes', 'Bridge Ownership'], ['Other adjustments', 'Bridge Other']].map(([label, k]) => ({ label, value: s(k), kind: 'delta', k })), { label: 'Fair value Q3 2026 (proposed)', value: s('Fair Value'), kind: 'total' }];
    bridgeHost.replaceChildren(waterfall(steps, { height: 280, onClick: (st) => {
      if (st.kind !== 'delta') return;
      const per = rows.map((r) => ({ n: r.Company, v: r[st.k], st: r.Status })).filter((x) => Math.abs(x.v) > 0.05).sort((a, b) => a.v - b.v);
      openDrawer({ title: `${st.label}: ${smoney(st.value)}`, kicker: 'Q3 2026 valuation bridge · by investment', body: [sheet([{ key: 'n', label: 'Investment', fmt: (v) => el('button', { class: 'linkish', text: v, onclick: () => { name = v; picker.value = v; renderBench(); bench.scrollIntoView({ behavior: 'smooth' }); } }) }, { key: 'st', label: 'Status', cls: '', fmt: (v) => pill(v) }, { key: 'v', label: st.label, fmt: (v) => smoney(v), tone: (v) => tone(v) }], per), el('p', { class: 'note', text: 'Operating = Δ LTM metric × prior multiple × ownership; Multiple = Δ multiple × current metric × ownership; Debt = Δ net debt and senior claims × ownership (excluding capital events); FX = equity × ownership × Δ quarter-end rate.' })] });
    } }), el('p', { class: 'note', text: `Bridges ${rows.length} investments from approved Q2 2026 fair value to the Q3 2026 proposals (approved and pending). Movement net of capital flows: ${smoney(s('Valuation Movement'))}.` }));
  };

  // ---------------------------------------------------------------- workbench
  const sectorCalibration = (c) => {
    const peers = M.companies.filter((p) => p.Sector === c.Sector && p.Company !== c.Company);
    const now = peers.map((p) => currentVal(p.Company)?.Multiple).filter((x) => x && x < 40);
    const entry = peers.map((p) => p['Entry Multiple']).filter(Boolean);
    const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s[Math.floor((s.length - 1) / 2)] + s[Math.ceil((s.length - 1) / 2)]) / 2 : null; };
    return { now: med(now), entry: med(entry), n: peers.length };
  };
  const renderBench = () => {
    const c = co(name), q3 = valAt(name, LATEST), prior = valAt(name, '2026-Q2'), base = scenarioBase(name);
    const recId = `VAL-${c['Company Id']}-${LATEST}`;
    const wf = record(recId);
    const isRev = q3.Method === 'EV/Revenue';
    const ltmE = q3['Metric Ltm'] && !isRev ? q3['Metric Ltm'] : ltm(name, 'Ebitda');
    const ltmR = ltm(name, 'Revenue');
    const st = { ...(wf?.payload?.draft ?? {}), ...(drafts[name] ?? {}) };
    const A = {
      method: st.method ?? (isRev ? 'EV/Revenue multiple' : 'EV/EBITDA multiple'),
      ebitdaMultiple: st.ebitdaMultiple ?? (isRev ? (q3['Enterprise Value'] / ltmE) : q3.Multiple),
      revenueMultiple: st.revenueMultiple ?? (isRev ? q3.Multiple : q3['Enterprise Value'] / ltmR),
      netDebt: st.netDebt ?? q3['Net Debt'], otherClaims: st.otherClaims ?? q3['Other Claims'], nonOp: st.nonOp ?? q3['Nonoperating Assets'], ownership: st.ownership ?? q3.Ownership,
      wacc: st.wacc ?? (c.Sector === 'Technology' ? 10.5 : 9.5), tg: st.tg ?? 2.5, tm: st.tm ?? Math.round((isRev ? q3['Enterprise Value'] / ltmE : q3.Multiple) * 4) / 4,
      w: st.w ?? { base: 60, down: 25, vc: 15 }, evidence: wf?.payload?.evidence ?? [],
    };
    const cal = sectorCalibration(c);
    const compute = () => {
      const m = (metric, multiple) => multipleValuation({ metric, multiple, netDebt: A.netDebt, otherClaims: A.otherClaims, nonOperating: A.nonOp, ownership: A.ownership });
      const plan = planDrivers(planOf(name, 'Approved Forecast'));
      const proj = projectScenario(base, plan);
      const d = dcf({ years: proj.years.map((y) => ({ ebitda: y.ebitda, da: y.da, capex: y.capex, dNwc: y.dNwc })), wacc: A.wacc / 100, terminalGrowth: A.tg / 100, terminalMultiple: A.tm, netDebt: A.netDebt, otherClaims: A.otherClaims, ownership: A.ownership });
      const calMult = cal.now && cal.entry ? c['Entry Multiple'] * (cal.now / cal.entry) : c['Entry Multiple'];
      const sc = (p) => projectScenario(base, planDrivers(planOf(name, p))).today;
      const sw = (A.w.base * sc('Approved Forecast').equity + A.w.down * sc('Downside Case').equity + A.w.vc * sc('Value Creation Case').equity) / (A.w.base + A.w.down + A.w.vc);
      const res = {
        'EV/EBITDA multiple': { ...m(ltmE, A.ebitdaMultiple), metric: ltmE, multiple: A.ebitdaMultiple, how: `LTM EBITDA ${money(ltmE)} × ${mult(A.ebitdaMultiple, 2)}` },
        'EV/Revenue multiple': { ...m(ltmR, A.revenueMultiple), metric: ltmR, multiple: A.revenueMultiple, how: `LTM revenue ${money(ltmR)} × ${mult(A.revenueMultiple, 2)}` },
        'Discounted cash flow': { ev: d.ev, equity: d.equity + A.nonOp, fairValue: Math.max(0, d.equity + A.nonOp) * A.ownership, metric: ltmE, multiple: d.ev / ltmE, how: `5-year approved forecast, WACC ${A.wacc}%, terminal growth ${A.tg}% / ${A.tm}x (average)`, dcf: d },
        'Recent transaction calibration': { ...m(ltmE, calMult), metric: ltmE, multiple: calMult, how: `Entry ${mult(c['Entry Multiple'])} × (approved ${c.Sector} peer median ${mult(cal.now)} ÷ peer entry median ${mult(cal.entry)}), ${cal.n} internal comparables` },
        'Entry multiple comparison': { ...m(ltmE, c['Entry Multiple']), metric: ltmE, multiple: c['Entry Multiple'], how: `LTM EBITDA at the entry multiple ${mult(c['Entry Multiple'])}` },
        'Scenario-weighted': { ev: sw + A.netDebt + A.otherClaims - A.nonOp, equity: sw, fairValue: Math.max(0, sw) * A.ownership, metric: ltmE, multiple: (sw + A.netDebt + A.otherClaims - A.nonOp) / ltmE, how: `Base ${A.w.base}% · Downside ${A.w.down}% · Value creation ${A.w.vc}% of scenario equity values (NTM EBITDA × implied multiple)` },
      };
      return res;
    };
    const res = compute();
    const sel = res[A.method];
    const r = returnsOf(name, sel.fairValue);
    const irr = xirr([...r.flows, { date: '2026-09-30', amount: sel.fairValue }]);
    const bridge = [{ label: 'Approved Q2 2026', value: prior['Fair Value'], kind: 'total' },
      { label: 'Operating performance', value: (sel.metric - prior['Metric Ltm'] * (isRev && A.method !== 'EV/Revenue multiple' ? ltmE / ltmR : 1)) * (A.method === 'EV/Revenue multiple' ? prior.Multiple : (isRev ? prior['Enterprise Value'] / (prior['Metric Ltm'] * ltmE / ltmR) : prior.Multiple)) * A.ownership, kind: 'delta' }];
    const debt = -(A.netDebt - prior['Net Debt'] + A.otherClaims - prior['Other Claims']) * A.ownership;
    bridge.push({ label: 'Net debt & claims', value: debt, kind: 'delta' });
    bridge.push({ label: 'Multiple & method', value: sel.fairValue - prior['Fair Value'] - bridge[1].value - debt, kind: 'delta' });
    bridge.push({ label: 'Proposed Q3 2026', value: sel.fairValue, kind: 'total' });
    const state = wf?.payload?.published ? 'Published' : q3.Status === 'Challenged' ? 'Under Review' : q3.Status;
    const input = (label, key, step, fmtS = '', obj = A) => { const i = el('input', { type: 'number', step, value: Number(obj[key]).toFixed(step < 1 ? 2 : 1) }); i.onchange = () => { obj[key] = Number(i.value); draft(); }; return el('label', { class: 'field' }, [el('span', { text: label }), i, fmtS ? el('small', { text: fmtS }) : null]); };
    const draft = () => { drafts[name] = { method: A.method, ebitdaMultiple: A.ebitdaMultiple, revenueMultiple: A.revenueMultiple, netDebt: A.netDebt, otherClaims: A.otherClaims, nonOp: A.nonOp, ownership: A.ownership, wacc: A.wacc, tg: A.tg, tm: A.tm, w: A.w }; renderBench(); };
    const methodSel = el('select', {}, METHODS.map((m) => el('option', { value: m, text: m, selected: m === A.method })));
    methodSel.onchange = () => { A.method = methodSel.value; draft(); };

    // persistence
    const versions = wf?.payload?.versions ?? [];
    const persist = async (status, action, reason) => {
      const now = iso();
      const v = { v: versions.length + 1, method: A.method, multiple: sel.multiple, ev: sel.ev, equity: sel.equity, fv: sel.fairValue, by: me().name, at: now.slice(0, 16).replace('T', ' '), note: reason };
      await saveRecord({ id: recId, type: 'Valuation', company: name, fund: c.Fund, period: LATEST, title: `${name} · Q3 2026 valuation`, status, owner: q3['Prepared By'], payload: { ...(wf?.payload ?? {}), draft: { method: A.method, ebitdaMultiple: A.ebitdaMultiple, revenueMultiple: A.revenueMultiple, wacc: A.wacc, tg: A.tg, tm: A.tm, w: A.w }, versions: [...versions, v], evidence: A.evidence } }, { action, prev: q3.Status, next: status, reason });
      // governed writeback of the valuation calculation (Valuations view)
      const fv = sel.fairValue, mv = fv - prior['Fair Value'] - q3['Bridge Contributions'] - q3['Bridge Distributions'];
      const fields = [['Method', isRev && A.method === 'EV/Revenue multiple' ? 'EV/Revenue' : 'EV/EBITDA'], ['Multiple', sel.multiple, 'number'], ['Enterprise Value', sel.ev, 'number'], ['Equity Value', sel.equity, 'number'], ['Fair Value', fv, 'number'], ['Valuation Movement', mv, 'number'], ['Bridge Multiple', q3['Bridge Multiple'] + (fv - q3['Fair Value']), 'number'], ['Gross Moic', (r.realised + fv) / r.invested, 'number'], ['Gross Irr', irr ?? 0, 'number'], ['Status', status === 'Published' ? 'Approved' : status], ['Version', v.v + 1, 'number'], ['Approved By', ['Approved', 'Published'].includes(status) ? 'Valuation Committee' : '']];
      await writeTable({ view: 'Valuations', operation: 'update', fields: fields.map(([n, , t]) => F(n, t)), values: [fields.map(([, val]) => val)], keys: { fields: [F('Company'), F('Quarter')], values: [[name, LATEST]] } }, ['Valuation', recId, `Valuation row updated (${status})`, { prev: money(q3['Fair Value']), next: money(fv), reason }]);
      Object.assign(q3, { Method: fields[0][1], Multiple: sel.multiple, 'Enterprise Value': sel.ev, 'Equity Value': sel.equity, 'Fair Value': fv, 'Valuation Movement': mv, 'Gross Moic': (r.realised + fv) / r.invested, 'Gross Irr': irr ?? 0, Status: status === 'Published' ? 'Approved' : status, Version: v.v + 1 });
      window.dispatchEvent(new Event('nsos-model'));
      ctx.refreshNative?.();
    };
    const publish = async () => {
      if (!can('valuation.publish')) return denied('valuation.publish');
      const reason = await ask({ title: `Publish ${name} Q3 2026 valuation`, text: `Makes <b>${esc(money(q3['Fair Value']))}</b> the authoritative fair value used by portfolio analytics, Nash and exports (replaces ${esc(currentVal(name)?.Quarter)} ${esc(money(currentVal(name)?.['Fair Value']))}).`, label: 'Publication note', confirmLabel: 'Publish' });
      if (!reason) return;
      for (const v of valsOf(name)) v['Is Current'] = v.Quarter === LATEST ? 1 : 0;
      await writeTable({ view: 'Valuations', operation: 'update', fields: [F('Is Current', 'number')], values: [[0]], keys: { fields: [F('Company')], values: [[name]] } }, ['Valuation', recId, 'Prior marks superseded', { reason }]);
      await writeTable({ view: 'Valuations', operation: 'update', fields: [F('Is Current', 'number'), F('Status'), F('Approved By')], values: [[1, 'Approved', 'Valuation Committee']], ...keys(name) }, ['Valuation', recId, 'Published as authoritative', { next: money(q3['Fair Value']), reason, ref: recId }]);
      await saveRecord({ id: recId, type: 'Valuation', company: name, fund: c.Fund, period: LATEST, title: `${name} · Q3 2026 valuation`, status: 'Published', owner: q3['Prepared By'], payload: { ...(record(recId)?.payload ?? {}), published: true } }, { action: 'Published valuation', prev: 'Approved', next: 'Published', reason, ref: recId });
      window.dispatchEvent(new Event('nsos-model'));
      ctx.refreshNative?.();
      renderBench(); renderBridge();
    };
    const keys = (n) => ({ keys: { fields: [F('Company'), F('Quarter')], values: [[n, LATEST]] } });
    const act = (label, perm, status, kind = '', confirmText) => btn(label, async () => {
      if (!can(perm)) return denied(perm);
      const reason = await ask({ title: `${label} · ${name}`, text: confirmText ?? `${esc(A.method)} → fair value <b>${esc(money(sel.fairValue))}</b> (${esc(smoney(sel.fairValue - prior['Fair Value']))} vs approved Q2).`, label: status === 'Challenged' ? 'Challenge (assumption, evidence required)' : 'Rationale', confirmLabel: label, danger: status === 'Rejected' });
      if (!reason) return;
      await persist(status, label, reason);
      renderBench(); renderBridge();
    }, { kind });

    const evidenceInput = el('input', { type: 'file', hidden: true });
    evidenceInput.onchange = async () => { const f = evidenceInput.files?.[0]; if (!f) return; A.evidence = [...A.evidence, { name: f.name, size: f.size, by: me().name, at: iso().slice(0, 16).replace('T', ' ') }]; await saveRecord({ id: recId, type: 'Valuation', company: name, fund: c.Fund, period: LATEST, title: `${name} · Q3 2026 valuation`, status: wf?.status ?? q3.Status, owner: q3['Prepared By'], payload: { ...(wf?.payload ?? {}), evidence: A.evidence } }, { action: 'Evidence attached', reason: `${f.name} (${Math.round(f.size / 1024)} KB)` }); renderBench(); };

    bench.replaceChildren(
      el('div', { class: 'bench-head' }, [el('div', {}, [el('h3', { text: `${name} · Q3 2026 valuation` }), el('p', { class: 'muted', text: `${c.Subsector} · ${c.Fund} · prepared by ${q3['Prepared By']} · version ${q3.Version}` })]), stepper(STATES, state, { rejected: q3.Status === 'Challenged' }), q3.Status === 'Challenged' ? pill('Challenged') : null]),
      el('div', { class: 'bench' }, [
        el('div', { class: 'bench-in' }, [
          section('Methodology & assumptions', [
            el('label', { class: 'field' }, [el('span', { text: 'Primary methodology' }), methodSel]),
            el('div', { class: 'fields' }, [
              input('EV / LTM EBITDA (x)', 'ebitdaMultiple', 0.25), input('EV / LTM revenue (x)', 'revenueMultiple', 0.05),
              input('Net debt ($m)', 'netDebt', 1, 'Q3 2026 monitoring pack'), input('Other senior claims ($m)', 'otherClaims', 1, 'preferred / earn-outs'), input('Non-operating assets ($m)', 'nonOp', 1), input('Economic ownership', 'ownership', 0.01),
              input('WACC (%)', 'wacc', 0.25, 'DCF'), input('Terminal growth (%)', 'tg', 0.25, 'DCF'), input('Terminal multiple (x)', 'tm', 0.25, 'DCF'),
            ]),
            el('div', { class: 'fields' }, ['base', 'down', 'vc'].map((k) => input(`Weight · ${{ base: 'Base', down: 'Downside', vc: 'Value creation' }[k]} (%)`, k, 5, 'scenario-weighted', A.w))),
            el('p', { class: 'note', text: 'Internal assumptions only: approved comparable marks within the Northstar portfolio, historical transactions (entry multiples) and the approved forecast. No external market-data feeds.' }),
          ]),
          section('Evidence', [el('ul', { class: 'evidence-list' }, A.evidence.length ? A.evidence.map((e) => el('li', {}, [icon('attach_file'), el('span', { text: `${e.name} · ${Math.round(e.size / 1024)} KB · ${e.by} · ${e.at}` })])) : [el('li', { class: 'muted', text: 'No evidence attached yet.' })]), btn('Attach evidence', () => { if (!can('valuation.draft') && !can('valuation.challenge')) return denied('valuation.draft'); evidenceInput.click(); }, { kind: 'ghost sm', ic: 'attach_file' }), evidenceInput]),
        ]),
        el('div', { class: 'bench-out' }, [
          section('All methodologies (same governed inputs)', sheet([{ key: 'm', label: 'Methodology', fmt: (v) => el('span', { class: v === A.method ? 'b' : '', text: v === A.method ? `● ${v}` : v }) }, { key: 'multiple', label: 'Implied EV/EBITDA', fmt: (v) => mult(v) }, { key: 'ev', label: 'EV', fmt: (v) => money(v, 0) }, { key: 'equity', label: 'Equity (100%)', fmt: (v) => money(v, 0) }, { key: 'fairValue', label: 'Fair value', fmt: (v) => money(v) }, { key: 'd', label: 'vs Q2 approved', value: (r2) => r2.fairValue - prior['Fair Value'], fmt: (v) => smoney(v), tone: (v) => tone(v) }], METHODS.map((m) => ({ m, ...res[m], multiple: res[m].ev / ltmE, __click: () => { A.method = m; draft(); } })))),
          el('div', { class: 'metric-tiles four' }, [['Enterprise value', money(sel.ev, 0), sel.how], ['Equity value', money(sel.equity, 0), `EV − net debt ${money(A.netDebt, 0)} − claims ${money(A.otherClaims, 0)} + non-op ${money(A.nonOp, 0)}`], ['Northstar fair value', money(sel.fairValue), `× ${pct(A.ownership, 1)} ownership`], ['Returns at this mark', `${((r.realised + sel.fairValue) / r.invested).toFixed(2)}x · ${pct(irr)}`, `MOIC · IRR (dated cash flows)`]].map(([k, v, s]) => el('div', {}, [el('small', { text: k }), el('b', { text: v }), el('span', { text: s })]))),
          section('Valuation bridge vs approved Q2 2026', waterfall(bridge, { height: 220 })),
          section('Prior valuations', sheet([{ key: 'Quarter', label: 'Quarter' }, { key: 'Status', label: 'Status', cls: '', fmt: (v) => pill(v) }, { key: 'Method', label: 'Method', cls: '' }, { key: 'Multiple', label: 'Multiple', fmt: mult }, { key: 'Enterprise Value', label: 'EV', fmt: (v) => money(v, 0) }, { key: 'Fair Value', label: 'Fair value', fmt: (v) => money(v) }, { key: 'Gross Irr', label: 'IRR', fmt: pct }], valsOf(name))),
          res['Discounted cash flow'].dcf ? section('DCF detail', sheet([{ key: 'year', label: 'Year' }, { key: 'revenue', label: 'Revenue', fmt: (v) => money(v, 0) }, { key: 'ebitda', label: 'EBITDA', fmt: (v) => money(v, 0) }, { key: 'tax', label: 'Taxes', fmt: (v) => money(v, 0) }, { key: 'capex', label: 'Capex', fmt: (v) => money(v, 0) }, { key: 'dNwc', label: 'Δ NWC', fmt: (v) => money(v, 0) }, { key: 'ufcf', label: 'Unlevered FCF', fmt: (v) => money(v, 0) }, { key: 'pv', label: 'PV', fmt: (v) => money(v, 0) }], res['Discounted cash flow'].dcf.rows.map((rr, i) => ({ ...rr, year: 2027 + i, revenue: projectScenario(base, planDrivers(planOf(name, 'Approved Forecast'))).years[i].revenue })), { foot: { year: 'Terminal', ufcf: `TV ${money(res['Discounted cash flow'].dcf.tv, 0)}`, pv: money(res['Discounted cash flow'].dcf.pvTv, 0) } })) : null,
        ]),
      ]),
      section('Versions, challenges and decisions', [sheet([{ key: 'v', label: 'Version' }, { key: 'at', label: 'When', cls: '' }, { key: 'by', label: 'By', cls: '' }, { key: 'method', label: 'Method', cls: '' }, { key: 'multiple', label: 'Multiple', fmt: mult }, { key: 'fv', label: 'Fair value', fmt: (v) => money(v) }, { key: 'note', label: 'Note', cls: '' }], versions), sheet([{ key: 'at', label: 'When' }, { key: 'actor', label: 'Who', cls: '' }, { key: 'role', label: 'Role', cls: '' }, { key: 'action', label: 'Action', cls: '' }, { key: 'prev', label: 'From', cls: '' }, { key: 'next', label: 'To', cls: '' }, { key: 'reason', label: 'Reason', cls: '' }], eventsFor(recId))]),
      el('div', { class: 'bench-actions' }, [
        act('Save proposal', 'valuation.draft', 'Proposed', 'ghost'), act('Submit for review', 'valuation.draft', 'Under Review'),
        act('Challenge', 'valuation.challenge', 'Challenged', 'ghost'), act('Revise assumptions', 'valuation.draft', 'Under Review', 'ghost'),
        act('Approve', 'valuation.approve', 'Approved'), act('Reject', 'valuation.approve', 'Rejected', 'danger ghost'),
        btn('Publish approved valuation', publish, { ic: 'verified', disabled: q3.Status !== 'Approved' || wf?.payload?.published }),
        btn('Scenario Lab', () => go('scenario', name), { kind: 'ghost', ic: 'science' }),
      ]),
    );
  };

  pane.append(
    el('div', { class: 'page-head' }, [el('div', {}, [el('h2', { text: 'Valuations' }), el('p', { text: 'Prepare, challenge and approve quarterly valuations. EV = metric × multiple; equity = EV − net debt − senior claims + non-operating assets; fair value = equity × economic ownership. Approved, published valuations become the authoritative values everywhere.' })]), el('div', { class: 'row-end' }, [el('label', { class: 'inline' }, [el('span', { text: 'Investment' }), picker])])]),
    filters('valuations'),
    el('div', { class: 'grid' }, [el('figure', { class: 'card full' }, [el('figcaption', { text: 'Portfolio valuation bridge · approved Q2 2026 → proposed Q3 2026 (click a bar)' }), bridgeHost]), card('v-register', 'full'), card('v-move', 'half'), card('v-hist', 'half')]),
    el('figure', { class: 'card full bench-card' }, [el('figcaption', { text: 'Valuation workbench' }), bench]),
  );
  onStore(() => { if (!pane.hidden) renderBench(); });
  window.addEventListener('nsos-ccy', () => { renderBench(); renderBridge(); });
  window.addEventListener('nsos-fund', renderBridge);
  ctx.onShow('valuations', (arg) => { if (typeof arg === 'string') { name = arg; picker.value = arg; setTimeout(() => bench.scrollIntoView({ behavior: 'smooth' }), 200); } renderBench(); renderBridge(); });
  renderBench(); renderBridge();
};
