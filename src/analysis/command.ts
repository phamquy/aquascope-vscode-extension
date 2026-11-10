// The `aquascope.analyzeAtCursor` command (R1): analyses the function at the cursor and shows the result in
// the Aquascope panel (feature 004, R1 and R5). A file that belongs to a Cargo package is analysed with the
// rest of its crate, in a copy of its project (feature 008); any other file alone, in a temporary crate
// (feature 003). Also `aquascope.showStackAndHeap` (feature 007), which runs the program in Aquascope's
// interpreter, with the rest of its crate when the file belongs to a package with a binary (feature 009);
// the two share one run in flight.
import { promises as fs } from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { classifyBuildErrors, crateBuildFailure, crateCompileErrors, Failure, noBinary, parseCompilerErrors, runFailure, unsupportedTarget } from './errors';
import { interpret, interpretCrate } from './interpret';
import { chooseProgram, vscodeDialogs, type GivenProgram } from './program';
import { locateCrate, realPath, type CrateInProject } from './project';
import { inCopy, syncProject, type UnsavedEditor } from './projectCopy';
import { outputChannel, run, withProgress, type ReportProgress, type RunOutcome } from './runner';
import { detectEdition, writeCrate } from './scratchCrate';
import { selectAtCursor, Cursor, type Selection } from './select';
import { editorFor } from './target';
import { resolveMiriSysroot, resolveToolchain, runEnvironment } from './toolchain';
import type { AnalysisOutput, AnalyzeErrorCode, AnalyzeResult, StackHeapResult } from './types';
import type { VisualizationPanel } from '../visualization/panel';

const DEFAULT_TIMEOUT_SECONDS = 60;
/** Codes whose details are in the output channel, so their message offers to show it. */
const WITH_DETAILS: AnalyzeErrorCode[] = ['singleFileLimit', 'compileErrors', 'dependencyMissing', 'linkerMissing', 'programFailed', 'timeout', 'toolFailed'];
/** The notification's button that analyses the file alone after a crate could not be (feature 008, D8). */
const ANALYZE_ALONE = 'Analyze This File Alone';

/** Options of `aquascope.analyzeAtCursor` besides the URI: `alone` analyses the file without its crate (D8). */
export interface AnalyzeOptions {
  alone?: boolean;
}

/**
 * Options of `aquascope.showStackAndHeap` (feature 009): the binary and the arguments, which are otherwise
 * asked for (D1, D2), and `alone`, which runs the file without its crate, as feature 007 does (D6).
 */
export interface StackHeapOptions extends GivenProgram {
  alone?: boolean;
}

/**
 * The run in progress, of either command; a new run cancels it, so only the latest request is answered
 * (feature 007 plan).
 */
let inFlight: vscode.CancellationTokenSource | undefined;

