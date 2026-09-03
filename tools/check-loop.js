/* Does assets/deckwave-loop.js keep the contract every panel is written to?

   DWLOOP is the rAF bundle. It is the single place the tree agrees on what a
   frame IS: eight colours in `T`, twenty facts in `D`, one `sample()` for a
   hidden page, and the rule that a panel which throws is STASHED rather than
   swallowed. `docs/PROMPTS.md` §1 hands those counts to an LLM as the
   authoritative list of what a tile may read, `assets/panel-centre.js` is
   written against them, and DWPHONE's lock-screen art calls `sample()`
   directly because rAF does not run behind a lock.

   And until 2026-09-03 nothing tested it. It was one of six assets with no
   harness beyond check-panels' `vm.Script` sweep, which proves only that the
   file parses (review, Harnesses). A `D` that quietly grew a 21st entry, or a
   `sample()` that painted, or a swallowed panel error, would all have shipped
   green.

   HOW. The IIFE is compiled with vm.Script (a text harness cannot see a
   broken parse — ledger 111) and then run in a context holding a fake
   window, a fake analyser, a fake rAF that QUEUES rather than fires, and a
   fake dashboard whose panels can be told to throw. Nothing here touches a
   browser, a canvas or the audio clock.

   The hidden-page half is the interesting one and it is tested by ABSENCE:
   after stop(), no queued frame is ever run, so any paint that happens is
   one sample() made, and the paint counters say so.

   WHAT THIS DOES NOT ESTABLISH: that anything is drawn correctly (no
   canvas), that the analyser numbers are right (they are invented here), or
   that rAF timing on a real page matches this. It pins the CONTRACT.

   Set DECKWAVE_LOOP_SRC to run it against another copy of the module — that
   seam is how each check below was watched failing against a deliberately
   broken one before it was kept.

       node tools/check-loop.js
*/
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const REPO = path.resolve(__dirname, '..');
const SRC = process.env.DECKWAVE_LOOP_SRC || path.join(REPO, 'assets', 'deckwave-loop.js');

let fails = 0, checks = 0;
const ok = (name, cond, falsifier) => {
  checks++;
  if (!cond) { fails++; console.log('  FAIL  ' + name + '\n        falsifier hit: ' + falsifier); }
  else console.log('  pass  ' + name);
};

/* NOTHING BELOW MAY BE ALLOWED TO THROW OUT OF THE HARNESS.
   Measured while building this: with the module deliberately broken, five of
   the mutations killed check-loop with an uncaught TypeError instead of
   printing a FAIL — and a harness that dies never prints the
   `all passed of N checks` line at all, so the sweep that counts the tree's
   checks scores it ZERO and says nothing (ledger 110's exact shape, arriving
   from the other direction). Every call into the module under test goes
   through these two, so a broken module produces failed CHECKS. */
const safe = (fn) => { try { return { ok: true, v: fn() }; }
                       catch (e) { return { ok: false, v: null, err: (e && e.message) || String(e) }; } };
const run = (fn) => safe(fn).v;

const src = fs.readFileSync(SRC, 'utf8').replace(/\r\n/g, '\n');

/* ── 1. it is a program at all ──────────────────────────────────────────── */
console.log('── the module ──────────────────────────────────────────────────');
let script = null, parseErr = null;
try { script = new vm.Script(src, { filename: 'deckwave-loop.js' }); }
catch (e) { parseErr = (e && e.message) || String(e); }
ok('deckwave-loop.js COMPILES (a text check cannot see a SyntaxError)',
   script !== null, 'parse failed: ' + parseErr);
if (!script) {
  console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') + ' of ' + checks + ' checks');
  process.exit(1);
}

