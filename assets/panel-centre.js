/* ─────────────────────────────────────────────────────────────────────────
   DECKWAVE — CENTRE / SIDE

   Splits the stereo field into what is panned centre and what is not:

     mid  = (L + R) / 2      everything shared by both channels
     side = (L − R) / 2      everything that differs

   In almost all produced music the lead vocal is panned dead centre, so a
   vocal entering pushes mid up and the centre share with it. That is why this
   panel is interesting, and it is also the whole of the honest claim.

   IT IS NOT A VOCAL DETECTOR, and must never be labelled one. Centre also
   holds the kick, the snare and the bass — on an instrumental chiptune track
   the centre share will sit high with no voice anywhere near it. What it
   measures is centre-panned ENERGY. What you do with that is listen.

   Making it vocal-specific means band-limiting to the presence range, which
   needs a per-channel FFT and, more importantly, band edges. Those are
   thresholds, and thresholds here get measured against the corpus rather than
   copied out of a textbook. Not done, deliberately.

   RELATIVE, like the loudness panel. No calibration, no dB axis, no numbers
   the project chose dressed up as measurements.  */
(function () {
'use strict';

const N = 600;                 /* samples kept */
const HZ = 10;                 /* sampled at a fixed RATE, not per frame —
                                  ledger 22: a per-frame step runs at whatever
                                  the framerate happens to be */
const SPAN = N / HZ;           /* 60 seconds of history */

const H = { mid: new Float32Array(N), side: new Float32Array(N),
            n: 0, head: 0, last: 0, peak: 1e-6 };

function push(mid, side) {
  H.mid[H.head] = mid; H.side[H.head] = side;
  H.head = (H.head + 1) % N;
  if (H.n < N) H.n++;
  if (mid > H.peak) H.peak = mid;
  if (side > H.peak) H.peak = side;
}
const at = i => (H.head - H.n + i + N * 2) % N;

/* One frame of the deck's own analyser, split into mid and side. */
function measure(D) {
  const L = D.L, R = D.R;
  if (!L || !R || !L.length) return null;
  const n = Math.min(L.length, R.length);
  let m = 0, s = 0;
  for (let i = 0; i < n; i++) {
    const l = (L[i] - 128) / 128, r = (R[i] - 128) / 128;
    const mid = (l + r) / 2, side = (l - r) / 2;
    m += mid * mid; s += side * side;
  }
  return { mid: Math.sqrt(m / n), side: Math.sqrt(s / n) };
}

window.DWPANELS.register('centre', 'centre / side', function (c, w, h, T, D) {
  c.fillStyle = T.bg; c.fillRect(0, 0, w, h);
  const now = performance.now();

  const v = measure(D);
  if (v && now - H.last >= 1000 / HZ) { H.last = now; push(v.mid, v.side); }

  if (!v) {
    c.fillStyle = T.dim; c.font = '9px ' + T.fn; c.textAlign = 'center';
    c.fillText('no stereo source', w / 2, h / 2);
    return;
  }

  const pad = 8, x0 = pad, x1 = w - pad;
  const top = 18, bot = h - 26, hh = bot - top;
  /* Scale to the loudest thing SEEN, decayed — so a quiet passage opens up
     instead of flattening. Relative by construction; there is no reference. */
  H.peak = Math.max(1e-6, H.peak * 0.9995);
  const y = val => bot - Math.min(1, val / H.peak) * hh;

  /* grid: quarter lines only, unlabelled. Numbering them would put a scale on
     a reading that has none. */
  c.strokeStyle = T.line; c.lineWidth = 1;
  for (let k = 1; k < 4; k++) {
    const yy = Math.round(top + hh * k / 4) + 0.5;
    c.beginPath(); c.moveTo(x0, yy); c.lineTo(x1, yy); c.stroke();
  }

  const line = (arr, col, fill) => {
    if (H.n < 2) return;
    c.beginPath();
    for (let i = 0; i < H.n; i++) {
      const xx = x0 + (i / (N - 1)) * (x1 - x0);
      const yy = y(arr[at(i)]);
      i ? c.lineTo(xx, yy) : c.moveTo(xx, yy);
    }
    if (fill) {
      c.lineTo(x0 + ((H.n - 1) / (N - 1)) * (x1 - x0), bot);
      c.lineTo(x0, bot); c.closePath();
      c.fillStyle = col; c.globalAlpha = 0.16; c.fill(); c.globalAlpha = 1;
    }
    c.strokeStyle = col; c.lineWidth = 1.5; T.g(c, col, 6); c.stroke();
    c.shadowBlur = 0;
  };
  line(H.side, T.ac2, true);
  line(H.mid,  T.ac,  true);

  /* centre share — the diagnostic line. mid / (mid + side), so it is bounded
     0..1 by construction and needs no scaling decision. */
  if (H.n > 1) {
    c.beginPath();
    for (let i = 0; i < H.n; i++) {
      const m = H.mid[at(i)], s = H.side[at(i)], tot = m + s;
      const share = tot > 1e-7 ? m / tot : 0.5;
      const xx = x0 + (i / (N - 1)) * (x1 - x0);
      const yy = bot - share * hh;
      i ? c.lineTo(xx, yy) : c.moveTo(xx, yy);
    }
    c.strokeStyle = T.dim; c.lineWidth = 1;
    c.setLineDash([3, 3]); c.stroke(); c.setLineDash([]);
  }

  const tot = v.mid + v.side;
  const share = tot > 1e-7 ? v.mid / tot : 0.5;
  c.font = '8px ' + T.fn; c.textBaseline = 'middle';
  c.textAlign = 'left';  c.fillStyle = T.ac;  c.fillText('CENTRE', x0, 9);
  c.textAlign = 'center'; c.fillStyle = T.ac2; c.fillText('SIDES', w / 2, 9);
  c.textAlign = 'right'; c.fillStyle = T.dim;
  c.fillText('centre share ' + (share * 100).toFixed(0) + '%', x1, 9);

  c.textAlign = 'left';  c.fillText(SPAN + 's', x0, h - 8);
  c.textAlign = 'right';
  c.fillText('relative · centre ≠ vocal', x1, h - 8);
});
})();
