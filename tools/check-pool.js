/* Does the sequencer still discard anything?

   The keeper's instruction was "Ideally you wouldn't discard any of the songs
   that people have put in. maybe we find a way to gracefully still reach
   them." This checks that, and checks that the price of keeping them was not
   paid by the tracks that were already fine.

   Every check states what would falsify it. A check whose pass condition does
   not exclude the failure mode it is pointed at is decoration — this project
   has a table of seven that were.

   CAVEAT, STATED UP FRONT: the only full beat arrays in the repo are the v1
   cache, which holds 120-second-excerpt grids. So the grid errors computed
   here are NOT the v2 figures quoted in ROADMAP; they come from a shorter
   span and will differ. What is under test is the LOGIC — classify, place,
   never stretch an unlocked track, never let one steer the tempo — not which
   particular track lands on which side. The live app computes from v2 grids.

       node tools/check-pool.js
*/
const fs = require('fs');

let fails = 0, checks = 0;
const ok = (name, cond, falsifier) => {
  checks++;
  if (!cond) { fails++; console.log('  FAIL  ' + name + '\n        ' + falsifier); }
  else console.log('  pass  ' + name);
};

/* CRLF-proof. core.autocrlf=true checks the source out with CRLF on
   Windows, and every regex below is written against LF; on a fresh clone
   all three harnesses died with FATAL before testing anything. */
/* DECKWAVE_SRC / DECKWAVE_SCORE_SRC: point this harness at another copy of
   the engine or the score writer. Every new check here is run against the
   PREVIOUS source through these seams and has to fail there first — a check
   that cannot fail is decoration (ledgers 98, 110, 111). */
const src = fs.readFileSync(process.env.DECKWAVE_SRC || 'assets/deckwave.js', 'utf8').replace(/\r\n/g, '\n');
const grab = (re, what) => {
  const m = src.match(re);
  if (!m) { console.log('FATAL: could not extract ' + what); process.exit(1); }
  return m[0];
};

global.window = global;
/* ONE eval, not six: `const LOCK` inside its own eval() call is scoped to
   that call and invisible to a function eval'd afterwards, which is exactly
   how the first version of this file died with "LOCK is not defined". */
eval([
/* arc() is exactly two lines and does not end on a line that is just "};",
   so a lazy [\s\S]*? match for that terminator runs straight past it and
   swallows LOCK and gridError as well -- which then get declared a second
   time by their own grab() and throw "Identifier 'LOCK' has already been
   declared". Match the two lines. */
  grab(/const arc = \(i, n\) =>[^\n]*\n[^\n]*\n/, 'arc'),
  grab(/const LOCK = \{[^}]*\};\n/, 'LOCK'),
  grab(/function dedupe\(corpus, opts\) \{[\s\S]*?\n\}\n/, 'dedupe'),
  grab(/function gridError\(t\) \{[\s\S]*?\n\}\n/, 'gridError'),
  grab(/function camScore\([\s\S]*?\n\}\n/, 'camScore'),
  /* classifyPool arrived with ledger 137 (2026-09-30); older sources inline it
     in sequence(), so its absence is not fatal — the 137 block below says so. */
  (src.match(/function classifyPool\([\s\S]*?\n\}\n/) || [''])[0],
  grab(/function sequence\(corpus, opts\) \{[\s\S]*?\n\}\n/, 'sequence')
/* `const` declared inside eval() stays in the eval's own lexical scope, so the
   functions above can see LOCK and this file cannot. Hand it out deliberately
   rather than re-typing the numbers here -- a copy would let the test and the
   code disagree about the very threshold under test. */
].join('\n') + '\nglobalThis.__LOCK = LOCK; globalThis.__arc = arc;');
const LOCK = globalThis.__LOCK;
/* the energy arc, handed out for the same reason LOCK is: the opener check
   below needs arc(0, n) and re-typing `.22` here would let the test and the
   code disagree about the very curve under test */
const arc = globalThis.__arc;

const normf = s => s.toLowerCase().replace(/\.(flac|mp3|wav|aiff|m4a|ogg)$/, '')
                    .replace(/[^a-z0-9]/g, '');
const LIB = process.env.DECKWAVE_LIB || 'C:/Claude/Music/LukHash';
/* recursive since 2026-08-21: the library gained clearance subdirectories */
const listAudio = dir => {
  const out = [], stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true }))
      if (e.isDirectory()) stack.push(require('path').join(d, e.name));
      else if (/\.(flac|mp3|wav)$/i.test(e.name)) out.push(e.name);
  }
  return out;
};
let files = null;
try {
  files = new Set(listAudio(LIB).map(normf));
} catch (e) {
  console.log('  NOTE: ' + LIB + ' unreadable — using every cached record.');
}
/* A missing library used to degrade to every cached record — the 28
   non-chiptune imports included — with a NOTE and a green run: a corpus
   the header says is not under test, passing (review 2026-09-01 M11).
   check-flac already refuses to pass when it decoded nothing; same shape
   here. The checks below still run on the fallback so the output is
   informative, but the run is red. Set DECKWAVE_LIB. */
