**F94**

1. **Verdict: REAL [INFERRED].** **[MEASURED]** The local cleaner applies the bare-hyphen replacement twice; both `fields()` and `drawArt()` call it. **[INFERRED]** Tracing `LukHash - Fast-Forward` through those replacements produces `Forward`.
2. **Where now [MEASURED]:** `assets/deckwave-phone.js:391`; consumers at lines 393 and 457.
3. **Fix size and risk [INFERRED]:** Small, display-only. Require spaced separators and whitespace after a removable numeric prefix.
4. **Testable? Yes [INFERRED]:** Assert that the real `fields()` preserves `Fast-Forward`, `X-Ray Vision`, and `8-Bit Warrior` after removing the artist prefix.
5. **Duplicate of [INFERRED]:** —; representative for F108 and F115.

**F101**

1. **Verdict: REAL [INFERRED], with separate subclaims.** **[MEASURED]** Metadata supplies `total` directly to `Float32Array`. Normal completion calls finish/delete; thrown processing errors instead reach the Promise executor or `.catch(no)`. Each loader caches its own promise. **[INFERRED]** Allocation and exception-cleanup defects remain. Two calls to the *same* loader share its pending promise; simultaneous calls to the *different* loaders can insert separate scripts.
2. **Where now [MEASURED]:** `assets/deckwave-flac.js:89`, allocation at line 91, cleanup at lines 132–138, exception paths at lines 157–159; loaders at `assets/deckwave-flac.js:40` and `assets/deckwave-render.js:182`.
3. **Fix size and risk [INFERRED]:** Medium: allocate from delivered frames and centralize cleanup. An invented compressed-size multiplier risks changing detector inputs; treat that proposal as **THRESHOLD/detector-input** work requiring measurement.
4. **Testable? Yes [INFERRED]:** With allocation and decoder spies, advertise a huge sample total but deliver a small frame; assert allocation does not use the advertised total. Inject initial and deferred throws; assert rejection and exactly one deletion.
5. **Duplicate of [INFERRED]:** Cleanup overlaps F128; failed-load caching overlaps F106. Header-driven allocation is distinct.

**F103**

1. **Verdict: FIXED [INFERRED].** **[MEASURED]** Merge now obtains existing keys inside the write transaction and passes them to `write()`, which skips matching IDs. Replace explicitly clears and writes without that skip set.
2. **Where now [MEASURED]:** `assets/deckwave-cache.js:225`, replace branch at line 231, merge key lookup at lines 239–240.
3. **Fix size and risk [INFERRED]:** No additional fix for this finding.
4. **Testable? No new failing check [INFERRED]:** Existing-row preservation plus insertion of a missing row should already pass. That remains a useful regression assertion.
5. **Duplicate of [INFERRED]:** —.

**F106**

1. **Verdict: REAL [INFERRED].** **[MEASURED]** Both loaders return their cached promise and reject it on script error. Both also check `window.Flac` *before* that cache. **[INFERRED]** Retrying the failed loader remains rejected while `Flac` is absent. “Only reload can recover” is too strong: a successful load through the other loader can bypass the rejected cache.
2. **Where now [MEASURED]:** `assets/deckwave-flac.js:41`, line 42 and line 51; `assets/deckwave-render.js:183`, line 184 and line 198.
3. **Fix size and risk [INFERRED]:** Small loader bookkeeping: clear rejected attempts and remove failed script elements; cover undefined-global failures as well as network errors.
4. **Testable? Yes [INFERRED]:** Fail the first script request, leave `Flac` absent, then succeed the second. Assert a second insertion and successful resolution in each loader.
5. **Duplicate of [INFERRED]:** The loader portion of F101; also repeated within F111.

**F108**

1. **Verdict: REAL [INFERRED].** **[MEASURED]** The same cleaner retains both permissive hyphen replacements and `/^\d+\s*/`. **[INFERRED]** Correcting only the separator still lets the numeric replacement remove the `8` from `8-Bit Warrior`.
2. **Where now [MEASURED]:** `assets/deckwave-phone.js:391`.
3. **Fix size and risk [INFERRED]:** Small, display-only; fix separator and numeric-prefix handling together.
4. **Testable? Yes [INFERRED]:** Assert `Artist - Mid-Air` becomes `Mid-Air` and `LukHash - 8-Bit Warrior` becomes `8-Bit Warrior`.
5. **Duplicate of [INFERRED]:** F94; include its digit-preservation case in that change.

