/* Does the events module translate intents without inventing musicality?

   DWEVENTS turns "I need something fast" into calls on machinery that
   already exists: the DWNAV gate for reachability, the dashboard's
   blend/later/applyRoute for the play order, DW.volume for ducking,
   DW.skip for change. Nothing here can hear music or open a dashboard:
   DW, DWNAV and the wired primitives are fakes, and what IS checked is
   the translation — the synonym table, in-gate ranking per axis, the
   fast-route fallback, exact duck/unduck restore, the unwired and
   nothing-playing sentences, and the same-origin postMessage guard.
   Every check states its falsifier.

   What it does NOT establish: whether "faster" FEELS faster — the ear
   owns that (LISTENING §16).

       node tools/check-events.js
*/
const fs = require('fs');
let fails = 0, checks = 0;
const ok = (name, cond, falsifier) => {
  checks++;
  if (!cond) { fails++; console.log('  FAIL  ' + name + '\n        falsifier hit: ' + falsifier); }
  else console.log('  pass  ' + name);
};

const src = fs.readFileSync(process.env.DECKWAVE_EVENTS_SRC || 'assets/deckwave-events.js', 'utf8').replace(/\r\n/g, '\n');

/* ── fakes ──────────────────────────────────────────────────────────────── */
const mk = (name, bpm, energy) => ({ name, bpm, energy });
/* deck at idx 1 (120 bpm, energy .50, tempo target 120); the tail offers:
   in-gate faster (126), in-gate slower (112), out-of-gate extremes (150, 80),
   in-gate calmer (.30 @ 118) and hyper (.72 @ 124) */
const SET = [
  mk('PLAYED', 100, .40),
  mk('NOW', 120, .50),
  mk('CALM', 118, .30),
  mk('UP', 126, .55),
  mk('DOWN', 112, .45),
  mk('HYPE', 124, .72),
  mk('EXTREME-UP', 150, .90),
  mk('EXTREME-DOWN', 80, .10)
];
const calls = { blend: [], later: [], route: [], skip: 0, logs: [] };
let vol = .85;
global.DW = {
  /* `now` matters: the engine's real state is `now: A ? A.track.meta.name :
     null`, so it is the field that goes null on stop() — which is why the
     steer guard reads it rather than `of` (order.length, never cleared, and
     therefore truthy forever after the first ▶). This fixture modelled a
     PLAYING deck without it, so a guard that asked the deck instead of the
     list failed here for the right reason. Fixed the fixture, not the guard. */
  state: { of: SET.length, idx: 1, tempo: 120, now: SET[1].name, live: 2, ctx: 'running' },
  nowMeta: SET[1],
  corpus: SET.slice(),
  get volume() { return vol; }, set volume(v) { vol = v; },
  async skip() { calls.skip++; return 'blending into next'; }
};
global.DWNAV = {
  GATE: .08,
  stretchFor: (T, bpm) => Math.abs(T / bpm - 1),
  optionsFull(T, dest, corpus) {
    const direct = this.stretchFor(T, dest.bpm) * 100;
    if (direct <= 8) return [{ kind: 'next', ok: true }];
    if (dest.name === 'EXTREME-DOWN')
      return [{ kind: 'force' }, { kind: 'unreachable', ok: false, reason: 'no stones below 100' }];
    return [{ kind: 'force' },
            { kind: 'route', ok: true, hops: [mk('S1', 130, .6)], ladder: [130] },
            { kind: 'fast', ok: true, hops: [mk('S1', 130, .6), mk('S2', 140, .7)], dwellSec: 20, ladder: [130, 140] }];
  }
};
const messages = [];
global.window = global;
global.location = { origin: 'http://localhost:8777' };
global.addEventListener = (k, fn) => { if (k === 'message') messages.push(fn); };
eval(src);
const E = window.DWEVENTS;
E.wire({ log: s => calls.logs.push(s), set: () => SET,
         blend: async i => calls.blend.push(i), later: async i => calls.later.push(i),
         applyRoute: async (entry, label) => calls.route.push({ entry, label }) });

