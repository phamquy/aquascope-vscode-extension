import * as path from 'path';
import { existsSync } from 'fs';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  const repo = path.resolve(__dirname, '../../');
  const extensionTestsPath = path.resolve(__dirname, './suite/index');
  // The tests run with this folder open as the workspace.
  const workspace = path.join(repo, 'src/test/fixtures/workspace');
  // Toolchain bundle for the end-to-end tests; build it with `npm run dev-bundle`. Without one,
  // those tests skip and say so.
  const bundle = process.env.AQUASCOPE_TEST_TOOLCHAIN ?? path.join(repo, 'spikes/002-toolchain-bundling/work/dev-bundle');
  // Set when run from VS Code's integrated terminal; it would start the test instance as plain Node.
  delete process.env.ELECTRON_RUN_AS_NODE;
  await runTests({
    extensionDevelopmentPath: repo,
    extensionTestsPath,
    launchArgs: [workspace, '--disable-extensions'],
    extensionTestsEnv: existsSync(bundle) ? { AQUASCOPE_TEST_TOOLCHAIN: bundle } : {},
  });
}

main().catch((err) => { console.error(err); process.exit(1); });
