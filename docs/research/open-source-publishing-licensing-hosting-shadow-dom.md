# Publishing a Browser-Based MIR / DJ Mixing App as Open Source: Licensing, Hosting, and Themable Shadow DOM

> **Researched August 2026.** Third-party versions, terms, prices, quotas
> and browser-support claims below are as of that date and are NOT
> maintained. Re-check anything you intend to rely on.


## TL;DR
- **The AGPL-3.0 on Essentia.js is the binding constraint.** Because you distribute (host and serve) Essentia.js as part of a single combined browser program, the safest and most defensible course is to license the whole published project **AGPL-3.0** and publish full corresponding source — OR obtain a proprietary/commercial license from MTG/UPF (Essentia is dual-licensed), OR drop / make-optional the Essentia dependency. The narrower theories ("it's just aggregation," "CDN loading isn't conveying," "client-side use isn't a network service") are plausible for some sub-questions but are genuinely unsettled and should not be relied on to publish under a permissive license.
- **The hosting stack works on GitHub Pages / Netlify / Cloudflare Pages**, because all three serve HTTPS (a secure context), which is all `showDirectoryPicker()` strictly requires. The real friction is cross-origin isolation: if Essentia's WASM ever needs threads / `SharedArrayBuffer` you must set COOP/COEP headers — which GitHub Pages cannot set, pushing you to Netlify/Cloudflare or a service-worker hack. Self-host the worklet and WASM to avoid CORS/COEP pitfalls.
- **For a fully re-themable Shadow DOM widget, use a two-layer API: CSS custom properties (design tokens) for colours/typography/spacing/effects, plus `::part()` for structural low-level overrides.** This is exactly what Shoelace, Spectrum, and Material Web converged on. `:host { all: initial }` will *not* reset custom properties, so your tokens survive the reset and remain your theming surface.

---

## Key Findings

### Part 1 — Licensing (the decisive part)

**Confirmed dependency licences:**
- **Essentia.js** — **AGPL-3.0** (confirmed in the repository `package.json` `"license": "AGPL-3.0"`, on npm, and in the ISMIR 2020 / TISMIR papers, which state Essentia.js is "released under the AGPLv3 license"). The underlying Essentia C++ is AGPLv3. **Critically, Essentia is dual-licensed.** The official licensing page (essentia.upf.edu/licensing_information.html) states: *"Essentia is available under an open licence, [Affero GPLv3], for non-commercial applications, thus it is possible to test the library before deciding to licence it under a comercial licence"* [sic], and the documentation overview confirms *"It is released under the Affero GPLv3 license and is also available under a proprietary license upon request."* Commercial licensing is obtained by contacting MTG at UPF (licensing contact: **mtg-info@upf.edu**; conditions page: upf.edu/web/mtg/technologies-licensing).
- **SoundTouchJS / @soundtouchjs/audio-worklet** — historically **LGPL-2.1** (confirmed in the `cutterbl/soundtouchjs-audio-worklet` v0.2.1 `package.json` and the SAC worklet v0.0.6). The **newer monorepo `@soundtouchjs/audio-worklet` (v2.1.1) was relicensed to MPL-2.0** ("Licensing: Moved from LGPL to MPL-2.0. Complete rewrite in TypeScript"). The underlying SoundTouch C++ library (Olli Parviainen) is LGPL-2.1.
- **libflac.js** — wrapper/glue code is **MIT** (LICENSE: "Copyright (c) 2014-2020 DFKI GmbH … based on FLAC encoder"), compiled from **libFLAC which is Xiph's BSD-style** license ("COPYING.Xiph"). Bundled libogg is likewise BSD-style.
- **libFLAC / libFLAC++** — Xiph BSD-3-Clause-style ("The libraries (libFLAC, libFLAC++) are licensed under Xiph.org's BSD-like license"). Only the `flac`/`metaflac` command-line tools are GPL — not the library you bind to.
- **Meyda** — MIT.
- **aubiojs** — WebAssembly port of aubio; **aubio itself is GPL-3.0**, so aubiojs inherits GPL (copyleft).
- **Tone.js** — MIT.
- **Rubber Band Library** — **GPL-2.0-or-later with a commercial license option** from Breakfast Quay ("Rubber Band Library is distributed under the GNU General Public License (GPL) … If you wish to distribute code using Rubber Band Library under terms other than those of the GNU General Public License, you must obtain a commercial licence"). Notably, it "may not legally distribute through any Apple App Store" under the GPL.

