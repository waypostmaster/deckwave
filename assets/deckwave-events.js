/* ─────────────────────────────────────────────────────────────────────────
   DECKWAVE · EVENTS — the soundtrack takes direction

   Keeper, 2026-08-21: "can you build in an ability to inject events into
   the software? i.e. 'I need something fast' or 'I need to slow it down'.
   This software was originally built to be a soundtrack for an interactive
   walkthrough of websites by Claude to the User."

   So: a narrator (human or Claude, from the console, another window, or
   any automation that can reach the page) says what the moment needs, and
   the deck answers with the machinery it already has. NOTHING new decides
   anything musical here — this module only TRANSLATES:

     intent            translation
     faster / slower   pick the highest/lowest-BPM track still ahead in the
                       set that the stretch gate can reach from the current
                       rolling tempo (DWNAV.stretchFor ≤ DWNAV.GATE — the
                       same gate as everything else), and BLEND NOW through
                       the dashboard's own blend(). If nothing in-gate
                       improves, take the extreme target and commit the
                       navigator's FAST ROUTE to it (optionsFull's `fast`
                       option, hops + dwellSec, through the dashboard's own
                       applyRoute()) — "I need" means soon, so the fast
                       variant, not the scenic one.
     hype / calmer     the same, ranked by the ENERGY index instead of BPM
                       (energy is a constructed index — see CLAUDE.md — so
                       these intents inherit its constructedness honestly).
     change            DW.skip() — the existing blend-into-next.
     duck / unduck     the narrator is speaking: DW.volume drops to
                       DUCK × current and is restored exactly on unduck.
                       DUCK = 0.3 is a CHOSEN number (≈ −10 dB), not a
                       measurement; the keeper's ear owns it.

   Free text is matched against a small synonym table — a lookup, not NLP;
   `inject('faster')` and `inject("I need something fast")` are the same
   call. Unknown text returns the vocabulary instead of guessing.

   WIRING. Selection acts through the dashboard's blend / later /
   applyRoute so the list, the deck and the log stay one truth (the
   ledger-40 lesson: never grow a second path to the play order). The
   dashboard calls DWEVENTS.wire({log, set, blend, later, applyRoute}) at
   boot; unwired (a bare page), every steering intent answers with a
   sentence, and only duck/unduck/change — which touch DW alone — work.

   SURFACES. Console: DWEVENTS.inject('…'). Cross-window: postMessage
   {deckwave: 'inject', event: '…'} from the SAME ORIGIN (other origins
   are ignored — steering the music is harmless, but there is no reason
   to accept instructions from arbitrary pages).

   FALSIFIERS. inject('faster') while a 120-ish set plays should log a
   blend into a visibly higher-BPM track within seconds, or a fast-route
   commit whose ladder climbs; if it blends into a SLOWER track, the
   ranking inverted — status().last carries the decision to report. If a
   duck is not audible, DUCK is wrong for the material — say so, it is
   one number and it is yours.
   ───────────────────────────────────────────────────────────────────────── */

