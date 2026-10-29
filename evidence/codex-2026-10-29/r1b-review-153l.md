**311c1b0 — WRONG (INFERRED)**

- **MEASURED:** `clean()` now requires spaced separators and whitespace after leading digits (`assets/deckwave-phone.js:394`). **INFERRED:** This fixes the supplied hyphenated-title cases.
- **INFERRED:** It introduces a prefix regression: `A-ha - Song` now remains `A-ha - Song`; the old cleaner produced `Song`. `[^-]+` prevents matching a prefix containing a bare hyphen. **Falsifier:** the real module publishes `Song` for that input.
- **INFERRED — harness:** The three title cases fail the old source for the stated reason; the prefix control passes both (`tools/check-phone.js:331`). The current prefix regression passes every new check. **CAN'T-TELL:** Actual lock-screen presentation; the fake observes metadata assignments and drawing calls.
- **INFERRED — follow-up:** Permit bare hyphens within prefixes while preserving the two-spaced-separator behavior. Extend the existing cases with `A-ha - Song` and `A-ha - Album - Track - Subtitle → Track - Subtitle`. Current source fails; corrected prefix handling passes. A greedy “remove through the last separator” fix passes the first addition but fails the second. Display only.

**98e92b2 — SOUND-WITH-NOTE (INFERRED)**

- **MEASURED:** The callback rejects changed art generations, disabled art and changed `nowMeta` before creating a URL or publishing (`assets/deckwave-phone.js:478`, `assets/deckwave-phone.js:486`). **INFERRED:** This fixes both stated late-callback failures.
- **INFERRED — remaining defect:** The captured identity comes from `DW.nowMeta`, while the image comes from `bnd.D.now` (`assets/deckwave-phone.js:452`, `assets/deckwave-phone.js:470`, `assets/deckwave-phone.js:477`). A visible-page bundle still showing A can therefore be published and permanently cached as B’s poster. This predates the commit. **Falsifier:** supply current metadata B with bundle A and observe that A’s poster is rejected.
- **MEASURED:** `setArt('off')` drops `artUrl` without revoking it (`assets/deckwave-phone.js:584`). **INFERRED:** This existing URL leak remains. **Falsifier:** a revoke spy records that published URL being revoked when art is switched off.
- **INFERRED — harness:** Both stale cases correctly fail old source. However, the “next tick draws” control is **decoration for recovery**: B already received artwork at `tools/check-phone.js:386`, and returning to B republishes it before the final tick. The assertion at `tools/check-phone.js:400` requires no new draw. A fix leaving `artBusy` stuck after the track-mismatch rejection can pass that control. Observing a new draw on that final tick would falsify this diagnosis.
- **INFERRED — follow-up:** Reject mismatched bundle/metadata identities; revoke the URL before dropping it. Strengthen recovery using a never-rendered destination and a draw-count increase, retaining the stale-publication assertion that fails old source. A mismatched-bundle test fails current source; a matching-bundle recovery control excludes simply disabling artwork. Display/resource lifetime only.

**29858fb — WRONG (INFERRED)**

- **MEASURED:** Dashboard primitives now return their logged answers; `steer()` checks those answers (`assets/deckwave-dashboard.js:1039`, `assets/deckwave-dashboard.js:1060`, `assets/deckwave-dashboard.js:1235`; `assets/deckwave-events.js:153`). **INFERRED:** Serial refusals are reported correctly.
- **INFERRED — new regression:** An older request can corrupt a newer decision. Both refusal branches mutate shared `last` after awaiting (`assets/deckwave-events.js:155`, `assets/deckwave-events.js:177`). Start two steering requests, finish the newer successfully, then finish the older with `superseded`: the newer decision becomes `refused` with the older reason. **Falsifier:** that ordering leaves the newer decision unchanged.
- **INFERRED — harness:** The refusal, returned-value and reorder-line assertions fail old source for the intended reasons (`tools/check-events.js:140`, `tools/check-events.js:158`; `tools/check-panels.js:1811`). All calls are serial, so the ownership bug passes. **CAN'T-TELL:** Whether the unshown engine’s complete success vocabulary matches `/^blending in\b/`; stubs cannot establish that a crossfade was actually scheduled.
- **INFERRED — follow-up:** Capture each decision object locally and update that object after awaiting. Add two deferred, same-target requests resolved in reverse order: current source fails, local ownership passes. Ignoring every `superseded` answer could also pass that race case; include a sole-current-request `superseded` refusal control.
- **MEASURED — HEARD PATH:** The existing blend/reorder calls and arguments remain in place (`assets/deckwave-dashboard.js:1043`, `assets/deckwave-dashboard.js:1235`). **INFERRED:** This diff changes reporting, not their intended audible behavior.

**8362046 — SOUND-WITH-NOTE (INFERRED)**

- **MEASURED:** GNU naming now uses the final path segment and distinguishes four licence families (`assets/deckwave-libre.js:213`). **INFERRED:** It fixes the stated misnaming for the supplied URLs.
- **INFERRED — regression:** Leading whitespace is accepted by `licenceHost()` but mishandled by the newly required path parse. For example, ` https://www.gnu.org/licenses/gpl-3.0.html` now returns `null`, where old source returned `GPL` (`assets/deckwave-libre.js:186`, `assets/deckwave-libre.js:211`). **Falsifier:** that exact input returns `GPL`.
- **INFERRED — harness:** Eight expectations fail old source; five GPL controls pass (`tools/check-libre.js:264`). The whitespace regression passes the entire table, as would incorrectly rejecting every FSF URL: no positive FSF case is present. **CAN'T-TELL:** The legal content of any URL; this is string recognition.
- **INFERRED — follow-up:** Use the same trimmed input for host and path parsing; extend the existing table with whitespace and positive FSF cases. The whitespace addition fails current source and passes consistent normalization. An always-`GPL` fix remains excluded by the existing family/refusal cases. Display/attribution only.

