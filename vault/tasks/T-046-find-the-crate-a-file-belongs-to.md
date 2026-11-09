---
id: T-046
title: "Find the crate a file belongs to"
status: todo
priority: medium
feature: "008-whole-crate-analysis"
created: 2026-11-09
---

# T-046 Find the crate a file belongs to

Spec: [[specs/features/008-whole-crate-analysis/spec.md]]

## Done when

- [ ] `project.ts` reads the workspace root, the package and target holding the file, external path dependencies and the copy root from the bundled `cargo metadata`
- [ ] A file in no package goes to feature 003's analysis
- [ ] Files under `tests/`, `examples/` or `benches/` and `build.rs` are flagged as unsupported
- [ ] Unit tests cover these from captured metadata

## Notes

- Plan: [[specs/features/008-whole-crate-analysis/plan.md]].
