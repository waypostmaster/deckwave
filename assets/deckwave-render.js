/* ─────────────────────────────────────────────────────────────────────────
   DECKWAVE PATCH 11 — offline render and FLAC export

   Recovered from the live build, which had this working and whose packaged
   form did not. The fingerprints were still in the package: deckwave.js
   carries a libflacjs CDN entry nothing ever called, and NOTICE already
   listed libflac.js (MIT) and libFLAC (BSD). The dependency reference and the
   licence entry both survived packaging; the feature did not.

   WHAT THIS PRODUCES, STATED PLAINLY
   A bounce of the set: each track entering at its first detected beat,
   leaving at a downbeat, with equal-power-ish linear crossfades between.

   IT IS NOT WHAT YOU HEAR LIVE. The offline render does NOT time-stretch.
   Live playback runs every deck through the SoundTouch AudioWorklet at a
   rate that beat-matches the rolling tempo target; this renders each track at
   its own natural tempo and crossfades at downbeats. So tempo will step
   between tracks in the file where it glides in the room. That is how the
   live build did it and the behaviour is preserved rather than "improved" —
   but the difference is real and you will hear it. Do not describe the
   exported file as a beat-matched mix.

   THE CROSSFADE HERE IS 12s, NOT 16s
   The recovered renderer used XF=12. The player and the score format both use
   16. That disagreement is carried across as found rather than reconciled,
   because 12 is what produced files that worked. It is exposed as an option;
   changing the default is a listening decision, not a code decision.

   MEMORY IS THE REAL LIMIT
   An OfflineAudioContext allocates the whole output up front: stereo float32
   at 44.1kHz is ~352KB per second, so a 3.8-hour set is roughly 4.8GB and
   will simply fail. Render a range. estimate() will tell you the size before
   you commit to it, and exportMix refuses above a ceiling you can raise
   yourself — that ceiling is a guess about browsers, not a measurement.
   ───────────────────────────────────────────────────────────────────────── */

window.DWRENDER = (function () {
'use strict';

const SR = 44100;
const XF_DEFAULT = 12;          /* recovered value — see header */
const BYTES_PER_SEC = SR * 2 * 4;
const CEILING_BYTES = 1.5e9;    /* a guess, not a measurement. Override freely. */

/* Same downbeat search the player and the score use: step the beat list in
   fours and take the nearest. Falls back to the raw time when a track has too
   few beats to have a grid at all. */
function downbeatNear(meta, t) {
  const b = meta && meta.beats;
  if (!b || b.length < 4) return t;
  let best = b[0], d = Infinity;
  for (let i = 0; i < b.length; i += 4) {
    const dd = Math.abs(b[i] - t);
    if (dd < d) { d = dd; best = b[i]; }
  }
  return best;
}

/* Lay the whole set out on a timeline before rendering anything, so the
   output length is known and a range can be selected without decoding audio. */
function plan(set, opts) {
  opts = opts || {};
  const XF = opts.xfade != null ? opts.xfade : XF_DEFAULT;
  const out = [];
  let t = 0;
  for (let i = 0; i < set.length; i++) {
    const m = set[i];
    const entry = (m.beats && m.beats.length) ? m.beats[0] : 0;
    /* no later than the quiet tail, as the Player (ledger 144) */
    const Q = (window.DW && window.DW.quietAt) ? window.DW.quietAt(m) : m.dur;
    const playFor = Math.max(24, Math.min((m.dur - entry) - XF, Q - entry));
    const exit = downbeatNear(m, entry + playFor) - entry;
    out.push({ i, name: m.name, entry, at: t, exit, out: t + exit });
    t += exit;
  }
  return { steps: out, xfade: XF, total: out.length ? out[out.length - 1].out + XF + 1 : 0 };
}

function estimate(set, opts) {
  opts = opts || {};
  const p = plan(set, opts);
  const from = opts.from != null ? opts.from : 0;
  const to = opts.to != null ? opts.to : p.total;
  const seconds = Math.max(0, to - from);
  return {
    totalSeconds: +p.total.toFixed(1),
    renderSeconds: +seconds.toFixed(1),
    bytes: Math.ceil(seconds * BYTES_PER_SEC),
    gb: +(seconds * BYTES_PER_SEC / 1073741824).toFixed(2),
    overCeiling: seconds * BYTES_PER_SEC > CEILING_BYTES,
    tracksInRange: p.steps.filter(s => s.out + p.xfade >= from && s.at <= to).length
  };
}

/* Decode only the tracks the range actually needs. The player releases
   buffers behind itself for a reason; holding 115 decoded tracks would cost
   more than the render. */
async function decodeRange(set, p, from, to, onprog) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: SR });
  const bufs = new Map();
  const needed = p.steps.filter(s => (s.out + p.xfade) >= from && s.at <= to);
  const failures = [];
  try {
    for (let n = 0; n < needed.length; n++) {
      const s = needed[n];
      if (onprog) onprog(n / needed.length, set[s.i].name);
      try { bufs.set(s.i, await window.DW.LIB.decode(set[s.i], ctx)); }
      catch (e) { failures.push({ name: set[s.i].name, stage: 'decode', message: e.message }); }
    }
    if (failures.length) {
      bufs.clear();
      const error = new Error('render cancelled — could not decode ' +
        failures.map(f => f.name + ': ' + f.message).join('; '));
      error.failures = failures;
      throw error;
    }
    return bufs;
  } finally { await ctx.close(); }
}

