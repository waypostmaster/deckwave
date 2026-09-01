/* Does the phrase detector find the 8-bar offset it was given — and does
   the Player, in phrase mode, leave on a phrase, enter on a phrase and fade
   for exactly one?

   Part 1 runs DWPHRASE on SYNTHETIC signal whose phrase structure is known,
   because a detector checked only against real music is checked against
   nothing (there is no ground truth for the library; that is what the
   keeper's ear is for). Part 2 evaluates the Player IIFE under the same
   fake AudioContext check-player.js uses, with decoded buffers that carry
   channel data, and reads the schedule back.

   Every check states its falsifier.

       node tools/check-phrase.js
*/
const fs = require('fs');
let fails = 0, checks = 0;
const ok = (name, cond, falsifier) => {
  checks++;
  if (!cond) { fails++; console.log('  FAIL  ' + name + '\n        falsifier hit: ' + falsifier); }
  else console.log('  pass  ' + name);
};

global.window = global;
const PH = require('../assets/deckwave-phrase.js');

/* ── synthetic material ──────────────────────────────────────────────────
   8 kHz, 120 bpm (0.5 s per beat), 4/4 from t=0. White noise per beat with
   a per-phrase amplitude pattern; a seeded PRNG so a failure reproduces. */
const SR = 8000, BEAT = 0.5;
let seed = 12345;
const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 * 2 - 1; };
const grid = nBeats => Array.from({ length: nBeats }, (_, i) => +(i * BEAT).toFixed(4));

/* amp(bar) → amplitude; bright(bar) → true for white noise, false for
   smoothed (low zero-crossing) noise of the same RMS */
function synth(nBars, amp, bright) {
  const n = Math.floor(nBars * 4 * BEAT * SR);
  const x = new Float32Array(n);
  const perBar = 4 * BEAT * SR;
  let prev = 0;
  for (let i = 0; i < n; i++) {
    const bar = Math.floor(i / perBar);
    const a = amp(bar);
    let v = rnd();
    if (bright && !bright(bar)) { v = prev * 0.9 + v * 0.1 * 3; prev = v; }   /* smoothed: few crossings, RMS kept near */
    else prev = 0;
    x[i] = a * v;
  }
  return x;
}


/* ── part 2: the Player in phrase mode ────────────────────────────────────
   The Player IIFE is evaluated with check-player.js's fake AudioContext,
   plus decoded buffers that carry channel data (synthetic, known offsets),
   and the schedule is read back through _dev. */
const src = fs.readFileSync(process.env.DECKWAVE_SRC || 'assets/deckwave.js', 'utf8').replace(/\r\n/g, '\n');
const pa = src.indexOf('\nconst Player = (() => {');
const pb = src.indexOf('\n})();\n', pa);
if (pa < 0 || pb < 0) { console.log('FATAL: could not find the Player IIFE'); process.exit(1); }
const playerSrc = src.slice(pa + 1, pb + 6).replace(/^const Player = /, '');

const started = [];
const param = () => ({ value: 0, cancelScheduledValues() {}, setValueAtTime() {},
  linearRampToValueAtTime() {}, setTargetAtTime() {} });
const node = () => ({ playbackRate: param(), gain: param(), type: '', frequency: { value: 0 },
  Q: { value: 0 }, threshold: { value: 0 }, ratio: { value: 0 }, fftSize: 0,
  smoothingTimeConstant: 0, connect() {}, parameters: { get: () => param() },
  start(at, off) { this._started = { at, off }; started.push(this); },
  stop(at) { this._stopped = true; this._stopAt = at; }, onended: null });
let now = 100;
function AC() {
  return { get currentTime() { return now; }, state: 'running',
    async resume() {}, async suspend() {}, close() {},
    audioWorklet: { async addModule() {} },
    createGain: node, createDynamicsCompressor: node, createAnalyser: node,
    createBufferSource: node, createBiquadFilter: node };
}
const AudioWorkletNode = function () { return node(); };
const ASSETS = { base: 'vendor/', files: { soundtouch: 'x' }, allowCDN: false };
const CDN = {}; const assetURL = k => ASSETS.base + ASSETS.files[k];
/* decode hands back the track's own synthetic buffer, resolved by name */
const pending = new Map();
const LIB = { decode(meta) { return new Promise((res, rej) => pending.set(meta.name, { res, rej, meta })); } };
const settle = name => { const p = pending.get(name); pending.delete(name); p.res(p.meta._buf); return new Promise(r => setTimeout(r, 0)); };
const tick = () => new Promise(r => setTimeout(r, 0));

