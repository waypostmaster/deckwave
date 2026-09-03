/* Does the CITYWALK screen keep its own promises, read from its source?

   CITYWALK is one self-contained HTML file (extensions/citywalk/index.html):
   a read-only screen whose rain is real bits of real text, fed by append-only
   jsonl files in its own directory and the deck's public pulse. Same shape of
   harness as check-recon.js and labelled the same way — a TEXT harness, where
   each check pins a promise the file makes to the exact code that keeps it,
   and every check states its falsifier.

   The claim this file exists to defend is the only one that matters:
   THE GLYPHS ARE DATA, NOT DECORATION. The older RAIN in the Deckwave Console
   artifact picks each glyph from GLYPH[(c.x + y + (t*9|0) + k*7|0) % len] — a
   hash of position and time. If this screen ever drifts back to that, the
   checks below are how you find out.

       node tools/check-citywalk.js
*/
const fs = require('fs');
let fails = 0, checks = 0;
const ok = (name, cond, falsifier) => {
  checks++;
  if (!cond) { fails++; console.log('  FAIL  ' + name + '\n        falsifier hit: ' + falsifier); }
  else console.log('  pass  ' + name);
};
const rd = p => fs.readFileSync(p, 'utf8').replace(/\r\n/g, '\n');
const src = rd('extensions/citywalk/index.html');
const corpus = JSON.parse(rd('extensions/citywalk/corpus.json'));
const walkRaw = rd('extensions/citywalk/citywalk.jsonl');
const evRaw = fs.existsSync('extensions/citywalk/events.jsonl')
  ? rd('extensions/citywalk/events.jsonl') : '';
const gitignore = rd('.gitignore');
const WALK = walkRaw.split('\n').filter(l => l.trim()).map(JSON.parse);

/* ── does it even PARSE ──────────────────────────────────────────────────
   Added after a real miss. An escaping fault collapsed a "\n" inside a string
   literal into an actual newline, which broke the page's entire script block
   — and all 25 pattern checks below passed on it, cheerfully, because every
   string they look for was still present. A text harness reads shapes; it
   cannot see syntax. So compile the script before believing anything else
   about it. vm.Script parses without executing, so no DOM is needed. */
const vm = require('vm');
/* EVERY inline block, not the first one. The old line took src.split('<script>')[1]
   — literally the first bare `<script>` tag — so a second block, or one written
   `<script type="module">`, was invisible to the only check in this file that can
   see a SyntaxError at all. It held by luck: there is one block today. A block
   with a `src=` is a file, not inline text, and is skipped. */
