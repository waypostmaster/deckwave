# _source — restore points

**Ships publicly. Keeper's decision, 2026-08-28: *"we will include the
_source."*** This was the last open row of the decide-before-the-push table in
`docs/LAUNCH.md`; it is closed.

This directory is not source. The source is the tree around it. These are
**restore points** — the packages Deckwave was cut as on its way here, plus
three captured states that are cheaper to keep than to re-derive.

**Why they ship, and why it matters more than it looks.** The public repo
begins at ONE commit (`docs/LAUNCH.md`, "fresh history"), so `git log` on
GitHub carries no lineage at all — one tree, one date. These zips are then the
only thing in the public record that shows the code was somewhere else before
it was here, and that it moved. The BUILD-LOG tells that story; `_source/` is
the part a stranger can unzip and run.

Nothing here contains audio. Nothing here is fetched by the running page.

---

## The packages

| File | Cut | Files | Size | What it was |
|---|---|---|---|---|
| `deckwave-0.5.0.zip` | 2026-08-17 | 34 | 0.10 MB | **Does not run — see below.** |
| `deckwave-0.6.0.zip` | 2026-08-18 | 50 | 1.02 MB | First package built by `tools/package.py`. |
| `deckwave-0.7.0.zip` | 2026-08-18 | 52 | 1.05 MB | "Nothing gets discarded from a set" — the confidence gate removed, straight play added. |
| `deckwave-0.8.0-2026-08-19.zip` | 2026-08-19 | 61 | 1.12 MB | 0.8.0 *in preparation*, renamed 2026-08-30 to free the name for the launch cut. **Eleven days older than the launch tree** — see below. |
| `deckwave-0.8.0.zip` | 2026-09-01 | 97 | 3.1 MB | **The launch package.** The tree as pushed: phrase, libre, popout, events, both stretch worklets and the demo score all present, which is what the 2026-08-19 cut was missing. Cutting it found an eighth absentee (ledger 108) and then a ninth class of problem (ledger 109) — see below. 91 files until `extensions/citywalk/` and its harness were tracked on 2026-08-30 (95), then the README screenshot and the UI queue on launch day (97). Cut LAST, after CLAUDE.md's Publishing bullet flipped, because the zip embeds it. |
| `deckwave-0.8.1.zip` | 2026-09-03 | 100 | 3.2 MB | **The review release** (CHANGELOG 0.8.1, BUILD-LOG Act 41). Cut from a clean `git archive` of commit `90daacb` rather than from the working tree, because the tree held a sibling session's uncommitted feed rows and `package.py` reads the disk — so the zip is exactly the tracked tree, and the tool's "git could not be consulted" warning on that export is expected. The three new files against 0.8.0: `.gitattributes`, `tools/check-loop.js`, `vendor/LICENSE.butterchurn-presets.txt`. |

Restoring one is unzip and serve:

```bash
unzip _source/deckwave-0.7.0.zip -d /tmp/dw && python /tmp/dw/deckwave/tools/serve.py
```

`serve.py` is inside 0.6.0 and later. Every package from 0.6.0 on carries the
twelve vendored library files, so it runs from a cold clone with no network.

**`deckwave-0.5.0.zip` is the exception and it is kept as the counter-example.**
It was built by hand, before `package.py` existed, and its file list was
whatever was remembered at the time: it has **one** file under `vendor/` (the
README) and **no** `tools/`. So it cannot analyse anything — Essentia and
SoundTouch are simply absent. Its own commit says so: *"Deckwave 0.5.0 as
built. Never verified from a cold load."* That package is the reason
`package.py` derives its file list from `index.html` and refuses to build if
anything the page loads is missing. Kept, labelled, not fixed — **a package
that cannot run is worse than no package: it looks like a restore point and is
not one**, and the honest way to say that is to leave the artefact next to the
tool that exists because of it.

### The 0.8.0 package was stale against the tree it is named for — RESOLVED 2026-08-30

**Done, ahead of launch day.** The 2026-08-19 cut is now
`deckwave-0.8.0-2026-08-19.zip`, and `deckwave-0.8.0.zip` is the launch
package (97 files, cut 2026-09-01 on launch day). Renaming kept the old
snapshot; `--force`
would have destroyed it. The account below is why the step existed.

`deckwave-0.8.0.zip` was cut 2026-08-19. Version 0.8.0 was then **held by
decision** while the work kept landing, so the launch tree has seven files
that package did not:

    assets/deckwave-phrase.js        assets/deckwave-libre.js
    assets/deckwave-popout.js        assets/deckwave-events.js
    assets/deckwave-stretch.js       assets/deckwave-stretch.module.js
    assets/demo-set.json

Phrase match, ⊕ libre, the popout, DWEVENTS, the held stretch worklet and the
demo score — none of them are in it. It is a mid-August snapshot wearing the
launch version number.

