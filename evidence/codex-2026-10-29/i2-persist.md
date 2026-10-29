**INFERRED — Recommend (a) first: save a recovery checkpoint, re-pick the music after a cold start, and resume from the last saved point outside a crossfade.** Add (b) only after the keeper chooses to retain audio copies. A service worker addresses offline launching; it does not preserve a running mix.

MEASURED below means read from the supplied text, not executed. Line numbers count from the first line inside each pasted file block.

**1. Diagnosis**

| State | What a cold start loses or retains | Evidence |
|---|---|---|
| Playing set | **MEASURED:** `order`, `idx`, rolling `tempo`, and the player’s phrase flag are closure variables. They restart empty/defaulted. | `assets/deckwave.js:872–892`, `:919` |
| Set’s planning annotations | **MEASURED:** sequencing attaches `_stretch`, `_tempoAt`, `_unlocked`, `_unlockReason`, and other annotations to tracks. `mode`, `phrase`, `poolSize`, and `leftOut` are properties of the **array**, not its elements. No recovery record is written here. | `assets/deckwave.js:743–767` |
| Dashboard’s current and prepared sets | **MEASURED:** `makeSetSession()` initializes `committed = []` and `prepared = null`; `mount()` constructs a new session. A prepared set is separate from the playing set. | `assets/deckwave-dashboard.js:508–558`, `:659–660` |
| Position within the track | **MEASURED:** the deck holds `entry`, `startedAt`, rate, ramp, and rate curve in memory. `elapsed` is elapsed **context time**, not absolute position in the source file. | `assets/deckwave.js:1270–1339`, `:1946–1949`, `:2332–2335` |
| Scheduled mix | **MEASURED:** A/B decks, decoded buffers, source nodes, gain/EQ automation, handover timer, generation token, and previous-deck bookkeeping are runtime state. Scheduling B already changes A’s future rate curve and advances `tempo`. | `assets/deckwave.js:873–892`, `:985–998`, `:1779–1804`, `:1846–1849` |
| Picked music | **MEASURED:** `LIB.dir` and `LIB.files` start `null`. Files are retained in a `Map`; playback resolves them by `name|size|lastModified`. These functions do not persist either the directory handle or audio bytes. | `assets/deckwave.js:831–869` |
| In-memory library | **MEASURED:** `corpus` starts empty. `ingest()` repopulates it and constructs energy across that corpus. Boot mounts the dashboard without hydrating the corpus from IndexedDB. | `assets/deckwave.js:2416–2423`, `:2438–2466`; `index.html:131–132` |
| Analysis | **MEASURED:** successfully committed records survive in IndexedDB database `deckwave`, store `f`. They contain identity, BPM, confidence, beats, key, RMS, ZCR, duration, size, and analysis version. The current version is 2. Cache refusal can leave a track available only for the current session. | `assets/deckwave.js:95–129`, `:248`, `:283–286`, `:359–384` |
| Additional analysis | **MEASURED:** phrase and loudness results are written back additively when their base analysis version matches. Their presence is conditional on successful writes. | `assets/deckwave.js:1495–1518`, `:1543–1566` |
| Constructed energy and live plan | **MEASURED:** the initial analysis record is stored before `ingest()` calls `normalise(corpus)`. The cache is therefore not a stored playback plan or a complete snapshot of the displayed energy values. | `assets/deckwave.js:359–384`, `:409–421`, `:2464` |
| Mix settings | **MEASURED:** volume defaults to `.85`, crossfade to `16`, next-phrase to `true`, and settle to its declared defaults. These player variables survive a graph reset, but their declarations run again on page reload. `keepDupes` is also a transport-local variable. | `assets/deckwave.js:892`, `:940`, `:979–984`; `assets/deckwave-dashboard.js:1349`, `buildTransport()` |
| Persisted preferences | **MEASURED:** localStorage retains tune (`dw-tune`), phone mode/art/panel/calls, theme, and supported desktop output selection. The dashboard also persists panel slots, folds, and named views. | `assets/deckwave.js:158–159`, `:184–186`; `assets/deckwave-phone.js:194–196`, `:235`; `assets/deckwave-dashboard.js:1349`, `buildTransport()` and its `dw-theme`/`dw-output` blocks; `:1312–1317`, the `slots`/`folds`/`views` modules |
| Appearance details | **MEASURED:** named views retain arrangements, but that does not mean every current appearance control is automatically restored. The settings drawer explicitly starts closed on a phone; desktop can restore `dw-cfg-open`. | `assets/deckwave-dashboard.js:1349`, `buildTransport()`’s layout, view, and `cfgOpen` blocks |
| Phone playback machinery | **MEASURED:** saved phone preferences survive; the silent element, object URLs, wake lock, artwork buffers, timer, and session ownership do not. They begin as fresh runtime variables. | `assets/deckwave-phone.js:183–196` |
| Diagnostics | **MEASURED:** player issues, logs, gap totals, and worklet metrics are in-memory state. | `assets/deckwave.js:999–1043`, `:1277–1279` |
| Exported files | **MEASURED:** cache export is features only, with no audio. Dashboard save/load are explicit actions; boot does not automatically load a saved score. The unpasted score module’s complete format cannot be established here. | `assets/deckwave-cache.js:12–15`; `assets/deckwave-dashboard.js:1349`, `saveBtn`/`lsb`; `index.html:131–132` |

