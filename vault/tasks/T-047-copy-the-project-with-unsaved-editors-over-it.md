---
id: T-047
title: "Copy the project with unsaved editors over it"
status: done
priority: medium
feature: "008-whole-crate-analysis"
created: 2026-11-09
---

# T-047 Copy the project with unsaved editors over it

Spec: [[specs/features/008-whole-crate-analysis/spec.md]]

## Done when

- [x] `projectCopy.ts` brings `<storage>/projects/<hash>/src` up to date from the copy folders below the copy root (T-046), skipping `.git` and cargo's build folders
- [x] Only new or changed files are copied, removed files are deleted, and every write gets a fresh modification time
- [x] Unsaved editors' text is written over the copies and restored from disk on the next run
- [x] Unit tests cover these, and that the project folder is unchanged

## Notes

- Plan: [[specs/features/008-whole-crate-analysis/plan.md]].
- Done on 2026-11-09. `src/analysis/projectCopy.ts`: `syncProject(storage, { copyRoot, copyFolders }, unsaved)` keeps the copy in `<storage>/projects/<first 16 hex of the copy root's SHA-256>/src`, beside `target/` for the build output (R5), and returns the folders and counts for the log (files, copied, deleted, unsaved, ms). `inCopy` maps a project path to its copy, for T-048 to find the workspace root and the file at the cursor in the copy.
- A `manifest.json` beside the copy records each file's size and modification time from the last run and which copies held unsaved text. A file is copied when it is new, its size or time changed, or it held unsaved text last time; copies of files gone from the project, or of unsaved new files no longer open, are deleted. `.git` and folders holding a `CACHEDIR.TAG`, which is how cargo marks its build output, are skipped; a source folder that is merely named `target` is copied. Symbolic links are not followed.
- Every file written gets the current time, set explicitly rather than relying on `copyFile`, so that cargo rebuilds a restored file even when it is older than the build that used the unsaved text. An editor that is still unsaved with the same text is not rewritten, so its crate is not rebuilt for nothing.
- The file system is used asynchronously: copying Aquascope's own source took up to 248 ms in T-044, and a larger project must not block the extension host (constitution 3). Feature 003's small temporary crates stay synchronous.
- Not handled: two VS Code windows analysing the same project at the same moment share its folders, since the global storage is shared; cargo locks its build folder, but one window's sync could change files under the other's run. A later change can add a lock if it matters.
- Tests: `projectCopy.test.ts`, seven tests on temporary folders, with the project's files, sizes, times and hashes compared before and after (the project is only read). 156 passing.
