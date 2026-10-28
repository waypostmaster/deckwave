**F60**

1. **Verdict:** [INFERRED] **REAL** for the blanket “never needed the network after load” claim. [MEASURED] The comment remains, and party mode can subsequently load scripts through `document.head.appendChild`. [CARRIED — F60 brief] Libre search and demo fetch behaviour was reported by the earlier reviewers; confirming those particular examples requires current `assets/deckwave-libre.js`.
2. **Where now:** [MEASURED] `index.html:10`, `index.html:11`; an independently readable counterexample is `assets/deckwave-popout.js:174`, `assets/deckwave-popout.js:175`, `assets/deckwave-popout.js:186` and `assets/deckwave-popout.js:187`.
3. **Fix size and risk:** [INFERRED] Tiny documentation change: acknowledge optional requests after startup. The proposed local-library exception should also account for lazy dependencies.
4. **Testable?** [INFERRED] **Yes**, as a proposed source check requiring the offline comment to acknowledge optional requests after load; the present wording fails that requirement.
5. **Duplicate of:** [INFERRED] None.

**F63**

1. **Verdict:** [INFERRED] **FIXED on the supplied surfaces.** [MEASURED] The glossary explicitly says PERIOD only, explains the wall-clock ticks, and disclaims audible downbeat positions; the verdict now reads `◉ PERIODS LOCKED`, and the panel hint says `periods, not phase`. [CARRIED — comment at `assets/deckwave-panels.js:875`] `docs/LISTENING.md` was also updated. [INFERRED] Its current §6 text is required to verify that remaining documentation claim.
2. **Where now:** [MEASURED] `assets/deckwave-panels.js:38`, `assets/deckwave-panels.js:985`, `assets/deckwave-panels.js:1059` and `assets/deckwave-panels.js:1083`.
3. **Fix size and risk:** [INFERRED] No further implementation needed for the shown claim; verify the listening documentation separately.
4. **Testable?** [INFERRED] **No new failing check established** on the shown surfaces: assertions for period-only wording already pass by inspection.
5. **Duplicate of:** [INFERRED] None.

**F64**

1. **Verdict:** [INFERRED] **REAL.** [MEASURED] The comment says `0.985/frame`; the update multiplies previous state by `.94` and adds `.06` of the new input. [INFERRED] That recurrence has an approximately 16-call e-folding time, approximately 0.27 seconds at 60 calls per second. “Per draw invocation” is more precise than “per frame.”
2. **Where now:** [MEASURED] `assets/deckwave-panels.js:472`, `assets/deckwave-panels.js:474`, `assets/deckwave-panels.js:482` and its caller at `assets/deckwave-panels.js:730`.
3. **Fix size and risk:** [INFERRED] Tiny comment correction; changing the coefficient or choosing a wall-time response would be **THRESHOLD/calibration** work requiring measurement.
4. **Testable?** [INFERRED] **Yes**: locate the `.94/.06` recurrence and require its adjacent documentation to describe those coefficients per invocation. The current comment fails.
5. **Duplicate of:** [INFERRED] None; F71 and F90 repeat this defect.

**F65**

1. **Verdict:** [INFERRED] **REAL at the drawing-function boundary.** [MEASURED] Centre peak decay and both ring-buffer advances execute per draw. [INFERRED] Different invocation rates therefore produce different state evolution. [CARRIED — comment at `assets/deckwave-popout.js:241`] The loop now suppresses dashboard drawing of a projected panel. [INFERRED] The original dashboard-plus-popout doubling scenario needs current `assets/deckwave-loop.js` to verify; it should not be repeated as independently confirmed.
2. **Where now:** [MEASURED] `assets/panel-centre.js:65`, `assets/panel-centre.js:77`; `assets/deckwave-panels.js:209` and `assets/deckwave-panels.js:299`.
3. **Fix size and risk:** [INFERRED] Medium display-state change; timed sampling is bookkeeping, but selecting the peak’s wall-time decay is **THRESHOLD/calibration** work. Assuming 60 Hz was intended is not a measurement.
4. **Testable?** [INFERRED] **Yes**: compare equal-duration schedules at different draw rates and repeated draws at identical timestamps; assert equal history advancement and equal peak decay after an initial impulse followed by silence.
5. **Duplicate of:** [INFERRED] None; F76 repeats the centre-decay portion.

