/**
 * Mocked-up monthly client-report workflow for Tidewater Media. Maker–checker, kept in localStorage:
 *  1. Data checks — every source synced, and each anomaly the layer flags is explained (Nash drafts it).
 *  2. Commentary — the account manager edits the Nash-drafted "what changed and why".
 *  3. Sign-off — an account director or the head of client services approves or returns it.
 *  4. Delivery — the approved report is emailed to the client contact with the Excel pack.
 */
const KEY = 'tidewater-reports-v1';
export const USERS = ['Aisha Khan (Account Manager)', 'Tom Reid (Account Manager)', 'Dan Osei (Account Manager)', 'Lucy Hart (Account Director)', 'Mabel Bowen (Head of Client Services)'];
const APPROVER = (u) => /Director|Head of/.test(u);
export const CONTACTS = {
  'Glow & Co Skincare': ['Priya Mehta, Head of Growth', 'priya@glowandco.example'],
  'Northfield Furniture': ['James Holt, Marketing Director', 'j.holt@northfield.example'],
  'Peak Outdoor Gear': ['Sam Carter, E-commerce Manager', 'sam@peakoutdoor.example'],
  'Copperpot Coffee': ['Ella Fraser, Founder', 'ella@copperpot.example'],
  'Harbour Dental Group': ['Dr Neil Shah, Practice Group Lead', 'neil.shah@harbourdental.example'],
  'Brightlane Energy': ['Rachel Green, Acquisition Lead', 'r.green@brightlane.example'],
  'Kingsway Law': ['Oliver Grant, Partner', 'o.grant@kingswaylaw.example'],
  'UrbanFit Gyms': ['Maya Lewis, Marketing Manager', 'maya@urbanfit.example'],
};
const SOURCES = [['Google Ads', 'synced 06:00 today', 'ok'], ['Meta Ads Manager', 'synced 06:02 today', 'ok'], ['GA4', 'synced 05:45 today', 'ok'], ['Google Search Console', '2-day reporting lag (normal)', 'lag']];
const STEPS = ['Draft', 'In review', 'Approved', 'Sent'];
const SEED = () => ({
  user: USERS[0], client: 'Glow & Co Skincare',
  reports: {
    'Copperpot Coffee': { status: 'Sent', commentary: '', explained: {}, approvedBy: 'Lucy Hart (Account Director)', sentAt: '03/10/2026, 09:12' },
    'Kingsway Law': { status: 'Approved', commentary: '', explained: {}, approvedBy: 'Mabel Bowen (Head of Client Services)' },
    'Northfield Furniture': { status: 'In review', commentary: '', explained: {} },
  },
  audit: [
    { at: '03/10/2026, 09:12', who: 'Lucy Hart (Account Director)', what: 'sent the September report to Copperpot Coffee' },
    { at: '02/10/2026, 17:40', who: 'Mabel Bowen (Head of Client Services)', what: 'approved the Kingsway Law September report' },
    { at: '02/10/2026, 15:05', who: 'Tom Reid (Account Manager)', what: 'submitted the Northfield Furniture September report for review' },
  ],
});
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) ?? SEED(); } catch { return SEED(); } };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const now = () => new Date().toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' });
const pill = (s) => `<span class="wf-pill mx-${String(s).toLowerCase().replace(/[^a-z]+/g, '-')}">${esc(s)}</span>`;
export const workflowState = () => load();

/**
 * @param host  grid element of the workflow tab
 * @param api   { facts: () => Promise<F>, explain, commentaryOf, anomaliesOf, send(client, contact, commentary) }
 */
