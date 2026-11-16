#!/usr/bin/env bash
# Builds the extension's VSIX for this platform, with Aquascope and its toolchain inside (feature 005).
#
#   npm run package        or   bash scripts/package-platform.sh
#   npm run package -- bundle      stops after the assemble stage, leaving the bundle in build/bundle
#
# On Windows (feature 012) it runs in Git for Windows' Bash, which scripts/package.mjs finds, and builds
# win32-x64; paths are handled in their C:/ form so that Bash and the native tools agree on them.
#
# Runs in stages, each stopping the script with a message on failure: check (platform, pin and the
# Aquascope checkout), build (the Aquascope binaries), assemble (the bundle in build/bundle), test (the
# extension against that bundle) and package (the VSIX, then a check of its contents). Everything is
# built in build/, which git ignores and the package never contains, except the standard library for Miri,
# built in a temporary folder under /tmp that is removed afterwards; the bundle sits at aquascope/ in the
# repository root only while vsce runs. Needs rustup, git, Node and npm, a C linker (the Xcode Command Line
# Tools, or Visual Studio 2022's C++ build tools on Windows), and the network while building. The pin is spikes/002-toolchain-bundling/pin.env; AQUASCOPE_PIN may
# name another file, for checking the script.
set -euo pipefail
# pwd -W gives the C:/ form under Git Bash; elsewhere it fails and pwd's own answer is used.
root="$(cd "$(dirname "$0")/.." && { pwd -W 2> /dev/null || pwd; })"
pin="${AQUASCOPE_PIN:-$root/spikes/002-toolchain-bundling/pin.env}"
build="$root/build"
src="$build/aquascope-src"
install="$build/install"
bundle="$build/bundle"
staged="$root/aquascope"
version="$(node -p "require('$root/package.json').version")"

# A path in the form both Bash and the native tools read: C:/... on Windows, unchanged elsewhere.
native() {
  if command -v cygpath > /dev/null; then cygpath -m "$1"; else printf '%s' "$1"; fi
}

step() { printf '\n== %s\n' "$1"; }
fail() {
  echo "package-platform: $*" >&2
  exit 1
}

check() {
  step "check: platform, pin and Aquascope checkout"
  case "$(uname -s) $(uname -m)" in
    "Darwin arm64")
      host=aarch64-apple-darwin
      target=darwin-arm64
      exe=
      ;;
    MINGW64_NT*" x86_64" | MSYS_NT*" x86_64")
      host=x86_64-pc-windows-msvc
      target=win32-x64
      exe=.exe
      ;;
    *) fail "this version packages darwin-arm64 and win32-x64 only (specs 005 and 012); this machine is $(uname -s) $(uname -m)" ;;
  esac
  for tool in rustup git node npm; do
    command -v "$tool" > /dev/null || fail "$tool is not on PATH; see DEVELOPMENT.md's section on building a package"
  done
  # Windows links with Visual Studio's link.exe, which rustc finds itself; there is no cc to look for.
  if [ "$target" = darwin-arm64 ]; then
    command -v cc > /dev/null || fail "cc is not on PATH; see DEVELOPMENT.md's section on building a package"
  fi
  # shellcheck source=../spikes/002-toolchain-bundling/pin.env
  source "$pin"
  if [ ! -d "$src/.git" ]; then
    git clone --quiet --depth 1 --branch "$AQUASCOPE_TAG" "$AQUASCOPE_REPO" "$src"
  fi
  local commit channel
  commit="$(git -C "$src" rev-parse HEAD)"
  if [ "$commit" != "$AQUASCOPE_COMMIT" ]; then
    fail "the Aquascope checkout in build/aquascope-src is at $commit, but the pin names $AQUASCOPE_COMMIT ($AQUASCOPE_TAG); after changing the pin, delete build/aquascope-src to clone it again"
  fi
  channel="$(sed -n 's/^channel *= *"\(.*\)"/\1/p' "$src/rust-toolchain.toml")"
  if [ "$channel" != "$RUST_NIGHTLY" ]; then
    fail "Aquascope $AQUASCOPE_TAG builds with $channel (its rust-toolchain.toml), but the pin names $RUST_NIGHTLY"
  fi
  echo "$target ($host); Aquascope $AQUASCOPE_TAG at ${commit:0:7}; $RUST_NIGHTLY"
}

build() {
  step "build: cargo-aquascope and aquascope-driver"
  rustup toolchain install "$RUST_NIGHTLY" --profile minimal -c rust-src -c rustc-dev -c llvm-tools-preview -c miri
  # A target folder in build/ makes rebuilds incremental. rustc records source paths in the binaries, so the
  # home folder is mapped to `~` (R10). The nightly's own cargo and rustc run without rustup's proxy, because
  # the RUSTUP_HOME it sets would be compiled into aquascope-driver as a fallback sysroot.
  local nightly home
  nightly="$(native "$(rustup run "$RUST_NIGHTLY" rustc --print sysroot)")"
  home="$HOME"
  # rustc records Windows paths with backslashes, and the prefix must match them.
  if command -v cygpath > /dev/null; then home="$(cygpath -w "$HOME")"; fi
  env -u RUSTUP_HOME -u RUSTUP_TOOLCHAIN RUSTC="$nightly/bin/rustc$exe" CARGO_ENCODED_RUSTFLAGS="--remap-path-prefix=$home=~" \
    CARGO_TARGET_DIR="$build/target" "$nightly/bin/cargo$exe" install --locked --force \
    --path "$src/crates/aquascope_front" --root "$install"
}

