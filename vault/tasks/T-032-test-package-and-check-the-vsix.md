---
id: T-032
title: "Test, package and check the VSIX"
status: todo
priority: medium
feature: "005-package-per-platform-vsix"
created: 2026-11-07
---

# T-032 Test, package and check the VSIX

Spec: [[specs/features/005-package-per-platform-vsix/spec.md]]

## Done when

- [ ] the script runs the strict tests against the bundle, packages `darwin-arm64` with the bundle at the root only for `vsce`, removes it on every exit, deletes the previous VSIX first, and `scripts/check-vsix.sh` passes AC1 to AC3; `npm run package` runs it; AC4 and AC7 recorded; R5, R8, R9

## Notes
