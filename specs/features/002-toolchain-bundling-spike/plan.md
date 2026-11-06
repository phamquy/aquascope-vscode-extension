---
feature: 002-toolchain-bundling-spike
---

# Plan

## Approach

The spike works in two passes against the same inputs. First it builds `cargo-aquascope` normally and runs it with the full rustup toolchain to get a baseline. Then it runs the same binary against a hand-assembled minimal toolchain with a scrubbed environment, and compares the JSON output with the baseline. If the outputs match, the minimal bundle is sufficient; if not, the failures say which component is missing. This baseline-then-strip approach gives a yes/no answer to Q1 and Q2 with evidence, instead of reasoning from the source.

The pinned version is chosen first, because every later step depends on it. The default is the latest release tag, v0.4.0, with the nightly from that tag's `rust-toolchain.toml`. `main` is the fallback only if v0.4.0 does not build.

The minimal toolchain is assembled from the official component tarballs for the pinned nightly (`rustc`, `cargo`, `rust-std` for the host) from `static.rust-lang.org`, installed into a plain directory with their own `install.sh`. It is not copied from `~/.rustup`, so the bundle contains exactly what we would ship.

The run mirrors how the mdBook preprocessor drives Aquascope (`crates/mdbook-aquascope/src/preprocessor.rs`): `cargo aquascope [--should-fail] permissions [--show-flows]` in a crate directory, with `DYLD_LIBRARY_PATH` / `LD_LIBRARY_PATH` set to the toolchain's target libdir. The preprocessor also sets `SYSROOT` and `MIRI_SYSROOT` to the Miri sysroot even for the permissions analysis, so the spike tests whether `SYSROOT` can point at the minimal toolchain instead. In the stripped run, everything is invoked by absolute path under `env -i`, with only the variables we set, so nothing leaks in from rustup or the user's `PATH`.

Only macOS arm64 is built and run locally. The other platforms (Q4) are answered from the nightly's component manifest, which lists `rustc-dev` availability per target, and from what Aquascope and `rustc_plugin` support. Q6 and Q7 are desk research plus a trial frontend build.

## VS Code APIs and contribution points

None. This spike ships no extension code.

## Files touched

- `spikes/002-toolchain-bundling/` committed scripts that reproduce each step (`build.sh`, `assemble-toolchain.sh`, `run.sh`, `compare.sh`) and the input crates under `fixtures/`
- `spikes/002-toolchain-bundling/work/` build output, toolchains and JSON results (gitignored)
- `docs/spikes/002-toolchain-bundling.md` the findings document
- `docs/adr/0002-bundle-toolchain-per-platform.md` updated or superseded to match the verdict
- `specs/product.md` Risks and open questions updated
- `.gitignore` adds the spike work directory

## Risks

- Building Aquascope runs third-party code and was blocked by the permission check earlier in this project. The build step needs your explicit approval.
- Disk and time: the build needs several GB and several minutes. The pinned nightly `nightly-2026-05-01` is already installed in `~/.rustup` (2.4 GB); a different pin adds another.
- v0.4.0 may pin a different nightly than `main`, which means one more toolchain download.
- Aquascope's CI only runs on Ubuntu, so a local macOS build may hit problems upstream never sees. If it fails, the fallback is a Linux container run, and that becomes a finding.
- The minimal toolchain may fail for reasons unrelated to bundling (for example, a missing `rust-src` for std MIR). Each failure is recorded with the component that fixes it.

## Test strategy

The check is a diff. For every fixture, the stripped-toolchain JSON must equal the baseline JSON. Fixtures are a handful of Rust Book ownership examples (including one that is expected to fail borrow-checking, run with `--should-fail`) and one small crate with a single crates.io dependency. The dependency crate is run twice: once with an empty, isolated `CARGO_HOME` to record what network access is needed, and once with `--offline` after the cache is warm.
