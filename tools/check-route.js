/* Offline harness. Falsifiers are stated with each check; a check that cannot
   fail for the reason it claims to test is not run. */
const fs = require('fs');
let fails = 0, checks = 0;
const ok = (name, cond, falsifier) => {
  checks++;
  if (!cond) { fails++; console.log('  FAIL  ' + name + '\n        falsifier hit: ' + falsifier); }
  else console.log('  pass  ' + name);
};

/* ── 1. the deck rate map, taken from the real source ─────────────────── */
/* CRLF-proof. core.autocrlf=true checks the source out with CRLF on
   Windows, and every regex below is written against LF; on a fresh clone
   all three harnesses died with FATAL before testing anything. */
const src = fs.readFileSync('assets/deckwave.js', 'utf8').replace(/\r\n/g, '\n');
const mk = src.match(/  function makeDeck\(track, rate\) \{[\s\S]*?\n  \}\n/);
if (!mk) { console.log('FATAL: could not extract makeDeck from deckwave.js'); process.exit(1); }

const param = () => ({ value: 0, cancelScheduledValues() {}, setValueAtTime() {},
  linearRampToValueAtTime() {} });
const node = () => ({ playbackRate: param(), type: '', frequency: { value: 0 },
  Q: { value: 0 }, gain: param(), connect() {},
  parameters: { get: () => param() } });
const ctx = { createBufferSource: node, createBiquadFilter: node, createGain: node };
const master = node(), live = { add() {}, delete() {} };
const AudioWorkletNode = function () { return node(); };
const stretch = { name: 'soundtouch-processor', held: false };   /* makeDeck reads the worklet choice */
const makeDeck = eval('(' + mk[0].trim().replace(/^function makeDeck/, 'function') + ')');

console.log('\n── deck rate map ────────────────────────────────────────────');

/* No ramp must be BYTE-FOR-BYTE the old arithmetic. Falsifier: any rate/time
   where pos(t) !== t*rate or when(p) !== p/rate. If this fails, turning
   settle off does not restore the previous behaviour and nothing else here
   matters. */
let flat = true, flatWorst = 0;
for (const rate of [0.92, 1, 1.0, 1.08, 1.19]) {
  const d = makeDeck({ buf: null, meta: {} }, rate);
  for (let t = 0; t <= 400; t += 0.37) {
    if (d.pos(t) !== t * rate) { flat = false; flatWorst = Math.abs(d.pos(t) - t * rate); }
    if (d.when(t) !== t / rate) { flat = false; flatWorst = Math.abs(d.when(t) - t / rate); }
  }
}
ok('ramp === null reduces exactly to *rate and /rate', flat,
   'a mapping differed by ' + flatWorst + ' with no ramp scheduled');

/* when() must invert pos() under a ramp, or every downbeat computed through
   it lands at the wrong wall-clock time. Falsifier: |when(pos(t)) - t| > 1e-9
   for any t, speeding up or slowing down. */
let worst = 0;
for (const [r0, r1] of [[1.14, 1], [0.88, 1], [1, 1.06], [1.19, 1], [1, 1]]) {
  const d = makeDeck({ buf: null, meta: {} }, r0);
  d.ramp = { r0, r1, S: 45 };
  for (let t = 0; t <= 300; t += 0.13) worst = Math.max(worst, Math.abs(d.when(d.pos(t)) - t));
}
ok('when() inverts pos() under a ramp (worst ' + worst.toExponential(2) + 's)', worst < 1e-9,
   'inversion error ' + worst + 's — downbeats would be scheduled off by that much');

/* A settle ramp must consume MORE source per wall-second than the settled
   rate while it is still fast, i.e. pos must be monotonic and above the
   flat-1.0 line for r0>1. Falsifier: pos() not increasing. */
{
  const d = makeDeck({ buf: null, meta: {} }, 1.14);
  d.ramp = { r0: 1.14, r1: 1, S: 45 };
  let mono = true, prev = -1;
  for (let t = 0; t <= 200; t += 0.5) { const p = d.pos(t); if (p <= prev) mono = false; prev = p; }
  ok('pos() is strictly increasing under a ramp', mono, 'pos() went backwards or flat');
  ok('rateAt() ends at the settled rate', Math.abs(d.rateAt(45) - 1) < 1e-12 && Math.abs(d.rateAt(999) - 1) < 1e-12,
     'rateAt after the ramp was ' + d.rateAt(999) + ', not 1');
  ok('rateAt() starts at the stretched rate', Math.abs(d.rateAt(0) - 1.14) < 1e-12,
     'rateAt(0) was ' + d.rateAt(0));
}

/* ── 2. the router, on the real corpus ────────────────────────────────── */
console.log('\n── router, on the real 189-track chiptune corpus ────────────');

