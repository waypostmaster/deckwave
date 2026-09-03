/* ─────────────────────────────────────────────────────────────────────────
   DECKWAVE · THE ROUTE PANEL — what the deck is about to do, not what the
   menu was told

   WHY IT EXISTS. The keeper's report was "I still do not think quick blend is
   actually doing anything… is there a tile that shows re-routing? maybe that
   would help me diagnose when things are not doing what you think they
   should be." Both halves were right. Quick blend genuinely did nothing —
   DWNAV.commitAndRepair built a new set and only the dashboard ever saw it,
   so the deck kept walking the pre-route order — and there was no display
   anywhere that would have shown the difference.

   The wayposts panel draws DWNAV.queue, which commitAndRepair CLEARS on its
   last line. So the route disappeared from the screen at the instant it
   became real. This panel draws the opposite thing: the committed route
   (DWNAV.active) and the order the PLAYER holds.

   THE ONE CHECK THAT WOULD HAVE CAUGHT THE BUG, and the reason this is not
   just decoration:

       D.set[state.idx] === DW.nowMeta

   The dashboard's list and the playing deck must name the same track object.
   Identity, not the name string — two tracks can share a name, and under the
   bug the names still matched for a while. When they diverge, this panel
   says LIST ≠ DECK in red and stops pretending its rows mean anything.

   It reads state through accessors (DW.deck, DW.nowMeta, DW.blend) rather
   than inferring anything from what has been drawn — the project's standing
   rule, because counting lit pixels has lied here three times.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  /* The dashboard's clean() strips two " - " prefixes blindly, which eats the
     hyphen inside a title: "LukHash - 8-Bit Warrior - 01 8-Bit Warrior" comes
     out as "Bit Warrior - 01 8-Bit Warrior". Split on the separator instead
     and take the last field, dropping a leading track number if it has one —
     the album-flattened names in this library are all Artist - Album - NN
     Title or Artist - Title, and both fall out of that rule. The trailing
     [videoId] on the YouTube-sourced files is noise in a 40-column row. */
  const short = n => {
    const parts = String(n || '').split(' - ');
    let t = (parts.length > 1 ? parts[parts.length - 1] : parts[0]) || '';
    t = t.replace(/^\s*\d{1,3}\s+/, '').replace(/\s*\[[A-Za-z0-9_-]{8,}\]\s*$/, '');
    return t.trim() || String(n || '');
  };

  window.DWPANELS.register('route', 'route', function (c, w, h, T, D) {
    c.fillStyle = T.bg; c.fillRect(0, 0, w, h);
    c.textBaseline = 'middle'; c.textAlign = 'left';

    const S = D.set || [], st = D.state || { idx: 0, of: 0 };
    const N = window.DWNAV, R = N && N.active;
    const deck = (window.DW && window.DW.deck) || null;
    const nowMeta = window.DW ? window.DW.nowMeta : null;

    if (!S.length) {
      c.fillStyle = T.dim; c.font = '9px ' + T.fn;
      c.textAlign = 'center'; c.fillText('build a set first', w / 2, h / 2); return;
    }

    /* ── the honesty line ──────────────────────────────────────────────
       Drawn before anything else and given its own space, because if the
       list and the deck disagree then every row below is about a set that
       is not playing, and saying so is the whole point of the panel. */
    let y = 10;
    const desync = !!(nowMeta && S[st.idx] !== nowMeta);
    if (desync) {
      c.fillStyle = T.bad; T.g(c, T.bad, 8);
      c.font = 'bold 9px ' + T.fn;
      c.fillText('LIST ≠ DECK', 6, y); c.shadowBlur = 0;
      c.fillStyle = T.dim; c.font = '7.5px ' + T.fn;
      c.fillText('deck: ' + short(nowMeta.name).slice(0, 26), 76, y);
      y += 12;
    }

    /* ── header: is there a detour, and where does it go ──────────────── */
    const stones = R ? R.stones.filter(t => S.indexOf(t) > st.idx) : [];
    const destAhead = !!(R && R.dest && S.indexOf(R.dest) > st.idx);
    const running = !!R && (stones.length > 0 || destAhead);
    c.font = 'bold 8.5px ' + T.fn;
    if (running) {
      c.fillStyle = T.ac2; T.g(c, T.ac2, 7);
      c.fillText(R.mode === 'fast' ? '⚡ FAST BLEND' : '↝ SCENIC ROUTE', 6, y);
      c.shadowBlur = 0;
      c.fillStyle = T.dim; c.font = '7.5px ' + T.fn;
      c.fillText(stones.length + ' stone' + (stones.length === 1 ? '' : 's') + ' left · ' +
                 R.fromTempo + ' → ' + R.endTempo + ' bpm', 96, y);
    } else {
      c.fillStyle = T.dim;
      c.fillText(R ? 'route complete' : 'no detour · following the set', 6, y);
    }
    y += 12;

    /* ── the rows: current track, then what follows ───────────────────── */
    const foot = 22;
    const first = Math.max(0, st.idx);
    const room = Math.max(1, Math.floor((h - y - foot) / 13));
    const n = Math.min(room, S.length - first);
    const rowH = Math.min(15, Math.max(10, (h - y - foot) / Math.max(1, n)));
    const isStone = t => !!(R && R.stones.indexOf(t) > -1);
    const isDest = t => !!(R && R.dest === t);

    for (let k = 0; k < n; k++) {
      const i = first + k, t = S[i];
      if (!t) break;
      const cy = y + rowH * k + rowH / 2;
      const cur = i === st.idx;
      const stone = isStone(t), dest = isDest(t);

      /* the marker says WHAT this track is in the plan, not merely where */
      const col = cur ? T.ac2 : dest ? '#3ee68a' : stone ? T.ac2 : T.dim;
      c.fillStyle = col; c.globalAlpha = cur ? 1 : (stone || dest ? .9 : .45);
      if (stone) { c.fillRect(6, cy - 2.5, 5, 5); }
      else { c.beginPath(); c.arc(8.5, cy, dest || cur ? 3.6 : 2, 0, 7); c.fill(); }
      c.globalAlpha = 1;

      /* the dashed spine, so a run of stones reads as one movement */
      if (running && k < n - 1 && (stone || dest || cur)) {
        c.strokeStyle = T.ac2; c.globalAlpha = .35; c.setLineDash([2, 2]);
        c.beginPath(); c.moveTo(8.5, cy + 3.5); c.lineTo(8.5, cy + rowH - 3.5); c.stroke();
        c.setLineDash([]); c.globalAlpha = 1;
      }

      c.font = (cur ? 'bold ' : '') + '8px ' + T.fn;
      c.fillStyle = cur ? T.ac : (stone || dest ? T.ac2 : T.dim);
      c.globalAlpha = (cur || stone || dest) ? 1 : .6;
      const bpmW = 30;
      c.fillText(String(Math.round(t.bpm)).padStart(3, ' '), 16, cy);
      c.fillText(short(t.name).slice(0, Math.max(4, Math.floor((w - 52 - bpmW) / 4.6))), 16 + bpmW, cy);
      c.globalAlpha = 1;

      /* How long this one gets. A stone shows the dwell the ENGINE will
         honour, not the one the router asked for — they differ, and the menu
         used to print the request. */
      c.textAlign = 'right'; c.font = '7px ' + T.fn;
      const floor = (window.DW && window.DW.dwellFloor) || 0;
      if (t._dwell) {
        /* a FAST stone: chain() plays min(dwell, natural) clamped up to the
           floor. A scenic stone carries no _dwell and plays its full length,
           so it gets no seconds figure — printing the floor against it
           advertised a cut that never happens. */
        c.fillStyle = T.ac2;
        c.fillText(Math.round(Math.max(floor, t._dwell)) + 's', w - 6, cy);
      } else if (stone) {
        c.fillStyle = T.ac2; c.fillText('full', w - 6, cy);
      } else if (dest) {
        c.fillStyle = '#3ee68a'; c.fillText('dest', w - 6, cy);
      } else if (t._unlocked) {
        /* NOT "0.0%". An unlocked track is unstretched because it is not being
           beatmatched, and printing a perfect stretch figure against it would
           read as the best transition on screen. */
        c.fillStyle = T.dim;
        c.fillText(t._unlockReason === 'reach' ? '∿ reach' : '∿ grid', w - 6, cy);
      } else if (i === 0) {
        /* And not "0.0%" for the FIRST row either, for the same reason:
           nothing precedes step 1, so the plan's stretch is 1 by
           construction rather than by a good match (ledger 82). */
        c.fillStyle = T.dim;
        c.fillText('∿ first', w - 6, cy);
      } else if (t._stretch) {
        const p = (t._stretch - 1) * 100;
        c.fillStyle = Math.abs(p) > 8 ? T.bad : T.dim;
        c.fillText((p > 0 ? '+' : '') + p.toFixed(1) + '%', w - 6, cy);
      }
      c.textAlign = 'left';

      /* Progress through the CURRENT track, drawn under its row and filled
         to the scheduled exit rather than to the track's end — DW.blend
         reads the schedule, so it follows the downbeat snap and a blend-now
         moves it immediately. */
      if (cur && D.blend && D.blend.dur > 0) {
        const bw = w - 16, bx = 8, by = cy + rowH / 2 - 2.5;
        c.fillStyle = T.line; c.globalAlpha = .6; c.fillRect(bx, by, bw, 2); c.globalAlpha = 1;
        const el = Math.max(0, Math.min(1, (D.elapsed || 0) / D.blend.dur));
        c.fillStyle = T.ac; c.fillRect(bx, by, bw * el, 2);
        const ex = bx + bw * Math.max(0, Math.min(1, D.blend.frac));
        c.fillStyle = T.ac2; c.fillRect(ex - 1, by - 2, 2, 6);
      }
    }

    /* ── footer: the two live numbers ─────────────────────────────────── */
    c.font = '7.5px ' + T.fn; c.textBaseline = 'bottom';
    c.fillStyle = T.dim; c.textAlign = 'left';
    c.fillText(!deck ? 'stopped'
      : D.transLeft != null ? 'blend in ' + Math.round(D.transLeft) + 's'
      : 'no exit scheduled', 6, h - 4);

    c.textAlign = 'right';
    if (deck) {
      const p = deck.stretchPct;
      const straight = !!(deck.meta && deck.meta._unlocked);
      /* AN UNMATCHED DECK — nothing precedes it, so `0.0%` here reads as the
         tightest beatmatch on screen (ledger 82). The engine's own fact since
         2026-09-01: `origin === 'play'` is the first ▶, a jumped-to row or
         back(); the old `idx === 0 && rate === 1` guess missed every jump. */
      const first = deck.origin === 'play' && !straight;
      c.fillStyle = deck.settling ? T.ac2 : (!straight && !first && Math.abs(p) > 8 ? T.bad : T.dim);
      c.fillText((deck.settling ? '⤳ settling ' + Math.round(deck.settleLeft) + 's · ' : '') +
                 (straight ? '∿ straight · ' : first ? (st.idx === 0 ? '∿ first · ' : '∿ jumped · ') : (p > 0 ? '+' : '') + p.toFixed(1) + '% · ') +
                 Math.round(deck.playedBpm) + ' bpm', w - 6, h - 4);
    } else {
      c.fillText('not playing', w - 6, h - 4);
    }
  }, { note: 'the committed detour' });
})();
