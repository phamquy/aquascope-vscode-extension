---
id: T-032
title: "Test, package and check the VSIX"
status: review
priority: medium
feature: "005-package-per-platform-vsix"
created: 2026-11-07
---

# T-032 Test, package and check the VSIX

Spec: [[specs/features/005-package-per-platform-vsix/spec.md]]

## Done when

- [x] the script runs the strict tests against the bundle, packages `darwin-arm64` with the bundle at the root only for `vsce`, removes it on every exit, deletes the previous VSIX first, and `scripts/check-vsix.mjs` passes AC1 to AC3; `npm run package` runs it; AC4 and AC7 recorded; R5, R8, R9

## Notes

- `scripts/package-platform.sh` now runs all five stages. **test** runs typecheck, lint and `npm test` with `AQUASCOPE_REQUIRE_TOOLCHAIN=1` and `AQUASCOPE_TEST_TOOLCHAIN=build/bundle`, and stops on any failure. **package** copies the bundle to the root `aquascope/`, runs `npx --no-install vsce package --target darwin-arm64 --no-dependencies --out <vsix>` (which runs the production build), removes `aquascope/`, runs the check and prints the path and size. A `trap` removes the root `aquascope/` on every exit, and the previous VSIX for the target is deleted right after the check stage.
- `scripts/check-vsix.mjs` (Node rather than the planned shell script) reads the VSIX with `zipinfo` and `unzip -p`. It checks: the `TargetPlatform`; the binaries, `cargo` and `rustc` executable and the compiler library present; every toolchain entry in the `rustc`/`cargo`/`rust-std` manifests and not trimmed, or a kept licence file (the lists come from `bundle-paths.sh`); `LICENSE.txt` (vsce renames the extension's `LICENSE`), Aquascope's `LICENSE` and notices, the embed's `LICENSE` and notices, and the kept Rust licence files; the crate notices identical to this bundle's; nothing from `build/`, `spikes/` or `scripts/`; at most 150 MB. A deliberately bad copy (with `rustdoc` added back, compared with another bundle's notices) failed with both problems listed; a missing notices file is reported rather than crashing.
- `npm run package` now runs the script. `.gitignore` ignores `/aquascope/` (anchored at the root, so `media/aquascope-embed/` stays tracked).
- Result (2026-11-06): `aquascope-vscode-extension-darwin-arm64-0.0.1.vsix`, 105 files, 124.2 MB, 86 toolchain files, check ok; the whole run took 38 s with the build cached.
- AC4, checked: with a test made to fail, the script stopped at the test stage ("the tests failed against build/bundle; no package was written", exit 1). With a copy of the script pointing the tests at a missing bundle, it stopped the same way, the strict runner naming the path. In both cases there was no VSIX and no root `aquascope/` afterwards. The test file was restored and the copy deleted.
- AC7: the script's last line names the VSIX and its size. The README has an "Installing" section (Install from VSIX, nothing else needed) and a "Building a package" section (prerequisites, the five stages, about 125 MB, first-run download of about 1 GB, `build/` can be deleted).
- Note: the harness unit test from T-030 prints its own "no toolchain bundle … skipping" line twice while exercising the skip path, even in a strict run; that is the test, not a skip.
- A stale universal `aquascope-vscode-extension-0.0.1.vsix` from feature 001 (5 Nov, 3 KB) is still at the root, untracked.

