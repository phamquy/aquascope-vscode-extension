---
feature: 003-run-analysis-at-cursor
---

# Plan

## Approach

The work starts with a short experiment, because its answers change the runner's design. It settled Q1 and Q2 and checked the cargo-configuration overrides added to R4, reusing spike 002's built binaries, trimmed toolchain, fixtures and order-insensitive comparison; the checks are in Appendix A and the results in the spec's Appendix B. Runs never pass `--should-fail` (D4), and the library crate holds (D5). The experiment also found that Aquascope silences the compiler's errors, so error classification reads the JSON diagnostics of a plain `cargo check` of the same crate, run only when build errors keep the analysis from covering the cursor (D6).

The extension code is a thin pipeline of small modules, each owning one requirement group, so that everything except the process spawn can be tested without the toolchain. The command handler takes the active Rust editor and its text. `scratchCrate` finds the edition and writes the temporary crate (R2, R9). `toolchain` resolves the tool location and builds the environment (R3 to R5). `runner` spawns `cargo aquascope permissions` with progress, cancellation, a timeout and logging (R8, R11). `select` parses the JSON and picks the innermost body at the cursor (R7). `errors` turns a failed run, or build errors plus the follow-up `cargo check` diagnostics, into one of the R10 messages. The handler then shows the R13 summary. The module boundaries and what each one decides are in Appendix B.

The handler also returns a typed result, either the selected analysis or an error code with its message. VS Code passes a command's return value back to `executeCommand`, so the integration tests can assert on outcomes directly instead of scraping notifications, and feature 004 will consume the same value (R12). The result types are generated from the pinned Aquascope source with its own `export-ts` and ts-rs export step, then vendored with a provenance note, so they match the pinned version exactly and can be regenerated on upgrade. If running that generation step is blocked, the fallback is hand-writing the few types this feature reads from the Rust definitions.

The temporary crate is deliberately boring. Each run gets a fresh directory under the extension's global storage, holding a `Cargo.toml` with the detected edition, an empty `[workspace]` table so cargo never climbs into an ancestor workspace, and `src/lib.rs` with the editor text unchanged so positions need no offset. Older run directories are deleted before the new one is created; each is named after the extension host's process id, so a run still in use by another open window is kept. The edition comes from a small line-based reader of the nearest `Cargo.toml` that also follows `edition.workspace = true` to the workspace root; it avoids a TOML dependency and a cargo process on the hot path, and any file it cannot read falls back to 2024.

Positions need one conversion. Aquascope reports lines and columns from zero, and the experiment confirmed that its columns count characters, while VS Code counts UTF-16 code units, so the two differ on lines containing characters outside the Basic Multilingual Plane, such as emoji. `select` converts using the document's line text, and the experiment's non-ASCII fixture proves it.

Tests run inside the existing VS Code test instance. Pure-module tests use JSON and stderr captured from the experiment, and the end-to-end tests drive the real command against a development bundle. That bundle is assembled from spike 002's work directory into the R3 layout by a small script using symlinks, so nothing large is copied or committed. When no bundle is present the toolchain-dependent tests skip with a visible message instead of failing; feature 005's CI will supply a real bundle later.

## VS Code APIs and contribution points

- `contributes.commands`: `aquascope.analyzeAtCursor`, "Aquascope: Analyze Function at Cursor"; activation stays implicit from the command (no `activationEvents` entry is needed on VS Code 1.74 and later).
- `contributes.menus.commandPalette`: shown when `editorLangId == rust`.
- `contributes.configuration`: `aquascope.toolchainPath` (string, default empty) and `aquascope.analysisTimeoutSeconds` (number, default 60, minimum 5).
- `vscode.window.withProgress` with `ProgressLocation.Notification` and `cancellable: true`.
- `vscode.window.createOutputChannel('Aquascope')`, created on first run.
- `ExtensionContext.globalStorageUri` for the temporary crates; `ExtensionContext.extensionUri` for the bundled location of feature 005.
- `vscode.window.showInformationMessage` / `showErrorMessage` with a "Show Output" action.

