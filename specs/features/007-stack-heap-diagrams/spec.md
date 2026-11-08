---
id: 007-stack-heap-diagrams
title: Show the stack and heap at each step
status: approved
---
# Show the stack and heap at each step

## Why

The Rust Book's experiment edition explains ownership with two kinds of diagram. One is the permissions view this extension already draws. The other shows what memory looks like as the program runs: after each step, the stack frames with their local variables, and the heap with arrows from pointers to the values they own. That second view is how the Book first teaches moves, `Box` and drops (chapter 4.1), and the Aquascope playground offers it as its "interpreter" mode. A learner in VS Code has no way to see it for their own program.

A probe on 2026-11-07 showed that most of the work is already done. The `cargo-aquascope` the extension bundles already contains the interpreter. It failed only because the interpreter runs the program in Miri, Rust's interpreter for detecting undefined behaviour, and Miri needs a copy of the standard library compiled for it. With that copy, built from the pinned nightly in 14 seconds, the interpreter ran the Book's move example in about a second. It returned one step after each statement of `main` and one at its end, each holding the stack frames, their variables and the heap. The renderer this extension already vendors draws this output, as the Book does. When no lines are marked, it puts a step marker (L1, L2, …) after each step's line and a memory diagram for each step. Appendix A has the probe's results and Appendix B the renderer's behaviour.

This view differs from the permissions view in ways that shape the feature. The interpreter executes the program, starting at `main`, instead of analysing one function without running it. A file therefore needs a `main` function, the temporary crate must be a binary rather than the library 003 writes, and the view covers the whole run, not the function at the cursor. A program that panics came back from the interpreter as a bare build error with no location, so the extension cannot yet say where it failed. And the Miri-built standard library adds 193 MB unpacked, or 61 MB compressed, to each platform's package. That would take the darwin-arm64 VSIX from about 125 MB to about 185 MB, against the Marketplace size limit that `specs/product.md` already lists as a risk. The alternative, building it on the user's machine on first use, cuts against the product's zero-install and offline constraints (constitution 6).

## Decisions

Recorded 2026-11-07 when the draft was approved. Each one takes the recommendation given for the open question it settles.

- D1 (was Q1): The view is run from the Command Palette only in this feature. A title-bar button or a switch in the panel is decided once the view has been used.
- D2 (was Q2): The VSIX ships the Miri-built standard library, built by the packaging script, so the extension stays zero-install and offline. Before packaging work depends on it, the plan checks the package against the Marketplace's size limit, and an ADR beside ADR 0002 records the choice.
- D3 (was Q3): Every step is drawn, as the renderer does by default and as the playground shows.
- D4 (was Q4): A program that stops while running gets a plain message. The plan's first task checks what panics, failed assertions and undefined behaviour return, and the spec is revised if some keep their steps.
- D5 (was Q5): The view shares the single Aquascope panel with the permissions view; the latest run replaces whichever view the panel showed.
- D6 (was Q6): The panel draws at most a fixed number of steps and says when it stopped there. The plan sets the limit once it has been measured.

Revised 2026-11-08 from T-036's probe (Appendix A) and T-037's size check.

- D2, revised: The Marketplace documents no package size limit, and settling it needs a test publish. The owner chose not to run one before the extension is on the Marketplace. [ADR 0003](../../../docs/adr/0003-ship-miri-sysroot.md) records shipping the library with the limit unverified: the package check's cap rises to 200 MB, the first Marketplace publish is the check, and if that publish is rejected for size the library moves out of the VSIX.

- D4, revised: Undefined behaviour keeps its steps. The trace ends with an error result naming it, and the renderer marks the last step as failed, so such a program is drawn and the panel names what went wrong. A panic, a failed assertion, `std::process::exit` and a read from standard input return a bare build error with no steps; those get the plain message. Code with compile errors, including code that fails borrow checking, cannot run at all, unlike in the permissions view.
- D6, revised: Loop iterations do not multiply steps; a `for` loop is one step however many times it runs. Calls to the program's own functions do, about five steps per call of a two-statement function, and every step carries the whole stack: 1,000 calls in a loop gave 5,004 steps and 4 MB of output, and recursion 100 deep gave 606 steps and 10 MB. The limit is 100 steps. The fixtures need at most 11, and ten calls or ten levels of recursion at most 66.

## User stories

- As a Rust learner, I want to run my program and see the stack and heap after each line, so that I can see where each value lives, when a move happens and when a value is dropped.
- As a learner whose program calls functions, I want to see each call's frame on the stack, so that I can follow values passed into and returned from functions.
- As a learner whose file has no `main`, or whose program fails while running, I want a plain explanation, so that I know what to change.

