import * as assert from 'assert';
import { readFileSync } from 'fs';
import { selectAtCursor, Selection } from '../../analysis/select';
import type { AquascopeEntry, CharPos } from '../../analysis/types';
import { fixtureData, fixtureProject, fixtureText } from './harness';

/** The selection for a cursor, checked to be the same when the tool lists the bodies in reverse. */
function select(name: string, line: number, character: number): Selection {
  const stdout = fixtureData(`${name}.json`);
  const source = fixtureText(`${name}.rs`);
  const forward = selectAtCursor(stdout, source, { line, character });
  const reversed = JSON.stringify((JSON.parse(stdout) as AquascopeEntry[]).reverse());
  assert.deepStrictEqual(selectAtCursor(reversed, source, { line, character }), forward, 'depends on result order');
  return forward;
}

/** Start of the selected body, or the kind when nothing was selected. */
function bodyStart(s: Selection): CharPos | string {
  return s.kind === 'selected' ? s.output.body_range.start : s.kind;
}

suite('selecting the body at the cursor (R7)', () => {
  test('selects grow, area and main in the method fixture (AC3)', () => {
    assert.deepStrictEqual(bodyStart(select('05_method_mut_borrow', 8, 8)), { line: 7, column: 4 });
    assert.deepStrictEqual(bodyStart(select('05_method_mut_borrow', 12, 8)), { line: 11, column: 4 });
    assert.deepStrictEqual(bodyStart(select('05_method_mut_borrow', 18, 4)), { line: 16, column: 0 });
  });

  test('counts the signature and both ends of the body as inside', () => {
    assert.deepStrictEqual(bodyStart(select('05_method_mut_borrow', 16, 0)), { line: 16, column: 0 });
    assert.deepStrictEqual(bodyStart(select('05_method_mut_borrow', 20, 1)), { line: 16, column: 0 });
  });

  test('picks the innermost of nested bodies', () => {
    assert.deepStrictEqual(bodyStart(select('n2_nested', 3, 8)), { line: 2, column: 4 }, 'fn inside fn');
    assert.deepStrictEqual(bodyStart(select('n2_nested', 7, 25)), { line: 7, column: 12 }, 'closure');
    assert.deepStrictEqual(bodyStart(select('n2_nested', 7, 6)), { line: 1, column: 0 }, 'outer, beside the closure');
    assert.deepStrictEqual(bodyStart(select('n2_nested', 5, 4)), { line: 1, column: 0 }, 'outer');
  });

  test('reports no function outside every body (AC4)', () => {
    assert.deepStrictEqual(select('05_method_mut_borrow', 2, 4), { kind: 'none', buildErrors: [], analysisErrors: [] });
    assert.deepStrictEqual(select('05_method_mut_borrow', 6, 0), { kind: 'none', buildErrors: [], analysisErrors: [] });
  });

  test('converts character columns to UTF-16 on a line with an emoji', () => {
    const s = select('n1_non_ascii', 2, 50);
    assert.ok(s.kind === 'selected');
    const line = fixtureText('n1_non_ascii.rs').split('\n')[2];
    const text = (r: { start: CharPos; end: CharPos }): string => line.slice(r.start.column, r.end.column);
    const loans = Object.values(s.output.loan_points).map(text).sort();
    assert.deepStrictEqual(loans, ['&t', 'println!("{u}")', 'u']);
    const boundaries = s.output.boundaries.map((b) => line.slice(b.location.column, b.location.column + 1)).sort();
    assert.deepStrictEqual(boundaries, ['s', 't', 'u']);
    // Lines without surrogate pairs keep their columns.
    assert.deepStrictEqual(s.output.body_range, { ...s.output.body_range, start: { line: 1, column: 0 }, end: { line: 3, column: 1 } });
  });

  test('returns the build errors when the cursor is in a function that failed to build', () => {
    const s = select('e4_mixed_errors', 2, 8);
    assert.strictEqual(s.kind, 'none');
    assert.deepStrictEqual(s.kind === 'none' && s.buildErrors.map((r) => r?.start), [{ line: 1, column: 0 }]);
    assert.deepStrictEqual(bodyStart(select('e4_mixed_errors', 8, 4)), { line: 6, column: 0 }, 'main still analysed');
    assert.deepStrictEqual(select('e3_mod_other', 4, 4).kind, 'none');
  });

  test('passes analysis errors on and rejects output that is not Aquascope\'s', () => {
    const err = '[{"Err":{"type":"AnalysisError","msg":"boom"}}]';
    assert.deepStrictEqual(selectAtCursor(err, '', { line: 0, character: 0 }), { kind: 'none', buildErrors: [], analysisErrors: ['boom'] });
    assert.deepStrictEqual(selectAtCursor('[]', '', { line: 0, character: 0 }), { kind: 'none', buildErrors: [], analysisErrors: [] });
    for (const bad of ['', 'warning: x', '{}', '[1]', '[{"Ok":{}}]']) {
      assert.strictEqual(selectAtCursor(bad, '', { line: 0, character: 0 }).kind, 'invalid', bad);
    }
  });
});

suite('selecting the body at the cursor in a crate of several files (feature 008, R3)', () => {
  // T-044's capture of `--crate-of src/config.rs` on the split minigrep: bodies of lib.rs and config.rs.
  const stdout = fixtureData('crate/minigrep-config.json');
  const config = readFileSync(fixtureProject('minigrep', 'src', 'config.rs'), 'utf8');
  const lib = readFileSync(fixtureProject('minigrep', 'src', 'lib.rs'), 'utf8');

  test("keeps the active file's results, so a body of another file on the same lines is not chosen", () => {
    const cursor = { line: 13, character: 8 }; // inside parse in config.rs; lines 12 to 14 of lib.rs are search
    assert.deepStrictEqual(bodyStart(selectAtCursor(stdout, config, cursor, 'src/config.rs')), { line: 10, column: 4 });
    const unfiltered = selectAtCursor(stdout, config, cursor);
    assert.ok(unfiltered.kind === 'selected' && unfiltered.output.file_path === 'src/lib.rs', "without the file, lib.rs's search wins");
    assert.deepStrictEqual(bodyStart(selectAtCursor(stdout, lib, { line: 13, character: 4 }, 'src/lib.rs')), { line: 12, column: 0 });
  });

  test('a file with no result is no function; results without a path still count', () => {
    assert.strictEqual(selectAtCursor(stdout, config, { line: 13, character: 8 }, 'src/main.rs').kind, 'none');
    const old = fixtureData('05_method_mut_borrow.json'); // captured before results named their file
    const source = fixtureText('05_method_mut_borrow.rs');
    assert.deepStrictEqual(selectAtCursor(old, source, { line: 18, character: 4 }, 'src/lib.rs'), selectAtCursor(old, source, { line: 18, character: 4 }));
  });

  test("keeps only the active file's build errors", () => {
    const range = { start: { line: 1, column: 0 }, end: { line: 3, column: 1 }, filename: { private_use_as_methods_instead: 0 } };
    const out = JSON.stringify([{ Err: { type: 'BuildError', range, file_path: 'src/lib.rs' } }]);
    const at = { line: 2, character: 0 };
    assert.deepStrictEqual(selectAtCursor(out, lib, at, 'src/config.rs'), { kind: 'none', buildErrors: [], analysisErrors: [] });
    const inLib = selectAtCursor(out, lib, at, 'src/lib.rs');
    assert.ok(inLib.kind === 'none' && inLib.buildErrors.length === 1);
  });
});
