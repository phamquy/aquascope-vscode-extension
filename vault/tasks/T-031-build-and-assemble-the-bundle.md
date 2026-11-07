---
id: T-031
title: "Build and assemble the bundle"
status: review
priority: medium
feature: "005-package-per-platform-vsix"
created: 2026-11-07
---

# T-031 Build and assemble the bundle

Spec: [[specs/features/005-package-per-platform-vsix/spec.md]]

## Done when

- [x] `scripts/package-platform.sh` checks the platform and the pin, builds the binaries, and fills `build/bundle/` with the binaries, the trimmed toolchain keeping its licence files, Aquascope's `LICENSE` and the crate notices from `scripts/crate-notices.mjs`; AC6 recorded; R1–R4, R6, R7, D4; needs your approval for the rustup and cargo downloads

## Notes

- `scripts/package-platform.sh` (run with `bash`; `npm run package` is wired in T-032) has three stages so far:
  - **check:** `uname -sm` must be `Darwin arm64` (host `aarch64-apple-darwin`, target `darwin-arm64`); rustup, git, node, npm and cc must be on `PATH`; it sources the pin (`AQUASCOPE_PIN` may name another file, for checking), shallow-clones the tag into `build/aquascope-src` if missing, and compares the checkout's commit and `rust-toolchain.toml` channel with the pin.
  - **build:** `rustup toolchain install` with the build components, then `cargo install --locked --force --path crates/aquascope_front --root build/install` with `CARGO_TARGET_DIR=build/target`, so reruns are incremental.
  - **assemble:** `build/bundle/` with the binaries copied unmodified, the `rustc`, `cargo` and `rust-std` files copied from rustup's manifests, the trim applied with the licence files kept, Aquascope's `LICENSE`, and `THIRD-PARTY-NOTICES` from `scripts/crate-notices.mjs`; it stops if the bundle has any symbolic link.
- `scripts/bundle-paths.sh` holds the trim and keep lists, for T-032's VSIX check to reuse. `.gitignore` and `.vscodeignore` now ignore `build/`.
- `scripts/crate-notices.mjs` walks `cargo metadata --locked --filter-platform aarch64-apple-darwin` from `aquascope_front` (normal and build dependencies, not dev), skips workspace crates, and copies licence files from the cargo cache. Without the platform filter it listed 202 crates, including Windows and WebAssembly ones; with it, 113. Ten have no licence file and carry their declared licence: Inflector, libffi, libffi-sys, rustc_plugin, rustc_tools_util, rustc_utils, ts-rs (two versions) and ts-rs-macros (two versions).
- First run (2026-11-06): 56 s in total, with Aquascope building in 46 s and the nightly already installed; a rerun took 4 s. The bundle is 386 MB unpacked in 90 files. The toolchain matches spike 002's trimmed one file for file and byte for byte, apart from the 17 kept licence files. Those add 16 MB unpacked, almost all in `COPYRIGHT.html` (15 MB, 431 KB gzipped).
- AC6, checked: a pin naming another Aquascope commit, then another nightly, each stopped the script in the check stage with a message naming the mismatch, before anything was built. The stop on other platforms is the `case` at the start of `check`, checked by reading.
- Early check of the bundle: binaries and `cargo`/`rustc` executable; `AQUASCOPE_REQUIRE_TOOLCHAIN=1 AQUASCOPE_TEST_TOOLCHAIN=build/bundle npm test` gives 92 passing, none skipped.

