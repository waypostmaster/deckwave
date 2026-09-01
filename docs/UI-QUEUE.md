# UI queue — findings from the 2026-08-30 audit, not yet fixed

**Where this came from.** The keeper pressed ▶ on a paused set and it restarted
from track 1 (ledger 114). Their words: *"the least surprising thing for the
play button to do when a deck is paused would be to resume from pause"* — and
then, when the whole UI was in question: *"in fact the whole UI needs a pass.
deep research on it or something?"*

What ran was **not** a redesign. Three read-only agents swept for one class:
**controls that do not do what their label implies, and surfaces that disagree
with each other about the same action.** A UI overhaul the day before launch
was the single riskiest thing available; this was the bounded version.

**What it produced, and where it went.** Nine one-line fixes landed the same
day — ledgers 114, 115, 116 and 117. This file is the remainder: the findings
that need a decision, a rewrite, or a measurement first. **It exists because
the audit's results otherwise lived only in a conversation, which this project
has already lost work to once.**

Every item below is **[INFERRED] from source** unless it says otherwise. Each
carries the falsifier that would settle it, because a finding you cannot
falsify is a guess.

---

## Small — a decision, then a few lines each

**Items 1, 2 and 3 were DECIDED and LANDED 2026-08-31** (keeper: *1b · 2-second
· 3-textContent · 4-hold for now*). They are kept here with the decision
recorded, because the reasoning is the useful part. **Item 4 is still open.**

### 1. The transition monitor cannot tell "playing" from "never played"

With a set built and nothing on a deck it draws `OUTGOING`, `INCOMING`,
animated bar ticks and the verdict `◉ PHASE LOCKED · periods match`. Measured:
that output is byte-identical to the playing case except the footer. The card
two panels away, at the same instant, correctly reads `stopped · cued at 1 of
3` — two surfaces, opposite claims, one screen.

The empty state is **unreachable**: `'no set playing'` fires only on `!cur`,
and `cur` falls back to `S[st.idx]`, which survives `stop()`. Ledger 87's
shape — a non-empty fallback making the honest path unreachable.

*Falsifier:* build a set, do not press ▶, look at the panel. If it labels rows
and prints a lock verdict, confirmed.
*DECIDED (b), landed:* rows drawn dimmed, verdict replaced by `cued · not
playing`. The preview is useful — it is what you are about to hear — and only
the LOCK CLAIM was dishonest. The marker is drawn independent of whether a
next track exists: nesting it inside the verdict block left the stopped state
unlabelled at the END of a set, which is one of the three ways to reach it.

### 2. The wayposts panel invents a tempo

`const Tnow = st.tempo || 120`. `tempo` is 0 until `play()`, so before the
first ▶ the panel prints **120 bpm** as the set's tempo, draws the "everything
the gate permits from here" annulus around it, colours every corpus dot by
`nav.reachable(120, t)` and prints a reachability **count** derived from the
fabrication. The header does it correctly two panels away: `s.tempo || '-'`.

*Falsifier:* load a library, build nothing, read the panel. `120 bpm` with a
count is the bug.
*DECIDED (second), landed:* corpus drawn unlit, no reachable annulus, and
`- bpm · no tempo until a set plays` where the figure was. You still see the
shape of your library; you are not told a number that is not true.

### 3. Listen mode shows the wrong glossary

The card relabels its four grid tiles to `level / register / width / phase` in
listen mode but never re-tags them, and the glossary map is **positional** —
`['bpm','key','stretch','energy']`. So hovering `level` returns the tempo
definition.

*Falsifier:* start `◉ input`, hover the first grid label.
*DECIDED (textContent), landed:* tagged from the label's own text, and an
unrecognised label gets NO tag — `DWMSG.term()` returns null and `show()`
bails, so a missing definition is silent where a wrong one is a lie with a
tooltip. Cannot drift the next time a label is renamed.

### 4. The phone's ▶ still has the pre-114 guard — and it is now the odd one out

`deckwave-phone.js` tests `ctx !== 'running'` with **no deck check**, so after
■ stop it resumes an empty context *and* calls `silentEl.play()`
unconditionally, flipping the lock-screen card to **playing with no audio**.
On iOS nothing pauses it back — the tidy-up is Android-only.

This was the surface that was *already right* about ▶ resuming, and the
inconsistency now runs the other way: the desktop learned `state.now` on
2026-08-31 and the phone did not.

*Falsifier:* phone mode `controls` → ▶ → ❚❚ → ■ stop in the page → ▶ on the
lock-screen card. Card reads playing; `DW.state` reads `{now: null}`.
*Decision:* add `&& st.now` and gate `silentEl.play()` on the same condition —
**but this is phone code, and every phone behaviour here is confirmed by ear
on a real device, not by harness.** It is one line and it is the keeper's
call whether to touch the phone transport without a device in hand.

---

## Structural — these need a policy, not a patch

### 5. Three controls reassign the play order while a deck is running

`build`, `▴ load set` and `▶ demo` all do a bare `dash.set = …` while the
Player keeps walking the array it captured at `play()`. `applyRoute` is
careful about exactly this — it calls `DW.reorder` and **refuses to adopt an
array the Player rejected**, with ledger 40's reasoning written above it. The
other three were never given the same treatment.

The failure is quiet: if the playing track also exists in the new list (the
common case when rebuilding from the same corpus) the `⚠ playing a track that
is not in this list` warning never fires, while `next`, the position count and
the arc marker all read an order the deck is not playing.

*Decision needed:* refuse while live · stop first · or route through
`reorder` and check the refusal. Not a launch-day change.

### 6. The demo's transport hold has two ways around it

`DWLIBRE.demo()` freezes five verbs on `window.DW` — `play, skip, back,
blendNow, queueNext` — so the controls say *"controls return when it is
home"* during a fetch.

