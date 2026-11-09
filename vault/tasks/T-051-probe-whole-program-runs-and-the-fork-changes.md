---
id: T-051
title: "Probe whole-program runs and the fork changes"
status: todo
priority: medium
feature: "009-whole-crate-stack-heap"
created: 2026-11-09
---

# T-051 Probe whole-program runs and the fork changes

Spec: [[specs/features/009-whole-crate-stack-heap/spec.md]]

## Done when

- [ ] `spikes/009-whole-crate-interpreter/probe.sh` runs the chapter 12 minigrep, a binary with modules and no library, a binary using a vendored crates.io dependency, a binary whose modules use `crate::` paths, and a workspace whose binary uses a library member, with a scratch build of the fork carrying the plan's five changes
- [ ] It records whether Miri runs each program with and without the whole-program build settings
- [ ] It records whether arguments reach `env::args()` and from which folder `poem.txt` is read
- [ ] It records whether the one-crate build compiles, whether a step in `config.rs` has `main`'s frame below it, and the frames' names and paths
- [ ] It records the steps in the whole run and per file, the output size, first and later run times, and what a run with missing arguments returns
- [ ] All of it is in the spec's Appendix B, with D3 to D5 revised where overturned
- [ ] The captures are in `src/test/fixtures/data/stack-heap-crate/`

## Notes

- Plan: [[specs/features/009-whole-crate-stack-heap/plan.md]].
- The plan's one-crate approach rests on this probe: Aquascope's interpreter records steps only in functions of the crate it compiles (plan, Appendix C). If the one-crate build fails on the fixtures, the spec is revised before T-052.
