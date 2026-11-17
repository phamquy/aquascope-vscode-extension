import * as assert from 'assert';
import { parseCompilerErrors } from '../../analysis/errors';
import { parseInterpreterOutput } from '../../analysis/interpret';
import { fromToolPath } from '../../analysis/positions';
import { selectAtCursor } from '../../analysis/select';
import type { AquascopeEntry } from '../../analysis/types';
import { fixtureData, fixtureText } from './harness';

// Feature 012: on Windows Aquascope and cargo name files with backslashes (`src\lib.rs`), where the extension
// compares them with the `/` paths of `project.ts`. These tests give the extension that output on any platform.

suite('file paths from the tools (feature 012)', () => {
  test('turns backslashes into slashes and leaves slashes alone', () => {
    assert.strictEqual(fromToolPath('app\\src\\lib.rs'), 'app/src/lib.rs');
    assert.strictEqual(fromToolPath('app/src/lib.rs'), 'app/src/lib.rs');
  });

  test('selects the result of a file the tool names with backslashes, and reports the path with slashes', () => {
    const entries = JSON.parse(fixtureData('05_method_mut_borrow.json')) as AquascopeEntry[];
    for (const e of entries) if ('Ok' in e) e.Ok.file_path = 'src\\shapes\\rect.rs';
    const stdout = JSON.stringify(entries);
    const source = fixtureText('05_method_mut_borrow.rs');
    const hit = selectAtCursor(stdout, source, { line: 8, character: 8 }, 'src/shapes/rect.rs');
    assert.ok(hit.kind === 'selected', JSON.stringify(hit).slice(0, 200));
    assert.strictEqual(hit.output.file_path, 'src/shapes/rect.rs');
    assert.strictEqual(selectAtCursor(stdout, source, { line: 8, character: 8 }, 'src/other.rs').kind, 'none');
  });

  test('names the files of a trace with slashes', () => {
    const range = { start: { line: 0, column: 0 }, end: { line: 1, column: 1 }, filename: { private_use_as_methods_instead: 0 } };
    const frame = { name: 'main', file_path: 'src\\main.rs', body_span: range, location: null, locals: [] };
    const trace = { Ok: { steps: [{ stack: { frames: [frame] }, heap: { locations: [] } }], result: { Ok: null } } };
    const parsed = parseInterpreterOutput(JSON.stringify(trace));
    assert.ok(parsed.kind === 'trace');
    assert.strictEqual(parsed.trace.steps[0].stack.frames[0].file_path, 'src/main.rs');
  });

  test("names a compile error's file with slashes", () => {
    const line = JSON.stringify({
      reason: 'compiler-message',
      message: { level: 'error', message: 'boom', code: null, rendered: 'boom', spans: [{ file_name: 'src\\config.rs', line_start: 7, is_primary: true }] },
    });
    assert.deepStrictEqual(parseCompilerErrors(line)[0].place, { file: 'src/config.rs', line: 7 });
  });
});
