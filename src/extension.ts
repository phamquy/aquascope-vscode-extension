import * as vscode from 'vscode';
import { analyzeAtCursor } from './analysis/command';

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('aquascope.hello', () => {
      void vscode.window.showInformationMessage('Hello from Aquascope');
    }),
    vscode.commands.registerCommand('aquascope.analyzeAtCursor', () => analyzeAtCursor(context)),
  );
}

export function deactivate(): void {}