/* a 240 s track at 120 bpm with 8-bar loudness structure from bar `off`;
   `bare` = a buffer with no channel data (what check-player's fakes are) */
function track(name, off, opts) {
  opts = opts || {};
  const dur = 240, nBars = 120, beats = grid(dur * 2);
  const x = synth(nBars, bar => (Math.floor(((bar - off) + 800) / 8) % 2 ? 0.6 : 0.2));
  const buf = opts.bare ? { duration: dur, name }
            : { duration: dur, sampleRate: SR, numberOfChannels: 1, getChannelData: () => x, name };
  const m = { name, bpm: 120, camelot: '8A', dur, beats, _locked: true };
  if (opts.unlocked) { m._locked = false; m._unlocked = true; m._unlockReason = 'grid'; }
  m._buf = buf;
  return m;
}

async function part2() {
  console.log('\n── part 2: the Player in phrase mode ──────────────────────────');
  const Player = eval(playerSrc);
  const D = Player._dev;
  Player.setXfade(12);                       /* ≠ one phrase (16 s), so the two are distinguishable */

  /* phrase set: t1 (offset 2) → t2 (offset 5) */
  const t1 = track('t1', 2), t2 = track('t2', 5), t3 = track('t3', 0);
  const set = [t1, t2, t3]; set.phrase = true;
  let p = Player.play(set, 0);
  await tick(); await settle('t1'); await p; await tick();
  await settle('t2'); await tick();
  ok('play() reads the set\'s phrase flag', Player.phrase === true, 'phrase is ' + Player.phrase);
  ok('the outgoing track\'s phrase was detected from its buffer (offset 2, got ' + (t1.phrase && t1.phrase.at) + ')',
     t1.phrase && t1.phrase.ok && t1.phrase.at === 2, JSON.stringify(t1.phrase));
  ok('the incoming track\'s phrase was detected from its buffer (offset 5, got ' + (t2.phrase && t2.phrase.at) + ')',
     t2.phrase && t2.phrase.ok && t2.phrase.at === 5, JSON.stringify(t2.phrase));
  const outRel = D.A.outAt - D.A.startedAt;
  /* t1 phrase starts at 4 + 16k s (beat 8 + 32k); natural end 240 − 16 = 224 → the last start ≤ 224 is 212 */
  ok('exit is the LAST phrase start the length allows (212 s, got ' + outRel.toFixed(2) + ')', Math.abs(outRel - 212) < 1e-6,
     'exit at ' + outRel + ' — downbeat path (would be ~228) or the wrong phrase start');
  ok('fade is one phrase of the outgoing track (16 s, not the set\'s 12 s xfade)', Math.abs(D.A.fade - 16) < 1e-6, 'fade ' + D.A.fade);
  ok('blend accessor reports the phrase-length fade', Math.abs(Player.blend.xfade - 16) < 1e-6, JSON.stringify(Player.blend));
  ok('incoming deck enters at ITS first phrase start (beat 20 = 10 s, got ' + D.B.entry + ')', Math.abs(D.B.entry - 10) < 1e-6,
     'entry ' + D.B.entry + ' — beats[0] means the downbeat path');
  ok('incoming source is scheduled at the exit with that offset',
     D.B.src._started && Math.abs(D.B.src._started.at - D.A.outAt) < 1e-9 && Math.abs(D.B.src._started.off - 10) < 1e-6,
     JSON.stringify(D.B.src._started));
  ok('the log marks the transition ¶ with both contrasts and the fade', /¶[0-9.]+→[0-9.]+ 16s/.test(Player.log[0]), Player.log[0]);

  /* next ▶ goes to the NEXT PHRASE START, not the next downbeat */
  now = 100 + .35 + 50;                      /* 50 s into t1: starts at 52 (phrase), downbeats every 2 s */
  const sk = Player.skip({ lead: 1.2 });
  await tick(); await settle('t2'); const skr = await sk; await tick();
  const skRel = D.A.outAt - D.A.startedAt;
  ok('next ▶ leaves at the next phrase start ≥ 1.2 s out (52 s, got ' + skRel.toFixed(2) + ')', Math.abs(skRel - 52) < 1e-6,
     'left at ' + skRel + ' — 52 is the phrase; 52 is also a downbeat but so is 52/54/…; a downbeat path would give 52 only by luck');
  ok('next ▶ says so (¶ in the reply): ' + skr, /¶/.test(skr), skr);
  now = 100 + .35 + 52.5;                    /* just past a phrase start: the next one is 68, the next downbeat 54 */
  Player.stop(); started.length = 0; pending.clear();
  p = Player.play(set, 0); await tick(); await settle('t1'); await p; await tick(); await settle('t2'); await tick();
  const sk2 = Player.skip({ lead: 1.2 }); await tick(); await settle('t2'); await sk2; await tick();
  const sk2Rel = D.A.outAt - D.A.startedAt;
  /* A fresh play() started at now+.35, so 'since' is 0 here: next start after 1.2 s is 4 s */
  ok('after a fresh ▶, next goes to the first phrase start past the lead (4 s, got ' + sk2Rel.toFixed(2) + ')', Math.abs(sk2Rel - 4) < 1e-6,
     'left at ' + sk2Rel + ' — the downbeat path would give 2 s');

  /* a plain set: nothing changes */
  Player.stop(); started.length = 0; pending.clear();
  const plain = [track('u1', 2), track('u2', 5)];        /* no .phrase */
  p = Player.play(plain, 0); await tick(); await settle('u1'); await p; await tick(); await settle('u2'); await tick();
  ok('a set without the flag plays in downbeat mode', Player.phrase === false, 'phrase ' + Player.phrase);
  const uRel = D.A.outAt - D.A.startedAt;
  ok('…exit is the downbeat nearest the natural end (228 s, got ' + uRel.toFixed(2) + ')', Math.abs(uRel - 228) < 1e-6,
     'exit ' + uRel + ' — the phrase path leaked into a plain set');
  ok('…fade is the set\'s xfade (12 s)', Math.abs(D.A.fade - 12) < 1e-6, 'fade ' + D.A.fade);
  ok('…incoming enters at its first beat (0)', D.B.entry === 0, 'entry ' + D.B.entry);
  ok('…and no phrase was computed for either track', !plain[0].phrase && !plain[1].phrase,
     'phrase stamped on a plain set: ' + JSON.stringify([plain[0].phrase, plain[1].phrase]));
  ok('…log carries no ¶', !/¶/.test(Player.log[0]), Player.log[0]);

  /* setPhrase(true) on the plain set re-plans the pending transition */
  const sp = Player.setPhrase(true); await tick(); await settle('u2'); await sp; await tick();
  const u2Rel = D.A.outAt - D.A.startedAt;
  ok('setPhrase(true) re-chains: exit moves to the last phrase start (212 s, got ' + u2Rel.toFixed(2) + ')', Math.abs(u2Rel - 212) < 1e-6,
     'exit ' + u2Rel);
  ok('…and stamps the flag on the order', plain.phrase === true, 'order.phrase ' + plain.phrase);

  /* an UNLOCKED incoming track in phrase mode takes the straight path */
  Player.stop(); started.length = 0; pending.clear();
  const v1 = track('v1', 2), v2 = track('v2', 5, { unlocked: true });
  const uset = [v1, v2]; uset.phrase = true;
  p = Player.play(uset, 0); await tick(); await settle('v1'); await p; await tick(); await settle('v2'); await tick();
  ok('unlocked incoming: entry 0, rate 1, no phrase stamped', D.B.entry === 0 && D.B.rate === 1 && !v2.phrase,
     'entry ' + D.B.entry + ' rate ' + D.B.rate + ' phrase ' + JSON.stringify(v2.phrase));
  ok('…outgoing still leaves on its phrase (¶x.x→· in the log)', /¶[0-9.]+→· 16s/.test(Player.log[0]), Player.log[0]);

  /* buffers WITHOUT channel data (the other harness's fakes): phrase mode
     falls back to the downbeat path and nothing throws */
  Player.stop(); started.length = 0; pending.clear();
  const b1 = track('b1', 2, { bare: true }), b2 = track('b2', 5, { bare: true });
  const bset = [b1, b2]; bset.phrase = true;
  let threw = null;
  try { p = Player.play(bset, 0); await tick(); await settle('b1'); await p; await tick(); await settle('b2'); await tick(); }
  catch (e) { threw = e; }
  ok('no channel data → no throw, downbeat exit (228 s)', !threw && Math.abs(D.A.outAt - D.A.startedAt - 228) < 1e-6,
     threw ? String(threw) : 'exit ' + (D.A.outAt - D.A.startedAt));
  ok('…and the fade is the set\'s xfade', Math.abs(D.A.fade - 12) < 1e-6, 'fade ' + D.A.fade);
  Player.stop();
}

