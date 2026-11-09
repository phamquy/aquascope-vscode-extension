#!/usr/bin/env bash
# T-044: analysing a file with the rest of its crate (feature 008, D1 to D4, R6 to R10).
#
#   bash spikes/008-whole-crate/probe.sh
#
# On the first run, builds a prototype of the fork into work/install: pin.env's tag plus fork-probe.patch,
# which adds `--crate-of <file>` (rustc_plugin's CrateContainingFile filter, D2) and a `file_path` on each
# result (D3). It then copies the fixture projects into work/copies with copy.mjs, the prototype of D1's
# copy, and runs the prototype on the copies with spike 002's trimmed toolchain, in the environment feature
# 003's runner sets. HOME is kept, so cargo uses the user's own cache, and CARGO_NET_OFFLINE stays set (D5).
# Results: work/results/<case>.json (stdout) and .log (stderr), copies.tsv (copy timings), summary.tsv (one
# line per run, with the compiled artifacts the run wrote, which shows whether dependencies were rebuilt)
# and, from report.py, report.txt.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../.." && pwd)"
spike2="$repo/spikes/002-toolchain-bundling"
# shellcheck source=../002-toolchain-bundling/pin.env
source "$spike2/pin.env"
work="$here/work"
install="$work/install"
tc="$spike2/work/toolchain-trimmed"
copies="$work/copies"
targets="$work/targets"
results="$work/results"

if [ ! -x "$tc/bin/cargo" ]; then
  echo "run spike 002 first (build.sh, assemble-toolchain.sh, measure-bundle.sh)" >&2
  exit 1
fi
if [ ! -x "$install/bin/cargo-aquascope" ]; then
  fork="$work/aquascope"
  [ -d "$fork/.git" ] || git clone --quiet --depth 1 --branch "$AQUASCOPE_TAG" "$AQUASCOPE_REPO" "$fork"
  git -C "$fork" checkout --quiet -- .
  git -C "$fork" apply "$here/fork-probe.patch"
  CARGO_TARGET_DIR="$work/target-build" cargo +"$RUST_NIGHTLY" install --locked --force \
    --path "$fork/crates/aquascope_front" --root "$install"
fi
bin="$install/bin"

rm -rf "$copies" "$targets" "$results"
mkdir -p "$copies" "$targets" "$results"
printf 'project\trun\tfiles\tbytes\tcopied\tdeleted\tms\n' > "$results/copies.tsv"
printf 'case\texit\tms\tstdout_bytes\tlock_after\twritten\n' > "$results/summary.tsv"

now_ms() { python3 -c 'import time; print(int(time.time() * 1000))'; }

# copy_project <name> <source>: a cold copy, then a second, warm one with nothing changed.
copy_project() {
  local name="$1" source="$2" run line
  for run in cold warm; do
    line="$(node "$here/copy.mjs" "$source" "$copies/$name")"
    python3 -I -c 'import json, sys; d = json.loads(sys.argv[3]); print("\t".join([sys.argv[1], sys.argv[2]] + [str(d[k]) for k in ("files", "bytes", "copied", "deleted", "ms")]))' \
      "$name" "$run" "$line" >> "$results/copies.tsv"
  done
}

# aquascope <case> <dir> <target> <path> [args...]: `cargo aquascope <args>` in <dir>, with <path> as PATH.
aquascope() {
  local case="$1" dir="$2" target="$3" path="$4" start code lock written
  shift 4
  mkdir -p "$target"
  touch "$target/.probe-marker"
  start="$(now_ms)"
  set +e
  (cd "$dir" && env -i HOME="$HOME" PATH="$path" DYLD_LIBRARY_PATH="$tc/lib" CARGO_NET_OFFLINE=true \
    RUSTC_WRAPPER= CARGO_ENCODED_RUSTFLAGS= CARGO_TARGET_DIR="$target" cargo aquascope "$@") \
    > "$results/$case.json" 2> "$results/$case.log" < /dev/null
  code=$?
  set -e
  lock=no
  [ -f "$dir/Cargo.lock" ] && lock=yes
  # Compiled crates this run wrote: none means every dependency was reused.
  written="$(find "$target" -newer "$target/.probe-marker" -type f \( -name '*.rmeta' -o -name '*.rlib' -o -name '*.dylib' \) | wc -l | tr -d ' ')"
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$case" "$code" "$(( $(now_ms) - start ))" "$(wc -c < "$results/$case.json" | tr -d ' ')" "$lock" "$written" >> "$results/summary.tsv"
  echo "$case exit=$code"
}

