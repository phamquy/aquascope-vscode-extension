---
id: T-059
title: "Make the title-button run independent of OS focus"
status: done
priority: medium
feature: "006-editor-title-button"
created: 2026-11-13
---

# T-059 Make the title-button run independent of OS focus

Spec: [[specs/features/006-editor-title-button/spec.md]]

## Done when

- [x] The record of which group was focused last follows the active tab group as well as the active text editor, so feature 006 D4 holds whether or not the window has OS focus
- [x] `titleButton.test.ts` waits on the active tab group, not `activeTextEditor`; AC2 and D4 pass with another application in front, and D4 fails there without the record change
- [x] `npm run typecheck && npm run lint && npm test` pass

## Notes

- Issue #37. Reproduced by starting the tests and keeping Finder in front (`osascript -e 'tell application "Finder" to activate'` every 2 s). With the window unfocused VS Code updates `tabGroups.activeTabGroup` on every focus command, but `activeTextEditor` and `onDidChangeActiveTextEditor` only when the window has OS focus; `showTextDocument` of a document already open in another group does not update them either.
- That is also why a test-only change was not enough: `target.ts` recorded the last-focused column from `onDidChangeActiveTextEditor`, so D4 saw a stale column. `startFocusRecord` now also records from `onDidChangeTabGroups` and `onDidChangeTabs`. With the window focused nothing changes, since both report the same group.
- AC2 no longer asserts that `activeTextEditor` is undefined unless the window is focused; it still runs the command with the URI while the panel's group is active.
- Not done: feature 003 AC5 (`Illegal argument: TextEditor`) did not fail in two runs with the window unfocused, so its cause is still unknown and #37 stays open for it.
- `npm test`: 222 passing, with Finder kept in front for the whole run and without; typecheck and lint pass.
