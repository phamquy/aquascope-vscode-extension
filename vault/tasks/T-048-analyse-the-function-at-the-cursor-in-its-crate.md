---
id: T-048
title: "Analyse the function at the cursor in its crate"
status: done
priority: medium
feature: "008-whole-crate-analysis"
created: 2026-11-09
---

# T-048 Analyse the function at the cursor in its crate

Spec: [[specs/features/008-whole-crate-analysis/spec.md]]

## Done when

- [x] A file in a package is analysed in its copied crate with the fork's file option
- [x] The first run per project runs preload with its own progress, no timeout and cancel
- [x] Results are kept for the active file and the body at the cursor is selected; other files keep feature 003's analysis
- [x] End-to-end tests for AC1 to AC3 and AC9 pass against the development bundle
- [ ] The extension is checked by hand to be disabled in Restricted Mode, and the result recorded

## Notes

- Plan: [[specs/features/008-whole-crate-analysis/plan.md]].
- Done on 2026-11-09, except the hand check in Restricted Mode, which needs the user. VS Code's guide says an extension that declares no `capabilities.untrustedWorkspaces` "will be treated as not supporting Workspace Trust" and is disabled in Restricted Mode, "the default behavior even if you do nothing" (https://code.visualstudio.com/api/extension-guides/workspace-trust); this extension declares none and has a `main` entry point.
- `command.ts`: `analyze` first runs `locateCrate` (T-046) for a file on disk. A file in a crate goes to `analyzeCrate`; a file in no package, or an unsaved new file, to `analyzeFile`, feature 003's run, unchanged. `analyzeCrate` brings the copy up to date with every unsaved editor (T-047, taken when the command starts, with the active editor's text as analysed), runs `cargo aquascope preload` in the workspace's copy the first time per project with no time limit, then `cargo aquascope --crate-of <file in the copy> permissions` with the usual timeout, and selects in the active file's results. The build folder is the project's `target/`, kept between runs. If preload fails, the analysis runs with no time limit instead (the plan's preload risk). The log names the crate, the target and the file, the copy's counts, and the commands.
- `runner.ts`: `timeoutMs` is optional; with none, no timer is started. `withProgress` passes a `report` function, which the crate run uses for "copying the project", "building the dependencies, the first time on this crate" and "analysing", shown below the command's title rather than as a title of their own.
- `select.ts`: with a file, only results whose `file_path` is that file, or that name no file, are kept before columns are converted with the editor's text. Without it, a cursor inside `parse` in `config.rs` picks `search` from lib.rs, whose body covers the same line numbers in its own file.
- Left for T-049, which owns the failure messages: a build script, a `cargo metadata` failure and a crate that fails to build give `toolFailed` or `compileErrors` with plain messages, and a failed crate run gives 003's generic `toolFailed`. T-049 gives them their own codes, the files and lines of compile errors, and the Analyze This File Alone action.
- The preload mark is per project: dependencies added later are built by the analysis itself, under the usual timeout.
- Fixtures in `src/test/fixtures/projects/`: the split minigrep and the two-member workspace from T-044, and `with-dep`, whose `itoa` 1.0.18 is vendored with `cargo vendor --offline` (88 KB, with its MIT and Apache licence files) and pinned by its `Cargo.lock`, so AC2 needs neither the network nor the machine's cargo cache. The other fixtures have no `Cargo.lock`, so T-050's AC4 can check that the one cargo writes lands only in the copy.
- Tests: `crate.test.ts` (AC1: `parse` in `config.rs`, which uses `crate::Case` and so builds only with its crate, drawn with every marker in the function, the panel showing its lines and the log the `--crate-of` run; AC2; AC3; AC9: an unsaved line shifts the result by one, the file on disk is unchanged, and after the revert the copy is restored), three selection tests from T-044's capture, and a runner test with no timeout. 164 passing.
- Approved on 2026-11-09 before the Restricted Mode hand check was done; that check moves to T-050, which closes the feature. The user tested the split minigrep by hand: the permissions view works with its crate. Show Stack and Heap still analyses the file alone, as the spec's out-of-scope list says, and the user chose to do it with the crate in a feature 009.
