---
id: T-055
title: "Explain why a program cannot be run"
status: todo
priority: medium
feature: "009-whole-crate-stack-heap"
created: 2026-11-09
---

# T-055 Explain why a program cannot be run

Spec: [[specs/features/009-whole-crate-stack-heap/spec.md]]

## Done when

- [ ] A crate run's build failures get feature 008's `dependencyMissing`, `linkerMissing` and `compileErrors` with files and lines
- [ ] `programFailed` names the arguments the program was given, or says there were none
- [ ] Failures to build or start the crate run offer Run This File Alone, which runs feature 007's single-file run, while a cancel, a program that stopped and a file with no steps do not
- [ ] Unit tests cover the messages
- [ ] End-to-end tests for AC3 and AC7 pass

## Notes

- Plan: [[specs/features/009-whole-crate-stack-heap/plan.md]].
