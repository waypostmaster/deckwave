# vendor/

Self-hosted, pinned dependencies. **Do not load these from a CDN in production.**

Three reasons:
1. The AudioWorklet processor must be served same-origin with a
   `text/javascript` or `application/javascript` Content-Type.
2. If you ever need WASM threads, cross-origin isolation (COOP/COEP) blocks
   CDN resources that don't send CORP.
3. Pinning is meaningless if the CDN decides to serve you something else.

## What is here

Fetched 2026-08-17. Versions are exact, not ranges. Verify with `sha256sum`
before trusting a copy you did not fetch yourself.

| File | Package | Version | Licence | sha256 (first 16) |
|---|---|---|---|---|
| `essentia-wasm.web.js` | essentia.js | 0.1.3 | AGPL-3.0 | `ea8891410df550d2` |
| `essentia.js-core.js` | essentia.js | 0.1.3 | AGPL-3.0 | `5fa73edac652774d` — CORRECTED 2026-09-01: the recorded prefix was `64c87394ce8c7c9b`, which matches neither the file as stored nor as checked out, so anyone following this table’s own "verify before trusting" instruction on the AGPL dependency would have concluded tampering. Hash the file as git stores it (LF); a Windows checkout has CRLF and will differ. |
| `essentia-wasm.web.wasm` | essentia.js | 0.1.3 | AGPL-3.0 | `44cb2434da19a06f` |
| `soundtouch-processor.js` | @soundtouchjs/audio-worklet | **2.1.1** | **MPL-2.0** | `59635b112697ad40` — loaded by the Player as TEXT and concatenated with `assets/deckwave-stretch.js` (one held render block, ledger 65) into a single blob: worklet module; the file itself is not modified, and the Player falls back to loading it directly if the blob module is refused |
| `soundtouch-worklet.js` | @soundtouchjs/audio-worklet | 0.3.0 | LGPL-2.1 | `50293f0edbb91361` | *(retained, NOT loaded)* |
| `libflac.min.js` | libflacjs | 5.4.0 | MIT | `1c359463b1507386` |
| `libflac.min.js.mem` | libflacjs | 5.4.0 | MIT | `eb40de0e92e0d7fb` |
| `butterchurn.min.js` | butterchurn | 2.6.7 | MIT | `4e67421bc18d48fa` — fetched 2026-08-21, loaded lazily by DWPOPOUT's party mode only |
| `butterchurn-presets.min.js` | butterchurn-presets | 2.4.7 | MIT | `136c746836aef6df` — fetched 2026-08-21, same lazy load |
| `LICENSE.butterchurn-presets.txt` | butterchurn-presets | 2.4.7 | MIT | `e5c204814d7119c9` — added 2026-09-03; fetched from jberg/butterchurn-presets and byte-identical to `LICENSE.butterchurn.txt` (same author, same year range), which is why it was easy to miss that it was never here |

`libflac.min.js` is used in BOTH directions since 0.7.2: the FLAC export
encoder (DWRENDER) and the decode fallback for browsers whose
`decodeAudioData` refuses FLAC (DWFLAC). Note its 24-bit write-callback
packing is 4 bytes per sample, not 3 — see `assets/deckwave-flac.js`.
`libflac.min.js` fetches `libflac.min.js.mem` from alongside itself at load
time. The two must stay in the same directory or the encoder silently fails to
initialise. libFLAC itself is BSD-style (Xiph); the JS wrapper is MIT. Both are
already recorded in NOTICE.

