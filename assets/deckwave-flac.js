/* ─────────────────────────────────────────────────────────────────────────
   DECKWAVE · FLAC DECODE FALLBACK

   `decodeAudioData` is the browser's decoder, and what it accepts is the
   browser's decision. On Chromium it has taken every file in this library.
   On WebKit — every browser on iOS — whether it takes FLAC at all is not
   established from the public record (2026-08-19: forum threads both ways,
   nothing authoritative), and this project does not design around a
   capability it has not seen. So: try the browser first, and if it refuses
   a FLAC, decode it here with the libflac build that is already vendored
   for export. Same library, other direction.

   WHAT THIS IS NOT. It is not a second decode path for files the browser
   already decodes — those never reach it. It is not a resampler: the PCM
   comes back at the FILE's rate, and the engine resamples to its own 44100
   with an OfflineAudioContext when they differ. That step only ever runs
   for a file the browser would otherwise have dropped, so it changes no
   measurement that exists today; it is written down here because it is a
   detector input for any file that takes this path.

   MEASURED BEFORE IT SHIPPED, in Node against the corpus cache: a 16-bit
   44.1k file and a 24-bit 48k file decode to the duration the cache holds
   and to an excerpt RMS within 0.1% of the figure Chromium's decoder gave
   (`tools/check-flac.js`, with the falsifier stated in the file).

   Sample packing: libflac.js hands the write callback one Uint8Array per
   channel, little-endian two's complement — but NOT always bitsPerSample/8
   bytes per sample (24-bit arrives as 4-byte int32). The stride is taken
   from the buffer's own length; see the note in write(). Anything the
   stride does not explain is refused rather than guessed.
   ───────────────────────────────────────────────────────────────────────── */

