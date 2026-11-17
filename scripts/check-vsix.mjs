#!/usr/bin/env node
// Checks a platform VSIX against feature 005's AC1 to AC3 and feature 012's AC6; run by
// scripts/package-platform.sh.
//
//   node scripts/check-vsix.mjs <vsix> <host triple> <rust toolchain> <bundle folder>
//
// AC1: the manifest targets the platform of the host triple (darwin-arm64 or win32-x64); the binaries,
// cargo, rustc and the compiler library are present (and executable on darwin); every other toolchain
// file is in the rustc, cargo or rust-std manifest and not trimmed, or is a kept licence file. AC2: at most
// 200 MB. AC3: the licence and notice files are present, the crate notices being the ones generated for
// this bundle. It also checks that nothing from build/ leaked into the package, and that no file holds the
// build machine's home path (R10, AC8). Exits 1 and lists every failed check.
//
// The zip is read here, not by zipinfo and unzip, and the trim and keep lists are read from
// scripts/bundle-paths.sh here, not by running Bash, so the check runs wherever Node does. Two environment
// variables let the tests use a small synthetic package: AQUASCOPE_CHECK_SYSROOT names a folder holding
// lib/rustlib/manifest-* in place of the rustup toolchain's, and AQUASCOPE_CHECK_MAX_MB replaces the size cap.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inflateRawSync } from 'node:zlib';

const [vsix, host, toolchain, bundle] = process.argv.slice(2);
if (!vsix || !host || !toolchain || !bundle) {
  console.error('usage: check-vsix.mjs <vsix> <host triple> <rust toolchain> <bundle folder>');
  process.exit(2);
}
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
// ADR 0003: about 185 MB with Miri's standard library; the cap still catches an accidental doubling.
// The Windows bundle measured 158 MiB zipped (feature 012, T-066), within the same cap.
const MAX_MB = Number(process.env.AQUASCOPE_CHECK_MAX_MB ?? 200);
const MAX_BYTES = MAX_MB * 1024 * 1024;
const TOOLCHAIN = 'extension/aquascope/toolchain/';
const failures = [];
const check = (ok, message) => ok || failures.push(message);

const PLATFORMS = {
  'aarch64-apple-darwin': { target: 'darwin-arm64', exe: '', driverLib: /^lib\/librustc_driver-.*\.dylib$/, driverLibName: 'lib/librustc_driver-*.dylib', unixModes: true },
  'x86_64-pc-windows-msvc': { target: 'win32-x64', exe: '.exe', driverLib: /^bin\/rustc_driver-.*\.dll$/, driverLibName: 'bin/rustc_driver-*.dll', unixModes: false },
};
const platform = PLATFORMS[host];
if (!platform) {
  console.error(`check-vsix: no checks for the host ${host}; known hosts: ${Object.keys(PLATFORMS).join(', ')}`);
  process.exit(2);
}

// The zip's central directory: each entry's name, Unix mode (when it was made on Unix) and where its data is.
const zip = readFileSync(vsix);
const entries = new Map();
const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
if (eocd >= 0) {
  let p = zip.readUInt32LE(eocd + 16);
  for (let n = zip.readUInt16LE(eocd + 10); n > 0 && zip.readUInt32LE(p) === 0x02014b50; n--) {
    const madeByUnix = zip.readUInt16LE(p + 4) >> 8 === 3;
    const nameLength = zip.readUInt16LE(p + 28);
    const extraLength = zip.readUInt16LE(p + 30);
    const commentLength = zip.readUInt16LE(p + 32);
    entries.set(zip.toString('utf8', p + 46, p + 46 + nameLength), {
      method: zip.readUInt16LE(p + 10),
      compressedSize: zip.readUInt32LE(p + 20),
      mode: madeByUnix ? zip.readUInt32LE(p + 38) >>> 16 : undefined,
      header: zip.readUInt32LE(p + 42),
    });
    p += 46 + nameLength + extraLength + commentLength;
  }
}
check(entries.size > 0, 'could not list the VSIX');
const names = [...entries.keys()];
const read = (name) => {
  const e = entries.get(name);
  const start = e.header + 30 + zip.readUInt16LE(e.header + 26) + zip.readUInt16LE(e.header + 28);
  const data = zip.subarray(start, start + e.compressedSize);
  return e.method === 0 ? data : inflateRawSync(data);
};

