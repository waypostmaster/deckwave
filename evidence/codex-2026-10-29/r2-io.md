**[INFERRED] F101 — REAL; F128 is the cleanup duplicate.** The loader portion belongs under F111 below.

**[MEASURED]** Metadata directly sizes the arrays (`assets/deckwave-flac.js:87–91`). Initialization and processing exceptions can bypass deletion; `.catch(no)` rejects without disposing (`assets/deckwave-flac.js:127–159`).

**[INFERRED] Falsifier:** instrument allocations and decoder calls. If the current source avoids allocation from the advertised total and deletes exactly once after both initial and deferred exceptions, these defects are falsified.

**[INFERRED] Proposed patch:** allocate using the existing delivered-frame growth path; retain `total` for progress. Centralize disposal without adding a size cap.

```diff
--- a/assets/deckwave-flac.js
+++ b/assets/deckwave-flac.js
@@ -86,7 +86,7 @@
     const meta = m => {
-      /* STREAMINFO arrives first; size the output from it. total_samples can
-         legitimately be 0 for a stream of unknown length, so grow if needed. */
+      /* STREAMINFO supplies format and progress. Allocate output when
+         decoded frames arrive, including streams of unknown length. */
       sr = m.sampleRate; ch = m.channels; bps = m.bitsPerSample; total = m.total_samples || 0;
       if (bps !== 8 && bps !== 16 && bps !== 24 && bps !== 32) { err = new Error('unsupported FLAC bit depth ' + bps); return; }
-      chans = []; for (let c = 0; c < ch; c++) chans.push(new Float32Array(total));
+      chans = []; for (let c = 0; c < ch; c++) chans.push(new Float32Array(0));
     };
@@ -127,10 +127,18 @@
     const dec = Flac.create_libflac_decoder(false);
     if (!dec) return no(new Error('libflac decoder init failed'));
-    const st = Flac.init_decoder_stream(dec, read, write, onErr, meta, false);
-    if (st !== 0) { try { Flac.FLAC__stream_decoder_delete(dec); } catch (e) {} return no(new Error('init_decoder_stream ' + st)); }
+    let disposed = false;
+    const dispose = () => {
+      if (disposed) return; disposed = true;
+      try { Flac.FLAC__stream_decoder_finish(dec); } catch (e) {}
+      try { Flac.FLAC__stream_decoder_delete(dec); } catch (e) {}
+    };
+    const fail = e => { dispose(); no(e); };
+    let st;
+    try { st = Flac.init_decoder_stream(dec, read, write, onErr, meta, false); }
+    catch (e) { fail(e); return; }
+    if (st !== 0) return fail(new Error('init_decoder_stream ' + st));
 
     const yieldEvery = opts.yieldEvery || 400;
     const finish = () => {
-      try { Flac.FLAC__stream_decoder_finish(dec); } catch (e) {}
-      try { Flac.FLAC__stream_decoder_delete(dec); } catch (e) {}
+      dispose();
       if (err) return no(err);
@@ -148,12 +156,5 @@
       if (opts.onProgress && total) opts.onProgress(Math.min(1, filled / total));
-      /* A THROW AFTER THE FIRST STEP MUST REJECT THE DECODE, not vanish
-         (review 2026-09-01). `step` runs inside a `.then` from the second
-         chunk on, so anything that threw there — a libflac state the
-         unpacker refuses, an allocation failure on a phone, a caller's own
-         onProgress — rejected an intermediate promise nobody held: the
-         decode promise never settled, the scan sat on that track forever
-         and no failure was ever counted. `.catch(no)` is the whole fix;
-         `finish()` is inside the chain too, so it is covered as well. */
-      if (more && !err) yieldNow().then(step).catch(no); else finish();
+      /* Initial and deferred exceptions both reject and dispose. */
+      if (more && !err) yieldNow().then(step).catch(fail); else finish();
     };
-    step();
+    try { step(); } catch (e) { fail(e); }
```

**[INFERRED] Check — new `tools/check-flac-lifecycle.js`, using only `fs`, `vm`, and `assert`:**

