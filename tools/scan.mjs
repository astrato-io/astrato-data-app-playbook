/**
 * Fail if anything private is about to be published.
 *
 *   node tools/scan.mjs            # scan examples/, layers/, patterns/ and the root docs
 *
 * Generic rules run everywhere, including CI: tenant ids, hosted URLs, tokens, e-mail addresses and
 * local paths. A local denylist.local.txt (gitignored) adds private terms, one case-insensitive term
 * per line, on the maintainer's machine; CI runs the generic rules only.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
// Everything tracked, tools included: a public repo publishes every file, not only the docs.
const SCAN = ['.'];
const TEXT = new Set(['.js', '.mjs', '.cjs', '.ts', '.css', '.html', '.json', '.md', '.sql', '.svg', '.yaml', '.yml', '.txt']);

const RULES = [
  // Ids starting with eight zeros are placeholders (the zero id, and stable fakes).
  ['tenant or object id', /\b(?!0{8}-)(?!f{8}-f{4}-f{4}-f{4}-f{12}\b)[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi],
  ['hosted app URL', /https?:\/\/(?!<publication>)[a-z0-9-]+\.[a-z0-9.-]*astrato\.app/gi],
  ['token', /\bya29\.[\w-]{10,}|\beyJ[\w-]{20,}\.[\w-]{10,}|\bsk-[A-Za-z0-9]{20,}/g],
  // A TLD of letters, so `pkg@1.2.3` is not an address.
  // Reserved example domains (RFC 2606: example.com/org and *.example) are placeholders.
  ['e-mail address', /\b[\w.+-]+@(?!example\.(com|org)\b)(?![\w.-]*\.example\b)[\w-]+(\.[\w-]+)*\.[a-z]{2,}\b/gi],
  ['local path', /[A-Z]:[\\/](Users|projects)[\\/]|\/c\/Users\/|AppData[\\/]/g],
];

const denyFile = join(ROOT, 'denylist.local.txt');
if (existsSync(denyFile)) {
  for (const term of readFileSync(denyFile, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    RULES.push([`denylisted term`, new RegExp(`(?<![A-Za-z0-9])${escaped}(?![A-Za-z0-9])`, 'gi')]);
  }
}

// Third-party code that legitimately contains ids or addresses is never committed (vendor/ is gitignored).
// Dot-folders (browser profiles, caches) and screenshot output are gitignored too.
const SKIP = /(^|\/)(node_modules|vendor|dist|shots|\.[^/]+)\/|^denylist\.local\./;
const findings = [];
const visit = (abs) => {
  const rel = relative(ROOT, abs).replaceAll('\\', '/');
  if (SKIP.test(rel + '/')) return;
  if (statSync(abs).isDirectory()) { for (const name of readdirSync(abs)) visit(join(abs, name)); return; }
  if (!TEXT.has(extname(abs).toLowerCase())) return;
  const lines = readFileSync(abs, 'utf8').split('\n');
  lines.forEach((line, i) => {
    for (const [label, pattern] of RULES) {
      for (const match of line.matchAll(pattern)) findings.push(`${rel}:${i + 1}  ${label}: ${match[0].slice(0, 60)}`);
    }
  });
};
for (const entry of SCAN) if (existsSync(join(ROOT, entry))) visit(join(ROOT, entry));

if (findings.length) {
  console.error(findings.join('\n'));
  console.error(`\n${findings.length} finding(s). Fix the source and run the scan again.`);
  process.exit(1);
}
console.log(`scan: 0 findings${existsSync(denyFile) ? ' (with local denylist)' : ' (generic rules only)'}`);