/** Runs `task` under a cancellable progress notification as the only run in flight. */
async function runExclusive<T>(title: string, task: (token: vscode.CancellationToken, report: ReportProgress) => Promise<T>): Promise<T> {
  inFlight?.cancel();
  const cancel = new vscode.CancellationTokenSource();
  inFlight = cancel;
  try {
    return await withProgress(title, (progress, report) => {
      const forward = progress.onCancellationRequested(() => cancel.cancel());
      return task(cancel.token, report).finally(() => forward.dispose());
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
 * With `options.alone`, the file is analysed alone even when it belongs to a crate (feature 008, D8).
 */
export async function analyzeAtCursor(
  context: vscode.ExtensionContext,
  panel: VisualizationPanel,
  target?: vscode.Uri,
  options: AnalyzeOptions = {},
): Promise<AnalyzeResult> {
  const editor = target ? editorFor(target) : vscode.window.activeTextEditor;
  if (!editor || editor.document.languageId !== 'rust') {
    return report(error('noRustEditor', 'Open a Rust file and put the cursor inside a function, then run "Aquascope: Analyze Function at Cursor".'), panel);
  }
  const config = vscode.workspace.getConfiguration('aquascope');
  const toolchain = resolveToolchain(config.get<string>('toolchainPath'), context.extensionPath);
  if (!toolchain.ok) return report(error('toolNotFound', toolchain.message), panel);

  // Take the text and cursor now, so edits made while the tool runs cannot shift the positions (R2, R7).
  const { document, selection } = editor;
  const source = document.getText();
  const job: Job = {
    source,
    file: document.uri.scheme === 'file' ? document.uri.fsPath : undefined,
    cursor: { line: selection.active.line, character: selection.active.character },
    storage: context.globalStorageUri.fsPath,
    timeoutSeconds: timeoutSeconds(config),
    root: toolchain.root,
    cargo: toolchain.cargo,
    // Every editor with unsaved changes, for a crate's copy (feature 008, R4).
    unsaved: vscode.workspace.textDocuments
      .filter((d) => d.isDirty && d.uri.scheme === 'file')
      .map((d) => ({ file: d.uri.fsPath, text: d === document ? source : d.getText() })),
  };
  const result = await runExclusive('Aquascope: analysing the function at the cursor', (token, report) =>
    options.alone ? analyzeFile(job, token) : analyze(job, token, report),
  );
  return report(result, panel, job.source, document.uri);
}

/**
 * Runs the active Rust editor's program in Aquascope's interpreter and draws its stack and heap in the
 * Aquascope panel (feature 007 R1, R2, R4). A file of a Cargo package with a binary runs that binary with the
 * rest of its crate, and the panel draws the steps in the file (feature 009, R1, R5).
 */
export async function showStackAndHeap(
  context: vscode.ExtensionContext,
  panel: VisualizationPanel,
  options: StackHeapOptions = {},
): Promise<StackHeapResult> {
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
  const source = document.getText();
  const job = {
    source,
    file: document.uri.scheme === 'file' ? document.uri.fsPath : undefined,
    storage: context.globalStorageUri.fsPath,
    timeoutSeconds: timeoutSeconds(config),
    root: toolchain.root,
    cargo: toolchain.cargo,
    sysroot: miri.sysroot,
  };

  if (job.file !== undefined && !options.alone) {
    const channel = outputChannel();
    const located = await locateCrate({
      file: job.file,
      cargo: job.cargo,
      environment: runEnvironment(job.root, job.storage),
      timeoutMs: job.timeoutSeconds * 1000,
      log: (l) => channel.appendLine(l),
    });
    switch (located.kind) {
      case 'crate': {
        // The questions come before the run, so its progress notification does not sit under them (D1, D2).
        const program = await chooseProgram(located, context.workspaceState, vscodeDialogs, options);
        if (program.kind === 'cancelled') return reportTrace(error('cancelled', 'The run was cancelled.'), panel);
        if (program.kind === 'noBinary') return reportTrace(failed(noBinary(located.packageName)), panel);
        const crateJob = {
          ...job,
          crate: located,
          binary: program.binary,
          arguments: program.arguments,
          unsaved: vscode.workspace.textDocuments
            .filter((d) => d.isDirty && d.uri.scheme === 'file')
            .map((d) => ({ file: realPath(d.uri.fsPath), text: d === document ? source : d.getText() })),
        };
        const result = await runExclusive('Aquascope: running the program', (token, report) => interpretCrate(crateJob, token, report));
        return reportTrace(result, panel, source);
      }
      case 'buildScript':
        return reportTrace(failed(unsupportedTarget(located.packageName)), panel);
      case 'metadataFailed':
        channel.appendLine(`  cargo metadata failed:\n${located.detail}`);
        return reportTrace(error('toolFailed', "cargo could not read the project's manifest. The details are in the Aquascope output."), panel);
      case 'runFailed':
        return reportTrace(failed(runFailure(located.outcome, 'cargo metadata', job.timeoutSeconds)), panel);
      case 'none':
        break; // in no package: the file runs alone, as in feature 007
    }
  }
  return reportTrace(await runExclusive('Aquascope: running the program', (token) => interpret(job, token)), panel, source);
}

/**
 * Shows the outcome of a stack-and-heap run and returns it unchanged, for the tests (feature 007 R4, R5).
 * A trace goes to the panel; errors are notifications that also replace the diagram in an open panel, as
 * for the permissions view, except when nothing ran or the user cancelled.
 */
function reportTrace(result: StackHeapResult, panel: VisualizationPanel, source?: string): StackHeapResult {
  if (result.kind === 'ok') {
    if (source !== undefined) panel.showTrace(result.trace, source, result.file);
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
  unsaved: UnsavedEditor[];
}

/** File name of the mark, beside a project's copy, that its dependencies have been built (D6). */
const PRELOADED = 'preloaded';

async function analyze(job: Job, token: vscode.CancellationToken, report: ReportProgress): Promise<AnalyzeResult> {
  const channel = outputChannel();
  try {
    if (job.file !== undefined) {
      const located = await locateCrate({
        file: job.file,
        cargo: job.cargo,
        environment: runEnvironment(job.root, job.storage),
        timeoutMs: job.timeoutSeconds * 1000,
        token,
        log: (l) => channel.appendLine(l),
      });
      switch (located.kind) {
        case 'crate':
          return offerFileAlone(await analyzeCrate(job, located, token, report));
        case 'buildScript':
          return offerFileAlone(failed(unsupportedTarget(located.packageName)));
        case 'metadataFailed':
          channel.appendLine(`  cargo metadata failed:\n${located.detail}`);
          return offerFileAlone(error('toolFailed', "cargo could not read the project's manifest. The details are in the Aquascope output."));
        case 'runFailed':
          return failed(runFailure(located.outcome, 'cargo metadata', job.timeoutSeconds));
        case 'none':
          break; // in no package: analysed alone (D8)
      }
    }
    return await analyzeFile(job, token);
  } catch (err) {
    channel.appendLine(`  unexpected error: ${(err as Error).stack ?? String(err)}`);
    return error('toolFailed', `The analysis failed unexpectedly (${(err as Error).message}). The details are in the Aquascope output.`);
  }
}

/**
 * Analyses the file at the cursor with the rest of its crate (feature 008): brings the project's copy up to
 * date with the unsaved editors over it (D1), builds the dependencies the first time with no time limit
 * (D6), then runs Aquascope on the file's crate only (D2) and keeps the results of the file (D3).
 */
async function analyzeCrate(job: Job, crate: CrateInProject, token: vscode.CancellationToken, report: ReportProgress): Promise<AnalyzeResult> {
  const channel = outputChannel();
  channel.appendLine(`  crate ${crate.packageName}, ${crate.target.kind} target ${crate.target.name}; ${crate.relativePath} in ${crate.workspaceRoot}`);
  report('copying the project');
  const unsaved = job.unsaved.map((u) => ({ file: realPath(u.file), text: u.text }));
  const { folders, stats } = await syncProject(job.storage, crate, unsaved);
  channel.appendLine(`  copy ${folders.src}: ${stats.files} files, ${stats.copied} copied, ${stats.deleted} deleted, ${stats.unsaved} unsaved; ${stats.ms} ms`);

  const workspace = inCopy(folders, crate.copyRoot, crate.workspaceRoot);
  const environment = runEnvironment(job.root, folders.dir); // its build folder is folders.target, kept between runs
  const tool = (args: string[], timeoutMs: number | undefined) =>
    run({ program: job.cargo, args, cwd: workspace, environment, timeoutMs, token, log: (l) => channel.appendLine(l) });

  let timeoutMs: number | undefined = job.timeoutSeconds * 1000;
  const preloaded = path.join(folders.dir, PRELOADED);
  if (!(await exists(preloaded))) {
    report('building the dependencies, the first time on this crate');
    const preload = await tool(['aquascope', 'preload'], undefined);
    if (preload.kind === 'cancelled') return failed(runFailure(preload, 'Aquascope', job.timeoutSeconds));
    if (preload.kind === 'exited' && preload.exitCode === 0) {
      await fs.writeFile(preloaded, '');
    } else {
      // A missing dependency stops the analysis too. A missing linker may not: a proc macro that is a member
      // of the workspace fails only the functions that use it (R7), so the analysis still runs.
      const missing = crateBuildFailure(preload.stderr);
      if (missing?.code === 'dependencyMissing') return failed(missing);
      // Preload checks every feature, which some crates cannot; the analysis then builds what it needs itself.
      channel.appendLine('  preload failed; the analysis runs with no time limit');
      timeoutMs = undefined;
    }
  }

  report('analysing');
  const analysis = await tool(['aquascope', '--crate-of', path.join(workspace, crate.relativePath), 'permissions'], timeoutMs);
  if (!succeeded(analysis)) {
    const failure = analysis.kind === 'exited' ? crateBuildFailure(analysis.stderr) : undefined;
    return failed(failure ?? runFailure(analysis, 'Aquascope', job.timeoutSeconds));
  }
  const selection = selectAtCursor(analysis.stdout, job.source, job.cursor, crate.relativePath);
  if (selection.kind === 'none') {
    // A workspace proc macro that could not be linked fails the functions using it, or the whole crate when
    // the crate imports it with `use`, with exit code 0 either way and the linker's error in stderr (R7).
    const linker = crateBuildFailure(analysis.stderr);
    if (linker) return failed(linker);
  }
  if (selection.kind === 'none' && selection.buildErrors.length > 0) {
    // Compile errors, which Aquascope silences, so cargo is asked for them (R8, as 003's D6).
    const check = await tool(['check', '--message-format=json', '-p', crate.packageName, ...targetFlags(crate)], timeoutMs);
    if (check.kind !== 'exited') return failed(runFailure(check, 'cargo check', job.timeoutSeconds));
    const errors = parseCompilerErrors(check.stdout);
    channel.appendLine(`  compiler errors (${errors.length}):`);
    for (const e of errors) channel.appendLine(e.rendered.trimEnd());
    return failed(crateCompileErrors(errors));
  }
  return fromSelection(selection, analysis.stdout);
}

/** cargo's flags selecting the crate's target, as `--crate-of` selected it. */
function targetFlags(crate: CrateInProject): string[] {
  const { kind, name } = crate.target;
  if (kind === 'bin' || kind === 'test' || kind === 'example' || kind === 'bench') return [`--${kind}`, name];
  return ['--lib'];
}

/**
 * A crate run's error, marked so that its notification offers to analyse the file alone (D8). Not when the
 * user cancelled, nor when there is no function at the cursor, which the file alone would not change.
 */
function offerFileAlone(result: AnalyzeResult): AnalyzeResult {
  const offer = result.kind === 'error' && result.code !== 'cancelled' && result.code !== 'noFunction';
  return offer ? { ...result, offersFileAlone: true } : result;
}

/** Analyses the file at the cursor alone, in a temporary single-file crate (feature 003). */
async function analyzeFile(job: Job, token: vscode.CancellationToken): Promise<AnalyzeResult> {
  const channel = outputChannel();
  const dir = writeCrate(job.storage, job.source, detectEdition(job.file));
  const environment = runEnvironment(job.root, dir);
  const tool = (args: string[]) =>
    run({ program: job.cargo, args, cwd: dir, environment, timeoutMs: job.timeoutSeconds * 1000, token, log: (l) => channel.appendLine(l) });

  const analysis = await tool(['aquascope', 'permissions']);
  if (!succeeded(analysis)) return failed(runFailure(analysis, 'Aquascope', job.timeoutSeconds));

  const selection = selectAtCursor(analysis.stdout, job.source, job.cursor);
  if (selection.kind === 'none' && selection.buildErrors.length > 0) {
    // Aquascope silences the compiler, so ask cargo for the errors behind the build failure (D6).
    const check = await tool(['check', '--message-format=json']);
    if (check.kind !== 'exited') return failed(runFailure(check, 'cargo check', job.timeoutSeconds));
    const errors = parseCompilerErrors(check.stdout);
    channel.appendLine(`  compiler errors (${errors.length}):`);
    for (const e of errors) channel.appendLine(e.rendered.trimEnd());
    return failed(classifyBuildErrors(selection.buildErrors, errors));
  }
  return fromSelection(selection, analysis.stdout);
}

/** The result for a selection, logged: the body at the cursor, or why there is none (R7, R10). */
function fromSelection(selection: Selection, stdout: string): AnalyzeResult {
  const channel = outputChannel();
  if (selection.kind === 'selected') {
    channel.appendLine(`  selected ${describe(selection.output)}:`);
    channel.appendLine(JSON.stringify(selection.output, null, 2));
    return { kind: 'ok', output: selection.output };
  }
  if (selection.kind === 'invalid') {
    channel.appendLine(`  unreadable output, ${selection.reason}; it begins:\n${stdout.slice(0, 2000)}`);
    return error('toolFailed', `Aquascope's output could not be read (${selection.reason}). The details are in the Aquascope output.`);
  }
  if (selection.analysisErrors.length > 0) {
    channel.appendLine(`  analysis errors:\n${selection.analysisErrors.join('\n')}`);
    return error('toolFailed', `Aquascope could not analyse this file (${selection.analysisErrors[0]}). The details are in the Aquascope output.`);
  }
  return error('noFunction', 'There is no function at the cursor. Put the cursor inside a function and run the command again.');
}

const succeeded = (outcome: RunOutcome): boolean => outcome.kind === 'exited' && outcome.exitCode === 0;

async function exists(file: string): Promise<boolean> {
  return fs.access(file).then(
    () => true,
    () => false,
  );
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
 * A crate's error offers to analyse the file at `uri` alone (feature 008, D8).
 */
function report(result: AnalyzeResult, panel: VisualizationPanel, source?: string, uri?: vscode.Uri): AnalyzeResult {
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
  const actions = [...(result.offersFileAlone && uri ? [ANALYZE_ALONE] : []), ...(WITH_DETAILS.includes(result.code) ? ['Show Output'] : [])];
  void vscode.window.showErrorMessage(`Aquascope: ${result.message}`, ...actions).then((choice) => {
    if (choice === ANALYZE_ALONE) {
      void vscode.commands.executeCommand('aquascope.analyzeAtCursor', uri, { alone: true } satisfies AnalyzeOptions);
    } else if (choice) {
      outputChannel().show(true);
    }
  });
  return result;
}
