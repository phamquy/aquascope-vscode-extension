---
id: 005-package-per-platform-vsix
title: Package per-platform VSIX with toolchain
status: draft
---
# Package per-platform VSIX with toolchain

## Why

The extension works today only for someone who has built spike 002's toolchain and pointed `aquascope.toolchainPath` at it. ADR 0002 decided that users install nothing but the extension: each platform gets its own VSIX that carries a prebuilt `cargo-aquascope` and a trimmed copy of the pinned nightly toolchain. Feature 003 already looks for that copy inside the extension when the setting is empty (003 R3). This feature produces those packages, so that installing one VSIX is enough to see the diagrams.

Spike 002 settled how the bundle is made, and features 003 and 004 narrowed what it must do. A `cargo-aquascope` built from the pinned Aquascope tag runs against only the `rustc`, `cargo` and `rust-std` components. With the tools `cargo check` never uses removed, the bundle measured 370 MB unpacked and 120 MB as a VSIX on darwin-arm64. Every target platform publishes the components it needs. The spike's two exceptions to "install nothing", a system linker and the network for dependencies, do not arise in this version: feature 003 analyses one file at a time in a crate with no dependencies, offline, and `cargo check` of such a crate links nothing. The evidence is in Appendix A.

The spike's trimming, however, deleted the toolchain's `share/` folder, which holds the Rust licence files. Shipping `rustc` and `cargo` requires shipping their licences, so the trimmed bundle must keep them, together with Aquascope's licence and a notice for the libraries inside the vendored frontend, which feature 004 deferred to packaging.

The first version is deliberately narrow (D1 to D3): it packages darwin-arm64, the one platform already built and run, with a script run on a Mac, and hands out VSIX files. The script is written so that a CI job, and later platforms, can reuse it unchanged.

## Decisions

Recorded on 2026-11-06 from the draft's open questions.

- D1 (was Q1): The first version packages darwin-arm64 only. linux-x64 comes next; Windows needs a dedicated check first, because feature 003's Windows code paths (`taskkill`, `.exe` names, `PATH` as the library path) have never run.
- D2 (was Q2): Packages are built by a local script on a machine of the target platform, the maintainer's Mac for darwin-arm64. It takes everything from the pin and the repository, so that a CI job can run it unchanged when more platforms arrive.
- D3 (was Q3): Packages reach users as VSIX files, installed with "Extensions: Install from VSIX…". Publishing to the Marketplace, with its undocumented size limit, is a later feature.

### User stories

- As a Rust learner, I want to install the extension and analyse a function straight away, so that I do not have to build or configure a toolchain.
- As the maintainer, I want one command to build, test and package the extension for a platform from the pinned versions, so that a release is repeatable and every package is tested with exactly what it ships.

## Requirements

- R1: A packaging script builds the VSIX for the platform it runs on from the pinned versions (Aquascope tag and nightly in `spikes/002-toolchain-bundling/pin.env`). It builds `cargo-aquascope` and `aquascope-driver` at the pinned tag, assembles the minimal toolchain from the `rustc`, `cargo` and `rust-std` components, trims it as spike 002 did, places both under `aquascope/` in the layout of 003 R3 (`aquascope/bin/`, `aquascope/toolchain/`), and runs `vsce package --target <platform>`. In this version it supports darwin-arm64 and stops with a message on any other platform (D1). It stops with a clear message if the pin and the checkout or toolchain disagree.
- R2: The package carries only what a run needs: the two Aquascope binaries and the trimmed toolchain. It carries no `rustc-dev`, Miri, `rust-src`, rustup, linkers or documentation beyond the licence files, and it carries real files, not the symbolic links of the development bundle.
- R3: The package includes the licence notices for everything it redistributes: the Rust toolchain's licence files for `rustc`, `cargo` and the standard library, Aquascope's MIT licence for its binaries, and a notice for the third-party libraries bundled in the vendored embed (feature 004, T-023).
- R4: Before a package is written, the extension's full test suite runs against the assembled bundle (`AQUASCOPE_TEST_TOOLCHAIN`), and a failing suite stops the script, so that each package has passed the tests with exactly what it ships.
- R5: An installed package analyses a function with no setting and nothing else installed: with `aquascope.toolchainPath` empty and no Rust toolchain on the machine's `PATH`, the command finds the bundled tools (003 R3) and the panel draws the diagram. Installing keeps the binaries executable.
- R6: The package never downloads anything at install or run time (constitution 6); the toolchain is entirely inside it.
- R7: The script reports the package's size, and the README describes how to build a package and how to install it from the VSIX file (D3).

