---
id: 006-editor-title-button
title: Analyze from a button in the editor title bar
status: implemented
---

# Analyze from a button in the editor title bar

## Why

The only way to run the analysis today is to open the Command Palette and type "Aquascope: Analyze Function at Cursor". Feature 003 made the command the only trigger on purpose (its D2), so the analysis could ship before anyone decided how people should reach it. For a learner who reruns the analysis after every small edit, that means several keystrokes and a remembered name each time. Nothing in the editor tells a new user the extension is there at all.

This feature adds a button for the same command to the editor title bar. That is the strip at the right end of the tab row, where VS Code shows Split Editor. The button appears only while the editor shows a Rust file. Clicking it does what the command does today: it analyses the function at that editor's cursor and shows the result in the Aquascope panel beside it. VS Code draws such a button from the extension's manifest without starting the extension. The extension therefore still activates only when someone runs the analysis (constitution 3).

For the button to be reliable, one behaviour of the current command has to change. The command analyses whatever VS Code reports as the active text editor. VS Code reports none while a webview such as the Aquascope panel has focus, which is common once a learner has clicked into the diagram. From that state, clicking the button above the Rust file would answer "Open a Rust file" instead of analysing the file the button sits above. The button must therefore analyse the editor it belongs to, whichever group has focus. Appendix A gives the current code path and the VS Code behaviour this spec relies on.

## Decisions

Recorded 2026-11-06 when the draft was approved. Each one takes the recommendation given for the open question it settles.

- D1 (was Q1): The command stays in the Command Palette, and the button is an additional way to run it.
- D2 (was Q2): The button uses a built-in VS Code codicon, so it follows the user's theme and needs no assets; the plan picks which one.
- D3 (was Q3): The button has no setting of its own. Users hide it with VS Code's own "Hide" in the title bar's right-click menu, and the README says so.
- D4 (was Q4): If VS Code does not say which group's button was clicked, and the file is open in more than one group, the analysis uses that file's editor in the group that was focused most recently.

## User stories

- As a Rust learner, I want a button above my Rust file that runs the analysis, so that I can see the diagram without opening the Command Palette or remembering the command's name.
- As a learner reading the diagram in the Aquascope panel, I want to click the button above my Rust file and get the analysis for that file, so that I do not have to click back into the editor first.
- As someone editing a file that is not Rust, I want no Aquascope button in my title bar, so that the extension stays out of the way.

## Requirements

- R1: The extension contributes `aquascope.analyzeAtCursor` to the editor title bar (`menus.editor/title`) in the `navigation` group. It therefore shows as an icon beside Split Editor, not in the "…" overflow menu. The command gets an icon for this, and its existing title, "Aquascope: Analyze Function at Cursor", serves as the button's tooltip.
- R2: The button shows only in the title bar of an editor group whose active editor is a Rust file. It does not show above the Aquascope panel or above any other kind of editor.
- R3: Clicking the button analyses the Rust file in that group's editor, at that editor's cursor and including unsaved changes, exactly as the command does (feature 003, R2 and R7). This holds even when another group, such as the Aquascope panel, has focus. The result updates the Aquascope panel the same way a run from the Command Palette does (feature 004).
- R4: Running the command from the Command Palette or from a keybinding behaves as it does today: it analyses the active Rust editor and reports when there is none.
- R5: Showing the button does not activate the extension; only clicking it does (constitution 3).
- R6: The README's Usage section describes the button and how to hide it with VS Code's own "Hide" (constitution 4, D3).

## Acceptance criteria

- [x] AC1: The manifest contributes the command to `editor/title` in the `navigation` group, with a `when` clause that limits it to Rust files, and the command declares an icon. An integration test checks this.
- [x] AC2: With a Rust fixture open and the Aquascope panel focused, invoking the command the way the title bar does, with that editor's URI as its argument, analyses the fixture at its cursor and shows the result in the panel. An integration test checks this.
- [x] AC3: Invoking the command with no argument still analyses the active Rust editor, and still reports `noRustEditor` when there is none. The existing tests keep passing.
- [x] AC4: A hand check in the Extension Development Host, recorded in the task note, confirms four things. The button appears beside Split Editor for a Rust file. It does not appear for a Markdown file or above the Aquascope panel. Its tooltip names the command. Clicking it draws the diagram.
- [x] AC5: The README describes the button and how to hide it.

## Out of scope

- Removing the command from the Command Palette (D1).
- Other triggers: the editor's right-click menu, CodeLens above functions, a status bar item, a default keybinding, or running on save.
- Changing the button while an analysis runs, for example a spinner or disabling it. The progress notification already shows the run, and a second click cancels the first run and starts a new one, as a second run of the command does today.

## Open questions

None. Q1 to Q4 were settled when the draft was approved and are recorded as D1 to D4.

## Appendix A: Current behaviour and VS Code facts this spec relies on

The VS Code rows came from VS Code's documentation and have since been confirmed in this repository: the `activeTextEditor` row by T-034's AC2 test, and the others by T-035's hand check, in which the button showed before the extension had run and a click with the panel focused drew the diagram.

| Fact | Source |
| --- | --- |
| The command reads `vscode.window.activeTextEditor` and returns `noRustEditor` when it is missing or not Rust | `src/analysis/command.ts:20-23` |
| The palette entry is limited by `editorLangId == rust`; there is no `editor/title` contribution and the command has no icon | `package.json` `contributes`; `src/test/suite/contributes.test.ts` |
| A new run cancels the run in progress | `src/analysis/command.ts:17`, `:41-43` |
| Items in the `editor/title` menu's `navigation` group show as icons in the title bar; items in other groups go to the "…" overflow menu | VS Code docs, contribution points, `menus` (confirmed by T-035's hand check) |
| A command run from `editor/title` receives the URI of that group's active editor as its first argument | VS Code docs, contribution points, `menus` (confirmed by T-035's hand check) |
| `window.activeTextEditor` is `undefined` while a webview panel has focus | VS Code API behaviour (confirmed by T-034's AC2 test) |
| In a title bar, `resourceLangId` is evaluated for that group's editor, whereas `editorLangId` follows the focused text editor, so the palette's `when` clause would hide the button while the panel has focus | VS Code docs, when clause contexts (confirmed by T-035's hand check) |
| Menu items are drawn from the manifest without activating the extension; on VS Code 1.74 and later, running a contributed command activates it | VS Code docs, activation events (confirmed by T-035's hand check) |
