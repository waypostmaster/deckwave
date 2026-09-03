/* Does tools/serve.py refuse what it says it refuses — over a real socket?

   The deny-list in serve.py is decided on the path that will actually be
   OPENED, and it has been bypassed three times, each found on a scratch
   port rather than argued: percent-encoding and case on 2026-08-19, and
   NTFS 8.3 SHORT NAMES on 2026-09-01 (review C1, ledger 122) — `.git` is
   also `GIT~1` at the filesystem level, the alias has no leading dot, and
   `/GIT~1/HEAD` served the file while `/.git/HEAD` returned 403. Under
   --lan that is the whole private history one request away from anyone on
   the network, which is the one thing the publishing rule exists to keep
   off it.

   So this harness starts the REAL server on a free port, asks it over HTTP,
   and demands the refusal. A text check could not see this: the check in
   serve.py READ correctly before the fix and was wrong anyway. Every
   refusal here is paired with a control that MUST return 200 on the same
   surface — a zero without a control is decoration (CLAUDE.md).

   What it does NOT establish: --lan/TLS (the deny rule is in the handler,
   shared by both), the /music/ root (its own realpath check, not started
   here), or anything about the served content.

   Short-name checks need an NTFS volume with 8.3 generation on. Where the
   alias does not exist (other OSes, or `fsutil 8dot3name` disabled) those
   checks are NOT counted — printed as a NOTE, never as a pass.

       node tools/check-serve.js
*/
const fs = require('fs');
const path = require('path');
const net = require('net');
const http = require('http');
const { spawn, execFileSync } = require('child_process');

const REPO = path.resolve(__dirname, '..');
let fails = 0, checks = 0;
const ok = (name, cond, falsifier) => {
  checks++;
  if (!cond) { fails++; console.log('  FAIL  ' + name + '\n        falsifier hit: ' + falsifier); }
  else console.log('  pass  ' + name);
};
const note = (s) => console.log('  NOTE  ' + s);

/* the 8.3 alias of a name in REPO, or null when the volume has none */
function shortName(name) {
  if (process.platform !== 'win32') return null;
  try {
    const out = execFileSync('cmd', ['/c', 'for %I in (' + name + ') do @echo %~snxI'],
                             { cwd: REPO, encoding: 'utf8', windowsHide: true }).trim();
    return out && out.toLowerCase() !== name.toLowerCase() ? out : null;
  } catch (e) { return null; }
}

function freePort() {
  return new Promise((res, rej) => {
    const s = net.createServer();
    s.listen(0, '127.0.0.1', () => { const p = s.address().port; s.close(() => res(p)); });
    s.on('error', rej);
  });
}

function get(port, p) {
  return new Promise((res) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method: 'GET', timeout: 4000 }, (r) => {
      let body = '';
      r.setEncoding('utf8');
      r.on('data', (c) => { if (body.length < 4096) body += c; });
      r.on('end', () => res({ status: r.statusCode, body, hdr: r.headers }));
    });
    req.on('timeout', () => { req.destroy(); res({ status: 'timeout', body: '' }); });
    req.on('error', (e) => res({ status: 'error:' + e.code, body: '' }));
    req.end();
  });
}