**F68**

1. **Verdict:** [INFERRED] **REAL.** [MEASURED] As a positive inspection control, the energy history explicitly tests timestamp gaps and splits filled runs at `assets/deckwave-panels.js:1370` and `assets/deckwave-panels.js:1375`. Reading the named centre, timeline, drops and loudtime drawing loops instead shows adjacent samples joined according to index, without that gap predicate. [CARRIED — comment at `assets/deckwave-panels.js:1360`] Hidden-page painting stops. [INFERRED] Any interruption in these feeds suffices to expose the defect; the hidden-page claim need not be assumed.
2. **Where now:** [MEASURED] `assets/panel-centre.js:65`, `assets/panel-centre.js:92`, `assets/panel-centre.js:116`, `assets/panel-centre.js:130`; `assets/deckwave-panels.js:1120`, `assets/deckwave-panels.js:1172`, `assets/deckwave-panels.js:1180`, `assets/deckwave-panels.js:1213`, `assets/deckwave-panels.js:1275` and `assets/deckwave-panels.js:1287`.
3. **Fix size and risk:** [INFERRED] Medium, display-only: retain timestamps, split strokes and fills at gaps, and make centre’s time mapping and retention agree with its footer.
4. **Testable?** [INFERRED] **Yes**: first confirm continuous samples produce connected traces; introduce a sampling hole within the displayed window and assert that neither strokes nor filled areas bridge it. A slow-draw fixture must also preserve truthful time labels.
5. **Duplicate of:** [INFERRED] None; F73 overlaps the shared-history gap, and F88 repeats the centre-window defect.

**F69**

1. **Verdict:** [INFERRED] **REAL.** [MEASURED] The journey panel provides a positive control for unknown-key handling: `assets/deckwave-panels.js:336` returns `null` for `?`. Wayposts instead uses `parseInt(cam) || 1`, selects the A offset unless the suffix is B, and its corpus guard tests BPM. [INFERRED] At equal BPM, `?` and `1A` receive identical coordinates, including when used by current-position and route drawing.
2. **Where now:** [MEASURED] `assets/panel-wayposts.js:37`, `assets/panel-wayposts.js:40`, `assets/panel-wayposts.js:79`, `assets/panel-wayposts.js:99`, `assets/panel-wayposts.js:108`, `assets/panel-wayposts.js:125` and `assets/panel-wayposts.js:135`.
3. **Fix size and risk:** [INFERRED] Small-to-medium display fix: guard every coordinate consumer and break trails at unknown keys, avoiding a fabricated connection across an omitted track.
4. **Testable?** [INFERRED] **Yes**: establish that a known `1A` track draws its marker, then supply `?` at the same BPM and require no harmonic marker or incident route segment there.
5. **Duplicate of:** [INFERRED] None; F74 and F81 repeat this defect.

**F70**

1. **Verdict:** [INFERRED] **REAL.** [MEASURED] Selection uses `S[sel]` to distinguish an explicit mascot from the theme fallback, but the suffix tests only `sel === 'auto'`. The centre default is `jam`; `S.chip` is a defined mascot. [INFERRED] With the supplied definitions, default `jam` therefore draws the cyberpunk chip with a false pinned suffix.
2. **Where now:** [MEASURED] `assets/deckwave-sprites.js:97`, `assets/deckwave-sprites.js:226`, `assets/deckwave-sprites.js:312`, `assets/deckwave-sprites.js:313`, `assets/deckwave-sprites.js:322`; `assets/deckwave-panels.js:702`.
3. **Fix size and risk:** [INFERRED] Tiny display-only change: derive the suffix from the same explicit-mascot condition used for selection.
4. **Testable?** [INFERRED] **Yes**: explicit `chip` must produce `chip · pinned`; `jam` under cyberpunk must produce the theme mascot without that suffix. The second assertion fails currently.
5. **Duplicate of:** [INFERRED] None; F75 repeats this defect.