async function render(set, opts) {
  opts = opts || {};
  if (!set || !set.length) throw new Error('nothing to render — build a set first');
  if (!window.DW || !window.DW.LIB || !window.DW.LIB.files)
    throw new Error('library not open — press library and pick the folder again');

  const p = plan(set, opts);
  const from = opts.from != null ? opts.from : 0;
  const to = opts.to != null ? opts.to : p.total;
  const est = estimate(set, opts);
  if (est.overCeiling && !opts.force)
    throw new Error('range is ' + est.gb + 'GB, over the ' +
      (CEILING_BYTES / 1073741824).toFixed(1) + 'GB ceiling — narrow it or pass force:true');

  const bufs = await decodeRange(set, p, from, to, opts.onDecode);
  if (!bufs.size) throw new Error('no audio decoded for that range');

  const len = Math.ceil((to - from) * SR);
  const off = new OfflineAudioContext(2, len, SR);

  /* Same output chain as the live deck, so the bounce is not louder or
     flatter than the room. */
  const mst = off.createGain(); mst.gain.value = .85;
  const cmp = off.createDynamicsCompressor();
  cmp.threshold.value = -12; cmp.ratio.value = 4;
  mst.connect(cmp); cmp.connect(off.destination);

  const XF = p.xfade;
  p.steps.forEach(step => {
    const buf = bufs.get(step.i); if (!buf) return;
    const st = step.at - from, en = step.out + XF - from;
    if (en < 0 || st > (to - from)) return;

    const s = off.createBufferSource(); s.buffer = buf;
    const g = off.createGain();
    s.connect(g); g.connect(mst);

    /* A track already under way when the range opens starts at full gain;
       one that begins inside the range fades in. skew carries the offset for
       the former so it enters at the right point in its own timeline. */
    const fadeIn = step.i === 0 ? 0.8 : XF;
    const w = Math.max(0, st);
    const skew = Math.max(0, -st);
    g.gain.setValueAtTime(st < 0 ? 1 : 0, w);
    if (st >= 0) g.gain.linearRampToValueAtTime(1, w + fadeIn);
    const o = Math.max(0, step.out - from);
    g.gain.setValueAtTime(1, o);
    g.gain.linearRampToValueAtTime(0, o + XF);

    s.start(w, step.entry + skew);
    s.stop(Math.min(to - from, step.out + XF - from) + 0.2);
  });

  const buf = await off.startRendering();
  return { buffer: buf, plan: p, from, to };
}

/* ── FLAC ──────────────────────────────────────────────────────────────
   Self-hosted and pinned, like everything else in vendor/. libflac.min.js
   fetches libflac.min.js.mem alongside itself, so both must sit together. */
