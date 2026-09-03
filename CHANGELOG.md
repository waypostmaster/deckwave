# Changelog

Versions are recorded here and in the package filename. Earlier packages from
the 2026-08-17 session were overwritten in place and no longer exist — this
file begins the lineage that will be preserved.
## 0.8.2 — 2026-09-03 · 0.8.1 did not boot

**0.8.1 as tagged went to GitHub Pages with a page that could not boot.**
The keeper saw it within the hour: *"failed to load: DWNOWPLAYING,
DWDASH"* on deckwave.fm. Two modules PARSED and threw on load — a comment
inside the CSS template literal in each of `deckwave-nowplaying.js` and
`deckwave-dashboard.js` contained backticks, which closed the literal and
turned the file into a tagged-template call: valid syntax, a `TypeError`
at run time. The 990-check sweep was green because the only whole-file
check on those modules was `vm.Script`, which parses and does not execute
(ledger 111's fix, one step short). Ledger 132.

0.8.2 is the two-word fix plus the gate that was missing: `check-panels`
now EXECUTES every script `index.html` loads, in order, in a sandboxed
window, and demands the boot gate's globals exist afterwards. Against the
0.8.1 tree it fails on exactly the two modules the page named; against
this one it passes. **Harnesses 990 → 992.** The 0.8.1 package stays in
`_source/` as the counter-example, marked as such.

## 0.8.1 — 2026-09-03 · the review release

**Every finding of the launch-day review (`docs/REVIEW-2026-09-01.md`) is
resolved, measured, or written down as the keeper's call.** Nothing moved a
threshold, calibration or detector; nothing in it has been heard.
BUILD-LOG Act 41 and ledgers 122–131 are the record.

What a user could notice, in order:

- **Security and manners.** `serve.py` no longer serves `.git` through NTFS
  8.3 short names (`/GIT~1/HEAD` is 403 — under `--lan` that was the
  private history one request away); `docs/RUNBOOK.md` is denied;
  content types come from an explicit table, not the Windows registry;
  `/music/` answers `Range` requests so a phone download can resume.
  `⊕ libre` recognises a licence by its HOST, not a substring of an
  uploader's URL (a wrong name reached the card, the score and the
  `.cue`'s `REM ATTRIBUTION`); reads a no-derivatives term from the short
  name too; refuses a file over 256 MB (chosen) once instead of
  downloading it three times; refuses a truncated body instead of caching
  it as the track; and gates Commons hits on an audio MIME type.
- **Memory and the deck.** A handed-over deck is released (the worklet
  kept every deck alive — measured, five handovers went 691 → 1,956 MB
  before, flat after); the handover timer re-arms from the audio clock
  after a pause; a `setPhrase()` re-chain can no longer schedule an exit
  in the past; the attribution link on the card can be clicked by a
  human (it was rebuilt every frame).
- **Ledger 82 closed on all five surfaces.** A jumped-to deck used to
  print `+0.00%` / `×1.000` / `PHASE LOCKED` as the tightest beatmatch on
  screen; the engine now stamps every deck with `origin: 'play' | 'chain'`
  and a derived `matched`, carried through `DWEVENTS.pulse()`, and every
  surface reads the fact. The score and cue say `FIRST (nothing to
  match)` for track 01 instead of `STRETCH 0%`.
- **Events and the voice.** A negated instruction ("don't speed up") is
  refused with a sentence instead of steering the wrong way; a stuck
  utterance releases the duck on a chosen guard; a zero in `voiceCfg` is
  honoured (a fader at 0% used to speak at full volume); `speak()`'s
  0.55× duck and the 0.3× event duck are documented as separate.
- **Panels.** One spectrogram implementation instead of a live patch
  quietly overriding a stale copy; the dashboard's five unreachable panel
  copies (with their own copies of four calibrated numbers) deleted; the
  energy window lifts its pen across a hidden-page gap; a panel shown in
  the projector no longer advances twice; the projector uses its own
  screen's pixel ratio and releases butterchurn on close; five glossary
  links fixed; the boot gate lists the modules the page actually needs.
- **Phone.** The lock-screen card says paused when the set is paused;
  the focus-holding loop stops when the set ends; no AudioContext is
  built at load by a saved mode.
- **RECON and citywalk.** The threat model is stated at its real level
  (the feed is a filesystem write on the host, the tray is per-browser);
  the feed is read by tail offset; a blank vocals fragment no longer
  matches every track; notes are capped on the stage; fed rows cannot
  wear the operator badge; a rendered take keeps its card across a hot
  swap; citywalk applies `voiceCfg` once and does not recite a switched
  feed. Every voiceCfg key the parser reads is documented with its range.
- **Tools.** `package.py --force` no longer silently waives the
  dirty-tree refusal (`--dirty` is its own explicit flag); `helm.py take
  --who` records the task, not the session name; `speak.py --out` is
  gated to `speech/`; `.gitattributes` makes line endings a rule instead
  of twelve `.replace()` calls.

**Harnesses 694 → 990 across fourteen** — `check-loop` is new (the
bundle every panel is written against had no harness), `check-serve`
starts the real server and sweeps every other harness for the exact
tally line, and every new check was shown failing against the previous
source first. **CLAUDE.md is a quarter of its size**; the retired
narrative is whole in `docs/CLAUDE-STATE-2026-09-01.md`. Left for the
keeper's ear, stated at both sites: whether a grid-unlocked track should
leave on the clock or on its distrusted downbeat when `next ▶` is pressed.


## 0.8.0 — 2026-09-01 · public

**The launch release: the first one anyone but the keeper can run.** Pushed to
GitHub on 2026-09-01 (`docs/LAUNCH.md` is the checklist), under AGPL-3.0
because Essentia.js is.

**The version was HELD at 0.8.0 by decision** while the work kept landing, so
this entry covers 2026-08-19 through launch and the number does not move for
any of it. In that window, in order:

**RECON, the first extension** (`extensions/recon/`, 2026-08-22) — a read-only
ops screen where the agent's activity feed is the display and Deckwave is the
soundtrack behind it; fed by appending JSON lines to `recon.jsonl` (the how-to
is in the file header), records land on the assumed downbeat via
`DWEVENTS.pulse()`, and silence over five minutes is reported as "cannot tell
working from stopped" rather than looking calm. It grew a **reply tray** (off
by default — music words act locally at once, anything else is stored with
provenance for the agent to read, quote and confirm; a message tray, not a
command line), took the hosted console artifact's register on the live screen
(accent hue from the playing key, a `--beat` envelope off `pulse()`), and
became **hot-swappable**: a `{"reload":true,"ts":…}` feed line re-fetches the
console's own code and re-boots it without touching the deck iframe, so the
music plays through its own upgrades. `extensions/SKILL.md` and
`extensions/recon/SKILL.md` are the family the deck's own SKILL.md heads.

