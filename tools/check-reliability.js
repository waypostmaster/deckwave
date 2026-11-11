/* Mike's runtime regressions. Bare Node, synthetic inputs, no real library.
   Falsifiers are recorded values/times, object identity, and lifetime state.
   Set DECKWAVE_SRC / DECKWAVE_LISTEN_SRC / DECKWAVE_RENDER_SRC to old source
   to prove that these checks reject the measured failures. */
const fs = require('fs'), vm = require('vm');
let checks = 0, fails = 0;
const ok = (name, condition, evidence) => {
  checks++;
  console.log((condition ? '  pass  ' : '  FAIL  ') + name + ' · ' + JSON.stringify(evidence));
  if (!condition) fails++;
};
const read = (env, path) => fs.readFileSync(process.env[env] || path, 'utf8').replace(/\r\n/g, '\n');
const core = read('DECKWAVE_SRC', 'assets/deckwave.js');
const listen = read('DECKWAVE_LISTEN_SRC', 'assets/deckwave-listen.js');
const renderer = read('DECKWAVE_RENDER_SRC', 'assets/deckwave-render.js');
[core, listen, renderer].forEach(text => new vm.Script(text));
const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; };
const near = (a,b) => Math.abs(a-b) < 1e-8;
function param() {
  const p = {value:0, events:[],
    cancelScheduledValues(at) { p.events=p.events.filter(e=>e.at<at); },
    setValueAtTime(value,at) { p.events.push({type:'set',value,at}); },
    linearRampToValueAtTime(value,at) { p.events.push({type:'linear',value,at}); },
    setTargetAtTime(value,at) { p.events.push({type:'set',value,at}); },
    at(time) { let prev={at:0,value:p.value};
      for(const e of p.events.slice().sort((a,b)=>a.at-b.at)) {
        if(e.at>time) return e.type==='linear' ? prev.value+(e.value-prev.value)*(time-prev.at)/(e.at-prev.at) : prev.value;
        prev=e;
      } return prev.value;
    }
  }; return p;
}
function audioNode(kind, rig) {
  const parameters = new Map([['playbackRate',param()]]);
  const n = {kind,playbackRate:param(),gain:param(),frequency:param(),Q:param(),threshold:param(),ratio:param(),
    parameters, connections:[], port:{posted:[],onmessage:null,postMessage(m){this.posted.push(m);}},
    connect(dest) {this.connections.push(dest);}, disconnect(){this.connections=[];this.disconnected=true;},
    start(at,offset){this.started={at,offset};rig.started.push(this);},
    stop(at){this.stopped=at===undefined?rig.now:at;}, buffer:null};
  rig.nodes.push(n); return n;
}
function playerRig(opts={}) {
  const rig={now:100,started:[],nodes:[],contexts:[],timers:new Map(),decodes:[],hold:new Map()}; let timer=0;
  function AC(){const ctx={state:'running',sampleRate:44100,destination:{},get currentTime(){return rig.now;},
    audioWorklet:{addModule:()=>opts.boot ? opts.boot.promise : Promise.resolve()},
    resume(){return opts.resume ? opts.resume.promise : Promise.resolve();},suspend(){ctx.state='suspended';},close(){ctx.state='closed';},
    createGain:()=>audioNode('gain',rig),createAnalyser:()=>audioNode('analyser',rig),
    createDynamicsCompressor:()=>audioNode('compressor',rig),createBufferSource:()=>audioNode('source',rig),
    createBiquadFilter:()=>audioNode('filter',rig)};rig.contexts.push(ctx);return ctx;}
  const sandbox={AC,navigator:{userAgent:''},console,ASSETS:{allowCDN:false},assetURL:k=>k,CDN:{},
    AudioWorkletNode:function(){return audioNode('worklet',rig);},
    LIB:{decode(meta){rig.decodes.push(meta.name);return rig.hold.has(meta.name)?rig.hold.get(meta.name).promise:Promise.resolve({duration:meta.dur,name:meta.name});}},
    setTimeout(fn,ms){const id=++timer;rig.timers.set(id,{fn,ms});return id;},clearTimeout(id){rig.timers.delete(id);}};
  sandbox.window=sandbox;
  if(opts.phrase) vm.runInNewContext(fs.readFileSync('assets/deckwave-phrase.js','utf8'),sandbox);
  rig.phraseAPI=sandbox.DWPHRASE;
  const start=core.indexOf('\nconst Player = (() => {'), end=core.indexOf('\n})();\n',start);
  if(start<0||end<0) throw Error('Player extraction failed');
  rig.player=vm.runInNewContext(core.slice(start+1,end+6)+'\nPlayer;',sandbox);
  rig.d=rig.player._dev; return rig;
}
const track=(name,bpm=120,dur=120)=>({name,bpm,dur,camelot:'8A',beats:Array.from({length:Math.floor(dur*bpm/60)},(_,i)=>i*60/bpm)});
async function playbackChecks(){
  const control=param();control.value=10;control.setValueAtTime(10,2);control.linearRampToValueAtTime(20,4);
  ok('parameter recorder sees a ramp and a held value',control.at(1)===10&&control.at(3)===15&&control.at(5)===20,[control.at(1),control.at(3),control.at(5)]);
  for(const settle of [false,true]){
    const r=playerRig({phrase:true});r.player.settle.on=settle;r.player.settle.minStretch=null;
    const seq=[track('phrase out',120),track('phrase in',128)];seq.phrase=true;
    seq.forEach(t=>t.phrase={v:r.phraseAPI.V,ok:true,beat:0,contrast:2});
    await r.player.play(seq);await flush();const a=r.d.A,b=r.d.B;
    const at=b.startedAt-a.startedAt, beats=(a.pos(at+a.fade)-a.pos(at))*a.track.meta.bpm/60;
    const values=[0,.25,.5,1].map(f=>{const t=b.startedAt+a.fade*f;return[a.src.playbackRate.at(t)*120,b.src.playbackRate.at(t)*128];});
    ok('unequal-tempo phrase overlap has 32 beats and shared tempo, settle '+settle,near(beats,32)&&values.every(([a,b])=>near(a,b)),{beats,seconds:a.fade,tempos:values});r.player.stop();
  }
  for(const bpms of [[120,128,128],[128,120,120],[120,120,120]]){
    const r=playerRig();await r.player.play(bpms.map((b,i)=>track('tempo'+i,b)));await flush();
    const checkBlend=label=>{const a=r.d.A,b=r.d.B; const values=[0,.5,1].map(f=>{
      const t=b.startedAt+a.fade*f;return [a.src.playbackRate.at(t)*a.track.meta.bpm,b.src.playbackRate.at(t)*b.track.meta.bpm];});
      ok(label+' shares tempo throughout the overlap',values.every(([a,b])=>near(a,b)),values);
      const t=b.startedAt+a.fade/2;
      const coherent=[a,b].every(d=>near(d.rateAt(t-d.startedAt),d.src.playbackRate.at(t))&&near(d.src.playbackRate.at(t),d.st.parameters.get('playbackRate').at(t)));
      ok(label+' clock and pitch compensation follow source automation',coherent,values);
    };
    checkBlend(bpms.join('/')+' first blend');
    r.now=r.d.B.startedAt+.2;r.d.handover(1);await flush();checkBlend(bpms.join('/')+' second blend');
    if(bpms[1]!==bpms[0]) ok('rolling target still advances toward the incoming BPM',r.d.tempo>120&&r.d.tempo<128,r.d.tempo);
    r.player.stop();
  }
  {
    const r=playerRig();await r.player.play([track('outgoing',120),track('incoming',128),track('third',125)]);await flush();
    const old=r.d.A, incoming=r.d.B, begin=incoming.startedAt;
    r.now=begin+.2;r.d.handover(1);await flush();r.now=begin+8;
    ok('outgoing monitor follows its rate and the audio fade clock',near(r.player.prevDeck.rate,old.src.playbackRate.at(r.now))&&near(r.player.prevDeck.fadeElapsed,8),{monitor:r.player.prevDeck.rate,source:old.src.playbackRate.at(r.now),elapsed:r.player.prevDeck.fadeElapsed});
    let area=0;const end=60,dt=.001;
    for(let t=dt/2;t<end;t+=dt)area+=incoming.src.playbackRate.at(incoming.startedAt+t)*dt;
    ok('source position equals an independent integral of parameter events',Math.abs(incoming.pos(end)-area)<1e-7,{mapped:incoming.pos(end),integrated:area});
    const heard=incoming.pos(8),rate=incoming.src.playbackRate.at(r.now);
    r.d.cancelPending();
    ok('cancelling the next plan preserves the blend already in progress',near(incoming.pos(8),heard)&&near(incoming.src.playbackRate.at(r.now),rate),{before:heard,after:incoming.pos(8),beforeRate:rate,afterRate:incoming.src.playbackRate.at(r.now)});
    await r.player.skip();await flush();
    ok('another requested blend waits for the audible overlap to finish',r.d.B.startedAt>=begin+old.fade,{newStart:r.d.B.startedAt,previousEnd:begin+old.fade});
    r.player.stop();
  }
  {
    const gate=deferred(),r=playerRig({boot:gate});
    const first=r.player.play([track('first boot')]);await flush();
    const second=r.player.play([track('second boot')]);await flush();gate.resolve();
    const results=await Promise.all([first,second]);await flush();
    ok('concurrent Play shares one boot and only the latest starts',r.contexts.length===1&&results[0]==='superseded'&&r.started.length===1&&r.player.state.now==='second boot',{contexts:r.contexts.length,results,starts:r.started.length,now:r.player.state.now});r.player.kill();
  }
  {
    const r=playerRig();await r.player.play([track('map',120),track('toward',128),track('later',125)]);await flush();
    const a=r.d.A,b=r.d.B;
    let worst=0,clockError=0;
    for(const d of [a,b])for(let t=0;t<=160;t+=.37){
      worst=Math.max(worst,Math.abs(d.when(d.pos(t))-t));
      clockError=Math.max(clockError,Math.abs(d.rateAt(t)-d.src.playbackRate.at(d.startedAt+t)));
    }
    ok('rate clock inverts the scheduled curve and follows its parameters',worst<1e-9&&clockError<1e-9,{inverseError:worst,rateError:clockError});
    const oldStart=b.startedAt;r.d.cancelPending();
    ok('cancel before a blend removes its future tempo change and stop',near(a.rateAt(oldStart-a.startedAt+20),1)&&near(a.src.playbackRate.at(oldStart+20),1)&&a.outAt===null&&a.src.stopped>=a.startedAt+120,{rate:a.rateAt(oldStart-a.startedAt+20),parameter:a.src.playbackRate.at(oldStart+20),out:a.outAt,stop:a.src.stopped});
    r.player.stop();
  }
  for(const phase of ['boot','resume']){
    const gate=deferred(),r=playerRig({[phase]:gate});const playing=r.player.play([track('pending')]);await flush();
    const stopped=r.player.stop();gate.resolve();const result=await playing;await flush();
    ok('Stop cancels Play waiting for '+phase,result==='superseded'&&r.started.length===0,{stopped,result,starts:r.started.length,state:r.player.state});
  }
  {
    const r=playerRig(),decode=deferred();r.hold.set('held',decode);const playing=r.player.play([track('held')]);await flush();r.player.stop();decode.resolve({duration:120});
    const result=await playing;ok('control: Stop cancels a pending decode',result==='superseded'&&!r.started.length,{result,starts:r.started.length});
  }
  {
    const r=playerRig(), previous=[track('previous')];await r.player.play(previous);await flush();r.player.stop();
    r.hold.set('bad [full title]',{promise:Promise.reject(Error('bad bytes'))});let error;
    try{await r.player.play([track('bad [full title]')]);}catch(e){error=e;}
    ok('failed Play keeps the last order and reports the full file identity',r.d.order===previous&&error?.failures?.[0].name==='bad [full title]'&&r.player.issues?.[0].message==='bad bytes',{order:r.d.order.map(t=>t.name),failures:error?.failures,issues:r.player.issues});r.player.stop();
  }
  {
    const r=playerRig();await r.player.play([track('final')]);await flush();const d=r.d.A;
    r.now=d.startedAt+121;d.src.onended();
    ok('natural completion clears playing identity and final buffer references',r.player.state.now===null&&r.player.state.live===0&&d.track.buf===null&&d.src.buffer===null,{state:r.player.state,trackBuffer:!!d.track.buf,sourceBuffer:!!d.src.buffer});
    ok('ended deck disconnects every node and releases the processor',d.released&&[d.src,d.st,d.lo,d.mid,d.hi,d.g].every(n=>n.disconnected)&&d.st.port.onmessage===null,{released:d.released,posts:d.st.port.posted});
    r.player.stop();
  }
  for(const lead of [.5,2]){
    const r=playerRig(),seq=[track('out'),track('in')];await r.player.play(seq);await flush();const out=r.d.A.outAt;
    r.now=out-lead;const held=deferred();r.hold.set('in',held);const replanned=r.player.setPhrase(false);await flush();r.now+=1;held.resolve({duration:120});await replanned;
    ok('redecode '+lead+'s before exit never schedules in the past',!!r.d.B&&r.d.B.startedAt>=r.now&&r.d.A.outAt>=r.now,{clock:r.now,start:r.d.B&&r.d.B.startedAt,out:r.d.A&&r.d.A.outAt});r.player.stop();
  }
}
async function libraryChecks(){
  const start=core.indexOf('const LIB = {'),end=core.indexOf('\n};',start);
  const norm=s=>s.toLowerCase().replace(/\.(flac|mp3|wav)$/, '').replace(/[^a-z0-9]/g,'');
  const a={name:'01 Intro.wav',size:10,lastModified:1}, b={name:'01 Intro.wav',size:20,lastModified:2}, c={name:'02 Outro.wav',size:30,lastModified:3};
  const lib=vm.runInNewContext(core.slice(start,end+3)+'\nLIB;',{norm,window:{showDirectoryPicker:async()=>({})},walk:async()=>[a,b,c]});
  const count=await lib.pick();
  const ma={id:'01 Intro.wav|10|1',name:'01 Intro'}, mb={id:'01 Intro.wav|20|2',name:'01 Intro'};
  ok('folder import retains distinct file identities',count===3&&lib.find(ma)===a&&lib.find(mb)===b,{count,first:lib.find(ma)&&lib.find(ma).size,second:lib.find(mb)&&lib.find(mb).size});
  ok('control: unambiguous legacy name still resolves',lib.find({name:'02 Outro'})===c,{size:lib.find({name:'02 Outro'})?.size});
  ok('ambiguous legacy name refuses instead of choosing a recording',!lib.find({name:'01 Intro'}),{size:lib.find({name:'01 Intro'})?.size});
  ok('unknown explicit identity never falls back to another file',!lib.find({id:'01 Intro.wav|99|9',name:'01 Intro'}),{size:lib.find({id:'01 Intro.wav|99|9',name:'01 Intro'})?.size});
  const ingestStart=core.indexOf('  async ingest(files, onProgress) {'),ingestEnd=core.indexOf('\n  },',ingestStart);
  const api=vm.runInNewContext('({'+core.slice(ingestStart,ingestEnd+5)+'})',{LIB:lib,corpus:[],console,norm,
    bootEssentia:async()=>{},analyse:async f=>({id:f.name+'|'+f.size+'|'+f.lastModified,name:f.name.replace(/\.wav$/,''),key:'C',scale:'minor'}),camelot:()=> '8A',normalise:()=>{}});
  lib.files=new Map();const added=await api.ingest([a,b,c]);
  ok('incremental ingest uses the same identities as folder reopening',added.added===3&&lib.files.size===3&&lib.find(ma)===a&&lib.find(mb)===b,{added:added.added,files:lib.files.size,first:lib.find(ma)?.size,second:lib.find(mb)?.size});
}
function captureRig(){
  const rig={nodes:[],started:[],now:0};
  const input=deferred(),tab=deferred();
  function AC(){return {destination:{},resume(){return Promise.resolve();},createMediaStreamSource:()=>audioNode('capture',rig),createAnalyser:()=>audioNode('analyser',rig),createGain:()=>audioNode('sink',rig),createChannelSplitter:()=>audioNode('split',rig)};}
  const sandbox={console,navigator:{mediaDevices:{getUserMedia:()=>input.promise,getDisplayMedia:()=>tab.promise}},AudioContext:AC};sandbox.window=sandbox;
  vm.runInNewContext(listen,sandbox);return {...rig,input,tab,api:sandbox.DWLISTEN};
}
function stream(name,hasAudio=true){const audio={label:name,readyState:'live',onended:null,stop(){this.readyState='ended';}},video={readyState:'live',stop(){this.readyState='ended';}};
  return {audio,video,getTracks:()=>hasAudio?[audio,video]:[video],getAudioTracks:()=>hasAudio?[audio]:[],getVideoTracks:()=>[video]};}
