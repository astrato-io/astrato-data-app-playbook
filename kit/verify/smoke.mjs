/**
 * Smoke test: open the app in a real Chrome and fail on anything a viewer would see.
 *
 *   node smoke.mjs <url> [--login] [--out shots] [--widths 1440,1280,1024] [--allow allow.txt]
 *                        [--landing-ms 15000] [--settle-ms 90000] [--check-ms 60000] [--deadline-ms 2400000]
 *                        [--scroll-ok] [--full-page]
 *
 * The app must expose window.__appState (see app-state.js). Checks:
 *   - the app boots: no boot error, no redirect to a sign-in page;
 *   - every declared object settles as "rendered" (objects declared after landing: when the sweep
 *     first shows their tab; report.objects is the landing count, report.objectsAll every object);
 *   - no error text on the page ("failed to render", "could not be rendered", …);
 *   - no request with status >= 400 and no failed request;
 *   - no console error or uncaught exception (allow-list exact substrings with --allow);
 *   - the landing timing ("landing-ready" mark, else "all-settled") is within budget;
 *   - on every tab, at every width: no horizontal page scroll, and no vertical page scroll
 *     unless --scroll-ok; no broken images;
 *   - every app-registered check (appState.check) passes.
 * Evidence: one screenshot per tab per width, and report.json, in --out. --full-page also saves
 * <tab>-<width>-full.png, the whole scrolling page, so content below the fold gets looked at.
 * Exit code 0 = pass, 1 = fail, 2 = usage.
 *
 * It never hangs: every call into the page has its own timeout (a page whose main thread is stuck
 * never answers), a reload of the page under test (a dev-server reload) or a lost Chrome stops the
 * run with a failure, and --deadline-ms (default 40 min) bounds the whole run. Each ends in FAIL,
 * with whatever report.json had gathered by then.
 *
 * Hosted apps need a session. The test keeps its own Chrome profile beside this file
 * (<out>/.chrome-profile, or --profile <dir>; gitignore it). Run once with --login, sign in in the window that opens,
 * close it; later runs reuse the session headlessly. Set CHROME_PATH if Chrome is not found.
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const args = process.argv.slice(2);
const opt = (name, fallback) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback);
const url = args.find((a) => /^https?:/.test(a));
if (!url) { console.error('usage: node smoke.mjs <url> [--login] [--out dir] [--widths 1440,1280,1024] [--allow file] [--scroll-ok] [--full-page]'); process.exit(2); }
const login = args.includes('--login');
const outDir = opt('--out', 'shots/smoke');
const widths = opt('--widths', '1440').split(',').map(Number);
const HEIGHT = Number(opt('--height', 860));
const LANDING_MS = Number(opt('--landing-ms', 15000));
const SETTLE_MS = Number(opt('--settle-ms', 90000));
const CHECK_MS = Number(opt('--check-ms', 60000));
const DEADLINE_MS = Number(opt('--deadline-ms', 40 * 60000));
const CALL_MS = 60000; // one call into the page (a check gets CHECK_MS + 15 s)
const scrollOk = args.includes('--scroll-ok');
const fullPage = args.includes('--full-page');
const FULL_MAX = 16000; // Chrome refuses captures much taller than this
const allowFile = opt('--allow', null);
const allow = allowFile && existsSync(allowFile)
  ? readFileSync(allowFile, 'utf8').split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  : [];
const allowed = (text) => allow.some((a) => text.includes(a));

function findChrome() {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
  ].filter(Boolean);
  const found = candidates.find((p) => existsSync(p));
  if (!found) { console.error('Chrome not found: set CHROME_PATH'); process.exit(2); }
  return found;
}

// One Chrome profile per output folder by default, so runs for different apps never share (and lock)
// one profile. --profile <dir> picks a shared one, e.g. to reuse a hosted sign-in across apps.
const profile = resolve(opt('--profile', join(outDir, '.chrome-profile')));
const port = 9300 + Math.floor(Math.random() * 600);
const chrome = spawn(findChrome(), [
  ...(login ? [] : ['--headless=new']), '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${widths[0]},${HEIGHT + 80}`, 'about:blank',
], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// Wait for Chrome to exit before we do, or the next run finds the profile still locked.
const done = (code) => {
  chrome.once('exit', () => process.exit(code));
  try { chrome.kill(); } catch { /* already gone */ }
  setTimeout(() => process.exit(code), 4000);
};

