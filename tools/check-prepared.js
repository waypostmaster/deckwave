/* Prepared-set transactions use the real Player and routing repair under
   the recording AudioContext from check-reliability. No music or caches. */
const fs = require('fs'), vm = require('vm');
const { playerRig, track, flush, deferred } = require('./check-reliability');
const source = fs.readFileSync(process.env.DECKWAVE_DASH_SRC || 'assets/deckwave-dashboard.js', 'utf8').replace(/\r\n/g, '\n');
let checks = 0, fails = 0;
const ok = (name, pass, state) => { checks++; if (!pass) fails++; console.log((pass ? 'pass ' : 'FAIL ') + name + ' · ' + JSON.stringify(state)); };
const begin = source.indexOf('function makeSetSession('), end = source.indexOf('\n}\n', begin);
const factory = begin < 0 ? null : vm.runInNewContext('(' + source.slice(begin, end + 2) + ')');
function rig() {
  const r = playerRig(), dw = r.player;
  dw.LIB = { find: m => !m.missing };
  const scope = { window: { DW: dw } };
  for (const file of ['deckwave-nav.js', 'deckwave-nav-commit.js']) vm.runInNewContext(fs.readFileSync('assets/' + file, 'utf8'), scope);
  r.sets = factory(() => dw, () => scope.window.DWNAV);
  return r;
}
const tune = (name, bpm = 120) => ({ ...track(name, bpm), id: name, _locked: true });
async function checksForSession() {
  ok('dashboard owns a prepared-set transaction', !!factory, { factory: !!factory });
  if (!factory) return;
  {
    const r = rig(), a = tune('already played'), b = tune('on deck'), c = tune('old next');
    const current = [a,b,c]; await r.player.play(current,1); await flush(); r.sets.adopt(current);
    const prepared = [{ ...b, _unlocked: true }, tune('new next',126), tune('far',160)];
    r.sets.prepare(prepared);
    ok('preparing keeps playing identity, metadata and scheduled next', r.sets.current===current && r.player.nowMeta===b && !b._unlocked && r.player.nextMeta===c, {playing:r.player.nowMeta.name,next:r.player.nextMeta.name,straight:!!b._unlocked});
    let refusal; try { r.sets.adopt(prepared); } catch(e) { refusal=e.message; }
    /* ledger 141: `!!refusal` passed on an injected TypeError — a crash read as a refusal. Match the message. */
    ok('an unrelated displayed order is refused while playing', /^prepare this set/.test(refusal) && r.sets.current===current, {refusal});
    const result = await r.sets.apply(); await flush();
    const next = r.sets.current;
    ok('Apply adopts the real player order and preserves the exact history prefix', next===r.player.playOrder && next[0]===a && next[1]===b && next.length===4 && !r.sets.prepared, {result,order:next.map(t=>t.name),idx:r.player.state.idx});
    ok('Apply reuses the gate and marks an unreachable remainder straight', next[3]._unlocked && next[3]._unlockReason==='reach' && !prepared[2]._unlocked, {reason:next[3]._unlockReason,preparedMutated:!!prepared[2]._unlocked});
    ok('Apply removes already-played identity even when the prepared metadata is a copy', next.filter(t=>t.id==='on deck').length===1, {ids:next.map(t=>t.id)});
    r.player.stop();
  }
  {
    const r=rig(),current=[tune('a'),tune('b')]; await r.player.play(current);await flush();r.sets.adopt(current);
    const bad=[{...tune('missing [full title]'),missing:true}];r.sets.prepare(bad);
    const before=r.player.nextMeta;let error;try{await r.sets.apply();}catch(e){error=e;}
    ok('missing files refuse Apply before replacing the order or next deck',error?.failures?.[0].name==='missing [full title]'&&r.player.playOrder===current&&r.player.nextMeta===before&&r.sets.prepared===bad,{error:error?.message,failures:error?.failures,next:r.player.nextMeta.name});
    r.sets.prepare([{...current[0]}]);let empty;try{await r.sets.apply();}catch(e){empty=e.message;}
    ok('an all-played prepared set refuses rather than erasing the remainder',/^no unplayed tracks/.test(empty)&&r.player.playOrder===current,{empty});
    r.player.stop();
  }
  {
    const r=rig(),current=[tune('a'),tune('b')];await r.player.play(current);await flush();r.sets.adopt(current);
    r.player.reorder=async()=> 'refused: fixture changed the current index';
    const candidate=[tune('candidate')];r.sets.prepare(candidate);let error;try{await r.sets.apply();}catch(e){error=e.message;}
    ok('player refusal preserves both displayed and prepared orders',/^refused/.test(error)&&r.sets.current===current&&r.sets.prepared===candidate,{error,order:r.sets.current.map(t=>t.name)});r.player.stop();
  }
  {
    const r=rig(),current=[tune('a'),tune('b')];await r.player.play(current);await flush();r.sets.adopt(current);
    const gate=deferred();r.hold.set('delayed',gate);const first=[tune('delayed')], second=[tune('newer preparation')];r.sets.prepare(first);
    const applying=r.sets.apply();await flush();r.sets.prepare(second);gate.resolve({duration:120});await applying;
    ok('late Apply completion cannot consume a newer preparation',r.sets.prepared===second&&r.sets.current===r.player.playOrder,{prepared:r.sets.prepared.map(t=>t.name),playing:r.player.nowMeta.name});r.player.stop();
  }
  {
    const r=rig(),candidate=[tune('first'),tune('second')];candidate.phrase=true;r.sets.prepare(candidate);
    await r.sets.play();await flush();
    ok('Play prepared adopts the complete set and its phrase flag',r.sets.current===candidate&&r.player.phrase&&!r.sets.prepared,{now:r.player.nowMeta.name,phrase:r.player.phrase});r.player.stop();
    r.sets.prepare(candidate);const gate=deferred();r.hold.set('first',gate);const pending=r.sets.play();await flush();r.player.stop();gate.resolve({duration:120});const result=await pending;
    ok('Stop during Play prepared retains the preparation and starts no deck',result==='superseded'&&r.sets.prepared===candidate&&!r.player.nowMeta,{result,prepared:!!r.sets.prepared,now:r.player.nowMeta});
  }
  {
    const r=rig(),candidate=[tune('first')];r.sets.prepare(candidate);r.hold.set('first',{promise:Promise.reject(Error('corrupt fixture'))});let error;
    try{await r.sets.play();}catch(e){error=e.message;}
    ok('decode failure keeps the preparation available',error==='corrupt fixture'&&r.sets.prepared===candidate&&r.sets.current.length===0,{error,prepared:!!r.sets.prepared});
    let after;try{r.sets.discard();}catch(e){after=e.message;}
    ok('…and a failed Play prepared leaves Discard working (the pending mark cleared on rejection)',!after&&!r.sets.prepared,{after,prepared:!!r.sets.prepared});r.player.stop();
  }
  /* ultracode review 2026-10-22, Codex triage F49: Discard during a pending
     Play prepared cleared `prepared` and the UI said "discarded", but play()
     had already captured the candidate, so the deck started it and it became
     the committed set — the panel and the deck disagreed about what was
     dropped. Same shape for a pending Apply remaining. Both entry points
     (the Prepared card's button and ▶) go through sets.play(), so the gate is
     in the session. Falsifier: discard() returns quietly while play() or
     apply() is awaiting the player. Control: once the play has settled,
     discard works again. */
  {
    const r=rig(),candidate=[tune('first'),tune('second')];r.sets.prepare(candidate);
    const gate=deferred();r.hold.set('first',gate);const pending=r.sets.play();await flush();
    let refusal;try{r.sets.discard();}catch(e){refusal=e.message;}
    const heldDuring=r.sets.prepared===candidate;
    gate.resolve({duration:120});await pending;await flush();
    ok('Discard during a pending Play prepared is refused, and the prepared set is still there while it starts',
       /starting/.test(refusal||'')&&heldDuring,{refusal,heldDuring});
    /* not a falsifier of F49 (the old code ends in this state too): it pins
       that the refusal does not break the start it refused to interrupt */
    ok('…and the refusal does not interrupt the start: the set that started is the committed one',
       r.player.nowMeta&&r.player.nowMeta.name==='first'&&r.sets.current===candidate&&!r.sets.prepared,{now:r.player.nowMeta&&r.player.nowMeta.name,prepared:!!r.sets.prepared});
    const other=[tune('other')];r.sets.prepare(other);let later;try{r.sets.discard();}catch(e){later=e.message;}
    ok('…control: once the play has settled, Discard discards',!later&&!r.sets.prepared,{later,prepared:!!r.sets.prepared});r.player.stop();
  }
  {
    const r=rig(),current=[tune('a'),tune('b')];await r.player.play(current);await flush();r.sets.adopt(current);
    const gate=deferred();r.hold.set('delayed',gate);const cand=[tune('delayed')];r.sets.prepare(cand);
    const applying=r.sets.apply();await flush();
    let refusal;try{r.sets.discard();}catch(e){refusal=e.message;}
    const heldDuring=r.sets.prepared===cand;
    gate.resolve({duration:120});await applying;await flush();
    ok('Discard during a pending Apply remaining is refused too',/starting/.test(refusal||'')&&heldDuring,{refusal,heldDuring});
    r.player.stop();
  }
}
/* F49, the button: the Discard handler is cut out of the source and RUN with
   a session whose discard() refuses. Falsifier: it announces "Prepared set
   discarded" anyway, or throws out of the click. Control: with a session
   that discards, it does announce it. */