**F71**

1. **Verdict:** [INFERRED] **REAL**, for the same comment/code mismatch as F64. [MEASURED] The documented coefficient is `0.985`; the implemented coefficient is `.94`.
2. **Where now:** [MEASURED] `assets/deckwave-panels.js:472` and `assets/deckwave-panels.js:482`.
3. **Fix size and risk:** [INFERRED] Tiny comment correction; changing damping instead would be **THRESHOLD/calibration** work.
4. **Testable?** [INFERRED] **Yes**: F64’s coefficient/documentation consistency check covers it.
5. **Duplicate of:** [INFERRED] F64.

**F72**

1. **Verdict:** [INFERRED] **REAL in the supplied update path.** [MEASURED] Listening writes the external-source metadata, relabels the cells and sets `labelsSwapped`; the no-track branch subsequently writes only `idle` and returns before `restoreLabels()`. [INFERRED] Two calls representing listen-on followed by listen-off with no track retain the stale fields.
2. **Where now:** [MEASURED] `assets/deckwave-nowplaying.js:215`, `assets/deckwave-nowplaying.js:221`, `assets/deckwave-nowplaying.js:225`, `assets/deckwave-nowplaying.js:234` and `assets/deckwave-nowplaying.js:236`.
3. **Fix size and risk:** [INFERRED] Small display-state reset in the idle path: restore labels, clear values and metadata, and invalidate the metadata cache when clearing it.
4. **Testable?** [INFERRED] **Yes**: first assert that active listening populates the alternate labels; then deactivate listening with an empty set and assert idle metadata, normal labels and cleared readings.
5. **Duplicate of:** [INFERRED] None; F89 repeats this defect.

**F73**

1. **Verdict:** [INFERRED] **REAL**, with a narrower late-opening scenario: none of the shared-history panels must previously have fed this track. [MEASURED] The supplied file calls `feed()` from the three draw functions, assigns `tick` to the energy feed, and sets the history origin to `performance.now()` on the first feed detecting a new track. [INFERRED] That origin is first observation, not track start; unconditional joins also bridge later sampling holes.
2. **Where now:** [MEASURED] `assets/deckwave-panels.js:1100`, `assets/deckwave-panels.js:1112`, `assets/deckwave-panels.js:1120`, `assets/deckwave-panels.js:1155`, `assets/deckwave-panels.js:1188`, `assets/deckwave-panels.js:1203`, `assets/deckwave-panels.js:1259` and `assets/deckwave-panels.js:1339`.
3. **Fix size and risk:** [INFERRED] Medium display fix: mark gaps and label time since first observation, or use a verified deck-elapsed contract. Moving feeding to the paint tick alone does not establish track-relative time across hidden intervals.
4. **Testable?** [INFERRED] **Yes**: start observations 90 seconds into a track and require either track-relative labels or an explicit observation-relative label; separately assert path breaks after a feed interruption.
5. **Duplicate of:** [INFERRED] F68 for shared-history gap bridging; the origin-label defect is additional.

**F74**

1. **Verdict:** [INFERRED] **REAL** for unknown-key placement. [MEASURED] The coordinate fallback remains. [INFERRED] Whether an unknown-key dot is also lit depends on `nav.reachable`; verifying that portion requires current `assets/deckwave-nav.js`.
2. **Where now:** [MEASURED] `assets/panel-wayposts.js:37`, `assets/panel-wayposts.js:40`, `assets/panel-wayposts.js:81` and `assets/panel-wayposts.js:135`.
3. **Fix size and risk:** [INFERRED] Same display-coordinate guards and path breaks as F69.
4. **Testable?** [INFERRED] **Yes**: F69’s known-key control and unknown-key marker/segment assertions cover placement.
5. **Duplicate of:** [INFERRED] F69.

**F75**

