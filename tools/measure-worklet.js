/* Drive the vendored SoundTouch 2.1.1 worklet OFFLINE, 128-frame quanta, and
   measure what it does to the stream — the instrument behind ledger 65.

   The processor reads exactly three AudioParams (pitch, pitchSemitones,
   playbackRate) and the engine sets playbackRate = rate on both the source
   and the worklet, so the worklet sees the pitch compensation 1/rate and
   nothing else; that is what is fed here. Four measurements:

     gaps      blocks where the pipe had fewer than 128 frames ready and
               zero-filled the rest — each one is a 2.9 ms click — per rate,
               after the pipe's warm-up (first ~150 blocks, ~0.45 s, always
               silent: that is the pipe priming, and every deck pays it
               equally under its gain ramp)
     latency   a click every second in; where it comes out; does the
               latency DRIFT over two minutes (it does not — the pipe is
               elastic, the gaps are inserted, not accumulated)
     hold      the same gap count with N render blocks held in the
               worklet's output before the first extraction (a subclass in
               this file), and the SHIPPED wrapper, assets/deckwave-stretch.js,
               loaded exactly as the Player loads it — vendored text + wrapper
     real      gaps on two library tracks' own audio (DOOMSDAY, GIANA
               SISTERS — the pair the keeper heard pop), default vs held

   Falsifier for "the gaps are the pipe's cadence, not the signal": the
   sine and the real audio give the same counts per rate. They do.

       node tools/measure-worklet.js            # gaps + latency + hold (sine)
       node tools/measure-worklet.js real       # the two library tracks too (needs the library)
*/
const fs = require('fs'), path = require('path');
process.chdir(path.resolve(__dirname, '..'));
const SR = 44100;
global.sampleRate = SR; global.currentFrame = 0; global.currentTime = 0;
const REG = {};
global.AudioWorkletProcessor = class { constructor() { this.port = { postMessage() {}, onmessage: null }; } };
global.registerProcessor = (name, cls) => { REG[name] = cls; };
/* exactly what the Player loads: the vendored text plus the wrapper, as one script */
new Function(fs.readFileSync('vendor/soundtouch-processor.js', 'utf8') + '\n' + fs.readFileSync('assets/deckwave-stretch.js', 'utf8'))();
const Base = REG['soundtouch-processor'];          /* the plain vendored processor */
const Shipped = REG['deckwave-stretch'];           /* the held-block wrapper the decks use */
if (!Base || !Shipped) { console.log('FATAL: processors not registered: ' + Object.keys(REG)); process.exit(1); }

/* a parametrised hold for the experiment table (the shipped wrapper holds 1) */
class Held extends Base {
  constructor(o, hold) { super(o); this._primed = false; this._after = 0; this._hold = hold || 0; }
  processCore(inputs, outputs, parameters) {
    const input = inputs[0], output = outputs[0];
    const leftInput = input[0], rightInput = input.length > 1 ? input[1] : input[0];
    const leftOutput = output[0], rightOutput = output.length > 1 ? output[1] : output[0];
    const frameCount = leftInput.length;
    if (this._samples.length < frameCount * 2) { this._samples = new Float32Array(frameCount * 2); this._outputSamples = new Float32Array(frameCount * 2); }
    this._pipe.pitch = parameters['pitch'][0] * Math.pow(2, parameters['pitchSemitones'][0] / 12) / parameters['playbackRate'][0];
    const samples = this._samples;
    for (let i = 0; i < frameCount; i++) { samples[i * 2] = leftInput[i]; samples[i * 2 + 1] = rightInput[i]; }
    this._pipe.inputBuffer.putSamples(samples, 0, frameCount);
    this._pipe.process();
    const available = this._pipe.outputBuffer.frameCount;
    this._blockCount++;
    if (!this._primed) {
      if (available >= frameCount) { this._after++; if (this._after > this._hold) this._primed = true; }
      if (!this._primed) { leftOutput.fill(0); rightOutput.fill(0); return null; }
    }
    if (available < frameCount) this._underrunCount++;
    this.extractSamples(leftOutput, rightOutput, frameCount, Math.min(available, frameCount), parameters);
    return null;
  }
}

const params = rate => ({ pitch: [1], pitchSemitones: [0], playbackRate: [rate] });
function drive(proc, rate, seconds, fill) {
  const blocks = Math.floor(seconds * SR / 128);
  const inL = new Float32Array(128), inR = new Float32Array(128), outL = new Float32Array(128), outR = new Float32Array(128);
  const p = params(rate);
  let gaps = 0;
  const out = fill.keep ? new Float32Array(blocks * 128) : null;
  for (let b = 0; b < blocks; b++) {
    fill(inL, inR, b);
    const before = proc._underrunCount;
    proc.process([[inL, inR]], [[outL, outR]], p);
    if (proc._underrunCount > before && b > 300) gaps++;
    if (out) out.set(outL, b * 128);
  }
  return { gaps, out };
}
let ph = 0;
const sine = (L, R) => { for (let i = 0; i < 128; i++) { ph += 2 * Math.PI * 220 / SR; L[i] = R[i] = Math.sin(ph) * 0.5 + (Math.random() - .5) * 0.1; } };
const RATES = [1.0, 1.0012, 0.9988, 1.02, 0.98, 1.05, 0.95, 1.08, 0.92];

