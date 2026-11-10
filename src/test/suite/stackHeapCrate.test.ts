// Feature 009 end to end: Show Stack and Heap on a program that is a whole crate, against a bundle with the
// Miri-built library, seen through the command's result and the panel's reports. The binary and the
// arguments are given through the command's options, as the dialogs' choices are tested in program.test.ts.
// T-052 added AC9 for a file alone; T-054 AC1, AC2, AC4, AC5 and AC8; T-055 AC3, AC7 and D6's offer; T-056
// AC9 for a file of a package. AC6 is feature 007's suites, unchanged.
import * as assert from 'assert';
import { readFileSync } from 'fs';
import * as vscode from 'vscode';
import type { StackHeapOptions } from '../../analysis/command';
import type { StackHeapResult } from '../../analysis/types';
import type { AquascopeApi } from '../../extension';
import type { PanelReport } from '../../visualization/panel';
import { fixture, fixtureProject, folderSnapshot, requireMiri } from './harness';

const EXTENSION_ID = 'jackpham.aquascope-vscode-extension';
const COMMAND = 'aquascope.showStackAndHeap';

/** Opens `file` and runs Show Stack and Heap on it with `options`. */
async function runIn(file: string, options: StackHeapOptions = {}): Promise<StackHeapResult> {
  await vscode.window.showTextDocument(vscode.Uri.file(file), { viewColumn: vscode.ViewColumn.One });
  return (await vscode.commands.executeCommand<StackHeapResult>(COMMAND, options)) as StackHeapResult;
}

/** The file of each step's current frame. */
const currentFiles = (result: Extract<StackHeapResult, { kind: 'ok' }>) =>
  new Set(result.trace.steps.map((s) => s.stack.frames[s.stack.frames.length - 1].file_path));

function traced(result: StackHeapResult): Extract<StackHeapResult, { kind: 'ok' }> {
  assert.ok(result.kind === 'ok', JSON.stringify(result));
  return result as Extract<StackHeapResult, { kind: 'ok' }>;
}

