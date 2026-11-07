# Product

<!-- Sections marked SAMPLE contain example text showing how to write them. Replace each with your own words and delete the marker. Facts about Aquascope are assumptions to verify against its repo. -->

## Summary

<!-- SAMPLE -->

Aquascope for VS Code brings the ownership and permission diagrams from the Rust Book's experiment edition into the editor. It runs the Aquascope analysis on the user's own code and shows the result in a panel beside the source.

## Problem

For developer who learning Rust, one of the most important also difficult aspect are to understand the owership in Rust. A good grasp of this would allow developer to interrpret Rust compiler error, and honestly less scare of the language. The [Rust experiment-book](https://rust-book.cs.brown.edu/experiment-intro.html) doing a good job of illustrating the onwership and ownership transfer using a tool called [aquascope](https://github.com/cognitive-engineering-lab/aquascope). Aquascope is only availble through a mdBook plugin, and a [web application](https://cel.cs.brown.edu/aquascope/). For developer who write Rust code in vscode (or other IDE), when they want to quickly check the ownership transfer of code, they dont have a good tool like Aquascope to do so.

This VSCode extension project aim to fill that gap. The goal is to build vscode extension that use aquascope underneath and generate visualisation (similar to what we see in Rust experiement-book or from web-application)

## Target users

<!-- SAMPLE -->

- Primary: people learning Rust, especially those working through the Rust Book, who get borrow-checker errors they can't interpret.
- Secondary: working Rust developers who want to check an ownership question quickly without leaving VS Code.

## Goals

Ranked, most important first. Use the order to resolve trade-offs. Keep each goal to one line; detailed user stories belong in the feature specs.

- An vscode extension as a rust programmer's tool to visualize the ownership and how it transfered across statement call.

<!-- SAMPLE additional goals -->

1. Show ownership and permissions for a chosen function without leaving the editor.
2. Work on the user's own crates, not only the book's examples.
3. Install and run with minimal setup.
4. Keep the editor responsive while the analysis runs.

## Non-goals

<!-- SAMPLE -->

- Not a replacement for rust-analyzer or the compiler's own diagnostics.
- No support for editors other than VS Code.
- No automatic fixing of ownership errors.
- No hosted or cloud analysis service.

## Architecture overview

<!-- SAMPLE -->

Aquascope is a rustc plugin (`aquascope_front`, installed as the `cargo-aquascope` binary) that reads the borrow checker's Polonius facts and computes permissions. The mdBook preprocessor runs `cargo aquascope <operation>` as a child process and parses its JSON from stdout; the extension can do the same. The diagrams are rendered by Aquascope's TypeScript frontend (CodeMirror 6 decorations, in `frontend/packages/aquascope-embed`), which a VS Code webview would host. The extension itself only coordinates: it finds the toolchain, runs the command, and passes results to the webview.

```text
Editor command -> Extension host -> cargo aquascope (child process) -> JSON -> Webview
```

## Constraints and dependencies

<!-- SAMPLE -->

- Pinned to Aquascope v0.4.0 and `nightly-2026-05-01` (from that tag's `rust-toolchain.toml`). Building `cargo-aquascope` needs that nightly with `rustc-dev`; running it needs only the nightly's rustc, cargo and rust-std (spike 002).
- `cargo-aquascope` is not on crates.io; the packaging script builds it from the git tag on a machine of each platform (feature 005), and CI is to run that script once more platforms are packaged.
- VS Code 1.90 or newer.
- Platforms in order: darwin-arm64 (verified), linux-x64, win32-x64, then linux-arm64 and darwin-x64. Only darwin-arm64 has been run.
- Zero install: the extension bundles `cargo-aquascope` and a trimmed nightly toolchain, one VSIX per platform (about 120 MB on darwin-arm64). Users need no rustup and nothing on their `PATH`.
- Exceptions to zero install: crates whose dependencies have build scripts or proc macros need a system C linker, and the first analysis of a crate with dependencies needs the network unless they are already in the user's cargo cache.

## Success criteria

- A working vscode extension

<!-- SAMPLE measurable criteria -->

- On the book's example programs, the first visualization appears in under 10 seconds on a typical laptop.
- The extension renders correctly for the three sample crates in `fixtures/`.
- A new user gets from install to first diagram in under 5 minutes, following the README.

## Glossary

<!-- SAMPLE -->

| Term               | Meaning                                                                 |
| ------------------ | ----------------------------------------------------------------------- |
| Permission         | The read, write or own right a variable holds at a point in the program |
| Program point      | A location in the code where permissions are shown                      |
| Ownership transfer | A move of a value from one variable to another                          |

## Risks and open questions

<!-- SAMPLE -->

- Aquascope has no stable public API, so upgrades may break the integration.
- The pinned nightly can conflict with the user's own toolchain. Do we install it for them?
- Licence is MIT, so bundling its frontend is permitted with attribution. The built frontend (`embed.iife.js`, `style.css`) can be vendored from the `mdbook-aquascope` crate; no frontend build is needed.
- The extension must upgrade the Aquascope tag and the nightly together; each upgrade means rebuilding every platform package.
- Marketplace package size limit is undocumented and the package is about 120 MB per platform. Must be checked with a test publish before release; the fallback is downloading the toolchain on first run.
- Windows and Linux are unverified; Aquascope upstream only tests Linux. Flowistry (same framework) ships Linux, macOS and Windows x86_64.
- macOS Gatekeeper may block the unsigned bundled binaries after install. Checked for darwin-arm64 in feature 005: a browser-downloaded VSIX installed on an account without rustup, offline, ran with no security dialog. Other platforms are untested.
- Aquascope's output order is not stable between runs, so tests and rendering must not depend on it.
- Answered by spike 002 ([findings](../docs/spikes/002-toolchain-bundling.md)): bundling works without `rustc-dev`, Miri, `rust-src` or rustup; the extension must set `PATH` and the library path.

## Feature index

| ID  | Feature                                       | Status      |
| --- | --------------------------------------------- | ----------- |
| 001 | Bootstrap extension                           | implemented |
| 002 | Toolchain bundling spike                      | implemented |
| 003 | Run analysis on the function at the cursor    | implemented |
| 004 | Render the visualization in a webview         | implemented |
| 005 | Package per-platform VSIX with toolchain      | implemented |
| 006 | Analyze from a button in the editor title bar | approved    |
