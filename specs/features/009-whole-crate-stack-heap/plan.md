---
feature: 009-whole-crate-stack-heap
---

# Plan

## Approach

The feature keeps what features 007 and 008 built. Feature 007 supplies the Show Stack and Heap command, the Miri-built standard library in the bundle, the interpreter's output parsing, the panel and the step limit. Feature 008 supplies finding the crate a file belongs to, the copy of the project with the unsaved editors written over it, the classification of crate build failures, and the offer to fall back to the file alone. What is new comes in five parts. The fork gains changes so that a whole program can run in its interpreter with arguments and file access. The extension chooses which binary runs and with which arguments, runs it in the copy, keeps the steps that are in the active file, and explains failures. The work starts with a probe, because several decisions rest on what the fork can do, and it ends with the acceptance tests.

**What the interpreter can step through.** Reading the fork while writing this plan turned up a limit that the spec does not mention, and it shapes the design. Aquascope's interpreter records a step only while a function of the crate being compiled is running. Frames of functions from any other crate are dropped from the stack, and the code that maps the program's compiled steps back to source lines needs that crate's syntax tree, which the compiler has only for the crate it is compiling (Appendix C). Minigrep's `main.rs` and its library are two crates, so running the binary as the crate would draw only `main.rs`. A call into `minigrep::run` would pass in one step, like a call into the standard library, and a run started from `config.rs` would have no steps at all, which defeats D1, D4 and AC2. There are two ways round this. The first is to teach the interpreter to step through other crates' functions, which means mapping steps to source from the compiled code instead of the syntax tree. That is a rewrite of its mapper that upstream would be unlikely to take. The second is to compile the package's library and binary as one crate, and it is the one this plan takes. The fork compiles the library with two lines added at the end of its root file:

- `extern crate self as <library name>;`, so that the binary's `use minigrep::Config;` names the crate itself;
- `#[path = "<binary's root file>"] mod <hidden module>;`, so that the binary's code becomes a module of the library.

The run then starts at that module's `main`. Because the lines are added at the end, every position in every file stays the same. The fork adds them through the compiler's file loader, so nothing is written to disk. Every function of the library and the binary is then in the crate being compiled, and every step in `main.rs`, `lib.rs` and `config.rs` is recorded, with `main`'s frame below the others. The probe checks this on the fixtures. If it fails, the spec is revised before T-052, either toward the first way or toward drawing only the binary's own files.

**What the probe settles first (D3, D4, D5).** T-051 builds `spikes/009-whole-crate-interpreter/probe.sh` in the style of T-044's probe, with a scratch build of the fork carrying the changes the next paragraph lists. Its fixture projects are:

- the Rust Book's minigrep from chapter 12, split into `main.rs`, `lib.rs` and `config.rs`, reading `poem.txt` named on its command line;
- a binary package with modules and no library;
- a binary using a crates.io dependency, vendored as in feature 008's fixture;
- a binary whose own modules refer to each other through `crate::` paths, which the one-crate build changes the meaning of;
- a workspace whose binary member uses a library member.

For each, it records the following, and the results go into the spec's Appendix B, revising any decision they overturn:

- whether Miri can run the program with the compiler's usual settings, and with the build settings of change 2 below, including whether the library's and dependencies' functions can be run and whether the standard library is mixed from two places;
- whether the arguments reach `std::env::args()`, with the binary's name first, and from which working folder `fs::read_to_string("poem.txt")` reads;
- whether the one-crate build compiles, the frames' names and paths, and whether a step in `config.rs` has `main`'s frame below it;
- the steps in the whole run and in each file, the output size, and the times of the first and later runs;
- what a run with missing arguments returns, and what the interpreter's own error message says when a run fails.

The captured outputs become test data in `src/test/fixtures/data/stack-heap-crate/`, as T-044's did.

