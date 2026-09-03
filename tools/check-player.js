/* Does the Player survive a plan change while a decode is in flight?

   chain() awaits LIB.decode() in the middle. cancelPending(), stop() and a
   second play() can all run during that await, and until 2026-08-19 the
   stale continuation carried on: it built a deck for the old next track,
   overwrote B (orphaning the deck the new plan had just scheduled, which then
   played alongside it) and re-armed the handover timer against the old exit.
   Narrow window — a decode takes a second or two and the replan has to land
   inside it — but ▶ pressed twice, or ⚡ blend fast clicked right after a
   handover, lands inside it.

   The Player IIFE is evaluated with a fake AudioContext and a LIB.decode whose
   promises this file resolves by hand, so the interleavings are exact rather
   than raced. Every check states its falsifier.

       node tools/check-player.js
*/
const fs = require('fs');
let fails = 0, checks = 0;
const ok = (name, cond, falsifier) => {
  checks++;
  if (!cond) { fails++; console.log('  FAIL  ' + name + '\n        falsifier hit: ' + falsifier); }
  else console.log('  pass  ' + name);
};

/* ── extract the Player from the real source ──────────────────────────── */
/* CRLF-proof. core.autocrlf=true checks the source out with CRLF on
   Windows, and every regex below is written against LF; on a fresh clone
   all three harnesses died with FATAL before testing anything. */
const src = fs.readFileSync(process.env.DECKWAVE_SRC || 'assets/deckwave.js', 'utf8').replace(/\r\n/g, '\n');
const a = src.indexOf('\nconst Player = (() => {');
const b = src.indexOf('\n})();\n', a);
if (a < 0 || b < 0) { console.log('FATAL: could not find the Player IIFE'); process.exit(1); }
const playerSrc = src.slice(a + 1, b + 6).replace(/^const Player = /, '');

/* ── fakes: just enough Web Audio to schedule against ─────────────────── */
const started = [];                    /* every source.start() call, in order */
const param = () => ({ value: 0, cancelScheduledValues() {}, setValueAtTime() {},
  linearRampToValueAtTime() {}, setTargetAtTime() {} });
const node = () => ({ playbackRate: param(), gain: param(), type: '', frequency: { value: 0 },
  Q: { value: 0 }, threshold: { value: 0 }, ratio: { value: 0 }, fftSize: 0,
  smoothingTimeConstant: 0, connect() {}, parameters: { get: () => param() },
  start(at, off) { this._started = { at, off }; started.push(this); },
  stop(at) { this._stopped = true; this._stopAt = at; }, onended: null,
  disconnect() { this._disconnected = true; },
  port: { onmessage: null, posted: [], postMessage(m) { this.posted.push(m); } } });
let now = 100;
function AC() {
  return { get currentTime() { return now; }, state: 'running',
    async resume() {}, async suspend() {}, close() {},
    /* AC.moduleOk gates the held-worklet module: false (default) refuses
       the static module and any blob — the posture of a platform where the
       held path cannot load — so every earlier check runs on the plain
       worklet exactly as before; true accepts everything. */
    audioWorklet: { async addModule(u) {
      if (!AC.moduleOk && /deckwave-stretch\.module|^blob:/.test(String(u))) throw new Error('refused (test)');
    } },
    createGain: node, createDynamicsCompressor: node, createAnalyser: node,
    createBufferSource: node, createBiquadFilter: node };
}
/* RECORD THE PROCESSOR NAME. Until 2026-09-01 this fake ignored both
   arguments, so the check below that `makeDeck` builds decks on the worklet
   boot() actually chose could not fail — hard-coding 'soundtouch-processor'
   in makeDeck would have passed it (review 2026-09-01; ledger 98's class).
   The name is the whole difference between the held pipe and the one that
   zero-fills a block a few times a minute. */
const AudioWorkletNode = function (c, name) { const n = node(); n._processorName = name; return n; };
/* ── fake LONG timers ───────────────────────────────────────────────────
   chain()'s handover timer is minutes away on the fake clock. Anything
   over a second is captured here so a check can fire it by hand; the 0 ms
   ticks this harness itself uses pass straight through. */
const realSetTimeout = global.setTimeout, realClearTimeout = global.clearTimeout;
const longTimers = new Map(); let ltId = 1e6;
global.setTimeout = (fn, ms, ...a) => { if (!(ms > 1000)) return realSetTimeout(fn, ms, ...a);
  const id = ++ltId; longTimers.set(id, { fn, ms }); return id; };
global.clearTimeout = id => { if (longTimers.delete(id)) return; realClearTimeout(id); };
const fireLong = () => { const e = [...longTimers.entries()].pop(); if (!e) return null;
  longTimers.delete(e[0]); e[1].fn(); return e[1]; };
const ASSETS = { base: 'vendor/', files: { soundtouch: 'x' }, allowCDN: false };
const CDN = {}; const assetURL = k => ASSETS.base + ASSETS.files[k];

/* decode() hands back a promise per call; the test resolves them by name */
const pending = new Map();
const LIB = { decode(meta) {
  return new Promise((res, rej) => pending.set(meta.name, { res, rej, meta }));
} };
const settle = name => { const p = pending.get(name); pending.delete(name);
  p.res({ duration: p.meta.dur, name }); return new Promise(r => setTimeout(r, 0)); };
