# Deckwave — design notes and evidence

Why each choice was made, what it replaced, and what is still untested. Written after the first version was measured and found wanting.

---

## 1. Beat detection: why not the obvious method

The first implementation used the widely-copied approach from **Joe Sullivan, "Beat Detection Using JavaScript and the Web Audio API" (Beatport Engineering, 2014)** — lowpass to isolate the kick, peak-pick with a descending threshold, histogram inter-peak intervals. It is the same algorithm the `web-audio-beat-detector` npm package implements.

**Measured on a real 35-track synthwave and chiptune corpus: median confidence 0.096, with 23 of 35 below 0.12.** It was not locking onto a beat.

Two structural reasons, both predictable in hindsight:
- **Sidechain compression** pumps the whole mix in time with the kick, smearing the transient the peak-picker depends on.
- **Chiptune percussion** is square-wave and noise-based, with little sub-bass energy for a 150 Hz lowpass to isolate at all.

The fix was not a better threshold. It was a better **onset detection function**. Essentia's `RhythmExtractor2013` in `multifeature` mode runs beat tracking five times with five different ODFs — complex spectral difference, energy flux, harmonic, sub-band weight, mel auditory — and selects by mutual agreement. Redundancy across bands is what rescues material where any single band is weak.

**On the same corpus: 204 of 350 tracks above 2.0, only 14 below 1.0.**

### The comparison that must not be made

**0.096 → 2.17 is not an improvement of 22×. The scales are different.** The old figure was modal-count over total, bounded at 1. Essentia's runs 0–5.32 with 1.5–3.5 as "moderately confident." Reporting them as a before-and-after is the easiest available lie with this tool, and the skill file forbids it.

What *is* comparable is whether the outputs look like music. The new detector returns exact round numbers — 125.00, 120.00 — on programmed electronic tracks. The old one never did.

### Chiptune is an open problem

A search across ISMIR archives and the wider literature found **no paper on audio beat tracking for chiptune, SID or tracker music.** Adjacent work is symbolic-domain; one dataset simply ran madmom on rendered audio and took the median, with no accuracy evaluation. **Treat any tracker's chiptune performance as untested.** Low confidence on that material is expected.

---

## 2. Tempo: why the target rolls

The first sequencer used one global target BPM — the median of the set. Against a corpus spanning 80 to 150 BPM, **57 of 187 tracks came out over budget, and the closing track needed +52% stretch.**

The perceptual constraint is firm: **clean time-stretch holds to roughly ±15%**, and beyond about ±25% music sounds broken. A single target cannot span that range.

Real DJ sets do not hold one tempo for hours. The fix is a **rolling target that drifts 35% toward each incoming track**, plus a hard gate refusing anything needing more than 8% stretch from the current tempo. Result on the same corpus: **max stretch 7.5%, tempo climbing 100 → 150 across the set.**

**The gate makes the sequence stop short rather than degrade.** Asked for 200 tracks it returned 115, because nothing reachable remained. That is the constraint working. Report it as such.

---

## 3. Pitch-preserving stretch

`AudioBufferSourceNode.playbackRate` changes pitch as well as speed, and the Web Audio spec has no native pitch-preserving stretch. `HTMLMediaElement.preservesPitch` gives it free but only for media elements, and loses the sample-accurate `start(when, offset)` scheduling that downbeat alignment depends on.

**SoundTouchJS as an AudioWorklet** is the working answer: WSOLA time-domain stretching on the audio render thread, exposing `tempo`, `rate`, `pitch` and `pitchSemitones` as AudioParams. Cheap enough for two simultaneous decks.

**Verified working:** `addModule()` accepts the jsdelivr URL cross-origin. This was the one wall that could not have been coded around, and it is clear.

Rubber Band WASM is higher quality — per its author, the R3 engine costs about **3× R2** — and is the right choice for an offline render where CPU does not matter. Not wired here.

**Untested:** harmonic/percussive separation for differential stretching (phase vocoder for harmonic content, WSOLA for percussive). It is the known quality ceiling and no maintained JS or WASM implementation exists.

---

## 4. Memory

`decodeAudioData` expands a track to roughly 80MB of float PCM. A few hundred tracks cannot coexist.

Two mechanisms, both load-bearing:
- **Analysis decodes, measures a 120-second excerpt, and discards.** Only features persist.
- **Playback decodes one track ahead and releases behind.** Two buffers resident at any time, regardless of set length.

A 115-track, 6.7-hour set runs in roughly the memory of two tracks.

---

## 5. The stop bug

The first player scheduled all eight tracks up front with `start(when)`. The whole set was committed the moment play was pressed — no pause, no skip, and it played to an empty room for fifteen minutes.

Rebuilt to schedule one ahead. **The stop button still did not work**, and the reason is subtle: it nulled the deck pointers and called `stop()` on what it held, but the *next* deck was already scheduled at a future time and unreachable through those pointers. It kept its appointment.

**Every source now goes into a registry, and `stop()` iterates the registry.** `kill()` closes the context outright as a guaranteed backstop, because it is the only thing that works regardless of graph state.

The general form is worth keeping: **a stop that reaches only what is currently sounding is not a stop.**

---

## 6. Energy

`0.45 × loudness + 0.25 × brightness + 0.30 × tempo`, normalised across the corpus.

**The weights were invented, not fitted.** There is a real literature — arousal prediction from audio features reaches R² around 0.65–0.79 with proper feature sets — and this index is not it. It correlates with perceived energy and orders a set sensibly. It is not a measurement, and the skill says so.

**One known defect:** zero-crossing rate is used as the brightness term. ZCR actually measures noisiness and percussiveness; **spectral centroid** is the correct brightness feature. The substitution is a cheap time-domain hack and should be replaced.

---

## 7. What is still missing

| Gap | Why it matters |
|---|---|
| **Phrase detection** | Transitions land on downbeats, not 8/16/32-bar boundaries. This is the single largest quality gap — Foote novelty over a beat-synchronous self-similarity matrix with an 8-bar checkerboard kernel is the established method. |
| **Downbeat detection** | Bar position is assumed as every fourth beat from the first. Fine for 4/4 electronic music; wrong elsewhere. The best method (RNN + dynamic Bayesian network) has no browser port. |
| **Structural labelling** | No intro, outro, drop or breakdown detection, so mix points cannot target them. |
| **Loudness normalisation** | No LUFS measurement. A set assembled from tracks at different masters will jump in level. |
| **Spectral centroid** | Should replace ZCR in the energy index. |
| **HPSS stretching** | The quality ceiling for time-stretch; no JS implementation exists. |

---

## 8. Honest status

**Verified by measurement:** the detector improvement on a real corpus; the stretch budget after the rolling-target rebuild; that the worklet loads cross-origin; that the cache makes rescans instant; that 364 tracks analyse without exhausting memory.

**Built and syntax-checked but not heard end to end:** the registry-based stop, the bass swap, the full 115-track lazy-decoded set.

**Not implemented:** everything in §7.

Anyone extending this should re-measure rather than trust the numbers above — they came from one artist's catalogue, and a corpus of one genre is not a benchmark.
