import * as vscode from 'vscode';
import { analyzeAtCursor } from './analysis/command';
import { outputChannel } from './analysis/runner';
import { PanelReport, VisualizationPanel } from './visualization/panel';

/** What `activate` returns: a way for the integration tests to see what the panel drew (004 R10). */
export interface AquascopeApi {
  latestPanelReport(): Promise<PanelReport>;
  isPanelOpen(): boolean;
}

export function activate(context: vscode.ExtensionContext): AquascopeApi {
  const panel = new VisualizationPanel(context.extensionUri, (line) => outputChannel().appendLine(line));
  context.subscriptions.push(
    panel,
    vscode.commands.registerCommand('aquascope.hello', () => {
      void vscode.window.showInformationMessage('Hello from Aquascope');
    }),
    vscode.commands.registerCommand('aquascope.analyzeAtCursor', () => analyzeAtCursor(context, panel)),
  );
  return { latestPanelReport: () => panel.latestReport(), isPanelOpen: () => panel.isOpen };
}

export function deactivate(): void {}
