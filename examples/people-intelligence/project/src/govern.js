/**
 * Data & governance (the architecture and controls behind every number) and the business-question
 * library (every stored question, runnable as a native governed object, and askable).
 */
import { QUESTIONS } from './questions.js';
import { DIM_FIELD } from './model.js';
import { FORMAT } from './formats.js';
import { tileCatalogue, questionOf } from './catalogue.js';

export const mountGovernance = (ctx, grid) => {
  const { el, esc, icon, int } = ctx;
  const box = (ic, t, s) => el('div', { class: 'pi-box' }, [icon(ic), el('div', {}, [el('span', { text: t }), el('small', { text: s })])]);
  const layer = (cls, title, ic, boxes) => el('div', { class: `pi-layer ${cls}` }, [el('h5', {}, [icon(ic), el('span', { text: title })]), el('div', { class: 'pi-boxes' }, boxes)]);
  const flow = (t) => el('div', { class: 'pi-flow' }, [icon('arrow_upward'), el('span', { text: t })]);
  const counts = { dims: ctx.fields.all.filter((f) => f.kind === 'dimension').length, meas: ctx.fields.all.filter((f) => f.kind === 'calculation' || f.kind === 'measure').length, cols: ctx.fields.all.filter((f) => f.kind === 'field').length };
  const chartQs = new Set(tileCatalogue().filter((t) => t.type !== 'filter').map(questionOf)).size;
  grid.append(
    el('figure', { class: 'pi-card span-8' }, [
      el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: 'One integrated experience above the existing data foundation' })]),
      el('p', { class: 'pi-note', style: 'margin:0 0 12px', text: 'Astrato does not replace the SAP replication layer or the cloud data lake. It queries them live through a governed semantic layer and delivers the experience — analytics, conversation, simulation and action — to every HR audience.' }),
      el('div', { class: 'pi-arch' }, [
        layer('', 'Consumers', 'groups', [box('badge', 'HR leaders', 'CHRO, regional HR directors'), box('handshake', 'HR business partners', 'Investigate and act'), box('business_center', 'Business leaders', 'Their units only'), box('query_stats', 'Workforce analysts', 'Authorised, aggregated')]),
        flow('role-based, row-level scoped access'),
        layer('astrato', 'Astrato application experience', 'auto_awesome', [box('schema', 'Governed semantic layer', `${counts.meas} measures · ${counts.dims} dimensions`), box('insights', 'Live analytics & exploration', 'Native objects, no extracts'), box('forum', 'Conversational AI', `${QUESTIONS.length + chartQs} stored business questions`), box('dashboard_customize', 'AI-generated Data Apps', 'This app'), box('tune', 'Scenario modelling', 'Governed baselines'), box('edit_note', 'Writeback & workflow', 'Actions, approvals, audit')]),
        flow('live SQL pushdown · no data copied into Astrato'),
        layer('', 'Semantic & curated data foundation', 'layers', [box('hub', 'SAP replication layer', 'SAP-specific HR semantics'), box('cloud', 'cloud data lake · BigQuery', 'Prepared & curated workforce data')]),
        flow('replication & curation'),
        layer('', 'Source systems', 'dns', [box('badge', 'SAP SuccessFactors', 'EC · Recruiting · Learning · Talent Intelligence Hub · Opportunity Marketplace'), box('apps', 'SAP BTP HR applications', 'Extensions & workflows'), box('account_balance', 'Other SAP HR sources', 'S/4HANA payroll & cost centres'), box('lan', 'Non-SAP HR systems', 'Qualtrics · regional cloud HRIS (Kenya) · local HRIS (United Arab Emirates)')]),
      ]),
      el('div', { class: 'pi-disclaimer', style: 'margin-top:12px' }, [icon('science'), el('span', { text: 'Demonstration: the curated layer here is a clearly labelled synthetic dataset (about 85,000 employees, 15 countries, 8 business units, 24 months) hosted in a demo warehouse that stands in for the cloud data lake. Astrato connects live to BigQuery in exactly the same way. No figure in this app belongs to a real company.' })]),
    ]),
    el('figure', { class: 'pi-card span-4' }, [
      el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: 'Semantic layer at a glance' })]),
      el('div', { class: 'pi-big', style: 'grid-template-columns:1fr 1fr' }, [
        el('div', {}, [el('span', { text: 'Governed measures' }), el('b', { text: int(counts.meas) }), el('i', { text: 'YTD · FYTD · LTM · QoQ · MoM · YoY' })]),
        el('div', {}, [el('span', { text: 'Dimensions' }), el('b', { text: int(counts.dims) }), el('i', { text: `${int(counts.cols)} view columns` })]),
        el('div', {}, [el('span', { text: 'Business questions' }), el('b', { text: int(QUESTIONS.length + chartQs) }), el('i', { text: `${QUESTIONS.length} curated + ${chartQs} behind objects` })]),
        el('div', { class: 'hl' }, [el('span', { text: 'Views · joins' }), el('b', { text: '20 · 34' }), el('i', { text: 'all joins validated' })]),
      ]),
      el('h4', { text: 'Controls in this experience', style: 'font-size:13px;margin:14px 0 6px' }),
      el('ul', { style: 'margin:0;padding-left:18px;font-size:13px;color:#4B5563;line-height:1.6' }, [
        'Persona scope applied to every object and query (region, country, business unit)',
        'Aggregated analytics only — flight risk shown as cohort counts, never individual scores',
        'Executive views never expose employee-level predictions or names',
        'Assistant answers only from stored, governed business questions',
        'Every number traceable to a measure, view and source system',
        'Maker–checker approvals with a full audit trail',
      ].map((t) => el('li', { text: t }))),
    ]),
    el('figure', { class: 'pi-card span-6' }, [
      el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: 'Role-based access' })]),
      el('div', { style: 'overflow-x:auto' }, el('table', { class: 'pi-t' }, [el('tr', {}, ['Persona', 'Data scope', 'Can approve'].map((h) => el('th', { text: h }))),
        ...Object.values(ctx.personas).map((p) => el('tr', { class: p.key === ctx.persona.key ? 'sel' : '' }, [el('td', { html: `<b>${esc(p.name)}</b><div class="pi-note">${esc(p.role)}</div>` }), el('td', { text: p.scopeLabel }), el('td', { text: p.key === 'chro' ? 'All; ≥ £1m investments' : p.key === 'bul' ? 'Technology actions < £1m' : 'Submit only' })]))])),
    ]),
    el('figure', { class: 'pi-card span-6' }, [
      el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: 'Lineage of the headline KPIs' })]),
      el('div', { style: 'overflow-x:auto' }, el('table', { class: 'pi-t' }, [el('tr', {}, ['KPI', 'Governed measure', 'Source system'].map((h) => el('th', { text: h }))),
        ...[['Total workforce', 'Headcount', 'SuccessFactors EC · regional HRIS · local HRIS'], ['Voluntary attrition', 'Voluntary Attrition (rolling 12m)', 'SuccessFactors EC'], ['Critical skills coverage', 'Critical Skills Coverage', 'Talent Intelligence Hub'], ['Workforce cost vs budget', 'Cost vs Budget % FYTD', 'S/4HANA cost centres'], ['Engagement', 'Engagement Index CQ', 'Qualtrics EmployeeXM'], ['Internal mobility', 'Critical Roles with Internal Match', 'Recruiting · Opportunity Marketplace']]
          .map(([k, m, s]) => el('tr', {}, [el('td', { html: `<b>${esc(k)}</b>` }), el('td', { text: m }), el('td', { class: 'pi-note', text: s })]))])),
    ]),
  );
};

