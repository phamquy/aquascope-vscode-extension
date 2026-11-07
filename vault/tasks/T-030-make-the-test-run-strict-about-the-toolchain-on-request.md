---
id: T-030
title: "Make the test run strict about the toolchain on request"
status: todo
priority: medium
feature: "005-package-per-platform-vsix"
created: 2026-11-07
---

# T-030 Make the test run strict about the toolchain on request

Spec: [[specs/features/005-package-per-platform-vsix/spec.md]]

## Done when

- [ ] with `AQUASCOPE_REQUIRE_TOOLCHAIN=1`, a missing bundle stops `npm test` and a toolchain test fails instead of skipping, the default still skips, and harness tests cover both; R5, AC4

## Notes
