---
id: T-072
title: "Analyse binaries named differently from their package"
status: done
priority: medium
feature: "008-whole-crate-analysis"
created: 2026-11-17
---

# T-072 Analyse binaries named differently from their package

Spec: [[specs/features/008-whole-crate-analysis/spec.md]]

## Done when

- [x] The fork has rustc_plugin analyse a selected binary under the binary's own crate name, with a unit test, in tag `v0.4.0-vscode.11`, which is pushed
- [x] `pin.env` names the tag, the development bundle is rebuilt, and ADR 0004 records the change
- [x] End-to-end tests run both views on the `named-bins` fixture's `src/bin/tool.rs` and its `bin` entry `exercises/string_kinds.rs`, which both got no output on the previous bundle

## Notes

- Reported 2026-11-17 ([#81](https://github.com/phamquy/aquascope-vscode-extension/issues/81)): Show Stack and Heap on a rustlings exercise (`exercises/09_strings/strings4.rs`) showed "Aquascope's output could not be read (no output)". Every file of a binary whose name differs from its package's is affected, in both views: a package's `src/bin/*.rs`, any `[[bin]]` with a `name` of its own, and every rustlings exercise, whose package is `exercises`. A package's `src/main.rs` works because its binary takes the package's name.
- Cause: for `--crate-of` on a binary, rustc_plugin 0.15.2 passes `--bin <name>` to Cargo but sets `SPECIFIC_CRATE` to the package's name, and its driver runs the plugin only on the compile whose `--crate-name` matches. rustc names a binary's crate after the binary, so no compile matched and Cargo exited 0 having only checked the crate. Renaming the package of a copy of rustlings to `strings4` gave the full 46-step trace.
- Fork: commit `4593db8`, branch `bin-crate-name`, [phamquy/aquascope#2](https://github.com/phamquy/aquascope/pull/2). The plugin's `modify_cargo`, which rustc_plugin calls after choosing the target, sets `SPECIFIC_CRATE` from the command's `--bin`. The proper fix is one line upstream in rustc_plugin. A library whose `[lib] name` differs from its package has the same mismatch and is not covered.
- Extension: new fixture `named-bins`, with no library and two binaries, `string-kinds` at `exercises/string_kinds.rs` and `tool` at `src/bin/tool.rs`. The two new tests in `crate.test.ts` and `stackHeapCrate.test.ts` fail on the 1.1.0 bundle with "output could not be read" and pass on the development bundle built from `4593db8`.
- Checks: `npm run typecheck`, `npm run lint` and `npm test` against the development bundle pass, with 257 passing and 2 pending (the process-kill tests that do not run on macOS). In the fork, `cargo fmt --check`, `cargo clippy -p aquascope -p aquascope_front -- -D warnings` and `cargo test -p aquascope -p aquascope_front` pass. The packaging script's strict run from the new pin was not done; the release workflow builds both packages from it.
