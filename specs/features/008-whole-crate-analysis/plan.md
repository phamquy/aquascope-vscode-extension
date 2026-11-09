---
feature: 008-whole-crate-analysis
---

# Plan

## Approach

The feature keeps what features 003 to 006 built: the command and its title-bar button, the runner with its progress, cancel and log, the selection of the body at the cursor, and the panel. What changes is where the analysis runs. A file that belongs to a Cargo package is no longer copied alone into a temporary crate. Instead, its project is copied into the extension's storage with the unsaved editors written over it, and a version of Aquascope that analyses only the file's crate, and names the file of every result, runs on that copy. A file that belongs to no package keeps feature 003's analysis. The work starts with a probe, because four decisions rest on measurements. Then come the two changes to the fork, the extension's three new steps (finding the crate, copying the project and running on it), and the failure messages, and it ends with the acceptance tests.

**What the probe settles first (D1 to D4).** T-044 builds `spikes/008-whole-crate/probe.sh`, in the style of spike 002's scripts, with these fixture projects:

- minigrep split into `main.rs`, `lib.rs` and a `config` module, including issue #31's `Config::parse`;
- a crate with one crates.io dependency;
- a workspace of two members, one using the other through a path dependency;
- a workspace with a local proc-macro member, for the linker case.

It builds a scratch copy of the fork with the two changes D2 and D3 describe, and records:

- how long copying each fixture takes, and a larger real project such as Aquascope's own source, without build output and `.git` (D1);
- how long the first and later runs take, with and without `cargo aquascope preload`, and whether the analysis reuses what preload built (preload checks with `--all-features`, and the analysis may not) (D4, D6);
- whether a later run on unchanged code still returns results, for a library and for a binary target. rustc_plugin deletes a library's compiled files before each run so that cargo has to run the analysis again, but does nothing like that for binaries;
- which path each result carries, and whether every range in a body lies in that body's file;
- the whole-workspace run against the single-crate run, on the workspace fixture (D2);
- what cargo and Aquascope report for a dependency missing offline, a missing linker, a compile error in another file, and a file under `tests/` (R6 to R8, R10);
- whether cargo creates or changes `Cargo.lock` in the copy.

The results go into the spec's Appendix B, and any decision they overturn is revised there. T-044 ran it on 2026-11-09: the results confirmed D1, D2, D4 and D6, and revised D3 and D7, as the paragraphs below now reflect. The captured outputs become test data in `src/test/fixtures/data/`, so that the later tasks can test parsing and classification without the toolchain.