ok('the corpus is the chiptune library, not every cached record', files !== null,
   LIB + ' unreadable — every check below runs on a corpus the header says is not under test; set DECKWAVE_LIB');
const corpus = JSON.parse(fs.readFileSync('evidence/deckwave-cache-v1-2026-08-17.json', 'utf8')).data
  .filter(r => !files || files.has(normf(r.name)))
  .map(r => ({ id: r.id, name: r.name, bpm: r.bpm, conf: r.conf, dur: r.dur,
               camelot: r.camelot, energy: r.energy != null ? r.energy : 0.5,
               beats: Array.isArray(r.beats) ? r.beats : [] }));

console.log('\n── corpus ──────────────────────────────────────────────────');
console.log('  ' + corpus.length + ' tracks, grids from the v1 cache (120s excerpts)');

/* ── 1. classification ────────────────────────────────────────────────── */
console.log('\n── classification ──────────────────────────────────────────');
const sane = dedupe(corpus, {}).filter(t => t.bpm > 60 && t.dur > 75);
const withErr = sane.map(t => ({ t, e: gridError(t) }));
const lockedN = withErr.filter(x => x.e != null && x.e <= LOCK.maxGridErrPct).length;
console.log('  cut at ' + LOCK.maxGridErrPct + '%  ->  ' + lockedN + ' locked, ' +
            (sane.length - lockedN) + ' unlocked');

/* gridError must be beatmatch error, so it must be computable independently
   from the same beats. Falsifier: any disagreement with a second calculation. */
let worst = 0;
withErr.forEach(({ t, e }) => {
  if (e == null) return;
  const b = t.beats, mine = Math.abs(60 * (b.length - 1) / (b[b.length - 1] - b[0]) - t.bpm) / t.bpm * 100;
  worst = Math.max(worst, Math.abs(mine - e));
});
ok('gridError() reproduces from the beats alone', worst < 1e-9,
   'recomputation differed by ' + worst + ' — the function is doing something else');

/* Confidence and grid error must be measuring DIFFERENT things, or replacing
   one with the other changes nothing and this whole exercise is theatre.
   Falsifier: the two orderings agree. */
const bothWays = withErr.filter(x => x.e != null);
const byConf = bothWays.slice().sort((a, b) => a.t.conf - b.t.conf).map(x => x.t.name);
const byErr = bothWays.slice().sort((a, b) => b.e - a.e).map(x => x.t.name);
const top10 = new Set(byErr.slice(0, 10));
const overlap = byConf.slice(0, 10).filter(n => top10.has(n)).length;
ok('the old gate and the new one disagree about who is worst (' + overlap + '/10 overlap)',
   overlap < 7, 'the two rankings largely agree, so swapping them buys nothing');

/* ── 1b. dedupe: the name nominates, the audio decides ─────────────────── */
console.log('\n── dedupe ──────────────────────────────────────────────────');
const everything = dedupe(corpus, { dedupe: false });
const merged = dedupe(corpus, {});
console.log('  ' + corpus.length + ' records -> ' + merged.length +
            ' after merge   (keep-all mode returns ' + everything.length + ')');

ok('dedupe:false keeps every record', everything.length === corpus.length,
   'keep-all returned ' + everything.length + ' of ' + corpus.length);

/* Two survivors must never be the same recording, or the set can play one
   track twice. Falsifier: any surviving pair matching on duration AND tempo.
   Those two fields are stable; `conf` is NOT — two encodes of one master
   differ by about 0.001 there, and building the signature from it made an
   earlier version of this check reject five correct merges. */
const sameRec = (a, b) => Math.abs(a.dur - b.dur) < 0.15 && Math.abs(a.bpm - b.bpm) < 0.05;
let survivingDupes = 0, dupeEg = '';
for (let i = 0; i < merged.length; i++)
  for (let k = i + 1; k < merged.length; k++)
    if (sameRec(merged[i], merged[k])) {
      survivingDupes++;
      if (!dupeEg) dupeEg = merged[i].name.slice(-32) + ' / ' + merged[k].name.slice(-32);
    }
ok('no two survivors are the same recording', survivingDupes === 0,
   survivingDupes + ' duplicate pairs survived, e.g. ' + dupeEg);

/* The opposite failure, and the worse one: a track thrown away that had no
   audio-matching twin. That is a real song silently lost to a name collision,
   which is what the keeper warned about -- "there may be some tracks with
   same-ish names but differing somehow". Falsifier: any dropped record with no
   survivor within 1% on duration. */
const keptNames = new Set(merged.map(t => t.name));
const dropped = corpus.filter(t => !keptNames.has(t.name));
const orphaned = dropped.filter(d => !merged.some(m =>
  Math.abs(m.dur - d.dur) / Math.max(m.dur, d.dur) <= 0.01 &&
  Math.abs(m.bpm - d.bpm) / Math.max(m.bpm, d.bpm) <= 0.01));
