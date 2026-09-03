#!/usr/bin/env python3
"""Development server for Deckwave.

Deckwave needs a secure context: the File System Access API is unavailable
otherwise, so window.showDirectoryPicker is undefined and the app reports
"unsupported browser". http://localhost counts as secure; a LAN IP does not.
So local runs can be plain HTTP, and LAN runs need TLS.

    python tools/serve.py                     localhost only, HTTP,  port 8777
    python tools/serve.py --lan               all interfaces, HTTPS, port 8443
    python tools/serve.py --lan --port 9000   same, different port
    python tools/serve.py --lan --music DIR   also serve DIR read-only at /music/
    python tools/serve.py --stop              stop the one already running

Starting it twice is safe: the second invocation notices the first, says so,
and exits 0 rather than failing or — worse, and this is a Windows-specific
trap — binding the same port a second time. See ONE SERVER, below.

--lan requires a certificate. Generate one covering your LAN address, and keep
it OUTSIDE this repository so the private key can never be committed:

    openssl req -x509 -newkey rsa:2048 -nodes -days 825 \
      -keyout ../deckwave-tls/key.pem -out ../deckwave-tls/cert.pem \
      -config ../deckwave-tls/san.cnf

Point --certdir at wherever that lives. Self-signed means one browser warning
per device; proceeding past it makes the origin a real secure context.

WHAT THIS REFUSES TO SERVE
The repository contains its full git history and the original source archives.
Serving the working tree on a network hands both to anyone who finds the port,
which is source disclosure of unpublished work. Dotted paths and _source/ are
blocked here rather than left to the operator to remember.

ONE SERVER, AND A WINDOWS TRAP
http.server.HTTPServer sets allow_reuse_address = 1, which on Linux only
affects sockets in TIME_WAIT. WINDOWS IS DIFFERENT: SO_REUSEADDR there lets a
second process bind a port a LIVE process is already listening on. Both
sockets exist, which of them answers a given request is not defined, and
stopping one leaves the other serving. That looks exactly like a server that
will not die — the symptom that caused this to be written.

So reuse is off on Windows, and a start probes the port first: if Deckwave is
already answering there, this says so and exits 0 instead of stacking a second
copy. A PID file next to the system temp directory — never in the repo, which
is served — lets --stop find it.

WHAT IT SERVES, AND HOW
Content types come from MIME_TYPES below, not from the `mimetypes` module:
on Windows that module reads the registry, so what a .js file is served as
would depend on this machine's HKEY_CLASSES_ROOT. With `nosniff` on every
response, one bad registry entry refuses every module. The table wins.

/music/ answers a single `Range: bytes=a-b` with 206 so an interrupted
download of a multi-gigabyte library resumes. One range only; multi-range and
malformed ranges are ignored (200, per RFC 7233), unsatisfiable ones are 416,
`If-Range` is not honoured and no ETag is sent. Repo files have no Range
branch — they are kilobytes and nothing resumes them.
"""
import argparse
import atexit
import html
import http.server
import io
import os
import signal
import socket
import ssl
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
import zipfile

html_escape = html.escape

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# Never served, on any interface. Blocking at the handler rather than relying
# on the server being local means the rule survives someone adding --lan later.
DENY_DIRS = {"_source", "tools", "deckwave-patches"}
# Files .gitignore keeps out of the tree for a reason and nothing on the
# page ever fetches: the launch-day operator checklist (registrar ids,
# account names, private paths). Lower-case, slash-separated, repo-relative,
# compared against the RESOLVED path like everything else in _forbidden().
# (The runtime feeds — recon.jsonl, speech/, recon-shots/ — are also
# gitignored and ARE served: the console reads them.)
DENY_FILES = {"docs/runbook.md"}

