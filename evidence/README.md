# evidence

Measurements kept because they are hard to reproduce once fixed.

## deckwave-cache-v1-2026-08-17.json

The complete IndexedDB analysis cache (`deckwave` / store `f`), 219 records,
exported 2026-08-17 immediately before the D5 fix and before any re-scan could
overwrite a record. Every record is schema v1.

This is the state that produced the early exits and the popping through a mix.
It cannot be regenerated: re-running the analyser now writes v2 records.

**The number that makes the case: the latest beat in any of the 219 tracks is
119.9 seconds.** Not one grid reaches 120s, because `analyse()` read a centred
120-second excerpt and stored Essentia's excerpt-relative ticks as absolute
track positions.

| | |
|---|---|
| Records | 219 |
| Latest beat anywhere in the library | 119.9s |
| Median grid coverage of tracks over 120s | 60.6% |
| Tracks exiting more than 20s early | 188 |
| Music never played | 236.7 minutes |

Worst six, by how early the track blends out:

| Early by | Duration | Last beat | Coverage | Track |
|---|---|---|---|---|
| 371.8s | 507.0s | 119.2s | 23.5% | DIGITAL MEMORIES — 13 GONE TOO SOON |
| 247.5s | 382.9s | 119.4s | 31.2% | BETTER THAN REALITY — 14 STARGAZE |
| 216.6s | 352.2s | 119.6s | 34.0% | LAST NINJA 2 — CENTRAL PARK (1988) Matt Gray |
| 209.4s | 344.9s | 119.5s | 34.6% | DIGITAL MEMORIES — 12 PURE COINCIDENCE |
| 192.8s | 328.3s | 119.5s | 36.4% | Metallica — Load — 05 King Nothing |
| 186.7s | 322.5s | 119.8s | 37.2% | DIGITAL MEMORIES — 05 8 BIT NO TAMASHI |

*GONE TOO SOON* is the worst offender in the library and nobody wrote it that
way. 507 seconds long, blending out at 135. Six minutes of an eight-and-a-half
minute track never played.

`summary.worst20` in the JSON holds the full ranking; `data` holds every
record intact, beat grids included, so the truncation can be shown rather than
described.

## rescan-2026-08-18-measurements.json

The first full whole-track re-scan: 179 tracks at `ANALYSIS_V = 2`, zero
failures. Per-track cost, grid coverage and the v1 figures for the same track
side by side, plus the memory series summary. BUILD-LOG Act 22 is the account.

The v2 cache itself is NOT kept here, because unlike the v1 state it can be
regenerated — in twelve minutes. These measurements cannot.

| | v1 | v2 |
|---|---|---|
| Latest beat anywhere | 119.9s | **506.23s** (of 507.0s) |
| Median grid coverage | 60.6% | **99.71%** |
| Worst grid coverage | 23.5% | **99.18%** |
| Largest grid | 278 beats | 1044 beats |

Cost: **12.0 minutes** for 10.0 hours of audio — 19.9 ms per second of audio,
about 50x realtime. Peak renderer working set **851 MB** against a 74 MB idle
baseline, sampled from outside the browser because neither the decoded buffer
nor the WASM heap is visible to `performance.memory` and the analysis blocks
the main thread. Peak by quarter of the pass: 833, 851, 820, 821 MB — **the
ceiling is the longest single track, not the size of the library.**

Two changes nobody asked for, both needing an ear rather than a threshold:
three tracks flipped to double tempo with the grid doubling to match, and
confidence fell corpus-wide (median 2.181 → 1.783), taking the sequencer pool
from 170 tracks to 160.

## deckwave-cache-v2-grids-2026-08-19.json

The 189 v2 records' grids — `id name bpm conf dur beats` only — exported
from the IndexedDB store at the `127.0.0.1:8777` origin (the one the
2026-08-18 re-scan ran against; `localhost:8777` is a different origin with
an empty store). Exported 2026-08-19 so `tools/phrase-scan.js` can run the
phrase detector offline on the same grids the page uses. Regenerable from
a browser that holds the cache; kept because the scan's numbers are
against exactly these grids.

## phrase-scan-2026-08-19.json

`tools/phrase-scan.js` over all 189 tracks, detector v1: per-track 8-bar
offset, contrast, shuffle count, half-split offsets, downbeat probe, grid
regularity (`oddIntervals`, `oddRuns`), and timings. The summary block is
what BUILD-LOG Act 29 and ROADMAP D10 quote. Regenerable in two minutes
with the library on disk; kept so the numbers in the docs can be checked
without it.

**PUBLISHED SUBSET, 2026-09-01.** `deckwave-cache-v1-2026-08-17.json` ships
with **189 records, not the 219 it was measured as.** The 30 removed were not
part of the chiptune corpus this evidence is about — they entered the cache by
a different route, were never curated, and their ids carry acquisition
timestamps for private listening that has nothing to do with beat grids. The
189 corpus records are untouched and carry the entire measurement. Where this
README and the BUILD-LOG say **219**, they describe the cache AS MEASURED on
2026-08-17, and that number stays correct for the measurement.
