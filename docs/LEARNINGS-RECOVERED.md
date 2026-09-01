# Learnings recovered from the build conversation

Mined 2026-08-17 from the 499-message session transcript, and diffed against
`BUILD-LOG.md`. Everything here is **absent from the build log or recorded
without its measured numbers**. Message references are to the transcript
archived at `_source/`.

The build log is contemporaneous and accurate. This is not a correction of it —
it is the material that did not survive the writing-down, found by reading the
whole thing rather than the parts already known to be interesting.

---

## 1. The saturation table is missing its fourth row

**This is the most important item here**, because the table is the artefact this
project cites most, and it undercounts.

`BUILD-LOG.md:302` lists three cases. The session recorded four. The missing one
is the spectrogram (msg 447), and it is the case where the lesson had already
been learned three times:

| | Signal sat at | Threshold | Result |
|---|---|---|---|
| Spectrogram | −23 dB p10, −10.1 median, −3.7 peak | −62 dB floor | median mapped to 0.84, quiet parts to 0.63 — a solid block |

The fix came only from printing the actual percentile distribution instead of
choosing a floor that sounded reasonable: floor −50, ceiling −3, gamma 3, giving
−23 dB → 0.19, median → 0.61, peak → 0.96.

Those numbers live in `assets/patch-01-spectrogram.js` as a code comment. They
were never added to the table.

**It took three passes** — "printer static", then a solid block, then correct.
The first two both looked like plausible fixes.

> Add this row. A table titled as the record of a repeated mistake, which
> stops one short of the actual count, teaches the wrong lesson.

## 2. Why the new confidence numbers were believable — the evidence, not the number

`BUILD-LOG.md` records the 0–5.32 scale and that the two detectors are not
comparable. It does not record **what actually made the second detector
credible** (msg 354).

The old detector medianed 0.096 on a modal-count-over-total scale capped at 1.
Essentia medianed 2.17 on 0–5.32. Those cannot be compared, and the improvement
was not evidence of anything.

The evidence was that **the answers started looking like music**: Magnétique at
exactly 125.0, Chiptune Ride at exactly 120.0, 199X at 129.95. Programmed
electronic music sits on round numbers, and the old detector never produced
them. Supporting: 204 of 350 tracks above 2.0, only 14 below 1.0.

**The transferable rule: when you cannot compare two metrics, look for a
property the right answer would have and the wrong answer could not fake.**

## 3. Energy hides a wrong tempo

Recorded nowhere. From msg 343, and it is a guard, not a curiosity.

Energy is 45% loudness, 25% brightness, 30% tempo — so **70% of the index does
not depend on BPM at all**. Two tracks with confidence 0.073 and 0.072, both
effectively tempo-detection failures, still received energies that looked
entirely sensible in the ordering.

**A wrong tempo does not announce itself in the energy figure.** The index
degrades gracefully, which is a virtue for sequencing by mood and a hazard for
trusting the arc as evidence the tempo analysis worked.

## 4. The sample size changed the verdict, on the same detector

From msgs 343 and 347, absent from the log.

- 14 tracks, one album: median confidence 0.154 → verdict **usable**
- 35 tracks, across the catalogue: median 0.096, 23 of 35 weak → verdict **unreliable**

Same detector, same code. The wider sample was the honest one.

**A verdict measured on one album is not a verdict.** Worth keeping given that
every threshold in this codebase was tuned against one artist's catalogue.

## 5. The first sequencer failed three ways at once

`BUILD-LOG.md` Act 4 records the collapse. The measured detail (msg 370) is not
there, and the third failure is the interesting one:

- **57 of 187 tracks over the stretch budget.** The closing track sat at 80.87
  BPM against a 123 target — **+52%**.
- **The dedupe leaked.** The key stripped the artist prefix but not the album,
  so the same track on an EP and an album survived as two entries.
- **175 of 186 transitions rated "perfect" on key.** That was not success. The
  scorer weighted Camelot at 0.38, found it could always satisfy it, and
  therefore ignored tempo entirely.

**A constraint that is always satisfiable is not a constraint, and a metric
reading near-perfect is a reason to distrust the metric.**

