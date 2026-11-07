---
feature: 005-package-per-platform-vsix
---

# Plan

## Approach

The feature is one shell script, `scripts/package-platform.sh`, which `npm run package` runs, plus the licence files it needs and a small change to how the tests treat a missing toolchain. The script works in a gitignored `build/` folder at the repository root, which `.vscodeignore` also excludes. It runs in five stages, each stopping the script with a message on failure: check, build, assemble, test, and package. Spike 002's scripts remain as the record of the experiment. The production script repeats their few relevant commands rather than calling them, so that it does not write into the spike's `work/` folder.

**Check.** The script maps `uname -sm` to the platform. `Darwin arm64` becomes rustup host `aarch64-apple-darwin` and `vsce` target `darwin-arm64`; anything else stops it (D1). It reads `spikes/002-toolchain-bundling/pin.env`, clones the pinned tag into `build/aquascope-src` if it is not there yet, and stops if the checkout's commit or its `rust-toolchain.toml` channel differs from the pin (R2).

**Build.** As `build.sh` did, the script installs the pinned nightly with rustup and its build components. It then runs `cargo install --locked --path crates/aquascope_front --root build/install` (R3). This is the slow step, a few minutes, and cargo's own cache in `build/` makes reruns fast.

**Assemble.** The script fills a staging folder, `build/bundle/`, in the 003 R3 layout:

- **Binaries:** the two Aquascope binaries, copied unmodified into `bin/`. Patching them, for example with an rpath, would break their ad-hoc signature on arm64.
- **Toolchain:** the minimal toolchain in `toolchain/`, copied from the rustup installation file by file from the `rustc`, `cargo` and `rust-std` manifests, as `assemble-toolchain.sh` did.
- **Trimming:** it removes the same paths as spike 002, except that it keeps the Rust licence files. Appendix C has the exact keep and remove lists.
- **Licences:** it adds Aquascope's `LICENSE` from the checkout and a generated `THIRD-PARTY-NOTICES` for the crates linked into the binaries.

`scripts/crate-notices.mjs` writes that notices file (D4). It reads `cargo metadata --locked --format-version 1` in the checkout, walks the resolved dependency graph from `aquascope_front`, skips Aquascope's own workspace crates and `rustc_private` crates, which are covered by the Aquascope and Rust licences, and takes each crate's licence texts from its source in the cargo cache. A crate that ships no text gets its licence identifier.

**Test.** The script runs `npm run typecheck`, `npm run lint` and `npm test` with `AQUASCOPE_TEST_TOOLCHAIN=build/bundle` and a new `AQUASCOPE_REQUIRE_TOOLCHAIN=1`. In that mode `runTest.ts` stops if the bundle path does not exist, and the harness's `requireToolchain` fails a test instead of skipping it. A missing or misplaced bundle therefore fails the run rather than passing it untested (R5, AC4).

**Package.** Only after the tests pass does the script copy `build/bundle/` to `aquascope/` at the repository root and run `npx vsce package --target darwin-arm64 --no-dependencies`. That root folder is gitignored, but `.vscodeignore` does not exclude it. `vsce` runs the production build first (`vscode:prepublish`).

A `trap` removes the root `aquascope/` on every exit, success or failure. The previous VSIX for the target is deleted at the start, so a VSIX that exists afterwards comes from this run.

Then `scripts/check-vsix.sh` checks the package against AC1 to AC3, reading it with `zipinfo`:

- the manifest's target platform;
- the required files, with their executable bits;
- every toolchain file, against the component manifests and the trim list;
- the licence files;
- the size limit of 150 MB.

The script prints the VSIX's path and size.

Two files are written by hand and committed rather than generated on every run:

- **The extension's `LICENSE`** (D5).
- **`media/aquascope-embed/THIRD-PARTY-NOTICES`.** It covers the libraries bundled in `embed.iife.js`. Their names and versions come from the pinned frontend's `pnpm-lock.yaml`, taking the production dependency closure of `@aquascope/embed` and `@aquascope/editor`. Their copyright lines and licence texts come from each package's own files at those versions, fetched once with `npm pack` into a temporary folder.

The last task is the install check of AC5, done by hand on a macOS account without rustup with a browser-downloaded VSIX, followed by recording the results and closing the feature. The module responsibilities are in Appendix A, and the mapping from criteria to checks in Appendix B.

## VS Code APIs and contribution points

None. The feature changes how the extension is built and packaged, not what it contributes. `package.json` changes only its `package` script.

## Files touched

- `LICENSE`: MIT, "Copyright (c) 2026 Jack Pham" (D5).
- `media/aquascope-embed/THIRD-PARTY-NOTICES`, with a line in that folder's `README.md`.
- `scripts/package-platform.sh`, `scripts/crate-notices.mjs` and `scripts/check-vsix.sh`.
- `package.json`: `"package": "bash scripts/package-platform.sh"`.
- `.gitignore`: `build/` and `aquascope/`. `.vscodeignore`: `build/**`.
- `src/test/runTest.ts` and `src/test/suite/harness.ts`: the `AQUASCOPE_REQUIRE_TOOLCHAIN` mode.
- `README.md`: building a package, and installing it from the VSIX file (R9).

## Risks

