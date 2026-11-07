---
id: T-031
title: "Build and assemble the bundle"
status: todo
priority: medium
feature: "005-package-per-platform-vsix"
created: 2026-11-07
---

# T-031 Build and assemble the bundle

Spec: [[specs/features/005-package-per-platform-vsix/spec.md]]

## Done when

- [ ] `scripts/package-platform.sh` checks the platform and the pin, builds the binaries, and fills `build/bundle/` with the binaries, the trimmed toolchain keeping its licence files, Aquascope's `LICENSE` and the crate notices from `scripts/crate-notices.mjs`; AC6 recorded; R1–R4, R6, R7, D4; needs your approval for the rustup and cargo downloads

## Notes
