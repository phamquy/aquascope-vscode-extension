// Parses the tool's output and selects the body at the cursor (R7).
import { convertColumnsToUtf16 } from './positions';
import type { AnalysisOutput, AquascopeEntry, CharPos, CharRange } from './types';

/** A VS Code position: zero-based line, column in UTF-16 code units. */
export interface Cursor {
  line: number;
  character: number;
}

export type Selection =
  /** The innermost analysed body containing the cursor, with every column converted to UTF-16. */
  | { kind: 'selected'; output: AnalysisOutput }
  /** No analysed body contains the cursor; the errors decide what the user is told (R10). */
  | { kind: 'none'; buildErrors: (CharRange | null)[]; analysisErrors: string[] }
  /** The output was not the JSON list Aquascope writes. */
  | { kind: 'invalid'; reason: string };

/**
 * Selects the body at `cursor` from the tool's stdout. `source` is the exact text that was analysed,
 * used to convert Aquascope's character columns to UTF-16. Result order is not stable, so the choice
 * depends only on the ranges.
 */
export function selectAtCursor(stdout: string, source: string, cursor: Cursor): Selection {
  let entries: unknown;
  try {
    entries = JSON.parse(stdout);
  } catch (err) {
    return { kind: 'invalid', reason: `the output is not JSON (${(err as Error).message})` };
  }
  if (!Array.isArray(entries) || !entries.every(isEntry)) {
    return { kind: 'invalid', reason: 'the output is not a list of analysis results' };
  }
  convertColumnsToUtf16(entries, source);

  const at: CharPos = { line: cursor.line, column: cursor.character };
  const containing = entries.flatMap((e) => ('Ok' in e && contains(e.Ok.body_range, at) ? [e.Ok] : []));
  if (containing.length > 0) {
    // Bodies nest or are disjoint, so the innermost one starts last; ties go to the one ending first.
    containing.sort((a, b) => compare(b.body_range.start, a.body_range.start) || compare(a.body_range.end, b.body_range.end));
    return { kind: 'selected', output: containing[0] };
  }
  const buildErrors: (CharRange | null)[] = [];
  const analysisErrors: string[] = [];
  for (const e of entries) {
    if (!('Err' in e)) continue;
    if (e.Err.type === 'BuildError') buildErrors.push(e.Err.range);
    else analysisErrors.push(e.Err.msg);
  }
  return { kind: 'none', buildErrors, analysisErrors };
}

function isEntry(e: unknown): e is AquascopeEntry {
  if (typeof e !== 'object' || e === null) return false;
  const entry = e as Record<string, unknown>;
  if ('Ok' in entry) return typeof entry.Ok === 'object' && entry.Ok !== null && 'body_range' in entry.Ok;
  return 'Err' in entry && typeof entry.Err === 'object' && entry.Err !== null && 'type' in entry.Err;
}

const compare = (a: CharPos, b: CharPos): number => a.line - b.line || a.column - b.column;
const contains = (r: CharRange, p: CharPos): boolean => compare(r.start, p) <= 0 && compare(p, r.end) <= 0;
