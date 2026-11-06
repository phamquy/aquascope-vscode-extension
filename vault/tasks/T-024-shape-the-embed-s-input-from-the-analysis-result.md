---
id: T-024
title: "Shape the embed's input from the analysis result"
status: done
priority: medium
feature: "004-render-visualization-webview"
created: 2026-11-06
---

# T-024 Shape the embed's input from the analysis result

Spec: [[specs/features/004-render-visualization-webview/spec.md]]

## Done when

- [x] unit tests on captured data cover the shown lines and line shift for a method, `main`, a closure and a multi-line body, a non-ASCII line, the out-of-range guard and the title; R3, D2

## Notes

- `src/visualization/embedInput.ts`: `embedInput(output, source)` returns `code` (the whole lines of `body_range`, carriage returns stripped), `firstLine`, `response` (`[{ Ok: shifted }]`), `title` ("Aquascope: lines 8–11", or "line 8" for a one-line body) and `dropped`. The input result is cloned, never modified.
- The out-of-range guard removes any step, boundary, loan or move with a position outside the shown lines and names it in `dropped` (for T-026 to log). No captured body triggers it, the closure in `n2_nested` included, so the plan's risk did not materialise on the fixtures.
- The position walk moved from `select.ts` to `src/analysis/positions.ts` (`forEachPosition`), now shared by the UTF-16 conversion and the line shift; the selection tests pass unchanged.
- `src/test/suite/embedInput.test.ts`: 8 tests on captured data (method, `main`, closure, multi-line body with a nested function, emoji line, CRLF, the guard, and every captured body).

