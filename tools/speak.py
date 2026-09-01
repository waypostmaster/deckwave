#!/usr/bin/env python3
"""Render the console's voice to a WAV in speech/ — the agent-side half
of the rendered-voice pipeline (evidence/voice-pipeline-2026-08-23.md).

    python tools/speak.py --out speech/take9.wav "The words to say."
    python tools/speak.py --engine sapi --out speech/x.wav --file words.txt
    python tools/speak.py --voice sideloaded --out speech/x.wav "On the side."
    python tools/speak.py --list          # models here, and their speaker counts
    python tools/speak.py --voice en_GB-vctk-medium --speaker 47 --out speech/x.wav "Try 47."

Engines, chosen in this order unless --engine forces one:

  piper  - Piper TTS (pip install piper-tts; NOT needed to run or test
           the app - this script is machine-side tooling like serve.py,
           and the app only ever plays finished WAVs). One voice model
           renders IDENTICALLY on Windows, macOS and Linux CPUs, which
           is what makes the narrator consistent across platforms.
           Models live in speech/models/ (gitignored):
               python -m piper.download_voices en_US-lessac-high --data-dir speech/models
           `download_voices` with NO name prints the whole catalogue —
           ~130 community-contributed models, 38 of them English. Four
           are MULTI-SPEAKER (en_GB-vctk-medium 109 voices,
           en_US-libritts/libritts_r, en_US-arctic, en_US-l2arctic):
           one download, a hundred registers, chosen with --speaker.
           --voice takes a model name from that dir or a path to any
           .onnx — that path is the SIDE-LOAD SEAM: a voice model that
           must not ship in this tree (see the GLaDOS IP paragraph in
           docs/research/voice-synth-options-2026-08-23.md) can still
           be used locally by dropping its .onnx+.onnx.json in
           speech/models/ and naming it. Nothing in the tree ever
           references such a model; the seam is the whole integration.
  sapi   - Windows System.Speech, Microsoft Zira, SSML rate -15%
           pitch -8% — the voice of takes 1-8, kept as the fallback so
           the pipeline works on a bare Windows machine with no pip.

Piper caveat, measured in the research and repeated here so nobody
tunes blind: Piper has NO pitch parameter. --length-scale (default
1.15, ~= the -15% rate) covers pace; the -8% pitch of the Zira recipe
has no Piper equivalent, so the browser chain grew a `warp` knob
(voiceCfg {"warp": 0.92} ~= -8% pitch AND -8% speed on playback,
keeper-tunable). A new engine is a new register: the LOCKED numbers
(gain 1.62, room 0.3) were locked by ear FOR Zira and the ear re-rules
on any engine change.
"""
import argparse, os, subprocess, sys, wave

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MODELS = os.path.join(ROOT, 'speech', 'models')
DEFAULT_VOICE = 'en_US-lessac-high'


def find_model(name):
    """A --voice is a path to an .onnx, or a model name in speech/models/."""
    if name.lower().endswith('.onnx') and os.path.isfile(name):
        return name
    p = os.path.join(MODELS, name + '.onnx')
    return p if os.path.isfile(p) else None


def speakers(model):
    """How many voices live in one model file. Piper's multi-speaker models
    (vctk, libritts, arctic) are a hundred-odd registers in ONE download —
    reachable only with --speaker, which is why it exists."""
    try:
        import json
        with open(model + '.json', encoding='utf8') as f:
            return int(json.load(f).get('num_speakers', 1))
    except Exception:
        return 1


def list_models():
    """What is on this machine, with the speaker count per model."""
    have = sorted(f for f in os.listdir(MODELS)) if os.path.isdir(MODELS) else []
    have = [f[:-5] for f in have if f.endswith('.onnx')]
    if not have:
        print('no models in %s — download one with:\n'
              '  python -m piper.download_voices en_US-lessac-high --data-dir speech/models\n'
              '  python -m piper.download_voices            # with no name: the whole catalogue'
              % MODELS)
        return
    for name in have:
        n = speakers(os.path.join(MODELS, name + '.onnx'))
        print('%-34s %s' % (name, '%d speakers (--speaker 0..%d)' % (n, n - 1) if n > 1 else 'single voice'))


