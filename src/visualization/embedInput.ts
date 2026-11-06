// Turns feature 003's selected result into what Aquascope's embed draws (feature 004, R3 and D2).
import { forEachPosition } from '../analysis/positions';
import type { AnalysisOutput, AquascopeEntry } from '../analysis/types';

export interface EmbedInput {
  /** The whole lines spanned by the body's range, joined with `\n`. */
  code: string;
  /** The zero-based line of the analysed text that `code` starts at. */
  firstLine: number;
  /** The `permissions` response: one entry, with every line shifted so that `code` starts at line 0. */
  response: AquascopeEntry[];
  /** The panel title, naming the analysed lines (R4). */
  title: string;
  /** Parts of the result left out because they point outside the shown lines, e.g. `boundaries[3]`. */
  dropped: string[];
}

/**
 * Builds the embed's input from the selected result and the exact text that was analysed. Columns are
 * kept: whole lines are shown, and 003's columns are already the UTF-16 offsets the embed uses.
 */
export function embedInput(output: AnalysisOutput, source: string): EmbedInput {
  const first = output.body_range.start.line;
  const last = output.body_range.end.line;
  const code = source
    .split('\n')
    .slice(first, last + 1)
    .map((line) => line.replace(/\r$/, ''))
    .join('\n');

  const shifted = structuredClone(output);
  forEachPosition(shifted, (pos) => {
    pos.line -= first;
  });
  const dropped = dropOutside(shifted, last - first);

  const title = first === last ? `Aquascope: line ${first + 1}` : `Aquascope: lines ${first + 1}–${last + 1}`;
  return { code, firstLine: first, response: [{ Ok: shifted }], title, dropped };
}

/**
 * Removes, in place, every step, boundary, loan or move that has a position outside lines 0 to
 * `lastLine`: the embed would throw on it and draw nothing (D2). Returns what was removed.
 */
function dropOutside(output: AnalysisOutput, lastLine: number): string[] {
  const outside = (node: unknown): boolean => {
    let found = false;
    forEachPosition(node, (pos) => {
      if (pos.line < 0 || pos.line > lastLine) found = true;
    });
    return found;
  };
  const dropped: string[] = [];
  const fields = output as unknown as Record<string, unknown>;
  for (const [field, value] of Object.entries(fields)) {
    if (field === 'body_range') continue;
    if (Array.isArray(value)) {
      const kept: unknown[] = [];
      value.forEach((item, i) => {
        if (outside(item)) dropped.push(`${field}[${i}]`);
        else kept.push(item);
      });
      fields[field] = kept;
    } else if (typeof value === 'object' && value !== null) {
      const record = value as Record<string, unknown>;
      for (const key of Object.keys(record)) {
        if (outside(record[key])) {
          delete record[key];
          dropped.push(`${field}.${key}`);
        }
      }
    }
  }
  return dropped;
}
