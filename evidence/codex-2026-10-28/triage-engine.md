**F0**

1. **Verdict — INFERRED: FIXED.** **MEASURED:** `reorder()` now captures `gen` after cancellation and checks it on both decode rejection and success. A competing operation that advances `gen` makes the continuation return `'superseded'`.
2. **Where now — MEASURED:** `assets/deckwave.js:2103`, `assets/deckwave.js:2107`, `assets/deckwave.js:2113`.
3. **Fix size and risk — INFERRED:** No implementation needed.
4. **Testable? — INFERRED:** No new failing check for this claim. A regression should hold reorder’s decode, complete `blendNow()`, then resolve or reject the stale decode; the newer B and recorded source-start count must remain unchanged. **MEASURED:** No checks were executed this pass; this report uses the supplied source. **CARRIED (brief):** The existing fakes establish bookkeeping and ordering, not audio correctness.
5. **Duplicate of — INFERRED:** None; F3 and F8 describe this defect.

**F1**

1. **Verdict — INFERRED: REAL for worklet failure.** **MEASURED:** As a positive control, manual inspection finds `ctx.close()` in `kill()` at line 1985. Inspection of the supplied `bootGraph()` body, lines 1041–1120, finds assignment to `ctx`, terminal worklet rejection paths, and no context-closing cleanup. `boot()` clears `booting` after rejection. **INFERRED:** A retry can overwrite the failed context without closing it. **MEASURED:** The claimed `setSinkId()` rejection path is handled locally by logging and continuing; it is not a terminal boot failure here.
2. **Where now — MEASURED:** `assets/deckwave.js:1053`, `assets/deckwave.js:1054`, `assets/deckwave.js:1102`, `assets/deckwave.js:1105`; sink handling at `assets/deckwave.js:1059`.
3. **Fix size and risk — INFERRED:** Small failure-cleanup wrapper; low risk. Close the locally created context and clear shared state only while that attempt still owns it.
4. **Testable? — INFERRED:** Yes. Force every available worklet route to fail across repeated `play()` calls; assert each failed attempt’s context is closed and `Player.state.ctx` becomes `'none'`. Include a successful retry control.
5. **Duplicate of — INFERRED:** None; F10 and F19 describe this defect.

**F2**

1. **Verdict — INFERRED: REAL.** **MEASURED:** The supplied string literal is `'\.('`, with one backslash. **INFERRED:** JavaScript consumes that escape, producing regex source `.(flac|mp3|wav|aiff|m4a|ogg|opus|oga)$`. Consequently, names such as `notes-mp3` pass. Whether analysis subsequently fails depends on the file’s contents.
2. **Where now — MEASURED:** `assets/deckwave.js:392`; consumers at `assets/deckwave.js:397`, `assets/deckwave.js:791`, `assets/deckwave.js:2469`.
3. **Fix size and risk — INFERRED:** One string-escape correction to `'\\.('`; low risk, but previously accepted nonstandard filenames become excluded.
4. **Testable? — INFERRED:** Yes. Extract the actual declaration; assert acceptance of `a.mp3` and `Song.flac`, and rejection of `notmp3`, `notes_wav`, and `Song.mogg`. The rejection assertions should fail currently.
5. **Duplicate of — INFERRED:** None; F7, F11, F13, and F20 describe this defect.

**F3**

1. **Verdict — INFERRED: FIXED.** **MEASURED:** The generation capture and both continuation guards are present in `reorder()`. It need not cancel again after decoding to reject a superseded operation.
2. **Where now — MEASURED:** `assets/deckwave.js:2103`, `assets/deckwave.js:2107`, `assets/deckwave.js:2113`.
3. **Fix size and risk — INFERRED:** No fix needed. The proposed extra `cancelPending()` would be **HEARD-PATH**: it can stop the newer deck and rewrite outgoing automation.
4. **Testable? — INFERRED:** No new failing check for this claim; F0’s held-decode regression should pass.
5. **Duplicate of — INFERRED:** F0.

**F7**

