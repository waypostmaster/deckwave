/* ─────────────────────────────────────────────────────────────────────────
   DECKWAVE · POPOUT — the panels (or a party) in their own window

   Keeper, 2026-08-21, after the visualizer field survey ("go ahead with
   building the new features"). Two ideas came out of that survey
   (docs/research/visualizer-field-notes-2026-08-21.md) and this module is
   both of them:

     projector   any registered panel drawn full-window in a popped-out
                 browser window — drag it to a TV or projector, F11 it,
                 and the dashboard stays free on the laptop. The window
                 draws from DWLOOP's bundles: `DWLOOP.last` while the main
                 page is visible (its loop is running, the bundle is one
                 frame old), `DWLOOP.sample()` when the main page is
                 hidden (rAF is dead there; sample() IS the loop's
                 measuring half, built for exactly this — see
                 deckwave-loop.js). The popout runs on ITS OWN
                 requestAnimationFrame, so it keeps animating while the
                 dashboard tab is in the background.

     party       butterchurn (the MIT WebGL reimplementation of Milkdrop 2)
                 rendering off the Player's analyser tap. The two vendored
                 files (vendor/butterchurn*.min.js, pinned, see
                 vendor/README.md for provenance) are loaded LAZILY on the
                 first party request — a page that never opens the popout
                 never executes them. The visualizer connects to
                 DW.Player.analyser (audio fan-out to analysis nodes only;
                 nothing audible changes and no detector's input moves).
                 Presets rotate every CYCLE seconds; a click on the window
                 jumps to the next one. CYCLE is decorative pacing, not a
                 calibration.

   HONESTY NOTES. The party layer is deliberately NOT a panel: panels are
   measured instruments and Milkdrop is decoration — keeping it in the
   popout keeps the dashboard honest. And the popout dies with the opener:
   reloading the main page orphans the window on its last frame (the
   drawing functions lived in the opener). That is a property of the
   design, not a bug to fix with a SharedWorker three days before launch.

   FALSIFIERS. If the popout freezes while the MAIN page is hidden and a
   set is playing, sample() is not being reached — check
   status().sampled. If party mode shows a black window with audio
   playing, WebGL2 is unavailable or the preset failed — status().err
   says which. If popups are blocked, set() says so and nothing crashes.
   ───────────────────────────────────────────────────────────────────────── */

