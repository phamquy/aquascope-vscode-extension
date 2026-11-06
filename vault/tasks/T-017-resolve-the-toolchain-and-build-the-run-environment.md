---
id: T-017
title: "Resolve the toolchain and build the run environment"
status: done
priority: medium
feature: "003-run-analysis-at-cursor"
created: 2026-11-06
---

# T-017 Resolve the toolchain and build the run environment

Spec: [[specs/features/003-run-analysis-at-cursor/spec.md]]

## Done when

- [x] unit tests cover root resolution from the setting and the bundled location, the missing-tool error naming the setting, PATH and library-path order per platform, removed variables, the R4 overrides and `CARGO_NET_OFFLINE=true` (R3 to R5)

## Notes

- `src/analysis/toolchain.ts`: `resolveToolchain(configured, extensionPath, platform?, exists?)` returns `{ok, root, cargo}` or `{ok: false, message}`; `runEnvironment(root, crateDir, base?, platform?)` returns the env plus the `set` and `removed` lists for the R11 log.
- A set `aquascope.toolchainPath` that does not hold the tools is reported, never replaced by the bundle; R3 was clarified to say so.
- The existence check also covers `bin/aquascope-driver`, so a missing driver gets the clear message instead of a dyld error later.
- The library path is set to exactly `<root>/toolchain/lib`, not prepended to the user's value, as in spike 002. Windows matches variable names case-insensitively and puts `toolchain/lib` on `PATH`; it is unit-tested only.
- `src/test/suite/toolchain.test.ts`: 13 tests; the last runs the dev bundle's `aquascope-driver -vV` with the built environment (it fails to load `librustc_driver` without the library path).
