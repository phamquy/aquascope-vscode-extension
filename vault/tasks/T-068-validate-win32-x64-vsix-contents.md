---
id: T-068
title: "Validate win32-x64 VSIX contents"
status: todo
priority: medium
feature: "012-windows-support"
created: 2026-11-16
---

# T-068 Validate win32-x64 VSIX contents

Spec: [[specs/features/012-windows-support/spec.md]]

## Done when

- [ ] The VSIX checker accepts a valid `win32-x64` package and verifies its manifest target, required `.exe` and `.dll` files, Miri sysroot, notices, size and build-path cleanliness.
- [ ] Checker tests or controlled package cases prove that a wrong target, missing required file, over-limit package or embedded build-machine path is rejected.

## Notes
