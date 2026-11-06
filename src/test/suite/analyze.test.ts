// End-to-end runs of the command against the development bundle. T-021 adds a smoke test of each
// outcome path; T-022 extends this file to the spec's acceptance criteria.
import * as assert from 'assert';
import * as vscode from 'vscode';
import type { AnalyzeResult } from '../../analysis/types';
import { fixture, requireToolchain, testToolchain } from './harness';

const COMMAND = 'aquascope.analyzeAtCursor';

/** Opens a fixture, puts the cursor at (line, character) and runs the command. */
async function analyzeAt(name: string, line: number, character: number): Promise<AnalyzeResult> {
  const editor = await vscode.window.showTextDocument(fixture(name));
  editor.selection = new vscode.Selection(line, character, line, character);
  return (await vscode.commands.executeCommand<AnalyzeResult>(COMMAND)) as AnalyzeResult;
}

async function setToolchainPath(value: string | undefined): Promise<void> {
  await vscode.workspace.getConfiguration('aquascope').update('toolchainPath', value, vscode.ConfigurationTarget.Global);
}

suite('analyze command end to end', function () {
  this.timeout(60_000);

  suiteSetup(function () {
    return setToolchainPath(requireToolchain(this));
  });
  suiteTeardown(async () => {
    await setToolchainPath(undefined);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('analyses the function at the cursor', async () => {
    const result = await analyzeAt('05_method_mut_borrow.rs', 18, 4);
    assert.strictEqual(result.kind, 'ok', JSON.stringify(result));
    assert.deepStrictEqual(result.kind === 'ok' && result.output.body_range.start, { line: 16, column: 0 });
    assert.ok(result.kind === 'ok' && result.output.steps.length > 0);
  });

  test('explains the single-file limit, using cargo check', async () => {
    const result = await analyzeAt('e3_mod_other.rs', 4, 4);
    assert.strictEqual(result.kind === 'error' && result.code, 'singleFileLimit', JSON.stringify(result));
    assert.match(result.kind === 'error' ? result.message : '', /`other`/);
  });

  test('reports no function outside every body', async () => {
    const result = await analyzeAt('05_method_mut_borrow.rs', 2, 4);
    assert.strictEqual(result.kind === 'error' && result.code, 'noFunction', JSON.stringify(result));
  });

  test('names the setting when the configured toolchain is missing', async () => {
    await setToolchainPath('/nonexistent/aquascope');
    try {
      const result = await analyzeAt('05_method_mut_borrow.rs', 18, 4);
      assert.strictEqual(result.kind === 'error' && result.code, 'toolNotFound', JSON.stringify(result));
      assert.match(result.kind === 'error' ? result.message : '', /aquascope\.toolchainPath/);
    } finally {
      await setToolchainPath(testToolchain);
    }
  });
});
