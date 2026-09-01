/* ─────────────────────────────────────────────────────────────────────────
   DECKWAVE · LISTEN
   Hook into audio the user is already playing, plus the analogue meters.

   Two sources, one interface:
     · tab()  — getDisplayMedia with audio. The user picks a tab and ticks
                "Share tab audio". Spotify, YouTube, anything. No drivers.
     · mic()  — getUserMedia. A microphone, or a loopback device
                (VB-Cable, BlackHole) for whole-system audio.

   In listen mode every VISUAL works. Nothing else does — no beat grid, no
   key, no tempo, no mixing. Those need the file, not the stream.

   INFLUENCES
   VU ballistics follow the ANSI C16.5-1942 standard (now in IEC 60268-17):
   a full-wave averaging meter reaching 99% deflection in 300ms. That
   integration time is precisely why analogue meters feel satisfying rather
   than twitchy — you see syllables and beats, not samples.
   PPM constants (~5ms attack, ~1.7s release) follow broadcast practice.
   The goniometer is the classic Lissajous stereo display, Danmarks Radio,
   1940s–50s. Standard in mastering suites, almost unknown in consumer
   players — which is why it is worth having.
   ───────────────────────────────────────────────────────────────────────── */

window.DWLISTEN = (function () {
'use strict';
const AC = window.AudioContext || window.webkitAudioContext;
let ctx = null, stream = null, an = null, src = null, anL = null, anR = null;
/* What we are listening to, for anything that wants to say so. wire() knew the
   label and threw it away — the now-playing card had no way to report that the
   deck was idle *because* it was listening to something else. */
let label = null;

/* An analyser in a dead-end branch is not reliably pulled through the graph.
   Every analyser here gets a silent path to the destination. This exact bug
   cost an hour: the meter read zero while the audio played fine. */
function sink(node) {
  const g = ctx.createGain(); g.gain.value = 0;
  node.connect(g); g.connect(ctx.destination);
}

let kind = null;                 /* 'tab' | 'mic' | null — which capture is live */
function wire(lbl, k) {
  label = lbl; kind = k || null;
  if (!ctx) ctx = new AC({ sampleRate: 44100 });
  ctx.resume();
  src = ctx.createMediaStreamSource(stream);
  an = ctx.createAnalyser(); an.fftSize = 2048; an.smoothingTimeConstant = 0.7;
  src.connect(an); sink(an);
  const split = ctx.createChannelSplitter(2);
  src.connect(split);
  anL = ctx.createAnalyser(); anL.fftSize = 2048;
  anR = ctx.createAnalyser(); anR.fftSize = 2048;
  split.connect(anL, 0); split.connect(anR, 1);
  sink(anL); sink(anR);
  stream.getAudioTracks()[0].onended = () => api.stop();
  return { source: label, channels: 2 };
}

const api = {
  get analyser() { return an; }, get L() { return anL; }, get R() { return anR; },
  get active() { return !!stream; },
  get source() { return stream ? (label || 'input') : null; },
  /* which button started it, so the transport can paint both buttons from
     one fact instead of each remembering its own */
  get kind() { return stream ? kind : null; },

  async tab() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia)
      throw new Error('getDisplayMedia unavailable');
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    const tracks = stream.getAudioTracks();
    if (!tracks.length) {
      stream.getTracks().forEach(t => t.stop()); stream = null;
      /* Two different checkboxes depending on what was picked, and naming only
         the tab one sends people looking for something that is not there when
         they chose a screen. Entire Screen + "Share system audio" is how you
         capture a desktop application — Spotify, a DAW, anything not in a tab.
         Windows and ChromeOS offer it; macOS currently does not. */
      throw new Error('no audio track — tick "Share tab audio" (tab) or ' +
        '"Share system audio" (entire screen) in the picker');
    }
    stream.getVideoTracks().forEach(t => t.stop());   /* only the sound is wanted */
    return wire(tracks[0].label || 'tab', 'tab');
  },

  async mic() {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }
    });
    return wire(stream.getAudioTracks()[0].label || 'input', 'mic');
  },

  stop() {
    if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; }
    an = anL = anR = null; kind = null;
    return 'listening stopped';
  },

  /* whatever the page reports it is playing */
  meta() {
    const m = navigator.mediaSession && navigator.mediaSession.metadata;
    return m ? { title: m.title, artist: m.artist, album: m.album,
                 art: (m.artwork && m.artwork[0] && m.artwork[0].src) || null } : null;
  }
};
return api;
})();

/* ── VU + PPM ───────────────────────────────────────────────────────────
   Ballistics follow ANSI C16.5-1942: 300ms to 99% deflection. That part is
   a standard.

   ALIGNMENT IS A CHOICE, NOT A STANDARD. 0 VU = -18 dBFS is broadcast
   convention and pins instantly on mastered music, which runs around
   -8 dBFS. This aligns to -6 dBFS over a -30..+6 VU scale so typical loud
   material sits near three-quarters with visible travel below.

   The first version used an invented x3.2 multiplier on raw RMS and railed
   on anything above about -10 dBFS — the third saturation failure in this
   project, after the bass onset detector and the register-colour ceiling.
   The pattern each time: a threshold picked without measuring the signal's
   actual range. Measure first.
   ──────────────────────────────────────────────────────────────────────── */
