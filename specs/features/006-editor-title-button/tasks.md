---
feature: 006-editor-title-button
---

# Tasks

Each line maps to a note in `vault/tasks/`. Status lives in the note, not here.

- [ ] T-034 Analyse the editor whose title-bar button was clicked (done when: the command takes an optional URI and analyses that document's visible Rust editor at its cursor, whichever group has focus, choosing by D4 when the document is open in several groups; unit tests cover the choice; end-to-end tests cover AC2 with the panel focused, asserting there is no active text editor first, and D4 with the file open in two groups; the existing tests pass unchanged for AC3; R3, R4, D4)
- [ ] T-035 Add the button to the editor title bar and close the feature (done when: the command has the `$(eye)` icon and an `editor/title` entry in the `navigation` group for `resourceLangId == rust`, checked by a test in `contributes.test.ts` (AC1); the README describes the button and how to hide it (AC5); the hand check is recorded in the note: AC4, the button still showing while the panel has focus, and right-click "Hide"; the spec's criteria are ticked and feature 006 is `implemented` in the spec and `specs/product.md`; R1, R2, R5, R6, D2, D3)

T-034 comes first, so that the button never exists on `main` without the change that makes it work while the panel has focus.
