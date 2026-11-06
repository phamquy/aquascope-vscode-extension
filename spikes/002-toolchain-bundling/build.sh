#!/usr/bin/env bash
# T-005: build cargo-aquascope at the pinned tag into work/install.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=pin.env
source "$here/pin.env"
work="$here/work"
src="$work/src/aquascope"
mkdir -p "$work/src"
# Log everything to work/build.log as well as the terminal.
exec > >(tee "$work/build.log") 2>&1

if [ ! -d "$src/.git" ]; then
  git clone --depth 1 --branch "$AQUASCOPE_TAG" "$AQUASCOPE_REPO" "$src"
fi
actual="$(git -C "$src" rev-parse HEAD)"
if [ "$actual" != "$AQUASCOPE_COMMIT" ]; then
  echo "expected $AQUASCOPE_COMMIT, got $actual" >&2
  exit 1
fi

rustup toolchain install "$RUST_NIGHTLY" --profile minimal \
  -c rust-src -c rustc-dev -c llvm-tools-preview -c miri

time cargo +"$RUST_NIGHTLY" install --path "$src/crates/aquascope_front" \
  --root "$work/install" --locked

ls -la "$work/install/bin"
