# Deckwave

**Version 0.8.2 · public from 2026-09-01; 0.8.1 the review release and 0.8.2 its boot fix, both 2026-09-03** — August 32nd, eight bars of four: a date that exists only in music.

Analyse your whole local music library in the browser, build a beat-locked harmonically-mixed DJ set from it, and save the mix as data rather than audio.

![The Deckwave dashboard mid-set: waveform and bass onsets across the top, then the route, VU meters, Camelot wheel, goniometer, transition monitor and pitch classes, with the polygraph, spectrum, timeline, scope, centre/side and set journey below. The right rail is the set — 90 tracks, STARGAZE playing into DROWNING.](docs/deckwave-dashboard-2026-08-21.png)

*A real set, mid-transition, 2026-08-21. The transition monitor reads `PHASE LOCKED · periods match`; the status line reads `1/90 · 44100 Hz · 10 ms buffer · held worklet`. Nothing here is a mockup and nothing is a placeholder — every panel is drawing the audio that is playing.*

Nothing is uploaded. Files are read through a folder you pick, analysed locally, and the audio buffers are discarded immediately. The only things that persist are a few hundred bytes of features per track, in your own browser's storage.

**Best on Chromium — desktop and Android 132+; runs on Firefox, Safari and iOS.** Chromium has the File System Access API, so one folder pick walks a whole tree (Chrome for Android has it from 132). Everywhere else the folder and the tracks come in through `<input type="file">` — whole folders on desktop Firefox/Safari, iOS 18.4+ and Firefox Android 142+; individual tracks (multi-select from the system picker) on older mobile browsers. FLAC that the browser's own decoder refuses is decoded by the vendored libflac instead. One thing does not exist outside Chromium: tab/system audio capture (listen mode) on phones. **Measured 2026-08-19 on an iPhone 16 Pro Max (iOS 26.6): a 189-track library analysed on the device, including an eight-and-a-half-minute track, and a set played.** A phone layout (two panels per screen, a `☰ set` screen, the log line first), an installable manifest, a `phone:` option that keeps the screen awake (confirmed on the iPhone) or asks WebKit to treat the page as a music player (`navigator.audioSession.type = 'playback'` — what WebKit's source keys on to keep a Web Audio graph running at lock; **heard on the device 2026-08-19: the set kept playing through the lock**, with working ▶▶/◀◀/❚❚ and the track on the lock-screen card in the `background + lock controls` mode), and a `serve.py --music` root to get a library onto the phone in one zip are all there; what is and is not heard on a phone is in `docs/LISTENING.md`.

---

## What it does

**Analyses a corpus.** One folder pick walks the whole tree. Each track is decoded, measured **whole** with Essentia.js for tempo, beat grid, key and confidence, and the buffer released. (Through 0.5.0 only a 120-second excerpt was measured, and the grid it produced was stored as if absolute — so anything past two minutes had no beats at all.) Results cache to IndexedDB, so a rescan after adding music only pays for the new files. 364 tracks fit comfortably.

