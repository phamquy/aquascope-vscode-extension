---
id: 003-run-analysis-at-cursor
title: Run analysis on the function at the cursor
status: implemented
---
# Run analysis on the function at the cursor

## Why

The extension's core value is showing a learner how ownership and permissions flow through the function they are looking at. Before anything can be drawn (feature 004), the extension must run Aquascope on the user's code and get back the analysis for that function. This feature delivers that step: a command that runs the bundled `cargo-aquascope` on the current Rust file, picks the result for the function under the cursor, and hands it to the rest of the extension, with clear errors when it cannot.

Spike 002 settled how to run the tool, and three behaviours of Aquascope shaped the decisions below. It analyses every function body in a crate in one run, with no option to analyse just one, so the extension selects the body under the cursor itself. It names files in its results only by an opaque index, so results from a multi-file crate cannot yet be mapped back to files. And it silences the compiler's own error messages, reporting a function with type or name-resolution errors only as a bare build error, so the extension has to fetch the compiler's errors separately when it needs to explain one. Functions that fail only borrow checking, the main reason a learner opens this tool, are analysed normally. The evidence is in Appendix A, and the experiment behind the later decisions in Appendix B.

The first version therefore analyses the current file on its own, copied into a temporary single-file crate, the same way the mdBook plugin analyses a book example. That keeps the user's project untouched, needs no network and no linker, and makes every result's position refer to the file being edited. Its limit is that a file which uses other modules of its crate, or external crates, cannot be analysed; such files get a clear message, and whole-crate analysis is left to a later feature.

## Decisions

Recorded 2026-11-05 from the review of the first draft.

- D1 (was Q1/Q2): Analyse the current file alone in a temporary single-file crate, inside and outside Cargo packages.
- D2 (was Q4): Trigger by command only in this version.
- D3 (was Q8): Packaging the toolchain into per-platform VSIX files becomes feature 005; until then development and tests use the `aquascope.toolchainPath` setting.

Recorded 2026-11-06 from the T-013 experiment (Appendix B).

- D4 (was Q1): Runs never pass `--should-fail`. A function that fails only borrow checking is analysed fully without it, and the flag's one effect is to turn a function with type or name-resolution errors from an explicit build error into an empty result that would look like "nothing happens here".
- D5 (was Q2): The single-file library crate gives the same results as the binary crates spike 002 used, so R2 stands.
- D6 (new): Aquascope runs the compiler with its diagnostics silenced and reports a function that fails to build only as a build error covering the function's signature. The compiler's own errors therefore come from a plain `cargo check` of the same temporary crate, run only when the analysis cannot cover the cursor because of build errors; it takes about a tenth of a second.

### User stories

- As a Rust learner, I want to run "Aquascope: Analyze Function at Cursor" in a Rust file and get the ownership analysis for the function my cursor is in, so that I can see how permissions change through it.
- As a Rust learner whose code fails borrow checking, I want the analysis to still run, so that I can see which permission is missing and why the compiler rejects the code.
- As a learner experimenting in a file, I want my unsaved edits analysed, so that I do not have to save after every change.
- As a user whose file depends on other modules or crates, I want to be told plainly that this version analyses one self-contained file, instead of seeing a raw compiler error.

## Requirements

