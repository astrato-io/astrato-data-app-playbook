/**
 * Read an .xlsx with no dependencies and compare two of them sheet by sheet.
 *
 *   node xlsx-diff.mjs unfiltered.xlsx filtered.xlsx [--exempt "Definitions,Audit trail"]
 *
 * Use it to prove an Excel export follows the filters: export once with no filter, once with a
 * filter that narrows every tab, then diff. A sheet whose figures did not change is listed as
 * IGNORES FILTER (exit 1) unless it is exempt (definitions, audit trails, text-only sheets).
 * The smoke test runs the same comparison when the app registers appState.exportProbe.
 *
 * A sheet's "figures" are its numeric cells in order plus its row count. Text cells are left out
 * on purpose: banners name the active filter, so they always change, even when the rows do not.
 */
import { readFileSync } from 'node:fs';
import { inflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

/** Unzip: { path: Buffer } for every entry, from the central directory. */
export function unzip(buf) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error('not a zip file (no end of central directory)');
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  const files = {};
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('bad central directory entry');
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const local = buf.readUInt32LE(p + 42);
    const name = buf.toString('utf8', p + 46, p + 46 + nameLen);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    files[name] = method === 0 ? raw : method === 8 ? inflateRawSync(raw) : null;
    p += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const attr = (tag, name) => tag.match(new RegExp(`\\b${name}="([^"]*)"`))?.[1];

/** [{ name, rows, numbers: number[] }] in workbook order. */
export function readSheets(buf) {
  const files = unzip(buf);
  const text = (p) => files[p]?.toString('utf8') ?? '';
  const rels = Object.fromEntries([...text('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b[^>]*>/g)]
    .map(([t]) => [attr(t, 'Id'), attr(t, 'Target')]));
  const shared = [...text('xl/sharedStrings.xml').matchAll(/<si>([\s\S]*?)<\/si>/g)].map(([, s]) => s);
  return [...text('xl/workbook.xml').matchAll(/<sheet\b[^>]*>/g)].map(([t], i) => {
    const target = rels[attr(t, 'r:id')] ?? `worksheets/sheet${i + 1}.xml`;
    const xml = text(target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`);
    const numbers = [];
    for (const [, open, body] of xml.matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const type = attr(open, 't');
      if (type && type !== 'n') continue;              // strings, inline strings, booleans, errors
      const v = body?.match(/<v>([^<]*)<\/v>/)?.[1];
      if (v != null && v !== '') numbers.push(Number(v));
    }
    const rows = (xml.match(/<row\b/g) ?? []).length;
    return { name: attr(t, 'name').replace(/&amp;/g, '&'), rows, numbers, sharedStrings: shared.length };
  });
}

/** Compare two workbooks. Returns { sheets: [{ name, status, detail }], ignoring: [names] }. */
export function diffWorkbooks(before, after, exempt = []) {
  const a = readSheets(before);
  const b = Object.fromEntries(readSheets(after).map((s) => [s.name, s]));
  const isExempt = (name) => exempt.some((e) => e && name.toLowerCase() === e.toLowerCase());
  const sheets = a.map((s) => {
    const t = b[s.name];
    if (!t) return { name: s.name, status: 'missing', detail: 'not in the filtered export' };
    if (isExempt(s.name)) return { name: s.name, status: 'exempt', detail: '' };
    if (!s.numbers.length && !t.numbers.length) return { name: s.name, status: 'no figures', detail: 'text only, not compared' };
    const same = s.rows === t.rows && s.numbers.length === t.numbers.length && s.numbers.every((v, i) => v === t.numbers[i]);
    return same
      ? { name: s.name, status: 'IGNORES FILTER', detail: `same ${s.numbers.length} figures in ${s.rows} rows with and without the filter` }
      : { name: s.name, status: 'follows filter', detail: `${s.rows}→${t.rows} rows, ${s.numbers.length}→${t.numbers.length} figures` };
  });
  return { sheets, ignoring: sheets.filter((s) => s.status === 'IGNORES FILTER' || s.status === 'missing').map((s) => s.name) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const args = process.argv.slice(2);
  const files = args.filter((x) => !x.startsWith('--') && args[args.indexOf(x) - 1] !== '--exempt');
  if (files.length !== 2) { console.error('usage: node xlsx-diff.mjs unfiltered.xlsx filtered.xlsx [--exempt "Sheet A,Sheet B"]'); process.exit(2); }
  const exempt = args.includes('--exempt') ? args[args.indexOf('--exempt') + 1].split(',').map((s) => s.trim()) : [];
  const { sheets, ignoring } = diffWorkbooks(readFileSync(files[0]), readFileSync(files[1]), exempt);
  for (const s of sheets) console.log(`${s.status.padEnd(15)} ${s.name}${s.detail ? `  (${s.detail})` : ''}`);
  if (ignoring.length) { console.log(`FAIL: ${ignoring.length} sheet(s) do not follow the filter`); process.exit(1); }
  console.log('PASS: every compared sheet follows the filter');
}
