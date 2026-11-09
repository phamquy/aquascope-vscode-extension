---
id: T-048
title: "Analyse the function at the cursor in its crate"
status: todo
priority: medium
feature: "008-whole-crate-analysis"
created: 2026-11-09
---

# T-048 Analyse the function at the cursor in its crate

Spec: [[specs/features/008-whole-crate-analysis/spec.md]]

## Done when

- [ ] A file in a package is analysed in its copied crate with the fork's file option
- [ ] The first run per project runs preload with its own progress, no timeout and cancel
- [ ] Results are kept for the active file and the body at the cursor is selected; other files keep feature 003's analysis
- [ ] End-to-end tests for AC1 to AC3 and AC9 pass against the development bundle
- [ ] The extension is checked by hand to be disabled in Restricted Mode, and the result recorded

## Notes

- Plan: [[specs/features/008-whole-crate-analysis/plan.md]].
