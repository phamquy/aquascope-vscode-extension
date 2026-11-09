---
id: T-049
title: "Explain why a crate cannot be analysed"
status: todo
priority: medium
feature: "008-whole-crate-analysis"
created: 2026-11-09
---

# T-049 Explain why a crate cannot be analysed

Spec: [[specs/features/008-whole-crate-analysis/spec.md]]

## Done when

- [ ] `dependencyMissing`, `linkerMissing`, `compileErrors` with files and lines, and `unsupportedTarget` have their messages
- [ ] A crate failure's notification offers Analyze This File Alone, which runs feature 003's analysis
- [ ] Unit tests classify the probe's captures
- [ ] End-to-end tests for AC5, AC6 and AC10 pass

## Notes

- Plan: [[specs/features/008-whole-crate-analysis/plan.md]].
