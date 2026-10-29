**F15 — REAL [INFERRED]**

**MEASURED:** The two independent replacements remain at `assets/deckwave.js:1501` and `:1549`. `chain()` calls loudness first (`:1601`) and outgoing phrase analysis later (`:1644`). Both update the in-memory metadata before persistence (`:1490`, `:1546`).

**INFERRED:** Independent snapshots can overwrite each other. This establishes lost cache fields, not a measured performance cost. **Falsifier:** With both fields initially absent, force both reads to capture independent snapshots before either replacement commits; preservation of both fields without another writer would refute this explanation. One uncontrolled successful playback would not.

**INFERRED — proposed patch:** Queue these writebacks by ID, with the read inside the queue.

```diff
--- a/assets/deckwave.js
+++ b/assets/deckwave.js
@@ -1488,16 +1488,25 @@
     const ph = P.detect(chans, track.buf.sampleRate, m.beats || []);
     ph.ms = Date.now() - t0;
     m.phrase = ph;
-    persistPhrase(m, ph);
+    persistFeatures(m, { phrase: ph });
     return ph.ok ? ph : null;
   }
   /* Additive write-back: the record keeps its analysis version; `phrase`
      rides along and is replaced with the record on the next re-scan. DB is
      the DW module's store; a Player evaluated on its own (the harnesses)
      has none, and that is fine. */
-  function persistPhrase(m, ph) {
+  /* Re-get inside the per-record queue, after the preceding put commits. */
+  const featureWrites = new Map();
+  function persistFeatures(m, fields) {
     try {
       if (typeof DB === 'undefined' || !m.id) return;
-      DB.get(m.id).then(r => { if (r && r.v === m.v) { r.phrase = ph; return DB.put(r); } }).catch(() => {});
+      const pending = (featureWrites.get(m.id) || Promise.resolve())
+        .then(() => DB.get(m.id)).then(r => {
+          if (r && r.v === m.v) { Object.assign(r, fields); return DB.put(r); }
+        }).catch(() => {});
+      featureWrites.set(m.id, pending);
+      pending.then(() => {
+        if (featureWrites.get(m.id) === pending) featureWrites.delete(m.id);
+      });
     } catch (e) {}
   }
@@ -1544,9 +1553,6 @@
     let max = 0; for (const v of e) if (v > max) max = v;
     const db = e.map(v => (v > 0 && max > 0) ? +(10 * Math.log10(v / max)).toFixed(1) : -120);
     m.loud = { v: LOUD_V, win: LOUD_WIN, db };
-    try {
-      if (typeof DB !== 'undefined' && m.id)
-        DB.get(m.id).then(r => { if (r && r.v === m.v) { r.loud = m.loud; return DB.put(r); } }).catch(() => {});
-    } catch (e2) {}
+    persistFeatures(m, { loud: m.loud });
     return m.loud;
   }
```

**INFERRED — check, unrun:** Add inside `tools/check-player.js` after the quiet-ending checks, using `playerSrc`, `bufOf`, `settleBuf`, and `tick`.

```js
{
  const clone = x => JSON.parse(JSON.stringify(x));
  const m = Object.assign(mk('cache-race', 240), { id: 'cache-race', v: 2 });
  let stored = { id: m.id, v: 2, keep: 'analysis' };
  const writes = [];
  const DB = {
    get() { return Promise.resolve(clone(stored)); },
    put(rec) {
      const replacement = clone(rec);
      return new Promise(resolve => writes.push(() => {
        stored = replacement;
        resolve(true);
      }));
    }
  };
  const savedPhrase = window.DWPHRASE;
  window.DWPHRASE = {
    V: 1,
    channelsOf: b => [b.getChannelData(0)],
    detect: () => ({ v: 1, ok: true, beat: 0, contrast: 2 }),
    lengthAt: () => 16,
    lastStartWithin: () => null
  };
  const P = eval(playerSrc); // captures this block's DB
  try {
    pending.clear();
    const seq = [m]; seq.phrase = true;
    const playing = P.play(seq);
    await tick();
    await settleBuf(m.name, bufOf(240, 240));
    await playing; await tick();

    ok('both features were computed before cache commits',
       !!m.loud && !!m.phrase && writes.length > 0,
       'the fixture did not reach both writebacks');

    for (let i = 0; writes.length && i < 4; i++) {
      writes.shift()();
      await tick();
    }
    ok('independent cache replacements preserve both features and analysis',
       !writes.length && stored.keep === 'analysis' && stored.v === 2 &&
       JSON.stringify(stored.loud) === JSON.stringify(m.loud) &&
       JSON.stringify(stored.phrase) === JSON.stringify(m.phrase),
       JSON.stringify(stored));
  } finally {
    P.kill();
    window.DWPHRASE = savedPhrase;
  }
}
```

