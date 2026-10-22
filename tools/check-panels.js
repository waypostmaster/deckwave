/* Every registered panel, drawn against the bundle states that have broken
   panels before: no set, a set with nothing playing, a straight (unlocked)
   track on the deck, a crossfade in progress, a loaded set where the list
   and the deck disagree, and the listen-mode bundle with no set at all.

   Two kinds of check, each stating its falsifier:
     · it must not THROW. The loop stashes a panel's error, so a throw is
       one dead tile — but the fixed strips had no stash at all until
       2026-08-19, and a throw there took every panel with it.
     · it must not PRINT A STRETCH FIGURE against a track played straight.
       The text a panel writes is captured from fillText/strokeText and
       searched for the patterns CLAUDE.md forbids: ×1.000, +0.0%, 0.0%.
       Falsifier: any such string while the deck's track is _unlocked.

   Pixel counting is not a check and none is done here.

       node tools/check-panels.js
*/
const fs = require('fs');
let fails = 0, checks = 0;
const ok = (name, cond, falsifier) => {
  checks++;
  if (!cond) { fails++; console.log('  FAIL  ' + name + '\n        falsifier hit: ' + falsifier); }
  else console.log('  pass  ' + name);
};

/* ── a browser-shaped global, just enough to load the panel files ─────── */
const store = {};
global.window = global;
global.localStorage = { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } };
global.performance = { now: () => Date.now() };
global.document = { createElement: () => ({ style: {}, getContext: () => ctx(), appendChild() {}, classList: { add() {}, remove() {}, contains: () => false } }),
                    getElementById: () => null, addEventListener() {} };
global.requestAnimationFrame = () => 0; global.cancelAnimationFrame = () => {};
global.console.warn = () => {};

/* a 2D context that records text and never throws */
const texts = [];
const gradient = () => ({ addColorStop() {} });
function ctx() {
  const c = { canvas: { width: 320, height: 200 }, fillStyle: '', strokeStyle: '', lineWidth: 1, font: '',
    textAlign: '', textBaseline: '', globalAlpha: 1, shadowBlur: 0, shadowColor: '', lineCap: '', lineJoin: '',
    fillRect() {}, strokeRect() {}, clearRect() {}, beginPath() {}, closePath() {}, moveTo() {}, lineTo() {},
    arc() {}, arcTo() {}, ellipse() {}, rect() {}, fill() {}, stroke() {}, save() {}, restore() {},
    translate() {}, rotate() {}, scale() {}, setTransform() {}, resetTransform() {}, clip() {},
    setLineDash() {}, getLineDash: () => [], quadraticCurveTo() {}, bezierCurveTo() {},
    createLinearGradient: gradient, createRadialGradient: gradient,
    measureText: s => ({ width: String(s).length * 4.6 }),
    fillText(s) { texts.push(String(s)); }, strokeText(s) { texts.push(String(s)); },
    drawImage() {}, getImageData: (x, y, w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData() {}, createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }) };
  return c;
}

/* engine surface the panels read */
const mkTrack = (name, bpm, o) => Object.assign({ name, bpm, camelot: '8A', key: 'A', scale: 'minor', energy: .5,
  dur: 240, conf: 1.2, beats: Array.from({ length: 480 }, (_, i) => +(i * 60 / bpm).toFixed(3)) }, o || {});
const T0 = mkTrack('LukHash - A - 01 one', 120, { _stretch: 1 });
const T1 = mkTrack('LukHash - A - 02 two', 124, { _stretch: 0.968 });
const TS = mkTrack('LukHash - A - 03 straight', 151, { _stretch: 1, _unlocked: true, _unlockReason: 'grid', _gridErr: 28.3 });
const TR = mkTrack('LukHash - A - 04 reach', 100, { _stretch: 1, _unlocked: true, _unlockReason: 'reach' });
const T2 = mkTrack('LukHash - A - 05 five', 102, { _stretch: 0.98 });
const SET = [T0, T1, TS, TR, T2];

let DWstate = { idx: 0, of: 0, tempo: 0, now: null, next: null, live: 0, ctx: 'none' };
let deck = null, nextDeck = null, nowMeta = null, nextMeta = null, blend = null, elapsed = 0;
/* THE HANDED-OVER DECK, which the transition monitor reads directly off the
   engine (not off the bundle) to know whether the OUTGOING side of a running
   fade was mixed into or merely started. Absent from this harness until
   2026-09-01, which is why the second half of ledger 82 — the first deck of
   a set, still audible while `idx` has already moved to 1 — could not be
   posed as a case at all. */
let prevDeck = null;
global.DW = {
  get state() { return DWstate; }, get deck() { return deck; }, get nextDeck() { return nextDeck; },
  get prevDeck() { return prevDeck; },
  get nowMeta() { return nowMeta; }, get nextMeta() { return nextMeta; }, get blend() { return blend; },
  get elapsed() { return elapsed; }, get dwellFloor() { return 45; },
  camScore: (a, b) => (a === b ? 1 : .5), corpus: SET, lock: { maxGridErrPct: 9 },
  Player: { analyser: null }, log: []
};
global.DWNAV = { queue: null, active: null, GATE: .08, DRIFT: .35, reachable: (T, t) => Math.abs(T / t.bpm - 1) <= .08,
  history: [], stretchFor: (T, b) => Math.abs(T / b - 1) };
global.DWREGISTER = { col: () => null, mode: { on: false }, update: () => ({ centroidHz: 0, band: '', hue: 0 }), tau: .985 };
global.DWVU = { state: { L: .3, R: .3, pkL: .4, pkR: .4 }, feed() {} };
global.DWSTEREO = () => ({ rmsL: .3, rmsR: .3, width: .5, corr: .9 });
global.DWLISTEN = { active: false, analyser: null, L: null, R: null };
global.DWMSG = { term: () => null };

/* DECKWAVE_PANELS_SRC: load another copy of the panels file (git show
   <rev>:assets/deckwave-panels.js > file) so a drawn check can be SHOWN
   failing on the old source first — the seam the text checks below already
   have for the dashboard and the card. */
