# Launch — 2026-09-01 ("August 32nd"), GitHub

Keeper, 2026-08-19: *"The launch date for the software will be 8/24, goes on
Github no later than that."* Eight bars of four: the date lands on the phrase
boundary the engine still cannot detect (ROADMAP, "What none of this fixes"),
which is either a joke or a promise. Recorded here so it is neither lost nor
argued with.

**MOVED, keeper, 2026-08-27:** *"I have moved the launch date to August 32nd
(8 bars of 4; Sept 1 in human-speak)."* So the date is **2026-09-01** — and
the joke got tighter on the way: 8 bars of 4 is 32 beats, and August 32nd is
a date that exists only in music. Everything below that says 8/24 by name is
the original plan, unchanged in substance; only the day moved.

**DONE — pushed 2026-09-01.** `origin/main` and the annotated tag `v0.8.0`
sit at the root commit of a fresh history; `deckwave.fm` answers from GitHub
Pages; `remote.origin.push` is pinned to the single refspec
`refs/heads/public:refs/heads/main`. Everything below is kept in the
imperative because it is the record of the procedure, not because any of it
is still pending. Later releases go through the same pinned refspec and
nothing else. The rule in CLAUDE.md outlives the launch: `master` is local
and unpushed, forever.

**The push was the launch act and it was the keeper's to make.** Nothing
below created a remote or pushed; it got the tree to where that one command
was safe.

## What publishing means here, in this order

1. **Copyright and date.** The first public commit is the defensive
   publication the four IP reviews recommend (`docs/research/README.md`). Tag
   it (`v0.8.0` or whatever VERSION says that morning), and — since the
   Waypost tooling already exists — an OpenTimestamps proof of the tag hash
   makes the date independent of GitHub. Cheap, and it is what the
   symmetric-trust research said to do.
2. **Licence.** AGPL-3.0 because of Essentia (`NOTICE`, `LICENSE` — the full
   text is already there). Every vendored library is pinned with its licence
   in `vendor/`. Nothing to add; something to not break.
3. **Name.** Deckwave, as is — reviewed 2026-08-19 and **no rename planned**.
   The clearance report and the reads taken on it are in the private set and
   are not reproduced in this tree.

## Decide before the push — things that are tracked today

| What | Where | Decision needed |
|---|---|---|
| **Private research** — patent strategy, provisional draft, finances, corporation, grants | `docs/research/*` marked *private* in its README (10 files) | **DECIDED 2026-08-27, keeper: does not ship** (*"I don't think these need to be shipped"*). Moved out of the tree the same day, to a private copy the keeper holds; the index carries the note. Still in HISTORY — the fresh-history plan covers that. |
| **Adjacent research** — persona/Waypost project | `docs/research/adjacent/` (8 files) | **DECIDED by removal, 2026-08-21** — deleted from the tree. At the time this row warned that history still held them and a push would publish it; **the fresh-history decision below settled that** — the public repo begins at one commit, so they are in neither the tree nor the history. They survive only in the keeper's private copy. |
| **`_source/`** — four old packages, three skill zips, a corpus cache, live snapshots, the patch set (4.6 MB) | tracked | **DECIDED 2026-08-28, keeper: it ships** (*"we will include the _source"*). Restore points, not source — and with fresh history they are the ONLY public evidence the code was somewhere else before it was here. `_source/README.md` is now the row's documentation: what each package is, that 0.5.0 does not run and is kept as the counter-example, and that the 2026-08-19 `deckwave-0.8.0.zip` is stale against the launch tree (see day-of step 2). The corpus cache lists the keeper's library by filename — harmless, personal, no audio. |
| **`evidence/`** — the v1 cache and the rescan measurements | tracked, **cannot be regenerated** (CLAUDE.md) | Keep. It is what the BUILD-LOG's numbers rest on. Same filename note as above. |
| `.claude/settings.local.json` | **untracked** (good) — carries local permission grants | Keep untracked. `.claude/launch.json` is tracked and fine. |
| `tools/check-*.js` | tracked | Fine, but `check-flac.js` and `check-route.js` read `C:/Claude/Music/LukHash` by default and skip/fall back without it — say so in README so a stranger's first run is not a confusing FAIL. |
| Git identity | commits are authored as `Deckwave` | Fine. |
| TLS keys | outside the repo by design; `.gitignore` catches strays | Fine. |

