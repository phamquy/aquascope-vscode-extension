import * as assert from 'assert';
import { readdirSync } from 'fs';
import * as path from 'path';
import { forEachPosition } from '../../analysis/positions';
import { selectAtCursor } from '../../analysis/select';
import type { AnalysisOutput, AquascopeEntry, CharPos } from '../../analysis/types';
import { embedInput, EmbedInput, NO_STEPS_NOTE, NOTHING_TO_SHOW_NOTE } from '../../visualization/embedInput';
import { fixtureData, fixtureText, fixtureWorkspace } from './harness';

/** 003's selected result for a cursor in a captured fixture, as the command would pass it on. */
function selected(name: string, line: number, character: number): { output: AnalysisOutput; source: string } {
  const source = fixtureText(`${name}.rs`);
  const s = selectAtCursor(fixtureData(`${name}.json`), source, { line, character });
  assert.ok(s.kind === 'selected', `${name}: nothing selected at ${line}:${character}`);
  return { output: s.output, source };
}

const result = (input: EmbedInput): AnalysisOutput => {
  assert.strictEqual(input.response.length, 1);
  const [entry] = input.response;
  return 'Ok' in entry ? entry.Ok : assert.fail('not an Ok entry');
};

function positions(root: unknown): CharPos[] {
  const all: CharPos[] = [];
  forEachPosition(root, (p) => all.push({ ...p }));
  return all;
}

suite('embed input from the analysis result (004 R3, D2)', () => {
  test('shows the whole lines of a method and shifts its result to start at line 0', () => {
    const { output, source } = selected('05_method_mut_borrow', 8, 8); // in `grow`
    const input = embedInput(output, source);
    assert.strictEqual(input.code, source.split('\n').slice(7, 11).join('\n'));
    assert.ok(input.code.startsWith('    fn grow(&mut self, by: u32) {') && input.code.endsWith('    }'));
    assert.strictEqual(input.firstLine, 7);
    assert.strictEqual(input.title, 'Aquascope: lines 8–11');
    const shifted = result(input);
    assert.deepStrictEqual(shifted.body_range.start, { line: 0, column: 4 });
    assert.deepStrictEqual(shifted.body_range.end, { line: 3, column: 5 });
    // Every position moved up by exactly 7 lines; no column changed.
    const before = positions(output);
    const after = positions(shifted);
    assert.strictEqual(after.length, before.length);
    after.forEach((p, i) => assert.deepStrictEqual(p, { line: before[i].line - 7, column: before[i].column }));
    assert.deepStrictEqual(input.dropped, []);
  });

  test('titles main of the method fixture by its lines', () => {
    const { output, source } = selected('05_method_mut_borrow', 18, 4);
    const input = embedInput(output, source);
    assert.strictEqual(input.title, 'Aquascope: lines 17–21');
    assert.strictEqual(input.code.split('\n').length, 5);
  });

  test('shows the whole line of a closure and keeps its columns', () => {
    const { output, source } = selected('n2_nested', 7, 25);
    const input = embedInput(output, source);
    assert.strictEqual(input.code, '    let f = |x: i32| x + v.len() as i32;');
    assert.strictEqual(input.title, 'Aquascope: line 8');
    assert.deepStrictEqual(result(input).body_range.start, { line: 0, column: 12 });
    assert.ok(positions(result(input)).every((p) => p.line === 0));
  });

  test('shows a multi-line body containing a nested function', () => {
    const { output, source } = selected('n2_nested', 5, 4); // in `outer`
    const input = embedInput(output, source);
    assert.strictEqual(input.code.split('\n').length, 9);
    assert.ok(input.code.includes('fn inner(v: &mut Vec<i32>)'));
    assert.ok(positions(result(input)).every((p) => p.line >= 0 && p.line <= 8));
  });

  test('keeps UTF-16 columns on a line with an emoji', () => {
    const { output, source } = selected('n1_non_ascii', 2, 50);
    const input = embedInput(output, source);
    const lines = input.code.split('\n');
    const text = (r: { start: CharPos; end: CharPos }) => lines[r.start.line].slice(r.start.column, r.end.column);
    assert.deepStrictEqual(Object.values(result(input).loan_points).map(text).sort(), ['&t', 'println!("{u}")', 'u']);
  });

  test('strips carriage returns from the shown lines', () => {
    const { output, source } = selected('05_method_mut_borrow', 8, 8);
    const input = embedInput(output, source.replace(/\n/g, '\r\n'));
    assert.ok(!input.code.includes('\r'));
    assert.strictEqual(input.code, embedInput(output, source).code);
  });

  test('drops parts of the result that point outside the shown lines, and leaves the input alone', () => {
    const { output, source } = selected('05_method_mut_borrow', 8, 8);
    const original = JSON.stringify(output);
    const bad = structuredClone(output);
    bad.boundaries.push({ ...bad.boundaries[0], location: { line: 2, column: 0 } }); // the struct line
    const loanKey = Number(Object.keys(bad.loan_points)[0]);
    bad.loan_points[loanKey] = { ...bad.loan_points[loanKey], end: { line: 30, column: 0 } };
    const input = embedInput(bad, source);
    assert.deepStrictEqual(input.dropped.sort(), [`boundaries[${bad.boundaries.length - 1}]`, `loan_points.${loanKey}`].sort());
    assert.strictEqual(result(input).boundaries.length, output.boundaries.length);
    assert.ok(!(loanKey in result(input).loan_points));
    assert.strictEqual(JSON.stringify(output), original, 'the selected result is not modified');
  });

  test('drops nothing from any captured body', () => {
    const data = path.join(fixtureWorkspace(), '..', 'data');
    // Permissions output only; the `*.interp.json` files are interpreter traces (feature 007).
    for (const file of readdirSync(data).filter((f) => f.endsWith('.json') && !f.endsWith('.interp.json'))) {
      const name = file.replace(/\.json$/, '');
      const source = fixtureText(`${name}.rs`);
      for (const entry of JSON.parse(fixtureData(file)) as AquascopeEntry[]) {
        if ('Ok' in entry) assert.deepStrictEqual(embedInput(entry.Ok, source).dropped, [], `${name} at line ${entry.Ok.body_range.start.line}`);
      }
    }
  });
});

