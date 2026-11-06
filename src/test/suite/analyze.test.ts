// End-to-end runs of the command against the development bundle, one test per acceptance criterion
// of feature 003 (AC10). Results are checked by range, never by the order of Aquascope's output.
import * as assert from 'assert';
import * as path from 'path';
import { createHash } from 'crypto';
import { readdirSync, readFileSync, statSync } from 'fs';
import * as vscode from 'vscode';
import type { AnalyzeResult, CharPos } from '../../analysis/types';
import { fixture, fixtureText, fixtureWorkspace, requireToolchain, testToolchain } from './harness';

const COMMAND = 'aquascope.analyzeAtCursor';
const SPIKE_PROGRAMS = ['01_move_string', '02_box_move', '03_borrow_then_push', '04_push_while_borrowed_fail', '05_method_mut_borrow'];

/** Runs the command with the cursor at (line, character) in an open editor. */
async function runAt(editor: vscode.TextEditor, line: number, character: number): Promise<AnalyzeResult> {
  editor.selection = new vscode.Selection(line, character, line, character);
  return (await vscode.commands.executeCommand<AnalyzeResult>(COMMAND)) as AnalyzeResult;
}

/** Opens a fixture and runs the command with the cursor at (line, character). */
async function analyzeAt(name: string, line: number, character: number): Promise<AnalyzeResult> {
  return runAt(await vscode.window.showTextDocument(fixture(name)), line, character);
}

/** The first line of the body of `fn <name>` in a fixture, where a cursor is inside that function. */
function bodyLine(file: string, fn: string): number {
  const index = fixtureText(file).split('\n').findIndex((l) => new RegExp(`\\bfn ${fn}\\b`).test(l));
  assert.ok(index >= 0, `no fn ${fn} in ${file}`);
  return index + 1;
}

function setToolchainPath(value: string | undefined): Thenable<void> {
  return vscode.workspace.getConfiguration('aquascope').update('toolchainPath', value, vscode.ConfigurationTarget.Global);
}

const ok = (r: AnalyzeResult, context: string) => {
  assert.strictEqual(r.kind, 'ok', `${context}: ${JSON.stringify(r)}`);
  return r.kind === 'ok' ? r.output : assert.fail('unreachable');
};
const errorCode = (r: AnalyzeResult) => (r.kind === 'error' ? r.code : 'ok');
const errorMessage = (r: AnalyzeResult) => (r.kind === 'error' ? r.message : '');
const before = (a: CharPos, b: CharPos) => a.line < b.line || (a.line === b.line && a.column <= b.column);

/** Every file in the workspace folder with its size, modification time and content hash (AC9). */
function snapshot(dir: string, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = path.join(prefix, entry.name);
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) Object.assign(out, snapshot(full, rel));
    else {
      const st = statSync(full);
      out[rel] = `${st.size} ${st.mtimeMs} ${createHash('sha1').update(readFileSync(full)).digest('hex')}`;
    }
  }
  return out;
}

