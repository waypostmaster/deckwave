# Code review — the console diff (Acts 38–39), 2026-08-28

**Scope:** `a862eff..HEAD` — the instrument column (Act 38), the stage
(Act 39), ledgers 83–85, `tools/recon-shot.py`. ~1,370 lines across 14
files, mostly `extensions/recon/recon-app.js`, `extensions/recon/index.html`,
`tools/check-recon.js`.

**Method:** multi-pass review at high effort, every finding adversarially
verified against the code before surviving. 14 CONFIRMED by verification,
2 PLAUSIBLE, 0 refuted. **All of these are [INFERRED] in the ledger's
sense** — confirmed by reading and tracing the code, none demonstrated
live. None was fixed at review time; the keeper asked for the review, not
the repair.

**What held up:** the diff is well-defended on the axes it names —
escaping, `shot` path matching, no new network surface, teardown symmetry
all check out, and every deck-API field shape `recon-app.js` assumes
matches the engine exactly.

**Where the findings cluster:** three places. Silent frame loss in the
shot pipeline (1–2); the console trusting frozen or proxy state where it
promises deck identity (3, 4, 7); and the diff's own "never silent /
never read as fresh" discipline stopping one path short (5, 6, 8, 9, 10).

## The ten, most severe first

1. **`tools/recon-shot.py:64` — shot filename collisions overwrite frames.**
   The name is a second-resolution timestamp + sha256 of the source PATH
   (not content). A driver reusing one screenshot path (`shot.png`, the
   common pattern) twice inside a second produces the identical target
   name; `shutil.copyfile` silently overwrites the first frame while both
   feed lines reference it. Stepping back with ‹ then shows the wrong
   picture under the earlier record's url/title — the mislabelled-still
   lie the stage's own design text forbids.

2. **`recon-app.js:409` — the seen-dedupe key ignores every new field.**
   The key is ts + hash of ts|title|url|note only — not `shot`, `status`,
   `links`, `sayfile`, `event`, `speak`. Two same-second stagings of the
   same URL (recon-shot.py stamps ts at 1 s resolution, title/note default
   '') produce identical keys; the second record is silently dropped, no
   log, no counter. Compounds finding 1: the newer frame's record is
   dropped AND its image overwrote the older frame's file.

3. **`recon-app.js:768` — `deckSet()` prefers the frozen bundle over the
   live getter.** The deck iframe is `display:none` when folded (RECON's
   default), its rAF stops, `DWLOOP.last` freezes; since the frozen set is
   non-empty the live `DWDASH._dev.set` fallback is never reached. After
   any rebuild or committed route while folded, the ribbon draws the stale
   play order, the playhead indexes into the wrong array, and LIST ≠ DECK
   compares fresh `state.idx` against a stale set. The fallback priority
   is inverted: snapshot beats live getter.

4. **`recon-app.js:904` — the playhead fallback disables its own red
   flag.** When the displayed set lacks `DW.nowMeta`, the playhead falls
   back to `state.idx` — an index into the PLAYER's order — applied to
   the DISPLAYED array, and the LIST ≠ DECK check requires `di >= 0`, so
   it provably cannot fire in exactly that case. A best-matches rebuild
   that excludes the playing track animates the playhead confidently over
   an unrelated track, flag suppressed. The display is most wrong
   precisely when its red flag is disabled.

5. **`recon-app.js:96` — `playSayfile` guards `!ctx` but not a SUSPENDED
   context.** `DW.pause()` suspends the context (so does an Android call
   via the calls feature); decode resolves, `src.start()` succeeds
   silently. A press of the lit, armed `again` or a ▶ take row produces
   no sound and no marker — and the queued source bursts out when the
   deck later resumes. Ledgers 84/85's class, one path over. Nothing in
   recon-app.js reads `ctx.state`.

6. **`recon-app.js:84` — `sayMark` fails silently on an empty feed.** It
   falls back to the newest `#feed .rec` row and bare-returns when none
   exists, so on a fresh console with an empty recon.jsonl the "deck not
   ready" marker and verifySpoke's markers vanish — ledger 77's failure
   verbatim, re-opened inside the rewrite that claims to close it. Also:
   the `top.querySelector('.wait')` guard drops any second failure text,
   and operator rows permanently carry a `.wait` span that blocks even
   the first.

