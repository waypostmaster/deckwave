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
/* The bar carries three things now: how far in we are, WHERE the blend is
   scheduled, and how long it lasts. The crossfade is a stretch of time, not
   an instant, so it is drawn as a band with the mark at its start — showing a
   single line would imply the change is a cut.
   No transition on the mark's left: it is repositioned every frame from the
   schedule, and an eased 0.3s slide would lag every correction and turn a
   blend-now into a visible crawl instead of a jump. */
/* Class is "npbar", NOT "bar", and must stay that way. (No backticks in this
   comment — the whole block is a template literal.) The app's transport strip
   is ".bar" in this same shadow root, carrying
   display:flex; padding:8px 12px; grid-column:1/-1. With the global
   *{box-sizing:border-box} that 16px of vertical padding consumed the whole
   declared height:6px, leaving a content box 0px tall — so the fill, which is
   height:100%, computed to 0 and painted nothing. ".np .bar" won on height
   and lost on display and padding, which is why it looked styled and was not.
   The crossfade band and the blend mark kept working throughout because they
   are position:absolute and resolve against the padding box, so the symptom
   was "marks visible, fill missing" rather than an empty bar. */
.np .npbar{height:6px;background:var(--line);margin-top:7px;position:relative;overflow:hidden}
.np .npbar i{display:block;height:100%;width:0;background:var(--ac2);transition:width .3s}
.np .npbar s{position:absolute;top:0;height:100%;background:var(--warn);opacity:.22;
  pointer-events:none;text-decoration:none}
.np .npbar b{position:absolute;top:0;height:100%;width:2px;background:var(--warn);
  pointer-events:none;box-shadow:0 0 5px var(--warn)}
.np .npbar.now b{background:var(--ac);box-shadow:0 0 7px var(--ac)}
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

/* The strips require a SPACED ` - ` separator: with bare `-` and `\s*`
   allowing zero whitespace, the second strip fired on a title's own
   internal hyphen — `LukHash - 8-Bit Warrior` rendered as `Bit Warrior`
   on the one surface whose whole job is naming what is playing.
   panel-route.js documents this exact bug family; this module had copied
   the double-strip without the workaround (ultra review F2, ledger 104). */
const clean = n => n.replace(/^[^-]+ - /, '').replace(/^[^-]+ - /, '').replace(/^\d+\s+/, '');

/* Same reasoning as the dashboard's: a track name is not trusted input. It
   comes from a filename or from a loaded score, and lands in innerHTML. */
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

/* An href is not an innerHTML problem and esc() cannot make it safe: the
   parser decodes entities BEFORE the URL is dispatched, so an escaped
   `javascript:` link still executes on click — in this page's origin,
   which holds live directory handles for the music folder. source.page
   arrives from a loaded score, a file this project intends to accept
   from strangers. Scheme allowlist, or no anchor at all (ultra review
   F1, ledger 103). */
const safeHref = u => {
  try { const p = new URL(u, location.href).protocol;
        return (p === 'http:' || p === 'https:') ? u : null; }
  catch (e) { return null; }
};
const mmss  = s => Math.floor(Math.max(0, s) / 60) + ':' +
                   String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0');

