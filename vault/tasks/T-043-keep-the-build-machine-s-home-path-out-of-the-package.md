---
id: T-043
title: "Keep the build machine's home path out of the package"
status: review
priority: medium
feature: "005-package-per-platform-vsix"
created: 2026-11-09
---

# T-043 Keep the build machine's home path out of the package

Spec: [[specs/features/005-package-per-platform-vsix/spec.md]]

## Done when

- [x] `check-vsix` rejects a VSIX that holds the build machine's home path
- [x] A package built by `npm run package` passes it, with the strict test run
- [x] Spec 005 has R10 and AC8, and AC8 is ticked
- [x] `npm run typecheck && npm run lint && npm test` pass

## Notes

- Found in T-038 and left for later; release 0.0.3 shipped with it. In the 0.0.3 VSIX, 53 files held `/Users/jackpham`: 51 in the Miri standard library and both Aquascope binaries. They came from three sources. First, rustc records source paths for panic messages and debug information, and with `rust-src` and `rustc-dev` installed it replaces the standard library's and compiler's `/rustc/<hash>` paths with their local copies under `~/.rustup`. Second, dependencies add their paths under `~/.cargo/registry` and `~/.cargo/git`. Third, `aquascope-driver` compiles in `RUSTUP_HOME` through `option_env!` in `rustc_plugin`'s sysroot lookup, as its last fallback after `--sysroot`, `MIRI_SYSROOT`, `SYSROOT`, the runtime `RUSTUP_*` variables and `rustc --print sysroot`; the extension puts the bundle's `rustc` on `PATH`, so the fallback is never reached.
- The binaries: `build` now runs the nightly's own `cargo` and `rustc` without rustup's proxy and with `RUSTUP_HOME` and `RUSTUP_TOOLCHAIN` unset, so nothing is compiled in, and with `CARGO_ENCODED_RUSTFLAGS=--remap-path-prefix=$HOME=~`. The encoded form survives a home path with spaces. Built this way in the scratchpad, neither binary held the home path, their 72 and 436 source paths read `~/.cargo/…` or `~/.rustup/…`, and `05_method_mut_borrow` and `n3_early_return` gave their captured output in an environment without rustup variables.
- The Miri library: `cargo miri setup` passes its own `CARGO_ENCODED_RUSTFLAGS` to the sysroot build and ignores `RUSTFLAGS` and `RUSTC_WRAPPER`, so its paths cannot be remapped. `assemble` now copies the nightly's `library` source into a `mktemp -d /tmp/aquascope-miri.XXXXXX` folder and builds with `MIRI_LIB_SRC` pointing there and a fresh `CARGO_HOME` beside it; the folder is removed on exit. The build takes about 12 seconds and fetches the standard library's few crates.io dependencies each time. Built this way, no file held the home path, and the interpreter gave `01_move_string`'s captured trace exactly. `build/miri-sysroot` is no longer used.
- `check-vsix.mjs` unpacks the VSIX into a temporary folder and fails when any file holds `os.homedir()`. Against the released 0.0.3 VSIX it reports the 53 files.
- `npm run package` on this branch: 138 of 138 against the packaged bundle, including feature 007's end-to-end tests against the new Miri library; `check-vsix: ok`, 186.5 MB. A separate `grep` of the unpacked VSIX finds `/Users/jackpham` in no file; `jackpham` appears only as the publisher ID in `package.json` and `extension.vsixmanifest`.
- The new VSIX still says 0.0.3, like the released one that holds the path; a release of this fix needs a version bump.
