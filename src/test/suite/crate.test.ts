// Feature 008 end to end: a function analysed with the rest of its crate, against the development bundle,
// seen through the command's result, the panel's report and the output channel, one test per automated
// criterion: AC1 to AC6 and AC8 to AC10, and R8. AC7 is feature 003's suites, unchanged.
import * as assert from 'assert';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import type { AnalysisOutput, AnalyzeResult } from '../../analysis/types';
import type { AquascopeApi } from '../../extension';
import type { PanelReport } from '../../visualization/panel';
import { fixtureProject, folderSnapshot, requireToolchain } from './harness';

const EXTENSION_ID = 'psyquy.aquascope-vscode-extension';
const COMMAND = 'aquascope.analyzeAtCursor';

/** The zero-based line of the first line of `file` that contains `text`. */
function lineOf(file: string, text: string): number {
  const index = readFileSync(file, 'utf8').split('\n').findIndex((l) => l.includes(text));
  assert.ok(index >= 0, `no "${text}" in ${file}`);
  return index;
}

async function runAt(editor: vscode.TextEditor, line: number, character: number): Promise<AnalyzeResult> {
  editor.selection = new vscode.Selection(line, character, line, character);
  return (await vscode.commands.executeCommand<AnalyzeResult>(COMMAND)) as AnalyzeResult;
}

async function analyzeAt(file: string, line: number, character: number): Promise<AnalyzeResult> {
  return runAt(await vscode.window.showTextDocument(vscode.Uri.file(file), { viewColumn: vscode.ViewColumn.One }), line, character);
}

/** Runs the command's Analyze This File Alone action on an open file (D8). */
async function analyzeAlone(file: string): Promise<AnalyzeResult> {
  return (await vscode.commands.executeCommand<AnalyzeResult>(COMMAND, vscode.Uri.file(file), { alone: true })) as AnalyzeResult;
}

function failedWith(result: AnalyzeResult, code: string): Extract<AnalyzeResult, { kind: 'error' }> {
  assert.ok(result.kind === 'error' && result.code === code, JSON.stringify(result));
  return result as Extract<AnalyzeResult, { kind: 'error' }>;
}

function ok(result: AnalyzeResult): AnalysisOutput {
  assert.strictEqual(result.kind, 'ok', JSON.stringify(result));
  return (result as Extract<AnalyzeResult, { kind: 'ok' }>).output;
}

