**A. Moving through the set and track.** **MEASURED:** next-track mixing already exists in `Player.skip()`; `Player.back()` calls `play()` on the previous row, restarting playback rather than mixing backward (`assets/deckwave.js:2165`, `assets/deckwave.js:2188`). Lock-screen next/previous call those functions (`assets/deckwave-phone.js:501`). **INFERRED:** the keeper’s complaint is therefore partly about discoverability and partly about genuinely missing in-track movement. The dashboard implementation was not supplied, so its visible controls cannot be audited here.

Costs below mean **S**: localized work; **M**: coordinated engine/interface work; **L**: a new subsystem or playback implementation. Proposed designs and estimates are **INFERRED**, not tested results.

**MEASURED — the engine gives us useful machinery, with a critical trap:**

- `chain()` schedules a successor, gain ramps, bass exchange and rate changes ahead of time; `gen` invalidates obsolete asynchronous planning (`assets/deckwave.js:983`, `assets/deckwave.js:1589`).
- `handover()` promotes the incoming deck near the **start** of the crossfade. The outgoing source continues fading afterward (`assets/deckwave.js:1866`, `assets/deckwave.js:1877`).
- `cancelPending()` immediately resets the current deck’s gain to 1 and low-shelf gain to 0 (`assets/deckwave.js:1384`, `assets/deckwave.js:1413`). After handover, that current deck can still be fading **in**. The supplied fake’s gain snap has a corresponding mechanism in the code; its audible effect remains unheard.
- `nextExitAfter()` delays a new exit until the preceding fade finishes, but callers such as `blendNow()` cancel **before** asking for that exit. Waiting for the next transition does not protect the current envelope (`assets/deckwave.js:1574`, `assets/deckwave.js:2042`).
- Source-time conversion already has integrated rate maps: `pos()` and `when()`. Conversely, `DWEVENTS.pulse()` uses elapsed × instantaneous rate, while the phone’s position display uses elapsed alone. Neither includes the source entry offset (`assets/deckwave.js:1279`, `assets/deckwave.js:1296`, `assets/deckwave-events.js:386`, `assets/deckwave-phone.js:342`).
- “Downbeat” here means every fourth detected beat. Outgoing and incoming phrase choices are made separately; a phrase exit does not establish a phrase entry (`assets/deckwave.js:1373`, `assets/deckwave.js:1642`, `assets/deckwave.js:1754`).

**INFERRED — shared prerequisite for new transport controls:** separate “replace a future transition” from “interrupt a transition already sounding.” During an active crossfade, retain its gain, bass and rate automation and queue the requested action until it finishes. Determine that state from scheduled audio times, including the interval before the handover callback catches up.

The replacement operation should decode first, recheck generation/context/track identity, choose a still-future boundary, then commit. Extend `cancelPending()`, `chain()`, `handover()` and the command callers around that contract. Merely replacing the gain assignment with another fixed value would not solve envelope ownership.

Expose a proper engine position accessor using `entry + pos(currentTime − startedAt)`, then use it in `pulse()`, `updatePosition()`, cues and restoration. Production features should not depend on `_dev`.

No proposal below changes `LOCK`, stretch limits, quiet-tail calibration, phrase detection, energy weights or duck settings. New splice envelopes, effect settings and live detectors require measurements and listening before defaults are chosen.

1. **A1 — Put recognizable track controls beside playback.**  
   **INFERRED · S · HEARD PATH: YES, through existing actions.** Show **Previous track**, **Next track**, and a pending-action message such as “Next phrase in …”. Distinguish track movement from future phrase movement. Touch the dashboard transport behind `DWDASH.mount()`—its implementation is unseen—and call `DW.back()`, `DW.skip()` and `DW.blend`.  
   **Risk:** presenting phrase-next as instantaneous, or implying that existing previous-track playback blends. Label the present behavior accurately.  
   **Cheapest experiment:** a temporary two-button transport; have the keeper use it on the phone and judge whether the existing next-track wait feels responsive enough.

