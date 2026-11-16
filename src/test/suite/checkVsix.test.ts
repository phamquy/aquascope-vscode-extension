import * as assert from 'assert';
import * as os from 'os';
import * as path from 'path';
import { spawnSync } from 'child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';

// Feature 012, T-068: scripts/check-vsix.mjs accepts a complete win32-x64 package and rejects broken ones.
// The packages here are small synthetic zips, so no toolchain is needed; AQUASCOPE_CHECK_SYSROOT and
// AQUASCOPE_CHECK_MAX_MB are the checker's seams for that.

const HOST = 'x86_64-pc-windows-msvc';
const script = path.resolve(__dirname, '../../../scripts/check-vsix.mjs');
const NOTICES = 'crate notices\n';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (const b of data) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** A zip of stored (uncompressed) files, made on Windows (so with no Unix modes). */
function zip(files: Map<string, Buffer>): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const [name, data] of files) {
    const n = Buffer.from(name);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt32LE(crc32(data), 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt32LE(crc32(data), 16);
    c.writeUInt32LE(data.length, 20);
    c.writeUInt32LE(data.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([c, n]));
    parts.push(local, n, data);
    offset += 30 + n.length + data.length;
  }
  const dir = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.size, 8);
  end.writeUInt16LE(files.size, 10);
  end.writeUInt32LE(dir.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, dir, end]);
}

/** The complete set of files a valid win32-x64 package holds, as name -> content. */
function validFiles(): Map<string, Buffer> {
  const T = 'extension/aquascope/toolchain/';
  const M = `extension/aquascope/miri-sysroot/lib/rustlib/${HOST}/lib/`;
  const keep = readFileSync(path.resolve(__dirname, '../../../scripts/bundle-paths.sh'), 'utf8');
  assert.ok(keep.includes('share/doc/rust/COPYRIGHT.html'));
  const names = [
    'extension.vsixmanifest',
    'extension/LICENSE.txt',
    'extension/aquascope/LICENSE',
    'extension/aquascope/THIRD-PARTY-NOTICES',
    'extension/media/aquascope-embed/LICENSE',
    'extension/media/aquascope-embed/THIRD-PARTY-NOTICES',
    'extension/aquascope/bin/cargo-aquascope.exe',
    'extension/aquascope/bin/aquascope-driver.exe',
    `${T}bin/cargo.exe`,
    `${T}bin/rustc.exe`,
    `${T}bin/rustc_driver-0123456789abcdef.dll`,
    `${T}bin/std-0123456789abcdef.dll`,
    `${T}lib/rustlib/${HOST}/lib/libstd-0123456789abcdef.rlib`,
    `${T}share/doc/rust/COPYRIGHT.html`,
    `${T}share/doc/rust/COPYRIGHT-library.html`,
    `${T}share/doc/rust/licenses/MIT.txt`,
    `${T}share/doc/cargo/LICENSE-APACHE`,
    `${T}share/doc/cargo/LICENSE-MIT`,
    `${T}share/doc/cargo/LICENSE-THIRD-PARTY`,
    `${M}libcore-0123456789abcdef.rlib`,
    `${M}liballoc-0123456789abcdef.rlib`,
    `${M}libstd-0123456789abcdef.rlib`,
  ];
  const files = new Map(names.map((n) => [n, Buffer.from('x')]));
  files.set('extension.vsixmanifest', Buffer.from('<PackageManifest><Identity TargetPlatform="win32-x64"/></PackageManifest>'));
  files.set('extension/aquascope/THIRD-PARTY-NOTICES', Buffer.from(NOTICES));
  return files;
}

