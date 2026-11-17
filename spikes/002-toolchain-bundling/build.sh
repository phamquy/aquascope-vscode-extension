#!/usr/bin/env bash
# T-005: build cargo-aquascope into work/install, which the development bundle links to (scripts/dev-bundle.mjs).
# Builds the fork checked out in the submodule vendor/aquascope (ADR 0005), as it is: at the pinned commit, or on a
# branch being worked on, which it names. The packaging script builds the pinned commit alone.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
# shellcheck source=pin.env
source "$here/pin.env"
work="$here/work"
src="$root/vendor/aquascope"
mkdir -p "$work"
# Log everything to work/build.log as well as the terminal.
exec > >(tee "$work/build.log") 2>&1

if [ ! -e "$src/.git" ]; then
  git -C "$root" submodule update --init vendor/aquascope
fi
actual="$(git -C "$src" rev-parse HEAD)"
if [ "$actual" != "$AQUASCOPE_COMMIT" ] || [ -n "$(git -C "$src" status --porcelain --untracked-files=no)" ]; then
  echo "note: building vendor/aquascope at $(git -C "$src" describe --always --dirty), not the pinned $AQUASCOPE_TAG" >&2
fi

rustup toolchain install "$RUST_NIGHTLY" --profile minimal \
  -c rust-src -c rustc-dev -c llvm-tools-preview -c miri

# `cargo install --path` builds in the checkout's own target folder, so later builds are incremental.
time cargo +"$RUST_NIGHTLY" install --path "$src/crates/aquascope_front" \
  --root "$work/install" --locked --force

ls -la "$work/install/bin"
