/* ─────────────────────────────────────────────────────────────────────────
   DECKWAVE · PHONE PLAYBACK — keeping a set alive when the screen goes dark

   Keeper, 2026-08-19: "What unlocks background play? Spotify gets it."

   Spotify gets it because it is a native app with the `audio` background
   mode: the OS keeps its audio session alive with the screen locked. A web
   page gets a smaller version of the same grant. WebKit (every browser on
   iOS) keeps <audio> going on the lock screen and, by default, SUSPENDS a
   Web Audio graph; Chrome for Android keeps Web Audio running with the
   screen off on its own, subject to the OS battery setting for Chrome.

   Deckwave's mix IS a Web Audio graph. Three ways to keep it going on a
   phone, all here, all OFF by default:

     wake        keep the screen on while a set plays (Screen Wake Lock API
                 — Safari 16.4+, Chrome 84+). The mechanism is real and
                 boring: nothing suspends because nothing locks. Costs
                 battery. CONFIRMED to keep a set going on an iPhone.

     background  tell WebKit this page is a music player:
                 `navigator.audioSession.type = 'playback'` (Audio Session
                 API, on by default in WebKit on every Cocoa platform). The
                 mix stays on the speakers; nothing in the graph changes.
                 Read from WebKit's own source, not folklore — see below.

     media       route the whole mix through createMediaStreamDestination
                 into an <audio> element and let THAT be the thing playing.
                 FELL on the device (below). Kept callable.

   ── what WebKit actually does at lock, read from the source 2026-08-19 ──
   (github.com/WebKit/WebKit, main; every path below is under Source/WebCore)

   · platform/audio/ios/MediaSessionManagerIOS.mm, resetRestrictions():
       addRestriction(WebAudio, BackgroundProcessPlaybackRestricted)
     Web Audio has the background restriction and NOT the under-lock one
     (only VideoAudio has SuspendedUnderLockPlaybackRestricted), so at lock
     the context receives an `EnteringBackground` interruption.
   · platform/audio/MediaSessionManagerInterface.cpp,
     applicationDidEnterBackground(): each restricted session gets
     beginInterruption(EnteringBackground).
   · platform/audio/PlatformMediaSession.cpp, beginInterruption(): asks the
     client `shouldOverrideBackgroundPlaybackRestriction(type)` FIRST and,
     if it says yes, records the interruption as ignored and does nothing.
   · Modules/webaudio/AudioContext.cpp,
     shouldOverrideBackgroundPlaybackRestriction(): returns true for an
     EnteringBackground interruption when the document's
     navigator.audioSession.type is 'playback' or 'play-and-record'
     (hasPlayBackAudioSession). Landed 2024-03-01, WebKit bug 261554,
     "[iOS] AudioContext is getting suspended when page goes in the
     background even if navigator.audioSession.type is set to playback",
     with a layout test (LayoutTests/media/webaudio-background-playback.html)
     whose second case asserts the audio keeps rendering after
     applicationDidEnterBackground with the type set to playback.
   · The same commit made such a context Now Playing eligible: it takes
     the lock-screen card, reads title/artist/album from
     navigator.mediaSession.metadata (MediaSession::updateNowPlayingInfo),
     and handles play/pause/stop itself (AudioContext::
     didReceiveRemoteControlCommand). Next/previous are NOT routed to the
     JS MediaSession handlers for an AudioContext — only a media element
     does that (html/MediaElementSession.cpp) — so `background` registers
     no next/previous handler: a button that appears and does nothing
     would read as a bug.
   · platform/audio/cocoa/MediaSessionManagerCocoa.mm, updateSessionState():
     Web Audio alone puts the audio session in AmbientSound (muted by the
     silent switch, no background); the playback override puts it in
     MediaPlayback. So `background` also plays through the silent switch —
     say so on the log line, it is a change the keeper will hear.

   ── lock-screen CONTROLS, 2026-08-19 (keeper: "is it possible to control
   music from lock screen?") ──
   With `background` the card's play/pause work — WebKit handles them for
   the AudioContext itself — but ▶▶ / ◀◀ are not routed to a page's
   MediaSession handlers for a Web Audio session (AudioContext::
   didReceiveRemoteControlCommand handles Play/Pause/Stop/Toggle and drops
   the rest). What DOES route them is a media element: MediaElementSession::
   didReceiveRemoteControlCommand hands every command to the JS handlers
   when any are registered, and MediaSessionManagerInterface::
   processDidReceiveRemoteControlCommand prefers an eligible media element
   over a web-audio session. A media element is Now-Playing-eligible when
   it has a source, is not muted, is playing, and is longer than 0.95 s
   (MediaElementSession.cpp, isElementLongEnoughForMainContent — "Derived
   from the duration of the 'You've got mail!' AOL sound"). It does not have
   to be fed by the graph, and an audio-only element carries no background
   or under-lock restriction on iOS.

   So `controls` = `background` + a SILENT 30 s looping <audio> (a WAV of
   zeros, blob URL) playing alongside the graph. The element becomes the
   Now Playing session; the card shows our metadata and artwork, the
   scrubber shows the DECK's position (navigator.mediaSession.setPositionState,
   which MediaSession::updateNowPlayingInfo applies over the element's own),
   and ▶▶ / ◀◀ / ▶ / ❚❚ land in the handlers here: DW.skip() (a blend since
   today), DW.back(), DW.pause(). The handlers also pause/play the silent
   element so the card's state follows. The graph still survives lock on
   the audioSession override, not on the element — the element is only the
   thing the lock screen talks to.

   FALSIFIER for `controls`: lock the phone with it on. ▶▶ on the card
   should start a blend into the next track within a couple of seconds (the
   title changes at the downbeat); ❚❚ should stop the music and ▶ bring it
   back. If ▶▶ does nothing, WebKit on this iOS did not make the element the
   session (or the element never started — the log line says). If the music
   itself stops at lock with `controls` on but not with `background`, the
   element is interfering with the graph and `controls` comes out. If the
   card shows 0:30 looping instead of the track, setPositionState is not
   being applied and that is a cosmetic finding, not a failure.

   ── lock-screen ART, 2026-08-19 (keeper: "can we project a visualization
   to the locked screen?") ──
   A web page gets exactly one pixel surface on an iOS lock screen: the
   Now Playing card's ARTWORK, via MediaMetadata.artwork. WebKit loads the
   image (MediaMetadata::setArtwork → refreshArtworkImage) and hands it to
   the system with the rest of the now-playing info
   (MediaSession::updateNowPlayingInfo fills info.metadata.artwork). No
   canvas, no Live Activity, no widget — an IMAGE, re-sent whenever the
   metadata object is replaced. So:

     poster   one image per track — the chosen panel drawn once from the
              loop's last bundle plus a text strip (track, n/N, bpm, key).
              Safe by construction; changes when the track does.
     live     the same image redrawn ONCE A SECOND from a fresh bundle
              (DWLOOP.sample() — the loop's measuring half, callable when
              the page is hidden and rAF is dead) and re-sent as new
              artwork. Whether iOS redraws the card's art at that rate
              without flicker, and keeps doing it for minutes, is NOT
              established anywhere I could find — it is the experiment.
              One image a second is a slideshow, not a visualisation; a
              panel that reads at that rate (journey, position, camelot)
              will look like itself, a spectrum will look like stills.

   FALSIFIER for `live`: lock the phone with it on. If the card's art
   changes every second and is still changing two minutes later, it holds.
   If it changes once and freezes, iOS (or WebKit) coalesces artwork
   updates and `poster` is the honest setting. If the card flickers or the
   art disappears, the re-send is too fast for the card and the cadence
   needs to drop. Android Chrome: artwork shows on the notification only
   with a media element, so this is iOS-only in practice.

   What the source does NOT establish: that the page's JS keeps running well
   enough on a locked phone for chain() to decode and schedule the next deck
   (a hidden page's timers are aligned to one second, which is nothing
   against a 45 s minimum dwell — but the process staying alive rests on the
   audio assertion, and only the device shows that). Hence the falsifier.

   STATE THE FALSIFIER: lock the phone with `background` on and a set
   playing. If the music continues THROUGH A HANDOVER (a new title on the
   lock-screen card) the graph and the planner both survived. If it stops
   within a few seconds of locking, WebKit on this iOS does not honour the
   override and `wake` stays the answer. If it plays the current track out
   and then stops or stutters, the graph survived and the planner's timers
   did not — a different fix.

   RESULT, `media`, 2026-08-19, iPhone 16 Pro Max / iOS 26.6: IT FELL. With
   `media` on the element "just keeps repeating a sound" — a short buffer
   looping, which is what a media element does when the MediaStream feeding
   it has stopped delivering: the graph was interrupted at lock, exactly as
   the source above says it would be without the audioSession override.
   `media` is no longer offered in the transport; it stays callable
   (`DWPHONE.set('media')`).

   RESULT, `background`, 2026-08-19, same device, same evening: the set kept
   playing through the lock — keeper: "you have made it work". Lock half
   CONFIRMED; whether a handover completes from a hidden page (a new title
   on the card) was still the open half when this was written.
   RESULT, `controls`, 2026-08-19, same device, same night: "Wow. That's
   amazing. It works." — the card's buttons reach the deck on iOS 26.6;
   whether ▶▶ blended and what the scrubber showed is still to be said.
   RESULT, `live` art: a preliminary "the tiles are keeping even while
   under lock", keeper double-checking which setting was on.
   ───────────────────────────────────────────────────────────────────────── */