/* ── the harness's fake world ───────────────────────────────────────────── */
function makeWorld(opts) {
  opts = opts || {};
  const cssVars = Object.assign({
    '--bg': '#000', '--line': '#111', '--dim': '#222', '--ac': '#0ff',
    '--ac2': '#f0f', '--bad': '#f00', '--fn': 'monospace', '--glow': '2',
  }, opts.cssVars || {});
  if (opts.dropGlow) delete cssVars['--glow'];

  const counts = { timeReads: 0, freqReads: 0, paints: 0, fixed: 0, header: 0,
                   nowplaying: 0, renderList: 0, tick: 0, draws: {} };
  const headerArgs = [];

  const analyser = {
    fftSize: 16, frequencyBinCount: 16,
    getByteTimeDomainData(a) { counts.timeReads++; for (let i = 0; i < a.length; i++) a[i] = 128; },
    getByteFrequencyData(a) { counts.freqReads++; for (let i = 0; i < a.length; i++) a[i] = (counts.freqReads * 7 + i * 3) % 256; },
  };

  const state = { idx: 0, now: true, tempo: 120 };
  const DW = {
    Player: { analyser: opts.noAnalyser ? null : analyser },
    state, elapsed: 12, blend: null,
    nowMeta: opts.nowMeta === undefined ? { name: 'A' } : opts.nowMeta,
    nextMeta: { name: 'B' }, deck: { rate: 1.04, meta: { name: 'A' } },
    nextDeck: { rate: 1.0 }, prevDeck: null,
  };

  const slot = (panel, o) => Object.assign({
    panel, err: null, ctx: {},
    el: { classList: { contains: () => false } },
    canvas: { getBoundingClientRect: () => ({ width: 100, height: 60 }) },
  }, o || {});

  const dash = {
    host: {}, shadow: { getElementById: () => null },
    set: [{ name: 'A' }, { name: 'B' }],
    slots: { slots: [slot('scope'), slot('spec')] },
    stereoSource: () => null,
    drawFixed(T, D) { counts.fixed++; if (opts.fixedThrows) throw new Error('fixed boom'); },
    header(n) { counts.header++; headerArgs.push(n); },
    renderList() { counts.renderList++; },
    elapsed: 12,
  };

  const frames = [];
  const panels = {
    tick() { counts.tick++; },
    get(name) {
      return {
        draw() {
          counts.paints++;
          counts.draws[name] = (counts.draws[name] || 0) + 1;
          if (opts.throwingPanel === name) throw new Error(name + ' boom');
        },
      };
    },
  };

  const win = {
    DW, DWPANELS: panels,
    DWVU: { feed() {}, state: { l: 0, r: 0 } },
    DWSTEREO: () => ({ rmsL: 0, rmsR: 0 }),
    DWNOWPLAYING: { update() { counts.nowplaying++; } },
  };

  let clock = 1000;
  const sandbox = {
    window: win, console,
    performance: { now: () => (clock += 16.7) },
    requestAnimationFrame: (fn) => { frames.push(fn); return frames.length; },
    cancelAnimationFrame: () => {},
    getComputedStyle: () => ({ getPropertyValue: (k) => (cssVars[k] === undefined ? '' : cssVars[k]) }),
  };
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  script.runInContext(sandbox);
  return { L: win.DWLOOP, win, dash, DW, counts, headerArgs, frames, cssVars, analyser };
}

/* ── 2. the shape of the module ─────────────────────────────────────────── */
const bootRes = safe(() => makeWorld());
ok('the IIFE RUNS in a bare context (no document, no real window)',
   bootRes.ok, 'it threw at load: ' + bootRes.err);
const w = bootRes.v || { L: null, counts: { draws: {} }, frames: [], DW: {}, dash: {} };
const L = w.L || {};
ok('window.DWLOOP exists after the IIFE runs', !!w.L, 'no DWLOOP on window');
ok('it exposes start, stop, errors, sample, last, running',
   L && ['start', 'stop', 'errors', 'sample'].every((k) => typeof L[k] === 'function')
     && 'last' in L && 'running' in L,
   'the surface DWPHONE and the popout call is not all there: ' + (L ? Object.keys(L).join(',') : '-'));

console.log('\n── before a loop has ever run ──────────────────────────────────');
ok('DWLOOP.last is null before start()', run(() => L.last) === null,
   'a caller reads a bundle that no frame built');
{
  const pre = safe(() => L.sample());
  ok('DWLOOP.sample() returns null before start(), it does not throw',
     pre.ok && pre.v === null,
     pre.ok ? 'returned ' + JSON.stringify(pre.v)
            : 'the hidden-page caller gets an exception instead of an answer: ' + pre.err);
}
ok('DWLOOP.running is false before start()', run(() => L.running) === false, 'running with no rAF');