window.DWVU = (function () {
  const st = { L:0, R:0, pL:0, pR:0, pkL:0, pkR:0, pkT:0 };
  const VU_TAU = 0.300;                 /* ANSI: 99% deflection in 300ms */
  const PPM_ATTACK = 0.005, PPM_RELEASE = 1.7;
  const ALIGN = -6, LO = -30, HI = 6;   /* dBFS alignment, VU scale bounds */

  const toVU = rms => {
    if (!(rms > 0)) return 0;
    const vu = 20 * Math.log10(rms) - ALIGN;
    return Math.max(0, Math.min(1, (vu - LO) / (HI - LO)));
  };

  return {
    toVU, align: ALIGN, lo: LO, hi: HI,
    /* MUST be called every frame by the render loop. Reading .state without
       feeding it gives a frozen needle that only decays — exactly the bug
       the slot refactor introduced. */
    feed(rmsL, rmsR, dt) {
      const l = toVU(rmsL), r = toVU(rmsR);
      const a = 1 - Math.exp(-dt / VU_TAU);
      st.L += (l - st.L) * a; st.R += (r - st.R) * a;
      const pa = 1 - Math.exp(-dt / PPM_ATTACK), pr = 1 - Math.exp(-dt / PPM_RELEASE);
      st.pL += (l > st.pL ? (l - st.pL) * pa : (l - st.pL) * pr);
      st.pR += (r > st.pR ? (r - st.pR) * pa : (r - st.pR) * pr);
      const now = performance.now();
      if (l > st.pkL) { st.pkL = l; st.pkT = now; }
      if (r > st.pkR) { st.pkR = r; st.pkT = now; }
      if (now - st.pkT > 1200) { st.pkL *= 0.97; st.pkR *= 0.97; }
      return st;
    },
    get state() { return st; }
  };
})();

/* ── stereo field: correlation, width, per-channel RMS ─────────────────── */
window.DWSTEREO = function (L, R) {
  let sLR = 0, sLL = 0, sRR = 0;
  const n = Math.min(L.length, R.length);
  for (let i = 0; i < n; i++) {
    const a = (L[i] - 128) / 128, b = (R[i] - 128) / 128;
    sLR += a * b; sLL += a * a; sRR += b * b;
  }
  const d = Math.sqrt(sLL * sRR);
  return {
    corr: d ? +(sLR / d).toFixed(3) : 0,      /* +1 mono · 0 wide · −1 out of phase */
    rmsL: Math.sqrt(sLL / n), rmsR: Math.sqrt(sRR / n),
    width: d ? +(1 - Math.abs(sLR / d)).toFixed(3) : 0
  };
};

/* ── register colour: spectral centroid → hue, heavily damped ──────────── */
window.DWREGISTER = (function () {
  const M = { on: false, hue: 200, sat: 80, lit: 60,
    smooth: 0.5, target: 0.5, committed: 0.5, lastChange: 0,
    glideFrom: 0.5, glideTo: 0.5, glideAt: 0,
    lo: 180, hi: 9000,        /* widened from 6000 — chiptune railed the ceiling */
    tau: 0.985,               /* ~1s smoothing on the raw signal */
    deadband: 0.055,          /* must move this far before anything commits */
    cooldownMs: 2500,         /* hard minimum between committed shifts */
    glideMs: 1800 };          /* eased travel once a shift commits */

  function centroid(freq, sr) {
    let num = 0, den = 0;
    for (let i = 1; i < freq.length; i++) { const m = freq[i] / 255; num += i * m; den += m; }
    return den ? (num / den) * (sr / 2) / freq.length : 0;
  }

  return {
    get mode() { return M; },
    set on(v) { M.on = v; },
    update(freq) {
      const now = performance.now();
      const c = centroid(freq, 44100);
      const raw = Math.max(0, Math.min(1,
        (Math.log2(Math.max(M.lo, c)) - Math.log2(M.lo)) / (Math.log2(M.hi) - Math.log2(M.lo))));
      M.target = M.target * M.tau + raw * (1 - M.tau);
      if (Math.abs(M.target - M.committed) > M.deadband && now - M.lastChange > M.cooldownMs) {
        M.glideFrom = M.committed; M.glideTo = M.target;
        M.glideAt = now; M.lastChange = now; M.committed = M.target;
      }
      let s = M.glideTo;
      if (now - M.glideAt < M.glideMs) {
        const p = (now - M.glideAt) / M.glideMs;
        const e = p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
        s = M.glideFrom + (M.glideTo - M.glideFrom) * e;
      }
      M.smooth = s;
      /* violet → magenta → amber → cyan as the centroid climbs */
      let hue;
      if (s < .33) hue = 285 + (s / .33) * 40;
      else if (s < .66) hue = (325 + ((s - .33) / .33) * 70) % 360;
      else hue = 35 + ((s - .66) / .34) * 155;
      M.hue = hue; M.sat = 62 + s * 30; M.lit = 48 + s * 22;
      return { hue: Math.round(hue), t: +s.toFixed(3), centroidHz: Math.round(c),
               band: s < .33 ? 'DARK' : s < .66 ? 'MID' : 'BRIGHT' };
    },
    /* returns null when off, so callers fall back to theme colours */
    col(lit, alpha) {
      if (!M.on) return null;
      return 'hsla(' + M.hue.toFixed(0) + ',' + M.sat.toFixed(0) + '%,' +
             (lit || M.lit) + '%,' + (alpha === undefined ? 1 : alpha) + ')';
    }
  };
})();
