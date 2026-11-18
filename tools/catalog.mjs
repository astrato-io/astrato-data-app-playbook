/**
 * Build catalog.json from examples/<slug>/example.yaml and patterns/*.md.
 *
 *   node tools/catalog.mjs           # write catalog.json
 *   node tools/catalog.mjs --check   # fail if a card is invalid or catalog.json is stale (CI)
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');

const VOCAB = {
  archetype: ['command-centre', 'workbench', 'explorer', 'story', 'report', 'planner', 'monitor'],
  capabilities: ["report-builder","assistant","writeback-workflow","simulated-workflow","what-if","excel-export","pdf-export","data-blending","story-mode","drill-down","narrative-headline","record-drawer","saved-views","role-switcher","alerting","map"],
};
const REQUIRED = ['slug', 'title', 'company', 'layer', 'summary', 'industry', 'function', 'persona', 'archetype',
  'look', 'tabs', 'patterns', 'charts', 'interactions', 'workflows', 'writeback', 'exports', 'start_here', 'stealable', 'caveats'];

const errors = [];
const patternDir = join(ROOT, 'patterns');
const patterns = existsSync(patternDir)
  ? readdirSync(patternDir).sort().filter((f) => f.endsWith('.md') && f !== 'README.md').map((f) => {
    const text = readFileSync(join(patternDir, f), 'utf8').replace(/\r/g, ''); // same output on Windows checkouts and CI
    const title = /^# (.+)$/m.exec(text)?.[1] ?? f;
    const summary = text.split('\n').find((l) => l.trim() && !l.startsWith('#'))?.trim() ?? '';
    return { slug: f.replace(/\.md$/, ''), title, summary, path: `patterns/${f}` };
  })
  : [];
const patternSlugs = new Set(patterns.map((p) => p.slug));

const layers = existsSync(join(ROOT, 'layers')) ? readdirSync(join(ROOT, 'layers')).sort().map((slug) => {
  const snap = JSON.parse(readFileSync(join(ROOT, 'layers', slug, 'layer.json'), 'utf8'));
  return {
    slug,
    name: snap.name,
    views: Object.keys(snap.views ?? {}).length,
    joins: (snap.joins ?? []).length,
    dimensions: Object.keys(snap.dimensions ?? {}).length,
    measures: Object.keys(snap.measures ?? {}).length,
    questions: Object.keys(snap.businessQuestions ?? {}).length,
    path: `layers/${slug}/`,
  };
}) : [];
const layerSlugs = new Set(layers.map((l) => l.slug));

const examples = [];
for (const slug of readdirSync(join(ROOT, 'examples')).sort()) {
  const file = join(ROOT, 'examples', slug, 'example.yaml');
  if (!existsSync(file)) { errors.push(`${slug}: no example.yaml`); continue; }
  const card = parse(readFileSync(file, 'utf8'));
  for (const key of REQUIRED) {
    const v = card[key];
    if (v === undefined || v === null || v === '') errors.push(`${slug}: ${key} is empty`);
  }
  if (card.slug !== slug) errors.push(`${slug}: slug "${card.slug}" does not match the folder`);
  if (!layerSlugs.has(card.layer)) errors.push(`${slug}: layer "${card.layer}" is not in layers/`);
  if (card.archetype && !VOCAB.archetype.includes(card.archetype)) errors.push(`${slug}: archetype "${card.archetype}" is not in the vocabulary`);
  for (const p of card.patterns ?? []) if (!patternSlugs.has(p)) errors.push(`${slug}: pattern "${p}" has no patterns/${p}.md`);
  for (const c of card.capabilities ?? []) {
    const name = String(c).split(' — ')[0].trim();
    if (!VOCAB.capabilities.includes(name)) errors.push(`${slug}: capability "${name}" is not in the vocabulary`);
  }
  for (const s of [...(card.start_here ?? []), ...(card.stealable ?? []), ...(card.capabilities ?? [])]) {
    const ref = /(project\/[^\s:]+?)(?::(\d+))?(?:\s|$)/.exec(s);
    if (!ref) continue;
    const target = join(ROOT, 'examples', slug, ref[1]);
    if (!existsSync(target)) { errors.push(`${slug}: ${ref[1]} does not exist`); continue; }
    if (ref[2] && Number(ref[2]) > readFileSync(target, 'utf8').split('\n').length) errors.push(`${slug}: ${ref[1]}:${ref[2]} is past the end of the file`);
  }
  const shots = join(ROOT, 'examples', slug, 'screenshots');
  examples.push({
    ...card,
    path: `examples/${slug}/`,
    readme: `examples/${slug}/README.md`,
    screenshots: existsSync(shots) ? readdirSync(shots).sort().filter((f) => /\.(png|webp|jpe?g)$/i.test(f)).map((f) => `examples/${slug}/screenshots/${f}`) : [],
  });
}
for (const p of patterns) {
  if (!examples.some((e) => e.patterns?.includes(p.slug))) errors.push(`pattern ${p.slug}: no example uses it`);
}

const catalog = {
  about: 'Reference Astrato Apps with their semantic layers. Pick examples by industry, function, archetype, patterns and charts; open README.md and start_here. See AGENTS.md.',
  examples,
  patterns: patterns.map((p) => ({ ...p, examples: examples.filter((e) => e.patterns?.includes(p.slug)).map((e) => e.slug) })),
  layers: layers.map((l) => ({ ...l, examples: examples.filter((e) => e.layer === l.slug).map((e) => e.slug) })),
  // "Which example has a report builder?" — every capability with where each example builds it.
  capabilities: Object.fromEntries(VOCAB.capabilities.map((c) => [c, examples.flatMap((e) => (e.capabilities ?? [])
    .filter((x) => String(x).split(' — ')[0].trim() === c)
    .map((x) => ({ example: e.slug, where: String(x).split(' — ')[1]?.trim() ?? '' })))]).filter(([, v]) => v.length)),
};
const text = JSON.stringify(catalog, null, 2) + '\n';

if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
const out = join(ROOT, 'catalog.json');
if (check) {
  if (!existsSync(out) || readFileSync(out, 'utf8') !== text) {
    const have = existsSync(out) ? readFileSync(out, 'utf8').split('\n') : [];
    const want = text.split('\n');
    const at = want.findIndex((l, i) => l !== have[i]);
    console.error(`catalog.json is stale at line ${at + 1}: expected ${JSON.stringify(want[at])}, found ${JSON.stringify(have[at])}. Run \`npm run catalog\` and commit it.`);
    process.exit(1);
  }
  console.log(`catalog: ${examples.length} examples, ${patterns.length} patterns, ${layers.length} layers, up to date`);
} else {
  writeFileSync(out, text);
  console.log(`catalog: ${examples.length} examples, ${patterns.length} patterns, ${layers.length} layers -> catalog.json`);
}