/* ── 3. one frame ───────────────────────────────────────────────────────── */
console.log('\n── start(): one frame, and the bundle it builds ────────────────');
const startRes = safe(() => L.start(w.dash));
const started = startRes.v;
ok('start() does not throw on a well-formed dashboard', startRes.ok,
   'start() threw: ' + startRes.err);
ok("start() returns 'running'", started === 'running', 'returned ' + JSON.stringify(started));
ok('DWLOOP.running is true after start()', L.running === true, 'no frame was scheduled');
ok('exactly one frame is queued (rAF is not called twice per frame)',
   w.frames.length === 1, 'queued ' + w.frames.length);
const b0 = run(() => L.last) || { T: {}, D: {} };
ok('DWLOOP.last is the bundle that frame built', !!(b0.T && b0.D && b0.D.state),
   'last is ' + JSON.stringify(Object.keys(b0)));

const D_KEYS = ['wave', 'freq', 'set', 'state', 'L', 'R', 'stereo', 'vu', 'hits',
                'flux', 'hit', 'transLeft', 'blend', 'elapsed', 'now', 'next',
                'prev', 'prevRate', 'deck', 'nextDeck'];
const T_KEYS = ['bg', 'line', 'dim', 'ac', 'ac2', 'bad', 'fn', 'g'];
const dk = Object.keys(b0.D).sort(), tk = Object.keys(b0.T).sort();
ok('the render bundle D has exactly 20 entries (PROMPTS §1, ROADMAP)',
   dk.length === 20, 'D has ' + dk.length + ': ' + dk.join(','));
ok('...and they are exactly the twenty documented names',
   dk.join(',') === D_KEYS.slice().sort().join(','),
   'D drifted from the list a tile spec is written against: ' + dk.join(','));
ok('T has exactly 8 entries, the documented names',
   tk.length === 8 && tk.join(',') === T_KEYS.slice().sort().join(','),
   'T is ' + tk.join(','));

/* ── 4. T.g, the glow helper ────────────────────────────────────────────── */
console.log('\n── T.g(): the glow helper is a multiplier, never NaN ───────────');
{
  const c = {};
  run(() => b0.T.g(c, '#abc', 10));
  ok('T.g scales shadowBlur by --glow (2 x 10 = 20) and sets the colour',
     c.shadowBlur === 20 && c.shadowColor === '#abc',
     'blur ' + c.shadowBlur + ' colour ' + c.shadowColor);
}
{
  /* A whole second instance with no --glow at all. Deliberately agnostic
     about WHERE the value is read: per call, once per bundle, or once at
     start() all give 1 here, so this survives the optimisation it was
     written beside without asserting it. */
  const w2 = safe(() => makeWorld({ dropGlow: true })).v || { L: {}, dash: {} };
  run(() => w2.L.start(w2.dash));
  const c = {};
  run(() => w2.L.last.T.g(c, '#abc', 10));
  ok('with --glow unset the factor is 1, not NaN (a NaN blur draws nothing)',
     c.shadowBlur === 10, 'blur ' + c.shadowBlur);
}

/* ── 5. sample() on a hidden page ───────────────────────────────────────── */
console.log('\n── sample(): a bundle with no frame, and no painting ───────────');
{
  run(() => L.stop());
  ok('stop() clears running', run(() => L.running) === false, 'still running after stop()');
  const paintsBefore = w.counts.paints, fixedBefore = w.counts.fixed;
  const freqBefore = w.counts.freqReads;
  const s1 = run(() => L.sample());
  ok('sample() still answers after stop() — this is the locked-phone path',
     !!(s1 && s1.D), 'sample() returned ' + JSON.stringify(s1));
  ok('sample() PAINTS NOTHING (no panel draw, no drawFixed)',
     w.counts.paints === paintsBefore && w.counts.fixed === fixedBefore,
     'paints ' + paintsBefore + '->' + w.counts.paints + ', fixed ' + fixedBefore + '->' + w.counts.fixed);
  ok('sample() ADVANCES the state a frame would (the analyser is re-read)',
     w.counts.freqReads === freqBefore + 1, 'freq reads ' + freqBefore + '->' + w.counts.freqReads);
  ok('DWLOOP.last becomes the bundle sample() just built (same object)',
     s1 !== null && run(() => L.last) === s1, 'last is a different object from the fresh sample');
  ok('no frame was queued by sample() — it is not a loop restart',
     w.frames.length === 1, 'queued ' + w.frames.length);
}

