---
id: T-049
title: "Explain why a crate cannot be analysed"
status: review
priority: medium
feature: "008-whole-crate-analysis"
created: 2026-11-09
---

# T-049 Explain why a crate cannot be analysed

Spec: [[specs/features/008-whole-crate-analysis/spec.md]]

## Done when

- [x] `dependencyMissing`, `linkerMissing`, `compileErrors` with files and lines, and `unsupportedTarget` have their messages
- [x] A crate failure's notification offers Analyze This File Alone, which runs feature 003's analysis
- [x] Unit tests classify the probe's captures
- [x] End-to-end tests for AC5, AC6 and AC10 pass

## Notes

- Plan: [[specs/features/008-whole-crate-analysis/plan.md]].
- Done on 2026-11-09. `errors.ts`: `crateBuildFailure` reads cargo's error output for a dependency missing from the cache (``no matching package named `x` found``, or `failed to download` / `failed to get`), giving `dependencyMissing` with the name and `cargo fetch` (R6), and for ``linker `cc` not found``, giving `linkerMissing` with how to install a linker on the platform (R7). `crateCompileErrors` lists the compile errors' files and lines from `cargo check`'s primary spans, at most five and how many more (R8); `parseCompilerErrors` now keeps each error's place. `unsupportedTarget` is the build-script message (R10). `types.ts` has the three new codes and `offersFileAlone` on an error result.
- `command.ts`: after a failed preload, a missing dependency returns at once, but a missing linker does not, since the analysis can still give results (R7). A failed crate run is classified by `crateBuildFailure`, else as before. When the cursor gets no result, a linker or dependency failure in stderr is reported first; otherwise a build error in the active file asks `cargo check --message-format=json -p <package>` with the target's flags (`--lib`, `--bin`, `--test`, `--example`, `--bench`) for the compile errors. Every error of a crate run except a cancel or no function carries `offersFileAlone`, and its notification has an **Analyze This File Alone** button, which runs `aquascope.analyzeAtCursor` with the file's URI and `{ alone: true }`, feature 003's analysis. The option is part of the existing command, not a new one, so the tests call it too.
- Found while testing AC6: a workspace proc macro that cannot be linked fails only the functions using it when the crate names it by path, as T-044's fixture did, but when the crate imports it with `use`, the run exits 0 with no results at all and the linker's error only in stderr. The command therefore checks stderr whenever the cursor gets no result. Spec R7 and Appendix B say so now.
- Recaptured `src/test/fixtures/data/crate/` with the pinned fork, as T-045 left for this task: `probe.sh` now builds the pinned tag, or uses `PROBE_INSTALL`, and checks its clone is at the pin; `fork-probe.patch` stays as the record of T-044's prototype. The broken minigrep's build error now carries `file_path: "src/lib.rs"`; the other captures changed only in order and a thread id.
- New fixture projects: `missing-dep` (a dependency named `aquascope-test-missing-crate`), `targets` (a library, a build script, an example, a bench and an integration test) and `proc-macro`, whose derive generates a `hello()` method using `proc_macro` only.
- Tests: five unit tests in `errors.test.ts` from the captures (missing dependency, both linker cases and each platform's advice, a build-script panic left unclassified, compile errors' places and the cap, the build-script message), and in `crate.test.ts` AC5 (and the alone action), AC6 (a fresh temporary copy of `proc-macro`, with `PATH` set to `/bin`), AC10 (and the alone action on `build.rs`) and R8 (an unsaved edit breaks `run` in lib.rs; the message names `src/lib.rs` and its line, and `config.rs` is still analysed). 173 passing.
