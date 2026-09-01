# Deckwave — Feature Roadmap

**v1.4 · 2026-08-19 (evening)** — competitive gap #1 BUILT as `build · phrase match`, unheard (Act 29); D10 added (grids with runs at another spacing, ledger 64). **v1.3 · 2026-08-19** — D1 closed, D6 half-closed, D3 answered with four harnesses, R11's `D` count corrected again (20), and a status line on each debt item touched by the 2026-08-19 review. **v1.2 · 2026-08-17** — R7 added, plus the carried-debt section.

Seven requested features, assessed for what each actually requires, what it unlocks, and where the risk sits. Ordered by dependency rather than by preference — several of these enable each other, and one of them changes what the product fundamentally is.

---

## The UI queue — 2026-08-30, from the audit

**`docs/UI-QUEUE.md`** holds what the three-agent UI audit found and did
NOT fix: four small items needing a decision, six structural ones needing a
policy, and a cosmetic list. Nine one-line fixes from the same audit landed
the same day (ledgers 114–117); this is the remainder.

It is a separate file rather than a debt letter here because it is a
snapshot of one sweep with falsifiers attached, not a standing feature
gap — and because the alternative was leaving it in a conversation, which
this project has already lost work to once.

**The two highest-value items, if only two are ever done:** the demo's
transport hold has a route around it and is re-entrant (and ▶ demo is the
entry point on deckwave.fm for anyone without a library), and the
transition monitor cannot tell *playing* from *never played* — it prints
`◉ PHASE LOCKED · periods match` about a transition no deck is making.

---

## R1 — Arbitrary cut points

**"Let the user choose where a track enters and leaves."**

The motivating case is precise: cutting cleanly between a remix and its canonical original, where the interesting material is not where the beat detector would choose.

**What exists.** The score already carries `entrySec` and `exitSec` per step. Today they are computed — entry at the first detected beat, exit at a downbeat near the target. **The data model already supports this feature; only the UI and the override flag are missing.**

**What it needs.** A waveform strip per track with draggable in and out markers, snapping to detected beats by default and free with a modifier held. Two new fields — `entryLocked` and `exitLocked` — so a rebuild honours the user's choice instead of recomputing it. The sequencer must respect locks when scoring transitions.

**Difficulty: low-moderate.** Mostly interface. The engine change is a conditional.

**Why it matters more than it looks.** It converts Deckwave from a system that decides *for* you into one you can argue with. Every automatic DJ tool that people actually keep using has an override.

---

## R2 — Curated score library

**"Ship pre-made sets."**

**The problem, stated plainly: a score is useless without the music it references.** A curated set built from one person's library resolves against nobody else's. This feature is close to inert on its own.

**It becomes powerful when paired with R3.** A curated set built entirely from freely-licensed music resolves for *everyone*, because the tracks can be fetched rather than owned. That combination is the actual feature.

**What it needs.** A manifest format for curated sets, a loader that reports what is missing rather than silently dropping it (the existing loader already does this), and a small catalogue.

**Difficulty: low**, once R3 exists. **Do not build this first.**

> **STATUS 2026-08-19, latest: FIRST FORM BUILT — the `▶ demo` button
> (BUILD-LOG Act 31), hours after R3, exactly as ordered above.** The
> manifest is an ordinary saved score whose steps carry libre `source`
> (`assets/demo-set.json`, the keeper's own first libre set — nine tracks
> opening with Stand Alone, which plays ALONE while the rest arrive; the
> keeper's design, and the keeper's pun). The loader reports what is
> missing rather than dropping it, as this entry asked. What R2 still
> wants beyond one shipped set: a catalogue of several, and a picker.
> UNHEARD as a demo; autoplay-after-fetch on WebKit is the open platform
> question (LISTENING §13).

---

## R3 — Stream freely-licensed audio from the internet

**"Take audio from Wikimedia Commons and similar."**

> **STATUS 2026-08-19 late: BUILT on the Internet Archive, seen playing in
> Chromium, UNHEARD — BUILD-LOG Act 30, LISTENING §13, `check-libre` 67.**
> `⊕ libre` on the dashboard (`assets/deckwave-libre.js`, `DWLIBRE`).
> Every "what it needs" below is answered: **CORS** — measured, not assumed:
> archive.org's search, metadata, download redirect and storage nodes all
> send `Access-Control-Allow-Origin: *`, and two tracks fetched from the
> Deckwave origin decoded to the metadata's exact length; **source
> abstraction** — `RemoteFile` honours the File contract (`name · size ·
> lastModified · arrayBuffer() · slice().arrayBuffer()`) and goes through
> `DW.ingest` unchanged, the cache key taking the Archive's own size/mtime
> so analysis persists across visits (seen: six tracks re-added after a
> reload with zero fetches); **attribution** — `meta.source` → score step
> `source` (additive, v1), `load()`, cue `REM ATTRIBUTION`, the card, the
> handover log line; the QUERY carries the licence filter so an unlicensed
> item is never offered, `-nd` is flagged; **bandwidth manners** — two in
> flight, spacing, 503 backoff, Cache API. **The store is NOT Commons:**
> Commons passes the same CORS test and holds almost no beat-driven music;
> the Archive holds 4,040 licensed releases under the chiptune subjects and
> 689 chip-tagged netlabel releases. Jamendo and FMA file hosts are
> CORS-open but discovery needs a key on each — not wired. Mod Archive is
> modules, not audio. **The "realistic caveat" stands unmeasured:** how the
> Archive's material fares in the pool gate is the ear's and the gate's to
> say. Human estimate below was 2–3 weeks; the build was one evening, the
> listening is still ahead.

**This is the largest feature on the list and it changes what the product is.** Today Deckwave requires you to already own a music library and be on Chromium. With libre audio sources it works for someone who owns nothing, on first visit, with no folder picker — which also happens to be the path around every iOS limitation identified in the mobile research.

**What it needs, in order:**

**CORS.** Fetching audio cross-origin and passing it to `decodeAudioData` requires permissive CORS headers. Wikimedia Commons is generally well-behaved here, but **this must be tested before anything is designed around it** — it is the single assumption the feature rests on, and this project's record on untested assumptions is not good.

**A source abstraction.** The corpus currently assumes a `File`. It needs to accept a fetched `ArrayBuffer` with equal standing, so analysis, caching and playback do not care where bytes came from.

**Attribution as a first-class field.** Commons audio carries licence terms — CC BY, CC BY-SA, public domain — and most require attribution. **The score format must carry licence and attribution per track, and the interface must display it.** This is not optional politeness; it is licence compliance, and getting it wrong turns a free-culture feature into an infringement.

**Bandwidth manners.** Fetching hundreds of files from a volunteer-funded project needs rate limiting, caching, and a descriptive User-Agent. Commons is not a CDN.

**Realistic caveat on the material.** Commons audio is deep in classical, spoken word, field recordings and historical material, and thin in the beat-driven electronic music this sequencer was tuned for. Expect the beat detector to struggle — every threshold was tuned against one chiptune catalogue. **This may work better as a demo mode than a primary use.** Also worth surveying: the Free Music Archive, Jamendo, ccMixter, and Internet Archive's netlabel collections, which have more rhythmic material.

**Difficulty: high.** Two to three weeks. Highest value on the list.

### SoundCloud — measured 2026-08-20, and the answer is no

Keeper asked about streaming direct from SoundCloud (the test link was
epigenetics — *inside all of us*). Measured against that track's own public
page rather than argued:

- **The audio is unreachable.** The only audio the page names is HLS AAC
  transcodings behind `api-v2.soundcloud.com`, and that host answers
  **401 Unauthorized** without a client key. API keys are gated behind an
  application process that has been closed or case-by-case for years; the
  web player works because SoundCloud's own JS ships a key, and extracting
  it is scraping their ToS prohibits. There is no CORS-open byte endpoint.
- **The one open door is the wrong shape.** `soundcloud.com/oembed` answers
  with `access-control-allow-origin: *` — and returns an IFRAME widget.
  Audio inside a cross-origin iframe gives this engine zero sample access:
  no analysis, no beat grid, no stretch, no EQ, no beatmatch. A widget
  track could sit NEXT to a set ("listen on SoundCloud"), never in one.
