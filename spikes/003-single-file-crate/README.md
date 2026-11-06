# Spike 003: single-file crate checks (T-013)

Settles feature 003's open questions before the runner is written: whether to pass `--should-fail` (Q1), whether a single-file library crate matches spike 002's binary crates (Q2), whether the planned environment overrides neutralise a user's cargo configuration (R4), and how failures can be classified (R10). Results are recorded in Appendix B of [the feature spec](../../specs/features/003-run-analysis-at-cursor/spec.md).

It needs spike 002's build (`work/install/bin`) and trimmed toolchain (`work/toolchain-trimmed`). Run `./spikes/003-single-file-crate/probe.sh` from the repository root; it takes about 15 seconds. Outputs go to `work/results/<run>/` (gitignored) and the report to `work/report.txt`.

`fixtures/` holds the extra programs: type and resolution errors (`e1` to `e5`) and a line with non-ASCII text before the code (`n1`). Crates are staged with `mktemp` outside `$HOME` and left for the OS to clean up.
