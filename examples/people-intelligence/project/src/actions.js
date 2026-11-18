/**
 * People Actions: the register that closes the loop from insight → simulation → decision → outcome.
 *
 * The governed register (PEOPLE_INITIATIVES, through the semantic layer) is the starting point; actions
 * created, edited, submitted and approved in the app are held as demo workflow state in localStorage
 * (maker–checker: the approver must differ from the submitter; ≥ £1m needs the Group CHRO).
 */
const KEY = 'people-actions-v2';
const STATUSES = ['Draft', 'Submitted', 'Approved', 'In progress', 'Completed', 'Rejected'];
const slug = (s) => String(s).toLowerCase().replace(/[^a-z]+/g, '-');
const now = () => new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
const OWNERS = ['Hannah Clarke (HRBP, UK Technology)', 'Priya Nair (BU Leader, Technology)', 'Sarah Mitchell (Group CHRO)', 'James Whitfield (Regional HRD, UK & Ireland)', 'Marco Bianchi (BU Leader, Networks)', 'Elena Fischer (BU Leader, Enterprise Business)', 'Rahul Mehta (Regional HRD, GBS)', 'Katrin Vogel (Regional HRD, Germany)', 'Amina Farouk (Regional HRD, Middle East & Africa)'];
const BUS = ['Technology', 'Networks', 'Enterprise Business', 'Consumer', 'Customer Operations', 'Retail & Stores', 'Shared Services (GBS)', 'Group Functions'];
const TYPES = ['Retention', 'Reskilling', 'Mobility', 'Cost', 'Build', 'Restructuring'];

const defaultMilestones = (type) => ({
  Retention: ['Confirm population & eligibility with Reward', 'Market pay review for critical roles', 'Stay conversations with all senior engineers', 'Retention awards communicated', 'Measure 90-day attrition'],
  Reskilling: ['Select cohort from adjacent-skills pool', 'Partner & curriculum agreed', 'Cohort 1 starts', 'Cohort 1 certified & redeployed', 'Coverage re-measured'],
  Mobility: ['Publish open critical roles internally first', 'Match adjacent candidates (Opportunity Marketplace)', 'Hiring-manager calibration', 'First internal placements', 'Internal fill rate reviewed'],
  Cost: ['Contractor inventory by cost centre', 'Convert / release plan agreed with BU', 'Overtime controls live', 'Run-rate back within budget'],
}[type] ?? ['Plan agreed', 'Delivery started', 'Mid-point review', 'Outcome measured']).map((t, i) => ({ t, done: false, due: `M${i + 1}` }));

