# Prior art: intent-steered soundtrack / live-directed auto-DJ — 2026-08-21

Asked by the keeper alongside building DWEVENTS ("run prior art search for
this system while you're at it … include github searches so we don't
re-invent the wheel"). The system in question: a narrator injects events
("I need something fast", "slow it down", duck-for-voice) into a playing,
beatmatched set of the user's own library, and the deck answers through
its existing gate and router — built as `assets/deckwave-events.js` the
same day (BUILD-LOG Act 34).

## Verdict, one paragraph

The CONCEPT — a soundtrack that takes direction — is heavily precedented
at every layer, some of it thirty years deep. The specific MECHANISM —
intent verbs resolved against a stretch-gate over unmodified library
tracks, answered with an in-gate blend or a committed fast route,
mid-set, live — was not found anywhere, on GitHub or off it. Same class
as every other Deckwave verdict: **novel integration, not novel
invention.** No new patentable claim is intended or implied; one live
patent family joins the FTO watch list (Weav, below).

## The layers, each with its precedent

**1. Adaptive game music (the deep ancestry).** LucasArts iMUSE (1991)
made game scores respond to events with in-tempo transitions; Microsoft
DirectMusic productised the idea in the 90s (an open re-implementation
lives at GothicKit/dmusic, 62★); FMOD and Wwise made "vertical remixing /
horizontal resequencing" the industry's standard vocabulary. All of it
directs AUTHORED, stem-based material. Deckwave directs finished recorded
tracks with DJ transitions — different material, same verb.

**2. Activity-adaptive tempo.** Spotify Running (2015, retired) matched
playlist tempo to running cadence. Weav Music (Lars Rasmussen) re-authors
tracks to play at 60–240 bpm following the runner — and holds a LIVE US
patent family, **"Adaptive music playback system": US9595932, US10229661,
US11145284, US11854520**. Their claims sit on multi-version/stem-adaptive
playback matched to user activity — not on beatmatched transitions
between unmodified tracks — but this family belongs on the same FTO list
as the beat-sync-mix family in the main prior-art doc. Endel is the
generative cousin.

**3. Intent-steered commercial DJ (the interface precedent).** Spotify's
AI DJ took VOICE REQUESTS from May 2025 (beta, Premium, 60+ markets):
genre/mood/artist/activity asks mid-session ("electronic beats for a
midday run"), plus a "change the vibe" tap. That is exactly DWEVENTS'
interface shape — say what the moment needs, mid-set. The difference is
everything below the interface: a recommender over a streaming catalogue,
no beatmatching, no user-owned library, no gate, no inspectable route.

**4. GitHub (the wheels-not-reinvented pass).** Searched `ai dj mix`,
`adaptive soundtrack`, `mood dj control`, `music intent control tempo`:

- **kckDeepak/AI-DJ-Mixing-System** (MIT, 32★ — already cited in the main
  prior-art doc for its JSON logs). Natural language over local MP3s —
  but confirmed **OFFLINE**: GPT-4o selects, librosa analyses, one
  `mix.mp3` renders. The prompt happens before the music; nothing is
  steered while it plays. The nearest neighbour, and still on the other
  side of the live/offline line.
- **GothicKit/dmusic** — DirectMusic re-implementation (layer 1's code).
- **johh/notator** (3★) — "reactive/adaptive soundtracks for the web";
  authored-material direction, browser flavour.
- **VenIQ** (2★) — camera watches the crowd, estimates energy, suggests
  to the DJ: SENSED intent rather than stated intent. An idea worth
  remembering (the goniometer wall already faces the room), not code.
- Mood-DJ toys (facial-emotion → Spotify) — recommender steering again.

Nothing found injects live intent into a beatmatched set of local files.
Nothing found was worth borrowing: the hard parts DWEVENTS needs (gate,
router, blend, ducking ramp) already existed in-repo, and the intent
layer itself is ~200 lines of translation.

**5. Ducking under narration.** Broadcast auto-ducking is a decades-old
commodity (radio automation, sidechain compression). Zero novelty; none
claimed; DWEVENTS' duck is a volume ramp with an exact restore.

## Honest limits

Search budget: four GitHub queries, two web sweeps, one repo read.
Closed commercial systems (Algoriddim, VirtualDJ event APIs, radio
automation suites) were not audited and one of them may steer a
beatmatched engine by intent internally. The Weav claims were read at
title/abstract level, not claim-by-claim — before any commercialisation,
counsel reads them properly (same recommendation as the main doc's #3).

## Sources

Spotify AI DJ requests: musictech.com, musicbusinessworldwide.com,
techcrunch.com (2025-05-13). Weav: patents US9595932/10229661/11145284/
11854520 (USPTO), weav press 2020. iMUSE/DirectMusic: audiocipher.com,
GothicKit/dmusic. GitHub finds: as named, read 2026-08-21.

## Addendum, same session — "has anyone actually created it as a thing video games can use to run their soundtracks?"

Yes. **Reactional Music** (Swedish, Gestrument lineage, live now) is exactly
that as middleware: a rule-based music engine for Unity/Unreal (Godot
coming, integrates beside Wwise/FMOD) where in-game events drive the
soundtrack live, "in pitch and time", note-by-note — including
**rights-cleared commercial tracks** from ~50 partnered music companies
with one-click licensing. That is the commercial productisation of this
act's whole idea: events in, music answers, real songs included. Closed,
proprietary, tied to its licensing marketplace.

Two adjacent proofs: **Harmonix's FUSER** (2020) shipped runtime
beatmatched, key-matched mixing of commercial tracks inside a game — as
gameplay, on prepared stems, in-house tech (Harmonix went to Epic in
2021); and **Elias** is the stem-based adaptive-middleware cousin.

What none of them are: open, browser-based, or pointed at the USER'S OWN
unmodified library — Reactional's tracks come through its pipeline and
its licensing deals; Fuser's came as authored stems. Deckwave's corner
(AGPL, local files, DJ transitions, inspectable gate and score) remains
unoccupied. But the keeper's instinct is confirmed: the category exists,
it is funded, and it is the strongest single precedent in this file.

## Second addendum, same session — "so is it something we can offer to game designers?"

Honest shape of it, three days before launch:

**The pitch that is true:** web and HTML5 game developers (itch.io, browser
games, Electron) could embed Deckwave today as a "bring your own
soundtrack" engine — the PLAYER'S library, beatmatched, steered by game
events through DWEVENTS (`inject('hype')` on the boss, `duck` for
dialogue, same-origin postMessage as the integration surface). That is
the corner Reactional structurally cannot serve: their value is the
licensing marketplace, so player-owned music is against their model, and
Fuser needed authored stems. Player-owned soundtracks have gameplay
precedent (Audiosurf built a genre on it).

**The frictions, all real:** (1) **AGPL** — Essentia forces it, and game
studios are broadly allergic; a commercial Essentia licence is the known
cost (the monetisation research already prices this class of problem).
(2) **Browser-only** — Unity/Unreal are native; only web-target games
embed it without a port. (3) **First-run analysis cost** — minutes on a
big library before the first note. (4) The events vocabulary is seven
verbs; a game wants parameters (intensity curves, stingers, sync marks) —
real work, not a blocker.

**Recommendation:** do not move launch for it. Ship 2026-08-24 as
planned; add ONE positioning line to the README ("web game developers:
DWEVENTS is the integration surface — your players' own libraries as
adaptive soundtracks") and let the launch test whether designers bite.
If they do, the roadmap items are an events API v2 (parameters, not just
verbs) and the Essentia licensing question — in that order.
