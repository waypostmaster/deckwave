**F39**

1. **Verdict:** [INFERRED] **CAN'T-TELL** for concurrent renders. [MEASURED] Manual inspection finds a working button guard at `assets/deckwave-dashboard.js:1465`. In the render handler, the corresponding operations are a colour change, an awaited `exportMix()` call, and colour restoration; that handler permits repeated calls. [CARRIED—brief F39] The renderer itself has no running gate. [INFERRED] Confirming that requires the current `DWRENDER.exportMix()`, `render()`, and their module-level state.
2. **Where now:** [MEASURED] `assets/deckwave-dashboard.js:2280`, `assets/deckwave-dashboard.js:2289`, `assets/deckwave-dashboard.js:2296`.
3. **Fix size and risk:** [INFERRED] Small, low-risk button mutual exclusion if still needed; renderer-wide exclusion needs the missing module review.
4. **Testable?** [INFERRED] **Yes for the button:** hold a fake export pending, activate twice, and assert one export invocation; then verify recovery after success and rejection. This distinguishes button behavior, not actual concurrent rendering. [MEASURED] This pass reads supplied text only; no checks were executed.
5. **Duplicate of:** [INFERRED] None.

**F40**

1. **Verdict:** [INFERRED] **REAL.** [MEASURED] The empty-set branch supplies finite line coordinates, but the nonempty branches divide both plot indices and the marker index by `n - 1`. [INFERRED] A one-track set therefore supplies `NaN` x-coordinates. Merely replacing the divisor is incomplete: a path containing only `moveTo()` still needs a dot or segment to show the track when there is no active marker.
2. **Where now:** [MEASURED] `assets/deckwave-dashboard.js:790`, `assets/deckwave-dashboard.js:794`, `assets/deckwave-dashboard.js:800`, `assets/deckwave-dashboard.js:809`.
3. **Fix size and risk:** [INFERRED] Small, display-only; explicitly draw the solitary track at a finite position.
4. **Testable?** [INFERRED] **Yes:** record canvas operations for a one-track set, both active and stopped. Assert finite coordinates and visible point/segment geometry, rather than accepting an isolated `moveTo()`.
5. **Duplicate of:** [INFERRED] None.

**F41**

1. **Verdict:** [INFERRED] **CAN'T-TELL** for the complete interruption/restart claim. [MEASURED] With truthy `st.now`, the handler returns for `suspended` and `running`; an `interrupted` input reaches the prepared/raw play branches. [CARRIED—brief F41] Real interrupted contexts reach `DW.state.ctx`, `DW.pause()` resumes them, and `DW.play()` restarts the set. [INFERRED] Confirming those requires the current state accessor, `Player.play()`, `Player.pause()`, and interruption handling; the reported iPhone state also needs device observation.
2. **Where now:** [MEASURED] `assets/deckwave-dashboard.js:1687`, `assets/deckwave-dashboard.js:1695`, `assets/deckwave-dashboard.js:1702`.
3. **Fix size and risk:** [INFERRED] Small dispatch change, **HEARD-PATH**: resume versus restart changes playback and track position, requiring the owner's ear. The proposed blanket non-running condition also needs a deliberate policy for `closed`.
4. **Testable?** [INFERRED] **Yes for dispatch:** supply an interrupted state with a current track and assert one resume call and no prepared/raw play call. It fails this handler, but cannot establish iPhone behavior or audible continuity.
5. **Duplicate of:** [INFERRED] None.

**F42**

1. **Verdict:** [INFERRED] **FIXED.** [MEASURED] After the listen-source early return, `stereoSource()` now calls `splitDeck()` unconditionally. `splitDeck()` compares both context and source identity before retaining the existing split.
2. **Where now:** [MEASURED] `assets/deckwave-dashboard.js:711`, `assets/deckwave-dashboard.js:738`.
3. **Fix size and risk:** [INFERRED] No further fix indicated; the caller now reaches the existing analyser-refresh logic.
4. **Testable?** [INFERRED] **No new failing check for the reported defect.** A regression replacing the source analyser/context and asserting that returned analysers follow it should already pass; it would test identities, not live meter movement.
5. **Duplicate of:** [INFERRED] None.

