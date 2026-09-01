# The voice pipeline, as converged 2026-08-23 — canonical parameters

Paired with `recon-feed-2026-08-23.jsonl` (the night's full append-only
score, 54 records). The rendered WAVs (`speech/take*.wav`) are runtime
artifacts, regenerable from these exact recipes; the feed is not.

## Render (Windows, System.Speech / SAPI)

- Voice: **Microsoft Zira** (en-US female)
- SSML prosody: `rate="-15%" pitch="-8%"`
- Output: 22.05 kHz 16-bit mono WAV into `speech/` (served, gitignored)

## Playback (the facility chain — extensions/recon/recon-app.js)

Decoded on the deck's own running AudioContext (the `_dev` seam —
experiment status, post-launch landing planned), then:

```
source ──┬────────────────────────────► highpass 140 Hz ─► lowpass 6.5 kHz ─┬─► mix ─► voice gain ─► destination
         └─ double @ rate 1.007 ─► ×0.45 ─┘                                 │
                                            └─► delay 55 ms ⇄ feedback 0.22 ─► ×0.28 wet ─┘
```

- Voice gain: `dw-voice-gain`, via `voiceCfg {"gain": n}`, range 0-2.
  **LOCKED by ear 2026-08-23: 1.62** ("This is the volume").
- Room: `dw-voice-room`, via `voiceCfg {"room": n}`, scales the slap's
  wet and feedback together. **LOCKED: 0.3** ("This is the reverb
  amount. Lovely.")
- FX toggle: `dw-voice-fx` = `facility` | `off`. **Renamed 2026-08-23**
  from `glados` at the keeper's call, the day before launch — an
  influence may be named in prose, but a shipped identifier should not
  borrow someone else's trademark to describe our own work. The old
  value is still accepted forever on read, so a stored setting does not
  silently switch the chain off.
- Honesty label kept with the chain: this is the REGISTER, not the
  person — the famous computer voice it was tuned against is a melodic
  autotune of a human performance, and this is not that.

## Register (the offline stage — tools/register.py)

Added 2026-08-23. Applies **only** what Web Audio has no node for, so it
composes with the chain above instead of duplicating it: a cepstral
**formant shift** (envelope moves, pitch does not — which no
`playbackRate` can do) and a shallow **ring modulation**.

- Voice: **`en_GB-vctk-medium` speaker 99** (VCTK p303, F, 24, Toronto),
  Piper, `--length-scale 1.15`. Chosen by ear from the Canadian card —
  *"speaker 99, the great one."*
- Grade: **`facility` — formant 0.88 · ring 0.18 @ 62 Hz · drive 0.15.**
  **LOCKED by ear 2026-08-23** (*"g2-p303 will work"*), auditioned
  against `plain`, `near` and `deep` on the same line.
- Reproduce: `python tools/register.py --in <dry>.wav --out <x>.wav
  --preset facility`.
- Transform is transparent when idle: `plain` round-trips the STFT at max
  abs error 0.00101, so anything heard on a grade is the grade.
- Keeper on the resemblance, kept because it is the honest read: *"it
  doesn't sound like GLaDOS anyway, and that's okay."* It is its own
  register.

## Why this pipeline exists (the ledgers under it)

- 74: iOS ducks around ALL speech synthesis; no web lever.
- 75: setting `utterance.volume` SILENCES iOS WebKit outright.
- Therefore: no speech session at all — rendered audio through the
  deck's own graph. Nothing ducks, and every fader is ours.

## The music side (keeper-tuned, device-persisted)

- Cruise dial ≈ 4–6 of 11, hardware (AirPods) carrying room loudness.
- `boost` + `overdrive` (up to 1.45, through the compressor) remain for
  the speechSynthesis path (`speak` records); the rendered path needs
  neither.
