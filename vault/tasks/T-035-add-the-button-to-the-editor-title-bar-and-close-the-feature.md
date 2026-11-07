---
id: T-035
title: "Add the button to the editor title bar and close the feature"
status: todo
priority: medium
feature: "006-editor-title-button"
created: 2026-11-07
---

# T-035 Add the button to the editor title bar and close the feature

Spec: [[specs/features/006-editor-title-button/spec.md]]

## Done when

- [ ] The command has the `$(eye)` icon and an `editor/title` entry in the `navigation` group with `when: resourceLangId == rust`, checked by a test in `contributes.test.ts` (AC1; R1, R2, D2)
- [ ] The README's Usage section describes the button and how to hide it with right-click "Hide" (AC5; R6, D3)
- [ ] Hand check in the Extension Development Host, recorded below. The button shows beside Split Editor for a Rust file, not for a Markdown file and not above the Aquascope panel, and its tooltip names the command (AC4). Clicking it draws the diagram (AC4). With the panel focused, the button still shows above the Rust file and clicking it analyses that file. Right-click "Hide" removes it.
- [ ] The spec's criteria are ticked, and feature 006 is `implemented` in the spec and in `specs/product.md`
- [ ] `npm run typecheck && npm run lint && npm test` pass

## Notes

- Plan: [[specs/features/006-editor-title-button/plan.md]]. Depends on T-034, so that the button never ships without the change that makes it work while the panel has focus.
- The hand check also settles the VS Code facts listed in the plan's Appendix B.