**INFERRED:** this explains loss after a cold start even when the analysis cache and preferences remain intact. It does **not** establish why the page restarted. The desk’s report explicitly leaves process reclamation unconfirmed (`docs/BUILD-LOG.md:4407–4420`).

**INFERRED — One-minute check, at the next occurrence; cost S, HEARD PATH: no.**

Before pressing Play, Stop, Build, or Scan:

1. Open **☰ set**. Look for the old track list and title.
2. A fresh-page signature is an empty set, header dashes, and “ready”; “loading engine…” may flash first. Retained theme or phone preferences do not contradict a cold start.
3. A retained title and set, with playback paused, falsify “the entire page state was lost.” Investigate the audio context instead.
4. Record whether reopening was online, whether the page showed a load error, and whether Bluetooth had disconnected.

**MEASURED:** the pasted dashboard does not automatically show a “pick your library” dialog at startup. Its initial log says “ready”; the empty-library instructions follow actions (`assets/deckwave-dashboard.js:614`, `:1349`, transport handlers).

**INFERRED — Other explanations to distinguish:**

- Reload, navigation, browser crash, or a new standalone browsing context can produce the same fresh-page signature as OS reclamation.
- An audio interruption can leave the set intact. The Play handler explicitly handles `suspended` and `running`; an unexpected context state merits investigation before changing recovery behavior (`assets/deckwave-dashboard.js:1349`, Play handler).
- Explicit Stop or Reset destroys the decks. Ordinary Play subsequently starts the retained set at track 1. That is an existing keeper decision, not a recovery defect (`assets/deckwave.js:1960–1966`, `:2017–2021`; dashboard Stop/Reset handlers).
- Playback completion or decoding failure can stop music without cold-starting the page. `chain()` can remove a failed successor; that differs from losing the entire library and set (`assets/deckwave.js:1693–1704`).
- Losing preferences **and** analysis suggests storage removal or a different storage context as well as lost memory.

**KNOWLEDGE — iOS/WebKit 17–18 baseline:** an idle web app’s process can be suspended or terminated independently of its origin storage. This is not a version guarantee for the reported iOS 26.6 device. A retained live set at the reported failure falsifies process-loss diagnosis for that occurrence; a fresh boot alone cannot distinguish reclamation from reload or crash.

**2. Options and keeper decisions**