- **The shipped code is not the tested build.** The tests run the development build of the extension, while `vsce` ships the minified production build, made from the same sources. AC5 runs the shipped package, which is the check on that difference.
- **Gatekeeper and file permissions on install.** Whether macOS blocks the unsigned binaries in a browser-downloaded VSIX, and whether VS Code keeps their executable bits when it unpacks it, are only known after AC5. If either fails, the feature returns to the spec, since signing is out of scope.
- **Disk and time.** The first run downloads the nightly with `rustc-dev` (about 1 GB) and builds Aquascope (a few minutes and several GB in `build/`). Nothing deletes `build/` automatically; the README says it can be removed.
- **Notice completeness.** Crates and npm packages that ship no licence text get their licence identifier only. The notices are as complete as the packages' own metadata, and the script lists the crates it could not find a text for.
- **Network at development time.** The build, and fetching the npm packages for the embed's notice, reach rustup, crates.io, GitHub and the npm registry, and each needs your approval when it first runs. The packaged extension never does (R8).
- **Size.** Spike 002 measured 120 MB for the binaries and toolchain alone. The licence files and the extension add a few MB, inside the 150 MB limit, and `check-vsix.sh` enforces it.

## Test strategy

- **Harness:** the strict toolchain mode gets unit tests in the existing suite (`harness.test.ts`): it fails instead of skipping when it is set and no bundle is found, and the default still skips.
- **Package checks:** `check-vsix.sh` turns AC1 to AC3 into automatic checks at the end of every packaging run.
- **Failure paths, run once by hand and recorded in the task notes:** AC4, with a deliberately failing test and with the bundle path pointed elsewhere, then no VSIX and no root `aquascope/` afterwards; and AC6, with the pin's commit and then its nightly changed.
- **The install check** of AC5 is by hand, on a macOS account without rustup, with a browser-downloaded VSIX and the network off.

## Appendix A: module responsibilities

| Module | Requirements | Decides |
| --- | --- | --- |
| `scripts/package-platform.sh` | R1–R6, R8, R9 | Platform mapping; pin and checkout checks; rustup install and `cargo install`; manifest-based copy and trim; staging layout; strict test run; root `aquascope/` only for `vsce`, removed by `trap`; old VSIX deleted first; path and size printed |
| `scripts/crate-notices.mjs` | R7, D4 | Dependency graph of `aquascope_front` from `cargo metadata`; licence texts from the cargo cache, or the identifier; crates without a text listed |
| `scripts/check-vsix.sh` | R6, R7, AC1–AC3 | Target platform in the manifest; required executables; toolchain files against the manifests and trim list; licence files; size of at most 150 MB |
| `src/test/runTest.ts`, `harness.ts` | R5 | `AQUASCOPE_REQUIRE_TOOLCHAIN`: a missing bundle stops the run, and `requireToolchain` fails instead of skipping |
| `LICENSE`, `media/aquascope-embed/THIRD-PARTY-NOTICES` | R7, D5 | The extension's licence; the embed's libraries with version, copyright line and licence |

## Appendix B: acceptance criteria to checks

| Criterion | Check |
| --- | --- |
| AC1 | `check-vsix.sh`: `TargetPlatform="darwin-arm64"` in `extension.vsixmanifest`; the five required files present with executable bits (`zipinfo`); every other file under `extension/aquascope/toolchain/` is in a component manifest and not in the trim list, or is a kept licence file |
| AC2 | `check-vsix.sh`: VSIX size at most 150 MB |
| AC3 | `check-vsix.sh`: `extension/LICENSE`, the kept Rust licence files, `extension/aquascope/LICENSE`, `extension/aquascope/THIRD-PARTY-NOTICES` naming every crate of the graph, `extension/media/aquascope-embed/THIRD-PARTY-NOTICES` |
| AC4 | By hand, recorded: a test made to fail, then `AQUASCOPE_TEST_TOOLCHAIN` pointed at a missing path; each stops the script with no VSIX and no root `aquascope/` |
| AC5 | By hand: a macOS account without rustup, the network off, the VSIX downloaded through a browser (from a draft GitHub release), installed into a fresh profile, `main` of `05_method_mut_borrow` drawn, no security dialog |
| AC6 | By hand, recorded: the pin's commit changed, then its nightly changed; each stops before building and names the mismatch. The platform check by reading the script |
| AC7 | The script's last lines name the VSIX and its size; the README sections exist |

## Appendix C: trim and keep lists

Removed from the copied toolchain, as `measure-bundle.sh` did for darwin-arm64:

- `share/`, apart from the kept files below;
- `etc/` and `libexec/`;
- `bin/rustdoc`, `bin/rust-gdb`, `bin/rust-gdbgui` and `bin/rust-lldb`;
- `lib/librustc-nightly_rt.*`;
- `lib/rustlib/aarch64-apple-darwin/bin/`.

Kept from `share/`:

- `share/doc/rust/COPYRIGHT.html`, `share/doc/rust/COPYRIGHT-library.html` and `share/doc/rust/licenses/`, which come from the `rustc` component;
- `share/doc/cargo/LICENSE-APACHE`, `LICENSE-MIT` and `LICENSE-THIRD-PARTY`, which come from the `cargo` component.

`rust-std` carries no licence files of its own, so the `rustc` component's files cover the standard library too.