## Files touched

- `package.json`: command, palette menu entry and the two settings.
- `README.md`: the command and both settings.
- `src/extension.ts`: registers the command; the handler module is imported on first use.
- `src/analysis/`: `command.ts`, `toolchain.ts`, `scratchCrate.ts`, `runner.ts`, `select.ts`, `errors.ts`, `types.ts`, and `bindings/` with the generated Aquascope types and their provenance note.
- `src/test/suite/`: one test file per module plus `analyze.test.ts` for the end-to-end criteria.
- `src/test/fixtures/workspace/`: the spike 002 programs and the T-013 error and non-ASCII fixtures; `src/test/fixtures/data/`: captured analysis JSON and `cargo check` diagnostics.
- `src/test/runTest.ts`: opens the fixture workspace and passes the bundle location to the test instance.
- `scripts/dev-bundle.mjs`: assembles the development bundle from spike 002's work directory.
- `spikes/003-single-file-crate/`: the experiment script and its extra fixtures; output in its gitignored `work/`.
- `specs/features/003-run-analysis-at-cursor/spec.md`: Q1 and Q2 resolved into decisions, R6 made specific.

## Risks

- Generating the types executes Aquascope's build and tests. The project's permission rule covers only `spikes/002-toolchain-bundling/`, so that task needs your approval when it runs.
- Error classification reads compiler error codes from the follow-up `cargo check`, and some codes are ambiguous. `E0433` is raised both for a missing crate and for a misspelt path, so the single-file message has to mention both causes.
- Killing the process tree relies on a POSIX process group, created with `detached: true` and killed with `process.kill(-pid)`. The Windows path (`taskkill /T /F`) is written but not exercised, matching the spec's scope.
- The end-to-end tests depend on spike 002's local work directory, which is 1.6 GB and not in git. On a fresh clone they skip until the spike is rebuilt or feature 005 provides a bundle.
- Overriding the user's cargo configuration through the environment covers the wrapper, the rustflags and the target directory. Rarer settings, such as `[unstable]` flags or a custom `target` triple, are not overridden. A custom target would fail visibly, because the trimmed toolchain carries only the host standard library.

## Test strategy

Every module gets tests in the existing mocha suite, and the integration tests in `analyze.test.ts` cover the spec's acceptance criteria end to end against the development bundle (AC1 to AC7 and AC9, as AC10 requires). Results are compared without depending on order. AC8, process cleanup on cancel and timeout, is tested automatically in `runner.test.ts` by running a real analysis long enough to watch its process group, and only the Cancel button of the notification is clicked by hand. AC11, the settings UI, is checked by hand. Manual results are recorded in the task notes. The mapping from criteria to tests is in Appendix C.

## Appendix A: experiment checks (Q1, Q2, R4 overrides)

| Check | Method | Settles |
| --- | --- | --- |
| `--should-fail` on code that compiles | Run fixtures 01, 02, 03, 05 with and without the flag; compare with `compare.sh` | Q1: safe to pass always? |
| `--should-fail` on non-borrow errors | New fixtures: a type error (`let x: u32 = "a";`), an unresolved import, a `mod other;`; record exit code, stdout, stderr | Q1 and R10 classification samples |
| Borrow failure without the flag | Fixture 04 without `--should-fail`; record the `BuildError` shape and exit code | R6 retry design if needed |
| Library crate vs binary crate | All five programs as `src/lib.rs` of a `--lib` crate vs spike 002 baseline | Q2 |
| User cargo config | Crate under a parent with `.cargo/config.toml` setting `build.rustc-wrapper` (a script that exits 1), `build.rustflags = ["-Dwarnings"]`, `build.target-dir`; run with `RUSTC_WRAPPER=`, `CARGO_ENCODED_RUSTFLAGS=`, `CARGO_TARGET_DIR=<crate>/target` | R4 overrides work; nothing written to the shared target dir |
| Timing | Wall time per fixture from a fresh crate | AC1 budget of 10 s |

