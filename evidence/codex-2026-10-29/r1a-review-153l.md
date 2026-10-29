**0f20006 — INFERRED: SOUND**

- **MEASURED:** The no-track branch now restores labels, clears metadata and replaces grid values with dashes when `labelsSwapped` is set (`assets/deckwave-nowplaying.js:238`). **INFERRED:** This fixes the stated listen-off transition without changing playback.
- **MEASURED:** The check first establishes listening labels, then checks the idle result (`tools/check-panels.js:765`, commit new-side lines). **INFERRED:** Old source fails because its early return preserves listening labels and metadata; new source satisfies these assertions.
- **INFERRED:** A wrong fix replacing metadata with unrelated text would pass the negative `/external source/` assertion. The fake observes label/value assignments, not rendered DOM or CSS. This limitation does not undermine the demonstrated label-restoration repair.

**121a5a8 — INFERRED: SOUND-WITH-NOTE**

- **MEASURED:** Both traces now start at `(i - filled + k + capacity) % capacity` (`assets/deckwave-panels.js:230`, `assets/deckwave-panels.js:321`). **INFERRED:** Before filling, this starts at slot zero; after filling, it preserves the previous wrapped ordering. The stated defect is fixed without changing sampled values.
- **MEASURED:** The recorder captures paths at `beginPath`, without recording whether they were stroked (`tools/check-panels.js:465`). **INFERRED:** Old source fails the two-sample ordering assertions; new source passes. However, deleting the trace’s `stroke()` still passes: the check cannot establish that the recorded trace was painted. That part of its “draws” claim is decoration.
- **INFERRED:** Smallest follow-up: evaluate only stroked paths, retaining the existing ordering assertions. The combined check still rejects old indexing and additionally rejects an invisible trace.

**b409352 — INFERRED: SOUND-WITH-NOTE**

- **MEASURED:** Only the displayed band’s radii are floored; `nav.GATE` and calls to `nav.reachable()` remain unchanged (`assets/panel-wayposts.js:71`, `assets/panel-wayposts.js:84`). **INFERRED:** This fixes negative radii for the stated positive-BPM fixture. It changes geometry, not reachability.
- **MEASURED:** The check requires no exception, one footer and nonnegative recorded radii (`tools/check-panels.js:220`). **INFERRED:** Old source fails at the negative inner radius; new source passes. Removing the entire reachable band also passes, because other arcs and the footer remain.
- **INFERRED:** Smallest follow-up: identify the band’s arcs and require the expected zero inner radius and preserved outer radius. Retain the existing exception/footer assertions. The fake can verify geometry arguments, not the resulting pixels.

**654f8db — INFERRED: SOUND-WITH-NOTE**

- **MEASURED:** An opener interval now invokes cleanup independently of popup rAF (`assets/deckwave-popout.js:77`). **INFERRED:** This fixes hand-close cleanup for an already-created visualizer. Background/mobile timer execution can be delayed; the interval does not establish a one-second cleanup guarantee.
- **MEASURED:** Script loading still resumes into global `win`/`bcv`, without checking which window or mode initiated it (`assets/deckwave-popout.js:199`, `assets/deckwave-popout.js:208`). **INFERRED — residual defect, predating this patch:** Start party loading, hand-close, reopen as a panel, then finish loading: the old request can connect a hidden visualizer to the new panel window. The timer sees an open window and leaves it connected. **Falsifier:** That deferred-load sequence creates/connects no visualizer after replacement.
- **MEASURED:** The new test drops popup frames and manually fires opener timers; teardown records only the argument to `disconnectAudio()` (`tools/check-popout.js:147`, `tools/check-popout.js:203`). **INFERRED:** Old source fails cleanup; new source passes the loaded-party case. A timer that never unregisters also passes. **CAN'T-TELL:** Actual Butterchurn disconnection, WebGL release and browser suspension behavior are not established by these fakes.
- **INFERRED:** Smallest follow-up: bind asynchronous loading to its initiating window/request and invalidate it on close or mode replacement. Add the deferred-load sequence above; it fails the currently pasted source and should pass the guarded version. Merely preventing `connectAudio()` could still pass unless the check also excludes stale visualizer creation.

**b8a6834 — INFERRED: SOUND-WITH-NOTE**

- **MEASURED:** A rejected build closes and clears `ctx` only while that attempt still owns it (`assets/deckwave.js:1060`). **INFERRED:** This repairs the shown failed-boot ownership problem. **HEARD PATH:** startup/retry resource lifetime; no gain or rate adjustment appears in this diff.
- **CAN'T-TELL:** The remaining graph construction and `kill()` implementation were not supplied, so their cleanup interactions cannot be certified.
- **MEASURED:** The new assertions count constructions and closes across two failures and one success (`tools/check-player.js:698`). **INFERRED:** Old source fails the close/`none` assertions; the new catch satisfies them. Closing the first context twice while leaking the second could also satisfy aggregate counts. The synchronous fake cannot establish completion of browser `close()`.
- **INFERRED:** Smallest follow-up: record context identities and require exactly one close on each failed instance, none on the successful instance. This retains the old-source failure and rejects the duplicate-close wrong fix.
- **MEASURED:** The existing sink test examines the selected sink after boot (`tools/check-player.js:656`). **INFERRED:** Its “before anything sounds” wording exceeds its observation: it does not check ordering against sound production. That ordering claim is decoration.

**c338226 — INFERRED: SOUND**

