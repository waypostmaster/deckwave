/* DECKWAVE PATCH 03 — FLAC tag reading (VORBIS_COMMENT)
   Real artist / album / title / date / track number, read from the file.
   Without this, every name in the UI is derived from the filename.

   THE TRAP, and it is the whole reason this needs a comment:
   FLAC metadata block HEADERS are BIG-endian. The Vorbis comment payload
   INSIDE them is LITTLE-endian. Get that backwards and you read nonsense
   string lengths and walk off the end of the buffer. `getUint32(q, true)`
   — the `true` is not optional.

   Lazy by design: tags are fetched on demand for the current and next track
   and cached by record id, so an already-analysed corpus needs no rescan.
   The next track is prefetched so its title is ready before the blend.  */

window.DWTAGS = (function () {
'use strict';
const dec = new TextDecoder('utf-8');

/* Reads only the first megabyte — metadata lives at the head of the file
   and we have no reason to pull a 40MB track into memory for a title. */
async function read(file, maxBytes) {
  const head = await file.slice(0, maxBytes || 1048576).arrayBuffer();
  const u = new Uint8Array(head), v = new DataView(head);
  if (String.fromCharCode(u[0], u[1], u[2], u[3]) !== 'fLaC') return null;

  let p = 4; const out = {};
  while (p + 4 <= u.length) {
    const hdr = u[p], last = (hdr & 0x80) !== 0, type = hdr & 0x7f;
    const len = (u[p + 1] << 16) | (u[p + 2] << 8) | u[p + 3];   /* BIG-endian */
    p += 4;

    if (type === 4) {                                   /* VORBIS_COMMENT */
      let q = p;
      const vlen = v.getUint32(q, true); q += 4 + vlen;  /* LITTLE-endian */
      const n = v.getUint32(q, true); q += 4;
      for (let i = 0; i < n && q + 4 <= u.length; i++) {
        const l = v.getUint32(q, true); q += 4;
        if (q + l > u.length) break;
        const s = dec.decode(u.subarray(q, q + l)); q += l;
        const eq = s.indexOf('='); if (eq < 1) continue;
        const k = s.slice(0, eq).toUpperCase(), val = s.slice(eq + 1);
        out[k] = out[k] ? out[k] + ', ' + val : val;     /* multi-value tags */
      }
    }
    p += len;
    if (last) break;
  }
  return Object.keys(out).length ? out : null;
}

/* Normalise the tags people actually set. TRACKNUMBER is often "9/14". */
function tidy(t) {
  if (!t) return null;
  return {
    title: t.TITLE || null,
    artist: t.ARTIST || t.ALBUMARTIST || null,
    album: t.ALBUM || null,
    albumartist: t.ALBUMARTIST || null,
    date: (t.DATE || t.YEAR || '').slice(0, 4) || null,
    track: t.TRACKNUMBER ? String(t.TRACKNUMBER).split('/')[0] : null,
    disc: t.DISCNUMBER || null,
    genre: t.GENRE || null,
    isrc: t.ISRC || null,
    comment: t.COMMENT || t.DESCRIPTION || null
  };
}

/* --- lazy cache -------------------------------------------------------- */
const cache = {};

/* Returns tags if already read, else null and starts the read.
   Never blocks the render loop; the next frame picks up the result. */
function forRecord(rec, lib) {
  if (!rec) return null;
  if (cache[rec.id] !== undefined) return cache[rec.id];
  cache[rec.id] = null;                          /* mark in-flight */
  const f = lib && lib.find(rec);
  if (!f) return null;
  read(f).then(raw => { cache[rec.id] = tidy(raw) || null; })
         .catch(() => { cache[rec.id] = null; });
  return null;
}

return { read, tidy, forRecord, get cache() { return cache; } };
})();
