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
const rafs = [];                              /* the popout window's own rAF queue */
function makeWin() {
  const doc = { title: '', listeners: {},
    body: { style: {}, appendChild() {} },
    addEventListener(k, fn) { (this.listeners[k] = this.listeners[k] || []).push(fn); },
    fire(k) { (this.listeners[k] || []).forEach(f => f()); },
    createElement(tag) { return tag === 'canvas' ? makeCanvas() : { style: {} }; } };
  return { closed: false, innerWidth: 800, innerHeight: 450, document: doc,
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

  const r1 = await P.set('journey');
  ok('set(panel) opens the window and says where it went', opened === 1 && P.status.open === true && /projector: journey/.test(r1), r1);
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
  let rendered = 0, presetLoads = 0, connected = null;
  global.DW.Player.analyser = { context: { id: 'ctx' } };
  global.butterchurn = { createVisualizer: (c, canvas, o) => ({
    connectAudio(n) { connected = n; }, loadPreset() { presetLoads++; },
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

  console.log('\n── lifecycle ────────────────────────────────────────────────');
  const r4 = await P.set('off');
  ok('off closes the window', /closed/.test(r4) && P.status.open === false && curWin.closed === true, r4);
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

  console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') + ' of ' + checks + ' checks');
  process.exit(fails ? 1 : 0);
})();
