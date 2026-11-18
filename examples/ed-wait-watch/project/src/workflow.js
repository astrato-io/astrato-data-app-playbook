/**
 * Flags: a duty manager (or the lead) flags a time slot or a department and hands it to a named owner with
 * a due date; progress is recorded; an ED operations lead who neither raised nor resolved it signs it off.
 *
 * Two modes, switched at the top of the panel and always labelled:
 *  - Live: governed writeback (app.writeback) into the layer views "Er Wait Flags" (one row per flag) and
 *    "Er Wait Flag Events" (one row per change: the audit trail). The flag list and the audit trail on the
 *    right are native Astrato tables over those views, so the lead sees exactly what is stored.
 *  - Practice (the default): the same rules run against flags kept in this browser tab only. Nothing is
 *    written to the warehouse; the practice flags and their audit trail are listed in the panel, marked
 *    "not saved". This is the labelled fallback for viewers who cannot write, and the way to try the rules.
 *
 * Rules (one function, `decide`, used by both modes and by the app's own check):
 *  - anyone may raise; a duty manager or the lead may start, resolve or reassign an open flag;
 *  - a note is required to resolve, reassign or reopen;
 *  - only an ED operations lead signs off (closes) or reopens;
 *  - four eyes: nobody signs off a flag they raised or resolved themselves;
 *  - every change, and every refused attempt in practice, is an audit event (who, role, action, before, after, note).
 * A refused action is shown with its reason; nothing is written for it.
 * Demo reset: practice clears the practice flags; live removes only the flags raised in this browser session.
 * Write shape and the "clear the cache after a write" rule from the playbook's knowledge/writeback.md.
 */
const FLAGS = 'Er Wait Flags';
const EVENTS = 'Er Wait Flag Events';
const LEAD = 'ED operations lead';
const DM = 'Duty manager';
/** Demo personas. In production the role would come from the signed-in user's Astrato group. */
export const PERSONAS = [
  { key: 'dm-day', name: 'Priya Shah', role: DM, label: 'Priya Shah · duty manager (day)' },
  { key: 'dm-night', name: 'Tom Reid', role: DM, label: 'Tom Reid · duty manager (night)' },
  { key: 'lead', name: 'Dr Ana Costa', role: LEAD, label: 'Dr Ana Costa · ED operations lead' },
  { key: 'lead2', name: 'Sam Okafor', role: LEAD, label: 'Sam Okafor · deputy ED operations lead' },
];
const DAYS = ['Any', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const BANDS = ['Any', '00-03h', '03-06h', '06-09h', '09-12h', '12-15h', '15-18h', '18-21h', '21-24h'];
const DEPTS = ['Any', 'None', 'General Practice', 'Orthopedics', 'Physiotherapy', 'Cardiology', 'Neurology', 'Gastroenterology', 'Renal'];
const ACTING_KEY = 'ed-wait-watch-acting-v2';
const MODE_KEY = 'ed-wait-watch-mode-v1';
const PRACTICE_KEY = 'ed-wait-watch-practice-v1';
/** Flags raised live in this browser session: the only rows the live demo reset may remove. */
const SESSION_KEY = 'ed-wait-watch-session-flags-v1';
const store = (s, k, v) => { try { if (v === undefined) return JSON.parse(s.getItem(k) ?? 'null'); s.setItem(k, JSON.stringify(v)); } catch { /* private window */ } return null; };
const sessionFlags = () => store(sessionStorage, SESSION_KEY) ?? [];
const rememberFlag = (id) => store(sessionStorage, SESSION_KEY, [...new Set([...sessionFlags(), id])]);
const forgetFlags = () => { try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ } };

