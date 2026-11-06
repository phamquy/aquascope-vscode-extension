import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('aquascope.hello', () => {
      void vscode.window.showInformationMessage('Hello from Aquascope');
    }),
  );
}

export function deactivate(): void {}
