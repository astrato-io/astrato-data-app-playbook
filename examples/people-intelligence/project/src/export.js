/**
 * Executive summary export: a branded, multi-sheet Excel workbook built from governed queries
 * (persona-scoped), the current simulator scenario and the action register with its audit trail.
 */
import { workbookBlob } from './xlsx.js';
import { project, LEVERS } from './simulator.js';
import { popLabel } from './home.js';

export const exportWorkbook = async (ctx, btn) => {
  const label = btn.querySelector('span:last-child');
  btn.disabled = true; label.textContent = 'Building…';
  try {
    const K = [['Headcount', 'Headcount PY', 'int', 'ratio', 'SuccessFactors EC'], ['FTE', 'FTE PY', 'int', 'ratio', 'SuccessFactors EC'], ['Voluntary Attrition', 'Voluntary Attrition PY', 'pct', 'pts', 'SuccessFactors EC'], ['Regretted Attrition', 'Regretted Attrition PY', 'pct', 'pts', 'SuccessFactors EC'],
      ['High Performer Attrition', 'High Performer Attrition PY', 'pct', 'pts', 'SuccessFactors EC'], ['Hiring Rate', 'Hiring Rate PY', 'pct', 'pts', 'SuccessFactors EC'], ['Internal Mobility Rate', 'Internal Mobility Rate PY', 'pct', 'pts', 'SuccessFactors EC'],
      ['Absence Rate YTD', 'Absence Rate PY YTD', 'pct2', 'pts', 'SuccessFactors EC'], ['Engagement Index CQ', 'Engagement Index CQ LY', 'dec', 'diff', 'Qualtrics'], ['Intent to Stay CQ', 'Intent to Stay CQ LY', 'pct', 'pts', 'Qualtrics'],
      ['Workforce Cost FYTD', 'Workforce Cost PY FYTD', 'gbpm', 'ratio', 'S/4HANA'], ['Cost vs Budget % FYTD', 'Cost vs Budget % PY FYTD', 'spct', 'pts', 'S/4HANA'], ['Replacement Cost Exposure', 'Replacement Cost Exposure PY', 'gbpm', 'ratio', 'SuccessFactors EC'],
      ['Critical Skills Coverage', 'Critical Skills Coverage PY', 'pct', 'pts', 'Talent Intelligence Hub'], ['Internal Fill Rate YTD', 'Internal Fill Rate PY YTD', 'pct', 'pts', 'SuccessFactors Recruiting']];
    const BU = ['Headcount', 'Headcount YoY', 'Voluntary Attrition', 'Voluntary Attrition vs PY', 'Voluntary Attrition vs P2Q', 'Regretted Attrition', 'Engagement Index CQ', 'Workforce Cost FYTD', 'Cost vs Budget % FYTD', 'Critical Skills Coverage', 'Open Critical Roles', 'Replacement Cost Exposure'];
    const [[t], bus, countries, months, skills] = await Promise.all([
      ctx.q({ measures: K.flatMap(([a, b]) => [a, b]), limit: 1 }),
      ctx.q({ dims: [['Business Unit', 'Business Units']], measures: BU, limit: 20 }),
      ctx.q({ dims: [['Country', 'Countries'], ['Region', 'Countries']], measures: ['Headcount', 'Headcount YoY', 'Voluntary Attrition', 'Voluntary Attrition vs PY', 'Hiring Rate', 'Internal Mobility Rate', 'Payroll Cost per Employee YTD', 'Absence Rate YTD'], limit: 50 }),
      ctx.q({ dims: [['Month', 'Months']], measures: ['Monthly Headcount', 'External Hires', 'Voluntary Leavers', 'Involuntary Leavers', 'Net Movement', 'Rolling Voluntary Attrition', 'Workforce Cost', 'Workforce Budget', 'Absence Rate', 'Engagement Index'], limit: 30 }),
      ctx.q({ dims: [['Skill', 'Skills'], ['Skill Tier', 'Skills']], measures: ['Required FTE', 'Proficient Employees', 'Skills Coverage', 'Skills Coverage vs PY', 'Required FTE 2028', 'Projected Supply 2028', 'Capability Gap 2028', 'Adjacent Employees', 'Open Critical Roles'], limit: 30 }),
    ]);
    const N = (v) => (v == null ? null : Number(v));
    const when = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    const banner = (title, cols) => [[{ v: 'Group HR', s: 'brand' }, { v: title, s: 'title' }, ...Array(Math.max(0, cols - 2)).fill({ v: '', s: 'title' })], [null, { v: `People Intelligence · ${ctx.persona.name}, ${ctx.persona.role} · scope: ${ctx.persona.scopeLabel} · data as of 30 Sep 2026 · generated ${when} · ILLUSTRATIVE SYNTHETIC DATA`, s: 'subtitle' }], []];
    const head = (labels) => labels.map((v, i) => ({ v, s: i ? 'head' : 'headl' }));
    const sheetOf = (name, title, cols, headers, rows, freeze = { row: 4, col: 1 }) => ({ name, cols, freeze, merges: [], rows: [...banner(title, cols.length), head(headers), ...rows] });

    const summary = sheetOf('Executive summary', 'Executive summary', [8, 34, 16, 16, 14, 26], ['', 'Measure', 'Current', 'Comparison', 'Change', 'Source'],
      K.map(([cur, py, f, kind, src]) => [null, { v: cur, s: 'bold' }, { v: N(t[cur]), s: f }, { v: N(t[py]), s: f }, kind === 'ratio' ? { v: N(t[cur]) / N(t[py]) - 1, s: 'spct' } : kind === 'pts' ? { v: (N(t[cur]) - N(t[py])) * 100, s: 'spts' } : { v: N(t[cur]) - N(t[py]), s: 'dec' }, { v: src, s: 'text' }]), { row: 4, col: 0 });
    const buSheet = sheetOf('Business units', 'Business unit scorecard', [26, 12, 10, 12, 12, 12, 12, 12, 14, 12, 12, 10, 14], ['Business unit', ...BU.map((m) => m.replace('Voluntary Attrition', 'Vol. attrition'))],
      bus.sort((a, b) => b.Headcount - a.Headcount).map((r) => [{ v: r['Business Unit'], s: 'bold' }, { v: N(r.Headcount), s: 'int' }, { v: N(r['Headcount YoY']), s: 'spct' }, { v: N(r['Voluntary Attrition']), s: 'pct' }, { v: N(r['Voluntary Attrition vs PY']), s: 'spts' }, { v: N(r['Voluntary Attrition vs P2Q']), s: 'spts' }, { v: N(r['Regretted Attrition']), s: 'pct' }, { v: N(r['Engagement Index CQ']), s: 'dec' }, { v: N(r['Workforce Cost FYTD']), s: 'gbpm' }, { v: N(r['Cost vs Budget % FYTD']), s: 'spct' }, { v: N(r['Critical Skills Coverage']), s: 'pct' }, { v: N(r['Open Critical Roles']), s: 'int' }, { v: N(r['Replacement Cost Exposure']), s: 'gbpm' }]));
    const cSheet = sheetOf('Countries', 'Country scorecard', [18, 24, 12, 10, 12, 12, 10, 10, 14, 10], ['Country', 'Region', 'Headcount', 'vs LY', 'Vol. attrition', 'vs LY (pts)', 'Hiring', 'Mobility', 'Cost / employee', 'Absence'],
      countries.sort((a, b) => b.Headcount - a.Headcount).map((r) => [{ v: r.Country, s: 'bold' }, { v: r.Region, s: 'text' }, { v: N(r.Headcount), s: 'int' }, { v: N(r['Headcount YoY']), s: 'spct' }, { v: N(r['Voluntary Attrition']), s: 'pct' }, { v: N(r['Voluntary Attrition vs PY']), s: 'spts' }, { v: N(r['Hiring Rate']), s: 'pct' }, { v: N(r['Internal Mobility Rate']), s: 'pct' }, { v: N(r['Payroll Cost per Employee YTD']), s: 'gbp' }, { v: N(r['Absence Rate YTD']), s: 'pct2' }]));
    const mSheet = sheetOf('Monthly trend', 'Monthly workforce trend', [10, 12, 10, 10, 10, 10, 12, 14, 14, 10, 10], ['Month', 'Headcount', 'Hires', 'Vol. leavers', 'Invol. leavers', 'Net', 'Vol. attrition (LTM)', 'Workforce cost', 'Budget', 'Absence', 'Engagement'],
      months.sort((a, b) => String(a.Month).localeCompare(b.Month)).map((r) => [{ v: r.Month, s: 'bold' }, { v: N(r['Monthly Headcount']), s: 'int' }, { v: N(r['External Hires']), s: 'int' }, { v: N(r['Voluntary Leavers']), s: 'int' }, { v: N(r['Involuntary Leavers']), s: 'int' }, { v: N(r['Net Movement']), s: 'int' }, { v: N(r['Rolling Voluntary Attrition']), s: 'pct' }, { v: N(r['Workforce Cost']), s: 'gbpm' }, { v: N(r['Workforce Budget']), s: 'gbpm' }, { v: N(r['Absence Rate']), s: 'pct2' }, { v: N(r['Engagement Index']), s: 'dec' }]));
    const sSheet = sheetOf('Skills', 'Skills inventory & 2028 gap', [28, 12, 10, 10, 10, 10, 12, 12, 12, 10, 10], ['Skill', 'Tier', 'Required', 'Proficient', 'Coverage', 'vs LY (pts)', 'Need 2028', 'Supply 2028', 'Gap 2028', 'Adjacent', 'Open crit.'],
      skills.sort((a, b) => b['Capability Gap 2028'] - a['Capability Gap 2028']).map((r) => [{ v: r.Skill, s: 'bold' }, { v: r['Skill Tier'], s: 'text' }, { v: N(r['Required FTE']), s: 'int' }, { v: N(r['Proficient Employees']), s: 'int' }, { v: N(r['Skills Coverage']), s: 'pct' }, { v: N(r['Skills Coverage vs PY']), s: 'spts' }, { v: N(r['Required FTE 2028']), s: 'int' }, { v: N(r['Projected Supply 2028']), s: 'int' }, { v: N(r['Capability Gap 2028']), s: 'int' }, { v: N(r['Adjacent Employees']), s: 'int' }, { v: N(r['Open Critical Roles']), s: 'int' }]));
    const sim = ctx.simulator?.state;
    const p = sim?.base ? project(sim.base, sim.L) : null, z = sim?.base ? project(sim.base, { r: 0, c: 0, ld: 0, m: 0, f: 0 }) : null;
    const simSheet = sheetOf('Scenario', `Workforce scenario · ${sim ? popLabel(sim.pop) : ''}`, [36, 18, 18, 18], ['Lever / outcome', 'Current trajectory', 'Proposed', 'Change'], [
      ...LEVERS.map(([k, l]) => [{ v: l, s: 'bold' }, null, { v: sim ? sim.L[k] : null, s: 'dec' }, null]), [],
      ...(p ? [['Voluntary attrition', z.rate, p.rate, 'pct'], ['Leavers (12m)', z.L1, p.L1, 'int'], ['Employees retained', 0, p.retained, 'int'], ['Replacement cost exposure', z.replacement1, p.replacement1, 'gbpm'], ['Intervention investment', 0, p.investment, 'gbpm'], ['Net financial benefit', 0, p.net, 'gbpm'], ['Critical skills coverage', z.cov1, p.cov1, 'pct'], ['Workforce cost impact', 0, p.costImpact, 'gbpm']]
        .map(([l, a, b, f]) => [{ v: l, s: 'bold' }, { v: a, s: f }, { v: b, s: f }, { v: b - a, s: f === 'pct' ? 'pct' : f === 'gbpm' ? 'sgbpm' : 'int' }]) : [])], { row: 4, col: 1 });
    const acts = ctx.actions.all();
    const aSheet = sheetOf('Actions & audit', 'People actions & audit trail', [10, 44, 22, 32, 14, 10, 14, 14], ['Ref', 'Initiative', 'Business unit', 'Owner', 'Status', 'Due', 'Investment', 'Expected benefit'], [
      ...acts.map((a) => [{ v: a.id, s: 'bold' }, { v: a.name, s: 'text' }, { v: a.bu, s: 'text' }, { v: a.owner, s: 'text' }, { v: a.status, s: 'text' }, { v: a.due, s: 'text' }, { v: N(a.investment), s: 'gbpm' }, { v: N(a.benefit), s: 'gbpm' }]), [],
      head(['When', 'Ref', 'Who', 'What', '', '', '', '']), ...ctx.actions.audit().map((x) => [{ v: x.at, s: 'text' }, { v: x.id, s: 'text' }, { v: x.who, s: 'text' }, { v: x.what, s: 'text' }])]);
    const blob = workbookBlob({ sheets: [summary, buSheet, cSheet, mSheet, sSheet, simSheet, aSheet], title: 'People Intelligence – Executive summary', author: 'Astrato' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `People_Intelligence_${new Date().toISOString().slice(0, 10)}.xlsx` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    window.__lastExport = blob.size;
    ctx.toast(`Executive summary exported · ${Math.round(blob.size / 1024)} KB · 7 sheets`, 'download_done');
  } catch (e) { console.warn('[export]', e); ctx.toast(`Export failed: ${ctx.esc(e?.message ?? e)}`, 'error'); }
  finally { btn.disabled = false; label.textContent = 'Export'; }
};
