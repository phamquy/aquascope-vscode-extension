// Turns failed runs and build errors into the actionable messages of R10, and of feature 008 for a crate.
import type { RunOutcome } from './runner';
import type { AnalyzeErrorCode, CharRange } from './types';

export interface Failure {
  code: AnalyzeErrorCode;
  message: string;
}

/** Codes meaning the file needs a module or crate that a single-file crate cannot provide (D6, R10). */
export const SINGLE_FILE_LIMIT_CODES = ['E0432', 'E0433', 'E0463', 'E0583'];

/** One compiler error from `cargo check --message-format=json`. */
export interface CompilerError {
  code: string | undefined;
  message: string;
  /** The compiler's own human-readable text, written to the output channel. */
  rendered: string;
  /** Where the error is: its primary span's file, as cargo names it, and its 1-based line. */
  place?: { file: string; line: number };
}

/** The errors in cargo's JSON message stream; warnings, notes and non-compiler lines are skipped. */
export function parseCompilerErrors(stdout: string): CompilerError[] {
  const errors: CompilerError[] = [];
  for (const line of stdout.split('\n')) {
    if (!line.startsWith('{')) continue;
    try {
      const msg = JSON.parse(line) as {
        reason?: string;
        message?: {
          level?: string;
          message?: string;
          code?: { code?: string } | null;
          rendered?: string | null;
          spans?: { file_name?: string; line_start?: number; is_primary?: boolean }[];
        };
      };
      const m = msg.message;
      if (msg.reason !== 'compiler-message' || m?.level !== 'error') continue;
      const span = m.spans?.find((s) => s.is_primary && s.file_name && s.line_start);
      const place = span ? { file: span.file_name as string, line: span.line_start as number } : undefined;
      errors.push({ code: m.code?.code, message: m.message ?? '', rendered: m.rendered ?? m.message ?? '', ...(place ? { place } : {}) });
    } catch {
      // Not a JSON line; cargo only writes JSON here, so ignore anything else.
    }
  }
  return errors;
}

/**
 * Explains why no body could be analysed at the cursor when the analysis reported build errors:
 * the single-file limit when any error is one of its codes, otherwise compile errors (R10).
 */
export function classifyBuildErrors(buildErrors: (CharRange | null)[], errors: CompilerError[]): Failure {
  const names = unique(
    errors
      .filter((e) => e.code !== undefined && SINGLE_FILE_LIMIT_CODES.includes(e.code))
      .map((e) => /`([^`]+)`/.exec(e.message)?.[1])
      .filter((name): name is string => Boolean(name)),
  );
  if (names.length > 0) {
    const list = names.map((n) => `\`${n}\``).join(', ');
    return {
      code: 'singleFileLimit',
      message:
        `The file uses ${list}, which a single file cannot provide: this version analyses the file on its own, ` +
        'without its other modules or its dependencies. If a name is misspelt instead, correct it and run again.',
    };
  }
  const lines = unique(buildErrors.flatMap((r) => (r ? [r.start.line + 1] : []))).sort((a, b) => a - b);
  const where = lines.length === 0 ? '' : ` (${lines.length === 1 ? 'function at line' : 'functions at lines'} ${lines.join(', ')})`;
  return {
    code: 'compileErrors',
    message: `The function at the cursor could not be analysed because the file has compile errors${where}. The compiler's messages are in the Aquascope output.`,
  };
}

/**
 * Why a run on a crate could not build it, from cargo's error output (feature 008): a dependency missing
 * from the cargo cache (R6), or no linker for a build script or proc macro (R7). Undefined for anything else.
 */
export function crateBuildFailure(stderr: string, platform: NodeJS.Platform = process.platform): Failure | undefined {
  const missing = /no matching package named `([^`]+)` found/.exec(stderr) ?? /failed to (?:download|get) `([^`\s]+)/.exec(stderr);
  if (missing) {
    return {
      code: 'dependencyMissing',
      message:
        `The crate depends on \`${missing[1]}\`, which is not in the cargo cache, and Aquascope never downloads. ` +
        'Run `cargo fetch` in the project, then run the analysis again.',
    };
  }
  const linker = /linker `([^`]+)` not found/.exec(stderr);
  if (linker) {
    const install =
      platform === 'darwin'
        ? 'On macOS, install the Xcode Command Line Tools with `xcode-select --install`.'
        : platform === 'win32'
          ? "On Windows, install Visual Studio's Build Tools with the C++ workload."
          : "Install your system's C compiler, such as `gcc` or `clang`.";
    return {
      code: 'linkerMissing',
      message: `The crate has build scripts or proc macros, which need a system linker, and \`${linker[1]}\` was not found. ${install}`,
    };
  }
  return undefined;
}

/** The compile errors of a crate that kept the function at the cursor from being analysed (feature 008, R8). */
export function crateCompileErrors(errors: CompilerError[]): Failure {
  const places = unique(errors.flatMap((e) => (e.place ? [`${e.place.file} line ${e.place.line}`] : [])));
  const shown = places.slice(0, 5);
  const where = shown.length === 0 ? '' : `, in ${shown.join(', ')}${places.length > shown.length ? ` and ${places.length - shown.length} more` : ''}`;
  return {
    code: 'compileErrors',
    message: `The function at the cursor could not be analysed because the crate has compile errors${where}. The compiler's messages are in the Aquascope output.`,
  };
}

/** A build script, which rustc_plugin cannot select as the crate to analyse (feature 008, R10). */
export function unsupportedTarget(packageName: string): Failure {
  return {
    code: 'unsupportedTarget',
    message: `This version cannot analyse a build script (the build.rs of ${packageName}). Its library, binaries, tests, examples and benches can be analysed.`,
  };
}

/** A file of a package with no binary: Show Stack and Heap has no program to run (feature 009, R1). */
export function noBinary(packageName: string): Failure {
  return {
    code: 'noBinary',
    message: `Show Stack and Heap runs a program, and the package ${packageName} has no binary: no src/main.rs and no [[bin]] target. Open a file of a package with a binary, or a file with its own main.`,
  };
}

/** Explains a run that did not finish with exit code 0 (R8, R10). */
export function runFailure(outcome: RunOutcome, what: string, timeoutSeconds: number): Failure {
  switch (outcome.kind) {
    case 'timeout':
      return {
        code: 'timeout',
        message: `The analysis was stopped after ${timeoutSeconds} s. Run it again, or raise \`aquascope.analysisTimeoutSeconds\`.`,
      };
    case 'cancelled':
      return { code: 'cancelled', message: 'The analysis was cancelled.' };
    case 'spawnError':
      return { code: 'toolFailed', message: `${what} could not be started (${outcome.error?.message ?? 'unknown error'}).` };
    default:
      return { code: 'toolFailed', message: `${what} failed with exit code ${outcome.exitCode}. The details are in the Aquascope output.` };
  }
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}
