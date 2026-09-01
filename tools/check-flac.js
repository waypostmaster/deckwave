/* Does the libflac fallback decode what the browser decodes — the same
   samples, not merely "some audio"?

   DWFLAC exists for browsers whose decodeAudioData refuses FLAC (WebKit is
   the open question). The falsifier for "it decodes correctly" cannot be
   "it returned a buffer"; it has to be a number the browser's own decoder
   produced for the same file. The corpus cache carries two: `dur` (the
   decoded duration) and `rms` (RMS of a centred 120 s mono excerpt, computed
   in the page on Chromium's decode). Both are recomputed here from the
   libflac PCM with the analyser's exact arithmetic.

   Tolerances, stated: duration within 0.05 s (the cache rounds to 0.1);
   RMS within 0.1% for a file at 44.1 kHz, where both decoders see the same
   samples; within 1% for a 48 kHz file, because the cache's figure was taken
   AFTER Chromium resampled it to the 44.1 kHz context and this one is taken
   at the file's own rate — the same seconds of music, a different sample
   grid. A failure outside those bands means the unpacking is wrong
   (sign, byte order, bit depth), not that the music differs.

   Needs the library on disk (DECKWAVE_LIB, default C:/Claude/Music/LukHash)
   and runs libflac.min.js under Node, which it supports.

       node tools/check-flac.js
*/
const fs = require('fs'), path = require('path');
let fails = 0, checks = 0;
const ok = (name, cond, falsifier) => {
  checks++;
  if (!cond) { fails++; console.log('  FAIL  ' + name + '\n        falsifier hit: ' + falsifier); }
  else console.log('  pass  ' + name);
};

const LIB = process.env.DECKWAVE_LIB || 'C:/Claude/Music/LukHash';
/* the library is no longer flat (2026-08-21: clearance subdirectories) —
   find a stem anywhere under LIB, one level of walk like the app's own */
function findFlac(stem) {
  const want = stem + '.flac';
  const seen = [LIB];
  for (let i = 0; i < seen.length; i++) {
    let names;
    try { names = fs.readdirSync(seen[i], { withFileTypes: true }); } catch (e) { continue; }
    for (const d of names) {
      const p = path.join(seen[i], d.name);
      if (d.isDirectory()) seen.push(p);
      else if (d.name === want) return p;
    }
  }
  return null;
}
const cache = JSON.parse(fs.readFileSync('evidence/deckwave-cache-v1-2026-08-17.json', 'utf8')).data;

/* one 16-bit/44.1k, one 24-bit/44.1k, one 24-bit/48k — the three shapes in
   this library (ROADMAP D9's table) */
const CASES = [
  { stem: 'LukHash - WALKMAN -Single- - 01 WALKMAN', tolRms: 0.001 },
  { stem: 'LukHash x Shirobon - Exile - 01 Exile', tolRms: 0.001 },
  { stem: 'LukHash & Meredith Bull -  Big in Japan (Lyric Video) [ZyDO4rMbSQA]', tolRms: 0.01 }
];

global.window = global;
global.document = { createElement() { return { style: {} }; }, head: { appendChild() {} } };
process.chdir(path.resolve(__dirname, '..'));
const repo = process.cwd();
/* libflac.min.js fetches its .mem beside itself; chdir into vendor for the
   require, then back */
process.chdir(path.join(repo, 'vendor'));
global.Flac = require(path.join(repo, 'vendor', 'libflac.min.js'));
process.chdir(repo);
eval(fs.readFileSync('assets/deckwave-flac.js', 'utf8').replace(/\r\n/g, '\n'));
const F = global.DWFLAC;

(async () => {
  await F.boot();
  ok('libflac is ready under Node', !!(global.Flac.isReady && global.Flac.isReady()), 'Flac.isReady() false');
  let ran = 0;
  for (const c of CASES) {
    const file = findFlac(c.stem);
    const rec = cache.find(r => r.name === c.stem);
    if (!file || !rec) { console.log('  skip  ' + c.stem.slice(-40) + ' (file or cache record missing)'); continue; }
    ran++;
    const ab = fs.readFileSync(file);
    const u8 = new Uint8Array(ab.buffer, ab.byteOffset, ab.byteLength);
    const t0 = Date.now();
    let pcm;
    try { pcm = await F.decode(u8); }
    catch (e) { ok(c.stem.slice(-36) + ' decodes', false, e.message); continue; }
    const ms = Date.now() - t0;
    const dur = pcm.length / pcm.sampleRate;
    console.log('  ' + c.stem.slice(-40) + ': ' + pcm.sampleRate + ' Hz · ' + pcm.bitsPerSample + '-bit · ' +
                pcm.numberOfChannels + ' ch · ' + dur.toFixed(2) + ' s · decoded in ' + ms + ' ms');
    ok(c.stem.slice(-36) + ' · duration matches the cache (' + rec.dur + ')', Math.abs(dur - rec.dur) <= 0.05,
       'libflac ' + dur.toFixed(3) + ' vs cache ' + rec.dur);
    /* the analyser's excerpt RMS, exactly: centred min(dur,120) s, channels
       averaged in order, sum of squares from index 1 */
    const sr = pcm.sampleRate, want = Math.min(dur, 120), start = Math.max(0, Math.floor((dur - want) / 2 * sr));
    const n = Math.floor(want * sr), chs = pcm.numberOfChannels;
    const mono = new Float32Array(n);
    for (let ch = 0; ch < chs; ch++) { const d = pcm.channels[ch]; for (let i = 0; i < n; i++) mono[i] += d[start + i] / chs; }
    let sum = 0; for (let i = 1; i < n; i++) sum += mono[i] * mono[i];
    const rms = Math.sqrt(sum / n), rel = Math.abs(rms - rec.rms) / rec.rms;
    ok(c.stem.slice(-36) + ' · excerpt RMS within ' + (c.tolRms * 100) + '% of Chromium\'s (' + rec.rms + ' vs ' + rms.toFixed(5) + ', ' + (rel * 100).toFixed(3) + '% off)', rel <= c.tolRms,
       'libflac rms ' + rms.toFixed(5) + ' vs cache ' + rec.rms + ' (' + (rel * 100).toFixed(3) + '% off) — unpacking wrong?');
    /* a sign or byte-order slip produces a signal with a huge DC offset or
       near-full-scale noise; both show as a mean far from zero */
    let mean = 0; for (let i = 0; i < n; i++) mean += mono[i]; mean /= n;
    ok(c.stem.slice(-36) + ' · excerpt mean near zero (' + mean.toExponential(2) + ')', Math.abs(mean) < 0.01,
       'mean ' + mean + ' — a sign/byte-order error reads as DC');
  }
  ok('at least two library files were actually decoded', ran >= 2, ran + ' ran — the library path is wrong and nothing was tested');
  console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') + ' of ' + checks + ' checks');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FATAL: ' + (e.stack || e)); process.exit(1); });