**F111**

1. **Verdict: REAL [INFERRED].** **[MEASURED]** Both readiness paths resolve on a four-second timer. The renderer also immediately resolves whenever `window.Flac` exists, whereas the decoder’s existing-global branch calls `ensureReady()`. **[INFERRED]** Readiness can therefore be reported prematurely even before the timer, through the renderer’s existing-global branch.
2. **Where now [MEASURED]:** `assets/deckwave-render.js:183`, readiness handling at lines 194–198; `assets/deckwave-flac.js:56`–61.
3. **Fix size and risk [INFERRED]:** Small-to-medium loader work. Share readiness across callers, resolve on verified readiness, and make timeout failure retryable; avoid competing assignments to `Flac.onready`.
4. **Testable? Yes [INFERRED]:** Supply an existing but unready `Flac`; assert boot does not resolve. Exercise timeout rejection, retry, and readiness notification to concurrent callers.
5. **Duplicate of [INFERRED]:** F106 for rejected-promise caching; premature readiness is additional.

**F115**

1. **Verdict: REAL [INFERRED] for the cleaner defect.** **[MEASURED]** Metadata and artwork use the local permissive cleaner. **[CARRIED — F115 brief]** The corpus count, sibling-cleaner outputs, and existing harness coverage were reported by the earlier reviewers; they are not independently established here.
2. **Where now [MEASURED]:** `assets/deckwave-phone.js:391`; metadata at line 393 and artwork at line 457.
3. **Fix size and risk [INFERRED]:** Small, display-only. The proposed spaced regex preserves `8-Bit` but does not necessarily reduce the full album/track specimen to only `8-Bit Warrior`; specify the expected complete output.
4. **Testable? Yes [INFERRED]:** Exercise `fields()` with the full `8-Bit Warrior` specimen and `LukHash - GLITCH - 02 DOOMSDAY`; assert exact agreed titles, including digit preservation.
5. **Duplicate of [INFERRED]:** F94.

**F116**

1. **Verdict: REAL [INFERRED].** **[MEASURED]** An already-started track receives gain 1; fade-out restarts at clamped time zero, while source stop retains the original endpoint. **[INFERRED]** With `out=88`, `from=94`, and `XF=12`, the scheduled fade ends at 12 seconds but stop occurs at 6.2 seconds. The incoming track also starts at full gain. An audible click is an inference, not a listening result.
2. **Where now [MEASURED]:** `assets/deckwave-render.js:161`–171.
3. **Fix size and risk [INFERRED]:** Medium; clip the original envelopes to the selected range. **HEARD-PATH:** exported gain envelopes and scheduling require the owner’s ear.
4. **Testable? Yes [INFERRED]:** A recording AudioParam fake can assert interpolated starting values and original fade endpoints. **[CARRIED — test brief]** Existing no-op setters cannot observe those calls; recorded schedules still do not validate rendered sound.
5. **Duplicate of [INFERRED]:** —.

**F119**

1. **Verdict: REAL [INFERRED] for ignoring the result.** **[MEASURED]** The process return is discarded; the loop advances and can resolve a Blob, after which `exportMix()` reports saved. **[CARRIED — F119 brief]** False means an encoder block was refused. **[INFERRED]** Confirm that contract and natural failure reachability in the encoder wrapper in `vendor/libflac.min.js` before claiming an observed truncated-file failure.
2. **Where now [MEASURED]:** `assets/deckwave-render.js:232`; completion at lines 237–241 and saved reporting at line 272.
3. **Fix size and risk [INFERRED]:** Small error-handling change once the return contract is confirmed; preserve successful encoding behavior.
4. **Testable? Yes [INFERRED]:** Make a fake encoder return false for a block. Assert rejection, exactly one deletion, and no successful Blob/save result.
5. **Duplicate of [INFERRED]:** —; F127 concerns thrown exceptions, a different failure mechanism.

**F120**

