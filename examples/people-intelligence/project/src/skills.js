/**
 * Skills & Future Workforce panels: the Skills Adjacency Explorer and build · buy · borrow options for
 * a target skill. Both read the governed skills inventory, reskilling pool and skills taxonomy and show
 * their assumptions; choosing a skill also narrows the page's native objects.
 */
const N = (v) => Number(v ?? 0);
const STRATEGIC = ['Cloud Engineering', 'AI & Machine Learning', 'Cybersecurity', 'Data Engineering', 'Network Automation', 'Digital Product Management'];

export const mountSkillsPanels = (ctx, { adjx, bbb }) => {
  const { el, esc, icon, gbp, pct, int } = ctx;
  let target = 'Cloud Engineering';
  const picker = () => {
    const s = el('select', { class: 'pi-select', 'aria-label': 'Target skill' }, STRATEGIC.map((k) => el('option', { value: k, text: k })));
    s.value = target;
    s.onchange = () => { target = s.value; ctx.select('g-sk', 'Skill', 'Skills', [target]); render(); };
    return s;
  };
  let run = 0;
  const render = async () => {
    const my = ++run;
    adjx.replaceChildren(el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: 'Skills Adjacency Explorer' }), el('div', { class: 'tools' }, picker())]), el('div', { class: 'pi-skel' }), el('div', { class: 'pi-skel' }));
    bbb.replaceChildren(el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: 'Build · buy · borrow' })]), el('div', { class: 'pi-skel' }));
    try {
      const [paths, [gap] = [{}], [tax] = [{}], [pool] = [{}]] = await Promise.all([
        ctx.q({ dims: [['From Skill', 'Reskilling Pool']], measures: ['Adjacent Employees', 'Ready-now Employees', 'Expected Conversions', 'Reskilling Programme Cost', 'Average Reskilling Weeks', 'Average Adjacency Score'], filters: [['To Skill', 'Reskilling Pool', [target]]], limit: 20 }),
        ctx.q({ measures: ['Capability Gap 2028', 'Required FTE 2028', 'Projected Supply 2028', 'Skills Coverage', 'Proficient Employees'], filters: [['Skill', 'Skills', [target]]], limit: 1 }),
        ctx.q({ measures: ['Build Cost per FTE', 'Buy Cost per FTE', 'Borrow Day Rate'], filters: [['Skill', 'Skills', [target]]], limit: 1, scope: 'none' }),
        ctx.q({ measures: ['Adjacent Employees', 'Ready-now Employees', 'Expected Conversions', 'Reskilling Programme Cost'], filters: [['To Skill', 'Reskilling Pool', [target]]], limit: 1 }),
      ]);
      if (my !== run) return;
      const G = Math.max(0, N(gap['Capability Gap 2028']));
      const adj = N(pool['Adjacent Employees']), conv = N(pool['Expected Conversions']);
      const closes = G ? Math.min(1, conv / G) : 0;
      const sorted = [...paths].sort((a, b) => N(b['Adjacent Employees']) - N(a['Adjacent Employees']));
      adjx.replaceChildren(
        el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: 'Skills Adjacency Explorer' }), el('div', { class: 'tools' }, picker())]),
        el('p', { class: 'pi-narr', html: `<span class="mi">auto_awesome</span> The Group has <b>${int(adj)} employees</b> with adjacent capabilities suitable for <b>${esc(target.toLowerCase())}</b> reskilling${N(pool['Ready-now Employees']) ? ` (${int(pool['Ready-now Employees'])} ready now)` : ''}. A targeted programme could close <b>${pct(closes, 0)}</b> of the projected ${int(G)}-FTE capability gap by 2028.` }),
        el('div', { style: 'overflow-x:auto;margin-top:10px' }, el('table', { class: 'pi-t' }, [el('tr', {}, ['From skill', 'Adjacent', 'Ready now', 'Expected', 'Weeks', 'Adjacency'].map((h, i) => el('th', { class: i ? 'r' : '', text: h }))),
          ...sorted.map((r) => el('tr', {}, [el('td', { html: `<b>${esc(r['From Skill'])}</b>` }), el('td', { class: 'r', text: int(r['Adjacent Employees']) }), el('td', { class: 'r', text: int(r['Ready-now Employees']) }), el('td', { class: 'r', text: int(r['Expected Conversions']) }), el('td', { class: 'r', text: N(r['Average Reskilling Weeks']).toFixed(0) }), el('td', { class: 'r', text: N(r['Average Adjacency Score']).toFixed(2) })]))])),
        el('p', { class: 'pi-note', style: 'margin-top:6px', html: '<span class="mi">info</span> Assumptions: adjacency from the Opportunity Marketplace skills graph; expected = adjacent × programme success rate (45–85% by pathway); gap = 2028 requirement − projected supply with no intervention.' }),
        el('div', { class: 'pi-actions-row', style: 'margin-top:10px' }, [
          el('button', { class: 'pi-btn sm', onclick: () => { ctx.select('g-sk', 'Skill', 'Skills', [target]); document.querySelector('[data-slot="s-sankey"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); } }, [icon('group'), el('span', { text: 'Explore candidates' })]),
          el('button', { class: 'pi-btn sm', onclick: () => bbb.scrollIntoView({ behavior: 'smooth', block: 'center' }) }, [icon('calculate'), el('span', { text: 'Estimate investment' })]),
          el('button', { class: 'pi-btn sm primary', onclick: () => ctx.actions.openCreate({ name: `${target} Reskilling Programme`, type: 'Reskilling', bu: 'Technology', country: 'Group', owner: 'Priya Nair (BU Leader, Technology)', metric: `${target} coverage`, baseline: N(gap['Skills Coverage']), target: Math.min(1, N(gap['Skills Coverage']) + 0.1), investment: Math.round(N(pool['Reskilling Programme Cost']) * 0.5), benefit: Math.round(conv * (N(tax['Buy Cost per FTE']) - N(tax['Build Cost per FTE']))), insight: `Opportunity | ${target} skills gap`, evidence: { page: 'sk' } }) }, [icon('rocket_launch'), el('span', { text: 'Initiate a programme' })]),
        ]),
      );
      // build · buy · borrow
      const build = Math.min(G, conv), rest = Math.max(0, G - build), buy = rest * 0.6, borrow = rest * 0.4;
      const cBuild = build * N(tax['Build Cost per FTE']), cBuy = buy * N(tax['Buy Cost per FTE']), cBorrow = borrow * N(tax['Borrow Day Rate']) * 220;
      const all = (k) => G * k;
      bbb.replaceChildren(
        el('div', { class: 'pi-cap' }, [el('span', { class: 't', text: `Build · buy · borrow · ${target}` })]),
        el('div', { class: 'pi-big', style: 'grid-template-columns:repeat(3,1fr)' }, [
          el('div', {}, [el('span', { text: 'Build (reskill)' }), el('b', { text: gbp(N(tax['Build Cost per FTE'])) }), el('i', { text: 'per FTE · 3–7 months' })]),
          el('div', {}, [el('span', { text: 'Buy (hire)' }), el('b', { text: gbp(N(tax['Buy Cost per FTE'])) }), el('i', { text: 'per FTE · 4–6 months to fill' })]),
          el('div', {}, [el('span', { text: 'Borrow (contract)' }), el('b', { text: gbp(N(tax['Borrow Day Rate']) * 220) }), el('i', { text: `per FTE-year · £${int(tax['Borrow Day Rate'])}/day` })]),
        ]),
        el('table', { class: 'pi-t' }, [el('tr', {}, ['Option to close the 2028 gap', 'FTE', 'Cost'].map((h, i) => el('th', { class: i ? 'r' : '', text: h }))),
          el('tr', {}, [el('td', { text: 'All buy' }), el('td', { class: 'r', text: int(G) }), el('td', { class: 'r', text: gbp(all(N(tax['Buy Cost per FTE']))) })]),
          el('tr', {}, [el('td', { text: 'All borrow (one year)' }), el('td', { class: 'r', text: int(G) }), el('td', { class: 'r', text: gbp(all(N(tax['Borrow Day Rate']) * 220)) })]),
          el('tr', { class: 'sel' }, [el('td', { html: '<b>Recommended mix</b> · build first, then buy 60 / borrow 40' }), el('td', { class: 'r', text: `${int(build)} / ${int(buy)} / ${int(borrow)}` }), el('td', { class: 'r', html: `<b>${gbp(cBuild + cBuy + cBorrow)}</b>` })]),
        ]),
        el('p', { class: 'pi-note', style: 'margin-top:8px', text: `Saving vs all-buy: ${gbp(all(N(tax['Buy Cost per FTE'])) - (cBuild + cBuy + cBorrow))}. Unit costs from the governed skills taxonomy; borrow assumes 220 billable days a year.` }),
      );
    } catch (e) { adjx.replaceChildren(el('p', { class: 'pi-note', text: `Skills panel unavailable: ${e?.message ?? e}` })); }
  };
  ctx.onSelection((g) => { if (g !== 'g-sk') return; const v = ctx.valuesOf('g-sk', 'Skill', 'Skills'); if (v.length === 1 && v[0] !== target && STRATEGIC.includes(v[0])) { target = v[0]; render(); } });
  ctx.onPersona(render);
  ctx.onPageMount('sk', render);
};
