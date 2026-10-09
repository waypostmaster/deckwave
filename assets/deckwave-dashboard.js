/* ─────────────────────────────────────────────────────────────────────────
   DECKWAVE · DASHBOARD
   The instrument. Five panels, a track list, a transport, and the transport's
   worth of decisions that took a whole session to get right.

   Notes worth keeping, because each one was a bug first:

   · fit() iterates the LIVE canvas map, never a captured array. A stale
     snapshot leaves later-added canvases at the browser's default 300x150
     while stretched across the layout — they draw perfectly into a buffer
     nobody sized, which looks exactly like a broken renderer.

   · Panels reflow by ASPECT RATIO, and the grid can reflow without the window
     ever changing size. So the ResizeObserver watches the panel row and each
     panel, not just the window.

   · Stereo comes from whichever source is live — listen mode, or the deck's
     own analyser split into L/R. An AnalyserNode is a pass-through, so
     splitting from its output is always available. Claiming otherwise was an
     invented constraint that hid a real bug underneath it.

   · Every colour is read from a CSS custom property each frame, so a theme
     change lands on the next frame with no reload.
   ───────────────────────────────────────────────────────────────────────── */

window.DWDASH = (function () {
'use strict';

/* Last mounted dashboard, for the live-patching seam. See DW._dev — same
   rules: nothing in this application may read it, and anything built on it is
   a session experiment until it is ported into the module. */
let lastDash = null;

/* Escape before ANY interpolation into innerHTML.

   Track names are not trusted input. They come from filenames, and from the
   `name` field of a loaded score — and a score is a file this project intends
   to accept from strangers (paste a JSON, load one from a share link). A name
   of the form  Artist - Track<img src=x onerror=…>  executed here; confirmed,
   not theoretical.

   It matters more than a usual local XSS because of what the page is holding:
   live FileSystemDirectoryHandle objects for the music folder, plus ordinary
   network access. Injected script inherits both.

   Anything derived from a filename, a score field, or a prompt() goes through
   this. Values the code itself produced do not need it, but escaping them
   costs nothing and removes the judgement call from every future edit. */
const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const PITCH = ['C','C#','D','Eb','E','F','F#','G','Ab','A','Bb','B'];

const CSS = `
:host{all:initial;
  --bg:var(--dw-color-bg,#04010f); --surf:var(--dw-color-surface,#0b0424);
  --line:var(--dw-color-line,#22125c); --txt:var(--dw-color-text,#e6ddff);
  --dim:var(--dw-color-dim,#7d6eb0); --ac:var(--dw-color-accent,#22e8ff);
  --ac2:var(--dw-color-accent-2,#ff2d95); --warn:var(--dw-color-warn,#ffb02e);
  --bad:var(--dw-color-bad,#ff5470); --good:var(--dw-color-good,#3ee68a);
  --fn:var(--dw-font-mono,ui-monospace,Menlo,monospace);
  --glow:var(--dw-glow,1); --scan:var(--dw-scanline-opacity,.26);
  --rad:var(--dw-border-radius,0px);
  display:block;height:100%;font-family:var(--fn);color:var(--txt)}
*{box-sizing:border-box;margin:0}
.app{display:grid;grid-template-columns:1fr minmax(230px,clamp(230px,22vw,340px));
  grid-template-rows:auto 1fr auto;height:100vh;background:var(--bg);gap:1px}
.app::before{content:'';position:fixed;inset:0;pointer-events:none;z-index:99;
  background:repeating-linear-gradient(180deg,transparent 0 2px,rgba(0,0,0,var(--scan)) 2px 3px)}
@media(max-width:720px){.app{grid-template-columns:1fr;grid-template-rows:auto auto 1fr auto}}
.bar{grid-column:1/-1;display:flex;align-items:center;gap:clamp(8px,2vw,22px);
  padding:8px 12px;background:var(--surf);border-bottom:1px solid var(--ac2);flex-wrap:wrap}
.bar h1{font-size:clamp(11px,1.4vw,15px);letter-spacing:.3em;color:var(--ac2);
  text-shadow:0 0 calc(10px*var(--glow)) var(--ac2);font-weight:700}
/* THE ONLY TWO OUTBOUND LINKS ON THE DECK. margin-left:auto puts them past
   the last readout rather than between the title and the live figures, and
   they are dim until hovered: a link on an instrument must not compete with
   the numbers. Both open in a new tab, and that is not decoration — a
   same-tab navigation here DESTROYS the loaded set, which is the one thing
   this page cannot get back. check-panels asserts the target. */
.bar .lk{margin-left:auto;display:flex;gap:clamp(8px,1.4vw,16px);align-items:center}
.bar .lk a{font-size:8px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim);
  text-decoration:none;white-space:nowrap;border-bottom:1px solid transparent;padding-bottom:1px}
.bar .lk a:hover,.bar .lk a:focus-visible{color:var(--ac);border-bottom-color:var(--ac)}
.kv{display:flex;flex-direction:column;line-height:1.15}
.kv u{text-decoration:none;font-size:7.5px;letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}
.kv b{font-size:clamp(11px,1.3vw,15px);color:var(--ac);font-weight:500;
  text-shadow:0 0 calc(7px*var(--glow)) var(--ac)}
.kv b.p{color:var(--ac2)} .kv b.w{color:var(--warn)} .kv b.g{color:var(--good)}
.main{display:grid;grid-template-rows:auto auto 1fr auto;gap:1px;min-height:0;overflow:hidden}
.strip{background:var(--surf);padding:6px 10px 8px;min-height:0}
.strip>u{display:block;text-decoration:none;font-size:7.5px;letter-spacing:.2em;
  text-transform:uppercase;color:var(--dim);margin-bottom:3px}
canvas{display:block;width:100%;height:100%;background:var(--bg)}
.cw{position:relative;min-height:0;height:calc(100% - 12px)}

/* panels reflow by aspect ratio — five slivers on a square screen is useless */
.tri{display:grid;gap:1px;min-height:0;grid-auto-rows:1fr;overflow:auto;
  grid-template-columns:repeat(5,1fr)}
@media (min-aspect-ratio:2/1){.tri{grid-template-columns:repeat(5,1fr)}}
@media (max-aspect-ratio:2/1) and (min-aspect-ratio:7/5){.tri{grid-template-columns:repeat(3,1fr)}}
@media (max-aspect-ratio:7/5) and (min-aspect-ratio:3/4){.tri{grid-template-columns:repeat(2,1fr)}}
@media (max-aspect-ratio:3/4){.tri{grid-template-columns:1fr}}
@media (max-width:620px){.tri{grid-template-columns:1fr}}
.tri>.strip{min-height:clamp(120px,20vh,260px);display:flex;flex-direction:column}
.tri>.strip>.cw{flex:1;min-height:0}

.side{background:var(--surf);display:flex;flex-direction:column;min-height:0;
  border-left:1px solid var(--line)}
.side>u{display:block;text-decoration:none;font-size:7.5px;letter-spacing:.2em;
  text-transform:uppercase;color:var(--dim);padding:8px 10px 5px;border-bottom:1px solid var(--line)}
.list{flex:1;overflow-y:auto;min-height:0;scrollbar-width:thin;scrollbar-color:var(--line) transparent}
.tr{display:grid;grid-template-columns:26px 1fr auto;gap:6px;padding:4px 8px;font-size:10px;
  border-bottom:1px solid rgba(34,18,92,.5);align-items:center;cursor:pointer}
.list button.tr{width:100%;text-align:left;border-width:0 0 1px;letter-spacing:normal;text-transform:none;border-radius:0}
.list button.tr.free{border-left:2px dashed var(--warn)}
.list button.tr.now{border-left:2px solid var(--ac2)}
.prepared[hidden],.issues[hidden]{display:none}
.prepared{display:flex;flex-direction:column;min-height:0;max-height:48%;border-top:1px solid var(--ac);padding:8px 10px;gap:6px}
.prepared h2{font-size:9px;font-weight:400;text-transform:uppercase;letter-spacing:.12em;color:var(--ac)}
.prepared p{font-size:9px;line-height:1.5;color:var(--dim)}
.prepareActions{display:flex;gap:5px;flex-wrap:wrap}
.prepareList{overflow:auto;padding-left:24px;font-size:10px;line-height:1.7;min-height:32px;color:var(--txt)}
.prepareList li{overflow-wrap:anywhere}
.issues{flex-basis:100%;font-size:10px;color:var(--warn)}
.issues summary{cursor:pointer;padding:5px 0;width:fit-content}
.issues ol{max-height:22vh;overflow:auto;padding:4px 12px 8px 28px;line-height:1.6;overflow-wrap:anywhere;color:var(--txt)}
.srOnly{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
button:focus-visible,select:focus-visible,summary:focus-visible{outline:2px solid var(--ac);outline-offset:2px}
button:disabled{opacity:.5;cursor:default}
.navpop button.opt{width:100%;text-align:left;font:inherit;letter-spacing:inherit;text-transform:none}
.tr:hover{background:rgba(127,127,127,.08)}
.tr i{color:var(--dim);font-style:normal;font-size:8.5px}
.tr s{text-decoration:none;color:var(--dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tr em{font-style:normal;color:var(--dim);font-size:8.5px;white-space:nowrap}
.tr.now{background:rgba(255,45,149,.14);border-left:2px solid var(--ac2)}
.tr.now s,.tr.now i,.tr.now em{color:var(--ac2)}
.tr.next{background:rgba(34,232,255,.08)} .tr.next s{color:var(--ac)}
/* played straight: no beatmatch claimed. Marked on the tempo cell rather
   than the title, because it is a fact about the transition, not the song. */
.tr.free em{color:var(--warn)}
.tr.free{border-left:2px dashed var(--warn)}
.tr.free.now{border-left:2px solid var(--ac2)}
.tr.done s,.tr.done i,.tr.done em{opacity:.4}

.tp{grid-column:1/-1;display:flex;gap:5px;padding:7px 10px;background:var(--surf);
  border-top:1px solid var(--line);flex-wrap:wrap;align-items:center}
button{background:none;border:1px solid var(--line);color:var(--dim);font:inherit;font-size:9px;
  letter-spacing:.14em;text-transform:uppercase;padding:6px 11px;cursor:pointer;border-radius:var(--rad)}
button:hover{border-color:var(--ac);color:var(--ac)}
button.hot{border-color:var(--ac2);color:var(--ac2)}
.sep{width:1px;height:20px;background:var(--line);margin:0 3px}

/* master level. Sized to sit on the same baseline as the buttons rather than
   growing the transport's height — the row already wraps and a taller control
   would change where it breaks. */
.vol{display:inline-flex;align-items:center;gap:6px;padding:0 4px}
.vol u{font-size:8px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);
  text-decoration:none;white-space:nowrap;min-width:58px}
.vol input[type=range]{-webkit-appearance:none;appearance:none;width:74px;height:3px;
  background:var(--line);border-radius:2px;outline:none;cursor:pointer}
.vol input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;
  width:9px;height:14px;border-radius:1px;background:var(--ac);cursor:pointer;
  box-shadow:0 0 6px color-mix(in srgb,var(--ac) 60%,transparent)}
.vol input[type=range]::-moz-range-thumb{width:9px;height:14px;border-radius:1px;
  background:var(--ac);border:none;cursor:pointer}
.vol input[type=range]:focus-visible{outline:1px solid var(--ac);outline-offset:3px}
.split{display:inline-flex;position:relative}
.split .face{border-right:none}
.split .arrow{padding:6px 8px;border-left:1px solid var(--line)}
.split .menu{display:none;position:absolute;bottom:calc(100% + 4px);right:0;min-width:200px;
  background:var(--surf);border:1px solid var(--ac2);box-shadow:0 0 22px rgba(0,0,0,.7);z-index:50}
.split.open .menu{display:block}
.split .menu i{display:block;font-style:normal;padding:8px 11px;font-size:9.5px;letter-spacing:.12em;
  text-transform:uppercase;color:var(--dim);cursor:pointer;border-bottom:1px solid var(--line)}
.split .menu i:last-child{border-bottom:none}
.split .menu i:hover{background:rgba(127,127,127,.12);color:var(--ac)}
.split .menu u{display:block;text-decoration:none;padding:6px 11px;font-size:8px;letter-spacing:.14em;
  text-transform:uppercase;color:var(--dim);opacity:.7;border-bottom:1px solid var(--line)}
.log{margin-left:auto;font-size:9px;color:var(--dim);white-space:nowrap;overflow:hidden;
  text-overflow:ellipsis;max-width:44vw}
.nowline{padding:6px 12px;font-size:10.5px;background:var(--surf);border-bottom:1px solid var(--line);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;display:none}
.nowline b{color:var(--ac2)}
.app.mini .main>.strip:not(.keep),.app.mini .tri,.app.mini .side{display:none}
.app.mini .nowline{display:block}

/* slots: swap + help controls, revealed on hover */
.strip{position:relative}
.strip>u{display:flex;justify-content:space-between;align-items:center;gap:5px}
.swap,.hbtn{opacity:0;transition:opacity .15s;flex:none;cursor:pointer;border:1px solid var(--line);color:var(--dim)}
.swap{font-size:8px;letter-spacing:.1em;padding:1px 5px;white-space:nowrap}
.hbtn{font-size:9px;width:14px;height:14px;padding:0;letter-spacing:0;line-height:12px;text-align:center;border-radius:50%;cursor:help}
.strip:hover .swap,.strip:hover .hbtn,.strip:focus-within .swap,.strip:focus-within .hbtn{opacity:1}
.swap:hover,.hbtn:hover{color:var(--ac);border-color:var(--ac)}
/* FIXED, not absolute, and placed by placeMenu(). As an absolute box inside
   the cell it was clipped by .tri's overflow:hidden — on the bottom row the
   menu ran 189px past the grid and those entries were simply unreachable,
   because its own max-height:60vh was taller than the space left below the
   button so the internal scrollbar had nothing to give. Fixed positioning
   escapes the ancestor clip; there is no transform or filter on any ancestor
   to make one a containing block. The height is clamped to the real gap at
   open time rather than to a guess at the viewport. */
.pmenu{display:none;position:fixed;min-width:190px;z-index:70;background:var(--surf);
  border:1px solid var(--ac2);box-shadow:0 0 24px rgba(0,0,0,.8);overflow-y:auto;
  overscroll-behavior:contain}
.pmenu.open{display:block}
.pmenu button{display:flex;width:100%;text-align:left;justify-content:space-between;align-items:center;font-style:normal;padding:7px 10px;
  font-size:9px;letter-spacing:.1em;text-transform:uppercase;color:var(--dim);cursor:pointer;
  border-bottom:1px solid var(--line)}
.pmenu button:last-child{border-bottom:none}
.pmenu button:hover{background:rgba(127,127,127,.14);color:var(--ac)}
.pmenu button.on{color:var(--ac2);border-left:2px solid var(--ac2)}
.pmenu button b{font-weight:400;font-size:7.5px;opacity:.55;margin-left:8px}
/* Same clipping applies to the help card on the lower rows. */
.hcard{display:none;position:fixed;z-index:80;padding:10px 12px;max-height:60vh;overflow-y:auto;
  overscroll-behavior:contain;
  background:var(--surf);border:1px solid var(--ac);box-shadow:0 0 26px rgba(0,0,0,.85)}
.hcard.open{display:block}
.hcard h4{font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ac);margin:0 0 6px;font-weight:500}
.hcard p{font-size:10px;line-height:1.55;color:var(--txt);margin:0 0 8px}
.hcard a{font-size:9px;color:var(--ac2);text-decoration:none;letter-spacing:.08em}
.hcard a:hover{text-decoration:underline}
.hcard em{font-style:normal;font-size:8px;color:var(--dim);display:block;margin-top:4px}
/* manual layout override beats the aspect-ratio media queries */
.app[data-cols="1"] .tri{grid-template-columns:1fr!important}
.app[data-cols="2"] .tri{grid-template-columns:repeat(2,1fr)!important}
.app[data-cols="3"] .tri{grid-template-columns:repeat(3,1fr)!important}
.app[data-cols="5"] .tri{grid-template-columns:repeat(5,1fr)!important}
/* data-side / data-dense rules live in ONE place — the "Track list width
   and row density" block below. A byte-identical copy sat here too; with
   equal specificity the later one silently won, so an edit here did
   nothing (ultra review F5). */
/* dropdown selector used for theme / layout */
.sel{position:relative;display:inline-flex}
.sel select{min-width:118px;max-width:220px;background:var(--surf);border:1px solid var(--line);color:var(--dim);font:inherit;font-size:9px;letter-spacing:.1em;text-transform:uppercase;padding:6px 9px;border-radius:var(--rad)}
.sel>button{min-width:118px;text-align:left}
.sel>button::after{content:'\\25be';float:right;opacity:.7;margin-left:8px}
.sel .menu{display:none;position:absolute;bottom:calc(100% + 4px);left:0;min-width:180px;background:var(--surf);
  border:1px solid var(--ac2);box-shadow:0 0 22px rgba(0,0,0,.75);z-index:60;max-height:52vh;overflow:auto}
.sel.open .menu{display:block}
.sel .menu i{display:flex;justify-content:space-between;align-items:center;font-style:normal;padding:8px 11px;
  font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--dim);cursor:pointer;
  border-bottom:1px solid var(--line)}
.sel .menu i:last-child{border-bottom:none}
.sel .menu i:hover{background:rgba(127,127,127,.14);color:var(--ac)}
.sel .menu i.on{color:var(--ac2);border-left:2px solid var(--ac2)}
.sel .menu button{display:block;width:100%;text-align:left;border:0;border-bottom:1px solid var(--line);border-radius:0;
  padding:8px 11px;font-size:9.5px;letter-spacing:.12em;white-space:nowrap}
.sel .menu button:last-child{border-bottom:none}
.sel .menu button:hover{background:rgba(127,127,127,.14);color:var(--ac)}
.sw{display:inline-flex;gap:2px;margin-left:8px}
.sw s{width:9px;height:9px;text-decoration:none;border:1px solid rgba(255,255,255,.25)}

/* header glossary: quiet mouseover, with a bridge so the link stays reachable */
.kv{position:relative;cursor:help}
.kv u{border-bottom:1px dotted transparent;transition:border-color .15s}
.kv:hover u{border-bottom-color:var(--dim)}
.tip{display:none;position:absolute;top:calc(100% + 8px);left:-6px;width:290px;z-index:200;
  padding:10px 12px;background:var(--surf);border:1px solid var(--ac);
  box-shadow:0 0 26px rgba(0,0,0,.85);cursor:default;text-align:left}
.kv:hover .tip,.tip:hover{display:block}
.tip::before{content:'';position:absolute;top:-8px;left:0;right:0;height:8px}
.tip h5{margin:0 0 5px;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ac);font-weight:500}
.tip p{margin:0 0 7px;font-size:10px;line-height:1.55;color:var(--txt);letter-spacing:0;text-transform:none}
.tip a{font-size:8.5px;color:var(--ac2);text-decoration:none;letter-spacing:.06em}
.tip a:hover{text-decoration:underline}
.tip em{font-style:normal;display:block;margin-top:4px;font-size:7.5px;color:var(--dim)}
@media(max-width:720px){.tip{width:240px;left:auto;right:-6px}}

/* NOW PLAYING — the card's rules are NOT here. (No backticks in this
   comment — it sits inside the template literal; one closed it on
   2026-09-03 and the page did not boot: ledger 132.)
   A whole ".np" block used to sit at this spot, duplicating the stylesheet
   deckwave-nowplaying.js ships with itself. That sheet is appended to the
   same shadow root AFTER this one, so it won every property both declared
   and this copy decided nothing — while still being the place someone would
   naturally come to change the card, and it had already gone stale: it
   carried ".np .bar", the class the card renamed to ".npbar" precisely
   because ".bar" collided with the transport strip in this same root (the
   card's own header tells that story). Two rules were live only because the
   card's sheet did not declare them at all — padding-top and border-top
   on ".np .nx" — and those moved INTO the card's sheet rather than being
   dropped, so nothing on screen changed. Deleted 2026-09-01, review M12
   class: the card's stylesheet is the one that renders, so it is the only
   one that exists. */
/* help moved onto the panel NAME — a ? on every panel was visual noise */
.lbl{cursor:help;border-bottom:1px dotted transparent;transition:border-color .15s}
.strip:hover .lbl{border-bottom-color:var(--dim)}
.strip .lbl:hover ~ .hcard,.hcard:hover{display:block}
/* collapsible panels */
.strip.collapsed .cw{display:none}
.strip.collapsed{min-height:0!important;height:auto!important}
.fold{font-size:9px;color:var(--dim);cursor:pointer;border:1px solid var(--line);padding:0 5px;
  opacity:0;transition:opacity .15s;flex:none;line-height:13px}
.strip:hover .fold,.strip:focus-within .fold{opacity:1}
.fold:hover{color:var(--ac);border-color:var(--ac)}
/* MEGA — every panel at once. Steps down rather than shattering.
   Strips without .keep are hidden here to buy vertical room for twelve
   panels. The waveform scope and the bass onsets are both .keep: they are
   per-frame instruments you watch while mixing, not per-set summaries. The
   set arc is not, because it says the same thing all night. This mattered the
   moment auto started choosing mega — the onsets strip vanished for anyone
   who had never deliberately picked mega. */
.app[data-cols="6"] .tri{grid-template-columns:repeat(6,1fr)!important}
.app[data-cols="4"] .tri{grid-template-columns:repeat(4,1fr)!important}
.app[data-cols="mega"] .tri{grid-template-columns:repeat(6,1fr)!important;grid-auto-rows:1fr!important;overflow:hidden}
.app[data-cols="mega"] .tri>.strip{min-height:0!important}
/* auto PER KEEP STRIP, then 1fr for the panels. This read "auto 1fr" from
   when exactly one strip survived mega; giving the onsets strip .keep made
   two, so the 1fr row landed on a strip with a forced 40px height and the
   panel grid fell into an implicit content-sized row. 220px of a 714px
   window went nowhere. */
.app[data-cols="mega"] .main{grid-template-rows:auto auto 1fr!important}
.app[data-cols="mega"] .main>.strip.keep{height:clamp(40px,5vh,70px)!important}
.app[data-cols="mega"] .main>.strip:not(.keep):not(.tri){display:none}
.app[data-cols="mega"] .strip{padding:2px 5px 3px}
.app[data-cols="mega"] .strip>u{font-size:6.5px;margin-bottom:1px}
@media(max-width:1400px){.app[data-cols="mega"] .tri{grid-template-columns:repeat(4,1fr)!important}}
@media(max-width:900px){.app[data-cols="mega"] .tri{grid-template-columns:repeat(3,1fr)!important}}

/* ── steering popup ────────────────────────────────────────────────────
   Click any track in the set list to open it. The whole routing engine
   (DWNAV, patches 07/09/10) shipped in the package; this popup did not, so
   the only way to reach it was the console. Row clicks jumped straight to
   the track instead, which is the one option the engine considers least
   interesting. */
/* :host, not #deckwave: this stylesheet lives INSIDE the shadow root, and
   a selector in a shadow root cannot reach the host by id — the outline
   never rendered while the drop itself worked (ultra review F3) */
:host(.dropping) .app{outline:2px dashed var(--ac);outline-offset:-6px}
.navpop{display:none;position:fixed;z-index:9998;width:min(420px,86vw);
  background:var(--surf);border:1px solid var(--ac);box-shadow:0 0 34px rgba(0,0,0,.92);
  padding:9px;font-size:10px;line-height:1.5;letter-spacing:0;text-transform:none;
  color:var(--txt);max-height:70vh;overflow-y:auto}
.navpop.on{display:block}
/* collapsible by the window frame (keeper, 2026-08-21): a tap on the h6
   title bar folds the popup to just that bar; the ▾/▴ hint is CSS so every
   innerHTML rebuild keeps it for free */
.navpop>h6{cursor:pointer}
.navpop>h6::after{content:' ▾';opacity:.6;letter-spacing:0}
.navpop.min>h6::after{content:' ▴'}
.navpop.min>h6{margin:0}
.navpop.min>:not(h6){display:none}
.navpop>h6{margin:0 0 7px;font-size:9px;letter-spacing:.16em;text-transform:uppercase;
  color:var(--ac2);font-weight:400}
.navpop .opt{display:block;padding:7px 9px;margin-bottom:5px;cursor:pointer;
  border:1px solid var(--line);background:rgba(0,0,0,.25)}
.navpop .opt:hover{border-color:var(--ac)}
.navpop .opt b{display:block;color:var(--ac);font-weight:400;margin-bottom:2px}
.navpop .opt i{display:block;font-style:normal;color:var(--dim);font-size:9px}
.navpop .opt.good b{color:var(--good,#3ee68a)}
.navpop .opt.warn b{color:var(--bad)}
.navpop .opt.dead{opacity:.5;cursor:not-allowed}
.navpop .route{display:block;margin-top:4px;color:var(--dim);font-size:8.5px;
  letter-spacing:.05em;word-break:break-word}
.list .tr.queued{outline:1px solid var(--ac2);outline-offset:-1px}

/* Track list width and row density. Recovered from the live build, which had
   both and the packaged one had neither. Values exactly as they were there. */
.app[data-side="hide"] .side{display:none}
.app[data-side="hide"]{grid-template-columns:1fr!important}
.app[data-side="wide"]{grid-template-columns:1fr minmax(360px,30vw)!important}
.app[data-dense="1"] .tri>.strip{min-height:90px}
.app[data-dense="1"] .strip{padding:3px 6px 4px}
.app[data-dense="1"] .tr{padding:2px 8px;font-size:9px}

/* glossary: hover any term. One popup, repositioned, not one per term. */
.gl{border-bottom:1px dotted currentColor;cursor:help;opacity:.95}
.glpop{display:none;position:fixed;z-index:9999;width:min(300px,80vw);padding:10px 12px;
  background:var(--surf);border:1px solid var(--ac);box-shadow:0 0 28px rgba(0,0,0,.9);
  font-size:10px;line-height:1.55;letter-spacing:0;text-transform:none;text-align:left;color:var(--txt)}
.glpop.on{display:block}
.glpop h5{margin:0 0 5px;font-size:9.5px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--ac);font-weight:500}
.glpop a{display:block;margin-top:7px;font-size:8.5px;color:var(--ac2);text-decoration:none}
.glpop a:hover{text-decoration:underline}
.glpop em{font-style:normal;display:block;margin-top:3px;font-size:7.5px;color:var(--dim)}
@media(prefers-reduced-motion:reduce){*{animation:none!important}}

/* ── PHONE ───────────────────────────────────────────────────────────────
   Keeper, on an iPhone 16 Pro Max, 2026-08-19: "the screen is not optimized
   for the real estate I have." It was the desktop grid squeezed to one
   column: three fixed strips eating a third of the height, the track list
   and the now-playing card collapsed to nothing, a five-row transport, and
   the LOG LINE — the only readout of a running scan — pushed under Safari's
   toolbar because the app was sized to 100vh, which on iOS includes it.

   Two screens instead of one cramped one: the PANELS, or the SET (track list
   + now-playing card), toggled by a phone-only button. The log line sits at
   the TOP of the transport, full width, in the accent colour. The files and
   capture groups fold behind ⚙ display along with cfg. Tap targets grow.
   Nothing here changes what any panel draws. */
button.phl{display:none}
@media(max-width:720px){
  .app{height:100dvh;grid-template-rows:auto 1fr auto}
  .main>.strip.keep,.main>.strip:has(#cArc){display:none}
  .tri>.strip{min-height:44vh}
  .side{display:none;border-left:0}
  .app.ph-list .main{display:none}
  .app.ph-list .side{display:flex;min-height:0}
  .tr{padding:9px 10px;font-size:12px}
  .tr i,.tr em{font-size:10px}
  .bar{gap:10px;padding:8px 10px}
  .kv u{font-size:8px} .kv b{font-size:13px}
  .tp{padding:8px 8px calc(8px + env(safe-area-inset-bottom));gap:6px}
  .tp button{font-size:11px;padding:10px 12px;letter-spacing:.1em}
  .tp .sep{display:none}
  .log{order:-1;flex-basis:100%;max-width:none;margin-left:0;white-space:normal;
    font-size:12px;line-height:1.35;color:var(--ac);padding:0 2px 4px}
  .tp [data-grp="files"],.tp [data-grp="capture"]{display:none}
  .tp.cfg-open [data-grp="files"],.tp.cfg-open [data-grp="capture"]{display:inline-block}
  button.phl{display:inline-block}
  .tp [data-ph="cfg"]{display:none}
  .tp.cfg-open [data-ph="cfg"]{display:inline-block}
  .vol input[type=range]{width:120px}
  .vol u{min-width:0}
}
`;

/* ── the status line does not keep a countdown it can no longer keep ─────
   THE KEEPER SAW IT ON SCREEN, 2026-08-29: choose a new target from the set
   list and the line reads `blending in 1.5s · TRACK` — and goes on reading
   it. A second and a half later the sentence is false; a minute later it
   names a handover that already happened; after a second choice, one that
   never will. A one-slot status line holding a claim about the FUTURE is
   ledger 87's class exactly — a frozen display that cannot tell it is stale.

   So the number LIVES while the blend is pending and the line states what
   HAPPENED once it is not. The clock is `DW.blend.in`, the deck's own
   schedule, which is the only honest source: chain() snaps the exit to a
   downbeat and blendNow() rewrites it outright, so anything re-derived from
   track length is wrong twice (that accessor's own comment says so). Only
   `in Ns` is re-rendered — `over 16s` is the crossfade length and does not
   decay — and the resolved line carries no number at all, so it cannot go
   stale a second time.

   Nothing in the Player changes. A returned string is a snapshot by nature
   and was right at the instant it was made; it was the DISPLAY that kept it
   past its moment. Same lesson as ledgers 33 and 40: when a component can
   READ the deck, do not let it hold a copy.

   A factory, and the interval lives outside it, so the harness can drive
   step() with a fake deck and no timers. */
function makeStatusLine(getDW) {
  const COUNTDOWN = /\bin \d+(?:\.\d+)?s/;
  let cur = null;                       /* { el, meta, text } while pending */
  const nm = m => String((m && m.name) || '').slice(-30);
  function step() {
    const c = cur; if (!c) return;
    if (c.el.isConnected === false) { cur = null; return; }
    const DW = getDW();
    if (!DW) { cur = null; return; }
    if (DW.nowMeta === c.meta) {                    /* it landed */
      cur = null; c.el.textContent = 'blended into ' + nm(c.meta); return;
    }
    const b = DW.blend;
    if (DW.nextMeta !== c.meta || !b) {             /* replaced, or the deck stopped */
      cur = null;
      c.el.textContent = nm(c.meta) + ' — that blend is no longer scheduled';
      return;
    }
    c.el.textContent = c.text.replace(COUNTDOWN, 'in ' + Math.max(0, b.in).toFixed(1) + 's');
  }
  return {
    /* every write to #logLine in this file comes through here. A message
       carrying a countdown AND matching a blend the deck really has
       scheduled starts ticking; every other message is a plain line and
       cancels the tick, so a later log always owns the slot. */
    set(el, m) {
      m = String(m);
      if (el) el.textContent = m;
      const DW = getDW();
      cur = (el && COUNTDOWN.test(m) && DW && DW.nextMeta && DW.blend)
        ? { el, meta: DW.nextMeta, text: m } : null;
    },
    step,
    get pending() { return cur ? cur.meta : null; }
  };
}
const STATUS = makeStatusLine(() => window.DW);
setInterval(() => STATUS.step(), 120);

/* A prepared set is an intention. Only a successful player operation makes
   it the current set. Async completion may consume only its own candidate. */
function makeSetSession(getDW, getNav) {
  let committed = [], prepared = null;
  const same = (a, b) => a === b || (a.id && b.id && a.id === b.id);
  const consume = candidate => { if (prepared === candidate) prepared = null; };
  return {
    get current() { const dw = getDW(); return dw.nowMeta ? dw.playOrder : committed; },
    get prepared() { return prepared; },
    prepare(seq) { if (!Array.isArray(seq) || !seq.length) throw Error('no tracks to prepare'); prepared = seq; },
    discard() { prepared = null; },
    adopt(seq) {
      const dw = getDW();
      if (dw.nowMeta && dw.playOrder !== seq) throw Error('prepare this set before applying it');
      committed = seq;
    },
    async play() {
      const dw = getDW(), candidate = prepared;
      if (dw.nowMeta) throw Error('a set is playing — use Apply remaining');
      if (!candidate) throw Error('prepare a set first');
      const result = await dw.play(candidate, 0);
      if (result !== 'superseded' && dw.playOrder === candidate) { committed = candidate; consume(candidate); }
      return result;
    },
    async apply() {
      const dw = getDW(), candidate = prepared, nav = getNav();
      if (!candidate) throw Error('prepare a set first');
      if (!dw.nowMeta) throw Error('the deck is stopped — use Play prepared');
      const idx = dw.state.idx, prefix = dw.playOrder.slice(0, idx + 1);
      if (prefix[idx] !== dw.nowMeta) throw Error('playing order changed — apply again');
      const tail = candidate.filter(t => !prefix.some(p => same(t, p))).map(t => ({ ...t }));
      if (!tail.length) throw Error('no unplayed tracks remain in the prepared set');
      /* Reuse the routing gate and its straight-play policy, from the tempo
         that survives cancellation of the old pending deck. */
      const next = nav.resequenceTail(prefix.concat(tail), idx, dw.planningTempo).set;
      for (const key of ['mode', 'poolSize', 'leftOut', 'phrase']) if (candidate[key] !== undefined) next[key] = candidate[key];
      const failures = next.slice(idx + 1).filter(t => !dw.LIB.find(t))
        .map(t => ({ name: t.name, stage: 'apply', message: 'file missing or ambiguous — reopen its library' }));
      if (failures.length) { const e = Error('prepared set has missing files'); e.failures = failures; throw e; }
      const result = await dw.reorder(next, { phrase: !!candidate.phrase });
      if (/^refused/.test(result)) throw Error(result);
      if (dw.playOrder !== next) return 'superseded — playing order changed';
      committed = next; consume(candidate);
      return 'applied remaining · ' + result;
    }
  };
}

function mount(hostEl) {
  const host = document.createElement('div');
  host.id = 'deckwave';
  host.style.cssText = 'position:fixed;inset:0;z-index:2147483647';
  (hostEl || document.body).appendChild(host);
  const sr = host.attachShadow({ mode: 'open' });
  const st = document.createElement('style'); st.textContent = CSS; sr.appendChild(st);
  const $ = id => sr.getElementById(id);

  const app = document.createElement('div'); app.className = 'app';
  app.innerHTML = `
   <div class="bar" part="header"><h1>DECKWAVE.FM</h1>
     ${[['track','kPos'],['tempo','kBpm'],['key','kKey'],['stretch','kStr'],
        ['bass hits','kHit'],['register','kReg']]
        .map(([l,i]) => `<div class="kv"><u>${l}</u><b id="${i}">-</b></div>`).join('')}
     <div class="lk">
       <!-- Two links, not four, since 2026-10-09 (UI review, Part 5 decision 4).
            The channel and Bandcamp links went: promotional, and the review
            found them sharing the ▶ glyph with play. These two stay because
            they are the project's ONLY traffic instrument (Act 48) — this page
            counts nobody, and a like or a landing on GitHub is counted there. -->
       <a href="https://www.youtube.com/watch?v=qoulzN1mLyw" target="_blank" rel="noopener"
          title="Enjoying it? Like the launch video. This page counts nothing and never will — a like on YouTube is the only way we can tell anyone is listening.">&#9829; like</a>
       <a href="https://github.com/waypostmaster/deckwave" target="_blank" rel="noopener"
          title="The source, and a star if you liked it. Landing there counts even if you do nothing and have no account — which is the point: this page will never count you itself.">&#9733; source</a>
     </div>
   </div>
   <div class="nowline" id="nowline"></div>
   <div class="main">
     <div class="strip keep" style="height:clamp(70px,11vh,130px)"><u>waveform · scope</u>
       <div class="cw"><canvas id="cScope" part="scope"></canvas></div></div>
     <div class="strip keep" style="height:clamp(54px,8vh,96px)"><u>bass onsets · spectral flux · last 8s</u>
       <div class="cw"><canvas id="cPunch" part="punchcard"></canvas></div></div>
     <div class="tri" id="tri">
       ${[['spectrum','cSpec'],['pitch classes','cChroma'],['camelot · harmonic path','cCam'],
          ['goniometer · stereo field','cGonio'],['vu · 300ms ballistics','cVU']]
          .map(([l,i]) => `<div class="strip"><u>${l}</u><div class="cw"><canvas id="${i}" part="${i}"></canvas></div></div>`).join('')}
     </div>
     <!-- data-gl: this label carries the word "energy" and was the ONE place
          it appeared on screen with no hover saying CONSTRUCTED (45% loudness,
          25% brightness, 30% tempo — weights chosen, not fitted). Every panel
          label is tagged by glossaryBind's PANEL map; a fixed strip has no
          slot, so it is tagged here by hand. bind() picks up any [data-gl]
          in the shadow root, so nothing else is needed. -->
     <div class="strip" style="height:clamp(60px,9vh,110px)"><u data-gl="energy">set arc · energy + tempo across the whole night</u>
       <div class="cw"><canvas id="cArc" part="arc"></canvas></div></div>
   </div>
   <div class="side"><u id="sideHd">set · stopped</u><div class="list" id="list"></div>
     <section class="prepared" id="prepared" hidden aria-label="Prepared set">
       <h2 id="preparedHd">Prepared set</h2><p id="preparedNote"></p>
       <div class="prepareActions"><button id="applyPrepared">Apply remaining</button><button id="discardPrepared">Discard</button></div>
       <ol class="prepareList" id="preparedList"></ol>
     </section>
   </div>
   <div class="tp" id="tp"><span class="log" id="logLine">ready</span>
     <details class="issues" id="issues" hidden><summary id="issueCount">Issues</summary><ol id="issueList"></ol><button id="clearIssues">Clear issues</button></details>
     <span class="srOnly" id="announcement" role="status" aria-live="polite" aria-atomic="true"></span>
   </div>`;
  sr.appendChild(app);

  /* ── canvases ─────────────────────────────────────────────────────── */
  const C = {}, X = {};
  ['cScope','cPunch','cSpec','cChroma','cCam','cGonio','cVU','cArc']
    .forEach(k => { C[k] = $(k); X[k] = C[k].getContext('2d'); });

  /* iterate the LIVE map — a captured array leaves later canvases unsized */
  function fit() {
    const d = window.devicePixelRatio || 1;
    Object.keys(C).forEach(k => {
      const c = C[k]; if (!c) return;
      const r = c.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) return;
      const w = Math.round(r.width * d), h = Math.round(r.height * d);
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
      X[k].setTransform(d, 0, 0, d, 0, 0);
    });
  }
  fit();
  let fitT;
  const ro = new ResizeObserver(() => { clearTimeout(fitT); fitT = setTimeout(fit, 60); });
  ro.observe(host); ro.observe($('tri'));
  [...$('tri').children].forEach(c => ro.observe(c));
  addEventListener('resize', () => { clearTimeout(fitT); fitT = setTimeout(fit, 60); });

  const css = k => getComputedStyle(host).getPropertyValue(k).trim();
  const g = (c, col, b) => { const s = parseFloat(css('--glow')); c.shadowBlur = b * (isNaN(s) ? 1 : s); c.shadowColor = col; };
  const W = k => C[k].getBoundingClientRect().width;
  const H = k => C[k].getBoundingClientRect().height;
  const RC = window.DWREGISTER;
  const col = (l, a) => (RC && RC.col(l, a)) || null;

  /* ── state ────────────────────────────────────────────────────────── */
  /* The analyser buffers, the flux history and the hit ring used to live here
     as well, feeding an inline loop() that DWLOOP replaced at mount and that
     index.html's boot gate made unreachable. They were second copies of
     DWLOOP's own — and carried second copies of five panels' calibrated
     numbers with them. Deleted 2026-09-01 (review M12): one number, one
     place. DWLOOP owns the measuring half; DWPANELS owns the drawing. */
  let set = [], deckL = null, deckR = null;
  const sets = makeSetSession(() => window.DW, () => window.DWNAV);
  const announce = text => { $('announcement').textContent = text; };
  const issueKeys = new Set();
  function reportIssue(error, stage) {
    const before = issueKeys.size;
    const failures = error.failures || [{ name: '', stage: stage || 'action', message: String(error.message || error) }];
    for (const f of failures) {
      const text = [f.stage || stage, f.name, f.message || f.reason].filter(Boolean).join(' · ');
      if (issueKeys.has(text)) continue;
      issueKeys.add(text);
      const li = document.createElement('li'); li.textContent = text; $('issueList').appendChild(li);
    }
    if (before === issueKeys.size) return;
    $('issues').hidden = !issueKeys.size;
    $('issueCount').textContent = 'Issues · ' + issueKeys.size;
    announce('Issues · ' + issueKeys.size + '. Open Issues for file names and reasons.');
  }
  $('clearIssues').onclick = () => { issueKeys.clear(); if (window.DW.clearIssues) window.DW.clearIssues(); $('issueList').textContent = ''; $('issues').hidden = true; announce('Issues cleared'); $('tp').querySelector('button[data-grp="play"]:not(.phl)')?.focus(); };
  let paintedPrepared = null;
  function renderPrepared() {
    const candidate = sets.prepared, active = !!window.DW.nowMeta;
    const target = candidate ? 'prepared' : 'set';
    for (const [action, text] of [['save', '▾ save ' + target], ['audit', '◎ audit ' + target], ['render', '⤓ render ' + (candidate ? 'prepared ' : '') + 'flac']]) {
      const button = sr.querySelector('[data-set-action="' + action + '"]');
      if (button) button.textContent = text;
    }
    $('prepared').hidden = !candidate;
    $('applyPrepared').textContent = active ? 'Apply remaining' : 'Play prepared';
    $('preparedNote').textContent = active
      ? 'Keeps this track and played history. Replans the remaining prepared tracks from the current tempo; some may play straight.'
      : 'Ready to play. Your current set is kept until playback starts.';
    if (candidate !== paintedPrepared) {
      paintedPrepared = candidate;
      $('preparedHd').textContent = 'Prepared set · ' + (candidate ? candidate.length : 0) + (candidate && candidate.length === 1 ? ' track' : ' tracks');
      $('preparedList').innerHTML = (candidate || []).map(t => '<li>' + esc(t.name) + '</li>').join('');
    }
  }
  $('applyPrepared').onclick = async () => {
    const b = $('applyPrepared'); if (b.disabled) return; b.disabled = true;
    try {
      if (!window.DW.nowMeta && window.DWPHONE && window.DWPHONE.armCalls) window.DWPHONE.armCalls();
      const result = await (window.DW.nowMeta ? sets.apply() : sets.play());
      set = sets.current; log(result); announce(result); renderList();
      if (!sets.prepared) $('list').querySelector('button')?.focus();
    } catch (e) { reportIssue(e, 'prepared set'); log(e.message); }
    finally { b.disabled = false; renderPrepared(); if (sets.prepared && !sr.activeElement && (document.activeElement === host || document.activeElement === document.body)) b.focus(); }
  };
  $('discardPrepared').onclick = () => { sets.discard(); renderPrepared(); announce('Prepared set discarded');
    ($('list').querySelector('button') || [...$('tp').querySelectorAll('button')].find(b => b.textContent.startsWith('build set')))?.focus(); };

  /* split the deck's own analyser — a pass-through, so this is always available */
  function splitDeck() {
    const an = window.DW && window.DW.Player.analyser; if (!an) return false;
    /* kill → ▶ play closes the context and boots a fresh analyser; a split
       made on the old context stays wired to a closed graph forever and the
       goniometer and VU go dark. Re-split whenever the analyser is not the
       one we split. */
    if (deckL && deckL.context === an.context && deckL._src === an) return false;
    deckL = null; deckR = null;
    const ctx = an.context, sp = ctx.createChannelSplitter(2);
    deckL = ctx.createAnalyser(); deckL.fftSize = 2048;
    deckR = ctx.createAnalyser(); deckR.fftSize = 2048;
    an.connect(sp); sp.connect(deckL, 0); sp.connect(deckR, 1);
    const sink = ctx.createGain(); sink.gain.value = 0;
    deckL.connect(sink); deckR.connect(sink); sink.connect(ctx.destination);
    deckL._src = an;
    return true;
  }
  function stereoSource() {
    const L = window.DWLISTEN;
    if (L && L.active && L.L && L.R) return { L: L.L, R: L.R, src: 'listen' };
    /* Try the split HERE rather than relying on someone else to have done it.
       splitDeck() was only ever called from the inline loop() that used to
       sit below (deleted 2026-09-01) and that DWLOOP replaced at mount, so
       nothing called it — it never ran, deckL/deckR were never
       created, and this returned null on every frame. That took the
       goniometer and the VU meters with it, because DWVU.feed() sits inside
       the loop's `if (stereo)` branch: feed never called, needles frozen.
       Which is Act 14's bug arriving by a different road. Cheap to retry:
       it returns false immediately once done, or while there is no deck. */
    if (!deckL) splitDeck();
    if (deckL && deckR) return { L: deckL, R: deckR, src: 'deck' };
    return null;
  }

  /* The spectral-flux onset detector used to be duplicated here. The live one
     is in deckwave-loop.js's sample() and its numbers (the 10 low bins, the
     /2550 scale, ×2.0 + 0.004 over the running mean, the 300 ms refractory,
     the 43-frame history) are calibrated. This copy was never called after
     DWLOOP took the loop; it is gone rather than kept in step by hand. */

  /* ── panels ───────────────────────────────────────────────────────── */
  const P = {
    /* wv is passed in by drawFixed from the render loop's bundle. It used to
       fall back to a mount-scope `wave` that only the dead inline loop() ever
       filled, which is what made this strip a permanent flat line; the buffer
       and the fallback are both gone. No signal means the flat line, drawn on
       purpose. */
    scope(c, w, h, T, wv) { c.fillStyle = T.bg; c.fillRect(0, 0, w, h);
      const W8 = wv;
      if (!W8) { c.strokeStyle = T.line; c.beginPath(); c.moveTo(0, h/2); c.lineTo(w, h/2); c.stroke(); return; }
      const k = col(62) || T.ac; c.strokeStyle = k; c.lineWidth = 1.5; g(c, k, 9); c.beginPath();
      const s = W8.length / w;
      for (let x = 0; x < w; x++) { const v = (W8[Math.floor(x*s)]-128)/128;
        const y = h/2 + v*(h/2-3); x ? c.lineTo(x,y) : c.moveTo(x,y); }
      c.stroke(); c.shadowBlur = 0; },

    /* hs likewise comes from the loop's bundle; the dashboard's own `hits`
       array was empty from the day DWLOOP started keeping its own, and is
       deleted rather than left as a fallback that could only ever draw
       nothing. */
    punch(c, w, h, T, fx, now, hs) { c.fillStyle = T.bg; c.fillRect(0, 0, w, h);
      c.strokeStyle = T.line; c.lineWidth = 1;
      for (let i = 1; i < 8; i++) { const x = w*i/8; c.beginPath(); c.moveTo(x,0); c.lineTo(x,h); c.stroke(); }
      c.fillStyle = col(55,.45) || 'rgba(34,232,255,.45)';
      c.fillRect(0, h-2-Math.min(h-4, fx*500), w, 2);
      (hs || []).forEach(p => { const x = w - ((now-p.t)/8000)*w, r = 3 + p.v*(h*.14);
        const k = col(60) || T.ac2; c.fillStyle = k; g(c, k, 13);
        c.beginPath(); c.arc(x, h/2, r, 0, 7); c.fill(); });
      c.shadowBlur = 0; },

    /* spec / chroma / cam / gonio / vu USED TO SIT HERE — five whole panels,
       duplicating the registered ones in deckwave-panels.js down to their
       calibrated numbers: the chromagram's .12 and .6 visibility thresholds
       and its 55–5000 Hz band, the Camelot wheel's .85 and .45 score tiers,
       the goniometer's 900-point decimation, the VU sweep. Only the dead
       inline loop() ever called them, so for the life of the file the screen
       drew the registered copies and a second set of the same constants sat
       here waiting to drift. Deleted 2026-09-01 (review M12). The live
       numbers in deckwave-panels.js were not touched. */

    arc(c, w, h, T) { c.fillStyle = T.bg; c.fillRect(0, 0, w, h);
      if (!set.length) { c.strokeStyle = T.line; c.beginPath(); c.moveTo(0,h/2); c.lineTo(w,h/2); c.stroke(); return; }
      const n = set.length, pad = 3, eY = v => h - pad - v*(h-pad*2);
      const bs = set.map(t => t.bpm), bmin = Math.min(...bs), bmax = Math.max(...bs);
      c.strokeStyle = 'rgba(125,110,176,.45)'; c.lineWidth = 1; c.beginPath();
      set.forEach((t,i) => { const x = (i/(n-1))*w,
        y = h-pad-((t.bpm-bmin)/(bmax-bmin||1))*(h-pad*2); i ? c.lineTo(x,y) : c.moveTo(x,y); });
      c.stroke();
      const gr = c.createLinearGradient(0,0,w,0);
      gr.addColorStop(0, col(70)||T.ac); gr.addColorStop(1, col(56)||T.ac2);
      c.strokeStyle = gr; c.lineWidth = 2; g(c, col(56)||T.ac2, 8); c.beginPath();
      set.forEach((t,i) => { const x = (i/(n-1))*w, y = eY(t.energy); i ? c.lineTo(x,y) : c.moveTo(x,y); });
      c.stroke(); c.shadowBlur = 0;
      /* Mark the DECK's track, found by identity. The index alone threw
         here when a shorter set was built or loaded while idx sat beyond
         its end — and this strip draws before the slots, with no try/catch
         around it in the loop, so one throw took the header, every panel
         and the now-playing card with it on every frame after. */
      const s = window.DW.state, nm = window.DW.nowMeta;
      const ci = nm ? set.indexOf(nm) : s.idx;
      if (s.of && ci > -1 && ci < n) { const x = (ci/(n-1))*w, k = col(58)||T.ac2;
        c.strokeStyle = k; c.lineWidth = 2; g(c, k, 12);
        c.beginPath(); c.moveTo(x,0); c.lineTo(x,h); c.stroke(); c.shadowBlur = 0;
        c.fillStyle = k; c.beginPath(); c.arc(x, eY(set[ci].energy), 4, 0, 7); c.fill(); }
      c.fillStyle = T.dim; c.font = '8px '+css('--fn');
      c.textAlign = 'left'; c.fillText('energy', 4, 10);
      c.textAlign = 'right'; c.fillText(Math.round(bmin)+'-'+Math.round(bmax)+' bpm', w-4, 10); }
  };

  /* ── the loop is NOT here ─────────────────────────────────────────────
     It is deckwave-loop.js (DWLOOP), which owns the analyser buffers, the
     flux/hit state, the VU feed and the per-frame bundle. An inline loop()
     used to sit at this spot as a "fallback", reachable only if DWLOOP were
     missing — and index.html's boot gate refuses to mount without DWLOOP,
     so it was unreachable by construction. It carried its own copies of the
     onset detector and of five panels' calibrated numbers, which is the one
     thing this project cannot afford twice. Deleted 2026-09-01, review M12;
     mount() now refuses rather than silently drawing a second engine. */

  function head(nHits) {
    /* The DECK first, the list index second — ledger 33 and 40. And the
       deck's RATE, not the plan's `_stretch`: the two agree only while the
       set plays exactly as planned. After next ▶ or a jump the deck runs at
       ×1.000 whatever the row says; after a forced blend it runs at the
       forced figure; under a settle ramp it moves. `_stretch` is 1 for a
       track played STRAIGHT, and 1 is truthy, so this header printed 0.0%
       against exactly the tracks CLAUDE.md says must never show one. */
    const s = window.DW.state, dk = window.DW.deck;
    const t = (dk && dk.meta) || set[s.idx];
    const pos = t ? set.indexOf(t) : -1;
    $('kPos').textContent = s.of ? (((pos > -1 ? pos : s.idx)+1)+'/'+(set.length || s.of)) : '-';
    $('kBpm').textContent = s.tempo || '-';
    $('kKey').textContent = t ? t.camelot : '-';
    $('kKey').className = 'p';
    let str = '-', warn = false;
    if (t && t._unlocked) str = '∿';
    /* AN UNMATCHED DECK: nothing to match against, so there is no stretch to
       print. Ledger 82 caught `+0.00%` reading as the tightest beatmatch on
       screen and fixed it in RECON; the three base surfaces kept printing it,
       on step 1 of every set. The predicate WAS `idx === 0 && rate === 1`,
       which is a guess — true of the first deck and false of every other deck
       play() builds, so a jump to row 7 printed `+0.0%` here. Since
       2026-09-01 the engine stamps the fact (makeDeck's `origin`) and this
       reads it. */
    else if (dk && dk.origin === 'play') str = '∿';
    else if (dk) { str = (dk.stretchPct >= 0 ? '+' : '') + dk.stretchPct.toFixed(1) + '%'; warn = Math.abs(dk.rate - 1) > .08; }
    /* …and the PLAN fallback needs the same guard as the deck branch above.
       With nothing on a deck this is where the header lands, and `_stretch`
       is 1 for the first track by construction — so a stopped, freshly built
       set showed `STRETCH 0.0%` in the header while the card beside it
       correctly showed `-`. Found by LOOKING at the page on 2026-08-31: the
       harness's forbidden-figure filter runs over canvas panels via
       fillText, and the header is DOM, so nothing covered it. */
    else if (t && s.idx === 0) str = '∿';
    else if (t && t._stretch) { str = (((t._stretch-1)*100).toFixed(1)+'%'); warn = Math.abs(t._stretch-1) > .08; }
    $('kStr').textContent = str;
    $('kStr').className = warn ? 'w' : '';
    $('kStr').title = t && t._unlocked ? 'played straight — not beatmatched, so there is no stretch to print'
                    : (dk && dk.origin === 'play') ? (s.idx === 0
                        ? 'first deck — the set has no predecessor here, so there is nothing to match and no stretch to print'
                        : 'jumped to — this deck was started, not mixed into, so there is nothing to match and no stretch to print')
                    : (dk && dk.settling ? 'settling to ×1.000 · ' + Math.round(dk.settleLeft) + 's' : '');
    $('kHit').textContent = nHits; $('kHit').className = 'g';
    /* COMPACT LINE, written only when it CHANGES and only when it is shown.
       The guard used to be `nl.style.display !== 'none'` — but that inline
       style is the empty string until compact is pressed once, and the
       stylesheet is what hides the line, so the test was true on a page that
       has never been in compact mode and this innerHTML ran 60×/s against a
       hidden element for the life of the session. Ledger 94/124's shape (an
       innerHTML write per frame), here costing only work; the same cure
       applies: ask the layout whether the line is shown, and key the write
       on the string. */
    const nl = $('nowline');
    if (nl && t && app.classList.contains('mini')) {
      const line = '<b>'+((pos > -1 ? pos : s.idx)+1)+'/'+(set.length || s.of)+'</b> '+esc(clean(t.name).slice(0,44))
        +' · '+Math.round(t.bpm)+' · '+esc(t.camelot);
      if (line !== nl.__dwLine) { nl.__dwLine = line; nl.innerHTML = line; }
    }
  }

  /* SPACED separator, and the track-number strip needs real whitespace after
     the digits. Both halves ate real title characters: `[^-]+-\s*` took the
     `8-` out of `8-Bit Warrior`, and `\d+\s*` then took a bare leading digit
     off whatever survived. The ultra review flagged only the card's copy and
     called this one safe (it is not — it fails by a different route), and
     the card's fix was itself incomplete until the harness RAN it. Ledger
     104. `LukHash - GLITCH - 02 DOOMSDAY` still comes back `DOOMSDAY`. */
  const clean = n => n.replace(/^LukHash\s*-\s*/i,'').replace(/^[^-]+ - /,'').replace(/^\d+\s+/,'');

  function renderList() {
    set = sets.current;
    const focused = $('list').contains(sr.activeElement) ? sr.activeElement : null;
    const focusedMeta = focused && focused.trackMeta;
    /* ── which row is playing: ask the deck, then fall back to the index ──
       Highlighting purely by `state.idx` means the list marks whatever
       happens to sit at that index in ITS array — which is only the playing
       track while the two arrays agree. When they stop agreeing the list
       confidently points at the wrong row, which is what the keeper saw:
       *"we are not on demoscene right now"*. Identity first; the index is
       the fallback for before playback starts. Ledger 33 and 40. */
    const nm = window.DW.nowMeta;
    const byId = nm ? set.indexOf(nm) : -1;
    const cur = byId;
    $('sideHd').textContent = (nm ? 'Playing set' : 'Set · stopped') + ' · ' + set.length + ' tracks'
      + (nm && byId < 0 ? ' · ⚠ playing a track that is not in this list' : '');
    $('list').innerHTML = set.map((t,i) => {
      const cls = cur < 0 ? '' : i === cur ? 'now' : (i === cur+1 ? 'next' : (i < cur ? 'done' : ''));
      /* A track that is NOT being beatmatched should say so in the list.
         Silently mixing it in would put the honesty in the code comments and
         nowhere the listener can see it. */
      const free = t._unlocked
        ? (t._unlockReason === 'reach' ? ' title="played straight — out of stretch reach"'
                                       : ' title="played straight — beat grid disagrees with its tempo"')
        : '';
      return `<button type="button" class="tr ${cls}${t._unlocked ? ' free' : ''}" data-i="${i}" aria-label="${esc(t.name)} · track actions"${i === cur ? ' aria-current="true"' : ''}${free}>`
           + `<i>${String(i+1).padStart(3,'0')}</i>`
           + `<s>${esc(clean(t.name).slice(0,46))}</s>`
           + `<em>${t._unlocked ? '∿ ' : ''}${Math.round(t.bpm)} ${esc(t.camelot)}</em></button>`;
    }).join('');
    /* A row click opens the steering menu rather than jumping. Jumping is
       still there — it is one of the options — but it is the least
       interesting thing the router can do, and making it the only thing is
       what hid the whole feature. */
    $('list').querySelectorAll('.tr').forEach(el => {
      el.trackMeta = set[+el.dataset.i];
      el.onclick = e => { e.stopPropagation(); openNav(el, +el.dataset.i); };
    });
    markQueued();
    renderPrepared();
    if (focused) $('list').querySelector('[data-i="' + Math.max(0, set.findIndex(t => t === focusedMeta || (t.id && focusedMeta && t.id === focusedMeta.id))) + '"]')?.focus({ preventScroll: true });
    const n = $('list').querySelector('.now');
    if (n && !focused) n.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  /* ── steering ─────────────────────────────────────────────────────────
     DWNAV, and patches 09 and 10 on top of it, shipped in the package with
     no way to reach them. optionsFull() already returns exactly the menu a
     UI needs — next / force / route / fast / jump / back — so this renders
     that and calls commitAndRepair, which splices the route into the set and
     re-plans the tail from where the detour actually leaves the tempo. */
  /* ── drop ──────────────────────────────────────────────────────────────
     A single drop can carry SEVERAL folders and loose files together, which
     is the only way to choose more than one folder in one gesture —
     showDirectoryPicker returns exactly one. Everything lands in the same
     additive ingest as the buttons. */
  host.addEventListener('dragover', e => { e.preventDefault(); host.classList.add('dropping'); });
  host.addEventListener('dragleave', e => {
    if (e.relatedTarget && host.contains(e.relatedTarget)) return;
    host.classList.remove('dropping');
  });
  host.addEventListener('drop', async e => {
    e.preventDefault(); host.classList.remove('dropping');
    const l = m => STATUS.set(sr.getElementById('logLine'), m);
    l('reading drop…');
    try {
      const r = await window.DW.addDropped(e.dataTransfer,
        (i, n, nm) => l(i + '/' + n + ' ' + nm.slice(0, 40)));
      if (r.failures && r.failures.length) reportIssue(r, 'drop');
      l(r.added + ' added · ' + r.corpus + ' in corpus'
        + (r.duplicates ? ' · ' + r.duplicates + ' already had' : '')
        + (r.failed ? ' · ' + r.failed + ' failed' : '')
        + (r.uncached ? ' · ' + r.uncached + ' not cached (storage refused — re-analysed next load)' : ''));
    } catch (err) { reportIssue(err, 'drop'); l(String((err && err.message) || err)); }
  });

  /* buildTransport has its own log(); mount lost one when the inline
     transport was removed, and the steering menu needs to report. */
  const log = m => STATUS.set($('logLine'), m);

  const navpop = document.createElement('div');
  navpop.className = 'navpop'; navpop.id = 'navpop';
  /* the h6 is the popup's frame: tapping it folds the body away and back
     (delegated here because innerHTML rebuilds the h6 on every open) */
  navpop.onclick = e => { e.stopPropagation();
    if (e.target.closest && e.target.closest('h6')) navpop.classList.toggle('min'); };
  sr.appendChild(navpop);
  /* a fresh open starts expanded — a fold is a per-look gesture, not a mode */
  let navTrigger = null;
  const closeNav = () => {
    navpop.classList.remove('on', 'min');
    const meta = navTrigger && navTrigger.trackMeta;
    const replacement = [...$('list').querySelectorAll('button')].find(el => el.trackMeta === meta || (meta && meta.id && el.trackMeta.id === meta.id));
    const target = navTrigger && navTrigger.isConnected ? navTrigger : replacement;
    if (target) target.focus({ preventScroll: true });
  };
  navpop.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeNav(); }
  });

  function markQueued() {
    const N = window.DWNAV; if (!N) return;
    sr.querySelectorAll('.tr').forEach(e => e.classList.remove('queued'));
    const q = N.queue;
    if (q) { const e = sr.querySelector('.tr[data-i="' + q.idx + '"]'); if (e) e.classList.add('queued'); }
  }

  /* ── the line that made routing inert ────────────────────────────────
     `dash.set = r.set` and nothing else. commitAndRepair returns a NEW array;
     Player.play() captured the OLD one as `order` and there was no way to
     hand it a replacement, so the list showed the detour and the deck walked
     the set it was given at ▶. Patch 09's bug, third time: an intention the
     UI recorded and the playback path never read.

     DW.reorder() adopts the array, so the two are one object again — the
     invariant every in-place operation here already depends on — and
     re-chains, because the next deck was committed the moment this track
     started and that choice predates the route.

     `now` is what separates the two menu entries. A fast blend leaves the
     current track at the next downbeat, because "⚡ blend fast" is a request
     to GO; a scenic route lets it finish, because "↝ scenic route" is not. */
  async function applyRoute(entry, label) {
    const N = window.DWNAV;
    N.setQueue(entry);
    const r = N.commitAndRepair(set);
    /* the queue was set three lines up, and commitAndRepair only reaches
       its clearQueue() on the success path — without this, a rejected
       route kept rendering as a pending detour (the wayposts spiral, the
       .queued row outline) that the engine had already refused. It is
       clearQueue, not clearRoute: nothing committed, so `active` is not
       the thing holding the ghost (ultra review F4). */
    if (!r.ok) { N.clearQueue(); log('route failed: ' + r.why); return; }
    const v = N.verify(r.set, window.DW.state.idx, window.DW.state.tempo);
    let moved = 'not playing — press ▶';
    if (window.DW.state.of) {
      moved = await window.DW.reorder(r.set, { now: !!entry.dwellSec });
      /* reorder() REFUSES when the playing track is not at idx in the new
         array. Adopting the array here anyway would leave the dashboard on a
         third array the player never saw — the ledger-40 desync, self-
         inflicted. Keep the old set and say so. */
      if (/^refused/.test(moved)) { N.clearRoute(); log('route ' + moved); return; }
    }
    dash.set = r.set;                       /* setter re-renders the list */
    renderList();
    /* `v.overGate` — verify() never had a field called `over`, so this line
       read undefined and printed "gate holds" unconditionally: a check whose
       pass condition could not fail. */
    log(label + ' · +' + r.inserted + ' spliced · tail ' + r.tailKept +
        ' kept, ' + r.tailDropped + ' dropped' +
        (v && v.overGate ? ' · ⚠ ' + v.overGate + ' over gate (max ' + v.maxStretch + '%)' : ' · gate holds') +
        ' · ' + moved);
  }

  function openNav(el, idx) {
    set = sets.current; navTrigger = el;
    const N = window.DWNAV, t = set[idx];
    if (!N || !t) return;
    const T = window.DW.state.tempo || (set[window.DW.state.idx] || t).bpm;

    /* ── a track that plays STRAIGHT has no stretch to quote ──────────────
       chain() honours `_unlocked` and runs the deck at rate 1, so clicking
       "force it now" on one of these already did the right thing — while the
       menu printed "+28%" beside it. The behaviour was right and the label
       was a lie, which is the worse half of that pair: it invites the keeper
       to test a stretch that is never applied.

       Route and fast are suppressed for the same reason. A stepping-stone
       ladder exists to walk the TEMPO across, and nothing is being stretched
       to this track, so there is nothing for a ladder to do. */
    if (t._unlocked) {
      const why = t._unlockReason === 'reach'
        ? 'Its grid is fine — the set simply cannot stretch to it from ' + Math.round(T)
          + ' bpm. It plays at its own speed, then the set continues from '
          + Math.round(t.bpm) + ' bpm.'
        : 'Its beat grid disagrees with its own tempo label'
          + (t._gridErr != null ? ' by ' + t._gridErr + '%' : '')
          + ', so we do not beatmatch it. It plays at its own speed and the tempo '
          + 'target stays where it is.';
      navpop.innerHTML = '<h6>' + esc(clean(t.name).slice(0, 44)) + ' · ' +
        Math.round(t.bpm) + ' · ' + esc(t.camelot) + ' · plays straight</h6>';
      [{ cls: 'good', b: '∿ bring it in now · no stretch',
         i: 'Crossfades at the next opportunity without claiming a beatmatch. ' + why,
         act: () => blend(idx) },
       { cls: '', b: '⏭ queue as next',
         i: 'This track finishes as planned, then crossfades into that one, straight.',
         act: () => later(idx) },
       { cls: '', b: '⇥ jump straight there',
         i: 'Cuts. Does not blend.', act: () => jump(idx) }].forEach(r => {
        const sp = document.createElement('button'); sp.type = 'button';
        sp.className = 'opt ' + r.cls;
        sp.innerHTML = '<b>' + esc(r.b) + '</b><i>' + esc(r.i) + '</i>';
        sp.onclick = ev => { ev.stopPropagation(); closeNav(); Promise.resolve(r.act()).catch(e => reportIssue(e, 'track action')); };
        navpop.appendChild(sp);
      });
      const bb = el.getBoundingClientRect();
      navpop.classList.remove('min'); navpop.classList.add('on');
      const hh = navpop.getBoundingClientRect().height;
      navpop.style.top = Math.max(8, Math.min(innerHeight - hh - 8, bb.top)) + 'px';
      navpop.style.left = Math.max(8, bb.left - navpop.getBoundingClientRect().width - 10) + 'px';
      navpop.querySelector('button')?.focus();
      return;
    }

    const opts = (N.optionsFull || N.options).call(N, T, t, window.DW.corpus).slice();
    /* The engine describes reachability; it has no opinion about WHEN. Both
       timings are useful, so the "finish this one first" variant is added
       alongside whatever it returned. */
    const insertAt = opts.findIndex(o => o.kind === 'jump');
    opts.splice(insertAt < 0 ? opts.length : insertAt, 0, { kind: 'later', ok: true });

    const pct = n => (n > 0 ? '+' : '') + n + '%';
    /* optionsFull() reports |stretch|; the deck will run at T/bpm, which is
       slower than native when the target is below the track's tempo. Print
       the sign the header prints, not a + against a slow-down. */
    const signed = +(((T / t.bpm) - 1) * 100).toFixed(1);
    const rows = opts.map(o => {
      switch (o.kind) {
        case 'next':  return { cls: 'good', b: '▶ blend in now · ' + pct(signed),
          i: 'Leaves this track at the next downbeat and crossfades. Does not wait '
             + 'for the exit planned at the top of the track, and does not cut.',
          act: () => blend(idx) };
        case 'force': return { cls: 'warn', b: '⚠ force it now · ' + pct(signed),
          i: o.warn + '. Blends at the next downbeat, but the gate exists because '
             + 'this is what that much stretch sounds like.',
          act: () => blend(idx) };
        case 'later': return { cls: '', b: '⏭ queue as next',
          i: 'This track finishes as planned, then blends into that one.',
          act: () => later(idx) };
        case 'route': return { cls: 'good', b: '↝ scenic route · ' + o.hops.length + ' stepping stones',
          i: 'This track finishes first, then walks the tempo across instead of '
             + 'yanking it. About ' + o.minutes + ' min of stepping stones, ending at '
             + pct(o.finalStretch) + '.',
          ladder: o.ladder, dest: t, act: () => applyRoute({ idx, mode: 'route', hops: o.hops }, 'scenic route') };
        /* dwellSec is what the router ASKED for; chain() clamps it up to
           DW.dwellFloor. Printing the request rather than the clamp is how
           this menu advertised 40s stones that always played 45. */
        case 'fast':  {
          const floor = (window.DW && window.DW.dwellFloor) || 0;
          const real = Math.max(floor, o.dwellSec);
          const mins = +((real * o.hops.length) / 60).toFixed(1);
          return { cls: 'good', b: '⚡ blend fast · ' + o.hops.length + ' quick passes',
          i: 'Leaves this track at the next downbeat. Each stone then plays ' + real +
             's — long enough to blend in and out' +
             (real > o.dwellSec ? ' (asked for ' + o.dwellSec + 's; the engine floor is ' + floor + 's)' : '') +
             '. About ' + mins + ' min.',
          ladder: o.ladder, dest: t,
          act: () => applyRoute({ idx, mode: 'route', hops: o.hops, dwellSec: o.dwellSec }, 'fast blend') }; }
        case 'unreachable': return { cls: 'dead', b: '✕ unreachable',
          i: o.reason + (o.wouldNeed ? ' · would need ' + pct(o.wouldNeed) : ''), act: null };
        case 'jump':  return { cls: '', b: '⇥ jump straight there',
          i: 'Ignores the tempo plan. Cuts, does not blend.', act: () => jump(idx) };
        case 'back':  return { cls: '', b: '↩ back',
          i: 'Return to where you steered away from.', act: () => { const b = N.back(); if (b != null) jump(b, { push: false }); } };
        default: return null;
      }
    }).filter(Boolean);

    navpop.innerHTML = '<h6>' + esc(clean(t.name).slice(0, 44)) + ' · ' +
      Math.round(t.bpm) + ' · ' + esc(t.camelot) + ' · target ' + Math.round(T) + '</h6>';
    rows.forEach(r => {
      const s = document.createElement('button'); s.type = 'button'; s.disabled = !r.act;
      s.className = 'opt ' + r.cls;
      s.innerHTML = '<b>' + esc(r.b) + '</b><i>' + esc(r.i) +
        (r.ladder ? '<span class="route">' + r.ladder.map(n => esc(n)).join(' → ') +
                    ' → <b style="display:inline">' + Math.round(r.dest.bpm) + '</b></span>' : '') + '</i>';
      if (r.act) s.onclick = ev => { ev.stopPropagation(); closeNav(); Promise.resolve(r.act()).catch(e => reportIssue(e, 'track action')); };
      navpop.appendChild(s);
    });

    const b = el.getBoundingClientRect();
    navpop.classList.remove('min'); navpop.classList.add('on');
    const h = navpop.getBoundingClientRect().height;
    navpop.style.top = Math.max(8, Math.min(innerHeight - h - 8, b.top)) + 'px';
    navpop.style.left = Math.max(8, b.left - navpop.getBoundingClientRect().width - 10) + 'px';
    navpop.querySelector('button:not(:disabled)')?.focus();
  }

  /* play() rejects when the target is missing or will not decode — and it
     has already stopped the deck by then. Unhandled, that was silence with
     the log line unchanged: exactly the "no evidence afterwards" symptom the
     audit button exists for. Say it on the line. */
  const safePlay = async (i) => {
    if (window.DWPHONE && window.DWPHONE.armCalls) window.DWPHONE.armCalls();
    try { return await window.DW.play(set, i); }
    catch (e) { return 'cannot play ' + String(set[i] && set[i].name || '').slice(-30) + ': ' +
                       String((e && e.message) || e) + ' — deck stopped'; }
  };
  /* `opts.push === false` when we are RETURNING through the history —
     ↩ back popped an entry and then jump() pushed the current index
     straight back on, so the stack ping-ponged: pressing back twice
     returned you to where you had just been instead of two steps back.
     `state.now` rather than `state.of` for the same reason as blend(). */
  async function jump(i, opts) {
    const N = window.DWNAV;
    if (N && window.DW.state.now && !(opts && opts.push === false)) N.push(window.DW.state.idx);
    log(await safePlay(i));
  }

  /* Leave the current track at the next downbeat and crossfade into i.
     Both of these mutate the play order IN PLACE inside the Player, and the
     dashboard's `set` is that same array — so the list follows without being
     reassigned. Reassigning would desync the two silently. */
  async function blend(i) {
    const N = window.DWNAV;
    /* `state.of` is order.length and NEITHER stop() NOR kill() clears
       `order`, so it stays truthy forever after the first ▶ — this guard
       passed on a stopped deck and blendNow then returned 'nothing
       playing', printing two contradictory lines from one press.
       `state.now` is the deck's own answer. */
    if (!window.DW.state.now) { log('nothing playing — use jump'); return; }
    if (N) N.push(window.DW.state.idx);
    log(await window.DW.blendNow(set[i]));
    renderList();
  }

  async function later(i) {
    /* `state.of` is order.length and NEITHER stop() NOR kill() clears
       `order`, so it stays truthy forever after the first ▶ — this guard
       passed on a stopped deck and blendNow then returned 'nothing
       playing', printing two contradictory lines from one press.
       `state.now` is the deck's own answer. */
    if (!window.DW.state.now) { log('nothing playing — use jump'); return; }
    log(await window.DW.queueNext(set[i]));
    renderList();
  }

  /* ── the events module steers through THESE primitives, never its own
     path to the play order (the ledger-40 lesson). DWEVENTS.inject('…')
     from the console or a same-origin postMessage lands here. */
  if (window.DWEVENTS && window.DWEVENTS.wire) {
    window.DWEVENTS.wire({ log, set: () => set, blend, later, applyRoute });
  }

  /* The transport is NOT built here. mount() used to build one inline and
     then call buildTransport(dash) as well, so #tp received two complete
     sets of controls: two scan, two build set, two play/pause/next/stop,
     two theme buttons writing the same localStorage key. Both were live.
     One transport, built once, after the mixins exist. */

  /* ── wire everything mount() owns ──────────────────────────────────
     This block is the difference between "the code is saved" and "it runs".
     An earlier package had all the mixins present and never called them:
     a fresh page load gave panels and no view selector. */
  const dash = {
    host, shadow: sr, fit, C, X,
    /* THE RESIZE OBSERVER, handed out on purpose. `DWDASH.slots`'s build()
       ends every new cell with `if (dash.ro) dash.ro.observe(d)` — and until
       2026-09-01 nothing ever set `dash.ro`, so that line was a permanent
       no-op naming a mechanism that did not exist. Nothing looked broken
       because every site that rebuilds cells also calls `setTimeout(dash.fit)`
       by hand; the observer is the belt to that pair of braces, for a cell
       that changes size without a rebuild (a fold, a column change, the
       sidebar going away). Assigned rather than deleted: the observer is
       real, it is created above, and handing it over costs one line.
       ro is created before this object — see fit(). */
    ro,
    get set() { return sets.current; }, set set(v) { sets.adopt(v); set = sets.current; renderList(); },
    get prepared() { return sets.prepared; },
    get fileSet() { return sets.prepared || sets.current; },
    prepare(v) {
      sets.prepare(v); app.classList.remove('mini');
      if (app.getAttribute('data-side') === 'hide') app.removeAttribute('data-side');
      if (innerWidth <= 720) app.classList.add('ph-list');
      renderPrepared(); announce('Prepared ' + v.length + (v.length === 1 ? ' track.' : ' tracks.') + ' Playback unchanged.');
    },
    playPrepared: () => sets.play(), reportIssue, announce,
    syncIssues() { if (window.DW.issues && window.DW.issues.length) reportIssue({ failures: window.DW.issues }); },
    renderList, header: head, slots: null, views: null, applyFolds: null,
    stereoSource, drawFixed: null, elapsed: 0, theme: 'cyberpunk'
  };

  /* Reachable from outside for live patching — same seam as DW._dev, same
     rules. The UI half matters as much as the engine half: the steering menu
     lives in this closure, so without these it cannot be changed without a
     reload either. */
  dash.openNav = openNav; dash.blend = blend; dash.later = later;
  dash.jump = jump; dash.log = log; dash.markQueued = markQueued;
  lastDash = dash;

  dash.slots      = DWDASH.slots(dash);       /* swappable panel cells */
  dash.applyFolds = DWDASH.folds(dash);       /* collapse / expand, persisted */
  dash.views      = DWDASH.views(dash);       /* named saveable arrangements */
  DWDASH.glossary(dash);                      /* header term tooltips */
  dash.glossary = DWDASH.glossaryBind(dash);  /* hover any term, anywhere */
  dash.applyFolds();

  if (window.DWNOWPLAYING) window.DWNOWPLAYING.mount(dash);

  /* fixed strips the slots do not own */
  dash.drawFixed = (T, D) => {
    const at = (cid, fn) => { const c = C[cid]; if (!c) return;
      const r = c.getBoundingClientRect();
      if (r.width > 2 && r.height > 2) fn(X[cid], r.width, r.height); };
    /* Feed these from the bundle. They used to read mount-scope closures that
       only the dead inline loop() ever filled, so the waveform strip drew a
       flat line and the punchcard showed no onsets — for every run since the
       package was cut. */
    at('cScope', (c, w, h) => P.scope(c, w, h, T, D.wave));
    at('cPunch', (c, w, h) => P.punch(c, w, h, T, D.flux || 0, performance.now(), D.hits));
    at('cArc',   (c, w, h) => P.arc(c, w, h, T));
  };

  /* One loop, started once. Never wrap it to add a feature — add the feature
     to the bundle it already builds. Wrapping is what killed the last one.
     And ONE loop means one: the `else loop()` that used to be on this line
     named a second implementation the boot gate could never reach. A gate
     that refuses beats a fallback nobody can run. */
  if (!window.DWLOOP) throw new Error('DWDASH.mount needs DWLOOP (deckwave-loop.js) — it owns the render loop');
  window.DWLOOP.start(dash);

  buildTransport(dash);
  return dash;
}

