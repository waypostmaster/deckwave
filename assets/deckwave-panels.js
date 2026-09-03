/* ─────────────────────────────────────────────────────────────────────────
   DECKWAVE · PANELS
   A panel is (id, label, draw(c, w, h, T, D)) and nothing more.
     T = resolved theme colours + a glow helper + the font
     D = the shared per-frame data bundle (wave, freq, set, state, stereo, vu)
   Panels never touch the render loop; the loop never knows what a panel is.
   Adding a twelfth is one register() call — Butterchurn would drop in here.

   WIKIPEDIA REFERENCES
   Each panel carries a plain-language explanation and a link. Entries marked
   verified:true were confirmed to resolve. The rest use Wikipedia's search
   URL, because guessing an article path and presenting it as fact is a
   failure already in this project's log, and a search never dead-ends.
   ───────────────────────────────────────────────────────────────────────── */

window.DWPANELS = (function () {
'use strict';
const reg = new Map();

const WIKI = {
  scope: { t:'Oscilloscope', u:'https://en.wikipedia.org/wiki/Oscilloscope', verified:false,
    d:'Plots amplitude against time. Vertical is signal level, horizontal is the last few milliseconds.' },
  spectrum: { t:'Spectrum analyzer', u:'https://en.wikipedia.org/wiki/Special:Search?search=spectrum+analyzer', verified:false,
    d:'Splits sound into frequency bands with an FFT. Bass left, treble right. Bars are spaced logarithmically, because hearing is.' },
  waterfall: { t:'Spectrogram', u:'https://en.wikipedia.org/wiki/Spectrogram', verified:false,
    d:'Frequency analysis scrolled over time. Left older, right now, low frequencies at the bottom, brighter means louder. Song structure becomes visible — you can see a drop before it arrives.' },
  chroma: { t:'Chroma feature', u:'https://en.wikipedia.org/wiki/Chroma_feature', verified:true,
    d:'Folds every octave into twelve pitch classes, so all the Cs count as one. Shows where the harmony sits. NOT a piano roll — extracting individual notes from a finished mix is an unsolved research problem.' },
  camelot: { t:'Harmonic mixing', u:'https://en.wikipedia.org/wiki/Special:Search?search=harmonic+mixing+camelot+wheel', verified:false,
    d:'The Camelot wheel: 12 numbers, A minor and B major. Adjacent numbers are a perfect fifth apart; same number different letter is the relative major/minor. Lit circles mix cleanly from here.' },
  gonio: { t:'Goniometer (audio)', u:'https://en.wikipedia.org/wiki/Goniometer_(audio)', verified:true,
    d:'Plots left against right as a Lissajous figure. Vertical means mono; horizontal means out of phase and would cancel in mono. A wide ball means a broad stereo image. The bar below is phase correlation, −1 to +1.' },
  vu: { t:'VU meter', u:'https://en.wikipedia.org/wiki/VU_meter', verified:true,
    d:'Averaging meter with the ANSI ballistic: 300 ms to 99% deflection. That deliberate slowness is why analogue meters read as musical rather than twitchy. The trailing dot is a fast-attack peak hold.' },
  centre: { t:'Joint (mid/side) stereo coding', u:'https://en.wikipedia.org/wiki/Joint_encoding', verified:false,
    d:'Splits the signal into mid (L+R)/2 and side (L−R)/2. Centre-panned material — in most produced music the lead vocal, plus kick, snare and bass — lands almost entirely in mid; width lands in side. The dashed line is centre share, mid/(mid+side). RELATIVE: there is no reference level and this is NOT a vocal detector.' },
  transition: { t:'Beatmatching', u:'https://en.wikipedia.org/wiki/Beatmatching', verified:false,
    d:'Both decks\u2019 beat grids at their played tempo, downbeats as wide bars with bar numbers. Matching periods stay locked; drifting periods separate. Also shows crossfade progress and the bass swap.' },
  position: { t:'Cue (DJ)', u:'https://en.wikipedia.org/wiki/Special:Search?search=DJ+cue+point', verified:false,
    d:'Progress through the current track with beat ticks. The magenta marker is the exit downbeat where the next blend begins.' },
  loudness: { t:'LUFS', u:'https://en.wikipedia.org/wiki/Special:Search?search=LUFS+loudness+units+full+scale', verified:false,
    d:'Perceived loudness over time. Broadcast targets \u221223 LUFS, streaming about \u221214. RELATIVE reading only — proper K-weighting per ITU-R BS.1770 is approximated with a crude shelf, so trends are meaningful but the number is not comparable to a real meter.' },
  polygraph: { t:'Chart recorder', u:'https://en.wikipedia.org/wiki/Special:Search?search=chart+recorder+strip+chart', verified:false,
    d:'Five pens on scrolling chart paper, oldest left. BASS, MID and HIGH are average FFT energy in their bands. FLUX is spectral change — how much the spectrum moved since the last frame, which is what the onset detector triggers on, so it spikes on kicks rather than on loudness. WIDTH is stereo spread from the goniometer’s correlation, zero when mono. Levels are relative to full scale, not calibrated.' },
  timeline: { t:'Time series', u:'https://en.wikipedia.org/wiki/Time_series', verified:false,
    d:'Level and the three frequency bands across the current track. The x axis GROWS as the track plays, so early on you are looking at the first few seconds stretched across the panel; past sixty seconds it scrolls and keeps the last minute. Resets on every track change. Levels are relative to full scale, not calibrated.' },
  loudtime: { t:'Crest factor', u:'https://en.wikipedia.org/wiki/Crest_factor', verified:false,
    d:'Loudness alone over the last sixty seconds, with no band lines competing for the height. The filled area is the VU average (300ms ballistics); the thin line above it is the PPM peak (5ms attack). The GAP between them is crest factor by eye — wide while the material still has transients, collapsing to a narrow band when it has been heavily limited. The vertical axis is deliberately unlabelled: it is a normalised VU scale aligned to −6 dBFS, and that alignment is a choice made here, not a standard, so no dB figures are printed against it.' },
  drops: { t:'Derivative', u:'https://en.wikipedia.org/wiki/Special:Search?search=derivative+rate+of+change+signal', verified:false,
    d:'The filled area is bass energy. The bright vertical flares are its RATE OF RISE over about 0.4s, so a fast climb out of a quiet passage lights up and a steady loud passage does not. The dashed marker is the steepest rise so far in this track. It renders change; it does not classify anything as a drop.' },
  journey: { t:'Circle of fifths', u:'https://en.wikipedia.org/wiki/Circle_of_fifths', verified:false,
    d:'Every harmonic move of the set drawn across the Camelot circle. Bright is played, faint is ahead. The Camelot wheel is a relabelling of the circle of fifths.' }
};

/* The default set: one of each kind rather than three flavours of the same.
   time-frequency / harmony / navigation / stereo / mix-state / progress */
const DEFAULTS = ['waterfall','chroma','camelot','gonio','transition','position'];

return {
  register(id, label, draw, opts) {
    reg.set(id, { id, label, draw, note: (opts && opts.note) || '' }); return id;
  },
  get: id => reg.get(id),
  has: id => reg.has(id),
  list: () => [...reg.values()].map(p => ({ k: p.id, n: p.label, hint: p.note })),
  wiki: id => WIKI[id] || null,
  get defaults() { return DEFAULTS.slice(); },
  get size() { return reg.size; }
};
})();

/* ONE title cleaner for every panel in this file — LEDGER 104, third time.
   `Artist - Album - NN Title` reads as `Title` in a panel that has no room
   for the rest, and falls back to the raw name when the pattern does not
   match. Both halves of the strip are GATED, and both gates were paid for:
   `[^-]+-\s*` (no space required) ate the `8-` out of `LukHash - 8-Bit
   Warrior` and left `Bit Warrior`, and `\d+\s*` then ate a bare leading
   digit off whatever survived. A SPACED ` - ` separator and a `\d+\s+`
   number strip keep the title whole, and `LukHash - GLITCH - 02 DOOMSDAY`
   still comes back `DOOMSDAY`. The card and the track list carry the same
   two gates; three more copies of the ungated form were living in this file
   until 2026-09-01, which is why there is now one of it. Change it here or
   not at all — and RUN it, do not read it (ledger 104's own lesson). */
const DWP_clean = n => String(n || '')
  .replace(/^[^-]+ - /, '').replace(/^[^-]+ - /, '').replace(/^\d+\s+/, '') || String(n || '');

/* ── the four later panels ────────────────────────────────────────────── */

/* SPECTROGRAM — calibrated against a MEASURED distribution, not a guess.
   Real material: p10 -23dB, median -10dB, peak -3.7dB. An earlier -62dB floor
   mapped the median to 0.84 and produced a solid block. Floor -50, ceiling -3,
   gamma 3 to spread the mids. See the saturation table in the build log.

   THE DEVICE-PIXEL BUG, worth understanding before touching this again:
   getImageData/putImageData work in DEVICE pixels and IGNORE the canvas
   transform. fillRect HONOURS the transform. The first version scrolled its
   history in CSS coordinates while drawing the new column in transformed
   ones — so on a devicePixelRatio of 1.75 it scrolled a 233x259 corner of a
   455x453 buffer and drew the new column somewhere else entirely, and the
   right-edge pixel read [0,0,0,0]. It would have worked perfectly on a
   non-retina display, which is what made it hard to see. Fix: do the whole
   panel untransformed, in device pixels.

   THAT FIX LIVED IN A PATCH FILE UNTIL 2026-09-01. patch-01-spectrogram.js
   re-registered the panel at load and this registration was still the old
   one, so a page that failed to load one script silently got the broken
   panel back with the boot gate none the wiser (review M12). The patch's
   implementation IS this one now; every calibration number is carried over
   unchanged (floor/ceiling/gamma, 40-16000 Hz, the hue ramp, padL 26, the
   octave list, the .28 rule alpha).

   ONE CHANGE FROM THE PATCH, and it is plumbing rather than calibration: the
   scale comes from `canvas.width / w` instead of `window.devicePixelRatio`.
   The drawing functions live in the OPENER, so a panel popped out onto a
   second screen read the laptop's ratio and not the projector's; and the
   box is w x h, which in the popout is smaller than the canvas (the title
   strip sits below it). Deriving the ratio from the canvas is exact in both
   places and keeps the panel inside the box it was given. */
