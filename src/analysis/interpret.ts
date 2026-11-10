// Runs Aquascope's interpreter on a whole program and explains its failures (feature 007 R2, R3, R5).
// The interpreter executes `main` in Miri. A file in no package is written as the program of a binary crate
// (feature 007); a file of a package with a binary runs that binary with the rest of its crate, in feature
// 008's copy of the project (feature 009). T-036's probe (spec 007, Appendix A) shows what comes back: a
// trace for a program that runs, even one that reaches undefined behaviour; a bare build error, with exit
// code 0, for a program that stops while running; and no output, with a non-zero exit code, for code that
// does not compile.
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';
import type * as vscode from 'vscode';
import { classifyBuildErrors, CompilerError, crateBuildFailure, Failure, parseCompilerErrors, programCompileErrors, programStopped, runFailure } from './errors';
import type { CrateInProject, PackageBinary } from './project';
import { inCopy, syncProject, type UnsavedEditor } from './projectCopy';
import { outputChannel, run, type ReportProgress, type RunOutcome } from './runner';
import { detectEdition, writeCrate } from './scratchCrate';
import { runEnvironment } from './toolchain';
import type { CharRange, InterpreterOutput, MTrace, StackHeapResult } from './types';

export interface InterpretJob {
  /** The editor's text, saved or not. */
  source: string;
  /** The file's path when it is on disk, for the edition (003 R2). */
  file: string | undefined;
  storage: string;
  timeoutSeconds: number;
  root: string;
  cargo: string;
  /** The Miri-built standard library (R3). */
  sysroot: string;
}

/** What the interpreter's stdout holds. */
export type ParsedOutput =
  | { kind: 'trace'; trace: MTrace<CharRange> }
  | { kind: 'failed' }
  | { kind: 'invalid'; reason: string };

/** Reads the one JSON object `cargo aquascope interpreter` prints. */
export function parseInterpreterOutput(stdout: string): ParsedOutput {
  let value: unknown;
  try {
    value = JSON.parse(stdout);
  } catch {
    return { kind: 'invalid', reason: stdout.trim() ? 'not JSON' : 'no output' };
  }
  const out = value as Partial<InterpreterOutput> | null;
  if (out && typeof out === 'object' && 'Ok' in out && Array.isArray(out.Ok?.steps)) return { kind: 'trace', trace: out.Ok };
  if (out && typeof out === 'object' && 'Err' in out) return { kind: 'failed' };
  return { kind: 'invalid', reason: 'not an interpreter result' };
}

/**
 * Explains a run without a trace (R5, D4), from the compiler's errors for the same crate and the
 * interpreter's exit code. Compile errors come first: a missing `main`, then 003's single-file limit, then
 * any other. Without them, a clean exit means the program stopped while running, and anything else is a
 * tool failure.
 */
export function classifyInterpretFailure(errors: CompilerError[], exitCode: number | null): Failure {
  if (errors.some((e) => e.code === 'E0601')) {
    return {
      code: 'noMain',
      message: 'This view runs the program, so the file needs a `main` function. Add one that calls the code you want to see, and run it again.',
    };
  }
  if (errors.length > 0) {
    const failure = classifyBuildErrors([], errors);
    if (failure.code === 'singleFileLimit') return failure;
    return {
      code: 'compileErrors',
      message:
        'The program could not be run because the file has compile errors, which include code that fails borrow checking. ' +
        "The compiler's messages are in the Aquascope output; the permissions view can still show a borrow error.",
    };
  }
  if (exitCode === 0) {
    return {
      code: 'programFailed',
      message:
        'The program stopped while running: it panicked, failed an assertion, exited early or read input, which this view cannot show. ' +
        "Aquascope's output is in the Aquascope output.",
    };
  }
  return { code: 'toolFailed', message: `Aquascope failed with exit code ${exitCode}. The details are in the Aquascope output.` };
}