window.DWPHONE = (function () {
'use strict';

const MODES = ['off', 'wake', 'background', 'controls', 'media'];
let mode = 'off', wakeLock = null, audioEl = null, lastTitle = null, tick = null;
/* lock-screen art: 'off' | 'poster' | 'live', and which panel draws it */
const ART = ['off', 'poster', 'live'];
let art = 'poster', artPanel = 'journey';
let artCanvas = null, artUrl = null, artMeta = null, artBusy = false, artFrames = 0, artAt = 0, artErr = null;
/* the silent element that is the lock screen's handle in `controls` */
let silentEl = null, silentUrl = null;
/* whether THIS page set navigator.audioSession.type — so `off` only touches
   the Audio Session when there is something of ours to undo */
let sessionOn = false;
try { const s = localStorage.getItem('dw-phone'); if (MODES.includes(s)) mode = s; } catch (e) {}
try { const a = localStorage.getItem('dw-phone-art'); if (ART.includes(a)) art = a;
      const q = localStorage.getItem('dw-phone-art-panel'); if (q) artPanel = q; } catch (e) {}

/* ── calls: an incoming phone call pauses the set (Android) ─────────────
   On iOS, WebKit interrupts the AudioContext itself when a call arrives
   and resumes it after — heard on the iPhone (alarm and call both stop
   and resume the set correctly). Chrome on Android interrupts NOTHING
   for a bare Web Audio graph: Android audio focus is granted to media
   ELEMENTS, a graph holds none, so the set played straight through a
   ringing phone (keeper, 2026-08-21, first Android run: "The music needs
   to interrupt during a phone call received. … By default anyway. This
   can be an option").

   The fix is to let a playing media element hold focus on the page's
   behalf: the same silent 30 s loop `controls` uses. Chrome pauses that
   element on transient focus loss (the call) and resumes it when the
   call ends; those two events are the whole signal. The element's
   `pause` listener suspends the deck (DW.pause()), its `play` listener
   resumes it. Pauses this module makes itself are marked (selfPauseAt,
   a 1 s window — media `pause` events are queued, a sync flag misses
   them) so a mode change is never mistaken for a call. ON by default;
   setCalls(false) / the dashboard toggle turns it off. The wiring is
   Android-only: on iOS the listeners are never attached, so the
   confirmed lock-screen behaviour is untouched.

   The element can only START inside a user gesture, so the dashboard's
   ▶ calls armCalls() in the click, and any later tap re-arms via kick.
   armedAt is a grace window: between arming and the deck actually
   playing (boot + decode), the 1 Hz sync must not tidy the proxy away.

   FALSIFIER: with a set playing on Android, receive a call. Music pauses
   at the ring and resumes at hang-up → the chain held. Plays through →
   read DWPHONE.status: silentElement 'paused'/'none' means the proxy
   never started (gesture rules — tap once after ▶), 'playing' means
   Chrome never granted focus to a silent-sample element, and the
   fallback is routing the mix through `media` so the audible element
   is the focus holder. */
const isAndroid = /Android/.test(navigator.userAgent);
let callsOn = true, interrupted = false, selfPauseAt = 0, armedAt = 0;
try { if (localStorage.getItem('dw-phone-calls') === 'off') callsOn = false; } catch (e) {}

function watchFocus(el) {
  if (!isAndroid || !el || el._dwFocusWatched) return;
  el._dwFocusWatched = true;
  el.addEventListener('pause', () => {
    if (!callsOn) return;
    if (Date.now() - selfPauseAt < 1000) return;   /* our own pause, not the phone's */
    if (window.DW && window.DW.state.ctx === 'running' && playing()) { interrupted = true; window.DW.pause(); }
  });
  el.addEventListener('play', () => {
    if (interrupted && window.DW && window.DW.state.ctx !== 'running') window.DW.pause();
    interrupted = false;
  });
}

/* keep the focus proxy in step with playback: set playing → proxy playing
   (start needs a gesture — armCalls() and kick provide one, this tick only
   retries), set over → proxy paused, marked as ours. In `media` the mix's
   own element holds focus and no proxy is wanted; in `controls` the silent
   element is already required playing and only the listeners matter. */
function proxySync() {
  if (!isAndroid) return;
  if (interrupted && window.DW && window.DW.state.ctx === 'running') interrupted = false;  /* resumed by hand */
  const want = callsOn && playing() && mode !== 'media';
  if (want) {
    const a = ensureSilent();
    if (a.paused && !interrupted && window.DW && window.DW.state.ctx === 'running') a.play().catch(() => {});
    if (!a.paused) armedAt = 0;
    updateSession();                    /* the Android notification names the track */
  } else if (mode !== 'controls' && silentEl && !silentEl.paused && Date.now() - armedAt > 15000) {
    selfPauseAt = Date.now(); try { silentEl.pause(); } catch (e) {}
  }
}
if (isAndroid) setInterval(proxySync, 1000);

const cap = {
  get wakeLock() { return !!(navigator.wakeLock && navigator.wakeLock.request); },
  get mediaSession() { return 'mediaSession' in navigator && typeof window.MediaMetadata === 'function'; },
  /* Audio Session API (w3c.github.io/audio-session): WebKit on iOS and macOS,
     on by default; not in Chromium or Gecko as of 2026-08-19 */
  get audioSession() { return !!(navigator.audioSession && 'type' in navigator.audioSession); }
};

/* ── wake ────────────────────────────────────────────────────────────── */
async function holdWake() {
  if (!cap.wakeLock || wakeLock) return;
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (e) { wakeLock = null; }     /* refused (low battery mode, not visible) — nothing to do */
}
function dropWake() { if (wakeLock) { try { wakeLock.release(); } catch (e) {} wakeLock = null; } }
/* ── holds that are not about playback ─────────────────────────────────
   A SCAN cannot progress with the screen off (the page is paused), and the
   keeper lost a 189-track analysis to force-of-habit locking. So any caller
   with long work can hold the screen awake for its duration, whatever the
   phone mode is set to — this is the one case where the lock is taken
   without asking, because the user pressed the button that needs it. */
const holds = new Set();
function hold(tag) { holds.add(tag); holdWake(); }
function release(tag) { holds.delete(tag); if (!holds.size && !(mode === 'wake' && playing())) dropWake(); }

/* a wake lock is released by the browser when the page is hidden; take it
   again when the page comes back, if a set is still playing or work is held */
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && (holds.size || (mode === 'wake' && playing()))) holdWake();
});

