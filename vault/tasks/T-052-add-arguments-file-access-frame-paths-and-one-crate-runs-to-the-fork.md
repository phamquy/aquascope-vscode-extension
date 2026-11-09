---
id: T-052
title: "Add arguments, file access, frame paths and one-crate runs to the fork"
status: todo
priority: medium
feature: "009-whole-crate-stack-heap"
created: 2026-11-09
---

# T-052 Add arguments, file access, frame paths and one-crate runs to the fork

Spec: [[specs/features/009-whole-crate-stack-heap/spec.md]]

## Done when

- [ ] The fork has the plan's five changes on a branch from `v0.4.0-vscode.2`: arguments and file access, whole-program builds, frame paths, the one-crate build and the interpreter's error message
- [ ] Each change has a test in Aquascope's suite, and `cargo fmt --check`, clippy and `cargo test -p aquascope` pass
- [ ] Tag `v0.4.0-vscode.3` is pushed, and changes 1, 2, 3 and 5 are offered upstream
- [ ] `pin.env` names the tag, the development bundle is rebuilt and the bindings regenerated
- [ ] ADR 0004 lists the fork's changes and why the one-crate change stays in the fork
- [ ] Feature 007's and 008's tests still pass

## Notes

- Plan: [[specs/features/009-whole-crate-stack-heap/plan.md]].