**F45**

1. **Verdict:** [INFERRED] **FIXED.** [MEASURED] The shadow stylesheet now contains `.tp [hidden]{display:none!important}`. The phone drawer's `display:inline-block` declaration remains non-important. [INFERRED] The added rule wins for the hidden re-link button.
2. **Where now:** [MEASURED] `assets/deckwave-dashboard.js:169`, `assets/deckwave-dashboard.js:435`, `assets/deckwave-dashboard.js:1598`.
3. **Fix size and risk:** [INFERRED] No further fix indicated; the existing correction is display-only.
4. **Testable?** [INFERRED] **No new failing check identified.** The proposed CSS assertion should already pass. A browser check can additionally verify computed display at phone width, but bare Node does not perform CSS layout.
5. **Duplicate of:** [INFERRED] None.

**F46**

1. **Verdict:** [INFERRED] **REAL.** [MEASURED] Manual call inspection finds `regroup()` and `applyCfg()` together at transport initialization. By comparison, the complete `rebuildViews()` body removes the old wrapper and calls `select()`, whose insertion point is `logLine`. [INFERRED] After saving or importing, the replacement consequently follows the Troubleshoot controls instead of retaining its Look position.
2. **Where now:** [MEASURED] `assets/deckwave-dashboard.js:2169`, `assets/deckwave-dashboard.js:1391`, `assets/deckwave-dashboard.js:2470`.
3. **Fix size and risk:** [INFERRED] Small, display-only: preserve the wrapper's position and reapply drawer visibility, including when asynchronous import finishes after the drawer closes.
4. **Testable?** [INFERRED] **Yes:** after save/import, assert that the view wrapper remains between the Look heading and the following section heading. Also finish an import with Settings closed and assert that the replacement remains hidden.
5. **Duplicate of:** [INFERRED] None; F55 repeats this defect.

**F47**

1. **Verdict:** [INFERRED] **REAL, with narrower wording.** [MEASURED] The native select dispatches actions through `onchange`. Inspection finds an explicit selection reset in the output handler, while view reset/export return directly. Successful view save/import do rebuild the selector with the first view selected, so “each sticks” overstates the code. [INFERRED] Reset/export remain subject to unchanged-selection behavior, and the initially selected view lacks an explicit reload action. [CARRIED—brief F47] The specific closed-select arrow-key behavior on Chromium/Windows was not independently observed here.
2. **Where now:** [MEASURED] `assets/deckwave-dashboard.js:1387`, `assets/deckwave-dashboard.js:2099`, `assets/deckwave-dashboard.js:2140`, `assets/deckwave-dashboard.js:2169`.
3. **Fix size and risk:** [INFERRED] Small-to-medium UI change. Explicit action buttons and an explicit load operation address the full finding; resetting the selected value alone does not.
4. **Testable?** [INFERRED] **Yes:** inspect the constructed controls and assert that one-shot actions are independently activatable controls rather than native options, and that the currently selected view has an explicit load operation. Those structural assertions fail now. Actual keyboard event behavior needs a browser.
5. **Duplicate of:** [INFERRED] None; F46 concerns placement, not activation.

**F48**

1. **Verdict:** [INFERRED] **REAL as a user-facing documentation contradiction.** [MEASURED] `kKey.d` unconditionally says relative major/minor; the executable tune-option text says parallel for deckwave and relative for standard. The header builder appends that description as a `.tip`, which the hover rule displays. [CARRIED—brief F48] The actual engine mapping and the correctness of the separate `DWMSG` definition remain external claims. [INFERRED] Certifying those additionally requires the current key tables/scoring and `DWMSG.term('key')` definition.
2. **Where now:** [MEASURED] `assets/deckwave-dashboard.js:2640`, `assets/deckwave-dashboard.js:2076`, `assets/deckwave-dashboard.js:2078`, `assets/deckwave-dashboard.js:2656`, `assets/deckwave-dashboard.js:285`.
3. **Fix size and risk:** [INFERRED] Small, text-only reconciliation of the documented tunes.
4. **Testable?** [INFERRED] **Yes:** assert that the header description qualifies parallel with deckwave and relative with standard. The current unconditional statement fails that requirement.
5. **Duplicate of:** [INFERRED] None; F52 and F59 repeat this defect.