**How the AGPL actually applies to a static, client-side app:**
- AGPL §13 ("Remote Network Interaction") reads: *"Notwithstanding any other provision of this License, if you modify the Program, your modified version must prominently offer all users interacting with it remotely through a computer network … an opportunity to receive the Corresponding Source of your version."* It triggers only on the conjunction of (a) *you modify the Program* AND (b) *users interact with it remotely through a network*. In your architecture there is **no server-side execution** — the code runs in the user's browser and your host is a dumb static file server. The classic §13 SaaS obligation is therefore **not** the operative clause.
- The operative clause is ordinary **distribution / conveying** (AGPL §§4–6, inherited from GPLv3). When you host the app, the browser downloads Essentia.js — the FSF's long-standing position (the "JavaScript Trap," the Drupal/GPL-JS discussions, and the FSF's Gmail-JavaScript campaign) is that **serving non-trivial JavaScript to a browser is a distribution/conveyance**, which triggers copyleft on the conveyed work and any combined work. The FSF explicitly recommends non-trivial JS carry a license declaration precisely because "every time JavaScript code is downloaded by a web browser, this counts as a distribution."
- **Combined work vs. mere aggregation** is the crux and is genuinely contested for browser JS. The FSF's test (GPL FAQ, "What is the difference between 'mere aggregation' and 'combining two modules into one program'?") turns on "the mechanism of communication (exec, pipes, rpc, function calls within a shared address space) and the semantics of the communication." Modules "designed to run linked together in a shared address space … almost surely means combining them into one program," whereas "pipes, sockets and command-line arguments" indicate separate programs. Your app calls Essentia.js APIs directly, in-process, exchanging complex data structures (audio buffers, analysis results) — this looks like a **combined work**, not aggregation. That points to the AGPL covering the whole app.
- **Loading from a third-party CDN vs. self-hosting** does not reliably change the copyleft analysis. It may change *who* conveys that particular file, but your application is still a combined work that integrates the AGPL code, and the FSF treats downloaded JS as software the user runs and is entitled to source for. Do not rely on CDN-loading as a copyleft escape hatch. (Note the counter-argument aired in community discussion — that HTML is "a container, like a ZIP archive," so bundling GPL and non-GPL files into a rendered page is not automatically a derivative — but this was described as the FSF's view for *aggregated* files, not for code that calls a library's API in-process, and even its proponents call it "inconsistent." It is not a safe basis for permissive licensing.)
- **Where this is genuinely unsettled:** No court has ruled on whether browser-loaded JS modules form a "combined work" under (A)GPL, on the enforceability of dynamic-linking/linking theories generally ("still unclear after 30 years"), or on the CDN-conveyance question. The FSF's positions are advocacy, not adjudicated law. Reasonable lawyers disagree.

**"Non-commercial" framing caveat:** MTG/UPF markets the AGPL path as "for non-commercial applications." This is loose marketing language — the AGPL itself does **not** restrict commercial use (Freedom 0: "the freedom to run the program as you wish, for any purpose"). What MTG means is: if you want to avoid copyleft obligations (e.g., a closed commercial product), buy the proprietary license. An AGPL open-source project is perfectly free to be used commercially.

**LGPL (SoundTouchJS) obligations:** LGPL-2.1 permits use in a larger work under other licenses **if** users can relink/replace the LGPL component and you supply the LGPL notice + license text and the component's source. In a no-build, plain-JS app that loads the worklet as a separate file (`addModule('./js/soundtouch-worklet.js')`), you are already close to compliant — the file is separable and replaceable ("This can be achieved through dynamic linking"). If you adopt the **MPL-2.0** v2.x worklet instead, MPL is file-level copyleft and even easier to comply with (share modified MPL files only). AGPL-3.0 is compatible with LGPL-2.1 (via LGPL's GPL-upgrade path) and can incorporate MPL-2.0 code.

**What the project can legitimately be licensed as:** Given an AGPL dependency in a combined work, the whole published project must be **AGPL-3.0** (or GPLv3-compatible copyleft that the AGPL permits) unless you remove the AGPL code. You **cannot** legitimately publish it under MIT/BSD/Apache while distributing Essentia.js as an integrated part.

