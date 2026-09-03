/* RECON app logic - hot-swappable. The shell (index.html) fetches this
   file, tears down the previous instance (timers, listeners, feed DOM)
   and boots this one. The deck iframe is NEVER touched by a swap: the
   music, the audio session and the speech arming all live there and
   survive every upgrade. Keep boot()/teardown() symmetrical - every
   interval goes through iv(), every document/window listener into subs. */
'use strict';
window.RECONAPP = (function () {
const timers = [], subs = [];
const iv = (fn, ms) => { const id = setInterval(fn, ms); timers.push(id); return id; };
function boot() {
/* read-only, enforced: the ONLY fetch below is /recon.jsonl (same origin);
   a record click copies its URL and never follows it; every rendered field
   goes through esc(). */
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const deck = () => { try { return $('dw').contentWindow.DWEVENTS || null; } catch (e) { return null; } };

/* ── state ── */
const seen = new Set();            /* ts+hash of every record already shown */
let canAct = false;                /* boot re-renders are DISPLAY ONLY: side effects
                                      (speak, sayfile, event, level, voiceCfg) fire only
                                      for records that ARRIVE after boot - otherwise
                                      every hot-swap replays the whole seance (the
                                      keeper's 'multiple under speeches at once') */
const pending = [];                /* arrived, holding for the assumed downbeat */
let liveCount = 0;                 /* non-pinned rows, for the 200 ring */
let lastArrival = 0;               /* wall time of the newest record */
let swapNote = '';                 /* a failed hot swap, said on the staleness line until the next reload */
let awayFirst = null, awayN = 0;   /* rows that landed while document.hidden */
const PINKEY = 'dwrecon-pins';
let pins = [];                     /* full records, localStorage-persisted */
try { pins = JSON.parse(localStorage.getItem(PINKEY) || '[]'); } catch (e) { pins = []; }

/* the identity of a record, for dedupe and pins. EVERY ingested field is in
   here: the first cut hashed ts|title|url|note only, so a second record
   differing only in shot/status/links/sayfile (recon-shot.py stamps ts at
   1 s resolution and defaults title to '') collided with the first and was
   SILENTLY SKIPPED - a genuinely new frame that never rendered, with no log
   and no counter. Ledger 86. */
const hash = r => { let h = 5381;
  const s = [r.ts, r.title, r.url, r.note, r.event, r.sayfile, r.shot, r.status,
             r.speak, r.level, (r.links || []).join('\u0001'),
             r.voiceCfg ? JSON.stringify(r.voiceCfg) : '', r.vocals ? JSON.stringify(r.vocals) : ''].join('|');
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); };
const stripQ = u => String(u || '').split('?')[0];
/* the only path shape the stage will render, matched not cleaned - the
   sayfile rule. No slash inside the name means no fed string escapes the
   served root, and the extension list is what an <img> can actually show. */
const SHOTPATH = /^recon-shots\/[A-Za-z0-9._-]+\.(png|jpe?g|webp)$/;
const STALE_MS = 90000;   /* past this a frame stops claiming to be recent */

/* ── render ── */
function row(r, into) {
  const d = document.createElement('div');
  d.className = 'rec' + (r.pin ? ' pinned' : '');
  d.innerHTML = '<div class="top"><span class="ts">' + esc((r.ts || '').replace('T', ' ').replace(/\.\d+Z?$/, '')) + '</span>'
    + '<span class="src" data-s="' + esc(r.source) + '">' + esc(r.source || '?') + '</span>'
    + '<span class="title">' + esc(r.title) + '</span>'
    + (r.event ? '<span class="ev">⚡' + esc(r.event) + '</span>' : '')
    + (r.sayfile ? '<span class="say" title="play this take">▶ take</span>' : '')
    + (r.shot ? '<span class="shot" title="put this frame back on the stage">▣ view</span>' : '') + '</div>'
    + (r.note ? '<div class="note">' + esc(String(r.note).slice(0, 400)) + '</div>' : '')
    + (r.url ? '<div class="url">' + esc(r.url) + '</div>' : '')
    + '<span class="pinbtn" title="pin">📌</span>';
  d.querySelector('.pinbtn').onclick = e => { e.stopPropagation(); togglePin(r, d); };
  /* a rendered take is PRESSABLE from its row - the quiet-boot gate
     rightly refuses to auto-play backlog takes (the seance fix), but
     that left them unreachable: nothing had armed the again button
     (ledger 77, keeper: "I cannot get anything to play"). A real tap
     is an INVITATION, not a replay accident: it plays regardless of
     the voice toggle, skips the vocal gate (the press means NOW), and
     arms again. */
  const sayBtn = d.querySelector('.say');
  if (sayBtn) sayBtn.onclick = e => { e.stopPropagation(); armAgain(r.sayfile); playSayfile(r.sayfile, d); };
  /* the same shape for a frame: the newest shot owns the stage on arrival,
     but scrollback would be dead without a way back to an older one. The age
     line then reports THAT record's age, so a re-staged frame cannot quietly
     read as current. */
  const shotBtn = d.querySelector('.shot');
  if (shotBtn) shotBtn.onclick = e => { e.stopPropagation(); stageShow(r, { open: true }); };
  d.onclick = () => copyUrl(r, d);
  into.prepend(d);
  return d;
}
/* the rendered voice, as a named player so records and the again button
   share one path. Failures are VISIBLE (a marker on the newest row) -
   the lorem recital failed silently into a console the phone cannot
   see, which is exactly the calm-looking lie this screen exists to
   forbid. */
function sayMark(text, el) {
  let rowEl = el || document.querySelector('#feed .rec');
  if (!rowEl) {
    /* empty feed: MAKE a row rather than bare-return. The old exit re-opened
       ledger 77 on a fresh console - "deck not ready" had nowhere to land
       and vanished. Ledger 90. */
    const e0 = $('empty'); if (e0) e0.remove();
    rowEl = row({ ts: new Date().toISOString(), source: 'console', title: 'voice',
                  url: '', note: '', pin: false, event: null }, $('feed'));
  }
  const top = rowEl.querySelector('.top');
  if (!top) return;
  /* markers get their OWN class: the old guard refused a second marker if any
     `.wait` span existed - which every operator row carries permanently
     ("waiting for the agent"), so failures on those rows were swallowed; and
     RECON.drain() rewrites `.wait` spans, which would relabel a failure as
     "picked up". Newest marker replaces the last. */
  const old = top.querySelector('.saymark'); if (old) old.remove();
  const m = document.createElement('span');
  m.className = 'saymark'; m.textContent = text;
  top.appendChild(m);
}
function playSayfile(path, rowEl) {
  const tok = (window.__sayfileTok = (window.__sayfileTok || 0) + 1);
  (async () => {
    try {
      const w = $('dw').contentWindow;
      const ctx = w.DW && w.DW._dev && w.DW._dev.ctx;
      if (!ctx) { sayMark('\u{1F507} no audio context \u2014 press \u25B6 in the deck first', rowEl); return; }
      /* a SUSPENDED context (DW.pause(), or an Android call via the calls
         feature) lets decode resolve and start() succeed in total silence -
         and the queued source would burst out at resume. Ledger 89. */
      if (ctx.state !== 'running') { sayMark('\u{1F507} deck audio is ' + ctx.state + ' \u2014 resume the set first', rowEl); return; }
      const resp = await fetch('../../' + path + '?b=' + Date.now(), { cache: 'no-store' });
      if (!resp.ok) { sayMark('\u{1F507} take not found (' + resp.status + ')', rowEl); return; }
      let buf;
      try { buf = await ctx.decodeAudioData(await resp.arrayBuffer()); }
      catch (e) { sayMark('\u{1F507} decode refused \u2014 ' + String((e && e.message) || e).slice(0, 40), rowEl); return; }
      if (tok !== window.__sayfileTok) return;   /* a newer take took over mid-decode */
      /* replacing a take stops BOTH sources: the main one AND the facility
         chain's detuned double - the first cut stopped only __sayfileSrc,
         so a replaced take's double kept talking to the end of its buffer
         at 0.45 gain through the old chain. Ledger 100. */
      if (window.__sayfileSrc) { try { window.__sayfileSrc.stop(); } catch (e) {} }
      if (window.__sayfileDbl) { try { window.__sayfileDbl.stop(); } catch (e) {} window.__sayfileDbl = null; }
      const g = ctx.createGain();
      let gv = 1; try { const x = parseFloat(localStorage.getItem('dw-voice-gain')); if (isFinite(x)) gv = Math.max(0, Math.min(2, x)); } catch (e) {}
      g.gain.value = gv;
      /* the voice card's tap: an analyser between the voice gain and the
         output. REAL signal - the wave the card draws is this take's own
         samples, the same rule as every panel. And the gain node is kept
         reachable so the voice fader moves a PLAYING take live. */
      const ana = ctx.createAnalyser(); ana.fftSize = 2048;
      g.connect(ana); ana.connect(ctx.destination);
      window.__sayfileGain = g;
      const src = ctx.createBufferSource(); src.buffer = buf;
      /* warp: playbackRate on the rendered take - voiceCfg {"warp": n},
         0.7..1.3, default 1. HONEST: this moves pitch AND speed
         together (0.92 ~= -8% of both) - it is the stand-in for
         Piper's missing pitch parameter, not a pitch shifter. */
      let warp = 1; try { const ww = parseFloat(localStorage.getItem('dw-voice-warp')); if (isFinite(ww)) warp = Math.max(0.7, Math.min(1.3, ww)); } catch (e) {}
      src.playbackRate.value = warp;
      let fx = 'off'; try { fx = localStorage.getItem('dw-voice-fx') || 'off'; } catch (e) {}
      /* 'facility' is the name; 'glados' is accepted forever as the legacy
         value, because it is already sitting in the keeper's localStorage
         and a rename must not silently switch their chain off. */
      if (fx === 'facility' || fx === 'glados') {
        /* the facility chain - the register, not the person */
        const band = ctx.createBiquadFilter(); band.type = 'highpass'; band.frequency.value = 140;
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6500;
        const mix = ctx.createGain(); mix.gain.value = 1;
        const dbl = ctx.createBufferSource(); dbl.buffer = buf; dbl.playbackRate.value = 1.007 * warp;
        const dblG = ctx.createGain(); dblG.gain.value = 0.45;
        /* room size 0..1 scales the slap's wet and feedback together -
           voiceCfg {"room": n}, default 1 = the original facility */
        let room = 1; try { const rr = parseFloat(localStorage.getItem('dw-voice-room')); if (isFinite(rr)) room = Math.max(0, Math.min(1, rr)); } catch (e) {}
        const dly = ctx.createDelay(0.3); dly.delayTime.value = 0.055;
        const fb = ctx.createGain(); fb.gain.value = 0.22 * room;
        const wet = ctx.createGain(); wet.gain.value = 0.28 * room;
        src.connect(band); dbl.connect(dblG); dblG.connect(band);
        band.connect(lp); lp.connect(mix);
        lp.connect(dly); dly.connect(fb); fb.connect(dly); dly.connect(wet); wet.connect(mix);
        mix.connect(g);
        window.__sayfileSrc = src;
        window.__sayfileDbl = dbl;
        src.start(); dbl.start();
      } else {
        src.connect(g);
        window.__sayfileSrc = src;
        src.start();
      }
      voiceShow({ kind: 'take', who: path, ana: ana });
      src.onended = () => { if (tok === window.__sayfileTok) voiceEnd('take'); };
    } catch (e) { sayMark('\u{1F507} voice failed \u2014 ' + String((e && e.message) || e).slice(0, 40), rowEl); }
  })();
}

/* THE VOCAL GATE. The analysis is VOCAL-BLIND - nothing in a record can
   tell a sung voice from a lead synth (same blindness class as the
   loudness-blind exit, ledger 72), so there is no detector to consult
   and building one by reasoning is forbidden here. This list is the
   keeper's EAR: lowercase name fragments of tracks known to carry
   vocals, patchable from the feed with
   {"vocals":{"add":["name"],"remove":["name"]}}. Before a voice record
   plays, a listed now-playing track is blended away from via the SAME
   intent bus as everything else ('change' - the gate-constrained fast
   blend, never a second path to the play order), and the voice holds
   until the deck has moved - or 15 s, then it speaks anyway: a stuck
   blend must not swallow the narrator. If the NEXT track is also
   listed, the voice speaks over it rather than chain skips - one move,
   no loops. Seeds: DROWNING (keeper's ear, 2026-08-22 - the voice
   spoke over its vocal), THRILLER and Big in Japan (sung covers per
   docs/VIDEO-CLEARANCE.md). */
let vocals = ['drowning', 'thriller', 'big in japan'];
try { const vv = JSON.parse(localStorage.getItem('dw-recon-vocals') || 'null'); if (Array.isArray(vv)) vocals = vv; } catch (e) {}
function saveVocals() { try { localStorage.setItem('dw-recon-vocals', JSON.stringify(vocals.slice(0, 100))); } catch (e) {} }
function vocalNow() {
  try {
    const D = deck(); if (!D || !D.pulse) return null;
    const p = D.pulse(); if (!p || !p.playing || !p.name) return null;
    const n = String(p.name).toLowerCase();
    return vocals.some(v => n.indexOf(String(v).toLowerCase()) !== -1) ? p.name : null;
  } catch (e) { return null; }
}
function clearVocals(then) {
  const hit = vocalNow();
  if (!hit) { then(); return; }
  const D = deck();
  sayMark('\u266a vocals (' + hit + ') - blending away first');
  if (D && D.inject) D.inject('change').catch(() => {});
  const t0 = Date.now();
  const w = iv(() => {
    const still = vocalNow();
    if (!still || still !== hit || Date.now() - t0 > 15000) {
      clearInterval(w);
      then();     /* the fade tail may still be under the first words - honest, not hidden */
    }
  }, 500);
}

function land(r) {
  $('empty') && $('empty').remove();
  const el = row(r, $('feed'));
  if (document.hidden) { awayN++; if (!awayFirst) awayFirst = el; }
  if (r.pin && !pins.some(p => hash(p) === hash(r))) { pins.push(r); savePins(); renderPins(); }
  if (!r.pin) {
    liveCount++;
    if (liveCount > 200) {                        /* ring: oldest unpinned falls off */
      const rows = [...$('feed').querySelectorAll('.rec:not(.pinned)')];
      const old = rows[rows.length - 1]; if (old) { old.remove(); liveCount--; }
    }
  }
  if (r.event && !r.quiet) { const D = deck(); if (D && D.inject) D.inject(r.event).then(m => console.log('[recon]', m)).catch(() => {}); }
  /* the newest frame takes the stage. This runs on backlog records too - it
     is DISPLAY, not a side effect, so the quiet-boot gate does not apply -
     and records arrive oldest first, so the newest wins. A frame restored
     from an old backlog is not a lie: the age line dates it, and says so.

     "records arrive oldest first" is a REQUIREMENT ON THE PRODUCER, not an
     observed fact, and this page cannot verify it: the ts belongs to the
     writer, and this screen already declines to trust that clock for age
     (see arrivedAt). Nothing here sorts.

     THIS SELECTION IS THE ONLY THING THAT REQUIREMENT PROTECTS. row() ends
     in prepend(), so DOM position is an exact record of ARRIVAL whatever the
     timestamps say - which is why the ring eviction (bottom row = earliest
     arrival) and the away divider are correct by construction and need no
     ordering guarantee at all. Only the stage asks "newest in the WORLD",
     and only the stage answers it with "last one read".
     Written down in the file header, in SKILL.md and as ledger 113 rather
     than defended here, because sorting THIS on a clock we have already said
     we do not trust would scramble a correct file order to fix an incorrect
     one. If it is ever fixed, it is one selection, not three. */
  /* A NEW FRAME STILL TAKES THE STAGE even if the operator has stepped back:
     this is an ops screen and the current thing is the point. Nothing is
     lost - the frame they were on keeps its place in the walk, and the age
     line dates whatever is showing. */
  if (r.shot) { shots.push(r); stageShow(r); }
  /* the narrator's voice: records carrying `speak` are read aloud over the
     music by the PAGE (DWEVENTS.speak - our duck, not the OS's), gated on
     the voice toggle so nothing talks uninvited */
  /* remote tuning: a voiceCfg record patches duck/pitch/rate/voice on the
     deck (cosmetic audio config - the agent's tuning channel) */
  /* the amplifier: a level field sets the deck's master volume (0..1,
     clamped - the dial is labelled eleven, the electronics stop at one) */
  if (r.vocals && !r.quiet) {                   /* the keeper's-ear vocal list, patched from the feed */
    (Array.isArray(r.vocals.add) ? r.vocals.add : []).forEach(n => { n = String(n).toLowerCase().slice(0, 80); if (n && !vocals.includes(n)) vocals.push(n); });
    (Array.isArray(r.vocals.remove) ? r.vocals.remove : []).forEach(n => { n = String(n).toLowerCase(); vocals = vocals.filter(v => v !== n); });
    saveVocals();
  }
  if (r.level != null && !r.quiet) { try { $('dw').contentWindow.DW.volume = r.level; } catch (e) {} }
  if (r.voiceCfg && voiceOn && !r.quiet) {
    if (r.voiceCfg.volume != null) {              /* the bridge reads this store */
      try { localStorage.setItem('dw-voice-volume', String(Math.max(0, Math.min(1, +r.voiceCfg.volume)))); } catch (e) {}
    }
    if (r.voiceCfg.boost != null) {               /* music rises to full during speech */
      try { localStorage.setItem('dw-voice-boost', r.voiceCfg.boost === 'on' || r.voiceCfg.boost === true ? 'on' : 'off'); } catch (e) {}
    }
    if (r.voiceCfg.overdrive != null) {           /* over-unity speech gain, 1..1.5 */
      try { localStorage.setItem('dw-voice-overdrive', String(Math.max(1, Math.min(1.5, +r.voiceCfg.overdrive || 1)))); } catch (e) {}
    }
    if (r.voiceCfg.gain != null) {                /* the RENDERED voice's real volume knob */
      try { localStorage.setItem('dw-voice-gain', String(Math.max(0, Math.min(2, +r.voiceCfg.gain || 1)))); } catch (e) {}
    }
    if (r.voiceCfg.fx != null) {                  /* 'facility' ('glados' legacy) | 'off' */
      const on = r.voiceCfg.fx === 'facility' || r.voiceCfg.fx === 'glados';
      try { localStorage.setItem('dw-voice-fx', on ? 'facility' : 'off'); } catch (e) {}
    }
    if (r.voiceCfg.room != null) {                /* facility room size, 0..1 */
      try { localStorage.setItem('dw-voice-room', String(Math.max(0, Math.min(1, +r.voiceCfg.room || 1)))); } catch (e) {}
    }
    if (r.voiceCfg.warp != null) {                /* take playbackRate: pitch AND speed together (piper has no pitch knob) */
      try { localStorage.setItem('dw-voice-warp', String(Math.max(0.7, Math.min(1.3, +r.voiceCfg.warp || 1)))); } catch (e) {}
    }
    const D = deck();
    if (D && D.configureSpeech) console.log('[recon]', D.configureSpeech(r.voiceCfg)); }
  /* the RENDERED voice: a wav from the served tree, decoded on the
     deck's own running context and mixed through a dedicated gain
     straight to the output. NO speech session exists, so the OS ducks
     nothing (ledgers 74/75 route around entirely) - the music stays
     exactly as steady as the deck makes it, and the voice finally has a
     real volume knob (dw-voice-gain, via voiceCfg.gain). Path strictly
     speech/*.wav, same origin. Uses the _dev seam's ctx - same
     experiment status as the overdrive, same landing plan. */
  /* ARMING IS NOT PLAYING, and they were the same line. A take used to arm
     the again button only if it landed with the voice ON and outside quiet
     boot - so after a reload the backlog re-rendered, nothing armed, and
     again was dead with nothing on screen to say why. That is ledger 77 one
     button along: the fix then made ROWS pressable and left the button
     itself unarmed. Every take arms it now, in arrival order so the newest
     wins; the quiet-boot gate still owns whether anything PLAYS. */
  if (r.sayfile) armAgain(r.sayfile);
  if (r.sayfile && voiceOn && !r.quiet) clearVocals(() => playSayfile(r.sayfile));
  if (r.speak && voiceOn && !r.quiet) clearVocals(() => { const D = deck();
    if (D && D.speak) {
      const words = r.speak === true ? (r.title + '. ' + r.note) : r.speak;
      D.speak(words);
      voiceShow({ kind: 'tts', text: words });
      verifySpoke('\u{1F507} voice did not start \u2014 tap \u21BB again',
                  document.querySelector('#feed .rec'));
    } });
}
/* DID IT ACTUALLY START? speak() returns a sentence describing what it
   ATTEMPTED - "speaking 214 chars over the set" is written before a single
   word comes out, and speakAgain() with nothing armed returns a sentence
   too. Trusting either is the same class of mistake as counting lit pixels.
   So: wait, then ask the engine whether it is speaking, and only mark the
   screen if it is not. iOS has been seen suppressing un-gestured speech
   that a real tap then plays fine, which is why the marker names the
   gesture. */
function verifySpoke(text, rowEl) {
  setTimeout(() => {
    try {
      const w = $('dw').contentWindow;
      if (!w.speechSynthesis.speaking && !w.speechSynthesis.pending) sayMark(text, rowEl);
    } catch (e) {}
  }, 900);
}
/* the again button's own state, on the button. A control that is always lit
   and usually dead teaches the operator to distrust the screen. */
function armAgain(path) {
  if (path) window.__lastSayfile = path;
  const b = $('again'); if (!b) return;
  const on = !!window.__lastSayfile;
  b.classList.toggle('armed', on);
  b.title = on ? 'repeat the last take \u2014 ' + window.__lastSayfile : 'nothing to repeat yet';
}
let voiceOn = false;
try { voiceOn = localStorage.getItem('dw-recon-voice') === 'on'; } catch (e) {}
if (voiceOn) { $('spk').classList.add('on'); $('spk').textContent = 'voice on'; }
$('again').onclick = () => {                     /* a real tap - arms too */
  if (window.__lastSayfile) { playSayfile(window.__lastSayfile); return; }
  const D = deck();
  /* NEVER SILENT. Both paths out of here used to be invisible: a bare
     `return` when the deck was not up, and console.log for whatever
     DWEVENTS said - "failed silently into a console the phone cannot see"
     is ledger 77's own wording, about this same voice. */
  if (!D || !D.speakAgain) { sayMark('\u{1F507} deck not ready — press ▶ in the deck first'); return; }
  if (D.armSpeech) D.armSpeech();
  verifySpoke('\u{1F507} ' + D.speakAgain());
  voiceShow({ kind: 'tts', text: null });   /* the grace timer hides it if nothing starts */
};
$('spk').onclick = () => {
  voiceOn = !voiceOn;
  try { localStorage.setItem('dw-recon-voice', voiceOn ? 'on' : 'off'); } catch (e) {}
  const D = deck(); if (voiceOn && D && D.armSpeech) D.armSpeech();   /* this tap is the gesture */
  $('spk').classList.toggle('on', voiceOn);
  $('spk').textContent = voiceOn ? 'voice on' : 'voice off';
};
function copyUrl(r, d) {
  if (!r.url) return;
  const mark = t => { const c = document.createElement('span'); c.className = 'copied'; c.textContent = t;
    d.appendChild(c); setTimeout(() => c.remove(), 900); };
  /* success and failure BOTH say so - the old failure path was () => {},
     and no clipboard at all said nothing (ledger 97's class) */
  if (navigator.clipboard && navigator.clipboard.writeText)
    navigator.clipboard.writeText(r.url).then(() => mark('copied'), () => mark('copy failed'));
  else mark('no clipboard here');
}
function togglePin(r, d) {
  const h = hash(r), i = pins.findIndex(p => hash(p) === h);
  if (i > -1) { pins.splice(i, 1); d.classList.remove('pinned'); }
  else { pins.push(r); d.classList.add('pinned'); }
  savePins(); renderPins();
  liveCount = $('feed').querySelectorAll('.rec:not(.pinned)').length;
}
function savePins() { try { localStorage.setItem(PINKEY, JSON.stringify(pins)); } catch (e) {} }
function renderPins() { const P = $('pins'); P.innerHTML = ''; for (const r of pins) row(r, P); }
renderPins();

/* ── the assumed-downbeat scheduler ──
   pulse() is read every 150 ms; when beatInBar wraps to 0 a downbeat has
   passed and everything pending lands together. Not playing → immediate.
   Safety: a paused deck reports playing with a frozen clock, so anything
   pending longer than 8 s lands anyway — held-forever would be a lie of
   the calm-looking kind this screen exists to avoid. */
let lastBeatInBar = -1;
iv(() => {
  const D = deck(); const p = D && D.pulse ? D.pulse() : null;
  const playing = p && p.playing && p.bar;
  if (!playing) { while (pending.length) land(pending.shift().r); lastBeatInBar = -1; updatePendingNote(); return; }
  const bib = p.bar.beatInBar;
  const downbeat = bib === 0 && lastBeatInBar !== 0;
  lastBeatInBar = bib;
  const now = Date.now();
  if (downbeat || pending.some(q => now - q.at > 8000)) { while (pending.length) land(pending.shift().r); }
  updatePendingNote();
}, 150);
function updatePendingNote() {
  let n = $('pending');
  if (!pending.length) { if (n) n.remove(); return; }
  if (!n) { n = document.createElement('div'); n.id = 'pending'; $('feed').prepend(n); }
  n.textContent = pending.length + ' holding for the assumed downbeat…';
  $('feed').prepend(n);
}

/* ── ingest: poll the jsonl, which is the source of truth on reload
   (pins are the one thing localStorage carries — they survive even a
   truncated feed file) ── */
async function poll() {
  let txt = null;
  try {
    const r = await fetch('../../recon.jsonl?b=' + Date.now(), { cache: 'no-store' });
    if (r.ok) txt = await r.text();
  } catch (e) {}
  if (txt == null) return;
  for (const line of txt.split('\n')) {
    if (!line.trim()) continue;
    let o; try { o = JSON.parse(line); } catch (e) { continue; }
    /* the upgrade directive: {"reload":true,"ts":"..."} re-fetches THIS
       app's own code from its own origin and re-boots it - the deck
       iframe is untouched, so the music never stops. Gated on a ts newer
       than the last applied one (localStorage), so old lines are inert. */
    if (o.reload === true) {
      const ts = String(o.ts || ''), rk = 'reload·' + ts;
      if (!seen.has(rk)) { seen.add(rk);
        /* NUMERIC, not lexical (review 2026-09-01 M9, ledger 123): as a
           string "9999-…" outranked every real date and one such line
           wedged hot-swap until localStorage was cleared by hand. A ts that
           does not parse, or sits more than 10 minutes ahead of this
           clock, is refused — 10 min is a CHOSEN skew allowance, like the
           stage's 90 s. */
        let prev = ''; try { prev = localStorage.getItem('dw-recon-appts') || ''; } catch (e) {}
        const t = Date.parse(ts), p = Date.parse(prev);
        if (isFinite(t) && t <= Date.now() + 600000 && !(isFinite(p) && t <= p)) {
          try { localStorage.setItem('dw-recon-appts', ts); } catch (e) {}
          setTimeout(async () => {
            const done = window.__loadApp ? await window.__loadApp() : false;
            if (done) return;
            /* CONSUMED ONLY ON SUCCESS: a 404 or a script that would not
               run used to eat the line for good. Put the previous ts back,
               forget the line so it lands again next poll, and SAY it on
               this screen — a console the phone cannot see is where ledger
               77/85's failures went to die. */
            try { localStorage.setItem('dw-recon-appts', prev); } catch (e) {}
            seen.delete(rk);
            swapNote = 'upgrade failed — still running the old console code (recon-app.js could not be fetched or did not run)';
          }, 50);
        } }
      continue;
    }
    const r = { ts: String(o.ts || ''), source: String(o.source || '?').slice(0, 16),
                title: String(o.title || '').slice(0, 160), url: stripQ(o.url),
                note: o.note != null ? String(o.note) : '', pin: !!o.pin,
                event: o.event ? String(o.event).slice(0, 24) : null,
                speak: o.speak === true ? true : (o.speak ? String(o.speak).slice(0, 2000) : null),
                voiceCfg: (o.voiceCfg && typeof o.voiceCfg === 'object') ? o.voiceCfg : null,
                level: o.level != null && isFinite(+o.level) ? Math.max(0, Math.min(1, +o.level)) : null,
                sayfile: (typeof o.sayfile === 'string' && /^speech\/[A-Za-z0-9._-]+\.wav$/.test(o.sayfile)) ? o.sayfile : null,
                vocals: (o.vocals && typeof o.vocals === 'object' && !Array.isArray(o.vocals)) ? o.vocals : null,
                /* THE STAGE. Same discipline as sayfile: a path this page will
                   render is matched against a literal shape, not cleaned. No
                   slash is allowed inside the name, so no fed string reaches
                   outside the served root. status and links are capped because
                   an unbounded field is an unbounded screen. */
                shot: (typeof o.shot === 'string' && SHOTPATH.test(o.shot)) ? o.shot : null,
                status: o.status ? String(o.status).slice(0, 80) : null,
                links: Array.isArray(o.links) ? o.links.slice(0, 12).map(l => stripQ(String(l)).slice(0, 120)) : null };
    r.quiet = !canAct;                /* backlog record: render, never act */
    const key = r.ts + '·' + hash(r);
    if (seen.has(key)) continue;
    seen.add(key);
    lastArrival = Date.now();
    r.arrivedAt = lastArrival;        /* THIS device's clock - the stage age
                                         refuses to trust the producer's alone */
    const D = deck(); const p = D && D.pulse ? D.pulse() : null;
    if (p && p.playing) pending.push({ r, at: Date.now() }); else land(r);
  }
  updatePendingNote();
  canAct = true;                      /* backlog rendered; new arrivals act */
}
poll(); iv(poll, 2000);

/* ── away divider ── */
const onVis = () => {
  if (!document.hidden && awayN > 0 && awayFirst) {
    const d = document.createElement('div');
    d.className = 'divider'; d.textContent = '── ' + awayN + ' while you were away ──';
    awayFirst.after(d);                    /* newest-first feed: above = after the batch's first row */
    awayFirst = null; awayN = 0;
  }
};
document.addEventListener('visibilitychange', onVis);
subs.push(() => document.removeEventListener('visibilitychange', onVis));

/* ── staleness: never look calm about silence ── */
iv(() => {
  const el = $('stale');
  if (swapNote) { el.className = 'bad'; el.textContent = swapNote; return; }
  if (!lastArrival) return;                              /* keep the waiting text */
  const s = Math.floor((Date.now() - lastArrival) / 1000);
  if (s >= 300) { el.className = 'bad';
    el.textContent = 'no record for ' + Math.floor(s / 60) + 'm — agent idle or stopped: this screen cannot tell';
  } else { el.className = s > 120 ? 'warn' : '';
    el.textContent = 'last record ' + (s < 60 ? s + 's' : Math.floor(s / 60) + 'm ' + (s % 60) + 's') + ' ago'; }
}, 5000);

/* ── the reply tray: a MESSAGE TRAY, not a command line ─────────────────
   THE DANGER, faced instead of shipped: this box cannot authenticate its
   typist (over --lan, anyone on the network can reach this page), so
   nothing here is a command channel. Two tiers, structural:
     · text that parses as a DWEVENTS intent steers the MUSIC immediately
       and locally — harmless, reversible, no agent involved;
     · everything else is STORED with provenance (dwrecon-inbox,
       localStorage, cap 50) and rendered as a waiting row. The agent
       reads it via window.RECON.drain() through the browser it already
       drives — no POST endpoint, no new network surface — and its
       contract (SKILL.md) is to quote the note back in chat and confirm
       before acting on it. Typed words are attributed data, not orders. */
const INKEY = 'dwrecon-inbox';
let inbox = [];
try { inbox = JSON.parse(localStorage.getItem(INKEY) || '[]'); } catch (e) { inbox = []; }
const saveInbox = () => { try { localStorage.setItem(INKEY, JSON.stringify(inbox.slice(-50))); } catch (e) {} };
function opRow(m, waiting) {
  const r = { ts: m.ts, source: 'operator', title: waiting ? 'note to the agent' : 'note (picked up)',
              url: '', note: m.text, pin: false, event: null };
  const el = row(r, $('feed'));
  el.classList.add('op');
  if (waiting) { const w2 = document.createElement('span'); w2.className = 'wait';
    w2.textContent = '↩ waiting for the agent'; el.querySelector('.top').appendChild(w2); }
  return el;
}
for (const m of inbox) opRow(m, true);            /* undrained notes survive reload */
$('replybtn').onclick = () => { $('replybtn').classList.toggle('on');
  $('composer').classList.toggle('on'); if ($('composer').classList.contains('on')) $('say').focus(); };
async function sendNote() {
  const t = $('say').value.trim(); if (!t) return;
  $('say').value = '';
  const D = deck();
  const kind = D && D.parse ? D.parse(t) : null;
  if (kind && D.inject) {                          /* tier 1: music words act now, locally */
    const msg = await D.inject(t);
    const el = opRow({ ts: new Date().toISOString(), text: t + '\n→ ' + msg }, false);
    el.querySelector('.title').textContent = '♪ ' + kind;
    return;
  }
  const m = { ts: new Date().toISOString(), text: t };
  inbox.push(m); saveInbox();
  opRow(m, true);
}
$('send').onclick = sendNote;
/* into subs like every other document listener: the composer lives in the
   SHELL and outlives a hot swap, and an anonymous listener here survived
   teardown — after one reload, Enter fired the OLD instance's sendNote
   first, which overwrote the persisted inbox with its stale snapshot and
   the live drain() never saw the note (review 2026-09-01 M8, ledger 123) */
const onSayKey = e => { if (e.key === 'Enter') sendNote(); };
$('say').addEventListener('keydown', onSayKey);
subs.push(() => $('say').removeEventListener('keydown', onSayKey));
window.RECON = {
  inbox: () => inbox.slice(),
  drain() { const out = inbox.slice(); inbox = []; saveInbox();
    document.querySelectorAll('.rec .wait').forEach(w2 => { w2.textContent = '✓ picked up'; w2.style.color = 'var(--good)'; });
    return out; }
};

/* ── the deck strip + fold ── */
/* voice volume bridge: the durable knob is DWEVENTS speechCfg.volume,
   but the RUNNING deck iframe predates it - so until that page next
   reloads naturally, the console applies the stored voice volume to
   every utterance by wrapping the iframe's own speechSynthesis.speak
   (same origin; idempotent via a flag; re-applied if the iframe ever
   reloads). WebKit is historically patchy about utterance.volume - if
   a set value changes nothing, that is the platform, report it. */
function bridgeVoiceVolume() {
  try {
    const w = $('dw').contentWindow;
    if (!w || !w.speechSynthesis) return;
    /* v2: ONE mutable config on the iframe window, read at utterance
       time - swaps only update the config, never depend on which app
       version installed the wrap. Installed chained over whatever speak
       currently is (v1 wraps included), gated by a version stamp. The
       boost touches NOTHING on the utterance (ledger 75 taught what
       touching utterances costs on iOS): restore is by polling
       speechSynthesis.speaking. */
    let boost = false;
    try { boost = localStorage.getItem('dw-voice-boost') === 'on'; } catch (e) {}
    w.__dwSpeechShape = { boost: boost };
    if (w.__dwVolWrapped === 'v2') return;
    const prev = w.speechSynthesis.speak.bind(w.speechSynthesis);
    w.speechSynthesis.speak = u => {
      try {
        const cfg = w.__dwSpeechShape || {};
        if (cfg.boost && u.volume !== 0) {
          const DW = w.DW;
          const cruise = DW ? DW.volume : null;
          if (DW && typeof cruise === 'number' && cruise < 1) {
            DW.volume = 1;
            /* OVERDRIVE - a live EXPERIMENT through the engine's own patch
               seam (_dev.master), keeper-requested ("raise the music during
               ducking by 20%"): during speech the master gain goes OVER
               unity, into the compressor downstream, because 1.0 x the OS
               duck still lands short of baseline. Clamped 1.0..1.5. The
               restore path is unchanged - DW.volume's own setter rewrites
               the gain to cruise. If the ear approves, this lands in the
               module as a proper clamp change and the _dev reach goes away;
               if it distorts, one voiceCfg line turns it off. */
            try {
              const od = parseFloat(localStorage.getItem('dw-voice-overdrive'));
              if (isFinite(od) && od > 1 && w.DW._dev && w.DW._dev.master) {
                const g = Math.min(1.5, od);
                w.DW._dev.master.gain.setTargetAtTime(g, w.DW._dev.ctx.currentTime, 0.02);
              }
            } catch (e) {}
            let ticks = 0, started = false;
            const back = setInterval(() => {
              ticks++;
              /* iOS takes a beat between speak() and speaking=true - if the
                 poller restores in that gap, the boost dies at birth and
                 the music sits at cruise under the voice (the keeper's
                 "it got quieter on the last turn"). So: no restore until
                 speech has been SEEN to start, with a 5 s grace for an
                 utterance that never starts at all. */
              if (w.speechSynthesis.speaking) started = true;
              const idle = !w.speechSynthesis.speaking && !w.speechSynthesis.pending;
              const done = (started && idle) || (!started && ticks > 25) || ticks > 300;
              if (done) {
                clearInterval(back);
                try { if (DW.volume === 1) DW.volume = cruise; } catch (e) {}
              }
            }, 200);
          }
        }
      } catch (e) {}
      prev(u);
    };
    w.__dwVolWrapped = 'v2';
  } catch (e) {}
}
bridgeVoiceVolume(); iv(bridgeVoiceVolume, 2000);

/* ── the eleven dial - requested by name. The scale is 0..11 because the
   keeper asked where the 11 button was; position 11 maps to the
   amplifier's true maximum (1.0). Injected by the APP so it arrives by
   hot-swap; removed cleanly on teardown. ── */
const volWrap = document.createElement('span');
volWrap.id = 'vol11';
volWrap.title = 'the amplifier. this one goes to eleven.';
volWrap.style.cssText = 'display:flex;align-items:center;gap:5px;color:var(--dim)';
volWrap.innerHTML = '<input id="volr" type="range" min="0" max="11" step="1" value="9" '
  + 'style="width:78px;accent-color:var(--accent)"><span style="letter-spacing:.12em;color:var(--accent)">11</span>';
document.querySelector('header').insertBefore(volWrap, $('deckstrip'));
subs.push(() => volWrap.remove());
const volr = volWrap.querySelector('#volr');
let volDragging = false;
volr.addEventListener('pointerdown', () => { volDragging = true; });
volr.addEventListener('pointerup', () => { volDragging = false; });
volr.addEventListener('input', () => {
  try { $('dw').contentWindow.DW.volume = volr.value / 11; } catch (e) {}
});
iv(() => {                                        /* follow the deck when idle */
  if (volDragging) return;
  try { const v = $('dw').contentWindow.DW.volume;
        if (typeof v === 'number') volr.value = Math.round(v * 11); } catch (e) {}
}, 500);

/* ── THE VOICE CARD + THE MIXER ────────────────────────────────────────
   Keeper, 2026-08-28: "a card for the persona speaking that shows a
   voicewave", and separate tuning for the music and the voice, "rather
   than rely on the ducking". Injected by the APP, like the eleven dial,
   so both arrive by hot-swap and leave cleanly on teardown.

   THE WAVE IS REAL OR ABSENT. A rendered take plays through the deck's
   own graph, so an AnalyserNode inside its chain draws its actual
   samples. The OS voice (DWEVENTS.speak) NEVER enters the graph - there
   is no tap, so the card draws NO wave for it and says why on the card.
   A synthesized wave here would be the hosted artifact's fake scope,
   rebuilt on the screen whose whole point is real organs.

   THE FADERS MOVE NO CANON. The locked voice-pipeline numbers (gain
   1.62 · room 0.3, by ear, 2026-08-22) stay wherever the keeper's store
   has them - the faders INITIALIZE from the stores and change nothing
   until moved. voice writes dw-voice-gain (the takes' real gain, live
   on a playing take) and mirrors min(1, v) into configureSpeech
   ({volume}) - the deck's PUBLIC verb, never a direct dw-speech write,
   so no second config path exists. duck is configureSpeech({duck}): the
   fraction of music left under the OS voice. iOS ignores utterance
   volume entirely (ledger 75 - the deck's own guard skips it); the
   fader tooltip says so instead of pretending. */
const vstyle = document.createElement('style');
vstyle.textContent =
  '#voicecard{border-bottom:1px solid var(--line);background:var(--bg2);padding:5px 14px 7px}'
  + '#voicecard[hidden]{display:none}'
  + '#vcWave{display:block;width:100%;height:44px}#vcWave[hidden]{display:none}'
  + '#vcTop{font-size:10px;letter-spacing:.16em;text-transform:uppercase;color:var(--accent)}'
  + '#vcTop #vcWho{color:var(--fg);text-transform:none;letter-spacing:.04em}'
  + '#vcTop #vcHow{color:var(--dim);text-transform:none;letter-spacing:.04em}'
  + '#vcNote{font-size:9.5px;color:var(--warn);letter-spacing:.1em}'
  + '#vcText{font-size:10.5px;color:#cfe6f2;white-space:pre-wrap;max-height:48px;overflow:hidden}'
  + '#vmix{display:flex;align-items:center;gap:5px;color:var(--dim)}'
  + '#vmix input{width:64px;accent-color:var(--accent)}'
  + '#vmix .lbl{letter-spacing:.12em}'
  + '#vmix b{font-weight:400;color:var(--fg);font-variant-numeric:tabular-nums;min-width:34px;text-align:right}';
document.head.appendChild(vstyle);
subs.push(() => vstyle.remove());

const vcard = document.createElement('div');
vcard.id = 'voicecard'; vcard.hidden = true;   /* hidden = the persona is not speaking */
vcard.innerHTML = '<canvas id="vcWave" height="44"></canvas>'
  + '<div id="vcTop"><span>THE VOICE</span> · <span id="vcWho"></span><span id="vcHow"></span></div>'
  + '<div id="vcNote"></div><div id="vcText"></div>';
$('feed').parentNode.insertBefore(vcard, $('feed'));
subs.push(() => vcard.remove());

let voice = null;                    /* {kind, ana, since, seen, ended, buf} */
function voiceShow(v) {
  voice = { kind: v.kind, ana: v.ana || null, since: Date.now(), seen: false, ended: 0, buf: null };
  const card = $('voicecard'); if (!card) return;
  let fx = 'off', warp = 1, gvx = 1, duck = 0.55;
  try { fx = localStorage.getItem('dw-voice-fx') || 'off'; } catch (e) {}
  try { const x = parseFloat(localStorage.getItem('dw-voice-warp')); if (isFinite(x)) warp = x; } catch (e) {}
  try { const x = parseFloat(localStorage.getItem('dw-voice-gain')); if (isFinite(x)) gvx = x; } catch (e) {}
  try { const c0 = JSON.parse(localStorage.getItem('dw-speech') || 'null'); if (c0 && c0.duck != null) duck = +c0.duck; } catch (e) {}
  if (v.kind === 'take') {
    $('vcWho').textContent = v.who || '';
    $('vcHow').textContent = ' · ' + (fx === 'facility' || fx === 'glados' ? 'facility chain' : 'dry')
      + ' · warp ' + warp + ' · gain ' + gvx;
    $('vcNote').textContent = '';
    $('vcWave').hidden = false;
  } else {
    $('vcWho').textContent = 'OS speech synthesis';
    $('vcHow').textContent = ' · duck ' + duck + '×';
    $('vcNote').textContent = 'no wave: the OS voice never enters the deck graph — nothing to tap, and a drawn one would be fake';
    $('vcWave').hidden = true;
  }
  $('vcText').textContent = v.text ? String(v.text).slice(0, 220) : '';
  card.hidden = false;
}
function voiceEnd(kind) { if (voice && voice.kind === kind && !voice.ended) voice.ended = Date.now(); }
function vcDraw() {
  const c = $('vcWave'); if (!c || c.hidden || !voice || !voice.ana) return;
  const dpr = window.devicePixelRatio || 1;
  const cw = Math.max(2, c.clientWidth);
  if (c.width !== Math.round(cw * dpr) || c.height !== Math.round(44 * dpr)) {
    c.width = Math.round(cw * dpr); c.height = Math.round(44 * dpr);
  }
  const g = c.getContext('2d'); if (!g) return;
  const w = c.width, h = c.height;
  g.clearRect(0, 0, w, h);
  g.strokeStyle = cssv('--line') || '#12202e'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(0, h / 2); g.lineTo(w, h / 2); g.stroke();
  const n = voice.ana.fftSize;
  if (!voice.buf) voice.buf = new Uint8Array(n);
  try { voice.ana.getByteTimeDomainData(voice.buf); } catch (e) { return; }
  g.beginPath();
  for (let i = 0; i < n; i++) {
    const x = w * i / (n - 1), y = h / 2 + ((voice.buf[i] - 128) / 128) * (h / 2 - 2);
    i ? g.lineTo(x, y) : g.moveTo(x, y);
  }
  g.strokeStyle = cssv('--accent') || '#39ffa0'; g.lineWidth = Math.max(1, 1.2 * dpr); g.stroke();
}
iv(() => {
  if (!voice) return;
  if (voice.kind === 'tts' && !voice.ended) {
    /* the OS voice reports through speechSynthesis only; same seen-grace as
       the boost poller - iOS takes a beat between speak() and speaking */
    let sp = false;
    try { const w = dwin(); sp = !!(w && (w.speechSynthesis.speaking || w.speechSynthesis.pending)); } catch (e) {}
    if (sp) voice.seen = true;
    if ((voice.seen && !sp) || (!voice.seen && Date.now() - voice.since > 5000)) voice.ended = Date.now();
  }
  if (voice.ended && Date.now() - voice.ended > 1200) {
    const card = $('voicecard'); if (card) card.hidden = true;
    voice = null; return;
  }
  vcDraw();
}, 60);

/* the mixer strip: voice + duck, beside the eleven dial (which stays the
   music's fader). Failure to reach the deck is SAID - a fader that moves
   and does nothing is ledgers 84/85/89's exact class. */
const mixWrap = document.createElement('span');
mixWrap.id = 'vmix';
mixWrap.innerHTML =
  '<span class="lbl" title="the persona\'s level — rendered takes: the real 0–200% gain, moved LIVE on a playing take; the OS voice follows up to 100% through the deck\'s own configureSpeech (iOS ignores utterance volume — ledger 75). Your saved level stays until you move this.">voice</span>'
  + '<input id="vgr" type="range" min="0" max="2" step="0.01"><b id="vgb">—</b>'
  + '<span class="lbl" title="music left under the OS voice — configureSpeech duck, 5–100%. Rendered takes never duck; they mix at the voice level instead.">duck</span>'
  + '<input id="vdr" type="range" min="0.05" max="1" step="0.01"><b id="vdb">—</b>';
document.querySelector('header').insertBefore(mixWrap, volWrap);
subs.push(() => mixWrap.remove());
const vgr = mixWrap.querySelector('#vgr'), vgb = mixWrap.querySelector('#vgb');
const vdr = mixWrap.querySelector('#vdr'), vdb = mixWrap.querySelector('#vdb');
let g0 = 1; try { const x = parseFloat(localStorage.getItem('dw-voice-gain')); if (isFinite(x)) g0 = Math.max(0, Math.min(2, x)); } catch (e) {}
let d0 = 0.55; try { const c0 = JSON.parse(localStorage.getItem('dw-speech') || 'null'); if (c0 && c0.duck != null) d0 = Math.max(0.05, Math.min(1, +c0.duck)); } catch (e) {}
vgr.value = g0; vdr.value = d0;
const vgTxt = () => { vgb.textContent = Math.round(vgr.value * 100) + '%'; };
const vdTxt = () => { vdb.textContent = Math.round(vdr.value * 100) + '%'; };
vgTxt(); vdTxt();
vgr.addEventListener('input', () => { vgTxt();
  try { localStorage.setItem('dw-voice-gain', String(+vgr.value)); } catch (e) {}
  try { if (window.__sayfileGain) window.__sayfileGain.gain.value = +vgr.value; } catch (e) {} });
vgr.addEventListener('change', () => { const D = deck();
  if (D && D.configureSpeech) console.log('[recon]', D.configureSpeech({ volume: Math.min(1, +vgr.value) }));
  else sayMark('\u{1F507} deck not ready — the OS-voice half of this fader will apply once it is'); });
vdr.addEventListener('input', vdTxt);
vdr.addEventListener('change', () => { const D = deck();
  if (D && D.configureSpeech) console.log('[recon]', D.configureSpeech({ duck: +vdr.value }));
  else sayMark('\u{1F507} deck not ready — duck not applied'); });

/* ── the stage: the frame the agent was looking at ─────────────────────
   THE ORIGINAL IDEA, arriving last. This screen began as a viewport -
   docs/research/adjacent/surfacing-hud-for-agent-activity.md designed a HUD
   injected into the page being browsed (element brackets, spotlight, the URL
   decoding as it is read), and the keeper's own prompt in Act 35 asked for
   "a read-only what-the-agent-is-looking-at overlay, so the deck can play
   music to browse Reddit by". Then the keeper turned it inside out - "this
   just becomes a new screen entirely" - and what shipped was the LOG half.
   The stage is the viewport half, built 2026-08-28 on the keeper's word.

   IT SEES NOTHING BY ITSELF, and that is the whole safety story. RECON does
   not screenshot, scrape, or navigate; it renders a still that whatever is
   driving the browser chose to hand it, by writing one more field on a feed
   record. The frame is an <img> at a path matched against SHOTPATH - the
   same discipline as sayfile, and the reason there is still no new fetch on
   this page.

   THE DANGER IS OVER-TRUST, named in that research doc: a display so
   convincing the operator stops checking. A still frame with a scan line
   looks exactly like a live browser and is not one. So:
   - every frame is labelled `still`, always, with its age beside it;
   - past STALE_MS the age line and the ● RECON lamp both change and the
     screen says the agent may be somewhere else;
   - an unparseable timestamp reports `age unknown` and is treated as stale,
     because not knowing is not the same as being fresh;
   - the stage stays HIDDEN until a shot actually arrives. An empty viewport
     is the empty-axis lie in another costume.

   AND NO PAGE-BODY CHANNEL. The text on the stage is the record's own
   `note` - one or two lines in the agent's words, the rule the feed already
   keeps. There is deliberately no field for page text: it would turn the
   feed into a scraper log and the screen into a copyright hazard. Outbound
   links are copied, never followed, exactly as feed rows are. */
const stageEl = $('stage');
let staged = null;                                 /* the record on the stage */
let stageMissing = false;                          /* its image failed to load */
const shots = [];                                  /* every framed record, arrival order */
let shotIdx = -1;                                  /* where the stepper is standing */
const STAGEKEY = 'dw-recon-stage';                 /* folded, per browser */
let stageFolded = false;
try { stageFolded = localStorage.getItem(STAGEKEY) === 'folded'; } catch (e) {}

function agoOf(r) {
  const t = Date.parse((r && r.ts) || '');
  if (!isFinite(t)) return { s: null, txt: 'age unknown', stale: true };
  /* the ts is the PRODUCER's clock. A producer ahead of this device (PC
     stamps, phone views over --lan) clamped the age to 0 s and delayed the
     stale flip by the whole skew - over-trust by clock skew, ledger 92. The
     feed staleness line deliberately counts local arrival for this exact
     reason; here whichever is OLDER wins - ts age or local arrival age -
     which can only make a frame read older, never fresher. The 90 s
     threshold itself does not move. */
  const s = Math.max(0, (Date.now() - t) / 1000,
                     r && r.arrivedAt ? (Date.now() - r.arrivedAt) / 1000 : 0);
  const txt = s < 60 ? Math.round(s) + ' s old'
            : s < 3600 ? Math.round(s / 60) + ' m old'
            : Math.round(s / 3600) + ' h old';
  return { s, txt, stale: s * 1000 > STALE_MS };
}
function stgLinkClick(l, el) {
  /* 'copied' used to print unconditionally - a clipboard refusal showed
     success over a failure (ledger 97). The promise is the truth. */
  const was = el.textContent;
  const show = t => { el.textContent = t; setTimeout(() => { el.textContent = was; }, 900); };
  try { navigator.clipboard.writeText(l).then(() => show('copied'), () => show('copy FAILED')); }
  catch (e) { show('copy FAILED'); }
}
function stageShow(r, opts) {
  if (!stageEl || !r || !r.shot) return;
  /* A REAL TAP IS AN INVITATION - ledger 77's rule, and the reason ▣ view
     and the stepper both unfold. Pressing view while the stage was folded
     used to re-stage the frame and then hide it again in the same call, so
     the press did nothing visible - which is how it was reported. Asking to
     see a frame means SHOW ME THIS ONE, NOW. */
  if (opts && opts.open && stageFolded) {
    stageFolded = false;
    try { localStorage.setItem(STAGEKEY, 'open'); } catch (e) {}
  }
  staged = r;
  /* a re-staged PIN is a DIFFERENT object than the walk's copy of the same
     record (pins round-trip through localStorage), so indexOf missed it and
     the stepper kept standing on the previous frame while the stage showed
     this one - ‹ stepped from the wrong place (ledger 96). Identity first,
     content second; a staged frame the walk has never seen joins it - the
     stepper's contract is every frame that has been staged. */
  let at = shots.indexOf(r);
  if (at < 0) at = shots.findIndex(q => q.ts === r.ts && hash(q) === hash(r));
  if (at < 0) { shots.push(r); at = shots.length - 1; }
  shotIdx = at;
  stageNav();
  /* a frame whose FILE is gone (recon-shots/ is per-session; recon.jsonl is
     not) used to stage a black rectangle under a full, convincing HUD - a
     still that was actually nothing, unannounced (ledger 93). The error is
     caught and said on the age line, which stageTick keeps saying. */
  const im = $('stgShot');
  stageMissing = false;
  im.onerror = () => { stageMissing = true; stageTick(); };
  im.onload = () => { stageMissing = false; stageTick(); };
  im.src = '../../' + r.shot;
  $('stgUrl').textContent = r.url || '(no url given)';
  $('stgTitle').textContent = r.title || '';
  $('stgStat').textContent = r.status || 'no status fed';
  $('stgNote').textContent = r.note || '';
  const ll = $('stgLL'); ll.innerHTML = '';
  (r.links || []).forEach(l => {
    const e2 = document.createElement('div');
    e2.textContent = String(l); e2.title = 'click to copy — this screen never follows a link';
    e2.onclick = () => stgLinkClick(String(l), e2);
    ll.appendChild(e2);
  });
  stageEl.hidden = false;              /* `hidden` means NO FRAME EVER, nothing else */
  applyFold();
  stageTick();
}
/* Stepping back through the frames. The keeper's ask, verbatim: "I expected
   it to view the screenshots that had been shown before." Per-row ▣ view is
   a scroll-hunt for the rows that happen to carry one; this walks them.
   A stepped-to frame goes through stageShow like any other, so the age line
   re-dates itself and an old picture cannot appear under a fresh age. */
function stageNav() {
  const pos = $('stgPos'), p = $('stgPrev'), n = $('stgNext');
  if (!pos) return;
  pos.textContent = shots.length ? (shotIdx + 1) + '/' + shots.length : '—';
  if (p) p.classList.toggle('off', shotIdx <= 0);
  if (n) n.classList.toggle('off', shotIdx < 0 || shotIdx >= shots.length - 1);
}
function stageAt(i) {
  if (i < 0 || i >= shots.length) return;
  stageShow(shots[i], { open: true });
}
if ($('stgPrev')) $('stgPrev').onclick = e => { e.stopPropagation(); stageAt(shotIdx - 1); };
if ($('stgNext')) $('stgNext').onclick = e => { e.stopPropagation(); stageAt(shotIdx + 1); };

/* FOLDING IS NOT HIDING. `hidden` says no frame has arrived; `.folded` says
   the operator wants the height back. They were the same flag once, which
   put the fold control inside the thing it folded and persisted the choice -
   ledger 83, a door that only opened one way. */
function applyFold() {
  if (!stageEl) return;
  stageEl.classList.toggle('folded', stageFolded);
  stageTick();
}
function stageTick() {
  if (!stageEl || !staged) return;
  const a = agoOf(staged), age = $('stgAge'), lamp = document.querySelector('.stgrec');
  const line = 'still · ' + a.txt
    + (stageMissing ? ' — NO IMAGE: the frame file is gone (recon-shots/ lives per session)' : '')
    + (a.stale ? ' — the agent may be somewhere else' : '');
  age.textContent = line;
  age.className = (a.stale || stageMissing) ? 'stale' : '';
  if (lamp) lamp.className = 'stgrec' + ((a.stale || stageMissing) ? ' stale' : '');
  /* the folded bar keeps the title AND the age: a folded stage must not go
     quiet about how old its frame is, for the same reason an open one cannot */
  const f = $('stgFold');
  if (f) f.textContent = stageFolded
    ? '▾ stage · ' + (staged.title || staged.url || 'a frame') + ' · ' + line
    : '▴ fold';
}
if ($('stgFold')) $('stgFold').onclick = () => {
  stageFolded = !stageFolded;
  try { localStorage.setItem(STAGEKEY, stageFolded ? 'folded' : 'open'); } catch (e) {}
  applyFold();
};
iv(stageTick, 1000);
armAgain();                       /* the button tells the truth from the first frame */

/* ── the instrument column: the deck, not a clock ──────────────────────
   The hosted console artifact (claude.ai 39b76df9) drew this same furniture
   over a PUBLISHED SCORE FILE with a clock, and its own boot feed is the
   warning: "no audio is loaded or analysed here", "SNAPSHOT, not live:
   position is derived from bpm x rate, not observed", "if the real deck is
   playing a different set, this display is wrong and cannot tell". This
   column reads the DECK instead - DWEVENTS.pulse() for the beat clock,
   DW.nextDeck for the scheduled incoming, DW.prevDeck for the crossfade
   that is actually running, and the engine's own DW.camScore for the
   harmonic move, so there is never a second scoring path beside the
   sequencer that picks the tracks.

   READ-ONLY, deliberately. The artifact's ribbon seeks its clock. A real
   set cannot be scrubbed, and a click into the play order would be a second
   way in beside DWEVENTS - which is exactly the shape of ledger 40.
   It reports; it does not steer.

   WHAT IT MUST NOT SAY, all three straight out of CLAUDE.md:
   - no stretch percentage against a track played STRAIGHT. An unstretched
     track is not being beatmatched, and 0.0% reads as the best transition
     on screen.
   - NO NUMBER ON THE ENERGY AXIS. Energy is a constructed index, and an
     axis labelled with numbers this project chose would borrow the
     authority of measured ones.
   - the bar counter says ASSUMED, because the engine assumes every fourth
     beat from the first and detects no downbeat at all.

   And one thing it must say out loud: `_stretch` and `_unlocked` are
   stamped on the SHARED corpus objects by sequence(), so building again
   restamps them underneath this display. The ribbon is the CURRENT plan. */
const dwin = () => { try { return $('dw').contentWindow || null; } catch (e) { return null; } };
const mmss = s => { s = Math.max(0, Math.round(s)); return (s / 60 | 0) + ':' + String(s % 60).padStart(2, '0'); };
const cssv = n => (getComputedStyle(document.documentElement).getPropertyValue(n) || '').trim();

/* The play order: the dashboard's live-patching seam FIRST - dash.set is a
   GETTER over the array the deck is actually running (applyRoute and build
   reassign it, and reorder() makes it the player's own object) - the render
   bundle second. It was the other way once, and the bundle is a SNAPSHOT:
   the deck iframe folds away to display:none (RECON's default), its rAF
   stops, DWLOOP.last freezes, and since the frozen set was non-empty the
   live fallback was never reached - so after any rebuild or committed route
   the ribbon drew a pre-route plan as if current. Ledger 87. NEVER
   re-derived here - a console-local copy of the play order is ledger 33/40
   all over again. */
function deckSet(W) {
  try { const d = W.DWDASH && W.DWDASH._dev;
        if (d && d.set && d.set.length) return d.set; } catch (e) {}
  try { const L = W.DWLOOP && W.DWLOOP.last;
        if (L && L.D && L.D.set && L.D.set.length) return L.D.set; } catch (e) {}
  return null;
}
/* NAMES for camScore's tiers. This IS a second copy of the engine's
   constants (deckwave.js camScore: 1 / .92 / .85 / .45 / .25 / .08) - the
   first cut of this comment claimed no second table existed, which was
   false the moment it was written (ledger 99). If the engine's tiers move,
   these thresholds must follow; check-recon pins each one against the
   engine source so the drift is caught in the harness, not on screen. */
function moveName(sc) {
  if (sc >= 1) return 'same key';
  if (sc >= 0.92) return 'neighbour ±1';
  if (sc >= 0.85) return 'relative';
  if (sc >= 0.45) return '±2 · a reach';
  if (sc >= 0.25) return 'key unknown';
  return 'clash';
}
const gridRow = (label, value, cls, title) =>
  '<div' + (title ? ' title="' + esc(title) + '"' : '') + '><span>' + esc(label) + '</span><b'
  + (cls ? ' class="' + cls + '"' : '') + '>' + esc(value) + '</b></div>';
/* write a grid WITHOUT destroying it. The honesty tooltips (constructed
   index, assumed 4/4, the straight/first-deck reasons) live on these nodes,
   and the first cut reassigned innerHTML every 60 ms tick - the element
   under the cursor was replaced 16 times a second, the browser's hover
   timer never ran out, and none of that machine-verified text was ever
   READABLE. Ledger 94. Structure rebuilds only when the rows themselves
   change (labels/classes/titles); values update in place, which leaves the
   hovered node - and its title attribute - alone. Rows are [label, value,
   cls, title] tuples. */
function setGrid(el, rows) {
  const sig = rows.map(q => q[0] + '\u0001' + (q[2] || '') + '\u0001' + (q[3] || '')).join('\u0002');
  if (el.__sig !== sig || el.children.length !== rows.length) {
    el.__sig = sig;
    el.innerHTML = rows.map(q => gridRow(q[0], q[1], q[2], q[3])).join('');
  } else {
    const bs = el.querySelectorAll('b');
    rows.forEach((q, i) => { const b = bs[i]; if (b && b.textContent !== String(q[1])) b.textContent = q[1]; });
  }
}

function drawWheel(W, p) {
  const c = $('insWheel'); if (!c) return;
  const g = c.getContext('2d'); if (!g) return;
  const w = c.width, h = c.height, cx = w / 2, cy = h / 2;
  g.clearRect(0, 0, w, h);
  const nd = W && W.DW ? W.DW.nextDeck : null;
  const cur = p && p.playing ? p.camelot : null, nxt = nd ? nd.camelot : null;
  const line = cssv('--line') || '#12202e', dim = cssv('--dim') || '#4a6a80';
  const acc = cssv('--accent') || '#39ffa0', alert = cssv('--alert') || '#ff4d7d';
  const beat = parseFloat(cssv('--beat')) || 0;
  const rOut = Math.min(cx, cy) - 3, rMid = rOut * 0.70, rIn = rOut * 0.41;
  const mid = code => {                       /* sector centre, for the chord */
    const n = parseInt(code, 10), L = String(code).slice(-1);
    const a = ((n - 1) * 30 - 90 + 15) * Math.PI / 180;
    const r = L === 'B' ? (rOut + rMid) / 2 : (rMid + rIn) / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  };
  g.font = '9px ui-monospace,monospace'; g.textAlign = 'center'; g.textBaseline = 'middle';
  for (let i = 0; i < 12; i++) {
    const a0 = (i * 30 - 90) * Math.PI / 180, a1 = ((i + 1) * 30 - 90) * Math.PI / 180;
    ['B', 'A'].forEach(L => {
      const r1 = L === 'B' ? rOut : rMid, r0 = L === 'B' ? rMid : rIn;
      const code = (i + 1) + L, isCur = cur === code, isNxt = nxt === code;
      g.beginPath(); g.arc(cx, cy, r1, a0, a1); g.arc(cx, cy, r0, a1, a0, true); g.closePath();
      g.fillStyle = isCur ? acc : 'rgba(10,20,32,.9)';
      g.globalAlpha = isCur ? (0.70 + 0.30 * beat) : 1; g.fill(); g.globalAlpha = 1;
      g.strokeStyle = isNxt ? acc : line; g.lineWidth = isNxt ? 1.6 : 1; g.stroke();
      g.fillStyle = isCur ? '#02060a' : isNxt ? acc : dim;
      const am = (a0 + a1) / 2, rm = (r0 + r1) / 2;
      g.fillText(code, cx + Math.cos(am) * rm, cy + Math.sin(am) * rm);
    });
  }
  if (cur && nxt && W.DW && W.DW.camScore) {
    const sc = W.DW.camScore(cur, nxt);
    if (cur !== nxt) {
      const a = mid(cur), b = mid(nxt);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]);
      g.strokeStyle = sc <= 0.08 ? alert : acc; g.lineWidth = 2; g.stroke();
    }
  }
  /* the beat, from the same pulse the records land on */
  g.beginPath(); g.arc(cx, cy, rIn * (0.30 + 0.16 * beat), 0, Math.PI * 2);
  g.fillStyle = p && p.playing ? acc : line; g.globalAlpha = 0.25 + 0.55 * beat;
  g.fill(); g.globalAlpha = 1;
}