1. **Verdict — INFERRED: REAL for the regex defect.** **MEASURED:** The malformed string remains; both folder walking and the input picker use that same regex. **INFERRED:** They therefore share the error rather than disagreeing with each other. `norm()` has the correctly escaped regex literal.
2. **Where now — MEASURED:** `assets/deckwave.js:392`, `assets/deckwave.js:397`, `assets/deckwave.js:791`; `norm()` at `assets/deckwave.js:90`.
3. **Fix size and risk — INFERRED:** Same one-escape correction and filename-acceptance risk as F2.
4. **Testable? — INFERRED:** Yes. `Song.flac` must pass and `Song.mogg` must fail; the latter assertion should fail currently.
5. **Duplicate of — INFERRED:** F2.

**F8**

1. **Verdict — INFERRED: FIXED.** **MEASURED:** Reorder now checks its captured generation after decoding; `skip()` calls `cancelPending()`, whose first operation advances that generation.
2. **Where now — MEASURED:** `assets/deckwave.js:2103`, `assets/deckwave.js:2113`, `assets/deckwave.js:2153`, `assets/deckwave.js:1369`.
3. **Fix size and risk — INFERRED:** No fix needed; adding the proposed second cancellation would be **HEARD-PATH**.
4. **Testable? — INFERRED:** No new failing check for this claim. Complete skip during a held reorder decode, then release reorder; B and the source-start count must remain unchanged. Requiring one total live source would be the wrong invariant: the outgoing A and scheduled B can both legitimately exist.
5. **Duplicate of — INFERRED:** F0.

**F10**

1. **Verdict — INFERRED: REAL.** **MEASURED:** The terminal plain-worklet/CDN failure paths remain inside the `bootGraph()` body inspected in F1, without the cleanup positively identified in `kill()`.
2. **Where now — MEASURED:** `assets/deckwave.js:1054`, `assets/deckwave.js:1099`, `assets/deckwave.js:1102`, `assets/deckwave.js:1105`.
3. **Fix size and risk — INFERRED:** Small failure-cleanup wrapper; low risk, shared with F1.
4. **Testable? — INFERRED:** Yes. Record context constructions and closures across failed boots; every failed attempt must close its own context.
5. **Duplicate of — INFERRED:** F1.

**F11**

1. **Verdict — INFERRED: REAL.** **MEASURED:** `AUDIO_RE` still contains the single-backslash string escape. **INFERRED:** Its wildcard accepts `notesmp3`.
2. **Where now — MEASURED:** `assets/deckwave.js:392`.
3. **Fix size and risk — INFERRED:** One escape correction; same filename-acceptance risk as F2.
4. **Testable? — INFERRED:** Yes. Assert `a.mp3` is accepted and `xmp3` is rejected; the latter should fail currently.
5. **Duplicate of — INFERRED:** F2.

**F13**

1. **Verdict — INFERRED: REAL for the regex defect.** **MEASURED:** `AUDIO_RE` uses the malformed string while `norm()` uses an escaped literal dot. **CARRIED (F13 brief):** “Nothing legitimate is lost.” **INFERRED:** That assurance is unsupported: valid audio bytes can reside in files with nonstandard names, and tightening the gate would exclude those files.
2. **Where now — MEASURED:** `assets/deckwave.js:392`, `assets/deckwave.js:90`.
3. **Fix size and risk — INFERRED:** One escape correction; review the filename-acceptance change, without changing analysis calculations.
4. **Testable? — INFERRED:** Yes. Assert `a.flac` passes and `xflac` fails; the latter should fail currently.
5. **Duplicate of — INFERRED:** F2.

**F15**

