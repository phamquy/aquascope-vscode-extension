import * as path from 'path';
import { runTests } from '@vscode/test-electron';

async function main(): Promise<void> {
  const extensionDevelopmentPath = path.resolve(__dirname, '../../');
  const extensionTestsPath = path.resolve(__dirname, './suite/index');
  // Set when run from VS Code's integrated terminal; it would start the test instance as plain Node.
  delete process.env.ELECTRON_RUN_AS_NODE;
  await runTests({ extensionDevelopmentPath, extensionTestsPath });
}

main().catch((err) => { console.error(err); process.exit(1); });
