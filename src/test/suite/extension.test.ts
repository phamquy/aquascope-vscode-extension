import * as assert from 'assert';
import * as vscode from 'vscode';

const EXTENSION_ID = 'jackpham.aquascope-vscode-extension';

suite('extension', () => {
  suiteSetup(async () => {
    const ext = vscode.extensions.getExtension(EXTENSION_ID);
    assert.ok(ext, `extension ${EXTENSION_ID} not found`);
    await ext.activate();
  });

  test('registers aquascope.hello', async () => {
    const cmds = await vscode.commands.getCommands(true);
    assert.ok(cmds.includes('aquascope.hello'));
  });

  test('aquascope.hello runs without error', async () => {
    await vscode.commands.executeCommand('aquascope.hello');
  });
});