- Evaluate the actual decoder with a fake Flac and an allocation-recording `Float32Array` constructor. Advertise `2 ** 35` samples, deliver two known PCM samples, then end. The allocation spy must throw instead of actually allocating if asked for the advertised length. Assert successful two-sample output, exact sample values, and the same allocation requests as the identical fixture with `total_samples: 0`. Current source fails at its metadata allocation.
- With `yieldEvery: 1`, separately throw during initialization, first processing, deferred processing, and the second progress callback. Assert rejection with the injected error, one finish attempt, and one delete call. Current source misses disposal.
- Include successful decoding as a control against “reject everything.”

**[INFERRED] Check limitation:** these assertions cannot establish safety against an enormous stream of genuinely delivered frames; lazy allocation is not a general memory ceiling. A decoder that corrupts samples outside the fixture could also pass.

**[INFERRED] Risk:** **HEARD PATH: indirect**, through fallback availability and allocation latency. Sample conversion and delivered length stay unchanged; no threshold, detector, or detector-input transformation changes.

---

**[INFERRED] F111 — REAL; F106 and F101’s loader claims are grouped here.**

**[MEASURED]** Both loaders retain rejected promises (`assets/deckwave-flac.js:40–54`; `assets/deckwave-render.js:182–201`). Both timers resolve without readiness; the renderer also accepts any existing `Flac` immediately (`assets/deckwave-flac.js:56–61`; `assets/deckwave-render.js:183,194–196`).

**[INFERRED]** Concurrent calls to one loader share its promise; calls to the two separate loaders can insert two scripts. “Only reload can recover” is too strong: an existing global is checked before either rejected cache.

**[INFERRED] Falsifier:** fail a load with no global, retry successfully, and exercise concurrent boots against an existing unready global. Current-source retry success, one shared insertion, and no fulfillment before readiness would falsify the corresponding claims.

**[INFERRED] Proposed patch:** share the attempt across both independently usable modules, retain successful readiness, clear failures, and reject at the existing 4000 ms timeout.

