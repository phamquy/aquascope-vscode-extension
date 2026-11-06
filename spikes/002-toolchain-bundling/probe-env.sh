#!/usr/bin/env bash
# T-007: which environment variables does the bundled toolchain actually need?
# Runs one fixture against work/toolchain-minimal with each variable removed in turn
# and compares the output with the full minimal run. Every probe uses a fresh crate
# in a new temporary directory; outputs are kept in work/results/probe-env/.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
work="$here/work"
bin="$work/install/bin"
tc="$work/toolchain-minimal"
ref="$work/results/minimal/01_move_string.json"
out="$work/results/probe-env"
[ -f "$ref" ] || { echo "run run.sh minimal first" >&2; exit 1; }
mkdir -p "$out" "$work/home-minimal" "$work/cargo-home-minimal"

full=(
  "HOME=$work/home-minimal"
  "CARGO_HOME=$work/cargo-home-minimal"
  "PATH=$bin:$tc/bin:/usr/bin:/bin"
  "SYSROOT=$tc"
  "DYLD_LIBRARY_PATH=$tc/lib"
  "LD_LIBRARY_PATH=$tc/lib"
)

probe() {
  local label="$1"
  shift
  local slug code crate
  slug="$(echo "$label" | tr -c 'A-Za-z0-9' '-')"
  crate="$(mktemp -d -t aquascope-probe)/example"
  mkdir -p "$crate/src"
  printf '[package]\nname = "example"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n' > "$crate/Cargo.toml"
  cp "$here/fixtures/programs/01_move_string.rs" "$crate/src/main.rs"
  set +e
  (cd "$crate" && env -i "$@" cargo aquascope permissions) > "$out/$slug.json" 2> "$out/$slug.log"
  code=$?
  set -e
  # Order-insensitive comparison: Aquascope's step tables are not emitted in a stable order.
  if [ "$code" -eq 0 ] && python3 -I -c '
import json, sys
def canon(o):
    if isinstance(o, dict): return {k: canon(v) for k, v in sorted(o.items())}
    if isinstance(o, list): return sorted((canon(x) for x in o), key=lambda x: json.dumps(x, sort_keys=True))
    return o
sys.exit(0 if canon(json.load(open(sys.argv[1]))) == canon(json.load(open(sys.argv[2]))) else 1)
' "$out/$slug.json" "$ref"; then
    echo "OK      $label"
  else
    echo "FAILS   $label (exit $code, $(wc -c < "$out/$slug.json" | tr -d ' ') bytes): $(grep -m1 -iE 'error|dyld|not found|panicked' "$out/$slug.log" | cut -c1-140)"
  fi
}

probe "all variables" "${full[@]}"
for drop in SYSROOT DYLD_LIBRARY_PATH LD_LIBRARY_PATH CARGO_HOME HOME; do
  kept=()
  for kv in "${full[@]}"; do
    [[ "$kv" == "$drop="* ]] || kept+=("$kv")
  done
  probe "without $drop" "${kept[@]}"
done
probe "PATH without toolchain bin" \
  "HOME=$work/home-minimal" "CARGO_HOME=$work/cargo-home-minimal" \
  "PATH=$bin:/usr/bin:/bin" "SYSROOT=$tc" "DYLD_LIBRARY_PATH=$tc/lib"
probe "only PATH and DYLD_LIBRARY_PATH" \
  "PATH=$bin:$tc/bin:/usr/bin:/bin" "DYLD_LIBRARY_PATH=$tc/lib"
