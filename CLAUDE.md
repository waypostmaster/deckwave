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

**A check can create the state it reports on — measured here 2026-09-06, and
it is a DIFFERENT fault from everything above.** Every hazard in this section
so far is an instrument that is BLIND: it cannot see the failure, so it says
the same thing on a healthy and a sick system. This one is an instrument that
PARTICIPATES — the act of measuring supplies the condition, and the pass
condition is perfectly correct. Staring at the falsifier never catches it,
because what is wrong is that the run manufactured its own premise.

The specimen: a check warned that `.helm.json` was missing. Verifying the fix
by taking the con CREATES `.helm.json` and clears the warning — for entirely
the wrong reason, since `helm.py release()` removes that file and its ABSENCE
is the free state the desk is in almost always. **The fix is to print the
state in the SAME output as the result**, so the two cannot drift apart, which
is the same move as putting a control and its search in one output.

**This project already had two specimens and had not named the class.**
`sequence()` mutates the shared corpus objects, so building a set in order to
test it restamps the previous set's rows — the measurement consumes the thing
measured. And reloading the page to check something destroys the loaded set.
So: before trusting a green, ask **did running this check create the condition
it reports?** If the instrument writes, locks, mutates, loads or reloads
anything, capture the state alongside the result.

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

**This desk keeps the house file-memory practice, and its two linter warnings
are CORRECT — do not "fix" them.** Adopted 2026-09-06 on the keeper's word.
The role map is `memory-map.json`, gitignored and per-machine for the same
reason `.helm.json` is: house coordination is not product, and a fresh clone
must still run from a static file server with nothing extra. Run it by hand:

```bash
node ~/.claude/skills/house-memory/tools/memcheck.js --selftest
node ~/.claude/skills/house-memory/tools/memcheck.js --map memory-map.json
```

`--selftest` first, always — a linter nobody has watched complain is worth
nothing. **Two warnings are the expected standing state**: `literals`
unassigned (deliberate), and a LEDGER warning saying `docs/ROADMAP.md` is an
unrecognised format — it is 1707 lines of `## R1..R8` headings, not the
house's `STAGED-AWAITING-KEEPER` blocks. **Migrating ROADMAP to make that go
green would be wrong**; the practice is a reference, not a migration, and the
variances are written out in `memory-map.json` under `_variance_*`.
**`memcheck` is NOT wired into `package.py` or any harness and must not be** —
vendoring it would breach the bare-`node`, nothing-third-party rule at the top
of this file. Green from it is not a read of the file either; it cannot see
two paragraphs contradicting each other.

**The user's ear is an instrument.** On the beat-phase question it resolved in
one A/B what three measurements could not. Take their reports seriously and
literally; "it doesn't pop when I jump directly to it" was the whole diagnosis.

## Current state

**READ THIS BLOCK FIRST — where things stand as of 2026-09-03, with one
addition dated 2026-09-30.**

**The addition: a side branch, `codex/mike-reliability-ui`, holds an outside
contributor's work that `public` does not** — Mike's seven engine/capture/
render fixes and a prepared-set UI, committed as `8bf6f82` on 2026-09-30 from
a tree Mike left uncommitted on 2026-09-08, reviewed in Act 47 (ledgers
137–141). It changes the beatmatch itself (138); its one confirmed
regression (137, route stones on untrusted grids) is fixed in `579da82` with
a real-corpus falsifier. **HEARD 2026-10-05: the keeper ran the A/B and
said the new engine "sounds fine" (ledger 138, CONFIRMED).** It is not yet
merged or pushed; `git branch -vv` says where the two branches stand, not
this sentence. The old engine stays reachable at `v0.8.2`; there is no
switch between the two and there should not be.

**GitHub traffic is captured weekly** (Act 48, ledger 142): a Windows
scheduled task runs `tools/gh-traffic.py` every Saturday into
`evidence/gh-traffic/`, dated files, never git. `schtasks /query /tn
"Deckwave GitHub traffic capture" /v /fo list` says when it last ran and
with what result; do not read that from here.

