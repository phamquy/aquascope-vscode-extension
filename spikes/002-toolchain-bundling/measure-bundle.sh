#!/usr/bin/env bash
# T-009: measure the bundle that a platform VSIX would carry.
#
# full     = install/bin (cargo-aquascope, aquascope-driver) + toolchain-minimal
# trimmed  = install/bin + toolchain-trimmed, i.e. toolchain-minimal without files
#            that `cargo check` does not use on macOS (see EXCLUDES)
#
# Reports unpacked size and zip size (deflate level 6, as vsce writes VSIX files),
# and writes the trimmed file list to work/results/bundle/filelist-trimmed.tsv.
# Verify the trimmed toolchain afterwards with: run.sh trimmed && compare.sh baseline trimmed
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
work="$here/work"
host="$(rustup run "$(sed -n 's/^RUST_NIGHTLY=//p' "$here/pin.env")" rustc -vV | sed -n 's/^host: //p')"
out="$work/results/bundle"
mkdir -p "$out"

EXCLUDES=(
  "share"                                  # docs, man pages, shell completions
  "etc"                                    # gdb/lldb helper config
  "libexec"                                # rust-analyzer proc-macro server
  "bin/rustdoc"
  "bin/rust-gdb" "bin/rust-gdbgui" "bin/rust-lldb"
  "lib/librustc-nightly_rt.*"              # sanitizer runtimes
  "lib/rustlib/$host/bin"                  # rust-lld, gcc-ld, objcopy, wasm linkers
)

if [ ! -d "$work/toolchain-trimmed" ]; then
  args=()
  for e in "${EXCLUDES[@]}"; do args+=(--exclude "/$e"); done
  rsync -a "${args[@]}" "$work/toolchain-minimal/" "$work/toolchain-trimmed/"
fi

python3 -I - "$work" "$out" <<'EOF'
import os, sys, zipfile

work, out = sys.argv[1], sys.argv[2]

def files(roots):
    for prefix, root in roots:
        for dirpath, _, names in os.walk(root):
            for n in names:
                p = os.path.join(dirpath, n)
                if os.path.isfile(p) and not os.path.islink(p):
                    yield p, os.path.join(prefix, os.path.relpath(p, root))

def measure(label, roots):
    entries = list(files(roots))
    unpacked = sum(os.path.getsize(p) for p, _ in entries)
    zpath = os.path.join(out, f"bundle-{label}.zip")
    with zipfile.ZipFile(zpath, "w", zipfile.ZIP_DEFLATED, compresslevel=6) as z:
        for p, arc in entries:
            z.write(p, arc)
    zipped = os.path.getsize(zpath)
    print(f"{label:<8} files={len(entries):<5} unpacked={unpacked/2**20:7.1f} MB  zip={zipped/2**20:7.1f} MB")
    return entries

bin_root = ("bin", os.path.join(work, "install", "bin"))
measure("full", [bin_root, ("toolchain", os.path.join(work, "toolchain-minimal"))])
entries = measure("trimmed", [bin_root, ("toolchain", os.path.join(work, "toolchain-trimmed"))])
with open(os.path.join(out, "filelist-trimmed.tsv"), "w") as f:
    f.write("bytes\tpath\n")
    for p, arc in sorted(entries, key=lambda e: -os.path.getsize(e[0])):
        f.write(f"{os.path.getsize(p)}\t{arc}\n")
EOF
echo "largest files in the trimmed bundle:"
head -11 "$out/filelist-trimmed.tsv" | awk -F'\t' 'NR>1{printf "  %7.1f MB  %s\n", $1/1048576, $2}'
