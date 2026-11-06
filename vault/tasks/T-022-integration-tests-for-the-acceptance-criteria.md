---
id: T-022
title: "Integration tests for the acceptance criteria"
status: done
priority: medium
feature: "003-run-analysis-at-cursor"
created: 2026-11-06
---

# T-022 Integration tests for the acceptance criteria

Spec: [[specs/features/003-run-analysis-at-cursor/spec.md]]

## Done when

- [x] `analyze.test.ts` covers AC1 to AC7 and AC9 without depending on result order, `npm run typecheck && npm run lint && npm test` passes, AC8 and AC11 manual checks are recorded, and the spec's acceptance criteria are ticked

## Notes

- `src/test/suite/analyze.test.ts` now holds one test per criterion and replaces T-021's smoke tests. The toolchain suite covers AC1 to AC6 and AC9; a second suite, which runs without a bundle, covers AC7 with the setting pointing nowhere and with the setting empty. Positions are found by searching each fixture for `fn <name>`, and results are compared by range only.
- AC1 timings on darwin-arm64 (2026-11-06): 01 883 ms (first run, cold), 02 312 ms, 03 308 ms, 04 261 ms, 05 292 ms; the limit is 10 s.
- AC2 also asserts a boundary where an expected permission is missing, which is what the borrow error looks like in the analysis.
- AC4 runs `main` first, then the `struct` line, so a stale result would show.
- AC5 inserts a line without saving and checks the range moves down one line, then reverts the editor.
- AC9 compares size, modification time and SHA-1 of every workspace file before and after the suite; the runs land in `.vscode-test/user-data/User/globalStorage/jackpham.aquascope-vscode-extension/runs/`, and only the latest is kept.
- Automated criteria ticked in the spec: AC1 to AC7, AC9, AC10. `npm test`: 64 passing.
- Manual checks, done by the user on 2026-11-06 in the Extension Development Host (F5) with `aquascope.toolchainPath` set to the dev bundle, and reported as passing: AC8, a large file's analysis cancelled from the progress notification, after which `pgrep -fl 'cargo-aquascope|aquascope-driver|dev-bundle/toolchain/bin/cargo'` showed nothing; AC11, both settings shown with their descriptions in the settings UI. The automated part of AC8 is in `runner.test.ts` (T-019).
- F5 first closed the Extension Development Host about a second after start: its extension host crashed with code 6 while loading the user's 120 installed extensions (this extension activates only on its command, so it was not running). `.vscode/launch.json` now passes `--disable-extensions`, as the test runner does, and F5 works.
- All acceptance criteria ticked; spec 003 and its row in `specs/product.md` set to `implemented`.