**Deckwave is PUBLIC.** 0.8.0 was pushed 2026-09-01 ("August 32nd — 8 bars
of 4") to `waypostmaster/deckwave`, one commit of fresh history, tag
`v0.8.0`, `deckwave.fm` on GitHub Pages. **0.8.1 (2026-09-03) is the review
release:** every finding of the launch-day review (`docs/REVIEW-2026-09-01.md`)
is resolved, measured, or written down as the keeper's call — ledgers
122–132 in BUILD-LOG, Act 41. **0.8.1 as tagged did not BOOT on Pages** (two modules parsed and threw on load; the harness only parsed) — 0.8.2 is that fix plus the gate, ledger 132. Nothing in it moved a threshold,
calibration or detector; nothing in it has been HEARD.

**This block used to be 660 lines of narrative.** It was retired whole to
`docs/CLAUDE-STATE-2026-09-01.md` on 2026-09-03 (the review's last open
item); BUILD-LOG Acts 22–41 carry the same story with the reasoning. What
stays here is what a session needs to act.

**The rule that outlives the launch:** `master` is local and unpushed,
forever, and `remote.origin.push` is pinned to `refs/heads/public:refs/heads/main`.
A `git push --all`, `--mirror`, or a GUI's "push all branches" would
republish the private history in one keystroke and cannot be taken back.
Do not create a second remote or push another branch without being asked.
The private research (finances, corporation, patent strategy) lives
OUTSIDE this repository by the keeper's decision (2026-08-27); the launch
runbook (`docs/RUNBOOK.md`, registrar ids, account names) is gitignored.
**Before any push, sweep the tracked tree for those with a control term
that must hit** (ledger 121: a zero without a control is decoration).

### Harnesses — sixteen of them, 1063 checks, all `node tools/check-*.js`

`check-pool` 54 · `check-route` 21 · `check-player` 80 · `check-panels` 202 · `check-phone` 76 · `check-phrase` 48 · `check-libre` 109 · `check-flac` 13 (needs the library) · `check-popout` 27 · `check-events` 64 · `check-recon` 137 · `check-citywalk` 58 · `check-serve` 67 (needs python) · `check-loop` 46 · `check-reliability` 47 · `check-prepared` 14 — **1063 in all, MEASURED 2026-09-30T22:51Z on `codex/mike-reliability-ui` by running all sixteen and summing the tally lines. All sixteen green, library and python present.** The two newest are Mike's (Act 47); `public` at `338bdd7` still has fourteen and 998. Ledger 141 says exactly what the new checks can and cannot fail on.

**This line said 997 / `check-panels` 201 for a day, and Act 45 said 998 in
the same tree** — Act 45 added the check and updated the journal, not the
kernel. A number in two places drifts in one of them; the tie is broken by
running the thing, never by choosing the more recent sentence (ledger 136).

**Three go red without the library, on purpose** (`check-flac`,
`check-pool`, `check-route` each fail ONE check that says the corpus is the
one under test). `check-serve` needs `python` — it starts the REAL
`serve.py` on a free port and asks it over a socket. **Every harness ends
on the exact line `all passed of N checks`, as the LAST line of stdout**,
and `check-serve` sweeps the others for the template (ledger 110: a
prettier variant once scored zero). **A text harness cannot see a broken
parse** (ledger 111) — any harness that reads a script it does not execute
compiles it with `vm.Script` first — **and parsing is not loading** (ledger 132): `check-panels` also EXECUTES every script index.html loads, in order, in a sandboxed window, and demands the boot gate's globals exist afterwards. **A harness that crashes prints no
tally, which the sweep scores as zero** (ledger 130) — every call into the
module under test goes through a catching seam. Every new check is run
against the OLD source first (`git show HEAD:<file>` + the harness's
`DECKWAVE_*_SRC` env seam) and must fail there. Run them before and after
anything. `tools/measure-worklet.js` and `tools/phrase-scan.js` are
MEASUREMENTS, not harnesses.

**997 green is a floor, and here is exactly where it stops — MEASURED
2026-09-07T04:57Z (ledger 136). No harness has ever touched real Web Audio.**
There is no browser driver in the tree: puppeteer 0, playwright 0, jsdom 0,
selenium 0 across `tools/*.js`, against a control of `require(` = 42. The
Player is `eval`'d against a hand-written fake `AudioContext`
(`tools/check-player.js:36-67`). The sharpest number: **24 gain-envelope
scheduling calls in `assets/*.js`** — `setValueAtTime` 10,
`linearRampToValueAtTime` 8, `cancelScheduledValues` 4, `setTargetAtTime` 2 —
and **all six occurrences of those names anywhere in `tools/check-*.js` are
no-op stub definitions, zero assertions** (`check-player.js:38-39`,
`check-phrase.js:65-66`, `check-route.js:21-22`).

So the harnesses cover **which track, in which order, in which state after a
replan** — and they cover it well; hand-resolved decode promises make the
replan-during-decode interleavings exact rather than raced, which caught a real
bug. They CANNOT cover **what value, at what time, on which node**. Blind by
construction, five ways: every AudioParam write (`param()` no-ops all four
setters); graph topology (`connect()` is `{}`); clock drift (`let now = 100`
IS `currentTime`, so the audio clock and a timer cannot disagree); real buffers
(decode resolves `{duration, name}`, so `sampleRate`/`numberOfChannels`/`length`
are never exercised); real timers (anything over 1000 ms is captured and fired
by hand). **Do not read a green sweep as covering a crossfade, a leak over
hours, or drift.** Those need the ear or a browser.

### Open items — BASE (each needs the keeper's ear; none is a build task)

0. **§23, the two tunes — UNHEARD.** `CAMELOT_MINOR` numbered minors by
   their parallel major; not swapped (keeper: *"so we're not messing up my
   mix"*) — `tune` in ⚙, deckwave tune the default, standard Camelot one
   select away, `DW.retune()`. Measured: only 3.2% of ordered pairs on the
   real corpus differ. The A/B: build, switch, build again, same seed.
1. **The popping (ledgers 65/69).** One glance at the now-playing card on
   any playthrough: clean, `⚠ plain worklet`, or `⚠ N gaps`. LISTENING §7.
2. **Phrase match by ear** — LISTENING §12. If phrase-next is "tight" it
   becomes the default next.
3. **Libre by ear** — §13: Ogg vs FLAC; Commons through the gate (Ogg/Opus
   will not decode on the iPhone — count the failures as data).
4. **Phone singles:** §8 handover-title half, §9 lock art, §11 lock-screen
   ▶▶ blend, §14 Android call pauses the set (ledger 71 [INFERRED]).
5. **A straight transition has never been heard** — the no-discard build's
   reach jumps (167 → 100 bpm) are [INFERRED] from harnesses only.
6. **Two exit policies for a grid-unlocked track (0.8.1, keeper's call).**
   `chain()` leaves on the clock; `blendNow`/`skip`/`reorder({now})` snap
   to the distrusted grid. Both sites name the other. One A/B decides:
   planned exit versus pressed next on an unlocked track.
7. **Held, not scheduled:** loudness levelling across tracks (ledger 72's
   loudness-blind exit stays logged-not-fixed by instruction), D10's grid
   runs (a detector change), Apple Watch controls (ledger 79), the
   opener tie-break (ledger 126 — a preference the code does not actually
   have; on this corpus it changes nothing).

### Open items — CONSOLE EXTENSION (RECON + the voice)

0. **§21/§22, the stage, the voice card and the mixer — built, UNRUN as a
   session.** Fixes ride a `{"reload":true}` hot swap; shell-CSS halves
   arrive on the next plain reload (ledger 83).
1. **§18, the vocal gate — UNHEARD.** One play of DROWNING with a voice
   record queued.
2. **First full narrated session on the settled voice** (speaker 99 at
   grade `facility`, §19.1).
3. **§20, the instrument column — UNLOOKED-AT.** Ledger 82 is now closed
   on all five surfaces (0.8.1: an engine fact, `DW.deck.origin`, carried
   through `pulse()`); the glance is whether the column earns its 300 px.

### NOT owed — do not re-run these

**This section exists so a successor can tell a drained queue from an
unstarted one.** Everything above says what is owed; without this, a list of
open items reads as complete and the next session's first act is work
somebody already did. There is nothing in a handoff that distinguishes "not
listed because it is done" from "not listed because I ran out of room" —
which is the negative-control rule wearing handoff clothes. Adopted from the
house-memory practice 2026-09-06 (frontier-70's rule, and that desk was bitten
by its absence before it had a name for it).

- **The launch-day review is closed.** Every finding of
  `docs/REVIEW-2026-09-01.md` is resolved, measured, or written down as the
  keeper's call — ledgers 122–132. Do not re-audit it.
- **0.8.1's boot failure is diagnosed and fixed** (backticks in comments
  inside CSS template literals; 0.8.2 plus the load sweep, ledger 132, and it
  caught its own class again two days later as ledger 133). Do not re-diagnose
  a Pages boot failure from scratch — run the sweep.
- **The 660-line narrative was retired ON PURPOSE** to
  `docs/CLAUDE-STATE-2026-09-01.md`. Do not restore it here or re-summarise it;
  BUILD-LOG Acts 22–41 carry the same story with the reasoning.
- **The harness total is 1063 on this branch**, MEASURED 2026-09-30T22:51Z
  by running all sixteen, not by arithmetic on a delta. All sixteen green,
  library and python present. Do not re-count to check — but DO re-run if
  another document in this tree disagrees with this number, which is how the
  stale 997 was caught (ledger 136).
- **Mike's commit `8bf6f82` has been reviewed** (Act 47, ledgers 137–141:
  three Opus 5.5 read-only reviewers, every finding re-checked against the
  code path by this desk). Do not re-review it from scratch. What is owed on
  it is the keeper's: the A/B in ledger 138 and the two calls in 137.
- **DNS is correct and needs no work.** MEASURED 2026-09-06: `deckwave.fm`
  ALIASes to `waypostmaster.github.io`, resolves to all four Pages A records,
  serves 200 with the tracked `CNAME` file matching. The other 29 `deckwave.*`
  domains are parked at Porkbun by choice. Do not go looking for a domain to
  point; one is already pointed.
- **`.helm.json` and `memory-map.json` being absent from a fresh clone is the
  design, not a gap.** Both are gitignored per-machine coordination.

**What IS owed is everything under the two "Open items" headings above**, and
those are keeper's-ear items, not build tasks. **No build task is outstanding.**

**Do not read a push state from this file. Run the command:**

```bash
git log --oneline origin/main..public        # what is unpushed, if anything
git ls-remote origin refs/heads/main         # what GitHub actually serves
```

The second is not the first: `.git/refs/remotes/origin/main` is only what this
clone last HEARD. **This paragraph replaced two successive attempts to state
the count as a fact — "nothing is unpushed", then "ONE commit is unpushed" —
each true when written and falsified by the commit that saved it** (ledger
136b, then 136d). The third attempt stores the instrument instead, which is the
only version that cannot go stale. Whatever the count is, the ledger-136
commits are docs-only: nothing under `assets/`, so `deckwave.fm` is not behind
in any way a visitor can see, and pushing them is optional, not a build task.

**And the sentence that stood here for four minutes is the best specimen of
Act 43's class this desk has produced.** It read *"Nothing is unpushed and
`deckwave.fm` is current"* — MEASURED, correct, with `ls-remote` cited. Then
committing the file that said it MADE something unpushed. **The instrument did
not merely participate in the condition; the act of RECORDING the fact
destroyed the fact.** No falsifier catches this, because the claim was true at
the instant it was written and the write is what ended it. The general form,
which is worth more than the instance: **a note about the tree, stored in the
tree, is inside its own subject.** Anything of the shape "the tree is clean",
"nothing is staged", "no commit is pending" self-invalidates on being saved.
Prefer the command to the value — this block now names a SHA, which stays true,
rather than a state, which did not. The literals below survive that:
`git ls-remote origin refs/heads/main` served
`a1d49da97175c3cc5ca315ba877e14e9274c9600` at 2026-09-07T04:57Z, and at that
moment `git log origin/main..public` was empty. This block previously said `745453f`
(the two header links) was committed and NOT pushed, so the site was a commit
behind. That was true when written and is now false. **The correction is also
the method note: `.git/refs/remotes/origin/main` is what this clone last
HEARD, not what GitHub serves** — they agreed here, but they are two
measurements and only one of them is about the world (ledger 136).

### Load-bearing facts that are not in the code

- **Confirmed by ear so far:** the best-matches walk Moments → Alive →
  FINAL CHAPTER → ROCK 64 ("hot. Nice mix."); set journeys on the
  chiptune corpus ("they seem quite fine"); routing reaching the deck
  ("it's looking/sounding tight now"); the phone through the lock screen
  ("you have made it work", "It works"); the voice pipeline in full (gain
  1.62 · room 0.3 · Zira −15%/−8% · facility chain — `evidence/voice-pipeline-2026-08-23.md`
  is canon, nobody moves those numbers by reasoning); the cyberpunx
  ticky-ticky is IN THE SONG. Everything else tagged UNHEARD in LISTENING
  is exactly that.
- **The corpus is chiptune only** (189 tracks, `C:\Claude\Music\LukHash`,
  split into `Cleared for YouTube-Twitch` and `On-device only`), scanned at
  `ANALYSIS_V = 2`; `normalise()` re-ran against it 2026-08-18, so no
  energy figure is comparable across that line. `evidence/` holds the
  pre-fix cache and cannot be regenerated.
- **`sequence()` mutates the shared corpus objects** (`_stretch`,
  `_tempoAt`, `_locked`, `_unlocked`); building twice restamps the first
  set's rows. Known, not fixed.
- **`settle` exists and is OFF** (ROADMAP D8); switching it on changes the
  whole plan downstream. Do not switch it on for the keeper without saying
  what it changes.
- **"Won't load" from the keeper may mean "can't get there"** — check the
  BPM against the set tempo before touching the filesystem (ROADMAP D9).
- **A long-running process holds the code it started with.** The 8777
  server needs `python tools/serve.py --stop` and a restart to pick up a
  `serve.py` change; RECON re-boots through the feed; the deck page needs
  a reload, which **destroys the loaded set — say so first** during a
  listening session.
- **Tooling hazard, mine:** Bash heredocs in this harness unescape
  backslashes; edit files with Write/Edit, never a heredoc that contains
  backslashes.
- **Other sessions work in this repo.** Name files when you commit; never
  `git add -A`; never stash. A sibling session's uncommitted work is not
  yours to sweep up (ledger 112) — leave it and say so.

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