ok('nothing was dropped without an audio-matching twin', orphaned.length === 0,
   orphaned.length + ' dropped with no twin, e.g. ' + (orphaned[0] && orphaned[0].name));
console.log('  ' + dropped.length + ' merged away, all with a matching twin');

/* ── 2. nothing is discarded ──────────────────────────────────────────── */
console.log('\n── nothing discarded ───────────────────────────────────────');

/* ORDER MATTERS HERE, and getting it wrong is how this file first reported a
   phantom failure. sequence() stamps _stretch / _tempoAt / _locked / _unlocked
   ON THE SHARED CORPUS OBJECTS, so a second call restamps the first call's
   results and any assertion made afterwards is reading the wrong build. Run
   the comparison build FIRST, keep only its length, then build the real one.
   (The same hazard is live in the app: build twice and the first set's tracks
   are restamped. commit() already has to `delete out[i]._dwell` for exactly
   this reason.) */
const oldCount = sequence(corpus, { length: 500, minConf: 0.8, maxGridErr: 1e9 }).length;

const set = sequence(corpus, { length: 500 });
const inSet = new Set(set.map(t => t.id));
const missing = sane.filter(t => !inSet.has(t.id));
console.log('  pool ' + sane.length + '  ->  set ' + set.length +
            '   (' + set.filter(t => t._unlocked).length + ' played straight: ' +
            set.filter(t => t._unlockReason === 'grid').length + ' grid, ' +
            set.filter(t => t._unlockReason === 'reach').length + ' reach)');
ok('every track that survives the sanity filter is placed', missing.length === 0,
   missing.length + ' never placed: ' + missing.slice(0, 6).map(t => t.name.slice(-30)).join(', '));

/* Falsifier: if the old settings also placed everything, nothing was ever
   being discarded and this whole change is solving an imagined problem. */
console.log('  old gate (conf>0.8, everything locked): ' + oldCount + ' placed');
ok('the old configuration really did drop tracks', oldCount < sane.length,
   'the old settings placed ' + oldCount + ' of ' + sane.length + ' — nothing was lost, so there was nothing to fix');

/* ── 3. the price ─────────────────────────────────────────────────────── */
console.log('\n── what the locked tracks still guarantee ──────────────────');
const lockedRows = set.filter(t => !t._unlocked);
const overGate = lockedRows.filter(t => Math.abs(t._stretch - 1) > 0.08 + 1e-9);
ok('every LOCKED track is still inside the 8% stretch gate', overGate.length === 0,
   overGate.length + ' locked tracks over the gate, worst ' +
   Math.max(0, ...overGate.map(t => +((Math.abs(t._stretch - 1)) * 100).toFixed(1))) + '%');

const badStretch = set.filter(t => t._unlocked && t._stretch !== 1);
ok('no UNLOCKED track is stretched', badStretch.length === 0,
   badStretch.length + ' unlocked tracks carry a stretch other than 1');

/* A GRID-unlocked track must not steer the rolling target — its BPM is the
   number we distrusted. Falsifier: the track after it sees a different tempo. */
let steered = 0, steerEg = '';
for (let i = 0; i < set.length - 1; i++) {
  if (set[i]._unlockReason !== 'grid') continue;
  if (set[i + 1]._tempoAt !== set[i]._tempoAt) {
    steered++;
    if (!steerEg) steerEg = set[i].name.slice(-28) + ': ' + set[i]._tempoAt + ' -> ' + set[i + 1]._tempoAt;
  }
}
ok('a GRID-unlocked track does not move the tempo target', steered === 0,
   steered + ' moved it, e.g. ' + steerEg);

/* A REACH-unlocked track MUST steer, or the walk faces the same dead end on
   the next iteration and the tail degenerates into an unmixed playlist.
   Falsifier: the track after it still sees the old tempo. */
let stuck = 0, stuckEg = '';
for (let i = 0; i < set.length - 1; i++) {
  if (set[i]._unlockReason !== 'reach') continue;
  if (set[i + 1]._tempoAt !== Math.round(set[i].bpm)) {
    stuck++;
    if (!stuckEg) stuckEg = set[i].name.slice(-28) + ': expected ' +
      Math.round(set[i].bpm) + ', next saw ' + set[i + 1]._tempoAt;
  }
}
ok('a REACH-unlocked track repositions the set to its own tempo', stuck === 0,
   stuck + ' did not, e.g. ' + stuckEg);

let runs = 0;
for (let i = 1; i < set.length; i++) if (set[i]._unlocked && set[i - 1]._unlocked) runs++;
console.log('  back-to-back unlocked pairs: ' + runs +
            (runs ? '  (allowed only when nothing else qualified)' : ''));

console.log('\n── played straight, and why ────────────────────────────────');
set.filter(t => t._unlockReason === 'grid')
   .sort((a, b) => (b._gridErr || 0) - (a._gridErr || 0))
   .forEach(t => console.log('   grid   ' + String(t._gridErr).padStart(6) + '%  conf ' +
       t.conf.toFixed(2) + '  ' + t.name.replace('.flac', '').slice(-42)));