let target;
for (let i = 0; i < 80 && !target; i++) {
  await sleep(250);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch { /* not up yet */ }
}
if (!target) { console.error('FAIL could not start Chrome'); done(1); await sleep(5000); }
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0;
const pending = new Map();
let aborted = null;         // why the run stopped early: a reload, a lost Chrome, the deadline
let booted = false;         // after boot, a main-frame navigation is a reload under the test
let stage = 'boot';
const consoleErrors = [];
const badRequests = new Map();
const urls = new Map();
const downloads = new Map(); // guid -> { file, state }
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  const p = m.params;
  if (m.method === 'Page.frameNavigated' && !p.frame.parentId && booted && !aborted) aborted = `the page reloaded during ${stage} (${p.frame.url.split('?')[0]}): a dev-server reload? Do not edit watched files during a run`;
  if (m.method === 'Network.requestWillBeSent') urls.set(p.requestId, p.request.url);
  if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(`exception: ${p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text}`.slice(0, 300));
  if (m.method === 'Runtime.consoleAPICalled' && p.type === 'error') consoleErrors.push(`console.error: ${p.args.map((a) => a.value ?? a.description ?? '').join(' ')}`.slice(0, 300));
  if (m.method === 'Network.responseReceived' && p.response.status >= 400) badRequests.set(p.requestId, `${p.response.status} ${p.response.url.split('?')[0]}`);
  if (m.method === 'Page.downloadWillBegin') downloads.set(p.guid, { file: p.suggestedFilename, state: 'started' });
  if (m.method === 'Page.downloadProgress' && downloads.has(p.guid) && p.state !== 'inProgress') downloads.get(p.guid).state = p.state;
  if (m.method === 'Network.loadingFailed' && !p.canceled) badRequests.set(p.requestId, `${p.errorText} ${(urls.get(p.requestId) ?? '').split('?')[0]}`);
});
ws.addEventListener('close', () => { aborted ??= `lost the connection to Chrome during ${stage}`; for (const r of pending.values()) r({ error: { message: 'closed' } }); pending.clear(); });
// Every call resolves: with the answer, or with an error after ms (a page that stopped responding).
const send = (method, params = {}, ms = CALL_MS) => new Promise((r) => {
  const i = ++id;
  const timer = setTimeout(() => { pending.delete(i); r({ error: { message: `no answer within ${ms / 1000}s` } }); }, ms);
  pending.set(i, (m) => { clearTimeout(timer); r(m); });
  try { ws.send(JSON.stringify({ id: i, method, params })); } catch { /* closed: the timer answers */ }
});
// A page that does not answer an evaluate has a stuck main thread: nothing later would answer either.
const evaluate = async (expression, ms) => {
  const m = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, ms);
  if (m.error?.message?.startsWith('no answer') && booted) aborted ??= `the page stopped responding during ${stage} (${m.error.message})`;
  return m.result?.result?.value;
};
const viewport = (width) => send('Emulation.setDeviceMetricsOverride', { width, height: HEIGHT, deviceScaleFactor: 1, mobile: false });

await send('Page.enable');
// Files the app downloads (an Excel report, a CSV) land in <out>/downloads and are listed in report.json.
const downloadDir = resolve(outDir, 'downloads');
mkdirSync(downloadDir, { recursive: true });
await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: downloadDir });
await send('Runtime.enable');
await send('Network.enable');
await viewport(widths[0]);
await send('Page.navigate', { url });

