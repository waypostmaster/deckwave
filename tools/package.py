#!/usr/bin/env python3
"""Cut a canonical package: _source/deckwave-<VERSION>.zip

WHY THIS EXISTS. The CHANGELOG opens with "Earlier packages from the
2026-08-17 session were overwritten in place and no longer exist." They were
built by hand, so the contents were whatever was remembered at the time.
Two packages shipped missing files that index.html loads.

So the file list is DERIVED FROM index.html rather than typed here. Every
src= and href= the page references is resolved and must exist, or the build
refuses. A package that cannot run is worse than no package: it looks like a
restore point and is not one.

TWO REFUSALS, TWO FLAGS. They are unrelated and used to share one switch:

  * the zip for this VERSION already exists      -> --force
  * tracked files have UNCOMMITTED changes       -> --dirty

Until 2026-09-03 a single --force waived both, so the documented way to
rebuild a deliberately deleted package ("pass --force") also silently
disabled the dirty-tree guard -- the guard that exists because a cut taken
over another session's half-written file sealed that work-in-progress into a
release zip (ledger 112). One flag, two meanings, and the second one invisible
at the call site. They are separate now and neither implies the other.

    python tools/package.py                 the normal cut
    python tools/package.py --force         rebuild this version's zip
    python tools/package.py --dirty         cut anyway, tree not settled
    python tools/package.py --help          this text, builds nothing

WHAT IS LEFT OUT, AS A CHOICE. See SKIP_DIRS and the note beside it, plus
EXTRA_DIRS: what is not walked is not packaged, and the omissions are
deliberate rather than forgotten. `docs/research/`, `design-system/`,
`_design/`, `CNAME` and `.nojekyll` are all outside the zip on purpose --
the package is the SOFTWARE.
"""
import os, re, subprocess, sys, zipfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Everything not reachable from index.html, listed explicitly. Directories are
# taken whole; a missing one is a hard error, a missing file inside is not.
EXTRA_FILES = ['index.html', 'VERSION', 'CHANGELOG.md', 'README.md', 'SKILL.md',
               'LICENSE', 'NOTICE', 'CLAUDE.md',
               # fetched at runtime by the ▶ demo button, so it is invisible to
               # referenced_by_index() — a package without it has a demo button
               # that 404s. A SCORE, not audio: the tree still ships no audio.
               'assets/demo-set.json',
               # loaded at runtime by audioWorklet.addModule(), so also
               # invisible to the index scan — a package without it silently
               # falls back to the plain worklet, which is the gapping pipe
               # ledger 65 exists to retire.
               'assets/deckwave-stretch.module.js',
               # the wrapper half of the SAME worklet, fetched by the blob
               # fallback (tier 2) when the static module is refused. Missing
               # from every package before 2026-08-30: tier 1 carried playback
               # so nothing was heard, but a restored package whose static
               # module failed dropped straight past tier 2 to the gapping
               # plain worklet — the failure the tiers exist to prevent.
               'assets/deckwave-stretch.js']
EXTRA_DIRS = ['docs', 'references', 'tools', 'themes', 'vendor', 'examples', 'extensions']

# WHAT IS LEFT OUT, AND WHY — a choice, recorded, because "not in the zip"
# and "forgotten" look identical from inside a package a year later.
#
# SKIP_DIRS is pruned out of every os.walk above. Names, not paths, so a
# directory called `research` anywhere under EXTRA_DIRS is skipped:
#   _source            the packages themselves — a zip of zips, recursively
#   evidence           large, and separately preserved; not the software
#   .git               the history; the package is a restore point, not a repo
#   __pycache__        build residue
#   deckwave-patches   the live-patch development seam, not the product
#   research           docs/research documents how the decisions were MADE —
#                      IP reviews, platform and engine studies, prior art. It
#                      is publishable and it is in the repo; it is simply not
#                      software, and a restore point does not need it to run.
#
# NOT skipped so much as never reached, because they are not in EXTRA_FILES
# or EXTRA_DIRS and index.html does not reference them: `CNAME` and
# `.nojekyll` (GitHub Pages configuration, meaningless off Pages),
# `design-system/` and `_design/` (the published design pages and their
# canvas sources — documentation of the look, not code the app loads).
#
# Also never packaged since 2026-08-30: anything git does not track. That
# clause was ASSERTED here for a year and never implemented — the walk read
# the DISK, so an untracked working file inside extensions/ or tools/ went
# silently into the release zip. See tracked_set() and ledger 109.
SKIP_DIRS = {'_source', 'evidence', '.git', '__pycache__', 'deckwave-patches',
             'research'}
SKIP_EXT = {'.pyc', '.pem', '.key', '.pfx', '.p12'}


def tracked_set():
    """Every path git tracks, as forward-slash relatives — or None if git
    cannot answer (no git on PATH, or not a checkout).

    The package is meant to be the software AS PUBLISHED, and under the
    fresh-history launch plan what is published is exactly what is tracked.
    Reading the disk instead let another session's untracked work-in-progress
    into a release zip; this is the discriminator that stops it."""
    try:
        out = subprocess.run(['git', '-C', ROOT, 'ls-files'],
                             capture_output=True, text=True, timeout=30)
    except (OSError, subprocess.SubprocessError):
        return None
    if out.returncode != 0:
        return None
    return {line.strip() for line in out.stdout.splitlines() if line.strip()}


def dirty_tracked():
    """Tracked files with uncommitted changes, as forward-slash relatives.
    Empty list if git cannot answer — this guard fails OPEN, because a
    release tool that refuses on a machine without git is worse than one
    that occasionally packages a working copy."""
    try:
        out = subprocess.run(['git', '-C', ROOT, 'status', '--porcelain', '--untracked-files=no'],
                             capture_output=True, text=True, timeout=30)
    except (OSError, subprocess.SubprocessError):
        return []
    if out.returncode != 0:
        return []
    rels = []
    for line in out.stdout.splitlines():
        if len(line) > 3:
            rels.append(line[3:].strip().strip('"').split(' -> ')[-1])
    return rels