suite('feature 003 acceptance criteria, end to end', function () {
  this.timeout(60_000);
  let workspaceBefore: Record<string, string>;

  suiteSetup(async function () {
    const bundle = requireToolchain(this);
    workspaceBefore = snapshot(fixtureWorkspace());
    await setToolchainPath(bundle);
  });
  suiteTeardown(async () => {
    await setToolchainPath(undefined);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('AC1: analyses main of each spike program in under 10 seconds', async () => {
    for (const name of SPIKE_PROGRAMS) {
      const cursor = { line: bodyLine(`${name}.rs`, 'main'), column: 4 };
      const started = Date.now();
      const result = await analyzeAt(`${name}.rs`, cursor.line, cursor.column);
      const ms = Date.now() - started;
      const range = ok(result, name).body_range;
      assert.ok(before(range.start, cursor) && before(cursor, range.end), `${name}: range ${JSON.stringify(range)} misses the cursor`);
      assert.ok(ms < 10_000, `${name} took ${ms} ms`);
      console.log(`      ${name}: ${ms} ms`);
    }
  });

  test('AC2: a function failing the borrow check is analysed, not reported as a build error', async () => {
    const output = ok(await analyzeAt('04_push_while_borrowed_fail.rs', bodyLine('04_push_while_borrowed_fail.rs', 'main'), 4), '04');
    assert.ok(output.steps.length > 0 && output.boundaries.length > 0, 'expected permission steps and boundaries');
    assert.ok(
      output.boundaries.some((b) => (b.expected.write && !b.actual.write) || (b.expected.read && !b.actual.read) || (b.expected.drop && !b.actual.drop)),
      'expected a boundary where the expected permission is missing',
    );
  });

  test('AC3: grow, area and main of the method fixture select their own bodies', async () => {
    const file = '05_method_mut_borrow.rs';
    const starts: number[] = [];
    for (const fn of ['grow', 'area', 'main']) {
      const line = bodyLine(file, fn);
      const range = ok(await analyzeAt(file, line, 8), fn).body_range;
      assert.strictEqual(range.start.line, line - 1, `${fn} starts on its own fn line`);
      starts.push(range.start.line);
    }
    assert.strictEqual(new Set(starts).size, 3);
  });

  test('AC4: outside any function, says so instead of repeating the last result', async () => {
    const file = '05_method_mut_borrow.rs';
    ok(await analyzeAt(file, bodyLine(file, 'main'), 4), 'main first');
    const result = await analyzeAt(file, 2, 4); // inside `struct Rect`
    assert.strictEqual(errorCode(result), 'noFunction', JSON.stringify(result));
    assert.match(errorMessage(result), /no function at the cursor/);
  });

  test('AC5: analyses the unsaved text in the editor', async () => {
    const file = '01_move_string.rs';
    const editor = await vscode.window.showTextDocument(fixture(file));
    try {
      const line = bodyLine(file, 'main');
      const saved = ok(await runAt(editor, line, 4), 'saved text').body_range;
      await editor.edit((e) => e.insert(new vscode.Position(0, 0), '// an unsaved line\n'));
      assert.ok(editor.document.isDirty);
      const edited = ok(await runAt(editor, line + 1, 4), 'edited text').body_range;
      assert.strictEqual(edited.start.line, saved.start.line + 1, 'the range follows the inserted line');
      assert.strictEqual(edited.end.line, saved.end.line + 1);
    } finally {
      await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
    }
  });

  test('AC6: modules and crates a single file cannot provide get the single-file message', async () => {
    for (const [file, name] of [['e3_mod_other.rs', 'other'], ['e5_undeclared_crate_path.rs', 'rand']]) {
      const result = await analyzeAt(file, bodyLine(file, 'main'), 4);
      assert.strictEqual(errorCode(result), 'singleFileLimit', `${file}: ${JSON.stringify(result)}`);
      assert.ok(errorMessage(result).includes(`\`${name}\``), `${file}: ${errorMessage(result)}`);
      assert.doesNotMatch(errorMessage(result), /error\[E\d+\]/, 'no raw compiler error in the message');
    }
  });

  test('AC6: a function that does not use an unresolved import is still analysed', async () => {
    const file = 'e2_unresolved_import.rs';
    ok(await analyzeAt(file, bodyLine(file, 'main'), 4), 'main beside `use serde::Serialize;`');
  });

  test('AC9: the runs left the workspace folder unchanged', () => {
    assert.deepStrictEqual(snapshot(fixtureWorkspace()), workspaceBefore);
  });
});

suite('feature 003 acceptance criteria without a toolchain', function () {
  this.timeout(30_000);
  teardown(async () => {
    await setToolchainPath(testToolchain);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });
  suiteTeardown(() => setToolchainPath(undefined));

  test('AC7: names the setting when the configured folder has no tools', async () => {
    await setToolchainPath('/nonexistent/aquascope');
    const result = await analyzeAt('01_move_string.rs', 2, 4);
    assert.strictEqual(errorCode(result), 'toolNotFound', JSON.stringify(result));
    assert.match(errorMessage(result), /`aquascope\.toolchainPath`/);
    assert.match(errorMessage(result), /\/nonexistent\/aquascope/);
  });

  test('AC7: names the setting when it is empty and no tools ship with the extension', async () => {
    await setToolchainPath(undefined);
    const result = await analyzeAt('01_move_string.rs', 2, 4);
    assert.strictEqual(errorCode(result), 'toolNotFound', JSON.stringify(result));
    assert.match(errorMessage(result), /`aquascope\.toolchainPath`/);
  });
});
