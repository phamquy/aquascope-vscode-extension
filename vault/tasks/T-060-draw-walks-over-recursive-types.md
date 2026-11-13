---
id: T-060
title: "Analyse walks over recursive types"
status: review
priority: medium
feature: "003-run-analysis-at-cursor"
created: 2026-11-13
---

# T-060 Analyse walks over recursive types

Spec: [[specs/features/003-run-analysis-at-cursor/spec.md]]

## Done when

- [x] The fork adds every place the body uses to its table of tracked places, with a test in Aquascope's suite; tag `v0.4.0-vscode.6` is pushed
- [x] `pin.env` names the tag, the development bundle is rebuilt and the bindings regenerated; ADR 0004 records the change
- [x] An end-to-end test fails on the previous bundle and passes on the new one: the binary search tree's `remove_rec`, `insert` and `next` are analysed

## Notes
- Reported 2026-11-13 as #64: `n5_bst.rs` failed with exit code 101. Cause: a panic at `context.rs:97` reached from `path_to_perm_boundary`; minimal case `fn f(mut min: Box<Node>) { let mut r = &mut min; while let Some(ref mut l) = r.left { r = l; } }`. The fix in #62 (T-058) made only the move relation tolerant.
- Fix: `50af5a4`, tag `v0.4.0-vscode.6`, branch `place-table-used-places` in the fork. Chosen over skipping the place because a skipped boundary would silently drop an annotation the user expects.
- `npm test` on the new bundle: the new test passes; typecheck and lint pass. Two full runs under a machine load average of 13 to 19 had 3 and then 2 failures, all in `runner.test.ts` (the grandchild-pid tests and the no-timeout test of feature 008, which wait a fixed 200 to 300 ms for a shell to start); 221 passing in the second run. They do not touch Aquascope.