function checksForDiscardButton() {
  const m = source.match(/\$\('discardPrepared'\)\.onclick = (\(\) => \{[\s\S]*?\?\.focus\(\); \});/);
  ok('the Discard handler can be found', !!m, { found: !!m });
  if (!m) return;
  const run = refuse => {
    const said = [], logged = []; let threw = null;
    const btn = { focus() {}, textContent: '', disabled: false };
    const $ = () => ({ querySelector: () => btn, querySelectorAll: () => [], disabled: false });
    const sets = { discard() { if (refuse) throw Error('cannot discard: the prepared set is starting'); } };
    try {
      const fn = new Function('sets', 'renderPrepared', 'announce', 'log', '$', '"use strict"; return (' + m[1] + ');')(sets, () => {}, s => said.push(s), s => logged.push(s), $);
      fn();
    } catch (e) { threw = e.name + ': ' + e.message; }
    return { said, logged, threw };
  };
  const no = run(true), yes = run(false);
  ok('a refused Discard does not announce "discarded" and says why instead',
     !no.threw && !no.said.some(s => /discarded/.test(s)) && no.said.concat(no.logged).some(s => /starting/.test(s)), no);
  ok('…control: an accepted Discard announces it', !yes.threw && yes.said.includes('Prepared set discarded'), yes);
}
/* ── ledger 140: ▶ on a prepared set must arm the Android call-focus proxy ──
   Build always prepares now, so "Build, ▶" always takes the prepared branch
   of the ▶ handler — and that branch returned before PH().armCalls(), the
   call that has to run INSIDE the user's tap (phone.js) for a call to pause
   the set (LISTENING §14, ledger 71). Text check on the handler's order, the
   source compiled first (ledger 111): the arming call must come before the
   prepared branch. Falsifier: the branch precedes the call, as in 8bf6f82. */
function checksForSource() {
  let compiled = false;
  try { new vm.Script(source); compiled = true; } catch (e) { ok('the dashboard source compiles', false, e.message); }
  if (!compiled) return;
  const branch = source.indexOf('if (dash.prepared) {');
  const before = source.lastIndexOf('PH().armCalls()', branch);
  const after = source.indexOf('PH().armCalls()', branch);
  const handlerStart = source.lastIndexOf("btn('▶ play'", branch);
  ok('▶ arms the call-focus proxy BEFORE the prepared-set branch, inside the same gesture',
     branch > 0 && handlerStart > 0 && before > handlerStart && before < branch,
     { handlerStart, armBefore: before, preparedBranch: branch, armAfter: after });
}
(async () => {
  try { checksForSource(); } catch (e) { ok('source checks complete', false, e.stack); }
  try { await checksForSession(); } catch (e) { ok('session checks complete', false, e.stack); }
  try { checksForDiscardButton(); } catch (e) { ok('discard button checks complete', false, e.stack); }
  console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') + ' of ' + checks + ' checks');
  process.exitCode = fails ? 1 : 0;
})();
