# Spike 002: toolchain bundling findings

Status: complete (2026-11-05). Spec: [002-toolchain-bundling-spike](../../specs/features/002-toolchain-bundling-spike/spec.md). Reproduction scripts: [spikes/002-toolchain-bundling](../../spikes/002-toolchain-bundling/README.md).

## Verdict

Bundling works, with changes. A `cargo-aquascope` built against the pinned nightly produced the same permissions analysis as a full rustup installation on every test program, while running against a minimal toolchain of only rustc, cargo and the standard library, with no rustup, no `rustc-dev`, no Miri and no `rust-src`, in an environment scrubbed of everything except two variables. After removing files that `cargo check` never uses, the bundle is 370 MB unpacked and 120 MB as a zip on darwin-arm64. The design in ADR 0002 therefore holds, but "users install nothing" needs two qualifications: crates whose dependencies include build scripts or proc macros need a system C linker, and the first analysis of a crate with dependencies needs the network or an existing cargo cache. The largest remaining risk is not technical: the VS Code Marketplace does not document a package size limit, and a 120 MB per-platform package must be checked against it before feature work depends on this design.

## What was tested

The spike pinned Aquascope v0.4.0 with `nightly-2026-05-01`, built `cargo-aquascope` on macOS arm64, and ran its permissions analysis on seven fixtures in three configurations: the full rustup toolchain as a baseline, a minimal toolchain assembled from only the rustc, cargo and rust-std components, and a trimmed version of that minimal toolchain. The fixtures are five Rust Book ownership programs, one of which is expected to fail borrow checking, plus a crate with a crates.io dependency and a crate whose dependency uses a derive macro and a build script. Outputs were compared as parsed JSON. The pin and its rationale are in Appendix A, and the fixtures and commands in Appendix B.

## Q1 and Q2: does it run without rustc-dev and without rustup?

Yes. All seven fixtures succeeded against the minimal toolchain under `env -i`, and their outputs matched the baseline. Five were byte-identical after parsing; two differed only in the order of places within a step table, and the baseline itself reorders the same way between two runs of the same input, so that difference comes from Aquascope, not from the toolchain (Appendix C). `rustc-dev` is needed only to build `cargo-aquascope`; at run time the binaries need the compiler's shared library, and the `rustc` component already ships it in `lib/`. The copy in the target libdir, which Flowistry and the mdBook preprocessor point their library path at, belongs to `rustc-dev`, which is why those tools appear to need it.

The environment the extension must provide is small. Probing one variable at a time showed that only two are required on macOS: `PATH` must start with the directory holding `cargo-aquascope` and the toolchain's `bin`, because `cargo-aquascope` finds `cargo` (and cargo finds `rustc`) by name; and `DYLD_LIBRARY_PATH` must point at the toolchain's `lib`, because the binaries load `@rpath/librustc_driver-*.dylib` but carry no rpath of their own. `SYSROOT` is not needed, since the driver falls back to asking the bundled `rustc`, and `HOME` and `CARGO_HOME` only decide where the download cache lives (Appendix D). Adding an rpath to the binaries at packaging time with `install_name_tool` (macOS) or `patchelf` (Linux) would remove the library-path variable; that was not tested.

## Q3: how big is the bundle?

The minimal toolchain plus the two Aquascope binaries is 545 MB unpacked and 170 MB zipped. Most of the excess is tooling that `cargo check` never touches: `rust-lld` and the other linkers (136 MB), documentation, `rustdoc`, the sanitizer runtimes and the rust-analyzer proc-macro server. Removing them gives 370 MB unpacked and 120 MB zipped, and the trimmed toolchain passed all seven fixtures with the same results. Almost all of what remains is irreducible without rebuilding the compiler: the compiler library is 193 MB, the standard library about 140 MB and cargo 30 MB, while the Aquascope binaries add under 9 MB. The full breakdown is in Appendix E. Other platforms should land close to this, because the official download sizes of the same components are within 15% of darwin-arm64's (Appendix G); on Linux, `rust-lld` may need to stay, because nightly Linux toolchains use it as the default linker.

## Q5: crates with dependencies

