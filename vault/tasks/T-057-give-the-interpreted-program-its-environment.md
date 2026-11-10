---
id: T-057
title: "Give the interpreted program its environment"
status: review
priority: medium
feature: "009-whole-crate-stack-heap"
created: 2026-11-10
---

# T-057 Give the interpreted program its environment

Spec: [[specs/features/009-whole-crate-stack-heap/spec.md]]

## Done when

- [x] The fork passes the host environment to Miri when isolation is lifted, with a test in Aquascope's suite; tag `v0.4.0-vscode.4` is pushed and the fix is added to upstream #203
- [x] `pin.env` names the tag, the development bundle is rebuilt and the bindings regenerated; ADR 0004 records the change
- [x] An end-to-end test fails on the previous bundle and passes on the new one: minigrep run with `IGNORE_CASE` set searches without case
- [x] The interpreter's build folder is kept per Miri library, so a library rebuilt at the same path is not mixed with crates built for the old one

## Notes
- Reported 2026-11-09: Show Stack and Heap on a todo CLI (`.tmp/todo-cli`) with the argument `list` said the program stopped with exit code 1, though `cargo run -- list` prints the list. A copy with a distinct code on each `process::exit` stopped at the first, `env::var_os("HOME")` being `None`: the program saw no environment. Cause: `MiriConfig::env`, the host snapshot Miri forwards when isolation is lifted, defaults to empty, and only Miri's own driver fills it; T-052's change lifted isolation without it. T-051's probe missed it because minigrep behaves the same without `IGNORE_CASE`. The user's `~/.todo` was not touched: the program stopped before any file access.
- Fix: the fork passes `std::env::vars_os()` as Miri's driver does (`edb5694`, tag `v0.4.0-vscode.4`; on #203's branch as `b5abc62`, with a comment on the PR). With it, the copy run with `list` succeeds in 18 steps.
- `stackHeapCrate.test.ts`: minigrep from `lib.rs` with `IGNORE_CASE` set must step through `search_case_insensitive`; it failed on the `v0.4.0-vscode.3` bundle (frames `main`, `run`, `search`) and passes on the new one. README: the program sees your environment variables. Spec D3's revision notes the correction. `npm test`: 219 passing.
- Packaging the fix failed AC4 and AC9 (`with-dep`, which uses `itoa`) with exit code 101: E0460, `itoa` built for another `core`. Packaging builds the bundle's Miri library anew each time, in a random `/tmp` folder, so its contents differ while its path and file names do not, and cargo, which does not fingerprint the sysroot, reused the `itoa` the previous packaging had built in the tests' project folder. Installing a rebuilt package of the same version would do the same to a user's projects. `interpreterTarget` now names the interpreter's build folder by the library's path and its core library's size and modification time, removes the folders of other libraries, and keeps the first-build mark inside it. Unit test in `crateTrace.test.ts`; `npm test`: 220 passing.