**What happened on the day it was cleared:** `python tools/package.py` read
`VERSION` (0.8.0), saw `_source/deckwave-0.8.0.zip` already there, printed
*"refusing … already exists"* and stopped — exactly as `docs/LAUNCH.md`
predicted. The 2026-08-19 zip was renamed rather than overwritten, because
renaming loses nothing and `--force` loses the snapshot, and the launch
package then cut clean: **91 files at the time, 1.6 MB, all 33 files `index.html` loads
verified present.**

**And cutting it found an eighth missing file — in `package.py` itself.**
`assets/deckwave-stretch.js` is the wrapper half of the held worklet, fetched
at runtime by the blob fallback, so it is invisible to the index scan the way
`demo-set.json` and `deckwave-stretch.module.js` are. Those two were listed in
`EXTRA_FILES`; the wrapper never was, so **every package ever cut is missing
it.** Nothing was ever heard, because tier 1 — the static module — carries
playback and is present. But a restored package whose static module failed
would drop past the blob tier straight to the plain vendored worklet: the
gapping pipe that ledger 65 exists to retire. Fixed 2026-08-30, which took
that day's cut from 90 files to 91. (It reached its final 95 later the same
day, when `extensions/citywalk/` and its harness were tracked — a different
matter entirely, and not a fix; the README screenshot and `docs/UI-QUEUE.md`
took it to its final 97 on launch day.) The older zips in this directory still lack
the wrapper, and are left as cut.

## The captured states

| File | Captured | What it is |
|---|---|---|
| `deckwave-corpus-cache-2026-08-17.json` | 2026-08-17 | The analysed corpus as of that day: 189 records, features only — bpm, confidence, beat grid, key, camelot, rms, zcr, duration, filename. 44,804 beats over 10.7 hours. **Schema v1**, i.e. before the whole-track re-scan, so every grid stops at 119.9 s. |
| `deckwave-live-snapshot.json` | 2026-08-17 | The shape of the running app read out of a live page — every global's keys, the panel API, the transport state. No audio, no corpus records, no file handles; it says so in its own `note` field. |
| `deckwave-live-selects.json` | 2026-08-17 | Every `<select>` in the dashboard with its options, as they stood. |
| `deckwave-patches-v10.zip` | 2026-08-17 | The ten console patches (01–10) from the live-patching era, each a standalone module loaded after the dashboard mounted. The spectrogram fix, the now-playing card, FLAC tags, the render loop, the glossary, the corpus cache, the steering router, the wayposts panel, the route commit, the fast blend. `CLAUDE.md` calls that method a **fossil**, not a rule — this is the fossil. |
| `deckwave-skill-0.8.0.zip`<br>`deckwave-extension-skill-0.8.0.zip`<br>`deckwave-extension-console-skill-0.8.0.zip` | 2026-08-22 / 27 | The three installed skills as zipped, in their family order: `deckwave` → `deckwave-extension` → `deckwave-extension-console`. Their sources are `SKILL.md`, `extensions/SKILL.md` and `extensions/recon/SKILL.md`; the zips are kept in step with those and verified byte-identical when they are rebuilt. |
| `deckwave-skill-0.8.1.zip`<br>`deckwave-extension-skill-0.8.1.zip`<br>`deckwave-extension-console-skill-0.8.1.zip` | 2026-09-03 | The same three at 0.8.1 — the tags moved, and the console skill grew the full feed contract (every ingested field and every `voiceCfg` key with its range, `overdrive` named as an amplifier knob over unity) and the threat model at its real level (ledger 129). Built from the tree files by path; the 0.8.0 zips stay as the lineage. |

The corpus cache lists the keeper's library **by filename** — 189 track names,
sizes and durations. Personal, harmless, no audio, and it is the same set of
names the BUILD-LOG and LISTENING quote by title anyway.

## What is not here

- **`evidence/`** is the other half and it is a different thing: measurements
  that **cannot be regenerated** (the pre-fix v1 cache with its 119.9-second
  ceiling, the re-scan numbers, the phrase scan, the voice pipeline). Restore
  points let you run an old build; evidence is what the docs' numbers rest on.
  It has its own README.
- **Audio.** Not one byte, in any package, ever. The tree ships a *score*
  (`assets/demo-set.json`) and fetches its music at runtime with attribution.
- **The v2 corpus cache**, deliberately: unlike the v1 state it regenerates in
  twelve minutes.

## Cutting a new one

```bash
python tools/package.py            # reads VERSION, writes _source/deckwave-<VERSION>.zip
python tools/package.py --force    # only to rebuild one you deleted on purpose
```

It refuses to overwrite an existing version, and it refuses to build at all if
`index.html` references a file that is not on disk. Both refusals are the
0.5.0 lesson, made mechanical.
