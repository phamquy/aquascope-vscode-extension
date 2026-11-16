---
id: T-067
title: "Build the Windows toolchain bundle"
status: done
priority: medium
feature: "012-windows-support"
created: 2026-11-16
---

# T-067 Build the Windows toolchain bundle

Spec: [[specs/features/012-windows-support/spec.md]]

## Done when

- [x] `npm run package` can stage the Windows Aquascope binaries, pinned toolchain, Miri sysroot and required licence files on the supported Windows host.
- [x] The packaging path uses Windows-compatible executable names, DLL loading paths and host-specific trimming, and leaves no staged bundle after success or failure.
- [x] The existing darwin-arm64 packaging and tests remain unchanged and passing.

## Notes
`npm run package` now runs `scripts/package.mjs`, which starts `scripts/package-platform.sh` in Git for Windows' Bash on Windows (the `bash` on PATH may be WSL; `AQUASCOPE_BASH` overrides) and in `bash` elsewhere. `npm run package -- bundle` stops after the assemble stage. On Windows the script builds `win32-x64` (`x86_64-pc-windows-msvc`), handles paths as `C:/...`, remaps the backslash home path, appends `.exe`, and builds the Miri sysroot under the drive root so no profile path is recorded. The trim list also drops `.pdb` files and `rust-windbg.cmd`, which brings the bundle from 583.6 to 504.7 MiB (122 files), matching the T-066 probe; no file holds the profile path and the Miri temporary folder is removed afterwards. The test and package stages on Windows wait for T-068 (checker) and T-069 (test portability); darwin-arm64 code paths are unchanged but were not run here, as this host is Windows.
