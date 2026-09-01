# Deckwave patches

Standalone modules, saved as they were fixed. Load each after `deckwave-panels.js`
and after the dashboard has mounted. Each replaces or adds one thing and is
independently droppable — keep them in a folder and load in order.

**`assets/` is canonical; this folder is history.** Checked by byte compare
on 2026-08-19: 02, 04 and 09 differ from their `assets/` counterparts (the
card is docked and reads the deck; the loop reads `DW.blend` and carries the
deck in its bundle; route-commit plays straight instead of dropping), and
there is no patch file for what became `panel-centre.js`, `panel-route.js`,
`deckwave-sprites.js` or the 0.7.x engine changes. The descriptions below
are as written when each patch landed; where they say a track is "dropped"
or the card is "floating", the shipped asset no longer does that.

| # | File | What it does |
|---|---|---|
| 01 | `01-spectrogram-v4-devicepixel.js` | Replaces the spectrogram panel. Fixes the device-pixel scroll bug. |
| 02 | `02-now-playing-card.js` | The floating now-playing card, bottom right. |
| 03 | `03-flac-tags.js` | Reads real artist/album/title from FLAC VORBIS_COMMENT. |
| 04 | `04-render-loop.js` | The single clean render loop. Replaces all wrapper chaining. |
| 05 | `05-messages-glossary.js` | 32-term glossary + translation export. |
| 06 | `06-corpus-cache.js` | Export and restore the analysed corpus. |
| 07 | `07-steering-router.js` | Steer a running set. Routes through intermediate tracks. |
| 08 | `08-wayposts-panel.js` | The corpus as a navigable space. Draws the route. |
| 09 | `09-route-commit.js` | Commits a route into the set and repairs the tail. |
| 10 | `10-fast-blend-multiqueue.js` | Fast blends via short dwells; queue becomes a list. |
| 11 | `11-render-flac.js` | Offline bounce to FLAC (unstretched — see its header). |

## 01 — why the spectrogram was blank

`getImageData`/`putImageData` work in **device** pixels and ignore the canvas
transform. `fillRect` **honours** the transform. The panel scrolled its history
in CSS coordinates while drawing the new column in transformed coordinates, so
at `devicePixelRatio 1.75` it scrolled a 233×259 corner of a 455×453 buffer and
drew the column somewhere else. The right-edge pixel read `[0,0,0,0]`.

**It works correctly at dpr 1.** That is what made it hard to see — right on the
developer's display, broken on real hardware. The fix does the whole panel
untransformed.

Calibration is measured rather than chosen: real material runs p10 −23 dB,
median −10 dB, peak −3.7 dB. An earlier −62 dB floor mapped the median to 0.84
and produced a solid block.

## 02 — the now-playing card

Reads only from the shared per-frame bundle and `DW.state`. No private engine
access, which is why it survives the loop refactors that broke two earlier
versions of this card.

```js
DWNOWPLAYING.mount(dash);              // once
DWNOWPLAYING.update(D, transLeft);     // every frame
DWNOWPLAYING.toggle();                 // show/hide
```

The stretch cell turns amber past ±8%, the same threshold the sequencer's gate
uses — one number, one meaning, everywhere it appears.

## 03 — FLAC tags

Without this, every name in the UI is derived from the filename. With it you get
the artist, album, title, year and track number the file actually carries.

**The trap:** FLAC metadata block *headers* are big-endian; the Vorbis comment
payload *inside* them is little-endian. `getUint32(q, true)` — the `true` is not
optional. Get it backwards and you read nonsense lengths and walk off the end of
the buffer.

Lazy by design. Tags are fetched on demand for the current and next track and
cached by record id, so an already-analysed corpus needs no rescan. The next
track is prefetched so its title is ready before the blend lands.

```js
const tag = DWTAGS.forRecord(record, DW.LIB);   // null on first call, then cached
// { title, artist, album, albumartist, date, track, disc, genre, isrc, comment }
```

Only the first megabyte of the file is read — metadata lives at the head, and
there is no reason to pull a 40 MB track into memory for a title.

## 04 — the render loop

This is the piece that died mid-session and took every panel with it.

**Why it died:** the loop had been rebuilt inside wrappers repeatedly, each
capturing the previous and calling through it. One link dropped and the chain
went with it — zero frames in two seconds, while the audio kept playing and
every panel drew correctly when called by hand.

**The rule this encodes:** one loop, defined once, owning its own state. Do not
wrap it to add a feature; add the feature to the bundle it already builds.

**And panel errors are stashed, not swallowed.** `DWLOOP.errors(dash)` returns
whatever is currently failing. A `try/catch` that discards is a bug given
somewhere to hide — a dead loop and a broken panel were indistinguishable from
outside for four diagnostic steps.

```js
DWLOOP.start(dash);        // dash supplies .slots, .set, .stereoSource, .header
DWLOOP.errors(dash);       // [{panel, err}] — check this when a panel goes dark
DWLOOP.stop();
```

## 06 — corpus cache export / restore

The cache is the most expensive thing in the browser and the most fragile.
Hundreds of tracks take a long analysis pass; clearing site data destroys it in
one click, and re-analysis is **not guaranteed to reproduce the same values** —
a different Essentia or WASM build can shift features slightly, which is enough
to change which track the sequencer picks next.

```js
await DWCACHE.status();          // what's cached right now
await DWCACHE.export();          // downloads a dated JSON snapshot
await DWCACHE.restore(json);     // merge (default) — keeps what's there
await DWCACHE.restore(json,'replace');  // clears the store first
```

