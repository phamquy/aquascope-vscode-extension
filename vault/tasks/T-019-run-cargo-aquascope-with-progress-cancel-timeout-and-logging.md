---
id: T-019
title: "Run cargo aquascope with progress, cancel, timeout and logging"
status: todo
priority: medium
feature: "003-run-analysis-at-cursor"
created: 2026-11-06
---

# T-019 Run cargo aquascope with progress, cancel, timeout and logging

Spec: [[specs/features/003-run-analysis-at-cursor/spec.md]]

## Done when

- [ ] the runner spawns the tool as a process group with a cancellable progress notification, kills the group on cancel and on timeout (unit test with a sleeping child), and logs command, env delta, duration, exit code and stderr to the Aquascope channel; AC8 checked by hand and recorded here (R8, R11)

## Notes
