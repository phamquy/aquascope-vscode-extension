---
id: 009-whole-crate-stack-heap
title: Show the stack and heap of a program that is a whole crate
status: implemented
---

# Show the stack and heap of a program that is a whole crate

## Why

Show Stack and Heap (feature 007) runs a program in Aquascope's interpreter and draws its memory after each step, but only a program that fits in one file. It copies the active file alone into a temporary binary crate. Feature 008 taught the permissions view to analyse a file with the rest of its crate, and left this view out of scope. So the program the Rust Book builds in chapter 12, minigrep, still cannot be drawn: its `main.rs` starts with `use minigrep::Config;`, and alone it does not compile. The user tested exactly that after feature 008 and asked for it to work.

A whole crate is not the only thing minigrep needs. Its `main` reads the search query and the file name from the command line, and `Config::build` returns an error without them, after which `main` calls `process::exit(1)`. The interpreter gives a program no arguments, so even with its crate, minigrep stops before searching anything and the user sees feature 007's "stopped while running" message. Then it reads the file with `fs::read_to_string`, and the interpreter runs programs isolated from the file system. So the feature has three parts: running `main` with the rest of the crate, giving the program its arguments, and letting it read the files it needs.

What is known so far comes from Aquascope's source (Appendix A), and several obstacles stand out.

- **The interpreter's Miri is configured in code.** It mutes the program's output, turns validation off and otherwise takes Miri's defaults: no arguments, and isolation, which rejects the file system, the clock and the environment. Miri's usual `MIRIFLAGS` are not read. Arguments and file access therefore need a change to the fork, as feature 008's D2 and D3 did.
- **The code of the crate's other parts may not be available to Miri.** Miri runs a function from its compiled MIR. A crate compiled for checking keeps the MIR only of generic and inline functions unless it is compiled with `-Zalways-encode-mir`, which the interpreter does not set, so a call from `main.rs` into `minigrep::run` in the library may find nothing to run. Also, the crates of the workspace are compiled with Miri's standard library, while crates.io dependencies may be compiled with the ordinary one, and the two cannot be mixed.
- **A trace's positions do not say which file they are in.** Every frame's location names its file by the same index the permissions results used before feature 008's D3, so a run that steps through `main.rs`, `lib.rs` and `config.rs` cannot yet be drawn on the right file.
- **The panel draws one file.** The vendored renderer draws a trace on one file's text, with a marker on the line of each step. A run of a whole crate has steps in several files.

The proposal is that, when the active file belongs to a Cargo package with a binary, Show Stack and Heap runs that binary's `main` with the rest of its crate, in feature 008's copy of the project and with its unsaved editors, gives the program the arguments the user chose, lets it read files as `cargo run` would, and draws the steps that are in the active file, each with the whole stack and heap at that moment. Run from `config.rs`, it shows memory while `Config::parse` runs inside the real program; run from `main.rs`, it shows `main`'s own steps. A file in no package keeps feature 007's behaviour.

As with feature 008, some of the decisions below depend on measurements. The plan's first task is a probe like T-044 that makes them and records the results in an appendix, and the spec is revised if they overturn a decision.

## Decisions

Recorded 2026-11-09 when the draft was approved. Each one takes the recommendation given for the open question it settles.

- D1 (was Q1): When the package has exactly one binary, that binary runs; when it has several, a quick pick lists them and the choice is remembered for the project. A file of the library or of any other module runs the program that uses it, which is what the user means when running from there. The probe checks that the binary's crate can be selected, for instance by giving the fork's `--crate-of` the binary's own file.
- D2 (was Q2): The user gives the arguments in an input box on each run, filled with the last arguments used for the project, so Enter repeats the last run and Escape cancels it. The text is split into arguments as a shell would, so quotes keep spaces inside one argument. The arguments are remembered per project in the extension's workspace state, and no setting is added.
- D3 (was Q3): The fork lifts Miri's isolation fully, as `-Zmiri-disable-isolation` does, with the working folder in the copy of the workspace root. Relative paths such as minigrep's `poem.txt` land in the copy, which holds the project's files; absolute paths reach the user's files, which the trusted workspace already allows for build scripts. The probe checks that the fork can do this; if it cannot, the spec is revised.
- D4 (was Q4): The panel draws the steps whose current frame is in the active file, each with the whole stack and heap at that moment. The fork writes each frame's file path, as feature 008's D3 did for permissions, and the change is offered upstream.
- D5 (was Q5): The probe times the first and later runs on minigrep and on a program with a crates.io dependency, and counts their steps, both in the whole run and in each file. The numbers set the progress messages and may revise feature 007's limit of 100 steps.
- D6 (was Q6): When a crate run fails, the message offers to run the file alone, as feature 008's D8 does.
- D7 (added by T-051): The fork reads values that Aquascope's interpreter cannot read today. It crashes on them, in feature 007's single-file run as well: `let s = "hi";` alone overflows the compiler's stack (upstream issues #75, #118 and #119). A `&str` that points to a string literal or into an array is read as its characters, and a string literal's memory is drawn with the heap, the only place the renderer has for memory outside the stack. A trait object such as `Box<dyn Error>` is drawn by its type alone. Without this, minigrep crashes whenever `Config::build` returns its error message or `run` returns its error, so AC3 could not pass.

