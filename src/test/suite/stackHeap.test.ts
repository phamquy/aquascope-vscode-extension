// Feature 007 end to end: Show Stack and Heap against a bundle with the Miri-built library, seen through the
// command's result, the panel's reports and the output channel, one test per automated criterion (AC8).
import * as assert from 'assert';
import * as vscode from 'vscode';
import type { StackHeapResult } from '../../analysis/types';
import type { AquascopeApi } from '../../extension';
import type { PanelReport } from '../../visualization/panel';
import { STEP_LIMIT, TRACE_TITLE } from '../../visualization/traceInput';
import { fixture, requireMiri } from './harness';

const EXTENSION_ID = 'psyquy.aquascope-vscode-extension';
const COMMAND = 'aquascope.showStackAndHeap';

async function open(file: string): Promise<vscode.TextEditor> {
  return vscode.window.showTextDocument(fixture(file), { viewColumn: vscode.ViewColumn.One });
}

async function run(): Promise<StackHeapResult> {
  return (await vscode.commands.executeCommand<StackHeapResult>(COMMAND)) as StackHeapResult;
}

function traced(result: StackHeapResult): Extract<StackHeapResult, { kind: 'ok' }> {
  assert.ok(result.kind === 'ok', JSON.stringify(result));
  return result as Extract<StackHeapResult, { kind: 'ok' }>;
}

suite('feature 007 acceptance criteria, end to end', function () {
  this.timeout(60_000);
  let api: AquascopeApi;

  /** The panel's latest report, which must be a trace drawn without problems. */
  async function drawn(): Promise<Extract<PanelReport, { type: 'trace' }>> {
    const report = await api.latestPanelReport();
    assert.strictEqual(report.type, 'trace', JSON.stringify(report));
    assert.deepStrictEqual(report.problems, [], 'no policy violation or script error');
    return report as Extract<PanelReport, { type: 'trace' }>;
  }

  /** The tab title of the open Aquascope panel. */
  function panelTitle(): string | undefined {
    return vscode.window.tabGroups.all.flatMap((g) => g.tabs).find((t) => t.input instanceof vscode.TabInputWebview)?.label;
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

  test('AC1: the move example opens the panel with four steps: s1, then s1 and s2, then nothing', async () => {
    await open('01_move_string.rs');
    const { trace } = traced(await run());
    const report = await drawn();
    assert.deepStrictEqual([report.steps, report.markers, report.failed], [4, 4, 0]);
    assert.strictEqual(panelTitle(), TRACE_TITLE);
    const frames = trace.steps.map((s) => s.stack.frames);
    assert.ok(frames.every((f) => f.length === 1 && f[0].name === 'main'), 'only main on the stack');
    assert.deepStrictEqual(frames[0][0].locals.map((l) => l.name), ['s1']);
    assert.strictEqual(trace.steps[0].heap.locations.length, 1);
    assert.deepStrictEqual(frames[1][0].locals.map((l) => l.name), ['s1', 's2']);
    assert.deepStrictEqual(frames[3][0].locals, []);
    assert.strictEqual(trace.steps[3].heap.locations.length, 0);
  });

  test('AC2: a method call shows a frame for grow above the frame for main', async () => {
    await open('05_method_mut_borrow.rs');
    const { trace } = traced(await run());
    const stacks = trace.steps.map((s) => s.stack.frames.map((f) => f.name));
    assert.ok(stacks.some((names) => names.length === 2 && names[0] === 'main' && names[1] === 'Rect::grow'), JSON.stringify(stacks));
    assert.strictEqual((await drawn()).steps, trace.steps.length);
  });

  test('AC3: a file with no main is told it needs one, in a notification and the panel', async () => {
    await open('01_move_string.rs');
    await run();
    await drawn(); // the panel is open, so the message replaces the diagram
    await open('i6_no_main.rs');
    const result = await run();
    assert.ok(result.kind === 'error' && result.code === 'noMain', JSON.stringify(result));
    assert.match(result.message, /needs a `main` function/);
    assert.doesNotMatch(result.message, /E0601|error\[/, 'not a raw compiler error');
    const report = await api.latestPanelReport();
    assert.ok(report.type === 'message' && report.text === result.message, JSON.stringify(report));
  });

  test('AC4: a panicking program is said to have stopped while running, and the log holds the interpreter output', async () => {
    await open('i1_panic.rs');
    const result = await run();
    assert.ok(result.kind === 'error' && result.code === 'programFailed', JSON.stringify(result));
    assert.match(result.message, /stopped while running/);
    // The interpreter's bare build error; the fork adds `"file_path":null` to it (ADR 0004).
    assert.match(api.recentOutput(), /interpreter output: \{"Err":\{"type":"BuildError","range":null[,}]/, api.recentOutput().slice(-2000));
  });

  test('AC5: an unsaved edit is run', async () => {
    const editor = await open('01_move_string.rs');
    try {
      await editor.edit((e) => e.insert(new vscode.Position(3, 0), '    let extra = 7;\n'));
      assert.ok(editor.document.isDirty);
      const { trace } = traced(await run());
      assert.strictEqual(trace.steps.length, 5, 'one more statement, one more step');
      assert.ok(trace.steps.some((s) => s.stack.frames[0].locals.some((l) => l.name === 'extra')));
      assert.ok((await drawn()).code.includes('let extra = 7;'));
    } finally {
      await vscode.window.showTextDocument(editor.document, vscode.ViewColumn.One);
      await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
    }
  });

  test(`AC10: a run of more than ${STEP_LIMIT} steps draws exactly ${STEP_LIMIT} and says it stopped there`, async () => {
    await open('i10_calls_in_loop.rs');
    const { trace } = traced(await run());
    assert.ok(trace.steps.length > STEP_LIMIT, `${trace.steps.length} steps`);
    const report = await drawn();
    assert.deepStrictEqual([report.steps, report.markers, report.failed], [STEP_LIMIT, STEP_LIMIT, 0]);
    const note = report.notes[0] ?? '';
    assert.ok(note.startsWith(`Showing the first ${STEP_LIMIT} of ${trace.steps.length} steps.`), note);
  });

  test('AC11: a use after free is drawn with its four steps, the last marked failed, and named', async () => {
    await open('i4_use_after_free.rs');
    const { trace } = traced(await run());
    assert.strictEqual(trace.result.type, 'Error');
    const report = await drawn();
    assert.deepStrictEqual([report.steps, report.markers, report.failed], [4, 4, 1]);
    assert.match(report.notes[0] ?? '', /used after the memory it points to was freed/);
  });
});
