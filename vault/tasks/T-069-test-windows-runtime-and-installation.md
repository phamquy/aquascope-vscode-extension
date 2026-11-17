---
id: T-069
title: "Test Windows runtime and installation"
status: done
priority: medium
feature: "012-windows-support"
created: 2026-11-16
---

# T-069 Test Windows runtime and installation

Spec: [[specs/features/012-windows-support/spec.md]]

## Done when

- [x] Focused tests cover Windows environment-variable casing, DLL search path and cancellation of the Aquascope process tree, including a successful run after cancellation.
- [x] Typecheck, lint and the full integration suite pass with `AQUASCOPE_REQUIRE_TOOLCHAIN=1` against the Windows bundle, with no toolchain test skipped.
- [x] A clean supported Windows profile with no Rust installation and no network can install the VSIX and render a permissions diagram and stack-and-heap trace.

## Notes
Baseline on Windows 11 with the T-067 bundle: 210 passing, 10 pending, 29 failing. Now 247 passing, 9 pending, 0 failing with `AQUASCOPE_REQUIRE_TOOLCHAIN=1` and typecheck and lint clean.

Product fix: Aquascope and cargo name files with backslashes on Windows (`src\lib.rs`), so crate permissions and Miri steps were discarded. `fromToolPath` (`positions.ts`) now normalises the result paths in `select.ts`, the trace frames in `interpret.ts` and the compile-error places in `errors.ts`; `toolPaths.test.ts` covers it on any platform.

Test portability: fixtures are checked out with LF through `.gitattributes` (the suite compares LF text); the toolchain, harness and project tests use `.exe` names and `path.resolve`; the log pattern accepts backslashes. The test instance's user-data folder is under the temp folder on Windows (see below). `AQUASCOPE_TEST_GREP` runs a subset of the suite.

AC5 on Windows: `runner.test.ts` has a Windows suite (timeout and cancel kill a node child and grandchild; a later run completes), and the real-toolchain cancel and timeout tests now run on Windows, finding the processes started from the bundle with PowerShell, plus a test that an analysis completes after a cancelled one. Environment-variable casing and the DLL directory on PATH were already covered by `toolchain.test.ts`.

Still pending on Windows: the POSIX-only runner tests that use `sh`, and the AC6 linker test, because rustc finds `link.exe` through the Visual Studio installation, not PATH, so a PATH cannot hide it; the extension's linker message also names `cc`. Both go to T-070 as limitations to state.

Measured limitation for T-070: `link.exe` fails with LNK1104 when a build script's output path passes 260 characters. With the repository's default `.vscode-test` user-data folder it was 262 for the `targets` fixture; with VS Code's real storage folder (`%APPDATA%\Code\User\globalStorage\psyquy.aquascope-vscode-extension\projects\<hash>\target\plugin-nightly-2026-05-01\debug\build\<package>-<hash>\build_script_build-<hash>.exe`) it is about 224 characters for a three-word package name, so a longer user name or package name can hit it.

Clean profile (third criterion): there is no Windows Sandbox or clean machine here. As the closest check, I built the VSIX from the bundle (162.4 MB), extracted it into an empty folder, and ran `cargo aquascope permissions` and `interpreter` on `01_move_string.rs` through the extension's own `resolveToolchain` and `runEnvironment` with Rust removed from PATH and the home, cargo and rustup folders empty: 1 permissions body and 4 interpreter steps. That does not test a profile without the Visual C++ runtime, Windows 10, or no network, nor the Extensions view install, so a person must install the VSIX on a clean machine and render both views before this criterion is ticked.

The maintainer then installed the win32-x64 VSIX into a clean profile and the clean-profile test passed, so the criterion is met.
