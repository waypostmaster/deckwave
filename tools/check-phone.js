/* Does the phone module set, read back and undo what it says it does?

   DWPHONE has one job per mode and nothing here can hear a phone: `wake`
   holds a Screen Wake Lock, `background` sets navigator.audioSession.type
   to 'playback' (the one thing WebKit's source says keeps a Web Audio graph
   running at lock — assets/deckwave-phone.js cites the files), `media`
   swaps the sink to a MediaStream. This harness loads the real module under
   a fake navigator/document/DW and checks the plumbing: the right API is
   touched, read back rather than assumed, undone on the way out, and not
   touched when it was never ours. Every check states its falsifier.

   Also the lock-screen ART: a poster per track, or a live redraw once a
   second through DWLOOP.sample() on a hidden page / DWLOOP.last on a
   visible one, re-sent as MediaMetadata.artwork. Checked here: which
   bundle source is used when, that a poster is drawn once per track and a
   live frame every tick, that the panel gets the 512-wide canvas minus the
   text strip, that a panel error is stashed not thrown, and that `off`
   re-sends the metadata without artwork.

   What it does NOT establish: whether iOS honours the override, or repaints
   the card's art at 1 Hz. Only the device does — LISTENING §8 and §9.

       node tools/check-phone.js
*/
const fs = require('fs');
let fails = 0, checks = 0;
const ok = (name, cond, falsifier) => {
  checks++;
  if (!cond) { fails++; console.log('  FAIL  ' + name + '\n        falsifier hit: ' + falsifier); }
  else console.log('  pass  ' + name);
};

/* CRLF-proof, like the other four */
const src = fs.readFileSync(process.env.DECKWAVE_PHONE_SRC || 'assets/deckwave-phone.js', 'utf8').replace(/\r\n/g, '\n');

/* ── fakes ──────────────────────────────────────────────────────────────── */
const handlers = {};
let wakeRequests = 0, releases = 0;
const navigatorFake = {
  userAgent: 'test',
  audioSession: { type: 'auto' },
  mediaSession: { metadata: null, playbackState: 'none', position: undefined,
    setActionHandler(k, fn) { handlers[k] = fn; },
    setPositionState(st) { this.position = st; } },
  wakeLock: { async request() { wakeRequests++;
    return { addEventListener() {}, release() { releases++; } }; } }
};
const outputCalls = [];
const elements = [];                     /* every element the module creates */
const calls = { pause: 0, skip: 0, back: 0 };
const DW = {
  state: { now: null, ctx: 'running' }, nowMeta: null, outputVia: 'speakers', elapsed: 12.5, deck: { rate: 1.02 },
  async outputStream(on) { outputCalls.push(on); this.outputVia = on ? 'stream' : 'speakers'; return on ? { id: 'stream' } : null; },
  pause() { calls.pause++; this.state.ctx = this.state.ctx === 'running' ? 'suspended' : 'running'; },
  skip() { calls.skip++; }, back() { calls.back++; }
};
/* a hand-driven interval: the module's 1 Hz tick runs when the test says */
const intervals = [];
global.setInterval = (fn) => { intervals.push(fn); return intervals.length; };
global.clearInterval = (id) => { intervals[id - 1] = null; };
const runTick = () => { const fn = intervals.filter(Boolean).pop(); if (fn) fn(); };

/* canvas: records what the panel was asked to draw; toBlob is synchronous */
const drawn = [];
let blobs = 0;
const ctx2d = { setTransform() {}, fillRect() {}, fillText() {}, save() {}, restore() {},
  set fillStyle(v) {}, set font(v) {}, set textAlign(v) {}, set textBaseline(v) {},
  set globalAlpha(v) {}, set shadowBlur(v) {} };
const makeCanvas = () => ({ width: 0, height: 0, getContext() { return ctx2d; },
  toBlob(cb) { blobs++; cb({ size: 1, type: 'image/png' }); } });
global.URL = { createObjectURL: () => 'blob:art-' + blobs, revokeObjectURL() {} };

/* the loop: a bundle on demand, and a record of which accessor was used */
let sampled = 0, lastRead = 0;
const bundle = () => ({ T: { bg: '#000', ac: '#0ff', dim: '#777', line: '#333', fn: 'x' },
  D: { now: DW.nowMeta, set: [DW.nowMeta], freq: null, wave: null } });
