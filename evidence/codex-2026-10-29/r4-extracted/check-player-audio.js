'use strict';

const fs = require('fs');
const vm = require('vm');
const { createAudio } = require('./fake-audio');

let checks = 0, fails = 0;
const ok = (name, condition, falsifier) => {
  checks++;
  if (!condition) {
    fails++;
    console.log('  FAIL  ' + name + '\n        ' + falsifier);
  } else console.log('  pass  ' + name);
};

/* Numerical comparison only; no auditory tolerance is asserted. */
const near = (a, b) =>
  Number.isFinite(a) && Number.isFinite(b) &&
  Math.abs(a - b) <= 32 * Number.EPSILON *
    Math.max(1, Math.abs(a), Math.abs(b));

const flush = () => new Promise(resolve => setImmediate(resolve));

const src = fs.readFileSync(
  process.env.DECKWAVE_SRC || 'assets/deckwave.js', 'utf8'
).replace(/\r\n/g, '\n');
const start = src.indexOf('\nconst Player = (() => {');
const end = src.indexOf('\n})();\n', start);
if (start < 0 || end < 0) throw Error('Player extraction failed');
const playerText = src.slice(start + 1, end + 6) + '\nPlayer;';

const track = (name, bpm = 120, dur = 120) => ({
  name, bpm, dur, camelot: '8A',
  beats: Array.from(
    { length: Math.floor(dur * bpm / 60) }, (_, i) => i * 60 / bpm)
});

/* Backed PCM, with internally consistent metadata. This synthetic fixture
   has constant window energy; no production detector/configuration changes. */
function bufferFor(meta, ctx) {
  const b = ctx.createBuffer(1, Math.round(meta.dur * 8000), 8000);
  const data = b.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = i & 1 ? .5 : -.5;
  return b;
}

function playerRig() {
  const r = createAudio({ time: 100 });
  r.timers = new Map();
  let timer = 0;
  const sandbox = {
    console, navigator: { userAgent: '' },
    AC: r.AudioContext,
    AudioWorkletNode: r.AudioWorkletNode,
    ASSETS: { allowCDN: false },
    CDN: {}, assetURL: k => k,
    LIB: { decode: async (meta, ctx) => bufferFor(meta, ctx) },
    setTimeout(fn, ms) {
      const id = ++timer;
      r.timers.set(id, { fn, ms });
      return id;
    },
    clearTimeout(id) { r.timers.delete(id); }
  };
  sandbox.window = sandbox;
  r.player = vm.runInNewContext(playerText, sandbox);
  r.d = r.player._dev;
  return r;
}

async function ready(bpms = [120, 120, 120]) {
  const r = playerRig();
  await r.player.play(bpms.map((bpm, i) => track('track-' + i, bpm)));
  await flush();
  if (!r.d.A || !r.d.B) throw Error('Fixture did not build both decks');
  return r;
}

