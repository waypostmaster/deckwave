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

   Since 2026-09-03 it also drives the three things the same review found
   downstream of the deny-list, all over the same socket:

     * RESERVED DEVICE NAMES. /NUL raised ValueError inside _forbidden();
       send_head catches OSError only, so the handler thread died with a
       traceback and the connection dropped. A dropped connection and a
       refusal are different answers and only one of them is the rule.
       /CON, /aux.txt, /com1.js and /nul.txt are the rest of that family.
     * CONTENT TYPES. `mimetypes` reads the Windows registry, so what a .js
       is served as depends on the machine; with `nosniff` a bad entry
       refuses every module. serve.py's own table must win, and the
       discriminator is the `; charset=utf-8` the registry never adds.
     * RANGE on /music/. 206 with the right byte slice, 416 for a range
       past the end, 200 for a malformed or multi-range header.

   The music checks run against a THROWAWAY folder in the temp directory
   with two synthetic files in it — the real library is not needed and is
   not touched.

   What it does NOT establish: --lan/TLS (the deny rule is in the handler,
   shared by both), or anything about the served content beyond its type.

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

const os = require('os');

const REPO = path.resolve(__dirname, '..');
/* Which serve.py to start. The default is the one on disk; the seam exists so
   a new check can be run against `git show HEAD:tools/serve.py` and SEEN to
   fail there — a check nobody has watched fail is decoration (CLAUDE.md).
   The path is repo-relative because serve.py derives REPO from its own
   location: a copy outside tools/ would serve the wrong tree. */
const SERVE = process.env.DECKWAVE_SERVE_PY || 'tools/serve.py';
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

function get(port, p, headers) {
  return new Promise((res) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method: 'GET',
                               headers: headers || {}, timeout: 4000 }, (r) => {
      const parts = [];
      r.on('data', (c) => parts.push(c));
      r.on('end', () => {
        const buf = Buffer.concat(parts);
        res({ status: r.statusCode, body: buf.slice(0, 4096).toString('utf8'), buf, hdr: r.headers });
      });
    });
    req.on('timeout', () => { req.destroy(); res({ status: 'timeout', body: '', buf: Buffer.alloc(0) }); });
    req.on('error', (e) => res({ status: 'error:' + e.code, body: '', buf: Buffer.alloc(0) }));
    req.end();
  });
}

/* A throwaway /music/ root: 256 bytes whose value IS their offset, so a
   range answer that is the right LENGTH but the wrong OFFSET still fails.
   Plus one .opus (the extension the listing used to be blind to) and one
   .txt control that must be refused. */
function makeMusicDir() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dw-music-'));
  const ramp = Buffer.alloc(256);
  for (let i = 0; i < 256; i++) ramp[i] = i;
  fs.writeFileSync(path.join(dir, 'probe.mp3'), ramp);
  fs.writeFileSync(path.join(dir, 'probe.opus'), Buffer.from('OggS-not-really'));
  fs.writeFileSync(path.join(dir, 'notes.txt'), 'not audio');
  return dir;
}

