1. **MEASURED — The reliability rig records a mutable schedule, not a complete event history.** Cancellation deletes entries; `setTargetAtTime` becomes a step; `.value` is an independent field. Its control proves one explicitly anchored linear ramp and held values, only. (`tools/check-reliability.js:20–33,65–66`)

| Operation | MEASURED: current rig | INFERRED: consequence and falsifier |
|---|---|---|
| `setValueAtTime` | Appends an event without validation or time normalization. (`tools/check-reliability.js:23`) | Does not implement past-time clamping or same-type/same-time replacement. Falsifier: the corresponding cases below produce the specified timeline. |
| Linear ramp | Interpolates from the preceding entry, initially `{at:0,value:p.value}`. (`tools/check-reliability.js:26–30`) | An explicitly anchored ramp works. A first ramp incorrectly starts at context time zero rather than the call time. Falsifier: with clock 10, initial value 1 and endpoint `(0,12)`, value at 11 is `0.5`. |
| Target | Discards the time constant and records a set. (`tools/check-reliability.js:25`) | An exponential approach becomes an instantaneous jump. Falsifier: initial 1, target 0 at 2, time constant 2 gives `exp(-1)` at 4. |
| Ordering | Sorts by timestamp; retains duplicate events. (`tools/check-reliability.js:23–29`) | Stable sorting alone does not implement replacement. For `set(1,2); linear(2,2); set(3,2)`, replacing the original set preserves its position before the ramp. Falsifier: the resulting value at 2 is 2, not 3. |
| Cancellation | Keeps events strictly before the cancellation time. (`tools/check-reliability.js:22`) | This correctly captures basic endpoint removal. It does **not** hold the interpolated value: removing a ramp endpoint can expose its preceding value; an earlier target continues approaching its target. A check expecting automatic holding would be defective. Falsifier: cancellation alone preserves the ramp’s intermediate value under the reference semantics. |
| Historical evaluation | Re-evaluates the currently retained list. (`tools/check-reliability.js:26–30`) | After cancellation, querying an earlier time does not reconstruct previously rendered audio. Save the before-value or a schedule snapshot. Falsifier for an alleged discontinuity: independently captured before/after values agree. |
| Graph/lifetime | Records destination objects, clears every connection on any `disconnect`, and stores requested start/stop times. (`tools/check-reliability.js:34–41`) | No port routing, targeted disconnect, effective stop, natural completion or rendering is established. Falsifier for a graph/lifetime finding: the correctly modeled edges or effective stop exclude it. |
| Buffers | Ordinary decode returns only duration and name. (`tools/check-reliability.js:53`) | Those checks cannot establish behavior dependent on PCM, channel count, length or sample rate. |

**MEASURED — Relevant existing assertions have narrower coverage than their names suggest:**

- “Preserves the blend already in progress” compares position and playback rate, with no gain assertion. (`tools/check-reliability.js:98–100`)
- “Releases the processor” checks flags and the port handler; posted messages appear only in evidence, not the predicate. (`tools/check-reliability.js:144`)
- `check-player`’s parameter methods and connections are no-ops. (`tools/check-player.js:38–46`)

**INFERRED — Those are decoration for, respectively, gain continuity, receipt of a release instruction, and automation/topology correctness.** They retain value for the narrower properties they actually assert. Falsifiers: changing only gain continuity, omitting only the release message, or breaking only graph wiring makes the respective assertion fail.

2. **INFERRED — Proposed `tools/fake-audio.js`, unexecuted.** This models continuous-time automation for the operations used here, plus `cancelAndHoldAtTime`. It keeps call history separate from the active schedule, implements replacement and ordering, and records graph edges. Unsupported automation throws rather than returning misleading results. It is deliberately not a renderer.