window.DWPANELS.register('waterfall', 'spectrogram', function (c, w, h, T, D) {
  if (!D.freq) return;
  const FLOOR = -50, CEIL = -3, GAMMA = 3;
  const cv = c.canvas;
  /* device pixels per CSS pixel, measured off THIS canvas — never off a
     window, which may be the opener's rather than the one being drawn on */
  const dpr = (cv && cv.width && w) ? cv.width / w : 1;
  const W = Math.max(1, Math.round(w * dpr)), H = Math.max(1, Math.round(h * dpr));
  const padL = Math.round(26 * dpr);

  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);            /* device pixels from here */

  try {
    const img = c.getImageData(padL + 1, 0, Math.max(1, W - padL - 1), H);
    c.putImageData(img, padL, 0);
  } catch (e) { /* tainted canvas — degrade to a static column */ }

  const x = W - 1, SR = 44100, N = D.freq.length * 2;
  const FMIN = 40, FMAX = 16000;
  const lmin = Math.log2(FMIN), lspan = Math.log2(FMAX) - lmin;

  for (let y = 0; y < H; y++) {
    const fr = 1 - (y / H), f = Math.pow(2, lmin + fr * lspan);
    const bin = Math.min(D.freq.length - 1, Math.max(1, Math.round(f * N / SR)));
    const raw = D.freq[bin] / 255;
    const db = raw > 0.0005 ? 20 * Math.log10(raw) : -90;
    const v = Math.pow(Math.max(0, Math.min(1, (db - FLOOR) / (CEIL - FLOOR))), GAMMA);
    if (v < 0.03) c.fillStyle = T.bg;
    else {
      const reg = window.DWREGISTER && window.DWREGISTER.mode;
      const base = (reg && reg.on) ? reg.hue : 225;
      c.fillStyle = 'hsl(' + (base - v * 135).toFixed(0) + ','
                  + (40 + v * 50).toFixed(0) + '%,'
                  + (3 + Math.pow(v, 0.6) * 66).toFixed(0) + '%)';
    }
    c.fillRect(x, y, 1, 1);
  }

  /* octave axis — so you can locate what you are looking at */
  c.fillStyle = T.bg; c.fillRect(0, 0, padL, H);
  c.font = (7 * dpr).toFixed(0) + 'px ' + T.fn;
  c.textAlign = 'right'; c.textBaseline = 'middle';
  [[55,'A1'],[110,'A2'],[220,'A3'],[440,'A4'],
   [880,'A5'],[1760,'A6'],[3520,'A7'],[7040,'A8']].forEach(function (p) {
    const fr = (Math.log2(p[0]) - lmin) / lspan;
    if (fr < 0 || fr > 1) return;
    const y = H - fr * H;
    c.strokeStyle = T.line; c.globalAlpha = .28; c.lineWidth = dpr;
    c.beginPath(); c.moveTo(padL, y); c.lineTo(W, y); c.stroke();
    c.globalAlpha = 1;
    c.fillStyle = T.dim; c.fillText(p[1], padL - 3 * dpr, y);
  });

  c.restore();
  /* THE HINT IS NOT A UNIT. The series is 20*log10(byte/255) of a byte the
     analyser has already mapped through its own min/max decibel range, so
     "dB" would name a quantity this is not; no number is printed against
     the colour anywhere on the panel. A word, not an axis label. */
}, { note: 'relative level, octave axis' });

/* POLYGRAPH — five pens on ruled chart paper. The lie-detector look, and
   every channel is a real signal rather than decoration. */
window.DWPANELS.register('polygraph', 'polygraph', (function () {
  const CH = ['BASS','MID','HIGH','FLUX','WIDTH'], N = 600;
  let buf = null, i = 0, filled = 0;
  return function (c, w, h, T, D) {
    if (!buf) buf = Array.from({ length: CH.length }, () => new Float32Array(N));
    if (D.freq) {
      const bd = (a, b) => { let s = 0, n = 0;
        for (let k = a; k < b && k < D.freq.length; k++) { s += D.freq[k]; n++; }
        return n ? s / n / 255 : 0; };
      buf[0][i] = bd(0, 12); buf[1][i] = bd(12, 90); buf[2][i] = bd(90, D.freq.length);
      buf[3][i] = Math.min(1, (D.flux || 0) * 14);
      buf[4][i] = D.stereo ? Math.min(1, D.stereo.width * 2.2) : 0;
      i = (i + 1) % N; if (filled < N) filled++;
    }
    c.fillStyle = T.bg; c.fillRect(0, 0, w, h);
    const padL = 42, gw = w - padL - 6, gh = h - 12, rowH = gh / CH.length;
    c.strokeStyle = T.line; c.lineWidth = 1; c.globalAlpha = .55;
    for (let k = 0; k <= CH.length; k++) { const y = 6 + k * rowH;
      c.beginPath(); c.moveTo(padL, y); c.lineTo(w - 6, y); c.stroke(); }
    c.globalAlpha = .25;
    for (let k = 0; k <= 10; k++) { const xx = padL + (k / 10) * gw;
      c.beginPath(); c.moveTo(xx, 6); c.lineTo(xx, h - 6); c.stroke(); }
    c.globalAlpha = 1;
    const cols = [T.ac2, T.ac, '#3ee68a', '#ffb02e', T.ac];
    CH.forEach((name, ci) => {
      const y0 = 6 + ci * rowH, mid = y0 + rowH / 2, amp = rowH * .42;
      c.fillStyle = T.dim; c.font = '7.5px ' + T.fn;
      c.textAlign = 'right'; c.textBaseline = 'middle';
      c.fillText(name, padL - 6, mid);
      c.strokeStyle = cols[ci]; c.lineWidth = 1.3; T.g(c, cols[ci], 6); c.beginPath();
      for (let k = 0; k < filled; k++) {
        const idx = (i + k) % N, x = padL + (k / (filled - 1 || 1)) * gw;
        const y = mid - (buf[ci][idx] - .5) * amp * 2;
        k ? c.lineTo(x, y) : c.moveTo(x, y);
      }
      c.stroke(); c.shadowBlur = 0;
      const last = buf[ci][(i - 1 + N) % N];
      c.fillStyle = cols[ci]; T.g(c, cols[ci], 10);
      c.beginPath(); c.arc(w - 7, mid - (last - .5) * amp * 2, 2.2, 0, 7); c.fill();
      c.shadowBlur = 0;
    });
  };
})(), { note: 'strip chart · 5 pens' });

/* TRACK POSITION — progress with beat ticks and the exit downbeat marked. */
window.DWPANELS.register('position', 'track position', function (c, w, h, T, D) {
  c.fillStyle = T.bg; c.fillRect(0, 0, w, h);
  /* The DECK's track (D.now), not set[state.idx] — the two can differ.
     The index is the fallback for the window before playback starts. */
  const t = D.now || D.set[D.state.idx];
  if (!t) { c.fillStyle = T.dim; c.font = '9px ' + T.fn; c.textAlign = 'center';
    c.textBaseline = 'middle'; c.fillText('no track playing', w / 2, h / 2); return; }
  const pad = 10, bw = w - pad * 2, y = h / 2;
  /* The deck's rate and entry, not the plan's: a straight track enters at 0
     and runs at 1; a jumped-to track runs at 1 whatever `_stretch` says.
     D.blend is the SCHEDULE — its `at` is the real exit (downbeat-snapped,
     moved by a blend-now, shortened by a stone's dwell) and its `dur` is
     already through the stretch. Deriving either from dur-16 was wrong
     twice, as the loop's own note says. */
  const rate = D.deck ? D.deck.startRate : (t._stretch || 1);
  const entry = t._unlocked ? 0 : ((t.beats && t.beats[0]) || 0);
  const B = D.blend;
  const dur = (B && B.dur > 0) ? B.dur : (t.dur - entry) / rate;
  const exitAt = B ? B.at : (dur - 16);
  const el = (typeof D.elapsed === 'number' && D.elapsed > 0)
    ? D.elapsed
    : (D.transLeft != null ? Math.max(0, exitAt - D.transLeft) : 0);
  const frac = Math.max(0, Math.min(1, el / dur));
  c.strokeStyle = T.line; c.lineWidth = 1; c.strokeRect(pad, y - 11, bw, 22);
  if (t.beats && t.beats.length && !t._unlocked) { c.fillStyle = T.line;
    for (let k = 0; k < t.beats.length; k += 16) {
      const f = ((t.beats[k] - entry) / rate) / dur;
      if (f >= 0 && f <= 1) c.fillRect(pad + f * bw, y - 9, 1, 18); } }
  c.fillStyle = T.ac; T.g(c, T.ac, 8); c.fillRect(pad, y - 10, frac * bw, 20); c.shadowBlur = 0;
  const ex = Math.max(0, Math.min(1, exitAt / dur));
  c.fillStyle = T.ac2; T.g(c, T.ac2, 10);
  c.fillRect(pad + ex * bw - 1, y - 14, 2, 28); c.shadowBlur = 0;
  c.font = '8px ' + T.fn; c.textBaseline = 'middle'; c.fillStyle = T.dim;
  const mmss = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
  c.textAlign = 'left';  c.fillText(mmss(el), pad, y - 20);
  c.textAlign = 'right';
  c.fillText((B ? 'blend at ' : 'blend ~') + mmss(exitAt) + (t._unlocked ? ' · straight' : ''), w - pad, y - 20);
  c.textAlign = 'center'; c.fillStyle = T.ac2;
  c.fillText(DWP_clean(t.name).slice(0, 40), w / 2, y + 22);
}, { note: 'progress + exit point' });

/* LOUDNESS — RELATIVE. Proper K-weighting per ITU-R BS.1770 is approximated
   with a crude shelf, so trends are meaningful and the absolute number is NOT
   comparable to a real meter. The panel says so on its face. */
