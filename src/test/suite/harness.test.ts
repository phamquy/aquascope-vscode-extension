import * as assert from 'assert';
import * as path from 'path';
import { existsSync } from 'fs';
import { fixtureWorkspace, requireToolchain } from './harness';

suite('test harness', () => {
  test('opens the fixture workspace', () => {
    const workspace = fixtureWorkspace();
    assert.ok(workspace.endsWith(path.join('src', 'test', 'fixtures', 'workspace')), workspace);
    assert.ok(existsSync(path.join(workspace, '05_method_mut_borrow.rs')));
  });

  test('finds a toolchain bundle in the R3 layout', function () {
    const root = requireToolchain(this);
    for (const file of ['bin/cargo-aquascope', 'bin/aquascope-driver', 'toolchain/bin/cargo', 'toolchain/bin/rustc']) {
      assert.ok(existsSync(path.join(root, file)), `${file} missing under ${root}`);
    }
  });
});
