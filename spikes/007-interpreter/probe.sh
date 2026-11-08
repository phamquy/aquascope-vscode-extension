#!/usr/bin/env bash
# T-036: what Aquascope's interpreter returns for failing programs, and how its output grows with loops
# (feature 007, D4 and D6).
#
#   bash spikes/007-interpreter/probe.sh
#
# Uses spike 002's binaries (work/install/bin) and trimmed toolchain (work/toolchain-trimmed), plus a
# Miri-built standard library in work/miri-sysroot, built here with `cargo +<nightly> miri setup` on the
# first run (needs rustup's pinned nightly with miri and rust-src, and the network). Each program runs as
# src/main.rs of a fresh binary crate, in the environment feature 003's runner sets plus MIRI_SYSROOT.
# Results: work/results/<name>.json (stdout), .log (stderr), .check.jsonl (`cargo check` stdout, for the
# cases without a trace) and summary.tsv (name, exit, ms, stdout bytes). report.py summarises them.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
spike2="$repo/spikes/002-toolchain-bundling"
# shellcheck source=../002-toolchain-bundling/pin.env
source "$spike2/pin.env"
bin="$spike2/work/install/bin"
tc="$spike2/work/toolchain-trimmed"
work="$here/work"
sysroot="$work/miri-sysroot"
timeout_s=20
if [ ! -x "$bin/cargo-aquascope" ] || [ ! -x "$tc/bin/cargo" ]; then
  echo "run spike 002 first (build.sh, assemble-toolchain.sh, measure-bundle.sh)" >&2
  exit 1
fi
mkdir -p "$work/home" "$work/cargo-home" "$work/results" "$work/programs"
if [ ! -d "$sysroot/lib/rustlib" ]; then
  echo "building the Miri standard library into $sysroot"
  MIRI_SYSROOT="$sysroot" cargo +"$RUST_NIGHTLY" miri setup
fi
echo "Miri standard library: $(du -sh "$sysroot" | cut -f1)"
stage="$(mktemp -d -t aquascope-007)" # outside $HOME, so no user cargo config applies; left for the OS

base_env=(env -i
  HOME="$work/home"
  CARGO_HOME="$work/cargo-home"
  PATH="$bin:$tc/bin:/usr/bin:/bin"
  DYLD_LIBRARY_PATH="$tc/lib"
  CARGO_NET_OFFLINE=true
  MIRI_SYSROOT="$sysroot")

now_ms() { python3 -c 'import time; print(int(time.time() * 1000))'; }

# Generated programs: loops of growing length, one that keeps the heap the same size and one that grows it.
for n in 10 100 1000 3000; do
  printf '// %s iterations, heap unchanged.\nfn main() {\n    let mut sum = 0;\n    for i in 0..%s {\n        sum += i;\n    }\n    println!("{sum}");\n}\n' "$n" "$n" > "$work/programs/l_sum_$n.rs"
done
for n in 10 100 300; do
  printf '// %s iterations, one heap element more each time.\nfn main() {\n    let mut v = Vec::new();\n    for i in 0..%s {\n        v.push(i);\n    }\n    println!("{}", v.len());\n}\n' "$n" "$n" > "$work/programs/l_vec_$n.rs"
done
# Calls to a function of the program's own, in a loop and recursively: steps inside callees count.
for n in 10 100 1000; do
  printf '// %s calls to a two-statement function in a loop.\nfn add(a: u64, b: u64) -> u64 {\n    let c = a + b;\n    c\n}\n\nfn main() {\n    let mut sum = 0;\n    for i in 0..%s {\n        sum = add(sum, i);\n    }\n    println!("{sum}");\n}\n' "$n" "$n" > "$work/programs/l_call_$n.rs"
done
for n in 10 100; do
  printf '// Recursion %s deep.\nfn fact(n: u64) -> u64 {\n    if n == 0 {\n        return 1;\n    }\n    let rest = fact(n - 1);\n    n.wrapping_mul(rest)\n}\n\nfn main() {\n    let f = fact(%s);\n    println!("{f}");\n}\n' "$n" "$n" > "$work/programs/r_fact_$n.rs"
done

# run_one <program file>: the interpreter, then `cargo check` when there is no trace.
run_one() {
  local file="$1" name dir start code out
  name="$(basename "$file" .rs)"
  dir="$stage/$name"
  out="$work/results"
  mkdir -p "$dir/src"
  printf '[package]\nname = "aquascope_scratch"\nversion = "0.0.0"\nedition = "2024"\n\n[[bin]]\nname = "aquascope_scratch"\npath = "src/main.rs"\n\n[workspace]\n' > "$dir/Cargo.toml"
  cp "$file" "$dir/src/main.rs"
  start="$(now_ms)"
  set +e
  # perl's alarm stands in for coreutils' timeout, which macOS lacks. perl comes before env: macOS strips
  # DYLD_* variables from the environment of system binaries such as /usr/bin/perl, so env must set them.
  (cd "$dir" && perl -e "alarm $timeout_s; exec @ARGV" "${base_env[@]}" CARGO_TARGET_DIR="$dir/target" cargo aquascope interpreter) \
    > "$out/$name.json" 2> "$out/$name.log" < /dev/null
  code=$?
  # The alarm stops cargo only; a driver still interpreting an endless program is stopped here.
  pkill -f "$dir/" 2> /dev/null || true
  set -e
  printf '%s\t%s\t%s\t%s\n' "$name" "$code" "$(( $(now_ms) - start ))" "$(wc -c < "$out/$name.json" | tr -d ' ')" >> "$out/summary.tsv"
  if ! grep -q '"Ok"' "$out/$name.json"; then
    (cd "$dir" && "${base_env[@]}" CARGO_TARGET_DIR="$dir/target-check" cargo check --message-format=json) \
      > "$out/$name.check.jsonl" 2> /dev/null || true
  fi
  echo "$name exit=$code"
}

rm -f "$work/results/summary.tsv"
for f in "$here"/programs/*.rs "$work"/programs/*.rs \
  "$repo"/src/test/fixtures/workspace/0{1,2,3,4,5}_*.rs "$repo"/src/test/fixtures/workspace/n1_non_ascii.rs; do
  run_one "$f"
done
python3 -I "$here/report.py" "$work/results" | tee "$work/report.txt"
