---
name: deckwave-extension
description: Build a Deckwave extension — a same-origin page that embeds the deck and drives it as an adaptive soundtrack. Use when the user wants a new screen, game, console, or tool on top of Deckwave (music reacting to events, visuals on the beat, a feed with a soundtrack), or asks how extensions work. Covers the embed pattern (iframe + contentWindow), the two public verbs (DWEVENTS.inject to steer, DWEVENTS.pulse for the beat clock), the one-gesture audio rule, the file-bus pattern (append-only jsonl polled by the page), the safety rules (escape everything, read-only surfaces never navigate, no new network surface), and the harness shape. Zero core changes by construction. See deckwave-extension-console for operating the RECON console specifically. [v0.8.2]
---

# Deckwave Extension — the pattern

**Work from the root of a Deckwave checkout** — every path in this file is
relative to it (AGPL-3.0 — an extension distributed with it inherits that).
An extension is a same-origin page
served from the tree that embeds `index.html` in an iframe and gets
everything through `contentWindow`. **Zero core changes, no build step,
no dependencies** — that is what makes it an extension and not a fork.

## The two verbs

- **`DWEVENTS.inject(text)`** — steer the playing set: faster · slower ·
  hype · calmer · change · duck · unduck (free text works; it is a
  synonym table). Obeys the same stretch gate as the whole engine; an
  impossible ask returns a sentence naming why — relay it, never retry
  blindly.
- **`DWEVENTS.pulse()`** — the beat clock, polled from YOUR rAF: track,
  playing tempo (label × stretch), energy, beat {i, phase, untilSec},
  bar {i, beatInBar} under the engine's ASSUMED 4/4 (no downbeat
  detection — say "assumed" in any UI). `{playing:false}` alone when
  silent, so gate on one field. Pull, not push: read at the moment you
  need it, no delivery jitter.

## The rules that keep an extension honest

1. **One real click.** Audio starts only after a user gesture inside the
   deck's frame (▶ or ▶ demo). Design it in as a boot screen.
2. **Escape everything you render.** Your inputs (files, feeds, typed
   text) are untrusted; an unescaped field is an injection point.
   **Know what that buys, and say it accurately.** `serve.py` is
   GET-only — no POST, no PUT — so appending to a feed file in the
   served root needs a filesystem write on the serving machine, which
   is the same privilege as editing your extension's own source.
   Escaping is therefore **defence in depth, not a trust boundary**:
   it exists because a producer composes JSON out of titles and URLs
   it did not author. Keep it; do not sell it as protection against
   someone on the LAN.
3. **Read-only surfaces never navigate.** Copy URLs, do not follow them;
   fetch only your own same-origin data.
4. **No new network surface without a reason you can defend.** The
   file-bus pattern (append JSON lines to a file in the served root, poll
   it with a cache-buster) needs no server change and is inspectable with
   `cat` — default to it. It carries FILES too: a record names a path
   (`speech/x.wav`, `recon-shots/y.png`) and the page renders or plays
   it. **Match the path against a literal shape, never clean it** —
   `^recon-shots/[A-Za-z0-9._-]+\.(png|jpe?g|webp)$` allows no slash
   inside the name, so no fed string can leave the served root, and a
   path that does not match is simply dropped.
5. **A picture is a STILL, and must say so.** Anything showing what
   happened elsewhere has to carry its own age and admit when it is old.
   A frozen frame that looks live is the over-trust failure the HUD
   research (BUILD-LOG Act 39) names by name.
6. **A display that cannot tell working from stopped must say so** rather
   than look calm. Show staleness.
7. **Carry a harness.** `tools/check-recon.js` is the shape: text checks
   pinning each promise to the code that keeps it, falsifiers stated.

## The worked examples, smallest first

- `examples/soundtrack.html` — a game page, ~100 lines: buttons inject,
  a square breathes on pulse().
- `extensions/recon/` — the full console: feed file, downbeat landing,
  reply tray, the DECKWAVE CONSOLE visual register (key-hue accent,
  --beat envelope, CRT). Its own skill: **deckwave-extension-console**.
- `docs/GAME-INTEGRATION.md` — the guide, including the AGPL paragraph a
  studio needs before it emails.
