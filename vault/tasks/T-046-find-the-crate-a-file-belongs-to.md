---
id: T-046
title: "Find the crate a file belongs to"
status: review
priority: medium
feature: "008-whole-crate-analysis"
created: 2026-11-09
---

# T-046 Find the crate a file belongs to

Spec: [[specs/features/008-whole-crate-analysis/spec.md]]

## Done when

- [x] `project.ts` reads the workspace root, the package and target holding the file, external path dependencies and the copy root from the bundled `cargo metadata`
- [x] A file in no package goes to feature 003's analysis
- [x] `build.rs` is flagged as unsupported, while files under `tests/`, `examples/` and `benches/` go to the crate run (D7, revised)
- [x] Unit tests cover these from captured metadata

## Notes

- Plan: [[specs/features/008-whole-crate-analysis/plan.md]].
- Done on 2026-11-09. `src/analysis/project.ts`: `locateCrate` runs the bundled `cargo metadata --no-deps --offline --format-version 1` in the file's folder, and `locateInMetadata`, a pure function, finds the file in the result. It returns `crate` (workspace root, package, target, the file's path relative to the workspace root with `/` as Aquascope's `file_path` spells it, external path dependencies, copy root and copy folders), `none`, `buildScript`, `metadataFailed` or `runFailed`. T-048 wires it into the command and T-049 gives the failures their messages.
- The target is chosen by rustc_plugin's rule in `only_run_on_file`, so the extension and `--crate-of` agree: of the targets whose source folder holds the file, the one named like it, else a binary in a package without a library, else the binary for `main.rs` and the library for other files. A file held by targets of two packages is `none`, where rustc_plugin would stop. cargo's ``could not find `Cargo.toml` `` is `none`; any other failure is `metadataFailed`.
- cargo reports real paths, so the file's real path is matched: `os.tmpdir()` on macOS is under `/var`, a link to `/private/var`, and the end-to-end test spells the file that way.
- Refinement of the plan: besides the copy root, the module returns the folders to copy below it, the workspace root and each external path dependency. Copying the whole copy root would copy the whole home folder for a project and a library side by side in it; copying the folders keeps `path = "../shared"` valid. The plan and T-047 say so now. Only direct path dependencies of the workspace's members are seen, since `--no-deps` lists no other package; a path dependency of an external path dependency is not copied, and its build fails in the copy.
- Tests: `project.test.ts`, nine unit tests from T-044's captured metadata (minigrep's module, binary, library and test; the targets fixture's test, example, bench and build script; a workspace member; an external path dependency; a crates.io dependency; files in no target or outside the workspace; a binaries-only package; two packages holding a file; cargo's failures), and two against the bundled cargo (a module through a linked folder; a file in no package and a broken manifest). 149 passing.
