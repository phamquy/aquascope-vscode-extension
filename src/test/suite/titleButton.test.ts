// Feature 006 end to end: the command run as the editor title bar runs it, with the document's URI, while
// the Aquascope panel has focus (AC2), and with the document open in two groups (D4).
import * as assert from 'assert';
import * as vscode from 'vscode';
import type { AnalyzeResult } from '../../analysis/types';
import type { AquascopeApi } from '../../extension';
import type { PanelReport } from '../../visualization/panel';
import { fixture, fixtureText, requireToolchain } from './harness';

const EXTENSION_ID = 'psyquy.aquascope-vscode-extension';
const COMMAND = 'aquascope.analyzeAtCursor';
const FILE = '05_method_mut_borrow.rs';
const lines = (from: number, to: number) => fixtureText(FILE).split('\n').slice(from, to + 1).join('\n');
const GROW = lines(7, 10);
const AREA = lines(11, 13);

function place(editor: vscode.TextEditor, line: number, character: number): void {
  editor.selection = new vscode.Selection(line, character, line, character);
}

async function run(...args: unknown[]): Promise<AnalyzeResult> {
  return (await vscode.commands.executeCommand<AnalyzeResult>(COMMAND, ...args)) as AnalyzeResult;
}

/** Waits for VS Code's report of the active editor group to catch up with a focus change. */
async function until(condition: () => boolean, what: string): Promise<void> {
  for (let waited = 0; !condition(); waited += 20) {
    if (waited >= 2000) assert.fail(`timed out waiting for ${what}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

/**
 * Focuses an editor group by its focus command and waits until VS Code reports it as the active group. The
 * active group is waited on, not `activeTextEditor`: VS Code updates the group whether or not its window has
 * OS focus, but the active text editor only while it does (issue #37).
 */
async function focus(command: string, column: vscode.ViewColumn): Promise<void> {
  await vscode.commands.executeCommand(command);
  await until(() => vscode.window.tabGroups.activeTabGroup.viewColumn === column, `the group in column ${column}`);
}

function renderedCode(report: PanelReport): string {
  assert.strictEqual(report.type, 'rendered', JSON.stringify(report));
  return (report as Extract<PanelReport, { type: 'rendered' }>).code;
}

function setToolchainPath(value: string | undefined): Thenable<void> {
  return vscode.workspace.getConfiguration('aquascope').update('toolchainPath', value, vscode.ConfigurationTarget.Global);
}

suite('feature 006: the command run from the editor title bar, end to end', function () {
  this.timeout(60_000);
  let api: AquascopeApi;

  suiteSetup(async function () {
    const bundle = requireToolchain(this);
    await setToolchainPath(bundle);
    const ext = vscode.extensions.getExtension<AquascopeApi>(EXTENSION_ID);
    assert.ok(ext);
    api = await ext.activate();
  });
  setup(() => vscode.commands.executeCommand('workbench.action.closeAllEditors'));
  suiteTeardown(async () => {
    await setToolchainPath(undefined);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('AC2: with the panel focused, a run with the URI analyses that editor at its cursor', async () => {
    const editor = await vscode.window.showTextDocument(fixture(FILE), { viewColumn: vscode.ViewColumn.One });
    place(editor, 18, 4);
    assert.strictEqual((await run()).kind, 'ok'); // opens the panel beside the editor, in column two
    await api.latestPanelReport();

    await focus('workbench.action.focusSecondEditorGroup', vscode.ViewColumn.Two);
    if (vscode.window.state.focused) {
      assert.strictEqual(vscode.window.activeTextEditor, undefined, 'VS Code reports no active text editor while the panel has focus');
    }

    place(editor, 8, 8); // `grow`
    const result = await run(editor.document.uri);
    assert.ok(result.kind === 'ok', JSON.stringify(result));
    assert.deepStrictEqual(result.output.body_range.start, { line: 7, column: 4 });
    assert.strictEqual(renderedCode(await api.latestPanelReport()), GROW);
  });

  test('D4: with the file open in two groups, the run analyses the one focused most recently', async () => {
    const left = await vscode.window.showTextDocument(fixture(FILE), { viewColumn: vscode.ViewColumn.One });
    place(left, 8, 8); // `grow`
    const right = await vscode.window.showTextDocument(left.document, { viewColumn: vscode.ViewColumn.Two });
    place(right, 12, 8); // `area`
    assert.strictEqual((await run()).kind, 'ok'); // the active editor, `right`; the panel opens in column three
    assert.strictEqual(renderedCode(await api.latestPanelReport()), AREA);

    await focus('workbench.action.focusFirstEditorGroup', vscode.ViewColumn.One);
    await focus('workbench.action.focusThirdEditorGroup', vscode.ViewColumn.Three);
    assert.strictEqual((await run(left.document.uri)).kind, 'ok');
    assert.strictEqual(renderedCode(await api.latestPanelReport()), GROW);

    await focus('workbench.action.focusSecondEditorGroup', vscode.ViewColumn.Two);
    await focus('workbench.action.focusThirdEditorGroup', vscode.ViewColumn.Three);
    assert.strictEqual((await run(left.document.uri)).kind, 'ok');
    assert.strictEqual(renderedCode(await api.latestPanelReport()), AREA);
  });

  test('a URI no visible editor shows is reported as no Rust editor, and the panel is left alone', async () => {
    const editor = await vscode.window.showTextDocument(fixture(FILE), { viewColumn: vscode.ViewColumn.One });
    place(editor, 18, 4);
    await run();
    const before = await api.latestPanelReport();
    const result = await run(fixture('01_move_string.rs'));
    assert.ok(result.kind === 'error' && result.code === 'noRustEditor', JSON.stringify(result));
    assert.deepStrictEqual(await api.latestPanelReport(), before);
  });
});