# --music DIR: serve ONE music folder read-only at /music/ so a phone on the
# LAN can download tracks into its own storage (Safari -> Files -> On My
# iPhone). Off unless asked for. Only audio files and folders are listed,
# nothing is writable, and nothing outside DIR is reachable -- the path is
# resolved and checked against the real directory, the same discipline as
# _forbidden(). Your own files, over your own LAN, to your own phone.
MUSIC = None
# .opus and .aac joined 2026-09-03 (review, Low): a Commons Opus dropped into
# the music folder was invisible in the listing AND 403 on GET, which reads as
# a broken server rather than an unlisted extension.
AUDIO_EXT = (".flac", ".mp3", ".wav", ".aiff", ".m4a", ".ogg", ".opus", ".aac")

# THE CONTENT TYPES ARE OURS, NOT THE REGISTRY'S.
# SimpleHTTPRequestHandler asks `mimetypes`, and on Windows `mimetypes` reads
# HKEY_CLASSES_ROOT: the type a .js file is served as depends on what some
# installer last wrote into the registry of THIS machine. Combined with the
# `nosniff` header sent below, a box whose HKCR maps `.js` to `text/plain`
# refuses every module in assets/ and the page dies with no useful error.
# Not reproduced here — and that is exactly why it is worth removing as a
# variable rather than waiting to meet it on someone else's machine.
# This table wins; the registry is the fallback for anything not listed.
# `audio/ogg` is the registered type for .opus (RFC 7845 §9), not audio/opus.
MIME_TYPES = {
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".htm": "text/html; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".jsonl": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".md": "text/markdown; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".ico": "image/x-icon",
    ".webmanifest": "application/manifest+json",
    ".wasm": "application/wasm",
    ".mem": "application/octet-stream",
    ".onnx": "application/octet-stream",
    ".flac": "audio/flac", ".mp3": "audio/mpeg", ".wav": "audio/wav",
    ".aiff": "audio/aiff", ".m4a": "audio/mp4", ".ogg": "audio/ogg",
    ".opus": "audio/ogg", ".aac": "audio/aac",
}
AUDIO_TYPES = MIME_TYPES          # kept as the old name; one table now


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=REPO, **kw)

    # -- /music/ : the opt-in music root ----------------------------------
    def _music_path(self):
        """Filesystem path under MUSIC for a /music/... request, or None if the
        request is not for the music root or escapes it."""
        if not MUSIC:
            return None
        clean = urllib.parse.unquote(self.path.split("?", 1)[0].split("#", 1)[0])
        if clean != "/music" and not clean.startswith("/music/"):
            return None
        rel = clean[len("/music"):].lstrip("/")
        fs = os.path.realpath(os.path.join(MUSIC, *[p for p in rel.split("/") if p and p != "."]))
        root = os.path.realpath(MUSIC)
        if fs != root and not fs.startswith(root + os.sep):
            return False          # tried to leave the root
        return fs

    def translate_path(self, path):
        mp = self._music_path()
        if mp:
            return mp
        return super().translate_path(path)

    def _forbidden(self, path):
        # Decide on the path that will actually be OPENED, not on the request
        # string. The first version tested self.path raw, and was bypassed
        # two ways on 2026-08-19 (verified on a scratch port, not argued):
        #   /%2Egit/HEAD           percent-encoding — translate_path() unquotes
        #                          AFTER this check ran, so ".git" was never seen
        #   /TOOLS/serve.py        NTFS is case-insensitive; "TOOLS" != "tools"
        # Both returned 200 under --lan. translate_path() is what the handler
        # uses to find the file, so its answer is the only one worth testing;
        # relpath + lower() closes both holes at once. Traversal above REPO is
        # already impossible (translate_path normalises), but it is checked
        # here too rather than assumed.
        #
        # Third bypass, 2026-09-01 (review C1, ledger 122): NTFS 8.3 SHORT
        # NAMES. Every long name also answers to an alias — `.git` is
        # `GIT~1`, `deckwave-patches` is `DECKWA~1` — and the alias has no
        # leading dot and is not in DENY_DIRS, so /GIT~1/HEAD returned 200
        # while /.git/HEAD returned 403. Under --lan that was the whole
        # private history one request away. realpath() expands the alias to
        # the name the rules are written against; _music_path() always did
        # this and this function never did. Verified on a scratch port by
        # tools/check-serve.js, which fails without this line.
        #
        # relpath() raises ValueError for a path it cannot place on this
        # drive (\\.\NUL and friends: reserved device names, an embedded
        # NUL byte). A path the check cannot evaluate is refused, not
        # allowed to kill the handler thread.
        try:
            fs = os.path.realpath(self.translate_path(path))
            if "\x00" in fs:            # survives realpath; open() would raise past this check
                return True
            rel = os.path.relpath(fs, os.path.realpath(REPO)).replace("\\", "/").lower()
        except ValueError:
            return True
        if rel == ".." or rel.startswith("../"):
            return True
        parts = [p for p in rel.split("/") if p and p != "."]
        if any(p.startswith(".") for p in parts):      # .git, .gitignore, .claude, anything dotted
            return True
        if "/".join(parts) in DENY_FILES:
            return True
        return bool(parts) and parts[0] in DENY_DIRS

    def send_head(self):
        mp = self._music_path()
        if mp is False:
            self.send_error(403, "Not served")
            return None
        if mp:
            if os.path.isdir(mp):
                # a folder URL needs its trailing slash or the relative links
                # in the listing resolve one level too high
                if not self.path.split("?", 1)[0].endswith("/"):
                    self.send_response(301)
                    self.send_header("Location", self.path.split("?", 1)[0] + "/")
                    self.end_headers()
                    return None
                if self.path.split("?", 1)[-1] == "zip" and "?" in self.path:
                    return self._send_zip(mp)
                return self.list_directory(mp)
            if not mp.lower().endswith(AUDIO_EXT):
                self.send_error(403, "Only audio is served from /music/")
                return None
            return self._send_music_file(mp)
        if self._forbidden(self.path):
            self.send_error(403, "Not served")
            return None
        return super().send_head()

    # -- Range: one byte range, for a download that dropped ----------------
    @staticmethod
    def _parse_range(header, size):
        """(start, end) inclusive for a single satisfiable range,
        False when the range cannot be satisfied (caller sends 416),
        None when there is no range to honour (caller sends the whole file).

        RFC 7233 is explicit that a MALFORMED Range header must be IGNORED,
        not rejected — so a header this cannot read comes back None and the
        client gets 200, never 416. Multi-range (`bytes=0-9,20-29`) is also
        None: answering a multipart request with one part would be a wrong
        answer, and the spec permits ignoring it. `If-Range` is NOT honoured
        and this server sends no ETag; a file edited between two halves of a
        resumed download would be spliced. It is a LAN dev server serving a
        read-only folder, and that is the whole guarantee."""
        if not header or not header.strip().lower().startswith("bytes="):
            return None
        spec = header.split("=", 1)[1].strip()
        if "," in spec:
            return None
        if "-" not in spec:
            return None
        first, _, last = spec.partition("-")
        first, last = first.strip(), last.strip()
        try:
            if not first:                       # bytes=-N  (the last N bytes)
                n = int(last)
                if n <= 0:
                    return False
                if size == 0:
                    return False
                return (max(0, size - n), size - 1)
            start = int(first)
            end = int(last) if last else size - 1
        except ValueError:
            return None                         # unreadable -> ignore, not 416
        if start < 0 or end < start:
            return None
        if size == 0 or start >= size:
            return False
        return (start, min(end, size - 1))

    def _send_music_file(self, mp):
        """One audio file out of /music/, with single-range support.

        SimpleHTTPRequestHandler has no Range branch: it answers 200 with the
        whole body for every request, so a phone download that dies at 90 %
        restarts at byte zero. Whole-library downloads here are gigabytes over
        a LAN, which is precisely where a resume is worth having. The 200 path
        below is the base class's own (the file object is handed back for
        do_GET to copy); only 206 and 416 are written here, and 206 writes
        exactly `end - start + 1` bytes because copyfile() would run to EOF."""
        try:
            st = os.stat(mp)
            f = open(mp, "rb")
        except OSError:
            self.send_error(404, "No such file")
            return None
        size = st.st_size
        rng = self._parse_range(self.headers.get("Range"), size)

        if rng is False:
            f.close()
            self.send_response(416)
            self.send_header("Content-Range", "bytes */%d" % size)
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None

        ctype = self.guess_type(mp)
        if rng is None:
            self.send_response(200)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(size))
            self.send_header("Accept-Ranges", "bytes")
            self.send_header("Last-Modified", self.date_time_string(st.st_mtime))
            self.end_headers()
            return f                       # do_GET copies it; do_HEAD closes it

        start, end = rng
        self.send_response(206)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Range", "bytes %d-%d/%d" % (start, end, size))
        self.send_header("Content-Length", str(end - start + 1))
        self.send_header("Accept-Ranges", "bytes")
        self.send_header("Last-Modified", self.date_time_string(st.st_mtime))
        self.end_headers()
        if self.command == "HEAD":
            f.close()
            return None
        try:
            f.seek(start)
            left = end - start + 1
            while left > 0:
                chunk = f.read(min(65536, left))
                if not chunk:
                    break                  # file shrank under us; stop honestly
                self.wfile.write(chunk)
                left -= len(chunk)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass
        finally:
            f.close()
        return None

    def _audio_under(self, top):
        """Every audio file under `top`, recursively, as (abs path, arcname)."""
        out = []
        for root, dirs, files in os.walk(top):
            dirs.sort(key=str.lower)
            for n in sorted(files, key=str.lower):
                if n.lower().endswith(AUDIO_EXT):
                    full = os.path.join(root, n)
                    out.append((full, os.path.relpath(full, top).replace("\\", "/")))
        return out

    def _send_zip(self, top):
        """Stream every audio file under `top` as ONE uncompressed zip.

        "Can't you make a download all button?" -- on a phone, a page cannot
        start many downloads at once (each needs its own tap on iOS), but one
        zip is one tap, Safari saves it to Files, and Files unzips it in place.
        STORED, not deflated: FLAC is already compressed and the phone would
        wait on the PC's CPU for nothing. Written straight to the socket as it
        is read -- nothing is buffered, so a 4 GB library costs no memory --
        which means no Content-Length; the body is close-delimited (HTTP/1.0),
        which every browser's downloader handles. zip64 is on, because the
        whole library is past 4 GB."""
        files = self._audio_under(top)
        name = os.path.basename(os.path.normpath(top)) or "music"
        if os.path.realpath(top) == os.path.realpath(MUSIC):
            name = os.path.basename(os.path.normpath(MUSIC)) or "music"
        total = sum(os.path.getsize(p) for p, _ in files)
        self.send_response(200)
        self.send_header("Content-Type", "application/zip")
        self.send_header("Content-Disposition",
                         "attachment; filename=\"%s.zip\"" % name.replace('"', "'"))
        self.send_header("X-Deckwave-Zip-Files", str(len(files)))
        self.send_header("X-Deckwave-Zip-Bytes", str(total))
        self.end_headers()
        if self.command == "HEAD":
            return None
        try:
            with zipfile.ZipFile(self.wfile, "w", compression=zipfile.ZIP_STORED, allowZip64=True) as zf:
                for full, arc in files:
                    zf.write(full, arc)
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass              # the phone stopped the download; nothing to clean up
        return None

    def guess_type(self, path):
        ext = os.path.splitext(path)[1].lower()
        return MIME_TYPES.get(ext) or super().guess_type(path)

    def list_directory(self, path):
        mp = self._music_path()
        if not mp or not os.path.isdir(mp):
            # No directory indexes for the repo. Knowing the layout is half
            # of finding anything.
            self.send_error(403, "No directory listing")
            return None
        # The music root lists folders and audio files only, as plain links a
        # phone can tap. Downloading a link saves it to the phone's own files.
        try:
            names = sorted(os.listdir(mp), key=str.lower)
        except OSError:
            self.send_error(404, "No such folder")
            return None
        rel = os.path.relpath(mp, os.path.realpath(MUSIC)).replace("\\", "/")
        here = "/music/" if rel == "." else "/music/" + urllib.parse.quote(rel) + "/"
        rows = []
        # one tap for the lot: everything under this folder, recursively, as a
        # single stored zip that the Files app unzips in place
        all_files = self._audio_under(mp)
        if all_files:
            gb = sum(os.path.getsize(p) for p, _ in all_files) / 1073741824.0
            rows.append('<li class=all><a href="?zip" download>&#11015; download all %d tracks in this folder '
                        'as one zip</a> <small>%.2f GB, uncompressed &mdash; tap the zip in Files to unpack it</small></li>'
                        % (len(all_files), gb))
        if rel != ".":
            rows.append('<li><a href="../">../</a></li>')
        for n in names:
            full = os.path.join(mp, n)
            if os.path.isdir(full):
                rows.append('<li><a href="%s/">%s/</a></li>' % (urllib.parse.quote(n), html_escape(n)))
            elif n.lower().endswith(AUDIO_EXT):
                size = os.path.getsize(full)
                rows.append('<li><a href="%s" download>%s</a> <small>%.1f MB</small></li>'
                            % (urllib.parse.quote(n), html_escape(n), size / 1048576.0))
        body = ("<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'>"
                "<title>deckwave music</title><style>body{font:15px/1.8 -apple-system,system-ui,sans-serif;"
                "margin:16px;background:#04010f;color:#cfc8ff}a{color:#22e8ff;text-decoration:none}"
                "small{color:#7d6eb0}ul{padding-left:1em}li.all{margin-bottom:10px;padding:8px;border:1px solid #22125c;border-radius:6px;list-style:none}</style>"
                "<h3>%s</h3><p>Tap a track to download it to this device "
                "(Files &rarr; Downloads). Read-only.</p><ul>%s</ul>" % (html_escape(here), "".join(rows)))
        data = body.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        return io.BytesIO(data)

    def end_headers(self):
        # No caching. Editing a module and reloading should show the edit —
        # stale assets cost real debugging time during this project.
        self.send_header("Cache-Control", "no-store, must-revalidate")
        self.send_header("X-Content-Type-Options", "nosniff")
        # How a second invocation recognises US rather than some other service
        # that happens to hold the port. Without it, "something answered on
        # 8777" would be taken as proof, and it is not.
        self.send_header("X-Deckwave-Serve", "1")
        super().end_headers()

    def log_message(self, fmt, *args):
        sys.stderr.write("%s %s\n" % (self.address_string(), fmt % args))