/** The rules, as one pure function: { ok } or { ok: false, reason }. */
export const decide = (action, flag, actor, note = '') => {
  const no = (reason) => ({ ok: false, reason });
  const live = ['Open', 'In progress'];
  switch (action) {
    case 'start': return flag.status === 'Open' ? { ok: true } : no(`Only an open flag can be started; this one is ${flag.status}.`);
    case 'resolve': return !live.includes(flag.status) ? no(`Only an open or in-progress flag can be resolved; this one is ${flag.status}.`) : !note ? no('A note is required to resolve a flag.') : { ok: true };
    case 'reassign': return !live.includes(flag.status) ? no(`Only an open or in-progress flag can be reassigned; this one is ${flag.status}.`) : !note ? no('A note is required to reassign a flag.') : { ok: true };
    case 'signoff':
      if (actor.role !== LEAD) return no('Refused: only the ED operations lead signs off a flag.');
      if (flag.status !== 'Resolved') return no(`Only a resolved flag can be signed off; this one is ${flag.status}.`);
      if (flag.by === actor.name) return no(`Refused (four eyes): ${actor.name} raised this flag, so another lead must sign it off.`);
      if (flag.resolvedBy === actor.name) return no(`Refused (four eyes): ${actor.name} resolved this flag, so another lead must sign it off.`);
      return { ok: true };
    case 'reopen':
      if (actor.role !== LEAD) return no('Refused: only the ED operations lead reopens a flag.');
      if (!['Resolved', 'Closed'].includes(flag.status)) return no(`Only a resolved or closed flag can be reopened; this one is ${flag.status}.`);
      return note ? { ok: true } : no('A note is required to reopen a flag.');
    default: return no(`Unknown action ${action}`);
  }
};
const ACTIONS = [
  ['start', 'Start', 'In progress', 'Started'],
  ['resolve', 'Mark resolved', 'Resolved', 'Resolved'],
  ['signoff', 'Sign off and close', 'Closed', 'Closed'],
  ['reopen', 'Reopen', 'Open', 'Reopened'],
];

const el = (tag, attrs = {}, kids = []) => {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'text') n.textContent = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
    else n.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of [].concat(kids)) if (kid != null) n.append(kid);
  return n;
};
const F = (name, valueType = 'string') => ({ name, valueType });
const isoNow = () => `${new Date().toISOString().slice(0, 19)}Z`;
const isoDay = (d) => `${d}T00:00:00Z`;
const dayOf = (v) => { if (v == null) return ''; const d = new Date(typeof v === 'number' ? v : Date.parse(v)); return Number.isNaN(d.getTime()) ? String(v) : d.toISOString().slice(0, 10); };
const newId = (prefix = 'F') => { const d = new Date(); const p = (n) => String(n).padStart(2, '0'); return `${prefix}-${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}-${p(d.getUTCHours())}${p(d.getUTCMinutes())}${p(d.getUTCSeconds())}${prefix === 'P' ? `-${Math.random().toString(36).slice(2, 5)}` : ''}`; };
const select = (name, options, value) => el('select', { name }, options.map(([v, text]) => el('option', { value: v, ...(v === value ? { selected: true } : {}), text })));
const hhmm = (iso) => iso.slice(11, 16);

