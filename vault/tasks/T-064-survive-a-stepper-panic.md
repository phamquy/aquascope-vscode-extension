---
id: T-064
title: "Survive a stepper panic"
status: done
priority: medium
feature: "003-run-analysis-at-cursor"
created: 2026-11-13
---

# T-064 Survive a stepper panic

Spec: [[specs/features/003-run-analysis-at-cursor/spec.md]]

## Done when

- [x] The fork catches a panic in the permission steps like an error, with a test in Aquascope's suite that fails without it; tag `v0.4.0-vscode.9` is pushed
- [x] `pin.env` names the tag, the development bundle is rebuilt, the bindings regenerated, and ADR 0004 records the change
- [x] An end-to-end test analyses `n7_loop_break.rs`, which failed with exit code 101: `count` keeps its boundaries, `describe` has steps

## Notes
- Reported 2026-11-13 as #68, found in feature 010's spike: a plain `loop { if … { break; } … }` makes the stepper panic ("index out of bounds" in `get_branch_scope`), and the panic aborted the whole crate. Spec 010 decided to catch it (D4); the stepper's handling of that loop is left for later.
- Fork: commit `8bda2ab`, branch `catch-stepper-panic`.
- Extension: new fixture `n7_loop_break.rs`, which failed with exit code 101 on `v0.4.0-vscode.8`; across 22 fixture files only it changes (`count` 0 steps and 4 boundaries, `describe` 3 steps). The panic's message still goes to Aquascope's stderr, which the output channel logs, followed by the fork's warning. `npm test`: 234 passing, 0 failing; typecheck and lint pass.
