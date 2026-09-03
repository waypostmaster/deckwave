/* Does the RECON screen keep its own promises, read from its source?

   RECON is one self-contained HTML file (extensions/recon/index.html) —
   a read-only ops screen fed by an append-only jsonl and the deck's
   public pulse. A DOM harness for a full page is not worth its weight
   two days before launch, so this is a TEXT harness, labelled as such:
   each check pins a promise the file makes to the exact code that keeps
   it. What only a browser shows — the four DONE tests — was demonstrated
   live (BUILD-LOG Act 35). Every check states its falsifier.

       node tools/check-recon.js
*/
const fs = require('fs');
let fails = 0, checks = 0;
const ok = (name, cond, falsifier) => {
  checks++;
  if (!cond) { fails++; console.log('  FAIL  ' + name + '\n        falsifier hit: ' + falsifier); }
  else console.log('  pass  ' + name);
};
const shell = fs.readFileSync('extensions/recon/index.html', 'utf8').replace(/\r\n/g, '\n');
const appSrc = fs.readFileSync('extensions/recon/recon-app.js', 'utf8').replace(/\r\n/g, '\n');
const src = shell + '\n' + appSrc;   /* the page is now shell + hot-swappable app */
const pySrc = fs.readFileSync('tools/recon-shot.py', 'utf8').replace(/\r\n/g, '\n');
const engine = fs.readFileSync('assets/deckwave.js', 'utf8').replace(/\r\n/g, '\n');
const RIB = (appSrc.split('function drawRibbon')[1] || '').split('\nfunction ')[0];
const TEAR = (appSrc.split('function teardown')[1] || '').split('\nreturn')[0];

/* SYNTAX FIRST — everything below this point is a pattern match, and a pattern
   match cannot see a broken parse. An escaping fault that collapses a "\n"
   inside a string literal leaves every string these checks look for exactly
   where it was, so all of them pass, cheerfully, on a page that does not run.
   That is not hypothetical: it happened to check-citywalk (25 checks green on
   a page whose entire inline script was dead) and was found only because
   somebody opened the page. recon-app.js is 75 KB fetched at runtime and
   hot-swapped, so nothing here would have noticed either.
   vm.Script PARSES without executing — no globals touched, no side effects,
   built-in module, no dependency, consistent with the no-toolchain rule. */
const vm = require('vm');
const compileErr = (code, label) => {
  try { new vm.Script(code, { filename: label }); return ''; }
  catch (e) { return (e && e.message) || String(e); }
};
const inlineBlocks = html =>
  (html.match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/g) || [])
    .map(b => b.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, ''));

console.log('\n── it parses at all ────────────────────────────────────────');
{
  const e = compileErr(appSrc, 'recon-app.js');
  ok('recon-app.js PARSES — 75 KB of runtime-fetched, hot-swapped code that every text check below assumes runs',
     !e, 'SyntaxError: ' + e + ' — the console is dead and the other checks cannot tell');
  const blocks = inlineBlocks(shell);
  const e2 = blocks.length ? blocks.map((b, i) => compileErr(b, 'recon/index.html#' + i)).find(Boolean) || '' : 'no inline block found';
  ok('every inline <script> in the shell PARSES (' + blocks.length + ' block(s))',
     blocks.length > 0 && !e2, 'SyntaxError: ' + e2 + ' — the shell cannot boot the app');
}