/* ── transport ──────────────────────────────────────────────────────────
   Built after the mixins exist, because half these controls drive them. */
function buildTransport(dash) {
  const sr = dash.shadow, $ = id => sr.getElementById(id), tp = $('tp');
  const log = m => STATUS.set($('logLine'), m);
  /* ── grouping ──────────────────────────────────────────────────────────
     The transport accreted one control at a time until it was 21 items in a
     flat row spanning library, playback, output, capture and appearance, with
     nothing marking where one concern ended and the next began.

     Every control now carries a group. 'cfg' is everything you set once and
     leave — appearance, layout, overlays — and it collapses behind one toggle,
     which takes the always-visible count from 21 to 13. Nothing is removed and
     nothing moves more than one click away.

     Grouping by dataset rather than by wrapper elements on purpose: .tp is a
     wrapping flexbox, so hiding a group just shortens the row. No change to
     the app grid, which is the part that would be easy to break and hard to
     notice. */
  const GRP = { deck: 'deck', play: 'play', files: 'files', cap: 'capture', cfg: 'cfg' };

  const btn = (txt, fn, hot, grp) => {
    const b = document.createElement('button');
    b.textContent = txt; if (hot) b.className = 'hot';
    b.onclick = async e => { try { await fn(e); } catch (err) { dash.reportIssue(err, txt); log(err.message || err); } };
    b.dataset.grp = grp || GRP.deck;
    tp.insertBefore(b, $('logLine')); return b;
  };
  const sep = (grp) => { const s = document.createElement('span');
    s.className = 'sep'; s.dataset.grp = grp || GRP.deck;
    tp.insertBefore(s, $('logLine')); return s; };

  /* a small dropdown, used for layout / theme / views */
  function select(label, items, onPick, current, grp) {
    const wrap = document.createElement('span'); wrap.className = 'sel';
    const input = document.createElement('select'); input.setAttribute('aria-label', label);
    const paint = () => {
      input.replaceChildren();
      for (const x of items) {
        const option = document.createElement('option'); option.value = x.k;
        option.textContent = label + ': ' + x.n + (x.hint ? ' · ' + x.hint : ''); input.appendChild(option);
      }
      input.value = current;
    };
    paint();
    input.onchange = () => { current = input.value; onPick(current); };
    wrap.onclick = e => e.stopPropagation();
    wrap.appendChild(input);
    wrap.dataset.grp = grp || GRP.cfg;
    tp.insertBefore(wrap, $('logLine'));
    return { el: wrap, refresh: paint, set(k) { current = k; paint(); } };
  }
  document.addEventListener('click', () =>
    { sr.querySelectorAll('.sel,.pmenu,.hcard').forEach(o => o.classList.remove('open'));
      const np = sr.getElementById('navpop'); if (np) np.classList.remove('on'); });

  /* keep the screen awake for the length of a scan — the page is paused
     when it is off, and a locked phone lost the keeper a 189-track pass */
  const PH = () => window.DWPHONE;
  btn('scan', async () => {
    log('pick your music folder…');
    if (PH()) PH().hold('scan');
    try {
      const r = await window.DW.scan((i, n, nm) => log(i + '/' + n + ' ' + nm.slice(0, 40)));
      if (r.failures && r.failures.length) dash.reportIssue(r, 'scan');
      log(r.added + ' added · ' + r.analysed + ' in corpus · ' + r.cached + ' cached'
        + (r.duplicates ? ' · ' + r.duplicates + ' already had' : '')
        + (r.failed ? ' · ' + r.failed + ' failed' : '')
        + (r.uncached ? ' · ' + r.uncached + ' not cached (storage refused — re-analysed next load)' : '')
        + (r.via === 'files-input' ? ' · picked as files — this browser cannot pick a folder' : ''));
    } catch (e) {
      /* Cancelling the picker rejects with AbortError. Uncaught, that left an
         unhandled rejection in the console and the log line stuck on
         "pick your music folder…" forever — the UI claiming to be waiting for
         a dialog the user had already dismissed. */
      log(e && e.name === 'AbortError' ? 'scan cancelled' : String((e && e.message) || e));
      if (e.name !== 'AbortError') dash.reportIssue(e, 'scan');
    } finally { if (PH()) PH().release('scan'); }
  }, true);

  /* Individual tracks, multi-select. Folders come in one at a time because
     showDirectoryPicker only ever returns one — that is the browser, not us.
     Scanning is additive now, so several folders means pressing scan again. */
  btn('+ tracks', async () => {
    log('pick tracks…');
    if (PH()) PH().hold('scan');
    try {
      const r = await window.DW.addFiles((i, n, nm) => log(i + '/' + n + ' ' + nm.slice(0, 40)));
      if (r.failures && r.failures.length) dash.reportIssue(r, 'add tracks');
      log(r.added + ' added · ' + r.corpus + ' in corpus'
        + (r.duplicates ? ' · ' + r.duplicates + ' already had' : '')
        + (r.failed ? ' · ' + r.failed + ' failed' : '')
        + (r.uncached ? ' · ' + r.uncached + ' not cached (storage refused — re-analysed next load)' : ''));
    } catch (e) {
      log(e && e.name === 'AbortError' ? 'cancelled' : String((e && e.message) || e));
      if (e.name !== 'AbortError') dash.reportIssue(e, 'add tracks');
    } finally { if (PH()) PH().release('scan'); }
  });

  /* ⊕ libre — freely-licensed music fetched from the Internet Archive
     (DWLIBRE, ROADMAP R3). A third way in beside scan and + tracks, and the
     only one that needs no library at all: search, pick a release, fetch;
     the tracks come through DW.ingest like any file, carrying creator and
     licence. On a phone this is the path around the folder picker. */
  btn('⊕ libre', (e) => {
    /* the panel closes on an outside tap on narrow screens; without this
       the SAME click that opens it would bubble to document and close it */
    e.stopPropagation();
    if (!window.DWLIBRE) { log('libre module not loaded'); return; }
    /* root: this shadow root — the host is fixed at the top z-index, so a
       panel on <body> would be behind the whole app */
    const on = window.DWLIBRE.open({ log, root: sr });
    if (on) log('libre: freely-licensed releases from archive.org — search, then + add · tracks arrive with creator · licence and the score carries them');
  });

  /* ▶ demo — the pre-built set (assets/demo-set.json, a saved score whose
     steps carry libre sources). Stand Alone is fetched first and plays
     ALONE while the rest arrive in set order; the transport is held until
     the set is home. For someone with no library at all, this is the
     whole product in one press. */
  const demoBtn = btn('▶ demo', async (e) => {
    e.stopPropagation();
    if (!window.DWLIBRE || !window.DWLIBRE.demo) { log('libre module not loaded'); return; }
    if (demoBtn.disabled) return;
    demoBtn.disabled = true;
    if (PH()) { PH().hold('demo'); if (PH().armCalls) PH().armCalls(); }
    /* progress on the BUTTON as well as the log — on a phone the log line
       may be off screen, and a held transport with no visible countdown
       reads as broken (keeper: "unclear why or when"). Since 2026-08-21
       the button also carries the CURRENT track's byte percentage
       (`demo 2/6 · 47%`) via DWLIBRE.watchFetch — the keeper asked for
       exactly this from the phone; the log stays one line per track. */
    const at = { i: 0, n: 0 };
    const unFetch = window.DWLIBRE.watchFetch ? window.DWLIBRE.watchFetch(ev => {
      if (ev.done || !at.n) return;
      demoBtn.textContent = 'demo ' + at.i + '/' + at.n + ' · '
        + (ev.total ? Math.min(99, Math.round(ev.loaded / ev.total * 100)) + '%'
                    : (ev.loaded / 1048576).toFixed(1) + ' MB');
    }) : null;
    try {
      log('demo: fetching the opening track…');
      demoBtn.textContent = 'demo …';
      const r = await window.DWLIBRE.demo({ log,
        onProgress: (i, n, nm, phase) => {
          at.i = i; at.n = n;
          demoBtn.textContent = 'demo ' + i + '/' + n;
          log('demo: ' + phase + ' ' + i + '/' + n + ' · ' + String(nm).slice(0, 40));
        } });
      dash.set = r.set;
      demoBtn.textContent = '✓ demo';
      log('demo: ' + r.tracks + ' tracks home — controls are back · ' + r.note
        + (r.missing.length ? ' · missing: ' + r.missing.join(', ').slice(0, 60) : ''));
    } catch (err) {
      demoBtn.textContent = '▶ demo';
      log('demo: ' + String((err && err.message) || err));
    } finally { if (unFetch) unFetch(); demoBtn.disabled = false; if (PH()) PH().release('demo'); }
  });

  /* `keepDupes` is a toggle rather than a law because removing a track the
     owner put in their own folder is their call. It drops 17 here — the same
     recording on an album and on a single. */
  let keepDupes = false;

  /* Three builds, the keeper's call: ALL TRACKS places everything and plays
     the unreachable straight; BEST MATCHES keeps only what can be beatmatched
     from where the set is and ends when the gate is exhausted — and says how
     many it left out, so a short set is never mistaken for a small library;
     PHRASE MATCH (2026-08-19) is best matches with every transition landing
     on an 8-bar phrase of both tracks and a one-phrase fade — the list is
     the same, the Player does the rest (DWPHRASE, computed as tracks play,
     so the first play of a track costs one pass over its audio). */
  const LABEL = { all: 'all tracks · ', best: 'best matches · ', phrase: 'phrase match · ' };
  const build = mode => {
    if (!window.DW.corpus.length) { log('scan first'); return; }
    if (mode === 'phrase' && !window.DWPHRASE) { log('phrase module missing — build · best matches instead'); return; }
    const prepared = window.DW.prepare({ length: 500, dedupe: !keepDupes, mode });
    dash.prepare(prepared);
    const i = window.DW.inspect(prepared);
    if (typeof i === 'string') { log(i); return; }
    log('prepared · ' + (LABEL[mode] || LABEL.all)
      + i.tracks + ' tracks · ' + Math.floor(i.runtimeMin / 60) + 'h' + (i.runtimeMin % 60)
      + ' · max stretch ' + i.maxStretchPct + '%'
      + (i.maxStretchPct > 15 ? ' ⚠ OVER BUDGET' : '')
      + (mode !== 'all'
          ? (i.leftOut ? ' · left out ' + i.leftOut + ' of ' + i.poolSize + ' ('
              + i.leftOutGrid + ' untrusted grid, ' + i.leftOutReach + ' out of reach)'
            : ' · nothing left out')
          : (i.straight ? ' · ' + i.straight + ' played straight ('
              + i.straightGrid + ' untrusted grid, ' + i.straightReach + ' out of reach)'
            : ' · all beatmatched'))
      + (mode === 'phrase' ? ' · transitions on 8-bar phrases, fade = one phrase (¶ in the log)' : ''));
  };
  btn('build set · all tracks', () => build('all'), true);
  btn('build · best matches', () => build('best'));
  btn('build · phrase match', () => build('phrase'));

  /* Cancelling the picker REJECTS (`LIB.pick` throws 'nothing picked', and
     showDirectoryPicker throws AbortError), so without this catch the button
     left an unhandled rejection and a log line unchanged from whatever came
     before — a button that looks broken because it says nothing. `scan` and
     `+ tracks` already had the catch; this one never got it. */
  const libBtn = btn('library', async () => {
    try {
      const n = await window.DW.openLibrary();
      const target = dash.fileSet, miss = target.filter(t => !window.DW.LIB.find(t)).length;
      log(n + ' files · ' + (target.length - miss) + '/' + target.length + ' resolvable'
        + (miss ? ' · ' + miss + ' missing' : ''));
    } catch (e) {
      const m = String((e && e.message) || e);
      log(/abort|nothing picked/i.test(m) ? 'library unchanged — nothing picked' : 'cannot open library: ' + m);
    } });
  libBtn.dataset.ph = 'cfg';          /* phone: behind ⚙ display */

  /* ── "songs with brackets in the title won't load" ────────────────────
     A track that will not decode is spliced out of the order by chain() with
     one line in the log, which nobody is watching at the moment it scrolls
     past. So the symptom is "that one never plays" and there is no evidence
     anywhere afterwards.

     This decodes every track in the set FOR REAL — the same decodeAudioData
     call playback makes — and prints the ones that fail with the decoder's
     own message. A name-resolution failure and a decode failure look
     identical from the outside and have completely different fixes, so the
     stage is reported separately. The full list goes to the console because
     the log line is one line. */
  const auditBtn = btn('◎ audit set', async () => {
    const target = dash.fileSet;
    if (!target.length) { log('build a set first'); return; }
    if (!window.DW.LIB.files) { log('open the library first'); return; }
    log('auditing…');
    const r = await window.DW.audit(target,
      (i, n, nm) => log('audit ' + i + '/' + n + ' · ' + String(nm).slice(-34)));
    if (typeof r === 'string') { log(r); return; }
    if (r.failures.length) dash.reportIssue(r, 'audit');
    log(r.playable + '/' + r.checked + ' playable'
      + (r.failed ? ' · ' + r.failed + ' failed — open Issues' : ' · none failed')
      + (r.viaLibflac && r.viaLibflac.length ? ' · ' + r.viaLibflac.length + ' decoded via libflac (browser refused them)' : '')
      + (r.durationMismatch.length ? ' · ' + r.durationMismatch.length + ' length mismatch' : ''));
    console.log('%cdeckwave audit', 'font-weight:bold',
      r.playable + '/' + r.checked + ' playable');
    if (r.failures.length) console.table(r.failures);
    if (r.durationMismatch.length) {
      console.warn('decoded length disagrees with the analysed length — ' +
                   'the beat grid was measured against a different duration');
      console.table(r.durationMismatch);
    }
  });
  auditBtn.dataset.ph = 'cfg';        /* phone: behind ⚙ display */
  auditBtn.dataset.setAction = 'audit';

  sep(GRP.play);
  /* phone only (CSS hides it elsewhere): panels or the set, one screen at a
     time — the set screen is the track list AND the now-playing card */
  const phl = btn('☰ set', () => {
    const on = app.classList.toggle('ph-list');
    phl.textContent = on ? '▦ panels' : '☰ set';
    phl.className = 'phl' + (on ? ' hot' : '');
    setTimeout(dash.fit, 60);
  }, false, GRP.play);
  phl.className = 'phl';
  btn('▶ play', async () => {
    /* PAUSED MEANS RESUME. Keeper, 2026-08-30: "the least surprising thing
       for the play button to do when a deck is paused would be to resume
       from pause." It did not — it called play(dash.set, 0), and play()
       opens with `ctx.resume(); this.stop()`, so ▶ on a paused set killed
       the decks and restarted from track 1. Forty minutes into a set that
       is not a surprise, it is a lost session.
       DW.pause() is a toggle and returns 'resumed'; the phone's lock-screen
       ▶ has always taken this exact path (deckwave-phone.js), so this makes
       the dashboard agree with the transport that was already right.

       AND ▶ ON A SET THAT IS ALREADY PLAYING IS A NO-OP, for the same
       reason and found the same day: the first fix guarded only the PAUSED
       arm, so paused → ▶ (resumes) → ▶ again still fell through to
       play(set, 0) and destroyed the session. That is a worse trap than the
       original, because it sits one press after the cure. `live > 0` is the
       real predicate on both arms — `state.of` stays truthy forever, since
       neither stop() nor kill() clears `order`. */
    const st = window.DW.state;
    /* `now`, not `live`. Both are cleared by stop(), but they are not the
       same question and they were observed disagreeing in a live boot on
       2026-08-31: `live` counts SOURCE NODES and drains asynchronously via
       `src.onended`, so it can be non-zero while deck A is already null —
       and this guard then refused with "already playing" over silence.
       `now` is `A ? A.track.meta.name : null`: the deck's own answer, true
       while paused (pause suspends the context, it does not drop A), and
       the same predicate the blend, later and steer guards now use. Seven
       sites, one question. */
    if (st && st.now) {
      if (st.ctx === 'suspended') { log(window.DW.pause()); return; }   /* resume */
      if (st.ctx === 'running') { log('already playing — ❚❚ to pause, ■ to stop'); return; }
    }
    /* Android: start the call-focus proxy inside this gesture — BEFORE the
       prepared branch, which is now the normal path since Build always
       prepares (ledger 140: it returned first and never armed). */
    if (PH() && PH().armCalls) PH().armCalls();
    if (dash.prepared) {
      try { log(await dash.playPrepared()); dash.renderList(); }
      catch (e) { dash.reportIssue(e, 'play prepared'); log(e.message); }
      return;
    }
    if (!dash.set.length) { log('build a set first'); return; }
    if (!window.DW.LIB.files) { log('open the library first'); return; }
    try { log(await window.DW.play(dash.set, 0)); }
    catch (e) { dash.reportIssue(e, 'play'); log('cannot play: ' + String((e && e.message) || e) + ' — deck stopped'); } }, true, GRP.play);
  btn('pause', () => log(window.DW.pause()), false, GRP.play);
  /* next BLENDS since 2026-08-19 — leaves the playing track at the next
     downbeat and crossfades over the set's xfade (keeper: "the next button
     should default to a reasonable blend asap"). It is a cut only when
     nothing is playing. The lock screen's ▶▶ lands on the same DW.skip(). */
  const nextBtn = btn('next ▶', async () => {
    try { log(await window.DW.skip()); }
    catch (e) { log('cannot play next: ' + String((e && e.message) || e) + ' — deck stopped'); } }, false, GRP.play);
  nextBtn.title = 'blend into the next track at the next downbeat (a cut only when nothing is playing)';
  /* ■ stop and the engine reset are created AFTER the level slider, at the
     end of the play group and in the cfg group respectively — see there. */

  sep(GRP.cfg);
  const rc = btn('register colour: off', () => {
    const M = window.DWREGISTER.mode; M.on = !M.on;
    rc.textContent = 'register colour: ' + (M.on ? 'on' : 'off');
    rc.className = M.on ? 'hot' : '';
    if (!M.on) ['--dw-color-accent', '--dw-color-accent-2']
      .forEach(k => dash.host.style.removeProperty(k));
  });
  rc.dataset.grp = GRP.cfg;

  /* ── settle: ride a stretched deck back to its own speed ──────────────
     OFF by default and it must stay that way until it has been heard. See
     the settle block in deckwave.js for what switching it on changes — it is
     not only the sound of one track, it moves the rolling tempo target and
     therefore every gate test after it.

     minStretch is set from DWNAV.GATE rather than from a number typed here.
     There is one gate in this project and it lives in DWNAV; a second copy
     would be free to drift away from the first, which is exactly the 45/40
     dwell clash one layer down. */
  const sb = btn('settle after a bad blend: off', () => {
    const S = window.DW.settle;
    S.on = !S.on;
    S.minStretch = window.DWNAV ? window.DWNAV.GATE : null;
    sb.textContent = 'settle after a bad blend: ' + (S.on ? 'on · ' + S.seconds + 's' : 'off');
    sb.className = S.on ? 'hot' : '';
    log(S.on
      ? 'settle ON — a deck stretched past the gate rides back to its own speed over '
        + S.seconds + 's. UNTESTED BY EAR. It also hands over at the track’s own BPM '
        + 'instead of the 35% drift target, so the whole tempo plan downstream changes.'
      : 'settle off — trusted decks share the rolling tempo change over each crossfade');
  });
  sb.dataset.grp = GRP.cfg;

  /* ── phone playback: what keeps a set alive when the screen goes dark ──
     OFF by default. `wake` holds a screen wake lock while a set plays —
     real, boring, costs battery, CONFIRMED on an iPhone. `background` sets
     navigator.audioSession.type = 'playback', which is the one thing that
     makes WebKit leave a Web Audio graph running at lock — read from
     WebKit's source, not tried on a phone yet (deckwave-phone.js has the
     file-and-function citations and the falsifier). Both say so on the log. */
  if (window.DWPHONE) {
    const PH = window.DWPHONE;
    /* 'media' (the mix through an <audio> element) is deliberately NOT
       offered here any more: tried on an iPhone 16 Pro Max / iOS 26.6 on
       2026-08-19 and the element just repeated a short buffer — the graph
       feeding it does not stay up on WebKit. That was the stated falsifier
       and it fell. DWPHONE.set('media') still exists from the console for
       anyone who wants to re-run the experiment on a later iOS. */
    const phoneSel = select('phone', [
      { k: 'off',   n: 'off' },
      { k: 'wake',  n: 'keep screen on', hint: PH.cap.wakeLock ? 'wake lock' : 'no wake lock here' },
      { k: 'background', n: 'background audio',
        hint: PH.cap.audioSession ? 'audioSession: playback · confirmed through the lock 2026-08-19' : 'no Audio Session API here' },
      { k: 'controls', n: 'background + lock controls',
        hint: PH.cap.audioSession ? 'a silent element takes the card · ▶▶ ◀◀ ❚❚ · untested' : 'no Audio Session API here' }
    ], async k => {
      try {
        await PH.set(k);
        const s = PH.status;
        log(k === 'off' ? 'phone playback off — speakers, no wake lock'
          : k === 'wake' ? ('screen stays on while a set plays' + (s.wakeLockAvailable ? '' : ' — this browser has no wake lock, so nothing changes'))
          : k === 'controls' ? (s.audioSession === 'playback'
              ? 'background audio + lock-screen controls — a silent 30 s loop is now the Now Playing session · silent element ' + s.silentElement
                + (s.silentElement === 'playing' ? '' : ' (tap anywhere once to start it — a media element needs a gesture)')
                + ' · the card should show this track, its position, and ▶▶ ◀◀ ❚❚ that work · UNTESTED on a locked phone: lock it and press ▶▶'
              : 'background + lock controls — ' + (s.audioSessionAvailable ? 'the Audio Session type did not take' : 'this browser has no Audio Session API') + ' — use "keep screen on"')
          : k === 'background' ? (s.audioSession === 'playback'
              ? 'background audio — navigator.audioSession.type = playback · speakers · WebKit should now keep the graph running at lock, '
                + 'and the set plays through the silent switch · UNTESTED on a locked phone: lock it mid-set and report whether a NEW title reaches the lock screen'
              : 'background audio — ' + (s.audioSessionAvailable ? 'the Audio Session type did not take (read back: ' + s.audioSession + ')'
                                                                 : 'this browser has no Audio Session API') + ' — nothing changes; use "keep screen on"')
          : 'mix routed through an <audio> element · output via ' + s.output + ' · element ' + s.audioElement
            + ' · UNTESTED on a locked phone: if the music stops a few seconds after locking, use "keep screen on"');
      } catch (e) { log('phone mode: ' + String((e && e.message) || e)); }
    }, PH.mode, GRP.cfg);
    /* a saved mode is re-applied on load so a phone set up once stays set up */
    if (PH.mode !== 'off') setTimeout(() => PH.set(PH.mode).catch(() => {}), 0);

    /* ── lock-screen art: the one pixel surface a web page gets on a locked
       iPhone is the Now Playing card's artwork (MediaMetadata.artwork).
       `poster` draws the chosen panel once per track; `live` redraws it once
       a second from DWLOOP.sample() and re-sends it — whether iOS repaints
       the card at that rate is the EXPERIMENT (deckwave-phone.js header has
       the falsifier). Needs phone: ≠ off to reach the lock screen at all. */
    if (PH.setArt) {
      const artKey = () => PH.art === 'off' ? 'off' : PH.art === 'poster' ? 'poster' : 'live:' + PH.artPanel;
      select('lock art', [
        { k: 'off', n: 'off' },
        { k: 'poster', n: 'poster · journey', hint: 'one image per track' },
        { k: 'live:journey',  n: 'live · set journey',  hint: '1/s · untested on a locked phone' },
        { k: 'live:position', n: 'live · track position', hint: '1/s · untested' },
        { k: 'live:camelot',  n: 'live · camelot wheel',  hint: '1/s · untested' },
        { k: 'live:spectrum', n: 'live · spectrum',  hint: '1/s — stills, not motion' }
      ], k => {
        try {
          const [a, panel] = k.split(':');
          PH.setArt(a, a === 'poster' ? 'journey' : panel);
          log(a === 'off' ? 'lock-screen art off — the card shows title, artist and bpm only'
            : a === 'poster' ? 'lock-screen art: one poster per track (set journey + title strip) — needs phone: background audio or keep screen on to reach the lock screen'
            : 'lock-screen art: ' + panel + ' redrawn once a second and re-sent as artwork · EXPERIMENT: lock the phone — does the card\'s art keep changing after two minutes, or change once and freeze?');
        } catch (e) { log('lock art: ' + String((e && e.message) || e)); }
      }, artKey(), GRP.cfg);
    }

    /* ── an incoming call pauses the set. ON by default (keeper, first
       Android run 2026-08-21: "The music needs to interrupt during a
       phone call received … By default anyway. This can be an option").
       iOS: WebKit interrupts the graph itself — heard on the iPhone;
       this toggle changes nothing there. Android: a bare Web Audio graph
       holds no audio focus, so a silent element holds it for the page
       and Chrome pausing that element at the ring is the signal
       (deckwave-phone.js, the `calls` block, has the mechanism and the
       falsifier). */
    if (window.DWPOPOUT) {
      /* ── the popout: panels on a projector, or a butterchurn party ──
         (keeper 2026-08-21, from the visualizer field survey). A separate
         window on its own rAF; `party` lazily loads the two vendored
         butterchurn files and rides the Player's analyser. The popup can
         only OPEN inside this click — which is why the whole thing is a
         select, not an API. */
      const PO = window.DWPOPOUT;
      const popOpts = [{ k: 'off', n: 'off' }]
        .concat((window.DWPANELS ? window.DWPANELS.list() : []).map(p => ({ k: p.k, n: p.n, hint: p.hint })))
        .concat([{ k: 'party', n: 'party · milkdrop', hint: 'butterchurn, vendored MIT · decoration, not an instrument · needs ▶ first' }]);
      select('⇱ popout', popOpts, async k => {
        try { log('popout: ' + await PO.set(k)); }
        catch (e) { log('popout: ' + String((e && e.message) || e)); }
      }, 'off', GRP.cfg);
    }

    if (PH.setCalls) {
      const cb = btn('call pauses the set: ' + (PH.calls ? 'on' : 'off'), () => {
        const on = PH.setCalls(!PH.calls);
        cb.textContent = 'call pauses the set: ' + (on ? 'on' : 'off');
        cb.className = on ? 'hot' : '';
        log(on ? 'an incoming call pauses the set and it resumes at hang-up — iOS: the system does it; Android: a silent element holds audio focus for the page · UNTESTED with a real call: receive one mid-set and report'
               : 'calls no longer pause the set — on Android the music will play straight through a ringing phone');
      }, PH.calls, GRP.cfg);
      cb.title = 'Android: the focus proxy starts with ▶; if music was started another way, one tap anywhere arms it';
    }
  }

  /* Two copies of one recording is still two songs the owner chose to keep.
     Off by default because an album track and its single really are the same
     master here, but it is a preference, not a fact about the music. */
  const db = btn('keep duplicate versions: off', () => {
    keepDupes = !keepDupes;
    db.textContent = 'keep duplicate versions: ' + (keepDupes ? 'on' : 'off');
    db.className = keepDupes ? 'hot' : '';
    log(keepDupes
      ? 'duplicates kept — album and single versions both enter the set. Rebuild to apply.'
      : 'duplicates merged — one copy of each recording, highest confidence wins. Rebuild to apply.');
  });
  db.dataset.grp = GRP.cfg;

  sep(GRP.files);
  /* ── the set menu, 2026-10-09 (UI review Part 5 §3) ──────────────────────
     Keeper: save and load set are not daily ("i don't use them daily"), so
     they leave the bar for one menu. The menu ANCHORS IN THE BAR, never on
     the Prepared card: the card is hidden whenever nothing is prepared
     (renderPrepared, `$('prepared').hidden = !candidate`), which is exactly
     the state in which a person needs Open Set (Part 3 §4). Same shape as
     the selects: a .sel wrapper, `open` toggled by its button, closed by the
     document click handler above. The two handlers are the ones that were
     on the bar; only their homes moved. save set loses its accent — it is
     not the next step in any flow (finding 24). */
  const setMenu = document.createElement('span');
  setMenu.className = 'sel'; setMenu.dataset.grp = GRP.files;
  const setMenuBtn = document.createElement('button');
  setMenuBtn.textContent = 'set';
  setMenuBtn.title = 'save this set to a file, or open a saved one';
  setMenuBtn.setAttribute('aria-haspopup', 'menu');
  setMenuBtn.onclick = e => { e.stopPropagation();
    const was = setMenu.classList.contains('open');
    sr.querySelectorAll('.sel,.pmenu,.hcard').forEach(o => o.classList.remove('open'));
    if (!was) setMenu.classList.add('open');
    setMenuBtn.setAttribute('aria-expanded', was ? 'false' : 'true'); };
  const setMenuList = document.createElement('div'); setMenuList.className = 'menu';
  setMenuList.setAttribute('role', 'menu');
  setMenu.appendChild(setMenuBtn); setMenu.appendChild(setMenuList);
  tp.insertBefore(setMenu, $('logLine'));
  const menuItem = (txt, fn, title) => {
    const b = document.createElement('button'); b.textContent = txt; b.setAttribute('role', 'menuitem');
    if (title) b.title = title;
    b.onclick = async e => { e.stopPropagation(); setMenu.classList.remove('open');
      setMenuBtn.setAttribute('aria-expanded', 'false');
      try { await fn(e); } catch (err) { dash.reportIssue(err, txt); log(err.message || err); } };
    setMenuList.appendChild(b); return b;
  };
  const saveBtn = menuItem('▾ save set', () => {
    const target = dash.fileSet;
    if (!target.length) { log('build a set first'); return; }
    const sc = window.DWSCORE.score(target, { xfade: 16 });
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const dl = (txt, name, mime) => { const b = new Blob([txt], { type: mime });
      const u = URL.createObjectURL(b), a = document.createElement('a');
      a.href = u; a.download = name; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 15000); };
    dl(JSON.stringify(sc, null, 2), 'deckwave-set-' + stamp + '.json', 'application/json');
    setTimeout(() => dl(window.DWSCORE.cue(sc, 'Deckwave'),
      'deckwave-set-' + stamp + '.cue', 'text/plain'), 350);
    log('downloaded · ' + sc.summary.tracks + ' tracks');
  }, 'a .json score and a .cue sheet — the set as a file, not audio (render flac is the audio, and it is not the live mix)');
  saveBtn.dataset.setAction = 'save';

  const lsb = menuItem('▴ load set', () => {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
    /* iOS needs the input IN THE DOCUMENT for the picker to show — the same
       reason and the same comment as LIB.pick() in deckwave.js. Detached, all
       three of these buttons were dead on the phone while looking live. */
    inp.style.display = 'none'; document.body.appendChild(inp);
    inp.oncancel = () => inp.remove();
    inp.onchange = async () => { if (!inp.files[0]) { inp.remove(); return; }
      try { const r = window.DWSCORE.load(await inp.files[0].text(), window.DW.corpus.map(t => ({ ...t })));
        if (r.missing.length) dash.reportIssue({ failures: r.missing.map(name => ({ name, message: 'not in the library — add this track and load the set again' })) }, 'load');
        dash.prepare(r.set);
        log('prepared ' + r.loaded + (r.missing.length ? ' · ' + r.missing.length + ' missing — open Issues' : ' · complete'));
      } catch (e) { dash.reportIssue(e, 'load'); log('load failed: ' + e.message); } finally { inp.remove(); } };
    inp.click();
  }, 'open a saved .json set — it is PREPARED, not played; press ▶ when ready. Open your music first or every track reads as missing');

  /* ── ROADMAP D1: the corpus cache finally has a button ────────────────
     The analysis cache is the most expensive thing in the browser — 12
     minutes of analysis for this library, and a different Essentia build
     may not reproduce it bit-for-bit — and clearing site data destroys it
     in one click. DWCACHE has existed to protect it since patch 06 and was
     reachable from the console only. Two buttons, beside the set's own.
     Restore MERGES by default (existing records are kept); the result is
     verified against the summary the file carries, not assumed. */
  const csb = btn('▾ save cache', async () => {
    if (!window.DWCACHE) { log('cache module not loaded'); return; }
    try {
      const r = await window.DWCACHE.export();
      log('cache saved · ' + r.summary.tracks + ' tracks · ' + r.summary.totalBeats + ' beats · ' + r.file);
    } catch (e) { log('cache export failed: ' + String((e && e.message) || e)); }
  });
  csb.dataset.grp = GRP.files;
  const clb = btn('▴ load cache', () => {
    if (!window.DWCACHE) { log('cache module not loaded'); return; }
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
    inp.style.display = 'none'; document.body.appendChild(inp);   /* iOS: see ▴ load set */
    inp.oncancel = () => inp.remove();
    inp.onchange = async () => { if (!inp.files[0]) { inp.remove(); return; }
      try {
        const r = await window.DWCACHE.restore(await inp.files[0].text(), 'merge');
        log('cache restored · ' + r.imported + ' records merged · store now ' + r.after.tracks +
            ' tracks · scan the folder again to use them');
      } catch (e) { log('cache restore failed: ' + String((e && e.message) || e)); } finally { inp.remove(); } };
    inp.click();
  });
  clb.dataset.grp = GRP.files;

  sep();
  const app = sr.querySelector('.app');
  const layoutSel = select('layout', [
    { k: 'auto', n: 'auto', hint: 'by aspect' },
    { k: 'mega', n: '▪ MEGA · all 12', hint: 'widescreen' },
    { k: '6', n: '6 across' }, { k: '5', n: '5 across' }, { k: '4', n: '4 across' },
    { k: '3', n: '3 across' }, { k: '2', n: '2 × n', hint: 'square' },
    { k: '1', n: 'single column', hint: 'tall' }
  ], k => {
    dash.layoutMode = k;
    if (k === 'mega') { log(DWDASH.mega(dash)); return; }
    if (k === 'auto') { log('layout: auto · ' + autoLayout(true)); return; }
    if (app.getAttribute('data-cols') === 'mega') {
      dash.slots.reset(window.DWPANELS.defaults);
      /* reset() rebuilds the cells without their fold controls; only
         apply() puts them back. __reset and mega() both call it — this path
         and autoLayout() did not, so leaving mega lost every ▾ */
      setTimeout(() => dash.applyFolds && dash.applyFolds(), 90);
    }
    app.setAttribute('data-cols', k);
    log('layout: ' + k); setTimeout(dash.fit, 80);
  }, 'auto');

  /* ── auto, actually automatic ──────────────────────────────────────────
     "auto" used to mean "remove the override and let a static grid decide",
     which was five columns from an aspect-ratio media query regardless of how
     much room there was. On a 1966px-wide window that left six panels in five
     columns, so one wrapped alone onto a second row.

     It now picks from the width actually available to the panel area, so the
     side column being wide, narrow or hidden all count.

     MIN_COL is a minimum readable panel width, not a signal threshold. 250px
     was chosen against the measured case: at 1966px viewport the panel area
     is ~1625px, which is 271px across six columns — so six fits with a little
     margin, and the number is one constant to move if that reads too tight.

     PANELS ARE ONLY SWAPPED WHEN YOU PICK auto, never on resize. Going mega
     calls slots.reset(ALL), which discards any arrangement you have made;
     doing that every time a window crossed a width would be hostile. Resize
     re-flows the columns and leaves the panel set alone. */
  const MIN_COL = 250;
  function autoLayout(mayChangePanels, atStartup) {
    const tri = $('tri');
    const w = tri ? tri.getBoundingClientRect().width : 0;
    const avail = w > 40 ? w : (innerWidth - 260);
    const cols = Math.max(1, Math.min(6, Math.floor(avail / MIN_COL)));
    if (cols >= 6) {
      if (mayChangePanels) { const r = DWDASH.mega(dash, atStartup);
        return 'MEGA · ' + r + ' · ' + cols + ' across'; }
      app.setAttribute('data-cols', 'mega');
      setTimeout(dash.fit, 80);
      return 'mega columns';
    }
    if (app.getAttribute('data-cols') === 'mega' && mayChangePanels && !atStartup) {
      dash.slots.reset(window.DWPANELS.defaults);
      setTimeout(() => dash.applyFolds && dash.applyFolds(), 90);   /* see the layout menu */
    }
    app.setAttribute('data-cols', String(cols));
    setTimeout(dash.fit, 80);
    return cols + ' across · ' + Math.round(avail) + 'px available';
  }

  /* Re-flow on resize, but only while the user is actually in auto. */
  let autoT;
  addEventListener('resize', () => {
    if (dash.layoutMode !== 'auto') return;
    clearTimeout(autoT); autoT = setTimeout(() => autoLayout(false), 140);
  });

  dash.layoutMode = 'auto';
  autoLayout(true, true);          /* startup: widen, but keep what was saved */

  const THEMES = ['cyberpunk','amber','classic','paper','mono','ice','stargaze','darkwing','sewage','expanse'];
  const SWATCH = { cyberpunk:['#04010f','#22e8ff','#ff2d95'], amber:['#0a0600','#ffb02e','#ff7020'],
    classic:['#000000','#00ff41','#ffff00'], paper:['#faf7f0','#2f6f8f','#a8452f'],
    mono:['#0c0c0c','#ffffff','#bbbbbb'], ice:['#020a14','#7fdcff','#c9a6ff'],
    stargaze:['#03040e','#8fd4ff','#ffd98a'], darkwing:['#0a0416','#b06bff','#ffd23f'],
    sewage:['#0d1108','#8fbf3f','#a87b2e'], expanse:['#04060c','#4fd8d0','#ff7a3c'] };
  let theme = 'cyberpunk';
  try { const sv = localStorage.getItem('dw-theme');
    if (sv && THEMES.includes(sv)) theme = sv; } catch (e) {}
  const applyTheme = t => { THEMES.forEach(x => dash.host.classList.remove('dw-theme-' + x));
    dash.host.classList.add('dw-theme-' + t); dash.theme = t;
    try { localStorage.setItem('dw-theme', t); } catch (e) {}
    setTimeout(dash.fit, 60); };
  applyTheme(theme);
  const themeSel = select('theme', THEMES.map(t => ({ k: t, n: t,
    sw: SWATCH[t] })), applyTheme, theme);
  /* THE TUNE — keeper, 2026-08-29, on the ultra review's E1: "Is there any
     way to build whatever it thinks was the 'proper' version as a
     uncheck-this-'deckwave-tune' box? so we're not messing up my mix but
     people can do whatever it is the reviewer thought was important."
     So: two wheels, deckwave tune the DEFAULT (every heard set was built
     on it), the standard one select away. DW.retune restamps the corpus
     so the two tunes never mix; the play order changes at the next build,
     and the log says so. */
  let tune0 = 'deckwave';
  try { if (localStorage.getItem('dw-tune') === 'standard') tune0 = 'standard'; } catch (e) {}
  select('tune', [
    { k: 'deckwave', n: 'deckwave tune',
      hint: 'the wheel every set here was mixed and HEARD with: a minor key shares its number with its PARALLEL major (Am = 11A beside A = 11B). Not the standard chart — kept as the default deliberately.' },
    { k: 'standard', n: 'standard camelot',
      hint: 'the standard wheel: a minor key shares its number with its RELATIVE major (Am = 8A beside C = 8B). Changes major↔minor scoring only; the play order changes at the NEXT build.' }
  ], k => {
    const r = window.DW.retune(k);
    log('tune: ' + (r.mode === 'standard' ? 'standard camelot' : 'deckwave tune')
      + ' · ' + r.restamped + ' of ' + r.corpus + ' keys restamped · the play order changes at the next build');
    renderList();
  }, tune0);
  /* THE OUTPUT — keeper, 2026-10-07: SteelSeries Sonar puts all of Chrome
     on its Chat channel (Google Meet lives there too), and Sonar sorts by
     process, so no tab can be told apart. The deck now picks its own
     output device (DW.setOutput → AudioContext.setSinkId); Sonar's
     channels are devices, so "SteelSeries Sonar - Media" works from inside
     Chrome. Shown only where the browser can do it. Remembered per browser
     as {id, label}. Device NAMES need the microphone permission once —
     Chromium's rule — so that is an explicit item, never automatic. */
  if (window.DW.output && window.DW.output.supported) {
    let saved = { id: '', label: '' };
    try { const s = JSON.parse(localStorage.getItem('dw-output') || 'null'); if (s && typeof s.id === 'string') saved = s; } catch (e) {}
    const outItems = [{ k: '', n: 'system default' }];
    const outSel = select('output', outItems, async k => {
      if (k === '__name') {
        outSel.set(saved.id);
        log('output: asking for the microphone once, only so the browser will name its outputs — nothing is recorded');
        try { await fillOutputs(true); log('output: ' + (outItems.length - 1) + ' devices named'); }
        catch (e) { log('output: not named — ' + ((e && e.message) || e)); }
        return;
      }
      const it = outItems.find(x => x.k === k);
      saved = { id: k, label: k ? ((it && it.label) || '') : '' };
      try { localStorage.setItem('dw-output', JSON.stringify(saved)); } catch (e) {}
      log(await window.DW.setOutput(k) + (k ? ' · ' + saved.label : ''));
    }, saved.id);
    async function fillOutputs(name) {
      const r = await window.DW.outputs(name);
      outItems.length = 1;
      for (const d of r.devices) if (d.label) outItems.push({ k: d.id, n: d.label, label: d.label });
      /* a saved device the browser no longer lists (unplugged, or the
         permission was revoked so ids are hidden) stays visible and
         selected, marked, rather than silently becoming "default" */
      if (saved.id && !outItems.some(x => x.k === saved.id))
        outItems.push({ k: saved.id, n: (saved.label || 'saved device') + ' (not listed now)', label: saved.label });
      if (!r.named) outItems.push({ k: '__name', n: 'name my outputs…', hint: 'asks for the microphone ONCE so the browser will show device names (e.g. SteelSeries Sonar - Media); the mic is closed at once and nothing is recorded' });
      outSel.set(saved.id);
    }
    if (saved.id) window.DW.setOutput(saved.id);
    fillOutputs(false).catch(() => {});
    if (navigator.mediaDevices && navigator.mediaDevices.addEventListener)
      navigator.mediaDevices.addEventListener('devicechange', () => fillOutputs(false).catch(() => {}));
  }
  /* A saved view carries its theme and its column count. views.load() puts
     the attributes on the grid but could not reach these controls, so the
     theme never changed, the layout label kept its old text, and
     dash.layoutMode stayed 'auto' — the next resize then overwrote the
     loaded columns. Handed over here, where the controls live. */
  dash.onViewLoaded = v => {
    if (v.theme && THEMES.includes(v.theme) && v.theme !== dash.theme) { applyTheme(v.theme); themeSel.set(v.theme); }
    const k = v.cols || 'auto';
    dash.layoutMode = k; layoutSel.set(k);
  };


  let viewSel;
  const viewItems = () => dash.views.list().map(n => ({ k: n, n }))
    .concat([{ k: '__save', n: '⭳ save current as…' },
             { k: '__reset', n: '↺ reset to default' },
             { k: '__export', n: '⤓ export views' },
             { k: '__import', n: '⤒ import views' }]);
  const onView = k => {
    if (k === '__save') { const n = prompt('Name this view:');
      if (n) { dash.views.save(n); log('saved view “' + n + '”'); rebuildViews(); } return; }
    if (k === '__reset') { dash.slots.reset(window.DWPANELS.defaults);
      setTimeout(() => { dash.applyFolds(); dash.fit(); }, 80); log('views reset'); return; }
    if (k === '__export') { const b = new Blob([dash.views.export()], { type: 'application/json' });
      const u = URL.createObjectURL(b), a = document.createElement('a');
      a.href = u; a.download = 'deckwave-views.json';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(u), 9000); log('views exported'); return; }
    if (k === '__import') { const i = document.createElement('input');
      i.type = 'file'; i.accept = '.json';
      i.style.display = 'none'; document.body.appendChild(i);   /* iOS: see ▴ load set */
      i.oncancel = () => i.remove();
      i.onchange = async () => { if (!i.files[0]) { i.remove(); return; }
        try { const n = dash.views.import(await i.files[0].text());
          log('imported ' + n + ' views'); rebuildViews(); }
        catch (e) { log('import failed: ' + e.message); } finally { i.remove(); } };
      i.click(); return; }
    /* load() returns null for a view with no panel list rather than letting
       slots.build() throw out here, where nothing catches it and the press
       would produce no panels AND no message. Say which happened. */
    log(dash.views.load(k) ? 'view: ' + k : 'view "' + k + '" has no panel list — not loaded');
  };
  function rebuildViews() { if (viewSel) viewSel.el.remove();
    viewSel = select('view', viewItems(), onView, dash.views.list()[0] || 'default'); }
  if (!dash.views.list().length) dash.views.save('default');
  rebuildViews();

  /* ── recovered from the live build ────────────────────────────────────
     The packaged transport was missing these three. The engine could already
     do all of it — DWLISTEN.mic() has been there the whole time, and the two
     layout modes are attribute flips the CSS above now carries again. */

  select('list', [
    { k: 'show', n: 'track list on' },
    { k: 'wide', n: 'track list wide', hint: 'wider column' },
    { k: 'hide', n: 'track list off', hint: 'panels full width' }
  ], k => {
    k === 'show' ? app.removeAttribute('data-side') : app.setAttribute('data-side', k);
    /* The now-playing card lives in this column, so hiding it takes the card
       too. Say so on the button rather than leaving it lit for something the
       user cannot see. */
    const nb = [...tp.querySelectorAll('button')].find(b => /^now playing/.test(b.textContent));
    if (nb) {
      const gone = k === 'hide';
      nb.disabled = gone;
      nb.title = gone ? 'hidden with the track list' : '';
      /* Repaint from the CARD, not from this handler's own opinion. Hiding
         cleared `hot`; showing restored `disabled` and `title` and left the
         button dark while the card was back on screen. The next click then
         called toggle(), which returns the NEW visible state — so a dark
         button turned the card OFF and took two presses to bring it back.
         The card's own box is the only thing that knows: hiding the column
         is CSS on `.side` and never touches `#npBox.hidden`. */
      const box = sr.getElementById('npBox');
      nb.className = (!gone && box && !box.classList.contains('hidden')) ? 'hot' : '';
    }
    log('track list: ' + k + (k === 'hide' ? ' · now playing hidden with it' : ''));
    setTimeout(dash.fit, 80);
  }, 'show');

  /* Centre sprite for the camelot wheel. Recovered from the live build; the
     alternatives are original shapes. */
  /* Built from the LIVE registry, not a hardcoded list — a module that
     registers a sprite after this file loads (deckwave-sprites.js does)
     used to be invisible here, which is exactly how the duck went missing.
     The originals keep their hints and their order; anything registered
     later is appended with the theme it belongs to as its hint. */
  {
    const HINT = { jam: 'the original', robot: 'wee dude', orbit: 'quieter',
                   pulse: 'level bars', auto: 'follows theme' };
    const OG = ['jam', 'robot', 'orbit', 'pulse', 'none'];
    const live = (window.DWPANELS && window.DWPANELS.sprites) || OG;
    const byTheme = (window.DWSPRITES && window.DWSPRITES.byTheme) || {};
    const themeOf = id => Object.keys(byTheme).find(t => byTheme[t] === id) || '';
    const order = OG.filter(k => live.includes(k))
      .concat(live.filter(k => !OG.includes(k)));
    select('sprite', order.map(k => ({ k, n: k, hint: HINT[k] || themeOf(k) })),
      k => { window.DWPANELS.sprite = k; log('sprite: ' + k); },
      (window.DWPANELS && window.DWPANELS.sprite) || 'jam');
  }

  select('density', [
    { k: '0', n: 'comfortable' },
    { k: '1', n: 'dense', hint: 'tighter rows' }
  ], k => {
    k === '1' ? app.setAttribute('data-dense', '1') : app.removeAttribute('data-dense');
    log('density: ' + (k === '1' ? 'dense' : 'comfortable')); setTimeout(dash.fit, 80);
  }, '0');

  /* Carried over from the transport mount() used to build inline. It is the
     one control the newer bar did not already have, and dropping it while
     de-duplicating would have lost a working feature to a cleanup. */
  const mb = btn('– compact', () => {
    const on = app.classList.toggle('mini');
    dash.host.classList.toggle('mini-host', on);
    const nl = $('nowline'); if (nl) nl.style.display = on ? 'block' : 'none';
    mb.textContent = on ? '+ expand' : '– compact';
    mb.className = on ? 'hot' : '';
    setTimeout(dash.fit, 60); }, false, GRP.cfg);

  sep(GRP.cap);
  /* Both capture buttons paint from ONE fact — DWLISTEN.kind — rather than
     each remembering what it last did. Starting one while the other was
     live stopped the capture but left the other button lit; Chrome's own
     "Stop sharing" bar ends the stream without telling either. Painted
     after every action and on a slow tick so the external stop is seen. */
  const paintCapture = () => {
    const L = window.DWLISTEN, k = L && L.kind;
    lb.textContent = k === 'tab' ? '◉ listening' : '◉ listen to a tab'; lb.className = k === 'tab' ? 'hot' : '';
    ib.textContent = k === 'mic' ? '◉ input live' : '◉ input';        ib.className = k === 'mic' ? 'hot' : '';
  };
  const lb = btn('◉ listen to a tab', async () => {
    if (window.DWLISTEN.kind === 'tab') { window.DWLISTEN.stop(); paintCapture(); log('stopped listening'); return; }
    try { log('pick a tab · tick "Share tab audio"');
      const r = await window.DWLISTEN.tab();
      log('listening to ' + r.source.slice(0, 40) + ' · visuals only, no analysis');
    } catch (e) { dash.reportIssue(e, 'tab capture'); log(String(e.message || e)); }
    paintCapture(); });
  lb.dataset.grp = GRP.cap;

  /* Offline bounce to FLAC. Deliberately NOT labelled "export mix" — what it
     writes is not what you hear, because the render does not time-stretch.
     See the header of deckwave-render.js. */
  const rb = btn('⤓ render flac', async () => {
    if (!window.DWRENDER) { log('render module not loaded'); return; }
    const set = dash.fileSet || [];
    if (!set.length) { log('build a set first'); return; }
    const est = window.DWRENDER.estimate(set, {});
    if (est.overCeiling) {
      log(est.totalSeconds.toFixed(0) + 's set = ' + est.gb + 'GB · too big — rendering the first 20 min');
    }
    const to = est.overCeiling ? 1200 : undefined;
    rb.className = 'hot';
    try {
      const r = await window.DWRENDER.exportMix(set, { to, onStatus: log });
      log('saved ' + r.file + ' · ' + r.mb + 'MB · ' + r.tracks + ' tracks · NOT tempo-matched');
    } catch (e) {
      dash.reportIssue(e, 'render');
      log('render failed: ' + String((e && e.message) || e));
    } finally { rb.className = ''; }
  });
  rb.dataset.grp = GRP.files;
  rb.dataset.setAction = 'render';

  /* Recovered from the live build. DWLISTEN.mic() was already in the package;
     nothing in the packaged UI ever called it. Same catch as scan — cancelling
     a permission prompt rejects, and an uncaught rejection leaves the log
     line lying about what it is waiting for. */
  const ib = btn('◉ input', async () => {
    if (window.DWLISTEN.kind === 'mic') { window.DWLISTEN.stop(); paintCapture(); log('stopped listening'); return; }
    try { log('pick an input device…');
      const r = await window.DWLISTEN.mic();
      log('input: ' + r.source.slice(0, 40) + ' · visuals only, no analysis');
    } catch (e) {
      dash.reportIssue(e, 'input capture');
      log(e && e.name === 'NotAllowedError' ? 'input permission refused'
        : String((e && e.message) || e));
    }
    paintCapture(); });
  ib.dataset.grp = GRP.cap;
  setInterval(paintCapture, 1000);

  /* now playing — restored to the always-visible row. It answers "what is
     happening", which is a performance question, not an appearance one. */
  const nb = btn('now playing', () => {
    const on = window.DWNOWPLAYING && window.DWNOWPLAYING.toggle();
    nb.className = on ? 'hot' : ''; }, false, GRP.play);
  nb.className = 'hot';

  /* ── master level ──────────────────────────────────────────────────────
     Web Audio output belongs to this page's AudioContext, so this cannot
     touch any other tab or application — it is Deckwave's level, not the
     system's. Reads and writes DW.volume, which survives boot() and kill()
     because the value is held outside the graph. */
  const vol = document.createElement('span');
  vol.className = 'vol'; vol.dataset.grp = GRP.play;
  const vlabel = document.createElement('u');
  const vslider = document.createElement('input');
  vslider.type = 'range'; vslider.min = '0'; vslider.max = '100'; vslider.step = '1';
  vslider.setAttribute('aria-label', 'master level');
  const paintVol = () => {
    const pct = Math.round(window.DW.volume * 100);
    vslider.value = String(pct);
    vlabel.textContent = 'level ' + pct + '%';
    vslider.title = 'master level ' + pct + '%';
  };
  vslider.oninput = () => { window.DW.volume = (+vslider.value) / 100; paintVol(); };
  paintVol();
  /* REPAINT FROM THE ENGINE, not only from our own oninput. DW.volume is
     moved behind this control by every duck — DWEVENTS' `duck` intent, a
     speech duck, a RECON `level` record, the eleven dial — and until
     2026-08-30 the only writers of the label were the drag handler and this
     one call at build. So the transport read `level 85%` with the thumb at
     85 while the master gain was 0.26: ledger 33/40's shape (a control
     holding a copy of a number the engine owns) on the master level.
     `paintCapture` 30 lines up already runs on a tick for exactly this
     reason — Chrome's own Stop-sharing bar ends a stream without telling us.
     Skipped while the slider has focus so it cannot fight a drag.
     NOTE, still open and the keeper's call: a drag made WHILE ducked writes
     DW.volume, and unduck restores the pre-duck absolute, silently
     discarding it. Fixing that means ducking by ratio — a change to
     deckwave-events.js, not here. */
  setInterval(() => { if (document.activeElement !== vslider) paintVol(); }, 1000);
  vol.appendChild(vlabel); vol.appendChild(vslider);
  tp.insertBefore(vol, $('logLine'));

  /* ── ■ stop: DEMOTED and TITLED, 2026-10-09 (UI review Part 5 §6) ────────
     stop() clears both decks, so the next ▶ falls through to DW.play(set, 0)
     and the set restarts from track 1 — the loss the ▶ guard above was
     written to prevent, reachable by one button that never said so. The
     keeper's call: keep it, last in the transport, and let the title say what
     ▶ does afterwards. "Remember the index" was declined: stop() bumps `gen`
     and drops every source, so a resume after it would be a fresh
     play(order, idx), a cut from the top of the track, not a resume — and it
     would reopen the paused-set guard reasoning. The engine is untouched. */
  const stopBtn = btn('■ stop', () => log(window.DW.stop()), false, GRP.play);
  stopBtn.title = 'stops the set — ▶ then starts again from track 1 (pause keeps your place)';

  /* ── reset audio engine: out of the transport, 2026-10-09 (Part 5 §5) ──
     Was `kill`, a bare button beside stop with no title, visible at all
     times on desktop. It is stop() plus closing the AudioContext — the "last
     resort — always works, whatever state the graph is in" button for a
     wedged engine (the popping question, ledgers 65/69, still unheard). The
     keeper has not needed it to clear popping, so it goes behind the ⚙
     drawer as the Troubleshoot entry; `DW.kill()` stays in the console. The
     drawer is DOM only, so a wedged graph cannot stop it opening. Settings
     has no sections yet; when it gets them this is the first Troubleshoot
     item. */
  const killBtn = btn('reset audio engine', () => log(window.DW.kill()), false, GRP.cfg);
  killBtn.title = 'troubleshoot — last resort if sound is stuck: stops everything and closes the audio engine; ▶ boots a fresh one from track 1. Always works, whatever state the graph is in.';

  /* ── the collapse ──────────────────────────────────────────────────────
     One toggle for everything in the cfg group. Persisted, because a
     performer who collapsed it does not want it back on every reload. */
  let cfgOpen = false;
  try { cfgOpen = localStorage.getItem('dw-cfg-open') === '1'; } catch (e) {}
  const cfgBtn = btn('⚙ display', () => {
    cfgOpen = !cfgOpen; applyCfg();
    try { localStorage.setItem('dw-cfg-open', cfgOpen ? '1' : '0'); } catch (e) {}
    setTimeout(dash.fit, 80);
  }, false, GRP.deck);

  function applyCfg() {
    tp.querySelectorAll('[data-grp="' + GRP.cfg + '"]')
      .forEach(el => { el.style.display = cfgOpen ? '' : 'none'; });
    /* on a phone the files and capture groups fold behind this toggle too;
       the class is what the phone CSS keys on, harmless on a desktop */
    tp.classList.toggle('cfg-open', cfgOpen);
    cfgBtn.textContent = cfgOpen ? '⚙ display ▴' : '⚙ display';
    cfgBtn.className = cfgOpen ? 'hot' : '';
  }

  /* ── order the row by group ────────────────────────────────────────────
     Controls were added over many sessions in the order they were written,
     so DOM order and grouping had drifted apart — render flac sat between the
     two capture buttons. Reordering here rather than at each call site keeps
     the handlers untouched and makes the grouping a single readable list.
     Separators are rebuilt from scratch so they always land between groups
     and never orphan at an end. */
  function regroup() {
    const order = [GRP.deck, GRP.play, GRP.files, GRP.cap, GRP.cfg];
    tp.querySelectorAll('.sep').forEach(s => s.remove());
    const logLine = $('logLine');
    order.forEach((g, gi) => {
      const items = [...tp.children].filter(el => el.dataset && el.dataset.grp === g);
      if (!items.length) return;
      if (gi > 0) {
        const s = document.createElement('span');
        s.className = 'sep'; s.dataset.grp = g === GRP.cfg ? GRP.cfg : g;
        tp.insertBefore(s, logLine);
      }
      items.forEach(el => tp.insertBefore(el, logLine));
    });
  }
  regroup();
  applyCfg();
}

