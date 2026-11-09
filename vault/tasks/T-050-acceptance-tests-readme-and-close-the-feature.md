---
id: T-050
title: "Acceptance tests, README and close the feature"
status: review
priority: medium
feature: "008-whole-crate-analysis"
created: 2026-11-09
---

# T-050 Acceptance tests, README and close the feature

Spec: [[specs/features/008-whole-crate-analysis/spec.md]]

## Done when

- [x] `crate.test.ts` passes AC1 to AC6 and AC8 to AC10, and feature 003's suites pass unchanged for AC7, in `npm test`
- [x] The README describes analysing a file with its crate, the limits, and the linker and cargo cache it needs
- [x] The spec's criteria are ticked, and feature 008 is `implemented` in the spec and `specs/product.md`
- [ ] The extension is checked by hand to be disabled in Restricted Mode, and the result recorded (moved from T-048)
- [x] `npm run typecheck && npm run lint && npm test` pass

## Notes

- Plan: [[specs/features/008-whole-crate-analysis/plan.md]].
- Done on 2026-11-09, except the Restricted Mode hand check, which waits for the user. VS Code's guide says an extension that declares no `capabilities.untrustedWorkspaces` is treated as not supporting Workspace Trust and is disabled in Restricted Mode by default; the README states it, and is corrected if the check finds otherwise.
- `crate.test.ts` now covers every automated criterion: AC1 to AC3 and AC9 (T-048), AC5, AC6, AC10 and R8 (T-049), and here AC8 (a second run on the minigrep crate took 340 to 352 ms) and AC4 (every file of `src/test/fixtures/projects/`, with its size, time and hash, is the same after the suite as before it, and no `target/` was written; the fixtures other than `with-dep` have no `Cargo.lock`, so none was written either). AC7 is feature 003's `analyze.test.ts`, which was not changed by this feature. `folderSnapshot` is a new helper in `harness.ts`, so 003's suite keeps its own.
- README: the Usage section says a file in a Cargo package is analysed with the rest of its crate, how the copy and the first build work and how long they take, the storage they use, that nothing is downloaded and `cargo fetch` fills the cache, the linker for build scripts and proc macros, Restricted Mode, the targets that can and cannot be analysed, and Analyze This File Alone; Show Stack and Heap still works on the file alone. The Installing section mentions the cargo cache and the linker. `contributes.test.ts` checks the README names these.
- `specs/product.md`: the zero-install exceptions now say the extension never downloads and needs the dependencies in the cargo cache; feature 008 is `implemented` there and in the spec, with AC1 to AC10 ticked.
- The first `npm test` failed feature 006's AC2 and D4, the focus-dependent title-button tests of #37; the rerun passed, 176 of 176.
