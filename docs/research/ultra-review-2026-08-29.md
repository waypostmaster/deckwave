# Ultra review (cloud, three slices) — 2026-08-29

The pre-launch multi-agent cloud review, run by the keeper. The repo has no
main branch and the whole tree (61k lines) exceeds the 8,000-line review
limit, so it went as three chained branches built from master's content,
each commit carrying the house rules as binding review context:

- `ultra-1-engine` (7,255 lines): deckwave.js, nav/score/phrase/events/
  loop/render, stretch wrapper, cache, flac, listen, phone, libre,
  serve.py, package.py, index.html.
- `ultra-2-face` (5,250): dashboard, panels, nowplaying, sprites,
  visuals, panel-*, popout.
- `ultra-3-proofs` (4,167): the eleven check-* harnesses, phrase-scan,
  measure-worklet, speak.py, register.py, recon-shot.py, the example
  embed.

Excluded by design: `extensions/` (deep-reviewed 2026-08-28 —
`code-review-console-2026-08-28.md`), `vendor/` and
`deckwave-stretch.module.js` (pinned third-party), docs/evidence/_source
(records, not code).

**12 findings: 3 NORMAL, 9 nits.** Every one re-verified against this tree
before being written down; two were extended by that verification (see
E1 and F1). **Nothing here has been fixed** — E1 in particular is the
keeper's call and nobody's else's.

**Caveat on completeness, keeper 2026-08-29:** the runs returned API
errors and a classifier interruption. The findings below did arrive, but
the engine slice returned only 2 findings for 7,255 lines, which is thin
against the other two slices' density — **treat slice 1 as possibly
truncated, not as a clean bill.** A re-run is justified for that slice.

---

## E — Slice 1/3, THE ENGINE (2 findings, both NORMAL)

### E1 · `CAMELOT_MINOR` is a copy of `CAMELOT_MAJOR` — the wheel encodes PARALLEL keys where it means RELATIVE

**`assets/deckwave.js:119-120`. NORMAL. Verified, extended, and NOT
fixed — this one needs the keeper and the ear.**

Every entry of `CAMELOT_MINOR` equals `CAMELOT_MAJOR` for the same letter
(A:11 both, C:8 both, E:12 both — the two tables are the same numbers).
So a minor key gets the number of the major sharing its TONIC, not the
major sharing its KEY SIGNATURE. Against the standard wheel every minor
value is **+3**: A minor reads 11A where the standard says 8A.

`camScore()`'s `na === nb` branch pays **0.85 "relative"**. With this
table it pays that to PARALLEL pairs (C major ↔ C minor, 3 shared pitch
classes) and drops true relative pairs (C major ↔ A minor, all 7 shared)
to **0.08 — the clash floor**. Key is 0.30 of every candidate score in
`sequence()`, `DWNAV.plan()`, `planFast()`, `resequenceTail()` and
`optionsFull()`, so it reaches every set and every route.

**What the review did not say, and what changes the size of it (measured
here, `evidence/deckwave-cache-v1-2026-08-17.json`, 219 records):**

- The offset is **uniform**, so it cancels within a mode: **minor↔minor
  and major↔major pairs score exactly as they should.** Only cross-mode
  pairs are wrong.
- The corpus is **196 minor / 23 major**. Cross-mode pairs are
  **18.8% of ordered pairs** — and of those, only **3.2% of all pairs**
  actually score differently (most cross-mode pairs are unrelated under
  either wheel). Same-mode pairs that differ: **0**, measured, which is
  the uniform-offset claim confirmed rather than argued. That is why "Moments → Alive → FINAL CHAPTER → ROCK 64" could be
  *"hot. Nice mix."* with this live.

**And the migration trap, which the review missed entirely:** `camelot`
is computed ONCE at analyse time (`deckwave.js:307`) and STORED on the
record. Fixing the table alone gives a **mixed corpus** — 189 cached
tracks keep parallel-based codes, anything newly analysed gets
relative-based ones, and `camScore` compares the two against each other.
That is worse than either consistent state. A fix must ship with either
(a) `ANALYSIS_V` bumped → a full 12-minute rescan, or (b) a cheap
migration recomputing `camelot` from the stored `key` + `scale` (both are
in every record; no audio decode needed). **(b) is the right shape.**

**Why it is not fixed here.** It changes what the sequencer does for
every set the keeper has ever heard, and the ear has confirmed sets built
on the current table. That is CLAUDE.md's rule exactly — say so, and ask
for the test. **The keeper decides; a LISTENING section is the right
next step, with the A/B being the same seed track under both tables.**
Note the honest complication: the fixed table is *correct*, but "correct"
here is a claim about the Camelot standard, not about what sounds good on
this corpus — and only 3.2% of pairs change at all, nearly all of them
involving the 23 major tracks.

### E2 · `norm()` and `analyse()` disagree on the stem — Commons `.opus`/`.oga` ingest silently breaks at playback

**`assets/deckwave.js:90` vs `:291`. NORMAL. Verified.**

