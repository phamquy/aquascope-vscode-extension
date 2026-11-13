---
id: T-063
title: "Step let-else"
status: todo
priority: medium
feature: "010-stepper-early-exits"
created: 2026-11-13
---

# T-063 Step let-else

Spec: [[specs/features/010-stepper-early-exits/spec.md]]

## Done when

- [ ] The `let … else` lowering is read, and the plan adjusted if it differs
- [ ] The fork opens a branch for a `let … else` whose `else` diverges, reusing T-062's join point, with a snapshot test checked by hand
- [ ] Fork checks pass; tag `v0.4.0-vscode.8` is pushed; the pin, bundle, bindings and ADR 0004 follow
- [ ] An end-to-end test on a new `let … else` fixture shows its steps (AC8); spec 010 is `implemented`

## Notes
