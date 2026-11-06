---
id: T-015
title: "Assemble a development bundle and fixture test workspace"
status: done
priority: medium
feature: "003-run-analysis-at-cursor"
created: 2026-11-06
---

# T-015 Assemble a development bundle and fixture test workspace

Spec: [[specs/features/003-run-analysis-at-cursor/spec.md]]

## Done when

- [x] `node scripts/dev-bundle.mjs` produces `<root>/bin` and `<root>/toolchain` from spike 002's work directory, `cargo aquascope permissions` runs from it on a fixture, `runTest.ts` opens `src/test/fixtures/workspace` and passes the bundle path, and the existing tests still pass

## Notes

Done 2026-11-06. `npm run dev-bundle` (scripts/dev-bundle.mjs) symlinks spike 002's two binaries and trimmed toolchain into `spikes/002-toolchain-bundling/work/dev-bundle/{bin,toolchain}` (gitignored); rerunning replaces the links. `cargo aquascope permissions` ran from it on fixture 05 under `env -i` with only the R4/R5 variables and found all three bodies.

`src/test/fixtures/workspace/` holds copies of spike 002's programs and spike 003's fixtures. `runTest.ts` opens it with `--disable-extensions` and passes `AQUASCOPE_TEST_TOOLCHAIN` when the bundle exists; `src/test/suite/harness.ts` gives tests `fixture()` and `requireToolchain()`, which skips with a visible message when there is no bundle (checked with `AQUASCOPE_TEST_TOOLCHAIN= npm test`: 3 passing, 1 pending). Also added the `dev-bundle` npm script and a line in CLAUDE.md's command list.