**CITYWALK, the second extension** (`extensions/citywalk/`, 2026-08-30) — a
read-only screen that walks a containment tree (a building and its floors, a
filesystem, a document outline) to the deck's beat clock, driven by
append-only files in its own directory. It ships to make one argument:
**its rain is real bits of real text.** Every glyph is a bit of the encoded
corpus, and a missing corpus draws nothing and says so rather than inventing
characters — the rain it is answering picked each glyph from a hash of
position and time, which looks like data and is not. The shipped corpus is
the extension's own design statement, house words only, naming nobody; the
shipped walk is labelled `sample:true` on every row behind a lamp that clears
itself the moment a real record lands, because a demo presented as an
observed walk would be the same invented-data failure. Its two live buses are
gitignored and a check asserts those `.gitignore` lines rather than trusting
them, so whatever a real feed carries can never reach the repository. It
reaches nowhere off-origin, holds no write-capable call, and a click on a
place only queues a request — `window.CITYWALK.drain()` hands it to whatever
drives from outside, and a pending request stays pending until the world
actually moves. `tools/check-citywalk.js` is its harness, 39 checks.
Last in (2026-08-28) the console got the two halves it had been missing.
A **stage** — the frame the agent was looking at, above the feed: one
still at a time, with its url, title, status, the agent's own note and up
to twelve outbound links that copy rather than follow. It is the idea
this screen started from (a read-only what-the-agent-is-looking-at
overlay) arriving last, and the whole of its design is refusing to
overstate itself: **the console sees nothing by itself** — it never
screenshots, scrapes or navigates, a frame is handed to it by whatever
drives the browser, every frame is labelled a *still* with its age, and
past ninety seconds it says the agent may be somewhere else. There is no
field for page text, deliberately. `tools/recon-shot.py` is the producer
half. And an **instrument column**: now
playing, the scheduled incoming with a Camelot wheel and the crossfade the
engine is actually running, and a ribbon of the whole set's energy arc and
playing tempo with the playhead on the deck's own track. Every figure is
read off the deck rather than derived from a clock, it is read-only by
decision, and it keeps the three rules the deck keeps — no stretch
percentage against a track played straight or against the first deck, no
numbers on the energy axis, and the bar counter says *assumed*.

