/** Write tools/types.txt (TABLE.COLUMN=type) from the CSVs, mirroring the CTAS casting rules used to build MOCK_DATA.NSC_*. */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
const DIR = new URL('../load/', import.meta.url);
const INTS = new Set(['VERSION', 'Q_INDEX', 'REPORTED_FLAG', 'CUSTOMERS', 'HEADCOUNT', 'DSO_DAYS', 'IS_CURRENT', 'UW_HOLD_YEARS', 'STATUS_SCORE', 'VINTAGE']);
const out = [];
const typeOf = (col, vals) => {
  const v = vals.find((x) => x !== '' && x != null) ?? '';
  if (/^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d$/.test(v)) return 'timestamp';
  if (/^\d{4}-\d\d-\d\d$/.test(v)) return 'date';
  if (vals.every((x) => x === '' || /^-?\d+(\.\d+)?(e-?\d+)?$/i.test(x))) return /COUNT$|YEAR$/.test(col) || INTS.has(col) ? 'int' : 'float';
  return 'string';
};
const split = (line) => { const r = []; let cur = '', q = false; for (let i = 0; i < line.length; i++) { const ch = line[i]; if (q) { if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (ch === '"') q = false; else cur += ch; } else if (ch === '"') q = true; else if (ch === ',') { r.push(cur); cur = ''; } else cur += ch; } r.push(cur); return r; };
for (const f of readdirSync(DIR).filter((x) => x.endsWith('.csv'))) {
  const t = f.replace('.csv', '');
  const lines = readFileSync(new URL(f, DIR), 'utf8').split('\n');
  const head = split(lines[0]);
  const rows = lines.slice(1, 400).map(split);
  head.forEach((c, i) => out.push(`${t}.${c === 'CURRENT' ? 'CURRENT_VALUE' : c}=${typeOf(c, rows.map((r) => r[i]))}`));
}
out.push('NSC_VALUATIONS.FV_PER_TURN=float', 'NSC_DEBT_FACILITIES.FLOATING_DRAWN=float');
for (const [c, t] of Object.entries({ COMPANY_ID: 'string', COMPANY: 'string', QUARTER: 'string', YEAR: 'int', Q_INDEX: 'int', PERIOD_FLAG: 'string', LTM_BUCKET: 'string', STATEMENT: 'string', LINE_ORDER: 'int', LINE_ITEM: 'string', LINE_TYPE: 'string', AMOUNT: 'float', BUDGET_AMOUNT: 'float', FORECAST_AMOUNT: 'float', PY_AMOUNT: 'float', SOURCE_SYSTEM: 'string', LINE_COUNT: 'int' })) out.push(`NSC_STATEMENT_LINES.${c}=${t}`);
for (const l of [...out]) for (const [a, b] of [['NSC_VALUATIONS.', 'NSC_VALUATIONS_SEED.'], ['NSC_PLANS.', 'NSC_PLANS_SEED.']]) if (l.startsWith(a)) out.push(l.replace(a, b));
writeFileSync(new URL('./types.txt', import.meta.url), out.join(' '));
console.log(out.length, 'columns');
