/* ─────────────────────────────────────────────────────────────────────────
   DECKWAVE PATCH 06 — corpus cache export / restore

   The cache is the most expensive thing in the browser and the most fragile.
   189 tracks took a long analysis pass to produce; clearing site data
   destroys it in one click, and re-analysis is not guaranteed to reproduce
   the same values — a different Essentia or WASM build can shift features
   slightly, which is enough to change which track the sequencer picks next.

   So: export it, keep the file, and be able to put it back.

   WHAT IS AND IS NOT IN THE FILE
   Features only. No audio, no file handles. Restoring the cache means the
   analysis is recovered; you still have to re-point the app at the folder
   for playback, because file handles cannot be serialised.

   VERIFY, DO NOT ASSUME
   restore() returns a comparison against the summary recorded at export —
   track count, total beats, mean confidence, tempo range. If those do not
   match, the restore is wrong and you want to know immediately rather than
   discover it when a set comes out different.
   ───────────────────────────────────────────────────────────────────────── */

window.DWCACHE = (function () {
'use strict';

/* MUST match deckwave.js. It did not, and nothing said so.
   The analyser reads and writes 'deckwave'; this module was still on
   'deckcorpus', an earlier name. Export therefore read a store the analyser
   never fills, and restore wrote 189 records into a database the engine never
   opens — a silent no-op that reports success. The corpus that survived long
   enough to be exported only did so because it was analysed before the rename.
   One name, defined once, and an adoption path for anything left behind. */
const DB = 'deckwave', STORE = 'f', LEGACY_DB = 'deckcorpus';

const open = () => new Promise((res, rej) => {
  const r = indexedDB.open(DB, 1);
  r.onupgradeneeded = () => {
    const db = r.result;
    if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
  };
  r.onsuccess = () => res(r.result);
  r.onerror = () => rej(r.error);
});

const readAll = db => new Promise((res, rej) => {
  const r = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
  r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
});

/* Read the pre-rename database WITHOUT creating it. indexedDB.open with no
   version will happily bring an empty one into existence, which would then
   look like a real-but-empty cache forever. Check the list first. */
const readLegacy = async () => {
  if (!indexedDB.databases) return [];
  const names = (await indexedDB.databases()).map(d => d.name);
  if (!names.includes(LEGACY_DB)) return [];
  return new Promise(res => {
    const q = indexedDB.open(LEGACY_DB);
    q.onsuccess = () => {
      const db = q.result;
      if (!db.objectStoreNames.contains(STORE)) { db.close(); res([]); return; }
      const g = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
      g.onsuccess = () => { res(g.result || []); db.close(); };
      g.onerror = () => { res([]); db.close(); };
    };
    q.onerror = () => res([]);
  });
};

/* Adopt a corpus stranded under the old name. Only ever runs when the current
   store is empty, so it cannot overwrite a live analysis. Returns how many
   records moved, because a silent migration is just a different silent bug. */
async function adoptLegacy() {
  const db = await open();
  const here = await readAll(db);
  if (here.length) { db.close(); return { adopted: 0, reason: 'current store not empty' }; }
  const old = await readLegacy();
  if (!old.length) { db.close(); return { adopted: 0, reason: 'nothing under the old name' }; }
  await new Promise((res, rej) => {
    const t = db.transaction(STORE, 'readwrite'), s = t.objectStore(STORE);
    old.forEach(r => s.put(normaliseRow(r)));
    t.oncomplete = res; t.onerror = () => rej(t.error);
  });
  const after = summarise(await readAll(db));
  db.close();
  return { adopted: old.length, from: LEGACY_DB, after };
}

/* A beat list must be a plain Array by the time it reaches JSON.
   Three shapes arrive here and all three have to end up the same:
     Float32Array  — anything scanned before the Array.from fix in deckwave.js.
                     Survives IndexedDB intact, dies in JSON.stringify.
     {"0":n,...}   — a cache file written from a Float32Array. No .length,
                     no .map, so restoring one breaks playback at the first
                     transition and makes summarise() return NaN.
     Array         — correct; passes through untouched.
   Numeric sort on the keys, because object key order is not a guarantee
   worth resting a beat grid on. */
function toBeatArray(b) {
  if (!b) return [];
  if (Array.isArray(b)) return b;
  if (ArrayBuffer.isView(b)) return Array.from(b);
  return Object.keys(b).map(Number).sort((x, y) => x - y).map(k => b[k]);
}

function normaliseRow(r) {
  if (!r || typeof r !== 'object') return r;
  const b = toBeatArray(r.beats);
  return (b === r.beats) ? r : Object.assign({}, r, { beats: b });
}

/* Integrity figures. Computed the same way at export and at restore so the
   two can be compared rather than trusted. */
function summarise(rows) {
  let beats = 0, noBeats = 0, confSum = 0;
  const bpms = [];
  rows.forEach(r => {
    const b = (r.beats || []).length;
    beats += b; if (!b) noBeats++;
    confSum += (r.conf || 0);
    if (r.bpm) bpms.push(r.bpm);
  });
  bpms.sort((a, b) => a - b);
  return {
    tracks: rows.length,
    totalBeats: beats,
    tracksWithNoBeats: noBeats,
    meanConfidence: rows.length ? +(confSum / rows.length).toFixed(3) : 0,
    bpmMin: bpms[0], bpmMedian: bpms[Math.floor(bpms.length / 2)], bpmMax: bpms[bpms.length - 1],
    totalDurationHours: +(rows.reduce((a, r) => a + (r.dur || 0), 0) / 3600).toFixed(2)
  };
}

return {
  summarise,
  adoptLegacy,

  async build() {
    const db = await open();
    /* Normalise BEFORE summarising, so the figures recorded in the file
       describe the records the file actually contains. A store written by an
       older scan still holds Float32Array beats. */
    const rows = (await readAll(db)).map(normaliseRow);
    db.close();
    return {
      format: 'deckwave-corpus-cache',
      version: 1,
      exported: new Date().toISOString(),
      engine: {
        detector: 'essentia.js RhythmExtractor2013 multifeature',
        keyDetector: 'essentia.js KeyExtractor',
        excerptSec: 120,
        note: 'Features only. No audio. Re-analysis with a different Essentia '
            + 'build may not reproduce these values bit-for-bit.'
      },
      summary: summarise(rows),
      records: rows
    };
  },

  /* Downloads the file. Filename carries the date — never overwrite a
     previous export; each one is a snapshot of a corpus state. */
  async export() {
    const payload = await this.build();
    const json = JSON.stringify(payload);
    const name = 'deckwave-corpus-cache-' + new Date().toISOString().slice(0, 10) + '.json';
    const b = new Blob([json], { type: 'application/json' });
    const u = URL.createObjectURL(b), a = document.createElement('a');
    a.href = u; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(u), 20000);
    return { file: name, bytes: json.length, summary: payload.summary };
  },

  /* mode 'merge' keeps existing records and adds missing ones;
     mode 'replace' clears the store first. Default is merge — the
     conservative choice, since a partial import should not destroy
     analyses that are already present. */
  async restore(json, mode) {
    const d = typeof json === 'string' ? JSON.parse(json) : json;
    if (d.format !== 'deckwave-corpus-cache') throw new Error('not a deckwave corpus cache file');
    if (!Array.isArray(d.records)) throw new Error('no records in file');

    const db = await open();
    await new Promise((res, rej) => {
      const t = db.transaction(STORE, 'readwrite');
      const s = t.objectStore(STORE);
      if (mode === 'replace') s.clear();
      /* Repair on the way in. Every cache file written before this fix carries
         beats as {"0":n,...}; storing that shape verbatim is what breaks the
         set at its first transition. */
      d.records.forEach(r => s.put(normaliseRow(r)));
      t.oncomplete = res; t.onerror = () => rej(t.error);
    });
    const after = summarise(await readAll(db));
    db.close();

    /* compare against what the file claims, field by field */
    const expected = d.summary || {};
    const mismatches = Object.keys(expected).filter(k => expected[k] !== after[k]);

    return {
      mode: mode || 'merge',
      imported: d.records.length,
      expected, after,
      matches: mode === 'replace' ? mismatches.length === 0 : null,
      mismatches: mode === 'replace' ? mismatches : ['(merge mode — totals will differ if the store was not empty)'],
      note: 'Analysis restored. You must still re-open the library folder for '
          + 'playback — file handles cannot be serialised.'
    };
  },

  /* What is currently in the cache, without exporting it. */
  async status() {
    const db = await open();
    const rows = await readAll(db);
    db.close();
    return summarise(rows);
  }
};
})();
