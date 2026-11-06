#!/usr/bin/env bash
# Vendors Aquascope's built embed frontend into media/aquascope-embed/ (feature 004, D1 and R8).
#
#   scripts/vendor-aquascope-embed.sh [path to Aquascope checkout]
#
# The built `embed.iife.js` and `style.css` are not in Aquascope's git repository; they ship in
# the `js/` folder of the published mdbook-aquascope crate. This downloads that crate from
# crates.io, checks it against the checksum in the crates.io index, checks that it was built from
# the pinned Aquascope commit, and copies the two files unchanged. Aquascope's licence comes from
# the pinned checkout, because the crate does not include it. Rerun after every Aquascope upgrade.
set -euo pipefail
root="$(cd "$(dirname "$0")/.." && pwd)"
# shellcheck source=../spikes/002-toolchain-bundling/pin.env
source "$root/spikes/002-toolchain-bundling/pin.env"
src="${1:-$root/spikes/002-toolchain-bundling/work/src/aquascope}"
out="$root/media/aquascope-embed"
crate=mdbook-aquascope
version="${AQUASCOPE_TAG#v}"

checkout="$(git -C "$src" rev-parse HEAD)"
if [ "$checkout" != "$AQUASCOPE_COMMIT" ]; then
  echo "checkout is at $checkout but the pin is $AQUASCOPE_COMMIT ($AQUASCOPE_TAG)" >&2
  exit 1
fi

work="$(mktemp -d)"
trap 'rm -r "$work"' EXIT

# The sparse index lists one JSON object per published version, with the archive's SHA-256.
curl -fsSL "https://index.crates.io/md/bo/$crate" > "$work/index"
cksum="$(python3 -I -c '
import json, sys
for line in open(sys.argv[1]):
    entry = json.loads(line)
    if entry["vers"] == sys.argv[2]:
        print(entry["cksum"])
' "$work/index" "$version")"
if [ -z "$cksum" ]; then
  echo "$crate $version is not in the crates.io index" >&2
  exit 1
fi

curl -fsSL -o "$work/crate.tar.gz" "https://static.crates.io/crates/$crate/$crate-$version.crate"
echo "$cksum  $work/crate.tar.gz" | shasum -a 256 -c - > /dev/null
tar -xzf "$work/crate.tar.gz" -C "$work"
pkg="$work/$crate-$version"

built_from="$(python3 -I -c 'import json, sys; print(json.load(open(sys.argv[1]))["git"]["sha1"])' "$pkg/.cargo_vcs_info.json")"
if [ "$built_from" != "$AQUASCOPE_COMMIT" ]; then
  echo "$crate $version was built from $built_from, not the pinned $AQUASCOPE_COMMIT ($AQUASCOPE_TAG)" >&2
  exit 1
fi

mkdir -p "$out"
rm -f "$out/embed.iife.js" "$out/style.css" "$out/LICENSE" "$out/README.md"
cp "$pkg/js/embed.iife.js" "$pkg/js/style.css" "$out/"
cp "$src/LICENSE" "$out/LICENSE"
cat > "$out/README.md" <<EOF
# Aquascope embed frontend

Vendored by \`scripts/vendor-aquascope-embed.sh\`; do not edit. \`embed.iife.js\` and \`style.css\` are copied unchanged from the \`js/\` folder of the published crate $crate $version (crates.io archive SHA-256 \`$cksum\`), which was built from Aquascope commit $built_from ($AQUASCOPE_TAG), $AQUASCOPE_REPO. Aquascope is MIT licensed, copyright (c) 2022 Gavin Gray; \`LICENSE\` is its licence text at that commit.

\`embed.iife.js\` is a build that bundles third-party libraries, among them React and ReactDOM, CodeMirror 6, lodash, Floating UI, Leader Line with a custom Modernizr build, and Font Awesome's SVG core with its free solid icons (code under MIT, icons under CC BY 4.0). A full third-party notice belongs to the extension's packaging (feature 005).
EOF
ls -l "$out"