async function captureChecks(){
  {
    const r=captureRig(),a=stream('mic'),b=stream('tab');r.input.resolve(a);await r.api.mic();const oldEnded=a.audio.onended,oldNodes=r.nodes.slice();r.tab.resolve(b);await r.api.tab();
    ok('capture replacement stops the predecessor and disconnects its graph',a.audio.readyState==='ended'&&oldNodes.every(n=>n.disconnected),{oldTrack:a.audio.readyState,disconnected:oldNodes.map(n=>!!n.disconnected)});
    oldEnded();ok('an old ended event cannot stop the new capture',r.api.active&&r.api.kind==='tab'&&b.audio.readyState==='live',{active:r.api.active,kind:r.api.kind,newTrack:b.audio.readyState});
    r.api.stop();ok('Stop ends every acquired stream and disconnects all capture nodes',a.audio.readyState==='ended'&&b.audio.readyState==='ended'&&!r.api.active&&r.nodes.every(n=>n.disconnected),{old:a.audio.readyState,current:b.audio.readyState,active:r.api.active,disconnected:r.nodes.map(n=>!!n.disconnected)});
  }
  {
    const r=captureRig(),a=stream('mic');r.input.resolve(a);await r.api.mic();r.api.stop();ok('control: one capture stops',a.audio.readyState==='ended'&&!r.api.active,{state:a.audio.readyState,active:r.api.active});
  }
  {
    const r=captureRig(),a=stream('late');const pending=r.api.mic().catch(e=>e.message);r.api.stop();r.input.resolve(a);const result=await pending;
    ok('Stop also cancels an unresolved capture request',a.audio.readyState==='ended'&&!r.api.active,{state:a.audio.readyState,active:r.api.active,result});
  }
  {
    const r=captureRig(),a=stream('kept'),b=stream('no sound',false);r.input.resolve(a);await r.api.mic();r.tab.resolve(b);const result=await r.api.tab().catch(e=>e.message);
    ok('no-audio replacement fails without losing the existing capture',r.api.active&&r.api.kind==='mic'&&a.audio.readyState==='live'&&b.video.readyState==='ended',{active:r.api.active,kind:r.api.kind,result});r.api.stop();
  }
}
async function renderChecks(){
  for(const bad of [true,false]){
    const rig={now:0,nodes:[],started:[],closed:0,offline:0};
    function AC(){return {close(){rig.closed++;return Promise.resolve();}};}
    function Offline(ch,len,sr){rig.offline++;return {destination:{},createGain:()=>audioNode('gain',rig),createDynamicsCompressor:()=>audioNode('compressor',rig),createBufferSource:()=>audioNode('source',rig),startRendering:async()=>({duration:len/sr})};}
    const sandbox={console,AudioContext:AC,OfflineAudioContext:Offline,DW:{LIB:{files:new Map(),decode:async m=>{if(bad&&m.name==='middle')throw Error('bad bytes');return {duration:120};}}}};sandbox.window=sandbox;
    vm.runInNewContext(renderer,sandbox);let result,error;
    try{result=await sandbox.DWRENDER.render([track('first'),track('middle'),track('last')]);}catch(e){error=e;}
    if(bad)ok('failed track rejects render with identity before an output is created',!!error&&/middle/.test(error.message)&&rig.offline===0,{error:error?.message,offline:rig.offline,starts:rig.started.map(n=>n.started)});
    else ok('control: complete render keeps all three scheduled tracks',!!result&&rig.started.length===3,{starts:rig.started.map(n=>n.started.at),seconds:result?.buffer.duration});
    ok('decode context closes on '+(bad?'failure':'success'),rig.closed===1,{closed:rig.closed});
  }
}
/* Ledger 156: cancelPending() while a deck is FADING IN. Gain and bass are
   read off the recorded param timeline before and after, on the deck that is
   fading in (the opener, or the incoming deck once handover has run).
   Falsifiers: a snap to full (the old code) fails continuity; holding the
   value where the cancel found it fails "same line" and "finishes". */
