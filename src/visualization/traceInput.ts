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
 * caller's is unchanged.
 */
export function traceInput(trace: MTrace<CharRange>, source: string, limit = STEP_LIMIT): TraceInput {
  const shown = structuredClone(trace);
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

/** Miri's undefined behaviour, in words. */
function describe(ub: MUndefinedBehavior): string {
  return ub.type === 'PointerUseAfterFree' ? 'a pointer was used after the memory it points to was freed' : ub.value;
}
