---
id: T-044
title: "Probe whole-crate runs and the fork changes"
status: review
priority: medium
feature: "008-whole-crate-analysis"
created: 2026-11-09
---

# T-044 Probe whole-crate runs and the fork changes

Spec: [[specs/features/008-whole-crate-analysis/spec.md]]

## Done when

- [x] `spikes/008-whole-crate/probe.sh` runs the minigrep, crates.io dependency, two-member workspace and proc-macro fixtures with a scratch build of the fork carrying both changes
- [x] Copy times, first and later run times with and without preload, and whether the analysis reuses preload's build, are recorded
- [x] Repeat-run results for a library and a binary target, the paths results carry, and the workspace run against the single-crate run are recorded
- [x] The outputs for a missing dependency, a missing linker, a compile error in another file and a file under `tests/`, and `Cargo.lock` behaviour, are recorded
- [x] All of it is in the spec's Appendix B, and D1 to D4 are revised where overturned
- [x] The captures are in `src/test/fixtures/data/`

## Notes

- Plan: [[specs/features/008-whole-crate-analysis/plan.md]].
- Done on 2026-11-09. `spikes/008-whole-crate/probe.sh` builds a prototype of the fork on its first run, `v0.4.0-vscode.1` plus `fork-probe.patch` (`--crate-of <file>`, using rustc_plugin's `CrateContainingFile`, and a `file_path` on each result), then copies the fixtures with `copy.mjs`, a prototype of D1's copy, and runs the prototype on the copies. `report.py` summarises; the probe was run three times, and the spec's Appendix B has the numbers.
- Fixtures in `spikes/008-whole-crate/fixtures/`: minigrep split into `lib.rs`, `config.rs` (issue #31's `parse`), `main.rs` and `tests/cli.rs`; a crate using `itoa`; one using `serde` with derive; a two-member workspace; a workspace with a local proc macro; a dependency in no cache; a path dependency outside the workspace; and a crate with every kind of target.
- Confirmed: D1 (copying Aquascope's source took up to 248 ms, an unchanged copy up to 20 ms; `Cargo.lock` was written into the copy), D2, strengthened (the whole-workspace run gives dependent crates no results at all, because the analysis stops without writing their dependencies' metadata), D4 (later runs about 0.3 s; first runs up to 1.2 s without dependencies and 3 to 4.2 s with serde's derive; AC8 stands) and D6 (after preload the analysis wrote nothing new).
- Revised: D3, the path also goes on build errors, because a failing function's error carries only a file number; and D7, files under `tests/`, `examples/` and `benches/` are analysed, only `build.rs` is not (rustc_plugin panics on it), and `#[cfg(test)]` modules give no results. R7, R10, AC10 and the out-of-scope list follow; the plan and T-045 and T-046 are updated to match.
- The plan's repeat-run risk did not occur: second runs on unchanged code, and after a `touch`, returned their results for a library and a binary alike.
- A linker missing behaves two ways: a crates.io proc macro fails the run (exit 101), a workspace member's proc macro only fails the functions using it (exit 0), and both print ``linker `cc` not found``.
- Captures in `src/test/fixtures/data/crate/` (metadata, permissions output, `cargo check` output and stderr), with the probe's folder replaced by `/copies` and the home folder by `~`; no file holds the machine's paths.
