// A walk over every position in a parsed Aquascope result, shared by the column conversion (R7 of
// feature 003) and the line shift for the embed (D2 of feature 004).
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
