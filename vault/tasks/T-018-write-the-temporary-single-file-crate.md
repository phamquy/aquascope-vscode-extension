---
id: T-018
title: "Write the temporary single-file crate"
status: done
priority: medium
feature: "003-run-analysis-at-cursor"
created: 2026-11-06
---

# T-018 Write the temporary single-file crate

Spec: [[specs/features/003-run-analysis-at-cursor/spec.md]]

## Done when

- [x] unit tests cover edition detection (package, workspace inheritance, no Cargo.toml, unreadable file), the generated `Cargo.toml` and `src/lib.rs` contents, and deletion of older run directories (R2, R9)

## Notes

- `src/analysis/scratchCrate.ts`: `detectEdition(file | undefined)` and `writeCrate(storage, source, edition)`, which returns the crate directory `<storage>/runs/<pid>-XXXXXX`. The `Cargo.toml` is byte-for-byte the one `spikes/003-single-file-crate/probe.sh` validated.
- Edition: nearest `Cargo.toml`; `edition.workspace = true` and `edition = { workspace = true }` are followed to the nearest ancestor with a workspace table; a `[package]` without an edition gets 2015 (cargo's rule); a virtual manifest gives its `[workspace.package]` edition; anything unreadable gives 2024. R2 clarified.
- Cleanup: global storage is shared by all windows, so run directories carry the extension host's pid; a run deletes its own host's earlier runs and those of hosts that have exited, and keeps a live window's run. A failed delete never blocks the new run. R9 clarified.
- `src/test/suite/scratchCrate.test.ts`: 9 tests.

