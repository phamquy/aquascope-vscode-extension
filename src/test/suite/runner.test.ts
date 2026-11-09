import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { run, RunOutcome, RunRequest, withProgress } from '../../analysis/runner';
import { writeCrate } from '../../analysis/scratchCrate';
import { runEnvironment } from '../../analysis/toolchain';
import { requireToolchain } from './harness';

const posixOnly = process.platform === 'win32' ? suite.skip : suite;

/** A shell script that starts a background `sleep`, prints its pid, then waits: a parent with a grandchild. */
const PARENT_WITH_GRANDCHILD = 'sleep 30 & echo $!; wait';

function request(script: string, extra: Partial<RunRequest> = {}): RunRequest & { lines: string[] } {
  const lines: string[] = [];
  return {
    program: '/bin/sh',
    args: ['-c', script],
    cwd: os.tmpdir(),
    environment: runEnvironment('/aq', os.tmpdir(), { PATH: '/usr/bin:/bin', RUSTFLAGS: '-Dwarnings' }, process.platform),
    timeoutMs: 10_000,
    log: (line) => lines.push(line),
    lines,
    ...extra,
  };
}

/** True once `pid` no longer exists; polls briefly because the reaper may lag behind the kill. */
async function gone(pid: number): Promise<boolean> {
  for (let i = 0; i < 50; i++) {
    try {
      process.kill(pid, 0);
    } catch {
      return true;
    }
    await new Promise((r) => setTimeout(r, 20));
  }
  return false;
}

posixOnly('runner (R8, R11)', () => {
  test('collects output and exit code, and logs the command, environment and full stderr of a failure', async () => {
    const req = request('echo out; echo err >&2; exit 3');
    const outcome = await run(req);
    assert.strictEqual(outcome.kind, 'exited');
    assert.strictEqual(outcome.exitCode, 3);
    assert.strictEqual(outcome.stdout, 'out\n');
    assert.strictEqual(outcome.stderr, 'err\n');
    const log = req.lines.join('\n');
    assert.match(log, /\/bin\/sh -c "echo out; echo err >&2; exit 3"/);
    assert.match(log, /set CARGO_NET_OFFLINE=true/);
    assert.match(log, /set RUSTC_WRAPPER=""/);
    assert.match(log, /removed RUSTFLAGS/);
    assert.match(log, /exit code 3; \d+ ms; stdout 4 bytes, stderr 4 bytes/);
    assert.match(log, /stderr:\nerr$/);
  });

  test('logs only the size of stderr when the run succeeds', async () => {
    const req = request('echo "MIR dump" >&2');
    const outcome = await run(req);
    assert.strictEqual(outcome.exitCode, 0);
    assert.ok(!req.lines.some((line) => line.startsWith('  stderr:')), req.lines.join('\n'));
    assert.match(req.lines.join('\n'), /exit code 0; \d+ ms; stdout 0 bytes, stderr 9 bytes/);
  });

  test('kills the child and its grandchild on timeout', async () => {
    const req = request(PARENT_WITH_GRANDCHILD, { timeoutMs: 300 });
    const outcome = await run(req);
    assert.strictEqual(outcome.kind, 'timeout');
    assert.ok(outcome.durationMs < 5_000, `took ${outcome.durationMs} ms`);
    const pid = Number(outcome.stdout.trim());
    assert.ok(pid > 0, `no grandchild pid in ${JSON.stringify(outcome.stdout)}`);
    assert.ok(await gone(pid), `grandchild ${pid} still running`);
    assert.match(req.lines.join('\n'), /timeout of 0.3 s reached; killing process group \d+/);
  });

  test('kills the child and its grandchild on cancel', async () => {
    const source = new vscode.CancellationTokenSource();
    const req = request(PARENT_WITH_GRANDCHILD, { token: source.token });
    const done = run(req);
    await new Promise((r) => setTimeout(r, 200)); // long enough for the pid to be printed
    source.cancel();
    const outcome = await done;
    source.dispose();
    assert.strictEqual(outcome.kind, 'cancelled');
    const pid = Number(outcome.stdout.trim());
    assert.ok(pid > 0, `no grandchild pid in ${JSON.stringify(outcome.stdout)}`);
    assert.ok(await gone(pid), `grandchild ${pid} still running`);
    assert.match(req.lines.join('\n'), /cancel requested; killing process group \d+/);
  });

  test('with no timeout, runs to the end, and can still be cancelled (feature 008, D6)', async () => {
    const finished = await run(request('sleep 0.4; echo done', { timeoutMs: undefined }));
    assert.deepStrictEqual([finished.kind, finished.exitCode, finished.stdout.trim()], ['exited', 0, 'done']);

    const source = new vscode.CancellationTokenSource();
    const req = request(PARENT_WITH_GRANDCHILD, { timeoutMs: undefined, token: source.token });
    const done = run(req);
    await new Promise((r) => setTimeout(r, 200));
    source.cancel();
    const outcome = await done;
    source.dispose();
    assert.strictEqual(outcome.kind, 'cancelled');
    assert.ok(await gone(Number(outcome.stdout.trim())), 'the grandchild is stopped');
  });

  test('does not start when already cancelled', async () => {
    const source = new vscode.CancellationTokenSource();
    source.cancel();
    const outcome = await run(request('touch should-not-exist', { token: source.token }));
    assert.strictEqual(outcome.kind, 'cancelled');
    assert.strictEqual(outcome.durationMs, 0);
  });

  test('reports a program that cannot be started', async () => {
    const req = request('', { program: '/nonexistent/cargo', args: [] });
    const outcome = await run(req);
    assert.strictEqual(outcome.kind, 'spawnError');
    assert.strictEqual(outcome.error?.code, 'ENOENT');
    assert.match(req.lines.join('\n'), /could not start: /);
  });

  test('runs a task under a progress notification and returns its result', async () => {
    const result = await withProgress('Aquascope: test', (token) => Promise.resolve(token.isCancellationRequested));
    assert.strictEqual(result, false);
  });
});