A crate with dependencies works offline once its dependencies are in the cargo cache, and the first analysis fetches only what it needs (two index entries and one 164 KB archive for the test crate, from an empty cache). From an empty cache with the network off, the analysis fails because cargo cannot resolve the dependency. Separately, any dependency with a build script or proc macro has to be compiled and linked, which needs a system C linker: with `cc` removed from `PATH`, the derive-macro crate failed with "linker `cc` not found", while the plain-dependency crate still worked (Appendix F). In practice the extension's users already compile Rust, so they have a linker and a populated cargo cache, and the extension should point `CARGO_HOME` at the user's existing cache rather than an isolated one. On Windows the linker is MSVC's `link.exe`, which comes with Visual Studio Build Tools; that was not tested.

## Q4: platform support

No target platform is ruled out by missing toolchain components. The official manifest for `nightly-2026-05-01` publishes every component used here, plus `rustc-dev` for building, for all six candidate targets (Appendix G). Only darwin-arm64 was built and run in this spike. Aquascope itself is only built and tested on Linux upstream, so the strongest evidence for other platforms is Flowistry, the same lab's VS Code extension built on the same `rustc_plugin` framework and pinned to the same nightly, which ships x86_64 binaries for Linux, macOS and Windows. Flowistry disabled ARM builds because cross-compiling compiler plugins from x86 CI runners produced wrong library paths; building natively on ARM runners avoids that, but has not been tried (Appendix H). The recommended CI order is darwin-arm64, linux-x64, win32-x64, then linux-arm64 and darwin-x64, with one native build job per platform.

## Q6: frontend

The frontend does not need to be built. The `@aquascope/*` npm packages are not published, but the `mdbook-aquascope` 0.4.0 crate on crates.io contains the built `embed.iife.js` and `style.css`. That script renders every `div.aquascope-embed` element from `data-` attributes holding the code and the JSON that `cargo aquascope` prints, which is the output this spike produced. The webview can vendor those two MIT-licensed files from the crate matching the pinned tag and generate the same markup as the mdBook preprocessor (Appendix I). Content security policy and some mdBook-specific behaviour in the script remain to be checked in feature 004.

## Q7: Marketplace size limits

The VS Code Marketplace's maximum package size is not documented. Microsoft's publishing guide covers platform-specific packages but states no limit, the 25 MB and 50 MB figures that searches return belong to the Azure DevOps Marketplace, and Open VSX reports a 256 MB threshold (Appendix J). With a 120 MB package per platform, this is the open question that most affects ADR 0002. It can be settled by publishing a large test package under a test publisher. If the limit is below the bundle size, the fallback is to ship the Aquascope binaries in the package and download the minimal toolchain on first run, which the same scripts already assemble.

## Consequences for the next features

Feature 003, which runs the analysis, should spawn `cargo aquascope permissions` in the user's crate with the bundle's `bin` and the toolchain's `bin` at the front of `PATH`, `DYLD_LIBRARY_PATH` (macOS), `LD_LIBRARY_PATH` (Linux) or `PATH` (Windows) pointing at the toolchain's `lib` or `bin`, and the user's own `CARGO_HOME`. It must report a missing linker and a missing network on first use as clear, actionable errors, and treat output order as unstable when testing. Feature 004 can vendor the frontend from the crate. Packaging needs a CI job per platform that builds `cargo-aquascope`, assembles and trims the toolchain from the component manifests, and runs `vsce package --target`. Two items are untested and should be checked before release: whether macOS Gatekeeper blocks the unsigned bundled binaries after the extension is installed, and the Windows run.

## Appendix A: pin

| Item | Value |
| --- | --- |
| Repository | https://github.com/cognitive-engineering-lab/aquascope |
| Tag | v0.4.0 (latest; same commit as `main` on 2026-11-05) |
| Commit | f2d0a06034b86765a91f10b7c8e40ec31ecb87a6, 2026-05-03, "v0.4.0 (#186)" |
| Nightly (`rust-toolchain.toml`) | nightly-2026-05-01 (rustc 1.97.0-nightly f53b654a8 2026-04-30) |
| Build components | rust-src, rustc-dev, llvm-tools-preview, miri |
| rustc_plugin / rustc_utils | =0.15.2-nightly-2026-05-01 |
| mdbook-aquascope crate version | 0.4.0 |
| Stale README install section | v0.3.7 with nightly-2024-12-15 (not a second pin) |

