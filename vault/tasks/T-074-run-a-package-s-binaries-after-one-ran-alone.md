---
id: T-074
title: "Run a package's binaries after one ran alone"
status: review
priority: medium
feature: "009-whole-crate-stack-heap"
created: 2026-11-17
---

# T-074 Run a package's binaries after one ran alone

Spec: [[specs/features/009-whole-crate-stack-heap/spec.md]]

## Done when

- [x] The fork removes a library's earlier build from the host's `debug/deps` before the interpreter analyses the library, with a unit test, in tag `v0.4.0-vscode.13`, which is pushed
- [x] `pin.env` names the tag, the development bundle is rebuilt, and ADR 0004 records the change
- [x] An end-to-end test with the `lib-and-bins` fixture runs `src/bin/tool.rs`, which runs alone, and then `src/main.rs`, which runs with the library, and the second printed nothing on the previous bundle

## Notes

- Found during T-073 and reported 2026-11-17 ([#85](https://github.com/phamquy/aquascope-vscode-extension/issues/85)): after one binary of a package ran alone, every later run of a binary built with its library failed with "Aquascope's output could not be read (no output)" until the library's source changed.
- Cause: a binary that runs alone builds the library as a plain dependency in the interpreter's build folder, and Cargo then reuses that build instead of running the plugin on the library. rustc_plugin removes a library's files before analysing it for this reason, but from `debug/deps`, while the interpreter builds for the host triple into `<host>/debug/deps`. Cargo's verbose output shows `Fresh lib-and-bins`.
- Fork: commit `3d2df9a`, branch `forget-library-metadata`, [phamquy/aquascope#4](https://github.com/phamquy/aquascope/pull/4). `modify_cargo` removes `lib<package>-*` from the host's `debug/deps` when the interpreter adds `--target`, reading the folder, the package and `--lib` from rustc_plugin's command. It also clears a stale library an earlier version left, so a user's storage needs no cleaning: the end-to-end test passed after a failing run had left one in place.
- Extension: new fixture `lib-and-bins`, a library with `src/main.rs` and `src/bin/tool.rs`, whose `crate::util` path keeps it from building as one crate with the library. It is also the first end-to-end test of the run-alone fallback.
- Checks: `npm run typecheck`, `npm run lint` and `npm test` against the development bundle built from `3d2df9a` pass, with 262 passing and 2 pending (the process-kill tests that do not run on macOS). In the fork, `cargo fmt --check`, `cargo clippy -p aquascope -p aquascope_front -- -D warnings` and `cargo test -p aquascope -p aquascope_front` pass. The packaging script's strict run from the new pin was not done; the release workflow builds both packages from it.
