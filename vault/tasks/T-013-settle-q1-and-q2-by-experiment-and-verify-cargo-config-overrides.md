---
id: T-013
title: "Settle Q1 and Q2 by experiment and verify cargo config overrides"
status: done
priority: medium
feature: "003-run-analysis-at-cursor"
created: 2026-11-06
---

# T-013 Settle Q1 and Q2 by experiment and verify cargo config overrides

Spec: [[specs/features/003-run-analysis-at-cursor/spec.md]]

## Done when

- [x] `spikes/003-single-file-crate/` script and fixtures committed; every check in plan Appendix A has a recorded result; spec Q1 and Q2 moved to Decisions with an evidence appendix and R6 names the flag strategy; needs your approval to run

## Notes

Ran `spikes/003-single-file-crate/probe.sh` twice on 2026-11-06 (same results; 05 alternates SAME/REORDERED, the known ordering nondeterminism). Results are in the spec's Appendix B and decisions D4 to D6.

- Q1: never pass `--should-fail`. Borrow failures are analysed fully without it; with it, type-errored functions return an empty `Ok` instead of `BuildError`.
- Q2: library crate gives the same results as the binary-crate baseline.
- New: Aquascope silences compiler diagnostics (exit 0, stderr is only MIR dumps), so R10 now classifies from a follow-up `cargo check --message-format=json` (0.1 s). R10, R11 and AC6 updated in the spec.
- R4 overrides verified: without them a user wrapper breaks the run and a user `target-dir` receives the output; with them neither happens.
- Columns are Unicode characters (confirmed on a `🦀é` line). Runs take 0.2 to 0.6 s.