1. **Verdict: REAL [INFERRED].** **[MEASURED]** `dropWake()` releases an assigned sentinel. During the request await, assignment has not occurred; resolution subsequently stores the sentinel and installs its listener. **[INFERRED]** Releasing the final hold during that await can leave an unwanted lock held.
2. **Where now [MEASURED]:** `assets/deckwave-phone.js:271`–278; hold/release at lines 286–287.
3. **Fix size and risk [INFERRED]:** Small acquisition bookkeeping: recheck demand on resolution and prevent overlapping acquisitions from losing ownership.
4. **Testable? Yes [INFERRED]:** Defer the wake request, call hold then release, resolve it, and assert sentinel release plus `holds: []` and `wakeLockHeld: false`.
5. **Duplicate of [INFERRED]:** —.

**F121**

1. **Verdict: REAL [INFERRED].** **[MEASURED]** Artwork replacement explicitly revokes the previous URL at line 478. Switching artwork off instead assigns `artUrl = null` at line 575. **[INFERRED]** That discards the reference needed by the replacement cleanup.
2. **Where now [MEASURED]:** `assets/deckwave-phone.js:575`; working replacement cleanup at line 478.
3. **Fix size and risk [INFERRED]:** Small URL-lifetime bookkeeping; revoke before clearing.
4. **Testable? Yes [INFERRED]:** Create an artwork URL, switch off, and assert that exact URL receives one revoke call. Repeat across multiple completed artwork cycles.
5. **Duplicate of [INFERRED]:** —; F123 separately concerns pending callbacks.

**F122**

1. **Verdict: REAL [INFERRED] for stale media activation.** **[MEASURED]** After awaiting `outputStream(true)`, the earlier call assigns `srcObject` and calls `play()`. The off branch conditionally unwires and pauses whatever element exists then. **[INFERRED]** An earlier continuation can therefore play after off completes. Confirm the exact final graph route using `assets/deckwave.js` implementations of `outputStream()` and `outputVia`.
2. **Where now [MEASURED]:** `assets/deckwave-phone.js:360`–375; concurrent entry points at lines 503–511 and 539–543.
3. **Fix size and risk [INFERRED]:** Medium; serialize or reconcile asynchronous mode changes. **HEARD-PATH:** routing and playback activation require the owner’s ear.
4. **Testable? Yes [INFERRED]:** Let media mode reach the pending stream request, complete off, then resolve the old request. Assert final speakers routing and a paused/disconnected media element using a deferred engine fake.
5. **Duplicate of [INFERRED]:** —.

**F123**

1. **Verdict: REAL [INFERRED], with overstated persistence.** **[MEASURED]** `updateArt()` checks mode before encoding; its callback checks the blob, assigns the captured metadata, and pushes it. The regular tick also calls `updateArt(false)`, whose poster guard permits another encode when metadata differs. **[INFERRED]** Stale publication is real, but with artwork active a subsequent successful redraw can correct it before the next track change.
2. **Where now [MEASURED]:** `assets/deckwave-phone.js:465`–480; title gate at line 430 and artwork tick at line 516.
3. **Fix size and risk [INFERRED]:** Small, display-only; validate artwork generation, enabled state, and current metadata before publication.
4. **Testable? Yes [INFERRED]:** Defer `toBlob()`. Switch artwork off or advance metadata before completing it; assert the old callback neither reinstalls artwork nor overwrites the newer title.
5. **Duplicate of [INFERRED]:** —; F121 needs separate URL disposal.

**F127**

1. **Verdict: REAL [INFERRED].** **[MEASURED]** Successful completion deletes the encoder. Later chunks run directly as timer callbacks, while progress reporting and encoder processing precede that cleanup. **[INFERRED]** A later throw escapes the Promise executor, leaving the outer promise pending and the encoder allocated; a first-chunk throw rejects but still bypasses deletion.
2. **Where now [MEASURED]:** `assets/deckwave-render.js:223`–244.
3. **Fix size and risk [INFERRED]:** Small-to-medium encoder lifetime cleanup; cover initialization and chunk failures with one guarded disposal path.
4. **Testable? Yes [INFERRED]:** Use more than one chunk and throw from the second progress callback. Assert rejection, exactly one deletion, and no uncaught timer exception.
5. **Duplicate of [INFERRED]:** —; share cleanup machinery with F119, but test both mechanisms.

**F128**

