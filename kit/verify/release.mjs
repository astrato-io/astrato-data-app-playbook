/**
 * Release gate: build -> smoke the build locally -> publish -> smoke the live copy.
 * Stops at the first failure, so a broken build never reaches the publication.
 *
 *   node release.mjs --local <local sign-in URL> --publication <id> --live <live URL> [--project .]
 *                    [--host https://app.astrato.io] [-- <extra smoke.mjs flags>]
 *
 * --local is the "sign in to this local app" link printed by `astrato dev`, serving the BUILT
 * output. --publication and --live can come from a gitignored publication.local.json
 * ({ "id": "…", "live": "https://…" }) in the project instead; never commit them to a public
 * repo. Needs the Astrato CLI on PATH and a signed-in session (`astrato status`).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const split = argv.indexOf('--');
const own = split === -1 ? argv : argv.slice(0, split);
const smokeFlags = split === -1 ? [] : argv.slice(split + 1);
const opt = (name, fallback) => (own.includes(name) ? own[own.indexOf(name) + 1] : fallback);
const project = resolve(opt('--project', '.'));
const saved = existsSync(join(project, 'publication.local.json')) ? JSON.parse(readFileSync(join(project, 'publication.local.json'), 'utf8')) : {};
const local = opt('--local');
const publication = opt('--publication', saved.id);
const live = opt('--live', saved.live);
const host = opt('--host', saved.host);
if (!local || !publication || !live) { console.error('usage: node release.mjs --local <url> --publication <id> --live <url> [--project .] [--host <origin>]'); process.exit(2); }

const SMOKE = fileURLToPath(new URL('./smoke.mjs', import.meta.url));
const astrato = (args) => execFileSync('astrato', [...(host ? ['--host', host] : []), ...args], { cwd: project, encoding: 'utf8', shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'inherit'] });
const json = (text) => JSON.parse(text.trim().split('\n').pop());

function step(label, run, afterPublish = false) {
  console.log(`\n== ${label}`);
  try { return run(); } catch (error) {
    process.stdout.write(String(error.stdout ?? error.message ?? ''));
    console.error(afterPublish
      ? `\nALERT: ${label} failed. The new version IS live: fix and release again.`
      : `\nSTOP: ${label} failed. Nothing was published.`);
    process.exit(1);
  }
}
const smoke = (target, out) => execFileSync(process.execPath, [SMOKE, target, '--out', join(project, out), ...smokeFlags], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] });

step('build', () => astrato(['build', '.']));
console.log(step('smoke (local build)', () => smoke(local, 'shots/smoke-local')));
const version = step('read publication', () => json(astrato(['--json', 'publications', 'get', publication])).publication.version);
const result = step('publish', () => json(astrato(['--json', 'publish', '.', '--publication-id', publication, '--expected-version', String(version), '--idempotency-key', `release-${Date.now()}`])));
if (result.ok === false) { console.error(`STOP: publish refused: ${JSON.stringify(result.error).slice(0, 400)}`); process.exit(1); }
console.log(`published version ${result.publication?.version ?? '?'}`);
console.log(step('smoke (live)', () => smoke(live, 'shots/smoke-live'), true));
console.log('\nRELEASED and verified live. Now open the live link as a non-owner.');
