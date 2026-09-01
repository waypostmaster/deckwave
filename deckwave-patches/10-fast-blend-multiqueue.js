/* ─────────────────────────────────────────────────────────────────────────
   DECKWAVE PATCH 10 — fast blends and a multi-destination queue

   THE PROPERTY THIS EXPLOITS
   The rolling tempo target advances 35% per TRACK PLAYED, not per second. A
   stepping stone shifts the target exactly as much whether it plays for 40
   seconds or four minutes. So an intermediate track that exists only to move
   the tempo does not need its full length — blend in, hold briefly, blend
   out, move on. Which is what a DJ does with a stepping stone.

   MEASURED, from 125 BPM on a 189-track corpus:
     → 151 BPM   6 hops   21.0 min scenic   →   4.0 min fast   (17 min saved)
     →  90 BPM  11 hops   38.5 min scenic   →   7.3 min fast   (31 min saved)

   Same hops, same tempo movement, same 8% gate on every transition. Only the
   dwell changes.

   THE QUEUE IS NOW A LIST
   Several destinations can be queued, reordered and removed. Each keeps its
   own mode, so you can take the scenic route to one track and jump straight
   to another after it. `DWNAV.queue` still returns the head, so patch 09 and
   the wayposts panel need no changes.
   ───────────────────────────────────────────────────────────────────────── */

(function () {
'use strict';
const N = window.DWNAV;
if (!N) { console.warn('DWNAV missing — load patch 07 first'); return; }

/* How long a track actually plays before the next blend begins. */
N.DWELL = { full: 210, brisk: 96, fast: 56, min: 40 };

/* A stepping stone needs blend-in + a short hold + blend-out. Below roughly
   two crossfades it stops being a mix and becomes a cut, hence the floor. */
N.dwellFor = function (mode, xfade) {
  const x = xfade || 16;
  if (mode === 'fast')  return Math.max(N.DWELL.min, x * 2 + 8);
  if (mode === 'brisk') return Math.max(x * 2 + 40, N.DWELL.brisk);
  return N.DWELL.full;
};

/* Route optimised for wall-clock rather than hop count. Same search as
   plan(), but every intermediate is marked as a stepping stone with a short
   dwell, and the beam is widened slightly to find tighter ladders. */
N.planFast = function (T, dest, corpus, opts) {
  opts = opts || {};
  const dwell = N.dwellFor('fast', opts.xfade || 16);
  const p = N.plan(T, dest, corpus, { maxHops: opts.maxHops || 16, beam: opts.beam || 24 });
  if (p.direct) return Object.assign({}, p, { seconds: 0, mode: 'direct' });
  if (!p.hops) return p;

  const hops = p.hops.map(t => Object.assign({}, t, { _dwell: dwell, _stepping: true }));
  const secs = hops.length * dwell;
  return Object.assign({}, p, {
    hops, mode: 'fast', dwellSec: dwell,
    seconds: secs, minutes: +(secs / 60).toFixed(1),
    scenicMinutes: +((p.hops.length * N.DWELL.full) / 60).toFixed(1),
    savedMinutes: +(((p.hops.length * N.DWELL.full) - secs) / 60).toFixed(1)
  });
};

/* ── the queue, as an ordered list ─────────────────────────────────────
   `queue` still returns the head so existing callers keep working. */
const Q = [];
Object.defineProperty(N, 'queue', { get: () => Q[0] || null, configurable: true });

N.queueList  = () => Q.slice();
N.enqueue    = e => { Q.push(e); return Q.length; };
N.dequeue    = () => Q.shift() || null;
N.removeAt   = i => Q.splice(i, 1)[0] || null;
N.clearQueue = () => { Q.length = 0; return null; };
N.setQueue   = e => { Q.length = 0; if (e) Q.push(e); return Q[0] || null; };

N.moveQueue = function (from, to) {
  if (from < 0 || from >= Q.length) return false;
  const [x] = Q.splice(from, 1);
  Q.splice(Math.max(0, Math.min(Q.length, to)), 0, x);
  return true;
};

/* Wall-clock for everything queued: stepping stones at their dwell, each
   destination at full length. */
N.queueTime = function () {
  let s = 0;
  Q.forEach(e => {
    const hops = (e.hops || []).length;
    s += hops * (e.dwellSec || N.DWELL.full) + N.DWELL.full;
  });
  return { seconds: Math.round(s), minutes: +(s / 60).toFixed(1), entries: Q.length };
};

/* Everything the UI needs for one destination, now including the fast option. */
N.optionsFull = function (T, dest, corpus) {
  const direct = N.stretchFor(T, dest.bpm) * 100;
  const out = [];
  if (direct <= N.GATE * 100) {
    out.push({ kind: 'next', ok: true, stretch: +direct.toFixed(1) });
  } else {
    out.push({ kind: 'force', ok: false, stretch: +direct.toFixed(1),
               warn: direct > 15 ? 'audible wobble' : 'outside budget' });
    const scenic = N.plan(T, dest, corpus);
    if (scenic.hops && scenic.hops.length) {
      const fast = N.planFast(T, dest, corpus);
      out.push({ kind: 'route', ok: true, hops: scenic.hops,
                 finalStretch: scenic.finalStretch,
                 minutes: +((scenic.hops.length * N.DWELL.full) / 60).toFixed(1),
                 ladder: scenic.hops.map(h => Math.round(h.bpm)) });
      out.push({ kind: 'fast', ok: true, hops: fast.hops,
                 dwellSec: fast.dwellSec, minutes: fast.minutes,
                 savedMinutes: fast.savedMinutes,
                 ladder: fast.hops.map(h => Math.round(h.bpm)) });
    } else {
      out.push({ kind: 'unreachable', ok: false,
                 reason: scenic.reason, wouldNeed: scenic.wouldNeed });
    }
  }
  out.push({ kind: 'jump', ok: true });
  if (N.history.length) out.push({ kind: 'back', ok: true, to: N.history[N.history.length - 1] });
  return out;
};
})();