**INFERRED:** Current code queues two replacements from the original record; the final assertion loses `loud`. The patch’s second read observes the first committed field. A wrong implementation that never removes completed queue entries would also pass; this does not test queue retention.

**MEASURED:** The existing IDB fake stores and returns object references (`tools/check-player.js:832–834`). **INFERRED:** That fake would mask this race if reused unchanged. Metadata-only loudness checks (`:618–620`) are decoration for persistence.

**INFERRED — risk:** No intentional **HEARD-PATH** change; no threshold, detector, or input change. Serialization covers these two writers within one Player, not concurrent rescans or other tabs.

---

**F21 — REAL [INFERRED]**

**MEASURED:** Each call snapshots membership at `assets/deckwave.js:2416`, awaits analysis at `:2424`, then checks and updates its private snapshot at `:2434–2435`.

**INFERRED:** Two overlapping calls can insert the same ID. **Falsifier:** Hold both analysis results until both membership snapshots exist, then release them; exactly one insertion with aggregate `added === 1` and `duplicates === 1` would refute the finding.

**INFERRED — proposed patch:**

```diff
--- a/assets/deckwave.js
+++ b/assets/deckwave.js
@@ -2414,7 +2414,6 @@
   async ingest(files, onProgress) {
     await bootEssentia();
-    const have = new Set(corpus.map(t => t.id));
     let added = 0, cached = 0, failed = 0, dupe = 0, uncached = 0;
     const failures = [];
     if (!LIB.files) LIB.files = new Map();
     for (let i = 0; i < files.length; i++) {
@@ -2430,9 +2429,9 @@
         /* A fetched file (DWLIBRE's RemoteFile) carries its licence and
            attribution as `source`; it rides on the record from here — the
            analysis cache never sees it, the score and the card do. */
         if (files[i].source) r.source = files[i].source;
-        if (have.has(r.id)) { dupe++; continue; }
-        have.add(r.id); corpus.push(r); added++;
+        if (corpus.some(t => t.id === r.id)) { dupe++; continue; }
+        corpus.push(r); added++;
         if (r.cached) cached++;
         if (r.uncached) uncached++;
       } catch (e) { failed++; failures.push({ name: files[i].name, stage: 'analysis', message: String(e.message || e) }); console.warn(files[i].name, e.message); }
```

**INFERRED — check, unrun:** Add inside `tools/check-player.js`. Evaluate the complete engine; delay cache hits through its exposed DB object. This exercises real `ingest()` and `analyse()` without Essentia or audio decoding.