| Option | Cost, risk, heard path | Keeper decision | Single cheapest useful experiment |
|---|---|---|---|
| **INFERRED — (a) Bookmark + re-pick** | **M. HEARD PATH: yes, during reconstruction.** Storage itself need not affect playback. Risks: stale checkpoint, file identity mismatch, incorrect rate/clock reconstruction. | Accept automatic local metadata checkpoints, re-picking after restart, and replay from the last saved point outside a blend. No directory handle is retained. | A two-track phone spike: checkpoint partway through a stretched track, reload, re-pick, verify exact file IDs, then resume and hear the next handover. |
| **INFERRED — (b) Bookmark + copies of this set’s audio** | **L total**, building on (a). Same heard-path risks, plus copying time, disk use, quota failure, eviction, and interrupted writes. | Explicitly choose **“Keep this set’s audio on this device.”** This permission has not been established by the folder-handle decision. | Store the largest set file as a Blob with its identity metadata, cold-start the installed app, read it back, and play it. This tests the storage path; it does not establish capacity for the entire set. |
| **INFERRED — (c) Service worker for the app shell** | **M, complementary. HEARD PATH: no intended DSP change**, but an incomplete or mixed-version shell can prevent playback. Helps cold-launch offline. Does not recover memory or files. | Decide whether reliable offline reopening is required. It adds same-origin installation/update requests and cached app assets, with no audio upload or new off-origin endpoint. | First try today’s app in airplane mode after a genuine cold launch, including first playback. Failure identifies the shell/dependency gap a worker would address. |

**KNOWLEDGE — (a), Safari/iOS 16.4–18 baseline:** persistent browser storage can survive page-process loss, while picked `File` references in JavaScript memory do not constitute durable file access. Playback and file-picker activation should originate directly from a gesture. Falsifiers on the keeper’s installed version: the checkpoint does not survive reload, re-picking changes the identity tuple, or the gesture-started audio/media element is refused.

**INFERRED — For (b), start with IndexedDB Blobs.** It uses the storage model already present and permits audio plus its original identity descriptor to commit together. OPFS is a reasonable alternative if actual phone measurements favor it; implementing both initially adds failure modes without proving value.

**KNOWLEDGE — Storage API baseline:**

- I believe OPFS `navigator.storage.getDirectory()` is supported from Safari/iOS 15.2, and `navigator.storage.persist()` from Safari/iOS 17. Feature-test both in the **installed app**. Absence or a refused read/write falsifies using that path on this device.
- For Safari/WebKit 17–18, browser-origin quotas can be up to roughly 60% of disk, and Home Screen apps receive browser-class quotas. This is an upper policy limit, not reserved or available capacity. `estimate()` is approximate; actual writes can fail much earlier.
- A granted persistence request is intended to protect against automatic storage eviction. It does not protect against explicit removal of website/app data. Installation is not a promise that `persist()` will return `true`.
- The Home Screen exemption from Safari’s seven-day inactivity policy is narrower than “this data cannot disappear.” The comment in `index.html:7–11` should not become that broader promise.

**INFERRED — Required (b) behavior:**

- **Deckwave stores the audio copies on the user’s own device, in its origin storage, and sends them nowhere.**
- Copy only unique files referenced by the committed set, including played tracks so Back still works. Do not copy the whole corpus or automatically copy a merely prepared alternative.
- Display exact summed source-file bytes, successfully committed copy bytes/count, approximate origin usage/quota, and the actual persistence result.
- Copy sequentially without decoding or materializing the entire set in RAM.
- Preserve original filename, size, and modification time alongside each Blob. Reconstructed files must retain the identity expected by `LIB.find()`.
- Advertise “audio saved” only after all required writes commit. Partial copies remain partial.
- **Clear saved audio** deletes these copies and returns the checkpoint to re-pick mode. It preserves the analysis cache and bookmark.
- Check every expected copy on every recovery. Missing or unreadable copies enter the same re-pick flow as (a).

**INFERRED:** this does not persist the Chromium folder handle and therefore does not implement the action declined on 2026-10-09. It introduces a different retention decision—duplicating audio inside browser storage—which needs its own keeper choice. It is neither already approved nor automatically prohibited.

