# Voice synthesis options for the RECON console — 2026-08-23

Research only. **Nothing was installed.** Every claim below is from vendor docs,
repo READMEs or PyPI metadata read on 2026-08-22; nothing here was measured on
this machine. Numbers marked *(vendor)* are the vendor's own and have not been
reproduced here — treat them the way the project treats any unmeasured number.

**The problem.** Text → WAV is rendered locally by `System.Speech` (SAPI 5,
"Microsoft Zira", SSML `rate -15% pitch -8%`), dropped in a served folder, and
played through the browser's facility chain (detuned double + shaped band + slap
delay). The chain is doing the character work; Zira is supplying the raw voice
and it is robotic in the wrong way — SAPI 5 concatenative diphone artefacts,
which the detune/delay chain *amplifies* rather than masks.

**Constraints that decide this.** Render side is local machine tooling, does not
ship in the AGPL tree → any licence is eligible (recorded anyway, because a
model's licence can still bind the *audio* it produces). Output must be WAV/PCM.
Windows 11, Python available, **no CUDA GPU assumed**. Seconds per line is fine;
minutes is not.

---

## Comparison

| Tool | Quality for a calm female narrator | CPU speed (no GPU) | Install effort on this box | Licence | Fit for the facility register |
|---|---|---|---|---|---|
| **Piper (`piper-tts` 1.7.0)** | Good neural VITS. Clean, even, slightly "flat" — *flat is what we want*, the chain adds the affect | ~10× realtime on a desktop CPU *(vendor)*; a line in well under a second | `pip install piper-tts` — **win_amd64 wheel exists** (34 MB, native + phonemizer inside), then one `download_voices` call | **GPL-3.0-or-later** (engine; the old MIT rhasspy/piper is read-only since Oct 2025). Voices are per-voice, mostly permissive research corpora | **Best.** Neutral, unhurried, no chatty prosody for the chain to fight. `en_US-lessac-high` is the audiobook corpus |
| **Kokoro-82M (`kokoro` / `kokoro-onnx`)** | Best-in-class for the size; `af_bella` / `af_heart` are warm, natural American female. Noticeably ahead of Piper on long-form comfort | ~realtime or better on modest CPU *(vendor)*; ONNX build faster than the torch path | `pip install kokoro soundfile` **plus a separate espeak-ng MSI + PATH/env vars** — this is the documented Windows friction point (open issues on it) | **Apache-2.0** (model + code) — the cleanest licence in the table | Very good, but *warmer*. Warmth fights GLaDOS; would need the chain retuned |
| **Chatterbox Nano (Resemble AI)** | Expressive, paralinguistic tags, zero-shot cloning from a reference clip | ~3× realtime on 8 CPU cores *(vendor)* — the only expressive model that is honest about CPU | `pip`, 110M model download | **MIT** — but **every clip carries a PerTh neural watermark**, by design, unremovable-ish | Powerful and the wrong shape: it is a *cloning* tool. See the ethics note |
| **F5-TTS** | Excellent, flow-matching, reference-conditioned | **RTF ≈ 37 on CPU** *(reported)* — i.e. ~37× slower than realtime. A 10 s line ≈ 6 min | Heavy torch stack | MIT code; model weights CC-BY-NC in places | **Disqualified on the latency budget** |
| **StyleTTS2** | Excellent quality | No credible CPU RTF published; torch diffusion-ish path, assume far off realtime | Heavy, fiddly, phonemizer + NLTK | MIT | Disqualified: unmeasured CPU cost, high friction |
| **Coqui XTTS-v2 / forks** | Good cloning, dated next to the above | Slow on CPU; Coqui the company shut down 2024, forks (idiap/coqui-ai-TTS) carry it | Heavy torch | **Coqui Public Model License — non-commercial**, and it is a *model* licence, so it follows the audio | No. Licence follows the output; cloning-shaped |
| **Windows 11 "natural" Narrator voices via NaturalVoiceSAPIAdapter** | Azure-grade neural (Aria, Jenny) **running locally** — a large jump over Zira | Local, fast | Download voice MSIX + install the adapter (32- *and* 64-bit) | Adapter unstated in README; **the voices are Microsoft's, licensed for Narrator/accessibility use** | Tempting — *zero pipeline change*, `System.Speech` just sees a new voice name. But: adapter "uses encryption keys extracted from system files… can stop working after a system update", and the README already says the latest voice builds **stopped working** with it. Fragile + licence-murky |
| **OneCore voices (`Windows.Media.SpeechSynthesis`)** | Better than Zira, still concatenative-era in most SKUs | Local, instant | PowerShell/WinRT instead of `System.Speech`; different API, not SAPI | System voices | Marginal gain for a rewrite. Not worth it |
| **edge-tts (`pip install edge-tts`)** | Azure neural quality, free, excellent female voices | Network round-trip, ~1 s | Trivial: `pip install edge-tts` | **GPLv3 code, but it drives an undocumented Microsoft endpoint** | **Networked, and honestly: ToS-grey.** See below |

### edge-tts, stated honestly

`rany2/edge-tts` reaches the same unpublished websocket endpoint Edge's Read
Aloud uses, with no key and no account. Microsoft has not declared it illegal
and it is the same public-facing API the browser uses; equally, Microsoft's
answer forum position is that using the service outside Edge without an Azure
subscription is not a licensed use, and the quality bar it clears is precisely
the paid Azure Speech product. It is also **not offline** — it puts a network
dependency and a third party into a render step that currently has neither.
Fine for a throwaway audition of what a voice *could* sound like; not something
to build the console's render step on.

---

## TOP RECOMMENDATION — Piper, `en_US-lessac-high`

It is the only option in the table that is offline, fast on CPU, installs from a
prebuilt Windows wheel, has no cloning surface, and produces exactly the
*affect-free* delivery the facility chain wants. The chain is the character;
the TTS should be a clean, steady carrier, and a warmer voice would mean
re-tuning the detune/band/delay to claw the warmth back out.

```powershell
# 1. isolated env so nothing lands in the system Python
py -3 -m venv C:\Claude\Tools\ttsenv
C:\Claude\Tools\ttsenv\Scripts\Activate.ps1

# 2. the engine — prebuilt cp39-abi3-win_amd64 wheel, ~34 MB, no compiler
python -m pip install --upgrade pip
python -m pip install piper-tts

# 3. see the catalogue, then pull three candidates (~20-110 MB each)
python -m piper.download_voices
python -m piper.download_voices en_US-lessac-high
python -m piper.download_voices en_US-hfc_female-medium
python -m piper.download_voices en_US-kristin-medium

# 4. render one line to WAV
python -m piper -m en_US-lessac-high -f C:\Claude\Music\recon\line001.wav `
  -- "Test chamber nineteen. Please proceed to the elevator."
```

Then A/B the three voice files **through the facility chain**, not dry — a voice
that sounds better dry can sound worse doubled and delayed, and the chain is the
instrument the keeper actually hears.

Notes and open questions, flagged rather than guessed:

- **No SSML.** Piper does not take the `rate -15% pitch -8%` SSML the SAPI path
  uses. It exposes `length_scale` (speed), `noise_scale`, `noise_w` via
  `SynthesisConfig` in the Python API. `length_scale` ≈ 1.15 is the analogue of
  rate −15%; **pitch is not a Piper parameter** — the −8% would have to move
  into the browser chain (a detune it already knows how to do) or into an
  offline post-step. That is a change to what the ear hears and is the keeper's
  call, not a substitution to make silently.
- Output is 22.05 kHz mono WAV for `medium`/`high`. Confirm the browser side is
  happy with 22.05 k, or resample once at render.
- **GPL-3.0.** Irrelevant to the AGPL tree as long as the render tool stays
  local machine tooling and is not distributed. If a render script ever ships,
  it inherits the question — AGPL-3.0 and GPL-3.0 are compatible in the
  direction that matters, but say so deliberately rather than by accident.
- The wheel's size suggests the phonemizer ships inside it (no separate
  espeak-ng install is documented). **Unverified — confirm at install time.**

## RUNNER-UP — Kokoro-82M (`af_bella`), Apache-2.0

If Piper's voices come back too thin *after* the chain, Kokoro is the next step
up in naturalness at a cost of one extra system dependency. `af_bella` is the
consensus pick for long-form English female; `af_heart` is warmer still.

```powershell
# espeak-ng first — this is the friction. Installer from:
#   https://github.com/espeak-ng/espeak-ng/releases  (x64 .msi)
# then, in the same venv:
python -m pip install kokoro soundfile
# or the lighter ONNX path (kokoro-v1.0.onnx + voices-v1.0.bin, downloaded manually):
python -m pip install kokoro-onnx soundfile
```

Expect to set `PHONEMIZER_ESPEAK_LIBRARY` / `PHONEMIZER_ESPEAK_PATH` if the
first run raises `espeak not installed on your system` — that is the documented
Windows failure and it is a PATH problem, not a broken install.

---

## The GLaDOS models — what actually exists, and the IP question

There are real, working GLaDOS voices, and they are all the same lineage:

| Model | Form | Licence as published | Provenance |
|---|---|---|---|
| `dnhkng/GlaDOS` → `models/glados.onnx` | **Piper/VITS ONNX — drops straight into the Piper pipeline above** | Repo MIT | Trained on Portal game audio |
| `csukuangfj/vits-piper-en_US-glados`, `rokeya71/VITS-Piper-GlaDOS-en-onnx` | Same model, re-hosted for sherpa-onnx | inherited | ditto |
| `R2D2FISH/glados-tts`, `VRCWizard/glados-tts-voice-wizard` | Forward Tacotron + HiFiGAN, CPU-fast, own runtime | repo licence, model unstated | ditto |
| `WarriorMama777/GLaDOS_TTS` (HF) | model card | **CreativeML OpenRAIL-M** | card names the performer, Ellen McLain |
| `TazzerMAN/piper-voice-glados-fr` | Piper voice, French | MIT | ditto |

**The honest IP paragraph.** The repository licence on these projects (MIT,
OpenRAIL-M) is the *author's* licence on their own code and weights. It cannot
launder the training data. Every one of these models was trained on extracted
Portal/Portal 2 dialogue: that audio is Valve's copyrighted work, GLaDOS is
Valve's character and trademark, and the performance is Ellen McLain's — a real
person whose voice is her professional identity, with statutory
right-of-publicity/voice protections in several US states (and 2024–25 synthetic
performance rules that bear directly on trained soundalikes). So an MIT tag on a
GLaDOS `.onnx` is not clearance; it is a claim the author was not in a position
to make. **For a project publishing to GitHub**, the
calculus inverts: shipping GLaDOS-voiced WAVs in the tree, or a render script
that pulls that model, attaches someone else's character, trademark and
performer's voice to a public release, and it is the kind of thing that draws a
takedown rather than a lawsuit — cheap for them, expensive for us, and it would
land on launch week. Recommendation: **do not put a GLaDOS-trained model or its
output in the published tree.** Get the register from a clean voice plus the
facility chain, which is where the character has been coming from all along.

## Voice cloning — the line, in one paragraph

"Scarlett Johansson in *Her* meets GLaDOS" is a **register** — calm, close-mic,
faintly amused, mechanically even — and it must stay a register rather than
become a clone. The distinction is not aesthetic; it is that Johansson has
already had to publicly object to a synthetic voice built to evoke her, and the
tools in this table make crossing that line a matter of dragging in a 10-second
reference clip: **Chatterbox Nano and F5-TTS clone zero-shot from one sample,
XTTS from a few seconds**. Those tools are legitimate — for consented voices,
one's own voice, or licensed talent — and they are not what we point at a
public figure. Piper and Kokoro are recommended here partly *because* they are
fixed-voice models with no cloning surface: there is no reference-clip input to
misuse. The register comes from the direction and the DSP chain, which is a
craft answer rather than an extraction, and it is also the better-sounding one.

---

## Sources

- Piper: [piper-tts on PyPI](https://pypi.org/project/piper-tts/) · [OHF-Voice/piper1-gpl](https://github.com/OHF-Voice/piper1-gpl/blob/main/docs/API_PYTHON.md) · [install docs](https://thedocs.io/piper1-gpl/installation/) · [VOICES.md](https://github.com/rhasspy/piper/blob/master/VOICES.md)
- Kokoro: [hexgrad/Kokoro-82M](https://huggingface.co/hexgrad/Kokoro-82M) · [VOICES.md](https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md) · [Windows espeak issue](https://github.com/hexgrad/kokoro/issues/101) · [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx/issues/120) · [onnx-community/Kokoro-82M-v1.0-ONNX](https://huggingface.co/onnx-community/Kokoro-82M-v1.0-ONNX)
- Chatterbox: [resemble-ai/chatterbox](https://github.com/resemble-ai/chatterbox) · [Nano model card](https://huggingface.co/ResembleAI/chatterbox-nano) · [Nano/Flash announcement](https://www.resemble.ai/resources/chatterbox-nano-and-flash-speed-at-the-edge-throughput-at-scale)
- F5-TTS CPU RTF: [SWivid/F5-TTS issue #81](https://github.com/SWivid/F5-TTS/issues/81)
- Windows natural voices: [NaturalVoiceSAPIAdapter](https://github.com/gexgd0419/NaturalVoiceSAPIAdapter) · [voice download links](https://github.com/gexgd0419/NaturalVoiceSAPIAdapter/wiki/Narrator-natural-voice-download-links) · [Windows.Media.SpeechSynthesis](https://learn.microsoft.com/en-us/uwp/api/windows.media.speechsynthesis)
- edge-tts: [rany2/edge-tts](https://github.com/rany2/edge-tts) · [Microsoft Q&A on the unofficial API](https://learn.microsoft.com/en-us/answers/questions/2392491/unofficial-edge-tts-api) · [Q&A on commercial use](https://learn.microsoft.com/en-us/answers/questions/2088770/are-opensource-edge-tts-free-for-commercial-use)
- GLaDOS models: [dnhkng/GlaDOS](https://github.com/dnhkng/GlaDOS) · [csukuangfj/vits-piper-en_US-glados](https://huggingface.co/csukuangfj/vits-piper-en_US-glados) · [R2D2FISH/glados-tts](https://github.com/R2D2FISH/glados-tts) · [WarriorMama777/GLaDOS_TTS](https://huggingface.co/WarriorMama777/GLaDOS_TTS/blob/main/README.md) · [giers10/GLaDOSify](https://github.com/giers10/GLaDOSify)
