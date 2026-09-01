# Game music, supply and demand — comprehensive pass, 2026-08-21

Keeper: *"Do another comprehensive prior art search. And also look around
to see if any game developers have asked for this problem to be solved."*
This deepens `prior-art-intent-steered-soundtrack-2026-08-21.md` with the
game-integration surface included (DWEVENTS inject + pulse,
GAME-INTEGRATION.md), and adds the demand side. Ten searches: five web
sweeps, four GitHub queries, one product read.

## Supply — the field, five shelves

**1. Games that eat the player's own music (the direct lineage).** A real
genre, twenty years deep: Audiosurf / Audiosurf 2 (track layout and speed
from your song), Beat Hazard ("gameplay powered by your music"), Vib
Ribbon (1999, the ancestor), Beats (PSP 2007, beat-tracking on your
files), Crypt of the NecroDancer (your MP3s, beat-locked gameplay),
TERRORHYTHM (uploads an MP3, analyses in real time), and **Riff Racer —
Race Your Music!** (Foam, 2016): racetracks BUILT from the songs in your
library, verses and choruses becoming checkpoints — servers closed and
delisted 2022. Every one of these built its analysis in-house, per game,
and several are dead. The capability keeps being rebuilt and keeps dying
with its game — **there is no shared engine for it. That absence is the
finding.**

**2. Middleware for authored music.** Koreographer (Unity, paid,
established — pre-analysed "koreography" per track, explicitly avoids
realtime processing), RhythmTool (Unity, paid — realtime BPM/beat
detection of arbitrary songs; the closest tool-shaped thing to Deckwave's
analysis layer, single-track, no mixing), Elias (stem-based adaptive),
Reactional (licensed-catalogue rule engine — the funded productisation,
covered in the intent doc). None DJ-mixes finished tracks; none is open.

**3. Engines answered demand natively.** Godot merged **interactive music
support in 4.3** (PR #64488, by the project lead — AudioStreamInteractive
/ Playlist / Synchronized, "functionality typically reserved for Wwise/
FMOD"), preceded by proposals like #3963 (audio quantisation). Unreal
built **Quartz**, a sample-accurate beat clock subsystem, and MetaSounds.
Engine maintainers do not build music-sync primitives nobody asked for —
this is the strongest demand evidence there is.

**4. Generative-reactive, and the injected-intent precedent.** Infinite
Album: AI music reacting to game events — hooked via **Overwolf event
feeds, no game-dev partnership needed** (an integration pattern worth
remembering), DMCA-safe by construction for streamers, and **Twitch
viewers steer the music with bits and channel points** — genre, tone,
instrumentation. Audience-injected intent is SHIPPING; Deckwave's
inject() has a commercial cousin.

**5. Open web/game libraries (GitHub).** orchestre-js (22★ — adaptive
web music, authored layers), rhythm_notifier (63★, MIT, Godot beat-event
addon), godot-conductor (27★, MIT). All either authored-music direction
or beat-callbacks against a KNOWN bpm. Nothing analyses arbitrary user
files, nothing mixes, nothing is a DJ.

## Demand — have developers asked?

Yes, at four levels, though never in Deckwave's exact words:

- **Engine level:** the Godot proposals and the 4.3 merge; Unreal
  building Quartz; devs asking how to wire it (SPRAWL etc.). The ask is
  "music that syncs to my game" — answered for authored music only.
- **Market level:** Koreographer and RhythmTool sustain themselves as
  PAID Unity assets; Reactional raised on the licensed version of the
  idea; Infinite Album raised on the streamer version. People pay.
- **Player level:** the shelf-1 genre exists because players keep asking
  for their own music in games — NecroDancer's custom-music mode is one
  of its most-loved features.
- **The unasked question:** nobody found phrases it as "a reusable
  engine that DJ-mixes the player's finished library as an adaptive
  soundtrack" — because each game that wanted it built a bespoke one and
  took it to the grave (Riff Racer, Beats, Audiosurf's engine). The
  demand shows up as serial reinvention, not as a feature request.

## What this changes for Deckwave

Positioning confirmed and sharpened: **the unoccupied square is
"shelf 1 as middleware"** — the thing Audiosurf/Riff Racer/NecroDancer
each built privately, offered as an open, embeddable engine (browser
today), with two verbs the field already understands: inject (Infinite
Album's viewers do it) and pulse (Quartz/Koreographer's whole reason to
exist). The README line and GAME-INTEGRATION.md say exactly this now.
Nothing found weakens any novelty claim; nothing found was borrowable.
The Overwolf event-feed pattern is the one idea worth remembering for
later (game events without game-dev buy-in).

**Side-find:** Riff Racer — racetracks generated from your own songs,
found on Steam, delisted 2022 — is the strongest candidate yet for the
keeper's half-remembered "music visualizer that visualized an actual
race track" (see visualizer-field-notes; it was a game, not a GitHub
repo, which is why the repo search failed).

## Limits

Ten searches, titles-and-README depth. Unity Asset Store and itch were
sampled through search, not crawled; closed middleware (CRI ADX2,
proprietary studio tech) unaudited; no claim-level patent reading beyond
the families already listed (Weav, beat-sync, Harmonix's stem-mixing).

## Sources

Slant/HowToGeek/TheGamer user-music game roundups; steamdb/delistedgames
(Riff Racer); koreographer.com; Unity Asset Store (RhythmTool);
godotengine/godot#64488, godot-proposals#3963, blips.fm on Godot 4.3;
Epic docs/community on Quartz; musically.com and crunchbase (Infinite
Album); GitHub repos as named. Read 2026-08-21.