Full licence texts — **all six, one per vendored package**, because MIT and
BSD both require the notice to travel with the copy and a table row is not
the notice (the presets' text was missing until 2026-09-03; NOTICE's "MIT
per its repository" was the whole record):

| Licence text | Covers | sha256 (first 16) |
|---|---|---|
| `LICENSE.essentia.txt` | essentia.js (AGPL-3.0) | `8486a10c4393cee1` |
| `LICENSE.libflac.txt` | libflacjs + libFLAC (MIT / BSD-Xiph) | `7e3739ac49c0d469` |
| `LICENSE.soundtouch-processor.txt` | @soundtouchjs 2.1.1 (MPL-2.0, **in force**) | `753801acf995db08` |
| `LICENSE.soundtouch-worklet.txt` | @soundtouchjs 0.3.0 (LGPL-2.1, retained file) | `a1a33180d02960ab` |
| `LICENSE.butterchurn.txt` | butterchurn (MIT) | `e5c204814d7119c9` |
| `LICENSE.butterchurn-presets.txt` | butterchurn-presets (MIT) | `e5c204814d7119c9` |

The last two hash the same because they ARE the same text, fetched
separately from each repository and compared rather than copied across.

Licences are the `license` field of each package's own `package.json`, read at
fetch time, not copied from documentation.

## 2026-08-18 — upgraded to 2.1.1, because 0.3.0 drops samples

Not housekeeping. 0.3.0's `process()` is:

```js
this._pipe.inputBuffer.putSamples(samples, 0, leftInput.length);
this._pipe.process();
var processedSamples = new Float32Array(leftInput.length * 2);  // zero-filled
this._pipe.outputBuffer.receiveSamples(processedSamples, leftOutput.length);
```

It pushes 128 frames and assumes 128 come back. A time-stretcher works in much
larger internal windows, so it frequently has fewer ready — and everything
`receiveSamples` does not fill stays zero and is written to the output as
silence. In that build `receiveSamples` returns `undefined`, so the worklet
cannot even detect the underrun.

Measured against the vendored bytes, driven offline with 128-frame quanta of a
continuous sine, discarding the first 60 quanta as start-up:

| build | setting | silent output | gaps |
|---|---|---|---|
| 0.3.0 | tempo 1.00 | 0.08% | 0/sec |
| 0.3.0 | tempo 1.08 | **7.27%** | **10/sec** |
| 2.1.1 | idle | 0.09% | 0/sec |
| 2.1.1 | compensating 1.08x | **0.07%** | **0/sec** |

Ten ~7ms holes per second is an audible tick, and it only affects STRETCHED
decks — which is every deck except the first of a set and any jumped-to deck,
both of which run at rate 1.0. That asymmetry is what made it look like a
transition/phase problem for a day. See BUILD-LOG Act 21's confounded note.

**2.1.1 is not a drop-in.** It removed the `tempo` AudioParam entirely; the
params are `pitch`, `pitchSemitones`, `playbackRate`. The model inverted — the
SOURCE changes speed and the worklet compensates pitch, because the processor
computes `pitch * 2^(semitones/12) / playbackRate` internally. So `makeDeck`
sets `playbackRate` on both the source and the node and leaves `pitch` at 1;
setting `pitch` as well would compensate twice.

Verified in the browser against the vendored file: `addModule` OK, node
constructs, params are `[playbackRate, pitchSemitones, pitch]`, no `tempo`.

**Still unverified: how it SOUNDS.** The dropouts are gone by measurement. The
artifact character changes from time-stretch to pitch-shift, and that is an ear
question. 0.3.0 is retained on disk so the two can be A/B'd; nothing loads it.
RESOLVED 2026-09-01: both stay. They are what the upgrade replaced, the
table marks them NOT loaded, and this file's account of the mistake reads
against them. Keeping a superseded artefact beside the story of why it was
superseded is the house pattern.

## The SoundTouch version is not what the docs assumed

The README used to say MPL-2.0, and NOTICE said "MPL-2.0 (current versions)".
**That is not what the application loads.**

`deckwave.js` requests the *unpinned* URL
`cdn.jsdelivr.net/npm/@soundtouchjs/audio-worklet/dist/soundtouch-worklet.js`.
That path does not exist in the current release: 2.1.1 ships `.dist/` (dotted)
with the worklet named `soundtouch-processor.js`, and has no
`dist/soundtouch-worklet.js` at all. jsdelivr resolves the request to the
newest version that *does* have that path, which is **0.3.0**, and 0.3.0 is
**LGPL-2.1**.

Measured, not inferred — the bytes are identical:

```
unpinned URL      50293f0edbb91361cd679f76d92d1ad45fbb10745f00dc16a5907242aa0124f7
pinned @0.3.0     50293f0edbb91361cd679f76d92d1ad45fbb10745f00dc16a5907242aa0124f7
```

and the file's own header reads `SoundTouch Audio Worklet v0.3.0` under the
GNU Lesser General Public License v2.1.

So the obligation in force is LGPL-2.1, not MPL-2.0. The version pinned here
is 0.3.0 deliberately: it is what the application has actually been running,
and pinning anything else would change behaviour and licence together in one
undiscussed step. Moving to 2.x is a real decision — different licence,
different file layout, different processor name — and needs playback testing,
not a version bump.

This is the exact failure the old README warned about, sprung on the project
rather than avoided by it. An unpinned dependency did change the obligations.

**SUPERSEDED 2026-08-18 — read the two paragraphs above as history, not as
the state of the tree.** The upgrade that section called "a real decision"
was made: the Player loads `soundtouch-processor.js` **2.1.1, MPL-2.0**, and
0.3.0 is retained but never loaded. So **the obligation in force is MPL-2.0**,
as the table at the top of this file, `NOTICE` and
`LICENSE.soundtouch-processor.txt` all say. The sentence "the obligation in
force is LGPL-2.1" was true when written and is false now; it is left in
place because the investigation that produced it is the reason the pin
exists. Nothing loads from a CDN — see the closing section.

## 2026-08-21 — butterchurn, for the popout's party mode

Vendored for `assets/deckwave-popout.js` (the projector window's `party`
mode; keeper: *"go ahead with building the new features"*). Loaded LAZILY —
no script tag in index.html; DWPOPOUT injects both files the first time
party mode is selected, so a page that never opens the popout never
executes them. Provenance, stated because it matters: **butterchurn** is an
MIT WebGL reimplementation of Milkdrop 2, whose own source Nullsoft
released under BSD in 2013 — no Winamp-proprietary code involved.
**butterchurn-presets** is MIT per its repository, but the presets inside
are converted community Milkdrop presets by their original authors
(Flexi, martin, Geiss, …); the same set the Internet Archive's webamp
ships. That is well-precedented distribution, not a formal per-preset
grant — recorded here as the honest shape of it.

## Re-fetching

```bash
curl -O https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia-wasm.web.js
curl -O https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia.js-core.js
curl -O https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia-wasm.web.wasm
curl -O https://cdn.jsdelivr.net/npm/@soundtouchjs/audio-worklet@2.1.1/.dist/soundtouch-processor.js
curl -O https://cdn.jsdelivr.net/npm/@soundtouchjs/audio-worklet@0.3.0/dist/soundtouch-worklet.js
curl -o butterchurn.min.js https://unpkg.com/butterchurn@2.6.7/lib/butterchurn.min.js
curl -o butterchurn-presets.min.js https://unpkg.com/butterchurn-presets@2.4.7/lib/butterchurnPresets.min.js
```

Every URL carries an explicit version. None of them should ever be unpinned.
The dotted `.dist/` in the 2.1.1 path is genuinely the published layout — it
is the whole reason the old unpinned `/dist/` URL silently resolved to 0.3.0.

## The gap is CLOSED — these files are what the application loads

**This section previously said the opposite, and was stale from 2026-08-18
until 2026-08-30.** It claimed `bootEssentia()` "still injects the CDN copies
unconditionally", that both files "load twice", and that "the application is
still not offline-capable". All three are false, and together they read as a
denial of the privacy claim on the front page. Corrected here, with what is
actually true:

`ASSETS` in `deckwave.js` sets `base: 'vendor/'` and **`allowCDN: false`**.
Every asset resolves same-origin. The `CDN` table beside it is a documented
opt-in — `loadAsset()` and the worklet loader **throw** rather than reach the
network, and the only path that touches jsdelivr requires the maintainer to
set `DW.assets.allowCDN = true` by hand, which also logs a warning naming it
as remote code with no integrity check.

The worklet loads in three tiers, all local: the checked-in concatenated
`assets/deckwave-stretch.module.js`, then a `blob:` built from the vendored
text plus the wrapper, then the plain vendored `soundtouch-processor.js`.
Only after all three fail is the CDN considered, and only if opted in.

So the tree is offline-capable, and `README.md`'s claim — *"the page makes
exactly one kind of off-origin request and only when you ask for it"*
(`⊕ libre` and the ▶ demo) — holds as written.
