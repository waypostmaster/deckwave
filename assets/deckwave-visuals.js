/* ─────────────────────────────────────────────────────────────────────────
   DECKWAVE · VISUALS
   Real-time audio visualisation for the Deckwave engine.

   INFLUENCES AND ATTRIBUTION
   ──────────────────────────
   Strudel (strudel.cc · codeberg.org/uzu/strudel · Felix Roos, Alex McLean
     and contributors) — the visual vocabulary here is modelled on Strudel's
     built-in feedback set: scope (oscilloscope), spectrum (analyser),
     pianoroll / punchcard, pitchwheel, and spiral. Strudel is the JavaScript
     descendant of TidalCycles (Alex McLean). No Strudel code is used or
     copied; these are independent implementations of the same ideas, built
     on the Web Audio AnalyserNode.
   Switch Angel — whose Strudel live-coding work is where these visuals were
     first pointed out to the author of this file.
   Essentia (Music Technology Group, Universitat Pompeu Fabra) — supplies the
     HPCP / chroma features the pitch display reads when available.
   Web Audio API AnalyserNode — everything realtime derives from
     getByteTimeDomainData and getByteFrequencyData.

   HONEST LIMIT ON THE PITCH DISPLAY
   ──────────────────────────────────
   This is a CHROMAGRAM, not a piano roll. It shows which of the twelve pitch
   CLASSES carry energy — C, C#, D … — folded across all octaves. It does not
   and cannot show individual notes: extracting discrete notes from finished
   polyphonic audio is music transcription, an open research problem, not an
   FFT call. Anything that claimed otherwise from a mixed stereo track would
   be guessing. Read the wheel as "where the harmony sits", never as a score.

   THEMING
   ───────
   Every colour, font, radius and effect is a CSS custom property with the
   cyberpunk value as its fallback. A host page overrides any of them without
   forking. Structural elements carry part= for ::part() overrides.
   Custom properties pierce the shadow boundary and survive :host{all:initial}.
   ───────────────────────────────────────────────────────────────────────── */