**Practical options:**
1. **AGPL-3.0 the whole project.** Simplest, honest, compatible with your LGPL/MPL/BSD/MIT dependencies. Add a visible "Source" link (good practice and the AGPL's own suggested means even when §13 doesn't strictly bite).
2. **Make Essentia.js optional / swap it out.** Move analysis behind an interface; ship a default build using only MIT/BSD-compatible components (Meyda MIT + a permissive or bespoke BPM/key detector, libflac.js MIT) and let advanced users opt into an AGPL Essentia.js module. Then the *core* can be permissive; only the Essentia-enabled build is AGPL. Note that aubiojs is GPL and Rubber Band is GPL — so a genuinely "permissive core" means avoiding **all** of Essentia.js / aubiojs / Rubber Band in the default build.
3. **Runtime-load rather than distribute.** Loading Essentia.js from a third-party CDN at runtime is *not* a reliable way to escape copyleft (see above). It reduces your role in distributing that one file but does not make your integrated app non-derivative. Treat this as a weak mitigation, not a solution.
4. **Dual license / commercial Essentia license.** Buy a proprietary Essentia license from MTG/UPF (mtg-info@upf.edu) if you ever want to ship a non-AGPL/closed version. For a pure open-source release this is unnecessary.

**Comparable projects:** Essentia.js's own browser demos and the MTG ecosystem are AGPL; the pre-trained Essentia models are **CC BY-NC-ND 4.0** (non-commercial, no derivatives — relevant if you bundle models). The MIR-on-web space broadly splits along the copyleft line: permissive web-audio projects use Meyda (MIT) or Tone.js (MIT), while anything built on Essentia.js or aubio inherits copyleft. This is the strongest real-world signal that an Essentia.js app is expected to be AGPL.

**DJ / personal-library tool exposure:** Publishing a tool that reads a user's local library and produces derivative mixes carries no distinct *distribution* copyright liability for you as the tool author, because (a) no copyrighted audio is bundled or transmitted, (b) all processing is local and user-initiated, and (c) this is the same posture as mainstream DJ software (Mixxx is GPLv2 open source; Serato/rekordbox analyze local libraries client-side). The copyright questions about *mixing/performing* fall on the end user, not the tool. The main authorial caveats: don't bundle copyrighted audio or the CC-BY-NC-ND Essentia models in a way that implies commercial use/derivatives, and don't add features whose primary purpose is DRM circumvention.

### Part 2 — Hosting the client-side app

**File System Access API (`showDirectoryPicker`):**
- Requires a **secure context** (HTTPS or `localhost`) and a **user gesture** (e.g., a click) — MDN and the Chrome docs confirm "The open file picker can only be shown using a user gesture when served from a secure context." GitHub Pages, Netlify, and Cloudflare Pages all serve HTTPS, so all satisfy the baseline; no special permissions-policy header is needed for top-level same-origin use.
- **Chromium-only in practice.** Chrome/Edge 86+ (and Opera) support the pickers; **Safari and Firefox do not** support `showOpenFilePicker`/`showDirectoryPicker` (they implement only the Origin Private File System). Plan a fallback (`<input type="file" webkitdirectory>`, e.g., via the `browser-fs-access` library).
- **iframes:** blocked in cross-origin iframes. The WICG spec states that in third-party contexts (an iframe whose origin differs from the top-level frame) "websites can't gain access to data they don't already have access to," and handles "can also only be post-messaged to same-origin destinations." If embedded, the widget must run same-origin/top-level or rely on delegated permissions policy from the embedder.
- Persist directory handles in IndexedDB and re-verify permission on load (permissions are not guaranteed to survive a session).

**AudioWorklet `addModule()` + WASM:**
- `addModule(url)` from a cross-origin CDN requires the CDN to send proper CORS headers and the correct `Content-Type` (`text/javascript` or `application/javascript`). **Self-hosting the worklet processor is safer** — same-origin, no CORS, and it survives cross-origin-isolation (COEP) restrictions. The SoundTouchJS docs themselves warn "your server must include a 'Content-Type' header of text/javascript … for the file to run properly."
- **WASM (Essentia.js):** baseline single-threaded WASM needs **no** COOP/COEP. **Only if** you use threads / `SharedArrayBuffer` do you need cross-origin isolation: `Cross-Origin-Opener-Policy: same-origin` + `Cross-Origin-Embedder-Policy: require-corp`, and every cross-origin subresource must opt in via CORP/CORS. Emscripten's own guidance: "Web browsers prohibit sharing data between threads unless CORS headers are set … you will receive the error SharedArrayBuffer is not defined." **GitHub Pages cannot set these headers**; Netlify and Cloudflare Pages can (via `_headers` / config). A common workaround on header-less hosts is the `coi-serviceworker` hack (an MIT service worker that re-serves the page with COOP/COEP). Under COEP `require-corp`, CDN-loaded WASM/worklets that don't send CORP will be blocked — another reason to self-host.