export const mountWorkflows = (host, api) => {
  let S = load();
  let F = null;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* private window */ } };
  const audit = (what) => S.audit.unshift({ at: now(), who: S.user, what });
  const rep = (c) => (S.reports[c] ??= { status: 'Draft', commentary: '', explained: {} });
  api.facts().then((f) => { F = f; render(); }).catch((e) => { console.warn('[workflow]', e); render(); });

  const render = () => {
    if (!F) { host.innerHTML = '<figure class="ob-card full"><figcaption>Loading this month’s numbers from the governed layer…</figcaption></figure>'; return; }
    const client = S.client, R = rep(client);
    if (!R.commentary) R.commentary = api.commentaryOf(F, client);
    const approver = APPROVER(S.user);
    const anomalies = api.anomaliesOf(F, client);
    const open = anomalies.filter((a) => !R.explained[a.id]);
    const step = STEPS.indexOf(R.status);
    const e = api.explain(F, client);
    const [contact, email] = CONTACTS[client] ?? ['Client', 'client@example.com'];
    const rows = F.byClient.slice().sort((a, b) => a.Client.localeCompare(b.Client));
    host.innerHTML = `
      <div class="wf-wfbar ob-card full"><label>Acting as <select data-user>${USERS.map((u) => `<option ${u === S.user ? 'selected' : ''}>${esc(u)}</option>`).join('')}</select></label>
        <span class="wf-note">${approver ? 'Checker: you approve, return and send client reports.' : 'Maker: you check the data, explain anomalies and write the commentary.'}</span>
        <button class="wf-btn ghost" data-reset>Reset demo</button></div>
      <figure class="ob-card full"><figcaption>September 2026 client reports · ${rows.filter((r) => rep(r.Client).status === 'Sent').length} of ${rows.length} sent</figcaption>
        <table class="wf-t"><tr><th>Client</th><th>Account manager</th><th class="r">Conv. value</th><th class="r">MoM</th><th class="r">ROAS</th><th>Anomalies</th><th>Status</th><th></th></tr>
        ${rows.map((r) => { const st = rep(r.Client).status; const an = api.anomaliesOf(F, r.Client); const mom = Number(r['Conversion Value MoM']); return `<tr class="${r.Client === client ? 'mx-sel' : ''}"><td><b>${esc(r.Client)}</b></td><td>${esc(r['Account Manager'])}</td><td class="r">£${Math.round(r['Conversion Value This Month']).toLocaleString('en-GB')}</td><td class="r ${mom < 0 ? 'wf-red' : 'wf-green'}">${mom >= 0 ? '+' : ''}${(mom * 100).toFixed(1)}%</td><td class="r">${Number(r['ROAS This Month']).toFixed(2)}x</td><td>${an.length ? `<span class="wf-pill mx-flag">${an.length} flagged</span>` : '<span class="wf-sub">none</span>'}</td><td>${pill(st)}</td><td><button class="wf-btn ${r.Client === client ? '' : 'ghost'}" data-pick="${esc(r.Client)}">Open</button></td></tr>`; }).join('')}</table></figure>
      <div class="ob-card full ag-steps">${STEPS.map((s, i) => `<div class="${i < step ? 'done' : i === step ? 'now' : ''}"><b>${i + 1}</b><span>${['Check & draft', 'Director review', 'Approved', 'Sent to client'][i]}</span></div>`).join('')}</div>
      <figure class="ob-card full"><figcaption><span>1 · Data checks · ${esc(client)}</span>${pill(R.status)}</figcaption>
        <div class="mx-srcs">${SOURCES.map(([n, d, s]) => `<div class="mx-src ${s}"><b>${s === 'ok' ? '✓' : '◷'} ${n}</b><span>${d}</span></div>`).join('')}</div>
        <table class="wf-t"><tr><th>Anomaly flagged by the layer</th><th>Severity</th><th>Nash’s explanation</th><th>Status</th><th></th></tr>
        ${anomalies.length ? anomalies.map((a) => { const st = R.explained[a.id]; const why = e.bullets.find((b) => b.includes(a.id.split('-').slice(1).join('-'))) ?? e.bullets[0] ?? ''; return `<tr><td><b>${esc(a.what)}</b></td><td>${pill(a.sev)}</td><td class="mx-why">${esc(why)}</td><td>${st ? pill(st) : pill('Open')}</td><td>${!st && R.status === 'Draft' ? `<button class="wf-btn" data-ex="${esc(a.id)}" data-act="Explained">Accept explanation</button><button class="wf-btn ghost" data-ex="${esc(a.id)}" data-act="Escalated">Escalate</button>` : ''}</td></tr>`; }).join('') : '<tr><td colspan="5" class="wf-sub">No anomalies this month.</td></tr>'}</table></figure>
      <figure class="ob-card full"><figcaption><span>2 · Commentary · drafted by Nash from the driver bridges, edited by the account manager</span><button class="wf-btn ghost" data-regen ${R.status === 'Draft' ? '' : 'disabled'}>✦ Regenerate with Nash</button></figcaption>
        ${R.returnedNote ? `<p class="wf-red">Returned: ${esc(R.returnedNote)}</p>` : ''}
        <textarea class="ag-text mx-text" data-comm ${R.status === 'Draft' && !approver ? '' : 'readonly'}>${esc(R.commentary)}</textarea>
        <div class="wf-wfbar" style="margin-top:8px">${R.status === 'Draft' ? `<button class="wf-btn" data-submit ${!approver && open.length === 0 ? '' : 'disabled'}>Submit for sign-off</button><span class="wf-note">${open.length ? `Explain or escalate the ${open.length} open anomal${open.length > 1 ? 'ies' : 'y'} first.` : approver ? 'Switch to an account manager to submit.' : 'Ready to submit.'}</span>` : ''}</div></figure>
      <figure class="ob-card full"><figcaption>3 · Sign-off</figcaption>
        <div class="wf-wfbar">${R.status === 'In review' ? (approver ? `<button class="wf-btn" data-approve>Approve for client</button><input class="ag-input" data-note placeholder="Reason if returning…" /><button class="wf-btn ghost" data-return>Return to account manager</button>` : '<span class="wf-note">Awaiting an account director (switch “Acting as”).</span>') : R.approvedBy ? `<b>✓ Approved</b> by ${esc(R.approvedBy)}${R.approvedAt ? ` at ${esc(R.approvedAt)}` : ''}` : '<span class="wf-note">Not yet submitted.</span>'}</div></figure>
      <figure class="ob-card full"><figcaption>4 · Deliver to ${esc(contact)} · ${esc(email)}</figcaption>
        <div class="wf-wfbar">${R.status === 'Sent' ? `<b>✓ Sent</b> at ${esc(R.sentAt)}` : `<button class="wf-btn red" data-send ${R.status === 'Approved' && approver ? '' : 'disabled'}>✉ Email report + Excel pack</button><label class="wf-note"><input type="checkbox" data-sched ${R.schedule ? 'checked' : ''}/> Send automatically on the 1st working day each month once approved</label>`}</div></figure>
      <figure class="ob-card full"><figcaption>Audit trail</figcaption>
        <table class="wf-t"><tr><th>When</th><th>Who</th><th>What</th></tr>${S.audit.slice(0, 40).map((a) => `<tr><td class="wf-sub">${esc(a.at)}</td><td>${esc(a.who)}</td><td>${esc(a.what)}</td></tr>`).join('')}</table></figure>`;

    host.querySelector('[data-user]').onchange = (ev) => { S.user = ev.target.value; save(); render(); };
    host.querySelector('[data-reset]').onclick = () => { S = SEED(); save(); render(); };
    host.querySelectorAll('[data-pick]').forEach((b) => (b.onclick = () => { S.client = b.dataset.pick; save(); render(); }));
    host.querySelectorAll('[data-ex]').forEach((b) => (b.onclick = () => { R.explained[b.dataset.ex] = b.dataset.act; audit(`${b.dataset.act.toLowerCase()} anomaly “${anomalies.find((a) => a.id === b.dataset.ex)?.what}” for ${client}`); save(); render(); }));
    const comm = host.querySelector('[data-comm]');
    comm.onchange = () => { if (comm.readOnly) return; R.commentary = comm.value; audit(`edited the ${client} commentary`); save(); };
    const regen = host.querySelector('[data-regen]');
    if (regen) regen.onclick = () => { R.commentary = api.commentaryOf(F, client); audit(`regenerated the ${client} commentary with Nash`); save(); render(); };
    const submit = host.querySelector('[data-submit]');
    if (submit) submit.onclick = () => { R.commentary = comm.value; R.status = 'In review'; R.returnedNote = ''; audit(`submitted the ${client} September report for sign-off`); save(); render(); };
    const approve = host.querySelector('[data-approve]');
    if (approve) approve.onclick = () => { R.status = 'Approved'; R.approvedBy = S.user; R.approvedAt = now(); audit(`approved the ${client} September report`); save(); render(); };
    const ret = host.querySelector('[data-return]');
    if (ret) ret.onclick = () => { R.status = 'Draft'; R.returnedNote = host.querySelector('[data-note]').value || 'Please tighten the commentary.'; audit(`returned the ${client} report: ${R.returnedNote}`); save(); render(); };
    const sched = host.querySelector('[data-sched]');
    if (sched) sched.onchange = () => { R.schedule = sched.checked; audit(`${sched.checked ? 'enabled' : 'disabled'} monthly auto-send for ${client}`); save(); };
    const sendBtn = host.querySelector('[data-send]');
    if (sendBtn) sendBtn.onclick = async () => {
      sendBtn.disabled = true; sendBtn.textContent = 'Building the pack…';
      try { await api.send(client, [contact, email], R.commentary); R.status = 'Sent'; R.sentAt = now(); audit(`emailed the September report to ${client} (${email})`); save(); } catch (err) { alert(`Send failed: ${err?.message ?? err}`); }
      render();
    };
  };
  render();
  return {
    useCommentary: (client, text) => { S = load(); rep(client).commentary = text; S.client = client; audit(`inserted Nash’s draft into the ${client} report`); save(); render(); },
  };
};
