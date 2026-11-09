// Keeps a copy of a project in the extension's storage, with the unsaved editors written over it, so that a
// whole-crate analysis sees the text the user sees and writes nothing in the project (feature 008, R4, R5,
// D1). The copy is brought up to date before each run, copying only what changed since the last one; the
// file system is used asynchronously, so a large project does not block the extension host.
import { createHash } from 'crypto';
import { promises as fs } from 'fs';
import * as path from 'path';

/** A project's folders in the extension's storage. */
export interface ProjectFolders {
  /** `<storage>/projects/<hash of the copy root>`. */
  dir: string;
  /** The copy, with the layout the copy folders have below the copy root. */
  src: string;
  /** Cargo's build output, kept between runs so that the dependencies are built once (R5). */
  target: string;
}

/** What to copy: the copy root and the folders below it, as `project.ts` finds them (`.` for the root). */
export interface CopySpec {
  copyRoot: string;
  copyFolders: string[];
}

/** An editor with unsaved changes: its file in the project and the text it shows. */
export interface UnsavedEditor {
  file: string;
  text: string;
}

export interface SyncStats {
  /** Files in the copy folders, skipping `.git` and cargo's build folders. */
  files: number;
  /** Files copied from the project: new, changed, or restored after their editor stopped being unsaved. */
  copied: number;
  /** Copies deleted because their file is gone from the project. */
  deleted: number;
  /** Unsaved editors whose text is in the copy. */
  unsaved: number;
  ms: number;
}

/** What the last run copied, kept as `manifest.json` beside the copy. */
interface Manifest {
  copyRoot: string;
  /** Each copied file, by its path below the copy root, with the size and modification time it had. */
  files: Record<string, string>;
  /** Files whose copy held an unsaved editor's text. */
  unsaved: string[];
}

export function projectFolders(storage: string, copyRoot: string): ProjectFolders {
  const hash = createHash('sha256').update(copyRoot).digest('hex').slice(0, 16);
  const dir = path.join(storage, 'projects', hash);
  return { dir, src: path.join(dir, 'src'), target: path.join(dir, 'target') };
}

/** Where a file or folder of the project is in its copy. */
export function inCopy(folders: ProjectFolders, copyRoot: string, file: string): string {
  return path.join(folders.src, path.relative(copyRoot, file));
}

/**
 * Brings the copy of `spec`'s folders up to date and writes the unsaved editors' text over it. Files are
 * copied when they are new, changed in size or modification time since the last run, or held unsaved text
 * last time; copies of files gone from the project are deleted; `.git` and cargo's build folders, which
 * hold a `CACHEDIR.TAG`, are skipped, and so are symbolic links. Every file written gets the current time
 * as its modification time, so that cargo rebuilds exactly what changed, even when a restored file is older
 * than the last build. The project itself is only read.
 */
export async function syncProject(storage: string, spec: CopySpec, unsaved: UnsavedEditor[]): Promise<{ folders: ProjectFolders; stats: SyncStats }> {
  const started = performance.now();
  const folders = projectFolders(storage, spec.copyRoot);
  await fs.mkdir(folders.src, { recursive: true });
  const manifestPath = path.join(folders.dir, 'manifest.json');
  const previous = await readManifest(manifestPath, spec.copyRoot);
  const wasUnsaved = new Set(previous.unsaved);
  const now = new Date();

  // The unsaved editors inside the copy folders, by path below the copy root.
  const unsavedNow = new Map<string, string>();
  for (const editor of unsaved) {
    const rel = toSlashes(path.relative(spec.copyRoot, editor.file));
    if (spec.copyFolders.some((f) => f === '.' ? !rel.startsWith('..') && !path.isAbsolute(rel) : rel.startsWith(`${f}/`))) {
      unsavedNow.set(rel, editor.text);
    }
  }

  const files: Record<string, string> = {};
  let copied = 0;
  const walk = async (dir: string, rel: string): Promise<void> => {
    let entries;
    try {
      entries = await fs.readdir(dir, { withFileTypes: true });
    } catch {
      return; // a folder gone from the project
    }
    if (rel !== '' && entries.some((e) => e.isFile() && e.name === 'CACHEDIR.TAG')) return; // cargo's build output
    for (const entry of entries) {
      const relPath = rel === '' ? entry.name : `${rel}/${entry.name}`;
      const from = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== '.git') await walk(from, relPath);
      } else if (entry.isFile()) {
        const st = await fs.stat(from);
        const stamp = `${st.size}:${st.mtimeMs}`;
        files[relPath] = stamp;
        if (unsavedNow.has(relPath)) continue; // its editor's text is written below
        const to = path.join(folders.src, relPath);
        if (previous.files[relPath] !== stamp || wasUnsaved.has(relPath) || !(await exists(to))) {
          await fs.mkdir(path.dirname(to), { recursive: true });
          await fs.copyFile(from, to);
          await fs.utimes(to, now, now);
          copied += 1;
        }
      }
    }
  };
  for (const folder of spec.copyFolders) {
    await walk(path.join(spec.copyRoot, folder), folder === '.' ? '' : toSlashes(folder));
  }

  let deleted = 0;
  const gone = [...Object.keys(previous.files), ...wasUnsaved].filter((rel) => !(rel in files) && !unsavedNow.has(rel));
  for (const rel of new Set(gone)) {
    await fs.rm(path.join(folders.src, rel), { force: true });
    deleted += 1;
  }

  for (const [rel, text] of unsavedNow) {
    const to = path.join(folders.src, rel);
    const current = await fs.readFile(to, 'utf8').catch(() => undefined);
    if (current === text) continue; // the same unsaved text as last time: nothing to rebuild
    await fs.mkdir(path.dirname(to), { recursive: true });
    await fs.writeFile(to, text);
    await fs.utimes(to, now, now);
  }

  const manifest: Manifest = { copyRoot: spec.copyRoot, files, unsaved: [...unsavedNow.keys()] };
  await fs.writeFile(manifestPath, JSON.stringify(manifest));
  const stats = { files: Object.keys(files).length, copied, deleted, unsaved: unsavedNow.size, ms: Math.round(performance.now() - started) };
  return { folders, stats };
}

async function readManifest(file: string, copyRoot: string): Promise<Manifest> {
  try {
    const manifest = JSON.parse(await fs.readFile(file, 'utf8')) as Manifest;
    if (manifest.copyRoot === copyRoot && manifest.files && Array.isArray(manifest.unsaved)) return manifest;
  } catch {
    // no manifest yet, or an unreadable one: copy everything
  }
  return { copyRoot, files: {}, unsaved: [] };
}

async function exists(file: string): Promise<boolean> {
  return fs.access(file).then(
    () => true,
    () => false,
  );
}

const toSlashes = (p: string): string => p.split(path.sep).join('/');
