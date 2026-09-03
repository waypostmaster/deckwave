# Deckwave — the listening plan

Seven things are built, measured and **unheard**. Each one below names the
exact tracks, what to do, and — the part that matters — **what answer changes
what**. Test 0 is the one to run first: it covers two of the others at once.

Written down rather than left in a conversation, because a finding that lives
only in chat is lost at the next compaction, and that has already cost this
project a session (ledger 30).

**Derived from** `evidence/rescan-2026-08-18-measurements.json` — the v2 grids,
2026-08-18. Track tempos below are what the live corpus holds. If the library
is re-scanned these numbers move and this file needs regenerating.

**Nothing here is a threshold I will move on my own.** Every one of these is a
number chosen or derived and then left alone, waiting for an ear.

---

## 0 · The walk: WALKMAN → LIKE A DEAD PIXELS

**The keeper's own route, and the best single test here** — it exercises the
stepping stones and a straight transition back to back, and it is also the
build-video set piece.

Start on **WALKMAN** (128 bpm, 7A). Click **TAKE CONTROL** and choose
**⚡ blend fast**. Five stones, 3.8 minutes:

> Eighty-five 120 → NIGHTWALKING 116 → Keygen 115 → Raster Bar 111 →
> Copyparty Memories 109 → **TAKE CONTROL 107**

Then click **LIKE A DEAD PIXELS** and choose **∿ bring it in now · no stretch**.

**Why this pair and not another.** LIKE A DEAD PIXELS is labelled **92 bpm**
and its beats are actually spaced at **106.6**. The route lands the set at
**107**. Played straight it therefore arrives **0.0% away in real pulse** —
against 16.1% out if anything had trusted the 92. It should land on the beat
by arithmetic, with nothing claiming to beatmatch it.

Direct from 128 to 107 needs 20.1% against an 8% gate, so the stones are doing
real work rather than decorating.

**Answers two questions at once:** do the 45-second stones get a fair hearing
(test 3), and does a straight transition sound like a DJ choice (test 1). If
this one lands, both are probably fine. If the stones feel rushed but the
landing is clean, that separates them.

---

## 1 · A track played straight — the biggest unknown

Five tracks are no longer beatmatched at all. Their beat grid disagrees with
their own tempo label by more than 9%, so the engine plays them at their own
speed with a plain crossfade and no beat alignment.

**Nobody has heard one.** This is the single largest unheard change.

| track | grid is off by | declared | the beats actually say |
|---|---|---|---|
| **WHEN AN ANGEL DIES** (DEAD PIXELS 05) | 28.3% | 151 | **~108** |
| **LIKE A DEAD PIXELS** (DEAD PIXELS 08) | 16.0% | 92 | ~107 |
| **HEAVEN** (GHOSTS 11) | 13.9% | 172 | ~148 |
| **TETRA TENNIS** (BETTER THAN REALITY 10) | 13.3% | 80 | ~90 |
| **Timeless** (single) | 11.0% | 85 | ~94 |

**How.** Click any of them in the set list. The menu now says *plays straight*
and offers **∿ bring it in now · no stretch** — it no longer quotes a stretch
percentage, because none is applied. Pick that.

**Best approach tracks** (already near where the grid really sits, so the
transition is the fairest test):

- **WHEN AN ANGEL DIES** ← from *Cyberpunx* or *Magic Gateway* (both 108)
- **LIKE A DEAD PIXELS** ← from *TAKE CONTROL* or *Neon Thrills* (107)
- **HEAVEN** ← from *COMPUTER DATE* or *The Other Side* (150)
- **TETRA TENNIS** ← from *WE ARE FOREVER* or *PERPETUAL MOTION* (90)
- **Timeless** ← from *Cyberiad Theory* or *Code Veronica* (94)

**What to listen for.** Does it read as a DJ choice — a record dropped in
clean — or as a mistake? The bass swap still happens; only the beat alignment
is absent.

**What the answer changes.**

- *"Sounds fine"* → the design holds, and the 3% cut in test 2 becomes worth
  trying, since more tracks going straight costs less than feared.
- *"Sounds like a mistake"* → straight transitions need their own treatment —
  a longer fade, or a fade to silence and in again, rather than a crossfade
  that half-implies a mix.

**A separate observation worth your ear:** *WHEN AN ANGEL DIES* is labelled 151
but its beats are spaced at 108. That is not a small error; one of the two
numbers is simply wrong. Tapping along will say which.

---

## 2 · The 9% cut, against the other defensible answer

`DW.lock.maxGridErrPct` is **9**, and it is the first threshold in this project
derived rather than chosen: the distribution over 179 tracks has an empty band
between 7.50% and 11.04%, and every cut inside it selects the identical five
tracks above.

The other defensible answer is about **3%**, on the argument that grid error
adds to the stretch budget and we already refuse 8% of stretch because it
wobbles. That plays **22 tracks straight instead of 5**.

**How.** In the console: `DW.lock.maxGridErrPct = 3`, then **build set** again.
No reload. Set it back to 9 the same way.

**The seventeen that move**, worst first:

`R3B0RN` 7.5% · `8BIT FAIRY TALE` 7.1% · `BEGINNING OF ANXIETY` 7.0% ·
`CLONED` 6.4% · `WE ARE FOREVER` 6.4% · `PROXIMA` 6.4% · `MIDNIGHT LIGHTS` 5.9% ·
`POISON` 5.7% · `ANOTHER WORLD` 5.2% · `Falling Down` 5.0% · `WINTER ERROR` 4.6% ·
`GONE TOO SOON` 4.5% · `FINAL CHAPTER` 3.9% · `65536` 3.7% · `PRELUDE` 3.5% ·
`GHOSTS` 3.2% · `HI-LAND COO` 3.1%

**What to listen for.** At 9%, those seventeen are being beatmatched with up to
7.5% of grid error on top of up to 8% of stretch. Do their transitions drift?
A drifting beatmatch is a specific sound — the kick doubles and separates
rather than staying one kick.

**What the answer changes.** If they drift, the cut comes down and the library
gets more honest and less mixed. If they hold, 9 stands and possibly higher.

---

## 3 · Stepping stone length — D7, 45s against 40s

Every stone on a fast route plays **45 seconds**. Patch 10 asked for 40;
`chain()` clamps to `MIN_PLAY`. Both numbers were typed, neither measured.

**Three real routes**, computed against the live tempos. Start the set, let it
settle near the starting tempo, then click the destination and choose
**⚡ blend fast**.

**From ~130 bpm → TAKE CONTROL (107).** Direct would need 21.9%; the gate is 8%.
Six stones, 4.5 minutes:

> BETTER THAN REALITY 125 → Eighty-five 120 → WE COME TOGETHER 116 →
> Keygen 115 → Raster Bar 111 → Copyparty Memories 109 → **TAKE CONTROL 107**

**From ~110 bpm → PERPETUAL MOTION (90).** Direct 22.2%. Six stones:

> Pixel Crush 102 → STARGAZE 100 → Fading 98 → Alive 96 → Code Veronica 94 →
> DIGITAL HEART 92 → **PERPETUAL MOTION 90**

**From ~150 bpm → TONIGHT (124).** Direct 21.1%. Six stones:

> HI-LAND COO 140 → PIXEL MY HEART 137 → CHINA 138 → UNDER YOUR SKIN 132 →
> ACIDJAZZED EVENING 128 → ALIEN 128 → **TONIGHT 124**

**What to listen for.** Did each stone get a fair hearing, or did one get cut
while it was still building?

**What the answer changes.** *Rushed* → the floor goes **up**, 40 is dead
without testing, and patch 10's saving claim shrinks again. *Fine or slow* →
40 is worth hearing and I wire a live setter so you can A/B it.

Note the second route passes through **STARGAZE**, one of the ten the old
confidence gate had excluded — it is only reachable at all because of that
change.

---

## 4 · `settle` — riding a bad blend back to normal speed

Off by default. **settle after a bad blend** in the transport.

**How.** Two forced blends, same pair, toggle between them. Real pairs at
+11%, comfortably outside the 8% gate and short of the 15% wobble limit:

- play **HI-LAND COO** (140) → force **ANOTHER WORLD** (126)
- play **Overdrive** (141) → force **DIGITAL MEMORIES** (127)
- play **DOOMSDAY** (140) → force **ANOTHER WORLD** (126)
- play **HALF SAVAGE** (89) → force **DROWNING** (100)

With settle **off**, the incoming track stays 11% wrong for its whole length.
With it **on**, it rides back to its own speed over 45 seconds.

**Two questions, and they must be answered separately.**

1. *Does the ride sound musical, or does it sound like tape slowing down?*
   45 seconds is a chosen number.
2. *Does the SET get better or worse afterwards?* A settled deck hands over at
   its own BPM instead of the 35%-drift target, so every gate test downstream
   is measured from somewhere else. Ladders get tighter and shorter.

**What the answer changes.** Yes to 1 and no to 2 is a real outcome and has a
fix: settle within the track and restore the drift target at handover. More
machinery, but the option exists.

---

## 5 · The reach jumps — abrupt by design

Four tracks in a full build are reached by playing them straight because the
stretch gate could not get there. Observed on the test build:

| from | to | track |
|---|---|---|
| 140 | **172** | CLONED |
| 167 | **100** | DROWNING |
| 109 | **85** | PAPER DOLL |
| 91 | **81** | Galaxy |

The set repositions to the new tempo and carries on mixing from there.

**How.** Build a set and look for the rows with a dashed left edge and a `∿`
before the BPM. Listen to the transition **into** each.

**What to listen for.** 167 → 100 is a hard reset. Honest — nothing claims to
be beatmatched — but is it a floor-clearer?

**Read before listening, added 2026-08-19.** Until that day this test could
not have been heard as designed: the planner re-based the set to the reach
track's tempo and the DECK did not (ledger 49), so the track AFTER the jump
would have been chained at the old target over its bpm — ×1.67 after
167 → 100 — and the sound you would have blamed on the reach jump was a
different defect one track later. Fixed and measured on a synthetic corpus;
if the transition INTO the reach track lands but the one OUT of it sounds
wrong, that is the thing to report.

**What the answer changes.** If they land badly, the fix is routing to them
with stepping stones instead of jumping, which smooths the tempo across
several tracks. That option was offered and declined; it is still available.

