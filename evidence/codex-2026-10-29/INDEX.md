# Codex, nine read-only runs, 2026-10-29 (ledger 153n)

gpt-6-astra, xhigh, `-s read-only -a never`, each from its own empty directory,
`--ignore-user-config`, web and connectors off. Launched 12:30:26Z, last back
12:58:42Z, all exit 0. Sources were read from `origin/main` (`f115138`).
Prompts and the build/scan/launch scripts are kept outside the repo, at
`C:\Claude\outbox\deckwave\codex-2026-10-29\`.

**Every verdict here is CODEX'S and [INFERRED] unless the "desk" column says
otherwise.** Each run saw only the files pasted into it. A "the other N
commits are missing" line in r1a/r1b is an artefact of splitting the sixteen
across two runs, not a finding.

## r1a / r1b: second read of the sixteen 153l commits (live, unseen)

| commit | finding | Codex | desk |
|---|---|---|---|
| 0f20006 | F72 card after listen | SOUND | — |
| 121a5a8 | F86 ring order | SOUND-WITH-NOTE: the check records `beginPath`, not `stroke`, so a trace that is never painted passes | — |
| b409352 | F87 wayposts radii | SOUND-WITH-NOTE: removing the whole band also passes the check | — |
| 654f8db | F104 party release | SOUND-WITH-NOTE; pre-existing: an async butterchurn load can attach to a REOPENED window | not re-checked |
| b8a6834 | F1 boot cleanup | SOUND-WITH-NOTE: counts, not identities; closing ctx #1 twice would pass | — |
| c338226 | F2 audio regex | SOUND | — |
| 555cfa7 | F97 score names | SOUND-WITH-NOTE: also changes ambiguous LATIN fallback (`A_B` against `A-B` + `AB`) | not re-checked |
| 52c848d | F48 tooltip | SOUND-WITH-NOTE: the examples are not compared to the table | — |
| ca25f5c | F49 discard | SOUND-WITH-NOTE: the pending counter is global, so preparing B while A starts refuses B's discard | not re-checked |
| 311c1b0 | F94 lock-screen title | **WRONG**: `A-ha - Song` keeps its artist (the old cleaner gave `Song`) | **OVERSTATED.** MEASURED: the new regex is the one `deckwave-nowplaying.js:109` and `deckwave-panels.js:100` already use, so the three surfaces now agree; the hyphenated-artist case is a pre-existing limitation of all three, not a regression of this commit. The keeper's corpus has no hyphenated artist. Fix all three together or none. |
| 98e92b2 | F123 late art | SOUND-WITH-NOTE; pre-existing: the art bundle `bnd.D.now` and the metadata `DW.nowMeta` can disagree; the "next tick draws" control is decoration | not re-checked |
| 29858fb | F136 steer reports | **WRONG**: an older request's refusal overwrites a newer decision | **CONFIRMED by reading** (`deckwave-events.js:65`, `:153–156`, `:171–178`): `last` is module-global and the refusal branches write `last.how`/`last.result` after an `await`. Introduced by this commit. Affects `status().last` only, not audio. Fix: hold the decision object locally. |
| 8362046 | F132 GNU licence names | SOUND-WITH-NOTE: a URL with leading whitespace now returns null, not GPL; no positive FSF case | not re-checked |
| 67e8875 | F133 last search wins | SOUND-WITH-NOTE: the cross-source case only covers a stale ARCHIVE request | — |
| aae4eda | F137+F152 cap | SOUND-WITH-NOTE: the "all of its bytes" control compares lengths only | — |
| 6adf078 | F151 JSON slot | SOUND-WITH-NOTE: no rejected-JSON variant | — |

## r2: the priority-2 rows against today's code (patch + check for each)

Codex's verdicts (not re-checked by the desk): **engine-core** F15 REAL ·
F21 REAL · F24 REAL (comments) · F28/F33 REAL (notice) · F98 CAN'T-TELL ·
F107 REAL, heard path. **dashboard** F40, F46/F55, F47, F54/F57 REAL · F39,
F41, F51 CAN'T-TELL (files not sent). **panels** F60, F64/F71/F90,
F65/F76, F68/F73/F88, F69/F74/F81, F70/F75, F83, F91 REAL · F118
CAN'T-TELL. **io** F101/F128, F111/F106, F119, F120, F121, F127, F140,
F147, F150/F135 REAL. The build orders are at the end of each file.

## r3: the keeper-class items (offline instruments + listening scripts)

r3a: 11 items; Codex calls the reorder decode race FIXED and the rest REAL,
most of them heard path. r3b: 9 items, two CAN'T-TELL. Both end with a
listening order, cheapest first.

## r4: a fake AudioContext that records AudioParams (`r4-extracted/`)

`fake-audio.js` and `check-player-audio.js` are Codex's code, extracted
verbatim from `r4-fake-audio.md`. They use built-ins only, and nothing in them
writes, spawns or uses the network (grepped before running). **The desk RAN
them, in a scratch directory, against `origin/main`'s `assets/deckwave.js`
(sha256 `074971f7…a84ce5`):**

- `run-on-f115138.txt`: **8 FAILED of 41.** The cancelPending snap
  (keeper-items, heard-path/medium, fable + opus) is **MEASURED in this
  fake**: a replan with the incoming deck 12.5% into its fade-in after
  handover steps its gain from 0.208 to 1. That is the same 0.208 → 1.000
  the 10-22 opus reviewer measured with a different rig. The opener's own
  fade-in steps from 0.5 to 1.
- `run-on-hold-mutant.txt`: the same source with A's two
  `cancelScheduledValues` + `setValueAtTime` pairs replaced by
  `cancelAndHoldAtTime`: **4 FAILED of 41.** The opener case and every
  after-handover case go green, so the check discriminates; it is not red
  on everything. Hold is NOT the proposed fix (Codex: the entry ramps must
  continue to their ends); it is only the falsifier's other half.
- The four that stay red are "overlap BEFORE handover": the outgoing deck
  goes back to full and the incoming one is cut. **[INFERRED] reachable only
  when the handover timer fires late**, since `armHandover` fires at
  `out + 0.1 s` (`deckwave.js:1868`); a throttled background timer is the
  plausible route. Not measured.
- What this cannot see: real Web Audio rendering, the worklet, audibility.
  Codex's evaluator is its own model of the automation spec, not checked
  against a browser. **The snap is MEASURED in a fake and UNHEARD.**