let flacReady = null;
function bootFlac(url) {
  if (window.Flac) return Promise.resolve(window.Flac);
  if (flacReady) return flacReady;
  flacReady = new Promise((ok, no) => {
    const s = document.createElement('script');
    /* Follow DW.assets so there is one place that decides where third-party
       code comes from, rather than this module quietly disagreeing with the
       engine about it. */
    const A = window.DW && window.DW.assets;
    s.src = url || (A ? A.base + A.files.flac : 'vendor/libflac.min.js');
    s.onload = () => {
      if (!window.Flac) return no(new Error('libflac loaded but Flac is undefined'));
      if (window.Flac.isReady && window.Flac.isReady()) return ok(window.Flac);
      window.Flac.onready = () => ok(window.Flac);
      setTimeout(() => ok(window.Flac), 4000);   /* older builds never fire onready */
    };
    s.onerror = () => no(new Error('could not load ' + s.src + ' — is vendor/ present?'));
    document.head.appendChild(s);
  });
  return flacReady;
}

/* 16-bit stereo, compression level 5. Chunked through setTimeout so the
   encode does not block the frame loop — a five-minute bounce still takes
   real seconds and a frozen UI reads as a crash. */
function toFlac(buf, onprog) {
  return new Promise((ok, no) => {
    const Flac = window.Flac;
    if (!Flac) return no(new Error('libflac not loaded — call boot() first'));
    const sr = buf.sampleRate, CH = Math.min(2, buf.numberOfChannels), BPS = 16;
    const enc = Flac.create_libflac_encoder(sr, CH, BPS, 5, 0, false);
    if (!enc) return no(new Error('encoder init failed'));

    const chunks = []; let bytes = 0;
    const write = data => { chunks.push(data.slice ? data.slice() : new Uint8Array(data)); bytes += data.length; };
    const st = Flac.init_encoder_stream(enc, write);
    if (st !== 0) return no(new Error('init_encoder_stream ' + st));

    const L = buf.getChannelData(0), R = CH > 1 ? buf.getChannelData(1) : L;
    const N = buf.length, BLK = 32768;
    let i = 0;
    function step() {
      const end = Math.min(N, i + BLK), n = end - i;
      const inter = new Int32Array(n * CH);
      for (let k = 0; k < n; k++) {
        let a = L[i + k]; a = a > 1 ? 1 : a < -1 ? -1 : a;
        inter[k * CH] = (a * 32767) | 0;
        if (CH > 1) { let b = R[i + k]; b = b > 1 ? 1 : b < -1 ? -1 : b;
          inter[k * CH + 1] = (b * 32767) | 0; }
      }
      Flac.FLAC__stream_encoder_process_interleaved(enc, inter, n);
      i = end;
      if (onprog) onprog(i / N);
      if (i < N) setTimeout(step, 0);
      else {
        Flac.FLAC__stream_encoder_finish(enc);
        Flac.FLAC__stream_encoder_delete(enc);
        const out = new Uint8Array(bytes);
        let p = 0; for (const c of chunks) { out.set(c, p); p += c.length; }
        ok(new Blob([out], { type: 'audio/flac' }));
      }
    }
    step();
  });
}

/* Render, encode, save. onStatus gets plain strings so a caller can put them
   straight on a log line. */
async function exportMix(set, opts) {
  opts = opts || {};
  const say = opts.onStatus || (() => {});
  const est = estimate(set, opts);
  say('rendering ' + est.renderSeconds.toFixed(0) + 's (' + est.gb + 'GB in memory)…');

  await bootFlac(opts.flacUrl);
  const r = await render(set, Object.assign({}, opts, {
    onDecode: (f, name) => say('decoding ' + Math.round(f * 100) + '% · ' + String(name).slice(0, 34))
  }));

  say('rendered ' + r.buffer.duration.toFixed(0) + 's · encoding flac 0%');
  const blob = await toFlac(r.buffer, p => say('encoding flac ' + Math.round(p * 100) + '%'));

  const name = (opts.name || 'deckwave-mix-' + new Date().toISOString().slice(0, 10)) + '.flac';
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 20000);

  const mb = +(blob.size / 1048576).toFixed(1);
  say('saved ' + name + ' · ' + mb + 'MB');
  return { file: name, seconds: +r.buffer.duration.toFixed(1), mb, tracks: est.tracksInRange };
}

return { plan, estimate, render, toFlac, exportMix, boot: bootFlac,
  get XF_DEFAULT() { return XF_DEFAULT; },
  get ceilingBytes() { return CEILING_BYTES; } };
})();
