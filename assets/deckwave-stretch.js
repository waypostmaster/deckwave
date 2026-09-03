/* ─────────────────────────────────────────────────────────────────────────
   DECKWAVE · STRETCH — one held block around the SoundTouch 2.1.1 worklet

   THIS FILE RUNS IN THE AUDIO WORKLET SCOPE, NOT THE PAGE. It needs the
   `SoundTouchProcessor` class from `vendor/soundtouch-processor.js` in the
   same scope, and the primary way that happens is
   `assets/deckwave-stretch.module.js` — the vendored text and this file
   CONCATENATED into a checked-in file the Player loads like any other
   same-origin script (check-player asserts the concatenation identity, so
   it cannot drift; regenerating it is `cat`, not a build step). The blob:
   route — fetch both texts, join, addModule a Blob URL — is the fallback
   for a deployment missing that file; it was the primary until 2026-08-19
   late, when the keeper's demo playthrough popped and nobody could say
   whether the phone had even accepted the blob. If both fail the Player
   loads the vendored module alone and builds decks on
   `soundtouch-processor` exactly as before; the first play's log line and
   the now-playing card say which.

   WHY (BUILD-LOG ledger 65). Driven offline with 128-frame quanta, the
   2.1.1 pipe zero-fills a block — a 2.9 ms click — whenever its WSOLA
   output burst lands one render block late against the extraction cadence:
   0 per 150 s at exactly ×1.000, 3 at ×1.0012, 9 at ×1.05, 3 at ×0.95,
   identical on a sine and on DOOMSDAY's and GIANA SISTERS' own audio. The
   keeper heard "limited poppy static" on that pair on the iPhone, a ×1.001
   chained deck. Holding ONE block of output before the first extraction
   (2.9 ms of latency, on every deck equally, so nothing about alignment
   moves) gave 0 gaps at every rate over 180 s; a larger hold added nothing.
   `tools/measure-worklet.js` reproduces all of it.

   WHAT ELSE IT DOES. Counts gaps AFTER priming (the vendored counter also
   counts the ~50 silent warm-up blocks every deck pays under its gain ramp,
   which is not a defect) and posts them with the vendored metrics every 100
   blocks, so the Player can print "N gaps" per deck — the instrument that
   says whether a pop heard on the phone is a gap counted here or the
   phone's own render thread.

   processCore below is the vendored one with two lines added; the pitch
   formula, the interleave, the extract call are byte-for-byte its own.
   HOLD is a count of render blocks, not a calibration: it was measured at
   1 and 2 (both zero gaps) and 0 (the vendored behaviour). Since
   2026-09-01 the wrapper also answers a {type:'release'} message by
   returning false from process() — the vendored one never does, and a
   node that never returns false is never collected (ledger 124).

   LICENCE. In `assets/deckwave-stretch.module.js` everything ABOVE this
   comment is SoundTouchJS 2.1.1's AudioWorklet processor
   (`vendor/soundtouch-processor.js`, unmodified), © its authors, under
   the Mozilla Public License 2.0 — the full text is
   `vendor/LICENSE.soundtouch-processor.txt`, provenance and hash in
   `vendor/README.md` and `NOTICE`. That seam is the only place the two
   texts meet. Everything from this comment down is Deckwave's wrapper,
   under the project LICENSE (AGPL-3.0); the two lines it adds inside the
   vendored processCore are described above and are the whole of the
   Modification in MPL terms. This paragraph is here, in the wrapper,
   because check-player pins the module as vendored text + newline + this
   file, so a notice hand-added to the module would be a drift.
   ───────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';
  if (typeof SoundTouchProcessor === 'undefined' || typeof registerProcessor !== 'function') return;
  const HOLD = 1;
  class DeckwaveStretch extends SoundTouchProcessor {
    constructor(options) {
      super(options);
      this._primed = false;     /* first extraction not yet made */
      this._after = 0;          /* full blocks seen since the first burst */
      this._gaps = 0;           /* zero-filled blocks AFTER priming — the number that matters */
      /* THE DOOR OUT (2026-09-01, review H2, ledger 124). The vendored
         process() returns true unconditionally — "always true to keep the
         processor alive" — so a node built on it is never collected: after
         a handover it kept running WSOLA on silence, and its port handler
         kept the deck, the source and the decoded buffer reachable (~87 MB
         per handover, measured). The Player posts {type:'release'} when a
         deck's source has ended; from the next block process() returns
         false and the node can go. The vendored handler is CHAINED, not
         replaced: its own messages still reach it. */
      this._released = false;
      const vendored = this.port ? this.port.onmessage : null;
      if (this.port) this.port.onmessage = (event) => {
        if (event && event.data && event.data.type === 'release') { this._released = true; return; }
        if (vendored) vendored(event);
      };
    }
    process(inputs, outputs, parameters) {
      if (this._released) return false;
      return super.process(inputs, outputs, parameters);
    }
    processCore(inputs, outputs, parameters) {
      const input = inputs[0];
      const output = outputs[0];
      if (!input || !input.length || !output[0] || !output[0].length) return null;
      const leftInput = input[0];
      const rightInput = input.length > 1 ? input[1] : input[0];
      const leftOutput = output[0];
      const rightOutput = output.length > 1 ? output[1] : output[0];
      const frameCount = leftInput.length;
      if (this._samples.length < frameCount * 2) {
        this._samples = new Float32Array(frameCount * 2);
        this._outputSamples = new Float32Array(frameCount * 2);
      }
      this.beforePipeProcess(leftInput, rightInput, frameCount, parameters);
      const pitch = parameters['pitch'][0];
      const pitchSemitones = parameters['pitchSemitones'][0];
      const playbackRate = parameters['playbackRate'][0];
      this._pipe.pitch = pitch * Math.pow(2, pitchSemitones / 12) / playbackRate;
      const samples = this._samples;
      for (let i = 0; i < frameCount; i++) {
        samples[i * 2] = leftInput[i];
        samples[i * 2 + 1] = rightInput[i];
      }
      this._pipe.inputBuffer.putSamples(samples, 0, frameCount);
      this._pipe.process();
      const available = this._pipe.outputBuffer.frameCount;
      this._blockCount++;
      /* ── the held block: the two added lines ──────────────────────── */
      if (!this._primed) {
        if (available >= frameCount) { this._after++; if (this._after > HOLD) this._primed = true; }
        if (!this._primed) { leftOutput.fill(0); rightOutput.fill(0); return null; }
      }
      const toExtract = Math.min(available, frameCount);
      if (available < frameCount) { this._underrunCount++; this._gaps++; }
      const { outputRms, outputPeak } = this.extractSamples(leftOutput, rightOutput, frameCount, toExtract, parameters);
      return { frameCount, toExtract, available, leftInput, rightInput, leftOutput, rightOutput, outputRms, outputPeak };
    }
    onProcessComplete(result) {
      if (this._blockCount % 100 === 0) this.port.postMessage({
        type: 'metrics',
        framesBuffered: result.available,
        underrunCount: this._underrunCount,
        gaps: this._gaps,                 /* after priming — see the header */
        blockCount: this._blockCount,
        outputRms: result.outputRms,
        outputPeak: result.outputPeak
      });
    }
  }
  registerProcessor('deckwave-stretch', DeckwaveStretch);
})();
