import * as path from 'path';
import Mocha from 'mocha';
import { readdirSync } from 'fs';

export async function run(): Promise<void> {
  const mocha = new Mocha({ ui: 'tdd', color: true });
  const root = __dirname;
  // readdirSync with `recursive` works on Node 20, which older VS Code versions ship; fs.glob needs Node 22.
  for (const f of readdirSync(root, { recursive: true, encoding: 'utf8' })) {
    if (f.endsWith('.test.js')) mocha.addFile(path.resolve(root, f));
  }
  await new Promise<void>((resolve, reject) =>
    mocha.run((failures) => (failures ? reject(new Error(`${failures} tests failed`)) : resolve())),
  );
}
