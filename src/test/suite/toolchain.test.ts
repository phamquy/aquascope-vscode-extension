import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { TOOLCHAIN_SETTING, resolveMiriSysroot, resolveToolchain, runEnvironment } from '../../analysis/toolchain';
import { requireToolchain } from './harness';

/** Creates the R3 layout under `root`. */
function makeLayout(root: string): void {
  for (const file of ['bin/cargo-aquascope', 'bin/aquascope-driver', 'toolchain/bin/cargo']) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    writeFileSync(path.join(root, file), '');
  }
}

suite('toolchain resolution (R3)', () => {
  let tmp: string;
  setup(() => (tmp = mkdtempSync(path.join(os.tmpdir(), 'aquascope-toolchain-'))));
  teardown(() => rmSync(tmp, { recursive: true, force: true }));

  test('uses the setting when it points at a complete layout', () => {
    const root = path.join(tmp, 'custom');
    makeLayout(root);
    const r = resolveToolchain(`  ${root} `, path.join(tmp, 'ext'));
    assert.deepStrictEqual(r, { ok: true, root, cargo: path.join(root, 'toolchain', 'bin', 'cargo') });
  });

  test('uses the bundle inside the extension when the setting is empty', () => {
    const ext = path.join(tmp, 'ext');
    makeLayout(path.join(ext, 'aquascope'));
    for (const configured of [undefined, '', '   ']) {
      const r = resolveToolchain(configured, ext);
      assert.ok(r.ok && r.root === path.join(ext, 'aquascope'), JSON.stringify(r));
    }
  });

  test('reports a configured path that is missing, without falling back to the bundle', () => {
    const ext = path.join(tmp, 'ext');
    makeLayout(path.join(ext, 'aquascope'));
    const missing = path.join(tmp, 'nowhere');
    const r = resolveToolchain(missing, ext);
    assert.ok(!r.ok);
    assert.ok(r.message.includes(TOOLCHAIN_SETTING) && r.message.includes(missing), r.message);
  });

  test('names the missing files of an incomplete layout', () => {
    const root = path.join(tmp, 'partial');
    makeLayout(root);
    rmSync(path.join(root, 'bin', 'aquascope-driver'));
    const r = resolveToolchain(root, path.join(tmp, 'ext'));
    assert.ok(!r.ok && r.message.includes('(missing bin/aquascope-driver)'), JSON.stringify(r));
  });

  test('names the setting when there is no bundle and no setting', () => {
    const r = resolveToolchain('', path.join(tmp, 'ext'));
    assert.ok(!r.ok && r.message.includes(TOOLCHAIN_SETTING), JSON.stringify(r));
  });

  test('looks for .exe files on Windows', () => {
    const seen: string[] = [];
    const r = resolveToolchain('C:\\aq', 'C:\\ext', 'win32', (f) => (seen.push(f), true));
    assert.deepStrictEqual(seen, ['C:\\aq\\bin\\cargo-aquascope.exe', 'C:\\aq\\bin\\aquascope-driver.exe', 'C:\\aq\\toolchain\\bin\\cargo.exe']);
    assert.ok(r.ok && r.cargo === 'C:\\aq\\toolchain\\bin\\cargo.exe');
  });
});

suite('the Miri-built standard library (feature 007 R3)', () => {
  test('is found in miri-sysroot/ under the toolchain root', () => {
    const seen: string[] = [];
    const r = resolveMiriSysroot('/aq', '/aq', 'darwin', (f) => (seen.push(f), true));
    assert.deepStrictEqual(r, { ok: true, sysroot: '/aq/miri-sysroot' });
    assert.deepStrictEqual(seen, ['/aq/miri-sysroot/lib/rustlib']);
  });

  test('is reported like a missing tool, naming the setting when the root came from it', () => {
    const fromSetting = resolveMiriSysroot('/aq', ' /aq ', 'darwin', () => false);
    assert.ok(!fromSetting.ok && fromSetting.message.includes('`aquascope.toolchainPath`') && fromSetting.message.includes('/aq'), JSON.stringify(fromSetting));
    assert.ok(!fromSetting.ok && fromSetting.message.includes('npm run dev-bundle'));
    const bundled = resolveMiriSysroot('/ext/aquascope', '', 'darwin', () => false);
    assert.ok(!bundled.ok && bundled.message.startsWith('This copy of the extension does not include the standard library built for Miri'), JSON.stringify(bundled));
  });
});

