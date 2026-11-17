// Feature 007's trace shaped for the embed (R4, R8, D4 and D6), from the traces T-036 captured.
import * as assert from 'assert';
import type { MPathSegment } from '../../analysis/bindings/MPathSegment';
import type { MValue } from '../../analysis/bindings/MValue';
import type { CharRange, MTrace } from '../../analysis/types';
import { STEP_LIMIT, TRACE_TITLE, traceInput } from '../../visualization/traceInput';
import { capturedTrace, fixtureText, longTrace } from './harness';

suite('the trace shaped for the embed (feature 007 R4, R8)', () => {
  test('shows the whole program and every step of a short run, with no note', () => {
    const source = fixtureText('01_move_string.rs');
    const input = traceInput(capturedTrace('01_move_string'), source);
    assert.strictEqual(input.code, source.replace(/\r$/gm, ''));
    assert.ok('Ok' in input.response);
    assert.strictEqual(input.response.Ok.steps.length, 4);
    assert.strictEqual(input.steps, 4);
    assert.deepStrictEqual(input.notes, []);
    assert.strictEqual(input.title, TRACE_TITLE);
  });

  test('converts character columns to UTF-16 on a line with an emoji, leaving the trace given unchanged', () => {
    const trace = capturedTrace('n1_non_ascii');
    const before = JSON.stringify(trace);
    const input = traceInput(trace, fixtureText('n1_non_ascii.rs'));
    assert.ok('Ok' in input.response);
    // Probe: the first step ends after `("🦀é");`, character 31, which is UTF-16 offset 32.
    assert.strictEqual(trace.steps[0].stack.frames[0].location.end.column, 31);
    assert.strictEqual(input.response.Ok.steps[0].stack.frames[0].location.end.column, 32);
    assert.strictEqual(JSON.stringify(trace), before);
  });

  test('keeps undefined behaviour on the last step and names it in a note (D4, revised)', () => {
    const input = traceInput(capturedTrace('i4_use_after_free'), fixtureText('i4_use_after_free.rs'));
    assert.ok('Ok' in input.response);
    assert.strictEqual(input.response.Ok.result.type, 'Error');
    assert.strictEqual(input.steps, 4);
    assert.strictEqual(input.notes.length, 1);
    assert.match(input.notes[0], /undefined behaviour at its last step/);
    assert.match(input.notes[0], /used after the memory it points to was freed/);
  });

  test(`draws at most ${STEP_LIMIT} steps and says so, as a success so no kept step is marked failed (D6)`, () => {
    const source = fixtureText('05_method_mut_borrow.rs');
    const input = traceInput(longTrace(150), source);
    assert.ok('Ok' in input.response);
    assert.strictEqual(input.response.Ok.steps.length, STEP_LIMIT);
    assert.strictEqual(input.steps, STEP_LIMIT);
    assert.deepStrictEqual(input.response.Ok.result, { type: 'Success' });
    assert.match(input.notes[0], /^Showing the first 100 of 150 steps\./);

    const ub = traceInput(longTrace(150, { type: 'Error', value: { type: 'Other', value: 'out-of-bounds read' } }), source);
    assert.ok('Ok' in ub.response);
    assert.deepStrictEqual(ub.response.Ok.result, { type: 'Success' });
    assert.match(ub.notes[0], /After that, it reached undefined behaviour: out-of-bounds read\.$/);

    assert.strictEqual(traceInput(longTrace(STEP_LIMIT), source).notes.length, 0, 'exactly the limit needs no note');
  });
});

suite('pointers the renderer can draw (issue #83)', () => {
  const range: CharRange = { start: { line: 0, column: 0 }, end: { line: 0, column: 0 }, filename: { private_use_as_methods_instead: 0 } };
  const chars = (text: string): MValue[] => [...text].map((c) => ({ type: 'Char', value: c.codePointAt(0) ?? 0 }));
  const all = (text: string): MValue => ({ type: 'Array', value: { type: 'All', value: chars(text) } });
  /** How the interpreter shortens an array of more than 12 elements: its first 11 and its last. */
  const shortened = (text: string): MValue => ({ type: 'Array', value: { type: 'Only', value: [chars(text.slice(0, 11)), chars(text.slice(-1))[0]] } });

  /** The parts of the pointer `s` points along once drawn, when `s` points along `parts` into `heap`. */
  function drawnParts(parts: MPathSegment[], heap: MValue): MPathSegment[] {
    const s: MValue = { type: 'Pointer', value: { path: { segment: { type: 'Heap', value: { index: 0 } }, parts }, range: null } };
    const trace: MTrace<CharRange> = {
      steps: [{ stack: { frames: [{ name: 'main', body_span: range, file_path: 'src/main.rs', location: range, locals: [{ name: 's', value: s, moved_paths: [] }] }] }, heap: { locations: [heap] } }],
      result: { type: 'Success' },
    };
    const input = traceInput(trace, 'fn main() {}');
    assert.ok('Ok' in input.response);
    const drawn = input.response.Ok.steps[0].stack.frames[0].locals[0].value;
    assert.strictEqual(drawn.type, 'Pointer');
    assert.deepStrictEqual(parts, (s as Extract<MValue, { type: 'Pointer' }>).value.path.parts, 'the trace given is unchanged');
    return (drawn as Extract<MValue, { type: 'Pointer' }>).value.path.parts;
  }
  const slice = (first: number, last: number): MPathSegment => ({ type: 'Subslice', value: [first, last] });
  const index = (i: number): MPathSegment => ({ type: 'Index', value: i });

  test('keeps a slice whose first and last elements are drawn', () => {
    assert.deepStrictEqual(drawnParts([slice(2, 3)], all('  hi ')), [slice(2, 3)]);
    assert.deepStrictEqual(drawnParts([slice(0, 10)], shortened('  hello there ')), [slice(0, 10)]);
    assert.deepStrictEqual(drawnParts([index(100)], shortened('  hello there ')), [index(100)]);
  });

  test('points a slice that ends where the renderer draws nothing at its first element', () => {
    // "  hello there ".trim(): 14 characters, drawn as the first 11 and the last.
    assert.deepStrictEqual(drawnParts([slice(2, 12)], shortened('  hello there ')), [index(2)]);
    // The text read from the slice's start instead of its allocation's, as the fork did before issue #83.
    assert.deepStrictEqual(drawnParts([slice(2, 12)], all('hello there')), [index(2)]);
  });

  test('points a slice or an element the renderer does not draw at the whole array', () => {
    assert.deepStrictEqual(drawnParts([slice(11, 12)], shortened('  hello there ')), []);
    assert.deepStrictEqual(drawnParts([index(12)], shortened('  hello there ')), []);
  });
});
