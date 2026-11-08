import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { DEFAULT_EDITION, detectEdition, manifestFor, writeCrate } from '../../analysis/scratchCrate';

suite('edition detection (R2)', () => {
  let tmp: string;
  setup(() => (tmp = mkdtempSync(path.join(os.tmpdir(), 'aquascope-edition-'))));
  teardown(() => rmSync(tmp, { recursive: true, force: true }));

  /** Writes `files` (relative path -> contents) under the temporary directory. */
  function tree(files: Record<string, string>): void {
    for (const [rel, text] of Object.entries(files)) {
      mkdirSync(path.dirname(path.join(tmp, rel)), { recursive: true });
      writeFileSync(path.join(tmp, rel), text);
    }
  }
  const at = (rel: string): string => path.join(tmp, rel);

  test('reads the edition of the nearest package', () => {
    tree({
      'Cargo.toml': '[package]\nname = "outer"\nedition = "2018"\n',
      'inner/Cargo.toml': '# a comment\n[package]\nname = "inner"\nedition = "2021" # trailing\n\n[dependencies]\nedition = "2015"\n',
    });
    assert.strictEqual(detectEdition(at('inner/src/deep/main.rs')), '2021');
    assert.strictEqual(detectEdition(at('src/lib.rs')), '2018');
  });

  test('follows edition.workspace = true to the workspace root, in both spellings', () => {
    tree({
      'Cargo.toml': '[workspace]\nmembers = ["a", "b"]\n\n[workspace.package]\nedition = "2018"\n',
      'a/Cargo.toml': '[package]\nname = "a"\nedition.workspace = true\n',
      'b/Cargo.toml': "[package]\nname = 'b'\nedition = { workspace = true }\n",
    });
    assert.strictEqual(detectEdition(at('a/src/lib.rs')), '2018');
    assert.strictEqual(detectEdition(at('b/src/main.rs')), '2018');
  });

  test('uses the workspace edition for a file beside a virtual manifest', () => {
    tree({ 'Cargo.toml': '[workspace.package]\nedition = "2021"\n' });
    assert.strictEqual(detectEdition(at('scripts/tool.rs')), '2021');
  });

  test('treats a package without an edition as 2015, as cargo does', () => {
    tree({ 'Cargo.toml': '[package]\nname = "old"\n\n[[bin]]\nname = "x"\nedition = "2021"\n' });
    assert.strictEqual(detectEdition(at('src/main.rs')), '2015');
  });

  test('falls back to 2024 without a manifest, for untitled files and for unreadable manifests', () => {
    assert.strictEqual(detectEdition(undefined), DEFAULT_EDITION);
    assert.strictEqual(detectEdition(at('loose/scratch.rs')), DEFAULT_EDITION);
    tree({ 'Cargo.toml': '[package]\nedition = "2021"\n' });
    const unreadable = (): string => {
      throw new Error('EACCES');
    };
    assert.strictEqual(detectEdition(at('src/lib.rs'), unreadable), DEFAULT_EDITION);
  });

  test('falls back to 2024 when an inherited edition has no workspace root', () => {
    tree({ 'pkg/Cargo.toml': '[package]\nedition.workspace = true\n' });
    assert.strictEqual(detectEdition(at('pkg/src/lib.rs')), DEFAULT_EDITION);
  });
});

suite('temporary crate (R2, R9)', () => {
  let storage: string;
  setup(() => (storage = mkdtempSync(path.join(os.tmpdir(), 'aquascope-storage-'))));
  teardown(() => rmSync(storage, { recursive: true, force: true }));

  test('writes a dependency-free library crate holding the text unchanged', () => {
    const source = 'struct P { x: i32 }\r\nfn main() {\r\n    let s = "héllo 🦀";\r\n}\r\n';
    const dir = writeCrate(storage, source, '2021');
    assert.strictEqual(path.dirname(dir), path.join(storage, 'runs'));
    assert.strictEqual(readFileSync(path.join(dir, 'src', 'lib.rs'), 'utf8'), source);
    const manifest = readFileSync(path.join(dir, 'Cargo.toml'), 'utf8');
    assert.strictEqual(manifest, manifestFor('2021'));
    assert.match(manifest, /^edition = "2021"$/m);
    assert.match(manifest, /^\[workspace\]$/m);
    assert.doesNotMatch(manifest, /dependencies/);
    assert.deepStrictEqual(readdirSync(dir).sort(), ['Cargo.toml', 'src']);
  });

  test('writes a program crate for the interpreter, with the text as src/main.rs (feature 007 R2)', () => {
    const source = 'fn main() {\n    let s = String::from("hi");\n}\n';
    const dir = writeCrate(storage, source, '2024', { form: 'bin' });
    assert.deepStrictEqual(readdirSync(path.join(dir, 'src')), ['main.rs']);
    assert.strictEqual(readFileSync(path.join(dir, 'src', 'main.rs'), 'utf8'), source);
    const manifest = readFileSync(path.join(dir, 'Cargo.toml'), 'utf8');
    assert.strictEqual(manifest, manifestFor('2024', 'bin'));
    assert.match(manifest, /^\[\[bin\]\]\nname = "aquascope_scratch"\npath = "src\/main.rs"$/m);
    assert.doesNotMatch(manifest, /\[lib\]/);
    assert.match(manifest, /^\[workspace\]$/m);
  });

  test('deletes earlier runs of this host and of exited hosts, but keeps a live window\'s run', () => {
    const live = (pid: number): boolean => pid === 222;
    const own1 = writeCrate(storage, 'fn a() {}', '2024', { pid: 111, isAlive: live });
    const other = writeCrate(storage, 'fn b() {}', '2024', { pid: 222, isAlive: live });
    const exited = writeCrate(storage, 'fn c() {}', '2024', { pid: 333, isAlive: () => true });
    mkdirSync(path.join(storage, 'runs', 'stray'));
    const own2 = writeCrate(storage, 'fn d() {}', '2024', { pid: 111, isAlive: live });
    assert.ok(!existsSync(own1), 'own earlier run kept');
    assert.ok(!existsSync(exited), 'exited host run kept');
    assert.ok(!existsSync(path.join(storage, 'runs', 'stray')), 'unrecognised entry kept');
    assert.ok(existsSync(other), 'live window run deleted');
    assert.deepStrictEqual(readdirSync(path.join(storage, 'runs')).sort(), [path.basename(other), path.basename(own2)].sort());
  });

  test('names runs after the real process id by default', () => {
    const dir = writeCrate(storage, '', '2024');
    assert.ok(path.basename(dir).startsWith(`${process.pid}-`), dir);
  });
});
