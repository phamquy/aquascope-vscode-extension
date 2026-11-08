import * as assert from 'assert';
import * as path from 'path';
import { readFileSync } from 'fs';
import * as vscode from 'vscode';
import type { AnalyzeResult } from '../../analysis/types';

const EXTENSION_ID = 'jackpham.aquascope-vscode-extension';
const COMMAND = 'aquascope.analyzeAtCursor';
const SETTINGS = ['aquascope.toolchainPath', 'aquascope.analysisTimeoutSeconds'];

interface Contributes {
  commands: { command: string; title: string; icon?: string }[];
  menus: Record<'commandPalette' | 'editor/title', { command: string; when?: string; group?: string }[]>;
  configuration: { properties: Record<string, { default: unknown; scope?: string; markdownDescription?: string }> };
}

suite('analyze command contributions (R1, R14)', () => {
  let ext: vscode.Extension<unknown>;
  let contributes: Contributes;

  suiteSetup(async () => {
    const found = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(found, `extension ${EXTENSION_ID} not found`);
    ext = found;
    contributes = ext.packageJSON.contributes as Contributes;
    await ext.activate();
  });

  test('declares the command, shown in the palette for Rust files only', () => {
    const command = contributes.commands.find((c) => c.command === COMMAND);
    assert.strictEqual(command?.title, 'Aquascope: Analyze Function at Cursor');
    const palette = contributes.menus.commandPalette.find((m) => m.command === COMMAND);
    assert.strictEqual(palette?.when, 'editorLangId == rust');
  });

  test('feature 007 R1: declares Show Stack and Heap in the palette for Rust files only, with no title-bar button (D1)', async () => {
    const id = 'aquascope.showStackAndHeap';
    assert.strictEqual(contributes.commands.find((c) => c.command === id)?.title, 'Aquascope: Show Stack and Heap');
    assert.strictEqual(contributes.menus.commandPalette.find((m) => m.command === id)?.when, 'editorLangId == rust');
    assert.ok(!contributes.menus['editor/title'].some((m) => m.command === id));
    assert.ok((await vscode.commands.getCommands(true)).includes(id));
  });

  test('feature 006 AC1: puts the command beside Split Editor, above Rust files only, with an icon', () => {
    const command = contributes.commands.find((c) => c.command === COMMAND);
    assert.strictEqual(command?.icon, '$(eye)');
    const entries = contributes.menus['editor/title'].filter((m) => m.command === COMMAND);
    // `navigation` draws it as an icon in the title bar; `resourceLangId` follows each group's own editor,
    // so it still shows while the Aquascope panel has focus (spec 006 R2).
    assert.deepStrictEqual(entries, [{ command: COMMAND, when: 'resourceLangId == rust', group: 'navigation' }]);
  });

  test('registers the command', async () => {
    assert.ok((await vscode.commands.getCommands(true)).includes(COMMAND));
  });

  test('declares both settings with descriptions and defaults', () => {
    const props = contributes.configuration.properties;
    for (const key of SETTINGS) assert.ok(props[key]?.markdownDescription, `${key} has no description`);
    assert.strictEqual(props['aquascope.toolchainPath'].default, '');
    assert.strictEqual(props['aquascope.toolchainPath'].scope, 'machine');
    assert.strictEqual(vscode.workspace.getConfiguration('aquascope').get('analysisTimeoutSeconds'), 60);
  });

  test('documents both settings in the README', () => {
    const readme = readFileSync(path.join(ext.extensionPath, 'README.md'), 'utf8');
    for (const key of SETTINGS) assert.ok(readme.includes(`\`${key}\``), `README does not mention ${key}`);
  });

  test('feature 007 R7: documents Show Stack and Heap and its limits in the README', () => {
    const readme = readFileSync(path.join(ext.extensionPath, 'README.md'), 'utf8');
    assert.ok(readme.includes('**Aquascope: Show Stack and Heap**'));
    for (const limit of ['`main`', 'first 100 steps', 'reads input', 'never ends', 'borrow checking']) {
      assert.ok(readme.includes(limit), `README does not mention ${limit}`);
    }
  });

  test('without a Rust editor, says so instead of running', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const result = await vscode.commands.executeCommand<AnalyzeResult>(COMMAND);
    assert.deepStrictEqual(result.kind === 'error' && result.code, 'noRustEditor');
  });
});