function modelControls() {
  const r = createAudio({ time: 10 }), c = new r.AudioContext();
  const param = () => c.createGain().gain;

  let p = param();
  p.linearRampToValueAtTime(0, 12);
  ok('fake: first ramp anchors at call time',
    near(p.valueAt(11), .5),
    'Expected 0.5 at 11, got ' + p.valueAt(11));

  p = param();
  p.setValueAtTime(1, 10);
  p.setTargetAtTime(0, 10, 2);
  ok('fake: target is exponential',
    near(p.valueAt(12), Math.exp(-1)),
    'Expected exp(-1), got ' + p.valueAt(12));
  p.cancelScheduledValues(11);
  ok('fake: cancellation does not stop an earlier target',
    near(p.valueAt(14), Math.exp(-2)),
    'An earlier target was incorrectly held or removed');

  p = param();
  p.setValueAtTime(0, 10);
  p.linearRampToValueAtTime(1, 14);
  const saved = p.snapshot();
  p.cancelScheduledValues(12);
  ok('fake: cancel removes a ramp endpoint without implicit holding',
    near(saved.valueAt(12), .5) && near(p.valueAt(12), 0) &&
    p.calls.some(x => x.op === 'param.linearRampToValueAtTime'),
    'Lost either cancellation semantics or the old event evidence');

  p = param();
  p.setValueAtTime(0, 10);
  p.linearRampToValueAtTime(1, 14);
  p.cancelAndHoldAtTime(12);
  ok('fake: hold retains the ramp prefix and held value',
    near(p.valueAt(11), .25) && near(p.valueAt(13), .5),
    'Holding changed the preceding ramp or failed to hold');

  p = param();
  p.setValueAtTime(1, 12);
  p.linearRampToValueAtTime(2, 12);
  p.setValueAtTime(3, 12);
  ok('fake: replacement preserves equal-time event ordering',
    p.valueAt(12) === 2,
    'Expected final ramp value 2, got ' + p.valueAt(12));

  const x = c.createGain(), y = c.createGain(), z = c.createGain();
  x.connect(y); x.connect(z); x.connect(z);
  y.connect(c.destination); z.connect(c.destination);
  x.disconnect(y);
  ok('fake: targeted disconnect preserves the other unique edge',
    x.connections.length === 1 && x.connections[0].to === z &&
    r.reachable(x, c.destination),
    'Targeted disconnect erased another route or duplicated an edge');

  const b = c.createBuffer(2, 16000, 8000);
  b.getChannelData(1)[5] = .25;
  ok('fake: buffer dimensions describe its actual PCM',
    b.duration === 2 && b.length === 16000 &&
    b.numberOfChannels === 2 &&
    b.getChannelData(0).length === b.length &&
    b.getChannelData(1)[5] === .25,
    'Buffer metadata and sample storage disagree');
}

function effectiveGain(r, deck, t) {
  return deck.src.activeAt(t) &&
    r.reachable(deck.src, deck.src.context.destination)
    ? deck.g.gain.valueAt(t) : 0;
}

/* (a) HEARD PATH.
   Capture each physical deck, not only whichever objects A/B name later. */
async function continuityChecks() {
  const cases = [
    ['ordinary hold', 'hold', 0],
    ['opener entrance', 'entrance', .5],
    ...[.125, .25, .5, .9].map(f => [
      'overlap before handover ' + f, 'before', f
    ]),
    ...[.125, .25, .5, .9].map(f => [
      'overlap after handover ' + f, 'after', f
    ])
  ];

  for (const [label, phase, fraction] of cases) {
    const r = await ready();
    const outgoing = r.d.A, incoming = r.d.B;
    const begin = incoming.startedAt, fade = outgoing.fade;
    const cohort = [outgoing, incoming];
    let t;

    if (phase === 'hold') t = outgoing.startedAt + 2;
    else if (phase === 'entrance')
      t = outgoing.startedAt + fraction;
    else {
      if (phase === 'after') {
        r.d.ctx.setTime(begin + .1);
        r.d.handover(1);
        await flush();
        if (r.d.B) cohort.push(r.d.B);
      }
      t = begin + fade * fraction;
    }
    r.d.ctx.setTime(t);

    const expected = phase === 'hold' ? [1, 0]
      : phase === 'entrance' ? [fraction, 0]
      : [1 - fraction, Math.min(1, fraction / .6)];

    const before = cohort.map(d => ({
      deck: d,
      parameter: d.g.gain.valueAt(t),
      effective: effectiveGain(r, d, t)
    }));

    ok(label + ': nonvacuous scheduled-gain control',
      near(before[0].effective, expected[0]) &&
      near(before[1].effective, expected[1]),
      JSON.stringify({
        expected,
        actual: before.slice(0, 2).map(x => x.effective)
      }));

    r.d.cancelPending();

    const changes = before.map(x => ({
      source: x.deck.src.id,
      parameterBefore: x.parameter,
      parameterAfter: x.deck.g.gain.valueAt(t),
      before: x.effective,
      after: effectiveGain(r, x.deck, t)
    }));

    ok(label + ': both physical decks retain gain across cancellation',
      changes.every(x =>
        near(x.parameterBefore, x.parameterAfter) &&
        near(x.before, x.after)),
      'A boundary jump falsifies continuity: ' + JSON.stringify(changes));

    if (phase === 'hold') {
      ok('ordinary cancellation actually discards the unstarted successor',
        r.d.B !== incoming && incoming.src.stoppedBy(t),
        'A no-op cancelPending would otherwise pass continuity');
    }

    r.player.stop();
  }
}

