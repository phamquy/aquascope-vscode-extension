// Feature 004 end to end: the command against the development bundle, seen through the panel's
// reports (R10), one test per automated acceptance criterion (AC11).
import * as assert from 'assert';
import * as vscode from 'vscode';
import type { AnalyzeResult } from '../../analysis/types';
import type { AquascopeApi } from '../../extension';
import type { PanelReport } from '../../visualization/panel';
import { VIEW_TYPE } from '../../visualization/panel';
import { fixture, fixtureText, requireToolchain } from './harness';

const EXTENSION_ID = 'jackpham.aquascope-vscode-extension';
const COMMAND = 'aquascope.analyzeAtCursor';
const FILE = '05_method_mut_borrow.rs';
const lines = (from: number, to: number) => fixtureText(FILE).split('\n').slice(from, to + 1).join('\n');

async function editorFor(file: string): Promise<vscode.TextEditor> {
  return vscode.window.showTextDocument(fixture(file), { viewColumn: vscode.ViewColumn.One });
}

async function runAt(editor: vscode.TextEditor, line: number, character: number): Promise<AnalyzeResult> {
  editor.selection = new vscode.Selection(line, character, line, character);
  return (await vscode.commands.executeCommand<AnalyzeResult>(COMMAND)) as AnalyzeResult;
}

/** The Aquascope panels open in any editor group, with the group each is in. */
function panelTabs(): { tab: vscode.Tab; group: vscode.TabGroup }[] {
  return vscode.window.tabGroups.all.flatMap((group) =>
    group.tabs.filter((tab) => tab.input instanceof vscode.TabInputWebview && tab.input.viewType.endsWith(VIEW_TYPE)).map((tab) => ({ tab, group })),
  );
}

function rendered(report: PanelReport): Extract<PanelReport, { type: 'rendered' }> {
  assert.strictEqual(report.type, 'rendered', JSON.stringify(report));
  assert.deepStrictEqual(report.problems, []);
  return report as Extract<PanelReport, { type: 'rendered' }>;
}

function setToolchainPath(value: string | undefined): Thenable<void> {
  return vscode.workspace.getConfiguration('aquascope').update('toolchainPath', value, vscode.ConfigurationTarget.Global);
}

suite('feature 004 acceptance criteria, end to end', function () {
  this.timeout(60_000);
  let api: AquascopeApi;

  suiteSetup(async function () {
    const bundle = requireToolchain(this);
    await setToolchainPath(bundle);
    const ext = vscode.extensions.getExtension<AquascopeApi>(EXTENSION_ID);
    assert.ok(ext);
    api = await ext.activate();
  });
  setup(() => vscode.commands.executeCommand('workbench.action.closeAllEditors'));
  suiteTeardown(async () => {
    await setToolchainPath(undefined);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('AC1: draws main in one panel beside the editor, without taking focus', async () => {
    const editor = await editorFor(FILE);
    const result = await runAt(editor, 18, 4);
    assert.ok(result.kind === 'ok', JSON.stringify(result));
    assert.deepStrictEqual(result.output.body_range.start, { line: 16, column: 0 }, 'the command still returns the 003 result');
    const report = rendered(await api.latestPanelReport());
    assert.strictEqual(report.code, lines(16, 20));
    assert.strictEqual(report.stepWidgets, result.output.steps.length);
    assert.strictEqual(report.boundaryMarkers, new Set(result.output.boundaries.map((b) => `${b.location.line}:${b.location.column}`)).size);
    const tabs = panelTabs();
    assert.strictEqual(tabs.length, 1);
    assert.strictEqual(tabs[0].tab.label, 'Aquascope: lines 17–21');
    assert.notStrictEqual(tabs[0].group.viewColumn, vscode.ViewColumn.One, 'beside the editor');
    assert.strictEqual(vscode.window.activeTextEditor?.document, editor.document, 'focus stays in the Rust file');
  });

  test('AC2: a second run updates the same panel; after closing it, the next run opens a new one', async () => {
    const editor = await editorFor(FILE);
    await runAt(editor, 18, 4);
    await api.latestPanelReport();
    const result = await runAt(editor, 8, 8);
    assert.ok(result.kind === 'ok', JSON.stringify(result));
    assert.strictEqual(rendered(await api.latestPanelReport()).code, lines(7, 10));
    assert.strictEqual(panelTabs().length, 1);
    assert.strictEqual(panelTabs()[0].tab.label, 'Aquascope: lines 8–11');

    await vscode.window.tabGroups.close(panelTabs()[0].tab);
    assert.strictEqual(api.isPanelOpen(), false);
    await runAt(editor, 12, 8); // `area`
    assert.strictEqual(rendered(await api.latestPanelReport()).code, lines(11, 13));
    assert.strictEqual(panelTabs().length, 1);
    assert.strictEqual(panelTabs()[0].tab.label, 'Aquascope: lines 12–14');
  });

  test('AC3: a run outside every function replaces the diagram with the no-function message', async () => {
    const editor = await editorFor(FILE);
    await runAt(editor, 8, 8);
    rendered(await api.latestPanelReport());
    const result = await runAt(editor, 2, 4); // the `struct` line
    assert.ok(result.kind === 'error' && result.code === 'noFunction', JSON.stringify(result));
    const report = await api.latestPanelReport();
    assert.ok(report.type === 'message', 'no diagram is left in the panel');
    assert.strictEqual(report.text, result.message);
    assert.match(report.text, /no function at the cursor/);
  });

  test('AC5: draws the unsaved text in the editor', async () => {
    const editor = await editorFor(FILE);
    try {
      await editor.edit((e) => e.insert(new vscode.Position(17, 0), '    let unsaved = 0;\n'));
      assert.ok(editor.document.isDirty);
      await runAt(editor, 18, 4);
      const report = rendered(await api.latestPanelReport());
      assert.ok(report.code.includes('let unsaved = 0;'), report.code);
      assert.strictEqual(report.code.split('\n').length, 6);
      assert.strictEqual(panelTabs()[0].tab.label, 'Aquascope: lines 17–22');
    } finally {
      await vscode.window.showTextDocument(editor.document, vscode.ViewColumn.One);
      await vscode.commands.executeCommand('workbench.action.revertAndCloseActiveEditor');
    }
  });

  test('AC7 (automated part): a run with no Rust editor active leaves the panel as it was', async () => {
    const editor = await editorFor(FILE);
    await runAt(editor, 18, 4);
    const before = rendered(await api.latestPanelReport());
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
