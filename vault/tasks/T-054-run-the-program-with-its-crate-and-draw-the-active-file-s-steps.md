---
id: T-054
title: "Run the program with its crate and draw the active file's steps"
status: review
priority: medium
feature: "009-whole-crate-stack-heap"
created: 2026-11-09
---

# T-054 Run the program with its crate and draw the active file's steps

Spec: [[specs/features/009-whole-crate-stack-heap/spec.md]]

## Done when

- [x] A file in a package with a binary runs that program in feature 008's copy with the fork's one-crate build, arguments and file access, from the copy of the workspace root, in its own build folder
- [x] The first run per project builds with no timeout, its own progress title and cancel
- [x] A one-crate build that fails to compile where the binary alone compiles is repeated with the binary alone
- [x] `traceInput.ts` keeps the steps whose current frame is in the active file, places other files' frames at the start of the file, and applies feature 007's limit to the kept steps
- [x] A file with no step gets `noStepsInFile` naming the files with steps
- [x] Files outside a package keep feature 007's run
- [x] End-to-end tests for AC1, AC2, AC4, AC5 and AC8 pass against the development bundle

## Notes

- Plan: [[specs/features/009-whole-crate-stack-heap/plan.md]].
- Done on 2026-11-09. `command.ts`: Show Stack and Heap locates the file's crate with feature 008's lookup, asks T-053's questions before the run starts, so the progress notification is not under them, then runs `interpretCrate`; a file in no package, or `{ alone: true }`, keeps feature 007's run. The command takes `{ binary, arguments, alone }`, which `extension.ts` checks.
- `interpret.ts`: `interpretCrate` syncs the copy, runs `cargo aquascope --crate-of <library> interpreter --disable-isolation --bin-file <binary> -- <args>` in the copy of the workspace root with `MIRI_SYSROOT` and `CARGO_TARGET_DIR=<project>/target-interpreter`; the first run on a project has no timeout and its own progress message, and a mark `interpreter-built` records a run that exited 0. When the one-crate build exits non-zero and `cargo check --bin` of the binary passes, the binary runs alone. `stepsInFile` keeps the active file's steps and counts every file; `withoutBinModule` drops `__aquascope_main::` from frame names; `noStepsInFile` names the files with steps. The ok result carries `file`.
- `traceInput.ts`: with `file`, frames of other files get the position 0:0 before the columns are converted, keeping their names and locals; the panel passes the file through.
- Failures use what exists until T-055: feature 008's `crateBuildFailure` and `crateCompileErrors`, whose message still speaks of "the function at the cursor", and feature 007's `programFailed`. A build script gets feature 008's `unsupportedTarget`.
- Fixtures: `projects/minigrep-book/` (chapter 12, with `poem.txt` and `tests/search.rs` for AC8) and `projects/with-dep/src/main.rs`. Tests: `crateTrace.test.ts` (9, from T-051's capture) and AC1, AC2, AC4, AC5 and AC8 in `stackHeapCrate.test.ts`, with the fixture projects unchanged at the end. `npm test`: 210 passing, about a minute; each minigrep run takes about 9 seconds.
