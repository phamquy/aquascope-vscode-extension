# 0002. Bundle the Aquascope toolchain in per-platform VSIX packages

- Status: accepted
- Date: 2026-11-05

## Context

Aquascope is a rustc plugin. It runs `cargo check` on the user's project with its own compiler driver, so it needs a pinned nightly `cargo` and `rustc` plus the compiler's shared libraries. Building it needs the `rustc-dev` component; running it probably does not. The interpreter mode additionally needs a Miri sysroot, which the ownership and permissions analysis does not use. These points come from reading the Aquascope source and are not yet verified by running it.

The goal is that users install only the extension and nothing else on their machine.

## Decision

Ship everything inside the extension: a prebuilt `cargo-aquascope` binary and a minimal pinned nightly toolchain (rustc, cargo, rust-std). Publish one platform-specific VSIX per target platform (`vsce package --target ...`). The extension runs the bundled `cargo` and `rustc` directly and never touches the user's own toolchain.

Alternatives considered:

- Downloading the minimal nightly on first run: smaller package but needs the network and a checksummed download path.
- Requiring the user's rustup: simplest, but violates the zero-install goal.

## Consequences

- The package is large (it carries a compiler): about 120 MB per platform as a VSIX, measured on darwin-arm64 after trimming. The Marketplace size limit is undocumented and must be confirmed with a test publish; if the package is too large, fall back to downloading the toolchain on first run.
- CI must build `cargo-aquascope` with `rustc-dev` for each platform, and every Aquascope or nightly upgrade means rebuilding and republishing all platform packages.
- Platform support depends on what we can build. Only darwin-arm64 has been run; Windows and Linux are unverified.
- The user's code must compile on the pinned nightly.
- "Install nothing" has two exceptions: crates whose dependencies have build scripts or proc macros need a system C linker, and the first analysis of a crate with dependencies needs the network unless the user's cargo cache already has them.

## Validation (spike 002, 2026-11-05)

Spike 002 confirmed the decision on darwin-arm64; the evidence is in [docs/spikes/002-toolchain-bundling.md](../spikes/002-toolchain-bundling.md). A `cargo-aquascope` built from v0.4.0 produced the same permissions analysis as a full rustup toolchain on all seven test programs while running against only the rustc, cargo and rust-std components, in an environment with nothing set except `PATH` (the bundle's `bin` and the toolchain's `bin` first) and `DYLD_LIBRARY_PATH` (the toolchain's `lib`). `rustc-dev`, Miri, `rust-src` and rustup are needed only at build time. Removing linkers, docs, `rustdoc` and sanitizer runtimes, none of which `cargo check` uses on macOS, brings the bundle to 370 MB unpacked and 120 MB zipped with identical results. On Linux, `rust-lld` may have to stay because nightly uses it as the default linker.
