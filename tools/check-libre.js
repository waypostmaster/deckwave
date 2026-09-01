/* Does the libre source (DWLIBRE) do what it says, without a network?

   DWLIBRE brings freely-licensed music in from the Internet Archive as
   RemoteFile objects that honour the File contract the engine already
   relies on, carrying licence + attribution as `source`. Nothing here
   touches archive.org: fetch, caches and DW are fakes. What IS checked:

     · the search query can only ever return audio items that carry a
       licence URL — the filter is in the query, so an unlicensed item
       cannot be offered by a UI mistake;
     · licence URLs get honest short names, unknown ones get none (nothing
       is called free that the table does not recognise), -nd is flagged;
     · one file per track is picked in the preferred format with fallback,
       non-audio files fall out, names come from the Archive's own tags,
       and the cache key parts (name · size · lastModified) are stable;
     · RemoteFile: arrayBuffer() fetches with CORS, slice(a,b) sends a Range,
       a second read is a Cache API hit, at most two fetches are in flight,
       a 503 is retried with backoff and a 404 is not;
     · add() hands the RemoteFiles to DW.ingest (the same door as a local
       file) and returns an attribution line;
     · DWSCORE (the real module) writes `source` per step, null for a local
       track, puts it back on load(), counts it in the summary and prints a
       REM ATTRIBUTION line in the cue sheet;
     · the three one-line hooks in the engine, the card and the log exist
       in the source text (a presence check, labelled as such — the
       behaviour they gate is exercised in the browser, not here).

   What it does NOT establish: CORS on the real hosts (measured by hand,
   see the module header), how the tracks fare in the pool gate, or how
   any of it sounds.

       node tools/check-libre.js
*/
const fs = require('fs');
let fails = 0, checks = 0;
const ok = (name, cond, falsifier) => {
  checks++;
  if (!cond) { fails++; console.log('  FAIL  ' + name + '\n        falsifier hit: ' + falsifier); }
  else console.log('  pass  ' + name);
};
const read = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
/* A harness that hangs on a promise and lets the event loop drain would exit
   0 with no summary — a pass by silence. If the summary line has not been
   printed when the process exits, that is a failure. */
let finished = false;
process.on('exit', code => { if (!finished) { console.log('\n  FAIL  harness did not reach its summary (a promise never settled)'); process.exitCode = 1; } });