/** Runs the interpreter for `job` and returns the trace, or why there is none. */
export async function interpret(job: InterpretJob, token: vscode.CancellationToken): Promise<StackHeapResult> {
  const channel = outputChannel();
  try {
    const dir = writeCrate(job.storage, job.source, detectEdition(job.file), { form: 'bin' });
    const environment = runEnvironment(job.root, dir, process.env, process.platform, { MIRI_SYSROOT: job.sysroot });
    const tool = (args: string[]) =>
      run({ program: job.cargo, args, cwd: dir, environment, timeoutMs: job.timeoutSeconds * 1000, token, log: (l) => channel.appendLine(l) });

    const outcome = await tool(['aquascope', 'interpreter']);
    if (outcome.kind !== 'exited') return failed(runFailure(outcome, 'Aquascope', job.timeoutSeconds));
    const parsed = outcome.exitCode === 0 ? parseInterpreterOutput(outcome.stdout) : undefined;
    if (parsed?.kind === 'trace') {
      const { steps, result } = parsed.trace;
      channel.appendLine(`  trace: ${steps.length} steps, result ${result.type === 'Success' ? 'success' : JSON.stringify(result.value)}`);
      return { kind: 'ok', trace: parsed.trace };
    }
    if (parsed?.kind === 'invalid') {
      channel.appendLine(`  unreadable output, ${parsed.reason}; it begins:\n${outcome.stdout.slice(0, 2000)}`);
      return error('toolFailed', `Aquascope's output could not be read (${parsed.reason}). The details are in the Aquascope output.`);
    }
    // No trace: ask cargo whether the file compiles, since the interpreter does not say (003 D6).
    if (parsed?.kind === 'failed') channel.appendLine(`  interpreter output: ${outcome.stdout.trim()}`);
    const check = await tool(['check', '--message-format=json']);
    if (check.kind !== 'exited') return failed(runFailure(check, 'cargo check', job.timeoutSeconds));
    const errors = parseCompilerErrors(check.stdout);
    channel.appendLine(`  compiler errors (${errors.length}):`);
    for (const e of errors) channel.appendLine(e.rendered.trimEnd());
    return failed(classifyInterpretFailure(errors, outcome.exitCode));
  } catch (err) {
    channel.appendLine(`  unexpected error: ${(err as Error).stack ?? String(err)}`);
    return error('toolFailed', `The run failed unexpectedly (${(err as Error).message}). The details are in the Aquascope output.`);
  }
}

const error = (code: Failure['code'], message: string): StackHeapResult => ({ kind: 'error', code, message });
const failed = (f: Failure): StackHeapResult => error(f.code, f.message);

/** The module the fork's one-crate build puts the binary's root file in; its `main` is the program's. */
const BIN_MODULE = '__aquascope_main::';
/** File name of the mark, beside a project's copy, that the interpreter's build has run once (plan, D5). */
const INTERPRETER_BUILT = 'interpreter-built';

export interface CrateRunJob {
  crate: CrateInProject;
  binary: PackageBinary;
  arguments: string[];
  /** Every editor with unsaved changes, by its real path, for the copy (feature 008, R4). */
  unsaved: UnsavedEditor[];
  storage: string;
  timeoutSeconds: number;
  root: string;
  cargo: string;
  /** The Miri-built standard library. */
  sysroot: string;
}

/**
 * The interpreter's build folder in a project's folder `dir`, for the Miri library at `sysroot` (T-057). Crates
 * built against one Miri library cannot be used with another (E0460), and cargo does not notice when the
 * library at a path is rebuilt, as installing a rebuilt package of the same version does, since the library is
 * built anew each time. So each library gets its own folder, named by its path and its core library's size and
 * modification time, and the folders of other libraries are removed.
 */
export async function interpreterTarget(dir: string, sysroot: string): Promise<string> {
  let identity = sysroot;
  const rustlib = path.join(sysroot, 'lib', 'rustlib');
  for (const triple of await fs.readdir(rustlib).catch(() => [] as string[])) {
    const lib = path.join(rustlib, triple, 'lib');
    for (const name of await fs.readdir(lib).catch(() => [] as string[])) {
      if (!/^libcore-.*\.rmeta$/.test(name)) continue;
      const stat = await fs.stat(path.join(lib, name));
      identity += `\0${triple}/${name}\0${stat.size}\0${stat.mtimeMs}`;
    }
  }
  const name = `target-interpreter-${createHash('sha256').update(identity).digest('hex').slice(0, 12)}`;
  for (const entry of await fs.readdir(dir).catch(() => [] as string[])) {
    if (entry.startsWith('target-interpreter') && entry !== name) await fs.rm(path.join(dir, entry), { recursive: true, force: true });
  }
  return path.join(dir, name);
}

