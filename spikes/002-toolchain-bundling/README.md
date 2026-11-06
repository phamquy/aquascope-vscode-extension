# Spike 002: toolchain bundling

Scripts and fixtures that reproduce the spike in [specs/features/002-toolchain-bundling-spike](../../specs/features/002-toolchain-bundling-spike/spec.md). Findings are in [docs/spikes/002-toolchain-bundling.md](../../docs/spikes/002-toolchain-bundling.md).

`pin.env` holds the pinned Aquascope tag and nightly. Build output, toolchains and results go in `work/`, which is gitignored. The scripts assume macOS (they set `DYLD_LIBRARY_PATH`) and an installed rustup with the pinned nightly.

Run in this order from the repository root:

1. `./spikes/002-toolchain-bundling/build.sh` builds `cargo-aquascope` and `aquascope-driver` into `work/install/bin` (log in `work/build.log`).
2. `./spikes/002-toolchain-bundling/run.sh baseline` runs every fixture with the full rustup toolchain.
3. `./spikes/002-toolchain-bundling/assemble-toolchain.sh` copies the rustc, cargo and rust-std components into `work/toolchain-minimal`.
4. `./spikes/002-toolchain-bundling/run.sh minimal` then `./spikes/002-toolchain-bundling/compare.sh` runs the fixtures in a scrubbed environment and compares them with the baseline.
5. `./spikes/002-toolchain-bundling/probe-env.sh` shows which environment variables are required.
6. `./spikes/002-toolchain-bundling/dep-network.sh` tests the cargo cache, offline use and the linker requirement.
7. `./spikes/002-toolchain-bundling/measure-bundle.sh` builds `work/toolchain-trimmed` and measures both bundles; verify it with `run.sh trimmed` and `compare.sh baseline trimmed`.

`compare.sh` treats outputs that are equal once every list is sorted as `REORDERED`, not as a failure, because Aquascope does not emit step tables in a stable order.

Temporary crates are staged with `mktemp` outside `$HOME` and are left for the OS to clean up.
