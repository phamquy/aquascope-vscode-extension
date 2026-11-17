// Turns the interpreter's trace into what Aquascope's embed draws (feature 007, R4, R8, D4 and D6).
import { convertColumnsToUtf16 } from '../analysis/positions';
import type { CharRange, InterpreterOutput, MTrace } from '../analysis/types';
import type { Abbreviated } from '../analysis/bindings/Abbreviated';
import type { MMemorySegment } from '../analysis/bindings/MMemorySegment';
import type { MPath } from '../analysis/bindings/MPath';
import type { MStep } from '../analysis/bindings/MStep';
import type { MUndefinedBehavior } from '../analysis/bindings/MUndefinedBehavior';
import type { MValue } from '../analysis/bindings/MValue';

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
  for (const step of shown.steps) keepPointersDrawable(step);
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

/**
 * Points every pointer of `step` at something the renderer draws (issue #83). The renderer draws an array of
 * more than 12 elements as its first 11 and its last, which it labels index 100, and when a pointer's element,
 * or the last element of its slice, is not drawn it throws, which removes every diagram of the trace. Such a
 * pointer instead points at its slice's first element, without the slice's extent, when that is drawn, and
 * otherwise at the array as a whole.
 */
function keepPointersDrawable(step: MStep<CharRange>): void {
  const valueAt = (segment: MMemorySegment): MValue | undefined =>
    segment.type === 'Heap'
      ? step.heap.locations[segment.value.index]
      : step.stack.frames[segment.value.frame]?.locals.find((l) => l.name === segment.value.local)?.value;
  const visit = (value: MValue): void => {
    if (value.type === 'Pointer') keepDrawable(value.value.path, valueAt(value.value.path.segment));
    else if (value.type === 'Adt') value.value.fields.forEach(([, field]) => visit(field));
    else if (value.type === 'Tuple') value.value.forEach(visit);
    else if (value.type === 'Array') elements(value.value).forEach(visit);
  };
  for (const frame of step.stack.frames) for (const local of frame.locals) visit(local.value);
  step.heap.locations.forEach(visit);
}

/** Cuts `path` back to the parts the renderer draws inside `value`, the value at the path's segment. */
function keepDrawable(path: MPath, value: MValue | undefined): void {
  let at = value;
  for (let i = 0; i < path.parts.length && at !== undefined; i++) {
    const part = path.parts[i];
    if (part.type === 'Field') {
      at = at.type === 'Adt' ? at.value.fields[part.value]?.[1] : at.type === 'Tuple' ? at.value[part.value] : undefined;
      continue;
    }
    if (at.type !== 'Array') return;
    const [first, last] = part.type === 'Index' ? [part.value, part.value] : part.value;
    if (drawn(at.value, first) && drawn(at.value, last)) {
      at = at.value.type === 'All' || first < at.value.value[0].length ? elements(at.value)[first] : at.value.value[1];
      continue;
    }
    path.parts.length = i;
    if (drawn(at.value, first)) path.parts.push({ type: 'Index', value: first });
    return;
  }
}

/** Whether the renderer draws element `index` of an array: all of them, or the first ones and one labelled 100. */
function drawn(array: Abbreviated<MValue>, index: number): boolean {
  return array.type === 'All' ? index < array.value.length : index < array.value[0].length || index === 100;
}

/** The elements an array holds, the last of an abbreviated one after its first ones. */
function elements(array: Abbreviated<MValue>): MValue[] {
  return array.type === 'All' ? array.value : [...array.value[0], array.value[1]];
}

/** Miri's undefined behaviour, in words. */
function describe(ub: MUndefinedBehavior): string {
  return ub.type === 'PointerUseAfterFree' ? 'a pointer was used after the memory it points to was freed' : ub.value;
}
