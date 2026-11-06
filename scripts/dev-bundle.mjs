// Assembles a development bundle in the layout the extension expects (feature 003, R3):
//   <root>/bin/        cargo-aquascope, aquascope-driver
//   <root>/toolchain/  the trimmed nightly (bin/, lib/)
// from spike 002's build output, using symlinks so nothing large is copied. Point the
// `aquascope.toolchainPath` setting (or AQUASCOPE_TEST_TOOLCHAIN for the tests) at <root>.
// Feature 005 replaces this with a real bundle built in CI. Symlinks need macOS or Linux.
//
//   node scripts/dev-bundle.mjs [root]   default root: spikes/002-toolchain-bundling/work/dev-bundle
import { existsSync, mkdirSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const spike = join(repo, 'spikes/002-toolchain-bundling/work');
const root = resolve(process.argv[2] ?? join(spike, 'dev-bundle'));

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

mkdirSync(join(root, 'bin'), { recursive: true });
for (const [source, link] of links) {
  rmSync(link, { force: true }); // removes an old link only; rmSync does not follow symlinks
  symlinkSync(source, link);
}
console.log(root);
