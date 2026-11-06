import * as assert from 'assert';
import { selectAtCursor, Selection } from '../../analysis/select';
import type { AquascopeEntry, CharPos } from '../../analysis/types';
import { fixtureData, fixtureText } from './harness';

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