1. **Verdict — INFERRED: REAL.** **MEASURED:** `persistPhrase()` and `loudOf()` independently fetch, modify, and replace the cache record. `chain()` calls outgoing loudness computation before outgoing phrase computation, before its decode await. **INFERRED:** With both fields initially absent and the database open, both reads can obtain independent copies of the old record; the later whole-record replacement loses the other field. This establishes a lost-update race, not a measured performance cost.
2. **Where now — MEASURED:** `assets/deckwave.js:1485`, `assets/deckwave.js:1533`; call sites at `assets/deckwave.js:1585`, `assets/deckwave.js:1628`.
3. **Fix size and risk — INFERRED:** Small per-record serialization helper plus two callers; low risk if it changes persistence only and preserves detector inputs and calculations.
4. **Testable? — INFERRED:** Yes. Use a fake DB that returns independent snapshots and commits whole-record replacements. Trigger both computations for one uncached record, drain writes, and assert that both `phrase` and `loud` survive. Reads inside a serialized helper must occur after the preceding write completes.
5. **Duplicate of — INFERRED:** None.

**F19**

1. **Verdict — INFERRED: REAL.** **MEASURED:** Boot assigns the new context to `ctx`; `kill()` closes only the context currently held there. The failed-boot cleanup omission is scoped and controlled in F1. **INFERRED:** After retry overwrites `ctx`, `kill()` cannot reach the earlier context through that variable.
2. **Where now — MEASURED:** `assets/deckwave.js:1054`, `assets/deckwave.js:1102`, `assets/deckwave.js:1985`.
3. **Fix size and risk — INFERRED:** Same small failure-cleanup wrapper as F1; low risk.
4. **Testable? — INFERRED:** Yes. Reject two boot attempts, invoke `kill()`, and assert that both constructed contexts have been closed; additionally assert cleanup immediately after each failure.
5. **Duplicate of — INFERRED:** F1.

**F20**

1. **Verdict — INFERRED: REAL.** **MEASURED:** The malformed `AUDIO_RE` declaration remains. **INFERRED:** `notmp3` passes because the preceding character satisfies the wildcard.
2. **Where now — MEASURED:** `assets/deckwave.js:392`.
3. **Fix size and risk — INFERRED:** Same one-escape correction and filename-acceptance risk as F2.
4. **Testable? — INFERRED:** Yes. Pair acceptance of `a.mp3` with rejection of `notmp3`; the rejection should fail currently.
5. **Duplicate of — INFERRED:** F2.

**F21**

1. **Verdict — INFERRED: REAL.** **MEASURED:** Each `ingest()` call constructs its own `have` set before awaiting analysis. Its insertion decision uses that set, and insertion updates that set plus `corpus`. **INFERRED:** Two overlapping calls can both snapshot an absent ID, then each insert it. The public `ingest()` implementation is sufficient to establish this possibility; dashboard concurrency is not required.
2. **Where now — MEASURED:** `assets/deckwave.js:2404`, `assets/deckwave.js:2412`, `assets/deckwave.js:2422`, `assets/deckwave.js:2423`.
3. **Fix size and risk — INFERRED:** Small insertion-time check against live corpus membership; low bookkeeping risk, with less scope than serializing entire imports.
4. **Testable? — INFERRED:** Yes. Start two imports of the same absent ID and hold both analysis results until both calls have started. After resolving them, assert one corpus record for that ID, aggregate `added === 1`, and aggregate `duplicates === 1`.
5. **Duplicate of — INFERRED:** None.

**F22**

1. **Verdict — INFERRED: FIXED.** **MEASURED:** `DB.put()` retains the transaction and resolves true from `tx.oncomplete`; `tx.onabort` and `tx.onerror` resolve false.
2. **Where now — MEASURED:** `assets/deckwave.js:120`, `assets/deckwave.js:121`, `assets/deckwave.js:123`.
3. **Fix size and risk — INFERRED:** No implementation needed.
4. **Testable? — INFERRED:** No new failing check for this claim. A regression should leave the promise pending after request success, resolve false after transaction abort, and resolve true on transaction completion in a separate success case.
5. **Duplicate of — INFERRED:** None.

**F23**