window.DWPANELS.register('loudness', 'loudness', (function () {
  const H = 240; let hist = new Float32Array(H), i = 0, filled = 0;
  return function (c, w, h, T, D) {
    c.fillStyle = T.bg; c.fillRect(0, 0, w, h); if (!D.freq) return;
    let sum = 0, wt = 0; const N = D.freq.length * 2;
    for (let k = 1; k < D.freq.length; k++) {
      const f = k * 44100 / N;
      let g2 = 1;
      if (f < 100) g2 = .25; else if (f > 1000 && f < 4000) g2 = 1.4; else if (f > 10000) g2 = .7;
      const m = D.freq[k] / 255; sum += m * m * g2; wt += g2;
    }
    const rms = Math.sqrt(sum / (wt || 1));
    hist[i] = rms > 0.0001 ? 20 * Math.log10(rms) - 10 : -70;
    i = (i + 1) % H; if (filled < H) filled++;
    let mean = 0; for (let k = 0; k < filled; k++) mean += hist[k]; mean /= (filled || 1);
    const pad = 8, gy = h - 26;
    c.lineWidth = 1;
    /* The -14 / -23 LUFS reference lines were REMOVED 2026-08-30. They broke
       CLAUDE.md's rule directly — "do not label an axis with numbers the
       project chose" — and they broke it twice: the LABEL asserted an
       absolute broadcast target, and the POSITION was computed from this
       panel's own uncalibrated series, `20*log10(rms) - 10` over FFT bytes
       with a chosen -10 offset and no reference to full scale. So the lines
       claimed a calibration that does not exist, at heights that meant
       nothing, on a panel whose own readout correctly says `LU · relative`
       and whose glossary already says it is not comparable to a real meter.
       `loudtime` two panels away refuses to label its axis and spends nine
       lines explaining why; this now agrees with it. Proportional gridlines
       would be honest (a quarter IS a quarter) if any are ever wanted —
       absolute ones cannot be, until something calibrates this to BS.1770. */
    c.strokeStyle = T.ac; c.lineWidth = 1.5; T.g(c, T.ac, 7); c.beginPath();
    for (let k = 0; k < filled; k++) {
      const idx = (i + k) % H, x = pad + (k / (filled - 1 || 1)) * (w - pad * 2);
      const y = gy - ((Math.max(-40, Math.min(0, hist[idx])) + 40) / 40) * (gy - pad);
      k ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.stroke(); c.shadowBlur = 0;
    c.font = '11px ' + T.fn; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillStyle = mean > -12 ? '#ffb02e' : T.ac;
    c.fillText(mean.toFixed(1) + ' LU · relative', w / 2, h - 12);
  };
})(), { note: 'relative, not true LUFS' });

/* SET JOURNEY — the night's harmonic path across the Camelot circle. */
window.DWPANELS.register('journey', 'set journey', function (c, w, h, T, D) {
  c.fillStyle = T.bg; c.fillRect(0, 0, w, h);
  const S = D.set;
  if (!S.length) { c.fillStyle = T.dim; c.font = '9px ' + T.fn; c.textAlign = 'center';
    c.textBaseline = 'middle'; c.fillText('no set built', w / 2, h / 2); return; }
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 14;
  const pt = cd => { if (!cd || cd === '?') return null;
    const n = +cd.slice(0, -1), L = cd.slice(-1); if (isNaN(n)) return null;
    const a = ((n - 1) / 12) * Math.PI * 2 - Math.PI / 2, rr = L === 'A' ? R * .55 : R;
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]; };
  c.strokeStyle = T.line; c.lineWidth = 1;
  c.beginPath(); c.arc(cx, cy, R, 0, 7); c.stroke();
  c.beginPath(); c.arc(cx, cy, R * .60, 0, 7); c.stroke();
  /* where the DECK's track sits in this list; the index is the fallback */
  const byId = D.now ? S.indexOf(D.now) : -1;
  const idx = byId > -1 ? byId : D.state.idx;
  for (let k = 1; k < S.length; k++) {
    const a = pt(S[k - 1].camelot), b = pt(S[k].camelot); if (!a || !b) continue;
    const done = k <= idx;
    c.strokeStyle = done ? T.ac2 : T.line;
    c.lineWidth = done ? 1.4 : .8; c.globalAlpha = done ? .85 : .35;
    c.beginPath(); c.moveTo(a[0], a[1]); c.lineTo(b[0], b[1]); c.stroke();
  }
  c.globalAlpha = 1;
  const cur = pt(S[idx] && S[idx].camelot);
  if (cur) { c.fillStyle = T.ac; T.g(c, T.ac, 12);
    c.beginPath(); c.arc(cur[0], cur[1], 5, 0, 7); c.fill(); c.shadowBlur = 0; }
  c.fillStyle = T.dim; c.font = '8px ' + T.fn;
  c.textAlign = 'center'; c.textBaseline = 'bottom';
  c.fillText((idx + 1) + ' of ' + S.length + ' · harmonic path', cx, h - 4);
}, { note: 'camelot trail' });

/* Every panel, for the MEGA layout. */
window.DWPANELS.ALL = ['waterfall','chroma','camelot','gonio','transition','position',
                       'polygraph','spectrum','journey','loudness','vu','scope'];
/* Not in ALL: mega is twelve cells and these are alternates to swap IN, which
   is what the swap menu is for. Adding them to ALL would silently change what
   mega means and evict two panels chosen deliberately. */
window.DWPANELS.EXTRA = ['timeline','drops','loudtime'];

/* ── the seven that were built, worked, and were lost in packaging ──────
   These were live and verified — the running page reported "12 panels
   registered, 6 slots" — but the register() calls never made it into this
   module, so DEFAULTS named four panels (chroma, camelot, gonio, transition)
   that nothing had registered. The loop's `if (!p) return;` then skipped them
   in silence and four of the six default cells stayed blank forever.

   Recovered latest-wins, not first-found. The line that used to sit here said
   "the spectrogram above is already the newest version"; it was NOT — the
   device-pixel fix lived only in patch-01-spectrogram.js, which re-registered
   the panel over this one at load, and the claim went unchallenged for as
   long as the patch kept loading. The patch's implementation is the one
   above now and the patch is a no-op (review 2026-09-01, M12). Calibration
   constants are carried
   over exactly as they were measured — the chroma visibility thresholds
   (.12/.6) and its 55-5000 Hz band, the goniometer's 900-point decimation,
   the VU ballistics, the 45% bass-swap point. Not one number was re-chosen. */

const DWP_col = (l, a) => (window.DWREGISTER && window.DWREGISTER.col(l, a)) || null;
const DWP_PITCH = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

window.DWPANELS.register('spectrum', 'spectrum', function (c, w, h, T, D) {
  c.fillStyle = T.bg; c.fillRect(0, 0, w, h); if (!D.freq) return;
  const n = Math.max(16, Math.floor(w / 9)), bw = w / n;
  for (let i = 0; i < n; i++) {
    const lo = Math.floor(Math.pow(i / n, 2.2) * D.freq.length);
    const hb = Math.max(lo + 1, Math.floor(Math.pow((i + 1) / n, 2.2) * D.freq.length));
    let m = 0; for (let j = lo; j < hb; j++) m = Math.max(m, D.freq[j]);
    const bh = (m / 255) * (h - 3);
    const gr = c.createLinearGradient(0, h, 0, h - bh);
    gr.addColorStop(0, DWP_col(52) || T.ac2); gr.addColorStop(1, DWP_col(72) || T.ac);
    c.fillStyle = gr; T.g(c, DWP_col(52) || T.ac2, 7);
    c.fillRect(i * bw + 1, h - bh, bw - 2, bh);
  }
  c.shadowBlur = 0;
}, { note: 'fft bars' });

/* twelve pitch CLASSES, not notes. Folded across all octaves. */
window.DWPANELS.register('chroma', 'pitch classes', function (c, w, h, T, D) {
  c.fillStyle = T.bg; c.fillRect(0, 0, w, h); if (!D.freq) return;
  const b = new Float32Array(12), N = D.freq.length * 2;
  for (let i = 1; i < D.freq.length; i++) {
    const f = i * 44100 / N;
    if (f < 55 || f > 5000) continue;
    b[((Math.round(69 + 12 * Math.log2(f / 440)) % 12) + 12) % 12] += D.freq[i] / 255;
  }
  let mx = 0; for (const v of b) mx = Math.max(mx, v);
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 13;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 2, v = mx ? b[i] / mx : 0;
    c.strokeStyle = T.line; c.lineWidth = 1; c.beginPath(); c.moveTo(cx, cy);
    c.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); c.stroke();
    if (v > .12) {
      const k = v > .6 ? (DWP_col(58) || T.ac2) : (DWP_col(70) || T.ac);
      c.strokeStyle = k; c.lineWidth = 3; T.g(c, k, 10); c.beginPath(); c.moveTo(cx, cy);
      c.lineTo(cx + Math.cos(a) * r * v, cy + Math.sin(a) * r * v); c.stroke(); c.shadowBlur = 0;
    }
    c.fillStyle = v > .5 ? (DWP_col(75) || T.ac) : T.dim;
    c.font = '9px ' + T.fn; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(DWP_PITCH[i], cx + Math.cos(a) * (r + 8), cy + Math.sin(a) * (r + 8));
  }
}, { note: 'chromagram, not notes' });

window.DWPANELS.register('scope', 'scope', function (c, w, h, T, D) {
  c.fillStyle = T.bg; c.fillRect(0, 0, w, h);
  if (!D.wave) {
    c.strokeStyle = T.line; c.beginPath();
    c.moveTo(0, h / 2); c.lineTo(w, h / 2); c.stroke(); return;
  }
  const k = DWP_col(62) || T.ac; c.strokeStyle = k; c.lineWidth = 1.5; T.g(c, k, 9);
  c.beginPath(); const s = D.wave.length / w;
  for (let x = 0; x < w; x++) {
    const v = (D.wave[Math.floor(x * s)] - 128) / 128;
    const y = h / 2 + v * (h / 2 - 3); x ? c.lineTo(x, y) : c.moveTo(x, y);
  }
  c.stroke(); c.shadowBlur = 0;
}, { note: 'oscilloscope' });

/* Pitch class -> Camelot NUMBER, derived from the engine's own table rather
   than duplicated. Note this project's tables put the same tonic on the same
   number in both modes (A is 11 major and 11 minor), so a pitch class picks a
   number outright and says nothing about mode. That is exactly why the live
   overlay below can be honest: it marks where the sounding energy is, and
   makes no claim about the key. */
let DWP_PC2NUM = null;
function dwpPitchToNumber() {
  if (DWP_PC2NUM) return DWP_PC2NUM;
  if (!(window.DW && window.DW.camelot)) return null;
  DWP_PC2NUM = DWP_PITCH.map(n => {
    const code = window.DW.camelot(n, 'major');
    return code && code !== '?' ? +code.slice(0, -1) : null;
  });
  return DWP_PC2NUM;
}

/* Chroma folded to 12 pitch classes. Same band and same fold as the chroma
   panel, and the same measured .12 visibility floor — reusing the constant
   that was calibrated against real signal rather than inventing a second one
   for the same measurement. */
/* Smoothed across frames, deliberately. The raw chroma is renormalised to its
   own maximum every frame, so ranking it directly means three positions are
   always lit and always reshuffling — the wheel pulses constantly whether or
   not the harmony moved. 0.985/frame is the same time constant the register
   colour uses, measured during the damping work rather than picked here: at
   ~60fps it is roughly a one-second memory, long enough for the display to
   settle on a tonal centre and still follow a chord change. */
let DWP_chSmooth = null;
function dwpChromaSmoothed(freq) {
  const raw = dwpChroma(freq);
  if (!raw) { DWP_chSmooth = null; return null; }
  if (!DWP_chSmooth) DWP_chSmooth = new Float32Array(12);
  for (let i = 0; i < 12; i++)
    DWP_chSmooth[i] = DWP_chSmooth[i] * .94 + raw[i] * .06;
  let mx = 0; for (const v of DWP_chSmooth) mx = Math.max(mx, v);
  if (!mx) return null;
  const out = new Float32Array(12);
  for (let i = 0; i < 12; i++) out[i] = DWP_chSmooth[i] / mx;
  return out;
}

function dwpChroma(freq) {
  if (!freq) return null;
  const b = new Float32Array(12), N = freq.length * 2;
  for (let i = 1; i < freq.length; i++) {
    const f = i * 44100 / N;
    if (f < 55 || f > 5000) continue;
    b[((Math.round(69 + 12 * Math.log2(f / 440)) % 12) + 12) % 12] += freq[i] / 255;
  }
  let mx = 0; for (const v of b) mx = Math.max(mx, v);
  if (!mx) return null;
  for (let i = 0; i < 12; i++) b[i] /= mx;
  return b;
}