---

## 6 · The three tracks that came back at double tempo

The whole-track rescan flipped three grids to double, and all three still pass
every gate — so they enter a set at double tempo, chosen as neighbours for a
tempo they do not have.

| track | was | now |
|---|---|---|
| **Perpetual Motion** (CyberChip 01) | 93.99 | **184.57** |
| **PROXIMA** (BETTER THAN REALITY 06) | 90.01 | **178.21** |
| **Galaxy** (single) | 80.87 | **162.09** |

**How.** Jump to each and count. The transition monitor draws both grids, so
this can be watched as well as heard.

**What to listen for.** Is the pulse the engine is locked to the pulse you
would tap?

**What the answer changes.** This is a per-track correction, not a threshold —
if they are wrong, those three get pinned back to half and nothing else in the
corpus moves.

---

## Heard

**2026-08-28, evening, mid-set on the PC:** *"It is sounding HOT. I think
I am on full build, and just have not noticed anything at all. On PC.
[noise] cancelling headphones (SteelSeries Arctis Nova Pro). SO banger."*
Recorded as what it is: the first clean-by-ear desktop session report on
the (believed) all-tracks build since the held worklet landed — nothing
noticed means no pops, no gaps, no wrong-track moments surfaced to an
attentive ear on isolating headphones. What it does NOT settle, kept
narrow: the build mode was believed, not read off the screen, and the §7
card glance (clean vs `⚠ plain worklet` vs `⚠ N gaps`) was not taken —
so §7 stays open, holding a strong negative report it should be paired
with next glance.

**2026-08-23, by eye, for the build video:** *"goniometer is BANGER on
NEON THRILLS, scope looks good as a pair too."* **[CONFIRMED]** as the
report - the third by-eye panel finding (pitch classes on Lullaby, the
spectrogram on Lullaby, now the goniometer + oscilloscope on NEON
THRILLS) and the first that names a PAIR of panels rather than one.
Recorded as **shot 10** in VIDEO-CLEARANCE.md with the cut ambiguity
resolved: the library holds three NEON THRILLS files and *BETTER THAN
REALITY 02* / *NEON THRILLS -Single- 01* share one analysis (109.88 bpm,
F# minor, 2A, conf 2.153, coverage 99.76%) while *CyberChip 07 Neon
Thrills 8580R5* is a separate arrangement at 107.44 - the shot notes
must say which, or the tempo strip contradicts the edit. All three sit
in `Cleared for YouTube-Twitch`.

What it is evidence FOR, stated narrowly: the goniometer draws the
decoded stereo field, so this is another healthy-decode witness on
FLAC-from-disk material, alongside the Ogg witness at shot 2 (Prelude /
Gone Too Soon). It is **not** a report about the mix, the gate, or any
transition - nothing was said about how NEON THRILLS sounded in a set,
and nothing here moves a number.

**2026-08-23, ~4 a.m., the voice calibration LOCKED:** *"That actually
worked really well."* The walkthrough preset, found entirely by the
keeper's ear over an hour of live A/B through the feed: **dial 4 (cruise
0.4) · boost on · overdrive 1.45 · voice Karen** - music near-steady
under speech, voice inside the mix rather than on top. On the way there,
by measurement: utterance.volume silences iOS outright (ledger 75), the
OS ducks around all synthesis (74), Whisper is "way too creepy
lolllllll" (retired to the archive of things that worked too well), and
Ava Premium runs hot. All device-persisted; voiceCfg lines re-tune it.

**Same minute, unprompted:** *"I paused it because I had a real world
person speaking to me and then a one tap to my AirPod resumed it!"* -
**AirPods tap pause/resume works against the deck [CONFIRMED]**, the
playback audio session handling headphone controls natively. A
real-world interruption, handled like a real player.

**2026-08-23, with a screenshot:** *"Spectrogram very beautiful under
lullaby beginning"* - sparse strikes in the high octaves, then the
broadband bloom. Second by-eye report on Lullaby's opening bars
(pitch classes before). Video shot 8.

**2026-08-23, the seance:** *"This is a trippy mix. For some reason
Karen is still emitting while the under speech. And there are multiple
under speeches coming through at once. You're blowing my mind. Is this
snow crash?"* - a hot-swap replaying every voice in the feed at once,
over the set. Found by ear, named by novel, fixed by quiet boot
(Act 36). Video shot 9, deliberately re-creatable.

**2026-08-23, the voice LOCKED IN FULL:** *"This is perfect. This is the
volume. This is the reverb amount. Lovely."* Final: Zira -15%/-8% ·
facility chain at room 0.3 · gain 1.62 · through the deck graph. The
whole pipeline is in evidence/voice-pipeline-2026-08-23.md; every word it
has spoken is in docs/VOICE-TRANSCRIPTS.md.

The rest of the keeper's reports, as they arrive:

**2026-08-22, later:** *"a bit of a ticky-ticky in the cyberpunx song.
however i jumped directly to it (from itself) and it's within the song. i
think it's element of the song. logged, no fix needed."* Note what the
keeper did there: the DIRECT JUMP is the discriminating test (a jumped-to
deck runs unstretched at rate 1.0 — the Act 21 confound in reverse), so
the tick is in the material, not the pipe. The worklet is exonerated for
this instance by the keeper's own method. Logged, no action.

**2026-08-22, mid-playthrough:** *"Gone Too Soon literally went to
quiet … thematically okay? i guess. it's a warning for a DJ that puts it
in their set with whatever build order I chose."* The long rain outro
played into near-silence mid-set (probably a set built from the
`Cleared for YouTube-Twitch` folder — the keeper's recollection, so the
corpus was the 172 solo originals) — ledger 72: the sequencer is
loudness-blind at exits (no loudness contour is stored), so any
long-quiet-tailed track can do this in any build order. **Logged, not
fixed, by explicit instruction.** The same behaviour is the chosen
credits shot in the build video.

**2026-08-21, mid-playthrough, song 3:** *"the pitch classes work
beautifully at the start of Lullaby."* First by-eye confirmation of the
pitch-class panel against real material — and noted for the build video
(the panel was added near the beginning of the project, and it lands on
song three of a set: the arc of the thing, visible).

**2026-08-19, latest+5 · the autoplay word, and a hold that felt broken.**
Keeper: *"it started by itself, no ▶ press needed"* — **[CONFIRMED]: WebKit
honoured a `resume()` arriving after the demo's opening fetch.** Act 31's
autoplay caveat closes for iOS Safari; the demo self-starts on both
platforms seen so far. Same message: *"once the demo starts playing no
other buttons are functional and its unclear why or when they might be"*
— the hold was WORKING AS DESIGNED and invisible: the buttons answered
with a sentence that went to a return value the phone never displays.
Fixed the same hour: every blocked press now logs `demo: the set is still
arriving (i/n) — controls return when it is home · pause still works`,
the ▶ demo button itself counts `demo 4/9` up as tracks land, and says
`✓ demo … controls are back` when they are. On the keeper's run the whole
hold likely lasted seconds (the phone had the tracks cached) — which made
the silence look all the more like a fault.

