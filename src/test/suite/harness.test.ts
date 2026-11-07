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

  test('skips without a bundle, fails without one when a bundle is required, and returns it when given', () => {
    const ctx = { skip: () => { throw new Error('skipped'); } } as unknown as Mocha.Context;
    assert.throws(() => requireToolchain(ctx, {}), /^Error: skipped$/);
    assert.throws(() => requireToolchain(ctx, { AQUASCOPE_TEST_TOOLCHAIN: '' }), /^Error: skipped$/);
    assert.throws(() => requireToolchain(ctx, { AQUASCOPE_REQUIRE_TOOLCHAIN: '1' }), /AQUASCOPE_REQUIRE_TOOLCHAIN is set/);
    assert.strictEqual(requireToolchain(ctx, { AQUASCOPE_TEST_TOOLCHAIN: '/b', AQUASCOPE_REQUIRE_TOOLCHAIN: '1' }), '/b');
  });

  test('finds a toolchain bundle in the R3 layout', function () {
    const root = requireToolchain(this);
    for (const file of ['bin/cargo-aquascope', 'bin/aquascope-driver', 'toolchain/bin/cargo', 'toolchain/bin/rustc']) {
      assert.ok(existsSync(path.join(root, file)), `${file} missing under ${root}`);
    }
  });
});
