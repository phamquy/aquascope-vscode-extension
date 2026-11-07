---
id: T-035
title: "Add the button to the editor title bar and close the feature"
status: done
priority: medium
feature: "006-editor-title-button"
created: 2026-11-07
---

# T-035 Add the button to the editor title bar and close the feature

Spec: [[specs/features/006-editor-title-button/spec.md]]

## Done when

- [x] The command has the `$(eye)` icon and an `editor/title` entry in the `navigation` group with `when: resourceLangId == rust`, checked by a test in `contributes.test.ts` (AC1; R1, R2, D2)
- [x] The README's Usage section describes the button and how to hide it with right-click "Hide" (AC5; R6, D3)
- [x] Hand check in the Extension Development Host, recorded below. The button shows beside Split Editor for a Rust file, not for a Markdown file and not above the Aquascope panel, and its tooltip names the command (AC4). Clicking it draws the diagram (AC4). With the panel focused, the button still shows above the Rust file and clicking it analyses that file. Right-click "Hide" removes it.
- [x] The spec's criteria are ticked, and feature 006 is `implemented` in the spec and in `specs/product.md`
- [x] `npm run typecheck && npm run lint && npm test` pass

## Notes

- Plan: [[specs/features/006-editor-title-button/plan.md]]. Depends on T-034, so that the button never ships without the change that makes it work while the panel has focus.
- The hand check also settles the VS Code facts listed in the plan's Appendix B.
- Done on 2026-11-07. `package.json` gives `aquascope.analyzeAtCursor` the `$(eye)` icon and an `editor/title` entry in the `navigation` group for `resourceLangId == rust`; the palette entry is unchanged (D1). `contributes.test.ts` checks both (AC1). The README's Usage section describes the button, says it analyses the file it sits above even while the panel has focus, and says how to hide it (AC5).
- Hand check, done by the user on 2026-11-07 in the Extension Development Host with `aquascope.toolchainPath` set to the dev bundle, on `05_method_mut_borrow.rs`, reported as passing in full. The eye button showed beside Split Editor with the command's name as its tooltip (AC4). Clicking it with the cursor in `main` drew the diagram (AC4). With the panel focused, the button still showed above the Rust file and a click analysed the function at that editor's cursor (R2, R3). There was no button above the panel or above a Markdown file (AC4). Right-click Hide removed it, and right-clicking the tab bar's buttons brought it back (D3). This also confirms the VS Code facts in the plan's Appendix B; the spec's Appendix A now says so.
- All five criteria ticked: AC1 in `contributes.test.ts`, AC2 in `titleButton.test.ts` (T-034), AC3 by the existing tests, AC4 by the hand check above, AC5 in the README. Spec 006 and its row in `specs/product.md` set to `implemented`.
- `npm run typecheck && npm run lint && npm test`: 100 passing, none skipped.