## The tree itself

- `README.md` — version line, what it is, how to run (`python tools/serve.py`),
  browser support as it now stands (Chromium full; Firefox/Safari/iOS via file
  inputs), the limits list, and the AGPL line. **Screenshot: DONE 2026-08-30**
  — `docs/deckwave-dashboard-2026-08-21.png`, a real set mid-transition, is
  the hero image under the opening line. **It is not the FINAL CHAPTER → ROCK
  64 shot this row asked for**; no screenshot of that set exists in the
  keeper's folder (the by-ear confirmation was 2026-08-19 and nothing was
  captured that day). The 2026-08-21 shot was chosen instead because it is
  the most recent picture of the REAL app and shows the launch tree's
  transport — `⊕ libre`, all three builds, the popout, the phone options —
  where the older shots predate those. Checked before publishing: no text
  chunks, no EXIF, nothing embedded; the only names on screen are LukHash
  track titles the BUILD-LOG already quotes. 1.5 MB, unresized (no image
  library on the machine, and no toolchain is being added for one).
- `CHANGELOG.md` — a `0.8.0 — 2026-09-01 · public` entry at the top that says
  what this release is, in two paragraphs, and points at LISTENING.md for what
  is and is not heard.
- `SKILL.md` — the description line is what an agent sees first; it is current.
- `CLAUDE.md` — stays. It is the working agreement and it is honest; a
  stranger reading it learns more about how this was built than from anything
  else in the tree. The "Publishing" bullet gets flipped to past tense.
- `docs/BUILD-LOG.md`, `docs/ROADMAP.md`, `docs/LISTENING.md` — as they are.
  The ledger is the content.
- `vendor/` — as is. `vendor/README.md` already records the sha256s.
- `index.html` — the boot line says *your music is read locally and never
  uploaded*, which must stay true; the page fetches nothing off-origin.

## What does not have to be true by launch day

- The phone tests (LISTENING §0–§6, the iOS memory question, the lock-screen
  experiment). Unheard things ship tagged as unheard; that is the house style.
- Phrase detection. Still the largest gap, still not a launch blocker.
- ES modules. The rule was restated to allow them; nothing requires them.
- A PWA manifest. Twenty lines if wanted; not a blocker.

**The history note, and it gates the whole table:** deleting a tracked
file removes it from the TREE, not from HISTORY — `git log` can resurrect
every byte, and a push publishes the full history. So for anything in the
table whose decision is "keep out of the public record" (the *private*
set, the removed *adjacent* set if that is the intent), the push has to be
one of: (a) a FRESH history — `git checkout --orphan`, one clean initial
commit of the tree as it stands, push that (simplest, loses the ledger's
commit trail publicly but the BUILD-LOG carries the story); (b) a
filtered rewrite (`git filter-repo`) that drops those paths from every
commit (keeps the trail, more surgery); or (c) push as-is and accept that
the deleted files are public in history. The keeper picks; nothing is
pushed until then either way.

**DECIDED 2026-08-23, keeper: (a) FRESH HISTORY** — *"fresh history seems
cleanest."* The public repo begins at one commit containing the tree as it
stands on launch day; the private local repo keeps everything.

What that costs, said plainly so nobody is surprised later: the public repo
loses the commit trail — the red CRLF commit, the ledger rows arriving one
by one, the timestamps showing the order things were learned. **The
BUILD-LOG carries that story and it is the better telling anyway** (it has
the reasoning, which a diff never does), but a stranger cannot verify the
dates from git. Since dated proof of authorship is the whole point of a
defensive publication, the OpenTimestamps proof of the launch tag (step 1
of "What publishing means here") now carries that alone — it stops being a
nice-to-have.

**The procedure, for launch day, in this order.** Nothing here runs without
the keeper; step 0 is not optional.

0. **Back up the real history first, outside the repo:**
   `git bundle create ../deckwave-full-history.bundle --all`, then
   `git bundle verify ../deckwave-full-history.bundle`. That one file
   restores every commit, branch and blob if anything below goes wrong.
   Keep it wherever the private research ends up.