## Appendix B: module responsibilities

| Module | Requirements | Decides | Tested by |
| --- | --- | --- | --- |
| `toolchain.ts` | R3, R4, R5 | Root from setting (no fallback when set) or `extensionUri/aquascope`; checks `bin/cargo-aquascope`, `bin/aquascope-driver` and `toolchain/bin/cargo` exist; builds env from a copy of `process.env` (pure function of env and platform) | Unit: env per platform, removal and override list, missing tool |
| `scratchCrate.ts` | R2, R9 | Nearest `Cargo.toml` edition with workspace inheritance, default 2024; writes `Cargo.toml` (`[workspace]`, no deps) and `src/lib.rs`; deletes older runs | Unit: edition cases on temporary dirs; crate contents; cleanup |
| `runner.ts` | R8, R11 | Spawns `<root>/toolchain/bin/cargo aquascope permissions` (and, for R10, `cargo check --message-format=json`) in the crate dir as a process group; collects stdout and stderr; kills the group on cancel or timeout; logs command, env delta, duration, exit code, and stderr on failure or its size on success | Unit: group kill on timeout and cancel using a shell with a `sleep` grandchild; AC8 against the dev bundle |
| `select.ts` | R7 | Parses `{Ok}` / `{Err}` entries; converts char columns to UTF-16; picks the innermost containing body; reports "no function at cursor" | Unit: spike JSON for fixture 05 (three bodies), nesting, non-ASCII line |
| `errors.ts` | R10 | Maps spawn errors and exit codes to tool not found, timeout or other; maps `BuildError` entries plus `cargo check` JSON diagnostics to single-file limit (`E0432`, `E0433`, `E0463`, `E0583`, naming the module or crate) or other compile errors (with the failing functions' lines) | Unit: diagnostics captured in the experiment |
| `command.ts` | R1, R13 | Orchestrates, cancels an in-flight run when a new one starts, shows the summary or error with "Show Output", writes the selected JSON to the channel, returns the typed result | Integration |
| `types.ts`, `bindings/` | R12 | Exposes `AnalyzeResult` (ok with `AnalysisOutput`, or error with code and message) | Typecheck |

## Appendix C: acceptance criteria to tests

| Criterion | Test |
| --- | --- |
| AC1 | `analyze.test.ts`: each spike program, cursor in `main`, `Ok` result containing the cursor, duration under 10 s logged and asserted |
| AC2 | `analyze.test.ts`: fixture 04 returns an analysis, not an error |
| AC3 | `analyze.test.ts`: fixture 05, cursor in `grow`, `area`, `main` selects three distinct ranges |
| AC4 | `analyze.test.ts`: cursor on the `struct` line returns the no-function result |
| AC5 | `analyze.test.ts`: edit without saving (insert a line), result range shifts accordingly |
| AC6 | `analyze.test.ts`: cursor in `main` of the `mod other;` and `rand::` fixtures returns the single-file-limit code naming `other` and `rand`; cursor in `main` of the `use serde::Serialize;` fixture returns an analysis |
| AC7 | `analyze.test.ts`: `toolchainPath` set to a missing directory returns tool-not-found naming the setting |
| AC8 | `runner.test.ts`: a real analysis of a 4,000-function file is cancelled once `aquascope-driver` runs, and another times out after 2.5 s; in both, the process group is empty afterwards. Manual: a run cancelled from the notification, then `pgrep -fl 'cargo|aquascope'` shows nothing; recorded in T-022 |
| AC9 | `analyze.test.ts`: workspace file listing and mtimes identical before and after the runs |
| AC10 | All of the above in `npm test` |
| AC11 | `contributes.test.ts`: both settings declared with descriptions; manual look at the settings UI; README section present |