1. **Verdict:** [INFERRED] **REAL.** [MEASURED] Mascot selection and the pinned suffix still use different predicates. [INFERRED] Centre-only selections consequently mislabel the theme fallback.
2. **Where now:** [MEASURED] `assets/deckwave-sprites.js:313` and `assets/deckwave-sprites.js:322`.
3. **Fix size and risk:** [INFERRED] Tiny display-only predicate correction.
4. **Testable?** [INFERRED] **Yes**: select `robot` and `none`, change themes, and require theme-following labels without `pinned`; retain a positive explicit-mascot case.
5. **Duplicate of:** [INFERRED] F70.

**F76**

1. **Verdict:** [INFERRED] **REAL.** [MEASURED] `H.peak * 0.9995` executes on every draw having a valid stereo source, outside the sampling guard.
2. **Where now:** [MEASURED] `assets/panel-centre.js:65` and `assets/panel-centre.js:77`.
3. **Fix size and risk:** [INFERRED] Small implementation, but **THRESHOLD/calibration** risk: `dt * 60` selects a reference rate whose intended status has not been measured here.
4. **Testable?** [INFERRED] **Yes**: after an initial peak, draw silence for equal wall time at 60 and 120 calls per second and require equal decay.
5. **Duplicate of:** [INFERRED] F65’s centre-decay portion.

**F77**

1. **Verdict:** [INFERRED] **FIXED for the reported running-record case.** [MEASURED] The monitor now reads `DW.prevDeck`, takes its `xfade`, and uses its `prog` when numeric. [INFERRED] End-of-fade fallback correctness remains dependent on the lifetime of `D.prev`: the fallback still uses the next exit’s duration. Current `assets/deckwave-loop.js` and the `DW.prevDeck` getter in `assets/deckwave.js` are needed to assess that separate edge.
2. **Where now:** [MEASURED] `assets/deckwave-panels.js:905`, `assets/deckwave-panels.js:906`, `assets/deckwave-panels.js:908` and `assets/deckwave-panels.js:912`.
3. **Fix size and risk:** [INFERRED] No additional change established for this finding; inspect the fallback lifecycle before proposing another display fix.
4. **Testable?** [INFERRED] **No new failure for the reported case**: a running record with `xfade: 19`, `prog: 17/19`, and a next exit of 16 seconds already selects the running record.
5. **Duplicate of:** [INFERRED] None; F84 repeats this defect.

**F78**

1. **Verdict:** [INFERRED] **FIXED for the reported running fade.** [MEASURED] The card now derives fading and progress from `DW.prevDeck` with a `D.prev` fallback, renders `◉ BLENDING` before considering the countdown, and applies the bar’s `now` class while fading. [INFERRED] The same absent-record lifecycle caveat as F77 remains.
2. **Where now:** [MEASURED] `assets/deckwave-nowplaying.js:358`, `assets/deckwave-nowplaying.js:360`, `assets/deckwave-nowplaying.js:370`, `assets/deckwave-nowplaying.js:373`, `assets/deckwave-nowplaying.js:416` and `assets/deckwave-nowplaying.js:421`.
3. **Fix size and risk:** [INFERRED] No further fix established for the original countdown defect.
4. **Testable?** [INFERRED] **No new failure for the reported case**: a previous track plus a live running-fade record already overrides a positive next-exit countdown.
5. **Duplicate of:** [INFERRED] None; related to F77, but a separate display consumer.

**F79**

1. **Verdict:** [INFERRED] **CAN'T-TELL.** [MEASURED] The step-like bass wording remains on both surfaces. [CARRIED — F79 brief] The earlier reviewers supplied the two ramp schedules; current engine scheduling is not supplied. [INFERRED] If those schedules remain, their shelf-gain parameters cross at fade fraction `0.2475`; that does not establish which deck’s bass sounds louder, which also depends on signal content and deck envelopes. Current low-shelf and deck-gain scheduling in `assets/deckwave.js` is required.
2. **Where now:** [MEASURED] `assets/deckwave-panels.js:1067`, `assets/deckwave-panels.js:1073`; `assets/deckwave-nowplaying.js:423` and `assets/deckwave-nowplaying.js:435`.
3. **Fix size and risk:** [INFERRED] Small wording change once schedules are confirmed; changing ramps or scheduling would be **HEARD-PATH** work. Do not replace “45% swap” with an unmeasured “25% audible swap.”
4. **Testable?** [INFERRED] **Yes for approved wording**, by asserting ramp terminology in captured labels. [CARRIED — test brief] The described harness cannot validate acoustic values or timing.
5. **Duplicate of:** [INFERRED] None.