**2026-08-19, latest+4 · battery, spectrum at 1 Hz, and THE DEMO.**
Keeper, still at the phone: *"it doesn't feel warm. i've been watching
spectrum. i'll try others... demo button works !"* So: §9's battery
question answered at the hand-on-the-phone level (**not warm** with the
1 Hz encode running under lock); the panel being watched was SPECTRUM —
the one §9 predicted would read as stills, and the keeper is trying the
others unprompted; and **`▶ demo` WORKS, first press, on the iPhone**
**[CONFIRMED]** — the one that was expected to stumble on WebKit's
autoplay rules. What the two words do not say: whether Stand Alone
started BY ITSELF after the fetch or needed one ▶ press — that word is
the WebKit autoplay answer (Act 31's open question) and is worth asking
when the music stops mattering more than the question. Note the phone
had already fetched and analysed these nine tracks, so this demo ran on
cache hits — the cold-machine demo (and the determinism experiment it
carries) is still unrun.

**2026-08-19, latest+3 · the locked iPhone, live art, libre set.** Keeper:
*"dude. the iphone is fucking TIGHT. i just had it on my desk and, of
course, it locked, but kept playing, threw up the new vis, 1hz at a time,
i dont care. it's still hella cool."* Three claims in one desk moment,
all **[CONFIRMED]**: `background audio` held through an UNPLANNED lock
(§8's lock half, second night, different set); the `lock art: live` 1 Hz
artwork UPDATES on the locked card (§9's experiment — the branch nobody
promised); and the material playing was fetched from the Archive. Left
open in §9: which panel reads best, the ten-minute hold, battery.

**2026-08-19, latest+2 · the mixed-format set, on the phone.** Keeper:
*"i mixed ogg and mp3, 29 tracks 2 untrusted grid 8 out of reach.
listening now. sounds tight so far."* — §13.3's discriminating split,
answered: of the 10 left out, only 2 are distrusted grids; 8 are reach,
the small-corpus effect. A mixed ogg+mp3 corpus gates and SOUNDS tight
**[CONFIRMED]** at the so-far level. Then, unprompted: *"this is a ...
really beautiful mix of songs. gone too soon is so beautiful with the
guitar at the beginning"* → *"ok i need to learn guitar"* → *"and i want
to play this in the build video lol"*. The intro chords were estimated
from the track (LAUNCH.md has them, with the estimate's caveats). Gone
Too Soon decodes at 507 s — it is the same track whose rain outro rolls
the credits in the storyboard.

**2026-08-19, latest+1 · the first libre SET.** Keeper, mid-listen:
*"first libre set is running now. decent so far. Stand Alone > Prelude >
Gone Too Soon > Winter Error > We Come Together > Bit No Tamashi >
Tonight > Digital Memories > WTF?"* — a nine-track run of fetched LukHash
(Dead Pixels / Digital Memories material, the Archive's Ogg derivatives)
playing through the whole engine. **[CONFIRMED]** the first of §13's ear
questions at the "decent so far" level: fetched Ogg through the worklet,
blends between fetched tracks, mid-set, no complaint yet. Not yet a
verdict on Ogg vs FLAC (§13.1's A/B stands open). Same report: *"I think
some got dropped in the download attempt"* — the Archive was under load
(502s measured the same hour); the panel then only flashed the failure
count in the footer once. Fixed the same night: per-track ✓/✗ marks read
from the corpus, a ↻ retry on the button, collapsible release rows,
`from archive.org` credit on the card and the log. Follow-up, same
listen: *"Both Prelude and Gone Too Soon are lovely on the goniometer"*
— the first VISUAL report on fetched material (the goniometer draws the
decoded stereo field, so an Ogg derivative that draws lovely is also
evidence the decode path is healthy), and it seeded the free-culture
build-video idea now recorded in LAUNCH.md. And then: *"incredible visual
of gone too soon giving up the entire centre and sides at the end"* — the
outro surrendering both the mid (the vertical of the lissajous) and the
side (the horizontal spread) as it closes. That is the track's own
production, drawn faithfully — kept because it is exactly the kind of
moment the build video would be made of, and because a lossy derivative
rendering a stereo-field COLLAPSE cleanly is a stronger decode-path
witness than a busy field, where artefacts hide.

**2026-08-19, latest · `⊕ libre`.** Keeper, after the merge to master and a
reload: *"cool, it worked!"* **[CONFIRMED]** that the libre flow runs end to
end on the keeper's own machine and profile — search, fetch, build, play.
Taken literally, "it worked" is a report about the FLOW, not yet an answer
to §13's three ear questions (the Ogg through the worklet, a fetched-to-
fetched blend, the material against the gate) — those stay open until the
keeper says how it SOUNDED. One report, one session.

**2026-08-19 · best matches · Moments → Alive → FINAL CHAPTER → ROCK 64.**
Keeper: *"'Final Chapter' to 'Rock 64' was an interesting transition visually
… the whole moments→alive→final chapter→rock 64 is hot. Nice mix."* Screenshot
taken for the build video. On the v1 figures that is a 96 → 95 → 95.6 → 96.5
bpm run (every stretch well inside the gate) and 10A → 5A → 7A → 7A in key;
Moments and Alive are both collaborations (Caspro, Waveshaper), FINAL CHAPTER
→ ROCK 64 are album neighbours on DEAD PIXELS in the same key. **[CONFIRMED]**
by ear, on the `build · best matches` build — the first listening report on
that mode, and on FINAL CHAPTER, which LISTENING §2 lists among the
seventeen tracks a 3% cut would play straight (grid error 3.9%); at 9% it is
beatmatched, and it was heard beatmatched and liked. One report, one run.

**2026-08-19 · the phone.** iPhone 16 Pro Max, iOS 26.6: the whole library
scanned on the device and a set PLAYED — keeper: *"OMG THE PHONE PLAYS."* The
first time the deck has run on WebKit. Then, same evening: **audit 86/86
playable, Safari decoding FLAC natively; the lock-screen-audio experiment
FELL** (*"it just keeps repeating a sound"* — keep-screen-on is the answer);
and **popping during playback on the phone**, open. Two more reports from
the same evening, kept as evidence not conclusions: *"the music is properly
stopping and resuming when other events interrupt (alarm, phone call) —
just not on lock screen!"* — iOS's audio-session interruption and Web
Audio's resume behave under the deck, which was never built for and must not
be "fixed"; the lock screen is the one interruption it does not come back
from, which is the WebKit suspension `phone:` is about. And: *"they just
spontaneously dropped off my AirPods … (the music) … might not be related,
but evidence for consideration"* — an output-device change mid-set. On iOS a
route change (Bluetooth dropping) interrupts the audio session; whether the
context resumed or the set died is not yet known. Worth asking next time:
did the set carry on from the phone speaker, or stop? The question that
separates the candidates, unchanged from Act 21: *first track (unstretched)
clean and chained decks popping, or everything popping?* Say which.

**2026-08-19, later · the phone, a direct jump.** Keeper: *"there was no
popping on Lullaby when I jumped straight to it."* **[CONFIRMED]** as the
report; what it means is **[INFERRED]**: a jumped-to deck runs at `rate =
1.0` (play() builds it with `makeDeck(…, 1)`), so this is the "first track /
direct jump is clean" half of §7's discriminator. If the popping they heard
earlier was on a CHAINED deck, the two reports together point at the
stretched path — the worklet under WSOLA on the phone — and not at the
output path or the context. Still needed to close it: the same set, the
chained deck named, popping or not. One thing learned the same evening while
reading WebKit's source for the lock-screen question (BUILD-LOG Act 28):
**`latencyHint` is ignored by WebKit** — `AudioContext::create` carries
`// FIXME: Figure out where latencyHint should go.` and
`MediaSessionManagerCocoa::updateSessionState` pins the hardware buffer to the
128-frame render quantum whenever a Web Audio session exists. So the
`'playback'` hint set on phones as §7's first lever was inert on the device it
was aimed at, and the lighter-stretch-quality lever is the first real one.
Nothing moved; the hint stays because it is harmless and does something on
Android Chrome.

**2026-08-19, later still · the locked phone, `background audio`.** Keeper,
iPhone 16 Pro Max / iOS 26.6, minutes after the mode shipped: *"you
beautiful entity you have made it work. i'll see if it goes over to another
track."* **[CONFIRMED]** — the set kept playing with the screen locked with
`phone: background audio` on; the graph survives `EnteringBackground` on this
iOS exactly as `AudioContext::shouldOverrideBackgroundPlaybackRestriction()`
says it should. **The handover half of §8 is still OPEN** — whether
`chain()`'s timer fires from a hidden page and a NEW title reaches the lock
screen. That is the next word from the keeper. Ledger 60 stays
**[INFERRED]** for the whole claim until then; its first half is heard.

**2026-08-19, later again · lock art under lock, preliminary.** Keeper, on
`lock art`: *"I think the tiles are keeping even while under lock. I can
double check tho."* **[INFERRED]** — read as: the card's art kept changing
with the phone locked, which would be §9's first bullet; the keeper has not
yet confirmed which setting was on (`poster` changing at a handover and
`live` changing every second are different claims) or how long it held.
Waiting on the double-check before anything moves.

**2026-08-19, night · `background + lock controls` — "It works."** Keeper,
minutes after the mode shipped and the page was reloaded on the phone:
*"Wow. That's amazing. It works."* **[CONFIRMED]** as the report, on the
thing just handed over — §10, the lock screen's buttons through the silent
media element — which means WebKit on iOS 26.6 did make the element the Now
Playing session and the card's controls reached the deck. **[INFERRED]**
for the parts three words cannot carry: whether ▶▶ produced a BLEND (§11)
or a cut, whether the scrubber shows the track or 0:30, and whether the
music stayed up through lock with `controls` on (it did with `background`;
the one real failure mode for `controls` was the element interfering, and
"it works" reads as it did not). Ledger 62 and the `controls` mode move to
heard-on-device; the blend itself still wants its own word.

**2026-08-20 · the demo playthrough: "slightest amount of popping".**
Keeper: *"There was just the slightest amount of popping on my last
playthrough. This was with oggs and mp3s using the new demo function…
nearly imperceptible, but I'd like to dig into it."* **[CONFIRMED]** as
the report; everything else about it is open — the device, the build, and
above all WHICH WORKLET was running, because the demo threw away the one
line that says (ledger 69) and the gap counter lived in an unshown log.
The demo set's chained decks sit at ×0.944–×1.03, ledger 65's gapping
band, so plain-worklet gaps FIT — and so would the phone's own render
thread. Not attributed; the instruments are now on the card (see §7) so
the next report arrives with its numbers. What was verified the same
hour, desktop Chromium, real demo path: `held worklet · static module`,
Prelude ×1.0295, 70 s, 0 gaps. The questions that close it: which device,
which worklet does the card/log now name, does a ⚠ appear, and do the
pops land at transitions or mid-track.

**2026-08-19, late · the phone, a CHAINED transition: "limited poppy
static".** Keeper, iPhone, after phrase match shipped: *"there's some
limited poppy static in iphone from DOOMSDAY->GG SISTERS."* **[CONFIRMED]**
as the report: a chained transition (DOOMSDAY 139.95 → THE GREAT GIANA
SISTERS 140.12, so the incoming deck runs at ×1.001 — as close to unstretched
as a chained deck gets) carried sporadic pops on the phone. Which build was
playing is not recorded — ask. Together with *"no popping on Lullaby when I
jumped straight to it"* this is §7's first branch: first/jumped deck clean,
chained deck pops. **What was measured the same hour (BUILD-LOG ledger
65):** the vendored SoundTouch 2.1.1 worklet, driven offline with 128-frame
quanta, inserts a 128-frame ZERO GAP (2.9 ms — a click) whenever its WSOLA
output burst lands one block late against the render cadence: **0 gaps per
150 s at exactly ×1.000, 3 at ×1.0012 (this pair's rate), 2 at ×0.9988, 9 at
×1.05, 3 at ×0.95 — the same counts on a sine and on these two tracks' own
audio, so it is cadence arithmetic, not signal.** Holding ONE extra block in
the worklet's output (2.9 ms of latency on every deck, equal for both, so
alignment is unchanged) gives **0 gaps at every rate over 180 s.** Not
applied. **[INFERRED]** that this is what the keeper heard: one click per
~50 s at ×1.001 fits "limited" and fits a chained deck only; what it does
not explain is why the same gaps were not reported on the desktop after the
2.1.1 upgrade — either they were there and unnoticed in dense chiptune, or
the phone adds its own (WebKit pins the hardware buffer to 128 frames, so a
late render block on the phone is a second, independent source of the same
sound). The discriminator is the worklet's own `underrunCount`, which it
posts every 100 blocks and nothing reads yet: surfaced per deck, it says
whether the pops heard are the gaps counted. Two candidate moves, both
the keeper's call: read the counter onto the log line, and hold the block.

## 7 · The phone pops — which decks?

iPhone 16 Pro Max, iOS 26.6, 2026-08-19. Play a set from the top. **Listen to
the FIRST track alone** (it runs at rate 1.0, nothing stretched) and then to
the first chained track (stretched). Also: the play log line now says e.g.
`1/86 · 44100 Hz · 12 ms buffer` — report those two numbers.

- *First track clean, chained decks pop* → the SoundTouch worklet is starving
  on the phone; `latencyHint: 'playback'` (now on for phones) is the first
  lever, a lighter stretch quality the second. **2026-08-19 late: this is the
  branch the reports point at** (Lullaby clean jumped-to; DOOMSDAY → GIANA
  SISTERS pops chained, at ×1.001). And the lever list above was written
  before the worklet was driven offline: the 2.1.1 pipe itself inserts a
  2.9 ms zero gap a few times a minute at any rate that is not exactly 1.0
  — the hardware is not the only suspect. See "Heard", and ledger 65 for
  the measurement and the one-block hold that removes it offline. The
  question for the next playthrough, **now on the card** (the first
  version of these instruments lived in a log nothing shows — ledger 69 —
  which is why "slightest popping" on the demo arrived without a number):
  RELOAD the page (the worklet is chosen at the first ▶), play anything,
  and look at the now-playing card's meta line. It stays clean when
  everything is right; it says `⚠ plain worklet` if the held module did
  not load, and `⚠ N gaps` if the stretch pipe zero-filled any block since
  ▶. The demo also logs `demo: … · held worklet` when it starts. The four
  outcomes, any build, any material:
  *no ⚠ + no pops* → closed;
  *no ⚠ + pops* → the worklet pipe is clean and the pops are somewhere
  else — the platform's render thread (phone), the material itself, or a
  seam nobody has instrumented; say WHERE they fall (at a transition, or
  mid-track) — that word halves the search;
  *⚠ N gaps + pops* → the hold is not holding on this device, which the
  offline measurement says cannot happen — report N and the stretch %;
  *⚠ plain worklet* → the held module did not load there; say so and the
  loader needs work (it is now a plain same-origin file, so this outcome
  should have retired with the blob).
- *Everything pops, first track too* → not the worklet; the output path or
  the context itself (sample-rate mismatch, main-thread starvation from the
  render loop). Try `phone: off` and `☰ set` (the list screen draws no
  canvases) and say whether it changes.

## 8 · The locked phone — does `background audio` hold?

iPhone, iOS 26.6, any set. `phone: background audio` in the transport
(⚙ display group). The log line should say `navigator.audioSession.type =
playback`; if it says the type did not take or there is no Audio Session
API, stop — nothing will change and there is nothing to hear.

Play a set. Lock the phone **within the first track** and leave it locked
through at least one handover (the first chained deck arrives ≥ 45 s in;
two minutes is plenty). Glance at the lock screen once before the handover
and once after.

- *A NEW title appears on the lock-screen card and the music never stopped*
  → the graph AND the planner survived the lock. `background` is the answer
  on iOS and `keep screen on` becomes the fallback. Say whether the
  handover sounded like the same handover on the desk.
- *The music stops within a few seconds of locking* → this iOS does not
  honour the override (or the type did not take — read the log line).
  `wake` stays the answer; the experiment is recorded as fallen.
- *The current track plays out, then silence or a stutter at the handover*
  → the graph survived and `chain()` did not get to run in time. That is a
  planner-under-throttling problem, not an audio-session one, and it has a
  different fix (schedule further ahead).
- *Also worth one word:* does the lock-screen card show the track name, and
  do its play/pause buttons work? (Next/previous are deliberately absent —
  WebKit does not route them for a Web Audio session.) And: the set now
  plays with the silent switch on — is that wanted?

What this does NOT test: anything about Android (Chrome keeps Web Audio
running in the background on its own, and has no `audioSession`).

## 9 · Lock-screen art — poster, and the 1 Hz experiment

> **CONFIRMED on the iPhone, 2026-08-19, midnight-ish — the experiment
> HOLDS.** Keeper, phone locked on the desk mid-set (the libre set, no
> less): *"the iphone is fucking TIGHT. i just had it on my desk and, of
> course, it locked, but kept playing, threw up the new vis, 1hz at a
> time, i dont care. it's still hella cool."* So: playback through the
> lock (§8's lock half, re-confirmed on a different night and set) AND
> the 1 Hz live artwork updating on the card — the branch of this
> experiment that was never promised, seen working. Still open below:
> which panel reads best at 1 Hz, how long it holds (the two-minute and
> ten-minute marks), and the battery question. "1hz at a time, i dont
> care" is the keeper accepting the cadence — the cadence stays.

Keeper: *"Can we project a visualization to the locked screen?"* A web page
gets one pixel surface on a locked iPhone: the Now Playing card's ARTWORK.
`lock art:` in the transport (⚙ display group), with `phone:` on `background
audio` or `keep screen on` so the card exists at all.

- **`poster · journey`** — one image per track: the set-journey panel plus a
  strip with the track, n/N, bpm, key. Changes at the handover. Checked in
  Chromium on a synthetic set (512×512 PNG, 36 KB, blob URL accepted by
  `MediaMetadata`). *Does the card show it, and does it change when the
  track does?* Two words answer that.
- **`live · …`** — the same image redrawn ONCE A SECOND and re-sent as new
  artwork. This is the experiment. Lock the phone with it on and watch the
  card for two minutes:
  - *the art keeps changing, no flicker, still changing at two minutes* →
    it holds; a 1 Hz slideshow on the lock screen is real. Say which panel
    reads best at that rate (journey / position / camelot move slowly and
    should look like themselves; spectrum will look like stills).
  - *it changes once and freezes* → iOS or WebKit coalesces artwork
    updates; `poster` is the honest setting and `live` comes out of the menu.
  - *it flickers, or the art vanishes* → the re-send is too fast for the
    card; the cadence needs to drop (say so and I slow it).
  - *battery* — a PNG encode a second on a locked phone is not free; if the
    phone is warm after ten minutes, that is a result too.

What this is NOT: a visualisation. Sixty frames a second on a lock screen
is not something a web page gets. One frame a second of a slow panel is the
most that is on the table, and whether it is on the table at all is what
this tests.

## 10 · The lock screen's buttons — `background + lock controls`

iPhone, iOS 26.6. `phone: background + lock controls`. The log line should
say `silent element playing`; if it says *tap anywhere once to start it*,
tap, then read the line again — a media element only starts inside a
gesture. Play a set, lock the phone, and on the card:

- **▶▶** — within a couple of seconds the title should change at a downbeat
  and the music should *blend*, not cut (`next` is a crossfade since
  2026-08-19 — LISTENING §11 below is the ear-test for that on its own).
  If ▶▶ does nothing, WebKit did not make the silent element the session;
  say so and `controls` comes out of the menu.
- **❚❚ / ▶** — the music stops and comes back. (Under plain `background
  audio` these already work; here they go through our handlers.)
- **The scrubber** — should show the track's real length and position. If
  it shows `0:30` looping, `setPositionState` is not being applied; that is
  cosmetic and worth one word, not a failure.
- **The one thing that would be a failure:** the music stopping at lock
  with `controls` on when it did not with `background audio`. That would
  mean the silent element is interfering with the graph, and `controls`
  comes out.

## 11 · `next ▶` blends — does it sound like a blend?

Any device. Mid-track, press `next ▶` (or ▶▶ on the lock screen). What
should happen: nothing for up to one bar, then the next track fades in over
the set's crossfade (16 s default) while this one fades out, beatmatched,
bass swapped. What would falsify it: a cut (instant silence, next from the
top), or the next track starting off the beat. If the 16 s feels long for
something called "next", say so — the fade length is your `xfade` setting
and can be shorter for next alone, but that is one more chosen number and
it is yours to choose.

## 12 · `build · phrase match` — does the transition land on the phrase?

Desktop first, then the phone. Press **`build · phrase match`**, then ▶.
The log line per transition ends `¶3.1→2.4 16s`: the OUTGOING track's
phrase contrast → the INCOMING's, then the fade. `·` in either place means
that side had no usable phrase and took the downbeat path for this
transition. Contrast is the detector's own ratio — 1 means it had no
preference, the library median is 2.3, 4+ is as sure as it gets — printed
so you can pair what you hear with how sure it was. It is comparable to
nothing else and **it is not a threshold**; no cut is applied anywhere.

**What should happen.** The outgoing track leaves at the start of one of
its own 8-bar phrases — the last one its length allows — and the incoming
track's FIRST phrase starts at that same instant, so its bar 1 is under the
outgoing's bar 1, and the fade runs exactly one phrase (32 beats at the
playing tempo: 15 s at 128 bpm, 20 s at 96) so the handover completes on
the next phrase start. The incoming enters at its phrase start rather than
its first beat, which can be up to seven bars into the file — if a track
seems to "come in late" compared with the other builds, that is this, and
it is intended.

**What would falsify it.** The incoming's section change (bass in, lead
in, the drop) landing mid-phrase of the outgoing — i.e. two or four bars
off — on a transition marked ¶ with both contrasts above 3. One such, on
regular tracks, and the whole-track offset is wrong at the END of the
track (BUILD-LOG Act 29 says why that can happen), and the fix is a local
offset over the last phrases, not a threshold. If it only happens on
transitions where one contrast is under 1.5, that is the detector saying
"guess" and being right about it.

**The A/B that costs nothing.** The walk you already confirmed — Moments →
Alive → FINAL CHAPTER → ROCK 64 — is the same four tracks in the same
order under `best matches` and under `phrase match`; only the exits, the
entries and the fade length differ. Their contrasts: Moments 1.6, Alive
2.5, FINAL CHAPTER 2.4, ROCK 64 1.3 — a middling case, which is the honest
first test.

**The strong pair.** WALKMAN (128.1, contrast 4.6, halves agree) into
BROKEN STAR (128.0, contrast 4.3, halves agree): no stretch, both grids
regular, both offsets as certain as the scan has. Click BROKEN STAR while
WALKMAN plays — a blend-now in phrase mode waits for WALKMAN's next phrase
start, so expect up to eight bars of nothing, then the blend. If THIS
transition does not sound phrase-aligned, the detector is wrong on its
best material and the method needs rethinking, not tuning.

**The weak pair.** TONIGHT (123.8, contrast 1.09 — the lowest in the
library) into LET'S PLAY (129.8, contrast 1.18): both are the detector
admitting it cannot tell. Whether these sound WORSE than the same pair
under `best matches` is the question — if they do not, a low-contrast
offset is harmless and can stay; if they do, the honest move is to fall
back to the downbeat path below some contrast, and that number is yours.

**`next ▶` on this build** waits for the next phrase start — up to eight
bars, ~15 s at 128 — then blends over one phrase. On the other two builds
it is still the next downbeat (≤ 1 bar) over your xfade. *"It can
probably replace the default 'next' activity though, if it's tight"*: you
decide whether the wait reads as tight or as stuck. If tight, one line
makes it the default everywhere; if stuck, a shorter phrase unit (4 bars)
for `next` alone is a second chosen number and yours to choose.

**On the phone:** the first play of each track costs one pass over its
audio on the main thread (190 ms for a 150 s mono track in a Chromium
background tab; unmeasured on iOS) — once, then it is in the cache. If a
transition in phrase mode pops where the same one under `best matches`
does not, say so; nothing about the audio path changed, so that would be
the detection stall landing somewhere it should not.

## 13 · `⊕ libre` — music you do not own, through the same engine

**Built 2026-08-19 late, seen playing in Chromium, UNHEARD** (BUILD-LOG
Act 30). Press **`⊕ libre`**, leave the preset on `chiptune`, search
nothing or an artist, pick a release, `+ add` lists its tracks with sizes,
the button becomes `fetch N · X MB` — press it. The tracks come in like
any file (analysis runs once; after that they are in the cache like
everything else), then `build` and ▶ as usual. The card shows `☉ creator ·
licence` on a fetched track; the log's handover line ends with the same.

**Start here:** `geekcore006` — Iwu, *Sabor limon EP*, CC BY-NC-SA 3.0,
six Ogg tracks, 14 MB. `build set · all tracks` placed all six (four
beatmatched, two straight by reach); `best matches` kept three. Known to
decode, analyse and play; never heard.

**The three questions, in order:**

1. **Does a fetched track sound right on its own through the worklet?**
   Jump straight to one (rate 1.0) and then let it be chained (stretched).
   This is the Ogg derivative at ~128 kbps against the FLACs you know — if
   it sounds thin or swimmy, switch the `ogg` select to `flac` (≈55 MB a
   track from the Archive, the uploader's original) and fetch the same
   release again; same names, so the analysis is reused and only the bytes
   change. If FLAC is fine and Ogg is not, the default moves to MP3 or
   FLAC and that is your call, not a measurement.
2. **Does a blend between two fetched tracks hold?** En el bus → Asteroides
   is the first pair the sequencer chose (×0.971, 9B → 8B). If it is fine
   and a blend between a FETCHED and a LOCAL track is not, the difference is
   level — the Archive's uploads are not mastered to one loudness, which is
   ROADMAP "Competitive gaps" #2 arriving early.
3. **Is the material any good for this?** `subject:chiptune` on the Archive
   runs from NES covers to noise, and every threshold here was tuned on one
   catalogue. Watch the `best matches` count against the `all tracks`
   count per release: a release where best keeps almost nothing is the
   gate saying the grids are not trusted, which is information about the
   source, not a fault to tune away. **First datum, keeper, 2026-08-19:
   30 of 39 fetched LukHash tracks kept by `best matches`** (three albums,
   one Digital Memories edition ⊖'d) — ~77%, against ~95% on the local
   library at the same gate (162 of 171 beatmatched, the 2026-08-18
   measurement: 9 straight, 5 untrusted grid + 4 out of reach). So the
   Archive's derivatives of the SAME artist gate noticeably worse than
   the FLACs — small corpora also reach less (fewer stepping stones), so
   this is not yet evidence about the audio itself. The 9 left out and their reasons are in the build
   log line (untrusted grid vs out of reach) — worth a glance, not yet
   recorded. **[CONFIRMED]** the count, by the keeper's screen.

**What would falsify the build (not the ear):** a fetched track that
plays, then on reload is re-fetched AND re-analysed — the cache key is
the Archive's size and mtime and a re-analysis means one of them moved; a
`✓ N added` where the score's step shows `source: null`; a `-nd` release
that does not say `no-derivatives` in the list.

**Second gate datum, same night:** the keeper's mixed ogg+mp3 fetch —
**29 of 39 kept, and the split is 2 untrusted grid / 8 out of reach.**
Mostly reach: the small-corpus caveat above was the right one, and only
2 grids of 39 are distrusted across two lossy formats. The material
question now leans toward "the Archive's LukHash derivatives grid fine;
a 39-track corpus just cannot reach everything."

**The demo (2026-08-19, latest): `▶ demo` — Stand Alone stands alone.**
One press on a machine with NO library: the opening track of the shipped
score (`assets/demo-set.json`, the keeper's own first libre set) is
fetched, analysed and PLAYS while the other eight arrive in set order;
the transport is held until the set is home, then the full phrase-mode
set takes over mid-track. UNHEARD as a demo; the open questions are
whether the play that follows a ~15 s fetch is inside the browser's
autoplay grace (Chromium likely, WebKit likely NOT — the phone demo may
need ▶ pressed once), and whether analysis keeps pace on a phone. Also
quietly the DETERMINISM experiment: a fresh machine re-analyses the same
bytes and rebuilds from the same score — if its transitions land where
this one's did, that is the first cross-platform evidence for the claim
the score format has always hedged.

**Added the same night, after "it worked":** the **♪ lukhash** button —
his own licensed releases via the creator field (four: Dead Pixels,
Digital Memories ×2 editions, The Other Side; all `-nd`/`-nc-sa`, flagged);
the podcasts that merely play him don't appear. And the card's `☉ creator ·
licence` now LINKS OUT to the archive.org page serving the music — the
panel rows already had `page ↗`. Note the LukHash uploads are Ogg/MP3 of
albums you own as FLAC: fetching them makes sense on a machine WITHOUT the
library (the phone, a friend's laptop), and the two copies carry different
names so the dedupe may not fold them — that is expected, not a bug.

**Known trap (ledger 68):** the Archive holds Digital Memories under TWO
items (ShMusic and PandaCD editions, both in the ♪ lukhash results) and
fetching both doubles every song — the editions' track names never match
(`01-Prelude` vs `LukHash - Prelude`) so the set builder cannot fold them.
The ⊖ on each release row removes its tracks from the corpus (analysis
cache and fetched bytes are kept); rebuild after.

**The phone layout is BUILT and UNSEEN on a phone** (keeper: *"the iPhone
interface is difficult to use. Once I open the libre panel it is too big
and also I can't get it to go away"* — the no-wrap header pushed ✕ off
the screen and the sheet covered the ⊕ toggle). Now: on screens ≤ 700 px
the panel is a bottom sheet capped at 55vh with finger-sized controls, the
header wraps with ✕ pinned top-right, and **a tap anywhere outside the
sheet closes it** — the ⊕ button and ✕ still work as before, desktop
unchanged. The close logic is verified in Chromium (open, outside-tap
close, reopen, ✕, desktop unaffected); how the sheet LOOKS on the iPhone
is yours — if 55vh is still too tall over the set list, say so, it is one
number and it is a taste call, not a calibration.

**What is not built:** FMA and Jamendo (both CORS-open, both need an API
key — yours to create if the Archive runs thin); Mod Archive (tracker
modules, a decoder away). Nothing here moved a threshold.


## 14 · Android — does a call pause the set?

**Built 2026-08-21, the day of the first Android run, after your report:**
*"The music needs to interrupt during a phone call received … By default
anyway. This can be an option."* One received call answers it.

**Why it happened:** Android grants audio focus to media ELEMENTS; a bare
Web Audio graph holds none, so the OS had nothing to pause when the phone
rang. (iOS never showed this — WebKit interrupts the AudioContext itself,
and you heard alarm and call both stop and resume the set correctly.)

**What is built:** `calls` in DWPHONE, ON by default — the silent 30 s
loop from `background + lock controls` now also plays on Android as the
page's audio-focus holder. Chrome pauses that element when a call takes
focus and resumes it at hang-up; those two events pause and resume the
deck. The toggle is `call pauses the set: on/off` behind ⚙. The proxy
starts inside the ▶ tap; if you started music some other way, one tap
anywhere arms it.

**What to do:** play a set on the Android phone, have someone call you,
let it ring a few seconds, hang up.

**The outcomes:**

- **Music pauses at the ring and resumes at hang-up** — the chain held.
  Say so and the row flips to [CONFIRMED].
- **Music pauses but does not come back** — Android treated the loss as
  permanent, not transient. Tell me; resume-by-hand (▶) still works and
  the finding is about which focus type Chrome requested.
- **Music plays straight through** — read `DWPHONE.status` in the console
  (or just report): `silentElement: 'paused'`/`'none'` means the proxy
  never started (gesture rules — did you tap after ▶?); `'playing'` means
  Android never granted focus to a silent-sample element, and the fallback
  is routing the mix through the `media` element so the audible element
  holds focus. Either way the report discriminates.
- **Bonus, no call needed:** while a set plays, the Android notification
  shade should show a media card naming the current track. Whether it does
  is one glance and worth a word.


## 15 · The popout — one click, one glance

**Built 2026-08-21 (BUILD-LOG Act 33) and MACHINE-CONFIRMED the same
night by driving the browser:** a real click opened the window, the panel
animated (304→382 frames/0.7 s), the hidden-main-page sample() path ran
live (the popup took the foreground and every frame sampled), and party
rendered 101 WebGL frames from 100 presets with zero errors. What remains
is the half only eyes answer: how it LOOKS.

**What to do:** ⚙ → `⇱ popout` → pick a panel. A window should open
drawing that panel full-size with a title strip naming the playing track.
Then: background the DASHBOARD tab — the popout should keep animating
(it samples the loop itself when your page is hidden). Then pick
`party · milkdrop` while a set plays.

**The outcomes:**

- Panel window opens and animates, keeps animating with the dashboard tab
  hidden → the projector works; drag it to the TV and F11.
- Window opens but freezes when the dashboard tab is hidden →
  `DWPOPOUT.status.sampled` in the console: 0 means the hidden-page
  sampling path never engaged — report the number.
- `party` shows moving Milkdrop visuals in sync → the vendored butterchurn
  runs; presets rotate every 30 s, click the window to skip.
- `party` shows a black window with music playing → `DWPOPOUT.status.err`
  says whether WebGL2 or a preset refused — report the sentence.
- Nothing opens at all → the log line will say `popup blocked`; allow
  popups for the page and choose again.

The party layer is decoration by design — it lives in the popout so the
dashboard stays instruments-only. If it ever reads as more fun than the
panels, that is a finding about the panels, not a reason to move it in.


## 16 · Injected events — does "faster" feel faster?

**Built 2026-08-21 (BUILD-LOG Act 34), machine-verified, unheard.** The
console (or Claude, mid-walkthrough) can now steer the set:
`DWEVENTS.inject("I need something fast")` — vocabulary: faster · slower
· hype · calmer · change · duck · unduck. Selection reuses the stretch
gate and the fast router; nothing new decides anything musical.

**What to do, while any set plays:**

1. `DWEVENTS.inject('faster')` in the console. The log prints what it
   chose (an in-gate blend, or a fast route with its ladder). The ear's
   question: within the next transition or two, does the floor move UP?
2. `inject('calmer')` — same question downward, on the energy axis
   (remember energy is the constructed index; if "calmer" picks something
   you would not call calm, that is a finding about the INDEX, worth its
   own row).
3. While music plays, `inject('duck')`, speak a sentence, `inject('unduck')`.
   Is 0.3× deep enough to talk over, shallow enough to still feel scored?
   That number is yours — one word changes it.

**The outcomes:** "faster felt faster" confirms the translation; "it
blended somewhere weird" — read `DWEVENTS.status.last` (it carries the
decision: target, axis, blend vs route) and report it verbatim; "the
duck is too deep / too shallow" — say a depth, DUCK is one constant.

## 17 - The voice — CONFIRMED 2026-08-22, and now tunable

**"Okay. That worked."** The page spoke over the set, ducked and
restored - in-page synthesis coexists with the graph. Two refinements
followed the same hour: the duck was "too much" (0.3x), so speech now
has its OWN depth - default 0.55x, per-record override, live-tunable
from the feed via a voiceCfg record - and the voice has a character
("Scarlett meets GLaDOS"): pitch 0.85, a calm female English voice by
preference list, name-matchable per device. Honest limit: synthesis
cannot be routed through the graph, so true vocoding is out of reach -
voice choice + pitch is the ceiling. CORRECTED SAME NIGHT (ledger 74): on iOS the system ducks around
synthesis regardless - our depth stacks on that floor and 1.0x leaves
pure OS duck, unremovable. STILL OPEN: which named voice this
iPhone resolves (say what it sounds like and I tune), and the right duck
number - both are one report each.

**Built 2026-08-22, plumbing machine-verified, the ear's half open.** The
keeper's ask: "play Claude responses without losing the music." The OS
readers all fight the audio session (Reader interrupts - ledger 73;
Spoken Content ducks a fixed amount; VoiceOver reads the whole screen).
So the page speaks for itself now: DWEVENTS.speak(text) uses the
browser's own speech synthesis - same audio session as the deck, OUR duck
(0.3x, restored exactly when the voice ends, never stealing a manual
duck). RECON records carry "speak":true (title+note) or "speak":"exact
words", gated on the console's `voice` toggle, off by default.

**What to do:** open RECON on the phone (or desktop), tap `voice` ONCE
(that real tap is what arms speech - a scripted tap measured
`not-allowed` in automation, which also proved the error path restores
the volume), then feed a record with a speak field - or have the agent
narrate.

**Outcomes:** (a) the sentence speaks, music ducks under it and returns -
the walkthrough voice works, and reading Claude aloud costs nothing;
(b) speech plays but the MUSIC stops - iOS treats in-page synthesis as an
interruption after all, ledger row it; (c) silence - the arming tap did
not take on WebKit, say so. Voice quality is a bonus question: iOS voices
vary wildly by what is downloaded (Settings > Accessibility > Spoken
Content > Voices).

## 18 - The vocal gate — built 2026-08-22, UNHEARD

**The ask, verbatim:** "if speech is being injected, fast blend away from
a vocal-having song." No detector exists (the analysis is vocal-blind -
ledger 76), so the gate is a keeper's-EAR list checked at speech time:
DROWNING seeds it, plus the sung covers. A listed now-playing track gets
the same 'change' fast blend the intent bus already uses; the voice
holds until the deck moves (15 s cap), then speaks over the incoming.

**What to do:** with voice on, let a voice record land while DROWNING
(or any listed track) is playing. The feed row grows a marker naming the
blend-away.

**Outcomes:** (a) the set blends away, then the voice speaks over the
incoming - the gate works; note whether the outgoing fade tail still
carries vocals under the first words (the cap and the fade are not
synchronized - honest, not hidden). (b) The voice speaks over the
vocals anyway - either the track was not listed (add it:
{"vocals":{"add":["name"]}} on the feed) or the gate did not fire; say
which track. (c) The set skips but the voice never comes - the 15 s cap
failed, ledger it. **Growing the list is the keeper's ear working as
designed** - every "that one sings" is one feed line.

## 19 - The voice audition: Piper vs Zira, and 109 community registers

**Built 2026-08-23, UNHEARD.** Combines what was two open questions: take9
(is Piper the narrator?) and the community-voice drop-in the keeper asked
for. One sitting answers both, because they are the same A/B with more
rows.

**MEASURED 2026-08-23, and it re-shapes the audition: `en_GB-vctk-medium`
phonemises ALL 109 speakers as British RP.** The keeper asked whether the
twelve were all British options. The model's own metadata answers it, and
the answer is in two halves that pull opposite ways:

- **The voices are mixed-accent.** VCTK is Edinburgh's corpus of 109 native
  English speakers *with various accents* - English regional, Scottish,
  Irish, American, Canadian and more. Spot-confirmed: p239 (speaker 0) is
  22F, Southwest England; p228 (speaker 90) is 22F, Southern England.
- **The pronunciation is not.** Every `.onnx.json` names its espeak front
  end, and vctk's is **`en-gb-x-rp`** - British Received Pronunciation -
  against **`en-us`** for the American models (`amy`, `hfc_female`,
  `lessac`) and generic `en` for `kristin`/`ljspeech`. Read straight off
  the files, not inferred.

So a VCTK speaker is that person's timbre saying **RP-phonemised text**: a
hybrid, and structurally NOT the American register the locked brief asks
for (*"Scarlett meets GLaDOS"* - Johansson in *Her*, McLain as GLaDOS,
both American). That is a claim about the FRONT END, checkable in one
`grep`; it is **not** a claim about how any take sounds, which nobody has
heard yet and which no amount of metadata can settle.

**THE ACCENT MAP, 2026-08-23 - the corpus table, not a guess.** The
keeper asked to audition the Canadians, which needs the real
`speaker-info.txt`. It ships only inside `VCTK-Corpus-0.92.zip`
(**11.7 GB**), so it was pulled with HTTP range requests: DataShare's
bitstream endpoint answers `Accept-Ranges: bytes`, the member turned out
to be the FIRST entry in the archive, and its local file header carries
name, method and compressed size inline - **4,028 bytes recovered out of
11.7 GB, no download.** The technique is worth keeping (`zip` indexes are
readable remotely; the central directory at the tail is the general case
when a member is not near the front).

What the table says the 109 modelled speakers are:

| accent | n | | accent | n |
|---|---|---|---|---|
| English | 33 | | NorthernIrish | 6 |
| American | 22 | | SouthAfrican | 4 |
| Scottish | 19 | | Indian | 3 |
| Irish | 9 | | Australian | 2 |
| **Canadian** | **8** | | Welsh / NZ / British / Unknown | 1 each |

**The eight Canadians, all present in the model:**

| `--speaker` | VCTK | | age | region |
|---|---|---|---|---|
| 36 | p317 | F | 23 | Hamilton |
| 47 | p316 | M | 20 | Alberta |
| 49 | p307 | F | 23 | Ontario |
| 50 | p363 | M | 22 | Toronto |
| 53 | p312 | F | 19 | Hamilton |
| 83 | p343 | F | 27 | Alberta |
| 99 | p303 | F | 24 | Toronto |
| 105 | p302 | M | 20 | Montreal |

Five female, three male. **Speaker 50 was already in the first
twelve-take spread**, so a Canadian was auditioned before anyone knew it
was one. Rendered as `speech/ca-p3NN.wav`, each take naming its own city
so a row is identifiable by ear without reading the screen; eight distinct
md5s. **Still RP-phonemised** - the front-end finding above applies to
these exactly as to the rest, and a Canadian speaker over RP phonemes is
the closest thing this model holds to the North American register without
leaving it. Whether that hybrid reads as Canadian, as British, or as
neither is precisely what nobody can tell from metadata.

The full corpus table is kept at `speech/vctk-speaker-info.txt`
(gitignored, CC-BY-4.0, CSTR Edinburgh) for the next time a register
question needs an answer instead of an opinion.

**Hence a second card, the US register:** `us-amy` · `us-kristin` ·
`us-hfc_female` · `us-ljspeech`, same words, same 1.15 pace, `en-us`
phonemes. Verified distinct (four md5s; `hfc_female` and `ljspeech`
coincide in byte size only because both run 6.79 s). Both cards are on the
feed - press across them.

**And the GLaDOS half was never the model's job.** That half is the
*chain* - the detuned double, the band, the slap at room 0.3 - already
built, already locked, engine-independent. What the model supplies is the
register underneath it.

### 19.1 - Speaker 99, treated: the register ladder - **SETTLED BY EAR**

**CONFIRMED 2026-08-23.** The keeper picked **speaker 99 (p303, F, 24,
Toronto)** out of the Canadian card - *"the great one"* - asked for it to
be coloured, auditioned all four grades, and ruled: **"g2-p303 will
work."** So `facility` (formant 0.88 · ring 0.18 @ 62 Hz · drive 0.15) is
**CANON for the console voice**, and it joins gain 1.62 and room 0.3 on
the list of numbers nobody moves by reasoning.

**And the honest part, keeper's own words:** *"it doesn't sound like
GLaDOS anyway, and that's okay."* Correct, and worth keeping as a finding
rather than a disappointment - the reference was a tuning target, not a
specification, and what came out is **its own register**. That is also
why the tool is `tools/register.py` and the chain's fx value is
`facility`: the honesty label *"the register, not the person"* was always
the accurate description, so the identifiers now say so. Naming an
influence in prose is fair comment; naming a **file** after someone
else's trademark is borrowing their word to describe our work, and the
keeper called it before it shipped. Launch is tomorrow.

`tools/register.py` is the tool, and what it deliberately does NOT do is
the point.

**The composition rule: bake only what Web Audio has no node for.** The
console's facility chain already applies the band, the x1.007 detuned
double and the 55 ms slap, and **those numbers are locked by the keeper's
ear**. Reproducing them offline would double-process and quietly
re-litigate a settled calibration. So the offline stage adds exactly two
things the browser cannot do:

- **Formant shift** - moves the spectral envelope *without moving pitch*.
  This is the one that turns a particular young woman into a machine that
  sounds like her, and no `playbackRate` can do it: `warp` moves pitch AND
  speed together, which is why warp is labelled honestly in the console.
  Cepstral method - the log-magnitude spectrum is split into a smooth
  envelope (low quefrency) and the harmonic fine structure; only the
  envelope is resampled; the frame resynthesises on its original phase.
  **Phase is not re-estimated, so heavy shifts smear transients** - which
  is why the presets stop at 0.82.
- **Ring modulation** - the metallic shimmer, depth kept small on purpose.
  Past about 0.35 it stops reading as a processed voice and starts reading
  as a Dalek.

**A treated take is meant to be played THROUGH the facility chain, not
instead of it.** The two compose; neither duplicates the other.

**The ladder**, all on `say-p303.wav` (an original line in the register -
not lifted from Valve's script, which would make the take a quotation
instead of an audition):

| row | grade | formant | ring | drive |
|---|---|---|---|---|
| `say-p303` | `plain` | 1.00 | - | - |
| `g1-p303` | `near` | 0.94 | 0.10 @ 48 Hz | - |
| **`g2-p303`** | **`facility`** | **0.88** | **0.18 @ 62 Hz** | **0.15** |
| `g3-p303` | `deep` | 0.82 | 0.28 @ 76 Hz | 0.30 |

**`facility` is the keeper's pick.** Reproduce it exactly with
`python tools/register.py --in speech/say-p303.wav --out X.wav --preset
facility` - verified bit-identical to the approved take across the rename
(three matching md5s, named and numeric forms both). The `g` filenames
predate the naming decision and are runtime artefacts; the recipe is the
canon, not the filename.

**Verified, not assumed.** Preset 0 is a near-identity through the whole
STFT round trip (max abs error **0.00101**, rms 0.000183) - so any change
heard on 1-3 is the effect and not the transform. Spectral centroid falls
monotonically **1394 → 1297 → 1294 → 1253 Hz**, durations identical to
the sample (the shift does not touch speed), peaks 0.911-1.000 so nothing
clips. **The metric's own limit, said out loud: g1 and g2 are 3 Hz apart
because drive adds harmonics that push the centroid back up while the
formant drop pulls it down.** A single number cannot rank these; the ear
can, which is the whole reason they are rendered rather than argued about.

**What to try beside the ladder:** `warp` is still the pitch lever and is
untouched here - `{"voiceCfg":{"warp":0.92}}` on the feed drops pitch and
speed together under any of the four. Whether GLaDOS wants warp as well as
formant, or formant instead of warp, is an ear question with no defensible
paper answer.

**What is on disk** (all in `speech/`, which is gitignored - these are
runtime artefacts, they do not travel with a branch):

- `take9-piper.wav` - Piper, `en_US-lessac-high`, length-scale 1.15, no
  warp. The candidate, single American voice.
- `vctk-000..108.wav` - twelve takes from `en_GB-vctk-medium`, an even
  spread across its **109 speakers**, same pace, same words, each take
  naming its own number. RP phonemes - see the measurement above.
- `us-amy.wav` · `us-kristin.wav` · `us-hfc_female.wav` ·
  `us-ljspeech.wav` - the American register, `en-us` phonemes.
- `ca-p302 · p303 · p307 · p312 · p316 · p317 · p343 · p363` - all eight
  Canadians, RP phonemes, cities named in the take.
- Takes 1-8 are Zira, the incumbent, already on the feed.

**How to run it.** Append `speech/voice-card.jsonl` to `recon.jsonl` **while
the console is CLOSED**, then boot. The quiet-boot gate renders backlog
rows without playing them (Act 36), and every sayfile row is pressable
(ledger 77) - so twelve voices arrive as twelve **▶ take** buttons and you
choose the order. **Do not append them live**: twelve sayfile records inside
one 2 s poll window is the seance, which is a video shot, not an audition.

**What the answer changes, and this is the part that matters.** The locked
voice numbers - **gain 1.62 · room 0.3 · duck 0.55 · the facility chain** -
were locked by the keeper's ear **for Zira** (`evidence/voice-pipeline-2026-08-23.md`
is the canon). A new engine is a new register, so if any Piper voice wins,
**those numbers are re-opened and the ear re-rules them** - not adjusted by
reasoning, and not assumed to carry over. Expect to re-tune the chain on the
winner before judging it against Zira properly; a voice can lose an A/B
purely for being run through another voice's settings.

**The one thing Piper cannot do**, repeated so nobody tunes blind: it has
**no pitch parameter**. Zira's recipe is rate -15% *and pitch -8%*; Piper's
`--length-scale 1.15` covers only the pace. The pitch half lives in the
browser as `voiceCfg {"warp": 0.92}`, which lowers pitch **and** speed
together - honest, not equivalent. None of the takes above have warp
applied, so judge them dry first, then try warp on the winner.

**Outcomes.** (a) A vctk speaker wins - name the number, and the next
download is the rest of that neighbourhood (109 are one `--speaker` flag
away; `python tools/speak.py --list` shows the count). (b) Piper lessac
wins - the narrator becomes platform-independent, which was the whole point
of Act 37. (c) Zira still wins - Piper stays as the cross-platform fallback
and nothing moves. Any outcome is a result; (c) is not a failure.

## Standing

**If popping through a mix returns on other material, say so and D5 reopens.**
It is currently closed as a misattribution on one report and one pair of
tracks, which is thin evidence for a conclusion that large.

## 20 - The instrument column on RECON — built 2026-08-28, machine-verified, UNLOOKED-AT

**The numbers are already checked.** This one is not like the rest of this
file: the column was driven live (Act 38) and every figure in it was
cross-checked against the engine computed independently — playing tempo
against `bpm × DW.deck.rate`, the harmonic move against a separate
`DW.camScore` call, the incoming against `DW.nextDeck.name`, and the ribbon's
playhead measured out of the canvas pixels twice, four seconds apart, against
a position predicted from `pulse()`. It agrees to within 0.6% of the canvas
width. **So the question here is not "is it right" — it is "is it any use".**

**What to do:** run any real set with the deck folded away, and just work
with the console up. One glance at the right-hand column and the strip along
the bottom.

**The four things worth reporting, in order:**

1. **Does it tell you anything the header strip did not?** The strip already
   gives track, bpm and a downbeat blink. The column adds the incoming track,
   the harmonic move, the crossfade actually running, where you are in the
   set, and the worklet's gap count. If none of that earns its 300 px, say
   so — it comes back out.
2. **The Camelot wheel at 238 px.** Twenty-four labelled sectors is a lot for
   that size. Legible, or a decoration that should become four large
   characters saying `9A → 10A`?
3. **The ribbon.** Straight tracks are ringed on the tempo line, and the
   energy arc carries no numbers by rule. Does the shape read as the *arc*
   the sequencer was aiming at, or as noise? This is the first time the
   energy index has been drawn across a whole set anywhere but the deck's own
   panel.
4. **`⚠ plain worklet` / `N gaps` is now on the console too** — which means
   the standing popping question (§7, ledgers 65/69, still the first item on
   the BASE list) can be answered from this screen without unfolding the
   deck. If you are running RECON at all, that glance is free.

**What it deliberately will not do:** the ribbon does not seek. A real set
cannot be scrubbed, and a click into the play order would be a second path
beside DWEVENTS — the shape of ledger 40. If you find yourself trying to
click it, that is worth reporting as a want; it is not a bug.

**One path is written and has never fired:** `LIST ≠ DECK` on the ribbon
hint, for when `set.indexOf(DW.nowMeta)` and `state.idx` disagree. Forcing a
disagreement means manufacturing one, so it was left unexercised —
**[INFERRED]** from the code alone. If it ever appears on screen during a
real set, that is the route panel's standing check firing on a second screen,
and it is a finding, not a glitch.

## 21 - The console as it was originally meant — built 2026-08-28, UNRUN

**Not a listening test; a session test.** §20 asked whether the instrument
column earns its space. This asks the bigger one the stage finally makes
askable: **does the whole thing work as the original idea — an agent walking
you through the web, with frames, narration and a soundtrack that turns with
it.** Every part now exists and no session has used them together.

**What to do:** one real walkthrough. Ask for something you actually want
looked up, with `narrate` on and the voice toggle armed. Per page the agent
sends one record carrying `shot`, `url`, `title`, a `note` in its words, a
`status`, the outbound links, `speak` for the narration, and an `event` when
the mood should turn.

**The five things worth reporting:**

1. **Does the stage make it feel like watching, or like reading a log with a
   picture attached?** That is the whole question. If it is the second, the
   gap is probably frame *rate* — one still per page may be too few to read
   as motion, and the honest fix is more frames, not a faster-looking one.
2. **Does the staleness line do its job or nag?** It goes to `— the agent
   may be somewhere else` after ninety seconds. If the agent is slow that
   may be most of the session, and the threshold is a **chosen number** with
   no measurement behind it. If it reads as noise, say so and it moves.
3. **Narration against frames.** §17 settled the voice by ear on its own.
   Whether a voice-over lands *with* the frame it describes — the record
   carries both, so they arrive together, but the words take seconds and the
   picture is instant — is unheard.
4. **Does the music turning still land** when there is something to look at?
   §16's injected events were judged with nothing on screen.
5. **Reading the note versus hearing it.** The note is on the stage and in
   the row and in the voice. Three copies of the same sentence may be one
   too many; which one you actually use is the answer.

**Three things already came back from it, before any session ran**, all the
same shape — a control that does nothing and does not say so. The fold was a
door that opened once (ledger 83); `▣ view` was a dead click while folded
(84, which also grew the `‹ n/N ›` stepper the keeper actually asked for);
and `↻ again` was unarmed after every reload and reported that to the console
(85). **If anything else here can be pressed to no effect, that is the same
class and worth one line** — it is the cheapest kind of finding to report and
the most expensive to discover late.

**What it will not do, by design** — worth knowing before you report a bug:
it shows one still at a time, it never follows a link, and it sees nothing
by itself. Every frame came from the agent choosing to send it. If the
session feels like the agent is hiding something, it is not the screen
withholding it — nobody sent it.

## 22 - The voice card and the mixer — built 2026-08-28, UNHEARD

**What was built (keeper's ask, mid-set: "a card for the persona speaking
that shows a voicewave" + separate tuning "rather than rely on the
ducking").** A card above the feed that appears while the persona speaks:
for a RENDERED TAKE it draws a real waveform — an analyser inside the
take's own chain, its actual samples — plus the register line (facility /
dry · warp · gain). For the OS voice there is NO wave, and the card says
why on screen: speechSynthesis never enters the deck graph, there is
nothing to tap, and a drawn wave would be fake. And a mixer strip in the
header: `voice` (the takes' real 0–200% gain, moved LIVE on a playing
take, mirrored up to 100% into the OS voice through `configureSpeech`)
and `duck` (music left under the OS voice), beside the eleven dial which
stays the music's fader. The faders initialize from the stores — the
locked 1.62 · 0.3 canon does not move until a hand moves it.

**What to do:** play a take (a ▶ take row, or ↻ again). One glance, one
listen, three questions:

1. **Does the wave read as the voice?** It is the take's own samples
   post-warp, post-facility — speech through the slap delay should look
   like speech with a tail, not like a scope idling.
2. **Do the faders feel like a mixer?** Set the music where you want it
   on the eleven dial, the voice where you want it on `voice`, mid-take —
   the take should move under your finger with no zipper noise worth
   reporting (it is a plain gain.value write; if it clicks, say so and
   it becomes a setTargetAtTime).
3. **Is the card's linger right?** It holds ~1.2 s after the voice ends.
   Too abrupt or too clingy is one word of report.

**Also in reach now:** ledger 100 — replace a take mid-play with the
facility chain on (press a second ▶ take while one is talking). Before
today the detuned double of the first take kept talking underneath; one
listen confirms both voices stop.

**What each answer changes:** the wave earning its 44 px keeps the card;
a useless wave shrinks the card to the text line. The faders working by
hand is the answer to "users may want to tune this themselves" — if they
do, the README's extension paragraph gets one sentence saying so. The
OS-voice half of the `voice` fader is capped at 100% and iOS ignores it
entirely (ledger 75) — that is the platform, already said on the tooltip.

## 23 - The two tunes — built 2026-08-29, the standard one UNHEARD

**The one that changes what you hear, and the reason it is a select and
not a fix.** The cloud review found that this deck's minor-key wheel
numbers each minor key by its PARALLEL major (A minor sits at 11A beside
A major) where the standard Camelot chart uses the RELATIVE major
(A minor at 8A beside C major). Uniformly three steps off. So the 0.85
"same number, other letter" bonus has always been paid to parallel
pairs, and true relative pairs have always scored 0.08, the clash floor.

**Every set this deck has played was built on that wheel** — including
Moments to Alive to FINAL CHAPTER to ROCK 64, which you called hot. That
is why it is still the default and why nothing was swapped: `deckwave
tune` is checked, `standard camelot` is one select away in ⚙.

**Before you spend an evening on it, the size of the thing, measured:**
the offset is uniform, so it cancels within a mode. Minor-to-minor and
major-to-major transitions score IDENTICALLY under both tunes. Only
major-minor pairs change — and the library is 196 minor to 23 major, so
**18.8% of possible pairs** — and measured on the real records, only
**3.2% of pairs actually get a different score**, because most cross-mode
pairs are unrelated under either wheel. Most transitions you hear will be
the same either way. Do not expect a different album; expect a different handful
of moments.

**What to do:** build a set, note it, then ⚙ → `tune: standard camelot`
and **build again** (the log says how many keys restamped; the play
order only changes at the next build). The same seed, the same length,
the two orders side by side.

1. **Do the sets differ at all?** With 23 major tracks in 189, a short
   set may not contain a single cross-mode move. If the two orders are
   identical, that is a real answer and the fastest one: the tune does
   not matter on this library, and the default stands on evidence.
2. **Where they differ, which handover is better?** This is the whole
   question and only the ear can answer it. The standard wheel will put
   a major track next to its relative minor (C major into A minor) where
   the deckwave tune would have refused it as a clash, and will refuse
   the parallel move (C major into C minor) it used to allow.
3. **Does anything sound WORSE?** The deckwave tune is not obviously
   wrong as a musical idea — parallel keys share a tonic, and a tonic is
   a strong thing to share. It was an accident, but it may be a good
   one, and 190-odd sets have been built on it without complaint.

**What each answer changes:** identical sets means the select stays as
documentation and nothing else. Standard sounding better means the
default flips and the deckwave tune stays as a named option for the
sets already saved against it. Deckwave sounding better — or no
audible difference on the pairs that do change — means the accident
becomes a choice, said out loud, and that is a more interesting
sentence in the README than "we fixed a bug."

**A caution about the scores you have saved — checked, not assumed.**
`load()` restores the play order by name match and puts the stretch and
classification back; it never re-runs `camScore`. So an old score
reloads and replays exactly as it did, whichever tune is selected — the
tune only affects the NEXT build. Nothing you have saved is at risk.
The one honest wrinkle: a score also STORES each step's camelot label as
it was at save time (and the `.cue` prints it as `REM ... KEY`), so a
file written under one tune carries that tune's notation forever. The
music is identical; the letters beside it are a record of which wheel
was on.

## 24 - The status line's countdown — fixed 2026-08-29, ONE GLANCE

**You found this one on screen yourself:** *"there is some stale text,
'blending in 1.5s …' … the text that persists after I choose a new set
target."* It was true — the line took the sentence the deck returned at
the moment you clicked and never went back to it. A second and a half
later it was false; after the handover it named a blend that had already
happened; after a second choice, one that never would.

It is not a listening test. It is a **glance**, and it costs nothing:
it happens on any transition you were going to make anyway.

**What to do:** with a set playing, open a track's menu in the list and
choose **blend now**. Watch the log line at the bottom of the transport.

**What it should do now:** count — `blending in 3.2s`, `2.1s`, `0.4s`,
off the deck's own scheduled exit — and then, at the handover, stop
being a countdown at all and read **`blended into <track>`**. No number
in it, because a number in that line is what went stale.

**The three things worth catching:**

1. **Does the number reach zero and resolve**, or does it stall part-way
   down? A stall means the line is reading a schedule the deck is no
   longer keeping — worth saying, it would be a real finding about
   `DW.blend`, not about the text.
2. **Choose a second target while the first is still counting.** The new
   message must own the line immediately. If the old countdown keeps
   overwriting it, the cancel path is wrong.
3. **`next ▶` says `blending in 1.2s over 16s ¶ · …`** — the `over 16s`
   is the crossfade length and must NOT count down with the other
   number. If both move, the wrong half is being rewritten.

Machine-driven only so far: nine checks in `check-panels` run the real
code against a fake deck (arm, tick, land, replace, cancel), which is
why this is [INFERRED] and not confirmed. Nothing in the Player changed
— a returned string was right when it was made; it was the display that
kept it past its moment.

## 25 - The review release, 0.8.1 — built 2026-09-03, NONE OF IT HEARD OR SEEN

Every fix of the launch-day review (`docs/REVIEW-2026-09-01.md`, BUILD-LOG
Act 41, ledgers 122–131) is pinned by a harness and seen by nobody. Most
of them have no ear-level question at all — a licence name parsed by host,
a size cap, a tail-read feed — and are listed nowhere here. These are the
ones with a discriminating glance or listen, cheapest first:

1. **A jumped-to deck (ledger 82, closed on five surfaces).** Jump straight
   to any row past the first with `▶` on the list. What to look at: the
   header, the card, the route footer, the transition monitor and RECON's
   instrument column. **They should all read `∿ jumped` / `∿ first` and
   NOTHING that looks like a stretch figure** — no `+0.00%`, no `×1.000`,
   no `PHASE LOCKED`. One `0.0%` anywhere is a sixth surface.
2. **A negated instruction.** From the console or RECON's tray:
   `DWEVENTS.inject("don't speed up")`. It should do NOTHING to the music
   and answer with a sentence naming what it read. Before 0.8.1 it blended
   to a faster track. Then `inject("speed up")` should still steer — that
   is the control.
3. **The popped-out panel's slot.** `⇱ popout` the polygraph. The
   dashboard slot should say *in the projector window*, and the paper in
   the projector should scroll at the same speed as a second polygraph in
   another slot. If it scrolls at double speed, ledger 127's fix did not
   take.
4. **The energy window after a hidden page.** Hide the tab for a minute
   mid-set, come back. The level area and the staircase should show a
   BREAK across the minute, not a straight line joining the ends.
5. **A stuck voice.** Background the tab mid-take on Chrome (its `onend`
   often never fires there). The music should come back on its own within
   roughly the take's length plus a few seconds — the chosen guard.
   If it stays ducked until you type `unduck`, the guard did not fire.
6. **The take card across a hot swap.** Play a `sayfile`, feed
   `{"reload":true,"ts":…}` mid-take. The card should stay up with a live
   wave while the voice finishes. If it hides under an audible voice, ledger
   129's re-adoption is wrong [INFERRED].
7. **The phone, two glances.** In `controls`: pause the set, read the
   lock screen — it should say paused, not playing. Let a set END — the
   Now Playing card should go away (the focus loop stops). Both
   [INFERRED], machine-pinned.
8. **An interrupted `--lan` download.** Kill the phone's download of the
   library zip at 90% and retry. If the browser resumes rather than
   restarting, Range support works on a real device; if it restarts from
   zero, that is a finding, not a failure of the server (the browser may
   not ask).
9. **The keeper's-call A/B (ledger 126).** On any track the pool marks
   grid-unlocked (the list shows it played straight), compare the exit the
   SET plans (leaves on the clock) with pressing `next ▶` (snaps to the
   distrusted downbeat). Which one lands? Whichever wins becomes the policy
   at both sites; nothing here moves until the ear says.

What would falsify each is stated inline; what none of them can answer is
whether any of it was worth doing, which is the same answer LISTENING has
always given about a fix nobody has heard.
