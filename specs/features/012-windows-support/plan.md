---
feature: 012-windows-support
---

# Plan

## Approach

Start with a bounded feasibility task on a native Windows x64 host using the pinned Aquascope commit and Rust nightly. Prove that the Windows host toolchain can build the Aquascope binaries, that the Miri sysroot can be assembled, and that both permissions and interpreter operations run. Settle the supported Windows versions, Rust host triple, packaging shell and achievable bundle size from that evidence. If either view cannot meet the approved requirements with the pin, stop and revise the spec before implementation.

After the feasibility gate, extend the existing per-platform package pipeline without changing the macOS package behavior. The Windows build must assemble from the pinned rustup component manifests, preserve required DLLs and licence files, and stage a bundle in the layout already consumed by `resolveToolchain`. Use a native Windows packaging entry point for `npm run package`; keep platform-specific operations explicit rather than translating Windows paths through POSIX assumptions.

Update the VSIX checker to validate a Windows package by its manifest target, required executables and compiler DLLs, bundled Miri libraries, notices, size, and absence of build-machine paths. The package command must run the existing typecheck, lint and integration suite against the exact Windows bundle in strict mode. Exercise cancellation and timeout on Windows, where `runner.ts` terminates the child tree through `taskkill`.

Once the package and its install behavior are verified, update product and user-facing development documentation and produce the versioned Windows VSIX. Attach it to the matching GitHub release; the existing Marketplace workflow publishes the VSIX assets attached to a published release.

## VS Code APIs and contribution points

None. This feature adds platform packaging and validation; it does not add commands or change the extension's user-facing analysis behavior.

## Files touched

- `scripts/package-platform.sh` and a Windows-native packaging entry point, plus `package.json` if the package command needs platform dispatch.
- `scripts/bundle-paths.sh` for host-specific toolchain trimming and licence retention.
- `scripts/check-vsix.mjs` for Windows package layout, required files, size and build-path validation.
- `src/analysis/toolchain.ts` and `src/analysis/runner.ts` only if Windows runtime tests expose a defect; preserve their existing platform behavior otherwise.
- Focused unit and integration tests under `src/test/suite/` for Windows environment resolution, process cancellation, and both analysis views.
- `README.md`, `DEVELOPMENT.md`, `specs/product.md`, and this feature's acceptance records for platform support and packaging instructions.
- The shared Aquascope pin only if the feasibility task proves a Windows-specific upstream or fork change is necessary; if changed, rebuild and test all platform bundles.

## Risks

- The pinned nightly may not build or run Aquascope's Miri interpreter on a Windows host. The feasibility task is a gate, not permission to silently ship permissions-only support.
- Windows toolchain binaries may need DLLs or a runtime not present on a clean user machine; package install and execution must be checked on a clean Windows profile.
- The current packaging script assumes Bash, POSIX utilities and macOS file names. Native Windows packaging and VSIX inspection need an explicit, supported implementation rather than relying on an undocumented shell setup.
- The existing VSIX checker allows up to 200 MB, but the Windows bundle size and Marketplace acceptance are not yet measured. Do not raise the cap without documenting the measured package and revising the spec.
- Changing the shared Aquascope pin invalidates existing platform bundles, which must be rebuilt from the same pin for a release.

## Test strategy

- On the supported Windows build host, install the pinned Rust nightly and build the pinned Aquascope source; record the result and host/target configuration.
- Build the Miri sysroot and run representative permissions and interpreter fixtures using the proposed bundle layout.
- Add focused tests for Windows executable names, case-insensitive environment variable handling, DLL search path, and cancellation of the full process tree where not already covered.
- Run `npm run typecheck`, `npm run lint`, and the full test suite with `AQUASCOPE_REQUIRE_TOOLCHAIN=1` and `AQUASCOPE_TEST_TOOLCHAIN` pointing at the Windows bundle.
- Run the VSIX content check, then install the built VSIX into a clean supported Windows profile with no Rust installation and no network; verify both views.
- Before release, confirm the Windows package is within the agreed size cap, attach it to the versioned GitHub release, and verify Marketplace publication through the existing release workflow.
