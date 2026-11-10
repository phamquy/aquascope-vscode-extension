// Feature 009 end to end: Show Stack and Heap on a program that is a whole crate, against a bundle with the
// Miri-built library, seen through the command's result and the panel's reports. T-052 adds the criterion the
// fork's change serves on its own (AC9, for a file alone); T-054 to T-056 add the rest.
import * as assert from 'assert';
import * as vscode from 'vscode';
import type { StackHeapResult } from '../../analysis/types';
import type { AquascopeApi } from '../../extension';
import type { PanelReport } from '../../visualization/panel';
import { fixture, requireMiri } from './harness';

const EXTENSION_ID = 'jackpham.aquascope-vscode-extension';
const COMMAND = 'aquascope.showStackAndHeap';

function traced(result: StackHeapResult): Extract<StackHeapResult, { kind: 'ok' }> {
  assert.ok(result.kind === 'ok', JSON.stringify(result));
  return result as Extract<StackHeapResult, { kind: 'ok' }>;
}

suite('feature 009 acceptance criteria, end to end', function () {
  this.timeout(60_000);
  let api: AquascopeApi;

  /** The panel's latest report, which must be a trace drawn without problems. */
  async function drawn(): Promise<Extract<PanelReport, { type: 'trace' }>> {
    const report = await api.latestPanelReport();
    assert.strictEqual(report.type, 'trace', JSON.stringify(report));
    assert.deepStrictEqual(report.problems, [], 'no policy violation or script error');
    return report as Extract<PanelReport, { type: 'trace' }>;
  }

  suiteSetup(async function () {
    const bundle = requireMiri(this);
    await vscode.workspace.getConfiguration('aquascope').update('toolchainPath', bundle, vscode.ConfigurationTarget.Global);
    const ext = vscode.extensions.getExtension<AquascopeApi>(EXTENSION_ID);
    assert.ok(ext);
    api = await ext.activate();
  });
  setup(() => vscode.commands.executeCommand('workbench.action.closeAllEditors'));
  suiteTeardown(async () => {
    await vscode.workspace.getConfiguration('aquascope').update('toolchainPath', undefined, vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('AC9: a file alone holding a reference to a string literal is drawn, with the characters in the heap', async () => {
    await vscode.window.showTextDocument(fixture('l1_string_literal.rs'), { viewColumn: vscode.ViewColumn.One });
    const result = await vscode.commands.executeCommand<StackHeapResult>(COMMAND);
    const { trace } = traced(result as StackHeapResult);
    assert.strictEqual((await drawn()).steps, trace.steps.length);
    const step = trace.steps.find((s) => s.stack.frames[0].locals.some((l) => l.name === 's'));
    assert.ok(step, 'a step with s');
    const s = step.stack.frames[0].locals.find((l) => l.name === 's');
    assert.ok(s?.value.type === 'Pointer' && s.value.value.path.segment.type === 'Heap', JSON.stringify(s?.value));
    const text = step.heap.locations[s.value.value.path.segment.value.index];
    assert.deepStrictEqual(text, { type: 'Array', value: { type: 'All', value: [{ type: 'Char', value: 104 }, { type: 'Char', value: 105 }] } });
  });
});