## Acceptance criteria

- [ ] AC1: On darwin-arm64, the packaging script produces a VSIX whose manifest targets `darwin-arm64` and which contains `aquascope/bin/cargo-aquascope`, `aquascope/bin/aquascope-driver` and `aquascope/toolchain/`, and none of `rustc-dev`, Miri, `rust-src` or `rust-lld`.
- [ ] AC2: The darwin-arm64 VSIX is at most 150 MB.
- [ ] AC3: The VSIX contains the Rust licence files, Aquascope's licence and the embed's third-party notice.
- [ ] AC4: The script runs the full test suite against the assembled bundle before packaging, and a deliberately failing test stops it before a VSIX is written.
- [ ] AC5: Installed into a fresh VS Code profile on a machine where `rustc` and `cargo` are not on `PATH`, with `aquascope.toolchainPath` empty, the darwin-arm64 VSIX draws the diagram for `main` of `05_method_mut_borrow` (checked by hand), and macOS does not block the bundled binaries.
- [ ] AC6: With the pin changed to a different Aquascope commit than the checkout, the script stops before building and says why.

## Out of scope

- Downloading the toolchain on first run instead of bundling it (ADR 0002's fallback, only if a size limit forces it).
- Code signing and notarisation of the bundled binaries.
- Analysing crates with dependencies, and the linker and network needs that would bring.
- Updating the toolchain separately from the extension; every Aquascope or nightly upgrade is a new package.
- A universal package without a toolchain.
- Platforms other than darwin-arm64 (D1), building in CI (D2), and publishing to the Marketplace or Open VSX (D3).

## Open questions

None; Q1 to Q3 are settled as D1 to D3.

## Appendix A: evidence this spec relies on

| Fact | Source |
| --- | --- |
| `cargo-aquascope` runs against only `rustc`, `cargo` and `rust-std`, with no `rustc-dev`, Miri, `rust-src` or rustup | Spike 002, Q1 and Q2; ADR 0002 validation |
| Trimmed bundle: 370 MB unpacked, 120 MB as a VSIX on darwin-arm64; the compiler library alone is 193 MB | Spike 002, Q3 and Appendix E |
| Every target platform publishes `rustc`, `cargo`, `rust-std` and `rustc-dev` for the pinned nightly; download sizes are within 15% of darwin-arm64's | Spike 002, Q4 and Appendix G |
| A system linker is needed only for dependencies with build scripts or proc macros; the network only for a first fetch of dependencies | Spike 002, Q5 and Appendix F |
| Feature 003 analyses one file in a temporary crate with no dependencies, offline, under `cargo check` | 003 spec, R2 and R5 |
| The bundled location is `<extension>/aquascope/` with `bin/` and `toolchain/`, used when `aquascope.toolchainPath` is empty | 003 R3, `src/analysis/toolchain.ts` |
| The spike's trimming excludes `share/`, which holds `share/doc/cargo/LICENSE-*` and `share/doc/rust/licenses/` | `spikes/002-toolchain-bundling/measure-bundle.sh`, `work/toolchain-minimal/share/doc/` |
| The trimmed toolchain has no symbolic links; the development bundle (`npm run dev-bundle`) is made of symbolic links | `find work/toolchain-trimmed -type l`, `scripts/dev-bundle.mjs` |
| The vendored embed bundles React, CodeMirror 6, lodash, Floating UI, Leader Line with Modernizr, and Font Awesome; a full third-party notice was left to packaging | `media/aquascope-embed/README.md`, T-023 |
| Flowistry, built on the same `rustc_plugin` framework and nightly, ships x86_64 Linux, macOS and Windows; its ARM builds were disabled after cross-compiling problems | Spike 002, Appendix H |
| The Marketplace's package size limit is undocumented; Open VSX reports 256 MB | Spike 002, Q7 and Appendix J |
