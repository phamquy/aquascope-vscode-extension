---
id: T-053
title: "Choose the binary and the arguments"
status: review
priority: medium
feature: "009-whole-crate-stack-heap"
created: 2026-11-09
---

# T-053 Choose the binary and the arguments

Spec: [[specs/features/009-whole-crate-stack-heap/spec.md]]

## Done when

- [x] `project.ts` reads the package's binaries and library root from the metadata
- [x] `program.ts` chooses the active file's binary, the only binary, or the one picked from a quick pick and remembered for the project, and gives `noBinary` for a package without one
- [x] It asks for the arguments in an input box filled with the project's last arguments, where Escape cancels and an unclosed quote is pointed out, splits them as a shell does and saves them
- [x] Unit tests cover these, including AC7's offer

## Notes

- Plan: [[specs/features/009-whole-crate-stack-heap/plan.md]].
- Done on 2026-11-09. `project.ts`: `CrateInProject` gains `binaries` (name and root file relative to the workspace root, as `--bin-file` takes it) and `libraryRoot` (a `lib` or `rlib` target; a proc macro is not one). `program.ts` (new): `binaryFor`, `splitArguments`, `quoteArguments` and `chooseProgram`, which takes the store and the dialogs as parameters; `vscodeDialogs` holds the quick pick and the input box, which T-054 wires into the command. `errors.ts`: `noBinary`, a new code in `types.ts`.
- Two readings of D1 and D2. The quick pick is shown on every run of a package with several binaries, with the last one run first and marked "Run last time", so Enter repeats the last run as in the input box and another binary can still be chosen; it is not skipped once remembered. The arguments are remembered per binary of a package of a project, since two binaries rarely take the same arguments, as the text typed, so the box shows quotes as they were given.
- `program.test.ts`: 19 tests from T-051's captured metadata, with the store and the dialogs replaced, including AC7's offer. `project.test.ts`'s whole-object expectation gains the two fields. `npm test`: 195 passing.