/** Commands of the live (non-zombie) processes in process group `pgid`. */
function groupMembers(pgid: number): string[] {
  const ps = execFileSync('ps', ['-axo', 'pgid=,stat=,comm='], { encoding: 'utf8' });
  return ps
    .split('\n')
    .map((line) => line.trim().split(/\s+/))
    .filter(([group, stat]) => Number(group) === pgid && !stat?.startsWith('Z'))
    .map((fields) => fields.slice(2).join(' '));
}

/** Runs a real analysis of a large generated file, watching its process group; `act` fires once the driver runs. */
async function watchAnalysis(
  bundle: string,
  extra: Partial<RunRequest>,
  act: () => void,
): Promise<{ outcome: RunOutcome; seen: Set<string>; pgid: number; storage: string }> {
  const storage = mkdtempSync(path.join(os.tmpdir(), 'aquascope-ac8-'));
  const source = Array.from({ length: 4000 }, (_, i) =>
    `pub fn f${i}(v: &mut Vec<i32>) -> i32 { let a = &v[0]; let b = *a + ${i}; v.push(b); v.len() as i32 + b }`,
  ).join('\n');
  const dir = writeCrate(storage, source, '2024');
  const lines: string[] = [];
  const req: RunRequest = {
    program: path.join(bundle, 'toolchain', 'bin', 'cargo'),
    args: ['aquascope', 'permissions'],
    cwd: dir,
    environment: runEnvironment(bundle, dir),
    timeoutMs: 60_000,
    log: (line) => lines.push(line),
    ...extra,
  };
  let finished = false;
  const done = run(req).finally(() => (finished = true));
  const seen = new Set<string>();
  let pgid = 0;
  let acted = false;
  while (!finished) {
    pgid ||= Number(/^ {2}pid (\d+)$/.exec(lines.find((l) => l.startsWith('  pid ')) ?? '')?.[1] ?? 0);
    if (pgid) {
      for (const command of groupMembers(pgid)) seen.add(path.basename(command));
      if (!acted && seen.has('aquascope-driver')) {
        acted = true;
        act();
      }
    }
    await new Promise((r) => setTimeout(r, 50));
  }
  return { outcome: await done, seen, pgid, storage };
}

/** Polls until the group is empty, allowing the kernel a moment to reap the killed processes. */
async function groupEmpty(pgid: number): Promise<string[]> {
  let members = groupMembers(pgid);
  for (let i = 0; i < 10 && members.length > 0; i++) {
    await new Promise((r) => setTimeout(r, 50));
    members = groupMembers(pgid);
  }
  return members;
}

posixOnly('AC8 with the real toolchain', () => {
  test('cancelling leaves no cargo, cargo-aquascope or aquascope-driver process', async function () {
    this.timeout(60_000);
    const bundle = requireToolchain(this);
    const token = new vscode.CancellationTokenSource();
    const { outcome, seen, pgid, storage } = await watchAnalysis(bundle, { token: token.token }, () => token.cancel());
    token.dispose();
    rmSync(storage, { recursive: true, force: true });
    assert.strictEqual(outcome.kind, 'cancelled');
    for (const name of ['cargo', 'cargo-aquascope', 'aquascope-driver']) assert.ok(seen.has(name), `${name} never seen in the group: ${[...seen].join(', ')}`);
    assert.deepStrictEqual(await groupEmpty(pgid), []);
  });

  test('a timeout leaves no cargo, cargo-aquascope or aquascope-driver process', async function () {
    this.timeout(60_000);
    const bundle = requireToolchain(this);
    const { outcome, seen, pgid, storage } = await watchAnalysis(bundle, { timeoutMs: 2_500 }, () => undefined);
    rmSync(storage, { recursive: true, force: true });
    assert.strictEqual(outcome.kind, 'timeout');
    assert.ok(seen.has('aquascope-driver'), `the driver was not running before the timeout: ${[...seen].join(', ')}`);
    assert.deepStrictEqual(await groupEmpty(pgid), []);
  });
});