**Features only. No audio, no file handles.** Restoring recovers the analysis;
you still re-open the library folder for playback, because file handles cannot
be serialised.

**`restore()` verifies rather than assuming.** It recomputes the summary and
compares it field-by-field against what the file claims — track count, total
beats, mean confidence, tempo range. In `replace` mode a mismatch is a real
failure and you want to know at restore time, not when a set comes out wrong.

Filenames carry the export date. **Never overwrite a previous export** — each
one is a snapshot of a corpus state, and a set built from one corpus is only
reproducible against that corpus.

## 07 — steering and the router

Clicking a track used to jump. Now it offers options, because a DJ deciding to
go somewhere else has more than one way to get there.

**The idea:** the rolling target moves 35% toward each track played, so a track
unreachable *now* may be reachable after one hop. "Get me to track X" becomes a
shortest-path search over the corpus with the stretch gate as the edge
condition.

**One hop gains at most 3.04% tempo** — derived: the fastest track playable at
target T is T/(1−GATE), and the target then advances DRIFT of the way toward
it. The first version used `maxHops: 3`, a guessed number that buys only ~9%
tempo, so most destinations read as unreachable. They were not; the search was
too shallow. **Same failure as every threshold in this project set without
measuring the range first.** Default is now 16.

Measured on 189 tracks at 109 BPM:

| Destination | Direct | Route | Ends at |
|---|---|---|---|
| 123 BPM | 11.4% | 2 hops · 117→120 | 6.8% |
| 139 BPM | 21.6% | 7 hops · 117→…→137 | 6.5% |
| 79 BPM | 38.0% | 13 hops · 102→…→81 | 7.1% |
| 172 BPM | 36.7% | **no route in 16 hops** | — |

**That last row is not a failure.** With an 8% gate and 3% per hop, 109→172
needs ~13 consecutive rungs and this corpus does not contain them. The router
telling you a destination is unreachable is telling you something true about
your record collection.

```js
DWNAV.options(currentTempo, destTrack, DW.corpus)  // what the UI renders
DWNAV.plan(T, dest, corpus, {maxHops:16})          // the search itself
DWNAV.setQueue({idx, mode:'route', hops})          // read by the player
DWNAV.back()                                       // pop the jump history
```

## 08 — the wayposts panel

The corpus as a space you move through rather than a list you pick from.

- **angle** = Camelot position → a harmonic move is a rotation
- **radius** = tempo, log-scaled → a tempo move is a step outward
- **lit annulus** = everything the 8% gate permits from where you are

Because the key axis is a circle, a long tempo climb that stays harmonically
sensible comes out as a **spiral**. That is not styling — it falls out of what
the axes mean.

Three queue states render differently so the panel says *how* you are getting
somewhere: a **route** as a numbered dashed path through each waypost, a
**direct queue** as a single line to a green marker, and a **forced** jump as a
red line.

Requires patch 07 for `DWNAV`.

## 09 — committing a route

**The bug this fixes:** patches 07 and 08 built a router, a steering menu and a
visualiser. All three worked and demoed convincingly. The queue was populated
the whole time and **nothing in the playback path ever read it.** The feature
recorded intentions and discarded them.

The diagnostic that caught it, kept because the shape is reusable:

```js
/DWNAV|queue/.test(DW.play.toString() + DW.skip.toString())   // → false
```

**The fix avoids a second code path.** Rather than intercepting next-track
selection, a committed route is **spliced into the set**. The player walks it
by construction and the detour is visible in the track list.

**What the splice exposed:** a detour changes the tempo state, so the original
tail is no longer playable in order. Measured — after a 6-track climb from 114
to 146.7 BPM, the next original track needed **12.5%**. `resequenceTail`
re-plans the remainder from where the detour actually left us.

Verified after: **54 tracks ahead, zero over the gate, max 7.9%.** Twenty
tracks dropped — which is the gate working. After climbing to 137 BPM, twenty
tracks are no longer reachable. A shorter correct set beats a longer broken one.

```js
DWNAV.commitAndRepair(set)          // the operation the UI wants
DWNAV.verify(set, idx, tempo)       // assert the whole tail clears the gate
```

## 10 — fast blends and a multi-destination queue

**The property this exploits:** the rolling target advances 35% **per track
played, not per second.** A stepping stone shifts the tempo exactly as much
whether it plays for 40 seconds or four minutes. So an intermediate that exists
only to move tempo does not need its full length.

Measured from 125 BPM on 189 tracks:

| Destination | Hops | Scenic | Fast | Saved |
|---|---|---|---|---|
| 151 BPM | 6 | 21.0 min | **4.0 min** | 17 min |
| 90 BPM | 11 | 38.5 min | **7.3 min** | 31 min |

Same hops, same tempo movement, same 8% gate on every transition. Only the
dwell changes. The floor is two crossfades plus a hold — below that it stops
being a mix and becomes a cut.

**The queue is now a list.** Enqueue several, reorder, remove. Each entry keeps
its own mode, so you can take the scenic route to one track and jump straight
to another after it. `DWNAV.queue` still returns the head, so patches 08 and 09
need no changes.

```js
DWNAV.planFast(T, dest, corpus)     // { hops, dwellSec, minutes, savedMinutes }
DWNAV.enqueue({idx, mode, hops, dwellSec})
DWNAV.moveQueue(from, to); DWNAV.removeAt(i); DWNAV.queueTime()
DWNAV.optionsFull(T, dest, corpus)  // every option incl. fast
```
