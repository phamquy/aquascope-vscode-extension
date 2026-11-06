---
id: 003-run-analysis-at-cursor
title: Run analysis on the function at the cursor
status: approved
---

# Run analysis on the function at the cursor

## Why

The extension's core value is showing a learner how ownership and permissions flow through the function they are looking at. Before anything can be drawn (feature 004), the extension must run Aquascope on the user's code and get back the analysis for that function. This feature delivers that step: a command that runs the bundled `cargo-aquascope` on the current Rust file, picks the result for the function under the cursor, and hands it to the rest of the extension, with clear errors when it cannot.

Spike 002 settled how to run the tool, and three behaviours of Aquascope shaped the decisions below. It analyses every function body in a crate in one run, with no option to analyse just one, so the extension selects the body under the cursor itself. It names files in its results only by an opaque index, so results from a multi-file crate cannot yet be mapped back to files. And a function that fails borrow checking yields only a build error unless `--should-fail` is passed, while explaining borrow-check failures is the main reason a learner opens this tool. The evidence is in Appendix A.

The first version therefore analyses the current file on its own, copied into a temporary single-file crate, the same way the mdBook plugin analyses a book example. That keeps the user's project untouched, needs no network and no linker, and makes every result's position refer to the file being edited. Its limit is that a file which uses other modules of its crate, or external crates, cannot be analysed; such files get a clear message, and whole-crate analysis is left to a later feature.

## Decisions

Recorded 2026-11-05 from the review of the first draft.

- D1 (was Q1/Q2): Analyse the current file alone in a temporary single-file crate, inside and outside Cargo packages.
- D2 (was Q4): Trigger by command only in this version.
- D3 (was Q8): Packaging the toolchain into per-platform VSIX files becomes feature 005; until then development and tests use the `aquascope.toolchainPath` setting.

## User stories

- As a Rust learner, I want to run "Aquascope: Analyze Function at Cursor" in a Rust file and get the ownership analysis for the function my cursor is in, so that I can see how permissions change through it.
- As a Rust learner whose code fails borrow checking, I want the analysis to still run, so that I can see which permission is missing and why the compiler rejects the code.
- As a learner experimenting in a file, I want my unsaved edits analysed, so that I do not have to save after every change.
- As a user whose file depends on other modules or crates, I want to be told plainly that this version analyses one self-contained file, instead of seeing a raw compiler error.

## Requirements

- R1: The extension contributes a command `aquascope.analyzeAtCursor`, titled "Aquascope: Analyze Function at Cursor", available when the active editor is a Rust file. The extension activates on this command only, so activation stays cheap (constitution 3).
- R2: The command analyses the active editor's current text, including unsaved changes. It writes that text as `src/lib.rs` of a temporary library crate in the extension's storage, so that files with and without a `main` function both compile. The crate's edition is the one declared by the nearest enclosing `Cargo.toml`, if there is one, and otherwise 2024. The crate has no dependencies.
- R3: The tool location is resolved in this order: the `aquascope.toolchainPath` setting, if set; otherwise the bundle shipped inside the extension (feature 005). Both use the layout from spike 002: `<root>/bin/` holds `cargo-aquascope` and `aquascope-driver`, and `<root>/toolchain/` holds the trimmed nightly. If neither exists, the command fails with an error that says so and names the setting.
- R4: The tool runs as a child process in the temporary crate, with the environment spike 002 established: `PATH` starts with `<root>/bin` and `<root>/toolchain/bin`, followed by the user's `PATH`; the library path points at `<root>/toolchain/lib` (`DYLD_LIBRARY_PATH` on macOS, `LD_LIBRARY_PATH` on Linux, `PATH` on Windows); and variables that would change how the compiler runs (`RUSTC`, `RUSTC_WRAPPER`, `RUSTC_WORKSPACE_WRAPPER`, `RUSTUP_TOOLCHAIN`, `RUSTFLAGS`, `CARGO_TARGET_DIR`, `CARGO_BUILD_*`) are removed.
- R5: The run never uses the network (constitution 6). It sets `CARGO_NET_OFFLINE=true`; the temporary crate has no dependencies, so nothing needs downloading.
- R6: The analysis produces results for functions that fail borrow checking. How (always passing `--should-fail`, or retrying with it) is open question Q1.
- R7: The extension parses the tool's JSON output, one result per function body, and selects the body whose range contains the cursor, preferring the innermost when ranges nest. Positions refer directly to the analysed text because the crate has a single file. If no body contains the cursor, the command says so. Result order is not stable between runs (spike 002), so nothing may depend on it.
- R8: The run never blocks the extension host. It shows a cancellable progress notification; cancelling, or exceeding `aquascope.analysisTimeoutSeconds` (default 60), kills the process and its children.
- R9: Nothing is written outside the extension's storage. Each run uses a fresh temporary crate, and old crates are removed.
- R10: Failures are reported as actionable messages, recognised from the exit code and stderr: tool not found; the file refers to modules or crates that a single file cannot provide (unresolved `mod`, `use` or `extern crate`), explained as a limit of this version; other compile errors that are not borrow-check errors, pointing the user to the compiler output; timeout; and any other failure, with the log available.
- R11: Every run is logged to an "Aquascope" output channel: the command line, the environment variables the extension set, the duration, the exit code and stderr.
- R12: The selected result is exposed to the rest of the extension through a typed interface that feature 004 will consume. The types follow Aquascope's own result types for the pinned version.
- R13: Until feature 004 exists, the command shows a short summary of the selected result (function range, counts of permission steps and boundaries) and writes the full JSON to the output channel, so the feature is usable and testable on its own.
- R14: The new settings `aquascope.toolchainPath` and `aquascope.analysisTimeoutSeconds` are declared in `contributes.configuration` and documented in the README (constitution 4).