suite('notes for a function without a step table (feature 011, AC6)', () => {
  const base = () => selected('05_method_mut_borrow', 8, 8); // `grow`: has steps and boundaries

  test('a result with steps has no note', () => {
    const { output, source } = base();
    assert.ok(output.steps.length > 0 && output.boundaries.length > 0, 'the fixture has both');
    assert.deepStrictEqual(embedInput(output, source).notes, []);
  });

  test('a result with boundaries and no steps says the table could not be computed (R1)', () => {
    const { output, source } = base();
    assert.deepStrictEqual(embedInput({ ...output, steps: [] }, source).notes, [NO_STEPS_NOTE]);
  });

  test('a result with neither says there is nothing to show (R2)', () => {
    const { output, source } = base();
    assert.deepStrictEqual(embedInput({ ...output, steps: [], boundaries: [] }, source).notes, [NOTHING_TO_SHOW_NOTE]);
  });

  test('steps that are dropped for lying outside the shown lines still count as steps', () => {
    const { output, source } = base();
    const moved = structuredClone(output);
    forEachPosition(moved.steps, (p) => {
      p.line = 9999;
    });
    const input = embedInput(moved, source);
    assert.ok(input.dropped.some((d) => d.startsWith('steps')), 'the steps were dropped');
    assert.deepStrictEqual(input.notes, [], 'but Aquascope returned them, so no note');
  });

  test('the notes name no cause (D1)', () => {
    assert.doesNotMatch(`${NO_STEPS_NOTE} ${NOTHING_TO_SHOW_NOTE}`, /return|early|\?|let/i);
  });
});