# check <case> <dir>: a plain `cargo check` of the copy, for the compiler's own errors.
check() {
  (cd "$2" && env -i HOME="$HOME" PATH="$tc/bin:/usr/bin:/bin" DYLD_LIBRARY_PATH="$tc/lib" CARGO_NET_OFFLINE=true \
    CARGO_TARGET_DIR="$targets/check-$1" cargo check --message-format=json) > "$results/$1.check.jsonl" 2> "$results/$1.check.log" || true
}

# metadata <case> <dir>: what feature 008's project module will read (T-046).
metadata() {
  (cd "$2" && env -i HOME="$HOME" PATH="$tc/bin:/usr/bin:/bin" DYLD_LIBRARY_PATH="$tc/lib" CARGO_NET_OFFLINE=true \
    cargo metadata --no-deps --offline --format-version 1) > "$results/$1.metadata.json" 2> /dev/null || true
}

with_cc="$bin:$tc/bin:/usr/bin:/bin"
without_cc="$bin:$tc/bin:/bin" # cc is /usr/bin/cc

# D1: copying. The fixtures, and Aquascope's own source as a larger real project.
for p in minigrep with-dep serde-derive workspace proc-macro missing-dep external-path targets; do
  copy_project "$p" "$here/fixtures/$p"
done
if [ -d "$repo/build/aquascope-src" ]; then copy_project aquascope-src "$repo/build/aquascope-src"; fi

m="$copies/minigrep"
had_lock=no
[ -f "$m/Cargo.lock" ] && had_lock=yes
echo "minigrep copy has Cargo.lock before the first run: $had_lock" > "$results/lock.txt"

# D3, D4 and the repeat runs: a module of the library, then the binary, each run twice.
aquascope minigrep-lib-1 "$m" "$targets/minigrep" "$with_cc" --crate-of "$m/src/config.rs" permissions
aquascope minigrep-lib-2 "$m" "$targets/minigrep" "$with_cc" --crate-of "$m/src/config.rs" permissions
aquascope minigrep-bin-1 "$m" "$targets/minigrep" "$with_cc" --crate-of "$m/src/main.rs" permissions
aquascope minigrep-bin-2 "$m" "$targets/minigrep" "$with_cc" --crate-of "$m/src/main.rs" permissions
touch "$m/src/main.rs"
aquascope minigrep-bin-touched "$m" "$targets/minigrep" "$with_cc" --crate-of "$m/src/main.rs" permissions
# D2: the same crate analysed as part of the whole workspace, Aquascope's default.
aquascope minigrep-all "$m" "$targets/minigrep-all" "$with_cc" permissions
# R10: a file of an integration test.
aquascope minigrep-test-file "$m" "$targets/minigrep" "$with_cc" --crate-of "$m/tests/cli.rs" permissions
# R8: a compile error in another file of the crate.
node "$here/copy.mjs" "$here/fixtures/minigrep" "$copies/minigrep-broken" > /dev/null
sed -i '' 's/found.into_iter().map(String::from).collect()/found.into_iter().map(String::from).missing_method()/' "$copies/minigrep-broken/src/lib.rs"
aquascope minigrep-broken "$copies/minigrep-broken" "$targets/minigrep-broken" "$with_cc" --crate-of "$copies/minigrep-broken/src/config.rs" permissions
check minigrep-broken "$copies/minigrep-broken"