```js
'use strict';

/* INFERRED design.
 *
 * Supported automation:
 *   value, setValueAtTime, linearRampToValueAtTime,
 *   setTargetAtTime, cancelScheduledValues, cancelAndHoldAtTime.
 *
 * snapshot().valueAt(t) evaluates that immutable scheduled timeline.
 * It is NOT a retrospective recording of rendered audio.
 *
 * Source stop times are effective scheduling times. Natural completion,
 * rendering and delivery of ended events are not simulated.
 */

function error(name, message) {
  const e = new Error(message);
  e.name = name;
  throw e;
}

function finite(x) {
  x = Number(x);
  if (!Number.isFinite(x)) throw new TypeError('Expected a finite number');
  return x;
}

function time(x) {
  x = finite(x);
  if (x < 0) throw new RangeError('Negative time');
  return x;
}

function float(x) {
  x = Math.fround(finite(x));
  if (!Number.isFinite(x)) throw new TypeError('Value exceeds float range');
  return x;
}

function index(x, count) {
  if (!Number.isInteger(x) || x < 0 || x >= count)
    error('IndexSizeError', 'Invalid port/channel index');
  return x;
}

const orderEvents = es =>
  es.slice().sort((a, b) => a.at - b.at || a.order - b.order);

function approach(e, from, t) {
  return e.tau === 0
    ? e.value
    : e.value + (from - e.value) * Math.exp(-(t - e.at) / e.tau);
}

/* Evaluate the interval after prev and before next.
 *
 * A ramp following a target starts at the ramp's call time if the
 * target has begun, otherwise at the target's start time. The earlier
 * portion of a running target remains exponential.
 */
function between(prev, from, next, t) {
  if (!prev) return from;

  if (next && next.type === 'linear') {
    const start = prev.type === 'target'
      ? Math.max(prev.at, next.callAt)
      : prev.at;

    if (prev.type === 'target' && t < start)
      return approach(prev, from, t);

    const initial = prev.type === 'target'
      ? approach(prev, from, start)
      : from;

    if (next.at === start) return next.value;
    return initial +
      (next.value - initial) * (t - start) / (next.at - start);
  }

  return prev.type === 'target' ? approach(prev, from, t) : from;
}

function evaluate(events, initial, t, left = false) {
  t = time(t);
  let prev = null, value = initial;

  for (const e of events) {
    if (t < e.at || (left && t === e.at))
      return between(prev, value, e, t);

    const arriving = between(prev, value, e, e.at);
    value = e.type === 'target' ? arriving : e.value;
    prev = e;
  }

  return between(prev, value, null, t);
}

class FakeAudioParam {
  constructor(node, name, defaultValue) {
    this.node = node;
    this.context = node.context;
    this.name = name;
    this.defaultValue = float(defaultValue);
    this.calls = [];
    this._events = [];
  }

  _record(method, args) {
    const rec = this.context.record(this.node, 'param.' + method, {
      param: this.name, args: Array.from(args)
    });
    this.calls.push(rec);
    return rec;
  }

  _put(event) {
    const old = this._events.findIndex(e =>
      e.type === event.type && e.at === event.at);

    if (old >= 0) {
      /* Replacement retains the existing equal-time ordering slot. */
      event.order = this._events[old].order;
      this._events[old] = event;
    } else {
      event.order = ++this.context.rig.serial;
      this._events.push(event);
    }
    this._events = orderEvents(this._events);
  }

  get events() {
    return this.snapshot().events;
  }

  get value() {
    return this.valueAt(this.context.currentTime);
  }

  set value(v) {
    this._record('value=', [v]);
    this._put({
      type: 'set',
      value: float(v),
      at: this.context.currentTime,
      callAt: this.context.currentTime
    });
  }

  setValueAtTime(value, at) {
    this._record('setValueAtTime', arguments);
    this._put({
      type: 'set', value: float(value),
      at: Math.max(time(at), this.context.currentTime),
      callAt: this.context.currentTime
    });
    return this;
  }

  linearRampToValueAtTime(value, at) {
    this._record('linearRampToValueAtTime', arguments);
    value = float(value);
    at = Math.max(time(at), this.context.currentTime);
    const callAt = this.context.currentTime;

    const existing = this._events.find(e =>
      e.type === 'linear' && e.at === at);
    const slot = existing ? existing.order : Infinity;
    const preceding = this._events.filter(e =>
      e.at < at || (e.at === at && e.order < slot));

    if (!preceding.length) {
      const initial = this.valueAt(callAt);
      this._record('implicitRampAnchor', [initial, callAt]);
      this._put({
        type: 'set', value: initial, at: callAt, callAt,
        implicit: true
      });
    }

    this._put({ type: 'linear', value, at, callAt });
    return this;
  }

  setTargetAtTime(value, at, tau) {
    this._record('setTargetAtTime', arguments);
    this._put({
      type: 'target', value: float(value),
      at: Math.max(time(at), this.context.currentTime),
      tau: time(tau),
      callAt: this.context.currentTime
    });
    return this;
  }

  cancelScheduledValues(at) {
    this._record('cancelScheduledValues', arguments);
    at = time(at);
    this._events = this._events.filter(e => e.at < at);
    return this;
  }

  cancelAndHoldAtTime(at) {
    this._record('cancelAndHoldAtTime', arguments);
    at = Math.max(time(at), this.context.currentTime);

    const old = this.snapshot();
    const held = old.valueAt(at);
    const i = old.events.findIndex(e => e.at >= at);
    const next = i < 0 ? null : old.events[i];
    const prev = i > 0 ? old.events[i - 1] : null;

    const rampStart = prev && next && next.type === 'linear'
      ? (prev.type === 'target'
        ? Math.max(prev.at, next.callAt) : prev.at)
      : Infinity;

    this._events = this._events.filter(e => e.at < at);

    /* Retain the prefix of a ramp whose endpoint is being removed. */
    if (next && prev && next.type === 'linear' &&
        prev.at < at && rampStart <= at) {
      this._put({
        type: 'linear',
        value: old.valueAt(at, true),
        at,
        callAt: next.callAt,
        implicit: true
      });
    }

    this._put({
      type: 'set', value: held, at,
      callAt: this.context.currentTime, implicit: true
    });
    return this;
  }

  exponentialRampToValueAtTime() {
    this._record('exponentialRampToValueAtTime', arguments);
    error('NotSupportedError', 'Exponential ramps are outside this fake');
  }

  setValueCurveAtTime() {
    this._record('setValueCurveAtTime', arguments);
    error('NotSupportedError', 'Value curves are outside this fake');
  }

  snapshot() {
    const events = Object.freeze(orderEvents(this._events)
      .map(e => Object.freeze({ ...e })));
    const initial = this.defaultValue;
    const valueAt = (t, left = false) =>
      evaluate(events, initial, t, left);

    return Object.freeze({
      events,
      valueAt,
      /* Exact extrema for this model's monotone segments, including
         both sides of steps. This is not a sampling grid. */
      range(a, b) {
        a = time(a); b = time(b);
        if (b < a) throw new RangeError('Reversed interval');
        const knots = new Set([a, b]);
        for (const e of events) {
          if (e.at > a && e.at < b) knots.add(e.at);
          if (e.type === 'linear' && e.callAt > a && e.callAt < b)
            knots.add(e.callAt);
        }
        const values = [];
        for (const t of knots) {
          values.push(valueAt(t));
          if (t > a) values.push(valueAt(t, true));
        }
        return {
          min: Math.min(...values),
          max: Math.max(...values)
        };
      }
    });
  }

  valueAt(t, left = false) {
    return this.snapshot().valueAt(t, left);
  }

  at(t) {
    return this.valueAt(t);
  }
}

class FakeAudioBuffer {
  constructor(numberOfChannels, length, sampleRate) {
    if (!Number.isInteger(numberOfChannels) ||
        numberOfChannels < 1 || numberOfChannels > 32)
      error('NotSupportedError', 'Invalid channel count');
    if (!Number.isInteger(length) || length < 1)
      error('NotSupportedError', 'Invalid buffer length');
    sampleRate = finite(sampleRate);
    if (sampleRate < 8000 || sampleRate > 96000)
      error('NotSupportedError', 'Unsupported sample rate');

    Object.defineProperties(this, {
      numberOfChannels: { value: numberOfChannels, enumerable: true },
      length: { value: length, enumerable: true },
      sampleRate: { value: sampleRate, enumerable: true },
      duration: { value: length / sampleRate, enumerable: true }
    });
    this._channels = Array.from(
      { length: numberOfChannels }, () => new Float32Array(length));
  }

  getChannelData(channel) {
    return this._channels[index(channel, this.numberOfChannels)];
  }

  copyFromChannel(destination, channel, start = 0) {
    const data = this.getChannelData(channel);
    if (!Number.isInteger(start) || start < 0 || start >= this.length)
      error('IndexSizeError', 'Invalid buffer offset');
    destination.set(data.subarray(
      start, Math.min(this.length, start + destination.length)));
  }

  copyToChannel(source, channel, start = 0) {
    const data = this.getChannelData(channel);
    if (!Number.isInteger(start) || start < 0 || start >= this.length)
      error('IndexSizeError', 'Invalid buffer offset');
    data.set(source.subarray(0, this.length - start), start);
  }
}

class FakeAudioNode {
  constructor(context, kind, inputs = 1, outputs = 1) {
    this.context = context;
    this.kind = kind;
    this.numberOfInputs = inputs;
    this.numberOfOutputs = outputs;
    this.id = context.rig.nodes.length + 1;
    this.params = Object.create(null);
    context.rig.nodes.push(this);
    context.record(this, 'create', { kind });
  }

  param(name, value, expose = true) {
    const p = new FakeAudioParam(this, name, value);
    this.params[name] = p;
    if (expose) this[name] = p;
    return p;
  }

  get connections() {
    return this.context.rig.edges.filter(e => e.from === this);
  }

  _destination(dest, output, input) {
    if (!(dest instanceof FakeAudioNode) &&
        !(dest instanceof FakeAudioParam))
      throw new TypeError('Expected a node or AudioParam');
    if (dest.context !== this.context)
      error('InvalidAccessError', 'Cross-context connection');
    index(output, this.numberOfOutputs);
    if (dest instanceof FakeAudioNode)
      index(input, dest.numberOfInputs);
    else if (input !== 0)
      error('IndexSizeError', 'AudioParam has no numbered inputs');
  }

  connect(dest, output = 0, input = 0) {
    this.context.record(this, 'connect', {
      destination: dest instanceof FakeAudioParam
        ? `${dest.node.id}.${dest.name}` : dest && dest.id,
      output, input
    });
    this._destination(dest, output, input);
    const edges = this.context.rig.edges;
    if (!edges.some(e => e.from === this && e.to === dest &&
        e.output === output && e.input === input))
      edges.push({ from: this, to: dest, output, input });
    return dest instanceof FakeAudioParam ? undefined : dest;
  }

  disconnect(...args) {
    this.context.record(this, 'disconnect', {
      args: args.map(x => x instanceof FakeAudioParam
        ? `${x.node.id}.${x.name}` : x instanceof FakeAudioNode ? x.id : x)
    });

    let match;
    if (!args.length) {
      match = e => e.from === this;
    } else if (typeof args[0] === 'number') {
      index(args[0], this.numberOfOutputs);
      match = e => e.from === this && e.output === args[0];
    } else {
      const [dest, output, input] = args;
      this._destination(dest, output === undefined ? 0 : output,
        input === undefined ? 0 : input);
      match = e => e.from === this && e.to === dest &&
        (output === undefined || e.output === output) &&
        (input === undefined || e.input === input);
      if (!this.context.rig.edges.some(match))
        error('InvalidAccessError', 'No matching connection');
    }
    this.context.rig.edges = this.context.rig.edges.filter(e => !match(e));
  }
}

class FakeBufferSource extends FakeAudioNode {
  constructor(context) {
    super(context, 'source', 0, 1);
    this.param('playbackRate', 1);
    this.param('detune', 0);
    this._buffer = null;
    this.started = null;
    this.stopAt = Infinity;
    this.ended = false;
    this.onended = null;
    this.loop = false;
  }

  get buffer() { return this._buffer; }

  set buffer(b) {
    if (b !== null && !(b instanceof FakeAudioBuffer))
      throw new TypeError('Use a FakeAudioBuffer, not a duration-only stub');
    this._buffer = b;
    this.context.record(this, 'buffer', b ? {
      sampleRate: b.sampleRate, length: b.length,
      numberOfChannels: b.numberOfChannels
    } : { cleared: true });
  }

  start(when = 0, offset = 0, duration) {
    this.context.record(this, 'start', { when, offset, duration });
    if (this.started) error('InvalidStateError', 'Source already started');
    when = time(when); offset = time(offset);
    if (duration !== undefined) duration = time(duration);
    this.started = this._started = {
      at: Math.max(when, this.context.currentTime),
      requestedAt: when,
      offset: this.buffer ? Math.min(offset, this.buffer.duration) : offset,
      duration
    };
    this._started.off = this.started.offset;
    this.context.rig.started.push(this);
  }

  stop(when = 0) {
    this.context.record(this, 'stop', { when });
    if (!this.started) error('InvalidStateError', 'Source not started');
    when = time(when);
    if (!this.ended) this.stopAt = Math.max(when, this.context.currentTime);
  }

  stoppedBy(t) {
    return this.ended || this.stopAt <= t;
  }

  activeAt(t) {
    return !!this.started && this.started.at <= t && !this.stoppedBy(t);
  }

  /* Explicit event injection: never called synchronously by stop(). */
  dispatchEnded() {
    if (this.ended) return;
    this.ended = true;
    this.context.record(this, 'ended', { injected: true });
    if (typeof this.onended === 'function') this.onended({ target: this });
  }
}

function createAudio(options = {}) {
  const rig = {
    serial: 0, nodes: [], contexts: [], started: [], edges: [], events: []
  };

  rig.reachable = (from, destination) => {
    const seen = new Set(), queue = [from];
    while (queue.length) {
      const n = queue.shift();
      if (n === destination) return true;
      if (seen.has(n)) continue;
      seen.add(n);
      for (const e of rig.edges)
        if (e.from === n && e.to instanceof FakeAudioNode)
          queue.push(e.to);
    }
    return false;
  };

  rig.AudioContext = class FakeAudioContext {
    constructor(opts = {}) {
      this.rig = rig;
      this.id = rig.contexts.length + 1;
      this.sampleRate = opts.sampleRate || 44100;
      this.state = 'running';
      /* An explicitly chosen initial test-clock position. */
      this._time = time(options.time || 0);
      rig.contexts.push(this);
      this.destination = new FakeAudioNode(this, 'destination', 1, 0);
      this.audioWorklet = {
        addModule: async url => {
          this.record(null, 'addModule', { url: String(url) });
          if (options.addModule) await options.addModule(url, this);
        }
      };
    }

    get currentTime() { return this._time; }

    setTime(t) {
      t = time(t);
      if (t < this._time) throw new RangeError('Clock cannot run backwards');
      if (this.state !== 'running' && t !== this._time)
        error('InvalidStateError', 'Suspended/closed audio clock is frozen');
      this._time = t;
    }

    record(node, op, fields = {}) {
      const record = {
        seq: ++rig.serial, context: this.id,
        node: node ? node.id : null,
        time: this.currentTime, op, ...fields
      };
      rig.events.push(record);
      return record;
    }

    async resume() {
      if (this.state === 'closed') error('InvalidStateError', 'Closed context');
      this.state = 'running';
      this.record(null, 'resume');
    }

    async suspend() {
      this.state = 'suspended';
      this.record(null, 'suspend');
    }

    async close() {
      this.state = 'closed';
      this.record(null, 'close');
    }

    createBuffer(channels, length, sampleRate) {
      return new FakeAudioBuffer(channels, length, sampleRate);
    }

    createGain() {
      const n = new FakeAudioNode(this, 'gain');
      n.param('gain', 1);
      return n;
    }

    createBiquadFilter() {
      const n = new FakeAudioNode(this, 'filter');
      n.type = 'lowpass';
      for (const [name, value] of Object.entries({
        frequency: 350, detune: 0, Q: 1, gain: 0
      })) n.param(name, value);
      return n;
    }

    createDynamicsCompressor() {
      const n = new FakeAudioNode(this, 'compressor');
      for (const [name, value] of Object.entries({
        threshold: -24, knee: 30, ratio: 12, attack: .003, release: .25
      })) n.param(name, value);
      return n;
    }

    createAnalyser() {
      const n = new FakeAudioNode(this, 'analyser');
      n.fftSize = 2048;
      n.smoothingTimeConstant = .8;
      return n;
    }

    createBufferSource() {
      return new FakeBufferSource(this);
    }

    createMediaStreamDestination() {
      const n = new FakeAudioNode(this, 'stream-destination', 1, 0);
      n.stream = Object.freeze({ fake: true });
      return n;
    }
  };

  rig.AudioWorkletNode = function (ctx, name) {
    const n = new FakeAudioNode(ctx, 'worklet');
    n._processorName = name;
    /* Inject descriptors when testing other processors. No processor runs. */
    const descriptors = options.workletParameters || { playbackRate: 1 };
    n.parameters = new Map(Object.entries(descriptors)
      .map(([key, value]) => [key, n.param(key, value, false)]));
    n.port = {
      posted: [], onmessage: null,
      postMessage(message) {
        this.posted.push(message);
        ctx.record(n, 'postMessage', { message });
      }
    };
    return n;
  };

  return rig;
}

module.exports = { createAudio, FakeAudioBuffer };
```