(async () => {
  console.log('\n── the synonym table ────────────────────────────────────────');
  ok('"I need something fast" parses to faster', E.parse('I need something fast') === 'faster', 'got ' + E.parse('I need something fast'));
  ok('"I need to slow it down" parses to slower', E.parse('I need to slow it down') === 'slower', 'got ' + E.parse('I need to slow it down'));
  ok('"keep it chill in the background" parses to calmer', E.parse('keep it chill in the background') === 'calmer', 'got ' + E.parse('keep it chill in the background'));
  ok('"give me a banger" parses to hype', E.parse('give me a banger') === 'hype', 'got ' + E.parse('give me a banger'));
  ok('"something else please" parses to change, not an axis', E.parse('something else please') === 'change', 'got ' + E.parse('something else please'));
  ok('"quiet for a moment, I am talking" is a DUCK, not calmer', E.parse('quiet for a moment, I am talking') === 'duck', 'got ' + E.parse('quiet for a moment, I am talking'));
  const un = await E.inject('make it purple');
  ok('unknown text answers with the vocabulary, not a guess', /vocabulary/.test(un) && /faster/.test(un), un);

  console.log('\n── steering, in gate ────────────────────────────────────────');
  const r1 = await E.inject('I need something fast');
  ok('faster blends into the highest-BPM track the gate can reach — not the out-of-gate 150',
     calls.blend.length === 1 && SET[calls.blend[0]].name === 'UP' && /blending now into/.test(r1),
     r1 + ' · blend calls ' + JSON.stringify(calls.blend.map(i => SET[i].name)));
  const r2 = await E.inject('slower');
  ok('slower blends into the lowest-BPM in-gate track', SET[calls.blend[1]] && SET[calls.blend[1]].name === 'DOWN', r2);
  const r3 = await E.inject('hype');
  ok('hype ranks by ENERGY, not bpm (picks .72, not the 126-bpm track)', SET[calls.blend[2]] && SET[calls.blend[2]].name === 'HYPE', r3);
  const r4 = await E.inject('calmer');
  ok('calmer picks the lowest-energy in-gate track', SET[calls.blend[3]] && SET[calls.blend[3]].name === 'CALM', r4);
  ok('steering never touches a track already played', calls.blend.every(i => i > 1), JSON.stringify(calls.blend));

  console.log('\n── steering, out of gate ────────────────────────────────────');
  /* raise the floor: make every in-gate candidate NOT an improvement */
  DW.state.tempo = 127; DW.nowMeta = mk('NOW2', 127, .95); SET[1] = DW.nowMeta;
  const r5 = await E.inject('faster');
  ok('with nothing faster in gate, faster commits the navigator\'s FAST route to the extreme',
     calls.route.length === 1 && calls.route[0].entry.dwellSec === 20 && SET[calls.route[0].entry.idx].name === 'EXTREME-UP'
     && /fast route/.test(r5) && /130 → 140/.test(r5),
     r5 + ' · routes ' + JSON.stringify(calls.route));
  DW.state.tempo = 96; DW.nowMeta = mk('NOW3', 96, .05); SET[1] = DW.nowMeta;
  const r6 = await E.inject('slower');
  ok('an unreachable extreme is a sentence naming the reason, not a crash',
     calls.route.length === 1 && /out of reach/.test(r6) && /no stones below 100/.test(r6), r6);
  DW.state.tempo = 120; DW.nowMeta = SET[1] = mk('NOW', 120, .50);

  /* ── negation, and the ceiling that stays (review 2026-09-01) ───────────
     The table is a lookup. "don't speed up" contained `speed` and STEERED
     THE DECK FASTER — the opposite of the ask, acted on at once through the
     real blend. Refusing is the only honest answer without a parser. */
  const blendsBefore = calls.blend.length;
  const neg = await E.inject("don't speed up");
  ok('a negated intent is REFUSED, not inverted', E.parse("don't speed up") === null
     && /refusing/.test(neg) && calls.blend.length === blendsBefore,
     neg + ' · blends ' + (calls.blend.length - blendsBefore) + ' — it read "speed" and blended faster');
  ok('…and the refusal names what it read and what to say instead',
     /faster/.test(neg) && /lookup table/.test(neg) && /calmer/.test(neg), neg);
  ok('the other negations too: "not", "no"',
     E.parse('not so fast') === null && E.parse('no more energy') === null && E.parse('never speed up') === null,
     'not→' + E.parse('not so fast') + ' no→' + E.parse('no more energy'));
  ok('CONTROL: the same sentences WITHOUT the negation still steer',
     E.parse('speed up') === 'faster' && E.parse('so fast') === 'faster' && E.parse('more energy') === 'hype',
     'negation handling swallowed the vocabulary itself: ' + E.parse('speed up') + ' / ' + E.parse('more energy'));
  /* THE CEILING, pinned as it stands and written down where a game
     developer reads it. These three are word-order artefacts of a lookup,
     they are NOT fixed here (the word lists are the keeper's and every word
     in them was chosen), and this check exists so that the day one of them
     changes, the guide has to change with it. */
  const guide = fs.readFileSync('docs/GAME-INTEGRATION.md', 'utf8').replace(/\r\n/g, '\n');
  ok('the known word-order ceiling is exactly this, and the guide says so',
     E.parse('drop it down') === 'hype' && E.parse('speak faster') === 'duck' && E.parse('quiet') === 'calmer'
     && /drop it down/.test(guide) && /speak faster/.test(guide) && /lookup/i.test(guide),
     'parse: ' + [E.parse('drop it down'), E.parse('speak faster'), E.parse('quiet')].join('/')
     + ' — either the table changed or GAME-INTEGRATION no longer names the ceiling it has');
  ok('the guide separates the two ducks (0.3x for an event, 0.55x for the voice)',
     /0\.3/.test(guide) && /0\.55/.test(guide) && /speak/i.test(guide),
     'a game that reads only "0.3x" will be surprised by how far speak() ducks');

  console.log('\n── duck / unduck ────────────────────────────────────────────');
  const d1 = await E.inject('duck');
  ok('duck drops volume to the chosen factor and says both numbers', Math.abs(vol - .85 * .3) < 1e-9 && /0\.85/.test(d1) && E.status.ducked === true, d1 + ' vol ' + vol);
  const d2 = await E.inject('I am going to talk now');
  ok('a second duck refuses instead of compounding', /already ducked/.test(d2) && Math.abs(vol - .85 * .3) < 1e-9, d2 + ' vol ' + vol);
  const d3 = await E.inject('unduck');
  ok('unduck restores the exact prior volume', vol === .85 && E.status.ducked === false, d3 + ' vol ' + vol);
  ok('unduck when not ducked is a sentence', /was not ducked/.test(await E.inject('unduck')), 'double unduck acted');

  console.log('\n── change, guards, messages ─────────────────────────────────');
  ok('change lands on DW.skip', /blending into next/.test(await E.inject('skip this')) && calls.skip === 1, 'skip ' + calls.skip);
  /* THE REAL POST-STOP STATE, which is the whole point: stop() nulls deck A
     so `now` goes null, and leaves `order` alone so `of` STAYS TRUTHY. The
     old fixture zeroed `of` instead — the one thing stop() never does — so
     it could not have caught a guard that trusted `of`, and did not: the
     steer passed its own guard on a stopped deck and reported 'blending now
     into <TRACK>' while blendNow had already returned 'nothing playing'. */
  DW.state.now = null; DW.nowMeta = null;
  ok('nothing playing is a sentence, on the state stop() actually leaves (of truthy, now null)',
     DW.state.of > 0 && /nothing playing/.test(await E.inject('faster')), 'steered a silent deck');
  DW.state.of = SET.length;
  messages[0]({ origin: 'http://localhost:8777', data: { deckwave: 'inject', event: 'duck' } });
  await new Promise(r => setTimeout(r, 0));
  ok('a same-origin postMessage injects (duck landed)', E.status.ducked === true, 'the walkthrough window cannot reach the deck');
  const volBefore = vol;
  messages[0]({ origin: 'https://evil.example', data: { deckwave: 'inject', event: 'unduck' } });
  await new Promise(r => setTimeout(r, 0));
  ok('a cross-origin postMessage is ignored', E.status.ducked === true && vol === volBefore, 'any page on the internet can steer the deck');
  await E.inject('unduck');

  /* unwired module: steering refuses, duck still works */
  E.wire(null);
  ok('unwired, steering is a sentence', /not wired/.test(await E.inject('faster')), 'an unwired module tried to steer');
  ok('unwired, duck still works (it only touches DW)', /ducked for the voice/.test(await E.inject('duck')), 'duck needs no dashboard');
  await E.inject('unduck');

  console.log('\n── speak: the page reads aloud, over the music ──────────────');
  const utts = [];
  global.speechSynthesis = { cancel() {}, speak(u) { utts.push(u); },
    getVoices: () => [{ name: 'Google US English', lang: 'en-US' }, { name: 'Ava', lang: 'en-US' }, { name: 'Thomas', lang: 'fr-FR' }] };
  global.SpeechSynthesisUtterance = function (t) { this.text = t; };
  vol = .85;
  const s1r = E.speak('hello over the set');
  ok('speak ducks the music and queues the utterance (default depth 0.55)', Math.abs(vol - .85 * .55) < 1e-3 && utts.length === 1
     && utts[0].text === 'hello over the set' && /over the set/.test(s1r), s1r + ' vol ' + vol);
  utts[0].onend();
  ok('the voice ending restores the exact volume', vol === .85 && E.status.speaking === false, 'vol ' + vol);
  const before = vol;
  await E.inject('duck');                          /* the narrator ducked BY HAND */
  E.speak('spoken during a manual duck');
  utts[1].onend();
  ok('speak never steals or restores a MANUAL duck', Math.abs(vol - before * .3) < 1e-9 && E.status.ducked === true,
     'vol ' + vol + ' — the hand duck must survive the voice');
  await E.inject('unduck');
  E.speak('first'); const u1 = utts[utts.length - 1];
  E.speak('second — takes over'); const u2 = utts[utts.length - 1];
  u1.onend();                                      /* the cancelled one ends late */
  ok('an overtaken utterance cannot restore the duck out from under the new one',
     Math.abs(vol - .85 * .55) < 1e-3, 'vol ' + vol);
  u2.onend();
  ok('the final utterance restores once', vol === .85, 'vol ' + vol);
  E.speak('with a per-record depth', { duck: 0.8 });
  ok('a per-record duck overrides the default', Math.abs(vol - .85 * .8) < 1e-9, 'vol ' + vol);
  utts[utts.length - 1].onend();
  ok('the house preference picks a calm English voice (Ava over Google over the French one)',
     (() => { E.speak('voice check'); const u = utts[utts.length - 1]; const okv = u.voice && u.voice.name === 'Ava'; u.onend(); return okv; })(),
     'picked ' + (utts[utts.length - 1].voice && utts[utts.length - 1].voice.name));
  const cfgMsg = E.configureSpeech({ duck: 0.7, pitch: 0.8, voice: 'google' });
  ok('configureSpeech patches and reports the resolved voice',
     /0\.7x/.test(cfgMsg) && /Google US English/.test(cfgMsg) && E.speech.duck === 0.7 && E.speech.resolvedVoice === 'Google US English', cfgMsg);
  E.configureSpeech({ duck: 0.55, pitch: 0.85, voice: null });
  /* review 2026-09-01 M1 (ledger 123): `+v || default` turned a legal 0
     into the default — the mixer's voice fader at 0% spoke at FULL volume */
  E.configureSpeech({ volume: 0 });
  ok('configureSpeech keeps a legal zero (volume 0 is silent, not full)', E.speech.volume === 0, 'volume ' + E.speech.volume);
  E.configureSpeech({ pitch: 0 });
  ok('…and pitch 0 is 0, not the default', E.speech.pitch === 0, 'pitch ' + E.speech.pitch);
  E.configureSpeech({ volume: 'loud', pitch: 0.85 });
  ok('…while a non-number falls back to the default rather than NaN', E.speech.volume === 1 && E.speech.pitch === 0.85, 'volume ' + E.speech.volume);
  const nu = utts.length;
  E.speakAgain();
  ok('speakAgain repeats the last spoken line with current settings', utts.length === nu + 1 && utts[nu].text === 'voice check',
     'repeated ' + (utts[nu] && utts[nu].text));
  utts[utts.length - 1].onend();
  delete global.speechSynthesis; delete global.SpeechSynthesisUtterance;
  ok('no speech synthesis is a sentence, not a crash', /no speech synthesis/.test(E.speak('x')), 'crashed or spoke into the void');

  console.log('\n── pulse: the game-facing beat clock ────────────────────────');
  DW.state.now = null; DW.nowMeta = null;
  const p0 = E.pulse();
  ok('nothing playing → { playing: false } and nothing else', p0.playing === false && Object.keys(p0).length === 1,
     JSON.stringify(p0) + ' — a game must be able to gate on one field');
  /* 120 bpm grid at 0.5 s spacing, deck stretched ×1.06, 10 s on the audio clock */
  const beats = Array.from({ length: 400 }, (_, i) => i * 0.5);
  DW.nowMeta = { name: 'PULSE TEST', bpm: 120, energy: .6, camelot: '8A', dur: 200, beats };
  DW.state.now = DW.nowMeta.name; DW.elapsed = 10; DW.deck = { rate: 1.06 };
  const p1 = E.pulse();
  ok('track position is elapsed × rate, looked up in the track\'s own grid',
     p1.playing === true && p1.pos === 10.6 && p1.beat.i === 21 && Math.abs(p1.beat.phase - 0.2) < 1e-9,
     JSON.stringify(p1.beat) + ' pos ' + p1.pos + ' — visuals would pulse against the wrong clock');
  ok('untilSec is real seconds (grid gap / rate)', Math.abs(p1.beat.untilSec - (0.4 / 1.06)) < 1e-3,
     'untilSec ' + p1.beat.untilSec + ' expected ' + (0.4 / 1.06).toFixed(3));
  ok('tempo is the PLAYING tempo (bpm × rate), bpm stays the label', p1.tempo === 127.2 && p1.bpm === 120,
     'tempo ' + p1.tempo + ' bpm ' + p1.bpm);
  ok('bar rides the documented 4/4 assumption', p1.bar.i === 5 && p1.bar.beatInBar === 1,
     JSON.stringify(p1.bar));
  DW.nowMeta._unlocked = true; DW.deck = { rate: 1 };
  ok('a straight track pulses at rate 1 with the flag up', E.pulse().straight === true && E.pulse().rate === 1,
     'straight tracks are not beatmatched but they still have a grid');
  delete DW.nowMeta._unlocked;

  /* ledger 82, carried to the game surface: a jumped-to deck runs at
     rate 1 and is matched to NOTHING, so `rate === 1` is not the question.
     The engine publishes origin/matched on DW.deck; pulse() passes them
     through untouched — this module translates, it does not decide. */
  DW.deck = { rate: 1, origin: 'play', matched: false };
  const pj = E.pulse();
  ok('pulse carries the engine\'s deck FACTS: a jumped-to deck is origin play, matched false — at rate 1',
     pj.origin === 'play' && pj.matched === false && pj.rate === 1,
     JSON.stringify({ origin: pj.origin, matched: pj.matched, rate: pj.rate })
     + ' — a game keying "beatmatched" on rate 1 draws the tightest match on screen against nothing');
  DW.deck = { rate: 1.06, origin: 'chain', matched: true };
  ok('CONTROL: a chained deck says chain/true, so the fields are read and not hard-coded',
     E.pulse().origin === 'chain' && E.pulse().matched === true,
     JSON.stringify({ origin: E.pulse().origin, matched: E.pulse().matched }));
  DW.deck = { rate: 1 };
  const pOld = E.pulse();
  ok('an engine that publishes neither leaves both ABSENT, not false',
     !('origin' in pOld) && !('matched' in pOld),
     JSON.stringify(pOld) + ' — a consumer must be able to tell "not matched" from "nothing said"');
  ok('nothing playing still answers { playing: false } and nothing else',
     (() => { const nm = DW.nowMeta, nw = DW.state.now; DW.nowMeta = null; DW.state.now = null;
              const p = E.pulse(); DW.nowMeta = nm; DW.state.now = nw;
              return p.playing === false && Object.keys(p).length === 1; })(),
     'the new fields leaked into the silent answer a game gates on');
  DW.deck = { rate: 1.06 };
  /* postMessage sync: answered to the sender, same-origin only */
  const answers = [];
  messages[0]({ origin: 'http://localhost:8777', source: { postMessage: (m, o) => answers.push({ m, o }) },
                data: { deckwave: 'pulse', id: 7 } });
  ok('a same-origin pulse request is answered to its sender with the id echoed',
     answers.length === 1 && answers[0].m.deckwave === 'pulse' && answers[0].m.id === 7 && answers[0].m.playing === true
     && answers[0].o === 'http://localhost:8777',
     JSON.stringify(answers));
  messages[0]({ origin: 'https://evil.example', source: { postMessage: (m) => answers.push({ m }) },
                data: { deckwave: 'pulse' } });
  ok('a cross-origin pulse request gets silence', answers.length === 1,
     'the deck\'s position leaked to an arbitrary page');
  /* review 2026-09-01: on file:// (and in a sandboxed frame) location.origin
     IS the string "null" — and so is every other opaque origin's, so the
     equality passed and any local page could steer the deck. */
  const originWas = global.location.origin;
  global.location.origin = 'null';
  const volNull = vol, ducksNull = E.status.ducked;
  messages[0]({ origin: 'null', data: { deckwave: 'inject', event: 'duck' } });
  messages[0]({ origin: 'null', source: { postMessage: m => answers.push({ m }) }, data: { deckwave: 'pulse' } });
  await new Promise(r => setTimeout(r, 0));
  ok('on an opaque origin ("null" === "null") a message is refused, not accepted as same-origin',
     E.status.ducked === ducksNull && vol === volNull && answers.length === 1,
     'ducked ' + E.status.ducked + ' answers ' + answers.length + ' — any file:// page on the machine could steer the deck');
  global.location.origin = originWas;
  const nBefore = answers.length;
  messages[0]({ origin: originWas, source: { postMessage: m => answers.push({ m }) }, data: { deckwave: 'pulse' } });
  await new Promise(r => setTimeout(r, 0));
  ok('CONTROL: a real same-origin message still works after the "null" guard', answers.length === nBefore + 1,
     'the guard refused a legitimate origin too');

  console.log('\n── the voice cannot leave the music ducked forever ──────────');
  /* review 2026-09-01: Chrome drops `onend` for some utterances (a
     backgrounded tab, a wedged synthesiser) and the duck then has no end —
     0.55x until somebody types unduck, which mid-set on a phone is nobody.
     The guard delay is CHOSEN: 10 chars/sec (slower than any real voice)
     over the rate, + 4 s. Driven with a swapped clock, not by waiting. */
  global.speechSynthesis = { cancel() {}, speak(u) { utts.push(u); }, getVoices: () => [] };
  global.SpeechSynthesisUtterance = function (t) { this.text = t; };
  const timers = [];
  const realST = global.setTimeout, realCT = global.clearTimeout;
  const swap = () => { global.setTimeout = (fn, ms) => timers.push({ fn, ms, live: true });
                       global.clearTimeout = id => { if (timers[id - 1]) timers[id - 1].live = false; }; };
  const unswap = () => { global.setTimeout = realST; global.clearTimeout = realCT; };
  vol = .85;
  const words = 'a hundred characters of narration that Chrome will never tell us has finished speaking, not once';
  swap(); E.speak(words); unswap();
  const g = timers[timers.length - 1];
  ok('speak arms a dead man\'s handle sized to the utterance, not a fixed guess',
     !!g && g.live && g.ms >= 4000 + (words.length / 10) * 1000 && Math.abs(vol - .85 * .55) < 1e-3,
     'timer ' + JSON.stringify(g && { ms: g.ms }) + ' vol ' + vol);
  g.fn();
  ok('when onend never comes, the guard restores the exact pre-duck volume',
     vol === .85 && E.status.ducked === false && E.status.speaking === false,
     'vol ' + vol + ' ducked ' + E.status.ducked + ' — the set stays under the voice until someone types unduck');
  swap();
  E.speak('a normal line');
  const g2 = timers[timers.length - 1];
  utts[utts.length - 1].onend();          /* still on the swapped clock: clearTimeout must reach THIS table */
  unswap();
  ok('CONTROL: a normal onend cancels the guard, so it cannot unduck a later voice',
     g2 && g2.live === false && vol === .85,
     'guard live ' + (g2 && g2.live) + ' — a stale timer firing during the NEXT take would unduck mid-sentence');
  delete global.speechSynthesis; delete global.SpeechSynthesisUtterance;

  console.log('\n── the copy-paste example is real code ──────────────────────');
  /* ledger 111's rule, applied to the one file no harness read: a text
     check cannot see a broken parse, and examples/soundtrack.html IS the
     integration guide's "the whole integration is this file". */
  const vm = require('vm');
  /* seam: a deliberately broken copy must turn these red, or they are
     decoration (DECKWAVE_EXAMPLE_SRC=<path>) */
  const ex = fs.readFileSync(process.env.DECKWAVE_EXAMPLE_SRC || 'examples/soundtrack.html', 'utf8').replace(/\r\n/g, '\n');
  const blocks = [...ex.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  ok('every <script> block in examples/soundtrack.html was found and COMPILES',
     blocks.length >= 1 && blocks.every(b => b.trim().length > 50)
     && blocks.every(b => { try { new vm.Script(b); return true; } catch (e) { return false; } }),
     'blocks ' + blocks.length + ' · ' + blocks.map(b => { try { new vm.Script(b); return 'ok'; } catch (e) { return e.message; } }).join(' | '));
  const code = blocks.join('\n');
  const used = [...code.matchAll(/\b(?:d|deck\(\))\.([a-zA-Z]+)\(/g)].map(m => m[1]);
  const allowed = ['inject', 'pulse'];
  ok('the example drives the deck through inject / pulse ONLY — the two documented verbs',
     used.length >= 2 && used.every(u => allowed.includes(u))
     && used.includes('inject') && used.includes('pulse'),
     'called on the deck handle: ' + JSON.stringify(used) + ' — anything else is a private surface a game would copy');
  ok('CONTROL: the recogniser would catch a third verb', (() => {
       const bad = [...'const d = deck(); d.speak("hi"); d.pulse();'.matchAll(/\b(?:d|deck\(\))\.([a-zA-Z]+)\(/g)].map(m => m[1]);
       return bad.includes('speak') && !bad.every(u => allowed.includes(u));
     })(), 'the regex matches nothing, so the check above is decoration');
  ok('any postMessage the example sends carries the documented {deckwave:…} shape',
     !/postMessage\s*\(/.test(code) || /postMessage\s*\(\s*\{\s*deckwave/.test(code),
     'a postMessage with another shape would be silently ignored by the deck, and copied by every reader');

  console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') + ' of ' + checks + ' checks');
  process.exit(fails ? 1 : 0);
})();
