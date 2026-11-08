---
id: T-038
title: "Ship the Miri-built standard library in the bundle"
status: done
priority: medium
feature: "007-stack-heap-diagrams"
created: 2026-11-08
---

# T-038 Ship the Miri-built standard library in the bundle

Spec: [[specs/features/007-stack-heap-diagrams/spec.md]]

## Done when

- [x] `npm run package` builds the library into `build/bundle/miri-sysroot` and the VSIX
- [x] `check-vsix.mjs` verifies it and uses ADR 0003's size cap
- [x] The bundle has no symbolic links and the interpreter runs the probe programs against the packaged bundle
- [x] `npm run dev-bundle` provides a development copy
- [x] The VSIX size is recorded (R3, R6, AC7)
- [x] `npm run typecheck && npm run lint && npm test` pass

## Notes

- Plan: [[specs/features/007-stack-heap-diagrams/plan.md]]. Depends on T-037. The build stage already installs `-c miri -c rust-src` (`scripts/package-platform.sh:60`).
- Done on 2026-11-08. `scripts/package-platform.sh`'s assemble stage runs `cargo +<nightly> miri setup` with `MIRI_SYSROOT=build/miri-sysroot`, which keeps the library between runs, copies it to `build/bundle/miri-sysroot` and deletes cargo's dep-info (`.d`) files, which runs do not need. The existing check that the bundle has no symbolic links covers it.
- `scripts/check-vsix.mjs` requires `libcore`, `liballoc` and `libstd` rlibs under `extension/aquascope/miri-sysroot/lib/rustlib/<host>/lib/`, rejects `.d` files there, and caps the VSIX at 200 MB (ADR 0003).
- `npm run package` on 2026-11-08 (version 0.0.1 on `main`): bundle 578 MB unpacked, 144 files; the strict test run passed 100 tests; `check-vsix: ok: darwin-arm64, 159 entries, 86 toolchain files, 186.5 MB`. The VSIX grew from 124.2 MB (T-032) to 186.5 MB (AC7).
- `spikes/007-interpreter/probe.sh` takes `PROBE_BUNDLE=<bundle root>`. Against `build/bundle`, all 27 probe programs returned the same exit code, result kind, step count and result type as with the development bundle.
- `npm run dev-bundle` builds the library once into `spikes/007-interpreter/work/miri-sysroot` (shared with the probe) and links it as `<root>/miri-sysroot`; without rustup's `miri` and `rust-src` it warns and links the rest. The README's development and packaging sections say so, and give the new size.
- Found, not fixed here: the package embeds the build machine's home path. The Miri library's rlibs hold the rust-src paths under `~/.rustup` (732 strings in `libstd` alone), and the binaries feature 005 already ships hold `~/.cargo` registry and git paths (72 in `cargo-aquascope`, 435 in `aquascope-driver`). `cargo miri setup` sets its own compiler flags, so `RUSTFLAGS` remapping has no effect; `MIRI_LIB_SRC` and `CARGO_HOME` pointing at neutral paths, and `--remap-path-prefix` for `cargo install`, would remove them. Worth a separate change before a public release.
- `npm run typecheck && npm run lint && npm test`: 100 passing.