```diff
--- a/assets/deckwave-flac.js
+++ b/assets/deckwave-flac.js
@@ -36,27 +36,34 @@
-let ready = null;
-/* Same loader shape as DWRENDER.boot, same source of truth for the path
-   (DW.assets). Kept separate so this module does not depend on the render
-   module being loaded — a phone that only ever decodes never needs it. */
+/* Shared with DWRENDER, including readiness and failed-attempt retry. */
 function boot(url) {
-  if (window.Flac) return ensureReady(window.Flac);
-  if (ready) return ready;
-  ready = new Promise((ok, no) => {
-    const s = document.createElement('script');
+  if (window._dwFlacReady) return window._dwFlacReady;
+  let s = null;
+  const pending = new Promise((ok, no) => {
+    const wait = () => {
+      const Flac = window.Flac;
+      if (!Flac) return no(new Error('libflac loaded but Flac is undefined'));
+      if (Flac.isReady && Flac.isReady()) return ok(Flac);
+      const previous = Flac.onready;
+      const done = error => {
+        clearTimeout(timer);
+        if (Flac.onready === onready) Flac.onready = previous;
+        if (error) no(error); else ok(Flac);
+      };
+      const onready = () => { done(); if (typeof previous === 'function') previous.call(Flac); };
+      const timer = setTimeout(() => done(new Error('libflac readiness timed out')), 4000);
+      Flac.onready = onready;
+    };
+    if (window.Flac) return wait();
+    s = document.createElement('script');
     const A = window.DW && window.DW.assets;
     s.src = url || (A ? A.base + A.files.flac : 'vendor/libflac.min.js');
-    s.onload = () => {
-      if (!window.Flac) return no(new Error('libflac loaded but Flac is undefined'));
-      ensureReady(window.Flac).then(ok, no);
-    };
+    s.onload = () => { try { wait(); } catch (e) { no(e); } };
     s.onerror = () => no(new Error('could not load ' + s.src + ' — is vendor/ present?'));
     document.head.appendChild(s);
   });
-  return ready;
-}
-function ensureReady(Flac) {
-  if (Flac.isReady && Flac.isReady()) return Promise.resolve(Flac);
-  return new Promise(ok => {
-    Flac.onready = () => ok(Flac);
-    setTimeout(() => ok(Flac), 4000);   /* older builds never fire onready */
+  window._dwFlacReady = pending;
+  pending.catch(() => {
+    if (window._dwFlacReady === pending) window._dwFlacReady = null;
+    if (s) { try { s.remove(); } catch (e) {} }
   });
+  return pending;
 }
--- a/assets/deckwave-render.js
+++ b/assets/deckwave-render.js
@@ -181,22 +181,34 @@
-let flacReady = null;
+/* Shared with DWFLAC, including readiness and failed-attempt retry. */
 function bootFlac(url) {
-  if (window.Flac) return Promise.resolve(window.Flac);
-  if (flacReady) return flacReady;
-  flacReady = new Promise((ok, no) => {
-    const s = document.createElement('script');
-    /* Follow DW.assets so there is one place that decides where third-party
-       code comes from, rather than this module quietly disagreeing with the
-       engine about it. */
+  if (window._dwFlacReady) return window._dwFlacReady;
+  let s = null;
+  const pending = new Promise((ok, no) => {
+    const wait = () => {
+      const Flac = window.Flac;
+      if (!Flac) return no(new Error('libflac loaded but Flac is undefined'));
+      if (Flac.isReady && Flac.isReady()) return ok(Flac);
+      const previous = Flac.onready;
+      const done = error => {
+        clearTimeout(timer);
+        if (Flac.onready === onready) Flac.onready = previous;
+        if (error) no(error); else ok(Flac);
+      };
+      const onready = () => { done(); if (typeof previous === 'function') previous.call(Flac); };
+      const timer = setTimeout(() => done(new Error('libflac readiness timed out')), 4000);
+      Flac.onready = onready;
+    };
+    if (window.Flac) return wait();
+    s = document.createElement('script');
     const A = window.DW && window.DW.assets;
     s.src = url || (A ? A.base + A.files.flac : 'vendor/libflac.min.js');
-    s.onload = () => {
-      if (!window.Flac) return no(new Error('libflac loaded but Flac is undefined'));
-      if (window.Flac.isReady && window.Flac.isReady()) return ok(window.Flac);
-      window.Flac.onready = () => ok(window.Flac);
-      setTimeout(() => ok(window.Flac), 4000);   /* older builds never fire onready */
-    };
+    s.onload = () => { try { wait(); } catch (e) { no(e); } };
     s.onerror = () => no(new Error('could not load ' + s.src + ' — is vendor/ present?'));
     document.head.appendChild(s);
   });
-  return flacReady;
+  window._dwFlacReady = pending;
+  pending.catch(() => {
+    if (window._dwFlacReady === pending) window._dwFlacReady = null;
+    if (s) { try { s.remove(); } catch (e) {} }
+  });
+  return pending;
 }
```

**[INFERRED] Check — `tools/check-flac-lifecycle.js`:** use fresh VM contexts, a script-insertion list, removal spies, and manually fired timers.

| Drive | Required assertion; why current source fails |
|---|---|
| Each loader alone: first `onerror`, then successful retry | First rejects; failed element removed; second insertion occurs and resolves. Current cache prevents retry. |
| Each loader alone: `onload` without `Flac`, then retry | Same recovery assertions. Tests more than the network-error branch. |
| Existing unready `Flac`; call both boots | Neither fulfills after microtasks; firing the readiness timer rejects both. Current renderer fulfills immediately and decoder fulfills on timeout. |
| Retry after readiness timeout; fire `onready` | Both fulfill with the same object; subsequent boot also succeeds without another readiness event. |
| No global; call both boots, in both orders | Exactly one script insertion; both remain pending after script load until `onready`. Current inserts two scripts. |

**[INFERRED] Wrong fix caught:** clearing caches alone still fails readiness; merely replacing timeout fulfillment still fails the renderer’s existing-global branch; deleting readiness handlers entirely fails recovery controls. **CAN’T-TELL:** actual vendor readiness behavior is not supplied; fake callbacks cannot establish it.

**[INFERRED] Risk:** **HEARD PATH: indirect**, through fallback availability/waiting. No numerical timeout change or detector change. Additional scope is explicit: simultaneous custom URLs now share the first caller’s attempt.

