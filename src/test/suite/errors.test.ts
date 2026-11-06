import * as assert from 'assert';
import { classifyBuildErrors, parseCompilerErrors, runFailure } from '../../analysis/errors';
import type { RunOutcome } from '../../analysis/runner';
import { selectAtCursor } from '../../analysis/select';
import type { CharRange } from '../../analysis/types';
import { fixtureData, fixtureText } from './harness';

/** The build errors Aquascope reported for a fixture, as the command sees them with the cursor at `line`. */
function buildErrors(name: string, line: number): (CharRange | null)[] {
  const s = selectAtCursor(fixtureData(`${name}.json`), fixtureText(`${name}.rs`), { line, character: 4 });
  assert.strictEqual(s.kind, 'none', `${name}: expected no analysed body at line ${line}`);
  return s.kind === 'none' ? s.buildErrors : [];
}

const errorsOf = (name: string) => parseCompilerErrors(fixtureData(`${name}.check.jsonl`));

suite('classifying failures (R10)', () => {
  test('reads only the errors from cargo check JSON', () => {
    const errors = errorsOf('e4_mixed_errors');
    assert.deepStrictEqual(errors.map((e) => e.code), ['E0308', 'E0502']);
    assert.match(errors[0].rendered, /^error\[E0308\]: mismatched types/);
    assert.deepStrictEqual(parseCompilerErrors('Checking x\nnot json\n{"reason":"build-finished","success":false}\n'), []);
  });

  test('names a missing module as the single-file limit (AC6)', () => {
    const f = classifyBuildErrors(buildErrors('e3_mod_other', 4), errorsOf('e3_mod_other'));
    assert.strictEqual(f.code, 'singleFileLimit');
    assert.match(f.message, /uses `other`, which a single file cannot provide/);
  });

  test('names an external crate used by path as the single-file limit (AC6)', () => {
    const f = classifyBuildErrors(buildErrors('e5_undeclared_crate_path', 2), errorsOf('e5_undeclared_crate_path'));
    assert.strictEqual(f.code, 'singleFileLimit');
    assert.match(f.message, /uses `rand`,/);
    assert.match(f.message, /misspelt/, 'E0433 also means a misspelt path');
  });

  test('names an unresolved import as the single-file limit', () => {
    const f = classifyBuildErrors([null], errorsOf('e2_unresolved_import'));
    assert.strictEqual(f.code, 'singleFileLimit');
    assert.match(f.message, /uses `serde`,/);
  });

  test('reports other compile errors with the lines of the functions that failed', () => {
    const one = classifyBuildErrors(buildErrors('e1_type_error', 2), errorsOf('e1_type_error'));
    assert.strictEqual(one.code, 'compileErrors');
    assert.match(one.message, /\(function at line 2\)/);
    assert.match(one.message, /Aquascope output/);
    const mixed = classifyBuildErrors(buildErrors('e4_mixed_errors', 2), errorsOf('e4_mixed_errors'));
    assert.strictEqual(mixed.code, 'compileErrors');
    assert.match(mixed.message, /\(function at line 2\)/, 'the borrow error in main is not a build error');
  });

  test('prefers the single-file limit when both kinds of error are present, naming each module once', () => {
    const errors = [...errorsOf('e1_type_error'), ...errorsOf('e3_mod_other'), ...errorsOf('e3_mod_other')];
    const f = classifyBuildErrors([null], errors);
    assert.strictEqual(f.code, 'singleFileLimit');
    assert.strictEqual(f.message.match(/`other`/g)?.length, 1);
  });

  test('explains timeouts, cancels, start failures and non-zero exits', () => {
    const outcome = (o: Partial<RunOutcome>): RunOutcome => ({ kind: 'exited', exitCode: 0, stdout: '', stderr: '', durationMs: 1, ...o });
    const timeout = runFailure(outcome({ kind: 'timeout', exitCode: null }), 'Aquascope', 60);
    assert.strictEqual(timeout.code, 'timeout');
    assert.match(timeout.message, /after 60 s.*aquascope\.analysisTimeoutSeconds/);
    assert.strictEqual(runFailure(outcome({ kind: 'cancelled' }), 'Aquascope', 60).code, 'cancelled');
    const spawn = runFailure(outcome({ kind: 'spawnError', error: Object.assign(new Error('spawn EACCES'), { code: 'EACCES' }) }), 'Aquascope', 60);
    assert.deepStrictEqual(spawn, { code: 'toolFailed', message: 'Aquascope could not be started (spawn EACCES).' });
    const exit = runFailure(outcome({ exitCode: 101 }), 'Aquascope', 60);
    assert.deepStrictEqual(exit.code, 'toolFailed');
    assert.match(exit.message, /exit code 101.*Aquascope output/);
  });
});