/* ── 6. the deck is TOLD, not inferred (ledgers 33, 40) ─────────────────── */
console.log('\n── the deck facts come from DW, not from set[state.idx] ────────');
{
  const D = () => (run(() => L.sample()) || { D: {} }).D;
  const s = D();
  ok('D.now / D.next / D.deck / D.nextDeck are the engine objects',
     s.now === w.DW.nowMeta && s.next === w.DW.nextMeta
       && s.deck === w.DW.deck && s.nextDeck === w.DW.nextDeck,
     'a panel reading D would name a track the deck is not playing');
  w.DW.prevDeck = { meta: { name: 'OUT' }, rate: 0.93 };
  const s2 = D();
  ok("DW.prevDeck WINS over the loop's own noticing (two handovers in the dark)",
     s2.prev === w.DW.prevDeck.meta && s2.prevRate === 0.93,
     'prev ' + JSON.stringify(s2.prev) + ' rate ' + s2.prevRate);
  w.DW.prevDeck = null;
  w.DW.blend = { in: 4.25 };
  ok('D.transLeft is read from DW.blend (the SCHEDULE), not recomputed',
     D().transLeft === 4.25, 'transLeft is not the schedule');
  w.DW.blend = { in: -3 };
  ok('...and it is clamped at 0, never negative',
     D().transLeft === 0, 'a negative countdown reaches every panel');
  w.DW.blend = null;
}

/* ── 7. no source means no signal, not a frozen one ─────────────────────── */
console.log('\n── losing the source drops the buffers ─────────────────────────');
{
  const before = (run(() => L.sample()) || { D: {} }).D;
  ok('control: with an analyser, D.wave and D.freq are populated arrays',
     !!(before.wave && before.wave.length === 16 && before.freq && before.freq.length === 16),
     'no buffers even with a source');
  w.DW.Player.analyser = null;
  const after = (run(() => L.sample()) || { D: {} }).D;
  ok('with the source gone, D.wave and D.freq go NULL (a held frame is a lie)',
     after.wave === null && after.freq === null,
     'the last frame stays in the buffers and every panel keeps drawing it');
  w.DW.Player.analyser = w.analyser;
}

/* ── 8. panel errors are STASHED, never swallowed ───────────────────────── */
console.log('\n── a throwing panel is recorded, and does not take the loop ────');
{
  const w3 = makeWorld({ throwingPanel: 'scope' });
  const r3 = safe(() => w3.L.start(w3.dash));
  ok('a throwing panel does not throw out of start() at all',
     r3.ok, 'the panel error took the whole loop: ' + r3.err);
  const errs = run(() => w3.L.errors(w3.dash)) || [];
  ok('the throwing panel is named by errors(dash)',
     errs.length === 1 && errs[0].panel === 'scope' && /boom/.test(errs[0].err),
     'a dead panel and a working one look identical from outside: ' + JSON.stringify(errs));
  ok('the OTHER panel still drew in the same frame',
     w3.counts.draws.spec === 1, 'one panel throwing skipped the rest');
  ok('the header, the card and the fixed strips still ran',
     w3.counts.header === 1 && w3.counts.nowplaying === 1 && w3.counts.fixed === 1,
     'header ' + w3.counts.header + ' card ' + w3.counts.nowplaying + ' fixed ' + w3.counts.fixed);
}
{
  const w4 = makeWorld({ fixedThrows: true });
  const r4 = safe(() => w4.L.start(w4.dash));
  ok('a throwing drawFixed does not throw out of start() either',
     r4.ok, 'the fixed strips took the whole loop: ' + r4.err);
  ok('a throwing drawFixed is stashed on dash.fixedErr',
     /fixed boom/.test(w4.dash.fixedErr || ''), 'fixedErr is ' + w4.dash.fixedErr);
  ok('...and errors(dash) reports it as (fixed strips)',
     (run(() => w4.L.errors(w4.dash)) || []).some((e) => e.panel === '(fixed strips)'), 'not reported');
  ok('...and the slots, header and card still ran that frame',
     w4.counts.paints === 2 && w4.counts.header === 1 && w4.counts.nowplaying === 1,
     'a throw in the strips skipped the rest of paint(): paints ' + w4.counts.paints);
}

