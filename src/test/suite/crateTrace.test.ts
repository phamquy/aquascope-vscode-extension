// Feature 009: a program run with its crate, from the trace T-051 captured of minigrep run with `frog
// poem.txt` as one crate with its library: the interpreter's command line, the steps kept for the active file
// and how they are drawn (R5, R8, D4).
import * as assert from 'assert';
import { readFileSync } from 'fs';
import * as path from 'path';
import { crateRunArgs, noStepsInFile, parseInterpreterOutput, stepsInFile, withoutBinModule } from '../../analysis/interpret';
import type { CharRange, MTrace } from '../../analysis/types';
import { STEP_LIMIT, traceInput } from '../../visualization/traceInput';
import { fixtureData, fixtureProject } from './harness';

/** minigrep's whole trace: 25 steps, in src/main.rs, src/config.rs and src/lib.rs (spec 009, Appendix B). */
function minigrepTrace(): MTrace<CharRange> {
  const parsed = parseInterpreterOutput(fixtureData('stack-heap-crate/minigrep-fold.json'));
  assert.ok(parsed.kind === 'trace');
  return parsed.trace;
}

const minigrepSource = (file: string) => readFileSync(fixtureProject('minigrep-book', ...file.split('/')), 'utf8');

suite("the interpreter's command line for a crate (feature 009, D3)", () => {
  const workspace = path.join('/copies', 'p');
  const main = { name: 'minigrep', rootFile: 'src/main.rs' };

  test('a binary with a library runs as one crate with it, with file access and the arguments after --', () => {
    assert.deepStrictEqual(crateRunArgs(workspace, main, 'src/lib.rs', ['frog', 'poem.txt']), [
      'aquascope',
      '--crate-of',
      path.join(workspace, 'src', 'lib.rs'),
      'interpreter',
      '--disable-isolation',
      '--bin-file',
      path.join(workspace, 'src', 'main.rs'),
      '--',
      'frog',
      'poem.txt',
    ]);
  });

  test('a binary without a library, or run alone, is its own crate', () => {
    assert.deepStrictEqual(crateRunArgs(workspace, { name: 'app', rootFile: 'app/src/main.rs' }, undefined, []), [
      'aquascope',
      '--crate-of',
      path.join(workspace, 'app', 'src', 'main.rs'),
      'interpreter',
      '--disable-isolation',
      '--',
    ]);
  });
});

suite("the active file's steps (feature 009, R5, R8)", () => {
  test('keeps the steps whose current frame is in the file, and counts every file', () => {
    const { trace, counts } = stepsInFile(minigrepTrace(), 'src/config.rs');
    assert.strictEqual(trace.steps.length, 7);
    assert.ok(trace.steps.every((s) => s.stack.frames[s.stack.frames.length - 1].file_path === 'src/config.rs'));
    assert.deepStrictEqual(Object.fromEntries(counts), { 'src/main.rs': 6, 'src/config.rs': 7, 'src/lib.rs': 12 });
    assert.deepStrictEqual(trace.result, { type: 'Success' });
  });

  test("names the binary's main as the binary does, without the one-crate build's module", () => {
    const trace = withoutBinModule(minigrepTrace());
    const names = new Set(trace.steps.flatMap((s) => s.stack.frames.map((f) => f.name)));
    assert.deepStrictEqual([...names].sort(), ['config::Config::build', 'main', 'run', 'search']);
  });

  test("AC2's data: a step in config.rs has main's frame, in main.rs, below Config::build's", () => {
    const { trace } = stepsInFile(withoutBinModule(minigrepTrace()), 'src/config.rs');
    const frames = trace.steps[0].stack.frames.map((f) => [f.name, f.file_path]);
    assert.deepStrictEqual(frames, [
      ['main', 'src/main.rs'],
      ['config::Config::build', 'src/config.rs'],
    ]);
  });

  test('a file with no step gets a message naming the files that have them', () => {
    const { trace, counts } = stepsInFile(minigrepTrace(), 'tests/search.rs');
    assert.strictEqual(trace.steps.length, 0);
    const files = [...counts].sort((a, b) => b[1] - a[1]).map(([f]) => f);
    const failure = noStepsInFile('tests/search.rs', files);
    assert.strictEqual(failure.code, 'noStepsInFile');
    assert.match(failure.message, /none of its steps are in tests\/search\.rs/);
    assert.match(failure.message, /Its steps are in src\/lib\.rs, src\/config\.rs, src\/main\.rs\./);
  });
});

suite('drawing the steps of one file of a crate (feature 009, D4)', () => {
  test("frames of other files are placed at the start of the file, keeping their names and locals; the file's own are kept", () => {
    const { trace } = stepsInFile(withoutBinModule(minigrepTrace()), 'src/config.rs');
    const before = JSON.stringify(trace);
    const input = traceInput(trace, minigrepSource('src/config.rs'), STEP_LIMIT, 'src/config.rs');
    assert.ok('Ok' in input.response);
    const [main, build] = input.response.Ok.steps[0].stack.frames;
    const origin = { line: 0, column: 0 };
    assert.deepStrictEqual([main.location.start, main.location.end, main.body_span.start, main.body_span.end], [origin, origin, origin, origin]);
    assert.strictEqual(main.name, 'main');
    assert.deepStrictEqual(main.locals, trace.steps[0].stack.frames[0].locals);
    assert.deepStrictEqual(build.location, trace.steps[0].stack.frames[1].location);
    assert.strictEqual(input.steps, 7);
    assert.strictEqual(JSON.stringify(trace), before, "the caller's trace is unchanged");
  });

  test('every position drawn is on a line of the file', () => {
    const source = minigrepSource('src/lib.rs');
    const lines = source.split('\n').length;
    const { trace } = stepsInFile(minigrepTrace(), 'src/lib.rs');
    const input = traceInput(trace, source, STEP_LIMIT, 'src/lib.rs');
    assert.ok('Ok' in input.response);
    for (const frame of input.response.Ok.steps.flatMap((s) => s.stack.frames)) {
      for (const pos of [frame.location.start, frame.location.end, frame.body_span.start, frame.body_span.end]) {
        assert.ok(pos.line < lines, `${frame.name} at line ${pos.line} of ${lines}`);
      }
    }
  });

  test("the step limit applies to the file's steps", () => {
    const { trace } = stepsInFile(minigrepTrace(), 'src/lib.rs');
    const input = traceInput(trace, minigrepSource('src/lib.rs'), 5, 'src/lib.rs');
    assert.strictEqual(input.steps, 5);
    assert.match(input.notes[0], /Showing the first 5 of 12 steps/);
  });
});
