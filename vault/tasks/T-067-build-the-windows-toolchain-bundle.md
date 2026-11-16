---
id: T-067
title: "Build the Windows toolchain bundle"
status: todo
priority: medium
feature: "012-windows-support"
created: 2026-11-16
---

# T-067 Build the Windows toolchain bundle

Spec: [[specs/features/012-windows-support/spec.md]]

## Done when

- [ ] `npm run package` can stage the Windows Aquascope binaries, pinned toolchain, Miri sysroot and required licence files on the supported Windows host.
- [ ] The packaging path uses Windows-compatible executable names, DLL loading paths and host-specific trimming, and leaves no staged bundle after success or failure.
- [ ] The existing darwin-arm64 packaging and tests remain unchanged and passing.

## Notes
