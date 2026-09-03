#!/usr/bin/env python3
"""Who has the con.

NAMED helm.py, NOT con.py, and that is not taste: CON is a RESERVED DEVICE
NAME on Windows, so CON.anything cannot be opened by the Win32 API. git could
not add the file at all -- `open("tools/con.py"): No such file or directory`
while bash read it happily, because MSYS and Win32 resolve the path
differently. Committed from a machine that allowed it, it would have made the
repository UNCHECKOUTABLE on Windows. Same reason the state file is
.helm.json. (PRN, AUX, NUL, COM1-9 and LPT1-9 are the rest of that family.)

WHY THIS EXISTS. More than one Claude session works in this tree at once. On
2026-08-30 that cost real time three separate ways, all the same shape --
something read or wrote the tree while something else was doing so:

  * a release package was cut while another session had index.html half
    written, and sealed that work-in-progress into the zip (ledger 112);
  * `git add -A` swept three lines of another session's in-flight edit into a
    commit under the wrong message (ledger 112's fourth instance);
  * a stash/pop cycle was run across a tree another session was writing to --
    it restored cleanly, and it did not have to.

WHAT THIS IS, STATED HONESTLY. **A convention with a timestamp, not a lock.**
Nothing enforces it. A session that never runs `status` will never know the
con is held, and nothing in git, the filesystem or the harness will stop it.
It is a paragraph that asks, and CLAUDE.md is explicit that a gate which
refuses beats one of those -- so do not mistake a held con for safety. What it
DOES give you is the thing that was actually missing: a single place to look
that answers "is anyone else mid-surgery in here, and on what."

It is deliberately advisory rather than a real lock because the failure it
guards against is two agents being helpful at once, not malice, and a lock
that can wedge a launch is worse than a note that can be ignored.

  python tools/helm.py status
  python tools/helm.py take "deckwave launch prep" --who "session-name" [--hours 4]
  python tools/helm.py release
  python tools/helm.py take ... --force        # break glass; says who it broke

The file is `.helm.json` at the repo root and is GITIGNORED: it is per-machine
coordination state, not product, and it must never reach the public tree.
"""
import json, os, socket, sys, time
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CON = os.path.join(ROOT, ".helm.json")


def now():
    return datetime.now(timezone.utc)


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def read():
    if not os.path.exists(CON):
        return None
    try:
        with open(CON, encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        print("  .helm.json is unreadable (%s) -- treating as NOBODY holding it." % e)
        return None


def stale(rec):
    """Expired by its own declared window. Never auto-released: a stale con is
    reported, not silently taken, because 'the holder went quiet' and 'the
    holder is thinking' look identical from here."""
    try:
        exp = datetime.strptime(rec["expires"], "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
    except Exception:
        return True
    return now() > exp


def status(quiet=False):
    rec = read()
    if not rec:
        if not quiet:
            print("CON: free. Nobody holds it.")
        return 0
    age = rec.get("since", "?")
    s = stale(rec)
    if not quiet:
        print("CON: HELD by %s" % rec.get("who", "?"))
        print("  task    : %s" % rec.get("task", "?"))
        print("  since   : %s   expires: %s%s" % (age, rec.get("expires", "?"),
                                                  "   <-- EXPIRED" if s else ""))
        print("  host/pid: %s / %s" % (rec.get("host", "?"), rec.get("pid", "?")))
        if s:
            print("\n  This con is past its window. The holder may be gone, or may")
            print("  simply be slow -- those look identical from here. Ask first if")
            print("  you can; `take --force` if you cannot.")
        else:
            print("\n  Do NOT commit, cut a package, stash, or `git add -A` in this")
            print("  tree until it is released. Read-only work is fine.")
    return 2 if not s else 1


def take(task, who, hours, force):
    rec = read()
    if rec and not stale(rec) and not force:
        print("REFUSED: %s already has the con." % rec.get("who", "?"))
        print("  task : %s" % rec.get("task", "?"))
        print("  since: %s   expires: %s" % (rec.get("since", "?"), rec.get("expires", "?")))
        print("\nHand-over is the holder's to make: ask them to run")
        print("  python tools/helm.py release")
        print("Or, if they are unreachable and you accept the risk:")
        print("  python tools/helm.py take ... --force")
        return 1
    broke = None
    if rec and (force or stale(rec)):
        broke = {"who": rec.get("who"), "task": rec.get("task"), "since": rec.get("since"),
                 "reason": "expired" if stale(rec) else "forced"}
    t = now()
    out = {
        "who": who,
        "task": task,
        "since": iso(t),
        "expires": iso(t.replace(microsecond=0)) if hours <= 0 else
                   iso(datetime.fromtimestamp(t.timestamp() + hours * 3600, timezone.utc)),
        "host": socket.gethostname(),
        "pid": os.getpid(),
        "note": "Advisory only. See tools/helm.py. Release when you stop working in this tree.",
    }
    if broke:
        out["took_from"] = broke
    with open(CON, "w", encoding="utf-8") as f:
        json.dump(out, f, indent=2)
        f.write("\n")
    if broke:
        print("TOOK THE CON FROM %s (%s)." % (broke["who"], broke["reason"]))
        print("  their task: %s" % broke["task"])
        print("  Recorded in .helm.json as took_from -- tell them.")
    print("CON: held by %s until %s" % (who, out["expires"]))
    print("  task: %s" % task)
    return 0


def release():
    rec = read()
    if not rec:
        print("CON: already free. Nothing to release.")
        return 0
    os.remove(CON)
    print("CON: released by %s. It was held for '%s' since %s."
          % (rec.get("who", "?"), rec.get("task", "?"), rec.get("since", "?")))
    return 0


def main(argv):
    if len(argv) < 2 or argv[1] in ("-h", "--help", "help"):
        print(__doc__)
        return 0
    cmd = argv[1]
    if cmd == "status":
        return status()
    if cmd == "release":
        return release()
    if cmd == "take":
        # ONE PASS, AND A FLAG EATS ITS VALUE.
        # The first version collected positionals as "every token not starting
        # with --", which is true of `--who`'s VALUE as well. So
        #     helm.py take --who "session-name" "the task"
        # recorded task="session-name" and dropped the real task on the floor
        # -- the con said who held it and lied about what for, which is the
        # single question the file exists to answer. Argument order should not
        # decide whether the record is true.
        who, hours, task = "unnamed session", 4.0, None
        rest = argv[2:]
        i = 0
        while i < len(rest):
            a = rest[i]
            if a == "--who" and i + 1 < len(rest):
                who = rest[i + 1]; i += 2; continue
            if a == "--hours" and i + 1 < len(rest):
                try:
                    hours = float(rest[i + 1])
                except ValueError:
                    pass
                i += 2; continue
            if a.startswith("--"):
                i += 1; continue          # --force, and anything unrecognised
            if task is None:
                task = a
            i += 1
        return take(task or "(unstated)", who, hours, "--force" in rest)
    print("unknown command: %s (try status / take / release)" % cmd)
    return 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
