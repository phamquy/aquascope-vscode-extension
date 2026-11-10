// Feature 009: which binary Show Stack and Heap runs and with which arguments (R1, R3, D1, D2, AC7), from the
// metadata T-051 captured, with the dialogs and the store replaced.
import * as assert from 'assert';
import * as path from 'path';
import { noBinary } from '../../analysis/errors';
import {
  binaryFor,
  chooseProgram,
  ProgramDialogs,
  ProgramStore,
  quoteArguments,
  splitArguments,
  storeKey,
} from '../../analysis/program';
import { CargoMetadata, CrateInProject, locateInMetadata } from '../../analysis/project';
import { fixtureData } from './harness';

/** A file of a project T-051 captured, located as feature 008 locates it. */
function crateOf(project: string, file: string): CrateInProject {
  const metadata = JSON.parse(fixtureData(`stack-heap-crate/${project}.metadata.json`)) as CargoMetadata;
  const located = locateInMetadata(metadata, path.join(metadata.workspace_root, file));
  assert.strictEqual(located.kind, 'crate', JSON.stringify(located));
  return located as CrateInProject;
}

/** A store in memory, like `workspaceState`. */
function memoryStore(): ProgramStore & { values: Map<string, unknown> } {
  const values = new Map<string, unknown>();
  return {
    values,
    get: <T>(key: string) => values.get(key) as T | undefined,
    update: (key, value) => {
      values.set(key, value);
      return Promise.resolve();
    },
  };
}

/** Dialogs that answer from scripts and record what they were asked. */
function scriptedDialogs(answers: { binary?: string; arguments?: (string | undefined)[] }): ProgramDialogs & {
  picks: { binaries: string[]; last: string | undefined }[];
  asked: { binary: string; last: string }[];
} {
  const picks: { binaries: string[]; last: string | undefined }[] = [];
  const asked: { binary: string; last: string }[] = [];
  const replies = [...(answers.arguments ?? [])];
  return {
    picks,
    asked,
    pickBinary: (_pkg, binaries, last) => {
      picks.push({ binaries: binaries.map((b) => b.name), last });
      return Promise.resolve(answers.binary);
    },
    askArguments: (binary, last) => {
      asked.push({ binary, last });
      return Promise.resolve(replies.shift());
    },
  };
}

suite('the package binaries and library (feature 009, R1)', () => {
  test('a split crate has one binary and a library, with root files relative to the workspace root', () => {
    const found = crateOf('minigrep-book', 'src/config.rs');
    assert.deepStrictEqual(found.binaries, [{ name: 'minigrep', rootFile: 'src/main.rs' }]);
    assert.strictEqual(found.libraryRoot, 'src/lib.rs');
  });

  test('a package with a binary under src/bin lists both binaries', () => {
    assert.deepStrictEqual(crateOf('two-bins', 'src/lib.rs').binaries, [
      { name: 'two-bins', rootFile: 'src/main.rs' },
      { name: 'whisper', rootFile: 'src/bin/whisper.rs' },
    ]);
  });

  test('a member of a workspace has its own package: a binary member has no library, a library member no binary', () => {
    const app = crateOf('workspace-bin', 'app/src/main.rs');
    assert.deepStrictEqual([app.binaries, app.libraryRoot], [[{ name: 'app', rootFile: 'app/src/main.rs' }], undefined]);
    const greeter = crateOf('workspace-bin', 'greeter/src/lib.rs');
    assert.deepStrictEqual([greeter.binaries, greeter.libraryRoot], [[], 'greeter/src/lib.rs']);
  });
});

suite('which binary runs (D1)', () => {
  test("a binary's own file runs that binary, even when another was run last", () => {
    const choice = binaryFor(crateOf('two-bins', 'src/bin/whisper.rs'), 'two-bins');
    assert.deepStrictEqual(choice, { kind: 'binary', binary: { name: 'whisper', rootFile: 'src/bin/whisper.rs' } });
  });

  test("a module of the library runs the package's only binary", () => {
    const choice = binaryFor(crateOf('minigrep-book', 'src/config.rs'), undefined);
    assert.deepStrictEqual(choice, { kind: 'binary', binary: { name: 'minigrep', rootFile: 'src/main.rs' } });
  });

  test('with several binaries, the user picks, with the one run last offered first', () => {
    const crate = crateOf('two-bins', 'src/lib.rs');
    const names = (last?: string) => {
      const choice = binaryFor(crate, last);
      assert.strictEqual(choice.kind, 'pick');
      return choice.kind === 'pick' ? choice.binaries.map((b) => b.name) : [];
    };
    assert.deepStrictEqual(names(), ['two-bins', 'whisper']);
    assert.deepStrictEqual(names('whisper'), ['whisper', 'two-bins']);
  });

  test('a package without a binary has none, and its message names the package', () => {
    assert.deepStrictEqual(binaryFor(crateOf('workspace-bin', 'greeter/src/lib.rs'), undefined), { kind: 'none' });
    const failure = noBinary('greeter');
    assert.strictEqual(failure.code, 'noBinary');
    assert.match(failure.message, /package greeter has no binary/);
  });
});