**KNOWLEDGE — (c), Safari/iOS 16.4–18 baseline:** service workers are event-driven and terminable; they do not preserve the page’s AudioContext, JS heap, or picked files. A worker is therefore not a keepalive solution. The practical falsifier for the proposed benefit is an offline cold launch that still cannot load the engine, WASM, decoder, and worklet.

**INFERRED — If adding (c):** use a checked-in, versioned same-origin asset list, including lazily loaded playback dependencies. Keep updates waiting while a set is active; do not force activation or reload mid-set. No framework or build step is needed. Calling `persist()` alone also cannot save a set that was never serialized.

**3. Implementation contract for (a)**

**INFERRED — Save a recoverable playback state, not an AudioContext.** V1 resumes one deck from a stable checkpoint. It does not reconstruct an interrupted two-deck crossfade or claim sample-identical continuation.

Use a new IIFE, `assets/deckwave-session.js`, exposing `DWSESSION`. Give it a separate IndexedDB database, `deckwave-session`, version 1.

**MEASURED:** both the engine and cache exporter explicitly open `deckwave` at version 1 (`assets/deckwave.js:107`, `assets/deckwave-cache.js:35`). A separate database avoids making an analysis-store upgrade depend on changing both openers.

**INFERRED — Stored logical record:**

```js
{
  format: "deckwave-session",
  v: 1,                         // recovery schema
  id: "last",
  revision: 42,
  savedAt: "...ISO timestamp...",
  status: "resumable",           // prepared | resumable | stopped | completed

  compatibility: {
    playback: 1,                 // bump when restoration semantics change
    analysis: 2,
    phrase: /* DWPHRASE.V */,
    loudness: 1
  },

  set: {
    mode: "all",
    phrase: false,
    poolSize: 171,
    leftOut: [ /* metadata snapshots, no audio */ ],
    buildOptions: { /* actual options used */ },
    energyBasis: "original-corpus",
    tracks: [{
      file: {
        id: "name.flac|123456|...",
        name: "name.flac",
        size: 123456,
        lastModified: 0,
        type: "audio/flac"
      },
      analysis: {
        /* whitelisted v, name, bpm, conf, beats, key, scale,
           camelot, kstr, rms, zcr, dur, size, energy, phrase, loud */
      },
      plan: {
        /* whitelisted _locked, _gridErr, _unlocked, _unlockReason,
           _stretch, _tempoAt, _score, _dwell, _stepping */
      }
    }]
  },

  cursor: {
    index: 6,
    trackId: "...",
    sourceSeconds: 62.8,         // absolute position in the original file
    originalEntrySeconds: 0.4,
    logicalElapsedSeconds: 60,
    clock: {
      initialRate: 1.04,
      ramp: null,
      curve: [{ t: 0, v: 1.04 }]
    },
    planningTempoBeforeNext: /* exact, unrounded number */,
    pending: {
      nextId: "...",
      kind: "natural",           // natural | forced | end
      forcedExitSourceSeconds: null,
      onPhrase: false
    }
  },

  settings: {
    volume: /* actual saved level */,
    xfade: /* actual value */,
    phrase: /* actual value */,
    nextPhrase: /* actual value */,
    settle: { /* actual values */ },
    quiet: { /* actual values */ },
    tune: /* actual value */
  },

  prepared: null                // optional separate prepared-set snapshot
}
```

**INFERRED — Serialization rules:**

- Store set-level properties explicitly. Plain `JSON.stringify(seq)` would omit `seq.phrase`, `seq.mode`, and the other named array properties.
- Snapshot only allowlisted data. Never serialize nodes, buffers, handles, promises, URLs, or executable callbacks.
- Preserve the set’s energy values as a constructed index from its original corpus. Do not normalize only the restored subset and silently change that index.
- Keep plan metadata separate from mutable corpus objects, following the existing prepared-set separation.
- Validate finite positions/rates, identities, index bounds, versions, and curve ordering before adopting anything.
- Treat saved thresholds/settings as recorded values, not an opportunity to recalibrate. A compatibility change blocks exact resume; it does not silently substitute different constants.