if (login) {
  console.log('Sign in in the Chrome window that opened, wait for the app to load, then close the window.');
  await new Promise((r) => chrome.on('exit', r));
  console.log('Session saved. Run again without --login.');
  process.exit(0);
}

const fail = [];
const report = { url, widths, tabs: [], checks: [] };
let finished = false;
// Writes report.json and exits once Chrome has gone. Called at the end, or early on the deadline.
async function finish() {
  if (finished) return;
  finished = true;
  if (aborted) fail.push(aborted);
  const requests = [...new Set(badRequests.values())].filter((x) => !/favicon\.ico/i.test(x) && !allowed(x));
  if (requests.length) fail.push(`failed requests: ${requests.slice(0, 10).join(' | ')}`);
  const errors = [...new Set(consoleErrors)].filter((x) => !allowed(x));
  if (errors.length) fail.push(`console errors: ${errors.slice(0, 8).join(' | ')}`);
  // Give downloads a moment to complete, then record them; a started-but-unfinished download fails.
  for (let i = 0; i < 20 && !aborted && [...downloads.values()].some((d) => d.state === 'started'); i++) await sleep(250);
  report.downloads = [...downloads.values()];
  for (const d of report.downloads) if (d.state !== 'completed') fail.push(`download ${d.file} did not complete (${d.state})`);
  report.pass = fail.length === 0;
  report.failures = fail;
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ url: url.split('?')[0], objects: report.objects, timings: report.timings, queries: report.queries, out: outDir }));
  // done() exits only once Chrome has gone, so the two outcomes must not fall through to each other.
  if (fail.length) {
    console.log('FAIL');
    for (const f of fail) console.log(' - ' + f);
    done(1);
  } else {
    console.log('PASS');
    done(0);
  }
}
setTimeout(() => { aborted ??= `the run passed --deadline-ms (${Math.round(DEADLINE_MS / 1000)} s) during ${stage}`; finish(); }, DEADLINE_MS);

// ---------------------------------------------------------------- boot and settle
const snapshot = () => evaluate(`(() => {
  const s = window.__appState;
  const objects = s ? Object.values(s.objects) : [];
  return {
    href: location.href,
    signIn: /login|sign-?in|oauth|authorize/i.test(location.pathname) && !s,
    has: !!s,
    boot: s?.bootError ?? null,
    timings: s?.timings ?? {},
    total: objects.length,
    pending: objects.filter((o) => o.status === 'pending').length,
    hidden: document.hidden,
  };
})()`);

const t0 = Date.now();
let state;
while (Date.now() - t0 < SETTLE_MS) {
  await sleep(1000);
  state = await snapshot();
  if (!state || state.signIn || state.boot) break;
  if (state.has && state.total > 0 && state.pending === 0) break;
}
booted = true;