1. **`_source/` and the private research are both settled now** — private
   research moved out 2026-08-27, `_source/` ships 2026-08-28. Nothing to
   decide at this step any more; the reason it was ever a step stands, and
   stands for anything added later: **a fresh history publishes exactly what
   is on disk at that moment, so whatever is tracked is what ships.** Give
   `git status` and `git ls-files` one look before the orphan commit.
2. `git checkout --orphan public` — a branch with no parent, tree intact.
3. `git commit -m "Deckwave 0.8.0"` — one commit, the whole tree.
4. `git tag -a v0.8.0`, then the OpenTimestamps proof of the tag hash.
5. Create the GitHub remote and push **that branch only**:
   `git push -u origin public:main`. Not `master`, not the worktree
   branches, not `--all`.
6. Keep `master` local and unpushed, forever. It is the real record.

**The failure mode to watch for**, because it is the one that quietly undoes
all of it: a later `git push --all`, `git push --mirror`, or a GUI's "push
all branches" re-publishes the private history in one keystroke, and that
cannot be taken back. Worth pinning `remote.origin.push` to the single
refspec after step 5.

## Where it lives — the namespace and the domain (decided 2026-08-30)

**Namespace: `waypostmaster/deckwave`.** The keeper asked whether to use the
existing code account or a new one under a fresh name. Measured, not
reasoned: **every spelling of the candidate name was already taken** on GitHub
by dormant accounts, and GitHub *"[does] not accept requests to release,
transfer, or reclaim usernames on the basis that they appear inactive"*. So
that option is closed unless suffixed, which is worse than what already
exists. `waypostmaster` is the keeper's existing public code account.

**An org under one of the keeper's other brands was considered and
REJECTED.** That brand publishes finished artifacts rather than source, and
keeps its own flagship repository closed on purpose. An AGPL tool published to
be read and forked does not belong under it. Deckwave is its own venture and
shares nothing with that work but an author — which is the reason this row
does not name it.

**Domain: `deckwave.fm`.** Held by the keeper, and already the assumed home
— the clearance section below names *"a page on deckwave.fm"* in passing.

**Why a custom domain is not cosmetic here.** It decouples the public URL from
the GitHub namespace permanently. Repo transfers into an org later are
otherwise near-lossless — stars, watchers, issues, forks and git redirects all
survive — **but GitHub Pages sites are NOT redirected on transfer**, so a
`*.github.io` link would die in any future move. Pointed at `deckwave.fm`, the
link survives anything. Custom domains bind per REPO, not per account, so
`deckwave.fm` and the keeper's other domains coexist without collision.

**The rule that goes with it: if a portfolio namespace is ever wanted, TRANSFER
the repo into an org — never rename the account.** GitHub is explicit that a
released username *"becomes available for anyone else to claim"*, and a
claimant creating a same-named repo *"will override the redirect entry and your
redirect will stop working."* Converting a user account to an org is worse
still and cannot be undone.

**None of this touches the defensive publication.** SWHIDs are intrinsic —
computed from content, with the origin URL an optional context qualifier — and
the OpenTimestamps proof binds to the tag hash. A rename would break
convenience links and Software Heritage's URL-keyed *search*, not the record.

## Hosting — GitHub Pages, verified 2026-08-30

**The tree runs from Pages as-is.** Verified by serving the `git archive` of
the tracked tree under a subpath and driving it in a browser: booted with zero
404s and zero console errors, analysed real audio through the Essentia WASM,
and loaded the held AudioWorklet by **path 1 — the same-origin static module**,
not the blob or CDN fallback. There is not one absolute-rooted local URL in the
tree; `manifest.webmanifest` already uses `./` for `start_url` and `scope`.
(With `deckwave.fm` on the apex the site serves at `/` anyway, so the subpath
question only affects the `github.io` fallback URL — and both work.)

- **No COOP/COEP needed.** No `SharedArrayBuffer` anywhere, and the vendored
  Essentia is the non-threaded `essentia-wasm.web.js`. That was the one thing
  Pages could not have provided.