1. **Verdict: REAL [INFERRED], limited to exception paths.** **[MEASURED]** `onErr()` stores an error that reaches `finish()`, which deletes before rejecting; nonzero initialization status also deletes. Processing/progress throws before `finish()` instead reach `.catch(no)` or executor rejection. **[INFERRED]** “Every failed decode” is too broad; these thrown-error paths leak.
2. **Where now [MEASURED]:** `assets/deckwave-flac.js:124`–159.
3. **Fix size and risk [INFERRED]:** Small guarded decoder cleanup, covering initialization throws and both initial and deferred processing.
4. **Testable? Yes [INFERRED]:** Throw during a deferred processing/progress call and assert rejection plus exactly one deletion. Retain callback-reported failure as a cleanup-positive control.
5. **Duplicate of [INFERRED]:** F101’s decoder exception-cleanup portion.

**F130**

1. **Verdict: REAL [INFERRED] for selecting a non-improving fallback.** **[MEASURED]** Direct candidates are compared against `now`; fallback candidates are compared only against each other, then passed toward route selection. **[INFERRED]** The proposed 120/100/90 fixture selects 100 as fallback. Actual route acceptance additionally depends on current navigator/dashboard code, which the brief describes but does not supply.
2. **Where now [MEASURED]:** `assets/deckwave-events.js:119`–124; route attempt at lines 151–163.
3. **Fix size and risk [INFERRED]:** Small direction guard. **HEARD-PATH:** changes track selection/order and needs the owner’s ear. Return `{none: ...}` from `pick()`; returning `say(...)` there would violate its caller’s expected shape.
4. **Testable? Yes [INFERRED]:** Offer a fake fast route for the non-improving target; assert neither blend nor route is called and the response explains that nothing ahead improves the requested axis.
5. **Duplicate of [INFERRED]:** —.

**F132**

1. **Verdict: REAL [INFERRED].** **[MEASURED]** GNU/FSF hosts take the unconditional `GPL` branch. By comparison, the CC branch actually parses the pathname. **[INFERRED]** FDL, LGPL, AGPL, and unrelated GNU pages receive an unjustified GPL label.
2. **Where now [MEASURED]:** `assets/deckwave-libre.js:179`–207, especially line 202.
3. **Fix size and risk [INFERRED]:** Small attribution-display fix; recognize specific licence paths and preserve the original URL for unknown paths.
4. **Testable? Yes [INFERRED]:** Keep a recognized GPL URL as control; assert correct names or null for FDL/LGPL/AGPL and null for `https://www.gnu.org/software/emacs/`. Pin versions without accidentally including the dot before `html`.
5. **Duplicate of [INFERRED]:** —.

**F133**

1. **Verdict: REAL [INFERRED].** **[MEASURED]** Enter, search, and LukHash handlers start searches; both search continuations write rows/footer after their await, and both catches clear results. Source change itself only updates source/UI state. **[INFERRED]** An earlier success or failure can overwrite a later result; source changes can also leave a pending request answering the previous source.
2. **Where now [MEASURED]:** `assets/deckwave-libre.js:817`, handlers at lines 835–839, Archive completion at lines 862–865 and 955, Commons completion at lines 965–968 and 1009.
3. **Fix size and risk [INFERRED]:** Small display-state change: shared generation across sources, checked in success and error paths; invalidate when source changes.
4. **Testable? Yes [INFERRED]:** Resolve request B before A and assert B’s rows/footer survive A’s later success and later failure. Include a cross-source case.
5. **Duplicate of [INFERRED]:** —; representative for F144, F146, and F153.

**F134**

1. **Verdict: REAL [INFERRED] for the catalogue count.** **[MEASURED]** Counting property declarations in the supplied `UI` object gives 35; the comments say 30 and 28. **[CARRIED — comments at lines 19 and 282–284]** Only two entries are consumed. **[INFERRED]** That comment implies 33 others, but current consumer coverage cannot be independently established from this file.
2. **Where now [MEASURED]:** `assets/deckwave-messages.js:18`, line 283, and the `UI` declaration at lines 285–301.
3. **Fix size and risk [INFERRED]:** Tiny documentation edit; remove brittle numeric counts.
4. **Testable? Yes [INFERRED]:** Compare the stated catalogue total with the number of exported keys beginning `ui.`; the current 30 disagrees with 35. That does not test how many keys consumers read.
5. **Duplicate of [INFERRED]:** The count portion of F141.

**F135**

