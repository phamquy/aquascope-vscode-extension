---
id: T-045
title: "Add the file option and result paths to the fork"
status: todo
priority: medium
feature: "008-whole-crate-analysis"
created: 2026-11-09
---

# T-045 Add the file option and result paths to the fork

Spec: [[specs/features/008-whole-crate-analysis/spec.md]]

## Done when

- [ ] The fork has the file option and the path field, on results and on build errors (D3, revised), on a branch from `v0.4.0-vscode.1`, each with a test in Aquascope's suite
- [ ] `cargo fmt --check`, `cargo clippy -p aquascope -- -D warnings` and `cargo test -p aquascope` pass
- [ ] Tag `v0.4.0-vscode.2` is pushed, and both changes are offered upstream
- [ ] `pin.env` names the tag, the development bundle is rebuilt and the bindings are regenerated
- [ ] ADR 0004 lists the fork's changes
- [ ] The existing tests pass with captures that lack the path field

## Notes

- Plan: [[specs/features/008-whole-crate-analysis/plan.md]].
