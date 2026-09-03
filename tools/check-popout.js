/* Does the popout do what it says, without a browser?

   DWPOPOUT owns one popped-out window: any registered panel drawn there
   from DWLOOP's bundles (last on a visible page, sample() on a hidden
   one), or butterchurn in `party` mode off the Player's analyser. Nothing
   here can open a real window or run WebGL: window.open, DWLOOP, DWPANELS,
   DW and butterchurn are fakes, and what IS checked is the plumbing —
   which bundle source is read when, what a panel is handed, that a blocked
   popup or a missing audio graph is a sentence and not a crash, that
   party never loads eagerly, and that close/reopen resets cleanly.
   Every check states its falsifier.

   What it does NOT establish: how anything looks, whether WebGL2 exists,
   or whether a real popup opens — the browser does that (BUILD-LOG Act 33).

       node tools/check-popout.js
*/
const fs = require('fs');
let fails = 0, checks = 0;
const ok = (name, cond, falsifier) => {
  checks++;
  if (!cond) { fails++; console.log('  FAIL  ' + name + '\n        falsifier hit: ' + falsifier); }
  else console.log('  pass  ' + name);
};

const src = fs.readFileSync(process.env.DECKWAVE_POPOUT_SRC || 'assets/deckwave-popout.js', 'utf8').replace(/\r\n/g, '\n');

/* ── fakes ──────────────────────────────────────────────────────────────── */
const ctx2d = new Proxy({}, { get: (t, k) => (k === 'measureText' ? () => ({ width: 1 }) : () => {}), set: () => true });
const makeCanvas = () => ({ width: 0, height: 0, style: {}, getContext() { return ctx2d; } });

let opened = 0, blocked = false;
/* The POPPED-OUT window's own device-pixel ratio, and the canvases it hands
   out. Both exist because the drawing code runs in the OPENER: a projector on
   a second screen has its own ratio and the opener's is the wrong one to
   read. Default 1 so the older checks below see the sizes they always saw. */
let winDpr = 1;
const canvases = [];
const rafs = [];                              /* the popout window's own rAF queue */
function makeWin() {
  const doc = { title: '', listeners: {},
    body: { style: {}, appendChild() {} },
    addEventListener(k, fn) { (this.listeners[k] = this.listeners[k] || []).push(fn); },
    fire(k) { (this.listeners[k] || []).forEach(f => f()); },
    createElement(tag) { if (tag !== 'canvas') return { style: {} };
      const c = makeCanvas(); canvases.push(c); return c; } };
  return { closed: false, innerWidth: 800, innerHeight: 450, document: doc,
    devicePixelRatio: winDpr, opener: global,
    requestAnimationFrame(fn) { rafs.push(fn); return rafs.length; },
    close() { this.closed = true; } };
}
const runFrame = () => { const fn = rafs.pop(); rafs.length = 0; if (fn) fn(); };

const drawn = [];
let panelThrows = false;
const PANELS = { journey: 1, spectrum: 1 };
global.DWPANELS = {
  has: id => id in PANELS,
  get(id) { return id in PANELS ? { id, draw(c, w, h, T, D) {
    drawn.push({ id, w, h, now: D.now }); if (panelThrows) throw new Error('panel boom'); } } : undefined; },
  list: () => Object.keys(PANELS).map(k => ({ k, n: k, hint: '' }))
};

let lastReads = 0, sampleCalls = 0;
const meta = { name: 'LukHash - TEST', bpm: 120, camelot: '8A' };
const bundle = () => ({ T: { bg: '#000', ac: '#0ff', dim: '#777', line: '#333', fn: 'x' },
                        D: { now: meta, set: [meta] } });
global.DWLOOP = { get last() { lastReads++; return bundle(); }, sample() { sampleCalls++; return bundle(); } };

global.DW = { Player: { analyser: null } };   /* no audio graph until a test grants one */

const scriptsLoaded = [];
global.window = global;
global.document = { visibilityState: 'visible', head: { appendChild(s) { scriptsLoaded.push(s.src); if (s.onerror) s.onerror(); } },
  createElement() { return { style: {} }; } };
global.performance = { now: () => nowMs };
let nowMs = 1000;
let curWin = null;
global.open = () => { opened++; return blocked ? null : (curWin = makeWin()); };

eval(src);
const P = window.DWPOPOUT;