1. **Verdict: CAN'T-TELL [INFERRED].** **[MEASURED]** `pulse()` uses elapsed multiplied by rate. **[CARRIED — F135 brief]** Current engine elapsed excludes a nonzero source entry. **[INFERRED]** Confirming the defect requires `assets/deckwave.js` source-start paths and `DW.elapsed`/`DW.deck` getters. Also, the supplied pulse search assigns an exact beat timestamp to the preceding interval, so the brief’s exact-boundary phase-zero expectation is a separate issue.
2. **Where now [MEASURED]:** `assets/deckwave-events.js:365`; beat interval selection at lines 378–384.
3. **Fix size and risk [INFERRED]:** Small consumer change plus an engine fact getter, if needed; prefer F150’s authoritative position. Read-only position exposure need not change beat alignment.
4. **Testable? Yes, conditionally [INFERRED]:** Establish the engine contract, then assert correct position with nonzero entry using a timestamp between beats. Add an integration check for the real getter.
5. **Duplicate of [INFERRED]:** F150’s entry-offset portion.

**F136**

1. **Verdict: REAL [INFERRED] for fulfilled refusals.** **[MEASURED]** Both awaited results are discarded and followed by success sentences; `last` is assigned before each operation. **[INFERRED]** A fulfilled refusal is misreported; a rejected promise bypasses the success sentence. **[CARRIED — F136 brief]** The dashboard currently fulfills specific refusals. Its current `blend()`/`applyRoute()` implementations in `assets/deckwave-dashboard.js` are needed to specify the result contract.
2. **Where now [MEASURED]:** `assets/deckwave-events.js:145`–147 and lines 159–163.
3. **Fix size and risk [INFERRED]:** Small-to-medium result plumbing across events/dashboard; reporting-only if operation invocation remains unchanged. Distinguish intended action from confirmed outcome.
4. **Testable? Yes [INFERRED]:** Wire callbacks that fulfill with refusal results; assert returned text does not claim blending/routing succeeded. Separately verify the dashboard propagates those outcomes.
5. **Duplicate of [INFERRED]:** —.

**F137**

1. **Verdict: REAL [INFERRED].** **[MEASURED]** Cache consumption starts from a clone before reading; cap handling awaits reader cancellation before reporting/throwing, and the catch subsequently awaits the cache write. **[CARRIED — F137/F149 briefs]** The clone’s tee branch can keep consumption alive and delay cancellation settlement. **[INFERRED]** The cap therefore need not promptly stop downloading or report refusal.
2. **Where now [MEASURED]:** `assets/deckwave-libre.js:273`–276 and lines 342–357.
3. **Fix size and risk [INFERRED]:** Medium resource bookkeeping: read once, then cache the accepted buffer, keeping the cap unchanged. Merely skipping the cache await and deleting cannot stop its consumer or prevent a later write.
4. **Testable? Yes [INFERRED]:** Use a tee-aware fake with an oversize chunk and pending cache consumer. Assert prompt refusal and no surviving consumer; retain a successful small-response cache write as control. Browser transfer cancellation remains a separate integration check.
5. **Duplicate of [INFERRED]:** —; representative for F145 and F149.

**F140**

1. **Verdict: REAL [INFERRED] within the supplied panel.** **[MEASURED]** `reportFetch()` broadcasts to all watchers; both panel watchers update their button for every unfinished event, irrespective of URL. **[CARRIED — F140 brief]** The dashboard demo has another such watcher; its implementation is not supplied.
2. **Where now [MEASURED]:** `assets/deckwave-libre.js:261`, Archive watcher at lines 924–925, Commons watcher at lines 993–994.
3. **Fix size and risk [INFERRED]:** Small display bookkeeping: filter by the release’s URLs or Commons file URL. Inspect the dashboard watcher before extending the fix there.
4. **Testable? Yes [INFERRED]:** Start two row operations and deliver differently sized progress events for each URL. Assert each button changes only for its own downloads.
5. **Duplicate of [INFERRED]:** —.

**F141**