- **`.wasm` serves as `application/wasm`** from Pages — checked live against a
  real `github.io` host, not recalled.
- **Size: 12.5 MB tracked against a 1 GB ceiling** (0.4% of it is `_source/`).
  Publish the whole repo from the branch root; there is no reason to carve out
  a subset, and the `/docs` publishing source is not an option because `docs/`
  holds prose, not the app.
- **`.nojekyll` is REQUIRED and is now in the tree.** Without it Jekyll runs by
  default on a branch deploy and silently drops every `_`-prefixed directory —
  which would delete `_source/` from the published site after the 2026-08-28
  decision that it ships.
- **`CNAME` (containing `deckwave.fm`) is now in the tree**, so the first
  deploy registers the domain with GitHub without a settings round-trip.
- **`⊕ libre` works from a `github.io` origin.** archive.org returns
  `Access-Control-Allow-Origin: *` on the search, metadata and download
  surfaces **including both hops of the download redirect**, which was the part
  that could have failed. Commons likewise. All HTTPS, so no mixed content.

**What the hosted copy cannot do**, stated in README rather than fixed:
`serve.py --music` and `--lan` have no static equivalent (a phone still needs
the local server to receive a library), and `extensions/recon/`'s feed is
`recon.jsonl` — gitignored, never published — so the hosted console waits
forever. Both degrade honestly; neither errors.

**The ▶ demo is ~100 MB** (nine Archive MP3s, 8–21 MB each; the first starts
the set and the rest land underneath). First sound is quick, but "click a link
and it plays" is a broadband promise and the README now says so.

**DNS ORDER MATTERS, and it is the one step that is unsafe out of order.**
GitHub's docs: *"Configuring your custom domain with your DNS provider without
adding your custom domain to GitHub could result in someone else being able to
host a site on one of your subdomains."* So DNS is LAST — after the repo
exists and Pages knows the domain. Before launch `deckwave.fm` held only the
registrar's parking default (the wildcard was deleted 2026-08-30), so nothing
was pointed anywhere yet and there was nothing to undo.

## Day-of, as a list the keeper can run

**→ `docs/RUNBOOK.md` is the executable version of this section** (kept
OUT of the public tree — it carries registrar record ids, account names and
private paths that help nobody reading the software), written
2026-09-01: copy-pasteable commands in order, what to expect after each,
and how to back out. It also carries the one fact worth holding in your
head — **exactly one command in the whole sequence cannot be undone**
(`git push`), and everything before it is local surgery you can inspect
and revert with two lines. Use the runbook to DO it; this section is why
it is shaped the way it is.

The list below is kept because the reasoning behind each step lives here.
**Every step was run on 2026-09-01**; the imperative is the record, not a
to-do. Registrar record ids, the registrar's name and the private wrapper
paths were removed from this file on 2026-09-03 (review M13) — the runbook
holds them, and it is not in the tree.


Rewritten 2026-08-27 to match the fresh-history decision above — the old
list predated it and still said "push `master`", which is exactly the
failure mode the history note warns about.

1. All harnesses green — twelve and 646 checks on launch morning; README
   carries the current count: `node tools/check-pool.js` · route · player ·
   panels · phone · phrase · libre · flac · popout · events · recon · citywalk
   (· serve since launch evening).
2. **Re-cut the launch package — the hard part is already DONE (2026-08-30).**
   The rename that `package.py` used to refuse over has happened: the
   2026-08-19 cut is `_source/deckwave-0.8.0-2026-08-19.zip`, and
   `_source/deckwave-0.8.0.zip` is now the launch package (91 files),
   with `_source/README.md`'s table updated. Cutting it found **ledger 108** —
   `assets/deckwave-stretch.js` was missing from every package ever made.

   What remains is mechanical, and it matters because **the package embeds
   `CLAUDE.md`, `README.md` and `docs/`** — so step 4's Publishing-bullet
   flip makes the zip stale by exactly that edit. Do this AFTER step 4, last
   thing before the orphan commit:

       rm _source/deckwave-0.8.0.zip
       python tools/package.py          # expect: 91 files, ~1.6 MB

   Confirm the printed count still matches `_source/README.md`'s table.
   (`package.py` refuses outright if `index.html` references a file that is
   not on disk — a different guard, and it has never fired.)
