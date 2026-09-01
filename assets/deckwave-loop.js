/* DECKWAVE PATCH 04 — the render loop, as a single clean function
   This is the piece that died mid-session and took every panel with it.

   WHY IT DIED: the loop had been rebuilt inside wrappers repeatedly, each
   capturing the previous and calling through it. One link dropped and the
   whole chain went with it — zero frames in two seconds while the audio kept
   playing and every panel drew correctly when called by hand.

   THE RULE THIS ENCODES: one loop, defined once, owning its own state. Do not
   wrap it to add a feature; add the feature to the bundle it already builds.

   AND: panel errors are STASHED, not swallowed. A try/catch that discards is
   a bug given somewhere to hide — a dead loop and a broken panel looked
   identical from outside for four diagnostic steps.  */

window.DWLOOP = (function () {
'use strict';

let raf = null, wave = null, freq = null, prevLow = null, lastT = 0, lastIdx = -1;
let lastNow = null, prevMeta = null, prevRate = 1, lastRate = 1;
/* the last bundle a frame built, and the sampler of the running loop — for
   a caller that needs (T, D) when no frame is running (DWPHONE's lock-screen
   art on a hidden page). See sample(). */
let lastBundle = null, sampler = null;
const FH = 43, fhist = new Float32Array(FH);
let fi = 0, ff = 0, lastHit = 0;
const hits = [];

function start(dash) {
  if (raf) cancelAnimationFrame(raf);
  lastT = performance.now();
  const host = dash.host, sr = dash.shadow;
  const css = k => getComputedStyle(host).getPropertyValue(k).trim();
  const g = (c, col, b) => {
    const s = parseFloat(css('--glow'));
    c.shadowBlur = b * (isNaN(s) ? 1 : s); c.shadowColor = col;
  };

  function frame() {
    raf = requestAnimationFrame(frame);
    const b = sample();
    paint(b.T, b.D);
  }

  /* MEASURE — read the analysers, advance flux / register / VU, build T and
     D. One call per frame from frame(). Also callable by hand as
     DWLOOP.sample() when the page is HIDDEN: rAF does not run there, and
     the lock-screen art (DWPHONE) needs a fresh bundle once a second with no
     frame to make one. It advances the same state a frame would (flux
     history, hits, VU ballistics), so it is for when frames are NOT running
     — a caller on a visible page reads DWLOOP.last instead. Not a wrapper;
     the loop's own body, split at the line where measuring ends and
     painting begins. */
  function sample() {
    const now = performance.now(), dt = Math.min(.1, (now - lastT) / 1000);
    lastT = now;

    /* source: listen mode wins if active, else the deck */
    const an = (window.DWLISTEN && window.DWLISTEN.active && window.DWLISTEN.analyser)
             || (window.DW && window.DW.Player.analyser);
    if (an) {
      if (!wave || wave.length !== an.fftSize) {
        wave = new Uint8Array(an.fftSize);
        freq = new Uint8Array(an.frequencyBinCount);
      }
      an.getByteTimeDomainData(wave);
      an.getByteFrequencyData(freq);
    } else if (wave) {
      /* No source any more — listen mode stopped and the deck is not
         booted. The last frame used to stay in these buffers forever, so
         the spectrogram kept scrolling a frozen column and the scope held a
         dead waveform; the stereo buffers did the same for the goniometer.
         Drop them: "no signal" is the truth and the panels draw it. */
      wave = null; freq = null; prevLow = null; dash._wL = null; dash._wR = null;
    }

    /* spectral flux onset detection — measures CHANGE, not level, because
       sidechained material holds bass energy near constant and a loudness
       threshold never fires. See the saturation table in the build log. */
    let flux = 0, hit = false;
    if (freq) {
      if (!prevLow) { prevLow = new Float32Array(10);
        for (let i = 0; i < 10; i++) prevLow[i] = freq[i]; }
      else {
        let x = 0;
        for (let i = 0; i < 10; i++) {
          const d = freq[i] - prevLow[i]; if (d > 0) x += d; prevLow[i] = freq[i];
        }
        x /= 2550; flux = x;
        let m = 0; const n = ff || 1;
        for (let i = 0; i < n; i++) m += fhist[i]; m /= n;
        if (ff >= 10 && x > m * 2.0 + 0.004 && now - lastHit > 300) {
          lastHit = now; hits.push({ t: now, v: Math.min(1, x / 0.06) }); hit = true;
        }
        fhist[fi] = x; fi = (fi + 1) % FH; if (ff < FH) ff++;
      }
    }
    while (hits.length && now - hits[0].t > 8000) hits.shift();

    /* MEASURE ALWAYS, THEME ONLY WHEN ASKED.
       These were one block, so switching register colour off also stopped the
       readout: the centroid is a measurement of the signal and has nothing to
       do with whether the user wants the accent tokens driven by it. The
       header field now runs whenever there is signal, and carries the hue as
       its own colour so the reading is legible as a register at a glance —
       without repainting the whole interface. */
    if (window.DWREGISTER && freq) {
      const r = window.DWREGISTER.update(freq);
      const kr = sr.getElementById('kReg');
      if (kr) {
        kr.textContent = r.centroidHz + 'Hz ' + r.band;
        kr.style.color = 'hsl(' + r.hue + ',80%,66%)';
      }
      if (window.DWREGISTER.mode.on) {
        host.style.setProperty('--dw-color-accent', 'hsl(' + r.hue + ',80%,64%)');
        host.style.setProperty('--dw-color-accent-2', 'hsl(' + ((r.hue + 38) % 360) + ',80%,56%)');
      }
    }

    /* stereo: listen mode, else the deck's analyser split into L/R.
       An AnalyserNode is a pass-through, so splitting from it is always
       available — claiming otherwise was an invented constraint. */
    let stereo = null;
    const S = dash.stereoSource && dash.stereoSource();
    if (S) {
      if (!dash._wL || dash._wL.length !== S.L.fftSize) {
        dash._wL = new Uint8Array(S.L.fftSize);
        dash._wR = new Uint8Array(S.R.fftSize);
      }
      S.L.getByteTimeDomainData(dash._wL);
      S.R.getByteTimeDomainData(dash._wR);
      stereo = window.DWSTEREO(dash._wL, dash._wR);
      window.DWVU.feed(stereo.rmsL, stereo.rmsR, dt);   /* RAW rms — DWVU does dBFS */
    }

    /* Seconds until the outgoing deck begins its fade, and where that sits in
       the track. Taken from DW.blend, which reads the SCHEDULE — so it follows
       the downbeat snap, and a blend-now moves it immediately. The old
       arithmetic here recomputed it from (duration - 16) and could not know
       about either. Kept as a fallback for the window between play() and the
       exit being scheduled, where outAt does not exist yet. */
    let transLeft = null, blend = null;
    try {
      blend = window.DW && window.DW.blend;
      if (blend) transLeft = Math.max(0, blend.in);
      else {
        /* only while something is actually on a deck — with a built set and
           nothing playing this used to count down to set[0]'s exit */
        const st = window.DW.state, SET = dash.set || [], t = st.now ? SET[st.idx] : null;
        if (t) {
          const rate = t._stretch || 1, entry = (t.beats && t.beats[0]) || 0;
          const el = (window.DW && typeof window.DW.elapsed === 'number')
            ? window.DW.elapsed : (dash.elapsed || 0);
          transLeft = Math.max(0, ((t.dur - entry) / rate) - 16 - el);
        }
      }
    } catch (e) {}

    const T = { bg: css('--bg') || '#04010f', line: css('--line') || '#22125c',
      dim: css('--dim') || '#7d6eb0', ac: css('--ac') || '#22e8ff',
      ac2: css('--ac2') || '#ff2d95', bad: css('--bad') || '#ff5470',
      fn: css('--fn'), g };

    /* WHAT THE DECK IS DOING, told to every panel rather than inferred by
       each of them from set[state.idx]. The list index and the deck can name
       different tracks (ledger 33, 40), and five panels were still reading
       the index. `now`/`next` are the meta objects on the decks; `deck` is
       the live rate and elapsed; `prev` is the meta that was `now` before
       the last handover, kept so the transition monitor can draw the
       OUTGOING side of a crossfade that is still running after the
       handover timer has already made the incoming deck `now`. */
    const nowMeta = (window.DW && window.DW.nowMeta) || null;
    /* a fresh ▶ (lastNow null) has no outgoing track — do not carry one over
       from the previous set */
    const deckNow = (window.DW && window.DW.deck) || null;
    if (nowMeta !== lastNow) { prevMeta = lastNow; prevRate = lastRate; lastNow = nowMeta; }
    if (deckNow) lastRate = deckNow.rate;
    /* The ENGINE's record of the last handover wins when it has one: this
       loop only notices a change when a frame runs, and a backgrounded tab
       runs none, so across two handovers in the dark its `prev` would be
       two tracks stale. DW.prevDeck is null once the fade is over. */
    const pd = (window.DW && window.DW.prevDeck) || null;
    if (pd) { prevMeta = pd.meta; prevRate = pd.rate; }
    const D = { wave, freq, set: dash.set || [], state: window.DW.state,
      L: dash._wL, R: dash._wR, stereo, vu: window.DWVU.state,
      hits, flux, hit, transLeft, blend,
      elapsed: (window.DW && typeof window.DW.elapsed === 'number') ? window.DW.elapsed : 0,
      now: nowMeta, next: (window.DW && window.DW.nextMeta) || null,
      prev: nowMeta ? prevMeta : null, prevRate: nowMeta ? prevRate : 1,
      deck: deckNow, nextDeck: (window.DW && window.DW.nextDeck) || null };
    lastBundle = { T, D };
    return lastBundle;
  }

  /* PAINT — fixed strips, per-frame feeds, slots, header, now-playing card,
     list. Everything that needs a screen. */
  function paint(T, D) {
    /* fixed strips — errors STASHED like a slot's, not thrown: a throw here
       skipped every slot, the header, the now-playing card and the list
       refresh for the rest of the session */
    if (dash.drawFixed) {
      try { dash.drawFixed(T, D); dash.fixedErr = null; }
      catch (e) { dash.fixedErr = e.message; }
    }

    /* per-frame feeds that must run whether or not their panel is on screen
       (the energy-window buffer samples for 90 minutes) */
    if (window.DWPANELS.tick) { try { window.DWPANELS.tick(D); } catch (e) {} }

    /* slots — errors STASHED, never discarded */
    dash.slots.slots.forEach(slot => {
      if (slot.el.classList.contains('collapsed')) return;
      const p = window.DWPANELS.get(slot.panel); if (!p) return;
      const r = slot.canvas.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return;
      try { p.draw(slot.ctx, r.width, r.height, T, D); slot.err = null; }
      catch (e) { slot.err = e.message; }
    });

    /* head(nHits) takes ONE argument. Passing the bundle first bound D to
       nHits and printed [object Object] in the header on every frame. */
    if (dash.header) dash.header(hits.length);
    if (window.DWNOWPLAYING) window.DWNOWPLAYING.update(D, D.transLeft);

    const s2 = window.DW.state;
    if (s2.idx !== lastIdx) { lastIdx = s2.idx; if (dash.renderList) dash.renderList(); }
  }
  sampler = sample;
  frame();
  return 'running';
}

function stop() { if (raf) cancelAnimationFrame(raf); raf = null; return 'stopped'; }

/* Which panels are currently erroring — the thing the swallowed catch hid. */
function errors(dash) {
  const out = dash.slots.slots.filter(s => s.err).map(s => ({ panel: s.panel, err: s.err }));
  if (dash.fixedErr) out.push({ panel: '(fixed strips)', err: dash.fixedErr });
  return out;
}

return { start, stop, errors, get running() { return !!raf; },
  /* the last (T, D) a frame built — stale by one frame on a visible page,
     stale by however long the page has been hidden otherwise */
  get last() { return lastBundle; },
  /* a fresh (T, D) built now, advancing the loop's state — for a HIDDEN page
     only (see sample()); null before start() */
  sample() { return sampler ? sampler() : null; } };
})();
