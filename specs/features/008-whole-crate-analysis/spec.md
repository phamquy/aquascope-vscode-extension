---
id: 008-whole-crate-analysis
title: Analyse a function with the rest of its crate
status: approved
---

# Analyse a function with the rest of its crate

## Why

The permissions view works only on code that fits in one file. Feature 003 copies the current file, alone, into a temporary crate with no dependencies and runs Aquascope there. Any function in a file that declares `mod`, uses `crate::` items from another file, or uses another crate of the workspace or a crate from crates.io gets the single-file message instead of a diagram. Real projects almost always do at least one of these, even the Rust Book's own minigrep once it is split into `main.rs` and `lib.rs`. So today the extension serves the Book's examples well but not the user's own crates, which is the product's second goal.

Aquascope itself has no such limit. `cargo aquascope permissions` is a cargo plugin: run in a crate, it lets cargo build the dependencies as usual and analyses every function of the crate, whatever file it is in. Feature 003 chose the single file because of how Aquascope reports its results and what a real build needs, and this feature removes those obstacles. Appendix A has the evidence for each.

- **Results do not say which file they are in.** Each position names its file by a number that indexes a table inside the analysing process, and the table is not written out. In a crate of several files, the extension cannot tell which file a result's lines refer to. The fork the extension builds from (ADR 0004) can be changed to write each result's file path.
- **One run analyses the whole workspace.** Aquascope analyses every crate of the workspace in one run. The framework it is built on can instead analyse only the crate that contains a given file, and the fork can switch to that.
- **A real build needs more than the bundle has.** Dependencies come from the cargo cache, or from the network the first time. Dependencies with build scripts or proc macros need a system linker. The first run compiles every dependency with the pinned nightly, which may take minutes; nothing has measured how long on real crates.
- **The project must stay as it is.** Feature 003 promises that a run writes nothing outside the extension's storage. Pointing cargo's target folder at that storage keeps the build output out of the project, but cargo may still create or update `Cargo.lock` there.
- **Unsaved edits are not on disk.** Feature 003 analyses the editor's text, including unsaved changes. A build of the whole crate compiles the files on disk.

The proposal is that, when the current file belongs to a Cargo package, the permissions view analyses the crate that contains it instead of a copy of the file alone, maps the results back to files by path, and shows the function at the cursor as it does today. A file that belongs to no package keeps today's single-file analysis. Show Stack and Heap is not part of this feature, because running a program with its dependencies in Miri is a separate, unverified problem.

Some of the decisions below depend on measurements, as features 003 and 007 did. The plan's first task is a probe that makes them and records the results in an appendix, and the spec is revised if they overturn a decision.

## Decisions

Recorded 2026-11-09 when the draft was approved. Each one takes the recommendation given for the open question it settles.

- D1 (was Q1): The extension copies the package, or the workspace when it has path dependencies, into its storage without `target/`, writes the unsaved editors' text over the copies, and analyses the copy. This keeps feature 003's promise to use unsaved text, and any `Cargo.lock` cargo writes lands in the copy. The probe measures the copy on typical projects; if it takes more than about a second, the spec is revised toward saving the editors first.
- D2 (was Q2): The fork analyses only the crate containing the file, through rustc_plugin's `CrateContainingFile` filter, and the change is offered upstream. The probe measures the difference on a small workspace.
- D3 (was Q3): The fork writes each result's file path, relative to the crate, next to its range, and the change is offered upstream. The probe checks that the change is small.
- D4 (was Q4): The probe times the first and later runs on minigrep split into modules, a crate using `serde` with derive, and a two-member workspace. The numbers set R9's progress messages and may revise AC8's bound.
- D5 (was Q5): The extension never uses the network. A dependency missing from the cache gets a message saying to run `cargo fetch` in the project.
- D6 (was Q6): The first run builds the dependencies with Aquascope's `preload` command, with its own progress message and no timeout but cancellable, and then runs the analysis with the usual timeout.
- D7 (was Q7): Only the library and binary targets are analysed, as a normal build compiles them. A file that is only test code, an example, a benchmark or a build script gets a message saying this version cannot analyse it.
- D8 (was Q8): The whole-crate analysis is automatic whenever the file belongs to a package, with no setting. When the crate cannot be analysed, the message offers to analyse the file alone, as today.

## User stories

- As a learner whose project is split into modules, such as minigrep with `main.rs`, `lib.rs` and a `config` module, I want to analyse a function that uses items from the other files, so that I can see ownership in my real code and not only in copied examples.
- As a developer, I want to analyse a function that uses crates from crates.io, such as `serde` or `regex`, so that the view works in the projects I actually write.
- As a developer in a Cargo workspace, I want to analyse a function in one member that uses another member.
- As a user, I want my project folder left as it was and no download made without my say, so that trying the view is safe.
- As a user whose crate cannot be analysed, because a dependency is missing offline, no linker is installed or another file does not compile, I want a message that says which and what to do.

## Requirements

