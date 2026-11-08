// Feature 007's trace shaped for the embed (R4, R8, D4 and D6), from the traces T-036 captured.
import * as assert from 'assert';
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
