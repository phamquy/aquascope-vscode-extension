// A walk over every position in a parsed Aquascope result, shared by the column conversion (R7 of
// feature 003, and feature 007's traces) and the line shift for the embed (D2 of feature 004).
import type { CharPos } from './types';

/**
 * Calls `fn` on every `{line, column}` object inside `root`, in no particular order. `fn` may change
 * the position in place. Aquascope's results hold positions only as such two-key objects.
 */
export function forEachPosition(root: unknown, fn: (pos: CharPos) => void): void {
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (typeof node !== 'object' || node === null) return;
    const obj = node as Record<string, unknown>;
    const keys = Object.keys(obj);
    if (keys.length === 2 && typeof obj.line === 'number' && typeof obj.column === 'number') {
      fn(obj as unknown as CharPos);
      return;
    }
    for (const key of keys) visit(obj[key]);
  };
  visit(root);
}

/**
 * Rewrites every `{line, column}` in `root`, in place, from Unicode characters to the UTF-16 code units VS
 * Code and the embed count, using the analysed `source` (003 R7; feature 007's traces). The two differ
 * only on lines with characters outside the Basic Multilingual Plane (surrogate pairs), such as emoji.
 */
export function convertColumnsToUtf16(root: unknown, source: string): void {
  const lines = source.split('\n');
  const wide = new Set<number>();
  lines.forEach((text, i) => /[\uD800-\uDFFF]/.test(text) && wide.add(i));
  if (wide.size === 0) return;
  forEachPosition(root, (pos) => {
    if (wide.has(pos.line)) pos.column = utf16Column(lines[pos.line], pos.column);
  });
}

function utf16Column(text: string, column: number): number {
  let units = 0;
  let chars = 0;
  for (const ch of text) {
    if (chars === column) return units;
    units += ch.length;
    chars++;
  }
  return units + (column - chars);
}