2. **A2 — Mix back into the previous track.**  
   **INFERRED · M · HEARD PATH: YES.** Add `Player.back({mix:true})`, feeding a previously played track through the existing decode/transition machinery. Keep **Restart this track** separate. Use playback history rather than assuming the previous heard track remains at `idx − 1` after steering. Touch `back()`, `blendNow()`, `placeNext()` and `handover()`.  
   **Risk:** a previous track may now require excessive stretch or a straight transition; list movement can also make repeated “back” surprising. Report the actual transition treatment.  
   **Cheapest experiment:** after one familiar transition, mix back to its outgoing track once and ask whether that is the backward action the keeper wanted.

3. **A3 — Jump backward or forward one detected phrase.**  
   **INFERRED · M · HEARD PATH: YES.** At the next usable phrase boundary, replace the source with the preceding or following phrase boundary while preserving the current tempo. Backward repeats the phrase just heard; forward skips the next phrase. Keep the same set position. Touch `makeDeck()`, `phraseOf()`, `wallBeats()`, `nextExitAfter()`, `chain()` and a new `seekPhrase()` API.  
   **Risk:** grid errors, join clicks, worklet priming, quiet-tail exits and minimum-dwell accounting. Do not reset the logical track’s history merely because its source node was replaced. If phrase information is unavailable, say so; a separate beat-snap option must not claim phrase alignment.  
   **Cheapest experiment:** one backward phrase jump on a keeper-chosen reliable groove, at its current stretched rate, after any transition has completed.

4. **A4 — Keeper-authored cues, then a snapping timeline.**  
   **INFERRED · M · HEARD PATH: YES when recalled.** Start with **Remember this phrase** and **Return here**, storing track identity, source position and the chosen grid anchor separately from analysis. A waveform editor can follow if these two controls get used. Touch the new position/seek API, `play()` and `chain()`; add explicit cue-entry handling.  
   **MEASURED:** the roadmap describes score entry/exit fields as nearly sufficient, but the supplied player chooses entries directly from beats or phrases (`docs/ROADMAP.md:34`, `assets/deckwave.js:1749`, `assets/deckwave.js:1936`).  
   **Risk:** saved markers that the actual player ignores, or wrong identity after files are repicked.  
   **Cheapest experiment:** save one phrase cue, reload and repick the file, then recall it.

5. **A5 — Loop this phrase; hold to extend it.**  
   **INFERRED · M · HEARD PATH: YES.** Build on phrase seeking: repeat a bounded source segment and defer the planned exit. Releasing the control exits at a phrase boundary and resumes planning. Touch `makeDeck()`, `chain()`, `cancelPending()` and a new `setPhraseLoop()` API. Share the decoded buffer rather than decoding a whole track for every repetition.  
   **Risk:** seams, rate-map errors and a stuck hold when the page loses focus. Include a visible latch state and explicit release action; do not depend solely on a touch-release event.  
   **Cheapest experiment:** repeat one phrase three times, then release into the already chosen next track.

6. **A6 — “Rewind that mix.”**  
   **INFERRED · L · HEARD PATH: YES.** Record transition recipes: both file identities, source entry/exit positions, rate curves, envelopes and whether the scheduled transition actually started. Replay from before its beginning. Touch `chain()`, `handover()`, `makeDeck()` and a new `replayTransition()`.  
   **MEASURED:** the present log is written when a transition is scheduled, and `handed` retains a limited outgoing snapshot rather than a replayable performance (`assets/deckwave.js:1801`, `assets/deckwave.js:1884`).  
   **Risk:** reconstructed playback is not necessarily sample-identical because DSP history matters. Exact replay of the mixed PCM would require a separate bounded recording buffer, with additional memory and explicit storage policy.  
   **Cheapest experiment:** retain one transition recipe in memory and replay that pair once. Establish whether approximate musical replay satisfies the request before building recording.

**B. Live audio into the mix.** **MEASURED, supplied desk fact:** Listen mode currently serves analysis panels only; its implementation was not supplied. **INFERRED:** adding an audible input should be a distinct, explicitly armed mixer function, not a silent change to Listen mode.