- **`reorder` is not held.** `applyRoute` (⚡ and ↝) and every `DWEVENTS`
  steer reach the deck through `reorder`, not the five. So `next ▶` refuses
  while `inject('faster')` commits a whole route — a second path around a hold
  whose entire purpose is that there be one.
- **It is re-entrant.** `demo()` is public and has no in-flight guard of its
  own; the button's `disabled` flag is the only one. A second call captures
  the **stubs** as the originals and its `finally` restores stubs
  permanently — the transport never comes back.
- **The hold's message cannot reach the lock screen.** The comment says a
  silently dead button *"is indistinguishable from a lock screen"*; the phone
  handlers discard every return value, so the lock screen gets exactly that.

**This matters more than its size suggests: ▶ demo is the entry point on
deckwave.fm for anyone without a library.**

*Falsifier for the first bullet:* start a demo and run
`DWEVENTS.inject('faster')` while the button still reads `demo 2/6 · …`. A
committed route while `next ▶` refuses confirms it.

### 7. `◀◀` cuts where `▶▶` blends, and at index 0 it restarts the set

`DW.back()` → `play(order, max(0, idx-1))` → `ctx.resume(); this.stop()`. So
the only ◀◀ in the product cuts, while ▶▶ has blended since 2026-08-19 — and
the asymmetry is nowhere documented. At index 0 it is **ledger 114 still
live on the phone**.

Side effect worth naming: `play()` resets `gapsHanded = 0`, so ◀◀ silently
zeroes the session gap tally that the card's `⚠ N gaps` — the popping
investigation's own instrument, LISTENING §7 — is counting.

*Decision:* guarding index 0 and preserving `gapsHanded` are one line each.
**A blending `back()` is structural — nothing plans a backwards transition.**

### 8. The card's `◉ BLENDING NOW` lasts about 100 ms

`transLeft` is `max(0, DW.blend.in)`, and the handover fires 100 ms after the
fade starts. At that instant `A` becomes `B`, `DW.blend` recomputes, and
`blend.in` jumps to minutes — so the card shows BLENDING NOW for a frame or
two and then reports the *next* blend as minutes away **while the crossfade is
still running and audible**.

The transition monitor already diagnosed and fixed this, in a comment naming
both causes. The card never got it. `DW.prevDeck` carries `prog`,
`fadeElapsed` and `xfade` and returns null exactly when the fade ends.
**~6 lines, once `prevDeck` is plumbed into the card.**

### 9. RECON's overdrive can leave the master gain at 1.5

It writes `DW._dev.master.gain` directly, past the setter's own 0–1 clamp, and
restores only `if (DW.volume === 1)`. Move the dashboard slider, the eleven
dial, or land a `level` record mid-utterance and the equality fails — master
stays at 1.5 indefinitely. The code declares itself an experiment through the
`_dev` seam, so it is disclosed rather than hidden.
*Decision:* restore unconditionally on the same tick. One line, but it is the
voice path and the keeper's ear owns that chain.

### 10. Saved views are easier to destroy than to delete

`save()` overwrites an existing name with no confirmation; `import()` does
`Object.assign` over every colliding name silently; `remove()` exists with no
UI. Separately, `layout: auto` on a wide screen clears the folded state and
resets every panel slot — **documented in-code as deliberate**, but the label
reads as a display preference. Both are policy questions, not bugs.

---

## Cosmetic

- `build set · all tracks` passes `length: 500`; `sequence()` caps at it while
  the button says *all tracks*. Unreachable at 189 tracks — but it is a
  hardcoded argument where the live value was meant, which is the seam that
  produced ledger 114.
- `▾ save set` hardcodes `xfade: 16` in the score summary; the deck's xfade is
  live via `setXfade`. Per-step figures are computed correctly — only the
  summary lies. Console-only reachability.
- The view selector names `default` after you save or import a view.
- `↺ reset to default` logs *"views reset"* and resets panel slots only.
- `✓ demo` never resets, so it still reads ✓ after a different set is built.
- `state.tempo` survives `stop()`, so the header keeps showing a rolling target
  after ■.
- **Four surfaces preview the cued track with no "not playing" marker**
  (position, journey, camelot, arc) while two label it (route, card). The
  index fallback is deliberate and documented; the *inconsistency* is the
  finding. Camelot is the worst — it animates.
- The polygraph has no "no signal" state: before boot it draws five labelled
  lanes and five parked dots, which reads as five channels measuring zero.
  Every neighbouring panel has an empty state.
- The popout prefers `DWLOOP.last` whenever the opener is visible and prints
  no age. If the opener's rAF ever stops, the projector redraws one frozen
  bundle at 60 fps **on a second screen, in front of an audience**, with
  nothing saying so. Low likelihood, high blast radius; RECON's stage answers
  the same problem with `still` + age + a 90 s line.

---

## Two things the audit checked and found CLEAN

Recorded so nobody re-runs them.

- **`DWEVENTS` steers through the same gate and router as everything else** —
  the README's claim, traced end to end rather than assumed. `pick()` filters
  on the same `DWNAV.GATE`; in-gate goes to `W.blend`, which is *literally the
  dashboard's own function object*; out-of-gate goes through
  `commitAndRepair` + `reorder`, refusal check included; `change` is the same
  `DW.skip()` that `next ▶` calls. One qualification: `steer()` does not check
  the `set[idx] === DW.nowMeta` invariant before indexing, and the blend branch
  is unprotected where the route branch is not.
- **Deck-vs-index reads.** Every surface opened reads `DW.nowMeta` / `deck` /
  `nextDeck` first with the index as fallback. **No surviving instance of
  ledger 33/40's original defect** anywhere in the tree.