const inlineBlocks = html =>
  (html.match(/<script\b(?![^>]*\bsrc\s*=)[^>]*>[\s\S]*?<\/script>/gi) || [])
    .filter(b => {
      const t = (b.match(/^<script[^>]*\btype\s*=\s*["']?([^"'>\s]+)/i) || [])[1];
      return !t || /^(text\/javascript|application\/javascript|module|text\/ecmascript)$/i.test(t);
    })
    .map(b => b.replace(/^<script[^>]*>/i, '').replace(/<\/script>$/i, ''));
const BLOCKS = inlineBlocks(src);
const SCRIPT = BLOCKS.join('\n');
let parseErr = null;
BLOCKS.forEach((b, i) => {
  if (parseErr) return;
  try { new vm.Script(b, { filename: 'citywalk-inline-' + i + '.js' }); }
  catch (e) { parseErr = 'block ' + i + ': ' + e.message; }
});
console.log('\n── does it parse ───────────────────────────────────────────');
ok('EVERY inline <script> in the page compiles (' + BLOCKS.length + ' block(s), src-less, JS-typed)',
   BLOCKS.length > 0 && SCRIPT.length > 1000 && parseErr === null,
   parseErr ? 'SyntaxError: ' + parseErr
            : 'no inline block found to compile — and the first cut of this check compiled only the FIRST bare <script>, so a second block or a type= attribute was never parsed at all');

console.log('\n── the rain is data, not decoration ────────────────────────');
ok('every glyph is indexed out of BITS, the encoded corpus',
   /const bit = BITS\[/.test(src) && /g\.fillText\(bit,/.test(src),
   'the drawn character no longer comes from the bit string');
ok('BITS is built by encoding the corpus text, not generated',
   /BITS = parts\.map\(toBits\)\.join\(''\)/.test(src) && /toBits = s =>/.test(src),
   'BITS is produced by something other than encoding real text');
/* Scoped to the DRAWING CODE, not the whole file. The first version tested the
   entire source and failed on the page's own header comment, which quotes the
   artifact's GLYPH[...] line to explain what this screen does not do. The check
   was right about what it meant and wrong about where to look: a comment
   describing a hazard is not the hazard. */
const FRAME = (src.split('function frame()')[1] || '').split('\n/* ---- boot')[0];
ok('NO hash-of-position-and-time glyph source in the drawing code',
   FRAME.length > 200 && !/GLYPH\s*\[/.test(FRAME) && !/\bt\s*\*\s*9\b/.test(FRAME),
   'a positional/temporal hash is selecting glyphs again inside frame()');
ok('Math.random is used ONLY for column geometry, never for glyph content',
   (src.match(/Math\.random\(\)/g) || []).length > 0 &&
   !/fillText\([^)]*Math\.random/.test(src),
   'a random value reached the drawn character');
ok('a missing corpus draws NOTHING and says so — it does not fall back to noise',
   /BITS = '';/.test(src) && /does not invent glyphs/.test(src) && /if \(!BITS\.length\)/.test(src),
   'the screen invents glyphs when the real data is missing');

console.log('\n── house words only, and said on the face ──────────────────');
ok('corpus.json declares house-words-only in its own text',
   /Nobody else is named, quoted, or addressed/i.test(corpus.note),
   'the corpus no longer states whose words it holds');
ok('every corpus entry declares its provenance',
   Array.isArray(corpus.entries) && corpus.entries.length > 0 &&
   corpus.entries.every(e => typeof e.text === 'string' && e.text.length > 0 && e.id && e.of),
   'a corpus entry has no provenance fields');
ok('the screen tells a viewer whose words are falling, on screen and at boot',
   /House words only/.test(src) && /Nobody else's writing is on this screen/.test(src),
   'a viewer could assume the rain is somebody else\'s');
/* PERSONAL handles AND the name of the system this was first built against.
   The page is platform-agnostic now: it documents its own feed schema and
   should assume nothing about who is writing to it. */
/* SHIPPING files only. events.jsonl is deliberately excluded here and checked
   separately below: it is a LIVE bus that may legitimately carry real names
   from whatever system is writing to it, and the thing that keeps those names
   out of the archive is not this scan — it is being gitignored. Scanning it
   would have made this check fail for a correct reason and taught the next
   person to weaken it. */
ok('NO handle or system name from the original deployment appears in a SHIPPING file',
   /* THE LIST IS NOT IN THIS FILE, AND THAT IS THE WHOLE POINT. It used to be
      inline - and three of the five names it guards appeared NOWHERE ELSE in
      the repository, so the check against publishing them was the only thing
      publishing them. A denylist is a list of exactly the strings you do not
      want in a permanent public archive; keeping it in a tracked file defeats
      itself. It now lives in .citywalk-denylist (gitignored, one name per
      line). No file, no names to check - and the check says so rather than
      passing quietly, because a guard that silently does nothing is worse
      than no guard. */
   (function () {
     var p = '.citywalk-denylist';
     if (!fs.existsSync(p)) return 'NO-LIST';
     var names = fs.readFileSync(p, 'utf8').split('\n')
       .map(function (s) { return s.trim().toLowerCase(); })
       .filter(function (s) { return s && s[0] !== '#'; });
     if (!names.length) return 'NO-LIST';
     var hay = (src + JSON.stringify(corpus) + walkRaw).toLowerCase();
     var hit = names.filter(function (n) { return hay.indexOf(n) > -1; });
     return hit.length ? 'LEAKED: ' + hit.join(', ') : true;
   })() === true,
   'a name from another party or system is in a file bound for a permanent public archive');
/* A REGEX OVER .gitignore IS NOT THE QUESTION. The question is whether git
   TRACKS the file, and `git ls-files --error-unmatch` is the only thing that
   answers it: a pattern can be overridden by a later negation, by a nested
   .gitignore, or - the one that actually bites - by a file that was committed
   BEFORE the ignore rule existed, which .gitignore does not affect at all.
   Spawning git is fine here; check-serve already starts a whole server.
   Run against the harness's own repository (-C), so the answer does not
   depend on the working directory a copy of the source is read from. */
const REPO = require('path').join(__dirname, '..');
const tracked = rel => {
  const r = require('child_process').spawnSync(
    'git', ['-C', REPO, 'ls-files', '--error-unmatch', '--', rel], { encoding: 'utf8' });
  if (r.error) return 'git-unavailable';
  return r.status === 0;                    /* true = TRACKED */
};
{
  /* every one of these is either a live bus, a per-machine record, or a file
     naming things that must not enter a permanent public archive */
  const mustBeUntracked = ['extensions/citywalk/events.jsonl',
                           'extensions/citywalk/neighbours.json',
                           '.helm.json', 'recon.jsonl',
                           'docs/RUNBOOK.md', '.citywalk-denylist'];
  const states = mustBeUntracked.map(f => [f, tracked(f)]);
  const leaked = states.filter(q => q[1] === true).map(q => q[0]);
  const unknown = states.filter(q => q[1] === 'git-unavailable').map(q => q[0]);
  ok('git itself says NONE of the live/private files is tracked (' + mustBeUntracked.length + ' asked)',
     unknown.length === 0 && leaked.length === 0,
     unknown.length ? 'git could not be run, so this check answered nothing — a check that cannot run must not pass'
                    : 'TRACKED: ' + leaked.join(', ') + ' — one commit publishes it permanently, and a .gitignore regex cannot see a file that was already added');
  /* THE CONTROL. A zero from `ls-files` is worth nothing until the same call
     has been shown returning a hit (CLAUDE.md, amended after ledger 121). */
  ok('...and the same call has been shown returning TRACKED for a file that is (control)',
     tracked('extensions/citywalk/index.html') === true,
     'git ls-files --error-unmatch reports nothing as tracked, so the zeros above are a broken command, not a clean result');
}

console.log('\n── speech, and the watched places panel ────────────────────');
/* SPEECH IS OFF UNTIL A REAL TAP. Browsers refuse to speak on an untouched
   page and iOS needs synthesis primed inside a gesture, so a console that
   looks armed and is silent is worse than one that plainly reads "voice off".
   Pinned to the PROPERTY, not the wording: the default is falsy and arming
   goes through the deck's armSpeech(). */
ok('the voice is OFF by default and armed only from a click',
   /let voiceOn = false/.test(src) &&
   /\$\('voice'\)\.addEventListener\('click'/.test(src) &&
   /D\.armSpeech/.test(src),
   'speech can start without a user gesture, or the arm path is gone');

/* NEVER SPEAK MARKUP. A speech field is a different register from a screen
   field: a voice working through JSON braces is noise, not information. The
   refusal is the honest failure. */
ok('markup, JSON and code fences are REFUSED rather than read aloud',
   /function sayable/.test(src) && /replace\(\/<\[\^>\]\*>\/g/.test(src) &&
   /\[\{\}<>\]/.test(src) && /```/.test(src),
   'a record could speak raw markup');

/* It does NOT duck around speak(). The deck already ducks to its own depth
   and restores exactly when the utterance ends, and deliberately keeps a
   speech duck distinct from a manual one - so wrapping it would duck twice
   and fight the engine's own restore. */
/* Tested against a COMMENT-STRIPPED copy. The first version searched the
   whole source and was tripped by the comment that explains why not to do
   this - the fourth time in one session that a note about a hazard set off
   the check written for it. A check that reads prose is reading the wrong
   thing. */
const codeOnly = src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, ' ');
ok('speech does not double-duck: no inject(duck) around speak()',
   !/inject\('duck'\)/.test(codeOnly) && !/inject\("duck"\)/.test(codeOnly),
   'the page ducks on top of the engine, which already ducks and restores');

/* A RECORD SPEAKS ONCE, and arming does not recite the backlog. */
ok('a record speaks once, and arming the voice does not read the history',
   /spokenKeys/.test(src) && /events\.forEach\(e => spokenKeys\.add/.test(src),
   're-reading the feed could re-speak records already seen');

/* THE PANEL HOLDS NO LIST OF ITS OWN. This is what keeps the file
   platform-agnostic: the ids and the words arrive as DATA on the feed that is
   already being read, so the page never learns what it is watching and no new
   fetch is added. A hardcoded list here would put a particular system back
   into a file that was deliberately scrubbed of one. */
ok('the watch panel hardcodes NO place ids and NO keywords - both come from the feed',
   /watchCfg = r\.watch/.test(src) &&
   !/watchCfg\s*=\s*\{[^}]*ids\s*:\s*\[\s*\d/.test(src) &&
   !/const\s+WATCH(ED)?_(IDS|WORDS)/.test(src),
   'a place id or keyword list is baked into the source');

/* Two columns, never totalled, and the words printed beside their count -
   because a keyword set is a knob and a count without its knob is a claim. */
/* THE PROSE VERSION OF THIS CHECK TESTED THE PROSE. `/never added together/`
   matches the sentence promising it, in the very comment that explains the
   promise - the exact ledger 109/112/113 shape, a comment asserting something
   the code was never asked about. The code question is: do the two counts ever
   meet in one expression? Tested on the COMMENT-STRIPPED view, with a control
   below that must be caught. */
const sumsSignals = s =>
     /\b(inPlace|mentions)\b\s*\.\s*length\s*\+\s*\b(inPlace|mentions)\b\s*\.\s*length/.test(s)
  || /\binPlace\b\s*\.\s*concat\s*\(\s*mentions\b/.test(s)
  || /\bmentions\b\s*\.\s*concat\s*\(\s*inPlace\b/.test(s)
  || /\[\s*\.\.\.\s*(inPlace|mentions)\s*,\s*\.\.\.\s*(mentions|inPlace)\s*\]/.test(s);
ok('the two signals are never added together — tested on the CODE, not on the sentence promising it',
   /const inPlace = rows\.filter/.test(codeOnly) && /const mentions = words\.length/.test(codeOnly)
   && !sumsSignals(codeOnly),
   'the panel totals a hard signal (a place id is a fact) with a soft one (a keyword set is a knob) — and the previous version of this check matched the word "never added together" in a comment, which survives any change to the code');
ok('...and the summing detector has been shown CATCHING one (control)',
   sumsSignals('const total = inPlace.length + mentions.length;')
   && sumsSignals('const all = inPlace.concat(mentions);')
   && !sumsSignals('line("in watched places", inPlace.length, "hard"); line("mentions", mentions.length, "soft");'),
   'the detector returns false on a deliberate sum, so its zero above means nothing — a search without a control is decoration (CLAUDE.md)');
ok('the keyword set is printed beside its count, because a knob without its setting is a claim',
   /ARE the knob/.test(src),
   'the panel hides the words behind the number');

/* Word boundaries, never substrings: "port" must not match "important". */
ok('watched words match on boundaries, not substrings',
   /function wordHit/.test(src) && /\[a-z0-9\]/.test(src) && /charAt\(i - 1\)/.test(src),
   'a substring match would count "important" as "port"');

/* Deduplicate, or every number here inflates. */
ok('rows are deduplicated before anything is counted',
   /const evKey =/.test(src) && /duplicate row/.test(src),
   'a repeated row inflates both columns and nobody is told');

/* Staleness as TWO NUMBERS. A quiet feed is ambiguous - a working poller and
   a dead one produce identical evidence - and a dot cannot settle it. */
ok('staleness is two numbers and admits what it cannot tell',
   /newest here/.test(src) && /newest upstream/.test(src) &&
   /cannot tell a working feed from a stopped one/.test(src),
   'the panel implies it knows the feed is alive');

/* An unanswered count needs a definition and there is more than one. */
ok('unanswered is only counted when the feed supplies its definition',
   /watchCfg\.unanswered/.test(src) && /will not pick one for you/.test(src),
   'the panel invents a definition of unanswered and counts against it');

/* Control rows configure; they are not events and must not be listed or read
   aloud. */
ok('control rows are filtered out of the event list',
   /r\.watch \|\| r\.voiceCfg/.test(src) && /const shown = rows\.filter/.test(src),
   'a configuration row is rendered as an event, or spoken');

console.log('\n── read-only, no new network surface ───────────────────────');
/* Three fetches. Two are hard-coded relative paths. The third is the only one
   a viewer can influence, and it does NOT reach fetch as typed — it reaches it
   as feedPath, which is only ever assigned from safeFeed(). The check asserts
   that route rather than a literal filename, because asserting the literal is
   what broke when the feature landed. */
/* SIX fetches since the watched-places and OUR RECORD feeds landed - five
   hard-coded relative paths and the one the viewer can influence. This check
   went red at the commit that added the last two and stayed red, which is the
   check being STALE rather than the code being wrong: every literal is still
   named here, so a SEVENTH fetch, or a remote host, still fails it. */
/* counted on the COMMENT-STRIPPED view: the first run of this version scored
   seven because a new comment in the page mentioned `fetch()` while explaining
   the safeFeed gate. A prose mention is not a network call - the same lesson
   this file has now learned five times. */
ok('exactly six fetches IN CODE: five hard-coded relative paths, one gated by safeFeed',
   (codeOnly.match(/fetch\(/g) || []).length === 6 &&
   /fetch\('corpus\.json\?t='/.test(src) && /fetch\('citywalk\.jsonl\?t='/.test(src) &&
   /fetch\('neighbours\.json\?t='/.test(src) &&
   /fetch\('watched\.jsonl\?t='/.test(src) && /fetch\('ours\.jsonl\?t='/.test(src) &&
   /fetch\(feedPath \+ '\?t='/.test(src) &&
   /const FEED_DEFAULT = 'events\.jsonl'/.test(src) &&
   /feedPath = v\.path;/.test(src) &&
   !/feedPath = (?!FEED_DEFAULT|v\.path|stored)/.test(src) &&
   !/fetch\('(https?:|\/\/|\/)/.test(codeOnly),
   (codeOnly.match(/fetch\(/g) || []).length + ' fetch calls in code, or feedPath is assigned from something safeFeed never saw');
ok('NO remote host is named anywhere in the page, not even as a suggestion',
   !/https?:\/\//.test(src),
   'a remote host appears in a page that promises a viewer it reaches nowhere');
ok('no navigation: no window.open, no location assignment, no anchor tags',
   !/window\.open/.test(src) && !/location\.(href|assign|replace)/.test(src) && !/<a\s/.test(src),
   'the screen can navigate somewhere');
ok('every rendered field goes through esc()',
   /const esc = s =>/.test(src) && !/innerHTML\s*=\s*[^;]*\$\{/.test(src) &&
   (src.match(/esc\(/g) || []).length >= 12,
   'an untrusted field reaches innerHTML unescaped');
ok('the deck is driven only through its public surface',
   /contentWindow\.DWEVENTS/.test(src) && /D\.pulse\(\)/.test(src) &&
   !/contentWindow\.DW\./.test(src),
   'the page reached past DWEVENTS into deck internals');

console.log('\n── honesty furniture ───────────────────────────────────────');
ok('staleness goes red and says the screen cannot tell working from stopped',
   /cannot tell working from stopped/.test(src) && /className = 'bad'/.test(src),
   'a quiet feed can look like a calm one');
ok('4/4 is labelled ASSUMED wherever a bar is shown',
   /assumed 4\/4/.test(src) && /4\/4 IS ASSUMED/.test(src),
   'the page claims a downbeat the engine does not detect');
ok('the ladder never invents a place the feed has not seen',
   /not seen in this feed/.test(src) && /byId\[node\.parent_id\]/.test(src),
   'an unseen ancestor is drawn as though it were observed');
/* Keyed on a DECLARED kind, not on the shape of the free text. The first
   version decided what a row WAS by pattern-matching its prose, and broke the
   moment that prose was edited for an unrelated reason. A check that reads a
   sentence to classify a record fails on any rewording, and it fails while you
   are changing something else and not looking at it. */
ok('every move row carries a reference id; every row declares its kind',
   WALK.filter(r => r.kind === 'move').every(r => r.ref != null) &&
   WALK.every(r => r.kind === 'move' || r.kind === 'note'),
   'a move row has no reference, or a row declares no kind at all');
/* THE WALK FEED NOW CARRIES BOTH KINDS. This check asserted
   `WALK.every(r => r.sample === true)` - written when citywalk.jsonl held
   nothing but the seven shipped examples. Since OUR RECORD took the stage the
   same tracked file also carries observed rows, which correctly do NOT claim
   to be samples, and the assertion went red on data that is honest.
   What is still testable, and is what the lamp actually rests on:
     · a `sample` value is EXACTLY true or absent - never a truthy string,
       which would read as flagged and is not a boolean anybody checked;
     · the lamp expression is intact, so it goes dark the moment one
       unflagged row exists, with no human deciding.
   WHAT THIS CAN NO LONGER SEE, said rather than implied: with observed rows
   in the file, nothing in the DATA distinguishes an example somebody forgot
   to flag from a genuine observation. That is the producer's discipline now,
   not this harness's, and pretending otherwise would be the decoration this
   file exists to remove. */
{
  const flagged = WALK.filter(r => r.sample === true).length;
  const odd = WALK.filter(r => r.sample !== undefined && r.sample !== true).length;
  ok('every `sample` value is exactly true or absent (' + flagged + ' flagged, ' + (WALK.length - flagged) + ' observed), and the SAMPLE lamp clears itself',
     WALK.length > 0 && odd === 0 &&
     /\$\('sample'\)\.hidden = !walk\.every\(w => w\.sample === true\)/.test(src),
     odd + ' row(s) carry a sample value that is neither absent nor exactly true — a truthy string reads as flagged and is not; or the lamp needs a human to turn it off');
}
ok('an empty or missing events feed reads as a normal state, not as breakage',
   /That is a normal state,/.test(src) && /if \(!events\.length\)/.test(src) &&
   /if \(!r\.ok\)/.test(src),
   'a missing events.jsonl looks like a failure, or throws');

/* The feed box is the one place a viewer can change what this page fetches,
   so it is the one place the "reaches nowhere" promise could be destroyed.
   safeFeed is a gate, not advice: no scheme, no //, no leading /, no
   backslash, no .. segment, no query or fragment. There is no override. */
ok('the user-set feed path CANNOT leave this directory',
   /function safeFeed/.test(src) &&
   /\[a-zA-Z\]\[a-zA-Z0-9\+\.-\]\*:/.test(src) &&
   /s\.startsWith\('\/\/'\)/.test(src) &&
   /s\.startsWith\('\/'\)/.test(src) &&
   /s\.split\('\/'\)\.includes\('\.\.'\)/.test(src),
   'a scheme, an absolute path, a protocol-relative path or a .. segment could reach the fetch');
ok('the feed path is validated before it is stored AND again when read back',
   /if \(stored && safeFeed\(stored\)\.ok\)/.test(src) &&
   /const v = safeFeed\(p\);/.test(src) &&
   /if \(!v\.ok\)/.test(src),
   'a bad path could be persisted, or a poisoned localStorage value trusted on load');

/* ── the page holds intent, never action ──────────────────────────────────
   Clicking a reachable place QUEUES a request. It does not move anything and
   it cannot: a page that could act would need a credential, and a credential
   in a page served over --lan is a credential everyone on the network holds.
   Whatever drains the queue is outside the page and is the only thing that
   ever touches the system being walked. */
console.log('\n── clicks queue, they never act ────────────────────────────');
ok('every fetch is a plain GET — nothing here can write anywhere',
   !/method\s*:\s*['"](POST|PUT|PATCH|DELETE)/i.test(src) &&
   !/new XMLHttpRequest|navigator\.sendBeacon|WebSocket|EventSource/.test(src),
   'the page acquired a way to write to something');
ok('a click pushes onto a queue and nothing else',
   /queue\.push\(\{ ts: new Date\(\)\.toISOString\(\), place_id: n\.place_id/.test(src) &&
   /window\.CITYWALK = \{/.test(src) && /drain\(\)/.test(src),
   'a click does something other than record intent');
ok('the clicked id is matched against the loaded list, never trusted as typed',
   /const n = nbs\.find\(x => Number\(x\.place_id\) === id\)/.test(src) && /if \(!n\) return;/.test(src),
   'an id from the DOM could reach the queue without being a place the feed named');
ok('a queued request shows as PENDING and is only cleared by the world moving',
   /pending/.test(src) && /if \(j\.from_place_id != null && j\.from_place_id !== nbFrom\)/.test(src),
   'the page could imply a move happened, or clear a request nothing acted on');
ok('neighbours.json is gitignored, so a live position never ships',
   /^extensions\/citywalk\/neighbours\.json\s*$/m.test(gitignore),
   'the live reachable-set file is trackable and one git add would publish real place data');

/* ── reading somebody else's record ───────────────────────────────────────
   A body in the feed is a stranger's text and is treated as hostile. It goes
   on the page with textContent, never as markup, so there is nothing to
   escape wrongly — and nothing in it is ever turned into a link, because
   ledger 103 is this codebase's own record of an attribution URL that RAN
   despite HTML escaping. */
console.log('\n── reading a record ────────────────────────────────────────');
/* Pinned to the PROPERTY, not to a line. The first version matched the exact
   statement "$('rdbody').textContent = e.body;" and went red the moment that
   function was restructured for an unrelated reason — while the property it
   cares about was never once in danger. A check that pins a line shape breaks
   on refactors and teaches people to loosen it; pin what must be true. */
const READER = (src.split('function openRecord')[1] || '').split('\nfunction closeRecord')[0];
ok('a record body is rendered as TEXT, never as markup',
   READER.length > 200 &&
   /body\.textContent = e\.body;/.test(READER) &&
   !/\.innerHTML/.test(READER) &&
   !/insertAdjacentHTML|outerHTML|document\.write/.test(READER),
   'a stranger\'s text could reach the page as markup');
ok('the detail view is built from DOM nodes and textContent, never a string of HTML',
   /createElement\('div'\)/.test(READER) && /createElement\('span'\)/.test(READER) &&
   /val\.textContent = String\(e\.detail\[k\]\)/.test(READER),
   'a logged field could be concatenated into markup');
ok('the reader creates no links from feed data',
   !/createElement\('a'\)/.test(src) && !/\.href\s*=/.test(src),
   'a URL out of the feed could be dispatched by the parser despite escaping');
ok('a translated record says so rather than passing a transform off as the original',
   /body_is_decoded/.test(src) && /not literally what was typed/.test(src),
   'a reader could take a machine translation for what its author actually wrote');
ok('the events panel SORTS by ts rather than trusting the feed to arrive ordered',
   /rows\.sort\(\(a, b\) => String\(a\.ts \|\| ''\)\.localeCompare/.test(src),
   'a panel headed newest-first renders whatever order the file happened to be in');

console.log('\n── platform-agnostic, and reusable ─────────────────────────');
ok('the page documents its own feed schema so anyone can point it at their places',
   /THE FEED, so you can point this at your own places/.test(src) &&
   /CONTAINMENT TREE/.test(src) && /THE EVENTS FEED/.test(src),
   'the page assumes one particular system, or ships without a schema anyone could use');
ok('the events feed is a FILE bus, and the page says why it is not a network call',
   /Deliberately NOT a network call/.test(src) &&
   /grows no new network surface/.test(src),
   'the events panel could acquire a remote source without anyone noticing');

console.log('\n── extension rules: zero core changes ──────────────────────');
ok('self-contained: no build step, no imports, no external script tags',
   !/<script[^>]+src=/.test(src) && !/\brequire\(/.test(src) && !/\bimport\s/.test(src),
   'the page grew a dependency');
ok('the deck is embedded, not modified',
   /<iframe id="dw" src="\.\.\/\.\.\/index\.html"/.test(src),
   'the iframe no longer points at the unmodified deck');
ok('one real click is designed in as a boot screen',
   /id="boot"/.test(src) && /one real click/.test(src) && /a synthetic one does not count/.test(src),
   'the page pretends audio can start without a gesture');

/* Summary line matches the other eleven harnesses EXACTLY, character for
   character: "all passed of N checks". It used to read "all passed  (N
   checks)", which is arguably prettier and cost a real total: a script summing
   all twelve by regex scored this file ZERO and printed a confident grand
   total that silently omitted it. The pattern matched the shape it expected
   and reported success on nothing. Prefer a gate that refuses to a paragraph
   that asks — uniformity here is what makes an automated total possible
   without anybody having to remember. */
console.log('\n── the review pass, 2026-09-01 (extensions) ────────────────');
/* docs/REVIEW-2026-09-01.md, "Extensions". Each check ran against the HEAD
   source first and failed there. */

/* safeFeed is RUN, not matched. It is the one gate on the one thing a viewer
   can change about what this page fetches, and the percent-encoded traversal
   walked past the literal `..` test - so the string that was CHECKED and the
   string that was REQUESTED were different strings. */
{
  const fn = (src.match(/function safeFeed\(p\)\s*\{[\s\S]*?\n\}/) || [''])[0];
  const box = {};
  let err = '';
  try { vm.createContext(box); new vm.Script(fn + '\nthis.safeFeed = safeFeed;', { filename: 'safeFeed' }).runInContext(box); }
  catch (e) { err = (e && e.message) || String(e); }
  const gate = box.safeFeed;
  const refuses = p => { try { return gate(p).ok === false; } catch (e) { return 'threw'; } };
  const accepts = p => { try { const v = gate(p); return v.ok === true ? v.path : false; } catch (e) { return 'threw'; } };
  ok('safeFeed REFUSES a percent-encoded traversal in both cases — %2e%2e and %2E%2E (run, with controls)',
     !err && refuses('%2e%2e/secret.jsonl') === true && refuses('%2E%2E/secret.jsonl') === true
     && refuses('a/%2e%2e/b.jsonl') === true && refuses('%2f etc/passwd') === true,
     err || 'the gate refused a literal `..` and let the encoded form through: fetch() sends it as typed and the server decodes it once, so the path that was tested was never the path that was requested');
  ok('...and it still ACCEPTS an ordinary relative name, and still refuses the literal forms (controls both ways)',
     !err && accepts('events.jsonl') === 'events.jsonl' && accepts('sub/dir/x.jsonl') === 'sub/dir/x.jsonl'
     && refuses('../x') === true && refuses('/etc/x') === true && refuses('//host/x') === true
     && refuses('https://x/y') === true && refuses('a\\b') === true && refuses('x?y') === true,
     'a gate that refuses everything is not a gate, and a refusal proves nothing without an acceptance beside it');
  ok('a malformed percent-escape is REFUSED, never guessed at',
     !err && refuses('%zz.jsonl') === true && /bad percent-escape/.test(src),
     'decodeURIComponent throws on a lone %, and an uncaught throw here means the box silently does nothing');
}

ok('a voiceCfg control row is applied ONCE, keyed by row identity, and only with the voice ON',
   /const voiceCfgDone = new Set\(\);/.test(src)
   && /if \(!voiceOn\) return;/.test(src)
   && /const k = \(r\.ts \|\| ''\) \+ '\|' \+ JSON\.stringify\(r\.voiceCfg\);/.test(src)
   && /if \(voiceCfgDone\.has\(k\)\) return;/.test(src) && /voiceCfgDone\.add\(k\);/.test(src),
   'every voiceCfg row on the file was re-applied every 4 s for as long as it sat there — each call writes dw-speech and stamps over the deck\'s own status line (ledger 107\'s line) — and it ran with the voice off, unlike RECON\'s');

ok('switching the feed marks the new file\'s backlog SEEN, silently: only rows arriving after the switch speak',
   /feedSwitched = true;/.test(src)
   && /if \(feedSwitched\) \{ feedSwitched = false; shown\.forEach\(e => spokenKeys\.add\(evKey\(e\)\)\); \}/.test(src)
   && /let feedSwitched = false;/.test(src),
   'setFeed empties `events`, so every row of the new file counted as fresh and the page recited the whole file end to end — the seance, one panel over');

/* THE EPILOGUE GOES ABOVE THE TALLY, and that is not tidiness. The three
   lines below used to print AFTER it, so `node tools/check-citywalk.js |
   tail -1` came back blank and CLAUDE.md's "every harness ENDS on the same
   line" was simply false of this file's stdout — the same family as ledger
   110, where one prettier variant scored ZERO in a regex over all twelve and
   reported a confident grand total that silently omitted it. The prose is
   worth keeping; being last is what the tally needs. */
console.log('\nText harness: it reads the source, not a browser. What only a\n' +
            'browser can show — that the rain actually falls, that the deck\n' +
            'drives it — is not proven here and must be seen.');
console.log('\n' + (fails ? fails + ' FAILED' : 'all passed') + ' of ' + checks + ' checks');
process.exit(fails ? 1 : 0);