3. `git bundle create ../deckwave-full-history.bundle --all`, then
   `git bundle verify` it — the step-0 backup; keep it wherever the private
   research ends up.
4. Flip the Publishing bullet in CLAUDE.md to past tense and commit on
   `master`. Private research and `_source/` are both decided (out, and in),
   so nothing else is pending here — but the orphan commit publishes exactly
   what is on disk, so read `git status` and `git ls-files` once before the
   next step and make sure only what is meant to ship is tracked.
5. `git checkout --orphan public` → one commit (`Deckwave 0.8.0`) →
   `git tag -a v<VERSION>` → OpenTimestamps the tag hash (it carries the
   date proof alone now — see above).

   **The `ots` on this machine was BROKEN and is fixed — tested 2026-08-30,
   not left to be discovered on the morning.** `opentimestamps-client` was
   installed with the right `python-bitcoinlib`, and still died at import:
   `python-bitcoinlib` asks ctypes for OpenSSL as `ssl` / `ssl.35` /
   `libeay32`, all three return `None` on Windows, and `LoadLibrary(None)`
   raises — killing every `ots` command, not only the ones needing crypto.
   Use the wrapper, which patches `find_library` for its own process only
   and installs nothing:

       cd <repo>
       git rev-parse v0.8.0 > ../deckwave-v0.8.0-taghash.txt
       python <wrapper-outside-the-tree>/ots-win.py stamp ../deckwave-v0.8.0-taghash.txt

   That writes `…taghash.txt.ots` beside it. **Keep BOTH files** — a proof
   without its file proves nothing, since you cannot reconstruct data from a
   hash. Verify now (`ots-win.py verify …`) and expect *"Pending confirmation
   in Bitcoin blockchain"*: that is correct, not a failure. **Come back in a
   few hours and run `upgrade`**, which bakes the Bitcoin path in and makes
   the proof standalone — verifiable forever without the calendars:

       python <wrapper-outside-the-tree>/ots-win.py upgrade ../deckwave-v0.8.0-taghash.txt.ots

   (The wrapper is a 40-line `find_library` patch kept with the keeper's
   private notes; it is not part of the software and is not in this tree.)

   Proven end to end on 2026-08-30 — stamp submitted to four calendars, an
   805-byte proof written, `verify` and `info` both read it back. The one
   OpenSSL subtlety, recorded so nobody re-derives it: the names must map to
   **libcrypto-3.dll, not libssl-3.dll**. python-bitcoinlib wants `BN_*` and
   `EC_*`, which OpenSSL 3 keeps in libcrypto; pointing at libssl loads
   cleanly and then dies on `function 'BN_add' not found`.

   Fallback if the wrapper ever stops working: opentimestamps.org takes the
   same file in a browser and returns the same proof. No install, no key.
6. Create the GitHub repo (pick licence "none" — `LICENSE` already holds
   AGPL-3.0), add the remote, `git push -u origin public:main` — that
   branch and the tag ONLY. Then pin `remote.origin.push` to the single
   refspec. `master` stays local and unpushed, forever.

7. **Enable Pages**: repo → Settings → Pages → deploy from branch `main`,
   folder `/ (root)`. The tree already carries `.nojekyll` and `CNAME`, so
   the first deploy publishes `_source/` intact and registers `deckwave.fm`
   with GitHub. Confirm the site answers on
   `https://waypostmaster.github.io/deckwave/` BEFORE touching DNS.
