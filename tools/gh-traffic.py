#!/usr/bin/env python3
"""Capture GitHub's traffic window for waypostmaster/deckwave before it expires.

    python tools/gh-traffic.py                 write evidence/gh-traffic/<stamp>.json
    python tools/gh-traffic.py --out DIR       write somewhere else (a test run)
    python tools/gh-traffic.py --print         print the capture, write nothing

GitHub keeps a trailing FOURTEEN days of views, clones, referrers and paths
and deletes the rest — it does not archive (ledger 135's baseline wrote that
down; the 13 days between 2026-09-06 and 2026-09-18 are gone because nothing
read them). This file is the thing that reads them. One run, one dated file,
never rewritten: a directory of captures is diffable and cannot lose a day to
a bug in a merge step. Runs overlap when the cadence is under 14 days, which
is the point — a missed run costs nothing until the gap exceeds the window.

Standard library only. The read goes through `gh api` so the token stays in
gh's own store (Windows Credential Manager here) and never touches this tree.
`gh` needs push access to the repository for the traffic endpoints; the
account that owns the repo has it. **This script never runs git**: whether a
capture is committed — and so published, this repository being public — is a
person's act, not the task's.

Exit code 0 only when every endpoint answered and the file was written; the
file is written whole or not at all. Every endpoint's raw body is kept
verbatim under `raw` so nothing is interpreted away at capture time.
"""
import argparse, datetime, json, os, shutil, subprocess, sys, tempfile

REPO = 'waypostmaster/deckwave'
ENDPOINTS = ['traffic/views', 'traffic/clones', 'traffic/popular/referrers', 'traffic/popular/paths']
HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUT = os.path.join(os.path.dirname(HERE), 'evidence', 'gh-traffic')


def gh():
    exe = shutil.which('gh')
    if exe:
        return exe
    for cand in (r'C:\Program Files\GitHub CLI\gh.exe',):   # a scheduled task's PATH is not a shell's
        if os.path.exists(cand):
            return cand
    raise SystemExit('gh-traffic: gh not found on PATH')


def api(path):
    where = 'repos/%s/%s' % (REPO, path) if path else 'repos/%s' % REPO   # no trailing slash: GitHub 404s it
    p = subprocess.run([gh(), 'api', where],
                       capture_output=True, text=True, timeout=60)
    if p.returncode != 0:
        raise RuntimeError('%s -> exit %d: %s' % (path, p.returncode, p.stderr.strip()[:300]))
    return json.loads(p.stdout)


def capture():
    now = datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0)
    raw, errors = {}, {}
    for ep in ENDPOINTS + ['']:
        try:
            raw[ep or 'repo'] = api(ep) if ep else api('')
        except Exception as e:                       # keep going: a partial read is still a read, but it is marked
            errors[ep or 'repo'] = str(e)
    views, clones = raw.get('traffic/views') or {}, raw.get('traffic/clones') or {}
    repo = raw.get('repo') or {}
    days = [d['timestamp'][:10] for d in views.get('views', [])]
    out = {
        'what': 'GitHub traffic window for %s, captured by tools/gh-traffic.py' % REPO,
        'captured_utc': now.isoformat().replace('+00:00', 'Z'),
        'window': {'first_day': days[0] if days else None, 'last_day': days[-1] if days else None,
                   'days': len(days),
                   'note': 'trailing 14 complete UTC days; GitHub deletes older data, it does not archive it'},
        'summary': {
            'views': views.get('count'), 'views_uniques': views.get('uniques'),
            'clones': clones.get('count'), 'clones_uniques': clones.get('uniques'),
            'stars': repo.get('stargazers_count'), 'forks': repo.get('forks_count'),
            'watchers': repo.get('subscribers_count'), 'pushed_at': repo.get('pushed_at'),
            'referrers': [[r['referrer'], r['count'], r['uniques']] for r in raw.get('traffic/popular/referrers') or []],
            'paths': [[r['path'], r['count'], r['uniques']] for r in raw.get('traffic/popular/paths') or []],
        },
        'errors': errors,
        'provenance': {'measured': 'every number above, by `gh api` at captured_utc as the authenticated account',
                       'not_measured': ['deckwave.fm visits — GitHub Pages exposes no traffic API (verified 404 against a working control, 2026-09-06)',
                                        'demo presses — no instrument exists'],
                       'uniques_caveat': 'GitHub uniques are per-day and per-window; day uniques do not sum to window uniques'},
        'raw': {k: v for k, v in raw.items() if k != 'repo'},
        'raw_repo': {k: repo.get(k) for k in ('stargazers_count', 'forks_count', 'subscribers_count', 'pushed_at', 'updated_at', 'created_at')},
    }
    return out, errors


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--out', default=DEFAULT_OUT, help='directory for the dated file (default evidence/gh-traffic)')
    ap.add_argument('--print', action='store_true', help='print the capture to stdout and write nothing')
    a = ap.parse_args()
    out, errors = capture()
    if a.print:
        json.dump(out, sys.stdout, indent=1)
        print()
        return 1 if errors else 0
    os.makedirs(a.out, exist_ok=True)
    name = out['captured_utc'].replace(':', '').replace('-', '')[:13] + 'Z.json'   # 20261003T2239Z.json
    path = os.path.join(a.out, name)
    fd, tmp = tempfile.mkstemp(dir=a.out, suffix='.part')
    with os.fdopen(fd, 'w', encoding='utf-8', newline='\n') as f:
        json.dump(out, f, indent=1)
        f.write('\n')
    os.replace(tmp, path)                            # whole or not at all
    s = out['summary']
    print('gh-traffic: wrote %s  window %s..%s  views %s/%s  clones %s/%s  stars %s%s' % (
        path, out['window']['first_day'], out['window']['last_day'], s['views'], s['views_uniques'],
        s['clones'], s['clones_uniques'], s['stars'],
        ('  ERRORS ' + json.dumps(errors)) if errors else ''))
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