(async () => {
  const port = await freePort();
  const py = process.env.DECKWAVE_PYTHON || 'python';
  const musicDir = makeMusicDir();
  const child = spawn(py, [SERVE, '--port', String(port), '--music', musicDir],
                      { cwd: REPO, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  let childOut = '';
  child.stdout.on('data', (c) => { childOut += c; });
  child.stderr.on('data', (c) => { childOut += c; });
  const stopServer = () => {
    try { execFileSync(py, [SERVE, '--stop', '--port', String(port)], { cwd: REPO, windowsHide: true, stdio: 'ignore', timeout: 8000 }); } catch (e) {}
    try { child.kill(); } catch (e) {}
    try { fs.rmSync(musicDir, { recursive: true, force: true }); } catch (e) {}
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
  /* The whole DOS reserved-device family, not just NUL: realpath() turns
     `nul.txt` into \\.\NUL just as it does `NUL`, and relpath() then raises
     ValueError for all of them. A ValueError out of _forbidden() is not a
     refusal — it kills the handler thread and DROPS the connection, and a
     drop is a different answer from a 403. So the pass condition is a
     STATUS CODE: 'error:ECONNRESET' and 'timeout' both fail it. */
  for (const p of ['/NUL', '/%00', '/nul.txt', '/CON', '/aux.txt', '/com1.js',
                   '/prn', '/lpt1.md', '/docs/NUL']) {
    const r = await get(port, p);
    ok(p + ' is a refusal (403/404/400), not a dropped connection',
       r.status === 403 || r.status === 404 || r.status === 400,
       'status ' + r.status + (typeof r.status === 'string' ? ' — the handler thread died' : ''));
    ok(p + ' answers with no Python traceback in the body',
       !/Traceback \(most recent call last\)/.test(r.body), 'a traceback reached the client');
  }

  console.log('\n── content types are serve.py\'s, not the registry\'s ────────────');
  /* The discriminator is `; charset=utf-8`: mimetypes never appends it, so a
     bare `text/javascript` here means the registry answered and the override
     table is not in the path. Control below: a type NOT in the table still
     gets one from mimetypes, so this is not "no types at all". */
  const types = [['/assets/deckwave.js', 'text/javascript; charset=utf-8'],
                 ['/index.html', 'text/html; charset=utf-8'],
                 ['/themes/themes.css', 'text/css; charset=utf-8'],
                 ['/assets/demo-set.json', 'application/json; charset=utf-8'],
                 ['/manifest.webmanifest', 'application/manifest+json'],
                 ['/vendor/essentia-wasm.web.wasm', 'application/wasm'],
                 ['/assets/icons/icon-180.png', 'image/png']];
  for (const [p, want] of types) {
    const r = await get(port, p);
    ok(p + ' is ' + want, r.status === 200 && (r.hdr['content-type'] || '') === want,
       'status ' + r.status + ' type ' + r.hdr['content-type'] + ' — the registry, not MIME_TYPES');
  }
  const svc = await get(port, '/README.md');
  ok('control: an extension in the table is still served at all (README.md 200)',
     svc.status === 200 && /markdown/.test(svc.hdr['content-type'] || ''),
     'status ' + svc.status + ' type ' + svc.hdr['content-type']);
  ok('nosniff is on, which is why the table above matters',
     (up.hdr['x-content-type-options'] || '') === 'nosniff', 'header absent');

  console.log('\n── /music/: extensions, and one Range ───────────────────────────');
  const whole = await get(port, '/music/probe.mp3');
  ok('/music/probe.mp3 is 200 with all 256 bytes',
     whole.status === 200 && whole.buf.length === 256 && whole.buf[0] === 0 && whole.buf[255] === 255,
     'status ' + whole.status + ' len ' + whole.buf.length);
  ok('it advertises Accept-Ranges: bytes', (whole.hdr['accept-ranges'] || '') === 'bytes',
     'no Accept-Ranges, so a client never asks for a range');
  const opus = await get(port, '/music/probe.opus');
  ok('/music/probe.opus is 200 (AUDIO_EXT knows .opus)', opus.status === 200, 'status ' + opus.status);
  ok('/music/probe.opus is audio/ogg', (opus.hdr['content-type'] || '') === 'audio/ogg',
     'type ' + opus.hdr['content-type']);
  const listing = await get(port, '/music/');
  ok('the listing names probe.opus', /probe\.opus/.test(listing.body), 'an .opus in the folder is invisible');
  ok('control: the listing does NOT name notes.txt', !/notes\.txt/.test(listing.body), 'non-audio listed');
  ok('control: /music/notes.txt is 403', (await get(port, '/music/notes.txt')).status === 403, 'non-audio served');

  const mid = await get(port, '/music/probe.mp3', { Range: 'bytes=10-19' });
  ok('Range bytes=10-19 is 206 with Content-Range bytes 10-19/256',
     mid.status === 206 && (mid.hdr['content-range'] || '') === 'bytes 10-19/256',
     'status ' + mid.status + ' range ' + mid.hdr['content-range']);
  ok('...and the body is those exact 10 bytes (offset, not just length)',
     mid.buf.length === 10 && mid.buf[0] === 10 && mid.buf[9] === 19,
     'len ' + mid.buf.length + ' first ' + mid.buf[0] + ' last ' + mid.buf[mid.buf.length - 1]);
  const tail = await get(port, '/music/probe.mp3', { Range: 'bytes=250-' });
  ok('Range bytes=250- is 206, 6 bytes, 250..255',
     tail.status === 206 && tail.buf.length === 6 && tail.buf[0] === 250 && tail.buf[5] === 255,
     'status ' + tail.status + ' len ' + tail.buf.length);
  const suf = await get(port, '/music/probe.mp3', { Range: 'bytes=-8' });
  ok('Range bytes=-8 is the LAST 8 bytes, 248..255',
     suf.status === 206 && suf.buf.length === 8 && suf.buf[0] === 248 && suf.buf[7] === 255,
     'status ' + suf.status + ' len ' + suf.buf.length + ' first ' + suf.buf[0]);
  const past = await get(port, '/music/probe.mp3', { Range: 'bytes=300-400' });
  ok('an unsatisfiable range is 416 with Content-Range bytes */256',
     past.status === 416 && (past.hdr['content-range'] || '') === 'bytes */256',
     'status ' + past.status + ' range ' + past.hdr['content-range']);
  const junk = await get(port, '/music/probe.mp3', { Range: 'bytes=abc' });
  ok('a MALFORMED range is ignored (200, whole file), not 416 — RFC 7233',
     junk.status === 200 && junk.buf.length === 256, 'status ' + junk.status + ' len ' + junk.buf.length);
  const multi = await get(port, '/music/probe.mp3', { Range: 'bytes=0-3,8-11' });
  ok('a MULTI-range is answered whole (200), never as one wrong part',
     multi.status === 200 && multi.buf.length === 256, 'status ' + multi.status + ' len ' + multi.buf.length);
  ok('control: the same file with no Range header is still 200',
     (await get(port, '/music/probe.mp3')).status === 200, 'the range branch broke the plain GET');

  console.log('\n── above the root ───────────────────────────────────────────────');
  for (const p of ['/../deckwave-tls/key.pem', '/..%2F..%2Fdeckwave-tls/key.pem', '/..%5C..%5Cdeckwave-tls/key.pem']) {
    const r = await get(port, p);
    ok(p + ' is not 200', r.status !== 200 && r.status !== 'timeout', 'status ' + r.status);
  }
  ok('a repo directory listing is 403', (await get(port, '/docs/')).status === 403, 'listing served');

  /* ── harness meta ───────────────────────────────────────────────────────
     Every harness must end on EXACTLY

         all passed of N checks

     and that uniformity is load-bearing, not tidiness: one sweep across all
     of them is how the total is counted, and on 2026-08-31 a twelfth harness
     printed a prettier variant, scored ZERO in that sweep, and the run
     reported 560 green without a single failure (ledger 110). The check is a
     CODE TEMPLATE, not the words — reading the prose is the ledger 109/113
     mistake, and check-citywalk's header contains the sentence
     "all passed of N checks" in a comment for exactly that reason. So: the
     template must appear at least once, and it must be the LAST line in the
     file that mentions the phrase at all. At least once, not exactly once,
     because a harness may bail out early and print the same tally on the way
     out — check-loop does, when the module under test will not even compile,
     and printing the template there is the RIGHT behaviour: a harness that
     dies without a tally scores zero in the counting sweep and says nothing.

     Text is the right instrument here because the template IS the thing under
     test; executing thirteen harnesses to read one line of each would take
     minutes and prove no more. This lives in check-serve because check-serve
     is already the harness about the tooling rather than about the app. */
  console.log('\n── harness meta: the load-bearing final line ────────────────────');
  const TEMPLATE = "console.log('\\n' + (fails ? fails + ' FAILED' : 'all passed') + ' of ' + checks + ' checks');";
  const harnesses = fs.readdirSync(path.join(REPO, 'tools'))
    .filter((n) => /^check-.*\.js$/.test(n)).sort();
  ok('there are harnesses to sweep at all (control)', harnesses.length >= 12,
     'found ' + harnesses.length + ' — the glob is wrong and every check below is vacuous');
  const offenders = [];
  for (const h of harnesses) {
    const src = fs.readFileSync(path.join(REPO, 'tools', h), 'utf8').replace(/\r\n/g, '\n');
    const lines = src.split('\n');
    const hits = lines.filter((l) => l.includes('all passed'));
    const exact = lines.filter((l) => l.trim() === TEMPLATE).length;
    if (exact < 1 || hits.length === 0 || hits[hits.length - 1].trim() !== TEMPLATE) {
      offenders.push(h + ' (template x' + exact + ', last mention: ' + JSON.stringify((hits[hits.length - 1] || '').trim().slice(0, 60)) + ')');
    }
  }
  ok('all ' + harnesses.length + ' tools/check-*.js end on the exact template',
     offenders.length === 0,
     'a harness prints a variant and scores zero in the counting sweep: ' + JSON.stringify(offenders));

  stopServer();
  console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') + ' of ' + checks + ' checks');
  process.exit(fails ? 1 : 0);
})();
