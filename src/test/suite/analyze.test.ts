// End-to-end runs of the command against the development bundle, one test per acceptance criterion
// of feature 003 (AC10). Results are checked by range, never by the order of Aquascope's output.
import * as assert from 'assert';
import * as path from 'path';
import { createHash } from 'crypto';
import { readdirSync, readFileSync, statSync } from 'fs';
import * as vscode from 'vscode';
import type { AnalysisOutput, AnalyzeResult, CharPos } from '../../analysis/types';
import { embedInput, NO_STEPS_NOTE, NOTHING_TO_SHOW_NOTE } from '../../visualization/embedInput';
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

  test('issue #31, feature 010: a function that returns early and then branches again is analysed, with boundaries and steps', async () => {
    // The fork keeps the boundaries when the steps fail (ADR 0004), and since feature 010 the steps no longer fail here.
    const output = ok(await analyzeAt('n3_early_return.rs', bodyLine('n3_early_return.rs', 'parse'), 8), 'Config::parse');
    assert.strictEqual(output.body_range.start.line, bodyLine('n3_early_return.rs', 'parse') - 1, 'the body of parse');
    assert.ok(output.boundaries.length > 0, 'expected boundaries');
    assert.ok(output.steps.length > 0, 'expected steps (spec 010, AC2)');
  });

  test('feature 010: a function that returns inside a loop gets its steps; one the stepper still cannot split keeps its boundaries', async () => {
    const file = 'n5_bst.rs';
    const next = ok(await analyzeAt(file, bodyLine(file, 'next'), 12), 'BstIter::next');
    assert.ok(next.steps.length > 0, 'next has steps (spec 010, AC1)');
    // An if chain where every arm returns, with a match on a tuple inside, is left for later (spec 010, D2).
    const remove = ok(await analyzeAt(file, bodyLine(file, 'remove_rec'), 12), 'remove_rec');
    assert.ok(remove.boundaries.length > 0 && remove.steps.length === 0, 'remove_rec has boundaries and no steps');
  });

  test('issue #61: a function that moves a field out of a recursive node is analysed, and so are its neighbours', async () => {
    // Aquascope panicked on `self.head = node.next` because the moved place's interior was untracked (ADR 0004).
    const file = 'n4_linked_stack.rs';
    const pop = ok(await analyzeAt(file, bodyLine(file, 'pop'), 8), 'LinkedStack::pop');
    assert.strictEqual(pop.body_range.start.line, bodyLine(file, 'pop') - 1, 'the body of pop');
    ok(await analyzeAt(file, bodyLine(file, 'push'), 8), 'LinkedStack::push');
  });

  test('issue #64: a function that walks a recursive tree with a mutable reference is analysed, and so are its neighbours', async () => {
    // Aquascope panicked in its permission boundaries on `min_ref.left` of a `&mut Box<Node>` (ADR 0004).
    const file = 'n5_bst.rs';
    const remove = ok(await analyzeAt(file, bodyLine(file, 'remove_rec'), 12), 'remove_rec');
    assert.ok(remove.boundaries.length > 0, 'remove_rec has permission boundaries');
    ok(await analyzeAt(file, bodyLine(file, 'insert'), 8), 'Bst::insert');
    ok(await analyzeAt(file, bodyLine(file, 'next'), 8), 'BstIter::next');
  });

  test('feature 011: the panel says why a function has no step table, for the functions of the binary search tree', async () => {
    const file = 'n5_bst.rs';
    const source = fixtureText(file);
    const notesOf = async (fn: string, column: number): Promise<{ output: AnalysisOutput; notes: string[] }> => {
      const output = ok(await analyzeAt(file, bodyLine(file, fn), column), fn);
      return { output, notes: embedInput(output, source).notes };
    };
    const remove = await notesOf('remove_rec', 12);
    assert.ok(remove.output.boundaries.length > 0 && remove.output.steps.length === 0, 'remove_rec: boundaries and no steps');
    assert.deepStrictEqual(remove.notes, [NO_STEPS_NOTE], 'remove_rec');
    for (const [fn, column] of [['insert', 8], ['contains', 8], ['next', 12]] as const) {
      const { output, notes } = await notesOf(fn, column);
      assert.ok(output.steps.length > 0, `${fn} has its step table`);
      assert.deepStrictEqual(notes, [], fn);
    }
    const { output, notes } = await notesOf('new', 8);
    assert.ok(output.boundaries.length === 0 && output.steps.length === 0, 'new: nothing at all');
    assert.deepStrictEqual(notes, [NOTHING_TO_SHOW_NOTE], 'new');
  });

  test('feature 010: a function with let … else gets its steps, with the bound value on the let line', async () => {
    const file = 'n6_let_else.rs';
    const output = ok(await analyzeAt(file, bodyLine(file, 'first_word_len'), 8), 'first_word_len');
    assert.ok(output.steps.length > 0, 'steps (spec 010, AC8)');
    // `let Some(line) = text else { … };` binds `line`: a table on that line shows it gaining read and own.
    const letLine = fixtureText(file).split('\n').findIndex((l) => l.includes('let Some(line) = text else'));
    const gains = output.steps
      .filter((step) => step.location.start.line === letLine)
      .flatMap((step) => step.state.flatMap((table) => table.state))
      .filter(([place, diff]) => place === 'line' && diff.permissions.read.type === 'High' && diff.permissions.drop.type === 'High');
    assert.strictEqual(gains.length, 1, `line gains read and own on line ${letLine + 1}: ${JSON.stringify(output.steps.map((s) => s.location.start.line))}`);
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
