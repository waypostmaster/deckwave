#!/usr/bin/env python3
"""Set a rendered take's REGISTER — the half the browser cannot do.

    python tools/register.py --in speech/say-p303.wav --out speech/x.wav --preset facility
    python tools/register.py --in a.wav --out b.wav --formant 0.86 --ring 0.18 --ring-hz 62
    python tools/register.py --presets          # what the grades are

NAMED FOR THE KEEPER'S OWN LINE — *"the register, not the person"*. That
sentence has been the honesty label on this chain since the voice night,
and it is exactly what this tool moves: the character a voice speaks in,
not an impersonation of anybody. A famous computer voice was the
reference point while tuning, and saying so is fair comment; naming a
file after it would have been borrowing someone else's trademark to
describe our own work. The keeper's verdict on the resemblance, 2026-08-23,
and it is the honest one: *"it doesn't sound like GLaDOS anyway, and
that's okay."* It is its own register now.

WHY THIS EXISTS, and what it deliberately does NOT touch.

The console's facility chain (recon-app.js, fx: 'facility') already applies
the band (highpass 140 / lowpass 6500), the detuned double at x1.007, and
the slap at 55 ms — and **those numbers were locked by the keeper's ear**
(evidence/voice-pipeline-2026-08-23.md). Nothing here reproduces them.
This tool adds only the two things Web Audio has no node for:

  FORMANT SHIFT  moves the spectral envelope without moving pitch. This is
                 the one that turns a particular young woman into a
                 machine that sounds like her: below 1.0 the resonances
                 drop while the pitch stays, which no playbackRate can do
                 (`warp` moves pitch AND speed together — that is the
                 whole reason warp is labelled honestly in the console).
  RING MOD       a low-rate amplitude multiply, the metallic shimmer.
                 Depth is kept small on purpose; past ~0.35 it stops
                 reading as "processed voice" and starts reading as Dalek.

So a treated take is meant to be played THROUGH the facility chain, not
instead of it. The two compose; neither duplicates the other.

METHOD, stated so the artifacts are expected rather than mysterious.
Formant shifting is cepstral: per STFT frame, the log-magnitude spectrum
is split into a smooth ENVELOPE (low quefrency) and the fine harmonic
structure (the rest). The envelope alone is resampled by `formant`, the
fine structure is left where it is, and the frame is resynthesised on its
original phase. Phase is not re-estimated, so heavy shifts smear
transients — audible below about 0.8, which is why the presets stop there.

numpy only, no scipy — this is machine-side tooling like speak.py and
serve.py. NOTHING here is needed to run or test the app; the app plays
finished WAVs and never imports Python.
"""
import argparse, sys, wave, math
import numpy as np

FFT = 1024
HOP = 256

# The grades. `facility` is CANON for the console voice as of 2026-08-23:
# the keeper auditioned all four on speaker 99 and ruled by ear
# ("g2-p303 will work"). Nobody moves those three numbers by reasoning -
# same rule as gain 1.62 and room 0.3 in evidence/voice-pipeline.
PRESETS = {
    'plain':    dict(formant=1.0,  ring=0.0,  ring_hz=0,   drive=0.0),
    'near':     dict(formant=0.94, ring=0.10, ring_hz=48,  drive=0.0),
    'facility': dict(formant=0.88, ring=0.18, ring_hz=62,  drive=0.15),
    'deep':     dict(formant=0.82, ring=0.28, ring_hz=76,  drive=0.30),
}
ORDER = ['plain', 'near', 'facility', 'deep']
ALIAS = {str(i): n for i, n in enumerate(ORDER)}   # --preset 2 still works


def read_wav(path):
    with wave.open(path, 'rb') as w:
        if w.getsampwidth() != 2:
            sys.exit('need 16-bit PCM, got %d-byte samples' % w.getsampwidth())
        sr, ch, n = w.getframerate(), w.getnchannels(), w.getnframes()
        x = np.frombuffer(w.readframes(n), dtype='<i2').astype(np.float64) / 32768.0
    if ch > 1:
        x = x.reshape(-1, ch).mean(axis=1)
    return x, sr