console.log('\n── gaps per 150 s, default processor (sine) ─────────────────');
const g = {}; for (const r of RATES) g['×' + r] = drive(new Base({}), r, 150, sine).gaps;
console.table([g]);

console.log('\n── latency (ms) of a click each second, first three / last three, 120 s ──');
const lat = [];
for (const r of [1.0, 1.0012, 1.05, 0.95, 1.08]) {
  const clicks = (L, R, b) => { for (let i = 0; i < 128; i++) { const n = b * 128 + i; L[i] = R[i] = ((n % SR) < 8 ? 1 : 0) + (Math.random() - .5) * 0.002; } };
  clicks.keep = true;
  const { out } = drive(new Base({}), r, 120, clicks);
  const found = [];
  for (let s = 0; s < 120; s++) { const t0 = s * SR; for (let n = Math.max(0, t0 - SR / 4); n < Math.min(out.length, t0 + SR / 2); n++) if (out[n] > 0.5) { found.push((n - t0) / SR * 1000); break; } }
  lat.push({ rate: r, first: found.slice(0, 3).map(x => x.toFixed(1)).join(' '), last: found.slice(-3).map(x => x.toFixed(1)).join(' '), clicksFound: found.length + '/120' });
}
console.table(lat);

console.log('\n── gaps per 180 s with N blocks held (sine); "shipped" is assets/deckwave-stretch.js ──');
const h = {};
for (const hold of [0, 1, 2]) { h['hold ' + hold] = {}; for (const r of RATES) h['hold ' + hold]['×' + r] = drive(new Held({}, hold), r, 180, sine).gaps; }
h['shipped'] = {}; for (const r of RATES) h['shipped']['×' + r] = drive(new Shipped({}), r, 180, sine).gaps;
console.table(h);

if (process.argv[2] === 'real') (async () => {
  global.window = global;
  global.document = { createElement() { return { style: {} }; }, head: { appendChild() {} } };
  const repo = process.cwd();
  process.chdir(path.join(repo, 'vendor'));
  global.Flac = require(path.join(repo, 'vendor', 'libflac.min.js'));
  process.chdir(repo);
  eval(fs.readFileSync('assets/deckwave-flac.js', 'utf8').replace(/\r\n/g, '\n'));
  const F = global.DWFLAC; await F.boot();
  const LIB = process.env.DECKWAVE_LIB || 'C:/Claude/Music/LukHash';
  const rows = [];
  /* recursive since the 2026-08-21 clearance-subdirectory reorg — the flat
     join was missed here when the harnesses got their walkers (P1) */
  const findIn = name => {
    const seen = [LIB];
    for (let i = 0; i < seen.length; i++) {
      let names;
      try { names = fs.readdirSync(seen[i], { withFileTypes: true }); } catch (e) { continue; }
      for (const d of names) {
        const p = path.join(seen[i], d.name);
        if (d.isDirectory()) seen.push(p);
        else if (d.name === name) return p;
      }
    }
    return null;
  };
  for (const f of ['LukHash - GLITCH - 02 DOOMSDAY.flac', 'LukHash - C64 reMIXed - 06 THE GREAT GIANA SISTERS (1987) Chris Hülsbeck.flac']) {
    const fp = findIn(f); if (!fp) { console.log('missing ' + f); continue; }
    const ab = fs.readFileSync(fp); const pcm = await F.decode(new Uint8Array(ab.buffer, ab.byteOffset, ab.byteLength));
    const L = pcm.channels[0], R = pcm.channels[1] || L;
    for (const rate of [1.0012, 0.9988, 1.05, 0.95]) for (const hold of [0, 1]) {
      const feed = (l, r, b) => { l.set(L.subarray(b * 128, b * 128 + 128)); r.set(R.subarray(b * 128, b * 128 + 128)); };
      rows.push({ track: f.slice(-30), rate, processor: hold ? 'shipped' : 'plain', gaps: drive(hold ? new Shipped({}) : new Base({}), rate, Math.min(150, L.length / pcm.sampleRate - 1), feed).gaps });
    }
  }
  console.log('\n── gaps per 150 s on real audio, default vs one block held ──');
  console.table(rows);
})();
