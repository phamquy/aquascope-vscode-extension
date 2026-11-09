---
id: T-054
title: "Run the program with its crate and draw the active file's steps"
status: todo
priority: medium
feature: "009-whole-crate-stack-heap"
created: 2026-11-09
---

# T-054 Run the program with its crate and draw the active file's steps

Spec: [[specs/features/009-whole-crate-stack-heap/spec.md]]

## Done when

- [ ] A file in a package with a binary runs that program in feature 008's copy with the fork's one-crate build, arguments and file access, from the copy of the workspace root, in its own build folder
- [ ] The first run per project builds with no timeout, its own progress title and cancel
- [ ] A one-crate build that fails to compile where the binary alone compiles is repeated with the binary alone
- [ ] `traceInput.ts` keeps the steps whose current frame is in the active file, places other files' frames at the start of the file, and applies feature 007's limit to the kept steps
- [ ] A file with no step gets `noStepsInFile` naming the files with steps
- [ ] Files outside a package keep feature 007's run
- [ ] End-to-end tests for AC1, AC2, AC4, AC5 and AC8 pass against the development bundle

## Notes

- Plan: [[specs/features/009-whole-crate-stack-heap/plan.md]].