`norm()` strips only six known extensions
(`flac|mp3|wav|aiff|m4a|ogg`); `analyse()` strips ANY final suffix
(`/\.[^.]+$/`). For an extension outside that six the two disagree by the
extension itself: `LIB.files` is keyed `songopus` while the record's name
is `Song`, so `LIB.find()` later looks up `song` and misses.

Local paths never expose it — `walk()` and the file input both gate on
`AUDIO_RE`. **The libre Commons path does not gate at all**: it searches
`filetype:audio` (`deckwave-libre.js:401`) and hands any hit to
`DW.ingest`, and the module's own header says most Commons audio is
Ogg/Opus. So on Chromium/Firefox the panel says `✓ added`, the track
lists, and play fails `missing file: <name>`. On WebKit it is masked
because decode refuses Opus first (already documented).

`norm()`'s own comment says *"Keep this list in step with AUDIO_EXT
below"* — this is that comment's failure mode, arriving through a path
added after it was written. Fix: add `opus|oga` to `norm()` (and
`AUDIO_EXT`) so both canonicalisers agree. **Safe — no threshold, no
detector, one lookup path.**

---

## F — Slice 2/3, THE FACE (6 findings: 1 NORMAL, 5 nits)

### F1 · XSS via `javascript:` URL in a loaded score's `source.page`

**`assets/deckwave-nowplaying.js:266`. NORMAL. Verified.**

The attribution anchor interpolates `esc(t.source.page)` straight into
`href`. `esc()` blocks markup, not URL schemes, and the parser decodes
entities before dispatching the URL — so `javascript:…` survives. The
chain is real: `deckwave-score.js:230` copies `s.source` onto the meta
with no validation, and `▴ load set` accepts a JSON file — which the
dashboard's own `esc()` comment already names as *"a file this project
intends to accept from strangers"*, warning that injected script inherits
the live `FileSystemDirectoryHandle` for the music folder plus network.
One click on the ⊙ credit link — a link that exists to be clicked — runs
attacker JS in the page origin. `rel=noopener` does not help; it gates
`window.opener`, not scheme evaluation.

Fix: allowlist `http:`/`https:` through `new URL()` before building the
anchor; fall back to plain-text credit. **This is the one finding in the
whole review that is a launch-day concern** — the tree goes public on
2026-09-01 and score-sharing is a designed-for workflow.

### F2 · `clean()` eats hyphens inside titles

**`deckwave-nowplaying.js:94`. Nit — but DEMONSTRATED, not traced.**
The double `/^[^-]+-\s*/` strip is ungated (`\s*` matches zero spaces),
so the second strip fires on a title's own internal hyphen. Run here:
`LukHash - 8-Bit Warrior` → **`Bit Warrior`**. It reaches the card
headline and the next line — the one surface whose whole job is naming
what is playing. `panel-route.js` documents this exact bug family and
works around it (`split(' - ').slice(-1)`); this module copied the
double-strip without the workaround, while `deckwave-dashboard.js:747`
avoids it by doing only one generic strip. Fix: require a spaced ` - `,
or split-take-last like the sibling.

### F3 · The drop-target outline never renders

**`deckwave-dashboard.js:300`. Nit.** `#deckwave.dropping .app` lives
INSIDE the shadow-root stylesheet, but `#deckwave` IS the shadow host —
a selector inside a shadow root cannot reach the host by id. The class
does land (`host.classList.add('dropping')`, line 798) and the drop works;
only the visual affordance is missing. Fix: `:host(.dropping) .app`.

### F4 · `applyRoute` leaves the nav queue set when the commit fails

**`deckwave-dashboard.js:856`. Nit.** `N.setQueue(entry)` runs before
`N.commitAndRepair(set)`, and `commitAndRepair` only reaches its
`clearQueue()` on the success path (`deckwave-nav-commit.js:218`). On
`!r.ok` the rejected route keeps rendering — the wayposts spiral and the
`.queued` row outline — until the next successful commit. **The review's
own proposed fix name is wrong** and it says so: `clearRoute()` clears
`active`, not `queue`; the right call is `N.clearQueue()`. Display-only,
and it needs an async race (the set replaced between `openNav` and the
menu click) to trigger.

### F5 · Duplicated CSS block

**`deckwave-dashboard.js:204-205` and `330-331`. Nit.** Four rules for
`data-side="hide"` / `data-dense="1"` exist twice, byte-identical. Equal
specificity, so the later copy silently wins — an edit to the earlier one
does nothing. Keep the later block (it carries the unique
`data-side="wide"` and `.tr` rules).

### F6 · `nowplaying` re-inlines the loop `drawBars()` was extracted for

**`deckwave-nowplaying.js:335-344`. Nit.** `drawBars(D)`'s own comment
says *"shared by both paths. Was inlined in the track path only."* The
listen and stopped branches call it; the track branch still holds the
byte-identical copy, so five calibrated constants (2.2, 22, 200, 255, 2)
live in two places. Fix: `drawBars(D);`.

---

## P — Slice 3/3, THE PROOFS (4 findings, all nits)