def write_wav(path, x, sr):
    peak = np.max(np.abs(x))
    if peak > 0.999:                      # only ever attenuate, never make up gain
        x = x * (0.999 / peak)
    with wave.open(path, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes((x * 32767.0).astype('<i2').tobytes())


def formant_shift(x, factor, quefrency=40):
    """Move the spectral envelope by `factor`, leaving pitch where it is."""
    if abs(factor - 1.0) < 1e-6:
        return x
    win = np.hanning(FFT + 1)[:FFT]
    pad = np.concatenate([np.zeros(FFT), x, np.zeros(FFT * 2)])
    out = np.zeros(len(pad))
    norm = np.zeros(len(pad))
    nbin = FFT // 2 + 1
    src = np.arange(nbin)
    # where each output bin reads its envelope from; > nbin-1 clamps at the top
    read = np.clip(src / factor, 0, nbin - 1)

    for i in range(0, len(pad) - FFT, HOP):
        frame = pad[i:i + FFT] * win
        spec = np.fft.rfft(frame)
        mag = np.abs(spec)
        logmag = np.log(mag + 1e-10)
        # cepstral envelope: keep only the low quefrency part
        ceps = np.fft.irfft(logmag, n=FFT)
        ceps[quefrency:-quefrency] = 0
        env = np.real(np.fft.rfft(ceps, n=FFT)[:nbin])
        shifted = np.interp(read, src, env)
        gain = np.exp(shifted - env)          # apply only the envelope CHANGE
        newspec = spec * gain
        out[i:i + FFT] += np.real(np.fft.irfft(newspec, n=FFT)) * win
        norm[i:i + FFT] += win * win

    out = out[FFT:FFT + len(x)] / np.maximum(norm[FFT:FFT + len(x)], 1e-6)
    return out


def ring_mod(x, sr, depth, hz):
    if depth <= 0 or hz <= 0:
        return x
    t = np.arange(len(x)) / sr
    return x * (1.0 - depth + depth * np.cos(2 * math.pi * hz * t))


def drive(x, amount):
    """Gentle asymmetric saturation - a little grit, not distortion."""
    if amount <= 0:
        return x
    k = 1.0 + amount * 8.0
    return np.tanh(x * k) / math.tanh(k) * (0.7 + 0.3 * (1 - amount))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--in', dest='src', help='source wav (16-bit PCM)')
    ap.add_argument('--out', help='destination wav')
    ap.add_argument('--presets', action='store_true',
                    help='print the grades and exit')
    ap.add_argument('--preset', default='plain',
                    help='grade: ' + ' · '.join(ORDER) + ' (0-3 also accepted)')
    ap.add_argument('--formant', type=float, help='envelope shift, <1 lowers (0.8..1.0 sane)')
    ap.add_argument('--ring', type=float, help='ring mod depth 0..0.35')
    ap.add_argument('--ring-hz', type=float, help='ring mod rate in Hz')
    ap.add_argument('--drive', type=float, help='saturation 0..0.4')
    a = ap.parse_args()

    if a.presets:
        for n in ORDER:
            q = PRESETS[n]
            print('%-9s formant %.2f  ring %.2f @ %-3g Hz  drive %.2f%s'
                  % (n, q['formant'], q['ring'], q['ring_hz'], q['drive'],
                     '   <- canon for the console voice' if n == 'facility' else ''))
        return
    if not a.src or not a.out:
        sys.exit('--in and --out are required (or use --presets)')

    name = ALIAS.get(str(a.preset), str(a.preset))
    if name not in PRESETS:
        sys.exit('no grade "%s" - have: %s' % (a.preset, ', '.join(ORDER)))
    p = dict(PRESETS[name])
    for k in ('formant', 'ring', 'drive'):
        if getattr(a, k) is not None:
            p[k] = getattr(a, k)
    if a.ring_hz is not None:
        p['ring_hz'] = a.ring_hz

    x, sr = read_wav(a.src)
    y = formant_shift(x, p['formant'])
    y = ring_mod(y, sr, p['ring'], p['ring_hz'])
    y = drive(y, p['drive'])
    write_wav(a.out, y, sr)
    print('%s -> %s  [%s] formant=%.2f ring=%.2f@%gHz drive=%.2f  (%.2f s, %d Hz)'
          % (a.src, a.out, name, p['formant'], p['ring'], p['ring_hz'],
             p['drive'], len(y) / sr, sr))


if __name__ == '__main__':
    main()