3. **INFERRED — Proposed `tools/check-player-audio.js`, unexecuted; bare Node, built-ins only.**

**INFERRED — HEARD PATH, check (a):** cancellation predicts a `0.5 → 1` gain jump halfway through the opener’s entrance. Before handover during overlap, it also predicts an immediate stop of the audible incoming source. After handover, the incoming deck becomes A and can jump to full gain. The check retains physical deck references and compares values captured before cancellation.

**INFERRED — Falsifier for the snap finding:** the controls establish nonterminal gains, and cancellation preserves each deck’s effective gain at the cancellation boundary. This tests selected phases, not every possible execution.

**INFERRED — Checks (b) and (c) should already pass the supplied Player.** They are invariant controls, not demonstrated old-source regressions. Calling them red→green fixes would violate your rule. Their negative mutations are stated after the code.

```js
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
```

**INFERRED — Regression strength and remaining wrong passes:**

| Check | Predicted result and falsifier | Wrong implementation that could still pass |
|---|---|---|
| **(a), HEARD PATH** | Supplied source fails during entrance and overlap. A continuity-preserving implementation passes those boundaries. Falsifier: the controlled before/after gains remain equal on the supplied source. | Refusing every replan during audible fades without ever applying the requested replacement. Continuity alone does not establish successful replanning. |
| **(b), HEARD PATH** | Supplied source passes. A mutation making the incoming shelf positive, or moving its endpoint away from `out + .55 × fade`, fails. Falsifier: such a mutation remains green. | A parallel route bypassing the shelf, or incorrect filter DSP. Reachability establishes presence, not exclusive routing or audible frequency response. |
| **(c), HEARD PATH** | Supplied source passes. Stopping only A/B misses the retained outgoing source and fails the stronger predicate. Falsifier: that mutation remains green with the fixture control passing. | A source that has a valid stop request but a browser/processor that fails to honor it. The fake records scheduling, not execution. |

