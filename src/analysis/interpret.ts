// Runs Aquascope's interpreter on a whole program and explains its failures (feature 007 R2, R3, R5).
// The interpreter executes `main` in Miri, so the file is written as the program of a binary crate. T-036's
// probe (spec Appendix A) shows what comes back: a trace for a program that runs, even one that reaches
// undefined behaviour; a bare build error, with exit code 0, for a program that stops while running; and no
// output, with a non-zero exit code, for code that does not compile.
import type * as vscode from 'vscode';
import { classifyBuildErrors, CompilerError, Failure, parseCompilerErrors, runFailure } from './errors';
import { outputChannel, run } from './runner';
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
