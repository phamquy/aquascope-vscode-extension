---
id: T-073
title: "Keep the diagrams when a slice starts inside its text"
status: done
priority: medium
feature: "007-stack-heap-diagrams"
created: 2026-11-17
---

# T-073 Keep the diagrams when a slice starts inside its text

Spec: [[specs/features/007-stack-heap-diagrams/spec.md]]

## Done when

- [x] The fork reads a `str` from the start of its allocation and counts a slice's length in elements, each with a snapshot test that shows the wrong position or panics without it, in tag `v0.4.0-vscode.12`, which is pushed
- [x] `pin.env` names the tag, the development bundle is rebuilt, and ADR 0004 records the change
- [x] The panel points any pointer whose element or slice end the renderer does not draw at its slice's first element or at the whole array, with unit tests, and the page reports what it drew only once the arrows are drawn
- [x] An end-to-end test with `l2_slice_inside.rs`, a `.trim()` slice of a 14-character literal and a slice of a temporary `String`, keeps every diagram, and fails on the previous bundle

## Notes

- Reported 2026-11-17 ([#83](https://github.com/phamquy/aquascope-vscode-extension/issues/83)): on rustlings' `strings4.rs`, Show Stack and Heap drew the diagrams for a moment and then left only the code with its step markers. The page logged "Could not find endpoint for pointer selector: heap-0-index-12". The renderer draws a slice as an arrow from its first to its last element, and an error while drawing the arrows removes every diagram of the trace.
- Three causes. (1) The fork read a `str` that a pointer reached first from the pointer's address, while the pointer's path counts from the allocation's start, so `"  hello there ".trim()` was `"hello there"` with `Subslice(2, 12)`. (2) The fork computed a slice's last index as its metadata divided by the element size, but the metadata is the number of elements, so minigrep's `&args`, three `String`s, became `Subslice(0, usize::MAX)`. (3) The interpreter shortens an array of more than 12 elements to its first 11 and its last, which the renderer labels index 100, so a slice into the middle of a long text has an end the renderer does not draw, whatever the interpreter does.
- Fork: commits `ec9c9ef`, `8880ee5` and `b14828d`, branch `str-from-allocation-start`, [phamquy/aquascope#3](https://github.com/phamquy/aquascope/pull/3). New snapshot tests `str-slice-inside.test` and `slice-of-values.test`. The first commit alone broke feature 009's AC9: `itoa` returns a `&str` at the end of a buffer of unwritten bytes, and reading from the allocation's start reached one and panicked, so `b14828d` keeps such bytes as `Unallocated`.
- Extension: `traceInput.ts` points each pointer whose element or slice end the renderer does not draw at its slice's first element, without the extent, when that is drawn, and otherwise at the whole array; the trace the command returns is unchanged. `media/panel.js` waits 300 ms after the diagrams appear before reporting a trace, so a page that loses them reports it. A minigrep run had 16 slices the renderer could not draw before the fork changes and 9 after, all slices into the middle of the poem's text, which the panel now redirects.
- Checks: `npm run typecheck`, `npm run lint` and `npm test` against the development bundle built from `b14828d` pass, with 261 passing and 2 pending (the process-kill tests that do not run on macOS). The new end-to-end test fails on the bundle without the extension's change, with the renderer's error and no diagrams left; the unit tests fail without it by construction. In the fork, `cargo fmt --check`, `cargo clippy -p aquascope -p aquascope_front -- -D warnings` and `cargo test -p aquascope -p aquascope_front` pass.
- Found on the way, not fixed: after a run falls back to running a binary without its library (feature 009's plan), the library's compiled metadata is left in the interpreter's build folder, and Cargo then skips the library in later one-crate runs, which print nothing, until the library's source changes. rustc_plugin removes such metadata before analysing a library, but from `debug/deps`, while the interpreter builds for the host triple into `<triple>/debug/deps`. It showed here because an intermediate fork build panicked and triggered the fallback in the test instance's copy of `with-dep`.
