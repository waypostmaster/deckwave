/* Run the phrase detector over the real library and print what it does —
   BEFORE any number built on it is chosen.

   There is no ground truth for where the phrases of these tracks begin;
   that is the keeper's ear. What CAN be measured offline is whether the
   detector is reading structure or noise, and this prints the figures that
   say so:

     shuffle null           for each track, the detector's contrast on the
                            real bar order against 19 random re-orderings of
                            the same bars. A track that beats all 19 is in
                            the top 5% of what its own bars could show by
                            chance. If the detector read noise, ~5% of tracks
                            would beat all 19. This is the falsifier for the
                            whole idea.
     contrast distribution  worst-offset variance over best, per track. How
                            many tracks sit near 1 (no preference) is the
                            number to look at before anyone proposes a cut.
     half-split agreement   first half vs second half of each track. Weak
                            here — a half with one section change resolves
                            nothing — so it is printed, not leaned on.
     offset histogram       if most tracks say 0, intros are phrase-aligned
                            to the first detected beat; spread means not.
     grid regularity        how many grids have runs of beats at a different
                            spacing from the rest (Essentia following a
                            half-time or dotted feel for a section). The
                            engine's bar count drifts inside those runs, and
                            that is the engine's problem, not this module's —
                            reported so it is not forgotten.
     downbeat probe         bar-to-bar change at beat resolution, mod 4.
                            Offset 0 is the engine's standing assumption
                            (4/4 from beats[0]). REPORTED, NOT ACTED ON.

   Needs the library on disk (DECKWAVE_LIB, default C:/Claude/Music/LukHash)
   and the v2 grid export in evidence/ (beats as the analyser stored them;
   the detector in the page runs on those same grids). Decodes every FLAC
   through the vendored libflac under Node, so it takes minutes; the full
   per-track table is written to evidence/phrase-scan-<date>.json.

       node tools/phrase-scan.js            # all tracks
       node tools/phrase-scan.js 20         # first 20, for a quick look
*/
const fs = require('fs'), path = require('path');
const LIB = process.env.DECKWAVE_LIB || 'C:/Claude/Music/LukHash';
const LIMIT = +process.argv[2] || Infinity;
const DATE = process.env.DECKWAVE_DATE || new Date().toISOString().slice(0, 10);

global.window = global;
global.document = { createElement() { return { style: {} }; }, head: { appendChild() {} } };
process.chdir(path.resolve(__dirname, '..'));
const repo = process.cwd();
process.chdir(path.join(repo, 'vendor'));
global.Flac = require(path.join(repo, 'vendor', 'libflac.min.js'));
process.chdir(repo);
eval(fs.readFileSync('assets/deckwave-flac.js', 'utf8').replace(/\r\n/g, '\n'));
const F = global.DWFLAC;
const PH = require('../assets/deckwave-phrase.js');

const grids = JSON.parse(fs.readFileSync('evidence/deckwave-cache-v2-grids-2026-08-19.json', 'utf8'));
const q = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a.length ? a[Math.min(a.length - 1, Math.floor(p * a.length))] : null; };

/* grid regularity: intervals more than 15% off the median, and whether they
   come in runs (a section at another metrical level) or singly */
function regularity(beats) {
  const iv = []; for (let i = 1; i < beats.length; i++) iv.push(beats[i] - beats[i - 1]);
  const s = iv.slice().sort((a, b) => a - b), med = s[s.length >> 1] || 0;
  let odd = 0, runs = 0, inRun = false;
  for (const x of iv) { const o = med > 0 && Math.abs(x - med) / med > 0.15; if (o) { odd++; if (!inRun) runs++; } inRun = o; }
  return { odd, runs, medSpacing: +med.toFixed(4) };
}

/* the library is no longer flat (2026-08-21: clearance subdirectories) —
   the sibling harnesses grew this walker in the same commit and this tool
   was missed (ultra review P1): a re-run against the moved library printed
   `missing` per record and still WROTE an evidence JSON whose summary was
   computed over zero tracks. Same shape as check-flac's findFlac. */
function findFlac(stem) {
  const want = stem + '.flac';
  const seen = [LIB];
  for (let i = 0; i < seen.length; i++) {
    let names;
    try { names = fs.readdirSync(seen[i], { withFileTypes: true }); } catch (e) { continue; }
    for (const d of names) {
      const p = path.join(seen[i], d.name);
      if (d.isDirectory()) seen.push(p);
      else if (d.name === want) return p;
    }
  }
  return null;
}

