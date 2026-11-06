// The `aquascope.analyzeAtCursor` command (R1). T-021 wires in the analysis pipeline.
import * as vscode from 'vscode';
import type { AnalyzeResult } from './types';

export async function analyzeAtCursor(): Promise<AnalyzeResult> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'rust') {
    return report({
      kind: 'error',
      code: 'noRustEditor',
      message: 'Open a Rust file and put the cursor inside a function, then run "Aquascope: Analyze Function at Cursor".',
    });
  }
  return report({ kind: 'error', code: 'toolFailed', message: 'The analysis is not implemented yet.' });
}

/** Shows the outcome to the user and returns it unchanged, so tests and feature 004 can use it. */
function report(result: AnalyzeResult): AnalyzeResult {
  if (result.kind === 'error') void vscode.window.showErrorMessage(`Aquascope: ${result.message}`);
  return result;
}