Revised 2026-11-09 from T-051's probe (Appendix B).

- D1, confirmed: The one-crate build selects any binary of the package by its root file, including one under `src/bin/`, whose steps carry the path `src/bin/whisper.rs`.
- D3, confirmed: With isolation lifted, minigrep reads `poem.txt`. With isolation kept, the run stops with "`open` not available when isolation is enabled". The program's working folder is the workspace root, for a member of a workspace too: the workspace fixture's binary member read `names.txt` from the workspace root.
- D4, confirmed: With a path on each frame and the plan's one-crate build, minigrep's run has 25 steps in three files, and every step in `config.rs` has `main`'s frame below `Config::build`'s. Run as its binary alone, the same program has 4 steps, all in `main.rs`, and each call into the library passes in one step, as the plan expected. In the one-crate build the binary's `main` is named `__aquascope_main::main`, so the extension renames it.
- D5, settled: Every run of minigrep took about 9 seconds, the first no slower than later ones, because the time goes into running the program rather than building it. The binary alone took 4.1 seconds, and a run that stopped at argument parsing took 0.4. A binary using `itoa` took 0.5 seconds, first run included. minigrep's 25 steps, 211 KB of output, are far below feature 007's limit of 100, which stands, and feature 003's 60-second timeout covers the runs.

## User stories

- As a learner who built minigrep in chapter 12, I want to see the stack and heap of my program as it searches a file, so that I can follow where the query, the file's contents and the results live.
- As a learner, I want to see memory while a function in another module runs, such as `Config::parse` in `config.rs`, with the frames of the functions that called it, so that I can see how values are passed between modules.
- As a user whose program needs command-line arguments, I want to give them once and have them used again, so that the run gets past argument parsing.
- As a user whose program reads a file of the project, such as minigrep's `poem.txt`, I want that to work, so that the program runs as it does with `cargo run`.
- As a user whose program cannot be run, I want a message that says why, as features 007 and 008 give.

## Requirements