## Acceptance criteria

- [ ] AC1: With `aquascope.toolchainPath` pointing at the spike 002 trimmed bundle, running the command with the cursor inside `main` of each spike 002 program fixture returns an `Ok` result whose range contains the cursor, in under 10 seconds on darwin-arm64.
- [ ] AC2: For the borrow-check failure fixture (`04_push_while_borrowed_fail`), the command returns the permission analysis, not a build error.
- [ ] AC3: For the method fixture (`05_method_mut_borrow`), the cursor inside `grow`, `area` and `main` selects each of those three bodies respectively.
- [ ] AC4: With the cursor outside any function, the command reports that and shows no stale result.
- [ ] AC5: An unsaved edit is analysed: after changing a fixture in the editor without saving, the result reflects the edited text.
- [ ] AC6: A file containing `mod other;` or `use serde::Serialize;` produces the single-file limit message, not a raw compiler error.
- [ ] AC7: With no tool at either location, the message names the `aquascope.toolchainPath` setting.
- [ ] AC8: Cancelling a run, or a run exceeding the timeout, leaves no `cargo-aquascope`, `cargo` or `aquascope-driver` process running.
- [ ] AC9: A run writes nothing outside the extension's storage: the workspace folder is unchanged afterwards.
- [ ] AC10: Integration tests cover AC1 to AC7 and AC9, compare results without depending on order, and pass in `npm test`.
- [ ] AC11: Both settings appear in VS Code's settings UI with descriptions, and the README documents them.

## Out of scope

- Rendering the analysis (feature 004).
- Packaging the toolchain into per-platform VSIX files and the CI that builds them (feature 005).
- Analysing a file together with the rest of its crate, its modules or its dependencies; this needs the file-mapping problem solved (Appendix A) and is a later feature.
- Code lens, run-on-save or any trigger other than the command.
- Verifying Linux and Windows; R4 states their library-path variable, but only darwin-arm64 is exercised here.
- Aquascope's interpreter (runtime) visualisation, which needs Miri.
- Caching results between runs.

## Open questions

- Q1: Should every run pass `--should-fail`? It bypasses the "body has errors" check; whether it changes results for code that compiles, and what it does for code with type errors rather than borrow errors, has not been tested. To be settled by a short experiment at the start of the plan.
- Q2: Does a single-file library crate (R2) give the same results as the binary crate the mdBook plugin and spike 002 used? Expected yes, to be confirmed by rerunning the spike 002 fixtures as `lib.rs`.

## Appendix A: Aquascope behaviour this spec relies on

Sources are in the pinned v0.4.0 checkout (`spikes/002-toolchain-bundling/work/src/aquascope`) and the `rustc_utils` 0.15.2-nightly-2026-05-01 crate.

| Behaviour | Evidence |
| --- | --- |
| One run analyses every function body in the workspace crates; there is no per-function filter | `crates/aquascope_front/src/plugin.rs`: `after_expansion` calls `find_bodies(tcx)` and pushes one result per body; `CrateFilter::OnlyWorkspace`; the `permissions` subcommand takes only `--steps-include-mode` and `--show-flows` |
| Output is a JSON list of `{"Ok": AnalysisOutput}` or `{"Err": AquascopeError}` | `crates/aquascope/src/analysis/mod.rs:280-309`; spike 002 outputs |
| `AnalysisOutput` holds `body_range`, `boundaries`, `steps`, `loan_points`, `loan_regions`, `move_points`, `move_regions` | `crates/aquascope/src/analysis/mod.rs:301-309` |
| Positions name files by an opaque index, serialised as `{"private_use_as_methods_instead": N}`; every spike 002 result has index 0 | `rustc_utils/src/source_map/filename.rs:11-13` (`FilenameIndex`) |
| A body with errors returns `BuildError { range }` unless `--should-fail` is passed | `crates/aquascope/src/analysis/mod.rs:331-338` |
| The mdBook plugin analyses each example as `src/main.rs` of a temporary `cargo new --bin` crate | `crates/mdbook-aquascope/src/preprocessor.rs:44-61` |
| Spike 002 fixture `05_method_mut_borrow` produced three results (`grow`, `area`, `main`) | `spikes/002-toolchain-bundling/work/results/*/05_method_mut_borrow.json` |
| Required environment and unstable result order | [docs/spikes/002-toolchain-bundling.md](../../../docs/spikes/002-toolchain-bundling.md), Q1/Q2 and Appendix C |
