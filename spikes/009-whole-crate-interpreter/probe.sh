#!/usr/bin/env bash
# T-051: running a whole program in Aquascope's interpreter (feature 009, D3 to D5, and the plan's one-crate
# build).
#
#   bash spikes/009-whole-crate-interpreter/probe.sh
#
# On the first run, clones the pinned fork into work/aquascope, applies fork-probe.patch (the plan's six
# changes, as a prototype: `interpreter --allow-io`, `--miri-build`, `--main <file>` and `-- <args>`, a
# `file_path` on each frame, the interpreter's error on stderr, and reading string literals, `&str` into
# arrays and trait objects, spec D7) and installs it into work/install. It
# copies each fixture project into work/copies and runs the prototype there with spike 002's trimmed toolchain
# and a Miri-built standard library (PROBE_MIRI_SYSROOT, by default spike 007's work/miri-sysroot), in the
# environment feature 003's runner sets plus MIRI_SYSROOT. HOME is kept and CARGO_NET_OFFLINE stays set.
# Results: work/results/<case>.json (stdout) and .log (stderr), summary.tsv (one line per run) and, from
# report.py, report.txt.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
spike2="$repo/spikes/002-toolchain-bundling"
# shellcheck source=../002-toolchain-bundling/pin.env
source "$spike2/pin.env"
work="$here/work"
install="$work/install"
tc="$spike2/work/toolchain-trimmed"
sysroot="${PROBE_MIRI_SYSROOT:-$repo/spikes/007-interpreter/work/miri-sysroot}"
copies="$work/copies"
targets="$work/targets"
results="$work/results"

if [ ! -x "$tc/bin/cargo" ]; then
  echo "run spike 002 first (build.sh, assemble-toolchain.sh, measure-bundle.sh)" >&2
  exit 1
fi
if [ ! -d "$sysroot/lib/rustlib" ]; then
  echo "no Miri standard library in $sysroot; run spike 007's probe first, or set PROBE_MIRI_SYSROOT" >&2
  exit 1
fi
if [ ! -x "$install/bin/cargo-aquascope" ]; then
  fork="$work/aquascope"
  [ -d "$fork/.git" ] || git clone --quiet --depth 1 --branch "$AQUASCOPE_TAG" "$AQUASCOPE_REPO" "$fork"
  if [ "$(git -C "$fork" rev-parse HEAD)" != "$AQUASCOPE_COMMIT" ]; then
    echo "work/aquascope is not at the pinned $AQUASCOPE_COMMIT ($AQUASCOPE_TAG); delete it to clone the pin" >&2
    exit 1
  fi
  if git -C "$fork" diff --quiet; then git -C "$fork" apply "$here/fork-probe.patch"; fi
  CARGO_TARGET_DIR="$work/target-build" cargo +"$RUST_NIGHTLY" install --locked --force \
    --path "$fork/crates/aquascope_front" --root "$install"
fi
bin="$install/bin"