const normf = s => s.toLowerCase().replace(/\.(flac|mp3|wav|aiff|m4a|ogg)$/, '').replace(/[^a-z0-9]/g, '');
/* The library path is where it lives today; if it has moved, fall back to the
   whole cache rather than crashing — the point of this file is the router, and
   a wrong corpus would still exercise it. Say which happened. */
const LIB = process.env.DECKWAVE_LIB || 'C:/Claude/Music/LukHash';
/* recursive since 2026-08-21: the library gained clearance subdirectories */
const listAudio = dir => {
  const out = [], stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true }))
      if (e.isDirectory()) stack.push(require('path').join(d, e.name));
      else if (/\.(flac|mp3|wav)$/i.test(e.name)) out.push(e.name);
  }
  return out;
};
let files = null;
try {
  files = new Set(listAudio(LIB).map(normf));
} catch (e) {
  console.log('  NOTE: ' + LIB + ' not readable — using every cached record, ' +
              'not just the chiptune corpus. Set DECKWAVE_LIB to fix.');
}
const corpus = JSON.parse(fs.readFileSync('evidence/deckwave-cache-v1-2026-08-17.json', 'utf8')).data
  .filter(r => !files || files.has(normf(r.name)))
  .map(r => ({ id: r.id, name: r.name, bpm: r.bpm, conf: r.conf, dur: r.dur,
               camelot: r.camelot, energy: r.energy != null ? r.energy : 0.5,
               beats: Array.isArray(r.beats) ? r.beats : [] }));
console.log('  corpus: ' + corpus.length + ' tracks');

global.window = global;
global.DW = {
  corpus,
  state: { idx: 0, of: 0, tempo: 0 },
  camScore: (a, b) => (a === b ? 1 : 0.5)
};
global.console.warn = () => {};
for (const f of ['assets/deckwave-nav.js', 'assets/deckwave-nav-commit.js', 'assets/deckwave-nav-fast.js'])
  eval(fs.readFileSync(f, 'utf8'));
const N = global.DWNAV;

/* Build a set the way the app would: pool -> greedy walk. Reuse the real
   sequencer rather than inventing an order. */
/* sequence() now closes over LOCK and gridError as well, and dedupe() takes an
   opts argument -- so this list has to track the real signatures. A stale
   regex here did not fail loudly, it failed as "cannot read properties of
   null", which is the least informative way for a harness to break.

   arc() is exactly two lines and does not end on a line that is just "};", so
   a lazy match for that terminator runs straight past it and swallows LOCK and
   gridError, which then get declared a second time by their own grab(). Match
   the two lines.

   One eval, not six: `const LOCK` inside its own eval() call is scoped to that
   call and invisible to a function eval'd afterwards. */
const grab = (re, what) => { const m = src.match(re);
  if (!m) { console.log('FATAL: could not extract ' + what + ' -- signature changed?');
            process.exit(1); }
  return m[0]; };
eval([
  grab(/const arc = \(i, n\) =>[^\n]*\n[^\n]*\n/, 'arc'),
  grab(/const LOCK = \{[^}]*\};\n/, 'LOCK'),
  grab(/function dedupe\(corpus, opts\) \{[\s\S]*?\n\}\n/, 'dedupe'),
  grab(/function gridError\(t\) \{[\s\S]*?\n\}\n/, 'gridError'),
  grab(/function camScore\([\s\S]*?\n\}\n/, 'camScore'),
  grab(/function sequence\(corpus, opts\) \{[\s\S]*?\n\}\n/, 'sequence')
].join('\n'));
/* maxGridErr huge and minConf at the old 0.8 on purpose: this file tests the
   ROUTER, so it wants a set where every track is beat-locked and the stretch
   gate is the only thing in the way. Pool classification is check-pool.js. */
const set = sequence(corpus, { length: 200, minConf: 0.8, maxGridErr: 1e9 });
console.log('  set: ' + set.length + ' tracks, ' + Math.round(set[0].bpm) + ' bpm start');

global.DW.state = { idx: 3, of: set.length, tempo: Math.round(set[3].bpm) };
const T = global.DW.state.tempo;

/* Find a destination that is NOT directly reachable, so the fast option is
   the one offered — otherwise this test would pass without exercising it. */
let destIdx = -1, opts = null, bestHops = 0;
for (let i = 0; i < set.length; i++) {
  if (i === 3) continue;
  const o = N.optionsFull(T, set[i], corpus);
  const f = o.find(x => x.kind === 'fast');
  if (f && f.hops.length > bestHops) { bestHops = f.hops.length; destIdx = i; opts = o; }
}
ok('a destination exists that needs a route', destIdx > -1,
   'every track was directly reachable at ' + T + ' bpm; the fast path was never entered');
if (destIdx < 0) { console.log('\n' + fails + ' failed of ' + checks); process.exit(1); }

