1. **INFERRED — REAL: buffered tail loss. HEARD PATH.**

   **MEASURED —** Empty input returns before extraction (`assets/deckwave-stretch.js:91`); release stops processing (`:80–85`). Source `ended` calls `releaseDeck`, which immediately disconnects the entire chain (`assets/deckwave.js:1182–1185`, `:1212–1213`). This also defeats draining on the plain-worklet fallback.

   **CAN'T-TELL —** The precise lost duration and reported 2,470-frame reproduction are not established by an executed result here. “The source ended” does not establish that downstream buffers emptied.

   **INFERRED — Offline:** Specify `node tools/check-stretch-eof.js`, using built-in `vm`/`assert`, the actual module, zero-initialized output blocks, and an asynchronous fake port/host lifecycle. Feed a finite signal with a distinctive terminal marker; separately test already-buffered output followed by zero-channel input. Require the marker and queued frames to emerge before teardown. **Old fails** at the guard and immediate disconnect; a complete drain protocol passes. A fixed delay could pass one fixture while still truncating other rates or inventing trailing silence. **Falsifier:** current-source execution preserves all known buffered terminal audio through EOF and teardown. This cannot establish browser scheduling or audibility.

   **INFERRED — Listen, about 60 seconds:** Prepare a one-track set containing a 10-second excerpt with a short, recognizable final note and no trailing silence. Start directly at ×1, with no successor. At 0 seconds press Play on the original reference; at 15 seconds press Play on the set; repeat at 30/45 seconds. Listen specifically for the final note’s completeness. Shorter only in Deckwave → consider draining; indistinguishable → defer the audible change, without declaring the mechanism fixed; reference also truncated → replace the fixture.

   **INFERRED — HEARD PATH, smallest first:** Separate source EOF from audible completion; retain the downstream path until queued audio finishes, then release. Completing an unfinished WSOLA window needs an explicit endpoint policy. Padding that changes the correlation search’s input crosses the detector-input restriction; stop at describing that requirement.

2. **INFERRED — REAL for multichannel input delivered to the worklet; CAN'T-TELL end to end. HEARD PATH.**

   **MEASURED —** The wrapper reads and writes only the first two channels (`assets/deckwave-stretch.js:92–95`). The Player supplies no channel options (`assets/deckwave.js:1201`).

   **CAN'T-TELL —** The decoder implementation is absent, as is an observed browser channel negotiation. The claim that this corpus is entirely stereo is also unverified.

   **INFERRED — Offline:** Specify `node tools/check-stretch-channels.js`: capture the actual node-constructor options, apply a declared Web Audio speaker-mixing reference, then run the real processor on channel-isolated fixtures. Check centre and surrounds against the reference, plus independent L/R and mono controls. **Old fails** the centre-only case under the default six-channel model; explicit stereo speaker mixing before this stereo processor passes. Copying the centre indiscriminately could pass a centre-only test, hence the other fixtures. **Falsifier for the deployed claim:** a centre-only six-channel buffer already survives the current browser graph. Node cannot prove browser negotiation; verify that separately by rendering and inspecting samples. LFE omission alone is not a defect in a standard stereo downmix.

   **INFERRED — Listen, about 45 seconds:** Prepare a short six-channel excerpt with isolated centre content and its intended stereo downmix. Direct-start each at ×1: reference Play at 0 seconds, multichannel Play at 12 seconds; repeat once. Missing centre only in multichannel → pursue the render-channel contract; equal → investigate actual negotiation before changing code; both missing → invalid reference.

   **INFERRED — HEARD PATH, smallest first:** An explicit stereo speaker input/output contract is the smallest graph-level candidate. It changes the samples entering WSOLA’s correlation search, so under the detector-input restriction this remains a description, not an implementation recommendation.

3. **INFERRED — REAL: Lanczos boundary clamping; group both Lanczos findings. HEARD PATH.**

   **MEASURED —** Negative taps reuse one previous frame; future taps reuse the last frame (`assets/deckwave-stretch.module.js:570–574`). The radius-four kernel requires more support (`:584–600`), but the transposer consumes each chunk and retains one frame (`:852–861`, `:912–923`).

   **CAN'T-TELL —** The quoted error amplitudes and audibility have not been reproduced here.

   **INFERRED —** “WSOLA windows are identical either way” is not established: changing transposer output can change the subsequent correlation search.

   **INFERRED — Offline:** Specify `node tools/check-lanczos-boundaries.js`: compare the actual transposer against a full-history reference using the existing kernel, at compensation rates `1/r` for `r = 1, 1.0012, 1.02, 0.98`. Use deterministic signals and several chunk partitions; compare internal boundaries, excluding genuine stream endpoints. **Old fails** where unavailable taps are clamped; correct support passes within numerical precision. A bypass can pass partition-invariance alone, so also check the requested resampling phase/rate against the reference. Constant-rate success still leaves ramp handling untested. **Falsifier:** supported-boundary outputs agree with the reference to numerical precision. This settles sample errors, not their audibility.

   **INFERRED — Listen, under two minutes:** Prepare equal-level A/current and B/full-history-reference renders of the same bright, sustained, harmonic-rich excerpt, at ×1.02 and ×0.98, plus a unity control. For each rate press A Play for eight seconds, then B Play for eight seconds, then repeat. Listen for added ticks, fizz or roughness. B consistently cleaner → record the preference; no repeatable difference → defer; B worse → reject that reference. Unity should not provide the claimed distinction.

   **INFERRED — HEARD PATH:** Supplying true history and look-ahead addresses the identified mechanism without changing kernel parameters. It can add latency and, in transposer-first operation, changes what WSOLA’s correlation search sees. That reaches the detector-input restriction; stop there.

