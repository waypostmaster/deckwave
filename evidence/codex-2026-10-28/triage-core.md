**F28**

1. **Verdict:** **REAL [INFERRED]**, for notice drift. **[MEASURED]** The wrapper’s `processCore` closely follows the supplied base implementation, with a held-block branch, changed placement of `toExtract`, additional `_gaps` accounting, and formatting changes. Its header still calls “the two lines” the whole MPL Modification. **[CARRIED—F28]** The MPL section descriptions come from the brief. **[INFERRED]** The precise licensing conclusion needs the licence text; the misleading description of the copied implementation is independently supported.
2. **Where now:** **[MEASURED]** `assets/deckwave-stretch.js:37`, `assets/deckwave-stretch.js:51`, `assets/deckwave-stretch.js:115`; compare its method at `assets/deckwave-stretch.js:88` with `assets/deckwave-stretch.module.js:1928`. The duplicated notice starts at `assets/deckwave-stretch.module.js:2107`.
3. **Fix size and risk:** **[INFERRED]** Small notice correction plus corresponding module regeneration; no HEARD-PATH change. Describe the copied method and its edits without another arbitrary line count, and clarify MPL coverage using the actual licence.
4. **Testable?** **Yes [INFERRED; proposed, not run].** A notice check should require acknowledgement of the copied method’s MPL coverage rather than limiting that coverage to the added lines. The present wording fails that requirement; concatenation identity alone would not catch it.
5. **Duplicate of:** **[INFERRED]** F33’s licence-notice portion.

**F33**

1. **Verdict:** **REAL [INFERRED]**, for the notice drift; the README/load-order portion remains unverified. **[MEASURED]** The wrapper contains the method corresponding to the supplied base implementation, not merely a call into it. **[CARRIED—F33]** The brief argues that an unchanged vendor file and a separate subclass make the wrapper exclusively a Larger Work. **[INFERRED]** That argument does not resolve the copied-code issue, so its proposed AGPL-only explanation should not replace the existing notice. Verification of the README claim requires current `vendor/README.md` and the Player’s worklet-loading implementation.
2. **Where now:** **[MEASURED]** `assets/deckwave-stretch.js:37`, `assets/deckwave-stretch.js:51`, `assets/deckwave-stretch.js:115`. **[CARRIED—brief]** `vendor/README.md:22` is a historical locator, not a verified current line.
3. **Fix size and risk:** **[INFERRED]** Fold the notice correction into F28; update the README only after checking the current loader. Documentation changes need no HEARD-PATH modification.
4. **Testable?** **Yes [INFERRED]** for the shared notice defect, using F28’s check. No presently failing README/load-order check can be established from the supplied material.
5. **Duplicate of:** **[INFERRED]** F28 for the notice; the README allegation is separate.

**F36**

1. **Verdict:** **REAL [INFERRED].** **[MEASURED]** Both message handlers assign the latest object to a single pending slot, and flushing applies that object once. The downstream setters update individual supplied fields. **[INFERRED]** Two disjoint partial updates before a flush lose the first update. **[CARRIED—brief]** The earlier Codex reproduction and claim that Deckwave sends neither message were not independently reproduced or checked here.
2. **Where now:** **[MEASURED]** `assets/deckwave-stretch.module.js:1816`, `assets/deckwave-stretch.module.js:1819`, `assets/deckwave-stretch.module.js:1838`, `assets/deckwave-stretch.module.js:1846`; partial-update implementations at `assets/deckwave-stretch.module.js:804` and `assets/deckwave-stretch.module.js:1291`.
3. **Fix size and risk:** **[INFERRED]** Small queue-merging change, but **HEARD-PATH**: it changes which interpolation and WSOLA settings take effect. Prefer upstream handling; a local audio change requires the owner’s ear.
4. **Testable?** **Yes [INFERRED; proposed, not run].** Deliver `{quickSeek:false}` and `{overlapMs:12}` before one flush; assert both settings survive. Repeat with disjoint interpolation parameters. These are state assertions, not audio-quality or timing tests.
5. **Duplicate of:** **[INFERRED]** None among these findings.

**F37**

