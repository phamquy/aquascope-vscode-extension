// Types shared by the analysis pipeline and its consumers, including feature 004 (R12).
// Aquascope's own result types are generated into ./bindings by scripts/export-aquascope-types.sh.
import type { AnalysisOutput } from './bindings/AnalysisOutput';
import type { AquascopeError } from './bindings/AquascopeError';

export type { AnalysisOutput, AquascopeError };
export type { CharPos } from './bindings/CharPos';
export type { CharRange } from './bindings/CharRange';

/** One element of the JSON list that `cargo aquascope permissions` prints, one per function body. */
export type AquascopeEntry = { Ok: AnalysisOutput } | { Err: AquascopeError };

/** Why a run produced no analysis for the cursor (R7, R8, R10). */
export type AnalyzeErrorCode =
  /** The command ran without an active Rust editor. */
  | 'noRustEditor'
  /** No function body contains the cursor, and no function failed to build. */
  | 'noFunction'
  /** No tool at `aquascope.toolchainPath` or inside the extension. */
  | 'toolNotFound'
  /** The code needs a module or crate that a single file cannot provide. */
  | 'singleFileLimit'
  /** Other compile errors kept the function at the cursor from being analysed. */
  | 'compileErrors'
  | 'timeout'
  | 'cancelled'
  /** Any other failure; the details are in the output channel. */
  | 'toolFailed';

/**
 * What `aquascope.analyzeAtCursor` returns. Every position in `output` is a VS Code position of the
 * analysed text: zero-based lines and columns in UTF-16 code units, converted from Aquascope's
 * character columns (R7).
 */
export type AnalyzeResult =
  | { kind: 'ok'; output: AnalysisOutput }
  | { kind: 'error'; code: AnalyzeErrorCode; message: string };