suite('feature 008 acceptance criteria, end to end', function () {
  this.timeout(120_000); // the first run on a project builds its dependencies
  let api: AquascopeApi;
  let projectsBefore: Record<string, string>;

  suiteSetup(async function () {
    const bundle = requireToolchain(this);
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

  test("AC1: a module's function that uses items from lib.rs is drawn, with its markers in the module's file", async () => {
    const config = fixtureProject('minigrep', 'src', 'config.rs');
    // `parse` uses `crate::Case` from lib.rs, so it builds only as part of its crate.
    const output = ok(await analyzeAt(config, lineOf(config, 'let mut args'), 8));
    assert.strictEqual(output.file_path, 'src/config.rs');
    assert.strictEqual(output.body_range.start.line, lineOf(config, 'pub fn parse'));
    assert.ok(output.boundaries.length > 0, 'expected permission markers');
    const { start, end } = output.body_range;
    assert.ok(output.boundaries.every((b) => b.location.line >= start.line && b.location.line <= end.line), 'every marker is in the function');

    const report = (await api.latestPanelReport()) as Extract<PanelReport, { type: 'rendered' }>;
    assert.strictEqual(report.type, 'rendered', JSON.stringify(report));
    assert.deepStrictEqual(report.problems, []);
    const parseLines = readFileSync(config, 'utf8').split('\n').slice(start.line, end.line + 1).join('\n');
    assert.strictEqual(report.code, parseLines, "the panel shows parse's lines of config.rs");
    assert.ok(report.boundaryMarkers > 0);
    assert.match(api.recentOutput(), /crate minigrep, lib target minigrep; src\/config\.rs in /);
    assert.match(api.recentOutput(), /aquascope --crate-of \S+\/src\/config\.rs permissions/);

    const describe = ok(await analyzeAt(config, lineOf(config, 'let mut text'), 8));
    assert.ok(describe.steps.length > 0, 'a function without early returns also gets its steps');
  });

  test('AC2: a function using a crates.io dependency, vendored in the fixture, is analysed offline', async () => {
    const lib = fixtureProject('with-dep', 'src', 'lib.rs');
    const output = ok(await analyzeAt(lib, lineOf(lib, 'itoa::Buffer::new()'), 8));
    assert.strictEqual(output.file_path, 'src/lib.rs');
    assert.ok(output.steps.length > 0);
  });

  test('AC3: a function in one workspace member that uses another member is analysed', async () => {
    const app = fixtureProject('workspace', 'app', 'src', 'lib.rs');
    const output = ok(await analyzeAt(app, lineOf(app, 'Inventory::new()'), 8));
    assert.strictEqual(output.file_path, 'app/src/lib.rs');
    assert.strictEqual(output.body_range.start.line, lineOf(app, 'pub fn stock'));
  });

  test('AC9: an unsaved edit in a module file is analysed, and the file on disk is unchanged', async () => {
    const config = fixtureProject('minigrep', 'src', 'config.rs');
    const onDisk = readFileSync(config, 'utf8');
    const editor = await vscode.window.showTextDocument(vscode.Uri.file(config), { viewColumn: vscode.ViewColumn.One });
    try {
      const line = lineOf(config, 'let mut text');
      const saved = ok(await runAt(editor, line, 8)).body_range;
      await editor.edit((e) => e.insert(new vscode.Position(0, 0), '// an unsaved line\n'));
      assert.ok(editor.document.isDirty);
      const edited = ok(await runAt(editor, line + 1, 8)).body_range;
      assert.strictEqual(edited.start.line, saved.start.line + 1, 'the analysis saw the inserted line');
      assert.strictEqual(readFileSync(config, 'utf8'), onDisk, 'the file on disk is unchanged');
    } finally {
      await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
    }
    // Reverted, the copy is restored from disk.
    const restored = ok(await analyzeAt(config, lineOf(config, 'let mut text'), 8)).body_range;
    assert.strictEqual(restored.start.line, lineOf(config, 'pub fn describe'));
  });

  test('AC5: a dependency in no cache is named with cargo fetch, nothing is downloaded, and the file alone is offered', async () => {
    const lib = fixtureProject('missing-dep', 'src', 'lib.rs');
    const result = failedWith(await analyzeAt(lib, lineOf(lib, 'let a = 40'), 8), 'dependencyMissing');
    assert.match(result.message, /`aquascope-test-missing-crate`/);
    assert.match(result.message, /`cargo fetch` in the project/);
    assert.strictEqual(result.offersFileAlone, true);
    assert.doesNotMatch(api.recentOutput(), /Downloading|Downloaded|Updating crates\.io index/);

    const alone = ok(await analyzeAlone(lib));
    assert.strictEqual(alone.body_range.start.line, lineOf(lib, 'pub fn answer'), 'the offered action analyses the file alone');
  });

  test("AC6: with no linker on PATH, a function using a workspace proc macro's output gets the linker message", async () => {
    // A fresh copy, so that no earlier run has built the macro, and a PATH without /usr/bin, where cc is.
    const tmp = mkdtempSync(path.join(os.tmpdir(), 'aquascope-proc-macro-'));
    cpSync(fixtureProject('proc-macro'), tmp, { recursive: true });
    const lib = path.join(tmp, 'app', 'src', 'lib.rs');
    const userPath = process.env.PATH;
    process.env.PATH = '/bin';
    try {
      const result = failedWith(await analyzeAt(lib, lineOf(lib, 'let greeting'), 8), 'linkerMissing');
      assert.match(result.message, /need a system linker, and `cc` was not found/);
      assert.strictEqual(result.offersFileAlone, true);
      // The crate imports the macro with `use`, so without it no function of the crate is analysed: the run exits
      // 0 with no results, and stderr names the linker (T-049).
      failedWith(await analyzeAt(lib, lineOf(lib, 'let loud'), 8), 'linkerMissing');
    } finally {
      process.env.PATH = userPath;
      await vscode.commands.executeCommand('workbench.action.closeAllEditors');
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('AC10: a function of an integration test is analysed, and build.rs gets the message that it cannot be', async () => {
    const it = fixtureProject('targets', 'tests', 'it.rs');
    assert.strictEqual(ok(await analyzeAt(it, lineOf(it, 'let once'), 8)).file_path, 'tests/it.rs');

    const build = fixtureProject('targets', 'build.rs');
    const result = failedWith(await analyzeAt(build, lineOf(build, 'let message'), 8), 'unsupportedTarget');
    assert.match(result.message, /cannot analyse a build script/);
    assert.strictEqual(result.offersFileAlone, true);
    ok(await analyzeAlone(build));
  });

  test("R8: a function that fails to build is explained with the compile errors' files and lines; other files still work", async () => {
    const lib = fixtureProject('minigrep', 'src', 'lib.rs');
    const editor = await vscode.window.showTextDocument(vscode.Uri.file(lib), { viewColumn: vscode.ViewColumn.One });
    try {
      const line = lineOf(lib, 'found.into_iter()');
      const text = editor.document.lineAt(line).text;
      await editor.edit((e) => e.replace(new vscode.Range(line, 0, line, text.length), text.replace('.collect()', '.missing_method()')));
      const result = failedWith(await runAt(editor, line, 8), 'compileErrors');
      assert.match(result.message, new RegExp(`the crate has compile errors, in src/lib\\.rs line ${line + 1}\\.`));
      assert.strictEqual(result.offersFileAlone, true);

      const config = fixtureProject('minigrep', 'src', 'config.rs');
      ok(await analyzeAt(config, lineOf(config, 'let mut text'), 8));
    } finally {
      await vscode.window.showTextDocument(vscode.Uri.file(lib), { viewColumn: vscode.ViewColumn.One });
      await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
    }
  });

  test('AC8: a second run on a crate takes under 10 seconds', async () => {
    const config = fixtureProject('minigrep', 'src', 'config.rs');
    ok(await analyzeAt(config, lineOf(config, 'let mut text'), 8));
    const started = Date.now();
    ok(await analyzeAt(config, lineOf(config, 'let mut args'), 8));
    const ms = Date.now() - started;
    assert.ok(ms < 10_000, `the second run took ${ms} ms`);
    console.log(`      second run: ${ms} ms`);
  });

  test('AC4: after every run above, the fixture projects are unchanged, with no Cargo.lock or target/ written', () => {
    const after = folderSnapshot(fixtureProject());
    assert.ok(!Object.keys(after).some((f) => f.split(path.sep).includes('target')), 'no build folder in the projects');
    assert.deepStrictEqual(after, projectsBefore);
  });
});