- R1: When the active Rust file belongs to a target of a Cargo package, the permissions command analyses the crate that contains it, with its modules and dependencies, instead of a copy of the file alone, with no setting to choose (D8). A file that belongs to no package is analysed as in feature 003. When the crate cannot be analysed, the message offers to analyse the file alone.
- R2: One run analyses only the crate that contains the file, not every crate of the workspace (D2).
- R3: The extension maps every result to its file by path and selects, as in feature 003 R7, the innermost function body that contains the cursor in the active file. The panel shows that file's text, as today (D3).
- R4: The analysis reflects the text the user sees, including unsaved changes. It runs on a copy of the package, or of the workspace when it has path dependencies, in the extension's storage, with the unsaved editors' text written over the copied files (D1).
- R5: A run writes nothing in the project. Build output goes to a folder in the extension's storage, kept between runs and per project, so that later runs reuse the compiled dependencies. `Cargo.lock` is neither created nor changed in the project (D1).
- R6: A run uses the user's own cargo cache and never the network (constitution 6, D5). When a dependency is not in the cache, the message names it and says to run `cargo fetch` in the project.
- R7: When a dependency's build script or proc macro cannot be linked because no system linker is found, the message says that the crate needs one and how to install it on the platform.
- R8: When the function at the cursor cannot be analysed because of compile errors elsewhere in the crate, the message names the files and lines with errors, in the way feature 003 R10 explains compile errors.
- R9: The first run on a crate builds its dependencies with Aquascope's `preload` command, with its own progress message and no timeout, and can be cancelled. The analysis then runs with the usual timeout (D6). Later runs on the same crate meet AC8's time bound.
- R10: Only the library and binary targets are analysed. A file that is only test code, an example, a benchmark or a build script gets a message saying this version cannot analyse it (D7).

## Acceptance criteria

- [ ] AC1: In a fixture crate with `main.rs`, `lib.rs` and a module in its own file, a function in the module that uses items from `lib.rs` is drawn in the panel, with its markers on the right lines of the module's file.
- [ ] AC2: In a fixture crate with a crates.io dependency already in the cargo cache, a function using it is analysed with the network off.
- [ ] AC3: In a fixture workspace, a function in one member that uses another member is analysed.
- [ ] AC4: After runs on every fixture crate, the project folders are unchanged, including `Cargo.lock` and `target/`, as feature 003 AC9 checks for single files.
- [ ] AC5: With a dependency missing from the cache, the message names the dependency and says to run `cargo fetch`, offers to analyse the file alone, and nothing is downloaded.
- [ ] AC6: With no linker on `PATH` and a dependency that has a proc macro, the message says the crate needs a linker.
- [ ] AC7: Feature 003's single-file tests pass unchanged for files that belong to no package.
- [ ] AC8: The second run on a fixture crate takes under 10 seconds, the bound of feature 003 AC1, unless D4's measurements revise it.
- [ ] AC9: An unsaved edit in a module file is analysed: the result reflects the edit, and the file on disk is unchanged.
- [ ] AC10: A file that is only test code gets the message that this version cannot analyse it.

## Out of scope

- Show Stack and Heap on a whole crate. Running a program with its dependencies in Miri needs them built for Miri, which is unverified; it would be a later feature.
- Showing results from several files at once, or a function together with the functions it calls.
- Test-only code (`#[cfg(test)]` modules, `tests/`), examples, benchmarks and build scripts, which a normal build does not compile for the library or binary (D7).
- Choosing cargo features or a target other than the host.
- Projects not built with Cargo.
- Platforms other than darwin-arm64, as for feature 005.

## Open questions

None. Q1 to Q8 were settled when the draft was approved and are recorded as D1 to D8.

## Appendix A: what is known before the probe

| Fact | Source |
| --- | --- |
| Positions carry `filename: FilenameIndex`, serialised as `{"private_use_as_methods_instead": N}`. The index points into a table of file names kept in a thread-local inside the analysing process, and the table is not part of the output. | `rustc_utils-0.15.2-nightly-2026-05-01`: `src/source_map/filename.rs`, `src/source_map/range.rs:100-120`; spec 003 Appendix A |
| Aquascope runs with `CrateFilter::OnlyWorkspace`, so one run analyses every crate of the workspace and every function body in them. | `crates/aquascope_front/src/plugin.rs:100`; spec 003 Appendix A |
| rustc_plugin also offers `CrateContainingFile(path)`, which limits the run to the package containing the file with `-p <name>:<version>` and `--lib` or `--bin`. | `rustc_plugin-0.15.2-nightly-2026-05-01/src/cli.rs:69-70` and `only_run_on_file` |
| rustc_plugin puts its build output in `<target directory>/plugin-<channel>`, taking the target directory from `cargo metadata`, which follows `CARGO_TARGET_DIR` (checked: with it set, `target_directory` is that folder). | `rustc_plugin-…/src/cli.rs:24-30` |
| Aquascope has a `preload` command that runs `cargo check --all --all-features` into the same folder to build the dependencies ahead of the analysis. | `crates/aquascope_front/src/plugin.rs:50`, `:79-88` |
| With a crates.io dependency in the cache, the analysis works offline; from an empty cache offline it fails with `no matching package named 'itoa' found`. The first online run fetched two index entries and one 164 KB archive. | Spike 002, Q5 and Appendix F |
| A dependency with a proc macro (`serde` with derive) fails without `cc` on `PATH` with `linker 'cc' not found`; a plain dependency does not need a linker. | Spike 002, Appendix F |
| The bundle ships no linker: spike 002 removed `rust-lld` and the other linkers from the toolchain, since a single file never links. | Spike 002, Appendix E; spec 005 R4 |
