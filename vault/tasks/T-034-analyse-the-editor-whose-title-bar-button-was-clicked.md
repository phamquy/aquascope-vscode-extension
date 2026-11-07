---
id: T-034
title: "Analyse the editor whose title-bar button was clicked"
status: review
priority: medium
feature: "006-editor-title-button"
created: 2026-11-07
---

# T-034 Analyse the editor whose title-bar button was clicked

Spec: [[specs/features/006-editor-title-button/spec.md]]

## Done when

- [x] `aquascope.analyzeAtCursor` takes an optional URI and analyses that document's visible Rust editor at its cursor, whichever group has focus; with no URI it analyses the active editor as before (R3, R4)
- [x] When the document is open in several groups, the editor in the most recently focused of them is chosen, and the lowest view column when there is no record (D4)
- [x] Unit tests in `target.test.ts` cover one candidate, several with and without a record, and none
- [x] `titleButton.test.ts` covers AC2 with the panel focused, asserting first that there is no active text editor, and D4 with the file open in two groups
- [x] The existing tests pass unchanged (AC3), and `npm run typecheck && npm run lint && npm test` pass

## Notes

- Plan: [[specs/features/006-editor-title-button/plan.md]]. The choice of editor lives in `src/analysis/target.ts`; the focus record starts in `activate`.
- The AC2 test's assertion that `activeTextEditor` is `undefined` while the panel has focus settles a fact the spec's Why relies on. If it does not hold, record what VS Code does instead and correct the spec's Why; R3 holds either way.
- Done on 2026-11-07. The choice lives in `src/analysis/target.ts`: `chooseColumn` is the pure D4 rule, `editorFor` applies it to the visible editors, and `startFocusRecord` (started in `activate`) records each Rust document's last focused column. It is seeded with the editor that has focus at activation, so a first run from the title bar already knows that editor.
- Settled: the AC2 test asserts that `vscode.window.activeTextEditor` is `undefined` while the Aquascope panel has focus, and it passes, so the spec's Why stands as written.
- Beyond the plan: one more end-to-end test checks that a URI no visible editor shows gets `noRustEditor` and leaves the panel alone.
- `npm run typecheck && npm run lint && npm test`: 99 passing, none skipped (dev bundle present).