7. **`recon-app.js:951` — `idx === 0` does not mean "first deck".**
   The ledger-82 row keys on `st.idx === 0` alone, but `placeNext`
   decrements idx when a row before the playing track is queued away — a
   stretched chained deck can end up at idx 0 mid-play and be labelled
   `first deck · nothing to match`, hiding its real stretch percentage.
   The inverse of ledger 82's lie: a real stretch hidden rather than a
   fake 0.00% shown.

8. **`recon-app.js:640` — the stage age line trusts the producer's
   clock.** `age = max(0, now − Date.parse(ts))`; a producer clock ahead
   of the viewing device (PC stamps, phone views over --lan — the
   documented deployment) clamps every frame to `0 s old` and delays the
   90 s "somewhere else" flip by the full skew. The feed staleness line
   deliberately uses local arrival time; the stage does not.

9. **`recon-app.js:665` — a missing shot image stages a black frame with
   a convincing HUD.** `stgShot.src` has no onerror path, and
   `recon-shots/` is gitignored per-session while `recon.jsonl` persists.
   Next session, the backlog's newest shot record takes the stage, the
   img 404s, and the operator sees black under `still · N h old`, url,
   status and links — a still that is actually nothing, unannounced.

10. **`recon-app.js:965` — `instrumentTick` rebuilds innerHTML every
    60 ms, so the honesty tooltips can never open.** `gridEl` / `nextEl`
    (and the ribbon hint) are reassigned unconditionally; the element
    under the cursor is replaced 16.7 times a second, the hover timer
    resets forever, and none of the load-bearing disclaimers
    ("constructed index", "assumed 4/4", the straight/first-deck reasons)
    is ever readable — while the harness passes on source presence.
    Fix shape: cache the composed string, skip assignment when unchanged.

## The six cut by the ten-finding cap (confirmed, lower severity)

- `moveName`'s mirrored camScore tier table — its comment claims no
  second table exists; one does.
- Teardown leaves the wheel/ribbon/fade painted if a hot-swap eval fails.
- The pinned-row ▣ view desyncs the stepper position.
- `stgLinkClick` shows "copied" on clipboard failure.
- Three `check-recon.js` guards whose pass conditions match comments
  rather than code (the energy-axis, second-scoring-path, and
  aliased-innerHTML regexes) — decoration in CLAUDE.md's sense.
- The query-string strip on copyable stage links — was a policy question
  for the keeper (privacy vs. usable links). **DECIDED 2026-08-29,
  keeper: the strip stays** (*"query-string strip seems reasonable"*).
  Not a defect; a deliberate default.

## Standing

None of these gates the 2026-09-01 launch — all are in the extension,
which is UNRUN as a session (LISTENING §20–21). But findings 1, 2, 5 and
6 sit directly on the paths the §21 walkthrough will exercise, so fixing
them first makes that walkthrough measure the design instead of the bugs.

## Postscript — FIXED the same day, keeper's word ("Work the list")

All fifteen fixable findings repaired 2026-08-28: ledger rows 86–99 carry
each one (86 shot collision + dedupe blindness · 87 deckSet snapshot ·
88 playhead/flag · 89 suspended ctx · 90 sayMark's silent exits · 91 the
idx-0 label · 92 clock skew · 93 missing frame · 94 innerHTML churn ·
95 teardown canvases · 96 stepper desync · 97 false "copied" · 98 the
three decoration checks · 99 moveName's false comment). `check-recon`
82 → 96; 17 of the new/updated checks fail against the pre-fix source.
All [INFERRED] — traced and text-pinned, not yet driven live; the §21
walkthrough is the live half. The ONE item left open was the
query-string strip on copyable stage links (`stripQ` on ingest), which
throws away real state (`?id=…`) from links the operator copies to use —
a privacy-vs-usefulness POLICY choice, not something to change silently.
**DECIDED 2026-08-29, keeper: the strip STAYS** (*"query-string strip
seems reasonable"*). A feed file is writable by anything on the LAN and
the stage renders whatever it is handed, so a query string is exactly the
part of a URL most likely to carry a session token or a tracking id.
Losing a `?id=` from a copied link is the cheaper failure. **The review
has no unresolved items.**
