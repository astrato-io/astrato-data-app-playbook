/**
 * Look up visualization operations without reading a 200 KB reference.
 *
 *   node ops.mjs <type>                  # list every operation name for a chart type
 *   node ops.mjs <type> <word> [word…]   # print the sections whose operation name contains a word
 *
 * Reads node_modules/@astrato-io/visualizations/docs/operations/<type>.md from the project you
 * run it in (pass --root <dir> otherwise). Listing every name first is the point: scan the whole
 * list before deciding something is impossible, rather than grepping for a guessed word.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const rootAt = args.indexOf('--root');
const root = rootAt === -1 ? process.cwd() : args.splice(rootAt, 2)[1];
const dir = join(root, 'node_modules', '@astrato-io', 'visualizations', 'docs', 'operations');
if (!existsSync(dir)) { console.error(`not found: ${dir}\nRun this in a project with @astrato-io/visualizations installed, or pass --root.`); process.exit(2); }
const [type, ...words] = args;
const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
if (!type) { console.log(files.map((f) => f.replace(/\.md$/, '')).join('\n')); process.exit(0); }
const file = files.find((f) => f.replace(/\.md$/, '') === type) ?? files.find((f) => f.includes(type));
if (!file) { console.error(`no operations file for "${type}". Types: ${files.map((f) => f.replace(/\.md$/, '')).join(', ')}`); process.exit(2); }

// Split on headings; a section is an operation when its heading is a backticked identifier.
const sections = readFileSync(join(dir, file), 'utf8').split(/\n(?=#{2,4} )/);
const named = sections.map((text) => ({ name: /^#{2,4} `([A-Za-z][\w.]*)`/.exec(text)?.[1], text })).filter((s) => s.name);
if (!words.length) {
  console.log(`${file}: ${named.length} operations`);
  console.log(named.map((s) => s.name).join('\n'));
} else {
  const hits = named.filter((s) => words.some((word) => s.name.toLowerCase().includes(word.toLowerCase())));
  if (!hits.length) console.log(`no operation name contains ${words.join(' or ')}; list them all with: node ops.mjs ${type}`);
  for (const hit of hits) console.log(hit.text.trim().replace(/\n{3,}/g, '\n\n'), '\n');
}