## Requirements

- R1: The extension contributes a command, titled "Aquascope: Show Stack and Heap", shown in the Command Palette when the active editor is a Rust file (D1). It activates the extension on use only (constitution 3).
- R2: The command runs Aquascope's interpreter on the active editor's current text, including unsaved changes, written as `src/main.rs` of a temporary binary crate. Everything else about the run follows feature 003: the edition rule (R2), toolchain resolution (R3), the scrubbed environment (R4), no network (R5), progress, cancellation and timeout (R8), cleanup (R9) and logging (R11).
- R3: The interpreter finds a Miri-built standard library for the pinned nightly, through `MIRI_SYSROOT` or the bundle's layout, with no network access at run time (constitution 6). The library ships in the VSIX, built by the packaging script for the pinned nightly (D2).
- R4: The result opens in the single Aquascope panel, replacing whichever view it showed (D5), drawn by the vendored embed's interpreter view in VS Code's theme as feature 004 draws permissions. The panel shows the program's code with a marker after each step's line and, for each step, the stack frames with their local variables and the heap. Every step is drawn (D3), up to the limit in R8.
- R5: Failures are reported as actionable messages, in a notification and in the panel as for feature 004. A file with no `main` gets a message saying that this view runs the program, so it needs a `main` function. Compile errors are explained as feature 003 R10 explains them, including the single-file limit. Code that fails borrow checking is a compile error here, because it cannot run. A program that stops while running, by a panic, a failed assertion, `std::process::exit` or reading input, gets a message saying so, and the log keeps the interpreter's output (D4). A program whose run reaches undefined behaviour is drawn with its steps, the last marked as failed, and the panel names the undefined behaviour Miri reported (D4). A timeout or a tool failure gets feature 003's messages.
- R6: The packaged VSIX includes the Miri-built standard library, and the packaging check (feature 005) verifies that it is present. The package check's size cap is 200 MB, and the Marketplace's limit is checked by the first publish (D2, ADR 0003).
- R7: The README describes the command and its limits: it runs the whole program from `main`, inside Miri, so a program that reads input, files, the clock or the network, that exits early, that fails borrow checking or that never ends, cannot be shown.
- R8: The panel draws at most the first 100 steps and says when it stopped there (D6).

## Acceptance criteria

- [ ] AC1: For fixture `01_move_string`, the command opens the panel with four step markers (L1 to L4). The first step's stack holds `main` with `s1` and one heap value; the second holds `s1` and `s2`; the last holds no variables and no heap value.
- [ ] AC2: For fixture `05_method_mut_borrow`, at least one step shows a frame for `grow` above the frame for `main`.
- [ ] AC3: For a file with no `main`, the message says the view needs a `main` function, not a raw compiler error.
- [ ] AC4: For a program that panics, the message says the program stopped while running, and the log holds the interpreter's output.
- [ ] AC5: An unsaved edit is run: after changing a fixture in the editor without saving, the steps reflect the edited text.
- [ ] AC6: With the network off, the command works on a machine where it has never run before.
- [ ] AC7: The packaging check confirms that the VSIX holds what R3 needs, and the package size is recorded.
- [ ] AC8: Integration tests cover AC1 to AC5, AC10 and AC11 and pass in `npm test`.
- [ ] AC9: A hand check, recorded in the task note, compares the panel for the Book's chapter 4.1 move example with the Book's own diagram, in a dark and a light theme.
- [ ] AC10: For a program that calls its own function in a loop often enough to produce more than 100 steps, the panel draws exactly 100 and says that it stopped there.
- [ ] AC11: For fixture `i4_use_after_free`, the panel draws four steps, the last marked as failed, and names a use after free.

## Out of scope

- Analysing a single function or the function at the cursor: Miri runs the program from `main`.
- Programs that need input, files, environment variables, the clock, the network or threads beyond what Miri allows by default.
- Markers in the code that choose which steps to draw, as the Book's source uses (D3).
- A title-bar button or a switch in the panel for this view (D1).
- Stepping or animation controls beyond what the vendored renderer draws.
- Platforms other than darwin-arm64, as for feature 005.
- Showing permissions and memory together in one diagram.

## Open questions

None. Q1 to Q6 were settled when the draft was approved and are recorded as D1 to D6.

## Appendix A: probe results, 2026-11-07 and 2026-11-08

The first six rows are the probe behind the draft, on 2026-11-07; the rest are T-036's, on 2026-11-08, from `spikes/007-interpreter/probe.sh`, whose `work/report.txt` holds the full table. Both ran on darwin-arm64 with the development bundle (spike 002's `cargo-aquascope` and trimmed toolchain) in the environment feature 003 R4 sets, plus `MIRI_SYSROOT`, using `cargo aquascope interpreter` in a temporary crate.

