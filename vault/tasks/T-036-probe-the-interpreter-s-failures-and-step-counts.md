---
id: T-036
title: "Probe the interpreter's failures and step counts"
status: todo
priority: medium
feature: "007-stack-heap-diagrams"
created: 2026-11-08
---

# T-036 Probe the interpreter's failures and step counts

Spec: [[specs/features/007-stack-heap-diagrams/spec.md]]

## Done when

- [ ] `spikes/007-interpreter/probe.sh` runs the interpreter with a Miri-built library on a panic, a failed `assert!`, `process::exit`, undefined behaviour in `unsafe` code, a type error, a missing `main`, a read from standard input, a loop that never ends and loops of growing length
- [ ] What each returns, and the step counts, times and output sizes, are recorded in the spec's Appendix A
- [ ] The spec is revised if some failures keep their steps (D4)
- [ ] D6's step limit is chosen
- [ ] The captured outputs are in `src/test/fixtures/data/`
- [ ] `npm run typecheck && npm run lint && npm test` pass

## Notes

- Plan: [[specs/features/007-stack-heap-diagrams/plan.md]]. Extends the spec's 2026-11-07 probe (Appendix A). The Miri-built library can be built into the scratchpad or spike folder with `MIRI_SYSROOT=<folder> cargo +nightly-2026-05-01 miri setup` (14 s); the pinned nightly here already has `miri` and `rust-src`.
