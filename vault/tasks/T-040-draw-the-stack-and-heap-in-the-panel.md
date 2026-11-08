---
id: T-040
title: "Draw the stack and heap in the panel"
status: review
priority: medium
feature: "007-stack-heap-diagrams"
created: 2026-11-08
---

# T-040 Draw the stack and heap in the panel

Spec: [[specs/features/007-stack-heap-diagrams/spec.md]]

## Done when

- [x] The trace is shaped for the embed with UTF-16 positions and D6's limit of 100 steps, success result and note, and a note naming undefined behaviour
- [x] The page's interpreter variant and `showTrace` draw it in the single panel titled "Aquascope: stack and heap"
- [x] The report counts drawn steps and markers
- [x] Panel tests from captured traces show the counts, the note and no policy violations
- [x] The command shows its result and errors in the panel (R4, R8, D5, D6)
- [x] `npm run typecheck && npm run lint && npm test` pass (see Notes: two feature 006 tests need the test window to have OS focus)

## Notes

- Plan: [[specs/features/007-stack-heap-diagrams/plan.md]]. Depends on T-036's captured traces and T-039's command.
- Done on 2026-11-08. `src/visualization/traceInput.ts` shapes the trace: the whole file as the code, every position converted to UTF-16 with 003's conversion (moved from `select.ts` to `positions.ts` as `convertColumnsToUtf16`), at most `STEP_LIMIT` (100) steps with the result set to success and a note when cut, and a note naming undefined behaviour otherwise. The panel title is "Aquascope: stack and heap".
- `page.ts` has a `trace` variant: the notes as paragraphs above an embed with `data-operations` `["interpreter"]`, the trace as the `interpreter` response, the renderer's default configuration, and `data-steps`. `panel.ts` has `showTrace`, sharing the single panel (D5). `media/panel.js` reports a `trace` with the memory diagrams (`.interpreter .step`), the step markers in the code (`.cm-editor .step-marker`), the failed markers (`.step-header .step-marker.fail`) and the notes; the wait-until-drawn logic is shared with the permissions report. The class names were checked in the vendored build. `media/panel.css` styles the notes.
- The command draws a trace in the panel, and its errors replace the diagram in an open panel as the permissions view's do (not for `noRustEditor` or `cancelled`); the interim notification from T-039 is gone.
- Tests: `traceInput.test.ts` (whole code, UTF-16 on `n1_non_ascii`, undefined behaviour, the limit with and without an error result); `page.test.ts` (the trace page's attributes, escaped notes); `panel.test.ts` draws captured traces in a real webview: 4 diagrams and 4 markers for `01`, 11 for `05`, 5 for `n1`, 1 failed marker and the note for `i4`, exactly 100 and the note for a 150-step trace, no policy violation or script error; `interpret.test.ts` checks the command's trace and `noMain` message in the extension's panel.
- Tests run: 126 passing, but two of feature 006's `titleButton.test.ts` tests (T-034) failed in most runs. Investigated with instrumentation: they fail exactly when the test VS Code window does not have OS focus (`vscode.window.state.focused` was `false` in every failing run): VS Code then moves the active editor group but does not update `activeTextEditor`, which those tests wait on. In a run where the window had focus, the whole suite passed, 128 of 128, with every focus change immediate. So the failures depend on what is in front on the machine during the run, not on this change; making those tests independent of OS focus is a separate fix.