rm -rf "$copies" "$targets" "$results"
mkdir -p "$copies" "$targets" "$results"
for p in "$here"/fixtures/*/; do cp -R "${p%/}" "$copies/"; done
printf 'case\texit\tms\tstdout_bytes\n' > "$results/summary.tsv"

now_ms() { python3 -c 'import time; print(int(time.time() * 1000))'; }
tool_env=(env -i HOME="$HOME" PATH="$bin:$tc/bin:/usr/bin:/bin" DYLD_LIBRARY_PATH="$tc/lib" CARGO_NET_OFFLINE=true
  RUSTC_WRAPPER= CARGO_ENCODED_RUSTFLAGS= MIRI_SYSROOT="$sysroot")

# The pinned fork, without the prototype's changes, for comparison.
pinned_env=(env -i HOME="$HOME" PATH="$spike2/work/install/bin:$tc/bin:/usr/bin:/bin" DYLD_LIBRARY_PATH="$tc/lib"
  CARGO_NET_OFFLINE=true RUSTC_WRAPPER= CARGO_ENCODED_RUSTFLAGS= MIRI_SYSROOT="$sysroot")

# run <case> <project> <target> [args...]: `cargo aquascope <args>` in work/copies/<project>, with
# work/targets/<target> as the build folder.
run() {
  local case="$1" dir="$copies/$2" target="$targets/$3" start code
  shift 3
  start="$(now_ms)"
  set +e
  (cd "$dir" && "${tool_env[@]}" CARGO_TARGET_DIR="$target" cargo aquascope "$@") \
    > "$results/$case.json" 2> "$results/$case.log" < /dev/null
  code=$?
  set -e
  printf '%s\t%s\t%s\t%s\n' "$case" "$code" "$(( $(now_ms) - start ))" "$(wc -c < "$results/$case.json" | tr -d ' ')" >> "$results/summary.tsv"
  echo "$case exit=$code"
}

# run_pinned <case> <project> <target> [args...]: `run` with the pinned fork.
run_pinned() {
  local saved=("${tool_env[@]}")
  tool_env=("${pinned_env[@]}")
  run "$@"
  tool_env=("${saved[@]}")
}

# check <case> <project>: a plain `cargo check` of the copy, as the extension's classification runs it.
check() {
  set +e
  (cd "$copies/$2" && "${tool_env[@]}" CARGO_TARGET_DIR="$targets/check-$2" cargo check --message-format=json) \
    > "$results/$1.check.jsonl" 2> "$results/$1.check.log"
  echo "$1 check exit=$?" | tee -a "$results/checks.txt"
  set -e
}

# metadata <project>: what feature 008's project module reads, for T-053.
metadata() {
  (cd "$copies/$1" && "${tool_env[@]}" cargo metadata --no-deps --offline --format-version 1) \
    > "$results/$1.metadata.json" 2> /dev/null || true
}

fold=(--crate-of src/lib.rs interpreter --miri-build --allow-io --main src/main.rs)

# minigrep: the binary alone, with the compiler's usual settings and then with Miri's (change 2); the one-crate
# build, first and later runs; the program stopping; isolation kept; a missing file; one crate without Miri's
# settings; and an edit between runs.
run mg-bin-plain minigrep-book mg-plain --crate-of src/main.rs interpreter --allow-io -- frog poem.txt
run mg-bin-miri minigrep-book mg-miri --crate-of src/main.rs interpreter --miri-build --allow-io -- frog poem.txt
run mg-fold-1 minigrep-book mg-fold "${fold[@]}" -- frog poem.txt
run mg-fold-2 minigrep-book mg-fold "${fold[@]}" -- frog poem.txt
run mg-fold-no-args minigrep-book mg-fold "${fold[@]}"
run mg-fold-no-io minigrep-book mg-fold --crate-of src/lib.rs interpreter --miri-build --main src/main.rs -- frog poem.txt
run mg-fold-missing-file minigrep-book mg-fold "${fold[@]}" -- frog missing.txt
run mg-fold-quoted minigrep-book mg-fold "${fold[@]}" -- "a frog" poem.txt
run mg-fold-plain minigrep-book mg-fold-plain --crate-of src/lib.rs interpreter --allow-io --main src/main.rs -- frog poem.txt
sed -i '' 's/let query = args\[1\].clone();/let query = args[1].to_uppercase();/' "$copies/minigrep-book/src/config.rs"
run mg-fold-edited minigrep-book mg-fold "${fold[@]}" -- frog poem.txt
sed -i '' 's/let query = args\[1\].to_uppercase();/let query = args[1].clone();/' "$copies/minigrep-book/src/config.rs"

# A binary with modules and no library: everything is in one crate already.
run bm-plain bin-modules bm-plain --crate-of src/main.rs interpreter --allow-io
run bm-miri bin-modules bm-miri --crate-of src/main.rs interpreter --miri-build --allow-io

# A crates.io dependency, vendored: with the compiler's usual settings, then Miri's, first and later runs.
run bd-plain bin-dep bd-plain --crate-of src/main.rs interpreter --allow-io
run bd-miri-1 bin-dep bd-miri --crate-of src/main.rs interpreter --miri-build --allow-io
run bd-miri-2 bin-dep bd-miri --crate-of src/main.rs interpreter --miri-build --allow-io

# The binary's own `crate::` paths under the one-crate build, then the binary alone, and whether cargo
# compiles the package (the fallback's condition).
run bcp-fold bin-crate-paths bcp "${fold[@]}"
run bcp-bin bin-crate-paths bcp --crate-of src/main.rs interpreter --miri-build --allow-io
check bcp bin-crate-paths

# A binary member using a library member, reading names.txt at the workspace root.
run wb-plain workspace-bin wb-plain --crate-of app/src/main.rs interpreter --allow-io
run wb-miri workspace-bin wb-miri --crate-of app/src/main.rs interpreter --miri-build --allow-io

# A string literal, with the pinned fork (feature 007's interpreter today) and with the prototype.
run_pinned lit-pinned literal lit-pinned interpreter
run lit-proto literal lit-proto --crate-of src/main.rs interpreter --miri-build --allow-io

# Two binaries: the one under src/bin, then src/main.rs, each with the library as one crate.
run tb-fold-whisper two-bins tb --crate-of src/lib.rs interpreter --miri-build --allow-io --main src/bin/whisper.rs
run tb-fold-main two-bins tb "${fold[@]}"

for p in minigrep-book two-bins bin-modules workspace-bin; do metadata "$p"; done

# Captures for the extension's unit tests (T-053 to T-055), with this machine's folders replaced: the copies'
# folder by /copies and the home folder by ~, so the test data holds no path of the machine that made it.
data="$repo/src/test/fixtures/data/stack-heap-crate"
mkdir -p "$data"
capture() {
  sed -e "s#$copies#/copies#g" -e "s#$HOME#~#g" "$results/$1" > "$data/$2"
}
for p in minigrep-book two-bins workspace-bin; do capture "$p.metadata.json" "$p.metadata.json"; done
capture mg-fold-1.json minigrep-fold.json
capture mg-fold-no-args.json minigrep-no-args.json
capture mg-fold-no-args.log minigrep-no-args.stderr
capture wb-miri.json workspace-bin.json
capture bcp-fold.log bin-crate-paths-fold.stderr

python3 -I "$here/report.py" "$results" | tee "$results/report.txt"
