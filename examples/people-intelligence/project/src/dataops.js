/**
 * Data operations — integration monitoring, data refresh status and error management.
 *
 * A freshness board per source system (from the orchestration log in the semantic layer), a data-status
 * banner on My People Home, and an issue triage queue: acknowledge, assign, resolve or escalate an
 * issue. Each step is kept in an audit trail and written back to PEOPLE_ACTION_EVENTS like every other
 * workflow step in the app.
 */
const KEY = 'people-issues-v1';
const N = (v) => Number(v ?? 0);
const STATE = { ok: ['Current', '#2E8540', 'check_circle'], warn: ['Degraded', '#D9822B', 'warning'], fail: ['Failing', '#D92D20', 'error'] };

export const mountDataOps = (ctx, { fresh, triage, homeHost }) => {
  const { el, esc, icon, int } = ctx;
  let state = (() => { try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; } })();
  state.overrides ??= {}; state.audit ??= [];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private window */ } };
  let feeds = null, issues = null;

  const load = async () => {
    feeds = await ctx.q({ dims: [['Source System', 'Pipeline Runs'], ['Pipeline', 'Pipeline Runs'], ['Stage', 'Pipeline Runs']], measures: ['Failed Runs Today', 'Runs Today', 'Run Success Rate 7d', 'Failed Runs', 'Runs with Warnings'], scope: 'none', limit: 50 });
    issues = await ctx.q({ dims: [['Issue Id', 'Data Issues'], ['Opened At', 'Data Issues'], ['Severity', 'Data Issues'], ['Category', 'Data Issues'], ['Pipeline', 'Data Issues'], ['Impacted Kpi', 'Data Issues'], ['Owner', 'Data Issues'], ['Status', 'Data Issues'], ['Description', 'Data Issues']], measures: ['Records Affected', 'Issue Age Hours'], scope: 'none', limit: 100 });
    renderFresh(); renderTriage(); renderHome();
  };
  const statusOf = (f) => (N(f['Failed Runs Today']) > 0 ? 'fail' : N(f['Run Success Rate 7d']) < 0.8 ? 'warn' : 'ok');

  const renderHome = () => {
    if (!homeHost || !feeds) return;
    const bad = feeds.filter((f) => statusOf(f) !== 'ok');
    const failing = feeds.filter((f) => statusOf(f) === 'fail');
    const open = all().filter((i) => i.status !== 'Resolved');
    homeHost.replaceChildren(el('div', { class: `pi-datastatus ${failing.length ? 'fail' : bad.length ? 'warn' : 'ok'}` }, [
      icon(failing.length ? 'sync_problem' : 'cloud_done'),
      el('span', { html: `<b>Data status</b> · ${feeds.length - bad.length} of ${feeds.length} feeds current${failing.length ? ` · <b>${esc(failing.map((f) => f.Pipeline).join(', '))}</b> failing — affected figures held at the last good load` : ''} · ${open.length} open data issues` }),
      el('button', { class: 'pi-btn sm', onclick: () => ctx.go('ops') }, [el('span', { text: 'Data operations' }), icon('arrow_forward')]),
    ]));
  };
  const renderFresh = () => {
    if (!fresh || !feeds) return;
    const stages = [...new Set(feeds.map((f) => f.Stage))];
    fresh.replaceChildren(
      el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: 'Refresh status · source to semantic layer · latest runs 30 Sep 2026 · degraded = under 80% clean runs in 7 days' }), el('div', { class: 'tools' }, el('button', { class: 'pi-btn sm ghost', onclick: () => { ctx.toast('Re-run requested for failed feeds · the orchestrator (Cloud Composer) picks it up on the next cycle', 'replay'); log('ALL', 'Requested re-run of failed feeds'); } }, [icon('replay'), el('span', { text: 'Re-run failed' })]))]),
      el('div', { class: 'pi-feeds' }, stages.map((s) => el('div', { class: 'pi-stage' }, [el('h6', { text: s }), ...feeds.filter((f) => f.Stage === s).map((f) => {
        const [label, color, ic] = STATE[statusOf(f)];
        return el('div', { class: 'pi-feed', style: `--c:${color}`, title: `${f['Source System']} · ${f.Pipeline}\nClean runs (7 days): ${Math.round(N(f['Run Success Rate 7d']) * 100)}% · failed this month: ${int(f['Failed Runs'])} · warnings: ${int(f['Runs with Warnings'])}` }, [icon(ic), el('div', {}, [el('b', { text: f.Pipeline }), el('small', { text: `${f['Source System']} · ${label}` })])]);
      })]))),
    );
  };

  const who = () => `${ctx.persona.name} (${ctx.persona.role})`;
  const all = () => (issues ?? []).map((r) => ({ id: r['Issue Id'], opened: r['Opened At'], severity: r.Severity, category: r.Category, pipeline: r.Pipeline, kpi: r['Impacted Kpi'], owner: r.Owner, status: r.Status, desc: r.Description, records: N(r['Records Affected']), age: N(r['Issue Age Hours']), ...(state.overrides[r['Issue Id']] ?? {}) }));
  const EVENT_FIELDS = [['Event Id', 'string'], ['Event At', 'string'], ['Event Month', 'string'], ['Action Id', 'string'], ['Action Name', 'string'], ['Business Unit', 'string'], ['Scope', 'string'], ['Action Type', 'string'], ['Event Type', 'string'], ['Status After', 'string'], ['Actor', 'string'], ['Actor Role', 'string'], ['Owner', 'string'], ['Investment Gbp', 'number'], ['Expected Benefit Gbp', 'number'], ['Note', 'string'], ['Record Source', 'string'], ['Event Count', 'number']];
  const log = (id, what, i = {}) => {
    state.audit.unshift({ at: new Date().toISOString().slice(0, 16).replace('T', ' '), who: who(), id, what }); save();
    const at = state.audit[0].at;
    ctx.writeback('Action Events', EVENT_FIELDS, [[`EV-${Date.now().toString(36).toUpperCase()}`, at, at.slice(0, 7), id, `Data issue ${id}${i.pipeline ? ` · ${i.pipeline}` : ''}`, '', 'Group', 'Data issue', what.split(' ')[0], i.status ?? '', ctx.persona.name, ctx.persona.role, i.owner ?? '', 0, 0, what.slice(0, 500), 'People Intelligence app · data operations', 1]])
      .then((r) => { if (r.written) { ctx.requery('a-log'); ctx.toast(`Written to the warehouse · ${esc(what.split(' ')[0])} ${esc(id)}`, 'cloud_done'); } });
  };
  const update = (id, patch, what) => { state.overrides[id] = { ...(state.overrides[id] ?? {}), ...patch }; const i = all().find((x) => x.id === id); log(id, what, i); renderTriage(); renderHome(); };
  const SEV = { Critical: '#D92D20', High: '#D9822B', Medium: '#13707F', Low: '#7E7E7E' };
  let showResolved = false;
  const renderTriage = () => {
    if (!triage || !issues) return;
    const list = all().filter((i) => showResolved || i.status !== 'Resolved').sort((a, b) => ['Critical', 'High', 'Medium', 'Low'].indexOf(a.severity) - ['Critical', 'High', 'Medium', 'Low'].indexOf(b.severity) || b.age - a.age);
    triage.replaceChildren(
      el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: `Error management · triage queue (${all().filter((i) => i.status !== 'Resolved').length} open)` }), el('div', { class: 'tools' }, [
        el('button', { class: 'pi-btn sm ghost', onclick: () => { showResolved = !showResolved; renderTriage(); } }, [icon(showResolved ? 'visibility_off' : 'history'), el('span', { text: showResolved ? 'Hide resolved' : 'Show resolved' })]),
        el('button', { class: 'pi-btn sm ghost', onclick: () => { state = { overrides: {}, audit: [] }; save(); renderTriage(); renderHome(); } }, [icon('restart_alt'), el('span', { text: 'Reset demo' })]),
      ])]),
      el('div', { class: 'pi-issues' }, list.map((i) => el('div', { class: `pi-issue ${i.status === 'Resolved' ? 'done' : ''}`, style: `--c:${SEV[i.severity] ?? '#7E7E7E'}` }, [
        el('div', { class: 'h' }, [el('span', { class: 'sev', text: i.severity }), el('b', { text: `${i.id} · ${i.category}` }), el('span', { class: `pill ${i.status.toLowerCase().replace(' ', '-')}`, text: i.status }), el('span', { class: 'age', text: i.status === 'Resolved' ? 'resolved' : `${int(i.age)} h open` })]),
        el('div', { class: 'd', text: i.desc }),
        el('div', { class: 'm', html: `<span>${esc(i.pipeline)}</span><span>Impacts: <b>${esc(i.kpi)}</b></span><span>${int(i.records)} records</span><span>Owner: ${esc(i.owner)}</span>` }),
        i.status === 'Resolved' ? null : !['chro', 'rhrd'].includes(ctx.persona.key) ? el('div', { class: 'pi-note', text: 'View only for your role · triage is done by HR data owners (CHRO, regional HR directors)' }) : el('div', { class: 'pi-actions-row' }, [
          i.status === 'Open' ? el('button', { class: 'pi-btn sm', onclick: () => update(i.id, { status: 'In progress', owner: ctx.persona.name }, `Acknowledged — assigned to ${ctx.persona.name}`) }, [icon('front_hand'), el('span', { text: 'Acknowledge' })]) : null,
          el('button', { class: 'pi-btn sm', onclick: () => update(i.id, { owner: 'data lake platform team' }, 'Reassigned to data lake platform team') }, [icon('swap_horiz'), el('span', { text: 'Reassign' })]),
          el('button', { class: 'pi-btn sm', onclick: () => update(i.id, { severity: 'Critical' }, 'Escalated to Critical — HR data owner notified') }, [icon('priority_high'), el('span', { text: 'Escalate' })]),
          el('button', { class: 'pi-btn sm primary', onclick: () => { const note = prompt(`Resolution note for ${i.id}`, i.category === 'Schema drift' ? 'Mapping updated for the new column; load re-run and reconciled' : 'Fixed at source and re-loaded'); if (note != null) update(i.id, { status: 'Resolved' }, `Resolved — “${note}”`); } }, [icon('task_alt'), el('span', { text: 'Resolve' })]),
        ]),
      ]))),
      state.audit.length ? el('details', { class: 'pi-audit' }, [el('summary', { text: `Audit trail (${state.audit.length})` }), ...state.audit.slice(0, 20).map((a) => el('div', { html: `<span>${esc(a.at)}</span> <b>${esc(a.id)}</b> ${esc(a.what)} <i>— ${esc(a.who)}</i>` }))]) : null,
    );
  };
  // The home banner is cheap (two small queries) but waits until the first page has rendered.
  ctx.onPageMount('home', () => setTimeout(() => { if (!feeds) load().catch((e) => console.warn('[dataops]', e)); }, 1200));
  ctx.onPersonaNow(() => renderTriage());
  ctx.onPageMount('ops', () => { if (!feeds) load().catch((e) => console.warn('[dataops]', e)); else { renderFresh(); renderTriage(); } });
  return { status: () => feeds && { feeds: feeds.length, failing: feeds.filter((f) => statusOf(f) === 'fail').map((f) => f.Pipeline), open: all().filter((i) => i.status !== 'Resolved').length } };
};
