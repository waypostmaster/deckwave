/* ─────────────────────────────────────────────────────────────────────────
   DECKWAVE PATCH 09 — committing a route, and repairing what it breaks

   THE BUG THIS FIXES, stated plainly:
   Patches 07 and 08 built a router, a steering menu and a visualiser. All
   three worked and all three demoed convincingly. The queue was populated
   the whole time and NOTHING IN THE PLAYBACK PATH EVER READ IT. The feature
   recorded intentions and discarded them. It took the keeper noticing the
   set was not walking anywhere.

   Diagnostic that caught it, kept because the shape is reusable:
       playerReadsQueue: /DWNAV|queue/.test(DW.play.toString() + DW.skip.toString())
   State the falsifier before running the test. This one was: "if the player
   does read the queue, the hypothesis is wrong and look further."

   THE FIX AVOIDS A SECOND CODE PATH.
   Rather than intercepting the player's next-track choice — a second
   mechanism that can silently disagree with the first — a committed route is
   SPLICED INTO THE SET. The player then walks it by construction, and the
   detour is visible in the track list.

   WHAT THE SPLICE EXPOSED.
   A detour changes the rolling tempo state, so the original tail is no
   longer playable in its existing order. Measured: after a 6-track climb
   from 114 to 146.7 BPM, the next original track needed 12.5% — outside the
   8% gate. `resequenceTail` re-plans the remainder from where the detour
   actually left us, using the sequencer's own scoring.

   Verified after: 54 tracks ahead, ZERO over the gate, max stretch 7.9%.
   Twenty tracks were dropped in the process — which is the gate working.
   After climbing to 137 BPM, twenty tracks are no longer reachable.
   A shorter correct set beats a longer broken one.
   ───────────────────────────────────────────────────────────────────────── */

(function () {
'use strict';
if (!window.DWNAV) { console.warn('DWNAV missing — load patch 07 first'); return; }

/* Splice a queued destination (and any route to it) into the set.
   Returns a NEW set; does not mutate. */
window.DWNAV.commit = function (set, opts) {
  opts = opts || {};
  const q = this.queue;
  if (!q) return { ok: false, why: 'nothing queued' };

  const st = window.DW.state, at = st.idx;
  const dest = set[q.idx];
  if (!dest) return { ok: false, why: 'destination not in set' };

  const insert = (q.mode === 'route' && q.hops) ? q.hops.concat([dest]) : [dest];

  const out = set.slice();
  /* pull the destination from where it was so it does not play twice —
     only safe when it sits after the current position */
  if (q.idx > at) out.splice(q.idx, 1);
  out.splice(at + 1, 0, ...insert);

  /* every _stretch after the splice is now wrong; recompute exactly as the
     sequencer would */
  const DRIFT = this.DRIFT;
  let T = st.tempo || out[at].bpm;
  for (let i = at + 1; i < out.length; i++) {
    out[i]._stretch = T / out[i].bpm;
    T = T + (out[i].bpm - T) * DRIFT;
  }

  return {
    ok: true, set: out,
    inserted: insert.length, at: at + 1,
    ladder: insert.map(t => Math.round(t.bpm)),
    endTempo: +T.toFixed(1),
    /* the caller should almost always resequence from here */
    resequenceFrom: at + insert.length
  };
};

/* Re-plan the tail of a set from a given position and tempo. Same music,
   reordered so every transition clears the gate. Tracks that cannot be
   reached are DROPPED rather than stretched — the set ends honest. */
window.DWNAV.resequenceTail = function (set, fromIdx, startTempo) {
  const DRIFT = this.DRIFT, GATE = this.GATE;
  const cam = (a, b) => (window.DW && window.DW.camScore) ? window.DW.camScore(a, b) : 0.5;

  const head = set.slice(0, fromIdx + 1);
  let pool = set.slice(fromIdx + 1);
  const out = [];
  let T = startTempo, prev = set[fromIdx];

  while (pool.length) {
    const ok = pool.filter(t => Math.abs(T / t.bpm - 1) <= GATE);
    if (!ok.length) break;                    /* gate exhausted — stop, never degrade */
    let best = null, bs = -1;
    for (const t of ok) {
      const s = cam(prev.camelot, t.camelot) * 0.30
              + (1 - Math.abs(T / t.bpm - 1) / GATE) * 0.30
              + (1 - Math.min(1, Math.abs((t.energy || .5) - (prev.energy || .5)) * 2)) * 0.40;
      if (s > bs) { bs = s; best = t; }
    }
    best._stretch = T / best.bpm;
    out.push(best);
    pool = pool.filter(t => t !== best);
    T = T + (best.bpm - T) * DRIFT;
    prev = best;
  }

  return {
    set: head.concat(out),
    kept: out.length,
    dropped: pool.length,
    endTempo: +T.toFixed(1)
  };
};

/* Commit + resequence in one call — the operation the UI actually wants. */
window.DWNAV.commitAndRepair = function (set) {
  const c = this.commit(set);
  if (!c.ok) return c;
  let T = window.DW.state.tempo || set[window.DW.state.idx].bpm;
  for (let i = window.DW.state.idx + 1; i <= c.resequenceFrom && i < c.set.length; i++) {
    T = T + (c.set[i].bpm - T) * this.DRIFT;
  }
  const r = this.resequenceTail(c.set, c.resequenceFrom, T);
  this.clearQueue();
  return {
    ok: true, set: r.set,
    inserted: c.inserted, ladder: c.ladder,
    tailKept: r.kept, tailDropped: r.dropped,
    endTempo: r.endTempo
  };
};

/* Check a whole set against the gate. Use it after any structural change —
   this is the assertion that would have caught the unwired queue. */
window.DWNAV.verify = function (set, fromIdx, startTempo) {
  let T = startTempo, over = 0, max = 0;
  for (let i = fromIdx + 1; i < set.length; i++) {
    const s = Math.abs(T / set[i].bpm - 1) * 100;
    if (s > this.GATE * 100 + 0.001) over++;
    max = Math.max(max, s);
    T = T + (set[i].bpm - T) * this.DRIFT;
  }
  return { tracksAhead: set.length - fromIdx - 1, overGate: over,
           maxStretch: +max.toFixed(1), clean: over === 0 };
};
})();
