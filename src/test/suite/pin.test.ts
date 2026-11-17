// ADR 0005: the Aquascope fork is the submodule vendor/aquascope, and the pin, which the packaging script and the
// spikes read, names the fork and the commit the submodule records.
import * as assert from 'assert';
import { execFileSync } from 'child_process';
import { readFileSync } from 'fs';
import * as path from 'path';

const repo = path.resolve(__dirname, '../../..');

/** A value of spikes/002-toolchain-bundling/pin.env. */
function pinned(name: string): string | undefined {
  const pin = readFileSync(path.join(repo, 'spikes/002-toolchain-bundling/pin.env'), 'utf8');
  return new RegExp(`^${name}=(.+)$`, 'm').exec(pin)?.[1].trim();
}

suite('the Aquascope pin and submodule (ADR 0005)', () => {
  test('the submodule vendor/aquascope is the pinned fork, at the pinned commit', () => {
    const modules = readFileSync(path.join(repo, '.gitmodules'), 'utf8');
    assert.match(modules, /\[submodule "vendor\/aquascope"\]/);
    const url = /^\s*url\s*=\s*(.+)$/m.exec(modules)?.[1].trim();
    assert.strictEqual(url?.replace(/\.git$/, ''), pinned('AQUASCOPE_REPO'), 'the submodule is the pinned fork');
    // `git ls-files -s` gives `160000 <commit> 0\tvendor/aquascope` for a submodule.
    const [mode, recorded] = execFileSync('git', ['ls-files', '-s', 'vendor/aquascope'], { cwd: repo, encoding: 'utf8' }).split(/\s+/);
    assert.strictEqual(mode, '160000', 'vendor/aquascope is a submodule');
    assert.strictEqual(recorded, pinned('AQUASCOPE_COMMIT'), "the commit recorded for vendor/aquascope is the pin's");
  });
});
