/* MEASUREMENT, not a harness. Summarise a quiet-scan --corpus JSON at several
   cuts. No cut is chosen here (ledger 143a).
     node tools/quiet-summary.js evidence/quiet-profiles-2026-10-06.json
   intro  = contiguous seconds from the start below the cut
   tail   = contiguous seconds from the end below the cut
   alone  = tail - 16 (xfade): quiet audio heard before the next track arrives
   mid    = longest run below the cut touching neither end */
const fs = require('fs');
const P = JSON.parse(fs.readFileSync(process.argv[2], 'utf8')).filter(r => !r.error);
const XF = 16, CUTS = [-10, -15, -20, -25];
function runs(v, cut, w) {
  const q = v.map(x => x < cut);
  let intro = 0; while (intro < q.length && q[intro]) intro++;
  let tail = 0; while (tail < q.length && q[q.length - 1 - tail]) tail++;
  let mid = 0, cur = 0;
  for (let i = intro; i < q.length - tail; i++) { cur = q[i] ? cur + 1 : 0; mid = Math.max(mid, cur); }
  return { intro: intro * w, tail: tail * w, mid: mid * w, alone: Math.max(0, tail * w - XF) };
}
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
for (const band of ['full', 'low']) {
  console.log('\n===== ' + band + '-band, ' + P.length + ' tracks =====');
  console.log(' cut   | intro>=16s  intro>=30s | alone>=15s alone>=30s alone>=60s | mid>=16s | median tail  p90 tail  max tail');
  for (const c of CUTS) {
    const R = P.map(r => runs(r[band], c, r.win));
    const n = f => R.filter(f).length;
    console.log(String(c).padStart(4) + ' dB | ' + String(n(r => r.intro >= 16)).padStart(9) + String(n(r => r.intro >= 30)).padStart(11) + ' | ' +
      String(n(r => r.alone >= 15)).padStart(9) + String(n(r => r.alone >= 30)).padStart(11) + String(n(r => r.alone >= 60)).padStart(11) + ' | ' +
      String(n(r => r.mid >= 16)).padStart(7) + '  | ' + String(pct(R.map(r => r.tail), .5)).padStart(10) + String(pct(R.map(r => r.tail), .9)).padStart(10) + String(Math.max(...R.map(r => r.tail))).padStart(10));
  }
}
const CTRL = /GONE TOO SOON|WINTER ERROR|REQUIEM FOR A FRIEND|Lullaby|WALKMAN -Single/i;
console.log('\n===== controls (full -20 dB / low -20 dB) =====');
for (const r of P.filter(r => CTRL.test(r.name))) {
  const f = runs(r.full, -20, r.win), l = runs(r.low, -20, r.win);
  console.log(r.name.slice(-38).padEnd(38) + ' dur ' + r.dur.toFixed(0).padStart(4) + ' | full intro ' + f.intro + ' tail ' + f.tail + ' alone ' + f.alone + ' mid ' + f.mid + ' | low intro ' + l.intro + ' tail ' + l.tail + ' alone ' + l.alone);
}
for (const [band, cut] of [['full', -20], ['low', -20]]) {
  console.log('\n===== top 20 by quiet heard alone at the end, ' + band + ' ' + cut + ' dB =====');
  P.map(r => ({ r, x: runs(r[band], cut, r.win) })).sort((a, b) => b.x.alone - a.x.alone).slice(0, 20)
    .forEach(({ r, x }) => console.log(String(x.alone).padStart(5) + ' s alone · tail ' + String(x.tail).padStart(3) + ' · intro ' + String(x.intro).padStart(3) + ' · mid ' + String(x.mid).padStart(3) + ' · ' + r.name.slice(-48)));
}
console.log('\n===== top 15 by quiet intro, full -20 dB =====');
P.map(r => ({ r, x: runs(r.full, -20, r.win) })).sort((a, b) => b.x.intro - a.x.intro).slice(0, 15)
  .forEach(({ r, x }) => console.log(String(x.intro).padStart(5) + ' s intro · ' + r.name.slice(-52)));
console.log('\n===== top 10 by mid-track quiet, full -20 dB =====');
P.map(r => ({ r, x: runs(r.full, -20, r.win) })).sort((a, b) => b.x.mid - a.x.mid).slice(0, 10)
  .forEach(({ r, x }) => console.log(String(x.mid).padStart(5) + ' s mid · ' + r.name.slice(-52)));