/* ── background: the Audio Session type ──────────────────────────────────
   Setting `playback` is what flips AudioContext::
   shouldOverrideBackgroundPlaybackRestriction() to true in WebKit (header).
   The setter can silently do nothing — DOMAudioSession::setType() returns
   early when the `microphone` permissions-policy feature is off for the
   document — so the value is read back rather than assumed. `auto` is the
   default and is what `off`/`wake` put back. */
function setSessionType(t) {
  if (!cap.audioSession) return false;
  try { navigator.audioSession.type = t; } catch (e) { return false; }
  return navigator.audioSession.type === t;
}

/* ── controls: a silent media element as the lock screen's handle ───────
   30 s of 16-bit zeros at 8 kHz (480 KB in memory, nothing on disk), looped.
   Longer than WebKit's 0.95 s main-content floor by a wide margin; short
   enough to build in a millisecond. Volume 1 and not muted, because a muted
   element is not Now-Playing-eligible — silence is in the samples, not the
   gain. */
function silentWav(sec) {
  const sr = 8000, n = sr * sec, buf = new ArrayBuffer(44 + n * 2), v = new DataView(buf);
  const w = (o, str) => { for (let i = 0; i < str.length; i++) v.setUint8(o + i, str.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  w(36, 'data'); v.setUint32(40, n * 2, true);
  return new Blob([buf], { type: 'audio/wav' });
}
function ensureSilent() {
  if (silentEl) return silentEl;
  silentUrl = URL.createObjectURL(silentWav(30));
  silentEl = document.createElement('audio');
  silentEl.src = silentUrl; silentEl.loop = true; silentEl.preload = 'auto';
  silentEl.setAttribute('playsinline', ''); silentEl.playsInline = true;
  silentEl.controls = false; silentEl.volume = 1; silentEl.style.display = 'none';
  document.body.appendChild(silentEl);
  watchFocus(silentEl);
  return silentEl;
}
async function silent(on) {
  if (on) { const a = ensureSilent(); try { await a.play(); } catch (e) { /* needs a gesture — kick retries */ } }
  else if (silentEl) { try { selfPauseAt = Date.now(); silentEl.pause(); } catch (e) {} }
}
/* the card's scrubber: the DECK's position, not the silent loop's */
function updatePosition() {
  if (!cap.mediaSession || mode !== 'controls' || typeof navigator.mediaSession.setPositionState !== 'function') return;
  const m = window.DW && window.DW.nowMeta, dk = window.DW && window.DW.deck;
  try {
    if (m && m.dur > 0) {
      const pos = Math.max(0, Math.min(m.dur, (typeof window.DW.elapsed === 'number' ? window.DW.elapsed : 0)));
      navigator.mediaSession.setPositionState({ duration: m.dur, position: pos, playbackRate: (dk && dk.rate) || 1 });
    } else navigator.mediaSession.setPositionState();
  } catch (e) {}
}

/* ── media ───────────────────────────────────────────────────────────── */
function ensureAudio() {
  if (audioEl) return audioEl;
  audioEl = document.createElement('audio');
  audioEl.setAttribute('playsinline', ''); audioEl.playsInline = true;
  audioEl.autoplay = true; audioEl.controls = false; audioEl.style.display = 'none';
  document.body.appendChild(audioEl);
  watchFocus(audioEl);
  return audioEl;
}
async function routeToMedia(on) {
  if (!window.DW) return;
  if (on) {
    const stream = await window.DW.outputStream(true);
    const a = ensureAudio();
    if (a.srcObject !== stream) a.srcObject = stream;
    try { await a.play(); } catch (e) { /* needs a gesture — the tap handler below retries */ }
  } else {
    /* ONLY UNWIRE A SINK THAT IS WIRED (review 2026-09-01). Every mode but
       `media` ends up here, including the saved mode the dashboard
       re-applies at load — and `DW.outputStream()` awaits boot(), so asking
       it to turn OFF a stream that was never on BUILT THE AUDIOCONTEXT
       outside any user gesture, on every page load, for a no-op. Reading
       `DW.outputVia` costs nothing and boots nothing. */
    if (window.DW.outputVia === 'stream') await window.DW.outputStream(false);
    if (audioEl) { try { selfPauseAt = Date.now(); audioEl.pause(); } catch (e) {} audioEl.srcObject = null; }
  }
}
/* a media element may only start inside a user gesture; any tap on the page
   while `media` is on starts it if it is not running — the same unlock idiom
   Web Audio itself needs on phones */
const kick = () => {
  if (mode === 'media' && audioEl && audioEl.paused && audioEl.srcObject) audioEl.play().catch(() => {});
  if (mode === 'controls' && silentEl && silentEl.paused && playing() && !interrupted) silentEl.play().catch(() => {});
  if (isAndroid) proxySync();          /* a gesture is the one moment the proxy may start */
};
document.addEventListener('touchend', kick, true);
document.addEventListener('click', kick, true);

/* ── media session: title on the lock screen, buttons that do things ──── */
function playing() { return !!(window.DW && window.DW.state && window.DW.state.now); }
function clean(n) { return String(n || '').replace(/^[^-]+-\s*/, '').replace(/^[^-]+-\s*/, '').replace(/^\d+\s*/, '') || String(n || ''); }
function fields(m) {
  return { title: clean(m.name).slice(0, 80),
           artist: String(m.name).split(' - ')[0].slice(0, 60),
           album: 'Deckwave · ' + Math.round(m.bpm) + ' bpm · ' + (m.camelot || '') };
}
/* (re)send the metadata object — with the current artwork when it belongs
   to the track now playing, without when it does not (a stale poster on a
   new title is wrong for the length of a blob encode; no poster is not) */
/* THE STATE IS THE CONTEXT'S, NOT "IS A TRACK LOADED" (review 2026-09-01).
   `playbackState = m ? 'playing' : 'none'` said playing whenever a track was
   loaded, so a paused set kept a ▶-less card claiming to play — and the card
   is the whole interface on a locked phone. `ctx` is the AudioContext state
   the engine already publishes; nothing new is measured. */
function sessionState() {
  const DW = window.DW;
  if (!DW || !DW.nowMeta) return 'none';
  return (DW.state && DW.state.ctx === 'running') ? 'playing' : 'paused';
}
function updateState() {
  if (!cap.mediaSession) return;
  const st = sessionState();
  try { if (navigator.mediaSession.playbackState !== st) navigator.mediaSession.playbackState = st; } catch (e) {}
}
function push(m) {
  if (!cap.mediaSession) return;
  try {
    const f = m ? fields(m) : null;
    if (f && artUrl && artMeta === m) f.artwork = [{ src: artUrl, sizes: '512x512', type: 'image/png' }];
    navigator.mediaSession.metadata = f ? new MediaMetadata(f) : null;
    navigator.mediaSession.playbackState = m ? sessionState() : 'none';
  } catch (e) {}
}
function updateSession() {
  if (!cap.mediaSession) return;
  const m = window.DW && window.DW.nowMeta;
  const title = m ? m.name : null;
  /* the title gate is what keeps this cheap at 1 Hz; the STATE has to be
     free to change without it (pause does not change the track) */
  if (title === lastTitle) return updateState();
  lastTitle = title;
  push(m || null);
}

/* ── lock-screen art ───────────────────────────────────────────────────
   Draw the chosen panel into a 512×512 canvas from the loop's bundle —
   DWLOOP.last on a visible page (frames are running and it is one frame
   old), DWLOOP.sample() on a hidden one (no frames; build one now) — add a
   text strip, encode, and re-send the metadata with the new artwork. */
function drawArt(T, D) {
  const S = 512, band = 88;
  if (!artCanvas) { artCanvas = document.createElement('canvas'); artCanvas.width = S; artCanvas.height = S; }
  const c = artCanvas.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.shadowBlur = 0;
  c.fillStyle = T.bg || '#04010f'; c.fillRect(0, 0, S, S);
  const P = window.DWPANELS && window.DWPANELS.get(artPanel);
  if (P) { c.save(); try { P.draw(c, S, S - band, T, D); } catch (e) { artErr = e.message; } c.restore(); }
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.shadowBlur = 0;
  const m = D.now;
  if (m) {
    const SET = D.set || [], i = SET.indexOf(m);
    c.fillStyle = T.bg || '#04010f'; c.fillRect(0, S - band, S, band);
    c.fillStyle = T.line || '#22125c'; c.fillRect(0, S - band, S, 1);
    const fn = T.fn || 'system-ui, sans-serif';
    c.textBaseline = 'middle'; c.textAlign = 'left';
    c.fillStyle = T.ac || '#22e8ff'; c.font = '600 30px ' + fn;
    c.fillText(clean(m.name).slice(0, 28), 18, S - band + 30);
    c.fillStyle = T.dim || '#7d6eb0'; c.font = '500 22px ' + fn;
    c.fillText((i > -1 ? (i + 1) + '/' + SET.length + ' · ' : '') + Math.round(m.bpm) + ' bpm · ' + (m.camelot || '')
               + (m._unlocked ? ' · straight' : ''), 18, S - band + 64);
    c.textAlign = 'right'; c.fillStyle = T.ac2 || '#ff2d95'; c.font = '600 18px ' + fn;
    c.fillText('DECKWAVE', S - 18, S - band + 64);
  }
}
function updateArt(force) {
  if (art === 'off' || !cap.mediaSession || artBusy) return;
  const m = window.DW && window.DW.nowMeta; if (!m) return;
  if (art === 'poster' && artMeta === m && !force) return;
  const L = window.DWLOOP; if (!L) return;
  let bnd = null;
  try { bnd = (document.visibilityState === 'hidden' && L.sample) ? L.sample() : L.last; } catch (e) { artErr = e.message; }
  if (!bnd) return;
  artBusy = true;
  try { drawArt(bnd.T, bnd.D); } catch (e) { artErr = e.message; artBusy = false; return; }
  artCanvas.toBlob(blob => {
    artBusy = false;
    if (!blob) return;
    if (artUrl) { try { URL.revokeObjectURL(artUrl); } catch (e) {} }
    artUrl = URL.createObjectURL(blob); artMeta = m; artFrames++; artAt = Date.now();
    push(m);
  }, 'image/png');
}
/* `background`: play/pause only. For an AudioContext-as-Now-Playing, WebKit
   handles play/pause/stop itself and never forwards next/previous to these
   handlers (header) — registering them would put two dead buttons on the
   lock screen. `media` (a real element) gets all four. */
function bindSession(m) {
  if (!cap.mediaSession) return;
  const set = (k, fn) => { try { navigator.mediaSession.setActionHandler(k, fn); } catch (e) {} };
  /* in `controls` the handlers are the whole path (MediaElementSession hands
     every command to them and touches nothing itself), so play/pause must
     move the silent element too or the card's state stops following */
  set('play',  () => { if (window.DW && window.DW.state.ctx !== 'running') window.DW.pause();
                       if (m === 'controls' && silentEl) silentEl.play().catch(() => {}); });
  set('pause', () => { if (window.DW && window.DW.state.ctx === 'running') window.DW.pause();
                       if (m === 'controls' && silentEl) { try { selfPauseAt = Date.now(); silentEl.pause(); } catch (e) {} } });
  const skip = m !== 'background';
  set('nexttrack', skip ? () => { if (window.DW) window.DW.skip(); } : null);
  set('previoustrack', skip ? () => { if (window.DW) window.DW.back(); } : null);
}

/* ── the mode ────────────────────────────────────────────────────────── */
async function apply() {
  const bg = mode === 'background' || mode === 'controls';
  if (!bg && sessionOn) { setSessionType('auto'); sessionOn = false; }
  if (mode !== 'controls') await silent(false);
  if (mode === 'wake') { await routeToMedia(false); if (playing()) holdWake(); }
  else if (bg) { if (!holds.size) dropWake(); await routeToMedia(false); sessionOn = setSessionType('playback');
                 if (mode === 'controls') await silent(true); }
  else if (mode === 'media') { if (!holds.size) dropWake(); await routeToMedia(true); }
  else { if (!holds.size) dropWake(); await routeToMedia(false); }
  if (mode !== 'off') { bindSession(mode); updateSession(); updatePosition(); }
  if (tick) clearInterval(tick);
  tick = mode === 'off' ? null : setInterval(() => {
    updateSession();
    updateArt(false);
    updatePosition();
    if (mode === 'wake') { if (playing()) holdWake(); else if (!holds.size) dropWake(); }
    /* the silent element must be playing for the card to be ours; it can
       only start inside a gesture, so this just keeps it going once it has */
    if (mode === 'controls' && silentEl && silentEl.paused && playing() && !interrupted && window.DW.state.ctx === 'running') silentEl.play().catch(() => {});
    /* …AND IT MUST STOP WHEN THE SET DOES (review 2026-09-01). `proxySync`
       tidies the focus proxy away in every mode except `controls`, and
       nothing else ever paused it, so a silent 30 s loop went on looping
       (and on Android went on holding audio focus) for as long as the tab
       lived after the last track ended, with a Now Playing card still on
       the lock screen for a set that is over. Marked as ours, so the call
       watcher does not read it as a ring; the line above restarts it when
       a set plays again. */
    if (mode === 'controls' && silentEl && !silentEl.paused && !playing()) {
      selfPauseAt = Date.now(); try { silentEl.pause(); } catch (e) {}
    }
  }, 1000);
}

return {
  MODES, cap, hold, release,
  get mode() { return mode; },
  async set(m) {
    if (!MODES.includes(m)) throw new Error('phone mode: ' + MODES.join(' | '));
    mode = m;
    try { localStorage.setItem('dw-phone', m); } catch (e) {}
    await apply();
    return mode;
  },
  /* ── calls (Android): an incoming call pauses the set — see the block
     above `watchFocus` for the mechanism and the falsifier ─────────── */
  get calls() { return callsOn; },
  setCalls(on) {
    callsOn = !!on;
    try { localStorage.setItem('dw-phone-calls', callsOn ? 'on' : 'off'); } catch (e) {}
    if (!callsOn) interrupted = false;
    proxySync();
    return callsOn;
  },
  /* call from INSIDE the ▶ gesture: playback is starting, so start the
     focus proxy while a user activation is live (a media element cannot
     start outside one). If the play then fails, proxySync tidies the
     proxy away once the 15 s grace runs out. */
  armCalls() {
    if (!isAndroid || !callsOn || mode === 'media') return false;
    armedAt = Date.now();
    const a = ensureSilent(); if (a.paused) a.play().catch(() => {});
    return true;
  },
  ART,
  /* lock-screen art: setArt('off' | 'poster' | 'live', panelId?) */
  get art() { return art; }, get artPanel() { return artPanel; },
  setArt(a, panel) {
    if (!ART.includes(a)) throw new Error('phone art: ' + ART.join(' | '));
    art = a;
    if (panel) artPanel = panel;
    try { localStorage.setItem('dw-phone-art', a); localStorage.setItem('dw-phone-art-panel', artPanel); } catch (e) {}
    artMeta = null;                       /* redraw for the current track */
    if (a === 'off') { artUrl = null; push(window.DW && window.DW.nowMeta || null); }
    else updateArt(true);
    return { art, artPanel };
  },
  /* what is actually in effect right now — for the log line and a bug report */
  get status() {
    return { mode, wakeLockHeld: !!wakeLock, wakeLockAvailable: cap.wakeLock, holds: [...holds],
             android: isAndroid, calls: callsOn, callInterrupted: interrupted,
             mediaSession: cap.mediaSession,
             art, artPanel, artFrames, artAgeMs: artAt ? Date.now() - artAt : null, artErr,
             audioSessionAvailable: cap.audioSession,
             audioSession: cap.audioSession ? navigator.audioSession.type : null,
             output: window.DW ? window.DW.outputVia : null,
             audioElement: audioEl ? (audioEl.paused ? 'paused' : 'playing') : 'none',
             silentElement: silentEl ? (silentEl.paused ? 'paused' : 'playing') : 'none' };
  }
};
})();