def pidfile_for(port):
    # Temp, not the repo: anything in the working tree is served, and a stray
    # pid file surviving a hard kill should not become a tracked artefact.
    return os.path.join(tempfile.gettempdir(), "deckwave-serve-%d.pid" % port)


def probe(port, scheme="http"):
    """Is a Deckwave server already answering here? Returns its pid, or None.

    Identity comes from the X-Deckwave-Serve header, not from "the port is
    busy" — the port being busy says nothing about who has it."""
    url = "%s://127.0.0.1:%d/" % (scheme, port)
    try:
        req = urllib.request.Request(url, method="HEAD")
        ctx = ssl._create_unverified_context() if scheme == "https" else None
        with urllib.request.urlopen(req, timeout=1.5, context=ctx) as r:
            if r.headers.get("X-Deckwave-Serve") != "1":
                return None
    except urllib.error.HTTPError as e:
        if e.headers.get("X-Deckwave-Serve") != "1":
            return None
    except Exception:
        return None
    try:
        with open(pidfile_for(port)) as f:
            return int(f.read().strip())
    except Exception:
        return -1          # ours, but we cannot name the process


def stop(port, scheme="http"):
    pid = probe(port, scheme)
    if pid is None:
        print("nothing of ours on port %d" % port)
        return 0
    if pid == -1:
        print("a Deckwave server holds port %d but left no pid file - "
              "stop it in the terminal that owns it" % port)
        return 1
    try:
        os.kill(pid, signal.SIGTERM)
    except OSError as e:
        print("could not stop pid %d: %s" % (pid, e))
        return 1
    try:
        os.remove(pidfile_for(port))
    except OSError:
        pass
    print("stopped pid %d on port %d" % (pid, port))
    return 0


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("8.8.8.8", 80))
        return s.getsockname()[0]
    except Exception:
        return "127.0.0.1"
    finally:
        s.close()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--lan", action="store_true",
                    help="bind all interfaces over HTTPS (needs a certificate)")
    ap.add_argument("--port", type=int, default=None)
    ap.add_argument("--certdir", default=os.path.join(os.path.dirname(REPO), "deckwave-tls"))
    ap.add_argument("--stop", action="store_true",
                    help="stop the Deckwave server already on this port")
    ap.add_argument("--music", default=None, metavar="DIR",
                    help="also serve DIR read-only at /music/ (audio files and folders only), "
                         "so a phone on the LAN can download tracks into its own storage")
    args = ap.parse_args()

    global MUSIC
    if args.music:
        MUSIC = os.path.realpath(args.music)
        if not os.path.isdir(MUSIC):
            sys.exit("--music: not a directory: %s" % MUSIC)

    port = args.port or (8443 if args.lan else 8777)
    host = "0.0.0.0" if args.lan else "127.0.0.1"
    scheme = "https" if args.lan else "http"

    if args.stop:
        sys.exit(stop(port, scheme))

    # Idempotent start. Restarting the app should not require anyone to know
    # whether a server is already up, and must never leave two of them.
    running = probe(port, scheme)
    if running is not None:
        print("Deckwave is already serving on %s://127.0.0.1:%d/ - reusing it"
              % (scheme, port))
        # The hint has to carry the port, or it names a DIFFERENT server: --stop
        # is port-scoped, so a bare --stop from a custom-port session targets
        # 8777 and reports "nothing of ours" while this one keeps running.
        print("  stop it with: python tools/serve.py --stop"
              + (" --lan" if args.lan else "")
              + (" --port %d" % port if args.port is not None else ""))
        return

    # See ONE SERVER in the module docstring: on Windows this default lets a
    # second process bind a port a live one already holds.
    if os.name == "nt":
        http.server.ThreadingHTTPServer.allow_reuse_address = False

    try:
        httpd = http.server.ThreadingHTTPServer((host, port), Handler)
    except OSError as e:
        sys.exit("port %d is held by something that is not Deckwave (%s)" % (port, e))

    pf = pidfile_for(port)
    with open(pf, "w") as f:
        f.write(str(os.getpid()))
    atexit.register(lambda: os.path.exists(pf) and os.remove(pf))
    # SIGTERM is how --stop asks -- ON POSIX. This handler makes the atexit
    # hook run there so the pid file is removed by the process that wrote it.
    #
    # ON WINDOWS IT NEVER RUNS, and the comment here used to claim it did.
    # os.kill(pid, SIGTERM) on Windows is TerminateProcess: the process is
    # killed by the kernel, no signal is delivered, no handler fires, no
    # atexit hook runs. Nothing is lost, because stop() removes the pid file
    # itself after the kill -- but the cleanup on this platform is the
    # CALLER's, not this line's, and a reader should not have to find that
    # out from the OS. Corrected 2026-09-03 (review, Tools/Low).
    signal.signal(signal.SIGTERM, lambda *_: sys.exit(0))

    if args.lan:
        cert = os.path.join(args.certdir, "cert.pem")
        key = os.path.join(args.certdir, "key.pem")
        if not (os.path.exists(cert) and os.path.exists(key)):
            sys.exit("no certificate in %s - see the header of this file" % args.certdir)
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(cert, key)
        httpd.socket = ctx.wrap_socket(httpd.socket, server_side=True)
        print("serving %s over HTTPS" % REPO)
        print("  https://localhost:%d/" % port)
        print("  https://%s:%d/     <- other machines on the LAN" % (lan_ip(), port))
        print("self-signed: one certificate warning per device, then proceed")
        print("REACHABLE ON YOUR NETWORK. Stop it when you are done testing.")
    else:
        print("serving %s over HTTP" % REPO)
        print("  http://127.0.0.1:%d/     (localhost only)" % port)

    print("not served: dotted paths, %s, %s" % (", ".join(sorted(DENY_DIRS)), ", ".join(sorted(DENY_FILES))))
    print("Ctrl-C to stop")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