**The fork (D2, D3).** T-045 makes the two changes in [phamquy/aquascope](https://github.com/phamquy/aquascope), on a branch from `v0.4.0-vscode.1`. The first is an option of `cargo aquascope permissions` that names a file. With it, the run uses rustc_plugin's `CrateContainingFile` filter instead of `OnlyWorkspace`; without it, nothing changes. The second is a field holding the path of the result's file, as the compiler saw it, relative to the workspace root, on every result and on every build error (D3, revised). Each change gets a test in Aquascope's suite and passes its formatting and clippy checks. The fork is tagged `v0.4.0-vscode.2`, and each change is offered upstream as its own pull request. On the extension side, the task updates `pin.env`, rebuilds the development bundle as T-042 did, regenerates the TypeScript bindings with `scripts/export-aquascope-types.sh`, and updates ADR 0004 to list the fork's three changes. The existing captured outputs have no path field, and the parser reads a missing field as the analysed file itself.

**Finding the crate (R1, R10, D7, D8).** A new module, `project.ts`, runs the bundled `cargo metadata --no-deps --offline --format-version 1` in the file's folder, with feature 003's run environment. A pure function then reads from the metadata:

- the workspace root;
- the package and target whose source folder holds the file, by the same rule rustc_plugin uses, so that the two agree;
- any path dependencies outside the workspace root;
- the copy root, the smallest folder that holds the workspace root and those dependencies.

A file in no package goes to feature 003's analysis (D8). A `build.rs` gets the message that this version cannot analyse it. Files under `tests/`, `examples/` and `benches/` go to the crate run like any other, since rustc_plugin chooses their targets itself (D7, revised; R10). If `cargo metadata` itself fails, for example on a broken manifest, the message says so, with the details in the log.

**Copying the project (R4, R5, D1).** A new module, `projectCopy.ts`, gives each project a folder `<storage>/projects/<hash of the copy root>/` holding `src/`, the copy, and `target/`, the build output kept between runs. Before each run it brings the copy up to date in three steps:

1. It copies the copy root into `src/`, skipping `.git` and cargo's build folders, which cargo marks with a `CACHEDIR.TAG` file. Only files that are new or changed since the last run are copied, judged by size and modification time against a record of that run, and files deleted from the project are deleted from the copy.
2. It writes the text of every unsaved editor under the copy root over its copy. It also records those files, so that the next run restores them from disk.
3. Every file it writes gets the current time as its modification time, so that cargo rebuilds exactly what changed.

The probe showed that later runs on unchanged code return their results for libraries and binaries alike, so nothing needs touching. Nothing is written in the project itself, and any `Cargo.lock` cargo writes lands in the copy. Feature 003's cleanup of its temporary crates is unchanged.

**Running on the crate (R1 to R3, R9, D6).** `analyze()` in `command.ts` sends a file the project module locates to the crate run, and any other file to feature 003's run.

- The first run on a project runs `cargo aquascope preload` in the copy, with `CARGO_TARGET_DIR` set to the project's `target/`. It has its own progress title, "Aquascope: building dependencies (first run on this crate)", and no timeout, but it can be cancelled; the runner's timeout becomes optional for this. Once preload succeeds, the project folder records it, so later runs skip it.
- The analysis then runs `cargo aquascope permissions` with the fork's file option naming the copied file, under the usual timeout.
- `select.ts` keeps the results whose path is the active file's path relative to the workspace root, then picks the innermost body around the cursor as before. The UTF-16 conversion uses the editor's text, which is the text in the copy, and the panel is unchanged.
- The output channel logs the copy root, how many files the sync copied and how long it took, and whether preload ran.

**Failures (R6 to R8, D5, D8).** `errors.ts` classifies the crate run's failures from cargo's output and the compiler's messages, using the probe's captures:

- `dependencyMissing` names the dependency and says to run `cargo fetch` in the project;
- `linkerMissing` says the crate needs a system linker, which on macOS comes with `xcode-select --install`. Cargo's ``linker `cc` not found`` identifies it, both when the whole run fails, for a crates.io dependency, and when only the functions using a workspace member's proc macro fail (R7);
- `compileErrors` is reused, with the files and lines of the errors from a plain `cargo check` of the copy, as feature 003's D6 does. The path on a build error (D3, revised) tells whether the function at the cursor is the one that failed;
- `unsupportedTarget` comes from the project module (D7).

`CARGO_NET_OFFLINE` stays set, so no run ever downloads (D5). The notification for a crate failure carries an **Analyze This File Alone** action, which runs feature 003's analysis on the same editor and cursor (D8).

## VS Code APIs and contribution points

- No new commands, menus or settings (D8). `aquascope.analyzeAtCursor` and its title-bar button behave as before for files outside a package.
- `vscode.workspace.textDocuments`, with `isDirty` and `getText()`, for the unsaved editors under the copy root.
- An item on `showErrorMessage` for the Analyze This File Alone action.
- `withProgress` as today, with a second title for the first run's dependency build.

## Files touched

- `spikes/008-whole-crate/` (new): `probe.sh` and its fixture projects.
- The fork, [phamquy/aquascope](https://github.com/phamquy/aquascope): `crates/aquascope_front/src/plugin.rs` for the file option, `crates/aquascope/src/analysis/mod.rs` for the path field, and their tests; tag `v0.4.0-vscode.2`.
- `spikes/002-toolchain-bundling/pin.env`, `docs/adr/0004-build-aquascope-from-a-fork.md`, and `src/analysis/bindings/` (regenerated).
- `src/analysis/project.ts` and `src/analysis/projectCopy.ts` (new).
- `src/analysis/command.ts`: choosing the crate run or the single-file run, preload and the Analyze This File Alone action. `runner.ts`: an optional timeout. `select.ts`: keeping the active file's results. `errors.ts`: the new failure classes. `types.ts`: the error codes `dependencyMissing`, `linkerMissing` and `unsupportedTarget`.
- `src/test/fixtures/projects/` (new): the fixture projects for the end-to-end tests. `src/test/fixtures/data/`: T-044's captures.
- `src/test/suite/`: unit tests for the new modules and the changed ones, and `crate.test.ts` (new) for the end-to-end criteria.
- `README.md`: how a file in a package is analysed, its limits, and the linker and cargo cache it needs.
- `specs/features/008-whole-crate-analysis/spec.md` and `specs/product.md`: Appendix B from T-044, then criteria ticked and status `implemented`.

## Risks

- **Running the project's code.** Analysing a crate builds it, which runs its build scripts and proc macros, and those of its dependencies, as `cargo check` and rust-analyzer do. The single-file analysis never ran such code. The extension declares no `untrustedWorkspaces` capability, so VS Code should disable it in Restricted Mode, which would mean crate analysis runs only in workspaces the user trusted. T-048 checks this by hand and records it. If it does not hold, the task stops and the question goes back to the spec.
- **Repeat runs.** Settled by the probe: later runs on unchanged code returned their results, for a library and a binary alike (spec Appendix B).
- **Choosing the target.** rustc_plugin guesses which target a file belongs to, and its own comment calls the logic "a pile of hacks". For example, a module file in a package with both a library and a binary goes to the library. If it guesses wrong, the body is not found and the user gets feature 003's no-function message. The probe checks the fixtures, and the project module applies the same rule, so that the two at least agree.
- **Preload and features.** In the probe, the analysis reused everything preload built. But preload checks with `--all-features`, which can fail, or build what the analysis does not reuse, on a crate whose features exclude each other; no such crate was tried. If preload fails, the first run falls back to running the analysis itself with no timeout.
- **Disk use.** Each project's `target/` holds its compiled dependencies, possibly hundreds of megabytes, and is kept between runs. This feature does not clean it up; a later change can, if it becomes a problem.
- **Large projects.** The copy includes everything except build output and `.git`, because cargo may need any file, for example through `include_str!` or a build script. A repository with large non-Rust content makes the first copy slow. The probe measures one such project.
- **The project's cargo configuration.** The copy keeps the project's `.cargo/config.toml`, which cargo honours. 003's environment already overrides its compiler flags, but a configured cross-compilation target would fail, and the failure is reported as a compile error.
- **Toolchain mismatch.** The project is built with the pinned nightly, not the project's own toolchain. A dependency that needs a newer compiler fails to build, and the failure is reported as a compile error (R8).
- **A growing fork.** The fork will carry three changes. Each Aquascope upgrade means rebasing them, until upstream takes them.

## Test strategy

- **The probe (T-044)** is a script, like spike 003's. Its captures feed the unit tests.
- **Unit tests** cover these without the toolchain:
  - `project.ts`: finding the crate from captured metadata, for a single package, a workspace, an external path dependency, files under `tests/`, `examples/` and `benches/`, a `build.rs` and a file in no package. The probe's captured metadata is in `src/test/fixtures/data/crate/`.
  - `projectCopy.ts`: what is copied and skipped, unsaved text and its restoration, deleted files, modification times, and a project folder unchanged afterwards.
  - `select.ts`: keeping the active file's results, from the probe's multi-file capture.
  - `errors.ts`: the new classes, from the probe's captured cargo output.
  - `runner.ts`: a run with no timeout.
- **Aquascope's own suite** tests the fork's two changes (T-045).
- **End-to-end tests against the development bundle** go in `crate.test.ts`: AC1 to AC6 and AC8 to AC10. Feature 003's suites stay unchanged, for AC7. The fixtures depend on neither the network nor the machine's cargo cache:
  - AC2's crates.io dependency is vendored in the fixture, with cargo's source replacement in its `.cargo/config.toml`, so the test sees a dependency available offline wherever it runs.
  - AC5 depends on a made-up crate name that no cache holds.
  - AC6 uses a local proc-macro member and runs with a `PATH` that has no `cc`.
- **Packaging:** the strict test run of every package runs the end-to-end tests against the packaged bundle, as today.
- **By hand,** recorded in T-048's note: the extension is disabled in Restricted Mode (the risk above).

## Appendix A: module responsibilities

| Module | Requirements | Decides | Tested by |
| --- | --- | --- | --- |
| Fork: `plugin.rs`, `analysis/mod.rs` | R2, R3, D2, D3 | Run only the file's crate; name the file of each result and each build error | Aquascope's suite |
| `project.ts` | R1, R10, D7, D8 | Workspace root, package and target, copy root; single-file or crate run; unsupported targets | Unit, from captured metadata |
| `projectCopy.ts` | R4, R5, D1 | What is copied, kept and restored; unsaved text; modification times | Unit |
| `runner.ts` | R9, D6 | Runs with no timeout | Unit |
| `command.ts` | R1, R9, D6, D8 | Crate run or single-file run; preload once per project; the Analyze This File Alone action | End to end |
| `select.ts` | R3 | Results of the active file, then the body at the cursor | Unit; end to end |
| `errors.ts`, `types.ts` | R6 to R8, D5 | `dependencyMissing`, `linkerMissing`, `compileErrors` with files, `unsupportedTarget` | Unit; end to end |

## Appendix B: acceptance criteria to tests

| Criterion | Test |
| --- | --- |
| AC1 | `crate.test.ts`: the minigrep fixture; a function in `config.rs` using items from `lib.rs` is analysed, and its body range is in `config.rs` |
| AC2 | `crate.test.ts`: the fixture with a vendored crates.io dependency, offline |
| AC3 | `crate.test.ts`: the two-member workspace; a function in one member using the other |
| AC4 | `crate.test.ts`: every fixture project's files, sizes and hashes are the same before and after the runs, as feature 003's AC9 test checks |
| AC5 | `crate.test.ts`: a dependency with a made-up name gives `dependencyMissing`, naming it and `cargo fetch`; the notification offers Analyze This File Alone |
| AC6 | `crate.test.ts`: the proc-macro workspace, with no `cc` on `PATH`, gives `linkerMissing` |
| AC7 | Feature 003's `analyze.test.ts` and the other suites, unchanged |
| AC8 | `crate.test.ts`: the second run on the minigrep fixture takes under 10 seconds, or the bound T-044 sets |
| AC9 | `crate.test.ts`: an unsaved edit in `config.rs` changes the result, and the file on disk is unchanged |
| AC10 | `crate.test.ts`: a function in the fixture's `tests/` file is analysed, and its `build.rs` gives `unsupportedTarget` |
