/* DECKWAVE — corpus analysis + beat-locked automatic DJ, in the browser.
   No build step or toolchain: plain scripts, served as files. It CAN still be
   pasted into a console or loaded via javascript_exec — that is how it was
   built, and why everything hangs off window — but index.html is how it runs.

   Pipeline:  scan a folder -> analyse each track (Essentia) -> cache to IndexedDB
              -> sequence by key/tempo/energy -> play beat-locked with lazy decode.

   Everything runs locally. No audio is uploaded, bundled, or fetched.        */

window.DW = (function () {
'use strict';

/* ── where the dependencies come from ───────────────────────────────────
   SELF-HOSTED BY DEFAULT, and the default matters.

   These libraries do not run in a sandbox. They execute in a page that is
   holding live FileSystemDirectoryHandle objects for the user's music folder
   and has ordinary network access. A compromised or MITM'd CDN response
   inherits both. Dynamically-injected scripts cannot carry an integrity
   attribute, so there is no SRI to fall back on — the only real control is
   not fetching third-party code at runtime.

   vendor/ holds all four, pinned to exact versions with recorded sha256s.
   See vendor/README.md.

   allowCDN exists for one case: pasting this engine into a page that has no
   vendor/ next to it, which is how the whole thing was originally built. It
   is opt-in and deliberately noisy, because turning it on reintroduces
   exactly the exposure above:

       DW.assets.allowCDN = true;                     // then scan()

   Setting `base` is the better answer when the files live elsewhere. */
const ASSETS = {
  base: 'vendor/',
  allowCDN: false,
  files: {
    essentiaWasm: 'essentia-wasm.web.js',
    essentiaCore: 'essentia.js-core.js',
    soundtouch:   'soundtouch-processor.js',
    flac:         'libflac.min.js'
  }
};
const CDN = {
  essentiaWasm: 'https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia-wasm.web.js',
  essentiaCore: 'https://cdn.jsdelivr.net/npm/essentia.js@0.1.3/dist/essentia.js-core.js',
  /* PINNED to 2.1.1 (MPL-2.0). Note the directory is ".dist", with a leading
     dot — that is genuinely the published layout, and it is why the old
     unpinned /dist/ path could never resolve to a 2.x release and silently
     served 0.3.0 (LGPL-2.1) instead. See vendor/README.md.
     0.3.0 dropped samples on every stretched deck; see makeDeck. */
  soundtouch:   'https://cdn.jsdelivr.net/npm/@soundtouchjs/audio-worklet@2.1.1/.dist/soundtouch-processor.js',
  flac:         'https://cdn.jsdelivr.net/npm/libflacjs@5.4.0/dist/libflac.min.js'
};
const assetURL = k => ASSETS.base + ASSETS.files[k];
const AC = window.AudioContext || window.webkitAudioContext;
const script = s => new Promise((ok, no) => {
  const e = document.createElement('script'); e.src = s;
  e.onload = () => ok(s); e.onerror = () => no(new Error('load failed: ' + s));
  document.head.appendChild(e);
});

/* Try the vendored copy first. Fall back to the CDN only if explicitly
   allowed, and say so in the console when it happens — a silent fallback to
   remote code is the failure this is meant to prevent. */
async function loadAsset(k) {
  try { return await script(assetURL(k)); }
  catch (e) {
    if (!ASSETS.allowCDN)
      throw new Error('missing ' + assetURL(k) +
        ' — vendor/ is not present. Fetch it (see vendor/README.md), or set ' +
        'DW.assets.allowCDN = true to load third-party code from a CDN instead.');
    console.warn('deckwave: falling back to CDN for ' + k + ' — remote code, no integrity check');
    return script(CDN[k]);
  }
}
/* Strip only a KNOWN audio extension, never "whatever follows the last dot".
   This key is built from a File name (which has an extension) and looked up
   from a meta name (which does not), so it has to be idempotent — and
   /\.[^.]+$/ is not. On a stem containing a dot it ate a real part of the
   title the second time round:

     'DRUID II … (1987) David M. Hanlon.flac' -> '…david m. hanlon'   (File)
     'DRUID II … (1987) David M. Hanlon'      -> '…david m'           (meta)

   Two different keys for one track, so find() returned undefined and the
   player reported a missing file for something sitting on disk. Keep this
   list in step with AUDIO_EXT below. */
const norm = s => s.toLowerCase().replace(/\.(flac|mp3|wav|aiff|m4a|ogg|opus|oga)$/, '')
  .replace(/[^a-z0-9]/g, '');

/* ── cache ─────────────────────────────────────────────────────────────── */
const DB = (() => {
  let db = null;
  const open = () => new Promise((ok, no) => {
    const r = indexedDB.open('deckwave', 1);
    r.onupgradeneeded = e => { const d = e.target.result;
      if (!d.objectStoreNames.contains('f')) d.createObjectStore('f', { keyPath: 'id' }); };
    r.onsuccess = e => { db = e.target.result; ok(db); };
    r.onerror = () => no(r.error);
  });
  return {
    async get(id) { if (!db) await open(); return new Promise(ok => {
      const t = db.transaction('f', 'readonly').objectStore('f').get(id);
      t.onsuccess = () => ok(t.result || null); t.onerror = () => ok(null); }); },
    async put(rec) { if (!db) await open(); return new Promise(ok => {
      const t = db.transaction('f', 'readwrite').objectStore('f').put(rec);
      t.onsuccess = () => ok(true); t.onerror = () => ok(false); }); },
    async all() { if (!db) await open(); return new Promise(ok => {
      const t = db.transaction('f', 'readonly').objectStore('f').getAll();
      t.onsuccess = () => ok(t.result || []); t.onerror = () => ok([]); }); }
  };
})();

/* ── harmonic mixing ───────────────────────────────────────────────────── */
const CAMELOT_MAJOR = { C:8, G:9, D:10, A:11, E:12, B:1, 'F#':2, Gb:2, Db:3, 'C#':3,
                        Ab:4, 'G#':4, Eb:5, 'D#':5, Bb:6, 'A#':6, F:7 };
/* THE DECKWAVE TUNE, and how it happened. This minor table is a copy of the
   MAJOR one — every minor key gets the number of the major sharing its
   TONIC (A minor = 11A beside A major = 11B), where the standard Camelot
   wheel gives it the number of the major sharing its KEY SIGNATURE
   (A minor = 8A beside C major = 8B). Uniformly +3 from the standard.
   The consequence: camScore's 0.85 "same number, other letter" bonus pays
   PARALLEL pairs here, and true relative pairs fall to the 0.08 floor.
   Found by the 2026-08-29 cloud review (docs/research/
   ultra-review-2026-08-29.md, E1); sized here: the offset cancels within a
   mode, so only major↔minor pairs can differ — 18.8% of ordered pairs on
   the keeper's 196-minor/23-major corpus, of which 3.2% actually score
   differently (measured; same-mode pairs differing: 0).
   IT STAYS THE DEFAULT, keeper's decision the same day: every set this
   deck has ever played — including the by-ear confirmations — was built on
   this table, and "correct against the standard" is not the same claim as
   "sounds better on this corpus". The standard wheel is one select away
   (`tune` in ⚙ → DW.retune), unheard until an A/B says otherwise. */
const CAMELOT_MINOR_DECKWAVE = { A:11, E:12, B:1, 'F#':2, Gb:2, Db:3, 'C#':3, Ab:4, 'G#':4,
                        Eb:5, 'D#':5, Bb:6, 'A#':6, F:7, C:8, G:9, D:10 };
/* the standard wheel: minor shares its number with its RELATIVE major */
const CAMELOT_MINOR_STANDARD = { A:8, E:9, B:10, 'F#':11, Gb:11, Db:12, 'C#':12, Ab:1, 'G#':1,
                        Eb:2, 'D#':2, Bb:3, 'A#':3, F:4, C:5, G:6, D:7 };
let tuneMode = 'deckwave';
try { if (localStorage.getItem('dw-tune') === 'standard') tuneMode = 'standard'; } catch (e) {}
function camelot(key, scale) {
  const MINOR = tuneMode === 'standard' ? CAMELOT_MINOR_STANDARD : CAMELOT_MINOR_DECKWAVE;
  const n = /min/i.test(scale) ? MINOR[key] : CAMELOT_MAJOR[key];
  return n ? n + (/min/i.test(scale) ? 'A' : 'B') : '?';
}
/* 1.0 identical · .92 adjacent (perfect fifth) · .85 relative · .45 two steps */
function camScore(a, b) {
  if (!a || !b || a === '?' || b === '?') return 0.25;
  if (a === b) return 1;
  const na = +a.slice(0, -1), la = a.slice(-1), nb = +b.slice(0, -1), lb = b.slice(-1);
  if (isNaN(na) || isNaN(nb)) return 0.25;
  if (na === nb) return 0.85;
  const d = Math.min(Math.abs(na - nb), 12 - Math.abs(na - nb));
  if (la === lb && d === 1) return 0.92;
  if (la === lb && d === 2) return 0.45;
  return 0.08;
}
/* Switch tunes and RESTAMP the corpus from stored key+scale — camelot is
   written onto each record at analyse time, so changing only the table
   would leave a MIXED corpus (cached codes in one tune, new analyses in
   the other) scored against itself, which is worse than either consistent
   state. No audio is touched; the analysis cache is never rewritten
   (ingest restamps on the way in). Scores and built sets keep their order
   until the next build — camScore ran at build time. */
function retune(mode) {
  tuneMode = mode === 'standard' ? 'standard' : 'deckwave';
  try { localStorage.setItem('dw-tune', tuneMode); } catch (e) {}
  let restamped = 0;
  for (const m of corpus) {
    const c = camelot(m.key, m.scale);
    if (c !== m.camelot) { m.camelot = c; restamped++; }
  }
  return { mode: tuneMode, restamped, corpus: corpus.length };
}

/* ── analysis ──────────────────────────────────────────────────────────── */
let essentia = null;
async function bootEssentia() {
  if (essentia) return essentia;
  /* index.html already loads both from vendor/ with plain <script> tags, so
     in the normal case there is nothing to fetch here at all. This used to
     inject the CDN copies unconditionally and load Essentia twice. */
  if (typeof window.EssentiaWASM === 'undefined' || typeof window.Essentia === 'undefined') {
    await loadAsset('essentiaWasm');
    await loadAsset('essentiaCore');
  }
  essentia = new Essentia(await EssentiaWASM());
  return essentia;
}

/* ── decode, with a fallback the browser does not own ──────────────────
   decodeAudioData first, always — it is the browser's decoder and on
   Chromium it has taken every file in this library. If it REFUSES a FLAC,
   decode it with the vendored libflac (DWFLAC) instead and resample to the
   context's rate with the browser's own resampler, which is what
   decodeAudioData does to a 48 kHz file anyway.

   Why this exists: on WebKit — every browser on iOS — whether decodeAudioData
   accepts FLAC is not established, and the project does not design around an
   unseen capability. It also catches any odd FLAC a desktop decoder balks at.
   Measured before it shipped (tools/check-flac.js): the fallback's samples
   match Chromium's to within 0.006% RMS on 16-bit, 24-bit and 48 kHz files.

   decodeAudioData DETACHES the ArrayBuffer it is given, so the fallback reads
   the file a second time rather than keeping a copy of every file in memory
   on the off chance. The returned buffer carries `_decoder` so the audit can
   say which path a file took. */
async function decodeAudio(ctx, file) {
  let nativeErr;
  try { const b = await ctx.decodeAudioData(await file.arrayBuffer()); b._decoder = 'native'; return b; }
  catch (e) { nativeErr = e; }
  const F = window.DWFLAC;
  if (!F) throw nativeErr;
  const u8 = new Uint8Array(await file.arrayBuffer());
  if (!F.isFlac(u8)) throw nativeErr;
  await F.boot();
  const pcm = await F.decode(u8);
  let b = F.toAudioBuffer(ctx, pcm);
  if (b.sampleRate !== ctx.sampleRate) b = await F.resample(b, ctx.sampleRate);
  b._decoder = 'libflac';
  return b;
}

/* Bumped when the meaning of a stored record changes, so stale ones are
   re-analysed instead of silently reused. The cache key is name|size|mtime,
   which does not change when OUR analysis does — v1 records hold a beat grid
   that is excerpt-relative and stops at 120s, and nothing about the file
   would ever have told us to discard them. */
const ANALYSIS_V = 2;

/* Decode, analyse, DISCARD the buffer. Only features are kept.

   THE GRID IS NOW TAKEN FROM THE WHOLE TRACK, and this is the fix for the
   worst defect this project has had.

   What was here: rhythm and key were both run on a CENTRED 120-SECOND
   EXCERPT, and Essentia returns tick times relative to the signal it was
   handed. Those excerpt-relative times were stored and then used as absolute
   positions in the file. Two consequences, both silent:

     · No grid reached past 120s. Measured across 219 cached records, the
       latest beat anywhere was 119.9s. downbeatNear() cannot say "I have
       nothing near the exit", so it returned the last downbeat it had and
       tracks blended there. Median coverage 60.6%; 236.7 minutes of music
       never played; worst case 371.8s skipped from a 507s track.
     · entry = beats[0], and chain() starts the incoming deck at that offset
       ON the outgoing deck's downbeat. That IS the beat alignment. With an
       excerpt-relative grid the offset is a beat from the middle of the track
       applied near the start, so the incoming track enters at an arbitrary
       phase and its kicks land beside the outgoing track's. Inaudible when a
       track is played alone, audible as popping through a mix — which is
       exactly the difference the keeper found between jumping to a track and
       arriving at it.

   KEY, RMS AND ZCR STILL USE THE CENTRED EXCERPT, deliberately. They are not
   broken, their values are calibrated, and the energy index is built from rms.
   Changing what they see would change every one of those numbers for no
   reason connected to this defect.

   BPM AND CONFIDENCE WILL CHANGE, because the rhythm extractor now sees the
   whole track instead of 120 seconds of it. That is unavoidable — it is the
   same detector reading more signal — and it is why ANALYSIS_V exists. */
async function analyse(file, excerptSec) {
  const id = file.name + '|' + file.size + '|' + (file.lastModified || 0);
  const hit = await DB.get(id);
  if (hit && hit.v === ANALYSIS_V) return Object.assign({ cached: true }, hit);

  const ctx = new AC({ sampleRate: 44100 });
  let buf; try { buf = await decodeAudio(ctx, file); }
  catch (e) { ctx.close(); throw new Error('decode: ' + e.message); }
  const decoder = buf._decoder;

  /* ── ORDER OF OPERATIONS IS ABOUT PEAK MEMORY, NOT ABOUT THE NUMBERS ──
     Every figure below is computed from exactly the same samples in exactly
     the same arithmetic as before 2026-08-19 (the excerpt is a slice of the
     whole-track mono, which is the same per-sample sum over channels in the
     same order, so it is bit-identical to the old per-channel excerpt loop).
     What changed is WHEN things are alive. The old order held the decoded
     AudioBuffer (stereo float, 2× the mono), the excerpt, its WASM copy and
     the whole-track mono plus ITS WASM copy all at once through the rhythm
     pass — peak 851 MB on this library, set by the longest track. Now the
     decoded buffer is dropped before any WASM allocation, the whole-track
     mono is dropped before the key pass, and the excerpt's WASM copy is not
     made until the rhythm copy is gone. On a desktop that is tidiness; on a
     phone, where the tab is killed rather than swapped, it is the
     difference between analysing a long track and not. Whether it is
     ENOUGH for iOS is unmeasured — no one has run this on an iPhone. */
  const sr = buf.sampleRate, dur = buf.duration, chs = buf.numberOfChannels;
  let full = new Float32Array(buf.length);
  for (let c = 0; c < chs; c++) { const d = buf.getChannelData(c);
    for (let i = 0; i < full.length; i++) full[i] += d[i] / chs; }
  ctx.close(); buf = null;                                   /* ← decoded audio gone before WASM */

  const want = Math.min(dur, excerptSec || 120);
  const start = Math.max(0, Math.floor((dur - want) / 2 * sr));
  const n = Math.floor(want * sr);
  const mono = full.slice(start, start + n);                /* a COPY, not a view: the WASM bridge gets a plain Float32Array */

  let sum = 0, zc = 0;
  for (let i = 1; i < n; i++) { sum += mono[i] * mono[i];
    if ((mono[i] >= 0) !== (mono[i - 1] >= 0)) zc++; }

  const E = await bootEssentia();
  let bpm = 0, conf = 0, beats = [], key = '?', scale = '?', kstr = 0;

  /* Rhythm over the WHOLE track, in its own vector, so the ticks come back
     relative to the start of the file — which is what every consumer of this
     grid already assumes. */
  let fvec = E.arrayToVector(full);
  full = null;                                               /* the JS copy is not needed once WASM has one */
  let rhythmErr = null;
  try {
    const r = E.RhythmExtractor2013(fvec, 208, 'multifeature', 40);
    bpm = r.bpm; conf = r.confidence; beats = E.vectorToArray(r.ticks);
    ['ticks','estimates','bpmIntervals'].forEach(k => { if (r[k] && r[k].delete) r[k].delete(); });
  } catch (e) { console.warn('rhythm', file.name, e); rhythmErr = e; }
  if (fvec.delete) fvec.delete();
  fvec = null;
  /* A throw here (the WASM out-of-memory the note above this function
     anticipates on a phone with a long track) used to leave bpm 0 and an
     empty grid, and the record was then CACHED at the current version and
     counted as added — every later load a cache hit, the pool filter and
     classify() dropping it, the track in no set, no unlocked list, no
     report, forever (review 2026-09-01 M6, ledger 123). A failed analysis
     is a failure: ingest counts it, warns with the name, and the next load
     tries again. */
  if (rhythmErr) throw new Error('rhythm extraction failed: ' + ((rhythmErr && rhythmErr.message) || rhythmErr));

  /* KEY, RMS AND ZCR STILL USE THE CENTRED EXCERPT, deliberately — see the
     note above this function. */
  let vec = E.arrayToVector(mono);
  try {
    const k = E.KeyExtractor(vec, true, 4096, 4096, 12, 3500, 60, 25, .2, 'bgate', sr, .0001, 440, 'cosine', 'hann');
    key = k.key; scale = k.scale; kstr = k.strength;
  } catch (e) { console.warn('key', file.name, e); }
  if (vec.delete) vec.delete();
  vec = null;

  const rec = { id, name: file.name.replace(/\.[^.]+$/, ''),
    bpm: +bpm.toFixed(2), conf: +conf.toFixed(3),
    /* Array.from, NOT .slice().map() — vectorToArray returns a Float32Array and
       both slice() and map() preserve that type. A Float32Array survives the
       structured clone into IndexedDB, so .length and .map() keep working and
       nothing looks wrong. It does NOT survive JSON: stringify emits an object
       ({"0":0.38,...}), and the parsed result has no .length and no .map. That
       silently breaks every cache export ever written. Store a plain Array. */
    /* Cap raised from 900. It existed to bound the cache, and against a 120s
       excerpt nothing ever came close — 0 of 219 records reached it. A grid
       for a whole track does: 507s at 100bpm is ~845 beats, and faster or
       longer material passes 900 easily, so the old cap would have quietly
       reintroduced the same truncation this change exists to remove. 4000
       covers 24 minutes at 170bpm. Storage, not a detector threshold. */
    beats: Array.from(beats.slice(0, 4000), x => +x.toFixed(4)),
    v: ANALYSIS_V,
    key, scale, camelot: camelot(key, scale), kstr: +kstr.toFixed(3),
    rms: Math.sqrt(sum / n), zcr: zc / n, dur: +dur.toFixed(1), size: file.size };
  if (decoder === 'libflac') rec.decoder = 'libflac';      /* only when the browser refused it */
  /* DB.put resolves false on a refused write (quota, private mode). The
     record is still good for this session; it just will not be there next
     load. Say so on the record so ingest can count it, instead of a phone
     re-analysing its whole library every launch with `cached: 0` and no
     reason on screen (review 2026-09-01). */
  if (!(await DB.put(rec))) rec.uncached = true;
  return rec;
}

/* One list of accepted types, used by the folder walk and by the file picker
   so they can never disagree about what counts as audio. */
/* .opus/.oga joined 2026-08-29: the DWLIBRE Commons path ingests any
   filetype:audio hit WITHOUT this gate, and norm() only strips extensions
   it knows — a Commons Song.opus was keyed 'songopus' in LIB.files while
   analyse() named the record 'Song', so find() missed and playback said
   'missing file' on a track the panel had just called added (ultra review
   E2). norm()'s list and this one must agree; both now do. */
const AUDIO_EXT = ['.flac', '.mp3', '.wav', '.aiff', '.m4a', '.ogg', '.opus', '.oga'];
const AUDIO_RE = new RegExp('\.(' + AUDIO_EXT.map(e => e.slice(1)).join('|') + ')$', 'i');

async function walk(dir, out, depth) {
  out = out || []; depth = depth || 0; if (depth > 6) return out;
  for await (const e of dir.values()) {
    if (e.kind === 'file') { if (AUDIO_RE.test(e.name)) out.push(await e.getFile()); }
    else if (e.kind === 'directory') await walk(e, out, depth + 1);
  } return out;
}

/* Energy is a CONSTRUCTED INDEX, normalised across the corpus — not a measurement. */
function normalise(corpus) {
  if (!corpus.length) return corpus;
  const R = corpus.map(t => t.rms), Z = corpus.map(t => t.zcr);
  const lo = Math.min(...R), hi = Math.max(...R), zl = Math.min(...Z), zh = Math.max(...Z);
  corpus.forEach(t => {
    const r = hi > lo ? (t.rms - lo) / (hi - lo) : .5;
    const z = zh > zl ? (t.zcr - zl) / (zh - zl) : .5;
    const b = Math.min(1, Math.max(0, (t.bpm - 90) / 70));
    t.energy = +(r * .45 + z * .25 + b * .30).toFixed(3);
  });
  return corpus;
}

/* ── sequencing ────────────────────────────────────────────────────────── */
/* Rise to ~72% of the set, peak, gentle release. */
const arc = (i, n) => { const p = i / (n - 1 || 1);
  return p < .72 ? (.22 + p / .72 * .62) : (.84 - (p - .72) / .28 * .30); };

/* Same recording on an album AND a single is one recording.

   OPTIONAL: pass { dedupe: false } to keep every copy. Removing anything the
   owner put in their own folder is a decision they should get to make.

   THE OLD KEY STRIPPED PREFIXES WITH the pattern `^[^-]+-` TWICE (written as
   a regex whose closing delimiter cannot be quoted inside a block comment --
   that is how the first version of this note ended the comment early and
   broke the parse). `[^-]+` stops
   at the first hyphen ANYWHERE rather than at the " - " separator. Any hyphen
   inside a title or album name derailed it:

     LukHash - WALKMAN -Single- - 01 WALKMAN    ->  "single01walkman"
     LukHash - BETTER THAN REALITY - 09 WALKMAN ->  "walkman"

   Two keys, so both copies entered the set and the same recording could play
   twice. Measured: it caught 17 of the 27 duplicate groups in this library and
   missed 10 — every `-Single-` and `-EP-` release, plus `8-Bit Warrior` and
   `EIGHTY-FIVE`, whose titles simply contain a hyphen.

   ── THE NAME IS A HYPOTHESIS. THE AUDIO DECIDES. ────────────────────────
   The keeper's caution, and it is the right one: *"there may be some tracks
   with same-ish names but differing somehow."* A title match is a guess about
   two files, and a remix, a radio edit, a live take or a re-recording can all
   carry the identical title. Merging on the name alone throws one of them
   away silently, which is the worst possible failure here.

   So the title only NOMINATES a pair. They are merged only if the audio also
   agrees: duration and tempo both within 1%. Anything else is two different
   recordings that happen to share a name, and both are kept.

   1% is chosen, not measured, and the direction of its failure is the reason
   it is safe: too tight keeps a duplicate, too loose drops a real track. It
   is set far to the keeping side. For scale, every one of the 27 genuine
   duplicate groups here agrees to within 0.15s and 0.05 bpm — three orders of
   magnitude inside the tolerance — while any two different recordings of one
   song differ by seconds.

   TIEBREAK IS GRID ERROR, NOT CONFIDENCE. When two copies really are one
   recording, keep the one whose beat grid agrees with its own tempo — the copy
   that can actually be beatmatched. Confidence differs by about 0.001 between
   two encodes of the same master, which is noise being asked to make a
   decision. It stays as the fallback when neither copy has a usable grid. */
function dedupe(corpus, opts) {
  if (opts && opts.dedupe === false) return corpus.slice();
  const key = t => {
    const parts = String(t.name || '').split(' - ');
    const last = (parts.length > 1 ? parts[parts.length - 1] : parts[0]) || '';
    return last.replace(/^\s*\d{1,3}\s+/, '')
               /* the YouTube-sourced files carry the video id in brackets, so
                  "Paradigm Shift [IlV9PHqbltI]" and the album's "06 Paradigm
                  Shift" keyed differently and both survived. Same strip as
                  panel-route's short(). Parentheses are deliberately left
                  alone: "(1984) Nick Scarim" is part of the title on the C64
                  reMIXed record, and the audio check catches over-merging
                  anyway. */
               .replace(/\s*\[[A-Za-z0-9_-]{8,}\]\s*$/, '')
               .toLowerCase().replace(/[^a-z0-9]/g, '');
  };
  const near = (a, b, tol) => a > 0 && b > 0 && Math.abs(a - b) / Math.max(a, b) <= tol;
  const sameRecording = (a, b) => near(a.dur, b.dur, 0.01) && near(a.bpm, b.bpm, 0.01);
  /* lower is better; a track with no usable grid sorts behind every track that
     has one, rather than winning by having nothing to disagree with */
  const rank = t => { const e = gridError(t); return e == null ? Infinity : e; };

  const groups = new Map();
  for (const t of corpus) {
    const k = key(t);
    if (!k) { groups.set('\u0000nokey' + groups.size, [t]); continue; }
    const bucket = groups.get(k);
    if (!bucket) { groups.set(k, [t]); continue; }
    /* only fold into a copy the audio agrees with; otherwise it is a distinct
       recording that shares a title and it keeps its own slot */
    const twin = bucket.find(x => sameRecording(x, t));
    if (!twin) { bucket.push(t); continue; }
    const a = rank(twin), b = rank(t);
    if (b < a || (a === b && twin.conf < t.conf)) bucket[bucket.indexOf(twin)] = t;
  }
  const out = [];
  groups.forEach(b => b.forEach(t => out.push(t)));
  return out;
}

/* ── does a track's beat grid agree with its own tempo label? ──────────────
   THE NUMBER THE OLD GATE USED WAS THE WRONG ONE. `conf > 0.8` is Essentia's
   agreement between five onset-detection functions, and this project's own
   SKILL.md already warns that low agreement on chiptune is EXPECTED rather
   than a defect. Gating on it excluded ten tracks the keeper wanted, and
   measurement showed five of the ten had grids accurate to under 1.5%.

   This measures the thing that actually costs something. The engine stretches
   by `tempo / meta.bpm` — the DECLARED tempo — while the beats it aligns to
   come from `meta.beats`. If those two disagree by 6%, the transition is 6%
   out however good the crossfade is. Grid error IS beatmatch error, which is
   why it belongs in the gate and confidence does not.

   Mean spacing, so a grid with a hole in it reads as slower than it is and
   the track lands on the untrusted side. That is the safe direction.

   NOT octave-aware on purpose: comparing against bpm/2 and bpm*2 and taking
   the best would hide exactly the half/double-time disagreements this is
   meant to surface. A doubled grid against a single-time label reads as ~100%
   and is refused, which is correct. */
function gridError(t) {
  const b = t && t.beats;
  if (!b || b.length < LOCK.minBeats || !(t.bpm > 0)) return null;
  const span = b[b.length - 1] - b[0];
  if (!(span > 0)) return null;
  const gridBpm = 60 * (b.length - 1) / span;
  return Math.abs(gridBpm - t.bpm) / t.bpm * 100;
}

/* ── the one threshold here that was DERIVED rather than chosen ────────────
   Measured over all 179 rescanned tracks, the distribution of grid error has
   an empty band: nothing at all between 7.50% and 11.04%. Every cut inside
   that band selects the identical five tracks, so the choice is insensitive
   across a 3.5-point range — which is what a defensible threshold looks like.
   9 sits in the middle of the gap, furthest from both edges.

   THE OTHER DEFENSIBLE ANSWER IS ABOUT 3%, and it is not settled. The argument
   for it: grid error adds to the stretch budget, and we already refuse 8% of
   stretch because it wobbles, so tolerating 9% of grid error on top is
   generous. That cut unlocks 22 tracks instead of 5. The argument for 9: it is
   where this corpus actually separates, and the wider cut has never been heard.

   Both are arguments. Neither is an ear. `DW.lock.maxGridErrPct` is live and
   takes effect on the next build — move it, rebuild, listen, and tell me. */
const LOCK = { maxGridErrPct: 9, minBeats: 8 };

/* Rolling tempo: the target DRIFTS with the set rather than being fixed.
   A hard gate refuses any track needing more stretch than maxStretch.

   NOTHING IS EXCLUDED FOR BEING HARD TO BEATMATCH ANY MORE. The keeper's
   instruction was plain: *"Ideally you wouldn't discard any of the songs that
   people have put in. maybe we find a way to gracefully still reach them."*

   So a track is now classified rather than filtered:

     LOCKED    its grid agrees with its tempo label, so it can be stretched
               and beat-locked. Subject to the stretch gate exactly as before.
     UNLOCKED  its grid does not agree, or it has no usable grid. It plays at
               its OWN speed, unstretched, and crossfades without claiming to
               beatmatch — which is what a DJ does with a record that will not
               grid. It is in the set; it is just not pretending.

   THERE ARE TWO WAYS TO BE UNLOCKED and they are not the same thing. The
   first version of this only had one, and the harness caught it immediately:
   171 tracks in the pool, 107 in the set, 64 never placed. Recovering the ten
   the confidence gate dropped did nothing for the fifty-nine the STRETCH gate
   drops, and those are the larger number.

     _unlockReason 'grid'   the grid disagrees with the tempo label. We do not
                            believe its BPM, so it plays at its own speed AND
                            IT DOES NOT STEER: letting a bad grid drift the
                            rolling target spreads one bad number across every
                            transition after it. A parenthesis in the set.

     _unlockReason 'reach'  the grid is fine; we simply could not get there by
                            stretching, because every remaining track is more
                            than 8% away from where the set currently sits.
                            The old sequencer's answer was to END. The new one
                            plays it straight — no stretch, no claim of a
                            beatmatch — and THEN LETS IT STEER, because its
                            tempo is trustworthy and repositioning the set is
                            the entire reason for playing it. Locked mixing
                            resumes from the new tempo on the very next track.

   That second case is what a DJ does when the floor has walked away from the
   record box: drop one in clean, let the room take the new tempo, carry on
   mixing. It is also why the set no longer ends at 107.

   A grid-unlocked track scores nothing on the tempo term — a penalty of
   exactly the weight of the property it lacks, needing no new constant — so a
   locked candidate wins whenever one qualifies.

   Back-to-back unlocked tracks are avoided but not forbidden: the first pass
   refuses them, and only if nothing else qualifies at all does a second pass
   allow one, because ending the set is the thing we are trying to stop
   doing. */
/* The pool and its classification, stamped ON the records handed in. This
   used to be the first thing sequence() did and nothing else; it is its own
   function because ledger 137 needed it run on the corpus ORIGINALS while the
   plan itself is built on copies (see prepare()). Same filter, same
   `_gridErr`/`_locked` stamps, same cut — nothing here decides anything
   sequence() did not already decide. */
function classifyPool(corpus, opts) {
  opts = opts || {};
  const minConf = opts.minConf != null ? opts.minConf : 0;
  const maxGridErr = opts.maxGridErr != null ? opts.maxGridErr : LOCK.maxGridErrPct;
  const fullPool = dedupe(corpus, opts).filter(t => t.bpm > 60 && t.dur > 75 && t.conf > minConf);
  fullPool.forEach(t => {
    const e = gridError(t);
    t._gridErr = e == null ? null : +e.toFixed(2);
    t._locked = e != null && e <= maxGridErr;
  });
  return fullPool;
}

function sequence(corpus, opts) {
  opts = opts || {};
  const maxStretch = opts.maxStretch != null ? opts.maxStretch : 0.08;
  /* was 0.8, and it was gating on the wrong number — see gridError(). Kept as
     an option because a caller may still want it; the default excludes nobody. */
  const minConf = opts.minConf != null ? opts.minConf : 0;
  const maxGridErr = opts.maxGridErr != null ? opts.maxGridErr : LOCK.maxGridErrPct;
  /* ── TWO WAYS TO BUILD, the keeper's call 2026-08-19 ──────────────────
     "maybe that should be a choice — between build set (best matches) vs
     build set (all tracks)."

       'all'   (default) everything in the pool is placed. A track the gate
               cannot reach, or whose grid is untrusted, is played STRAIGHT
               and the set carries on — 0.7.0's no-discard promise.
       'best'  only tracks that can actually be BEATMATCHED from where the
               set is: locked grids only, every transition inside the
               stretch gate, and the set ENDS when the gate is exhausted
               rather than dropping one in straight. A shorter set that is
               all mix, which is what "best matches" means. What it leaves
               out is reported by DW.inspect() against the pool, so a short
               set is never mistaken for a small library.

     Same scoring, same gate, same classification in both; the only
     differences are the pool (locked only) and what happens at exhaustion.

       'phrase' (2026-08-19, keeper: "add it as a build option, not
               replacing the current build types") is 'best' with one more
               promise: every transition lands on an 8-BAR PHRASE of both
               tracks, not merely a downbeat — the outgoing leaves at the
               last phrase start its length allows, the incoming enters at
               its own first phrase start, and the crossfade runs for exactly
               one phrase. The phrase offsets come from DWPHRASE at play time
               (it needs the decoded audio), so the PLAN is the same list as
               'best'; what differs is stamped on the set (`phrase: true`)
               and the Player reads it. A track whose grid is not believed
               has no believable phrase either, which is one more reason the
               pool is locked-only here. */
  const mode = (opts.mode === 'best' || opts.mode === 'phrase') ? opts.mode : 'all';
  const tight = mode !== 'all';                 /* best and phrase: locked pool, the gate ends the set */
  const fullPool = classifyPool(corpus, opts);
  const pool = tight ? fullPool.filter(t => t._locked) : fullPool;
  if (!pool.length) return [];
  const n = Math.min(opts.length || pool.length, pool.length);
  const w = Object.assign({ key: .30, tempo: .30, energy: .40 }, opts.weights);

  const energyTerm = (t, want) => 1 - Math.min(1, Math.abs(t.energy - want) / .30);

  const used = new Set();
  /* THE OPENER: nearest energy to the start of the arc, with a locked track
     winning a TIE. That is all the duplication does, and it is worth naming
     because it reads like a preference and is not one: Array#sort is stable,
     so prepending the locked tracks only reorders entries whose distances are
     EXACTLY equal — an unlocked track nearer by 0.001 still wins. Energy is
     stored to three decimals, so exact ties are common and the tie-break does
     fire. Measured on the real corpus 2026-09-03: arc(0,n) = 0.220, the six
     nearest tracks are all locked, and a hard "locked openers only" rule
     picks the same track in both `all` and `best`. Left as it is on purpose —
     making it a hard preference would change which track opens a set on some
     other library, and which opener is right is the ear's call, not a
     reading's (review 2026-09-01, engine lows). */
  let cur = pool.filter(t => t._locked).concat(pool).slice()
    .sort((a, b) => Math.abs(a.energy - arc(0, n)) - Math.abs(b.energy - arc(0, n)))[0];
  used.add(cur.id); const out = [cur]; let tempo = cur.bpm;
  cur._stretch = 1; cur._tempoAt = Math.round(tempo);
  delete cur._reached;
  if (cur._locked) { delete cur._unlocked; delete cur._unlockReason; }
  else { cur._unlocked = true; cur._unlockReason = 'grid'; }

  for (let i = 1; i < n; i++) {
    const want = arc(i, n);
    let best = null, bs = -1;
    /* pass 0 refuses a second unmixed track in a row; pass 1 allows it, and
       only runs when pass 0 found nothing at all */
    for (let pass = 0; pass < 2 && !best; pass++) {
      for (const t of pool) {
        if (used.has(t.id)) continue;
        let s;
        if (t._locked) {
          const stretch = Math.abs(tempo / t.bpm - 1);
          if (stretch > maxStretch) continue;                /* ← the gate */
          s = camScore(cur.camelot, t.camelot) * w.key
            + (1 - stretch / maxStretch) * w.tempo
            + energyTerm(t, want) * w.energy;
        } else {
          if (pass === 0 && cur._unlocked) continue;
          s = camScore(cur.camelot, t.camelot) * w.key
            + energyTerm(t, want) * w.energy;                /* no tempo term */
        }
        if (s > bs) { bs = s; best = t; }
      }
    }
    /* ── the gate is exhausted, and the set used to stop here ────────────
       Nothing within the stretch budget, and no grid-unlocked track left to
       fill the gap. Rather than discarding everything that remains, take the
       best of what is left and play it STRAIGHT: unstretched, uncounted as a
       beatmatch. Scored on key and energy only, with a nudge toward the
       smallest tempo jump so the room is asked to move as little as possible.

       This is the whole difference between a set that ends at 107 of 171 and
       one that plays the library. */
    if (!best && tight) break;                         /* best matches / phrase: the gate ends the set */
    if (!best) {
      let far = null, fs = -1;
      for (const t of pool) {
        if (used.has(t.id)) continue;
        const jump = Math.abs(tempo / t.bpm - 1);
        const s = camScore(cur.camelot, t.camelot) * w.key
                + energyTerm(t, want) * w.energy
                + (1 / (1 + jump * 4)) * w.tempo;      /* nearest tempo, gently */
        if (s > fs) { fs = s; far = t; }
      }
      if (!far) break;                                  /* genuinely nothing left */
      best = far; bs = fs; best._reached = true;
    }

    used.add(best.id); best._score = +bs.toFixed(3);
    best._tempoAt = Math.round(tempo);
    const straight = best._reached || !best._locked;
    if (!straight) {
      best._stretch = +(tempo / best.bpm).toFixed(3);
      delete best._unlocked; delete best._unlockReason;
      tempo += (best.bpm - tempo) * (opts.drift || 0.35);
    } else {
      best._stretch = 1;
      best._unlocked = true;
      best._unlockReason = best._locked ? 'reach' : 'grid';
      /* A trustworthy grid we merely could not stretch to DOES steer — that is
         what playing it straight was for. An untrustworthy one never does. */
      if (best._locked) tempo = best.bpm;
      delete best._reached;
    }
    out.push(best); cur = best;
  }
  /* stamped on the array, not the tracks: how it was built and what the
     pool held, so inspect() can say what a 'best' build left out */
  out.mode = mode;
  out.phrase = mode === 'phrase';               /* read by Player.play(); see the Player's phrase block */
  out.poolSize = fullPool.length;
  out.leftOut = tight ? fullPool.filter(t => !used.has(t.id)) : [];
  return out;
}

/* ── picking files where the File System Access API does not exist ──────
   showDirectoryPicker / showOpenFilePicker are Chromium-only. Everything
   else — Firefox, desktop Safari, and EVERY browser on iOS, which is WebKit
   whatever its name — has <input type="file">. `multiple` reaches the iOS
   Files app for individual tracks; `webkitdirectory` picks a whole folder
   on desktop Safari/Firefox and on iOS from 18.4 (WebKit bug 271705, fixed
   2024-10-04, shipped 18.4 — checked, not assumed). Below 18.4 the folder
   picker degrades to a multi-select of files, which is what the iOS picker
   shows when it ignores the attribute.

   A programmatic input.click() only works INSIDE a user gesture on WebKit,
   and an `await` before it can spend the gesture. So the pickers below are
   opened synchronously by their callers, BEFORE Essentia boots — the boot
   happens while the user is choosing. That reorder is harmless on Chromium.

   The File objects an <input> yields are the same kind the handles yield:
   the library Map and the cache both use name|size|mtime, so a corpus scanned one way is found the
   other way. */
function pickViaInput(opts) {
  opts = opts || {};
  return new Promise((ok, no) => {
    const inp = document.createElement('input');
    inp.type = 'file'; inp.multiple = true;
    if (opts.directory) inp.webkitdirectory = true;
    else inp.accept = 'audio/*,' + AUDIO_EXT.join(',');
    inp.style.display = 'none';
    /* iOS needs the input in the document for the picker to show */
    document.body.appendChild(inp);
    let done = false;
    const finish = files => { if (done) return; done = true; inp.remove(); ok(files); };
    inp.onchange = () => finish([...inp.files].filter(f => AUDIO_RE.test(f.name)));
    /* cancel fires `cancel` in new browsers; older ones fire nothing — the
       focus-return fallback below resolves an empty pick rather than hanging */
    inp.oncancel = () => finish([]);
    const onFocus = () => setTimeout(() => { window.removeEventListener('focus', onFocus);
      if (!done && !inp.files.length) finish([]); }, 1500);
    window.addEventListener('focus', onFocus);
    try { inp.click(); } catch (e) { inp.remove(); no(e); }
  });
}
/* Is a FOLDER pick through <input webkitdirectory> actually usable here?
   The property existing is not the answer: on Chrome for Android it has
   existed since 18 while the picker showed files only, and in Chrome
   Android 131 choosing a directory CRASHES THE BROWSER (crbug 376834374);
   real support starts at 132 — the same release that brought the File
   System Access API to Android, so on 132+ this function is never reached.
   Samsung Internet and WebView mirror Chrome Android and carry Chrome/NN in
   their UA. Firefox Android grew it in 142; before that the attribute is
   present and the picker shows files, which degrades on its own. iOS: 18.4+
   (the attribute is present and inert below). Source for all of it: MDN
   browser-compat-data, read on 2026-08-19, not remembered. */
function folderInputUsable() {
  if (!('webkitdirectory' in document.createElement('input'))) return false;
  const ua = navigator.userAgent;
  const m = /Android/.test(ua) && /Chrome\/(\d+)/.exec(ua);
  if (m && +m[1] < 132) return false;
  return true;
}
const canPickFolder = () => !!window.showDirectoryPicker || folderInputUsable();

/* ── library: directory handle retained, files resolved lazily ─────────── */
const LIB = { dir: null, files: null,
  /* Use the same identity as the analysis cache. A basename can identify
     several different recordings; it is only a legacy lookup hint. */
  id(file) { return file.name + '|' + file.size + '|' + (file.lastModified || 0); },
  add(file) {
    if (!this.files) this.files = new Map();
    this.files.set(this.id(file), file);
  },
  async pick() {
    let f;
    if (window.showDirectoryPicker) {
      this.dir = await window.showDirectoryPicker({ mode: 'read' });
      f = await walk(this.dir);
    } else {
      /* a folder where the browser can, the files multi-select where it cannot */
      f = await pickViaInput({ directory: folderInputUsable() });
      if (!f.length) throw new Error('nothing picked');
    }
    this.files = new Map();
    for (const x of f) this.add(x);
    return this.files.size;
  },
  find(meta) {
    if (!this.files || !meta) return null;
    if (meta.id) return this.files.get(meta.id) || null;
    let found = null;
    for (const file of this.files.values()) {
      if (norm(file.name) !== norm(meta.name)) continue;
      if (found && found !== file) return null;  /* ambiguous: never pick one */
      found = file;
    }
    return found;
  },
  async decode(meta, ctx) {
    const f = this.find(meta);
    if (!f) throw new Error((meta.id ? 'missing file: ' : 'missing or ambiguous file: ') + meta.name);
    return decodeAudio(ctx, f);
  }
};

/* ── player ────────────────────────────────────────────────────────────── */
const Player = (() => {
  let ctx = null, master = null, analyser = null, booted = false, booting = null;
  /* the last node before the speakers, and the optional MediaStream tap —
     see outputStream() */
  let comp = null, msDest = null, viaStream = false;
  let A = null, B = null, order = [], idx = 0, tempo = 0, xfade = 16;
  /* ── phrase mode ──────────────────────────────────────────────────────
     ON for a set built with `build · phrase match` (sequence() stamps
     `phrase: true` on the array and play() reads it); OFF for the other
     two builds, so nothing about them changes. While on:

       exit   the outgoing track leaves at the LAST 8-bar phrase start its
              length allows (instead of the downbeat nearest its natural
              end), never earlier than MIN_PLAY;
       entry  the incoming track starts at ITS first phrase start (instead
              of its first beat), so bar 1 of its phrase lands on bar 1 of
              the outgoing track's last phrase;
       fade   one phrase long — 32 beats of the outgoing track at the rate
              it is playing — instead of the set's xfade, so the incoming
              track's first phrase runs exactly under the outgoing track's
              last and the handover completes ON the next phrase start;
       next   ▶▶, a clicked blend-now and ⚡ blend fast all leave at the
              next phrase start at least `lead` seconds out, which can be
              up to eight bars away, instead of the next downbeat.

     The phrase offset is DWPHRASE's, computed from the decoded buffer the
     deck already holds and written back to the analysis record so it is
     done once per track. A track with no usable offset — unlocked, too
     short, module missing — falls back to the downbeat behaviour for that
     transition, and the log says which happened (¶ marks a phrase exit or
     entry). Nothing here moves a threshold: the phrase length is the
     grid's own, and the lead is the same 1.2 s the downbeat path uses. */
  let phrase = false;
  const PHR = () => (typeof window !== 'undefined' && window.DWPHRASE) || null;
  /* The shortest a track is allowed to hold the deck. It was written inline
     in chain() as a bare 45, and patch 10's DWELL.min is 40 — so the fast
     route printed "each stone plays only 40s" while chain() clamped every
     stone to 45. Neither number was measured, so neither is moved here; the
     one that actually governs is named and exposed instead, and the menu
     prints THAT. A chosen number is allowed to be wrong. A chosen number
     copied into two places and disagreeing with itself is not. */
  const MIN_PLAY = 45;
  /* ── settling a stretched deck back to its own speed ────────────────
     OFF, and it must stay off until it has been heard.

     A forced blend leaves the incoming track stretched for its whole length:
     force +14% and that track is 14% fast until it ends. `settle` rides the
     rate back to 1.0 over `seconds`, which is what a DJ does with the pitch
     fader after a rescue.

     WHAT IT COSTS, stated before it is switched on: `rate` stops being a
     constant, so every `* (1/rate)` mapping in here becomes wrong. They are
     replaced by deck.pos()/deck.when(), which integrate the rate — and which
     reduce to exactly the old arithmetic while no ramp is scheduled. That
     equivalence is the thing to test first; the sound is the thing to test
     second.

     It also changes the SET, not just the track: a deck that settles hands
     over at its own BPM instead of at the 35%-drift target, so the rolling
     tempo becomes the current track's BPM and every subsequent gate test is
     measured from there. That is a musical change, not a fix. `seconds` is
     chosen, not measured.

     `minStretch` is null — settle every stretched deck. Set it to a fraction
     to settle only the bad ones. It is deliberately NOT defaulted to 0.08:
     that number is DWNAV.GATE, it lives there, and copying it in here would
     make two thresholds that can drift apart — the same mistake as the 45/40
     dwell clash directly above. The caller that wants gate semantics passes
     DWNAV.GATE, so there stays exactly one of it. */
  const settle = { on: false, seconds: 45, minStretch: null };
  /* Master level, held OUTSIDE the graph so it survives boot() and kill().
     The gain node does not exist until the first play, and kill() throws the
     whole context away — a level stored only on the node would silently reset
     to the default every time. 0.85 is the existing default, unchanged. */
  let volume = .85;
  let chainTimer = null;
  /* ── which plan is current ─────────────────────────────────────────
     chain() awaits a decode in the middle, and anything that changes the
     plan — cancelPending(), stop(), a new play() — can run during that
     await. Before this token, the stale continuation carried on regardless:
     it built a deck for the OLD next track, scheduled it at the OLD exit,
     overwrote B (orphaning the deck the new plan had just scheduled, which
     then played alongside it) and re-armed chainTimer against the old exit.
     Every replan bumps the token; every continuation checks it. A plan that
     is no longer current does nothing, which is the only correct thing a
     stale plan can do. */
  let gen = 0;
  /* the deck that most recently handed over — see the handover timer */
  let handed = null;
  const issues = [];
  function recordIssue(meta, stage, error) {
    const issue = { name: meta.name, id: meta.id || null, stage, message: String(error.message || error) };
    if (!issues.some(i => i.id === issue.id && i.name === issue.name && i.stage === stage && i.message === issue.message)) issues.push(issue);
  }
  /* ── which worklet the decks are built on ─────────────────────────────
     'deckwave-stretch' is the vendored SoundTouch 2.1.1 processor with ONE
     render block held in its output before the first extraction (the
     wrapper's header has the why: ledger 65 — the plain pipe zero-fills a
     2.9 ms block a few times a minute at any rate ≠ 1.0, the hold gives 0
     offline). Loaded, in order of trust:

       1. assets/deckwave-stretch.module.js — the vendored text and the
          wrapper CONCATENATED INTO A CHECKED-IN FILE, loaded like any other
          same-origin script. No blob, no fetch-and-assemble, nothing for a
          platform to refuse that would not also break the plain module.
          check-player asserts the file is byte-identical (mod line endings)
          to vendor + wrapper, so it cannot drift; regenerating it is
          concatenation, not a build step.
       2. the blob: route — vendored text + wrapper fetched and joined at
          boot. Kept for a deployment missing the module file.
       3. 'soundtouch-processor', the plain vendored one — the pipe that
          gaps. Reached only if both above fail, and the play line SAYS SO.

     Either way the decks post `metrics` and the deck accessors carry
     `gaps`; the first play's log line and the now-playing card say which
     worklet is live — the keeper's 2026-08-19 demo playthrough was blind
     to both (the demo discarded the play line, and Player.log is not on
     screen), which is why "slightest popping" arrived with no number
     beside it. */
  let stretch = { name: 'soundtouch-processor', held: false, why: 'not booted' };
  const STRETCH_WRAPPER = 'assets/deckwave-stretch.js';
  const STRETCH_MODULE = 'assets/deckwave-stretch.module.js';
  /* zero-filled blocks SINCE THE LAST ▶: decks that have handed over are
     added at the handover (and folded in by stop()); the live decks are
     read directly. One number for "did the pipe gap in this set". */
  let gapsHanded = 0;
  const log = [];
  /* EVERY scheduled source lands here. stop() iterates this, not the deck
     pointers — a source scheduled for the future is not reachable any other way,
     which is exactly how the first stop button failed. */
  const live = new Set();

  function boot() {
    if (booted) return Promise.resolve();
    if (booting) return booting;
    const pending = bootGraph();
    booting = pending;
    const finished = () => { if (booting === pending) booting = null; };
    pending.then(finished, finished);
    return pending;
  }

  async function bootGraph() {
    /* `latencyHint: 'playback'` on phones. This is an OUTPUT BUFFER SIZE, not
       a detector or a calibration: it asks the browser for a larger render
       buffer, which costs a few tens of milliseconds of output latency that
       nothing here can feel (the deck has no live input) and buys headroom
       against audio-thread underruns on a phone CPU running two decks
       through a WSOLA worklet. Desktop keeps the default ('interactive'),
       so nothing measured there moves. Whether it removes the popping the
       keeper heard on the iPhone is for the ear — the falsifier is the same
       track, same set, popping gone or not. */
    const ua = navigator.userAgent, phone = /iPad|iPhone|iPod|Android/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const audioCtx = new AC(phone ? { sampleRate: 44100, latencyHint: 'playback' } : { sampleRate: 44100 });
    ctx = audioCtx;
    /* Same-origin worklet. index.html's comment always claimed this was
       self-hosted; until now it was not, and the unpinned URL was silently
       resolving to 0.3.0 (LGPL-2.1) rather than the MPL-2.0 release the
       licence notes assumed. */
    /* The held-block wrapper first (see `stretch` above): vendored text +
       wrapper as one blob: module, which also registers the plain name. If
       it cannot be built or the platform refuses it, the plain module. */
    let choice = { name: 'soundtouch-processor', held: false, why: '' };
    /* 1. the checked-in concatenated module — the path with nothing to refuse */
    try {
      await audioCtx.audioWorklet.addModule(STRETCH_MODULE);
      choice = { name: 'deckwave-stretch', held: true, why: 'static module' };
    } catch (e) { choice.why = 'static module failed: ' + ((e && e.message) || e); }
    if (ctx !== audioCtx) return;             /* killed while loading */
    /* 2. the blob: route, for a deployment missing the file */
    if (!choice.held && typeof fetch === 'function' && typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
      let url = null;
      try {
        const [vend, wrap] = await Promise.all([
          fetch(assetURL('soundtouch')).then(r => { if (!r.ok) throw new Error(r.status + ' ' + assetURL('soundtouch')); return r.text(); }),
          fetch(STRETCH_WRAPPER).then(r => { if (!r.ok) throw new Error(r.status + ' ' + STRETCH_WRAPPER); return r.text(); })
        ]);
        /* the vendored text ends with a sourceMappingURL comment; a newline
           keeps the wrapper off that line */
        url = URL.createObjectURL(new Blob([vend, '\n', wrap], { type: 'text/javascript' }));
        await audioCtx.audioWorklet.addModule(url);
        choice = { name: 'deckwave-stretch', held: true, why: 'blob module' };
      } catch (e) {
        choice.why += ' · blob failed: ' + ((e && e.message) || e);
      } finally { if (url) { try { URL.revokeObjectURL(url); } catch (e) {} } }
    } else if (!choice.held) choice.why += ' · no fetch/Blob here';
    if (ctx !== audioCtx) return;
    if (!choice.held) {
      try { await audioCtx.audioWorklet.addModule(assetURL('soundtouch')); }
      catch (e) {
        if (!ASSETS.allowCDN)
          throw new Error('missing ' + assetURL('soundtouch') +
            ' — see vendor/README.md, or set DW.assets.allowCDN = true');
        console.warn('deckwave: falling back to CDN for the worklet — remote code, no integrity check');
        await audioCtx.audioWorklet.addModule(CDN.soundtouch);
      }
    }
    if (ctx !== audioCtx) return;
    stretch = choice;
    master = ctx.createGain(); master.gain.value = volume;
    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12; comp.ratio.value = 4;
    master.connect(comp); comp.connect(ctx.destination);
    msDest = null; viaStream = false;
    analyser = ctx.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = .7;
    /* an analyser in a dead-end branch is not reliably pulled — give it a silent sink */
    const sink = ctx.createGain(); sink.gain.value = 0;
    master.connect(analyser); analyser.connect(sink); sink.connect(ctx.destination);
    booted = true;
  }

  /* SoundTouchJS 2.1.1 inverted the model, so this is not the same wiring as
     0.3.0 and the difference matters.

     0.3.0: the source ran at 1.0 and the WORKLET stretched time, via a `tempo`
     AudioParam. That param does not exist in 2.x. Worse, its process() pushed
     128 frames in and assumed 128 came back — writing a fresh zero-filled
     array's untouched remainder straight to the output whenever the stretcher
     had fewer ready. Measured offline: 0 gaps/sec at tempo 1.00, but 10
     gaps/sec and 7.3% silent frames at 1.08. Every chained deck is stretched;
     the first deck and any jumped-to deck are not. That is exactly the "clean
     alone, pops through a mix" pattern the keeper reported, and it confounded
     the phase reading in Act 21 for a day.

     2.1.1: the SOURCE changes speed and the worklet compensates pitch. Set
     playbackRate identically on both and leave `pitch` at 1 — the processor
     computes `pitch * 2^(semitones/12) / playbackRate` internally, so
     playbackRate alone restores the original pitch. Setting `pitch` here too
     would compensate twice.

     `k = 1 / rate` in chain() is unchanged and still correct: which node
     performs the time change does not alter the wall-clock mapping. */
  /* RELEASE A DECK WHOSE SOURCE HAS ENDED. Measured 2026-09-01 (review H2,
     ledger 124): five real handovers took the renderer from 691 MB to
     1,956 MB of private memory, and after two forced garbage collections
     the JS heap still held ~87 MB per handover — one decoded stereo track
     each. The chain was never disconnected, so every handed-over deck's
     worklet node stayed in the graph — and the vendored processor keeps
     itself alive by always returning true from process(), so the node ran
     WSOLA on silence for the life of the context — and its port handler
     closed over the deck, which held the source, which held the buffer.
     The comment at the handover said "release behind" and released the
     meta's reference only (ledger 109/113's shape).

     So: on `ended`, tell the held worklet to let go (the wrapper answers
     {type:'release'} by returning false from process(); the plain vendored
     processor has no such door and stays alive — disconnected, silent, but
     alive), drop the port handler that closed over the deck, and
     disconnect every node. The deck object itself stays where anything
     still points at it (A or B, briefly, when the last track runs out) and
     reads exactly as before: the fields are the same, the nodes just have
     no graph. Not a threshold; nothing audible changes — the source has
     already ended. */
  function releaseDeck(d) {
    if (!d || d.released) return; d.released = true;
    try { if (d.st && d.st.port) { d.st.port.postMessage({ type: 'release' }); d.st.port.onmessage = null; } } catch (e) {}
    for (const n of [d.src, d.st, d.lo, d.mid, d.hi, d.g]) { try { if (n && n.disconnect) n.disconnect(); } catch (e) {} }
  }

  /* `origin` is a FACT, not a guess: 'play' for a deck built by play() —
     the first ▶ of a set, a jumped-to row, back() — and 'chain' for one
     built by chain(), which is the only path that beatmatches. Until
     2026-09-01 four surfaces inferred it from `idx === 0 && rate === 1`,
     which is true of the first deck and false of every other deck play()
     builds, so a jump to row 7 printed `+0.00%` / `×1.000` — the tightest
     beatmatch on screen against a deck matched to nothing (ledger 82).
     A jumped-to deck runs at rate 1 for the same reason the first one
     does: there is no outgoing deck to match, not because the match was
     perfect. Read the fact; never re-derive it. */
  function makeDeck(track, rate, origin) {
    const src = ctx.createBufferSource(); src.buffer = track.buf;
    src.playbackRate.value = rate;                    /* the source does the time change */
    const st = new AudioWorkletNode(ctx, stretch.name);
    st.parameters.get('playbackRate').value = rate;   /* and the worklet undoes the pitch */
    const lo = ctx.createBiquadFilter(); lo.type = 'lowshelf';  lo.frequency.value = 200;
    const mid = ctx.createBiquadFilter(); mid.type = 'peaking'; mid.frequency.value = 1000; mid.Q.value = .8;
    const hi = ctx.createBiquadFilter(); hi.type = 'highshelf'; hi.frequency.value = 4000;
    const g = ctx.createGain(); g.gain.value = 0;
    src.connect(st); st.connect(lo); lo.connect(mid); mid.connect(hi); hi.connect(g); g.connect(master);
    /* when the source ends — the scheduled stop after a handover's fade,
       stop(), cancelPending(), or the last track running out — the deck is
       RELEASED: see releaseDeck. Until 2026-09-01 nothing was, and every
       handed-over deck stayed reachable with its decoded buffer. */
    live.add(src); src.onended = () => {
      live.delete(src); releaseDeck(d);
      d.track.buf = null;
      try { src.buffer = null; } catch (e) {}
      /* A handed-over source ending must not clear the new deck. With no
         successor, this is actual completion: invalidate pending work too. */
      if (A === d && !B) {
        gapsHanded += d.gaps || 0;
        A = null; handed = null; gen++;
        clearTimeout(chainTimer);
      }
    };
    if (st.port) st.port.onmessage = e => { if (e && e.data && e.data.type === 'metrics') d.metrics = e.data; };

    /* ── the source-time ↔ wall-time map ────────────────────────────
       Beat positions live in SOURCE seconds; schedules live in WALL seconds.
       Everything here used to convert with `k = 1 / rate`, which is true only
       while the rate never changes. With a settle ramp it does change, so the
       conversion integrates the rate instead of dividing by it.

         ramp === null      constant rate — pos/when are t*rate and p/rate,
                            i.e. byte-for-byte the old arithmetic.
         ramp = {r0,r1,S}   linear r0→r1 over S wall-seconds, then flat at r1.

       pos(t)  source-seconds consumed by t wall-seconds of playing
       when(p) wall-seconds needed to consume p source-seconds — pos inverted
       Both are relative to the deck's own start; add startedAt for ctx time. */
    const d = {
      src, st, lo, mid, hi, g, track, rate, ramp: null, curve: null,
      origin: origin === 'chain' ? 'chain' : 'play',
      /* the worklet's own metrics, every 100 blocks: `gaps` is the number
         of zero-filled blocks since priming (the wrapper's count; the plain
         processor's `underrunCount` includes its ~50 warm-up blocks, so
         that figure is reported as `underruns` and not as gaps) */
      metrics: null,
      get gaps() { const m = d.metrics; if (!m) return null; return m.gaps != null ? m.gaps : null; },
      get underruns() { const m = d.metrics; return m ? m.underrunCount : null; },
      rateAt(t) {
        if (d.curve) {
          let prev = d.curve[0];
          for (const point of d.curve.slice(1)) {
            if (t < point.t) return point.linear
              ? prev.v + (point.v - prev.v) * Math.max(0, t - prev.t) / (point.t - prev.t) : prev.v;
            prev = point;
          }
          return prev.v;
        }
        const r = d.ramp; if (!r) return d.rate;
        return t <= 0 ? r.r0 : t >= r.S ? r.r1 : r.r0 + (r.r1 - r.r0) * (t / r.S);
      },
      pos(t) {
        if (d.curve) {
          let prev = d.curve[0], sum = 0;
          if (t <= 0) return t * prev.v;
          for (const point of d.curve.slice(1)) {
            const dt = Math.max(0, Math.min(t, point.t) - prev.t);
            const slope = point.linear ? (point.v - prev.v) / (point.t - prev.t) : 0;
            sum += prev.v * dt + slope * dt * dt / 2;
            if (t <= point.t) return sum;
            prev = point;
          }
          return sum + (t - prev.t) * prev.v;
        }
        const r = d.ramp; if (!r) return t * d.rate;
        if (t <= r.S) return r.r0 * t + (r.r1 - r.r0) * t * t / (2 * r.S);
        return (r.r0 + r.r1) / 2 * r.S + r.r1 * (t - r.S);
      },
      when(p) {
        if (d.curve) {
          let prev = d.curve[0], used = 0;
          if (p <= 0) return p / prev.v;
          for (const point of d.curve.slice(1)) {
            const span = point.t - prev.t;
            const slope = point.linear ? (point.v - prev.v) / span : 0;
            const area = prev.v * span + slope * span * span / 2;
            if (p <= used + area) {
              const left = p - used;
              /* Stable positive root, including arbitrarily small slopes. */
              return prev.t + 2 * left / (prev.v + Math.sqrt(Math.max(0, prev.v * prev.v + 2 * slope * left)));
            }
            used += area; prev = point;
          }
          return prev.t + (p - used) / prev.v;
        }
        const r = d.ramp; if (!r) return p / d.rate;
        const pS = (r.r0 + r.r1) / 2 * r.S;
        if (p >= pS) return r.S + (p - pS) / r.r1;
        const a = (r.r1 - r.r0) / (2 * r.S), b = r.r0;
        if (Math.abs(a) < 1e-12) return p / b;
        /* the +root is the one before the parabola's vertex — the physical
           one — for both signs of a; the other is the ramp running backwards */
        return (-b + Math.sqrt(Math.max(0, b * b + 4 * a * p))) / (2 * a);
      },
      ratePoints() {
        if (d.curve) return d.curve;
        if (d.ramp) return [{ t: 0, v: d.ramp.r0 }, { t: d.ramp.S, v: d.ramp.r1, linear: true }];
        return [{ t: 0, v: d.rate }];
      },
      /* Both the source and pitch compensator get this exact curve. Keep
         the past part of the clock map when a future blend is replaced. */
      changeRate(to, seconds, at) {
        const t = Math.max(0, at - d.startedAt), from = d.rateAt(t);
        const points = d.ratePoints(), next = points.find(p => p.t > t);
        d.curve = points.filter(p => p.t < t).concat({ t, v: from, linear: !!(next && next.linear) });
        if (seconds > 0) d.curve.push({ t: t + seconds, v: to, linear: true });
        for (const p of [src.playbackRate, st.parameters.get('playbackRate')]) {
          p.cancelScheduledValues(at);
          if (next && next.linear) p.linearRampToValueAtTime(from, at);
          else p.setValueAtTime(from, at);
          if (seconds > 0) p.linearRampToValueAtTime(to, at + seconds);
        }
      },
      restoreCurve(curve, at) {
        d.curve = curve;
        const t = Math.max(0, at - d.startedAt), when = Math.max(at, d.startedAt);
        const next = d.ratePoints().find(point => point.t > t);
        for (const p of [src.playbackRate, st.parameters.get('playbackRate')]) {
          p.cancelScheduledValues(when);
          if (next && next.linear) p.linearRampToValueAtTime(d.rateAt(t), when);
          else p.setValueAtTime(d.rateAt(t), when);
          for (const point of d.ratePoints().filter(point => point.t > t)) {
            if (point.linear) p.linearRampToValueAtTime(point.v, d.startedAt + point.t);
            else p.setValueAtTime(point.v, d.startedAt + point.t);
          }
        }
      },
      /* Schedule the ride. Called after the start time is known, because the
         start time is chosen by chain() and not by makeDeck(). */
      setRamp(r0, r1, S, at) {
        d.ramp = { r0, r1, S };
        const wp = st.parameters.get('playbackRate');
        [src.playbackRate, wp].forEach(p => {
          try {
            p.cancelScheduledValues(at);
            p.setValueAtTime(r0, at);
            p.linearRampToValueAtTime(r1, at + S);
          } catch (e) {}
        });
        return d;
      }
    };
    return d;
  }

  function downbeatNear(beats, t) {
    let best = t, d = Infinity;
    for (let i = 0; i < beats.length; i += 4) {
      const dd = Math.abs(beats[i] - t); if (dd < d) { d = dd; best = beats[i]; } }
    return best;
  }

  /* Cancel the blend that chain() has already committed to the graph.
     chain() schedules the next deck the instant the current track starts, so
     anything that wants to change what comes next has to undo that first —
     otherwise the old choice is still wired up and will play. */
  function cancelPending() {
    gen++;                                   /* any chain() still awaiting a decode is now stale */
    if (!ctx) return;
    clearTimeout(chainTimer);
    if (B) {
      try { B.src.stop(); } catch (e) {}
      try { B.g.gain.cancelScheduledValues(ctx.currentTime); B.g.gain.value = 0; } catch (e) {}
      live.delete(B.src);
      /* The rolling target moved when B was scheduled — drift toward it, or
         a re-base to it for a reach track. B will never play, so that move
         never happens; put the target back or the replacement is chained
         against a tempo nothing is playing. Seen live on 2026-08-19: a
         cancelled reach track left the target at 120, and the blend-now that
         replaced it was stretched to 120 from a deck running at 100. */
      if (A && Object.prototype.hasOwnProperty.call(B, 'outgoingCurve')) {
        if (ctx.currentTime <= B.startedAt) A.restoreCurve(B.outgoingCurve, ctx.currentTime);
        else {
          /* A blend already heard is history, not something cancellation
             can undo. Hold its current rate and retain its consumed time. */
          A.changeRate(A.rateAt(ctx.currentTime - A.startedAt), 0, ctx.currentTime);
        }
      }
      if (ctx.currentTime <= B.startedAt && B.tempoBefore != null) tempo = B.tempoBefore;
      else if (A && !A.track.meta._unlocked) tempo = A.track.meta.bpm * A.rateAt(ctx.currentTime - A.startedAt);
      B = null;
    }
    if (A) {
      /* put A back to full, un-faded, so chain() can re-plan its exit */
      try {
        A.g.gain.cancelScheduledValues(ctx.currentTime);
        A.g.gain.setValueAtTime(1, ctx.currentTime);
        A.lo.gain.cancelScheduledValues(ctx.currentTime);
        A.lo.gain.setValueAtTime(0, ctx.currentTime);
        /* A prior stop time cannot be cancelled, but it can be replaced.
           Keep the natural tail available while a replacement decodes. */
        A.src.stop(A.startedAt + A.when(A.track.meta.dur - A.entry));
      } catch (e) {}
      A.outAt = null; A.fade = null;
    }
  }

  /* Move meta to be the next track, IN PLACE, so the dashboard's array — the
     same object — sees it too. Reassigning order would silently desync them. */
  function placeNext(meta) {
    const at = order.indexOf(meta);
    if (at > -1) {
      order.splice(at, 1);
      /* Pulling a row from BEFORE the playing track shifts the playing track
         down one; idx has to follow it or state.idx names the track AFTER
         the one on the deck for the rest of that track, the planned next
         track is skipped at the handover, and the route panel reads
         LIST ≠ DECK. Every row in the list opens the steering menu,
         including the ones already played, so this is one click away. */
      if (at < idx) idx--;
    }
    order.splice(idx + 1, 0, meta);
  }

  /* The next DOWNBEAT at least `lead` seconds away, in context time.
     Same every-fourth-beat assumption the rest of the engine makes — see the
     build log's note that there is no real downbeat detection, only 4/4.
     Uses the grid already detected for the playing track; no new constant.

     TWO EXIT POLICIES FOR A GRID-UNLOCKED TRACK, and this is the OTHER one.
     chain() (see its `_unlocked` note beside `downbeatNear`) refuses to snap
     an unlocked track's exit to its own grid: the grid disagrees with the
     track's tempo label, which is the whole reason it is unlocked, so it
     leaves on the clock. This function snaps regardless — `m.beats` is used
     with no `_unlocked` test — and blendNow, skip and reorder({now}) all
     reach it through nextExitAfter. So the same track leaves on the clock
     when the set plans its exit and on a distrusted downbeat when the keeper
     presses next.

     NOT reconciled here, deliberately: which is right is an ear question, not
     a reading one, and both readings are defensible. (a) Snap everywhere —
     a grid that is 9% wrong in MEAN SPACING can still put a beat within a few
     ms of where the ear expects one, and a press should land musically.
     (b) Clock everywhere — the classification says the grid is not believed,
     and using it anyway while calling it untrusted is the thing the
     classification exists to stop. Either is one line. The keeper decides;
     see the review's engine lows. */
  function nextDownbeatAfter(lead) {
    const m = A.track.meta;
    const since = ctx.currentTime - A.startedAt;
    const beats = (m.beats || []).map(b => A.when(b - A.entry));
    for (let i = 0; i < beats.length; i += 4)
      if (beats[i] > since + lead) return A.startedAt + beats[i];
    return ctx.currentTime + lead;         /* no grid — go on the clock */
  }

  /* The phrase offset of a deck's track: from the meta when it has been
     computed before (this session, or a previous one — it is written back
     to the analysis record), otherwise from the decoded buffer the deck
     holds. null when the module is absent, the track is unlocked (its grid
     is not believed, so neither is a phrase on it), or the detector found
     too little to go on — and null means "use the downbeat path". */
  function phraseOf(track) {
    const P = PHR(); if (!P || !track) return null;
    const m = track.meta;
    if (!m || m._unlocked) return null;
    if (m.phrase && m.phrase.v === P.V) return m.phrase.ok ? m.phrase : null;
    const chans = P.channelsOf(track.buf);
    if (!chans) return null;
    const t0 = Date.now();
    const ph = P.detect(chans, track.buf.sampleRate, m.beats || []);
    ph.ms = Date.now() - t0;
    m.phrase = ph;
    persistPhrase(m, ph);
    return ph.ok ? ph : null;
  }
  /* Additive write-back: the record keeps its analysis version; `phrase`
     rides along and is replaced with the record on the next re-scan. DB is
     the DW module's store; a Player evaluated on its own (the harnesses)
     has none, and that is fine. */
  function persistPhrase(m, ph) {
    try {
      if (typeof DB === 'undefined' || !m.id) return;
      DB.get(m.id).then(r => { if (r && r.v === m.v) { r.phrase = ph; return DB.put(r); } }).catch(() => {});
    } catch (e) {}
  }
  /* the grid of a deck in WALL seconds from its start — what every exit
     choice works in */
  const wallBeats = d => (d.track.meta.beats || []).map(b => d.when(b - d.entry));
  /* the length of the phrase starting at wall time t on this grid (the
     one at t if t is a phrase start, else the first phrase's) */
  function phraseLenAt(P, beats, ph, t) {
    for (const i of P.starts(beats, ph)) if (Math.abs(beats[i] - t) < 1e-3) return P.lengthAt(beats, i);
    return P.lengthAt(beats, ph.beat);
  }
  /* The next EXIT at least `lead` seconds away: the next phrase start in
     phrase mode when the playing track has one, else the next downbeat.
     blendNow, reorder({now}) and skip() all go through here. */
  function nextExitAfter(lead) {
    /* A second requested transition must not retarget the incoming deck
       while its predecessor is still fading at the shared tempo. */
    if (handed) lead = Math.max(lead, handed.at + handed.xfade - ctx.currentTime);
    const P = PHR();
    if (phrase && P && A) {
      const ph = phraseOf(A.track);
      if (ph) {
        const s = P.firstStartAfter(wallBeats(A), ph, ctx.currentTime - A.startedAt + lead);
        if (s) return A.startedAt + s.t;
      }
    }
    return nextDownbeatAfter(lead);
  }

  async function chain(forceOut, preBuf) {
    if (!A) return;
    const my = gen;                          /* the plan this call belongs to */
    const m = A.track.meta;
    const beats = (m.beats || []).map(b => A.when(b - A.entry));
    const successor = order[idx + 1];
    function rates(atRate) {
      if (!successor) return null;
      const base = m._unlocked ? tempo : m.bpm * atRate;
      const rate = successor._unlocked ? 1 : base / successor.bpm;
      const off = Math.abs(rate - 1);
      const settled = settle.on && !successor._unlocked && isFinite(rate) && rate > 0 &&
        off > 1e-4 && (settle.minStretch == null || off > settle.minStretch);
      const target = successor._unlocked
        ? (successor._unlockReason === 'reach' ? successor.bpm : tempo)
        : (settled ? successor.bpm : tempo + (successor.bpm - tempo) * .35);
      return { rate, settled, target };
    }
    const eventual = rates(A.rateAt(Infinity));
    function naturalExit() {
      if (!eventual || successor._unlocked || m._unlocked) return A.when(m.dur - A.entry) - xfade;
      /* Leave enough source material for the SAME fade while its rate
         changes. The crossfade and drift values themselves are unchanged. */
      const r0 = A.rateAt(Infinity), r1 = eventual.target / m.bpm;
      const seconds = eventual.settled ? Math.max(1, settle.seconds) : xfade;
      const rampFor = Math.min(seconds, xfade);
      const consumed = r0 * rampFor + (r1 - r0) * rampFor * rampFor / (2 * seconds) +
        r1 * Math.max(0, xfade - seconds);
      return A.when(m.dur - A.entry - consumed);
    }
    /* A stepping stone on a fast route carries `_dwell` — how long it needs to
       exist for, which is blend-in plus a short hold plus blend-out. It plays
       for that instead of its full length; everything else is unchanged.

       NOTE THE CLASH, unresolved deliberately: this floor is MIN_PLAY = 45s
       and patch 10's DWELL.min is 40s, so a 40s dwell is clamped up to 45.
       Both numbers were chosen rather than measured, and moving either is a
       threshold change — so it is surfaced rather than quietly reconciled.
       It is no longer a bare literal here: MIN_PLAY is exposed as
       DW.dwellFloor and the fast-route menu prints the clamped figure, so
       the UI stops advertising a dwell the engine will not honour. */
    /* ── where this track leaves, and how long the fade is ──────────────
       Phrase mode first (see the block at the top of the Player): the last
       phrase start the length allows, fade = one phrase. If there is no
       usable phrase — or phrase mode is off — the downbeat path below is
       exactly what it always was, with the set's xfade. */
    const P = PHR();
    const phA = (phrase && P) ? phraseOf(A.track) : null;
    let fade = xfade, exit = null, atPhrase = false;
    if (phA) {
      if (forceOut != null) {
        /* a blend-now / next chose the point; the fade is the phrase there */
        fade = phraseLenAt(P, beats, phA, forceOut - A.startedAt) || xfade; atPhrase = true;
      } else {
        const one = P.lengthAt(beats, phA.beat) || xfade;
        const nat = A.when(m.dur - A.entry) - one;
        const pf = m._dwell ? Math.max(MIN_PLAY, Math.min(m._dwell, nat)) : Math.max(MIN_PLAY, nat);
        const s = P.lastStartWithin(beats, phA, Math.min(MIN_PLAY, pf), pf);
        if (s) { exit = s.t; fade = P.lengthAt(beats, s.i) || xfade; atPhrase = true; }
      }
    }
    if (exit == null && forceOut == null) {
      const natural = naturalExit();
      const playFor = m._dwell
        ? Math.max(MIN_PLAY, Math.min(m._dwell, natural))
        : Math.max(MIN_PLAY, natural);
      /* An UNLOCKED track is one whose beat grid disagrees with its own tempo
         label, so snapping its exit to that grid would be snapping to a number
         we have already decided not to believe. It leaves on the clock instead.
         Honest, and it is what the classification is FOR — the alternative is
         to keep using a grid while calling it untrusted.

         AND nextDownbeatAfter() DOES EXACTLY THAT — it snaps to the grid with
         no `_unlocked` test, so blendNow, skip and reorder({now}) put the same
         track's exit on a downbeat this line refuses to use. The asymmetry is
         real and is stated at both ends rather than quietly settled: which
         policy is right is the keeper's ear's call, not a reading's. */
      exit = (beats.length && !m._unlocked) ? downbeatNear(beats, playFor) : playFor;
    }
    /* Decode before writing either deck's automation. A point that was
       future when decoding began can be past when it finishes. */
    const ni = idx + 1, nm = order[ni];
    let buf = preBuf;
    if (nm && !buf) {
      try { buf = await LIB.decode(nm, ctx); }
      catch (e) {
        if (my !== gen) return;
        recordIssue(nm, 'playback · skipped', e);
        log.unshift('SKIP ' + nm.name.slice(-30) + ' — ' + e.message);
        /* idx remains the PLAYING track. Remove only the failed successor,
           preserve a requested exit, then try the next one. */
        order.splice(ni, 1);
        return chain(forceOut);
      }
    }
    if (my !== gen || !A) return;
    let out = forceOut != null ? forceOut : A.startedAt + exit;
    /* ── AN EXIT IN THE PAST ──────────────────────────────────────────────
       chain() plans from the START of the playing track, so it assumes it is
       being called near the start. setPhrase() breaks that assumption: it
       cancels and re-chains WHENEVER the keeper flips the switch, and past
       roughly (length − xfade) the planned exit is behind the playhead. Web
       Audio then clamps every schedule to `currentTime` and plays them all at
       once, which is survivable — but `nd.startedAt = out` is NOT clamped, so
       the incoming deck's own clock is wrong by the overshoot for the rest of
       the track: `elapsed`, the progress bar, `blend.frac` and every downbeat
       nextExitAfter() computes from it are all out by that amount, and a
       later blend-now lands on nothing. Same class for the outgoing side —
       `A.outAt` would name a moment that has already gone.

       So: an exit that has already passed is moved to the next one that has
       not. The choice is made by the SAME rules the plan above used and adds
       no constant — the next phrase start in phrase mode, the next downbeat
       on a trusted grid, the clock on an untrusted one (chain()'s own policy;
       see nextDownbeatAfter for the asymmetry with the blendNow path). `lead`
       is 0: the next musical point at or after now, not one a chosen number of
       seconds away. Never fires on the ordinary path — chain() runs at the top
       of a track, where the exit is minutes ahead. */
    if (out < ctx.currentTime) {
      const since = ctx.currentTime - A.startedAt;
      const s = phA ? P.firstStartAfter(beats, phA, since) : null;
      if (s) { out = A.startedAt + s.t; fade = P.lengthAt(beats, s.i) || xfade; atPhrase = true; }
      else {
        atPhrase = false; fade = xfade;
        out = (beats.length && !m._unlocked) ? nextDownbeatAfter(0) : ctx.currentTime;
      }
    }
    const writeExit = () => {
      A.outAt = out; A.fade = fade;
      A.g.gain.setValueAtTime(1, out);
      A.g.gain.linearRampToValueAtTime(0, out + fade);
      /* bass swap — only one kick and one bassline sounds at a time */
      A.lo.gain.setValueAtTime(0, out);
      A.lo.gain.linearRampToValueAtTime(-30, out + fade * .45);
      A.src.stop(out + fade + .4);
    };
    if (ni >= order.length) { writeExit(); log.unshift('end of set'); return; }

    /* UNLOCKED: play it at its own speed. Stretching by `tempo / nm.bpm` uses
       the declared tempo, and the whole reason this track is unlocked is that
       its declared tempo and its beats disagree — so the stretch would be
       computed from the wrong number and land the beats somewhere else again.
       Rate 1 is the only rate here that is not a guess.

       Entry at 0 rather than at beats[0] for the same reason: beats[0] is a
       position on the grid we are not trusting. */
    const unlocked = !!nm._unlocked;
    const planned = rates(A.rateAt(out - A.startedAt));
    const rate = planned.rate;
    const nd = makeDeck({ meta: nm, buf }, rate, 'chain');
    nd.startedAt = out;
    nd.entry = unlocked ? 0 : ((nm.beats || [0])[0] || 0);
    /* Phrase mode: enter at the incoming track's own first phrase start, so
       its bar 1 lands on the outgoing track's bar 1. Its grid is trusted
       (it is locked, or it would be unlocked above) and the offset is at
       most seven bars into the track. */
    let inPhrase = false, phN = null;
    if (phrase && !unlocked) {
      phN = phraseOf(nd.track);
      if (phN && nm.beats && nm.beats[phN.beat] != null) { nd.entry = nm.beats[phN.beat]; inPhrase = true; }
    }
    /* Ride a stretched deck back to its own speed, if that is switched on.
       Scheduled HERE, before the exit is planned below, so the exit is chosen
       against the map that will actually apply — a ramp discovered after the
       schedule was written would move every downbeat under it. */
    const settled = planned.settled;
    nd.outgoingCurve = A.curve;
    if (!unlocked) {
      const at = out - A.startedAt;
      const phraseSource = atPhrase ? A.pos(at + fade) - A.pos(at) : null;
      if (settled) {
        const seconds = Math.max(1, settle.seconds);
        nd.setRamp(rate, 1, seconds, out);
        if (!m._unlocked) A.changeRate(planned.target / m.bpm, seconds, out);
        if (phraseSource != null && !m._unlocked) fade = A.when(A.pos(at) + phraseSource) - at;
      } else {
        /* The existing rolling target is now an AUDIO change, shared by
           both trusted decks over the existing crossfade. Previously only
           the number advanced; the outgoing source kept its old tempo. */
        if (phraseSource != null && !m._unlocked)
          fade = 2 * phraseSource / (A.rateAt(at) + planned.target / m.bpm);
        if (!m._unlocked) A.changeRate(planned.target / m.bpm, fade, out);
        nd.changeRate(planned.target / nm.bpm, fade, out);
      }
    }
    writeExit();
    nd.g.gain.setValueAtTime(0, out);
    nd.g.gain.linearRampToValueAtTime(1, out + fade * .6);
    nd.lo.gain.setValueAtTime(-30, out);
    nd.lo.gain.linearRampToValueAtTime(0, out + fade * .55);
    nd.src.start(out, nd.entry); nd.startedAt = out;
    B = nd;
    /* ¶ marks a phrase-mode transition: the outgoing track's phrase
       CONTRAST → the incoming track's, then the fade length. A · in place
       of a figure means that side had no usable phrase and took the
       downbeat path. Contrast is DWPHRASE's own ratio (worst offset over
       best; 1 = no preference) — printed so the keeper can pair what they
       hear with how sure the detector was, and for nothing else. */
    const mark = (atPhrase || inPhrase)
      ? ' ¶' + (atPhrase ? phA.contrast.toFixed(1) : '·') + '→' + (inPhrase ? phN.contrast.toFixed(1) : '·')
        + ' ' + Math.round(fade) + 's'
      : '';
    log.unshift('→ ' + nm.name.slice(-30) + (unlocked ? ' ∿free' : ' ×' + rate.toFixed(3))
                + ' ' + nm.camelot + (settled ? ' ⤳settling' : '') + mark
                /* a fetched track names its terms at every handover — the
                   log is where a mix's attribution can be read back */
                + (nm.source ? ' ☉ ' + (nm.source.creator || nm.source.item || '') + ' · '
                    + (nm.source.licenceName || nm.source.licence || 'licence unknown')
                    + (nm.source.kind ? ' · from ' + nm.source.kind : '') : ''));
    if (log.length > 60) log.pop();
    /* A settled deck ENDS at its own BPM, so the rolling target is that BPM
       and not the 35% drift toward it. Using the drift figure after a settle
       would compute the next deck's rate against a tempo nothing is playing.

       THE TWO STRAIGHT MODES MOVE THE TARGET DIFFERENTLY, and this is where
       playback has to agree with sequence(), resequenceTail() and verify()
       or every number they print is about a set that is not playing:

         'grid'   moves it NOWHERE. Its BPM is the figure we distrusted in
                  the first place; drifting toward it would spread one bad
                  grid across every transition after it. A parenthesis.
         'reach'  REPOSITIONS the target to its own BPM. Its grid is fine;
                  the set could not stretch to it; the entire reason for
                  playing it straight is to move the room to its tempo and
                  carry on mixing from there.

       Until 2026-08-19 this line treated both as 'grid'. The planner had
       re-based the set to the reach track's tempo and stamped every track
       after it accordingly; the deck had not, so the first locked track
       after a reach jump was chained at OLD target / its bpm — after the
       167 → 100 jump in LISTENING.md §5 that is ×1.67 on a track the plan
       printed at 0%. Found by reading chain() against sequence(); every
       harness checked the planner and none checked the deck. */
    nd.tempoBefore = tempo;                  /* so cancelPending() can undo the move below */
    tempo = planned.target;

    armHandover(ni, out);
  }

  /* The handover timer is a WALL-CLOCK setTimeout aimed at an AUDIO-CLOCK
     exit, and the two clocks part company the moment pause() suspends the
     context: currentTime stops, the timer does not. Until 2026-09-01 the
     timer fired anyway — a pause longer than the rest of the track handed
     over mid-pause: idx, nowMeta, the card and the route panel named the
     NEXT track while the paused one was what would resume (ledger 33's
     class from a new mechanism; review H1, ledger 123), and the next-next
     deck was chained and its timer armed early by the length of the pause.
     Now the callback asks the audio clock first. If the exit has not
     arrived it re-arms for exactly what is left; while suspended that wait
     is what remains after resume, so each re-arm halves the gap and the
     handover converges on the exit rather than drifting away from it.
     No statechange listener, no second clock: one question, asked of the
     clock the sources are scheduled on.

     WHICH WAY IT CAN BE WRONG, said exactly (the first version of this note
     claimed it could not fire late, and that is not what the code does):
     the handover always lands AT OR AFTER the audio exit — by the deliberate
     +100 ms in the ordinary case, and by however long a pause ran during the
     final wait otherwise. That is the safe direction. Early is the failure
     that matters: `idx`, `nowMeta`, the card and the route panel would name
     the next track while the paused one is what resumes. The audio itself is
     unaffected either way — every gain ramp and source start is scheduled on
     the audio clock, so the crossfade happens when it was written to; only
     the bookkeeping waits. */
  function armHandover(ni, out) {
    clearTimeout(chainTimer);
    chainTimer = setTimeout(() => {
      if (ctx && ctx.currentTime < out - 0.05) { armHandover(ni, out); return; }
      handover(ni);
    }, Math.max(0, (out - ctx.currentTime) * 1000) + 100);
  }

  /* The handover: B becomes A, idx moves, the next deck is planned. Named
     so the harness can fire it (the real timer is minutes away on a fake
     clock); nothing but chain()'s timer and the harness call it. */
  function handover(ni) {
    if (A) {
      /* remember what just handed over, with the rate it was running at:
         the crossfade outlives this moment by a whole xfade and the
         transition monitor needs the OUTGOING side from the engine, not
         from whichever frame the render loop last happened to see */
      handed = { meta: A.track.meta, points: A.ratePoints().map(p => ({ ...p })), startedAt: A.startedAt,
                 at: A.outAt == null ? ctx.currentTime : A.outAt, xfade: A.fade || xfade, gaps: A.gaps, underruns: A.underruns,
                 /* carried so the transition monitor can say `∿ first` on the
                    OUTGOING row of a fade out of a play()-built deck instead
                    of ×1.000 — the rate is 1 because nothing preceded it */
                 origin: A.origin };
      gapsHanded += A.gaps || 0;
      /* the instrument for a popping report: the worklet's own count of
         zero-filled blocks on the deck that just handed over. Printed
         only when it is not zero, so a clean set's log stays clean. */
      if (A.gaps > 0) log.unshift('⚠ ' + A.track.meta.name.slice(-30) + ' · ' + A.gaps + ' worklet gap' + (A.gaps === 1 ? '' : 's') + ' (×' + A.rate.toFixed(3) + ')');
      else if (!stretch.held && A.underruns > 60) log.unshift('⚠ ' + A.track.meta.name.slice(-30) + ' · ' + A.underruns + ' worklet underruns incl. warm-up (×' + A.rate.toFixed(3) + ')');
      A.track.buf = null;                             /* the meta's reference; the deck itself is released on its source's `ended` — releaseDeck */
    }
    idx = ni; A = B; B = null; chain();
  }

  return {
    async play(seq, from) {
      this.stop();
      const my = gen;                        /* cancellation covers EVERY await */
      await boot();
      if (my !== gen) return 'superseded';
      await ctx.resume();
      if (my !== gen) return 'superseded';
      handed = null;                         /* a fresh ▶ fades from nothing */
      const startIndex = from || 0, m = seq && seq[startIndex];
      if (!m) throw Error('no track to play');
      let buf;
      try { buf = await LIB.decode(m, ctx); }
      catch (e) {
        if (my !== gen) return 'superseded';
        recordIssue(m, 'playback', e);
        const error = Error(String(e.message || e));
        error.failures = [{ name: m.name, stage: 'playback', message: error.message }];
        throw error;
      }
      /* A second ▶ (or a stop) while this decode ran has already replaced
         the plan. Starting this deck too would put two sets on the air. */
      if (my !== gen) return 'superseded';
      order = seq; idx = startIndex;
      gapsHanded = 0;                        /* a fresh ▶ starts a fresh gap tally */
      phrase = !!seq.phrase;                 /* the build decides; setPhrase() can override after */
      tempo = m.bpm;
      const d = makeDeck({ meta: m, buf }, 1, 'play');
      /* Same reasoning as chain(): an unlocked track's beats[0] is a position
         on a grid we are not trusting, so start at the top of the file. The
         first deck already runs at rate 1, so nothing else changes. */
      d.entry = m._unlocked ? 0 : ((m.beats || [0])[0] || 0);
      const t0 = ctx.currentTime + .35;
      d.g.gain.setValueAtTime(0, t0); d.g.gain.linearRampToValueAtTime(1, t0 + 1);
      d.src.start(t0, d.entry); d.startedAt = t0;
      A = d; B = null;
      log.unshift('▶ ' + m.name.slice(-30) + ' @' + m.bpm.toFixed(1));
      chain();
      /* the rate the context actually runs at and its base latency, so a
         phone's log line carries the two numbers a popping report needs */
      return (idx + 1) + '/' + order.length + ' · ' + ctx.sampleRate + ' Hz' +
             (ctx.baseLatency ? ' · ' + Math.round(ctx.baseLatency * 1000) + ' ms buffer' : '') +
             (stretch.held ? ' · held worklet' : ' · plain worklet (' + stretch.why + ')');
    },
    /* stops EVERYTHING, including sources scheduled for a future time */
    stop() {
      gen++;                                 /* see cancelPending — in-flight plans are void */
      gapsHanded += ((A && A.gaps) || 0) + ((B && B.gaps) || 0);
      clearTimeout(chainTimer);
      let n = 0; live.forEach(s => { try { s.stop(); n++; } catch (e) {} });
      live.clear(); A = null; B = null; return 'stopped ' + n + ' sources';
    },
    /* last resort — always works, whatever state the graph is in */
    /* ── the mix as a MediaStream, for a phone's lock screen ──────────────
       WebKit suspends a Web Audio graph when the screen locks or Safari goes
       to the background; it keeps an HTMLMediaElement playing, which is how
       every web audio player that survives a locked iPhone does it. Whether
       a media element FED BY this graph (createMediaStreamDestination →
       <audio srcObject>) keeps the graph alive as well is NOT established —
       the public record has the question asked and not answered — so this
       is the experiment, behind DWPHONE's toggle, off by default.
       2026-08-19, on the device: it FELL — and WebKit's source says why:
       the graph is interrupted at lock unless navigator.audioSession.type
       is 'playback', which DWPHONE's `background` mode sets instead,
       leaving this sink alone. Kept callable for a later iOS.

       On: the compressor feeds a MediaStreamAudioDestinationNode INSTEAD of
       ctx.destination (both at once would be the mix twice, a few ms apart),
       and the stream is handed back for an <audio> element to play. Off:
       the speakers are wired back. The analyser tap is unaffected — it sits
       on master, upstream of this. Nothing about the signal changes; only
       which sink hears it. On Chromium this is harmless and pointless. */
    async outputStream(on) {
      await boot();
      if (on) {
        if (!msDest) msDest = ctx.createMediaStreamDestination();
        if (!viaStream) { try { comp.disconnect(ctx.destination); } catch (e) {} comp.connect(msDest); viaStream = true; }
        return msDest.stream;
      }
      if (viaStream) { try { comp.disconnect(msDest); } catch (e) {} comp.connect(ctx.destination); viaStream = false; }
      return null;
    },
    get outputVia() { return viaStream ? 'stream' : 'speakers'; },

    kill() { this.stop(); if (ctx) { try { ctx.close(); } catch (e) {} }
      ctx = null; booted = false; booting = null; return 'context closed'; },
    pause() { if (!ctx) return 'not started';
      if (ctx.state === 'running') { ctx.suspend(); return 'paused'; }
      ctx.resume(); return 'resumed'; },
    /* ── leaving a track early, without cutting ──────────────────────────
       "I am done with this one" — find the next musical opportunity and
       crossfade out of it, rather than waiting for the exit chain() planned
       at the top of the track or hard-cutting with play().

       Order matters here. The buffer is decoded BEFORE the transition point
       is chosen, because a FLAC decode takes real time and picking the point
       first would put it in the past by the time the audio was ready — which
       lands as a click, not a blend. */
    async blendNow(meta, opts) {
      if (!A || !ctx) return 'nothing playing';
      /* Blending the playing track into itself: placeNext() would pull it
         out from under idx and re-insert it one slot down, so the deck and
         the list name different tracks and the planned next track is
         skipped at the handover. The NOW row opens the menu like any other. */
      if (meta === A.track.meta) return 'already playing';
      opts = opts || {};
      let buf;
      try { buf = await LIB.decode(meta, ctx); }
      catch (e) { return 'cannot load: ' + e.message; }
      if (!A || !ctx) return 'nothing playing';     /* stopped while decoding */
      if (meta === A.track.meta) return 'already playing';   /* handed over to it meanwhile */
      cancelPending();
      placeNext(meta);
      const out = nextExitAfter(opts.lead != null ? opts.lead : 1.2);
      await chain(out, buf);
      return 'blending in ' + Math.max(0, out - ctx.currentTime).toFixed(1) + 's · ' +
             meta.name.slice(-30);
    },

    /* Change what comes next, leaving the current track to finish as planned.
       Also has to cancel first: the old next deck is already in the graph. */
    async queueNext(meta) {
      if (!A || !ctx) return 'nothing playing';
      if (meta === A.track.meta) return 'already playing';   /* see blendNow */
      let buf;
      try { buf = await LIB.decode(meta, ctx); }
      catch (e) { return 'cannot load: ' + e.message; }
      if (!A || !ctx) return 'nothing playing';     /* stopped while decoding */
      if (meta === A.track.meta) return 'already playing';
      cancelPending();
      placeNext(meta);
      await chain(undefined, buf);
      return 'next: ' + meta.name.slice(-30);
    },

    /* ── handing the player a whole new order, mid-set ───────────────────
       PATCH 09'S BUG, THIRD OCCURRENCE, and the one the keeper caught by ear:
       "quick blend just seems to sit there."

       Everything that changed what comes next went through placeNext(), which
       mutates `order` IN PLACE — safe precisely because the dashboard holds
       that same array object. A ROUTE is not one track: it splices several
       stepping stones in and re-plans the whole tail, so DWNAV.commitAndRepair
       builds a NEW array. There was no way to give that array to the player,
       so the dashboard assigned it to itself alone. The list showed a route;
       `order` still held the pre-route set; the deck walked the old one. Every
       scenic route and every fast blend was inert in audio and correct on
       screen — which is why it looked like nothing happened.

       Falsifier, and the regression test: DW.nowMeta must be === set[state.idx]
       at all times. Under the bug it stops being, the moment a route commits.

       ADOPTS the caller's array rather than copying into ours, because a copy
       would leave two equal-but-separate arrays and put the desync straight
       back. The playing track must still sit at idx afterwards — otherwise
       state.idx and the deck stop naming the same track, which is the failure
       recorded in chain()'s decode-error note. That is refused, not repaired.

       Re-chains, because chain() committed the next deck the instant this
       track started and that decision predates the new order. `now: true`
       also leaves the current track at the next downbeat — what "⚡ blend
       fast" means, as against "↝ scenic route" which lets it finish. */
    async reorder(seq, opts) {
      opts = opts || {};
      if (!Array.isArray(seq) || !seq.length) return 'refused: empty order';
      if (!A || !ctx) { order = seq; idx = Math.min(idx, seq.length - 1); return 'order replaced · not playing'; }
      if (seq[idx] !== A.track.meta)
        return 'refused: ' + (A.track.meta.name || '?').slice(-30) + ' is playing but is not at index ' + idx;
      /* a committed route is a NEW array; keep the build's facts on it.
         `phrase` drives the Player; `mode` and `poolSize` are what inspect()
         and a saved score report; `leftOut` is the gate's list minus
         whatever the route just pulled in (review 2026-09-01) */
      if (typeof opts.phrase === 'boolean') phrase = opts.phrase;
      seq.phrase = phrase;
      if (order && order !== seq) {
        if (seq.mode === undefined && order.mode !== undefined) seq.mode = order.mode;
        if (seq.poolSize === undefined && order.poolSize !== undefined) seq.poolSize = order.poolSize;
        if (seq.leftOut === undefined && Array.isArray(order.leftOut)) seq.leftOut = order.leftOut.filter(t => !seq.includes(t));
      }
      order = seq;
      cancelPending();
      const nm = order[idx + 1];
      if (!nm) { await chain(); return 'reordered · nothing after this'; }
      if (!opts.now) { await chain(); return 'reordered · ' + (order.length - idx - 1) + ' ahead'; }
      /* `now` decodes the incoming track BEFORE choosing the downbeat, for
         the reason blendNow() gives: a FLAC decode takes real time and a
         point chosen first would be in the past by the time audio was ready.
         But cancelPending() has already run, so until chain() is called again
         the playing deck has NO exit and NO handover timer. A decode failure
         used to return here and leave it that way — the track played to its
         end and the set stopped dead. Now it falls back to chain(), which
         re-plans the exit, meets the same failure, splices the track out of
         the order and carries on, exactly as a failed decode mid-set does. */
      let buf;
      try { buf = await LIB.decode(nm, ctx); }
      catch (e) {
        if (A && ctx) await chain();
        return 'reordered, but cannot load ' + nm.name.slice(-30) + ': ' + e.message +
               ' — skipped, this track finishes as planned';
      }
      if (!A || !ctx) return 'reordered · stopped while loading';
      /* A handover during the decode moves idx; the buffer then belongs to a
         track that is no longer next. Let chain() decode its own in that case. */
      const out = nextExitAfter(opts.lead != null ? opts.lead : 1.2);
      await chain(out, order[idx + 1] === nm ? buf : undefined);
      return 'reordered · leaving in ' + Math.max(0, out - ctx.currentTime).toFixed(1) + 's · ' +
             (order.length - idx - 1) + ' ahead';
    },

    /* ── next ─────────────────────────────────────────────────────────────
       Keeper, 2026-08-19: "the next button should default to a reasonable
       blend asap." It was a hard cut — play(order, idx + 1) — which is what a
       CD player's next does, not a DJ's. Now: decode the next track, leave
       this one at the next downbeat at least 1.2 s out (the same lead
       blendNow and ⚡ blend fast use), and crossfade over the set's xfade.
       The fade LENGTH is the set's own setting (Player.setXfade — NOT on
       the DW facade, so today nothing but a harness can move it from 16 s),
       deliberately — "reasonable" is whatever the keeper set for every other
       transition, and a second number for next would be one more chosen
       constant. { cut: true } is the old behaviour, kept for the console and
       for when nothing is on the air (the first ▶ after a stop is a cut by
       definition). The lock screen's ▶▶ lands here too. */
    async skip(opts) {
      opts = opts || {};
      if (idx + 1 >= order.length) return 'end';
      if (!A || !ctx || opts.cut) return this.play(order, idx + 1);
      const nm = order[idx + 1];
      let buf;
      try { buf = await LIB.decode(nm, ctx); }
      catch (e) { return 'cannot load ' + nm.name.slice(-30) + ': ' + e.message; }
      if (!A || !ctx) return 'stopped while loading';
      /* a handover during the decode moved idx: the deck is now ON the track
         we were about to blend into — nothing to do, and chain() already
         planned what follows it */
      if (A.track.meta === nm) return 'already on ' + nm.name.slice(-30);
      if (order[idx + 1] !== nm) return 'order changed while loading — press again';
      cancelPending();
      const out = nextExitAfter(opts.lead != null ? opts.lead : 1.2);
      await chain(out, buf);
      return 'next · blending in ' + Math.max(0, out - ctx.currentTime).toFixed(1) + 's over ' +
             Math.round((A && A.fade) || xfade) + 's' + (phrase ? ' ¶' : '') + ' · ' + nm.name.slice(-30);
    },
    async back() { return this.play(order, Math.max(0, idx - 1)); },
    setXfade(s) { xfade = Math.max(2, Math.min(60, s)); return xfade; },
    /* Phrase mode, live. play() sets it from the build; this overrides for
       the set on the air and re-plans the pending transition so the change
       is heard on the next blend, not the one after. */
    async setPhrase(on) {
      phrase = !!on;
      if (order) order.phrase = phrase;
      if (A && ctx) { cancelPending(); await chain(); }
      return phrase ? 'phrase mode on' : 'phrase mode off';
    },
    get phrase() { return phrase; },
    /* the phrase offset of a meta, if the deck has computed one */
    phraseOf(meta) { return meta && meta.phrase && meta.phrase.ok ? meta.phrase : null; },
    /* `tempo` is ROUNDED — it is a readout, and a header saying 128.4 bpm
       would be a chosen precision the number does not have. `tempoExact` is
       the rolling target the engine actually chains against, unrounded, for
       the one caller that RE-PLANS from it: DWNAV.commit recomputes every
       `_stretch` after a splice as target / bpm, and doing that from the
       rounded figure made the plan disagree with the deck by up to 0.4%
       (review 2026-09-01). Not audible; a printed number that is simply not
       the number the engine used. Display reads `tempo`; arithmetic reads
       `tempoExact`. */
    get state() { return { idx, of: order.length, tempo: Math.round(tempo), tempoExact: tempo,
      now: A ? A.track.meta.name : null, next: B ? B.track.meta.name : null,
      live: live.size, ctx: ctx ? ctx.state : 'none',
      worklet: stretch.held ? 'held' : 'plain', gaps: A ? A.gaps : null,
      /* the session: gaps on every deck that has handed over, plus the two live */
      gapsTotal: gapsHanded + ((A && A.gaps) || 0) + ((B && B.gaps) || 0),
      sampleRate: ctx ? ctx.sampleRate : null,
      baseLatency: ctx && ctx.baseLatency ? +ctx.baseLatency.toFixed(4) : null }; },
    get log() { return log; },
    get issues() { return issues; },
    clearIssues() { issues.length = 0; },
    get analyser() { return analyser; },

    /* The META OBJECT on the playing deck, not its name. `state.now` is a
       string and two tracks can share one; identity cannot. Every check that
       the list and the deck still agree is `set[state.idx] === DW.nowMeta`,
       so it has to be the object. */
    get nowMeta() { return A ? A.track.meta : null; },
    /* Shared with steering callers; replace through reorder(), never assign
       an unrelated displayed array while a deck still owns this one. */
    get playOrder() { return order; },
    get planningTempo() { return B && ctx.currentTime <= B.startedAt && B.tempoBefore != null ? B.tempoBefore : tempo; },
    get nextMeta() { return B ? B.track.meta : null; },
    /* The deck that most recently HANDED OVER, while its fade is still
       running: meta, the rate it ran at, and how far into the crossfade we
       are. null once the fade is done or nothing has handed over. */
    get prevDeck() {
      if (!handed || !ctx || !A) return null;
      const el = ctx.currentTime - handed.at;
      if (el > handed.xfade) return null;
      /* Copy scalar automation only: keeping the old deck here would also
         retain its graph and decoded source. */
      const t = ctx.currentTime - handed.startedAt;
      let previous = handed.points[0], rate = previous.v;
      for (const point of handed.points.slice(1)) {
        if (t < point.t) {
          rate = point.linear ? previous.v + (point.v - previous.v) * Math.max(0, t - previous.t) / (point.t - previous.t) : previous.v;
          break;
        }
        previous = point; rate = point.v;
      }
      return { meta: handed.meta, name: handed.meta.name, rate,
               fadeElapsed: el, xfade: handed.xfade, prog: Math.max(0, Math.min(1, el / handed.xfade)),
               gaps: handed.gaps,
               /* see makeDeck: 'play' means nothing preceded this deck, so its
                  rate is 1 by construction and no stretch may be printed */
               origin: handed.origin || null, matched: handed.origin === 'chain' };
    },
    /* The deck that is SCHEDULED, with the rate it was built at — so a panel
       can print what the incoming deck will actually do instead of the plan's
       `_stretch`, which agrees with it only while the set plays as planned. */
    get nextDeck() {
      if (!B) return null;
      const m = B.track.meta;
      return { meta: m, name: m.name, bpm: m.bpm, camelot: m.camelot, rate: B.rateAt(Math.max(0, ctx.currentTime - B.startedAt)),
               straight: !!m._unlocked, reason: m._unlockReason || null,
               startsAt: B.startedAt, entry: B.entry, gaps: B.gaps,
               /* always 'chain' today — B is built nowhere else — but read,
                  not assumed, so a future scheduling path cannot lie here */
               origin: B.origin, matched: B.origin === 'chain' && !m._unlocked };
    },

    /* What the deck is actually doing right now, as against what was planned.
       `rate` is the value at this instant — under a settle ramp it moves, so
       reading A.rate (the value it STARTED at) would be a stale number
       presented as a live one. */
    get deck() {
      if (!A || !ctx) return null;
      const el = Math.max(0, ctx.currentTime - A.startedAt);
      const r = A.rateAt(el), m = A.track.meta;
      return { meta: m, name: m.name, bpm: m.bpm, camelot: m.camelot,
               rate: r, startRate: A.rate, playedBpm: m.bpm * r,
               stretchPct: +((r - 1) * 100).toFixed(2),
               settling: !!A.ramp && el < A.ramp.S,
               settleLeft: A.ramp ? Math.max(0, A.ramp.S - el) : 0,
               dwell: m._dwell || null, stepping: !!m._stepping, elapsed: el,
               /* WHO BUILT THIS DECK — see makeDeck. 'play' is the first ▶,
                  a jumped-to row or back(); 'chain' is the only path that
                  beatmatches. `matched` is the one question every surface
                  printing a stretch figure actually has: is this deck being
                  beatmatched against anything? A straight (unlocked) track
                  is not, even on the chain path. */
               origin: A.origin, matched: A.origin === 'chain' && !m._unlocked,
               /* the worklet's zero-filled blocks on this deck so far (null
                  until its first metrics message, ~0.3 s in) */
               gaps: A.gaps, underruns: A.underruns, worklet: stretch.held ? 'held' : 'plain' };
    },
    /* which worklet the decks are built on, and why — see `stretch` */
    get worklet() { return Object.assign({}, stretch); },

    /* The floor chain() clamps every dwell to. Exposed so the fast-route menu
       can print the number that will actually be honoured instead of the one
       it asked for — see MIN_PLAY. */
    get dwellFloor() { return MIN_PLAY; },

    /* Live config for the settle ride. Mutable on purpose; see the block at
       the top of the Player for what turning it on changes. */
    get settle() { return settle; },

    /* Seconds into the current track, in context time. The render loop needs
       this to work out when the next blend begins; dash.elapsed was declared
       for it and never assigned by anything, so every countdown was computed
       against zero and never moved. */
    get elapsed() {
      if (!A || !ctx) return 0;
      return Math.max(0, ctx.currentTime - A.startedAt);
    },

    /* WHERE THE NEXT BLEND ACTUALLY IS, read from the schedule rather than
       recomputed from the track length.

       This matters because the two can disagree. chain() picks the exit by
       snapping to a downbeat near the nominal point, and blendNow() rewrites
       A.outAt outright to a downbeat a second or so away. Anything deriving
       the transition from (duration - crossfade) is therefore wrong twice:
       out by the downbeat snap always, and completely wrong the moment a
       blend-now happens. A.outAt is what the gain ramps are scheduled
       against, so it is the only honest source.

       Returns null when nothing is playing or no exit has been scheduled.
       `at` and `dur` are in real seconds of playback, already through the
       stretch rate, so a caller can use them as a fraction directly. */
    get blend() {
      if (!A || !ctx || A.outAt == null) return null;
      const dur = A.when(A.track.meta.dur - A.entry);
      const at = A.outAt - A.startedAt;
      const f = A.fade || xfade;             /* one phrase in phrase mode, the set's xfade otherwise */
      return { in: A.outAt - ctx.currentTime, at, dur, xfade: f,
               frac: dur > 0 ? Math.max(0, Math.min(1, at / dur)) : 0,
               fadeFrac: dur > 0 ? Math.max(0, Math.min(1, f / dur)) : 0 };
    },

    /* Master level, 0..1. Independent of everything else on the machine —
       Web Audio output belongs to this page's AudioContext, so it cannot
       touch other tabs or applications.
       setTargetAtTime rather than a direct assignment: stepping a gain value
       mid-playback clicks. 0.02s is a smoothing constant for the control, not
       a calibration of any signal. */
    /* ── debugging seam. NOT API. ───────────────────────────────────────
       This project was built by injecting code into a running page, and that
       worked because everything hung off window globals. Packaging it into
       modules with private state is what made it a real package — and the
       same move removed the ability to change anything without a reload,
       which costs a playing set every time.

       So: read access to the internals, plus the few setters an externally
       written operation needs to put state back. Enough to compose NEW
       behaviour from outside while audio runs. Not enough to replace chain()
       itself, which would need indirection through a mutable reference — and
       that is a bigger hole than this is worth.

       Two rules:
         Nothing inside this application may ever read _dev. If a feature
         needs something here, expose it properly instead.
         It is unstable by definition. Anything built on it is a session
         experiment, not a change — port it into the module to keep it.

       `live` in particular is private for a reason: the stop button once
       failed because scheduled sources were only reachable through the deck
       pointers, and a source scheduled for the future is reachable no other
       way. Reaching in here means you can recreate that bug by hand. */
    get _dev() {
      return {
        get ctx() { return ctx; }, get master() { return master; },
        get A() { return A; },     get B() { return B; },
        get order() { return order; }, get idx() { return idx; },
        get tempo() { return tempo; }, get xfade() { return xfade; },
        get live() { return live; }, get phrase() { return phrase; }, get stretch() { return stretch; },
        chain, handover, cancelPending, placeNext, nextDownbeatAfter, nextExitAfter, phraseOf, makeDeck, downbeatNear,
        setIdx(i) { idx = i; },
        setTempo(t) { tempo = t; },
        setDecks(a, b) { if (a !== undefined) A = a; if (b !== undefined) B = b; }
      };
    },

    get volume() { return volume; },
    set volume(v) {
      v = +v;
      if (!isFinite(v)) return;
      volume = Math.max(0, Math.min(1, v));
      if (master && ctx) master.gain.setTargetAtTime(volume, ctx.currentTime, .02);
      else if (master) master.gain.value = volume;
    }
  };
})();

/* ── public API ────────────────────────────────────────────────────────── */
let corpus = [];
return {
  /* assets.allowCDN = true re-enables runtime fetching of third-party code.
     Off by default on purpose — see the ASSETS comment at the top. */
  assets: ASSETS,
  DB, LIB, Player, analyse, walk, sequence, dedupe, camelot, camScore, normalise, arc,
  retune, get tune() { return tuneMode; },
  get corpus() { return corpus; },

  /* one pick, whole tree, cached — safe to re-run after adding music */
  /* ── adding music ──────────────────────────────────────────────────────
     Everything that brings files in goes through ingest(), and ingest MERGES.
     scan() and LIB.pick() both used to assign corpus = [] and a fresh Map, so
     picking a second folder silently discarded the first — which made "add
     the rest of my library" impossible without a rescan of everything.

     Dedupe is by record id (name|size|lastModified), so re-adding a folder you
     already have costs an IndexedDB hit per track and changes nothing.

     normalise() re-runs across the WHOLE corpus afterwards, not just the new
     records: energy is a constructed index scaled to the corpus min and max,
     so adding material can legitimately move every existing track's figure. */
  async ingest(files, onProgress) {
    await bootEssentia();
    const have = new Set(corpus.map(t => t.id));
    let added = 0, cached = 0, failed = 0, dupe = 0, uncached = 0;
    const failures = [];
    if (!LIB.files) LIB.files = new Map();
    for (let i = 0; i < files.length; i++) {
      if (onProgress) onProgress(i + 1, files.length, files[i].name);
      LIB.add(files[i]);
      try {
        const r = await analyse(files[i]);
        /* the record's camelot code follows the CURRENT tune, whatever tune
           was live when the cache stamped it — otherwise a cache hit from
           one tune sits beside a fresh analysis in the other and camScore
           compares the two (the mixed-corpus trap, ultra review E1) */
        r.camelot = camelot(r.key, r.scale);
        /* A fetched file (DWLIBRE's RemoteFile) carries its licence and
           attribution as `source`; it rides on the record from here — the
           analysis cache never sees it, the score and the card do. */
        if (files[i].source) r.source = files[i].source;
        if (have.has(r.id)) { dupe++; continue; }
        have.add(r.id); corpus.push(r); added++;
        if (r.cached) cached++;
        if (r.uncached) uncached++;
      } catch (e) { failed++; failures.push({ name: files[i].name, stage: 'analysis', message: String(e.message || e) }); console.warn(files[i].name, e.message); }
    }
    normalise(corpus);
    if (uncached) console.warn('deckwave: ' + uncached + ' record(s) could not be written to the analysis cache (storage refused) — they will be re-analysed next load');
    return { seen: files.length, added, cached, failed, failures, uncached, duplicates: dupe, corpus: corpus.length };
  },

  /* Individual tracks, multi-select. showOpenFilePicker takes many files in
     one gesture; showDirectoryPicker takes exactly one folder, which is a
     browser limitation and not something this can work around. */
  async addFiles(onProgress) {
    let files = [];
    if (window.showOpenFilePicker) {
      /* picker FIRST, synchronously in the gesture; Essentia boots inside ingest() */
      const handles = await window.showOpenFilePicker({
        multiple: true,
        types: [{ description: 'Audio', accept: { 'audio/*': AUDIO_EXT } }]
      });
      for (const h of handles) files.push(await h.getFile());
    } else {
      files = await pickViaInput({ directory: false });
      if (!files.length) throw new Error('nothing picked');
    }
    return this.ingest(files, onProgress);
  },

  /* A drop can carry SEVERAL folders and loose files at once, which is the
     only way to select more than one folder in a single gesture. */
  async addDropped(dataTransfer, onProgress) {
    /* Collect the handle promises SYNCHRONOUSLY, then await them together.
       A DataTransferItemList is only valid during the drop event itself: the
       first await yields, the list is neutered, and every item after the
       first is gone. Awaiting inside this loop meant exactly one file or
       folder ever arrived, however many were dropped. */
    const pending = [];
    for (const item of dataTransfer.items) {
      if (item.kind !== 'file') continue;
      if (item.getAsFileSystemHandle) pending.push(item.getAsFileSystemHandle());
    }
    const roots = (await Promise.all(pending)).filter(Boolean);
    const files = [];
    for (const h of roots) {
      if (h.kind === 'directory') { const f = await walk(h); files.push(...f); }
      else { const f = await h.getFile(); if (AUDIO_RE.test(f.name)) files.push(f); }
    }
    if (!files.length) throw new Error('nothing audio in that drop');
    return this.ingest(files, onProgress);
  },

  /* Start over. Only the in-memory corpus — the IndexedDB analysis cache is
     deliberately untouched, so re-adding is fast and nothing expensive dies. */
  clear() {
    corpus.length = 0; LIB.files = new Map(); LIB.dir = null;
    return 'corpus cleared';
  },

  async scan(onProgress) {
    /* Picker FIRST — before Essentia boots — so WebKit still counts this as
       inside the click. Used to boot first, which Chromium tolerates and
       Safari does not. */
    let files, via;
    if (window.showDirectoryPicker) {
      const dir = await window.showDirectoryPicker({ mode: 'read' });
      files = await walk(dir);
      LIB.dir = dir; via = 'fs-access';
    } else {
      /* Chromium-without-FS-Access (Android Chrome < 132, WebView), Firefox,
         Safari, iOS: a folder through the input where that is safe, otherwise
         the files multi-select — reported in `via` so the UI can say which. */
      const folder = folderInputUsable();
      files = await pickViaInput({ directory: folder });
      via = folder ? 'folder-input' : 'files-input';
      if (!files.length) throw new Error('nothing picked');
    }
    const r = await this.ingest(files, onProgress);
    return { files: files.length, analysed: r.corpus, cached: r.cached,
             failed: r.failed, failures: r.failures, uncached: r.uncached, added: r.added, duplicates: r.duplicates, via };
  },

  /* how much to trust the tempo figures, before anyone quotes them */
  confidence() {
    if (!corpus.length) return 'empty';
    const c = corpus.map(t => t.conf).sort((a, b) => a - b);
    const med = c[c.length >> 1];
    return { median: +med.toFixed(3), weak: corpus.filter(t => t.conf < 1).length,
      strong: corpus.filter(t => t.conf >= 2).length, of: c.length,
      note: 'Essentia scale is 0–5.32; 1.5–3.5 is moderately confident. ' +
            'NOT comparable to any other detector\u2019s confidence number.' };
  },

  build(opts) { return sequence(corpus, opts); },
  /* Preparation cannot restamp metadata on a playing deck. The planner only
     writes top-level annotations; analysis arrays and source attribution
     remain read-only shared data. Keep build()'s live-patching contract.

     ── ledger 137 (2026-09-30): the CLASSIFICATION still goes on the originals.
     The plan (`_stretch`, `_tempoAt`, the order) is built on copies so a
     Build can never restamp the deck. But the router plans over the
     originals, commit() stamps `_stretch` on a stepping stone and never
     `_unlocked`, and nav-commit's gridOK reads an UNSTAMPED track as locked —
     so with the originals left bare, a stone above the grid cut was stretched
     to the rolling target on a grid the project does not trust. build() had
     always stamped the originals; this restores exactly that half of it: the
     cut's verdict and the straight mark for a track above it, never the plan.
     check-pool's ledger-137 block is the falsifier. */
  prepare(opts) {
    classifyPool(corpus, opts).forEach(t => {
      if (t._locked) { delete t._unlocked; delete t._unlockReason; }
      else { t._unlocked = true; t._unlockReason = 'grid'; }
    });
    return sequence(corpus.map(t => ({ ...t })), opts);
  },

  /* Live setting for what counts as a trustworthy grid. Rebuild to apply.
     Derived from the corpus rather than chosen — see LOCK. */
  get lock() { return LOCK; },

  /* ── who can be beatmatched, and who merely played ─────────────────────
     Answers the question the old confidence gate answered badly, and shows
     its working: the declared tempo, what the beats actually say, and the
     disagreement between them. Run it before building if you want to know
     what the set is about to do.

     `wouldChange` is the honest part: the tracks whose classification flips
     if the threshold moves to the OTHER defensible value. If that list is
     empty the threshold does not matter here; if it is long, it is the list
     to listen to. */
  classify(opts) {
    opts = opts || {};
    const cut = opts.maxGridErr != null ? opts.maxGridErr : LOCK.maxGridErrPct;
    const alt = opts.alt != null ? opts.alt : 3;
    const rows = dedupe(corpus, opts)
      .filter(t => t.bpm > 60 && t.dur > 75)
      .map(t => { const e = gridError(t);
        return { name: t.name, bpm: t.bpm, conf: t.conf, beats: (t.beats || []).length,
                 gridBpm: e == null ? null : +(60 * ((t.beats.length - 1) /
                            (t.beats[t.beats.length - 1] - t.beats[0]))).toFixed(2),
                 gridErrPct: e == null ? null : +e.toFixed(2),
                 locked: e != null && e <= cut }; });
    const unlocked = rows.filter(r => !r.locked);
    return {
      cut, tracks: rows.length,
      locked: rows.length - unlocked.length, unlocked: unlocked.length,
      /* the old gate, for comparison — this is the claim that it had it backwards */
      oldGateWouldDrop: rows.filter(r => r.conf <= 0.8).length,
      admittedByOldGateButUngriddable: rows.filter(r => r.conf > 0.8 && !r.locked),
      excludedByOldGateButFine: rows.filter(r => r.conf <= 0.8 && r.locked)
                                    .map(r => r.name + '  (' + r.gridErrPct + '%)'),
      wouldChangeAt: { threshold: alt,
        flips: rows.filter(r => r.gridErrPct != null &&
                 ((r.gridErrPct <= cut) !== (r.gridErrPct <= alt)))
                   .map(r => r.name + '  (' + r.gridErrPct + '%)') },
      unlockedList: unlocked.sort((a, b) => (b.gridErrPct || 999) - (a.gridErrPct || 999)),
      note: 'gridErrPct is disagreement between the declared tempo and the mean ' +
            'spacing of the detected beats. It is beatmatch error, not a quality ' +
            'judgement: an unlocked track still plays, unstretched.'
    };
  },

  /* report BEFORE playing: stretch budget, key quality, runtime */
  inspect(seq) {
    if (!seq || !seq.length) return 'empty';
    let perfect = 0, good = 0, weak = 0, maxS = 0;
    for (let i = 1; i < seq.length; i++) {
      const c = camScore(seq[i - 1].camelot, seq[i].camelot);
      if (c >= .85) perfect++; else if (c >= .45) good++; else weak++;
      maxS = Math.max(maxS, Math.abs((seq[i]._stretch || 1) - 1));
    }
    /* maxStretchPct is computed over LOCKED tracks only. An unlocked track
       has _stretch === 1 by construction, so including it would quietly pull
       the average toward "everything is fine" — it is not stretched because
       it is not being beatmatched, which is a different fact. */
    const left = seq.leftOut || [];
    return { tracks: seq.length,
      mode: seq.mode || 'all',
      phrase: !!seq.phrase,
      /* 'best' only: what the pool held that this build did not place, and why */
      leftOut: left.length,
      leftOutGrid: left.filter(t => !t._locked).length,
      leftOutReach: left.filter(t => t._locked).length,
      poolSize: seq.poolSize || seq.length,
      straight: seq.filter(t => t._unlocked).length,
      straightGrid: seq.filter(t => t._unlockReason === 'grid').length,
      straightReach: seq.filter(t => t._unlockReason === 'reach').length,
      runtimeMin: Math.round(seq.reduce((a, t) => a + t.dur, 0) / 60),
      maxStretchPct: +(maxS * 100).toFixed(1),
      tempoStart: seq[0].bpm, tempoEnd: seq[seq.length - 1].bpm,
      energyStart: seq[0].energy, energyPeak: Math.max(...seq.map(t => t.energy)),
      energyEnd: seq[seq.length - 1].energy,
      keyPerfect: perfect, keyGood: good, keyWeak: weak };
  },

  async openLibrary() { return LIB.pick(); },
  async play(seq, from) { return Player.play(seq, from); },
  /* Player has had both of these all along; only the public wrappers were
     missing, so DW.skip / DW.back were undefined on the packaged build even
     though the transport's next button and patch 09's own diagnostic both
     assume they exist. */
  async skip(opts) { return Player.skip(opts); },
  /* phrase mode: on for a `build · phrase match` set, switchable live */
  async setPhrase(on) { return Player.setPhrase(on); },
  get phrase() { return Player.phrase; },
  /* which worklet the decks run on — 'deckwave-stretch' (held block) or the
     plain vendored one — and why; see the Player's `stretch` block */
  get worklet() { return Player.worklet; },
  async back() { return Player.back(); },
  async blendNow(meta, opts) { return Player.blendNow(meta, opts); },
  async queueNext(meta) { return Player.queueNext(meta); },
  async reorder(seq, opts) { return Player.reorder(seq, opts); },
  /* see Player._dev — unstable, for live patching, never read by this app */
  get _dev() { return Player._dev; },
  stop() { return Player.stop(); },
  kill() { return Player.kill(); },
  pause() { return Player.pause(); },
  get state() { return Player.state; },
  /* The engine's own event log — '▶', '→', 'SKIP <reason>', 'end of set'.
     Player has had it all along and nothing could reach it: it was missing
     from this facade AND from _dev, so a track that failed to decode wrote
     its reason into an array with no reader. A silent SKIP is indistinguishable
     from a track that simply never came up. */
  get log() { return Player.log; },
  get issues() { return Player.issues; },
  clearIssues() { Player.clearIssues(); },
  get elapsed() { return Player.elapsed; },
  get blend() { return Player.blend; },
  get nowMeta() { return Player.nowMeta; },
  get playOrder() { return Player.playOrder; },
  get planningTempo() { return Player.planningTempo; },
  get nextMeta() { return Player.nextMeta; },
  get nextDeck() { return Player.nextDeck; },
  get prevDeck() { return Player.prevDeck; },
  get deck() { return Player.deck; },
  get dwellFloor() { return Player.dwellFloor; },
  get settle() { return Player.settle; },

  /* ── does this set actually PLAY? ───────────────────────────────────────
     "Songs with brackets in the title won't load" is a report about a handful
     of tracks, and the engine's answer to a track that will not decode is to
     log one line and splice it out of the order — which is invisible unless
     you are watching the log at the moment it happens.

     This decodes every track in a set for real and returns the failures with
     their messages. Not a pixel count, not a DOM check: the pass condition is
     that decodeAudioData returned a buffer, which is the same call playback
     makes, so a pass here cannot be a pass for the wrong reason.

     It is expensive — it decodes the whole library — so it is a button, not
     a loop. Buffers are dropped immediately; only the verdict is kept. */
  async audit(seq, onProgress) {
    seq = seq && seq.length ? seq : corpus;
    if (!seq.length) return 'nothing to audit';
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC({ sampleRate: 44100 });
    const bad = [], ok = [];
    for (let i = 0; i < seq.length; i++) {
      const t = seq[i];
      if (onProgress) onProgress(i + 1, seq.length, t.name);
      const f = LIB.find(t);
      if (!f) { bad.push({ name: t.name, stage: 'find', why: 'no file matches this name' }); continue; }
      try { await f.slice(0, 16).arrayBuffer(); }
      catch (e) { bad.push({ name: t.name, stage: 'read', why: String(e && e.message || e) }); continue; }
      try {
        /* the SAME call playback makes — native first, libflac if refused */
        const buf = await decodeAudio(ctx, f);
        ok.push({ name: t.name, sr: buf.sampleRate, ch: buf.numberOfChannels,
                  dur: +buf.duration.toFixed(1), metaDur: t.dur, decoder: buf._decoder });
      } catch (e) {
        bad.push({ name: t.name, stage: 'decode', bytes: f.size,
                   why: String((e && e.message) || e) || (e && e.name) || 'decodeAudioData rejected' });
      }
    }
    try { ctx.close(); } catch (e) {}
    return { checked: seq.length, playable: ok.length, failed: bad.length, failures: bad,
      /* files the browser refused and libflac took — worth knowing on a
         browser where that is every FLAC */
      viaLibflac: ok.filter(r => r.decoder === 'libflac').map(r => r.name),
      /* metaDur is the duration ANALYSIS recorded; buf.duration is what the
         decoder just produced. A gap between them means the grid is being
         mapped onto a different length of audio than it was measured on. */
      durationMismatch: ok.filter(r => r.metaDur && Math.abs(r.dur - r.metaDur) > 1)
                          .map(r => ({ name: r.name, decoded: r.dur, analysed: r.metaDur })) };
  },

  get volume() { return Player.volume; },
  set volume(v) { Player.volume = v; },
  async outputStream(on) { return Player.outputStream(on); },
  get outputVia() { return Player.outputVia; },

  /* What this browser can and cannot do, asked rather than assumed. The
     boot screen reads it; so can a bug report. */
  get platform() {
    const inp = document.createElement('input');
    return {
      fsAccess: !!window.showDirectoryPicker,
      fileInput: 'files' in inp,
      folderInput: 'webkitdirectory' in inp,
      displayCapture: !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia),
      mic: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
      audioWorklet: !!(AC && AC.prototype && 'audioWorklet' in AC.prototype),
      wasm: typeof WebAssembly === 'object',
      flacFallback: !!window.DWFLAC,
      folderInputUsable: folderInputUsable(),
      webkit: /AppleWebKit/.test(navigator.userAgent) && !/Chrome|Chromium|Edg\//.test(navigator.userAgent),
      ios: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1),
      android: /Android/.test(navigator.userAgent),
      chromium: (/Chrome\/(\d+)/.exec(navigator.userAgent) || [])[1] ? +(/Chrome\/(\d+)/.exec(navigator.userAgent))[1] : null
    };
  }
};
})();