let sr = null, box = null, $ = null;
let lastMetaKey = '';              /* the card's metadata line as last written — see update(): written on change, never per frame */

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
      '<div class="npbar" id="npBar"><s id="npXf"></s><b id="npMk"></b><i id="npB"></i></div>' +
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
    /* ── name the track that is SOUNDING, not the one at this index ─────
       This read used to be `S[st.idx]` alone, which is the LIST's opinion.
       The list and the deck can disagree — ledger 33 (a failed decode moved
       idx while the deck played on) and ledger 40 (a committed route replaced
       the array the dashboard held but not the one the player walks) are both
       exactly that, and the keeper caught the second one by noticing the
       panel naming a track they were not hearing:

           "maybe it IS routing. but it's not updating the live playlist
            like i expected it would. because we are not on demoscene
            right now."

       DW.nowMeta is the meta object on the playing deck, so it cannot be
       wrong about what is audible. The index is kept only as the fallback
       for the window before playback starts. */
    const S = D.set || [], st = D.state;
    const t = (window.DW && window.DW.nowMeta) || S[st.idx];
    const nx = (window.DW && window.DW.nextMeta) || S[st.idx + 1];

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
    /* `!st.now`, not `!t`: a built-but-stopped set makes S[st.idx] truthy,
       so the old test never entered this branch once a set existed and the
       card showed "stopped · cued at 1 of N" over a live capture. The loop
       already lets listen mode win the analyser whenever it is active; the
       card follows it whenever no deck is playing. */
    if (!st.now && L && L.active) {
      const vu = D.vu, stereo = D.stereo;
      $('npT').textContent = 'listening · ' + String(L.source || 'input').slice(0, 42);
      $('npM').textContent = 'external source · visuals only, no analysis'; lastMetaKey = '';
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
      $('npXf').style.display = 'none'; $('npMk').style.display = 'none';
      $('npEl').textContent = ''; $('npRem').textContent = '';
      $('npBlend').innerHTML = ''; $('npN').innerHTML = '';
      return;
    }

    if (!t) { $('npT').textContent = 'idle'; return; }
    /* coming back from listen mode — put the grid's own labels back */
    if (labelsSwapped) restoreLabels();

    /* ── nothing is actually on a deck ──────────────────────────────────
       st.idx SURVIVES stop() and end-of-set — the Player nulls A and B but
       leaves idx where it was. So S[st.idx] still resolves to a track, and
       this card rendered it exactly as though it were playing: full title,
       full grid, and a progress bar that could never move, because elapsed
       is 0 when there is no deck to measure from.

       Observed live, not deduced: state.now null, elapsed 0.00 across two
       samples 1.5s apart, bar width 0px, while the card named a track.

       The card cannot ask "is audio coming out" — it reads the bundle only.
       state.now is the honest proxy: it is A's name, and A is what the
       gain ramps and the elapsed clock are attached to. */
    if (!st.now) {
      $('npT').textContent = clean(t.name).slice(0, 54);
      $('npM').textContent = 'stopped · cued at ' + (st.idx + 1) + ' of ' + st.of; lastMetaKey = '';
      $('npB').style.width = '0%';
      $('npXf').style.display = 'none'; $('npMk').style.display = 'none';
      $('npBar').classList.remove('now');
      $('npEl').textContent = '0:00'; $('npRem').textContent = '';
      /* native figures only — stretch is a property of a playing deck */
      $('gBpm').textContent = Math.round(t.bpm);
      $('gKey').textContent = t.camelot;
      $('gStr').textContent = '-'; $('gStr').className = '';
      $('gEn').textContent = (t.energy || 0).toFixed(2);
      $('npBlend').innerHTML = ''; $('npN').innerHTML = '';
      drawBars(D);
      return;
    }

    /* The position is where THIS meta sits in the list, looked up by
       identity, so the title and the "track N" figure cannot name two
       different tracks on one line. st.idx is the fallback only. */
    const pos = S.indexOf(t);
    $('npT').textContent = clean(t.name).slice(0, 54);
    /* The pipe's own health, on the one surface the keeper watches while
       listening (ledger 65: "slightest popping" arrived with no number
       beside it because the gap counter lived in a log nothing shows).
       Silent when everything is right: `\u26a0 plain worklet` only when the
       held module did not load, `\u26a0 N gaps` only when the stretch pipe
       zero-filled a block since \u25b6. Each \u26a0 is a fact, not a
       judgement, and 0 prints nothing \u2014 a clean card stays clean. */
    const pipe = (st.worklet === 'plain' ? ' \u00b7 \u26a0 plain worklet' : '')
      + (st.gapsTotal > 0 ? ' \u00b7 \u26a0 ' + st.gapsTotal + ' gap' + (st.gapsTotal === 1 ? '' : 's') : '');
    const npMeta = (t.key || '') + ' ' + (t.scale || '')
      + ' \u00b7 conf ' + (t.conf || 0).toFixed(2)
      + ' \u00b7 track ' + ((pos > -1 ? pos : st.idx) + 1) + ' of ' + (S.length || st.of)
      + pipe;
    /* a fetched track (DWLIBRE) shows who made it and under what terms \u2014
       attribution is a licence condition, so it is on the card, not in a
       tooltip \u2014 and it LINKS OUT to the page serving the music (keeper,
       2026-08-19: "we need a linkout button to the places serving the
       music"). Anchor only when there is a page to link; the name and the
       page come from a fetched file or a loaded score, so both are escaped. */
    /* the HOST gets named too \u2014 keeper: "add the hosting provider slug
       like 'from archive.org' - I want them to get credit" */
    /* WRITE ONLY WHEN THE LINE CHANGES. update() runs every frame, and an
       innerHTML write every frame replaces the anchor ~60 times a second
       \u2014 a human click's mousedown and mouseup then land on two DIFFERENT
       anchor nodes and the browser fires NO click at all. Measured
       2026-09-01 with trusted input (review H3, ledger 124): a 100 ms
       press on \u2197 opened nothing, mouseup on a fresh node, no click event;
       the same press with no frame between opened the Archive page. This
       is ledger 94's shape (tooltips could never physically open) on the
       one link the keeper asked for. The composed string is the key; a
       write happens at a track change or a metrics change, not per frame. */
    const srcLine = t.source
      ? ' \u00b7 \u2609 ' + (t.source.creator || t.source.item || '')
        + ' \u00b7 ' + (t.source.licenceName || t.source.licence || 'licence unknown')
        + (t.source.kind ? ' \u00b7 from ' + t.source.kind : '')
      : '';
    const page = t.source && safeHref(t.source.page);       /* scheme-gated here, once; esc() at the sink is for the markup */
    const metaKey = (page ? 'A' : 'T') + '|' + (page || '') + '|' + npMeta + srcLine;
    if (metaKey !== lastMetaKey) {
      lastMetaKey = metaKey;
      if (page) {
        $('npM').innerHTML = esc(npMeta) + ' \u00b7 <a href="' + esc(page)
          + '" target="_blank" rel="noopener" style="color:inherit">' + esc(srcLine.slice(3)) + ' \u2197</a>';
      } else {
        $('npM').textContent = npMeta + srcLine;
      }
    }

    /* THE DECK'S RATE, NOT THE PLAN'S. `t._stretch` is what sequence() or
       commit() intended; the deck runs at tempo / bpm computed at chain()
       time, which is 1.0 after any jump (play(set, i) resets the target to
       the track's own bpm) and the forced figure after a force-blend. The
       two agree only while the set plays exactly as planned. DW.deck reads
       the live rate off the playing deck \u2014 under a settle ramp it moves. */
    const dk = window.DW && window.DW.deck;
    const rate = dk ? dk.rate : (t._stretch || 1);
    /* an unlocked track enters at 0 \u2014 chain() does not trust its beats[0] */
    const entry = t._unlocked ? 0 : ((t.beats && t.beats[0]) || 0);
    /* Prefer the engine's own figures. Deriving elapsed by subtracting
       transLeft from a computed duration was circular — it could only ever
       agree with whatever formula produced transLeft, so a blend-now moved
       the countdown and the bar disagreed with it. */
    const B = D.blend;
    const dur = (B && B.dur > 0) ? B.dur : (t.dur - entry) / rate;
    const el = (typeof D.elapsed === 'number') ? Math.min(D.elapsed, dur)
             : (transLeft != null ? Math.max(0, dur - 16 - transLeft) : 0);

    $('npB').style.width = Math.min(100, (el / dur) * 100) + '%';
    $('npEl').textContent = mmss(el);
    $('npRem').textContent = '-' + mmss(dur - el);

    /* the scheduled blend, straight off the schedule */
    const xf = $('npXf'), mk = $('npMk'), bar = $('npBar');
    if (B && nx) {
      const p = B.frac * 100, wdt = Math.min(100 - p, B.fadeFrac * 100);
      xf.style.display = 'block'; mk.style.display = 'block';
      xf.style.left = p + '%'; xf.style.width = wdt + '%';
      mk.style.left = p + '%';
      bar.classList.toggle('now', B.in <= 0);
      mk.title = 'blend at ' + mmss(B.at) + ' · ' + Math.round(B.xfade) + 's crossfade';
    } else { xf.style.display = 'none'; mk.style.display = 'none';
      bar.classList.remove('now'); }

    $('gBpm').textContent = Math.round(t.bpm * rate);
    $('gKey').textContent = t.camelot;
    if (t._unlocked) {
      /* "Played straight" is not a quality judgement and must never be
         printed as 0.0% — it reads as the best transition on screen. The
         route panel and the steering menu already say so; this card did
         not, because `_stretch` is 1 for every unlocked track and 1 is
         truthy. */
      $('gStr').textContent = '∿ straight';
      $('gStr').className = '';
      $('gStr').title = t._unlockReason === 'reach'
        ? 'out of reach of the stretch gate — plays at its own speed, then the set follows it'
        : 'beat grid disagrees with its tempo label — plays at its own speed, not beatmatched';
    } else if (dk && st.idx === 0 && dk.rate === 1) {
      /* FIRST DECK — the same defect one state over, and the reason the
         comment above exists. Nothing precedes step 1, so the deck runs at
         its own speed and `+0.0%` would read as the tightest beatmatch on
         screen. Ledger 82 fixed this in RECON and left the card; the
         predicate is RECON's, so the surfaces agree. */
      $('gStr').textContent = '∿ first';
      $('gStr').className = '';
      $('gStr').title = 'first deck — the set has no predecessor here, so the deck runs at its own speed and there is nothing to match';
    } else {
      const sp = (rate - 1) * 100;
      $('gStr').textContent = (sp >= 0 ? '+' : '') + sp.toFixed(1) + '%';
      $('gStr').className = Math.abs(sp) > 8 ? 'w' : '';   /* same 8% rule as the gate */
      $('gStr').title = dk && dk.settling ? 'settling to ×1.000 · ' + Math.round(dk.settleLeft) + 's left' : '';
    }
    $('gEn').textContent = (t.energy || 0).toFixed(2);

    /* the extraction drawBars() announces, finished: the track path kept a
       byte-identical inline copy, so the five calibrated constants lived in
       two places (ultra review F6) */
    drawBars(D);

    const b = $('npBlend');
    if (transLeft != null && nx) {
      b.className = 'blend' + (transLeft < 20 ? ' soon' : '');
      /* the crossfade length comes off the schedule (Player.setXfade exists;
         it is not on the DW facade, so nothing in the UI can move it yet);
         a straight incoming track is not downbeat-aligned and must not say so */
      const xs = B ? Math.round(B.xfade) : 16;
      b.innerHTML = transLeft <= 0
        ? '<b>\u25c9 BLENDING NOW</b> \u00b7 bass swap at 45%'
        : 'blend in <b>' + Math.round(transLeft) + 's</b> \u00b7 ' + xs + 's crossfade, '
          + (nx._unlocked ? 'straight \u2014 no beat alignment' : 'downbeat-aligned');
    } else b.innerHTML = nx ? '' : 'final track';

    $('npN').innerHTML = nx
      ? ('next \u00b7 <s>' + esc(clean(nx.name).slice(0, 32)) + '</s> '
         + Math.round(nx.bpm) + ' ' + esc(nx.camelot) + ' \u00b7 e' + (nx.energy || 0).toFixed(2))
      : '';
  }
};
})();
