/* ─────────────────────────────────────────────────────────────────────────
   DECKWAVE · MESSAGES
   Every string the interface shows, and every term it explains, in one place.

   WHY THIS EXISTS AS ONE FILE
   Three problems turned out to be the same problem:
     1. Panel help cards kept vanishing — they were added by a live patch to
        slot construction, so any rebuild (reset, mega) dropped them.
     2. The UI uses vocabulary — crossfade, downbeat, Camelot, spectral flux —
        that is opaque unless you already know it.
     3. Nothing was translatable; strings were scattered through the code.
   A message catalogue fixes all three. Terms are data, so a rebuild cannot
   lose them, and a translator can replace the file without touching logic.

   TRANSLATION
   Ship `en.js` as the reference. A translation is the same object with the
   values replaced. `DWMSG.use(catalogue)` swaps it at runtime.
   For translatewiki.net or Weblate, export with `DWMSG.exportJSON()` — flat
   key/value JSON, which is the format both expect. Keys are stable and
   dotted; do not renumber them.

   WIKIPEDIA LINKS
   `verified: true` means the article was confirmed to resolve. Everything
   else points at Wikipedia SEARCH rather than a guessed article path,
   because inventing a plausible-looking citation is a documented failure in
   this project and a search URL cannot dead-end.
   ───────────────────────────────────────────────────────────────────────── */