---

**[INFERRED] F127 — REAL. F119 — REAL for discarding the processing result; these are separate failure mechanisms sharing one patch.**

**[MEASURED]** Processing results are discarded, later chunks execute directly from timers, and deletion is on successful completion only. Nonzero initialization status also rejects without deletion (`assets/deckwave-render.js:212–244`).

**CAN’T-TELL:** the unpasted vendor wrapper’s exact return contract and natural refusal reachability. The proposed F119 branch recognizes explicit `false` and `0`; it does not assume `undefined` means failure.

**[INFERRED] Falsifiers:** F127 is falsified if a second-chunk exception rejects and deletes exactly once without escaping the timer. F119’s failure scenario is falsified if the installed wrapper cannot report a refused block through its return value.

**[INFERRED] Proposed shared patch:**

```diff
--- a/assets/deckwave-render.js
+++ b/assets/deckwave-render.js
@@ -212,12 +212,21 @@
     const enc = Flac.create_libflac_encoder(sr, CH, BPS, 5, 0, false);
     if (!enc) return no(new Error('encoder init failed'));
 
+    let deleted = false;
+    const dispose = () => {
+      if (deleted) return; deleted = true;
+      Flac.FLAC__stream_encoder_delete(enc);
+    };
+    const fail = e => { try { dispose(); } catch (x) {} no(e); };
     const chunks = []; let bytes = 0;
     const write = data => { chunks.push(data.slice ? data.slice() : new Uint8Array(data)); bytes += data.length; };
-    const st = Flac.init_encoder_stream(enc, write);
-    if (st !== 0) return no(new Error('init_encoder_stream ' + st));
-
-    const L = buf.getChannelData(0), R = CH > 1 ? buf.getChannelData(1) : L;
+    let L, R;
+    try {
+      const st = Flac.init_encoder_stream(enc, write);
+      if (st !== 0) throw new Error('init_encoder_stream ' + st);
+      L = buf.getChannelData(0); R = CH > 1 ? buf.getChannelData(1) : L;
+    } catch (e) { fail(e); return; }
     const N = buf.length, BLK = 32768;
     let i = 0;
+    function run() { try { step(); } catch (e) { fail(e); } }
     function step() {
@@ -232,8 +241,9 @@
-      Flac.FLAC__stream_encoder_process_interleaved(enc, inter, n);
+      const accepted = Flac.FLAC__stream_encoder_process_interleaved(enc, inter, n);
+      if (accepted === false || accepted === 0) throw new Error('flac encode failed at ' + i);
       i = end;
       if (onprog) onprog(i / N);
-      if (i < N) setTimeout(step, 0);
+      if (i < N) setTimeout(run, 0);
       else {
         Flac.FLAC__stream_encoder_finish(enc);
-        Flac.FLAC__stream_encoder_delete(enc);
+        dispose();
         const out = new Uint8Array(bytes);
@@ -241,5 +251,5 @@
         ok(new Blob([out], { type: 'audio/flac' }));
       }
     }
-    step();
+    run();
   });
```

**[INFERRED] Check — `tools/check-flac-lifecycle.js`:**

- Encode 65,537 samples with fake timers and encoder spies. Return `false`, then separately `0`, on block two. Assert rejection, exactly two process calls, one deletion, and no fulfilled Blob. Current source continues and fulfills.
- Separately throw from block-two processing and block-two `onprog`. Catch any escaped timer exception in the harness, drain microtasks, and assert **no escape**, rejected promise, one deletion. Explicitly assert settlement; merely awaiting the promise can leave a bare Node check exiting without testing anything.
- Also inject initialization refusal/throw, first-block throw, and finish throw. Assert rejection and one deletion.
- Successful control: accept every block; assert all samples were submitted, finish/delete each occur once, and the Blob contains the emitted bytes.

**[INFERRED] Wrong fix caught:** rejecting every encode fails the success control; catching only timer errors misses initialization; checking returns without cleanup misses the deletion assertion. A wrapper returning another failure representation could still defeat this patch and pass these fakes.