export const mountLibrary = (ctx, grid) => {
  const { el, esc, icon } = ctx;
  const out = el('figure', { class: 'pi-card span-12', style: 'display:none' });
  let current = null, tileId = null;
  const run = async (q, btn) => {
    grid.querySelectorAll('.pi-q').forEach((b) => b.classList.toggle('on', b === btn));
    current = q;
    if (tileId) ctx.dropTile(tileId);
    const slot = el('div', { class: 'viz', style: 'height:360px' });
    out.style.display = '';
    out.replaceChildren(el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: q.name }), el('div', { class: 'tools' }, [el('button', { class: 'pi-btn sm primary', onclick: () => ctx.assistant.ask(q.name) }, [icon('auto_awesome'), el('span', { text: 'Ask with narrative' })])])]),
      el('div', { class: 'pi-bq' }, [icon('verified'), el('span', { text: `${q.cat} · ${q.description}` })]), slot);
    out.scrollIntoView({ behavior: 'smooth', block: 'center' });
    const dims = q.dimensions.map((d) => DIM_FIELD[d.name]);
    const filters = (q.filters ?? []).map((f) => [DIM_FIELD[f.dimension][0], DIM_FIELD[f.dimension][1], f.values]);
    const isMonth = q.dimensions[0]?.name === 'Month';
    tileId = await ctx.renderTile({
      title: q.name, type: 'table', dims, measures: q.measures.map((m) => m.name), filters, limit: 200, scope: q.cat === 'Data operations' ? 'none' : 'all',
      sort: [{ by: q.orderBy?.[0] && q.dimensions.find((d) => d.key === q.orderBy[0][0]) ? 'd0' : q.orderBy ? `m${q.measures.findIndex((m) => m.key === q.orderBy[0][0])}` : isMonth ? 'd0' : 'm0', direction: q.orderBy?.[0]?.[1] === 'asc' || isMonth ? 'asc' : 'desc' }],
      ...(dims.length && !isMonth && q.dimensions[0].name !== 'Quarter' && FORMAT[`Monthly ${q.measures[0].name}`] ? { measures: [...q.measures.map((m) => m.name), `Monthly ${q.measures[0].name}`], miniChart: { ref: `m${q.measures.length}`, view: 'Months', field: 'Month', color: '#2B5CE6' }, columnLabels: { [`m${q.measures.length}`]: `${q.measures[0].name} · trend` } } : {}),
    }, slot, { group: 'g-bq' });
  };
  const cats = [...new Set(QUESTIONS.map((q) => q.cat))];
  grid.append(el('figure', { class: 'pi-card span-12' }, [
    el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: `${QUESTIONS.length} curated business questions · stored in the semantic layer` })]),
    el('p', { class: 'pi-note', style: 'margin:0 0 12px', text: 'Click a question to run it as a native governed table (with a trend sparkline where it has one); “Ask with narrative” sends it to the assistant. Every chart on every page is also backed by its own stored question.' }),
    ...cats.map((c) => el('div', { class: 'pi-qcat' }, [el('h4', { text: c }), el('div', { class: 'pi-qlist' }, QUESTIONS.filter((q) => q.cat === c).map((q) => {
      const b = el('button', { class: 'pi-q', onclick: () => run(q, b) }, [icon('help_outline'), el('div', {}, [el('span', { text: q.name }), el('small', { text: q.description })])]);
      return b;
    }))])),
  ]), out);
  ctx.onPersona(() => { if (current) run(current, grid.querySelector('.pi-q.on')); });
};
