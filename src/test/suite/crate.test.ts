// Feature 008 end to end: a function analysed with the rest of its crate, against the development bundle,
// seen through the command's result, the panel's report and the output channel (T-048: AC1 to AC3, AC9).
import * as assert from 'assert';
import { readFileSync } from 'fs';
import * as vscode from 'vscode';
import type { AnalysisOutput, AnalyzeResult } from '../../analysis/types';
import type { AquascopeApi } from '../../extension';
import type { PanelReport } from '../../visualization/panel';
import { fixtureProject, requireToolchain } from './harness';

const EXTENSION_ID = 'jackpham.aquascope-vscode-extension';
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

function ok(result: AnalyzeResult): AnalysisOutput {
  assert.strictEqual(result.kind, 'ok', JSON.stringify(result));
  return (result as Extract<AnalyzeResult, { kind: 'ok' }>).output;
}

suite('feature 008 acceptance criteria, end to end', function () {
  this.timeout(120_000); // the first run on a project builds its dependencies
  let api: AquascopeApi;

  suiteSetup(async function () {
    const bundle = requireToolchain(this);
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
});
