1. **INFERRED — REAL: fade-in reset. The fable and opus reports are duplicates. HEARD PATH.**

   **MEASURED —** `cancelPending()` resets A’s gain to 1 and bass to 0 (`assets/deckwave.js:1409–1420`). Incoming ramps remain active after handover makes that deck A (`:1780–1786`, `:1858–1894`). Delaying the next exit does not prevent the reset.

   **INFERRED — Offline:** Propose `node tools/check-keeper.js`, using only `fs`, `vm`, and `assert`, executing the actual modules with recording AudioParams and a fake clock. At incoming start +2 seconds, after handover, complete a skip decode. Assert both envelopes retain their pre-press values **and continue to their original endpoints**, while the requested replacement is scheduled. Current source fails by writing 1/0; preserving the entry envelopes passes. Merely holding the current values is a wrong fix: it passes a continuity-only assertion but fails continued progression. Refusing every replan also needs an ordinary successful-replan control. **Falsifier:** the exercised cancellation preserves both complete entry envelopes. This instrument cannot establish audibility or worklet output.

   **MEASURED —** The existing “preserves the blend” check asserts position and rate only (`tools/check-reliability.js:98–102`). **INFERRED —** It is decoration for this gain/bass failure. **CAN'T-TELL —** `check-player.js` was not supplied.

   **INFERRED — Listen, 90 seconds:** Use three locked tracks with steady drums and audible bass, a plain build, settling off, and the existing 16-second fade. With records in `S`, press Enter on `DW.play(S)`; after five seconds, on `DW.blendNow(S[1])`. Two seconds after the incoming audio starts, press next. Require its decode to finish during the entry ramps. Repeat without that press. Listen for a press-associated level/bass jump. If unwanted, preserve/reconstruct the remaining incoming envelopes while removing only the superseded exit automation—the smallest fix. If the jump is wanted, retain it explicitly. If unheard, retain the scheduling finding but make no click/thump claim.

2. **INFERRED — FIXED: the stated `reorder({now:true})` decode race.**

   **MEASURED —** Current `reorder()` captures `gen` after cancellation and checks it after decode, before calling `chain()` (`assets/deckwave.js:2099–2127`). A successful intervening `queueNext()` cancels and advances that generation (`:2039–2051`, `:1383–1384`).

   **INFERRED — Offline:** In `check-keeper.js`, hold the reorder decode, complete `queueNext(Y)`, snapshot Y’s source and schedule, then resolve the old decode. Require `superseded`, unchanged Y identity/automation, and **no additional start** after that snapshot. The quoted older implementation would fail; the current guard should pass. An implementation refusing all reorders would also pass that case, so require an uncontested reorder to succeed. Do not require “only two sources ever started”: previously cancelled sources legitimately remain in the history. **Falsifier of FIXED:** the stale continuation starts another source or modifies Y’s schedule.

   **MEASURED —** The nearby documented regression condition checks list/deck identity (`assets/deckwave.js:2069–2070`). **INFERRED —** That condition alone is decoration for orphaned audio: identity can remain correct while an unreferenced source sounds.

   **INFERRED —** No keeper listening slot or additional cancellation is warranted for this interleaving. **CAN'T-TELL —** Archived-source execution results are unavailable.

3. **INFERRED — REAL: an untrusted BPM seeds playback after a jump/back. HEARD PATH.**

   **MEASURED —** `play()` assigns `tempo = m.bpm` (`assets/deckwave.js:1921–1923`); an unlocked outgoing track supplies that tempo to the next locked deck (`:1601–1611`). The planner also seeds an unlocked opener from its label (`:679–685`).

   **INFERRED —** For the supplied 120 → grid-unlocked 170 → locked 122 example, normal arrival starts the next deck at `120/122 ≈ .984`; jumping starts it at `170/122 ≈ 1.393`. Current automation then ramps toward `153.2/122 ≈ 1.256`, so “39% fast throughout” would be inaccurate. The planner-opener case can instead change order/reach annotations; it need not produce the identical playback stretch.

   **INFERRED — Offline:** Record source **and worklet** rate curves for normal arrival, same-set jump, and back. For a chosen “preserve trusted pre-jump target” contract, assert the exact trusted-target-derived curves. Current jump arithmetic fails; carrying that target passes. An arbitrary rate clamp is a wrong fix and fails those exact expectations. Use multiple seed tempos to reject a hard-coded replacement seed. **Falsifier:** these entry paths already produce the same trusted-target-derived curves. A corpus scan can establish exposure, but cannot establish the correct perceived tempo of an untrusted track.

   **INFERRED — Listen, three minutes:** Preselect a real flagged grid track whose label differs substantially from neighbouring locked tracks; use a clearly rhythmic locked successor. First arrive through the preceding locked track, then blend to that successor. Repeat by jumping directly to the grid track, then blending to the same successor. Compare the successor’s pace. If the jump produces an unwanted rush, carry the trusted target through same-set jump/back. If the new pace is intentional, document that jump policy. A fresh grid-unlocked opener needs a separate seed policy; this listening comparison does not choose one.

