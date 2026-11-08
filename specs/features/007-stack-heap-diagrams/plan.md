---
feature: 007-stack-heap-diagrams
---

# Plan

## Approach

The feature reuses almost everything features 003 to 006 built. The run uses the same temporary crate, environment, runner, progress, timeout and logging. The result goes to the same panel and the same vendored renderer. The new parts are three. First, a Miri-built standard library has to be in the bundle. Second, the analysis side has to run the interpreter on a binary crate and explain its failures. Third, the panel has to draw the interpreter's trace instead of permissions. Two questions come before any of that, because their answers set numbers and choices the later tasks depend on. So the work starts with two investigations and ends with the acceptance tests.

**What the interpreter returns when things go wrong (D4, D6).** The spec's probe tried one panic, and it came back as `{"Err": {"type": "BuildError", "range": null}}` with no steps. The generated types say more: a trace's `result` can be `{"type": "Error", "value": MUndefinedBehavior}`, so undefined behaviour such as a use after free probably keeps its steps, and the renderer then marks the last one as failed. T-036 extends the spec's probe script to a set of programs and records what each returns:

- a panic, a failed `assert!` and `std::process::exit`;
- undefined behaviour in `unsafe` code;
- a type error and a missing `main`;
- reading standard input, and a loop that never ends.

It also measures the step count, run time and output size of loops of growing length, to choose D6's step limit. The results go into the spec's Appendix A, and the spec is revised if some failures keep their steps. The captured outputs become test data in `src/test/fixtures/data/`, as feature 004's captured permissions results did, so the panel can be built and tested without the toolchain.

**Whether a 185 MB package can be published (D2).** The VSIX check already caps the package at 150 MB, and the Miri-built library takes the darwin-arm64 package to about 185 MB. T-037 looked for the Marketplace's limit and found none documented. You chose not to test-publish before the extension is on the Marketplace, so ADR 0003 records shipping the library with the limit unverified, raises the cap to 200 MB, and makes the first Marketplace publish the check (spec D2, revised).

**The library in the bundle (R3, R6).** The packaging script's build stage already installs the pinned nightly with Miri and the standard library's source (`-c miri -c rust-src`). Its assemble stage gains one step: `cargo +<nightly> miri setup` with `MIRI_SYSROOT` set to `build/bundle/miri-sysroot`, giving the bundle a fourth top-level folder beside `bin/` and `toolchain/`. The VSIX check verifies the folder's library files are present and raises its size cap to the limit ADR 0003 sets. `npm run dev-bundle` builds the same library once into spike 002's work folder and links it into the development bundle, so the tests and F5 can use the interpreter. The library holds compiled code with full MIR, so the plan does not trim it. T-038 measures whether stripping debug information shrinks it, and keeps the result only if the probe programs still run.

**Running the interpreter (R1, R2, R5).** The temporary crate gains a binary form: `src/main.rs` with a `[[bin]]` target. The permissions view keeps the library form. Toolchain resolution is unchanged for the permissions view. The interpreter additionally requires `<root>/miri-sysroot`, and its absence is reported like any other missing tool, naming the folder and the setting. The run environment adds `MIRI_SYSROOT=<root>/miri-sysroot`, replacing any value the user's environment has, as 003 R4 does for the compiler's variables.

The new command, `aquascope.showStackAndHeap`, takes the active Rust editor's text, as the permissions command does without an argument (D1), and runs `cargo aquascope interpreter`. The output is one JSON object, `{"Ok": MTrace}` or `{"Err": AquascopeError}`, not the permissions view's list. Failures are classified this way (R5):

- **No trace:** an `Err`, or a non-zero exit, sends the extension to a plain `cargo check` of the same crate, as 003's D6 does. A missing `main` (E0601) gets the new `noMain` message. Other compile errors get 003's classification, including the single-file limit.
- **No compile errors either:** an `Err` with exit 0 is the program failing while it runs, which gets the new `programFailed` message. A non-zero exit is a tool failure, as in 003.

T-036's findings may refine this, for example if failed assertions or `process::exit` behave differently from a panic. The command shares 003's single in-flight run, so a new run of either view cancels the other.