/* (b) HEARD PATH.
   Exact event endpoints plus analytic extrema; not just endpoint samples. */
async function bassChecks() {
  for (const bpms of [[120, 120], [120, 128], [128, 120]]) {
    const r = await ready(bpms);
    const a = r.d.A, b = r.d.B;
    const out = a.outAt, fade = a.fade;
    const shelf = b.lo.gain.snapshot();
    const gain = b.g.gain.snapshot();
    const bassRamps = shelf.events.filter(e => e.type === 'linear');
    const gainRamps = gain.events.filter(e => e.type === 'linear');
    const bound = shelf.range(r.d.ctx.currentTime, out + fade);

    ok(bpms.join('/') + ': incoming shelf is on the source route',
      b.lo.type === 'lowshelf' &&
      r.reachable(b.src, b.lo) &&
      r.reachable(b.lo, r.d.ctx.destination),
      'Correct automation on a disconnected shelf is decoration');

    ok(bpms.join('/') + ': incoming bass never exceeds 0 dB',
      bound.max <= 0 &&
      shelf.valueAt(out) === -30 &&
      near(shelf.valueAt(out + fade * .275), -15),
      JSON.stringify({ bound, atEntry: shelf.valueAt(out) }));

    ok(bpms.join('/') + ': incoming ramp endpoints match the plan',
      b.startedAt === out &&
      bassRamps.length === 1 &&
      bassRamps[0].at === out + fade * .55 &&
      bassRamps[0].value === 0 &&
      shelf.valueAt(out + fade * .55) === 0 &&
      gainRamps.length === 1 &&
      gainRamps[0].at === out + fade * .6 &&
      gainRamps[0].value === 1 &&
      gain.valueAt(out + fade * .6) === 1,
      JSON.stringify({ out, fade, bassRamps, gainRamps }));

    r.player.stop();
  }
}

/* (c) HEARD PATH for Stop behavior.
   The requested stopped-or-connected predicate is retained, then strengthened. */
async function stopChecks() {
  const r = await ready();
  const cancelled = r.d.B;

  r.d.ctx.setTime(r.d.A.startedAt + 2);
  r.d.cancelPending();
  await r.d.chain();
  await flush();

  const outgoing = r.d.A, incoming = r.d.B;
  r.d.ctx.setTime(incoming.startedAt + .1);
  r.d.handover(1);
  await flush();
  r.d.ctx.setTime(incoming.startedAt + 4);
  const t = r.d.ctx.currentTime;
  const future = r.d.B;

  ok('Stop fixture includes cancelled, outgoing, current and future sources',
    r.started.length >= 4 &&
    cancelled.src.stoppedBy(t) &&
    outgoing.src.activeAt(t) &&
    outgoing !== r.d.A && outgoing !== r.d.B &&
    !!future && future.startedAt > t,
    'Missing one of the lifetime categories that pointer-only Stop can lose');

  r.player.stop();

  const state = r.started.map(s => ({
    source: s.id,
    startsAt: s.started.at,
    stopsAt: s.stopAt,
    stopped: s.stoppedBy(t),
    connected: r.reachable(s, s.context.destination)
  }));

  ok('every started source is stopped or still reaches the destination',
    state.every(s => s.stopped || s.connected),
    'Unstopped disconnected source: ' + JSON.stringify(state));

  ok('Stop has an effective stop for every started source, including future ones',
    state.every(s => s.stopped),
    'Connected sources must not escape Stop: ' + JSON.stringify(state));
}

(async () => {
  modelControls();
  await continuityChecks();
  await bassChecks();
  await stopChecks();
  console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') +
    ' of ' + checks + ' checks');
  process.exitCode = fails ? 1 : 0;
})().catch(e => {
  console.error('FATAL:', e.stack || e);
  process.exitCode = 1;
});
