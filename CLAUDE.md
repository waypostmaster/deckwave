# Deckwave — working agreements

Beat-locked, harmonically-mixed DJ set built from the user's own music library,
running entirely in the browser. Vanilla JS IIFE modules, shadow DOM, no build
step. Essentia.js (WASM) for analysis, SoundTouch AudioWorklet for stretching.

Read `docs/ROADMAP.md` for planned work and carried debt (D1–D9, R1–R11),
`docs/BUILD-LOG.md` for how each subsystem came to be the way it is, and
**`docs/LISTENING.md` for the six things that are built, measured and unheard**
— exact tracks, what to do, and what each answer changes. Most
"why is this so strange" questions are answered there.

## Hard constraints

**No bundler, framework, transpiler, or toolchain needed to RUN or TEST it.**
Restated 2026-08-19 (keeper's call: *"keep it web-based for now, update the
rule to mitigate for fossils"*). The property that matters is that a fresh
clone runs from a static file server and every harness runs with bare `node`
— no `node_modules`, nothing third-party executing that the vendored, pinned
set does not already account for (four at the restatement; butterchurn +
its presets joined 2026-08-21 for the popout's party mode, keeper-approved,
lazily loaded, pinned with licences in vendor/README.md). That stays.

What is a FOSSIL and not a rule: that every module is an IIFE hanging a
global off `window`, loadable by pasting into a console. That was the
development method (live-patching a playing page — see the `_dev` seam in
`deckwave.js`, `deckwave-patches/`, SKILL.md's "load into the console") and
it is why the harnesses regex-extract functions out of `deckwave.js` and
`eval` them, which is how they all died on a CRLF checkout. Native ES modules
(`<script type="module">`, `import`/`export`, served as plain files) are
INSIDE the rule, not a breach of it, and are the right move the day there is
a concrete driver — the harnesses importing real modules, or a wrapper shell
— and churn without one. Do not add a bundler to get there; do not refuse
`import` to avoid it.

**Never change a threshold, calibration constant, or detector by reasoning.**
Every threshold here was set by measuring live signal, and four were wrong the
first time because a number was chosen without measuring the range. If a change
would move one, say so and ask the user to test it. This applies to detector
inputs too: changing what a detector *sees* changes its output.

**Claims that must be preserved.** These are load-bearing honesty, not hedging:

- Confidence is on Essentia's 0–5.32 scale and is NOT comparable to any other
  detector's number.
- Energy is a CONSTRUCTED index (45% loudness, 25% brightness, 30% tempo), not
  a measurement. The weights were chosen, not fitted.
- The chromagram is NOT a piano roll.
- The loudness panel is RELATIVE — K-weighting is approximated.
- Score determinism across browsers is UNTESTED.
- When the sequencer returns fewer tracks than requested, that is the gate
  working, not a failure. **As of 2026-08-18 it should almost never happen:**
  a track the gate cannot reach is now played STRAIGHT rather than dropped.
  If a build still comes back short, that is worth investigating.
- **Grid error IS beatmatch error, and that is a derivation, not a metaphor.**
  The engine stretches by `tempo / meta.bpm` while aligning to `meta.beats`;
  if those disagree by 6% the transition is 6% out. That is why the pool gate
  measures it and no longer measures Essentia confidence.
- **"Played straight" is not a quality judgement.** An unlocked track is
  unstretched because it is not being beatmatched — never print `0.0%` stretch
  against one, it reads as the best transition on screen.
- **The 9% grid cut is DERIVED but UNTESTED BY EAR.** The distribution has an
  empty band from 7.50% to 11.04% and any cut inside it selects the same five
  tracks. About 3% is the other defensible answer and plays 22 straight.
  `DW.lock.maxGridErrPct` is live; it needs the keeper, not an argument.
- **Phrase contrast is a ratio of DWPHRASE's own sums** (worst-offset
  within-phrase variance over best; 1 = no preference). Comparable to
  nothing outside that file; no threshold is applied on it. The 8-bar
  offset is an ESTIMATE — half-split agreement across the library is at
  chance — and a ¶ in the log is a claim about the grid, not about the ear.

**Do not label an axis with numbers the project chose.** The VU scale is
aligned to −6 dBFS by decision, not standard. Printing dB against it would
lend a chosen number the authority of a measured one.

## Verification discipline

This is the project's recurring failure: **seven diagnostics across two
sessions returned confident answers about nothing.** See BUILD-LOG Acts 18 and
21 for all seven and why each was worthless.

**State what would falsify a check before trusting it.** A test whose pass
condition does not exclude the failure mode is decoration.

Specifically, these do NOT work and have all lied here:

- Counting lit or non-background pixels — a placeholder, an axis, and a flat
  line are all non-zero.
- Checking an element exists in the DOM — it can exist under a clip.
- Onset matching with loose tolerance — onsets outnumber beats; everything
  matches.
- **A search that returns nothing, without a control that returns something.**
  Learned outside this codebase and it belongs here: a trademark search URL
  rendered *"No results found"* beside an empty search box, and trusting it
  would have produced a clean bill of health while missing the one hit that
  mattered. The zeros are only worth anything because each was paired with a
  term that HAD to return hits. **A registry search without a control is
  decoration** — and so is a grep, a harness sweep, or an audit that reports
  clean without ever having been shown failing.
  **AMENDED 2026-08-31 (ledger 121), because the rule as written above was
  not enough and produced a false zero anyway: a control proves the surface
  CAN return hits; it does NOT prove the surface answered THIS query.** A
  public registry was caught silently re-running a stale earlier query while
  displaying the new one — a controlled search, a real control, a wrong
  answer. So: **when a surface is found to misbehave, every prior zero taken
  from it is VOID, not merely suspect** — re-run them or mark them unknown.
  And a zero from an outside surface is not something to build a
  recommendation on in the same breath; state it, state that it is
  unconfirmed, and let the keeper's own knowledge meet it first.

What works: **draw twice with real signal between, and diff.** Hit-test with
`elementFromPoint`. Read state from an accessor rather than inferring it from
rendering — `DWPANELS.hist()` and `DW._dev` exist because unobservable
components can only be debugged by guessing.

**Write the ledger row as you catch it, tagged — do not wait for me.**
A finding that needs my confirmation still gets written; mark it
**`[INFERRED]`** and say what would confirm it. I flip it to **`[CONFIRMED]`**
when I have heard or seen the thing. Changing a tag costs nothing; recovering
a finding lost to compaction costs a session, and has.

**Write findings down when you make them.** A researched answer that lives
only in the conversation is lost at the next compaction — that has already
happened once here, and I contradicted my own earlier research seven hours
later. After any compaction, read the original transcript in
`~/.claude/projects/` and diff it against what the summary carried; it
recovered a working answer that the summary had dropped entirely.

**Writing a hazard down does not install the habit — measured, 2026-08-30.**
Prefer a gate that refuses to a paragraph that asks. Three of the day's
ledger rows (109, 112, 113) were the same shape: a comment or a contract
asserting something the code never checked. And the evidence that notes are
not enough is direct — a sibling session hit the SAME failure three times in
one hour *after* naming it and writing it down (a long-running process holds
the code it started with, not the code on disk), and what finally worked was
killing the loop before editing rather than remembering not to. **Where a
gate is possible, build the gate; where it is not, say plainly that the
guarantee rests on a person remembering.** `package.py` refuses a dirty tree
rather than asking for one; `check-recon` compiles the script rather than
trusting that it parses; RECON's feed-order requirement is documented ONLY
because the alternative would mean sorting on a clock the screen has already
said it does not trust — and that exception is stated as one.

**The tree looking clean is not evidence that nobody else is writing to it.**
Other sessions work in this repo. Name files when you commit; never
`git add -A`. A package cut, a stash, and a commit each swept up another
session's in-flight work on 2026-08-30 (ledger 112).

**WHO HAS THE CON — check before you write.** `python tools/helm.py status`.
If it is held by someone else, do read-only work: no commits, no package
cut, no stash, no `git add -A`. Take it when you start writing
(`take "<task>" --who "<session>"`) and **release it when you stop**
(`release`), which is the part that actually matters — a con nobody hands
back is worse than none, because the next session learns to ignore it.
The record lives in `.helm.json`, gitignored, per-machine, never product.

**It is a convention with a timestamp, not a lock, and it is written down
as one.** Nothing enforces it; a session that never runs `status` will
never know. That is a paragraph that asks, and this file says elsewhere
that a gate which refuses beats one of those — so a held con is not
safety, it is a single place to look that answers *is anyone else
mid-surgery in here, and on what.* It is advisory on purpose: the failure
it guards is two agents being helpful at once, and a real lock that can
wedge a launch is worse than a note that can be ignored.

**The user's ear is an instrument.** On the beat-phase question it resolved in
one A/B what three measurements could not. Take their reports seriously and
literally; "it doesn't pop when I jump directly to it" was the whole diagnosis.

## Current state

**READ THIS BLOCK FIRST — where things stand as of 2026-08-27. Launch is
2026-09-01 ("August 32nd — 8 bars of 4"; moved from 8/24 by the keeper
2026-08-27).**

Since the last opener: the phone became a player, then the DECK grew —
`build · phrase match` (Act 29, unheard), the held stretch worklet + gap
instruments on the card (ledgers 65/69, unheard), `⊕ libre` with the
Archive AND Wikimedia Commons as sources plus the ▶ demo (Acts 30–32),
and SoundCloud/Jamendo/ccMixter measured (R3 notes). Twelve harnesses, all
green: pool 33 · route 18 · player 59 · panels 44 · phone 67 · phrase 48 ·
libre 88 · flac 11 · popout 16 · events 42 · recon 109 · citywalk 50 (pool 43 · panels 62 after the 2026-08-29 ultra review and
ledger 107's stale countdown). THE VOICE NIGHT (Act 36, 2026-08-23): OS duck war ->
rendered speech through the deck graph (no speech session, nothing
ducks, real volume knob) -> the facility chain (Zira, "the register,
not the person") -> THE SEANCE (a swap replayed every voice at once;
"is this snow crash?") -> quiet boot (boot re-renders act on nothing).
evidence/ holds the night's 54-record feed + the voice pipeline
parameters. recon 34. 2026-08-22 live mid-set: the voice
pipeline LOCKED IN FULL by ear ("This is perfect. This is the volume.
This is the reverb amount.") - gain 1.62 · room 0.3 · Zira -15%/-8% ·
facility chain; evidence/voice-pipeline-2026-08-23.md is the canon,
nobody moves those numbers by reasoning. Same hour: "are there vocals
in this song?" (DROWNING) - NO: the analysis is VOCAL-BLIND (ledger
76, same class as the loudness-blind exit); the around-the-mountain
repair is RECON's VOCAL GATE - a keeper's-EAR list (seeds DROWNING +
the sung covers), checked via pulse() before any voice record plays;
listed track -> the same 'change' fast blend, voice holds till the
deck moves (15 s cap), one skip max; feed-patchable
{"vocals":{"add":[],"remove":[]}}. UNHEARD - LISTENING 18. recon 39.
Voice-synth research is in docs/research/voice-synth-options (Piper
top pick; GLaDOS models exist but stay OUT of the tree - IP). Then
ledger 77: backlog takes were stranded (quiet boot refused them, again
was never armed) - sayfile rows are PRESSABLE now (a tap plays the
take, arms again, skips the vocal gate: the press means NOW). recon 42. Then
PIPER IS IN (Act 37): tools/speak.py renders via piper-tts (lessac
model in speech/models/, gitignored) with the Zira SAPI recipe as
fallback; --voice takes any local .onnx, so the engine is not tied to
one model. On GLaDOS specifically the research reached a REFUSAL, not a
workaround: docs/research/voice-synth-options says an MIT tag on such a
model cannot launder Portal training audio, names Valve's copyright and
trademark and Ellen McLain's right of publicity, and concludes **do not
put a GLaDOS-trained model or its output in the published tree**. The
register comes from a clean voice plus the facility chain, which is
where it was coming from all along. piper has NO pitch
knob so the console grew warp (voiceCfg, playbackRate, pitch AND
speed together, honest label). take9 is the A/B on the feed; a new
engine is a new register - the ear re-rules the locked numbers if
Piper wins. recon 43.

**2026-08-21, keeper live on the FIRST ANDROID RUN:** a received call did
NOT pause the set (a bare Web Audio graph holds no Android audio focus).
Built the same hour — DWPHONE `calls`, ON by default: the silent loop from
`controls` holds focus for the page, Chrome pausing/resuming it at the
ring/hang-up drives `DW.pause()`; armed inside the ▶ gesture; `call pauses
the set` toggle in ⚙. Ledger 71 **[INFERRED]**, LISTENING §14 — one
received call mid-set confirms or discriminates. iOS untouched (WebKit
interrupts the graph itself, heard). The keeper also re-confirmed the UI
is confusing on a phone — D4, known, not new. Same day, from the phone:
**download percentages** — `fetchBytes` streams the body and reports per
chunk via `DWLIBRE.watchFetch`; demo button `demo 2/6 · 47%`, release
fetch `3/12 · 47%`, Commons `47%`; MB when Content-Length is unreadable.
Found on the way: the cache put was awaited BEFORE the body read (would
have collapsed progress to one jump — now started before, awaited after)
and a mid-body network death escaped the retry loop (now retried like a
5xx). `check-libre` 79 → 84. Later the same session: the framed
pop-ups FOLD BY THEIR FRAME (keeper’s ask) — a header tap folds the
⊕ libre panel to title bar + status line (fetch percent stays visible)
and the navpop to its h6; controls excluded, ⊕ reopens unfolded;
verified live in Chromium; `check-libre` 87. And "republish Archive songs to Commons for
speed?" — answered NO: Commons bans NC/ND licences (the demo tracks are
exactly that) and forbids CDN use; the speed levers are the cache, Ogg,
and now the visible percent. BUILD-LOG Act 33 has all of it. Evening:
keeper found CRAWNiiK/browser-visualizer-v1 (b. 2026-08-19) — assessed
and RECORDED (prior-art doc, Addendum 2026-08-21): a commodity
getDisplayMedia visualizer with a two-envelope onset detector; touches
neither novelty claim; no provenance link (no remote, zero kinship);
nothing changes for launch. Late evening: THE POPOUT IS BUILT
(`⇱ popout` in ⚙, `assets/deckwave-popout.js`) — any panel in its own
projector window (own rAF; DWLOOP.last visible / sample() hidden) and a
`party · milkdrop` mode on vendored butterchurn (lazy, MIT, provenance in
NOTICE). Ninth harness `check-popout` 16 — and MACHINE-CONFIRMED
live by driving the browser: real click opened the window, panel animated,
the hidden-page sample() path ran (popup foregrounded the tab), party
rendered 101 WebGL frames / 100 presets / 0 errors. LISTENING §15 is now
just the aesthetic glance on a real second screen. Later still: **THE
SOUNDTRACK TAKES DIRECTION** (Act 34) — `DWEVENTS.inject('I need
something fast')` from console or same-origin postMessage; faster/slower/
hype/calmer steer through the SAME gate and fast router via the
dashboard's own blend/applyRoute (wired, never a second path to the play
order), change = skip, duck/unduck = volume 0.3× (CHOSEN) with exact
restore — the original purpose said out loud: a soundtrack for a
Claude-guided walkthrough. Tenth harness `check-events` 24; live: parse,
duck 0.85→0.26→0.85, postMessage lands. UNHEARD — LISTENING §16. Prior
art run same session (incl. GitHub; keeper's ask): the category EXISTS
commercially — Reactional Music is games middleware running licensed
tracks off game events; Spotify AI DJ took voice requests in 2025; Weav's
adaptive-tempo patent family joins the FTO watch list; nearest GitHub
neighbour is offline prompt→mix. Novel integration, not invention —
`docs/research/prior-art-intent-steered-soundtrack-2026-08-21.md`. Then
the GAME SURFACE: `DWEVENTS.pulse()` (the beat clock a game polls — audio-
clock pull, beat/bar/tempo/energy), `examples/soundtrack.html` (the whole
embed in ~100 lines, live-verified through a real iframe), and
`docs/GAME-INTEGRATION.md`; README carries the positioning bullet. And a
first by-eye panel confirmation mid-playthrough: "the pitch classes work
beautifully at the start of Lullaby" — LISTENING Heard + video shot 7.
Then the COMPREHENSIVE game-music pass (supply AND demand —
`docs/research/game-music-field-supply-and-demand-2026-08-21.md`):
user-music games are a 20-year genre that keeps rebuilding its analysis
per game and dying with it; engines answered demand natively (Godot 4.3
interactive music, Unreal Quartz); Infinite Album ships viewer-injected
intent; the unoccupied square is "that genre, as open middleware" — now
the README positioning. Side-find: the lost race-track visualizer is
PROBABLY Riff Racer (Steam 2016, delisted 2022). 2026-08-22, by ear:
**Gone Too Soon played its rain outro into near-silence mid-set** —
ledger 72, the sequencer is loudness-blind at exits (no loudness contour
stored). **Logged, NOT fixed, keeper's explicit instruction** — the same
behaviour is the video's chosen credits shot. Also settled 2026-08-22:
**the US provisional was DROPPED** (keeper's statement — research README
updated); defensive publication at launch is the entire IP strategy. Then
**RECON, the first extension (Act 35)** — `extensions/recon/index.html`,
the agent-activity feed as its own screen with Deckwave folded behind it;
fed by appending JSON lines to `recon.jsonl` (how-to in the file header);
records land on the assumed downbeat via pulse(), an optional `event`
field injects an intent at the same moment; staleness refuses to look
calm. Eleventh harness `check-recon` 14; DONE tests a–c demonstrated live
(a: landed 19 ms into the assumed downbeat, measured), d is ARMED — click
the RECON tab and the "1 while you were away" divider is the missing
half. RECON also grew the REPLY TRAY (optional, off by default): typed
music words act locally at once; anything else is stored with
provenance and read by the agent via window.RECON.drain() - a message
tray, NOT a command line (the box cannot authenticate its typist; the
agent contract in SKILL.md: quote and confirm, never self-execute).
check-recon 21. RECON then RESTYLED to the hosted "Deckwave Console"
artifact's register (the keeper's snapshot theatre on claude.ai - CRT,
key-hue accent, --beat brackets; same face, real organs; mechanics
untouched), and the SKILL FAMILY established: deckwave >
deckwave-extension (extensions/SKILL.md) > deckwave-extension-console
(extensions/recon/SKILL.md), all installed + zipped in _source/. Then THE VOICE (keeper: "play
Claude responses without losing the music"): DWEVENTS.speak - in-page
speech synthesis, same session as the deck, our duck restored exactly;
RECON records carry speak:true/"words" behind a `voice` toggle whose
real tap arms it. events 38 / recon 24; the scripted-tap not-allowed
failure was measured and restores cleanly. LISTENING 17 CONFIRMED
('Okay. That worked.') - and the voice grew a character: speech duck
now its own tunable depth (0.55x default; 0.3 was 'too much'), pitch
0.85 + preferred female voice ('Scarlett meets GLaDOS' - vocoding
impossible, said honestly), all patchable FROM THE FEED via voiceCfg
records. events 42. Then HOT-SWAP: RECON split into shell + recon-app.js
(boot/teardown); a {"reload":true,"ts"} feed line re-fetches the
console's own code and re-boots WITHOUT touching the deck iframe -
proven live (a marker on the iframe window survived the swap). One
manual reload delivers the loader; upgrades ride the feed after.
recon 31. iOS map recorded: Speak Selection ducks-and-survives, the
Accessibility Reader kills (ledger 73), VoiceOver has the only duck
slider. Version held at 0.8.0 by decision; CHANGELOG carries it. And by
ear: the cyberpunx ticky-ticky is IN THE SONG (keeper ran the direct-jump
discriminator themselves — unstretched, still ticks; pipe exonerated).

**Open items are tracked in TWO LISTS since 2026-08-27 (keeper's ask):
the BASE and the CONSOLE EXTENSION.**

**BASE — open, in order:**
0. **§23, THE TWO TUNES — built 2026-08-29 (ledger 101), the standard
   one UNHEARD.** The 2026-08-29 cloud review found `CAMELOT_MINOR` was
   a copy of `CAMELOT_MAJOR`: minor keys numbered by their PARALLEL
   major, so the 0.85 "relative" bonus always paid the wrong pairs and
   true relatives scored 0.08. **Not swapped — keeper's call**
   (*"so we're not messing up my mix"*): `tune` in ⚙, **deckwave tune
   the default** (every heard set was built on it), standard Camelot one
   select away, `DW.retune()` restamping the corpus so the two can never
   mix. **Measured before deciding: the offset is uniform, so it cancels
   within a mode — only major↔minor pairs CAN differ (18.8% of ordered
   pairs on a 196-minor/23-major corpus) and, measured on the real
   records, only **3.2% actually DO**; same-mode pairs differing: 0.** §23 is the A/B: build, switch,
   build again, same seed. A real possible outcome is "the sets are
   identical" (few major tracks), which settles it fastest. Nothing
   saved is at risk — `load()` never re-scores.
1. **The popping (ledgers 65/69).** One glance at the now-playing card on
   any playthrough: clean, `⚠ plain worklet`, or `⚠ N gaps` — plus whether
   pops land at transitions or mid-track. LISTENING §7 has the four
   outcomes; this closes an active investigation for one glance.
1b. **§24, the status line's countdown — fixed 2026-08-29 (ledger 107),
   [INFERRED].** The keeper caught it live: `blending in 1.5s · TRACK`
   persisted after choosing a new set target. The number now counts off
   `DW.blend.in` and resolves to `blended into <track>` — no number left
   to go stale. Costs a glance on any blend you were making anyway;
   `check-panels` 44 → 62 drives it with a fake deck, nothing live.
2. **Phrase match by ear** — LISTENING §12: the confirmed Moments → Alive →
   FINAL CHAPTER → ROCK 64 walk under `best` vs `phrase`, WALKMAN → BROKEN
   STAR strong pair, TONIGHT → LET'S PLAY weak pair. And the keeper's own
   test: is phrase-next "tight"? If yes it becomes the default next.
3. **Libre by ear, continued** — §13: Ogg vs FLAC A/B still open; Commons
   material through the gate (remember: Ogg/Opus will NOT decode on the
   iPhone — count the failures as data, not surprise).
4. **Phone singles:** §8's handover-title half, §9 (which `lock art` held,
   how long, battery), §11 (did lock-screen ▶▶ BLEND), **§14 (Android:
   does a received call pause the set — built 2026-08-21, ledger 71
   [INFERRED], one call answers it)**, the cold-machine demo, and the
   Jamendo key if wanted.
5. **A straight transition has never been heard** — the no-discard build's
   reach jumps (167 → 100 bpm in one case) are still [INFERRED] from the
   harnesses only.
6. **Launch (2026-09-01): the decide-table is CLOSED.** Fresh history
   DECIDED; private research OUT (2026-08-27); **`_source/` SHIPS
   (2026-08-28, keeper: *"we will include the _source"*) with
   `_source/README.md` as its documentation.** What is left is the day-of
   list in LAUNCH.md — and one snag found writing that README: **the
   `_source/deckwave-0.8.0.zip` on disk is the 2026-08-19 cut and is seven
   files short of today's tree** (phrase, libre, popout, events, both
   stretch worklets, demo-set.json), so `package.py` will refuse on
   launch day until it is renamed or forced. Day-of step 2 carries the
   command.