**[INFERRED] Risk:** **HEARD PATH: exported failure cases**—refused blocks no longer produce a supposedly successful file. Successful PCM quantization, rate, and render scheduling stay unchanged; no detector or threshold change. Initialization cleanup is included in the same encoder lifetime.

---

**[INFERRED] F120 — REAL.**

**[MEASURED]** Assignment follows the request await; `dropWake()` only sees assigned sentinels (`assets/deckwave-phone.js:267–274`). Hold release checks demand only at release time (`assets/deckwave-phone.js:281–283`).

**[INFERRED] Falsifier:** defer acquisition, release every hold, then resolve it. A released sentinel and `wakeLockHeld: false` on current source would falsify the race.

**[INFERRED] Proposed patch:** serialize acquisition, recheck demand, and prevent an old sentinel’s release event from clearing a newer lock.

```diff
--- a/assets/deckwave-phone.js
+++ b/assets/deckwave-phone.js
@@ -266,8 +266,13 @@
 /* ── wake ────────────────────────────────────────────────────────────── */
+let wakePending = false;
 async function holdWake() {
-  if (!cap.wakeLock || wakeLock) return;
+  if (!cap.wakeLock || wakeLock || wakePending) return;
+  wakePending = true;
   try {
-    wakeLock = await navigator.wakeLock.request('screen');
-    wakeLock.addEventListener('release', () => { wakeLock = null; });
+    const lock = await navigator.wakeLock.request('screen');
+    wakeLock = lock;
+    lock.addEventListener('release', () => { if (wakeLock === lock) wakeLock = null; });
+    if (!holds.size && !(mode === 'wake' && playing())) dropWake();
   } catch (e) { wakeLock = null; }     /* refused (low battery mode, not visible) — nothing to do */
+  finally { wakePending = false; }
 }
```

**[MEASURED]** The existing fake resolves requests immediately (`tools/check-phone.js:44–45`). **[INFERRED]** Its completed-acquisition checks are decoration for this pending-request race, though useful for ordinary hold behavior.

**[INFERRED] Check code — insert in `tools/check-phone.js` after the existing scan-hold release check:**

```js
{
  const request0 = navigatorFake.wakeLock.request;
  const pending = [], locks = [];
  navigatorFake.wakeLock.request = () => {
    wakeRequests++;
    return new Promise(resolve => pending.push(resolve));
  };
  const settleRequests = () => {
    const q = pending.splice(0);
    for (const resolve of q) {
      const listeners = [];
      const lock = {
        released: 0,
        addEventListener(k, fn) { if (k === 'release') listeners.push(fn); },
        release() { this.released++; releases++; },
        fireRelease() { listeners.forEach(fn => fn()); }
      };
      locks.push(lock); resolve(lock);
    }
    return q.length;
  };

  PH.hold('race-a'); PH.hold('race-b');
  PH.release('race-a'); PH.release('race-b');
  const count = settleRequests();
  await tick();
  ok('pending acquisition is shared and released when demand disappears',
     count === 1 && locks.every(l => l.released === 1) &&
       !PH.status.wakeLockHeld && PH.status.holds.length === 0,
     JSON.stringify({ count, releases: locks.map(l => l.released), status: PH.status }));

  PH.release('cleanup');                 // lets the old source continue failing cleanly
  PH.hold('keep');
  settleRequests(); await tick();
  const first = locks[locks.length - 1];
  ok('CONTROL: demand surviving acquisition keeps its sentinel',
     PH.status.wakeLockHeld && first.released === 0,
     JSON.stringify(PH.status));

  PH.release('keep');
  PH.hold('new');
  settleRequests(); await tick();
  const second = locks[locks.length - 1];
  first.fireRelease();
  ok('an old release event cannot clear the new sentinel',
     PH.status.wakeLockHeld && second.released === 0,
     JSON.stringify(PH.status));
  PH.release('new');
  ok('the new sentinel remains releasable', second.released === 1,
     'release calls ' + second.released);
  navigatorFake.wakeLock.request = request0;
}
```

**[INFERRED]** Current source starts two requests and retains an unwanted sentinel; the first assertion fails. An unconditional release-on-acquisition “fix” fails the retained-demand control. A fix covering holds but omitting wake-mode demand could still pass this block; add the same deferred fixture with `PH.set('wake')` followed by `PH.set('background')` before resolution.

