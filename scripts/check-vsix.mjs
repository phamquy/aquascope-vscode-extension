#!/usr/bin/env node
// Checks a platform VSIX against feature 005's AC1 to AC3; run by scripts/package-platform.sh.
//
//   node scripts/check-vsix.mjs <vsix> <host triple> <rust toolchain> <bundle folder>
//
// AC1: the manifest targets darwin-arm64; the binaries, cargo, rustc and the compiler library are present
// and executable; every other toolchain file is in the rustc, cargo or rust-std manifest and not trimmed,
// or is a kept licence file. AC2: at most 150 MB. AC3: the licence and notice files are present, the
// crate notices being the ones generated for this bundle. It also checks that nothing from build/ leaked
// into the package. Exits 1 and lists every failed check.
import { execFileSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';

const [vsix, host, toolchain, bundle] = process.argv.slice(2);
if (!vsix || !host || !toolchain || !bundle) {
  console.error('usage: check-vsix.mjs <vsix> <host triple> <rust toolchain> <bundle folder>');
  process.exit(2);
}
const root = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const MAX_BYTES = 150 * 1024 * 1024;
const TOOLCHAIN = 'extension/aquascope/toolchain/';
const failures = [];
const check = (ok, message) => ok || failures.push(message);

// Every entry with its Unix permissions, from `zipinfo` (one line per file).
const entries = new Map();
for (const line of execFileSync('zipinfo', [vsix], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }).split('\n')) {
  const m = /^([-dl][rwxsStT-]{9})\s+\S+\s+\S+\s+\d+\s+\S+\s+\S+\s+\S+\s+\S+\s+(.+)$/.exec(line);
  if (m) entries.set(m[2], m[1]);
}
check(entries.size > 0, 'could not list the VSIX');

// AC1: target platform and the files a run needs, executable.
const manifest = execFileSync('unzip', ['-p', vsix, 'extension.vsixmanifest'], { encoding: 'utf8' });
check(/TargetPlatform="darwin-arm64"/.test(manifest), 'the manifest does not target darwin-arm64');
const driverLib = [...entries.keys()].find((e) => /^extension\/aquascope\/toolchain\/lib\/librustc_driver-.*\.dylib$/.test(e));
check(driverLib !== undefined, 'missing extension/aquascope/toolchain/lib/librustc_driver-*.dylib');
for (const file of ['extension/aquascope/bin/cargo-aquascope', 'extension/aquascope/bin/aquascope-driver', `${TOOLCHAIN}bin/cargo`, `${TOOLCHAIN}bin/rustc`, driverLib]) {
  if (!file) continue;
  const mode = entries.get(file);
  check(mode !== undefined, `missing ${file}`);
  if (mode && !file.endsWith('.dylib')) check(mode[3] === 'x', `${file} is not executable (${mode})`);
}

// The trim and keep lists, read from the shell file the packaging script uses.
const lists = execFileSync('bash', ['-c', `host=${host}; source scripts/bundle-paths.sh; printf '%s\\n' "\${TRIM[@]}"; echo ---; printf '%s\\n' "\${KEEP[@]}"`], {
  cwd: root,
  encoding: 'utf8',
}).trim();
const [trim, keep] = lists.split('\n---\n').map((block) => block.split('\n'));
const glob = (pattern) => new RegExp(`^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*')}(/.*)?$`);
const trimmed = trim.map(glob);
const kept = keep.map(glob);

// The files the rustc, cargo and rust-std components install, from rustup's manifests.
const sysroot = execFileSync('rustup', ['run', toolchain, 'rustc', '--print', 'sysroot'], { encoding: 'utf8' }).trim();
const manifestFiles = new Set();
const manifestDirs = [];
for (const component of ['rustc', 'cargo', 'rust-std']) {
  for (const line of readFileSync(path.join(sysroot, 'lib/rustlib', `manifest-${component}-${host}`), 'utf8').split('\n')) {
    const [kind, ...rest] = line.split(':');
    if (kind === 'file') manifestFiles.add(rest.join(':'));
    if (kind === 'dir') manifestDirs.push(rest.join(':') + '/');
  }
}
const inManifest = (rel) => manifestFiles.has(rel) || manifestDirs.some((d) => rel.startsWith(d));

let toolchainFiles = 0;
for (const entry of entries.keys()) {
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
check([...entries.keys()].some((e) => e.startsWith(`${TOOLCHAIN}share/doc/rust/licenses/`)), `missing ${TOOLCHAIN}share/doc/rust/licenses/`);
const notices = execFileSync('unzip', ['-p', vsix, 'extension/aquascope/THIRD-PARTY-NOTICES'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
let generated;
try {
  generated = readFileSync(path.join(bundle, 'THIRD-PARTY-NOTICES'), 'utf8');
} catch {
  generated = undefined;
}
check(generated !== undefined, `no crate notices in ${bundle} to compare with`);
check(generated === undefined || notices === generated, 'the crate notices differ from the ones generated for this bundle');

// Nothing from the build folder or the spikes, and AC2's size.
check(![...entries.keys()].some((e) => /^extension\/(build|spikes|scripts)\//.test(e)), 'the package contains build/, spikes/ or scripts/');
const bytes = statSync(vsix).size;
check(bytes <= MAX_BYTES, `the VSIX is ${(bytes / 1048576).toFixed(1)} MB, over 150 MB`);

if (failures.length > 0) {
  console.error(`check-vsix: ${failures.length} problem(s) in ${path.basename(vsix)}:\n  ${failures.join('\n  ')}`);
  process.exit(1);
}
console.log(`check-vsix: ok: darwin-arm64, ${entries.size} entries, ${toolchainFiles} toolchain files, ${(bytes / 1048576).toFixed(1)} MB`);