**IndexedDB limits & persistence:**
- Quota is dynamic, not a fixed number. Per Google's web.dev "Storage for the web": **Chrome allows the browser to use up to 80% of total disk space, and a single origin can use up to 60% of total disk space** (in Incognito, an origin is capped at ~5% of total disk). **Firefox** allows the browser up to 50% of free disk space; in best-effort mode an origin is capped at the smaller of 10% of total disk size or a 10 GiB group limit (per MDN "Storage quotas and eviction criteria"). Read the live numbers with `navigator.storage.estimate()` (`quota`/`usage`).
- Default storage is **best-effort** and can be **evicted under storage pressure on an LRU basis**, especially on Safari/iOS and Android. Attempts to exceed quota throw `QuotaExceededError`.
- For a cache that can reach hundreds of MB, **`navigator.storage.persist()` is worth requesting** — persistent buckets are exempt from automatic eviction ("won't be cleared by the user agent without either the data's origin itself or the user specifically doing so"). Wrap writes in `try/catch` for `QuotaExceededError` and free space before writing.

**CSP:**
- WASM under a strict CSP requires **`script-src 'wasm-unsafe-eval'`** — the safe, WASM-specific keyword that "Allows `WebAssembly.compile()`, `WebAssembly.instantiate()`, and `WebAssembly.compileStreaming()`" but "Does not allow `eval()`, `new Function()`, or other dynamic JS code generation." It is supported in all major browsers: **Chrome 97+, Firefox 102+, Safari 16+** (avoid the far broader `'unsafe-eval'`; note that `'unsafe-eval'` overrides/negates `'wasm-unsafe-eval'` if both are present).
- Worklets/workers need **`worker-src`** (and often `blob:` if you generate module URLs).
- A sensible starting CSP (self-hosting everything): `default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; worker-src 'self' blob:; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; object-src 'none'; base-uri 'self'`. If you must load from a CDN, add the CDN origin to `script-src`/`connect-src` — but weigh this against the COEP self-hosting argument.

### Part 3 — Re-themable Shadow DOM widget