global.DWLOOP = { get last() { lastRead++; return bundle(); }, sample() { sampled++; return bundle(); } };
let panelThrows = false;
global.DWPANELS = { get(id) { return { id, draw(c, w, h, T, D) {
  drawn.push({ id, w, h, now: D.now }); if (panelThrows) throw new Error('panel boom'); } }; } };

global.window = global;
/* Node 21+ has its own read-only `navigator` global; a plain assignment is
   silently ignored and every check below would fail against a module that
   is right. Define it. */
Object.defineProperty(global, 'navigator', { value: navigatorFake, configurable: true, writable: true });
global.MediaMetadata = function (o) { Object.assign(this, o); };
global.document = { visibilityState: 'visible', addEventListener() {},
  createElement(tag) { if (tag === 'canvas') return makeCanvas();
    const el = { tag, listeners: {}, setAttribute() {}, style: {}, paused: true, srcObject: null, src: null, plays: 0,
      addEventListener(k, fn) { (this.listeners[k] = this.listeners[k] || []).push(fn); },
      fire(k) { (this.listeners[k] || []).forEach(f => f()); },
      async play() { this.paused = false; this.plays++; this.fire('play'); },
      pause() { this.paused = true; this.fire('pause'); } };
    elements.push(el); return el; },
  body: { appendChild() {} } };
global.DW = DW;
eval(src);
const PH = window.DWPHONE;
const tick = () => new Promise(r => setTimeout(r, 0));