4. **INFERRED — REAL conditionally: early termination truncates the requested energy arc.**

   **MEASURED —** The denominator comes from requested/pool length (`assets/deckwave.js:662`), remains unchanged in `arc(i,n)` (`:688`), and tight builds can break early (`:719`). The arc’s release starts at normalized position .72 (`:418–420`).

   **INFERRED —** A result of length `L` enters that release region only when `(L−1)/(n−1) ≥ .72`. Targets are not measured musical energy: truncation does **not** prove every selected set only rises. **CAN'T-TELL —** The quoted corpus lengths and current audible endings cannot be revalidated from these files.

   **INFERRED — Offline:** Scan the actual corpus with the real sequencer; report requested `n`, placed `L`, target positions, and selected energies separately. **Falsifier of current-library exposure:** every relevant build reaches the release region. If a closed-arc policy is chosen, add a deterministic fixture with a reachable cluster and an unreachable remainder. Require the **selected order**, not merely reported targets, to reflect the unchanged arc over the accepted shorter length. Current ordering can fail; length-aware replanning can pass. Merely relabelling the denominator is a wrong fix that passes a target-only check.

   **INFERRED — Listen, two minutes:** Prepare short excerpts of the current final three tracks and an existing shorter requested-length build that actually reaches release. Play each ending sequence for 45 seconds. “The rising finish is right” means retain sequencing and clarify its promise. “I want a release” supports bounded length-aware replanning with existing scoring/gates. “Unclear” means defer. These excerpts cannot establish the shape of a multi-hour set. Any such replanning is **HEARD PATH**; changing arc constants or weights would change calibration, so stop there.

5. **INFERRED — REAL: the quiet-tail cap also governs the final track. Whether that ending is unwanted needs the keeper. HEARD PATH.**

   **MEASURED —** The no-successor path still uses the quiet cap (`assets/deckwave.js:1596–1615`); phrase planning also applies it (`:1649–1653`). The terminal branch writes the fade and stop (`:1722–1731`). Renderer planning applies its cap to every row (`assets/deckwave-render.js:66–76`). **CAN'T-TELL —** DWSCORE was not supplied.

   **INFERRED — Offline:** Use a valid cached loudness curve with a long quiet tail beginning after the existing dwell floor. Record live exit/stop and renderer-plan endpoints, once as a final track and once with a successor. **Falsifier:** the final track already receives the natural-end schedule despite that early quiet tail. For a terminal exemption, old source fails the final-track expectation and new source passes. Disabling quiet handling everywhere is a wrong fix that also passes the final-only case; retain the nonterminal control. This establishes scheduling, not whether the tail is musically valuable.

   **INFERRED — Listen, 90 seconds:** Prepare matched excerpts beginning five seconds before the quiet tail: current terminal output and the corresponding original audio, with comparable listening levels. Start before the fade to avoid F116 contaminating this comparison. Play 35 seconds of each. If the ambience should close the set, exempt only terminal exit planning from the quiet cap, retaining existing final-fade behavior. If the shortened ending is preferred, retain it and correct the “under the incoming track” explanation. If unclear, defer. No detector/cut change is needed for that terminal policy.

