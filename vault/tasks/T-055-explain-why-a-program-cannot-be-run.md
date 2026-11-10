---
id: T-055
title: "Explain why a program cannot be run"
status: done
priority: medium
feature: "009-whole-crate-stack-heap"
created: 2026-11-09
---

# T-055 Explain why a program cannot be run

Spec: [[specs/features/009-whole-crate-stack-heap/spec.md]]

## Done when

- [x] A crate run's build failures get feature 008's `dependencyMissing`, `linkerMissing` and `compileErrors` with files and lines
- [x] `programFailed` names the arguments the program was given, or says there were none
- [x] Failures to build or start the crate run offer Run This File Alone, which runs feature 007's single-file run, while a cancel, a program that stopped and a file with no steps do not
- [x] Unit tests cover the messages
- [x] End-to-end tests for AC3 and AC7 pass

## Notes

- Plan: [[specs/features/009-whole-crate-stack-heap/plan.md]].
- Done on 2026-11-09. `errors.ts`: `programCompileErrors` words compile errors for running a program, with feature 008's files and lines, shared through `errorPlaces`; `programStopped` names the arguments as typed after `cargo run --`, quoting where a shell would need it, or says there were none, and adds the reason the fork wrote to stderr, such as "the evaluated program completed with exit code 1". Missing dependencies and linkers keep feature 008's messages.
- `command.ts`: `offerRunAlone` marks every crate-path error but `cancelled`, `programFailed` and `noStepsInFile`, including `noBinary`, a build script and an unreadable manifest; the notification's Run This File Alone opens the file again, since the active editor may have changed, and runs the command with `{ alone: true }`, feature 007's run.
- Tests: three in `errors.test.ts`; AC3, AC7 and D6 in `stackHeapCrate.test.ts`. AC7 drives the real input box: after a run that remembers `frog poem.txt`, a run without arguments asks, and `workbench.action.acceptSelectedQuickOpenItem` accepts the box as filled, so minigrep succeeds. `npm test`: 214 of 216 passing, about two minutes; the two failures were feature 006's AC2 and D4, issue #37.
