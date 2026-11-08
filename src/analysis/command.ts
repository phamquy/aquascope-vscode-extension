// The `aquascope.analyzeAtCursor` command (R1): analyses the function at the cursor and shows the result in
// the Aquascope panel (feature 004, R1 and R5). Also `aquascope.showStackAndHeap` (feature 007), which runs
// the program in Aquascope's interpreter; the two share one run in flight.
import * as vscode from 'vscode';
import { classifyBuildErrors, Failure, parseCompilerErrors, runFailure } from './errors';
import { interpret } from './interpret';
import { outputChannel, run, withProgress } from './runner';
import { detectEdition, writeCrate } from './scratchCrate';
import { selectAtCursor, Cursor } from './select';
import { editorFor } from './target';
import { resolveMiriSysroot, resolveToolchain, runEnvironment } from './toolchain';
import type { AnalysisOutput, AnalyzeErrorCode, AnalyzeResult, StackHeapResult } from './types';
import type { VisualizationPanel } from '../visualization/panel';

const DEFAULT_TIMEOUT_SECONDS = 60;
/** Codes whose details are in the output channel, so their message offers to show it. */
const WITH_DETAILS: AnalyzeErrorCode[] = ['singleFileLimit', 'compileErrors', 'programFailed', 'timeout', 'toolFailed'];

/**
 * The run in progress, of either command; a new run cancels it, so only the latest request is answered
 * (feature 007 plan).
 */
let inFlight: vscode.CancellationTokenSource | undefined;

/** Runs `task` under a cancellable progress notification as the only run in flight. */
async function runExclusive<T>(title: string, task: (token: vscode.CancellationToken) => Promise<T>): Promise<T> {
  inFlight?.cancel();
  const cancel = new vscode.CancellationTokenSource();
  inFlight = cancel;
  try {
    return await withProgress(title, (progress) => {
      const forward = progress.onCancellationRequested(() => cancel.cancel());
      return task(cancel.token).finally(() => forward.dispose());
    });
  } finally {
    if (inFlight === cancel) inFlight = undefined;
    cancel.dispose();
  }
}

/** The run timeout from `aquascope.analysisTimeoutSeconds`, or the default when it is not a positive number. */
function timeoutSeconds(config: vscode.WorkspaceConfiguration): number {
  const timeout = config.get<number>('analysisTimeoutSeconds');
  return typeof timeout === 'number' && timeout > 0 ? timeout : DEFAULT_TIMEOUT_SECONDS;
}

/**
 * Analyses the function at the cursor. With `target`, the URI the editor title bar passes (feature 006 R3),
 * the editor showing that document is analysed whichever group has focus; without it, the active editor.
 */
export async function analyzeAtCursor(context: vscode.ExtensionContext, panel: VisualizationPanel, target?: vscode.Uri): Promise<AnalyzeResult> {
  const editor = target ? editorFor(target) : vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'rust') {
    return report(error('noRustEditor', 'Open a Rust file and put the cursor inside a function, then run "Aquascope: Analyze Function at Cursor".'), panel);
  }
  const config = vscode.workspace.getConfiguration('aquascope');
  const toolchain = resolveToolchain(config.get<string>('toolchainPath'), context.extensionPath);
  if (!toolchain.ok) return report(error('toolNotFound', toolchain.message), panel);

  // Take the text and cursor now, so edits made while the tool runs cannot shift the positions (R2, R7).
  const { document, selection } = editor;
  const job: Job = {
    source: document.getText(),
    file: document.uri.scheme === 'file' ? document.uri.fsPath : undefined,
    cursor: { line: selection.active.line, character: selection.active.character },
    storage: context.globalStorageUri.fsPath,
    timeoutSeconds: timeoutSeconds(config),
    root: toolchain.root,
    cargo: toolchain.cargo,
  };
  const result = await runExclusive('Aquascope: analysing the function at the cursor', (token) => analyze(job, token));
  return report(result, panel, job.source);
}

/**
 * Runs the active Rust editor's program in Aquascope's interpreter and draws its stack and heap in the
 * Aquascope panel (feature 007 R1, R2, R4).
 */
export async function showStackAndHeap(context: vscode.ExtensionContext, panel: VisualizationPanel): Promise<StackHeapResult> {
  const editor = vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'rust') {
    return reportTrace(error('noRustEditor', 'Open a Rust file with a `main` function, then run "Aquascope: Show Stack and Heap".'), panel);
  }
  const config = vscode.workspace.getConfiguration('aquascope');
  const configured = config.get<string>('toolchainPath');
  const toolchain = resolveToolchain(configured, context.extensionPath);
  if (!toolchain.ok) return reportTrace(error('toolNotFound', toolchain.message), panel);
  const miri = resolveMiriSysroot(toolchain.root, configured);
  if (!miri.ok) return reportTrace(error('toolNotFound', miri.message), panel);

  const { document } = editor;
  const job = {
    source: document.getText(),
    file: document.uri.scheme === 'file' ? document.uri.fsPath : undefined,
    storage: context.globalStorageUri.fsPath,
    timeoutSeconds: timeoutSeconds(config),
    root: toolchain.root,
    cargo: toolchain.cargo,
    sysroot: miri.sysroot,
  };
  return reportTrace(await runExclusive('Aquascope: running the program', (token) => interpret(job, token)), panel, job.source);
}