4. **INFERRED — REAL: topology switches retain state; CAN'T-TELL the claimed click magnitude and current Player trigger. HEARD PATH.**

   **MEASURED —** Stage order switches at `_rate > 1` (`assets/deckwave-stretch.module.js:1709–1728`), while interpolation phase/history remain stateful (`:912–923`). The wrapper derives pitch compensation from playback rate (`assets/deckwave-stretch.js:102–105`).

   **INFERRED —** Both crossing directions warrant examination. With neutral pitch, crossing downward through playbackRate 1 changes topology; crossing upward does too. Transposer history is only part of the concern: queued samples and stretch history also belong to the preceding topology.

   **CAN'T-TELL —** `changeRate`, transition scheduling and settle behavior are outside the supplied Player excerpt. The “settle is unaffected” conclusion cannot be certified.

   **INFERRED — Offline:** Specify `node tools/check-stretch-crossing.js`: run the real module with deterministic smooth input and both ramp directions, recording stage-buffer identities, history provenance, queued-frame accounting and output around the switch. Require state/backlog ownership to remain coherent and requested compensation to remain active. **Old fails** the history-provenance requirement; a coherent transition passes. Merely resetting history can pass a reset-only assertion while introducing a hole: that assertion is decoration as a no-click check. **Falsifier for the audible reproduction:** controlled event-aligned renders show no added discontinuity at the crossing. Comparing against the track’s largest transient elsewhere is not a valid falsifier—it can conceal a smaller click.

   **INFERRED — Listen, under two minutes:** Prepare eight-second crops around the *rendered* crossing from a 16-second ×1.016→×0.988 ramp, its reverse, and a nearby no-crossing control. Use a sustained passage without native transients; retain the actual outgoing gain envelope. Mark the crossing window visually. Play control/downward/reverse in that order, then repeat. Crossing-only tick → prioritize state transition work; tick in all three → investigate the source or another mechanism; none → defer the audible change.

   **INFERRED — HEARD PATH:** The smallest defensible requirement is a transition preserving phase, queued audio and each stage’s history at the existing boundary. Reconstructing WSOLA input/history changes the correlation search’s evidence; stop at that boundary. Neither a history reset nor moving the unity boundary is an established fix.

5. **CAN'T-TELL — double header tooltips.**

   **MEASURED —** Current code tags the five header labels and opens `glpop` on hover (`assets/deckwave-dashboard.js:2840–2845`, `:2859`, `:2889–2893`).

   **CAN'T-TELL —** The other tooltip constructor, relevant CSS, initialization calls and term contents are absent. The supplied excerpt cannot establish REAL or FIXED for simultaneous boxes.

   **INFERRED — Without ears:** Inspect computed visibility in the actual shadow DOM while hovering each header label for two seconds. **Falsifier:** exactly one visible box while its glossary term resolves. A bare-node fake DOM cannot establish CSS hover visibility; no old-fails/new-passes regression check is justified from this excerpt.

   **INFERRED — Action:** No listening session. If two boxes appear, choose one tooltip owner while retaining the intended definitions. The existing map audit checks registration/resolution, not popup exclusivity (`assets/deckwave-dashboard.js:2871–2884`); treating a clean audit as coverage here is decoration.

6. **INFERRED — REAL: the uncalibrated colour threshold remains; its warning interpretation needs visual judgment.**

   **MEASURED —** The series uses FFT values and the chosen offset (`assets/deckwave-panels.js:292–302`); the comment explicitly disclaims calibration (`:305–317`); amber still depends on `mean > -12` (`:327`).

   **INFERRED —** With input bytes bounded by 255, this formula cannot produce the scenario’s −9.8 reading: its maximum is −10. The amber branch nevertheless remains reachable.

   **INFERRED — Without ears:** Run the registered callback in a node VM with a recording canvas and fresh histories. All-255 and all-zero frequency fixtures expose the readout and colour behavior directly. This is characterization, not an old-fails/new-passes regression check. **Falsifiers:** a documented calibration can defeat the unsupported-reference allegation; an explicitly non-warning product meaning can defeat the warning interpretation. Neither changes the presence of the branch. A corpus scan cannot establish calibration by agreement alone.

   **INFERRED — Action:** No listening session can calibrate this scale. Removing or replacing the level-dependent colour changes threshold behavior; stop at describing that choice. No replacement number is proposed.

