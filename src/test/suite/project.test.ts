// Feature 008: finding the crate a file belongs to (R1, R10, D7, D8), from the metadata T-044 captured, and
// once against the bundled cargo.
import * as assert from 'assert';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CargoMetadata, CrateInProject, CrateLocation, locateCrate, locateInMetadata, metadataFailure } from '../../analysis/project';
import { runEnvironment } from '../../analysis/toolchain';
import { fixtureData, requireToolchain } from './harness';

const metadata = (name: string): CargoMetadata => JSON.parse(fixtureData(`crate/${name}.metadata.json`)) as CargoMetadata;

function crate(location: CrateLocation): CrateInProject {
  assert.strictEqual(location.kind, 'crate', JSON.stringify(location));
  return location as CrateInProject;
}

/** The target chosen for each file of a captured project. */
function targets(name: string, files: string[]): Record<string, string> {
  const m = metadata(name);
  return Object.fromEntries(
    files.map((f) => {
      const located = locateInMetadata(m, path.join(m.workspace_root, f));
      return [f, located.kind === 'crate' ? `${located.target.kind} ${located.target.name}` : located.kind];
    }),
  );
}

suite('finding the crate of a file (feature 008, R1, R10)', () => {
  test('a module of a split crate is in the library, with its path relative to the workspace root', () => {
    const found = crate(locateInMetadata(metadata('minigrep'), '/copies/minigrep/src/config.rs'));
    assert.deepStrictEqual(found, {
      kind: 'crate',
      workspaceRoot: '/copies/minigrep',
      packageName: 'minigrep',
      target: { name: 'minigrep', kind: 'lib' },
      relativePath: 'src/config.rs',
      externalPathDependencies: [],
      copyRoot: '/copies/minigrep',
      copyFolders: ['.'],
    });
  });

  test("chooses each file's target as rustc_plugin does: main.rs is the binary, other files the library", () => {
    assert.deepStrictEqual(targets('minigrep', ['src/main.rs', 'src/lib.rs', 'src/config.rs', 'tests/cli.rs']), {
      'src/main.rs': 'bin minigrep',
      'src/lib.rs': 'lib minigrep',
      'src/config.rs': 'lib minigrep',
      'tests/cli.rs': 'test cli',
    });
  });

  test('analyses tests, examples and benches with their own targets, and stops at a build script (D7, revised)', () => {
    assert.deepStrictEqual(targets('targets', ['src/lib.rs', 'tests/it.rs', 'examples/demo.rs', 'benches/speed.rs', 'build.rs']), {
      'src/lib.rs': 'lib targets',
      'tests/it.rs': 'test it',
      'examples/demo.rs': 'example demo',
      'benches/speed.rs': 'bench speed',
      'build.rs': 'buildScript',
    });
    assert.deepStrictEqual(locateInMetadata(metadata('targets'), '/copies/targets/build.rs'), { kind: 'buildScript', packageName: 'targets' });
  });

  test('a workspace member is found with its path from the workspace root; members are not external dependencies', () => {
    const found = crate(locateInMetadata(metadata('workspace'), '/copies/workspace/app/src/lib.rs'));
    assert.strictEqual(found.packageName, 'ws-app');
    assert.strictEqual(found.relativePath, 'app/src/lib.rs');
    assert.deepStrictEqual([found.externalPathDependencies, found.copyRoot, found.copyFolders], [[], '/copies/workspace', ['.']]);
    assert.strictEqual(crate(locateInMetadata(metadata('workspace'), '/copies/workspace/core/src/lib.rs')).packageName, 'ws-core');
    assert.strictEqual(crate(locateInMetadata(metadata('proc-macro'), '/copies/proc-macro/app/src/lib.rs')).target.kind, 'lib');
  });

  test('a path dependency outside the workspace widens the copy root, and only the two folders are copied (D1)', () => {
    const found = crate(locateInMetadata(metadata('external-path'), '/copies/external-path/app/src/lib.rs'));
    assert.strictEqual(found.workspaceRoot, '/copies/external-path/app');
    assert.strictEqual(found.relativePath, 'src/lib.rs');
    assert.deepStrictEqual(found.externalPathDependencies, ['/copies/external-path/shared']);
    assert.strictEqual(found.copyRoot, '/copies/external-path');
    assert.deepStrictEqual(found.copyFolders, ['app', 'shared']);
  });

  test('a crates.io dependency is not copied', () => {
    assert.deepStrictEqual(crate(locateInMetadata(metadata('with-dep'), '/copies/with-dep/src/lib.rs')).copyFolders, ['.']);
  });

  test('a file in no target, or outside the workspace, is analysed alone (D8)', () => {
    assert.deepStrictEqual(locateInMetadata(metadata('minigrep'), '/copies/minigrep/scripts/tool.rs'), { kind: 'none' });
    assert.deepStrictEqual(locateInMetadata(metadata('minigrep'), '/elsewhere/src/lib.rs'), { kind: 'none' });
    assert.deepStrictEqual(locateInMetadata(metadata('minigrep'), '/copies/minigrep-other/src/lib.rs'), { kind: 'none' }, 'compared by path components');
  });

  test('a package with binaries only puts a module file in a binary; two packages holding a file give none', () => {
    const bins: CargoMetadata = {
      workspace_root: '/p',
      packages: [
        {
          name: 'tools',
          dependencies: [],
          targets: [
            { name: 'one', kind: ['bin'], src_path: '/p/src/bin/one.rs' },
            { name: 'tools', kind: ['bin'], src_path: '/p/src/main.rs' },
          ],
        },
      ],
    };
    assert.deepStrictEqual(crate(locateInMetadata(bins, '/p/src/helpers.rs')).target, { name: 'tools', kind: 'bin' });
    assert.deepStrictEqual(crate(locateInMetadata(bins, '/p/src/bin/one.rs')).target, { name: 'one', kind: 'bin' });

    const nested: CargoMetadata = {
      workspace_root: '/w',
      packages: [
        { name: 'outer', dependencies: [], targets: [{ name: 'outer', kind: ['lib'], src_path: '/w/lib.rs' }] },
        { name: 'inner', dependencies: [], targets: [{ name: 'inner', kind: ['lib'], src_path: '/w/inner/lib.rs' }] },
      ],
    };
    assert.deepStrictEqual(locateInMetadata(nested, '/w/inner/lib.rs'), { kind: 'none' });
  });

  test("cargo's missing-manifest error means no package; any other failure is reported", () => {
    assert.deepStrictEqual(metadataFailure('error: could not find `Cargo.toml` in `/tmp/x` or any parent directory\n'), { kind: 'none' });
    assert.deepStrictEqual(metadataFailure('error: failed to parse manifest at `/p/Cargo.toml`\n'), {
      kind: 'metadataFailed',
      detail: 'error: failed to parse manifest at `/p/Cargo.toml`',
    });
  });
});