- **MEASURED:** The constructor string now supplies an escaped regex dot while retaining the extension list, end anchor and case-insensitive flag (`assets/deckwave.js:390`, `assets/deckwave.js:393`). **INFERRED:** This fixes the filename gate. Valid audio with an undotted filename is also rejected intentionally; a filename alone cannot establish whether decoding would fail.
- **MEASURED:** The harness evaluates the actual declarations and tests positive and negative names (`tools/check-pool.js:532`). **INFERRED:** All five negative examples match the old wildcard-dot regex and fail the new check; the corrected regex passes.
- **INFERRED:** A wrong regex missing the final `$` would also pass these fixtures while accepting `song.mp3.txt`. The fake introduces no relevant limitation here: this is ordinary JavaScript regex behavior.
- **CAN'T-TELL:** The keeper-library acceptance counts reported in the commit message are not independently verifiable from the supplied files.

**555cfa7 — INFERRED: SOUND-WITH-NOTE**

- **MEASURED:** Selection now prefers exact names, rejects empty fallback keys and accepts folded matches only when every hit has the same original name (`assets/deckwave-score.js:242`). **INFERRED:** This fixes the supplied non-Latin cases and also changes ambiguous Latin-name fallback behavior. Identical-name duplicates still select the first.
- **INFERRED — HEARD PATH:** Loaded track identity and omissions can change the eventual set. This is the intended repair, but it merits keeper attention when loading affected scores.
- **MEASURED:** Synthetic checks cover exact CJK selection, absent Cyrillic selection and ambiguous mixed names (`tools/check-pool.js:402`, `tools/check-pool.js:407`). **INFERRED:** Old source fails these cases; new source passes. A wrong implementation guarding only non-ASCII names could still pass them while retaining ambiguous Latin fallback.
- **INFERRED:** Smallest follow-up: add `[A-B, AB]` with requested `A_B` expecting missing, and exact `AB` expecting the second track. Old source fails both; current source passes. Include a unique folded-match control so disabling fallback entirely cannot pass.
- **CAN'T-TELL:** The real-corpus control’s result cannot be verified without its corpus.

**52c848d — INFERRED: SOUND-WITH-NOTE**

- **MEASURED:** The tooltip now distinguishes parallel pairing on Deckwave from relative pairing on standard Camelot, and states both without requiring a subsequent tooltip update (`assets/deckwave-dashboard.js:2639`). **INFERRED:** This fixes the unconditional wording; no playback behavior changes.
- **CAN'T-TELL:** The actual Camelot table declarations were not supplied. Their agreement with every stated relationship and numeric example remains unverified.
- **MEASURED:** The harness checks table relationships for A, plus wording patterns and the literal Deckwave example (`tools/check-panels.js:1811`, `tools/check-panels.js:1821`). **INFERRED:** Old wording fails both substantive text checks; new wording passes. Wrong prose such as “Deckwave tune is not parallel” can satisfy the regex. Table relationships could also pass while the hardcoded numeric examples are stale.
- **INFERRED:** Smallest follow-up: compare both displayed examples with actual table values, retaining the old/new wording checks. This remains a source-content check, not a tooltip-rendering test.

**ca25f5c — INFERRED: SOUND-WITH-NOTE**

- **MEASURED:** `hold()` counts pending operations, `discard()` refuses while the count is nonzero, and the button catches and announces that refusal (`assets/deckwave-dashboard.js:517`, `assets/deckwave-dashboard.js:523`, `assets/deckwave-dashboard.js:708`). **INFERRED:** This fixes the stated false-discard announcement without cancelling the pending player operation.
- **INFERRED — scope regression:** Prepare A, start A, prepare B while A awaits, then discard B: the global counter refuses B even though B is not starting. `prepare()` remains allowed during that interval (`assets/deckwave-dashboard.js:522`). **Falsifier:** B can be discarded while A remains pending.
- **MEASURED:** The added checks exercise pending play/apply refusal and the extracted click handler (`tools/check-prepared.js:88`, `tools/check-prepared.js:104`, `tools/check-prepared.js:131`). **INFERRED:** Old session code accepts the discard, and its old handler throws on the injected refusal; those assertions therefore discriminate. They do not exercise replacement preparation B. A log-only refusal also passes the combined `said.concat(logged)` assertion despite providing no announcement.
- **CAN'T-TELL:** The omitted `rig()` implementation prevents independent confirmation of the claimed real-Player integration.
- **INFERRED:** Smallest follow-up: track pending candidates rather than blocking every preparation. Add A-pending/B-discard coverage; it fails this pasted version and passes candidate-specific guarding. Retain the existing A-refusal checks to exclude simply allowing every discard. Require the announcement separately from logging.

**INFERRED: Existing checks that overclaim**

- **MEASURED:** Origin checks search for source fragments (`tools/check-panels.js:437`, commit `121a5a8`); projector checks search for a draw call (`tools/check-popout.js:247`). **INFERRED:** Correct-looking code inside an unreachable branch can pass while the reported behavior remains broken. These are decoration as behavioral guarantees.
- **INFERRED:** Every “wrong fix passes” assessment above is falsifiable by applying that specific mutation and observing the focused assertion reject it. Old/new outcomes here are predictions, not executed results.

**CAN'T-TELL:** Seven of the requested sixteen commits are absent; no verdict is possible for those seven.

**INFERRED: Before the keeper listens, ranked**

1. Complete the review with the missing seven commits.
2. Fix the popout’s stale asynchronous load attaching after close/reopen.
3. Make prepared-set discard ownership specific to its candidate.
4. Strengthen context-identity cleanup and score-selection checks before treating their green results as coverage of those failure modes.