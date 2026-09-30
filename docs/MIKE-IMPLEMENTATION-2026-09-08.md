# Reliability fixes and first UI slice — Mike

Implementation authorized after the read-only review. Work is on
`codex/mike-reliability-ui`, based on
`338bdd7681b0815f4a6e3ebbea9fac9065fe543c`. No commit or push requested.
The existing themes, neon palette, typography and instrument panels stay.

## Reliability checkpoint

[MEASURED] `node tools/check-reliability.js`: 47 checks pass against the
edited source. The same harness with its three source environment variables
pointing at the base commit's core, capture and renderer files rejects
22 of those 47 checks. Inputs are synthetic; the harness records source and
worklet AudioParam events, context ownership, stream/node lifetimes, and
output scheduling. It creates no library or audio cache and stops its fake
players/captures. The old-source snapshots are in the task's temporary folder.

The seven fixes cover shared tempo during successive overlaps, file identity,
capture replacement, cancellation across Play's boot/resume waits, final
source cleanup, choosing an exit after decoding, and refusal to render a set
with a failed decode. Export failures carry the full track name and reason.

[MEASURED] An additional check caught a stale outgoing-tempo readout and a
second requested transition overlapping the first. The readout now uses a
copy of scalar rate events and the actual audio fade start. Another requested
blend waits for the existing fade to finish. Copies retain no old audio graph.

[MEASURED] Unequal-tempo phrase overlaps consume 32 source beats with a
shared tempo, with settle both off and on. Failed Play keeps the previous
order until decoding succeeds and reports the full track name. The regression
was observed before applying that correction.

[INFERRED] The common linear tempo change fixes the measured disagreement
between trusted decks while preserving the 35% rolling target. Source position
integrates the scheduled rate, and an independent numerical integration of
parameter events agrees. This has not been heard. The 16-second live fade,
12-second offline fade, optional 45-second settle (off by default), detector
inputs and calibration values are unchanged. Unequal-tempo phrase fades
remain one phrase in source beats, so their wall duration follows the ramp.

## UI implementation and verification

[MEASURED] Build prepares copies of the analysis metadata; Load resolves a
score against copies too. Neither restamps the playing records. Playing set
reads the player's adopted order. Apply remaining preserves the exact current
track and history prefix, excludes already-played identities, and uses the
existing route repair and gate for the remainder. A missing file or player
refusal retains the preparation. A delayed Apply cannot consume a newer one.
The prepared phrase choice takes effect when the new remainder is adopted.

Play prepared starts the candidate when stopped. Save, Audit and Render
explicitly name and use the prepared set when one exists. Track actions and
panel controls are native buttons; appearance choices are native selects
styled with the existing variables. Escape restores focus from steering and
panel menus. Issues retain named analysis, playback and render failures until
cleared, with a separate polite announcement for meaningful changes.

[MEASURED] `node tools/check-prepared.js`: 13 checks pass using the real Player
and route repair under the recording AudioContext. The old dashboard fails
the feature-presence check; it has no prepared transaction to exercise.
The test covers preserved identity/classification, rejection, delayed Apply,
Stop during Play, phrase adoption and failed decoding. No music/cache writes.

[MEASURED] Browser checks at 1440×900 and 390×844 used the real dashboard,
real AudioContext, real worklet and generated silent AudioBuffers. Decode was
replaced with the explicitly synthetic fixture; master volume was zero. The
fixture's separate state output showed identical player/display identities,
an unchanged current track across Build and Apply, and an unstamped corpus.
Enter opened track actions and started prepared playback; Escape returned
focus to the originating row. Arrow keys changed the theme from cyberpunk to
amber and back. The screenshot inspection retained the original palette,
font, scanlines and panels. The narrow layout exposed the prepared controls
and readable full-name errors. Failed Play retained focus on Play prepared.
Rendering the corrupt fixture reported failure rather than producing an
incomplete download. The synthetic set also completed naturally with no
playing identity and zero live sources.

The file chooser stalled before returning, so that run does **not** establish
Load-during-play behavior. It did resolve the selected local score into a
separate preparation; the copy boundary is also in the source. Two shadow-DOM
locator evaluations timed out; no geometry or absence claim is taken from
them. Narrow-screen reachability above rests on screenshots and successful
visible-control interaction, not those failed queries.

To reproduce the manual browser fixture, run `python tools/preview-prepared.py`,
serve the repo locally and open `/tools/qa-prepared.html`. Its two generated
files are disposable. It creates no audio-library or analysis-cache entries.
The QA page was closed and its server stopped after the checks.

## Final harness sweep

[MEASURED] 923 checks ran: 919 passed, four failed because the excluded music
library was deliberately unavailable. `DECKWAVE_LIB` named a nonexistent
temporary path; no attempt was made to access the excluded library. The broad
suite uses its existing repository fixtures. Temporary logs record each
command's tally; test processes leave their synthetic objects in process
memory only. `git diff --check` passed. No commit, push or deployment occurred.

| Harness | Passed / ran | Result |
| --- | ---: | --- |
| events | 64 / 64 | pass |
| flac | 1 / 3 | two missing-library checks |
| libre | 109 / 109 | pass |
| loop | 46 / 46 | pass |
| panels | 202 / 202 | pass, including script load/boot gates |
| phone | 76 / 76 | pass |
| phrase | 48 / 48 | pass |
| player | 80 / 80 | pass |
| pool | 49 / 50 | missing-library identity check |
| popout | 27 / 27 | pass |
| recon | 137 / 137 | pass |
| route | 20 / 21 | missing-library identity check |
| reliability | 47 / 47 | new regression suite |
| prepared | 13 / 13 | new transaction suite |

`check-serve` and `check-citywalk` were not run because their paths reach the
excluded operator document and correspondence runtime respectively. Real music,
physical capture devices, audible transition quality, long-duration memory
measurement and a participant study remain unmeasured. The implementation is
ready for a listening pass; the scheduling evidence does not replace one.

- Mike
