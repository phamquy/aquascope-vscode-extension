---
id: T-069
title: "Test Windows runtime and installation"
status: todo
priority: medium
feature: "012-windows-support"
created: 2026-11-16
---

# T-069 Test Windows runtime and installation

Spec: [[specs/features/012-windows-support/spec.md]]

## Done when

- [ ] Focused tests cover Windows environment-variable casing, DLL search path and cancellation of the Aquascope process tree, including a successful run after cancellation.
- [ ] Typecheck, lint and the full integration suite pass with `AQUASCOPE_REQUIRE_TOOLCHAIN=1` against the Windows bundle, with no toolchain test skipped.
- [ ] A clean supported Windows profile with no Rust installation and no network can install the VSIX and render a permissions diagram and stack-and-heap trace.

## Notes