1. **Verdict — INFERRED: REAL for non-default drift.** **MEASURED:** The planner reads `opts.drift`; Player’s target expression uses `.35`. The planner stamps `_tempoAt` and `_stretch` before advancing its rolling tempo. **INFERRED:** With settling disabled, 120 → 124 and `drift: 0.5` produces planner target 122 versus Player target 121.4. The changed planner target appears on a subsequent track, not the second track’s pre-drift stamps. **CARRIED (F23 brief):** The option is undocumented; assessing that claim requires the current API documentation.
2. **Where now — MEASURED:** `assets/deckwave.js:735`, `assets/deckwave.js:738`, `assets/deckwave.js:740`, `assets/deckwave.js:1596`; target-driven rate changes at `assets/deckwave.js:1762`, `assets/deckwave.js:1763`.
3. **Fix size and risk — INFERRED:** Small-to-medium, **HEARD-PATH** either way: forwarding drift changes rate automation; removing the option can change planned order and stretch-gate outcomes. Requires the owner’s ear; do not retune the coefficient by reasoning.
4. **Testable? — INFERRED:** Yes, once the intended contract is chosen. For forwarding, use a deterministic locked 120 → 124 → 126 plan with `drift: 0.5`; after scheduling the second deck, assert `state.tempoExact === 122`. Current arithmetic yields 121.4. This checks state, not audible rates or timing.
5. **Duplicate of — INFERRED:** None.

**F24**

1. **Verdict — INFERRED: REAL for the supplied comments.** **MEASURED:** The skip comment promises fallback when either track lacks a phrase. Outgoing phrase selection controls exit/fade separately from incoming phrase selection controlling entry. **INFERRED:** A usable outgoing phrase and future phrase start can therefore produce a phrase exit/fade even when the incoming phrase is absent. **CARRIED (F24 brief):** Ledger 150c repeats the promise; confirming its current wording requires that ledger’s current text.
2. **Where now — MEASURED:** Comments at `assets/deckwave.js:919` and `assets/deckwave.js:2138`; outgoing logic at `assets/deckwave.js:1628`, incoming logic at `assets/deckwave.js:1739`.
3. **Fix size and risk — INFERRED:** Small documentation correction stating independent outgoing and incoming fallbacks; low risk. Enforcing two-sided fallback instead would be **HEARD-PATH** and require the owner’s ear.
4. **Testable? — INFERRED:** Yes as documentation: a source check scoped to these comment blocks should reject the two-sided fallback promise and require an explicit independent-fallback description. It would fail now. A mixed-availability behavioral check should already pass for the current per-side behavior; it would not justify changing sound.
5. **Duplicate of — INFERRED:** None.

| F-number | Verdict — INFERRED | Priority — INFERRED | One-line reason |
|---|---|---:|---|
| F0 | FIXED | 3 | **MEASURED:** Generation checks now cover decode success and failure. |
| F1 | REAL | 1 | **INFERRED:** Small cleanup prevents context accumulation across failed retries. |
| F2 | REAL | 1 | **INFERRED:** One escape correction fixes a directly testable filename gate. |
| F3 | FIXED | 3 | **INFERRED:** Duplicate of F0; extra cancellation would disturb newer playback. |
| F7 | REAL | 3 | **INFERRED:** Duplicate of F2; include its filename case in that check. |
| F8 | FIXED | 3 | **INFERRED:** Duplicate of F0; skip advances the generation reorder checks. |
| F10 | REAL | 3 | **INFERRED:** Duplicate of F1; use one boot-cleanup change. |
| F11 | REAL | 3 | **INFERRED:** Duplicate of F2. |
| F13 | REAL | 3 | **INFERRED:** Duplicate of F2; filename tightening can exclude decodable files. |
| F15 | REAL | 2 | **INFERRED:** Independent cache replacements can discard computed fields. |
| F19 | REAL | 3 | **INFERRED:** Duplicate of F1; include retry followed by kill in its check. |
| F20 | REAL | 3 | **INFERRED:** Duplicate of F2. |
| F21 | REAL | 2 | **INFERRED:** An insertion-time membership check prevents duplicate corpus IDs. |
| F22 | FIXED | 3 | **MEASURED:** `DB.put()` already resolves from transaction events. |
| F23 | REAL | 3 | **INFERRED:** Non-default option mismatch; behavioral repair needs an owner decision and listening. |
| F24 | REAL | 2 | **INFERRED:** Correct the supplied comments to describe independent fallbacks. |