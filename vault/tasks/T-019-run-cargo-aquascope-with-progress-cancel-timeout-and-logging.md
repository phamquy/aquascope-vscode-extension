---
id: T-019
title: "Run cargo aquascope with progress, cancel, timeout and logging"
status: done
priority: medium
feature: "003-run-analysis-at-cursor"
created: 2026-11-06
---

# T-019 Run cargo aquascope with progress, cancel, timeout and logging

Spec: [[specs/features/003-run-analysis-at-cursor/spec.md]]

## Done when

- [x] the runner spawns the tool as a process group with a cancellable progress notification, kills the group on cancel and on timeout (unit test with a sleeping child), and logs command, env delta, duration, exit code and stderr to the Aquascope channel; AC8 checked by hand and recorded here (R8, R11)

## Notes

- `src/analysis/runner.ts`: `run(request)` returns `{kind: exited | timeout | cancelled | spawnError, exitCode, stdout, stderr, durationMs, error?}`; the caller decides what a non-zero exit means, so the same function serves the follow-up `cargo check` (exit 101 on compile errors). Also `outputChannel()` (created on first use) and `withProgress(title, task)`.
- Process group: `detached: true` on POSIX and `process.kill(-pid, 'SIGKILL')`; `taskkill /T /F` on Windows, unexercised. After a kill the run ends on `exit` rather than `close`, so a process holding the pipes cannot hang it.
- Log: command line, cwd, pid, each variable set, the removed ones, the outcome with duration and output sizes; stderr in full unless the run exited 0 or was cancelled.
- AC8 was planned as a manual check; it is now automated in `src/test/suite/runner.test.ts` against the dev bundle (2026-11-06, darwin-arm64): a 4,000-function file is cancelled once `aquascope-driver` appears in the group (about 0.3 s), and another run times out after 2.5 s; `cargo`, `cargo-aquascope` and `aquascope-driver` were seen in the group, and the group was empty afterwards. `pgrep -fl 'aquascope-driver|cargo-aquascope'` showed nothing after the suite. Clicking Cancel in the notification is still checked by hand in T-022, once the command is wired.
- Mutation check: replacing the group kill with `child.kill('SIGKILL')` fails both shell-grandchild tests every time; the two real-toolchain tests catch it only depending on timing, so the shell tests are the regression guard.
- `src/test/suite/runner.test.ts`: 9 tests (7 POSIX unit, 2 against the dev bundle).