def referenced_by_index():
    """Every local path index.html asks the browser to load."""
    html = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    hits = re.findall(r'(?:src|href)\s*=\s*["\']([^"\']+)["\']', html)
    out = []
    for h in hits:
        if h.startswith(('http://', 'https://', '//', 'data:', '#')):
            continue
        out.append(h.lstrip('./'))
    return out


KNOWN_FLAGS = {'--force', '--dirty', '--help', '-h'}


def main():
    # An unknown flag is REFUSED, not ignored. `--Force` or `--dirtytree`
    # used to be silently dropped and the run proceeded under the default
    # rules, which is the worst of the three possible answers.
    unknown = [a for a in sys.argv[1:] if a not in KNOWN_FLAGS]
    if unknown:
        print('unknown option(s): %s' % ' '.join(unknown))
        print(__doc__)
        return 2
    if '--help' in sys.argv or '-h' in sys.argv:
        print(__doc__)
        return 0
    force = '--force' in sys.argv       # rebuild THIS version's zip
    dirty_ok = '--dirty' in sys.argv    # cut from an unsettled tree
    version = open(os.path.join(ROOT, 'VERSION'), encoding='utf-8').read().strip()
    out = os.path.join(ROOT, '_source', 'deckwave-%s.zip' % version)

    if os.path.exists(out) and not force:
        print('refusing: %s already exists.' % os.path.relpath(out, ROOT))
        print('Bump VERSION, or pass --force to rebuild it deliberately.')
        print('(--force rebuilds. It does NOT waive the dirty-tree check below;')
        print(' that is --dirty, and it is separate on purpose.)')
        return 1

    # A release package must come from a settled tree. tracked_set() keeps
    # UNtracked files out, but it cannot keep a tracked file from being read
    # half-written — which happened on 2026-08-30: a cut taken while another
    # session was editing extensions/citywalk/index.html sealed that session's
    # work-in-progress into the zip, silently and with a plausible file count.
    # Same class as the untracked leak, arriving from the other direction.
    # The output zip is EXCLUDED from the check: it is a tracked file this
    # script writes, so the documented `rm <zip> && package.py` shows it as
    # deleted and the guard would refuse its own supported invocation. Its
    # freshness is not in question — it is about to be rebuilt.
    outrel = os.path.relpath(out, ROOT).replace(os.sep, '/')
    dirty = [d for d in dirty_tracked() if d != outrel]
    if dirty and not dirty_ok:
        print('refusing: %d tracked file(s) have uncommitted changes.' % len(dirty))
        for rel in dirty[:12]:
            print('   ' + rel)
        if len(dirty) > 12:
            print('   … and %d more' % (len(dirty) - 12))
        print('A package cut from a dirty tree records a state that never')
        print('existed in the history. Commit or stash first, or --dirty.')
        return 1

    # 1. everything the page loads — missing means the package cannot run
    wanted, missing = [], []
    for rel in referenced_by_index():
        (wanted if os.path.isfile(os.path.join(ROOT, rel)) else missing).append(rel)
    if missing:
        print('refusing: index.html references files that do not exist:')
        for m in missing:
            print('   ' + m)
        return 1

    # 2. the fixed extras
    for rel in EXTRA_FILES:
        if os.path.isfile(os.path.join(ROOT, rel)):
            wanted.append(rel)
    for d in EXTRA_DIRS:
        base = os.path.join(ROOT, d)
        if not os.path.isdir(base):
            print('refusing: expected directory %s is missing' % d)
            return 1
        for dirpath, dirnames, filenames in os.walk(base):
            dirnames[:] = [x for x in dirnames if x not in SKIP_DIRS]
            for f in filenames:
                if os.path.splitext(f)[1].lower() in SKIP_EXT:
                    continue
                wanted.append(os.path.relpath(os.path.join(dirpath, f), ROOT)
                              .replace(os.sep, '/'))

    # 3. keep only what git tracks. Everything above reads the disk, so an
    #    untracked or ignored file inside a walked directory would otherwise
    #    ship in the release zip — which is how another session's WIP got
    #    into a 2026-08-30 cut (ledger 109).
    tracked = tracked_set()
    if tracked is None:
        print('WARNING: git could not be consulted — packaging what is on '
              'disk, which may include untracked files. Check the count.')
    else:
        kept, dropped = [], []
        for rel in wanted:
            (kept if rel in tracked else dropped).append(rel)
        if dropped:
            print('  skipped %d untracked file(s):' % len(set(dropped)))
            for rel in sorted(set(dropped)):
                print('     ' + rel)
        wanted = kept

    seen, files = set(), []
    for rel in wanted:
        if rel not in seen:
            seen.add(rel)
            files.append(rel)
    files.sort()

    os.makedirs(os.path.dirname(out), exist_ok=True)
    with zipfile.ZipFile(out, 'w', zipfile.ZIP_DEFLATED) as z:
        for rel in files:
            z.write(os.path.join(ROOT, rel), 'deckwave/' + rel)

    size = os.path.getsize(out)
    print('%s  ·  %d files  ·  %.1f MB'
          % (os.path.relpath(out, ROOT), len(files), size / 1048576.0))
    scripts = [f for f in files if f.startswith('assets/')]
    print('  %d assets, all %d files index.html loads verified present'
          % (len(scripts), len(referenced_by_index())))
    return 0


if __name__ == '__main__':
    sys.exit(main())