**[INFERRED] Risk:** no direct heard-path change; wake ownership only. No threshold/detector change. Serialization and sentinel identity handling are necessary adjacent race bookkeeping.

---

**[INFERRED] F121 — REAL.**

**[MEASURED]** Replacement revokes the old URL, but switching off discards it without revocation (`assets/deckwave-phone.js:482–483,579`). The F123 generation guard is present (`assets/deckwave-phone.js:473–481`); that addresses stale callbacks, not this completed URL.

**[INFERRED] Falsifier:** every completed artwork URL discarded by `setArt('off')` receives exactly one revoke call on current source.

**[INFERRED] Proposed patch:**

```diff
--- a/assets/deckwave-phone.js
+++ b/assets/deckwave-phone.js
@@ -578,3 +578,6 @@
     artMeta = null; artGen++;             /* redraw for the current track; an encode in flight is now stale */
-    if (a === 'off') { artUrl = null; push(window.DW && window.DW.nowMeta || null); }
+    if (a === 'off') {
+      if (artUrl) { try { URL.revokeObjectURL(artUrl); } catch (e) {} }
+      artUrl = null; push(window.DW && window.DW.nowMeta || null);
+    }
     else updateArt(true);
```

**[MEASURED]** The harness’s revoke function is a no-op (`tools/check-phone.js:72`). **[INFERRED]** “Metadata has no artwork” is decoration for URL lifetime: losing the reference produces exactly that result.

**[INFERRED] Check code — insert after the existing lock-screen-art block, before the hyphenated-title block:**

```js
{
  const revoke0 = URL.revokeObjectURL, revoked = [];
  URL.revokeObjectURL = u => revoked.push(u);
  for (let i = 0; i < 2; i++) {
    PH.setArt('poster', 'journey'); await tick();
    const md = navigatorFake.mediaSession.metadata;
    const url = md && md.artwork && md.artwork[0].src;
    const before = revoked.length;
    PH.setArt('off'); await tick();
    ok('off revokes exactly the completed poster URL, cycle ' + i,
       !!url && revoked.length === before + 1 && revoked[before] === url &&
         !navigatorFake.mediaSession.metadata.artwork,
       JSON.stringify({ url, revoked: revoked.slice(before) }));
    PH.setArt('off'); await tick();
    ok('repeated off does not revoke again, cycle ' + i,
       revoked.length === before + 1, JSON.stringify(revoked));
  }
  URL.revokeObjectURL = revoke0;
}
```

**[INFERRED]** Current source records no revocation. Revoking a fabricated URL or suppressing artwork creation fails the exact-URL/existence assertion. Revoking the correct URL prematurely could still pass this block; the existing publication control must remain.

**[INFERRED] Risk:** no heard-path or detector change; completed artwork lifetime only.

---

**[INFERRED] F140 — REAL for the supplied panel. CAN’T-TELL for the dashboard demo watcher.**

**[MEASURED]** Broadcast reaches all subscribers; neither panel watcher filters URLs (`assets/deckwave-libre.js:269–271,951–953,1022–1023`). **CAN’T-TELL:** dashboard source was not pasted.

**[INFERRED] Falsifier:** with two unfinished row operations, an event for one URL leaves the other button unchanged on current source—or an actual mutual-exclusion mechanism prevents those operations.

**[INFERRED] Proposed patch:**

```diff
--- a/assets/deckwave-libre.js
+++ b/assets/deckwave-libre.js
@@ -951,3 +951,4 @@
             const cur = { i: 1, n: rel.tracks.length };
-            const un = watchFetch(ev => { if (!ev.done)
+            const urls = new Set(rel.tracks.map(t => t.url));
+            const un = watchFetch(ev => { if (!ev.done && urls.has(ev.url))
               b.textContent = cur.i + '/' + cur.n + ' · ' + (ev.total ? Math.min(99, Math.round(ev.loaded / ev.total * 100)) + '%' : mb(ev.loaded)); });
@@ -1022,2 +1023,2 @@
-        const un = watchFetch(ev => { if (!ev.done)
+        const un = watchFetch(ev => { if (!ev.done && ev.url === it.file.url)
           b.textContent = ev.total ? Math.min(99, Math.round(ev.loaded / ev.total * 100)) + '%' : mb(ev.loaded); });
```