/* ── centre sprite ─────────────────────────────────────────────────────
   Recovered from the live build's __drawJam, which never made it into the
   package. Spinning arms, bobbing on the bass, kicking on an onset.

   Selectable via DWPANELS.sprite. The alternatives are original shapes, not
   anybody's mascot — this draws no brand character and should not start. */
const DWP_JAM = { pulse: 0, bob: 0, spin: 0, arms: 7, blink: 0 };

/* Seconds since the last call. Anything expressed as a RATE (orbits per bar,
   samples per second) has to use this rather than a fixed per-frame step, or
   it runs at whatever the framerate happens to be. */
/* KEYED PER CALLER. A single shared lastT was wrong the moment there was
   more than one consumer: whichever panel drew first in a frame took the real
   elapsed time and set the clock, and every later caller in that same frame
   got ~0.3ms. The sprite happened to draw first, so it looked fine while the
   two history panels were quietly starved to a standstill. */
const DWP_lastT = {};
function dwpDT(key) {
  const k = key || 'default', now = performance.now(), prev = DWP_lastT[k];
  DWP_lastT[k] = now;
  return prev ? Math.min(0.1, (now - prev) / 1000) : 0.016;
}

/* roundRect is in Chromium, but guard it — a missing primitive here would
   take the whole camelot panel down, not just the sprite. */
function dwpRR(c, x, y, w, h, r) {
  if (c.roundRect) { c.beginPath(); c.roundRect(x, y, w, h, r); return; }
  c.beginPath();
  c.moveTo(x + r, y); c.lineTo(x + w - r, y); c.quadraticCurveTo(x + w, y, x + w, y + r);
  c.lineTo(x + w, y + h - r); c.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  c.lineTo(x + r, y + h); c.quadraticCurveTo(x, y + h, x, y + h - r);
  c.lineTo(x, y + r); c.quadraticCurveTo(x, y, x + r, y);
  c.closePath();
}

const DWP_SPRITES = {
  none: null,

  /* the recovered one, in its own proportions */
  jam(c, w, h, T, bassV, hit, bright) {
    const J = DWP_JAM;
    J.pulse = Math.max(J.pulse * 0.90, hit ? 1 : 0);
    J.bob = J.bob * 0.86 + bassV * 0.14;
    J.spin += 0.005 + bright * 0.02 + J.pulse * 0.06;
    const cx = w / 2, cy = h / 2 + Math.sin(J.spin * 3) * h * 0.018 - J.bob * h * 0.035;
    const R = Math.min(w, h) * 0.062 * (1 + J.pulse * 0.28 + J.bob * 0.20);
    const col = DWP_col(60 + J.pulse * 20) || T.ac, col2 = DWP_col(72) || T.ac2;
    c.save(); c.translate(cx, cy); c.rotate(J.spin * 0.5);
    T.g(c, col, 6 + J.pulse * 12);
    for (let i = 0; i < J.arms; i++) {
      const a = (i / J.arms) * Math.PI * 2;
      const len = R * (1 + (i % 2 ? 0.5 : 0.12) + Math.sin(J.spin * 2 + i) * 0.09);
      c.strokeStyle = i % 2 ? col : col2;
      c.lineWidth = Math.max(1.5, R * 0.17); c.lineCap = 'round';
      c.beginPath();
      c.moveTo(Math.cos(a) * R * 0.2, Math.sin(a) * R * 0.2);
      c.lineTo(Math.cos(a) * len, Math.sin(a) * len); c.stroke();
    }
    c.fillStyle = col; c.beginPath();
    c.arc(0, 0, R * 0.30 * (1 + J.pulse * 0.35), 0, 7); c.fill();
    c.shadowBlur = 0; c.restore();
    const fy = cy + R * 1.7, sp = R * 0.45, t2 = Math.sin(J.spin * 6) * R * 0.20;
    c.fillStyle = col2; T.g(c, col2, 4);
    c.beginPath(); c.ellipse(cx - sp, fy + t2, R * 0.17, R * 0.10, 0, 0, 7); c.fill();
    c.beginPath(); c.ellipse(cx + sp, fy - t2, R * 0.17, R * 0.10, 0, 0, 7); c.fill();
    c.shadowBlur = 0;
  },

  /* A wee robot, jamming. Original shape — knees bend on the bass, arms pump
     on the onset, antenna whips, and it blinks now and then so it reads as
     alive rather than as a diagram. Deliberately nobody's mascot. */
  robot(c, w, h, T, bassV, hit, bright) {
    const J = DWP_JAM;
    J.pulse = Math.max(J.pulse * 0.88, hit ? 1 : 0);
    J.bob = J.bob * 0.85 + bassV * 0.15;
    J.spin += 0.022 + bright * 0.03 + J.pulse * 0.04;
    J.blink = J.blink > 0 ? J.blink - 1 : (Math.sin(J.spin * 0.37) > 0.9993 ? 9 : 0);

    const U = Math.min(w, h) * 0.030;
    const body = DWP_col(58) || T.ac, trim = DWP_col(74) || T.ac2;
    const crouch = J.bob * U * 0.9;
    const cx = w / 2, cy = h / 2 - U * 0.2 + Math.sin(J.spin * 2) * U * 0.16 - J.pulse * U * 0.35;
    const lean = Math.sin(J.spin) * 0.09 + J.pulse * 0.05;

    c.save(); c.translate(cx, cy); c.rotate(lean);
    T.g(c, body, 3 + J.pulse * 11);
    c.lineCap = 'round';

    /* legs — the step alternates, and it sinks on the bass */
    const step = Math.sin(J.spin * 3) * U * 0.45;
    c.strokeStyle = body; c.lineWidth = Math.max(1.2, U * 0.26);
    [-1, 1].forEach((sg, i) => {
      c.beginPath();
      c.moveTo(sg * U * 0.45, U * 1.05);
      c.lineTo(sg * U * 0.45 + (i ? step : -step), U * (2.0 - crouch / U * 0.5));
      c.stroke();
    });

    /* arms — thrown up on a hit */
    const lift = -0.35 - J.pulse * 1.15;
    c.strokeStyle = trim; c.lineWidth = Math.max(1.1, U * 0.22);
    [-1, 1].forEach((sg, i) => {
      c.beginPath();
      c.moveTo(sg * U * 0.9, -U * 0.05);
      c.lineTo(sg * U * 1.65, U * (lift + (i ? 0.22 : -0.22)));
      c.stroke();
    });

    c.fillStyle = body;
    dwpRR(c, -U * 0.9, -U * 0.55, U * 1.8, U * 1.65, U * 0.32); c.fill();
    dwpRR(c, -U * 0.8, -U * 2.15, U * 1.6, U * 1.45, U * 0.38); c.fill();

    /* eyes, and a blink that is just a scaled pupil so it cannot misdraw */
    const eo = J.blink > 0 ? 0.12 : 1;
    c.fillStyle = T.bg;
    [-1, 1].forEach(sg => {
      c.beginPath();
      c.ellipse(sg * U * 0.34, -U * 1.5, U * 0.22, U * 0.24 * eo, 0, 0, 7); c.fill();
    });
    c.fillStyle = trim;
    [-1, 1].forEach(sg => {
      c.beginPath();
      c.ellipse(sg * U * 0.34, -U * 1.5, U * 0.11, U * 0.12 * eo, 0, 0, 7); c.fill();
    });

    /* antenna */
    const aw = Math.sin(J.spin * 4) * U * 0.5;
    c.strokeStyle = trim; c.lineWidth = Math.max(1, U * 0.14);
    c.beginPath(); c.moveTo(0, -U * 2.15);
    c.quadraticCurveTo(aw * 0.5, -U * 2.8, aw, -U * 3.15); c.stroke();
    c.fillStyle = trim; c.beginPath();
    c.arc(aw, -U * 3.15, U * 0.22 * (1 + J.pulse * 0.7), 0, 7); c.fill();

    c.shadowBlur = 0; c.restore();
  },

  /* original: a small orbit, quieter than jam */
  orbit(c, w, h, T, bassV, hit, bright, bpm) {
    const J = DWP_JAM;
    J.pulse = Math.max(J.pulse * 0.88, hit ? 1 : 0);
    /* ONE ORBIT PER BAR when a tempo is known, so the planets come round on
       the downbeat instead of at an arbitrary rate. Four beats to the bar is
       the same 4/4 assumption the rest of the engine makes. With no tempo —
       listen mode — it falls back to a fixed drift, because inferring tempo
       from live audio is a detector and not something to guess at here. */
    const dt = dwpDT('sprite');
    if (bpm > 20 && bpm < 300) J.spin += (Math.PI * 2 / (60 / bpm * 4)) * dt;
    else J.spin += (0.6 + bright * 1.8) * dt;
    J.spin += J.pulse * 0.05 * dt * 60 * 0.016;
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.055 * (1 + J.pulse * 0.3);
    const col = DWP_col(66) || T.ac, col2 = DWP_col(52) || T.ac2;
    c.save(); T.g(c, col, 5 + J.pulse * 10);
    c.strokeStyle = col; c.lineWidth = 1;
    c.beginPath(); c.arc(cx, cy, R * 1.9, 0, 7); c.stroke();
    for (let i = 0; i < 3; i++) {
      const a = J.spin * (1 + i * 0.35) + i * 2.1;
      const rr = R * (1.9 - i * 0.45);
      c.fillStyle = i % 2 ? col2 : col;
      c.beginPath();
      c.arc(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, R * (0.24 + J.pulse * 0.12), 0, 7);
      c.fill();
    }
    c.fillStyle = col; c.beginPath();
    c.arc(cx, cy, R * (0.4 + bassV * 0.5), 0, 7); c.fill();
    c.shadowBlur = 0; c.restore();
  },

  /* original: a level-reactive bar figure, no rotation */
  pulse(c, w, h, T, bassV, hit, bright) {
    const J = DWP_JAM;
    J.pulse = Math.max(J.pulse * 0.85, hit ? 1 : 0);
    J.bob = J.bob * 0.82 + bassV * 0.18;
    const cx = w / 2, cy = h / 2, R = Math.min(w, h) * 0.07;
    const col = DWP_col(64) || T.ac;
    c.save(); T.g(c, col, 4 + J.pulse * 14); c.fillStyle = col;
    for (let i = -2; i <= 2; i++) {
      const hgt = R * (0.5 + Math.abs(Math.sin(i * 0.9 + J.bob * 6)) * (0.7 + J.pulse));
      c.fillRect(cx + i * R * 0.42 - R * 0.13, cy - hgt / 2, R * 0.26, hgt);
    }
    c.shadowBlur = 0; c.restore();
  }
};

/* Late registration, so a module loaded after this one can contribute a
   centre sprite without editing this table. The pixel mascots in
   deckwave-sprites.js arrive this way. Adding to DWP_SPRITES directly from
   outside was impossible — it is a closure const, and the setter below
   rejects any id it does not already know. */
