---
id: T-047
title: "Copy the project with unsaved editors over it"
status: todo
priority: medium
feature: "008-whole-crate-analysis"
created: 2026-11-09
---

# T-047 Copy the project with unsaved editors over it

Spec: [[specs/features/008-whole-crate-analysis/spec.md]]

## Done when

- [ ] `projectCopy.ts` brings `<storage>/projects/<hash>/src` up to date from the copy root, skipping `.git` and cargo's build folders
- [ ] Only new or changed files are copied, removed files are deleted, and every write gets a fresh modification time
- [ ] Unsaved editors' text is written over the copies and restored from disk on the next run
- [ ] Unit tests cover these, and that the project folder is unchanged

## Notes

- Plan: [[specs/features/008-whole-crate-analysis/plan.md]].
