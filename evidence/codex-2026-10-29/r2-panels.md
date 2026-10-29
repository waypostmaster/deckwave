**F60 — [INFERRED] REAL**

[MEASURED] The blanket offline claim remains at `index.html:9–11`; party mode can append scripts after startup (`assets/deckwave-popout.js:184–200`). [CAN'T-TELL] Current Libre/demo behavior: that module was not pasted.

[INFERRED] Falsifier: demonstrate that the absent-global branch cannot be reached after startup in supported use. Cached success alone would not establish the blanket claim.

[INFERRED] Proposed patch; all patches and checks below are unrun:

```diff
--- a/index.html
+++ b/index.html
@@ -9,3 +9,4 @@
      one real enemy there; it also runs without the toolbar. No service
-     worker: the page already loads nothing off-origin and works offline
-     only in the sense that it never needed the network after load. -->
+     worker: startup resources are self-hosted. Optional features can request
+     more resources after load; offline use depends on what is already
+     available locally or cached. -->
```

[INFERRED] New `tools/check-review-comments.js`, using only Node built-ins:

```js
const assert = require('assert/strict');
const fs = require('fs');

const html = fs.readFileSync('index.html', 'utf8');
const offline = html.match(/<!-- Installable[\s\S]*?-->/)[0]
  .replace(/\s+/g, ' ');

assert(offline.includes(
  'Optional features can request more resources after load'));
assert(!offline.includes('never needed the network after load'));
```

[INFERRED] Current wording fails; patched wording passes. Deleting the comment also fails. This checks the documentation defect; presenting it as an offline functionality check would be decoration.

[INFERRED] Risk: **heard path: no; threshold/detector: no**. Documentation only.

---

**F64, F71, F90 — [INFERRED] REAL; one defect**

[MEASURED] The comment describes `0.985/frame`; the recurrence uses `.94/.06` (`assets/deckwave-panels.js:473–486`). [INFERRED] Its internal state has an e-folding time of about 16.2 calls, not a fixed wall-clock duration.

[INFERRED] Falsifier: the served recurrence or adjacent comment differs from this paste. Evidence that `.94` was deliberate would support correcting the comment, not falsify the mismatch.

```diff
--- a/assets/deckwave-panels.js
+++ b/assets/deckwave-panels.js
@@ -473,8 +473,7 @@
-/* Smoothed across frames, deliberately. The raw chroma is renormalised to its
-   own maximum every frame, so ranking it directly means three positions are
+/* Smoothed per invocation, deliberately. The raw chroma is renormalised to its
+   own maximum on each call, so ranking it directly means three positions are
    always lit and always reshuffling — the wheel pulses constantly whether or
-   not the harmony moved. 0.985/frame is the same time constant the register
-   colour uses, measured during the damping work rather than picked here: at
-   ~60fps it is roughly a one-second memory, long enough for the display to
-   settle on a tonal centre and still follow a chord change. */
+   not the harmony moved. Each call retains .94 of the previous state and
+   adds .06 of the raw chroma: an e-folding time of about 16 calls, or 0.27s
+   at 60 calls per second. The response depends on draw frequency. */
 let DWP_chSmooth = null;
```

[INFERRED] Append to `tools/check-review-comments.js`:

```js
const panelSrc = fs.readFileSync('assets/deckwave-panels.js', 'utf8');
const smoothing = panelSrc.match(/\/\* Smoothed[\s\S]*?\*\//)[0]
  .replace(/\s+/g, ' ');

assert(smoothing.includes('Smoothed per invocation'));
assert(smoothing.includes('Each call retains .94'));
assert(smoothing.includes('adds .06'));
assert(!/0\.985|one-second memory/.test(smoothing));
assert(panelSrc.includes(
  'DWP_chSmooth[i] = DWP_chSmooth[i] * .94 + raw[i] * .06;'));
```

[INFERRED] Current comment fails; patch passes. A wrong fix changing the visible recurrence to `.985` fails too. An unused matching recurrence could fool this source check; it does not establish perceptual smoothing behavior.

[INFERRED] Risk: **heard path: no; threshold/detector: no changes**. Making the response time-based would change display calibration and is outside this patch.

---

**F65, F76 — [INFERRED] REAL at the draw boundary**

[MEASURED] Polygraph and loudness advance their buffers per invocation (`assets/deckwave-panels.js:202–210,300–301`). Centre decays its peak per invocation, outside its sampling guard (`assets/panel-centre.js:65,77`).

[CAN'T-TELL] Whether dashboard-plus-projector doubling still occurs: `assets/deckwave-loop.js` was not pasted. [MEASURED] The popout supplies `showing`, but that is only its half of the contract (`assets/deckwave-popout.js:261–269`).

[INFERRED] Falsifier: direct equal-duration draws at different rates, including repeated identical timestamps, produce equal buffer advancement and equal normalization after the same input history.

[INFERRED] **No complete patch under the house rule.** Converting `.9995` into elapsed-time decay requires an authorized wall-time calibration. Giving the other buffers fixed sampling rates requires choosing cadences not established by their current code. Assuming 60 Hz would invent those decisions.

[INFERRED] Concrete diagnostic for a new bare-Node `tools/check-history-cadence.js`:

- Evaluate fresh modules in `vm` contexts with controlled `performance.now()`.
- For polygraph/loudness, draw twice at the same timestamp with nonzero frequency data. Assert the second draw contains the same number of recorded history vertices as the first.
- For centre, draw an impulse, then a smaller sample after 100 ms. Draw again at that identical timestamp. Assert the smaller sample’s plotted y coordinate is unchanged.

[INFERRED] These fail current code: the first two add samples; centre changes its scale. No post-patch pass is claimed because no permissible complete patch is supplied. These duplicate-call checks alone would be decoration for refresh-rate independence: merely deduplicating timestamps would pass while 30-versus-120 Hz behavior remained different. That acceptance check must also compare equal-duration schedules after the cadence decision.

[INFERRED] Risk: **heard path: no; display calibration: yes** for the complete remedy. Stop at that boundary.

---

**F68, F73, F88 — [INFERRED] REAL; combine the gap work, retain F73’s additional origin issue**

[MEASURED] Centre uses sample indices and prints `60s` (`assets/panel-centre.js:92,116,130`). Shared histories already use timestamp-based x coordinates, but fills/strokes join across missing observations (`assets/deckwave-panels.js:1168–1187,1215–1221,1272–1294`). Their clock starts on the first feed detecting the track (`assets/deckwave-panels.js:1103–1119`).

[INFERRED] Falsifiers:

- Gap claim: recorded signal strokes and filled polygons do not bridge an injected feed interruption.
- Centre span claim: 600 observations 200 ms apart produce a truthful 119.8-second axis.
- F73 origin claim: first opening at track elapsed 90 seconds either shows track-relative time or explicitly identifies observation-relative time.

[INFERRED] Minimal coherent remedy: preserve sample-count retention and current sampling; timestamp centre observations, split drawing into observed runs, and identify the observation clock. Reuse the energy panel’s existing two-sampling-interval gap policy (`assets/deckwave-panels.js:1371–1376`). This introduces no signal threshold or detector change.

```diff
--- a/assets/panel-centre.js
+++ b/assets/panel-centre.js
@@ -32,4 +32,5 @@
-const SPAN = N / HZ;           /* 60 seconds of history */
+const SPAN = N / HZ;           /* minimum axis span, in seconds */
 
 const H = { mid: new Float32Array(N), side: new Float32Array(N),
+            t: new Float64Array(N),
             n: 0, head: 0, last: 0, peak: 1e-6 };
@@ -37,3 +38,4 @@
-function push(mid, side) {
+function push(mid, side, now) {
   H.mid[H.head] = mid; H.side[H.head] = side;
+  H.t[H.head] = now;
   H.head = (H.head + 1) % N;
@@ -64,2 +66,2 @@
   const v = measure(D);
-  if (v && now - H.last >= 1000 / HZ) { H.last = now; push(v.mid, v.side); }
+  if (v && now - H.last >= 1000 / HZ) { H.last = now; push(v.mid, v.side, now); }
@@ -73,2 +75,6 @@
   const pad = 8, x0 = pad, x1 = w - pad;
   const top = 18, bot = h - 26, hh = bot - top;
+  const first = H.n ? H.t[at(0)] : now;
+  const span = Math.max(SPAN * 1000, H.n ? H.t[at(H.n - 1)] - first : 0);
+  const x = i => x0 + ((H.t[at(i)] - first) / span) * (x1 - x0);
+  const broke = i => i > 0 && H.t[at(i)] - H.t[at(i - 1)] > 2 * 1000 / HZ;
@@ -88,16 +94,20 @@
   const line = (arr, col, fill) => {
     if (H.n < 2) return;
-    c.beginPath();
-    for (let i = 0; i < H.n; i++) {
-      const xx = x0 + (i / (N - 1)) * (x1 - x0);
-      const yy = y(arr[at(i)]);
-      i ? c.lineTo(xx, yy) : c.moveTo(xx, yy);
-    }
-    if (fill) {
-      c.lineTo(x0 + ((H.n - 1) / (N - 1)) * (x1 - x0), bot);
-      c.lineTo(x0, bot); c.closePath();
-      c.fillStyle = col; c.globalAlpha = 0.16; c.fill(); c.globalAlpha = 1;
+    for (let i = 0; i < H.n; ) {
+      let j = i + 1; while (j < H.n && !broke(j)) j++;
+      if (j - i >= 2) {
+        c.beginPath();
+        for (let k = i; k < j; k++) {
+          const xx = x(k), yy = y(arr[at(k)]);
+          k === i ? c.moveTo(xx, yy) : c.lineTo(xx, yy);
+        }
+        if (fill) {
+          c.lineTo(x(j - 1), bot); c.lineTo(x(i), bot); c.closePath();
+          c.fillStyle = col; c.globalAlpha = 0.16; c.fill(); c.globalAlpha = 1;
+        }
+        c.strokeStyle = col; c.lineWidth = 1.5; T.g(c, col, 6); c.stroke();
+        c.shadowBlur = 0;
+      }
+      i = j;
     }
-    c.strokeStyle = col; c.lineWidth = 1.5; T.g(c, col, 6); c.stroke();
-    c.shadowBlur = 0;
   };
@@ -116,3 +126,3 @@
-      const xx = x0 + (i / (N - 1)) * (x1 - x0);
+      const xx = x(i);
       const yy = bot - share * hh;
-      i ? c.lineTo(xx, yy) : c.moveTo(xx, yy);
+      i && !broke(i) ? c.lineTo(xx, yy) : c.moveTo(xx, yy);
@@ -130,2 +140,2 @@
-  c.textAlign = 'left';  c.fillText(SPAN + 's', x0, h - 8);
+  c.textAlign = 'left';  c.fillText((span / 1000).toFixed(1) + 's axis', x0, h - 8);
   c.textAlign = 'right';
```

```diff
--- a/assets/deckwave-panels.js
+++ b/assets/deckwave-panels.js
@@ -45,4 +45,4 @@
   timeline: { t:'Time series', u:'https://en.wikipedia.org/wiki/Time_series', verified:false,
-    d:'Level and the three frequency bands across the current track. The x axis GROWS as the track plays, so early on you are looking at the first few seconds stretched across the panel; past sixty seconds it scrolls and keeps the last minute. Resets on every track change. Levels are relative to full scale, not calibrated.' },
+    d:'Level and the three frequency bands across retained observations of the current track. Time starts at the first observation, not at playback start. Keeps up to 600 observations; gaps can make these span more than a minute. The axis grows, then scrolls as observations are replaced. Gaps are left blank. Resets on every track change. Levels are relative to full scale, not calibrated.' },
   loudtime: { t:'Crest factor', u:'https://en.wikipedia.org/wiki/Crest_factor', verified:false,
-    d:'Loudness alone over the last sixty seconds, with no band lines competing for the height. The filled area is the VU average (300ms ballistics); the thin line above it is the PPM peak (5ms attack). The GAP between them is crest factor by eye — wide while the material still has transients, collapsing to a narrow band when it has been heavily limited. The vertical axis is deliberately unlabelled: it is a normalised VU scale aligned to −6 dBFS, and that alignment is a choice made here, not a standard, so no dB figures are printed against it.' },
+    d:'Loudness alone across retained observations, with no band lines competing for the height. Time starts at the first observation of the track, not at playback start. Keeps up to 600 observations; gaps are left blank and can make the span exceed a minute. The filled area is the VU average (300ms ballistics); the thin line above it is the PPM peak (5ms attack). The GAP between them is crest factor by eye — wide while the material still has transients, collapsing to a narrow band when it has been heavily limited. The vertical axis is deliberately unlabelled: it is a normalised VU scale aligned to −6 dBFS, and that alignment is a choice made here, not a standard, so no dB figures are printed against it.' },
@@ -1091,8 +1091,7 @@
 /* ── shared history for the timeline panels ────────────────────────────
-   One ring buffer, sampled on a clock rather than per frame, so the x axis
-   means seconds and not frames. 10 Hz for 120 s is 1200 points — more than
-   any panel needs horizontally, and cheap.
+   One buffer, sampled on a clock rather than per frame. Up to 600
+   observations at 10 Hz; missed observations are not filled in.
 
-   It RESETS when the track index changes, so each track builds its own
-   picture from zero. That is the behaviour asked for: start at 0, grow the
-   axis as the track plays, and stop growing at sixty seconds. */
+   It resets when the track identity changes, with the index as fallback.
+   Time starts at the first observation of that track, not its playback start.
+   Retention is by sample count, so gaps can make the span exceed sixty seconds. */
@@ -1138,3 +1137,4 @@
   },
+  broke(i) { return i > 0 && this.t[i] - this.t[i - 1] > 2 / this.hz; },
   /* seconds currently spanned, which is what makes the axis grow */
   span() { return this.t.length ? Math.max(1, this.t[this.t.length - 1] - this.t[0]) : 1; }
@@ -1156,1 +1156,15 @@
 const dwpMMSS = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
+
+function dwpHistoryArea(c, H, values, x, y) {
+  const n = H.t.length;
+  for (let i = 0; i < n; ) {
+    let j = i + 1;
+    while (j < n && !H.broke(j)) j++;
+    if (j - i >= 2) {
+      c.beginPath(); c.moveTo(x(i), y(0));
+      for (let k = i; k < j; k++) c.lineTo(x(k), y(values[k]));
+      c.lineTo(x(j - 1), y(0)); c.closePath(); c.fill();
+    }
+    i = j;
+  }
+}
@@ -1158,2 +1172,2 @@
-/* TIMELINE — level and the polygraph bands over the track so far. The x axis
-   grows with the music up to sixty seconds, then scrolls. */
+/* TIMELINE — level and bands across retained observations of this track.
+   The x axis grows until the sample buffer fills, then scrolls. */
@@ -1176,5 +1190,3 @@
   /* level as a filled area, bands as lines over it */
-  c.beginPath(); c.moveTo(x(0), y(0));
-  for (let i = 0; i < n; i++) c.lineTo(x(i), y(H.level[i]));
-  c.lineTo(x(n - 1), y(0)); c.closePath();
-  c.fillStyle = DWP_col(30, .28) || 'rgba(34,232,255,.20)'; c.fill();
+  c.fillStyle = DWP_col(30, .28) || 'rgba(34,232,255,.20)';
+  dwpHistoryArea(c, H, H.level, x, y);
@@ -1185,3 +1197,3 @@
       for (let i = 0; i < n; i++) { const px = x(i), py = y(H[k][i]);
-        i ? c.lineTo(px, py) : c.moveTo(px, py); }
+        i && !H.broke(i) ? c.lineTo(px, py) : c.moveTo(px, py); }
       c.stroke();
@@ -1194,3 +1206,3 @@
   c.textAlign = 'left';  c.fillText(dwpMMSS(H.t[0]), padL, h - 3);
   c.textAlign = 'right'; c.fillText(dwpMMSS(H.t[n - 1]) +
-    (n >= H.max ? ' · scrolling' : ' · growing'), w - 4, h - 3);
+    ' · since first observation', w - 4, h - 3);
@@ -1199,2 +1211,2 @@
   c.fillStyle = DWP_col(70) || T.ac;  c.fillText('high', padL + 52, h - 3);
-}, { note: 'grows to 60s, then scrolls' });
+}, { note: 'retained history · observation clock' });
@@ -1217,5 +1229,3 @@
   /* bass magnitude, filled */
-  c.beginPath(); c.moveTo(x(0), h - padB);
-  for (let i = 0; i < n; i++) c.lineTo(x(i), 4 + gh - H.bass[i] * gh);
-  c.lineTo(x(n - 1), h - padB); c.closePath();
-  c.fillStyle = DWP_col(24, .35) || 'rgba(255,45,149,.22)'; c.fill();
+  c.fillStyle = DWP_col(24, .35) || 'rgba(255,45,149,.22)';
+  dwpHistoryArea(c, H, H.bass, x, v => 4 + gh - v * gh);
@@ -1226,2 +1236,5 @@
   for (let i = lag; i < n; i++) {
+    let gap = false;
+    for (let j = i - lag + 1; j <= i; j++) if (H.broke(j)) { gap = true; break; }
+    if (gap) continue;
     const d = H.bass[i] - H.bass[i - lag];
@@ -1248,2 +1261,3 @@
   c.textAlign = 'left';  c.fillText('bass fill + rate of rise', 4, h - 3);
-  c.textAlign = 'right'; c.fillText(dwpMMSS(H.t[n - 1]), w - 4, h - 3);
+  c.textAlign = 'right'; c.fillText(dwpMMSS(H.t[n - 1]) +
+    ' · since first observation', w - 4, h - 3);
@@ -1252,2 +1266,2 @@
-/* LOUDTIME — the same 60s history, loudness ONLY. No band lines, no legend
+/* LOUDTIME — the same retained history, loudness ONLY. No band lines, no legend
    competing for the vertical, so the envelope gets the full height. Two
@@ -1280,5 +1294,3 @@
-  c.beginPath(); c.moveTo(x(0), y(0));
-  for (let i = 0; i < n; i++) c.lineTo(x(i), y(H.level[i]));
-  c.lineTo(x(n - 1), y(0)); c.closePath();
-  c.fillStyle = DWP_col(34, .34) || 'rgba(34,232,255,.26)'; c.fill();
+  c.fillStyle = DWP_col(34, .34) || 'rgba(34,232,255,.26)';
+  dwpHistoryArea(c, H, H.level, x, y);
   c.strokeStyle = DWP_col(64) || T.ac; c.lineWidth = 1.2;
@@ -1286,3 +1298,3 @@
   for (let i = 0; i < n; i++) { const px = x(i), py = y(H.level[i]);
-    i ? c.lineTo(px, py) : c.moveTo(px, py); }
+    i && !H.broke(i) ? c.lineTo(px, py) : c.moveTo(px, py); }
   c.stroke();
@@ -1292,3 +1304,3 @@
   for (let i = 0; i < n; i++) { const px = x(i), py = y(H.peak[i]);
-    i ? c.lineTo(px, py) : c.moveTo(px, py); }
+    i && !H.broke(i) ? c.lineTo(px, py) : c.moveTo(px, py); }
   c.stroke(); c.globalAlpha = 1;
@@ -1301,3 +1313,3 @@
-  c.fillText(dwpMMSS(H.t[n - 1]) + (n >= H.max ? ' · scrolling' : ' · growing'),
-             w - 3, h - 3);
-}, { note: 'VU average and PPM peak, 60s' });
+  c.fillText(dwpMMSS(H.t[n - 1]) +
+    ' · since first observation', w - 3, h - 3);
+}, { note: 'VU average and PPM peak · retained history' });
```

[INFERRED] New `tools/check-history-gaps.js`: use `fs`, `vm`, `assert/strict`; evaluate actual modules with a fake clock and a canvas recorder that retains subpaths, fills, stroke styles and text. Drive registered `draw` functions, not copied drawing logic.

[INFERRED] Required assertions:

1. **Continuous control:** draw at 1000, 1100, 1200, 1300 ms. Require connected signal traces and one filled polygon per filled series.
2. **Hole:** fresh context; draw at 1000, 1100, 1200, 11000, 11100 ms. Require two filled polygons per filled series and separate signal subpaths on both sides. Assert that no signal segment or polygon crosses the midpoint of the hole. Exclude gridlines by recorded style.
3. **Derivative:** keep bass low before that hole and high afterward; add a draw at 11200 ms. Require no flare or steepest marker derived across the hole. A separate uninterrupted low-to-high fixture must still produce both.
4. **Slow centre:** 600 draws at `1000 + i * 200` ms. Require text `119.8s axis` and the final history vertex at `w - 8`.
5. **Late opening:** first observation with `D.elapsed = 90`; require `since first observation` in each shared panel’s populated footer.

[INFERRED] Current code fails the hole, derivative, slow-centre and origin assertions. The patch passes by construction, subject to execution. Counting only “fills 1 → 2” would be decoration: two polygons could still bridge the hole. Deleting traces or breaking every segment fails the positive controls; filtering away the hole without preserving timestamp coordinates fails the geometry assertion.

[INFERRED] Risk: **heard path: no; signal threshold/detector: unchanged**. Display effects include blank gaps, timestamp spacing, longer centre axes when necessary, and observation-relative footers replacing growing/scrolling text. Derivative lag and gain remain unchanged; comparisons spanning missing data are omitted. F65 remains unresolved. The longer footer needs a narrow-panel visual check.

---

**F69, F74, F81 — [INFERRED] REAL; one defect**

[MEASURED] `parseInt(cam) || 1` plus the non-B offset maps `?` to 1A geometry (`assets/panel-wayposts.js:37–41`). Scatter, trail, routes and current-position drawing all consume that position (`assets/panel-wayposts.js:81–142`).

[INFERRED] Falsifier: at equal BPM, an unknown-key fixture produces neither a harmonic marker nor an incident route segment, while a known 1A control still does.

```diff
--- a/assets/panel-wayposts.js
+++ b/assets/panel-wayposts.js
@@ -37,3 +37,4 @@
-    const ang = cam => (((parseInt(cam) || 1) - 1) / 12) * Math.PI * 2 - Math.PI / 2;
+    const ang = cam => ((parseInt(cam) - 1) / 12) * Math.PI * 2 - Math.PI / 2;
     const pos = t => {
+      if (!t || !t.bpm || !/^(?:[1-9]|1[0-2])[AB]$/.test(t.camelot)) return null;
       const a = ang(t.camelot), r = rad(t.bpm);
@@ -81,4 +82,5 @@
     corpus.forEach(t => {
-      if (!t.bpm) return;
-      const [x, y] = pos(t);
+      const p = pos(t);
+      if (!p) return;
+      const [x, y] = p;
       const ok = (nav && haveTempo) ? nav.reachable(Tnow, t) : false;
@@ -99,6 +101,8 @@
       const from = Math.max(0, here - 14);
+      let pen = false;
       for (let i = from; i <= here; i++) {
-        const t = S[i]; if (!t || !t.bpm) continue;
-        const [x, y] = pos(t); i === from ? c.moveTo(x, y) : c.lineTo(x, y);
+        const p = pos(S[i]);
+        if (!p) { pen = false; continue; }
+        const [x, y] = p; pen ? c.lineTo(x, y) : c.moveTo(x, y); pen = true;
       }
       c.stroke(); c.globalAlpha = 1;
@@ -113,3 +117,7 @@
       c.setLineDash([5, 4]); c.lineDashOffset = -(performance.now() / 1000) * 16;
-      c.beginPath(); pts.forEach((p, i) => i ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]));
+      c.beginPath(); let pen = false;
+      pts.forEach(p => {
+        if (!p) { pen = false; return; }
+        pen ? c.lineTo(p[0], p[1]) : c.moveTo(p[0], p[1]); pen = true;
+      });
       c.stroke(); c.setLineDash([]); c.shadowBlur = 0;
@@ -116,3 +124,5 @@
       chain.forEach((t, i) => {
-        const [x, y] = pos(t), last = i === chain.length - 1;
+        const p = pos(t);
+        if (!p) return;
+        const [x, y] = p, last = i === chain.length - 1;
         c.fillStyle = last ? '#3ee68a' : T.ac2; T.g(c, c.fillStyle, last ? 12 : 7);
@@ -123,6 +133,8 @@
       const dest = S[q.idx], cur = curTrack;
-      if (dest) {
-        const [x, y] = pos(dest);
+      const p = pos(dest);
+      if (p) {
+        const [x, y] = p;
         const k = q.mode === 'force' ? T.bad : '#3ee68a';
         c.strokeStyle = k; c.lineWidth = 1.4; T.g(c, k, 8); c.setLineDash([4, 3]);
-        if (cur) { const [ax, ay] = pos(cur); c.beginPath(); c.moveTo(ax, ay); c.lineTo(x, y); c.stroke(); }
+        const a = pos(cur);
+        if (a) { const [ax, ay] = a; c.beginPath(); c.moveTo(ax, ay); c.lineTo(x, y); c.stroke(); }
@@ -136,4 +148,4 @@
-    const cur = curTrack;
-    if (cur && cur.bpm) {
-      const [x, y] = pos(cur);
+    const cur = curTrack, p = pos(cur);
+    if (p) {
+      const [x, y] = p;
       const pulse = 1 + Math.sin(performance.now() / 380) * 0.16;
```

[INFERRED] New `tools/check-wayposts.js`, using Node `vm` and a canvas operation recorder:

- At equal BPM, compare isolated `1A` and `?` corpus/current-track fixtures. Assert one corpus marker and one current marker for known 1A, neither for `?`.
- Drive played trail `[1A, ?, 3A]`; assert no segment incident on `?` **and no shortcut connecting 1A to 3A**.
- Repeat through `queue.mode = 'route'`, with the unknown as first, middle and final position. Retain markers and original numbering for known hops.
- Exercise `next` and `force` with unknown current and unknown destination separately. A known destination still gets its marker when current is unknown.
- Control: `[1A, 2A, 3A]` retains both connecting edges.

[INFERRED] Current code fails the unknown-marker/edge assertions; the patch rejects unknown coordinates at every consumer. Removing the panel fails the controls; `filter(Boolean)` on route points fails the shortcut assertion. These checks do not validate reachability calculations.

[INFERRED] Risk: **heard path: no; threshold/detector: no**. Navigation, the gate and reachability counts remain untouched. Invalid Camelot strings are also omitted; known coordinates are unchanged.

---

**F70, F75 — [INFERRED] REAL; one defect**

[MEASURED] Sprite selection tests `S[sel]`, while the label tests only `sel === 'auto'` (`assets/deckwave-sprites.js:312–322`). The centre default remains `jam` (`assets/deckwave-panels.js:706`).

[INFERRED] Falsifier: `jam` under cyberpunk renders `chip` without the pinned suffix, while explicit `chip` remains pinned.

```diff
--- a/assets/deckwave-sprites.js
+++ b/assets/deckwave-sprites.js
@@ -321,2 +321,2 @@
   c.fillStyle = T.dim; c.font = '8px ' + T.fn; c.textAlign = 'center';
-  c.fillText(sp.label + (sel === 'auto' ? '' : ' · pinned'), w / 2, h - 8);
+  c.fillText(sp.label + (S[sel] ? ' · pinned' : ''), w / 2, h - 8);
```

[INFERRED] New `tools/check-sprite-labels.js`:

```js
const assert = require('assert/strict');
const fs = require('fs');
const vm = require('vm');

const box = {
  performance: { now: () => 1000 },
  localStorage: { getItem: () => null, setItem() {} }
};
box.window = box;
vm.createContext(box);
for (const file of ['deckwave-panels.js', 'deckwave-sprites.js'])
  vm.runInContext(fs.readFileSync('assets/' + file, 'utf8'), box);

const T = { bg: '#000', ac: '#0ff', ac2: '#f0f', dim: '#777', line: '#333', fn: 'x' };
let text;
const c = { fillRect() {}, fillText(s) { text = s; } };
function label(sel, theme) {
  box.DWDASH = { _dev: { theme } };
  box.DWPANELS.sprite = sel;
  box.DWSPRITES.draw(c, 240, 180, T, {});
  return text;
}
for (const sel of ['jam', 'robot', 'orbit', 'pulse', 'none', 'auto']) {
  assert.equal(label(sel, 'cyberpunk'), 'chip');
  assert.equal(label(sel, 'classic'), 'invader');
}
assert.equal(label('chip', 'cyberpunk'), 'chip · pinned');
assert.equal(label('chip', 'classic'), 'chip · pinned');
```

[INFERRED] Current non-pixel choices fail. Removing every pinned suffix fails the explicit-selection controls; hard-coding the fallback label fails the theme control. Painting incorrect art with correct labels could still pass: this checks the reported label defect.

[INFERRED] Risk: **heard path: no; threshold/detector: no**. One suffix condition changes.

---

**F83 — [INFERRED] REAL when mounted**

[MEASURED] `fit()` reads the mutable height attribute before multiplying it (`assets/deckwave-visuals.js:156–161`); idle drawing also reads that attribute (`assets/deckwave-visuals.js:264–269`). [INFERRED] Canvas attribute/property reflection makes repeated resizing compound.

[MEASURED] This component is not loaded by the pasted main page (`index.html:49–56`). [CAN'T-TELL] Current generated design-system consumers.

[INFERRED] Falsifier: a reflecting canvas at DPR 2 stays at backing height 160 through mount and repeated resize, and idle drawing uses logical height 80.

```diff
--- a/assets/deckwave-visuals.js
+++ b/assets/deckwave-visuals.js
@@ -151,4 +151,8 @@
   const cvs = { scope: $('scope'), spec: $('spec'), chroma: $('chroma'), punch: $('punch') };
   const ctxs = {}; Object.keys(cvs).forEach(k => ctxs[k] = cvs[k].getContext('2d'));
+  const heights = {};
+  Object.keys(cvs).forEach(k => {
+    heights[k] = +cvs[k].getAttribute('height');
+    cvs[k].style.height = heights[k] + 'px'; });
   const cs = () => getComputedStyle(host);
 
@@ -157,4 +161,4 @@
     Object.keys(cvs).forEach(k => { const c = cvs[k];
-      c.width = c.clientWidth * dpr; c.height = c.getAttribute('height') * dpr;
+      c.width = c.clientWidth * dpr; c.height = heights[k] * dpr;
       ctxs[k].setTransform(dpr, 0, 0, dpr, 0, 0); });
   }
@@ -265,3 +269,3 @@
     Object.keys(cvs).forEach(k => { const c = ctxs[k], w = cvs[k].clientWidth,
-      h = +cvs[k].getAttribute('height');
+      h = heights[k];
       c.fillStyle = C.bg; c.fillRect(0, 0, w, h);
```

[INFERRED] New `tools/check-visuals-fit.js`: evaluate the actual module with `vm`; fake the shadow DOM, parse canvas IDs/heights from assigned markup, capture the resize listener and canvas operations. The fake’s height setter **must update `getAttribute('height')`**; assert that reflection before mounting.

[INFERRED] After mounting at DPR 2:

```js
assert.deepEqual(backingHeights(), [160, 220, 220, 108]);
resize();
resize();
assert.deepEqual(backingHeights(), [160, 220, 220, 108]);
assert.equal(scope.style.height, '80px');

window.devicePixelRatio = 1;
resize();
assert.deepEqual(backingHeights(), [80, 110, 110, 54]);

window.devicePixelRatio = 3;
resize();
assert.deepEqual(backingHeights(), [240, 330, 330, 162]);

mounted.start(); // no analyser: exercises idle()
assert.deepEqual(scopeLastFillRect(), [0, 0, scope.clientWidth, 80]);
assert.deepEqual(scopeLastTransform(), [3, 0, 0, 3, 0, 0]);
```

[INFERRED] Current repeated-resize and idle-height assertions fail. A non-reflecting fake would conceal the defect. Disabling resize could pass unchanged-DPR assertions but fails the DPR transitions; fixing only `fit()` fails the idle assertion.

[INFERRED] Risk: **heard path: no; threshold/detector: no**. CSS heights become explicitly fixed to their original logical heights, matching the active drawing dimensions; this needs a component layout glance.

---

**F91 — [INFERRED] REAL**

[MEASURED] The glossary promises a track-wide maximum (`assets/deckwave-panels.js:49–50`); the marker searches retained arrays afresh, and retention shifts old samples (`assets/deckwave-panels.js:1135–1136,1224–1229`).

[INFERRED] Falsifier: after the earlier strongest rise has been evicted, the marker still identifies it through separately retained state.

```diff
--- a/assets/deckwave-panels.js
+++ b/assets/deckwave-panels.js
@@ -49,3 +49,3 @@
   drops: { t:'Derivative', u:'https://en.wikipedia.org/wiki/Special:Search?search=derivative+rate+of+change+signal', verified:false,
-    d:'The filled area is bass energy. The bright vertical flares are its RATE OF RISE over about 0.4s, so a fast climb out of a quiet passage lights up and a steady loud passage does not. The dashed marker is the steepest rise so far in this track. It renders change; it does not classify anything as a drop.' },
+    d:'The filled area is bass energy. The bright vertical flares are its RATE OF RISE over about 0.4s, so a fast climb out of a quiet passage lights up and a steady loud passage does not. The dashed marker is the steepest rise in the retained history. It renders change; it does not classify anything as a drop.' },
   journey: { t:'Circle of fifths', u:'https://en.wikipedia.org/wiki/Circle_of_fifths', verified:false,
```

[INFERRED] Append to `tools/check-review-comments.js`:

```js
const win = {};
require('vm').runInNewContext(panelSrc, { window: win });
const drops = win.DWPANELS.wiki('drops').d;
assert(drops.includes('steepest rise in the retained history'));
assert(!drops.includes('steepest rise so far in this track'));
```

[INFERRED] Current text fails; patched text passes. This documentation check does not establish correct derivative arithmetic or gap handling. An eviction test alone would be decoration for this fix: current window-scoped behavior already evicts the maximum.

[INFERRED] Risk: **heard path: no; threshold/detector: no**. “Retained history” avoids promising a wall-clock minute.

---

**F118 — [CAN'T-TELL] Relocation-contract violation; literal paths are confirmed**

[MEASURED] Both URLs remain hard-coded and are assigned directly to script `src` (`assets/deckwave-popout.js:184–200`).

[CAN'T-TELL] Whether current `DW.assets.base/files` promises to relocate these dependencies: `assets/deckwave.js`, `assets/deckwave-flac.js` and `assets/deckwave-render.js` were not pasted. Their APIs cannot be reconstructed from the older finding.

[INFERRED] No integration diff is justified yet. Confirmation that the current public asset contract covers lazy party dependencies establishes REAL; an explicit exclusion would falsify that contract-violation claim.

[MEASURED] The pasted happy-path harness preinstalls both globals, bypassing successful script loading (`tools/check-popout.js:139–155`). [INFERRED] It therefore supplies no relocation coverage.

[INFERRED] Once the contract is available, extend that harness at its existing `document.head.appendChild` seam: remove both globals, configure the **verified** relocation fields, record both requested URLs, install each corresponding fake global on load, and call `s.onload()`. Assert exact relocated URLs and successful party creation; repeat with the default configuration. Merely asserting `startsWith(base)` could accept wrong filenames. No post-patch pass is claimed without a patch.

[CAN'T-TELL] Patch risk until the resolver contract is supplied; no heard-path or detector change is proposed.

---

**Existing checks that do not exclude their advertised failure**

- [MEASURED] The slot checks only search source strings for the comparison, projector wording and ordinary draw call (`tools/check-popout.js:241–253`). [INFERRED] **Decoration for proving suppression:** all three pass if the guard is unreachable or lacks the required control flow. Execute the actual loop with projected and ordinary slots and assert draw counts; that loop was not supplied.
- [MEASURED] “Draws nothing and survives” asserts only that the window remains open (`tools/check-popout.js:136–137`). [INFERRED] **Decoration for “draws nothing”:** erroneous drawing or a caught rendering exception can pass.
- [MEASURED] Rotation and click checks count preset loads, without recording preset identity (`tools/check-popout.js:149,158–161`). [INFERRED] **Decoration for changing presets:** reloading the same preset passes. Record names and assert successive selections differ.

**[INFERRED] Ranked build order**

1. **F69/F74/F81:** fabricated harmonic positions and routes.
2. **F83:** compounding canvas allocation, scoped to mounted consumers.
3. **F68/F73/F88:** gaps, truthful spans and observation origin; inspect narrow-panel labels.
4. **F70/F75:** incorrect pinned status.
5. **F60, F64/F71/F90, F91:** documentation corrections together.
6. **F118:** obtain the current asset contract, then implement and exercise actual loading.
7. **F65/F76:** establish the permitted display cadence/calibration before implementation.