**KNOWLEDGE — Web Audio 1.0, Edge/Chromium 128 and Safari 18 baseline:** an `AudioBufferSourceNode` is a one-shot source; seeking normally means starting another source. A live input has no future samples available, so time stretching needs buffering. Making the deck follow a live source avoids stretching that source, but capture, processing and output latency still exist. **Falsifier for practical suitability:** a measured round-trip audition shows that the intended performance cannot be played comfortably through the chosen route.

**KNOWLEDGE — iOS 17–18/WebKit baseline; the reported iOS 26.6 device needs its own test:** microphone capture and playback can coexist, but activating a Bluetooth headset/car microphone can change the route and audio profile. HFP supports duplex voice; A2DP supplies higher-quality playback without that microphone channel. Browser constraints do not guarantee the desired combination. A built-in or wired input may behave differently. **Falsifier of a route being suitable:** starting capture changes the sound, interrupts playback, selects the wrong microphone or introduces intolerable delay. Test the actual car and AirPods separately, while parked.

**KNOWLEDGE — iOS 18 baseline:** there is no general browser capture of another app’s output, nor a generic browser Bluetooth audio-input receiver. Native `mixWithOthers` permits coexistence; it does not expose another app’s samples. Cooperative AUv3 hosting is a different, narrower integration. **Falsifier:** a supported API demonstration on the keeper’s installed OS delivers samples from the specific desired app or device into the mixer.

1. **B1 — A manual microphone channel.**  
   **INFERRED · M · HEARD PATH: YES.** Add a new `DWInput.open()/close()` and a proper `Player.attachInput()` API. Connect `MediaStreamAudioSourceNode → input gain → master`, with monitoring initially muted. Touch `buildGraph()`, `stop()` and `kill()` for lifecycle ownership; coordinate `DWPHONE.setSessionType()`/`apply()` during capture and restore the prior session configuration afterward.  
   **Risk:** feedback, voice processing altering music, and Bluetooth route changes. Request unprocessed capture where available, inspect what was granted, and keep a clear mute control.  
   **Cheapest experiment:** in Edge with headphones, speak over one playing track through a manually raised input fader.

2. **B2 — Wired line-in, a second device, or an instrument.**  
   **INFERRED · M · HEARD PATH: YES.** Reuse B1 with an audio interface or appropriate wired input. A second device becomes an ordinary external source. Keep input gain separate from deck volume; show its level before unmuting. Touch the input module and `Player.attachInput()`.  
   **KNOWLEDGE — Windows 11/Edge 128 and iOS 18 baseline:** usable inputs depend on the interface, adapters and OS routing; iOS browser device selection is less controllable than desktop selection. **Falsifier:** the intended interface is absent, changes channels unexpectedly or fails simultaneous playback/capture.  
   **Risk:** clipping, channel mismatch and hearing both direct hardware monitoring and delayed software monitoring.  
   **Cheapest experiment:** connect the intended source and play one passage through exactly one monitoring path.

3. **B3 — Another desktop app or tab as an external channel.**  
   **INFERRED · M · HEARD PATH: YES.** Add an explicitly selected capture stream to the same input bus. Inspect the unseen `DWLISTEN` implementation before deciding whether its capture lifecycle can be shared; do not invent a second permission owner.  
   **KNOWLEDGE — Windows 11/Edge 128 baseline:** selected tab/system-audio capture can supply audio, depending on the capture surface and permissions. It is not arbitrary per-app sample access. **Falsifier:** the selected capture returns no audio track or excludes the desired source.  
   **Risk:** doubled sound from the original playback path, or recapturing Deckwave’s own output.  
   **Cheapest experiment:** capture one external tab and establish a route where its sound is heard exactly once through Deckwave.

4. **B4 — Tap the live tempo; let the deck follow.**  
   **INFERRED · M · HEARD PATH: YES.** Start with manual tempo entry/tap and a separate phase-alignment action. The live source stays at its own speed. Use `changeRate()`, `pos()`, `when()` and `chain()` through a new tempo-control API, respecting existing reach limits. Freeze conflicting automatic tempo decisions while externally following.  
   **Risk:** equal BPM without aligned beats, sudden phase corrections, or the deck chasing a performer. A live source’s key remains unknown unless supplied or separately measured.  
   **Cheapest experiment:** use an external drum-machine/metronome pattern at a known reachable tempo and align one familiar track manually.