8. **Then, and only then, point DNS** at the registrar for `deckwave.fm` —
   the apex ALIAS that had aimed at the registrar's parking host gets
   repointed, and a `www` CNAME added:

       ALIAS  deckwave.fm       ->  waypostmaster.github.io
       CNAME  www.deckwave.fm   ->  waypostmaster.github.io

   (GitHub's A/AAAA apex records — `185.199.108-111.153` and
   `2606:50c0:800{0,1,2,3}::153` — are the documented alternative if the
   ALIAS misbehaves; the registrar supports ALIAS at the apex natively.)

   **The wildcard was DELETED 2026-08-30 on the keeper's word**, so this
   step was two calls, not three. `*.deckwave.fm` had pointed at the
   parking host, parking every unclaimed subdomain; that is the surface
   GitHub's own takeover warning describes and it bought nothing. Unclaimed
   subdomains now simply do not resolve. Verified by re-reading the zone:
   exactly one record removed, the apex ALIAS and all four `NS` records
   untouched, six down to five. Readiness (credentials, the domain's API
   opt-in, the record to edit) was proven the same day; those facts live in
   the runbook, outside the tree.
9. **Wait for the certificate, then tick "Enforce HTTPS."** GitHub says up to
   24 hours for both DNS propagation and the cert; the checkbox is greyed
   until the cert exists. Do not skip it — an un-enforced Pages domain
   serves plain HTTP.
10. **Anchor it**: OpenTimestamps the tag (step 5), then Software Heritage
   "Save Code Now" on the new origin —
   `POST https://archive.softwareheritage.org/api/1/origin/save/git/url/<repo>/`.
   SWH is the independent witness that makes silent later rewriting
   detectable, and its archive resists deletion by design. Nothing is
   archived yet, so there is no sunk cost either way.

Everything above the line "Day-of" could be done before the day and most of
it by me, on request. Steps 5–6 were the keeper's; 7–10 were the keeper's too
(they need the GitHub UI and the registrar), though step 8 could be run
through the registrar's API on the keeper's word.

**A licence note that follows from the domain, and it is easy to trip over:**
LukHash's grant is a PLATFORM grant — YouTube and Twitch. **A page on
`deckwave.fm` is outside it**, as the clearance section below already says.
The ▶ demo is fine (Archive material under its own CC terms, attributed on
the card), and no LukHash audio ships in the tree. But a build-video embed or
a trailer hosted on `deckwave.fm` would need an email first, where the same
video on YouTube would not.

## Music in the build video — what LukHash's page actually grants

**DECIDED 2026-08-30, keeper: this section SHIPS, whole, and so does
`docs/VIDEO-CLEARANCE.md`.** It was briefly proposed that the deliberation
move to the private repo and the one-pager stay as the public rule. That
proposal was WRONG on a fact and is recorded here so nobody re-derives it:
`VIDEO-CLEARANCE.md` already publishes the conclusion — *"Not cleared, low
risk"*, the standing-exclusions list, the composer names — because it was
built to be the public rule. Moving these 148 lines would have hidden the
reasoning while leaving the verdict in place, which is the worst of both:
a conclusion without the diligence that earns it.

The material is about a video that does not exist yet, made from the
keeper's own library, on the two platforms where the artist granted
permission in writing. *"Not cleared, low risk"* is a refusal to
over-claim, not an admission — and a person who splits their music folder
into `Cleared for YouTube-Twitch` and `On-device only` and writes down why
is showing diligence, not recklessness. **What would reopen it:** the video
going anywhere but YouTube/Twitch, or being monetised beyond the platform
grant. Then this becomes a record of a decision that no longer covers what
was done.

> **Distilled 2026-08-21 into `docs/VIDEO-CLEARANCE.md`** — one page:
> the rule, the library split (the music folder now has
> `Cleared for YouTube-Twitch` (172) and `On-device only` (17)
> subdirectories), the saved-set timestamps, and the shot list. This
> section stays as the full research behind it.

Keeper, 2026-08-19: *"This 'TAKE CONTROL' song has some interesting lyrics,
could be good for the build video … I'm pretty sure I saw a note that he said
his music is okay to be used in streaming settings."* The note exists. Fetched
from lukhash.com/licensing.html on 2026-08-19 (the page 403s bots; a browser
UA gets it), verbatim where it matters:

- **Twitch:** *"All LukHash tracks are freely usable and DMCA-safe for
  live-streaming and VOD on Twitch."*
