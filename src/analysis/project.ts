// Finds the Cargo crate a file belongs to, so that it can be analysed with the rest of its crate (feature 008,
// R1, R10, D7, D8). A file's target is chosen by rustc_plugin's own rule (`only_run_on_file`, which
// Aquascope's `--crate-of` uses), so that the extension and Aquascope agree on it.
import { realpathSync } from 'fs';
import * as path from 'path';
import type * as vscode from 'vscode';
import { run, type RunOutcome } from './runner';
import type { RunEnvironment } from './toolchain';

/** The parts of `cargo metadata --no-deps --format-version 1` read here. */
export interface CargoMetadata {
  workspace_root: string;
  /** The workspace's members; `--no-deps` lists no other package. */
  packages: CargoPackage[];
}

export interface CargoPackage {
  name: string;
  targets: CargoTarget[];
  /** `path` is set for a path dependency, to the folder of its package. */
  dependencies: { name: string; path?: string | null }[];
}

export interface CargoTarget {
  name: string;
  /** For example `["lib"]`, `["bin"]`, `["test"]`, `["example"]`, `["bench"]` or `["custom-build"]`. */
  kind: string[];
  src_path: string;
}

/** A file in a crate: what the analysis needs to copy the project and run on it. */
export interface CrateInProject {
  kind: 'crate';
  /** The workspace root. The analysis runs there, and Aquascope's result paths are relative to it. */
  workspaceRoot: string;
  packageName: string;
  /** The target holding the file, as rustc_plugin chooses it; `kind` is its first kind. */
  target: { name: string; kind: string };
  /** The file's path relative to the workspace root, with `/`, as Aquascope's `file_path` names it. */
  relativePath: string;
  /** Folders of the path dependencies outside the workspace root, which the copy must hold too (D1). */
  externalPathDependencies: string[];
  /** The smallest folder holding the workspace root and those dependencies; the copy keeps the layout below it. */
  copyRoot: string;
  /** The folders to copy, relative to `copyRoot`: the workspace root and each external dependency, `.` for the root itself. */
  copyFolders: string[];
}

export type CrateLocation =
  | CrateInProject
  /** The file is in no target of a Cargo package; it is analysed alone, as in feature 003 (D8). */
  | { kind: 'none' }
  /** The file is a build script, which this version cannot analyse (R10, D7). */
  | { kind: 'buildScript'; packageName: string }
  /** `cargo metadata` failed, for example on a broken manifest; `detail` is its error output. */
  | { kind: 'metadataFailed'; detail: string }
  /** `cargo metadata` did not finish: it timed out, was cancelled or could not start. */
  | { kind: 'runFailed'; outcome: RunOutcome };

/**
 * Locates `file`, an absolute path as the metadata spells it, in a workspace's metadata. A file that no
 * target holds, or that targets of more than one package hold (where rustc_plugin would stop), is `none`.
 */
export function locateInMetadata(metadata: CargoMetadata, file: string): CrateLocation {
  const matches = metadata.packages.flatMap((pkg) => {
    const target = targetFor(pkg, file);
    return target ? [{ pkg, target }] : [];
  });
  if (matches.length !== 1) return { kind: 'none' };
  const [{ pkg, target }] = matches;
  const kind = target.kind[0] ?? '';
  if (kind === 'custom-build') return { kind: 'buildScript', packageName: pkg.name };

  const root = metadata.workspace_root;
  const external = [
    ...new Set(
      metadata.packages.flatMap((p) => p.dependencies.flatMap((d) => (d.path && d.path !== root && !isInside(d.path, root) ? [d.path] : []))),
    ),
  ].sort();
  const copyRoot = commonAncestor([root, ...external]);
  return {
    kind: 'crate',
    workspaceRoot: root,
    packageName: pkg.name,
    target: { name: target.name, kind },
    relativePath: toSlashes(path.relative(root, file)),
    externalPathDependencies: external,
    copyRoot,
    copyFolders: [root, ...external].map((folder) => toSlashes(path.relative(copyRoot, folder)) || '.'),
  };
}

/**
 * The target of `pkg` that holds `file`, by rustc_plugin's rule: the targets whose source folder holds the
 * file; of several, the one named like the file, or else the binary when the package has no library, or
 * else the binary for a `main.rs` and the library for any other file.
 */
function targetFor(pkg: CargoPackage, file: string): CargoTarget | undefined {
  const targets = pkg.targets.filter((t) => isInside(file, path.dirname(t.src_path)));
  if (targets.length <= 1) return targets[0];
  const stem = path.basename(file, path.extname(file));
  const named = targets.find((t) => t.name === stem);
  if (named) return named;
  if (targets.every((t) => !t.kind.includes('lib'))) return targets.find((t) => t.kind.includes('bin'));
  const kind = stem === 'main' ? 'bin' : 'lib';
  return targets.find((t) => t.kind.includes(kind));
}

/**
 * What a failed `cargo metadata` means: no `Cargo.toml` in the file's folder or above it is a file that
 * belongs to no package; anything else, such as a broken manifest, is reported.
 */
export function metadataFailure(stderr: string): CrateLocation {
  if (/could not find `Cargo\.toml`/.test(stderr)) return { kind: 'none' };
  return { kind: 'metadataFailed', detail: stderr.trim() };
}

export interface LocateRequest {
  /** The file at the cursor, an absolute path. */
  file: string;
  /** The bundled `cargo`. */
  cargo: string;
  environment: RunEnvironment;
  timeoutMs: number;
  token?: vscode.CancellationToken;
  log: (line: string) => void;
}

/**
 * Runs `cargo metadata --no-deps --offline` in the file's folder and locates the file in its workspace.
 * cargo reports real paths, so the file's real path is matched, which differs where a folder on the way is a
 * link, as `/var` is on macOS.
 */
export async function locateCrate(req: LocateRequest): Promise<CrateLocation> {
  const outcome = await run({
    program: req.cargo,
    args: ['metadata', '--no-deps', '--offline', '--format-version', '1'],
    cwd: path.dirname(req.file),
    environment: req.environment,
    timeoutMs: req.timeoutMs,
    token: req.token,
    log: req.log,
  });
  if (outcome.kind !== 'exited') return { kind: 'runFailed', outcome };
  if (outcome.exitCode !== 0) return metadataFailure(outcome.stderr);
  let metadata: CargoMetadata;
  try {
    metadata = JSON.parse(outcome.stdout) as CargoMetadata;
  } catch (err) {
    return { kind: 'metadataFailed', detail: `cargo metadata printed no JSON (${(err as Error).message})` };
  }
  return locateInMetadata(metadata, realPath(req.file));
}

/** The file's real path, as cargo reports paths, or `file` itself when it is not on disk. */
export function realPath(file: string): string {
  try {
    return realpathSync(file);
  } catch {
    return file; // a file not on disk is matched as it is spelt
  }
}

/** Whether `inner` is below `folder`, compared by path components. */
function isInside(inner: string, folder: string): boolean {
  const rel = path.relative(folder, inner);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** The deepest folder that holds every one of `folders`, compared by path components. */
function commonAncestor(folders: string[]): string {
  const split = folders.map((f) => path.resolve(f).split(path.sep));
  const common: string[] = [];
  for (let i = 0; split.every((parts) => i < parts.length && parts[i] === split[0][i]); i++) common.push(split[0][i]);
  return common.join(path.sep) || path.sep;
}

const toSlashes = (p: string): string => p.split(path.sep).join('/');