/** The trace with only the steps whose current frame is in `file`, and how many steps each file has. */
export function stepsInFile(trace: MTrace<CharRange>, file: string): { trace: MTrace<CharRange>; counts: Map<string, number> } {
  const counts = new Map<string, number>();
  const steps = trace.steps.filter((step) => {
    const current = step.stack.frames[step.stack.frames.length - 1]?.file_path ?? '';
    counts.set(current, (counts.get(current) ?? 0) + 1);
    return current === file;
  });
  return { trace: { ...trace, steps }, counts };
}

/** Names the binary's functions as the binary does, without the one-crate build's module (D4, revised). */
export function withoutBinModule(trace: MTrace<CharRange>): MTrace<CharRange> {
  for (const step of trace.steps) {
    for (const frame of step.stack.frames) if (frame.name.startsWith(BIN_MODULE)) frame.name = frame.name.slice(BIN_MODULE.length);
  }
  return trace;
}

/** The interpreter's command line for a crate run (feature 009, D3; plan, the fork's options). */
export function crateRunArgs(workspace: string, binary: PackageBinary, libraryRoot: string | undefined, args: string[]): string[] {
  const inWorkspace = (file: string): string => path.join(workspace, ...file.split('/'));
  const crateOf = libraryRoot !== undefined ? ['--crate-of', inWorkspace(libraryRoot)] : ['--crate-of', inWorkspace(binary.rootFile)];
  const oneCrate = libraryRoot !== undefined ? ['--bin-file', inWorkspace(binary.rootFile)] : [];
  return ['aquascope', ...crateOf, 'interpreter', '--disable-isolation', ...oneCrate, '--', ...args];
}

/**
 * Runs a binary of `job.crate`'s package with the rest of its crate (feature 009): in feature 008's copy,
 * brought up to date with the unsaved editors (R2); as one crate with the package's library, so the
 * library's steps are recorded too (plan); with the arguments and file access the user chose (R3, R4), from
 * the copy of the workspace root (D3). The result keeps the steps in the active file (R5, R8).
 */
export async function interpretCrate(job: CrateRunJob, token: vscode.CancellationToken, report: ReportProgress): Promise<StackHeapResult> {
  const channel = outputChannel();
  const { crate, binary } = job;
  try {
    channel.appendLine(`  crate ${crate.packageName}, binary ${binary.name} (${binary.rootFile}); ${crate.relativePath} in ${crate.workspaceRoot}`);
    channel.appendLine(`  arguments: ${JSON.stringify(job.arguments)}`);
    report('copying the project');
    const { folders, stats } = await syncProject(job.storage, crate, job.unsaved);
    channel.appendLine(`  copy ${folders.src}: ${stats.files} files, ${stats.copied} copied, ${stats.deleted} deleted, ${stats.unsaved} unsaved; ${stats.ms} ms`);
    const workspace = inCopy(folders, crate.copyRoot, crate.workspaceRoot);

    // The interpreter builds every crate with Miri's library, so it has its own build folder, which the
    // permissions view's builds do not disturb (plan), one for each Miri library (T-057).
    const target = await interpreterTarget(folders.dir, job.sysroot);
    const environment = runEnvironment(job.root, folders.dir, process.env, process.platform, {
      MIRI_SYSROOT: job.sysroot,
      CARGO_TARGET_DIR: target,
    });
    const built = path.join(target, INTERPRETER_BUILT);
    const first = !(await exists(built));
    const timeoutMs = first ? undefined : job.timeoutSeconds * 1000;
    const tool = (args: string[]) => run({ program: job.cargo, args, cwd: workspace, environment, timeoutMs, token, log: (l) => channel.appendLine(l) });
    report(first ? 'building the program for the interpreter, the first time on this crate' : 'running the program');

    let outcome = await tool(crateRunArgs(workspace, binary, crate.libraryRoot, job.arguments));
    if (outcome.kind === 'exited' && outcome.exitCode !== 0 && crate.libraryRoot !== undefined) {
      const failure = crateBuildFailure(outcome.stderr);
      if (failure) return failed(failure);
      // The binary and its library did not compile as one crate. If the binary compiles alone, as one whose
      // own modules use `crate::` paths does, it runs alone, and only its own files have steps (plan).
      const errors = await binaryErrors(job, folders.dir, workspace, token);
      if (errors === undefined) return failed(runFailure(outcome, 'cargo check', job.timeoutSeconds));
      if (errors.length > 0) return failed(programCompileErrors(errors));
      channel.appendLine('  the binary and its library do not compile as one crate; running the binary alone');
      report('running the program');
      outcome = await tool(crateRunArgs(workspace, binary, undefined, job.arguments));
    }
    if (outcome.kind !== 'exited') return failed(runFailure(outcome, 'Aquascope', job.timeoutSeconds));
    if (outcome.exitCode === 0) await fs.writeFile(built, '');
    return await crateResult(job, outcome, folders.dir, workspace, token);
  } catch (err) {
    channel.appendLine(`  unexpected error: ${(err as Error).stack ?? String(err)}`);
    return error('toolFailed', `The run failed unexpectedly (${(err as Error).message}). The details are in the Aquascope output.`);
  }
}