5. **B5 — Automatic live tempo and phase following.**  
   **INFERRED · L · HEARD PATH: YES.** First build an observation-only tracker reporting tempo hypotheses, phase and tracking loss. Only later let it command the deck through B4’s API. Keep it out of the existing file-analysis calibration.  
   **MEASURED:** `analyse()` supplies whole-track audio to `RhythmExtractor2013`; that is not already a streaming tracker (`assets/deckwave.js:323`).  
   **Risk:** half/double-time errors, changing tempo, silence, capture delay and feedback from Deckwave’s own speakers. New tracking and correction thresholds need measured live input. On uncertainty, hold the established deck behavior and report loss of tracking.  
   **Cheapest experiment:** record the proposed tracker’s observations against a known external rhythm without allowing it to alter playback.

6. **B6 — Capture a phrase, then mix the captured phrase.**  
   **INFERRED · M · HEARD PATH: YES.** Offer a deliberate “record this phrase” operation. Once captured, it becomes finite local material that can be looped, analyzed and stretched. Touch the input module, `makeDeck()` and the loop API.  
   **Risk:** this is delayed sampling, not immediate live beatmatching; captured material may also lack a reliable grid. Keep the recording bounded and memory-only unless saving is explicitly chosen.  
   **Cheapest experiment:** capture one instrument phrase and bring it into the next phrase boundary of a playing track.

**INFERRED — network boundary:** these designs keep captured samples inside the page. A cable from a second device adds no network surface. Sending audio by WebRTC, WebSocket or a relay would add one and would conflict with the literal no-upload constraint; it is not included in this plan.

**C. More dynamic performance.** **MEASURED:** `DWEVENTS` already understands faster/slower, hype/calmer, change and duck/unduck; steering uses the dashboard’s blend/route operations (`assets/deckwave-events.js:70`, `assets/deckwave-events.js:130`, `assets/deckwave-events.js:187`). The existing word **“drop” means hype**, not “jump to a musical drop” (`assets/deckwave-events.js:76`).

1. **C1 — A small performance pad using existing events.**  
   **INFERRED · S · HEARD PATH: YES.** Surface **Faster**, **Slower**, **More energy**, **Calmer**, **Change**, and **Duck/Restore** through `DWEVENTS.inject()`. Display the engine’s returned result and pending transition. This is also the cheapest way to react to the room: the keeper supplies the judgment.  
   **Risk:** “faster” being mistaken for an immediate pitch fader, or energy being mistaken for a measured property of excitement. Describe energy as the library’s constructed index; preserve current constants.  
   **Cheapest experiment:** one temporary pad during a normal listening session; note which controls the keeper actually wants twice.

2. **C2 — A reversible filter sweep.**  
   **INFERRED · M · HEARD PATH: YES.** Add a dedicated performance filter to `makeDeck()`, with its own automation and a return-to-neutral control. Extend `releaseDeck()` accordingly.  
   **MEASURED:** the existing low-shelf node is already automated for transition bass exchange, so sharing its parameter would create competing owners (`assets/deckwave.js:1200`, `assets/deckwave.js:1728`).  
   **Risk:** harsh resonance, perceived loudness jumps and an effect left engaged after a transition.  
   **Cheapest experiment:** audition one manual sweep and return on a familiar chiptune track; let the keeper choose the useful range.

3. **C3 — Echo-out as an alternative exit.**  
   **INFERRED · M · HEARD PATH: YES.** Add a separate delay send/return and schedule its exit against the engine’s beat clock. Touch `buildGraph()`, `chain()`, `releaseDeck()` and `stop()`, with explicit ownership of the effect tail.  
   **Risk:** feedback runaway, a tail abruptly destroyed when the deck releases, or accumulated repeats obscuring the incoming bassline. Settings are listening decisions.  
   **Cheapest experiment:** A/B one existing crossfade against an echo-out on the same track pair.

