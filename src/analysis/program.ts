// Chooses which binary of a package Show Stack and Heap runs, and with which command-line arguments (feature
// 009, R1, R3, D1, D2). Both are remembered per package of a project in the extension's workspace state, so
// that the next run offers them again (AC7). The dialogs and the store are passed in, so the choices can be
// tested without driving VS Code's UI.
import * as vscode from 'vscode';
import type { CrateInProject, PackageBinary } from './project';

/** Where the choices are remembered; `ExtensionContext.workspaceState` is one. */
export interface ProgramStore {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Thenable<void>;
}

/** The two questions a run may ask. Each resolves to `undefined` when the user presses Escape. */
export interface ProgramDialogs {
  /** Which binary to run; `binaries` has the last one run first. Resolves to its name. */
  pickBinary(packageName: string, binaries: PackageBinary[], last: string | undefined): Thenable<string | undefined>;
  /** The arguments, as text a shell would split; `last` is the text given last time, or `''`. */
  askArguments(binary: string, last: string): Thenable<string | undefined>;
}

/** What the command's caller may give instead of asking, as the tests do. */
export interface GivenProgram {
  binary?: string;
  arguments?: string[];
}

export type ProgramChoice =
  | { kind: 'chosen'; binary: PackageBinary; arguments: string[] }
  /** The user pressed Escape: the run stops without a message. */
  | { kind: 'cancelled' }
  /** The package has no binary, or none of the name given (R1). */
  | { kind: 'noBinary' };

/** What is remembered for one package of a project. */
interface Remembered {
  binary?: string;
  /** The text of the arguments last given to each binary, by its name. */
  arguments?: Record<string, string>;
}

/** The key the choices for `crate`'s package are stored under. */
export function storeKey(crate: CrateInProject): string {
  return `aquascope.program:${crate.copyRoot}:${crate.packageName}`;
}

export type BinaryChoice =
  | { kind: 'binary'; binary: PackageBinary }
  /** Several binaries and no reason to prefer one: ask, offering `binaries` with the last one run first. */
  | { kind: 'pick'; binaries: PackageBinary[] }
  | { kind: 'none' };

/**
 * The binary to run for a file of `crate` (D1): the file's own binary when it belongs to one; otherwise the
 * package's only binary; otherwise a choice among them, the one run last offered first.
 */
export function binaryFor(crate: CrateInProject, last: string | undefined): BinaryChoice {
  const own = crate.target.kind === 'bin' ? crate.binaries.find((b) => b.name === crate.target.name) : undefined;
  if (own) return { kind: 'binary', binary: own };
  if (crate.binaries.length === 0) return { kind: 'none' };
  if (crate.binaries.length === 1) return { kind: 'binary', binary: crate.binaries[0] };
  const lastFirst = [...crate.binaries].sort((a, b) => Number(b.name === last) - Number(a.name === last));
  return { kind: 'pick', binaries: lastFirst };
}

export type SplitArguments = { arguments: string[] } | { error: string };

/**
 * Splits `text` into arguments as a POSIX shell does, without expansions: blanks separate arguments, single
 * quotes keep everything up to the next one, double quotes keep everything but a backslash before `"`, `\`,
 * `$` or a backtick, and a backslash outside quotes keeps the next character. An unclosed quote is an error.
 */
export function splitArguments(text: string): SplitArguments {
  const args: string[] = [];
  let current = '';
  let inArgument = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === ' ' || c === '\t' || c === '\n') {
      if (inArgument) args.push(current);
      current = '';
      inArgument = false;
    } else if (c === "'") {
      const end = text.indexOf("'", i + 1);
      if (end < 0) return { error: 'A single quote (\') is not closed.' };
      current += text.slice(i + 1, end);
      inArgument = true;
      i = end;
    } else if (c === '"') {
      let j = i + 1;
      for (; j < text.length && text[j] !== '"'; j++) {
        if (text[j] === '\\' && j + 1 < text.length && '"\\$`'.includes(text[j + 1])) j++;
        current += text[j];
      }
      if (j >= text.length) return { error: 'A double quote (") is not closed.' };
      inArgument = true;
      i = j;
    } else if (c === '\\' && i + 1 < text.length) {
      current += text[++i];
      inArgument = true;
    } else {
      current += c;
      inArgument = true;
    }
  }
  if (inArgument) args.push(current);
  return { arguments: args };
}

/** Text that `splitArguments` splits back into `args`, quoting only the arguments that need it. */
export function quoteArguments(args: string[]): string {
  return args.map((arg) => (/^[\w@%+=:,./-]+$/.test(arg) ? arg : `'${arg.replace(/'/g, `'\\''`)}'`)).join(' ');
}

/**
 * Chooses the binary and the arguments for a run on a file of `crate`, asking only what `given` does not
 * settle, and remembers both for the package. The arguments are remembered as the text given, so the next
 * run's input box shows what the user typed (D2, AC7).
 */
export async function chooseProgram(
  crate: CrateInProject,
  store: ProgramStore,
  dialogs: ProgramDialogs,
  given: GivenProgram = {},
): Promise<ProgramChoice> {
  const key = storeKey(crate);
  const remembered = store.get<Remembered>(key) ?? {};

  let binary: PackageBinary | undefined;
  if (given.binary !== undefined) {
    binary = crate.binaries.find((b) => b.name === given.binary);
    if (!binary) return { kind: 'noBinary' };
  } else {
    const choice = binaryFor(crate, remembered.binary);
    if (choice.kind === 'none') return { kind: 'noBinary' };
    if (choice.kind === 'binary') binary = choice.binary;
    else {
      const name = await dialogs.pickBinary(crate.packageName, choice.binaries, remembered.binary);
      binary = choice.binaries.find((b) => b.name === name);
      if (!binary) return { kind: 'cancelled' };
    }
  }

  let args: string[];
  let text: string;
  if (given.arguments !== undefined) {
    args = given.arguments;
    text = quoteArguments(args);
  } else {
    const answer = await dialogs.askArguments(binary.name, remembered.arguments?.[binary.name] ?? '');
    if (answer === undefined) return { kind: 'cancelled' };
    const split = splitArguments(answer);
    if ('error' in split) return { kind: 'cancelled' }; // the input box does not accept such text
    args = split.arguments;
    text = answer;
  }

  await store.update(key, { binary: binary.name, arguments: { ...remembered.arguments, [binary.name]: text } } satisfies Remembered);
  return { kind: 'chosen', binary, arguments: args };
}

/** The dialogs, in VS Code. */
export const vscodeDialogs: ProgramDialogs = {
  async pickBinary(packageName, binaries, last) {
    const items = binaries.map((b) => ({ label: b.name, description: b.rootFile, detail: b.name === last ? 'Run last time' : undefined }));
    const picked = await vscode.window.showQuickPick(items, {
      title: 'Aquascope: Show Stack and Heap',
      placeHolder: `Which program of ${packageName} to run`,
      ignoreFocusOut: true,
    });
    return picked?.label;
  },
  askArguments(binary, last) {
    return vscode.window.showInputBox({
      title: `Aquascope: arguments for ${binary}`,
      prompt: 'The command-line arguments to run the program with, as you would type them after cargo run --. Leave empty for none.',
      placeHolder: 'for example: frog poem.txt',
      value: last,
      ignoreFocusOut: true,
      validateInput: (text) => {
        const split = splitArguments(text);
        return 'error' in split ? split.error : undefined;
      },
    });
  },
};
