import * as vscode from 'vscode';
import { analyzeAtCursor, showStackAndHeap } from './analysis/command';
import { outputChannel } from './analysis/runner';
import { startFocusRecord } from './analysis/target';
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
    // The editor title bar passes its document's URI (feature 006 R3); the palette and keybindings pass nothing.
    vscode.commands.registerCommand('aquascope.analyzeAtCursor', (target?: unknown) =>
      analyzeAtCursor(context, panel, target instanceof vscode.Uri ? target : undefined),
    ),
    // Feature 007: the program run in Aquascope's interpreter; the palette passes no argument (D1).
    vscode.commands.registerCommand('aquascope.showStackAndHeap', () => showStackAndHeap(context, panel)),
    startFocusRecord(),
  );
  return { latestPanelReport: () => panel.latestReport(), isPanelOpen: () => panel.isOpen };
}

export function deactivate(): void {}