const reach = set.filter(t => t._unlockReason === 'reach');
console.log('   reach  ' + reach.length + ' tracks the stretch gate could not get to');
reach.slice(0, 8).forEach(t => console.log('          from ' + String(t._tempoAt).padStart(3) +
    ' to ' + String(Math.round(t.bpm)).padStart(3) + ' bpm   ' +
    t.name.replace('.flac', '').slice(-40)));
if (reach.length > 8) console.log('          ... and ' + (reach.length - 8) + ' more');

/* ── the two builds: all tracks vs best matches ─────────────────────────
   'best' keeps only what can be beatmatched and ends at the gate; 'all'
   (the default) is what every check above ran against. Falsifiers: a 'best'
   set containing an unlocked track or a transition over the gate; a 'best'
   set plus its leftOut not adding up to the pool; or 'all' having changed
   size because the mode was added. */
console.log('\n── build modes ─────────────────────────────────────────────');
{
  const bestSet = sequence(corpus, { length: 500, mode: 'best' });
  const allSet = sequence(corpus, { length: 500 });
  ok("'best' contains no track played straight", bestSet.every(t => !t._unlocked),
     bestSet.filter(t => t._unlocked).length + ' unlocked tracks in a best-matches set');
  let over = 0;
  for (let i = 1; i < bestSet.length; i++) if (Math.abs(bestSet[i]._stretch - 1) > 0.08 + 1e-9) over++;
  ok("'best' keeps every transition inside the 8% gate", over === 0, over + ' over the gate');
  ok("'best' set + leftOut == the pool", bestSet.length + bestSet.leftOut.length === bestSet.poolSize,
     bestSet.length + ' + ' + bestSet.leftOut.length + ' != ' + bestSet.poolSize);
  ok("'best' is shorter than 'all' on this corpus (the gate ends it)", bestSet.length < allSet.length,
     'best ' + bestSet.length + ' vs all ' + allSet.length + ' — the gate never ended the walk, so the mode changes nothing here');
  ok("'all' still places the whole pool", allSet.length === allSet.poolSize && allSet.mode === 'all',
     allSet.length + ' of ' + allSet.poolSize + ' placed, mode ' + allSet.mode);
  console.log('  all: ' + allSet.length + ' placed · best: ' + bestSet.length + ' placed, ' + bestSet.leftOut.length +
              ' left out (' + bestSet.leftOut.filter(t => !t._locked).length + ' grid, ' +
              bestSet.leftOut.filter(t => t._locked).length + ' reach)');
  /* 'phrase' (2026-08-19) is 'best' plus a flag the Player reads: same
     list, same leftOut; the flag is what differs. Falsifiers: a phrase set
     that is not track-for-track the best set; a phrase set without the
     flag; a best or all set WITH it. */
  const phSet = sequence(corpus, { length: 500, mode: 'phrase' });
  ok("'phrase' places exactly the 'best' list (same pool, same gate)",
     phSet.length === bestSet.length && phSet.every((t, i) => t === bestSet[i]) && phSet.leftOut.length === bestSet.leftOut.length,
     'phrase ' + phSet.length + ' vs best ' + bestSet.length);
  ok("'phrase' is stamped phrase:true and mode 'phrase'; best and all are not",
     phSet.phrase === true && phSet.mode === 'phrase' && bestSet.phrase === false && allSet.phrase === false,
     JSON.stringify([phSet.phrase, phSet.mode, bestSet.phrase, allSet.phrase]));
  ok("an unknown mode falls back to 'all'", sequence(corpus, { length: 500, mode: 'nope' }).mode === 'all', 'unknown mode was not refused');
}

/* ── the score has to describe THIS player, not the one before it ──────
   DWSCORE.plan() stretched every track by tempo/bpm until 2026-08-19 — the
   pre-0.7.0 player — so the saved set and the .cue carried a stretch figure
   against tracks the deck plays straight. Falsifier for the fix: any step
   whose track is _unlocked and whose stretchPct is a number; or a reach
   track after which the next step's rate is not computed from ITS bpm. */
console.log('\n── the score describes the player as it is ──────────────────');
global.DW = { dwellFloor: 45, lock: LOCK };
eval(fs.readFileSync(process.env.DECKWAVE_SCORE_SRC || 'assets/deckwave-score.js', 'utf8'));
const S = global.DWSCORE;
const steps = S.plan(set, { xfade: 16 });
const lied = steps.filter((s, i) => set[i]._unlocked && s.stretchPct != null);
ok('no step prints a stretch against a track that plays straight', lied.length === 0,
   lied.length + ' straight tracks carry a stretchPct, e.g. ' + (lied[0] && lied[0].name.slice(-30) + ' ' + lied[0].stretchPct + '%'));
/* STEP 0 IS NOT A TRANSITION (review 2026-09-01, ledger 82's class on the two
   surfaces that still carried it). The first track of a set has nothing before
   it, so its rate is 1 by construction and `STRETCH 0%` in the score and the
   .cue read as the tightest transition in the mix. `rate` stays 1 — that IS
   the rate — and `stretchPct` goes null, the same shape a straight track
   already had. Falsifier: step 0 carrying a stretchPct at all, or the cue
   printing STRETCH against track 01. Both were true before this date. */
