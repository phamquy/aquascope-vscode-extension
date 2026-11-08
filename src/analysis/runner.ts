// Runs a toolchain process without blocking the extension host, with cancel, timeout and logging (R8, R11).
import * as vscode from 'vscode';
import { ChildProcess, spawn } from 'child_process';
import type { RunEnvironment } from './toolchain';

let channel: vscode.OutputChannel | undefined;
/** How many of the channel's latest lines are kept for `recentOutput`. */
const RECENT_LINES = 500;
const recent: string[] = [];

/**
 * The "Aquascope" output channel, created on first use. It also keeps its latest lines in memory, which the
 * extension's test API exposes, since a channel's text cannot be read back through VS Code (feature 007 AC4).
 */
export function outputChannel(): vscode.OutputChannel {
  if (!channel) {
    const real = vscode.window.createOutputChannel('Aquascope');
    const keep = (text: string) => {
      recent.push(...text.split('\n'));
      recent.splice(0, Math.max(0, recent.length - RECENT_LINES));
    };
    channel = {
      name: real.name,
      append: (value: string) => (keep(value), real.append(value)),
      appendLine: (value: string) => (keep(value), real.appendLine(value)),
      replace: (value: string) => ((recent.length = 0), keep(value), real.replace(value)),
      clear: () => ((recent.length = 0), real.clear()),
      show: (preserveFocus?: boolean) => real.show(preserveFocus),
      hide: () => real.hide(),
      dispose: () => real.dispose(),
    } as vscode.OutputChannel;
  }
  return channel;
}

/** The output channel's latest lines, joined with newlines. */
export function recentOutput(): string {
  return recent.join('\n');
}

/** Runs `task` under a cancellable progress notification (R8). */
export function withProgress<T>(title: string, task: (token: vscode.CancellationToken) => Promise<T>): Thenable<T> {
  return vscode.window.withProgress(
    { location: vscode.ProgressLocation.Notification, title, cancellable: true },
    (_progress, token) => task(token),
  );
}

export interface RunRequest {
  /** Absolute path of the program to start. */
  program: string;
  args: string[];
  cwd: string;
  environment: RunEnvironment;
  timeoutMs: number;
  token?: vscode.CancellationToken;
  /** Receives the log lines; normally the output channel's `appendLine`. */
  log: (line: string) => void;
}

export interface RunOutcome {
  /** `exited` covers every exit code; the caller decides what a non-zero code means. */
  kind: 'exited' | 'timeout' | 'cancelled' | 'spawnError';
  exitCode: number | null;
  stdout: string;
  stderr: string;
  durationMs: number;
  /** Set for `spawnError`, for example ENOENT when the program is missing. */
  error?: NodeJS.ErrnoException;
}

/**
 * Starts the program as its own process group, so that cancelling or timing out kills it together with
 * every process it started (cargo, cargo-aquascope, aquascope-driver), then logs the run.
 */
export function run(req: RunRequest): Promise<RunOutcome> {
  const started = Date.now();
  logStart(req);
  if (req.token?.isCancellationRequested) {
    return Promise.resolve(finishLog(req, { kind: 'cancelled', exitCode: null, stdout: '', stderr: '', durationMs: 0 }));
  }

  return new Promise((resolve) => {
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let ending: RunOutcome['kind'] | undefined;
    let settled = false;

    const child = spawn(req.program, req.args, {
      cwd: req.cwd,
      env: req.environment.env,
      // A new process group on POSIX; on Windows a detached child would get its own console instead.
      detached: process.platform !== 'win32',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    if (child.pid !== undefined) req.log(`  pid ${child.pid}`);
    child.stdout?.on('data', (chunk: Buffer) => stdout.push(chunk));
    child.stderr?.on('data', (chunk: Buffer) => stderr.push(chunk));

    const stop = (kind: 'timeout' | 'cancelled'): void => {
      if (settled || ending) return;
      ending = kind;
      req.log(`  ${kind === 'timeout' ? `timeout of ${req.timeoutMs / 1000} s reached` : 'cancel requested'}; killing process group ${child.pid}`);
      killGroup(child);
    };
    const timer = setTimeout(() => stop('timeout'), req.timeoutMs);
    const cancel = req.token?.onCancellationRequested(() => stop('cancelled'));

    const finish = (kind: RunOutcome['kind'], exitCode: number | null, error?: NodeJS.ErrnoException): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      cancel?.dispose();
      const outcome: RunOutcome = {
        kind,
        exitCode,
        stdout: Buffer.concat(stdout).toString('utf8'),
        stderr: Buffer.concat(stderr).toString('utf8'),
        durationMs: Date.now() - started,
        error,
      };
      resolve(finishLog(req, outcome));
    };

    child.on('error', (err: NodeJS.ErrnoException) => finish(ending ?? 'spawnError', null, ending ? undefined : err));
    // After a kill, a process outside the group could still hold the pipes open, so do not wait for 'close'.
    child.on('exit', (code) => {
      if (ending) finish(ending, code);
    });
    child.on('close', (code) => finish(ending ?? 'exited', code));
  });
}

function killGroup(child: ChildProcess): void {
  if (child.pid === undefined) return;
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
    } else {
      process.kill(-child.pid, 'SIGKILL');
    }
  } catch {
    // The group has already exited.
  }
}

const quote = (arg: string): string => (/^[\w./:=@%+-]+$/.test(arg) ? arg : JSON.stringify(arg));

function logStart(req: RunRequest): void {
  const { set, removed } = req.environment;
  req.log(`[${new Date().toISOString()}] ${[req.program, ...req.args].map(quote).join(' ')}`);
  req.log(`  cwd: ${req.cwd}`);
  for (const [key, value] of Object.entries(set)) req.log(`  set ${key}=${quote(value)}`);
  if (removed.length > 0) req.log(`  removed ${removed.join(' ')}`);
}

/** Logs the outcome; stderr in full unless the run succeeded or was cancelled, when only its size is useful (R11). */
function finishLog(req: RunRequest, outcome: RunOutcome): RunOutcome {
  const what = {
    exited: `exit code ${outcome.exitCode}`,
    timeout: 'timed out',
    cancelled: 'cancelled',
    spawnError: `could not start: ${outcome.error?.message ?? 'unknown error'}`,
  }[outcome.kind];
  req.log(`  ${what}; ${outcome.durationMs} ms; stdout ${Buffer.byteLength(outcome.stdout)} bytes, stderr ${Buffer.byteLength(outcome.stderr)} bytes`);
  const quiet = outcome.kind === 'cancelled' || (outcome.kind === 'exited' && outcome.exitCode === 0);
  if (!quiet && outcome.stderr) req.log(`  stderr:\n${outcome.stderr.trimEnd()}`);
  return outcome;
}