/* ── fakes: the network, the Cache API, the engine ─────────────────────── */
const net = { calls: [], inflight: 0, maxInflight: 0, script: {} };
const bytes = n => { const b = new Uint8Array(n); for (let i = 0; i < n; i++) b[i] = i & 255; return b.buffer; };
global.fetch = async (url, opts) => {
  net.inflight++; net.maxInflight = Math.max(net.maxInflight, net.inflight);
  net.calls.push({ url, opts: opts || {} });
  await new Promise(r => setTimeout(r, 30));
  net.inflight--;
  const s = net.script[url];
  if (s && s.length) { const st = s.shift(); return { ok: false, status: st, headers: new Map(), async arrayBuffer() { return bytes(0); }, clone() { return this; } }; }
  if (/advancedsearch/.test(url)) return { ok: true, status: 200, async json() { return SEARCH; } };
  if (/commons\.wikimedia\.org.*list=search/.test(url)) return { ok: true, status: 200, async json() { return CM_SEARCH; } };
  if (/commons\.wikimedia\.org.*imageinfo/.test(url)) return { ok: true, status: 200, async json() { return CM_INFO; } };
  if (/\/metadata\//.test(url)) return { ok: true, status: 200, async json() { return ITEM; } };
  if (/missing/.test(url)) return { ok: false, status: 404, headers: new Map(), async arrayBuffer() { return bytes(0); }, clone() { return this; } };
  /* a streaming response: 1000 bytes in 250-byte chunks, Content-Length
     set — the shape a real Archive storage node answers with. `streamdie`
     kills the body after one chunk on the FIRST call only, so the retry
     path can be watched succeeding. */
  if (/streamy|streamdie/.test(url)) {
    const die = /streamdie/.test(url) && !(net.died = net.died || {})[url] && (net.died[url] = true);
    let sent = 0;
    const r = { ok: true, status: 200, headers: new Map([['content-length', '1000']]),
      body: { getReader() { return { async read() {
        if (die && sent >= 250) throw new Error('body died mid-stream');
        if (sent >= 1000) return { done: true };
        sent += 250; return { done: false, value: new Uint8Array(250).fill(7) };
      } }; } },
      async arrayBuffer() { return bytes(1000); },
      clone() { return { async arrayBuffer() { return bytes(1000); } }; } };
    return r;
  }
  const range = opts && opts.headers && opts.headers.Range;
  const n = range ? (+range.split('-')[1] - +range.split('=')[1].split('-')[0] + 1) : 1000;
  const r = { ok: true, status: range ? 206 : 200, headers: new Map([['content-length', String(n)]]),
    async arrayBuffer() { return bytes(n); }, clone() { return r; } };
  return r;
};
const store = new Map();
global.caches = { async open() { return {
  async match(u) { return store.has(u) ? { async arrayBuffer() { return store.get(u); } } : undefined; },
  async put(u, r) { store.set(u, await r.arrayBuffer()); },
  async keys() { return [...store.keys()]; } }; },
  async delete() { store.clear(); return true; } };
global.window = global;
/* the element fake carries just enough DOM for mount(): the fold code
   (2026-08-21) reads classList and querySelector('.hd') on the box */
const fakeClassList = () => { const s = new Set(); return {
  add(...a) { a.forEach(x => s.add(x)); }, remove(...a) { a.forEach(x => s.delete(x)); },
  toggle(c, f) { const on = f === undefined ? !s.has(c) : !!f; on ? s.add(c) : s.delete(c); return on; },
  contains(c) { return s.has(c); } }; };
global.document = { createElement() { return { style: {}, classList: fakeClassList(), appendChild() {},
  querySelector() { return { style: {}, addEventListener() {} }; }, addEventListener() {},
  attachShadow() { return { appendChild() {}, getElementById() { return { value: '', style: {}, focus() {}, onchange: null }; } }; } }; }, body: { appendChild() {} } };
global.TextDecoder = require('util').TextDecoder;
const ingested = [];
const transport = { playCalls: [], reorderCalls: [], skipDuringDemo: null };
global.DW = { corpus: [], async ingest(files, onProgress) {
  ingested.push(files);
  /* mid-demo, the transport must answer with the hold message — probed from
     INSIDE the fetch of the remaining tracks, where a listener would tap it */
  if (global.__probeHoldDuringIngest) { global.__probeHoldDuringIngest = false;
    transport.skipDuringDemo = await global.DW.skip(); }
  for (let i = 0; i < files.length; i++) { if (onProgress) onProgress(i + 1, files.length, files[i].name);
    const id = files[i].name + '|' + files[i].size + '|' + files[i].lastModified;
    /* records store the name minus its extension — deckwave.js analyse() */
    const r = { id, name: String(files[i].name).replace(/\.[^.]+$/, ''), bpm: 120 };
    if (files[i].source) r.source = files[i].source; this.corpus.push(r); }
  return { seen: files.length, added: files.length, cached: 0, failed: 0, duplicates: 0, corpus: this.corpus.length };
},
  async play(seq, from) { transport.playCalls.push({ seq: seq || [], from, phrase: !!(seq && seq.phrase) }); return 'playing'; },
  async reorder(seq, opts) { transport.reorderCalls.push(seq); return 'reordered · ' + (seq.length - 1) + ' ahead'; },
  async skip() { return 'real skip'; }, async back() { return 'real back'; },
  async blendNow() { return 'real blendNow'; }, async queueNext() { return 'real queueNext'; }
};

/* the Archive's shapes, as its APIs return them (trimmed from real answers) */
const SEARCH = { response: { numFound: 1500, docs: [
  { identifier: 'exp037', title: 'Wrexsoul - Alchemy Sound LP [exp037]', creator: 'Wrexsoul', licenseurl: 'http://creativecommons.org/licenses/by-nc-sa/2.5/', year: '2009', downloads: 812 },
  { identifier: 'Hfr011', title: ['Hfr011 - Tactical Assault'], creator: ['A', 'B'], licenseurl: 'http://creativecommons.org/licenses/by-nd/2.0/uk/', date: '2008-03-01T00:00:00Z', downloads: 40 }
] } };
const ITEM = { metadata: { identifier: 'exp037', title: 'Wrexsoul - Alchemy Sound LP [exp037]', creator: 'Wrexsoul', licenseurl: 'http://creativecommons.org/licenses/by-nc-sa/2.5/' },
  files: [
    { name: 'wrexsoul_-_alchemy_sound_-_01_-_indigo.flac', source: 'original', format: 'Flac', mtime: '1240000000', size: '55372269', length: '485.54', title: 'Indigo', artist: 'Wrexsoul', track: '1' },
    { name: 'wrexsoul_-_alchemy_sound_-_01_-_indigo.mp3', source: 'derivative', format: 'VBR MP3', original: 'wrexsoul_-_alchemy_sound_-_01_-_indigo.flac', mtime: '1240000100', size: '11780096', length: '08:05' },
    { name: 'wrexsoul_-_alchemy_sound_-_01_-_indigo.ogg', source: 'derivative', format: 'Ogg Vorbis', original: 'wrexsoul_-_alchemy_sound_-_01_-_indigo.flac', mtime: '1240000200', size: '6329247', length: '485.54' },
    { name: 'wrexsoul_-_alchemy_sound_-_02_-_stormchaser.flac', source: 'original', format: 'Flac', mtime: '1240000000', size: '31370039', length: '280.62' },
    { name: 'wrexsoul_-_alchemy_sound_-_02_-_stormchaser.mp3', source: 'derivative', format: 'VBR MP3', original: 'wrexsoul_-_alchemy_sound_-_02_-_stormchaser.flac', mtime: '1240000100', size: '6572032' },
    { name: 'cover.jpg', source: 'original', format: 'JPEG', size: '90000' },
    { name: 'exp037_meta.xml', source: 'original', format: 'Metadata', size: '900' },
    { name: 'exp037_archive.torrent', source: 'metadata', format: 'Archive BitTorrent', size: '9000' }
  ] };

/* Wikimedia Commons shapes, trimmed from real answers (2026-08-20) */
const CM_SEARCH = { query: { searchinfo: { totalhits: 231 }, search: [
  { title: 'File:8-bit Music for GameDev - 01. Slay The Evil.opus' },
  { title: 'File:Lo-Res Legend.wav' },
  { title: 'File:No imageinfo.ogg' }
] } };
const CM_INFO = { query: { pages: {
  '1': { title: 'File:Lo-Res Legend.wav', imageinfo: [{
      url: 'https://upload.wikimedia.org/wikipedia/commons/e/ed/Lo-Res_Legend.wav',
      descriptionurl: 'https://commons.wikimedia.org/wiki/File:Lo-Res_Legend.wav',
      size: 7257644, timestamp: '2024-05-01T00:00:00Z', mime: 'audio/x-wav',
      extmetadata: { LicenseShortName: { value: 'CC0' },
        LicenseUrl: { value: 'https://creativecommons.org/publicdomain/zero/1.0/' },
        Artist: { value: '<a href="https://example.com/u/somebody">Some<b>body</b></a>' } } }] },
  '2': { title: 'File:8-bit Music for GameDev - 01. Slay The Evil.opus', imageinfo: [{
      url: 'https://upload.wikimedia.org/wikipedia/commons/a/aa/8-bit_Music_for_GameDev_-_01._Slay_The_Evil.opus',
      descriptionurl: 'https://commons.wikimedia.org/wiki/File:8-bit_Music_for_GameDev_-_01._Slay_The_Evil.opus',
      size: 1545099, timestamp: '2023-11-11T12:00:00Z', mime: 'audio/ogg',
      extmetadata: { LicenseShortName: { value: 'CC0' },
        LicenseUrl: { value: 'https://creativecommons.org/publicdomain/zero/1.0/' },
        Artist: { value: 'GameDev Composer' } } }] },
  '3': { title: 'File:No imageinfo.ogg' }
} } };

/* ── load the real modules ─────────────────────────────────────────────── */
const libreSrc = read('assets/deckwave-libre.js');
eval(libreSrc);
const L = window.DWLIBRE;
ok('module loads and exposes its surface', L && typeof L.search === 'function' && typeof L.pickTracks === 'function' && L.RemoteFile,
   'DWLIBRE missing or incomplete');

/* ── queries ───────────────────────────────────────────────────────────── */
for (const k of Object.keys(L.PRESETS)) {
  const q = L.buildQuery(k, '');
  ok('preset "' + k + '" can only return licensed audio', /mediatype:audio/.test(q) && /licenseurl:\[\* TO \*\]/.test(q),
     'a query without the licence filter would offer unlicensed items: ' + q);
}
ok('the LukHash preset searches the CREATOR field, both aliases', /creator:\(lukhash OR "lukhash\.com"\)/.test(L.PRESETS.lukhash.q),
   'a plain word-match returns 138 items, almost all podcasts that merely PLAY him (measured 2026-08-19); creator: returns his own releases: ' + L.PRESETS.lukhash.q);
ok('free text is ANDed in and cannot break the licence filter',
   /licenseurl/.test(L.buildQuery('any', 'nullsleep) OR (mediatype:texts')) && !/\) OR \(/.test(L.buildQuery('any', 'nullsleep) OR (mediatype:texts')),
   'parentheses in user text could close the group and widen the query');
const su = L.searchURL({ preset: 'chiptune', text: 'nullsleep', rows: 7, page: 2 });
ok('search URL asks for JSON, the fields the panel prints, rows and page',
   /output=json/.test(su) && /fl%5B%5D=licenseurl/.test(su) && /fl%5B%5D=creator/.test(su) && /rows=7/.test(su) && /page=2/.test(su),
   'the panel would have nothing to print, or would page wrongly: ' + su);

/* ── licences ──────────────────────────────────────────────────────────── */
ok('CC URLs get honest short names', L.licenceName('http://creativecommons.org/licenses/by-nc-sa/2.5/') === 'CC BY-NC-SA 2.5'
   && L.licenceName('https://creativecommons.org/licenses/by/4.0/') === 'CC BY 4.0'
   && L.licenceName('http://creativecommons.org/publicdomain/zero/1.0/') === 'CC0'
   && L.licenceName('http://creativecommons.org/licenses/publicdomain/') === 'public domain',
   'a known licence printed wrongly');
ok('an unknown licence URL gets NO name (it is shown raw, never called free)', L.licenceName('http://example.org/terms') === null && L.licenceName('') === null,
   'an unrecognised URL was given a name');
ok('-nd and -nc-nd are flagged no-derivatives, -sa is not',
   L.noDerivs('http://creativecommons.org/licenses/by-nd/2.0/uk/') && L.noDerivs('http://creativecommons.org/licenses/by-nc-nd/2.5/') && !L.noDerivs('http://creativecommons.org/licenses/by-nc-sa/2.5/'),
   'a no-derivatives track would enter a mix unflagged, or a -sa one flagged');

/* ── picking files ─────────────────────────────────────────────────────── */
let tr = L.pickTracks(ITEM, 'ogg');
ok('one file per track, non-audio files fall out', tr.length === 2, 'got ' + tr.length + ' from 2 tracks + 3 non-audio files');
ok('ogg preferred where it exists, mp3 where it does not', tr[0].source.format === 'Ogg Vorbis' && tr[1].source.format === 'VBR MP3',
   'formats: ' + tr.map(t => t.source.format).join(', '));
ok('flac preference picks the original', L.pickTracks(ITEM, 'flac').every(t => t.source.format === 'Flac'), 'a derivative was picked under flac preference');
ok('mp3 preference picks the mp3', L.pickTracks(ITEM, 'mp3').every(t => t.source.format === 'VBR MP3'), 'mp3 preference did not pick mp3');
ok('name comes from the Archive\'s own tags when present, filename otherwise, extension of the picked file',
   tr[0].name === 'Wrexsoul - Indigo.ogg' && tr[1].name === 'wrexsoul - alchemy sound - 02 - stormchaser.mp3',
   'names: ' + tr.map(t => t.name).join(' | '));
ok('cache-key parts are the picked file\'s size and mtime (ms)', tr[0].size === 6329247 && tr[0].lastModified === 1240000200000,
   'size/lastModified ' + tr[0].size + '/' + tr[0].lastModified + ' — a different key means a re-analysis every visit');
ok('download URL is the Archive\'s, item and file encoded', tr[0].url === 'https://archive.org/download/exp037/wrexsoul_-_alchemy_sound_-_01_-_indigo.ogg',
   tr[0].url);
const s0 = tr[0].source;
ok('source carries licence · name · creator · release · page · item · file', s0.licence && s0.licenceName === 'CC BY-NC-SA 2.5' && s0.creator === 'Wrexsoul'
   && /Alchemy Sound/.test(s0.release) && s0.page === 'https://archive.org/details/exp037' && s0.item === 'exp037' && s0.file && s0.noDerivatives === false,
   JSON.stringify(s0));
ok('attribution line names creator, release, licence and page', /Wrexsoul — .*Alchemy Sound.*CC BY-NC-SA 2\.5.*archive\.org\/details\/exp037/.test(L.attribution(s0)),
   L.attribution(s0));
ok('a creator array is joined', /A, B/.test(L.pickTracks({ metadata: { identifier: 'x', creator: ['A', 'B'], licenseurl: 'http://creativecommons.org/licenses/by/4.0/' },
   files: [{ name: 'a.mp3', format: 'VBR MP3', size: '1', mtime: '1' }] })[0].source.creator), 'array creator lost');
ok('a flac-only upload still comes in as flac under ogg preference', L.pickTracks({ metadata: { identifier: 'x' },
   files: [{ name: 'a.flac', format: 'Flac', size: '1', mtime: '1', source: 'original' }] }, 'ogg')[0].source.format === 'Flac', 'a release without derivatives yielded nothing');

/* ── RemoteFile contract ───────────────────────────────────────────────── */
(async () => {
  const f = tr[0];
  ok('RemoteFile has the File contract the engine reads', typeof f.name === 'string' && typeof f.size === 'number' && typeof f.lastModified === 'number'
     && typeof f.arrayBuffer === 'function' && typeof f.slice === 'function' && f.type === 'audio/ogg', 'analyse()/LIB.find()/audit would trip on a missing member');
  net.calls.length = 0;
  const ab = await f.arrayBuffer();
  ok('arrayBuffer() fetches the URL with CORS, no credentials', net.calls.length === 1 && net.calls[0].url === f.url && net.calls[0].opts.mode === 'cors' && net.calls[0].opts.credentials === 'omit' && ab.byteLength === 1000,
     JSON.stringify(net.calls[0]));
  net.calls.length = 0;
  const ab2 = await f.arrayBuffer();
  ok('a second read is a Cache API hit — no network', net.calls.length === 0 && ab2.byteLength === 1000 && L.stats.cacheHits >= 1,
     'fetched again: ' + net.calls.length + ' calls');
  net.calls.length = 0;
  const sl = await f.slice(0, 16).arrayBuffer();
  ok('slice(0,16).arrayBuffer() sends a Range and bypasses the cache', net.calls.length === 1 && net.calls[0].opts.headers && net.calls[0].opts.headers.Range === 'bytes=0-15' && sl.byteLength === 16,
     JSON.stringify(net.calls[0]) + ' bytes ' + sl.byteLength);

  /* concurrency: five tracks at once, at most two fetches in flight */
  const many = Array.from({ length: 5 }, (_, i) => new L.RemoteFile({ name: 'm' + i + '.ogg', size: 10, lastModified: 1, url: 'https://archive.org/download/x/m' + i + '.ogg' }));
  net.maxInflight = 0; net.inflight = 0;
  await Promise.all(many.map(m => m.arrayBuffer()));
  ok('at most two fetches in flight (bandwidth manners)', net.maxInflight <= 2 && net.maxInflight >= 1, 'max in flight ' + net.maxInflight);

  /* retry on 503, not on 404 */
  const u503 = 'https://archive.org/download/x/busy.ogg';
  net.script[u503] = [503, 503];
  const r0 = L.stats.retries;
  const got = await new L.RemoteFile({ name: 'busy.ogg', size: 1, lastModified: 1, url: u503 }).arrayBuffer();
  ok('a 503 is retried with backoff and then succeeds', got.byteLength === 1000 && L.stats.retries === r0 + 2, 'retries ' + (L.stats.retries - r0));
  let threw = null; net.calls.length = 0;
  try { await new L.RemoteFile({ name: 'missing.ogg', size: 1, lastModified: 1, url: 'https://archive.org/download/x/missing.ogg' }).arrayBuffer(); }
  catch (e) { threw = e; }
  ok('a 404 throws once and is not retried', threw && /404/.test(threw.message) && net.calls.length === 1, 'calls ' + net.calls.length + ' err ' + (threw && threw.message));

  /* ── download progress: the body is streamed and reported ──────────────
     (keeper, 2026-08-21, from the phone: "Can we add a percentage complete
     when downloading stuff? Especially the demo songs.") watchFetch(fn)
     gets { url, name, loaded, total, done } per chunk; a response without
     a readable body falls back to arrayBuffer() silently — every earlier
     check in this file exercises that fallback. */
  const evs = [];
  const unwatch = L.watchFetch(ev => evs.push(ev));
  const sf = new L.RemoteFile({ name: 'streamy.ogg', size: 1000, lastModified: 1, url: 'https://archive.org/download/x/streamy.ogg' });
  const sab = await sf.arrayBuffer();
  ok('a streamed body is assembled whole', sab.byteLength === 1000, 'byteLength ' + sab.byteLength);
  const chunkEvs = evs.filter(e => !e.done);
  ok('progress is reported per chunk, not one jump at the end', chunkEvs.length >= 3 && chunkEvs[0].loaded < chunkEvs[chunkEvs.length - 1].loaded,
     'loaded seen: ' + JSON.stringify(evs.map(e => e.loaded)) + ' — one event means the cache write was awaited before the read');
  ok('events carry name, total from Content-Length, and a final done', chunkEvs.every(e => e.name === 'streamy.ogg' && e.total === 1000)
     && evs[evs.length - 1].done === true && evs[evs.length - 1].loaded === 1000,
     JSON.stringify(evs[evs.length - 1]) + ' — a consumer could not print "streamy.ogg · 47%" from this');
  net.calls.length = 0; const n0 = evs.length;
  const sab2 = await sf.arrayBuffer();
  ok('the streamed track still lands in the Cache API, and a cache hit reports nothing', net.calls.length === 0 && sab2.byteLength === 1000 && evs.length === n0,
     'calls ' + net.calls.length + ' events grew ' + (evs.length - n0) + ' — either the clone was not stored or a hit pretends to download');
  const rDie = L.stats.retries;
  const dab = await new L.RemoteFile({ name: 'streamdie.ogg', size: 1000, lastModified: 1, url: 'https://archive.org/download/x/streamdie.ogg' }).arrayBuffer();
  ok('a body that dies mid-stream is retried like a 5xx and succeeds', dab.byteLength === 1000 && L.stats.retries === rDie + 1,
     'byteLength ' + dab.byteLength + ' retries ' + (L.stats.retries - rDie) + ' — before today a mid-body network drop escaped the retry loop entirely');
  unwatch();

  /* the JSON path retries a flapping front end too — the Archive answered
     502 then a 22 s 200 while the panel hung, 2026-08-19 */
  const uj = 'https://archive.org/advancedsearch.php?flappy';
  net.script[uj] = [502];
  const rj0 = L.stats.retries;
  const j = await L._getJSON(uj);
  ok('getJSON retries a 502 and then succeeds (search/metadata survive a flapping front end)',
     j && j.response && L.stats.retries === rj0 + 1, 'retries ' + (L.stats.retries - rj0) + ' — a 502 from advancedsearch left the panel on "searching…" forever');

  /* search · release · add */
  const sr = await L.search({ preset: 'chiptune', text: '' });
  ok('search() maps docs: id, title (array → first), creator (array → joined), licence name, -nd flag, year from date', sr.found === 1500 && sr.items.length === 2
     && sr.items[1].title === 'Hfr011 - Tactical Assault' && sr.items[1].creator === 'A, B' && sr.items[1].noDerivatives === true && sr.items[1].year === '2008'
     && sr.items[0].licenceName === 'CC BY-NC-SA 2.5' && sr.items[0].page === 'https://archive.org/details/exp037',
     JSON.stringify(sr.items));
  const rel = await L.release('exp037');
  ok('release() lists tracks with total bytes', rel.tracks.length === 2 && rel.bytes === 6329247 + 6572032 && rel.licenceName === 'CC BY-NC-SA 2.5', JSON.stringify({ n: rel.tracks.length, bytes: rel.bytes }));
  const prog = [];
  const added = await L.add('exp037', { onProgress: (i, n, nm) => prog.push(i + '/' + n) });
  ok('add() hands RemoteFiles to DW.ingest — the same door as a local file — and reports progress', ingested.length === 1 && ingested[0].length === 2 && ingested[0][0] instanceof L.RemoteFile && prog.join(',') === '1/2,2/2' && added.added === 2,
     JSON.stringify({ ingested: ingested.length, prog, added: added.added }));
  ok('add() returns an attribution line', /Wrexsoul/.test(added.attribution) && /CC BY-NC-SA 2\.5/.test(added.attribution), String(added.attribution));
  ok('the record in the corpus carries source (the ingest hook)', DW.corpus[0].source && DW.corpus[0].source.licence === s0.licence, 'ingest dropped source');

  /* ── DWSCORE, the real module, writes and restores the terms ─────────── */
  global.DWPHRASE = null;
  eval(read('assets/deckwave-score.js'));
  const S = window.DWSCORE;
  const mk = (name, src) => ({ name, bpm: 120, camelot: '8A', key: 'A', scale: 'minor', energy: 0.5, conf: 2, dur: 200, beats: Array.from({ length: 400 }, (_, i) => i * 0.5), source: src });
  const set = [mk('Local - One', undefined), mk('Wrexsoul - Indigo.ogg', s0)];
  const sc = S.score(set, {});
  ok('score: a local step has source null, a libre step carries licence · creator · page', sc.steps[0].source === null && sc.steps[1].source && sc.steps[1].source.licence === s0.licence
     && sc.steps[1].source.creator === 'Wrexsoul' && sc.steps[1].source.page === s0.page && sc.steps[1].source.noDerivatives === false,
     JSON.stringify(sc.steps.map(s => s.source)));
  ok('score summary counts libre steps and no-derivatives ones', sc.summary.libre === 1 && sc.summary.noDerivatives === 0, JSON.stringify(sc.summary));
  ok('score is still version 1 (additive field)', sc.version === 1, 'version ' + sc.version);
  const cue = S.cue(sc, 'T');
  ok('cue sheet carries REM ATTRIBUTION for the libre track only', (cue.match(/REM ATTRIBUTION/g) || []).length === 1 && /REM ATTRIBUTION "Wrexsoul \/ .*CC BY-NC-SA 2\.5 \/ https:\/\/archive\.org\/details\/exp037"/.test(cue),
     cue.split('\n').filter(l => /ATTRIBUTION/.test(l)).join(' | ') || 'none');
  const corpus2 = [mk('Local - One'), mk('Wrexsoul - Indigo.ogg')];
  const ld = S.load(JSON.stringify(sc), corpus2);
  ok('load() puts source back on a record that has none', ld.loaded === 2 && !corpus2[0].source && corpus2[1].source && corpus2[1].source.licence === s0.licence,
     JSON.stringify(corpus2.map(m => m.source && m.source.licence)));
  const corpus3 = [mk('Local - One'), mk('Wrexsoul - Indigo.ogg', { licence: 'own', creator: 'this session' })];
  S.load(JSON.stringify(sc), corpus3);
  ok('load() does not overwrite a record\'s own source', corpus3[1].source.licence === 'own', 'overwritten with ' + corpus3[1].source.licence);
  const old = JSON.parse(JSON.stringify(sc)); old.steps.forEach(s => { delete s.source; });
  ok('a score written before `source` existed loads unchanged', S.load(JSON.stringify(old), [mk('Local - One'), mk('Wrexsoul - Indigo.ogg')]).loaded === 2, 'old score refused');

  /* ── the demo: Stand Alone stands alone ─────────────────────────────── */
  const demoScore = { format: 'deckwave-set', version: 1, engine: { mode: 'phrase', phrase: true }, steps: [
    { i: 0, name: 'Wrexsoul - Indigo', rate: 1, straight: null,
      source: { kind: 'archive.org', item: 'exp037', file: 'wrexsoul_-_alchemy_sound_-_01_-_indigo.ogg' } },
    { i: 1, name: 'wrexsoul - alchemy sound - 02 - stormchaser', rate: 1.01, straight: null,
      source: { kind: 'archive.org', item: 'exp037', file: 'wrexsoul_-_alchemy_sound_-_02_-_stormchaser.mp3' } },
    { i: 2, name: 'Ghost Track', rate: 1, straight: null,
      source: { kind: 'archive.org', item: 'exp037', file: 'no_such_file.ogg' } } ] };
  DW.corpus.length = 0; ingested.length = 0;
  global.__probeHoldDuringIngest = true;
  const demoLogs = [];
  const dr = await L.demo({ score: demoScore, log: m => demoLogs.push(m) });
  ok('demo: the opening track is fetched ALONE and played as a one-track set, at index 0, in the score\'s phrase mode',
     ingested.length === 2 && ingested[0].length === 1 && transport.playCalls.length === 1
     && transport.playCalls[0].seq.length === 1 && transport.playCalls[0].from === 0
     && transport.playCalls[0].seq[0].name === 'Wrexsoul - Indigo' && transport.playCalls[0].phrase === true,
     JSON.stringify({ ingests: ingested.map(f => f.length), plays: transport.playCalls.length, phrase: transport.playCalls[0] && transport.playCalls[0].phrase }));
  ok('demo: while the rest is arriving, skip answers with the hold message, not a skip',
     /demo: the set is still arriving/.test(String(transport.skipDuringDemo)),
     'a listener tapping next mid-download would tear the opening track: got ' + transport.skipDuringDemo);
  ok('demo: the hold message SAYS where the fetch is and that pause works, and it reaches the log',
     /\(\d+\/\d+\)/.test(String(transport.skipDuringDemo)) && /pause still works/.test(String(transport.skipDuringDemo))
     && demoLogs.some(m => /still arriving \(\d+\/\d+\)/.test(m)),
     'a silently dead button and a broken one are indistinguishable from a phone (keeper: "unclear why or when") — got: '
     + transport.skipDuringDemo + ' · logged: ' + demoLogs.filter(m => /arriving/.test(m)).length);
  ok('demo: the full set is handed to reorder() in score order with the playing track at 0',
     transport.reorderCalls.length === 1 && transport.reorderCalls[0].length === 2
     && transport.reorderCalls[0][0] === transport.playCalls[0].seq[0]
     && dr.tracks === 2 && /reordered/.test(dr.note),
     JSON.stringify({ reorders: transport.reorderCalls.length, note: dr.note }));
  ok('demo: a file the Archive no longer serves is REPORTED missing, not silently dropped',
     dr.missing.length === 1 && dr.missing[0] === 'Ghost Track', JSON.stringify(dr.missing));
  ok('demo: the transport is restored afterwards',
     (await DW.skip()) === 'real skip' && (await DW.blendNow()) === 'real blendNow' && (await DW.play()) === 'playing',
     'a failed or finished demo left the deck mute to its buttons');
  let demoThrew = null;
  try { await L.demo({ score: { format: 'deckwave-set', steps: [{ name: 'local only' }] } }); } catch (e) { demoThrew = e; }
  ok('demo: a score with no libre sources refuses instead of guessing',
     demoThrew && /no libre sources/.test(demoThrew.message) && (await DW.skip()) === 'real skip',
     'refusal must also restore the transport: ' + (demoThrew && demoThrew.message));
  ok('[text] the dashboard has the ▶ demo button and it adopts the returned set',
     /btn\('▶ demo'/.test(read('assets/deckwave-dashboard.js')) && /dash\.set = r\.set;/.test(read('assets/deckwave-dashboard.js')),
     'the demo must land in the dashboard set or the list and deck part ways (ledger 40\'s class)');

  /* ── presence of the three one-line hooks (labelled: source-text checks) ── */
  const eng = read('assets/deckwave.js');
  ok('[text] ingest() copies file.source onto the record', /if \(files\[i\]\.source\) r\.source = files\[i\]\.source;/.test(eng), 'hook missing — a fetched track would lose its terms at ingest');
  ok('[text] the handover log line names the source terms', /nm\.source \? ' ☉ '/.test(eng), 'log hook missing');
  const npSrc = read('assets/deckwave-nowplaying.js');
  ok('[text] the now-playing card prints creator · licence and LINKS OUT to the serving page — through a SCHEME-GATED href, because esc() cannot make an href safe',
     /t\.source && safeHref\(t\.source\.page\)/.test(npSrc) && /target="_blank" rel="noopener"/.test(npSrc)
     && /esc\(safeHref\(t\.source\.page\)\)/.test(npSrc)
     && /p === 'http:' \|\| p === 'https:'/.test(npSrc),
     'card hook missing, or the linkout is absent, or the href takes the score\'s URL with escaping alone — entities decode before the URL runs, so an escaped javascript: link from a hostile score still executes on click (ultra review F1). This check used to PIN the vulnerable shape.');
  ok('[text] a source without a page still prints as text, not an empty link',
     /t\.source \? ' (·|\\u00b7) (☉|\\u2609) '/.test(npSrc),
     'the textContent fallback for a page-less source is gone');
  ok('[text] the HOST is credited — "from archive.org" on the card (both branches) and the handover log line',
     (npSrc.match(/t\.source\.kind \? ' (·|\\u00b7) from ' \+ t\.source\.kind/g) || []).length === 2
     && /nm\.source\.kind \? ' (·|\\u00b7) from ' \+ nm\.source\.kind/.test(eng),
     'the keeper asked for the hosting provider slug so the host gets credit; kind is the slug ("archive.org")');
  const panelSrc = read('assets/deckwave-libre.js');
  ok('[text] per-track grabbed/failed marks read the CORPUS by cache-key id, not the fetch loop',
     /m\.id === t\.name \+ '\|' \+ t\.size \+ '\|' \+ \(t\.lastModified \|\| 0\)/.test(panelSrc),
     'a mark inferred from the loop can lie; the corpus record either exists or it does not');
  ok('[text] failed tracks leave a retry on the button, and only a clean run clears the handler',
     /'↻ retry ' \+ bad \+ ' failed'/.test(panelSrc) && /if \(!bad\) b\.onclick = null;/.test(panelSrc),
     'with the Archive under load a dropped track needs a one-press retry (ingest dedupes by id, so the succeeded cost nothing)');
  ok('[text] ⊖ removes a fetched release from the corpus by its source stamp and re-normalises',
     /C\[i\]\.source && C\[i\]\.source\.item === it\.id\) \{ C\.splice\(i, 1\); n\+\+; \}/.test(panelSrc)
     && /if \(n && window\.DW\.normalise\) window\.DW\.normalise\(C\);/.test(panelSrc),
     'the Archive holds the same album under more than one item; without ⊖ a double-fetch (every Digital Memories song twice, keeper 2026-08-19) can only be undone by a reload — and energy is scaled to corpus min/max, so removal without normalise leaves stale figures');
  /* keeper, 2026-08-21: "interface elements that pop up should be
     collapsible by their window frame" — a frame tap folds the panel to
     title bar + status line, controls are excluded from the toggle, the
     fold hides the list, and ⊕ reopens unfolded */
  ok('[text] the panel folds by its frame: header tap toggles, controls excluded, ft stays for progress',
     /\.box\.min \.ls\{display:none\}/.test(panelSrc)
     && /e\.target\.closest\('select,input,button'\)\) return;/.test(panelSrc)
     && /setFold\(!box\.classList\.contains\('min'\)\);/.test(panelSrc)
     && !/\.box\.min \.ft\{display:none\}/.test(panelSrc),
     'the fold is missing, a header control would trigger it, or it hides the ft line a fetch reports on');
  ok('[text] ⊕ reopens the panel unfolded',
     /if \(show && unfold\) unfold\(\);/.test(panelSrc),
     'a fold left from last time would reopen as a mostly-empty bar and read as broken');
  const dashSrc = read('assets/deckwave-dashboard.js');
  ok('[text] the navpop folds by its h6 frame, and every open or close resets the fold',
     /closest\('h6'\)\) navpop\.classList\.toggle\('min'\)/.test(dashSrc)
     && /navpop\.classList\.remove\('on', 'min'\)/.test(dashSrc)
     && (dashSrc.match(/navpop\.classList\.remove\('min'\); navpop\.classList\.add\('on'\)/g) || []).length === 2,
     'the track popup cannot be folded by its title bar, or a fold leaks into the next open');
  ok('[text] phone layout: bottom sheet capped at 55vh, wrapping header, pinned ✕',
     /@media \(max-width:700px\)/.test(panelSrc) && /max-height:55vh/.test(panelSrc)
     && /flex-wrap:wrap/.test(panelSrc) && /#close\{position:absolute/.test(panelSrc),
     'the no-wrap header pushed ✕ off a phone screen and the panel covered the toolbar — keeper: "too big and also I can\'t get it to go away"');
  ok('[text] narrow screens close on an outside tap, and the opening ⊕ click cannot self-close',
     /matchMedia\('\(max-width:700px\)'\)\.matches/.test(panelSrc)
     && /e\.stopPropagation\(\);/.test(read('assets/deckwave-dashboard.js').split("btn('⊕ libre'")[1].slice(0, 300)),
     'without stopPropagation in the ⊕ handler the same click that opens the sheet bubbles to document and closes it');
  ok('[text] the release title folds its track list (collapse without re-searching)',
     /tEl\.classList\.add\('fold'\)/.test(panelSrc) && /list\.style\.display = list\.style\.display === 'none' \? '' : 'none'/.test(panelSrc),
     'the keeper asked for an easy way to collapse the expanded release back');
  ok('[text] index.html loads the module after deckwave.js and before the dashboard', (() => { const h = read('index.html');
     return h.indexOf('deckwave-libre.js') > h.indexOf('deckwave.js"') && h.indexOf('deckwave-libre.js') < h.indexOf('deckwave-dashboard.js'); })(), 'script order wrong or tag missing');
  /* index.html's inline boot gate decides whether the app runs at all, and no
     harness compiled it until 2026-08-30. Every other check in every harness
     is a pattern match, and a pattern match cannot see a broken parse — the
     strings stay exactly where they were. vm.Script parses without executing:
     built-in module, no dependency, no side effects. */
  ok('[text] every inline <script> in index.html PARSES — the boot gate decides whether anything runs', (() => {
       const blocks = (read('index.html').match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/g) || [])
         .map(b => b.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''));
       if (!blocks.length) return false;
       try { blocks.forEach((b, i) => new (require('vm').Script)(b, { filename: 'index.html#' + i })); return true; }
       catch (e) { return false; }
     })(), 'a SyntaxError in the boot gate kills the page while every text check still passes');
  ok('[text] the dashboard has the ⊕ libre button', /btn\('⊕ libre'/.test(read('assets/deckwave-dashboard.js')), 'button missing');
  ok('[text] the dashboard hands its shadow root to open() as the mount root',
     /DWLIBRE\.open\(\{ log, root: sr \}\)/.test(read('assets/deckwave-dashboard.js')),
     'the panel would mount on <body>, behind the fixed top-z-index app host — seen live 2026-08-19');

  /* the panel mounts into the root it is given, not <body> */
  const appended = [];
  /* ── Commons: the second source ────────────────────────────────────── */
  console.log('\n── commons ─────────────────────────────────────────────────');
  const cu = L.commonsSearchURL('chiptune', 40);
  ok('commons search asks the CORS door, audio files only, File namespace',
     /origin=%2A|origin=\*/.test(cu) && /filetype%3Aaudio|filetype:audio/.test(decodeURIComponent(cu)) && /srnamespace=6/.test(cu),
     'a query without origin=* is CORS-blocked, without filetype:audio it returns essays: ' + cu);
  const ci = L.commonsInfoURL(['File:A.ogg', 'File:B.wav']);
  ok('commons info asks for url, size, timestamp, mime and the licence fields',
     /iiprop=url%7Csize%7Ctimestamp%7Cmime%7Cextmetadata/.test(ci) && /origin=%2A|origin=\*/.test(ci), ci);
  const cr = await L.searchCommons('chiptune', 40);
  ok('a hit becomes one track with the licence and page attached', cr.found === 231 && cr.items.length === 2,
     'found ' + cr.found + ', items ' + cr.items.length + ' — the hit with no imageinfo must fall out, not throw');
  const wav = cr.items.find(i => /Lo-Res/.test(i.id));
  ok('the licence short name is Commons\' own and the URL rides along',
     wav && wav.licenceName === 'CC0' && /publicdomain\/zero/.test(wav.licence), JSON.stringify(wav && { n: wav.licenceName, u: wav.licence }));
  ok('an Artist field full of HTML is stripped to text', wav && wav.creator === 'Somebody',
     JSON.stringify(wav && wav.creator) + ' — tags from a wiki field must never reach innerHTML');
  ok('the RemoteFile keeps the real extension and the cache-key parts are stable',
     wav && wav.file.name === 'Lo-Res Legend.wav' && wav.file.size === 7257644 && wav.file.lastModified === Date.parse('2024-05-01T00:00:00Z'),
     JSON.stringify(wav && { n: wav.file.name, s: wav.file.size, m: wav.file.lastModified }));
  ok('the source stamp matches the ⊖ removal contract (source.item === row id)',
     wav && wav.file.source.item === wav.id && wav.file.source.kind === 'commons.wikimedia.org',
     JSON.stringify(wav && wav.file.source.item));
  ok('CC0 is not flagged no-derivatives', wav && wav.file.source.noDerivatives === false, 'CC0 flagged -nd');
  ok('search relevance order is kept (opus hit first)', /Slay The Evil/.test(cr.items[0].id),
     cr.items.map(i => i.id).join(' | '));
  const cAttr = L.attribution(cr.items[0].file.source);
  ok('a Commons track has an attribution line with creator, licence and page',
     /GameDev Composer/.test(cAttr) && /CC0/.test(cAttr) && /commons\.wikimedia\.org/.test(cAttr), cAttr);
  ok('[text] the panel carries the source select and the commons branch',
     /id="src"/.test(read('assets/deckwave-libre.js')) && /doSearchCommons/.test(read('assets/deckwave-libre.js')),
     'no way to reach Commons from the panel');

  const fakeRoot = { appendChild(el) { appended.push(el); }, getElementById() { return null; } };
  global.document = { createElement(tag) { const el = { tag, style: {}, classList: fakeClassList(), children: [], appendChild(c) { this.children.push(c); },
      querySelector() { return { style: {}, addEventListener() {} }; }, attachShadow() {
      const shadow = { appendChild(c) { shadow.kids = (shadow.kids || []).concat(c); }, getElementById(id) { return { value: 'chiptune', style: {}, focus() {}, onchange: null, onclick: null, onkeydown: null, textContent: '', innerHTML: '', childElementCount: 0 }; } };
      return shadow; }, addEventListener() {}, set innerHTML(v) { this._html = v; }, get innerHTML() { return this._html; } }; return el; },
    body: { appendChild() { appended.push('BODY'); } }, getElementById() { return null; },
    addEventListener() {} };
  const shown = L.open({ root: fakeRoot, log() {} });
  ok('open({root}) mounts the panel INTO that root, not <body>', shown === true && appended.length === 1 && appended[0] !== 'BODY' && appended[0].tag === 'div',
     JSON.stringify(appended.map(a => a === 'BODY' ? 'BODY' : a.tag)));
  ok('open() again toggles it hidden, a third shows it', L.open({ root: fakeRoot }) === false && L.open({ root: fakeRoot }) === true, 'toggle broken');
  const libreSrcText = read('assets/deckwave-libre.js');
  ok('[text] the panel has a one-click ♪ lukhash button wired to the preset and doSearch',
     /id="lh"/.test(libreSrcText) && /\$\('lh'\)\.onclick = \(\) => \{ current\.source = 'archive'; \$\('src'\)\.value = 'archive';\n\s*current\.preset = 'lukhash'; \$\('preset'\)\.value = 'lukhash'; \$\('q'\)\.value = ''; doSearch\(\); \};/.test(libreSrcText),
     'the button is missing, does not select the lukhash preset, or does not force the archive source (the preset means nothing on Commons)');

  finished = true;
  console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') + ' of ' + checks + ' checks');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(2); });
