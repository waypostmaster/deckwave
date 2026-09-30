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
module.exports = { playerRig, track, flush, deferred };
if (require.main === module) (async()=>{
  for(const [name,run] of [['player',playbackChecks],['library',libraryChecks],['capture',captureChecks],['render',renderChecks]]){
    console.log('\n'+name+' · synthetic inputs, no audio/library');
    try{await run();}catch(e){ok(name+' completed',false,e.stack);}
  }
  console.log('\n'+(fails?fails+' FAILURES':'all passed')+' of '+checks+' checks');process.exitCode=fails?1:0;
})();