6. **INFERRED — REAL boundary/comment inconsistency: confidence exactly zero is excluded.**

   **MEASURED —** Confidence is rounded to three decimals (`assets/deckwave.js:354–355`); pool admission requires `conf > minConf`, defaulting to zero (`:607–611`). The comment says the default excludes nobody (`:623–625`). Pool-derived reporting cannot include records already filtered out (`:756–757`).

   **INFERRED — Offline:** Scan stored records for otherwise eligible zero-confidence tracks, and exercise the real planner with a synthetic eligible zero-confidence record beside an admitted control. **Falsifier of the filter finding:** that record is admitted under defaults. A proven detector invariant excluding zero would falsify real-analysis reachability; a corpus containing no zeros would not prove that invariant. **CAN'T-TELL —** Neither the claimed corpus minimum nor that detector invariant is supplied.

   **INFERRED —** No ear time is needed to settle the arithmetic or exposure. Admitting zero changes the confidence gate’s boundary; stop at describing that change. A reporting-only alternative can expose the excluded identity and correct the comment. Its regression must require the identity/reason while preserving existing membership: old reporting omits it, new reporting passes. Reporting only a count would also permit a wrong-record report.

7. **INFERRED — REAL: F23’s non-default drift contract remains inconsistent. HEARD PATH if playback is changed.**

   **MEASURED —** Planner stamps precede its `opts.drift` update (`assets/deckwave.js:735–740`); array metadata does not carry drift (`:754–758`). Player target calculation still uses `.35` (`:1608–1611`), with rate automation using that target (`:1760–1778`). **CAN'T-TELL —** Whether the option is currently documented.

   **INFERRED — Offline:** With settling off and a deterministic locked 120 → 124 → 126 order, record both decks’ source/worklet curves. Requested `.5` implies a first-transition endpoint of 122 BPM; current playback targets 121.4. The subsequent row’s planner stamps expose the divergence. **Falsifier:** actual scheduled curves follow the requested coefficient. A regression for an accepted support contract would fail current audio scheduling and pass an implementation honoring it. Updating only `tempoExact` is a wrong fix that passes the previously proposed state-only check; that check is decoration for audible-rate consistency.

   **INFERRED — Listening:** Do not compare two current builds with identical order: both use the same playback coefficient, so that audition cannot decide between coefficients. No ears are needed to establish the mismatch. The smallest contract decision is whether non-default requests should be supported or explicitly refused. Supporting them changes the effective playback drift coefficient; under the calibration rule, stop at describing that change. A discriminating listening script requires a separately authorized reference; none is supplied.

8. **INFERRED — REAL: F116’s range-start envelopes restart incorrectly. HEARD PATH, including exports.**

   **MEASURED —** Already-started tracks receive gain 1, fade-out restarts at clamped zero, and stop retains the original endpoint (`assets/deckwave-render.js:158–171`).

   **INFERRED — Offline:** Use a recording fake OfflineAudioContext with the real renderer. For `out=88`, `from=94`, `XF=12`, require outgoing gain `.5→0` over six seconds and incoming gain `.5→1` over six seconds, with correct source offsets and original endpoints. Current scheduling fails; clipping the original envelopes to the range passes. **Falsifier:** those original envelopes are already preserved. Merely postponing stop, or correcting only starting gain, is a wrong fix that passes one of the brief’s alternative falsifiers while retaining another failure. Check the complete envelopes. Natural buffer exhaustion may precede the recorded stop; a stop-call trace is not an audio capture.

   **MEASURED —** Existing render checks cover decode failures, source count, and context closure (`tools/check-reliability.js:198–208`). **INFERRED —** They are decoration for F116. Do not require post-compressor sample identity with a cropped full render: compressor history differs.

   **INFERRED — Listen, one minute:** Prepare a 20-second range starting halfway through a two-track crossfade, plus the corresponding passage from a render begun before that transition. Choose sustained music on both sides. Play each for 20 seconds; listen for excessive opening overlap and the outgoing cutoff around six seconds. If unwanted, clip both original envelopes—the smallest fix. If unheard, schedule inconsistency remains, but a click is unconfirmed.

