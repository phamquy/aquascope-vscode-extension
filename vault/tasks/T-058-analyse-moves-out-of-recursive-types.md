---
id: T-058
title: "Analyse moves out of recursive types"
status: review
priority: medium
feature: "003-run-analysis-at-cursor"
created: 2026-11-13
---

# T-058 Analyse moves out of recursive types

Spec: [[specs/features/003-run-analysis-at-cursor/spec.md]]

## Done when

- [x] The fork skips an untracked interior path of a moved place instead of panicking, with a test in Aquascope's suite; tag `v0.4.0-vscode.5` is pushed
- [x] `pin.env` names the tag, the development bundle is rebuilt and the bindings regenerated; ADR 0004 records the change
- [x] An end-to-end test fails on the previous bundle and passes on the new one: the linked stack's `pop` and `push` are analysed

## Notes
- Reported 2026-11-13 as #61: the Analyze button on a linked stack said Aquascope failed with exit code 101. Cause: a panic at `context.rs:97` in the fork's permissions analysis; minimal case `fn f(node: Box<Node>) { let _n = node.next; }` with `Node { next: Option<Box<Node>> }`. Not a regression: it fails the same on `v0.4.0-vscode.4`.
- Fix: `0bb6b88`, tag `v0.4.0-vscode.5`, branch `move-out-of-recursive` in the fork. The notification for a tool failure still gives only the exit code; the panic text is in the Aquascope output.
- `analyze.test.ts` issue #61: `LinkedStack::pop` and `push` of `n4_linked_stack.rs` are analysed; it failed on the `v0.4.0-vscode.4` bundle with exit code 101 and passes on the new one. The generated types are unchanged; only the bindings README names the new tag.
- `npm test` on the new bundle: 219 passing, 2 failing (feature 006 AC2 and D4, the focus failures of #37). An earlier run stalled with timeouts across the suite while the machine was suspended and was discarded.