(async () => {
  console.log('\n── projector: a panel in its own window ─────────────────────');
  ok('the module loads with mode off and no window', P.mode === 'off' && P.status.open === false,
     'a popout opened at load — nothing may open a window without the user');

  ok('a CLOSED popout advertises no panel — `showing` is null',
     P.showing === null,
     'DWLOOP suppresses a slot whose panel the popout says it is showing; a stale non-null here would blank a dashboard tile with no window open');

  const r1 = await P.set('journey');
  ok('set(panel) opens the window and says where it went', opened === 1 && P.status.open === true && /projector: journey/.test(r1), r1);
  ok('the projector drops the handle back to this page (win.opener = null)',
     curWin.opener === null,
     'opener is ' + typeof curWin.opener + ' — the window never navigates and runs no script of its own, so it has no use for a reference to the page holding the audio graph');
  ok('an OPEN projector names the panel it is advancing',
     P.showing === 'journey',
     'showing is ' + JSON.stringify(P.showing) + ' — DWLOOP cannot tell which slot to leave alone, so a stateful panel (polygraph ring, jam spin, history feed) steps twice per frame');
  runFrame();
  ok('a frame draws the panel from DWLOOP.last on a visible page',
     drawn.length === 1 && drawn[0].id === 'journey' && lastReads >= 1 && sampleCalls === 0,
     'drawn ' + drawn.length + ' lastReads ' + lastReads + ' sampleCalls ' + sampleCalls);
  ok('the panel gets the window minus the title strip', drawn[0].w === 800 && drawn[0].h === 450 - 34,
     'panel got ' + drawn[0].w + 'x' + drawn[0].h + ' — the strip would overdraw the panel or vice versa');

  document.visibilityState = 'hidden';
  runFrame();
  ok('with the MAIN page hidden the popout draws from sample() (rAF is dead there)',
     sampleCalls === 1 && drawn.length === 2,
     'sampleCalls ' + sampleCalls + ' — the popout would freeze the moment the dashboard tab is backgrounded');
  document.visibilityState = 'visible';

  panelThrows = true; runFrame(); panelThrows = false;
  ok('a throwing panel is stashed, not fatal', P.status.err === 'panel boom' && P.status.frames >= 3,
     'err ' + P.status.err + ' — a swallowed exception is a bug given somewhere to hide; a fatal one kills the window');

  ok('an unknown panel is refused with its name', /no such panel: nope/.test(await P.set('nope')),
     'set(nope) did not refuse');

  console.log('\n── party: butterchurn, lazily ───────────────────────────────');
  const r2 = await P.set('party');
  ok('party without an audio graph is a sentence, not a crash',
     /press ▶ once/.test(r2) && scriptsLoaded.length === 0,
     r2 + ' · scripts loaded: ' + scriptsLoaded.length + ' — vendored files must not execute before they can work');
  runFrame();
  ok('a party frame with no visualizer draws nothing and survives', P.status.open === true, 'the window died');

  /* grant the graph and a fake butterchurn — the loader must SKIP loading
     when the globals already exist, which is also what makes this testable */
  let rendered = 0, presetLoads = 0, connected = null, disconnected = null;
  global.DW.Player.analyser = { context: { id: 'ctx' } };
  global.butterchurn = { createVisualizer: (c, canvas, o) => ({
    connectAudio(n) { connected = n; },
    /* butterchurn's own teardown. The visualizer is wired into the OPENER's
       audio graph, which outlives the popped-out document, so closing the
       window releases nothing unless someone calls this. */
    disconnectAudio(n) { disconnected = n; },
    loadPreset() { presetLoads++; },
    setRendererSize() {}, render() { rendered++; } }) };
  global.butterchurnPresets = { getPresets: () => ({ p1: {}, p2: {}, p3: {} }) };
  const r3 = await P.set('party');
  ok('party with the graph up connects the ANALYSER and loads a preset',
     /party — butterchurn/.test(r3) && connected === global.DW.Player.analyser && presetLoads === 1 && P.status.presets === 3,
     r3 + ' · connected ' + !!connected + ' presets ' + P.status.presets);
  runFrame();
  ok('party frames render through butterchurn', rendered === 1, 'rendered ' + rendered);
  nowMs += 31000; runFrame();
  ok('presets rotate after the cycle time', presetLoads === 2, 'presetLoads ' + presetLoads + ' after 31 s — the party would play one preset forever');
  curWin.document.fire('click');
  ok('a click on the window skips to the next preset', presetLoads === 3, 'presetLoads ' + presetLoads);
  ok('PARTY advertises no panel — a Milkdrop window suppresses no slot',
     P.showing === null,
     'showing is ' + JSON.stringify(P.showing) + ' — the dashboard would blank the tile of a panel nothing is drawing');

  console.log('\n── lifecycle ────────────────────────────────────────────────');
  const r4 = await P.set('off');
  ok('off closes the window', /closed/.test(r4) && P.status.open === false && curWin.closed === true, r4);
  ok('closing DISCONNECTS the visualizer from the analyser and forgets it',
     disconnected === global.DW.Player.analyser && P.status.party === false,
     'disconnected ' + !!disconnected + ' party ' + P.status.party
     + ' — connectAudio wires butterchurn into the opener\'s graph, which survives the window; every reopen would add another live visualizer holding a WebGL context');
  ok('and a closed popout is showing nothing again', P.showing === null, 'showing ' + JSON.stringify(P.showing));
  blocked = true;
  const r5 = await P.set('journey');
  ok('a blocked popup is a sentence, not a crash', /popup blocked/.test(r5) && P.mode === 'off', r5);
  blocked = false;
  const before = drawn.length;
  await P.set('spectrum'); runFrame();
  ok('reopen after close makes a fresh window drawing the new panel',
     opened === 3 && drawn.length === before + 1 && drawn[drawn.length - 1].id === 'spectrum' && P.mode === 'spectrum',
     'opened ' + opened + ' drawn ' + (drawn.length - before) + ' mode ' + P.mode);
  await P.set('off');

  console.log('\n── device pixels, and one advance per frame ─────────────────');
  /* The dashboard has always sized its canvases by devicePixelRatio and
     handed panels CSS pixels under a matching transform (dash.fit). This
     window sized in CSS pixels, so a HiDPI projector got the panel upscaled
     by the compositor. And the ratio has to be the POPOUT window's: the
     drawing code runs in the opener, so reading window.devicePixelRatio here
     measures the laptop, not the screen the window was dragged to. */
  winDpr = 2;
  canvases.length = 0;
  await P.set('journey'); runFrame();
  ok('the projector canvas is sized in the POPOUT WINDOW\'s device pixels',
     canvases.length >= 1 && canvases[0].width === 800 * 2 && canvases[0].height === 450 * 2,
     'canvas is ' + (canvases[0] ? canvases[0].width + 'x' + canvases[0].height : 'absent')
     + ' for an 800x450 window at dpr 2 — a 1:1 buffer is upscaled by the compositor and every line and label is soft');
  ok('…and the panel is still handed CSS pixels, not device pixels',
     drawn[drawn.length - 1].w === 800 && drawn[drawn.length - 1].h === 450 - 34,
     'panel got ' + drawn[drawn.length - 1].w + 'x' + drawn[drawn.length - 1].h
     + ' — a panel that is handed device pixels draws its text at half size and its layout at double');
  await P.set('off');
  winDpr = 1;

  /* The other half of the one-advance-per-frame contract lives in DWLOOP: it
     is the thing that must ASK. Read here rather than in check-panels because
     this is the popout's contract and `showing` is defined by this module. */
  {
    const loop = fs.readFileSync('assets/deckwave-loop.js', 'utf8').replace(/\r\n/g, '\n');
    const slotBlock = (loop.split('dash.slots.slots.forEach')[1] || '').slice(0, 900);
    ok('DWLOOP asks DWPOPOUT what it is showing before drawing the slots',
       /DWPOPOUT\s*&&\s*window\.DWPOPOUT\.showing/.test(loop) && /slot\.panel === popped/.test(slotBlock),
       'the slot loop calls the same P.draw the popout calls, so a stateful panel open in both windows advances twice per frame');
    ok('…and the suppressed slot SAYS so instead of freezing on a stale frame',
       /in the projector window/.test(slotBlock),
       'a tile that simply stops updating is indistinguishable from a dead render loop, which is the failure this file exists to prevent');
    /* control: the ordinary draw path is still there. A guard that suppressed
       every slot would pass both checks above and show an empty dashboard. */
    ok('…control: the ordinary slot still draws through p.draw',
       /p\.draw\(slot\.ctx, r\.width, r\.height, T, D\)/.test(slotBlock),
       'the slot draw call is gone — every panel would be blank and the two checks above would still be green');
  }

  console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') + ' of ' + checks + ' checks');
  process.exit(fails ? 1 : 0);
})();
