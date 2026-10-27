**aa7a182afdbb5a807abb33fbdfadf6b7771ef777**

1. **Verdict: MERGE — inferred.**

2. **Does it fix the stated defect? Yes — inferred.**  
   **Measured:** `assets/deckwave-dashboard.js:169` adds `.tp [hidden]{display:none!important}`.  
   **Carried — commit message:** The re-link button is inside `.tp`, and the phone rule gives it ordinary `display:inline-block`.  
   **Inferred:** The added important declaration wins that conflict and preserves hiding while the drawer is open.

3. **Regressions or new defects:**  
   **Measured:** The selector covers every hidden descendant of `.tp`, including the existing settle mark, rather than only the re-link button.  
   **Inferred:** That scope is consistent with honoring those elements’ `hidden` attributes. No regression is established by the supplied change. The comment’s promise that no later display rule can override it is too broad: a competing important declaration could still win.

4. **The new checks:**  
   **Measured:** As a manual positive control, the declaration at `assets/deckwave-dashboard.js:169` matches the spelling required by the new predicate at `tools/check-panels.js:633`.  
   **Inferred:** The check can fail on old source lacking that declaration. The reported old-source failure remains **carried from the commit message**, not reproduced here.  
   **Measured:** The check searches extracted stylesheet text for two declarations; it does not evaluate CSS.  
   **Inferred:** It could pass with the required text inside a CSS comment, or with a competing important rule overriding it. It guards source shape, not computed visibility. The actual phone stylesheet block and button construction are needed to independently confirm the carried DOM/cascade premises.

5. **Heard path / threshold:**  
   **Measured:** The production additions are a CSS comment and display declaration.  
   **Inferred:** This is a display-only change.


**795d99df5688f0b3beb96c2a29865b4e2774bcb0**

1. **Verdict: MERGE — inferred.**

2. **Does it fix the stated defect? Yes — inferred.**  
   **Measured:** `assets/deckwave-dashboard.js:738` now calls `splitDeck()` on every deck-source lookup. The identity guard at line 711 returns early for the existing analyser; a different analyser reaches the reconstruction code. Previously, a truthy `deckL` prevented that identity comparison.  
   **Carried — commit message:** Reset closes the old context and playback creates a replacement analyser.  
   **Inferred:** Under that lifecycle, subsequent lookups return analysers belonging to the replacement context.

3. **Regressions or new defects:**  
   **Measured:** The unchanged identity guard checks both context and source identity before creating nodes.  
   **Inferred:** Ordinary repeated frames therefore retain their existing split. No new regression is established for the stated reset-and-restart sequence. Lifecycle behavior outside that sequence is not demonstrated by these excerpts.

4. **The new checks:**  
   **Measured:** There are four added `ok(...)` call sites in this `tools/check-panels.js` diff: extraction, initial split, unchanged-source reuse, and replacement-context recovery.  
   **Inferred:** On the shown old implementation, the first three should pass and the recovery check should fail: `deckL` remains truthy and the returned pair still belongs to the first context. On the shown new implementation, recovery reaches `splitDeck()` and replaces the pair.  
   **Measured:** The fake `connect()` at `tools/check-panels.js:984` counts calls without recording endpoints or channel arguments. The recovery assertion at line 999 checks context, replacement identity and a positive connection count.  
   **Inferred:** These checks distinguish the stale-node defect but do not prove correct signal routing. Connecting both analysers to splitter output zero would still pass. Changing the sink gain to one would also pass.

5. **Heard path / threshold:**  
   **Measured:** The new call makes existing audio-graph construction reachable after replacement. That construction includes:
   ```js
   const sink = ctx.createGain(); sink.gain.value = 0;
   deckL.connect(sink); deckR.connect(sink); sink.connect(ctx.destination);
   ```
   These are `assets/deckwave-dashboard.js:717` and line 718.  
   **Inferred:** The shown branch is a silent tap and does not change upstream playback parameters.  
   **Carried — commit message and comments:** Its consumers are display functions.  
   **Inferred:** Independently establishing that no calibrated detector receives the changed samples requires the `DWLOOP` code consuming `dash.stereoSource()` and the implementation of `DWVU.feed()`. The fake graph cannot establish that boundary.


**49d5f24c02cab698afad63168122cd6810ca5394**

1. **Verdict: MERGE — inferred.**

