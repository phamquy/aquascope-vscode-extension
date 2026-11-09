"""T-044: summarises probe.sh's results (feature 008).

    python3 -I spikes/008-whole-crate/report.py <results folder>

For each run: exit code, time, the results Aquascope returned (Ok and Err), the files they name, whether
any result holds ranges from more than one file, how many compiled crates the run wrote, and cargo's first
error.
"""
import csv
import json
import re
import sys
from pathlib import Path

results = Path(sys.argv[1])


def file_indices(value, found):
    """Every file index in a result, wherever a range sits in it."""
    if isinstance(value, dict):
        if "private_use_as_methods_instead" in value and len(value) == 1:
            found.add(value["private_use_as_methods_instead"])
        for v in value.values():
            file_indices(v, found)
    elif isinstance(value, list):
        for v in value:
            file_indices(v, found)
    return found


print("Copies (D1):")
with open(results / "copies.tsv") as f:
    for row in csv.DictReader(f, delimiter="\t"):
        print(f"  {row['project']:<14} {row['run']:<5} {row['files']:>6} files {int(row['bytes']) / 1e6:8.2f} MB  copied {row['copied']:>6}  deleted {row['deleted']}  {row['ms']:>6} ms")
print((results / "lock.txt").read_text().strip())
print()
print("Runs:")
with open(results / "summary.tsv") as f:
    for row in csv.DictReader(f, delimiter="\t"):
        case = row["case"]
        out = (results / f"{case}.json").read_text()
        log = (results / f"{case}.log").read_text()
        line = f"  {case:<26} exit {row['exit']:>3} {row['ms']:>6} ms  wrote {row['written']:>3}  lock {row['lock_after']}"
        # A run over several crates writes one JSON list per crate, back to back.
        docs, decoder, i = [], json.JSONDecoder(), 0
        try:
            while i < len(out):
                while i < len(out) and out[i].isspace():
                    i += 1
                if i < len(out):
                    doc, i = decoder.raw_decode(out, i)
                    docs.append(doc)
        except json.JSONDecodeError:
            docs = []
        if len(docs) > 1:
            line += f"  {len(docs)} JSON documents, of {[len(d) for d in docs]} results"
        data = [e for d in docs for e in d] if docs and all(isinstance(d, list) for d in docs) else (docs[0] if docs else None)
        if isinstance(data, list):
            ok = [e["Ok"] for e in data if "Ok" in e]
            errs = [e["Err"] for e in data if "Err" in e]
            paths = sorted({o.get("file_path", "?") for o in ok})
            mixed = sum(1 for o in ok if len(file_indices(o, set())) > 1)
            steps = sum(len(o["steps"]) for o in ok)
            line += f"  ok {len(ok)} (steps {steps})  err {len(errs)}  mixed-file results {mixed}  files {paths}"
            if errs:
                line += f"  errors {sorted({json.dumps(e, sort_keys=True) for e in errs})}"
        elif data is not None:
            line += f"  output {json.dumps(data)[:120]}"
        else:
            line += f"  stdout {len(out)} bytes"
        first_error = next((l.strip() for l in log.splitlines() if re.search(r"\berror\b|panicked", l)), "")
        if first_error:
            line += f"\n      first error: {first_error[:200]}"
        print(line)
