// Types shared by the analysis pipeline and its consumers, including feature 004 (R12).
// Aquascope's own result types are generated into ./bindings by scripts/export-aquascope-types.sh.
import type { AnalysisOutput } from './bindings/AnalysisOutput';
import type { AquascopeError } from './bindings/AquascopeError';
import type { CharRange } from './bindings/CharRange';
import type { MTrace } from './bindings/MTrace';

export type { AnalysisOutput, AquascopeError };
export type { MTrace } from './bindings/MTrace';
export type { CharPos } from './bindings/CharPos';
export type { CharRange } from './bindings/CharRange';

/** One element of the JSON list that `cargo aquascope permissions` prints, one per function body. */
export type AquascopeEntry = { Ok: AnalysisOutput } | { Err: AquascopeError };

/** What `cargo aquascope interpreter` prints: one object for the whole run (feature 007). */
export type InterpreterOutput = { Ok: MTrace<CharRange> } | { Err: AquascopeError };

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
  /** A dependency of the crate is not in the cargo cache, and the extension never downloads (feature 008, R6). */
  | 'dependencyMissing'
  /** A build script or proc macro of the crate could not be linked: no system linker (feature 008, R7). */
  | 'linkerMissing'
  /** The file is a build script, which this version cannot analyse (feature 008, R10). */
  | 'unsupportedTarget'
  /** The interpreter runs the program, and the file has no `main` function (feature 007 R5). */
  | 'noMain'
  /** The file's package has no binary to run (feature 009, R1). */
  | 'noBinary'
  /** The program ran with its crate, and none of its steps were in the active file (feature 009, R8). */
  | 'noStepsInFile'
  /** The program stopped while running: a panic, a failed assertion, an early exit or reading input (007 R5, D4). */
  | 'programFailed'
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
  | {
      kind: 'error';
      code: AnalyzeErrorCode;
      message: string;
      /** The crate could not be analysed, and the notification offers to analyse the file alone (feature 008, D8). */
      offersFileAlone?: boolean;
    };

/**
 * What `aquascope.showStackAndHeap` returns (feature 007). The trace's positions are Aquascope's own:
 * zero-based lines and character columns of the analysed text; drawing converts them (T-040).
 */
export type StackHeapResult =
  | {
      kind: 'ok';
      trace: MTrace<CharRange>;
      /**
       * When the program ran with its crate (feature 009): the active file's path relative to the workspace
       * root. The trace then holds only the steps whose current frame is in that file (R5).
       */
      file?: string;
    }
  | { kind: 'error'; code: AnalyzeErrorCode; message: string };