(async () => {
  console.log('\n── part 1: the detector on known structure ──────────────────');
  const NB = 64;                                       /* 64 bars = 8 phrases */
  /* loudness steps every 8 bars from bar 3: quiet phrase, loud phrase, … */
  {
    const P = 3;
    const x = synth(NB, bar => (Math.floor(((bar - P) + 800) / 8) % 2 ? 0.6 : 0.2));
    const r = PH.detect([x], SR, grid(NB * 4 + 1), { probe: true });
    ok('loudness steps from bar 3 → offset 3 (got ' + r.at + ', contrast ' + r.contrast + ', shuffles ' + r.shuffles + ')', r.at === P,
       'offset ' + r.at + ' — the detector does not find a loudness phrase it was handed');
    ok('…with a clear contrast (' + r.contrast + ' > 2)', r.contrast > 2, 'contrast ' + r.contrast);
    ok('…and it beats all 19 bar-shuffles', r.shuffles === 19, 'beat ' + r.shuffles + ' of 19');
    /* half-split: the same structure from either half */
    const h1 = PH.detect([x], SR, grid(NB * 4 + 1), { bars: [0, 32] });
    const h2 = PH.detect([x], SR, grid(NB * 4 + 1), { bars: [32, 64] });
    ok('first half and second half agree on the offset (' + h1.at + ', ' + h2.at + ')', h1.at === P && h2.at === P,
       'halves ' + h1.at + '/' + h2.at + ' — a range not a multiple of 8 is re-based wrongly, or the detector is unstable');
    /* a range starting off a phrase boundary is re-based to bar 0 */
    const h3 = PH.detect([x], SR, grid(NB * 4 + 1), { bars: [13, 57] });
    ok('a bar range starting at 13 still reports the offset against bar 0 (' + h3.at + ')', h3.at === P,
       'offset ' + h3.at + ' — the lo%8 shift is wrong');
    ok('the same input gives the same shuffles figure twice (seeded)',
       PH.detect([x], SR, grid(NB * 4 + 1)).shuffles === r.shuffles, 'the null is not deterministic');
  }
  /* THE FILL CASE — the reason the rule is variance, not change. A loud
     drop-in bar sits one bar BEFORE every section change (bar 7 of each
     phrase at 1.8×). The biggest bar-to-bar changes are into and out of
     that bar, at offsets 7 and 0 — one bar early — and a change-sum rule
     votes for them; the phrase still starts at bar 1 of the pattern. */
  {
    const P = 1;
    const x = synth(NB, bar => ((Math.floor(((bar - P) + 800) / 8) % 2 ? 0.6 : 0.2) * (((bar - P + 800) % 8 === 7) ? 1.8 : 1)));
    const r = PH.detect([x], SR, grid(NB * 4 + 1));
    ok('a fill bar before every change does not pull the offset (want 1, got ' + r.at + ', contrast ' + r.contrast + ')', r.at === P,
       'offset ' + r.at + ' — the detector followed the fill, not the section');
  }
  /* brightness steps only: same RMS, white vs smoothed noise, from bar 6 */
  {
    const P = 6;
    const x = synth(NB, () => 0.4, bar => Math.floor(((bar - P) + 800) / 8) % 2 === 0);
    /* equalise RMS per bar so loudness carries no structure */
    const perBar = 4 * BEAT * SR;
    for (let b = 0; b < NB; b++) { let s = 0; for (let i = 0; i < perBar; i++) s += x[b * perBar + i] ** 2;
      const g = 0.4 / Math.sqrt(s / perBar); for (let i = 0; i < perBar; i++) x[b * perBar + i] *= g; }
    const r = PH.detect([x], SR, grid(NB * 4 + 1));
    ok('brightness steps from bar 6 → offset 6 (got ' + r.at + ', contrast ' + r.contrast + ')', r.at === P,
       'offset ' + r.at + ' — the zcr/high-band terms are not reaching the decision');
  }
  /* no structure: contrast collapses toward 1 and the shuffles are not beaten */
  {
    const x = synth(NB, () => 0.4);
    const r = PH.detect([x], SR, grid(NB * 4 + 1));
    ok('no structure → contrast near 1 (' + r.contrast + ' < 1.2)', r.contrast < 1.2,
       'contrast ' + r.contrast + ' on white noise — the detector manufactures preference from nothing');
    ok('no structure → does not beat all 19 shuffles (beat ' + r.shuffles + ')', r.shuffles < 19,
       'white noise beat every shuffle — the null is broken');
  }
  /* 4-bar structure: the winner is one of the two 4-bar-aligned offsets */
  {
    const P = 2;
    const x = synth(NB, bar => (Math.floor(((bar - P) + 800) / 4) % 2 ? 0.6 : 0.2));
    const r = PH.detect([x], SR, grid(NB * 4 + 1));
    ok('4-bar steps from bar 2 → offset 2 or 6 (got ' + r.at + ')', r.at === P || r.at === P + 4,
       'offset ' + r.at + ' — a 4-bar structure should still land on a 4-bar boundary');
  }
  /* 16-bar structure is also 8-bar aligned */
  {
    const P = 5;
    const x = synth(NB, bar => (Math.floor(((bar - P) + 800) / 16) % 2 ? 0.6 : 0.2));
    const r = PH.detect([x], SR, grid(NB * 4 + 1));
    ok('16-bar steps from bar 5 → offset 5 (got ' + r.at + ')', r.at === P, 'offset ' + r.at);
  }
  /* robustness: audio shorter than the grid, grid shorter than the audio, tiny input */
  {
    const x = synth(NB, bar => (Math.floor(bar / 8) % 2 ? 0.6 : 0.2));
    const r1 = PH.detect([x], SR, grid(NB * 4 + 40));   /* grid runs 40 beats past the audio */
    ok('a grid running past the audio does not throw and still finds offset 0 (' + r1.at + ')', r1.at === 0, 'offset ' + r1.at);
    const r2 = PH.detect([x], SR, grid(20 * 4 + 1));      /* grid covers 20 of 64 bars */
    ok('a grid covering a third of the audio still reports (' + r2.at + ', nBars ' + r2.nBars + ')', r2.ok && r2.nBars === 20,
       JSON.stringify(r2));
    const r3 = PH.detect([x], SR, grid(9 * 4 + 1));
    ok('fewer than ten bars → ok:false, not a throw', r3.ok === false, JSON.stringify(r3));
    const r4 = PH.detect([x], SR, []);
    ok('no grid → ok:false', r4.ok === false, JSON.stringify(r4));
  }
  console.log('\n── helpers ────────────────────────────────────────────────────');
  {
    const b = grid(200), ph = { ok: true, beat: 12, bars: 8 };
    const st = PH.starts(b, ph);
    ok('starts: 12, 44, 76, … every 32 beats', st[0] === 12 && st[1] === 44 && st[st.length - 1] <= 199, JSON.stringify(st));
    const L = PH.lastStartWithin(b, ph, 45, 70);       /* beats at 6s, 22s, 38s, 54s, 70s, 86s */
    ok('lastStartWithin [45,70] → the start at 70 s', L && L.t === 70, JSON.stringify(L));
    const L2 = PH.lastStartWithin(b, ph, 45, 50);
    ok('lastStartWithin [45,50] has none inside → the first start ≥ 45 (54 s)', L2 && L2.t === 54, JSON.stringify(L2));
    const L3 = PH.lastStartWithin(b, ph, 95, 99);
    ok('lastStartWithin past the grid → null', L3 === null, JSON.stringify(L3));
    const F = PH.firstStartAfter(b, ph, 38);
    ok('firstStartAfter 38 → 54 (strictly after)', F && F.t === 54, JSON.stringify(F));
    ok('lengthAt inside the grid is 32 beats (16 s)', Math.abs(PH.lengthAt(b, 12) - 16) < 1e-9, PH.lengthAt(b, 12));
    ok('lengthAt near the end falls back to mean spacing (16 s)', Math.abs(PH.lengthAt(b, 180) - 16) < 1e-9, PH.lengthAt(b, 180));
    ok('starts with ok:false → none', PH.starts(b, { ok: false, beat: 0 }).length === 0, 'gave starts for an unusable result');
  }

  await part2();

  console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') + ' of ' + checks + ' checks');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FATAL: ' + (e.stack || e)); process.exit(1); });