if (aborted) { /* reported by finish() */ }
else if (!state) fail.push('page did not respond');
else if (state.signIn) fail.push(`redirected to sign-in (${state.href.split('?')[0]}): run once with --login`);
else if (state.boot) fail.push(`boot error: ${state.boot}`);
else if (!state.has) fail.push('window.__appState is missing: wire app-state.js into the app');
else {
  if (state.hidden) fail.push('document.hidden is true: charts do not paint in a hidden window');
  if (state.total === 0) fail.push('no objects declared (appState.declare)');
  if (state.pending) fail.push(`${state.pending} of ${state.total} objects still pending after ${SETTLE_MS / 1000}s`);
  const landing = state.timings['landing-ready'] ?? state.timings['all-settled'];
  if (landing === undefined) fail.push('no landing-ready or all-settled timing');
  else if (landing > LANDING_MS) fail.push(`landing took ${landing} ms (budget ${LANDING_MS})${state.timings['landing-ready'] === undefined ? ': timed by all-settled, because the app never marks landing-ready' : ''}`);
  report.timings = state.timings;
  report.objects = state.total;

  const objects = (await evaluate(`Object.values(window.__appState.objects)`)) ?? [];
  const bad = objects.filter((o) => o.status !== 'rendered');
  if (bad.length) fail.push(`not rendered: ${bad.map((o) => `${o.id}:${o.status}${o.error ? ` (${o.error})` : ''}`).slice(0, 12).join('; ')}`);
  // Objects declared after this snapshot (tabs that preload or mount on first visit) are not in
  // report.objects; each tab's are checked when the sweep shows that tab, below.
  const reported = new Set(objects.map((o) => o.id));
  const tabObjects = (tab) => evaluate(`Object.values(window.__appState.objects)
    .filter((o) => o.tab === ${JSON.stringify(tab)} || o.tab === null).map((o) => ({ id: o.id, status: o.status, error: o.error }))`);

  // ---------------------------------------------------------------- every tab at every width
  mkdirSync(outDir, { recursive: true });
  stage = 'the tab sweep';
  const tabs = (await evaluate(`window.__appState.tabs.map((t) => t.id)`)) ?? [];
  const pageCheck = `(() => {
    const el = document.scrollingElement;
    const texts = [...document.querySelectorAll('body *')].filter((e) => e.children.length === 0 && e.offsetParent !== null
      && /failed to render|could not be rendered|failed to fetch dynamically|something went wrong/i.test(e.textContent)).map((e) => e.textContent.trim().slice(0, 160));
    const images = [...document.images].filter((i) => i.offsetParent !== null);
    return {
      overflowX: el.scrollWidth - el.clientWidth,
      overflowY: el.scrollHeight - el.clientHeight,
      texts: [...new Set(texts)],
      brokenImages: images.filter((i) => i.complete && i.naturalWidth === 0).length,
      loading: document.querySelectorAll('.is-loading').length,
    };
  })()`;
  // Charts resize themselves on a ResizeObserver, a frame or more after the viewport changes; a
  // canvas still at the previous width reads as horizontal page scroll. So: two frames, then the
  // app's quiet wait (any re-queries done and repainted), then two more frames before measuring.
  // A horizontal overflow is measured once more after 1.5 s, so only one that persists fails.
  const frames = `new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(() => r(1))))`;
  const settleLayout = async () => {
    await evaluate(frames);
    const quiet = await evaluate(`typeof window.__appState?.quiet === 'function'
      ? window.__appState.quiet({ quietMs: 400, paintMs: 800 }).then(() => 1) : 0`);
    if (!quiet) await sleep(1200);
    await evaluate(frames);
  };
  for (const width of widths) {
    if (aborted) break;
    await viewport(width);
    for (const tab of tabs.length ? tabs : [null]) {
      if (aborted) break;
      if (tab) await evaluate(`Promise.resolve(window.__appState.tabs.find((t) => t.id === ${JSON.stringify(tab)}).show()).then(() => 1)`);
      await settleLayout();
      if (tab) {
        let mine = (await tabObjects(tab)) ?? [];
        for (let i = 0; i < 15 && mine.some((o) => o.status === 'pending'); i++) { await sleep(1000); mine = (await tabObjects(tab)) ?? []; }
        const late = mine.filter((o) => !reported.has(o.id));
        late.forEach((o) => reported.add(o.id));
        const lateBad = late.filter((o) => o.status !== 'rendered');
        if (lateBad.length) fail.push(`${tab}: not rendered (declared after landing): ${lateBad.map((o) => `${o.id}:${o.status}${o.error ? ` (${o.error})` : ''}`).slice(0, 12).join('; ')}`);
      }
      let p = await evaluate(pageCheck);
      if (p?.overflowX > 1) { await sleep(1500); await evaluate(frames); p = await evaluate(pageCheck); }
      const name = `${tab ?? 'page'}-${width}`;
      const where = `${tab ?? 'page'} @${width}`;
      if (!p) { if (!aborted) fail.push(`${where}: the page did not answer within ${CALL_MS / 1000}s`); continue; }
      if (p.overflowX > 1) fail.push(`${where}: horizontal page scroll (${p.overflowX}px)`);
      if (p.overflowY > 1 && !scrollOk) fail.push(`${where}: vertical page scroll (${p.overflowY}px); pass --scroll-ok if this archetype scrolls`);
      if (p.texts.length) fail.push(`${where}: error text on page: ${p.texts.join(' | ')}`);
      if (p.brokenImages) fail.push(`${where}: ${p.brokenImages} broken image(s)`);
      if (p.loading) fail.push(`${where}: ${p.loading} element(s) still marked .is-loading`);
      const { result } = await send('Page.captureScreenshot', { format: 'png' });
      if (result?.data) writeFileSync(join(outDir, `${name}.png`), Buffer.from(result.data, 'base64'));
      // --full-page: the whole page height, beyond the viewport. Only the page's own scroll is
      // captured; a panel that scrolls inside the page shows only its visible part.
      let full;
      if (fullPage && !aborted) {
        const h = Math.min(FULL_MAX, Math.max(HEIGHT, Number(await evaluate(`document.scrollingElement.scrollHeight`)) || HEIGHT));
        const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width, height: h, scale: 1 } });
        if (shot.result?.data) { full = `${name}-full.png`; writeFileSync(join(outDir, full), Buffer.from(shot.result.data, 'base64')); }
        await viewport(width);   // capturing beyond the viewport can leave it resized
        await settleLayout();
      }
      report.tabs.push({ tab, width, ...p, screenshot: `${name}.png`, ...(full ? { fullScreenshot: full } : {}) });
    }
  }
  report.objectsAll = reported.size;
  await viewport(widths[0]);
  if (tabs.length) await evaluate(`Promise.resolve(window.__appState.tabs[0].show()).then(() => 1)`);

  // ---------------------------------------------------------------- app-registered checks
  // Each check gets CHECK_MS. A check that never settles (a download that never fires, a wait
  // that never ends) fails with its name instead of hanging the whole run.
  stage = 'the app checks';
  const count = aborted ? 0 : (await evaluate(`window.__appState.checks.length`)) ?? 0;
  for (let i = 0; i < count && !aborted; i++) {
    const name = await evaluate(`window.__appState.checks[${i}].name`);
    stage = `check "${name}"`;
    console.log(`check ${i + 1}/${count}: ${name}`);
    const r = await evaluate(`(async () => {
      const c = window.__appState.checks[${i}];
      const before = window.__appState.queries.length;
      const timeout = new Promise((resolve) => setTimeout(() => resolve({ timedOut: true }), ${CHECK_MS}));
      try {
        const out = await Promise.race([Promise.resolve().then(() => c.run()), timeout]);
        if (out?.timedOut) return { name: c.name, pass: false, detail: 'did not finish within ${CHECK_MS / 1000}s' };
        return { name: c.name, pass: !!out?.pass, detail: String(out?.detail ?? ''), queries: window.__appState.queries.length - before };
      }
      catch (e) { return { name: c.name, pass: false, detail: 'threw: ' + String(e?.message ?? e) }; }
    })()`, CHECK_MS + 15000);
    // No result: the page reloaded, or its main thread is stuck so even the check's own timer never fired.
    report.checks.push(r ?? { name, pass: false, detail: `no result: ${aborted ?? 'the page navigated away'}` });
    const c = report.checks.at(-1);
    if (!c.pass) fail.push(`check failed: ${c.name ?? name} ${c.detail ? `(${c.detail})` : ''}`);
  }
  // An app that registered its field catalogue gets it saved, for the offline compile check.
  const fields = aborted ? '' : await evaluate(`window.__appState.fields ? JSON.stringify(window.__appState.fields) : ''`);
  if (fields) { mkdirSync(outDir, { recursive: true }); writeFileSync(join(outDir, 'available-fields.json'), fields); report.fieldsSaved = 'available-fields.json'; }
  if (!aborted) report.queries = await evaluate(`({ total: window.__appState.queries.length, cached: window.__appState.queries.filter((q) => q.cached).length })`);
}

stage = 'the report';
await finish();
