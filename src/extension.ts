import * as vscode from 'vscode';
import { analyzeAtCursor, showStackAndHeap, type StackHeapOptions } from './analysis/command';
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
    // Feature 007: the program run in Aquascope's interpreter; the palette passes no argument (D1). A caller,
    // such as the tests, may give the binary, the arguments or a run of the file alone (feature 009).
    vscode.commands.registerCommand('aquascope.showStackAndHeap', (options?: unknown) =>
      showStackAndHeap(context, panel, stackHeapOptions(options)),
    ),
    startFocusRecord(),
  );
  return { latestPanelReport: () => panel.latestReport(), isPanelOpen: () => panel.isOpen, recentOutput };
}

/** The options a caller passed to Show Stack and Heap, keeping only well-formed ones. */
function stackHeapOptions(value: unknown): StackHeapOptions {
  if (typeof value !== 'object' || value === null) return {};
  const { binary, arguments: args, alone } = value as Record<string, unknown>;
  return {
    ...(typeof binary === 'string' ? { binary } : {}),
    ...(Array.isArray(args) && args.every((a) => typeof a === 'string') ? { arguments: args as string[] } : {}),
    ...(alone === true ? { alone } : {}),
  };
}

export function deactivate(): void {}