/* ── 9. paint's own contracts ───────────────────────────────────────────── */
console.log('\n── paint(): the arguments and the list refresh ─────────────────');
{
  const w5 = makeWorld();
  run(() => w5.L.start(w5.dash));
  ok('header() is called with ONE argument, a NUMBER (hits.length)',
     w5.headerArgs.length === 1 && typeof w5.headerArgs[0] === 'number',
     'the bundle was passed first and the header printed [object Object]: '
       + JSON.stringify(w5.headerArgs));
  ok('DWPANELS.tick runs per frame, whether or not its panel is on screen',
     w5.counts.tick === 1, 'tick ' + w5.counts.tick);
  ok('renderList runs on the first frame (idx changed from -1)',
     w5.counts.renderList === 1, 'renderList ' + w5.counts.renderList);
  run(() => w5.frames[w5.frames.length - 1]());   // a second frame, same idx
  ok('...and NOT again while state.idx is unchanged',
     w5.counts.renderList === 1, 'the whole list is rebuilt every frame: ' + w5.counts.renderList);
  w5.DW.state.idx = 1;
  run(() => w5.frames[w5.frames.length - 1]());
  ok('...and again the moment state.idx moves',
     w5.counts.renderList === 2, 'renderList ' + w5.counts.renderList);
}
{
  const w6 = makeWorld();
  w6.dash.slots.slots[0].el.classList.contains = () => true;      // collapsed
  run(() => w6.L.start(w6.dash));
  ok('a COLLAPSED slot is not drawn', w6.counts.draws.scope === undefined
       && w6.counts.draws.spec === 1,
     'a folded panel still costs a draw every frame');
  const w7 = makeWorld();
  w7.dash.slots.slots[0].canvas.getBoundingClientRect = () => ({ width: 0, height: 0 });
  run(() => w7.L.start(w7.dash));
  ok('a ZERO-SIZED canvas is not drawn', w7.counts.draws.scope === undefined,
     'drawing into a 0x0 canvas');
}

/* ── 10. the other five uncovered modules: compile only, and say so ─────── */
console.log('\n── the five still without behavioural coverage ─────────────────');
{
  /* check-panels sweeps assets/ for parse errors already. This is narrower and
     louder: these five are NAMED, because naming them is the record that they
     have a parse check and nothing else. deckwave-loop.js left this list on
     2026-09-03; the other five are still on it. */
  const uncovered = {
    'deckwave-cache.js': 'DWCACHE',
    'deckwave-listen.js': 'DWLISTEN',
    'deckwave-render.js': 'DWRENDER',
    'deckwave-tags.js': 'DWTAGS',
    'deckwave-visuals.js': 'DWV',
  };
  const badParse = [], badGlobal = [];
  for (const [f, g] of Object.entries(uncovered)) {
    const p = path.join(REPO, 'assets', f);
    let t = null;
    try { t = fs.readFileSync(p, 'utf8'); } catch (e) { badParse.push(f + ': unreadable'); continue; }
    try { new vm.Script(t, { filename: f }); } catch (e) { badParse.push(f + ': ' + e.message); }
    if (!new RegExp('window\\.' + g + '\\s*=').test(t)) badGlobal.push(f + ' (' + g + ')');
  }
  ok('the five modules with no behavioural harness all COMPILE',
     badParse.length === 0, 'a shipped module has a SyntaxError: ' + JSON.stringify(badParse));
  ok('...and each still hangs its documented global off window',
     badGlobal.length === 0,
     'the boot gate and every caller name a global the file no longer defines: '
       + JSON.stringify(badGlobal));
}

console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') + ' of ' + checks + ' checks');
process.exit(fails ? 1 : 0);
