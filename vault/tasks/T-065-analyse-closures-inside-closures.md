---
id: T-065
title: "Analyse closures inside closures"
status: review
priority: medium
feature: "003-run-analysis-at-cursor"
created: 2026-11-15
---

# T-065 Analyse closures inside closures

Spec: [[specs/features/003-run-analysis-at-cursor/spec.md]]

## Done when

- [x] The fork borrow-checks a closure's typeck root before the closure itself, with a test in Aquascope's suite that fails without it; tag `v0.4.0-vscode.10` is pushed
- [x] `pin.env` names the tag, the development bundle is rebuilt, the bindings regenerated, and ADR 0004 records the change
- [x] An end-to-end test analyses `n8_nested_closures.rs`, which failed with exit code 101: `parallel_sum_scoped` has boundaries and steps

## Notes

- Reported 2026-11-15: Analyze Function at Cursor on a `parallel_sum_scoped` that spawns a `move` closure inside the closure given to `std::thread::scope` failed with "Aquascope failed with exit code 101". rustc's borrow checker panicked with "no entry found for key" (`rustc_borrowck/src/root_cx.rs:190`). rustc_utils' `get_body_with_borrowck_facts` borrow-checks a closure through `local_parent`, which for a closure inside a closure is the outer closure, not the typeck root, and `nested_bodies_within` of the outer closure leaves out the inner one. Aquascope visits bodies innermost first, so any closure inside a closure crashes the whole crate; a single closure does not.
- Fork: commit `b511bb9`, branch `nested-closure-borrowck`, [phamquy/aquascope#1](https://github.com/phamquy/aquascope/pull/1). It is prevented rather than caught like T-064's panic, because it happens inside a rustc query. The proper fix belongs in rustc_utils (borrow-check the typeck root, not the immediate parent).
- Extension: new fixture `n8_nested_closures.rs`, which failed with exit code 101 on `v0.4.0-vscode.9`. Across 23 fixture files only it changes (`parallel_sum_scoped` 14 boundaries and 7 steps). `n4_linked_stack` and `n5_bst` list some fields of a step's state in a different order from run to run with both versions, which predates this change. The packaging script's strict run against the bundle built from the new pin, with typecheck and lint: 235 passing, 0 failing. Development bundle rebuilt; bindings regenerated, with the types unchanged.