return { mount, CSS, get _dev() { return lastDash; } };
})()


/* ─────────────────────────────────────────────────────────────────────────
   SLOTS — every cell is a swap point.

   Each .tri child is a slot backed by the panel registry. Hovering a panel
   reveals a "?" (explanation + Wikipedia) and a "swap" control. The chosen
   layout persists to localStorage; "reset views" restores DWPANELS.defaults.

   Note the ordering constraint learned the hard way: the grid reflows when a
   slot changes WITHOUT the window ever resizing, so every mutation schedules
   a fit(). A canvas whose buffer was never resized draws perfectly into a
   300x150 nobody sized, which looks exactly like a broken renderer.
   ───────────────────────────────────────────────────────────────────────── */
DWDASH.slots = function (dash) {
  const sr = dash.shadow, tri = sr.querySelector('.tri');
  const KEY = 'dw-slots-v1';
  const slots = [];

  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(slots.map(s => s.panel))); } catch (e) {} };
  const restore = () => { try { const v = JSON.parse(localStorage.getItem(KEY)); return Array.isArray(v) ? v : null; } catch (e) { return null; } };

  function paint(slot) {
    const p = window.DWPANELS.get(slot.panel);
    slot.lbl.textContent = p ? p.label : slot.panel;
    /* Re-tag the glossary here, not just after build/reset. A swap never
       touches either of those — the menu handler calls paint() directly — so
       the label kept the PREVIOUS panel's `data-gl` and hovering it showed the
       old topic. Third time this class of bug has landed (ledger 20); the
       first two fixes each covered the rebuild path and missed the swap. */
    if (dash.glossary && dash.glossary.tag) setTimeout(dash.glossary.tag, 0);
    slot.menu.innerHTML = window.DWPANELS.list().map(x =>
      `<button type="button" data-k="${x.k}" class="${x.k === slot.panel ? 'on' : ''}">${x.n}${x.hint ? '<b>' + x.hint + '</b>' : ''}</button>`).join('');
    slot.menu.querySelectorAll('button').forEach(el => el.onclick = ev => {
      ev.stopPropagation(); slot.panel = el.dataset.k;
      slot.menu.classList.remove('open'); paint(slot); save();
      slot.el.querySelector('.swap').focus();
      setTimeout(dash.fit, 40);
    });
  }

  function help(slot) {
    const w = window.DWPANELS.wiki(slot.panel);
    if (!w) { slot.help.innerHTML = '<p>No reference for this panel.</p>'; return; }
    slot.help.innerHTML =
      `<h4>${w.t}</h4><p>${w.d}</p>` +
      `<a href="${w.u}" target="_blank" rel="noopener">Wikipedia &rarr; ${w.t}</a>` +
      `<em>${w.verified ? 'link verified' : 'article title unverified — opens Wikipedia search'}</em>`;
  }

  /* Place a fixed-position popup against its trigger, inside the viewport.
     Opens downward when there is room and flips up when there is not, and
     clamps its height to the gap it actually got — so the internal scrollbar
     covers whatever is left over instead of the list running off the screen.
     MEASURED, not assumed: the box is shown before measuring, because a
     display:none element reports a zero rect and every clamp computed from
     it would be wrong in the same silent way. */
  const GAP = 6;
  function placeMenu(el, btn, minW) {
    const b = btn.getBoundingClientRect();
    el.style.maxHeight = 'none';
    el.style.left = '0px'; el.style.top = '0px';
    el.style.minWidth = minW + 'px';
    const wNat = el.getBoundingClientRect().width || minW;
    const below = innerHeight - b.bottom - GAP * 2, above = b.top - GAP * 2;
    const down = below >= Math.min(220, above) || below >= above;
    const room = Math.max(120, down ? below : above);
    el.style.maxHeight = room + 'px';
    const hNow = Math.min(el.getBoundingClientRect().height, room);
    let left = Math.min(b.right - wNat, innerWidth - wNat - GAP);
    el.style.left = Math.max(GAP, left) + 'px';
    el.style.top = (down ? b.bottom + GAP : Math.max(GAP, b.top - GAP - hNow)) + 'px';
  }

  /* A fixed popup does not travel with its cell, so anything that moves the
     grid under it has to close it rather than leave it stranded. */
  addEventListener('resize', () => {
    sr.querySelectorAll('.pmenu,.hcard').forEach(m => m.classList.remove('open')); });
  tri.addEventListener('scroll', () => {
    sr.querySelectorAll('.pmenu,.hcard').forEach(m => m.classList.remove('open')); }, { passive: true });

  function build(defaults) {
    tri.innerHTML = ''; slots.length = 0;
    const want = restore() || defaults;
    want.forEach((pid, i) => {
      if (!window.DWPANELS.has(pid)) pid = defaults[i] || 'spectrum';
      const cid = 'slot' + i;
      const d = document.createElement('div'); d.className = 'strip';
      d.innerHTML = `<u><span class="lbl"></span><button type="button" class="hbtn" aria-label="Panel help">?</button><button type="button" class="swap" aria-label="Swap panel">swap &#9662;</button></u>`
                  + `<div class="cw"><canvas id="${cid}"></canvas></div>`
                  + `<span class="pmenu"></span><div class="hcard"></div>`;
      tri.appendChild(d);
      const slot = { i, el: d, cid, panel: pid, canvas: d.querySelector('canvas'),
        lbl: d.querySelector('.lbl'), menu: d.querySelector('.pmenu'), help: d.querySelector('.hcard') };
      slot.ctx = slot.canvas.getContext('2d');
      dash.C[cid] = slot.canvas; dash.X[cid] = slot.ctx;
      slots.push(slot); paint(slot);

      const swapBtn = d.querySelector('.swap'), helpBtn = d.querySelector('.hbtn');
      swapBtn.onclick = e => { e.stopPropagation();
        sr.querySelectorAll('.pmenu,.hcard').forEach(m => { if (m !== slot.menu) m.classList.remove('open'); });
        const opening = !slot.menu.classList.contains('open');
        slot.menu.classList.toggle('open');
        if (opening) { placeMenu(slot.menu, swapBtn, 190); slot.menu.querySelector('button')?.focus(); } };
      slot.menu.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); slot.menu.classList.remove('open'); swapBtn.focus(); } });
      helpBtn.onclick = e => { e.stopPropagation();
        sr.querySelectorAll('.pmenu,.hcard').forEach(c => { if (c !== slot.help) c.classList.remove('open'); });
        help(slot);
        const opening = !slot.help.classList.contains('open');
        slot.help.classList.toggle('open');
        if (opening) { placeMenu(slot.help, helpBtn, Math.max(240, d.getBoundingClientRect().width - 12)); slot.help.querySelector('a')?.focus(); } };
      slot.help.addEventListener('keydown', e => { if (e.key === 'Escape') { e.stopPropagation(); slot.help.classList.remove('open'); helpBtn.focus(); } });
      d.onclick = e => e.stopPropagation();
      if (dash.ro) dash.ro.observe(d);
    });
    setTimeout(dash.fit, 60);
  }

  document.addEventListener('click', () => {
    sr.querySelectorAll('.pmenu,.hcard').forEach(m => m.classList.remove('open')); });

  build(window.DWPANELS.defaults);

  return {
    build, save, get slots() { return slots; },
    /* Does the keeper have an arrangement of their own saved? mega() needs to
       know, so that a page load can honour it instead of overwriting it. */
    hasStored: () => restore() !== null,
    set(i, pid) { if (slots[i] && window.DWPANELS.has(pid)) { slots[i].panel = pid; paint(slots[i]); save(); } },
    reset(d) { try { localStorage.removeItem(KEY); } catch (e) {} build(d || window.DWPANELS.defaults); },
    layout: () => slots.map(s => s.panel)
  };
};