- **YouTube:** *"All original LukHash tracks are YouTube-friendly and can be
  used in both monetized and non-monetized videos without risk of a DMCA
  takedown."* Only **Better Than Reality** is exempt from automatic claims
  (with a credit in the description, e.g. "Music: LukHash, song name");
  *"Songs from other albums may still be automatically matched by YouTube's
  Content ID system — either way, your video's playability is unaffected …
  but once a song is matched, ad revenue is shared with the publisher."*
- **Video games / TV / film / events:** email him.

So a reconstructed build stream posted to **YouTube or Twitch is inside the
grant** — that is a platform grant, not a general licence. **TAKE CONTROL is
on GHOSTS, not Better Than Reality**, so expect a Content ID match on
YouTube: the video stays up, monetisation goes to the publisher. Credit every
track in the description regardless. **Outside those two platforms** (the
repo, a conference, Vimeo, a page on deckwave.fm, a trailer in the README)
nothing on that page covers it — email first. Nothing in this tree ships
audio, and that stays true. An earlier research note reached the same reading
from search-index copies; this is the live page. (That note was
`docs/research/adjacent/surfacing-hud-for-agent-activity.md`, removed
2026-08-21 and **not in this repository** — see the adjacent row above.)

**Decided, keeper, 2026-08-19:** *"This app is literally a love letter to
LukHash so he can take control of the monetization on the video."* So the
Content ID match on TAKE CONTROL (and any other non-BTR track) is the
intended outcome, not a cost — publish to YouTube, credit every track in the
description, let the claims stand. No email needed for the video. The
only remaining rule is the platform one: YouTube/Twitch yes, anywhere else
ask.

**A second video idea, keeper, 2026-08-19 (mid-listen on the first libre
set):** *"I like this for an open source build video dedicated to
wikipedia, archive.org, all the free softwares and license that built
deckwave"* — the set built entirely from `⊕ libre` fetches, the dedication
being the point: the music arrives from the Internet Archive with creator
and licence on the card, and the software underneath is Essentia (AGPL),
SoundTouchJS (MPL-2.0), libflac.js, the WebAudio/WASM platform itself.
Prompted by *"Both Prelude and Gone Too Soon are lovely on the goniometer"*
— fetched tracks as the visual material, not just the audio. The licence
reading for THAT video differs from the LukHash-platform-grant one above,
and it is cleaner where it matters: the fetched LukHash releases on the
Archive are **CC BY-NC-SA 3.0** (the demo score's own records say so, all
nine; an earlier draft of this paragraph said ND, which was wrong — SA
permits the mixing, un-monetised, with attribution), and his platform
grant above covers YouTube/Twitch regardless, so for LukHash material the
platform rule already decided this. Non-LukHash libre material in such a video is governed by its own
CC terms per track: **BY-NC-SA is fine un-monetised with attribution;
anything -ND should be left out of the video's soundtrack; nothing here
is cleared for a monetised video.** The score already carries every
track's terms and the card shows them on screen — the video would be its
own attribution reel. Not scheduled; recorded so the idea and its licence
shape survive.