def render_piper(text, out, voice, length_scale, speaker):
    from piper import PiperVoice, SynthesisConfig
    model = find_model(voice)
    if not model:
        # filter THEN strip, list_models' idiom — strip-then-filter turned
        # any stray file into a garbage suggestion (notes.txt -> 'note', P3)
        have = sorted(os.listdir(MODELS)) if os.path.isdir(MODELS) else []
        have = [f[:-5] for f in have if f.endswith('.onnx')]
        sys.exit('no model "%s" in %s (have: %s) — download with:\n'
                 '  python -m piper.download_voices %s --data-dir speech/models'
                 % (voice, MODELS, ', '.join(have) or 'none', voice))
    n = speakers(model)
    # `is not None`, not truthiness: --speaker 0 is a documented selection
    # (--list says 0..N-1) and `speaker or None` sent it as unset — piper
    # warned "speaker_id not specified", picked its default by luck, and
    # the label dropped #0 (P4)
    if speaker is not None and speaker >= n:
        sys.exit('--speaker %d but %s has %d (0..%d)'
                 % (speaker, os.path.basename(model), n, n - 1))
    v = PiperVoice.load(model)
    cfg = SynthesisConfig(length_scale=length_scale, speaker_id=speaker)
    with wave.open(out, 'wb') as f:
        v.synthesize_wav(text, f, cfg)
    return 'piper:' + os.path.basename(model) + ('#%d' % speaker if speaker is not None else '')


def render_sapi(text, out):
    """The Zira recipe of takes 1-8, verbatim (rate -15% pitch -8%)."""
    ssml = ('<speak version="1.0" xmlns="http://www.w3.org/2001/10/synthesis"'
            ' xml:lang="en-US"><prosody rate="-15%" pitch="-8%">'
            + text.replace('&', ' and ').replace('<', ' ').replace('>', ' ')
            + '</prosody></speak>')
    ps = (
        "Add-Type -AssemblyName System.Speech\n"
        "$s = New-Object System.Speech.Synthesis.SpeechSynthesizer\n"
        "$v = $s.GetInstalledVoices() | Where-Object { $_.VoiceInfo.Name -like '*Zira*' } | Select-Object -First 1\n"
        "if (-not $v) { Write-Error 'no Zira'; exit 1 }\n"
        "$s.SelectVoice($v.VoiceInfo.Name)\n"
        "$s.SetOutputToWaveFile([IO.File]::ReadAllText($env:DW_OUT_FILE).Trim())\n"
        "$s.SpeakSsml([IO.File]::ReadAllText($env:DW_SSML_FILE))\n"
        "$s.Dispose()\n"
    )
    import tempfile
    with tempfile.TemporaryDirectory() as td:
        sf = os.path.join(td, 'ssml.xml'); of = os.path.join(td, 'out.txt')
        open(sf, 'w', encoding='utf8').write(ssml)
        open(of, 'w', encoding='utf8').write(os.path.abspath(out))
        env = dict(os.environ, DW_SSML_FILE=sf, DW_OUT_FILE=of)
        r = subprocess.run(['powershell', '-NoProfile', '-NonInteractive', '-Command', ps],
                           env=env, capture_output=True, text=True)
        if r.returncode:
            sys.exit('sapi render failed: ' + (r.stderr or r.stdout).strip()[:300])
    return 'sapi:Zira'


def main():
    ap = argparse.ArgumentParser(description='Render the console voice to a WAV.')
    ap.add_argument('text', nargs='?', help='the words (or use --file / stdin)')
    ap.add_argument('--file', help='read the words from a file')
    ap.add_argument('--out', help='output wav (under speech/) — required unless --list')
    ap.add_argument('--list', action='store_true',
                    help='list the models in speech/models/ and their speaker counts, then exit')
    ap.add_argument('--speaker', type=int, default=None,
                    help='speaker index inside a multi-speaker model (vctk, libritts, arctic); --list shows the count. Explicit 0 is a real selection, not the default (P4)')
    ap.add_argument('--engine', choices=['auto', 'piper', 'sapi'], default='auto')
    ap.add_argument('--voice', default=DEFAULT_VOICE,
                    help='piper model name in speech/models/ or a path to any .onnx (the side-load seam)')
    ap.add_argument('--length-scale', type=float, default=1.15,
                    help='piper pace; 1.15 ~= the Zira recipe\'s -15%% rate (piper has NO pitch knob - see header)')
    a = ap.parse_args()

    if a.list:
        list_models()
        return
    if not a.out:
        sys.exit('--out is required (or use --list)')

    text = a.text or (open(a.file, encoding='utf8').read() if a.file else sys.stdin.read())
    text = ' '.join(text.split())
    if not text:
        sys.exit('nothing to say')

    engine = a.engine
    if engine == 'auto':
        try:
            import piper  # noqa: F401
            engine = 'piper' if find_model(a.voice) else 'sapi'
        except ImportError:
            engine = 'sapi'

    used = render_piper(text, a.out, a.voice, a.length_scale, a.speaker) if engine == 'piper' \
        else render_sapi(text, a.out)
    print('%s -> %s (%d bytes, %d chars)' % (used, a.out, os.path.getsize(a.out), len(text)))


if __name__ == '__main__':
    main()