4. **C4 — A real “drop here” button, using a keeper cue.**  
   **INFERRED · M · HEARD PATH: YES.** Recall an explicitly marked cue through A3/A4’s scheduler. Add a validated command such as `DWEVENTS.command({kind:'cue-drop', cueId})`, rather than silently changing the existing synonym table. The same structured vocabulary could later carry `loop-on`, `loop-off` and `seek-phrase`.  
   **Risk:** accidental retriggering, unavailable cues, or promising automatic structural understanding.  
   **Cheapest experiment:** mark one favorite payoff and trigger it once from an earlier phrase.

5. **C5 — Room-reactive suggestions before room-reactive automation.**  
   **INFERRED · L · HEARD PATH: YES if accepted or automated.** Let local input observations suggest an existing event, with the keeper accepting it. Extend `DWEVENTS.command()` and the input-analysis module; do not directly rewrite sequencing weights.  
   **Risk:** the microphone hears the speakers, conversation and road noise—not a reliable measure of enjoyment. “Crowd energy” would be an unsupported claim.  
   **Cheapest experiment:** show suggestions without acting on them during one session, and compare them with the keeper’s actual choices. Disagreement is evidence to stop, not to invent another threshold.

**D. An iPhone app and dependable return to a set.** **MEASURED:** the supplied engine retains the library’s files in `LIB.files`, while IndexedDB stores analysis records (`assets/deckwave.js:105`, `assets/deckwave.js:819`). The supplied desk reports no service worker or `storage.persist()` call; the page documents its lack of offline cold-start support (`index.html:7`).

**MEASURED:** the phone implementation sets the audio-session type to playback and separately starts the silent media element for controls (`assets/deckwave-phone.js:303`, `assets/deckwave-phone.js:517`). **INFERRED:** the silent element alone should not be credited with preserving the entire mixing process.

**INFERRED — diagnose the reported state loss before choosing a platform:** show a boot identifier, saved-session identifier and last checkpoint time. A fresh boot with an empty deck supports the cold-start hypothesis; the same boot returning with a suspended context argues against it for that incident. A fresh boot alone does not distinguish OS reclamation from a crash or reload.

**KNOWLEDGE — Safari/iOS 17–18 storage and lifecycle baseline:** origin storage, JavaScript process lifetime and background audio are separate concerns. A service worker can support offline loading; it does not preserve a live mixer. A persistence grant reduces storage-eviction exposure, not process termination. Home Screen installation is not a universal storage guarantee. **Falsifier of this approach’s adequacy:** the retained session or audio disappears during the keeper’s repeatable idle/offline scenario.

**KNOWLEDGE — iOS 17–18, WKWebView and AVFoundation baseline:** native apps can use an audio session and background-audio mode for playback, but neither native nor wrapped apps are immune to termination. A wrapper does not guarantee continued JavaScript/Web Audio execution. Native playback can own scheduling independently of that web process. **Falsifier of a candidate architecture’s adequacy:** its two-track spike fails the same lock, interruption, idle-return or Bluetooth scenario that motivated it.

1. **D1 — Durable session checkpoints, initially without audio copies.**  
   **INFERRED · M · HEARD PATH: YES on restoration.** Add `Player.snapshot()` and `restoreSession()`, plus a separate session store. Save order, file identities, build/phrase settings, current source position and relevant playback configuration. Persist during use rather than relying on a final shutdown callback. Touch `play()`, `handover()`, steering commands and `LIB.find()`.  
   Preserve array-level set properties explicitly. Restore paused at a clearly described checkpoint; initially require repicking files. A midpoint crossfade need not be reconstructed in the first version.  
   **Risk:** stale checkpoints, incorrect file matching and implying that saved metadata includes audio.  
   **Cheapest experiment:** manually checkpoint a short set, reload, repick its files and resume near the saved phrase.

2. **D2 — An offline PWA with an optional “keep this set on this phone” pack.**  
   **INFERRED · M · HEARD PATH: NO additional DSP change.** Cache the application’s same-origin assets, including lazy WASM/worklet dependencies. Separately store selected original audio bytes and original name/size/mtime metadata, then resolve them through `LIB.find()`/`LIB.decode()`. Feature-detect storage estimation/persistence and report actual results. Publish an audio pack as ready only after its writes complete.  
   **Risk:** quota, eviction, incomplete packs and stale application caches. **Decision required before implementation:** whether retaining these audio copies is wanted. The desktop directory-handle decision does not answer that question.  
   **Cheapest experiment:** retain a two-track pack, close the app, enable airplane mode and cold-launch it. No new off-origin service is required.

