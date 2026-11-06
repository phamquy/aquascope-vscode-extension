#!/usr/bin/env bash
# T-006 / T-007: run `cargo aquascope permissions` on every fixture.
#
#   run.sh baseline   full rustup nightly, normal environment
#   run.sh minimal    work/toolchain-minimal only, scrubbed environment (env -i)
#   run.sh trimmed    work/toolchain-trimmed (see measure-bundle.sh), same environment
#
# Results go to work/results/<mode>/: <fixture>.json (stdout), <fixture>.log (stderr)
# and summary.tsv (fixture, exit code, seconds, output bytes).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=pin.env
source "$here/pin.env"
mode="${1:?usage: run.sh baseline|minimal}"
work="$here/work"
bin="$work/install/bin"
out="$work/results/$mode"
[ -x "$bin/cargo-aquascope" ] || { echo "run build.sh first" >&2; exit 1; }

case "$mode" in
  baseline)
    sysroot="$(rustup run "$RUST_NIGHTLY" rustc --print sysroot)"
    libdir="$(rustup run "$RUST_NIGHTLY" rustc --print target-libdir)"
    # Mirrors the mdBook preprocessor, except SYSROOT is the plain toolchain
    # sysroot instead of a Miri sysroot (the permissions analysis does not use Miri).
    run_env=(env
      RUSTUP_TOOLCHAIN="$RUST_NIGHTLY"
      SYSROOT="$sysroot"
      DYLD_LIBRARY_PATH="$libdir"
      LD_LIBRARY_PATH="$libdir"
      PATH="$bin:$PATH")
    ;;
  minimal|trimmed)
    tc="$work/toolchain-$mode"
    [ -x "$tc/bin/rustc" ] || { echo "missing $tc: run assemble-toolchain.sh (and measure-bundle.sh for trimmed)" >&2; exit 1; }
    mkdir -p "$work/home-minimal" "$work/cargo-home-minimal"
    # Nothing from the caller's environment survives. /usr/bin and /bin stay on
    # PATH for the system linker (cc); they contain no Rust tools.
    run_env=(env -i
      HOME="$work/home-minimal"
      CARGO_HOME="$work/cargo-home-minimal"
      PATH="$bin:$tc/bin:/usr/bin:/bin"
      SYSROOT="$tc"
      DYLD_LIBRARY_PATH="$tc/lib"
      LD_LIBRARY_PATH="$tc/lib"
      RUST_BACKTRACE=1)
    ;;
  *)
    echo "unknown mode $mode" >&2
    exit 1
    ;;
esac

rm -rf "$out"
mkdir -p "$out"
# Stage crates outside $HOME so no ancestor .cargo/config.toml applies.
stage="$(mktemp -d -t aquascope-spike)"
trap 'rm -rf "$stage"' EXIT
printf 'fixture\texit\tseconds\tbytes\n' > "$out/summary.tsv"

run_one() {
  local name="$1" dir="$2" flags=()
  [[ "$name" == *_fail ]] && flags=(--should-fail)
  local start end code
  start="$(date +%s)"
  set +e
  # ${flags[@]+...} keeps an empty array safe under set -u in macOS's bash 3.2.
  (cd "$dir" && "${run_env[@]}" cargo aquascope ${flags[@]+"${flags[@]}"} permissions) \
    > "$out/$name.json" 2> "$out/$name.log"
  code=$?
  set -e
  end="$(date +%s)"
  printf '%s\t%s\t%s\t%s\n' "$name" "$code" "$((end - start))" \
    "$(wc -c < "$out/$name.json" | tr -d ' ')" >> "$out/summary.tsv"
  echo "$mode $name exit=$code $((end - start))s"
}

for f in "$here"/fixtures/programs/*.rs; do
  name="$(basename "$f" .rs)"
  dir="$stage/$name"
  mkdir -p "$dir/src"
  printf '[package]\nname = "example"\nversion = "0.1.0"\nedition = "2021"\n\n[dependencies]\n' > "$dir/Cargo.toml"
  cp "$f" "$dir/src/main.rs"
  run_one "$name" "$dir"
done

for d in "$here"/fixtures/crates/*/; do
  name="$(basename "$d")"
  cp -R "$d" "$stage/$name"
  run_one "$name" "$stage/$name"
done

column -t "$out/summary.tsv"
