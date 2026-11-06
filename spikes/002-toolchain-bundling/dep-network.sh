#!/usr/bin/env bash
# T-008: what do crates with dependencies need from the network and the system?
#
# 1. with-dep, empty CARGO_HOME, online           -> what gets downloaded
# 2. with-dep, same CARGO_HOME, offline           -> does a warm cache suffice
# 3. with-dep, new empty CARGO_HOME, offline      -> does a cold cache fail
# 4. with-proc-macro, no system linker on PATH    -> do build scripts/proc macros need cc
# 5. with-dep, no system linker on PATH           -> does a plain dependency need cc
# Outputs go to work/results/dep-network/.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
work="$here/work"
bin="$work/install/bin"
tc="$work/toolchain-minimal"
out="$work/results/dep-network"
[ -x "$tc/bin/rustc" ] || { echo "run assemble-toolchain.sh first" >&2; exit 1; }
mkdir -p "$out"

stage_crate() {
  local dir
  dir="$(mktemp -d -t aquascope-dep)/$1"
  cp -R "$here/fixtures/crates/$1" "$dir"
  echo "$dir"
}

run() {
  local label="$1" crate="$2" cargo_home="$3" path="$4"
  shift 4
  local code start end
  start="$(date +%s)"
  set +e
  (cd "$crate" && env -i HOME="$cargo_home" CARGO_HOME="$cargo_home" PATH="$path" \
    DYLD_LIBRARY_PATH="$tc/lib" LD_LIBRARY_PATH="$tc/lib" "$@" cargo aquascope permissions) \
    > "$out/$label.json" 2> "$out/$label.log"
  code=$?
  set -e
  end="$(date +%s)"
  printf '%-34s exit=%-3s %3ss  %s\n' "$label" "$code" "$((end - start))" \
    "$(grep -m1 -iE '^error|linker|not found|failed to' "$out/$label.log" | cut -c1-120)"
}

describe_cache() {
  local home="$1"
  printf '    cache: %s, crate archives: %s, index entries: %s\n' \
    "$(du -sh "$home" | cut -f1)" \
    "$(find "$home/registry/cache" -name '*.crate' 2>/dev/null | wc -l | tr -d ' ')" \
    "$(find "$home/registry/index" -type f 2>/dev/null | wc -l | tr -d ' ')"
}

full_path="$bin:$tc/bin:/usr/bin:/bin"
no_cc_path="$bin:$tc/bin"

home1="$(mktemp -d -t aquascope-cargo-home)"
run "1-with-dep-online-cold" "$(stage_crate with-dep)" "$home1" "$full_path"
describe_cache "$home1"
run "2-with-dep-offline-warm" "$(stage_crate with-dep)" "$home1" "$full_path" CARGO_NET_OFFLINE=true

home2="$(mktemp -d -t aquascope-cargo-home)"
run "3-with-dep-offline-cold" "$(stage_crate with-dep)" "$home2" "$full_path" CARGO_NET_OFFLINE=true

home3="$(mktemp -d -t aquascope-cargo-home)"
run "4-with-proc-macro-no-cc" "$(stage_crate with-proc-macro)" "$home3" "$no_cc_path"
run "5-with-dep-no-cc" "$(stage_crate with-dep)" "$home1" "$no_cc_path" CARGO_NET_OFFLINE=true