3. **D3 — A thin WKWebView shell, with Capacitor as an alternative implementation.**  
   **INFERRED · M · HEARD PATH: YES for routing/lifecycle; intended DSP unchanged.** Package the existing assets and add narrow native bridges for file import, durable session storage and lifecycle reporting. Adapt `LIB` and `DWPHONE`; keep the web mixer for the first spike.  
   **KNOWLEDGE — Capacitor 6 and Xcode 16/iOS 18 baseline:** Capacitor conventionally adds npm dependencies and a native project; a handwritten WKWebView shell avoids Capacitor but still requires native compilation/signing. **Falsifier of reuse value:** bundling these exact assets fails to load the worklet/WASM or requires substantial engine changes.  
   **Risk:** building a different container around the same background limitation. **Constraint:** native compilation breaks the static-only/bare-node requirement for this target; conventional Capacitor also breaks the no-`node_modules` rule.  
   **Cheapest experiment:** package two local tracks and the existing mixer; run the keeper’s failing lifecycle scenario before adding native UI.

4. **D4 — Keep the web interface; move playback into a native engine.**  
   **INFERRED · L · HEARD PATH: YES.** Retain the dashboard and initially retain analysis behavior, but make a native renderer own sources, tempo changes, fades and the audio clock. Replace the `Player` boundary with an adapter consuming explicit transition plans. Replace phone proxy controls with native Now Playing and remote commands.  
   **KNOWLEDGE — iOS 17–18:** `AVAudioEngine` with `AVAudioUnitTimePitch` is a plausible native playback stack; its sound and latency are not interchangeable with SoundTouch. **Falsifier:** the same stretched track and transition sound worse, or lifecycle reliability does not improve.  
   **Risk:** two implementations drifting apart and substantial ear-led DSP validation. **Constraint:** native build and device testing require an explicit exception to static/bare-node-only rules.  
   **Cheapest experiment:** a native two-deck player for one known track pair, using the existing measured analysis and transition parameters.

5. **D5 — A full Swift app with native library and car integration.**  
   **INFERRED · L · HEARD PATH: YES.** Port the interface and planning contracts only after D4 proves a benefit. Treat `sequence()`, `camScore()`, `normalise()` and classification as behavior to preserve, not an invitation to retune. Native analysis must demonstrate equivalence before replacing the existing analysis path.  
   **Risk:** maintaining two products, changed analysis results, changed stretch character and much larger verification requirements. **Constraint:** this is outside the original browser/static/bare-node architecture.  
   **Cheapest experiment:** use the D4 spike through a real keeper listening session and interruption cycle. A full interface rewrite earns its place only if native playback delivers a wanted advantage.

**KNOWLEDGE — native capabilities and distribution, with limits:**

| Capability and believed version | What it could buy | What would falsify the proposed benefit |
|---|---|---|
| Files document/directory access, iOS 13–18 | User-selected local files/folders, native imports and scoped bookmarks. Access can become stale; app-owned copies still need a policy. | The intended Files provider cannot reopen the selected material without repicking. |
| Media library/AVFoundation, iOS 17–18 | Readable DRM-free local assets where the API supplies access. Downloaded Apple Music subscription tracks remain protected; local presence does not make them readable samples. | A sample-access test on the keeper’s actual files contradicts the assumed accessibility. |
| Now Playing/remote commands, iOS 17–18 | Native play/pause, track commands and position handling without the silent-element proxy. | Commands or metadata fail on the keeper’s lock screen/car route. |
| CarPlay audio-app templates, iOS 14–18 | A constrained car playback interface, subject to entitlement approval; not a custom DJ console. | Entitlement refusal, unsuitable templates or unsupported required controls. |
| App Store review, guideline 4.2 as remembered from 2024–2025 | Distribution, with a thin website wrapper carrying minimum-functionality review risk. Native utility may help; approval is not assured. | Current guidelines or an actual review decision contradict that assessment. |

