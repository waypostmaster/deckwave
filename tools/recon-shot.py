#!/usr/bin/env python3
"""Put a frame on the RECON stage — the agent-side half of the viewport.

    python tools/recon-shot.py shot.png --url https://example.com/x \\
        --title "the page" --note "found it - the answer is in the sidebar" \\
        --status "reading" --link https://a.example --link https://b.example
    python tools/recon-shot.py shot.png --url ... --print   # do not append

WHAT THIS IS FOR. RECON sees nothing by itself: it does not screenshot,
scrape or navigate. Whatever is driving the browser takes the picture and
hands it over, and this script is the handing-over — it copies the image
into `recon-shots/` under a name the page's SHOTPATH regex will accept, and
appends one feed line naming it.

THE NAME IS REGENERATED, NOT CLEANED. The page matches
`^recon-shots/[A-Za-z0-9._-]+\\.(png|jpe?g|webp)$` rather than sanitising a
fed string, so this writes a name of exactly that shape (timestamp + a hash
of the image bytes) instead of trusting the original filename. A file whose
name would not match is not renamed into something that does by accident —
it is given a fresh one, and the original is left alone.

`--note` is ONE OR TWO LINES IN YOUR OWN WORDS, never a page body. There is
no field for page text anywhere in this pipeline, deliberately: it would
turn the feed into a scraper log and the screen into a copyright hazard.

`recon-shots/` is gitignored, like `speech/` — these are runtime artefacts
of one session, not part of the tree.
"""
import argparse, hashlib, json, os, shutil, sys, time

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, 'recon-shots')
FEED = os.path.join(ROOT, 'recon.jsonl')
OK_EXT = {'.png': '.png', '.jpg': '.jpg', '.jpeg': '.jpg', '.webp': '.webp'}


def main():
    ap = argparse.ArgumentParser(description='put a frame on the RECON stage')
    ap.add_argument('image', help='the screenshot to stage (png/jpg/webp)')
    ap.add_argument('--url', default='', help='the page it is a picture of')
    ap.add_argument('--title', default='', help='the page title')
    ap.add_argument('--note', default='', help='one or two lines IN YOUR WORDS — never a page body')
    ap.add_argument('--status', default='', help='what you are doing right now, a few words')
    ap.add_argument('--link', action='append', default=[], help='an outbound link (repeatable, max 12)')
    ap.add_argument('--source', default='web', help='the badge on the row (reddit, web, file, …)')
    ap.add_argument('--event', default='', help='a DWEVENTS intent to inject as the record lands')
    ap.add_argument('--speak', default='', help='words to read aloud over the music')
    ap.add_argument('--print', dest='dry', action='store_true',
                    help='print the line instead of appending it (the image is still copied)')
    a = ap.parse_args()

    if not os.path.isfile(a.image):
        print('no such file: %s' % a.image, file=sys.stderr)
        return 1
    ext = OK_EXT.get(os.path.splitext(a.image)[1].lower())
    if not ext:
        print('the stage renders png, jpg and webp only (got %s)'
              % (os.path.splitext(a.image)[1] or 'no extension'), file=sys.stderr)
        return 1

    os.makedirs(SHOTS, exist_ok=True)
    stamp = time.strftime('%Y%m%d-%H%M%S', time.gmtime())
    # The tag hashes the image BYTES, not the source path. The first cut
    # hashed the path, and the common driver pattern reuses one temp path
    # (shot.png) - two stagings inside a second produced the same name and
    # the second frame silently overwrote the first while both feed lines
    # still pointed at it (ledger 86). Content-hashed, two different frames
    # can never share a name; the same frame re-staged overwrites itself
    # with identical bytes, which is harmless.
    with open(a.image, 'rb') as fh:
        tag = hashlib.sha256(fh.read()).hexdigest()[:10]
    name = 'shot-%s-%s%s' % (stamp, tag, ext)
    shutil.copyfile(a.image, os.path.join(SHOTS, name))

    rec = {'ts': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
           'source': a.source[:16],
           'title': a.title[:160],
           # the page strips query strings again on ingest; strip here too so
           # what lands in the file is what the operator would want copied
           'url': a.url.split('?')[0],
           'note': a.note,
           'shot': 'recon-shots/' + name}
    if a.status:
        rec['status'] = a.status[:80]
    if a.link:
        rec['links'] = [l.split('?')[0][:120] for l in a.link[:12]]
    if a.event:
        rec['event'] = a.event[:24]
    if a.speak:
        rec['speak'] = a.speak[:2000]

    line = json.dumps(rec, ensure_ascii=False)
    if a.dry:
        print(line)
    else:
        with open(FEED, 'a', encoding='utf-8') as f:
            f.write(line + '\n')
        print('staged  recon-shots/%s  ->  recon.jsonl' % name)
    return 0


if __name__ == '__main__':
    sys.exit(main())
