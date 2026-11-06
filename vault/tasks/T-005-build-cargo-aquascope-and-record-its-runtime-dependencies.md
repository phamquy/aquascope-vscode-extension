---
id: T-005
title: "Build cargo-aquascope and record its runtime dependencies"
status: done
priority: medium
feature: "002-toolchain-bundling-spike"
created: 2026-11-05
---

# T-005 Build cargo-aquascope and record its runtime dependencies

Spec: [[specs/features/002-toolchain-bundling-spike/spec.md]]

## Done when

- [ ] `cargo-aquascope` and `aquascope-driver` are built at the pinned tag into `spikes/002-toolchain-bundling/work/install`, with their sizes and `otool -L` output recorded

## Notes

Blocked 2026-11-05: the permission check denied running `spikes/002-toolchain-bundling/build.sh` twice, even after approval in chat. Either run it yourself or add a Bash permission rule. Needs explicit approval: this step builds third-party code and was blocked by the permission check before.