1. **Verdict: CAN'T-TELL [INFERRED] for energy-panel drift.** **[MEASURED]** The glossary still says “the five tiles.” **[CARRIED — F141 brief]** The current interface offers one panel with a selector. **[INFERRED]** Confirming that mismatch requires current energy-panel registration/menu code in `assets/deckwave-panels.js` and `assets/deckwave-dashboard.js`. The catalogue-count defect is independently covered by F134.
2. **Where now [MEASURED]:** `assets/deckwave-messages.js:271`; count claims at lines 18 and 283.
3. **Fix size and risk [INFERRED]:** Tiny documentation edit after confirming the actual selector and supported windows.
4. **Testable? No independently established failing check for the panel claim [INFERRED]:** The supplied text alone cannot establish the current menu contract. The count assertion is testable under F134.
5. **Duplicate of [INFERRED]:** F134 for counts; energy-panel wording is distinct.

**F143**

1. **Verdict: REAL [INFERRED] as behavior, not an established broken partial-import promise.** **[MEASURED]** `importJSON()` starts with empty catalogues, copies metadata only for encountered terms, and `use()` replaces entire catalogues. The documented translation shape is the same object/keys with translated values. **[INFERRED]** Partial imports replace the active catalogue with a partial one, but automatic fallback is not promised by that documented contract.
2. **Where now [MEASURED]:** `assets/deckwave-messages.js:315` and lines 331–345; documented translation shape at lines 31–34.
3. **Fix size and risk [INFERRED]:** Small, display-only. Prefer documenting or validating complete catalogues unless partial translation support is wanted; define whether fallback uses English defaults or the current language.
4. **Testable? Yes [INFERRED]:** A partial-import preservation test would fail today: assert unrelated terms and `ui.verified` survive. That tests a newly selected fallback contract.
5. **Duplicate of [INFERRED]:** —.

**F144**

1. **Verdict: REAL [INFERRED].** **[MEASURED]** Both search handlers publish after awaiting their request; their error handlers also modify the shared list/footer. **[INFERRED]** Completion order controls the final display.
2. **Where now [MEASURED]:** `assets/deckwave-libre.js:862`–865, line 955, lines 965–968, and line 1009.
3. **Fix size and risk [INFERRED]:** Small display-state fix under F133; include stale errors.
4. **Testable? Yes [INFERRED]:** Complete the older request last and assert the newer rows/footer remain.
5. **Duplicate of [INFERRED]:** F133.

**F145**

1. **Verdict: REAL [INFERRED].** **[MEASURED]** Clone consumption precedes the reader loop, and the oversize path awaits cancellation before issuing its report/error. **[INFERRED]** The brief’s assertion that the panel already reports “too big” while downloading continues is not guaranteed; reporting itself can be delayed.
2. **Where now [MEASURED]:** `assets/deckwave-libre.js:274`, line 342, and lines 346–357.
3. **Fix size and risk [INFERRED]:** Medium resource bookkeeping under F137; caching only an accepted buffer avoids this tee lifetime.
4. **Testable? Yes [INFERRED]:** Keep the fake cache branch pending beyond the cap and assert refusal does not await that branch or leave it consuming.
5. **Duplicate of [INFERRED]:** F137.

**F146**

1. **Verdict: REAL [INFERRED].** **[MEASURED]** Archive and Commons completions write the same list/footer. Source change updates controls; it does not itself launch a search. **[INFERRED]** The described switch followed by Enter can race; the brief’s claim that source selection itself starts another request is inaccurate.
2. **Where now [MEASURED]:** `assets/deckwave-libre.js:817`, lines 835–839, lines 862–865, and lines 965–968.
3. **Fix size and risk [INFERRED]:** Small display-state fix under F133, with source-change invalidation.
4. **Testable? Yes [INFERRED]:** Start Archive A, then Commons B; finish B before A and assert only B remains displayed.
5. **Duplicate of [INFERRED]:** F133.

**F147**

1. **Verdict: CAN'T-TELL [INFERRED] for the stated network-failure misclassification.** **[MEASURED]** When the item is absent and `res.failed` is truthy, the panel prints the decoder/iPhone sentence. **[CARRIED — F147 brief]** `DW.ingest()` counts network failures there and returns detailed messages. **[INFERRED]** Confirming that current contract requires `assets/deckwave.js` implementations of `ingest()`, `analyse()`, and their failure collection.
2. **Where now [MEASURED]:** `assets/deckwave-libre.js:996`–1003.
3. **Fix size and risk [INFERRED]:** Small reporting-only change once the result contract is confirmed. Prefer the actual failure reason; an error-prefix exclusion or iPhone user agent alone does not establish decoder failure.
4. **Testable? Yes, conditionally [INFERRED]:** Return a documented ingest failure carrying `HTTP 404`; assert the footer preserves that reason without attributing it to decoding. Verify the same shape through real ingest.
5. **Duplicate of [INFERRED]:** —.