**Storyboard beats, keeper, same listen (the set is SAVED, so every cue
below is a real timestamp — the score's `atSec`/`exitSec` per step, not a
memory):** *"at the end it cuts to a really long rain moment, I think we
can roll credits there before we rock back into winter error and show
some of the fails."* So the shape is: the set plays → **Gone Too Soon's
outro gives up the centre and sides on the goniometer** (the shot, already
in LISTENING "Heard") → the long rain moment carries the **credits** —
which write themselves: the card's `☉ creator · licence · from
archive.org` per track, Wikimedia, the Internet Archive, Essentia (AGPL),
SoundTouchJS (MPL-2.0), libflac, the licences themselves → **and last, on
its own, the dedication** (wording settled by the keeper 2026-08-23 and
held OUT of this repository by decision 2026-08-30 — it names a family
member and the public tree is permanent; it lives with the keeper's
private notes and goes on the card at edit time) → **Winter Error
kicks back in over the fails**. "The fails" have a canonical source: the
failure ledger, 120 rows in BUILD-LOG, each one a caught mistake with who
caught it — the red CRLF commit, the seven diagnostics that measured
nothing, the panel that mounted behind the whole app (ledger 67, from this
very feature). The saved score file is the edit decision list; loading it
replays the identical mix, which is the whole reason DWSCORE exists —
"the mix is not a recording to capture, it is a score."

**The keeper wants to PLAY the Gone Too Soon intro in the video** (*"ok i
need to learn guitar … and i want to play this in the build video lol"*).
No published tab exists, so the intro was estimated from the track itself
(chromagram, 0.5 s frames, triad templates — the guitar enters ~8 s in,
after the ambience). **An ESTIMATE, not a transcription; the ear and
LukHash outrank it.** In F# minor, chords ≈ 2 s each:

    A  —  B  —  F#m  (hold)          × then
    A  —  E  —  B  —  C#m  —  (D#º passing)

and the four-chord loop repeats. The maj/min flicker the detector showed
on A and C# says the guitar often OMITS the third — arpeggiated, open —
so play them as two-note shapes or sus and it will sound right. **Capo 2
makes it campfire-friendly:** G — A — Em, then G — D — A — Bm. Gone Too
Soon is also the 507-second track whose rain outro carries the credits —
the keeper would be playing the intro of the same song whose ending rolls
the thanks, which is the kind of symmetry a build video cannot buy.

**THRILLER is a cover** (`THRILLER - cover by Meredith Bull & LukHash`, a
YouTube rip in the library) — the composition is Rod Temperton's, the
publisher is not LukHash, and his YouTube line says *"all **original**
LukHash tracks."* Outside the grant on both platforms: he cannot clear a
composition he does not own, and a Content ID match on the MJ publisher can
mute or block by territory, not just share revenue. Leave it out of the
video. The same applies to every `cover by` / `remix` file in the library.

**Public domain / expiry on the covers — checked 2026-08-19, keeper's
question.** No. The relevant terms are life + 70 years (UK, EU, Poland, and
US works by named authors since 1978) or, for US works made for hire, 95
years from publication. Applied to the library's non-originals:

| File | Composer, year | Earliest conceivable expiry |
|---|---|---|
| THRILLER (cover by Meredith Bull & LukHash) | Rod Temperton, 1982; d. 2016 | 2087 (life + 70) |
| C64 reMIXed 01 · DRUID II / Fairlight crack intro | David M. Hanlon, 1987 | ≥ 2057; realistically 2090s+ |
| 02 · SUPREMACY | Jeroen Tel, 1990 (living) | 2090s+ |
| 03 · ALIEN | Paul Clansey, 1984 | ≥ 2054; realistically later |
| 04 · SPY vs SPY | Nick Scarim, 1984 | ≥ 2054; realistically later |
| 05 · LAST V8 | Rob Hubbard, 1985 (living) | 2090s+ |
| 06 · THE GREAT GIANA SISTERS | Chris Hülsbeck, 1987 (living) | 2090s+ |
| 07 · LAST NINJA 2 · Central Park | Matt Gray, 1988 (living) | 2090s+ |
| 08 · BRUCE LEE | John A. Fitzpatrick, 1984 | ≥ 2054; realistically later |
| 09 · ACIDJAZZED EVENING | Janne Suni, 2000 (living); C64 version GRG | 2090s+ |

"Earliest conceivable" is the year the composer would have had to die in the
year of release for life + 70 to run out; the floor is 2054 and no one on
this list did. Where the game publisher owned the music as a work for hire
(Hewson, Thalamus, System 3, Rainbow Arts, First Star, Datasoft …), the US
clock is 95 years from publication: 2079 at the earliest. A publisher that no
longer exists does not make a work public domain — it makes it an orphan
work, which is still protected. Death dates for Hanlon, Clansey, Scarim and
Fitzpatrick were not verified; it does not change the answer.

**Practical read, separate from the legal one:** SID covers are almost
never in Content ID — the originals were never registered by anyone with
fingerprints — so the *platform* risk on the C64 reMIXed tracks is low, and
for Twitch LukHash's page says "all LukHash tracks" without the "original"
qualifier. THRILLER is the opposite case: Sony/ATV and the Jackson estate run
Content ID aggressively and a match can block by territory. So: THRILLER
out; C64 reMIXed is "not cleared, low risk" — the keeper's call, stated as
that and not as clearance. Originals remain the clean set.
