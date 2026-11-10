// The single Aquascope panel (feature 004, R1, R4, R5, R10), shared by the stack-and-heap view (feature 007, D5).
import * as vscode from 'vscode';
import type { AnalysisOutput, CharRange, MTrace } from '../analysis/types';
import { embedInput } from './embedInput';
import { STEP_LIMIT, traceInput } from './traceInput';
import { PageContent, pageResources, panelPage } from './page';

export const VIEW_TYPE = 'aquascope.visualization';

/** What the page reports once it has drawn (R10); posted by `media/panel.js`. */
export type PanelReport =
  | { type: 'rendered'; renderId: number; code: string; stepWidgets: number; boundaryMarkers: number; theme: 'light' | 'dark'; problems: string[] }
  /** A trace: memory diagrams drawn, step markers in the code, failed markers, and the notes shown (feature 007). */
  | { type: 'trace'; renderId: number; code: string; steps: number; markers: number; failed: number; notes: string[]; theme: 'light' | 'dark'; problems: string[] }
  | { type: 'message'; renderId: number; text: string; theme: 'light' | 'dark'; problems: string[] };

/**
 * Owns at most one webview panel. The extension holds one instance; tests create their own. The first
 * analysis opens the panel beside the active editor, later ones update it where it is, and neither
 * takes focus from the editor.
 */
export class VisualizationPanel implements vscode.Disposable {
  private panel: vscode.WebviewPanel | undefined;
  private renderId = 0;
  private report: PanelReport | undefined;
  private waiting: ((report: PanelReport) => void)[] = [];

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly log: (line: string) => void = () => undefined,
  ) {}

  /** Draws an analysis of `source`, opening the panel if it is closed (R1, R4). */
  showAnalysis(output: AnalysisOutput, source: string): void {
    const input = embedInput(output, source);
    if (input.dropped.length > 0) this.log(`  left out of the diagram, outside the function's lines: ${input.dropped.join(', ')}`);
    this.show(input.title, { kind: 'analysis', input }, true);
  }

  /**
   * Draws a program's trace in the same panel, replacing whichever view it showed, and opening it if it is
   * closed (feature 007 R4, D5). At most `STEP_LIMIT` steps are drawn, with a note saying so (R8).
   */
  showTrace(trace: MTrace<CharRange>, source: string, file?: string): void {
    const input = traceInput(trace, source, STEP_LIMIT, file);
    this.show(input.title, { kind: 'trace', input }, true);
  }

  /** Replaces the diagram with a message, if the panel is open; never opens it (R5). */
  showMessage(text: string): void {
    this.show('Aquascope', { kind: 'message', text }, false);
  }

  get isOpen(): boolean {
    return this.panel !== undefined;
  }

  /** The page's report for the latest content, waiting for it if it has not arrived yet (R10). */
  latestReport(): Promise<PanelReport> {
    if (this.report && this.report.renderId === this.renderId) return Promise.resolve(this.report);
    return new Promise((resolve) => this.waiting.push(resolve));
  }

  dispose(): void {
    this.panel?.dispose();
  }

  private show(title: string, content: PageContent, open: boolean): void {
    if (!this.panel) {
      if (!open) return;
      this.panel = vscode.window.createWebviewPanel(
        VIEW_TYPE,
        title,
        { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
        { enableScripts: true, localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')] },
      );
      this.panel.onDidDispose(() => (this.panel = undefined));
      this.panel.webview.onDidReceiveMessage((report: PanelReport) => this.received(report));
    } else {
      this.panel.reveal(undefined, true);
    }
    this.panel.title = title;
    this.renderId += 1;
    this.panel.webview.html = panelPage(content, pageResources(this.panel.webview, this.extensionUri), this.renderId);
  }

  private received(report: PanelReport): void {
    if (report.problems.length > 0) this.log(`  panel problems: ${report.problems.join('; ')}`);
    this.report = report;
    if (report.renderId !== this.renderId) return; // a page that has since been replaced
    const waiting = this.waiting;
    this.waiting = [];
    for (const resolve of waiting) resolve(report);
  }
}
