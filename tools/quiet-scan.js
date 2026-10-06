/* Measurement, not a harness. Per-window loudness profile of named tracks.
   Columns per 4 s window: full-band RMS dB and low-band (<~120 Hz, kick/bass)
   RMS dB, each relative to the track's loudest window, plus spectral-flux-ish
   onset strength (mean positive frame-energy rise, relative to track max).
   Usage: node tools/quiet-scan.js . <file.flac>...  (a MEASUREMENT, not a harness) */
const fs = require('fs'), path = require('path');
const repo = process.argv[2], files = process.argv.slice(3);
global.window = global;
global.document = { createElement() { return { style: {} }; }, head: { appendChild() {} } };
process.chdir(path.join(repo, 'vendor'));
global.Flac = require(path.join(repo, 'vendor', 'libflac.min.js'));
process.chdir(repo);
eval(fs.readFileSync('assets/deckwave-flac.js', 'utf8').replace(/\r\n/g, '\n'));
const db = x => x > 0 ? 10 * Math.log10(x) : -120;
(async () => {
  await DWFLAC.boot();
  for (const f of files) {
    const ab = fs.readFileSync(f);
    const pcm = await DWFLAC.decode(new Uint8Array(ab.buffer, ab.byteOffset, ab.byteLength));
    const sr = pcm.sampleRate, n = pcm.length, chs = pcm.numberOfChannels;
    const mono = new Float32Array(n);
    for (let c = 0; c < chs; c++) { const d = pcm.channels[c]; for (let i = 0; i < n; i++) mono[i] += d[i] / chs; }
    /* one-pole lowpass ~120 Hz, run twice */
    const a = Math.exp(-2 * Math.PI * 120 / sr); const lo = new Float32Array(n);
    let y1 = 0, y2 = 0;
    for (let i = 0; i < n; i++) { y1 = (1 - a) * mono[i] + a * y1; y2 = (1 - a) * y1 + a * y2; lo[i] = y2; }
    const W = 4 * sr, F = 1024, rows = [];
    for (let s = 0; s + W <= n; s += W) {
      let e = 0, el = 0; for (let i = s; i < s + W; i++) { e += mono[i] * mono[i]; el += lo[i] * lo[i]; }
      let flux = 0, prev = 0, k = 0;
      for (let i = s; i + F <= s + W; i += F) { let fe = 0; for (let j = i; j < i + F; j++) fe += mono[j] * mono[j]; flux += Math.max(0, fe - prev); prev = fe; k++; }
      rows.push({ t: s / sr, e: e / W, el: el / W, flux: flux / k });
    }
    const me = Math.max(...rows.map(r => r.e)), ml = Math.max(...rows.map(r => r.el)), mf = Math.max(...rows.map(r => r.flux));
    console.log('\n### ' + path.basename(f) + '  (' + (n / sr).toFixed(1) + ' s)');
    console.log('   t    full  low   flux  | full-band bar (0 to -30 dB)');
    for (const r of rows) {
      const E = db(r.e / me), L = db(r.el / ml), X = db(r.flux / mf);
      const bar = '#'.repeat(Math.max(0, Math.round((30 + E)))) ;
      const m = Math.floor(r.t / 60), sec = Math.round(r.t % 60);
      console.log((m + ':' + String(sec).padStart(2, '0')).padStart(5) + ' ' + E.toFixed(0).padStart(5) + ' ' + L.toFixed(0).padStart(5) + ' ' + X.toFixed(0).padStart(5) + '  | ' + bar);
    }
  }
})();