**Custom properties piercing the boundary:**
- Inherited properties (color, font-family, etc.) and **all CSS custom properties pierce the shadow boundary** and are the primary theming channel (web.dev: "inheritable CSS properties pierce the shadow DOM boundary"; Open Web Components: "Custom CSS properties are also able to pierce the shadow DOM boundary"). Crucially, **`:host { all: initial }` does NOT reset custom properties** — Open WC states plainly "setting `all: initial;` will not reset CSS custom properties." So your `--token` API survives the reset intact. This is exactly the isolation-plus-theming combination you want.
- **Best practice:** namespace every token (e.g., `--djmix-color-accent`), and always provide a **fallback** in `var()`: `var(--djmix-color-accent, #0ff)`. The fallback *is* your default aesthetic; the token *is* the override hook. (Guidance is unanimous on prefixing to avoid collisions and on always supplying fallbacks so components don't break when a property is unset.) Document tokens as part of the component's public API, "same important as other public component methods."
- **Limits:** custom properties can only theme what the component author wired to a `var()`. You cannot restyle arbitrary internal selectors, add/remove pseudo-elements, or change layout the author didn't expose. For those you need `::part()`. Also note: because `@property` and custom-property names are *not* encapsulated by shadow DOM, they resolve document-globally in document order — another reason to namespace aggressively.

**`::part()`, `::theme()`, `:host()`, `:host-context()`, `exportparts`:**
- **`::part(name)`** is broadly supported — Chrome/Edge 73+, Firefox 72+, Safari 13.1+ — and lets the host style any element the component marks with `part="name"`, including pseudo-classes (`::part(fader):hover`). Limits (per MDN): structural pseudo-classes "such as `:empty` and `:last-child`, cannot be appended," and you cannot drill into a part's descendants (`::part(x)::part(y)` "never matches anything").
- **`::theme()`** was part of the original CSS Shadow Parts proposal but **has been postponed and is not shipped** in any browser ("its future is rather unclear") — do not depend on it.
- **`:host()` / `:host-context()`:** `:host(.selector)` styles the host conditionally and is well-supported; `:host-context()` reacts to ancestor context but has uneven support (not implemented in Firefox) — use sparingly.
- **`exportparts`** forwards parts up through nested shadow roots. It is a whitelist ("this feature only works as a 'whitelist'"); a wildcard/`-*` forwarding was proposed but is not standardized or implemented.
- **Trade-off:** custom properties = curated, stable, high-level API that ages well; `::part()` = powerful low-level escape hatch but couples the host's CSS to your internal part names (a soft API contract). Exposing "every CSS property as a custom property" leads to "token hell," which is why systems mix the two.

**adoptedStyleSheets / Constructable Stylesheets:**
- `adoptedStyleSheets` (now supported across Chrome/Edge/Safari/Firefox) lets you inject a shared, constructed `CSSStyleSheet` into a shadow root at runtime (`shadow.adoptedStyleSheets = [sheet]`). A host page **can** hand your widget an entire stylesheet this way, or you can `fetch()` a theme CSS file, build a sheet with `replaceSync()`, and adopt it. Changing an adopted sheet updates every root that adopted it. This is the cleanest runtime-theming mechanism and pairs well with tokens; some engineers consider it "pretty close to perfect" for adopting a whole design system inside shadow DOM.

**What real design systems actually do:**
- **Shoelace / Web Awesome:** page-level **design tokens** as CSS custom properties (`--sl-*`, prefixed "to avoid collisions") for global theming, **plus `::part()`** for low-level per-component overrides, plus component-scoped custom properties only where several components share a value (e.g., inputs). They deliberately avoid "token hell": "tokens only when they are used in more than one component … offering parts to override the rest." A theme "is nothing more than a stylesheet" scoped to an `sl-theme-{name}` class, and built-in themes are also exported as Lit `CSSResult` objects.
- **Adobe Spectrum Web Components:** an `<sp-theme>` element provides `--spectrum-*` tokens (via `system`/`color`/`scale` attributes) to everything in its DOM scope; per-instance `--mod-*` custom properties allow component-level overrides.
- **Material Web:** CSS custom properties (`--md-*`, historically `--mdc-theme-*`).
- **Lesson learned:** the durable pattern is **tokens-first, parts-second**. Tokens are the stable public API; parts are the pressure-release valve. `::theme()` never materialized, so don't bet on future pseudo-elements; and pure-`::part()` approaches age worse because they leak internal structure.

**Token set for this specific widget (recommended structure):**
- **Colours:** `--djmix-color-bg`, `--djmix-color-surface`, `--djmix-color-accent`, `--djmix-color-accent-2`, `--djmix-color-text`, `--djmix-color-waveform`, `--djmix-color-grid`.
- **Typography:** `--djmix-font-sans`, `--djmix-font-mono` (BPM/time readouts), `--djmix-font-size-base`, `--djmix-letter-spacing`.
- **Spacing / shape:** `--djmix-space-unit`, `--djmix-radius`, `--djmix-border-width`, `--djmix-border-color`.
- **Effects (the cyberpunk aesthetic):** `--djmix-glow` (box/text-shadow), `--djmix-scanline-opacity`, `--djmix-scanline-size`, `--djmix-animation-speed`, `--djmix-transition`.
- **Structure defaults so the current look is the fallback:** put the cyberpunk values as the fallback argument inside each `var()` call (and/or a `:host` default block placed *after* `all: initial`), so the widget renders cyberpunk out of the box but every value is overridable by a host setting the token higher in the cascade (host `:root`/host-element rules beat local `:host` defaults unless you use `!important`). Expose `part="…"` on the major structural elements (deck, fader, waveform-canvas, transport-button, track-row) for cases tokens can't cover, and optionally accept a full theme stylesheet via `adoptedStyleSheets` for wholesale reskins (e.g., matching an entirely different design system).

---

## Details

### The AGPL analysis, step by step
1. **Is anything "conveyed"?** Yes — hosting the app serves Essentia.js to browsers, which the FSF treats as distribution. This, not §13, is the trigger.
2. **Is §13 (network use) engaged?** Not in the operative sense: there's no *modified Program* running on *your* server that remote users interact with. Your server is a static host. §13's SaaS source-offer requirement doesn't bite. (Providing a "Source" link is still recommended — it's the AGPL's own suggested practice for network-facing programs.)
3. **Combined work or aggregation?** Direct in-process API calls sharing audio/analysis data → combined work under the FSF's stated criteria → copyleft reaches the whole app.
4. **Does CDN vs. self-host change it?** Not reliably. Weak mitigation at best; do not rely on it.
5. **Is any of this settled law?** No. State that plainly to contributors and users.

### Hosting matrix
- **GitHub Pages:** HTTPS ✓ (File System Access works), custom headers ✗ (no COOP/COEP → no reliable `SharedArrayBuffer` without the `coi-serviceworker` hack). Fine for single-threaded WASM.
- **Netlify / Cloudflare Pages:** HTTPS ✓, custom headers ✓ (`_headers`) → can enable cross-origin isolation and set a real CSP header. Prefer these if you need WASM threads or a strict CSP.

---

## Recommendations

**Stage 1 — Decide the licence now (before first publish).**
- Default recommendation: **publish AGPL-3.0.** Include full source, a LICENSE file, and a per-dependency NOTICE (Essentia AGPL-3.0, SoundTouchJS LGPL-2.1 or MPL-2.0 depending on version, libFLAC Xiph-BSD, libflac.js MIT, Meyda/Tone.js MIT), and a visible "Source code" link in the UI. This is the honest, low-risk path and interoperates with all your other dependencies.
- If you want a **permissive core**: architect analysis behind an interface, ship a default build using only MIT/BSD components (Meyda MIT, Tone.js MIT, libflac.js MIT, your own DSP), and offer the Essentia.js / aubio / Rubber Band integrations as a **separate AGPL/GPL build or plugin**. *Threshold to change course:* if the permissive analyzers can't meet your BPM/key-detection accuracy targets, either accept AGPL for the whole app or buy a commercial Essentia license.

**Stage 2 — Lock hosting to your isolation needs.**
- If Essentia.js runs **single-threaded** (its default): GitHub Pages is fine.
- If you need **WASM threads / SharedArrayBuffer**: move to **Netlify or Cloudflare Pages**, set `COOP: same-origin` + `COEP: require-corp`, and **self-host** the worklet and `.wasm` to satisfy COEP without per-resource CORP wrangling.
- Apply the CSP from Key Findings; include `'wasm-unsafe-eval'`; keep `object-src 'none'`.

**Stage 3 — Storage hardening.**
- Call `navigator.storage.persist()` after the first successful analysis (gate it behind a user action so the permission prompt has context). Surface `estimate()` usage in a settings panel. On `QuotaExceededError`, evict your own oldest analyses (app-level LRU) before retrying the write.

**Stage 4 — Theming API.**
- Ship the tokens-first + `::part()` API above; keep the cyberpunk look as `var()` fallbacks so it's the default but fully overridable. Document token names and exported parts as a **stable public API** (treat renames as breaking changes). Offer `adoptedStyleSheets` injection for wholesale reskins.
- *Threshold to expand the API:* if host authors repeatedly reach for `::part()` to change the same property, promote it to a named token.

## Caveats
- **Legal uncertainty is real.** The combined-work / CDN / browser-JS copyleft questions are not settled by any court; this report gives the defensible reading, not a guarantee. For a commercial or high-stakes release, have a licensing lawyer review — especially before relying on any "runtime CDN load avoids copyleft" theory, which I do **not** recommend relying on.
- **Version drift in dependencies:** SoundTouchJS's worklet changed licence (LGPL-2.1 → MPL-2.0) between major versions; pin versions and re-check the exact `package.json` `license` field for the build you ship. aubiojs (GPL) and Rubber Band (GPL/commercial) are copyleft — treat them like Essentia if used.
- **Essentia pre-trained models** are CC BY-NC-ND 4.0 (non-commercial, no derivatives). If you bundle them, that restricts commercial redistribution and modification independently of the code license.
- **Browser support:** File System Access is Chromium-only; Safari/Firefox users need the `webkitdirectory` fallback (and can't use OPFS as a drop-in for reading an arbitrary local music folder). `:host-context()` and `::theme()` are not universally available — don't hard-depend on them.
- **Storage numbers are browser-version-dependent** and the quota is a live, disk-size-relative estimate — always read `navigator.storage.estimate()` at runtime rather than assuming a fixed cap.