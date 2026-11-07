---
feature: 006-editor-title-button
---

# Plan

## Approach

The feature has two parts. The first teaches the command which editor to analyse; the second adds the button. They are built in that order. If the button shipped first, `main` would hold a button that answers "Open a Rust file" whenever the Aquascope panel has focus.

**Which editor to analyse.** When VS Code runs a command from the editor title bar, it passes the URI of that group's active editor as the first argument. A run from the Command Palette or a keybinding passes nothing. The command therefore gains one optional parameter. When the argument is a `vscode.Uri`, the command looks for the visible text editors showing that document and analyses one of them. Any other argument, or none, keeps today's behaviour of analysing `window.activeTextEditor` (R4). Everything after choosing the editor is unchanged: the same text and cursor capture, the same run, and the same panel update (R3). A URI whose document is not open in a visible Rust editor gets the existing `noRustEditor` error, which cannot happen from the button but keeps the parameter safe for other callers.

**When the file is open in more than one group.** Usually exactly one visible editor shows the file, and the choice is trivial. When several do, the public API offers nothing that maps a title-bar click to an editor group, so D4 applies: the editor in the group that was focused most recently wins. The extension learns that order from `window.onDidChangeActiveTextEditor`, recording each Rust document's last focused view column. It starts this listener in `activate`, which costs one subscription and keeps activation fast (constitution 3). The record exists only from activation onwards. That covers the case that matters: the panel is the usual reason a webview holds focus, and the panel exists only after a run, by which time the extension is active. With no record, the lowest view column wins, so the result is still deterministic. The choice itself is a small pure function over the candidates' view columns and the record, so it can be tested without arranging editor groups. Appendix A gives each module's job.

**The button.** The command gets the codicon `$(eye)` (D2) and an entry in `menus.editor/title` in the `navigation` group, which VS Code draws as an icon beside Split Editor (R1). The `when` clause is `resourceLangId == rust`, not the palette's `editorLangId == rust`. A title bar's context is its own group's, and `resourceLangId` names the language of that group's active editor; `editorLangId` follows the focused text editor and would hide the button while the panel has focus (R2). VS Code draws the entry from the manifest without starting the extension; the existing palette entry already works this way with an empty `activationEvents` (R5). The README's Usage section describes the button and says how to hide it (R6, D3).

Some of the VS Code behaviour above comes from its documentation rather than from this repository. The plan settles each fact inside a task: by a test assertion where one is possible, otherwise in the hand check. Appendix B says which fact is settled where. If a fact turns out otherwise, the design still holds. For example, if VS Code kept the Rust editor as the active text editor while the panel has focus, the URI path would simply agree with it.

## VS Code APIs and contribution points

- `contributes.commands`: `"icon": "$(eye)"` on `aquascope.analyzeAtCursor`.
- `contributes.menus.editor/title`: `{ "command": "aquascope.analyzeAtCursor", "when": "resourceLangId == rust", "group": "navigation" }`.
- `vscode.window.visibleTextEditors`, `TextEditor.viewColumn`, `TextEditor.document.uri`.
- `vscode.window.onDidChangeActiveTextEditor`, to record the last focused column per document (D4).
- `vscode.window.activeTextEditor`, unchanged for runs without an argument.

## Files touched

- `package.json`: the icon and the `editor/title` entry.
- `src/analysis/target.ts` (new): the focus record and the choice of editor for a URI (D4).
- `src/analysis/command.ts`: `analyzeAtCursor` takes an optional URI and uses `target.ts` to choose the editor.
- `src/extension.ts`: passes the command's first argument through and starts the focus record.
- `src/test/suite/target.test.ts` (new): unit tests for the choice.
- `src/test/suite/titleButton.test.ts` (new): the end-to-end tests for AC2 and D4.
- `src/test/suite/contributes.test.ts`: AC1.
- `README.md`: the button and how to hide it.
- `specs/features/006-editor-title-button/spec.md` and `specs/product.md`: criteria ticked and status `implemented` at the end.

## Risks

- **Focus in tests.** AC2 needs the panel to hold focus. The tests focus the panel's editor group with `workbench.action.focusSecondEditorGroup` (or the third, when the file is open twice) and assert that `activeTextEditor` is `undefined` before running. That assertion is also what settles the fact the spec's Why relies on. If it fails because VS Code behaves otherwise, the test records the actual behaviour and the spec's Why is corrected; R3 still holds.
- **The button in an unfocused group.** The `resourceLangId` choice rests on VS Code's documentation of when-clause contexts. Only the hand check can see the title bar, so it includes clicking into the panel and confirming that the button still shows above the Rust file.
- **The focus record before activation.** If some other webview has focus, the file is open in two groups, and the extension has never run, the lowest view column wins instead of the most recently focused one. This edge case is accepted; it only affects which of two cursors in the same file is used.
- **The icon.** `$(eye)` is a judgement call, made for "look at the ownership". Changing it later is a one-line manifest change and its test.

## Test strategy

- **Unit tests** in `target.test.ts` for the choice: one candidate, several candidates with a record, several without one (lowest column), and none.
- **End-to-end tests** in `titleButton.test.ts` against the development bundle, as in feature 004's acceptance tests. AC2: open fixture 05 and run once to open the panel, focus the panel's group, assert that there is no active text editor, move the cursor into `grow`, then run the command with the fixture's URI. The panel's report should show `grow`'s lines. D4: the same file in two groups with the cursor in `grow` in one and `area` in the other. Focusing each group in turn and then the panel, a run with the URI should analyse that group's function.
- **AC3** is the existing tests: `contributes.test.ts` (no editor gives `noRustEditor`) and feature 004's acceptance tests, all of which run the command without an argument.
- **AC1** in `contributes.test.ts`, reading the manifest as the existing palette test does.
- **By hand**, recorded in T-035's note: AC4, plus the two checks no test can make. The button still shows above the Rust file while the panel has focus, and right-click "Hide" removes it.

## Appendix A: module responsibilities

| Module | Requirements | Decides | Tested by |
| --- | --- | --- | --- |
| `target.ts` | R3, D4 | The record of each document's last focused column; the editor chosen for a URI: the only candidate, the recorded column, or the lowest column; none when no visible Rust editor shows the document | Unit; end to end (D4) |
| `command.ts` (`analyzeAtCursor`) | R3, R4 | URI argument: the editor from `target.ts`; anything else: `activeTextEditor`; then today's run | End to end (AC2, AC3) |
| `extension.ts` | R3, R5 | Passes the first argument; starts the record in `activate` | End to end |
| `package.json` | R1, R2, R5, D2 | Icon, `editor/title` entry, `navigation` group, `resourceLangId == rust` | `contributes.test.ts` (AC1); by hand (AC4) |
| `README.md` | R6, D3 | The button and VS Code's "Hide" | `contributes.test.ts` already reads the README; by hand (AC5) |

## Appendix B: VS Code facts and where each is settled

| Fact (spec Appendix A) | Settled by |
| --- | --- |
| `navigation` group items show as icons beside Split Editor | Hand check, T-035 |
| A command run from `editor/title` receives the group's editor URI as its first argument | Hand check, T-035: clicking the button with the panel focused draws the diagram, which only the URI path can do |
| `activeTextEditor` is `undefined` while the panel has focus | Assertion in the AC2 test, T-034 |
| `resourceLangId` follows each group's own editor, so the button shows while the panel has focus | Hand check, T-035 |
| Menu items show without activating the extension | Already true in this repository: the palette entry shows with an empty `activationEvents` |
| Right-click "Hide" removes a title-bar button | Hand check, T-035 |
