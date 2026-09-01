/* ─────────────────────────────────────────────────────────────────────────
   DECKWAVE · PHRASE
   Where the 8-bar phrases of a track begin, so a transition can land on one.

   THE GAP THIS CLOSES, stated as it was recorded: "transitions land on
   downbeats, not 8/16/32-bar boundaries — the largest quality gap since
   Act 10" (ROADMAP, competitive gaps #1). A downbeat-aligned blend is in
   time; a phrase-aligned blend is in time AND the incoming track's first
   bar lands where the outgoing track's section ends, which is what a human
   DJ means by "mixing in on the phrase". This module finds the phrase
   offset; the Player (in phrase mode) uses it for the exit, the entry and
   the length of the crossfade.

   WHAT IT MEASURES. The analyser keeps rms and zcr as one scalar each for
   a whole track (BUILD-LOG Act 12: "it walks every sample and throws the
   time axis away"). This walks the DECODED PLAYBACK BUFFER — the one the
   Player already holds to play the track — and keeps four figures PER BEAT
   of the detected grid: RMS of the whole signal, RMS below 200 Hz, RMS
   above 4 kHz (one-pole filters at the deck's own shelf frequencies — the
   same split the bass swap uses, reused rather than chosen afresh) and the
   zero-crossing rate. Bars are beats 4k..4k+3 from beats[0], the same
   4/4-from-the-first-beat assumption every other part of the engine makes
   (downbeatNear, nextDownbeatAfter, the score). This module does not fix
   that assumption; it inherits it and says so.

   HOW THE OFFSET IS CHOSEN — and why it is not "where the loudness jumps".
   The first version summed bar-to-bar change per offset and took the
   largest. Measured on 60 library tracks (2026-08-19, tools/phrase-scan.js
   and its experiments) that was barely better than chance, and the per-bar
   series showed why: the biggest single changes in this music are the
   DROP-OUT BAR before a section — the fill — which lands one or two bars
   BEFORE the phrase, so the rule voted for the fill. What a phrase offset
   actually means is that sections do not straddle phrase boundaries: the
   8 bars inside a phrase resemble each other more than 8 bars cut across a
   section change do. So for each candidate offset p = 0..7 the bars are cut
   into consecutive groups of 8 starting at p, and the WITHIN-GROUP VARIANCE
   of the four per-bar series (each standardised over the track) is summed;
   the offset with the least is the answer. A fill bar is inside some group
   whichever p is tried, so it barely moves the choice; a section change
   straddled by a group does. On the same 60 tracks this beat a bar-shuffle
   null at the 5% level on 60% of them, against 28% for the change-sum rule
   — see the scan. Group length 8 bars, 4/4: the phrase unit of the music
   this was built against; 16 measured no better.

   WHAT THE NUMBERS MEAN, and what they do not.
     at        bar offset 0..7 of the first phrase start (beat index at*4)
     contrast  within-group variance at the WORST offset over the best.
               1.0 means the track has no preference — a 4-bar structure
               ties p and p+4, a wash with no sections ties everything. A
               RATIO OF THIS DETECTOR'S OWN SUMS, comparable to nothing
               outside this file.
     shuffles  of 19 random re-orderings of the same bars, how many the
               real track's contrast exceeds. 19 means the structure is in
               the top 5% of what these bars could show by chance; a low
               figure means the offset is close to a guess. Seeded, so it
               is the same number every time for the same track.
   NO THRESHOLD IS APPLIED HERE. A phrase build uses whatever offset comes
   back; contrast and shuffles are reported so the keeper can see which
   transitions rested on a coin-flip. If a cut is ever wanted, the scan
   prints the distribution across the library — measure, then choose.

   WHAT IT COSTS. One pass over the samples — ~50 ms for a four-minute
   stereo track under Node — at chain() time on the main thread, which is
   not the audio thread. The result is stamped on the meta as `phrase` and
   written back to the analysis record, so each track is walked once per
   analysis version and never on a phone that has already seen it.

   KNOWN LIMIT, found while measuring: 104 of 189 grids in the library have
   runs of beats at a different spacing from the rest (Essentia following a
   half-time or dotted feel for a section), so "every 4th beat from
   beats[0]" drifts off the bar inside those runs. That is the engine's
   grid, not this module's, and it affects the existing downbeat exits the
   same way; it is recorded in ROADMAP and not repaired here.
   ───────────────────────────────────────────────────────────────────────── */

