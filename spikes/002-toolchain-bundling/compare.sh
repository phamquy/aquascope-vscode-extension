#!/usr/bin/env bash
# T-007: compare two result sets (default: work/results/baseline vs work/results/minimal).
#
#   compare.sh [A] [B]   result directory names under work/results
#
# SAME       identical JSON
# REORDERED  identical once every list is sorted (Aquascope's step tables are not
#            emitted in a stable order, so this is expected run to run)
# DIFFERS    different content
# Exits non-zero only if something DIFFERS or is missing.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
a="${1:-baseline}"
b="${2:-minimal}"
python3 -I - "$here/work/results/$a" "$here/work/results/$b" <<'EOF'
import json, os, sys

def canon(o):
    if isinstance(o, dict):
        return {k: canon(v) for k, v in sorted(o.items())}
    if isinstance(o, list):
        return sorted((canon(x) for x in o), key=lambda x: json.dumps(x, sort_keys=True))
    return o

base_dir, other_dir = sys.argv[1], sys.argv[2]
names = sorted(f[:-5] for f in os.listdir(base_dir) if f.endswith(".json"))
counts = {"SAME": 0, "REORDERED": 0, "DIFFERS": 0, "MISSING": 0}
for name in names:
    other = os.path.join(other_dir, name + ".json")
    if not os.path.exists(other):
        status = "MISSING"
    else:
        x = json.load(open(os.path.join(base_dir, name + ".json")))
        y = json.load(open(other))
        status = "SAME" if x == y else "REORDERED" if canon(x) == canon(y) else "DIFFERS"
    counts[status] += 1
    print(f"{status:<10} {name}")
print(", ".join(f"{k.lower()} {v}" for k, v in counts.items()))
sys.exit(1 if counts["DIFFERS"] or counts["MISSING"] else 0)
EOF