7. **CAN'T-TELL — the complete sprite/menu contradiction; MEASURED — the named duck remains.**

   **MEASURED —** The excerpt explicitly identifies Darkwing and defines `label: 'darkwing'` (`assets/deckwave-sprites.js:10–12`, `:25`).

   **CAN'T-TELL —** Rocinante, menu registration, the contradictory panel comment and any keeper decision are outside the supplied excerpts.

   **INFERRED — Without ears:** Capture the complete registered sprite/menu inventory and inspect the actual artwork beside the policy text. **Falsifiers:** absent public-menu entries defeat the menu claim; absent or qualified policy wording defeats the alleged contradiction. A keeper approval changes acceptability, not whether contradictory text exists.

   **INFERRED — Action:** No listening session. If retained, make the policy description accurate; if unwanted, review both artwork and naming. A forbidden-name check alone is decoration for likeness: renaming identical pixels passes it. No complete regression contract can be specified from this excerpt.

8. **INFERRED — REAL: final metrics can be lost; FIXED: posted fade metrics no longer freeze at handover.**

   **MEASURED —** The wrapper posts only every 100 processed blocks and does not flush on release (`assets/deckwave-stretch.js:80`, `:125–134`). The Player immediately removes its handler (`assets/deckwave.js:1184`). However, posted fade metrics now update the handed-over tally (`:1231–1242`), with a fade log on source end (`:1216–1221`).

   **INFERRED — Offline:** Specify `node tools/check-stretch-final-metrics.js`: prime the real wrapper, force an underrun at processed block 150, end at 199, and exercise asynchronous delivery through the actual teardown/tally logic. Require the final cumulative count to arrive and be counted exactly once, including duplicate-message handling. **Old fails** because no final report survives; final reporting plus receiver reconciliation passes. A worklet-only flush still fails this combined check because the current handler disappears. **Falsifier:** current source delivers and accounts for the injected final gap.

   **INFERRED — Action, no ears:** Final cumulative reporting and reconciliation can preserve existing gain, disconnect and processing schedules. Delaying audible release to solve telemetry would instead be **HEARD PATH** and belongs with item 1. Zero reported gaps cannot exclude Lanczos errors or topology-switch discontinuities.

9. **INFERRED — REAL: zero-skip configuration cannot make normal processing progress.**

   **MEASURED —** Equality between sequence and overlap lengths is allowed; it makes `nominalSkip` zero (`assets/deckwave-stretch.module.js:1239–1248`). The loop continues while input remains sufficient (`:1481`), while advancement consumes zero frames (`:1504–1508`). Runtime updates reach this setter (`:1291–1317`, `:1819`).

   **CAN'T-TELL —** Current UI reachability and the claim that the entire AudioContext necessarily goes silent are not established. Allocation failure may terminate execution before a literal infinite run.

   **INFERRED — Offline:** Specify `node tools/check-stretch-progress.js`: use the real worklet in a bounded worker, warm it up, send `{sequenceMs:8, overlapMs:8}`, then supply sufficient input. Require rejection to preserve the previous valid state and subsequent output; also exercise accepted updates and rounded-equality cases. **Old fails** through non-progress; atomic rejection passes. Returning early or disabling all updates can pass a termination-only check, so that check is decoration without those controls. **Falsifier:** current processing returns normally with bounded storage and continued valid output.

   **INFERRED — Action, no ears:** Reject the non-progressing configuration atomically. This is an invariant check, not choosing a new minimum skip or retuning windows. **HEARD PATH only for the invalid request:** continued audio replaces the failure; valid configurations should remain unchanged.

**MEASURED — Existing instrument limits:** `tools/measure-worklet.js` discards posted messages (`:35`), holds playback rate constant within each drive (`:73`), always supplies nonempty stereo input (`:79`), and counts only underrun increments after block 300 (`:80`). Its tables do not assert regression success (`:89–109`).

**INFERRED —** Those measurements are useful for steady-rate underflow. Using their successful completion or “zero gaps” to exclude EOF loss, channel loss, final-report loss, boundary errors or switching clicks is decoration. The header’s equal sine/real counts support its cadence hypothesis; differing counts would be the falsifier (`tools/measure-worklet.js:24–25`). Actual `check-player` and `check-panels` implementations are **CAN'T-TELL**, because they were not supplied.

**INFERRED — Keeper listening order, cheapest first:**

1. One direct-start ×1 session: multichannel/reference comparison if relevant files exist, then terminal-note comparison.
2. One bright stereo excerpt: constant-rate Lanczos comparisons, then crossing/control crops.
3. No ear time for metrics, loop termination, tooltips, loudness semantics or sprites; settle their mechanical or visual questions separately.