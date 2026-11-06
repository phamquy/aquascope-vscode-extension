// Where the Aquascope tools live (R3) and the environment they run in (R4, R5).
// Both functions are pure apart from the existence check, so they are tested without a toolchain.
import * as path from 'path';
import { existsSync } from 'fs';

export const TOOLCHAIN_SETTING = 'aquascope.toolchainPath';

/** The files R3 requires under a toolchain root, without the Windows `.exe` suffix. */
const REQUIRED = ['bin/cargo-aquascope', 'bin/aquascope-driver', 'toolchain/bin/cargo'];

export type ToolchainResolution =
  | { ok: true; root: string; cargo: string }
  | { ok: false; message: string };

/**
 * Picks the toolchain root: the setting when it is set, otherwise the bundle inside the extension.
 * A configured path is never silently replaced by the bundle, so a typo in the setting is reported.
 */
export function resolveToolchain(
  configured: string | undefined,
  extensionPath: string,
  platform: NodeJS.Platform = process.platform,
  exists: (file: string) => boolean = existsSync,
): ToolchainResolution {
  const p = platform === 'win32' ? path.win32 : path.posix;
  const exe = platform === 'win32' ? '.exe' : '';
  const fromSetting = Boolean(configured?.trim());
  const root = fromSetting ? (configured as string).trim() : p.join(extensionPath, 'aquascope');
  const missing = REQUIRED.filter((file) => !exists(p.join(root, file + exe)));
  if (missing.length === 0) return { ok: true, root, cargo: p.join(root, 'toolchain', 'bin', 'cargo' + exe) };
  const layout = 'bin/cargo-aquascope, bin/aquascope-driver and toolchain/';
  const message = fromSetting
    ? `The Aquascope tools were not found at ${root}, set by \`${TOOLCHAIN_SETTING}\` (missing ${missing.join(', ')}). Point the setting at a folder containing ${layout}.`
    : `This copy of the extension does not include the Aquascope tools. Set \`${TOOLCHAIN_SETTING}\` to a folder containing ${layout}.`;
  return { ok: false, message };
}

/** Variables removed because they would change how the compiler runs (R4). */
const REMOVED = ['RUSTC', 'RUSTC_WRAPPER', 'RUSTC_WORKSPACE_WRAPPER', 'RUSTUP_TOOLCHAIN', 'RUSTFLAGS', 'CARGO_TARGET_DIR'];
const REMOVED_PREFIX = 'CARGO_BUILD_';

export interface RunEnvironment {
  env: NodeJS.ProcessEnv;
  /** Variables this function set, for the log (R11). */
  set: Record<string, string>;
  /** Variables removed from the base environment, for the log (R11). */
  removed: string[];
}

/** The environment for running the tool in `crateDir` with the toolchain at `root` (R4, R5). */
export function runEnvironment(
  root: string,
  crateDir: string,
  base: NodeJS.ProcessEnv = process.env,
  platform: NodeJS.Platform = process.platform,
): RunEnvironment {
  const p = platform === 'win32' ? path.win32 : path.posix;
  // Windows variable names are case-insensitive, so `Path` and `PATH` are the same variable there.
  const norm = (key: string): string => (platform === 'win32' ? key.toUpperCase() : key);
  const keysOf = (name: string): string[] => Object.keys(base).filter((k) => norm(k) === norm(name));

  const env: NodeJS.ProcessEnv = { ...base };
  const removed: string[] = [];
  for (const key of Object.keys(env)) {
    if (REMOVED.includes(norm(key)) || norm(key).startsWith(REMOVED_PREFIX)) {
      delete env[key];
      removed.push(key);
    }
  }

  const lib = p.join(root, 'toolchain', 'lib');
  const userPath = keysOf('PATH').map((k) => base[k]).find((v) => v) ?? '';
  const pathParts = [p.join(root, 'bin'), p.join(root, 'toolchain', 'bin')];
  if (platform === 'win32') pathParts.push(lib); // Windows finds DLLs through PATH.
  if (userPath) pathParts.push(userPath);

  const set: Record<string, string> = { PATH: pathParts.join(p.delimiter) };
  if (platform === 'darwin') set.DYLD_LIBRARY_PATH = lib;
  else if (platform !== 'win32') set.LD_LIBRARY_PATH = lib;
  set.CARGO_NET_OFFLINE = 'true';
  // Neutralise the same settings when they come from the user's cargo configuration files.
  set.RUSTC_WRAPPER = '';
  set.CARGO_ENCODED_RUSTFLAGS = '';
  set.CARGO_TARGET_DIR = p.join(crateDir, 'target');

  for (const [key, value] of Object.entries(set)) {
    for (const existing of keysOf(key)) delete env[existing];
    env[key] = value;
  }
  return { env, set, removed };
}
