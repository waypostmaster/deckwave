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

  const hops = (q.mode === 'route' && q.hops) ? q.hops : [];
  const insert = hops.concat([dest]);

  /* Pull the destination from where it was so it does not play twice — only
     safe when it sits after the current position.

     AND THE STEPPING STONES, for the same reason. The router plans over the
     whole corpus, so most stones are tracks that already sit somewhere in the
     tail of this set. Until 2026-08-19 only the destination was pulled, and
     every stone stayed where it was as well as being spliced in here — so a
     15-hop route put 15 tracks into the set twice (measured on the real
     corpus: 174 rows from 159 tracks, 15 ids duplicated, for both the scenic
     and the fast route). A fast stone then played 45s here and its full
     length again later; a scenic stone was the SAME object in two slots, so
     placeNext()'s indexOf could find the wrong one. Matched by id, not by
     identity, because planFast() hands over COPIES of the corpus records.
     Only positions after `at` are touched: a stone that has already played
     is replayed, which is the router's choice and visible in the list. */
  const pull = new Set(hops.map(h => h.id));
  const out = set.filter((t, i) => i <= at || (i !== q.idx && !pull.has(t.id)));
  out.splice(at + 1, 0, ...insert);

  /* every _stretch after the splice is now wrong; recompute exactly as the
     sequencer would */
  const DRIFT = this.DRIFT;
  /* the UNROUNDED rolling target: this loop RE-PLANS from it (every
     `_stretch` below is target / bpm), and `st.tempo` is Math.round for
     display, so re-planning from it put the printed plan up to 0.4% away
     from what the deck would actually do. `tempoExact` is the engine's own
     number; the fallback keeps an older Player working. */
  let T = st.tempoExact || st.tempo || out[at].bpm;
  for (let i = at + 1; i < out.length; i++) {
    out[i]._stretch = T / out[i].bpm;
    /* Clear any dwell left by a previous route. A track that was a stepping
       stone once must not stay shortened forever when it comes up normally —
       same reasoning as recomputing every _stretch above. */
    delete out[i]._dwell;
    T = T + (out[i].bpm - T) * DRIFT;
  }

  /* ── the half that was missing ────────────────────────────────────────
     patch 10 computes a dwell per stepping stone, the menu prints it, and
     until now NOTHING CARRIED IT ANY FURTHER — commit() rebuilt the order and
     dropped the number, so a "fast blend" produced exactly the scenic set and
     every stone played its full length. The saved minutes never existed.

     This is patch 09's bug verbatim, one layer up: an intention recorded by
     the UI that no part of the playback path ever read. Stamp it on the
     STONES only; the destination plays properly. chain() honours it. */
  if (q.dwellSec) hops.forEach(t => { t._dwell = q.dwellSec; });

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
   reordered so every transition clears the gate.

   IT USED TO DROP WHATEVER IT COULD NOT REACH, and the router harness caught
   that still happening after 0.7.0 made sequence() stop discarding: build a
   set with all 171 tracks in it, take one scenic route, and 35 vanished. The
   no-discard promise held for building a set and quietly did not hold for
   repairing one, which is the same half-a-fix as ledger 45.

   Same answer as the sequencer's, for the same reason. A track the gate
   cannot reach is PLAYED STRAIGHT — its own speed, no stretch, no claim of a
   beatmatch — and then repositions the tail to its own tempo so locked mixing
   resumes on the very next track. A track whose GRID is untrusted (_locked
   false, stamped by sequence()) is never stretched here either, and never
   steers, because its BPM is the number we distrust.

   `_locked === undefined` is treated as locked: a set loaded from a score
   predates the classification and its tracks were beatmatched when saved. */
