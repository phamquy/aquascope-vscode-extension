#!/usr/bin/env node
// T-044: a prototype of feature 008's project copy (D1), to time it.
//
//   node spikes/008-whole-crate/copy.mjs <project folder> <copy folder>
//
// Brings <copy folder> up to date with <project folder>, skipping `.git` and cargo's build folders (marked by
// a CACHEDIR.TAG file). A file is copied when it is new, or when its size or modification time differs from
// the record of the last run, kept beside the copy in <copy folder>.manifest.json; files gone from the
// project are deleted from the copy. Prints one JSON line: files seen, bytes, files copied and deleted, ms.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const [source, copy] = process.argv.slice(2);
if (!source || !copy) {
  console.error('usage: copy.mjs <project folder> <copy folder>');
  process.exit(2);
}
const started = performance.now();
const manifestPath = `${copy}.manifest.json`;
const previous = existsSync(manifestPath) ? JSON.parse(readFileSync(manifestPath, 'utf8')) : {};
const current = {};
let bytes = 0;
let copied = 0;

function walk(dir, rel) {
  const entries = readdirSync(dir, { withFileTypes: true });
  if (rel !== '' && entries.some((e) => e.name === 'CACHEDIR.TAG')) return; // cargo's build output
  for (const entry of entries) {
    const from = path.join(dir, entry.name);
    const relPath = rel === '' ? entry.name : `${rel}/${entry.name}`;
    if (entry.isDirectory()) {
      if (entry.name === '.git') continue;
      walk(from, relPath);
    } else if (entry.isFile()) {
      const st = statSync(from);
      const stamp = `${st.size}:${st.mtimeMs}`;
      current[relPath] = stamp;
      bytes += st.size;
      if (previous[relPath] !== stamp || !existsSync(path.join(copy, relPath))) {
        mkdirSync(path.dirname(path.join(copy, relPath)), { recursive: true });
        copyFileSync(from, path.join(copy, relPath)); // the copy gets the current time as its mtime
        copied += 1;
      }
    }
  }
}

mkdirSync(copy, { recursive: true });
walk(source, '');
let deleted = 0;
for (const relPath of Object.keys(previous)) {
  if (!(relPath in current)) {
    rmSync(path.join(copy, relPath), { force: true });
    deleted += 1;
  }
}
writeFileSync(manifestPath, JSON.stringify(current));
console.log(JSON.stringify({ files: Object.keys(current).length, bytes, copied, deleted, ms: Math.round(performance.now() - started) }));