**INFERRED:** Apple signing/distribution introduces a distribution dependency, not a requirement to upload the keeper’s music. A native design should still bundle pinned dependencies and keep audio processing local. “No eviction ever” is not a benefit any option should promise.

**Part 2 — the five I would prioritize.** **INFERRED:** this ranking favors the keeper’s established daily use and cheap evidence over the largest possible feature set.

| Rank | Pick | Value for this keeper | Cost / heard path | Cheapest deciding experiment |
|---|---|---|---|---|
| 1 | **A1: visible track transport** | Immediately addresses “I cannot skip” using existing behavior. | S / YES | Use two plainly labelled controls on the phone; judge phrase-next’s wait. |
| 2 | **C1: existing-event performance pad** | Adds meaningful direction with little new machinery. | S / YES | Use the temporary pad during one normal set and note repeat use. |
| 3 | **D1: checkpoint and restore** | Targets the reported loss of mixing state and supplies evidence for the native decision. | M / YES on restore | Reload a checkpointed set, repick files and resume it. |
| 4 | **A3: phrase backward/forward** | Supplies the genuinely missing form of movement. | M / YES | Repeat one phrase at the current stretched rate without an audible seam. |
| 5 | **B1: manual external-input audition** | Establishes whether live mixing is useful before investing in live synchronization. | M / YES | Speak over one track in Edge through a monitored input, then test the intended phone route. |

**INFERRED:** mixed previous-track playback and phrase loops follow closely. I would not rank automatic live following or a native rewrite above these until their cheaper experiments succeed.

**Part 3 — roadmap.** **INFERRED:** each phase should end with an observation, not merely a completed implementation.

| Phase | Work | Keeper-visible exit criterion | What the ear decides |
|---|---|---|---|
| **Now** | A1/C1 controls; boot/checkpoint diagnostics; protect active fades before adding replanning features. | The keeper can find track movement, distinguish loading from a scheduled transition, and identify whether an inactive return was a fresh boot. Replanning during a fade does not abruptly change its level. | Whether phrase-next’s wait feels right; whether preserving the envelope removes a noticeable swell or cut. |
| **Next** | D1 restore; shared source-position API; A2 mixed previous; A3 phrase seek; minimal A4 cue recall. | A deliberate reload restores the saved set after repicking files. Phrase jumps land where advertised, the displayed track stays correct, and subsequent automatic transitions still happen. | Join quality, backward-action semantics and whether the detected phrase boundaries are musically useful. |
| **Later** | A5 loop/extend; one effect at a time; B1–B4 live input/manual alignment. D2 only after the keeper decides about retained audio copies. | A loop releases cleanly into the set. The intended live-input route works without feedback or an unacceptable sound change. If audio packs are wanted, a packed set cold-launches offline. | Loop seams, effect settings, monitoring delay and whether live alignment feels playable. |
| **Someday, conditional** | A6 mix replay, B5 automatic following, and D4/D5 native work if their gates pass. | Replay reproduces the wanted moment; tracking earns trust before controlling playback; a native spike demonstrably improves the problematic phone scenario. | Replay fidelity, tracker corrections, native time-stretch sound and transition quality. |

**INFERRED — native-app decision gate:** collect the failure first, then choose the smallest architecture that addresses it.

- If the process restarts but checkpoints plus retained files make returning easy, **PWA recovery has addressed the complaint**.
- If files are the persistent obstacle while web playback works, test a **native file/storage bridge** before replacing audio.
- If active playback repeatedly fails across background handovers or interruptions, and the native two-deck spike survives the same scenario, a **native playback engine has earned consideration**.
- If the desired capability is reading another app’s protected audio, **neither a wrapper nor Swift establishes that capability**.
- Proceed with a native target only after explicitly accepting its build/test exception and hearing its time-stretch output.

**INFERRED — verification discipline:** use bare-node fake-clock tests for cancellation races, preserved envelopes, source-time mapping, set identity and restoration. Those tests establish scheduling behavior, including the supplied fade-in failure. Device trials establish lifecycle and routing behavior. The keeper’s listening establishes whether any heard-path change should ship.