export const mountWorkflow = (host, { app, q, keyOf, mainSel, onWritten, hooks, plainDay }) => {
  let acting = PERSONAS.find((r) => r.key === store(localStorage, ACTING_KEY)) ?? PERSONAS[0];
  let canWrite = typeof app.writeback === 'function';
  let mode = canWrite && store(localStorage, MODE_KEY) === 'live' ? 'live' : 'practice';
  let current = null; // the selected flag
  let writes = 0;     // governed writes made by this panel (the app's check asserts it stays 0 in practice)
  const practice = store(sessionStorage, PRACTICE_KEY) ?? { flags: [], events: [] };
  const savePractice = () => store(sessionStorage, PRACTICE_KEY, practice);
  const status = el('p', { class: 'wf-status', role: 'status' });
  const say = (text, kind = '') => { status.textContent = text; status.className = `wf-status ${kind}`; };

  // ---------------------------------------------------------------- live writes (governed writeback)
  const write = async (req) => {
    if (mode !== 'live') throw new Error('Practice mode never writes');
    if (!canWrite) throw new Error('This runtime cannot write back');
    writes += 1;
    const r = await app.writeback({ ...req });
    const n = r?.response?.rowsAffected;
    if (req.operation !== 'insert' && n === 0) throw new Error('No row changed');
    return r;
  };
  const liveEvent = (flagId, action, from, to, note) => write({
    view: EVENTS, operation: 'insert',
    fields: [F('Event ID'), F('Flag ID'), F('Event At', 'date'), F('Actor'), F('Actor Role'), F('Action'), F('From Status'), F('To Status'), F('Note')],
    values: [[`E-${Date.now().toString(36).toUpperCase()}`, flagId, isoNow(), acting.name, acting.role, action, from ?? '', to, note ?? '']],
  });
  const practiceEvent = (flagId, action, from, to, note) => {
    practice.events.unshift({ at: isoNow(), id: flagId, action, who: acting.name, role: acting.role, from: from ?? '', to, note: note ?? '' });
    savePractice();
  };

  /** One path for both modes: check the rule, then record the change (live: writeback; practice: this tab). */
  const act = async (action, note, extra = {}) => {
    const f = current;
    const verdict = decide(action, f, acting, note);
    if (!verdict.ok) {
      say(verdict.reason, 'bad');
      if (mode === 'practice') { practiceEvent(f.id, 'Refused', f.status, f.status, `${action}: ${verdict.reason}`); renderPractice(); }
      return verdict;
    }
    const [, , to, verb] = ACTIONS.find(([k]) => k === action) ?? [action, action, f.status, 'Reassigned'];
    const toStatus = action === 'reassign' ? f.status : to;
    if (mode === 'live') {
      const cols = [['Status', toStatus], ['Updated At', isoNow(), 'date'], ['Updated By', acting.name], ...(extra.owner ? [['Owner', extra.owner], ['Due Date', isoDay(extra.due), 'date']] : [])].filter(([n, v]) => n !== 'Status' || v !== f.status);
      await write({ view: FLAGS, operation: 'update', fields: cols.map(([n, , t]) => F(n, t)), values: [cols.map(([, v]) => v)], keys: { fields: [F('Flag ID')], values: [[f.id]] } });
      await liveEvent(f.id, verb, f.status, toStatus, extra.owner ? `${note} (owner ${extra.owner}, due ${extra.due})` : note);
      await onWritten();
      await loadFlag(f.id);
    } else {
      const p = practice.flags.find((x) => x.id === f.id);
      practiceEvent(f.id, verb, f.status, toStatus, extra.owner ? `${note} (owner ${extra.owner}, due ${extra.due})` : note);
      Object.assign(p, { status: toStatus, ...(action === 'resolve' ? { resolvedBy: acting.name } : {}), ...(action === 'reopen' ? { resolvedBy: '' } : {}), ...(extra.owner ? { owner: extra.owner, due: extra.due } : {}) });
      savePractice();
      current = { ...p };
      renderSelected(); renderPractice();
    }
    say(`${f.id}: ${verb.toLowerCase()} by ${acting.name}${mode === 'practice' ? ' (practice, not saved)' : ''}.`, 'good');
    return verdict;
  };

  // ---------------------------------------------------------------- acting as, and the mode
  const actingSel = select('acting', PERSONAS.map((r) => [r.key, r.label]), acting.key);
  actingSel.addEventListener('change', () => {
    acting = PERSONAS.find((r) => r.key === actingSel.value);
    store(localStorage, ACTING_KEY, acting.key);
    renderSelected();
  });
  const modeBox = el('div', { class: 'wf-modes', role: 'radiogroup', 'aria-label': 'Workflow mode' });
  const modeNote = el('p', { class: 'wf-mode' });
  const renderMode = () => {
    modeBox.replaceChildren(...[['practice', 'Practice: nothing saved'], ['live', 'Live: saved by writeback']].map(([k, text]) => el('label', { class: `wf-radio${mode === k ? ' on' : ''}` }, [
      el('input', { type: 'radio', name: 'wf-mode', value: k, ...(mode === k ? { checked: true } : {}), ...(k === 'live' && !canWrite ? { disabled: true } : {}), onchange: () => setMode(k) }), el('span', { text: text }),
    ])));
    modeNote.textContent = mode === 'live'
      ? 'Live: every change is written to Er Wait Flags and its audit event to Er Wait Flag Events (governed writeback); the tables on the right show them.'
      : `Practice: the same rules run on flags kept in this browser tab only. Nothing is written to the warehouse, and the tables on the right do not change.${canWrite ? '' : ' This runtime cannot write back, so live mode is off.'}`;
    modeNote.classList.toggle('warn', mode === 'practice');
    host.classList.toggle('practice', mode === 'practice');
  };
  const setMode = (k) => {
    if (k === 'live' && !canWrite) return;
    mode = k; store(localStorage, MODE_KEY, k); current = null;
    renderMode(); renderSelected(); renderPractice(); renderReset();
    say(k === 'live' ? 'Live mode: changes are saved to the warehouse.' : 'Practice mode: nothing is saved.', '');
  };

  // ---------------------------------------------------------------- raise a flag
  const formHost = el('div');
  const due0 = () => { const d = new Date(); d.setUTCDate(d.getUTCDate() + 3); return d.toISOString().slice(0, 10); };
  const prefill = { day: 'Any', band: 'Any', dept: 'Any' };
  const opts = (xs) => xs.map((x) => [x, x]);
  const renderForm = () => {
    const form = el('form', { class: 'wf-card wf-form', 'data-raise': '' }, [
      el('h3', { text: 'Raise a flag' }),
      el('div', { class: 'grid3' }, [
        el('label', {}, [el('span', { text: 'Day' }), select('day', opts(DAYS), prefill.day)]),
        el('label', {}, [el('span', { text: 'Arrival band' }), select('band', opts(BANDS), prefill.band)]),
        el('label', {}, [el('span', { text: 'Department' }), select('dept', opts(DEPTS), prefill.dept)]),
      ]),
      el('label', {}, [el('span', { text: 'What did you see?' }), el('textarea', { name: 'issue', rows: '2', required: true, maxlength: '400', placeholder: 'e.g. Fewer than 1 in 3 seen within 30 min on Wednesday mornings' })]),
      el('div', { class: 'grid2' }, [
        el('label', {}, [el('span', { text: 'Owner (name)' }), el('input', { name: 'owner', required: true, maxlength: '80', placeholder: 'Who will follow it up?' })]),
        el('label', {}, [el('span', { text: 'Due' }), el('input', { name: 'due', type: 'date', required: true, value: due0() })]),
      ]),
      el('div', { class: 'wf-actions' }, [el('button', { class: 'btn', type: 'submit', text: 'Raise flag' }), el('button', { class: 'link', type: 'button', text: 'Use current selection', onclick: () => { prefillFromSelection(); } })]),
    ]);
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const fd = new FormData(form);
      const day = fd.get('day'); const band = fd.get('band'); const dept = fd.get('dept');
      const issue = String(fd.get('issue') ?? '').trim(); const owner = String(fd.get('owner') ?? '').trim(); const due = String(fd.get('due') ?? '');
      if (day === 'Any' && band === 'Any' && dept === 'Any') { say('Pick a day, an arrival band or a department to flag.', 'bad'); return; }
      if (!issue || !owner || !due) { say('Say what you saw, name an owner and set a due date.', 'bad'); return; }
      const scope = dept !== 'Any' && day === 'Any' && band === 'Any' ? 'Department' : 'Time slot';
      const submit = form.querySelector('button[type=submit]');
      submit.disabled = true;
      try {
        if (mode === 'live') {
          const id = newId('F');
          await write({ view: FLAGS, operation: 'insert',
            fields: [F('Flag ID'), F('Created At', 'date'), F('Created By'), F('Scope'), F('Department'), F('Weekday'), F('Time Band'), F('Issue'), F('Owner'), F('Due Date', 'date'), F('Status'), F('Updated At', 'date'), F('Updated By'), F('Note')],
            values: [[id, isoNow(), acting.name, scope, dept, day, band, issue, owner, isoDay(due), 'Open', isoNow(), acting.name, '']] });
          rememberFlag(id);
          await liveEvent(id, 'Raised', '', 'Open', `Owner ${owner}, due ${due}`);
          renderReset();
          await onWritten();
          await loadFlag(id);
          say(`Flag ${id} raised and handed to ${owner}.`, 'good');
        } else {
          const id = newId('P');
          const flag = { id, status: 'Open', owner, due, by: acting.name, resolvedBy: '', issue, slot: [day, band, dept].filter((x) => x !== 'Any').join(' · ') };
          practice.flags.unshift(flag);
          practiceEvent(id, 'Raised', '', 'Open', `Owner ${owner}, due ${due}`);
          current = { ...flag };
          renderSelected(); renderPractice();
          say(`Practice flag ${id} raised by ${acting.name} and handed to ${owner} (not saved).`, 'good');
        }
        Object.assign(prefill, { day: 'Any', band: 'Any', dept: 'Any' });
        renderForm();
      } catch (error) {
        say(`Not saved: ${error?.message ?? error}`, 'bad');
        submit.disabled = false;
      }
    });
    formHost.replaceChildren(form);
  };
  const valueOf = (name) => mainSel.get(keyOf(name))?.[0];
  const prefillFromSelection = () => {
    const wd = valueOf('Arrival Day'); const tb = valueOf('Time Band'); const dp = valueOf('Department Referral');
    prefill.day = wd ? plainDay(wd) : 'Any';
    prefill.band = tb ?? 'Any';
    prefill.dept = dp ?? 'Any';
    renderForm();
    say(wd || tb || dp ? 'Form filled from the current selection.' : 'Nothing selected: pick a slot on the board first, or fill the form.', '');
  };

  // ---------------------------------------------------------------- the selected flag (live: read from the governed views)
  const selHost = el('div');
  const loadFlag = async (id) => {
    if (!id) { current = null; renderSelected(); return; }
    const [rows, events] = await Promise.all([
      q({ dims: ['Flag ID', 'Flag Status', 'Flag Owner', 'Flag Due Date', 'Flag Raised By', 'Flag Issue', 'Flag Weekday', 'Flag Time Band', 'Flag Department'], measures: ['Flags Raised'], filters: [{ fieldKey: keyOf('Flag ID'), operator: 'inList', values: [id] }] }),
      q({ dims: ['Event Time', 'Event Action', 'Event Actor'], measures: ['Flag Events'], filters: [{ fieldKey: keyOf('Event Flag ID'), operator: 'inList', values: [id] }] }),
    ]);
    const r = rows[0];
    // Four eyes needs who resolved it last: the latest "Resolved" event in the audit trail.
    const resolved = events.filter((e) => e['Event Action'] === 'Resolved').sort((a, b) => String(a['Event Time']).localeCompare(String(b['Event Time']))).pop();
    current = r ? { id: r['Flag ID'], status: r['Flag Status'], owner: r['Flag Owner'], due: dayOf(r['Flag Due Date']), by: r['Flag Raised By'], resolvedBy: resolved?.['Event Actor'] ?? '', issue: r['Flag Issue'], slot: [r['Flag Weekday'], r['Flag Time Band'], r['Flag Department']].filter((x) => x && x !== 'Any').join(' · ') } : null;
    renderSelected();
  };
  const renderSelected = () => {
    if (!current) {
      selHost.replaceChildren(el('div', { class: 'wf-card muted-card' }, [el('h3', { text: 'Act on a flag' }), el('p', { class: 'muted', text: mode === 'live' ? 'Click a flag in the list on the right to start, resolve, reassign, sign off or reopen it.' : 'Raise a practice flag, or pick one under "Practice flags" below.' })]));
      return;
    }
    const f = current;
    const note = el('input', { name: 'note', maxlength: '300', placeholder: 'Note (required to resolve, reassign or reopen)' });
    const btn = (key, label) => el('button', { class: 'btn small', type: 'button', 'data-action': key, text: label, onclick: async (ev) => {
      const b = ev.currentTarget; b.disabled = true;
      try { await act(key, note.value.trim()); } catch (error) { say(`Not saved: ${error?.message ?? error}`, 'bad'); } finally { b.disabled = false; }
    } });
    const owner = el('input', { name: 'newowner', maxlength: '80', placeholder: 'New owner', value: f.owner ?? '' });
    const due = el('input', { name: 'newdue', type: 'date', value: f.due });
    const reassign = el('button', { class: 'btn small ghost', type: 'button', 'data-action': 'reassign', text: 'Reassign', onclick: async (ev) => {
      const b = ev.currentTarget; b.disabled = true;
      try { await act('reassign', note.value.trim(), { owner: owner.value.trim() || f.owner, due: due.value || f.due }); } catch (error) { say(`Not saved: ${error?.message ?? error}`, 'bad'); } finally { b.disabled = false; }
    } });
    selHost.replaceChildren(el('div', { class: 'wf-card', 'data-selected-flag': f.id }, [
      el('h3', {}, [`${mode === 'practice' ? 'Practice flag' : 'Flag'} ${f.id} `, el('span', { class: `pill s-${String(f.status).toLowerCase().replace(/\W+/g, '-')}`, 'data-status': f.status, text: f.status })]),
      el('p', { class: 'flag-what', text: `${f.slot || 'Whole ED'}: ${f.issue}` }),
      el('p', { class: 'muted', text: `Owner ${f.owner} · due ${f.due} · raised by ${f.by}${f.resolvedBy ? ` · resolved by ${f.resolvedBy}` : ''}` }),
      note,
      el('div', { class: 'wf-actions' }, ACTIONS.map(([k, label]) => btn(k, label))),
      el('div', { class: 'reassign' }, [owner, due, reassign]),
      el('p', { class: 'muted small', text: `Acting as ${acting.label}. Every button checks the rules first; a refusal says why and changes nothing.` }),
    ]));
  };

  // Clicking a row of the flag table or the audit trail selects a Flag ID: show that flag (live mode).
  const flagKeys = [keyOf('Flag ID'), keyOf('Event Flag ID')];
  hooks.selection = [...(hooks.selection ?? []), (sel) => {
    if (mode !== 'live') return;
    const id = flagKeys.map((k) => sel.get(k)?.[0]).find(Boolean);
    if (id && id !== current?.id) loadFlag(id).catch((e) => say(`Could not read the flag: ${e?.message}`, 'bad'));
  }];

  // ---------------------------------------------------------------- practice flags and their audit trail (this tab only)
  const practiceHost = el('div');
  const renderPractice = () => {
    if (mode !== 'practice') { practiceHost.replaceChildren(); return; }
    const list = practice.flags.length
      ? el('div', { class: 'wf-plist' }, practice.flags.map((p) => el('button', { type: 'button', class: `wf-pflag${current?.id === p.id ? ' on' : ''}`, 'data-practice-flag': p.id, onclick: () => { current = { ...p }; renderSelected(); renderPractice(); } }, [el('b', { text: p.id.slice(-12) }), ` ${p.slot} `, el('span', { class: `pill s-${p.status.toLowerCase().replace(/\W+/g, '-')}`, text: p.status })])))
      : el('p', { class: 'muted', text: 'No practice flags yet.' });
    const trail = el('ol', { class: 'wf-trail', 'data-practice-trail': '' }, practice.events.slice(0, 40).map((e) => el('li', { class: e.action === 'Refused' ? 'refused' : '' }, [
      el('time', { text: hhmm(e.at) }), ` ${e.who} (${e.role}) `, el('b', { text: e.action }), e.from || e.to ? ` ${e.from || '–'} → ${e.to}` : '', e.note ? `: ${e.note}` : '',
    ])));
    practiceHost.replaceChildren(el('div', { class: 'wf-card practice-card' }, [
      el('h3', {}, ['Practice flags ', el('small', { class: 'tag', text: 'this tab only · not saved' })]), list,
      el('h3', {}, ['Practice audit trail ', el('small', { class: 'tag', text: `${practice.events.length} event${practice.events.length === 1 ? '' : 's'}` })]),
      practice.events.length ? trail : el('p', { class: 'muted', text: 'Every step and every refused attempt is listed here.' }),
      el('button', { class: 'link', type: 'button', 'data-practice-reset': '', text: 'Reset practice', onclick: () => { practice.flags = []; practice.events = []; savePractice(); current = null; renderSelected(); renderPractice(); say('Practice cleared.', ''); } }),
    ]));
  };

  // ---------------------------------------------------------------- live demo reset: this session's flags only
  const resetHost = el('div');
  const renderReset = () => {
    const ids = sessionFlags();
    if (mode !== 'live' || !ids.length || !canWrite) { resetHost.replaceChildren(); return; }
    const btn = el('button', { class: 'link', type: 'button', 'data-reset': '', text: `Remove the ${ids.length} flag${ids.length === 1 ? '' : 's'} raised in this session` });
    btn.addEventListener('click', async () => {
      if (!window.confirm(`Delete ${ids.join(', ')} and their audit events? Flags raised by anyone else, or in another session, stay.`)) return;
      btn.disabled = true;
      try {
        for (const id of ids) { // one key per request, the shape the setup cleanup uses
          await write({ view: EVENTS, operation: 'delete', keys: { fields: [F('Flag ID')], values: [[id]] } }).catch(() => null); // a flag may have no events left
          await write({ view: FLAGS, operation: 'delete', keys: { fields: [F('Flag ID')], values: [[id]] } });
        }
        forgetFlags();
        if (current && ids.includes(current.id)) current = null;
        say(`Removed ${ids.length} flag${ids.length === 1 ? '' : 's'} raised in this session.`, 'good');
        await onWritten(); renderSelected(); renderReset();
      } catch (error) { say(`Not removed: ${error?.message ?? error}`, 'bad'); btn.disabled = false; }
    });
    resetHost.replaceChildren(el('div', { class: 'wf-card reset' }, [el('p', { class: 'muted', text: 'Demo reset: removes only what you raised live in this browser session.' }), btn]));
  };

  host.replaceChildren(
    el('div', { class: 'wf-card acting' }, [modeBox, modeNote, el('label', {}, [el('span', { text: 'Acting as' }), actingSel]), el('p', { class: 'muted small', text: 'Demo personas: in production the role comes from the signed-in user\'s Astrato group.' })]),
    status, selHost, formHost, practiceHost, resetHost,
  );
  renderMode(); renderForm(); renderSelected(); renderPractice(); renderReset();

  /** Once the page has loaded: remove the setup rows the CSV importer needed (type inference), if still there. */
  const ready = async () => {
    try {
      const seed = await q({ dims: ['Flag ID'], measures: ['Flags Raised'], filters: [{ fieldKey: keyOf('Flag ID'), operator: 'inList', values: ['SEED-0000'] }] });
      if (!seed.length) return;
      const was = mode; mode = 'live';
      try {
        await write({ view: FLAGS, operation: 'delete', keys: { fields: [F('Flag ID')], values: [['SEED-0000']] } });
        await write({ view: EVENTS, operation: 'delete', keys: { fields: [F('Event ID')], values: [['SEED-0000']] } });
      } finally { mode = was; }
      console.info('[workflow] setup rows removed');
      await onWritten();
    } catch (error) {
      if (/not enabled|cannot write|forbidden|403/i.test(String(error?.message))) { canWrite = false; renderMode(); renderReset(); }
      console.warn('[workflow] setup cleanup', error?.message ?? error);
    }
  };
  window.__wf = {
    sessionFlags, decide, get current() { return current; }, get mode() { return mode; }, get writes() { return writes; },
    setActing: (k) => { actingSel.value = k; actingSel.dispatchEvent(new Event('change')); }, setMode,
  };
  return { prefillFromSelection, ready };
};