**INFERRED — Physical storage and write timing:**

Use `plans`, `checkpoints`, and `meta` stores. Write the large plan on plan changes; write the small cursor against a plan revision. Commit a new plan and its first checkpoint in one transaction.

Checkpoint:

- after a successful start, handover, reorder, queue/blend request, or settings change, when eligible;
- every **five seconds** while eligible;
- after suspension, and opportunistically on `visibilitychange`/`pagehide`.

Five seconds is a chosen storage cadence, not a signal threshold. It is **not** a guaranteed maximum rewind: background scheduling and storage commits can stall.

Use one ordered writer, revision checks, and transaction completion as the success signal. A late write cannot overwrite a newer plan, a cleared session, or another window’s acquired ownership. Storage refusal must leave playback running and show **“Recovery not saved”**, retaining the last committed record.

**INFERRED — Exact additions and changes:**

| File | Functions/API | Responsibility |
|---|---|---|
| `assets/deckwave-session.js` | `open()`, `read()`, `validate()`, `writePlanAndCheckpoint()`, `writeCheckpoint()`, `clear()`, `claimWriter()` | Storage, versions, atomicity, writer ownership, errors. |
| Same | `attach(dash)`, `checkpoint(reason)`, `offer()`, `matchFiles(files)`, `prepareResume()`, `resumeFromGesture()` | Coordinate recovery without owning audio scheduling. |
| `assets/deckwave.js`, inside `Player` | Add `snapshotSession()` and `checkpointEligible()` | Capture the authoritative player state synchronously; refuse unstable snapshots. Never use `_dev`. |
| Same | Add `sourcePosition` accessor and `restoreSession(record, preparedAudio)` | Expose source position; reconstruct a deck and its source-time map. |
| Same | Add `armResumeFromGesture()` | Call `boot()` and `ctx.resume()` directly in the click stack, before awaiting worklet loading or decoding. |
| Same | Change `chain()` | Retain the successful plan’s intent: natural/forced exit, source exit position, and phrase-next request. Notify the recovery coordinator only after plan commitment. |
| Same | Change `makeDeck()` and deck readouts | Support `origin: 'resume'`, with `matched: false` for the initial resumed deck. Preserve its actual rate. |
| Same | Change `play()`, `stop()`, `kill()`, `pause()`, `handover()`, source `onended` | Publish lifecycle changes; distinguish explicit stop/reset, internal replacement, pause, and completion. |
| Same, public facade | Expose recovery APIs and compatibility versions | Keep private player internals private. |
| `assets/deckwave.js`, `LIB`/picker code | Add `pickRecoveryFiles(opts)` and `addRecoveryFiles(files)` | Picker opens synchronously from a gesture; matching adds files across repeated picks without replacing earlier picks. |
| `assets/deckwave-dashboard.js` | Extend `makeSetSession()` with `restoreSaved()` / `resumeSaved()` | Preserve current/prepared separation and consume only a successfully resumed candidate. |
| Same | Add `mountRecoveryCard(dash)`; change `mount()`, `buildTransport()`, `head()` | Recovery screens, storage status, correct resumed-deck labels, and Play-button routing. |
| `assets/deckwave-phone.js` | Add `armResumeFromGesture()` / `finishResumeAttempt()`; change `apply()`, `kick()`, `updatePosition()` | Re-arm the existing phone mode and silent element; prevent cleanup during an active resume attempt; publish source position. |
| `index.html` | Load `deckwave-session.js`; add it to `need` | Load before dashboard mounting and wire it once. |

**INFERRED — Important integration details:**