export const actionStore = (ctx) => {
  let state = (() => { try { return JSON.parse(localStorage.getItem(KEY)) ?? null; } catch { return null; } })() ?? { overrides: {}, created: [], audit: [] };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode */ } for (const f of listeners) f(); };
  const listeners = [];
  let seed = [];
  let loaded = null;
  const load = () => (loaded ??= ctx.q({
    dims: [['Initiative Id', 'Initiatives'], ['Initiative Name', 'Initiatives'], ['Business Unit', 'Initiatives'], ['Scope Country', 'Initiatives'], ['Initiative Type', 'Initiatives'], ['Owner', 'Initiatives'], ['Status', 'Initiatives'], ['Start Month', 'Initiatives'], ['Due Month', 'Initiatives'], ['Target Metric', 'Initiatives'], ['Originating Insight', 'Initiatives'], ['Baseline Value', 'Initiatives'], ['Target Value', 'Initiatives'], ['Actual Value', 'Initiatives']],
    measures: ['Initiative Investment', 'Expected Benefit', 'Realised Benefit'], scope: 'none', limit: 100,
  }).then((rows) => {
    seed = rows.map((r) => ({
      id: r['Initiative Id'], name: r['Initiative Name'], bu: r['Business Unit'], country: r['Scope Country'], type: r['Initiative Type'], owner: r.Owner, status: r.Status,
      start: r['Start Month'], due: r['Due Month'], metric: r['Target Metric'], insight: r['Originating Insight'],
      baseline: r['Baseline Value'] == null ? null : Number(r['Baseline Value']), target: r['Target Value'] == null ? null : Number(r['Target Value']), actual: r['Actual Value'] == null ? null : Number(r['Actual Value']),
      investment: Number(r['Initiative Investment'] ?? 0), benefit: Number(r['Expected Benefit'] ?? 0), realised: Number(r['Realised Benefit'] ?? 0),
      milestones: defaultMilestones(r['Initiative Type']).map((m, i, a) => ({ ...m, done: r.Status === 'Completed' || (r.Status === 'In progress' && i < Math.ceil(a.length / 2)) })),
      submittedBy: r.Owner, source: 'governed',
      evidence: r['Initiative Id'] === 'PA-101' ? { page: 'tr', pop: { country: 'United Kingdom', bu: 'Technology' } } : /Cloud|AI|Network Automation/.test(r['Initiative Name']) ? { page: 'sk' } : /Cost|overtime/i.test(r['Initiative Name']) ? { page: 'wx' } : { page: 'tr' },
    }));
    for (const f of listeners) f();
    return seed;
  }).catch((e) => { console.warn('[actions]', e); return []; }));

  const all = () => [...seed, ...state.created].map((a) => ({ ...a, ...(state.overrides[a.id] ?? {}) }));
  const who = () => `${ctx.persona.name} (${ctx.persona.role})`;
  // Every workflow step is also inserted into ASTRATO_GALLERY.MOCK_DATA.PEOPLE_ACTION_EVENTS through the semantic layer.
  const EVENT_FIELDS = [['Event Id', 'string'], ['Event At', 'string'], ['Event Month', 'string'], ['Action Id', 'string'], ['Action Name', 'string'], ['Business Unit', 'string'], ['Scope', 'string'], ['Action Type', 'string'], ['Event Type', 'string'], ['Status After', 'string'], ['Actor', 'string'], ['Actor Role', 'string'], ['Owner', 'string'], ['Investment Gbp', 'number'], ['Expected Benefit Gbp', 'number'], ['Note', 'string'], ['Record Source', 'string'], ['Event Count', 'number']];
  const eventType = (what) => (/^Created/.test(what) ? 'Created' : /^Submitted/.test(what) ? 'Submitted' : /^Approved/.test(what) ? 'Approved' : /^Returned/.test(what) ? 'Returned' : /milestone/i.test(what) ? 'Milestone' : /^Reassigned/.test(what) ? 'Reassigned' : /Delivery started/.test(what) ? 'Delivery started' : /^Edited/.test(what) ? 'Edited' : 'Updated');
  const writeEvent = (id, what) => setTimeout(async () => {
    const a = store.get(id);
    if (!a) return;
    const at = new Date().toISOString().slice(0, 16).replace('T', ' ');
    const row = [`EV-${Date.now().toString(36).toUpperCase()}`, at, at.slice(0, 7), a.id, a.name, a.bu ?? '', a.country ?? 'Group', a.type ?? '', eventType(what), a.status ?? '', ctx.persona.name, ctx.persona.role, a.owner ?? '', Number(a.investment || 0), Number(a.benefit || 0), what.slice(0, 500), 'People Intelligence app · writeback', 1];
    const res = await ctx.writeback('Action Events', EVENT_FIELDS, [row]);
    store.wb = res.written ? { mode: 'live', last: at } : { mode: 'local', error: res.error };
    if (res.written) { ctx.requery('a-log'); ctx.toast(`Written to Snowflake · <b>${eventType(what)}</b> ${a.id}`, 'cloud_done'); }
    for (const f of listeners) f();
  }, 0);
  const log = (id, what) => { state.audit.unshift({ at: now(), who: who(), id, what }); writeEvent(id, what); };
  const approverFor = (a) => (Number(a.investment) >= 1e6 ? 'chro' : a.bu === 'Technology' ? 'bul' : 'chro');
  const store = {
    load, all, onChange: (f) => listeners.push(f), audit: (id) => state.audit.filter((x) => !id || x.id === id), statuses: STATUSES, owners: OWNERS, bus: BUS, types: TYPES,
    get: (id) => all().find((a) => a.id === id),
    approverFor,
    create: (a) => {
      const id = `PA-${(200 + state.created.length + 1)}`;
      const action = { id, status: 'Draft', start: '2026-11', due: '2027-03', source: 'app', submittedBy: who(), milestones: defaultMilestones(a.type), investment: 0, benefit: 0, realised: 0, ...a };
      state.created.push(action); log(id, `Created “${action.name}”${a.scenario ? ' from a saved scenario' : ''}`); save();
      return action;
    },
    update: (id, patch, what) => { state.overrides[id] = { ...(state.overrides[id] ?? {}), ...patch }; const c = state.created.find((x) => x.id === id); if (c) Object.assign(c, patch); log(id, what ?? 'Updated'); save(); },
    submit: (id) => store.update(id, { status: 'Submitted', submittedBy: who() }, `Submitted for approval → ${ctx.personas[approverFor(store.get(id))].name}`),
    canApprove: (a) => a.status === 'Submitted' && approverFor(a) === ctx.persona.key && !String(a.submittedBy ?? '').startsWith(ctx.persona.name),
    approve: (id, note) => store.update(id, { status: 'Approved', approvedBy: who() }, `Approved${note ? ` — “${note}”` : ''}`),
    reject: (id, note) => store.update(id, { status: 'Rejected' }, `Returned${note ? ` — “${note}”` : ''}`),
    pendingFor: (p) => all().filter((a) => a.status === 'Submitted' && approverFor(a) === p.key).length,
    reset: () => { state = { overrides: {}, created: [], audit: [] }; save(); },
  };
  return store;
};