ok('the score prints no stretch figure against step 0 — nothing precedes it',
   steps[0].stretchPct === null,
   'step 0 carries stretchPct ' + steps[0].stretchPct + ' — 0% against the opener reads as the best transition in the set');
ok('…and step 0 still carries its real rate (1), because that is a fact about playback',
   steps[0].rate === 1, 'step 0 rate ' + steps[0].rate);
ok('…and `matched` says which steps are beatmatched at all: false for step 0 and every straight track',
   steps[0].matched === false && steps.every((s, i) => s.matched === (!set[i]._unlocked && i > 0)),
   'matched disagrees with straight/index on ' + steps.filter((s, i) => s.matched !== (!set[i]._unlocked && i > 0)).length + ' steps');
const flagged = steps.filter((s, i) => !!s.straight !== !!set[i]._unlocked ||
                                     (s.straight && s.straight !== set[i]._unlockReason));
ok('every step carries the same straight/why as the set', flagged.length === 0,
   flagged.length + ' disagree, e.g. ' + (flagged[0] && flagged[0].name.slice(-30)));
/* reach repositions: the LOCKED step right after a reach track must have
   rate = reachBpm / ownBpm (to 4dp, which is what the score stores) */
let reachBad = 0, reachEg = '';
for (let i = 0; i < steps.length - 1; i++) {
  if (set[i]._unlockReason !== 'reach' || set[i + 1]._unlocked) continue;
  const want = +(set[i].bpm / set[i + 1].bpm).toFixed(4);
  if (steps[i + 1].rate !== want) { reachBad++; if (!reachEg) reachEg = steps[i + 1].name.slice(-30) + ' rate ' + steps[i + 1].rate + ' want ' + want; }
}
ok('after a reach track the score computes the next rate from that track\'s own bpm', reachBad === 0,
   reachBad + ' wrong, e.g. ' + reachEg);
const sc = S.score(set, { xfade: 16 });
ok('summary.maxStretchPct stays inside the gate (locked tracks only)', sc.summary.maxStretchPct <= 8.0 + 0.01,
   'maxStretchPct=' + sc.summary.maxStretchPct + ' — a straight track leaked into the summary');