suite('feature 009 acceptance criteria, end to end', function () {
  this.timeout(120_000); // the first run on a project builds it for the interpreter
  let api: AquascopeApi;
  let projectsBefore: Record<string, string>;
  const minigrep = (...parts: string[]) => fixtureProject('minigrep-book', ...parts);
  const frogPoem: StackHeapOptions = { arguments: ['frog', 'poem.txt'] };

  /** The panel's latest report, which must be a trace drawn without problems. */
  async function drawn(): Promise<Extract<PanelReport, { type: 'trace' }>> {
    const report = await api.latestPanelReport();
    assert.strictEqual(report.type, 'trace', JSON.stringify(report));
    assert.deepStrictEqual(report.problems, [], 'no policy violation or script error');
    return report as Extract<PanelReport, { type: 'trace' }>;
  }

  suiteSetup(async function () {
    const bundle = requireMiri(this);
    projectsBefore = folderSnapshot(fixtureProject());
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

  test("AC1: minigrep run from main.rs with frog poem.txt reads the poem and ends in success, drawing main's steps", async () => {
    const result = traced(await runIn(minigrep('src', 'main.rs'), frogPoem));
    assert.strictEqual(result.file, 'src/main.rs');
    assert.deepStrictEqual(result.trace.result, { type: 'Success' }, 'not stopped while running');
    assert.deepStrictEqual([...currentFiles(result)], ['src/main.rs']);
    assert.ok(result.trace.steps.every((s) => s.stack.frames[0].name === 'main'), "main's frame, named as in main.rs");
    assert.strictEqual((await drawn()).steps, result.trace.steps.length);
    assert.match(api.recentOutput(), /trace: 25 steps \(src\/lib\.rs 12, src\/config\.rs 7, src\/main\.rs 6\)/);
  });

  test("AC2: run from config.rs, the steps of Config::build are drawn, with main's frame below it", async () => {
    const result = traced(await runIn(minigrep('src', 'config.rs'), frogPoem));
    assert.deepStrictEqual([...currentFiles(result)], ['src/config.rs']);
    const stacks = result.trace.steps.map((s) => s.stack.frames.map((f) => `${f.name} (${f.file_path})`));
    assert.ok(
      stacks.some((names) => names.length === 2 && names[0] === 'main (src/main.rs)' && names[1] === 'config::Config::build (src/config.rs)'),
      JSON.stringify(stacks),
    );
    assert.strictEqual((await drawn()).steps, result.trace.steps.length);
  });

  test('AC4: a binary using a crates.io dependency, vendored in the fixture, is run and drawn', async () => {
    const result = traced(await runIn(fixtureProject('with-dep', 'src', 'main.rs'), { arguments: [] }));
    assert.deepStrictEqual(result.trace.result, { type: 'Success' });
    assert.deepStrictEqual([...currentFiles(result)], ['src/main.rs']);
    assert.strictEqual((await drawn()).steps, result.trace.steps.length);
  });

  test('AC5: an unsaved edit in config.rs changes the trace, and the file on disk is unchanged', async () => {
    const config = minigrep('src', 'config.rs');
    const onDisk = readFileSync(config, 'utf8');
    const saved = traced(await runIn(config, frogPoem));
    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);
    try {
      const line = editor.document.getText().split('\n').findIndex((l) => l.includes('let query = args[1].clone();'));
      assert.ok(line >= 0);
      const text = editor.document.lineAt(line).text;
      await editor.edit((e) => e.replace(new vscode.Range(line, 0, line, text.length), text.replace('.clone()', '.to_uppercase()')));
      assert.ok(editor.document.isDirty);
      const edited = traced((await vscode.commands.executeCommand<StackHeapResult>(COMMAND, frogPoem)) as StackHeapResult);
      assert.notDeepStrictEqual(edited.trace, saved.trace, 'the run saw the unsaved edit');
      assert.strictEqual(readFileSync(config, 'utf8'), onDisk, 'the file on disk is unchanged');
    } finally {
      await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
    }
  });

  test('AC8: run from a file the program never reaches, the run says so and names the files with steps', async () => {
    const result = await runIn(minigrep('tests', 'search.rs'), frogPoem);
    assert.ok(result.kind === 'error' && result.code === 'noStepsInFile', JSON.stringify(result));
    assert.match(result.message, /none of its steps are in tests\/search\.rs/);
    assert.match(result.message, /src\/lib\.rs, src\/config\.rs, src\/main\.rs/);
  });

  test('AC3: run with no arguments, minigrep is reported as stopped while running, and the message says it was given none', async () => {
    const result = await runIn(minigrep('src', 'main.rs'), { arguments: [] });
    assert.ok(result.kind === 'error' && result.code === 'programFailed', JSON.stringify(result));
    assert.match(result.message, /It was given no arguments\./);
    assert.match(result.message, /exit code 1/);
    assert.ok(!result.offersFileAlone, 'running the file alone would not help');
  });

  test('AC7: the arguments given for a project are offered again, and accepting them runs the program with them', async () => {
    traced(await runIn(minigrep('src', 'main.rs'), frogPoem)); // remembers frog poem.txt
    // Run without arguments given, so the input box asks, filled with the remembered ones, and accept them.
    const running = vscode.commands.executeCommand<StackHeapResult>(COMMAND);
    let settled = false;
    void Promise.resolve(running).finally(() => (settled = true));
    for (let i = 0; i < 50 && !settled; i++) {
      await new Promise((r) => setTimeout(r, 100));
      await vscode.commands.executeCommand('workbench.action.acceptSelectedQuickOpenItem');
    }
    const result = traced((await running) as StackHeapResult);
    assert.deepStrictEqual(result.trace.result, { type: 'Success' }, 'minigrep found its two arguments');
  });

  test('D6: a package without a binary is told so, offering the file alone, and the file alone runs as in feature 007', async () => {
    const lib = fixtureProject('workspace', 'core', 'src', 'lib.rs');
    const result = await runIn(lib);
    assert.ok(result.kind === 'error' && result.code === 'noBinary' && result.offersFileAlone === true, JSON.stringify(result));
    assert.match(result.message, /the package ws-core has no binary/);
    const alone = (await vscode.commands.executeCommand<StackHeapResult>(COMMAND, { alone: true })) as StackHeapResult;
    assert.ok(alone.kind === 'error' && alone.code === 'noMain', JSON.stringify(alone));
  });

  test('AC9: a file of a package holding a reference to a string literal is drawn, with the characters in the heap', async () => {
    const result = traced(await runIn(fixtureProject('with-dep', 'src', 'main.rs'), { arguments: [] }));
    assert.strictEqual((await drawn()).steps, result.trace.steps.length);
    const step = result.trace.steps.find((s) => s.stack.frames[0].locals.some((l) => l.name === 'title'));
    assert.ok(step, 'a step with title');
    const title = step.stack.frames[0].locals.find((l) => l.name === 'title');
    assert.ok(title?.value.type === 'Pointer' && title.value.value.path.segment.type === 'Heap', JSON.stringify(title?.value));
    const text = step.heap.locations[title.value.value.path.segment.value.index];
    assert.ok(text.type === 'Array' && text.value.type === 'All', JSON.stringify(text));
    const chars = text.value.value.map((c) => (c.type === 'Char' ? String.fromCharCode(c.value) : '?')).join('');
    assert.strictEqual(chars, 'labels:');
  });

  test('AC5: after every run above, the fixture projects are unchanged, with no Cargo.lock or target/ written', () => {
    assert.deepStrictEqual(folderSnapshot(fixtureProject()), projectsBefore);
  });
});