```js
{
  const W = {
    console,
    localStorage: { getItem: () => null },
    Essentia: function () {},
    EssentiaWASM: async () => ({})
  };
  W.window = W;
  require('vm').runInNewContext(src, W);
  const dw = W.DW, waiting = [];
  let hold = true;
  const record = id => ({
    id, v: 2, name: 'overlap', key: 'C', scale: 'major',
    bpm: 120, conf: 1, dur: 240, rms: .5, zcr: .1, beats: []
  });
  dw.DB.get = id => hold
    ? new Promise(resolve => waiting.push(() => resolve(record(id))))
    : Promise.resolve(record(id));

  const file = { name: 'overlap.wav', size: 10, lastModified: 1 };
  const jobs = [dw.ingest([file]), dw.ingest([file])];
  await tick();
  ok('both ingests reached analysis before either result landed',
     waiting.length === 2, 'waiting ' + waiting.length);

  hold = false;
  if (waiting[0]) waiting[0]();
  await tick();
  const first = dw.corpus[0];
  if (waiting[1]) waiting[1]();
  const reports = await Promise.race([
    Promise.all(jobs), tick().then(() => null)
  ]);
  ok('overlapping ingests insert one record and report one duplicate',
     !!reports && reports.reduce((n, r) => n + r.added, 0) === 1 &&
     reports.reduce((n, r) => n + r.duplicates, 0) === 1 &&
     reports.every(r => r.failed === 0) &&
     dw.corpus.length === 1 && dw.corpus[0] === first,
     JSON.stringify({ reports, corpus: dw.corpus.length }));

  const control = await dw.ingest([file, { ...file, lastModified: 2 }]);
  ok('existing ID stays; same basename with a different ID is admitted',
     control.added === 1 && control.duplicates === 1 &&
     control.failed === 0 && dw.corpus.length === 2 &&
     dw.corpus[0] === first,
     JSON.stringify(control));
}
```

**INFERRED:** Current code reports two additions and retains two records. The patch reports one addition and one duplicate. Post-insertion deduplication without correcting reports fails; replacing the original record fails the identity assertion; basename deduplication fails the control. A wrong implementation limited to handling exactly two overlapping callers could still pass.

**INFERRED — risk:** No direct scheduling or detector change. **HEARD PATH, indirectly:** removing duplicate corpus entries can change future sequence choices because pool length determines the arc (`assets/deckwave.js:661`, `:688`). This does not prevent duplicate analysis work.

---

**F24 — REAL for the supplied comments [INFERRED]**

**MEASURED:** Two-sided fallback language remains at `assets/deckwave.js:919–920` and `:2149–2150`. Outgoing phrase selection is independent (`:1644–1655`) of incoming phrase selection (`:1753–1756`); the log explicitly describes separate sides (`:1789–1794`).

**INFERRED:** An incoming phrase miss does not undo an outgoing phrase exit/fade. **Falsifier:** With an available future outgoing phrase start and absent incoming phrase, `skip()` consistently selecting the ordinary exit, set crossfade, and `atPhrase === false` would refute that reading.

**CAN'T-TELL:** Current ledger 150c was not pasted; its wording cannot be confirmed or patched exactly.

**INFERRED — proposed documentation-only patch:**

```diff
--- a/assets/deckwave.js
+++ b/assets/deckwave.js
@@ -902,7 +902,7 @@
      The phrase offset is DWPHRASE's, computed from the decoded buffer the
      deck already holds and written back to the analysis record so it is
-     done once per track. A track with no usable offset — unlocked, too
-     short, module missing — falls back to the downbeat behaviour for that
-     transition, and the log says which happened (¶ marks a phrase exit or
-     entry). Nothing here moves a threshold: the phrase length is the
-     grid's own, and the lead is the same 1.2 s the downbeat path uses. */
+     done once per track. Fallbacks are independent: without an outgoing
+     phrase, use its ordinary exit and the set's xfade; without an incoming
+     phrase, use its ordinary entry. The log says which happened (¶ marks a
+     phrase exit or entry). Nothing here moves a threshold: the phrase length
+     is the grid's own, and the lead is the same 1.2 s the downbeat path uses. */
@@ -916,8 +916,8 @@
      leave at the next 8-bar phrase start at least `lead` out (up to eight
      bars, ~15 s at 128 bpm), enter the incoming at ITS first phrase start,
-     fade one phrase. Everything the phrase block above says about falling
-     back holds — no usable phrase on either side is the downbeat path and
-     the set's xfade, exactly as before.
+     fade one phrase. Fallbacks are independent: without an outgoing
+     phrase, use the downbeat exit and the set's xfade; without an incoming
+     phrase, use its ordinary entry.
      NOT changed: a build's own planned transitions (phrase only on a phrase
      build), and blend-now on a clicked track and ⚡ blend fast, which keep
      the downbeat on the other builds — the decision named next, not those.
@@ -2147,5 +2147,6 @@
        SINCE 2026-10-09 (UI walk decision 4) the point is the next PHRASE
        start on every build and the fade is one phrase — phrase-next, the
-       block at the top of the Player — with the downbeat and the xfade as
-       the fallback when either track has no usable phrase. */
+       block at the top of the Player — with independent fallbacks: without an
+       outgoing phrase, use the downbeat exit and the set's xfade; without an
+       incoming phrase, use its ordinary entry. */
     async skip(opts) {
```