window.DWV = (function () {
'use strict';

/* The full theming API. Fallbacks ARE the default look. */
const TOKENS = `
:host{
  all: initial;

  /* colour */
  --dw-bg:            var(--dw-color-bg,        #06021a);
  --dw-surface:       var(--dw-color-surface,   #0d0526);
  --dw-line:          var(--dw-color-line,      #22125c);
  --dw-text:          var(--dw-color-text,      #e6ddff);
  --dw-dim:           var(--dw-color-dim,       #7d6eb0);
  --dw-accent:        var(--dw-color-accent,    #22e8ff);
  --dw-accent-2:      var(--dw-color-accent-2,  #ff2d95);
  --dw-warn:          var(--dw-color-warn,      #ffb02e);
  --dw-bad:           var(--dw-color-bad,       #ff5470);
  --dw-good:          var(--dw-color-good,      #3ee68a);

  /* type */
  --dw-font:          var(--dw-font-mono,       ui-monospace, Menlo, monospace);
  --dw-font-display:  var(--dw-font-title,      var(--dw-font));
  --dw-size:          var(--dw-font-size,       11px);
  --dw-track:         var(--dw-letter-spacing,  .14em);

  /* shape */
  --dw-radius:        var(--dw-border-radius,   0px);
  --dw-border:        var(--dw-border-width,    1px);
  --dw-pad:           var(--dw-space,           12px);

  /* effect — set --dw-glow-strength to 0 for a flat, non-cyberpunk look */
  --dw-glow-strength: var(--dw-glow,            1);
  --dw-scanline:      var(--dw-scanline-opacity,.28);
  --dw-scanline-size: var(--dw-scanline-height, 3px);
  --dw-speed:         var(--dw-animation-speed, 1);

  display: block;
  font-family: var(--dw-font);
  font-size: var(--dw-size);
  color: var(--dw-text);
}
@media (prefers-reduced-motion: reduce){ :host{ --dw-speed: 0; } }
`;

const CSS = TOKENS + `
*{box-sizing:border-box}
.wrap{position:relative;background:var(--dw-surface);border:var(--dw-border) solid var(--dw-line);
  border-radius:var(--dw-radius);overflow:hidden}
.wrap::after{content:'';position:absolute;inset:0;pointer-events:none;
  background:repeating-linear-gradient(180deg,transparent 0 calc(var(--dw-scanline-size) - 1px),
    rgba(0,0,0,var(--dw-scanline)) calc(var(--dw-scanline-size) - 1px) var(--dw-scanline-size))}
.row{display:grid;gap:var(--dw-pad);padding:var(--dw-pad)}
.head{display:flex;justify-content:space-between;align-items:baseline;
  padding:calc(var(--dw-pad) * .7) var(--dw-pad);border-bottom:var(--dw-border) solid var(--dw-line);
  font-size:9px;letter-spacing:calc(var(--dw-track) * 1.6);text-transform:uppercase;color:var(--dw-accent-2)}
.head b{color:var(--dw-accent);font-weight:500}
canvas{display:block;width:100%;background:var(--dw-bg);border:var(--dw-border) solid var(--dw-line);
  border-radius:var(--dw-radius)}
.lbl{font-size:8.5px;letter-spacing:var(--dw-track);text-transform:uppercase;color:var(--dw-dim);
  margin-bottom:4px}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:var(--dw-pad)}
@media(max-width:560px){.pair{grid-template-columns:1fr}}
.meters{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.m{border:var(--dw-border) solid var(--dw-line);padding:5px 7px;border-radius:var(--dw-radius)}
.m u{display:block;text-decoration:none;color:var(--dw-dim);font-size:8px;letter-spacing:var(--dw-track);
  text-transform:uppercase}
.m i{display:block;height:4px;background:var(--dw-line);margin-top:5px}
.m i b{display:block;height:100%;width:0;transition:width .06s linear}
.m.low i b{background:var(--dw-accent-2)}
.m.mid i b{background:var(--dw-accent)}
.m.high i b{background:var(--dw-good)}
`;

/* glow helper — respects --dw-glow-strength so a flat theme really is flat */
function glow(cx, colour, blur, strength) {
  const s = parseFloat(strength);
  cx.shadowBlur = (isNaN(s) ? 1 : s) * blur;
  cx.shadowColor = colour;
}
const PITCH = ['C','C♯','D','E♭','E','F','F♯','G','A♭','A','B♭','B'];

function mount(host, opts) {
  opts = opts || {};
  const root = host.attachShadow ? host : document.createElement('div');
  const sr = root.shadowRoot || root.attachShadow({ mode: 'open' });
  const st = document.createElement('style'); st.textContent = CSS; sr.appendChild(st);

  const wrap = document.createElement('div'); wrap.className = 'wrap';
  wrap.setAttribute('part', 'panel');
  wrap.innerHTML =
    '<div class="head" part="header"><span>◈ ' + (opts.title || 'DECKWAVE') + '</span><b id="hd"></b></div>' +
    '<div class="row">' +
      '<div><div class="lbl" part="label">waveform · scope</div>' +
        '<canvas id="scope" height="80" part="scope"></canvas></div>' +
      '<div class="pair">' +
        '<div><div class="lbl" part="label">spectrum</div>' +
          '<canvas id="spec" height="110" part="spectrum"></canvas></div>' +
        '<div><div class="lbl" part="label">pitch classes · chromagram</div>' +
          '<canvas id="chroma" height="110" part="chroma"></canvas></div>' +
      '</div>' +
      '<div><div class="lbl" part="label">energy bands</div>' +
        '<div class="meters" part="meters">' +
          '<div class="m low" part="meter"><u>bass</u><i><b id="mlo"></b></i></div>' +
          '<div class="m mid" part="meter"><u>mid</u><i><b id="mmd"></b></i></div>' +
          '<div class="m high" part="meter"><u>high</u><i><b id="mhi"></b></i></div>' +
        '</div></div>' +
      '<div><div class="lbl" part="label">bass hits · last 8 seconds</div>' +
        '<canvas id="punch" height="54" part="punchcard"></canvas></div>' +
    '</div>';
  sr.appendChild(wrap);

  const $ = id => sr.getElementById(id);
  const cvs = { scope: $('scope'), spec: $('spec'), chroma: $('chroma'), punch: $('punch') };
  const ctxs = {}; Object.keys(cvs).forEach(k => ctxs[k] = cvs[k].getContext('2d'));
  const cs = () => getComputedStyle(host);

  function fit() {
    const dpr = window.devicePixelRatio || 1;
    Object.keys(cvs).forEach(k => { const c = cvs[k];
      c.width = c.clientWidth * dpr; c.height = c.getAttribute('height') * dpr;
      ctxs[k].setTransform(dpr, 0, 0, dpr, 0, 0); });
  }
  fit(); addEventListener('resize', fit);

  let analyser = null, wave = null, freq = null, raf = null;
  const hits = [];                       /* bass onsets: {t, v} */
  let lastLow = 0, lastHit = 0;

  function draw() {
    raf = requestAnimationFrame(draw);
    const s = cs();
    const C = {
      bg: s.getPropertyValue('--dw-bg').trim() || '#06021a',
      accent: s.getPropertyValue('--dw-accent').trim() || '#22e8ff',
      accent2: s.getPropertyValue('--dw-accent-2').trim() || '#ff2d95',
      line: s.getPropertyValue('--dw-line').trim() || '#22125c',
      dim: s.getPropertyValue('--dw-dim').trim() || '#7d6eb0',
      good: s.getPropertyValue('--dw-good').trim() || '#3ee68a',
      g: s.getPropertyValue('--dw-glow-strength').trim() || '1'
    };
    if (!analyser) { idle(C); return; }
    analyser.getByteTimeDomainData(wave);
    analyser.getByteFrequencyData(freq);

    /* ── scope: the oscilloscope, after Strudel's .scope() ──────────── */
    { const c = ctxs.scope, w = cvs.scope.clientWidth, h = 80;
      c.fillStyle = C.bg; c.fillRect(0, 0, w, h);
      c.strokeStyle = C.line; c.lineWidth = 1; c.beginPath();
      c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke();
      c.strokeStyle = C.accent; c.lineWidth = 1.5; glow(c, C.accent, 8, C.g);
      c.beginPath(); const step = wave.length / w;
      for (let x = 0; x < w; x++) { const v = (wave[Math.floor(x * step)] - 128) / 128;
        const y = h / 2 + v * (h / 2 - 3); x ? c.lineTo(x, y) : c.moveTo(x, y); }
      c.stroke(); c.shadowBlur = 0; }

    /* ── spectrum: log-spaced bars, after Strudel's .spectrum() ─────── */
    { const c = ctxs.spec, w = cvs.spec.clientWidth, h = 110, n = 48;
      c.fillStyle = C.bg; c.fillRect(0, 0, w, h);
      const bw = w / n;
      for (let i = 0; i < n; i++) {
        const lo = Math.floor(Math.pow(i / n, 2.2) * freq.length);
        const hiB = Math.max(lo + 1, Math.floor(Math.pow((i + 1) / n, 2.2) * freq.length));
        let m = 0; for (let j = lo; j < hiB; j++) m = Math.max(m, freq[j]);
        const bh = (m / 255) * (h - 4);
        const grad = c.createLinearGradient(0, h, 0, h - bh);
        grad.addColorStop(0, C.accent2); grad.addColorStop(1, C.accent);
        c.fillStyle = grad; glow(c, C.accent2, 6, C.g);
        c.fillRect(i * bw + 1, h - bh, bw - 2, bh); }
      c.shadowBlur = 0; }

    /* ── chromagram: twelve pitch classes, after Strudel's .pitchwheel()
         NOT a piano roll — see the note at the top of this file. ─────── */
    { const c = ctxs.chroma, w = cvs.chroma.clientWidth, h = 110;
      c.fillStyle = C.bg; c.fillRect(0, 0, w, h);
      const bins = new Float32Array(12), sr2 = 44100, N = freq.length * 2;
      for (let i = 1; i < freq.length; i++) {
        const f = i * sr2 / N; if (f < 55 || f > 5000) continue;
        const midi = 69 + 12 * Math.log2(f / 440);
        bins[((Math.round(midi) % 12) + 12) % 12] += freq[i] / 255; }
      let mx = 0; for (const v of bins) mx = Math.max(mx, v);
      const cxp = w / 2, cyp = h / 2, r = Math.min(w, h) / 2 - 14;
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const v = mx ? bins[i] / mx : 0;
        c.strokeStyle = C.line; c.lineWidth = 1;
        c.beginPath(); c.moveTo(cxp, cyp);
        c.lineTo(cxp + Math.cos(a) * r, cyp + Math.sin(a) * r); c.stroke();
        if (v > .12) { c.strokeStyle = v > .6 ? C.accent2 : C.accent;
          c.lineWidth = 3; glow(c, c.strokeStyle, 9, C.g);
          c.beginPath(); c.moveTo(cxp, cyp);
          c.lineTo(cxp + Math.cos(a) * r * v, cyp + Math.sin(a) * r * v);
          c.stroke(); c.shadowBlur = 0; }
        c.fillStyle = v > .5 ? C.accent : C.dim;
        c.font = '9px ' + (cs().getPropertyValue('--dw-font') || 'monospace');
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(PITCH[i], cxp + Math.cos(a) * (r + 9), cyp + Math.sin(a) * (r + 9)); } }

    /* ── band meters + bass onset detection ─────────────────────────── */
    { const band = (a, b) => { let s2 = 0, n2 = 0;
        for (let i = a; i < b && i < freq.length; i++) { s2 += freq[i]; n2++; }
        return n2 ? s2 / n2 / 255 : 0; };
      const lo = band(0, 12), md = band(12, 90), hi = band(90, freq.length);
      $('mlo').style.width = (lo * 100) + '%';
      $('mmd').style.width = (md * 100) + '%';
      $('mhi').style.width = (hi * 100) + '%';
      const now = performance.now();
      if (lo > .55 && lo - lastLow > .10 && now - lastHit > 120) {
        hits.push({ t: now, v: lo }); lastHit = now; }
      lastLow = lo;
      while (hits.length && now - hits[0].t > 8000) hits.shift();

      /* punchcard: bass hits over the last 8s, after Strudel's .punchcard() */
      const c = ctxs.punch, w = cvs.punch.clientWidth, h = 54;
      c.fillStyle = C.bg; c.fillRect(0, 0, w, h);
      c.strokeStyle = C.line; c.lineWidth = 1;
      for (let i = 1; i < 8; i++) { const x = w * i / 8;
        c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
      hits.forEach(p => { const x = w - ((now - p.t) / 8000) * w;
        const rad = 3 + p.v * 7;
        c.fillStyle = C.accent2; glow(c, C.accent2, 10, C.g);
        c.beginPath(); c.arc(x, h / 2, rad, 0, 7); c.fill(); });
      c.shadowBlur = 0;
      $('hd').textContent = hits.length + ' hits · 8s'; }
  }

  function idle(C) {
    Object.keys(cvs).forEach(k => { const c = ctxs[k], w = cvs[k].clientWidth,
      h = +cvs[k].getAttribute('height');
      c.fillStyle = C.bg; c.fillRect(0, 0, w, h);
      c.strokeStyle = C.line; c.lineWidth = 1;
      c.beginPath(); c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke(); });
    $('hd').textContent = 'no signal';
  }

  return {
    attach(node) {
      analyser = node;
      if (node) { wave = new Uint8Array(node.fftSize);
        freq = new Uint8Array(node.frequencyBinCount); }
      return !!node;
    },
    start() { if (!raf) draw(); return 'running'; },
    stop() { if (raf) cancelAnimationFrame(raf); raf = null; return 'stopped'; },
    shadow: sr, host: host
  };
}

return { mount, TOKENS, PITCH,
  /* the theming surface, for documentation and for host pages to introspect */
  tokens: ['--dw-color-bg','--dw-color-surface','--dw-color-line','--dw-color-text',
    '--dw-color-dim','--dw-color-accent','--dw-color-accent-2','--dw-color-warn',
    '--dw-color-bad','--dw-color-good','--dw-font-mono','--dw-font-title',
    '--dw-font-size','--dw-letter-spacing','--dw-border-radius','--dw-border-width',
    '--dw-space','--dw-glow','--dw-scanline-opacity','--dw-scanline-height',
    '--dw-animation-speed'],
  parts: ['panel','header','label','scope','spectrum','chroma','meters','meter','punchcard']
};
})();
