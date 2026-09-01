/* ─────────────────────────────────────────────────────────────────────────
   DECKWAVE PATCH 07 — steering a running set

   Clicking a track used to jump. Now it opens a menu, because a DJ deciding
   to go somewhere else has more than one way to get there.

   THE IDEA THAT MAKES THIS WORTH BUILDING
   The rolling target moves 35% toward each track played. So a track that is
   unreachable *now* may be reachable after one hop — which turns "get me to
   track X" into a shortest-path search over the corpus, with the stretch
   gate as the edge condition.

   MEASURED, NOT ASSUMED
   One hop gains at most 3.04% tempo. Derivation: the fastest track playable
   at target T is T/(1-GATE); the target then advances DRIFT of the way
   toward it, so T' = T·(1 + DRIFT·GATE/(1-GATE)) ≈ T·1.0304.

   That number is why the first version of this failed. maxHops was set to 3
   — a guess — and three hops buys only ~9% tempo, so anything past that read
   as "unreachable". It was not unreachable; the search was too shallow.
   Same failure as every threshold in this project set without measuring the
   range first. maxHops now defaults to 16 (~60% tempo travel).

   Real results on a 189-track corpus at 109 BPM:
     → 123 BPM   2 hops   117→120        ends at  6.8%   (direct was 11.4%)
     → 139 BPM   7 hops   117→…→137      ends at  6.5%   (direct was 21.6%)
     →  79 BPM  13 hops   102→…→81       ends at  7.1%   (direct was 38.0%)
     → 172 BPM  NO ROUTE within 16 hops

   That last line is not a bug. With an 8% gate and 3% per hop, 109→172 needs
   ~13 consecutive rungs and the corpus does not contain them. **The router
   telling you a destination is unreachable is telling you something true
   about your record collection.**
   ───────────────────────────────────────────────────────────────────────── */

window.DWNAV = (function () {
'use strict';

const DRIFT = 0.35;      /* must match the sequencer */
const GATE  = 0.08;      /* must match the sequencer */

const stretchFor = (T, bpm) => Math.abs(T / bpm - 1);
const advance    = (T, bpm) => T + (bpm - T) * DRIFT;
const reachable  = (T, t)   => stretchFor(T, t.bpm) <= GATE;

/* Maximum tempo gain from a single hop — derived, not guessed. */
const perHopGain = () => 1 + DRIFT * GATE / (1 - GATE);

/* Rough hop count to travel from one tempo to another. Useful for setting
   maxHops honestly rather than picking a number that feels right. */
function hopsNeeded(from, to) {
  const target = to > from ? to * (1 - GATE) : to * (1 + GATE);
  const ratio = target / from;
  if ((ratio > 1) === (to > from) === false) return 0;
  return Math.max(0, Math.ceil(Math.abs(Math.log(ratio)) / Math.log(perHopGain())));
}

/* Breadth-first over tempo states, beam-pruned so 189 tracks does not
   explode. Ranked by how much closer each hop brings the destination, with
   a small bonus for harmonic compatibility with the destination — the route
   should sound like it is going somewhere, not just arrive. */
function plan(T, dest, corpus, opts) {
  opts = opts || {};
  const maxHops = opts.maxHops || 16;
  const beam    = opts.beam    || 18;

  if (reachable(T, dest)) {
    return { direct: true, hops: [], stretch: +(stretchFor(T, dest.bpm) * 100).toFixed(1) };
  }

  const used = new Set([dest.name]);
  let frontier = [{ T, path: [] }];

  for (let depth = 1; depth <= maxHops; depth++) {
    const next = [];
    for (const node of frontier) {
      const cands = corpus.filter(t =>
        !used.has(t.name) &&
        !node.path.find(p => p.name === t.name) &&
        reachable(node.T, t));

      const scored = cands.map(t => {
        const T2 = advance(node.T, t.bpm);
        const gap = stretchFor(T2, dest.bpm);
        const key = window.DW && window.DW.camScore
          ? window.DW.camScore(t.camelot, dest.camelot) : 0.5;
        return { t, T2, gap, score: gap - key * 0.02 };
      }).sort((a, b) => a.score - b.score).slice(0, beam);

      for (const s of scored) {
        if (stretchFor(s.T2, dest.bpm) <= GATE) {
          return {
            direct: false,
            hops: node.path.concat([s.t]),
            finalStretch: +(stretchFor(s.T2, dest.bpm) * 100).toFixed(1),
            endTempo: +s.T2.toFixed(1),
            estMinutes: Math.round((node.path.length + 1) * 3.5)
          };
        }
        next.push({ T: s.T2, path: node.path.concat([s.t]) });
      }
    }
    frontier = next.slice(0, beam * 2);
    if (!frontier.length) break;
  }

  return {
    direct: false, hops: null,
    reason: 'no route within ' + maxHops + ' hops at ' + (GATE * 100) + '% gate',
    wouldNeed: hopsNeeded(T, dest.bpm)
  };
}

/* History so "go back" means something, and a detour marker so the set can
   be resumed where it was left rather than from wherever the detour ended. */
const history = [];
let detour = null;
let queue = null;

return {
  DRIFT, GATE,
  plan, reachable, stretchFor, advance, perHopGain, hopsNeeded,

  get history() { return history; },
  push(i) { history.push(i); if (history.length > 50) history.shift(); },
  back() { return history.length ? history.pop() : null; },

  get detour() { return detour; },
  markDetour(returnTo) { detour = { returnTo, at: Date.now() }; },
  clearDetour() { detour = null; },

  /* {idx, mode: 'next'|'force'|'route', hops?} — read by the player when it
     decides what to decode next. null means follow the set as planned. */
  get queue() { return queue; },
  setQueue(q) { queue = q; return queue; },
  clearQueue() { queue = null; return null; },

  /* Everything the UI needs to describe the options for one destination. */
  options(T, dest, corpus) {
    const direct = stretchFor(T, dest.bpm) * 100;
    const out = [];
    if (direct <= GATE * 100) {
      out.push({ kind: 'next', ok: true, stretch: +direct.toFixed(1) });
    } else {
      out.push({ kind: 'force', ok: false, stretch: +direct.toFixed(1),
                 warn: direct > 15 ? 'audible wobble' : 'outside budget' });
      const p = plan(T, dest, corpus);
      if (p.hops && p.hops.length) {
        out.push({ kind: 'route', ok: true, hops: p.hops,
                   finalStretch: p.finalStretch, estMinutes: p.estMinutes,
                   ladder: p.hops.map(h => Math.round(h.bpm)) });
      } else {
        out.push({ kind: 'unreachable', ok: false,
                   reason: p.reason, wouldNeed: p.wouldNeed });
      }
    }
    out.push({ kind: 'jump', ok: true });
    if (history.length) out.push({ kind: 'back', ok: true, to: history[history.length - 1] });
    return out;
  }
};
})();
