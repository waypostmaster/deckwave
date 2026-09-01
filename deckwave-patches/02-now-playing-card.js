/* DECKWAVE PATCH 02 — the now-playing card
   A floating readout, bottom right. Load after the dashboard has mounted;
   call DWNOWPLAYING.mount(dash) once, then DWNOWPLAYING.update() every frame.

   It reads only from the shared bundle and DW.state — no private engine
   access — so it survives the panel/loop refactors that broke earlier
   versions of this card twice.  */
window.DWNOWPLAYING = (function () {
'use strict';

const CSS = `
/* Docked into the track-list column, not floating over the app. As a fixed
   overlay it covered the list and part of the transport — the two things that
   have to stay readable and clickable while a set runs. This module ships its
   own stylesheet and it is appended after the dashboard's, so this rule is the
   one that decides; changing it in the dashboard alone did nothing. */
.np{background:var(--surf);border-bottom:1px solid var(--ac2);
  padding:10px 12px;font-size:10px;line-height:1.5;flex:none}
.np.hidden{display:none}
.np u{display:flex;justify-content:space-between;text-decoration:none;font-size:7.5px;
  letter-spacing:.2em;text-transform:uppercase;color:var(--dim);margin-bottom:5px}
.np u b{cursor:pointer}.np u b:hover{color:var(--ac)}
.np .t{color:var(--ac2);font-size:11.5px;word-break:break-word;margin-bottom:3px}
.np .m{color:var(--dim);font-size:9px;letter-spacing:.08em}
.np .bar{height:3px;background:var(--line);margin-top:7px}
.np .bar i{display:block;height:100%;width:0;background:var(--ac2);transition:width .3s}
.np .times{display:flex;justify-content:space-between;font-size:8.5px;color:var(--dim);margin-top:4px}
.np .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:5px;margin-top:8px}
.np .grid div{border:1px solid var(--line);padding:4px 5px;text-align:center}
.np .grid u{display:block;font-size:6.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.np .grid b{display:block;font-size:11px;color:var(--ac);margin-top:1px;font-weight:500}
.np .grid b.w{color:var(--warn)}.np .grid b.p{color:var(--ac2)}
.np .bars{display:flex;gap:2px;align-items:flex-end;height:22px;margin-top:6px}
.np .bars i{flex:1;background:var(--line);transition:height .1s}
.np .blend{margin-top:7px;padding-top:6px;border-top:1px solid var(--line);font-size:9px;color:var(--dim)}
.np .blend b{color:var(--ac2)}
.np .blend.soon b{color:var(--warn)}
.np .nx{color:var(--dim);font-size:9px;margin-top:5px;white-space:nowrap;
  overflow:hidden;text-overflow:ellipsis}
.np .nx s{text-decoration:none;color:var(--ac)}
`;


/* The four grid cells are relabelled in listen mode, because bpm/key/stretch
   /energy do not exist for a stream. They must be put back when a track plays
   again, or the deck would show "level" over a bpm figure. */
const GRID_LABELS = { gBpm: 'bpm', gKey: 'key', gStr: 'stretch', gEn: 'energy' };
let labelsSwapped = false;
function gridLabel(id, text) {
  const b = $(id); if (!b) return;
  const u = b.parentElement && b.parentElement.querySelector('u');
  if (u) u.textContent = text;
}
function restoreLabels() {
  Object.keys(GRID_LABELS).forEach(id => gridLabel(id, GRID_LABELS[id]));
  labelsSwapped = false;
}
/* Spectrum bars, shared by both paths. Was inlined in the track path only. */
function drawBars(D) {
  const el = $('npBars'); if (!el || !D.freq) return;
  const bars = el.children, nb = bars.length;
  for (let i = 0; i < nb; i++) {
    const lo = Math.floor(Math.pow(i / nb, 2.2) * D.freq.length);
    const hb = Math.max(lo + 1, Math.floor(Math.pow((i + 1) / nb, 2.2) * D.freq.length));
    let m = 0; for (let j = lo; j < hb; j++) m = Math.max(m, D.freq[j]);
    bars[i].style.height = Math.max(2, (m / 255) * 22) + 'px';
    bars[i].style.background = m > 200 ? 'var(--ac2)' : 'var(--ac)';
  }
}

const clean = n => n.replace(/^[^-]+-\s*/, '').replace(/^[^-]+-\s*/, '').replace(/^\d+\s*/, '');

/* Same reasoning as the dashboard's: a track name is not trusted input. It
   comes from a filename or from a loaded score, and lands in innerHTML. */
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const mmss  = s => Math.floor(Math.max(0, s) / 60) + ':' +
                   String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0');

let sr = null, box = null, $ = null;

return {
  mount(dash) {
    sr = dash.shadow; $ = id => sr.getElementById(id);
    let st = sr.getElementById('dw-np-css');
    if (!st) { st = document.createElement('style'); st.id = 'dw-np-css';
      st.textContent = CSS; sr.appendChild(st); }
    const old = sr.getElementById('npBox'); if (old) old.remove();
    box = document.createElement('div'); box.className = 'np'; box.id = 'npBox';
    box.innerHTML =
      '<u><span>now playing</span><b id="npHide">&#10005;</b></u>' +
      '<div class="t" id="npT">&mdash;</div><div class="m" id="npM"></div>' +
      '<div class="bar"><i id="npB"></i></div>' +
      '<div class="times"><span id="npEl">0:00</span><span id="npRem">-0:00</span></div>' +
      '<div class="grid">' +
        '<div><u>bpm</u><b id="gBpm">-</b></div>' +
        '<div><u>key</u><b class="p" id="gKey">-</b></div>' +
        '<div><u>stretch</u><b id="gStr">-</b></div>' +
        '<div><u>energy</u><b id="gEn">-</b></div></div>' +
      '<div class="bars" id="npBars"></div>' +
      '<div class="blend" id="npBlend"></div><div class="nx" id="npN"></div>';
    /* Dock into the track-list column, above the list. Floating over the app
       meant it covered the list and part of the transport — the two things you
       need readable while a set runs. Falls back to the old behaviour if the
       column is not there, so this cannot leave the card with nowhere to go. */
    const side = sr.querySelector('.side'), list = sr.getElementById('list');
    if (side && list) side.insertBefore(box, list);
    else sr.querySelector('.app').appendChild(box);
    $('npBars').innerHTML = Array.from({ length: 24 },
      () => '<i style="height:2px"></i>').join('');
    $('npHide').onclick = () => this.toggle();
    return box;
  },

  toggle() { if (box) box.classList.toggle('hidden');
    return box && !box.classList.contains('hidden'); },

  /* D is the shared per-frame bundle; transLeft is seconds until the blend */
  update(D, transLeft) {
    if (!box || box.classList.contains('hidden')) return;
    const S = D.set || [], st = D.state, t = S[st.idx], nx = S[st.idx + 1];

    /* ── listening to something else ────────────────────────────────────
       "idle" was wrong and unhelpful: the deck is idle, but the machine is
       full of sound and every visual is responding to it. Say what is
       actually happening, and fill the grid with things we genuinely measure
       from the stream rather than four dashes.

       What CANNOT go here, and why: bpm, key, stretch and energy all come
       from analysing a file. A capture is a stream — there is no file to
       analyse, no beat grid, no key estimate. Reading tempo or key off live
       audio means building real-time detectors, which is a different piece of
       work with all the calibration hazards this project has a table about.
       The honest move is to show what is measured and label it, rather than
       showing an empty bpm field that implies one is coming. */
    const L = window.DWLISTEN;
    if (!t && L && L.active) {
      const vu = D.vu, stereo = D.stereo;
      $('npT').textContent = 'listening · ' + String(L.source || 'input').slice(0, 42);
      $('npM').textContent = 'external source · visuals only, no analysis';
      const cell = (id, lab, val) => { const b = $(id); if (b) b.textContent = val; gridLabel(id, lab); };
      /* The register readout is taken from the header, which the render loop
         already maintains — calling DWREGISTER.update() again here would drive
         its damping state twice per frame and make the colour twitch. */
      const kr = sr.getElementById('kReg');
      cell('gBpm', 'level',    vu ? Math.round(vu.L * 100) + '%' : '-');
      cell('gKey', 'register', kr && kr.textContent !== '-' ? kr.textContent.split(' ').pop() : '-');
      cell('gStr', 'width',    stereo ? stereo.width.toFixed(2) : '-');
      cell('gEn',  'phase',    stereo ? (stereo.corr > 0 ? '+' : '') + stereo.corr.toFixed(2) : '-');
      labelsSwapped = true;
      drawBars(D);
      $('npB').style.width = '0%';
      $('npEl').textContent = ''; $('npRem').textContent = '';
      $('npBlend').innerHTML = ''; $('npN').innerHTML = '';
      return;
    }

    if (!t) { $('npT').textContent = 'idle'; return; }
    /* coming back from listen mode — put the grid's own labels back */
    if (labelsSwapped) restoreLabels();

    $('npT').textContent = clean(t.name).slice(0, 54);
    $('npM').textContent = (t.key || '') + ' ' + (t.scale || '')
      + ' \u00b7 conf ' + (t.conf || 0).toFixed(2)
      + ' \u00b7 track ' + (st.idx + 1) + ' of ' + st.of;

    const rate = t._stretch || 1;
    const entry = (t.beats && t.beats[0]) || 0;
    const dur = (t.dur - entry) / rate;
    const el = transLeft != null ? Math.max(0, dur - 16 - transLeft) : 0;

    $('npB').style.width = Math.min(100, (el / dur) * 100) + '%';
    $('npEl').textContent = mmss(el);
    $('npRem').textContent = '-' + mmss(dur - el);

    $('gBpm').textContent = Math.round(t.bpm * rate);
    $('gKey').textContent = t.camelot;
    const sp = (rate - 1) * 100;
    $('gStr').textContent = (sp >= 0 ? '+' : '') + sp.toFixed(1) + '%';
    $('gStr').className = Math.abs(sp) > 8 ? 'w' : '';   /* same 8% rule as the gate */
    $('gEn').textContent = (t.energy || 0).toFixed(2);

    if (D.freq) {
      const bars = $('npBars').children, nb = bars.length;
      for (let i = 0; i < nb; i++) {
        const lo = Math.floor(Math.pow(i / nb, 2.2) * D.freq.length);
        const hb = Math.max(lo + 1, Math.floor(Math.pow((i + 1) / nb, 2.2) * D.freq.length));
        let m = 0; for (let j = lo; j < hb; j++) m = Math.max(m, D.freq[j]);
        bars[i].style.height = Math.max(2, (m / 255) * 22) + 'px';
        bars[i].style.background = m > 200 ? 'var(--ac2)' : 'var(--ac)';
      }
    }

    const b = $('npBlend');
    if (transLeft != null && nx) {
      b.className = 'blend' + (transLeft < 20 ? ' soon' : '');
      b.innerHTML = transLeft <= 0
        ? '<b>\u25c9 BLENDING NOW</b> \u00b7 bass swap at 45%'
        : 'blend in <b>' + Math.round(transLeft) + 's</b> \u00b7 16s crossfade, downbeat-aligned';
    } else b.innerHTML = nx ? '' : 'final track';

    $('npN').innerHTML = nx
      ? ('next \u00b7 <s>' + esc(clean(nx.name).slice(0, 32)) + '</s> '
         + Math.round(nx.bpm) + ' ' + esc(nx.camelot) + ' \u00b7 e' + (nx.energy || 0).toFixed(2))
      : '';
  }
};
})();
