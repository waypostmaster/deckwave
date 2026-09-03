/* ─────────────────────────────────────────────────────────────────────────
   DECKWAVE · LIBRE — freely-licensed music fetched from the internet (R3)

   Keeper, 2026-08-19: "Don't get locked into Wikimedia Commons, if there is
   a richer store of the music this visualizer is built for, let me know and
   let's do the thing."

   THE STORE IS THE INTERNET ARCHIVE, and it was measured before this was
   designed around it (the ROADMAP said CORS "must be tested before anything
   is designed around it" — it was the one assumption R3 rested on):

     archive.org/advancedsearch.php  JSON, Access-Control-Allow-Origin: *
     archive.org/metadata/<item>     JSON, ACAO *, one record per file with
                                     name · size · mtime · length · format ·
                                     original, and the item's licenseurl and
                                     creator
     archive.org/download/<item>/<f> 302 → a storage node that answers with
                                     ACAO *, Accept-Ranges: bytes, and the
                                     file's real Content-Type

   and in Chrome, from the Deckwave origin, two tracks fetched with
   {mode:'cors'} and handed to decodeAudioData came back at exactly the
   length the metadata API claimed (280.62 s, 48 kHz, stereo). That is the
   whole gate. Wikimedia Commons passes the same test and holds almost no
   beat-driven music; the Archive's netlabel era is where chiptune lives:
   at the time of measuring, subject:chiptune AND mediatype:audio AND a
   licence URL = 1,500 releases, plus 689 chip-tagged netlabel releases.
   Jamendo's file store and the Free Music Archive's file host also send
   CORS, but both need an API key for discovery; neither is wired here.

   WHAT THIS MODULE IS
   A SOURCE. The engine's one assumption about where bytes come from is the
   File contract — name, size, lastModified, arrayBuffer(), slice(a,b)
   .arrayBuffer() — because everything that brings music in goes through
   DW.ingest(files) and from there analyse(file) → LIB.find(meta) →
   decodeAudio(ctx, f). RemoteFile below honours that contract and nothing
   else in the engine learns the word "remote". The analysis cache key is
   name|size|lastModified, so a fetched track that has been analysed once
   is a cache hit on the next visit exactly as a local file is; the Archive's
   per-file size and mtime are the ones used, so the key is stable across
   sessions and browsers.

   ATTRIBUTION IS A FIELD, NOT A COURTESY. Every RemoteFile carries
   `source` — the licence URL and its short name, the creator, the release
   title, the item page and the file URL — and ingest() copies it onto the
   analysis record as `meta.source`, from where the score format writes it
   per step (additive; still version 1), the now-playing card prints it,
   and the handover line in the log says who is being played under what
   terms. Most CC licences REQUIRE attribution; a score that carried a
   track without its terms would be a file the keeper could not lawfully
   hand to anyone.

   BANDWIDTH MANNERS. The Archive is volunteer-funded and not a CDN: at most
   two fetches in flight, a short gap between starts, three tries on a 503
   with backoff (its storage nodes answer 503 under load and mean "later",
   not "no"), and every fetched file goes into the Cache API under
   'deckwave-libre' so analysis and playback — and the next session — read
   it from disk, not from Richmond. A browser cannot set User-Agent from a
   page (it is a forbidden header), so the polite UA the ROADMAP asked for
   is the one the browser sends; the concurrency is the manner we control.

   FORMAT. The Archive keeps the uploader's original (usually FLAC) and
   derives VBR MP3 and Ogg Vorbis from it. The default here is Ogg — the
   derivatives are ~4 MB a track against ~12 MB MP3 and ~55 MB FLAC, and a
   set is tens of tracks — with MP3 and FLAC one select away. A lossy
   derivative is a lossy derivative; the ear decides whether the Ogg is
   good enough for the mix and LISTENING §13 is the question. The beat
   detector has never seen this material: every threshold was tuned on one
   chiptune catalogue of FLACs, and the gate (grid error) will say what it
   says. Nothing here moves it.

   WHAT IS NOT ESTABLISHED. Whether the Cache API quota on a phone holds a
   set's worth of Ogg (iOS caps it low and evicts under pressure — a miss
   just re-fetches); how these tracks fare in the pool gate; and how any of
   it sounds. Harness: tools/check-libre.js.

   Load order: after deckwave.js, before the dashboard.
   ───────────────────────────────────────────────────────────────────────── */