1. **Verdict:** **REAL [INFERRED]**, with an incorrect proposed fix. **[MEASURED]** As a positive control for reading reset methods, `CircularSampleBufferAdapter.clear()` exists at line 513 and `RateTransposer.clear()` invokes adapter clearing at line 827. Inspecting the separate `CircularStretchInputBufferAdapter` class, from lines 1033 through 1095, shows independently allocated circular storage and no `clear()` method. `Stretch.clear()` clears its bound buffers and overlap history only. **[INFERRED]** Staged stretch frames therefore survive; simply adding `this.inputBufferAdapter.clear()` would throw for that adapter. **[CARRIED—brief]** The earlier stale-audio reproduction and absence of shipped callers remain unverified.
2. **Where now:** **[MEASURED]** `assets/deckwave-stretch.module.js:1033`, `assets/deckwave-stretch.module.js:1173`, `assets/deckwave-stretch.module.js:1594`, `assets/deckwave-stretch.module.js:1599`.
3. **Fix size and risk:** **[INFERRED]** Small adapter/reset implementation change plus module regeneration; **HEARD-PATH**, requiring the owner’s ear. A documentation note is lower risk but does not repair the reset contract.
4. **Testable?** **Yes [INFERRED; proposed, not run].** Feed a default `SoundTouch` pipe a short input and process it; first assert that the stretch adapter holds frames, then call `clear()` and assert its frame count becomes zero. This checks retained state without claiming audible validation.
5. **Duplicate of:** **[INFERRED]** None among these findings.

**F97**

1. **Verdict:** **REAL [INFERRED].** **[MEASURED]** The acceptance predicate compares only names after lowercasing and deleting characters outside `[a-z0-9]`; it then mutates the selected corpus object. **[INFERRED]** `日本語` and `音楽` both become the empty string, so either saved name selects the first such corpus entry. The brief’s broader accent claim needs narrowing: accent differences do not always collide—for example, `café` and `cafe` produce different strings.
2. **Where now:** **[MEASURED]** `assets/deckwave-score.js:233`, `assets/deckwave-score.js:236`, `assets/deckwave-score.js:238`, `assets/deckwave-score.js:246`.
3. **Fix size and risk:** **[INFERRED]** Small-to-medium identity-resolution change; **HEARD-PATH** because it changes which tracks load for playback. Prefer unique exact matches and reject ambiguous fallback matches. Any new metadata tolerance introduces a **THRESHOLD** decision; do not invent one. **[MEASURED]** Saved BPM is rounded at `assets/deckwave-score.js:96`, which matters before requiring equality with corpus BPM.
4. **Testable?** **Yes [INFERRED; proposed, not run].** Give two distinct corpus objects the names above and load a score requesting the second. Assert that the second object is selected and the first remains unchanged. Also assert that an ambiguous fallback reports a missing track instead of selecting the first candidate.
5. **Duplicate of:** **[INFERRED]** None among these findings.

**F98**

1. **Verdict:** **CAN’T-TELL [INFERRED]** for the claimed disagreement with the current renderer. **[MEASURED]** The cue still declares `FILE "mix.flac" WAVE` and writes indices from score-step `atSec`. The score planner contains rate-dependent timing and a default crossfade of 16 seconds. **[CARRIED—F98]** The renderer’s different crossfade, entry rules, filename and reported drift come solely from the brief. **[INFERRED]** Establishing the current mismatch requires `DWRENDER.plan`, FLAC filename construction and the dashboard cue-export handler; asserting correspondence with actual live playback also requires the Player’s scheduling code.
2. **Where now:** **[MEASURED]** `assets/deckwave-score.js:52`, `assets/deckwave-score.js:69`, `assets/deckwave-score.js:126`, `assets/deckwave-score.js:207`, `assets/deckwave-score.js:222`. Current renderer locations are unestablished.
3. **Fix size and risk:** **[INFERRED]** If confirmed, a small disclosure/export-description change is sufficient. Reconciling crossfades, rates or entry points is **HEARD-PATH**. Simply deleting `FILE` also requires reconsidering the claim that this is a playable standard cue sheet.
4. **Testable?** **No established failing mismatch check from these inputs [INFERRED].** With the renderer supplied, compare both planners on a deterministic fixture. A disclosure-only check could require an explicit “planned live timeline, not rendered FLAC” statement, but that wording should follow verification of the renderer.
5. **Duplicate of:** **[INFERRED]** None among these findings.