window.DWPOPOUT = (function () {
'use strict';

let win = null, cv = null, bcv = null, raf = null;
let panel = 'journey', mode = 'off';          /* 'off' | 'panel' | 'party' */
let bc = null, bcErr = null, bcPresets = null, bcNames = [], bcIdx = -1, bcAt = 0, bcLoading = false;
let frames = 0, sampled = 0, lastErr = null;
const CYCLE = 30;                             /* seconds per preset — pacing, not calibration */
const STRIP = 34;                             /* the title strip, px */

const closed = () => !win || win.closed;

function ensureWin() {
  if (!closed()) return win;
  win = window.open('', 'deckwave-popout', 'width=960,height=540');
  if (!win) return null;                      /* popup blocked — set() reports it */
  bc = null; bcIdx = -1;                      /* canvases are new; a visualizer bound to the old ones is dead */
  const d = win.document;
  d.title = 'DECKWAVE · projector';
  d.body.style.cssText = 'margin:0;background:#04010f;overflow:hidden';
  cv = d.createElement('canvas');
  cv.style.cssText = 'position:absolute;inset:0;width:100vw;height:100vh';
  bcv = d.createElement('canvas');
  bcv.style.cssText = 'position:absolute;inset:0;width:100vw;height:100vh;display:none';
  d.body.appendChild(cv); d.body.appendChild(bcv);
  d.addEventListener('click', () => { if (mode === 'party') nextPreset(); });
  frames = 0; sampled = 0;
  const tick = () => {
    if (closed()) { raf = null; return; }
    raf = win.requestAnimationFrame(tick);
    try { draw(); frames++; } catch (e) { lastErr = e.message; }
  };
  raf = win.requestAnimationFrame(tick);
  return win;
}

function draw() {
  const W = win.innerWidth, H = win.innerHeight;
  if (!W || !H) return;
  if (mode === 'party') {
    if (!bc) return;                          /* loading, or failed — status().err has why */
    if (bcv.width !== W || bcv.height !== H) {
      bcv.width = W; bcv.height = H;
      try { bc.setRendererSize(W, H); } catch (e) { lastErr = e.message; }
    }
    if (bcAt && (performance.now() - bcAt) / 1000 > CYCLE) nextPreset();
    bc.render();
    return;
  }
  const L = window.DWLOOP; if (!L) return;
  /* visible main page: its loop runs, last is one frame old. Hidden main
     page: no frames there — sample() builds one and advances the loop's
     own state, which is its designed hidden-page contract. */
  let b = null;
  if (document.visibilityState === 'hidden' && L.sample) { b = L.sample(); sampled++; }
  else b = L.last;
  if (!b || !b.T || !b.D) return;
  if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
  const c = cv.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.shadowBlur = 0;
  c.fillStyle = b.T.bg || '#04010f'; c.fillRect(0, 0, W, H);
  const P = window.DWPANELS && window.DWPANELS.get(panel);
  if (P) { c.save(); try { P.draw(c, W, H - STRIP, b.T, b.D); } catch (e) { lastErr = e.message; } c.restore(); }
  /* the title strip — same truth as the card: the deck's meta from the bundle */
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.shadowBlur = 0;
  c.fillStyle = b.T.bg || '#04010f'; c.fillRect(0, H - STRIP, W, STRIP);
  c.fillStyle = b.T.line || '#22125c'; c.fillRect(0, H - STRIP, W, 1);
  const fn = b.T.fn || 'system-ui, sans-serif';
  c.textBaseline = 'middle'; c.font = '600 14px ' + fn;
  const m = b.D.now;
  if (m) {
    const SET = b.D.set || [], i = SET.indexOf(m);
    c.textAlign = 'left'; c.fillStyle = b.T.ac || '#22e8ff';
    c.fillText(String(m.name).slice(0, 60), 12, H - STRIP / 2);
    c.textAlign = 'right'; c.fillStyle = b.T.dim || '#7d6eb0';
    c.fillText((i > -1 ? (i + 1) + '/' + SET.length + ' · ' : '') + Math.round(m.bpm) + ' bpm · '
               + (m.camelot || '') + (m._unlocked ? ' · straight' : ''), W - 12, H - STRIP / 2);
  } else {
    c.textAlign = 'left'; c.fillStyle = b.T.dim || '#7d6eb0';
    c.fillText('DECKWAVE — nothing playing yet', 12, H - STRIP / 2);
  }
}

/* ── party: butterchurn, lazily ──────────────────────────────────────── */
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.onload = res; s.onerror = () => rej(new Error('failed to load ' + src));
    document.head.appendChild(s);
  });
}
async function ensureButterchurn() {
  if (bc) return true;
  if (bcLoading) return false;
  bcErr = null;
  const an = window.DW && window.DW.Player && window.DW.Player.analyser;
  if (!an) { bcErr = 'the audio graph is not up yet — press ▶ once, then choose party again'; return false; }
  bcLoading = true;
  try {
    if (!window.butterchurn) await loadScript('vendor/butterchurn.min.js');
    if (!window.butterchurnPresets) await loadScript('vendor/butterchurn-presets.min.js');
    const BC = window.butterchurn && (window.butterchurn.default || window.butterchurn);
    const PR = window.butterchurnPresets && (window.butterchurnPresets.default || window.butterchurnPresets);
    if (!BC || !BC.createVisualizer) throw new Error('butterchurn did not expose createVisualizer');
    bcPresets = (PR && PR.getPresets) ? PR.getPresets() : PR;
    bcNames = bcPresets ? Object.keys(bcPresets) : [];
    if (!bcNames.length) throw new Error('no presets in the pack');
    const W = (win && win.innerWidth) || 960, H = (win && win.innerHeight) || 540;
    bcv.width = W; bcv.height = H;
    bc = BC.createVisualizer(an.context, bcv, { width: W, height: H });
    bc.connectAudio(an);
    nextPreset();
    return true;
  } catch (e) { bcErr = String((e && e.message) || e); bc = null; return false; }
  finally { bcLoading = false; }
}
function nextPreset() {
  if (!bc || !bcNames.length) return null;
  /* a random step of at least 1 — never the same preset twice in a row */
  bcIdx = (bcIdx + 1 + Math.floor(Math.random() * Math.max(1, bcNames.length - 1))) % bcNames.length;
  const name = bcNames[bcIdx];
  try { bc.loadPreset(bcPresets[name], 2.7); bcAt = performance.now(); } catch (e) { bcErr = String((e && e.message) || e); }
  return name;
}

/* ── the one entry point ─────────────────────────────────────────────── */
async function set(k) {
  if (k === 'off') {
    mode = 'off';
    if (!closed()) { try { win.close(); } catch (e) {} }
    win = null; bc = null;
    return 'popout closed';
  }
  const w = ensureWin();
  if (!w) { mode = 'off'; return 'popup blocked — allow popups for this page and choose it again'; }
  if (k === 'party') {
    mode = 'party';
    cv.style.display = 'none'; bcv.style.display = '';
    const ok = await ensureButterchurn();
    return ok ? 'party — butterchurn (Milkdrop lineage, MIT) in the popout · new preset every ' + CYCLE
                + ' s, click the window to skip · decoration, not an instrument'
              : 'party not available: ' + bcErr;
  }
  if (!(window.DWPANELS && window.DWPANELS.has(k))) { return 'no such panel: ' + k; }
  panel = k; mode = 'panel';
  cv.style.display = ''; bcv.style.display = 'none';
  return 'projector: ' + k + ' in its own window — drag it to the second screen and fullscreen it';
}

return {
  set,
  nextPreset,
  get mode() { return mode === 'panel' ? panel : mode; },
  /* for the log line and a bug report */
  get status() {
    return { open: !closed(), mode, panel, frames, sampled,
             party: !!bc, presets: bcNames.length, err: bcErr || lastErr || null };
  }
};
})();