**F80**

1. **Verdict:** [INFERRED] **CAN'T-TELL whether the colour decision is unjustified.** [MEASURED] The `mean > -12` branch and relative readout remain. [CARRIED — comment at `assets/deckwave-panels.js:303`] The series lacks absolute calibration. [INFERRED] That does not establish that a relative cutoff lacks corpus measurements, or that amber necessarily means “too loud.” The current measurement record and intended meaning of this cutoff are needed; the earlier reviewer’s unsuccessful search does not establish their absence.
2. **Where now:** [MEASURED] `assets/deckwave-panels.js:298`, `assets/deckwave-panels.js:324` and `assets/deckwave-panels.js:325`.
3. **Fix size and risk:** [INFERRED] Tiny edit but **THRESHOLD** change if the cutoff is moved or removed; defer that decision until its basis is established.
4. **Testable?** [INFERRED] **Yes, conditionally**: if removal is justified, assert the same neutral readout colour for inputs producing means on opposite sides of −12. That assertion fails currently, but does not itself justify removal.
5. **Duplicate of:** [INFERRED] None.

**F81**

1. **Verdict:** [INFERRED] **REAL** for the coordinate defect. [MEASURED] Unknown keys still take the numeric fallback and A-side offset.
2. **Where now:** [MEASURED] `assets/panel-wayposts.js:37` and `assets/panel-wayposts.js:40`.
3. **Fix size and risk:** [INFERRED] Same display-only coordinate guards as F69; reachability policy need not change.
4. **Testable?** [INFERRED] **Yes**: F69’s known-key control and unknown-key marker/segment assertions cover it.
5. **Duplicate of:** [INFERRED] F69.

**F83**

1. **Verdict:** [INFERRED] **REAL when this component is mounted.** [MEASURED] `fit()` reads the current height attribute and writes the scaled height property. [INFERRED] Canvas property/attribute reflection makes repeated scaling compound. [MEASURED] Inspecting script-source tags in the supplied `index.html` positively finds `assets/deckwave-panels.js` at line 47; that same inspection finds no tag loading `assets/deckwave-visuals.js`. [CARRIED — comment at `index.html:53`] Design-system pages consume it.
2. **Where now:** [MEASURED] `assets/deckwave-visuals.js:158`, `assets/deckwave-visuals.js:161`; related logical-height use at `assets/deckwave-visuals.js:266`.
3. **Fix size and risk:** [INFERRED] Small display-sizing fix: retain immutable logical heights, use them for resize and idle drawing, and keep CSS sizing consistent.
4. **Testable?** [INFERRED] **Yes**: use a canvas stub whose height property demonstrably updates its attribute; mount at DPR 2 and fire two resizes. Scope backing height must remain 160 rather than reaching 640.
5. **Duplicate of:** [INFERRED] None.

**F84**

1. **Verdict:** [INFERRED] **FIXED for the running-record case.** [MEASURED] The panel now implements the proposed `DW.prevDeck.xfade/prog` preference. [INFERRED] F77’s fallback-lifecycle limitation still applies.
2. **Where now:** [MEASURED] `assets/deckwave-panels.js:905`, `assets/deckwave-panels.js:906` and `assets/deckwave-panels.js:912`.
3. **Fix size and risk:** [INFERRED] No independent fix needed.
4. **Testable?** [INFERRED] **No new failure for the reported case**: unequal running and planned fade lengths already select the running record.
5. **Duplicate of:** [INFERRED] F77.

**F86**