**[INFERRED] Check — new `tools/check-libre-progress.js`, built-in `vm`/`assert` plus fake DOM/network:**

- Drive actual `open()`, search, and row click handlers. Keep their `DW.ingest` promises pending.
- Drive progress through actual `_fetchBytes()` with deferred stream readers: URL A emits 10/100 bytes; URL B emits 90/100.
- Assert A’s button changes to its 10% caption, B stays unchanged; then B becomes 90% while A remains 10%.
- Cover two Archive rows, two Commons rows, and overlapping Archive/Commons operations. Use identical filenames on distinct URLs, including URLs sharing a host.
- Assert owned progress still updates, and completed operations no longer react.

**[INFERRED]** Current broadcasts change both buttons. Disabling all progress, filtering only by filename, or filtering only by host fails these controls. **Wrong fix still passing:** interference between concurrent requests for the *same* URL; this patch isolates URLs, not request identities.

**[INFERRED] Risk:** display only; no heard-path, threshold, detector, or fetch-policy change.

---

**[INFERRED] F147 — REAL.**

**[MEASURED]** The footer attributes any counted failure to the decoder/iPhone (`assets/deckwave-libre.js:1025–1032`). The fetch path throws HTTP failures, and `RemoteFile.arrayBuffer()` uses that path (`assets/deckwave-libre.js:340–341,423`).

**[INFERRED]** Following the supplied `decodeAudio` → `analyse` → `ingest` catches, a fetch failure can return as `failures[0].message`, including the misleadingly broad `decode:` prefix. That prefix does not establish codec refusal.

**[INFERRED] Falsifier:** drive a real RemoteFile 404 through the supplied ingest and Commons handler. If no decoder/iPhone attribution appears, the stated failure is falsified.

**[INFERRED] Proposed patch:** print the returned reason without inventing a classifier.

```diff
--- a/assets/deckwave-libre.js
+++ b/assets/deckwave-libre.js
@@ -1027,5 +1027,6 @@
           b.textContent = on ? '✓ added' : '↻ retry';
           if (on) b.classList.add('hot');
-          const msg = (on ? '1 added' : 'FAILED (retry is on the button' + (res.failed ? ' — the decoder refused it; Ogg/Opus does not decode on an iPhone' : '') + ')')
+          const why = res.failures && res.failures[0] && res.failures[0].message;
+          const msg = (on ? '1 added' : 'FAILED (retry is on the button' + (why ? ' — ' + why : '') + ')')
             + ' · ' + (it.creator || it.title) + ' · ' + (it.licenceName || it.licence || 'licence unknown')
             + ' · from commons.wikimedia.org · ' + window.DW.corpus.length + ' in corpus';
```

**[INFERRED] Check — new `tools/check-libre-errors.js`:**

- Evaluate the actual engine and libre module with fake DOM, unavailable IndexedDB, minimal Essentia boot stubs, and a fake AudioContext.
- Return valid Commons search metadata, then HTTP 404 for its download. Click the actual row button and await its handler.
- Assert footer **and log** contain the returned `decode: HTTP 404 …` reason, contain neither `the decoder refused it` nor `iPhone`, and leave a retry button.
- Parameterize panel-level failures with distinct HTTP 503, size-refusal, and rhythm-extraction messages; assert each exact reason survives. Include no-detail failure and successful-ingest controls.

**[INFERRED]** Current source fails the first attribution assertion. Merely deleting the iPhone note fails reason preservation. A patch hardcoding HTTP 404 fails the distinct-message cases. A stub-only panel test would be decoration for the claimed real-ingest contract; the real 404 path above is required.

**[INFERRED] Risk:** reporting only; no heard-path or detector change. The existing `decode:` prefix is preserved, not treated as a diagnosis.

---

**[INFERRED] F150 — REAL; F135 is the entry-offset duplicate.**

**[MEASURED]** Pulse still computes elapsed × instantaneous rate (`assets/deckwave-events.js:355–357,375–382`).

