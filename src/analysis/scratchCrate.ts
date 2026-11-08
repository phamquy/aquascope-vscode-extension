// The temporary single-file crate each run analyses (R2, R9).
import * as path from 'path';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'fs';

export const DEFAULT_EDITION = '2024';
/** What cargo assumes for a `[package]` that names no edition. */
const UNDECLARED_EDITION = '2015';

type Read = (file: string) => string;
const readUtf8: Read = (file) => readFileSync(file, 'utf8');

/**
 * The edition declared by the nearest enclosing `Cargo.toml`, following `edition.workspace = true`
 * to the workspace root. Untitled files, files outside any package and unreadable manifests get 2024.
 */
export function detectEdition(file: string | undefined, read: Read = readUtf8): string {
  if (!file) return DEFAULT_EDITION;
  try {
    const manifest = findUp(path.dirname(file), () => true);
    if (!manifest) return DEFAULT_EDITION;
    const tables = parseManifest(read(manifest));
    const pkg = tables.get('package');
    // A virtual workspace manifest declares no package, only the edition its members may inherit.
    if (!pkg) return tables.get('workspace.package')?.get('edition') ?? DEFAULT_EDITION;
    const edition = pkg.get('edition') ?? UNDECLARED_EDITION;
    if (edition !== INHERITED) return edition;
    // The workspace root is this manifest or the nearest ancestor that has a workspace table.
    let root: Map<string, Table> | undefined;
    findUp(path.dirname(manifest), (m) => {
      const t = parseManifest(read(m));
      if ([...t.keys()].some((name) => name === 'workspace' || name.startsWith('workspace.'))) root = t;
      return root !== undefined;
    });
    return root?.get('workspace.package')?.get('edition') ?? DEFAULT_EDITION;
  } catch {
    return DEFAULT_EDITION;
  }
}

type Table = Map<string, string>;
const INHERITED = 'workspace';

/**
 * A line-based reader for the few manifest keys we need, avoiding a TOML dependency. It records every
 * table header and, inside `[package]` and `[workspace.package]`, the `edition` value.
 */
function parseManifest(text: string): Map<string, Table> {
  const tables = new Map<string, Table>();
  let name = '';
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*$/, '').trim();
    if (line.startsWith('[')) {
      // Any header ends the previous table; `[[bin]]` style array tables are recorded as `bin`.
      name = line.replace(/^\[+|\]+$/g, '').replace(/\s+/g, '');
      tables.set(name, new Map());
      continue;
    }
    if (name !== 'package' && name !== 'workspace.package') continue;
    const value = /^edition\s*=\s*["'](\d{4})["']$/.exec(line);
    if (value) tables.get(name)?.set('edition', value[1]);
    else if (/^edition\s*(\.\s*workspace\s*=\s*true|=\s*\{\s*workspace\s*=\s*true\s*\})$/.test(line)) {
      tables.get(name)?.set('edition', INHERITED);
    }
  }
  return tables;
}

/** The first `Cargo.toml` at or above `dir` that satisfies `accept`. */
function findUp(dir: string, accept: (manifest: string) => boolean): string | undefined {
  for (let d = dir; ; d = path.dirname(d)) {
    const manifest = path.join(d, 'Cargo.toml');
    if (existsSync(manifest) && accept(manifest)) return manifest;
    if (path.dirname(d) === d) return undefined;
  }
}

/**
 * The form of the temporary crate: a library for the permissions view, so files with and without `main`
 * compile (003 R2), or a program for the interpreter, which runs `main` (feature 007 R2).
 */
export type CrateForm = 'lib' | 'bin';

/** The `Cargo.toml` of the temporary crate: no dependencies, and its own workspace so cargo never climbs further. */
export function manifestFor(edition: string, form: CrateForm = 'lib'): string {
  const target = form === 'bin' ? '[[bin]]\nname = "aquascope_scratch"\npath = "src/main.rs"' : '[lib]\npath = "src/lib.rs"';
  return `[package]\nname = "aquascope_scratch"\nversion = "0.0.0"\nedition = "${edition}"\n\n${target}\n\n[workspace]\n`;
}

export interface CrateOptions {
  /** This extension host's process id; run directories are named after it. */
  pid?: number;
  /** Whether another extension host is still running, so its in-flight run is left alone. */
  isAlive?: (pid: number) => boolean;
  /** `lib` (the default) writes `src/lib.rs`; `bin` writes `src/main.rs`. */
  form?: CrateForm;
}

/**
 * Writes `source` as `src/lib.rs`, or `src/main.rs` for the `bin` form, of a fresh crate under
 * `<storage>/runs/` and returns its directory.
 * Earlier runs of this extension host, and runs left by hosts that have exited, are deleted first.
 * Global storage is shared by all VS Code windows, so another window's in-flight run is kept.
 */
export function writeCrate(storage: string, source: string, edition: string, options: CrateOptions = {}): string {
  const pid = options.pid ?? process.pid;
  const isAlive = options.isAlive ?? processAlive;
  const runs = path.join(storage, 'runs');
  mkdirSync(runs, { recursive: true });
  for (const entry of readdirSync(runs)) {
    const owner = /^(\d+)-/.exec(entry);
    const keep = owner && Number(owner[1]) !== pid && isAlive(Number(owner[1]));
    if (keep) continue;
    try {
      rmSync(path.join(runs, entry), { recursive: true, force: true, maxRetries: 2 });
    } catch {
      // A file still in use (Windows) must not block the new run; the next run tries again.
    }
  }
  const dir = mkdtempSync(path.join(runs, `${pid}-`));
  mkdirSync(path.join(dir, 'src'));
  const form = options.form ?? 'lib';
  writeFileSync(path.join(dir, 'Cargo.toml'), manifestFor(edition, form));
  writeFileSync(path.join(dir, 'src', form === 'bin' ? 'main.rs' : 'lib.rs'), source);
  return dir;
}

function processAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}