window.DWLIBRE = (function () {
'use strict';

const ORIGIN = 'https://archive.org';
/* Wikimedia Commons — the SECOND source, measured 2026-08-20 before being
   wired (ROADMAP R3): the search API is CORS-open (`origin=*`), the licence
   is a first-class field (extmetadata), and upload.wikimedia.org serves
   audio with ACAO * — a CC0 WAV and a CC0 Opus fetched and DECODED from
   this origin in Chromium. Unlike the Archive, Commons is FILE-centric:
   a hit is one audio file, not a release, so a Commons row fetches one
   track. Every file on Commons is free-licensed by site policy; the
   licence still rides on each track because attribution is a term, not a
   vibe. CAVEAT, stated where the code is: most Commons audio is Ogg/Opus,
   and WebKit's decodeAudioData does not decode either — on an iPhone
   those files will fail at analyse() and be counted failed, honestly.
   MP3/WAV/FLAC files work everywhere. */
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const CACHE_NAME = 'deckwave-libre';
const MAX_INFLIGHT = 2, GAP_MS = 250, TRIES = 3;
/* A RESOURCE CAP, CHOSEN — not a threshold, not a calibration, and nothing
   about the music depends on it (review 2026-09-01 M4). 256 MB, because a
   fetched track is held roughly four times over before it is music: the
   chunk list, the concatenated copy, the cache.put clone, and the decoded
   PCM. The largest single track either source plausibly offers is a
   lossless master — 256 MB is about 40 minutes of stereo FLAC or 25 of
   16-bit/44.1 WAV, past any track in this catalogue (the biggest in the
   keeper's own library is 55 MB) — while the multi-GB WAVs and archival
   uploads on Commons, which could never be held four times on a phone,
   are refused BEFORE the body is read instead of being downloaded three
   times to fail three times. Refusal is not a retry. */
const MAX_BYTES = 256 * 1024 * 1024;
/* an error the retry loop must NOT try again: refusing is the answer */
function fatal(msg) { const e = new Error(msg); e.dwFatal = true; return e; }

/* The Archive's format strings, in the order each preference tries them. A
   release that lacks the preferred derivative falls through to the next;
   FLAC-only uploads (no derivatives yet) still come in as FLAC. */
const PREFER = {
  ogg:  ['Ogg Vorbis', 'VBR MP3', 'Flac', 'MP3'],
  mp3:  ['VBR MP3', 'MP3', 'Ogg Vorbis', 'Flac'],
  flac: ['Flac', 'VBR MP3', 'Ogg Vorbis', 'MP3']
};
const EXT = { 'Ogg Vorbis': '.ogg', 'VBR MP3': '.mp3', 'MP3': '.mp3', 'Flac': '.flac' };
const MIME = { '.ogg': 'audio/ogg', '.mp3': 'audio/mpeg', '.flac': 'audio/flac' };

/* ── queries ─────────────────────────────────────────────────────────── */
/* Audio items that carry a licence URL. The Archive lets anyone upload
   anything; an item WITHOUT a licenseurl is not known to be free and is not
   offered here at all — the filter is in the query, not in the UI. */
const PRESETS = {
  chiptune:  { n: 'chiptune',          q: 'subject:(chiptune OR chipmusic OR "8-bit" OR 8bit)' },
  netlabels: { n: 'netlabels · chip',  q: 'collection:netlabels AND (chiptune OR 8bit OR chip OR "8-bit")' },
  demoscene: { n: 'demoscene',         q: 'subject:(demoscene OR tracker OR keygen) OR collection:netlabels AND demoscene' },
  /* Keeper, 2026-08-19: "there's a bunch of LukHash music on Archive.org".
     Measured that night: 138 audio items match the word, but almost all are
     podcasts that PLAY him. The CREATOR field finds his own releases —
     `lukhash` and his netlabel-era `lukhash.com` alias — and the licence
     filter then keeps exactly four: SH music - Dead Pixels and Digital
     Memories (CC BY-NC-ND 3.0), The Other Side (BY-NC-ND 4.0), and the
     PandaCD Digital Memories (BY-NC-SA 3.0). Falling Apart, 3AM and the
     single-song rips carry no licence URL and are rightly not offered. */
  lukhash:   { n: 'LukHash',           q: 'creator:(lukhash OR "lukhash.com")' },
  any:       { n: 'free text',         q: '' }
};

function buildQuery(preset, text) {
  const p = PRESETS[preset] || PRESETS.chiptune;
  const parts = ['mediatype:audio', 'licenseurl:[* TO *]'];
  if (p.q) parts.push('(' + p.q + ')');
  const t = String(text || '').trim();
  if (t) parts.push('(' + t.replace(/[()]/g, ' ') + ')');
  return parts.join(' AND ');
}

function searchURL(opts) {
  const o = opts || {};
  const u = new URL(ORIGIN + '/advancedsearch.php');
  u.searchParams.set('q', buildQuery(o.preset, o.text));
  for (const f of ['identifier', 'title', 'creator', 'licenseurl', 'year', 'downloads', 'date'])
    u.searchParams.append('fl[]', f);
  u.searchParams.set('rows', String(o.rows || 40));
  u.searchParams.set('page', String(o.page || 1));
  u.searchParams.append('sort[]', (o.sort || 'downloads') + ' desc');
  u.searchParams.set('output', 'json');
  return u.toString();
}

/* ── licences ────────────────────────────────────────────────────────── */
/* Short, honest names for the URLs the Archive records. Unknown → the URL
   itself is shown; nothing is ever called "free" that this table does not
   recognise.

   RECOGNITION IS BY HOST, NOT BY SUBSTRING (review 2026-09-01 M3). The old
   table matched the PATH anywhere in the string, so
   `https://example.com/licenses/by/4.0/` came back "CC BY 4.0" and any URL
   containing the letters cc0 came back "CC0" — a name with legal weight
   (it reaches the card, the score and the .cue's REM ATTRIBUTION) issued
   on an uploader-supplied string that Creative Commons never saw. The host
   is parsed with the URL parser, not regexed out; a string that will not
   parse as a URL with a dotted host gets no name at all. */
const LICENCE_HOSTS = {
  'creativecommons.org': 'cc',
  'gnu.org': 'gpl',
  'fsf.org': 'gpl',
  'artlibre.org': 'artlibre'
};
function licenceHost(url) {
  const s = String(url || '').trim();
  if (!s) return null;
  let h = null;
  try { h = new URL(s).hostname; }
  catch (e) {
    /* a scheme-less `creativecommons.org/licenses/by/4.0/` is what some
       records carry; only retry when the string STARTS with a dotted host */
    if (!/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}(\/|$)/i.test(s)) return null;
    try { h = new URL('https://' + s).hostname; } catch (e2) { return null; }
  }
  h = String(h || '').toLowerCase().replace(/^www\./, '');
  return LICENCE_HOSTS[h] ? { family: LICENCE_HOSTS[h], host: h } : null;
}
function licenceName(url) {
  const H = licenceHost(url);
  if (!H) return null;
  if (H.family === 'gpl') return 'GPL';
  if (H.family === 'artlibre') return 'Free Art Licence';
  /* creativecommons.org: the path names the deed */
  let p = '';
  try { p = new URL(/^[a-z]+:/i.test(String(url)) ? String(url) : 'https://' + String(url)).pathname.toLowerCase(); }
  catch (e) { return null; }
  if (/\/publicdomain\/zero|\bcc0\b/.test(p)) return 'CC0';
  if (/publicdomain|public-domain/.test(p)) return 'public domain';
  const m = /\/licenses\/(by[a-z-]*)\/([0-9.]+)/.exec(p);
  if (m) return 'CC ' + m[1].toUpperCase() + ' ' + m[2];
  return null;
}
/* CC BY-ND and BY-NC-ND forbid adaptations — a beatmatched, crossfaded,
   stretched mix is arguably one. The track still plays; the score and the
   card carry the term so the decision about publishing a mix that contains
   it is made with the term in view, not found later.

   THE SHORT NAME COUNTS TOO (review 2026-09-01 M3): a Commons file whose
   extmetadata carries `LicenseShortName: "CC BY-ND 4.0"` and NO LicenseUrl
   was read from the URL alone and came through unflagged. Either surface
   saying no-derivatives is enough to flag it; neither saying it is the
   only way through. */
function noDerivs(url, shortName) {
  const nd = s => /-nd\b|-nd\/|\bnoderiv/.test(String(s || '').toLowerCase());
  return nd(url) || nd(shortName);
}

/* ── fetch pipeline: limiter · cache · retry ──────────────────────────── */
let inflight = 0, lastStart = 0; const waiting = [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function slot() {
  if (inflight >= MAX_INFLIGHT) await new Promise(r => waiting.push(r));
  inflight++;
  const wait = lastStart + GAP_MS - Date.now();
  if (wait > 0) await sleep(wait);
  lastStart = Date.now();
}
function freeSlot() { inflight--; const r = waiting.shift(); if (r) r(); }

const stats = { fetched: 0, cacheHits: 0, bytes: 0, retries: 0, errors: 0 };

/* ── download progress ──────────────────────────────────────────────────
   fetchBytes streams the body instead of buffering it blind, so every
   consumer can print a percentage while a track arrives (keeper,
   2026-08-21, from the phone: "Can we add a percentage complete when
   downloading stuff? Especially the demo songs."). watchFetch(fn)
   subscribes; each event is { url, name, loaded, total, done } — total is
   the Content-Length and CAN be 0 (header missing or unreadable), in
   which case show bytes, never a made-up percent. Consumers cap the
   display at 99% and let `done` say 100: if the response were
   content-encoded, `loaded` counts decoded bytes against an encoded
   total and could overshoot (audio from both sources is served identity,
   but the cap costs nothing). The cache write is STARTED before the read
   loop and awaited after it — cache.put consumes its clone of the body
   in step with the loop, whereas awaiting it first (as this code did
   until today) buffers the whole track and would collapse every progress
   event into one 0→100 jump. Range probes (16 bytes) do not report. */
const fetchWatchers = new Set();
function watchFetch(fn) { fetchWatchers.add(fn); return () => fetchWatchers.delete(fn); }
function reportFetch(ev) { for (const w of fetchWatchers) { try { w(ev); } catch (e) {} } }
async function readBody(r, url, name, expect) {
  if (!r.body || typeof r.body.getReader !== 'function') return r.arrayBuffer();
  const total = +(r.headers && r.headers.get && r.headers.get('content-length')) || 0;
  const rd = r.body.getReader();
  const chunks = []; let loaded = 0;
  for (;;) {
    const { done, value } = await rd.read();
    if (done) break;
    chunks.push(value); loaded += value.byteLength;
    /* the cap again, against bytes actually read: a chunked response
       declares no length, so the header check above cannot see it */
    if (loaded > MAX_BYTES) {
      try { await rd.cancel(); } catch (e) {}
      reportFetch({ url, name, loaded, total, done: true });
      throw fatal('too big: over ' + Math.round(MAX_BYTES / 1048576) + ' MB and still arriving — ' + url);
    }
    reportFetch({ url, name, loaded, total, done: false });
  }
  /* A TRUNCATED BODY IS NOT A FILE (review 2026-09-01). A stream that ends
     early with a Content-Length set, or short of the size the item metadata
     recorded, used to be concatenated, cached and analysed as if complete —
     a half track in the corpus with a permanent cache entry behind it. The
     comparison is one-sided (short only, never long) because a
     content-encoded body counts DECODED bytes against an ENCODED total and
     would legitimately overshoot; audio from both sources is served
     identity. With neither a length header nor a recorded size there is
     nothing to compare against and this cannot tell — said, not hidden. */
  const want = total || +expect || 0;
  if (want && loaded < want) {
    reportFetch({ url, name, loaded, total: want, done: true });
    throw new Error('short body: ' + loaded + ' of ' + want + ' bytes — ' + url);
  }
  reportFetch({ url, name, loaded, total: loaded, done: true });
  const out = new Uint8Array(loaded);
  let off = 0; for (const ch of chunks) { out.set(ch, off); off += ch.byteLength; }
  return out.buffer;
}

async function cacheOpen() {
  try { return (typeof caches !== 'undefined') ? await caches.open(CACHE_NAME) : null; }
  catch (e) { return null; }
}

/* Whole-file fetch through the limiter, cached. A Range request bypasses the
   cache (it is the audit's 16-byte probe; not worth storing). */
async function fetchBytes(url, range, name, expect) {
  /* the cap before a byte is asked for: an item whose recorded size is
     already over it is never requested at all */
  if (!range && +expect > MAX_BYTES) {
    stats.errors++;
    throw fatal('too big: ' + Math.round(+expect / 1048576) + ' MB, over the '
      + Math.round(MAX_BYTES / 1048576) + ' MB limit — ' + url);
  }
  const c = range ? null : await cacheOpen();
  if (c) {
    const hit = await c.match(url).catch(() => null);
    if (hit) { stats.cacheHits++; return hit.arrayBuffer(); }
  }
  await slot();
  try {
    let lastErr;
    for (let t = 0; t < TRIES; t++) {
      if (t) { stats.retries++; await sleep(600 * Math.pow(2, t)); }
      let r;
      try {
        r = await fetch(url, { mode: 'cors', credentials: 'omit',
          headers: range ? { Range: 'bytes=' + range[0] + '-' + (range[1] == null ? '' : range[1]) } : {} });
      } catch (e) { lastErr = e; continue; }           /* network / CORS: try again */
      if (r.status === 503 || r.status === 429 || r.status >= 500) { lastErr = new Error('HTTP ' + r.status); continue; }
      if (!r.ok && r.status !== 206) throw new Error('HTTP ' + r.status + ' ' + url);
      /* the length the server declares, checked BEFORE the body is read and
         before the cache clone is started — refusing costs one round trip,
         retrying a file that can never be held costs three whole downloads */
      const len = +((r.headers && r.headers.get && r.headers.get('content-length')) || 0);
      if (!range && len > MAX_BYTES) {
        stats.errors++;
        throw fatal('too big: ' + Math.round(len / 1048576) + ' MB, over the '
          + Math.round(MAX_BYTES / 1048576) + ' MB limit — ' + url);
      }
      let putP = null;                              /* quota failures land in the catch below */
      if (c && !range && r.status === 200) { try { putP = c.put(url, r.clone()); } catch (e) { putP = null; } }
      let ab;
      try { ab = range ? await r.arrayBuffer() : await readBody(r, url, name, expect); }
      catch (e) {                                    /* the body died mid-stream — retry like a 5xx */
        if (putP) await putP.catch(() => {});
        /* The put was started from a CLONE before the read, so a body that
           ended early but cleanly (the truncation case) can have landed in
           the cache as a complete entry — the exact permanence this is
           meant to prevent. Drop it; a miss just re-fetches. */
        if (c && !range && typeof c.delete === 'function') await c.delete(url).catch(() => {});
        /* …unless the failure is the SIZE, not the network. A refusal and an
           allocation failure (RangeError from `new Uint8Array(loaded)` on a
           file too big to hold) both used to be retried as mid-body deaths:
           three full downloads of a file that cannot exist here. Neither is
           a "later" — both are answers. */
        if (e && (e.dwFatal || e instanceof RangeError)) { stats.errors++; throw e; }
        lastErr = e; reportFetch({ url, name, loaded: 0, total: 0, done: true });
        continue;
      }
      if (putP) await putP.catch(() => {});
      stats.fetched++; stats.bytes += ab.byteLength;
      return ab;
    }
    stats.errors++;
    throw lastErr || new Error('fetch failed ' + url);
  } finally { freeSlot(); }
}

/* Same manners as fetchBytes: the Archive's front end answers 502/503 under
   load and means "later" — measured live 2026-08-19, a 502 then a 200 that
   took 22 s, while the panel sat on "searching…" forever because this had
   no retry. A network reset ("Failed to fetch") gets the same treatment. */
async function getJSON(url) {
  await slot();
  try {
    let lastErr;
    for (let t = 0; t < TRIES; t++) {
      if (t) { stats.retries++; await sleep(600 * Math.pow(2, t)); }
      let r;
      try { r = await fetch(url, { mode: 'cors', credentials: 'omit' }); }
      catch (e) { lastErr = e; continue; }
      if (r.status === 429 || r.status >= 500) { lastErr = new Error('HTTP ' + r.status); continue; }
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
      return r.json();
    }
    stats.errors++;
    throw lastErr || new Error('fetch failed ' + url);
  } finally { freeSlot(); }
}

/* ── RemoteFile: the File contract over a URL ─────────────────────────── */
class RemoteFile {
  constructor(o) {
    this.name = o.name; this.size = +o.size || 0;
    this.lastModified = +o.lastModified || 0;
    this.type = o.type || '';
    this.url = o.url; this.source = o.source || null;
    this.remote = true;
  }
  /* the recorded size travels with the request: it is both the cap check
     before a byte is asked for and the only way a body with no
     Content-Length can be known to have arrived whole (see readBody) */
  arrayBuffer() { return fetchBytes(this.url, null, this.name, this.size); }
  slice(a, b) {
    const url = this.url, size = this.size;
    const lo = Math.max(0, a | 0);
    /* Blob.slice() with no end means "to the end of the file". With a known
       size that is size-1; with an UNKNOWN size (a record the Archive gave
       no size for) there is no last byte to name, and the old arithmetic
       produced -1 — `Range: bytes=0--1`, which no server answers. An
       open-ended `bytes=lo-` is HTTP's own way to say the same thing
       (review 2026-09-01). */
    const end = b == null ? (size || null) : Math.min(size || Infinity, b);
    const hi = (end == null || !isFinite(end)) ? null : end - 1;
    return { size: hi == null ? 0 : Math.max(0, hi - lo + 1),
             arrayBuffer: () => fetchBytes(url, [lo, hi]) };
  }
  text() { return this.arrayBuffer().then(ab => new TextDecoder().decode(ab)); }
}

/* ── a release → its tracks, one file each ───────────────────────────── */
function displayName(f, ext) {
  const tidy = s => String(s || '').replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  if (f.title) {
    const artist = tidy(f.artist || f.creator || '');
    return (artist ? artist + ' - ' : '') + tidy(f.title) + ext;
  }
  return tidy(f.name.replace(/\.[^.]+$/, '')) + ext;
}

/* Group the item's files by the original they derive from (the Archive
   stamps `original` on every derivative), pick one format per group in the
   preferred order, and build RemoteFiles. Non-audio files (images, torrents,
   the metadata XML) have no format in the table and fall out. */
function pickTracks(item, prefer) {
  const order = PREFER[prefer] || PREFER.ogg;
  const md = item.metadata || {};
  const groups = new Map();
  for (const f of item.files || []) {
    if (!EXT[f.format]) continue;
    const key = f.original || f.name;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(f);
  }
  const out = [];
  for (const [, fs] of groups) {
    let pick = null;
    for (const fmt of order) { pick = fs.find(f => f.format === fmt); if (pick) break; }
    if (!pick) continue;
    const ext = EXT[pick.format];
    const src = (fs.find(f => f.source === 'original') || pick);
    const name = displayName(src.title ? src : pick, ext);
    const trackNo = parseInt(String(src.track || pick.track || ''), 10);
    const licence = md.licenseurl || null;
    const creator = Array.isArray(md.creator) ? md.creator.join(', ') : (md.creator || '');
    out.push(new RemoteFile({
      name, size: pick.size, lastModified: (+pick.mtime || 0) * 1000, type: MIME[ext],
      url: ORIGIN + '/download/' + encodeURIComponent(item.metadata.identifier) + '/' + encodeURIComponent(pick.name),
      source: {
        kind: 'archive.org', item: md.identifier, page: ORIGIN + '/details/' + md.identifier,
        release: Array.isArray(md.title) ? md.title[0] : (md.title || md.identifier),
        creator, licence, licenceName: licenceName(licence), noDerivatives: noDerivs(licence),
        format: pick.format, file: pick.name, original: pick.original || null, bytes: +pick.size || 0,
        length: pick.length != null ? String(pick.length) : null,
        track: isNaN(trackNo) ? null : trackNo
      }
    }));
  }
  /* album order: the Archive's `track` tag when present, else the ORIGINAL
     filename (which carries the number) — never the display name, whose
     case differs between tagged and untagged files */
  out.sort((a, b) => {
    const ta = a.source.track, tb = b.source.track;
    if (ta != null && tb != null && ta !== tb) return ta - tb;
    const ka = (a.source.original || a.source.file).toLowerCase(), kb = (b.source.original || b.source.file).toLowerCase();
    return ka.localeCompare(kb, undefined, { numeric: true });
  });
  return out;
}

/* one line that satisfies "attribution" for most CC terms */
function attribution(src) {
  if (!src) return '';
  return (src.creator ? src.creator + ' — ' : '') + (src.release || '') +
    (src.licenceName ? ' · ' + src.licenceName : (src.licence ? ' · ' + src.licence : '')) +
    (src.page ? ' · ' + src.page.replace(/^https?:\/\//, '') : '');
}

/* ── public: search · release · add ──────────────────────────────────── */
async function search(opts) {
  const j = await getJSON(searchURL(opts));
  const docs = (j.response && j.response.docs) || [];
  return {
    found: (j.response && j.response.numFound) || 0,
    items: docs.map(d => ({
      id: d.identifier, title: Array.isArray(d.title) ? d.title[0] : d.title,
      creator: Array.isArray(d.creator) ? d.creator.join(', ') : (d.creator || ''),
      licence: d.licenseurl || null, licenceName: licenceName(d.licenseurl),
      noDerivatives: noDerivs(d.licenseurl),
      year: d.year || (d.date ? String(d.date).slice(0, 4) : ''), downloads: d.downloads || 0,
      page: ORIGIN + '/details/' + d.identifier
    }))
  };
}

/* Commons: full-text search over audio files (namespace 6 = File:), then
   one batch imageinfo call for URL, size, mtime, mime and the licence
   fields. Both go through getJSON, so the limiter and the retry manners
   apply to Wikimedia exactly as they do to the Archive. */
/* tags removed, not replaced with spaces — matching what textContent gives:
   an inline tag inside a word (Some<b>body</b>) must not split it */
const stripTags = h => String(h == null ? '' : h).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
function commonsSearchURL(text, rows) {
  const u = new URL(COMMONS);
  u.searchParams.set('action', 'query'); u.searchParams.set('list', 'search');
  u.searchParams.set('srsearch', String(text || 'music').trim() + ' filetype:audio');
  u.searchParams.set('srnamespace', '6'); u.searchParams.set('srlimit', String(rows || 40));
  u.searchParams.set('format', 'json'); u.searchParams.set('origin', '*');
  return u.toString();
}
function commonsInfoURL(titles) {
  const u = new URL(COMMONS);
  u.searchParams.set('action', 'query'); u.searchParams.set('titles', titles.join('|'));
  u.searchParams.set('prop', 'imageinfo');
  u.searchParams.set('iiprop', 'url|size|timestamp|mime|extmetadata');
  u.searchParams.set('format', 'json'); u.searchParams.set('origin', '*');
  return u.toString();
}
async function searchCommons(text, rows) {
  const s1 = await getJSON(commonsSearchURL(text, rows));
  const hits = (s1.query && s1.query.search) || [];
  if (!hits.length) return { found: 0, items: [] };
  const s2 = await getJSON(commonsInfoURL(hits.map(h => h.title)));
  const pages = (s2.query && s2.query.pages) || {};
  const byTitle = new Map(Object.values(pages).map(p => [p.title, p]));
  const items = [];
  for (const h of hits) {                       /* keep the search's own relevance order */
    const p = byTitle.get(h.title);
    const ii = p && p.imageinfo && p.imageinfo[0];
    if (!ii || !ii.url) continue;
    /* THE MIME MUST SAY AUDIO (review 2026-09-01 M4). `filetype:audio` is a
       search hint, not a guarantee — the same query surfaces .ogv video and
       the odd PDF transcript, and a Commons row's + button hands its file
       straight to DW.ingest, where the only defence left is decodeAudioData
       failing after the bytes are on the wire. `application/ogg` is allowed
       beside `audio/*` because MediaWiki genuinely reports it for some Ogg
       audio; video/ogg, image/* and everything else is refused here. */
    if (!/^audio\//i.test(ii.mime || '') && String(ii.mime || '').toLowerCase() !== 'application/ogg') continue;
    const em = ii.extmetadata || {};
    const val = k => em[k] && em[k].value;
    const name = p.title.replace(/^File:/, '');
    const licence = val('LicenseUrl') || null;
    /* Commons' own short name first — it covers PD-old and friends that
       carry no URL; the URL table is the fallback, and nothing is called
       free that neither recognises. */
    const licShort = stripTags(val('LicenseShortName')) || licenceName(licence);
    const creator = stripTags(val('Artist'));
    const file = new RemoteFile({
      name, size: ii.size, lastModified: Date.parse(ii.timestamp) || 0, type: ii.mime || '',
      url: ii.url,
      source: {
        kind: 'commons.wikimedia.org', item: p.title, page: ii.descriptionurl || null,
        release: 'Wikimedia Commons', creator,
        licence, licenceName: licShort, noDerivatives: noDerivs(licence, licShort),
        format: ii.mime || '', file: name, original: null, bytes: +ii.size || 0,
        length: null, track: null
      }
    });
    items.push({ kind: 'commons', id: p.title, title: name.replace(/\.[^.]+$/, ''),
      creator, licence, licenceName: licShort, noDerivatives: noDerivs(licence, licShort),
      page: ii.descriptionurl || null, bytes: +ii.size || 0, mime: ii.mime || '', file });
  }
  return { found: (s1.query && s1.query.searchinfo && s1.query.searchinfo.totalhits) || items.length, items };
}

async function release(id, prefer) {
  const item = await getJSON(ORIGIN + '/metadata/' + encodeURIComponent(id));
  if (!item || !item.metadata) throw new Error('no such item: ' + id);
  const tracks = pickTracks(item, prefer || current.format);
  return { id, title: item.metadata.title, creator: item.metadata.creator, licence: item.metadata.licenseurl,
    licenceName: licenceName(item.metadata.licenseurl), tracks,
    bytes: tracks.reduce((s, t) => s + t.size, 0) };
}

/* Fetch a release's tracks into the corpus through DW.ingest — the same
   door every local file uses. Returns ingest's own figures plus the
   attribution lines, so the caller can print who was just added. */
async function add(id, opts) {
  const DW = window.DW;
  if (!DW || !DW.ingest) throw new Error('engine not loaded');
  const o = opts || {};
  const rel = await release(id, o.format);
  if (!rel.tracks.length) return { release: rel, added: 0, note: 'no audio files in that release' };
  const r = await DW.ingest(rel.tracks, o.onProgress);
  return Object.assign({ release: rel, attribution: attribution(rel.tracks[0].source) }, r);
}

const current = { format: 'ogg', preset: 'chiptune', source: 'archive' };

/* ── the demo: a pre-built set that plays before it has finished arriving ──
   Keeper, 2026-08-19: "a 'demo' button that will: immediately download
   Stand Alone and start playing it - hold all skipping features until the
   set is downloaded - and then download the rest in set order while it's
   playing Stand Alone? And so poetic that it is the track that...stands
   alone." This is ROADMAP R2 — "a curated set built entirely from
   freely-licensed music resolves for EVERYONE, because the tracks can be
   fetched rather than owned" — riding on R3, exactly as R2 predicted.

   The manifest is an ordinary SAVED SCORE whose steps carry `source`
   (assets/demo-set.json — the keeper's own first libre set). Nothing in
   the tree ships audio; the score names Archive items and files, and the
   item metadata is fetched fresh so the cache keys (real size · mtime)
   match a normal ⊕ libre fetch — a demo track and a browsed track are the
   same record.

   Order of events: fetch + analyse step 0 alone → play it as a one-track
   set (the rolling tempo resets to its own BPM, which is what play() does
   on any jump) → fetch + analyse the rest IN SET ORDER while it plays →
   DWSCORE.load() rebuilds the full set with every rate, classification
   and the build mode restored → Player.reorder() adopts it mid-track (the
   route mechanism; the playing track is at index 0 in both orders, which
   reorder requires) → controls come back. While the set is arriving,
   skip / back / blend-now / queue / play answer with a sentence instead
   of acting — held and RESTORED in a finally, so a failed demo cannot
   leave the deck mute to its buttons.

   What can go wrong is stated, not hidden: a track the Archive no longer
   serves is reported in `missing` and the set plays without it; if Stand
   Alone outlasts the remaining fetches nothing special happens (reorder
   lands mid-track); if the fetches OUTLAST it the one-track set simply
   ends and reorder() replaces the order cold — the log then says to press
   ▶. Autoplay: the demo click is the gesture; Chromium honours a resume
   that follows it, WebKit on a phone may not — that is LISTENING material,
   not something this code can promise. */
/* ONE demo at a time — a gate, not a paragraph. Two in flight each saved
   "the original" transport and restored it in finish order, so the second
   restored the FIRST's hold stub and play/skip/back/blendNow/queueNext
   answered "still arriving" until reload (review 2026-09-01 M2, ledger
   123). The dashboard button guards itself; DWLIBRE.demo() is public API
   for game code, where a double call is ordinary. */
let demoAt = null;
async function demo(opts) {
  if (demoAt) throw new Error('demo: already arriving (' + demoAt.i + '/' + demoAt.n + ') — one demo at a time; wait for it');
  const at = demoAt = { i: 0, n: 0 };
  try { return await demoInner(opts || {}, at); } finally { demoAt = null; }
}
async function demoInner(o, at) {
  const DW = window.DW, SC = window.DWSCORE;
  if (!DW || !DW.ingest || !SC) throw new Error('engine not loaded');
  let sc = o.score;
  if (!sc) {
    const r = await fetch(o.url || 'assets/demo-set.json');
    if (!r.ok) throw new Error('no demo set installed (assets/demo-set.json)');
    sc = await r.json();
  }
  if (typeof sc === 'string') sc = JSON.parse(sc);
  if (sc.format !== 'deckwave-set') throw new Error('not a deckwave set file');
  const steps = (sc.steps || []).filter(s => s.source && s.source.item && s.source.file);
  if (!steps.length) throw new Error('the demo score carries no libre sources');
  const sayRaw = o.onProgress || (() => {});
  const say = (i, n, nm, phase) => { at.i = i; at.n = n; sayRaw(i, n, nm, phase); };

  /* one metadata call per distinct item, through the polite pipeline */
  const items = {};
  for (const s of steps) if (!(s.source.item in items))
    items[s.source.item] = await getJSON(ORIGIN + '/metadata/' + encodeURIComponent(s.source.item));

  const missing = [];
  const files = steps.map(s => {
    const it = items[s.source.item];
    const f = it && (it.files || []).find(x => x.name === s.source.file);
    if (!f) { missing.push(s.name); return null; }
    const ext = EXT[f.format] || ('.' + String(f.name).split('.').pop());
    return new RemoteFile({
      /* records store the name minus its extension, so `s.name + ext`
         analyses to exactly the name the score resolves against */
      name: s.name + ext, size: f.size, lastModified: (+f.mtime || 0) * 1000, type: MIME[ext] || '',
      url: ORIGIN + '/download/' + encodeURIComponent(s.source.item) + '/' + encodeURIComponent(f.name),
      source: Object.assign({}, s.source, { bytes: +f.size || 0,
        original: f.original || null, length: f.length != null ? String(f.length) : null })
    });
  }).filter(Boolean);
  if (!files.length) throw new Error('none of the demo tracks exist on the Archive any more');

  /* hold the transport; the demo keeps the originals for its own use.
     THE HOLD MUST BE VISIBLE (keeper, on the phone: "no other buttons are
     functional and its unclear why or when they might be"): every blocked
     press logs WHERE the fetch is and that pause still works — a silently
     dead button and a broken one are indistinguishable from a lock screen. */
  const HELD = ['play', 'skip', 'back', 'blendNow', 'queueNext'];
  const orig = {};
  const tell = o.log || log;
  const holdMsg = () => 'demo: the set is still arriving (' + at.i + '/' + at.n
    + ') — controls return when it is home · pause still works';
  HELD.forEach(k => { orig[k] = DW[k]; DW[k] = async () => { const m = holdMsg(); tell(m); return m; }; });
  try {
    say(1, files.length, files[0].name, 'opening');
    const r0 = await DW.ingest([files[0]]);
    const rec0 = DW.corpus.find(m => m.id === files[0].name + '|' + files[0].size + '|' + files[0].lastModified);
    if (!rec0 || r0.failed) throw new Error('the opening track did not arrive: ' + files[0].name);
    /* the score's build mode rides on the FIRST play: reorder() keeps the
       Player's current phrase flag, so a phrase-match demo must start as one */
    const first = [rec0];
    if (sc.engine && (sc.engine.phrase || sc.engine.mode === 'phrase')) first.phrase = true;
    /* the play line carries the worklet identity — `held worklet` or
       `plain worklet (why)` — and the context's rate and buffer. The first
       demo discarded it, so the keeper's "slightest popping" report arrived
       with no way to know which pipe was running. Logged AND returned. */
    const playLine = String(await orig.play.call(DW, first, 0));
    tell('demo: ' + playLine);
    say(1, files.length, rec0.name, 'playing');
    const rest = files.slice(1);
    if (rest.length) await DW.ingest(rest, (i, n, nm) => say(i + 1, files.length, nm, 'fetching'));
    const loaded = SC.load(sc, DW.corpus);
    if (!loaded.set.length) throw new Error('the demo set resolved to nothing');
    const note = await DW.reorder(loaded.set);
    /* a track can be missing at the mapping stage AND unresolved by load();
       one name, reported once */
    return { tracks: loaded.set.length, set: loaded.set, playLine,
             missing: [...new Set(missing.concat(loaded.missing))], note: String(note) };
  } finally { HELD.forEach(k => { DW[k] = orig[k]; }); }
}

/* ── the panel ───────────────────────────────────────────────────────── */
let host = null, sr = null, unfold = null, log = (s) => console.log('[libre] ' + s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/* esc() cannot make an href safe — entities decode before the URL runs, so
   an escaped javascript: link still executes. Archive page URLs are built
   locally from the item id; Commons' descriptionurl comes back from the
   API and is gated here before it becomes an anchor (same rule as the
   now-playing card's score-fed link — ultra review F1's class). */
const safeHref = u => {
  try { const p = new URL(u, location.href).protocol;
        return (p === 'http:' || p === 'https:') ? u : null; }
  catch (e) { return null; }
};
const mb = n => (n / 1048576).toFixed(n > 100 * 1048576 ? 0 : 1) + ' MB';

const CSS = `
:host{all:initial;position:fixed;inset:auto 12px 12px auto;z-index:9000;font:12px/1.45 var(--dw-font,ui-monospace,Menlo,Consolas,monospace);color:var(--dw-color-text,#d9d2ff)}
.box{position:relative;width:min(560px,calc(100vw - 24px));max-height:min(72vh,640px);display:flex;flex-direction:column;background:var(--dw-color-surface,#0b0424);border:1px solid var(--dw-color-line,#22125c);border-radius:6px;box-shadow:0 12px 40px #000a}
/* the header WRAPS and the ✕ is pinned: on a phone the no-wrap row pushed
   the close button past the right edge — "I can't get it to go away" */
.hd{display:flex;flex-wrap:wrap;gap:6px;align-items:center;padding:8px 34px 8px 10px;border-bottom:1px solid var(--dw-color-line,#22125c);cursor:pointer}
.hd b{letter-spacing:.04em}
#chev{margin-right:auto;font-style:normal;opacity:.65}
/* folded to the frame: title bar + status line only — the list and the
   header's controls hide, a fetch in flight keeps reporting on .ft */
.box.min .ls{display:none}
.box.min .hd > :not(b):not(#chev):not(#close){display:none}
#close{position:absolute;top:6px;right:6px}
/* narrow screens: a bottom sheet, capped so the app stays visible above it,
   with finger-sized controls */
@media (max-width:700px){
  :host{inset:auto 0 0 0}
  .box{width:100vw;max-height:55vh;border-radius:10px 10px 0 0;border-left:0;border-right:0;border-bottom:0}
  input,select,button{padding:8px 10px;font-size:14px}
  #close{top:8px;right:8px}
  .tr{padding:6px 10px 6px 14px;font-size:13px}
}
input,select,button{font:inherit;color:inherit;background:#110838;border:1px solid #2b1a6a;border-radius:4px;padding:3px 7px}
button{cursor:pointer} button:hover{border-color:#7b5cff} button.hot{background:#3a2491}
input{min-width:120px;flex:1}
.ls{overflow:auto;padding:4px 0}
.it{display:grid;grid-template-columns:1fr auto;gap:2px 10px;padding:6px 10px;border-bottom:1px solid #160c3c}
.it:hover{background:#0f0630}
.it .t{font-weight:600} .it .m{opacity:.75;font-size:11px;grid-column:1/-1}
.it .nd{color:#ffb86b} .it .lic{color:#8ef0c2}
.ft{padding:6px 10px;border-top:1px solid var(--dw-color-line,#22125c);opacity:.85;min-height:1.4em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tr{padding:3px 10px 3px 14px;display:flex;gap:8px;border-bottom:1px solid #120a33;font-size:11px} .tr span:first-of-type{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.st{font-style:normal;width:1.2em;text-align:center;opacity:.85} .st.ok{color:#3ee68a} .st.no{color:#ff5470} .st.on{color:#7b5cff}
.t.fold{cursor:pointer} .t.fold:hover{text-decoration:underline}
.bts{display:flex;gap:4px;align-items:start} .bts .rm{opacity:.55;padding:3px 5px} .bts .rm:hover{opacity:1;border-color:#ff5470}
.x{opacity:.7}
`;

/* The dashboard is a fixed host at the maximum z-index, so a panel appended
   to <body> is behind the whole app. The panel mounts INSIDE the dashboard's
   shadow root — passed as opts.root, or found through #deckwave — with its
   own shadow root so neither side's CSS reaches the other; <body> is the
   fallback for a page without the dashboard. */
function mountRoot(given) {
  if (given && typeof given.appendChild === 'function') return given;
  const dw = document.getElementById('deckwave');
  return (dw && dw.shadowRoot) || document.body;
}
function mount(root) {
  if (host) return;
  host = document.createElement('div'); host.id = 'dw-libre';
  sr = host.attachShadow({ mode: 'open' });
  const st = document.createElement('style'); st.textContent = CSS; sr.appendChild(st);
  const box = document.createElement('div'); box.className = 'box';
  box.innerHTML = `
    <div class="hd"><b id="srcTitle">⊕ libre</b><i id="chev" title="fold the panel to its title bar — tap the frame">▾</i>
      <select id="src" title="where to search — the Archive is release-centric (albums), Commons is one file per hit">
        <option value="archive">archive.org</option><option value="commons">wikimedia commons</option></select>
      <select id="preset">${Object.keys(PRESETS).map(k => `<option value="${k}">${esc(PRESETS[k].n)}</option>`).join('')}</select>
      <input id="q" placeholder="artist, title, tag…" />
      <button id="go">search</button>
      <button id="lh" title="LukHash's own licensed releases on archive.org — the creator field, so podcasts that merely play him don't appear">♪ lukhash</button>
      <select id="fmt" title="which derivative to fetch — Ogg is ~4 MB a track, MP3 ~12, FLAC ~55">
        <option value="ogg">ogg</option><option value="mp3">mp3</option><option value="flac">flac</option></select>
      <button id="close" class="x">✕</button></div>
    <div class="ls" id="ls"><div class="it"><span class="m">Freely-licensed music from the Internet Archive or Wikimedia Commons — pick the source above. Archive results are releases (albums); only audio items that carry a licence URL are offered. Commons results are single files; everything there is free-licensed by site policy, and each hit shows its licence. Either way tracks come in with creator · licence attached, the score carries it, and the card links back to the page serving the music. Search, then + add.</span></div></div>
    <div class="ft" id="ft"></div>`;
  sr.appendChild(box);
  mountRoot(root).appendChild(host);
  const $ = id => sr.getElementById(id);
  $('preset').value = current.preset; $('fmt').value = current.format;
  $('src').value = current.source;
  /* preset and format are Archive concepts; Commons rows are single files
     in whatever format they were uploaded in */
  const srcUi = () => { const c = $('src').value === 'commons';
    $('preset').style.display = c ? 'none' : ''; $('fmt').style.display = c ? 'none' : '';
    $('lh').style.display = c ? 'none' : ''; };
  $('src').onchange = () => { current.source = $('src').value; srcUi(); };
  srcUi();
  $('preset').onchange = () => { current.preset = $('preset').value; };
  $('fmt').onchange = () => { current.format = $('fmt').value; };
  $('close').onclick = () => { host.style.display = 'none'; };
  /* ── collapsible by the window frame (keeper, 2026-08-21: "interface
     elements that pop up should be collapsible by their window frame") ──
     A tap on the header that is not aimed at a control folds the panel to
     its title bar + status line; another unfolds it. Search state, the
     result list and any fetch in flight stay exactly as they are — and
     the ft line keeps reporting progress while folded, so an album can
     download behind a slim bar. ▾/▴ on the title says which way it goes. */
  const setFold = f => { box.classList.toggle('min', f); $('chev').textContent = f ? '▴' : '▾'; };
  unfold = () => setFold(false);
  box.querySelector('.hd').addEventListener('click', e => {
    if (e.target.closest && e.target.closest('select,input,button')) return;
    setFold(!box.classList.contains('min'));
  });
  $('q').onkeydown = e => { if (e.key === 'Enter') doSearch(); };
  $('go').onclick = doSearch;
  /* one click: the LukHash preset, empty text, straight to results */
  $('lh').onclick = () => { current.source = 'archive'; $('src').value = 'archive';
    current.preset = 'lukhash'; $('preset').value = 'lukhash'; $('q').value = ''; doSearch(); };
  host.addEventListener('click', e => e.stopPropagation());
  /* On a narrow screen the sheet covers the toolbar, so the ⊕ toggle is
     unreachable while it is open — a tap anywhere OUTSIDE closes it (the
     host stops its own clicks above, so only outside taps arrive here).
     The ⊕ button's handler stops propagation so the opening click does
     not immediately close it. Desktop keeps the ✕ / ⊕ toggle only: the
     panel is a workspace there and outside clicks are deck work. A fetch
     in flight is NOT interrupted by hiding — reopening shows its marks. */
  document.addEventListener('click', () => {
    if (host.style.display !== 'none'
        && typeof matchMedia === 'function' && matchMedia('(max-width:700px)').matches)
      host.style.display = 'none';
  });
}

function foot(s) { if (sr) sr.getElementById('ft').textContent = s; }

async function doSearch() {
  const $ = id => sr.getElementById(id);
  const ls = $('ls'); ls.innerHTML = '<div class="it"><span class="m">searching…</span></div>';
  if ($('src').value === 'commons') return doSearchCommons();
  try {
    const r = await search({ preset: $('preset').value, text: $('q').value, rows: 40 });
    foot(r.found + ' licensed releases match · showing ' + r.items.length + ' by downloads');
    ls.innerHTML = '';
    if (!r.items.length) { ls.innerHTML = '<div class="it"><span class="m">nothing matched</span></div>'; return; }
    for (const it of r.items) {
      const row = document.createElement('div'); row.className = 'it';
      row.innerHTML = `<span class="t">${esc(it.title || it.id)}</span><span class="bts"><button data-id="${esc(it.id)}">+ add</button><button class="rm" title="remove this release's tracks from the corpus — the analysis cache and the fetched bytes keep them for next time. The Archive holds some albums under more than one item (Digital Memories twice), and the two editions' names never match, so fetching both doubles every song and the set builder cannot fold them.">⊖</button></span>
        <span class="m">${esc(it.creator || '—')}${it.year ? ' · ' + esc(it.year) : ''} · <span class="lic">${esc(it.licenceName || it.licence)}</span>${it.noDerivatives ? ' <span class="nd">no-derivatives</span>' : ''} · ${esc(it.downloads)} downloads · <a href="${esc(it.page)}" target="_blank" rel="noopener" style="color:inherit">page ↗</a></span>`;
      /* ⊖ undo for a fetched release, by the source stamp on the records.
         Splices the shared corpus array in place (it is exposed by getter,
         not settable) and re-runs normalise: energy is scaled to the corpus
         min/max, so REMOVING material legitimately moves every figure, the
         same as adding it does. The playing deck holds its own references
         and is not touched — rebuild to make the change real. */
      row.querySelector('.rm').onclick = () => {
        const C = window.DW && window.DW.corpus;
        if (!C) return;
        let n = 0;
        for (let i = C.length - 1; i >= 0; i--)
          if (C[i].source && C[i].source.item === it.id) { C.splice(i, 1); n++; }
        if (n && window.DW.normalise) window.DW.normalise(C);
        /* foot() sets textContent, so no escaping here — entities would show */
        const msg = n ? n + ' removed (' + it.id + ') · ' + C.length + ' in corpus — rebuild the set to apply'
                      : 'nothing from this release is in the corpus';
        foot(msg); if (n) log(msg);
      };
      const b = row.querySelector('button');
      b.onclick = async () => {
        b.disabled = true; b.textContent = 'listing…';
        try {
          const rel = await release(it.id);
          if (!rel.tracks.length) { b.textContent = 'no audio'; return; }
          /* Per-track state, read from the CORPUS, not inferred from the
             fetch loop — a track is "grabbed" iff its record is in there
             (the id is the cache key, name|size|mtime). ingest() reports
             only aggregates, and with the Archive under load (keeper:
             "I think some got dropped in the download attempt") the ✗
             marks are the answer to "which ones". */
          const grabbed = t => !!(window.DW && window.DW.corpus.some(
            m => m.id === t.name + '|' + t.size + '|' + (t.lastModified || 0)));
          const list = document.createElement('div');
          list.innerHTML = rel.tracks.map(t =>
            `<div class="tr"><i class="st ${grabbed(t) ? 'ok' : ''}">${grabbed(t) ? '✓' : '·'}</i>` +
            `<span>${esc(t.name)}</span><span class="x">${esc(t.source.format)} · ${mb(t.size)}</span></div>`).join('');
          row.after(list);
          const marks = [...list.querySelectorAll('.st')];
          const sweep = () => { let bad = 0;
            rel.tracks.forEach((t, k) => { const on = grabbed(t);
              marks[k].textContent = on ? '✓' : '✗'; marks[k].className = 'st ' + (on ? 'ok' : 'no');
              if (!on) bad++; });
            return bad; };
          /* the release title folds its track list — click it again to
             collapse back from whence it came */
          const tEl = row.querySelector('.t');
          tEl.classList.add('fold');
          tEl.onclick = () => list.style.display = list.style.display === 'none' ? '' : 'none';
          const doFetch = async () => {
            b.disabled = true; b.textContent = 'fetching…';
            const PH = window.DWPHONE; if (PH) PH.hold('libre');
            /* the button carries track-and-percent while bytes arrive:
               `3/12 · 47%` — bytes when the length header is unreadable */
            const cur = { i: 1, n: rel.tracks.length };
            const un = watchFetch(ev => { if (!ev.done)
              b.textContent = cur.i + '/' + cur.n + ' · ' + (ev.total ? Math.min(99, Math.round(ev.loaded / ev.total * 100)) + '%' : mb(ev.loaded)); });
            try {
              const r = await window.DW.ingest(rel.tracks, (i, n, nm) => {
                cur.i = i; cur.n = n;
                if (marks[i - 1]) { marks[i - 1].textContent = '▸'; marks[i - 1].className = 'st on'; }
                if (i > 1 && marks[i - 2]) { const on = grabbed(rel.tracks[i - 2]);
                  marks[i - 2].textContent = on ? '✓' : '✗'; marks[i - 2].className = 'st ' + (on ? 'ok' : 'no'); }
                b.textContent = i + '/' + n; foot(i + '/' + n + ' ' + String(nm).slice(0, 48));
              });
              const bad = sweep();
              /* a failed track is one press away from another try — ingest
                 dedupes by id, so a retry costs the succeeded ones nothing */
              b.textContent = bad ? '↻ retry ' + bad + ' failed'
                : '✓ ' + r.added + ' added' + (r.duplicates ? ' · ' + r.duplicates + ' had' : '');
              b.classList.add('hot'); b.disabled = false;
              if (!bad) b.onclick = null;
              const msg = r.added + ' added from ' + (rel.creator || rel.id) + ' · ' + (rel.licenceName || rel.licence)
                + ' · from archive.org · ' + window.DW.corpus.length + ' in corpus'
                + (bad ? ' · ' + bad + ' FAILED (✗ in the list — retry is on the button)' : '');
              foot(msg); log(msg);
            } catch (e) { b.textContent = '↻ retry'; b.disabled = false; sweep(); foot(String(e && e.message || e)); }
            finally { un(); if (PH) PH.release('libre'); }
          };
          b.textContent = 'fetch ' + rel.tracks.length + ' · ' + mb(rel.bytes);
          b.disabled = false;
          b.onclick = doFetch;
        } catch (e) { b.textContent = 'failed'; foot(String(e && e.message || e)); }
      };
      ls.appendChild(row);
    }
  } catch (e) { ls.innerHTML = ''; foot('search failed: ' + String(e && e.message || e)); }
}

/* Commons results: one row per FILE, and + fetches that one track through
   the same DW.ingest door. The ⊖ removal works by the same source.item
   stamp the Archive rows use. */
async function doSearchCommons() {
  const $ = id => sr.getElementById(id);
  const ls = $('ls');
  try {
    const r = await searchCommons($('q').value, 40);
    foot(r.found + ' audio files match on Commons · showing ' + r.items.length + ' by relevance');
    ls.innerHTML = '';
    if (!r.items.length) { ls.innerHTML = '<div class="it"><span class="m">nothing matched</span></div>'; return; }
    const grabbed = t => !!(window.DW && window.DW.corpus.some(
      m => m.id === t.name + '|' + t.size + '|' + (t.lastModified || 0)));
    for (const it of r.items) {
      const row = document.createElement('div'); row.className = 'it';
      row.innerHTML = `<span class="t">${esc(it.title)}</span><span class="bts"><button data-id="${esc(it.id)}"></button><button class="rm" title="remove this track from the corpus — the analysis cache and the fetched bytes keep it for next time">⊖</button></span>
        <span class="m">${esc(it.creator || '—')} · <span class="lic">${esc(it.licenceName || it.licence || 'licence unknown')}</span>${it.noDerivatives ? ' <span class="nd">no-derivatives</span>' : ''} · ${esc((it.mime || '').replace('audio/', ''))} · ${mb(it.bytes)}${safeHref(it.page) ? ` · <a href="${esc(safeHref(it.page))}" target="_blank" rel="noopener" style="color:inherit">page ↗</a>` : ''}</span>`;
      row.querySelector('.rm').onclick = () => {
        const C = window.DW && window.DW.corpus;
        if (!C) return;
        let n = 0;
        for (let i = C.length - 1; i >= 0; i--)
          if (C[i].source && C[i].source.item === it.id) { C.splice(i, 1); n++; }
        if (n && window.DW.normalise) window.DW.normalise(C);
        const msg = n ? n + ' removed · ' + C.length + ' in corpus — rebuild the set to apply'
                      : 'that track is not in the corpus';
        foot(msg); if (n) log(msg);
      };
      const b = row.querySelector('button');
      const label = () => { b.textContent = grabbed(it.file) ? '✓ added' : 'fetch · ' + mb(it.bytes); };
      label();
      b.onclick = async () => {
        if (grabbed(it.file)) return;
        b.disabled = true; b.textContent = 'fetching…';
        const PH = window.DWPHONE; if (PH) PH.hold('libre');
        const un = watchFetch(ev => { if (!ev.done)
          b.textContent = ev.total ? Math.min(99, Math.round(ev.loaded / ev.total * 100)) + '%' : mb(ev.loaded); });
        try {
          const res = await window.DW.ingest([it.file]);
          const on = grabbed(it.file);
          b.textContent = on ? '✓ added' : '↻ retry';
          if (on) b.classList.add('hot');
          const msg = (on ? '1 added' : 'FAILED (retry is on the button' + (res.failed ? ' — the decoder refused it; Ogg/Opus does not decode on an iPhone' : '') + ')')
            + ' · ' + (it.creator || it.title) + ' · ' + (it.licenceName || it.licence || 'licence unknown')
            + ' · from commons.wikimedia.org · ' + window.DW.corpus.length + ' in corpus';
          foot(msg); log(msg);
        } catch (e) { b.textContent = '↻ retry'; foot(String(e && e.message || e)); }
        finally { un(); b.disabled = false; if (PH) PH.release('libre'); }
      };
      ls.appendChild(row);
    }
  } catch (e) { ls.innerHTML = ''; foot('search failed: ' + String(e && e.message || e)); }
}

function open(opts) {
  if (opts && typeof opts.log === 'function') log = opts.log;
  const fresh = !host;
  mount(opts && opts.root);
  const show = fresh || host.style.display === 'none' || (opts && opts.show === true);
  host.style.display = show ? '' : 'none';
  /* ⊕ means "I want the panel" — a fold left over from last time would
     reopen as a mostly-empty bar and read as broken */
  if (show && unfold) unfold();
  if (show) sr.getElementById('q').focus();
  return show;
}

async function clearCache() {
  if (typeof caches === 'undefined') return false;
  return caches.delete(CACHE_NAME);
}
async function cacheSize() {
  const c = await cacheOpen(); if (!c) return null;
  const keys = await c.keys(); let bytes = 0;
  for (const k of keys) { const r = await c.match(k); if (r) { const l = +r.headers.get('content-length'); if (l) bytes += l; else bytes += (await r.clone().arrayBuffer()).byteLength; } }
  return { files: keys.length, bytes };
}

return {
  ORIGIN, COMMONS, PRESETS, PREFER, RemoteFile, current, stats, watchFetch,
  buildQuery, searchURL, licenceName, noDerivs, pickTracks, attribution, displayName,
  commonsSearchURL, commonsInfoURL, searchCommons, stripTags,
  search, release, add, demo, open, clearCache, cacheSize,
  /* for the harness: swap the network */
  _fetchBytes: fetchBytes, _getJSON: getJSON
};
})();
