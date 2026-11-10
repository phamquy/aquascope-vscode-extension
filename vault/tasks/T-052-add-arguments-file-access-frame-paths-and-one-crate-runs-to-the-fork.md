---
id: T-052
title: "Add arguments, file access, frame paths and one-crate runs to the fork"
status: done
priority: medium
feature: "009-whole-crate-stack-heap"
created: 2026-11-09
---

# T-052 Add arguments, file access, frame paths and one-crate runs to the fork

Spec: [[specs/features/009-whole-crate-stack-heap/spec.md]]

## Done when

- [x] The fork has the plan's six changes on a branch from `v0.4.0-vscode.2`: arguments and file access, whole-program builds, frame paths, the one-crate build, the interpreter's error message, and the values it could not read (D7)
- [x] Each change has a test in Aquascope's suite, and `cargo fmt --check`, clippy and `cargo test -p aquascope` pass
- [x] Tag `v0.4.0-vscode.3` is pushed, and changes 1, 2, 3, 5 and 6 are offered upstream
- [x] `pin.env` names the tag, the development bundle is rebuilt and the bindings regenerated
- [x] ADR 0004 lists the fork's changes and why the one-crate change stays in the fork
- [x] Feature 007's and 008's tests still pass, and an end-to-end test shows a file alone holding `let s = "hi";` drawn (AC9)

## Notes

- Plan: [[specs/features/009-whole-crate-stack-heap/plan.md]].
- Start from the probe's prototype, `spikes/009-whole-crate-interpreter/fork-probe.patch` (T-051), which has all six changes as `interpreter` options.
- Done on 2026-11-09, in the fork [phamquy/aquascope](https://github.com/phamquy/aquascope): six commits on `vscode-v0.4.0`, tagged `v0.4.0-vscode.3` at `0ae1372`. The options are `cargo aquascope [--crate-of <lib>] interpreter [--disable-isolation] [--bin-file <file>] [-- <args>]`.
  - Arguments and isolation (`8d4b2f2`), upstream [#203](https://github.com/cognitive-engineering-lab/aquascope/pull/203): `InterpretOptions`; the program sees the crate's name first. Tests in `tests/interpreter_options.rs`, with a `test_utils::interpret_with` helper.
  - Whole-program builds (`47465c4`), upstream [#205](https://github.com/cognitive-engineering-lab/aquascope/pull/205): not an option but automatic whenever `MIRI_SYSROOT` is set, which the extension always sets; it keeps existing flags. Unit test in `plugin.rs`.
  - Frame paths (`d56e7f1`), upstream [#206](https://github.com/cognitive-engineering-lab/aquascope/pull/206), stacked on #202: the nine snapshots gain `file_path`.
  - The reason on stderr (`2bde423`), upstream [#204](https://github.com/cognitive-engineering-lab/aquascope/pull/204), stacked on #203; a crate with no entry point is now an error, not a panic.
  - Values (`6a06827`), upstream [#207](https://github.com/cognitive-engineering-lab/aquascope/pull/207): beyond the prototype, a trait object's pointer no longer reports its vtable as a length. Three new snapshot programs. Upstream issue #118's program, which overflowed before, runs in 6 steps.
  - One crate (`0ae1372`), fork only: `OneCrate`, its file loader and `bin_module_main`; unit tests and `tests/one_crate.rs` with real files.
- On `vscode-v0.4.0`, `cargo fmt --check`, `cargo clippy -p aquascope -p aquascope_front -- -D warnings` and `cargo test -p aquascope -p aquascope_front` pass; each upstream branch passes fmt, clippy and its tests. The installed binaries reproduce T-051's results with the final options, and the probe's captures are byte for byte what the fork gives.
- `pin.env` names the tag; spike 002's checkout moved to it and `build.sh` rebuilt the development bundle; the bindings differ only by `MFrame.file_path`. ADR 0004 has a revision listing the nine commits.
- `stackHeapCrate.test.ts` (new) holds AC9 for a file alone, with the fixture `l1_string_literal.rs`. In `npm test`, 175 to 176 of 177 pass: in three runs the failures were feature 006's AC2 and D4, which issue #37 records as failing when the test window lacks focus, and in the first run a single test that came back cancelled, whose name that run's log did not keep.
