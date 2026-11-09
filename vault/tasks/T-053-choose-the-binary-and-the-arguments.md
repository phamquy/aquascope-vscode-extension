---
id: T-053
title: "Choose the binary and the arguments"
status: todo
priority: medium
feature: "009-whole-crate-stack-heap"
created: 2026-11-09
---

# T-053 Choose the binary and the arguments

Spec: [[specs/features/009-whole-crate-stack-heap/spec.md]]

## Done when

- [ ] `project.ts` reads the package's binaries and library root from the metadata
- [ ] `program.ts` chooses the active file's binary, the only binary, or the one picked from a quick pick and remembered for the project, and gives `noBinary` for a package without one
- [ ] It asks for the arguments in an input box filled with the project's last arguments, where Escape cancels and an unclosed quote is pointed out, splits them as a shell does and saves them
- [ ] Unit tests cover these, including AC7's offer

## Notes

- Plan: [[specs/features/009-whole-crate-stack-heap/plan.md]].