async function fadeInChecks(){
  const cases=[['opener entrance',null],...[.125,.25,.5].map(f=>['after handover '+f,f])];
  for(const [label,f] of cases){
    const r=playerRig();await r.player.play([track('fi a'),track('fi b'),track('fi c')]);await flush();
    let deck=r.d.A,old=null,gEnd,loEnd=null;
    if(f==null){gEnd=deck.startedAt+1;r.now=deck.startedAt+.5;}
    else{old=r.d.A;const begin=r.d.B.startedAt,fade=old.fade;r.now=begin+.1;r.d.handover(1);await flush();
      deck=r.d.A;gEnd=begin+fade*.6;loEnd=begin+fade*.55;r.now=begin+fade*f;}
    const t=r.now,g=deck.g.gain,lo=deck.lo.gain,exitAt=deck.outAt,exitFade=deck.fade;
    const before={g:g.at(t),lo:lo.at(t),gMid:g.at((t+gEnd)/2),loMid:loEnd==null?0:lo.at((t+loEnd)/2),old:old&&old.g.gain.at(t)};
    ok(label+': control, the deck is mid-fade and has an exit to cancel',before.g>0&&before.g<1&&(loEnd==null||before.lo>-30&&before.lo<0)&&exitAt>gEnd,{before,exitAt,gEnd});
    r.d.cancelPending();
    const after={g:g.at(t),lo:lo.at(t),gMid:g.at((t+gEnd)/2),loMid:loEnd==null?0:lo.at((t+loEnd)/2),old:old&&old.g.gain.at(t)};
    ok(label+': cancel leaves gain and bass where they were (no snap to full)',near(after.g,before.g)&&near(after.lo,before.lo)&&(!old||near(after.old,before.old)),{before,after});
    ok(label+': the fade-in carries on along the same line',near(after.gMid,before.gMid)&&near(after.loMid,before.loMid),{before,after});
    ok(label+': the fade-in still finishes at full, and the cancelled exit is gone',near(g.at(gEnd),1)&&(loEnd==null||near(lo.at(loEnd),0))&&near(g.at(exitAt+exitFade/2),1)&&near(lo.at(exitAt+exitFade/2),0)&&deck.outAt===null,
      {gEnd:g.at(gEnd),loEnd:loEnd==null?null:lo.at(loEnd),atOldExit:[g.at(exitAt+exitFade/2),lo.at(exitAt+exitFade/2)],outAt:deck.outAt});
    r.player.stop();
  }
  {
    const r=playerRig();await r.player.play([track('hold a'),track('hold b')]);await flush();const d=r.d.A,exitAt=d.outAt;
    r.now=d.startedAt+20;r.d.cancelPending();
    ok('control: a cancel on a deck past its fade-in holds full gain through the dropped exit',near(d.g.gain.at(r.now),1)&&near(d.g.gain.at(exitAt+8),1)&&near(d.lo.gain.at(exitAt+8),0),{now:d.g.gain.at(r.now),atOldExit:d.g.gain.at(exitAt+8)});
    r.player.stop();
  }
}
/* ◀ back, blended (keeper 2026-11-01). The deck is on track 2, past the
   overlap, mid-phrase: 20.3 s in, so the next downbeat after the 1.2 s lead
   (22 s) and the next phrase start (32 s) differ, and "it took the phrase
   path" is falsifiable. The yardstick is skip() from the same state. */