const cueTxt = S.cue(sc, 'x');
const straightNames = set.filter(t => t._unlocked).map(t => t.name.replace(/"/g, "'"));
const cueLied = straightNames.filter(n => {
  const at = cueTxt.indexOf('TITLE "' + n + '"'); if (at < 0) return true;
  return /STRETCH/.test(cueTxt.slice(at, cueTxt.indexOf('INDEX', at)));
});
ok('the .cue writes STRAIGHT, not a STRETCH %, for every straight track', cueLied.length === 0,
   cueLied.length + ' cue entries carry STRETCH against a straight track');
/* …and the same for TRACK 01. The cue's own rule is keyed on stretchPct being
   null so it cannot drift from plan(); the falsifier is the literal that a
   reader of the cue sees. */
const t01 = cueTxt.slice(cueTxt.indexOf('  TRACK 01 AUDIO'), cueTxt.indexOf('  TRACK 02 AUDIO'));
ok('the .cue writes FIRST, not STRETCH 0%, against TRACK 01',
   !/STRETCH/.test(t01) && /FIRST \(nothing to match\)/.test(t01),
   'TRACK 01 reads: ' + JSON.stringify(t01.split('\n').find(l => /REM BPM/.test(l)) || t01.slice(0, 120)));
/* round trip: loading the score back restores the classification the
   player reads, so a loaded straight track is still played straight */
const fresh = corpus.map(t => Object.assign({}, t));
['_unlocked', '_unlockReason', '_locked', '_stretch', '_dwell'].forEach(k => fresh.forEach(t => delete t[k]));
const ld = S.load(JSON.stringify(sc), fresh);
const lostFlag = ld.set.filter((t, i) => !!t._unlocked !== !!set[i]._unlocked);
ok('load() restores _unlocked on every straight track', ld.missing.length === 0 && lostFlag.length === 0,
   ld.missing.length + ' missing, ' + lostFlag.length + ' lost their classification');
const old = JSON.parse(JSON.stringify(sc)); old.steps.forEach(s => { delete s.straight; delete s.dwellSec; });
const fresh2 = corpus.map(t => Object.assign({}, t));
['_unlocked', '_unlockReason', '_locked', '_stretch', '_dwell'].forEach(k => fresh2.forEach(t => delete t[k]));
const ld2 = S.load(old, fresh2);
ok('a pre-2026-08-19 score (no straight field) still loads and leaves classification alone',
   ld2.loaded === set.length && ld2.set.every(t => t._unlocked === undefined),
   'loaded ' + ld2.loaded + '/' + set.length);

/* ── the score in phrase mode ─────────────────────────────────────────
   A phrase-match set carries the flag; a meta the Player has stamped with
   a phrase offset plans its entry at that beat, its exit at a phrase start,
   and a one-phrase fade; a meta without one plans the downbeat path and
   says phraseBar null. load() puts the flag back. Falsifiers: a flagged set
   whose stamped step is not onPhrase; an unstamped step claiming one; a
   loaded set without the flag. */
console.log('\n── the score in phrase mode ────────────────────────────────────');
global.DWPHRASE = require('../assets/deckwave-phrase.js');
{
  const phSet = sequence(corpus, { length: 500, mode: 'phrase' });
  const m0 = phSet[0], m1 = phSet[1];
  m0.phrase = { v: 1, bars: 8, at: 3, beat: 12, contrast: 2.5, shuffles: 19, nBars: 100, ok: true };
  delete m1.phrase;
  const st = S.plan(phSet, { xfade: 16 });
  const one = (m0.beats[44] - m0.beats[12]);                /* one phrase in source seconds, rate 1 on the first deck */
  ok('a stamped step enters at its phrase beat and is onPhrase',
     st[0].onPhrase === true && Math.abs(st[0].entrySec - m0.beats[12]) < 1e-3 && st[0].phraseBar === 3,
     JSON.stringify(st[0]));
  ok('…its fade is one phrase, not the set\'s xfade', Math.abs(st[0].xfadeSec - one) < 0.05, st[0].xfadeSec + ' vs ' + one);
  ok('…its exit is a phrase start (beats[12 + 32k])',
     m0.beats.some((b, i) => i >= 12 && (i - 12) % 32 === 0 && Math.abs((b - m0.beats[12]) - st[0].exitSec) < 1e-3),
     'exit ' + st[0].exitSec);
  ok('an unstamped step in a phrase set plans the downbeat path and says phraseBar null',
     st[1].onPhrase === false && st[1].phraseBar === null && st[1].xfadeSec === 16, JSON.stringify(st[1]));
  const sc2 = S.score(phSet, { xfade: 16 });
  ok('the score records the mode and the phrase flag', sc2.engine.mode === 'phrase' && sc2.engine.phrase === true && /phrase/.test(sc2.engine.transition),
     JSON.stringify([sc2.engine.mode, sc2.engine.phrase]));
  const ld3 = S.load(sc2, corpus.map(t => Object.assign({}, t)));
  ok('load() puts the phrase flag back on the set', ld3.set.phrase === true && ld3.set.mode === 'phrase', JSON.stringify([ld3.set.phrase, ld3.set.mode]));
  const plainSc = S.score(sequence(corpus, { length: 500, mode: 'best' }), { xfade: 16 });
  ok('a best-matches score carries phrase:false and the old transition text', plainSc.engine.phrase === false && /downbeat-aligned/.test(plainSc.engine.transition),
     JSON.stringify([plainSc.engine.phrase, plainSc.engine.transition]));
  delete m0.phrase;
}

console.log('\n── the tune: two wheels, and which one is the default ──');
/* The 2026-08-29 ultra review (E1) found CAMELOT_MINOR was a copy of
   CAMELOT_MAJOR — minor keys numbered by their PARALLEL major, not their
   relative one. The keeper's call was NOT to swap it: every set this deck
   has played was mixed and heard on that table, so it stays the default
   and the standard wheel becomes a select. These checks pin both halves,
   and pin them the honest way — the standard table is DERIVED from music
   theory here, not copied from the source it is meant to check. */
const camSrc = fs.readFileSync('assets/deckwave.js', 'utf8').replace(/\r\n/g, '\n');
const tbl = name => {
  const m = camSrc.match(new RegExp('const ' + name + ' = \\{[\\s\\S]*?\\};'));
  if (!m) return null;
  return eval('(' + m[0].replace(/^const [A-Z_]+ = /, '').replace(/;$/, '') + ')');
};
const MAJ = tbl('CAMELOT_MAJOR'), DKW = tbl('CAMELOT_MINOR_DECKWAVE'), STD = tbl('CAMELOT_MINOR_STANDARD');
ok('both wheels exist as named tables', !!MAJ && !!DKW && !!STD,
   'the tune select has nothing to switch between');
/* the standard wheel, derived: a minor key shares its number with the
   major three semitones up (its relative major). Twelve pitch classes,
   no table copied — if someone edits CAMELOT_MINOR_STANDARD by hand this
   fails, which is the point. */
const SEMI = { C:0, 'C#':1, Db:1, D:2, 'D#':3, Eb:3, E:4, F:5, 'F#':6, Gb:6,
               G:7, 'G#':8, Ab:8, A:9, 'A#':10, Bb:10, B:11 };
const NAME_AT = n => Object.keys(SEMI).filter(k => SEMI[k] === n);
let stdBad = [];
for (const k of Object.keys(STD || {})) {
  const rel = NAME_AT((SEMI[k] + 3) % 12).find(x => MAJ[x] != null);
  if (!rel || MAJ[rel] !== STD[k]) stdBad.push(k + '→' + STD[k] + ' (relative major ' + rel + ' is ' + MAJ[rel] + ')');
}
ok('the STANDARD wheel is actually standard: every minor key carries the number of the major three semitones up',
   STD && stdBad.length === 0,
   'derived from the circle of fifths, not from the table: ' + stdBad.join(', '));
let dkwBad = [];
for (const k of Object.keys(DKW || {})) if (MAJ[k] !== DKW[k]) dkwBad.push(k);
ok('the DECKWAVE tune is documented for what it is: minor numbered by its PARALLEL major (the table equals CAMELOT_MAJOR)',
   DKW && dkwBad.length === 0 && /THE DECKWAVE TUNE/.test(camSrc),
   'the default tune is no longer the wheel every heard set was built on, or the comment no longer says what it is: ' + dkwBad.join(', '));
ok('deckwave tune is the DEFAULT and only an explicit stored "standard" moves it',
   /let tuneMode = 'deckwave';/.test(camSrc)
   && /getItem\('dw-tune'\) === 'standard'/.test(camSrc),
   'a fresh browser would build sets on a wheel nobody here has heard');
ok('retune() RESTAMPS the corpus from stored key+scale — the two tunes can never mix',
   /function retune\(mode\)/.test(camSrc) && /m\.camelot = c; restamped\+\+/.test(camSrc)
   && /const c = camelot\(m\.key, m\.scale\)/.test(camSrc),
   'changing the table alone leaves cached codes in one tune and fresh analyses in the other, scored against each other - worse than either (the mixed-corpus trap)');
ok('ingest() restamps every record on the way in, so a CACHE HIT cannot carry the other tune\'s code',
   /r\.camelot = camelot\(r\.key, r\.scale\);/.test(camSrc),
   'the analysis cache is written once and read forever: a record cached under one tune would sit in the corpus under the other');
ok('camelot() reads the live tune rather than one fixed table',
   /const MINOR = tuneMode === 'standard' \? CAMELOT_MINOR_STANDARD : CAMELOT_MINOR_DECKWAVE;/.test(camSrc),
   'the select would change a variable nothing reads');
/* and the thing that made this safe to ship at all: the offset is uniform,
   so it cancels within a mode. Same-letter pairs score identically under
   both tunes; only major↔minor pairs differ. Derived, not asserted. */
let sameMode = 0, crossMode = 0;
const codes = t => Object.keys(t).map(k => ({ k, a: t[k] }));
for (const x of codes(DKW || {})) for (const y of codes(DKW || {})) {
  const dk = camScore(x.a + 'A', y.a + 'A');
  const st = camScore(STD[x.k] + 'A', STD[y.k] + 'A');
  if (dk === st) sameMode++; else crossMode++;
}
ok('the two tunes score minor↔minor pairs IDENTICALLY (the +3 offset cancels within a mode)',
   /* sameMode > 0 or this passes on an empty loop - the decoration shape
      this repo keeps a table of. It DID pass vacuously when first written. */
   !!DKW && !!STD && sameMode > 100 && crossMode === 0,
   crossMode + ' minor-minor pairs differ between the tunes (over ' + sameMode + ' compared) - then the tune is not a cross-mode-only change and the 18.8% figure in the review is wrong');

console.log('\n── the norm()/AUDIO_EXT agreement (ultra review E2) ──');
ok('norm() strips exactly the extensions AUDIO_EXT admits — opus/oga included',
   /\.\(flac\|mp3\|wav\|aiff\|m4a\|ogg\|opus\|oga\)\$/.test(camSrc)
   && /'\.opus', '\.oga'/.test(camSrc),
   'the libre Commons path ingests any filetype:audio hit without the AUDIO_RE gate, and norm() only strips what it knows: a Song.opus was keyed "songopus" in LIB.files while its record was named "Song", so find() missed and playback said "missing file" on a track the panel had just called added');
const normList = (camSrc.match(/replace\(\/\\\.\((flac[^)]*)\)\$/) || [])[1];
const extList = (camSrc.match(/const AUDIO_EXT = \[([^\]]*)\]/) || [])[1];
ok('…and the two lists are the SAME list, not two lists that happen to agree today',
   !!normList && !!extList && normList.includes('opus')
   && normList.split('|').sort().join(',') ===
      extList.split(',').map(s => s.trim().replace(/['.]/g, '')).sort().join(','),
   'norm(): ' + normList + ' vs AUDIO_EXT: ' + extList + ' — the comment above norm() says "keep this list in step with AUDIO_EXT below" and this is that comment\'s failure mode');

/* ── the opener's tie-break, on a corpus built to force the tie ────────────
   `pool.filter(t => t._locked).concat(pool)` before a distance sort reads like
   a preference for a locked opener and is not one: Array#sort is stable, so
   the duplication only reorders entries whose distances are EXACTLY equal.
   That is worth PINNING rather than leaving to be "simplified" away, because
   energy is stored to three decimals and exact ties are common — and because
   a set that opens on a track played straight opens on no beatmatch at all.

   Two tracks, both at exactly arc(0, n), the UNLOCKED one first in the array
   so it wins the sort outright if the tie-break is dropped. Falsifier: the
   set opening on the unlocked track. Measured on the real library the same
   day, both openers agree — the tie-break fires here because this corpus was
   built to make it fire, which is the point of a control. */
console.log('\n── the opener prefers a locked grid on an exact tie ─────────');
{
  const want = arc(0, 3);
  /* a grid whose spacing agrees with the bpm label is LOCKED; one at half
     that spacing is 100% out and is not */
  const beats = (n, step) => Array.from({ length: n }, (_, i) => +(i * step).toFixed(4));
  const tie = [
    { id: 'u', name: 'unlocked opener', bpm: 120, conf: 3, dur: 200, camelot: '8A', energy: want, beats: beats(64, 1.0) },
    { id: 'l', name: 'locked opener',   bpm: 120, conf: 3, dur: 200, camelot: '8A', energy: want, beats: beats(64, 0.5) },
    { id: 'x', name: 'filler',          bpm: 122, conf: 3, dur: 200, camelot: '8A', energy: 0.9,  beats: beats(64, 60 / 122) }
  ];
  const gu = gridError(tie[0]), gl = gridError(tie[1]);
  ok('the tie corpus really does hold one locked and one unlocked track at the same energy',
     gu > LOCK.maxGridErrPct && gl <= LOCK.maxGridErrPct && tie[0].energy === tie[1].energy,
     'gridError ' + gu + ' / ' + gl + ' against a cut of ' + LOCK.maxGridErrPct + '% — the corpus does not pose the question');
  const tied = sequence(tie, { length: 3 });
  ok('an exact tie for the opening energy is broken toward the LOCKED track',
     tied.length && tied[0].id === 'l',
     'the set opened on ' + (tied[0] && tied[0].name) + ' — a set opening on a track played straight opens on no beatmatch at all; the locked-first concat before the stable sort is what prevents it');
}

/* ── ledger 137: prepare() must classify the ORIGINALS, not only its copies ──
   Build moved from build() to prepare() (8bf6f82), which sequences shallow
   copies so a build can never restamp a playing deck. Right — but the router
   still plans over the originals, commit() stamps _stretch on a stepping
   stone and never _unlocked, and nav-commit's gridOK is `_locked !== false`:
   an UNSTAMPED original counts as locked. So a stone above the cut, which
   build() used to leave marked straight, was stretched to the rolling target
   on a grid the project does not trust. Falsifier: an original above the cut
   without `_unlocked === true` after prepare(). Runs on the real corpus, where
   the cut leaves five such tracks — the control asserts there is at least one,
   so the check cannot pass on a corpus that never poses the question.
   The copy boundary is asserted in the same breath: originals get their
   CLASSIFICATION back, never the plan. */
console.log('\n── ledger 137: prepare() classifies the originals ───────────');
{
  const one = src.match(/^  prepare\(opts\) \{.*\},?$/m);
  const many = src.match(/^  prepare\(opts\) \{[\s\S]*?^  \},?$/m);
  const text = (one || many || [null])[0];
  ok('DW.prepare exists to be tested (control)', !!text,
     'no prepare(opts) method in the source — public at 338bdd7 has none; this block is about the branch that added it');
  if (text) {
    const fresh = corpus.map(t => { const c = {}; for (const k in t) if (k[0] !== '_') c[k] = t[k]; return c; });
    const cp = (src.match(/function classifyPool\([\s\S]*?\n\}\n/) || [''])[0];
    const prepare = new Function('corpus', 'sequence', 'LOCK', 'dedupe', 'gridError',
      cp + '\nreturn ({ ' + text.replace(/,\s*$/, '') + ' }).prepare;')(fresh, sequence, LOCK, dedupe, gridError);
    const set = prepare({ length: 500 });
    const pool = dedupe(fresh, {}).filter(t => t.bpm > 60 && t.dur > 75 && t.conf > 0);
    const unstamped = pool.filter(t => t._locked === undefined);
    const above = pool.filter(t => t._locked === false);
    const notStraight = above.filter(t => t._unlocked !== true);
    const leaked = pool.filter(t => t._stretch !== undefined || t._tempoAt !== undefined);
    ok('prepare() leaves every pool ORIGINAL classified (_locked stamped)',
       set.length === pool.length && unstamped.length === 0,
       'set ' + set.length + ' of pool ' + pool.length + ', ' + unstamped.length + ' originals unstamped — the router reads an unstamped track as locked (nav-commit gridOK)');
    ok('every ORIGINAL above the cut is marked to play straight, as build() marked it',
       above.length >= 1 && notStraight.length === 0,
       above.length + ' above the cut (need ≥1 for the question to be posed), ' + notStraight.length + ' of them NOT marked _unlocked: ' + notStraight.map(t => t.name).join(' | '));
    ok('and prepare() still writes no plan onto the originals (copy boundary holds)',
       leaked.length === 0,
       leaked.length + ' originals carry _stretch/_tempoAt after prepare()');
  }
}

console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') + ' of ' + checks + ' checks');
process.exit(fails ? 1 : 0);