for (const f of [process.env.DECKWAVE_PANELS_SRC || 'assets/deckwave-panels.js', 'assets/deckwave-sprites.js', 'assets/patch-01-spectrogram.js',
                 'assets/panel-wayposts.js', 'assets/panel-centre.js', process.env.DECKWAVE_ROUTE_SRC || 'assets/panel-route.js']) {
  try { eval(fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n')); }
  catch (e) { console.log('FATAL loading ' + f + ': ' + (e.stack || e)); process.exit(1); }
}
const P = global.DWPANELS;
/* list() returns {k, n, hint}. The first version of this file mapped `x.id`,
   got 19 undefineds, P.get() returned nothing for each, and every "no panel
   throws" check passed without drawing a single panel — the exact vacuous
   pass this project keeps a table about. Resolve every id to a draw function
   up front and refuse to run if any does not. */
/* all(), not list(): since decision 8 list() folds a FAMILY to one entry,
   and drawing only the menu entries would skip four energy windows */
const ids = P.all ? P.all() : P.list().map(x => x.k);
const unresolved = ids.filter(id => !P.get(id) || typeof P.get(id).draw !== 'function');
if (!ids.length || unresolved.length) {
  console.log('FATAL: panel ids did not resolve to draw functions: ' + JSON.stringify(unresolved));
  process.exit(1);
}

const wave = new Uint8Array(2048).fill(128), freq = new Uint8Array(1024).map((_, i) => Math.max(0, 200 - i));
const Tk = { bg: '#000', line: '#111', dim: '#777', ac: '#0ff', ac2: '#f0f', bad: '#f55', fn: 'monospace', g() {} };
const bundle = o => Object.assign({ wave, freq, set: SET, state: DWstate, L: wave, R: wave,
  stereo: { rmsL: .3, rmsR: .3, width: .5, corr: .9, L: wave, R: wave }, vu: global.DWVU.state,
  hits: [], flux: .01, hit: false, transLeft: null, blend, elapsed,
  now: nowMeta, next: nextMeta, prev: null, prevRate: 1, deck, nextDeck }, o || {});

let drawn = 0;
function drawAll(label, D, assertNoStretchText) {
  let threw = [];
  for (const id of ids) {
    const p = P.get(id);
    texts.length = 0; drawn++;
    /* draw three times — history buffers and per-panel state need a second
       and third frame to reach the branches that read them */
    for (let k = 0; k < 3; k++) {
      try { p.draw(ctx(), 320, 200, Tk, D); }
      catch (e) { threw.push(id + ': ' + e.message); break; }
    }
    if (assertNoStretchText) {
      const bad = texts.filter(s => /×1\.000|(^|[^0-9.])[+\-]?0\.0%/.test(s));
      ok(label + ' · ' + id + ' prints no stretch figure against the straight deck', bad.length === 0,
         JSON.stringify(bad.slice(0, 3)));
    }
  }
  ok(label + ' · no panel throws', threw.length === 0, threw.join(' | '));
}

console.log('\n── panels: ' + ids.length + ' registered ──────────────────────────────────');

/* 1. nothing loaded at all */
DWstate = { idx: 0, of: 0, tempo: 0, now: null, next: null, live: 0, ctx: 'none' };
drawAll('no set', bundle({ set: [], wave: null, freq: null, L: null, R: null, stereo: null }));

/* 2. a set built, nothing playing (idx survives stop) */
DWstate = { idx: 4, of: 5, tempo: 0, now: null, next: null, live: 0, ctx: 'none' };
drawAll('set built, stopped, idx at the end', bundle({}));

/* 2b. THE SAME STOPPED STATE, read closely. Two panels used to render it as
   if a set were on the air (keeper's calls, 2026-08-31):
     · the transition monitor drew labelled rows AND the verdict
       `◉ PHASE LOCKED · periods match` about a transition no deck was making,
       because `nowM` falls back to S[st.idx], which survives stop() — ledger
       87's shape, a non-empty fallback making the honest path unreachable.
     · the wayposts panel fell back to `st.tempo || 120` and printed `120 bpm`
       plus a reachability COUNT derived from that invented number.
   Falsifier for each is the drawn string itself, not an element's existence. */
const draw1 = (id, D) => { texts.length = 0; const p = P.get(id);
  for (let k = 0; k < 3; k++) p.draw(ctx(), 320, 200, Tk, D); return texts.slice(); };
{
  /* idx 1, NOT the last track: with `nxt` undefined the verdict block never
     runs at all, so asserting its absence at the end of a set would pass
     against the broken code too — a check whose pass condition does not
     exclude the failure mode. This is the state that actually exercises it. */
  /* idx 0 specifically: T0 -> T1 are both LOCKED, so the old code reached
     the DRIFT/LOCKED branch. At idx 1 the next track is the straight one
     and it printed `STRAIGHT - no beat alignment claimed` instead, which
     this check would have passed against the broken source. Two fixtures
     deep before it discriminated. */
  const wasIdx = DWstate.idx; DWstate.idx = 0;
  const tt = draw1('transition', bundle({}));
  ok('stopped WITH a next track: the transition monitor claims no lock verdict',
     !tt.some(s => /PHASE LOCKED|DRIFT \d/.test(s)),
     'a lock verdict about a transition no deck is making: ' + JSON.stringify(tt.filter(s => /PHASE LOCKED|DRIFT/.test(s))));
  ok('stopped: the transition monitor says it is cued, not playing',
     tt.some(s => /cued/.test(s) && /not playing/.test(s)),
     'no not-playing marker; texts ' + JSON.stringify(tt.slice(0, 6)));
  DWstate.idx = wasIdx;
  const wp = draw1('wayposts', bundle({}));
  ok('stopped: the wayposts panel invents no tempo',
     !wp.some(s => /^\s*120 bpm/.test(s)) && wp.some(s => /- bpm/.test(s)),
     'a fabricated tempo or a count derived from one: ' + JSON.stringify(wp.filter(s => /bpm/.test(s))));
}

/* 3. idx beyond the end of a SHORTER set loaded while stopped — the P.arc case */
DWstate = { idx: 7, of: 5, tempo: 120, now: null, next: null, live: 0, ctx: 'none' };
drawAll('idx past the end of the list', bundle({ set: SET.slice(0, 3) }));

/* 4. a locked track playing normally, next scheduled */
nowMeta = T0; nextMeta = T1; elapsed = 60;
/* `origin` is the ENGINE's fact about who built this deck — 'play' (the
   first ▶, a jumped-to row, back()) or 'chain' (the only path that
   beatmatches). Added to these fixtures 2026-09-01 when the surfaces stopped
   guessing "first deck" from `idx === 0 && rate === 1`, which is also true of
   a jumped-to deck at row 7. */
deck = { meta: T0, name: T0.name, bpm: 120, camelot: '8A', rate: 1, startRate: 1, playedBpm: 120, stretchPct: 0,
         origin: 'play', matched: false,
         settling: false, settleLeft: 0, dwell: null, stepping: false, elapsed };
nextDeck = { meta: T1, name: T1.name, bpm: 124, camelot: '8A', rate: 120 / 124, straight: false, reason: null, startsAt: 300, entry: 0 };
blend = { in: 164, at: 224, dur: 240, xfade: 16, frac: 224 / 240, fadeFrac: 16 / 240 };
DWstate = { idx: 0, of: 5, tempo: 120, now: T0.name, next: T1.name, live: 2, ctx: 'running' };
/* …and this IS the first-deck case — idx 0, rate exactly 1 — so it must not
   print a stretch figure either. Nothing precedes step 1, so `+0.0%` here
   reads as the tightest beatmatch on screen: ledger 82, which was fixed in
   RECON and left standing on every base surface. The scenario was already
   in this harness; only the assertion was missing. */
drawAll('locked track playing — FIRST deck, nothing to match', bundle({ transLeft: 164 }), true);

/* 5. a STRAIGHT track on the deck, locked one next: no panel may print a stretch */
nowMeta = TS; nextMeta = TR; elapsed = 30;
deck = { meta: TS, name: TS.name, bpm: 151, camelot: '8A', rate: 1, startRate: 1, playedBpm: 151, stretchPct: 0,
         origin: 'chain', matched: false,
         settling: false, settleLeft: 0, dwell: null, stepping: false, elapsed };
nextDeck = { meta: TR, name: TR.name, bpm: 100, camelot: '8A', rate: 1, straight: true, reason: 'reach', startsAt: 300, entry: 0 };
blend = { in: 194, at: 224, dur: 240, xfade: 16, frac: 224 / 240, fadeFrac: 16 / 240 };
DWstate = { idx: 2, of: 5, tempo: 120, now: TS.name, next: TR.name, live: 2, ctx: 'running' };
drawAll('straight track on the deck', bundle({ transLeft: 194 }), true);

/* 6. a crossfade in progress, 4s after the handover: prev is the outgoing */
nowMeta = T1; nextMeta = TS; elapsed = 4;
deck = { meta: T1, name: T1.name, bpm: 124, camelot: '8A', rate: 120 / 124, startRate: 120 / 124, playedBpm: 120, stretchPct: -3.23,
         origin: 'chain', matched: true,
         settling: false, settleLeft: 0, dwell: null, stepping: false, elapsed };
nextDeck = null; blend = { in: 220, at: 224, dur: 232, xfade: 16, frac: 224 / 232, fadeFrac: 16 / 232 };
DWstate = { idx: 1, of: 5, tempo: 121.4, now: T1.name, next: null, live: 2, ctx: 'running' };
texts.length = 0;
{
  const D = bundle({ transLeft: 220, prev: T0, prevRate: 1 });
  let err = null;
  try { for (let k = 0; k < 2; k++) P.get('transition').draw(ctx(), 320, 200, Tk, D); } catch (e) { err = e.message; }
  ok('transition monitor draws a crossfade in progress', !err, 'threw: ' + err);
  const crossfade = texts.find(s => /crossfade \d+%/.test(s));
  ok('transition monitor shows crossfade PROGRESS, not 0%, four seconds into a 16s fade',
     !!crossfade && !/crossfade 0%/.test(crossfade), 'texts: ' + JSON.stringify(texts.filter(s => /crossfade|blend|OUT|IN/.test(s))));
  ok('OUTGOING is the previous track, INCOMING the deck', texts.includes('OUTGOING') && texts.includes('INCOMING') &&
     texts.some(s => /\bone\b/.test(s)) && texts.some(s => /\btwo\b/.test(s)),
     'texts: ' + JSON.stringify(texts.slice(0, 12)));
}
drawAll('crossfade in progress', bundle({ transLeft: 220, prev: T0, prevRate: 1 }));

/* 6b. THE SAME FADE, and it is the SET'S FIRST ONE — ledger 82's second half.
   The outgoing deck here is track 01, which play() started: nothing preceded
   it, so its rate is 1 by construction. `idx` has already moved to 1, so the
   old `st.idx === 0` predicate cannot see it, and the monitor printed
   `×1.000` against the outgoing row and `◉ PHASE LOCKED` under both — a tick
   and a perfect-match figure for a beatmatch that never happened. The engine
   stamps `origin` on the deck it hands over and the monitor reads
   DW.prevDeck, which is why this case can be posed at all. */
prevDeck = { meta: T0, name: T0.name, bpm: 120, rate: 1, origin: 'play', matched: false };
texts.length = 0;
{
  const D = bundle({ transLeft: 220, prev: T0, prevRate: 1 });
  let err = null;
  try { for (let k = 0; k < 2; k++) P.get('transition').draw(ctx(), 320, 200, Tk, D); } catch (e) { err = e.message; }
  ok('the monitor draws the SET\'S FIRST fade without throwing', !err, 'threw: ' + err);
  ok('…and prints no ratio against the outgoing FIRST deck',
     !texts.some(s => /×1\.000/.test(s)),
     'texts: ' + JSON.stringify(texts.filter(s => /×|first|straight/.test(s))));
  ok('…and claims no lock: NOT MIXED, because one side was started rather than blended into',
     texts.some(s => /NOT MIXED/.test(s)) && !texts.some(s => /PHASE LOCKED|DRIFT/.test(s)),
     'verdict: ' + JSON.stringify(texts.filter(s => /NOT MIXED|PHASE LOCKED|DRIFT|STRAIGHT/.test(s))));
}
drawAll('the set\'s first fade — outgoing deck was started, not mixed into',
        bundle({ transLeft: 220, prev: T0, prevRate: 1 }), true);

/* 6c. THE RUNNING FADE IS NOT THE NEXT ONE (ultracode review 2026-10-22).
   D.blend is the LIVE deck's own exit — the fade it will LEAVE under — while
   the fade in progress is the one the outgoing deck handed over, which the
   engine keeps as DW.prevDeck.xfade/prog and the panel read only for
   `origin`. The two differ as a matter of course since phrase-next (ledger
   150: ▶▶ fades over one phrase, the keeper heard 19 s, and the successor's
   planned exit is the set's 16 s). Scaled to the wrong length, the monitor
   at 17 s of a 19 s fade dropped the OUTGOING row, labelled the incoming
   deck OUTGOING and printed `next blend in` with the old track still
   audible. Posed as the engine poses it: prevDeck says 19 s and 17 s in,
   blend still says 16. The 30 s case with no engine record is the control
   that the fading read still ENDS. */
prevDeck = { meta: T0, name: T0.name, bpm: 120, rate: 1, origin: 'chain', matched: true,
             fadeElapsed: 17, xfade: 19, prog: 17 / 19 };
elapsed = 17;
texts.length = 0;
{
  const D = bundle({ transLeft: 220, prev: T0, prevRate: 1 });
  let err = null;
  try { for (let k = 0; k < 2; k++) P.get('transition').draw(ctx(), 320, 200, Tk, D); } catch (e) { err = e.message; }
  const crossfade = texts.find(s => /crossfade \d+%/.test(s));
  ok('17 s into a 19 s fade whose successor exits over 16 s, the monitor still draws the crossfade',
     !err && !!crossfade && !texts.some(s => /next blend in/.test(s)),
     'the running fade was timed with the NEXT exit\'s length: ' + (err || JSON.stringify(texts.filter(s => /crossfade|blend/.test(s)))));
  ok('…scaled to the ENGINE\'s fade: 89%, not 100% or empty',
     !!crossfade && /crossfade 89%/.test(crossfade), 'got ' + JSON.stringify(crossfade));
  ok('…and OUTGOING is still the handed-over track, not the incoming deck',
     texts.includes('OUTGOING') && texts.some(s => /\bone\b/.test(s)),
     'texts: ' + JSON.stringify(texts.slice(0, 12)));
}
prevDeck = null; elapsed = 30;
texts.length = 0;
{
  const D = bundle({ transLeft: 220, prev: T0, prevRate: 1 });
  try { for (let k = 0; k < 2; k++) P.get('transition').draw(ctx(), 320, 200, Tk, D); } catch (e) {}
  ok('CONTROL: with no engine record and 30 s elapsed the fade is over — no crossfade is drawn',
     !texts.some(s => /crossfade \d+%/.test(s)) && texts.some(s => /next blend in/.test(s)),
     'the fading read never ends: ' + JSON.stringify(texts.filter(s => /crossfade|blend/.test(s))));
}
elapsed = 4;
prevDeck = null;   /* nothing is handing over in the scenarios below */

/* 7. list ≠ deck: the deck plays a track the list no longer holds at idx */
nowMeta = T2; nextMeta = null; elapsed = 10;
deck = { meta: T2, name: T2.name, bpm: 102, camelot: '8A', rate: 1, startRate: 1, playedBpm: 102, stretchPct: 0,
         origin: 'chain', matched: true,
         settling: false, settleLeft: 0, dwell: null, stepping: false, elapsed };
blend = { in: 214, at: 224, dur: 240, xfade: 16, frac: 224 / 240, fadeFrac: 16 / 240 };
DWstate = { idx: 1, of: 5, tempo: 102, now: T2.name, next: null, live: 1, ctx: 'running' };
texts.length = 0;
{
  const D = bundle({ set: [T0, T1, TS], transLeft: 214 });
  let err = null; try { P.get('route').draw(ctx(), 320, 200, Tk, D); } catch (e) { err = e.message; }
  ok('route panel draws with the deck playing a track not in the list', !err, 'threw: ' + err);
  ok('route panel flags LIST ≠ DECK', texts.some(s => /LIST ≠ DECK/.test(s)), 'no red line; texts ' + JSON.stringify(texts.slice(0, 6)));
  texts.length = 0; err = null;
  try { P.get('position').draw(ctx(), 320, 200, Tk, D); } catch (e) { err = e.message; }
  ok('position panel names the DECK\'s track, not the list\'s', !err && texts.some(s => /five/.test(s)) && !texts.some(s => /\btwo\b/.test(s)),
     (err ? 'threw: ' + err : 'texts ' + JSON.stringify(texts)));
}
drawAll('list ≠ deck', bundle({ set: [T0, T1, TS], transLeft: 214 }));

/* 7b. A JUMPED-TO DECK — ledger 82's OTHER open half, and the reason the
   `idx === 0 && rate === 1` guess had to go. `Player.play(seq, from)` builds
   a deck at rate 1 with nothing before it, at whatever row the keeper
   clicked. Row 3 here: idx is 2, so every "is this the first deck" test that
   read the index said NO, and the surfaces printed `×1.000`, `+0.0%` and
   `◉ PHASE LOCKED` — the tightest beatmatch on screen while nothing was
   being matched. `origin: 'play'` is the engine's own fact about who built
   the deck; nothing here infers it.

   BOTH SIDES LOCKED on purpose: an unlocked grid on either deck is the
   stronger claim and the monitor rightly says STRAIGHT for it, which would
   hide the case under test. */
nowMeta = T2; nextMeta = T1; elapsed = 12;
deck = { meta: T2, name: T2.name, bpm: 102, camelot: '8A', rate: 1, startRate: 1, playedBpm: 102, stretchPct: 0,
         origin: 'play', matched: false,
         settling: false, settleLeft: 0, dwell: null, stepping: false, elapsed };
nextDeck = { meta: T1, name: T1.name, bpm: 124, camelot: '8A', rate: 102 / 124, straight: false, reason: null, startsAt: 300, entry: 0 };
blend = { in: 200, at: 224, dur: 240, xfade: 16, frac: 224 / 240, fadeFrac: 16 / 240 };
DWstate = { idx: 2, of: 5, tempo: 102, now: T2.name, next: T1.name, live: 2, ctx: 'running' };
/* the whole-registry sweep, with the forbidden-figure filter armed */
drawAll('a JUMPED-TO deck at row 3 (origin play, rate 1, idx 2)', bundle({ transLeft: 200 }), true);
{
  /* …and the two figures drawAll's filter does not spell: a two-decimal
     zero, and a lock verdict. Collected per panel so a failure names one. */
  const offenders = [];
  for (const id of ids) {
    texts.length = 0;
    try { for (let k = 0; k < 2; k++) P.get(id).draw(ctx(), 320, 200, Tk, bundle({ transLeft: 200 })); } catch (e) {}
    texts.forEach(s => { if (/\+?0\.00%|×1\.000|PHASE LOCKED/.test(String(s))) offenders.push(id + ': ' + s); });
  }
  ok('no panel prints +0.00%, ×1.000 or PHASE LOCKED against a jumped-to deck',
     offenders.length === 0,
     JSON.stringify(offenders.slice(0, 4)));
  texts.length = 0;
  try { P.get('transition').draw(ctx(), 320, 200, Tk, bundle({ transLeft: 200 })); } catch (e) {}
  ok('the transition monitor says NOT MIXED for a deck that was started, not blended into',
     texts.some(s => /NOT MIXED/.test(s)),
     'verdict: ' + JSON.stringify(texts.filter(s => /NOT MIXED|PHASE LOCKED|DRIFT|STRAIGHT/.test(s))));
  texts.length = 0;
  try { P.get('route').draw(ctx(), 320, 200, Tk, bundle({ transLeft: 200 })); } catch (e) {}
  ok('the route panel calls it JUMPED, not FIRST — the set does have a step before this one',
     texts.some(s => /jumped/.test(s)) && !texts.some(s => /∿ first/.test(s)),
     'texts: ' + JSON.stringify(texts.filter(s => /jumped|first|straight|%/.test(s)).slice(0, 6)));
  /* …and the ROW, not only the footer (ultracode review 2026-10-22). The
     check above passed while the bold current row printed the PLAN's
     `(t._stretch - 1) * 100` beside a footer saying ∿ jumped: the row chain
     guarded `_unlocked` and `i === 0` and never read `deck.origin`, and the
     fixture above hides it — S[2] is TS, an unlocked grid, so the row said
     ∿ grid for the stronger reason. Here the list row IS the jumped-to deck
     (T2, locked, plan stretch 0.98): the row must say ∿ jumped and the
     plan's -2.0% must not be drawn anywhere. Read through the loaded module,
     so DECKWAVE_ROUTE_SRC shows this failing on the old file. CONTROL: the
     same rows with the deck CHAINED in print -2.0% — the figure is right
     when the engine is applying it, so the check can tell the two apart. */
  const jumpedRows = { set: [T0, T1, T2, TS, TR], transLeft: 200 };
  texts.length = 0;
  try { P.get('route').draw(ctx(), 320, 200, Tk, bundle(jumpedRows)); } catch (e) {}
  ok('the route panel\'s CURRENT row says ∿ jumped, not the plan\'s stretch, against a jumped-to deck',
     texts.includes('∿ jumped') && !texts.some(s => /-2\.0%/.test(s)) && !texts.some(s => /LIST ≠ DECK/.test(s)),
     'the row prints the plan figure for a deck running at rate 1: ' +
     JSON.stringify(texts.filter(s => /jumped|first|grid|%|LIST/.test(s)).slice(0, 6)));
  deck.origin = 'chain'; deck.matched = true; deck.rate = deck.startRate = 0.98; deck.playedBpm = 100; deck.stretchPct = -2;
  texts.length = 0;
  try { P.get('route').draw(ctx(), 320, 200, Tk, bundle(jumpedRows)); } catch (e) {}
  ok('CONTROL: the same row prints -2.0% once the deck was CHAINED in at that stretch',
     texts.some(s => /-2\.0%/.test(s)) && !texts.includes('∿ jumped'),
     'texts: ' + JSON.stringify(texts.filter(s => /jumped|first|grid|%/.test(s)).slice(0, 6)));
  deck.origin = 'play'; deck.matched = false; deck.rate = deck.startRate = 1; deck.playedBpm = 102; deck.stretchPct = 0;
}
/* the two DOM surfaces the canvas sweep cannot reach: pin that they read the
   engine's fact rather than the list index */
{
  const dsrc = fs.readFileSync('assets/deckwave-dashboard.js', 'utf8').replace(/\r\n/g, '\n');
  const nsrc = fs.readFileSync('assets/deckwave-nowplaying.js', 'utf8').replace(/\r\n/g, '\n');
  ok('the dashboard header keys "nothing to match" on the deck\'s ORIGIN',
     /dk\.origin === 'play'/.test(dsrc),
     'the header still infers it from idx === 0, so a jump to row 7 prints 0.0% — the tightest beatmatch on screen with nothing matched');
  ok('the now-playing card does the same, and distinguishes first from jumped',
     /dk\.origin === 'play'/.test(nsrc) && /∿ jumped/.test(nsrc),
     'the card infers first-deck from the list index, which is false for every jumped-to deck');
}

/* 8. listen mode, no set */
nowMeta = null; nextMeta = null; deck = null; nextDeck = null; blend = null; elapsed = 0;
global.DWLISTEN.active = true;
DWstate = { idx: 0, of: 0, tempo: 0, now: null, next: null, live: 0, ctx: 'none' };
drawAll('listen mode, no set', bundle({ set: [] }));

/* ── ROADMAP D6: every panel has a glossary term, every term exists ──────
   The dashboard's PANEL/HEAD maps are extracted from the source and checked
   against DWMSG and the registry, both directions. Falsifier: a registered
   id with no entry, an entry naming no registered id, or a value that
   DWMSG.term() cannot resolve. */
console.log('\n── glossary ↔ panel registry (ROADMAP D6) ───────────────────');
{
  const dsrc = fs.readFileSync('assets/deckwave-dashboard.js', 'utf8').replace(/\r\n/g, '\n');
  const pm = dsrc.match(/const PANEL = (\{[\s\S]*?\});/), hm = dsrc.match(/const HEAD = (\{[^}]*\});/);
  ok('PANEL and HEAD maps found in the dashboard source', !!(pm && hm), 'regex did not match — map moved?');
  if (pm && hm) {
    delete global.DWMSG;
    eval(fs.readFileSync('assets/deckwave-messages.js', 'utf8').replace(/\r\n/g, '\n'));
    const PANEL = eval('(' + pm[1] + ')'), HEAD = eval('(' + hm[1] + ')');
    const term = k => global.DWMSG.term(k);
    const noTerm = ids.filter(id => !PANEL[id]);
    ok('every registered panel has a glossary entry', noTerm.length === 0, 'missing: ' + noTerm.join(', '));
    const noPanel = Object.keys(PANEL).filter(id => !ids.includes(id));
    ok('every glossary entry names a registered panel', noPanel.length === 0, 'stale: ' + noPanel.join(', '));
    const unresolved = Object.keys(PANEL).filter(id => !term(PANEL[id])).map(id => id + '→' + PANEL[id])
      .concat(Object.keys(HEAD).filter(id => !term(HEAD[id])).map(id => id + '→' + HEAD[id]));
    ok('every mapped term resolves in DWMSG', unresolved.length === 0, 'unresolved: ' + unresolved.join(', '));
    const direct = global.DWMSG.all().filter(t => t.w && !t.verified && !/Special:Search/.test(t.w));
    ok('every unverified Wikipedia link is a search link, as the file header and tooltip promise',
       direct.length === 0, direct.map(t => t.key).join(', '));
  }
}

/* the harness must have actually drawn something, or every pass above is hollow */
ok('panels were actually drawn (' + drawn + ' draws across ' + ids.length + ' panels)', drawn >= ids.length * 7,
   'only ' + drawn + ' draws happened — the loop is not reaching the panels');

console.log('\n── the face, after the 2026-08-29 ultra review ──────────────');
/* Five findings against the dashboard and the now-playing card. Each check
   below failed against the pre-fix source. */
/* DECKWAVE_DASH_SRC: point the source-reading checks below at another copy
   of the dashboard (git show <rev>:assets/deckwave-dashboard.js > file) so a
   new check can be SHOWN failing on the old source before it is trusted —
   the same seam the other harnesses carry. The sandbox boot above still
   loads the tree's own index.html; only these text checks follow the seam. */
const dashSrc = fs.readFileSync(process.env.DECKWAVE_DASH_SRC || 'assets/deckwave-dashboard.js', 'utf8').replace(/\r\n/g, '\n');
/* EVERY SHIPPED MODULE PARSES. Added 2026-08-30 after this harness reported
   all-green on a deckwave-dashboard.js whose ▶ handler had an unterminated
   comment — a closing delimiter landed early and left prose as bare code.
   (Writing THIS comment reproduced the bug a third time: the delimiter
   spelled out literally, inside a block comment, closes it. Hence the
   wording.) Two commits and
   a package cut carried a dashboard that could not load, and nothing noticed,
   because every check in this file reads source as TEXT and a SyntaxError
   does not move the strings (ledger 111). The compile check existed by then
   — for recon-app.js and index.html's boot gate — and simply had not been
   pointed at the modules this harness is actually about.
   vm.Script parses without executing: built-in, no dependency, no globals
   touched. Whole directory, not a list, so a new module is covered the day
   it lands rather than the day someone remembers to add it. */
{
  const vm = require('vm');
  const bad = [];
  for (const f of fs.readdirSync('assets').filter(n => n.endsWith('.js')).sort()) {
    try { new vm.Script(fs.readFileSync('assets/' + f, 'utf8'), { filename: f }); }
    catch (e) { bad.push(f + ': ' + ((e && e.message) || e)); }
  }
  ok('every .js in assets/ PARSES (' + fs.readdirSync('assets').filter(n => n.endsWith('.js')).length + ' modules)',
     bad.length === 0,
     'a shipped module has a SyntaxError and every text check in this file still passes: ' + JSON.stringify(bad.slice(0, 3)));
}
/* PARSING IS NOT LOADING (ledger 132, 2026-09-03). 0.8.1 went to Pages with
   two modules that PARSED and threw on load: a backtick in a comment inside
   a CSS template literal closed the literal, and the file compiled as a
   tagged-template call — `"…css…"(…)` — which is valid syntax and a
   TypeError at run time. The parse sweep above was green; the boot gate on
   deckwave.fm said "failed to load: DWNOWPLAYING, DWDASH". So this sweep
   EXECUTES every script index.html loads, in index.html's order, in one
   fresh vm context with a browser-shaped window — the same shape the rest
   of this harness uses — and demands that none throws at load. Vendor
   files are skipped (WASM), and a module that needs something the fake
   lacks is a fake to extend, never a check to weaken: the falsifier is the
   HEAD tree of 2026-09-03 before the fix, which fails exactly two.
   Run from the repo root; the file list is read from index.html so a new
   script tag is covered the day it lands. */
{
  const vm = require('vm');
  const html = fs.readFileSync('index.html', 'utf8').replace(/\r\n/g, '\n');
  const srcs = [];
  html.replace(/<script[^>]*\ssrc="([^"]+)"[^>]*>/g, (m, s) => { if (/^assets\//.test(s)) srcs.push(s); return m; });
  const noop = () => {};
  const el = () => ({ style: {}, dataset: {}, classList: { add: noop, remove: noop, toggle: noop, contains: () => false },
                      appendChild: noop, removeChild: noop, append: noop, remove: noop, setAttribute: noop, getAttribute: () => null,
                      addEventListener: noop, removeEventListener: noop, querySelector: () => null, querySelectorAll: () => [],
                      getContext: () => null, attachShadow: () => el(), textContent: '', innerHTML: '', children: [] });
  const store = {};
  const sb = {
    console: { log: noop, warn: noop, error: noop, info: noop, debug: noop },
    setTimeout: () => 0, clearTimeout: noop, setInterval: () => 0, clearInterval: noop,
    requestAnimationFrame: () => 0, cancelAnimationFrame: noop, queueMicrotask: noop,
    performance: { now: () => 0 },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    sessionStorage: { getItem: () => null, setItem: noop, removeItem: noop },
    navigator: { userAgent: 'check-panels', platform: 'node', language: 'en', maxTouchPoints: 0 },
    location: { origin: 'http://127.0.0.1:8777', href: 'http://127.0.0.1:8777/', protocol: 'http:', hostname: '127.0.0.1', search: '', hash: '', pathname: '/' },
    document: Object.assign(el(), { createElement: el, createElementNS: el, getElementById: () => null, body: el(), head: el(), documentElement: el(),
                                    hidden: false, visibilityState: 'visible', currentScript: null, readyState: 'complete' }),
    customElements: { define: noop, get: () => undefined },
    matchMedia: () => ({ matches: false, addEventListener: noop, addListener: noop }),
    addEventListener: noop, removeEventListener: noop, dispatchEvent: () => true,
    devicePixelRatio: 1, innerWidth: 1280, innerHeight: 800, screen: { width: 1280, height: 800 },
    URL: URL, TextEncoder: TextEncoder, TextDecoder: TextDecoder, Blob: class {}, Event: class {}, CustomEvent: class {},
    fetch: () => new Promise(noop), crypto: { getRandomValues: a => a, subtle: {} },
    atob: s => Buffer.from(s, 'base64').toString('binary'), btoa: s => Buffer.from(s, 'binary').toString('base64'),
    structuredClone: x => JSON.parse(JSON.stringify(x)),
  };
  sb.window = sb; sb.self = sb; sb.globalThis = sb;
  vm.createContext(sb);
  const threw = [];
  for (const s of srcs) {
    try { vm.runInContext(fs.readFileSync(s, 'utf8'), sb, { filename: s }); }
    catch (e) { threw.push(s + ': ' + ((e && e.message) || e).split('\n')[0].slice(0, 120)); }
  }
  ok('every script index.html loads from assets/ LOADS without throwing (' + srcs.length + ' scripts, index.html order)',
     srcs.length >= 20 && threw.length === 0,
     'a module compiled and threw at load — the 0.8.1 boot-gate failure: ' + JSON.stringify(threw.slice(0, 3)));
  const globals = ['DW', 'DWPANELS', 'DWMSG', 'DWNOWPLAYING', 'DWDASH', 'DWLOOP', 'DWEVENTS'];
  const missing = globals.filter(g => typeof sb[g] === 'undefined');
  ok('the loaded scripts hung the globals the boot gate needs (' + globals.join(', ') + ')',
     missing.length === 0,
     'a script ran and left its global undefined — exactly what the boot gate reports as failed to load: ' + JSON.stringify(missing));
}
/* The card relabels its four grid tiles in listen mode; the glossary map used
   to be POSITIONAL, so hovering `level` returned the tempo definition. Keyed
   off the label's own text since 2026-08-31, and an unrecognised label gets no
   tag at all - DWMSG.term() returns null and show() bails, so a missing
   definition is silent where a wrong one is a lie with a tooltip. */
{
  const d = fs.readFileSync('assets/deckwave-dashboard.js', 'utf8');
  const after = (d.split(".querySelectorAll('.grid u')")[1] || '').slice(0, 400);
  /* The first version of this check excluded the single literal `[i]` and
     nothing else, so `.item(i)`, `[idx]` and a forEach that simply TAKES an
     index parameter all sailed through — the check named the hazard and
     tested one spelling of it (review, Harnesses). Widened 2026-09-03 to the
     three ways a position can reach this code:
       .item(n)              the NodeList accessor
       [i] [idx] [index] …   an index variable used as a subscript
       forEach/map((u, i) => an index parameter, which is how one appears
     `[0]` is NOT forbidden: the live code ends `.split(/\s+/)[0]`, taking the
     first WORD of the label, which is text-keyed and correct. */
  const positional = /\.item\s*\(|\[\s*(?:i|j|k|n|ix|idx|index)\s*\]|(?:forEach|map)\s*\(\s*(?:function\s*)?\(?\s*[A-Za-z_$][\w$]*\s*,\s*[A-Za-z_$][\w$]*\s*[),]/;
  ok('the card grid glossary is tagged by LABEL TEXT, not by position',
     /textContent/.test(after) && !positional.test(after),
     'a positional index still tags the grid, so listen mode shows the wrong definitions');
  /* Scoped to the code AFTER the selector, not to the whole file: the first
     version searched for the old order array anywhere in the source and was
     tripped by the COMMENT that explains the old behaviour — the third time
     today a note about a hazard set off the check written for it. A check
     that reads prose is reading the wrong thing. */
}
/* The HEADER's stretch cell is DOM, not a canvas panel, so drawAll's
   forbidden-figure filter never covered it — and with nothing on a deck the
   header lands on the PLAN fallback, where `_stretch` is 1 for the first
   track by construction. It printed `STRETCH 0.0%` on a stopped, freshly
   built set while the card beside it correctly showed `-`. Found by looking
   at the running page on 2026-08-31, not by any check. Pinned to the
   ORDERING: the idx-0 guard must be consulted before the plan fallback. */
{
  const d = fs.readFileSync('assets/deckwave-dashboard.js', 'utf8');
  const chain = (d.split("let str = '-', warn = false;")[1] || '').split("$('kStr').textContent")[0];
  const iGuard = chain.search(/s\.idx === 0\) str = '∿'/);
  const iPlan = chain.search(/t\._stretch\) \{ str =/);
  ok('the header prints no stretch figure for the first track with nothing on a deck',
     iGuard > -1 && iPlan > -1 && iGuard < iPlan,
     'the header reaches the plan fallback for track 0, where _stretch is 1 by construction, and prints 0.0%');
}
/* THE CARD'S ALIGNMENT WORD, DRIVEN, NOT READ. The blend line tested only
   the INCOMING track for `_unlocked`, so a grid-unlocked OUTGOING track with
   a locked successor printed "downbeat-aligned" while the engine left it on
   the clock (deckwave.js naturalExit() and the `!m._unlocked` exit snap both
   refuse a distrusted grid) and the transition monitor beside it said
   STRAIGHT (ultracode review 2026-10-22). The card is mounted into a stub
   shadow root and update() is called against the engine getters above, so
   the string asserted on is the one the keeper reads. CONTROL FIRST: the
   locked→locked case MUST print the word, or the branch was never reached
   and the two zeros after it are decoration. DECKWAVE_NP_SRC points this
   block at another copy of the card (run it against HEAD's to see it fail). */
{
  const npPath = process.env.DECKWAVE_NP_SRC || 'assets/deckwave-nowplaying.js';
  const nodes = {};
  const mkEl = () => ({ style: {}, textContent: '', innerHTML: '', className: '', title: '', children: [], parentElement: null,
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, appendChild() {}, remove() {}, querySelector: () => null });
  const sr = { getElementById: id => (id === 'dw-np-css' || id === 'npBox' || id === 'list' || id === 'kReg')
                                     ? null : (nodes[id] || (nodes[id] = mkEl())),
               querySelector: s => (s === '.app' ? mkEl() : null), appendChild() {} };
  const save = [nowMeta, nextMeta, deck, nextDeck, blend, elapsed, DWstate];
  let NP = null, err = '';
  try {
    eval(fs.readFileSync(npPath, 'utf8').replace(/\r\n/g, '\n'));
    NP = global.DWNOWPLAYING; NP.mount({ shadow: sr });
  } catch (e) { err = e.message; NP = null; }
  /* one planned blend, 42 s out, 16 s crossfade — the card's own fixture shape */
  const line = (cur, nxt) => {
    nowMeta = cur; nextMeta = nxt; elapsed = 60;
    deck = { meta: cur, name: cur.name, bpm: cur.bpm, rate: 1, origin: 'chain', settling: false, settleLeft: 0 };
    nextDeck = { meta: nxt, name: nxt.name, bpm: nxt.bpm, rate: 1, straight: !!(cur._unlocked || nxt._unlocked), startsAt: 300, entry: 0 };
    blend = { in: 42, at: 102, dur: 240, xfade: 16, frac: 102 / 240, fadeFrac: 16 / 240 };
    DWstate = { idx: 0, of: 5, tempo: cur.bpm, now: cur.name, next: nxt.name, live: 2, ctx: 'running' };
    nodes.npBlend = mkEl();
    try { NP.update(bundle({ transLeft: 42 }), 42); } catch (e) { return 'THREW: ' + e.message; }
    return String(nodes.npBlend.innerHTML);
  };
  const ctrl = NP ? line(T0, T1) : '';
  ok('CONTROL: the card calls a locked→locked planned blend downbeat-aligned (the blend line is reached)',
     !!NP && /downbeat-aligned/.test(ctrl),
     'the card never reached its blend line, so the two checks after this would pass on nothing: ' + JSON.stringify(err || ctrl));
  const outU = NP ? line(TS, T1) : '';
  ok('a grid-UNLOCKED OUTGOING track with a locked successor is not called downbeat-aligned — the engine leaves it on the clock',
     !!NP && !/downbeat-aligned/.test(outU) && /no beat alignment/.test(outU),
     'the card claims an alignment the engine is not making: ' + JSON.stringify(outU));
  const inU = NP ? line(T0, TS) : '';
  ok('a straight INCOMING track is still not called downbeat-aligned',
     !!NP && !/downbeat-aligned/.test(inU) && /no beat alignment/.test(inU),
     'the incoming case regressed: ' + JSON.stringify(inU));
  [nowMeta, nextMeta, deck, nextDeck, blend, elapsed, DWstate] = save;
}
const npSrc2 = fs.readFileSync('assets/deckwave-nowplaying.js', 'utf8').replace(/\r\n/g, '\n');
/* CLAUDE.md: "Do not label an axis with numbers the project chose." The
   loudness panel drew reference lines at -14 and -23 and labelled them
   LUFS — an absolute broadcast target asserted on a series that is
   20*log10(rms) - 10 over FFT bytes, with a chosen offset and no reference
   to full scale. Both the label and the LINE POSITION claimed a calibration
   that does not exist. Removed 2026-08-30; this keeps it removed. Scoped to
   drawn text, so the word may still be discussed in a comment. */
{
  const pSrc = fs.readFileSync('assets/deckwave-panels.js', 'utf8').replace(/\r\n/g, '\n');
  const drawn = (pSrc.match(/fillText\([^;]*LUFS/g) || []);
  ok('no panel draws an absolute LUFS label on an uncalibrated relative scale',
     drawn.length === 0,
     'a LUFS figure is drawn: ' + JSON.stringify(drawn.slice(0, 2)));
}
/* ▶ ON A PAUSED SET RESUMES, IT DOES NOT RESTART. Keeper, 2026-08-30.
   play() opens with `ctx.resume(); this.stop()` and the button passed a
   hardcoded index 0, so ▶ while paused killed the decks and restarted from
   track 1 — losing the position of a set that had been running for an hour.
   Scoped to the handler and pinned to the PROPERTY (the resume path is
   consulted BEFORE the restart path), not to a line shape: a check that
   pins a statement breaks on refactors and teaches the next person to
   loosen it rather than fix the code. */
{
  const h = (dashSrc.split("btn('▶ play'")[1] || '').split('GRP.play')[0];
  const iResume = h.search(/DW\.pause\(\)/);
  const iRestart = h.search(/DW\.play\(/);
  ok('▶ play RESUMES a paused deck instead of restarting the set from track 0',
     h.length > 0 && /suspended/.test(h) && iResume > -1 && iRestart > -1 && iResume < iRestart,
     'the ▶ handler reaches DW.play() without first checking for a suspended context with live decks — a paused set restarts from the top');
  /* BOTH arms, because the first fix guarded only the paused one and left a
     worse trap one press later: paused → ▶ resumes → ▶ again destroyed the
     session. `state.now` is the predicate on both; `state.of` cannot be used
     because neither stop() nor kill() clears `order`, so it stays truthy
     forever after the first ▶ — and `live` counts source NODES, which drain
     asynchronously on `src.onended` and were observed non-zero with deck A
     already null in a live boot on 2026-08-31. */
  const iRunning = h.search(/'running'/);
  ok('▶ play on an ALREADY PLAYING set is a no-op, not a restart from track 0',
     iRunning > -1 && iRunning < iRestart && /st\.now/.test(h),
     'the ▶ handler falls through to DW.play(set, 0) while a set is on the air — pressing play twice destroys the session it just resumed');
}
/* STOP IS TITLED AND KILL IS OUT OF THE TRANSPORT. UI review, 2026-10-07,
   the keeper's Part 5 decisions 5 and 6 (2026-10-09). Finding 8: stop
   silently restarts the set at track 1 and a destructive engine reset sat one
   button from it with no title. Pinned at the source: the stop button must
   carry a title that names track 1, and the ONLY button whose handler calls
   DW.kill() must be in the cfg group, never the play group. All three shown
   failing against the 2026-10-08 source. */
{
  const stopH = (dashSrc.split("btn('■ stop'")[1] || '').split('\n\n')[0];
  ok('■ stop carries a title that says ▶ restarts from track 1',
     stopH.length > 0 && /\.title = '[^']*track 1[^']*'/.test(stopH),
     'stop clears both decks and the next ▶ plays track 1; a stop with no title is the lost-session trap with a different button');
  const killers = (dashSrc.match(/btn\('[^']*', \(\) => log\(window\.DW\.kill\(\)\), false, GRP\.\w+\)/g) || []);
  ok('the engine reset is ONE button, in the drawer\'s troubleshoot section, and it is not called kill',
     killers.length === 1 && /GRP\.trouble\)$/.test(killers[0]) && !/btn\('kill'/.test(killers[0]),
     'DW.kill() buttons found: ' + JSON.stringify(killers));
  ok('…and it has a title that calls itself a last resort',
     /killBtn\.title = '[^']*last resort[^']*'/.test(dashSrc),
     'the reset lost the wording that tells a person what it is for');
}
/* SAVE AND LOAD SET LIVE IN A MENU, AND THE MENU LIVES IN THE BAR. Keeper's
   Part 5 decision 3 ("i don't use them daily") with Part 3 §4's correction:
   the Prepared card is hidden whenever nothing is prepared, which is exactly
   when Open Set is needed, so the menu must anchor in the transport, never on
   the card. Pinned at the source three ways; all failing on the 2026-10-08
   source, where both were top-level btn() calls. */
{
  ok('save set and load set are menu items, not bar buttons',
     !/btn\('▾ save set'/.test(dashSrc) && !/btn\('▴ load set'/.test(dashSrc)
     && /menuItem\('▾ save set'/.test(dashSrc) && /menuItem\('▴ load set'/.test(dashSrc),
     'one of them is back on the bar as a top-level button');
  const menuBlock = (dashSrc.split('const setMenu = document.createElement')[1] || '').split('const menuItem')[0];
  ok('the set menu anchors in the transport bar (tp), in the files group, not on the Prepared card',
     menuBlock.length > 0 && /tp\.insertBefore\(setMenu/.test(menuBlock)
     && /setMenu\.dataset\.grp = GRP\.files/.test(menuBlock)
     && !/prepared/i.test(menuBlock),
     'a menu on the Prepared card disappears with it, and the card is hidden whenever nothing is prepared');
  ok('…and the save item still carries data-set-action, which renderPrepared retargets between set and prepared',
     /saveBtn\.dataset\.setAction = 'save'/.test(dashSrc),
     'without it the label stops following the target and "save set" silently saves the prepared set');
  /* THE LIBRARY BUTTON IS CONTEXTUAL. Keeper's Part 5 decision 7 (finding 6):
     the permanent `library` button opened the same picker as scan and, used
     as "add another library", REPLACED the file map. It now appears only
     when a fresh count of the file set's unresolvable tracks is non-zero and
     a folder has been opened at all. Pinned: no bar button called library;
     the re-link button starts hidden; its painter requires lib.files and
     hides on zero; and no asset text still sends a person to a button named
     "library" — with 'build a set first' as the control that must hit. */
  const relink = (dashSrc.split("btn('re-link music folder…'")[1] || '').split('setInterval(paintRelink')[0];
  ok('the library button is gone from the bar and the re-link button starts hidden',
     !/btn\('library'/.test(dashSrc) && relink.length > 0 && /libBtn\.hidden = true;/.test(relink),
     'a permanent re-pick button beside scan is the thing finding 6 removed');
  ok('…and its painter counts missing files FRESH, needs an opened folder, and hides on zero',
     /function paintRelink\(\)/.test(relink) && /lib\.files && target\.length/.test(relink)
     && /target\.filter\(t => !lib\.find\(t\)\)\.length/.test(relink) && /libBtn\.hidden = miss === 0;/.test(relink),
     'on a fresh page LIB.files is null and every track would count as missing — the prompt would compete with scan as the first action');
  /* …AND THE ATTRIBUTE MUST SURVIVE THE PHONE CSS (ultracode review,
     2026-10-22). `hidden` is a UA-origin rule, and inside the ≤720px block
     `.tp.cfg-open [data-grp="files"]{display:inline-block}` is author-origin
     — which wins the cascade whatever its specificity. So with ⚙ open on a
     phone the re-link button rendered with nothing missing, the state
     Part 5 §7 built it to stay hidden in. The two checks above pin the
     `.hidden =` writes by text and cannot see that. Pinned here: the shadow
     sheet carries `.tp [hidden]{display:none!important}`, with the phone
     override still present as the control that must hit (without it the
     check would be guarding nothing). What this cannot see: a computed
     style — no CSS engine runs here; the 400px-iframe look is the eye's. */
  {
    const css = (dashSrc.split('const CSS = `')[1] || '').split('\n`;')[0];
    ok('…and the hidden attribute survives the phone CSS: `.tp [hidden]{display:none!important}` is in the shadow sheet',
       /\.tp\.cfg-open \[data-grp="files"\],\.tp\.cfg-open \[data-grp="capture"\]\{display:inline-block\}/.test(css)
       && /\n\.tp \[hidden\]\{display:none!important\}/.test(css),
       'the phone block\'s author display rule beats the UA [hidden] — ⚙ open on a phone shows "re-link music folder…" with nothing missing');
  }
  {
    const texts = ['assets/deckwave-render.js', 'assets/deckwave-cache.js', 'assets/deckwave-messages.js']
      .map(f => fs.readFileSync(f, 'utf8')).join('\n') + dashSrc;
    const stale = (texts.match(/press library|open the library first|re-open the library/g) || []);
    ok('no asset text sends a person to a button named "library" any more (control: "build a set first" still hits)',
       stale.length === 0 && /build a set first/.test(texts),
       'stale wording found: ' + JSON.stringify(stale));
  }
  /* THREE MORE FROM PART 2 §8, 2026-10-09, on the keeper's "continue":
     §8.15 the steering row says "no beatmatched route", not "unreachable" —
     every track IS reachable by a straight cut and the gate plays it so;
     §8.12 a fresh wide page no longer opens on twelve panels nobody chose,
     and the wall is named for what it is (twelve of the panels, not all);
     §8.9 a phone never restores an open drawer. All failing on a9250f5. */
  ok('the steering menu claims "no beatmatched route", never "unreachable"',
     /b: '✕ no beatmatched route'/.test(dashSrc) && !/'✕ unreachable'/.test(dashSrc),
     'a track the gate would play straight is being called unreachable');
  /* ULTRACODE REVIEW 2026-10-22: the same row printed DWNAV's wouldNeed —
     hopsNeeded()'s integer HOP COUNT — through pct(), so 109→172 read
     "would need +13%" beside the 8% gate it seemed to contradict; and the
     scenic row put a '+' on finalStretch, which is Math.abs in nav.js, so a
     route that ends BELOW the destination's tempo read as a speed-up.
     Neither figure may pass through pct(); pct(signed) on next/force is the
     control that the formatter itself is still in use. Failing on 6583d55. */
  ok('the steering menu prints wouldNeed as hops and finalStretch unsigned, never through pct() (control: pct(signed) still hits)',
     !/pct\(o\.wouldNeed\)/.test(dashSrc) && !/pct\(o\.finalStretch\)/.test(dashSrc)
     && /would need about ' \+ o\.wouldNeed \+ ' hops/.test(dashSrc)
     && /ending within '\s*\+ o\.finalStretch \+ '% of/.test(dashSrc)
     && /pct\(signed\)/.test(dashSrc),
     'a hop count or an unsigned magnitude is printed as a signed stretch percentage');
  ok('the wall is not called "all 12" (it is twelve of the registered panels)',
     !/all 12/.test(dashSrc) && /twelve-panel wall/.test(dashSrc),
     '"all" promises more than the twelve slots hold');
  {
    const mega = (dashSrc.split('DWDASH.mega = function')[1] || '').split('DWDASH.folds')[0];
    ok('startup mega() keeps the panel set whether or not one is stored',
       mega.length > 0 && /if \(keep\) \{/.test(mega) && !/keep && dash\.slots\.hasStored\(\)/.test(mega)
       && mega.indexOf('if (keep) {') < mega.indexOf('reset(window.DWPANELS.ALL)'),
       'a fresh wide page runs reset(ALL) and opens on twelve panels the person did not pick');
  }
  {
    const cfg = (dashSrc.split('let cfgOpen = false;')[1] || '').split('const cfgBtn')[0];
    ok('a phone (≤720px, the CSS breakpoint) never restores an open ⚙ drawer',
       /matchMedia\('\(max-width:720px\)'\)\.matches/.test(cfg) && /!phone && localStorage\.getItem\('dw-cfg-open'\)/.test(cfg),
       'an open drawer restored on a phone squashes the panel area to 0px');
  }
  /* UI WALK DECISION 1, 2026-10-09 (§8.6): settle's ON state shows beside
     Build with the drawer closed. What this can fail on: no mark; a mark in
     the cfg group (hidden with the drawer — the very thing decided against);
     a mark that is a button (it would count against the bar budget); a mark
     painted only from the toggle (the console's DW.settle.on = true would
     leave it dark). What it cannot see: whether it renders where the eye
     lands — that is the keeper's glance. Fails on 58ca2d6. */
  {
    const mk = (dashSrc.split("btn('build · phrase match'")[1] || '').split('const paintSettle')[0];
    const ps = (dashSrc.split('const paintSettle = () => {')[1] || '').split('};')[0];
    ok('a settle mark sits beside Build in the DECK group, starts hidden, and is not a button',
       /createElement\('span'\)/.test(mk) && /smark\.dataset\.grp = GRP\.deck/.test(mk) && /smark\.hidden = true/.test(mk),
       'with the drawer closed nothing on screen says settle is on (walk step 1)');
    ok('…and it paints from DW.settle itself, on a tick and on the toggle',
       /window\.DW\.settle/.test(ps) && /smark\.hidden = !on/.test(ps)
       && /setInterval\(paintSettle, \d+\)/.test(dashSrc)
       && /'settle off — trusted decks[^\n]*\n\s*paintSettle\(\);/.test(dashSrc),
       'a mark painted only by the button disagrees with the engine after DW.settle.on is set from the console');
  }
  ok('…and the document click handler closes .sel menus, which the set menu is one of',
     /querySelectorAll\('\.sel,\.pmenu,\.hcard'\)\.forEach\(o => o\.classList\.remove\('open'\)\)/.test(dashSrc),
     'an open menu that nothing closes covers the bar until reload');
}
ok('the card\'s attribution href is SCHEME-GATED, not merely escaped (F1 — the review\'s one real vulnerability)',
   /const safeHref = u =>/.test(npSrc2) && /p === 'http:' \|\| p === 'https:'/.test(npSrc2)
   && /t\.source && safeHref\(t\.source\.page\)/.test(npSrc2)
   && !/href="' \+ esc\(t\.source\.page\)/.test(npSrc2),
   'esc() cannot make an href safe - entities decode before the URL is dispatched, so a javascript: page URL from a loaded score executes in this origin on one click, with the music folder\'s directory handle in reach');
ok('the libre panel gates its outbound page links the same way (Commons descriptionurl comes from the API)',
   /const safeHref = u =>/.test(fs.readFileSync('assets/deckwave-libre.js', 'utf8'))
   && /safeHref\(it\.page\) \?/.test(fs.readFileSync('assets/deckwave-libre.js', 'utf8')),
   'the Archive page URL is built locally and safe by construction, but Commons hands back descriptionurl and it lands in an href');
ok('clean() requires a SPACED separator, so a title\'s own hyphen survives (F2)',
   /replace\(\/\^\[\^-\]\+ - \/, ''\)/.test(npSrc2)
   && !/replace\(\/\^\[\^-\]\+-\\s\*\//.test(npSrc2),
   'the ungated double strip renders "LukHash - 8-Bit Warrior" as "Bit Warrior" on the one surface whose whole job is naming what is playing');
/* and the behaviour, not just the shape: run the real function */
{
  const m = npSrc2.match(/const clean = n => [^\n]*/);
  const body = m ? m[0].split('=>').slice(1).join('=>').trim().replace(/;\s*$/, '') : null;
  const clean = body ? eval('(n => ' + body + ')') : null;
  ok('…checked by RUNNING it: the hyphenated title comes back whole, and the real Artist - Album - NN prefix still goes',
     !!clean && clean('LukHash - 8-Bit Warrior') === '8-Bit Warrior'
     && clean('LukHash - GLITCH - 02 DOOMSDAY') === 'DOOMSDAY',
     clean ? [clean('LukHash - 8-Bit Warrior'), clean('LukHash - GLITCH - 02 DOOMSDAY')].join(' | ') : 'could not extract clean()');
  /* THE DASHBOARD'S COPY, run the same way. The ultra review called this one
     safe because it does only one generic strip; it is not — `[^-]+-\s*`
     takes the `8-` and `\d+\s*` then takes a bare leading digit. Found here,
     by running it, after the card's fix had already passed its text check
     (ledger 104). The track list is the more visible of the two surfaces. */
  const dm = dashSrc.match(/const clean = n => [^\n]*/);
  const dbody = dm ? dm[0].split('=>').slice(1).join('=>').trim().replace(/;\s*$/, '') : null;
  const dclean = dbody ? eval('(n => ' + dbody + ')') : null;
  ok('the TRACK LIST\'s clean() keeps hyphens too — run, not read',
     !!dclean && dclean('LukHash - 8-Bit Warrior') === '8-Bit Warrior'
     && dclean('Artist - 8-Bit Warrior') === '8-Bit Warrior'
     && dclean('LukHash - GLITCH - 02 DOOMSDAY') === 'DOOMSDAY',
     dclean ? [dclean('LukHash - 8-Bit Warrior'), dclean('Artist - 8-Bit Warrior'),
               dclean('LukHash - GLITCH - 02 DOOMSDAY')].join(' | ') : 'could not extract the dashboard clean()');
}
/* review 2026-09-01 H3 (ledger 124), measured with trusted input: an
   innerHTML write every frame replaced the ↗ anchor ~60×/s, so a 100 ms
   press landed mousedown and mouseup on two different nodes and the browser
   fired no click at all; the same press with no frame between opened the
   page. The line is written only when its composed key changes. [text]:
   the innerHTML write must sit inside the key gate, and every other write
   to the line must reset the key so the next play rewrites it. */
{
  const gate = npSrc2.indexOf('if (metaKey !== lastMetaKey)');
  const write = npSrc2.indexOf("$('npM').innerHTML");
  const closeOfGate = gate > 0 ? npSrc2.indexOf('\n    }\n', gate) : -1;
  const otherWrites = npSrc2.split('\n').filter(l => /\$\('npM'\)\.textContent = '/.test(l)).map(l => l.trim());
  ok('[text] the card\'s metadata line (and its ↗ anchor) is written only when its key changes, never per frame',
     gate > 0 && write > gate && write < closeOfGate && /let lastMetaKey = ''/.test(npSrc2),
     'an innerHTML write outside the key gate rebuilds the anchor every frame and the link cannot be clicked');
  ok('…and every other write to that line resets the key so the next play rewrites it',
     otherWrites.length >= 2 && otherWrites.every(l => /lastMetaKey = ''/.test(l)),
     'a stale key would leave "stopped · cued" on the card after ▶: ' + otherWrites.join(' | '));
}
ok('the spectrum-bar loop lives in ONE place - the track path calls drawBars() like the other two (F6)',
   (npSrc2.match(/const lo = Math\.floor\(Math\.pow\(i \/ nb, 2\.2\)/g) || []).length === 1
   && /^\s*drawBars\(D\);\s*$/m.test(npSrc2),
   'five calibrated constants (2.2, 22, 200, 255, 2) in two copies drift the moment one is tuned - and drawBars\'s own comment announces the extraction');
ok('the drop outline can actually reach the host: :host(.dropping), not #deckwave.dropping (F3)',
   /:host\(\.dropping\) \.app\{/.test(dashSrc) && !/#deckwave\.dropping/.test(dashSrc),
   'a selector inside a shadow root cannot match the host by id, so the outline never rendered while the drop itself worked');
ok('a REFUSED route clears the queue it set (F4)',
   /if \(!r\.ok\) \{ N\.clearQueue\(\); log\('route failed/.test(dashSrc),
   'commitAndRepair only reaches clearQueue() on success, so a rejected route kept drawing as a pending detour - and clearRoute() would NOT fix it, it clears `active`, which nothing set');
ok('the data-side / data-dense rules exist once (F5)',
   (dashSrc.match(/\.app\[data-side="hide"\] \.side\{display:none\}/g) || []).length === 1
   && (dashSrc.match(/\.app\[data-dense="1"\] \.strip\{/g) || []).length === 1,
   'two byte-identical copies with equal specificity: the later silently wins and an edit to the earlier one does nothing');

console.log('\n── the two outbound links in the header ──');
/* Added 2026-09-05 (keeper: "a link in the app to the youtube channel so
   people can see how it works … 'about you' for bandcamp"). Two anchors, and
   the check that matters is NOT that they exist — it is `target="_blank"`.
   An outbound link on this page without it navigates the deck away, and a
   reload DESTROYS the loaded set (CLAUDE.md says so twice); there is no back
   button for an analysed library. That is the failure mode a person would
   find by losing an hour of work, so it gets a gate rather than a comment.

   The anchors are pulled out of the .lk block and each one is checked, so
   adding a third link without a target fails here rather than passing on the
   strength of the other two. */
{
  const lk = (dashSrc.split('<div class="lk">')[1] || '').split('</div>')[0];
  const anchors = lk.match(/<a\b[\s\S]*?<\/a>/g) || [];
  const href = a => (a.match(/href="([^"]+)"/) || [, ''])[1];
  /* Four until 2026-10-09; the channel and Bandcamp links were removed on the
     keeper's decision (UI review Part 5 §4). EXACTLY two now: the check pins
     the count both ways, so a link creeping back in fails here too. */
  ok('the header carries exactly the two counting links and nothing else',
     anchors.length === 2
     && !anchors.some(a => /@deckwave-app|bandcamp\.com/.test(href(a)))
     && anchors.some(a => /^https:\/\/www\.youtube\.com\/watch\?v=qoulzN1mLyw$/.test(href(a)))
     && anchors.some(a => /^https:\/\/github\.com\/waypostmaster\/deckwave$/.test(href(a))),
     'the .lk block holds ' + anchors.length + ' anchor(s): ' + anchors.map(href).join(' | '));
  /* The two COUNTING links, added 2026-09-06. Deckwave measures nobody: Pages
     exposes no traffic API, the Archive counter is stale by three weeks, and
     this page will never carry an analytics script - that is the ethos, not an
     omission. So the only honest instrument is a link the visitor CHOOSES to
     follow, counted on a surface that already counts. The github one counts a
     passive landing (traffic/views + popular/referrers names deckwave.fm) even
     from someone with no account who does nothing; the youtube one counts an
     act. Both are asserted by exact href because a typo would silently measure
     nothing and read exactly like nobody came. */
  ok('...and the two counting links point at the exact video and repo, not a channel or a search',
     anchors.some(a => href(a) === 'https://www.youtube.com/watch?v=qoulzN1mLyw')
     && anchors.some(a => href(a) === 'https://github.com/waypostmaster/deckwave'),
     'a counting link that 404s or lands on a channel reads identical to nobody clicking: '
     + anchors.map(href).join(' | '));
  ok('…and EVERY one opens in a new tab',
     anchors.length > 0 && anchors.every(a => /target="_blank"/.test(a)),
     'a same-tab outbound link on the deck destroys the loaded set and the whole analysis session with it — the one loss this page cannot undo');
  ok('…and every one is rel=noopener, like every other external anchor here',
     anchors.length > 0 && anchors.every(a => /rel="noopener"/.test(a)),
     'the opened page gets a live window.opener handle on the deck');
  ok('…and every href is an absolute https URL, not a path the deck would resolve against itself',
     anchors.length > 0 && anchors.every(a => /^https:\/\//.test(href(a))),
     'a relative or protocol-less href lands on deckwave.fm and reloads the app: ' + anchors.map(href).join(' | '));
  ok('the links are the LAST thing in the header, past the readouts',
     dashSrc.indexOf('<div class="lk">') > dashSrc.indexOf("['bass hits','kHit']")
     && /\.bar \.lk\{margin-left:auto/.test(dashSrc),
     'without margin-left:auto they sit against the last figure and read as another readout');
}

console.log('\n── the status line, after the keeper saw a stale countdown ──');
/* Keeper, 2026-08-29, live in the console: "there is some stale text,
   'blending in 1.5s …'" — the text that persists after choosing a new set
   target. The line held a claim about the FUTURE and never revisited it.

   These run the REAL makeStatusLine, extracted from the source, against a
   fake deck and a fake node, and step() is called by hand so no timer is
   involved. Falsifier for the whole section: a line that still says
   "blending in N s" once the deck says that blend is over.

   The first four fail against the pre-fix source for the trivial reason
   (the factory did not exist); the fifth is the one that would have failed
   for a REAL reason — three writers put text into #logLine directly. */
{
  const m = dashSrc.match(/function makeStatusLine\(getDW\) \{[\s\S]*?\n\}/);
  ok('makeStatusLine found in the dashboard source', !!m, 'regex did not match — factory moved or renamed?');
  if (m) {
    const make = eval('(' + m[0] + ')');
    const A = { name: 'LukHash - GLITCH - 02 DOOMSDAY' }, B = { name: 'LukHash - GLITCH - 03 GIANA' };
    let fake = { nowMeta: A, nextMeta: B, blend: { in: 1.5 } };
    const S = make(() => fake);
    const el = { textContent: '', isConnected: true };

    S.set(el, 'blending in 1.5s · ' + B.name.slice(-30));
    ok('a countdown message against a really-scheduled blend arms the line', S.pending === B,
       'nothing armed — the number would sit frozen exactly as the keeper saw it');
    fake.blend = { in: 0.4 };
    S.step();
    ok('…and the number MOVES with the deck\'s own schedule (DW.blend.in)', /blending in 0\.4s/.test(el.textContent),
       'line still reads ' + JSON.stringify(el.textContent) + ' — a frozen countdown is the bug');

    /* the fade length is not a countdown: `over 16s` must survive untouched */
    S.set(el, 'next · blending in 1.2s over 16s ¶ · ' + B.name.slice(-30));
    fake.blend = { in: 0.7 }; S.step();
    ok('only `in Ns` is re-rendered — `over 16s` is the crossfade length and does not decay',
       /blending in 0\.7s over 16s ¶/.test(el.textContent), 'line reads ' + JSON.stringify(el.textContent));

    /* the handover: the target is now the playing deck */
    fake = { nowMeta: B, nextMeta: A, blend: { in: 180 } };
    S.step();
    ok('once the blend LANDS the line states what happened, with no number left in it',
       /blended into/.test(el.textContent) && !/blending in/.test(el.textContent)
       && !/\bin \d+(?:\.\d+)?s/.test(el.textContent) && S.pending === null,
       'line reads ' + JSON.stringify(el.textContent));

    /* the keeper's own case: a SECOND target chosen. The new log owns the
       slot; and if the pending blend is replaced with no log at all, the
       line must still stop claiming it. */
    fake = { nowMeta: A, nextMeta: B, blend: { in: 2.0 } };
    S.set(el, 'blending in 2.0s · ' + B.name.slice(-30));
    S.set(el, 'cache saved · 189 tracks');
    fake.blend = { in: 0.1 }; S.step(); S.step();
    ok('a later plain message owns the line and is not overwritten by the old countdown',
       el.textContent === 'cache saved · 189 tracks' && S.pending === null, 'line reads ' + JSON.stringify(el.textContent));

    S.set(el, 'blending in 2.0s · ' + B.name.slice(-30));
    fake = { nowMeta: A, nextMeta: null, blend: null };     /* cancelled, or stopped */
    S.step();
    ok('a blend that is cancelled without a log says so rather than counting down to nothing',
       !/blending in/.test(el.textContent) && /no longer scheduled/.test(el.textContent) && S.pending === null,
       'line reads ' + JSON.stringify(el.textContent));

    S.set(el, '189 files · 189/189 resolvable');
    ok('a message with no countdown in it never arms the tick', S.pending === null, 'armed on a plain message');
  }
}
ok('every writer to #logLine goes through STATUS.set — no direct textContent left to freeze',
   !/logLine'\)[^\n]*\.textContent = /.test(dashSrc) && !/\$\('logLine'\)\.textContent = /.test(dashSrc)
   && (dashSrc.match(/STATUS\.set\(/g) || []).length >= 3,
   'a writer that sets #logLine directly cannot cancel a running countdown, so an old blend would keep rewriting the new message');

/* ═══ review 2026-09-01 · M12 and the UI lows ═══════════════════════════
   ONE NUMBER, ONE PLACE. Every check below was run against the pre-fix
   source first and failed there, except the ones marked "control", which
   MUST pass on both — a zero is worth nothing without a term that has to
   return a hit (CLAUDE.md, and ledger 121 the hard way). */
console.log('\n── one implementation each (review M12) ─────────────────────');
{
  const assetSrc = {};
  for (const f of fs.readdirSync('assets').filter(n => n.endsWith('.js')))
    assetSrc[f] = fs.readFileSync('assets/' + f, 'utf8').replace(/\r\n/g, '\n');
  const across = re => Object.keys(assetSrc)
    .reduce((n, f) => n + (assetSrc[f].match(re) || []).length, 0);

  /* THE SPECTROGRAM. The device-pixel fix lived only in
     patch-01-spectrogram.js, which re-registered the panel over the copy in
     deckwave-panels.js — so the page got the correct panel only because one
     extra request happened to succeed, and the panels file carried a comment
     saying its own copy was already the newest version. It was not. */
  ok('exactly ONE waterfall panel is registered anywhere in assets/',
     across(/register\('waterfall'/g) === 1,
     across(/register\('waterfall'/g) + ' registrations — whichever loads last wins, and a failed request silently swaps the instrument');
  ok('…control: the counter can see a registration (polygraph is registered once)',
     across(/register\('polygraph'/g) === 1,
     'the pattern matches nothing, so the zero above would be meaningless');

  /* and the one that IS registered must be the device-pixel version, read
     off the live registry rather than off any file: whatever loaded last is
     what this returns. */
  const wf = P.get('waterfall');
  const body = wf ? String(wf.draw) : '';
  ok('the REGISTERED waterfall does the whole panel untransformed, in device pixels',
     /setTransform\(1, 0, 0, 1, 0, 0\)/.test(body),
     'the panel scrolls its history with putImageData (device pixels, transform ignored) while drawing the new column transformed — correct at dpr 1, broken on every retina display');
  ok('…and it takes its scale from the CANVAS, never from a window',
     /cv\.width \/ w/.test(body) && !/devicePixelRatio/.test(body),
     'the drawing functions run in the OPENER, so window.devicePixelRatio is the laptop\'s and not the projector\'s the panel was dragged to');
  ok('…control: it is still the real spectrogram (it scrolls with getImageData)',
     /getImageData/.test(body),
     'the registered draw function is not the spectrogram at all, so the two checks above tested nothing');

  /* SCRIPT TAG, not the filename: both files carry a comment explaining why
     the patch was retired, and matching the bare name scored those comments
     as the bug. Third time in this file that a note about a hazard set off
     the check written for it. */
  ok('patch-01-spectrogram.js registers nothing and index.html does not load it',
     !/DWPANELS\.register/.test(assetSrc['patch-01-spectrogram.js'] || '')
     && !/<script src="assets\/patch-01-spectrogram/.test(fs.readFileSync('index.html', 'utf8')),
     'a second implementation is still one script tag away from taking the panel back');

  /* THE DASHBOARD'S DEAD PANELS. deckwave-dashboard.js carried whole copies
     of five registered panels, reachable only from an inline loop() that
     DWLOOP replaces at mount and the boot gate makes unreachable — with
     their own copies of calibrated numbers. Each zero is paired with the
     live copy it must NOT have moved. */
  const dash = assetSrc['deckwave-dashboard.js'], pan = assetSrc['deckwave-panels.js'];
  const pairs = [
    ['the chromagram 55-5000 Hz band', /f < 55 \|\| f > 5000/],
    ['the chromagram .12 visibility threshold', /v > \.12/],
    ['the Camelot .85 / .45 score tiers', /sc >= \.85/],
    ['the goniometer 900-point decimation', /n \/ ?900/]
  ];
  pairs.forEach(([what, re]) => {
    ok('no second copy of ' + what + ' in the dashboard',
       !re.test(dash),
       'a calibrated number exists in two files and nothing keeps them in step');
    ok('…control: ' + what + ' IS still in deckwave-panels.js, where it is drawn',
       re.test(pan),
       'the live copy is gone too — the zero above would be "deleted the instrument", not "deleted the duplicate"');
  });
  ok('the dashboard has no second render loop',
     !/function loop\(\)/.test(dash) && !/requestAnimationFrame\(loop\)/.test(dash),
     'an inline loop() with its own analyser buffers and its own spectral-flux detector sits beside DWLOOP\'s, unreachable and drifting');
  ok('…and mount() REFUSES without DWLOOP rather than falling back to one',
     /throw new Error\('DWDASH\.mount needs DWLOOP/.test(dash)
     && !/DWLOOP\.start\(dash\); else/.test(dash),
     'the fallback is back — a gate that refuses beats a second implementation nobody can reach');

  /* THE DECK SPLIT MUST FOLLOW THE ANALYSER (ultracode review, 2026-10-22).
     Ledger 59 put the re-split into splitDeck() — kill → ▶ closes the context
     and boots a fresh analyser, so a split on the old one reads a dead graph
     and the goniometer and VU go flat. But after the inline loop() went
     (2026-09-01) the only caller left was stereoSource(), guarded by
     `if (!deckL)`: once the first split existed the identity check was never
     reached again, and ledger 59's fix was unreachable from every frame.
     Pinned by running the REAL splitDeck/stereoSource text against two fake
     contexts: the first frame splits on the first; with the analyser
     unchanged the next frame returns the same nodes (no per-frame rebuild,
     which is what makes an unguarded call safe); the analyser moving to a
     second context — the kill → ▶ shape — must move the split with it.
     What this cannot see: whether a real closed AnalyserNode reads zeros or
     throws; the needles after reset audio engine → ▶ are the eye's. */
  {
    const sd = dashSrc.match(/\n  function splitDeck\(\) \{[\s\S]*?\n  \}\n/);
    const ss = dashSrc.match(/\n  function stereoSource\(\) \{[\s\S]*?\n  \}\n/);
    ok('splitDeck() and stereoSource() found in the dashboard source', !!(sd && ss), 'regex did not match — moved or renamed?');
    if (sd && ss) {
      const fakeCtx = () => { const c = { connects: 0 }; const node = () => ({ context: c, gain: {}, connect() { c.connects++; } });
        c.createChannelSplitter = node; c.createAnalyser = node; c.createGain = node; c.destination = {}; return c; };
      const ctx1 = fakeCtx(), ctx2 = fakeCtx();
      const win = { DW: { Player: { analyser: ctx1.createAnalyser() } }, DWLISTEN: undefined };
      const F = eval('(function (window) { let deckL = null, deckR = null;' + sd[0] + ss[0] + 'return { splitDeck, stereoSource }; })')(win);
      const first = F.stereoSource(), again = F.stereoSource();
      ok('first frame splits the deck on the live context',
         !!first && first.src === 'deck' && first.L.context === ctx1 && first.R.context === ctx1 && ctx1.connects > 0,
         'stereoSource() returned null or a split on nothing — Act 14\'s frozen needles');
      ok('…control: the analyser unchanged, the next frame returns the SAME nodes (no per-frame rebuild)',
         !!again && again.L === first.L && again.R === first.R && ctx1.connects === 6,
         'an unguarded splitDeck() rebuilds the graph every frame — the identity check is not holding');
      win.DW.Player.analyser = ctx2.createAnalyser();   /* kill → ▶: fresh context, fresh analyser */
      const after = F.stereoSource();
      ok('kill → ▶: the analyser moved to a new context and stereoSource() re-split onto it',
         !!after && after.L.context === ctx2 && after.R.context === ctx2 && after.L !== first.L && ctx2.connects > 0,
         'the split still hangs off the closed context — goniometer and VU read a dead graph until a reload (ledger 59 undone)');
    }
  }

  /* THE CARD'S STYLESHEET. deckwave-nowplaying.js appends its own sheet after
     the dashboard's, so it wins every property both declare; the dashboard's
     .np block decided nothing and had already gone stale (it still styled
     .np .bar, the class the card renamed to .npbar). */
  ok('the dashboard ships no duplicate .np card rules',
     !/^\.np[ .{]/m.test(dash),
     'two stylesheets for one card, only one of which renders — the natural place to make a change is the one that does nothing');
  ok('…and the card carries every rule it needs, including the two that MOVED',
     /^\.np\{/m.test(assetSrc['deckwave-nowplaying.js'])
     && /\.np \.nx\{[\s\S]{0,140}border-top/.test(assetSrc['deckwave-nowplaying.js']),
     'the rules were dropped rather than moved, and the line above "next ·" quietly disappeared');
}

console.log('\n── ledger 104, the last three copies ────────────────────────');
{
  const pan = fs.readFileSync('assets/deckwave-panels.js', 'utf8').replace(/\r\n/g, '\n');
  /* RUN IT, DO NOT READ IT — ledger 104's own lesson: the first fix passed
     its text check and was still wrong. */
  const m = pan.match(/const DWP_clean = n => ([\s\S]*?);\r?\n/);
  const pclean = m ? eval('(n => ' + m[1] + ')') : null;
  ok('deckwave-panels.js has ONE title cleaner, and it was extracted',
     !!pclean, 'could not find DWP_clean — the three panel copies may be back');
  ok('…and RUNNING it keeps a title\'s own hyphen while still dropping the real prefix',
     !!pclean && pclean('LukHash - 8-Bit Warrior') === '8-Bit Warrior'
     && pclean('Artist - 8-Bit Warrior') === '8-Bit Warrior'
     && pclean('LukHash - GLITCH - 02 DOOMSDAY') === 'DOOMSDAY'
     && pclean('LukHash - GHOSTS - 05 TAKE CONTROL') === 'TAKE CONTROL',
     pclean ? [pclean('LukHash - 8-Bit Warrior'), pclean('Artist - 8-Bit Warrior'),
               pclean('LukHash - GLITCH - 02 DOOMSDAY')].join(' | ') : 'no function');
  /* the ungated form must be gone from CODE. Scoped past the comment block
     that explains it, for the same reason as the two checks above — and it
     falls back to the WHOLE file when the cleaner is absent, so a missing
     DWP_clean cannot turn this into a vacuous zero (which is exactly what it
     did on the first run against the pre-fix source: the scope was empty and
     the check went green while three ungated copies sat in the file). */
  const iC = pan.indexOf('const DWP_clean');
  const code = iC > -1 ? pan.slice(iC) : pan;
  ok('no ungated copy of the strip survives in the panels file',
     !/replace\(\/\^\[\^-\]\+-\\s\*\//.test(code),
     'a strip that needs no space before the hyphen eats the 8 out of 8-Bit Warrior on whichever panel still carries it');
  ok('…control: the SPACED form is the one present, at least once',
     /replace\(\/\^\[\^-\]\+ - \//.test(code),
     'the file has no cleaner at all, which is not what the zero above is claiming');
  ok('all three panel sites call the shared cleaner, by name',
     /DWP_clean\(t\.name\)/.test(pan)          /* position: the exit-point strip */
     && /const clean = DWP_clean;/.test(pan)   /* transition: both deck rows */
     && /DWP_clean\(DWP_EW\.name\[i\]\)/.test(pan),   /* energy window: handover ticks */
     'a panel is still cleaning titles its own way — and it is the copies, not the shape, that ledger 104 is about');
}

console.log('\n── the energy window, across a hidden-page hole ─────────────');
/* tick() is called from paint(), and a HIDDEN page runs sample() without
   paint() — so the buffer stops while the tab is backgrounded and the panel
   used to join the two ends with a straight line through minutes nothing
   measured (ledger 87's shape). Driven here on a fake clock: the level area
   is filled once per unbroken run, so counting fill() counts the runs. */
{
  const realNow = global.performance.now;
  const base = Date.now() + 1e8;          /* above any real sample already in the ring */
  let T_NOW = base;
  global.performance.now = () => T_NOW;
  const EW = { vu: { L: .5, R: .5 }, now: { energy: .5, name: 'A - B - 01 X' },
               freq: null, set: [], state: DWstate };
  const push = at => { T_NOW = at; window.DWPANELS.tick(EW); };
  const fills = () => {
    const c = ctx(); let n = 0; c.fill = () => { n++; };
    window.DWPANELS.get('energy15').draw(c, 320, 200, Tk, EW);
    return n;
  };
  [0, 2000, 4000, 6000, 8000, 10000].forEach(d => push(base + d));
  const contiguous = fills();
  ok('control: an unbroken history draws the level area as ONE filled run',
     contiguous === 1, 'fills ' + contiguous + ' — the counter is not measuring what the check below reads');
  [64000, 66000, 68000].forEach(d => push(base + d));   /* a 54 s hole */
  const broken = fills();
  ok('a gap wider than two sample intervals LIFTS THE PEN instead of bridging it',
     broken === 2,
     'fills ' + broken + ' — a straight line is drawn across a hidden-page gap, and it looks exactly like measured data');

  /* UI WALK DECISION 8, 2026-10-09 (§8.12b): the five energy windows are
     ONE panel with a window selector. The ids stay, so the stored world
     (dw-slots-v1, saved views, exported views files) needs no migration —
     these checks pin that, and that the merge kept the honesty caption
     word for word in every window (review Part 2 §9). The first three
     fail on 3028ca0, where the swap menu lists all five. */
  const EIDS = ['energy15', 'energy30', 'energy45', 'energy60', 'energy90'];
  const menuE = P.list().filter(x => /^energy\d+$/.test(x.k));
  ok('the swap menu lists the energy windows ONCE (got ' + menuE.length + ')',
     menuE.length === 1 && menuE[0].n === 'energy history', JSON.stringify(menuE));
  ok('…every old id still resolves, so a stored view or slot naming one loads (no migration)',
     EIDS.every(id => P.has(id) && typeof P.get(id).draw === 'function') && P.all && EIDS.every(id => P.all().includes(id)),
     'a saved view naming energy60 would load a blank cell — the review\'s risk (1)');
  const vs = P.variants ? P.variants('energy60') : [];
  ok('…and the cell offers all five windows, in order, from any member',
     vs.map(v => v.k).join() === EIDS.join() && vs.map(v => v.n).join() === '15 min,30 min,45 min,60 min,90 min'
     && P.variants('energy15').length === 5,
     JSON.stringify(vs));
  ok('control: a panel with no family offers no window choice (variants of spectrum = 1)',
     P.variants && P.variants('spectrum').length === 1 && P.list().some(x => x.k === 'spectrum'),
     'the selector would appear on every cell');
  const capOf = id => { texts.length = 0; P.get(id).draw(ctx(), 320, 200, Tk, EW); return texts.slice(); };
  const capBad = EIDS.filter(id => { const t = capOf(id);
    return !t.includes('energy = constructed index · level = relative') || !t.includes('−' + id.slice(6) + ' min'); });
  ok('every window still prints the honesty caption VERBATIM and its own span',
     capBad.length === 0 && capOf('energy15').length > 0, 'missing in: ' + capBad.join(', '));
  global.performance.now = realNow;
}
{
  /* the dashboard half: the selector is the cell's, the menu marks the
     family, and the glossary audit reads every id (list() would report
     four energy entries as naming no panel). Source checks — the slot is
     DOM and this sandbox does not mount it; the keeper's glance is the
     rest. */
  const paintSrc = (dashSrc.split('function paint(slot) {')[1] || '').split('function help(slot)')[0];
  ok('a slot paints its window selector from DWPANELS.variants and hides it for a single panel',
     /P\.variants\(slot\.panel\)/.test(paintSrc) && /slot\.pvar\.hidden = vars\.length < 2/.test(paintSrc)
     && /class="pvar"/.test(dashSrc) && /slot\.pvar\.onchange/.test(dashSrc),
     'no selector — the merged panel would be stuck on its first window');
  ok('…the swap menu marks the family on, and re-picking it keeps the cell\'s window',
     /class="\$\{same\(x\.k\) \? 'on' : ''\}"/.test(paintSrc) && /if \(!same\(el\.dataset\.k\)\) slot\.panel = el\.dataset\.k/.test(paintSrc),
     'choosing "energy history" on a 60-min cell would snap it to 15');
  const aud = (dashSrc.split('function audit() {')[1] || '').split('DWDASH.glossaryAudit')[0];
  ok('…and the glossary audit counts every id, not the folded menu',
     /window\.DWPANELS\.all\(\)/.test(aud), 'the console would warn that energy30–90 name no panel');
}

console.log('\n── the glossary, the links, and the boot gate ──────────────');
{
  const dash = fs.readFileSync('assets/deckwave-dashboard.js', 'utf8').replace(/\r\n/g, '\n');
  const msg = fs.readFileSync('assets/deckwave-messages.js', 'utf8').replace(/\r\n/g, '\n');
  const html = fs.readFileSync('index.html', 'utf8').replace(/\r\n/g, '\n');

  /* the fixed set-arc strip is not a slot, so glossaryBind's PANEL map never
     reached it — and it carries the one "energy" on screen with no hover
     saying CONSTRUCTED */
  ok('the set-arc strip label carries a glossary tag',
     /<u data-gl="energy">set arc/.test(dash),
     'the word "energy" appears on screen with no hover saying it is a constructed index (45% loudness, 25% brightness, 30% tempo, weights chosen not fitted)');
  ok('…control: "energy" resolves to a term, so the tag is not a dead key',
     !!(global.DWMSG && global.DWMSG.term('energy')),
     'the tag names a key DWMSG cannot resolve, so show() bails and the hover does nothing');

  ok('no glossary link carries a doubled Special:Search',
     !/Special:Search\?search=Special:Search/.test(msg),
     'the link opens a Wikipedia search FOR THE STRING "Special:Search?search=…" and finds nothing — five of them shipped');
  ok('…control: the file still uses Wikipedia search links, as its header promises',
     (msg.match(/Special:Search\?search=/g) || []).length > 20,
     'there are no search links to be wrong, so the zero above says nothing');

  ok('DWMSG no longer claims a translator can replace the whole interface',
     /TERMS, not UI/.test(msg) && /`ui\.verified` and `ui\.unverified`/.test(msg),
     'the header promises translatability the transport does not deliver: 28 of the 30 ui.* strings are read by nothing and every button label is a literal in its own module');

  /* THE BOOT GATE, both directions. */
  const need = (html.match(/const need = \[([\s\S]*?)\];/) || [])[1] || '';
  const needList = (need.match(/'([A-Z0-9]+)'/g) || []).map(s => s.replace(/'/g, ''));
  const srcs = (html.match(/<script src="assets\/[^"]+"><\/script>/g) || [])
    .map(s => (s.match(/assets\/([^"]+)/) || [])[1]);
  const defines = {};
  srcs.forEach(f => { let t = ''; try { t = fs.readFileSync('assets/' + f, 'utf8'); } catch (e) { return; }
    (t.match(/^(?:window|root)\.(DW[A-Z]*) *=/gm) || []).forEach(d =>
      { defines[d.replace(/^(?:window|root)\./, '').replace(/ *=$/, '')] = f; }); });
  const orphan = needList.filter(k => !defines[k]);
  ok('the boot gate requires no global that no loaded script defines',
     orphan.length === 0,
     'the page refuses to start over ' + orphan.join(', ') + ' — a module it no longer loads, or never used');
  /* and the other way: a loaded deckwave-X.js that hangs DWX must be gated,
     or a failed request shows no failed-to-load screen and simply makes a
     button do nothing later */
  const ungated = srcs.filter(f => /^deckwave[-.]/.test(f)).map(f => {
    const g = 'DW' + f.replace(/^deckwave-?/, '').replace(/\.js$/, '').replace(/-/g, '').toUpperCase();
    return (defines[g] === f && needList.indexOf(g) < 0) ? g : null;
  }).filter(Boolean);
  ok('every synchronously loaded module that hangs its own global is IN the gate',
     ungated.length === 0,
     'missing from need: ' + ungated.join(', ') + ' — a failed request for one of these shows no failed-to-load screen, it just makes a control do nothing an hour later');
  ok('…control: the gate is being read at all (DWLOOP and DWDASH are in it)',
     needList.indexOf('DWLOOP') > -1 && needList.indexOf('DWDASH') > -1,
     'the need list did not parse, so both checks above are vacuous');
  /* SCRIPT TAGS again, not the bare names: the comment where the two tags
     used to be explains why they went, and matching the name scored the
     explanation as the defect. */
  ok('the two modules with no callers are no longer shipped on every page',
     srcs.indexOf('deckwave-visuals.js') < 0 && srcs.indexOf('deckwave-tags.js') < 0,
     'DWV and DWTAGS are fetched, parsed and executed on every load and called by nothing (ROADMAP R7b)');
  ok('…control: the modules that ARE used are still loaded',
     srcs.indexOf('deckwave-loop.js') > -1 && srcs.indexOf('deckwave-panels.js') > -1
     && srcs.indexOf('deckwave-events.js') > -1,
     'the script list did not parse, so the zero above says nothing');
}

console.log('\n── the lows the review listed for the dashboard ─────────────');
{
  const dash = fs.readFileSync('assets/deckwave-dashboard.js', 'utf8').replace(/\r\n/g, '\n');
  /* the compact line: the inline style is '' until compact is pressed once,
     so `nl.style.display !== 'none'` was TRUE on a page that had never been
     compact, and this innerHTML ran every frame against a hidden element */
  const nlBlock = (dash.split("const nl = $('nowline');")[1] || '').slice(0, 600);
  ok('the compact line is written only when SHOWN and only when it CHANGES',
     /app\.classList\.contains\('mini'\)/.test(nlBlock) && /!== nl\.__dwLine/.test(nlBlock),
     'an innerHTML rebuild 60x a second against an element the stylesheet is hiding — ledger 94/124\'s shape');

  ok('dash.ro is the real ResizeObserver, not a name nothing sets',
     /\n    ro,/.test(dash) && /if \(dash\.ro\) dash\.ro\.observe/.test(dash),
     'slots.build() ends every cell with `if (dash.ro) dash.ro.observe(d)` and dash.ro is undefined — a mechanism named in code and absent from it');

  /* views: a file with a non-array `panels` was stored on the strength of the
     format field alone, and the throw came later, inside slots.build(), on
     the line that SELECTS the view — which is in no try. Ledger 115's shape:
     a control that does nothing and says nothing. */
  ok('a views import REFUSES a view with no panel list, with a sentence',
     /const validView = v =>/.test(dash) && /no panel list/.test(dash),
     'the import stores anything under `views` and the failure surfaces later as an uncaught throw with no message on screen');
  ok('…and selecting a view says so when it cannot be loaded',
     /has no panel list — not loaded/.test(dash),
     'load() returns null and the caller logs `view: <name>` regardless, so the press produces no panels and no explanation');
}


console.log('\n── the control budget (UI walk decision 5) ─────────────────');
/* UI WALK DECISION 5, 2026-10-09 (§8.17): today's count of bar controls
   outside the ⚙ drawer becomes a CEILING — a commit that adds one to the bar
   without removing one fails here. The review (Part 4) found a DOM count
   cannot run in this sandbox, so this counts SOURCE SITES in the dashboard:
     · every btn(...) call — group = its 4th argument, else GRP.deck (btn's
       default), overridden by a later `<name>.dataset.grp = GRP.x`;
     · every select(...) call — group = its 5th argument, else GRP.cfg;
     · every hand-built element given a non-cfg bar group with
       `.dataset.grp = GRP.x` that is not one of the above (the set menu,
       the level slider) — minus NOT_CONTROLS, labels that take no input.
   A control is outside the drawer when its group is not GRP.cfg. The number
   is a ceiling on SOURCE, not a measure of what a desktop shows: the phone's
   ☰ set and the contextual re-link both count, and are hidden on a desktop.
   What it cannot see: a control appended to the bar by a route that sets no
   group, or one created in another file. Lower the ceiling freely; raising
   it is the keeper's call, which is the whole point of the gate. */
{
  const CEILING = 23;   /* MEASURED 2026-10-14 by this counter on adccea4 */
  const NOT_CONTROLS = ['smark'];
  const src = dashSrc;
  /* the GRP literal, read from the source (comments stripped): since
     2026-10-21 a group whose VALUE starts with `cfg/` is a SECTION of the
     drawer, and bare `cfg` is the drawer with no section, which no site
     may use any more (checked below). "In the drawer" means either. */
  const grpLit = ((src.match(/const GRP = \{([\s\S]*?)\};/) || [])[1] || '').replace(/\/\*[\s\S]*?\*\//g, '');
  const GRPVAL = {};
  for (const m of grpLit.matchAll(/(\w+):\s*'([^']*)'/g)) GRPVAL[m[1]] = m[2];
  const drawerKey = k => k === 'cfg' || /^cfg\//.test(GRPVAL[k] || '');
  /* the index just past the paren matching the one at `open`, skipping
     strings, templates, comments and regex literals */
  const closeOf = open => {
    let d = 0, i = open, prev = '';
    while (i < src.length) {
      const c = src[i];
      if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); continue; }
      if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 2; continue; }
      if (c === "'" || c === '"' || c === '`') {
        i++; while (i < src.length && src[i] !== c) { if (src[i] === '\\') i++; i++; } i++; prev = c; continue;
      }
      if (c === '/' && /[(,=:[!&|?{};]/.test(prev)) {
        i++; while (i < src.length && src[i] !== '/') { if (src[i] === '\\') i++;
          else if (src[i] === '[') { while (src[i] !== ']') { if (src[i] === '\\') i++; i++; } } i++; }
        i++; prev = '/'; continue;
      }
      if (c === '(' || c === '[' || c === '{') d++;
      else if (c === ')' || c === ']' || c === '}') { d--; if (d === 0) return i + 1; }
      if (!/\s/.test(c)) prev = c;
      i++;
    }
    return -1;
  };
  const sites = [];
  for (const kind of ['btn', 'select']) {
    const re = new RegExp('(?:const|let)?\\s*(\\w+\\s*=\\s*)?(?<![\\w.$])' + kind + '\\(', 'g');
    let m;
    while ((m = re.exec(src))) {
      const open = m.index + m[0].length - 1;
      if (/function\s+select\s*$/.test(src.slice(Math.max(0, open - 20), open))) continue;   /* the definition */
      const end = closeOf(open);
      const call = src.slice(open, end);
      const label = (call.match(/^\(\s*'([^']*)'/) || [])[1] || (call.match(/^\(\s*([^,]{0,40})/) || [])[1];
      const tail = call.match(/,\s*GRP\.(\w+)\s*\)$/);
      let grp = tail ? tail[1] : (kind === 'btn' ? 'deck' : 'cfg');
      const name = m[1] ? m[1].replace(/\s*=\s*$/, '') : null;
      if (name) { const re2 = new RegExp('\\b' + name + '\\.dataset\\.grp = GRP\\.(\\w+)'); const r2 = src.slice(end).match(re2); if (r2) grp = r2[1]; }
      sites.push({ kind, label, name, grp, end });
    }
  }
  const named = new Set(sites.map(s => s.name).filter(Boolean));
  const hand = [...src.matchAll(/\b(\w+)\.dataset\.grp = GRP\.(\w+)/g)]
    .filter(m => !named.has(m[1]) && m[1] !== 's' && !drawerKey(m[2]))
    .map(m => ({ kind: 'hand', label: m[1], name: m[1], grp: m[2] }));
  const all = sites.concat(hand);
  const find = l => all.find(s => s.label === l || s.name === l);
  const btnText = (src.match(/(?<![\w.$])btn\('/g) || []).length;
  const selText = (src.match(/(?<![\w.$])select\('/g) || []).length;
  /* CONTROLS — the counter is only worth its number if it classifies the
     sites it can be checked against: every literal btn(' and select(' it
     can see in the text, and seven whose group is known by reading the line. */
  ok('the counter finds every btn(\'…\') and select(\'…\') call the text holds (' + btnText + ' + ' + selText + ')',
     btnText > 0 && sites.filter(s => s.kind === 'btn').length === btnText
     && selText > 0 && sites.filter(s => s.kind === 'select').length === selText,
     'found ' + sites.filter(s => s.kind === 'btn').length + ' btn + ' + sites.filter(s => s.kind === 'select').length
     + ' select sites — the paren matcher lost its place');
  const known = { 'scan': 'deck', 'pause': 'play', 'reset audio engine': 'trouble', 'register colour: off': 'look',
                  '▾ save cache': 'files', 'layout': 'look', 'setMenu': 'files' };
  const wrong = Object.keys(known).filter(l => !find(l) || find(l).grp !== known[l]);
  ok('…and classifies seven known sites correctly (default group, 4th arg, reassignment, select 5th arg, hand-built)',
     wrong.length === 0, 'misclassified: ' + wrong.map(l => l + '=' + (find(l) ? find(l).grp : 'MISSING')).join(', '));
  ok('every NOT_CONTROLS entry names a hand-built element that exists (a guard naming nothing present is untested)',
     NOT_CONTROLS.every(n => new RegExp('\\b' + n + '\\.dataset\\.grp = GRP\\.').test(src)),
     'an exemption for an element the source no longer builds');
  const bar = all.filter(s => !drawerKey(s.grp) && !NOT_CONTROLS.includes(s.name));
  console.log('        bar controls outside the drawer: ' + bar.length + ' — '
    + bar.map(s => s.label || s.name).join(' · '));
  ok('bar controls outside the ⚙ drawer: ' + bar.length + ' ≤ ceiling ' + CEILING,
     bar.length <= CEILING,
     'a control was added to the bar without one leaving it — the keeper set this ceiling at the walk (decision 5)');

  /* THE DRAWER HAS SECTIONS (2026-10-21). UI review Part 5 §5 sent the
     engine reset to "Settings › Troubleshoot" and walk decision 2 sent
     compact to "Settings › Look"; both named sections the drawer did not
     have. What these can fail on: a GRP literal with no cfg/ sections; a
     section regroup() never lays out (its controls would fold behind the
     drawer with no heading and no place); a btn/select site left in bare
     cfg (sectionless — at runtime it lands last under "other" with a
     console warning, and this refuses the source); compact anywhere but
     look, the reset anywhere but troubleshoot; applyCfg still matching
     data-grp="cfg" exactly (a sectioned control would never hide); the
     drawer button still reading "display" when it holds tune, settle,
     output and phone (finding 9). All seven shown failing on e78349b
     through DECKWAVE_DASH_SRC. What they cannot see: where a heading lands
     on screen, or whether the open drawer still wraps sanely at 1550 px and
     at 400 px — that is a browser look, written into the ledger. */
  const sections = Object.keys(GRPVAL).filter(k => /^cfg\//.test(GRPVAL[k]));
  ok('GRP declares the drawer\'s sections as cfg/-prefixed groups, look and troubleshoot among them',
     sections.length >= 2 && GRPVAL.look === 'cfg/look' && GRPVAL.trouble === 'cfg/troubleshoot',
     'sections found: ' + JSON.stringify(sections));
  const orderSrc = ((src.split('function regroup() {')[1] || '').match(/const order = \[([\s\S]*?)\];/) || [])[1] || '';
  const laidOut = [...orderSrc.matchAll(/GRP\.(\w+)/g)].map(m => m[1]);
  ok('regroup() lays out every declared section, after the four bar groups',
     sections.length > 0 && sections.every(k => laidOut.includes(k)) && laidOut.slice(0, 4).join() === 'deck,play,files,cap',
     'order: ' + laidOut.join(',') + ' — a section missing here folds behind the drawer and is placed nowhere');
  const bare = all.filter(s => s.grp === 'cfg');
  ok('no btn/select site is left in the bare cfg group — every drawer control names its section',
     sections.length > 0 && bare.length === 0, 'sectionless: ' + bare.map(s => s.label || s.name).join(' · '));
  const cmp = find('– compact'), rst = find('reset audio engine');
  ok('compact is under look (walk decision 2) and the engine reset under troubleshoot (Part 5 §5)',
     !!cmp && cmp.grp === 'look' && !!rst && rst.grp === 'trouble',
     'compact=' + (cmp || {}).grp + ' reset=' + (rst || {}).grp);
  ok('applyCfg folds by the cfg/ prefix (inDrawer), not by an exact data-grp="cfg" match',
     /function applyCfg\(\) \{[\s\S]*?inDrawer\(el\.dataset\.grp\)/.test(src) && !/\[data-grp="' \+ GRP\.cfg \+ '"\]/.test(src),
     'a sectioned control would never fold behind ⚙');
  ok('regroup() heads each section with a .sech label that is a span, and the CSS styles it',
     /const h = document\.createElement\('span'\);\s*h\.className = 'sech'/.test(src) && /\n\.sech\{/.test(src),
     'headings missing, not spans, or unstyled');
  ok('the drawer button reads ⚙ settings and the word "display" has left its label',
     /btn\('⚙ settings'/.test(src) && /'⚙ settings ▴'/.test(src) && !/⚙ display/.test(src),
     'the drawer holds tune, settle, output and phone — "display" is the wrong word for it (finding 9)');
}

console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') + ' of ' + checks + ' checks');
process.exit(fails ? 1 : 0);