// AC1: target platform and the files a run needs (executable, on darwin).
const manifest = entries.has('extension.vsixmanifest') ? read('extension.vsixmanifest').toString('utf8') : '';
check(manifest.includes(`TargetPlatform="${platform.target}"`), `the manifest does not target ${platform.target}`);
const driverLib = names.find((e) => e.startsWith(TOOLCHAIN) && platform.driverLib.test(e.slice(TOOLCHAIN.length)));
check(driverLib !== undefined, `missing ${TOOLCHAIN}${platform.driverLibName}`);
const required = ['extension/aquascope/bin/cargo-aquascope', 'extension/aquascope/bin/aquascope-driver', `${TOOLCHAIN}bin/cargo`, `${TOOLCHAIN}bin/rustc`].map((f) => f + platform.exe);
// The standard library's own DLL sits beside the compiler's on Windows, and rustc.exe will not start without it.
const stdLib = platform.target === 'win32-x64' ? names.find((e) => /^extension\/aquascope\/toolchain\/bin\/std-.*\.dll$/.test(e)) : undefined;
if (platform.target === 'win32-x64') check(stdLib !== undefined, `missing ${TOOLCHAIN}bin/std-*.dll`);
for (const file of [...required, driverLib, stdLib]) {
  if (!file) continue;
  check(entries.has(file), `missing ${file}`);
}
if (platform.unixModes) {
  for (const file of required) {
    const mode = entries.get(file)?.mode;
    if (mode !== undefined) check((mode & 0o100) !== 0, `${file} is not executable`);
  }
}

// Feature 007: the standard library built for Miri, without cargo's dep-info files (ADR 0003).
const MIRI_LIB = `extension/aquascope/miri-sysroot/lib/rustlib/${host}/lib/`;
for (const crate of ['core', 'alloc', 'std']) {
  check(names.some((e) => e.startsWith(`${MIRI_LIB}lib${crate}-`) && e.endsWith('.rlib')), `missing ${MIRI_LIB}lib${crate}-*.rlib`);
}
check(!names.some((e) => e.startsWith('extension/aquascope/miri-sysroot/') && e.endsWith('.d')), 'the Miri standard library still holds .d files');