const fast = opts.find(o => o.kind === 'fast');
console.log('  dest #' + destIdx + ' ' + Math.round(set[destIdx].bpm) + ' bpm · ' +
            fast.hops.length + ' hops · dwell ' + fast.dwellSec + 's');

const before = set.slice();
const r = N.commitAndRepair.call(N, (N.setQueue({ idx: destIdx, mode: 'route', hops: fast.hops, dwellSec: fast.dwellSec }), set));

ok('commitAndRepair succeeded', r.ok, r.why);

/* THE BUG. commitAndRepair returns a new array; the old dashboard assigned it
   to itself only, and Player.order still pointed at the array captured at
   play(). Falsifier: if r.set were the same object, the route would have
   reached the player without help and the reported symptom is something
   else entirely. */
ok('commitAndRepair returns a DIFFERENT array from the one passed in', r.set !== set,
   'r.set === set, so the old code would already have worked and the diagnosis is wrong');

/* The playing track must not move, or state.idx and the deck stop naming the
   same track — DW.reorder refuses that case. */
ok('the playing track is still at idx', r.set[3] === before[3],
   'index 3 now holds ' + (r.set[3] && r.set[3].name) + ' instead of ' + before[3].name);

const stones = N.active.stones;
ok('every stepping stone carries a dwell', stones.length > 0 && stones.every(t => t._dwell === fast.dwellSec),
   'a stone had _dwell = ' + stones.map(t => t._dwell).join(','));
ok('the destination does NOT carry a dwell', !N.active.dest._dwell,
   'the destination would be cut short to ' + N.active.dest._dwell + 's');
ok('the stones sit immediately after the playing track', r.set.slice(4, 4 + stones.length).every((t, i) => t === stones[i]),
   'the spliced block is not where commit() said it was');
ok('DWNAV.active survives clearQueue()', !!N.active && N.queue === null,
   'active=' + !!N.active + ' queue=' + JSON.stringify(N.queue));

const v = N.verify(r.set, 3, T);
ok('every BEATMATCHED transition after the splice clears the gate', v.clean,
   v.overGate + ' transitions over the ' + (N.GATE * 100) + '% gate, max ' + v.maxStretch + '%');

/* The no-discard promise has to hold for REPAIRING a set as well as building
   one. It did not: resequenceTail dropped 35 tracks after a route while
   sequence() was placing all 171. Falsifier: any track lost to the repair. */
ok('resequencing the tail after a route discards nothing', r.tailDropped === 0,
   r.tailDropped + ' tracks thrown away by the repair');
console.log('  tail: ' + r.tailKept + ' kept, ' + r.tailDropped + ' dropped, ' +
            v.straight + ' played straight, max stretch ' + v.maxStretch + '%');

/* Nothing plays twice. commit() pulled the DESTINATION from the tail so it
   would not, and left every stepping stone where it was as well as splicing
   it in — so a 15-hop route put 15 tracks in the set twice (measured before
   the fix: 174 rows from 159 tracks). Falsifier: any id that appears more
   than once after the commit, counting only positions the playing track has
   not passed. The stones are copies (planFast), so identity is the wrong
   test; id is the one that catches both the copy and the original. */
{
  const seen = new Map();
  r.set.slice(3).forEach(t => seen.set(t.id, (seen.get(t.id) || 0) + 1));
  const twice = [...seen].filter(([, n]) => n > 1);
  ok('no track appears twice in the set after a route is committed', twice.length === 0,
     twice.length + ' ids duplicated, e.g. ' + twice.slice(0, 3).map(([id]) => id.split('|')[0].slice(-40)).join(' · '));
  /* A stone already in the set moves; one the router found outside the set
     (the corpus is wider than the set — dedupe losers, mostly) is a genuine
     addition. So the count grows by exactly the number of outside stones. */
  const ids = new Set(before.map(t => t.id));
  const outside = stones.filter(s => !ids.has(s.id)).length;
  ok('the set grew by exactly the stones that came from outside it', r.set.length === before.length + outside,
     'before ' + before.length + ' + ' + outside + ' outside stones, after ' + r.set.length +
     ' — a track went missing or a copy survived');
}

/* The dwell the ENGINE honours, not the one the router asked for. */
const MIN_PLAY = +src.match(/const MIN_PLAY = (\d+);/)[1];
ok('the engine floor is above the router dwell (the 45/40 clash is real)', MIN_PLAY > fast.dwellSec,
   'MIN_PLAY=' + MIN_PLAY + ' dwell=' + fast.dwellSec + ' — no clamp, so the label was never wrong');
console.log('  router asks ' + fast.dwellSec + 's; chain() clamps to ' + MIN_PLAY + 's · ' +
            'route wall-clock ' + Math.round(stones.length * MIN_PLAY / 60 * 10) / 10 + ' min, not ' + fast.minutes);

console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') + ' of ' + checks + ' checks');
process.exit(fails ? 1 : 0);