/* ─────────────────────────────────────────────────────────────────────────
   HEADER GLOSSARY — quiet mouseover on each top-bar term.

   Each entry explains what the number means IN THIS SYSTEM, not just the
   general concept, and links to Wikipedia. verified:true was confirmed to
   resolve; the rest use the search URL, same discipline as the panels.
   ───────────────────────────────────────────────────────────────────────── */
DWDASH.TERMS = {
  kPos: { t:'DJ mix', u:'https://en.wikipedia.org/wiki/Special:Search?search=DJ+mix', verified:false,
    d:'Position in the set — which track of how many, counted from the track on the DECK. Click any row in the list for the steering menu: blend in now, queue as next, a scenic or fast route, or a plain jump.' },
  kBpm: { t:'Tempo', u:'https://en.wikipedia.org/wiki/Tempo', verified:false,
    d:'The rolling target in beats per minute. It drifts 35% toward each incoming track rather than holding one fixed BPM, which is how a set can climb 100 → 150 without over-stretching anything.' },
  kKey: { t:'Key (music)', u:'https://en.wikipedia.org/wiki/Key_(music)', verified:false,
    d:'The current key in Camelot notation — 12 numbers, A for minor and B for major. Adjacent numbers are a perfect fifth apart; the same number with the other letter is the relative major or minor.' },
  kStr: { t:'Audio time stretching and pitch scaling', u:'https://en.wikipedia.org/wiki/Audio_time_stretching_and_pitch_scaling', verified:true,
    d:'How far the DECK is bending this track from its native tempo, with pitch preserved — the live rate, not the plan. Amber past 8%. Beyond roughly 15% the stretch becomes an audible wobble — a perceptual limit, not a preference, which is why beatmatched transitions stay inside 8% and anything further away is played straight instead. ∿ means straight: unstretched because it is not being beatmatched, so there is no figure to print.' },
  kHit: { t:'Onset detection', u:'https://en.wikipedia.org/wiki/Special:Search?search=onset+detection+audio', verified:false,
    d:'Bass onsets in the last 8 seconds, found with spectral flux — frame-to-frame positive change in the low bins. It measures CHANGE rather than level, because sidechained music holds bass energy near constant and a loudness threshold never fires.' },
  kReg: { t:'Spectral centroid', u:'https://en.wikipedia.org/wiki/Special:Search?search=spectral+centroid', verified:false,
    d:'The magnitude-weighted mean frequency — the standard measure of perceived brightness. Drives the palette when register colour is on. Heavily damped so it drifts rather than flickers.' }
};

