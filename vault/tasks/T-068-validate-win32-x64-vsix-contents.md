---
id: T-068
title: "Validate win32-x64 VSIX contents"
status: review
priority: medium
feature: "012-windows-support"
created: 2026-11-16
---

# T-068 Validate win32-x64 VSIX contents

Spec: [[specs/features/012-windows-support/spec.md]]

## Done when

- [x] The VSIX checker accepts a valid `win32-x64` package and verifies its manifest target, required `.exe` and `.dll` files, Miri sysroot, notices, size and build-path cleanliness.
- [x] Checker tests or controlled package cases prove that a wrong target, missing required file, over-limit package or embedded build-machine path is rejected.

## Notes
`scripts/check-vsix.mjs` picks its checks from the host triple (`darwin-arm64` or `win32-x64`). For Windows it requires `cargo-aquascope.exe`, `aquascope-driver.exe`, `cargo.exe`, `rustc.exe`, `rustc_driver-*.dll` and `std-*.dll` in the toolchain's `bin`, the Miri `core`, `alloc` and `std` rlibs, and the notices, and skips the Unix executable bit. It reads the zip itself and parses the trim and keep lists from `bundle-paths.sh`, so it no longer needs `zipinfo`, `unzip` or Bash. The home-path scan also looks for the path with forward slashes and with doubled backslashes. `src/test/suite/checkVsix.test.ts` builds small synthetic zips and checks one valid package, a wrong target, seven kinds of missing file, leftover `rustdoc.exe` and `.pdb` files, the size cap, the home path in three spellings, stale notices and an unknown host (15 cases; they run in plain mocha too). A real VSIX built from the T-067 bundle with `vsce package --target win32-x64` passes the check at 162.4 MB (under the 200 MB cap). The darwin-arm64 checks keep their logic but were not run, as this host is Windows. `VCRUNTIME140.dll` is not bundled; T-069 decides whether a clean profile needs it.