Machine-readable copy: `spikes/002-toolchain-bundling/pin.env`.

## Appendix B: method

Machine: macOS (Darwin 25.6.0), arm64. All scripts are in `spikes/002-toolchain-bundling/` and write to its gitignored `work/` directory.

| Step | Script | What it does |
| --- | --- | --- |
| T-005 | `build.sh` | Clones the tag, checks the commit, `cargo +nightly-2026-05-01 install --path crates/aquascope_front --locked`; 59 s |
| T-006 | `run.sh baseline` | Runs `cargo aquascope [--should-fail] permissions` per fixture with the rustup nightly, `SYSROOT` and the target libdir on the library path |
| T-007 | `assemble-toolchain.sh` | Copies exactly the files listed in rustup's `manifest-rustc-*`, `manifest-cargo-*` and `manifest-rust-std-*` (the same set the official tarballs install) into `work/toolchain-minimal` |
| T-007 | `run.sh minimal`, `compare.sh` | Same runs under `env -i` with only `HOME`, `CARGO_HOME`, `PATH` (Aquascope bin, toolchain bin, `/usr/bin`, `/bin`), `SYSROOT` and the library paths set |
| T-007 | `probe-env.sh` | Repeats one fixture with each variable removed |
| T-008 | `dep-network.sh` | Cache, offline and linker experiments |
| T-009 | `measure-bundle.sh`, `run.sh trimmed` | Builds the trimmed toolchain, measures unpacked and zip size (deflate level 6), reruns all fixtures |

Fixtures (`fixtures/`): `01_move_string`, `02_box_move`, `03_borrow_then_push`, `04_push_while_borrowed_fail` (run with `--should-fail`), `05_method_mut_borrow`, `crates/with-dep` (itoa 1.0.15), `crates/with-proc-macro` (serde 1.0.219 with derive). Crates are staged in a fresh temporary directory outside `$HOME` so no ancestor `.cargo/config.toml` applies. `/usr/bin` and `/bin` contain no Rust tools on the test machine.

Built binaries: `aquascope-driver` 7.7 MB, `cargo-aquascope` 1.0 MB. Both link `@rpath/librustc_driver-16d1e96e5b674978.dylib` and have no `LC_RPATH`.

## Appendix C: results by configuration

Every run exited 0 and every output is a list of `Ok` results (05 has three bodies: `grow`, `area`, `main`). Seconds are wall-clock with a cold target directory.

| Fixture | Bytes | Baseline s | Minimal s | Trimmed s | Minimal vs baseline | Trimmed vs baseline |
| --- | --- | --- | --- | --- | --- | --- |
| 01_move_string | 4163 | 0 | 1 | 2 | same | same |
| 02_box_move | 8005 | 0 | 0 | 1 | same | same |
| 03_borrow_then_push | 7024 | 0 | 0 | 0 | same | same |
| 04_push_while_borrowed_fail | 4490 | 0 | 1 | 0 | same | same |
| 05_method_mut_borrow | 16674 | 0 | 0 | 0 | reordered | reordered |
| with-dep | 5896 | 0 | 0 | 1 | same | same |
| with-proc-macro | 8379 | 4 | 5 | 4 | reordered | reordered |

"Reordered" means equal once every list is sorted. Two consecutive baseline runs differed the same way on `05_method_mut_borrow` (first difference: `steps[0].state[0].state[1][0]` is `r.height` in one run and `r.width` in the other), and `01_move_string` also reordered between probe runs, so the step-table order is not stable in Aquascope itself.

## Appendix D: environment probe (`probe-env.sh`, fixture 01)