DWDASH.glossary = function (dash) {
  const sr = dash.shadow;
  Object.keys(DWDASH.TERMS).forEach(id => {
    const b = sr.getElementById(id); if (!b) return;
    const kv = b.closest('.kv'); if (!kv || kv.querySelector('.tip')) return;
    const w = DWDASH.TERMS[id];
    const tip = document.createElement('span'); tip.className = 'tip';
    tip.innerHTML = `<h5>${w.t}</h5><p>${w.d}</p>`
      + `<a href="${w.u}" target="_blank" rel="noopener">Wikipedia &rarr; ${w.t}</a>`
      + `<em>${w.verified ? 'link verified' : 'article title unverified — opens Wikipedia search'}</em>`;
    kv.appendChild(tip);
  });
};


/* ─────────────────────────────────────────────────────────────────────────
   VIEWS — a saved view is the whole arrangement, not just the panel list:
   which panels, column count, sidebar state, density, theme, and which
   panels are folded. Exportable so a layout can travel between machines.
   ───────────────────────────────────────────────────────────────────────── */
DWDASH.views = function (dash) {
  const sr = dash.shadow, KEY = 'dw-views-v1', FOLD = 'dw-folded-v1';
  const app = () => sr.querySelector('.app');
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const write = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} };
  const folds = () => { try { return JSON.parse(localStorage.getItem(FOLD)) || {}; } catch (e) { return {}; } };

  /* A VIEW IS ONLY A VIEW IF IT CARRIES A PANEL LIST.
     `import()` used to take whatever was under `views` on the sole strength
     of the `format` field, so a file whose `panels` was a string, a number
     or absent was stored happily — and the throw came later and elsewhere,
     inside slots.build()'s `want.forEach`, on the line that SELECTS the
     view, which is not in any try. The result was ledger 115's shape
     exactly: a control that does nothing and says nothing. Refuse at the
     door with a sentence, and treat an already-stored bad view (from before
     this gate, or hand-edited localStorage) as unloadable rather than
     fatal. */
  const validView = v => !!v && typeof v === 'object' && Array.isArray(v.panels)
    && v.panels.length > 0 && v.panels.every(p => typeof p === 'string');

  return {
    list: () => Object.keys(read()),
    snapshot() {
      const a = app();
      return { panels: dash.slots.layout(), cols: a.getAttribute('data-cols') || 'auto',
        side: a.getAttribute('data-side') || 'show', dense: a.getAttribute('data-dense') || '0',
        theme: dash.theme || 'cyberpunk', folded: folds() };
    },
    save(name) { if (!name) return null; const all = read(); all[name] = this.snapshot(); write(all); return name; },
    load(name) {
      const v = read()[name]; if (!validView(v)) return null;
      try { localStorage.setItem('dw-slots-v1', JSON.stringify(v.panels)); } catch (e) {}
      try { localStorage.setItem(FOLD, JSON.stringify(v.folded || {})); } catch (e) {}
      dash.slots.build(v.panels);
      const a = app();
      v.cols  === 'auto' ? a.removeAttribute('data-cols')  : a.setAttribute('data-cols', v.cols);
      v.side  === 'show' ? a.removeAttribute('data-side')  : a.setAttribute('data-side', v.side);
      v.dense === '0'    ? a.removeAttribute('data-dense') : a.setAttribute('data-dense', v.dense);
      if (dash.onViewLoaded) dash.onViewLoaded(v);      /* theme + layout controls */
      setTimeout(() => { dash.applyFolds(); dash.fit(); }, 80);
      return name;
    },
    remove(n) { const all = read(); delete all[n]; write(all); return n; },
    export() { return JSON.stringify({ format: 'deckwave-views', version: 1, views: read() }, null, 2); },
    import(j) {
      const d = typeof j === 'string' ? JSON.parse(j) : j;
      if (d.format !== 'deckwave-views') throw new Error('not a deckwave views file');
      if (!d.views || typeof d.views !== 'object' || Array.isArray(d.views))
        throw new Error('the file carries no views');
      const bad = Object.keys(d.views).filter(k => !validView(d.views[k]));
      if (bad.length) throw new Error('refused — ' + bad.length + ' view'
        + (bad.length > 1 ? 's have' : ' has') + ' no panel list: ' + bad.slice(0, 3).join(', '));
      const all = read(); Object.assign(all, d.views); write(all);
      return Object.keys(d.views).length;
    }
  };
};