**The voice** (2026-08-22 → 27, BUILD-LOG Acts 36–37) — Claude's replies read
aloud without losing the music. `DWEVENTS.speak` speaks in the same session as
the deck with the deck's own duck restored exactly; the depth is its own
tunable (0.55× — 0.3 was "too much" by ear), and the whole pipeline was locked
live by the keeper mid-set: gain 1.62, room 0.3, the facility chain
(`evidence/voice-pipeline-2026-08-23.md` is canon; nobody moves those numbers
by reasoning). Rendered speech through the deck graph rather than a speech
session means nothing ducks it and the volume knob is real. `tools/speak.py`
renders offline through **Piper** (the SAPI recipe is the fallback); `--voice`
takes any local `.onnx`, which is the side-load seam — models used locally,
never shipped. Speaker 99 (p303) at grade `facility` is the settled register.
And because the analysis is **vocal-blind** (ledger 76, the same class as the
loudness-blind exit), a voice record is gated on a keeper's-EAR list of sung
tracks checked through `pulse()` before it plays — unheard, LISTENING §18.

Also in the window: `examples/soundtrack.html` and `docs/GAME-INTEGRATION.md`,
`DWEVENTS` (inject/pulse), the popout, Android call handling, download
percentages, and the fold — BUILD-LOG Acts 33–37.