window.DWEVENTS = (function () {
'use strict';

let W = null;                 /* the dashboard's primitives, via wire() */
let ducked = null;            /* the volume to restore, while ducked */
let last = null;              /* the last decision, for status() and bug reports */
const DUCK = 0.3;             /* CHOSEN, ≈ −10 dB — the ear owns it */

/* order matters: duck/unduck first ("quiet for a moment" is a duck, not a
   calmer), change before the axes ("something else" is not "something") */
const INTENTS = [
  { kind: 'unduck', re: /\b(unduck|music back|full volume|done (talking|speaking)|resume music)\b/i },
  { kind: 'duck',   re: /\b(duck|voice|speak|speaking|talk|talking|narrat|quiet for)\b/i },
  { kind: 'change', re: /\b(change|next|skip|something else|different|move on|new track)\b/i },
  { kind: 'faster', re: /\b(fast|faster|speed|quick|quicker|uptempo|up-tempo|accelerate|bpm up|pump it)\b/i },
  { kind: 'slower', re: /\b(slow|slower|slow it down|bring it down|wind down|decelerate|bpm down|ease off)\b/i },
  { kind: 'hype',   re: /\b(hype|energy|energetic|party|harder|intense|big|banger|peak|drop)\b/i },
  { kind: 'calmer', re: /\b(calm|calmer|chill|relax|mellow|quiet|ambient|soft|gentle|background)\b/i }
];
const KINDS = INTENTS.map(i => i.kind);

function parse(input) {
  const s = String(input || '').trim();
  if (KINDS.includes(s.toLowerCase())) return s.toLowerCase();
  for (const i of INTENTS) if (i.re.test(s)) return i.kind;
  return null;
}

const say = s => { if (W && W.log) { try { W.log('inject: ' + s); } catch (e) {} } return s; };

/* pick a destination still ahead of the deck. axis: 'bpm' | 'energy';
   dir: +1 wants more, −1 wants less. Returns {i, t, direct} or null. */
function pick(axis, dir) {
  const DW = window.DW, N = window.DWNAV;
  const set = W.set(), idx = DW.state.idx;
  const T = DW.state.tempo || (DW.nowMeta && DW.nowMeta.bpm) || 120;
  const now = DW.nowMeta || set[idx] || {};
  const ahead = [];
  for (let i = idx + 1; i < set.length; i++) if (set[i]) ahead.push({ i, t: set[i] });
  if (!ahead.length) return { none: 'the set is on its last track — nothing ahead to steer to' };
  const val = t => axis === 'bpm' ? (t.bpm || 0) : (t.energy != null ? t.energy : 0.5);
  const inGate = ahead.filter(c => N.stretchFor(T, c.t.bpm) <= N.GATE);
  /* best in-gate candidate that actually moves the axis the asked way */
  let best = null;
  for (const c of inGate)
    if (dir * (val(c.t) - val(now)) > 0 && (!best || dir * (val(c.t) - val(best.t)) > 0)) best = c;
  if (best) return { i: best.i, t: best.t, direct: true };
  /* nothing reachable improves — the extreme target, by route */
  let far = ahead[0];
  for (const c of ahead) if (dir * (val(c.t) - val(far.t)) > 0) far = c;
  return { i: far.i, t: far.t, direct: false };
}

async function steer(kind) {
  const DW = window.DW, N = window.DWNAV;
  if (!W || !W.set || !W.blend || !W.applyRoute) return say(kind + ': not wired — the dashboard is not up');
  if (!DW || !N) return say(kind + ': engine not loaded');
  /* `state.now`, not `state.of`: `of` is order.length and neither stop() nor
     kill() clears `order`, so it stayed truthy forever after the first ▶.
     This guard therefore passed on a stopped deck and the steer went on to
     report 'blending now into <TRACK>' while blendNow had already returned
     'nothing playing' — one intent, two contradictory log lines, the second
     false. Four other surfaces already asked the deck instead of the list. */
  if (!DW.state.now) return say(kind + ': nothing playing — build a set and press ▶ first');
  const axis = (kind === 'faster' || kind === 'slower') ? 'bpm' : 'energy';
  const dir = (kind === 'faster' || kind === 'hype') ? +1 : -1;
  const p = pick(axis, dir);
  if (p.none) return say(kind + ': ' + p.none);
  const label = String(p.t.name || '').slice(-40) + ' (' + Math.round(p.t.bpm) + ' bpm · energy '
              + (p.t.energy != null ? p.t.energy.toFixed(2) : '?') + ')';
  if (p.direct) {
    last = { kind, axis, dir, target: p.t.name, how: 'blend' };
    await W.blend(p.i);
    return say(kind + ': blending now into ' + label);
  }
  /* out of gate: the navigator's FAST route — "I need" means soon */
  const T = DW.state.tempo || (DW.nowMeta && DW.nowMeta.bpm) || 120;
  const opts = (N.optionsFull || N.options).call(N, T, p.t, DW.corpus);
  const fast = opts.find(o => o.kind === 'fast') || opts.find(o => o.kind === 'route');
  if (!fast) {
    const un = opts.find(o => o.kind === 'unreachable');
    last = { kind, axis, dir, target: p.t.name, how: 'unreachable' };
    return say(kind + ': ' + label + ' is out of reach — ' + ((un && un.reason) || 'no route') +
               ' · nothing in the gate moves the ' + axis + ' ' + (dir > 0 ? 'up' : 'down'));
  }
  last = { kind, axis, dir, target: p.t.name, how: fast.kind, ladder: fast.ladder || null };
  await W.applyRoute({ idx: p.i, mode: 'route', hops: fast.hops, dwellSec: fast.dwellSec },
                     'inject · ' + kind);
  return say(kind + ': ' + (fast.kind === 'fast' ? 'fast route' : 'route') + ' to ' + label
             + (fast.ladder ? ' via ' + fast.ladder.join(' → ') : ''));
}

async function inject(input, opts) {
  const kind = parse(input);
  if (!kind) return say('unknown event "' + String(input).slice(0, 40) + '" — the vocabulary is: ' + KINDS.join(' · '));
  const DW = window.DW;
  if (kind === 'duck') {
    if (!DW) return say('duck: engine not loaded');
    if (ducked != null) return say('duck: already ducked (volume ' + DW.volume.toFixed(2) + ')');
    ducked = DW.volume;
    DW.volume = +(ducked * DUCK).toFixed(3);
    last = { kind, from: ducked, to: DW.volume };
    return say('ducked for the voice — volume ' + ducked.toFixed(2) + ' → ' + DW.volume.toFixed(2) + ' · "unduck" restores');
  }
  if (kind === 'unduck') {
    if (!DW) return say('unduck: engine not loaded');
    if (ducked == null) return say('unduck: the music was not ducked');
    DW.volume = ducked; const v = ducked; ducked = null; speechDucked = false;
    last = { kind, to: v };
    return say('music back — volume ' + v.toFixed(2));
  }
  if (kind === 'change') {
    if (!DW) return say('change: engine not loaded');
    last = { kind };
    return say('change: ' + String(await DW.skip()));
  }
  return steer(kind);
}

/* ── speak: the page reads aloud, OVER the music ─────────────────────────
   Keeper, 2026-08-22: "I really just want to be able to play Claude
   responses without losing the music." Every OS reading path fights the
   audio session from outside it - the Accessibility Reader interrupts
   (ledger 73), Spoken Content ducks by a fixed unadjustable amount,
   VoiceOver reads the whole screen. Speech from INSIDE the page shares
   the page's own session: speechSynthesis speaks, the graph keeps
   playing. THE DUCK CLAIM, CORRECTED (ledger 74): on iOS the system
   applies ITS OWN spoken-audio duck around synthesis even for the
   page's own music, and this module's duck multiplies ON TOP of that
   floor - ours is the whole duck on desktop, an additional depth on
   iOS, and the OS floor has no web lever. Volume drops to the chosen
   depth on start and is restored exactly when the utterance ends. A speech duck and a manual
   duck stay distinct (speechDucked): speak() never steals or restores a
   duck the narrator set by hand.
   iOS: an utterance may only start after a user gesture has primed
   speech - armSpeech() from inside any click does it (RECON's speaker
   toggle calls it). UNHEARD on a device: whether iOS Safari mixes
   synthesis with a running graph - LISTENING has the one-sentence test. */
let speaking = null, speechDucked = false, speechArmed = false;
let lastText = null;                          /* for speakAgain - the repeat button */
/* the voice's character - every number CHOSEN and live-tunable, because
   the keeper's first report was "too much ducking" and the second was
   "Scarlett meets GLaDOS": duck is the fraction of music left under the
   voice, pitch 0.85 + a measured rate is the closest speechSynthesis
   gets to that register (its output cannot be routed through the graph,
   so real vocoding is out of reach - said honestly). Persisted per
   browser; configureSpeech() patches it; a record's voiceCfg does the
   same from the feed. */
let speechCfg = { duck: 0.55, rate: 1.0, pitch: 0.85, voice: null, volume: 1 };
try { const c = JSON.parse(localStorage.getItem('dw-speech') || 'null');
      if (c && typeof c === 'object') Object.assign(speechCfg, c); } catch (e) {}
function configureSpeech(patch) {
  const p = patch || {};
  if (p.duck != null)  speechCfg.duck  = Math.max(0.05, Math.min(1, +p.duck || 0.55));
  if (p.rate != null)  speechCfg.rate  = Math.max(0.5, Math.min(2, +p.rate || 1));
  if (p.pitch != null) speechCfg.pitch = Math.max(0, Math.min(2, +p.pitch || 0.85));
  if (p.voice !== undefined) speechCfg.voice = p.voice ? String(p.voice).slice(0, 40) : null;
  if (p.volume != null) speechCfg.volume = Math.max(0, Math.min(1, +p.volume || 1));
  try { localStorage.setItem('dw-speech', JSON.stringify(speechCfg)); } catch (e) {}
  const v = pickVoice();
  return say('voice set - duck ' + speechCfg.duck + 'x · pitch ' + speechCfg.pitch + ' · rate ' + speechCfg.rate
             + ' · ' + (v ? v.name : (speechCfg.voice ? '"' + speechCfg.voice + '" not found here - system default' : 'system default')));
}
function pickVoice() {
  try {
    const vs = (typeof speechSynthesis !== 'undefined' && speechSynthesis.getVoices && speechSynthesis.getVoices()) || [];
    if (speechCfg.voice) {
      const hit = vs.find(v => v.name.toLowerCase().includes(speechCfg.voice.toLowerCase()));
      if (hit) return hit;
    }
    /* the house preference: calm female English voices, best-first per platform */
    for (const p of ['ava', 'samantha', 'zira', 'google us english', 'karen', 'serena', 'susan']) {
      const hit = vs.find(v => /^en/i.test(v.lang) && v.name.toLowerCase().includes(p));
      if (hit) return hit;
    }
  } catch (e) {}
  return null;
}
function armSpeech() {
  if (speechArmed) return true;
  if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return false;
  try { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); speechArmed = true; }
  catch (e) {}
  return speechArmed;
}
function speak(text, opts) {
  const o = opts || {};
  if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined')
    return say('speak: no speech synthesis in this browser');
  const t = String(text || '').slice(0, 2000);
  if (!t.trim()) return say('speak: nothing to say');
  lastText = t;
  try { speechSynthesis.cancel(); } catch (e) {}
  const depth = o.duck != null ? Math.max(0.05, Math.min(1, +o.duck)) : speechCfg.duck;
  const DW = window.DW;
  if (DW && ducked == null) {                     /* duck for the voice - ours, not the OS's */
    ducked = DW.volume; DW.volume = +(ducked * depth).toFixed(3); speechDucked = true;
  }
  const u = new SpeechSynthesisUtterance(t);
  u.rate = o.rate != null ? o.rate : speechCfg.rate;
  u.pitch = o.pitch != null ? o.pitch : speechCfg.pitch;
  /* utterance.volume is POISON on iOS WebKit - setting it (measured at
     0.6, keeper's device) silences the utterance entirely, ledger 75.
     So: never touch the property on iOS, and elsewhere only when a
     reduction is actually asked for. */
  const uvol = o.volume != null ? Math.max(0, Math.min(1, +o.volume)) : speechCfg.volume;
  const iosWebKit = /iP(hone|ad|od)/.test(navigator.userAgent)
    || (/AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Edg\//.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  if (uvol < 1 && !iosWebKit) u.volume = uvol;
  const v = o.voice ? null : pickVoice();
  if (o.voice) { const tmp = speechCfg.voice; speechCfg.voice = String(o.voice);
                 const hit = pickVoice(); speechCfg.voice = tmp; if (hit) u.voice = hit; }
  else if (v) u.voice = v;
  const done = () => {
    if (speaking !== u) return;                   /* a newer utterance took over - it restores */
    speaking = null;
    if (speechDucked && window.DW && ducked != null) { window.DW.volume = ducked; ducked = null; speechDucked = false; }
  };
  u.onend = done; u.onerror = done;
  speaking = u;
  try { speechSynthesis.speak(u); } catch (e) { done(); return say('speak: ' + String((e && e.message) || e)); }
  last = { kind: 'speak', chars: t.length, duck: depth };
  return say('speaking ' + t.length + ' chars over the set - ducked to ' + depth + 'x, restored when the voice ends');
}

/* ── pulse: the sync surface going the OTHER way ─────────────────────────
   A game (or any embedder) does not just steer the deck — it wants to
   KNOW the beat so its visuals land on it. pulse() is PULL, not push:
   the caller polls it from its own rAF and gets the deck's position on
   the audio clock at the moment of the read — no timers here, no jitter
   we would have to apologise for. Everything in it is derived, nothing
   is new measurement:

     · track position = DW.elapsed × deck.rate (elapsed is
       ctx.currentTime-based; the source's playbackRate scales media
       time), looked up in the track's own beat grid;
     · `bar` assumes every 4th beat from the first — the same documented
       4/4 assumption the whole engine makes (ROADMAP D10: 104 of 189
       grids carry runs at another spacing; a bar figure inside one of
       those runs is off, and that is the grid's known limit, not a bug
       here);
     · `tempo` is the PLAYING tempo (bpm × rate); `bpm` is the label.

   A straight track pulses too (rate 1, its own grid). Nothing playing →
   { playing: false } and nothing else, so a game can gate on one field. */
function pulse() {
  const DW = window.DW;
  if (!DW || !DW.state || !DW.state.now || !DW.nowMeta) return { playing: false };
  const m = DW.nowMeta, dk = DW.deck || {}, rate = dk.rate || 1;
  const pos = (typeof DW.elapsed === 'number' ? DW.elapsed : 0) * rate;
  const out = { playing: true, name: m.name, bpm: m.bpm, tempo: +(m.bpm * rate).toFixed(2),
                rate, straight: !!m._unlocked, energy: m.energy != null ? m.energy : null,
                camelot: m.camelot || null, pos: +pos.toFixed(3), dur: m.dur || null };
  const B = m.beats;
  if (Array.isArray(B) && B.length > 1) {
    /* binary search: first beat index at or after pos */
    let lo = 0, hi = B.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (B[mid] < pos) lo = mid + 1; else hi = mid; }
    const next = lo, prev = Math.max(0, next - 1);
    const span = Math.max(1e-6, (B[next] || B[prev] + .5) - B[prev]);
    const phase = Math.max(0, Math.min(1, (pos - B[prev]) / span));
    out.beat = { i: prev, phase: +phase.toFixed(3),
                 untilSec: +Math.max(0, ((B[next] || pos) - pos) / rate).toFixed(3) };
    out.bar = { i: Math.floor(prev / 4), beatInBar: prev % 4 };   /* the 4/4 assumption, stated above */
  }
  return out;
}

/* cross-window narration and sync: same-origin postMessage only.
   {deckwave:'inject', event:'…'} steers; {deckwave:'pulse'} is answered
   back to the sender with the current pulse (same-origin embedders can
   also just call DWEVENTS.pulse() directly — an iframe on the same
   origin reaches it via contentWindow, which is the better path). */
window.addEventListener('message', e => {
  if (e.origin !== location.origin) return;
  const d = e.data;
  if (!d || !d.deckwave) return;
  if (d.deckwave === 'inject') inject(String(d.event || d.kind || ''), d);
  else if (d.deckwave === 'pulse' && e.source && e.source.postMessage) {
    try { e.source.postMessage(Object.assign({ deckwave: 'pulse', id: d.id || null }, pulse()), e.origin); }
    catch (err) {}
  }
});

return {
  inject, parse, pulse, speak, armSpeech, configureSpeech,
  /* the repeat button: say the last spoken line again, same settings */
  speakAgain() { return lastText ? speak(lastText) : say('nothing has been spoken yet'); },
  get speech() { const v = pickVoice(); return Object.assign({}, speechCfg, { resolvedVoice: v ? v.name : null }); },
  wire(o) { W = o || null; return W ? 'events wired' : 'events unwired'; },
  get vocabulary() { return KINDS.slice(); },
  get status() {
    return { wired: !!W, ducked: ducked != null, speaking: !!speaking, speechArmed,
             volume: window.DW ? window.DW.volume : null, duckFactor: DUCK, last };
  }
};
})();
