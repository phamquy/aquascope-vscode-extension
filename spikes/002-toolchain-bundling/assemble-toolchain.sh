#!/usr/bin/env bash
# T-007: assemble a minimal toolchain (rustc, cargo, rust-std only) in work/toolchain-minimal.
#
# Copies exactly the files that rustup's per-component manifests list for those
# three components from the installed pinned nightly. This is the same file set
# the official rustc, cargo and rust-std tarballs install, without re-downloading.
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
# shellcheck source=pin.env
source "$here/pin.env"
host="$(rustup run "$RUST_NIGHTLY" rustc -vV | sed -n 's/^host: //p')"
src="$(rustup run "$RUST_NIGHTLY" rustc --print sysroot)"
dst="$here/work/toolchain-minimal"

rm -rf "$dst"
mkdir -p "$dst"
for component in "rustc-$host" "cargo-$host" "rust-std-$host"; do
  manifest="$src/lib/rustlib/manifest-$component"
  [ -f "$manifest" ] || { echo "missing $manifest" >&2; exit 1; }
  count=0
  while IFS= read -r line; do
    kind="${line%%:*}"
    path="${line#*:}"
    case "$kind" in
      file)
        mkdir -p "$dst/$(dirname "$path")"
        cp -p "$src/$path" "$dst/$path"
        ;;
      dir)
        mkdir -p "$dst/$path"
        cp -Rp "$src/$path/." "$dst/$path/"
        ;;
    esac
    count=$((count + 1))
  done < "$manifest"
  echo "$component: $count entries"
done

echo "host $host"
du -sh "$dst"
"$dst/bin/rustc" --version
