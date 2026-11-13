---
id: T-063
title: "Step let-else"
status: review
priority: medium
feature: "010-stepper-early-exits"
created: 2026-11-13
---

# T-063 Step let-else

Spec: [[specs/features/010-stepper-early-exits/spec.md]]

## Done when

- [x] The `let … else` lowering is read, and the plan adjusted if it differs
- [x] The fork opens a branch for a `let … else` whose `else` diverges, reusing T-062's join point, with a snapshot test checked by hand
- [x] Fork checks pass; tag `v0.4.0-vscode.8` is pushed; the pin, bundle, bindings and ADR 0004 follow
- [x] An end-to-end test on a new `let … else` fixture shows its steps (AC8); spec 010 is `implemented`

## Notes
- Lowering: the pattern is one `switchInt` after the initializer for a simple pattern; the matching arm binds and runs straight into the next statement. A nested pattern (`Some(Ok(x))`) tests in two `switchInt`s and reaches the `else` block from both, which the plan's assumption (implicit child branches handle it) did not cover.
- Fork: commit `baacb6c` on branch `step-let-else`, fast-forwarded into `vscode-v0.4.0`, tag `v0.4.0-vscode.8`. Beyond the plan: the join point is now the first location after the expression that every non-diverging path passes through (same result for all of T-062's shapes, snapshots unchanged), a continuing arm starts past its `FalseEdge`, an initializer that is a plain place starts the test at the statement's entry, and two upstream bookkeeping bugs reached by the nested pattern are fixed (a panic on a child of a child branch, now an error; `close_branch` comparing against a non-representative table id).
- Known gap: an `else` arm whose `return` step falls in drop code shared with another exit, or that is reached from two tests, gets no table on its line (the fixture's first `else`, and the nested test's first `else`). Recorded in spec 010's Out of scope and ADR 0004.
- Extension: new fixture `n6_let_else.rs`; across 21 fixture files only it changes, 0 to 7 steps. `npm test`: 233 passing, 0 failing; typecheck and lint pass.
