---
id: T-066
title: "Probe pinned Windows Aquascope and Miri compatibility"
status: review
priority: medium
feature: "012-windows-support"
created: 2026-11-16
---

# T-066 Probe pinned Windows Aquascope and Miri compatibility

Spec: [[specs/features/012-windows-support/spec.md]]

## Done when

- [x] On a native Windows x64 host, build the pinned Aquascope fork with the pinned nightly and assemble the candidate Windows toolchain and Miri sysroot.
- [x] Run representative permissions and interpreter fixtures with that candidate, and record the Windows version, Rust host triple, build prerequisites, package size and results.
- [x] If the pinned toolchain cannot meet the approved Windows requirements, revise the spec and obtain approval before implementation; otherwise resolve the support decisions in the spec.

## Notes

Host: Windows 11 Pro x64 build 26300, Rust host `x86_64-pc-windows-msvc`, Visual Studio 2022 Community x64 C++ tools. Pin: `nightly-2026-05-01` with `rust-src`, `rustc-dev`, `llvm-tools` and `miri`; fork tag `v0.4.0-vscode.10` (`b511bb9ae55a76a814ecbdb85aac44da746e7a21`).

The candidate bundle (Aquascope executables, rustc/cargo/rust-std files and the Miri sysroot) is 504.6 MiB uncompressed and 158.4 MiB zipped, under the 200 MB VSIX cap. `rustc_driver-*.dll` is in the toolchain's `bin`, and the executables need `VCRUNTIME140.dll`.

Offline results: permissions on `n5_bst.rs` returned 13 bodies; interpreter traces produced 4 steps for `01_move_string.rs`, 11 for `05_method_mut_borrow.rs` and 30 for a multi-file minigrep crate. The pinned toolchain meets the requirements, so the spec's open questions are resolved rather than revised.

Found for later tasks: Aquascope reports `src\lib.rs` on Windows while `src/analysis/project.ts` produces `src/lib.rs`, so crate permissions (`select.ts`) and Miri steps (`interpret.ts`, `traceInput.ts`) are discarded until paths are normalised. The Windows test suite also assumes LF fixtures, POSIX absolute paths and extensionless executables. With the candidate bundle the suite had 195 passing, 10 pending and 29 failing; some crate tests exit 101 for an unestablished reason. These belong to T-067/T-069.

The probe changes no code, so `npm run typecheck` and `npm run lint` pass and `npm test` matches `main` on Windows (155 passing, 71 pending, 8 failing, all pre-existing Windows test-portability failures).