(async () => {
  const port = await freePort();
  const py = process.env.DECKWAVE_PYTHON || 'python';
  const child = spawn(py, ['tools/serve.py', '--port', String(port)], { cwd: REPO, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let childOut = '';
  child.stdout.on('data', (c) => { childOut += c; });
  child.stderr.on('data', (c) => { childOut += c; });
  const stopServer = () => {
    try { execFileSync(py, ['tools/serve.py', '--stop', '--port', String(port)], { cwd: REPO, windowsHide: true, stdio: 'ignore', timeout: 8000 }); } catch (e) {}
    try { child.kill(); } catch (e) {}
  };
  process.on('exit', stopServer);

  /* wait for the server to identify itself, up to 10 s */
  let up = null;
  for (let i = 0; i < 50 && !up; i++) {
    const r = await get(port, '/');
    if (r.status === 200 && r.hdr['x-deckwave-serve'] === '1') up = r;
    else await new Promise((f) => setTimeout(f, 200));
  }
  if (!up) {
    console.log('FATAL: serve.py did not come up on port ' + port + '\n' + childOut);
    stopServer(); process.exit(1);
  }

  console.log('── controls: the surface returns hits ──────────────────────────');
  ok('GET / is 200 and names itself', up.status === 200, 'status ' + up.status);
  const js = await get(port, '/assets/deckwave.js');
  ok('GET /assets/deckwave.js is 200 with a script type', js.status === 200 && /javascript/.test(js.hdr['content-type'] || ''),
     'status ' + js.status + ' type ' + js.hdr['content-type']);
  const idx = await get(port, '/index.html');
  ok('GET /index.html is 200', idx.status === 200, 'status ' + idx.status);

  console.log('\n── the long names: the rule as written ─────────────────────────');
  const head = await get(port, '/.git/HEAD');
  ok('/.git/HEAD is 403', head.status === 403, 'status ' + head.status);
  ok('/tools/serve.py is 403', (await get(port, '/tools/serve.py')).status === 403, 'DENY_DIRS not applied');
  ok('/_source/ is 403', (await get(port, '/_source/')).status === 403, 'DENY_DIRS not applied');
  ok('/deckwave-patches/README.md is 403', (await get(port, '/deckwave-patches/README.md')).status === 403, 'DENY_DIRS not applied');
  ok('/.gitignore is 403', (await get(port, '/.gitignore')).status === 403, 'dotted rule not applied');
  /* the gitignored operator checklist has no consumer on the page; its
     control is a tracked doc beside it that MUST serve */
  ok('/docs/RUNBOOK.md is 403 (DENY_FILES, review M10)', (await get(port, '/docs/RUNBOOK.md')).status === 403, 'the launch-day checklist is served');
  ok('/docs/RUNBOOK.MD is 403 too (case)', (await get(port, '/docs/RUNBOOK.MD')).status === 403, 'case-insensitive filesystem, case-sensitive deny');
  ok('/docs/LAUNCH.md is 200 (control beside it)', (await get(port, '/docs/LAUNCH.md')).status === 200, 'the deny reached a tracked doc');

  console.log('\n── the two 2026-08-19 bypasses stay closed ─────────────────────');
  ok('/%2Egit/HEAD is 403 (percent-encoding)', (await get(port, '/%2Egit/HEAD')).status === 403, 'unquoted after the check');
  ok('/TOOLS/serve.py is 403 (case)', (await get(port, '/TOOLS/serve.py')).status === 403, 'case-insensitive filesystem, case-sensitive check');

  console.log('\n── 2026-09-01: NTFS 8.3 short names (review C1) ─────────────────');
  const aliases = [['.git', 'HEAD'], ['deckwave-patches', 'README.md'], ['.gitignore', null]];
  let tested = 0;
  for (const [long, file] of aliases) {
    const s = shortName(long);
    if (!s) { note('no 8.3 alias for ' + long + ' on this volume — short-name check NOT counted'); continue; }
    tested++;
    const p = '/' + s + (file ? '/' + file : '');
    const r = await get(port, p);
    ok(p + ' (alias of ' + long + ') is 403', r.status === 403,
       'status ' + r.status + (r.status === 200 ? ' — served: ' + JSON.stringify(r.body.slice(0, 40)) : ''));
    const pl = '/' + s.toLowerCase() + (file ? '/' + file : '');
    const rl = await get(port, pl);
    ok(pl + ' (lowercased alias) is 403', rl.status === 403, 'status ' + rl.status);
  }
  if (tested === 0) note('short names could not be exercised here; that half of the harness is silent, not green');

  console.log('\n── paths the check cannot evaluate are refused, not dropped ────');
  const nul = await get(port, '/NUL');
  ok('/NUL is a refusal (403/404), not a dropped connection', nul.status === 403 || nul.status === 404, 'status ' + nul.status);
  const nulq = await get(port, '/%00');
  ok('/%00 is a refusal, not a dropped connection', nulq.status === 403 || nulq.status === 404 || nulq.status === 400, 'status ' + nulq.status);

  console.log('\n── above the root ───────────────────────────────────────────────');
  for (const p of ['/../deckwave-tls/key.pem', '/..%2F..%2Fdeckwave-tls/key.pem', '/..%5C..%5Cdeckwave-tls/key.pem']) {
    const r = await get(port, p);
    ok(p + ' is not 200', r.status !== 200 && r.status !== 'timeout', 'status ' + r.status);
  }
  ok('a repo directory listing is 403', (await get(port, '/docs/')).status === 403, 'listing served');

  stopServer();
  console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') + ' of ' + checks + ' checks');
  process.exit(fails ? 1 : 0);
})();