1. **Verdict:** [INFERRED] **REAL**, with an overstated failure duration in the brief. [MEASURED] Both writers advance the head before readers start at that head. [INFERRED] After two writes, readers inspect unwritten slots 2 and 3. During later partial filling, the read wraps into some populated slots, so the trace is not entirely zero until the buffer fills; its ordering remains wrong during warm-up.
2. **Where now:** [MEASURED] `assets/deckwave-panels.js:209`, `assets/deckwave-panels.js:228`, `assets/deckwave-panels.js:299` and `assets/deckwave-panels.js:318`.
3. **Fix size and risk:** [INFERRED] Tiny ring-buffer indexing correction; display bookkeeping only.
4. **Testable?** [INFERRED] **Yes**: feed two distinct nonzero samples and assert that plotted points represent them in chronological order; also cover partial filling and a wrapped buffer.
5. **Duplicate of:** [INFERRED] None.

**F87**

1. **Verdict:** [INFERRED] **REAL for a one-tempo corpus with `GATE: 0.08`.** [MEASURED] The radial mapping extrapolates, and its results go directly into `arc()`. [INFERRED] With corpus BPM and current tempo both 120, that gate makes the inner radius negative, which Canvas rejects. [CARRIED — header at `assets/panel-wayposts.js:8`] The project uses an 8% gate. [INFERRED] Confirming the current gate and dashboard error presentation requires `assets/deckwave-nav.js` and `assets/deckwave-loop.js`.
2. **Where now:** [MEASURED] `assets/panel-wayposts.js:34`, `assets/panel-wayposts.js:36`, `assets/panel-wayposts.js:68`, `assets/panel-wayposts.js:70` and `assets/panel-wayposts.js:72`.
3. **Fix size and risk:** [INFERRED] Small geometry-bound correction; clamping display radii does not require changing the gate or any detector.
4. **Testable?** [INFERRED] **Yes**: first verify that the canvas stub accepts valid radii and rejects negative ones; then draw the one-tempo fixture and require completion with annulus radii inside the drawable radius.
5. **Duplicate of:** [INFERRED] None.

**F88**

1. **Verdict:** [INFERRED] **REAL.** [MEASURED] Centre stores samples without timestamps, maps x by sample index, and prints `N / HZ`. [INFERRED] At five successful samples per second, a full buffer represents approximately 120 seconds despite the 60-second footer.
2. **Where now:** [MEASURED] `assets/panel-centre.js:32`, `assets/panel-centre.js:34`, `assets/panel-centre.js:65`, `assets/panel-centre.js:92` and `assets/panel-centre.js:130`.
3. **Fix size and risk:** [INFERRED] Small-to-medium timestamp, retention and axis change; display-only.
4. **Testable?** [INFERRED] **Yes**: feed at 5 Hz and require the displayed interval and x positions to agree with sample timestamps rather than assumed 10 Hz spacing.
5. **Duplicate of:** [INFERRED] F68’s centre-window portion; low draw rate is another trigger.

**F89**

1. **Verdict:** [INFERRED] **REAL.** [MEASURED] The idle return still precedes label restoration and leaves the listening metadata and values untouched within this update function.
2. **Where now:** [MEASURED] `assets/deckwave-nowplaying.js:234` and `assets/deckwave-nowplaying.js:236`.
3. **Fix size and risk:** [INFERRED] Small idle-state reset; display-only.
4. **Testable?** [INFERRED] **Yes**: F72’s listen-on/listen-off sequence with an empty set covers it.
5. **Duplicate of:** [INFERRED] F72.

**F90**

1. **Verdict:** [INFERRED] **REAL.** [MEASURED] The comment still states `0.985/frame`, while the recurrence uses `.94/.06`.
2. **Where now:** [MEASURED] `assets/deckwave-panels.js:472` and `assets/deckwave-panels.js:482`.
3. **Fix size and risk:** [INFERRED] Tiny comment correction; changing damping would be **THRESHOLD/calibration** work.
4. **Testable?** [INFERRED] **Yes**: F64’s documentation/recurrence check covers it.
5. **Duplicate of:** [INFERRED] F64.