2. **Does it fix the stated defect? Yes, under the stated data contract — inferred.**  
   **Measured:** `assets/deckwave-dashboard.js:1158` prints `o.wouldNeed` as hops. Line 1133 prints `o.finalStretch` without the sign-adding formatter.  
   **Carried — commit message and comments:** `wouldNeed` is a hop count, and `finalStretch` is an absolute percentage magnitude.  
   **Inferred:** Those contracts make the new units and unsigned wording appropriate. Independent confirmation requires the `DWNAV.optionsFull`/`DWNAV.options` implementations, their `hopsNeeded()` calls, and the assignments producing these two fields.

3. **Regressions or new defects:**  
   **Measured:** The shown action callbacks and route arguments remain unchanged; the edits replace descriptive text and add comments.  
   **Inferred:** No behavioral regression is established by these changes.

4. **The new checks:**  
   **Measured:** Manual positive controls find both `pct(o.wouldNeed)` and `pct(o.finalStretch)` in the supplied removed lines, and `pct(signed)` in the retained next/force rows. Thus the prohibited spellings demonstrably match the old expressions before their removal is assessed.  
   **Inferred:** The added assertion at `tools/check-panels.js:659` can fail on the shown old implementation and pass on the shown replacement.  
   **Measured:** Its predicates search `dashSrc` for literal expressions; they neither execute the row formatter nor inspect the producing navigation code.  
   **Inferred:** It could pass with the expected strings in dead code or comments while another expression renders incorrect text. It also cannot detect an incorrect assumption about either field’s units.

5. **Heard path / threshold:**  
   **Measured:** The changed executable expressions construct row descriptions; the corresponding action expressions are retained.  
   **Inferred:** This diff changes display formatting, not routing, stretch calculations or thresholds.


**7be36fea7f2b5f9782430757a93303a701946246**

1. **Verdict: MERGE — inferred.**

2. **Does it fix the stated defect? Yes for the shown `prepare()` path — inferred.**  
   **Measured:** `assets/deckwave-dashboard.js:1277` calls `dash.setMini(false)`. The painter at line 2246 updates the app class, host class, inline now-playing display, button text and button class. Line 1280 calls `dash.syncPhl()` after the phone class is added.  
   **Inferred:** This clears the stale compact display and button state, and makes the phone button reflect the resulting screen. Establishing coverage of both build and load requires their call sites leading into `dash.prepare(v)`; those call sites are not supplied.

3. **Regressions or new defects:**  
   **Measured:** Both painters are assigned onto `dash`, at `assets/deckwave-dashboard.js:1658` and line 2255. They initially hold `null` at line 1286.  
   **Inferred:** No regression is established for calls after transport construction. The new calls require construction to finish first; confirming that prerequisite requires the remaining `mount()` initialization sequence and any synchronous `prepare()` calls made by its mixins.

4. **The new checks:**  
   **Measured:** There are four added `ok(...)` call sites in this `tools/check-panels.js` diff. The old excerpt contains the control’s `sets.prepare(v)` and `ph-list` addition, plus the prohibited bare `remove('mini')` and toggle-derived phone state. These provide positive matches against the supplied old code.  
   **Inferred:** The control should pass old code; the other three assertions should fail it. Their reported execution remains **carried from the commit message**.  
   **Measured:** The assertions at `tools/check-panels.js:1252`, line 1256 and line 1261 inspect text, not resulting DOM state.  
   **Inferred:** Wrong fixes can pass. Keeping `nl.style.display` permanently `'block'` still satisfies the `nowline` presence test. Omitting `dash.setMini = setMini` still satisfies the checks despite making `prepare()` throw. Moving `dash.syncPhl()` before the class addition also passes despite the assertion’s “after” wording. The supplied implementation avoids these examples, but the checks do not exclude them.

5. **Heard path / threshold:**  
   **Measured:** The new painter operations change DOM state and schedule `dash.fit`; the existing `sets.prepare(v)` call remains.  
   **Inferred:** The shown changes concern presentation and layout, not playback or detector calibration.


**Overall**

**Inferred:** All four are mergeable on the supplied evidence and compose in the stated order. The CSS precedence, analyser refresh, menu formatting and compact-state changes operate on separate mechanisms; the later snippets retain earlier changes where their contexts overlap.

**Measured:** This review manually compared supplied source and predicates; it did not execute them. Line references count new-file context and added lines from each supplied hunk header, excluding deleted lines.

**Carried — commit messages:** The old-source failures, passing totals and broader gate results are execution claims by the authors. **Inferred:** None of the added regression assertions is inherently unable to fail, but their passes would not establish browser rendering, audible behavior or detector isolation. Compliance with the required exact final harness-output line cannot be certified from these excerpts.