- R1: The extension contributes a command `aquascope.analyzeAtCursor`, titled "Aquascope: Analyze Function at Cursor", available when the active editor is a Rust file. The extension activates on this command only, so activation stays cheap (constitution 3).
- R2: The command analyses the active editor's current text, including unsaved changes. It writes that text as `src/lib.rs` of a temporary library crate in the extension's storage, so that files with and without a `main` function both compile. The crate's edition is the one declared by the nearest enclosing `Cargo.toml`, if there is one, and otherwise 2024; an edition inherited from the workspace is followed to the workspace root, and a package that declares none gets 2015, as cargo gives it. The crate has no dependencies.
- R3: The tool location is resolved in this order: the `aquascope.toolchainPath` setting, if set; otherwise the bundle shipped inside the extension (feature 005). Both use the layout from spike 002: `<root>/bin/` holds `cargo-aquascope` and `aquascope-driver`, and `<root>/toolchain/` holds the trimmed nightly. A set path that does not hold the tools is reported rather than replaced by the bundle, so a mistake in the setting is visible. If neither exists, the command fails with an error that says so and names the setting.
- R4: The tool runs as a child process in the temporary crate, with the environment spike 002 established: `PATH` starts with `<root>/bin` and `<root>/toolchain/bin`, followed by the user's `PATH`; the library path points at `<root>/toolchain/lib` (`DYLD_LIBRARY_PATH` on macOS, `LD_LIBRARY_PATH` on Linux, `PATH` on Windows); and variables that would change how the compiler runs (`RUSTC`, `RUSTC_WRAPPER`, `RUSTC_WORKSPACE_WRAPPER`, `RUSTUP_TOOLCHAIN`, `RUSTFLAGS`, `CARGO_TARGET_DIR`, `CARGO_BUILD_*`) are removed. Because the extension's storage is usually under the user's home directory, cargo also reads the user's own cargo configuration files there; settings in them that would have the same effect (a rustc wrapper such as sccache, extra rustflags, a shared target directory) are overridden through the environment, so the run uses no wrapper, no extra flags, and a target directory inside the temporary crate.
- R5: The run never uses the network (constitution 6). It sets `CARGO_NET_OFFLINE=true`; the temporary crate has no dependencies, so nothing needs downloading.
- R6: The analysis produces results for functions that fail borrow checking. It does so without `--should-fail`, which runs never pass (D4).
- R7: The extension parses the tool's JSON output, one result per function body, and selects the body whose range contains the cursor, preferring the innermost when ranges nest. Positions refer directly to the analysed text because the crate has a single file; Aquascope counts lines and columns from zero and columns in Unicode characters, which the extension converts to VS Code's UTF-16 positions. If no body contains the cursor and no function failed to build, the command says there is no function at the cursor. Result order is not stable between runs (spike 002), so nothing may depend on it.
- R8: The run never blocks the extension host. It shows a cancellable progress notification; cancelling, or exceeding `aquascope.analysisTimeoutSeconds` (default 60), kills the process and its children.
- R9: Nothing is written outside the extension's storage. Each run uses a fresh temporary crate, and old crates are removed. The storage is shared by all VS Code windows, so a crate another open window is still using is left for that window to remove.
- R10: Failures are reported as actionable messages. When no analysed body contains the cursor and the output contains build errors, the extension collects the compiler's errors with a plain `cargo check` of the same temporary crate (D6), writes them to the output channel, and reports one of: the file refers to modules or crates that a single file cannot provide (error codes E0432, E0433, E0463 or E0583), explained as a limit of this version and naming them; or other compile errors, pointing the user to the output channel, together with the lines of the functions that failed to build. When both kinds are present, the single-file limit is reported, because fixing the other errors would not make the file analysable. The other failures are: tool not found; timeout; and any other failure (a non-zero exit of the tool), with the log available.
- R11: Every run is logged to an "Aquascope" output channel: the command line, the environment variables the extension set, the duration and the exit code. stderr is logged in full when the run fails; on success it holds only Aquascope's dump of every function's MIR, so only its size is logged.
- R12: The selected result is exposed to the rest of the extension through a typed interface that feature 004 will consume. The types follow Aquascope's own result types for the pinned version.
- R13: Until feature 004 exists, the command shows a short summary of the selected result (function range, counts of permission steps and boundaries) and writes the full JSON to the output channel, so the feature is usable and testable on its own.
- R14: The new settings `aquascope.toolchainPath` and `aquascope.analysisTimeoutSeconds` are declared in `contributes.configuration` and documented in the README (constitution 4).

## Acceptance criteria

