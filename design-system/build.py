#!/usr/bin/env python3
"""Generate the Deckwave design-system preview cards.

WHY THIS EXISTS
DWV (assets/deckwave-visuals.js) is a distributable component with a declared
theming contract - 21 CSS custom properties and 9 part= names - and per the
roadmap it has NEVER BEEN MOUNTED. Zero calls anywhere in the tree. These cards
are the first time it renders, and they double as the design-system upload.

THE TRICK THAT MAKES STATIC PREVIEWS POSSIBLE
DWV.attach(node) reads only node.fftSize and node.frequencyBinCount, and the
draw loop calls only getByteTimeDomainData and getByteFrequencyData. So a stub
object with those four members drives the whole component - no AudioContext, no
audio file, no autoplay permission, and the same picture every time.

Cards are fully self-contained: DWV and the theme block are inlined into each
one, so nothing depends on relative paths or load order inside the viewer.

    python design-system/build.py
"""
import io
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
OUT = HERE

DWV = io.open(os.path.join(REPO, 'assets', 'deckwave-visuals.js'), encoding='utf-8').read()
THEMES_CSS = io.open(os.path.join(REPO, 'themes', 'themes.css'), encoding='utf-8').read()

# The themes, read from the stylesheet rather than restated here, so this file
# cannot drift from themes.css the way SKILL.md drifted from the sequencer.
THEMES = re.findall(r'\.dw-theme-([a-z0-9-]+)\s*\{', THEMES_CSS)
THEMES = ['cyberpunk'] + [t for t in THEMES if t != 'cyberpunk']

# The 21 tokens, in the order deckwave-visuals.js declares them, with the
# fallback that IS the default look.
TOKENS = [
    ('colour', '--dw-color-bg', '#06021a', 'panel ground behind every canvas'),
    ('colour', '--dw-color-surface', '#0d0526', 'the card itself, behind the chrome'),
    ('colour', '--dw-color-line', '#22125c', 'borders, axes, unlit corpus points'),
    ('colour', '--dw-color-text', '#e6ddff', 'body text'),
    ('colour', '--dw-color-dim', '#7d6eb0', 'labels, secondary readings'),
    ('colour', '--dw-color-accent', '#22e8ff', 'primary trace'),
    ('colour', '--dw-color-accent-2', '#ff2d95', 'second trace - kept far in hue from accent'),
    ('colour', '--dw-color-warn', '#ffb02e', 'caution state'),
    ('colour', '--dw-color-bad', '#ff5470', 'failure state'),
    ('colour', '--dw-color-good', '#3ee68a', 'healthy state'),
    ('type', '--dw-font-mono', 'ui-monospace, Menlo, monospace', 'everything is monospace'),
    ('type', '--dw-font-title', 'inherits --dw-font-mono', 'display face, if you want one'),
    ('type', '--dw-font-size', '11px', 'base size'),
    ('type', '--dw-letter-spacing', '.14em', 'tracking on labels'),
    ('shape', '--dw-border-radius', '0px', 'square by default'),
    ('shape', '--dw-border-width', '1px', 'hairline'),
    ('shape', '--dw-space', '12px', 'the single spacing unit'),
    ('effect', '--dw-glow', '1', 'SET TO 0 AND THE INSTRUMENT GOES FLAT'),
    ('effect', '--dw-scanline-opacity', '.28', 'CRT overlay strength'),
    ('effect', '--dw-scanline-height', '3px', 'scanline pitch'),
    ('effect', '--dw-animation-speed', '1', 'forced to 0 under prefers-reduced-motion'),
]

PARTS = [
    ('panel', 'the outer card, border and scanline overlay'),
    ('header', 'title row'),
    ('label', 'the caption above each canvas - there are five'),
    ('scope', 'waveform canvas'),
    ('spectrum', 'FFT canvas'),
    ('chroma', 'chromagram canvas - NOT a piano roll'),
    ('meters', 'the energy-band row'),
    ('meter', 'one band - bass, mid or high'),
    ('punchcard', 'bass hits over the last 8 seconds'),
]