- **This track's own terms say no anyway.** `license:
  all-rights-reserved`, `downloadable: false`, `policy: MONETIZE`
  (ad-supported) — fetching its bytes would bypass both the artist's terms
  and the ads that pay them. Compare the Archive path R3 shipped: the
  licence field IS the search filter, and the download endpoint is the
  product.

**What works instead, today:** artists who enable downloads on SoundCloud
(many do) — download the file and drop it in the library like any other
track.

### Jamendo, ccMixter, Wikimedia Commons — measured 2026-08-20, same day

The two-minute measurement the Archive got, run on the three candidates —
headers first, then the decisive test: a real `fetch` + `decodeAudioData`
from the Deckwave origin in Chromium.

- **Jamendo: GREEN, one key away — and it is ONE key for the whole app**
  (an application credential, meant to be public in client-side code;
  every user shares its rate bucket; it ships in the repo at launch;
  registering it is the keeper's act). Measurement: `api.jamendo.com` answers with
  `access-control-allow-origin: *` (metadata needs a free `client_id`;
  the dev portal is alive and registration is a form, unlike SoundCloud's
  closed process — the keeper would register, not this project's code).
  The audio storage (`prod-*.storage.jamendo.com`) echoes the requesting
  origin, and a track fetched end-to-end from our origin DECODED: 3.3 MB
  MP3 → 272 s stereo in 3.3 s. Whole catalogue is CC-licensed with the
  licence URL per track in the API. The measured fetch used a site-signed
  URL; the sustainable path is API-issued stream/download URLs, which is
  what the key buys. Terms: free tier is rate-limited and non-commercial —
  fits the project's zero-monetisation posture; read them properly before
  shipping a button.
- **Wikimedia Commons: GREEN — and WIRED the next day** (BUILD-LOG Act
  32): a source select in the ⊕ libre panel; a hit is one file, fetched
  through the same pipeline with full attribution. A CC0 Opus went
  search → fetch → decode → beat grid live. The WebKit caveat is recorded
  where the code is: Ogg/Opus does not decode on an iPhone; MP3/WAV/FLAC
  does. Original measurement: The search
  API is CORS-open (`origin=*`), the licence is a first-class field
  (`extmetadata.LicenseShortName`), and `upload.wikimedia.org` serves
  audio with `access-control-allow-origin: *` and Range support. Both a
  CC0 WAV and a CC0 **Opus** file fetched and decoded from our origin.
  R3's caveat about material stands, but the first search ("chiptune")
  returned actual CC0 game music, which is more promising than the
  classical-and-spoken-word expectation. Needs the polite User-Agent and
  bandwidth manners R3 already specifies.
- **ccMixter: RED on CORS, a pity.** The metadata API is open, keyless,
  and rich — licence URL and name per upload, even a `bpm` tag — but no
  `access-control-allow-origin` comes back for an arbitrary origin
  (`Vary: Origin` with no grant), the file host 403s non-browser
  fetches, and the in-browser fetch from our origin failed as CORS
  predicts. Nothing to build against until their headers change; worth
  re-measuring occasionally, since the API is otherwise the best-shaped
  of the three.

---

## R4 — Custom score input and submission

**"A box to paste your own JSON, and a way to send it to me as a suggestion."**

**Input half: trivial.** A textarea, `JSON.parse`, validate against the schema, load. An hour's work. Validation should be strict and the errors should be legible — a bad paste must say *what* is wrong.

**Submission half: the interesting design problem.** The moment you accept submissions you have a moderation and hosting obligation.

**The cheapest sound answer: submit as a GitHub issue.** A pre-filled issue URL with the score in the body means GitHub hosts it, GitHub moderates it, the submitter needs no account with you, and you get a queue with history for free. No database, no storage, no abuse handling.

**Difficulty: low.** The design instinct here is the same one behind R6, and it is right.

---

## R5 — Lyrics

**"Stream lyrics where available."**

**This is the one with a genuine legal dimension and it should be handled deliberately.**

Lyrics are copyrighted separately from recordings. Commercial players licence them through Musixmatch or LyricFind, and those deals are not available at hobby scale. **LRCLIB** is the community-sourced, free, no-key option with time-synced lyrics and is what most independent players use — but it is user-contributed, which means its own provenance is not clean, and building a paid product on it carries real risk.

**Two honest positions:**

The safer one — **display lyrics only where the source is licensed for it**, which in practice means public domain works and material the artist has released openly. This fits naturally with R3: if the audio is freely licensed, associated text often is too.

The pragmatic one — **fetch from LRCLIB, display, do not store, do not include in any paid tier.** This is what a great many players do. It is not risk-free and the plan should say so rather than pretend.

**Recommendation: defer.** It is the lowest-value item here relative to its risk, and it becomes materially safer after R3 makes the corpus licence-aware.

**Difficulty: low technically, moderate legally.**

---

## R6 — Share and load scores via paste services

**"Push and pull JSONs to pastebin or similar — so the deck never needs a trust and safety layer."**

**This is the best architectural decision on the list and the reasoning behind it is exactly right.**

Hosting user content means moderating user content. Moderating means abuse reports, takedowns, a policy, and eventually a person. **Externalising the hosting externalises the entire obligation** — Deckwave becomes a client that reads a URL, and the paste service remains responsible for what is on it, as it already is.

**What it needs.** A share action that POSTs the score to a paste service and returns a URL; a load action that accepts a URL, fetches, validates and loads. **CORS again is the constraint** — many paste services allow POST but not cross-origin GET, so the read path needs testing per service, and a fallback of "copy this text" is required rather than optional.

**Worth considering:** GitHub Gist has a documented API, permissive CORS, and versioning; it is a better technical fit than most paste sites. The tradeoff is that it wants an account.

**The principle deserves recording as a project rule:** *prefer designs where someone else already carries the obligation.*

**Difficulty: low-moderate.** Mostly CORS testing.

---

## Sequence

```
1. R1  arbitrary cut points        ← low effort, high daily value
2. R4  custom JSON in + submit     ← an afternoon; unblocks feedback
3. R11 custom tile from a spec     ← reuses R4's paste+validate; interpreter is the work
4. R6  share/load via paste        ← test CORS first
5. R3  libre audio sources         ← the big one; changes the product
6. R2  curated sets                ← trivial once R3 lands
7. R5  lyrics                      ← defer; safest after R3
```

R7 (other audio formats) does not sit in that chain. Its first two steps —
wiring up the FLAC tag reader that already exists, and WAV export — are small,
independent, and improve things that are already there rather than adding
surface area. Do them whenever; they block nothing and nothing blocks them.

R8, R9 and R10 form a second chain that touches none of the above:

```
1. R8   second screen              ← transport + a measured frame budget
2. R9   listen party, same room    ← ~a day once R8 exists
3. R10  listen party, remote       ← sends nothing; mostly session/product work
```

**They depend on listen mode, not on the deck**, which is why they are
independent of R3 and can be built in any gap. R9 is the one with the best
ratio on this page: the capture exists, the panels exist, and the transport is
already R8's.

**R3 is the pivot.** It removes the "bring your own library" requirement, sidesteps the iOS file-access problem entirely, makes curated sets meaningful, and turns a first visit from a folder picker into music playing. Everything else on this list is an improvement to a tool people already have. **R3 changes who can use it at all.**

---

## Cross-cutting: the score format has to grow

Four of these features add fields:

| Feature | New in the score |
|---|---|
| R1 | `entryLocked`, `exitLocked` |
| R3 | `source`, `url`, `licence`, `attribution` |
| R2 | set-level `title`, `curator`, `description` |
| R6 | `shareId`, `sharedAt` |

**Version the format now, before any of this ships.** It already carries `"version": 1`. A loader that reads v1 and v2 is easy to write today and painful to retrofit once scores exist in the wild. **A file format with users is a promise.**

---

## R7 — Other audio formats

**"Support more than what it takes now."**

This looks like one feature and is three, with different difficulty, different value, and only one of them worth doing first.

**What exists.** Scanning accepts six extensions — `flac`, `mp3`, `wav`, `aiff`, `m4a`, `ogg` ([deckwave.js:187](../assets/deckwave.js)). Decoding is `decodeAudioData`, so the browser decides what actually works, not Deckwave. Tag reading is FLAC only. Export is FLAC only, 16-bit.

### 7a — Input decoding

Adding extensions to the regex is one line. The real question is what Chromium will decode, and that is not a Deckwave decision. A failed decode currently counts as `failed` in the scan summary and the track is dropped — which is honest but uninformative: you get a number, not a reason.

**What it needs:** a decode failure that reports *why* — unsupported codec, corrupt file, DRM — rather than a tally. That is the useful change, and it is small.

**Difficulty: low.** Value is mostly diagnostic.

### 7b — Tags beyond FLAC, and the reason this is first

**This is the one worth doing, and it fixes something already broken rather than adding surface area.**

`DWTAGS` reads real artist/album/title from FLAC — and **nothing calls it.** It is loaded on every page and never invoked, so every name in the interface is still derived from the filename.

That has a consequence beyond display. `dedupe()` keys off filename string-munging — strip the artist prefix, strip the leading track number, lowercase, remove punctuation. On the 2026-08-17 corpus that collapsed 364 entries to 172, and **nobody can audit whether it collapsed the right ones**, because the key is a guess about filename shape. Real tags make dedupe a comparison of actual titles instead.

**What it needs:**
- Wire up the FLAC reader that already exists. Free; it is written.
- **MP3 / ID3v2** — a separate parser, the most common case in most libraries.
- **MP4 / M4A** — atom walking, different again.
- **Ogg / Opus** — Vorbis comments, so most of the FLAC path is reusable.

**Difficulty: low to wire, moderate per additional container.** Do the wiring first and see whether FLAC alone is enough for this library before writing three parsers.

### 7c — Export formats

Render writes FLAC 16-bit. **WAV needs no encoder at all** — write a 44-byte header in front of the PCM, which the renderer already produces. That is an afternoon and it removes a dependency rather than adding one.

MP3 or Opus means another vendored encoder, another licence to pin and record, and in LAME's case a patent history worth reading before shipping. Given how the SoundTouch pin turned out, **do not add an encoder without checking what the URL actually resolves to.**

**Difficulty: WAV low, lossy formats moderate — and mostly a licensing question rather than a technical one.**

### Sequence within R7

**7b wiring → 7c WAV → 7a diagnostics → 7b parsers → 7c lossy.** The first two are small and immediately useful. The rest is only worth it once you know what the library actually contains.

### Caveat carried from the build log

Every threshold in the analysis chain was tuned against one artist's chiptune catalogue. Formats travel with material — adding MP3 support in practice means adding *different music*, and the sample-size lesson applies: a detector verdict measured on one album is not a verdict. Expect confidence figures to move, and read them as a fresh measurement rather than a regression.

---

## R8 — Second screen: the phone as a remote visualiser

**"Can I reach it from my phone?"** Reachable, yes — `--lan` serves HTTPS on
8443 and the certificate already covers the LAN address. Useful, no: the phone
cannot pick a folder, so it has nothing to play.

**But rendering needs none of the APIs that are blocked.** The desktop keeps
the library, the decoding, the analysis and the audio. The phone receives the
per-frame bundle over the network and draws. That asymmetry is what makes this
worth building, and it is the ONE mobile use that works today rather than
after R3.

**The architecture already fits, which is the unusual part.** A panel is
`draw(c, w, h, T, D)` — a canvas, a size, a theme and a bundle. It reaches
into no engine state. So a panel drawing from a bundle that arrived over a
socket is the same panel drawing from a bundle built locally, with no changes
to any of the fifteen. The registry contract, written for swappable cells,
turns out to describe a remote client as well.

**What it needs:**

**A broadcast channel.** WebSocket or SSE from the desktop. The dev server is
`http.server` and does not speak either, so this is the one real piece of new
plumbing.

**A budget, measured before it is designed.** The bundle carries `wave` (2048
bytes) and `freq` (1024) per frame. At 60fps that is roughly 180 KB/s before
anything else, which is fine on a LAN and wasteful anyway. Sending at the
history buffer's 10Hz, or sending decimated arrays, is almost certainly
enough — **but "almost certainly" is how four thresholds got set wrong in this
project. Measure what a panel actually needs before choosing a rate.**

**Guards on what a second screen may do.** A viewer should not be able to
drive the deck. Read-only unless there is an explicit reason otherwise.

**iOS specifics, since this is the platform that motivated it.** Every browser
on iOS is WebKit, so browser choice changes nothing:

| Capability | iOS | Consequence |
|---|---|---|
| File System Access API (`showDirectoryPicker`) | **No, and not planned** | No folder WALK — but see the next two rows |
| `<input type="file" webkitdirectory>` | **Yes from iOS 18.4** (WebKit bug 271705, fixed 2024-10-04, shipped 18.4 — checked 2026-08-19) | A whole folder CAN be picked from the Files app on current iOS. Deckwave uses it since 0.7.2 |
| `<input type="file" multiple>` | **Yes** — reaches the Files app | Individual tracks CAN be loaded, unlike Android's story |
| `getDisplayMedia` | **No** | No tab or system audio capture |
| `getUserMedia` (microphone) | Yes | Mic-driven visuals work |
| Web Audio, AudioWorklet, WASM, canvas | Yes | Rendering and playback are not the obstacle |

So a second screen works on an iPhone **because it only renders**. It needs
none of the blocked APIs.

**Untested and load-bearing if anyone tries local files on iOS instead:**
whether Safari's `decodeAudioData` handles FLAC, and whether iOS memory limits
survive a decoded track plus the whole-track mono copy the analyser now builds.
A six-minute FLAC decodes to roughly 180MB; iOS kills tabs for less. **Assume
this does not work until someone measures it.**

**Status 2026-08-19 — see "iOS, what is solved and what is not" below.** The
FLAC question no longer rests on Safari: a libflac fallback decodes whatever
the browser refuses, and it has been measured against Chromium's decoder. The
memory question is structurally better and still unmeasured on a device.

**Relationship to R3.** Streaming makes the phone a first-class client rather
than a mirror — no local files, no folder picker, nothing to send from the
desktop. R3 already identifies itself as the way around the iOS limits. R8 is
the cheaper, narrower version that is useful before R3 lands, and stays useful
after it as a way to put the instrument on a second screen while filming.

**Difficulty: medium.** The panels need no changes; the transport and the rate
budget are the work. Two to four days.

---

## iOS, what is solved and what is not — 2026-08-19

The keeper asked for the iOS roadblocks to be looked into. Each one below
says what was done, how it was checked, and what is still only a claim.

**1. "The phone cannot pick a folder, so it has nothing to play." — SOLVED
for iOS 18.4+, degraded below it.** `webkitdirectory` on `<input type=file>`
now works on iOS (WebKit bug 271705, fixed 2024-10-04, in Safari 18.4 — the
roadmap's "No, and not planned" was about `showDirectoryPicker`, which is
still true and no longer matters). `DW.scan` / `LIB.pick` / `DW.addFiles` fall
back to file inputs when the File System Access API is absent; the pickers
open synchronously inside the click and Essentia boots afterwards, because
WebKit spends the gesture on an `await`. Below 18.4 the folder picker shows
the file multi-select instead. **Checked:** the fallback code path exists
and `DW.platform` reports `folderInput`; the picker itself cannot be driven
by automation and has not been clicked on an iPhone.

**2. "Whether Safari's decodeAudioData handles FLAC" — MADE IRRELEVANT.**
Native first; if it refuses a FLAC, `DWFLAC` decodes with the vendored
libflac and resamples to the context rate. Measured: Node against the cache
(RMS within 0.006% on 16-bit, 24-bit, 48 kHz), Chromium with native forced
to refuse (same sample count, worst diff 2.95e-5 = one 16-bit LSB), a full
ingest through the fallback (WALKMAN's cached RMS to five places, 128 bpm,
7A). **Caught on the way:** libflac.js packs 24-bit as 4-byte int32 — a
3-byte read was 15–39% off and the harness refused it. Cost: ~1.8 s for a
3-minute track, yielding through a MessageChannel so a hidden tab does not
throttle it to minutes.

**3. "Whether iOS memory limits survive a decoded track plus the whole-track
mono" — MEASURED 2026-08-19: IT SURVIVES, on one device.** Keeper, iPhone 16
Pro Max, iOS 26.6, Safari: the whole 189-track library — pulled onto the phone
via `serve.py --music` as one zip, unpacked in Files, picked as a folder
through the iOS 18.4+ `webkitdirectory` picker ("navigate in, then Open") —
analysed to completion, including the 507 s track. Interrupted many times by
force-of-habit screen locks and resumed each time from the per-track cache,
which is the property that made it finish at all; the scan now holds a wake
lock (`DWPHONE.hold`) so the next one will not need babysitting. **And then it
played** — *"OMG THE PHONE PLAYS"* — so the worklet, the decode path and the
deck all run on WebKit. **Answered the same evening:** `◎ audit set` on the phone said *86/86
playable · none failed* with no "via libflac" suffix — **Safari on iOS 26.6
decodes this library's FLAC natively**, so `DWFLAC` was never reached there.
It stays, for the browser that refuses. Scan time net of interruptions is
still unknown. **New on the phone: popping during playback** — the keeper's
words, *"a new place to debug popping, yay"*. Open. The discriminator from
Act 21 applies unchanged: does the FIRST track (rate 1.0) pop, or only a
chained (stretched) deck? One answer points at the worklet's CPU on the phone
(underruns — `latencyHint: 'playback'` is now set on phones as the cheap
first move, its falsifier being that same ear), the other somewhere else. The
play log line now prints the context's real sample rate and buffer so the
report can carry them. One device, one library;
the 851 MB Chromium peak still has no WebKit counterpart because Safari has
no gauge — the tab surviving is the measurement.

What was written before that run, kept for the record: IMPROVED BY
CONSTRUCTION, UNMEASURED ON A DEVICE.** The analyser now
drops the decoded AudioBuffer before the first WASM allocation, builds the
excerpt as a slice of the whole-track mono (bit-identical to the old
per-channel loop — the numbers cannot move), and drops the whole-track mono
before the key pass. What is live at the rhythm peak is now mono + its WASM
copy + Essentia's internals, not those plus stereo float plus the excerpt and
its copy. On the 507 s track that is roughly 220 MB less JS-side memory by
arithmetic; the decoded buffer's release depends on GC and was not measured.
**Nobody has run this on an iPhone, and the 851 MB Chromium peak was never
re-measured after the change.** The honest next step is one iPhone, one long
track, and Safari's memory gauge.

**4. The boot gate — SOLVED.** `index.html` asks for WebAssembly and
AudioWorklet, not for `showDirectoryPicker`, and logs what this browser will
and will not do. Firefox and desktop Safari walk in too.

**Not solved, and not attempted:**

- **No tab/system capture on iOS.** `getDisplayMedia` does not exist there;
  listen mode says so. Mic capture works.
- **Screen lock suspends the AudioContext on WebKit.** A set on a phone stops
  when the screen locks. The known workaround (a looping silent `<audio>`
  element to hold the media session) is a hack with its own failure modes and
  was not added without someone to hear it.
- **Safari evicts site storage after seven days without a visit** unless the
  page is added to the home screen — the analysis cache can vanish. `▾ save
  cache` (D1) is the mitigation and now exists.
- **The layout on a phone** is D4's problem and was not touched; `1 column`
  exists in the layout menu.
- **Secure context:** `--lan` serves HTTPS with a self-signed cert; the phone
  must accept it once.

## Android — 2026-08-19

The keeper: *"What about android?"* The roadmap had one aside ("unlike
Android's story") and nothing behind it. Read from MDN browser-compat-data on
the day, not from memory:

| Capability | Android | Consequence |
|---|---|---|
| File System Access API (`showDirectoryPicker`, `showOpenFilePicker`, drop handles) | **Chrome for Android 132+** (also Samsung Internet / WebView on that Chromium) | Current Android Chrome takes the DESKTOP path — one folder pick walks the tree. No fallback involved |
| `<input type="file" webkitdirectory>` | **132+.** Before 131: the property exists, the picker shows files only. **131: choosing a directory crashes the browser** (crbug 376834374) | The 0.7.2 fallback would have offered exactly that on 131. `folderInputUsable()` now refuses `webkitdirectory` on Chrome/NN < 132 when the UA says Android, and the scan degrades to a files multi-select, saying so on the log line |
| `<input type="file" multiple>` | Yes | Tracks from the system picker on any version |
| `getDisplayMedia` | **No** on any Android browser (Chrome exposed it 72–88 and always failed) | No listen mode for tabs or system audio; mic capture works |
| `getUserMedia` | Yes | Mic-driven visuals work |
| Web Audio, AudioWorklet, WASM | Yes (Chrome 66+, Firefox 76+) | Playback and analysis are not the obstacle |
| Background playback | Chrome keeps Web Audio running with the screen off since 106, subject to the OS battery-optimisation setting for Chrome | Unlike WebKit, a set on a phone can keep going — untested here |
| FLAC decode | Chromium's media stack, same as desktop | Native; the libflac fallback is there if a device's build refuses |
| Firefox Android | `webkitdirectory` from 142; no FS Access | Files multi-select below 142; folder pick from 142 |

**So Android is the easier phone.** On Chrome 132+ nothing degrades except
listen mode. The two honest unknowns are the same as iOS's: analyser peak
memory on a low-end device (structurally smaller since 0.7.2, never measured
on a phone) and the layout (D4). Nothing has run on an Android device.

**Checked:** `folderInputUsable()` against six real UA strings (Chrome Android
131 → files, 132 → folder, Samsung Internet on Chromium 130 → files, desktop
Chrome / iOS 18.4 / Firefox → folder); `DW.platform` now reports `android`
and `chromium` version. **Not checked:** any of it on a device.

**2026-08-21 — IT HAS RUN ON A DEVICE.** First Android session over the LAN
server. Two findings the same hour: **an incoming phone call did NOT pause
the set** — a bare Web Audio graph holds no Android audio focus, so the OS
has nothing to pause (iOS never showed this because WebKit interrupts the
AudioContext itself, heard on the iPhone) — and the UI is confusing on a
phone (D4, known). The call fix is BUILT the same day (ledger 71, LISTENING
§14): DWPHONE `calls`, ON by default — the silent loop from `controls` holds
audio focus for the page, Chrome pausing it at the ring / resuming at
hang-up drives `DW.pause()`; `call pauses the set: on/off` in ⚙; armed
inside the ▶ gesture. **[INFERRED]** until a real call is received mid-set.

## D4 has a SPEC now - 2026-08-22

The first-run UX went through a design pass: a canvas at
claude.ai/code/artifact/d607e794-5196-43e4-a545-95d5def95c91 with four
artboards in the deck own vocabulary - the current 41-control wall as
the anchor, a first-run card (hear it now / scan / skip, privacy line as
primary copy), a guided transport whose steps derive from state that
already exists (corpus.length, dash.set.length, DW.state.of), and panel
empty-state lines. Working sources in _design/*.dc.html. The keeper edits
the canvas; the saved artboards are the implementation contract.
Implementation is POST-LAUNCH unless the keeper says otherwise - it is
display-layer only, but launch is in two days and the tree is calm.

## The walkthrough voice preset - LOCKED by ear, 2026-08-23

An hour of live A/B through the feed settled it: **dial 4 (cruise 0.4) ·
boost on · overdrive 1.45 · voice Karen**. All device-persisted
(localStorage), re-tunable by voiceCfg lines. CARRIED DEBT from the
session: the OVERDRIVE is a live experiment through the _dev seam (the
bridge raises master gain over unity during speech, through the
compressor) - it should LAND as a proper engine API post-launch (a
deliberate clamp decision on Player.volume or a speechGain parameter),
after which the _dev reach in extensions/recon/recon-app.js goes away.
Facts under it: ledgers 74 (OS ducks around synthesis, no lever) and 75
(utterance.volume silences iOS outright). Bonus [CONFIRMED] the same
minute: AirPods tap pause/resume works against the deck - a real-world
interruption handled natively by the playback session.

## Accessibility Reader STOPS the music - measured 2026-08-22, keeper's device

CORRECTION to the section below: the keeper meant iOS's Accessibility
Reader (the reading mode, new in iOS 26), NOT VoiceOver - and the ducking
answer below applies to VoiceOver only ("the ducking setting is under
VoiceOver, not accessibility reader"). Measured on the device: **the
Accessibility Reader INTERRUPTS the Web Audio graph - the music stops -
on either setting** (both tested phone modes are the playback category).
Not ducking: a full interruption, like a call.

SECOND MEASUREMENT, same day: **Speak Selection (highlight text > Speak,
Spoken Content) DUCKS the music heavily but the set SURVIVES** - so the
two speech paths differ: Speak Selection coexists, the Accessibility
Reader kills. Read-aloud-with-soundtrack guidance on iOS is therefore
highlight-and-Speak. The duck depth has NO user setting for Spoken
Content (the VoiceOver Ducking Amount slider, 0-100% since iOS 18,
governs VoiceOver only); the workable lever is Deckwave's own LEVEL -
the system duck is multiplicative, so a louder base leaves more music
under the voice.

The ONE discriminating test left, from WebKit's own source (the
deckwave-phone.js header): with `phone: off`, Web Audio alone runs in the
AmbientSound category, which MIXES with other audio. So: phone mode OFF,
play a set, invoke the Reader.
- Music continues -> the lever exists (ambient survives spoken audio) and
  the fix is a documented mode choice or an auto-drop-to-ambient while
  reading (silent-switch mutes ambient and it dies at lock - a real
  trade, the keeper's call).
- Music still stops -> the interruption is category-blind, the page has
  NO lever, and this is recorded as a platform limit, honestly - reading
  and listening on iOS are exclusive until Apple says otherwise.

## VoiceOver and the music — asked 2026-08-22

Keeper: "Is it possible to let the music play over the accessibility
reader in iOS?" Answer, from the platform rather than the device: iOS
DUCKS other audio under VoiceOver speech rather than stopping it, and
`phone: background audio` already puts the page in the MediaPlayback
category that ducking applies to - so the set should continue, lowered,
through narration. Full volume under speech is the LISTENER'S switch
(Settings > Accessibility > VoiceOver > Audio > Audio Ducking, off), and
no web API overrides it - by design; a page should not out-shout a screen
reader. `ambient` is not a lever (mixes with apps, loses background,
silent-switch muted). UNVERIFIED on the device: whether a Web Audio graph
specifically is ducked or interrupted under VO - one triple-click test;
if it pauses instead of ducking, that is a ledger row.

## Background play — 2026-08-19

Keeper: *"What unlocks background play? Spotify gets it."*

**What Spotify has that a web page does not:** it is a native app with the
`audio` background mode, so the OS keeps its audio session alive with the
screen locked. A web page gets one narrow version of that grant: **a playing
HTMLMediaElement.** Established, not argued — the Tone.js threads going back
to 2017 end the same way every time: *"Howler with `html5:true` is using the
`<audio>` tag instead of Web Audio, which is probably why it's able to play on
the locked screen"*, and WebKit's own position (2025) is that Web Audio and
WebRTC are suspended at lock, full stop. Chrome for Android keeps Web Audio
running with the screen off on its own (since 106, subject to the battery
setting for Chrome).

Deckwave's mix is a Web Audio graph — two decks, a worklet, filters, a
compressor — so on iOS it stops at lock. Two things can be done about that
from a web page, and both are built, behind one `phone:` select in the
transport, OFF by default, in `assets/deckwave-phone.js`:

- **`keep screen on`** — a Screen Wake Lock (Safari 16.4+, Chrome 84+) held
  while a set plays, re-taken when the page comes back. The mechanism is real
  and boring: nothing suspends because nothing locks. Costs battery. **This is
  the honest answer today** on iOS.
- **`lock-screen audio`** (experimental) — the compressor feeds a
  `MediaStreamAudioDestinationNode` INSTEAD of the speakers
  (`DW.outputStream(true)`), and a hidden `<audio>` element plays that stream,
  with Media Session metadata (title, artist, bpm) and lock-screen buttons
  (pause, next, previous → `DW.pause/skip/back`). Nothing in the signal path
  changes — the analyser tap sits upstream on `master` — only which sink hears
  the mix. **Whether WebKit keeps the graph FEEDING the element alive once the
  screen locks is not established anywhere I could find**, and that is the
  whole question. **The falsifier:** lock an iPhone with this on and a set
  playing; if the music survives one handover (a new title on the lock
  screen), the graph survived; if it stops within seconds, it did not, and
  `keep screen on` is the answer.

**RESULT ON THE DEVICE, 2026-08-19, iPhone 16 Pro Max / iOS 26.6: `lock-screen
audio` FELL.** Keeper: *"it just keeps repeating a sound"* — the element
looping a short buffer, i.e. the graph behind it stopped. The falsifier was
stated in advance and this is it falling; the option is out of the transport
(still callable as `DWPHONE.set('media')` for a later iOS) and **`keep screen
on` is the answer on iOS.** Chromium wiring had checked out before the run
(1 audio track on the element, `DW.outputVia === 'stream'`); the failure is
WebKit's, not the plumbing's.
**Not checked:** any of it on a phone, and whether the stream path audibly
differs from the speaker path (it should not — PCM either way — but a
MediaStream sink adds its own buffering, which a DJ ear might notice as
latency on the transport, never as sound).

**SECOND RUN, 2026-08-19, evening — read the source instead of guessing.**
WebKit's `AudioContext::shouldOverrideBackgroundPlaybackRestriction()`
(Source/WebCore/Modules/webaudio/AudioContext.cpp) returns true for the
`EnteringBackground` interruption — which is what Web Audio gets at lock on
iOS, there being no under-lock restriction on it in
`MediaSessionManagerIOS.mm` — **when `navigator.audioSession.type` is
`'playback'` or `'play-and-record'`.** Landed 2024-03-01 (b848143a2a, bug
261554) with a layout test that asserts exactly this. The same commit makes
the context Now Playing eligible (lock-screen card from
`navigator.mediaSession.metadata`, native play/pause; next/previous are not
routed to JS for a Web Audio session) and, per
`MediaSessionManagerCocoa.mm`, moves the audio session from AmbientSound to
MediaPlayback, so it also plays through the silent switch. The API is on by
default in WebKit on every Cocoa platform; Chromium does not have it.

So: **`phone: background audio`** — sets the type, keeps the speakers path,
registers play/pause only. `assets/deckwave-phone.js` carries the citations;
`tools/check-phone.js` (25) checks the plumbing. **NOT YET RUN ON A DEVICE.
Falsifier, LISTENING §8:** lock mid-set; a NEW title on the lock screen
means both the graph and the planner survived; silence within seconds means
the override is not honoured here and `keep screen on` stays the answer; the
current track playing out and then dying means the graph lived and
`chain()`'s timer did not fire in time — a different fix. BUILD-LOG Act 28.

**Lock-screen art, same evening.** `lock art:` — `poster` (set journey +
title strip, once per track) or `live` (a chosen panel redrawn once a
second and re-sent as `MediaMetadata.artwork`). The card is the only pixel
surface a web page gets on a locked iPhone; whether it repaints at 1 Hz is
the experiment — LISTENING §9. `DWLOOP.sample()`/`.last` exist for it.
Checked in Chromium on a synthetic set; not seen on a phone.

**Lock-screen controls, same evening.** `phone: background + lock
controls` — a silent 30 s WAV loop in a media element becomes the Now
Playing session (WebKit routes ▶▶/◀◀ to JS handlers only for media
elements; floor 0.95 s, `MediaElementSession.cpp`), so the card gets
working ▶▶ (a blend — `next` blends since today, ledger 62), ◀◀, ❚❚/▶ and a
scrubber from `setPositionState`. The graph survives lock on the audioSession
override as before; the element is only the handle. Own mode, so the
confirmed `background audio` is untouched. Chromium-checked; LISTENING §10.

**Side-finding from the same read:** WebKit ignores `latencyHint`
(`AudioContext::create` — `// FIXME: Figure out where latencyHint should
go.`; the Cocoa session manager pins the hardware buffer to the 128-frame
render quantum when Web Audio is present), so the `'playback'` hint set on
phones after the popping report was inert on iOS. Recorded in LISTENING §7;
nothing moved.

**What would get the rest of the way:** render the set to a file (the score
is deterministic data) and play THAT through an `<audio>` element — then the
phone does nothing a media player cannot, background play is a given, and
steering is gone. That is a different product and it is not built. A native
wrapper would get background audio only with its own native playback path;
WKWebView plus the `audio` background mode has a years-long thread of
"stops in the background" behind it.

## R9 — Listen party, same room: one capture, many screens

**"Could I join a listen party using my phone and my pc and then we play the
Spotify synced?"** In one room, yes, and it is close to free once R8 exists.

Spotify plays on the PC. Listen mode captures the system output — already
built, already measured. The PC broadcasts the frame bundle; the phone and any
other screen render it.

**Sync is not a feature here, it is a consequence.** There is one capture and
one bundle, so every screen is drawing the same frame. No clock alignment, no
drift correction, no timestamp negotiation — just LAN latency of roughly
5–20ms, which is invisible for visuals. Each additional device is another
renderer, never another listener.

**What a listen party does NOT get, and the interface already says so:** no
BPM, no key, no beat grid, no mixing. The now-playing card reads "external
source · visuals only, no analysis" for exactly this reason. Those need the
file. A party gets meters, spectrum, goniometer, register colour, the history
panels and the sprite.

**Constraints inherited rather than chosen:**

**Spotify's audio is DRM-protected.** The Web Playback SDK routes through EME
and cannot be tapped by Web Audio. Capturing the system output is the only
route and is what listen mode already does. This is not a limitation to
engineer around; it is the correct behaviour of the platform.

**macOS cannot do this.** Its picker offers no system audio. Windows and
ChromeOS do. Already documented in `deckwave-listen.js`.

**The PC must be the one playing.** The phone is a screen and cannot become
anything else on iOS.

**One design decision to take deliberately rather than by accident.** The
bundle carries `wave` — 2048 raw time-domain samples per frame. That is
functionally 8-bit audio. Sending it across your own LAN to your own phone is
your own sound on your own network and is fine. It is also the field that must
not leak into R10. Decide per-transport, not per-convenience.

**Difficulty: low, once R8 lands.** The capture exists, the panels exist, the
transport is R8's. A day.

---

## R10 — Listen party, remote: sync the playback, not the audio

Other people, elsewhere, watching their own Deckwave against the same music.

**The design that works is the one that sends nothing.** Spotify's own Jam
feature already syncs playback across accounts, so every participant hears the
same track at roughly the same moment from their own client. Each person's PC
then captures its own output locally and visualises it. **Nothing
audio-shaped ever crosses our network, because nothing needs to.**

That is worth stating plainly because the obvious design — one machine
captures and broadcasts to everyone — is redistribution of copyrighted audio
whatever the field is called. `wave` is 8-bit PCM in all but name. **The
correct remote architecture is not "broadcast carefully"; it is "do not
broadcast."**

**So what is actually left to build?** Not signal. Presentation:

**A shared session channel** for the things that are ours rather than
Spotify's — panel layout, theme, sprite choice, cue markers someone drops, and
whatever reactions or chat a party wants. Small payloads, no audio, no
analysis.

**Honest caveats, both of which affect how it feels:**

**Participants' visuals will not match.** Each capture carries its own system
volume, EQ and output chain. One person's level meter sits where their volume
knob is. The register colour will differ. This is not a bug to fix — it is
what capturing the output of a different machine means — but it will look like
one if it is not said up front.

**Jam sync is not sample-accurate.** Expect differences of hundreds of
milliseconds between participants. Fine for a party, useless for anything
tight, and it means no shared beat-locked anything.

**Difficulty: medium**, and mostly product rather than signal. The hard parts
are session identity, presence and permissions, none of which this codebase
has any of today. Several days, and the first question to settle is whether a
party needs accounts, because everything else follows from that answer.

---

## R11 — Custom tile from a declarative spec

**"Let someone say in natural language what they want, send a pre-composed
prompt to an LLM, and get back JSON that styles a custom tile. Or failing
that, a copy-and-paste instruction: use an LLM, paste this prompt, describe
the visualisation, paste the result back."**

**The LLM is the LAST step, not the first, and noticing that reorders the
whole feature.** The prompt you would send is literally *emit this schema* —
so it cannot be written until the schema exists. Build the spec and its
validator, and the clipboard version works immediately with no network at all;
the endpoint then saves two clipboard operations and nothing else.

### Why this is tractable at all

A panel is `draw(c, w, h, T, D)` and nothing more, and both bundles are already
small and enumerated (`deckwave-loop.js:130-138`):

- **`T`**, 8 entries — `bg line dim ac ac2 bad fn g`
- **`D`**, 20 entries — `wave freq set state L R stereo vu hits flux hit
  transLeft blend elapsed now next prev prevRate deck nextDeck` (said 13 until
  2026-08-18, 14 until 2026-08-19; the six deck-truth entries were added so
  panels stop reading `set[state.idx]` — ledger 53. `docs/PROMPTS.md` §1 is
  the place that has to track this, and does)

So the feature is not "generate a visualisation". It is "choose from thirteen
named streams and eight named colours, and say how to draw them". That is a
schema a validator can actually check.

### Spec sketch

```json
{
  "format": "deckwave-tile",
  "version": 1,
  "label": "low bins, log height",
  "background": "bg",
  "layers": [
    { "source": "freq", "range": [0, 24], "mark": "bars",
      "x": "index", "y": "value", "yScale": "log",
      "color": "ac", "alpha": 0.8, "glow": 6 },
    { "source": "vu", "field": "peakL", "mark": "hline",
      "color": "ac2", "alpha": 0.6 }
  ]
}
```

Marks worth having in v1: `bars`, `line`, `area`, `dots`, `polar`, `hline`.
Anything needing arithmetic between two sources is a v2 problem, and when it
comes it needs a fixed operator set — never an expression string, because an
expression string is `eval` wearing a hat.

### The validator IS the feature

Whatever produces the JSON, it is untrusted text and it must never be
evaluated as code. The rules that make that true:

- **`source` must be in an allowlist derived from `D`.** Not "looks like a
  key" — an explicit list.
- **`color` must be a TOKEN NAME from `T`, never a literal.** This is the
  theming property every built-in panel already has: colours are read from a
  CSS custom property each frame, so a custom tile survives a theme change
  instead of being stuck in whatever palette it was authored against.
- **Unknown keys are REJECTED, not ignored.** A typo must say what is wrong.
  Silently doing nothing is the failure mode this project keeps finding.
- **Numbers clamped** — alpha 0–1, glow bounded, ranges checked against the
  actual array length, layer and point counts capped. A tile draws at rAF; a
  spec asking for 4000 bars is a frame-rate bug someone will report as
  "Deckwave got slow".

### A reference implementation exists now — derive the spec from it

`assets/panel-centre.js` (2026-08-18) was written by hand as a normal panel,
and it is the honest test case for this feature. It reads two raw streams
(`D.L`, `D.R`), derives two series from them, keeps a fixed-rate history,
auto-scales relatively, draws a bounded ratio line, and places text. **If the
declarative spec can express that panel, it can express most of them.**

It also supplies what the section below asks for: real value ranges, measured
rather than guessed. Mid and side RMS on a full-scale signal came out at
0.5533; centre share is bounded 0..1 by construction. Build the validator
against this panel before inventing cases.

### The prompt has to carry VALUE RANGES, or the output is wrong on the first try

**Written, 2026-08-18: `docs/PROMPTS.md` §1.** It carries the shapes and
ranges for all 14 `D` entries, the proposed schema, the hard constraints, and
`panel-centre.js` expressed in it as the case to validate against.


`freq` and `wave` are `Uint8Array`. `freq` is 0–255 per bin; `wave` is 0–255
centred on 128. An LLM told only "there is a stream called freq" will map it as
though it were 0–1 and produce a tile that is a flat line pinned to the top.
The pre-composed prompt must state, for every source: its shape, its numeric
range, and what one element means. Two worked examples are worth more than any
amount of description.

### Why the clipboard, and not the endpoint, first

**Three reasons, and only the third is serious.**

1. **It contradicts a stated property.** `ASSETS.allowCDN = false` by default,
   and the comment there says a silent fallback to remote code is exactly the
   failure it exists to prevent. The README says nothing is uploaded, bundled
   or fetched. An outbound LLM call is the same class of thing and needs the
   same explicit opt-in shape.
2. **"Free" is doing a lot of work.** Keyless, CORS-permitting endpoints exist
   as a category, but they are an uptime, rate-limit and privacy dependency
   nobody here controls, and the user's text goes to a third party. The
   reliable version is bring-your-own-key, which is honest but is a settings
   surface rather than a free endpoint. **Check what actually exists at build
   time rather than asserting it from memory** — this is precisely the kind of
   fact that rots between sessions.
3. **Untrusted text, covered above.** The validator is required either way, so
   the endpoint adds no safety work — it just adds a dependency.

**The project has already made this call twice.** R6 externalised hosting to
paste services *so the deck never needs a trust and safety layer*; R4 chose a
pre-filled GitHub issue over accepting submissions. This is the same instinct a
third time, and the rule R6 already earned applies unchanged: *prefer designs
where someone else already carries the obligation.* Here the someone else is
the user's own LLM subscription.

### Two things already in place

**The blast radius is contained.** `deckwave-loop.js:150-151` wraps every panel
draw in try/catch and STASHES the error on the slot rather than discarding it
or killing the loop. A bad custom tile degrades to one broken tile with a
readable message — the safety net user-authored content needs is already built,
for unrelated reasons.

**The input half is R4's input half.** Textarea, `JSON.parse`, validate against
schema, legible errors. Doing them adjacently is most of why this is cheap.

### Open questions

- **Where a spec lives.** localStorage beside the theme and the saved views is
  the obvious answer, and it should ride along with the views export so a
  custom tile travels with the layout that used it.
- **One custom slot or several.** `register()` is keyed by id, so it is either
  a single `custom` or `custom1..n` registered on demand. Start with one.
- **Whether the spec is worth sharing between people.** If yes it is a paste
  payload and R6's machinery already fits.

### Difficulty: moderate, and NOT the afternoon R4 is

Textarea and validation, an afternoon. The interpreter — spec to canvas calls,
with the clamping and the mark set — is the bulk, call it a day. The prompt
document is an hour and is mostly transcribing `T` and `D` with their ranges.

**Nobody can judge this from the spec.** The LLM cannot see what it drew, and
neither can I — visual judgement is the one thing this project has repeatedly
established I do badly. The real loop is paste, look, re-describe, which is
another argument for the clipboard: iteration speed matters more than round
trips, and there is no rate limit on a paste.

---

## R12 — Record what actually played, and let it be saved

Keeper, 2026-08-19: *"a feature to track the set the user built, actually, and
let them save it at the end … like whatever ended up getting played for real."*

**The distinction is the whole feature.** `save set` writes `dash.set`, which
is a PLAN. The moment anyone steers, the plan and the performance diverge:
a fast blend splices six tracks in and re-plans the tail, a blend-now leaves a
track early, a jump skips one, a failed decode drops one out of the order, and
a straight transition plays a track at a tempo the plan never predicted. What
gets saved is the intention that survived, not the thing that happened.

Worse, none of it survives a reload — and reloading is how every session here
has ended.

**What exists that could feed it:**

- `chain()` is the single choke point. Every handover passes through it, and
  it already knows the outgoing track, the incoming track, the exit time, the
  rate, whether the deck is settling, and whether the transition is straight.
- `DW.log` holds a line per handover, capped at 60 entries, with no timestamps
  and no structure. It is a display, not a record.
- `DWNAV.history` holds jump origins for the *back* action only.
- `DWSCORE.score(set)` already produces the score format, and `DWSCORE.cue()`
  a standard `.cue`. Both take a planned set.

**What is missing:** a durable, timestamped, structured log of actual
handovers, and somewhere to put it that a page reload does not erase.

**Sketch, not a design:**

- A `performance` record appended in `chain()` at the moment a handover is
  committed: both tracks, context time, wall-clock, exit point in the outgoing
  track, entry point in the incoming, rate, crossfade, and the reason
  (`planned` / `blend-now` / `queued` / `route-stone` / `straight-grid` /
  `straight-reach` / `jump` / `skip-failed-decode`).
- Persisted as it goes rather than at the end, because the end is usually a
  reload. IndexedDB is already open.
- `save performance` alongside `save set`, emitting the same score format plus
  the real timings, so a set can be reconstructed exactly — and a `.cue` that
  matches what a recording of the session would contain.
- Reconstructing needs the entry/exit points, which is why this cannot be
  derived after the fact from the track list.

**Open:** whether a performance should be replayable (feed it back to
`DW.play` and get the identical set), or only archival. Replayable is a much
stronger claim and would need the same determinism work the score format has
never had verified.

## Carried debt

Not requested features. Things the 2026-08-17 cold-load session surfaced that
are not yet anywhere else. Kept here so they compete for time on the same list
as R1–R7 rather than living in a commit message nobody re-reads.

### D1 — Three subsystems load on every page and cannot be reached

Verified 2026-08-17: each is loaded by `index.html`, and nothing outside its own
file ever calls it.

| | What it does | Status |
|---|---|---|
| `DWCACHE` | Corpus cache export / restore | **0 calls.** Console only |
| `DWTAGS` | FLAC artist/album/title | **0 calls.** Covered by R7b |
| `DWV` | Embeddable visualiser component, 15KB | **0 calls. Never mounted** — see correction below |

**`DWCACHE` is the one that matters.** The corpus is the most expensive thing
in the browser — 189 tracks, 10.7 hours of audio, a long analysis pass to
produce — and clearing site data destroys it in one click. The module that
exists to protect it has no button. Two serious bugs were found in it on
2026-08-17 precisely because nobody had ever exercised it from the interface:
beats did not survive JSON, and it read and wrote a database the engine never
opens. Both are fixed. It is still unreachable.

**DONE 2026-08-19.** `▾ save cache` and `▴ load cache` sit in the `files`
group beside the set buttons. Restore merges by default and reports the
store's summary afterwards. The export's engine block now says which records
are whole-track (v2) and which are excerpt grids (v1) instead of `excerptSec:
120` for everything. **[INFERRED]** — the button path was exercised against
an empty store in a clean profile (summary 0/0, no throw); it has not been
used on the keeper's 219-record store.

**`DWV` — correcting an earlier reading in this document.** It was first
written up here as "superseded by the panel registry, mount it or delete it".
That was wrong, and the code says so plainly: **`deckwave-visuals.js` contains
zero references to the engine.** Not `DW`, not `DWPANELS`, not `DWLOOP`.

It is not an older version of the dashboard's panels. It is a **distributable
component**, and everything about how it is built says so:

- `mount(host, opts)` returns `{ attach, start, stop, shadow, host }`. You hand
  it **any** `AnalyserNode` — from any audio graph, not necessarily Deckwave's.
- Shadow DOM with `:host{all:initial}`, so it survives being dropped into a
  host page whose CSS it has never met.
- A declared theming contract: **21 CSS custom properties** and **9 `part=`
  names**, both enumerated in the public API so a host page can introspect
  them. Custom properties pierce the shadow boundary deliberately.
- Honours `prefers-reduced-motion`.
- Carries its own attribution header for the visual vocabulary it borrows.

None of that is required by an internal panel. All of it is required by
something meant to be embedded in **someone else's page**. It is the answer to
"can I put Deckwave's visuals in my thing", which the panel registry cannot be,
because panels only exist inside the dashboard's own slots.

**So the decision is not mount-or-delete. It is: is that a product?**

- If Deckwave is ever embedded, demoed inside another page, or driven by an
  agent that wants a visual — this is already written and needs a documented
  entry point, not deletion.
- If it is not, it is still 15KB parsed on every load for code that never runs,
  and it should move out of `index.html` into its own distributable file rather
  than be deleted.

Either way it should stop loading on every page load while doing nothing.

**Difficulty: low.** The work is a decision plus a line in `index.html`.

### D2 — What has never been verified

The project's own claims list is good about what the numbers mean. This is the
companion: which claims have been *tested*, and by whom.

| Claim | Status |
|---|---|
| Score determinism, same browser | **Measured 2026-08-17.** Two independent runs, byte-identical, 115 tracks |
| Score determinism, cross-browser | **Untested.** Unchanged |
| Playback, beat-lock, crossfade, bass swap | **Never verified by anyone but the keeper, by ear** — and on 2026-08-17 that ear caught a phase defect three instruments missed |
| Whole-track rhythm analysis (the D5 fix) | **Written, never executed.** No file has been analysed with it |
| Post-fix beat grids reaching the end of a track | **Unseen.** The claim the whole fix rests on |
| Now-playing transition mark following a blend-now | **Unseen.** Static placement verified live; the moving part is untested |
| The four restored panels against live signal | **Never seen.** Recovered and drawing, but only ever idle |
| The three history panels (timeline, drops, loudtime) | **Measured 2026-08-17** by differential render on a synthetic bundle, then seen live the same day. Scroll rollover **observed against real audio**: 600/600 points, span 59.91s, oldest sample advanced to 45.99s while playing |
| Offline render output | **Encoder proven on a synthetic tone. The musical result is untested** |
| Transition monitor phase-lock readout | **Rendered with a set playing, 2026-08-19** — on a synthetic four-track corpus: `∿ STRAIGHT · no beat alignment claimed` against a straight incoming deck, `△ DRIFT 3.01%` across a forced 120 → 123.7 blend, the crossfade bar moving after the handover. Before that day it could not show a crossfade at all (ledger 52). Not yet seen on the real library |
| The deck re-bases after a reach track | **Measured live 2026-08-19** on the synthetic corpus: next deck ×0.968 after a 100 → 120 reach, where the old `chain()` gave ×0.806 (ledger 49). Not heard on real material — LISTENING §5 still stands, and the mechanism it would have tested was broken until this day |

## D5 — the beat grid only ever covers 120 seconds

Measured 2026-08-17 across the whole IndexedDB cache, 219 records.

`analyse()` deliberately analyses a CENTRED 120-SECOND EXCERPT — the comment
says so, and discarding the buffer is the stated point. What was never
reconciled is that the tick times Essentia returns are relative to the signal
it was handed, and they are stored and consumed as absolute track positions.

| Measure | Value |
|---|---|
| Tracks in cache | 219 |
| Longer than 120s | 212 |
| Latest beat anywhere in the library | **119.9s** |
| Median grid coverage of tracks over 120s | **60.6%** |
| Tracks exiting more than 20s early | 188 |
| Total music never played | **236.7 minutes** |
| Tracks reaching the 900-beat storage cap | 0 |

Not one track in 219 has a beat past 120.0s. The 900-beat cap is irrelevant.

`downbeatNear()` scans for the nearest downbeat to the nominal exit and has no
way to say "I have nothing near there", so it returns the last downbeat in the
grid. Worst case measured: GONE TOO SOON, 507s long, last beat 119.2s, exits
371.8s early — six minutes of an eight-and-a-half minute track never plays.

TWO SEPARATE DEFECTS, and they need separate decisions:

1. COVERAGE. The grid stops at 120s. Fixing it means either analysing the
   whole track, or extrapolating the grid from tempo and phase, which assumes
   constant tempo. Either way `downbeatNear` needs to be able to refuse.
2. PHASE. If ticks are excerpt-relative, every grid is shifted by
   (dur - 120) / 2 modulo the beat period. **THIS IS NOT ESTABLISHED.** Three
   attempts to measure it were inconclusive: onset matching at 0.5s tolerance
   passed for every candidate phase because onsets outnumbered beats three to
   one; top-N-by-magnitude onset picking clustered entirely in the loudest
   section and matched nothing; a comb filter put the best phase at 0.29s
   against a 0.5967s beat period, which is half a period away and therefore
   exactly the ambiguity a comb cannot resolve, at a contrast of only 1.63.
   The decisive test is to re-analyse one file at full length and compare the
   fresh ticks against the cached ones. Not yet run.

### Status, 2026-08-17 — SUPERSEDED, kept for the record

**COVERAGE — FIXED, UNVERIFIED.** `RhythmExtractor2013` now runs on a mono
mixdown of the whole track, so ticks are relative to the start of the file.
`ANALYSIS_V = 2` forces stale records to re-analyse; the beat cap went
900 -> 4000. **Not yet run against a single file.** Analysis cost and peak
memory are both unmeasured — a 507s track needs an ~89MB mono copy on top of
the decoded buffer. Measure one track before committing anyone to 179.

**PHASE — ESTABLISHED BY EAR, NOT BY INSTRUMENT.** The keeper found a track
clean in VLC, clean when jumped to directly, and popping only when arrived at
through a mix. Played alone there is nothing to flam against, so this
triangulates onto phase. The same fix addresses it, because a whole-track grid
makes `beats[0]` a real beat near the start of the file. **Confirming it after
the re-scan is an open item** — the confirmation is audible, not numeric.

**`downbeatNear()` STILL CANNOT REFUSE.** It returns the nearest downbeat it
holds even when the grid does not reach the exit at all. With a whole-track
grid this should stop mattering in practice, but the function is still unable
to say *I have nothing near there*, and any track whose grid has a gap will
hit it again. Repairing it means choosing how far a downbeat may sit from the
nominal exit before it is rejected. **That is a threshold and it needs
measuring, not arguing.**

### Status, 2026-08-18 — the re-scan ran

179 tracks, `ANALYSIS_V = 2`, zero failures. Full account in BUILD-LOG Act 22.

**COVERAGE — FIXED AND VERIFIED.**

| | v1 | v2 |
|---|---|---|
| Latest beat anywhere | 119.9s | **506.23s** (of 507.0s) |
| Median coverage | 60.6% | **99.71%** |
| Worst coverage | 23.5% | **99.18%** |
| Grids reaching under 99% | most of the library | **0 of 179** |
| Largest remaining shortfall | — | 0.97s |

The four grids that still end before 121s are all tracks shorter than 121s.
One track passed the old 900-beat cap (1044 beats); nothing approaches 4000.

**COST AND PEAK MEMORY — MEASURED, and the worry was misplaced.**

| | |
|---|---|
| Analysis wall clock, 179 tracks | **12.0 minutes** |
| Per second of audio | 19.9 ms (~50x realtime) |
| Peak renderer working set | **851 MB** (idle baseline 74 MB) |
| Peak by quarter of the pass | 833 / 851 / 820 / 821 MB |

Peak is set by the single longest track and does not climb across the pass, so
memory is bounded by the longest FILE, not by the size of the library. It was
sampled from outside the browser: the analysis blocks the main thread, and
neither the decoded buffer nor the WASM heap is on the V8 heap, so
`performance.memory` cannot see the thing in question.

**PHASE — STILL NOT CONFIRMED.** `beats[0]` is now a real beat near the start
of every file, which is the mechanism the keeper's A/B pointed at. The symptom
was audible and the confirmation has to be audible too. **Open, and it is the
one thing the re-scan could not settle.**

**TWO THINGS THE RE-SCAN CHANGED THAT NOBODY ASKED FOR.**

1. **Three tracks flipped to double tempo, and the grid doubled with them** —
   Perpetual Motion 93.99 → 184.57, PROXIMA 90.01 → 178.21, Galaxy 80.87 →
   162.09. Verified by deriving tempo from beat spacing, not by trusting the
   reported number. All three still pass the confidence gate, so all three
   will enter a set at double tempo. **Needs a decision and an ear, not a
   threshold change.**
2. **Confidence fell corpus-wide** — median 2.181 → 1.783 on the Essentia
   0–5.32 scale, down on 156 of 175. Tracks passing `conf > 0.8` went
   **170 → 160**. That is the gate working, and it is also ten fewer tracks
   available to the sequencer.

**`downbeatNear()` STILL CANNOT REFUSE.** Unchanged, and still a threshold
that needs measuring rather than arguing. With 99%+ coverage it should stop
being reachable in practice.

**40 records in the store are still v1** — material outside the scanned
folder, mostly mp3s. They keep excerpt-relative grids and will re-analyse when
that folder is next scanned.


### Status, 2026-08-18 (later) — NOT the phase symptom. Read the correction.

**CORRECTED SAME DAY.** This section first recorded "it still pops" as the
negative audible confirmation of D5's phase half. **That was wrong**, and it was
wrong because the report was acted on before it was fully described.

The keeper's first message was "Druid II plays now but pops on transition from
Big In Japan", which reads as a transition artifact. Asked to characterise it
across the crossfade, the answer was:

> *"it's just a constant popping sound like tickit-ticki-ticki-ticki-tickite-
> tickiete the whole song"*

**A constant fast tick across an entire track is not a transition symptom at
all.** It is not localised to the blend, so it cannot be flam between two decks
— there is only one deck for most of a track. D5's phase question is
UNTOUCHED by this report: still open, still unconfirmed, still needing a
transition heard on its own terms.

The tempo-drift mechanism below predicted a flam that grows across the 16s
crossfade. That prediction is **falsified** by "the whole song". The measurement
stands as a real defect worth fixing; it is not the explanation for this noise.

Candidates for a constant fast tick, none yet tested: the SoundTouch worklet
(every deck routes through it, even at rate 1.0), a decode/context sample-rate
mismatch, or main-thread starvation glitching the audio thread.

**The process lesson, which is the recurring one.** A partial description was
treated as a complete one, and a whole diagnosis was built on the word
"transition". The keeper's ear is the instrument; asking it a second question
cost one message and overturned the answer.

---

**A measured mechanism — real, but NOT the cause of the reported noise.**
Deriving tempo
from beat spacing and comparing it to the stored `bpm` across all 179 tracks:

| | |
|---|---|
| Median disagreement | 0.408% |
| Tracks over 1% | **53 of 179** |
| Tracks over 2% | 30 of 179 |
| Worst | 28.34% — WHEN AN ANGEL DIES, reported 151.27, grid 108.40 |
| Big in Japan | reported 98.00, grid **99.87** — 1.91% |
| DRUID II | reported 95.89, grid 95.74 — 0.16% |

Playback stretches by `rate = tempo / nm.bpm`, using the REPORTED figure, while
alignment uses the grid. Where the two disagree the deck runs at the wrong
tempo relative to its own beats. At 1.91% over a 16s crossfade that is 0.31s of
drift against a 0.6s beat period — **half a beat apart by the end of the
blend**, which is a flam that grows.

BUILD-LOG Act 22 already established that grid-derived tempo is the figure to
trust; it was the only way to tell an octave flip from a label change. Playback
was never changed to use it.

**What would falsify this:** drift predicts a pop that STARTS clean at the
downbeat and worsens across the 16 seconds. A pop that is hard at the instant
the blend begins and constant thereafter is a different fault and this
measurement is a coincidence. That test is audible and has not been run.

**Do not change `rate` to the grid-derived figure on the strength of this
table.** It would move every deck in the library, and 53 tracks by more than
1%. Measure it, hear it, then decide.

### Status, 2026-08-18 (latest) — CLOSED. The audible half was misattributed.

After swapping SoundTouchJS 0.3.0 for 2.1.1, the keeper reported the popping
gone. That was the falsifier written down in advance: *if the popping through a
mix disappears entirely with a non-dropping worklet, phase was never audible
here.* It did, so it wasn't.

**What D5 actually was:** one real defect (excerpt-relative beat grids, 119.9s
wall, measured against the cache) plus one symptom that belonged to a different
subsystem entirely (a worklet dropping 7.3% of output frames on any stretched
deck). The two were fused by an A/B that could not tell them apart, because
unstretched and single-deck are the same two cases.

The coverage fix stands on its own measurements and is unaffected.

**Scope of the claim:** one listening report, one track pair, after one change.
If popping returns on other material, this reopens — and the phase question
now has a clean test that the dropouts used to mask.

Do not repair any of these by reasoning about what the numbers should be.

The pattern is consistent and worth naming: **everything structural is
verified, everything audible is not.** That is a real limit of how this project
is built, not a backlog item that will clear itself.

### D7 — Two chosen numbers disagree, and one silently wins

`chain()` floors `playFor` at **45s**. Patch 10's `DWELL.min` is **40s**. Since
the fast-blend fix (ledger 38) a stepping stone asking for 40 is clamped up to
45, so the shortest possible fast route is 12.5% longer than patch 10 believes
it is — and patch 10's headline numbers (*"6 hops, 4.0 min"*) were computed
against 40.

Neither number was measured. The 45 predates the router and exists so a track
gets a musically sensible minimum airing; the 40 is blend-in plus hold plus
blend-out at a 16s crossfade. **Both are defensible and they cannot both apply.**

Resolving it means hearing a stepping stone at 40 and at 45 and deciding
whether the shorter one sounds cut off. That is an ear question, and per the
standing rule it does not get settled by argument. Until then the clamp stands
and is documented at the site.

**Updated 2026-08-18 (ledger 42): neither number has moved, but the UI stopped
quoting the losing one.** The menu printed `dwellSec` — the router's request —
while `chain()` clamped to the floor, so every fast route advertised a saving
12.5% larger than it delivered. The floor is now named `MIN_PLAY`, exposed as
`DW.dwellFloor`, and the menu and the `route` panel both print the clamped
figure with the request shown in brackets when they differ. Measured on the
live corpus: 130→151 bpm is 4 stones, **3.0 min**, not 2.7.

**This is now testable in one listen**, which it was not before ledger 40 —
a fast blend previously never shortened anything, because the route never
reached the deck at all. The tell is a stepping stone leaving after about
45 seconds instead of playing out.

### D6 — The reference layer drifts, and nothing notices

**46 Wikipedia references** live across `deckwave-messages.js`, `deckwave-panels.js`
and `deckwave-dashboard.js`. In the panels glossary, **12 of 16 carry
`verified:false`** — the flag exists precisely because the link was never
checked, and nothing has since.

Two separate problems, and only one of them is about links.

**The links themselves are unverified.** A `verified:false` entry is an
assertion that some Wikipedia article explains this concept, made without
opening it. Four have been checked. That is the whole audit.

**Nothing binds a reference to the thing it describes.** The glossary maps a
PANEL ID to a term; the term carries a URL. Rename a panel, change what it
draws, or add one — as the sprite panel just was — and the mapping silently
falls out of step. There is no check that every panel has a term, that every
term has a panel, or that a term still describes what the panel now does.
This is the same shape as the tooltip bug in ledger 37: a mapping updated by
hand in one place and read in another.

**What it needs**, in order of value:

- A startup assertion that every registered panel id appears in the glossary's
  `PANEL` map, and vice versa. It is a few lines and it would have caught the
  sprite panel arriving with no term. **DONE 2026-08-19** — `DWDASH.glossaryAudit()`
  warns at startup and `check-panels.js` asserts it; on the day it was added
  it found three dead keys, one wrong concept, a header key that was not a
  key, and six untermed panels (ledger 56). The 20 unverified links are now
  search links, which is what the tooltip always said they were.
- A `lastChecked` date beside `verified`, so a true flag can go stale honestly
  rather than being true forever.
- An offline pass over the 12 unverified URLs — open each, confirm the article
  is the concept meant, flip the flag or replace the link.

**Difficulty: low, and mostly clerical.** The assertion is the part worth doing
first, because it is the part that keeps working after someone stops paying
attention.

### D3 — No tests, and what one could even look like

**Four now, 2026-08-19, all `node tools/check-*.js`, all CRLF-proof, all
run against the old code first to prove they fail there:** `check-pool.js`
(classification, dedupe, no-discard, and the score describing the player as
it is — 18), `check-route.js` (rate map, router, commit, no double-play — 18),
`check-player.js` (the Player IIFE under a fake AudioContext: replan races,
decode failures, reach re-basing, cancelled-deck target restore, placeNext —
28), `check-panels.js` (every registered panel against six bundle states with
captured text, plus the glossary↔registry map — 39). What follows is the
original note, still right about what is NOT testable.

Zero test files. Every verification to date has been a browser inspection
inside a working session.

That has been adequate because someone was always present, and it is exactly
what let the cold load find seven registrations missing, a doubled transport
and a database name mismatch. But nothing catches a regression *between*
sessions, and the packaging losses were all silent.

**What is testable without audio, and would have caught most of 2026-08-17:**
every module defines its global; every id in `DWPANELS.defaults` resolves; the
transport contains no duplicate labels; a corpus cache round-trips through
export and restore with matching integrity figures; `sequence()` twice over the
same corpus gives identical output.

**What is not testable without ears:** everything in D2.

**Difficulty: low for the first list.** It is a page that loads the app and
asserts, not a framework. Worth it precisely because the failures this project
actually had were structural and silent.

### D4 — UI, remaining

The 2026-08-17 consolidation grouped the transport and collapsed appearance
behind one toggle — 21 controls to 16 visible. Two open questions:

- **Nobody has looked at it.** Verified structurally; screenshot capture would
  not include the transport row at any window size tried.
- **`save set` / `load set` / `render flac` are in the always-visible row.**
  Arguably setup rather than performance. Collapsing them too would reach 13.
  Left visible on the grounds that losing a set is expensive and saving should
  stay one click — a judgement, not a finding.

- **Claude Design — asked 2026-08-18 01:03, never decided.** The keeper asked
  whether a layout consult could be ordered. Answer at the time: no, Claude
  Design was a host for design-system projects, not a service with a reviewer.
  Three options were offered — I do a layout pass; extract the token/`part`
  contract into a design project for preview cards; or wait. I leaned toward
  waiting a week then extracting. **No answer was given and the question was
  lost between sessions**, which is ledger 30's failure mode a second time.

  **The answer is now partly obsolete.** A `design` skill has since appeared
  that builds a multi-artboard design canvas as an Artifact with a visual
  editor. Checked rather than assumed: the string "Create a design canvas" is
  absent from the whole transcript of the session where the question was asked
  and present in every session from 17:56 the same day. That removes the reason
  for waiting — the visual iteration loop no longer costs a component-library
  extraction up front. Still no outside eye, and still zero design-system
  projects on the account.

  **Open: whether to do a canvas pass, and over what.** 13 panels plus a
  two-row transport is the wrong scope for a first one.

- **Tooltips go stale when a tile is swapped.** Reported by the keeper
  2026-08-18: change what a slot holds and the tooltip keeps describing the
  panel that used to be there. NOT DIAGNOSED — recorded as observed, and the
  wording is the keeper's: the tooltips *stay static when the tile is changed*.

  This is the third time tooltips have gone wrong after a slot rebuild (ledger
  20 covers the first two, where they were dropped entirely rather than left
  stale). The fix then was terms-as-data plus an automatic re-tag on rebuild,
  so the obvious first question is whether a swap goes through the same rebuild
  path that triggers the re-tag, or around it. **Check before assuming** — the
  previous two looked like the same bug and were not.

  **DIAGNOSED AND FIXED, 2026-08-18. The question above was the right one and
  the answer was "around it."** `tag()` was wrapped around `build` and `reset`;
  a swap calls `paint(slot)` straight from the menu handler and touches
  neither, so the label kept the previous panel's `data-gl`. A second bug sat
  underneath: `tag()` only ever SET the attribute, so a panel with no glossary
  term inherited whatever the last one wrote — which the new `sprite` panel
  would have hit immediately. Now re-tags inside `paint()` and clears the tag
  when a panel has no term. Ledger 37, **[INFERRED]** until hovered after a
  real swap.

---

### The listening plan lives in `docs/LISTENING.md`

Six things are built, measured and unheard: straight transitions, the 9%-vs-3%
grid cut, D7's stone length, D8's settle ride, the reach jumps, and the three
double-tempo tracks. That file names the exact tracks for each and states what
each answer would change. Regenerate it if the library is re-scanned — the
tempos in it are v2 figures from 2026-08-18.

### The pool gate was replaced, 2026-08-18 — and the cut still needs an ear

The keeper: *"Ideally you wouldn't discard any of the songs that people have
put in. maybe we find a way to gracefully still reach them."* Done, and
measured: **171 of 171 tracks placed**, 9 of them played straight.

Three things are open and all three are listening questions:

- **`DW.lock.maxGridErrPct` is 9, derived from an empty band between 7.50% and
  11.04%.** The other defensible value is ~3%, on the argument that grid error
  adds to the stretch budget and we already refuse 8% of stretch. 9 plays 5
  tracks straight; 3 plays 22. Move it, rebuild, listen — it takes effect on
  the next build with no reload.
- **The four reach transitions are abrupt.** 167 → 100 bpm, 140 → 172 bpm.
  Honest — nothing claims to be beatmatched — but a hard reset. Smoothing them
  is exactly what routing to the tail via stepping stones would do, which is
  the option that was offered and declined; it is still available.
- **Nobody has heard a straight transition.** It is a plain crossfade with the
  bass swap and no beat alignment. Whether it reads as a DJ choice or as a
  mistake is the whole question.

### DJ-style set building — deferred, 2026-08-18

Asked and answered: *"Do we have the actual dj-style yet?"* — no. `sequence()`
takes `length`, `maxStretch`, `minConf`, `maxGridErr`, `dedupe` and the three
weights; the build button passes two of them. The energy arc is a single
hardcoded curve — rise to 72%, peak, gentle release. One shape, one weighting.

Deferred by the keeper's own call: *finish the gates first*. When it comes
back, the shape agreed was named presets (warm-up, peak-time, closing,
journey, wall-to-wall) as the front door with the raw knobs behind them.

### The scenic route is confirmed, 2026-08-18

*"I think the slow blend is fine."* The scenic route — current track finishes
as planned, then the stepping stones at full length — is the keeper's word
against the fast one, and it holds. Both modes are now heard. The remaining
dwell question is D7, and it is only about the FAST route's stones.

### D8 — `settle` is built, off, and has never been heard

The keeper, 2026-08-18: *"if i make a bad blend we need to eventually speed it
back to the song's normal speed."* A forced blend leaves the incoming deck
stretched for its whole length; the DJ answer is to ride the pitch fader back.

**Built and shipped OFF.** `DW.settle = { on, seconds: 45, minStretch }`, with
a toggle in the transport. When on, a deck whose rate is outside
`minStretch` ramps back to 1.0 over `seconds` and the ramp is scheduled before
the exit is planned, so the exit is chosen against the map that will apply.

**What it cost structurally, and what has to be watched.** `rate` was a
constant and three places divided by it: the exit in `chain()`,
`nextDownbeatAfter()`, and the `blend` accessor's track length. They now go
through `deck.pos()` / `deck.when()`, which integrate the rate. With no ramp
those reduce to exactly the old arithmetic — asserted with `===`, not a
tolerance, in `tools/check-route.js`.

**What is undecided and needs the ear:**

- **45 seconds is chosen, not measured.** Nothing has been ridden at 20s or
  at 90s.
- **It changes the SET, not just one track.** A settled deck hands over at its
  own BPM instead of at the 35%-drift target, so the rolling tempo becomes the
  current track's BPM and every gate test after it is measured from somewhere
  else. Whether that makes better ladders or worse ones is unknown.
- **`minStretch` is set from `DWNAV.GATE` by the toggle**, deliberately not
  defaulted to `0.08` inside the engine — one gate, one place. Whether the
  gate is even the right trigger (settle every stretch? only forced ones?) is
  open.

### D10 — 104 of 189 beat grids are not one grid, and the lock gate cannot see it

Found 2026-08-19 while measuring the phrase detector (BUILD-LOG Act 29,
ledger 64), not looked for. 104 of the 189 v2 records have beats more than
15% off their own median spacing; 50 have twenty or more; GONE TOO SOON
has 327 of 1043. They come in RUNS, not as jitter: System Shutdown holds
0.499 s for 22 beats and then 0.40 s for a stretch; HEAVEN 0.348 then
0.522 (3:2); ANOTHER WORLD 0.476 then 0.36 (3:4). Essentia followed a
half-time or dotted feel for a section and came back.

**What it costs.** The label BPM is the dominant level and is right, so the
stretch `tempo / bpm` is right. But "every 4th beat from beats[0]" —
`downbeatNear`, `nextDownbeatAfter`, the score, and now the phrase
detector's bars — drifts off the bar inside such a run and STAYS off after
it, and `gridError()` measures MEAN spacing, so a track like System
Shutdown sits inside the 9% cut and is locked. An exit chosen "on a
downbeat" in the tail of such a track is on a beat, not necessarily on the
one.

**What would fix it, and why it is not done.** Either a regularity term in
the lock gate (fraction of off-median intervals — a new threshold, needs
the ear and a measured range; the range is in `evidence/phrase-scan-2026-08-19.json`
as `oddIntervals` per track), or downbeats from a uniform grid at the label
tempo anchored at beats[0] (measured for phrases: 51.7% vs 60% on the
60-track comparison, no better). Both are detector changes; neither moves
without the keeper. **Until then, a track in `build · best matches` can be
beatmatched to a grid that is only mostly right, and nothing on screen
says so.** The same scan's downbeat probe (bar-to-bar change at beat
resolution, mod 4) lands on offset 0 for 67% of tracks, chance 25% — the
first evidence either way for the 4/4-from-beats[0] assumption; reported,
not applied. `tools/phrase-scan.js` prints `odd N/runs` per track.

### D9 — CLOSED as a MISATTRIBUTION. The report was real; the filenames were never the cause

Keeper, 2026-08-18. Recorded as reported, with what is known and what is not,
because the obvious explanations were checked and are all wrong.

**The likely answer arrived the same evening, from the keeper, by accident.**
After the routing fix (ledger 40) they reported *"the quick blend from midway
thru ghost town into giana sisters was a good one too"* — and
*THE GREAT GIANA SISTERS (1987) Chris Hülsbeck* is one of the two tracks they
named as not loading. It loaded and it played.

So the report was accurate and the word "load" was doing different work than I
read it as. Those tracks sit at ~140 bpm on the C64 reMIXed album; from most of
the set they are outside the 8% gate, so **the only way to reach them is a
route — and every route was inert in audio.** The keeper could see them in the
list, click them, watch the menu offer a scenic or fast route, and never arrive.
That is indistinguishable from "it won't load" from the outside.

**The falsifier was stated and then run, 2026-08-18.** *"next i'll quick blend
to spy vs spy, testing the ( ) things that I wasn't able to"* — and then:
**"spy vs spy plays"**. Both named tracks now play, reached by exactly the
mechanism that was broken. **CLOSED as a misattribution**, the same shape as
D5's audible half: the symptom was real, reported accurately, and the cause
named for it was not the cause.

**Worth keeping for the shape of it.** I spent a measurement pass on filenames
— norm() collisions, cache-key resolution, FLAC bit depths — because the
keeper's word was "load" and I read it as a file operation. It was a
reachability report. The tracks were visible in the list and unreachable
through the gate, which from the outside is indistinguishable. **The check
that would have cost nothing: ask which tracks, then look up their BPM against
the set's tempo before touching the filesystem.** 140 bpm against a set
sitting near 120 is the whole answer, and it was one query away.

Everything from here is what was checked BEFORE that report, kept because the
negative results are worth having and the audit tool is worth keeping either
way.

**Ruled out by measurement, not by argument:**

- **Not name resolution.** `norm()` over all 189 real filenames produces 189
  distinct keys — zero collisions — and every one of the 189 chiptune cache
  records resolves to a file. Brackets, parentheses and the `ü` in
  *Chris Hülsbeck* are all stripped on both sides, so they cannot cause a miss.
- **Not the sequencer gate.** Both named tracks survive `dedupe()` and
  `conf > 0.8` on v1 numbers (SPY vs SPY 2.999, GIANA SISTERS 1.541) and land
  in the built set.

**The one real correlation found.** Six files in the library are 24-bit rather
than 16-bit, and **four of the six are the ones with square brackets** — the
YouTube-sourced rips, where the bracket carries the video id:

| file | format |
|---|---|
| Big in Japan (Lyric Video) [ZyDO4rMbSQA] | 48 kHz 24-bit |
| Paradigm Shift [IlV9PHqbltI] | 48 kHz 24-bit |
| The Last Escape (From "Terrorbytes...") [e_q_4AHkGGY] | 48 kHz 24-bit |
| THRILLER — cover by Meredith Bull & LukHash [lDwy7NGUfaE] | 48 kHz 24-bit |
| Exile | 44.1 kHz 24-bit |
| Pixel Force | 44.1 kHz 24-bit |

Everything else is 44.1 kHz 16-bit. **The bracket is a proxy for the
provenance, and the provenance is a proxy for the format.** That is a
hypothesis, not a finding — it predicts that Exile and Pixel Force fail too,
and that nothing with a bracket and 16-bit audio fails.

**Note the second reading of the report.** The two tracks the keeper asked for
by name — *SPY vs SPY (1984)* and *THE GREAT GIANA SISTERS (1987)* — have
round brackets and are plain 16-bit/44.1. If those are the ones failing, the
format hypothesis is dead and this is something else entirely.

**The instrument, because the failure is invisible by construction.** A track
that will not decode is spliced out of the order by `chain()` with a single
log line, which nobody is watching as it scrolls past. So the symptom is "that
one never plays" with no evidence afterwards. `DW.audit(set)` — the
**audit set** button — decodes every track in the set with the same
`decodeAudioData` call playback makes, and reports failures with the decoder's
own message and the stage (`find` / `read` / `decode`), which have completely
different fixes. It also flags any track whose decoded length disagrees with
the analysed length by more than a second, since that means the beat grid is
being mapped onto a different length of audio than it was measured on.

**Next step is one click**, and the answer is in the console.

### Idea — a token / cost meter for the build video

Keeper, 2026-08-18, explicitly speculative: a running token meter, *"could
fill a $ bar, lol, and the $ bar could get filled when I bought the LukHash
catalogue and all the domains too"*, with cashier noises. Recorded so it is not
lost — the keeper's own framing was *"i dunno we wil see"*, so nothing is
planned. It would be a panel like any other; the data is not in the page and
would have to be piped in from the session.


## Competitive gaps — 2026-08-19, keeper: "what features are we missing?"

Measured against the code on the day, not a wish list. Ranked by what a
LISTENER hears, which is the product the phone turned this into tonight.

| # | Gap | Who has it | Cost here | Note |
|---|---|---|---|---|
| 1 | Phrase-aligned transitions (8/16/32-bar boundaries, not downbeats) | Apple Music AutoMix, every human DJ | Large — a detector, and the ear to set it | **BUILT 2026-08-19 as `build · phrase match`** (BUILD-LOG Act 29, ledger 63): 8-bar offsets from `DWPHRASE`, exit/entry/one-phrase fade in the Player, `next ▶` to the phrase on that build. Measured, **unheard** — LISTENING §12. The other two builds are untouched |
| 2 | Loudness levelling across tracks at playback | Every streaming player (ReplayGain/LUFS) | Small — RMS per track is already measured for the energy index; nothing applies it | Target level is a listening decision |
| 3 | Vocal/intro/outro awareness (no vocal-over-vocal blends) | AutoMix, rekordbox vocal position | Large in-browser | Second most audible "not a DJ" tell |
| 4 | Stems / Neural Mix for transitions | djay, Serato, VirtualDJ | Very large | Bass swap is a 3-band slice of one stem |
| 5 | Key shift ±1 semitone to make adjacent keys compatible | djay, Mixed In Key Mashup | Small — SoundTouch pitch-shifts; unpulled | A musical change; the ear decides |
| 6 | Native ergonomics: CarPlay/Android Auto, Siri, widgets; offline (manifest exists, **no service worker**) | Native apps | Shell for the first three; a service worker for the last | Lock screen is done as of tonight |
| 7 | Manual correction of BPM / key / grid | Every DJ tool | Small — a per-record override the sequencer honours | The double-tempo trio is the case for it |
| 8 | A BEAT-MATCHED export | DJ.Studio (its whole product) | Medium — `render` exists but does not time-stretch, by its own header | The score is reproducible; the file is not the mix yet |
| 9 | Library management: search, crates/tags, ratings, rekordbox XML / Traktor NML / Serato import-export | Lexicon, SetFlow, all DJ software | Medium | One flat list and a set today |
| 10 | Tags beyond FLAC (ID3 for MP3/AAC, ALAC atoms) | Everyone | Small | Other formats fall back to filename parsing |
| 11 | Transition variety (filter sweep, echo-out, cut, loop) | DJ.Studio, djay | Medium | One consistent shape today — a virtue until the fifth identical blend |
| 12 | Visible next-transition preview; hot cues, loops, pitch fader, MIDI | Performance tools | Preview small; the rest is not this product | Say so rather than half-build it |
| 13 | Streaming catalogues | djay, rekordbox, DJ.Studio | — | **Deliberately absent**: no upload, no cloud is the position |

What the others mostly lack, so the table reads fairly: the visualiser as
the front of house, a reproducible mix score, an energy arc the set is
planned against, zero upload, a browser, and a phone that plays locked with
working controls. Order of attack if asked: 1 → 2 → 7 → 8 → 3.

## What none of this fixes

- **Phrase detection exists as of 2026-08-19 and is unheard.** `build · phrase match` lands transitions on 8-bar phrases (Act 29); whether they sound like it is LISTENING §12. It is 8-bar only, whole-track (a bridge mid-track shifts the phrases after it and the offset is then the majority answer), and its offset is an estimate with a printed contrast — not a solved problem. R1 still matters for the cases it gets wrong.
- **Still Chromium-only for local libraries.** R3 is the only thing that changes that, and only for streamed audio.
- **Still tuned against one catalogue.** Libre audio from Commons will expose this immediately.
