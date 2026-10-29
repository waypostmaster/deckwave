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
