# Deckwave — prompts

Reusable prompts, kept here so they are easy to reach and easy to keep true.

**Each one names what it depends on.** A prompt that describes the bundle is
wrong the moment the bundle changes, so every entry below states which file it
was derived from and when. Check that file before trusting the prompt.

---

## 1 · Custom tile spec (R11)

**Status: the schema below is PROPOSED, not implemented.** R11's whole inversion
is that the LLM is the last step — the schema has to exist first, and the prompt
is literally *emit this schema*. So writing this prompt IS writing the schema,
and the validator gets built against it. Nothing in Deckwave reads it yet.

**Derived from** `assets/deckwave-loop.js` (the `T` and `D` bundles) and
`assets/panel-centre.js` (the reference implementation), 2026-08-18.

Paste everything in the block below into any LLM, then add one sentence
describing the tile you want.

```
You are writing a JSON spec for a visualiser tile in Deckwave, a browser DJ
application. Output ONLY valid JSON — no prose, no markdown fence, no comments.

A tile is drawn once per animation frame. You may use ONLY the values listed
here. Anything not listed does not exist.

COLOURS — the object `T`, 8 entries. Refer to them by name as strings.
  bg    page background         line  faint rule / inactive
  dim   secondary text          ac    primary accent
  ac2   secondary accent        bad   error red
  fn    font family string      g     glow helper (not a colour)

DATA — the object `D`, 20 entries, with shapes and RANGES. The ranges matter:
a spec that assumes the wrong range renders as a flat line or a solid block.

  wave       Uint8Array, 1024   time domain. 0..255, SILENCE IS 128, not 0
  freq       Uint8Array, 1024   FFT magnitudes, 0..255, index 0 = lowest bin
  L, R       Uint8Array, 1024   per-channel time domain, same 128-centred scale
  vu         {L, R}             0..1 each
  stereo     {width, corr}      width 0..~2, corr -1..1 (1 = mono, -1 = inverted)
  flux       number             spectral change, ~0..3 typical, unbounded
  hit        boolean            true on the frame a bass onset fires
  hits       array              recent onset timestamps, seconds
  elapsed    number             seconds into the current track
  transLeft  number | null      seconds until the next blend; null if none
  blend      object | null      {in, at, dur, xfade, frac, fadeFrac}
                                frac and fadeFrac are 0..1
  set        array              track metadata: {name, bpm, camelot, energy,
                                key, scale, conf, dur, beats[]}
                                energy 0..1, conf 0..5.32, beats = seconds
  state      object             {idx, of, tempo, now, next}
  now        object | null      the META OBJECT on the playing deck — the
                                truth about what is playing; state.idx is
                                the list's opinion and the two can differ
  next       object | null      the meta scheduled to follow
  prev       object | null      the meta that handed over most recently
  prevRate   number             the rate it was running at (1 = native)
  deck       object | null      {meta, rate, startRate, playedBpm, stretchPct,
                                settling, settleLeft, elapsed} — live figures
                                off the playing deck; rate 1 for a straight
                                track, NEVER to be printed as a stretch
  nextDeck   object | null      {meta, rate, straight, reason} — the
                                scheduled deck and the rate it was built at

SCHEMA — emit exactly this shape:

{
  "id":    "kebab-case-id",
  "label": "short lowercase label",
  "background": "bg",
  "layers": [ ... ]
}

Each layer is one of:

  {"type":"series","source":"<expr>","history":600,"hz":10,
   "colour":"ac","fill":true,"scale":"auto"|"unit"}
      A value sampled at `hz` and scrolled right to left. `scale:"auto"`
      tracks the largest value seen and decays; `"unit"` assumes 0..1.

  {"type":"bars","source":"freq","bins":32,"colour":"ac","curve":2.2}
      Frequency bars. `curve` > 1 weights low bins wider, which is what makes
      a spectrum look right rather than crowded at the bottom.

  {"type":"scope","source":"wave","colour":"ac2"}
      Time-domain trace, 128-centred.

  {"type":"text","value":"<expr or string>","at":"tl"|"tr"|"bl"|"br"|"c",
   "colour":"dim","size":8}

  {"type":"grid","lines":4,"colour":"line"}

EXPRESSIONS — `source` and `value` accept a small language, nothing more:
  a bundle path              stereo.corr, vu.L, blend.frac, state.tempo
  rms(L), rms(R)             0..1 root-mean-square of a channel
  mid(), side()              rms of (L+R)/2 and (L-R)/2
  a + b, a - b, a * b, a / b, min(), max(), abs()
  numeric literals

HARD CONSTRAINTS — a spec breaking any of these is invalid:
  - No network, no fetch, no URLs, no external fonts or images.
  - No arbitrary code. Only the expression language above.
  - No absolute units on a scale nothing calibrated. If a value has no
    reference level, do not label it in dB, LUFS, Hz or percent-of-anything.
  - At most 6 layers.
  - If you cannot express what was asked with the values listed, say so in a
    "note" field and emit the closest honest thing. Do not invent a source.
```

**The reference implementation, expressed in this schema.** `panel-centre.js`
is the test case — if the validator accepts this and renders it faithfully, the
schema is good enough to ship:

```json
{
  "id": "centre-side",
  "label": "centre / side",
  "background": "bg",
  "layers": [
    {"type":"grid","lines":4,"colour":"line"},
    {"type":"series","source":"side()","history":600,"hz":10,
     "colour":"ac2","fill":true,"scale":"auto"},
    {"type":"series","source":"mid()","history":600,"hz":10,
     "colour":"ac","fill":true,"scale":"auto"},
    {"type":"series","source":"mid() / (mid() + side())","history":600,"hz":10,
     "colour":"dim","fill":false,"scale":"unit"},
    {"type":"text","value":"relative · centre ≠ vocal","at":"br","colour":"dim","size":8}
  ]
}
```

**What this example proves the schema must support**, and what to check a
validator against: two derived series from raw channel data, a fixed sample
rate independent of framerate, relative auto-scaling, one series on a bounded
0..1 scale while others auto-scale, and a text label that is an honesty
statement rather than a value.

---

## 2 · Keeping this file true

Before using prompt 1, confirm the vocabulary still matches:

```bash
grep -n "const D = {" -A 6 assets/deckwave-loop.js
grep -n "const T = {" -A 4 assets/deckwave-loop.js
```

`D` was 20 entries and `T` was 8 on 2026-08-19 (`now`, `next`, `prev`,
`prevRate`, `deck`, `nextDeck` were added so panels read the deck rather than
the list index — ledger 53). It was 14 on 2026-08-18 and R11 said 13 before
`elapsed` was added. If the counts differ from the table above, the prompt is
stale and will produce specs referencing sources that no longer exist.