**INFERRED — check, unrun:** Add to `tools/check-player.js`, scoped to the three comments.

```js
for (const [start, end, exit] of [
  ['/* ── phrase mode', 'let phrase = false;', 'its ordinary exit'],
  ['/* ── phrase-next:', 'let nextPhrase = true;', 'the downbeat exit'],
  ['/* ── next ─', 'async skip(opts)', 'the downbeat exit']
]) {
  const a = src.indexOf(start), b = src.indexOf(end, a);
  const text = a >= 0 && b > a
    ? src.slice(a, b).replace(/\s+/g, ' ') : '';
  const rule = "without an outgoing phrase, use " + exit +
    " and the set's xfade; without an incoming phrase, use its ordinary entry.";
  ok('[text] independent fallback contract: ' + start,
     /independent/.test(text) && text.includes(rule) &&
     !/no usable phrase on either side|fallback when either track/.test(text),
     text);
}
```

**INFERRED:** Current comments fail; the replacements pass. A mixed-availability behavioral check already passing current code is **decoration for this documentation defect**. Conversely, this text check would pass a later behavioral regression retaining these comments; it is not a scheduling oracle.

**INFERRED — risk:** No **HEARD-PATH**, threshold, or detector change. Enforcing two-sided fallback would change exit/entry timing and belongs to the keeper’s ear.

---

**F28, including F33’s notice portion — REAL for notice description [INFERRED]**

**MEASURED:** The header calls `processCore` vendored (`assets/deckwave-stretch.js:37–38`), then limits the MPL Modification to “the two lines” (`:51–54`). The wrapper contains the complete method (`:88–124`), including its hold and additional gap accounting (`:115–121`).

**CAN'T-TELL:** The current vendor method, generated module, and MPL licence text were not pasted. Exact derivation differences and the proposed §3.3 interpretation cannot be independently verified.

**INFERRED:** The admitted copying contradicts the narrow notice. **Falsifier:** Independent authorship with no MPL-covered implementation, or a current notice acknowledging the copied implementation/file’s coverage, would refute this particular coverage claim.

**INFERRED — proposed keeper notice:** Acknowledge file coverage without asserting the unprovided secondary-licensing interpretation.

```diff
--- a/assets/deckwave-stretch.js
+++ b/assets/deckwave-stretch.js
@@ -37,7 +37,8 @@
-   processCore below is the vendored one with two lines added; the pitch
-   formula, the interleave, the extract call are byte-for-byte its own.
+   processCore below is copied from the vendored SoundTouch 2.1.1
+   processor. It includes Deckwave's priming hold and post-priming gap
+   counter; extraction follows the hold.
    HOLD is a count of render blocks, not a calibration: it was measured at
    1 and 2 (both zero gaps) and 0 (the vendored behaviour). Since
    2026-09-01 the wrapper also answers a {type:'release'} message by
    returning false from process() — the vendored one never does, and a
    node that never returns false is never collected (ledger 124).
@@ -48,9 +49,9 @@
    the Mozilla Public License 2.0 — the full text is
    `vendor/LICENSE.soundtouch-processor.txt`, provenance and hash in
-   `vendor/README.md` and `NOTICE`. That seam is the only place the two
-   texts meet. Everything from this comment down is Deckwave's wrapper,
-   under the project LICENSE (AGPL-3.0); the two lines it adds inside the
-   vendored processCore are described above and are the whole of the
-   Modification in MPL terms. This paragraph is here, in the wrapper,
+   `vendor/README.md` and `NOTICE`. This wrapper also contains the copied
+   processCore described above; MPL coverage is not limited to the added
+   hold or counter lines. This wrapper source file is available under
+   MPL-2.0. Deckwave's original wrapper contributions are additionally
+   under the project LICENSE (AGPL-3.0). This notice lives in the wrapper
    because check-player pins the module as vendored text + newline + this
    file, so a notice hand-added to the module would be a drift.
@@ -113,7 +114,7 @@
       const available = this._pipe.outputBuffer.frameCount;
       this._blockCount++;
-      /* ── the held block: the two added lines ──────────────────────── */
+      /* ── the held block ──────────────────────────────────────────── */
       if (!this._primed) {
         if (available >= frameCount) { this._after++; if (this._after > HOLD) this._primed = true; }
         if (!this._primed) { leftOutput.fill(0); rightOutput.fill(0); return null; }
       }
```