| Environment | Result |
| --- | --- |
| HOME, CARGO_HOME, PATH, SYSROOT, DYLD_LIBRARY_PATH, LD_LIBRARY_PATH | OK |
| without SYSROOT | OK |
| without DYLD_LIBRARY_PATH | fails, exit 134: `dyld: Library not loaded: @rpath/librustc_driver-16d1e96e5b674978.dylib` |
| without LD_LIBRARY_PATH | OK (not used on macOS) |
| without CARGO_HOME | OK |
| without HOME | OK |
| PATH without the toolchain's bin | fails, exit 127 (`cargo` not found) |
| only PATH and DYLD_LIBRARY_PATH | OK |

`librustc_driver-*.dylib` exists twice in a full toolchain: `lib/` (from the `rustc` component) and `lib/rustlib/<host>/lib/` (from `rustc-dev`, per rustup's component manifests).

## Appendix E: bundle size (darwin-arm64)

| Bundle | Files | Unpacked | Zip (deflate 6) |
| --- | --- | --- | --- |
| Aquascope binaries + minimal toolchain | 148 | 544.8 MB | 170.3 MB |
| Aquascope binaries + trimmed toolchain | 71 | 369.5 MB | 120.1 MB |

Removed in the trimmed toolchain (all verified unnecessary for the fixtures on macOS): `lib/rustlib/aarch64-apple-darwin/bin` (rust-lld 124.9 MB, rust-objcopy 5.1 MB, wasm-component-ld 4.3 MB, gcc-ld wrappers; 136 MB total), `share/` (16 MB), `bin/rustdoc` (11.2 MB), `lib/librustc-nightly_rt.*` sanitizer runtimes (11.3 MB), `libexec/rust-analyzer-proc-macro-srv` (1.4 MB), `etc/`, and the `rust-gdb`/`rust-lldb` scripts.

Largest files in the trimmed bundle:

| Size | Path |
| --- | --- |
| 193.0 MB | toolchain/lib/librustc_driver-16d1e96e5b674978.dylib |
| 59.8 MB | toolchain/lib/rustlib/aarch64-apple-darwin/lib/libcore-*.rmeta |
| 30.2 MB | toolchain/bin/cargo |
| 9.1 MB | toolchain/lib/rustlib/aarch64-apple-darwin/lib/libstd-*.rlib |
| 8.1 MB | toolchain/lib/rustlib/aarch64-apple-darwin/lib/libobject-*.rmeta |
| 8.0 MB | toolchain/lib/rustlib/aarch64-apple-darwin/lib/libstd-*.rmeta |
| 7.7 MB | bin/aquascope-driver |
| 7.0 MB | toolchain/lib/rustlib/aarch64-apple-darwin/lib/liballoc-*.rmeta |

Full list: `work/results/bundle/filelist-trimmed.tsv` (regenerate with `measure-bundle.sh`).

## Appendix F: dependencies, network and linker (`dep-network.sh`)

| Case | Result |
| --- | --- |
| with-dep, empty CARGO_HOME, online | OK in 1 s; cache afterwards 164 KB: 1 crate archive, 2 sparse index entries |
| with-dep, same cache, `CARGO_NET_OFFLINE=true` | OK |
| with-dep, new empty cache, offline | exit 101: `error: no matching package named 'itoa' found` |
| with-proc-macro, no `cc` on PATH | exit 101: `error: linker 'cc' not found` |
| with-dep, no `cc` on PATH, warm cache, offline | OK |

## Appendix G: component availability and download sizes for nightly-2026-05-01

Source: `https://static.rust-lang.org/dist/2026-05-01/channel-rust-nightly.toml`. rustc, cargo, rust-std, rustc-dev, llvm-tools-preview, miri-preview and rust-src are all available for aarch64-apple-darwin, x86_64-apple-darwin, x86_64-unknown-linux-gnu, aarch64-unknown-linux-gnu, x86_64-pc-windows-msvc and aarch64-pc-windows-msvc. Sizes are the `Content-Length` of the `.tar.xz` files.

| Target | rustc | cargo | rust-std | Minimal total | rustc-dev (build only) |
| --- | --- | --- | --- | --- | --- |
| aarch64-apple-darwin | 63 MB | 8 MB | 27 MB | 98 MB | 113 MB |
| x86_64-apple-darwin | 76 MB | 9 MB | 27 MB | 112 MB | 120 MB |
| x86_64-unknown-linux-gnu | 75 MB | 10 MB | 28 MB | 113 MB | 114 MB |
| aarch64-unknown-linux-gnu | 59 MB | 10 MB | 28 MB | 97 MB | 102 MB |
| x86_64-pc-windows-msvc | 68 MB | 9 MB | 21 MB | 98 MB | 133 MB |

## Appendix H: upstream CI and prior art

- Aquascope `.github/workflows` (`ci.yml`, `release.yml`, `standalone.yml`) run on `ubuntu-latest` only. `release.yml` publishes one binary tarball, `aquascope-x86_64-unknown-linux-gnu.tar.gz`, built with Nix and patched with `patchelf --set-interpreter`.
- rustc_plugin `tests.yaml`: `ubuntu-latest` only.
- `rustc_plugin` mechanics (`crates/rustc_plugin/src/cli.rs`, `driver.rs`): the CLI runs `cargo check` via `Command::new("cargo")` with `RUSTC_WORKSPACE_WRAPPER` set to the driver next to the current executable; the driver's sysroot comes from `--sysroot`, then `MIRI_SYSROOT`, `SYSROOT`, `RUSTUP_HOME`+`RUSTUP_TOOLCHAIN`, `rustc --print sysroot`, then compile-time values.
- Flowistry `release.yml` builds x86_64 Linux, macOS and Windows; aarch64 Linux and macOS are commented out because cross-compiling `rustc_private` from x86 runners inserted wrong dylib paths (Flowistry issue #25). `ide/src/setup.ts` requires rustup, installs its nightly with rust-src, rustc-dev and llvm-tools-preview, and runs the binary with `SYSROOT`, the target libdir in `DYLD_LIBRARY_PATH` / `LIB` / `LD_LIBRARY_PATH`, and `~/.cargo/bin` on `PATH`. It pins `nightly-2026-05-01`.

## Appendix I: frontend evidence

- `npm view` returns `E404 Not Found` for `@aquascope/editor`, `@aquascope/embed` and `@aquascope/leader-line`.
- `crates/mdbook-aquascope/build.rs` copies `frontend/packages/aquascope-embed/dist/` to `./js`; `src/main.rs` registers `embed.iife.js` and `style.css` as assets. docs.rs lists `js/embed.iife.js`, `js/embed.iife.js.map` and `js/style.css` in the published 0.4.0 crate.
- `frontend/packages/aquascope-embed/src/main.tsx` declares the global `initAquascopeBlocks(root)` and an optional global `telemetry`.
- `crates/mdbook-aquascope/src/preprocessor.rs:151-168` builds `<div class="aquascope-embed">` with `data-code`, `data-annotations`, `data-operations`, `data-responses`, `data-config` and `data-no-interact="true"`.

## Appendix J: sources

- [Rust nightly 2026-05-01 component manifest](https://static.rust-lang.org/dist/2026-05-01/channel-rust-nightly.toml)
- [Aquascope v0.4.0 release](https://github.com/cognitive-engineering-lab/aquascope/releases/tag/v0.4.0)
- [mdbook-aquascope 0.4.0 source on docs.rs](https://docs.rs/crate/mdbook-aquascope/0.4.0/source/js/)
- [Flowistry](https://github.com/willcrichton/flowistry) and [rustc_plugin](https://github.com/cognitive-engineering-lab/rustc_plugin)
- [VS Code: Publishing extensions, platform-specific extensions](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [Azure DevOps extension package size error (25 MB cap, a different marketplace)](https://github.com/microsoft/azure-devops-extension-tasks/issues/165)
- [Azure DevOps: package and publish extensions](https://learn.microsoft.com/en-us/azure/devops/extend/publish/overview?view=azure-devops)
- [Open VSX: Request Entity Too Large when publishing](https://github.com/EclipseFdn/open-vsx.org/issues/8724)
- [Tailscale VS Code extension: VSIX size and per-platform packaging](https://github.com/tailscale-dev/vscode-tailscale/issues/73)