function drawRibbon(W, p) {
  const c = $('insRibbon'), hint = $('insRibHint'); if (!c) return;
  const g = c.getContext('2d'); if (!g) return;
  const dpr = window.devicePixelRatio || 1;
  const cw = Math.max(2, c.clientWidth), chh = Math.max(2, c.clientHeight);
  if (c.width !== Math.round(cw * dpr) || c.height !== Math.round(chh * dpr)) {
    c.width = Math.round(cw * dpr); c.height = Math.round(chh * dpr);
  }
  const w = c.width, h = c.height, s = dpr;
  g.clearRect(0, 0, w, h);
  const set = W ? deckSet(W) : null;
  /* A display that cannot tell working from stopped must SAY so. An empty
     axis and a flat line look identical to a working one - that is one of
     the three diagnostics CLAUDE.md names as having lied here already. */
  if (!set) {
    g.fillStyle = '#2b4a5e'; g.font = (10 * s) + 'px ui-monospace,monospace';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('no set visible — build one in the deck', w / 2, h / 2);
    if (hint && hint.__h !== 'no-set') { hint.__h = 'no-set'; hint.textContent = 'no set visible'; }
    return;
  }
  const N = set.length;
  const straightOf = m => !!m._unlocked;
  const effOf = m => straightOf(m) ? (m.bpm || 0) : (m.bpm || 0) * (m._stretch || 1);
  const eff = set.map(effOf), en = set.map(m => (typeof m.energy === 'number' ? m.energy : 0));
  const tmin = Math.min.apply(null, eff), tmax = Math.max.apply(null, eff);
  const span = Math.max(1, tmax - tmin);
  const acc = cssv('--accent') || '#39ffa0', cyan = cssv('--cyan') || '#4dd8ff';
  const line = cssv('--line') || '#12202e', warn = cssv('--warn') || '#ffb347';
  const alert = cssv('--alert') || '#ff4d7d';
  const pad = 4 * s, top = 12 * s, bot = h - 6 * s;
  const X = i => pad + (w - pad * 2) * (N < 2 ? 0.5 : i / (N - 1));

  /* ENERGY, as an area. NO NUMBER ON THE ENERGY AXIS: energy is a
     constructed index (45% loudness, 25% brightness, 30% tempo, normalised
     across this corpus), not a measurement, and putting a scale on it would
     lend numbers this project chose the authority of measured ones - the
     same rule that keeps dB off the VU. Shape only. */
  g.beginPath(); g.moveTo(X(0), bot);
  for (let i = 0; i < N; i++) g.lineTo(X(i), bot - (bot - top) * Math.max(0, Math.min(1, en[i])));
  g.lineTo(X(N - 1), bot); g.closePath();
  g.fillStyle = acc; g.globalAlpha = 0.16; g.fill(); g.globalAlpha = 1;

  /* PLAYING tempo — label x stretch for a locked track, its own bpm for a
     straight one. Both are real; the straight ones are marked, not hidden. */
  g.beginPath();
  for (let i = 0; i < N; i++) {
    const y = bot - (bot - top) * ((eff[i] - tmin) / span);
    i ? g.lineTo(X(i), y) : g.moveTo(X(i), y);
  }
  g.strokeStyle = cyan; g.lineWidth = 1.2 * s; g.stroke();
  let nStraight = 0;
  for (let i = 0; i < N; i++) {
    if (!straightOf(set[i])) continue;
    nStraight++;
    const y = bot - (bot - top) * ((eff[i] - tmin) / span);
    g.beginPath(); g.arc(X(i), y, 2.4 * s, 0, Math.PI * 2);
    g.strokeStyle = warn; g.lineWidth = 1.2 * s; g.stroke();
  }

  /* THE PLAYHEAD, on the DECK's track — set.indexOf(DW.nowMeta), identity,
     not the list index. When the two disagree the ribbon says LIST != DECK,
     which is the standing check the route panel already draws in red and
     the one line that would have caught ledgers 33, 38 and 40. */
  const nowMeta = W.DW ? W.DW.nowMeta : null;
  const st = W.DW && W.DW.state ? W.DW.state : null;
  const di = nowMeta ? set.indexOf(nowMeta) : -1;
  const li = st && typeof st.idx === 'number' ? st.idx : -1;
  /* the deck's track MISSING from the displayed set is the display's
     most-wrong case, and the old fallback made it the calmest: `at` silently
     became the PLAYER's index applied to the DISPLAYED array - a confident
     playhead over an unrelated track - while the LIST != DECK flag required
     di >= 0 and so provably could not fire. Ledger 88. No playhead, and the
     hint SAYS it. */
  const missing = !!nowMeta && di < 0;
  const at = di >= 0 ? di : (missing ? -1 : li);
  if (at >= 0) {
    const frac = p && p.playing && p.dur ? Math.max(0, Math.min(1, p.pos / p.dur)) : 0;
    const x = X(Math.min(N - 1, at)) + (at < N - 1 ? (X(at + 1) - X(at)) * frac : 0);
    g.beginPath(); g.moveTo(x, top - 6 * s); g.lineTo(x, bot);
    g.strokeStyle = acc; g.lineWidth = 1.4 * s; g.stroke();
  }
  g.strokeStyle = line; g.lineWidth = 1; g.beginPath();
  g.moveTo(pad, bot); g.lineTo(w - pad, bot); g.stroke();
  /* the only text on the canvas: two real tempo figures at the ends */
  g.fillStyle = '#2b4a5e'; g.font = (9 * s) + 'px ui-monospace,monospace';
  g.textBaseline = 'top'; g.textAlign = 'left';
  g.fillText(Math.round(tmin) + ' bpm', pad, 1 * s);
  g.textAlign = 'right'; g.fillText(Math.round(tmax) + ' bpm', w - pad, 1 * s);

  if (hint) {
    const hh = esc(N + ' tracks · ' + nStraight + ' straight · '
      + Math.round(tmin) + '→' + Math.round(tmax) + ' bpm playing · current plan (a rebuild restamps it) · read-only')
      + (di >= 0 && li >= 0 && di !== li ? ' <span class="alert">LIST ≠ DECK</span>' : '')
      + (missing ? ' <span class="alert">deck track not in this set — no playhead</span>' : '');
    if (hint.__h !== hh) { hint.__h = hh; hint.innerHTML = hh; }
  }
}

