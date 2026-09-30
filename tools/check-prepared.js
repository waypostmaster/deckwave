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
    ok('an unrelated displayed order is refused while playing', !!refusal && r.sets.current===current, {refusal});
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
    ok('an all-played prepared set refuses rather than erasing the remainder',!!empty&&r.player.playOrder===current,{empty});
    r.player.stop();
  }
  {
    const r=rig(),current=[tune('a'),tune('b')];await r.player.play(current);await flush();r.sets.adopt(current);
    r.player.reorder=async()=> 'refused: fixture changed the current index';
    const candidate=[tune('candidate')];r.sets.prepare(candidate);let error;try{await r.sets.apply();}catch(e){error=e.message;}
    ok('player refusal preserves both displayed and prepared orders',!!error&&r.sets.current===current&&r.sets.prepared===candidate,{error,order:r.sets.current.map(t=>t.name)});r.player.stop();
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
    ok('decode failure keeps the preparation available',error==='corrupt fixture'&&r.sets.prepared===candidate&&r.sets.current.length===0,{error,prepared:!!r.sets.prepared});r.player.stop();
  }
}
(async () => {
  try { await checksForSession(); } catch (e) { ok('session checks complete', false, e.stack); }
  console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') + ' of ' + checks + ' checks');
  process.exitCode = fails ? 1 : 0;
})();
