// Shared helpers for the test suites: the fixture workspace and the toolchain bundle (runTest.ts).
import * as path from 'path';
import * as vscode from 'vscode';

/** Root of the toolchain bundle for end-to-end tests, or undefined when none was found. */
export const testToolchain: string | undefined = process.env.AQUASCOPE_TEST_TOOLCHAIN;

/** The fixture workspace the test instance has open. */
export function fixtureWorkspace(): string {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) throw new Error('tests must run with src/test/fixtures/workspace open; see runTest.ts');
  return folder.uri.fsPath;
}

/** A file in the fixture workspace. */
export function fixture(name: string): vscode.Uri {
  return vscode.Uri.file(path.join(fixtureWorkspace(), name));
}

/** Returns the bundle root, or skips the calling test with a visible reason when there is none. */
export function requireToolchain(ctx: Mocha.Context): string {
  if (!testToolchain) {
    console.warn('    no toolchain bundle: run `npm run dev-bundle` or set AQUASCOPE_TEST_TOOLCHAIN; skipping');
    ctx.skip();
  }
  return testToolchain as string;
}
