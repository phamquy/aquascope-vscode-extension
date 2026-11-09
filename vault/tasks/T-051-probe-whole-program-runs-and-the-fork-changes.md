---
id: T-051
title: "Probe whole-program runs and the fork changes"
status: review
priority: medium
feature: "009-whole-crate-stack-heap"
created: 2026-11-09
---

# T-051 Probe whole-program runs and the fork changes

Spec: [[specs/features/009-whole-crate-stack-heap/spec.md]]

## Done when

- [x] `spikes/009-whole-crate-interpreter/probe.sh` runs the chapter 12 minigrep, a binary with modules and no library, a binary using a vendored crates.io dependency, a binary whose modules use `crate::` paths, and a workspace whose binary uses a library member, with a scratch build of the fork carrying the plan's changes
- [x] It records whether Miri runs each program with and without the whole-program build settings
- [x] It records whether arguments reach `env::args()` and from which folder `poem.txt` is read
- [x] It records whether the one-crate build compiles, whether a step in `config.rs` has `main`'s frame below it, and the frames' names and paths
- [x] It records the steps in the whole run and per file, the output size, first and later run times, and what a run with missing arguments returns
- [x] All of it is in the spec's Appendix B, with D3 to D5 revised where overturned
- [x] The captures are in `src/test/fixtures/data/stack-heap-crate/`

## Notes

- Plan: [[specs/features/009-whole-crate-stack-heap/plan.md]].
- The plan's one-crate approach rests on this probe: Aquascope's interpreter records steps only in functions of the crate it compiles (plan, Appendix C). If the one-crate build fails on the fixtures, the spec is revised before T-052.
- Done on 2026-11-09. `spikes/009-whole-crate-interpreter/probe.sh` builds a prototype on its first run, `v0.4.0-vscode.2` plus `fork-probe.patch`, with the plan's changes as options of `cargo aquascope interpreter`, and runs nine fixtures in `fixtures/` (minigrep from chapter 12 with `poem.txt`, a binary with a module, a binary using vendored `itoa`, a binary using `crate::`, a workspace, two binaries, and a string literal); `report.py` summarises. The spec's Appendix B has the numbers.
- Confirmed: the one-crate build. minigrep ran with `frog poem.txt` in 25 steps across `main.rs`, `config.rs` and `lib.rs`, with `main`'s frame below `Config::build`'s. Miri runs only an executable crate, so the library is compiled with `--crate-type bin` and `-Zcrate-attr=no_main`. Also confirmed: D1 (a binary under `src/bin/`), D3 (isolation lifted; the working folder is the workspace root, for a member too) and D4 (paths on frames; `main` is named `__aquascope_main::main`).
- Settled: D5. About 9 s per minigrep run, first or later, spent running the program; 211 KB; the 100-step limit and the 60-second timeout stand. Change 2 is needed for a workspace member (no MIR) and a crates.io dependency (E0460); the one-crate build of a binary using `crate::` fails with E0432 while `cargo check` passes, which is the plan's fallback condition.
- Added: D7 and AC9. Aquascope's interpreter crashes on a `&str` not reached through a `String` (a stack overflow; upstream #75, #118, #119), on trait objects (`todo!`), and on pointers into unsized allocations, so minigrep crashed with no arguments or a missing file, and feature 007 crashes today on `let s = "hi";`. The prototype's 42-line fix in `mvalue.rs` makes every such case run; a literal's characters are drawn with the heap. Plan and tasks now list six fork changes.
