---
id: T-039
title: "Run the interpreter from a Show Stack and Heap command"
status: todo
priority: medium
feature: "007-stack-heap-diagrams"
created: 2026-11-08
---

# T-039 Run the interpreter from a Show Stack and Heap command

Spec: [[specs/features/007-stack-heap-diagrams/spec.md]]

## Done when

- [ ] `aquascope.showStackAndHeap` is in the palette for Rust files
- [ ] It runs the interpreter on the active editor's text as a binary crate with `MIRI_SYSROOT` set, reporting a missing library like a missing tool
- [ ] Failures are classified as `noMain`, 003's compile classes, `programFailed` or `toolFailed`
- [ ] Unit tests cover parsing and classification from captured data
- [ ] `contributes.test.ts` covers the command
- [ ] Interpreter tests skip without a Miri library unless strict (R1, R2, R3, R5)
- [ ] `npm run typecheck && npm run lint && npm test` pass

## Notes

- Plan: [[specs/features/007-stack-heap-diagrams/plan.md]]. Depends on T-038 for the development copy of the library. Shares 003's single in-flight run, so either view's new run cancels the other.