- Ordinary ▶ must recognize a pending recovery candidate. It must not fall through to `DW.play(dash.set, 0)` and restart track 1.
- `LIB.pick()` currently replaces the file map. Do not use it unchanged for recovery across multiple picks.
- Re-linking should not require re-analysis when a compatible metadata snapshot already exists.
- Recover the set for playback; do not pretend the entire library has been reopened. Make any corpus-dependent steering operate only on available files, or ask for a library scan.
- Existing explicit Stop behavior remains: preserve the set metadata, mark it stopped, remove its resumable cursor, and let ▶ start track 1. Internal `play()` replacement must not accidentally clear the last good recovery record before replacement succeeds.
- A completed set is marked completed rather than offered as an interrupted one.

**4. Resume flow**

**INFERRED — Screen 1: “Saved set”**

Show:

> 47 tracks · last saved yesterday at 18:42  
> Track 7: TITLE · 1:03 into the file  
> Playback will resume from this saved point.

Actions: **Choose music to resume**, **Start a new set**, **Forget saved session**.

If the previous save predates a blend, say:

> The last saved point is before a blend. Some music may replay.

Read storage without booting audio. Do not create a playing silent element on this screen.

**INFERRED — Screen 2: “Find this set’s music”**

Open the picker directly from the button. Show `matched / required`, with names of missing files. Allow repeated folder/file picks; accumulate matches.

Use the exact ID tuple. A changed timestamp, renamed file, or ambiguous match is a mismatch, not permission to guess from the title. Cancellation leaves the saved session intact.

V1 should require the **whole set** before enabling resume, preserving the existing Back behavior. “Skip missing tracks” would be a separate, explicitly heard change.

**INFERRED — Screen 3: “Ready to resume”**

Validate versions, file readability, and metadata. Show track, source position, saved level, and any saved settle setting. The primary action is **▶ Resume**.

All expensive asynchronous preparation may finish before this button. If decoding must happen afterward, the gesture must first synchronously arm both the AudioContext and the phone element. While preparation is pending, keep the timeline frozen at the checkpoint.

If activation is refused, remain here with an explicit retry action. Do not fall back to autoplay from a timer.

**INFERRED — Screen 4: resumed set**

Adopt the same array in the player and dashboard. Show:

> Resumed at 1:03 · saved speed ×1.040 · no incoming beatmatch

Do not call a stretched resumed deck “played straight.” Start from silence using the existing startup gain envelope, then continue through the saved order.

**INFERRED — Missing or changed data:**

- **Missing/unreadable file:** remain in recovery; preserve the checkpoint. Do not pass the incomplete set to `chain()` and let its existing skip behavior silently edit it.
- **Changed file identity:** request the original file. Content-based relinking can be a later feature; filename similarity is insufficient.
- **Analysis/playback compatibility version changed:** retain and display the old order, but disable exact resume. Offer re-analysis and preparation of a **new** set through `ingest()`/`prepare()`, with explicit review before playback. Do not reuse a known-stale grid or claim that the new plan is the saved continuation.
- **Phrase/loudness version changed:** treat it as affecting exact transition recovery, rather than quietly redetecting and moving the next exit.
- **Corrupt/unknown recovery schema:** show the problem and allow forgetting it; leave the analysis cache untouched.

**INFERRED — Desktop behavior:** default automatic recovery off on desktop; expose **Remember this set in this browser** for opt-in use. No folder-handle persistence, background file access, or automatic picker. Existing output-device preferences remain device-local. Enable the phone default by installed-iOS detection, with a manual setting available if detection fails.

**KNOWLEDGE — iOS/WebKit 16.4–18 baseline:** standalone detection commonly uses display-mode media queries and WebKit’s `navigator.standalone`. A Home Screen launch reporting neither falsifies that detection on the keeper’s version; it must not make recovery inaccessible.

**5. Heard-path safeguards**

**MEASURED:** `Player.play()` currently resets tempo to the chosen track’s BPM, creates a rate-1 deck, and starts at zero or its first beat. Calling it with the saved index cannot restore the saved position or speed (`assets/deckwave.js:1916–1952`).

**INFERRED — Position and rate**

Capture:

```js
sourceSeconds =
  A.entry + A.pos(Math.max(0, ctx.currentTime - A.startedAt));
```

