---
id: T-076
title: "Draw references into an enum's payload"
status: review
priority: medium
feature: "007-stack-heap-diagrams"
created: 2026-11-17
---

# T-076 Draw references into an enum's payload

Spec: [[specs/features/007-stack-heap-diagrams/spec.md]]

## Done when

- [x] The fork locates a pointer in an enum's active variant and finds every field of a struct, tuple or variant at its offset in the layout, with snapshot tests that panic without the change, in tag `v0.4.0-vscode.14`, which is pushed
- [x] The submodule `vendor/aquascope` is at that commit, `pin.env` names the tag and commit, the development bundle is rebuilt, and ADR 0004 records the change
- [x] An end-to-end test with `l3_option_ref.rs`, rustlings' options3 program, runs to its end with every step drawn, and fails with exit code 101 on the previous bundle

## Notes

- Reported 2026-11-17 ([#88](https://github.com/phamquy/aquascope-vscode-extension/issues/88)): Show Stack and Heap on rustlings' options3 failed with "Aquascope failed with exit code 101". The driver panicked at `miri_utils.rs:83`, the `todo!()` for enums in `AddressLocator::locate`, which walks the type a pointer points into to the field at its address. `Option<Point>` keeps its tag before the `Point`, so a reference to the `Point` points 4 bytes in. The permissions view was unaffected.
- A test confirmed a second fault in the same walk: struct and tuple fields were found by adding up sizes in declaration order, but rustc reorders and pads fields, so `&m.a` in `struct Mixed { a: u8, b: u32, c: u8 }` panicked at `miri_utils.rs:121` ("offset != target").
- Fork: commit `7bad17e`, branch `locate-in-enum`, [phamquy/aquascope#5](https://github.com/phamquy/aquascope/pull/5), the first fork change made in the submodule. The locator keeps the allocation's start address, reads an enum's variant with `read_discriminant` and walks `layout.for_variant`'s fields; every field is found at `layout.fields.offset(i)`. The renderer labels a variant's fields by position, so paths need no new step. A pointer to a field at its value's very start still points at the whole value, as before.
- Extension: Aquascope does not show `p` itself, since the match arm has no step of its own; the end-to-end test checks the run reaches the last `println!`, with Point's derived `Debug` in a frame, and that every step is drawn. The fork's `enum-payload.test` snapshot has the pointer paths.
- Checks: `npm run typecheck`, `npm run lint` and `npm test` against the development bundle built from `7bad17e` by spike 002's `build.sh` pass, with 264 passing and 2 pending (the process-kill tests that do not run on macOS). The new end-to-end test fails on the 1.1.1 bundle with "Aquascope failed with exit code 101". In the fork, `cargo fmt --check`, `cargo clippy -p aquascope -p aquascope_front -- -D warnings` and `cargo test -p aquascope -p aquascope_front` pass, with no existing snapshot changed.