| Case                                                                                       | Result                                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Bundled toolchain, no Miri-built library                                                   | Exit 101: "the current sysroot was built without `-Zalways-encode-mir`, or libcore seems missing"                                                                                                                              |
| `cargo +nightly-2026-05-01 miri setup` with `MIRI_SYSROOT` set to a scratch folder         | Built in 14 s; 193 MB unpacked, 61 MB as a gzip'd tar                                                                                                                                                                          |
| Fixture `01_move_string` as `src/main.rs`, with that library                               | Exit 0 in about 1 s; `{"Ok": …}` with 4 steps, each `{stack: {frames}, heap: {locations}}`. The steps are at lines 3, 4, 5 and 6; locals `s1`, then `s1` and `s2`, then none at the end; one heap location until the last step |
| The same file as `src/lib.rs`                                                              | Exit 101: the interpreter panics with "no main or start function found"                                                                                                                                                        |
| A binary crate with no `main`                                                              | Exit 101: compiler error E0601, "`main` function not found"                                                                                                                                                                    |
| A program that indexes a `Vec` out of bounds                                               | Exit 0, `{"Err": {"type": "BuildError", "range": null}}`, with no steps and no panic text in stderr                                                                                                                            |
| A panic, a failed `assert_eq!`, `std::process::exit(3)`, and `read_line` on standard input | Each: exit 0, `{"Err": {"type": "BuildError", "range": null}}`, no steps, no message in stderr; `cargo check` finds no errors                                                                                                  |
| Use after free in `unsafe` code (`i4_use_after_free`)                                      | Exit 0, `Ok` with 4 steps at lines 3 to 6 and result `{"type": "Error", "value": {"type": "PointerUseAfterFree", …}}`                                                                                                          |
| A type error (E0308), a borrow error (fixture `04`, E0502), no `main` (E0601)              | Exit 101, no stdout, the plugin panics; a plain `cargo check` reports the error code                                                                                                                                           |
| A loop that never ends                                                                     | Stopped by the probe's 20 s timeout, no output                                                                                                                                                                                 |
| `for` loops of 10 to 3,000 iterations, with and without a growing `Vec`                    | 4 steps each, whatever the count; output 1.5 to 4.5 KB; 0.25 s to 1 s                                                                                                                                                          |
| A two-statement function called in a loop 10, 100 and 1,000 times                          | 54, 504 and 5,004 steps; 42 KB, 412 KB and 4.1 MB; 0.25 s to 0.43 s                                                                                                                                                            |
| Recursion 10 and 100 deep                                                                  | 66 and 606 steps; 141 KB and 10.4 MB; the deepest stack 12 and 102 frames                                                                                                                                                      |
| Fixtures `01` to `03`, `05` and `n1_non_ascii`                                             | 4 to 11 steps, 0.2 s to 0.5 s; `05` shows `grow` and `area` frames above `main`                                                                                                                                                |
| Columns on `n1_non_ascii`'s line with `🦀é`                                                 | Character counts, as in the permissions output: a step ending after `("🦀é");` is at column 31, where UTF-16 would be 32                                                                                                        |

The interpreter's error mapping is in the pinned checkout at `crates/aquascope_front/src/plugin.rs:130-140`: any interpreter error becomes `BuildError { range: None }`.

## Appendix B: the vendored renderer's interpreter view

Sources are in the pinned checkout's `frontend/packages`.

| Behaviour                                                                                                                                                                    | Source                                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| The embed reads `data-operations`, `data-responses`, `data-config` and `data-annotations`, and renders each operation from its response without a server             | `aquascope-embed/src/main.tsx:251-273`                                                       |
| With no marked locations, every step is drawn, with a marker L1, L2, … at the end of each step's location; with marked locations, only the step reaching each mark is drawn | `aquascope-editor/src/editor-utils/interpreter.tsx:822-850`, `filterSteps` at `:766-793` |
| A trace whose result is an error marks its last step as failed                                                                                                               | `interpreter.tsx:750-757`, `:843-849`                                                      |
| The interpreter view takes `horizontal`, `concreteTypes` and `hideCode` options                                                                                        | `interpreter.tsx:43-47`                                                                      |
| The Book marks locations with `` `[]` `` in the code, collected as `interp.state_locations`                                                                                | `crates/mdbook-aquascope/src/annotations.rs:42-44`, `:64`, `:126`                        |
| The vendored `media/aquascope-embed/embed.iife.js` contains the interpreter operation                                                                                      | `embed.iife.js:51452`                                                                        |