**None in the harness checks themselves.** After ledger 98 (three
decoration checks caught the day before), the eleven `check-*` files
coming back clean is the answer worth having.

### P1 · `phrase-scan.js` and `measure-worklet.js` still assume a flat library

**`tools/phrase-scan.js:78`, `tools/measure-worklet.js:123`. Nit.**
Both do `path.join(LIB, name)` while check-flac / check-pool /
check-route grew recursive walkers for the 2026-08-21 clearance
subdirectories **in the same commit**. Both tools last ran before the
move, so the existing evidence is sound. The dangerous half: a re-run
today prints `missing` per record and **phrase-scan still writes an
evidence JSON whose summary is computed over N=0** — a file that looks
like data and describes zero tracks. Fix: reuse the sibling walker.

### P2 · The example's beat flash decays before it is drawn

**`examples/soundtrack.html:79-80`. Nit.** `flash` is set to 1 (downbeat)
or .55, then `flash *= .92` runs unconditionally in the same frame, so
the configured peaks never reach the canvas. Cosmetic — but the file's
header calls itself the copy-paste example and `GAME-INTEGRATION.md`
points integrators at it, so the pattern propagates. Fix: `else`.

### P3 · `speak.py` error path strips before filtering

**`tools/speak.py:92-93`. Nit.** `[:-5]` is applied to every file and
THEN `.onnx` is filtered — the inverse of `list_models`' correct
filter-then-strip ten lines above. Stray files become garbage
suggestions (`notes.txt` → `note`, `a.md` → empty). Fix: copy line 76.

### P4 · `--speaker 0` is indistinguishable from unset

**`tools/speak.py:102`, also `:98` and `:105`. Nit.** `speaker or None`
makes an explicit `--speaker 0` — documented, and `--list` advertises
`0..N-1` — arrive as None: piper warns "speaker_id not specified", picks
its default by luck, and the label drops `#0`. Current piper happens to
default to 0, so the audio is usually right and the log is wrong. Fix:
argparse `default=None` and `is not None` at the three sites.

---

## Postscript — ALL TWELVE ACTED ON, same day (keeper's word)

Keeper, on reading the above: *"Is there any way to build whatever it
thinks was the 'proper' version as a uncheck this 'deckwave tune' box?
so we're not messing up my mix but people can do whatever it is the
reviewer thought was important? and then strip out any surface for json
injection / XSS issues unless it was load-bearing. and then fix the
nits."* All three, in that order. Ledger rows 101–106.

**E1 became a select, not a swap** — `tune` in ⚙, deckwave tune the
default, `DW.retune()` restamping the corpus from stored key+scale, and
`ingest()` restamping on the way in so a cache hit can never carry the
other tune's code. **LISTENING §23 is the A/B, and the standard wheel is
UNHEARD.** Eight new checks in `check-pool`, one of which derives the
standard wheel from the circle of fifths rather than copying the table
it is checking.

**The XSS surface was gated everywhere it exists, not just where the
review found it** — the now-playing card AND the libre panel's Commons
links (`descriptionurl` comes back from an API; the Archive's page URLs
are built locally and were safe by construction). Nothing was
load-bearing: a rejected URL still prints its credit as text.
**`check-libre`'s own check for that line was pinning the vulnerable
shape** — asserting `esc(t.source.page)` was present, which was exactly
the defect — and now requires the scheme gate.

**Three things the review got wrong or missed, all found by verifying
before fixing:**

1. **The migration trap** (E1): `camelot` is stored per record, so
   fixing the table alone gives a mixed corpus. Not mentioned.
2. **F2 is TWO copies, not one.** The review declared the dashboard's
   `clean()` safe because it does a single generic strip; it is not — it
   eats `8-` out of `8-Bit Warrior` by a different route, on the track
   list, the more visible surface.
3. **The first fix for F2 was itself wrong**, and a behavioural check
   caught it: requiring a spaced ` - ` fixed the second strip and left
   the third (`\d+\s*`, the track-number strip) eating the bare `8`.
   Both copies now gate that on real whitespace. **This is the sharpest
   lesson of the pass — a text harness pins the shape of a fix, not its
   behaviour, and a regex fix is exactly where those come apart.**

**The one carried-over policy question is now CLOSED:** the query-string
strip on RECON's copyable stage links stays, keeper 2026-08-29
(*"query-string strip seems reasonable"*). Neither review has an
unresolved item left.

`check-pool` 33 → 43, `check-panels` 44 → 53, `check-libre` 87 (one
rewritten); 551 across eleven harnesses, all green. Every new check
failed against the pre-fix source first.

## Standing

**Launch-relevant: F1 only.** It is the single finding that is a real
vulnerability on a public tree with a share-a-score workflow.

**Keeper's decision, not mine: E1.** It changes every set. The
measurement above (3.2% of pairs actually change, 196:23 minor:major) and the migration
trap (stored `camelot`, so a fix needs a recompute pass) are what the
decision needs; the ear is what settles it.

**Safe to fix on the keeper's word: E2, F2–F6, P1–P4.** None touches a
threshold, a calibration constant, or a detector.