**F149**

1. **Verdict: REAL [INFERRED].** **[MEASURED]** `await rd.cancel()` occurs before progress completion and the fatal throw. **[CARRIED — F149 brief]** Tee cancellation can wait for the cache branch. **[INFERRED]** This identifies an earlier blocking point than the catch’s later cache await.
2. **Where now [MEASURED]:** `assets/deckwave-libre.js:274`, line 342, and line 346.
3. **Fix size and risk [INFERRED]:** Medium; either remove concurrent tee consumption as in F137 or abort the fetch attempt so both branches terminate. Keep the existing size cap.
4. **Testable? Yes [INFERRED]:** Assert termination of the underlying consumer, not merely that the original reader received `cancel()`. A one-branch cancel assertion would already pass current code.
5. **Duplicate of [INFERRED]:** F137.

**F150**

1. **Verdict: CAN'T-TELL [INFERRED].** **[MEASURED]** Pulse computes elapsed multiplied by the current rate. **[CARRIED — F150 brief]** The engine separately maintains entry plus integrated rate history. **[INFERRED]** Current `assets/deckwave.js` implementations of `A.pos()`, `rateAt()`, source starts, rate changes, and the elapsed/deck getters are needed to establish the mismatch and the authoritative replacement.
2. **Where now [MEASURED]:** `assets/deckwave-events.js:365`; explanatory formula at lines 341–343.
3. **Fix size and risk [INFERRED]:** Small-to-medium additive position exposure and consumer update. Reading the existing engine position avoids changing **HEARD-PATH** beat alignment or stretch scheduling; changing either instead would require the owner’s ear.
4. **Testable? Yes, conditionally [INFERRED]:** Establish the getter contract; use nonzero entry and piecewise rate history where integrated position differs from elapsed times final rate. Assert pulse follows the engine position.
5. **Duplicate of [INFERRED]:** F135 for entry offset; rate-history handling is additional.

**F151**

1. **Verdict: REAL [INFERRED].** **[MEASURED]** `getJSON()` returns the body promise inside `try/finally`; `fetchBytes()` instead awaits body consumption before returning its buffer. **[INFERRED]** The JSON path executes `freeSlot()` before that returned body promise settles.
2. **Where now [MEASURED]:** `assets/deckwave-libre.js:385` and line 389; awaited-body comparison at line 344.
3. **Fix size and risk [INFERRED]:** One-keyword control-flow fix: await JSON consumption before releasing the slot.
4. **Testable? Yes [INFERRED]:** Issue several calls with immediate headers and deferred JSON bodies. Assert at most two bodies remain unresolved and a third request waits for body completion.
5. **Duplicate of [INFERRED]:** —.

**F152**

1. **Verdict: REAL [INFERRED].** **[MEASURED]** Cache rejection handlers are attached at the later success/error awaits, after `readBody()` has been awaited. Creation of the cache promise occurs earlier inside a synchronous `try`. **[INFERRED]** A rejection during a slow read can become unhandled before the later handler is attached.
2. **Where now [MEASURED]:** `assets/deckwave-libre.js:342`, line 346, and line 361.
3. **Fix size and risk [INFERRED]:** Tiny promise bookkeeping: attach rejection handling immediately, or eliminate the concurrent write through F137.
4. **Testable? Yes [INFERRED]:** Reject the cache write while the body remains deferred; observe an unhandled-rejection checkpoint and assert no event occurs after the fix, while the download still succeeds.
5. **Duplicate of [INFERRED]:** —; related to F137’s concurrent write, but a distinct rejection-handling defect.

**F153**

1. **Verdict: REAL [INFERRED].** **[MEASURED]** Both search completions publish rows/footer after awaiting, and both catches modify the same surfaces. **[INFERRED]** Older requests can replace newer results.
2. **Where now [MEASURED]:** `assets/deckwave-libre.js:862`–865, line 955, lines 965–968, and line 1009.
3. **Fix size and risk [INFERRED]:** Small display-state fix under F133.
4. **Testable? Yes [INFERRED]:** Resolve older A after newer B; assert B’s rows/footer survive, including when A rejects.
5. **Duplicate of [INFERRED]:** F133.