# D4, D6: a crates.io dependency from the user's cache, without and with preload.
d="$copies/with-dep"
aquascope with-dep-cold "$d" "$targets/with-dep-a" "$with_cc" --crate-of "$d/src/lib.rs" permissions
aquascope with-dep-warm "$d" "$targets/with-dep-a" "$with_cc" --crate-of "$d/src/lib.rs" permissions
aquascope with-dep-preload "$d" "$targets/with-dep-b" "$with_cc" preload
aquascope with-dep-after-preload "$d" "$targets/with-dep-b" "$with_cc" --crate-of "$d/src/lib.rs" permissions

# D4, D6, R7: serde with derive, whose proc macro cargo builds from crates.io; then without a linker.
sd="$copies/serde-derive"
aquascope serde-cold "$sd" "$targets/serde-a" "$with_cc" --crate-of "$sd/src/lib.rs" permissions
aquascope serde-warm "$sd" "$targets/serde-a" "$with_cc" --crate-of "$sd/src/lib.rs" permissions
aquascope serde-preload "$sd" "$targets/serde-b" "$with_cc" preload
aquascope serde-after-preload "$sd" "$targets/serde-b" "$with_cc" --crate-of "$sd/src/lib.rs" permissions
aquascope serde-no-cc "$sd" "$targets/serde-c" "$without_cc" --crate-of "$sd/src/lib.rs" permissions

# D7, R10: every kind of target: the library (with a #[cfg(test)] module), a build script, an example, a
# bench and an integration test.
t="$copies/targets"
for f in src/lib.rs build.rs examples/demo.rs benches/speed.rs tests/it.rs; do
  aquascope "targets-$(echo "$f" | tr '/.' '--')" "$t" "$targets/targets" "$with_cc" --crate-of "$t/$f" permissions
done

# D2: one member of a workspace, against the whole workspace.
w="$copies/workspace"
aquascope workspace-app-1 "$w" "$targets/workspace-a" "$with_cc" --crate-of "$w/app/src/lib.rs" permissions
aquascope workspace-app-2 "$w" "$targets/workspace-a" "$with_cc" --crate-of "$w/app/src/lib.rs" permissions
aquascope workspace-all "$w" "$targets/workspace-b" "$with_cc" permissions

# D1: a path dependency outside the package's own workspace; the copy holds both folders.
e="$copies/external-path"
aquascope external-path "$e/app" "$targets/external-path" "$with_cc" --crate-of "$e/app/src/lib.rs" permissions

# R7: a proc macro without a linker, then with one.
pm="$copies/proc-macro"
aquascope proc-macro-no-cc "$pm" "$targets/proc-macro-a" "$without_cc" --crate-of "$pm/app/src/lib.rs" permissions
aquascope proc-macro-cc "$pm" "$targets/proc-macro-b" "$with_cc" --crate-of "$pm/app/src/lib.rs" permissions

# R6: a dependency in no cache, offline.
aquascope missing-dep "$copies/missing-dep" "$targets/missing-dep" "$with_cc" --crate-of "$copies/missing-dep/src/lib.rs" permissions

for c in minigrep workspace external-path with-dep proc-macro targets; do
  sub=""
  case "$c" in workspace | proc-macro | external-path) sub=/app ;; esac
  metadata "$c" "$copies/$c$sub"
done

# Captures for the extension's unit tests (T-046 to T-049), with this machine's folders replaced: the copies'
# folder by /copies and the home folder by ~, so the test data holds no path of the machine that made it.
data="$repo/src/test/fixtures/data/crate"
mkdir -p "$data"
capture() {
  sed -e "s#$copies#/copies#g" -e "s#$HOME#~#g" "$results/$1" > "$data/$2"
}
for c in minigrep workspace external-path with-dep proc-macro targets; do capture "$c.metadata.json" "$c.metadata.json"; done
capture minigrep-lib-1.json minigrep-config.json
capture workspace-app-1.json workspace-app.json
capture minigrep-broken.json minigrep-broken.json
capture minigrep-broken.check.jsonl minigrep-broken.check.jsonl
capture missing-dep.log missing-dep.stderr
capture serde-no-cc.log serde-no-cc.stderr
capture proc-macro-no-cc.log proc-macro-no-cc.stderr
capture targets-build-rs.log build-rs.stderr

python3 -I "$here/report.py" "$results" | tee "$results/report.txt"