suite('run environment (R4, R5)', () => {
  const root = '/aq';
  const crate = '/storage/run-1';
  const userEnv = {
    HOME: '/home/u',
    CARGO_HOME: '/home/u/.cargo',
    PATH: '/usr/bin:/bin',
    RUSTC: '/x/rustc',
    RUSTC_WRAPPER: 'sccache',
    RUSTC_WORKSPACE_WRAPPER: 'clippy-driver',
    RUSTUP_TOOLCHAIN: 'stable',
    RUSTFLAGS: '-Dwarnings',
    CARGO_TARGET_DIR: '/shared/target',
    CARGO_BUILD_TARGET: 'wasm32-unknown-unknown',
    CARGO_BUILD_RUSTC_WRAPPER: 'sccache',
    CARGO_ENCODED_RUSTFLAGS: '-Dwarnings',
  };

  test('sets extra variables such as MIRI_SYSROOT, replacing the user\'s value (feature 007 R3)', () => {
    const { env, set } = runEnvironment(root, crate, { ...userEnv, MIRI_SYSROOT: '/home/u/miri' }, 'darwin', { MIRI_SYSROOT: '/aq/miri-sysroot' });
    assert.strictEqual(env.MIRI_SYSROOT, '/aq/miri-sysroot');
    assert.strictEqual(set.MIRI_SYSROOT, '/aq/miri-sysroot');
    assert.strictEqual(runEnvironment(root, crate, userEnv, 'darwin').env.MIRI_SYSROOT, undefined);
  });

  test('puts the tool and toolchain first on PATH, then the user PATH (macOS)', () => {
    const { env } = runEnvironment(root, crate, userEnv, 'darwin');
    assert.strictEqual(env.PATH, '/aq/bin:/aq/toolchain/bin:/usr/bin:/bin');
    assert.strictEqual(env.DYLD_LIBRARY_PATH, '/aq/toolchain/lib');
    assert.strictEqual(env.LD_LIBRARY_PATH, undefined);
  });

  test('uses LD_LIBRARY_PATH on Linux', () => {
    const { env } = runEnvironment(root, crate, { ...userEnv, LD_LIBRARY_PATH: '/opt/lib' }, 'linux');
    assert.strictEqual(env.PATH, '/aq/bin:/aq/toolchain/bin:/usr/bin:/bin');
    assert.strictEqual(env.LD_LIBRARY_PATH, '/aq/toolchain/lib');
    assert.strictEqual(env.DYLD_LIBRARY_PATH, undefined);
  });

  test('puts the toolchain libraries on PATH on Windows, whatever the case of the names', () => {
    const { env } = runEnvironment('C:\\aq', 'C:\\run', { Path: 'C:\\Windows', RustFlags: '-Dwarnings' }, 'win32');
    assert.strictEqual(env.PATH, 'C:\\aq\\bin;C:\\aq\\toolchain\\bin;C:\\aq\\toolchain\\lib;C:\\Windows');
    assert.strictEqual(env.Path, undefined);
    assert.strictEqual(env.RustFlags, undefined);
    assert.strictEqual(env.CARGO_TARGET_DIR, 'C:\\run\\target');
  });

  test('removes the variables that change how the compiler runs and keeps the rest', () => {
    const { env, removed } = runEnvironment(root, crate, userEnv, 'darwin');
    for (const key of ['RUSTC', 'RUSTC_WORKSPACE_WRAPPER', 'RUSTUP_TOOLCHAIN', 'RUSTFLAGS', 'CARGO_BUILD_TARGET', 'CARGO_BUILD_RUSTC_WRAPPER']) {
      assert.ok(!(key in env), `${key} should be removed`);
      assert.ok(removed.includes(key), `${key} should be logged as removed`);
    }
    assert.strictEqual(env.HOME, '/home/u');
    assert.strictEqual(env.CARGO_HOME, '/home/u/.cargo');
  });

  test('overrides the cargo configuration settings and stays offline', () => {
    const { env, set } = runEnvironment(root, crate, userEnv, 'darwin');
    assert.strictEqual(env.RUSTC_WRAPPER, '');
    assert.strictEqual(env.CARGO_ENCODED_RUSTFLAGS, '');
    assert.strictEqual(env.CARGO_TARGET_DIR, '/storage/run-1/target');
    assert.strictEqual(env.CARGO_NET_OFFLINE, 'true');
    assert.deepStrictEqual(Object.keys(set).sort(), ['CARGO_ENCODED_RUSTFLAGS', 'CARGO_NET_OFFLINE', 'CARGO_TARGET_DIR', 'DYLD_LIBRARY_PATH', 'PATH', 'RUSTC_WRAPPER']);
  });

  test('handles an empty user PATH and leaves the base environment untouched', () => {
    const base = { RUSTFLAGS: '-Dwarnings' };
    const { env } = runEnvironment(root, crate, base, 'linux');
    assert.strictEqual(env.PATH, '/aq/bin:/aq/toolchain/bin');
    assert.deepStrictEqual(base, { RUSTFLAGS: '-Dwarnings' });
  });

  test('lets the bundled driver load its compiler libraries', function () {
    const bundle = requireToolchain(this);
    const r = resolveToolchain(bundle, '/unused');
    assert.ok(r.ok, r.ok ? '' : r.message);
    const { env } = runEnvironment(r.root, os.tmpdir());
    const out = execFileSync(path.join(r.root, 'bin', 'aquascope-driver'), ['-vV'], { env, encoding: 'utf8' });
    assert.match(out, /^rustc .*nightly/);
  });
});