window.DWPANELS.addSprite = function (id, fn) {
  if (!id || typeof fn !== 'function') return false;
  DWP_SPRITES[id] = fn;
  window.DWPANELS.sprites = Object.keys(DWP_SPRITES);
  /* a preference saved before this sprite existed can now be honoured */
  try { const sv = localStorage.getItem('dw-sprite');
    if (sv === id) DWP_sprite = id; } catch (e) {}
  return true;
};

let DWP_sprite = 'jam';
try { const sv = localStorage.getItem('dw-sprite'); if (sv && (sv in DWP_SPRITES)) DWP_sprite = sv; } catch (e) {}
window.DWPANELS.sprites = Object.keys(DWP_SPRITES);
Object.defineProperty(window.DWPANELS, 'sprite', {
  get() { return DWP_sprite; },
  set(v) { if (v in DWP_SPRITES) { DWP_sprite = v;
    try { localStorage.setItem('dw-sprite', v); } catch (e) {} } }
});

window.DWPANELS.register('camelot', 'camelot wheel', function (c, w, h, T, D) {
  c.fillStyle = T.bg; c.fillRect(0, 0, w, h);
  const S = D.set || [], st = D.state || window.DW.state;
  /* the deck's track and the deck's next, by identity; the index is the
     fallback for before playback starts */
  const cur = D.now || S[st.idx];
  const nxt = D.next || S[(cur ? S.indexOf(cur) : st.idx) + 1];
  /* bass = mean of the lowest 12 bins, exactly as the dashboard computed it */
  let bass = 0;
  if (D.freq) { let s = 0; for (let i = 0; i < 12; i++) s += D.freq[i]; bass = s / 12 / 255; }
  const hit = !!D.hit;
  const cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 16, t = performance.now() / 1000;

  /* LIVE ENERGY OVERLAY — where the sounding audio is landing on the wheel.
     This is chroma, folded onto the tonic ring. It is NOT key detection and
     must never be read as one: a chromagram says which pitch classes carry
     energy, not what key the music is in, and it cannot tell major from minor
     at all — which is why both rings of a number light together.
     Works with no set loaded, so the wheel means something in listen mode. */
  const chroma = dwpChromaSmoothed(D.freq), pc2num = dwpPitchToNumber();
  const liveByNum = new Array(13).fill(0);
  if (chroma && pc2num) {
    /* THE THREE STRONGEST, ranked — not everything above a floor.
       A .12 floor lit almost the whole wheel, because real music carries
       energy in most pitch classes; 24 haloed nodes is not an answer to
       "where is it hitting". "The loudest few" is a display choice and says
       what it means, rather than being a threshold tuned against nothing. */
    const ranked = [];
    for (let i = 0; i < 12; i++) if (pc2num[i]) ranked.push({ n: pc2num[i], v: chroma[i] });
    ranked.sort((a, b) => b.v - a.v);
    const FALLOFF = [1, .55, .3];
    ranked.slice(0, 3).forEach((r, k) => {
      liveByNum[r.n] = Math.max(liveByNum[r.n], r.v * FALLOFF[k]);
    });
  }

  for (let n = 1; n <= 12; n++) {
    const a = ((n - 1) / 12) * Math.PI * 2 - Math.PI / 2 + Math.sin(t * .12) * .02;
    [['A', R * .55], ['B', R]].forEach(function (pair) {
      const L = pair[0], rr = pair[1];
      const code = n + L; let fill = T.line, txt = T.dim, pulse = 0;
      if (cur && cur.camelot === code) { fill = DWP_col(58) || T.ac2; txt = T.bg; pulse = 1; }
      else if (nxt && nxt.camelot === code) { fill = DWP_col(66, .9) || T.ac; txt = T.bg; pulse = .5; }
      else if (cur) {
        const sc = window.DW.camScore(cur.camelot, code);
        if (sc >= .85) { fill = DWP_col(50, .30) || 'rgba(34,232,255,.28)'; txt = DWP_col(72) || T.ac; }
        else if (sc >= .45) fill = DWP_col(42, .13) || 'rgba(34,232,255,.12)';
      }
      const x = cx + Math.cos(a) * rr, y = cy + Math.sin(a) * rr;
      const rad = Math.max(6, R * .125) * (1 + pulse * bass * .45 + (pulse && hit ? .22 : 0));
      /* halo first, so the analysed-key highlight always sits on top of it and
         the two can never be mistaken for each other */
      const lv = liveByNum[n];
      if (lv > 0) {
        /* Selection is smoothed; the HIT is not. punch comes straight from
           this frame's onset and bass, so a lit position flares on the kick
           instead of sitting at a constant brightness. */
        const punch = (hit ? .62 : 0) + bass * .38;
        /* A RING, unglowed, in the warm accent — not a filled disc in the
           cool one. The first version used DWP_col(64) with up to 22px of
           blur, which is the same colour family as the harmonic path drawn
           below at 2px: the path was still being drawn and could not be seen
           against it. An annotation should not outshine the data. */
        const hk = DWP_col(20) || T.ac2;
        c.save();
        c.globalAlpha = Math.min(.75, lv * (.22 + punch * .70));
        c.strokeStyle = hk; c.lineWidth = 1.5 + punch * 1.6;
        c.beginPath(); c.arc(x, y, rad * (1.24 + punch * .22), 0, 7); c.stroke();
        c.restore();
      }
      c.fillStyle = fill; if (pulse) T.g(c, fill, 10 + pulse * 14);
      c.beginPath(); c.arc(x, y, rad, 0, 7); c.fill(); c.shadowBlur = 0;
      c.fillStyle = txt; c.font = Math.max(7, rad * .75) + 'px ' + T.fn;
      c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(code, x, y);
    });
  }
  if (cur && nxt && cur.camelot !== '?' && nxt.camelot !== '?') {
    /* an unknown key ('?') must not draw a path — +'' is 0 and 0 lands on
       the 12 position, which would draw a harmonic move that does not exist */
    const pt = function (cd) {
      const n = +cd.slice(0, -1), L = cd.slice(-1);
      const a = ((n - 1) / 12) * Math.PI * 2 - Math.PI / 2, rr = L === 'A' ? R * .60 : R;
      return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
    };
    try {
      const p1 = pt(cur.camelot), p2 = pt(nxt.camelot);
      const k = DWP_col(62) || T.ac; c.strokeStyle = k; c.lineWidth = 2; T.g(c, k, 10);
      c.setLineDash([5, 4]); c.lineDashOffset = -t * 14;
      c.beginPath(); c.moveTo(p1[0], p1[1]); c.lineTo(p2[0], p2[1]); c.stroke();
      c.setLineDash([]); c.shadowBlur = 0;
    } catch (e) {}
  }
  const spr = DWP_SPRITES[DWP_sprite];
  if (spr) {
    const bpm = (st && st.tempo) || (cur && cur.bpm) || 0;
    try { spr(c, w, h, T, bass, hit,
              chroma ? Math.min(1, chroma[10] + chroma[11]) : 0, bpm); }
    catch (e) {}
  }
}, { note: 'harmonic path · halo is live pitch-class energy, not detected key' });

/* L vs R rotated 45deg with phosphor persistence — mono draws vertical.
   The translucent fill IS the persistence; it is not a missing clear. */
window.DWPANELS.register('gonio', 'goniometer', function (c, w, h, T, D) {
  c.fillStyle = 'rgba(0,0,0,0.16)'; c.fillRect(0, 0, w, h);
  const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 2 - 6;
  c.strokeStyle = T.line; c.lineWidth = 1; c.beginPath(); c.arc(cx, cy, r, 0, 7); c.stroke();
  c.globalAlpha = .5; c.beginPath();
  c.moveTo(cx - r * .72, cy - r * .72); c.lineTo(cx + r * .72, cy + r * .72);
  c.moveTo(cx - r * .72, cy + r * .72); c.lineTo(cx + r * .72, cy - r * .72);
  c.stroke(); c.globalAlpha = 1;
  const L = D.L, R = D.R, stat = D.stereo;
  if (L && R) {
    const k = DWP_col(66) || T.ac; c.fillStyle = k; T.g(c, k, 6);
    const n = Math.min(L.length, R.length), step = Math.max(1, Math.floor(n / 900));
    for (let i = 0; i < n; i += step) {
      const a = (L[i] - 128) / 128, b = (R[i] - 128) / 128;
      c.fillRect(cx + (a - b) * r * .66, cy - (a + b) * r * .66, 1.4, 1.4);
    }
    c.shadowBlur = 0;
  }
  if (stat) {
    const bw = w * .62, bx = (w - bw) / 2, by = h - 9, mid = bx + bw / 2;
    const x = mid + stat.corr * (bw / 2);
    c.fillStyle = T.line; c.fillRect(bx, by, bw, 3);
    const k = stat.corr < 0 ? T.bad : (DWP_col(70) || T.ac);
    c.fillStyle = k; T.g(c, k, 7);
    c.fillRect(Math.min(mid, x), by, Math.abs(x - mid) || 1.5, 3); c.shadowBlur = 0;
    c.fillStyle = T.dim; c.font = '7.5px ' + T.fn; c.textAlign = 'center';
    c.textBaseline = 'bottom'; c.fillText('−1   phase   +1', cx, by - 2);
  }
}, { note: 'stereo field' });

window.DWPANELS.register('vu', 'vu meters', function (c, w, h, T, D) {
  c.fillStyle = T.bg; c.fillRect(0, 0, w, h);
  const s = D.vu; if (!s) return;
  const cx = w / 2, cy = h * .92, r = Math.min(w / 2, h) * .86;
  c.strokeStyle = T.line; c.lineWidth = 1;
  c.beginPath(); c.arc(cx, cy, r, Math.PI * 1.15, Math.PI * 1.85); c.stroke();
  for (let i = 0; i <= 10; i++) {
    const a = Math.PI * 1.15 + (i / 10) * Math.PI * .7, over = i > 7;
    c.strokeStyle = over ? T.bad : T.dim; c.lineWidth = over ? 1.6 : 1;
    c.beginPath(); c.moveTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    c.lineTo(cx + Math.cos(a) * r * .88, cy + Math.sin(a) * r * .88); c.stroke();
  }
  const needle = function (v, pk, off, k) {
    const a = Math.PI * 1.15 + Math.min(1, v) * Math.PI * .7;
    c.strokeStyle = k; c.lineWidth = 2; T.g(c, k, 9);
    c.beginPath(); c.moveTo(cx + off, cy);
    c.lineTo(cx + off + Math.cos(a) * r * .82, cy + Math.sin(a) * r * .82);
    c.stroke(); c.shadowBlur = 0;
    const pa = Math.PI * 1.15 + Math.min(1, pk) * Math.PI * .7;
    c.fillStyle = k; c.beginPath();
    c.arc(cx + off + Math.cos(pa) * r * .9, cy + Math.sin(pa) * r * .9, 2, 0, 7); c.fill();
  };
  needle(s.L, s.pkL, -w * .012, DWP_col(68) || T.ac);
  needle(s.R, s.pkR, w * .012, DWP_col(56) || T.ac2);
  c.fillStyle = T.dim; c.font = '7.5px ' + T.fn; c.textAlign = 'center';
  c.fillText('VU', cx, h - 2);
}, { note: '300ms ballistics' });