**Sequences a set.** A rolling tempo target drifts toward each incoming track rather than holding one global BPM, with a hard gate refusing anything needing more than 8% time-stretch. Candidates are scored on Camelot key compatibility, tempo proximity, and distance from an energy arc. (Two wheels ship, and the default is not the standard one: **deckwave tune** numbers a minor key with its *parallel* major, the standard chart uses its *relative* major. That began as a mistake, found in review on 2026-08-29 — but every set this deck has played and every by-ear confirmation in `docs/LISTENING.md` was built on it, so it stays the default and standard Camelot is one select away in ⚙. The difference reaches only major↔minor pairs — 18.8% of ordered pairs on the developer's library, and only 3.2% of pairs actually score differently, because most cross-mode pairs are unrelated under either wheel. Which sounds better is `LISTENING.md` §23, and it is open.) Three builds: **all tracks** — nothing is discarded; a track the gate cannot reach, or whose beat grid disagrees with its own tempo label, is played *straight* (its own speed, a plain crossfade, no claim of a beatmatch) and the set carries on — or **best matches**, which keeps only what can be beatmatched from where the set is and ends when the gate is exhausted, saying what it left out — or **phrase match**, the same list with every transition moved to an 8-bar boundary (read the limit below before you trust it).

**Plays it beat-locked.** Each deck runs through a SoundTouch AudioWorklet that matches tempo without changing pitch. Crossfades land on detected downbeats with a three-band bass swap, so only one kick sounds at a time. Tracks decode one ahead and release behind — memory stays flat regardless of set length.

**Shows you what's happening.** Oscilloscope, log-spaced spectrum, chromagram pitch wheel, dual-ring Camelot wheel with the harmonic path drawn, spectral-flux bass onsets, goniometer with phase correlation, VU meters with real 300ms ballistics, and the whole set's energy and tempo arc with a playhead.

**Saves the mix as a score.** ~26KB of JSON describes a 197-minute set: every entry point, tempo multiplier, exit downbeat, crossfade and EQ timing, plus an engine block naming the detector and stretcher. Load it back and the identical set rebuilds. A standard `.cue` comes with it.

**Listens to other things.** Point it at another tab via `getDisplayMedia` and every visual works on Spotify, YouTube, anything — no analysis or mixing, but the instrument runs. (Desktop only; no phone browser exposes tab audio.)

**Fetches music if you have none.** `⊕ libre` searches the **Internet Archive** (4,040 licensed releases under the chiptune subjects) and **Wikimedia Commons**, and a fetched track goes through the same `DW.ingest` as a local file — same analysis, same gate, same set. The licence filter is in the query, so an unlicensed item is never offered; the creator and licence ride on the record, print on the now-playing card, and land in the `.cue` as `REM ATTRIBUTION`. Ogg by default (~4 MB a track), MP3 or FLAC one select away, cached in the browser, download percentage on screen. The **▶ demo** button builds a set from nothing at all. (Ogg/Opus does not decode on WebKit — an iPhone will refuse some Commons material.)

**Goes on a second screen.** `⇱ popout` puts any panel in its own projector window with its own render loop, plus a `party · milkdrop` mode on the vendored butterchurn. And `extensions/` is the pattern for building a screen on top of the deck — same origin, two public verbs, zero core changes; `extensions/recon/` is the worked example: an ops console where an agent's activity feed is the screen and Deckwave is the soundtrack behind it, with a **stage** for the frame the agent was looking at, an instrument column reading the deck, a voice card that draws the narrator's real waveform (rendered takes only — the OS voice has no tap, and the card says so) beside per-hand faders for music, voice and duck, and a beat clock the whole thing breathes on. Records arrive as JSON lines appended to a file. **The console sees nothing by itself** — it never screenshots, scrapes or navigates; a frame is a still that something else chose to hand it, labelled with its age and told to admit when it is old.

`extensions/citywalk/` is the second worked example, and it exists to make one point: **its rain is real bits of real text, not decoration.** Every falling glyph is a bit of the encoded corpus, and when the corpus is missing the screen draws nothing and says so rather than inventing glyphs — the older console rain picked each character from a hash of position and time, which looks like data and is not, and that is the exact failure this project spends its days catching. It walks any containment tree (a building and its floors, a filesystem, a document outline), driven by two append-only files in its own directory. Same posture as the console: it reaches nowhere, holds no write-capable call, turns nothing into a link, and a click on a place only queues a request for something outside to act on — the page itself cannot move.

**Takes direction, like a game soundtrack.** `DWEVENTS.inject('I need something fast')` — seven intents (faster · slower · hype · calmer · change · duck · unduck) steer the playing set through the same gate and router as everything else, and `DWEVENTS.pulse()` hands back the beat clock (position, beat phase, bar, playing tempo) so visuals — or a game — can land on it. **Web game developers: this is the integration surface.** Your players' own libraries as adaptive soundtracks; `examples/soundtrack.html` is the whole embed in ~100 lines and `docs/GAME-INTEGRATION.md` is the guide. Built for the original use: music that follows an agent walking someone through the web.

**Is honest about what it has not heard.** Every chosen number in the engine is documented as chosen, every measured one as measured, and `docs/LISTENING.md` lists what is built and unheard, with what each answer would change. The build log's failure ledger — 120 rows — is the content, not the appendix.

**Licence.** AGPL-3.0, because Essentia.js is; see `NOTICE`. Every third-party library is vendored and pinned in `vendor/` with its licence and hash. **The page makes exactly one kind of off-origin request and only when you ask for it:** `⊕ libre` and the ▶ demo fetch freely-licensed audio from the Internet Archive and Wikimedia Commons. Nothing else leaves the machine, and your own music never does under any circumstance.

---

## Hear it now

**<https://deckwave.fm>** — the whole engine, no clone and no server. Press **▶ demo** and it fetches a
CC-licensed set from the Internet Archive and mixes it live, creator and licence on the card.

Two honest notes before you click. **The demo is about 100 MB** — nine tracks, 8–21 MB each. The first
one starts the set and the rest arrive underneath it, so the music begins quickly, but this is a
broadband demo and not a kind one to a phone data plan. And **the hosted copy cannot read your own
library the way the local one can**: `serve.py --music` (the one-zip handover that gets a library onto
a phone) and `--lan` are local-server features with no static equivalent. Everything else is identical
— the analysis, the sequencer, the decks, the worklet and `⊕ libre` all run client-side.

`extensions/recon/` loads on the hosted copy and says so honestly, but its feed is `recon.jsonl`, a
local file bus that is never published, so it will sit at "waiting on recon.jsonl" forever. Run it
locally to see it work.

## Quick start

```bash
python tools/serve.py          # http://localhost:8777 — Chromium gets the folder walk
python tools/serve.py --lan    # HTTPS on 8443 for a phone on the same network (cert outside the repo)
python tools/serve.py --lan --music "C:/Music"   # also serve that folder read-only at /music/ — tap "download all" on the phone
```

Then **scan** (pick the folder), **build set · all tracks**, **build · best matches** or **build · phrase match**, **▶ play**. Everything else is one click away in the transport; the glossary explains every panel and figure on hover.

From the console, the same thing:

```js
await DW.scan(console.log)      // pick a folder, walks the tree, caches
DW.confidence()                 // how much to trust the tempo figures
const set = DW.build({ length: 120 })
DW.inspect(set)                 // READ THIS before playing
await DW.openLibrary()          // re-resolve files for playback
await DW.play(set)
DW.stop()                       // reaches scheduled sources, not just current
```

---

## Read the numbers honestly

`inspect()` returns the figures that decide whether a set is worth playing. **`maxStretchPct` above 15 will audibly wobble** — that is perceptual, not taste. **`keyWeak`** counts clashing transitions.

**Confidence is on Essentia's scale (0–5.32)**, where 1.5–3.5 is moderately confident. It is not comparable to any other detector's number.

**Energy is a constructed index** — 45% loudness, 25% brightness, 30% tempo, normalised across the corpus. It correlates with perceived energy. It is not a measurement, and the weights were chosen rather than fitted.

**When the sequencer returns fewer tracks than asked for, that is the gate working** — though since 0.7.0 it should be rare. A track the stretch gate cannot reach is played straight rather than dropped: its own speed, no stretch, and no claim of a beatmatch. The set marks those, and `inspect()` counts them separately. **A track played straight is not a worse track**; it is one we are not pretending to beatmatch.

---

## Theming

Every colour, font, radius, glow and scanline is a CSS custom property whose *fallback* is the default look. A host page overrides what it likes without forking:

```css
deckwave-app {
  --dw-color-bg: #faf8f3;
  --dw-color-accent: #2a2118;
  --dw-glow: 0;                /* kills the neon */
  --dw-scanline-opacity: 0;    /* kills the CRT */
}
```

Ten presets ship in `themes/themes.css`. Structural elements expose `part=` for `::part()` overrides.

---

## Known limits, all real

- **Harnesses need the library for two of their checks.** `node tools/check-*.js` runs fourteen offline harnesses (992 checks — pool 50, route 21, player 80, panels 196, phone 76, phrase 48, libre 109, flac 13, popout 27, events 64, recon 137, citywalk 58, serve 67, loop 46); **Run them from the repo root** — they resolve paths against the working directory, so `cd tools && node check-route.js` throws a raw `ENOENT` stack. Ten of the fourteen need nothing but `node`; `check-serve` also needs `python`, because it starts the real `tools/serve.py` on a free port and asks it over a socket. The other three look for the developer's library at `C:/Claude/Music/LukHash` (override with `DECKWAVE_LIB`) and **each reports one failure without it, on purpose.** `check-pool.js` and `check-route.js` fall back to every cached record rather than the chiptune corpus, still run every check on that fallback so the output is informative, and fail the one check that says the corpus is the one under test. `check-flac.js` reports `1 FAILED of 2 checks`, because its last check asserts that at least two files were really decoded — a guard against the harness passing while testing nothing. Without a library those guards are doing their job, so on a fresh clone with no music, expect ten green harnesses and those three red. It is not a defect in the code under test.
- **Chromium is the full experience, including Chrome for Android 132+.** Elsewhere: no folder walk (files/folders via `<input type=file>`, which on iOS below 18.4 and Chrome Android below 132 means tracks not folders); no tab/system listen mode on any phone (no `getDisplayMedia` on iOS or Android — mic works); on iOS a locked set does not auto-resume after an interruption (an alarm dismissed from the lock screen leaves the page hidden — the lock card's play button restarts it; unlocked, it resumes on its own); Apple Watch controls do not work at all (our title reaches the Watch, the commands do not come back — a watchOS routing limit with no web-side lever, ledger 80); and whether the whole-track analysis of a long FLAC fits in an iOS tab is **unmeasured** — the analyser now releases the decoded buffer before the WASM pass, which is the structural part, but nobody has run it on an iPhone.
- **Phrase alignment exists and is an estimate.** `build · phrase match` leaves the outgoing track at its last 8-bar phrase start, enters the incoming at its first, and fades exactly one phrase — but the 8-bar offset is found by least within-phrase variance over a whole track, and **half-split agreement across the library is 13.8% against 12.5% chance.** Real arrangements shift mid-track. It beats a bar-shuffle null on 96% of tracks and it is not a phrase *detector*; the contrast figure printed beside every transition is a ratio of that detector's own sums, comparable to nothing, and no threshold is applied to it. The other two builds land on downbeats as before. **Nobody has heard the difference yet** — `docs/LISTENING.md` §12.
- **No downbeat detection.** Every fourth beat is assumed — fine for 4/4 electronic music, wrong elsewhere.
- **Beat detection on chiptune is unstudied.** No published accuracy figures exist for square-wave percussion. Low confidence there is expected.
- **Thresholds were tuned against one artist's catalogue.** They may be wrong for other genres and are untested on live drums or variable tempo.
- **Cross-browser determinism of the score is untested.**
- **Long offline renders may exhaust memory.** `OfflineAudioContext` allocates the whole output up front.

---

## Licence and dependencies

Deckwave is **AGPL-3.0**, because Essentia.js is AGPL-3.0 and this is a combined work.

| Dependency | Licence |
|---|---|
| [Essentia.js](https://github.com/MTG/essentia.js) (MTG–UPF) | AGPL-3.0 — also available commercially |
| [SoundTouchJS AudioWorklet](https://github.com/cutterbl/SoundTouchJS) | MPL-2.0 in current versions — **pin your version** |
| [libflac.js](https://github.com/mmig/libflac.js) | MIT |
| libFLAC (Xiph) | BSD-style |
| [butterchurn](https://github.com/jberg/butterchurn) 2.6.7 | MIT — loaded lazily by the popout's party mode only |
| [butterchurn-presets](https://github.com/jberg/butterchurn-presets) 2.4.7 | MIT per its repository — same lazy load; the presets' lineage is stated in `NOTICE` |

See `NOTICE`.

## Influences

The visual vocabulary follows **Strudel** (strudel.cc) — scope, spectrum, punchcard, pitchwheel — which is the JavaScript descendant of **TidalCycles** by Alex McLean. Independent implementations built on the Web Audio AnalyserNode; no Strudel code is used or copied. Pointed there by **Switch Angel**'s live-coding work.

VU ballistics follow ANSI C16.5-1942 (300ms to 99% deflection). The goniometer is the classic Lissajous stereo display. The general debt is to **Winamp**, AVS and Milkdrop, and the era when a music player was something you reskinned.

Analysis is **Essentia** (Music Technology Group, Universitat Pompeu Fabra).

## Playing your own music

Files are read locally from a folder you choose. Nothing is uploaded, bundled or fetched. Playing music you own, on your machine, needs no permission.

Rendering a mix to a file is the same act. **Sharing that file is not** — it contains the full recordings. That decision is yours.

---

See `docs/BUILD-LOG.md` for how this was built, failures included.
