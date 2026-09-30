"""Generate a disposable browser QA page from index.html and real modules.
Run from the repo root, serve the root, open /tools/qa-prepared.html.
Only generated silent AudioBuffers and synthetic metadata; no library/cache.
"""
from pathlib import Path
import json

root = Path(__file__).resolve().parent.parent
fixture = r'''
<script>
(() => {
  const tracks = ['Fixture Alpha', 'Fixture Beta', 'Fixture Gamma'].map((name,i) => ({
    id: name+'.wav|'+(100+i)+'|0', name, bpm:120+i*4, dur:120, conf:4,
    energy:.22+i*.22, key:'C', scale:'minor', camelot:'5A',
    beats:Array.from({length:256},(_,j)=>j*60/(120+i*4))
  }));
  DW.corpus.push(...tracks);
  tracks.forEach((t,i) => DW.LIB.add({name:t.name+'.wav',size:100+i,lastModified:0}));
  DW.volume = 0;
  DW.LIB.decode = async (m,ctx) => {
    if (m.name === 'Fixture Corrupt [full name]') throw Error('synthetic corrupt input');
    return ctx.createBuffer(1,Math.round(m.dur*ctx.sampleRate),ctx.sampleRate);
  };
  const state = document.createElement('output'); state.id='qaState';
  state.hidden=true; document.body.appendChild(state);
  const add = document.createElement('button'); add.id='qaCorrupt';add.textContent='QA: prepare corrupt fixture';
  add.style.cssText='position:fixed;top:48px;right:8px;z-index:2147483647;font:10px monospace';
  add.onclick=()=>qaDash.prepare([{...tracks[1],name:'Fixture Corrupt [full name]'}]);document.body.appendChild(add);
  setInterval(()=>{state.textContent=JSON.stringify({
    now:DW.nowMeta&&DW.nowMeta.id,idx:DW.state.idx,live:DW.state.live,
    player:DW.playOrder.map(t=>t.id),display:qaDash.set.map(t=>t.id),
    prepared:qaDash.prepared&&qaDash.prepared.map(t=>t.id),
    corpusStamped:DW.corpus.some(t=>t._stretch!==undefined||t._unlocked!==undefined),
    issues:DW.issues,ctx:DW.state.ctx,volume:DW.volume
  });},100);
})();
</script>
'''
html = (root / 'index.html').read_text(encoding='utf-8')
html = html.replace('<head>', '<head><base href="/">')
html = html.replace('window.DWDASH.mount(document.body);', 'window.qaDash = window.DWDASH.mount(document.body);')
html = html.replace('</body>', fixture + '</body>')
(root / 'tools/qa-prepared.html').write_text(html, encoding='utf-8')
score = {'format':'deckwave-set','engine':{'mode':'all','phrase':False},'steps':[
    {'name':'Fixture Gamma','rate':1,'straight':None},
    {'name':'Fixture Beta','rate':1,'straight':None}
]}
(root / 'tools/qa-prepared-score.json').write_text(json.dumps(score), encoding='utf-8')
print('Generated tools/qa-prepared.html and tools/qa-prepared-score.json; silent synthetic inputs, no cache writes.')
