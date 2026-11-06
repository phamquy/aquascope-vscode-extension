---
id: 002-toolchain-bundling-spike
title: Toolchain bundling spike
status: implemented
---

# Toolchain bundling spike

## Why

ADR 0002 decides to bundle `cargo-aquascope` and a pinned minimal nightly toolchain in a per-platform VSIX, so users install nothing by hand. That decision rests on reading Aquascope's source, not on running it. This spike proves or disproves it and measures the cost before any feature depends on it. The output is a written finding, not shipped code.

## Questions to answer

- Q1: Does `cargo-aquascope` built with `rustc-dev` run, for the permissions analysis, against a sysroot that has only rustc, cargo and rust-std (no `rustc-dev`, no `miri`, no `rust-src`)?
- Q2: Can it run with no rustup and nothing on the user's `PATH`, with the bundled `cargo` and `rustc` invoked by absolute path and the library path set by the extension?
- Q3: What is the unpacked and compressed size of the bundle on one platform?
- Q4: Which platforms can we build for (macOS arm64 and x64, Linux x64 and arm64, Windows x64), and what does CI need for each?
- Q5: Does a user crate with dependencies work, and what network access does it need?
- Q6: Is the TypeScript frontend (`frontend/packages/aquascope-embed`) usable outside Aquascope's own build, and how is it built and vendored?
- Q7: What are the Marketplace size limits for a platform-specific VSIX?

## Requirements

- R1: Use the Aquascope tag and nightly that we intend to pin; record both.
- R2: Test on a clean environment with no rustup toolchain on `PATH`.
- R3: Use at least the book's ownership examples and one small crate with a dependency as inputs.
- R4: Run only the permissions analysis; the interpreter mode and Miri are out of scope.

## Acceptance criteria

- [x] A finding document in `docs/spikes/002-toolchain-bundling.md` answers Q1 to Q7 with evidence (commands run, output, sizes).
- [x] A clear verdict: bundling works as designed, works with changes, or does not work.
- [x] If it works, the exact list of files that make up the minimal bundle, with sizes.
- [x] ADR 0002 is updated or superseded to match the verdict.
- [x] `specs/product.md` Risks and open questions is updated with what is now known.

## Out of scope

- Writing the extension code that invokes the bundle (feature 003).
- Rendering the visualization (feature 004).
- CI and publishing pipelines beyond noting what each platform needs.

## Open questions

- Which Aquascope tag to pin: `main` (nightly-2026-05-01) or the latest release tag v0.4.0?