**The fork (D3, D4).** T-052 makes five changes in [phamquy/aquascope](https://github.com/phamquy/aquascope), on a branch from `v0.4.0-vscode.2`:

1. **Arguments and file access.** The interpreter command takes the program's arguments and passes them to Miri as the program's command line, with the binary's name first. A separate option lifts isolation, as `-Zmiri-disable-isolation` does (D3).
2. **Whole-program builds.** For the interpreter, rustc_plugin's `modify_cargo` gives every crate Miri's standard library and `-Zalways-encode-mir`, as `cargo miri` does. Without this, the compiled code of most library and dependency functions is not kept in a form Miri can run, and crates.io dependencies are built against the ordinary standard library.
3. **Frame paths.** Each frame of a trace names its file, relative to the workspace root, as feature 008's D3 did for permissions results (D4).
4. **One crate.** An option names the binary's root file. With it, the library crate is compiled with the two lines above, and the run starts at the hidden module's `main`.
5. **Error messages.** When the interpreter fails, its error message goes to standard error instead of being discarded, so the extension's log says why.

Each change gets a test in Aquascope's suite and passes its formatting and clippy checks. The fork is tagged `v0.4.0-vscode.3`. Changes 1, 2, 3 and 5 are offered upstream; change 4 exists only to serve the extension and stays in the fork. As in T-045, the task updates `pin.env`, rebuilds the development bundle, regenerates the bindings and updates ADR 0004.

**Choosing the binary and the arguments (R1, R3, D1, D2).** Feature 008's metadata reading in `project.ts` gains the package's binaries, each with its name and root file, and the root file of its library. A new module, `program.ts`, makes both choices:

- **The binary (D1).** A file of a binary target runs that binary. Otherwise the package's only binary runs. When it has several, a quick pick lists them, and the choice is remembered in the extension's workspace state, keyed by the project and package. A package with no binary gets a `noBinary` message that offers to run the file alone.
- **The arguments (D2).** An input box asks for them, filled with the arguments last used for the project. Enter runs and saves them. Escape cancels the run without a message. The text is split as a shell splits it, with single and double quotes and backslashes, and an unclosed quote is pointed out in the box before the run starts.

The command also accepts an optional argument that gives the binary, the arguments or the file-alone run directly. The tests use it, and so does the Run This File Alone action.

**Running the program (R2, R4, R6, D3, D5).** `interpret.ts` gains a crate run beside feature 007's single-file run, which files outside a package keep (AC6). The crate run:

- brings feature 008's copy of the project up to date;
- runs the fork's interpreter in the copy of the workspace root, with `--crate-of` naming the library's root file and the one-crate option naming the binary's. A package with no library runs the binary's crate directly;
- passes the arguments and lifts isolation;
- sets `MIRI_SYSROOT` as feature 007 does, and sets `CARGO_TARGET_DIR` to the project's own `target-interpreter/`. Builds with change 2's settings differ from the permissions view's, so each view keeps its own build folder and neither rebuilds the other's;
- on the first run for a project, builds everything with no timeout but can be cancelled, under its own progress title, "Aquascope: building the program for the interpreter (first run on this crate)". A marker in the project folder records that the first build ran, and later runs use the usual timeout.

The program's working folder is the one cargo gives the compiler, the copy of the workspace root, which the probe confirms (D3). Its standard input is empty, as the runner already gives no input, so a program that reads input sees the input end. If the one-crate build fails to compile while the binary alone compiles, which is the case of a binary whose own files use `crate::` paths, the run is repeated with the binary alone. The log records the switch, and only the binary's files then have steps.

**Drawing the active file's steps (R5, R8, D4).** `traceInput.ts` keeps the steps whose current frame is in the active file, by the path each frame now carries, matched against the file's path relative to the workspace root as feature 008's selection does. Each kept step keeps its whole stack and heap. The vendored renderer reads every frame's position against the drawn file and throws on a position outside it, though it draws only the current frame's. So frames from other files keep their names and locals, and their positions are replaced by the start of the active file. Columns are converted to UTF-16 with the active file's text, as feature 007 does. Feature 007's step limit, notes and undefined-behaviour marking then apply to the kept steps (R5). If the probe finds that the hidden module's name shows in `main`'s frame, the frame is renamed to `main`. A run with no step in the active file gets a `noStepsInFile` message that names the files that do have steps (R8, AC8).

**Failures (R6, R7, D6).** The crate run reuses feature 008's classification:

- `dependencyMissing` and `linkerMissing`, read from cargo's output;
- `compileErrors`, with the files and lines from a plain `cargo check` of the binary's target in the copy (008 R8).

Feature 007's `programFailed` message now names the arguments the program was given, quoted as the user typed them, or says it was given none (R7, AC3). The notification for a failure to build or start the crate run carries a **Run This File Alone** action, which runs feature 007's single-file run on the same editor (D6). The action is not offered when the run is cancelled, when the program itself stopped, or when the file has no steps, since running the file alone does not help in those cases. `CARGO_NET_OFFLINE` stays set (R6).

## VS Code APIs and contribution points

- No new commands, menus or settings (D2, R9). `aquascope.showStackAndHeap` takes an optional argument, as `aquascope.analyzeAtCursor` does.
- `vscode.window.showQuickPick` for the binary, and `vscode.window.showInputBox` with `value` and `validateInput` for the arguments.
- `ExtensionContext.workspaceState` for the remembered binary and arguments.
- An item on `showErrorMessage` for the Run This File Alone action, and a second progress title through `withProgress`.

## Files touched

- `spikes/009-whole-crate-interpreter/` (new): `probe.sh`, its fixture projects and its fork patch.
- The fork: `crates/aquascope_front/src/plugin.rs` for the options and `modify_cargo`; `crates/aquascope/src/interpreter/` for the arguments, isolation, frame paths, one-crate entry and error message; their tests; tag `v0.4.0-vscode.3`.
- `spikes/002-toolchain-bundling/pin.env`, `docs/adr/0004-build-aquascope-from-a-fork.md`, and `src/analysis/bindings/` (regenerated).
- `src/analysis/project.ts`: binaries and library root. `src/analysis/program.ts` (new): choosing the binary, asking for and splitting the arguments, and remembering both.
- `src/analysis/interpret.ts`: the crate run, its first-run build and the one-crate fallback. `src/analysis/command.ts`: choosing the crate run or the single-file run, and the Run This File Alone action. `src/extension.ts`: the command's optional argument.
- `src/analysis/errors.ts` and `types.ts`: `noBinary`, `noStepsInFile`, and `programFailed` naming the arguments.
- `src/visualization/traceInput.ts`: keeping the active file's steps and placing other files' frames.
- `src/test/fixtures/projects/minigrep-book/` (new), the chapter 12 program with its `poem.txt`. `src/test/fixtures/projects/with-dep/` gains a `src/main.rs`, and feature 008's tests on it must still pass. `src/test/fixtures/data/stack-heap-crate/`: T-051's captures.
- `src/test/suite/`: unit tests for the new and changed modules, and `stackHeapCrate.test.ts` (new) for the end-to-end criteria.
- `README.md`: Show Stack and Heap on a crate, the arguments, file access and the limits.
- `specs/features/009-whole-crate-stack-heap/spec.md` and `specs/product.md`: Appendix B from T-051, then criteria ticked and status `implemented`.

## Risks

- **The one-crate build has limits.** In the binary's own files, `crate::` now means the library's root, so a binary whose modules use such paths falls back to running alone, and only its own files get steps. Attributes that only make sense at a crate's root, written at the top of `main.rs`, now sit in a module, where the compiler warns about or rejects some of them. A library that already declares `extern crate self` under its own name would clash. The probe tries the first case. The others are recorded in the README's limits if they occur.
- **Other crates of the workspace stay hidden.** The one-crate build covers a package's own library. A binary that uses another member of the workspace still runs that member's code, but its steps and frames are not drawn, as with crates.io dependencies. The README says so.
- **Running the program with isolation lifted.** The program reads and writes files as the user, as `cargo run` does. Relative paths land in the copy, but absolute paths reach the user's files. Feature 008 confirmed that the extension is disabled in Restricted Mode, so this happens only in a workspace the user trusted.
- **Miri's speed.** Miri interprets every function, including the standard library's, so a whole program can be slow and can take many steps before it reaches the active file. Feature 003's timeout applies after the first build. The probe's step counts may revise feature 007's step limit (D5).
- **The entry point.** Aquascope starts the program at `main` itself, skipping the standard library's start-up code. On macOS, Miri's own functions supply the program's arguments without that code, and the probe checks this. Other platforms are out of scope.
- **Disk use.** Each project gains a second build folder of its dependencies, built with Miri's settings. As in feature 008, nothing cleans it up.
- **A growing fork.** The fork will carry eight changes, one of which upstream will not take. Each Aquascope upgrade means rebasing them.

## Test strategy

- **The probe (T-051)** is a script, like T-044's. Its captures feed the unit tests.
- **Unit tests** cover these without the toolchain:
  - `project.ts`: binaries and library roots from captured metadata;
  - `program.ts`: the choice of binary, including the remembered pick; splitting arguments, including quotes and an unclosed quote; and the arguments offered again (AC7);
  - `traceInput.ts`: keeping the active file's steps, placing other files' frames, the step limit after filtering, and an empty result, from the probe's captures;
  - `errors.ts`: `programFailed` with and without arguments, `noBinary` and `noStepsInFile`;
  - `interpret.ts`: the command line of a crate run, with and without a library, and the fallback decision.
- **Aquascope's own suite** tests the fork's changes (T-052).
- **End-to-end tests against the development bundle** go in `stackHeapCrate.test.ts`: AC1 to AC5, AC7 and AC8. Feature 007's `stackHeap.test.ts` stays unchanged, for AC6. The tests pass the binary and the arguments through the command's argument instead of driving the dialogs, which the unit tests cover. The fixtures depend on neither the network nor the machine's cargo cache, as in feature 008.
- **Packaging:** the strict test run of every package runs the end-to-end tests against the packaged bundle, as today.

## Appendix A: module responsibilities

| Module | Requirements | Decides | Tested by |
| --- | --- | --- | --- |
| Fork: `plugin.rs`, `interpreter/` | R3 to R5, D3, D4 | Arguments, isolation, whole-program builds, frame paths, one-crate build, error message | Aquascope's suite |
| `project.ts` | R1 | The package's binaries and library root | Unit, from captured metadata |
| `program.ts` | R1, R3, D1, D2 | Which binary; the arguments, split and remembered | Unit |
| `interpret.ts` | R2, R4, R6, D3, D5 | Crate run or single-file run; first build; one-crate fallback | Unit; end to end |
| `command.ts`, `extension.ts` | R1, D6 | The command's flow and argument; the Run This File Alone action | End to end |
| `traceInput.ts` | R5, R8, D4 | The active file's steps; other files' frames; the step limit | Unit; end to end |
| `errors.ts`, `types.ts` | R6 to R8 | `noBinary`, `noStepsInFile`, `programFailed` with the arguments | Unit; end to end |

## Appendix B: acceptance criteria to tests

| Criterion | Test |
| --- | --- |
| AC1 | `stackHeapCrate.test.ts`: `minigrep-book` run from `main.rs` with `frog poem.txt` draws `main`'s steps and ends in success |
| AC2 | `stackHeapCrate.test.ts`: the same run from `config.rs` draws its steps, and a step's stack has `main`'s frame below the parsing function's |
| AC3 | `stackHeapCrate.test.ts`: the run with no arguments gives `programFailed`, and the message says it was given none |
| AC4 | `stackHeapCrate.test.ts`: `with-dep`'s `main.rs`, using the vendored `itoa`, is run and drawn |
| AC5 | `stackHeapCrate.test.ts`: an unsaved edit in `config.rs` changes the trace, and every fixture project is unchanged afterwards, as feature 008's AC4 test checks |
| AC6 | Feature 007's `stackHeap.test.ts`, unchanged |
| AC7 | `program.test.ts`: the input box is filled with the project's last arguments; `stackHeapCrate.test.ts`: a run's arguments are saved for the project |
| AC8 | `stackHeapCrate.test.ts`: a run from a file of the package that the program never reaches gives `noStepsInFile`, naming the files with steps |

## Appendix C: the interpreter's limit to one crate

| Fact | Source |
| --- | --- |
| Steps are built from the frames of functions in the crate being compiled; other frames are filtered out with `def_id().is_local()`. | `crates/aquascope/src/interpreter/step.rs:517-531` (`local_frames`), used by `step` at line 596 |
| Mapping a function's compiled steps to source needs its syntax tree: `hir_body_owned_by(inst.def_id().expect_local())`, which exists only for the crate being compiled. | `crates/aquascope/src/interpreter/mapper.rs:64` |
| A step's position is cut to the current function's body with `as_local(outer_span)`. | `crates/aquascope/src/interpreter/mod.rs:54-64` |
| The interpreter's error is replaced by a bare build error. | `crates/aquascope_front/src/plugin.rs:149-160` |
| `--crate-of` applies to every command, including the interpreter. | `crates/aquascope_front/src/plugin.rs:65-70` |
| rustc_plugin lets a plugin change the cargo command through `modify_cargo`. | `rustc_plugin-0.15.2-nightly-2026-05-01/src/plugin.rs:51` |
| Miri's configuration has `args`, given to the program as `argc` and `argv`, and to `_NSGetArgc` and `_NSGetArgv` on macOS, and `isolated_op`, whose default rejects file access. | Miri `e88582a`, `src/eval.rs`: lines 51, 59, 130 and 302-335 |
| The renderer draws a step's marker at the current frame's position, but reads every frame's position against the drawn file through `codeRange`, whose line lookup throws outside the file. | `media/aquascope-embed/embed.iife.js`: `FrameView`, `codeRange`, `filterSteps` |
| The runner gives the program no standard input. | `src/analysis/runner.ts:99` |