function instrumentTick() {
  const W = dwin(), D = deck();
  const p = D && D.pulse ? D.pulse() : null;
  drawWheel(W, p); drawRibbon(W, p);
  const nowEl = $('insNow'), gridEl = $('insGrid');
  if (!nowEl || !gridEl) return;
  const st = W && W.DW && W.DW.state ? W.DW.state : null;
  if (!p || !p.playing) {
    nowEl.className = 'silent';
    const t0 = W ? 'deck silent — nothing to read' : 'deck loading…';
    if (nowEl.textContent !== t0) nowEl.textContent = t0;
    setGrid(gridEl, []);
  } else {
    nowEl.className = '';
    if (nowEl.textContent !== p.name) nowEl.textContent = p.name;
    const rows = [
      ['playing', p.tempo + ' bpm', '', 'the tempo in the room: the track label times the stretch the deck is running'],
      ['label', p.bpm + ' bpm', '', "Essentia's figure for the track itself"],
      ['key', p.camelot || '?'],
      /* A track played STRAIGHT is not being beatmatched - never a percentage.
         Nor is the FIRST deck of a set: it has no predecessor, so it runs at
         rate 1.0 and "+0.00%" would read as the tightest beatmatch on screen
         when no match is being attempted at all. Same reading hazard as the
         straight rule, one step earlier; found by running this column against
         a real set rather than by reasoning about it. AND idx alone was not
         the claim: placeNext decrements idx when a row before the playing
         track is queued away, so a stretched chained deck can sit at idx 0
         mid-set - the rate is the other half (ledger 91). A chained deck at
         exactly 1.0 with idx 0 would still be mislabelled; both fields
         agreeing is the strongest claim available from outside. */
      p.straight ? ['speed', 'straight · own speed', 'warn',
                    'unstretched because it is not being beatmatched — not a worse track']
      : (st && st.idx === 0 && p.rate === 1)
                 ? ['speed', 'first deck · nothing to match', 'warn',
                    'the set has no predecessor here, so the deck runs at its own speed — not a beatmatch']
                 : ['stretch', (p.rate >= 1 ? '+' : '') + ((p.rate - 1) * 100).toFixed(2) + '%'],
      ['energy idx', p.energy == null ? '—' : p.energy.toFixed(2), '',
       'energy is a constructed index — 45% loudness, 25% brightness, 30% tempo, normalised across this corpus. Not a measurement.'],
      ['at', mmss(p.pos) + (p.dur ? ' / ' + mmss(p.dur) : '')]
    ];
    if (p.bar) rows.push(['bar', (p.bar.i + 1) + ' · beat ' + (p.bar.beatInBar + 1) + '/4', '',
      'assumed 4/4 — the engine takes every fourth beat from the first and detects no downbeat']);
    if (st && st.worklet === 'plain') rows.push(['worklet', 'plain worklet', 'alert',
      'the held worklet did not load — the 2.9 ms gapping pipe of ledgers 65/69 is what is playing']);
    if (st && st.gapsTotal) rows.push(['gaps', st.gapsTotal + ' this session', 'alert',
      'zero-filled blocks the stretch worklet reported — the popping suspect, counted']);
    setGrid(gridEl, rows);
  }
  const nd = W && W.DW ? W.DW.nextDeck : null;
  const nextEl = $('insNext'), moveEl = $('insMove');
  if (nextEl) {
    const nh = !nd ? '<span class="dim">nothing scheduled yet</span>'
      : esc(nd.name) + ' <span class="dim">' + esc(String(nd.bpm) + ' bpm · ' + (nd.camelot || '?')) + '</span>'
        + (nd.straight ? ' <span class="warn">straight' + (nd.reason ? ' · ' + esc(String(nd.reason)) : '') + '</span>' : '');
    if (nextEl.__h !== nh) { nextEl.__h = nh; nextEl.innerHTML = nh; }
  }
  if (moveEl) {
    const a = p && p.playing ? p.camelot : null, b = nd ? nd.camelot : null;
    if (!a || !b || !W.DW || !W.DW.camScore) { moveEl.textContent = a || b ? 'move — one side unknown' : '—'; moveEl.className = ''; }
    else { const sc = W.DW.camScore(a, b);
           moveEl.textContent = a + ' → ' + b + ' · ' + moveName(sc);
           moveEl.className = sc <= 0.08 ? 'alert' : ''; }
  }
  const pd = W && W.DW ? W.DW.prevDeck : null;      /* the fade actually running */
  const fade = $('insFade'), bar = fade && fade.firstElementChild;
  if (bar) bar.style.width = (pd ? Math.round(pd.prog * 100) : 0) + '%';
}
iv(instrumentTick, 60);