**F49**

1. **Verdict:** [INFERRED] **REAL for the shown session/UI race.** [MEASURED] Apply disables itself before awaiting; Discard clears `prepared`. The pending operation retains `candidate` and commits it when the player succeeds with that order. The identity check in `consume()` protects a replacement preparation; it does not prevent committing a discarded candidate. [INFERRED] A successful pending play can therefore commit after the UI announces discard. Actual cold-start audio timing requires the current `Player.play()` implementation.
2. **Where now:** [MEASURED] `assets/deckwave-dashboard.js:517`, `assets/deckwave-dashboard.js:524`, `assets/deckwave-dashboard.js:528`, `assets/deckwave-dashboard.js:692`, `assets/deckwave-dashboard.js:701`.
3. **Fix size and risk:** [INFERRED] Small shared pending-operation guard, bookkeeping-only. It must cover both Apply/Play prepared and the main ▶ prepared branch; disabling Discard only inside the Apply handler leaves the other entry point exposed.
4. **Testable?** [INFERRED] **Yes:** hold playback pending from each entry point and assert that Discard is disabled or refuses without clearing the candidate; assert availability returns after completion and rejection. Current behavior fails the pending assertion.
5. **Duplicate of:** [INFERRED] None.

**F50**

1. **Verdict:** [INFERRED] **REAL.** [MEASURED] The duration expression concatenates integer hours, `h`, and the raw minute remainder. [INFERRED] For `runtimeMin = 65`, its duration fragment is `1h5`.
2. **Where now:** [MEASURED] `assets/deckwave-dashboard.js:1522`.
3. **Fix size and risk:** [INFERRED] Tiny, display-only formatting change; suitable for bundling with other UI work.
4. **Testable?** [INFERRED] **Yes:** drive the build handler with an inspection result containing `runtimeMin = 65` and require the agreed format, such as `1h05m`, in its log.
5. **Duplicate of:** [INFERRED] None.

**F51**

1. **Verdict:** [INFERRED] **CAN'T-TELL** for the complete after-stop claim. [MEASURED] The header falls back to `set[s.idx]`; position and arc marking use `s.of`. By contrast, the shown blend guard uses `state.now`. [CARRIED—brief F51 and the source comment beside `blend()`] Stop clears the decks while retaining order/index. [INFERRED] Confirmation requires current `stop()`, `state`, `deck`, and `nowMeta` accessors, plus the intended stopped-header behavior. [MEASURED] The supplied stretch display also still contains plan fallbacks, so this source does not independently substantiate the brief's “stretch was fixed” comparison.
2. **Where now:** [MEASURED] `assets/deckwave-dashboard.js:807`, `assets/deckwave-dashboard.js:837`, `assets/deckwave-dashboard.js:839`, `assets/deckwave-dashboard.js:862`, `assets/deckwave-dashboard.js:1219`.
3. **Fix size and risk:** [INFERRED] Small if confined to stopped-display predicates. Changing the separately mentioned `applyRoute()` predicate affects calls to `reorder()` and needs **HEARD-PATH** review.
4. **Testable?** [INFERRED] **Yes, conditionally:** supply a stopped fixture with retained order/index and assert cleared live header fields and no deck marker. This fails the shown display code under that policy; the missing engine must establish that stop produces the fixture.
5. **Duplicate of:** [INFERRED] None.

**F52**