// The trim and keep lists, read from the shell file the packaging script uses.
const shell = readFileSync(path.join(root, 'scripts/bundle-paths.sh'), 'utf8');
const list = (name) => {
  const body = new RegExp(`^${name}=\\(\\r?\\n([^)]*)\\)`, 'm').exec(shell)?.[1] ?? '';
  return [...body.matchAll(/^\s*(?:'([^']*)'|"([^"]*)")/gm)].map((m) => (m[1] ?? m[2]).replaceAll('$host', host));
};
const trim = list('TRIM');
const keep = list('KEEP');
check(trim.length > 0 && keep.length > 0, 'could not read the trim and keep lists from scripts/bundle-paths.sh');
const glob = (pattern) => new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}(/.*)?$`);
const trimmed = trim.map(glob);
const kept = keep.map(glob);

// The files the rustc, cargo and rust-std components install, from rustup's manifests.
const sysroot = process.env.AQUASCOPE_CHECK_SYSROOT ?? execFileSync('rustup', ['run', toolchain, 'rustc', '--print', 'sysroot'], { encoding: 'utf8' }).trim();
const manifestFiles = new Set();
const manifestDirs = [];
for (const component of ['rustc', 'cargo', 'rust-std']) {
  for (const line of readFileSync(path.join(sysroot, 'lib/rustlib', `manifest-${component}-${host}`), 'utf8').split(/\r?\n/)) {
    const [kind, ...rest] = line.split(':');
    if (kind === 'file') manifestFiles.add(rest.join(':'));
    if (kind === 'dir') manifestDirs.push(rest.join(':') + '/');
  }
}
const inManifest = (rel) => manifestFiles.has(rel) || manifestDirs.some((d) => rel.startsWith(d));

let toolchainFiles = 0;
for (const entry of names) {
  if (!entry.startsWith(TOOLCHAIN) || entry.endsWith('/')) continue;
  toolchainFiles += 1;
  const rel = entry.slice(TOOLCHAIN.length);
  if (kept.some((r) => r.test(rel))) continue;
  check(inManifest(rel), `${entry} is not in the rustc, cargo or rust-std manifest`);
  check(!trimmed.some((r) => r.test(rel)), `${entry} should have been trimmed`);
}

// AC3: licences and notices.
for (const file of [
  'extension/LICENSE.txt', // vsce renames the extension's LICENSE
  'extension/aquascope/LICENSE',
  'extension/aquascope/THIRD-PARTY-NOTICES',
  'extension/media/aquascope-embed/LICENSE',
  'extension/media/aquascope-embed/THIRD-PARTY-NOTICES',
  ...keep.filter((k) => !k.includes('*') && !k.endsWith('licenses')).map((k) => TOOLCHAIN + k),
]) {
  check(entries.has(file), `missing ${file}`);
}
check(names.some((e) => e.startsWith(`${TOOLCHAIN}share/doc/rust/licenses/`)), `missing ${TOOLCHAIN}share/doc/rust/licenses/`);
const notices = entries.has('extension/aquascope/THIRD-PARTY-NOTICES') ? read('extension/aquascope/THIRD-PARTY-NOTICES').toString('utf8') : undefined;
let generated;
try {
  generated = readFileSync(path.join(bundle, 'THIRD-PARTY-NOTICES'), 'utf8');
} catch {
  generated = undefined;
}
check(generated !== undefined, `no crate notices in ${bundle} to compare with`);
check(generated === undefined || notices === generated, 'the crate notices differ from the ones generated for this bundle');

// Nothing from the build folder, the spikes or the Aquascope submodule, and AC2's size.
check(!names.some((e) => /^extension\/(build|spikes|scripts|vendor)\//.test(e)), 'the package contains build/, spikes/, scripts/ or vendor/');
const bytes = statSync(vsix).size;
check(bytes <= MAX_BYTES, `the VSIX is ${(bytes / 1048576).toFixed(1)} MB, over ${MAX_MB} MB`);

// R10, AC8: no file holds the build machine's home path, which rustc records in source paths. On Windows
// it is recorded with backslashes, possibly doubled in escaped text, or with slashes. A toolchain file
// identical to the rustup toolchain's own copy is Rust's published build, which nothing on this machine
// wrote, so it is not counted: Rust builds its macOS releases on GitHub's runners, whose home folder,
// `/Users/runner`, its binaries record, and which is also the home folder of a package built on those runners.
const home = os.homedir();
const homes = [...new Set([home, home.replaceAll('\\', '/'), home.replaceAll('\\', '\\\\')])].map((h) => Buffer.from(h));
const asPublished = (entry, data) => {
  const upstream = path.join(sysroot, entry.slice(TOOLCHAIN.length));
  return entry.startsWith(TOOLCHAIN) && existsSync(upstream) && readFileSync(upstream).equals(data);
};
const withHome = [];
for (const entry of names) {
  if (entry.endsWith('/')) continue;
  const data = read(entry);
  if (homes.some((h) => data.includes(h)) && !asPublished(entry, data)) withHome.push(entry);
}
check(withHome.length === 0, `${withHome.length} file(s) hold the home path ${home}: ${withHome.slice(0, 5).join(', ')}${withHome.length > 5 ? ', …' : ''}`);

if (failures.length > 0) {
  console.error(`check-vsix: ${failures.length} problem(s) in ${path.basename(vsix)}:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`check-vsix: ok: ${platform.target}, ${entries.size} entries, ${toolchainFiles} toolchain files, ${(bytes / 1048576).toFixed(1)} MB`);
