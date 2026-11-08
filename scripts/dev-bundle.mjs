// Assembles a development bundle in the layout the extension expects (feature 003, R3; feature 007):
//   <root>/bin/           cargo-aquascope, aquascope-driver
//   <root>/toolchain/     the trimmed nightly (bin/, lib/)
//   <root>/miri-sysroot/  the standard library built for Miri, for the interpreter (ADR 0003)
// from spike 002's build output, using symlinks so nothing large is copied. Point the
// `aquascope.toolchainPath` setting (or AQUASCOPE_TEST_TOOLCHAIN for the tests) at <root>.
// The Miri library is built once, with rustup's pinned nightly (which needs miri and rust-src), into
// spikes/007-interpreter/work/miri-sysroot, which spike 007's probe shares. Without it the bundle still
// serves the permissions view, and the script says so. Symlinks need macOS or Linux.
//
//   node scripts/dev-bundle.mjs [root]   default root: spikes/002-toolchain-bundling/work/dev-bundle
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const spike = join(repo, 'spikes/002-toolchain-bundling/work');
const root = resolve(process.argv[2] ?? join(spike, 'dev-bundle'));
const miriSysroot = join(repo, 'spikes/007-interpreter/work/miri-sysroot');

const links = [
  [join(spike, 'install/bin/cargo-aquascope'), join(root, 'bin/cargo-aquascope')],
  [join(spike, 'install/bin/aquascope-driver'), join(root, 'bin/aquascope-driver')],
  [join(spike, 'toolchain-trimmed'), join(root, 'toolchain')],
];

const missing = links.map(([source]) => source).filter((source) => !existsSync(source));
if (missing.length > 0) {
  console.error(`Missing spike 002 output:\n  ${missing.join('\n  ')}`);
  console.error('Run spikes/002-toolchain-bundling build.sh, assemble-toolchain.sh and measure-bundle.sh first.');
  process.exit(1);
}

if (!existsSync(join(miriSysroot, 'lib/rustlib'))) {
  const nightly = /^RUST_NIGHTLY=(.+)$/m.exec(readFileSync(join(repo, 'spikes/002-toolchain-bundling/pin.env'), 'utf8'))?.[1];
  console.error(`Building the standard library for Miri into ${miriSysroot} (once, about 15 s)`);
  try {
    execFileSync('cargo', [`+${nightly}`, 'miri', 'setup'], { env: { ...process.env, MIRI_SYSROOT: miriSysroot }, stdio: ['ignore', 'ignore', 'inherit'] });
  } catch {
    console.error(`Could not build it; the bundle will serve the permissions view only. Install it with: rustup component add miri rust-src --toolchain ${nightly}`);
  }
}
if (existsSync(join(miriSysroot, 'lib/rustlib'))) links.push([miriSysroot, join(root, 'miri-sysroot')]);

mkdirSync(join(root, 'bin'), { recursive: true });
for (const [source, link] of links) {
  rmSync(link, { force: true }); // removes an old link only; rmSync does not follow symlinks
  symlinkSync(source, link);
}
console.log(root);