1. **Verdict:** [INFERRED] **REAL** for the same documentation contradiction as F48. [MEASURED] The unconditional relative-key definition and the deckwave parallel-key hint both remain. [CARRIED—brief F52] The actual `camScore` behavior has not been independently confirmed from engine source.
2. **Where now:** [MEASURED] `assets/deckwave-dashboard.js:2640`, `assets/deckwave-dashboard.js:2076`.
3. **Fix size and risk:** [INFERRED] Covered by F48's text-only correction; no separate implementation.
4. **Testable?** [INFERRED] **Yes:** use F48's qualified-definition assertion.
5. **Duplicate of:** [INFERRED] **F48.**

**F54**

1. **Verdict:** [INFERRED] **REAL.** [MEASURED] As a positive control, view loading explicitly schedules `dash.applyFolds()`. Inspection of the slot swap handler, window handler, `paint()`, and its glossary-tag callback instead finds repaint/save/fit and glossary work, without fold application. The fold writer reads persisted state by the new `s.panel`. [INFERRED] The cell can retain the previous panel's collapsed state until a click toggles the new panel's state.
2. **Where now:** [MEASURED] `assets/deckwave-dashboard.js:2521`, `assets/deckwave-dashboard.js:2584`, `assets/deckwave-dashboard.js:2771`, `assets/deckwave-dashboard.js:2774`; positive control at `assets/deckwave-dashboard.js:2708`.
3. **Fix size and risk:** [INFERRED] Small, display/bookkeeping-only; centralize fold refresh across panel changes, including the exposed `slots.set()` path.
4. **Testable?** [INFERRED] **Yes:** persist opposite fold states for two panels, switch between them through both controls, and assert immediate agreement of `.collapsed`, glyph, label, and `aria-expanded`. Then assert the first fold click visibly reverses the state.
5. **Duplicate of:** [INFERRED] None; F57 repeats this defect.

**F55**

1. **Verdict:** [INFERRED] **REAL.** [MEASURED] The replacement view selector is inserted before `logLine`, while grouping and visibility application occur at initialization. [INFERRED] The finding's additional assurance that its group automatically keeps it hidden is too broad: rebuilding after an asynchronous import finishes with Settings already closed creates a wrapper without the old inline hiding style.
2. **Where now:** [MEASURED] `assets/deckwave-dashboard.js:2169`, `assets/deckwave-dashboard.js:1391`, `assets/deckwave-dashboard.js:2414`, `assets/deckwave-dashboard.js:2470`.
3. **Fix size and risk:** [INFERRED] Covered by F46's position-and-visibility correction; display-only.
4. **Testable?** [INFERRED] **Yes:** share F46's section-order and closed-drawer import checks.
5. **Duplicate of:** [INFERRED] **F46.**

**F57**

1. **Verdict:** [INFERRED] **REAL.** [MEASURED] The same swap/window handlers repaint the panel while the fold implementation derives state from panel identity. [INFERRED] This is the same stale-cell-state defect described in F54.
2. **Where now:** [MEASURED] `assets/deckwave-dashboard.js:2523`, `assets/deckwave-dashboard.js:2585`, `assets/deckwave-dashboard.js:2774`.
3. **Fix size and risk:** [INFERRED] Covered by F54's display/bookkeeping correction.
4. **Testable?** [INFERRED] **Yes:** share F54's immediate-state and first-click assertions.
5. **Duplicate of:** [INFERRED] **F54.**

**F58**

1. **Verdict:** [INFERRED] **FIXED.** [MEASURED] `prepare()` now calls `dash.setMini(false)`. That painter updates the app's `mini` class, the host's `mini-host` class, the nowline's inline display, and the compact button's text and class.
2. **Where now:** [MEASURED] `assets/deckwave-dashboard.js:1277`, `assets/deckwave-dashboard.js:2246`, `assets/deckwave-dashboard.js:2255`.
3. **Fix size and risk:** [INFERRED] No further fix indicated; the existing correction synchronizes display state.
4. **Testable?** [INFERRED] **No new failing check for this defect.** Compact → prepare assertions for both classes, hidden nowline, `– compact` text, and an unlit button should already pass.
5. **Duplicate of:** [INFERRED] None.