**MEASURED:** `tools/check-player.js:408–409` requires normalized module text to equal vendor text + newline + wrapper. **INFERRED:** Regenerate that concatenation in the same change. Identity alone is **decoration for notice correctness**, although it remains a useful packaging check. **CAN'T-TELL:** An exact generated-module diff cannot be supplied without its text.

**INFERRED — check, unrun:** Insert in that existing identity block after `wrap` is read.

```js
const header = wrap.slice(0, wrap.indexOf('(function ()'))
  .replace(/\s+/g, ' ');
ok('[text] the notice acknowledges copied code and wrapper-file MPL coverage',
   header.includes('copied from the vendored SoundTouch 2.1.1 processor') &&
   header.includes('MPL coverage is not limited to the added hold or counter lines.') &&
   header.includes('This wrapper source file is available under MPL-2.0.') &&
   header.includes("Deckwave's original wrapper contributions are additionally under the project LICENSE (AGPL-3.0).") &&
   !/two lines|byte-for-byte/.test(wrap),
   header);
```

**INFERRED:** Current wording fails; corrected wording plus regenerated module passes these textual checks. Incorrect provenance or an unsupported licence grant could still pass: this checks the notice’s stated scope, not legal entitlement.

**INFERRED — risk:** No **HEARD-PATH**, threshold, detector, or executable-code change. The substantive licensing declaration is the keeper’s notice decision; its legal basis remains unverified from these inputs.

---

**F98 — CAN'T-TELL**

**MEASURED:** The cue still names `mix.flac` (`assets/deckwave-score.js:207`) and formats `s.atSec` as its indices (`:222`). The score uses default crossfade 16 (`:52`), rate-dependent timing (`:69–73`), and accumulates planned exits (`:142`).

**CAN'T-TELL:** Current `DWRENDER.plan`, rendered filename construction, and dashboard export behavior are absent. The older renderer description does not establish their current behavior.

**INFERRED:** No renderer-mismatch patch or qualifying failing regression check follows from these inputs. The specific mismatch would be falsified by a current paired export using the same timeline and filename, or agreement on the alleged counterexample under its stated options.

**INFERRED:** Any eventual disclosure should identify a **score-planned timeline**. Actual live equivalence is not established: the pasted Player changes rates during transitions (`assets/deckwave.js:1764–1779`), while the score uses a constant conversion (`assets/deckwave-score.js:72–73`).

**INFERRED — risk:** Timeline reconciliation would be **HEARD PATH** if applied to playback. No fade constant, rate rule, or detector change is proposed.

---

**F107 — REAL [INFERRED]**

**MEASURED:** Both the head stamping walk (`assets/deckwave-nav-commit.js:80–87`) and tail-seed walk (`:213–215`) drift unconditionally. The live Player explicitly preserves target through grid-straight tracks and rebases through reach-straight tracks (`assets/deckwave.js:1610–1612`, `:1830`). `resequenceTail()` already distinguishes those cases (`assets/deckwave-nav-commit.js:142–149`).