async function backChecks(){
  const onSecond=async()=>{const r=playerRig({phrase:true});const seq=['bk a','bk b','bk c','bk d'].map(n=>track(n));
    seq.forEach(t=>t.phrase={v:r.phraseAPI.V,ok:true,beat:0,contrast:2});
    await r.player.play(seq);await flush();const begin=r.d.B.startedAt;r.now=begin+.1;r.d.handover(1);await flush();
    r.now=begin+20.3;return {r,begin};};
  const back=await onSecond(),fwd=await onSecond(),plain=await onSecond();
  const said=await back.r.player.blendBack();await flush();
  await fwd.r.player.skip();await flush();
  await plain.r.player.blendNow(plain.r.d.order[0]);await flush();
  const at=x=>x.r.d.B&&+(x.r.d.B.startedAt-x.begin).toFixed(6);
  ok('control: a plain blend-now and next ▶ leave at different points from this state',at(plain)===22&&at(fwd)===32,{plain:at(plain),next:at(fwd)});
  ok('◀ back blends at the same point and over the same fade as next ▶ (the phrase path)',at(back)===at(fwd)&&near(back.r.d.A.fade,fwd.r.d.A.fade)&&/ ¶ /.test(said),{back:at(back),next:at(fwd),fades:[back.r.d.A.fade,fwd.r.d.A.fade],said});
  const names=back.r.d.order.map(t=>t.name);
  ok('◀ back brings in the previous track, and the list reads in the order heard',back.r.d.B.track.meta.name==='bk a'&&back.r.d.A.track.meta.name==='bk b'&&names.join()==='bk b,bk a,bk c,bk d'&&back.r.d.idx===0&&back.r.player.state.now==='bk b',{next:back.r.d.B.track.meta.name,order:names,idx:back.r.d.idx});
  [back,fwd,plain].forEach(x=>x.r.player.stop());
  {
    const r=playerRig();await r.player.play([track('first'),track('second')]);await flush();const pendingDeck=r.d.B;
    const said=await r.player.blendBack();
    ok('◀ back on the first track says so and leaves the planned next alone',/start of the set/.test(said)&&r.d.B===pendingDeck,{said,sameNext:r.d.B===pendingDeck});
    r.player.stop();const starts=r.started.length;const cut=await r.player.blendBack();await flush();
    ok('◀ back with nothing playing is the cut back(), as on the lock screen',r.started.length>starts&&r.player.state.now==='first'&&/^1\//.test(cut),{said:cut,starts:[starts,r.started.length],now:r.player.state.now});
    r.player.stop();
  }
}
/* The review of ledger 157 (2026-11-10). Each block states its falsifier;
   each was run against the pre-fix source (DECKWAVE_SRC) and failed there. */
async function backReviewChecks(){
  const rig=async(names,hand)=>{const r=playerRig({phrase:true});const seq=names.map(n=>typeof n==='string'?track(n):n);
    seq.forEach(t=>t.phrase={v:r.phraseAPI.V,ok:true,beat:0,contrast:2});
    await r.player.play(seq);await flush();for(let i=0;i<hand;i++)await step(r);return r;};
  /* fire the handover onto the planned next deck, then stand well past the overlap */
  const step=async r=>{const begin=r.d.B.startedAt;r.now=begin+.1;r.d.handover(r.d.idx+1);await flush();r.now=begin+40.3;};
  const nm=d=>d&&d.track.meta.name, names=r=>r.d.order.map(t=>t.name).join();
  {
    /* Falsifier: the old order[idx-1] gives bw c on the second press, and
       never reaches bw a. */
    const r=await rig(['bw a','bw b','bw c','bw d'],2);
    ok('control: the walk starts on the third track with the fourth planned',nm(r.d.A)==='bw c'&&nm(r.d.B)==='bw d',{A:nm(r.d.A),B:nm(r.d.B)});
    await r.player.blendBack();await flush();const first=nm(r.d.B);await step(r);
    await r.player.blendBack();await flush();const second=nm(r.d.B),order=names(r);await step(r);
    ok('◀ back pressed again after the handover goes one further back, not to the track just left',first==='bw b'&&second==='bw a'&&order==='bw c,bw b,bw a,bw d',{first,second,order});
    const end=await r.player.blendBack();
    ok('◀ back on the earliest track of the walk says start of the set',nm(r.d.A)==='bw a'&&/start of the set/.test(end)&&nm(r.d.B)==='bw d',{A:nm(r.d.A),said:end,B:nm(r.d.B)});
    await step(r);await r.player.blendBack();await flush();
    ok('the walk is forgotten once the set moves on by itself: back from the next track is the one just left',nm(r.d.A)==='bw d'&&nm(r.d.B)==='bw a',{A:nm(r.d.A),B:nm(r.d.B)});
    r.player.stop();
  }
  {
    /* Falsifier: the old code blends out of the track the handover landed
       on, so B is replaced and the answer starts 'blending in'. */
    const r=await rig(['hd a','hd b','hd c','hd d'],1);const planned=r.d.B,held=deferred();r.hold.set('hd a',held);
    const pressing=r.player.blendBack();await flush();
    const begin=r.d.B.startedAt;r.now=begin+.1;r.d.handover(2);await flush();r.now=begin+5;const after=r.d.B;
    held.resolve({duration:120,name:'hd a'});const said=await pressing;await flush();
    ok('control: the handover really ran while the back press was decoding',nm(r.d.A)==='hd c'&&planned!==after&&nm(after)==='hd d',{A:nm(r.d.A),B:nm(after)});
    ok('◀ back refuses when a handover landed during its decode, and leaves the new plan alone',/press again/.test(said)&&r.d.B===after&&names(r)==='hd a,hd b,hd c,hd d',{said,order:names(r),sameNext:r.d.B===after});
    r.player.stop();
  }
  {
    /* Falsifier: the old cancelPending() path writes gain 1 at once on the
       half-faded last deck, which goes on playing. */
    const r=await rig(['ef a','ef b'],1);const last=r.d.A,out=last.outAt,fade=last.fade;
    r.now=out+fade/2;const g=last.g.gain,before=g.at(r.now),starts=r.started.length;
    ok('control: the last track is half-way down its closing fade with nothing planned',nm(last)==='ef b'&&r.d.B===null&&before>.2&&before<.8,{A:nm(last),B:nm(r.d.B),gain:before});
    const said=await r.player.blendBack();await flush();
    ok('◀ back during the closing fade cuts to the previous track and never lifts the fading deck to full',g.at(r.now)<=before+1e-9&&g.at(r.now+1)<=before+1e-9&&r.started.length>starts&&r.player.state.now==='ef a'&&/^1\//.test(said),
      {before,after:g.at(r.now),later:g.at(r.now+1),now:r.player.state.now,said});
    r.player.stop();
  }
  {
    /* Falsifier: indexOf moves the FIRST copy, giving dp a,dp c,dp x,dp x. */
    const x=track('dp x');const r=await rig([x,track('dp a'),x,track('dp c')],0);
    r.d.cancelPending();await r.player.play(r.d.order,3);await flush();r.now=r.d.A.startedAt+20.3;
    ok('control: the set lists one track twice and the deck is on the row after the second copy',names(r)==='dp x,dp a,dp x,dp c'&&r.d.idx===3&&nm(r.d.A)==='dp c',{order:names(r),idx:r.d.idx});
    await r.player.blendBack();await flush();
    ok('◀ back moves the row it means when a track is listed twice',names(r)==='dp x,dp a,dp c,dp x'&&r.d.idx===2&&nm(r.d.B)==='dp x',{order:names(r),idx:r.d.idx,B:nm(r.d.B)});
    r.player.stop();
  }
  {
    /* Falsifier: the old back line has no fade length. The yardstick is
       next ▶'s own line from the same state. */
    const a=await rig(['ln a','ln b','ln c'],1),b=await rig(['ln a','ln b','ln c'],1);
    const back=await a.player.blendBack(),next=await b.player.skip();await flush();
    const shape=s=>String(s).replace(/^next · /,'').replace(/ · .*$/,'');
    ok('◀ back and next ▶ print the same line: when, over how long, and ¶',/^blending in [\d.]+s over \d+s ¶$/.test(shape(back))&&shape(back)===shape(next),{back,next});
    a.d.cancelPending();
    ok('a cancelled exit takes its ¶ with it',a.d.A.atPhrase===false&&a.d.A.outAt===null,{atPhrase:a.d.A.atPhrase,outAt:a.d.A.outAt});
    a.player.stop();b.player.stop();
  }
}
module.exports = { playerRig, track, flush, deferred };
if (require.main === module) (async()=>{
  for(const [name,run] of [['player',playbackChecks],['fade-in',fadeInChecks],['back',backChecks],['back review',backReviewChecks],['library',libraryChecks],['capture',captureChecks],['render',renderChecks]]){
    console.log('\n'+name+' · synthetic inputs, no audio/library');
    try{await run();}catch(e){ok(name+' completed',false,e.stack);}
  }
  console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') + ' of ' + checks + ' checks');
  process.exitCode = fails ? 1 : 0;
})();