(async () => {
  await F.boot();
  const rows = [];
  let n = 0, t0all = Date.now();
  for (const rec of grids) {
    if (n >= LIMIT) break;
    const file = findFlac(rec.name);
    if (!file) { console.log('  missing  ' + rec.name); continue; }
    n++;
    const ab = fs.readFileSync(file);
    const u8 = new Uint8Array(ab.buffer, ab.byteOffset, ab.byteLength);
    let pcm;
    try { pcm = await F.decode(u8); } catch (e) { console.log('  undecodable  ' + rec.name + ' — ' + e.message); continue; }
    const t0 = Date.now();
    const feat = PH.beatFeatures(pcm.channels, pcm.sampleRate, rec.beats);
    const msFeat = Date.now() - t0;
    const t1 = Date.now();
    const whole = PH.detectFromFeatures(feat, rec.beats, { probe: true });
    const msDetect = Date.now() - t1;
    const nb = whole.nBars, half = Math.floor(nb / 2);
    const h1 = PH.detectFromFeatures(feat, rec.beats, { bars: [0, half], shuffles: false });
    const h2 = PH.detectFromFeatures(feat, rec.beats, { bars: [half, nb], shuffles: false });
    const reg = regularity(rec.beats);
    const row = { name: rec.name, bpm: rec.bpm, dur: rec.dur, nBars: nb, msFeat, msDetect,
                  at: whole.at, contrast: whole.contrast, shuffles: whole.shuffles,
                  half1: h1.at, half2: h2.at, halvesAgree: h1.ok && h2.ok && h1.at === h2.at,
                  downbeat: whole.probe.downbeat, variance: whole.probe.variance,
                  oddIntervals: reg.odd, oddRuns: reg.runs, medSpacing: reg.medSpacing };
    rows.push(row);
    console.log('  ' + String(n).padStart(3) + '  at ' + row.at + '  contrast ' + row.contrast.toFixed(2).padStart(5) +
                '  shuf ' + String(row.shuffles).padStart(2) + '/19' +
                '  halves ' + row.half1 + '/' + row.half2 + (row.halvesAgree ? ' =' : '  ') +
                '  db ' + row.downbeat + '  odd ' + String(reg.odd).padStart(3) + '/' + reg.runs +
                '  ' + msFeat + '+' + msDetect + 'ms  ' + rec.name.slice(-40));
  }
  const N = rows.length;
  const pct = k => +(100 * k / N).toFixed(1);
  const contrasts = rows.map(r => r.contrast);
  const summary = {
    tracks: N, date: DATE, detectorV: PH.V, bars: PH.BARS, dims: PH.DIMS,
    beatAll19Shuffles: rows.filter(r => r.shuffles === 19).length,
    beatAll19ShufflesPct: pct(rows.filter(r => r.shuffles === 19).length), chancePct: 5,
    beat17plus: rows.filter(r => r.shuffles >= 17).length,
    shufflesHistogram: Array.from({ length: 20 }, (_, k) => rows.filter(r => r.shuffles === k).length),
    contrast: { min: q(contrasts, 0), p25: q(contrasts, .25), median: q(contrasts, .5), p75: q(contrasts, .75), max: Math.max(...contrasts),
                under1_1: rows.filter(r => r.contrast < 1.1).length, under1_25: rows.filter(r => r.contrast < 1.25).length,
                over1_5: rows.filter(r => r.contrast >= 1.5).length, over2: rows.filter(r => r.contrast >= 2).length },
    contrastMedianWhenBeat19: q(rows.filter(r => r.shuffles === 19).map(r => r.contrast), .5),
    contrastMedianOtherwise: q(rows.filter(r => r.shuffles < 19).map(r => r.contrast), .5),
    halvesAgree: rows.filter(r => r.halvesAgree).length, halvesAgreePct: pct(rows.filter(r => r.halvesAgree).length), halvesChancePct: 12.5,
    halvesAgreeOrOffBy4Pct: pct(rows.filter(r => r.halvesAgree || Math.abs(r.half1 - r.half2) === 4).length),
    offsetHistogram: [0, 1, 2, 3, 4, 5, 6, 7].map(k => rows.filter(r => r.at === k).length),
    offsetHistogramWhenBeat19: [0, 1, 2, 3, 4, 5, 6, 7].map(k => rows.filter(r => r.at === k && r.shuffles === 19).length),
    gridsWithOddIntervals: rows.filter(r => r.oddIntervals > 0).length,
    gridsWithOddRuns3plus: rows.filter(r => r.oddRuns >= 3).length,
    gridsWith20plusOdd: rows.filter(r => r.oddIntervals >= 20).length,
    downbeatProbeHistogram: [0, 1, 2, 3].map(k => rows.filter(r => r.downbeat === k).length),
    downbeatProbeAtZeroPct: pct(rows.filter(r => r.downbeat === 0).length), downbeatChancePct: 25,
    msFeatMedian: q(rows.map(r => r.msFeat), .5), msFeatMax: Math.max(...rows.map(r => r.msFeat)),
    msDetectMedian: q(rows.map(r => r.msDetect), .5), msDetectMax: Math.max(...rows.map(r => r.msDetect)),
    totalSec: Math.round((Date.now() - t0all) / 1000),
    note: 'contrast is a ratio of this detector\'s own sums, comparable to nothing else; shuffles is out of 19. ' +
          'The downbeat probe is reported, not applied: the engine still takes every 4th beat from beats[0]. ' +
          'Timings are Node on this machine, not a phone.'
  };
  console.log('\n' + JSON.stringify(summary, null, 2));
  const out = 'evidence/phrase-scan-' + DATE + '.json';
  fs.writeFileSync(out, JSON.stringify({ summary, rows }, null, 1));
  console.log('\nwritten ' + out);
})().catch(e => { console.log('FATAL: ' + (e.stack || e)); process.exit(1); });