suite('finding the crate with the bundled cargo (feature 008, R1)', function () {
  this.timeout(30_000);
  let bundle: string;
  let dir: string;

  suiteSetup(function () {
    bundle = requireToolchain(this);
  });
  setup(() => {
    // os.tmpdir() is below /var on macOS, a link to /private/var, so the file is spelt as cargo does not spell it.
    dir = mkdtempSync(path.join(os.tmpdir(), 'aquascope-project-'));
  });
  teardown(() => rmSync(dir, { recursive: true, force: true }));

  const locate = (file: string) =>
    locateCrate({
      file,
      cargo: path.join(bundle, 'toolchain', 'bin', 'cargo'),
      environment: runEnvironment(bundle, dir),
      timeoutMs: 20_000,
      log: () => undefined,
    });

  test('finds a module of a package through a linked folder', async () => {
    mkdirSync(path.join(dir, 'src'));
    writeFileSync(path.join(dir, 'Cargo.toml'), '[package]\nname = "probe"\nversion = "0.1.0"\nedition = "2024"\n');
    writeFileSync(path.join(dir, 'src', 'lib.rs'), 'mod util;\n');
    writeFileSync(path.join(dir, 'src', 'util.rs'), 'pub fn one() -> i32 { 1 }\n');
    const found = crate(await locate(path.join(dir, 'src', 'util.rs')));
    assert.strictEqual(found.relativePath, 'src/util.rs');
    assert.deepStrictEqual(found.target, { name: 'probe', kind: 'lib' });
  });

  test('a file in no package is none, and a broken manifest is reported', async () => {
    writeFileSync(path.join(dir, 'alone.rs'), 'fn main() {}\n');
    assert.deepStrictEqual(await locate(path.join(dir, 'alone.rs')), { kind: 'none' });

    writeFileSync(path.join(dir, 'Cargo.toml'), '[package\n');
    const broken = await locate(path.join(dir, 'alone.rs'));
    assert.strictEqual(broken.kind, 'metadataFailed', JSON.stringify(broken));
  });
});