- R1: When the active Rust file belongs to a Cargo package with a binary target, Show Stack and Heap runs `main` of a binary of that package with the rest of its crate (feature 008's lookup), which binary as D1 settles. A file in no package runs alone, as in feature 007.
- R2: The run uses feature 008's copy of the project, with the unsaved editors written over it, so the text run is what the editors show and nothing is written in the project (008 R4, R5).
- R3: The program receives the command-line arguments the user gave, in the way D2 settles.
- R4: The program can read the project's files, from the copy of the workspace root as its working folder, in the way D3 settles.
- R5: The panel draws the steps of the run that are in the active file, on that file's text, each with the whole stack, including the frames of functions in other files, and the heap at that moment (D4). Feature 007's step limit, notes and undefined-behaviour marking apply to the steps drawn.
- R6: A run never uses the network (constitution 6), and a crate that cannot be built gets feature 008's messages: a missing dependency, a missing linker, compile errors (008 R6 to R8).
- R7: A program that stops while running, by a panic, `process::exit` or reading input, gets feature 007's message, which names the arguments it was given, so that a user whose program rejected them can see why.
- R8: A run that has no step in the active file says so, rather than drawing an empty panel.
- R9: Any new setting is declared in `contributes.configuration` and documented in the README (constitution 4).

## Acceptance criteria

- [x] AC1: In a fixture of the Rust Book's minigrep, split into `main.rs`, `lib.rs` and a module, which reads its query and file name from the arguments and the file with `fs::read_to_string`, Show Stack and Heap run from `main.rs` with the arguments `frog poem.txt` draws `main`'s steps, and the run ends in success, not in feature 007's "stopped while running".
- [x] AC2: Run from the module holding `Config`'s parsing, the same program draws the steps in that file, and a step's stack holds `main`'s frame below the parsing function's.
- [x] AC3: Run with no arguments, minigrep is reported as stopped while running, and the message names the arguments, none.
- [x] AC4: A program whose binary uses a crates.io dependency, vendored in the fixture as in feature 008's tests, is run and drawn.
- [x] AC5: An unsaved edit in a module changes the trace, and the project folder is unchanged after the runs.
- [x] AC6: Feature 007's tests pass unchanged for files that belong to no package.
- [x] AC7: The arguments given for a project are offered again on the next run, as D2 settles.
- [x] AC8: A run from a file with no step in it says so.
- [x] AC9: A program holding a reference to a string literal, such as `let s = "hi";`, is drawn, both from a file of a package and from a file alone (feature 007), with the literal's text in the heap (D7).

## Out of scope

- Programs that need standard input, threads beyond what Miri allows, the network, or a terminal; Miri's limits stay feature 007's.
- Running tests, examples or benches; only binaries.
- Stepping through the run, or choosing which steps to draw, beyond feature 007's limit.
- Drawing several files at once, or switching the panel's file as the run moves between files.
- Choosing cargo features or environment variables for the program.
- Platforms other than darwin-arm64, as for feature 005.

## Open questions

None. Q1 to Q6 were settled when the draft was approved and are recorded as D1 to D6.

## Appendix A: what is known before the probe

| Fact | Source |
| --- | --- |
| The interpreter configures Miri in code: `mute_stdout_stderr: true`, `validation: No`, `borrow_tracker: None`, and Miri's defaults otherwise, which give the program no arguments and isolate it from the file system, the clock and the environment. `MIRIFLAGS` is not read. | `crates/aquascope/src/interpreter/step.rs:168-185` (`VisEvaluator::new`) |
| The interpreter runs the crate's entry function, `tcx.entry_fn`, so the crate compiled with it must be a binary. | `crates/aquascope/src/interpreter/step.rs:171` |
| The interpreter's compiler configuration sets no `-Zalways-encode-mir`; only `override_queries` when `should_fail`. | `crates/aquascope/src/interpreter/mod.rs`, `InterpretCallbacks::config` |
| The plugin runs the interpreter through rustc_plugin like the permissions view, so `--crate-of` (feature 008, D2) selects the binary's crate with `--bin <name>`. | `crates/aquascope_front/src/plugin.rs:149-160`; T-045 |
| rustc_plugin's driver compiles the workspace's crates, as `RUSTC_WORKSPACE_WRAPPER`, with `--sysroot` from `MIRI_SYSROOT` when it is set; crates.io dependencies are compiled by cargo with the plain compiler. | `rustc_plugin-0.15.2-nightly-2026-05-01`: `src/driver.rs` (`get_sysroot`), `src/cli.rs:46` |
| A trace's frames carry their location as a `CharRange`, whose file is only a `FilenameIndex`. | `src/analysis/bindings/MFrame.ts`, `CharRange.ts` |
| Feature 007's probe: a panic, `process::exit` and a read from standard input end the run with a bare build error and exit code 0; steps multiply with calls of the program's own functions; the panel draws at most 100 steps. | Spec 007, Appendix A and D6 |
| The Book's minigrep reads `env::args()` into `Config::build`, calls `process::exit(1)` when it fails, and reads the file with `fs::read_to_string`. | The Rust Programming Language, chapter 12 |

## Appendix B: probe results, 2026-11-09

Run with `spikes/009-whole-crate-interpreter/probe.sh` (T-051), three times with the final prototype, on darwin-arm64; the times are the last run's, and the others were within 10%. The prototype is the fork's `v0.4.0-vscode.2` with `spikes/009-whole-crate-interpreter/fork-probe.patch`, which adds the plan's five changes as options of `cargo aquascope interpreter` (`--allow-io`, `--miri-build`, `--main <file>`, `-- <args>`, `file_path` on frames, the error on stderr) and D7's reading of values. "One crate" below is `--crate-of src/lib.rs interpreter --miri-build --allow-io --main src/main.rs`.

| Run | Exit | Time | Output |
| --- | --- | --- | --- |
| minigrep, binary alone, usual build settings, `frog poem.txt` | 101 | 0.3 s | none; panic: `config::Config::build` "does not have a optimized_mir" |
| minigrep, binary alone, Miri's build settings (change 2) | 0 | 4.1 s | 4 steps, all in `src/main.rs`; success |
| minigrep, one crate, first and second run | 0 | 9.2 s, 8.9 s | 25 steps: `src/main.rs` 6, `src/config.rs` 7, `src/lib.rs` 12; success; stack up to 3 deep; 211 KB |
| minigrep, one crate, `"a frog" poem.txt` | 0 | 11.7 s | the same 25 steps, the quoted argument read as one |
| minigrep, one crate, usual build settings | 0 | 9.1 s | the same 25 steps: with no dependency, everything is in the one crate |
| minigrep, one crate, after an edit to `config.rs` | 0 | 7.9 s | the trace changed (210 KB) |
| minigrep, one crate, no arguments | 0 | 0.4 s | `{"Err": BuildError}`; stderr "the evaluated program completed with exit code 1" |
| minigrep, one crate, `frog missing.txt` | 0 | 2.0 s | the same as no arguments |
| minigrep, one crate, isolation kept | 0 | 0.4 s | `{"Err": BuildError}`; stderr "`open` not available when isolation is enabled" |
| binary with a module, no library, usual and Miri's settings | 0 | 0.3 s | 13 steps: `src/main.rs` 7, `src/shapes.rs` 6 |
| binary using vendored `itoa`, usual settings | 101 | 0.3 s | none; E0460 "found possibly newer version of crate `core` which `itoa` depends on" |
| binary using vendored `itoa`, Miri's settings, first and second | 0 | 0.5 s, 0.5 s | 20 steps in `src/main.rs`; `itoa`'s own steps are not drawn |
| binary whose modules use `crate::`, one crate | 101 | 0.2 s | none; E0432 unresolved import `crate::helpers` |
| the same, binary alone | 0 | 0.3 s | 12 steps: `src/main.rs` 5, `src/cli.rs` 5, `src/helpers.rs` 2; `cargo check` of the package passes |
| workspace: binary member using a library member, usual settings | 101 | 0.3 s | none; panic: `greeter::greet` has no optimized MIR |
| the same, Miri's settings | 0 | 0.8 s | 3 steps in `app/src/main.rs`, reading `names.txt` at the workspace root; `greet`'s steps are not drawn |
| two binaries, one crate with `--main src/bin/whisper.rs` | 0 | 0.4 s | 7 steps: `src/bin/whisper.rs` 5, `src/lib.rs` 2 |
| two binaries, one crate with `--main src/main.rs` | 0 | 0.3 s | 6 steps: `src/main.rs` 4, `src/lib.rs` 2 |
| `let s = "hi";`, the pinned fork (feature 007 today) | 101 | 0.2 s | none; "stack overflow, aborting" |
| the same, the prototype | 0 | 0.2 s | 4 steps; `s` points into heap location 0, which holds the characters `h`, `i` |

| Finding | Detail |
| --- | --- |
| The one-crate build compiles the library as an executable | Miri stops with "interpreting a non-executable crate" (`miri/src/helpers.rs:146`) on a library crate. The prototype changes the library's `--crate-type` to `bin`, adds `-Zcrate-attr=no_main`, and starts at the function `main` of the module `__aquascope_main` |
| Miri's build settings apply to the target only | The prototype adds `--target <host>` with `CARGO_ENCODED_RUSTFLAGS` of `--sysroot <MIRI_SYSROOT> -Zalways-encode-mir`, so build scripts and proc macros keep the ordinary standard library, as `cargo miri` does |
| The program's name | The program's first argument is the crate's name: `minigrep` here; in a one-crate build, the library's name |
| Frames | Names such as `config::Config::build`, `run` and `search`; `file_path` relative to the workspace root; each frame's positions are in its own file |
| Why values crashed the interpreter | A `&str` not reached through a `String` is read by reading its pointer, which reads the `str`, which reads the pointer again until the stack overflows; a trait object reaches `todo!()`; and a pointer into an allocation with no sized layout fails an assertion (`miri_utils.rs:146`). The prototype's fix is about 40 lines in `mvalue.rs` |
| Errors | With change 5, stderr names the reason a run ended without a trace: the program's exit code, or the operation that isolation refused |

Captures for the unit tests are in `src/test/fixtures/data/stack-heap-crate/`: the metadata of minigrep, the two-binary package and the workspace; minigrep's one-crate trace and its run with no arguments; the workspace's trace; and the compiler's errors for the one-crate build of the `crate::` fixture.