**INFERRED — The literal “stopped OR connected” condition is decoration for successful Stop:** an orphan can remain connected and keep sounding. The second predicate is necessary.

**INFERRED — A gain-continuity repair must preserve values before destructive cancellation and account for an already audible incoming source.** Reading `.value` after deleting the ramp endpoint can recover the wrong value. Any decision to defer a replan, retain a fade or schedule a replacement fade is **HEARD PATH**; its musical behavior remains the keeper’s decision.

**CAN’T-TELL — No historical source demonstrating failures of (b) or (c) was supplied.** Mutation sensitivity does not establish that historical regression.

4. **INFERRED — Green remains blind to:**

- Actual PCM output: filter response, compressor behavior, clipping, phase, clicks, resampling, SoundTouch quality and worklet latency.
- Browser render quanta, control-message delivery, scheduling races, device latency, background suspension and actual `ended` delivery.
- Natural buffer exhaustion, looping and integration of playback rate/detune into source completion.
- Audibility through a graph: a path through the zero-gain analyser sink is still graph-reachable.
- Unsupported automation; the module rejects it. The module’s own semantic correctness still needs independent browser conformance measurements.
- Detector accuracy, real-library behavior and listening quality. Synthetic PCM does not establish those.

**CAN’T-TELL — The actual worklet and phrase-module implementations were not pasted.** This design does not validate them.