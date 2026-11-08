---
id: T-041
title: "Acceptance tests, README and close the feature"
status: review
priority: medium
feature: "007-stack-heap-diagrams"
created: 2026-11-08
---

# T-041 Acceptance tests, README and close the feature

Spec: [[specs/features/007-stack-heap-diagrams/spec.md]]

## Done when

- [x] `stackHeap.test.ts` passes AC1 to AC5, AC10 and AC11 in `npm test`
- [x] The README describes the command and its limits
- [x] AC6 and AC9 are checked by hand and recorded
- [x] The spec's criteria are ticked and feature 007 is `implemented` in the spec and `specs/product.md` (R7, AC8)
- [x] `npm run typecheck && npm run lint && npm test` pass

## Notes

- Plan: [[specs/features/007-stack-heap-diagrams/plan.md]]. Last task of the feature. The hand checks need the user: AC6 on a fresh install with the network off, AC9 against the Book's chapter 4.1 diagram.
- Done on 2026-11-08. `src/test/suite/stackHeap.test.ts` runs Show Stack and Heap end to end against a bundle with the Miri library and checks the command's result, the panel's report and the output channel: AC1 (`01_move_string`: four diagrams and markers; `s1`, then `s1` and `s2`, then nothing; one heap value until the last step), AC2 (`05`: a step with `main` then `Rect::grow`), AC3 (`i6_no_main`: `noMain`, no compiler error text, the message in the open panel), AC4 (`i1_panic`: `programFailed`, and the log holds the interpreter's output), AC5 (an unsaved `let extra = 7;` gives a fifth step with `extra`), AC10 (new fixture `i10_calls_in_loop`, 154 steps: exactly 100 drawn and the note) and AC11 (`i4_use_after_free`: four steps, one failed marker, the note).
- For AC4 the output channel keeps its last 500 lines in memory (`runner.ts`), exposed as `recentOutput` on the extension's test API, since a channel's text cannot be read through VS Code.
- The README's Usage section describes the command and its limits (R7), and the Installing section mentions the Miri library; `contributes.test.ts` checks the README names the command and its limits.
- `npm run package` on this branch: the strict test run passed 136 of 136 against the packaged bundle; `check-vsix: ok`, 186.5 MB, `aquascope-vscode-extension-darwin-arm64-0.0.1.vsix`, SHA-256 `42bb4b69b9985bc27493ecc96a67a6953c68da9765bfea147778b4c78d6f0e6e` (AC7, with T-038's note).
- Hand checks, done by the user on 2026-11-08 with that VSIX and reported as passing. AC6: installed in a new profile, so `aquascope.toolchainPath` was empty, with the network off; Show Stack and Heap on `01_move_string.rs` drew its four steps. AC9: the panel for the same `String` move compared with the Book's chapter 4.1 diagram (https://rust-book.cs.brown.edu/ch04-01-what-is-ownership.html), in Dark Modern and Light Modern.
- All eleven criteria ticked: AC1 to AC5, AC10 and AC11 in `stackHeap.test.ts` (AC8); AC6 and AC9 by hand above; AC7 by `check-vsix.mjs` on every package. Spec 007 and its row in `specs/product.md` set to `implemented`.
- `npm run typecheck && npm run lint && npm test`: 136 passing.
