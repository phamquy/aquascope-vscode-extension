import * as vscode from 'vscode';
import { analyzeAtCursor, showStackAndHeap } from './analysis/command';
import { outputChannel, recentOutput } from './analysis/runner';
import { startFocusRecord } from './analysis/target';
import { PanelReport, VisualizationPanel } from './visualization/panel';

/** What `activate` returns: a way for the integration tests to see what the panel drew (004 R10) and logged. */
export interface AquascopeApi {
  latestPanelReport(): Promise<PanelReport>;
  isPanelOpen(): boolean;
  /** The Aquascope output channel's latest lines (feature 007 AC4). */
  recentOutput(): string;
}

export function activate(context: vscode.ExtensionContext): AquascopeApi {
  const panel = new VisualizationPanel(context.extensionUri, (line) => outputChannel().appendLine(line));
  context.subscriptions.push(
    panel,
    vscode.commands.registerCommand('aquascope.hello', () => {
      void vscode.window.showInformationMessage('Hello from Aquascope');
    }),
    // The editor title bar passes its document's URI (feature 006 R3); the palette and keybindings pass nothing.
    vscode.commands.registerCommand('aquascope.analyzeAtCursor', (target?: unknown, options?: unknown) =>
      analyzeAtCursor(context, panel, target instanceof vscode.Uri ? target : undefined, {
        alone: typeof options === 'object' && options !== null && (options as { alone?: unknown }).alone === true,
      }),
    ),
    // Feature 007: the program run in Aquascope's interpreter; the palette passes no argument (D1).
    vscode.commands.registerCommand('aquascope.showStackAndHeap', () => showStackAndHeap(context, panel)),
    startFocusRecord(),
  );
  return { latestPanelReport: () => panel.latestReport(), isPanelOpen: () => panel.isOpen, recentOutput };
}

export function deactivate(): void {}
