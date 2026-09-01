/* One-off measurement: how much does the tune actually change, on the
   real records? Verifies the 18.8% figure asserted in README, CLAUDE.md,
   LISTENING §23 and ledger 101. */
const fs = require('fs');
const src = fs.readFileSync('assets/deckwave.js', 'utf8').replace(/\r\n/g, '\n');
const tbl = name => {
  const m = src.match(new RegExp('const ' + name + ' = \\{[\\s\\S]*?\\};'));
  if (!m) throw new Error('no table ' + name);
  return eval('(' + m[0].replace(/^const [A-Z_]+ = /, '').replace(/;$/, '') + ')');
};
const MAJ = tbl('CAMELOT_MAJOR'), DKW = tbl('CAMELOT_MINOR_DECKWAVE'), STD = tbl('CAMELOT_MINOR_STANDARD');
eval(src.match(/function camScore\([\s\S]*?\n\}\n/)[0]);
const cam = (k, s, MIN) => {
  const n = /min/i.test(s) ? MIN[k] : MAJ[k];
  return n ? n + (/min/i.test(s) ? 'A' : 'B') : '?';
};
const recs = JSON.parse(fs.readFileSync('evidence/deckwave-cache-v1-2026-08-17.json', 'utf8')).data;
const a = recs.map(r => ({ d: cam(r.key, r.scale, DKW), s: cam(r.key, r.scale, STD),
                           min: /min/i.test(r.scale || '') }));
const changed = a.filter(r => r.d !== r.s).length;
let diff = 0, tot = 0, crossTot = 0, crossDiff = 0;
for (const x of a) for (const y of a) {
  tot++;
  const cross = x.min !== y.min;
  if (cross) crossTot++;
  if (camScore(x.d, y.d) !== camScore(x.s, y.s)) { diff++; if (cross) crossDiff++; }
}
console.log('records                       ', recs.length);
console.log('minor / major                 ', a.filter(r => r.min).length + ' / ' + a.filter(r => !r.min).length);
console.log('camelot LABELS that change    ', changed, '(' + (100 * changed / recs.length).toFixed(1) + '%)');
console.log('ordered pairs, camScore differs', diff, 'of', tot, '=', (100 * diff / tot).toFixed(1) + '%');
console.log('cross-mode pairs               ', crossTot, '=', (100 * crossTot / tot).toFixed(1) + '%');
console.log('same-mode pairs that differ    ', diff - crossDiff, '(must be 0)');