7. **Held, not scheduled** (each needs the keeper's ear or word, none
   gates launch): loudness levelling across tracks (target by ear;
   ledger 72's loudness-blind exit stays logged-not-fixed by
   instruction), D10's grid runs (a detector change), Apple Watch
   controls (ledger 79, possibly unrepairable from a web page), and the
   six stale merged worktrees under `.claude/worktrees/` (removal
   permission-blocked for me; `git worktree remove` each).

**CONSOLE EXTENSION (RECON + the voice) — open:**
0. **The review-pass fixes (ledgers 86–99, 2026-08-28) are [INFERRED] —
   text-pinned by 14 new checks (`check-recon` 96), none driven live.**
   The §21 walkthrough is the live half. `recon-app.js` fixes ride a
   `{"reload":true}` hot swap; the one shell-CSS half (`.saymark`
   styling) arrives on the next plain reload, ledger 83's known split.
   The one policy question is CLOSED: the query-string strip on
   copyable stage links STAYS (keeper, 2026-08-29 — a feed anything on
   the LAN can write, rendered on a screen, is the wrong place to
   preserve session tokens; a lost `?id=` is the cheaper failure).
0b. **§22, THE VOICE CARD + THE MIXER — built 2026-08-28 (Act 40),
   UNHEARD.** Keeper's ask mid-set. The card: a REAL waveform for
   rendered takes (analyser in the take's own chain); NO wave for the
   OS voice, said on the card (nothing to tap — a drawn one would be
   fake). The mixer: `voice` (takes' 0–200% gain, live, mirrored ≤100%
   into `configureSpeech({volume})`) and `duck`
   (`configureSpeech({duck})`) beside the eleven dial; faders
   initialize FROM the stores — the 1.62/0.3 canon moves only by hand.
   Ledger 100 found on the way in (the facility double outliving a
   replaced take — fixed). `check-recon` 107. §22 is the glance +
   listen: does the wave read as the voice, do the faders feel like a
   mixer, is the linger right.
1. **§18, the vocal gate — UNHEARD.** One play of DROWNING (or any listed
   singing track) with a voice record queued: does the fast blend land
   before the words do.
2. **First full narrated session on the settled voice** — speaker 99
   (p303) at grade `facility` is canon by ear (§19.1); a whole session
   narrated on it, treated takes played through the facility chain, is
   not recorded as run.
3. **§20, THE INSTRUMENT COLUMN — built 2026-08-28 (Act 38), numbers
   machine-verified, UNLOOKED-AT.** The keeper asked whether RECON did
   the full visualization the hosted console artifact contemplated;
   it did not (register only, zero canvases), and said "Yes". So now:
   **now / next · transition / ribbon** on the console, read off the
   deck — `pulse()`, `DW.nextDeck`, `DW.prevDeck.prog`, the engine's own
   `camScore`, the set from the render bundle, playhead on
   `set.indexOf(DW.nowMeta)` with `LIST ≠ DECK` when they disagree.
   READ-ONLY by decision (a click into the play order is ledger 40's
   shape). `check-recon` 43 → 59; driven live on six synthetic tracks,
   playhead measured against an independent prediction to within 0.6%
   of the canvas, straight and first-deck paths confirmed, and the whole
   column arrived through a HOT SWAP with the music still playing.
   **Ledger 82 came out of that run:** `+0.00%` against the first deck
   reads as the tightest beatmatch on screen while nothing is being
   matched — fixed for step 1, still open for a jumped-to deck mid-set.
   §20 is the glance: does the column earn its 300 px, is a 238 px
   Camelot wheel legible, does the energy arc read as an arc. **The
   popping question (§7) can now be answered from this screen** — the
   card's `⚠ plain worklet` / `⚠ N gaps` is mirrored there.
   Still the artifact's and not ours: the setlist rail, the four stage
   modes, the findings pane, the browser-shot surface (no data source
   exists here). The real next step is that `DW.Player.analyser` and
   `DWLOOP.sample()` are reachable from a same-origin extension, so the
   scope/spectrum/chromagram could be REAL there where the artifact's
   are synthesised from beat phase.
4. **§21, THE STAGE — built 2026-08-28 (Act 39), UNRUN as a session.**
   The keeper asked whether the console still did what it was first
   meant to do — a hacker-like interface for an agent navigating the
   web — and the record said it was designed for that TWICE (the deleted
   `surfacing-hud-for-agent-activity.md`, and the keeper's own Act 35
   prompt: *"a read-only what-the-agent-is-looking-at overlay, so the
   deck can play music to browse Reddit by"*) and shipped only the LOG
   half. Keeper: **"Yes."** So the viewport half exists now: a stage
   above the feed showing ONE STILL at a time — `shot` + `status` +
   `links` on a record, `tools/recon-shot.py` as the producer.
   **THE CONSOLE SEES NOTHING BY ITSELF** — it never screenshots,
   scrapes or navigates; that sentence is printed on the stage. Every
   frame is labelled `still` with its age, goes `— the agent may be
   somewhere else` past 90 s (a CHOSEN number, §21 asks about it), and
   an unparseable ts is treated as STALE. No page-body channel exists,
   deliberately. `shot` is MATCHED not cleaned (sayfile discipline); a
   live traversal probe was refused. `check-recon` 59 → 82; 13 checks, plus ledgers 83–85
   failed against the old source first, and one failed against the new
   code because the CHECK was wrong (it demanded `esc()` where the code
   uses `textContent`, which is stronger). §21 is one real walkthrough:
   does it feel like watching, or like a log with a picture attached.

- **R3 IS BUILT — `⊕ libre`, the Internet Archive as a SOURCE, 2026-08-19
  latest (BUILD-LOG Act 30, ledger 66–67, LISTENING §13).** Keeper: *"Don't
  get locked into Wikimedia Commons, if there is a richer store of the
  music this visualizer is built for, let me know and let's do the thing."*
  The store is archive.org — measured CORS-clean end to end (search,
  metadata, download redirect, storage node), 4,040 licensed releases under
  the chiptune subjects, FLAC/MP3/Ogg per track, no key. `DWLIBRE`
  (`assets/deckwave-libre.js`) is a `RemoteFile` honouring the File
  contract, through `DW.ingest` unchanged; ONE line in `ingest()` copies
  `file.source` onto the record; `DWSCORE` writes `source` per step
  (additive, still v1), the cue prints `REM ATTRIBUTION`, the card and the
  handover log line name creator · licence. The licence filter is IN THE
  QUERY (`licenseurl:[* TO *]`) so an unlicensed item is never offered;
  `-nd` is flagged not refused; an unknown licence URL gets no short name.
  Ogg by default (~4 MB/track), MP3/FLAC one select away; Cache API
  `deckwave-libre`; two fetches in flight, 503 backoff. **Seen live in
  Chromium:** geekcore006 (Iwu, CC BY-NC-SA 3.0) fetched + analysed in
  74 s, all six placed, a real ▶ on a fetched track with 0 worklet gaps,
  re-add after reload = 6 cache hits and zero fetches, the card reading
  `☉ Iwu · CC BY-NC-SA 3.0`. **UNHEARD.** `check-libre` 67 (incl. the ▶ demo — Act 31); eight harnesses
  now. Nothing moved a threshold; how the Archive's material fares in the
  gate is the ear's question (LISTENING §13). The panel is unstyled for a
  phone. Commons was never the store: it passes CORS and holds no beats.

- **Version 0.8.0, launch 2026-09-01 on GitHub** (moved from 8/24 by the
  keeper 2026-08-27; `docs/LAUNCH.md`). The
  *adjacent* research is out of the tree (2026-08-21, by the keeper's
  deletion); the *private* set is out too (2026-08-27, keeper's decision,
  moved to `../deckwave-private/research/`); `_source/` is still open —
  and the HISTORY question is answered by the fresh-history decision (see
  LAUNCH.md: orphan `public` branch, push `public:main` only). The push
  itself is theirs.
- **PHRASE MATCH IS BUILT AND UNHEARD — 2026-08-19, late (BUILD-LOG Act 29,
  ledger 63).** Keeper: *"start working on the phrase-match. add it as a
  build option, not replacing the current build types. it can probably
  replace the default 'next' activity though, if it's tight."* So:
  **`build · phrase match`** is a THIRD button — the `best matches` list
  stamped `phrase: true` — and while that set plays, the outgoing leaves at
  its last 8-bar phrase start, the incoming enters at ITS first, the fade is
  exactly one phrase (32 beats at the playing tempo, not the xfade), and
  `next ▶` / blend-now / ⚡ go to the next phrase start (up to 8 bars away).
  The other two builds are byte-for-byte unchanged; `next ▶` on them is
  still the downbeat until the keeper says phrase-next is tight. The log
  prints `¶3.1→2.4 16s` per transition (out contrast → in contrast, fade;
  `·` = that side took the downbeat path). `DWPHRASE`
  (`assets/deckwave-phrase.js`) finds the 8-bar offset by LEAST
  WITHIN-PHRASE VARIANCE of four per-bar series from the decoded playback
  buffer at chain() time — the first rule (sum of bar-to-bar change) voted
  for the fill bar before a section and was dropped by measurement. The
  offset is written back to the analysis record (`phrase`, additive, no
  re-scan). **What the scan says (189 tracks, `evidence/phrase-scan-2026-08-19.json`):**
  96% beat a bar-shuffle null, contrast median 2.3 — and **half-split
  agreement is 13.8% against 12.5% chance**: the whole-track offset is an
  ESTIMATE from sparse events, real arrangements shift mid-track, and the
  contrast beside every ¶ is there so the ear can be paired with it.
  **Contrast is a ratio of this detector's own sums and comparable to
  nothing; no cut is applied on it anywhere — if one is ever wanted, the
  scan has the distribution and the keeper has the ear.** LISTENING §12 is
  the test: the confirmed Moments → Alive → FINAL CHAPTER → ROCK 64 walk
  under both builds, WALKMAN → BROKEN STAR as the strong pair, TONIGHT →
  LET'S PLAY as the weak. Seven harnesses: `check-phrase` 48 (13 fail on
  the old Player), `check-pool` 33.
- **`⊕ libre` has TWO sources since 2026-08-20 (Act 32): archive.org and
  Wikimedia Commons** (source select in the panel; Commons hits are single
  files; a CC0 Opus went search → fetch → beat grid live; Ogg/Opus does
  not decode on WebKit — recorded, not solved). SoundCloud measured and
  CLOSED the same day (ROADMAP R3: audio behind a key-gated 401, only an
  iframe widget is CORS-open, the asked-about track all-rights-reserved).
  Jamendo is GREEN one app-wide key away — the key would be the keeper's
  to register and ships public in the repo.
- **Also from that scan, ledger 64 / ROADMAP D10: 104 of 189 grids carry
  RUNS of beats at another spacing** (Essentia following a half-time or
  dotted feel for a section), so "every 4th beat from beats[0]" drifts off
  the bar inside them and `gridError()` — mean spacing — cannot see it.
  Pre-existing, affects every downbeat exit, NOT repaired (a detector
  change; the ear has not been asked). The downbeat probe in the same scan
  puts offset 0 at 67% vs 25% chance — first evidence for the 4/4
  assumption, reported not applied.
- **The phone works — and as of tonight it is a PLAYER.** iPhone 16 Pro Max /
  iOS 26.6: library analysed on the device, sets play, **`phone: background
  audio` keeps the set going through the lock screen [CONFIRMED]**, **`phone:
  background + lock controls` puts working ▶▶/◀◀/❚❚ and the track on the
  lock-screen card [CONFIRMED — "It works"]**, `lock art` puts a poster or a
  1 Hz panel on the card (**[CONFIRMED] 2026-08-19 midnight — an unplanned
  lock mid-libre-set kept playing AND the 1 Hz vis kept updating on the
  card: "the iphone is fucking TIGHT … 1hz at a time, i dont care"**;
  which panel reads best / ten-minute hold / battery still open), and **`next ▶` blends instead of cutting** (ledger 62,
  not yet heard as a blend). BUILD-LOG Act 28 is the whole evening; the
  WebKit-source citations are in `assets/deckwave-phone.js`'s header.
  **Open for the next window, in order:** LISTENING §8 (did a NEW title reach
  the card at a handover under plain `background audio`), §9 (which `lock
  art` setting held under lock, for how long), §10/§11 (did ▶▶ BLEND; does
  the scrubber show the track), §7 (does a CHAINED deck pop — a direct jump
  was clean; `latencyHint` is inert on WebKit so nothing has been tried yet).
  **Next build candidate, keeper's call:** loudness levelling across tracks
  (ROADMAP "Competitive gaps" #2 — small, needs the ear for the target).
- **Lock-screen audio fell; `keep screen on` is the answer on iOS** — until
  `phone: background audio` is heard. **2026-08-19 evening (BUILD-LOG Act
  28):** WebKit's own source says an AudioContext survives
  `EnteringBackground` when `navigator.audioSession.type === 'playback'`
  (AudioContext.cpp, landed 2024-03-01, with a layout test), takes the
  lock-screen card from `mediaSession.metadata`, and plays through the
  silent switch. The new mode sets that one property and keeps the
  speakers. **HEARD the same evening: the set kept playing through the lock**
  (*"you have made it work"*) — the lock half is **[CONFIRMED]**; whether a
  handover happens from a hidden page (a NEW title on the lock screen) is
  the open half of LISTENING §8. **Lock-screen art** (`lock art:` — `poster`
  per track / `live` 1 Hz through `DWLOOP.sample()`) is built, checked in
  Chromium, **unseen on a phone**: LISTENING §9. **`next ▶` BLENDS now** (ledger
  62 — downbeat ≥ 1.2 s out, the set's xfade; `{cut:true}` is the old cut),
  and **`phone: background + lock controls`** makes a silent media element the
  Now Playing session so ▶▶/◀◀/❚❚ on the card work (WebKit routes them to JS
  only for elements) — own mode, confirmed `background audio` untouched,
  LISTENING §10–11. **Keeper, same night: "It works" — the lock-screen
  controls reach the deck on the iPhone [CONFIRMED]; whether ▶▶ blended is
  still its own question.** Six harnesses: `check-phone` 54, `check-player` 38. Also from that read:
  **WebKit ignores `latencyHint`**, so the popping lever set on phones was
  inert there (LISTENING §7). Six harnesses now: `check-phone` 25.
- **Two builds** (`all tracks` / `best matches`); best matches confirmed by
  ear once (Moments → Alive → FINAL CHAPTER → ROCK 64).
- **Twelve harnesses, all green:** `node tools/check-pool.js` 43, `check-route`
  18, `check-player` 59, `check-panels` 95, `check-phone` 67, `check-phrase`
  48, `check-libre` 88, `check-flac` 11 (needs the library on disk),
  `check-popout` 16, `check-events` 42, `check-recon` 109, `check-citywalk` 50
  — 646 in all, re-counted 2026-08-30 rather than inherited. Run them before and after
  anything. **Every harness ends on the same line — `all passed of N checks` —
  and that uniformity is load-bearing, not tidiness.** A twelfth briefly printed
  a prettier variant; one regex over all twelve scored it ZERO and reported 560
  without failing (ledger 110). A new harness matches the line.
  **A text harness cannot see a broken parse (ledger 111)** — every check in it
  is a pattern match, and the patterns survive a SyntaxError untouched. Any
  harness that reads a script it does not execute compiles it with `vm.Script`
  first: `check-recon` does it for `recon-app.js` and its shell, `check-libre`
  for `index.html`'s boot gate. Measured: with `recon-app.js` deliberately
  broken, **108 of 109 checks still passed.** `tools/measure-worklet.js` drives the vendored worklet and the
  held wrapper offline (ledger 65) — a measurement, not a harness. `tools/phrase-scan.js` is a MEASUREMENT, not a harness — it
  decodes the library (2 min) and writes `evidence/phrase-scan-<date>.json`.
- **The LAN server is a per-session process.** `python tools/serve.py --lan
  --music "C:/Claude/Music/LukHash"` serves https://<your-lan-ip>:8443 with
  `/music/` (and "download all"); it dies with the session that started it.
  The keeper should start it in their own terminal if the phone is in use.
- **Tooling hazard, mine:** Bash heredocs in this harness unescape backslashes
  and can turn `\b` into a backspace byte; edit files with the Write/Edit
  tools or a helper script written by the Write tool, never a heredoc that
  contains backslashes. It cost one red commit today.

- **2026-08-19, keeper away: a cold-read session, ledger rows 46–59, version
  0.7.1.** Read BUILD-LOG Act 26 first. The two that change what the deck
  does: **`chain()` now re-bases the rolling target after a REACH track**
  (it never did; only the planner did — ledger 49, confirmed live on a
  synthetic corpus), and **stepping stones are pulled from the tail when a
  route commits** so nothing plays twice (46, measured). Plus: a plan token
  guards `chain()`'s decode await; a cancelled scheduled deck puts the target
  back; `reorder({now})` survives an undecodable incoming track; queuing an
  already-played row keeps `idx` on the deck. **None heard.**
- **Four offline harnesses now, all `node tools/check-*.js`:** `check-pool`
  (18), `check-route` (18), `check-player` (28 — the Player IIFE under a fake
  AudioContext), `check-panels` (39 — every panel against six bundle states,
  captured text, and the D6 glossary map). Each new check was run against the
  old source first and failed there. **They are CRLF-proof now; they were
  not, and a fresh checkout on this machine killed all three with FATAL.**
- **The render bundle carries the deck: `D.now next prev prevRate deck
  nextDeck`** (20 entries — PROMPTS.md §1 tracks the count). Every panel, the
  header and the card read the deck first and the list index as fallback,
  and none prints a stretch against a straight track. `DW.nextDeck` and
  `DW.prevDeck` exist for the same reason.
- **The score format gained `straight` and `dwellSec` per step** (additive,
  still version 1) and `load()` restores the classification; SCORE-FORMAT.md
  has it. A score saved before this day loads unchanged.
- **D1 closed** (`▾ save cache` / `▴ load cache`), **D6 half-closed** (every
  panel has a term, the map is audited at startup and in the harness, stale
  gate/stretch/corpus text corrected, unverified links are search links; the
  flags are still false). `serve.py` no longer serves dotted or denied paths
  under %-encoding or a different case.
- **iOS, 2026-08-19 (0.7.2, BUILD-LOG Act 27):** the boot gate asks for
  WebAssembly + AudioWorklet, not `showDirectoryPicker`; folders/tracks fall
  back to `<input type=file>` (`webkitdirectory` is REAL on iOS 18.4+ —
  checked); FLAC the browser refuses goes through `DWFLAC` (vendored libflac,
  measured against Chromium's decode to one LSB; **24-bit comes from libflac.js
  as 4-byte int32**); `analyse()` releases the decoded buffer before WASM and
  the excerpt is a bit-identical slice of the whole-track mono. **Nothing has
  run on an iPhone; analyser peak on iOS is unmeasured; screen-lock suspension
  and no tab capture on iOS are not solved.** `tools/check-flac.js` needs the
  library on disk. **Android:** Chrome 132+ has the File System Access API
  (desktop path, no fallback); below 132 `webkitdirectory` is files-only and
  **131 crashes on a directory pick**, so `folderInputUsable()` refuses it by
  UA there. No `getDisplayMedia` on any phone. ROADMAP "Android — 2026-08-19".
  **Background play:** `phone:` select (DWPHONE) — `keep screen on` (wake lock,
  known to work) and `lock-screen audio` (mix → MediaStream → `<audio>` +
  Media Session; **the experiment — WebKit may or may not keep the feeding
  graph alive at lock; falsifier in ROADMAP "Background play"**). Off by
  default; `DW.outputStream(on)` swaps the sink, nothing upstream changes.
- **The deny-list fix is on disk but the server that was already running
  predates it** — `python tools/serve.py --stop` then start again to pick it
  up. Assets are served from disk, so everything else was live immediately.

- **The re-scan has RUN.** 2026-08-18, 179 tracks at `ANALYSIS_V = 2`, zero
  failures, 12.0 minutes, peak 851 MB. Every grid now covers at least 99% of
  its track (median 99.71%, worst shortfall 0.97s); the latest beat in the
  library went 119.9s → 506.23s. BUILD-LOG Act 22 has the full account.
- **The library moved and grew.** `C:\Claude\Music\LukHash`, **189 tracks**,
  4.47 GB. **No longer flat since 2026-08-21:** split into
  `Cleared for YouTube-Twitch` (172) and `On-device only` (17, covers +
  collabs — `docs/VIDEO-CLEARANCE.md` says which and why). Safe by
  measurement: `walk()` recurses (depth ≤ 6), serve.py lists and zips
  recursively (probed live, 189 in the zip), and the move preserved
  name·size·mtime so every cache key survived — zero re-analysis. Three
  HARNESSES broke on the flat-path assumption (check-flac, check-pool,
  check-route) and now list recursively — all eight green. All 189 cache keys survived the move (`name|size|mtime`), so
  nothing re-analysed. `Transient Offworld` (10 tracks) had never been scanned
  — it existed only as an unflattened album folder. **SCANNED 2026-08-18** and
  confirmed by the keeper: 219 records in the cache, all ten Transient Offworld
  records now v2. The library is live at the new path and the corpus the
  sequencer builds from is chiptune only.

  Consequence, and it is the one to remember: **`normalise()` has now re-run
  against a pure-chiptune corpus**, so every energy figure and the whole arc
  differ from anything measured before this date. Comparisons across that line
  are not like-for-like.
- **The corpus is chiptune only now, and that changes the arc.** The 28
  non-chiptune imports roughly doubled the brightness range that `normalise()`
  scales against; removing them shifts energy on 191 tracks by a median 0.039
  and **changes the rank of 181 of them**. No purge needed: `DB.all()` is never
  called, `corpus` starts empty each load and is filled only by `ingest()`, so
  scanning the new folder is sufficient. BUILD-LOG Act 23.
- **PHASE: RESOLVED, and it was never phase.** 2026-08-18, after the worklet
  upgrade the keeper reported the popping gone. That was the stated falsifier:
  a non-dropping worklet removing the symptom entirely means phase was never
  audible here. D5's audible half closes as a MISATTRIBUTION, not a fix — the
  whole-track grid was still right for coverage, which was measured separately.
  One report, one pair of tracks; if popping returns on other material, reopen.
- **How it was confounded, kept because it will happen again.** The grid
  coverage half of D5 is verified. The popping-through-a-mix half rested on
  "clean alone, clean jumped-to, pops through a mix" — but the first deck and
  any jumped-to deck run at `rate = 1.0`, and only chained decks are stretched.
  The old SoundTouch worklet (0.3.0) dropped samples ONLY when stretching: 0
  gaps/sec at 1.00, 10 gaps/sec at 1.08. So that A/B separated stretched from
  unstretched just as well as one deck from two, and discriminates nothing.
  BUILD-LOG Act 21 carries the full note.
- **Worklet upgraded 0.3.0 → 2.1.1 (LGPL-2.1 → MPL-2.0), 2026-08-18.** Not a
  drop-in: `tempo` is gone, the source changes speed and the worklet
  compensates pitch. Measured clean offline and verified to load in-browser.
  **How it SOUNDS is unverified** — and if the popping through a mix now goes
  away entirely, phase was never audible here. That is the test.
- **The re-scan moved two things nobody asked for.** Three tracks flipped to
  double tempo with the grid doubling to match (Perpetual Motion, PROXIMA,
  Galaxy) and all three still pass the confidence gate; and confidence fell
  corpus-wide, median 2.181 → 1.783, taking the sequencer pool from 170 to 160.
  Both need the user's ear and decision — do not adjust a threshold to hide
  either.
- **Build is a CHOICE since 2026-08-19:** `build set · all tracks` (the
  no-discard build below, still the default) or `build · best matches` —
  locked grids only, every transition inside the gate, the set ENDS when the
  gate is exhausted and the log says what was left out. `DW.build({mode:
  'best'})`. So "fewer tracks than requested is the gate working" is true
  again — for `best`, by design.
- **Nothing is discarded from a set any more, 2026-08-18.** The confidence
  gate is gone (it was measuring the wrong thing — BUILD-LOG Act 25) and the
  stretch gate no longer ends the set: an unreachable track plays straight and
  repositions the set to its own tempo. Measured on the real corpus: **171 of
  171 placed, 9 straight (5 untrusted grid, 4 out of reach), 162 beatmatched.**
  **[INFERRED]** — 8 offline checks pass; nobody has heard a straight
  transition yet, and the reach jumps are large (167 → 100 bpm in one case).
  **Correction 2026-08-19: "repositions the set" was true of the PLAN only.
  The deck did not re-base until ledger 49** — so a straight transition heard
  before that date would have been followed by a wrongly-stretched track.
- **`sequence()` mutates the shared corpus objects.** `_stretch`, `_tempoAt`,
  `_locked`, `_unlocked` are stamped on the metas, so building twice restamps
  the first set's rows underneath it. Known, not fixed, and it produced a
  phantom test failure once already. `commit()` deletes `_dwell` for the same
  reason.
- **Routing reached the deck for the first time, 2026-08-18.** Every scenic
  route and fast blend since patch 09 was inert in audio: `commitAndRepair()`
  returns a NEW array and `applyRoute()` gave it to the dashboard only, while
  the Player kept the array captured at play(). `DW.reorder(seq)` now adopts
  the caller's array so the two are one object again. **Fast blend also leaves
  the current track at the next downbeat now** — that is a behaviour change,
  not just a fix. BUILD-LOG Act 24, ledger 40. **[CONFIRMED]** by the keeper
  2026-08-18 — *"it's looking/sounding tight now"* — after they had already
  reached the mechanism themselves: *"we are not on demoscene right now."*
- **Now-playing and the track list read the DECK now, not the list index.**
  `DW.nowMeta` is the meta object on the playing deck. The keeper caught the
  old behaviour with *"we are not on demoscene right now"* — the panel naming
  a track they were not hearing. Ledger 33 and 40 are the same class; when a
  component can be TOLD the truth, do not let it infer it.
- **The route panel is the standing check.** It draws
  `set[state.idx] === DW.nowMeta` as `LIST ≠ DECK` in red. That one line is
  what would have caught ledger 40, 33 and 38, and it is now on screen instead
  of in a comment.
- **`settle` exists and is OFF.** Riding a stretched deck back to its own speed
  after a bad blend. Turning it on makes the rolling tempo the current track's
  BPM instead of the 35%-drift target, so it changes the whole plan downstream,
  and 45s is chosen not measured. ROADMAP D8. Do not switch it on for the
  keeper without saying what it changes.
- **"Songs with brackets won't load" is CLOSED as a misattribution.** It was
  ledger 40, not the filenames: those tracks sit at ~140 bpm, outside the gate
  from most of the set, so the only way to reach them was a route — and routes
  never reached the deck. Both named tracks now play. The lesson is cheap and
  worth keeping: **"won't load" from the keeper may mean "can't get there"** —
  check the BPM against the set tempo before touching the filesystem. ROADMAP
  D9. `audit set` stays; it is a real instrument either way.
- **THE PHONE WORKS, 2026-08-19.** iPhone 16 Pro Max / iOS 26.6 / Safari:
  189 tracks scanned to completion on the device (507 s track included), set
  plays. Library arrived as one zip over `serve.py --music`; folder picked via
  iOS 18.4+ `webkitdirectory`. Same evening: audit **86/86 playable, Safari
  decodes FLAC natively** (DWFLAC never reached); **lock-screen-audio FELL**
  ("repeats a sound") — out of the transport, keep-screen-on is the answer;
  **popping on the phone, OPEN — and as of late 2026-08-19 it has a
  measured suspect: the 2.1.1 worklet inserts a 2.9 ms zero gap a few
  times a minute at any rate ≠ 1.0 (ledger 65; keeper heard "limited poppy
  static" on DOOMSDAY → GIANA SISTERS, a ×1.001 chained deck); holding one
  block in the worklet's output zeroes it offline; APPLIED the same night
  on the keeper's word. Then the keeper's NEXT playthrough (demo, ogg+mp3)
  popped faintly again and nobody could say which worklet had run — the
  demo discarded the play line and the gap counter lived in a log nothing
  shows (ledger 69). So now: the held worklet loads from
  `assets/deckwave-stretch.module.js` (a CHECKED-IN concatenation of
  vendored text + wrapper, same-origin, identity-asserted by check-player;
  blob second, plain third), the demo logs the play line, and the
  now-playing card prints `⚠ plain worklet` / `⚠ N gaps` when either is
  true — silent when clean. UNHEARD; the next report reads the card** —
  LISTENING §7 has the discriminating
  question; `latencyHint: 'playback'` is set on phones as the first lever (an
  output buffer size, not a calibration; the ear decides). Interruptions
  (alarm, call) stop and resume the set correctly — but the lock screen is the
  one event that does not come back on its own. ROADMAP "iOS, what is solved"
  §3 updated.
- **Confirmed by the keeper 2026-08-19, by ear, on `build · best matches`:**
  Moments → Alive → FINAL CHAPTER → ROCK 64 — *"hot. Nice mix."* Recorded in
  LISTENING.md "Heard". First ear-level report on the best-matches build.
- **Confirmed by the keeper 2026-08-18:** the now-playing bar fills (ledger 34),
  tooltips follow a swapped tile (ledger 37), and **set journeys sound fine** —
  their words, *"they seem quite fine"*, which is the first ear-level
  confirmation the arc holds on the pure-chiptune corpus.
- `evidence/` holds the pre-fix cache, 219 records, none with a beat past
  119.9s. It cannot be regenerated.
- **Publishing: PUBLISHED 2026-09-01 ("August 32nd — 8 bars of 4"), on
  GitHub** (keeper, 2026-08-27; originally 8/24, set 2026-08-19).
  `docs/LAUNCH.md` is the record of how — the decisions taken before the
  push, what the tree needed, and what did not have to be true by then.
  **The push was the keeper's act and remains so.** This repository begins
  at ONE commit by decision (fresh history); the full local history stays on
  the keeper's machine and in a bundle outside the tree.

  **The rule that outlives the launch:** `master` is local and unpushed,
  forever, and `remote.origin.push` is pinned to a single refspec. A later
  `git push --all`, `--mirror`, or a GUI's "push all branches" would
  republish the private history in one keystroke, and that cannot be taken
  back. Do not create a second remote or push another branch without being
  asked.
  **`docs/research/` (2026-08-19) held the 23 research artefacts behind that
  decision** — four adversarial IP reviews all say "novel integration, not
  invention; publish defensively"; the rest are engine/platform/business
  research plus an `adjacent/` set from the persona project. The *private*
  set (ten files: finances, corporation, patent strategy) was MOVED OUT
  2026-08-27 to `../deckwave-private/research/` on the keeper's decision;
  the adjacent set was deleted 2026-08-21. What remains in the directory is
  publishable, and its README's IP paragraph is the public summary. The
  provisional was DROPPED (keeper, 2026-08-22).

## Running it

```bash
python tools/serve.py          # localhost, 8777. Safe to run twice
python tools/serve.py --stop   # stop it
python tools/serve.py --lan    # LAN, HTTPS, 8443 — cert already exists
```

`.claude/launch.json` declares it so the harness owns the lifecycle.

```bash
python tools/serve.py --lan --music "C:/Claude/Music/LukHash"   # phone: https://<your-lan-ip>:8443, /music/ listing
```

Reloading the page destroys the loaded set and any listen-mode capture. **Say
so before reloading during a listening session** — it costs the user their
work, not just a page.
