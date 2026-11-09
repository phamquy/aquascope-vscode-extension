// Feature 008: the copy of a project with the unsaved editors over it (R4, R5, D1), on temporary folders.
import * as assert from 'assert';
import { createHash } from 'crypto';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { inCopy, projectFolders, syncProject } from '../../analysis/projectCopy';

/** Writes files below `root`, creating their folders. */
function write(root: string, files: Record<string, string>): void {
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), text);
  }
}

/** Every file below `root`, by relative path, with its size, modification time and content hash. */
function snapshot(root: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rel of readdirSync(root, { recursive: true }) as string[]) {
    const full = path.join(root, rel);
    if (statSync(full).isFile()) {
      out[rel] = `${statSync(full).size} ${statSync(full).mtimeMs} ${createHash('sha1').update(readFileSync(full)).digest('hex')}`;
    }
  }
  return out;
}

/** The files of the copy, by path below its `src`, with their text. */
function copied(src: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const rel of readdirSync(src, { recursive: true }) as string[]) {
    const full = path.join(src, rel);
    if (statSync(full).isFile()) out[rel.split(path.sep).join('/')] = readFileSync(full, 'utf8');
  }
  return out;
}

suite('the project copy (feature 008, R4, R5, D1)', () => {
  let tmp: string;
  let project: string;
  let storage: string;

  setup(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'aquascope-copy-'));
    project = path.join(tmp, 'project');
    storage = path.join(tmp, 'storage');
    write(project, {
      'Cargo.toml': '[package]\nname = "p"\n',
      'src/lib.rs': 'pub mod config;\n',
      'src/config.rs': 'pub fn one() -> i32 { 1 }\n',
      'src/target/mod.rs': '// a source folder named target, without CACHEDIR.TAG\n',
      '.git/HEAD': 'ref: refs/heads/main\n',
      'target/CACHEDIR.TAG': 'Signature: 8a477f597d28d172789f06886806bc55\n',
      'target/debug/libp.rlib': 'build output',
      '.cargo/config.toml': '[build]\n',
    });
  });
  teardown(() => rmSync(tmp, { recursive: true, force: true }));

  const spec = () => ({ copyRoot: project, copyFolders: ['.'] });

  test('copies the project without .git and cargo build output, and leaves the project as it was', async () => {
    const before = snapshot(project);
    const { folders, stats } = await syncProject(storage, spec(), []);
    assert.deepStrictEqual(folders, projectFolders(storage, project));
    assert.ok(folders.src.startsWith(path.join(storage, 'projects')));
    assert.deepStrictEqual(Object.keys(copied(folders.src)).sort(), ['.cargo/config.toml', 'Cargo.toml', 'src/config.rs', 'src/lib.rs', 'src/target/mod.rs']);
    assert.deepStrictEqual([stats.files, stats.copied, stats.deleted, stats.unsaved], [5, 5, 0, 0]);
    assert.strictEqual(inCopy(folders, project, path.join(project, 'src', 'lib.rs')), path.join(folders.src, 'src', 'lib.rs'));
    assert.deepStrictEqual(snapshot(project), before, 'the project is only read');
  });

  test('a second run with nothing changed copies nothing', async () => {
    await syncProject(storage, spec(), []);
    const { stats } = await syncProject(storage, spec(), []);
    assert.deepStrictEqual([stats.files, stats.copied, stats.deleted], [5, 0, 0]);
  });

  test('copies new and changed files and deletes the copies of removed ones', async () => {
    const { folders } = await syncProject(storage, spec(), []);
    write(project, { 'src/config.rs': 'pub fn two() -> i32 { 2 }\n', 'src/extra.rs': '// new\n' });
    rmSync(path.join(project, 'src', 'target', 'mod.rs'));
    const { stats } = await syncProject(storage, spec(), []);
    assert.deepStrictEqual([stats.copied, stats.deleted], [2, 1]);
    const files = copied(folders.src);
    assert.strictEqual(files['src/config.rs'], 'pub fn two() -> i32 { 2 }\n');
    assert.strictEqual(files['src/extra.rs'], '// new\n');
    assert.ok(!('src/target/mod.rs' in files));
  });

  test("writes an unsaved editor's text over its copy, and restores the file from disk once it is not unsaved", async () => {
    const before = snapshot(project);
    const config = path.join(project, 'src', 'config.rs');
    const { folders, stats } = await syncProject(storage, spec(), [{ file: config, text: 'pub fn edited() {}\n' }]);
    assert.strictEqual(stats.unsaved, 1);
    assert.strictEqual(copied(folders.src)['src/config.rs'], 'pub fn edited() {}\n');
    assert.deepStrictEqual(snapshot(project), before, 'the unsaved text never reaches the project');

    const again = await syncProject(storage, spec(), []);
    assert.strictEqual(again.stats.copied, 1, 'the file is restored');
    assert.strictEqual(copied(folders.src)['src/config.rs'], 'pub fn one() -> i32 { 1 }\n');
  });

  test('an unsaved new file is written to the copy, and deleted when it is gone; the same unsaved text is not rewritten', async () => {
    const fresh = path.join(project, 'src', 'unsaved.rs');
    const config = path.join(project, 'src', 'config.rs');
    const { folders } = await syncProject(storage, spec(), [{ file: fresh, text: '// new\n' }, { file: config, text: '// edited\n' }]);
    assert.strictEqual(copied(folders.src)['src/unsaved.rs'], '// new\n');
    const configCopy = path.join(folders.src, 'src', 'config.rs');
    utimesSync(configCopy, new Date(2000, 0, 1), new Date(2000, 0, 1));
    await syncProject(storage, spec(), [{ file: config, text: '// edited\n' }]);
    assert.strictEqual(statSync(configCopy).mtime.getFullYear(), 2000, 'the same unsaved text is left alone, so cargo rebuilds nothing');
    assert.ok(!existsSync(path.join(folders.src, 'src', 'unsaved.rs')), 'the new file, no longer unsaved and not on disk, is deleted');
  });

  test('every file written gets the current time, even one older than the last build', async () => {
    const lib = path.join(project, 'src', 'lib.rs');
    const old = new Date(2001, 0, 1);
    utimesSync(lib, old, old);
    const startedAt = Date.now() - 1000;
    const { folders } = await syncProject(storage, spec(), []);
    assert.ok(statSync(path.join(folders.src, 'src', 'lib.rs')).mtimeMs >= startedAt, 'not the source time');

    await syncProject(storage, spec(), [{ file: lib, text: '// edited\n' }]);
    const restoreStarted = Date.now() - 1000;
    await syncProject(storage, spec(), []);
    assert.ok(statSync(path.join(folders.src, 'src', 'lib.rs')).mtimeMs >= restoreStarted, 'a restored file is newer than the build that used the unsaved text');
  });

  test('copies only the copy folders below the copy root, keeping their layout', async () => {
    write(tmp, { 'shared/src/lib.rs': 'pub struct Note;\n', 'unrelated/big.txt': 'not part of the project\n' });
    const root = tmp;
    const { folders, stats } = await syncProject(storage, { copyRoot: root, copyFolders: ['project', 'shared'] }, [
      { file: path.join(tmp, 'shared', 'src', 'lib.rs'), text: 'pub struct Edited;\n' },
      { file: path.join(tmp, 'unrelated', 'big.txt'), text: 'ignored: outside the copy folders\n' },
    ]);
    const files = copied(folders.src);
    assert.ok('project/src/lib.rs' in files);
    assert.strictEqual(files['shared/src/lib.rs'], 'pub struct Edited;\n');
    assert.ok(!Object.keys(files).some((f) => f.startsWith('unrelated/') || f.startsWith('storage/')));
    assert.strictEqual(stats.unsaved, 1);
  });
});