**INFERRED:** The discrepancy is now established against the supplied Player, not merely other planners. **Falsifier:** A grid-straight stone leaving the seed unchanged, with `_stretch === 1`, and a reach-straight stone rebasing it to its BPM would refute the unconditional-walk finding.

**MEASURED:** Scheduling a successor advances `tempo` (`assets/deckwave.js:1829–1830`); `planningTempo` exposes the preceding target while that successor is still pending (`:2221`). **INFERRED:** Use that starting value in both walks as well, so replacing a pending successor does not retain its advance.

**INFERRED — proposed patch:**

```diff
--- a/assets/deckwave-nav-commit.js
+++ b/assets/deckwave-nav-commit.js
@@ -72,17 +72,17 @@
   /* every _stretch after the splice is now wrong; recompute exactly as the
      sequencer would */
   const DRIFT = this.DRIFT;
-  /* the UNROUNDED rolling target: this loop RE-PLANS from it (every
-     `_stretch` below is target / bpm), and `st.tempo` is Math.round for
-     display, so re-planning from it put the printed plan up to 0.4% away
-     from what the deck would actually do. `tempoExact` is the engine's own
-     number; the fallback keeps an older Player working. */
-  let T = st.tempoExact || st.tempo || out[at].bpm;
+  /* The target before the pending successor, which this route replaces.
+     planningTempo supplies it; tempoExact is the unrounded fallback for
+     an older Player, and tempo is its rounded display value. */
+  let T = window.DW.planningTempo || st.tempoExact || st.tempo || out[at].bpm;
   for (let i = at + 1; i < out.length; i++) {
-    out[i]._stretch = T / out[i].bpm;
+    const t = out[i];
+    t._stretch = t._unlocked ? 1 : T / t.bpm;
     /* Clear any dwell left by a previous route. A track that was a stepping
        stone once must not stay shortened forever when it comes up normally —
        same reasoning as recomputing every _stretch above. */
-    delete out[i]._dwell;
-    T = T + (out[i].bpm - T) * DRIFT;
+    delete t._dwell;
+    if (!t._unlocked) T = T + (t.bpm - T) * DRIFT;
+    else if (t._unlockReason === 'reach') T = t.bpm;
   }
@@ -211,7 +211,8 @@
-  /* unrounded, for the same reason as commit()'s loop above — this walks the
-     drift forward to seed resequenceTail(), which plans stretches from it */
-  let T = window.DW.state.tempoExact || window.DW.state.tempo || set[window.DW.state.idx].bpm;
+  /* Use the same starting target and three-way walk as commit() above. */
+  let T = window.DW.planningTempo || window.DW.state.tempoExact || window.DW.state.tempo || set[window.DW.state.idx].bpm;
   for (let i = window.DW.state.idx + 1; i <= c.resequenceFrom && i < c.set.length; i++) {
-    T = T + (c.set[i].bpm - T) * this.DRIFT;
+    const t = c.set[i];
+    if (!t._unlocked) T = T + (t.bpm - T) * this.DRIFT;
+    else if (t._unlockReason === 'reach') T = t.bpm;
   }
   const r = this.resequenceTail(c.set, c.resequenceFrom, T);
```

**INFERRED — check, unrun:** Add to `tools/check-player.js`; load the actual navigation module with a controlled window, capture the seed, and run real tail repair.