window.DWMSG = (function () {
'use strict';

/* ── terms: what the word means, here, in this app ───────────────────── */
const TERMS = {

  /* transport and mixing */
  'term.crossfade': {
    t: 'Crossfade',
    d: 'The overlap where one track fades out while the next fades in. Deckwave uses 16 seconds, and both ends are aligned to a downbeat so the blend lands on the music rather than the clock.',
    w: 'https://en.wikipedia.org/wiki/Fade_(audio_engineering)', verified: false
  },
  'term.downbeat': {
    t: 'Downbeat',
    d: 'The first beat of a bar — the one you would count as "one". Transitions land here because starting a track mid-bar sounds like a stumble. Deckwave assumes every fourth beat is a downbeat, which is right for 4/4 electronic music and wrong for much else.',
    w: 'https://en.wikipedia.org/wiki/Beat_(music)', verified: false
  },
  'term.downbeat-aligned': {
    t: 'Downbeat-aligned',
    d: 'The blend begins exactly on a downbeat in both tracks, rather than at an arbitrary moment. This is what separates a mix from a fade.',
    w: 'https://en.wikipedia.org/wiki/Beatmatching', verified: false
  },
  'term.beatmatch': {
    t: 'Beatmatching',
    d: 'Making two tracks share a tempo so their beats coincide. Deckwave time-stretches both decks to a common tempo, so they stay locked rather than drifting apart across the blend.',
    w: 'https://en.wikipedia.org/wiki/Beatmatching', verified: false
  },
  'term.bass-swap': {
    t: 'Bass swap',
    d: 'During a blend, the outgoing track\u2019s low frequencies are cut while the incoming track\u2019s come up — so only one kick and one bassline sound at a time. Without it two basslines pile up and the mix turns to mud. Fires at 45% through the crossfade.',
    w: 'https://en.wikipedia.org/wiki/Equalization_(audio)', verified: false
  },
  'term.stretch': {
    t: 'Time-stretch',
    d: 'Changing a track\u2019s speed without changing its pitch. Past roughly 15% it becomes audible as a wobble — a perceptual limit, not a preference. Deckwave refuses anything past 8%.',
    w: 'https://en.wikipedia.org/wiki/Audio_time_stretching_and_pitch_scaling', verified: true
  },
  'term.rolling-tempo': {
    t: 'Rolling tempo target',
    d: 'Rather than forcing every track to one fixed BPM, the target drifts 35% toward each incoming track. That lets a set climb from 100 to 150 BPM across a night while no single transition stretches anything more than 8%.',
    w: 'https://en.wikipedia.org/wiki/Tempo', verified: false
  },
  'term.gate': {
    t: 'Stretch gate',
    d: 'A hard rule: any track needing more than 8% stretch from the current tempo is rejected outright. If nothing qualifies, the set ends rather than degrading. A shorter set that sounds right beats a longer one that does not.',
    w: null, verified: false
  },

  /* harmony */
  'term.camelot': {
    t: 'Camelot wheel',
    d: 'A relabelling of the circle of fifths for DJs. Twelve numbers, A for minor and B for major. Adjacent numbers are a perfect fifth apart; the same number with the other letter is the relative major or minor. Moves between neighbours sound consonant.',
    w: 'https://en.wikipedia.org/wiki/Circle_of_fifths', verified: false
  },
  'term.key': {
    t: 'Key',
    d: 'The tonal centre a piece is built around. Mixing tracks in compatible keys avoids the clash you hear when two unrelated tonalities overlap.',
    w: 'https://en.wikipedia.org/wiki/Key_(music)', verified: false
  },
  'term.relative-major': {
    t: 'Relative major / minor',
    d: 'Two keys sharing the same notes but a different home note — A minor and C major, for instance. On the Camelot wheel these are the same number with the other letter. A reliable mood change without a harmonic clash.',
    w: 'https://en.wikipedia.org/wiki/Relative_key', verified: false
  },
  'term.harmonic-mixing': {
    t: 'Harmonic mixing',
    d: 'Choosing the next track partly by musical key so the overlap sounds intentional. Deckwave scores every candidate on key compatibility alongside tempo and energy.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=harmonic+mixing', verified: false
  },

  /* analysis */
  'term.bpm': {
    t: 'BPM',
    d: 'Beats per minute. Deckwave measures it with five different onset-detection methods and takes the one they agree on, because a single method fails on heavily compressed or chiptune material.',
    w: 'https://en.wikipedia.org/wiki/Tempo', verified: false
  },
  'term.beat-grid': {
    t: 'Beat grid',
    d: 'The measured position of every beat in a track, in seconds. Everything downstream — entry points, exit points, downbeat alignment — is computed from this rather than assumed from the tempo.',
    w: 'https://en.wikipedia.org/wiki/Beat_(music)', verified: false
  },
  'term.spectral-flux': {
    t: 'Spectral flux',
    d: 'How much the spectrum CHANGED between two frames, counting only increases. It detects onsets where a loudness threshold cannot: sidechained dance music holds bass energy near constant, so "is it loud" never fires, but "did it suddenly change" does.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=spectral+flux+onset', verified: false
  },
  'term.onset': {
    t: 'Onset',
    d: 'The instant a sound begins — the attack of a kick, a snare, a note. Detecting onsets is how software finds the beat.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=onset+detection+audio', verified: false
  },
  'term.confidence': {
    t: 'Confidence',
    d: 'How sure the beat tracker is, on Essentia\u2019s scale of 0\u20135.32, where 1.5\u20133.5 is moderately confident. NOT comparable to any other detector\u2019s confidence number — different algorithms use different scales.',
    w: null, verified: false
  },
  'term.energy': {
    t: 'Energy',
    d: 'A CONSTRUCTED index, not a measurement: 45% loudness, 25% brightness, 30% tempo, normalised across your library. It correlates with what a listener calls energy. The weights were chosen, not fitted to data.',
    w: null, verified: false
  },
  'term.energy-arc': {
    t: 'Energy arc',
    d: 'The shape of a night: rising to a peak around 72% through, then easing. Deckwave scores candidates partly on how close their energy is to where the arc says it should be.',
    w: null, verified: false
  },
  'term.register': {
    t: 'Register',
    d: 'How bright the music currently is, measured as the spectral centroid — the magnitude-weighted mean frequency. When register colour is on, this drives the whole palette: violet when dark, cyan when bright.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=spectral+centroid', verified: false
  },
  'term.chromagram': {
    t: 'Chromagram',
    d: 'Every octave folded into twelve pitch classes, so all the Cs count as one C. Shows where the harmony sits. NOT a piano roll — pulling individual notes out of a finished mix is an unsolved research problem.',
    w: 'https://en.wikipedia.org/wiki/Chroma_feature', verified: true
  },
  'term.spectrogram': {
    t: 'Spectrogram',
    d: 'Frequency plotted against time. Left is older, right is now; low frequencies at the bottom, brighter means louder. Song structure becomes visible — you can see a drop coming before it lands.',
    w: 'https://en.wikipedia.org/wiki/Spectrogram', verified: false
  },
  'term.goniometer': {
    t: 'Goniometer',
    d: 'Left channel plotted against right. A vertical line means mono; horizontal means the channels are out of phase and would cancel if summed. A wide ball means a broad stereo image.',
    w: 'https://en.wikipedia.org/wiki/Goniometer_(audio)', verified: true
  },
  'term.phase-correlation': {
    t: 'Phase correlation',
    d: 'A number from \u22121 to +1 describing how much the two channels agree. +1 is mono, 0 is wide, negative means parts will cancel if anyone plays it in mono. Below zero is a warning, not a style.',
    w: 'https://en.wikipedia.org/wiki/Goniometer_(audio)', verified: true
  },
  'term.vu': {
    t: 'VU meter',
    d: 'An averaging loudness meter with a deliberate 300ms response — that slowness is why analogue meters read as musical rather than twitchy. The trailing dot is a fast peak hold. The zero point is a calibration choice, not a standard.',
    w: 'https://en.wikipedia.org/wiki/VU_meter', verified: true
  },
  'term.lufs': {
    t: 'LUFS',
    d: 'The broadcast standard for perceived loudness. Broadcast targets \u221223, streaming about \u221214. Deckwave\u2019s reading is RELATIVE — the proper weighting is approximated, so trends are meaningful but the number is not comparable to a real meter.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=LUFS+loudness', verified: false
  },
  'term.oscilloscope': {
    t: 'Oscilloscope',
    d: 'Amplitude against time — the raw shape of the last few milliseconds of sound.',
    w: 'https://en.wikipedia.org/wiki/Oscilloscope', verified: false
  },
  'term.polygraph': {
    t: 'Polygraph',
    d: 'Five signals on ruled paper, scrolling like a chart recorder: bass, mid, high, spectral flux and stereo width. Named for the look, but every pen is a real measurement.',
    w: 'https://en.wikipedia.org/wiki/Chart_recorder', verified: false
  },

  /* the score */
  'term.score': {
    t: 'Set score',
    d: 'The mix written down as data rather than audio. Every entry point, tempo multiplier, exit downbeat and EQ timing, plus which detector and stretcher produced it. About 26KB describes three hours. Load it back and the same set rebuilds.',
    w: null, verified: false
  },
  'term.cue-sheet': {
    t: 'Cue sheet',
    d: 'A plain-text index of where each track starts inside one long audio file. Opens in VLC and foobar2000, giving you track skipping over a continuous mix.',
    w: 'https://en.wikipedia.org/wiki/Cue_sheet_(computing)', verified: false
  },

  /* library */
  'term.corpus': {
    t: 'Corpus',
    d: 'Your analysed library. Deckwave decodes each track, measures a two-minute excerpt, then DISCARDS the audio — only a few hundred bytes of features per track are kept. That is why hundreds of tracks fit in a browser.',
    w: null, verified: false
  },
  'term.listen-mode': {
    t: 'Listen mode',
    d: 'Point Deckwave at another browser tab and every visual works on whatever is playing there. No analysis, no mixing — those need the file, not the stream.',
    w: null, verified: false
  }
};

/* ── interface strings, separated from terms so translators see the split ── */
const UI = {
  'ui.scan': 'scan', 'ui.build': 'build set', 'ui.library': 'library',
  'ui.play': 'play', 'ui.pause': 'pause', 'ui.next': 'next', 'ui.stop': 'stop',
  'ui.kill': 'kill', 'ui.saveSet': 'save set', 'ui.loadSet': 'load set',
  'ui.layout': 'layout', 'ui.theme': 'theme', 'ui.view': 'view',
  'ui.nowPlaying': 'now playing', 'ui.listenTab': 'listen to a tab',
  'ui.registerColour': 'register colour', 'ui.compact': 'compact',
  'ui.resetViews': 'reset views', 'ui.swap': 'swap', 'ui.collapse': 'collapse',
  'ui.expand': 'expand', 'ui.pickFolder': 'pick your music folder',
  'ui.buildFirst': 'build a set first', 'ui.scanFirst': 'scan first',
  'ui.libraryFirst': 'open the library first', 'ui.noTrack': 'no track playing',
  'ui.finalTrack': 'final track', 'ui.idle': 'idle', 'ui.cancelled': 'cancelled',
  'ui.verified': 'link verified',
  'ui.unverified': 'article title unverified \u2014 opens Wikipedia search',
  'ui.overBudget': 'OVER BUDGET', 'ui.phaseLocked': 'phase locked',
  'ui.drift': 'drift', 'ui.blendingNow': 'blending now'
};

let terms = TERMS, ui = UI;

return {
  /* look a term up by key, or by the visible label */
  term: k => terms[k] || terms['term.' + k] || null,
  ui: k => ui[k] || k,

  /* every term, for building a glossary panel */
  all: () => Object.keys(terms).map(k => Object.assign({ key: k }, terms[k])),
  count: () => Object.keys(terms).length,

  /* swap in a translation: same keys, translated values */
  use(cat) { if (cat.terms) terms = cat.terms; if (cat.ui) ui = cat.ui; return true; },

  /* flat key/value JSON — the shape translatewiki.net and Weblate expect.
     Term descriptions are exported as separate .t and .d keys so a
     translator sees the title and the body as distinct strings. */
  exportJSON() {
    const out = {};
    Object.keys(ui).forEach(k => { out[k] = ui[k]; });
    Object.keys(terms).forEach(k => {
      out[k + '.title'] = terms[k].t;
      out[k + '.desc'] = terms[k].d;
    });
    return JSON.stringify(out, null, 2);
  },

  /* build a catalogue back from flat JSON */
  importJSON(json) {
    const d = typeof json === 'string' ? JSON.parse(json) : json;
    const t = {}, u = {};
    Object.keys(d).forEach(k => {
      if (k.endsWith('.title')) {
        const base = k.slice(0, -6);
        t[base] = t[base] || Object.assign({}, terms[base]);
        t[base].t = d[k];
      } else if (k.endsWith('.desc')) {
        const base = k.slice(0, -5);
        t[base] = t[base] || Object.assign({}, terms[base]);
        t[base].d = d[k];
      } else u[k] = d[k];
    });
    return { terms: t, ui: u };
  }
};
})();
