---
id: T-021
title: "Classify failures, show the summary and wire the command"
status: done
priority: medium
feature: "003-run-analysis-at-cursor"
created: 2026-11-06
---

# T-021 Classify failures, show the summary and wire the command

Spec: [[specs/features/003-run-analysis-at-cursor/spec.md]]

## Done when

- [x] unit tests map the build errors and `cargo check` diagnostics captured in T-013 to each R10 category, and the command runs end to end in the development host showing the R13 summary and writing the selected JSON to the channel (R10, R13)

## Notes

- `src/analysis/errors.ts`: `parseCompilerErrors` (cargo JSON, errors only), `classifyBuildErrors` (single-file limit naming each backticked name once, otherwise compile errors with the 1-based lines of the functions that failed), `runFailure` (timeout, cancel, start failure, non-zero exit). The limit message also mentions a misspelt name, because E0433 covers both. When both kinds of error are present the limit wins; R10 clarified.
- `src/analysis/command.ts`: resolves the toolchain, snapshots text and cursor, cancels a run still in flight, runs `cargo aquascope permissions` under a cancellable progress notification, selects the body, and on build errors runs `cargo check --message-format=json` and writes the rendered errors to the channel. Each of the two processes gets the full timeout. A cancel shows no message; the errors whose details are in the channel offer "Show Output". The summary reads "Aquascope: analysed the function at lines 17–21: 2 permission steps, 2 boundaries." and the selected JSON goes to the channel.
- An `AnalysisError` with no analysable body at the cursor is reported as `toolFailed` with its message, since Aquascope gives it no range.
- The handler is imported directly rather than lazily: the bundle is a single 22 KB file. Plan updated.
- Tests: `errors.test.ts` (7, on the captured Aquascope output and `cargo check` diagnostics) and `analyze.test.ts` (4 end-to-end smoke tests against the dev bundle: analysis, single-file limit through `cargo check`, no function, missing toolchain). T-022 extends `analyze.test.ts` to the acceptance criteria.
- Checked in the test host's saved output channel (`.vscode-test/user-data/logs/.../1-Aquascope.log`): command lines, environment, durations (0.3 to 0.9 s), the selected JSON, the `cargo check` errors and each result are logged.

