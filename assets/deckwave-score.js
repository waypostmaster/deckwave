/* ─────────────────────────────────────────────────────────────────────────
   DECKWAVE · SCORE
   A mix expressed as executable data rather than rendered audio.

   The premise: nothing about the mix is improvised. The sequence comes from
   measured features, the entry points from beat grids, the tempo multipliers
   from arithmetic. "Live" is only when it runs. So the mix is not a recording
   to capture — it is a score, and a score can be written down.

   Roughly 26KB describes a 197-minute set. The FLAC would be 3GB and would
   preserve only the sound. This preserves the HOW.

   DETERMINISM — read this before quoting the claim.
   Reproducibility depends on identical Essentia/WASM builds, identical decode
   paths, and stable analysis across browser versions. This is the same problem
   tracker modules have always had: no normative spec means the same file can
   sound different in different players. The engine block MITIGATES that by
   declaring what produced the mix. It does not eliminate it, and cross-browser
   determinism has NOT been tested. State the claim with that attached.
   ───────────────────────────────────────────────────────────────────────── */

window.DWSCORE = (function () {
'use strict';

/* every 4th beat, assumed — there is no downbeat detection here (see WISDOM) */
function downbeatNear(beats, t) {
  let best = t, d = Infinity;
  for (let i = 0; i < beats.length; i += 4) {
    const dd = Math.abs(beats[i] - t);
    if (dd < d) { d = dd; best = beats[i]; }
  }
  return best;
}

/* Walk the set exactly as the player will, recording every decision.

   THIS HAS TO MODEL THE PLAYER AS IT IS, NOT AS IT WAS. Until 2026-08-19 it
   stretched every track by tempo/bpm — the pre-0.7.0 player. The player now
   plays an UNLOCKED track straight (rate 1, entry at 0, exit on the clock),
   and the two straight modes move the rolling target differently: a 'reach'
   track repositions it to its own BPM, a 'grid' track moves it nowhere. A
   stepping stone carries `_dwell` and plays for that instead of its length.
   None of that was here, so the score and the cue sheet printed a stretch
   — 28% against WHEN AN ANGEL DIES — for tracks the deck never stretches.
   That is the exact claim CLAUDE.md forbids: a stretch figure against an
   unmatched track describes an event that does not happen.

   The dwell floor is read from the engine so the number lives in one place;
   45 is the fallback for a score built without the engine loaded. */
function plan(set, opts) {
  opts = opts || {};
  const XF = opts.xfade || 16, drift = opts.drift || 0.35;
  const floor = (window.DW && window.DW.dwellFloor) || 45;
  /* PHRASE MODE (2026-08-19): a set built with `build · phrase match` is
     stamped `phrase: true`, and the Player then leaves each track at its
     last 8-bar phrase start, enters the next at ITS first phrase start, and
     fades for one phrase. The offsets come from DWPHRASE at play time and
     are stamped on the meta as `phrase`; a track that has not played yet
     has none, and the plan says so (phraseBar null → the Player will
     compute it when the track is reached; until then this line describes
     the downbeat path, which is also what the Player falls back to). */
  const PHM = !!(opts.phrase != null ? opts.phrase : set.phrase);
  const PH = window.DWPHRASE || null;
  const out = [];
  let tempo = set[0].bpm, clock = 0;

  set.forEach((m, i) => {
    const straight = !!m._unlocked;
    const rate = (i === 0 || straight) ? 1 : tempo / m.bpm;
    const ph = (PHM && PH && !straight && m.phrase && m.phrase.ok && m.phrase.v === PH.V) ? m.phrase : null;
    const entry = straight ? 0 : ph ? (m.beats[ph.beat] || 0) : ((m.beats || [0])[0] || 0);
    const k = 1 / rate;
    const beats = (m.beats || []).map(b => (b - entry) * k);
    let fade = XF, exit = null, onPhrase = false;
    if (ph) {
      const one = PH.lengthAt(beats, ph.beat) || XF;
      const nat = ((m.dur - entry) * k) - one;
      const pf = m._dwell ? Math.max(floor, Math.min(m._dwell, nat)) : Math.max(floor, nat);
      const s = PH.lastStartWithin(beats, ph, Math.min(floor, pf), pf);
      if (s) { exit = s.t; fade = PH.lengthAt(beats, s.i) || XF; onPhrase = true; }
    }
    if (exit == null) {
      const natural = ((m.dur - entry) * k) - XF;
      const playFor = m._dwell ? Math.max(floor, Math.min(m._dwell, natural)) : Math.max(floor, natural);
      exit = (beats.length && !straight) ? downbeatNear(beats, playFor) : playFor;
    }

    out.push({
      i, name: m.name,
      bpm: +m.bpm.toFixed(2), camelot: m.camelot, key: m.key + ' ' + m.scale,
      energy: m.energy, conf: m.conf,
      /* `straight` is the reason a track is not beatmatched — 'grid' (its
         beats disagree with its tempo label) or 'reach' (the set could not
         stretch to it) — or null for a locked, beatmatched track. stretchPct
         is NULL rather than 0 for a straight track: 0 reads as "the best
         transition in the set" and it is not a transition of that kind. */
      straight: straight ? (m._unlockReason || 'grid') : null,
      rate: +rate.toFixed(4),
      stretchPct: straight ? null : +((rate - 1) * 100).toFixed(2),
      entrySec: +entry.toFixed(3), exitSec: +exit.toFixed(3),
      dwellSec: m._dwell ? +Math.max(floor, m._dwell) : null,
      /* phrase mode only: the detected 8-bar offset (0–7) and its contrast,
         or null when the offset is not known yet / not applicable. `onPhrase`
         says whether THIS step's entry and exit are phrase-aligned in the
         plan; xfadeSec is then one phrase, not the set's xfade. */
      phraseBar: ph ? ph.at : null,
      phraseContrast: ph ? ph.contrast : null,
      onPhrase: PHM ? onPhrase : null,
      atSec: +clock.toFixed(2),
      xfadeSec: +fade.toFixed(2), bassSwapSec: +(fade * 0.45).toFixed(2),
      durSec: m.dur,
      /* 2026-08-19, additive: a track fetched from a libre source (DWLIBRE)
         carries its licence and attribution. A score that holds such a track
         MUST carry the terms — most CC licences require attribution, and a
         reader of the score is the one publishing the mix. null for a local
         file, whose terms are the owner's business. */
      source: m.source ? {
        kind: m.source.kind || null, item: m.source.item || null, page: m.source.page || null,
        creator: m.source.creator || null, release: m.source.release || null,
        licence: m.source.licence || null, licenceName: m.source.licenceName || null,
        noDerivatives: !!m.source.noDerivatives, file: m.source.file || null, format: m.source.format || null
      } : null
    });
    clock += exit;
    /* the same three-way move chain() makes after it schedules a deck */
    if (!straight) tempo += (m.bpm - tempo) * drift;
    else if (m._unlockReason === 'reach') tempo = m.bpm;
  });
  return out;
}

function score(set, opts) {
  opts = opts || {};
  const steps = plan(set, opts);
  const last = steps[steps.length - 1];
  const total = last.atSec + last.exitSec + (last.xfadeSec || opts.xfade || 16);
  const phm = !!(opts.phrase != null ? opts.phrase : set.phrase);
  return {
    format: 'deckwave-set', version: 1,
    generated: new Date().toISOString(),
    engine: {
      /* build mode and the phrase flag, so load() can put the mode back */
      mode: set.mode || (phm ? 'phrase' : 'all'),
      phrase: phm,
      sequencer: 'rolling-tempo target, camelot + energy arc, hard stretch gate; ' +
                 'a track the gate cannot reach, or whose grid disagrees with its tempo, plays STRAIGHT',
      drift: opts.drift || 0.35,
      xfadeSec: opts.xfade || 16,
      maxStretch: opts.maxStretch || 0.08,
      maxGridErrPct: (window.DW && window.DW.lock) ? window.DW.lock.maxGridErrPct : null,
      detector: 'essentia.js RhythmExtractor2013 multifeature, whole track (key/rms: centred 120s excerpt)',
      keyDetector: 'essentia.js KeyExtractor',
      stretch: 'SoundTouchJS AudioWorklet 2.1.1 — source playbackRate = rate, worklet restores pitch',
      transition: phm
        ? '8-bar-phrase-aligned crossfade, one phrase long, with 3-band bass swap; a track without a usable phrase, or played straight, takes the downbeat/clock path'
        : 'downbeat-aligned crossfade with 3-band bass swap; straight tracks crossfade on the clock, unaligned',
      phraseDetector: phm ? 'DWPHRASE v' + ((window.DWPHRASE && window.DWPHRASE.V) || '?') +
        ' — least within-phrase variance of per-bar loudness/low/high/zcr over 8-bar groups; offsets computed at play time' : null,
      downbeat: 'assumed every 4th beat from first — no downbeat detection',
      determinism: 'depends on identical engine builds; NOT cross-browser tested'
    },
    summary: {
      tracks: steps.length, runtimeSec: Math.round(total),
      /* how many steps carry a libre source, and whether any is no-derivatives */
      libre: steps.filter(s => s.source).length,
      noDerivatives: steps.filter(s => s.source && s.source.noDerivatives).length,
      tempoStart: steps[0].bpm, tempoEnd: last.bpm,
      /* LOCKED tracks only. A straight track is not stretched because it is
         not being beatmatched — folding its 0 in would pull the figure toward
         "everything is fine", which is a different fact. */
      straight: steps.filter(s => s.straight).length,
      maxStretchPct: +Math.max(0, ...steps.filter(s => s.stretchPct != null)
                                          .map(s => Math.abs(s.stretchPct))).toFixed(2)
    },
    steps
  };
}

/* Standard .cue — opens in VLC, foobar2000, most players. */
function cue(sc, title) {
  const t = s => {
    const m = Math.floor(s / 60), ss = Math.floor(s % 60), f = Math.round((s % 1) * 75);
    return [m, ss, f].map(x => String(x).padStart(2, '0')).join(':');
  };
  let o = 'REM DECKWAVE SET — ' + sc.summary.tracks + ' tracks, ' +
          Math.round(sc.summary.runtimeSec / 60) + ' min\n';
  o += 'REM ENGINE ' + sc.engine.detector + ' / ' + sc.engine.stretch + '\n';
  o += 'REM GENERATED ' + sc.generated + '\n';
  o += 'TITLE "' + (title || 'Deckwave Set') + '"\nFILE "mix.flac" WAVE\n';
  sc.steps.forEach((s, i) => {
    o += '  TRACK ' + String(i + 1).padStart(2, '0') + ' AUDIO\n';
    o += '    TITLE "' + s.name.replace(/"/g, "'") + '"\n';
    /* never a percentage against a straight track — see plan() */
    o += '    REM BPM ' + s.bpm + ' KEY ' + s.camelot +
         (s.straight ? ' STRAIGHT ' + s.straight + ' (no beatmatch)'
                     : ' RATE ' + s.rate + ' STRETCH ' + s.stretchPct + '%') + '\n';
    /* a libre track's terms travel with the cue sheet too */
    if (s.source) o += '    REM ATTRIBUTION "' + String((s.source.creator || '') + ' / ' + (s.source.release || '') + ' / '
         + (s.source.licenceName || s.source.licence || 'licence unknown') + ' / ' + (s.source.page || '')).replace(/"/g, "'") + '"\n';
    o += '    INDEX 01 ' + t(s.atSec) + '\n';
  });
  return o;
}

/* Rebuild a set from a score. Reports what it could not find rather than
   silently dropping it — a short set that looks complete is worse than a
   short set that says why. */
function load(json, corpus) {
  const sc = typeof json === 'string' ? JSON.parse(json) : json;
  if (sc.format !== 'deckwave-set') throw new Error('not a deckwave set file');
  const nm = s => s.toLowerCase().replace(/[^a-z0-9]/g, '');
  const set = [], missing = [];
  sc.steps.forEach(s => {
    const m = corpus.find(t => nm(t.name) === nm(s.name));
    if (!m) { missing.push(s.name); return; }
    m._stretch = s.rate;
    /* Put the classification back, or a straight track loads as a locked
       one and chain() stretches it by tempo/bpm — for a track whose label
       and grid disagree by 28% that is a 28% stretch nobody chose. Scores
       written before `straight` existed carry no field; those sets were
       built when everything was beatmatched and are left as they were, which
       is the same `_locked === undefined` policy resequenceTail() uses. */
    if ('straight' in s) {
      if (s.straight) { m._unlocked = true; m._unlockReason = s.straight; m._locked = s.straight === 'reach'; }
      else { delete m._unlocked; delete m._unlockReason; m._locked = true; }
    }
    if (s.dwellSec) m._dwell = s.dwellSec; else delete m._dwell;
    /* the terms a libre track was saved under come back with it; a record
       that already carries its own (fetched again this session) keeps them */
    if (s.source && !m.source) m.source = s.source;
    set.push(m);
  });
  /* put the build mode back, so a phrase-match set plays as one */
  if (sc.engine) { if (sc.engine.mode) set.mode = sc.engine.mode; set.phrase = !!sc.engine.phrase; }
  return { loaded: set.length, missing, set, score: sc };
}

return { plan, score, cue, load, downbeatNear };
})();
