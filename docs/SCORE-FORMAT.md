# The Deckwave Score Format

A DJ set described as executable data rather than rendered audio.

## Why this exists

Existing DJ interchange formats — rekordbox XML, Traktor NML, Serato crates, the `.cue` tradition — capture **track order and cue points**. None of them capture the *transition*: the crossfade curve, the EQ automation, the time-stretch ratio, the parameters of the engine that produced them.

The nearest prior art is DJ.Studio's proprietary `.DJS` project format, which does capture transitions and exports deterministically to Ableton. This format differs in being open, compact, and carrying an **engine block** so a conforming player can reproduce the mix rather than merely describe it.

## The determinism claim, stated honestly

A score plus the same source files should reproduce the same mix. That depends on identical Essentia/WASM builds, identical decode paths, and stable analysis across browser versions.

This is exactly the problem tracker modules have always had: without a normative playback spec, the same file sounds different in different players. The engine block **mitigates** that by declaring what produced the mix. It does not eliminate it.

**Cross-browser determinism has not been tested.** Treat reproducibility as an intent with a declared dependency, not a guarantee, until someone measures it.

## Shape

```json
{
  "format": "deckwave-set",
  "version": 1,
  "generated": "2026-08-17T02:49:56.242Z",
  "engine": {
    "mode": "all",
    "phrase": false,
    "sequencer": "rolling-tempo target, camelot + energy arc, hard stretch gate; a track the gate cannot reach, or whose grid disagrees with its tempo, plays STRAIGHT",
    "drift": 0.35,
    "xfadeSec": 16,
    "maxStretch": 0.08,
    "maxGridErrPct": 9,
    "detector": "essentia.js RhythmExtractor2013 multifeature, whole track (key/rms: centred 120s excerpt)",
    "keyDetector": "essentia.js KeyExtractor",
    "stretch": "SoundTouchJS AudioWorklet 2.1.1 — source playbackRate = rate, worklet restores pitch",
    "transition": "downbeat-aligned crossfade with 3-band bass swap; straight tracks crossfade on the clock, unaligned",
    "phraseDetector": null,
    "downbeat": "assumed every 4th beat from first — no downbeat detection",
    "determinism": "depends on identical engine builds; NOT cross-browser tested"
  },
  "summary": {
    "tracks": 99, "runtimeSec": 11815,
    "libre": 0, "noDerivatives": 0,
    "tempoStart": 100.14, "tempoEnd": 150.48,
    "straight": 5, "maxStretchPct": 7.77
  },
  "steps": [ ... ]
}
```

### A step

