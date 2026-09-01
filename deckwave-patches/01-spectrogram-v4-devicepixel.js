/* DECKWAVE PATCH 01 — spectrogram v4
   Replaces the 'waterfall' panel. Load after deckwave-panels.js.

   THE BUG, worth understanding before touching this again:
   getImageData/putImageData work in DEVICE pixels and IGNORE the canvas
   transform. fillRect HONOURS the transform. The panel scrolled its history
   using CSS coordinates while drawing the new column in transformed
   coordinates — so on a devicePixelRatio of 1.75 it scrolled a 233x259 corner
   of a 455x453 buffer and drew the new column somewhere else entirely.
   Right-edge pixel read [0,0,0,0].

   It would have worked perfectly on a non-retina display. That is what made
   it hard to see: correct on the developer's assumptions, broken on real
   hardware. Fix: do the entire panel untransformed, in device pixels.

   Calibration is also measured, not guessed: real material runs p10 -23dB,
   median -10dB, peak -3.7dB. An earlier -62dB floor mapped the median to 0.84
   and produced a solid block. Floor -50, ceiling -3, gamma 3.  */
(function () {
  const FLOOR = -50, CEIL = -3, GAMMA = 3;
  window.DWPANELS.register('waterfall', 'spectrogram', function (c, w, h, T, D) {
    if (!D.freq) return;
    const cv = c.canvas, dpr = window.devicePixelRatio || 1;
    const W = cv.width, H = cv.height, padL = Math.round(26 * dpr);

    c.save();
    c.setTransform(1, 0, 0, 1, 0, 0);            /* device pixels from here */

    try {
      const img = c.getImageData(padL + 1, 0, Math.max(1, W - padL - 1), H);
      c.putImageData(img, padL, 0);
    } catch (e) { /* tainted canvas — degrade to a static column */ }

    const x = W - 1, SR = 44100, N = D.freq.length * 2;
    const FMIN = 40, FMAX = 16000;
    const lmin = Math.log2(FMIN), lspan = Math.log2(FMAX) - lmin;

    for (let y = 0; y < H; y++) {
      const fr = 1 - (y / H), f = Math.pow(2, lmin + fr * lspan);
      const bin = Math.min(D.freq.length - 1, Math.max(1, Math.round(f * N / SR)));
      const raw = D.freq[bin] / 255;
      const db = raw > 0.0005 ? 20 * Math.log10(raw) : -90;
      const v = Math.pow(Math.max(0, Math.min(1, (db - FLOOR) / (CEIL - FLOOR))), GAMMA);
      if (v < 0.03) c.fillStyle = T.bg;
      else {
        const reg = window.DWREGISTER && window.DWREGISTER.mode;
        const base = (reg && reg.on) ? reg.hue : 225;
        c.fillStyle = 'hsl(' + (base - v * 135).toFixed(0) + ','
                    + (40 + v * 50).toFixed(0) + '%,'
                    + (3 + Math.pow(v, 0.6) * 66).toFixed(0) + '%)';
      }
      c.fillRect(x, y, 1, 1);
    }

    /* octave axis — so you can locate what you are looking at */
    c.fillStyle = T.bg; c.fillRect(0, 0, padL, H);
    c.font = (7 * dpr).toFixed(0) + 'px ' + T.fn;
    c.textAlign = 'right'; c.textBaseline = 'middle';
    [[55,'A1'],[110,'A2'],[220,'A3'],[440,'A4'],
     [880,'A5'],[1760,'A6'],[3520,'A7'],[7040,'A8']].forEach(function (p) {
      const fr = (Math.log2(p[0]) - lmin) / lspan;
      if (fr < 0 || fr > 1) return;
      const y = H - fr * H;
      c.strokeStyle = T.line; c.globalAlpha = .28; c.lineWidth = dpr;
      c.beginPath(); c.moveTo(padL, y); c.lineTo(W, y); c.stroke();
      c.globalAlpha = 1;
      c.fillStyle = T.dim; c.fillText(p[1], padL - 3 * dpr, y);
    });

    c.restore();
  }, { note: 'dB, octave axis' });
})();