- [x] AC1: With `aquascope.toolchainPath` pointing at the spike 002 trimmed bundle, running the command with the cursor inside `main` of each spike 002 program fixture returns an `Ok` result whose range contains the cursor, in under 10 seconds on darwin-arm64.
- [x] AC2: For the borrow-check failure fixture (`04_push_while_borrowed_fail`), the command returns the permission analysis, not a build error.
- [x] AC3: For the method fixture (`05_method_mut_borrow`), the cursor inside `grow`, `area` and `main` selects each of those three bodies respectively.
- [x] AC4: With the cursor outside any function, the command reports that and shows no stale result.
- [x] AC5: An unsaved edit is analysed: after changing a fixture in the editor without saving, the result reflects the edited text.
- [x] AC6: With the cursor in a function that uses a module declared by `mod other;` or an external crate such as `rand`, the command produces the single-file limit message naming the module or crate, not a raw compiler error; a function in a file with an unresolved `use serde::Serialize;` that does not itself depend on it is still analysed.
- [x] AC7: With no tool at either location, the message names the `aquascope.toolchainPath` setting.
- [x] AC8: Cancelling a run, or a run exceeding the timeout, leaves no `cargo-aquascope`, `cargo` or `aquascope-driver` process running.
- [x] AC9: A run writes nothing outside the extension's storage: the workspace folder is unchanged afterwards.
- [x] AC10: Integration tests cover AC1 to AC7 and AC9, compare results without depending on order, and pass in `npm test`.
- [x] AC11: Both settings appear in VS Code's settings UI with descriptions, and the README documents them.

## Out of scope

- Rendering the analysis (feature 004).
- Packaging the toolchain into per-platform VSIX files and the CI that builds them (feature 005).
- Analysing a file together with the rest of its crate, its modules or its dependencies; this needs the file-mapping problem solved (Appendix A) and is a later feature.
- Code lens, run-on-save or any trigger other than the command.
- Verifying Linux and Windows; R4 states their library-path variable, but only darwin-arm64 is exercised here.
- Aquascope's interpreter (runtime) visualisation, which needs Miri.
- Caching results between runs.

## Open questions

None. Q1 and Q2 were settled by the T-013 experiment and are recorded as D4 and D5.

## Appendix A: Aquascope behaviour this spec relies on

Sources are in the pinned v0.4.0 checkout (`spikes/002-toolchain-bundling/work/src/aquascope`) and the `rustc_utils` 0.15.2-nightly-2026-05-01 crate.

| Behaviour                                                                                                                                                                              | Evidence                                                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| One run analyses every function body in the workspace crates; there is no per-function filter                                                                                          | `crates/aquascope_front/src/plugin.rs`: `after_expansion` calls `find_bodies(tcx)` and pushes one result per body; `CrateFilter::OnlyWorkspace`; the `permissions` subcommand takes only `--steps-include-mode` and `--show-flows` |
| Output is a JSON list of `{"Ok": AnalysisOutput}` or `{"Err": AquascopeError}`                                                                                                     | `crates/aquascope/src/analysis/mod.rs:280-309`; spike 002 outputs                                                                                                                                                                              |
| `AnalysisOutput` holds `body_range`, `boundaries`, `steps`, `loan_points`, `loan_regions`, `move_points`, `move_regions`                                               | `crates/aquascope/src/analysis/mod.rs:301-309`                                                                                                                                                                                                 |
| Positions name files by an opaque index, serialised as `{"private_use_as_methods_instead": N}`; every spike 002 result has index 0                                                   | `rustc_utils/src/source_map/filename.rs:11-13` (`FilenameIndex`)                                                                                                                                                                             |
| A body whose MIR is tainted by errors returns `BuildError { range }` unless `--should-fail` is passed. Type and name-resolution errors taint it; borrow errors do not (Appendix B) | `crates/aquascope/src/analysis/mod.rs:331-338`                                                                                                                                                                                                 |
| Compiler diagnostics are silenced, `-A warnings` is appended to the compiler arguments, and every analysed body's MIR is written to stderr                                           | `crates/aquascope_front/src/plugin.rs:157-161` and `:182` (`silent_session`); `crates/aquascope/src/analysis/permissions/utils.rs:10-16` (`dump_mir_debug`)                                                                            |
| The mdBook plugin analyses each example as `src/main.rs` of a temporary `cargo new --bin` crate                                                                                    | `crates/mdbook-aquascope/src/preprocessor.rs:44-61`                                                                                                                                                                                            |
| Spike 002 fixture `05_method_mut_borrow` produced three results (`grow`, `area`, `main`)                                                                                       | `spikes/002-toolchain-bundling/work/results/*/05_method_mut_borrow.json`                                                                                                                                                                       |
| Required environment and unstable result order                                                                                                                                         | [docs/spikes/002-toolchain-bundling.md](../../../docs/spikes/002-toolchain-bundling.md), Q1/Q2 and Appendix C                                                                                                                                     |

