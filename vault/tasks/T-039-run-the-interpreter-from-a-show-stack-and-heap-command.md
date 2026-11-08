---
id: T-039
title: "Run the interpreter from a Show Stack and Heap command"
status: done
priority: medium
feature: "007-stack-heap-diagrams"
created: 2026-11-08
---

# T-039 Run the interpreter from a Show Stack and Heap command

Spec: [[specs/features/007-stack-heap-diagrams/spec.md]]

## Done when

- [x] `aquascope.showStackAndHeap` is in the palette for Rust files
- [x] It runs the interpreter on the active editor's text as a binary crate with `MIRI_SYSROOT` set, reporting a missing library like a missing tool
- [x] Failures are classified as `noMain`, 003's compile classes, `programFailed` or `toolFailed`
- [x] Unit tests cover parsing and classification from captured data
- [x] `contributes.test.ts` covers the command
- [x] Interpreter tests skip without a Miri library unless strict (R1, R2, R3, R5)
- [x] `npm run typecheck && npm run lint && npm test` pass

## Notes

- Plan: [[specs/features/007-stack-heap-diagrams/plan.md]]. Depends on T-038 for the development copy of the library. Shares 003's single in-flight run, so either view's new run cancels the other.
- Done on 2026-11-08. `aquascope.showStackAndHeap` ("Aquascope: Show Stack and Heap") is declared with a palette entry for `editorLangId == rust` and no title-bar entry (D1), registered in `activate`.
- `src/analysis/interpret.ts` writes the editor's text as `src/main.rs` of a binary crate (`writeCrate`'s new `form: 'bin'`), runs `cargo aquascope interpreter` with `MIRI_SYSROOT` added through `runEnvironment`'s new `extra` argument, and parses the one JSON object it prints. Without a trace it runs `cargo check` (003 D6) and classifies: E0601 is `noMain`; 003's single-file limit stays `singleFileLimit`; other compile errors, borrow errors included, are `compileErrors` with a message about running the program; no errors with exit 0 is `programFailed`; anything else `toolFailed`. Timeouts and cancellation use 003's `runFailure`.
- `resolveMiriSysroot` in `toolchain.ts` requires `<root>/miri-sysroot/lib/rustlib` and reports its absence as `toolNotFound`, naming the setting when the root came from it.
- `command.ts`: the single in-flight run and the timeout setting are now shared helpers (`runExclusive`, `timeoutSeconds`), so a run of either command cancels the other. Until T-040 draws traces, a trace is summarised in a notification ("the program ran in N steps") and failures are notifications, with Show Output for those whose details are in the output channel.
- Tests: `interpret.test.ts` reads the captured traces and classifies the captured `cargo check` output, and runs the command end to end on `01_move_string` (4 steps), `i6_no_main` (`noMain`), `i1_panic` (`programFailed`) and `04_push_while_borrowed_fail` (`compileErrors`). `harness.ts`'s `requireMiri` skips those without a Miri library, and fails a strict run instead. `contributes.test.ts`, `scratchCrate.test.ts`, `toolchain.test.ts` and `harness.test.ts` cover the rest.
- `npm run typecheck && npm run lint && npm test`: 117 passing, none pending, the end-to-end interpreter tests run against the development bundle.