/* MEGA — every registered panel at once, for a widescreen monitor. */
/* keep=true means "widen to six columns but do not touch the panel choice".
   Startup passes it. Without it every page load ran slots.reset(ALL), and
   reset() clears the saved layout before rebuilding — so any panel swapped in
   by hand was gone on the next load, and the arrangement had to be rebuilt
   every single time. The comment above autoLayout already said doing this
   unbidden would be hostile; it was being done on every load regardless.

   Choosing "mega" from the layout menu still means all twelve. That is what
   picking it is for. The difference is that a page load is not a choice. */
DWDASH.mega = function (dash, keep) {
  if (keep && dash.slots.hasStored()) {
    dash.shadow.querySelector('.app').setAttribute('data-cols', 'mega');
    setTimeout(() => { dash.applyFolds(); dash.fit(); }, 120);
    return dash.slots.slots.length + ' panels · kept your arrangement';
  }
  try { localStorage.removeItem('dw-folded-v1'); } catch (e) {}
  dash.slots.reset(window.DWPANELS.ALL);
  dash.shadow.querySelector('.app').setAttribute('data-cols', 'mega');
  setTimeout(() => { dash.applyFolds(); dash.fit(); }, 120);
  return window.DWPANELS.ALL.length + ' panels';
};

/* Collapse/expand per panel, persisted by panel id. */
DWDASH.folds = function (dash) {
  const KEY = 'dw-folded-v1';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } };
  const write = o => { try { localStorage.setItem(KEY, JSON.stringify(o)); } catch (e) {} };
  return function apply() {
    const f = read();
    dash.slots.slots.forEach(s => {
      const u = s.el.querySelector('u');
      let btn = u.querySelector('.fold');
      if (!btn) {
        btn = document.createElement('button'); btn.type = 'button'; btn.className = 'fold';
        u.insertBefore(btn, u.querySelector('.swap'));
        btn.onclick = e => { e.stopPropagation();
          const st = read(); st[s.panel] = !st[s.panel]; write(st);
          apply(); setTimeout(dash.fit, 60); };
      }
      const on = !!f[s.panel];
      s.el.classList.toggle('collapsed', on);
      btn.textContent = on ? '\u25b8' : '\u25be';
      btn.title = on ? 'expand' : 'collapse';
      btn.setAttribute('aria-label', (on ? 'Expand ' : 'Collapse ') + s.panel);
      btn.setAttribute('aria-expanded', String(!on));
    });
  };
};