suite('splitting the arguments as a shell does (D2)', () => {
  const split = (text: string) => splitArguments(text);

  test('blanks separate arguments, and none is an empty list', () => {
    assert.deepStrictEqual(split('frog poem.txt'), { arguments: ['frog', 'poem.txt'] });
    assert.deepStrictEqual(split('  frog \t poem.txt  '), { arguments: ['frog', 'poem.txt'] });
    assert.deepStrictEqual(split(''), { arguments: [] });
    assert.deepStrictEqual(split('   '), { arguments: [] });
  });

  test('quotes keep blanks inside one argument, and an empty pair is an empty argument', () => {
    assert.deepStrictEqual(split('"a frog" poem.txt'), { arguments: ['a frog', 'poem.txt'] });
    assert.deepStrictEqual(split("'to be' or"), { arguments: ['to be', 'or'] });
    assert.deepStrictEqual(split('x"y z"w'), { arguments: ['xy zw'] });
    assert.deepStrictEqual(split('"" a'), { arguments: ['', 'a'] });
  });

  test('a backslash keeps the next character, inside double quotes only before ", \\, $ and a backtick', () => {
    assert.deepStrictEqual(split('a\\ frog'), { arguments: ['a frog'] });
    assert.deepStrictEqual(split('"say \\"hi\\""'), { arguments: ['say "hi"'] });
    assert.deepStrictEqual(split('"C:\\dir"'), { arguments: ['C:\\dir'] });
    assert.deepStrictEqual(split("'it\\'"), { arguments: ['it\\'] });
  });

  test('an unclosed quote is an error that names the quote', () => {
    assert.match((split('"a frog') as { error: string }).error, /double quote/);
    assert.match((split("it's") as { error: string }).error, /single quote/);
  });

  test('quoting arguments gives text that splits back into them', () => {
    const cases = [['frog', 'poem.txt'], ['a frog', "it's", ''], ['$HOME', 'a"b', 'back\\slash'], []];
    for (const args of cases) assert.deepStrictEqual(split(quoteArguments(args)), { arguments: args }, quoteArguments(args));
    assert.strictEqual(quoteArguments(['frog', 'poem.txt']), 'frog poem.txt');
  });
});

suite('choosing and remembering the program (D1, D2, AC7)', () => {
  test('AC7: the arguments given for a project are offered again on the next run', async () => {
    const crate = crateOf('minigrep-book', 'src/main.rs');
    const store = memoryStore();
    const first = scriptedDialogs({ arguments: ['"a frog" poem.txt'] });
    assert.deepStrictEqual(await chooseProgram(crate, store, first), {
      kind: 'chosen',
      binary: { name: 'minigrep', rootFile: 'src/main.rs' },
      arguments: ['a frog', 'poem.txt'],
    });
    assert.deepStrictEqual(first.asked, [{ binary: 'minigrep', last: '' }]);

    const second = scriptedDialogs({ arguments: ['frog poem.txt'] });
    await chooseProgram(crateOf('minigrep-book', 'src/config.rs'), store, second);
    assert.deepStrictEqual(second.asked, [{ binary: 'minigrep', last: '"a frog" poem.txt' }], 'the text as typed, quotes and all');
  });

  test('Escape in the input box cancels the run and remembers nothing', async () => {
    const store = memoryStore();
    const dialogs = scriptedDialogs({ arguments: [undefined] });
    assert.deepStrictEqual(await chooseProgram(crateOf('minigrep-book', 'src/main.rs'), store, dialogs), { kind: 'cancelled' });
    assert.strictEqual(store.values.size, 0);
  });

  test('with several binaries the pick is remembered and offered first, and each binary keeps its own arguments', async () => {
    const crate = crateOf('two-bins', 'src/lib.rs');
    const store = memoryStore();
    const first = scriptedDialogs({ binary: 'whisper', arguments: ['--quiet'] });
    const chosen = await chooseProgram(crate, store, first);
    assert.strictEqual(chosen.kind === 'chosen' && chosen.binary.name, 'whisper');
    assert.deepStrictEqual(first.picks, [{ binaries: ['two-bins', 'whisper'], last: undefined }]);

    const second = scriptedDialogs({ binary: 'two-bins', arguments: ['loud'] });
    await chooseProgram(crate, store, second);
    assert.deepStrictEqual(second.picks, [{ binaries: ['whisper', 'two-bins'], last: 'whisper' }]);
    assert.deepStrictEqual(second.asked, [{ binary: 'two-bins', last: '' }]);
    assert.deepStrictEqual(store.values.get(storeKey(crate)), { binary: 'two-bins', arguments: { whisper: '--quiet', 'two-bins': 'loud' } });
  });

  test('Escape in the pick cancels the run', async () => {
    const dialogs = scriptedDialogs({ binary: undefined });
    assert.deepStrictEqual(await chooseProgram(crateOf('two-bins', 'src/lib.rs'), memoryStore(), dialogs), { kind: 'cancelled' });
    assert.deepStrictEqual(dialogs.asked, [], 'no arguments asked');
  });

  test('a caller may give the binary and the arguments, which are remembered as text without asking', async () => {
    const crate = crateOf('two-bins', 'src/lib.rs');
    const store = memoryStore();
    const dialogs = scriptedDialogs({});
    const chosen = await chooseProgram(crate, store, dialogs, { binary: 'whisper', arguments: ['a frog'] });
    assert.deepStrictEqual(chosen, { kind: 'chosen', binary: { name: 'whisper', rootFile: 'src/bin/whisper.rs' }, arguments: ['a frog'] });
    assert.deepStrictEqual([dialogs.picks, dialogs.asked], [[], []]);
    assert.deepStrictEqual(store.values.get(storeKey(crate)), { binary: 'whisper', arguments: { whisper: "'a frog'" } });
  });

  test('a package without a binary, or a binary name it does not have, is noBinary', async () => {
    const dialogs = scriptedDialogs({});
    assert.deepStrictEqual(await chooseProgram(crateOf('workspace-bin', 'greeter/src/lib.rs'), memoryStore(), dialogs), { kind: 'noBinary' });
    assert.deepStrictEqual(await chooseProgram(crateOf('two-bins', 'src/lib.rs'), memoryStore(), dialogs, { binary: 'shout' }), { kind: 'noBinary' });
  });
});
