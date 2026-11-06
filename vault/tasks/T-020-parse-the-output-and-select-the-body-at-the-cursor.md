---
id: T-020
title: "Parse the output and select the body at the cursor"
status: done
priority: medium
feature: "003-run-analysis-at-cursor"
created: 2026-11-06
---

# T-020 Parse the output and select the body at the cursor

Spec: [[specs/features/003-run-analysis-at-cursor/spec.md]]

## Done when

- [x] unit tests on captured JSON select each of `grow`, `area` and `main` in fixture 05, pick the innermost of nested bodies, report no function outside bodies, and convert columns correctly on a non-ASCII line (R7)

## Notes

- `src/analysis/select.ts`: `selectAtCursor(stdout, source, cursor)` returns `selected` (the innermost containing body), `none` (with the `BuildError` ranges and `AnalysisError` messages, for R10) or `invalid` (stdout is not Aquascope's JSON list). Containment includes both ends of the range; the body range starts at `fn`, so the signature counts as inside.
- Columns: every `{line, column}` in the output is converted to UTF-16, not only the body range, so the returned `AnalysisOutput` is in VS Code positions throughout for R13 and feature 004 (documented on `AnalyzeResult`). Only lines with surrogate pairs change; the conversion uses the analysed text, not the live document.
- Innermost: the latest start, then the earliest end; every test also runs on the reversed list to show the choice does not depend on result order.
- Test data: `src/test/fixtures/data/` holds the captured JSON; `n2_nested` (a function inside a function, and a closure) was captured from the dev bundle for this task and added to the fixture workspace. Aquascope reports the closure as its own body.
- Mutation check: skipping the conversion fails the emoji test.
- `src/test/suite/select.test.ts`: 7 tests.