$('deckstrip').onclick = () => $('deckwrap').classList.toggle('open');
$('deckhd').onclick = () => $('deckwrap').classList.remove('open');
iv(() => {
  const D = deck(); const p = D && D.pulse ? D.pulse() : null;
  /* the console's living colour: accent hue from the playing key (the
     artifact's own mapping), --beat a 0..1 envelope off the beat phase */
  const R = document.documentElement.style;
  if (p && p.playing && p.camelot) {
    const num = parseInt(p.camelot, 10) || 8, let_ = String(p.camelot).slice(-1);
    R.setProperty('--keyhue', String((num * 30 + 186) % 360));
    R.setProperty('--keysat', (let_ === 'B' ? 92 : 74) + '%');
    R.setProperty('--beat', p.beat ? Math.pow(1 - p.beat.phase, 2).toFixed(3) : '0');
  } else { R.setProperty('--beat', '0'); }
  const el = $('deckstrip');
  if (!D) { el.innerHTML = '<span class="dim">deck loading…</span>'; return; }
  if (!p || !p.playing) { el.innerHTML = '<span class="dim">♪ deck silent — tap, then ▶ (or ▶ demo)</span>'; return; }
  const duck = D.status && D.status.ducked ? ' 🔇' : '';
  el.innerHTML = '♪ ' + esc(String(p.name).slice(0, 34)) + ' <span class="dim">' + p.tempo + ' bpm</span> '
    + '<span class="blink">' + (p.bar && p.bar.beatInBar === 0 ? '▮' : '▯') + '</span>' + duck;
}, 250);
}
function teardown() {
  while (timers.length) clearInterval(timers.pop());
  while (subs.length) { try { subs.pop()(); } catch (e) {} }
  try { delete window.RECON; } catch (e) {}
  const f = document.getElementById('feed');
  if (f) f.innerHTML = '<div id="empty">rebooting…</div>';
  const pn = document.getElementById('pins'); if (pn) pn.innerHTML = '';
  /* the instrument column, cleared for the same reason the feed is: a stale
     column would sit through a swap showing the previous set as if live */
  const n = document.getElementById('insNow');
  if (n) { n.className = 'silent'; n.textContent = 'rebooting…'; }
  const gr = document.getElementById('insGrid'); if (gr) gr.innerHTML = '';
  const nx = document.getElementById('insNext'); if (nx) nx.textContent = '—';
  const mv = document.getElementById('insMove'); if (mv) { mv.textContent = '—'; mv.className = ''; }
  /* the canvases too: teardown runs BEFORE the new code evals, so if the
     swap's eval throws, whatever was painted would stand - a live-looking
     wheel and ribbon over a dead app (ledger 95). Cleared like the text. */
  ['insWheel', 'insRibbon'].forEach(id => { const c = document.getElementById(id);
    if (c && c.getContext) { const g = c.getContext('2d'); if (g) g.clearRect(0, 0, c.width, c.height); } });
  const fb = document.getElementById('insFade');
  if (fb && fb.firstElementChild) fb.firstElementChild.style.width = '0%';
  const rh = document.getElementById('insRibHint'); if (rh) rh.textContent = 'rebooting…';
  /* the stage goes dark on a swap for the same reason: a frame left standing
     while the app reboots would read as current when nothing is reading it */
  const st = document.getElementById('stage');
  if (st) { st.hidden = true; const im = document.getElementById('stgShot'); if (im) im.removeAttribute('src'); }
}
return { boot, teardown };
})();