assemble() {
  step "assemble: build/bundle"
  local sysroot toolchain component manifest kind path
  sysroot="$(native "$(rustup run "$RUST_NIGHTLY" rustc --print sysroot)")"
  [ -n "$bundle" ] && rm -rf "$bundle"
  mkdir -p "$bundle/bin" "$bundle/toolchain"
  toolchain="$bundle/toolchain"

  # The two Aquascope binaries, unmodified: patching them would break their ad-hoc signature on arm64.
  cp -p "$install/bin/cargo-aquascope$exe" "$install/bin/aquascope-driver$exe" "$bundle/bin/"

  # The rustc, cargo and rust-std components, file by file from rustup's manifests, as spike 002 did,
  # so that the compiler library is the one the binaries were built against.
  for component in rustc cargo rust-std; do
    manifest="$sysroot/lib/rustlib/manifest-$component-$host"
    [ -f "$manifest" ] || fail "missing $manifest"
    while IFS= read -r line; do
      kind="${line%%:*}"
      path="${line#*:}"
      case "$kind" in
        file)
          mkdir -p "$toolchain/$(dirname "$path")"
          cp -p "$sysroot/$path" "$toolchain/$path"
          ;;
        dir)
          mkdir -p "$toolchain/$path"
          cp -Rp "$sysroot/$path/." "$toolchain/$path/"
          ;;
      esac
    done < "$manifest"
  done

  # Trim what `cargo check` never uses, keeping the licence files (scripts/bundle-paths.sh).
  # shellcheck source=bundle-paths.sh
  source "$root/scripts/bundle-paths.sh"
  local kept="$build/kept-licences" pattern
  rm -rf "$kept"
  mkdir -p "$kept"
  (cd "$toolchain" && for pattern in "${KEEP[@]}"; do
    # shellcheck disable=SC2086 # the patterns are globs
    for match in $pattern; do
      [ -e "$match" ] || fail "missing licence file toolchain/$match"
      mkdir -p "$kept/$(dirname "$match")"
      cp -Rp "$match" "$kept/$match"
    done
  done)
  (cd "$toolchain" && for pattern in "${TRIM[@]}"; do
    # shellcheck disable=SC2086
    rm -rf $pattern
  done)
  cp -Rp "$kept/." "$toolchain/"
  rm -rf "$kept"

  # Aquascope's licence and the notices of the crates linked into its binaries (D4).
  cp "$src/LICENSE" "$bundle/LICENSE"
  node "$root/scripts/crate-notices.mjs" "$src" "$RUST_NIGHTLY" "$host" > "$bundle/THIRD-PARTY-NOTICES"

  # The standard library built for Miri, which Aquascope's interpreter needs (feature 007, ADR 0003).
  # cargo-miri sets its own compiler flags, so the source paths it records cannot be remapped. Instead it
  # builds, in about 15 seconds, from a copy of the nightly's library source and with a fresh cargo home,
  # both in a temporary folder outside the home folder (R10). Cargo's dep-info (.d) files are not needed to run.
  # On Windows the temporary folder is under the user's profile, so the folder goes at the drive's root.
  if [ "$target" = win32-x64 ]; then
    miri_work="$(mktemp -d "$(native "${SYSTEMDRIVE:-C:}/")aquascope-miri.XXXXXX")"
  else
    miri_work="$(mktemp -d /tmp/aquascope-miri.XXXXXX)"
  fi
  miri_work="$(native "$miri_work")"
  cp -R "$sysroot/lib/rustlib/src/rust/library" "$miri_work/library"
  MIRI_LIB_SRC="$miri_work/library" CARGO_HOME="$miri_work/cargo-home" MIRI_SYSROOT="$miri_work/sysroot" \
    cargo +"$RUST_NIGHTLY" miri setup ||
    fail "cargo miri setup could not build the standard library for Miri"
  cp -Rp "$miri_work/sysroot" "$bundle/miri-sysroot"
  find "$bundle/miri-sysroot" -name '*.d' -delete

  if [ -n "$(find "$bundle" -type l)" ]; then fail "the bundle contains symbolic links; it must be real files"; fi
  echo "bundle: $(du -sh "$bundle" | cut -f1), $(find "$bundle" -type f | wc -l | tr -d ' ') files"
}

test_bundle() {
  step "test: the extension against build/bundle"
  # Strict: a missing bundle or a skipped toolchain test fails the run (T-030).
  (cd "$root" && npm run --silent typecheck && npm run --silent lint &&
    AQUASCOPE_REQUIRE_TOOLCHAIN=1 AQUASCOPE_TEST_TOOLCHAIN="$bundle" npm test) ||
    fail "the tests failed against build/bundle; no package was written"
}

package() {
  step "package: $(basename "$vsix")"
  # vsce packages the folder it runs in, so the bundle is copied to the root for this step only.
  rm -rf "$staged"
  cp -Rp "$bundle" "$staged"
  (cd "$root" && npx --no-install vsce package --target "$target" --no-dependencies --out "$vsix")
  rm -rf "$staged"
  node "$root/scripts/check-vsix.mjs" "$vsix" "$host" "$RUST_NIGHTLY" "$bundle"
  echo "packaged: $vsix ($(node -p "(require('fs').statSync('$vsix').size / 1048576).toFixed(1)") MB)"
}

# The bundle never outlives the package step and the Miri library's temporary folder never outlives the
# run, whatever happens, and a VSIX left afterwards is this run's.
miri_work=""
trap 'rm -rf "$staged"; [ -z "$miri_work" ] || rm -rf "$miri_work"' EXIT
stop_after="${1:-}"
case "$stop_after" in
  "" | bundle) ;;
  *) fail "unknown argument $stop_after; the only one is bundle" ;;
esac
check
vsix="$root/aquascope-vscode-extension-$target-$version.vsix"
rm -f "$vsix"
build
assemble
if [ "$stop_after" = bundle ]; then
  echo "bundle left in build/bundle; no package was written"
  exit 0
fi
test_bundle
package
