"""T-013 report: python3 -I report.py <results dir> <spike 002 baseline dir> <n1 fixture>."""
import json
import os
import re
import sys

results, baseline, n1_path = sys.argv[1:4]
PROGRAMS = ["01_move_string", "02_box_move", "03_borrow_then_push", "04_push_while_borrowed_fail", "05_method_mut_borrow"]
ERRORS = ["e1_type_error", "e2_unresolved_import", "e3_mod_other", "e4_mixed_errors", "e5_undeclared_crate_path"]


def canon(o):
    if isinstance(o, dict):
        return {k: canon(v) for k, v in sorted(o.items())}
    if isinstance(o, list):
        return sorted((canon(x) for x in o), key=lambda x: json.dumps(x, sort_keys=True))
    return o


def load(path):
    try:
        with open(path) as f:
            text = f.read()
        return json.loads(text) if text.strip() else None
    except (OSError, json.JSONDecodeError):
        return None


def compare(a_path, b_path):
    a, b = load(a_path), load(b_path)
    if a is None or b is None:
        return "MISSING"
    return "SAME" if a == b else "REORDERED" if canon(a) == canon(b) else "DIFFERS"


def summary(run):
    rows = {}
    with open(os.path.join(results, run, "summary.tsv")) as f:
        next(f)
        for line in f:
            name, code, ms = line.split()
            rows[name] = (int(code), int(ms))
    return rows


def shape(run, name):
    out = load(os.path.join(results, run, name + ".json"))
    if out is None:
        return "no JSON"
    parts = []
    for entry in out:
        if "Ok" in entry:
            r = entry["Ok"]["body_range"]
            parts.append(f"Ok@{r['start']['line']}-{r['end']['line']}")
        else:
            parts.append("Err:" + json.dumps(entry["Err"])[:120])
    return ", ".join(parts) or "[]"


def stderr_codes(run, name):
    with open(os.path.join(results, run, name + ".log")) as f:
        text = f.read()
    codes = sorted(set(re.findall(r"error\[(E\d{4})\]", text)))
    first = next((l.strip() for l in text.splitlines() if l.startswith("error")), "")
    return codes, first


def section(title):
    print(f"\n== {title}")


section("Q2: library crate (this run) vs spike 002 binary crate baseline")
for name in PROGRAMS:
    run = "flag" if name.endswith("_fail") else "noflag"
    print(f"{compare(os.path.join(baseline, name + '.json'), os.path.join(results, run, name + '.json')):<10} {name} ({run})")

section("Q1a: --should-fail vs no flag, code that compiles")
for name in PROGRAMS[:3] + PROGRAMS[4:] + ["n1_non_ascii"]:
    print(f"{compare(os.path.join(results, 'noflag', name + '.json'), os.path.join(results, 'flag', name + '.json')):<10} {name}")

section("Edition 2024 vs 2021 (both with --should-fail)")
for name in PROGRAMS + ["n1_non_ascii"]:
    print(f"{compare(os.path.join(results, 'flag', name + '.json'), os.path.join(results, 'flag-2024', name + '.json')):<10} {name}")

section("Q1b: errors, per run (exit code; stdout shape; stderr error codes; first error line)")
for run in ["noflag", "flag"]:
    rows = summary(run)
    for name in ["04_push_while_borrowed_fail"] + ERRORS:
        codes, first = stderr_codes(run, name)
        print(f"{run:<7} {name:<28} exit={rows[name][0]:<3} out=[{shape(run, name)}] codes={codes}")
        print(f"{'':<36} {first[:150]}")

section("R10: diagnostics from a plain cargo check of the same crate (errors only)")
rows = summary("diagnostics")
for name, (code, ms) in rows.items():
    found = []
    with open(os.path.join(results, "diagnostics", name + ".jsonl")) as f:
        for line in f:
            msg = json.loads(line)
            if msg.get("reason") == "compiler-message" and msg["message"]["level"] == "error":
                c = msg["message"].get("code") or {}
                found.append(f"{c.get('code') or '-'}: {msg['message']['message'][:70]}")
    print(f"{name:<28} exit={code:<3}")
    for item in found:
        print(f"{'':<30}{item}")

section("Non-ASCII columns (n1, line 3 is 0-based line 2)")
line = open(n1_path, encoding="utf-8").read().splitlines()[2]
out = load(os.path.join(results, "flag", "n1_non_ascii.json")) or []
cols = set()


def walk(o):
    if isinstance(o, dict):
        if set(o) >= {"line", "column"} and o["line"] == 2:
            cols.add(o["column"])
        for v in o.values():
            walk(v)
    elif isinstance(o, list):
        for v in o:
            walk(v)


walk(out)
print("line:", line)
for token in ["let t", "t = s", "= s;", "let u", "&t", "println"]:
    i = line.index(token)
    print(f"  {token!r:<10} chars={i:<3} utf16={len(line[:i].encode('utf-16-le')) // 2:<3} bytes={len(line[:i].encode('utf-8'))}")
print("reported columns on that line:", sorted(cols))

section("R4: user cargo config in a parent directory")
rows = summary("config")
with open(os.path.join(results, "config", "targets.tsv")) as f:
    targets = {l.split()[0]: " ".join(l.split()[1:]) for l in f if l.strip()}
for name, (code, ms) in rows.items():
    codes, first = stderr_codes("config", name)
    print(f"{name:<15} exit={code:<3} {targets.get(name, '')}  out=[{shape('config', name)[:60]}]")
    if first:
        print(f"{'':<15} {first[:150]}")
with open(os.path.join(results, "config", "wrapper.log")) as f:
    print("wrapper stderr mentions fail-wrapper:", "fail-wrapper" in f.read())

section("Timing (ms, fresh crate per run)")
for run in ["noflag", "flag", "flag-2024", "diagnostics", "config"]:
    rows = summary(run)
    ms = [v[1] for v in rows.values()]
    print(f"{run:<10} min={min(ms)} max={max(ms)} " + " ".join(f"{n[:3]}={v[1]}" for n, v in rows.items()))
