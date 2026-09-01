/* DECKWAVE — SPRITES
   A 16x16 pixel mascot per theme, drawn as a panel.

   Two colour systems on purpose:

   THEME SLOTS (A, B, D, L) resolve from the live theme bundle every frame, so
   most sprites recolour themselves when the theme changes and never clash. A
   sprite written this way costs nothing to keep in step with a new theme.

   FIXED RGB is for a sprite whose colours ARE the character. Darkwing is
   purple, cyan and gold or he is not Darkwing, so the duck opts out of the
   slot system entirely.

   Selection: `auto` follows the theme, or pick any sprite explicitly and it
   sticks. Tying them together was the request; forcing it was not.  */
window.DWSPRITES = (function () {
'use strict';

/* . transparent
   A theme accent · B theme accent-2 · D theme dim · L theme line
   fixed: P purple · p light purple · d dark purple · w white · c cyan
          y gold · k near-black */
const S = {};

S.duck = { label: 'darkwing', fixed: true, grid: [
  '................',
  '......pppp......',
  '.....pPPPPp.....',
  '....pPPPPPPp....',
  '...pPPPPPPPPp...',
  '...pPPPPPPPPp...',
  '.dddddddddddddd.',
  '..dddddddddddd..',
  '....wwwwwwww....',
  '...wccccccccw...',
  '...wckwwwwkcw...',
  '...wwwwwwwwww...',
  '....wwyyyyww....',
  '.....yyyyyy.....',
  '......yyyy......',
  '.....PPPPPP.....'] };

S.invader = { label: 'invader', grid: [
  '................',
  '................',
  '....A......A....',
  '.....A....A.....',
  '....AAAAAAAA....',
  '...AA.AAAA.AA...',
  '..AAAAAAAAAAAA..',
  '..A.AAAAAAAA.A..',
  '..A.A......A.A..',
  '.....BB..BB.....',
  '................',
  '................',
  '................',
  '................',
  '................',
  '................'] };

S.cassette = { label: 'cassette', grid: [
  '................',
  '................',
  '..LLLLLLLLLLLL..',
  '..LAAAAAAAAAAL..',
  '..LADDDDDDDDAL..',
  '..LAD.AAAA.DAL..',
  '..LAD.A..A.DAL..',
  '..LAD.AAAA.DAL..',
  '..LADDDDDDDDAL..',
  '..LAAAAAAAAAAL..',
  '..LA.A....A.AL..',
  '..LLLLLLLLLLLL..',
  '...L.L....L.L...',
  '................',
  '................',
  '................'] };

S.crt = { label: 'terminal', grid: [
  '................',
  '..LLLLLLLLLLLL..',
  '..LAAAAAAAAAAL..',
  '..LADDDDDDDDAL..',
  '..LAD.AAAA..AL..',
  '..LAD.......AL..',
  '..LAD.AA....AL..',
  '..LAD.......AL..',
  '..LADDDDDDDDAL..',
  '..LAAAAAAAAAAL..',
  '..LLLLLLLLLLLL..',
  '.....L....L.....',
  '....LLLLLLLL....',
  '................',
  '................',
  '................'] };

S.chip = { label: 'chip', grid: [
  '................',
  '....A.A..A.A....',
  '....A.A..A.A....',
  '..BBBBBBBBBBBB..',
  '..B..........B..',
  '..B.BB.BB.BB.B..',
  'AAB..........BAA',
  'AAB.BB.BB.BB.BAA',
  'AAB..........BAA',
  'AAB.BB.BB.BB.BAA',
  '..B..........B..',
  '..BBBBBBBBBBBB..',
  '....A.A..A.A....',
  '....A.A..A.A....',
  '................',
  '................'] };

S.crystal = { label: 'crystal', grid: [
  '................',
  '......AAAA......',
  '.....ABBBBA.....',
  '....ABBAABBA....',
  '...ABBA..ABBA...',
  '..ABBA....ABBA..',
  '..ABA......ABA..',
  '..AB........BA..',
  '..AB........BA..',
  '..ABA......ABA..',
  '...ABA....ABA...',
  '....ABA..ABA....',
  '.....ABAABA.....',
  '......ABBA......',
  '.......AA.......',
  '................'] };

S.star = { label: 'stargaze', grid: [
  '................',
  '.......A........',
  '.......A........',
  '......AAA.......',
  '..A...ABA...A...',
  '...A..ABA..A....',
  '....AABBBAA.....',
  '.AAAABBBBBAAAA..',
  '....AABBBAA.....',
  '...A..ABA..A....',
  '..A...ABA...A...',
  '......AAA.......',
  '.......A........',
  '.......A........',
  '................',
  '................'] };

S.plane = { label: 'paper plane', grid: [
  '................',
  '..............A.',
  '............AAA.',
  '..........AAAAA.',
  '........AAAADAA.',
  '......AAAAADDAA.',
  '....AAAAAADDDAA.',
  '..AAAAAAADDDDAA.',
  'AAAAAAAADDDDDAA.',
  '..AAAAAAADDDDAA.',
  '....AAAAAADDDAA.',
  '......AAAAADDAA.',
  '........AAAADAA.',
  '..........AAAAA.',
  '............AAA.',
  '..............A.'] };

S.bobcat = { label: 'bobcat', grid: [
  '................',
  '..A..........A..',
  '..AA........AA..',
  '..AAA......AAA..',
  '..AAAAAAAAAAAA..',
  '.AAAAAAAAAAAAAA.',
  '.AA.k.AAAA.k.AA.',
  '.AAAAAAAAAAAAAA.',
  '.AAAAA.BB.AAAAA.',
  '.AAAA.B..B.AAAA.',
  '.AAAAA.BB.AAAAA.',
  '..AAAAAAAAAAAA..',
  '..AA.AAAAAA.AA..',
  '...AAAAAAAAAA...',
  '....AAAAAAAA....',
  '................'] };

/* ROCI — the Rocinante, nose up, under burn.

   Drawn on the theme slots rather than fixed RGB, unlike the duck: the ship
   is a silhouette and a plume, not a colour, so it should recolour with
   whatever theme it is under. Hull in D (dim reads as hull grey in every
   theme here), cockpit and the aft drive fins in B, and the plume in A so
   the brightest thing on the sprite is the drive — which is the point of
   the ship.

   The fins were detached from the hull in the first pass — a lone B pixel
   with a gap column either side — and at this size that reads as debris
   drifting alongside rather than as part of the ship. They flare out of the
   hull now. Sixteen pixels does not forgive a floating pixel.

   Nose up because that is how she flies: the drive is the floor, the decks
   stack towards the nose, and a 16-pixel corvette lying on its side reads as
   a fish. */
S.roci = { label: 'rocinante', grid: [
  '.......DD.......',
  '......DDDD......',
  '......DBBD......',
  '......DDDD......',
  '.....DDDDDD.....',
  '.....DDDDDD.....',
  '.....DDDDDD.....',
  '....BDDDDDDB....',
  '...BBDDDDDDBB...',
  '..BBBDDDDDDBBB..',
  '...BBDDDDDDBB...',
  '.....DDDDDD.....',
  '....DDDDDDDD....',
  '.....AAAAAA.....',
  '......AAAA......',
  '.......AA.......'] };

/* theme -> sprite. A theme with no entry falls back to the duck, because a
   missing mascot should look like a choice, not like a hole. */
const BY_THEME = {
  darkwing: 'duck',   classic: 'invader', mono: 'cassette', amber: 'crt',
  cyberpunk: 'chip',  ice: 'crystal',     stargaze: 'star', paper: 'plane',
  sewage: 'bobcat',  expanse: 'roci'
};

const FIXED = {
  P: '#6038a8', p: '#8a5cd6', d: '#3a1e6e', w: '#f2f0fa',
  c: '#40d0e2', y: '#f6be38', k: '#120e1e'
};

/* ── theme detection ──────────────────────────────────────────────────────
   dash.theme is kept current by applyTheme, but the host's class is what
   actually drives the CSS, so it is the more reliable authority — read it
   first and fall back. */
function activeTheme() {
  try {
    const d = window.DWDASH && window.DWDASH._dev;
    if (d && d.host) {
      const c = [...d.host.classList].find(x => x.indexOf('dw-theme-') === 0);
      if (c) return c.slice(9);
    }
    if (d && d.theme) return d.theme;
  } catch (e) {}
  return 'cyberpunk';
}

/* Which mascot to draw. `auto` is a real entry in the existing sprite menu
   rather than a second setting, so there is ONE menu and ONE stored value —
   the earlier version kept its own `choice` in localStorage under the same
   key the camelot centre sprite uses, which quietly reset that sprite to
   `jam` on every reload. */
function idFor(theme) { return BY_THEME[theme || activeTheme()] || 'duck'; }

/* Resolve a grid character to a colour for THIS frame's theme. Theme slots
   (A/B/D/L) come from the live bundle so most sprites recolour themselves;
   a `fixed` sprite ignores them because its colours ARE the character. */
function colour(ch, sp, T) {
  if (ch === '.') return null;
  if (sp.fixed) return FIXED[ch] || null;
  return { A: T.ac, B: T.ac2, D: T.dim, L: T.line }[ch] || FIXED[ch] || null;
}

function paint(c, sp, cx, cy, scale, T) {
  const G = sp.grid, N = G.length, M = G[0].length;
  const x0 = Math.round(cx - M * scale / 2), y0 = Math.round(cy - N * scale / 2);
  for (let y = 0; y < N; y++) {
    const row = G[y];
    for (let x = 0; x < M; x++) {
      const col = colour(row[x], sp, T);
      if (!col) continue;
      c.fillStyle = col;
      c.fillRect(x0 + x * scale, y0 + y * scale, scale, scale);
    }
  }
}

/* Centre-sprite signature, matching the originals: (c,w,h,T,bassV,hit,bright).
   Integer scale only — a fractional scale on pixel art gives unevenly sized
   pixels, which looks worse than a smaller sprite. Bobs on the bass and kicks
   on an onset, same as jam does. */
function centre(resolve) {
  return function (c, w, h, T, bassV, hit) {
    const sp = S[resolve()];
    if (!sp) return;
    /* Sized against the PANEL, not the wheel radius. The first version used
       0.9 x radius, which put a 16-row sprite at nearly half the panel width
       and crowded the camelot bubbles it sits inside. 0.28 of the smaller
       panel dimension leaves the wheel legible.

       Integer scale only — a fractional scale on pixel art gives unevenly
       sized pixels, which reads worse than simply being smaller. */
    const target = Math.min(w, h) * 0.28;
    const scale = Math.max(1, Math.floor(target / sp.grid.length));
    const bob = (bassV || 0) * scale * 1.5 + (hit ? -scale : 0);
    paint(c, sp, w / 2, h / 2 - bob, scale, T);
  };
}

if (window.DWPANELS && window.DWPANELS.addSprite) {
  window.DWPANELS.addSprite('auto', centre(() => idFor()));
  Object.keys(S).forEach(id => window.DWPANELS.addSprite(id, centre(() => id)));
}

/* The full-panel mascot stays too — same art, room to breathe. It follows
   whatever the sprite menu says, including `auto`. */
function draw(c, w, h, T, D) {
  c.fillStyle = T.bg; c.fillRect(0, 0, w, h);
  const sel = (window.DWPANELS && window.DWPANELS.sprite) || 'auto';
  const id = S[sel] ? sel : idFor();
  const sp = S[id];
  if (!sp) return;
  const scale = Math.max(1, Math.floor(Math.min(w * 0.7 / sp.grid[0].length,
                                                h * 0.7 / sp.grid.length)));
  const t = performance.now() / 1000, hit = D && D.hit ? 1 : 0;
  if (hit) { c.globalAlpha = 0.14; c.fillStyle = T.ac; c.fillRect(0, 0, w, h); c.globalAlpha = 1; }
  paint(c, sp, w / 2, h / 2 + Math.round(Math.sin(t * 1.6) * scale * 0.5) - hit * scale, scale, T);
  c.fillStyle = T.dim; c.font = '8px ' + T.fn; c.textAlign = 'center';
  c.fillText(sp.label + (sel === 'auto' ? '' : ' · pinned'), w / 2, h - 8);
}

/* Registered, but deliberately NOT pushed into DWPANELS.ALL. That list is the
   MEGA layout and it is exactly twelve cells; deckwave-panels.js says so at
   its definition, and pushing a thirteenth made mega render 13 tiles into a
   grid built for 12. The swap menu reads DWPANELS.list(), not ALL, so the
   panel is reachable everywhere it should be without touching mega. */
if (window.DWPANELS && window.DWPANELS.register) {
  window.DWPANELS.register('sprite', 'sprite', draw);
}

return { sprites: S, byTheme: BY_THEME, ids: () => Object.keys(S),
         idFor, activeTheme, draw };
})();
