---
id: T-040
title: "Draw the stack and heap in the panel"
status: todo
priority: medium
feature: "007-stack-heap-diagrams"
created: 2026-11-08
---

# T-040 Draw the stack and heap in the panel

Spec: [[specs/features/007-stack-heap-diagrams/spec.md]]

## Done when

- [ ] The trace is shaped for the embed with UTF-16 positions and D6's limit of 100 steps, success result and note, and a note naming undefined behaviour
- [ ] The page's interpreter variant and `showTrace` draw it in the single panel titled "Aquascope: stack and heap"
- [ ] The report counts drawn steps and markers
- [ ] Panel tests from captured traces show the counts, the note and no policy violations
- [ ] The command shows its result and errors in the panel (R4, R8, D5, D6)
- [ ] `npm run typecheck && npm run lint && npm test` pass

## Notes

- Plan: [[specs/features/007-stack-heap-diagrams/plan.md]]. Depends on T-036's captured traces and T-039's command.