/** The result of a crate run that exited: the active file's steps, or why there are none. */
async function crateResult(
  job: CrateRunJob,
  outcome: RunOutcome,
  dir: string,
  workspace: string,
  token: vscode.CancellationToken,
): Promise<StackHeapResult> {
  const channel = outputChannel();
  // The fork says on stderr why a run ended without a trace, such as the program's exit code.
  const reason = /^aquascope interpreter: (.*)$/m.exec(outcome.stderr)?.[1];
  if (reason) channel.appendLine(`  aquascope interpreter: ${reason}`);
  const parsed = outcome.exitCode === 0 ? parseInterpreterOutput(outcome.stdout) : undefined;
  if (parsed?.kind === 'trace') {
    const { trace, counts } = stepsInFile(withoutBinModule(parsed.trace), job.crate.relativePath);
    const files = [...counts].sort((a, b) => b[1] - a[1]);
    channel.appendLine(`  trace: ${parsed.trace.steps.length} steps (${files.map(([f, n]) => `${f} ${n}`).join(', ')}), result ${resultText(trace)}`);
    if (trace.steps.length === 0) return failed(noStepsInFile(job.crate.relativePath, files.map(([f]) => f)));
    return { kind: 'ok', trace, file: job.crate.relativePath };
  }
  if (parsed?.kind === 'invalid') {
    channel.appendLine(`  unreadable output, ${parsed.reason}; it begins:\n${outcome.stdout.slice(0, 2000)}`);
    return error('toolFailed', `Aquascope's output could not be read (${parsed.reason}). The details are in the Aquascope output.`);
  }
  if (outcome.exitCode === 0) return failed(programStopped(job.arguments, reason)); // the program stopped while running (R7)
  const failure = crateBuildFailure(outcome.stderr);
  if (failure) return failed(failure);
  const errors = await binaryErrors(job, dir, workspace, token);
  if (errors === undefined) return failed(runFailure(outcome, 'Aquascope', job.timeoutSeconds));
  return failed(errors.length > 0 ? programCompileErrors(errors) : classifyInterpretFailure([], outcome.exitCode));
}

/**
 * The compiler's errors for the binary's target, from a plain `cargo check` in the copy with the permissions
 * view's build folder, as feature 008 asks for them (R6, 008 R8); `undefined` when the check did not finish.
 */
async function binaryErrors(job: CrateRunJob, dir: string, workspace: string, token: vscode.CancellationToken): Promise<CompilerError[] | undefined> {
  const channel = outputChannel();
  const check = await run({
    program: job.cargo,
    args: ['check', '--message-format=json', '-p', job.crate.packageName, '--bin', job.binary.name],
    cwd: workspace,
    environment: runEnvironment(job.root, dir),
    timeoutMs: job.timeoutSeconds * 1000,
    token,
    log: (l) => channel.appendLine(l),
  });
  if (check.kind !== 'exited') return undefined;
  const errors = parseCompilerErrors(check.stdout);
  channel.appendLine(`  compiler errors (${errors.length}):`);
  for (const e of errors) channel.appendLine(e.rendered.trimEnd());
  return errors;
}

/** A run with no step in the active file (R8, AC8). */
export function noStepsInFile(file: string, filesWithSteps: string[]): Failure {
  const shown = filesWithSteps.slice(0, 5).join(', ');
  const where = filesWithSteps.length === 0 ? 'The program had no steps in any file of its crate.' : `Its steps are in ${shown}${filesWithSteps.length > 5 ? ' and others' : ''}.`;
  return {
    code: 'noStepsInFile',
    message: `The program ran, but none of its steps are in ${file}: the run never reached its functions. ${where} Run it from one of those files.`,
  };
}

function resultText(trace: MTrace<CharRange>): string {
  return trace.result.type === 'Success' ? 'success' : JSON.stringify(trace.result.value);
}

async function exists(file: string): Promise<boolean> {
  return fs.access(file).then(
    () => true,
    () => false,
  );
}