export const mountActions = (ctx, host) => {
  const { el, esc, icon, gbp, pct } = ctx;
  const store = ctx.actions;
  let filter = 'All', openId = null;
  const fmtVal = (a, v) => (v == null ? '–' : Math.abs(v) <= 1.5 && /attrition|coverage|rate|filled|redeploy|vs budget/i.test(a.metric ?? '') ? pct(v) : Number(v).toLocaleString('en-GB'));
  const progressOf = (a) => {
    if (a.actual == null || a.baseline == null || a.target == null || a.target === a.baseline) return a.milestones?.length ? a.milestones.filter((m) => m.done).length / a.milestones.length : 0;
    return Math.max(0, Math.min(1, (a.actual - a.baseline) / (a.target - a.baseline)));
  };
  const inScope = (a) => {
    const p = ctx.persona;
    if (p.key === 'hrbp') return a.bu === 'Technology' && ['United Kingdom', 'Group'].includes(a.country);
    if (p.key === 'bul') return a.bu === 'Technology';
    if (p.key === 'rhrd') return ['United Kingdom', 'Ireland', 'Group'].includes(a.country);
    return true;
  };

  const modal = (a) => {
    const isNew = !a?.id;
    const v = { name: '', bu: 'Technology', country: 'United Kingdom', type: 'Retention', owner: OWNERS[0], due: '2027-03', metric: '', baseline: '', target: '', investment: '', benefit: '', insight: '', ...a };
    const f = (label, input, full) => el('label', { class: full ? 'full' : '' }, [el('span', { text: label }), input]);
    const inp = (k, type = 'text') => el('input', { type, value: v[k] ?? '', 'data-k': k });
    const sel = (k, opts) => { const s = el('select', { 'data-k': k }, opts.map((o) => el('option', { value: o, text: o }))); s.value = v[k]; return s; };
    const box = el('div', { class: 'box' }, [
      el('h3', { text: isNew ? 'Create people action' : `Edit ${v.id}` }),
      el('p', { class: 'pi-note', text: isNew ? 'Actions are linked to the evidence and scenario that motivated them, and need approval before delivery.' : 'Changes are logged in the audit trail.' }),
      el('div', { class: 'pi-form' }, [
        f('Initiative name', inp('name'), true), f('Business unit', sel('bu', BUS)), f('Scope', sel('country', ['Group', 'United Kingdom', 'Ireland', 'Germany', 'Italy', 'Spain', 'India', 'Morocco', 'Kenya', 'United Arab Emirates', 'Netherlands', 'Hungary', 'Malta', 'Cyprus', 'Poland', 'Croatia'])),
        f('Type', sel('type', TYPES)), f('Owner', sel('owner', OWNERS)), f('Due', inp('due', 'month')), f('Target metric', inp('metric')),
        f('Baseline', inp('baseline', 'number')), f('Target', inp('target', 'number')), f('Investment (£)', inp('investment', 'number')), f('Expected annual benefit (£)', inp('benefit', 'number')),
        f('Originating insight', inp('insight'), true),
      ]),
      el('div', { class: 'pi-actions-row' }, [
        el('button', { class: 'pi-btn primary', onclick: () => {
          const patch = {};
          box.querySelectorAll('[data-k]').forEach((x) => { const k = x.dataset.k; patch[k] = ['baseline', 'target', 'investment', 'benefit'].includes(k) ? (x.value === '' ? null : Number(x.value)) : x.value; });
          if (!patch.name) { ctx.toast('Give the action a name.', 'error'); return; }
          if (isNew) { const c = store.create({ ...a, ...patch }); openId = c.id; ctx.toast(`Created <b>${esc(c.id)}</b> · draft`); } else { store.update(v.id, patch, 'Edited details'); ctx.toast(`Saved <b>${esc(v.id)}</b>`); }
          wrap.remove(); render();
        } }, [icon('check'), el('span', { text: isNew ? 'Create draft' : 'Save' })]),
        el('button', { class: 'pi-btn', text: 'Cancel', onclick: () => wrap.remove() }),
      ]),
    ]);
    const wrap = el('div', { class: 'pi-modal', onclick: (e) => { if (e.target === wrap) wrap.remove(); } }, box);
    document.body.append(wrap);
  };
  ctx.actions.openCreate = (prefill) => { ctx.go('act'); setTimeout(() => modal(prefill), 150); };

  const detail = (a) => {
    const canApprove = store.canApprove(a);
    const approver = ctx.personas[store.approverFor(a)];
    const prog = progressOf(a);
    const ev = a.evidence;
    return el('div', { class: 'pi-card span-12', style: 'margin-top:14px' }, [
      el('div', { class: 'pi-cap' }, [el('span', { class: 't', html: `${esc(a.id)} · ${esc(a.name)} <span class="pill ${slug(a.status)}" style="margin-left:6px">${esc(a.status)}</span>` }),
        el('div', { class: 'tools' }, [
          a.status === 'Draft' ? el('button', { class: 'pi-btn sm primary', onclick: () => { store.submit(a.id); ctx.toast(`Submitted <b>${esc(a.id)}</b> to ${esc(approver.name)}`); render(); } }, [icon('send'), el('span', { text: 'Submit for approval' })]) : null,
          canApprove ? el('button', { class: 'pi-btn sm primary', onclick: () => { store.approve(a.id); ctx.toast(`Approved <b>${esc(a.id)}</b>`); render(); } }, [icon('verified'), el('span', { text: 'Approve' })]) : null,
          canApprove ? el('button', { class: 'pi-btn sm', onclick: () => { const n = prompt('Reason for returning it?') ?? ''; store.reject(a.id, n); render(); } }, [icon('undo'), el('span', { text: 'Return' })]) : null,
          a.status === 'Approved' ? el('button', { class: 'pi-btn sm', onclick: () => { store.update(a.id, { status: 'In progress' }, 'Delivery started'); render(); } }, [icon('play_arrow'), el('span', { text: 'Start delivery' })]) : null,
          el('button', { class: 'pi-btn sm', onclick: () => modal(a) }, [icon('edit'), el('span', { text: 'Edit' })]),
          el('button', { class: 'pi-btn sm ghost', onclick: () => { openId = null; render(); } }, [icon('close')]),
        ])]),
      el('div', { class: 'pi-detail' }, [
        el('div', {}, [
          el('div', { class: 'pi-kv' }, [
            el('span', { text: 'Originating insight' }), el('b', { text: a.insight || '—' }),
            el('span', { text: 'Business unit / scope' }), el('div', { text: `${a.bu} · ${a.country ?? 'Group'}` }),
            el('span', { text: 'Owner' }), (() => { const s = el('select', { class: 'pi-select' }, OWNERS.map((o) => el('option', { value: o, text: o }))); s.value = a.owner; s.onchange = () => { store.update(a.id, { owner: s.value }, `Reassigned to ${s.value}`); ctx.toast(`Assigned to <b>${esc(s.value.split(' (')[0])}</b>`); render(); }; return s; })(),
            el('span', { text: 'Approval' }), el('div', { html: a.status === 'Submitted' ? `Awaiting <b>${esc(approver.name)}</b> (${esc(approver.role)})${canApprove ? ' — that’s you' : ''}` : a.approvedBy ? `Approved by ${esc(a.approvedBy)}` : a.status === 'Draft' ? `Needs ${esc(approver.name)} (${Number(a.investment) >= 1e6 ? '≥ £1m → Group CHRO' : 'business-unit approval'})` : esc(a.status) }),
            el('span', { text: 'Timeline' }), el('div', { text: `${a.start ?? '—'} → ${a.due ?? '—'}` }),
            el('span', { text: 'Investment' }), el('div', { text: gbp(a.investment || 0) }),
            el('span', { text: 'Expected benefit' }), el('div', { text: `${gbp(a.benefit || 0)} a year${a.investment ? ` · ${(a.benefit / a.investment).toFixed(1)}× ROI` : ''}` }),
          ]),
          el('h4', { text: 'Measurable outcome', style: 'margin:16px 0 6px;font-size:13px' }),
          el('div', { class: 'pi-kv' }, [el('span', { text: a.metric || 'Metric' }), el('div', { html: `Baseline <b>${fmtVal(a, a.baseline)}</b> → target <b>${fmtVal(a, a.target)}</b> · actual <b>${fmtVal(a, a.actual)}</b>` })]),
          el('div', { class: 'pi-progress', style: 'margin-top:8px' }, el('i', { style: `width:${Math.round(prog * 100)}%` })),
          el('div', { class: 'pi-note', text: `${Math.round(prog * 100)}% of the way to target${a.actual == null ? ' (milestones)' : ''}` }),
          a.scenario ? el('div', { style: 'margin-top:14px' }, [el('h4', { text: 'Scenario assumptions', style: 'margin:0 0 6px;font-size:13px' }), el('div', { class: 'pi-assump' }, el('table', {}, Object.entries(a.scenario).map(([k, v]) => el('tr', {}, [el('td', { text: k }), el('td', { text: String(v) })]))))]) : null,
          el('div', { class: 'pi-actions-row', style: 'margin-top:14px' }, [
            ev ? el('button', { class: 'pi-btn sm', onclick: () => { if (ev.pop) ctx.openInvestigation(ev.pop); else ctx.go(ev.page); } }, [icon('insights'), el('span', { text: 'View the evidence' })]) : null,
            el('button', { class: 'pi-btn sm', onclick: () => ctx.openSimulator(ev?.pop ?? { country: a.country === 'Group' ? undefined : a.country, bu: a.bu }) }, [icon('tune'), el('span', { text: 'Re-model in simulator' })]),
          ]),
        ]),
        el('div', {}, [
          el('h4', { text: 'Milestones', style: 'margin:0 0 6px;font-size:13px' }),
          el('ul', { class: 'pi-ms' }, (a.milestones ?? []).map((m, i) => {
            const cb = el('input', { type: 'checkbox' }); cb.checked = m.done;
            cb.onchange = () => { const ms = a.milestones.map((x, j) => (j === i ? { ...x, done: cb.checked } : x)); store.update(a.id, { milestones: ms }, `${cb.checked ? 'Completed' : 'Reopened'} milestone “${m.t}”`); render(); };
            return el('li', { class: m.done ? 'done' : '' }, [cb, el('span', { text: m.t }), el('em', { text: m.due })]);
          })),
          el('h4', { text: 'Audit trail', style: 'margin:16px 0 6px;font-size:13px' }),
          el('div', { class: 'pi-audit' }, store.audit(a.id).length ? store.audit(a.id).map((x) => el('div', {}, [el('time', { text: x.at }), el('span', { html: `<b>${esc(x.who.split(' (')[0])}</b> · ${esc(x.what)}` })])) : el('div', {}, [el('time', { text: '—' }), el('span', { text: a.source === 'governed' ? 'Loaded from the governed register (PEOPLE_INITIATIVES).' : 'No events yet.' })])),
        ]),
      ]),
    ]);
  };

  const render = () => {
    const list = store.all().filter(inScope);
    const shown = list.filter((a) => filter === 'All' || a.status === filter);
    const tot = (k) => list.reduce((s, a) => s + Number(a[k] || 0), 0);
    const pending = list.filter((a) => store.canApprove(a));
    host.replaceChildren(
      el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: 'Action register' }), el('div', { class: 'tools' }, [
        el('button', { class: 'pi-btn sm', title: 'Reset the demo workflow state', onclick: () => { if (confirm('Reset the demo workflow state?')) { store.reset(); openId = null; render(); } } }, [icon('restart_alt'), el('span', { text: 'Reset demo' })]),
        el('button', { class: 'pi-btn sm primary', onclick: () => modal({}) }, [icon('add'), el('span', { text: 'New action' })])])]),
      el('div', { class: 'pi-disclaimer', style: 'margin:4px 0 10px' }, [icon(ctx.canWrite() && store.wb?.mode !== 'local' ? 'cloud_sync' : 'cloud_off'), el('span', { html: ctx.canWrite() && store.wb?.mode !== 'local'
        ? `<b>Writeback live.</b> Every create, submit, approve, reassign and milestone step is inserted into <b>ASTRATO_GALLERY.MOCK_DATA.PEOPLE_ACTION_EVENTS</b> through the governed semantic layer, and appears in the writeback log below${store.wb?.last ? ` (last write ${ctx.esc(store.wb.last)} UTC)` : ''}.`
        : `<b>Writeback unavailable in this runtime</b>${store.wb?.error ? ` (${ctx.esc(store.wb.error)})` : ''} — workflow state is kept in this browser; the log below shows the governed rows already in Snowflake.` })]),
      el('div', { class: 'pi-big', style: 'margin:6px 0 12px' }, [
        el('div', {}, [el('span', { text: 'Initiatives in scope' }), el('b', { text: String(list.length) }), el('i', { text: `${list.filter((a) => ['Approved', 'In progress'].includes(a.status)).length} approved or in delivery` })]),
        el('div', {}, [el('span', { text: 'Investment' }), el('b', { text: gbp(tot('investment')) }), el('i', { text: 'approved + requested' })]),
        el('div', {}, [el('span', { text: 'Expected benefit' }), el('b', { text: gbp(tot('benefit')) }), el('i', { text: `${(tot('benefit') / Math.max(1, tot('investment'))).toFixed(1)}× portfolio ROI` })]),
        el('div', { class: pending.length ? 'hl' : '' }, [el('span', { text: 'Awaiting your approval' }), el('b', { text: String(pending.length) }), el('i', { text: pending.length ? pending.map((a) => a.id).join(', ') : `as ${ctx.persona.name}` })]),
      ]),
      el('div', { class: 'pi-presets', style: 'margin-bottom:8px' }, ['All', ...STATUSES].map((s) => el('button', { class: filter === s ? 'on' : '', text: `${s}${s === 'All' ? '' : ` · ${list.filter((a) => a.status === s).length}`}`, onclick: () => { filter = s; render(); } }))),
      el('div', { style: 'overflow-x:auto' }, el('table', { class: 'pi-t pi-register' }, [
        el('tr', {}, ['Initiative', 'Business unit', 'Owner', 'Expected impact', 'Status', 'Due', 'Actual outcome'].map((h) => el('th', { text: h }))),
        ...shown.map((a) => el('tr', { class: `click ${openId === a.id ? 'sel' : ''}`, onclick: () => { openId = openId === a.id ? null : a.id; render(); } }, [
          el('td', { html: `<b>${esc(a.name)}</b><div class="pi-note">${esc(a.id)} · ${esc(a.type)}${a.source === 'app' ? ' · created in app' : ''}</div>` }),
          el('td', { text: a.bu }), el('td', { text: String(a.owner).split(' (')[0] }),
          el('td', { html: `${gbp(a.benefit || 0)} / yr<div class="pi-note">${esc(a.metric ?? '')}${a.target != null ? ` → ${esc(fmtVal(a, a.target))}` : ''}</div>` }),
          el('td', { html: `<span class="pill ${slug(a.status)}">${esc(a.status)}</span>` }), el('td', { text: a.due ?? '' }),
          el('td', { html: `<div class="pi-progress" style="width:110px"><i style="width:${Math.round(progressOf(a) * 100)}%"></i></div><div class="pi-note">${a.actual != null ? `actual ${esc(fmtVal(a, a.actual))}` : `${Math.round(progressOf(a) * 100)}% milestones`}${a.realised ? ` · ${gbp(a.realised)} realised` : ''}</div>` }),
        ])),
      ])),
      ...(openId && store.get(openId) ? [detail(store.get(openId))] : []),
    );
  };
  ctx.actions.open = (id) => { ctx.go('act'); openId = id; filter = 'All'; render(); setTimeout(() => host.lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200); };
  store.onChange(render); ctx.onPersona(render);
  host.append(el('p', { class: 'pi-note', text: 'Loading the governed action register…' }));
  ctx.onPageMount('act', () => store.load().then(render));
};