9. **INFERRED — REAL: F122 permits stale media activation after off. HEARD PATH.**

   **MEASURED —** Media activation resumes after awaiting `outputStream(true)` without checking the desired mode; off only unwires an already-reported stream (`assets/deckwave-phone.js:360–375`). Mode applications can overlap (`:503–555`). The engine changes routing **after** awaiting boot (`assets/deckwave.js:1968–1978`).

   **INFERRED — Offline:** Run the real phone and Player modules with a deferred boot, destination-aware connection recorder, and fake media element. Wait until media has actually entered its pending stream request; then complete off, release boot, and drain continuations. Require speaker routing and a paused, detached audible element. Current source fails; serialized/reconciled application of the latest request passes. **Falsifier:** that exact interleaving already ends correctly. Merely checking mode before `a.play()` is a wrong fix: it can leave audio routed into an unplayed stream. Include an uncontested media-on control to reject “disable media” fixes. The instrument cannot establish device switching artifacts.

   **INFERRED — Listen, two minutes:** On the target device, use a desk-prepared reproducible boot barrier and a steady track. Request media; once the stream request is pending, request off; release boot and start playback. Then repeat media → off during established playback. Listen for silence, doubling, looping, or a routing click. Stale final routing calls for latest-request reconciliation; correct final routing with a transient problem needs separate investigation. A clean audition does not falsify the controlled race. Merely issuing both requests synchronously may miss it.

10. **INFERRED — REAL selection defect: F130’s fallback need not improve the requested direction. Actual route acceptance is CAN'T-TELL. HEARD PATH.**

   **MEASURED —** Direct selection compares against the current track, while fallback compares candidates only against each other (`assets/deckwave-events.js:116–126`). The result reaches route application (`:161–183`). Navigator/dashboard implementations are absent.

   **INFERRED — Offline:** Execute events with a fake navigator offering an accepted fast route even when every candidate is slower—or lower-energy for hype. Require neither blend nor route application and a directional explanation. Current source attempts the fallback; reusing the existing improvement predicate for fallback passes. **Falsifier:** such a candidate is already refused before route application. A blanket refusal would also pass, so include improving direct and routed controls, ties, and both directions. This tests intent semantics, not perceived energy or route sound.

   **INFERRED — Listen, up to three minutes:** Preselect a real playing track with only lower-BPM tracks ahead and a confirmed short available route to the highest of them. Hear 15 seconds, invoke `DWEVENTS.inject('faster')`, then hear the reached target. “Opposite of what I asked” supports the fallback direction guard. “Best available is wanted” supports retaining the fallback but explicitly reporting that compromise. If the route is refused or cannot finish within the slot, the audition did not exercise the audible failure. Hype/calmer additionally require the keeper to judge the constructed energy ranking.

11. **INFERRED — REAL: F154 drops manual duck ownership during speech. HEARD PATH.**

   **MEASURED —** Manual duck returns when `ducked` is occupied (`assets/deckwave-events.js:197–203`). Speech occupies it and sets `speechDucked` (`:300–304`); completion restores and clears that state (`:330–335`).

   **INFERRED — Offline:** Fake speech synthesis and record the real Player volume setter’s AudioParam calls. Start speech, request manual duck, fire speech completion, then unduck. For persistent manual ownership, require no completion-time restoration and exact restoration only on unduck. Current source fails; ownership transfer passes. **Falsifier:** manual duck already survives completion until unduck. Disabling every speech restoration is a wrong fix that passes this case; include speech-only restoration and manual-duck-before-speech controls. This cannot establish OS-level ducking or perceived depth.

   **INFERRED — Listen, 90 seconds:** On a steady track, invoke manual duck, listen five seconds, then unduck. Start a roughly ten-second spoken passage; two seconds into it invoke manual duck. Wait two seconds after speech ends, then unduck. If music should stay at the existing speech-duck level, the smallest fix transfers ownership while retaining that level and the original restore value. If it should assume the existing manual-duck depth, transfer ownership and apply the existing manual calculation. If automatic restoration is wanted, retain behavior and clarify the refusal. No duck constant needs changing.

**INFERRED — Keeper order, cheapest first:** batch F154 with F130 on the events surface; batch F116 with the final quiet-tail comparison using prepared clips; batch fade-reset and grid-jump comparisons on the live deck; then the device-specific F122 check. Audition arc endings only after the corpus scan finds exposure and a usable shorter comparison. Remove the fixed reorder race and confidence arithmetic from the listening queue. Hold F23 until its option contract and an authorized, discriminating reference are available.