For example, entry `0.4`, elapsed `60`, and constant rate `1.04` means source position `62.8`, not `60`.

At reconstruction:

```js
d.entry = saved.originalEntrySeconds;
d.startedAt = newStartTime - saved.logicalElapsedSeconds;
// Restore the original clock model and its remaining rate automation.
d.src.start(newStartTime, saved.sourceSeconds);
```

Retaining the logical elapsed time matters: setting the saved source position as a brand-new entry and restarting elapsed at zero would reapply dwell/minimum-play rules from the wrong origin.

Restore the same automation to the source and pitch-compensating worklet. Do not substitute `_stretch`, rounded tempo, or the instantaneous rate for a complete remaining ramp.

**INFERRED — Pending transition and double drift**

When B has been scheduled but has not started:

- capture A’s clock **before B’s future automation**, using the semantics already represented by `B.outgoingCurve`;
- capture `B.tempoBefore`, rather than the already-advanced target;
- retain the pending transition’s intent;
- rebuild that transition once.

Snapshotting must only read this state. Calling `cancelPending()` to obtain it would itself alter the playing mix.

**INFERRED — Crossfades**

A checkpoint is ineligible while:

- startup gain is still rising;
- B has started according to the **audio clock**, even if `handover()` has not run;
- the previous deck is still fading;
- a replan/decode has not committed;
- the terminal fade is underway.

Also retain the previous checkpoint if insufficient time remains for the existing startup envelope before the saved transition. Derive that boundary from the existing envelope duration; add no detector threshold.

During these windows, keep the last eligible committed checkpoint. This is replay-based recovery, not reconstruction of two simultaneous sources and their DSP histories.

**INFERRED — Timer**

Never serialize timeout IDs or absolute AudioContext times. Translate saved musical/source positions into the new context’s clock and call `armHandover()` afresh. Carry generation checks across every asynchronous restore step; Stop or a newer start invalidates the older restore.

**MEASURED:** the existing handover timer already consults the audio clock before moving the index (`assets/deckwave.js:1877–1883`). Preserve that guard.

**INFERRED — Media session and labels**

`updatePosition()` should use the new source-position accessor, clamped to the track duration, with the actual current rate. It currently publishes `DW.elapsed` (`assets/deckwave-phone.js:348–355`).

Keep the existing silent-element strategy. Do not turn on the failed media-stream output experiment as part of recovery.

Audit all consumers of `origin`/`matched`, including the unpasted now-playing and panel modules. The pasted `head()` can be specified directly; unseen consumers cannot honestly be declared compatible. A resumed stretched deck must never acquire a “straight” label merely because it has no predecessor.

**INFERRED:** SoundTouch state and the compressor’s internal history are not restored. The opening sound and subsequent handover therefore require the keeper’s ear, even when all clock arithmetic passes.

**6. Tests the desk can build**

**INFERRED — Bare-node harnesses:** use `node:assert/strict` and `node:vm`, evaluating the existing IIFEs with fakes. No packages. Suggested files: `tools/check-session.js`, `tools/check-resume.js`, and `tools/check-phone-resume.js`.