## Appendix B: T-013 experiment results

Run on 2026-11-06 with `spikes/003-single-file-crate/probe.sh`, using spike 002's v0.4.0 binaries and trimmed toolchain on darwin-arm64. Every program was analysed as `src/lib.rs` of a fresh library crate in a scrubbed environment with the R4 and R5 variables set as the runner will set them. Comparisons ignore list order. The full report is regenerated in `spikes/003-single-file-crate/work/report.txt`.

| Check                                                                                                        | Result                                                                                                         | Used for           |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- | ------------------ |
| Library crate vs spike 002 binary-crate baseline, all five programs                                          | Same results for all five                                                                                      | D5                 |
| `--should-fail` vs no flag on code that compiles (01, 02, 03, 05, non-ASCII)                               | Same results                                                                                                   | D4                 |
| Borrow-check failure (04) without `--should-fail`                                                          | Full analysis (2 steps, 2 boundaries, 3 loans), identical to the run with the flag                             | D4, R6             |
| Type error (`let x: u32 = "a";`) without / with the flag                                                   | `BuildError` covering `fn main()` only / `Ok` with every table empty and the same signature-only range   | D4                 |
| `mod other;` used in `main`; `rand::random` used in `main`                                           | `BuildError` for `main` (same with the flag: empty `Ok`)                                                 | R10                |
| Unresolved `use serde::Serialize;` with `#[derive(Serialize)]`, `main` not using serde                 | `main` analysed normally                                                                                     | AC6                |
| Type error in one function, borrow error in another                                                          | `BuildError` for the first, full analysis for the second                                                     | R10                |
| Exit code of `cargo aquascope` in all of the above                                                         | 0; stderr holds only MIR dumps, no compiler errors                                                             | D6, R11            |
| Plain `cargo check --message-format=json` of the same crates                                               | E0502 (borrow), E0308 (type), E0432 (`use serde`), E0583 (`mod other`), E0433 (`rand::`); 0.10 to 0.15 s | D6, R10 codes      |
| Columns on a line with `🦀é` before the code                                                              | Match character offsets (for example 40 for the moved `s`; UTF-16 would be 41, bytes 44)                     | R7                 |
| Edition 2024 vs 2021                                                                                         | Same results on all fixtures                                                                                   | R2 default         |
| Parent `.cargo/config.toml` with `rustc-wrapper` set to a failing script, no override                    | Exit 101, the user's wrapper ran                                                                               | R4                 |
| Same with `rustflags = ["-Dwarnings"]`, no override                                                        | Analysis succeeds; Aquascope appends `-A warnings`                                                           | R4                 |
| Same with `target-dir` set, no override                                                                    | Analysis succeeds but writes to the shared target directory                                                    | R4, R9             |
| All three set, with `RUSTC_WRAPPER=`, `CARGO_ENCODED_RUSTFLAGS=` and `CARGO_TARGET_DIR=<crate>/target` | Analysis succeeds, nothing written to the shared directory                                                     | R4                 |
| Wall time per analysis from a fresh crate                                                                    | 0.17 to 0.61 s                                                                                                 | AC1 budget of 10 s |