**F154**

1. **Verdict: REAL [INFERRED].** **[MEASURED]** Speech stores the restore volume and sets `speechDucked`. Manual duck then returns at the existing-duck guard; speech completion subsequently restores and clears that same state. **[INFERRED]** The manual request acquires no lasting ownership.
2. **Where now [MEASURED]:** `assets/deckwave-events.js:179`, speech acquisition at lines 281–282, and restoration at line 313.
3. **Fix size and risk [INFERRED]:** Small ownership change. **HEARD-PATH:** changing duck depth or how long volume remains reduced requires the owner’s ear, even with constants unchanged.
4. **Testable? Yes [INFERRED]:** Speak, request manual duck, then finish speech. Assert manual duck ownership remains and restoration occurs only on unduck. A fake volume property verifies state/setter requests, not audible gain.
5. **Duplicate of [INFERRED]:** —.

| F-number | Verdict [INFERRED] | Priority [INFERRED] | Reason [INFERRED] |
|---|---|---:|---|
| F94 | REAL | 1 | Fix one display cleaner; cover hyphens and numeric title text. |
| F101 | REAL | 2 | Remove header-sized allocation and consolidate decoder cleanup. |
| F103 | FIXED | 3 | Merge already skips IDs present in the transaction’s key snapshot. |
| F106 | REAL | 2 | Permit retry after a failed vendor load. |
| F108 | REAL | 3 | Include digit preservation in F94; no separate build. |
| F111 | REAL | 2 | Readiness can resolve before initialization; address alongside loaders. |
| F115 | REAL | 3 | Same cleaner as F94; corpus prevalence remains carried. |
| F116 | REAL | 2 | Range envelopes are inconsistent; scheduling check and owner listening required. |
| F119 | REAL | 2 | Check encoder refusal after confirming the vendor return contract. |
| F120 | REAL | 2 | Deferred acquisition can retain an unwanted wake lock. |
| F121 | REAL | 2 | Revoke completed artwork URLs when switching off. |
| F122 | REAL | 2 | Stale media activation needs reconciliation and owner listening. |
| F123 | REAL | 1 | Prevent stale artwork callbacks from publishing obsolete metadata. |
| F127 | REAL | 2 | Deferred encoder throws can hang export and leak its handle. |
| F128 | REAL | 3 | Build decoder exception cleanup once under F101. |
| F130 | REAL | 2 | Reject non-improving fallback targets; selection changes need owner listening. |
| F132 | REAL | 1 | Stop issuing GPL labels from host identity alone. |
| F133 | REAL | 1 | Guard shared results/footer against stale successes and failures. |
| F134 | REAL | 3 | Remove incorrect catalogue counts during a documentation pass. |
| F135 | CAN'T-TELL | 3 | Confirm the engine contract under the broader F150 review. |
| F136 | REAL | 1 | Propagate fulfilled refusals instead of manufacturing success text. |
| F137 | REAL | 1 | Make the existing download cap terminate consumption promptly. |
| F140 | REAL | 2 | Scope progress events to each button’s downloads. |
| F141 | CAN'T-TELL | 3 | Panel configuration is needed; count work duplicates F134. |
| F143 | REAL | 3 | Partial replacement is real, but complete catalogues are the documented shape. |
| F144 | REAL | 3 | Duplicate of F133. |
| F145 | REAL | 3 | Duplicate of F137; cap reporting can itself be delayed. |
| F146 | REAL | 3 | Duplicate of F133; source selection alone does not launch a search. |
| F147 | CAN'T-TELL | 2 | Confirm ingest failure semantics, then display actual failure reasons. |
| F149 | REAL | 3 | Duplicate of F137; test consumer termination rather than cancel invocation. |
| F150 | CAN'T-TELL | 2 | Inspect authoritative engine position before changing pulse bookkeeping. |
| F151 | REAL | 1 | Await JSON consumption before freeing the limiter slot. |
| F152 | REAL | 2 | Handle cache rejection immediately; preferably fold into F137. |
| F153 | REAL | 3 | Duplicate of F133. |
| F154 | REAL | 2 | Transfer duck ownership explicitly; owner listening is required. |