# Visualizer field notes — 2026-08-21

Prompted by the keeper finding CRAWNiiK/browser-visualizer-v1 (assessed in
the prior-art doc's Addendum 2026-08-21) and moonwave99/music-ui, plus a
half-remembered "music visualizer that visualized an actual race track."
Question asked: *are these showing anything interesting that we are not,
and are the licences compatible so we can borrow?*

## Licence ground rule (settles "can we borrow" once)

Deckwave publishes as **AGPL-3.0** (LAUNCH.md, forced by Essentia). Into an
AGPL work: **MIT/BSD code flows in freely** (keep the notice), **AGPL code
flows in natively**, GPL-2.0-only does not, and **no licence at all means
no borrowing**. Everything below is marked accordingly. The no-build rule
adds its own gate: anything borrowed must vendor as plain pinned JS.

## The two named repos

**CRAWNiiK/browser-visualizer-v1 "Soundwave" — MIT ✓ borrowable.**
Frame-reactive canvas scenes off a two-envelope onset detector (full
technical read in the prior-art addendum). Showing anything we are not?
Two things, honestly:

1. **A popout window** — the visuals in a separate movable browser window.
   Deckwave's panels live inside the dashboard; the only second surface we
   have is the lock-screen art. A popout "projector view" (panels on a TV
   or projector while the dashboard stays on the laptop) is a real party
   feature and a small build: `window.open` + the existing DWLOOP bundle.
   The IDEA is the borrow; none of their code is needed.
2. One-shot beat-triggered effects (shockwave/flash on onset) — decorative.
   Deckwave's panels are deliberately instruments, not effects; if a
   "party layer" is ever wanted, butterchurn (below) is the stronger take.

**moonwave99/music-ui — MIT ✓ (full licence text embedded in the README;
no separate LICENSE file, still a valid grant).** A different domain:
SYMBOLIC music UI — ABC notation rendering, a piano keyboard, a player
that syncs them. TypeScript monorepo, active (created 2026-07-31).
Showing anything we are not? Yes — note-level display — but it runs on
note DATA, which Deckwave does not extract, and "the chromagram is NOT a
piano roll" is one of our load-bearing honesty claims. Borrowing a piano
roll without a transcription detector would fake precision we do not
have. Verdict: nothing to borrow that our claims permit. (Their README
also bans LLM-generated *contributions* — irrelevant to MIT use of their
code, relevant only if we ever send them a PR.)

## The race-track visualizer — NOT FOUND, candidates recorded

Searched GitHub (repo search, curated lists, topic pages) and the web
under race track / racetrack / racing + visualizer phrasings. Nothing on
GitHub matches. Candidates for what the keeper saw on reddit:

- **Team Dogpit, "Racecar Audio Visualizer"** (itch.io, Unity, win/mac/
  linux) — you drive a car through an audio-reactive environment (RMS /
  spectrum shaders). Closed source, no licence, name-your-price. Not
  borrowable; the closest confirmed racing-themed visualizer.
- **The "your song becomes the track" genre** — Music Racer (Steam),
  Audiosurf lineage: a vehicle rides a track *generated from the audio*.
  These live on Steam/itch, not GitHub, which would explain the failed
  repo search.

**RESOLVED, PROBABLY (later the same day, during the game-music pass):**
**Riff Racer - Race Your Music!** (Foam, Steam 2016, servers closed and
DELISTED 2022) - racetracks generated from the songs in your own library,
verses and choruses becoming checkpoints. A delisted Steam game, not a
GitHub repo, which is why every repo search failed. Keeper to confirm.

## Who is where — the field in one table

From willianjusten/awesome-audio-visualization plus direct checks:

| Class | Exemplar | Licence | What it shows |
|---|---|---|---|
| Milkdrop-class decorative | **butterchurn** (1.9k★) | MIT ✓ | WebGL Milkdrop presets — the canonical "party visual" layer |
| Spectrum instrument | **audioMotion-analyzer** (941★) | AGPL ✓ | High-res configurable spectrum — more polished than our spectrum panel, same idea |
| Waveform display | wavesurfer.js / Peaks.js | BSD ✓ | File waveforms, regions, scrubbing |
| Theory-reactive | **clubber** (376★) | MIT ✓ | Maps bands to "musical measures" for reactive art — closest in spirit to measured visuals |
| ML-enhanced | Muser | — | Feature-driven visuals, research-y |
| Terminal | cava | MIT ✓ | Console spectrum bars |
| Reactive scene toys | Soundwave + hundreds on the topic pages | mostly MIT | Frame-energy canvas scenes |
| Symbolic/notation | music-ui, VexFlow | MIT ✓ | Scores, piano rolls — note data, not audio |

**What none of them show — and Deckwave does:** the MIX, not the signal.
Camelot wheel tied live to a *running set*, the transition monitor, grid
error and stretch per deck, LIST ≠ DECK, the planned energy arc, worklet
gap counts, `☉ creator · licence` attribution. The field visualizes audio;
Deckwave visualizes *decisions about audio*. That distinction is already
the prior-art doc's verdict 4 ("common primitives, uncommon bundle") and
nothing found today weakens it.

**Worth taking (ideas, both licence-clean) — BOTH BUILT the same evening
(`assets/deckwave-popout.js`, BUILD-LOG Act 33, LISTENING §15):**
1. The **popout/projector window** (Soundwave's one good idea).
2. A **butterchurn party layer** behind a toggle, if decorative visuals
   are ever wanted — MIT, vendorable, 1.9k stars of preset ecosystem.