```js
{
  const navSrc = fs.readFileSync('assets/deckwave-nav-commit.js', 'utf8');
  const near = (a, b) => Math.abs(a - b) < 1e-9;
  for (const mode of ['grid', 'reach', 'locked']) {
    for (const reportedTempo of [120, 137]) {
      const current = { id: 'current', bpm: 120 };
      const stone = { id: 'stone', bpm: 128, _locked: mode !== 'grid' };
      if (mode !== 'locked') {
        stone._unlocked = true;
        stone._unlockReason = mode;
      }
      const dest = { id: 'dest', bpm: 124, _locked: true };
      const tail = { id: 'tail', bpm: 121, _locked: true };
      const W = {
        DW: {
          state: { idx: 0, tempo: reportedTempo, tempoExact: reportedTempo },
          planningTempo: 120
        },
        DWNAV: {
          DRIFT: .35, GATE: .08,
          clearQueue() { this.queue = null; }
        }
      };
      new Function('window', navSrc)(W);
      const N = W.DWNAV, repair = N.resequenceTail;
      let seed;
      N.resequenceTail = function (set, from, tempo) {
        seed = tempo;
        return repair.call(this, set, from, tempo);
      };
      N.queue = { idx: 2, mode: 'route', hops: [stone] };
      const result = N.commitAndRepair([current, tail, dest]);
      const afterStone = mode === 'grid' ? 120 : mode === 'reach' ? 128 : 122.8;
      const expected = afterStone + (124 - afterStone) * .35;

      ok('route tempo walk: ' + mode + ', reported target ' + reportedTempo,
         result.ok && near(seed, expected) &&
         near(stone._stretch, mode === 'locked' ? 120 / 128 : 1) &&
         near(dest._stretch, afterStone / 124) &&
         near(tail._stretch, expected / 121) &&
         !!stone._unlocked === (mode !== 'locked') &&
         result.set.length === 4 &&
         result.set[0] === current && result.set[1] === stone &&
         result.set[2] === dest && result.set[3] === tail,
         JSON.stringify({ seed, expected, stretches: result.set.map(t => t._stretch) }));
    }
  }
}
```

**INFERRED:** At starting target 120, expected seeds are grid **121.4**, reach **126.6**, locked **123.22**. Current unconditional walking gives **123.22** for all three. A seed-only repair fails the head stretch assertions; a head-only repair fails the seed assertion. Hard-coding drift to `.35` could also pass this fixture; nondefault drift is not covered.

**MEASURED:** The existing Player grid control captures `tBefore` *after* scheduling the grid track (`tools/check-player.js:216–218`), then compares the next rate with that value (`:222–223`). **INFERRED:** It is decoration for detecting an erroneous drift through the grid track. Capture tempo before that scheduling and assert equality immediately afterward; that strengthened Player control should already pass current source.

**INFERRED — risk:** **HEARD PATH:** the repaired seed can change tail ordering and straight/locked classification. No threshold or detector changes. Beyond the original seed-only proposal, this also repairs head stretch annotations and uses the exposed pre-successor planning target. The harness proves arithmetic consistency, not listening quality or commits during an active fade.

---

**INFERRED — other pasted checks that do not exclude their advertised failure:**

- **MEASURED:** The worklet driver counts `_underrunCount` changes (`tools/check-player.js:365–366`); “zero-fills none” asserts only that count (`:372`). **INFERRED:** Decoration as an output-sample oracle: zeroing both output channels after extraction would still pass that assertion.
- **MEASURED:** The rhythm failure check compares source-string positions (`tools/check-player.js:711–713`). **INFERRED:** Decoration for execution ordering: matching text in an unused branch or comment can pass while failed analyses still reach persistence.
- **MEASURED:** `verify()` is advertised as catching the unwired queue (`assets/deckwave-nav-commit.js:234–235`), but reads only a supplied set and tempo (`:245–260`). **INFERRED:** Decoration for player adoption: a clean displayed set can pass while the Player retains another order.

**INFERRED:** Each insufficiency claim is falsified if the named assertion rejects its described counterexample for the advertised reason; these mutations were not run.

**INFERRED — ranked build order:**

1. **F21:** Prevent duplicate corpus IDs; include overlap and distinct-ID controls.
2. **F15:** Preserve both cached features with independent-snapshot coverage.
3. **F28/F33:** Correct the notice and regenerate the module; keeper settles licensing wording.
4. **F24:** Correct supplied comments; obtain current ledger text for its matching edit.
5. **F107:** Coordinate both walks and starting target; **keeper listening required**.
6. **F98:** Obtain current renderer and export-handler text before proposing a build.