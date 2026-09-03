# Research, consolidated

Brought in from a separate research directory on 2026-08-19 (keeper: *"review, and consolidate - bring it all in"*). Twenty-one were claude.ai research artefacts with opaque `compass_artifact_wf-…` filenames; two were already named. Each is renamed from its own H1; nothing inside any file was edited. A SHA-256 prefix of the original bytes is recorded so a file can be matched back to the Downloads copy. No two files were duplicates (byte compare and title compare); the two that arrived named -- the provisional draft and the Puffin findings -- are not duplicated by any of the generic ones.

**Sensitivity, stated before any publishing decision:** the files marked *private* carry personal financial, corporate and patent-strategy material. Everything marked *ok* is technical and publishable. **DECIDED 2026-08-27, keeper: the private set does not ship** (*"I don't think these need to be shipped"*) — all ten *private*-marked files moved out of the tree to `../deckwave-private/research/`; their index rows are replaced by the note at the bottom. Like the adjacent set, they remained in the LOCAL repo's history — and the fresh-history launch plan (`docs/LAUNCH.md`) is what keeps them off GitHub: the public repo begins at a single commit, so neither set is in the published tree or the published history.

**How the IP set reads, in one paragraph.** Four independent adversarial reviews reached the same verdict from different angles: the system is a *novel integration, not a novel invention* -- every block has prior art (Essentia.js, Mixxx AutoDJ, Vande Veire & De Bie, AutoMashUpper, Mixed In Key, DJ.Studio, SetFlow, Bittner 2017, Ishizaki 2009, Cliff 2000), the rolling-target-plus-hard-gate and the engine-block score are the two uncommon combinations, and both are rated very weak under s103 (and s101 for the format). All four recommend **defensive publication over filing**, which is what the gate's lifting on 2026-08-18 reflects. The 2026-08-19 in-repo review (see the session notes in BUILD-LOG Act 27 / CLAUDE.md) reached the same conclusion independently, adding DJ.Studio's *Solve* (bridging tracks) as direct prior art for the stepping-stone router. **RESOLVED 2026-08-22, keeper's statement: the provisional was DROPPED** ("we dropped the provisional") - consistent with every review's recommendation. Defensive publication at launch is the whole IP strategy; publishing forfeits foreign (absolute-novelty) filing, accepted with eyes open.


## Patents, prior art, naming (IP)

| file | what it says | sensitivity | KB | sha256 (orig) |
|---|---|---|---|---|
| [`prior-art-intent-steered-soundtrack-2026-08-21.md`](prior-art-intent-steered-soundtrack-2026-08-21.md) | Authored in-repo (not an import). Prior art for DWEVENTS (live intent injection into the playing set): adaptive game music (iMUSE/DirectMusic/Wwise), Weav’s LIVE adaptive-tempo patent family (US9595932–US11854520, added to the FTO watch list), Spotify AI DJ voice requests (2025) as the interface precedent, and a GitHub pass — nearest neighbour (AI-DJ-Mixing-System) is OFFLINE prompt→mix, nothing found steers a beatmatched set live. Verdict: novel integration, not invention; ducking is commodity. | ok | 6 | — |
| [`game-music-field-supply-and-demand-2026-08-21.md`](game-music-field-supply-and-demand-2026-08-21.md) | Authored in-repo. Comprehensive game-music pass, both sides: supply (user-music games are a 20-year genre that keeps rebuilding its analysis per game and dying with it — Riff Racer, Beats, Audiosurf; middleware serves authored music only) and demand (Godot merged interactive music in 4.3, Unreal built Quartz, Koreographer/RhythmTool sustain as paid assets, Infinite Album ships viewer-injected intent). The unoccupied square: shelf-1 as open middleware — which is the README positioning. Side-find: Riff Racer is the likely answer to the race-track memory. | ok | 6 | — |
| [`visualizer-field-notes-2026-08-21.md`](visualizer-field-notes-2026-08-21.md) | Authored in-repo (not an import). The visualizer field vs Deckwave's panels: Soundwave and music-ui assessed (both MIT, borrowable into AGPL; one idea worth taking — a popout projector window), the race-track visualizer hunt (not found; candidates recorded), and a who-is-where table (butterchurn MIT, audioMotion AGPL, clubber MIT). Verdict: the field visualizes audio, Deckwave visualizes decisions about audio. | ok | 5 | — |

## Engine research

