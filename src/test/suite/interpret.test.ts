// Feature 007's interpreter run (R2, R3, R5): parsing its output and explaining its failures from the
// data T-036 captured, then the command end to end against a bundle with the Miri-built library.
import * as assert from 'assert';
import * as vscode from 'vscode';
import { classifyInterpretFailure, parseInterpreterOutput } from '../../analysis/interpret';
import { parseCompilerErrors } from '../../analysis/errors';
import type { StackHeapResult } from '../../analysis/types';
import type { AquascopeApi } from '../../extension';
import { fixture, fixtureData, requireMiri } from './harness';

const errorsOf = (name: string) => parseCompilerErrors(fixtureData(`${name}.check.jsonl`));

suite('reading the interpreter output (feature 007 R2)', () => {
  test('reads a trace with its steps, stack frames and heap', () => {
    const parsed = parseInterpreterOutput(fixtureData('01_move_string.interp.json'));
    assert.ok(parsed.kind === 'trace', JSON.stringify(parsed).slice(0, 200));
    assert.strictEqual(parsed.trace.steps.length, 4);
    assert.deepStrictEqual(parsed.trace.result, { type: 'Success' });
    const locals = parsed.trace.steps.map((s) => s.stack.frames[0].locals.map((l) => l.name));
    assert.deepStrictEqual(locals, [['s1'], ['s1', 's2'], ['s1', 's2'], []]);
  });

  test('keeps the steps of a run that ends in undefined behaviour (D4, revised)', () => {
    const parsed = parseInterpreterOutput(fixtureData('i4_use_after_free.interp.json'));
    assert.ok(parsed.kind === 'trace');
    assert.strictEqual(parsed.trace.steps.length, 4);
    assert.strictEqual(parsed.trace.result.type, 'Error');
    assert.ok(parsed.trace.result.type === 'Error' && parsed.trace.result.value.type === 'PointerUseAfterFree');
  });

  test('tells a failed run from output that is not the interpreter\'s', () => {
    assert.deepStrictEqual(parseInterpreterOutput(fixtureData('i1_panic.interp.json')), { kind: 'failed' });
    assert.deepStrictEqual(parseInterpreterOutput(''), { kind: 'invalid', reason: 'no output' });
    assert.deepStrictEqual(parseInterpreterOutput('thread main panicked'), { kind: 'invalid', reason: 'not JSON' });
    assert.deepStrictEqual(parseInterpreterOutput('[{"Ok": {}}]'), { kind: 'invalid', reason: 'not an interpreter result' });
  });
});

suite('explaining a run without a trace (feature 007 R5)', () => {
  test('a missing main asks for one (E0601)', () => {
    const f = classifyInterpretFailure(errorsOf('i6_no_main'), 101);
    assert.strictEqual(f.code, 'noMain');
    assert.match(f.message, /needs a `main` function/);
  });

  test('a module a single file cannot provide is the single-file limit, as in 003', () => {
    const f = classifyInterpretFailure(errorsOf('e3_mod_other'), 101);
    assert.strictEqual(f.code, 'singleFileLimit');
    assert.match(f.message, /`other`/);
  });

  test('other compile errors say the program could not be run, borrow errors included', () => {
    const f = classifyInterpretFailure(errorsOf('e1_type_error'), 101);
    assert.strictEqual(f.code, 'compileErrors');
    assert.match(f.message, /could not be run because the file has compile errors/);
    assert.match(f.message, /borrow checking/);
  });

  test('no compile errors: a clean exit is the program stopping, anything else a tool failure', () => {
    assert.strictEqual(classifyInterpretFailure([], 0).code, 'programFailed');
    assert.match(classifyInterpretFailure([], 0).message, /stopped while running/);
    const tool = classifyInterpretFailure([], 101);
    assert.strictEqual(tool.code, 'toolFailed');
    assert.match(tool.message, /exit code 101/);
  });
});

suite('Show Stack and Heap, end to end (feature 007 R1 to R5)', function () {
  this.timeout(60_000);
  const COMMAND = 'aquascope.showStackAndHeap';
  let api: AquascopeApi;

  async function runOn(file: string): Promise<StackHeapResult> {
    await vscode.window.showTextDocument(fixture(file), { viewColumn: vscode.ViewColumn.One });
    return (await vscode.commands.executeCommand<StackHeapResult>(COMMAND)) as StackHeapResult;
  }

  suiteSetup(async function () {
    const bundle = requireMiri(this);
    await vscode.workspace.getConfiguration('aquascope').update('toolchainPath', bundle, vscode.ConfigurationTarget.Global);
    const ext = vscode.extensions.getExtension<AquascopeApi>('psyquy.aquascope-vscode-extension');
    assert.ok(ext);
    api = await ext.activate();
  });
  suiteTeardown(async () => {
    await vscode.workspace.getConfiguration('aquascope').update('toolchainPath', undefined, vscode.ConfigurationTarget.Global);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('runs the move example, returns its four steps and draws them in the panel (R4)', async () => {
    const result = await runOn('01_move_string.rs');
    assert.ok(result.kind === 'ok', JSON.stringify(result));
    assert.strictEqual(result.trace.steps.length, 4);
    assert.deepStrictEqual(result.trace.steps.map((s) => s.stack.frames[0].location.start.line), [2, 3, 4, 5]);
    const report = await api.latestPanelReport();
    assert.ok(report.type === 'trace' && report.steps === 4 && report.markers === 4, JSON.stringify(report));
  });

  test('a file without main gets the noMain message, which replaces the diagram in the open panel (R5)', async () => {
    const result = await runOn('i6_no_main.rs');
    assert.ok(result.kind === 'error' && result.code === 'noMain', JSON.stringify(result));
    const report = await api.latestPanelReport();
    assert.ok(report.type === 'message' && report.text === result.message, JSON.stringify(report));
  });

  test('a panicking program gets the programFailed message', async () => {
    const result = await runOn('i1_panic.rs');
    assert.ok(result.kind === 'error' && result.code === 'programFailed', JSON.stringify(result));
  });

  test('code that fails borrow checking cannot run and gets the compile-error message', async () => {
    const result = await runOn('04_push_while_borrowed_fail.rs');
    assert.ok(result.kind === 'error' && result.code === 'compileErrors', JSON.stringify(result));
  });
});
