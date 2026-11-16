---
id: 012-windows-support
title: Support Windows x64
status: approved # draft | approved | implemented
---

# Support Windows x64

## Why

The extension currently ships a bundled toolchain only for darwin-arm64. Windows users cannot install a matching package, although parts of the extension already contain Windows-specific path, executable and process-cancellation handling. This feature adds a tested win32-x64 package so Windows users can use the same permissions and stack-and-heap views without installing Rust.

## User stories

- As a Rust learner on Windows x64, I want to install Aquascope and analyze my code without installing Rust or configuring a toolchain, so that I can use the extension as a ready-to-run editor tool.
- As a Windows user, I want both the permissions and stack-and-heap views to work, so that Windows support is not a reduced or undocumented version of the extension.
- As the maintainer, I want a repeatable Windows package build that tests the exact bundled tools, so that a release cannot pass while its Windows toolchain is missing or broken.

## Requirements

- R1: The extension provides a platform-specific `win32-x64` VSIX containing the Aquascope binaries, the pinned Rust toolchain and the Miri-built standard library required by the existing features.
- R2: The Windows package uses the Aquascope repository, tag, commit and Rust nightly from the shared pin. If Windows support requires changing the pin, the release process rebuilds and tests every platform package from that pin.
- R3: On a supported Windows x64 build host, `npm run package` builds the Windows bundle, runs typecheck, lint and the full test suite against that bundle with toolchain tests required, and writes a checked `win32-x64` VSIX. A failed or skipped required test does not leave a package that can be mistaken for a successful build.
- R4: The bundled executables and compiler libraries use the Windows file names and runtime loading rules, and the extension resolves them without depending on an unrelated Rust installation or machine-specific PATH configuration.
- R5: The permissions view and the stack-and-heap view both run using the packaged tools. The interpreter uses the bundled Miri sysroot and runs the program under the same documented constraints as the existing stack-and-heap feature.
- R6: After installation, the extension makes no network request to download its tools or build its bundled toolchain. Crate dependencies remain subject to the existing cargo-cache and system-linker requirements, which are documented for Windows.
- R7: Cancellation and timeout stop the Aquascope process and its descendants on Windows, without blocking the extension host or leaving background build processes running.
- R8: The package check verifies the VSIX target, required Windows executables and DLLs, interpreter sysroot, licence notices, package contents, size limit and absence of build-machine paths.
- R9: The README and development guide state the supported Windows versions, installation path, package prerequisites, build steps, and any remaining system-linker or Miri limitations.
- R10: A versioned Windows VSIX is attached to the corresponding GitHub release and is published to the VS Code Marketplace by the existing release workflow.

## Acceptance criteria

- [ ] AC1: On a supported native Windows x64 build host, `npm run package` produces a VSIX whose manifest targets `win32-x64`.
- [ ] AC2: The package build passes typecheck, lint and the full test suite against its own Windows toolchain; no required toolchain test is skipped.
- [ ] AC3: Integration tests using the Windows bundle show the expected permissions diagram and stack-and-heap trace for existing fixtures.
- [ ] AC4: On a clean supported Windows machine with no Rust installation and no network connection, installing the VSIX and analyzing a fixture works with `aquascope.toolchainPath` unset.
- [ ] AC5: A Windows cancellation or timeout test confirms that the Aquascope process tree is stopped and a later run can complete.
- [ ] AC6: The package check confirms the expected Windows executables and DLLs, the Miri sysroot and required notices are present, no build-machine path is included, and the VSIX is within the agreed size limit.
- [ ] AC7: Documentation accurately states the Windows requirements and behavior, including the system linker needed by crates with build scripts or proc macros.
- [ ] AC8: The Windows VSIX is attached to a versioned GitHub release and the release workflow publishes it to the Marketplace.

## Out of scope

- Windows ARM64 and 32-bit Windows.
- Changes to the analysis or rendering behavior that are unrelated to platform compatibility.
- Building platform packages in CI; this feature first makes the Windows package build repeatable on a Windows host.
- Code signing or notarization unless Windows installation testing shows it is required for the supported distribution path.
- Supporting every Windows release; the supported Windows versions are to be settled before implementation.

## Open questions

- Which Windows versions are supported, and what is the oldest version on which the bundled toolchain and extension must work? Resolved by T-066 in part: the probe passed on Windows 11 Pro x64 (build 26300). Windows 10 x64 remains unverified; T-069 decides whether to claim it.
- Should the bundled Rust toolchain use the `x86_64-pc-windows-msvc` host, or is another Windows target needed to satisfy Aquascope, Miri and distribution requirements? Resolved by T-066: use `x86_64-pc-windows-msvc`. The binaries need `VCRUNTIME140.dll`, and `rustc_driver-*.dll` lives in the toolchain's `bin`, not `lib`.
- Does the pinned nightly build and run Aquascope's Miri interpreter on Windows well enough to meet R5, or does the pin need a Windows-specific upstream/fork change? Resolved by T-066: `nightly-2026-05-01` with fork tag `v0.4.0-vscode.10` builds and runs both analyses offline (13 permission bodies for `n5_bst.rs`; 4, 11 and 30 interpreter steps for `01_move_string.rs`, `05_method_mut_borrow.rs` and a multi-file crate). No fork change is needed, but the extension must normalise Aquascope's backslash file paths (`src\lib.rs`) before comparing them with its own forward-slash paths.
- Can the Windows bundle fit the package check's current size cap, and what size limit should the Windows package check enforce? Resolved by T-066: the candidate bundle is 504.6 MiB uncompressed and 158.4 MiB zipped, under the current 200 MB cap, which the Windows check keeps.
- What supported Windows build environment and shell should `npm run package` require and document? Resolved by T-066: a native Windows x64 host with Visual Studio 2022 C++ build tools (x64), rustup and the pinned nightly; the exact shell is chosen in T-067.
- Does the Windows VSIX need signing or any additional user-facing installation guidance before it can be published? Still open; T-069 and T-071 decide after a clean-machine install.