| Field | Meaning |
|---|---|
| `i` | position in the set |
| `name` | filename stem, used to re-resolve against a library |
| `bpm` | measured native tempo |
| `camelot` | key in Camelot notation (e.g. `8A`) |
| `key` | key and scale as detected (e.g. `C minor`) |
| `energy` | composite index — **constructed, not measured** (see below) |
| `conf` | detector confidence, Essentia scale 0–5.32 |
| `straight` | **added 2026-08-19.** `null` for a beatmatched track; `"grid"` when its beat grid disagrees with its tempo label by more than `engine.maxGridErrPct`, `"reach"` when the set could not stretch to it. A straight track plays at its own speed from `0`, crossfades on the clock with no beat alignment, and — if `"reach"` — repositions the rolling tempo to its own BPM |
| `matched` | **added 2026-09-01.** `true` when this step is beatmatched against the one before it — i.e. not straight and not step 0. The one question every reader printing a stretch figure actually has |
| `rate` | tempo multiplier applied at playback. `1` for a straight track, and `1` for step 0 |
| `stretchPct` | the same as a percentage, for humans. **`null` whenever `matched` is false** — for a straight track, and (since 2026-09-01) for **step 0**, which has nothing before it. Not `0`: `0` reads as the best transition in the set, and neither of those is a transition of that kind. `rate` stays `1` in both cases because that IS the rate; `stretchPct` is a claim about a transition, and there is no transition to claim |
| `entrySec` | seek offset — the track's first detected beat; in phrase mode (`engine.phrase`) the first 8-bar phrase start when one is known; `0` for a straight track |
| `exitSec` | when to begin the outgoing fade, snapped to a downbeat (phrase mode: the last phrase start; straight: on the clock) |
| `dwellSec` | **added 2026-08-19.** Only on a stepping stone of a committed fast route: how long it plays before the next blend, after the engine floor is applied. `null` otherwise |
| `phraseBar` | **added 2026-08-19 (phrase match).** The detected 8-bar offset (0–7) DWPHRASE stamped on the track at play time, or `null` when not yet known or not applicable (non-phrase build, straight track) |
| `phraseContrast` | the detector's own ratio beside that offset (worst within-phrase variance over best; 1 = no preference). **Comparable to nothing outside DWPHRASE; no threshold is applied on it.** `null` with `phraseBar` |
| `onPhrase` | phrase builds only: `true` when THIS step's entry and exit are phrase-aligned in the plan (its `xfadeSec` is then one phrase, not the set's xfade); `false` when it took the downbeat path; `null` on other builds |
| `atSec` | position in the finished mix |
| `xfadeSec` | crossfade length |
| `bassSwapSec` | when the outgoing low shelf drops |
| `durSec` | full track duration |
| `source` | **added 2026-08-19 (late).** `null` for a local file. For a track fetched from a libre source (`⊕ libre`, DWLIBRE): `{kind, item, page, creator, release, licence, licenceName, noDerivatives, file, format}` — `licence` is the URL the Internet Archive records for the item, `licenceName` its short form (`CC BY-NC-SA 3.0`, `CC0`, `public domain`) or `null` when the URL is not one the table recognises, `noDerivatives` true for `-nd` terms, `page` the item's archive.org page. **Most CC licences require attribution, so a score that holds such a track carries the terms with it**; `load()` puts them back on the matched record, `summary.libre` counts them and `summary.noDerivatives` the `-nd` ones, and the cue sheet prints `REM ATTRIBUTION "creator / release / licence / page"` per such track |

### The engine block, since 2026-08-19

Additive fields a reader of the original shape will not have seen: `mode` (`all` / `best` / `phrase` — the build that produced the order; `load()` puts it back), `phrase` (whether the Player leaves and enters on 8-bar phrase starts), `maxGridErrPct` (the grid cut that decides `straight: "grid"`, read from the live engine at write time), and `phraseDetector` (the DWPHRASE version and method when `phrase` is true, else `null`). `sequencer`, `detector` and `transition` are longer sentences than the ones above and say the same things plus the straight-track rule. In `summary`, `libre` counts steps that carry a `source` and `noDerivatives` the ones under `-nd` terms.

## Reading it honestly

**`conf` is on Essentia's scale (0–5.32), where 1.5–3.5 is moderately confident.** It is not comparable to any other detector's confidence number. Presenting it against a different algorithm's figure as a before-and-after would be misleading.

**`energy` is a constructed index**, not a measurement: 45% loudness, 25% brightness, 30% tempo, normalised across the corpus. It correlates with what a listener would call energy. It is not the same thing, and the weights were chosen rather than fitted.

**`stretchPct` past ±15% will audibly wobble.** That is a perceptual limit, not a style preference. The sequencer gates at 8% for that reason.

**`summary.maxStretchPct` is over beatmatched tracks only.** A straight track is unstretched because it is not being beatmatched; folding its zero in would pull the figure toward "everything is fine", which is a different fact. `summary.straight` counts them. Step 0 is excluded too, for the same reason — it is not beatmatched against anything.

## Loading

`DWSCORE.load()` resolves steps against the corpus by normalised name and restores `straight` (as the engine's `_unlocked` / `_unlockReason`) and `dwellSec` onto the matched records, so a loaded straight track is still played straight. A score written before these fields existed loads unchanged: those sets were built when everything was beatmatched, and the loader leaves their classification alone rather than inventing one.

## Companion cue sheet

A standard `.cue` is emitted alongside, with BPM, key and stretch as REM lines — `STRAIGHT grid|reach (no beatmatch)` in place of a stretch for a straight track, and `FIRST (nothing to match)` in place of one for step 0. It opens in VLC and foobar2000 and gives track navigation over a rendered mix.

## Version

Still `"version": 1`. The 2026-08-19 fields are additive: a reader of the old shape sees extra keys and nothing missing. The first change that removes or re-types a field bumps the version — ROADMAP "the score format has to grow" still stands.
