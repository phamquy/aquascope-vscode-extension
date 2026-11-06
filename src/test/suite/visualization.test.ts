// Feature 004 end to end: the command against the development bundle, seen through the panel's reports.
// T-026 covers the wiring between the command and the panel; T-028 extends this file to the acceptance criteria.
import * as assert from 'assert';
import * as vscode from 'vscode';
import type { AnalyzeResult } from '../../analysis/types';
import type { AquascopeApi } from '../../extension';
import { fixture, requireToolchain } from './harness';

const EXTENSION_ID = 'jackpham.aquascope-vscode-extension';
const COMMAND = 'aquascope.analyzeAtCursor';
const FILE = '05_method_mut_borrow.rs';

async function analyzeAt(line: number, character: number): Promise<AnalyzeResult> {
  const editor = await vscode.window.showTextDocument(fixture(FILE), { viewColumn: vscode.ViewColumn.One });
  editor.selection = new vscode.Selection(line, character, line, character);
  return (await vscode.commands.executeCommand<AnalyzeResult>(COMMAND)) as AnalyzeResult;
}

function setToolchainPath(value: string | undefined): Thenable<void> {
  return vscode.workspace.getConfiguration('aquascope').update('toolchainPath', value, vscode.ConfigurationTarget.Global);
}

suite('analysis shown in the panel (004 R1, R5)', function () {
  this.timeout(60_000);
  let api: AquascopeApi;

  suiteSetup(async function () {
    const bundle = requireToolchain(this);
    await setToolchainPath(bundle);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const ext = vscode.extensions.getExtension<AquascopeApi>(EXTENSION_ID);
    assert.ok(ext);
    api = await ext.activate();
  });
  suiteTeardown(async () => {
    await setToolchainPath(undefined);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('a successful run draws the function in the panel', async () => {
    const result = await analyzeAt(18, 4);
    assert.ok(result.kind === 'ok', JSON.stringify(result));
    const report = await api.latestPanelReport();
    assert.ok(report.type === 'rendered', JSON.stringify(report));
    assert.ok(report.code.startsWith('fn main() {'));
    assert.strictEqual(report.stepWidgets, result.output.steps.length);
    assert.deepStrictEqual(report.problems, []);
  });

  test('a failed run replaces the diagram with its message', async () => {
    const result = await analyzeAt(2, 4); // the `struct` line
    assert.ok(result.kind === 'error' && result.code === 'noFunction', JSON.stringify(result));
    const report = await api.latestPanelReport();
    assert.ok(report.type === 'message' && report.text === result.message, JSON.stringify(report));
  });

  test('a run without a Rust editor leaves the panel as it was', async () => {
    await analyzeAt(18, 4);
    const before = await api.latestPanelReport();
    // Close the text editors only; the panel stays open beside them, as when the user has clicked into it.
    const textTabs = vscode.window.tabGroups.all.flatMap((g) => g.tabs).filter((t) => t.input instanceof vscode.TabInputText);
    await vscode.window.tabGroups.close(textTabs);
    assert.strictEqual(vscode.window.activeTextEditor, undefined);
    assert.ok(api.isPanelOpen());
    const result = (await vscode.commands.executeCommand<AnalyzeResult>(COMMAND)) as AnalyzeResult;
    assert.ok(result.kind === 'error' && result.code === 'noRustEditor', JSON.stringify(result));
    assert.deepStrictEqual(await api.latestPanelReport(), before);
  });
});
