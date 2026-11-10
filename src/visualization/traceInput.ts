// Turns the interpreter's trace into what Aquascope's embed draws (feature 007, R4, R8, D4 and D6).
import { convertColumnsToUtf16 } from '../analysis/positions';
import type { CharRange, InterpreterOutput, MTrace } from '../analysis/types';
import type { MUndefinedBehavior } from '../analysis/bindings/MUndefinedBehavior';

/** The most steps the panel draws (D6, revised): the fixtures need at most 11. */
export const STEP_LIMIT = 100;

export const TRACE_TITLE = 'Aquascope: stack and heap';

export interface TraceInput {
  /** The whole program, lines joined with `\n`: the trace's positions refer to the whole file. */
  code: string;
  /** The `interpreter` response, with UTF-16 columns and at most `STEP_LIMIT` steps. */
  response: InterpreterOutput;
  title: string;
  /** Sentences the panel shows above the diagram: the step limit, undefined behaviour. */
  notes: string[];
  /** The number of steps drawn, which the page checks the embed against. */
  steps: number;
}

/**
 * Builds the embed's input from the trace and the exact text that was run. The trace is copied, so the
 * caller's is unchanged. `file`, set when the program ran with its crate (feature 009), is the active file's
 * path relative to the workspace root, and every step's current frame is in it.
 */
export function traceInput(trace: MTrace<CharRange>, source: string, limit = STEP_LIMIT, file?: string): TraceInput {
  const shown = structuredClone(trace);
  if (file !== undefined) placeOtherFiles(shown, file);
  convertColumnsToUtf16(shown, source);
  const notes: string[] = [];
  const total = shown.steps.length;
  if (total > limit) {
    shown.steps = shown.steps.slice(0, limit);
    const after = shown.result.type === 'Error' ? ` After that, it reached undefined behaviour: ${describe(shown.result.value)}.` : '';
    // The renderer marks the last step failed for an error result, which would now be the wrong step.
    shown.result = { type: 'Success' };
    notes.push(
      `Showing the first ${limit} of ${total} steps. Each call to a function of the program adds steps; a shorter run shows them all.${after}`,
    );
  } else if (shown.result.type === 'Error') {
    notes.push(`The program reached undefined behaviour at its last step, marked in red: ${describe(shown.result.value)}.`);
  }
  const code = source
    .split('\n')
    .map((line) => line.replace(/\r$/, ''))
    .join('\n');
  return { code, response: { Ok: shown }, title: TRACE_TITLE, notes, steps: shown.steps.length };
}

/**
 * Moves the positions of frames in files other than `file` to the start of the drawn file (feature 009, D4).
 * The renderer draws only the current frame's position, but reads every frame's against the drawn text, and
 * throws on a line the text does not have; such frames keep their names and locals.
 */
function placeOtherFiles(trace: MTrace<CharRange>, file: string): void {
  const start = (range: CharRange): CharRange => ({ ...range, start: { line: 0, column: 0 }, end: { line: 0, column: 0 } });
  for (const step of trace.steps) {
    for (const frame of step.stack.frames) {
      if (frame.file_path === file) continue;
      frame.body_span = start(frame.body_span);
      frame.location = start(frame.location);
    }
  }
}

/** Miri's undefined behaviour, in words. */
function describe(ub: MUndefinedBehavior): string {
  return ub.type === 'PointerUseAfterFree' ? 'a pointer was used after the memory it points to was freed' : ub.value;
}
