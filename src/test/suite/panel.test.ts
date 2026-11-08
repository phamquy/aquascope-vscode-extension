import * as assert from 'assert';
import * as vscode from 'vscode';
import { selectAtCursor } from '../../analysis/select';
import type { AnalysisOutput } from '../../analysis/types';
import { PanelReport, VIEW_TYPE, VisualizationPanel } from '../../visualization/panel';
import { STEP_LIMIT, TRACE_TITLE } from '../../visualization/traceInput';
import { capturedTrace, fixture, fixtureData, fixtureText, longTrace } from './harness';

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

suite('Aquascope panel drawing traces (feature 007 R4, R8, D5)', function () {
  this.timeout(30_000);
  let panel: VisualizationPanel;
  let editor: vscode.TextEditor;

  /** The latest report, which must be a trace drawn without problems. */
  async function traceReport(): Promise<Extract<PanelReport, { type: 'trace' }>> {
    const report = await panel.latestReport();
    assert.strictEqual(report.type, 'trace', JSON.stringify(report));
    assert.deepStrictEqual(report.problems, [], 'no policy violation or script error');
    return report as Extract<PanelReport, { type: 'trace' }>;
  }

  setup(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext);
    panel = new VisualizationPanel(ext.extensionUri);
    editor = await vscode.window.showTextDocument(fixture('01_move_string.rs'), { viewColumn: vscode.ViewColumn.One });
  });
  teardown(async () => {
    panel.dispose();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  test('draws a memory diagram and a code marker for every step, in the one panel the permissions view used', async () => {
    panel.showAnalysis(resultAt(18, 4), fixtureText(`${FILE}.rs`));
    await panel.latestReport();
    const source = fixtureText('01_move_string.rs');
    panel.showTrace(capturedTrace('01_move_string'), source);
    const report = await traceReport();
    assert.strictEqual(report.code, source.replace(/\r$/gm, ''));
    assert.deepStrictEqual([report.steps, report.markers, report.failed], [4, 4, 0]);
    assert.deepStrictEqual(report.notes, []);
    const tabs = panelTabs();
    assert.strictEqual(tabs.length, 1, 'the trace replaced the permissions view (D5)');
    assert.strictEqual(tabs[0].tab.label, TRACE_TITLE);
    assert.strictEqual(vscode.window.activeTextEditor?.document, editor.document, 'focus stays in the editor');
  });

  test('draws a run with calls into methods, and one with an emoji on a line', async () => {
    panel.showTrace(capturedTrace('05_method_mut_borrow'), fixtureText('05_method_mut_borrow.rs'));
    const calls = await traceReport();
    assert.deepStrictEqual([calls.steps, calls.markers], [11, 11]);
    panel.showTrace(capturedTrace('n1_non_ascii'), fixtureText('n1_non_ascii.rs'));
    const report = await traceReport();
    assert.deepStrictEqual([report.steps, report.markers], [5, 5]);
  });

  test('marks the last step of a run that reached undefined behaviour as failed, and names it', async () => {
    panel.showTrace(capturedTrace('i4_use_after_free'), fixtureText('i4_use_after_free.rs'));
    const report = await traceReport();
    assert.deepStrictEqual([report.steps, report.markers, report.failed], [4, 4, 1]);
    assert.strictEqual(report.notes.length, 1);
    assert.match(report.notes[0], /used after the memory it points to was freed/);
  });

  test(`draws only the first ${STEP_LIMIT} steps of a longer run and says so (R8)`, async () => {
    panel.showTrace(longTrace(150), fixtureText('05_method_mut_borrow.rs'));
    const report = await traceReport();
    assert.deepStrictEqual([report.steps, report.markers, report.failed], [STEP_LIMIT, STEP_LIMIT, 0]);
    assert.match(report.notes[0] ?? '', /^Showing the first 100 of 150 steps\./);
  });

  test('a message replaces the trace', async () => {
    panel.showTrace(capturedTrace('01_move_string'), fixtureText('01_move_string.rs'));
    await traceReport();
    panel.showMessage('The program stopped while running.');
    const report = await panel.latestReport();
    assert.ok(report.type === 'message' && report.text === 'The program stopped while running.', JSON.stringify(report));
  });
});
