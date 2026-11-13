---
id: T-062
title: "Step branches whose arms diverge"
status: done
priority: medium
feature: "010-stepper-early-exits"
created: 2026-11-13
---

# T-062 Step branches whose arms diverge

Spec: [[specs/features/010-stepper-early-exits/spec.md]]

## Done when

- [x] The fork takes a branch's join point from its continuing arms when some arms have type `!`, with snapshot tests for spec Appendix B cases 1 to 7 checked by hand and the existing snapshots unchanged
- [x] Analysis tests in the fork pin `remove_rec` as written and `if … { break; }` in a `loop` followed by more code as boundaries without steps, without a panic
- [x] `cargo fmt --check`, `clippy -D warnings` and `cargo test -p aquascope -p aquascope_front` pass; tag `v0.4.0-vscode.7` is pushed
- [x] `pin.env` names the tag, the development bundle is rebuilt, the bindings regenerated, and ADR 0004 records the change
- [x] End to end: `next` of `n5_bst.rs` and `Config::parse` of `n3_early_return.rs` have steps, `remove_rec` has none; the other functions' counts are unchanged

## Notes
- From the spike of 2026-11-13: commit `65e8999` on the local fork branch `spike-early-exit-stepper` (spec 010, Appendix B).
- Fork: commit `23a8486` on branch `step-diverging-arms`, fast-forwarded into `vscode-v0.4.0`, tag `v0.4.0-vscode.7`. Beyond the spike: the error path of `?` is left out of the tables (decided 2026-11-13, since every `?` line otherwise showed every live variable as dropped), and the `val` that `?` binds is not shown. A first filter on desugared patterns also hid the user's `for` variables and changed three existing snapshots; it was narrowed to `?`.
- Extension: across the 20 fixture files, every function's step and boundary counts are as on `v0.4.0-vscode.6` except `Config::parse` (0 to 10) and `next` (0 to 20). The issue #31 test and feature 011's note test assumed those had no steps and were updated. Feature 008's AC1 failed once because the test API kept only the output channel's last 500 lines and `Config::parse`'s JSON is now 1,501; the buffer is 20,000 lines.
- `npm test`: 232 passing, 0 failing; typecheck and lint pass.
