# Deckwave in a game — the integration guide

For web game developers. Deckwave turns a folder of music — the PLAYER'S
own, or freely-licensed material fetched with attribution — into a
beatmatched, harmonically-mixed set your game can direct while it plays.
The working example is `examples/soundtrack.html` (~100 lines, half of it
comments): serve the tree, open it, press ▶ demo once, and the square
pulses on the beat while the header buttons steer the music.

## The two directions

**Game → deck: `DWEVENTS.inject(text)`.** Seven intents behind a synonym
table (free text works): `faster` / `slower` (BPM), `hype` / `calmer`
(energy), `change` (blend into the next track), `duck` / `unduck` (volume
to 0.3× for dialogue, restored exactly). Steering obeys the same stretch
gate as the whole engine — in gate it blends now, out of gate it commits
a fast route, and an impossible ask answers with a sentence naming why
(`DWEVENTS.status.last` carries the decision). Treat a refusal as
information, not an error.

**The ceiling on "free text works", stated plainly.** It is a LOOKUP over a
word list, not a parser, and it matches the first list a word appears in.
So `"drop it down"` is **hype** (the word is `drop`), `"speak faster"` is
**duck** (duck/unduck are matched first, deliberately — "quiet for a
moment, I am talking" must never be read as an energy request), and a bare
`"quiet"` is **calmer**, not a duck. A NEGATION is refused rather than
guessed: `"don't speed up"` steers nothing and answers with a sentence,
because inverting an intent correctly needs the sentence parsed and this
does not parse sentences. If your game builds strings, build them from the
seven verbs and keep the prose for your own UI; `DWEVENTS.parse(text)`
returns the kind (or `null`) without acting, so you can check first.

**Two ducks, two numbers.** `inject('duck')` multiplies `DW.volume` by
**0.3×** and `inject('unduck')` restores it exactly. `DWEVENTS.speak(text)`
— the page reading a line aloud over the set — ducks by its own
configurable **0.55×** (`configureSpeech({duck})`), because a voice sharing
the page's audio session needs less room than a voice over the top of it.
Both restore the volume the music had when the duck STARTED: a fader move
or a `level` sent while the voice is speaking is discarded when it ends, by
design. Set the level before or after, not under.

**Deck → game: `DWEVENTS.pulse()`.** Poll it from your own rAF; it reads
the audio clock at call time (pull — no timers, no delivery jitter):

```js
{ playing: true, name, bpm: 120, tempo: 127.2, rate: 1.06, straight: false,
  energy: 0.6, camelot: '8A', pos: 10.6, dur: 200,
  origin: 'chain', matched: true,
  beat: { i: 21, phase: 0.2, untilSec: 0.377 },
  bar:  { i: 5, beatInBar: 1 } }
```

`tempo` is the playing tempo (label × stretch). Nothing playing →
`{ playing: false }` alone, so gate on one field.

**`origin` and `matched` — do not read `rate` for this.** `origin` is
`'chain'` for a deck the engine beatmatched into place, `'play'` for the
first ▶, a jumped-to track or `back()`. `matched` is the question a UI
printing a stretch figure actually has: *is this deck beatmatched against
anything?* A `'play'` deck runs at exactly `rate: 1`, so `rate === 1` reads
as a perfect beatmatch when nothing is being matched at all — show the
stretch only when `matched` is true. A straight (grid-unlocked) track is
`matched: false` even on the chain path. Both fields are absent when
nothing is playing, and on an engine too old to publish them.

## Embedding

**Same-origin iframe (recommended).** Serve Deckwave beside your game and
embed `index.html`; `iframe.contentWindow.DWEVENTS` gives you direct
calls — this is what the example does. **Cross-window**: a same-origin
window/tab answers `postMessage({deckwave:'inject', event:'…'})` and
`{deckwave:'pulse'}` (replied to the sender, `id` echoed). Cross-ORIGIN
messages are ignored by design.

**The one gesture.** Browsers require a user click before audio: one real
click on ▶ (or ▶ demo) inside Deckwave's frame. After that, everything is
yours. Design it in — "click to start the music" is a screen every web
game with audio already has.

**Music with no library**: `DWLIBRE.demo()` fetches a curated licensed
set from the Internet Archive (creator · licence ride every track, the
cache makes the second run free). Your players' own folders are the full
experience.

## Honesty notes, inherited

`bar` assumes 4/4 from the first beat — right for most electronic music,
wrong inside grids that switch feel mid-track (documented, ROADMAP D10).
`energy` is a constructed index, not a measurement. A `straight: true`
track is not beatmatched (its grid or tempo was outside the gate) but
still pulses on its own grid. The events vocabulary is seven verbs; if
your game needs parameter curves, stingers, or sync marks, that is the
known next layer — ask, or build on `pulse()`.

## Licence

Deckwave is **AGPL-3.0** (NOTICE has the full third-party list). Embedding
it in a game you distribute or serve triggers AGPL obligations for the
combined work — fine for open web games, a real decision for commercial
ones. The music side is clean by construction: the player's files never
leave their machine, and libre material carries its terms.