window.DWFLAC = (function () {
'use strict';

let ready = null;
/* Same loader shape as DWRENDER.boot, same source of truth for the path
   (DW.assets). Kept separate so this module does not depend on the render
   module being loaded — a phone that only ever decodes never needs it. */
function boot(url) {
  if (window.Flac) return ensureReady(window.Flac);
  if (ready) return ready;
  ready = new Promise((ok, no) => {
    const s = document.createElement('script');
    const A = window.DW && window.DW.assets;
    s.src = url || (A ? A.base + A.files.flac : 'vendor/libflac.min.js');
    s.onload = () => {
      if (!window.Flac) return no(new Error('libflac loaded but Flac is undefined'));
      ensureReady(window.Flac).then(ok, no);
    };
    s.onerror = () => no(new Error('could not load ' + s.src + ' — is vendor/ present?'));
    document.head.appendChild(s);
  });
  return ready;
}
function ensureReady(Flac) {
  if (Flac.isReady && Flac.isReady()) return Promise.resolve(Flac);
  return new Promise(ok => {
    Flac.onready = () => ok(Flac);
    setTimeout(() => ok(Flac), 4000);   /* older builds never fire onready */
  });
}

const isFlac = u8 => u8.length > 4 && u8[0] === 0x66 && u8[1] === 0x4c && u8[2] === 0x61 && u8[3] === 0x43;

/* Decode a whole FLAC (ArrayBuffer) to planar Float32 channels.
   Resolves { sampleRate, numberOfChannels, length, channels, bitsPerSample }.
   Yields to the event loop every `yieldEvery` frames so a long file does not
   freeze the page — decode is called while a set is playing. */
function decode(arrayBuffer, opts) {
  opts = opts || {};
  const Flac = window.Flac;
  if (!Flac) return Promise.reject(new Error('libflac not loaded — call DWFLAC.boot() first'));
  const src = arrayBuffer instanceof Uint8Array ? arrayBuffer : new Uint8Array(arrayBuffer);
  if (!isFlac(src)) return Promise.reject(new Error('not a FLAC stream (no fLaC marker)'));

  return new Promise((ok, no) => {
    let pos = 0, sr = 0, ch = 0, bps = 0, total = 0, filled = 0;
    let chans = null, err = null;
    const read = n => {
      if (pos >= src.length) return { buffer: null, readDataLength: 0, error: false };
      const end = Math.min(src.length, pos + n);
      const b = src.subarray(pos, end); pos = end;
      return { buffer: b, readDataLength: b.length, error: false };
    };
    const meta = m => {
      /* STREAMINFO arrives first; size the output from it. total_samples can
         legitimately be 0 for a stream of unknown length, so grow if needed. */
      sr = m.sampleRate; ch = m.channels; bps = m.bitsPerSample; total = m.total_samples || 0;
      if (bps !== 8 && bps !== 16 && bps !== 24 && bps !== 32) { err = new Error('unsupported FLAC bit depth ' + bps); return; }
      chans = []; for (let c = 0; c < ch; c++) chans.push(new Float32Array(total));
    };
    const write = (bufs, fh) => {
      if (err) return;
      if (!chans) { sr = fh.sampleRate; ch = fh.channels; bps = fh.bitsPerSample; chans = []; for (let c = 0; c < ch; c++) chans.push(new Float32Array(0)); }
      const n = fh.blocksize, scale = 1 / Math.pow(2, bps - 1);
      if (filled + n > chans[0].length) {
        /* unknown or wrong total_samples — grow geometrically */
        const want = Math.max(filled + n, Math.ceil(chans[0].length * 1.5) + 65536);
        for (let c = 0; c < ch; c++) { const g = new Float32Array(want); g.set(chans[c]); chans[c] = g; }
      }
      for (let c = 0; c < ch; c++) {
        const u = bufs[c], out = chans[c];
        /* THE STRIDE IS WHAT THE BUFFER SAYS, NOT bps/8. libflac.js 5.x
           packs 16-bit as 2 bytes per sample but 24-bit as the raw FLAC__int32
           — 4 bytes per sample, because its write path pads odd byte widths
           (3 → 4) and skips its byte-fixing heuristic for 24-bit. Reading
           24-bit at a 3-byte stride was 15–39% off on the two 24-bit files in
           this library (tools/check-flac.js caught it); deriving the stride
           from u.length / blocksize is right for every width it produces. */
        const stride = Math.round(u.length / n), top = 1 << (stride * 8 - 1), full = top * 2;
        if (stride === 2) {
          for (let i = 0, p = 0; i < n; i++, p += 2) { let v = u[p] | (u[p + 1] << 8); if (v & 0x8000) v -= 0x10000; out[filled + i] = v * scale; }
        } else if (stride === 4) {
          for (let i = 0, p = 0; i < n; i++, p += 4) { const v = (u[p] | (u[p + 1] << 8) | (u[p + 2] << 16) | (u[p + 3] << 24)) | 0; out[filled + i] = v * scale; }
        } else if (stride === 3) {
          for (let i = 0, p = 0; i < n; i++, p += 3) { let v = u[p] | (u[p + 1] << 8) | (u[p + 2] << 16); if (v & 0x800000) v -= 0x1000000; out[filled + i] = v * scale; }
        } else if (stride === 1) {
          for (let i = 0; i < n; i++) { let v = u[i]; if (v & top) v -= full; out[filled + i] = v * scale; }
        } else { err = new Error('unexpected sample stride ' + stride + ' for ' + bps + '-bit'); return; }
      }
      filled += n;
    };
    const onErr = (code, msg) => { err = new Error('libflac: ' + (msg || code)); };

    const dec = Flac.create_libflac_decoder(false);
    if (!dec) return no(new Error('libflac decoder init failed'));
    const st = Flac.init_decoder_stream(dec, read, write, onErr, meta, false);
    if (st !== 0) { try { Flac.FLAC__stream_decoder_delete(dec); } catch (e) {} return no(new Error('init_decoder_stream ' + st)); }

    const yieldEvery = opts.yieldEvery || 400;
    const finish = () => {
      try { Flac.FLAC__stream_decoder_finish(dec); } catch (e) {}
      try { Flac.FLAC__stream_decoder_delete(dec); } catch (e) {}
      if (err) return no(err);
      if (!chans || !filled) return no(new Error('libflac produced no audio'));
      const out = chans.map(c => c.length === filled ? c : c.subarray(0, filled));
      ok({ sampleRate: sr, numberOfChannels: ch, length: filled, channels: out, bitsPerSample: bps });
    };
    const step = () => {
      let k = 0, more = true;
      while (more && k < yieldEvery && !err) {
        more = !!Flac.FLAC__stream_decoder_process_single(dec);
        const state = Flac.FLAC__stream_decoder_get_state(dec);
        if (state > 3) more = false;      /* 4 = end of stream, higher = error states */
        k++;
      }
      if (opts.onProgress && total) opts.onProgress(Math.min(1, filled / total));
      /* A THROW AFTER THE FIRST STEP MUST REJECT THE DECODE, not vanish
         (review 2026-09-01). `step` runs inside a `.then` from the second
         chunk on, so anything that threw there — a libflac state the
         unpacker refuses, an allocation failure on a phone, a caller's own
         onProgress — rejected an intermediate promise nobody held: the
         decode promise never settled, the scan sat on that track forever
         and no failure was ever counted. `.catch(no)` is the whole fix;
         `finish()` is inside the chain too, so it is covered as well. */
      if (more && !err) yieldNow().then(step).catch(no); else finish();
    };
    step();
  });
}

/* Yield to the event loop WITHOUT a timer. A backgrounded tab throttles
   setTimeout to once a second and, after five minutes hidden, once a MINUTE
   — a 200-frame decode chained on setTimeout(0) then takes longer than the
   track. A MessageChannel message is a plain macrotask and is not throttled
   that way; it is also what scheduler.yield() falls back to. */
function yieldNow() {
  return new Promise(r => {
    if (typeof MessageChannel === 'function') {
      const mc = new MessageChannel();
      mc.port1.onmessage = () => { mc.port1.close(); r(); };
      mc.port2.postMessage(0);
    } else setTimeout(r, 0);
  });
}

/* Planar PCM → AudioBuffer on the given context, at the PCM's own rate. */
function toAudioBuffer(ctx, pcm) {
  const b = ctx.createBuffer(pcm.numberOfChannels, pcm.length, pcm.sampleRate);
  for (let c = 0; c < pcm.numberOfChannels; c++) {
    if (b.copyToChannel) b.copyToChannel(pcm.channels[c], c);
    else b.getChannelData(c).set(pcm.channels[c]);
  }
  return b;
}

/* Resample an AudioBuffer to `rate` with the browser's own resampler — the
   same machinery decodeAudioData uses to land a 48k file on a 44.1k context.
   Only ever called for a file the browser refused to decode itself. */
async function resample(buf, rate) {
  if (buf.sampleRate === rate) return buf;
  const len = Math.ceil(buf.length * rate / buf.sampleRate);
  const off = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(buf.numberOfChannels, len, rate);
  const s = off.createBufferSource(); s.buffer = buf; s.connect(off.destination); s.start(0);
  return off.startRendering();
}

return { boot, decode, toAudioBuffer, resample, isFlac };
})();