## 6. Memory dictated the architecture

From msg 370. 364 tracks is roughly twenty hours of audio; decoded, tens of
gigabytes. That is why the sequencer plans the entire order up front from stored
features and the player decodes **just-in-time, one track ahead, discarding
behind** — the same analyse-then-discard pattern that made the corpus scan
possible at all.

Worth recording because **the offline renderer hit this exact wall again** on
2026-08-17: the 115-track set needs 4.46 GB in an OfflineAudioContext and cannot
be rendered whole. The constraint is structural, not incidental.

## 7. getImageData ignores the canvas transform; fillRect respects it

From msg 459. In `patch-01`'s comments, not in the log.

At `devicePixelRatio` 1.75, a scroll-and-draw panel operated on a 233×259 corner
of a 455×453 buffer while drawing elsewhere. The right-edge pixel read
`[0,0,0,0]` — nothing there at all.

**It would have worked perfectly on a non-retina display.** The fix is to
`save()`, `setTransform(1,0,0,1,0,0)`, do the pixel work in device pixels, then
`restore()`.

## 8. A closure captured a stale array and sized nothing

From msg 413. Same silent-failure family as the above.

`fit()` closed over the original six-element `ids` array. Two canvases added to
the map afterwards were never sized, so they drew into the browser default
300×150 buffer stretched across 599×798 of layout — **throwing nothing**. The
panel code was correct the entire time.

The packaged dashboard now carries `/* iterate the LIVE map */` as a comment.
The measurement that produced that comment is here.

## 9. The analyser tap read zero while the audio was fine

From msg 356. Two bugs at once, both in the instrument rather than the signal:

- `master → analyser` with the analyser's output left dangling. **A node in a
  branch that never reaches the destination is not reliably pulled through the
  graph.** Fixed with a silent sink.
- The clock read 883 s, which was the **AudioContext's lifetime**, not the mix's
  elapsed time.

A 440 Hz test tone through the same master node was what separated "my
instrument is broken" from "your audio is broken" — and it needed the keeper's
ears, because the tooling could not tell the difference.

## 10. State that lives only in a function call cannot be returned to

From msg 457. Logged there as its own failure; the phrasing is worth keeping.

MEGA layout was first applied imperatively, so there was no way back to it. It
became a `layout` dropdown option. The same shape appears elsewhere in this
project — anything set by calling a function and not recorded as selectable
state is a one-way door.

## 11. Canvas orphans accumulate across rebuilds

From msg 449. 21 canvases had accumulated in the map from repeated slot
rebuilds. Harmless individually, and exactly the kind of thing that is invisible
until something iterates the map.

## 12. The duplicates were known on day one

From msg 354: Magnétique appeared **four times** — on *Home Arcade*, as a
single, and with `(1)` filesystem copies.

This is the same issue found again on 2026-08-17 at larger scale: the `_all/`
folder duplicates 175 of 364 files. IndexedDB dedupes by `id`
(`name|size|lastModified`) which is why the corpus cache holds 189 while
`DW.corpus` holds 364. **Not a bug in either place** — but it means corpus
counts and cache counts legitimately disagree, and anyone comparing them without
knowing this will conclude something is broken.

## 13. A low confidence score can be the correct answer

From msg 354. *Carrier Wave* scored 0.169 at 52 seconds long — an album intro.
The detector was right to be unconfident.

Useful as a calibration anchor: **not every weak score is a detector failure**,
and a corpus-wide median is the figure to judge, not individual outliers.

---

## Ledger arithmetic

The conversation's last stated split was **self 5, measurement 6, keeper 8**
(msg 467, 19 rows). `BUILD-LOG.md` now carries 23 ledger rows, so four were
added after that point. The split is worth recomputing when the log is next
revised — the ratio of self-caught to keeper-caught is the most interesting
number in the document and it is currently stale.

## What the mining confirmed rather than added

The build log's account of the blackout (Act 15), the invented constraint
(Act 10), the VU double failure (Act 14) and the wiring pass (Act 17) all match
the transcript, including their measured numbers. Nothing in the log was
contradicted by the source material.