const fail = name => { const p = pending.get(name); pending.delete(name);
  p.rej(new Error('decode failed (test)')); return new Promise(r => setTimeout(r, 0)); };
const tick = () => new Promise(r => setTimeout(r, 0));

global.window = global;
const Player = eval(playerSrc);
const D = Player._dev;

/* a small set: grids every 0.5s so every track is 120 bpm, no stretch */
const grid = n => Array.from({ length: n }, (_, i) => +(i * 0.5).toFixed(2));
const mk = (name, dur) => ({ name, bpm: 120, camelot: '8A', dur, beats: grid(dur * 2) });
const set = [mk('t1', 240), mk('t2', 240), mk('t3', 240), mk('t4', 240)];
const x = mk('x', 200);

(async () => {
  console.log('\n── a replan during chain()\'s decode ───────────────────────');
  /* play: decode t1 → A starts, chain() begins decoding t2 */
  const p = Player.play(set, 0);
  await tick(); await settle('t1'); await p; await tick();
  ok('play() started the first deck and chain() is decoding the next',
     started.length === 1 && pending.has('t2'),
     'started ' + started.length + ' sources; pending ' + [...pending.keys()]);

  /* keeper clicks a track: blendNow(x). Its decode resolves FIRST. */
  const bn = Player.blendNow(x, { lead: 1 });
  await tick(); await settle('x'); await bn; await tick();
  ok('blendNow scheduled x as the next deck', D.B && D.B.track.meta === x,
     'B is ' + (D.B && D.B.track.meta.name));
  const bDeck = D.B;

  /* now the ORIGINAL chain()'s decode of t2 comes back, late */
  await settle('t2'); await tick();
  /* Falsifier for the fix: a third source started (t2's deck), or B no
     longer the blend-now deck. Under the old code both happened. */
  ok('the stale chain() built nothing — still exactly two decks started',
     started.length === 2, started.length + ' sources started; t2 was scheduled by a stale plan');
  ok('B is still the blend-now deck, not overwritten by the stale plan',
     D.B === bDeck && D.B.track.meta === x, 'B is now ' + (D.B && D.B.track.meta.name));
  ok('the blend-now target is next in the order', D.order[D.idx + 1] === x,
     'order[idx+1] is ' + (D.order[D.idx + 1] && D.order[D.idx + 1].name));

  console.log('\n── ▶ pressed twice while the first decode is in flight ───────');
  Player.stop(); started.length = 0; pending.clear();
  const set2 = [mk('u1', 240), mk('u2', 240)];
  const p1 = Player.play(set, 0);
  await tick();
  const p2 = Player.play(set2, 0);
  await tick();
  await settle('t1');          /* the FIRST play's decode lands after the second ▶ */
  const r1 = await p1; await tick();
  await settle('u1'); const r2 = await p2; await tick();
  ok('the first play() stood down', r1 === 'superseded', 'first play returned ' + JSON.stringify(r1));
  ok('only the second set is on the air', D.A && D.A.track.meta.name === 'u1' &&
     started.filter(s => s._started).length === 1,
     'A=' + (D.A && D.A.track.meta.name) + ', ' + started.length + ' sources started');
  ok('the second play() reports normally', /^1\/2\b/.test(r2), 'second play returned ' + JSON.stringify(r2));

  console.log('\n── reorder({now}) when the incoming track will not decode ────');
  Player.stop(); started.length = 0; pending.clear();
  /* a fresh order — scenario 1's placeNext() spliced x into `set` in place,
     which is the in-place idiom the dashboard relies on, and exactly why a
     second scenario must not reuse that array */
  const set3 = [mk('t1', 240), mk('t2', 240), mk('t3', 240), mk('t4', 240)];
  const p3 = Player.play(set3, 0);
  await tick(); await settle('t1'); await p3; await tick();
  await settle('t2'); await tick();             /* normal chain: t2 is B */
  ok('baseline: t2 is scheduled next', D.B && D.B.track.meta.name === 't2', 'B=' + (D.B && D.B.track.meta.name));
  /* new order: t1 (playing), then a track that will not decode, then t3 */
  const bad = mk('bad', 240);
  const seq = [set3[0], bad, set3[2], set3[3]];
  const ro = Player.reorder(seq, { now: true, lead: 1 });
  await tick();
  ok('reorder is decoding the bad track', pending.has('bad'), 'pending: ' + [...pending.keys()]);
  await fail('bad');                            /* decode rejects */
  await tick(); await tick();
  /* the fallback chain() tries the bad track again, fails, splices, moves on */
  if (pending.has('bad')) await fail('bad');
  await tick(); await tick();
  ok('chain() fell back and is now decoding the track after the bad one',
     pending.has('t3'), 'pending: ' + [...pending.keys()] + ' — the set is stalled with no exit planned');
  await settle('t3'); const ror = await ro; await tick();
  ok('the bad track was spliced out of the order', !seq.includes(bad), 'bad is still at ' + seq.indexOf(bad));
  ok('the playing deck has an exit scheduled again', D.A && D.A.outAt != null,
     'A.outAt is ' + (D.A && D.A.outAt) + ' — the track will play to its end and the set stops');
  ok('t3 is now the next deck', D.B && D.B.track.meta.name === 't3', 'B=' + (D.B && D.B.track.meta.name));
  ok('reorder said what it did', /cannot load bad/.test(ror) && /skipped/.test(ror), 'returned ' + JSON.stringify(ror));
  ok('list and deck still agree', seq[D.idx] === D.A.track.meta, 'LIST ≠ DECK');

  console.log('\n── the DECK re-bases after a reach track, like the planner ───');
  /* sequence(), resequenceTail() and verify() all reposition the rolling
     target to a reach track's own bpm. chain() did not — both straight modes
     left the target alone — so the first locked track after a 167 → 100
     reach jump was chained at 167/bpm: ×1.67 on a track the plan printed at
     0%. Falsifier: the deck built for `after` has rate ≠ reach.bpm/after.bpm. */
  Player.stop(); started.length = 0; pending.clear();
  const a0 = mk('a0', 240); a0.bpm = 167;
  const reach = mk('reach', 240); reach.bpm = 100; reach._unlocked = true; reach._unlockReason = 'reach'; reach._locked = true;
  const after = mk('after', 240); after.bpm = 102;
  const gridT = mk('gridT', 240); gridT.bpm = 140; gridT._unlocked = true; gridT._unlockReason = 'grid'; gridT._locked = false;
  const after2 = mk('after2', 240); after2.bpm = 104;
  const set4 = [a0, reach, after, gridT, after2];
  const p4 = Player.play(set4, 0);
  await tick(); await settle('a0'); await p4; await tick();
  await settle('reach'); await tick();
  ok('the reach track is chained straight (rate 1)', D.B && D.B.rate === 1 && D.B.entry === 0,
     'B rate ' + (D.B && D.B.rate) + ' entry ' + (D.B && D.B.entry));
  ok('the target has moved to the reach track\'s bpm', D.tempo === 100, 'tempo is ' + D.tempo + ', expected 100');
  /* hand over by hand — the timer is real-time and the exit is minutes away */
  D.setIdx(1); D.setDecks(D.B, null); D.chain();
  await tick(); await settle('after'); await tick();
  ok('the locked track after a reach jump is stretched from the reach bpm, not the old target',
     D.B && Math.abs(D.B.rate - 100 / 102) < 1e-9,
     'rate ' + (D.B && D.B.rate) + ' — expected ' + (100 / 102).toFixed(4) + ', the old code gave ' + (167 / 102).toFixed(3));
  /* and a GRID track still moves it nowhere */
  D.setIdx(2); D.setDecks(D.B, null); D.chain();
  await tick(); await settle('gridT'); await tick();
  const tBefore = D.tempo;
  ok('a grid-unlocked track is chained straight', D.B && D.B.rate === 1, 'rate ' + (D.B && D.B.rate));
  D.setIdx(3); D.setDecks(D.B, null); D.chain();
  await tick(); await settle('after2'); await tick();
  ok('the target did not move for the grid track', D.tempo !== 140 && D.B && Math.abs(D.B.rate - tBefore / 104) < 1e-9,
     'tempo ' + D.tempo + ' rate ' + (D.B && D.B.rate) + ' — a distrusted bpm steered the set');

  console.log('\n── cancelling a scheduled deck puts the target back ───────────');
  /* chain() moves the rolling target the moment it schedules B — drift for a
     locked track, a re-base for a reach track. cancelPending() threw B away
     and left the target where B had moved it, so the replacement was chained
     against a tempo nothing was playing. Falsifier: after blendNow replaces
     a scheduled reach track, the new deck's rate is not oldTarget/bpm. */
  Player.stop(); started.length = 0; pending.clear();
  const c0 = mk('c0', 240); c0.bpm = 100;
  const cReach = mk('cReach', 240); cReach.bpm = 120; cReach._unlocked = true; cReach._unlockReason = 'reach'; cReach._locked = true;
  const cX = mk('cX', 240); cX.bpm = 104;
  const set6 = [c0, cReach, cX];
  const p6 = Player.play(set6, 0);
  await tick(); await settle('c0'); await p6; await tick();
  await settle('cReach'); await tick();
  ok('scheduling the reach track moved the target to 120', D.tempo === 120, 'tempo ' + D.tempo);
  const bn6 = Player.blendNow(cX, { lead: 1 });
  await tick(); await settle('cX'); await bn6; await tick();
  ok('cancelling it put the target back to 100', D.B && Math.abs(D.B.rate - 100 / 104) < 1e-9,
     'cX chained at ' + (D.B && D.B.rate) + ' — expected ' + (100 / 104).toFixed(4) + ' (old code: ' + (120 / 104).toFixed(4) + ')');

  console.log('\n── queuing a row that has already played ─────────────────────');
  /* placeNext() pulls the row from wherever it is. From BEFORE the playing
     track that shifts the playing track down one and idx used to stay put,
     so state.idx named the track AFTER the deck and the planned next track
     was skipped at the handover. Falsifier: order[idx] !== A.track.meta. */
  Player.stop(); started.length = 0; pending.clear();
  const set5 = [mk('q1', 240), mk('q2', 240), mk('q3', 240), mk('q4', 240), mk('q5', 240)];
  const p5 = Player.play(set5, 2);
  await tick(); await settle('q3'); await p5; await tick(); await settle('q4'); await tick();
  const qn = Player.queueNext(set5[0]);           /* q1 — already played */
  await tick(); await settle('q1'); await qn; await tick();
  ok('list and deck agree after queuing an already-played row', set5[D.idx] === D.A.track.meta,
     'idx ' + D.idx + ' names ' + set5[D.idx].name + ' while ' + D.A.track.meta.name + ' plays');
  ok('the queued row sits right after the playing track', set5[D.idx + 1] && set5[D.idx + 1].name === 'q1',
     'order after the deck: ' + set5.slice(D.idx + 1).map(t => t.name).join(','));
  ok('the planned next track is still in the set after it', set5.map(t => t.name).join(',') === 'q2,q3,q1,q4,q5',
     'order is ' + set5.map(t => t.name).join(','));
  const self = await Player.queueNext(D.A.track.meta);
  ok('queuing the playing track itself is refused', /already playing/.test(self), 'returned ' + JSON.stringify(self));
  const selfB = await Player.blendNow(D.A.track.meta);
  ok('blending the playing track into itself is refused', /already playing/.test(selfB), 'returned ' + JSON.stringify(selfB));

  console.log('\n── next ▶ blends, it does not cut ────────────────────────────');
  /* Keeper: "the next button should default to a reasonable blend asap."
     skip() was play(order, idx + 1): the playing source stopped, the next
     started at t + 0.35 from the top. Now it decodes the next track, leaves
     the playing deck at the next downbeat ≥ 1.2 s out and crossfades over
     the set's xfade. Falsifiers: the playing source was stopped; the next
     deck starts on the clock rather than on A's grid; A has no fade-out
     scheduled. { cut: true } keeps the old behaviour. */
  Player.stop(); started.length = 0; pending.clear();
  const set8 = [mk('n1', 240), mk('n2', 240), mk('n3', 240)];
  const p8 = Player.play(set8, 0);
  await tick(); await settle('n1'); await p8; await tick(); await settle('n2'); await tick();
  const aSrc = D.A.src, plannedB = D.B;
  ok('baseline: n2 is the planned next deck, far out', D.B && D.B.track.meta.name === 'n2' && D.A.outAt - now > 100,
     'B=' + (D.B && D.B.track.meta.name) + ' outAt-now=' + (D.A && (D.A.outAt - now)));
  now += 5;                                     /* a few seconds into n1 */
  const sk = Player.skip();
  await tick();
  ok('next decodes the next track first (a point chosen before decode lands in the past)', pending.has('n2'),
     'pending: ' + [...pending.keys()]);
  await settle('n2'); const skr = await sk; await tick();
  ok('the playing source was NOT cut — its only stop is scheduled past the fade', D.A && D.A.src === aSrc && aSrc._stopAt > now + 1.2 + 16,
     'A.src stop at ' + aSrc._stopAt + ' (now ' + now + ') A=' + (D.A && D.A.track.meta.name) + ' — an immediate stop() is a cut');
  ok('the old planned deck was cancelled and a new one built for n2', D.B && D.B !== plannedB && D.B.track.meta.name === 'n2',
     'B=' + (D.B && D.B.track.meta.name) + (D.B === plannedB ? ' (the OLD deck — nothing changed)' : ''));
  /* the exit sits on a downbeat of n1's grid (every 2 s at 120 bpm, 4 beats × 0.5 s) at least 1.2 s out */
  const lead = D.A.outAt - now;
  const onGrid = Math.abs(((D.A.outAt - D.A.startedAt) / 2) - Math.round((D.A.outAt - D.A.startedAt) / 2)) < 1e-6;
  ok('the exit is the next downbeat at least 1.2 s out', lead >= 1.2 && lead < 1.2 + 2 + 1e-6 && onGrid,
     'lead ' + lead.toFixed(3) + 's onGrid=' + onGrid + ' — a cut would start at +0.35 off the grid');
  ok('next said so', /^next · blending in/.test(skr), 'returned ' + JSON.stringify(skr));
  ok('list and deck still agree', set8[D.idx] === D.A.track.meta, 'LIST ≠ DECK');
  const cutr = Player.skip({ cut: true });
  await tick(); await settle('n2'); await cutr; await tick();
  ok('{ cut: true } is the old hard cut', aSrc._stopAt === undefined && D.A && D.A.track.meta.name === 'n2' && D.idx === 1,
     'A.src stopAt=' + aSrc._stopAt + ' A=' + (D.A && D.A.track.meta.name) + ' idx=' + D.idx + ' — stop() with no time is the cut');
  /* an in-flight skip whose decode lands after the deck has moved on */
  Player.stop(); started.length = 0; pending.clear();
  const set9 = [mk('m1', 240), mk('m2', 240), mk('m3', 240)];
  const p9 = Player.play(set9, 0);
  await tick(); await settle('m1'); await p9; await tick(); await settle('m2'); await tick();
  const sk2 = Player.skip();
  await tick();
  D.setIdx(1); D.setDecks(D.B, null);           /* the handover fires during the decode */
  await settle('m2'); const sk2r = await sk2; await tick();
  ok('a skip whose track arrives during the decode does nothing and says so', /already on m2/.test(sk2r) && D.A.track.meta.name === 'm2',
     'returned ' + JSON.stringify(sk2r) + ' A=' + (D.A && D.A.track.meta.name));
  ok('skip at the end of the order says end', (await (async () => { D.setIdx(2); return Player.skip(); })()) === 'end', 'did not say end');

  Player.stop();

  console.log('\n── the worklet: held block and the gap counter (ledger 65) ──');
  /* With the module refused (AC.moduleOk false) boot() must land on the
     plain worklet and SAY WHY — the posture of a platform where neither
     the static module nor a blob loads. */
  ok('boot() with the module refused falls back to the plain worklet and says why',
     Player.worklet.held === false && /static module failed/.test(Player.worklet.why) && Player.worklet.name === 'soundtouch-processor',
     JSON.stringify(Player.worklet));
  started.length = 0; pending.clear();
  const setW = [mk('w1', 240), mk('w2', 240), mk('w3', 240)];
  const pw = Player.play(setW, 0); await tick(); await settle('w1'); const pwr = await pw; await tick(); await settle('w2'); await tick();
  ok('the play line names the worklet in use', /plain worklet \(/.test(pwr), JSON.stringify(pwr));
  ok('deck.gaps is null before the worklet has posted metrics', Player.deck.gaps === null && Player.deck.underruns === null, JSON.stringify(Player.deck));
  /* the worklet posts metrics on the node's port; the deck keeps the latest */
  D.A.st.port.onmessage({ data: { type: 'metrics', gaps: 3, underrunCount: 52, framesBuffered: 400, blockCount: 1000 } });
  ok('a metrics message lands on the deck: gaps 3, underruns 52', Player.deck.gaps === 3 && Player.deck.underruns === 52 && Player.state.gaps === 3,
     JSON.stringify({ deck: Player.deck.gaps, under: Player.deck.underruns, state: Player.state.gaps }));
  D.A.st.port.onmessage({ data: { type: 'not-metrics', gaps: 99 } });
  ok('other port messages are ignored', Player.deck.gaps === 3, 'gaps ' + Player.deck.gaps);
  /* at the handover, a deck that gapped is written to the log; a clean one is not.
     The handover is chain()'s timer, minutes away on the fake clock — fire
     the same function by hand through the seam. */
  const before = Player.log.length;
  D.handover(1);
  ok('handover logs a ⚠ line for a deck that gapped', Player.log[0] && /⚠ .*w1 · 3 worklet gaps \(×1\.000\)/.test(Player.log[0]), JSON.stringify(Player.log.slice(0, 2)));
  ok('…and prevDeck carries the count', Player.prevDeck && Player.prevDeck.gaps === 3, JSON.stringify(Player.prevDeck));
  await tick(); await settle('w3'); await tick();
  const before2 = Player.log.length;
  D.handover(2);
  ok('a clean deck (no metrics yet) adds no ⚠ line', !/⚠/.test(Player.log[0]), JSON.stringify(Player.log.slice(0, 2)));

  /* The wrapper itself, run as the Player loads it: vendored text + wrapper
     as one script. Falsifiers: the wrapper does not register; the plain
     processor shows 0 gaps at ×1.05 (then the measurement is void); the
     wrapper shows any. */
  {
    global.sampleRate = 44100;
    const REG = {};
    global.AudioWorkletProcessor = class { constructor() { this.port = { postMessage() {}, onmessage: null }; } };
    global.registerProcessor = (name, cls) => { REG[name] = cls; };
    const txt = fs.readFileSync('vendor/soundtouch-processor.js', 'utf8') + '\n' + fs.readFileSync('assets/deckwave-stretch.js', 'utf8');
    new Function(txt)();
    ok('vendored text + wrapper registers both processor names', !!REG['soundtouch-processor'] && !!REG['deckwave-stretch'], Object.keys(REG).join(','));
    const drive = (Cls, rate, seconds) => {
      const proc = new Cls({}); let gaps = 0, ph = 0, last = null;
      proc.port.postMessage = m => { last = m; };
      const L = new Float32Array(128), R = new Float32Array(128), oL = new Float32Array(128), oR = new Float32Array(128);
      const params = { pitch: [1], pitchSemitones: [0], playbackRate: [rate] };
      for (let b = 0; b < Math.floor(seconds * 44100 / 128); b++) {
        for (let i = 0; i < 128; i++) { ph += 2 * Math.PI * 220 / 44100; L[i] = R[i] = Math.sin(ph) * .5 + (Math.random() - .5) * .1; }
        const before = proc._underrunCount; proc.process([[L, R]], [[oL, oR]], params);
        if (proc._underrunCount > before && b > 300) gaps++;
      }
      return { gaps, last, warm: proc._underrunCount - gaps };
    };
    const plain = drive(REG['soundtouch-processor'], 1.05, 90), held = drive(REG['deckwave-stretch'], 1.05, 90);
    ok('the plain processor zero-fills blocks at ×1.05 (' + plain.gaps + ' in 90 s) — the defect is real', plain.gaps > 0, 'no gaps — nothing to fix, or the driver is wrong');
    ok('the shipped wrapper zero-fills none at ×1.05 (' + held.gaps + ')', held.gaps === 0, held.gaps + ' gaps through the wrapper');
    ok('the wrapper\'s metrics carry gaps === underrunCount (warm-up not counted)', held.last && held.last.type === 'metrics' && held.last.gaps === 0 && held.last.underrunCount === 0,
       JSON.stringify(held.last));
    ok('the plain processor\'s underrunCount includes its warm-up (' + plain.warm + ' blocks)', plain.warm > 30, 'warm ' + plain.warm);
    const held1 = drive(REG['deckwave-stretch'], 1.0012, 90), held2 = drive(REG['deckwave-stretch'], 0.95, 90);
    /* the door out (ledger 124): a release message makes process() return
       false; the vendored handler still receives its own messages */
    {
      const proc = new REG['deckwave-stretch']({});
      const L = new Float32Array(128), R = new Float32Array(128), oL = new Float32Array(128), oR = new Float32Array(128);
      const params = { pitch: [1], pitchSemitones: [0], playbackRate: [1] };
      const alive = proc.process([[L, R]], [[oL, oR]], params);
      proc.port.onmessage({ data: { type: 'set-stretch-parameters', params: { sequenceMs: 40 } } });
      const vendoredGotIt = proc._pendingStretchParameters && proc._pendingStretchParameters.sequenceMs === 40;
      proc.port.onmessage({ data: { type: 'release' } });
      const after = proc.process([[L, R]], [[oL, oR]], params);
      ok('the held worklet stays alive until told: process() true, then false after {type:\'release\'}', alive === true && after === false,
         'alive ' + alive + ' after release ' + after + ' — a node that never returns false is never collected');
      ok('…and the vendored port messages still reach the vendored handler (chained, not replaced)', vendoredGotIt === true,
         'pending ' + JSON.stringify(proc._pendingStretchParameters));
    }
    ok('…and none at ×1.0012 (the DOOMSDAY → GIANA rate) or ×0.95', held1.gaps === 0 && held2.gaps === 0, held1.gaps + '/' + held2.gaps);
  }

  console.log('\n── the static worklet module: identity and the held path ─────');
  /* assets/deckwave-stretch.module.js is a CHECKED-IN concatenation of the
     vendored processor and the wrapper — the no-blob path every platform
     can load. Falsifier: any byte differing (mod line endings) from
     vendor + '\n' + wrapper means the module drifted from its sources and
     the page is running code the repo does not show. Regenerating is
     concatenation, not a build step. */
  {
    const lf = t => t.replace(/\r\n/g, '\n');
    const vend = lf(fs.readFileSync('vendor/soundtouch-processor.js', 'utf8'));
    const wrap = lf(fs.readFileSync('assets/deckwave-stretch.js', 'utf8'));
    const mod = lf(fs.readFileSync('assets/deckwave-stretch.module.js', 'utf8'));
    ok('the static module is byte-identical to vendor + wrapper (mod line endings)',
       mod === vend + '\n' + wrap,
       'lengths ' + mod.length + ' vs ' + (vend.length + 1 + wrap.length) + ' — regenerate: cat vendor/soundtouch-processor.js <newline> assets/deckwave-stretch.js > assets/deckwave-stretch.module.js');
  }
  /* kill() drops the context and boot() runs again on the next play — with
     the module accepted this time, the held worklet must be chosen and the
     play line must say so. */
  Player.kill(); AC.moduleOk = true; pending.clear(); started.length = 0;
  const setH = [mk('h1', 240), mk('h2', 240)];
  const ph2 = Player.play(setH, 0); await tick(); await settle('h1'); const ph2r = await ph2; await tick(); await settle('h2'); await tick();
  ok('with the module accepted, boot() chooses the held worklet', Player.worklet.held === true && Player.worklet.name === 'deckwave-stretch' && Player.worklet.why === 'static module',
     JSON.stringify(Player.worklet));
  ok('…and the play line says `held worklet`', /held worklet$/.test(ph2r), JSON.stringify(ph2r));
  /* NAMED, not merely present. `D.A.st && true` was the whole assertion until
     2026-09-01 and it is true of any node at all. */
  ok('…and the decks are built on it — the node carries the HELD processor name',
     !!D.A.st && D.A.st._processorName === 'deckwave-stretch',
     'deck worklet name ' + JSON.stringify(D.A.st && D.A.st._processorName) + ' while boot() reports ' + JSON.stringify(Player.worklet.name));
  /* the session tally: gaps accumulate across handovers and survive them */
  D.A.st.port.onmessage({ data: { type: 'metrics', gaps: 2, underrunCount: 2 } });
  ok('state.gapsTotal counts the live deck', Player.state.gapsTotal === 2, JSON.stringify(Player.state.gapsTotal));
  D.handover(1);
  ok('…and keeps a handed-over deck\'s gaps in the total', Player.state.gapsTotal === 2, 'total ' + Player.state.gapsTotal + ' after handover');
  Player.stop();
  ok('…and stop() folds the live decks in rather than losing them', Player.state.gapsTotal === 2, 'total ' + Player.state.gapsTotal + ' after stop');
  AC.moduleOk = false;

  console.log('\n── the handover timer against a suspended audio clock ──────');
  /* pause() suspends the context: currentTime FREEZES, setTimeout does
     not. Review 2026-09-01 H1 (ledger 123): the timer fired mid-pause and
     the deck state walked ahead of the audio — ledger 33's class from a new
     mechanism. Falsifier: idx advances while the audio clock has not
     reached the exit; or nothing is re-armed and no handover ever comes. */
  /* a set of its own: the shared one has been reordered in place by the
     earlier sections (the in-place order contract), so its [1] is not t2 */
  const setP = [mk('p1', 240), mk('p2', 240), mk('p3', 240), mk('p4', 240)];
  now = 100; longTimers.clear(); pending.clear();
  const pH1 = Player.play(setP, 0); await tick(); await settle('p1'); await pH1; await tick();
  await settle('p2'); await tick();
  ok('chain() armed exactly one long timer for the handover', longTimers.size === 1 && D.B && D.B.track.meta.name === 'p2',
     'timers ' + longTimers.size + ' B ' + (D.B && D.B.track.meta.name));
  const exitAt = D.B.src._started.at;
  const handedDeck = D.A;                          /* the deck that will hand over; released later, when its source ends */
  D.ctx.state = 'suspended';                       /* pause(): the audio clock stops at 100 */
  fireLong();                                      /* …the wall clock reaches the timer anyway */
  ok('a timer that fires while the audio clock is short of the exit does NOT hand over',
     D.idx === 0 && D.A && D.A.track.meta.name === 'p1',
     'idx ' + D.idx + ' A ' + (D.A && D.A.track.meta.name) + ' — the state ran ahead of the audio');
  ok('…and re-arms itself against the audio clock', longTimers.size === 1,
     'timers ' + longTimers.size + ' — nothing would hand over after resume');
  D.ctx.state = 'running'; now = exitAt + 0.2;     /* resume; the audio reaches the exit */
  fireLong(); await tick(); await settle('p3'); await tick();
  ok('once the audio clock has passed the exit the handover happens and the next deck is chained',
     D.idx === 1 && D.A && D.A.track.meta.name === 'p2' && D.B && D.B.track.meta.name === 'p3',
     'idx ' + D.idx + ' A ' + (D.A && D.A.track.meta.name) + ' B ' + (D.B && D.B.track.meta.name));

  console.log('\n── a handed-over deck is released when its source ends ────');
  /* Review 2026-09-01 H2 (ledger 124): measured live, five handovers took
     the renderer from 691 MB to 1,956 MB and the JS heap kept ~87 MB per
     handover after two forced GCs. Nothing ever disconnected a deck, and
     the worklet's port handler closed over it. Falsifier: after the old
     source's `ended`, its nodes are still connected, the port handler still
     holds the deck, or the worklet was never told to let go. */
  const oldDeck = handedDeck;
  ok('the handed-over deck is not released BEFORE its source ends (the fade is still playing)',
     !oldDeck.released && !oldDeck.g._disconnected, 'released early — the outgoing fade would be cut');
  oldDeck.src.onended();
  ok('…and IS released when the source ends: every node disconnected, port handler dropped, worklet told to let go',
     oldDeck.released === true && [oldDeck.src, oldDeck.st, oldDeck.lo, oldDeck.mid, oldDeck.hi, oldDeck.g].every(n => n._disconnected)
     && oldDeck.st.port.onmessage === null && oldDeck.st.port.posted.some(m => m && m.type === 'release'),
     'released ' + oldDeck.released + ' disconnected ' + [oldDeck.src, oldDeck.st, oldDeck.lo, oldDeck.mid, oldDeck.hi, oldDeck.g].map(n => !!n._disconnected).join(',')
     + ' handler ' + (oldDeck.st.port.onmessage === null) + ' posted ' + JSON.stringify(oldDeck.st.port.posted));
  ok('…while the live decks are untouched', !D.A.released && !D.A.g._disconnected && !D.B.released && !D.B.g._disconnected, 'a live deck was released');
  oldDeck.src.onended();
  ok('a second `ended` is a no-op', oldDeck.released === true && oldDeck.st.port.posted.filter(m => m && m.type === 'release').length === 1, 'release posted twice');
  Player.stop();

  console.log('\n── who built this deck: the origin fact (ledger 82) ─────────');
  /* Four surfaces printed "first deck, nothing to match" from
     `idx === 0 && rate === 1`. That guess is true of the first deck and FALSE
     of every other deck play() builds — a jump to row 7 runs at rate 1 for
     exactly the same reason (there is nothing to match) and printed `+0.00%`
     / `×1.000`, the tightest beatmatch on screen against a match that never
     happened. The repair is an ENGINE FACT, stamped by makeDeck: 'play' for a
     deck play() started, 'chain' for one chain() mixed in. `matched` is the
     question the surfaces actually have: is this deck beatmatched against
     anything? Falsifier for each check below: the fact disagreeing with which
     function built the deck, or a jumped-to deck reporting itself matched. */
  const mkB = (name, dur, bpm) => ({ name, bpm, camelot: '8A', dur, beats: grid(dur * 2) });
  const setO = [mk('o1', 240), mkB('o2', 240, 124), mk('o3', 240), mk('o4', 240)];
  /* fresh context with the static module refused, so boot() falls back to the
     plain processor — the other branch of the name check below */
  Player.kill(); AC.moduleOk = false;
  now = 500; longTimers.clear(); pending.clear(); started.length = 0;
  const pO = Player.play(setO, 0); await tick(); await settle('o1'); await pO; await tick();
  ok('the first deck of a set is stamped origin `play`, matched false',
     D.A.origin === 'play' && Player.deck.origin === 'play' && Player.deck.matched === false,
     'origin ' + JSON.stringify(D.A.origin) + ' matched ' + Player.deck.matched);
  /* the plain-worklet half of the name check above — same fake, other branch */
  ok('…and its worklet node carries the PLAIN processor name while the module is refused — the deck is built on the worklet boot() chose, both branches now seen',
     D.A.st._processorName === 'soundtouch-processor' && Player.worklet.held === false &&
     D.A.st._processorName === Player.worklet.name,
     'name ' + JSON.stringify(D.A.st._processorName) + ' held ' + Player.worklet.held + ' chose ' + JSON.stringify(Player.worklet.name));
  await settle('o2'); await tick();
  ok('a chained deck is stamped origin `chain`, matched true — it IS being beatmatched',
     D.B.origin === 'chain' && Player.nextDeck.origin === 'chain' && Player.nextDeck.matched === true,
     'origin ' + JSON.stringify(D.B.origin) + ' matched ' + Player.nextDeck.matched);
  const exitO = D.B.src._started.at;
  now = exitO + 0.2; fireLong(); await tick(); await settle('o3'); await tick();
  ok('after a handover the live deck reports `chain` and prevDeck carries the OUTGOING deck\'s origin',
     Player.deck.origin === 'chain' && Player.deck.matched === true &&
     Player.prevDeck && Player.prevDeck.origin === 'play' && Player.prevDeck.matched === false,
     'deck ' + JSON.stringify(Player.deck.origin) + ' prev ' + JSON.stringify(Player.prevDeck && Player.prevDeck.origin) +
     ' — the transition monitor draws the outgoing side from prevDeck, so without this the FIRST fade of every set printed ×1.000 against the first deck');
  /* the rolling target after that chain: 120 + (124 − 120) × 0.35 = 121.4 */
  ok('state carries the UNROUNDED rolling target beside the rounded one',
     typeof Player.state.tempoExact === 'number' &&
     Player.state.tempoExact !== Player.state.tempo &&
     Player.state.tempo === Math.round(Player.state.tempoExact),
     'tempo ' + Player.state.tempo + ' tempoExact ' + Player.state.tempoExact +
     ' — DWNAV.commit re-plans every _stretch from this number, and re-planning from the rounded one put the printed plan up to 0.4% away from what the deck would do');
  /* THE CASE THE OLD PREDICATE COULD NOT SEE: jump straight to row 2. idx is
     2, rate is 1, and nothing is being matched. */
  const setJ = [mk('j1', 240), mk('j2', 240), mk('j3', 240), mk('j4', 240)];
  longTimers.clear(); pending.clear();
  const pJ = Player.play(setJ, 2); await tick(); await settle('j3'); await pJ; await tick();
  ok('a JUMPED-TO deck is origin `play` and matched false, though idx is 2 and rate is 1',
     Player.state.idx === 2 && Player.deck.rate === 1 &&
     Player.deck.origin === 'play' && Player.deck.matched === false,
     'idx ' + Player.state.idx + ' rate ' + Player.deck.rate + ' origin ' + JSON.stringify(Player.deck.origin) +
     ' — `idx === 0 && rate === 1` reads this deck as beatmatched and prints +0.00% against it');
  Player.stop();

  console.log('\n── a late re-chain cannot put the exit in the past ──────────');
  /* chain() plans from the START of the playing track, so it assumes it is
     called near the start. setPhrase() breaks that: it cancels and re-chains
     whenever the switch is flipped, and past (length − xfade) the planned
     exit is BEHIND the playhead. Web Audio clamps every schedule to now, but
     `nd.startedAt = out` is not clamped — so the incoming deck's own clock
     was wrong by the overshoot for the rest of the track, and `elapsed`, the
     progress bar and every downbeat computed from it were out by that much.
     Falsifier: A.outAt or the incoming deck's start behind `now`. */
  const setL = [mk('L1', 240), mk('L2', 240), mk('L3', 240)];
  now = 2000; longTimers.clear(); pending.clear();
  const pL = Player.play(setL, 0); await tick(); await settle('L1'); await pL; await tick();
  await settle('L2'); await tick();
  const plannedOut = D.A.outAt, startedL = D.A.startedAt;
  ok('the ordinary plan puts the exit near the end of the track, minutes ahead',
     plannedOut > now && plannedOut - startedL > 200, 'exit at ' + (plannedOut - startedL) + 's into the track');
  now = plannedOut + 8;                            /* eight seconds past it */
  const pP = Player.setPhrase(true); await tick(); await settle('L2'); await pP; await tick();
  ok('a re-chain after the planned exit has passed moves the exit forward, never behind the playhead',
     D.A.outAt >= now, 'outAt ' + D.A.outAt + ' with the clock at ' + now + ' — the fade was scheduled in the past');
  ok('…and the incoming deck\'s startedAt is a moment it can actually start at',
     D.B && D.B.startedAt >= now && D.B.startedAt === D.B.src._started.at,
     'startedAt ' + (D.B && D.B.startedAt) + ' vs now ' + now +
     ' — src.start() clamps and startedAt does not, so the deck\'s clock is wrong by the overshoot for the whole track');
  ok('…and it lands on a DOWNBEAT of the playing grid, not on the bare clock',
     +((D.A.outAt - startedL) % 2).toFixed(6) === 0,
     'exit ' + (D.A.outAt - startedL) + 's into a grid whose downbeats are every 2s');
  Player.stop();

  /* review 2026-09-01 M6: analyse() runs under no harness (Essentia/WASM),
     so this is a TEXT pin on ordering — the re-throw must come before the
     cache write. Weak, and labelled so. */
  ok('[text] a rhythm-extractor throw is re-thrown BEFORE the record is cached',
     src.indexOf('if (rhythmErr) throw') > 0 && src.indexOf('if (rhythmErr) throw') < src.indexOf('await DB.put(rec)'),
     'a track whose rhythm extraction threw would be cached forever as bpm 0 and vanish from every set');

  console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') + ' of ' + checks + ' checks');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FATAL: ' + (e.stack || e)); process.exit(1); });
