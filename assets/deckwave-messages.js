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
   this project and a search URL cannot dead-end. (Until 2026-08-19 fifteen
   unverified entries carried direct article paths while this note and the
   tooltip both said "search"; they are search links now, which is what the
   tooltip promises. Opening each and flipping the flag is ROADMAP D6.)
   ───────────────────────────────────────────────────────────────────────── */

window.DWMSG = (function () {
'use strict';

/* ── terms: what the word means, here, in this app ───────────────────── */
const TERMS = {

  /* transport and mixing */
  'term.crossfade': {
    t: 'Crossfade',
    d: 'The overlap where one track fades out while the next fades in. Deckwave uses 16 seconds, and both ends are aligned to a downbeat so the blend lands on the music rather than the clock.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=Fade+(audio+engineering)', verified: false
  },
  'term.downbeat': {
    t: 'Downbeat',
    d: 'The first beat of a bar — the one you would count as "one". Transitions land here because starting a track mid-bar sounds like a stumble. Deckwave assumes every fourth beat is a downbeat, which is right for 4/4 electronic music and wrong for much else.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=Beat+(music)', verified: false
  },
  'term.downbeat-aligned': {
    t: 'Downbeat-aligned',
    d: 'The blend begins exactly on a downbeat in both tracks, rather than at an arbitrary moment. This is what separates a mix from a fade.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=Beatmatching', verified: false
  },
  'term.beatmatch': {
    t: 'Beatmatching',
    d: 'Making two tracks share a tempo so their beats coincide. Deckwave time-stretches each INCOMING deck to the rolling tempo target and starts it on the outgoing deck\u2019s downbeat, so the two sets of beats land together across the blend. A track played STRAIGHT is not beatmatched at all \u2014 it crossfades at its own speed and claims nothing.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=Beatmatching', verified: false
  },
  'term.bass-swap': {
    t: 'Bass swap',
    d: 'During a blend, the outgoing track\u2019s low frequencies are cut while the incoming track\u2019s come up — so only one kick and one bassline sound at a time. Without it two basslines pile up and the mix turns to mud. Fires at 45% through the crossfade.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=Equalization+(audio)', verified: false
  },
  'term.stretch': {
    t: 'Time-stretch',
    d: 'Changing a track\u2019s speed without changing its pitch. Past roughly 15% it becomes audible as a wobble — a perceptual limit, not a preference. Deckwave keeps every beatmatched transition inside 8%; a track it cannot reach that way is played straight, unstretched, rather than forced.',
    w: 'https://en.wikipedia.org/wiki/Audio_time_stretching_and_pitch_scaling', verified: true
  },
  'term.rolling-tempo': {
    t: 'Rolling tempo target',
    d: 'Rather than forcing every track to one fixed BPM, the target drifts 35% toward each incoming track. That lets a set climb from 100 to 150 BPM across a night while no single transition stretches anything more than 8%.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=Tempo', verified: false
  },
  'term.gate': {
    t: 'Stretch gate',
    d: 'A hard rule for BEATMATCHED transitions: no deck is stretched more than 8% from the rolling tempo. Nothing is discarded for failing it. A track the gate cannot reach is played straight \u2014 its own speed, a plain crossfade, no claim of a beatmatch \u2014 and the set re-bases to its tempo; a track whose beat grid disagrees with its own tempo label is played straight too, and steers nothing.',
    w: null, verified: false
  },

  /* harmony */
  'term.camelot': {
    t: 'Camelot wheel',
    d: 'A relabelling of the circle of fifths for DJs. Twelve numbers, A for minor and B for major. Adjacent numbers are a perfect fifth apart. On the STANDARD wheel the same number with the other letter is the relative major or minor; this deck defaults to its own DECKWAVE TUNE, where the shared number means the parallel major instead (the ⚙ tune select switches). Moves between neighbours sound consonant.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=Circle+of+fifths', verified: false
  },
  'term.key': {
    t: 'Key',
    d: 'The tonal centre a piece is built around. Mixing tracks in compatible keys avoids the clash you hear when two unrelated tonalities overlap.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=Key+(music)', verified: false
  },
  'term.relative-major': {
    t: 'Relative major / minor',
    d: 'Two keys sharing the same notes but a different home note — A minor and C major, for instance. On the standard Camelot wheel these are the same number with the other letter; under this deck’s default DECKWAVE TUNE the shared number goes to the parallel major instead (⚙ tune). A reliable mood change without a harmonic clash.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=Relative+key', verified: false
  },
  'term.harmonic-mixing': {
    t: 'Harmonic mixing',
    d: 'Choosing the next track partly by musical key so the overlap sounds intentional. Deckwave scores every candidate on key compatibility alongside tempo and energy.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=Special:Search?search=harmonic+mixing', verified: false
  },

  /* analysis */
  'term.bpm': {
    t: 'BPM',
    d: 'Beats per minute. Deckwave measures it with five different onset-detection methods and takes the one they agree on, because a single method fails on heavily compressed or chiptune material.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=Tempo', verified: false
  },
  'term.beat-grid': {
    t: 'Beat grid',
    d: 'The measured position of every beat in a track, in seconds. Everything downstream — entry points, exit points, downbeat alignment — is computed from this rather than assumed from the tempo.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=Beat+(music)', verified: false
  },
  'term.spectral-flux': {
    t: 'Spectral flux',
    d: 'How much the spectrum CHANGED between two frames, counting only increases. It detects onsets where a loudness threshold cannot: sidechained dance music holds bass energy near constant, so "is it loud" never fires, but "did it suddenly change" does.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=Special:Search?search=spectral+flux+onset', verified: false
  },
  'term.onset': {
    t: 'Onset',
    d: 'The instant a sound begins — the attack of a kick, a snare, a note. Detecting onsets is how software finds the beat.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=Special:Search?search=onset+detection+audio', verified: false
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
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=Special:Search?search=spectral+centroid', verified: false
  },
  'term.chromagram': {
    t: 'Chromagram',
    d: 'Every octave folded into twelve pitch classes, so all the Cs count as one C. Shows where the harmony sits. NOT a piano roll — pulling individual notes out of a finished mix is an unsolved research problem.',
    w: 'https://en.wikipedia.org/wiki/Chroma_feature', verified: true
  },
  'term.spectrogram': {
    t: 'Spectrogram',
    d: 'Frequency plotted against time. Left is older, right is now; low frequencies at the bottom, brighter means louder. Song structure becomes visible — you can see a drop coming before it lands.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=Spectrogram', verified: false
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
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=Special:Search?search=LUFS+loudness', verified: false
  },
  'term.oscilloscope': {
    t: 'Oscilloscope',
    d: 'Amplitude against time — the raw shape of the last few milliseconds of sound.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=Oscilloscope', verified: false
  },
  'term.polygraph': {
    t: 'Polygraph',
    d: 'Five signals on ruled paper, scrolling like a chart recorder: bass, mid, high, spectral flux and stereo width. Named for the look, but every pen is a real measurement.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=Chart+recorder', verified: false
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
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=Cue+sheet+(computing)', verified: false
  },

  /* library */
  'term.corpus': {
    t: 'Corpus',
    d: 'Your analysed library. Deckwave decodes each track, runs beat detection over the WHOLE track and key and loudness over a centred two-minute excerpt, then DISCARDS the audio — only the features are kept, a few kilobytes per track with its beat grid. That is why hundreds of tracks fit in a browser.',
    w: null, verified: false
  },
  'term.spectrum': {
    t: 'Spectrum',
    d: 'Level per frequency band, right now \u2014 bass on the left, treble on the right. Unlike the spectrogram it has no time axis; it is the present moment only.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=Spectrum+analyzer', verified: false
  },
  'term.position': {
    t: 'Track position',
    d: 'How far the DECK is into the track that is actually playing, with the scheduled exit marked. The exit comes from the schedule, not from the track length: it is snapped to a downbeat, moved by a blend-now, and shortened for a fast-route stepping stone. A straight track shows no beat ticks because its grid is not being used.',
    w: null, verified: false
  },
  'term.journey': {
    t: 'Set journey',
    d: 'Every track in the set as a point in key and energy, with the path walked so far drawn through them. The marker is the track on the deck, found by identity rather than by list position.',
    w: null, verified: false
  },
  'term.centre': {
    t: 'Centre share',
    d: 'How much of the stereo signal sits in the middle (mid) against the sides, as a ratio over the last minute. Mid and side are the sum and the difference of left and right; a mono signal is all mid. A relative measure \u2014 the scale follows the signal.',
    w: 'https://en.wikipedia.org/wiki/Special:Search?search=Mid/side+stereo', verified: false
  },
  'term.route': {
    t: 'Route',
    d: 'The committed detour: the stepping stones the set is walking to reach a destination, and what each one gets \u2014 seconds for a fast stone, full length for a scenic one. Its first line says whether the list and the deck still name the same track; if they do not, every row below is about a set that is not playing.',
    w: null, verified: false
  },
  'term.wayposts': {
    t: 'Wayposts',
    d: 'The whole library laid out by tempo and key, with the tracks reachable from the current tempo lit, the path walked so far, and any destination still queued.',
    w: null, verified: false
  },
  'term.timeline': {
    t: 'Timeline',
    d: 'Level and three frequency bands over the last sixty seconds of the playing track, sampled on a clock so the axis is seconds. Resets when the deck changes track.',
    w: null, verified: false
  },
  'term.drops': {
    t: 'Drops',
    d: 'How fast the bass is rising, over time. A drop is a sharp rise; the panel shows the rate rather than the level, for the same reason the onset detector measures change rather than loudness.',
    w: null, verified: false
  },
  'term.loudtime': {
    t: 'Loudness over time',
    d: 'The RELATIVE loudness reading plotted over the last sixty seconds. Same approximated K-weighting as the loudness panel, so the trend is meaningful and the absolute figure is not a real meter.',
    w: null, verified: false
  },
  'term.sprite': {
    t: 'Sprite',
    d: 'A character that reacts to the music \u2014 bass hits, level, the beat. Decoration that is honest about being decoration; it measures nothing you cannot see elsewhere.',
    w: null, verified: false
  },
  'term.energy-window': {
    t: 'Energy over time',
    d: 'Two lines that are not the same kind of thing. The accent staircase is the track ENERGY index — constructed (45% loudness, 25% brightness, 30% tempo, normalised across your library), a property of the track, flat while it plays and stepping at each handover. The dim area behind is the live relative LEVEL, a measurement. Sampled every two seconds for the last ninety minutes whether or not the tile is on screen; the five tiles are the same record over five windows.',
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
