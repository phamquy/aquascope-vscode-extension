#!/usr/bin/env bash
# T-013: settle feature 003's open questions with spike 002's build.
#
#   Q1  Is --should-fail safe on every run, and what does it do with errors that are not borrow errors?
#   Q2  Does a single-file library crate give the same results as spike 002's binary crates?
#   R4  Do the planned environment overrides neutralise a user's cargo configuration?
#
# Uses spike 002's binaries (work/install/bin) and trimmed toolchain (work/toolchain-trimmed).
# Results: work/results/<run>/<fixture>.json (stdout), .log (stderr), summary.tsv (fixture, exit, ms).
# The report from report.py goes to stdout and work/report.txt.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
spike2="$(cd "$here/../002-toolchain-bundling" && pwd)"
# shellcheck source=../002-toolchain-bundling/pin.env
source "$spike2/pin.env"
bin="$spike2/work/install/bin"
tc="$spike2/work/toolchain-trimmed"
work="$here/work"
if [ ! -x "$bin/cargo-aquascope" ] || [ ! -x "$tc/bin/cargo" ]; then
  echo "run spike 002 first (build.sh, assemble-toolchain.sh, measure-bundle.sh)" >&2
  exit 1
fi
mkdir -p "$work/home" "$work/cargo-home" "$work/results"
# Staged outside $HOME so the user's ~/.cargo/config.toml is not found by ancestor search.
# Left for the OS to clean up.
stage="$(mktemp -d -t aquascope-003)"

# The environment feature 003's runner will set (R4, R5), on a scrubbed base.
base_env=(env -i
  HOME="$work/home"
  CARGO_HOME="$work/cargo-home"
  PATH="$bin:$tc/bin:/usr/bin:/bin"
  DYLD_LIBRARY_PATH="$tc/lib"
  LD_LIBRARY_PATH="$tc/lib"
  CARGO_NET_OFFLINE=true)

now_ms() { python3 -c 'import time; print(int(time.time() * 1000))'; }

# make_crate <dir> <edition> <source>: the temporary crate R2 describes.
make_crate() {
  mkdir -p "$1/src"
  printf '[package]\nname = "aquascope_scratch"\nversion = "0.0.0"\nedition = "%s"\n\n[lib]\npath = "src/lib.rs"\n\n[workspace]\n' "$2" > "$1/Cargo.toml"
  cp "$3" "$1/src/lib.rs"
}

# run_one <run> <name> <crate dir> <should-fail: yes|no> [NAME=VALUE ...]
run_one() {
  local run="$1" name="$2" dir="$3" flag="$4" out start code
  shift 4
  out="$work/results/$run"
  local flags=()
  [ "$flag" = yes ] && flags=(--should-fail)
  start="$(now_ms)"
  set +e
  (cd "$dir" && "${base_env[@]}" "$@" cargo aquascope ${flags[@]+"${flags[@]}"} permissions) \
    > "$out/$name.json" 2> "$out/$name.log"
  code=$?
  set -e
  printf '%s\t%s\t%s\n' "$name" "$code" "$(( $(now_ms) - start ))" >> "$out/summary.tsv"
  echo "$run $name exit=$code"
}

start_run() {
  mkdir -p "$work/results/$1"
  printf 'fixture\texit\tms\n' > "$work/results/$1/summary.tsv"
}

sources=("$spike2"/fixtures/programs/*.rs "$here"/fixtures/*.rs)

# Q1, Q2 and the edition check: every fixture as src/lib.rs of a fresh crate, with the
# R4 overrides set as the runner will set them.
for spec in "noflag 2021 no" "flag 2021 yes" "flag-2024 2024 yes"; do
  read -r run edition flag <<< "$spec"
  start_run "$run"
  for f in "${sources[@]}"; do
    name="$(basename "$f" .rs)"
    dir="$stage/$run/$name"
    make_crate "$dir" "$edition" "$f"
    run_one "$run" "$name" "$dir" "$flag" \
      RUSTC_WRAPPER= CARGO_ENCODED_RUSTFLAGS= CARGO_TARGET_DIR="$dir/target"
  done
done

# R10: Aquascope runs rustc with a silent diagnostics session, so its stderr carries no
# compiler errors (only MIR dumps). Collect them with a plain cargo check of the same crate.
start_run diagnostics
for name in 04_push_while_borrowed_fail e1_type_error e2_unresolved_import e3_mod_other e4_mixed_errors e5_undeclared_crate_path; do
  dir="$stage/noflag/$name"
  start="$(now_ms)"
  set +e
  (cd "$dir" && "${base_env[@]}" RUSTC_WRAPPER= CARGO_ENCODED_RUSTFLAGS= CARGO_TARGET_DIR="$dir/target" \
    cargo check --message-format=json) > "$work/results/diagnostics/$name.jsonl" 2> "$work/results/diagnostics/$name.log"
  code=$?
  set -e
  printf '%s\t%s\t%s\n' "$name" "$code" "$(( $(now_ms) - start ))" >> "$work/results/diagnostics/summary.tsv"
  echo "diagnostics $name exit=$code"
done

# R4: a parent directory's .cargo/config.toml stands in for the user's ~/.cargo/config.toml.
# One setting per case without overrides shows each one's effect; the last case sets all
# three and applies the overrides.
start_run config
: > "$work/results/config/targets.tsv"
cat > "$stage/fail-wrapper.sh" <<'EOF'
#!/bin/sh
echo "fail-wrapper: the user's rustc-wrapper ran" >&2
exit 1
EOF
chmod +x "$stage/fail-wrapper.sh"
wrapper_cfg="rustc-wrapper = \"$stage/fail-wrapper.sh\""
rustflags_cfg='rustflags = ["-Dwarnings"]'
for case in wrapper rustflags target-dir all-overridden; do
  parent="$stage/config/$case"
  mkdir -p "$parent/.cargo"
  target_cfg="target-dir = \"$parent/shared-target\""
  case "$case" in
    wrapper) body="$wrapper_cfg" ;;
    rustflags) body="$rustflags_cfg" ;;
    target-dir) body="$target_cfg" ;;
    all-overridden) body="$wrapper_cfg"$'\n'"$rustflags_cfg"$'\n'"$target_cfg" ;;
  esac
  printf '[build]\n%s\n' "$body" > "$parent/.cargo/config.toml"
  dir="$parent/crate"
  make_crate "$dir" 2021 "$spike2/fixtures/programs/05_method_mut_borrow.rs"
  if [ "$case" = all-overridden ]; then
    run_one config "$case" "$dir" yes \
      RUSTC_WRAPPER= CARGO_ENCODED_RUSTFLAGS= CARGO_TARGET_DIR="$dir/target"
  else
    run_one config "$case" "$dir" yes
  fi
  if [ -e "$parent/shared-target" ]; then shared=yes; else shared=no; fi
  if [ -e "$dir/target" ]; then own=yes; else own=no; fi
  printf '%s\tshared-target=%s\tcrate-target=%s\n' "$case" "$shared" "$own" >> "$work/results/config/targets.tsv"
done

python3 -I "$here/report.py" "$work/results" "$spike2/work/results/baseline" "$here/fixtures/n1_non_ascii.rs" \
  | tee "$work/report.txt"