console.log('\n── read-only, enforced ─────────────────────────────────────');
ok('exactly three fetches: its feed, its code, and speech/*.wav renders - all same origin, the wav path sanitized',
   (src.match(/fetch\(/g) || []).length === 3 && /fetch\('\.\.\/\.\.\/recon\.jsonl\?b='/.test(src)
   && /fetch\('\.\/recon-app\.js\?b='/.test(src) && /speech\\\/\[A-Za-z0-9._-\]\+\\\.wav/.test(src),
   (src.match(/fetch\(/g) || []).length + ' fetch calls');
ok('no navigation exists: no window.open, no location assignment, no <a href>',
   !/window\.open/.test(src) && !/location\.(href|assign|replace)/.test(src) && !/<a\s/.test(src),
   'a record could be followed instead of copied');
ok('a record click COPIES the url (clipboard), never follows it',
   /navigator\.clipboard\.writeText\(r\.url\)/.test(src), 'the copy path is gone');
ok('query strings are stripped on ingest — from the record URL AND from every stage link',
   /const stripQ = u => String\(u \|\| ''\)\.split\('\?'\)\[0\]/.test(src)
   && /url: stripQ\(o\.url\)/.test(src)
   && /map\(l => stripQ\(String\(l\)\)/.test(src),
   'a fed URL with a query string would be stored whole. NOT a bug to fix: the 2026-08-28 review raised losing a real `?id=` from a copied link as a policy question and the keeper CLOSED it 2026-08-29 - the strip stays. This feed is writable by anything on the LAN and the stage renders what it is handed, so the query string is the part of a URL most likely to carry a session token or a tracking id; a copied link that lost its parameters is the cheaper failure');
ok('every rendered field goes through esc()',
   /esc\(r\.source\)/.test(src) && /esc\(r\.title\)/.test(src) && /esc\(r\.url\)/.test(src)
   && /esc\(String\(r\.note\)/.test(src) && /esc\(r\.event\)/.test(src),
   'the feed file is writable by anything; an unescaped field is an injection point');

console.log('\n── the operator is not watching ────────────────────────────');
ok('staleness flips to "cannot tell" at five minutes',
   /s >= 300/.test(src) && /agent idle or stopped: this screen cannot tell/.test(src),
   'silence would look calm — the exact failure the spec forbids');
ok('hidden-tab records get the away divider', /while you were away/.test(src) && /visibilitychange/.test(src)
   && /document\.hidden/.test(src), 'returning to the tab would hide what happened during it');
ok('the live feed rings at 200 with pinned rows exempt',
   /liveCount > 200/.test(src) && /\.rec:not\(\.pinned\)/.test(src), 'the feed grows without bound or eats pins');
ok('pins persist in localStorage and survive a truncated feed',
   /dwrecon-pins/.test(src) && /JSON\.parse\(localStorage\.getItem\(PINKEY\)/.test(src),
   'a pinned record depends on the jsonl still holding its line');

console.log('\n── the deck relationship ───────────────────────────────────');
ok('landing waits for the ASSUMED downbeat via the public pulse, and says assumed',
   /beatInBar/.test(src) && /holding for the assumed downbeat/.test(src) && /D\.pulse\(\)/.test(src),
   'either a private engine path or a UI claiming a downbeat the engine never detects');
ok('a frozen deck cannot hold records forever (8 s safety)', /now - q\.at > 8000/.test(src),
   'a paused set would silently swallow the feed — the calm-looking lie again');
ok('not playing → records land at once', /if \(!playing\) \{ while \(pending\.length\) land\(pending\.shift\(\)\.r\);/.test(src),
   'a silent deck would queue records for a downbeat that never comes');
ok('the optional event field injects through DWEVENTS at landing', /D\.inject\(r\.event\)/.test(src),
   'the one-file-two-effects bus is gone');
ok('the how-to-feed block carries the exact append line', /echo '\{"ts":/.test(src) && /recon\.jsonl/.test(src)
   && /Add-Content recon\.jsonl/.test(src),
   'the last attempt never wrote down how records got in and the next session could not find it');

console.log('\n── the reply tray: a message tray, not a command line ──────');
ok('the composer is optional and hidden by default', /#composer\{display:none/.test(src) && /replybtn/.test(src),
   'the box would be on for every viewer');
ok('music words act locally at once; nothing else auto-executes',
   /const kind = D && D\.parse \? D\.parse\(t\) : null;/.test(src) && /if \(kind && D\.inject\)/.test(src),
   'either intents wait for the agent, or arbitrary text executes — both wrong');
ok('non-intent notes are STORED with provenance and marked waiting',
   /dwrecon-inbox/.test(src) && /waiting for the agent/.test(src) && /inbox\.push\(m\); saveInbox\(\);/.test(src),
   'a typed note would vanish or act — the tray must hold it');
ok('the agent reads via RECON.drain(), which empties and acknowledges',
   /window\.RECON = \{/.test(src) && /drain\(\) \{ const out = inbox\.slice\(\); inbox = \[\]; saveInbox\(\);/.test(src)
   && /picked up/.test(src), 'no read path, or reads that do not acknowledge');
ok('the inbox caps at 50', /inbox\.slice\(-50\)/.test(src), 'unbounded queue');
ok('the danger is faced in writing where the code lives',
   /MESSAGE TRAY, not a command line/.test(src) && /cannot authenticate its/.test(src),
   'the trust boundary is undocumented at the point of implementation');
ok('the tray adds NO network surface (feed + code + speech renders only)',
   (src.match(/fetch\(/g) || []).length === 3, (src.match(/fetch\(/g) || []).length + ' fetches');

console.log('\n── the voice: records read aloud over the music ────────────');
ok('the speak field is parsed (true = title+note, string = exact words)',
   /speak: o\.speak === true \? true : \(o\.speak \? String\(o\.speak\)\.slice\(0, 2000\) : null\)/.test(src),
   'a fed speak field would be dropped on ingest');
ok('speech is gated on the voice toggle (off by default) AND on fresh arrival (quiet boot)',
   /let voiceOn = false;/.test(src) && /if \(r\.speak && voiceOn && !r\.quiet\)/.test(src),
   'the console would talk uninvited, or replay the seance on every swap');
ok('a repeat button re-speaks the last voice-over through the deck',
   /D\.speakAgain\(\)/.test(src) && /id="again"/.test(src),
   'the keeper asked for exactly this button');
ok('a sayfile row is PRESSABLE: a real tap plays the take, even from the quiet backlog',
   /class="say"/.test(appSrc) && /sayBtn\.onclick = e => \{ e\.stopPropagation\(\); armAgain\(r\.sayfile\); playSayfile\(r\.sayfile, d\); \}/.test(appSrc),
   'a backlog take renders as a row nothing can play - the exact report that opened ledger 77');
ok('arming has ONE assignment site and two callers (landing and the tap)',
   (appSrc.match(/window\.__lastSayfile = path/g) || []).length === 1
   && (appSrc.match(/armAgain\(r\.sayfile\)/g) || []).length === 2,
   (appSrc.match(/armAgain\(r\.sayfile\)/g) || []).length + ' arming callers (want land + tap), '
   + (appSrc.match(/window\.__lastSayfile = path/g) || []).length + ' assignment sites (want 1) - two sites drift, and one of them forgets to light the button');
ok('tap failure markers land on the TAPPED row, not the newest (4 marked exits: no ctx, suspended ctx, not found, decode refused)',
   /function sayMark\(text, el\)/.test(appSrc) && /playSayfile\(path, rowEl\)/.test(appSrc)
   && (appSrc.match(/, rowEl\); return;/g) || []).length === 4,
   'a failed press on an old row would mark the wrong record - a visible lie');
ok('the warp knob exists for engines with no pitch parameter, clamped, and is honest about what it moves',
   /dw-voice-warp/.test(appSrc) && /Math\.max\(0\.7, Math\.min\(1\.3/.test(appSrc)
   && /pitch AND speed/.test(appSrc) && /1\.007 \* warp/.test(appSrc),
   'either piper takes lose their register lever, or warp claims to be a pitch shifter (it is playbackRate), or the double detune stops tracking it');
ok('the voice goes through the deck (DWEVENTS.speak — its duck, not the OS\'s) and the toggle arms it',
   /const words = r\.speak === true \? \(r\.title \+ '\. ' \+ r\.note\) : r\.speak;/.test(src)
   && /D\.speak\(words\)/.test(src) && /D\.armSpeech\(\)/.test(src),
   'either a second speech path exists or iOS never gets its priming gesture');

console.log('\n\u2500\u2500 the vocal gate: the keeper\'s ear, not a detector \u2500\u2500');
ok('the blindness is faced in writing where the code lives (no detector exists)',
   /VOCAL-BLIND/.test(appSrc) && /keeper's EAR/.test(appSrc),
   'the list would read as a measurement - the exact dishonesty CLAUDE.md forbids');
ok('a listed now-playing track is blended away via the SAME intent bus',
   /D\.inject\('change'\)/.test(appSrc) && /vocalNow\(\)/.test(appSrc),
   'either a second path to the play order, or the gate never fires');
ok('BOTH speech paths hold behind the gate (sayfile and speak)',
   (appSrc.match(/clearVocals\(/g) || []).length === 3,
   (appSrc.match(/clearVocals\(/g) || []).length + ' clearVocals sites (want def + 2 calls)');
ok('the hold is capped at 15 s - a stuck blend cannot swallow the narrator',
   /> 15000/.test(appSrc) && /clearInterval\(w\)/.test(appSrc) && /iv\(\(\) =>/.test(appSrc),
   'the voice would wait forever on a deck that never moves, or the timer would survive a swap');
ok('the list persists and is feed-patchable ({"vocals":{add,remove}}), one skip max - no chained skips',
   /dw-recon-vocals/.test(appSrc) && /r\.vocals\.add/.test(appSrc) && /r\.vocals\.remove/.test(appSrc)
   && /still !== hit/.test(appSrc),
   'the list would die with the tab, or two listed neighbours would loop the set');

console.log('\n\u2500\u2500 hot-swap: upgrades without killing the music \u2500\u2500\u2500\u2500');
ok('the app is boot/teardown symmetrical (registered timers, cleared on teardown)',
   /window\.RECONAPP = /.test(appSrc) && /const timers = \[\], subs = \[\];/.test(appSrc)
   && /while \(timers\.length\) clearInterval\(timers\.pop\(\)\);/.test(appSrc),
   'an unregistered interval would survive a swap and double up');
/* review 2026-09-01 M8: the composer lives in the SHELL, so a listener on
   it outlives a swap unless teardown removes it. Every addEventListener on
   a shell element must have a matching removeEventListener in subs. */
ok('every shell-element listener the app adds is removed on teardown (visibilitychange AND the composer keydown)',
   /subs\.push\(\(\) => document\.removeEventListener\('visibilitychange', onVis\)\)/.test(appSrc)
   && /subs\.push\(\(\) => \$\('say'\)\.removeEventListener\('keydown', onSayKey\)\)/.test(appSrc)
   && !/\$\('say'\)\.addEventListener\('keydown', e =>/.test(appSrc),
   'after one hot swap, Enter in the composer fires the OLD instance first and its stale inbox overwrites the live one');
ok('intervals go through iv(), with ONE stated exception: the boost restore poller — utterance-scoped, self-clearing, must outlive a mid-utterance swap to restore the volume',
   (appSrc.match(/setInterval\(/g) || []).length === 2 && /clearInterval\(back\)/.test(appSrc)
   && /ticks > 300/.test(appSrc),
   'either a new bare interval appeared (a swap-survivor leak) or the poller lost its self-clear/hard-stop');
ok('the shell evaluates ONLY its own ./recon-app.js (one indirect eval, one code source)',
   (shell.match(/\(0, eval\)\(src\)/g) || []).length === 1 && (shell.match(/eval/g) || []).length === 2
   && /fetch\('\.\/recon-app\.js\?b='/.test(shell),
   'a second eval site or a foreign code source is the RCE door this design refuses');
ok('the reload directive is ts-gated and never renders',
   /o\.reload === true/.test(appSrc) && /dw-recon-appts/.test(appSrc)
   && /const t = Date\.parse\(ts\), p = Date\.parse\(prev\)/.test(appSrc) && /t <= p/.test(appSrc),
   'an old reload line would re-fire on every boot, or reload records would show as rows');
/* review 2026-09-01 M9, three halves: (a) numeric ts with a future bound —
   a lexical compare let "9999-…" wedge hot-swap for good; (b) the ts is
   consumed only when the swap HAPPENED — on failure the previous value is
   restored and the line forgotten so it can land again; (c) the failure is
   SAID on screen, not in a console the phone cannot see. */
ok('a reload ts is numeric, bounded to 10 min of future skew, and refused when unparseable',
   /isFinite\(t\) && t <= Date\.now\(\) \+ 600000/.test(appSrc) && !/String\(o\.ts \|\| ''\) > prev/.test(appSrc),
   'a "9999-…" line, or a lexical compare, poisons the gate until localStorage is cleared by hand');
ok('a failed swap restores the previous ts, forgets the line, and puts the failure on the staleness line',
   /localStorage\.setItem\('dw-recon-appts', prev\)/.test(appSrc) && /seen\.delete\(rk\)/.test(appSrc)
   && /swapNote = 'upgrade failed/.test(appSrc) && /if \(swapNote\) \{ el\.className = 'bad'; el\.textContent = swapNote; return; \}/.test(appSrc),
   'a 404 eats the line for good and the operator sees nothing change');
ok('the shell reports whether the swap happened (false on !r.ok and on a throw)',
   /if \(!r\.ok\) \{[^}]*return false; \}/.test(shell) && /console\.log\('\[recon\] app booted'\);\s*return true;/.test(shell)
   && /upgrade failed', e\); return false; \}/.test(shell),
   'the app cannot tell a swap that happened from one that was refused');
ok('teardown never touches the deck iframe (the music is the point)',
   !/dw'\)/.test((appSrc.split('function teardown')[1] || '').split('return')[0]),
   'a teardown that reaches the iframe kills the set on every upgrade');
ok('a level field sets the deck volume, clamped to the amplifier (0..1)',
   /Math\.max\(0, Math\.min\(1, \+o\.level\)\)/.test(appSrc) && /contentWindow\.DW\.volume = r\.level/.test(appSrc),
   'eleven would be taken literally');
ok('the eleven dial exists, and position 11 is the true maximum',
   /vol11/.test(appSrc) && /volr\.value \/ 11/.test(appSrc) && /max="11"/.test(appSrc),
   'the keeper asked where the 11 button was');
ok('boot re-renders are display-only: every side effect gates on !r.quiet',
   /r\.quiet = !canAct;/.test(appSrc) && (appSrc.match(/&& !r\.quiet/g) || []).length >= 5,
   'a hot-swap would replay the whole seance - every voice ever made, at once');
ok('voice survives a swap (persisted; arming lives in the untouched iframe)',
   /dw-recon-voice/.test(appSrc) && /localStorage\.getItem\('dw-recon-voice'\) === 'on'/.test(appSrc),
   'every upgrade would silence the narrator until a new tap');

console.log('\n── the instrument column: the deck, not a clock ─────');
/* The hosted console artifact (claude.ai 39b76df9) drew this same furniture
   over a PUBLISHED SCORE FILE with a clock - its own boot feed says "no audio
   is loaded or analysed here" and "if the real deck is playing a different
   set, this display is wrong and cannot tell". These checks exist to keep the
   live version from inheriting any of that: every figure below has to come
   from the deck, and the things the deck cannot tell us have to stay unsaid. */
ok('the harmonic move uses the ENGINE\'s own camScore - every camScore CALL goes through W.DW (a local function of any name would break the count), no local scorer defined',
   /W\.DW\.camScore\(/.test(appSrc) && !/function compat\(/.test(appSrc) && !/function camScore/.test(appSrc)
   && (appSrc.match(/camScore\(/g) || []).length === (appSrc.match(/\.camScore\(/g) || []).length,
   'a console-local key table would drift from the engine that actually picks the tracks - and the first cut of this check only tested that a function named "compat" was absent, which a scorer of any other name walks past');
ok('a STRAIGHT track never gets a stretch percentage',
   /straight · own speed/.test(appSrc) && /p\.straight \?/.test(appSrc),
   'printing 0.0% against an unstretched track reads as the best transition on screen (CLAUDE.md, verbatim)');
ok('the FIRST deck gets no stretch percentage either - and the claim needs idx 0 AND rate 1, because placeNext decrements idx when a played row is queued away',
   /first deck · nothing to match/.test(appSrc) && /st\.idx === 0 && p\.rate === 1/.test(appSrc),
   '+0.00% on step 1 reads as the tightest beatmatch on screen while no match is being attempted - or, on idx alone, a stretched chained deck at idx 0 is labelled "nothing to match" and its real stretch is HIDDEN (ledger 91)');
ok('the bar counter says ASSUMED - the engine detects no downbeat',
   /assumed 4\/4/.test(appSrc), 'a UI claiming a downbeat the engine never detects');
ok('energy is named a CONSTRUCTED index at the point it is printed',
   /constructed index/.test(appSrc), 'the index would read as a measurement');
ok('the energy axis carries no numbers IN CODE: the ribbon prints exactly three texts - the no-set message and the two bpm figures - so an energy label cannot exist',
   /NO NUMBER ON THE ENERGY AXIS/.test(appSrc)
   && (RIB.match(/fillText\(/g) || []).length === 3
   && /fillText\('no set visible/.test(RIB) && (RIB.match(/ bpm', /g) || []).length === 2,
   'an axis of numbers this project chose borrows the authority of measured ones - the VU/dB rule. The first cut of this check matched the COMMENT, which passes however many labels the code draws');
ok('the ribbon is READ-ONLY: no click path into the play order',
   !/insRibbon'\)\.onclick/.test(appSrc) && !/insRibbon'\)\.addEventListener\('click/.test(appSrc)
   && /It reports; it does not steer/.test(appSrc),
   'a second way into the play order beside DWEVENTS - the ledger-40 class of bug, by design this time');
ok('a set it cannot read is SAID, not drawn as an empty axis',
   /no set visible/.test(appSrc) && /if \(!set\)/.test(appSrc),
   'an empty axis and a flat line look identical to a working one - the exact self-deception CLAUDE.md names');
ok('the crossfade meter reads the fade the ENGINE is actually running (prevDeck.prog)',
   /prevDeck/.test(appSrc) && /pd\.prog/.test(appSrc),
   'the artifact reconstructed fades from atSec deltas and said so; a live screen must not guess');
ok('the incoming track is named straight when it is straight',
   /nd\.straight/.test(appSrc), 'a track the gate could not reach would look beatmatched');
ok('the worklet state and gap count are mirrored from the deck (ledgers 65/69)',
   /plain worklet/.test(appSrc) && /gapsTotal/.test(appSrc),
   'the popping discriminator would exist only on the deck screen, which RECON folds away');
ok('the set is read LIVE-FIRST: the dashboard seam (a getter) before the render bundle (a snapshot that freezes when the folded iframe\'s rAF stops), never re-derived',
   appSrc.indexOf('W.DWDASH && W.DWDASH._dev') > -1 && appSrc.indexOf('W.DWLOOP && W.DWLOOP.last') > -1
   && appSrc.indexOf('W.DWDASH && W.DWDASH._dev') < appSrc.indexOf('W.DWLOOP && W.DWLOOP.last'),
   'snapshot beats live getter: fold the deck, commit a route, and the ribbon draws the pre-route plan as if current (ledger 87) - or a console-local copy, ledger 33/40 again');
ok('the plan stamps it reads are labelled as the CURRENT plan',
   /restamp/.test(appSrc),
   '_stretch is mutated on the shared corpus objects by every build (CLAUDE.md); a screen that forgets that prints last build\'s numbers');
ok('the instrument runs on iv() like everything else - no new bare interval, no rAF to orphan',
   (appSrc.match(/setInterval\(/g) || []).length === 2 && !/requestAnimationFrame/.test(appSrc)
   && /iv\(instrumentTick/.test(appSrc),
   'an unregistered loop would survive a hot swap and double up');
ok('teardown clears the instrument column, and still never touches the deck iframe',
   /insNow/.test((appSrc.split('function teardown')[1] || '').split('\nreturn')[0])
   && !/dw'\)/.test((appSrc.split('function teardown')[1] || '').split('\nreturn')[0]),
   'a stale column would survive a swap showing the previous set, or a teardown would kill the music');
ok('the instrument adds NO network surface (still feed + code + speech renders)',
   (src.match(/fetch\(/g) || []).length === 3, (src.match(/fetch\(/g) || []).length + ' fetches');

console.log('\n── the stage: what the agent was looking at ─────────');
/* The ORIGINAL idea (docs/research/adjacent/surfacing-hud-for-agent-activity.md,
   and the keeper's own prompt in Act 35 - "a read-only what-the-agent-is-
   looking-at overlay, so the deck can play music to browse Reddit by") was a
   viewport, not a log. RECON shipped the log. The stage is the viewport half,
   built 2026-08-28 - and the whole danger of it is the research doc's own
   warning about over-trust: a still frame that looks like a live browser is
   worse than no frame at all. These checks are mostly about that. */
ok('a shot path is sanitized to recon-shots/*.(png|jpg|jpeg|webp) - the sayfile discipline',
   /\^recon-shots\\\/\[A-Za-z0-9\._-\]\+\\\.\(png\|jpe\?g\|webp\)\$/.test(appSrc)
   && /SHOTPATH\.test\(o\.shot\)/.test(appSrc),
   'a fed path could reach outside the served root, or name a file type the page will not render');
ok('the stage stays HIDDEN until a shot actually arrives',
   /stageEl\.hidden = /.test(appSrc) && /hidden>/.test(shell),
   'an empty viewport is the empty-axis lie again - it would look like a screen that is working');
ok('the stage NEVER reads as live: every frame is labelled a STILL, with its age',
   /still · /.test(appSrc) && /agoOf/.test(appSrc),
   'a stale frame that looks live is the over-trust failure the HUD research names by name');
ok('a stale frame says the agent may have moved on',
   /the agent may be somewhere else/.test(appSrc) && /STALE_MS/.test(appSrc),
   'silence about staleness is the same calm-looking lie as the feed staleness line');
ok('outbound links are COPIED, never followed - no anchors anywhere on the page',
   /stgLinkClick/.test(appSrc) && /navigator\.clipboard\.writeText/.test(appSrc)
   && !/<a\s/.test(src),
   'a link fed by anything that can write the jsonl would become a navigation the operator did not choose');
ok('no fed field reaches the stage as HTML - textContent only, and the fed-field elements are never ALIASED into a variable the innerHTML regex cannot see',
   /\$\('stgUrl'\)\.textContent = /.test(appSrc) && /\$\('stgStat'\)\.textContent = /.test(appSrc)
   && /\$\('stgNote'\)\.textContent = /.test(appSrc) && /e2\.textContent = String\(l\)/.test(appSrc)
   && !/stg[A-Za-z]*'\)\.innerHTML = [^']/.test(appSrc)
   && !/= \$\('stg(Url|Title|Stat|Note)'\)/.test(appSrc),
   'the feed file is writable by anything, and the stage renders four more fields than a row does - the first cut of this check missed `const u = $(\'stgUrl\'); u.innerHTML = …` entirely');
ok('a missing status is SAID, not left blank',
   /no status fed/.test(appSrc), 'a blank status line reads as "nothing happening" rather than "nobody told me"');
ok('status and links are capped on ingest',
   /o\.status\)\.slice\(0, 80\)/.test(appSrc) && /\.slice\(0, 12\)/.test(appSrc)
   && /\.slice\(0, 120\)/.test(appSrc),
   'an unbounded field is an unbounded screen');
ok('there is NO page-body channel: the stage text is the record\'s own note',
   /stgNote/.test(appSrc) && !/\bo\.body\b/.test(appSrc) && !/\bo\.text\b/.test(appSrc),
   'a field designed to carry page text turns the feed into a scraper log and the screen into a copyright hazard');
ok('a shot-bearing row can re-stage its own frame, like a take can be replayed',
   /class="shot"/.test(appSrc) && /stageShow\(r/.test(appSrc),
   'the newest shot would be the only one reachable, and scrollback would be dead');
ok('the stage folds away and the choice persists',
   /dw-recon-stage/.test(appSrc), 'the operator could not get their feed back to full height');
ok('the stage folds to a BAR, never to nothing - the control cannot fold itself away',
   /#stage\.folded>#stgFold\{display:block/.test(shell) && /classList\.toggle\('folded', stageFolded\)/.test(appSrc)
   && !/stageEl\.hidden = stageFolded/.test(appSrc),
   'the only control that unfolds the stage disappears with it AND the choice persists - a door that opens once. This is not hypothetical: it shipped that way and the keeper hit it within the hour (ledger 83)');
ok('a folded stage still reports its frame\'s age on the bar',
   /'▾ stage · ' \+/.test(appSrc) && /' · ' \+ line/.test(appSrc),
   'folding would be a way to make the screen quiet about staleness - the calm-looking lie by another route');
ok('the stage runs on iv() and is cleared on teardown',
   /iv\(stageTick/.test(appSrc) && (appSrc.match(/setInterval\(/g) || []).length === 2
   && /st\.hidden = true/.test((appSrc.split('function teardown')[1] || '').split('\nreturn')[0]),
   'an unregistered timer, or a stale frame surviving a hot swap as if current');
ok('the stage adds NO fetch: the frame is an <img> at a sanitized same-origin path',
   (src.match(/fetch\(/g) || []).length === 3 && /stgShot/.test(appSrc),
   (src.match(/fetch\(/g) || []).length + ' fetches');

console.log('\n── again, and stepping back through the frames ─────');
ok('the again button is ARMED FROM THE BACKLOG, without playing anything',
   /if \(r\.sayfile\) armAgain\(r\.sayfile\);/.test(appSrc)
   && /if \(r\.sayfile && voiceOn && !r\.quiet\)/.test(appSrc),
   'after a reload nothing arms it and the button is dead on arrival - ledger 77 one button along; or arming replays the seance, which is the bug the quiet-boot gate exists to stop');
ok('the button SHOWS whether it has anything to repeat',
   /function armAgain/.test(appSrc) && /classList\.toggle\('armed'/.test(appSrc)
   && /nothing to repeat yet/.test(appSrc),
   'a control that is always lit and usually dead teaches the operator to distrust the screen');
ok('again NEVER fails into the console - every path is marked on screen',
   !/console\.log\('\[recon\]', D\.speakAgain/.test(appSrc)
   && /deck not ready/.test(appSrc) && /D\.speakAgain\(\)/.test(appSrc)
   && !/if \(!D \|\| !D\.speakAgain\) return;/.test(appSrc),
   'the exact failure ledger 77 named: "failed silently into a console the phone cannot see"');
ok('whether the voice STARTED is measured, not read off the returned message',
   /function verifySpoke/.test(appSrc) && /speechSynthesis\.speaking && !w\.speechSynthesis\.pending/.test(appSrc)
   && (appSrc.match(/verifySpoke\(/g) || []).length === 3,
   'speak() returns a sentence describing what it ATTEMPTED - trusting it is the same class as counting lit pixels');
ok('▣ view UNFOLDS the stage - a real tap is an invitation (ledger 77\'s rule)',
   /stageShow\(r, \{ open: true \}\)/.test(appSrc) && /opts && opts\.open && stageFolded/.test(appSrc),
   'pressing view while folded re-stages a frame and immediately hides it again - the press does nothing visible, which is how this was reported');
ok('the stepper walks every frame that has been staged, and says where you are',
   /shots\.push\(r\)/.test(appSrc) && /function stageAt/.test(appSrc)
   && /\(shotIdx \+ 1\) \+ '\/' \+ shots\.length/.test(appSrc),
   'the only way back to an older frame would be scrolling the feed for rows that happen to carry one');
ok('the ends of the walk are shown as ends',
   /classList\.toggle\('off', shotIdx <= 0\)/.test(appSrc)
   && /classList\.toggle\('off', shotIdx < 0 \|\| shotIdx >= shots\.length - 1\)/.test(appSrc),
   'a control that looks live at the end of the list is a dead click with no explanation');
ok('a stepped-to frame re-dates itself - stepping cannot make an old frame read as current',
   /stageAt\(i\)/.test(appSrc) && /stageShow\(shots\[i\], \{ open: true \}\)/.test(appSrc),
   'stepping back would show an old picture under a fresh age line');

console.log('\n── the review pass, 2026-08-28 ─────────────────────');
/* docs/research/code-review-console-2026-08-28.md: sixteen adversarially
   verified findings against Acts 38-39, fixed the same day. Each check
   below pins one fix and failed against the pre-fix source first. */
ok('a shot filename tags the image BYTES, not the source path - two frames from one temp path cannot collide',
   /hashlib\.sha256\(fh\.read\(\)\)/.test(pySrc) && !/sha256\(os\.path\.abspath/.test(pySrc),
   'a driver reusing shot.png twice in one second overwrites the first frame while both feed lines reference it - the stage shows the wrong picture under the older record (ledger 86)');
ok('the dedupe/pin hash covers EVERY ingested field, shot/status/links/sayfile included',
   /const hash = r => \{ let h = 5381;/.test(appSrc)
   && /r\.event, r\.sayfile, r\.shot, r\.status/.test(appSrc)
   && /r\.voiceCfg \? JSON\.stringify/.test(appSrc) && /r\.links \|\| \[\]/.test(appSrc),
   'two same-second records differing only in the new fields collide, and the second - a genuinely new frame - is silently skipped (ledger 86\'s other half)');
ok('a deck track MISSING from the displayed set gets NO playhead, and the hint says so',
   /const missing = !!nowMeta && di < 0;/.test(appSrc) && /missing \? -1 : li/.test(appSrc)
   && /not in this set — no playhead/.test(appSrc),
   'the fallback animates the player\'s index over the displayed array - most wrong exactly when the LIST ≠ DECK flag (di >= 0) provably cannot fire (ledger 88)');
ok('a suspended audio context is refused OUT LOUD - a paused deck cannot swallow a take',
   /if \(ctx\.state !== 'running'\)/.test(appSrc) && /deck audio is ' \+ ctx\.state/.test(appSrc),
   'decode resolves and start() succeeds in silence on a suspended context (DW.pause, an Android call), and the queued source bursts out at resume (ledger 89)');
ok('sayMark can NEVER fail silently: an empty feed gets a row made for the marker',
   /rowEl = row\(\{ ts: new Date\(\)\.toISOString\(\), source: 'console'/.test(appSrc)
   && !/if \(!rowEl\) return;/.test(appSrc),
   'fresh console, empty feed, deck not started: "deck not ready" had nowhere to land and vanished - ledger 77 verbatim, re-opened (ledger 90)');
ok('markers have their OWN class (.saymark), replace rather than refuse, and drain() cannot relabel them',
   /m\.className = 'saymark'/.test(appSrc) && /top\.querySelector\('\.saymark'\)/.test(appSrc)
   && !/top\.querySelector\('\.wait'\)\) return/.test(appSrc) && /\.rec \.saymark/.test(shell),
   'operator rows carry a permanent .wait span, so the old guard swallowed every failure on them; and RECON.drain() rewrites .wait spans to "picked up" - a failure relabelled as success (ledger 90)');
ok('the stage age is max(producer-ts age, local-arrival age) - clock skew can only age a frame, never freshen it',
   /r\.arrivedAt = lastArrival/.test(appSrc)
   && /Math\.max\(0, \(Date\.now\(\) - t\) \/ 1000,/.test(appSrc)
   && /r\.arrivedAt \? \(Date\.now\(\) - r\.arrivedAt\)/.test(appSrc),
   'a producer clock ahead of the viewing device clamps every frame to "0 s old" and delays the 90 s flip by the whole skew - over-trust by clock skew (ledger 92)');
ok('a frame whose file is GONE is said on the age line, not staged as a black rectangle',
   /im\.onerror = \(\) => \{ stageMissing = true; stageTick\(\); \}/.test(appSrc)
   && /NO IMAGE: the frame file is gone/.test(appSrc)
   && /a\.stale \|\| stageMissing/.test(appSrc),
   'recon-shots/ is per-session and recon.jsonl is not: next session the backlog stages a 404 img under a full convincing HUD (ledger 93)');
ok('the grid updates IN PLACE: structure rebuilds only when rows change, values via textContent - the honesty tooltips can actually open',
   /function setGrid/.test(appSrc) && /el\.__sig !== sig \|\| el\.children\.length !== rows\.length/.test(appSrc)
   && /b\.textContent !== String\(q\[1\]\)/.test(appSrc) && !/gridEl\.innerHTML = rows\.join/.test(appSrc),
   'innerHTML reassigned every 60 ms replaces the hovered node 16 times a second - the hover timer never runs out and none of the disclaimer text is ever readable (ledger 94)');
ok('next/hint writes are change-gated for the same reason',
   /nextEl\.__h !== nh/.test(appSrc) && /hint\.__h !== hh/.test(appSrc),
   'the same churn one element over');
ok('teardown clears the CANVASES, the fade bar and the ribbon hint - a failed swap cannot leave a live-looking instrument',
   /insWheel/.test(TEAR) && /clearRect/.test(TEAR) && /insRibHint/.test(TEAR)
   && /width = '0%'/.test(TEAR),
   'teardown runs before the new code evals; if the eval throws, the painted wheel and ribbon stand over a dead app (ledger 95)');
ok('a re-staged frame is matched by CONTENT when identity misses (pins round-trip localStorage) - the stepper cannot desync from the stage',
   /at = shots\.findIndex\(q => q\.ts === r\.ts && hash\(q\) === hash\(r\)\)/.test(appSrc)
   && /shots\.push\(r\); at = shots\.length - 1/.test(appSrc),
   'a pinned shot record is a different object than the walk\'s copy; indexOf misses, the stage shows one frame while ‹ steps from another (ledger 96)');
ok('copy claims are TRUE claims: the clipboard promise decides, and failure is said on both copy paths',
   /writeText\(l\)\.then\(\(\) => show\('copied'\), \(\) => show\('copy FAILED'\)\)/.test(appSrc)
   && /mark\('copy failed'\)/.test(appSrc) && /no clipboard here/.test(appSrc),
   '"copied" printed unconditionally shows success over a refusal (ledger 97)');
ok('moveName is an ADMITTED copy of camScore\'s tiers, and every threshold it names exists in the engine source',
   /This IS a second copy/.test(appSrc)
   && ['0.92', '0.85', '0.45', '0.25', '0.08'].every(v =>
        ((engine.split('function camScore')[1] || '').slice(0, 600)).includes(v))
   && [/sc >= 0\.92/, /sc >= 0\.85/, /sc >= 0\.45/, /sc >= 0\.25/].every(re => re.test(appSrc)),
   'the comment claimed no second table existed, which was false the moment it was written - and unpinned, the names drift when the engine\'s constants move (ledger 99)');

console.log('\n── the voice card + the mixer (keeper, 2026-08-28) ──');
/* "a card for the persona speaking that shows a voicewave", and separate
   tuning for music and voice. The two promises that matter: the wave is
   REAL OR ABSENT (an analyser in the take's own chain; the OS voice has no
   tap and the card says so), and the faders move NO canon (they initialize
   from the stores and speak only through the deck's public verb). */
ok('the card and mixer are injected by the APP (hot-swap deliverable, like the eleven dial) and removed on teardown via subs',
   /voicecard/.test(appSrc) && !/voicecard/.test(shell)
   && /subs\.push\(\(\) => vcard\.remove\(\)\)/.test(appSrc) && /subs\.push\(\(\) => mixWrap\.remove\(\)\)/.test(appSrc)
   && /subs\.push\(\(\) => vstyle\.remove\(\)\)/.test(appSrc),
   'a shell-side card arrives half per hot swap (ledger 83\'s split), or an injected node survives a swap and doubles up');
ok('the wave is REAL: an AnalyserNode inside the take\'s own chain, drawn from its time-domain samples',
   /ctx\.createAnalyser\(\); ana\.fftSize = 2048/.test(appSrc)
   && /g\.connect\(ana\); ana\.connect\(ctx\.destination\)/.test(appSrc)
   && /getByteTimeDomainData/.test(appSrc),
   'a wave from anywhere but the take\'s own graph is the hosted artifact\'s fake scope, rebuilt where the whole point is real organs');
ok('the OS voice gets NO wave, and the card says why on screen',
   /never enters the deck graph — nothing to tap/.test(appSrc)
   && /\$\('vcWave'\)\.hidden = true/.test(appSrc),
   'speechSynthesis output cannot be tapped; drawing anything there is a synthesized wave presented as signal');
ok('fed words reach the card via textContent only',
   /\$\('vcText'\)\.textContent/.test(appSrc) && !/vcText'\)\.innerHTML/.test(appSrc)
   && /\$\('vcWho'\)\.textContent/.test(appSrc),
   'r.speak is fed text; the card renders it - an innerHTML path is an injection point');
ok('the card hides on a grace-checked END, driven on iv() - no bare interval, no rAF',
   /voice\.seen && !sp/.test(appSrc) && /> 5000/.test(appSrc) && /> 1200/.test(appSrc)
   && (appSrc.match(/setInterval\(/g) || []).length === 2 && !/requestAnimationFrame/.test(appSrc),
   'a card that never hides claims speech forever; a bare interval survives a hot swap and doubles up');
ok('the voice fader moves a PLAYING take live and reaches the OS voice ONLY through configureSpeech - no direct dw-speech write anywhere in the console',
   /window\.__sayfileGain\.gain\.value = \+vgr\.value/.test(appSrc)
   && /configureSpeech\(\{ volume: Math\.min\(1, \+vgr\.value\) \}\)/.test(appSrc)
   && !/setItem\('dw-speech'/.test(appSrc),
   'a second config path beside the deck\'s own verb is ledger 40\'s shape in the speech domain');
ok('the duck fader goes through the same public verb',
   /configureSpeech\(\{ duck: \+vdr\.value \}\)/.test(appSrc),
   'a duck knob that writes stores directly would drift from the deck\'s clamps');
ok('the faders INITIALIZE from the stores - the locked numbers stay until the keeper moves them',
   /vgr\.value = g0; vdr\.value = d0;/.test(appSrc)
   && /JSON\.parse\(localStorage\.getItem\('dw-speech'\)/.test(appSrc),
   'a fader that boots at a default OVERWRITES the by-ear canon (gain 1.62 · duck by ear) on first touch of the page');
ok('a fader that cannot reach the deck SAYS so',
   /the OS-voice half of this fader/.test(appSrc) && /duck not applied/.test(appSrc),
   'a fader that moves and does nothing is ledgers 84/85/89\'s exact class');
ok('replacing a take stops BOTH sources - the facility double included',
   /window\.__sayfileDbl\.stop\(\)/.test(appSrc) && /window\.__sayfileDbl = dbl/.test(appSrc),
   'the detuned double of a replaced take keeps talking to the end of its buffer at 0.45 gain (ledger 100)');
ok('the card still adds NO network surface and no navigation',
   (src.match(/fetch\(/g) || []).length === 3 && !/<a\s/.test(src),
   (src.match(/fetch\(/g) || []).length + ' fetches');

console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') + ' of ' + checks + ' checks');
process.exit(fails ? 1 : 0);
