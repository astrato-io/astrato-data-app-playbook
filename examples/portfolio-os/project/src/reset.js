/** Reset demo: restore seeded valuation and plan rows (from the *_SEED views) and remove workflow records created during demos. */
import { M } from './data.js';
import { store } from './core.js';

const F = (name, valueType = 'string') => ({ name, valueType });
export const resetDemo = async (ctx) => {
  const write = async (req) => { try { await window.__ctx?.writeRaw?.(req); } catch (e) { console.warn('[reset]', e); } };
  // valuations back to seed
  const seed = await ctx.q({ dims: ['Company', 'Quarter', 'Method', 'Multiple', 'Enterprise Value', 'Equity Value', 'Fair Value', 'Valuation Movement', 'Bridge Multiple', 'Gross Moic', 'Gross Irr', 'Status', 'Is Current', 'Approved By', 'Version'].map((n) => [n, 'Valuation Seed']), limit: 500 }).catch(() => []);
  for (const s of seed.filter((r) => r.Quarter === '2026-Q3' || Number(r['Is Current']) === 1)) {
    const cur = M.vals.find((v) => v.Company === s.Company && v.Quarter === s.Quarter);
    if (cur && cur['Fair Value'] === Number(s['Fair Value']) && cur.Status === s.Status && cur['Is Current'] === Number(s['Is Current'])) continue;
    await write({ view: 'Valuations', operation: 'update', fields: ['Method', ['Multiple', 'number'], ['Enterprise Value', 'number'], ['Equity Value', 'number'], ['Fair Value', 'number'], ['Valuation Movement', 'number'], ['Bridge Multiple', 'number'], ['Gross Moic', 'number'], ['Gross Irr', 'number'], 'Status', ['Is Current', 'number'], 'Approved By', ['Version', 'number']].map((x) => (Array.isArray(x) ? F(...x) : F(x))), values: [['Method', 'Multiple', 'Enterprise Value', 'Equity Value', 'Fair Value', 'Valuation Movement', 'Bridge Multiple', 'Gross Moic', 'Gross Irr', 'Status', 'Is Current', 'Approved By', 'Version'].map((k) => (['Method', 'Status', 'Approved By'].includes(k) ? s[k] ?? '' : Number(s[k])))], keys: { fields: [F('Company'), F('Quarter')], values: [[s.Company, s.Quarter]] } });
  }
  for (const v of M.vals.filter((x) => x['Is Current'] === 1 && !seed.some((s) => s.Company === x.Company && s.Quarter === x.Quarter && Number(s['Is Current']) === 1))) await write({ view: 'Valuations', operation: 'update', fields: [F('Is Current', 'number')], values: [[0]], keys: { fields: [F('Company'), F('Quarter')], values: [[v.Company, v.Quarter]] } });
  // plans: drop adopted plans, re-activate seeded
  for (const p of M.plans.filter((x) => String(x.Plan).startsWith('Approved Operating Plan'))) await write({ view: 'Plans', operation: 'delete', fields: [], values: [], keys: { fields: [F('Plan Id')], values: [[p['Plan Id']]] } });
  for (const p of M.plans.filter((x) => x.Plan === 'Approved Forecast' && x.Status !== 'Active')) await write({ view: 'Plans', operation: 'update', fields: [F('Status')], values: [['Active']], keys: { fields: [F('Plan Id')], values: [[p['Plan Id']]] } });
  // workflow records created in demos (ids not in the seed pattern) are removed; seeded ones are restored by status where tracked
  for (const r of store.records.filter((x) => !/^(MON-|IC-2026-0|ACT-30|SCN-0001)/.test(x.id))) await write({ view: 'Workflow Records', operation: 'delete', fields: [], values: [], keys: { fields: [F('Record Id')], values: [[r.id]] } });
};
