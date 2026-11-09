"""Summarises T-051's probe results: python3 -I report.py <results folder>."""
import collections
import json
import re
import sys
from pathlib import Path

results = Path(sys.argv[1])
rows = [line.split("\t") for line in (results / "summary.tsv").read_text().splitlines()[1:]]


def outcome(case: str) -> str:
    text = (results / f"{case}.json").read_text().strip()
    if not text:
        return "no output"
    try:
        value = json.loads(text)
    except json.JSONDecodeError:
        return "not JSON"
    if "Err" in value:
        return f"Err {json.dumps(value['Err'])}"
    trace = value["Ok"]
    steps = trace["steps"]
    per_file = collections.Counter(s["stack"]["frames"][-1].get("file_path", "?") for s in steps)
    depth = max((len(s["stack"]["frames"]) for s in steps), default=0)
    names = sorted({f["name"] for s in steps for f in s["stack"]["frames"]})
    # A step whose current frame is not in the binary's file, with a frame of the binary's file below it.
    below = any(
        len(s["stack"]["frames"]) > 1
        and s["stack"]["frames"][0].get("file_path", "").endswith("main.rs")
        and not s["stack"]["frames"][-1].get("file_path", "").endswith("main.rs")
        for s in steps
    )
    result = trace["result"]["type"]
    if result != "Success":
        result += f" {json.dumps(trace['result'].get('value'))}"
    files = ", ".join(f"{f} {n}" for f, n in sorted(per_file.items()))
    return (
        f"{len(steps)} steps ({files}); result {result}; deepest stack {depth}; "
        f"main below another file's frame: {'yes' if below else 'no'}; frames: {', '.join(names)}"
    )


def reason(case: str) -> str:
    """The interpreter's error (change 5), a panic, or the compiler's first error, from stderr."""
    log = (results / f"{case}.log").read_text()
    for pattern in (r"aquascope interpreter: .*", r"panicked at .*\n.*", r"error(\[E\d+\])?: .*"):
        m = re.search(pattern, log)
        if m:
            return m.group(0).replace("\n", " ")
    return ""


print(f"{'case':24} {'exit':>4} {'ms':>7} {'bytes':>8}  outcome")
for case, code, ms, size in rows:
    print(f"{case:24} {code:>4} {ms:>7} {size:>8}  {outcome(case)}")
    why = reason(case)
    if why:
        print(f"{'':48}  stderr: {why[:220]}")
checks = results / "checks.txt"
if checks.exists():
    print()
    print(checks.read_text().strip())