**F91**

1. **Verdict:** [INFERRED] **REAL.** [MEASURED] The glossary promises the steepest rise across the track, but drawing initializes its maximum afresh and searches the retained arrays; retention removes samples beyond 600 entries. [INFERRED] Once an earlier maximum is evicted, it cannot remain the selected marker.
2. **Where now:** [MEASURED] `assets/deckwave-panels.js:50`, `assets/deckwave-panels.js:1094`, `assets/deckwave-panels.js:1129`, `assets/deckwave-panels.js:1130`, `assets/deckwave-panels.js:1219` and `assets/deckwave-panels.js:1223`.
3. **Fix size and risk:** [INFERRED] Tiny glossary correction to “in the retained history.” “In the last minute” would still overpromise under F68/F73’s sampling gaps.
4. **Testable?** [INFERRED] **Yes**: require retained-history scope in the glossary; the current track-wide wording fails. An eviction fixture can separately establish why that scope matters.
5. **Duplicate of:** [INFERRED] None.

**F104**

1. **Verdict:** [INFERRED] **REAL within the supplied module.** [MEASURED] Inspection positively finds cleanup calls on reopen and `set('off')`; the hand-close cleanup is inside a callback scheduled on the popup, while the supplied `showing` and `status` getters only report closure. [CARRIED — F104 brief] A discarded popup receives no further animation frames. [INFERRED] Under that lifecycle, this module cannot release the party through its hand-close branch; session-long persistence would additionally depend on unshown callers not invoking `set('off')`.
2. **Where now:** [MEASURED] `assets/deckwave-popout.js:83`, `assets/deckwave-popout.js:102`, `assets/deckwave-popout.js:103`, `assets/deckwave-popout.js:106`, `assets/deckwave-popout.js:216`, `assets/deckwave-popout.js:249` and `assets/deckwave-popout.js:253`.
3. **Fix size and risk:** [INFERRED] Small lifecycle fix using opener-owned closure detection and existing cleanup. [CARRIED — module header] The connection is analysis-only; verifying disconnect scope requires `vendor/butterchurn.min.js`. A broader graph disconnect could touch the **HEARD-PATH**.
4. **Testable?** [INFERRED] **Yes**: establish that explicit off invokes the cleanup spy; then hand-close, discard the popup’s rAF queue, advance opener-side detection, and require released party state and a disconnect call.
5. **Duplicate of:** [INFERRED] None; F110 and F124 repeat this defect.

**F110**

1. **Verdict:** [INFERRED] **REAL**, under the closure lifecycle stated in F104. [MEASURED] The current comment still promises hand-close cleanup through the popup tick. [CARRIED — F110 brief] The BUILD-LOG also makes that claim; its current text was not supplied.
2. **Where now:** [MEASURED] `assets/deckwave-popout.js:65`, `assets/deckwave-popout.js:66`, `assets/deckwave-popout.js:67`, `assets/deckwave-popout.js:102` and `assets/deckwave-popout.js:106`.
3. **Fix size and risk:** [INFERRED] Update the comment with F104’s lifecycle fix; changing documentation alone would leave the cleanup defect.
4. **Testable?** [INFERRED] **Yes**: F104’s hand-close test covers the promised behaviour; separately pin the corrected lifecycle description.
5. **Duplicate of:** [INFERRED] F104.

**F118**

1. **Verdict:** [INFERRED] **REAL for the hard-coded loader paths.** [MEASURED] `ensureButterchurn()` passes literal `vendor/` URLs, and `loadScript()` assigns its argument directly to `src`. [CARRIED — F118 brief] `DW.assets.base` is the relocation contract used by other loaders. [INFERRED] Before integrating a fix, confirm the current asset configuration in `assets/deckwave.js` and resolver conventions in `assets/deckwave-flac.js` and `assets/deckwave-render.js`.
2. **Where now:** [MEASURED] `assets/deckwave-popout.js:174`, `assets/deckwave-popout.js:186` and `assets/deckwave-popout.js:187`.
3. **Fix size and risk:** [INFERRED] Small configuration/plumbing change, conditional on the current asset API; preserve the existing default paths.
4. **Testable?** [INFERRED] **Yes**: with the relocation contract confirmed, configure `relocated-vendor/` and assert requests for `relocated-vendor/butterchurn.min.js` and `relocated-vendor/butterchurn-presets.min.js`; current literals fail.
5. **Duplicate of:** [INFERRED] None.