**F59**

1. **Verdict:** [INFERRED] **REAL** for the same documentation contradiction as F48. [MEASURED] The header definition remains unconditional while the tune options distinguish parallel from relative. [CARRIED—brief F59] The cited `CLAUDE.md` and ledger history are not independent evidence from this pass.
2. **Where now:** [MEASURED] `assets/deckwave-dashboard.js:2640`, `assets/deckwave-dashboard.js:2076`, `assets/deckwave-dashboard.js:2078`.
3. **Fix size and risk:** [INFERRED] Covered by F48's text-only correction; stating both tunes avoids maintaining another live mode-dependent description.
4. **Testable?** [INFERRED] **Yes:** share F48's qualified-definition assertion.
5. **Duplicate of:** [INFERRED] **F48.**

**F96**

1. **Verdict:** [INFERRED] **CAN'T-TELL for the compound finding; the percentage-label part is FIXED.** [MEASURED] The unreachable row now prints `would need about ` followed by the value and ` hops`. As a positive control, other rows still visibly call `pct()`. [CARRIED—brief F96] The downward estimate uses the upward gain and understates the count. [INFERRED] Resolving that remainder requires the current DWNAV definitions of `hopsNeeded()`, `perHopGain()`, `plan()`, and every caller of the estimate.
2. **Where now:** [MEASURED] `assets/deckwave-dashboard.js:1158`; percentage-formatting control at `assets/deckwave-dashboard.js:1116`. [INFERRED] A current estimator line cannot be assigned from the supplied dashboard text.
3. **Fix size and risk:** [INFERRED] No label work remains. Estimator scope is unknown: route-selection effects would be **HEARD-PATH**; changing `DRIFT` or `GATE` would be **THRESHOLD** work requiring measurement.
4. **Testable?** [INFERRED] **No demonstrated current failure for remaining work.** The hops-label regression should already pass; an estimator assertion needs its current implementation and established downward recurrence first.
5. **Duplicate of:** [INFERRED] None.

| F-number | Verdict [INFERRED] | Priority [INFERRED] | One-line reason [INFERRED] |
|---|---|---:|---|
| F39 | CAN'T-TELL | 2 | Button permits duplicate calls; inspect renderer exclusion before declaring duplicate renders. |
| F40 | REAL | 2 | One-track geometry needs finite coordinates and an actual visible point or segment. |
| F41 | CAN'T-TELL | 2 | Interrupted input falls through; establish engine behavior before a HEARD-PATH change. |
| F42 | FIXED | 3 | Unconditional split refresh reaches the existing identity check. |
| F45 | FIXED | 3 | The important hidden rule overrides the phone drawer display rule. |
| F46 | REAL | 2 | Preserve the view control's section and drawer visibility during rebuilding. |
| F47 | REAL | 2 | Explicit actions and loading solve more than resetting the select value. |
| F48 | REAL | 1 | A small text correction removes contradictory explanations of the key notation. |
| F49 | REAL | 1 | Shared pending-state handling prevents Discard from contradicting an accepted play. |
| F50 | REAL | 3 | Cosmetic duration formatting; bundle rather than prioritize separately. |
| F51 | CAN'T-TELL | 2 | Confirm stopped engine state and display policy before changing the predicates. |
| F52 | REAL | 3 | Duplicate of F48; one correction covers both. |
| F54 | REAL | 2 | Refreshing folds makes the displayed state and first click agree. |
| F55 | REAL | 3 | Duplicate of F46; include asynchronous drawer visibility in that fix. |
| F57 | REAL | 3 | Duplicate of F54; share its implementation and check. |
| F58 | FIXED | 3 | Preparation now exits compact mode through the shared painter. |
| F59 | REAL | 3 | Duplicate of F48; no separate tune-aware implementation needed. |
| F96 | CAN'T-TELL; label FIXED | 3 | Label work is complete; estimator arithmetic remains unverified. |