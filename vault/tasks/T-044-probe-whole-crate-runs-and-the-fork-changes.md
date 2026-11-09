---
id: T-044
title: "Probe whole-crate runs and the fork changes"
status: todo
priority: medium
feature: "008-whole-crate-analysis"
created: 2026-11-09
---

# T-044 Probe whole-crate runs and the fork changes

Spec: [[specs/features/008-whole-crate-analysis/spec.md]]

## Done when

- [ ] `spikes/008-whole-crate/probe.sh` runs the minigrep, crates.io dependency, two-member workspace and proc-macro fixtures with a scratch build of the fork carrying both changes
- [ ] Copy times, first and later run times with and without preload, and whether the analysis reuses preload's build, are recorded
- [ ] Repeat-run results for a library and a binary target, the paths results carry, and the workspace run against the single-crate run are recorded
- [ ] The outputs for a missing dependency, a missing linker, a compile error in another file and a file under `tests/`, and `Cargo.lock` behaviour, are recorded
- [ ] All of it is in the spec's Appendix B, and D1 to D4 are revised where overturned
- [ ] The captures are in `src/test/fixtures/data/`

## Notes

- Plan: [[specs/features/008-whole-crate-analysis/plan.md]].