/* Both decks' beat grids at played tempo, bar numbers under the downbeats.
   Recovered from the v2 version: centred, per-deck stretch shown, deck gain
   as a fill behind each grid, crossfade progress with the bass-swap tick. */
window.DWPANELS.register('transition', 'transition monitor', function (c, w, h, T, D) {
  c.fillStyle = T.bg; c.fillRect(0, 0, w, h);
  const S = D.set || [], st = D.state || window.DW.state;
  /* ── which two tracks, and whether a crossfade is RUNNING ─────────────
     This used to read set[idx] and set[idx+1] and call the fade "blending"
     while transLeft <= 0. Two facts made that display structurally unable
     to show a crossfade: the loop clamps transLeft at 0, so the progress
     (|left|/16) was always 0; and chain()'s handover timer makes the
     incoming deck `now` 100ms into a 16s fade, after which transLeft is the
     NEXT exit, minutes away. So "crossfade 0% · bass on outgoing" for a
     tenth of a second, then the incoming track labelled OUTGOING.

     The fade outlives the handover. A crossfade is running when the deck's
     elapsed is inside one crossfade and there is a track it took over from
     (D.prev, kept by the loop): OUTGOING is that track at the rate it ran
     (D.prevRate), INCOMING is the deck. Otherwise OUTGOING is the deck and
     INCOMING is the scheduled next deck (D.nextDeck carries its real rate;
     the plan's _stretch is the fallback before it is scheduled). */
  const nowM = D.now || S[st.idx];
  const xfLen = (D.blend && D.blend.xfade) || 16;
  const el = typeof D.elapsed === 'number' ? D.elapsed : 0;
  const fading = !!(nowM && D.prev && el < xfLen);
  let cur, nxt, rateA, rateB, prog;
  if (fading) {
    cur = D.prev; nxt = nowM; prog = Math.min(1, el / xfLen);
    rateA = D.prevRate || 1; rateB = D.deck ? D.deck.rate : 1;
  } else {
    cur = nowM;
    nxt = (D.nextDeck && D.nextDeck.meta) || D.next || S[(cur ? S.indexOf(cur) : st.idx) + 1];
    prog = 0;
    rateA = D.deck ? D.deck.rate : (cur && cur._stretch) || 1;
    rateB = D.nextDeck ? D.nextDeck.rate : (nxt && !nxt._unlocked ? (nxt._stretch || 1) : 1);
  }
  const fn = T.fn;
  c.font = '8px ' + fn; c.textBaseline = 'middle';
  if (!cur) {
    c.fillStyle = T.dim; c.textAlign = 'center';
    c.fillText('no set playing', w / 2, h / 2); return;
  }
  const pad = 10, inner = w - pad * 2;
  const rowH = Math.max(16, Math.min(30, h * 0.16));
  /* The gap has to clear three things stacked between the two boxes: the
     OUTGOING row's bar numbers below its box, then INCOMING's label, then
     INCOMING's title. At the old 10px the bpm readout landed on the bar
     numbers. 34 is the measured stack, not a guess at a nice number. */
  const gap = Math.max(34, h * 0.10);
  /* +20 over the original: each row now carries a title line under its
     label, so the block is two text lines taller and must stay centred. */
  const blockH = rowH * 2 + gap + 62;
  const top = Math.max(pad, (h - blockH) / 2);
  const y1 = top + 12 + rowH / 2, y2 = y1 + rowH / 2 + gap + rowH / 2;
  const span = 8, t = performance.now() / 1000;
  /* The file's one cleaner (DWP_clean, top of file). This used to be a
     private ungated copy and rendered "LukHash - 8-Bit Warrior" as
     "Bit Warrior" on the transition monitor — ledger 104's exact bug,
     two surfaces further on. */
  const clean = DWP_clean;
  const fit = (s, max) => {
    if (c.measureText(s).width <= max) return s;
    let lo = 0, hi = s.length;
    while (lo < hi) { const mid = (lo + hi + 1) >> 1;
      if (c.measureText(s.slice(0, mid) + '…').width <= max) lo = mid; else hi = mid - 1; }
    return s.slice(0, lo) + '…';
  };
  const row = function (m, rate, y, colr, label, gain, first) {
    if (!m) return null;
    const bpm = m.bpm * (rate || 1), per = 60 / bpm;
    const yLab = y - rowH / 2 - 17, yName = y - rowH / 2 - 7;
    c.textAlign = 'left'; c.fillStyle = T.dim; c.fillText(label, pad, yLab);
    c.textAlign = 'right'; c.fillStyle = colr;
    /* never a ratio against a track played straight — ×1.000 reads as a
       perfect match, and no match is being claimed.
       NOR against a deck that was STARTED rather than mixed into, for the
       same reason: nothing precedes it, so its rate is 1 by construction.
       This guard covered only `_unlocked` until 2026-08-30, which is ledger
       82 half-applied — the harness case for it existed and simply was not
       asserting — and until 2026-09-01 `first` was inferred from the list
       index, which is false for a jumped-to deck. The caller now reads the
       engine's `origin`. */
    const meta = bpm.toFixed(1) + ' bpm · ' + m.camelot + ' · ' +
      (m._unlocked ? '∿ straight' : first ? '∿ first · nothing to match' : '×' + (rate || 1).toFixed(3));
    c.fillText(meta, w - pad, yLab);
    /* the title, on its own line under the label, given the full width */
    c.textAlign = 'left'; c.fillStyle = colr;
    c.fillText(fit(clean(m.name), inner), pad, yName);
    c.strokeStyle = T.line; c.lineWidth = 1; c.strokeRect(pad, y - rowH / 2, inner, rowH);
    if (gain != null) {
      c.fillStyle = colr; c.globalAlpha = .10;
      c.fillRect(pad, y - rowH / 2, inner * gain, rowH); c.globalAlpha = 1;
    }
    const phase = (t % per) / per, n = Math.ceil(span / per) + 1;
    let barCount = 0;
    for (let k = 0; k < n; k++) {
      const tt = (k * per) - (phase * per), fr = tt / span;
      if (fr < 0 || fr > 1) continue;
      const x = pad + fr * inner, down = (k % 4) === 0;
      if (down) barCount++;
      c.fillStyle = down ? colr : T.line; T.g(c, down ? colr : T.line, down ? 9 : 0);
      c.fillRect(x - (down ? 2 : 0.75), y - rowH / 2 + 2, down ? 4 : 1.5, rowH - 4);
      c.shadowBlur = 0;
      if (down) {
        c.fillStyle = T.dim; c.font = '7px ' + fn; c.textAlign = 'center';
        c.fillText(String(barCount), x, y + rowH / 2 + 6); c.font = '8px ' + fn;
      }
    }
    return per;
  };
  const left = D.transLeft;
  const blending = fading;
  /* WHICH ROW IS UNMATCHED — read from the engine, not guessed from the
     index. `origin === 'play'` means the deck was STARTED (first ▶, a
     jumped-to row, back()) rather than mixed into, so its rate is 1 because
     nothing preceded it and `×1.000` against it reads as a perfect beatmatch
     of an event that never happened (ledger 82). The old predicate here was
     `st.idx === 0 && rateA === 1`, which missed BOTH open cases: a jumped-to
     deck (idx is 7, rate is still 1) and the outgoing row of the very first
     fade (idx has already moved to 1 while the first deck is still audible).

     While FADING, OUTGOING is the handed-over deck (DW.prevDeck carries its
     own origin) and INCOMING is the live one; otherwise OUTGOING is the live
     deck and INCOMING is the scheduled next, which chain() always builds. */
  const pdk = (window.DW && window.DW.prevDeck) || null;
  const deckFirst = !!(D.deck && D.deck.origin === 'play');
  const firstA = fading ? !!(pdk && pdk.origin === 'play') : deckFirst;
  const firstB = fading ? deckFirst : false;
  /* NOTHING ON A DECK: `nowM` falls back to S[st.idx], which survives
     stop(), so this panel drew a full transition - labelled rows, ticking
     bars and a lock verdict - byte-identical to the playing case, while
     the card two panels away correctly read `stopped - cued at N of M`.
     Ledger 87's shape: a non-empty fallback making the honest path
     unreachable. Keeper's call, 2026-08-31: keep the preview, dim it,
     and drop the verdict - the rows are useful (they are what you are
     about to hear) and only the LOCK CLAIM is dishonest, because no deck
     is making the transition it is claiming to have measured. */
  const notPlaying = !D.now;
  const perA = row(cur, rateA, y1, notPlaying ? T.dim : (DWP_col(60) || T.ac2), 'OUTGOING', blending ? 1 - prog : 1, firstA);
  const perB = nxt ? row(nxt, rateB, y2, notPlaying ? T.dim : (DWP_col(72) || T.ac), 'INCOMING', blending ? prog : 0, firstB) : null;
  const by = y2 + rowH / 2 + 18;
  /* The marker is drawn whenever nothing is on a deck, INDEPENDENT of
     whether a next track exists — at the last track of a set `nxt` is
     undefined and the verdict block below never runs, so nesting the
     marker inside it left the stopped state unlabelled exactly where
     the set has ended, which is one of the three ways to reach it. */
  if (notPlaying) {
    c.textAlign = 'center'; c.font = '9px ' + fn; c.fillStyle = T.dim;
    c.fillText('cued · not playing', w / 2, by);
  } else if (nxt && perA && perB) {
    /* An UNMATCHED side is the same class as a straight one for the verdict:
       a deck play() started was never beat-aligned to the other, so a drift
       figure measures an event that did not happen and `◉ PHASE LOCKED`
       against two decks both running at rate 1 is a tick under nothing.
       That is exactly what a jump to row 7 produced (ledger 82's reading on
       the monitor); read the engine's `origin`, do not infer it. */
    const unmatched = firstA || firstB;
    const straight = !!(cur._unlocked || nxt._unlocked) || unmatched;
    const drift = Math.abs(perA - perB) / Math.max(perA, perB), locked = !straight && drift < 0.005;
    c.textAlign = 'center'; c.font = '9px ' + fn;
    c.fillStyle = straight ? T.dim : locked ? (DWP_col(74) || '#3ee68a') : '#ffb02e';
    T.g(c, c.fillStyle, locked ? 8 : 5);
    /* a straight transition claims no lock, so it gets no lock readout —
       a DRIFT figure against it would be measuring an event that does not
       happen, and LOCKED on a distrusted grid would be a lie with a tick */
    c.fillText(unmatched && !(cur._unlocked || nxt._unlocked)
        ? '∿ NOT MIXED · this deck was started, not blended into'
      : straight ? '∿ STRAIGHT · no beat alignment claimed'
      : locked ? '◉ PHASE LOCKED · periods match'
      : '△ DRIFT ' + (drift * 100).toFixed(2) + '%', w / 2, by);
    c.shadowBlur = 0; c.font = '8px ' + fn;
    const bw = inner * 0.7, bx = (w - bw) / 2, byy = by + 14;
    c.fillStyle = T.line; c.fillRect(bx, byy, bw, 4);
    if (blending) {
      const k = DWP_col(66) || T.ac; c.fillStyle = k; T.g(c, k, 8);
      c.fillRect(bx, byy, bw * prog, 4); c.shadowBlur = 0;
      /* the bass swap fires at 45% of the fade */
      const sx = bx + bw * 0.45;
      c.fillStyle = prog > 0.45 ? (DWP_col(74) || '#3ee68a') : '#ffb02e';
      c.fillRect(sx - 1, byy - 3, 2, 10);
      c.fillStyle = T.dim; c.textAlign = 'center';
      c.fillText('crossfade ' + Math.round(prog * 100) + '% · bass '
        + (prog > 0.45 ? 'swapped' : 'on outgoing'), w / 2, byy + 14);
    } else {
      c.fillStyle = T.dim; c.textAlign = 'center';
      c.fillText(left != null ? ('next blend in ' + Math.max(0, Math.round(left)) + 's') : '—',
        w / 2, byy + 14);
    }
  } else if (!nxt) {
    c.textAlign = 'center'; c.fillStyle = T.dim;
    c.fillText('final track · no transition queued', w / 2, by);
  }
}, { note: 'beat phase' });