window.DWNAV.resequenceTail = function (set, fromIdx, startTempo) {
  const DRIFT = this.DRIFT, GATE = this.GATE;
  const cam = (a, b) => (window.DW && window.DW.camScore) ? window.DW.camScore(a, b) : 0.5;
  const gridOK = t => t._locked !== false;
  const keyEnergy = (t, prev) => cam(prev.camelot, t.camelot) * 0.30
    + (1 - Math.min(1, Math.abs((t.energy || .5) - (prev.energy || .5)) * 2)) * 0.40;

  const head = set.slice(0, fromIdx + 1);
  let pool = set.slice(fromIdx + 1);
  const out = [];
  let T = startTempo, prev = set[fromIdx];
  let straight = 0;

  const take = (t, mode) => {
    if (mode === 'locked') {
      t._stretch = T / t.bpm;
      delete t._unlocked; delete t._unlockReason;
      T = T + (t.bpm - T) * DRIFT;
    } else {
      t._stretch = 1; t._unlocked = true; t._unlockReason = mode; straight++;
      if (mode === 'reach') T = t.bpm;       /* trustworthy tempo: let it steer */
    }
    out.push(t);
    pool = pool.filter(x => x !== t);
    prev = t;
  };

  while (pool.length) {
    const ok = pool.filter(t => gridOK(t) && Math.abs(T / t.bpm - 1) <= GATE);
    if (ok.length) {
      let best = null, bs = -1;
      for (const t of ok) {
        const s = keyEnergy(t, prev) + (1 - Math.abs(T / t.bpm - 1) / GATE) * 0.30;
        if (s > bs) { bs = s; best = t; }
      }
      take(best, 'locked');
      continue;
    }
    /* nothing inside the budget — take the best of what is left and play it
       straight rather than throwing the rest of the set away */
    let far = null, fs = -1, mode = 'reach';
    for (const t of pool) {
      const jump = Math.abs(T / t.bpm - 1);
      const s = keyEnergy(t, prev) + (1 / (1 + jump * 4)) * 0.30;
      if (s > fs) { fs = s; far = t; mode = gridOK(t) ? 'reach' : 'grid'; }
    }
    if (!far) break;
    take(far, mode);
  }

  return {
    set: head.concat(out),
    kept: out.length,
    dropped: pool.length,
    straight: straight,
    endTempo: +T.toFixed(1)
  };
};

/* ── the route that is actually being walked ───────────────────────────
   commitAndRepair() ends with clearQueue(), which is right — the intention
   has become the set, so it is no longer pending. But the wayposts panel
   draws from `queue`, so the route vanished from the display at the exact
   moment it started being real, and nothing anywhere showed a detour in
   progress. That is half of why a fast blend looked like it did nothing:
   the other half was that it did nothing.

   `active` is the committed route, as OBJECT IDENTITIES rather than indices,
   because resequenceTail reorders the tail underneath and an index would be
   pointing at a different track a minute later. Cleared when the last stone
   has been passed, which the panel works out by looking for them in the set
   ahead of state.idx. */
window.DWNAV.active = null;
window.DWNAV.clearRoute = function () { this.active = null; };

/* Commit + resequence in one call — the operation the UI actually wants. */
window.DWNAV.commitAndRepair = function (set) {
  const c = this.commit(set);
  if (!c.ok) return c;
  const q = this.queue;
  const stones = (q && q.mode === 'route' && q.hops) ? q.hops.slice() : [];
  const dest = set[q ? q.idx : -1] || null;
  /* unrounded, for the same reason as commit()'s loop above — this walks the
     drift forward to seed resequenceTail(), which plans stretches from it */
  let T = window.DW.state.tempoExact || window.DW.state.tempo || set[window.DW.state.idx].bpm;
  for (let i = window.DW.state.idx + 1; i <= c.resequenceFrom && i < c.set.length; i++) {
    T = T + (c.set[i].bpm - T) * this.DRIFT;
  }
  const r = this.resequenceTail(c.set, c.resequenceFrom, T);
  this.active = {
    stones, dest, ladder: c.ladder,
    dwellSec: (q && q.dwellSec) || null,
    mode: (q && q.dwellSec) ? 'fast' : 'scenic',
    fromTempo: Math.round(window.DW.state.tempo || 0),
    endTempo: r.endTempo, committedAt: window.DW.state.idx
  };
  this.clearQueue();
  return {
    ok: true, set: r.set,
    inserted: c.inserted, ladder: c.ladder,
    tailKept: r.kept, tailDropped: r.dropped,
    endTempo: r.endTempo, active: this.active
  };
};

/* Check a whole set against the gate. Use it after any structural change —
   this is the assertion that would have caught the unwired queue.

   It has to model the tempo the same way playback does or it reports
   nonsense. A track played STRAIGHT is not stretched at all, so measuring a
   stretch against it is measuring something that never happens; and the two
   straight modes move the target differently — a reach track repositions to
   its own BPM, a grid track moves it nowhere. Counting a straight transition
   as "over the gate" is exactly the kind of confident wrong answer this
   project keeps a table about: the number was real, the thing it measured
   was not. */
window.DWNAV.verify = function (set, fromIdx, startTempo) {
  let T = startTempo, over = 0, max = 0, straight = 0;
  for (let i = fromIdx + 1; i < set.length; i++) {
    const t = set[i];
    if (t._unlocked) {
      straight++;
      if (t._unlockReason !== 'grid') T = t.bpm;      /* reach repositions */
      continue;                                        /* grid steers nothing */
    }
    const s = Math.abs(T / t.bpm - 1) * 100;
    if (s > this.GATE * 100 + 0.001) over++;
    max = Math.max(max, s);
    T = T + (t.bpm - T) * this.DRIFT;
  }
  return { tracksAhead: set.length - fromIdx - 1, overGate: over, straight: straight,
           maxStretch: +max.toFixed(1), clean: over === 0 };
};
})();
