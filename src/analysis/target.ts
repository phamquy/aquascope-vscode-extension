// Which editor a run from the editor title bar analyses (feature 006 R3, D4). The title bar passes only the
// document's URI, and VS Code may report no active text editor at all (when the Aquascope panel has focus),
// so the editor is found among the visible ones; when several show the document, the one in the group that
// was focused most recently wins.
import * as vscode from 'vscode';

/** The view column each Rust document was last focused in, by URI, recorded from activation on. */
const lastFocused = new Map<string, number>();

function record(editor: vscode.TextEditor | undefined): void {
  if (editor?.document.languageId === 'rust' && editor.viewColumn !== undefined) {
    lastFocused.set(editor.document.uri.toString(), editor.viewColumn);
  }
}

/**
 * Records the active group's editor. VS Code reports the active text editor only while its window has OS
 * focus, but it updates the active tab group either way, so the record follows both.
 */
function recordActiveGroup(): void {
  const group = vscode.window.tabGroups.activeTabGroup;
  const input = group.activeTab?.input;
  if (!(input instanceof vscode.TabInputText)) return;
  const document = vscode.workspace.textDocuments.find((d) => d.uri.toString() === input.uri.toString());
  if (document?.languageId === 'rust') lastFocused.set(input.uri.toString(), group.viewColumn);
}

/** Starts the focus record, beginning with the editor that has focus now. */
export function startFocusRecord(): vscode.Disposable {
  record(vscode.window.activeTextEditor);
  recordActiveGroup();
  return vscode.Disposable.from(
    vscode.window.onDidChangeActiveTextEditor(record),
    vscode.window.tabGroups.onDidChangeTabGroups(recordActiveGroup),
    vscode.window.tabGroups.onDidChangeTabs(recordActiveGroup),
  );
}

/**
 * The view column to analyse among those showing the document: the one it was last focused in, if that is
 * still among them, otherwise the lowest, so that the choice is the same every time (D4).
 */
export function chooseColumn(columns: readonly number[], recorded: number | undefined): number | undefined {
  if (columns.length === 0) return undefined;
  if (recorded !== undefined && columns.includes(recorded)) return recorded;
  return Math.min(...columns);
}

/** The visible editor showing `uri` that a title-bar run analyses, or undefined when none shows it. */
export function editorFor(uri: vscode.Uri): vscode.TextEditor | undefined {
  const key = uri.toString();
  const candidates = vscode.window.visibleTextEditors.filter((e) => e.document.uri.toString() === key && e.viewColumn !== undefined);
  const column = chooseColumn(
    candidates.map((e) => e.viewColumn as number),
    lastFocused.get(key),
  );
  return candidates.find((e) => e.viewColumn === column);
}