/* ─────────────────────────────────────────────────────────────────────────
   GLOSSARY BINDING — hover any term, get what it means here.

   The tooltips vanished twice before this. Both times the cause was the
   same: help was added by patching slot construction, so any rebuild
   (reset, mega, a layout change) recreated the cells without it.

   The fix is not a better patch. It is that terms live in DWMSG as DATA and
   elements are tagged with data-gl="key", so rebuilding re-tags rather than
   re-creating. Nothing can be dropped because nothing was ever stored in
   the DOM.

   One popup element is reused and repositioned rather than one per term —
   with twelve panels and a dozen header fields that is the difference
   between 1 node and 40.
   ───────────────────────────────────────────────────────────────────────── */
DWDASH.glossaryBind = function (dash) {
  const sr = dash.shadow;
  let pop = sr.getElementById('glpop');
  if (!pop) { pop = document.createElement('div'); pop.className = 'glpop';
    pop.id = 'glpop'; sr.appendChild(pop);
    pop.onmouseenter = () => pop.classList.add('on');
    pop.onmouseleave = () => pop.classList.remove('on'); }

  function show(el, key) {
    const m = window.DWMSG.term(key); if (!m) return;
    pop.innerHTML = '<h5>' + m.t + '</h5>' + m.d
      + (m.w ? '<a href="' + m.w + '" target="_blank" rel="noopener">Wikipedia &rarr; '
        + m.t + '</a><em>' + (m.verified ? window.DWMSG.ui('ui.verified')
        : window.DWMSG.ui('ui.unverified')) + '</em>' : '');
    pop.classList.add('on');
    const r = el.getBoundingClientRect(), pr = pop.getBoundingClientRect();
    let left = r.left, top = r.bottom + 6;
    if (left + pr.width > innerWidth - 8) left = innerWidth - pr.width - 8;
    if (top + pr.height > innerHeight - 8) top = r.top - pr.height - 6;
    pop.style.left = Math.max(8, left) + 'px';
    pop.style.top = Math.max(8, top) + 'px';
  }

  function bind(root) {
    (root || sr).querySelectorAll('[data-gl]').forEach(el => {
      if (el.__glBound) return; el.__glBound = true; el.classList.add('gl');
      el.onmouseenter = () => show(el, el.dataset.gl);
      el.onmouseleave = () => setTimeout(() => {
        if (!pop.matches(':hover')) pop.classList.remove('on'); }, 120);
    });
    return sr.querySelectorAll('[data-gl]').length;
  }

  /* which glossary key each panel and header field maps to */
  const PANEL = { waterfall:'spectrogram', chroma:'chromagram', camelot:'camelot',
    gonio:'goniometer', vu:'vu', transition:'beatmatch', position:'position',
    polygraph:'polygraph', spectrum:'spectrum', journey:'journey',
    loudness:'lufs', scope:'oscilloscope', centre:'centre',
    timeline:'timeline', drops:'drops', loudtime:'loudtime',
    route:'route', wayposts:'wayposts', sprite:'sprite',
    energy15:'energy-window', energy30:'energy-window', energy45:'energy-window',
    energy60:'energy-window', energy90:'energy-window' };
  const HEAD = { kBpm:'bpm', kKey:'key', kStr:'stretch', kHit:'spectral-flux', kReg:'register' };

  /* ── ROADMAP D6: the map is checked, not trusted ──────────────────────
     Every registered panel must have an entry here, every entry must name a
     registered panel, and every value must resolve to a term in DWMSG.
     Until 2026-08-19 three entries (position, journey, centre) pointed at
     terms that did not exist and one (spectrum) at the wrong concept, the
     header's kHit at 'flux' which is not a key, and six registered panels
     had no entry at all — the label looked hoverable and the hover did
     nothing. Logged rather than thrown: a stale map is a display defect,
     not a reason to stop the deck. DWDASH.glossaryAudit() returns the same
     report for the console. */
  function audit() {
    const reg = (window.DWPANELS && window.DWPANELS.list) ? window.DWPANELS.list().map(x => x.k) : [];
    const term = k => window.DWMSG && window.DWMSG.term(k);
    const out = {
      panelsWithoutTerm: reg.filter(id => !PANEL[id]),
      entriesWithoutPanel: Object.keys(PANEL).filter(id => reg.length && !reg.includes(id)),
      unresolvedTerms: Object.keys(PANEL).filter(id => !term(PANEL[id])).map(id => id + '→' + PANEL[id])
        .concat(Object.keys(HEAD).filter(id => !term(HEAD[id])).map(id => id + '→' + HEAD[id]))
    };
    out.clean = !out.panelsWithoutTerm.length && !out.entriesWithoutPanel.length && !out.unresolvedTerms.length;
    return out;
  }
  DWDASH.glossaryAudit = audit;
  setTimeout(() => { const a = audit(); if (!a.clean) console.warn('deckwave glossary: map out of step', a); }, 0);

  function tag() {
    Object.keys(HEAD).forEach(id => {
      const b = sr.getElementById(id); if (!b) return;
      const u = b.closest('.kv') && b.closest('.kv').querySelector('u');
      if (u) u.dataset.gl = HEAD[id];
    });
    dash.slots.slots.forEach(s => {
      const l = s.el.querySelector('.lbl');
      if (!l) return;
      /* Clearing matters as much as setting. A panel with no glossary entry
         used to leave whatever the last panel put there, so swapping to an
         untermed panel showed the previous panel's topic. */
      if (PANEL[s.panel]) l.dataset.gl = PANEL[s.panel];
      else delete l.dataset.gl;
    });
    const np = sr.getElementById('npBox');
    /* Tag by the label's OWN TEXT, not by position. The card relabels these
       four tiles in listen mode — level / register / width / phase — and this
       map was positional (`['bpm','key','stretch','energy'][i]`), so hovering
       `level` returned the TEMPO definition. Keeper's call, 2026-08-31: key
       off textContent, which is barely longer and cannot drift the next time
       a label is renamed.
       An unknown label gets NO tag rather than a stale one: DWMSG.term()
       returns null for an unrecognised key and show() bails, so a missing
       definition is silent while a wrong one is a lie with a tooltip. */
    if (np) {
      np.querySelectorAll('.grid u').forEach(u => {
        const k = String(u.textContent || '').trim().toLowerCase().split(/\s+/)[0];
        if (k && window.DWMSG && window.DWMSG.term(k)) u.dataset.gl = k;
        else delete u.dataset.gl;
      }); }
    return bind();
  }

  /* re-tag after every rebuild — this is the part that was missing twice */
  const origBuild = dash.slots.build, origReset = dash.slots.reset;
  dash.slots.build = function (d) { const r = origBuild.call(dash.slots, d);
    setTimeout(tag, 60); return r; };
  dash.slots.reset = function (d) { const r = origReset.call(dash.slots, d);
    setTimeout(tag, 80); return r; };

  tag();
  return { tag, bind, show };
};
