/* Measurement, not a harness. Per-window loudness profile of named tracks.
   Columns per window: full-band RMS dB and low-band (<~120 Hz, kick/bass)
   RMS dB, each relative to the track's loudest window, plus spectral-flux-ish
   onset strength (mean positive frame-energy rise, relative to track max).

     node tools/quiet-scan.js . <file.flac>...            print 4 s profiles
     node tools/quiet-scan.js . --corpus <dir> --out <f>  every .flac under
         <dir>, 2 s windows, written to <f> as JSON (profiles only — no
         threshold is applied here; ledger 143) */
const fs = require('fs'), path = require('path');
const repo = path.resolve(process.argv[2] || '.');
let args = process.argv.slice(3), corpus = null, out = null;
if (args[0] === '--corpus') { corpus = args[1]; out = args[3]; args = []; }
global.window = global;
global.document = { createElement() { return { style: {} }; }, head: { appendChild() {} } };
process.chdir(path.join(repo, 'vendor'));
global.Flac = require(path.join(repo, 'vendor', 'libflac.min.js'));
process.chdir(repo);
eval(fs.readFileSync('assets/deckwave-flac.js', 'utf8').replace(/\r\n/g, '\n'));
const db = x => x > 0 ? 10 * Math.log10(x) : -120;

function walk(dir) {
  const found = [];
  for (const d of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) found.push(...walk(p));
    else if (/\.flac$/i.test(d.name)) found.push(p);
  }
  return found;
}

async function profile(f, secs) {
  const ab = fs.readFileSync(f);
  const pcm = await DWFLAC.decode(new Uint8Array(ab.buffer, ab.byteOffset, ab.byteLength));
  const sr = pcm.sampleRate, n = pcm.length, chs = pcm.numberOfChannels;
  const mono = new Float32Array(n);
  for (let c = 0; c < chs; c++) { const d = pcm.channels[c]; for (let i = 0; i < n; i++) mono[i] += d[i] / chs; }
  /* one-pole lowpass ~120 Hz, run twice */
  const a = Math.exp(-2 * Math.PI * 120 / sr); const lo = new Float32Array(n);
  let y1 = 0, y2 = 0;
  for (let i = 0; i < n; i++) { y1 = (1 - a) * mono[i] + a * y1; y2 = (1 - a) * y1 + a * y2; lo[i] = y2; }
  const W = Math.round(secs * sr), F = 1024, rows = [];
  for (let s = 0; s + W <= n; s += W) {
    let e = 0, el = 0; for (let i = s; i < s + W; i++) { e += mono[i] * mono[i]; el += lo[i] * lo[i]; }
    let flux = 0, prev = 0, k = 0;
    for (let i = s; i + F <= s + W; i += F) { let fe = 0; for (let j = i; j < i + F; j++) fe += mono[j] * mono[j]; flux += Math.max(0, fe - prev); prev = fe; k++; }
    rows.push({ t: s / sr, e: e / W, el: el / W, flux: flux / k });
  }
  const me = Math.max(...rows.map(r => r.e)), ml = Math.max(...rows.map(r => r.el)), mf = Math.max(...rows.map(r => r.flux));
  return { dur: n / sr, rows: rows.map(r => ({ t: r.t, full: db(r.e / me), low: db(r.el / ml), flux: db(r.flux / mf) })) };
}

(async () => {
  await DWFLAC.boot();
  if (corpus) {
    const files = walk(corpus).sort(), res = [];
    let i = 0;
    for (const f of files) {
      i++;
      try {
        const p = await profile(f, 2);
        res.push({ name: path.basename(f, path.extname(f)), dur: +p.dur.toFixed(2), win: 2,
                   full: p.rows.map(r => +r.full.toFixed(1)), low: p.rows.map(r => +r.low.toFixed(1)) });
      } catch (e) { res.push({ name: path.basename(f), error: e.message }); }
      if (i % 10 === 0) console.log(i + '/' + files.length);
    }
    fs.writeFileSync(out, JSON.stringify(res));
    console.log('wrote ' + res.length + ' profiles (' + res.filter(r => r.error).length + ' errors) to ' + out);
    return;
  }
  for (const f of args) {
    const p = await profile(f, 4);
    console.log('\n### ' + path.basename(f) + '  (' + p.dur.toFixed(1) + ' s)');
    console.log('   t    full  low   flux  | full-band bar (0 to -30 dB)');
    for (const r of p.rows) {
      const bar = '#'.repeat(Math.max(0, Math.round(30 + r.full)));
      const m = Math.floor(r.t / 60), sec = Math.round(r.t % 60);
      console.log((m + ':' + String(sec).padStart(2, '0')).padStart(5) + ' ' + r.full.toFixed(0).padStart(5) + ' ' + r.low.toFixed(0).padStart(5) + ' ' + r.flux.toFixed(0).padStart(5) + '  | ' + bar);
    }
  }
})();