suite('VSIX check (feature 012, T-068)', () => {
  let tmp: string;
  setup(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'aquascope-check-vsix-'));
    // The manifests of a pretend toolchain, listing the files the valid package holds.
    const rustlib = path.join(tmp, 'sysroot', 'lib', 'rustlib');
    mkdirSync(rustlib, { recursive: true });
    writeFileSync(path.join(rustlib, `manifest-rustc-${HOST}`), 'file:bin/rustc.exe\nfile:bin/rustc_driver-0123456789abcdef.dll\nfile:bin/std-0123456789abcdef.dll\nfile:share/doc/rust/COPYRIGHT.html\nfile:share/doc/rust/COPYRIGHT-library.html\ndir:share/doc/rust/licenses\n');
    writeFileSync(path.join(rustlib, `manifest-cargo-${HOST}`), 'file:bin/cargo.exe\nfile:share/doc/cargo/LICENSE-APACHE\nfile:share/doc/cargo/LICENSE-MIT\nfile:share/doc/cargo/LICENSE-THIRD-PARTY\n');
    writeFileSync(path.join(rustlib, `manifest-rust-std-${HOST}`), `dir:lib/rustlib/${HOST}/lib\n`);
    mkdirSync(path.join(tmp, 'bundle'));
    writeFileSync(path.join(tmp, 'bundle', 'THIRD-PARTY-NOTICES'), NOTICES);
  });
  teardown(() => rmSync(tmp, { recursive: true, force: true }));

  /** Writes the package and runs the checker on it; `env` adjusts its seams. */
  function run(files: Map<string, Buffer>, env: Record<string, string> = {}, host = HOST) {
    const vsix = path.join(tmp, 'test.vsix');
    writeFileSync(vsix, zip(files));
    const r = spawnSync(process.execPath, [script, vsix, host, 'nightly-test', path.join(tmp, 'bundle')], {
      encoding: 'utf8',
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1', AQUASCOPE_CHECK_SYSROOT: path.join(tmp, 'sysroot'), ...env },
    });
    return { status: r.status, out: `${r.stdout}${r.stderr}` };
  }

  test('accepts a complete win32-x64 package', () => {
    const r = run(validFiles());
    assert.strictEqual(r.status, 0, r.out);
    assert.match(r.out, /ok: win32-x64/);
  });

  test('rejects a package that targets another platform', () => {
    const files = validFiles();
    files.set('extension.vsixmanifest', Buffer.from('<Identity TargetPlatform="darwin-arm64"/>'));
    const r = run(files);
    assert.strictEqual(r.status, 1);
    assert.match(r.out, /does not target win32-x64/);
  });

  for (const missing of [
    'extension/aquascope/bin/aquascope-driver.exe',
    'extension/aquascope/toolchain/bin/rustc.exe',
    'extension/aquascope/toolchain/bin/rustc_driver-0123456789abcdef.dll',
    'extension/aquascope/toolchain/bin/std-0123456789abcdef.dll',
    `extension/aquascope/miri-sysroot/lib/rustlib/${HOST}/lib/libstd-0123456789abcdef.rlib`,
    'extension/aquascope/THIRD-PARTY-NOTICES',
    'extension/aquascope/toolchain/share/doc/cargo/LICENSE-MIT',
  ]) {
    test(`rejects a package without ${missing.replace('extension/aquascope/', '')}`, () => {
      const files = validFiles();
      files.delete(missing);
      const r = run(files);
      assert.strictEqual(r.status, 1, r.out);
      assert.ok(r.out.includes('missing') || r.out.includes('differ'), r.out);
    });
  }

  test('rejects Unix executables left in a Windows package', () => {
    const files = validFiles();
    files.set('extension/aquascope/toolchain/bin/rustdoc.exe', Buffer.from('x'));
    const r = run(files);
    assert.strictEqual(r.status, 1);
    assert.match(r.out, /rustdoc\.exe is not in the rustc, cargo or rust-std manifest/);
  });

  test('rejects debug symbols that should have been trimmed', () => {
    const files = validFiles();
    files.set('extension/aquascope/toolchain/bin/rustc.pdb', Buffer.from('x'));
    const r = run(files);
    assert.strictEqual(r.status, 1);
    assert.match(r.out, /rustc\.pdb/);
  });

  test('rejects a package over the size limit', () => {
    const r = run(validFiles(), { AQUASCOPE_CHECK_MAX_MB: '0.0001' });
    assert.strictEqual(r.status, 1);
    assert.match(r.out, /over 0\.0001 MB/);
  });

  test('rejects a file that holds the build machine\'s home path, however it is written', () => {
    const home = os.homedir();
    for (const form of [home, home.replace(/\\/g, '/'), home.replace(/\\/g, '\\\\')]) {
      const files = validFiles();
      files.set('extension/aquascope/toolchain/lib/rustlib/leak.rlib', Buffer.from(`before ${form}\\src after`));
      const r = run(files);
      assert.strictEqual(r.status, 1, form);
      assert.match(r.out, /hold the home path/, form);
    }
  });

  test('rejects crate notices that differ from the bundle\'s', () => {
    const files = validFiles();
    files.set('extension/aquascope/THIRD-PARTY-NOTICES', Buffer.from('stale'));
    const r = run(files);
    assert.strictEqual(r.status, 1);
    assert.match(r.out, /differ/);
  });

  test('refuses a host it has no checks for', () => {
    const r = run(validFiles(), {}, 'x86_64-unknown-linux-gnu');
    assert.strictEqual(r.status, 2);
    assert.match(r.out, /no checks for the host/);
  });
});
