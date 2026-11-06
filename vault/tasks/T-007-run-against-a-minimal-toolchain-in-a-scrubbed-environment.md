---
id: T-007
title: "Run against a minimal toolchain in a scrubbed environment"
status: done
priority: medium
feature: "002-toolchain-bundling-spike"
created: 2026-11-05
---

# T-007 Run against a minimal toolchain in a scrubbed environment

Spec: [[specs/features/002-toolchain-bundling-spike/spec.md]]

## Done when

- [ ] A minimal toolchain (rustc, cargo, rust-std from the official tarballs) runs every fixture under `env -i` with no rustup on PATH, and `compare.sh` shows the JSON matches the baseline, or each failure is recorded with the component that fixes it (answers Q1, Q2)

## Notes
