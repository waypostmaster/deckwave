/* ─────────────────────────────────────────────────────────────────────────
   DECKWAVE PATCH 08 — the wayposts panel

   The corpus as a space you move through, rather than a list you pick from.

     angle  = Camelot position  → a harmonic move is a rotation
     radius = tempo, log-scaled → a tempo move is a step outward
     lit annulus = everything the 8% gate permits from where you are now

   Because the key axis is a circle, a long tempo climb that stays
   harmonically sensible comes out as a spiral. The route is not drawn as a
   spiral for effect; it is one because of what the axes mean.

   Three queue states render differently, so the panel says HOW you are
   getting somewhere and not just where:
     route  — numbered dashed path through each waypost
     next   — single line to a green destination marker
     force  — single red line, because that transition will be audible

   Requires patch 07 (DWNAV) for reachability and the queue.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  window.DWPANELS.register('wayposts', 'wayposts', function (c, w, h, T, D) {
    c.fillStyle = T.bg; c.fillRect(0, 0, w, h);
    const corpus = (window.DW && window.DW.corpus) || [];
    if (!corpus.length) {
      c.fillStyle = T.dim; c.font = '9px ' + T.fn;
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('scan a library first', w / 2, h / 2); return;
    }

    const cx = w / 2, cy = h / 2, R0 = Math.min(w, h) / 2 - 16;
    const bpms = corpus.map(t => t.bpm).filter(Boolean);
    const llo = Math.log2(Math.min(...bpms) * 0.97);
    const lhi = Math.log2(Math.max(...bpms) * 1.03);
    const rad = bpm => R0 * 0.22 + ((Math.log2(bpm) - llo) / (lhi - llo)) * (R0 * 0.78);
    const ang = cam => (((parseInt(cam) || 1) - 1) / 12) * Math.PI * 2 - Math.PI / 2;
    const pos = t => {
      const a = ang(t.camelot), r = rad(t.bpm);
      const off = String(t.camelot).slice(-1) === 'B' ? 4 : -4;  /* keep A/B apart */
      return [cx + Math.cos(a) * (r + off), cy + Math.sin(a) * (r + off)];
    };

    const nav = window.DWNAV, st = window.DW.state, S = D.set || [];
    /* `st.tempo` is 0 until play(). It USED to fall back to 120, which meant
       that before the first play this panel printed `120 bpm` as if it were
       the set's tempo, drew the reachable annulus around it, lit every dot
       the gate would permit FROM A NUMBER NOBODY CHOSE, and printed a
       reachability COUNT derived from the fabrication. The header two panels
       away has always done it correctly: `s.tempo || '-'`.
       Keeper's call, 2026-08-31: draw the corpus unlit and print `-` where
       the tempo goes - you still see the shape of your library, you are just
       not told a number that is not true. */
    const haveTempo = !!st.tempo;
    const Tnow = st.tempo || 0;

    /* labelled tempo rings — the radial scale has to be legible */
    c.font = '7px ' + T.fn; c.textAlign = 'center'; c.textBaseline = 'middle';
    [80, 100, 120, 140, 160].forEach(b => {
      const r = rad(b); if (r < R0 * 0.2 || r > R0) return;
      c.strokeStyle = T.line; c.globalAlpha = .35; c.lineWidth = 1;
      c.beginPath(); c.arc(cx, cy, r, 0, 7); c.stroke(); c.globalAlpha = 1;
      c.fillStyle = T.dim; c.fillText(b, cx, cy - r);
    });

    /* the reachable band: the horizon of what the gate allows right now */
    if (nav && haveTempo) {
      const inner = rad(Tnow / (1 + nav.GATE)), outer = rad(Tnow / (1 - nav.GATE));
      c.fillStyle = T.ac; c.globalAlpha = .07;
      c.beginPath(); c.arc(cx, cy, outer, 0, 7); c.arc(cx, cy, inner, 0, 7, true); c.fill();
      c.globalAlpha = .35; c.strokeStyle = T.ac; c.lineWidth = 1; c.setLineDash([2, 3]);
      c.beginPath(); c.arc(cx, cy, inner, 0, 7); c.stroke();
      c.beginPath(); c.arc(cx, cy, outer, 0, 7); c.stroke();
      c.setLineDash([]); c.globalAlpha = 1;
    }

    /* the whole corpus; reachable lit, everything else nearly gone */
    corpus.forEach(t => {
      if (!t.bpm) return;
      const [x, y] = pos(t);
      const ok = (nav && haveTempo) ? nav.reachable(Tnow, t) : false;
      c.fillStyle = ok ? T.ac : T.line;
      c.globalAlpha = ok ? .75 : .3;
      c.beginPath(); c.arc(x, y, ok ? 2 : 1.3, 0, 7); c.fill();
    });
    c.globalAlpha = 1;

    /* the DECK's track, by identity; the list index is the fallback */
    const nowIdx = D.now ? S.indexOf(D.now) : -1;
    const here = nowIdx > -1 ? nowIdx : st.idx;
    const curTrack = D.now || S[st.idx];

    /* where we have been */
    if (S.length && here > 0) {
      c.strokeStyle = T.dim; c.lineWidth = 1; c.globalAlpha = .4; c.beginPath();
      const from = Math.max(0, here - 14);
      for (let i = from; i <= here; i++) {
        const t = S[i]; if (!t || !t.bpm) continue;
        const [x, y] = pos(t); i === from ? c.moveTo(x, y) : c.lineTo(x, y);
      }
      c.stroke(); c.globalAlpha = 1;
    }

    const q = nav && nav.queue;
    if (q && q.mode === 'route' && q.hops && q.hops.length) {
      const dest = S[q.idx], cur = curTrack;
      const chain = q.hops.concat(dest ? [dest] : []);
      const pts = (cur ? [pos(cur)] : []).concat(chain.map(pos));
      c.strokeStyle = T.ac2; c.lineWidth = 1.6; T.g(c, T.ac2, 9);
      c.setLineDash([5, 4]); c.lineDashOffset = -(performance.now() / 1000) * 16;
      c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
      c.stroke(); c.setLineDash([]); c.shadowBlur = 0;
      chain.forEach((t, i) => {
        const [x, y] = pos(t), last = i === chain.length - 1;
        c.fillStyle = last ? '#3ee68a' : T.ac2; T.g(c, c.fillStyle, last ? 12 : 7);
        c.beginPath(); c.arc(x, y, last ? 5 : 3.4, 0, 7); c.fill(); c.shadowBlur = 0;
        if (!last) { c.fillStyle = T.bg; c.font = '6.5px ' + T.fn; c.fillText(String(i + 1), x, y); }
      });
    } else if (q) {
      const dest = S[q.idx], cur = curTrack;
      if (dest) {
        const [x, y] = pos(dest);
        const k = q.mode === 'force' ? T.bad : '#3ee68a';
        c.strokeStyle = k; c.lineWidth = 1.4; T.g(c, k, 8); c.setLineDash([4, 3]);
        if (cur) { const [ax, ay] = pos(cur); c.beginPath(); c.moveTo(ax, ay); c.lineTo(x, y); c.stroke(); }
        c.setLineDash([]); c.shadowBlur = 0;
        c.fillStyle = k; T.g(c, k, 12);
        c.beginPath(); c.arc(x, y, 5, 0, 7); c.fill(); c.shadowBlur = 0;
      }
    }

    /* you are here */
    const cur = curTrack;
    if (cur && cur.bpm) {
      const [x, y] = pos(cur);
      const pulse = 1 + Math.sin(performance.now() / 380) * 0.16;
      c.fillStyle = T.ac2; T.g(c, T.ac2, 16);
      c.beginPath(); c.arc(x, y, 6 * pulse, 0, 7); c.fill(); c.shadowBlur = 0;
      c.fillStyle = T.bg; c.font = '7px ' + T.fn; c.fillText(cur.camelot, x, y);
    }

    const reach = (nav && haveTempo) ? corpus.filter(t => nav.reachable(Tnow, t)).length : 0;
    c.fillStyle = T.dim; c.font = '7.5px ' + T.fn;
    c.textAlign = 'left'; c.textBaseline = 'bottom';
    c.fillText(haveTempo ? Math.round(Tnow) + ' bpm \u00b7 ' + reach + ' of ' + corpus.length + ' reachable'
                         : '- bpm \u00b7 no tempo until a set plays', 6, h - 4);
    c.textAlign = 'right';
    c.fillText(q ? (q.mode === 'route' ? q.hops.length + ' hops queued' : q.mode + ' queued')
                 : 'no destination', w - 6, h - 4);
  }, { note: 'tempo \u00d7 key, routes' });
})();