**[INFERRED]** Against the supplied engine’s entry offsets and integrated `A.pos(el)`, that formula loses both entry and rate history. Exposing the existing map is sufficient; playback schedules need no change.

**[INFERRED] Falsifier:** use nonzero entry and a rate history whose integral differs from elapsed × current rate. If current pulse agrees with entry plus the integral, this finding is falsified.

**[INFERRED] Proposed patch:**

```diff
--- a/assets/deckwave.js
+++ b/assets/deckwave.js
@@ -2200,3 +2200,4 @@
                settleLeft: A.ramp ? Math.max(0, A.ramp.S - el) : 0,
                dwell: m._dwell || null, stepping: !!m._stepping, elapsed: el,
+               pos: A.entry + A.pos(el),
                /* WHO BUILT THIS DECK — see makeDeck. 'play' is the first ▶,
--- a/assets/deckwave-events.js
+++ b/assets/deckwave-events.js
@@ -355,3 +355,3 @@
-     · track position = DW.elapsed × deck.rate (elapsed is
-       ctx.currentTime-based; the source's playbackRate scales media
-       time), looked up in the track's own beat grid;
+     · track position = deck.pos, including entry and integrated rate
+       history, looked up in the track's own beat grid; older engines
+       without pos fall back to DW.elapsed × deck.rate;
@@ -378,3 +378,4 @@
   const m = DW.nowMeta, dk = DW.deck || {}, rate = dk.rate || 1;
-  const pos = (typeof DW.elapsed === 'number' ? DW.elapsed : 0) * rate;
+  const pos = typeof dk.pos === 'number' ? dk.pos
+    : (typeof DW.elapsed === 'number' ? DW.elapsed : 0) * rate;
   const out = { playing: true, name: m.name, bpm: m.bpm, tempo: +(m.bpm * rate).toFixed(2),
```

**[INFERRED] Check — new `tools/check-pulse-position.js`, built-in `vm`/`assert`:**

1. Load the actual engine/events with fake Web Audio nodes and a mutable audio clock. Stub `DW.LIB.decode` to supply PCM. Play one track whose beats are `12 + i * 0.5`; assert the source starts at offset 12.
2. Through the supplied `_dev.A.changeRate`, schedule rate 1→2 over four seconds, beginning two seconds after `startedAt`.
3. Set the audio clock to `startedAt + 10.125`. Independently calculated source position is  
   `12 + 2 + 4 * (1 + 2) / 2 + 4.125 * 2 = 28.25`.
4. Assert `DW.deck.pos === 28.25`, `pulse().pos === 28.25`, beat index 32, phase 0.5, bar index 8, and `untilSec === 0.125`.
5. Unit controls: supplied `deck.pos: 0` must beat a nonzero elapsed fallback; absent `deck.pos` must retain legacy behavior.

**[INFERRED]** Current pulse returns 20.25 and the getter is absent. Entry-only correction and elapsed × final-rate correction both fail. A stubbed `deck.pos` test alone is decoration for the engine half; the actual getter/integration assertion is necessary. These tests do not prove synchronization through worklet/output latency.

**CAN’T-TELL:** current `check-events.js`, `GAME-INTEGRATION.md`, and BUILD-LOG text were not pasted. The reported old formula assertion must not be retained if still present.

**[MEASURED]** Phone scrubber reporting separately uses elapsed directly (`assets/deckwave-phone.js:340–341`). **[INFERRED]** Its elapsed-only harness fixture is not evidence of correct source position; this patch does not repair that separate consumer.

**[INFERRED] Risk:** telemetry only; **no heard-path**, threshold, detector, or detector-input change.

---

**[INFERRED] Ranked build order** — proposed checks above are unrun:

1. F101/F128: header allocation and decoder disposal.
2. F127/F119: encoder settlement/disposal and explicit refusal handling; verify the vendor return contract.
3. F111/F106: shared loading, retry, readiness.
4. F120: pending wake acquisition.
5. F150/F135: authoritative position reporting.
6. F147: preserve failure reasons.
7. F121: revoke completed artwork.
8. F140: isolate panel progress; dashboard portion remains **CAN’T-TELL**.