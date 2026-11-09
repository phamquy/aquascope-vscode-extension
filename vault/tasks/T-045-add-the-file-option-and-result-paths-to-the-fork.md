---
id: T-045
title: "Add the file option and result paths to the fork"
status: review
priority: medium
feature: "008-whole-crate-analysis"
created: 2026-11-09
---

# T-045 Add the file option and result paths to the fork

Spec: [[specs/features/008-whole-crate-analysis/spec.md]]

## Done when

- [x] The fork has the file option and the path field, on results and on build errors (D3, revised), on a branch from `v0.4.0-vscode.1`, each with a test in Aquascope's suite
- [x] `cargo fmt --check`, `cargo clippy -p aquascope -- -D warnings` and `cargo test -p aquascope` pass
- [x] Tag `v0.4.0-vscode.2` is pushed, and both changes are offered upstream
- [x] `pin.env` names the tag, the development bundle is rebuilt and the bindings are regenerated
- [x] ADR 0004 lists the fork's changes
- [x] The existing tests pass with captures that lack the path field

## Notes

- Plan: [[specs/features/008-whole-crate-analysis/plan.md]].
- Done on 2026-11-09, in the fork [phamquy/aquascope](https://github.com/phamquy/aquascope). Each change is one commit on its own branch from upstream v0.4.0, for its upstream pull request, and both are applied on `vscode-v0.4.0`, the branch of `v0.4.0-vscode.1`, tagged `v0.4.0-vscode.2` at `467a9ae`.
  - `--crate-of <file>` (D2), branch `crate-of-option`, upstream [#201](https://github.com/cognitive-engineering-lab/aquascope/pull/201): an option of `AquascopePluginArgs` that `crate_filter()` maps to rustc_plugin's `CrateContainingFile`, `OnlyWorkspace` without it. Unit test in `aquascope_front/src/plugin.rs`.
  - `file_path` on `AnalysisOutput` and on `AquascopeError::BuildError` (D3, revised), branch `file-paths`, upstream [#202](https://github.com/cognitive-engineering-lab/aquascope/pull/202): from the body span's source file, as `CharRange::from_span` reads it, in a public `span_file_path`; the interpreter's build errors get `None`. Test `crates/aquascope/tests/file_path.rs`: one body that builds and one that does not each name `dummy.rs`, counted outside the callback.
- On `vscode-v0.4.0`: `cargo fmt --check`, `cargo clippy -p aquascope -p aquascope_front -- -D warnings` (and with `--all-targets` for `aquascope_front`), and `cargo test -p aquascope -p aquascope_front` pass: 70 unit tests, #199's, #201's and #202's tests, and the snapshot suites unchanged.
- `pin.env` names the tag; spike 002's checkout was moved to it and `build.sh` rebuilt the development bundle; `scripts/export-aquascope-types.sh` regenerated the bindings, which differ only by the two `file_path` fields. The rebuilt binaries, run with `--crate-of` on T-044's broken minigrep, name the failing function's file (`src/lib.rs`, line 21), which the prototype could not.
- ADR 0004 has a revision listing the three commits and their upstream pull requests; the README, `specs/product.md` and the fixture data README follow. Spec D3 now says the path is relative to the workspace root, as the probe found, not to the crate.
- The captures in `src/test/fixtures/data/crate/` come from T-044's prototype, whose build errors had no path; T-049, which reads them, recaptures them with the pinned fork.
- The first `npm test` failed feature 007's AC4: `stackHeap.test.ts` looked for the interpreter's exact output, `{"Err":{"type":"BuildError","range":null}}`, and the fork now adds `"file_path":null` to it. The test now matches the build error's start, so it holds with and without the field. The extension's classification of the interpreter's output was unaffected.