**F124**

1. **Verdict:** [INFERRED] **REAL within the module**, for the same closure-lifecycle reason as F104. [MEASURED] Manual-close detection and cleanup remain inside the popup-owned rAF callback.
2. **Where now:** [MEASURED] `assets/deckwave-popout.js:102`, `assets/deckwave-popout.js:103` and `assets/deckwave-popout.js:106`.
3. **Fix size and risk:** [INFERRED] Same opener-owned cleanup as F104; keep disconnection confined to the party analysis branch.
4. **Testable?** [INFERRED] **Yes**: F104’s test must discard closed-window callbacks and still observe cleanup.
5. **Duplicate of:** [INFERRED] F104.

| F-number | Verdict [INFERRED] | Priority [INFERRED] | One-line reason [INFERRED] |
|---|---|---:|---|
| F60 | REAL | 2 | Blanket offline wording conflicts with the shown lazy script requests. |
| F63 | FIXED | 3 | Shown monitor surfaces explicitly disclaim phase; verify LISTENING separately. |
| F64 | REAL | 2 | Correct the comment to describe the existing recurrence without retuning it. |
| F65 | REAL | 2 | Draw frequency changes state; decay conversion needs a measured timing basis. |
| F68 | REAL | 2 | Timestamped samples and separated paths would remove fabricated continuity. |
| F69 | REAL | 2 | Unknown keys receive a false harmonic position across several drawing paths. |
| F70 | REAL | 2 | A tiny predicate correction removes the false pinned label. |
| F71 | REAL | 3 | Duplicate of F64. |
| F72 | REAL | 1 | A small, deterministic idle-state reset removes stale listening claims. |
| F73 | REAL | 2 | Combine gap work with F68 and correct the first-observation time origin. |
| F74 | REAL | 3 | Duplicate of F69; reachability lighting needs navigation code. |
| F75 | REAL | 3 | Duplicate of F70. |
| F76 | REAL | 3 | Duplicate of F65’s decay issue; do not assume a calibration reference rate. |
| F77 | FIXED | 3 | Running fade reads its own record; fallback lifetime needs separate inspection. |
| F78 | FIXED | 3 | Running-fade rendering now takes precedence over the next-exit countdown. |
| F79 | CAN'T-TELL | 3 | Current engine ramps are needed; parameter crossing does not prove audible ownership. |
| F80 | CAN'T-TELL | 3 | Establish cutoff provenance before changing or removing a threshold. |
| F81 | REAL | 3 | Duplicate of F69. |
| F83 | REAL | 2 | Resize compounds height, but direct loading is outside the shown main page. |
| F84 | FIXED | 3 | Duplicate of F77’s corrected running-record case. |
| F86 | REAL | 1 | Tiny indexing fix with a direct chronological-data assertion. |
| F87 | REAL | 1 | A bounded geometry fix prevents the one-tempo fixture from throwing. |
| F88 | REAL | 3 | Duplicate of F68’s centre timestamp/window defect. |
| F89 | REAL | 3 | Duplicate of F72. |
| F90 | REAL | 3 | Duplicate of F64. |
| F91 | REAL | 2 | Scope the glossary to retained history; avoid another inaccurate time promise. |
| F104 | REAL | 1 | Move closure detection to a surviving lifecycle and test without popup callbacks. |
| F110 | REAL | 3 | Duplicate of F104; correct the cleanup comment alongside that fix. |
| F118 | REAL | 2 | Loader bypass is visible; confirm the current asset contract before integration. |
| F124 | REAL | 3 | Duplicate of F104. |