# A deterministic stand-in for an AnalyserNode. Evolves slowly so the punchcard
# fills and the card looks alive, but derives everything from a clock rather
# than from audio, so there is nothing to permit and nothing to load.
STUB = r"""
function stubAnalyser() {
  const fftSize = 2048, bins = 1024;
  const t0 = performance.now();
  return {
    fftSize: fftSize,
    frequencyBinCount: bins,
    getByteTimeDomainData(a) {
      const t = (performance.now() - t0) / 1000;
      for (let i = 0; i < a.length; i++) {
        const p = i / a.length;
        const v = Math.sin(p * 34 + t * 2.1) * 0.42
                + Math.sin(p * 91 + t * 1.3) * 0.20
                + Math.sin(p * 7  + t * 0.7) * 0.26
                + Math.sin(p * 210 + t * 4.0) * 0.06;
        a[i] = Math.max(0, Math.min(255, 128 + v * 104));
      }
    },
    getByteFrequencyData(a) {
      const t = (performance.now() - t0) / 1000;
      /* Four on the floor at 120bpm. The punchcard's onset test is
         lo > .55 && lo - lastLow > .10, where lo is the mean of bins 0-11,
         so the kick has to OWN those bins and actually return to a trough
         between beats. An earlier version left the spectral tilt in charge
         down there, which pinned lo at a steady .45 - never over the
         threshold, never rising, and the punchcard stayed empty. */
      const beat = Math.pow(Math.max(0, Math.sin(t * Math.PI * 2 * 2)), 8);
      for (let i = 0; i < a.length; i++) {
        const p = i / a.length;
        let v = Math.pow(1 - p, 2.4) * 150;             /* spectral tilt */
        v += Math.exp(-Math.pow((p - 0.20) / 0.05, 2)) * 42;
        v += Math.exp(-Math.pow((p - 0.44) / 0.10, 2)) * 26;
        v += Math.sin(p * 160 + t * 1.6) * 7;
        if (p < 0.02) v = 55 + beat * 175;              /* the kick */
        else if (p < 0.06) v += beat * 60;              /* low-mid follows */
        a[i] = Math.max(0, Math.min(255, v));
      }
    }
  };
}
"""

SHELL = """<!-- @dsCard group="%(group)s" -->
<meta charset="utf-8">
<title>%(title)s</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; padding:20px; background:#04010f; color:#e6ddff;
         font:12px/1.6 ui-monospace, Menlo, monospace; }
  h1 { font-size:11px; letter-spacing:.22em; text-transform:uppercase;
       color:#ff2d95; margin:0 0 4px; font-weight:700; }
  p.sub { color:#7d6eb0; margin:0 0 16px; font-size:10.5px; max-width:62ch; }
  %(extra_css)s
</style>
%(themes)s
<h1>%(title)s</h1>
<p class="sub">%(sub)s</p>
%(body)s
"""


def card(name, group, title, sub, body, extra_css='', themes=True):
    html = SHELL % dict(
        group=group, title=title, sub=sub, body=body, extra_css=extra_css,
        themes=('<style>\n' + THEMES_CSS + '\n</style>') if themes else '')
    path = os.path.join(OUT, name)
    io.open(path, 'w', encoding='utf-8').write(html)
    print('  %-34s %6d bytes' % (name, len(html.encode('utf-8'))))
    return name


def dwv_block(theme, title, extra_style=''):
    """One mounted DWV, driven by the stub.

    Width is CLAMPED. Left to fill the page the component reads as a stretched
    banner - the scope becomes a thin ribbon and the chromagram a dot in a
    field of empty canvas - which says nothing true about how it looks embedded
    in someone else's layout."""
    return """
<div class="dw-theme-%(theme)s" style="max-width:760px;%(extra)s">
  <div id="host-%(theme)s"></div>
</div>
<script>%(dwv)s</script>
<script>%(stub)s
(function () {
  const h = document.getElementById('host-%(theme)s');
  const v = window.DWV.mount(h, { title: '%(title)s' });
  v.attach(stubAnalyser());
  v.start();
})();
</script>
""" % dict(theme=theme, title=title, dwv=DWV, stub=STUB, extra=extra_style)