/* ── shared history for the timeline panels ────────────────────────────
   One ring buffer, sampled on a clock rather than per frame, so the x axis
   means seconds and not frames. 10 Hz for 120 s is 1200 points — more than
   any panel needs horizontally, and cheap.

   It RESETS when the track index changes, so each track builds its own
   picture from zero. That is the behaviour asked for: start at 0, grow the
   axis as the track plays, and stop growing at sixty seconds. */
const DWP_HIST = {
  hz: 10, max: 600,                 /* 600 samples at 10Hz = 60 seconds */
  t: [], level: [], peak: [], bass: [], mid: [], high: [], flux: [],
  acc: 0, idx: -1, started: 0,
  reset() {
    this.t.length = this.level.length = this.peak.length = this.bass.length = 0;
    this.mid.length = this.high.length = this.flux.length = 0;
    this.acc = 0; this.started = performance.now();
  },
  /* Owns its own clock rather than being handed one. Both panels that use
     this buffer call feed() in the same frame, and each is drawn on its own
     schedule, so there is no single caller who could pass a correct dt. The
     second call in a frame contributes its own sub-millisecond gap, which is
     the truth about how much time has passed since the first. */
  feed(D) {
    /* Reset per TRACK, by identity, with the index as the fallback. The
       index alone also moved when a row before the playing track was queued
       (placeNext shifts it), which would have wiped the picture mid-track. */
    const st = D.state, key = D.now || (st && st.idx);
    if (key !== this.idx) { this.idx = key; this.reset(); }
    this.acc += dwpDT('hist');
    const step = 1 / this.hz;
    if (this.acc < step) return;
    this.acc -= step;          /* keep the remainder, or the rate drifts slow */
    const band = (a, b) => { if (!D.freq) return 0; let s = 0, n = 0;
      for (let k = a; k < b && k < D.freq.length; k++) { s += D.freq[k]; n++; }
      return n ? s / n / 255 : 0; };
    this.t.push((performance.now() - this.started) / 1000);
    this.level.push(D.vu ? D.vu.L : 0);
    /* PPM peak, not a second averaging meter. DWVU already runs both sets of
       ballistics every frame; taking the larger channel keeps one trace. */
    this.peak.push(D.vu ? Math.max(D.vu.pL || 0, D.vu.pR || 0) : 0);
    this.bass.push(band(0, 12));
    this.mid.push(band(12, 90));
    this.high.push(band(90, D.freq ? D.freq.length : 1));
    this.flux.push(Math.min(1, (D.flux || 0) * 14));
    if (this.t.length > this.max) {
      ['t','level','peak','bass','mid','high','flux'].forEach(k => this[k].shift());
    }
  },
  /* seconds currently spanned, which is what makes the axis grow */
  span() { return this.t.length ? Math.max(1, this.t[this.t.length - 1] - this.t[0]) : 1; }
};

/* Read-only view of the shared history buffer, attached here because the
   buffer is file-scope and the registry object is inside its own IIFE. These
   panels shipped broken once precisely because there was no way to ask the
   buffer what it held — the panel drew a placeholder and the placeholder
   looked like a working panel. Same reasoning as the DW._dev seam. */
window.DWPANELS.hist = () => ({
  points: DWP_HIST.t.length, max: DWP_HIST.max, hz: DWP_HIST.hz,
  spanSeconds: +DWP_HIST.span().toFixed(2),
  oldest: +(DWP_HIST.t[0] || 0).toFixed(2),
  newest: +(DWP_HIST.t[DWP_HIST.t.length - 1] || 0).toFixed(2),
  scrolling: DWP_HIST.t.length >= DWP_HIST.max
});

const dwpMMSS = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

/* TIMELINE — level and the polygraph bands over the track so far. The x axis
   grows with the music up to sixty seconds, then scrolls. */
window.DWPANELS.register('timeline', 'timeline · level + bands', function (c, w, h, T, D) {
  DWP_HIST.feed(D);
  c.fillStyle = T.bg; c.fillRect(0, 0, w, h);
  const H = DWP_HIST, n = H.t.length;
  const padL = 4, padB = 12, gh = h - padB - 4;
  if (n < 2) { c.fillStyle = T.dim; c.font = '9px ' + T.fn; c.textAlign = 'center';
    c.textBaseline = 'middle'; c.fillText('building…', w / 2, h / 2); return; }

  const span = H.span(), x = i => padL + ((H.t[i] - H.t[0]) / span) * (w - padL - 4);
  const y = v => 4 + gh - Math.max(0, Math.min(1, v)) * gh;

  c.strokeStyle = T.line; c.lineWidth = 1;
  for (let f = 0; f <= 1; f += .25) {
    c.beginPath(); c.moveTo(padL, y(f)); c.lineTo(w - 4, y(f)); c.stroke();
  }

  /* level as a filled area, bands as lines over it */
  c.beginPath(); c.moveTo(x(0), y(0));
  for (let i = 0; i < n; i++) c.lineTo(x(i), y(H.level[i]));
  c.lineTo(x(n - 1), y(0)); c.closePath();
  c.fillStyle = DWP_col(30, .28) || 'rgba(34,232,255,.20)'; c.fill();

  [['bass', DWP_col(58) || T.ac2], ['mid', T.dim], ['high', DWP_col(70) || T.ac]]
    .forEach(([k, col]) => {
      c.strokeStyle = col; c.lineWidth = 1.2; c.beginPath();
      for (let i = 0; i < n; i++) { const px = x(i), py = y(H[k][i]);
        i ? c.lineTo(px, py) : c.moveTo(px, py); }
      c.stroke();
    });

  c.font = '7px ' + T.fn; c.fillStyle = T.dim; c.textBaseline = 'alphabetic';
  /* The left edge is only 0:00 while the axis is still growing. Once the
     buffer is full the oldest sample is whatever fell off the front, and
     printing 0:00 there would claim the panel still shows the whole track. */
  c.textAlign = 'left';  c.fillText(dwpMMSS(H.t[0]), padL, h - 3);
  c.textAlign = 'right'; c.fillText(dwpMMSS(H.t[n - 1]) +
    (n >= H.max ? ' · scrolling' : ' · growing'), w - 4, h - 3);
  c.textAlign = 'left';
  c.fillStyle = DWP_col(58) || T.ac2; c.fillText('bass', padL + 26, h - 3);
  c.fillStyle = DWP_col(70) || T.ac;  c.fillText('high', padL + 52, h - 3);
}, { note: 'grows to 60s, then scrolls' });

/* DROPS — the same history, read for CHANGE rather than level. Bass energy
   fills from the bottom; the bright overlay is its rate of rise, so a fast
   climb out of a quiet passage lights up and a steady loud passage does not.
   It renders the derivative. It does NOT classify anything as a drop —
   that would be a detector, and detectors here get measured before they get
   believed. */
window.DWPANELS.register('drops', 'bass · rate of rise', function (c, w, h, T, D) {
  DWP_HIST.feed(D);
  c.fillStyle = T.bg; c.fillRect(0, 0, w, h);
  const H = DWP_HIST, n = H.t.length;
  if (n < 3) { c.fillStyle = T.dim; c.font = '9px ' + T.fn; c.textAlign = 'center';
    c.textBaseline = 'middle'; c.fillText('building…', w / 2, h / 2); return; }
  const padB = 12, gh = h - padB - 4, span = H.span();
  const x = i => 4 + ((H.t[i] - H.t[0]) / span) * (w - 8);

  /* bass magnitude, filled */
  c.beginPath(); c.moveTo(x(0), h - padB);
  for (let i = 0; i < n; i++) c.lineTo(x(i), 4 + gh - H.bass[i] * gh);
  c.lineTo(x(n - 1), h - padB); c.closePath();
  c.fillStyle = DWP_col(24, .35) || 'rgba(255,45,149,.22)'; c.fill();

  /* rate of rise over ~0.4s, drawn as vertical flares */
  const lag = Math.max(1, Math.round(H.hz * 0.4));
  let peak = 0, peakAt = -1;
  for (let i = lag; i < n; i++) {
    const d = H.bass[i] - H.bass[i - lag];
    if (d <= 0) continue;
    if (d > peak) { peak = d; peakAt = i; }
    const k = Math.min(1, d * 2.2);
    c.strokeStyle = DWP_col(62) || T.ac;
    c.globalAlpha = k; c.lineWidth = 1 + k * 2;
    c.beginPath(); c.moveTo(x(i), h - padB); c.lineTo(x(i), 4 + gh - k * gh); c.stroke();
  }
  c.globalAlpha = 1;

  if (peakAt >= 0) {
    const px = x(peakAt);
    c.strokeStyle = DWP_col(74) || '#3ee68a'; c.lineWidth = 1.5;
    c.setLineDash([3, 3]); c.beginPath();
    c.moveTo(px, 4); c.lineTo(px, h - padB); c.stroke(); c.setLineDash([]);
    c.font = '7px ' + T.fn; c.fillStyle = DWP_col(74) || '#3ee68a';
    c.textAlign = px > w / 2 ? 'right' : 'left';
    c.fillText('steepest +' + (peak * 100).toFixed(0) + '% @ ' + dwpMMSS(H.t[peakAt]),
               px + (px > w / 2 ? -3 : 3), 10);
  }
  c.font = '7px ' + T.fn; c.fillStyle = T.dim;
  c.textAlign = 'left';  c.fillText('bass fill + rate of rise', 4, h - 3);
  c.textAlign = 'right'; c.fillText(dwpMMSS(H.t[n - 1]), w - 4, h - 3);
}, { note: 'derivative, not a drop detector' });