**Drawing the trace (R4, R8).** A pure function shapes the trace for the embed, as `embedInput` does for permissions. It keeps the whole file as the code, because the trace's positions refer to the whole file. It converts every position from Aquascope's character columns to UTF-16, reusing 003's conversion. And it applies D6's limit: when the trace has more steps than the limit, it keeps the first steps up to the limit and sets the result to success, so the renderer does not mark the last kept step as failed, and it returns a note that the panel shows above the diagram. A trace whose result is undefined behaviour keeps that result, so the renderer marks its last step as failed, and the note names the undefined behaviour (spec D4, revised by T-036).

The page builder gains an interpreter variant, with `data-operations` set to `["interpreter"]` and the trace as the `interpreter` response. The panel gains `showTrace`, titled "Aquascope: stack and heap" and sharing the single panel with the permissions view (D5). The page script's report counts the drawn steps and step markers, so the tests can see what the renderer drew, as feature 004's report counts permission widgets. The content security policy stays as it is unless the panel tests report a violation. The interpreter view draws its arrows with SVG and inline styles, which the policy already allows.

## VS Code APIs and contribution points

- `contributes.commands`: `aquascope.showStackAndHeap`, titled "Aquascope: Show Stack and Heap".
- `contributes.menus.commandPalette`: the new command with `when: editorLangId == rust` (D1). No `editor/title` entry.
- Everything else is what features 003 and 004 already use: `withProgress`, the output channel, `createWebviewPanel` through `VisualizationPanel`.

## Files touched

- `spikes/007-interpreter/probe.sh` (new) and its programs: T-036's probe, kept so it can be rerun.
- `docs/adr/0003-ship-miri-sysroot.md` (new): D2's decision and the size limit.
- `scripts/package-platform.sh`: `cargo miri setup` into the bundle. `scripts/check-vsix.mjs`: the library check and the new size cap. `scripts/dev-bundle.mjs`: the development copy.
- `src/analysis/scratchCrate.ts`: the binary crate form.
- `src/analysis/toolchain.ts`: the Miri library's location and `MIRI_SYSROOT`.
- `src/analysis/interpret.ts` (new): the run, the output parsing and the failure classification.
- `src/analysis/types.ts`: the trace types and the new error codes `noMain` and `programFailed`.
- `src/visualization/traceInput.ts` (new): the trace shaped for the embed, the UTF-16 conversion and the step limit.
- `src/visualization/page.ts`, `panel.ts`, `media/panel.js`: the interpreter variant, `showTrace` and the report's counts.
- `src/extension.ts` and `package.json`: the command and its palette entry.
- `src/test/fixtures/data/`: T-036's captured traces. `src/test/fixtures/workspace/`: any new fixture programs.
- `src/test/suite/`: unit tests for `interpret.ts` and `traceInput.ts`, panel tests from captured traces, and `stackHeap.test.ts` for the end-to-end criteria. `harness.ts`: skip interpreter tests when the bundle has no Miri library, unless the run is strict (T-030).
- `README.md`: the command and its limits (R7).
- `specs/features/007-stack-heap-diagrams/spec.md` and `specs/product.md`: Appendix A extended by T-036; criteria ticked and status `implemented` at the end.

## Risks

- **The Marketplace limit.** It is undocumented and unverified (ADR 0003). If the first Marketplace publish is rejected for size, the library moves out of the VSIX, to a first-run build, a download or a companion extension, and the spec's D2 is revised; installing from VSIX files keeps working meanwhile.
- **The library and the trimmed toolchain.** `cargo miri setup` runs against rustup's full nightly, while the bundle runs the trimmed copy of the same nightly. The spec's probe ran the development bundle against such a library successfully. T-038 repeats that with the packaged bundle, and the strict test run (T-030) proves it on every package.
- **Symbolic links and build paths.** The packaging script refuses a bundle with symbolic links, and the library may hold absolute paths from the build machine. T-038 checks both on the built folder.
- **Runtime failures without steps.** If T-036 confirms that panics return no steps, AC4's message is all a learner gets for the most common failure. That is accepted by D4 for this version, and T-036's notes record what a later feature could do about it.
- **The renderer in our panel.** The interpreter view has not yet been drawn under the panel's content security policy and theme stylesheet. T-040's panel tests find policy violations, and the hand check in T-041 judges the look against the Book.
- **Test time.** Each interpreter run takes about a second. The end-to-end suite adds a handful of runs, not one per fixture.