/**
 * Shows the outcome of a stack-and-heap run and returns it unchanged, for the tests (feature 007 R4, R5).
 * A trace goes to the panel; errors are notifications that also replace the diagram in an open panel, as
 * for the permissions view, except when nothing ran or the user cancelled.
 */
function reportTrace(result: StackHeapResult, panel: VisualizationPanel, source?: string): StackHeapResult {
  if (result.kind === 'ok') {
    if (source !== undefined) panel.showTrace(result.trace, source);
    return result;
  }
  if (result.code !== 'noRustEditor') outputChannel().appendLine(`  result: ${result.code}: ${result.message}`);
  if (result.code === 'cancelled') return result;
  if (result.code !== 'noRustEditor') panel.showMessage(result.message);
  const actions = WITH_DETAILS.includes(result.code) ? ['Show Output'] : [];
  void vscode.window.showErrorMessage(`Aquascope: ${result.message}`, ...actions).then((choice) => {
    if (choice) outputChannel().show(true);
  });
  return result;
}

interface Job {
  source: string;
  file: string | undefined;
  cursor: Cursor;
  storage: string;
  timeoutSeconds: number;
  root: string;
  cargo: string;
}

async function analyze(job: Job, token: vscode.CancellationToken): Promise<AnalyzeResult> {
  const channel = outputChannel();
  try {
    const dir = writeCrate(job.storage, job.source, detectEdition(job.file));
    const environment = runEnvironment(job.root, dir);
    const tool = (args: string[]) =>
      run({ program: job.cargo, args, cwd: dir, environment, timeoutMs: job.timeoutSeconds * 1000, token, log: (l) => channel.appendLine(l) });

    const analysis = await tool(['aquascope', 'permissions']);
    if (analysis.kind !== 'exited' || analysis.exitCode !== 0) return failed(runFailure(analysis, 'Aquascope', job.timeoutSeconds));

    const selection = selectAtCursor(analysis.stdout, job.source, job.cursor);
    if (selection.kind === 'selected') {
      channel.appendLine(`  selected ${describe(selection.output)}:`);
      channel.appendLine(JSON.stringify(selection.output, null, 2));
      return { kind: 'ok', output: selection.output };
    }
    if (selection.kind === 'invalid') {
      channel.appendLine(`  unreadable output, ${selection.reason}; it begins:\n${analysis.stdout.slice(0, 2000)}`);
      return error('toolFailed', `Aquascope's output could not be read (${selection.reason}). The details are in the Aquascope output.`);
    }
    if (selection.buildErrors.length > 0) {
      // Aquascope silences the compiler, so ask cargo for the errors behind the build failure (D6).
      const check = await tool(['check', '--message-format=json']);
      if (check.kind !== 'exited') return failed(runFailure(check, 'cargo check', job.timeoutSeconds));
      const errors = parseCompilerErrors(check.stdout);
      channel.appendLine(`  compiler errors (${errors.length}):`);
      for (const e of errors) channel.appendLine(e.rendered.trimEnd());
      return failed(classifyBuildErrors(selection.buildErrors, errors));
    }
    if (selection.analysisErrors.length > 0) {
      channel.appendLine(`  analysis errors:\n${selection.analysisErrors.join('\n')}`);
      return error('toolFailed', `Aquascope could not analyse this file (${selection.analysisErrors[0]}). The details are in the Aquascope output.`);
    }
    return error('noFunction', 'There is no function at the cursor. Put the cursor inside a function and run the command again.');
  } catch (err) {
    channel.appendLine(`  unexpected error: ${(err as Error).stack ?? String(err)}`);
    return error('toolFailed', `The analysis failed unexpectedly (${(err as Error).message}). The details are in the Aquascope output.`);
  }
}

/** An error result of either command. */
type ErrorResult = { kind: 'error'; code: AnalyzeErrorCode; message: string };
const error = (code: AnalyzeErrorCode, message: string): ErrorResult => ({ kind: 'error', code, message });
const failed = (f: Failure): ErrorResult => error(f.code, f.message);

function describe(output: AnalysisOutput): string {
  const { start, end } = output.body_range;
  return `the function at lines ${start.line + 1}–${end.line + 1}`;
}

/**
 * Shows the outcome (003 R10, 004 R1 and R5) and returns it unchanged, for the tests and later features
 * (R12). An analysis goes to the panel; an error is a notification and also replaces the diagram in an
 * open panel, except when the user cancelled or no Rust editor was active, which leave the panel as it was.
 */
function report(result: AnalyzeResult, panel: VisualizationPanel, source?: string): AnalyzeResult {
  if (result.kind === 'ok') {
    if (source !== undefined) panel.showAnalysis(result.output, source);
    return result;
  }
  if (result.code === 'noRustEditor') {
    // Nothing was analysed, so the panel keeps its last result.
    void vscode.window.showErrorMessage(`Aquascope: ${result.message}`);
    return result;
  }
  outputChannel().appendLine(`  result: ${result.code}: ${result.message}`);
  if (result.code === 'cancelled') return result; // The user asked for it, or a newer run replaced it.
  panel.showMessage(result.message);
  const actions = WITH_DETAILS.includes(result.code) ? ['Show Output'] : [];
  void vscode.window.showErrorMessage(`Aquascope: ${result.message}`, ...actions).then((choice) => {
    if (choice) outputChannel().show(true);
  });
  return result;
}