| file | what it says | sensitivity | KB | sha256 (orig) |
|---|---|---|---|---|
| [`ultra-review-2026-08-29.md`](ultra-review-2026-08-29.md) | Authored in-repo. The pre-launch multi-agent CLOUD review, run in three scoped slices (engine / face / proofs) because the tree exceeds the per-review line limit. 12 findings, 3 NORMAL: a `javascript:` XSS via a loaded score’s attribution link (the one launch-relevant one), a norm()/analyse() stem mismatch that breaks Commons .opus ingest, and CAMELOT_MINOR being a copy of CAMELOT_MAJOR — parallel keys scored where relative was meant. Verification here sized that last one (18.8% of ordered pairs; 196:23 minor:major) and found the migration trap the review missed (camelot is stored per record). ALL THREE ARE NOW FIXED — the XSS by a scheme allowlist on the attribution link (ledger 103, `safeHref` in `deckwave-nowplaying.js`), the stem mismatch, and the wheel by shipping BOTH tunes with deckwave tune as the default and standard Camelot one select away (ledger 101). This row described the review, not the state of the code; leaving it as “nothing fixed” would have told a reader the shipped product carries a live XSS. | ok | 12 | — |
| [`code-review-console-2026-08-28.md`](code-review-console-2026-08-28.md) | Authored in-repo. High-effort adversarially-verified review of the Acts 38–39 console diff (instrument column, stage, recon-shot.py): 16 findings survive, all [INFERRED], none launch-gating — shot-filename collisions, a dedupe key blind to the new fields, the folded deck freezing the ribbon's set, a playhead fallback that disables its own LIST ≠ DECK flag, and four "silent control" paths in the class ledgers 77/84/85 fixed elsewhere. | ok | 9 | — |
| [`adversarial-audit-of-the-first-engine.md`](adversarial-audit-of-the-first-engine.md) | Audit of the pre-Essentia engine: Joe Sullivan amplitude detector (~78% ceiling), invented energy weights and ZCR-as-brightness (still true, documented), +/-8% cap is UX policy not perception, harmonic mixing absent (since added). | ok | 25 | `f0490c0fdc96` |
| [`beat-lock-set-construction-sonification-export.md`](beat-lock-set-construction-sonification-export.md) | Beat-lock with SoundTouchJS + downbeat re-anchoring, Rubber Band R3 for offline render, set construction literature (Foote, Zehren, Bittner), sonification borrowed from adaptive game music, export paths. | ok | 40 | `7317f8fb9ed5` |
| [`blueprint-browser-music-analysis-and-mixing-engine.md`](blueprint-browser-music-analysis-and-mixing-engine.md) | The implementation blueprint that became 0.5+: Essentia RhythmExtractor2013 multifeature, showDirectoryPicker + analyse-then-discard + IndexedDB, SoundTouchJS worklet beat-lock, phrase boundaries via Foote novelty (still not done). | ok | 29 | `a0579029aa07` |

## Platform and publishing

| file | what it says | sensitivity | KB | sha256 (orig) |
|---|---|---|---|---|
| [`mobile-delivery-ios-android.md`](mobile-delivery-ios-android.md) | Delivery routes for iOS/Android: AGPL blocks the App Store; iOS file access and background audio; recommends desktop analyser + native companion player. Read with ROADMAP "iOS, what is solved" and "Android" (2026-08-19), which moved several of its premises. | ok | 19 | `34dbeacd794b` |
| [`open-source-publishing-licensing-hosting-shadow-dom.md`](open-source-publishing-licensing-hosting-shadow-dom.md) | AGPL-3.0 is the binding constraint (Essentia); hosting on Pages/Netlify/Cloudflare; COOP/COEP if WASM threads; two-layer theming API (custom properties + ::part) -- the DWV contract follows it. | ok | 27 | `5da7dc18fa89` |

## Private set — MOVED OUT 2026-08-27

The ten *private*-marked files (patent strategy and name clearance, two
patentability opinions, the whole-system prior-art search with its
2026-08-21 CRAWNiiK addendum, the provisional-filing note and the
provisional draft, and the four business/funding reports) were moved out of
this repository, to a private copy the keeper holds, on the keeper's
decision, 2026-08-27:
*"I don't think these need to be shipped."* Their SHA-256 prefixes are
recoverable only from the keeper's private copy — **not from this
repository**, whose history begins at the launch commit. The one-paragraph IP summary at
the top of this README is the public record of what the IP set concluded —
that paragraph, plus the four reviews' shared verdict (defensive
publication over filing), is all a stranger needs.

## Adjacent -- the persona / Waypost project: REMOVED 2026-08-21

The eight `adjacent/` files (research belonging to a separate project of the keeper’s, unrelated to Deckwave) were deleted from the working tree before this save-state -- the
launch table's "adjacent" decision, taken by removal. Their index rows are
gone with them; the SHA-256 prefixes remain recoverable from this file's
history.

**What deletion does and does not do — and how it was settled:** deleting a
tracked file removes it from the TREE, not from HISTORY, so for a while these
files were still reachable in the local repo and a plain push would have
published them. **The launch answer was a FRESH HISTORY** (`docs/LAUNCH.md`):
the public repo begins at one commit containing the tree as it stands, so the
adjacent set is in neither the published tree nor the published history. The
same applies to the *private* set, which had the same property. Both survive
only in the keeper's local copy and the full-history bundle kept outside the
repository.

## Where each one landed in the code

- The engine blueprint and the beat-lock report became the Essentia / SoundTouch / IndexedDB architecture (BUILD-LOG Acts 2-6). Phrase-boundary transitions (Foote novelty) from both are still the largest open quality gap (ROADMAP "What none of this fixes").
- The adversarial audit's two standing findings are carried verbatim in CLAUDE.md's claims list: the energy index is constructed and ZCR stands in for brightness; the 8% gate is policy.
- The mobile-delivery report's premises moved on 2026-08-19: `webkitdirectory` exists on iOS 18.4+, FLAC no longer depends on Safari, and the analyser's peak is structurally smaller -- see ROADMAP "iOS, what is solved and what is not" and "Android". Its AGPL-vs-App-Store point stands and is why a native app is not the next step.
- The open-source/licensing report is why `NOTICE` declares the whole project AGPL-3.0 and why `vendor/` is pinned and self-hosted.
- Naming was reviewed before launch and **no rename was planned**. The clearance report and the reads taken on it are in the private set and are not reproduced here.