/* LOUDTIME — the same 60s history, loudness ONLY. No band lines, no legend
   competing for the vertical, so the envelope gets the full height. Two
   traces from the two sets of ballistics DWVU already runs every frame:
   the filled area is the VU average, the thin line above it is the PPM peak.
   The gap between them is crest factor by eye — wide when the material has
   transients left, collapsing to a band when it has been squashed.

   THE Y AXIS IS DELIBERATELY UNLABELLED. It is DWVU's normalised 0..1 across
   a -30..+6 VU scale aligned to -6 dBFS, and that alignment is a choice this
   project made, not a standard. Printing dB figures against it would give a
   chosen number the authority of a measured one. The gridlines are quarters
   of the scale and are drawn as quarters, which is all they honestly are. */
window.DWPANELS.register('loudtime', 'loudness · over time', function (c, w, h, T, D) {
  DWP_HIST.feed(D);
  c.fillStyle = T.bg; c.fillRect(0, 0, w, h);
  const H = DWP_HIST, n = H.t.length;
  const padB = 11, top = 3, gh = h - padB - top;
  if (n < 2) { c.fillStyle = T.dim; c.font = '9px ' + T.fn; c.textAlign = 'center';
    c.textBaseline = 'middle'; c.fillText('building…', w / 2, h / 2); return; }

  const span = H.span(), x = i => 3 + ((H.t[i] - H.t[0]) / span) * (w - 6);
  const y = v => top + gh - Math.max(0, Math.min(1, v)) * gh;

  c.strokeStyle = T.line; c.lineWidth = 1;
  for (let f = 0.25; f < 1; f += 0.25) {
    c.beginPath(); c.moveTo(3, y(f)); c.lineTo(w - 3, y(f)); c.stroke();
  }

  c.beginPath(); c.moveTo(x(0), y(0));
  for (let i = 0; i < n; i++) c.lineTo(x(i), y(H.level[i]));
  c.lineTo(x(n - 1), y(0)); c.closePath();
  c.fillStyle = DWP_col(34, .34) || 'rgba(34,232,255,.26)'; c.fill();
  c.strokeStyle = DWP_col(64) || T.ac; c.lineWidth = 1.2;
  c.beginPath();
  for (let i = 0; i < n; i++) { const px = x(i), py = y(H.level[i]);
    i ? c.lineTo(px, py) : c.moveTo(px, py); }
  c.stroke();

  c.strokeStyle = DWP_col(72) || T.ac2; c.lineWidth = 1; c.globalAlpha = .8;
  c.beginPath();
  for (let i = 0; i < n; i++) { const px = x(i), py = y(H.peak[i]);
    i ? c.lineTo(px, py) : c.moveTo(px, py); }
  c.stroke(); c.globalAlpha = 1;

  c.font = '7px ' + T.fn; c.fillStyle = T.dim; c.textBaseline = 'alphabetic';
  c.textAlign = 'left';
  c.fillText('avg', 3, h - 3);
  c.fillStyle = DWP_col(72) || T.ac2; c.fillText('peak', 24, h - 3);
  c.fillStyle = T.dim; c.textAlign = 'right';
  c.fillText(dwpMMSS(H.t[n - 1]) + (n >= H.max ? ' · scrolling' : ' · growing'),
             w - 3, h - 3);
}, { note: 'VU average and PPM peak, 60s' });

/* ── ENERGY OVER THE LAST X MINUTES ─────────────────────────────────────
   Keeper, 2026-08-19: "a running tile option of 'energy over last X mins'
   (default 15; opts 30/45/60/90)."

   Two lines, and they are not the same kind of thing, so they are drawn
   and labelled differently:

     ENERGY   the CONSTRUCTED per-track index (45% loudness, 25% brightness,
              30% tempo, normalised across the corpus — chosen weights, not
              a measurement). It is a property of the TRACK, so it is a
              staircase: flat while a track plays, a step at each handover.
              Read off DW.nowMeta, i.e. the deck, not the list index.
     LEVEL    the live relative level (mean of the two VU channels), the
              same figure the VU meters show, averaged over each sample.
              A measurement, relative, drawn as a dim area behind.

   ONE ring buffer sampled on a clock every 2 s and kept for 90 minutes; the
   five registered panels are the same drawing over five windows, which is
   how a panel gets "options" without new UI — the swap menu lists them.
   Sampled whether or not any of the five is on screen, so swapping one in
   after an hour shows the hour. Nothing here is a threshold. */
const DWP_EW = { every: 2000, keepMin: 90, t: [], e: [], l: [], name: [], last: 0, acc: 0, n: 0 };
function dwpEnergyFeed(D) {
  const now = performance.now();
  const vu = D.vu; const lvl = vu ? ((vu.L || 0) + (vu.R || 0)) / 2 : 0;
  DWP_EW.acc += lvl; DWP_EW.n++;
  if (now - DWP_EW.last < DWP_EW.every) return;
  DWP_EW.last = now;
  const m = D.now || null;
  DWP_EW.t.push(now); DWP_EW.e.push(m ? m.energy : null); DWP_EW.name.push(m ? m.name : null);
  DWP_EW.l.push(DWP_EW.n ? DWP_EW.acc / DWP_EW.n : 0); DWP_EW.acc = 0; DWP_EW.n = 0;
  const cut = now - DWP_EW.keepMin * 60000;
  while (DWP_EW.t.length && DWP_EW.t[0] < cut) { DWP_EW.t.shift(); DWP_EW.e.shift(); DWP_EW.l.shift(); DWP_EW.name.shift(); }
}
/* fed from every frame regardless of which panel is on screen: the render
   loop calls DWPANELS.tick(D) once per frame, before the slots draw */
window.DWPANELS.tick = dwpEnergyFeed;

function dwpEnergyWindow(minutes) {
  return function (c, w, h, T, D) {
    dwpEnergyFeed(D);                     /* in case the history feed is not running */
    c.fillStyle = T.bg; c.fillRect(0, 0, w, h);
    const now = performance.now(), span = minutes * 60000, x0 = now - span;
    const padL = 26, padR = 8, padT = 12, padB = 16, gw = w - padL - padR, gh = h - padT - padB;
    const X = t => padL + Math.max(0, Math.min(1, (t - x0) / span)) * gw;
    const Y = v => padT + (1 - Math.max(0, Math.min(1, v))) * gh;
    c.strokeStyle = T.line; c.lineWidth = 1;
    [0, .25, .5, .75, 1].forEach(v => { c.beginPath(); c.moveTo(padL, Y(v)); c.lineTo(w - padR, Y(v)); c.stroke(); });
    c.fillStyle = T.dim; c.font = '7px ' + T.fn; c.textAlign = 'right'; c.textBaseline = 'middle';
    c.fillText('1', padL - 3, Y(1)); c.fillText('.5', padL - 3, Y(.5)); c.fillText('0', padL - 3, Y(0));
    const i0 = DWP_EW.t.findIndex(t => t >= x0);
    const n = DWP_EW.t.length;
    if (i0 < 0 || n - i0 < 2) {
      c.textAlign = 'center'; c.font = '9px ' + T.fn;
      c.fillText('energy · last ' + minutes + ' min — sampling…', w / 2, h / 2); return;
    }
    /* PEN-LIFT ACROSS A HOLE, not a straight line through it.
       tick() is called from paint(), and a hidden page runs sample() without
       paint() — so the buffer simply stops while the tab is in the
       background, and joining t[i-1] to t[i] drew a confident straight line
       across minutes nothing measured. That is ledger 87's shape: a
       plausible-looking fallback standing in for missing data. A gap wider
       than two sample intervals breaks both series. The number is the
       buffer's own `every`, doubled to allow for a late frame; it is a
       structural tolerance on the sampling clock, not a calibration of any
       signal, and it is not compared against anything measured. */
    const GAP = DWP_EW.every * 2;
    const broke = i => i > 0 && (DWP_EW.t[i] - DWP_EW.t[i - 1]) > GAP;
    /* level: dim area, a measurement — one filled run per unbroken stretch */
    c.fillStyle = T.dim; c.globalAlpha = .18;
    for (let i = i0; i < n; ) {
      let j = i + 1;
      while (j < n && !broke(j)) j++;
      if (j - i >= 2) {
        c.beginPath(); c.moveTo(X(DWP_EW.t[i]), Y(0));
        for (let k = i; k < j; k++) c.lineTo(X(DWP_EW.t[k]), Y(DWP_EW.l[k]));
        c.lineTo(X(DWP_EW.t[j - 1]), Y(0)); c.closePath(); c.fill();
      }
      i = j;
    }
    c.globalAlpha = 1;
    /* energy: accent staircase, the constructed index per track */
    c.strokeStyle = T.ac; c.lineWidth = 1.6; T.g(c, T.ac, 6); c.beginPath();
    let pen = false;
    for (let i = i0; i < n; i++) {
      const e = DWP_EW.e[i];
      if (e == null) { pen = false; continue; }
      if (broke(i)) pen = false;
      const x = X(DWP_EW.t[i]), y = Y(e);
      if (!pen) { c.moveTo(x, y); pen = true; }
      else { c.lineTo(x, DWP_EW.e[i - 1] != null ? Y(DWP_EW.e[i - 1]) : y); c.lineTo(x, y); }
    }
    c.stroke(); c.shadowBlur = 0;
    /* a tick and a short name at each handover */
    c.font = '6.5px ' + T.fn; c.textAlign = 'left'; c.textBaseline = 'top';
    for (let i = i0 + 1; i < n; i++) {
      if (DWP_EW.name[i] && DWP_EW.name[i] !== DWP_EW.name[i - 1]) {
        const x = X(DWP_EW.t[i]);
        c.strokeStyle = T.ac2; c.globalAlpha = .55; c.beginPath(); c.moveTo(x, padT); c.lineTo(x, padT + gh); c.stroke(); c.globalAlpha = 1;
        c.fillStyle = T.ac2;
        c.fillText(DWP_clean(DWP_EW.name[i]).slice(0, 14), x + 2, padT + 1);
      }
    }
    c.fillStyle = T.dim; c.font = '7.5px ' + T.fn; c.textBaseline = 'bottom';
    c.textAlign = 'left'; c.fillText('−' + minutes + ' min', padL, h - 3);
    c.textAlign = 'right'; c.fillText('now', w - padR, h - 3);
    c.textAlign = 'center';
    c.fillText('energy = constructed index · level = relative', w / 2, h - 3);
  };
}
[15, 30, 45, 60, 90].forEach(m =>
  window.DWPANELS.register('energy' + m, 'energy · last ' + m + ' min', dwpEnergyWindow(m),
    { note: 'track energy + level, ' + m + ' min' }));
