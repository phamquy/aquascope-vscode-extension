import * as assert from 'assert';
import * as vscode from 'vscode';
import { selectAtCursor } from '../../analysis/select';
import type { AnalysisOutput } from '../../analysis/types';
import { PanelReport, VIEW_TYPE, VisualizationPanel } from '../../visualization/panel';
import { fixture, fixtureData, fixtureText } from './harness';

const EXTENSION_ID = 'jackpham.aquascope-vscode-extension';
const FILE = '05_method_mut_borrow';

function resultAt(line: number, character: number): AnalysisOutput {
  const s = selectAtCursor(fixtureData(`${FILE}.json`), fixtureText(`${FILE}.rs`), { line, character });
  assert.ok(s.kind === 'selected');
  return s.output;
}

/** The Aquascope panels open in any editor group, with the group each is in. */
function panelTabs(): { tab: vscode.Tab; group: vscode.TabGroup }[] {
  return vscode.window.tabGroups.all.flatMap((group) =>
    group.tabs.filter((tab) => tab.input instanceof vscode.TabInputWebview && tab.input.viewType.endsWith(VIEW_TYPE)).map((tab) => ({ tab, group })),
  );
}

suite('Aquascope panel (004 R1, R4, R5)', function () {
  this.timeout(30_000);
  let panel: VisualizationPanel;
  let editor: vscode.TextEditor;
  const source = fixtureText(`${FILE}.rs`);

  setup(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    panel = new VisualizationPanel(ext.extensionUri);
    editor = await vscode.window.showTextDocument(fixture(`${FILE}.rs`), { viewColumn: vscode.ViewColumn.One });
  });
  teardown(async () => {
    panel.dispose();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('opens one panel beside the editor, titled with the lines, without taking focus', async () => {
    panel.showAnalysis(resultAt(18, 4), source);
    const report = await panel.latestReport();
    assert.strictEqual(report.type, 'rendered', JSON.stringify(report));
    assert.ok(report.type === 'rendered' && report.code.startsWith('fn main() {'));
    const tabs = panelTabs();
    assert.strictEqual(tabs.length, 1);
    assert.strictEqual(tabs[0].tab.label, 'Aquascope: lines 17–21');
    assert.notStrictEqual(tabs[0].group.viewColumn, vscode.ViewColumn.One, 'beside the editor');
    assert.strictEqual(vscode.window.activeTextEditor?.document, editor.document, 'focus stays in the editor');
  });

  test('updates the same panel in place, still without taking focus', async () => {
    panel.showAnalysis(resultAt(18, 4), source);
    const first = await panel.latestReport();
    panel.showAnalysis(resultAt(8, 8), source);
    const second = await panel.latestReport();
    assert.ok(second.renderId > first.renderId);
    assert.ok(second.type === 'rendered' && second.code.startsWith('    fn grow('), JSON.stringify(second));
    const tabs = panelTabs();
    assert.strictEqual(tabs.length, 1);
    assert.strictEqual(tabs[0].tab.label, 'Aquascope: lines 8–11');
    assert.strictEqual(vscode.window.activeTextEditor?.document, editor.document);
  });

  test('replaces the diagram with a message', async () => {
    panel.showAnalysis(resultAt(18, 4), source);
    await panel.latestReport();
    panel.showMessage('There is no function at the cursor.');
    const report: PanelReport = await panel.latestReport();
    assert.strictEqual(report.type, 'message');
    assert.ok(report.type === 'message' && report.text === 'There is no function at the cursor.');
    assert.deepStrictEqual(report.problems, []);
    assert.strictEqual(panelTabs()[0].tab.label, 'Aquascope');
  });

  test('never opens a closed panel for a message, but opens a new one for the next analysis', async () => {
    panel.showMessage('nothing to replace');
    assert.strictEqual(panel.isOpen, false);
    assert.strictEqual(panelTabs().length, 0);
    panel.showAnalysis(resultAt(18, 4), source);
    await panel.latestReport();
    await vscode.window.tabGroups.close(panelTabs()[0].tab);
    assert.strictEqual(panel.isOpen, false, 'closing the tab disposes the panel');
    panel.showMessage('still nothing to replace');
    assert.strictEqual(panelTabs().length, 0);
    panel.showAnalysis(resultAt(8, 8), source);
    const report = await panel.latestReport();
    assert.ok(report.type === 'rendered');
    assert.strictEqual(panelTabs().length, 1);
  });
});
