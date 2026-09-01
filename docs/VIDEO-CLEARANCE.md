# Build video — clearance sheet & shot list

One page, assembled 2026-08-21 from `LAUNCH.md` ("Music in the build video"),
`BUILD-LOG.md`, and `assets/demo-set.json`. The licence facts were fetched
from lukhash.com/licensing.html on 2026-08-19; if the video slips months,
re-fetch the page.

## The rule, one line

**YouTube and Twitch: yes, with every track credited in the description.
Anywhere else (repo, Vimeo, deckwave.fm, a conference): email LukHash first.**
Content ID will claim most tracks (only *Better Than Reality* is exempt) —
that is the intended outcome, decided 2026-08-19: *"This app is literally a
love letter to LukHash so he can take control of the monetization."* The
video stays up either way; ad revenue goes to his publisher.

## The library, split 2026-08-21 (`C:\Claude\Music\LukHash`)

| Folder | Tracks | What |
|---|---|---|
| `Cleared for YouTube-Twitch` | 172 | Solo LukHash originals — inside the platform grant ("all **original** LukHash tracks") |
| `On-device only` | 17 | Everything the grant does not clearly cover (below) |

**On-device only, and why:**

- **THRILLER** (cover) — Rod Temperton composition; Sony/ATV runs Content ID
  aggressively, can block by territory. Hard out.
- **Big in Japan** (LukHash & Meredith Bull) — Alphaville cover, same class.
  *(Not in the original LAUNCH.md table — added at the split.)*
- **C64 reMIXed 01–09** — covers of SID composers (Hubbard, Tel, Hülsbeck,
  Gray, …), protected into the 2050s–2090s (LAUNCH.md has the table).
  **"Not cleared, low risk"** — SIDs are rarely in Content ID, and the Twitch
  line says "all LukHash tracks" without the "original" qualifier. Keeper's
  call to promote any of these; the sheet only records that it *is* a call.
- **Collabs** (Caspro ×2, Shirobon ×1, Waveshaper ×2) — original music but
  co-owned; LukHash's page cannot clear the other artist's share. **Judgment
  call made at the split, not stored research — likely clearable with one
  email; drag them over if you get a yes.**
- **The Last Escape** (Terrorbytes documentary OST rip) — LukHash original but
  the documentary's publisher is unverified. Same class of call.

The **Paradigm Shift** YouTube rip stayed in Cleared: same original as
Transient Offworld 06.

## Soundtrack — the saved set is the edit decision list

`assets/demo-set.json` (phrase-match build; loading it replays the identical
mix). All from *Digital Memories*, CC BY-NC-SA 3.0 PandaCD edition, fetched
with attribution on the card:

| At | Track | Exits at |
|---|---|---|
| 0:00 | Stand Alone | 2:30 |
| 2:30 | Prelude | 3:12 in-track |
| 5:43 | **Gone Too Soon** | 8:14 in-track |
| 13:57 | Winter Error | 3:10 in-track |
| 17:08 | We Come Together | — |
| 21:12 | 8 Bit No Tamashi | — |
| 26:35 | Tonight | — |
| 31:41 | Digital Memories | — |
| 34:39 | WTF? | — |

## Shot list