Between 0.7.3 and this: a phone layout (two panels per
screen, `☰ set` for the list and the card, the log line first in the transport
and above Safari's toolbar), energy-over-the-last-X-minutes tiles, an
installable web-app manifest and icons, a screen wake lock held for the length
of a scan, and a `phone:` option — `keep screen on` (a wake lock, confirmed
on the iPhone) and `background audio` (`navigator.audioSession.type =
'playback'`, the one property WebKit's source keys on to leave a Web Audio
graph running at lock — read from the source, then **heard on the device the
same evening: the set kept playing through the lock**). The earlier
`lock-screen audio` experiment fell on the
device and is out of the menu. **Lock-screen art** (`lock art:`): a poster
per track on the Now Playing card, or a chosen panel redrawn once a second —
the latter an experiment on whether iOS repaints the card at that rate.
**`next ▶` blends** instead of cutting — next downbeat, the set's crossfade
(`DW.skip({cut:true})` is the old cut). **`phone: background + lock
controls`**: a silent media element takes the Now Playing card so its
▶▶ ◀◀ ❚❚ work and the scrubber shows the deck — **confirmed on the iPhone
the same night** ("It works"); whether ▶▶ *blends* rather than cuts is still
its own open question, LISTENING §11. The Apple Watch is the one surface
that does not work: the title reaches it, the commands do not come back
(ledger 80 — a watchOS routing limit with no web-side lever).
**`build · phrase match`** (2026-08-19, late): a third build — the best-matches
list with every transition on an 8-bar phrase of both tracks and a
one-phrase fade; `next ▶` goes to the phrase on that build only. The offset
comes from `DWPHRASE` (least within-phrase variance of four per-bar
series, computed from the playback buffer the first time a track plays and
kept in the cache), with its contrast printed beside every `¶` in the log.
Measured across the library (BUILD-LOG Act 29), **unheard** — LISTENING §12.
**The held worklet** (same night, ledger 65): the vendored SoundTouch 2.1.1
processor zero-fills a 2.9 ms block a few times a minute at any rate ≠ 1.0 —
measured offline, and the keeper heard "limited poppy static" on a ×1.001
chained deck on the iPhone. `assets/deckwave-stretch.js` holds one render
block in the worklet's output (vendored text + wrapper loaded as one module;
the vendored file is untouched; plain fallback if a platform refuses it),
and every deck now reports the worklet's own gap count — `⚠ name · N
worklet gaps` in the log at a handover, `held worklet` / `plain worklet` on
the first play line. Zero gaps offline at every rate; unheard on the phone.
After the next faint-popping report arrived with no way to tell which pipe
had run (the demo discarded the play line; ledger 69): the held worklet now
loads from `assets/deckwave-stretch.module.js` — a checked-in concatenation
of the vendored processor and the wrapper, same-origin, nothing for a
platform to refuse (blob fallback, plain third; the harness asserts the
concatenation cannot drift) — the ▶ demo logs which worklet it got, and the
now-playing card shows `⚠ plain worklet` / `⚠ N gaps` whenever either is
true, staying silent when clean.
**Wikimedia Commons as a second `⊕ libre` source** (2026-08-20): a source
select in the panel; Commons hits are single files, fetched through the
same polite pipeline with licence, creator and page attached; measured
CORS-open end-to-end before wiring, and a CC0 Opus went search → fetch →
beat grid live. Ogg/Opus does not decode on an iPhone (WebKit); MP3/WAV/
FLAC Commons files work everywhere.

**What was measured before the date, on the keeper's own iPhone 16 Pro Max
(iOS 26.6):** the whole 189-track library analysed on the device — the folder
picked through the iOS 18.4+ `webkitdirectory` picker after arriving as one
zip over `serve.py --music` — and a set played. What is and is not HEARD is in
`docs/LISTENING.md`, unchanged in policy: unheard ships tagged unheard.

**The date.** 8/24 — eight bars of four — chosen by the keeper. When it was
chosen it was the phrase boundary the engine could not detect; as of the
evening of 2026-08-19 it can, on one build, unheard — so it was a promise.
Moved 2026-08-27 to **August 32nd** — 8 bars of 4 is 32 beats, a date that
exists only in music — 2026-09-01 in human-speak.

## 0.7.3 — 2026-08-19 · two builds, and a music root for the phone

**Build is a choice now** — keeper: *"maybe that should be a choice — between
build set (best matches) vs build set (all tracks)."* `build set · all tracks`
is 0.7.0's no-discard build (unreachable tracks play straight). `build · best
matches` keeps only tracks that can be beatmatched from where the set is —
locked grids, every transition inside the gate — and ENDS when the gate is
exhausted, reporting what it left out and why (`DW.inspect`: `leftOut`,
`leftOutGrid`, `leftOutReach`, `poolSize`), so a short set is never mistaken
for a small library. `DW.build({ mode: 'best' })`. On the v1-grid corpus:
all 159 placed; best 92 placed, 67 left out (5 grid, 62 reach). Same scoring,
same gate, same classification; `check-pool.js` asserts both.

**`serve.py --music DIR`** serves one folder read-only at `/music/` — folders
and audio files only, tap-to-download — so a phone on the LAN can pull tracks
into its own storage before picking them locally. Off unless asked for;
traversal refused in every encoding tried; the repo's deny-list is untouched.
The audit log line now says how many files the browser refused and libflac
took.

## 0.7.2 — 2026-08-19 · the door is not Chromium-shaped any more

**The iOS roadblocks, taken one at a time** (ROADMAP "iOS, 2026-08-19").
`index.html` used to refuse any browser without `showDirectoryPicker` —
Firefox, desktop Safari and every browser on iOS — for want of a folder
picker. It now asks for what the engine actually cannot run without
(WebAssembly, AudioWorklet) and lets everything else degrade:

- **Folders and tracks via `<input type="file">`** when the File System
  Access API is absent — `webkitdirectory` for folders (desktop Firefox and
  Safari; **iOS 18.4+**, WebKit bug 271705, checked not assumed), multi-select
  for tracks (iOS Files app, any version). Pickers open BEFORE Essentia boots
  so WebKit still counts the click as the gesture.
- **FLAC the browser refuses is decoded by the vendored libflac** (new
  `assets/deckwave-flac.js`, `DWFLAC`), resampled to the context rate with
  the browser's own resampler, for analysis, playback and the audit alike.
  Measured three ways before it shipped: in Node against the corpus cache
  (`tools/check-flac.js` — 16-bit, 24-bit and 48 kHz files, RMS within 0.006%
  of Chromium's decode); in Chromium with the native decoder forced to
  refuse, the engine's own `LIB.decode` came back via libflac with the same
  8,511,860 samples and a worst per-sample difference of 2.95e-5 (one 16-bit
  LSB); and a full `DW.ingest` through the fallback reproduced WALKMAN's
  cached RMS to five places and its 128 bpm / 7A. **24-bit arrives from
  libflac.js as 4-byte int32, not 3 bytes — the harness caught a 15–39% error
  before anyone heard it.**
- **The analyser's peak memory is smaller by construction**, same numbers:
  the decoded buffer is released before any WASM allocation, the whole-track
  mono before the key pass, and the excerpt is a slice of the whole-track
  mono (bit-identical to the old per-channel loop). Whether that is enough for
  an iPhone tab is **unmeasured**.
- `DW.platform` reports what this browser can do; the boot screen reads it.

**Android, same day.** MDN's compat data says Chrome for Android 132+ has the
File System Access API, so current Android Chrome takes the desktop path
untouched; below 132 `webkitdirectory` shows files only and **131 crashes on
a directory pick**, so `folderInputUsable()` refuses it there and the scan
degrades to a files multi-select and says so. No `getDisplayMedia` on any
Android browser. `DW.platform` reports `android` and the Chromium version.
ROADMAP has an Android table.

**Background play, same day.** New `assets/deckwave-phone.js` and a `phone:`
select in the transport (off by default): `keep screen on` holds a Screen Wake
Lock while a set plays — the mechanism that is known to work on iOS; `lock-
screen audio` routes the mix through a MediaStream into a hidden `<audio>`
element with Media Session metadata and lock-screen buttons — the experiment
for whether WebKit keeps a graph alive that feeds a playing media element,
which nobody has established. `DW.outputStream(on)` / `DW.outputVia` in the
engine; the analyser tap is upstream and unaffected. Wired and checked in
Chromium; **not tried on a phone**. The no-build rule was restated in
CLAUDE.md: no toolchain to run or test, ES modules fine, IIFEs-on-window are
a fossil of the console-paste days, not a rule.

**Not solved, said plainly:** no tab/system audio capture on iOS or Android
(`getDisplayMedia` does not exist there); WebKit suspends the AudioContext on
screen lock, so a set stops — not worked around; Safari's 7-day storage
eviction can take the analysis cache, which is what `▾ save cache` is for.
Nothing has run on an actual iPhone.

## 0.7.1 — 2026-08-19 · the deck catches up with the planner

A cold-read session over the whole codebase and roadmap, with the keeper away.
Fourteen ledger rows (46–59), four offline harnesses, and one live smoke test
on a synthetic four-track corpus. Nothing here moves a threshold.

**The deck never re-based after a reach track — only the planner did** (ledger
49). `sequence()`, `resequenceTail()`, `verify()` and both harnesses reposition
the rolling target to a reach track's own bpm; `chain()` left it alone for
both straight modes, so the first locked track after a 167 → 100 reach jump
would have been chained at ×1.67 against a plan that printed 0%. One line,
and a new harness (`tools/check-player.js`) that drives the Player itself
rather than the planner. **Confirmed live**: after a 100 → 120 reach track the
next deck was built at ×0.968, not ×0.806.

**Every stepping stone played twice** (ledger 46). `commit()` pulled the
destination from the tail and left every stone in place as well as splicing
it in. Measured: a 15-hop route, 15 tracks in the set twice. Stones are now
pulled by id from the unplayed tail.

**Three Player races and stalls** (47, 48, 50): a stale `chain()` continuation
after a replan built an orphan deck and overwrote the scheduled one (now a
plan token); `reorder({now})` with an undecodable incoming track left the set
with no exit (now falls back to `chain()`); queuing an already-played row
shifted the playing track under `idx` (now `idx` follows; queuing the playing
track is refused). And a cancelled scheduled deck left the rolling target
where it had moved it — put back now.

**Everything that printed a stretch against a straight track, or the plan's
figure against the deck, reads the deck** (51–53): the saved score and cue
sheet (`straight` and `dwellSec` step fields, additive, still version 1), the
header, the now-playing card, the transition monitor — which could never
actually show a crossfade before — track position, journey, camelot, wayposts,
and the route panel's scenic stones. The render bundle carries `now`, `next`,
`prev`, `prevRate`, `deck`, `nextDeck`; `DW.nextDeck` and `DW.prevDeck` are
new.

**ROADMAP D1 done**: `▾ save cache` / `▴ load cache` beside the set buttons.
**D6 half done**: every registered panel has a glossary term, the map is
audited at startup and in the harness, stale gate/stretch/corpus text
corrected, unverified links are search links as the tooltip always claimed.
The flags are still `false` — opening each article is still D6.

**`tools/serve.py`** no longer serves `.git`, `_source/` or `tools/` under a
percent-encoded or differently-cased path (54). **All harnesses survive a
CRLF checkout** (55).

**Harnesses**: `check-pool.js` 18, `check-route.js` 18, `check-player.js` 28,
`check-panels.js` 39. Every new check was run against the old code first and
failed there.

## 0.7.0 — 2026-08-18 · nothing gets discarded

**The pool gate was measuring the wrong number, and this project's own docs
said so.** Tracks were excluded at `conf <= 0.8` — Essentia's agreement
between five onset detectors — while SKILL.md already warned that low
agreement on chiptune is expected rather than a defect. Measured: five of the
ten excluded tracks had beat grids accurate to under 1.5%, and 42 of the 164
admitted had worse grids than some that were refused. *Timeless* passed at
conf 1.35 with an 11% wrong grid; *Neon Thrills* was refused at conf 0.72 with
a 0.01% one.

**The replacement measures what actually costs a beatmatch.** The engine
stretches by the declared tempo and aligns to the detected beats, so when
those two disagree by 6% the transition is 6% out however good the crossfade
is. Grid error IS beatmatch error. `DW.lock.maxGridErrPct` defaults to 9,
**derived rather than chosen**: the distribution over 179 tracks has an empty
band between 7.50% and 11.04%, and every cut inside it selects the identical
five tracks. About 3% is the other defensible answer and has not been heard.

**Nothing is dropped from a set any more.** A track that cannot be trusted or
cannot be reached is played STRAIGHT — its own speed, no stretch, no claim of
a beatmatch — which is what a DJ does with a record that will not grid. Two
kinds, and they behave as opposites:

- *grid* — its BPM is the number we distrust, so it does not steer. Letting a
  bad grid drift the rolling target would spread one bad number across every
  transition after it.
- *reach* — its grid is fine, the stretch gate simply could not get there. It
  plays straight and then repositions the set to its own tempo, because moving
  the set is the entire reason for playing it.

Measured on the real corpus: **171 of 171 placed, 9 straight (5 grid, 4
reach), 162 fully beatmatched.** The old configuration placed 107.

The list marks a straight transition, the route panel prints `∿ grid` or
`∿ reach` rather than a stretch figure, and `inspect()` counts them
separately — printing `0.0%` against an unmatched transition would make it
look like the best one on screen.

**`dedupe` is optional.** *keep duplicate versions* in the transport. It merges
17 tracks in this library — the same recording on an album and on a single —
and removing anything the owner put in their own folder should be their call.

**`DW.classify()`** reports who can be beatmatched and shows its working:
declared tempo, what the beats actually say, the disagreement, and the tracks
whose classification would flip at the other threshold.

**Repairing a set stopped discarding too, and only because a harness asked.**
`resequenceTail()` re-plans the remainder after a route is spliced in, and it
was still dropping whatever the gate could not reach — build a set with all 171
tracks, take one scenic route, and 35 vanished. The no-discard promise held for
BUILDING a set and quietly did not hold for repairing one. Same answer applied:
unreachable tracks play straight and reposition the tail. Measured after a
15-hop route: **162 kept, 0 dropped, 4 played straight, max stretch 8%.**

`DWNAV.verify()` had to learn about it as well. It was counting straight
transitions as gate violations — 11 of them, "max stretch 94.6%" — a real
number measuring something that never happens, which is the exact failure mode
this project keeps a table about.

**`tools/check-pool.js`** — eight checks against the real corpus, each printing
what would falsify it. Two failed on the first run and both were real: one a
genuine gap (64 of 171 still unplaced, because fixing the confidence gate did
nothing about the stretch gate), one a bug in the harness (`sequence()` stamps
its results on the shared corpus objects, so calling it twice restamps the
first build).

**dedupe was keying on a pattern any hyphen could derail.** It stripped two
prefixes with `^[^-]+-`, and that stops at the first hyphen ANYWHERE rather
than at the " - " separator — so `WALKMAN -Single-`, `CYBERNINJA -Single-`,
`HONGDAE -Single-`, `EIGHTY-FIVE -EP-` and `8-Bit Warrior` all keyed
differently from their album copies and the same recording could play twice.
It caught 17 of the 27 duplicate groups in this library.

**And the name is now only a hypothesis.** A title match nominates a pair; they
merge only if the audio agrees too, on duration and tempo within 1%. A remix, a
radio edit or a re-recording sharing a title is kept, because silently dropping
a real track is the worst failure available here and the tolerance is set far
to the keeping side. Verified both ways against the corpus: no two survivors
are the same recording, and nothing was dropped without an audio-matching twin.

**The tiebreak is grid error, not confidence.** When two copies really are one
recording, keep the one whose beat grid agrees with its own tempo — the copy
that can be beatmatched. Confidence differs by about 0.001 between two encodes
of the same master, which is noise being asked to make a decision.

**Superseded:** `deckwave-0.6.0.zip`, preserved.

## 0.6.0 — 2026-08-18 · routing that reaches the deck

**Every route was inert in audio, and had been since 0.4.0.**
`DWNAV.commitAndRepair()` returns a NEW array; the dashboard assigned it to
itself and nothing else. `Player.play(seq)` had captured the array it was
handed as `order`, and there was no API to give it another. So a committed
route existed in two versions — one on screen with the stepping stones spliced
in, one in the speakers without them — and both were internally consistent.
The fourth occurrence of *the UI records an intention and playback never reads
it*; patch 09 was written to fix exactly that, for the queue instead of the
order.

`DW.reorder(seq, opts)` **adopts** the caller's array, so the list and the
player are one object again — the invariant every in-place steering operation
already relied on. It refuses when the playing track is no longer at `idx`
rather than repairing it, and re-chains, because the next deck is committed the
moment a track starts and that choice predates the route.

**Blend fast now leaves the current track at the next downbeat.** Scenic route
still lets it finish. Previously both waited out the current track in full and
then walked a route the deck could not see.

**New `route` panel.** The committed detour: stepping stones with the dwell
that will actually be honoured, the destination, the tempo ladder, progress to
the scheduled exit, and live stretch. It draws `set[state.idx] === DW.nowMeta`
as **LIST ≠ DECK** in red — the one identity check that would have caught this
defect, ledger 33 and ledger 38.

The wayposts panel draws `DWNAV.queue`, which `commitAndRepair()` clears on its
last line, so a route vanished from the display at the instant it became real.
`DWNAV.active` now records the committed route by object identity.

**Now-playing and the track list read the deck, not the list index.** Both
derived the playing track from `set[state.idx]`, which is only right while the
two arrays agree. `DW.nowMeta` is the meta object on the playing deck and
cannot be wrong about what is audible.

**Stepping stones are 45 seconds, not the 40 the menu advertised.** `chain()`
clamps every dwell to a floor that was an inline literal; the router asked for
40 and the menu printed the request. The floor is now `MIN_PLAY`, exposed as
`DW.dwellFloor`, and quoted by both places that used to quote the other number.
Neither number moved — that clash is ROADMAP D7 and it is an ear question.
Measured on the live corpus: 130 → 151 bpm is 4 stones, **3.0 min**, not 2.7.

**`settle` — riding a stretched deck back to its own speed after a bad blend.
Built, and OFF.** The obstacle was structural: every beat-to-wall-clock
conversion divided by a constant `rate`. Decks now carry `pos()`/`when()`,
which integrate the rate and reduce to exactly the old arithmetic when no ramp
is scheduled — asserted with `===`, not a tolerance. Turning it on makes a deck
hand over at its own BPM instead of the 35%-drift target, so it changes the
whole tempo plan downstream. 45 seconds is chosen, not measured. ROADMAP D8.

**`DW.audit(set)` and an `audit set` button.** Decodes every track with the
same `decodeAudioData` call playback makes and reports the failures with the
decoder's own message and the stage — `find`, `read` or `decode`, which have
completely different fixes. A track that will not decode is spliced out of the
order with one log line nobody is watching, so the symptom is "that one never
plays" with no evidence afterwards. Also flags any track whose decoded length
disagrees with the analysed length, which means the beat grid is mapped onto a
different length of audio than it was measured on.

**`tools/check-route.js`** — 15 offline checks against the real corpus and the
real cache, each printing what would falsify it. It does not touch audio, and
says so: the whole failure was a correct data structure that was not being
played.

**`expanse` theme and the `roci` sprite.** Vacuum blue-black, hull-display
teal against MCRN orange — the two accents a long way apart in hue, for the
reason every theme since stargaze has had to obey: loudtime draws its average
in one and its peak in the other, and on a limited track those traces meet.
The Rocinante is drawn on the theme slots rather than fixed RGB, so she
recolours under every theme.

**`tools/package.py`.** The CHANGELOG's own first line records that earlier
packages were built by hand and overwritten, and two shipped missing files the
page loads. The file list is now DERIVED from `index.html` — every `src` and
`href` is resolved and must exist or the build refuses — and it will not
overwrite an existing version without `--force`.

**Superseded:** `deckwave-0.5.0.zip`, preserved.

## 0.5.0 — 2026-08-17 · fast blends, queue as a list

**Fast blends.** The rolling target advances 35% per *track played*, not per
second — so a stepping stone shifts the tempo the same whether it plays 40
seconds or four minutes. Intermediates in a route now play only long enough to
blend in, hold, and blend out.

Measured from 125 BPM: 151 BPM in **4.0 min** instead of 21.0; 90 BPM in
**7.3 min** instead of 38.5. Same hops, same tempo movement, same 8% gate on
every transition.

**The queue is a list.** Several destinations can be queued, reordered and
removed, each with its own mode. `DWNAV.queue` still returns the head, so the
wayposts panel and route commit needed no changes.

**Queue panel**, bottom left: per-entry tempo ladder, wall-clock estimate,
reorder and remove, and a commit action. Badges distinguish fast, scenic,
direct and forced.

**Superseded:** `deckwave-0.4.0.zip`, preserved.

## 0.4.0 — 2026-08-17 · steering

**Steering a running set.** Clicking a track no longer jumps; it opens a menu
with options that each state their cost.

- **`DWNAV` router.** The rolling target moves 35% toward each track played,
  so a track unreachable now may be reachable after a hop. Getting to a
  destination becomes a shortest-path search with the stretch gate as the edge
  condition. One hop gains at most **3.04%** tempo — derived, not guessed.
- **Wayposts panel.** The corpus as a navigable space: angle is Camelot
  position, radius is log tempo, and the lit annulus is everything the gate
  permits from here. A long harmonic tempo climb draws itself as a spiral.
- **Route commit.** A chosen route is spliced into the set rather than
  intercepted at playback, so the player walks it by construction.
- **Tail repair.** A detour changes the tempo state and breaks the rest of the
  set; `resequenceTail` re-plans it. Verified: zero tracks over the gate.
- **Corpus cache export/restore**, with integrity comparison on restore.

**Bug fixed in this release:** the router, steering menu and panel all shipped
in a state where the queue was populated and **nothing in the playback path
read it.** The feature recorded intentions and discarded them. Caught by the
keeper noticing the set was not walking anywhere.

**Measured:** at 109 BPM on 189 tracks — 123 BPM in 2 hops; 139 BPM in 7 hops
and ~25 min; 79 BPM in 13 hops and ~46 min; 172 BPM genuinely unreachable, the
corpus lacks the rungs.

**Superseded:** `deckwave-0.3.0.zip`, which is preserved.

## 0.3.0 — 2026-08-17 · RECONSTRUCTED

Marked RECONSTRUCTED because it is the surviving state of a package that was
rebuilt in place roughly eight times during a single session. The intermediate
states are gone. Nothing here is uncertain — the contents are known and
verified — but the *history* of the artifact was destroyed and cannot be
recovered.

**Contents:** engine, panel registry with twelve panels, portable score format,
FLAC tag reading, listen mode, now-playing card, single render loop, glossary
with 32 terms and translation export, six themes, saveable named views,
collapsible panels, MEGA layout. `mount()` wires every mixin; the loop starts
once. 21 files, all modules syntax-checked.

**Known unverified:** a cold load of `index.html` has never been tested. All
development ran through live injection into an already-running page.

**Superseded in this release:** nothing preserved. See note above.