(async () => {
  console.log('\n── background: the Audio Session type ──────────────────────');
  ok('a background mode exists', PH.MODES.includes('background'),
     'MODES lacks background — the old module, with only off/wake/media');
  ok('the module reports the Audio Session API', PH.cap.audioSession === true,
     'cap.audioSession is not true with navigator.audioSession present');

  await PH.set('background'); await tick();
  ok('background sets navigator.audioSession.type = playback', navigatorFake.audioSession.type === 'playback',
     'type is ' + navigatorFake.audioSession.type + ' — the override WebKit keys on was never set');
  /* the sink test is "where is the output", not "was the setter called":
     since the review's pre-gesture-boot fix the module only calls
     outputStream(false) when a stream is actually wired, because that call
     awaits boot() and would build the AudioContext outside a gesture */
  ok('background keeps the mix on the speakers', DW.outputVia === 'speakers' && !outputCalls.includes(true),
     'output via ' + DW.outputVia + ' · calls ' + JSON.stringify(outputCalls) + ' — background must not swap the sink');
  ok('status carries the type read back', PH.status.audioSession === 'playback' && PH.status.audioSessionAvailable === true,
     'status.audioSession is ' + PH.status.audioSession);
  ok('background registers play and pause', typeof handlers.play === 'function' && typeof handlers.pause === 'function',
     'play/pause handlers missing');
  ok('background registers NO next/previous (dead buttons on an AudioContext session)',
     handlers.nexttrack === null && handlers.previoustrack === null,
     'nexttrack is ' + typeof handlers.nexttrack + ' — WebKit never routes next/previous to JS for an AudioContext');

  await PH.set('wake'); await tick();
  ok('leaving background restores the type to auto', navigatorFake.audioSession.type === 'auto',
     'type stayed ' + navigatorFake.audioSession.type + ' after wake');
  ok('wake registers next/previous again', typeof handlers.nexttrack === 'function' && typeof handlers.previoustrack === 'function',
     'nexttrack is ' + typeof handlers.nexttrack);

  await PH.set('background'); await tick();
  await PH.set('off'); await tick();
  ok('off after background restores the type to auto', navigatorFake.audioSession.type === 'auto',
     'type stayed ' + navigatorFake.audioSession.type + ' after off');

  console.log('\n── only undo what was ours ───────────────────────────────────');
  navigatorFake.audioSession.type = 'transient';       /* someone else set it */
  await PH.set('wake'); await tick();
  await PH.set('off'); await tick();
  ok('a type this page never set is left alone', navigatorFake.audioSession.type === 'transient',
     'type became ' + navigatorFake.audioSession.type + ' — off clobbered a type that was not ours');
  navigatorFake.audioSession.type = 'auto';

  console.log('\n── when the setter is refused or absent ─────────────────────');
  /* DOMAudioSession::setType() returns early under a denying permissions
     policy and the value does not change — the module must read back */
  const stubborn = { get type() { return 'auto'; }, set type(v) {} };
  navigatorFake.audioSession = stubborn;
  await PH.set('background'); await tick();
  ok('a refused setter is reported as not taken', PH.status.audioSession === 'auto',
     'status claims ' + PH.status.audioSession + ' though the setter ignored it');
  await PH.set('off'); await tick();

  delete navigatorFake.audioSession;
  let threw = null;
  try { await PH.set('background'); await tick(); } catch (e) { threw = e; }
  ok('no Audio Session API: background resolves, reports unavailable', !threw && PH.status.audioSessionAvailable === false && PH.status.audioSession === null,
     threw ? ('threw ' + threw.message) : ('status ' + JSON.stringify(PH.status)));
  ok('...and still keeps the speakers', DW.outputVia === 'speakers', 'output via ' + DW.outputVia);
  await PH.set('off'); await tick();
  navigatorFake.audioSession = { type: 'auto' };

  console.log('\n── the other modes are unchanged ────────────────────────────');
  DW.state.now = { name: 'x' }; DW.nowMeta = { name: 'A - B', bpm: 120, camelot: '8A' };
  const before = wakeRequests;
  await PH.set('wake'); await tick();
  ok('wake takes the lock while a set plays', wakeRequests === before + 1 && PH.status.wakeLockHeld === true,
     'requests ' + (wakeRequests - before) + ', held ' + PH.status.wakeLockHeld);
  ok('wake leaves the Audio Session alone', navigatorFake.audioSession.type === 'auto',
     'wake set type ' + navigatorFake.audioSession.type);
  const rel = releases;
  await PH.set('background'); await tick();
  ok('background drops the wake lock (locking the screen is the point)', releases === rel + 1 && PH.status.wakeLockHeld === false,
     'releases ' + (releases - rel) + ', held ' + PH.status.wakeLockHeld);
  ok('media session metadata is set from the deck', navigatorFake.mediaSession.metadata && navigatorFake.mediaSession.metadata.title === 'B',
     'metadata ' + JSON.stringify(navigatorFake.mediaSession.metadata));

  PH.hold('scan'); await tick();
  await PH.set('background'); await tick();
  ok('a held scan keeps the screen awake whatever the mode', PH.status.wakeLockHeld === true && PH.status.holds.includes('scan'),
     'held ' + PH.status.wakeLockHeld + ' holds ' + PH.status.holds);
  PH.release('scan'); await tick();
  ok('releasing the hold drops it again in background mode', PH.status.wakeLockHeld === false, 'still held');

  await PH.set('media'); await tick();
  ok('media swaps the sink to the stream', outputCalls[outputCalls.length - 1] === true && DW.outputVia === 'stream',
     'output via ' + DW.outputVia);
  ok('media leaves the Audio Session alone', navigatorFake.audioSession.type === 'auto',
     'media set type ' + navigatorFake.audioSession.type);
  ok('media registers all four handlers', ['play', 'pause', 'nexttrack', 'previoustrack'].every(k => typeof handlers[k] === 'function'),
     'a handler is missing in media mode');
  await PH.set('off'); await tick();
  ok('off puts the speakers back', DW.outputVia === 'speakers', 'output via ' + DW.outputVia);

  /* ── the pre-gesture boot (review 2026-09-01) ───────────────────────────
     DW.outputStream() awaits boot(), so the dashboard re-applying a saved
     mode at load walked every non-media path into building an AudioContext
     outside any user gesture — for a call that could only ever be a no-op.
     Control pair: the no-op must be skipped AND a real unwiring must still
     happen. */
  outputCalls.length = 0;
  await PH.set('wake'); await tick();
  await PH.set('background'); await tick();
  await PH.set('controls'); await tick();
  await PH.set('off'); await tick();
  ok('applying a saved mode never asks the engine to unwire a sink that was never wired (no pre-gesture boot)',
     outputCalls.length === 0 && DW.outputVia === 'speakers',
     'outputStream calls ' + JSON.stringify(outputCalls) + ' — each one awaits boot() and builds the AudioContext outside a gesture');
  outputCalls.length = 0;
  await PH.set('media'); await tick();
  await PH.set('background'); await tick();
  ok('CONTROL: leaving media DOES unwire the stream (the skip is conditional, not a deletion)',
     outputCalls.join(',') === 'true,false' && DW.outputVia === 'speakers',
     'calls ' + JSON.stringify(outputCalls) + ' via ' + DW.outputVia);
  await PH.set('off'); await tick();

  /* ── the card's playbackState is the CONTEXT's, not "a track is loaded" ── */
  DW.state.now = { name: 'S - T' }; DW.nowMeta = { name: 'S - T', bpm: 120, camelot: '8A', dur: 100 };
  DW.state.ctx = 'running';
  await PH.set('background'); await tick();
  ok('a playing set says playing on the card', navigatorFake.mediaSession.playbackState === 'playing',
     'playbackState ' + navigatorFake.mediaSession.playbackState);
  DW.state.ctx = 'suspended';
  runTick(); await tick();
  ok('a PAUSED set says paused on the card — the same track is still loaded',
     navigatorFake.mediaSession.playbackState === 'paused',
     'playbackState ' + navigatorFake.mediaSession.playbackState
     + ' — the lock screen is the whole interface there, and it claimed to be playing');
  DW.state.ctx = 'running';
  runTick(); await tick();
  ok('CONTROL: resuming says playing again (the state follows, it is not stuck)',
     navigatorFake.mediaSession.playbackState === 'playing',
     'playbackState ' + navigatorFake.mediaSession.playbackState);
  DW.state.now = null; DW.nowMeta = null;
  runTick(); await tick();
  ok('nothing loaded is none', navigatorFake.mediaSession.playbackState === 'none',
     'playbackState ' + navigatorFake.mediaSession.playbackState);
  await PH.set('off'); await tick();

  /* ── the focus-holding silent loop stops when the set does ───────────── */
  DW.state.now = { name: 'S - T' }; DW.nowMeta = { name: 'S - T', bpm: 120, camelot: '8A', dur: 100 };
  DW.state.ctx = 'running';
  await PH.set('controls'); await tick();
  const loopEl = elements[elements.length - 1];
  await loopEl.play();
  runTick(); await tick();
  ok('while a set plays, the silent Now Playing loop keeps running', loopEl.paused === false,
     'the card is only ours while that element plays');
  DW.state.now = null; DW.nowMeta = null;
  runTick(); await tick();
  ok('when the set ends the silent loop is paused, not left looping for the life of the tab',
     loopEl.paused === true && PH.status.silentElement === 'paused',
     'silentElement ' + PH.status.silentElement + ' — 30 s of zeros looping forever, holding Android audio focus, under a card for a set that is over');
  DW.state.now = { name: 'S - T' }; DW.nowMeta = { name: 'S - T', bpm: 120, camelot: '8A', dur: 100 };
  runTick(); await tick();
  ok('CONTROL: a new set starts it again (paused, not torn down)', loopEl.paused === false,
     'silentElement ' + PH.status.silentElement);
  await PH.set('off'); await tick();
  DW.state.now = null; DW.nowMeta = null;

  let bad = null; try { await PH.set('nope'); } catch (e) { bad = e; }
  ok('an unknown mode throws and names the modes', bad && /background/.test(bad.message), bad ? bad.message : 'no throw');

  console.log('\n── lock-screen art ──────────────────────────────────────────');
  ok('art defaults to poster · journey', PH.art === 'poster' && PH.artPanel === 'journey',
     'art ' + PH.art + ' panel ' + PH.artPanel);
  DW.state.now = { name: 'x' }; DW.nowMeta = { name: 'LukHash - GHOSTS - 05 TAKE CONTROL', bpm: 128, camelot: '7A' };
  await PH.set('background'); await tick();
  drawn.length = 0; blobs = 0; sampled = 0; lastRead = 0;
  global.document.visibilityState = 'visible';
  PH.setArt('poster', 'journey'); await tick();
  ok('poster: draws the panel once into 512 wide, minus the text strip', drawn.length === 1 && drawn[0].id === 'journey' && drawn[0].w === 512 && drawn[0].h < 512 && drawn[0].h > 380,
     'drawn ' + JSON.stringify(drawn));
  ok('poster on a visible page reads DWLOOP.last, not sample()', lastRead === 1 && sampled === 0,
     'last ' + lastRead + ' sample ' + sampled + ' — sample() advances loop state and must not run while frames run');
  const md = navigatorFake.mediaSession.metadata;
  ok('the metadata carries the artwork', md && md.artwork && md.artwork[0].src === 'blob:art-1' && md.artwork[0].sizes === '512x512',
     'metadata ' + JSON.stringify(md));
  ok('…and still the title', md && md.title === 'TAKE CONTROL', 'title ' + (md && md.title));
  runTick(); runTick(); await tick();
  ok('poster: the same track is not redrawn on later ticks', drawn.length === 1 && blobs === 1,
     'drawn ' + drawn.length + ' blobs ' + blobs);
  DW.nowMeta = { name: 'LukHash - GHOSTS - 06 NEXT', bpm: 120, camelot: '8A' };
  runTick(); await tick();
  ok('poster: a new track is drawn once', drawn.length === 2 && drawn[1].now === DW.nowMeta && blobs === 2,
     'drawn ' + drawn.length + ' blobs ' + blobs);
  ok('the new metadata carries the new art, not the old', navigatorFake.mediaSession.metadata.artwork[0].src === 'blob:art-2' && navigatorFake.mediaSession.metadata.title === 'NEXT',
     JSON.stringify(navigatorFake.mediaSession.metadata));

  drawn.length = 0; sampled = 0; lastRead = 0;
  global.document.visibilityState = 'hidden';
  PH.setArt('live', 'position'); await tick();
  runTick(); await tick(); runTick(); await tick();
  ok('live: one frame per tick, from the chosen panel', drawn.length === 3 && drawn.every(d => d.id === 'position'),
     'drawn ' + JSON.stringify(drawn.map(d => d.id)));
  ok('live on a HIDDEN page builds each bundle with DWLOOP.sample()', sampled === 3 && lastRead === 0,
     'sample ' + sampled + ' last ' + lastRead + ' — rAF is dead on a hidden page; last would be stale');
  ok('status counts the frames', PH.status.artFrames >= 5 && PH.status.art === 'live' && PH.status.artPanel === 'position',
     JSON.stringify(PH.status));
  global.document.visibilityState = 'visible';
  sampled = 0; lastRead = 0; runTick(); await tick();
  ok('live on a VISIBLE page reads DWLOOP.last', lastRead === 1 && sampled === 0, 'last ' + lastRead + ' sample ' + sampled);

  panelThrows = true; runTick(); await tick(); panelThrows = false;
  ok('a panel that throws is stashed in status.artErr, not thrown', PH.status.artErr === 'panel boom',
     'artErr ' + PH.status.artErr);

  PH.setArt('off'); await tick();
  ok('off re-sends the metadata without artwork', !navigatorFake.mediaSession.metadata.artwork && navigatorFake.mediaSession.metadata.title === 'NEXT',
     JSON.stringify(navigatorFake.mediaSession.metadata));
  const n0 = drawn.length; runTick(); await tick();
  ok('off: nothing is drawn on later ticks', drawn.length === n0, 'drawn ' + (drawn.length - n0) + ' more');
  let badArt = null; try { PH.setArt('gif'); } catch (e) { badArt = e; }
  ok('an unknown art mode throws', !!badArt, 'no throw');
  await PH.set('off'); await tick();

  console.log('\n── controls: a silent element as the lock screen\'s handle ───');
  DW.state.now = { name: 'x' }; DW.state.ctx = 'running';
  DW.nowMeta = { name: 'LukHash - GHOSTS - 05 TAKE CONTROL', bpm: 128, camelot: '7A', dur: 240 };
  navigatorFake.audioSession.type = 'auto';
  await PH.set('controls'); await tick();
  const sil = elements.find(e => e.tag === 'audio' && e.src && String(e.src).startsWith('blob:'));
  ok('controls sets the Audio Session to playback (it IS background, plus)', navigatorFake.audioSession.type === 'playback',
     'type ' + navigatorFake.audioSession.type);
  ok('controls creates a silent looping element from a blob and plays it', sil && sil.loop === true && sil.plays >= 1 && !sil.paused,
     'element ' + JSON.stringify(sil && { loop: sil.loop, plays: sil.plays, paused: sil.paused, src: sil.src }));
  ok('the silent element is not muted and at full volume (a muted element is not Now-Playing-eligible)', sil && sil.volume === 1 && !sil.muted,
     'volume ' + (sil && sil.volume) + ' muted ' + (sil && sil.muted));
  ok('controls keeps the mix on the speakers', DW.outputVia === 'speakers', 'output via ' + DW.outputVia);
  ok('controls registers next/previous (the element routes them to JS)', typeof handlers.nexttrack === 'function' && typeof handlers.previoustrack === 'function',
     'nexttrack ' + typeof handlers.nexttrack);
  handlers.nexttrack(); handlers.previoustrack();
  ok('▶▶ / ◀◀ land on DW.skip / DW.back', calls.skip === 1 && calls.back === 1, 'skip ' + calls.skip + ' back ' + calls.back);
  const pos = navigatorFake.mediaSession.position;
  ok('the card\'s scrubber is the DECK\'s position, not the 30 s loop', pos && pos.duration === 240 && pos.position === 12.5 && pos.playbackRate === 1.02,
     'positionState ' + JSON.stringify(pos));
  const p0 = calls.pause;
  handlers.pause();
  ok('❚❚ suspends the context AND pauses the silent element', calls.pause === p0 + 1 && DW.state.ctx === 'suspended' && sil.paused,
     'pause calls ' + (calls.pause - p0) + ' ctx ' + DW.state.ctx + ' silent paused ' + sil.paused);
  handlers.play();
  ok('▶ resumes the context AND the silent element', calls.pause === p0 + 2 && DW.state.ctx === 'running' && !sil.paused,
     'pause calls ' + (calls.pause - p0) + ' ctx ' + DW.state.ctx + ' silent paused ' + sil.paused);
  ok('status reports the silent element', PH.status.silentElement === 'playing', 'silentElement ' + PH.status.silentElement);
  await PH.set('background'); await tick();
  ok('leaving controls for background pauses the silent element and keeps playback type', sil.paused && navigatorFake.audioSession.type === 'playback',
     'silent paused ' + sil.paused + ' type ' + navigatorFake.audioSession.type);
  ok('…and drops next/previous again', handlers.nexttrack === null && handlers.previoustrack === null, 'nexttrack ' + typeof handlers.nexttrack);
  await PH.set('off'); await tick();
  ok('off restores auto and leaves the element paused', navigatorFake.audioSession.type === 'auto' && sil.paused,
     'type ' + navigatorFake.audioSession.type + ' silent paused ' + sil.paused);

  /* ── calls: an incoming phone call pauses the set (Android) ────────────
     Chrome on Android grants audio focus to media ELEMENTS only — a bare
     Web Audio graph plays straight through a ringing phone (keeper,
     2026-08-21, first Android run). The module's answer: the silent loop
     holds focus for the page; Chrome pausing it at the ring is the signal,
     Chrome resuming it at hang-up is the other. Checked here against a
     fresh eval of the module under an Android UA with NO Audio Session
     API: the watcher exists, arms inside a gesture, pauses/resumes the
     deck on external pause/play, and never mistakes its own pauses (mode
     changes, set over) for a call. Time windows are crossed by skewing
     Date.now, not by sleeping. What only a phone shows: whether Android
     grants focus to a silent-sample element at all — the falsifier in
     deckwave-phone.js's `calls` block. */
  console.log('\n── calls: a phone call pauses the set (Android) ────────────');
  ok('off Android, armCalls is a no-op', PH.armCalls() === false,
     'armCalls returned true under UA "test" — the proxy would grab audio focus on desktops and iPhones');

  const RealNow = Date.now.bind(Date);
  let skew = 0;
  Date.now = () => RealNow() + skew;

  navigatorFake.mediaSession.metadata = null;
  const navAndroid = { userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/139.0.0.0 Mobile Safari/537.36',
                       mediaSession: navigatorFake.mediaSession, wakeLock: navigatorFake.wakeLock };
  Object.defineProperty(global, 'navigator', { value: navAndroid, configurable: true, writable: true });
  const ivBefore = intervals.length, elBefore = elements.length;
  DW.state.now = null; DW.nowMeta = null; DW.state.ctx = 'running';
  eval(src);
  const PA = window.DWPHONE;
  const callsTick = intervals[ivBefore];

  ok('on Android the module registers a 1 Hz calls watcher at load', typeof callsTick === 'function' && intervals.length === ivBefore + 1,
     'intervals grew by ' + (intervals.length - ivBefore) + ' — no module-level proxy tick, a call can never be noticed');
  ok('calls default ON (the keeper: "by default anyway")', PA.calls === true && PA.status.calls === true && PA.status.android === true,
     'calls ' + PA.calls + ' status ' + JSON.stringify({ calls: PA.status.calls, android: PA.status.android }));

  const armed = PA.armCalls();
  const proxy = elements[elements.length - 1];
  ok('armCalls (inside the ▶ gesture) starts the silent focus proxy', armed === true && elements.length === elBefore + 1 && proxy.tag === 'audio' && !proxy.paused,
     'armed ' + armed + ' elements +' + (elements.length - elBefore) + ' paused ' + (proxy && proxy.paused));
  callsTick();
  ok('the proxy survives the gap between ▶ and the deck playing (grace)', !proxy.paused,
     'the 1 Hz sync tidied the proxy away before DW.play() finished booting — every ▶ loses its focus holder');

  DW.state.now = { name: 'LukHash - TEST TRACK', bpm: 120, dur: 240, camelot: '8A' };
  DW.nowMeta = DW.state.now;
  callsTick();
  ok('with a set playing, the Android notification names the track', !!(navigatorFake.mediaSession.metadata && navigatorFake.mediaSession.metadata.title === 'TEST TRACK'),
     'metadata ' + JSON.stringify(navigatorFake.mediaSession.metadata) + ' — the notification would say only the page name');

  const c0 = calls.pause;
  proxy.pause();                    /* Chrome pausing the element on transient focus loss — the ring */
  ok('an external pause on the proxy pauses the deck (THE CALL)', calls.pause === c0 + 1 && DW.state.ctx === 'suspended' && PA.status.callInterrupted === true,
     'pause calls +' + (calls.pause - c0) + ' ctx ' + DW.state.ctx + ' callInterrupted ' + PA.status.callInterrupted);
  callsTick();
  ok('the watcher does not fight the call (no restart while interrupted)', proxy.paused && DW.state.ctx === 'suspended',
     'proxy paused ' + proxy.paused + ' ctx ' + DW.state.ctx + ' — restarting the proxy mid-call would resume music into the call');
  proxy.play();                     /* focus regained at hang-up — Chrome resumes the element */
  ok('focus regained resumes the deck', calls.pause === c0 + 2 && DW.state.ctx === 'running' && PA.status.callInterrupted === false,
     'pause calls +' + (calls.pause - c0) + ' ctx ' + DW.state.ctx + ' — the set stays paused after every call');

  skew += 20000;                    /* grace and self-pause windows all behind us */
  DW.state.now = null; DW.nowMeta = null;
  const c1 = calls.pause;
  callsTick();
  ok('set over: the watcher tidies its own proxy without touching the deck', proxy.paused && calls.pause === c1 && PA.status.callInterrupted === false,
     'proxy paused ' + proxy.paused + ' pause calls +' + (calls.pause - c1));

  /* the dangerous self-pause: leaving `controls` mid-set pauses the silent
     element while music is PLAYING — it must not read as a call */
  DW.state.now = { name: 'X - Y', bpm: 100, dur: 100 }; DW.nowMeta = DW.state.now; DW.state.ctx = 'running';
  await PA.set('controls'); await tick();
  skew += 2000;
  const c2 = calls.pause;
  await PA.set('wake'); await tick();
  ok('a mode change pausing the element mid-set is NOT a call', calls.pause === c2 && DW.state.ctx === 'running',
     'pause calls +' + (calls.pause - c2) + ' ctx ' + DW.state.ctx + ' — switching phone modes would silence the set');
  await PA.set('off'); await tick();

  skew += 2000;
  PA.setCalls(false);
  proxy.play();
  const c3 = calls.pause;
  proxy.pause();                    /* focus loss with the option OFF */
  ok('setCalls(false): a focus loss no longer touches the deck', calls.pause === c3 && DW.state.ctx === 'running' && PA.calls === false,
     'pause calls +' + (calls.pause - c3) + ' ctx ' + DW.state.ctx + ' calls ' + PA.calls);
  PA.setCalls(true);
  ok('setCalls(true) restores the default and status says so', PA.calls === true && PA.status.calls === true,
     'calls ' + PA.calls);

  console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') + ' of ' + checks + ' checks');
  process.exit(fails ? 1 : 0);
})();