1. **The set plays** — panels live; the card's `☉ creator · licence · from
   archive.org` visible per track (the attribution reel is the UI itself).
2. **Goniometer beauty shots** — Prelude and Gone Too Soon (keeper: *"Both
   Prelude and Gone Too Soon are lovely on the goniometer"*).
3. **Gone Too Soon's rain outro** — the centre and sides give up on the
   goniometer; the long rain moment **carries the credits**: per-track terms,
   Wikimedia, the Internet Archive, Essentia (AGPL), SoundTouchJS (MPL-2.0),
   libflac.js, the licences themselves.

   **The last card of the credits is a DEDICATION.** Its wording is settled
   (keeper, 2026-08-23, verbatim and final) and is deliberately **not in this
   repository** — it names a family member, and a public tree with fresh
   history that Software Heritage archives and resists deleting is not
   somewhere to put that. It is held with the keeper's private notes and
   goes on the card at edit time.

   The beat is what this sheet needs, and the beat is: it goes **last** —
   after every licence and every attribution, the software credits first and
   the person at the end. Hold it alone on the rain; the outro has the room
   (Gone Too Soon exits at 8:14 in-track, the
   longest step in the EDL). Nothing follows it before Winter Error kicks
   back in.

4. **Winter Error kicks back in over the fails** — canonical source: the
   failure ledger (120 rows in BUILD-LOG), each a caught mistake with who
   caught it. The red CRLF commit, the seven diagnostics that measured
   nothing, the panel that mounted behind the app.
5. **The blackout beat** (BUILD-LOG Act 15, "Why it works as a video beat") —
   the rAF chain dies, four questions narrow it, everything returns at once.
   **Do not stage it in the edit** — the ragged real sequence is the point.
6. **The guitar intro** — keeper plays Gone Too Soon's opening (enters ~8 s
   in). Estimated, F# minor, ≈2 s per chord: `A — B — F#m (hold)`, then
   `A — E — B — C#m — (D#º passing)`. Capo 2: `G — A — Em` / `G — D — A — Bm`.
   Play thirds sparingly (the track's guitar omits them). **An estimate — the
   ear and LukHash outrank it.** Symmetry: the intro he plays belongs to the
   song whose outro rolls the thanks.

7. **Pitch classes at the start of Lullaby** (keeper, 2026-08-21, live:
   *"the pitch classes work beautifully at the start of Lullaby"*) — the
   chromagram/pitch-class panel over Lullaby's opening. Narrative bonus:
   the panel was built near the project's beginning, and here it is
   carrying song three of a set. A longer cut than the 9-song EDL is on
   the table if the material wants it — the saved-score mechanism makes
   any set a timestamped edit list.

8. **The spectrogram under Lullaby's opening** (keeper, 2026-08-23, with
   a phone screenshot: sparse melodic strikes hanging in A5-A7, then the
   broadband bloom flooding the panel like a wall of light; deck strip
   reading 3/89 · 107 · 8A · -7.8%). The SECOND time Lullaby's first
   bars stopped the keeper by eye - pitch classes before, spectrogram
   now. Lullaby's opening is the canonical beauty moment; shoot both
   panels over it.

9. **The seance** (Act 36) - every voice the night made, at once, over
   the set: Karen, plain Zira, facility Zira. "Is this snow crash?"
   Deliberately re-creatable despite the fix: append several speak and
   sayfile records within one poll window (the quiet-boot gate only
   stops ACCIDENTAL replay). The append-only scroll that ran the whole
   night is evidence/recon-feed-2026-08-23.jsonl - the feed itself can
   be a shot, scrolling.

10. **The goniometer on NEON THRILLS - and the scope beside it** (keeper,
    2026-08-23: *"goniometer is BANGER on NEON THRILLS, scope looks good as
    a pair too"*). The third by-eye panel report and the first one that
    names a PAIR: `gonio` (Lissajous stereo field) and `scope`
    (oscilloscope) side by side, which is how the dashboard already stacks
    them. Shoot them together, not one at a time.

    **Which cut** - the library holds three and they are not the same take:
    *BETTER THAN REALITY 02* and *NEON THRILLS -Single- 01* are
    byte-different files with identical analysis (109.88 bpm, F# minor,
    **2A**, conf 2.153, 263.9 s, grid coverage 99.76%); *CyberChip 07 Neon
    Thrills 8580R5* is a different arrangement at **107.44** bpm, same key,
    conf 0.719. Name the cut in the shot notes or the tempo strip will
    contradict the edit. All three are in `Cleared for YouTube-Twitch`, so
    the platform grant covers this shot.

    **Pairs with shot 2** (Prelude / Gone Too Soon) as the goniometer set:
    those are *fetched* CC material, this is the keeper's own library -
    between them the panel is shown drawing both sources. And note for the
    §12 phrase-match cut: the album/single cut's phrase contrast is **4.56**
    against a library median of 2.3 - DWPHRASE's own ratio, comparable to
    nothing outside that file and no threshold applied, but it is a
    high-contrast track by that measure and the ¶ transitions may read well
    on it.

## Not cleared — the standing exclusions

- Nothing is cleared for a **monetised** cut of the libre/dedication video;
  LukHash platform grant aside, **-ND material never goes in a soundtrack**
  (the mix is a derivative), BY-NC-SA is fine un-monetised with attribution.
- Covers and collabs per the table above; outside YouTube/Twitch, email.
- Public domain rescue on the covers: none before 2054, realistically 2080s+.