## Test strategy

- **The probe (T-036)** is a script rather than a test, like spike 003's. Its captured outputs feed the unit and panel tests.
- **Unit tests** cover the rest without the toolchain:
  - `interpret.ts`: parsing `Ok` and `Err` outputs and the failure classification, from captured outputs and compiler messages.
  - `traceInput.ts`: the UTF-16 conversion on a non-ASCII line, and the step limit, including the success result and the note.
  - `page.ts`: the interpreter variant's attributes and escaping.
- **Panel tests in a real webview, from captured traces:** one panel shared with the permissions view, the step and marker counts, the limit's note, and no policy violations.
- **End-to-end tests against the development bundle** in `stackHeap.test.ts`: AC1, AC2, AC3, AC4, AC5 and AC10 (AC8). They skip when the bundle has no Miri library, unless the run is strict.
- **Packaging** (T-038): `check-vsix.mjs` verifies the library on every package (AC7).
- **By hand,** recorded in T-041's note: AC6, a first run with the network off on a fresh install; and AC9, the Book's chapter 4.1 example against the Book's own diagram, in a dark and a light theme.

## Appendix A: module responsibilities

| Module | Requirements | Decides | Tested by |
| --- | --- | --- | --- |
| `scratchCrate.ts` | R2 | Library form for permissions, binary form (`src/main.rs`, `[[bin]]`) for the interpreter | Unit |
| `toolchain.ts` | R3 | `<root>/miri-sysroot` present for the interpreter; `MIRI_SYSROOT` in the environment | Unit |
| `interpret.ts` | R2, R5 | Running `cargo aquascope interpreter`; parsing `{Ok: MTrace}` or `{Err}`; `cargo check` on failure; `noMain`, 003's compile classes, `programFailed`, `toolFailed` | Unit; end to end (AC3, AC4) |
| `traceInput.ts` | R4, R8, D6 | Whole-file code; UTF-16 positions; the step limit, success result and note | Unit |
| `page.ts`, `media/panel.js` | R4 | Interpreter attributes; report of drawn steps and markers | Unit; panel tests |
| `panel.ts` | R4, D5 | `showTrace`, title, the single shared panel | Panel tests; end to end |
| `extension.ts`, `package.json` | R1, D1 | The command and its palette entry | `contributes.test.ts`; end to end |
| `package-platform.sh`, `check-vsix.mjs`, `dev-bundle.mjs` | R3, R6, D2 | The library in the bundle and the VSIX; the size cap | Every packaging run (AC7) |

## Appendix B: acceptance criteria to tests

| Criterion | Test |
| --- | --- |
| AC1 | `stackHeap.test.ts`: fixture `01_move_string`; the report shows four steps and four markers. The returned trace's steps hold `s1`, then `s1` and `s2`, then no locals, with one heap location until the last step |
| AC2 | `stackHeap.test.ts`: fixture `05_method_mut_borrow`; some step's frames are `main` then `grow` |
| AC3 | `stackHeap.test.ts`: a file with no `main` returns `noMain`, and the panel shows its message |
| AC4 | `stackHeap.test.ts`: a panicking program returns `programFailed`; the output channel holds the interpreter's output |
| AC5 | `stackHeap.test.ts`: an unsaved inserted line changes the trace |
| AC6 | By hand, T-041: fresh install of the VSIX, network off, first run draws AC1's diagram |
| AC7 | `check-vsix.mjs` on every package; the size is recorded in T-038's note |
| AC8 | AC1 to AC5 and AC10 in `npm test` |
| AC9 | By hand, T-041: the Book's chapter 4.1 example, Dark Modern and Light Modern |
| AC10 | `stackHeap.test.ts`: a function called in a loop often enough for more than 100 steps; the report shows exactly 100 and the note. The limit itself is unit-tested in `traceInput.ts` |
| AC11 | `stackHeap.test.ts`: fixture `i4_use_after_free`; the report shows four steps, the last failed, and the note names a use after free |