**F107**

1. **Verdict:** **REAL [INFERRED]** as an inconsistency between the shown planning models; the current live-engine discrepancy remains unverified. **[MEASURED]** The seed loop always drifts, whereas `resequenceTail` preserves tempo for grid-straight tracks and resets it for reach-straight tracks; the score planner makes that distinction too. The supplied router’s candidate predicate permits grid-untrusted tracks when their BPM satisfies its gate. **[CARRIED—F107]** The description of current `chain()` behavior needs confirmation from the Player. **[INFERRED]** The brief’s 120-to-150 example is outside the supplied router’s 8% gate; a 128 BPM stone at 120 BPM is an eligible example.
2. **Where now:** **[MEASURED]** `assets/deckwave-nav-commit.js:213`, `assets/deckwave-nav-commit.js:215`, `assets/deckwave-nav-commit.js:217`; contrasting rules at `assets/deckwave-nav-commit.js:142` and `assets/deckwave-score.js:144`. The related unconditional stamping/drift occurs at `assets/deckwave-nav-commit.js:82` and `assets/deckwave-nav-commit.js:87`.
3. **Fix size and risk:** **[INFERRED]** Small coordinated tempo-walk correction, but **HEARD-PATH**: the seed influences tail order and straight/locked classification. Check current `chain()` and obtain the owner’s ear. A seed-only patch leaves the inserted head’s stretch bookkeeping inconsistent.
4. **Testable?** **Yes [INFERRED; proposed, not run].** Capture the tempo passed to `resequenceTail`. Starting at 120, with a grid-straight stone at 128 followed by a locked destination at 133, the shown three-way rules imply 124.55; the current unconditional walk implies 126.37. Include reach-straight and ordinary locked fixtures. This proves model consistency, not audible correctness.
5. **Duplicate of:** **[INFERRED]** None among these findings.

**F113**

1. **Verdict:** **CAN’T-TELL [INFERRED].** **[CARRIED—F113]** Both the ROADMAP wording and assertions about page loading come exclusively from the brief. **[INFERRED]** Verification requires the current ROADMAP paragraph, `index.html`, relevant startup loaders and the cited panel check. A filename occurrence or comment alone would not establish whether the module is fetched.
2. **Where now:** **[CARRIED—brief]** `docs/ROADMAP.md:310`, `index.html:49`, `tools/check-panels.js:1130` are historical locators. **[INFERRED]** Current lines cannot be established from the supplied text.
3. **Fix size and risk:** **[INFERRED]** A one-paragraph documentation correction if confirmed; no HEARD-PATH change.
4. **Testable?** **No established failing check from these inputs [INFERRED].** After obtaining the missing text, check documentation against the actual loading path. Any scan reporting absence must first identify a known-loaded script using the same scan and state which entry points and loader spellings it covers.
5. **Duplicate of:** **[INFERRED]** None among these findings.

| F-number | Verdict [INFERRED] | Priority [INFERRED] | Reason [INFERRED] |
|---|---|---:|---|
| F28 | REAL | 2 | Correct the copied-code notice and regenerate the module; verify legal wording against the licence. |
| F33 | REAL, notice portion | 3 | Merge with F28; independently verify the README allegation. |
| F36 | REAL | 3 | Reproducible queue-state defect, but current application exposure is unverified and the fix affects DSP settings. |
| F37 | REAL | 3 | Reset defect is supported; the proposed one-line repair would throw, and shipped use remains unverified. |
| F97 | REAL | 1 | Loading can silently select and mutate the wrong tracks; a direct regression fixture is available. |
| F98 | CAN’T-TELL | 2 | Inspect the current renderer before choosing disclosure wording or export changes. |
| F107 | REAL, planning inconsistency | 2 | Correctable seed mismatch affects tail planning; verify Player behavior and cover related head bookkeeping. |
| F113 | CAN’T-TELL | 3 | No current documentation/loading disagreement is established by the supplied material. |