**67e8875 — SOUND-WITH-NOTE (INFERRED)**

- **MEASURED:** Both UI search paths share a generation counter and guard success and failure writes (`assets/deckwave-libre.js:875`, `assets/deckwave-libre.js:880`, `assets/deckwave-libre.js:973`, `assets/deckwave-libre.js:984`, commit-local lines). **INFERRED:** This correctly implements “last search requested wins.”
- **MEASURED:** Source selection alone still only updates selection/UI (`assets/deckwave-libre.js:827`). **INFERRED:** The acknowledged limitation remains; existing requests also retain their network/limiter lifetime. No new regression is evident in the shown callers.
- **INFERRED — harness:** All three cases fail old source through stale row/footer writes (`tools/check-libre.js:789`, `tools/check-libre.js:798`, `tools/check-libre.js:813`). An Archive-only fix passes all three. The cross-source case is **decoration for stale Commons completion**, because Archive is the stale request. **Falsifier:** removing the Commons generation guards makes these additions fail.
- **INFERRED — follow-up:** Add older-Commons success/error cases followed by newer Archive searches, including an older completion while the newer request remains pending. Old source overwrites the newer state; current guards preserve it. Existing successful Commons rendering excludes a wrong fix that drops all Commons results. The fake can observe assigned rows/footer, not browser layout. No direct heard-path change.

**aae4eda — SOUND-WITH-NOTE (INFERRED)**

- **MEASURED:** The live-body clone is removed; caching starts only after `readBody()` succeeds, with an immediately attached rejection handler (`assets/deckwave-libre.js:351`, `assets/deckwave-libre.js:372`). **INFERRED:** This fixes the tee-held cancellation and unhandled cache-rejection window.
- **MEASURED:** Cache writing is now serialized after reading, and the reconstructed response retains only synthesized Content-Length (`assets/deckwave-libre.js:373`). **INFERRED — potential HEARD PATH:** Cold-load completion can be later because cache writing is now additional work after the read. **CAN'T-TELL:** Audible entry timing or phone memory impact without the engine/device. Shown cache hits consume bytes, so losing Content-Type does not directly break that reader (`assets/deckwave-libre.js:327`).
- **INFERRED — harness:** The tee fake makes old source drain instead of cancel; the quota fake exposes its rejection window (`tools/check-libre.js:854`, `tools/check-libre.js:872`). Those are meaningful failures. **CAN'T-TELL:** Actual browser network cancellation; the fake implements the cancellation behavior being asserted.
- **INFERRED:** The “all of its bytes” control is **decoration for byte integrity**: it checks lengths only (`tools/check-libre.js:885`). Caching a zero-filled buffer of the correct length passes all three additions. **Falsifier:** that mutation fails these assertions.
- **INFERRED — follow-up:** Add byte comparisons as controls within the existing cap/quota regression scenarios. The cap/quota scenarios remain red on old source; byte equality alone must not be advertised as a new red regression test. The no-reader fallback and existing cache-hit paths also remain outside body validation (`assets/deckwave-libre.js:272`, `assets/deckwave-libre.js:327`).

**6adf078 — SOUND-WITH-NOTE (INFERRED)**

- **MEASURED:** `return await r.json()` now precedes `freeSlot()` in `finally` (`assets/deckwave-libre.js:402`, `assets/deckwave-libre.js:406`). **INFERRED:** Successful bodies retain their slot; rejected JSON still releases it and rejects without retry. No new regression is evident.
- **INFERRED — harness:** Old source releases slots with unresolved JSON promises and issues the third request, violating the assertion (`tools/check-libre.js:899`, `tools/check-libre.js:907`). The fake meaningfully observes promise/slot ordering, not physical network transfers. A wrong fix releasing slots only on successful JSON still passes and would leak slots on rejection.
- **MEASURED:** Retryable HTTP responses still bypass body consumption/cancellation (`assets/deckwave-libre.js:396`). **INFERRED:** The check does not establish a universal two-transfer limit for slow error bodies. **Falsifier for that remaining gap:** an intentionally open error body is canceled or finishes before its retry starts.
- **INFERRED — follow-up:** Add a rejected-JSON variant retaining the initial “third request waits” assertion, then require the queued request to proceed without retrying the rejected JSON. Old source fails the initial ordering; current source passes; the success-only release fix fails recovery. Abandoned HTTP-error bodies are a separate existing lifetime issue.

**CAN'T-TELL — Remaining nine commits:** Their identities and diffs were not supplied, so the requested sixteen-commit sign-off is incomplete.

**INFERRED — Ranked fixes before the keeper listens:**

1. Fix `steer()` result ownership so older refusals cannot falsify the listening record.
2. Fix mismatched artwork bundles and replace the decorative redraw control.
3. Restore hyphenated-artist prefix handling and revoke discarded artwork URLs.
4. Strengthen cache-byte and rejected-JSON controls before treating these harnesses as evidence of complete resource handling.