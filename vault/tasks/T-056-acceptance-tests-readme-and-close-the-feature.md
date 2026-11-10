---
id: T-056
title: "Acceptance tests, README and close the feature"
status: review
priority: medium
feature: "009-whole-crate-stack-heap"
created: 2026-11-09
---

# T-056 Acceptance tests, README and close the feature

Spec: [[specs/features/009-whole-crate-stack-heap/spec.md]]

## Done when

- [x] `stackHeapCrate.test.ts` passes AC1 to AC5 and AC7 to AC9, and feature 007's suite passes unchanged for AC6, in `npm test`
- [x] The README describes Show Stack and Heap on a crate, the arguments, file access, the hidden steps of other crates, the one-crate build's limits and string literals drawn with the heap
- [x] The spec's criteria are ticked and feature 009 is `implemented` in the spec and `specs/product.md`

## Notes

- Plan: [[specs/features/009-whole-crate-stack-heap/plan.md]].
- Done on 2026-11-09. `stackHeapCrate.test.ts` gains AC9 for a file of a package: `with-dep`'s binary now holds `let title = "labels:";`, which is drawn as a pointer into the heap holding those characters. With T-052 to T-055's tests, it covers AC1 to AC5 and AC7 to AC9, and feature 007's test files are unchanged since spec 009 was merged, for AC6.
- README: the Show Stack and Heap section now describes running a file of a package with its crate, the arguments box, the binary pick, file access from the workspace folder in the copy, the active file's steps with the whole stack, Run This File Alone, and the limits: other crates' steps not drawn, the `crate::` fallback, string literals drawn in the heap, and the first build and about ten seconds per run. The packaging and installing paragraphs mention the interpreter's fork changes and its use of the cargo cache. `contributes.test.ts` checks the README for feature 009.
- The spec's AC1 to AC9 are ticked, and feature 009 is `implemented` in the spec and `specs/product.md`. `npm test`: 218 passing, none failing, about two minutes.