(function (root) {
'use strict';

const V = 1;               /* bump when the arithmetic below changes */
const BARS = 8;            /* phrase length in bars */
const BPB = 4;             /* beats per bar — the engine's standing 4/4 assumption */
const SPAN = BARS * BPB;   /* beats per phrase, 32 */
const LO_HZ = 200, HI_HZ = 4000;   /* the deck's shelf frequencies, reused */
const SHUFFLES = 19;       /* 19 → "beats all of them" is the top 5% */
const DIMS = ['full', 'low', 'high', 'zcr'];

/* Per-beat RMS (full / <200 Hz / >4 kHz) and zero-crossing rate over
   [beats[i], beats[i+1]). `channels` is an array of Float32Array
   (AudioBuffer.getChannelData per channel, or DWFLAC's pcm.channels); they
   are averaged sample by sample, the analyser's own mono. Beats are in
   source seconds of THIS buffer. The filters run continuously across beat
   edges so a beat boundary is not a filter restart. */
function beatFeatures(channels, sr, beats) {
  const nb = Math.max(0, beats.length - 1);
  const f = { full: new Float64Array(nb), low: new Float64Array(nb), high: new Float64Array(nb), zcr: new Float64Array(nb) };
  if (!channels || !channels.length) return f;
  const chs = channels.length, N = channels[0].length;
  const aL = Math.exp(-2 * Math.PI * LO_HZ / sr), aH = Math.exp(-2 * Math.PI * HI_HZ / sr);
  let lp = 0, hp = 0, hpPrev = 0;
  for (let i = 0; i < nb; i++) {
    const s0 = Math.max(0, Math.floor(beats[i] * sr));
    const s1 = Math.min(N, Math.floor(beats[i + 1] * sr));
    if (s1 <= s0 + 1) continue;                       /* grid past the audio, or a zero-length beat */
    let sf = 0, sl = 0, sh = 0, zc = 0, prev = 0;
    for (let k = s0; k < s1; k++) {
      let x = 0;
      for (let c = 0; c < chs; c++) x += channels[c][k];
      x /= chs;
      lp = aL * lp + (1 - aL) * x;
      hp = aH * (hp + x - hpPrev); hpPrev = x;
      sf += x * x; sl += lp * lp; sh += hp * hp;
      if (k > s0 && ((x >= 0) !== (prev >= 0))) zc++;
      prev = x;
    }
    const n = s1 - s0;
    f.full[i] = Math.sqrt(sf / n); f.low[i] = Math.sqrt(sl / n); f.high[i] = Math.sqrt(sh / n);
    f.zcr[i] = zc / n;
  }
  return f;
}

const mean = (v, lo, hi) => { let s = 0; for (let i = lo; i < hi; i++) s += v[i]; return s / (hi - lo); };

/* per-bar series from per-beat features: dB for the three RMS figures, log
   for the crossing rate; bars lo..hi of the track */
function barSeries(f, lo, hi) {
  const n = hi - lo, out = {};
  for (const k of DIMS) out[k] = new Float64Array(n);
  for (let b = 0; b < n; b++) {
    const i0 = (lo + b) * BPB;
    for (const k of DIMS) {
      let s = 0; for (let j = 0; j < BPB; j++) s += f[k][i0 + j];
      s /= BPB;
      out[k][b] = k === 'zcr' ? Math.log(s + 1e-6) : 20 * Math.log10(s + 1e-6);
    }
  }
  return out;
}

/* each series standardised over the bars it covers, so dB and log-rate
   carry equal weight — chosen, not fitted */
function standardise(series) {
  return DIMS.map(k => {
    const v = series[k], n = v.length, m = mean(v, 0, n);
    let sd = 0; for (let i = 0; i < n; i++) sd += (v[i] - m) * (v[i] - m);
    sd = Math.sqrt(sd / n) || 1;
    const out = new Float64Array(n); for (let i = 0; i < n; i++) out[i] = (v[i] - m) / sd;
    return out;
  });
}

/* within-group variance for groups of BARS bars starting at offset p, summed
   over the standardised series; X is an array of Float64Array (bars) */
function withinVariance(X, p) {
  const n = X[0].length;
  let tot = 0;
  for (let g = p - BARS; g < n; g += BARS) {
    const lo = Math.max(0, g), hi = Math.min(n, g + BARS);
    if (hi - lo < 2) continue;
    for (const x of X) { const m = mean(x, lo, hi); for (let i = lo; i < hi; i++) tot += (x[i] - m) * (x[i] - m); }
  }
  return tot;
}

function offsetsOf(X) {
  const S = new Float64Array(BARS);
  for (let p = 0; p < BARS; p++) S[p] = withinVariance(X, p);
  let best = 0, worst = 0;
  for (let p = 1; p < BARS; p++) { if (S[p] < S[best]) best = p; if (S[p] > S[worst]) worst = p; }
  return { at: best, contrast: S[best] > 0 ? S[worst] / S[best] : 1, S };
}

/* seeded, so the shuffle figure is the same number every time */
function prng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
function shuffledRows(X, rnd) {
  const n = X[0].length, idx = new Int32Array(n);
  for (let i = 0; i < n; i++) idx[i] = i;
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = idx[i]; idx[i] = idx[j]; idx[j] = t; }
  return X.map(x => { const o = new Float64Array(n); for (let i = 0; i < n; i++) o[i] = x[idx[i]]; return o; });
}

/* Detect from per-beat features (already computed, so the scan tool can run
   several probes on one walk of the samples). `opts.bars = [lo, hi)`
   restricts to a bar range of the SAME track — the half-split probe — and
   the offset comes back re-based to bar 0 of the track. */
function detectFromFeatures(f, beats, opts) {
  opts = opts || {};
  const nbFull = Math.floor((beats.length - 1) / BPB);   /* whole bars with a following beat */
  const lo = opts.bars ? Math.max(0, opts.bars[0]) : 0;
  const hi = opts.bars ? Math.min(nbFull, opts.bars[1]) : nbFull;
  const nBars = hi - lo;
  const empty = { v: V, bars: BARS, at: 0, beat: 0, contrast: 1, shuffles: 0, nBars, ok: false };
  if (nBars < BARS + 2) return empty;                    /* fewer than two groups: nothing to compare */
  const X = standardise(barSeries(f, lo, hi));
  const r = offsetsOf(X);
  const shift = lo % BARS;
  const at = (r.at + shift) % BARS;
  let beaten = 0;
  if (opts.shuffles !== false) {
    const rnd = prng(nBars * 7919 + 17);
    for (let k = 0; k < SHUFFLES; k++) if (r.contrast > offsetsOf(shuffledRows(X, rnd)).contrast) beaten++;
  }
  const out = { v: V, bars: BARS, at, beat: at * BPB, contrast: +r.contrast.toFixed(3), shuffles: beaten, nBars, ok: true };
  if (opts.probe) {
    out.probe = { variance: Array.from(r.S, x => +x.toFixed(2)) };
    /* the downbeat question, reported and NOT acted on: bar-to-bar change in
       full-band loudness at BEAT resolution, offsets mod 4, one bar of beats
       each side. If offset 0 wins far more often than 1 in 4 across the
       library the 4/4-from-beats[0] assumption has support; if it wins at
       chance this probe cannot see downbeats and says nothing about them. */
    const nbts = nBars * BPB, Lb = new Float64Array(nbts);
    for (let i = 0; i < nbts; i++) Lb[i] = 20 * Math.log10(f.full[lo * BPB + i] + 1e-6);
    const S4 = new Float64Array(BPB), C4 = new Float64Array(BPB);
    for (let i = BPB; i + BPB <= nbts; i++) { S4[i % BPB] += Math.abs(mean(Lb, i, i + BPB) - mean(Lb, i - BPB, i)); C4[i % BPB]++; }
    let best = 0; for (let q = 1; q < BPB; q++) if (S4[q] / (C4[q] || 1) > S4[best] / (C4[best] || 1)) best = q;
    out.probe.downbeat = best;
  }
  return out;
}

/* The whole thing from a decoded buffer: channels + sampleRate + the
   track's beat grid (source seconds). */
function detect(channels, sr, beats, opts) {
  if (!beats || beats.length < 2) return { v: V, bars: BARS, at: 0, beat: 0, contrast: 1, shuffles: 0, nBars: 0, ok: false };
  return detectFromFeatures(beatFeatures(channels, sr, beats), beats, opts);
}

/* channels of an AudioBuffer, for the Player */
function channelsOf(buf) {
  if (!buf || typeof buf.getChannelData !== 'function') return null;
  const out = [];
  for (let c = 0; c < buf.numberOfChannels; c++) out.push(buf.getChannelData(c));
  return out;
}

/* ── boundary helpers, on any beats array (source OR wall seconds) ──────
   A phrase starts at beat index ph.beat + 32k. The helpers take the beats
   array in whatever time base the caller is working in — the Player maps
   the grid to wall seconds through deck.when() first — and return a TIME
   from that array plus its index, or null when the grid has no such beat. */
function starts(beats, ph) {
  const out = [];
  if (!beats || !ph || !ph.ok) return out;
  for (let i = ph.beat; i < beats.length; i += SPAN) out.push(i);
  return out;
}
/* last phrase start with beats[i] in [lo, hi]; else the first one ≥ lo;
   else null. `lo` is a floor (MIN_PLAY, or the lead on a live blend). */
function lastStartWithin(beats, ph, lo, hi) {
  const idx = starts(beats, ph);
  let pickI = null;
  for (const i of idx) { if (beats[i] < lo) continue; if (beats[i] <= hi) pickI = i; else break; }
  if (pickI == null) for (const i of idx) { if (beats[i] >= lo) { pickI = i; break; } }
  return pickI == null ? null : { i: pickI, t: beats[pickI] };
}
/* first phrase start strictly after t */
function firstStartAfter(beats, ph, t) {
  for (const i of starts(beats, ph)) if (beats[i] > t) return { i, t: beats[i] };
  return null;
}
/* the length of the phrase starting at beat i, in the array's time base:
   the grid's own spacing when it reaches, the mean spacing otherwise */
function lengthAt(beats, i) {
  if (i + SPAN < beats.length) return beats[i + SPAN] - beats[i];
  if (beats.length < 2) return 0;
  return SPAN * (beats[beats.length - 1] - beats[0]) / (beats.length - 1);
}

const api = { V, BARS, BPB, SPAN, SHUFFLES, DIMS, beatFeatures, barSeries, detectFromFeatures, detect, channelsOf,
              starts, lastStartWithin, firstStartAfter, lengthAt };
root.DWPHRASE = api;
if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