| Check | Fake and assertion | Today’s gap / falsifier |
|---|---|---|
| Cold restart | Create two independent VM contexts sharing only fake committed storage. Recover order, index, source position, settings, array-level properties, and separate prepared set. | Today no recovery record or loader exists. Any missing/reordered field falsifies the storage contract. |
| Commit-time failure | Fake request success followed by transaction abort. Assert old checkpoint remains and no “saved” state appears. | Recovery writes do not exist today. Reporting success before commit fails the test. |
| Stale writes | Delay an older checkpoint behind a newer plan, Clear, or another writer claim. Assert it cannot restore old state. | No recovery writer exists today. Any resurrection or revision rollback fails. |
| File matching | Supply equal titles with different IDs; cancel; then pick required files in two batches. Assert exact matching, accumulation, and unchanged saved order. | Existing `LIB.pick()` replaces the map; no recovery matcher exists. Guessing or losing the first batch fails. |
| Constant-rate resume | Fake audio clock and nodes: entry `.4`, elapsed `60`, rate `1.04`. Assert source starts at `62.8`, both rate parameters agree, and the next exit retains its remaining time. | Existing `play()` starts at the original entry at rate 1. Those calls falsify correct resume. |
| Ramped-rate resume | Capture partway through a curve; compare restored position/rate and future exit with an uninterrupted reference after time translation. | No restoration path exists. Using elapsed × current rate, or dropping the curve remainder, fails. |
| Pending B | Snapshot after `chain()` has advanced tempo and scheduled A’s ramp. Restore; compare target, fade, and incoming rate with the uninterrupted plan. | No snapshot distinguishes baseline from pending automation. Applying drift twice fails. |
| Crossfade eligibility | Advance audio beyond B’s start without firing the JS timer; also test after handover but before fade completion. Assert neither overwrites the previous stable checkpoint. | No checkpoint gate exists. Trusting `idx` alone fails. |
| Cancellation and pause | Delay decode; Stop or start another candidate; resolve the old decode. Assert no stale source starts. Suspend the audio clock while timers run; assert no early handover. | Extend existing guards to the new path. The existing guards are not alleged broken; recovery assertions are unavailable today. |
| Stop/completion semantics | Explicit Stop writes non-resumable status; pause retains a cursor; internal replacement does not erase the last good record before success. | Today these events write no recovery status. Offering interrupted resume after explicit Stop fails. |
| Version/missing-file refusal | Change analysis version or remove one required file. Assert zero source starts and original recovery data retained. | No recovery validation exists. Silent re-analysis, skipping, or playback fails. |
| Gesture and media position | Fake activation expires before the first asynchronous continuation. Assert context resume and silent-element play are invoked while active; position is source seconds; resumed rate ≠ 1 is not labeled straight. | No dedicated resume arming exists; `updatePosition()` uses elapsed time today. |
| Non-invasive saving | Spy on audio scheduling, detector calls, fetch, and handle serialization during checkpoints. Assert none occur. Desktop default performs no session writes. | New behavior has no implementation today. Any scheduling mutation, upload, detector run, or retained handle fails. |

**INFERRED:** a fake IndexedDB proves transaction handling, not WebKit durability. Fake audio nodes prove scheduled values, not sound quality. Those boundaries belong in the test output.

**INFERRED — Phone acceptance checks, each with a falsifier:**

1. **Two-track recovery:** pause mid-track, cold-launch, re-pick, tap Resume, and hear through the next handover. Wrong track, unexpected speed, repeated minimum dwell, or unacceptable sound falsifies readiness.
2. **Real long idle:** repeat the keeper’s original use. A saved checkpoint must be offered with an honest timestamp. An unexplained empty recovery state falsifies the persistence result.
3. **Kill during a blend:** recovery must identify and use the preceding stable checkpoint. Claiming exact continuation or resuming with duplicate decks fails.
4. **Lock screen and parked car Bluetooth:** after recovery, test Play/Pause, Next, Previous, and a planned handover. Wrong card position/title, dead controls, or playback loss fails this integration.
5. **Re-pick identity:** select the same Files-provider material after relaunch. Changed identity tuples falsify the assumption that exact tuple matching alone is usable for this library.
6. **Option (b), if chosen:** test full-set capacity, interrupted copying, cold readback, Clear saved audio, and missing-copy fallback. Missing bytes with an “all audio saved” claim fails.
7. **Option (c), if chosen:** airplane-mode cold launch and first playback through a handover. Any required asset fetch failure fails offline readiness.

**INFERRED — Build order:** establish the failure signature; implement and test metadata recovery; run the two-track listening experiment; then enable phone autosaving. Audio-copy retention and offline-shell caching remain separate choices. None requires changing a detector, threshold, calibration, or the meanings of energy, confidence, and played straight.