def main():
    print('building design-system cards')
    made = []

    # ── the component, default look ────────────────────────────────────────
    made.append(card(
        'component-dwv.html', 'Components', 'DWV visualiser',
        'The whole distributable component: scope, spectrum, chromagram, energy '
        'bands and bass punchcard in one shadow root. Driven here by a stub '
        'analyser - four members, no audio - so the picture is deterministic. '
        'The chromagram is NOT a piano roll: it shows which of twelve pitch '
        'classes carry energy, folded across all octaves.',
        dwv_block('cyberpunk', 'DECKWAVE')))

    # ── one card per theme ─────────────────────────────────────────────────
    for t in THEMES:
        made.append(card(
            'theme-%s.html' % t, 'Themes', 'Theme: %s' % t,
            'The same component and the same stub signal, with only the token '
            'block swapped. Nothing is forked and no colour is hard-coded - '
            'every value is read from a CSS custom property each frame.',
            dwv_block(t, t.upper())))

    # ── flat: the claim that glow 0 really is flat ──────────────────────────
    made.append(card(
        'foundation-flat.html', 'Foundations', 'Flat mode',
        'The same component with --dw-glow:0 and --dw-scanline-opacity:0. The '
        'theming contract claims this turns the instrument flat rather than '
        'merely dimming it; this card is the check.',
        dwv_block('cyberpunk', 'FLAT',
                  extra_style='--dw-glow:0; --dw-scanline-opacity:0; --dw-border-radius:3px;')))

    # ── colour tokens ──────────────────────────────────────────────────────
    rows = []
    for group, tok, fallback, note in TOKENS:
        if group != 'colour':
            continue
        rows.append(
            '<div class="sw"><i style="background:%s"></i>'
            '<code>%s</code><b>%s</b><span>%s</span></div>' % (fallback, tok, fallback, note))
    made.append(card(
        'foundation-colour.html', 'Foundations', 'Colour tokens',
        'Ten colour custom properties. The fallback IS the default look, so a '
        'host page overrides any of them without forking. Custom properties '
        'pierce the shadow boundary and survive :host{all:initial} - that is '
        'what makes the theming real rather than decorative.',
        '<div class="sws">%s</div>' % ''.join(rows),
        extra_css="""
  .sws{display:grid;gap:6px}
  .sw{display:grid;grid-template-columns:26px 190px 200px 1fr;gap:12px;align-items:center;
      padding:6px 8px;border:1px solid #22125c;background:#0b0424}
  .sw i{display:block;width:26px;height:26px;border:1px solid #22125c}
  .sw code{color:#22e8ff}
  .sw b{color:#7d6eb0;font-weight:400}
  .sw span{color:#7d6eb0}
  @media(max-width:720px){.sw{grid-template-columns:26px 1fr}.sw b,.sw span{display:none}}
""", themes=False))

    # ── type, shape, effect ────────────────────────────────────────────────
    rows = []
    for group, tok, fallback, note in TOKENS:
        if group == 'colour':
            continue
        rows.append('<tr><td class="g">%s</td><td><code>%s</code></td>'
                    '<td class="f">%s</td><td class="n">%s</td></tr>'
                    % (group, tok, fallback, note))
    made.append(card(
        'foundation-type-shape.html', 'Foundations', 'Type, shape and effect',
        'The remaining eleven tokens. --dw-animation-speed is forced to 0 under '
        'prefers-reduced-motion by the component itself, so honouring the '
        'setting is not left to the host page.',
        '<table>%s</table>' % ''.join(rows),
        extra_css="""
  table{border-collapse:collapse;width:100%;font-size:11px}
  td{border:1px solid #22125c;padding:6px 9px;vertical-align:top}
  td.g{color:#ff2d95;text-transform:uppercase;letter-spacing:.14em;font-size:9px;width:64px}
  code{color:#22e8ff}
  td.f{color:#e6ddff;white-space:nowrap}
  td.n{color:#7d6eb0}
""", themes=False))

    # ── the part= surface ──────────────────────────────────────────────────
    rows = ''.join('<tr><td><code>::part(%s)</code></td><td class="n">%s</td></tr>' % p
                   for p in PARTS)
    made.append(card(
        'foundation-parts.html', 'Foundations', 'The part surface',
        'Nine part= names, enumerated in the public API so a host page can '
        'introspect them. Tokens restyle; ::part() restructures. The live card '
        'below overrides ::part(header) and ::part(label) only - everything '
        'else is untouched, which is the point.',
        '<table>%s</table>' % rows
        + '<style>#host-cyberpunk::part(header){background:#ff2d95;color:#04010f}'
          '#host-cyberpunk::part(label){color:#3ee68a;letter-spacing:.3em}</style>'
        + dwv_block('cyberpunk', 'PART OVERRIDES'),
        extra_css="""
  table{border-collapse:collapse;width:100%;font-size:11px;margin-bottom:18px}
  td{border:1px solid #22125c;padding:6px 9px}
  code{color:#22e8ff}
  td.n{color:#7d6eb0}
"""))

    print('\n%d cards in %s' % (len(made), OUT))
    return made


if __name__ == '__main__':
    main()
